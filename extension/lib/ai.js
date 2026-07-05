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

function buildPrompt(rawText, { tone, dictionaryTerms, translateTo, customPrompt }) {
  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.natural;
  const lines = [
    'Você é um assistente de ditado por voz. O texto abaixo foi transcrito automaticamente da fala de uma pessoa e precisa ser limpo e formatado.',
    '',
    'Regras:',
    '- Remova muletas de fala e hesitações ("ééé", "hum", "tipo", "né", "então" em excesso, palavras repetidas).',
    '- Corrija pontuação, capitalização e concordância óbvia da transcrição.',
    '- Preserve quebras de linha e parágrafos que já existirem no texto.',
    '- Preserve fielmente o significado e as informações. NÃO adicione conteúdo novo, NÃO resuma, NÃO responda ao texto.',
    `- ${toneInstruction}`,
  ];

  if (dictionaryTerms?.length) {
    lines.push(
      `- Estes nomes e termos podem aparecer com grafia errada na transcrição; use sempre a grafia correta: ${dictionaryTerms.join(', ')}.`
    );
  }

  if (translateTo) {
    lines.push(
      `- Depois de limpar o texto, TRADUZA o resultado final para ${translateTo}. Responda apenas na língua de destino.`
    );
  } else {
    lines.push('- Preserve o idioma original do texto.');
  }

  if (customPrompt?.trim()) {
    lines.push(`- Instrução adicional do usuário: ${customPrompt.trim()}`);
  }

  lines.push(
    '- Responda APENAS com o texto final, sem comentários, sem aspas, sem preâmbulo.',
    '',
    'Texto transcrito:',
    '"""',
    rawText,
    '"""'
  );
  return lines.join('\n');
}

async function callAnthropic(prompt, apiKey) {
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
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw await apiError(response);
  const data = await response.json();
  const text = data.content?.map((block) => block.text || '').join('').trim();
  if (!text) throw new Error('Resposta vazia da IA.');
  return text;
}

async function callOpenAI(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw await apiError(response);
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
 * Formata (e opcionalmente traduz) o texto ditado.
 * Lança Error com mensagem amigável em caso de falha.
 */
export async function formatText({
  rawText,
  tone,
  provider,
  apiKey,
  dictionaryTerms = [],
  translateTo = '',
  customPrompt = '',
}) {
  if (!apiKey) throw new Error('Nenhuma chave de API configurada.');
  const prompt = buildPrompt(rawText, { tone, dictionaryTerms, translateTo, customPrompt });
  if (provider === 'openai') return callOpenAI(prompt, apiKey);
  return callAnthropic(prompt, apiKey);
}
