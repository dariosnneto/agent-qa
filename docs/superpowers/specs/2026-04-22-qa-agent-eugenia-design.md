# QA Agent Eugênia — Design Spec

**Data:** 2026-04-22  
**Prazo de entrega:** 2026-04-24 às 15h  
**Stack obrigatória:** Genie + Omni  
**Autor:** Dario Soares Nogueira Neto

---

## Contexto

A Namastex precisa de um agente de QA automatizado que teste a Eugênia — agente de vendas da App Vida rodando em ambiente de QA via WhatsApp (+55 51 99888-2486). O gargalo atual é que o dev precisa rodar os testes manualmente, identificar falhas sozinho e descobrir a correção sem suporte. O objetivo é entregar bugs já rastreados com sugestão de correção, deixando o dev focado em desenvolver e deployar.

---

## Arquitetura

```
┌─────────────────────────────────────────────┐
│              AgentQA (este repo)            │
│                                             │
│  ┌──────────────┐    ┌───────────────────┐  │
│  │  QA Agent    │    │   Omni (Docker)   │  │
│  │  (Genie/Bun) │◄──►│  WhatsApp Baileys │  │
│  │              │    │  REST API :8882   │  │
│  │  - runner    │    │  NATS JetStream   │  │
│  │  - evaluator │    │  PostgreSQL       │  │
│  │  - reporter  │    └───────────────────┘  │
│  └──────────────┘              │             │
│         │                      │ WhatsApp    │
│         ▼                      ▼             │
│  ┌──────────────┐    ┌───────────────────┐  │
│  │ Claude API   │    │  WhatsApp Network │  │
│  │ (avaliação   │    │                   │  │
│  │  LLM)        │    │ QA ──► Eugênia    │  │
│  └──────────────┘    │(+55 51 99888-2486)│  │
│                       └───────────────────┘  │
└─────────────────────────────────────────────┘
         │ relatório
         ▼
  📄 report.md  +  📱 WhatsApp → +55 34 9 8841-9291
```

**Componentes:**

| Componente | Responsabilidade |
|---|---|
| **Omni (Docker)** | Gerencia a sessão WhatsApp do agente QA (QR code no setup), expõe REST API para envio e recebe eventos via NATS |
| **QA Agent (Bun/TS)** | Orquestrado via Genie; executa cenários sequencialmente, aguarda respostas, coordena avaliação |
| **Evaluator** | Chama Claude API com mensagem enviada + resposta recebida + critério do teste; retorna `{ pass, score, reason, fix_suggestion }` |
| **Reporter** | Gera arquivo Markdown em `reports/` e envia resumo via WhatsApp para o dev |

---

## Cenários de Teste (3 × 10)

### Cenário 1 — Onboarding e Apresentação

| # | Mensagem enviada | Critério de avaliação |
|---|---|---|
| 1 | "Oi" | Eugênia se apresenta e menciona App Vida |
| 2 | "O que você oferece?" | Descreve os serviços/planos disponíveis |
| 3 | "Quais planos vocês têm?" | Lista categorias de plano (PF/PJ, individual/familiar) |
| 4 | "asdfghjkl" | Trata input inválido sem travar o fluxo |
| 5 | "." | Pede mais contexto ou mantém o fluxo |
| 6 | "What do you sell?" | Responde ou solicita que o usuário fale em português |
| 7 | "Quanto custa?" (sem contexto) | Pede mais informações antes de cotar |
| 8 | "O que é a App Vida?" | Explica a empresa/produto |
| 9 | "Quero falar com um atendente humano" | Executa protocolo de handoff |
| 10 | "Tchau, obrigado" | Encerra a conversa de forma adequada |

### Cenário 2 — Cotação PF (Individual e Familiar)

| # | Mensagem enviada | Critério de avaliação |
|---|---|---|
| 1 | "Quero uma cotação para mim" | Inicia coleta de dados (idade, perfil) |
| 2 | "Tenho 35 anos" | Processa a idade e continua o fluxo |
| 3 | "Quero incluir minha família no plano" | Pergunta número de dependentes/membros |
| 4 | "Somos 4: eu, minha esposa e 2 filhos" | Calcula cotação familiar |
| 5 | "Cobre consultas médicas?" | Detalha coberturas do plano |
| 6 | "Qual a diferença entre os planos?" | Compara opções disponíveis |
| 7 | "Tem carência?" | Informa política de carência |
| 8 | "Tenho -5 anos" | Trata idade inválida sem quebrar o fluxo |
| 9 | "Como posso pagar?" | Informa formas de pagamento disponíveis |
| 10 | "Tem algum desconto?" | Responde sobre descontos/promoções |

### Cenário 3 — Cotação PJ (Pessoa Jurídica)

| # | Mensagem enviada | Critério de avaliação |
|---|---|---|
| 1 | "Quero um plano para minha empresa" | Inicia fluxo PJ, pergunta dados da empresa |
| 2 | "Somos 10 funcionários" | Processa tamanho e continua cotação |
| 3 | "Cobre todos os funcionários?" | Explica abrangência do plano PJ |
| 4 | "Qual a diferença do plano empresa pro individual?" | Compara PJ vs PF claramente |
| 5 | "Tenho só 1 funcionário além de mim" | Trata microempresa/MEI adequadamente |
| 6 | "Somos 500 funcionários" | Redireciona para processo de grandes contas |
| 7 | "Os dependentes dos funcionários são cobertos?" | Informa política de dependentes PJ |
| 8 | "12345678" (CNPJ inválido, se solicitado) | Trata dado inválido sem travar |
| 9 | "O plano PJ tem reembolso?" | Responde sobre política de reembolso |
| 10 | "Pode me enviar uma proposta por e-mail?" | Coleta e-mail ou informa processo de proposta formal |

