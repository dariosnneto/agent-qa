# QA-AGENTS.md — Guia de Estrutura para Projetos de QA de Agentes

Conhecimento consolidado a partir do projeto AgentQA + Eugênia (App Vida).
Use este documento como base para estruturar novos projetos de validação de agentes de IA.

---

## 1. Arquitetura Base

### Componentes obrigatórios

| Componente | Responsabilidade |
|---|---|
| `src/index.ts` | Entrypoint — instancia o client, executa cenários, chama o reporter |
| `src/types.ts` | Tipos de domínio compartilhados (TestCase, TestResult, ScenarioResult) |
| `src/runner.ts` | Loop de execução dos cenários + interface `MessagingClient` |
| `src/evaluator.ts` | LLM-as-a-Judge — avalia cada resposta contra o critério |
| `src/reporter.ts` | Agrega resultados, gera relatório Markdown, integra com bug tracker |
| `src/scenarios/` | Casos de teste — separados por cenário em arquivos individuais |

### Componentes de transporte (modo de operação)

| Componente | Quando usar |
|---|---|
| `src/webhook-client.ts` | Agente exposto como HTTP server — modo padrão e recomendado |
| `src/omni-client.ts` | Agente no WhatsApp via Omni API — modo alternativo |

### Interface central

Todo o projeto gira em torno de uma única interface:

```typescript
export interface MessagingClient {
  isConnected(): Promise<boolean>;
  sendAndPoll(text: string, timeoutMs?: number): Promise<string | null>;
  sendNotification(to: string, text: string): Promise<void>;
}
```

Tanto `WebhookClient` quanto `OmniClient` implementam essa interface. O runner, reporter e entrypoint dependem **apenas da interface** — nunca das implementações concretas. Trocar de modo requer apenas uma mudança no `.env`.

---

## 2. Estrutura de Pastas

```
projeto-qa/
├── .github/
│   └── workflows/
│       └── qa.yml                # CI — re-executa QA a cada mudança no agente
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── runner.ts
│   ├── evaluator.ts
│   ├── reporter.ts
│   ├── github-client.ts
│   ├── webhook-client.ts
│   ├── omni-client.ts
│   ├── setup.ts
│   ├── [agent]-webhook.ts        # servidor do agente sob teste
│   └── scenarios/
│       ├── 01-[cenario].ts
│       ├── 02-[cenario].ts
│       └── index.ts
├── scripts/
│   ├── start-[agent].sh          # inicia o servidor do agente (WSL/Bun)
│   └── run-qa.sh                 # atalho para bun run src/index.ts
├── reports/                      # gitignored
├── .env
├── .env.example
├── .gitignore
├── package.json
└── QA-AGENTS.md
```

---

## 3. Variáveis de Ambiente

### Obrigatórias sempre

```env
ANTHROPIC_API_KEY=sk-ant-...
```

### Modo webhook (padrão)

```env
AGENT_WEBHOOK_URL=http://localhost:3001   # presença desta var ativa o modo webhook
```

### Modo WhatsApp via Omni

```env
OMNI_API_URL=http://localhost:8882
OMNI_API_KEY=omni_sk_...
OMNI_INSTANCE_ID=                         # preenchido automaticamente após primeiro run
AGENT_PHONE=5551999999999                 # número do agente (sem +)
DEV_PHONE=5511999999999                   # número do dev para notificações
```

### Integração com bug tracker

```env
GITHUB_TOKEN=ghp_...
GITHUB_REPO=owner/repo
```

### Lógica de seleção de modo em `index.ts`

```typescript
async function buildClient(): Promise<MessagingClient> {
  if (process.env.AGENT_WEBHOOK_URL) {
    return new WebhookClient(process.env.AGENT_WEBHOOK_URL);
  }
  // imports dinâmicos — nunca estáticos (quebram em modo webhook)
  const { setupInstance } = await import('./setup');
  const { OmniClient } = await import('./omni-client');
  // ... configura Omni
}
```

> **Imports do Omni devem ser dinâmicos** (`await import()`). Imports estáticos tentam resolver `@omni/sdk` na inicialização e quebram em modo webhook mesmo sem usar o Omni.

---

## 4. Estrutura de Casos de Teste

```typescript
export interface TestCase {
  id: string;          // ex: "01-03"
  message: string;     // mensagem enviada ao agente
  criterion: string;   // o que a resposta deve conter/expressar (semântico, não exato)
}
```

### Boas práticas para critérios

- **Específico:** "O agente deve mencionar que planos PJ atendem empresas de 2 a 499 funcionários"
- **Evitar vago:** "O agente deve dar uma boa resposta sobre planos PJ"
- Critérios vagos aumentam a variação entre execuções do avaliador

### Cobertura mínima por cenário

| Tipo de caso | Exemplo |
|---|---|
| Caminho feliz | Saudação, apresentação, fluxo principal |
| Entrada inválida | Texto sem sentido, caracteres aleatórios |
| Troca de idioma | Mensagem em inglês/espanhol |
| Casos extremos | Limites de negócio (ex: empresa com 500+ funcionários) |
| Perguntas específicas | Pagamento, desconto, cobertura, reembolso |

---

## 5. Evaluator — LLM-as-a-Judge

O evaluator recebe `[mensagem + resposta + critério]` e retorna:

```typescript
interface EvaluationResult {
  pass: boolean;
  score: number;        // 0–10
  reason: string;       // por que passou ou falhou
  suggestion: string;   // como corrigir (se falhou)
}
```

### Cuidados na implementação

