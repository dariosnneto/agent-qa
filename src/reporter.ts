import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { ScenarioResult, TestResult } from './types';
import type { MessagingClient } from './runner';
import type { GitHubClient } from './github-client';

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
  client: MessagingClient | null,
  devPhone: string,
  github?: GitHubClient,
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

  if (github) {
    const bugs = scenarioResults.flatMap(sc =>
      sc.results.filter(r => r.status !== 'pass' && r.fixSuggestion),
    );
    let issueCount = 0;
    for (const bug of bugs) {
      try {
        const url = await github.createBugIssue(
          bug.testCase.id,
          bug.testCase.message,
          bug.reason,
          bug.response,
          bug.fixSuggestion,
        );
        console.log(`🐛 Issue criada: ${url}`);
        issueCount++;
      } catch (err) {
        console.warn(`⚠️  GitHub [${bug.testCase.id}]: ${err instanceof Error ? err.message : err}`);
      }
    }
    if (issueCount > 0) {
      console.log(`🐛 ${issueCount} issue${issueCount !== 1 ? 's' : ''} criada${issueCount !== 1 ? 's' : ''} no GitHub`);
    }
  }

  if (client && devPhone) {
    const summary = buildWhatsAppSummary(scenarioResults, displayPath);
    await client.sendNotification(devPhone, summary);
    console.log(`📱 Notificação enviada para ${devPhone}`);
  }

  return filePath;
}
