import { createOmniClient } from '@omni/sdk';
import type { MessagingClient } from './runner';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class OmniClient implements MessagingClient {
  private readonly omni: ReturnType<typeof createOmniClient>;
  private readonly instanceId: string;
  private readonly eugeniaPhone: string;
  private eugeniaChatId: string | null = null;

  constructor(baseUrl: string, apiKey: string, instanceId: string, eugeniaPhone: string) {
    this.omni = createOmniClient({ baseUrl, apiKey });
    this.instanceId = instanceId;
    this.eugeniaPhone = eugeniaPhone;
  }

  async isConnected(): Promise<boolean> {
    const status = await this.omni.instances.status(this.instanceId);
    return status.isConnected;
  }

  async sendAndPoll(text: string, timeoutMs = 30_000): Promise<string | null> {
    const sentAt = new Date().toISOString();

    await this.omni.messages.send({
      instanceId: this.instanceId,
      to: this.eugeniaPhone,
      text,
    });

    if (!this.eugeniaChatId) {
      this.eugeniaChatId = await this.findChatId(30_000);
    }

    return this.pollResponse(this.eugeniaChatId, sentAt, timeoutMs);
  }

  async sendNotification(to: string, text: string): Promise<void> {
    await this.omni.messages.send({ instanceId: this.instanceId, to, text });
  }

  async findChatId(timeoutMs = 30_000): Promise<string> {
    const phone = this.eugeniaPhone.replace(/\D/g, '');
    // Brazil mobile numbers may be stored without the leading 9 (old 8-digit format)
    const phoneAlt = phone.length === 13 ? phone.slice(0, 4) + phone.slice(5) : null;
    const deadline = Date.now() + timeoutMs;

    const matches = (id: string | null) => {
      if (!id) return false;
      const digits = id.replace(/\D/g, '');
      return digits.startsWith(phone) || (phoneAlt !== null && digits.startsWith(phoneAlt));
    };

    while (Date.now() < deadline) {
      const { items } = await this.omni.chats.list({
        instanceId: this.instanceId,
        limit: 50,
      });
      const chat = items.find(c => matches(c.externalId) || matches(c.canonicalId ?? null));
      if (chat) return chat.id;
      await sleep(1_000);
    }

    throw new Error(`Chat com ${this.eugeniaPhone} não encontrado após ${timeoutMs / 1000}s. Verifique EUGENIA_PHONE e a conexão WhatsApp.`);
  }

  private async pollResponse(chatId: string, after: string, timeoutMs: number): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const messages = await this.omni.chats.getMessages(chatId, { after, limit: 10 });
      const replies = messages.filter(m => !m.isFromMe && m.textContent);

      if (replies.length > 0) {
        await sleep(1_500);
        const more = await this.omni.chats.getMessages(chatId, { after, limit: 10 });
        return more
          .filter((m): m is typeof m & { textContent: string } => !m.isFromMe && typeof m.textContent === 'string' && m.textContent.length > 0)
          .map(m => m.textContent)
          .join('\n');
      }

      await sleep(2_000);
    }

    return null;
  }
}
