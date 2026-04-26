export interface GitHubConfig {
  token: string;
  repo: string; // "owner/repo"
}

export class GitHubClient {
  private readonly base = 'https://api.github.com';

  constructor(private readonly config: GitHubConfig) {}

  async createBugIssue(
    testId: string,
    message: string,
    reason: string,
    response: string,
    fixSuggestion: string,
  ): Promise<string> {
    const title = `[QA] [${testId}] ${reason.slice(0, 80)}`;
    const body = [
      '## Bug encontrado pelo QA Eugênia',
      '',
      `**Teste:** \`${testId}\` — mensagem enviada: \`${message}\``,
      '',
      '**Resposta recebida:**',
      response || '_(sem resposta — timeout)_',
      '',
      '**Problema identificado:**',
      reason,
      '',
      '**Sugestão de correção:**',
      fixSuggestion,
    ].join('\n');

    const res = await fetch(`${this.base}/repos/${this.config.repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title, body, labels: ['bug'] }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${res.status}: ${text}`);
    }

    const issue = (await res.json()) as { html_url: string };
    return issue.html_url;
  }
}
