import { isSpeechSupported, SpeechSession } from './speech.js';
import { formatText } from './ai.js';
import {
  loadSettings,
  saveSettings,
  loadHistory,
  addToHistory,
  removeFromHistory,
  clearHistory,
} from './storage.js';

const el = {
  micBtn: document.getElementById('btn-mic'),
  micStatus: document.getElementById('mic-status'),
  transcript: document.getElementById('transcript'),
  transcriptLabel: document.getElementById('transcript-label'),
  aiStatus: document.getElementById('ai-status'),
  copyBtn: document.getElementById('btn-copy'),
  clearBtn: document.getElementById('btn-clear'),
  toggleRawBtn: document.getElementById('btn-toggle-raw'),
  toneChips: document.querySelectorAll('.tone-chip'),
  unsupportedBanner: document.getElementById('unsupported-banner'),
  noKeyBanner: document.getElementById('no-key-banner'),
  openSettingsInline: document.getElementById('btn-open-settings-inline'),
  settingsBtn: document.getElementById('btn-settings'),
  settingsModal: document.getElementById('settings-modal'),
  closeSettingsBtn: document.getElementById('btn-close-settings'),
  settingsForm: document.getElementById('settings-form'),
  settingLang: document.getElementById('setting-lang'),
  settingAiEnabled: document.getElementById('setting-ai-enabled'),
  settingProvider: document.getElementById('setting-provider'),
  settingApiKey: document.getElementById('setting-api-key'),
  settingAutoCopy: document.getElementById('setting-auto-copy'),
  historyBtn: document.getElementById('btn-history'),
  historyPanel: document.getElementById('history-panel'),
  closeHistoryBtn: document.getElementById('btn-close-history'),
  clearHistoryBtn: document.getElementById('btn-clear-history'),
  historyList: document.getElementById('history-list'),
  historyEmpty: document.getElementById('history-empty'),
  toast: document.getElementById('toast'),
};

let settings = loadSettings();
let currentText = ''; // texto exibido/copiável (formatado quando a IA roda)
let rawText = ''; // transcrição bruta da última dictação
let showingRaw = false;
let formatting = false;

const session = new SpeechSession({
  lang: settings.lang,
  onResult: renderLiveTranscript,
  onError: handleSpeechError,
  onStateChange: renderMicState,
});

// ---------- Transcrição ----------

function renderLiveTranscript(finalText, interimText) {
  currentText = finalText.trim();
  el.transcript.innerHTML = '';
  if (!finalText && !interimText) {
    el.transcript.innerHTML = '<span class="placeholder">Fale agora…</span>';
    return;
  }
  el.transcript.append(document.createTextNode(finalText));
  if (interimText) {
    const interim = document.createElement('span');
    interim.className = 'interim';
    interim.textContent = interimText;
    el.transcript.append(interim);
  }
  el.transcript.scrollTop = el.transcript.scrollHeight;
  el.copyBtn.disabled = !currentText;
}

function renderMicState(recording) {
  el.micBtn.classList.toggle('recording', recording);
  el.micStatus.classList.toggle('recording-label', recording);
  if (recording) {
    el.micBtn.setAttribute('aria-label', 'Parar ditado');
    el.micStatus.textContent = 'Gravando… clique de novo (ou Ctrl+Espaço) para parar';
  } else {
    el.micBtn.setAttribute('aria-label', 'Iniciar ditado');
    el.micStatus.innerHTML =
      'Clique no microfone ou pressione <kbd>Ctrl</kbd>+<kbd>Espaço</kbd> para ditar';
  }
}

function handleSpeechError(code) {
  const messages = {
    unsupported: 'Reconhecimento de voz não suportado neste navegador.',
    'mic-denied': 'Permissão de microfone negada. Libere o microfone nas permissões do site.',
    network: 'Erro de rede no reconhecimento de voz. Verifique sua conexão.',
  };
  showToast(messages[code] || 'Erro no reconhecimento de voz.');
}

function toggleRecording() {
  if (session.listening) {
    const text = session.stop();
    finishDictation(text);
  } else {
    hideAiStatus();
    el.toggleRawBtn.classList.add('hidden');
    el.transcriptLabel.textContent = 'Transcrição';
    showingRaw = false;
    rawText = '';
    session.setLang(settings.lang);
    session.start();
    renderLiveTranscript('', '');
  }
}

async function finishDictation(text) {
  rawText = text;
  currentText = text;
  renderStaticText(text || '');

  if (!text) {
    el.transcript.innerHTML = '<span class="placeholder">Nada foi captado. Tente de novo.</span>';
    el.copyBtn.disabled = true;
    return;
  }

  if (!settings.aiEnabled || !settings.apiKey) {
    saveDictation(text, text);
    maybeAutoCopy();
    return;
  }

  formatting = true;
  showAiStatus('<span class="spinner"></span> Formatando com IA…');
  try {
    const formatted = await formatText({
      rawText: text,
      tone: settings.tone,
      provider: settings.provider,
      apiKey: settings.apiKey,
    });
    currentText = formatted;
    renderStaticText(formatted);
    el.transcriptLabel.textContent = 'Texto formatado';
    el.toggleRawBtn.classList.remove('hidden');
    el.toggleRawBtn.textContent = 'Ver texto bruto';
    showingRaw = false;
    showAiStatus('✓ Texto formatado pela IA', 'success');
    saveDictation(formatted, text);
    maybeAutoCopy();
  } catch (err) {
    showAiStatus(`⚠ ${err.message} O texto bruto foi mantido.`, 'error');
    saveDictation(text, text);
  } finally {
    formatting = false;
  }
}

function renderStaticText(text) {
  el.transcript.textContent = text;
  el.copyBtn.disabled = !text;
}

