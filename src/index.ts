import { WebhookClient } from './webhook-client';
import { runScenario } from './runner';
import type { MessagingClient } from './runner';
import { generateReport } from './reporter';
import { GitHubClient } from './github-client';
import { onboardingScenario, cotacaoPFScenario, cotacaoPJScenario } from './scenarios';
import type { ScenarioResult } from './types';

const {
  OMNI_API_URL = 'http://localhost:8882',
  OMNI_API_KEY,
  OMNI_INSTANCE_ID,
  EUGENIA_PHONE,
  EUGENIA_WEBHOOK_URL,
  DEV_PHONE,
  ANTHROPIC_API_KEY,
  GITHUB_TOKEN,
  GITHUB_REPO,
} = process.env;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY é obrigatório no .env');
  process.exit(1);
}

if (!EUGENIA_WEBHOOK_URL && (!OMNI_API_KEY || !EUGENIA_PHONE || !DEV_PHONE)) {
  console.error('❌ Sem EUGENIA_WEBHOOK_URL: OMNI_API_KEY, EUGENIA_PHONE e DEV_PHONE são obrigatórios no .env');
  process.exit(1);
}

const SCENARIOS = [
  { name: 'Cenário 1 — Onboarding e Apresentação', cases: onboardingScenario },
  { name: 'Cenário 2 — Cotação PF (Individual e Familiar)', cases: cotacaoPFScenario },
  { name: 'Cenário 3 — Cotação PJ (Pessoa Jurídica)', cases: cotacaoPJScenario },
];

async function buildClient(): Promise<MessagingClient> {
  if (EUGENIA_WEBHOOK_URL) {
    console.log(`📡 Modo webhook direto: ${EUGENIA_WEBHOOK_URL}\n`);
    return new WebhookClient(EUGENIA_WEBHOOK_URL);
  }

  const { setupInstance } = await import('./setup');
  const { OmniClient } = await import('./omni-client');
  const instanceId = await setupInstance(OMNI_API_URL, OMNI_API_KEY!, OMNI_INSTANCE_ID);
  return new OmniClient(OMNI_API_URL, OMNI_API_KEY!, instanceId, EUGENIA_PHONE!);
}

async function main() {
  console.log('🤖 QA Eugênia iniciando...\n');

  const client = await buildClient();
  const scenarioResults: ScenarioResult[] = [];

  for (const { name, cases } of SCENARIOS) {
    console.log(`\n📋 ${name}`);
    const result = await runScenario(client, name, cases);
    scenarioResults.push(result);
    console.log(`   Resultado: ${result.passCount}/${result.results.length} passou`);
  }

  const total = scenarioResults.reduce((s, sc) => s + sc.results.length, 0);
  const passed = scenarioResults.reduce((s, sc) => s + sc.passCount, 0);
  console.log(`\n📊 Total: ${passed}/${total} passou`);

  const github = GITHUB_TOKEN && GITHUB_REPO
    ? new GitHubClient({ token: GITHUB_TOKEN, repo: GITHUB_REPO })
    : undefined;

  await generateReport(scenarioResults, client, DEV_PHONE ?? '', github);
  console.log('\n✅ QA concluído!');
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