O modelo pode retornar JSON envolto em markdown fence — strip obrigatório antes de `JSON.parse()`:

```typescript
const raw = rawText
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/, '')
  .trim();
```

---

## 6. Servidor do Agente (Webhook Mode)

```typescript
// [agent]-webhook.ts
const server = Bun.serve({
  port: 3001,
  async fetch(req) {
    const { message, contextMessages } = await req.json();
    // monta histórico, chama LLM, retorna { reply }
  }
});
```

### Script de inicialização (`scripts/start-[agent].sh`)

```bash
#!/bin/bash
set -a; source /mnt/c/SeuProjeto/.env; set +a   # carrega .env sem expor vars no histórico
pkill -f [agent]-webhook 2>/dev/null || true
sleep 1
nohup /home/user/.bun/bin/bun /mnt/c/SeuProjeto/src/[agent]-webhook.ts > /tmp/[agent].log 2>&1 &
echo PID=$!
```

> **Nunca hardcode `ANTHROPIC_API_KEY` nos scripts** — o GitHub Push Protection bloqueia o push e exige reescrita do histórico git.

---

## 7. CI com GitHub Actions

```yaml
# .github/workflows/qa.yml
name: QA Agent

on:
  push:
    paths:
      - 'src/[agent]-webhook.ts'   # cérebro do agente — qualquer mudança re-executa os testes
      - 'src/index.ts'
      - 'src/scenarios.ts'
      - 'src/evaluator.ts'
  workflow_dispatch:

jobs:
  qa:
    runs-on: ubuntu-latest
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      AGENT_WEBHOOK_URL: http://localhost:3001
      GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
      GITHUB_REPO: ${{ github.repository }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: nohup bun src/[agent]-webhook.ts > /tmp/agent.log 2>&1 &
      - name: Aguardar servidor
        run: |
          for i in $(seq 1 15); do
            curl -sf -X POST http://localhost:3001 \
              -H "Content-Type: application/json" \
              -d '{"message":"ping","contextMessages":[]}' && exit 0
            sleep 1
          done; exit 1
      - run: bun run src/index.ts
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: qa-report-${{ github.run_number }}
          path: reports/
          retention-days: 30
```

### Secrets necessários no GitHub

| Secret | Descrição |
|---|---|
| `ANTHROPIC_API_KEY` | Chave Anthropic |
| `DEV_PHONE` | Número para notificações |
| `GH_TOKEN` | PAT com `repo` scope (para abrir issues) |

---

## 8. .gitignore Padrão

```gitignore
node_modules/
reports/
data/
docs/
.env
*.log
*.png
README.ptbr.md
review-report.md
gen-pdfs.mjs
```

---

## 9. Validação de Agentes — Princípios Fundamentais

### Não-determinismo

LLMs não produzem saídas idênticas a cada chamada. A mesma entrada pode gerar respostas diferentes. **Uma única execução não é suficiente** para tirar conclusões.

### Múltiplas execuções

Execute o suite no mínimo 3 vezes e analise os padrões:

- **Falha recorrente** (falha em toda execução) → problema real no system prompt ou no conhecimento do agente
- **Falha ocasional** (falha em 1 de 3) → variação normal, pode ser critério ambíguo

### Temperatura

| Temperatura | Comportamento | Uso recomendado |
|---|---|---|
| `0.0` | Determinístico | Avaliador (LLM-as-a-Judge) |
| `0.5` | Equilibrado | Chatbots e assistentes |
| `1.0+` | Alta variação | Escrita criativa |

### Métricas essenciais

```
pass_rate   = casos_aprovados / total × 100
score_médio = soma_scores / total
```

### Ciclo de melhoria contínua

```
Executar testes → Falhas recorrentes → Atualizar system prompt → Re-executar → Comparar
```

---

## 10. Geração de Relatórios em PDF

Use um script `gen-pdfs.mjs` (gitignored) com o padrão:

```javascript
// 1. Ler markdown
const md = readFileSync('reports/ultimo-relatorio.md', 'utf8');

// 2. Injetar spans coloridos para pass/fail
const processed = md
  .replace(/✅ PASS/g, '<span class="pass">✅ PASS</span>')
  .replace(/❌ FAIL/g, '<span class="fail">❌ FAIL</span>');

// 3. Converter para HTML com wrap()
const html = wrap('Título', 'Subtítulo', '#2563eb', mdToHtml(processed));
writeFileSync('reports/relatorio.html', html);

// 4. Converter para PDF via Chrome headless
// chrome --headless --print-to-pdf=relatorio.pdf --no-margins relatorio.html
```

---

## 11. Lições Aprendidas

| Situação | Causa | Solução |
|---|---|---|
| `@omni/sdk` quebra em modo webhook | Import estático resolve o módulo na inicialização | Usar `await import()` dinâmico apenas no branch Omni |
| QR code corrompido via PowerShell | PowerShell corrompe caracteres especiais (`+`, `/`, `=`) como args CLI | Salvar QR string em arquivo `.txt`, ler com Bun |
| GitHub Push Protection bloqueou push | `ANTHROPIC_API_KEY` hardcoded nos scripts | Usar `set -a; source .env; set +a` nos scripts shell |
| JSON com markdown fence do LLM | Claude às vezes envolve JSON em ` ```json ``` ` | Strip antes de `JSON.parse()` |
| Alta variação entre execuções | Temperatura padrão do modelo (~1.0) | Executar 3+ vezes, separar falhas recorrentes de ocasionais |
| Falhas recorrentes nos mesmos casos | Lacunas no system prompt do agente | Atualizar system prompt com a informação ausente |
