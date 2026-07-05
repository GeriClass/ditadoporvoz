// Persistência de configurações, histórico, dicionário, snippets e estatísticas.

const SETTINGS_KEY = 'ditadoporvoz:settings';
const HISTORY_KEY = 'ditadoporvoz:history';
const DICTIONARY_KEY = 'ditadoporvoz:dictionary';
const SNIPPETS_KEY = 'ditadoporvoz:snippets';
const STATS_KEY = 'ditadoporvoz:stats';
const MAX_HISTORY = 100;

const DEFAULT_SETTINGS = {
  lang: 'pt-BR',
  engine: 'webspeech', // 'webspeech' | 'whisper'
  aiEnabled: true,
  provider: 'anthropic', // 'anthropic' | 'openai'
  apiKey: '',
  whisperKey: '', // chave OpenAI para o Whisper (usa apiKey se provider=openai e vazio)
  autoCopy: false,
  tone: 'natural',
  translateTo: '', // '' = sem tradução
  voiceCommands: true,
  customPrompt: '',
  theme: 'dark', // 'dark' | 'light'
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// ---------- Configurações ----------

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...readJSON(SETTINGS_KEY, {}) };
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ---------- Histórico ----------

export function loadHistory() {
  return readJSON(HISTORY_KEY, []);
}

export function addToHistory(entry) {
  const history = loadHistory();
  history.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: entry.text,
    rawText: entry.rawText || '',
    tone: entry.tone || 'natural',
    pinned: false,
    createdAt: new Date().toISOString(),
  });
  // Mantém todos os itens fixados; limita os não fixados a MAX_HISTORY,
  // preservando a ordem (mais recentes primeiro).
  let nonPinned = 0;
  const trimmed = history.filter((item) => {
    if (item.pinned) return true;
    nonPinned += 1;
    return nonPinned <= MAX_HISTORY;
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function removeFromHistory(id) {
  const history = loadHistory().filter((item) => item.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return history;
}

export function togglePin(id) {
  const history = loadHistory().map((item) =>
    item.id === id ? { ...item, pinned: !item.pinned } : item
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return history;
}

export function clearHistory() {
  // Preserva os itens fixados.
  const pinned = loadHistory().filter((item) => item.pinned);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(pinned));
  return pinned;
}

// ---------- Dicionário pessoal ----------
// Cada linha: um termo ("Gericlass") ou uma correção ("gerá clas => Gericlass").

export function loadDictionary() {
  return localStorage.getItem(DICTIONARY_KEY) || '';
}

export function saveDictionary(text) {
  localStorage.setItem(DICTIONARY_KEY, text);
}

/** Retorna { terms: [...], replacements: [{from, to}] } a partir do texto do dicionário. */
export function parseDictionary(text = loadDictionary()) {
  const terms = [];
  const replacements = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.split(/\s*(?:=>|→|->)\s*/);
    if (match.length === 2 && match[0] && match[1]) {
      replacements.push({ from: match[0], to: match[1] });
      terms.push(match[1]);
    } else {
      terms.push(trimmed);
    }
  }
  return { terms, replacements };
}

// ---------- Snippets ----------
// Cada linha: "gatilho => texto expandido".

export function loadSnippets() {
  return localStorage.getItem(SNIPPETS_KEY) || '';
}

export function saveSnippets(text) {
  localStorage.setItem(SNIPPETS_KEY, text);
}

/** Retorna [{trigger, expansion}] a partir do texto dos snippets. */
export function parseSnippets(text = loadSnippets()) {
  const snippets = [];
  for (const line of String(text || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s*(?:=>|→|->)\s*/);
    if (parts.length >= 2 && parts[0]) {
      snippets.push({ trigger: parts[0], expansion: parts.slice(1).join(' => ') });
    }
  }
  return snippets;
}

// ---------- Estatísticas ----------

const DEFAULT_STATS = { totalDictations: 0, totalWords: 0, msSaved: 0, days: {} };

export function loadStats() {
  return { ...DEFAULT_STATS, ...readJSON(STATS_KEY, {}) };
}

export function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function resetStats() {
  localStorage.removeItem(STATS_KEY);
  return { ...DEFAULT_STATS, days: {} };
}
