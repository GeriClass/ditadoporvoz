// Formatação do texto ditado via API de IA (Anthropic ou OpenAI),
// chamada diretamente do navegador com a chave do usuário.

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const OPENAI_MODEL = 'gpt-4o-mini';

const TONE_INSTRUCTIONS = {
  natural: 'Mantenha o tom natural e coloquial de quem falou, apenas limpo e bem pontuado.',
  email: 'Formate como um e-mail profissional: tom cordial e claro, parágrafos curtos. Não invente assunto nem assinatura que não foram ditados.',
  mensagem: 'Formate como uma mensagem informal de chat (WhatsApp/Slack): curta, direta e amigável.',
  anotacoes: 'Formate como anotações: frases curtas e, quando fizer sentido, listas com marcadores.',
};

function buildPrompt(rawText, tone) {
  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.natural;
  return `Você é um assistente de ditado por voz. O texto abaixo foi transcrito automaticamente da fala de uma pessoa e precisa ser limpo e formatado.

Regras:
- Remova muletas de fala e hesitações ("ééé", "hum", "tipo", "né", "então" em excesso, palavras repetidas).
- Corrija pontuação, capitalização e concordância óbvia da transcrição.
- Preserve fielmente o significado, as informações e o idioma original. NÃO adicione conteúdo novo, NÃO resuma, NÃO responda ao texto.
- ${toneInstruction}
- Responda APENAS com o texto final, sem comentários, sem aspas, sem preâmbulo.

Texto transcrito:
"""
${rawText}
"""`;
}

async function formatWithAnthropic(rawText, tone, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildPrompt(rawText, tone) }],
    }),
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  const data = await response.json();
  const text = data.content?.map((block) => block.text || '').join('').trim();
  if (!text) throw new Error('Resposta vazia da IA.');
  return text;
}

async function formatWithOpenAI(rawText, tone, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildPrompt(rawText, tone) }],
    }),
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Resposta vazia da IA.');
  return text;
}

async function apiError(response) {
  let detail = '';
  try {
    const body = await response.json();
    detail = body.error?.message || '';
  } catch {
    // corpo não-JSON; segue com a mensagem por status
  }

  if (response.status === 401 || response.status === 403) {
    return new Error('Chave de API inválida ou sem permissão. Verifique nas configurações.');
  }
  if (response.status === 429) {
    return new Error('Limite de uso da API atingido. Tente novamente em instantes.');
  }
  return new Error(detail || `Erro da API (${response.status}).`);
}

/**
 * Formata o texto bruto ditado. Lança Error com mensagem amigável em caso de falha.
 */
export async function formatText({ rawText, tone, provider, apiKey }) {
  if (!apiKey) throw new Error('Nenhuma chave de API configurada.');
  if (provider === 'openai') {
    return formatWithOpenAI(rawText, tone, apiKey);
  }
  return formatWithAnthropic(rawText, tone, apiKey);
}
