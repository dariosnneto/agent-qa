# Como Executar os Testes QA — Eugênia

## O que é

O QA Agent **Eugênia** é um sistema automatizado de testes de chatbot WhatsApp. Ele envia mensagens reais para um número de WhatsApp e usa Claude (Haiku) como avaliador para verificar se as respostas atendem aos critérios definidos. Ao final, gera um relatório Markdown em `reports/` e abre issues automáticas no GitHub para cada bug encontrado.

---

## Pré-requisitos

### Infraestrutura (WSL Ubuntu)

Todos os serviços rodam via WSL. Certifique-se de que o WSL Ubuntu está instalado e funcionando.

**1. Omni API + Infraestrutura**

```bash
# Subir PostgreSQL e NATS via Docker
wsl -d Ubuntu bash -c "cd /mnt/c/AgentQA && docker compose -f docker-compose-omni.yml up -d"

# Aguardar o Postgres estar pronto (~5s) e iniciar a API
wsl -d Ubuntu bash -c "cd /mnt/c/AgentQA/omni && /home/user/.bun/bin/bun packages/api/src/index.ts"
```

A API ficará disponível em `http://localhost:8882`.

**Verificar saúde:**
```bash
curl http://localhost:8882/api/v2/health
# Deve retornar: {"status":"healthy",...,"instances":{"connected":1}}
```

**2. WhatsApp conectado**

A instância WhatsApp `qa-agent-eugenia` precisa estar conectada. Verificar:
```bash
curl -H "Authorization: Bearer $OMNI_API_KEY" http://localhost:8882/api/v2/instances
```

Se `isActive: false`, acesse `http://localhost:8882` para escanear o QR code.

---

## Variáveis de ambiente

O arquivo `.env` na raiz de `C:\AgentQA\` deve conter:

```env
ANTHROPIC_API_KEY=sk-ant-...        # Chave da API Anthropic (avaliador Claude)
OMNI_API_URL=http://localhost:8882  # URL da Omni API
OMNI_API_KEY=omni_sk_...            # API key gerada pelo Omni na primeira execução
OMNI_INSTANCE_ID=<uuid>             # ID da instância WhatsApp (gerado no primeiro setup)
EUGENIA_PHONE=5551998882486         # Número do WhatsApp de Eugênia (sem +)
DEV_PHONE=5534988419291             # Número do dev para notificação final (sem +)
GITHUB_TOKEN=ghp_...                # Token GitHub (para criar issues de bugs)
GITHUB_REPO=dariosnneto/agent-qa    # Repositório para as issues
```

> **Importante:** Não use `set -a && . ./.env` no bash — o arquivo tem CRLF (Windows) e isso inclui `\r` nos valores. O bun carrega o `.env` automaticamente sem esse problema.

---

## Executar os testes

```bash
wsl -d Ubuntu bash -c "cd /mnt/c/AgentQA && /home/user/.bun/bin/bun run src/index.ts"
```

O QA executa os 3 cenários em sequência (30 casos no total), aguardando 3s entre cada teste.

---

## Cenários de teste

### Cenário 1 — Onboarding e Apresentação (10 casos)
Valida apresentação, listagem de produtos, tratamento de inputs inválidos, idioma inglês, handoff para humano e encerramento.

### Cenário 2 — Cotação PF: Individual e Familiar (10 casos)
Valida fluxo de cotação para pessoa física: coleta de idade, composição familiar, coberturas, carência, formas de pagamento e descontos.

### Cenário 3 — Cotação PJ: Pessoa Jurídica (10 casos)
Valida fluxo corporativo: número de funcionários, microempresas (MEI), grandes contas (500+), dependentes, reembolso e envio de proposta.

---

## Saída e relatório

Durante a execução:
```
📋 Cenário 1 — Onboarding e Apresentação
  → [01-01] "Oi"
     ✅ PASS (score: 9/10) — Eugênia se apresentou e mencionou App Vida
  → [01-02] "O que você oferece?"
     ✅ PASS (score: 8/10) — ...
```

Ao final:
- Relatório Markdown salvo em `reports/YYYY-MM-DD-HH-MM-SS.md`
- Issues criadas no GitHub para cada falha com sugestão de correção
- Notificação WhatsApp enviada para `DEV_PHONE`

---

## Arquitetura do QA

```
src/index.ts          — Orquestrador principal
src/setup.ts          — Conecta/cria instância WhatsApp no Omni
src/omni-client.ts    — Envia mensagens e faz polling de respostas
src/runner.ts         — Executa cada TestCase e coleta resultados
src/evaluator.ts      — Avalia respostas usando Claude Haiku como juiz
src/reporter.ts       — Gera relatório Markdown e notifica via WhatsApp
src/github-client.ts  — Cria issues automáticas para bugs
src/scenarios/        — Definição dos casos de teste por cenário
src/types.ts          — Tipos compartilhados
```

### Fluxo por caso de teste

```
sendAndPoll(message)
  → omni.messages.send()          # Envia mensagem para Eugênia
  → pollResponse(chatId, after)   # Aguarda resposta (timeout: 30s)
  → evaluate(testCase, response)  # Claude Haiku avalia a resposta
  → TestResult { pass, score, reason, fixSuggestion }
```

---

## Solução de problemas

| Problema | Causa | Solução |
|---|---|---|
| `Instância não encontrada` | OMNI_INSTANCE_ID com `\r` (CRLF) | Use `bun run` sem `set -a && . ./.env` |
| `A record with that name already exists` | Tentativa de recriar instância existente | Idem acima |
| `Chat com XXXXX não encontrado` | EUGENIA_PHONE incorreto ou WhatsApp desconectado | Verificar número e reconectar |
| `Sem resposta no prazo de 30s` | Eugênia offline ou número errado | Verificar se o agente está ativo |
| `pgserve failed to start` | pgserve-wrapper.cjs em `/mnt/c/` (cross-filesystem) | WSL-native pgserve em `~/pgserve-tmp/` |
