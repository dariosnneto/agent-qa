# AgentQA — Automated WhatsApp Chatbot Testing

An automated QA agent that tests **Eugênia**, a WhatsApp sales chatbot for [App Vida](https://appvida.com.br) (health insurance plans). It sends predefined messages, evaluates responses using Claude, generates Markdown reports, and creates GitHub Issues for failures — automatically.

---

## How It Works

```
AgentQA (this project)
    │
    │  sends message
    ▼
Eugênia Webhook Server (src/eugenia-webhook.ts, port 3001)
    │
    │  calls Claude Haiku → generates reply
    ▼
AgentQA evaluator (src/evaluator.ts)
    │
    │  calls Claude Haiku → scores reply against criterion
    ▼
Reporter → Markdown report + GitHub Issues
```

AgentQA operates in two modes:

| Mode | When | How |
|------|------|-----|
| **Webhook** (default) | `EUGENIA_WEBHOOK_URL` is set | Calls Eugênia's HTTP server directly — no WhatsApp required |
| **WhatsApp** | `EUGENIA_WEBHOOK_URL` is not set | Sends real messages via Omni API to Eugênia's WhatsApp number |

---

## Test Scenarios

30 test cases across 3 scenarios, all in Portuguese (the chatbot's language):

| Scenario | Cases | What is tested |
|---|---|---|
| Onboarding & Presentation | 10 | Self-introduction, product overview, invalid inputs, language switching, farewell |
| PF Quotation (Individual/Family) | 10 | Data collection flow, coverage questions, invalid age, payment methods, discounts |
| PJ Quotation (Corporate) | 10 | Company flow, employee count, dependent coverage, large accounts (500+), reimbursement |

Each test case has a **message** and a **criterion**. Claude Haiku acts as the evaluator: it reads both and returns a pass/fail, a score (0–10), a reason, and a fix suggestion.

---

## Project Structure

```
AgentQA/
├── src/
│   ├── index.ts              # entrypoint — builds client, runs scenarios, calls reporter
│   ├── types.ts              # domain types (TestCase, TestResult, ScenarioResult)
│   ├── runner.ts             # scenario execution loop + MessagingClient interface
│   ├── evaluator.ts          # LLM-based response evaluation (Claude Haiku)
│   ├── reporter.ts           # Markdown report generation + GitHub Issues
│   ├── github-client.ts      # GitHub REST API client
│   ├── webhook-client.ts     # MessagingClient impl — calls Eugênia webhook directly
│   ├── omni-client.ts        # MessagingClient impl — sends via Omni/WhatsApp
│   ├── setup.ts              # Omni instance setup (WhatsApp mode only)
│   ├── eugenia-webhook.ts    # Eugênia AI server (Claude Haiku, port 3001)
│   └── scenarios/
│       ├── 01-onboarding.ts
│       ├── 02-cotacao-pf.ts
│       ├── 03-cotacao-pj.ts
│       └── index.ts
├── scripts/
│   ├── start-eugenia.sh      # start Eugênia webhook server via WSL/Bun
│   ├── start-omni.sh         # start Omni API via WSL/Bun
│   ├── run-qa.sh             # shortcut: bun run src/index.ts
│   ├── test-webhook.sh       # manual webhook smoke test
│   └── test-payload.json     # sample payload for manual testing
├── docs/                     # architecture and setup guides
├── reports/                  # generated Markdown reports (gitignored)
├── .env.example
├── docker-compose-omni.yml
└── package.json
```

---

## Prerequisites

- [Bun](https://bun.sh) >= 1.1
- An [Anthropic API key](https://console.anthropic.com)
- Docker (for Omni infrastructure, WhatsApp mode only)
- A GitHub Personal Access Token with `repo` scope (optional, for auto-creating issues)

---

## Quick Start — Webhook Mode (recommended)

This mode requires no WhatsApp connection. Eugênia runs as a local HTTP server.

**1. Clone and install**

```bash
git clone https://github.com/dariosnneto/agent-qa
cd agent-qa
bun install
```

**2. Configure environment**

```bash
cp .env.example .env
```

Edit `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...

# Webhook mode — no WhatsApp needed
EUGENIA_WEBHOOK_URL=http://localhost:3001

# Optional: auto-create GitHub Issues for failures
GITHUB_TOKEN=ghp_...
GITHUB_REPO=owner/repo
```

**3. Start Eugênia webhook server**

```bash
bun src/eugenia-webhook.ts
```

Or via WSL (if running on Windows):

```bash
bash scripts/start-eugenia.sh
```

**4. Run the tests**

```bash
bun run src/index.ts
```

---

## WhatsApp Mode

Use this mode to test against a real WhatsApp number.

**1. Start Omni infrastructure**

```bash
docker compose -f docker-compose-omni.yml up -d
bash scripts/start-omni.sh
```

**2. Configure environment**

```env
ANTHROPIC_API_KEY=sk-ant-...
OMNI_API_URL=http://localhost:8882
OMNI_API_KEY=omni_sk_...
EUGENIA_PHONE=5551999999999   # Eugênia's number (no +)
DEV_PHONE=5511999999999       # your number for notifications (no +)
```

Do **not** set `EUGENIA_WEBHOOK_URL` — its absence triggers WhatsApp mode.

**3. Scan QR code**

On first run, AgentQA will prompt you to scan a QR code with the QA agent's WhatsApp number. After scanning, the `OMNI_INSTANCE_ID` is persisted for future runs.

**4. Run the tests**

```bash
bun run src/index.ts
```

---

## Output

**Console** — live results per test:

```
📋 Scenario 1 — Onboarding & Presentation
  → [01-01] "Oi"
     ✅ PASS (score: 10/10) — Eugênia introduces herself and mentions App Vida.
  → [01-04] "asdfghjkl"
     ❌ FAIL (score: 2/10) — Invalid input not handled; bot responded as if it were a valid question.
```

**Markdown report** — saved to `reports/YYYY-MM-DD-HH-MM-SS.md`:

- Summary table with pass/fail per scenario
- Per-test scores, reasons, and fix suggestions
- Bug section with full response text and correction suggestions

**GitHub Issues** — one issue per failed test (if `GITHUB_TOKEN` is set), labelled `bug`.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Always | API key for Claude (evaluator + Eugênia) |
| `EUGENIA_WEBHOOK_URL` | Webhook mode | URL of Eugênia's webhook server |
| `OMNI_API_URL` | WhatsApp mode | Omni API base URL (default: `http://localhost:8882`) |
| `OMNI_API_KEY` | WhatsApp mode | Omni API key |
| `OMNI_INSTANCE_ID` | WhatsApp mode | Cached instance ID (auto-set after first run) |
| `EUGENIA_PHONE` | WhatsApp mode | Eugênia's WhatsApp number without `+` |
| `DEV_PHONE` | WhatsApp mode | Developer's number for test summary notification |
| `GITHUB_TOKEN` | Optional | PAT with `repo` scope for auto-creating issues |
| `GITHUB_REPO` | Optional | Target repo in `owner/repo` format |

---

## Architecture — Dependency Inversion

Both `OmniClient` and `WebhookClient` implement the `MessagingClient` interface defined in `runner.ts`. The runner, reporter, and entrypoint depend only on this interface — never on the concrete implementations.

```
runner.ts / reporter.ts / index.ts
        │
        │ depends on
        ▼
  MessagingClient (interface)
      ▲           ▲
      │           │
OmniClient   WebhookClient
(WhatsApp)   (HTTP direct)
```

Switching modes requires only a `.env` change — no code changes.

---

## Tech Stack

| Tool | Role |
|---|---|
| [Bun](https://bun.sh) | Runtime + package manager |
| [TypeScript](https://typescriptlang.org) | Language (strict mode) |
| [Claude Haiku](https://anthropic.com) | Evaluator + Eugênia's brain |
| [Omni](https://github.com/automagik-dev/omni) | WhatsApp channel management (optional) |
| [GitHub Issues](https://docs.github.com/en/rest/issues) | Automatic bug tracking — one issue per failed test, labelled `bug` |

---

## License

MIT