function saveDictation(text, raw) {
  addToHistory({ text, rawText: raw, tone: settings.tone });
  renderHistory();
}

function maybeAutoCopy() {
  if (settings.autoCopy && currentText) {
    copyToClipboard(currentText, 'Copiado automaticamente!');
  }
}

// ---------- Status da IA ----------

function showAiStatus(html, kind = '') {
  el.aiStatus.className = `ai-status ${kind}`;
  el.aiStatus.innerHTML = html;
  el.aiStatus.classList.remove('hidden');
}

function hideAiStatus() {
  el.aiStatus.classList.add('hidden');
}

// ---------- Copiar / limpar / texto bruto ----------

async function copyToClipboard(text, message = 'Copiado!') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch {
    showToast('Não foi possível copiar. Selecione o texto manualmente.');
  }
}

function toggleRawView() {
  showingRaw = !showingRaw;
  if (showingRaw) {
    renderStaticText(rawText);
    el.transcriptLabel.textContent = 'Texto bruto';
    el.toggleRawBtn.textContent = 'Ver texto formatado';
  } else {
    renderStaticText(currentText);
    el.transcriptLabel.textContent = 'Texto formatado';
    el.toggleRawBtn.textContent = 'Ver texto bruto';
  }
}

function clearTranscript() {
  currentText = '';
  rawText = '';
  showingRaw = false;
  el.transcript.innerHTML = '<span class="placeholder">O texto ditado aparecerá aqui…</span>';
  el.transcriptLabel.textContent = 'Transcrição';
  el.toggleRawBtn.classList.add('hidden');
  el.copyBtn.disabled = true;
  hideAiStatus();
}

// ---------- Tons ----------

function selectTone(tone) {
  settings.tone = tone;
  saveSettings(settings);
  el.toneChips.forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.tone === tone);
  });
}

// ---------- Configurações ----------

function openSettings() {
  el.settingLang.value = settings.lang;
  el.settingAiEnabled.checked = settings.aiEnabled;
  el.settingProvider.value = settings.provider;
  el.settingApiKey.value = settings.apiKey;
  el.settingAutoCopy.checked = settings.autoCopy;
  el.settingsModal.classList.remove('hidden');
}

function closeSettings() {
  el.settingsModal.classList.add('hidden');
}

function submitSettings(event) {
  event.preventDefault();
  settings = {
    ...settings,
    lang: el.settingLang.value,
    aiEnabled: el.settingAiEnabled.checked,
    provider: el.settingProvider.value,
    apiKey: el.settingApiKey.value.trim(),
    autoCopy: el.settingAutoCopy.checked,
  };
  saveSettings(settings);
  session.setLang(settings.lang);
  updateNoKeyBanner();
  closeSettings();
  showToast('Configurações salvas!');
}

function updateNoKeyBanner() {
  const needsKey = settings.aiEnabled && !settings.apiKey;
  el.noKeyBanner.classList.toggle('hidden', !needsKey);
}

// ---------- Histórico ----------

function renderHistory() {
  const history = loadHistory();
  el.historyList.innerHTML = '';
  el.historyEmpty.classList.toggle('hidden', history.length > 0);

  for (const item of history) {
    const li = document.createElement('li');
    li.className = 'history-item';

    const text = document.createElement('p');
    text.className = 'history-item-text';
    text.textContent = item.text;

    const meta = document.createElement('div');
    meta.className = 'history-item-meta';

    const date = document.createElement('span');
    date.className = 'history-item-date';
    date.textContent = new Date(item.createdAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const actions = document.createElement('div');
    actions.className = 'history-item-actions';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copiar';
    copyBtn.addEventListener('click', () => copyToClipboard(item.text));

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Excluir';
    deleteBtn.addEventListener('click', () => {
      removeFromHistory(item.id);
      renderHistory();
    });

    actions.append(copyBtn, deleteBtn);
    meta.append(date, actions);
    li.append(text, meta);
    el.historyList.append(li);
  }
}

// ---------- Toast ----------

let toastTimer = null;

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2600);
}

// ---------- Inicialização ----------

function init() {
  if (!isSpeechSupported()) {
    el.unsupportedBanner.classList.remove('hidden');
    el.micBtn.disabled = true;
  }

  updateNoKeyBanner();
  selectTone(settings.tone);
  renderHistory();

  el.micBtn.addEventListener('click', toggleRecording);
  el.copyBtn.addEventListener('click', () =>
    copyToClipboard(showingRaw ? rawText : currentText)
  );
  el.clearBtn.addEventListener('click', clearTranscript);
  el.toggleRawBtn.addEventListener('click', toggleRawView);

  el.toneChips.forEach((chip) => {
    chip.addEventListener('click', () => selectTone(chip.dataset.tone));
  });

  el.settingsBtn.addEventListener('click', openSettings);
  el.openSettingsInline.addEventListener('click', openSettings);
  el.closeSettingsBtn.addEventListener('click', closeSettings);
  el.settingsModal.addEventListener('click', (event) => {
    if (event.target === el.settingsModal) closeSettings();
  });
  el.settingsForm.addEventListener('submit', submitSettings);

  el.historyBtn.addEventListener('click', () => {
    renderHistory();
    el.historyPanel.classList.toggle('hidden');
  });
  el.closeHistoryBtn.addEventListener('click', () =>
    el.historyPanel.classList.add('hidden')
  );
  el.clearHistoryBtn.addEventListener('click', () => {
    clearHistory();
    renderHistory();
  });

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.code === 'Space') {
      event.preventDefault();
      if (!el.micBtn.disabled && !formatting) toggleRecording();
    }
    if (event.key === 'Escape') {
      closeSettings();
      el.historyPanel.classList.add('hidden');
    }
  });
}

init();
