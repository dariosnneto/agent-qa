# Como Funciona o Genie CLI

## O que é

O **Genie** é um orquestrador de agentes AI para projetos de software. Ele gerencia equipes de agentes Claude Code rodando em sessões tmux isoladas, coordena comunicação entre eles via PostgreSQL (eventos e mailbox), e fornece ferramentas para criar, monitorar e controlar workflows autônomos.

---

## Arquitetura

```
genie serve          — Daemon principal (pgserve + scheduler + inbox-watcher)
genie spawn          — Spawna agente em pane tmux
genie team create    — Cria equipe multi-agente
genie send           — Mensagem entre agentes (via mailbox PG)
genie status         — Progresso de wishes (tarefas)
genie events         — Stream de eventos estruturados
```

### Componentes internos

```
src/genie.ts                    — Entry point CLI (commander)
src/lib/
  db.ts                         — Conexão PostgreSQL + pgserve lifecycle
  db-migrations.ts              — Migrações automáticas do schema
  tmux.ts                       — Controle de sessões/panes tmux
  spawn-command.ts              — Spawn de agentes + waitForExecutorReady
  executor-registry.ts          — Registro de executores (PG)
  messaging.ts                  — Sistema de mailbox entre agentes
  scheduler.ts                  — Agendamento de tarefas periódicas
  event-router.ts               — Roteamento de eventos runtime
  frontmatter.ts                — Parser de AGENTS.md (YAML + Zod)
  auto-approve.ts               — Regras de auto-aprovação de permissões
src/term-commands/
  serve.ts                      — `genie serve` daemon
  agent/                        — Comandos de agente (spawn, kill, send...)
  team/                         — Comandos de equipe
  task/                         — Comandos de tarefa
src/services/
  omni-bridge.ts                — Bridge NATS ↔ PostgreSQL
src/hooks/                      — Git hooks (branch-guard, auto-spawn)
skills/                         — Prompts de skills (brainstorm, work, review...)
```

---

## Estado e persistência

O estado do Genie está distribuído em 4 escopos:

| Estado | Localização | Escopo | Formato |
|---|---|---|---|
| Wish state | `<repo>/.genie/state/<slug>.json` | Por repositório | JSON |
| Worker registry | `~/.genie/workers.json` | Global | JSON |
| Team configs | `~/.genie/teams/<name>.json` | Global | JSON |
| Mailbox | `<repo>/.genie/mailbox/<worker>.json` | Por repositório | JSON |
| Team chat | `<repo>/.genie/chat/<team>.jsonl` | Por worktree | JSONL |
| Sessions | `~/.genie/sessions.json` | Global | JSON |
| PG (eventos, executores) | pgserve porta 19642 | Runtime | PostgreSQL |

---

## Rodando no WSL

O Genie requer Linux para funcionar completamente (tmux + pgserve com módulos nativos). No Windows, use WSL Ubuntu.

### Iniciar o servidor

```bash
# Modo headless (sem TUI — apenas serviços)
wsl -d Ubuntu /home/user/.bun/bin/bun /mnt/c/AgentQA/genie/dist/genie.js serve start --headless

# Verificar status
wsl -d Ubuntu /home/user/.bun/bin/bun /mnt/c/AgentQA/genie/dist/genie.js serve status

# Parar
wsl -d Ubuntu /home/user/.bun/bin/bun /mnt/c/AgentQA/genie/dist/genie.js serve stop
```

**Serviços que sobem:**
- `pgserve` — PostgreSQL embarcado na porta 19642 (usa `~/pgserve-tmp/` no WSL)
- `scheduler` — in-process, gerencia eventos periódicos
- `inbox-watcher` — poll 30s, entrega mensagens da mailbox

### Build

```bash
wsl -d Ubuntu /home/user/.bun/bin/bun run --cwd /mnt/c/AgentQA/genie build
# Gera: dist/genie.js (~5MB, single-file bundle)
```

### Executar testes

```bash
wsl -d Ubuntu bash /mnt/c/AgentQA/genie/wsl-run-tests.sh
# 2476 testes, ~45s
```

O script `wsl-run-tests.sh`:
1. Mata pgserve órfão anterior
2. Inicia pgserve nativo WSL na porta 20950
3. Roda migrations
4. Executa `bun test` com `GENIE_TEST_SKIP_PGSERVE=1`

---

## Fixes aplicados (histórico)

Problemas corrigidos ao portar para WSL/Zod v4:

| Arquivo | Fix |
|---|---|
| `src/lib/db.ts` | `findPgserveBin()` prefere `~/pgserve-tmp/` (cross-filesystem) |
| `src/lib/test-setup.ts` | Idem + spawn `.cjs` via `process.execPath` no Windows |
| `src/lib/frontmatter.ts` | Normaliza CRLF antes do regex; `z.record(z.string(), z.unknown())` (Zod v4) |
| `src/lib/auto-approve.ts` | `.default({ allow: [], deny: [] })` (Zod v4 não aplica defaults aninhados) |
| `src/lib/spawn-command.test.ts` | Lower bound `>= 250` (timer jitter WSL) |
| `src/services/__tests__/omni-bridge.test.ts` | Lower bound `>= 1750` |
| `src/term-commands/log.test.ts` | Janela de espera PG NOTIFY `1500ms → 3000ms` |

---

## Estrutura de agentes (AGENTS.md)

Cada agente é definido por um arquivo `AGENTS.md` com frontmatter YAML:

```yaml
---
name: engineer
description: Implementa features e corrige bugs
model: claude-sonnet-4-6
provider: claude
tools: [Read, Write, Edit, Bash, Glob, Grep]
permissionMode: acceptEdits
---

# Engineer Agent
Você é um engenheiro de software...
```

Campos suportados: `name`, `description`, `model`, `color`, `promptMode`, `provider`, `tools`, `permissionMode`, `disallowedTools`, `permissions`, `omniScopes`, `hooks`, `sdk`.

---

## Comandos essenciais

```bash
genie team create <name> --repo <path> --wish <slug>  # Equipe autônoma
genie spawn <role>                                     # Spawna agente
genie send '<msg>' --to <agent>                        # Mensagem cross-session
genie status <slug>                                    # Progresso da wish
genie events list --since 5m                           # Eventos recentes
genie ls --json                                        # Estado dos agentes
```

> **Regra:** Nunca use `Agent` tool para spawnar agentes — use `genie spawn`. Nunca passe `--session` com `--team`.
