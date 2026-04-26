# Como Funciona o Omni

## O que é

O **Omni** é uma plataforma omnichannel orientada a eventos para atendimento via múltiplos canais (WhatsApp, Telegram, Slack, Discord, etc). Expõe uma API HTTP unificada para enviar/receber mensagens, gerenciar instâncias de canal e integrar agentes AI.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Bun |
| HTTP Framework | Hono + tRPC |
| Banco de dados | PostgreSQL (Drizzle ORM) |
| Event Bus | NATS JetStream |
| Validação | Zod |
| Monorepo | Turborepo |

---

## Estrutura do monorepo

```
omni/
├── packages/
│   ├── api/            — API HTTP (Hono, porta 8882)
│   ├── core/           — Schemas, eventos, identidade (compartilhado)
│   ├── db/             — Schema Drizzle + migrations
│   ├── sdk/            — SDK TypeScript gerado (usado pelo QA agent)
│   ├── channel-sdk/    — Interface de plugin para canais
│   ├── channel-whatsapp/   — WhatsApp via Baileys
│   ├── channel-telegram/   — Telegram
│   ├── channel-slack/      — Slack
│   ├── channel-discord/    — Discord
│   ├── channel-gupshup/    — Gupshup (WhatsApp Business API)
│   ├── channel-a2a/        — Agent-to-Agent protocol
│   └── channel-internal/   — Roteamento interno entre agentes
└── apps/
    └── ui/             — Dashboard React (Vite, porta 5173)
```

---

## Rodando no WSL

### 1. Subir infraestrutura (Docker)

```bash
# PostgreSQL na porta 5433 + NATS na porta 4223
wsl -d Ubuntu bash -c "cd /mnt/c/AgentQA && docker compose -f docker-compose-omni.yml up -d"

# Verificar
wsl -d Ubuntu bash -c "docker compose -f docker-compose-omni.yml ps"
```

### 2. Instalar dependências (primeira vez)

```bash
wsl -d Ubuntu /home/user/.bun/bin/bun install --cwd /mnt/c/AgentQA/omni
```

### 3. Inicializar banco (primeira vez)

```bash
wsl -d Ubuntu bash -c "cd /mnt/c/AgentQA/omni && set -a && . ./.env && set +a && cd packages/db && /home/user/.bun/bin/bun x drizzle-kit push --force"
```

> A API roda migrations automaticamente no boot. O `drizzle-kit push` é apenas para setup inicial local.

### 4. Iniciar a API

```bash
wsl -d Ubuntu bash -c "cd /mnt/c/AgentQA/omni && /home/user/.bun/bin/bun packages/api/src/index.ts"
```

A API sobe na porta **8882** com:
- `http://localhost:8882/api/v2/docs` — Swagger UI
- `http://localhost:8882/api/v2/health` — Health check
- `http://localhost:8882/api/v2/metrics` — Métricas

### 5. Parar

```bash
wsl -d Ubuntu bash -c "cd /mnt/c/AgentQA && docker compose -f docker-compose-omni.yml down"
```

---

## Configuração (`.env`)

```env
DATABASE_URL=postgresql://omni:omni_password_change_me@localhost:5433/omni
PGSERVE_EMBEDDED=false

NATS_URL=nats://localhost:4223
NATS_MANAGED=false

NODE_ENV=development
LOG_LEVEL=info

API_PORT=8882
API_HOST=0.0.0.0
API_MANAGED=false
```

---

## API Key

A API key é gerada no primeiro boot e exibida no terminal:
```
API Key: omni_sk_xxxxxxxxxxxxxxxx
```

Guarde em `C:\AgentQA\.env` como `OMNI_API_KEY=omni_sk_...`.

Para listar keys existentes:
```bash
curl -H "Authorization: Bearer omni_sk_..." http://localhost:8882/api/v2/auth/validate
```

---

## Instâncias WhatsApp

### Listar instâncias
```bash
curl -H "Authorization: Bearer $OMNI_API_KEY" http://localhost:8882/api/v2/instances
```

### Status de conexão
```bash
curl -H "Authorization: Bearer $OMNI_API_KEY" \
  http://localhost:8882/api/v2/instances/<id>/status
```

### Escanear QR code
Acesse `http://localhost:8882` no browser — a UI mostra o QR para conectar o WhatsApp.

---

## SDK TypeScript (`@omni/sdk`)

O SDK é usado pelo QA Agent para interagir com a API:

```typescript
import { createOmniClient } from '@omni/sdk';

const omni = createOmniClient({
  baseUrl: 'http://localhost:8882',
  apiKey: 'omni_sk_...',
});

// Listar instâncias
const { items } = await omni.instances.list();

// Enviar mensagem
await omni.messages.send({
  instanceId: '<uuid>',
  to: '5551998882486',
  text: 'Olá!',
});

// Listar chats
const { items: chats } = await omni.chats.list({
  instanceId: '<uuid>',
  limit: 50,
});
```

O SDK resolve automaticamente o prefixo `/api/v2` — passe apenas `http://localhost:8882` como `baseUrl`.

> **Atenção CRLF:** Não use `set -a && . ./.env` em bash para carregar variáveis com a API key. O arquivo `.env` tem CRLF (Windows) e o `\r` no final dos valores causa falhas silenciosas (ex: `OMNI_INSTANCE_ID` com `\r` resulta em 404). Use o bun diretamente — ele carrega `.env` nativamente e trata CRLF corretamente.

---

## Canais suportados

| Canal | Plugin | Descrição |
|---|---|---|
| WhatsApp | `channel-whatsapp` | Via Baileys (QR code) |
| WhatsApp Business | `channel-gupshup` | Via Gupshup API |
| Telegram | `channel-telegram` | Via Bot API |
| Slack | `channel-slack` | Via Bolt |
| Discord | `channel-discord` | Via discord.js |
| Agent-to-Agent | `channel-a2a` | Protocolo A2A para AI agents |
| Internal | `channel-internal` | Roteamento interno |

---

## Fluxo de mensagem

```
WhatsApp (Baileys)
  → channel-whatsapp plugin
    → NATS: message.received
      → api/src/routes/messages.ts
        → PostgreSQL (chats, messages)
          → agente AI (se configurado na instância)
            → NATS: message.send
              → channel-whatsapp plugin
                → WhatsApp
```