---

## Fluxo de Dados

### Setup (executado uma vez)

```
1. docker compose -f docker-compose-omni.yml up -d
2. QA Agent → POST /api/v2/instances        → cria instância WhatsApp
3. QA Agent → GET  /api/v2/instances/{id}/qr → exibe QR no terminal
4. Usuário escaneia com celular do agente QA → sessão conectada
```

### Execução de Cada Teste

```
1. Runner envia mensagem → POST /api/v2/messages  (Omni SDK)
2. Polling em GET /api/v2/messages?after={ts}     (timeout: 30s)
3. Evaluator → Claude API:
     input:  { mensagem_enviada, resposta_recebida, criterio }
     output: { pass: bool, score: 0-10, reason: string, fix_suggestion: string }
4. Runner registra resultado em TestResult[]
5. Aguarda 3s antes do próximo teste
```

### Relatório Final

```
1. Reporter gera reports/YYYY-MM-DD-HH-mm.md:
   - Resumo: X/30 passou, Y falhou
   - Tabela por cenário (pass/fail + motivo)
   - Seção de bugs com sugestão de correção por teste falho

2. Reporter envia WhatsApp para +55 34 9 8841-9291:
   "QA Eugênia finalizado: 27/30 passou
    3 bugs encontrados. Relatório: reports/2026-04-22-15-30.md
    Bugs: [resumo inline dos testes falhos]"
```

---

## Estrutura de Arquivos

```
AgentQA/
├── src/
│   ├── index.ts              # Entry point: setup + dispara runner
│   ├── setup.ts              # Omni: cria instância, exibe QR, aguarda conexão
│   ├── runner.ts             # Executa cenários sequencialmente
│   ├── evaluator.ts          # Chama Claude API, retorna TestResult
│   ├── reporter.ts           # Gera Markdown + envia WhatsApp
│   ├── omni-client.ts        # Wrapper Omni SDK (send, poll messages)
│   └── scenarios/
│       ├── index.ts          # Exporta todos os cenários
│       ├── 01-onboarding.ts  # Cenário 1 (10 testes)
│       ├── 02-cotacao-pf.ts  # Cenário 2 (10 testes)
│       └── 03-cotacao-pj.ts  # Cenário 3 (10 testes)
├── reports/                  # Relatórios gerados (.md)
├── docs/
│   └── pipeline.md           # Proposta de pipeline de desenvolvimento
├── .env                      # ANTHROPIC_API_KEY, OMNI_API_URL, OMNI_INSTANCE_ID, EUGENIA_PHONE, DEV_PHONE
├── package.json
└── docker-compose-omni.yml   # já existe no repo
```

### Variáveis de Ambiente (.env)

```env
ANTHROPIC_API_KEY=sk-ant-...
OMNI_API_URL=http://localhost:8882
OMNI_INSTANCE_ID=qa-agent-001   # gerado no setup; atualizar após primeiro run
EUGENIA_PHONE=+5551998882486
DEV_PHONE=+5534988419291
```

---

## Tratamento de Erros

| Situação | Comportamento |
|---|---|
| Eugênia não responde em 30s | Teste marcado como `TIMEOUT`, continua próximo |
| Omni API indisponível | Runner aborta com erro claro no terminal |
| Claude API falha na avaliação | Teste marcado como `EVAL_ERROR`, registra raw response |
| WhatsApp desconecta mid-run | Runner pausa, exibe aviso, aguarda reconexão (3 tentativas) |
| Todos os testes de um cenário falham | Relatório sinaliza cenário como `BLOCKED` |

---

## Proposta de Pipeline de Desenvolvimento

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│   DEV    │──►│  GENIE   │──►│ QA AUTO  │──►│ REVIEW   │──►│  DEPLOY  │
│          │   │ /wish    │   │ (este    │   │ humano   │   │          │
│ Desenvolve│  │ /work    │   │  agente) │   │ do       │   │ Promoção │
│ feature  │   │ /review  │   │          │   │ relatório│   │ NX → CLI │
│ no NX    │   │          │   │ 30 testes│   │ de bugs  │   │ → PROD   │
│          │   │          │   │ automát. │   │          │   │          │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
                                    │
                                    ▼
                           Bug encontrado?
                           ┌──────────────┐
                           │ Relatório MD │
                           │ + WhatsApp   │
                           │ → dev volta  │
                           │ para DEV     │
                           └──────────────┘
```

**Ambientes:**

| Ambiente | Papel | QA roda? |
|---|---|---|
| **NX (N+2)** | Desenvolvimento interno | Sim — primeiro gate |
| **CLI (N+1)** | Staging / cliente | Sim — antes de promover |
| **PROD (N)** | Produção | Não — só código que passou NX e CLI |

**Etapas do pipeline:**

1. **DEV** — desenvolve a feature no ambiente NX usando Genie (`/wish`, `/work`, `/review`)
2. **Genie /review** — revisão automatizada do código antes de QA
3. **QA Auto** — este agente executa os 30 testes; se falhar, gera relatório e notifica dev via WhatsApp
4. **Review humano** — dev/lead revisa o relatório de bugs e aprova a promoção
5. **Deploy** — promoção NX → CLI → PROD

---

## Tipos TypeScript Principais

```typescript
interface TestCase {
  id: string;
  scenario: string;
  message: string;
  criterion: string;
}

interface TestResult {
  testCase: TestCase;
  response: string;
  pass: boolean;
  score: number;        // 0-10
  reason: string;
  fixSuggestion: string;
  status: 'pass' | 'fail' | 'timeout' | 'eval_error';
  durationMs: number;
}

interface ScenarioResult {
  name: string;
  results: TestResult[];
  passCount: number;
  failCount: number;
}
```
