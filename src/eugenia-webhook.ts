/**
 * Eugênia Webhook Server
 *
 * Recebe triggers do Omni (round-trip webhook) e responde usando Claude.
 * O Omni envia o payload, aguarda a resposta e encaminha ao WhatsApp.
 *
 * Inicie com:
 *   bun eugenia-webhook.ts
 */

import Anthropic from '@anthropic-ai/sdk';

const PORT = 3001;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Você é Eugênia, assistente virtual da App Vida — uma empresa de planos de saúde.
Seu papel é atender clientes pelo WhatsApp, apresentar os produtos, tirar dúvidas e iniciar cotações.

Produtos:
- Planos individuais e familiares (PF): cobertura de consultas, exames e emergências
- Planos empresariais (PJ): para empresas de 2 a 499 funcionários; grandes contas (500+) são encaminhadas para equipe comercial
- App Vida inclui consultas online via app, sem carência para emergências

Diretrizes:
- Seja cordial, objetiva e use linguagem simples
- Se não souber algo, ofereça encaminhar para um atendente humano
- Para cotações, colete: tipo (PF/PJ), número de beneficiários e faixa etária
- Ao detectar pedido de atendente humano, informe que irá transferir e encerre educadamente
- Responda sempre em português, mesmo que o usuário escreva em outro idioma`;

interface WebhookPayload {
  event: { id: string; type: string; timestamp: string };
  instance: { id: string; channelType: string };
  chat: { id: string };
  sender: { id: string; name?: string; personId?: string };
  content: { text?: string; emoji?: string };
  contextMessages?: string[];
  traceId: string;
}

interface WebhookResponse {
  reply?: string;
  parts?: string[];
}

async function handleWebhook(payload: WebhookPayload): Promise<WebhookResponse> {
  const userMessage = payload.content.text?.trim();
  if (!userMessage) return { reply: '' };

  // Build conversation history from contextMessages
  const messages: Anthropic.MessageParam[] = [];

  if (payload.contextMessages && payload.contextMessages.length > 0) {
    // contextMessages are formatted as "[Name - time] message" alternating user/assistant
    // We reconstruct them as alternating turns
    for (let i = 0; i < payload.contextMessages.length - 1; i++) {
      const msg = payload.contextMessages[i] ?? '';
      const isFromSender = payload.sender.name ? msg.includes(payload.sender.name) : i % 2 === 0;
      messages.push({
        role: isFromSender ? 'user' : 'assistant',
        content: msg.replace(/^\[.*?\]\s*/, ''), // strip "[Name - time] " prefix
      });
    }
  }

  // Current message
  messages.push({ role: 'user', content: userMessage });

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  const reply = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return { reply };
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    if (req.method === 'HEAD' || req.method === 'GET') {
      return new Response('Eugênia webhook OK', { status: 200 });
    }

    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const payload = (await req.json()) as WebhookPayload;
      console.log(`[eugenia] ← ${payload.sender.name ?? payload.sender.id}: "${payload.content.text}"`);

      const result = await handleWebhook(payload);
      console.log(`[eugenia] → "${result.reply?.slice(0, 80)}..."`);

      return Response.json(result);
    } catch (err) {
      console.error('[eugenia] erro:', err);
      return Response.json({ reply: 'Desculpe, ocorreu um erro interno. Tente novamente em instantes.' });
    }
  },
});

console.log(`Eugênia webhook running at http://localhost:${server.port}`);
