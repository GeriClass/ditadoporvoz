import { isSpeechSupported, SpeechSession } from './lib/speech.js';
import { formatText } from './lib/ai.js';
import { transformLocally } from './lib/transform.js';

const $ = (id) => document.getElementById(id);
const els = {
  mic: $('btn-mic'),
  status: $('status'),
  result: $('result'),
  copy: $('btn-copy'),
  insert: $('btn-insert'),
  settingsBtn: $('btn-settings'),
  settings: $('settings'),
  provider: $('provider'),
  apiKey: $('api-key'),
  lang: $('lang'),
  aiEnabled: $('ai-enabled'),
  voiceCommands: $('voice-commands'),
  save: $('btn-save'),
  tones: document.querySelectorAll('.tone'),
};

const DEFAULTS = {
  provider: 'anthropic',
  apiKey: '',
  lang: 'pt-BR',
  aiEnabled: true,
  voiceCommands: true,
  tone: 'natural',
};

let settings = { ...DEFAULTS };

function load() {
  return new Promise((resolve) => {
    chrome.storage.local.get('ditado', (data) => {
      settings = { ...DEFAULTS, ...(data.ditado || {}) };
      resolve();
    });
  });
}

function persist() {
  chrome.storage.local.set({ ditado: settings });
}

const session = new SpeechSession({
  lang: settings.lang,
  onResult: (finalText, interim) => {
    els.result.value = (finalText + interim).trim();
  },
  onStateChange: (recording) => {
    els.mic.classList.toggle('recording', recording);
    els.status.textContent = recording ? 'Gravando… clique para parar' : 'Processando…';
  },
  onError: (code) => {
    els.status.textContent =
      code === 'mic-denied' ? 'Microfone bloqueado.' : 'Erro no reconhecimento.';
  },
});

function toggleMic() {
  if (session.listening) {
    const raw = session.stop();
    finish(raw);
  } else {
    if (!isSpeechSupported()) {
      els.status.textContent = 'Use o Chrome/Edge para ditar.';
      return;
    }
    session.setLang(settings.lang);
    els.result.value = '';
    session.start();
  }
}

async function finish(raw) {
  const processed = transformLocally(raw || '', {
    voiceCommands: settings.voiceCommands,
    snippets: [],
    replacements: [],
  });
  els.result.value = processed;
  updateButtons();

  if (!processed) {
    els.status.textContent = 'Nada captado.';
    return;
  }
  if (!settings.aiEnabled || !settings.apiKey) {
    els.status.textContent = 'Pronto.';
    return;
  }

  els.status.textContent = 'Formatando com IA…';
  try {
    const formatted = await formatText({
      rawText: processed,
      tone: settings.tone,
      provider: settings.provider,
      apiKey: settings.apiKey,
    });
    els.result.value = formatted;
    els.status.textContent = 'Pronto ✓';
  } catch (err) {
    els.status.textContent = err.message;
  }
  updateButtons();
}

function updateButtons() {
  const has = Boolean(els.result.value.trim());
  els.copy.disabled = !has;
  els.insert.disabled = !has;
}

async function copy() {
  await navigator.clipboard.writeText(els.result.value);
  els.status.textContent = 'Copiado!';
}

async function insertIntoPage() {
  const text = els.result.value;
  if (!text) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: 'ditado-insert', text }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      // Sem campo focado na página — copia como alternativa.
      navigator.clipboard.writeText(text);
      els.status.textContent = 'Sem campo ativo — texto copiado.';
    } else {
      els.status.textContent = 'Inserido na página!';
      window.close();
    }
  });
}

function selectTone(tone) {
  settings.tone = tone;
  persist();
  els.tones.forEach((t) => t.classList.toggle('active', t.dataset.tone === tone));
}

function openSettingsPanel() {
  els.provider.value = settings.provider;
  els.apiKey.value = settings.apiKey;
  els.lang.value = settings.lang;
  els.aiEnabled.checked = settings.aiEnabled;
  els.voiceCommands.checked = settings.voiceCommands;
  els.settings.classList.toggle('hidden');
}

function saveSettings() {
  settings = {
    ...settings,
    provider: els.provider.value,
    apiKey: els.apiKey.value.trim(),
    lang: els.lang.value,
    aiEnabled: els.aiEnabled.checked,
    voiceCommands: els.voiceCommands.checked,
  };
  persist();
  session.setLang(settings.lang);
  els.settings.classList.add('hidden');
  els.status.textContent = 'Configurações salvas.';
}

async function init() {
  await load();
  selectTone(settings.tone);
  els.mic.addEventListener('click', toggleMic);
  els.copy.addEventListener('click', copy);
  els.insert.addEventListener('click', insertIntoPage);
  els.result.addEventListener('input', updateButtons);
  els.settingsBtn.addEventListener('click', openSettingsPanel);
  els.save.addEventListener('click', saveSettings);
  els.tones.forEach((t) => t.addEventListener('click', () => selectTone(t.dataset.tone)));
}

init();
