export interface TrelloConfig {
  apiKey: string;
  token: string;
  boardId: string;
  listName: string;
}

export class TrelloClient {
  private readonly base = 'https://api.trello.com/1';
  private listId: string | null = null;

  constructor(private readonly config: TrelloConfig) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = new URL(`${this.base}${path}`);
    url.searchParams.set('key', this.config.apiKey);
    url.searchParams.set('token', this.config.token);
    const res = await fetch(url.toString(), options);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Trello API ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  private async getListId(): Promise<string> {
    if (this.listId) return this.listId;
    const lists = await this.request<Array<{ id: string; name: string }>>(
      `/boards/${this.config.boardId}/lists`,
    );
    const list = lists.find(l => l.name === this.config.listName);
    if (!list) {
      const names = lists.map(l => l.name).join(', ');
      throw new Error(`Lista "${this.config.listName}" não encontrada. Listas disponíveis: ${names}`);
    }
    this.listId = list.id;
    return this.listId;
  }

  async createBugCard(
    testId: string,
    message: string,
    reason: string,
    response: string,
    fixSuggestion: string,
  ): Promise<string> {
    const listId = await this.getListId();

    const name = `[QA] [${testId}] ${reason.slice(0, 60)}`;
    const desc = [
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

    const card = await this.request<{ shortUrl: string }>('/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idList: listId, name, desc }),
    });

    return card.shortUrl;
  }
}
