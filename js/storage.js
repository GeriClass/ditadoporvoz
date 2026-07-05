// Persistência de configurações e histórico em localStorage.

const SETTINGS_KEY = 'ditadoporvoz:settings';
const HISTORY_KEY = 'ditadoporvoz:history';
const MAX_HISTORY = 50;

const DEFAULT_SETTINGS = {
  lang: 'pt-BR',
  aiEnabled: true,
  provider: 'anthropic',
  apiKey: '',
  autoCopy: false,
  tone: 'natural',
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToHistory(entry) {
  const history = loadHistory();
  history.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: entry.text,
    rawText: entry.rawText || '',
    tone: entry.tone || 'natural',
    createdAt: new Date().toISOString(),
  });
  const trimmed = history.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function removeFromHistory(id) {
  const history = loadHistory().filter((item) => item.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return history;
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  return [];
}
