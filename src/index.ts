import { setupInstance } from './setup';
import { OmniClient } from './omni-client';
import { runScenario } from './runner';
import { generateReport } from './reporter';
import { onboardingScenario, cotacaoPFScenario, cotacaoPJScenario } from './scenarios';
import type { ScenarioResult } from './types';

const {
  OMNI_API_URL = 'http://localhost:8882',
  OMNI_API_KEY,
  OMNI_INSTANCE_ID,
  EUGENIA_PHONE,
  DEV_PHONE,
  ANTHROPIC_API_KEY,
} = process.env;

if (!OMNI_API_KEY || !EUGENIA_PHONE || !DEV_PHONE || !ANTHROPIC_API_KEY) {
  console.error('❌ OMNI_API_KEY, EUGENIA_PHONE, DEV_PHONE e ANTHROPIC_API_KEY são obrigatórios no .env');
  process.exit(1);
}

const SCENARIOS = [
  { name: 'Cenário 1 — Onboarding e Apresentação', cases: onboardingScenario },
  { name: 'Cenário 2 — Cotação PF (Individual e Familiar)', cases: cotacaoPFScenario },
  { name: 'Cenário 3 — Cotação PJ (Pessoa Jurídica)', cases: cotacaoPJScenario },
];

async function main() {
  console.log('🤖 QA Eugênia iniciando...\n');

  const instanceId = await setupInstance(OMNI_API_URL, OMNI_API_KEY!, OMNI_INSTANCE_ID);
  const omni = new OmniClient(OMNI_API_URL, OMNI_API_KEY!, instanceId, EUGENIA_PHONE!);

  const scenarioResults: ScenarioResult[] = [];

  for (const { name, cases } of SCENARIOS) {
    console.log(`\n📋 ${name}`);
    const result = await runScenario(omni, name, cases);
    scenarioResults.push(result);

    const total = result.results.length;
    console.log(`   Resultado: ${result.passCount}/${total} passou`);
  }

  const total = scenarioResults.reduce((s, sc) => s + sc.results.length, 0);
  const passed = scenarioResults.reduce((s, sc) => s + sc.passCount, 0);
  console.log(`\n📊 Total: ${passed}/${total} passou`);

  await generateReport(scenarioResults, omni, DEV_PHONE!);
  console.log('\n✅ QA concluído!');
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
