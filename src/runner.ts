import { evaluate } from './evaluator';
import type { TestCase, TestResult, ScenarioResult } from './types';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const POLL_TIMEOUT_MS = 30_000;
const BETWEEN_TESTS_MS = 3_000;
const RECONNECT_ATTEMPTS = 3;
const RECONNECT_WAIT_MS = 10_000;

export interface MessagingClient {
  isConnected(): Promise<boolean>;
  sendAndPoll(text: string, timeoutMs?: number): Promise<string | null>;
  sendNotification(to: string, text: string): Promise<void>;
}

async function ensureConnected(client: MessagingClient): Promise<void> {
  for (let attempt = 1; attempt <= RECONNECT_ATTEMPTS; attempt++) {
    if (await client.isConnected()) return;
    console.warn(`\n⚠️  Cliente desconectado. Aguardando reconexão (${attempt}/${RECONNECT_ATTEMPTS})...`);
    await sleep(RECONNECT_WAIT_MS);
  }
  throw new Error('Cliente não reconectou após 3 tentativas. Abortando.');
}

async function runTest(client: MessagingClient, testCase: TestCase): Promise<TestResult> {
  const start = Date.now();

  try {
    const response = await client.sendAndPoll(testCase.message, POLL_TIMEOUT_MS);

    if (response === null) {
      return {
        testCase,
        response: '',
        pass: false,
        score: 0,
        reason: 'Sem resposta no prazo de 30s',
        fixSuggestion: 'Verificar se Eugênia está ativa e respondendo no número configurado.',
        status: 'timeout',
        durationMs: Date.now() - start,
      };
    }

    const evalResult = await evaluate(testCase, response);

    return {
      testCase,
      response,
      pass: evalResult.pass,
      score: evalResult.score,
      reason: evalResult.reason,
      fixSuggestion: evalResult.fixSuggestion,
      status: evalResult.pass ? 'pass' : 'fail',
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      testCase,
      response: '',
      pass: false,
      score: 0,
      reason: `Erro na execução: ${err instanceof Error ? err.message : String(err)}`,
      fixSuggestion: '',
      status: 'eval_error',
      durationMs: Date.now() - start,
    };
  }
}

export async function runScenario(
  client: MessagingClient,
  name: string,
  testCases: TestCase[],
): Promise<ScenarioResult> {
  const results: TestResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    await ensureConnected(client);

    console.log(`  → [${testCase.id}] "${testCase.message}"`);
    const result = await runTest(client, testCase);
    results.push(result);

    const icon = result.status === 'pass' ? '✅' : result.status === 'timeout' ? '⏱️' : '❌';
    console.log(`     ${icon} ${result.status.toUpperCase()} (score: ${result.score}/10) — ${result.reason}`);

    if (i < testCases.length - 1) {
      await sleep(BETWEEN_TESTS_MS);
    }
  }

  const passCount = results.filter(r => r.status === 'pass').length;
  return { name, results, passCount, failCount: results.length - passCount };
}
