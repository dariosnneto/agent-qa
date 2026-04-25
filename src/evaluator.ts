import Anthropic from '@anthropic-ai/sdk';
import type { TestCase } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
});

const SYSTEM_PROMPT = `Você é um avaliador de QA para um chatbot de vendas do WhatsApp chamado Eugênia, da App Vida (planos de saúde).

Dado uma mensagem enviada por um usuário simulado, a resposta recebida de Eugênia e o critério de avaliação, determine se a resposta atende ao critério.

Responda APENAS com um JSON válido, sem markdown, sem texto adicional:
{
  "pass": boolean,
  "score": número inteiro de 0 a 10,
  "reason": "explicação em português de por que passou ou falhou",
  "fix_suggestion": "sugestão de correção em português (string vazia se passou)"
}`;

export interface EvalResult {
  pass: boolean;
  score: number;
  reason: string;
  fixSuggestion: string;
}

export async function evaluate(testCase: TestCase, response: string): Promise<EvalResult> {
  if (!response.trim()) {
    return {
      pass: false,
      score: 0,
      reason: 'Resposta vazia recebida',
      fixSuggestion: 'Verificar se Eugênia está enviando mensagens de texto (não apenas mídia).',
    };
  }

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ] as Anthropic.Messages.TextBlockParam[],
      messages: [
        {
          role: 'user',
          content: `Mensagem enviada: "${testCase.message}"\nResposta recebida: "${response}"\nCritério: "${testCase.criterion}"`,
        },
      ],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}';
    const parsed = JSON.parse(raw) as {
      pass: boolean;
      score: number;
      reason: string;
      fix_suggestion: string;
    };

    return {
      pass: Boolean(parsed.pass),
      score: Number(parsed.score),
      reason: parsed.reason ?? '',
      fixSuggestion: parsed.fix_suggestion ?? '',
    };
  } catch (err) {
    return {
      pass: false,
      score: 0,
      reason: `Erro na avaliação: ${err instanceof Error ? err.message : String(err)}`,
      fixSuggestion: '',
    };
  }
}
