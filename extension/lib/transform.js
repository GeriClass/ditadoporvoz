// Transformações locais do texto ditado (sem IA):
// comandos de voz de pontuação/estrutura, snippets e correções do dicionário.

// Comandos de voz falados → texto. Ordem importa: frases mais longas primeiro.
const VOICE_COMMANDS = [
  { spoken: ['novo parágrafo', 'nova linha em branco'], insert: '\n\n' },
  { spoken: ['nova linha', 'quebra de linha', 'pular linha'], insert: '\n' },
  { spoken: ['ponto e vírgula'], insert: ';' },
  { spoken: ['dois pontos'], insert: ':' },
  { spoken: ['ponto de interrogação', 'interrogação', 'ponto de pergunta'], insert: '?' },
  { spoken: ['ponto de exclamação', 'exclamação'], insert: '!' },
  { spoken: ['reticências'], insert: '…' },
  { spoken: ['ponto final', 'ponto'], insert: '.' },
  { spoken: ['vírgula'], insert: ',' },
  { spoken: ['travessão', 'traço'], insert: '—' },
  { spoken: ['abre parênteses', 'abrir parênteses'], insert: '(' },
  { spoken: ['fecha parênteses', 'fechar parênteses'], insert: ')' },
  { spoken: ['abre aspas', 'abrir aspas'], insert: '“' },
  { spoken: ['fecha aspas', 'fechar aspas'], insert: '”' },
];

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Junta espaços antes de pontuação e normaliza espaços/linhas em excesso.
function tidyPunctuation(text) {
  return text
    .replace(/[ \t]+([,.;:!?…)”])/g, '$1')
    .replace(/([(“])[ \t]+/g, '$1')
    // Garante um espaço após pontuação quando colada na próxima palavra
    // (evita "oi,tudo"), preservando decimais como "3,14".
    .replace(/([,;:!?…])(?=[^\s)\]"”\d])/g, '$1 ')
    .replace(/\.(?=[A-Za-zÀ-ÿ])/g, '. ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/** Aplica os comandos de voz de pontuação e estrutura ao texto. */
export function applyVoiceCommands(text) {
  let result = text;

  // "apagar tudo" — mantém apenas o que vier depois do último comando.
  const clearMatch = /(?:^|\s)(apagar tudo|apaga tudo|limpar tudo)(?:\s|$)/i;
  const lastClear = [...result.matchAll(new RegExp(clearMatch, 'gi'))].pop();
  if (lastClear) {
    result = result.slice(lastClear.index + lastClear[0].length);
  }

  // "apagar última frase" / "apagar última palavra".
  result = result.replace(
    /([^.!?\n]*[.!?]?\s*)(?:apagar|apaga)\s+(?:a\s+)?última\s+frase/gi,
    ''
  );
  result = result.replace(
    /(\S+\s*)(?:apagar|apaga)\s+(?:a\s+)?última\s+palavra/gi,
    ''
  );

  for (const cmd of VOICE_COMMANDS) {
    for (const phrase of cmd.spoken) {
      const re = new RegExp(`\\s*\\b${escapeRegExp(phrase)}\\b\\s*`, 'gi');
      result = result.replace(re, cmd.insert);
    }
  }

  return tidyPunctuation(result);
}

/** Expande snippets: substitui gatilhos pelo texto configurado. */
export function applySnippets(text, snippets) {
  let result = text;
  for (const { trigger, expansion } of snippets) {
    if (!trigger) continue;
    const re = new RegExp(`\\b${escapeRegExp(trigger)}\\b`, 'gi');
    result = result.replace(re, expansion);
  }
  return result;
}

/** Aplica correções exatas do dicionário ("errado => certo"). */
export function applyDictionary(text, replacements) {
  let result = text;
  for (const { from, to } of replacements) {
    if (!from) continue;
    const re = new RegExp(`\\b${escapeRegExp(from)}\\b`, 'gi');
    result = result.replace(re, to);
  }
  return result;
}

/**
 * Pipeline completo de transformação local aplicado à transcrição bruta,
 * antes (ou no lugar) da formatação por IA.
 */
export function transformLocally(rawText, { voiceCommands, snippets, replacements }) {
  let result = rawText;
  if (voiceCommands) result = applyVoiceCommands(result);
  if (snippets?.length) result = applySnippets(result, snippets);
  if (replacements?.length) result = applyDictionary(result, replacements);
  return result;
}
