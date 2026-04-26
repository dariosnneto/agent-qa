import type { MessagingClient } from './runner';

interface WebhookPayload {
  event: { id: string; type: string; timestamp: string };
  instance: { id: string; channelType: string };
  chat: { id: string };
  sender: { id: string; name?: string };
  content: { text?: string };
  contextMessages?: string[];
  traceId: string;
}

interface WebhookResponse {
  reply?: string;
}

export class WebhookClient implements MessagingClient {
  private readonly webhookUrl: string;
  private readonly history: string[] = [];

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async isConnected(): Promise<boolean> {
    try {
      const res = await fetch(this.webhookUrl, { method: 'GET', signal: AbortSignal.timeout(5_000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async sendAndPoll(text: string, timeoutMs = 30_000): Promise<string | null> {
    const payload: WebhookPayload = {
      event: { id: crypto.randomUUID(), type: 'message', timestamp: new Date().toISOString() },
      instance: { id: 'qa-test', channelType: 'whatsapp' },
      chat: { id: 'qa-chat' },
      sender: { id: '5534988419291', name: 'QA Tester' },
      content: { text },
      contextMessages: this.history.slice(-20),
      traceId: crypto.randomUUID(),
    };

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as WebhookResponse;
      const reply = data.reply?.trim() || null;

      if (reply) {
        this.history.push(`[QA Tester] ${text}`);
        this.history.push(`[Eugênia] ${reply}`);
      }

      return reply;
    } catch {
      return null;
    }
  }

  async sendNotification(to: string, text: string): Promise<void> {
    console.log(`[notificação] ${to}: ${text}`);
  }
}
