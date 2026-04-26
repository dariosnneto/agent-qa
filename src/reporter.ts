import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { ScenarioResult, TestResult } from './types';
import type { OmniClient } from './omni-client';
import type { TrelloClient } from './trello-client';

function statusIcon(status: TestResult['status']): string {
  switch (status) {
    case 'pass': return '✅';
    case 'timeout': return '⏱️';
    case 'eval_error': return '⚙️';
    default: return '❌';
  }
}

function buildMarkdown(scenarioResults: ScenarioResult[]): string {
  const now = new Date();
  const total = scenarioResults.reduce((s, sc) => s + sc.results.length, 0);
  const passed = scenarioResults.reduce((s, sc) => s + sc.passCount, 0);
  const failed = total - passed;

  let md = `# QA Eugênia — Relatório\n\n`;
  md += `**Data:** ${now.toISOString().replace('T', ' ').slice(0, 19)} UTC\n`;
  md += `**Resultado:** ${passed}/${total} passou | ${failed} falhou\n\n---\n\n`;

  for (const sc of scenarioResults) {
    const blocked = sc.passCount === 0 && sc.results.length > 0;
    md += `## ${sc.name}${blocked ? ' ⛔ BLOCKED' : ''}\n\n`;
    md += `**Passou:** ${sc.passCount}/${sc.results.length}\n\n`;
    md += `| ID | Mensagem | Status | Score | Motivo |\n`;
    md += `|---|---|---|---|---|\n`;

    for (const r of sc.results) {
      const icon = statusIcon(r.status);
      const msg = r.testCase.message.replace(/\|/g, '\\|');
      const reason = r.reason.replace(/\|/g, '\\|');
      md += `| ${r.testCase.id} | ${msg} | ${icon} ${r.status.toUpperCase()} | ${r.score}/10 | ${reason} |\n`;
    }

    const bugs = sc.results.filter(r => r.status !== 'pass' && r.fixSuggestion);
    if (bugs.length > 0) {
      md += `\n### Bugs e Sugestões de Correção\n\n`;
      for (const b of bugs) {
        md += `**[${b.testCase.id}]** \`${b.testCase.message}\`\n`;
        md += `- **Resposta recebida:** ${b.response || '_(sem resposta)_'}\n`;
        md += `- **Problema:** ${b.reason}\n`;
        md += `- **Sugestão:** ${b.fixSuggestion}\n\n`;
      }
    }

    md += '\n';
  }

  return md;
}

function buildWhatsAppSummary(scenarioResults: ScenarioResult[], filePath: string): string {
  const total = scenarioResults.reduce((s, sc) => s + sc.results.length, 0);
  const passed = scenarioResults.reduce((s, sc) => s + sc.passCount, 0);
  const failed = total - passed;

  const bugs = scenarioResults.flatMap(sc =>
    sc.results
      .filter(r => r.status !== 'pass')
      .map(r => `• [${r.testCase.id}] ${r.reason}`),
  );

  let msg = `🤖 *QA Eugênia finalizado*\n`;
  msg += `${passed}/${total} passou | ${failed} bug${failed !== 1 ? 's' : ''} encontrado${failed !== 1 ? 's' : ''}\n`;
  msg += `📄 Relatório: \`${filePath}\``;

  if (bugs.length > 0) {
    msg += `\n\n*Bugs:*\n${bugs.slice(0, 5).join('\n')}`;
    if (bugs.length > 5) msg += `\n_...e mais ${bugs.length - 5}_`;
  }

  return msg;
}

export async function generateReport(
  scenarioResults: ScenarioResult[],
  omni: OmniClient,
  devPhone: string,
  trello?: TrelloClient,
): Promise<string> {
  const reportsDir = resolve(process.cwd(), 'reports');
  mkdirSync(reportsDir, { recursive: true });

  const now = new Date();
  const ts = now.toISOString().slice(0, 19).replace('T', '-').replace(/:/g, '-');
  const fileName = `${ts}.md`;
  const filePath = resolve(reportsDir, fileName);
  const displayPath = `reports/${fileName}`;

  writeFileSync(filePath, buildMarkdown(scenarioResults), 'utf8');
  console.log(`\n📄 Relatório salvo: ${filePath}`);

  if (trello) {
    const bugs = scenarioResults.flatMap(sc =>
      sc.results.filter(r => r.status !== 'pass' && r.fixSuggestion),
    );
    let cardCount = 0;
    for (const bug of bugs) {
      try {
        const url = await trello.createBugCard(
          bug.testCase.id,
          bug.testCase.message,
          bug.reason,
          bug.response,
          bug.fixSuggestion,
        );
        console.log(`🃏 Card criado: ${url}`);
        cardCount++;
      } catch (err) {
        console.warn(`⚠️  Trello [${bug.testCase.id}]: ${err instanceof Error ? err.message : err}`);
      }
    }
    if (cardCount > 0) {
      console.log(`🃏 ${cardCount} card${cardCount !== 1 ? 's' : ''} criado${cardCount !== 1 ? 's' : ''} no Trello`);
    }
  }

  const summary = buildWhatsAppSummary(scenarioResults, displayPath);
  await omni.sendNotification(devPhone, summary);
  console.log(`📱 Notificação enviada para ${devPhone}`);

  return filePath;
}
