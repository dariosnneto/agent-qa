import { createOmniClient } from '@omni/sdk';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class OmniClient {
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

  /**
   * Sends a message to Eugênia and waits for her reply.
   * On the first call, lazily resolves the chat ID from the instance's chat list.
   * Returns the full reply text (joining multi-message responses), or null on timeout.
   */
  async sendAndPoll(text: string, timeoutMs = 30_000): Promise<string | null> {
    const sentAt = new Date().toISOString();

    await this.omni.messages.send({
      instanceId: this.instanceId,
      to: this.eugeniaPhone,
      text,
    });

    if (!this.eugeniaChatId) {
      this.eugeniaChatId = await this.findChatId(10_000);
    }

    return this.pollResponse(this.eugeniaChatId, sentAt, timeoutMs);
  }

  /**
   * Sends a message to an arbitrary number (used for dev notifications).
   */
  async sendNotification(to: string, text: string): Promise<void> {
    await this.omni.messages.send({ instanceId: this.instanceId, to, text });
  }

  /**
   * Scans instance chats for one matching Eugênia's phone number.
   * Retries until timeout because the chat only appears after the first message is sent.
   * Throws if the chat cannot be found — callers should treat this as a setup error, not a timeout.
   */
  async findChatId(timeoutMs = 10_000): Promise<string> {
    const phone = this.eugeniaPhone.replace(/\D/g, '');
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const { items } = await this.omni.chats.list({
        instanceId: this.instanceId,
        limit: 50,
      });
      const chat = items.find(c => c.externalId.startsWith(phone));
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
        // Wait briefly to collect multi-part responses
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
