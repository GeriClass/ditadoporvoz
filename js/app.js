import { isSpeechSupported, SpeechSession } from './speech.js';
import { WhisperSession, isRecordingSupported } from './whisper.js';
import { formatText } from './ai.js';
import { transformLocally } from './transform.js';
import { recordDictation, getSummary } from './stats.js';
import { setupInstall, registerServiceWorker } from './pwa.js';
import {
  loadSettings,
  saveSettings,
  loadHistory,
  addToHistory,
  removeFromHistory,
  togglePin,
  clearHistory,
  loadDictionary,
  saveDictionary,
  parseDictionary,
  loadSnippets,
  saveSnippets,
  parseSnippets,
  resetStats,
} from './storage.js';

const $ = (id) => document.getElementById(id);

const el = {
  micBtn: $('btn-mic'),
  micIcon: document.querySelector('.mic-icon'),
  micStatus: $('mic-status'),
  transcript: $('transcript'),
  transcriptLabel: $('transcript-label'),
  aiStatus: $('ai-status'),
  copyBtn: $('btn-copy'),
  clearBtn: $('btn-clear'),
  shareBtn: $('btn-share'),
  toggleRawBtn: $('btn-toggle-raw'),
  toneChips: document.querySelectorAll('.tone-chip'),
  unsupportedBanner: $('unsupported-banner'),
  noKeyBanner: $('no-key-banner'),
  openSettingsInline: $('btn-open-settings-inline'),
  installBtn: $('btn-install'),
  themeBtn: $('btn-theme'),
  // settings
  settingsBtn: $('btn-settings'),
  settingsModal: $('settings-modal'),
  closeSettingsBtn: $('btn-close-settings'),
  settingsForm: $('settings-form'),
  settingEngine: $('setting-engine'),
  settingLang: $('setting-lang'),
  settingVoiceCommands: $('setting-voice-commands'),
  settingWhisperKey: $('setting-whisper-key'),
  whisperKeyField: document.querySelector('.whisper-key'),
  settingAiEnabled: $('setting-ai-enabled'),
  settingProvider: $('setting-provider'),
  settingApiKey: $('setting-api-key'),
  settingTranslate: $('setting-translate'),
  settingCustomPrompt: $('setting-custom-prompt'),
  settingDictionary: $('setting-dictionary'),
  settingSnippets: $('setting-snippets'),
  settingAutoCopy: $('setting-auto-copy'),
  // stats
  statsBtn: $('btn-stats'),
  statsModal: $('stats-modal'),
  closeStatsBtn: $('btn-close-stats'),
  resetStatsBtn: $('btn-reset-stats'),
  statDictations: $('stat-dictations'),
  statWords: $('stat-words'),
  statTime: $('stat-time'),
  statStreak: $('stat-streak'),
  // history
  historyBtn: $('btn-history'),
  historyPanel: $('history-panel'),
  closeHistoryBtn: $('btn-close-history'),
  historySearch: $('history-search'),
  exportTxtBtn: $('btn-export-txt'),
  exportMdBtn: $('btn-export-md'),
  clearHistoryBtn: $('btn-clear-history'),
  historyList: $('history-list'),
  historyEmpty: $('history-empty'),
  toast: $('toast'),
};

let settings = loadSettings();
let currentText = ''; // texto final exibido (formatado quando a IA roda)
let rawText = ''; // texto pré-IA (mostrado no toggle "texto bruto")
let showingRaw = false;
let busy = false; // formatando ou transcrevendo — bloqueia novo ditado
let historyQuery = '';

const speechSession = new SpeechSession({
  lang: settings.lang,
  onResult: renderLiveTranscript,
  onError: handleSpeechError,
  onStateChange: renderMicState,
});
let whisperSession = null;

function whisperKey() {
  return settings.whisperKey || (settings.provider === 'openai' ? settings.apiKey : '');
}

// ---------- Gravação ----------

function toggleRecording() {
  if (busy) return;
  if (speechSession.listening || whisperSession?.listening) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  resetForNewDictation();
  if (settings.engine === 'whisper') {
    startWhisper();
  } else {
    if (!isSpeechSupported()) {
      showToast('Reconhecimento de voz não suportado. Use o Whisper nas configurações.');
      return;
    }
    speechSession.setLang(settings.lang);
    speechSession.start();
    renderLiveTranscript('', '');
  }
}

async function startWhisper() {
  const key = whisperKey();
  if (!key) {
    showToast('Configure uma chave OpenAI (Whisper) nas configurações.');
    return;
  }
  if (!isRecordingSupported()) {
    showToast('Gravação de áudio não suportada neste navegador.');
    return;
  }
  whisperSession = new WhisperSession({
    apiKey: key,
    lang: settings.lang,
    onStateChange: renderMicState,
    onError: handleSpeechError,
  });
  await whisperSession.start();
}

function stopRecording() {
  if (settings.engine === 'whisper' && whisperSession) {
    stopWhisper();
  } else {
    const text = speechSession.stop();
    finishDictation(text);
  }
}

async function stopWhisper() {
  setBusy(true, 'Transcrevendo com o Whisper…');
  try {
    const text = await whisperSession.stop();
    finishDictation(text);
  } catch (err) {
    showToast(err.message);
    el.transcript.innerHTML = placeholder('A transcrição falhou. Tente de novo.');
  } finally {
    whisperSession = null;
    setBusy(false);
  }
}

// ---------- Transcrição em tempo real ----------

function renderLiveTranscript(finalText, interimText) {
  currentText = finalText.trim();
  el.transcript.innerHTML = '';
  if (!finalText && !interimText) {
    el.transcript.innerHTML = placeholder('Fale agora…');
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
  } else if (!busy) {
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

// ---------- Fim do ditado: transforma e formata ----------

async function finishDictation(rawTranscript) {
  const { terms, replacements } = parseDictionary();
  const snippets = parseSnippets();
  const processed = transformLocally(rawTranscript || '', {
    voiceCommands: settings.voiceCommands,
    snippets,
    replacements,
  });

  rawText = processed;
  currentText = processed;
  showingRaw = false;
  el.transcriptLabel.textContent = 'Transcrição';
  el.toggleRawBtn.classList.add('hidden');

  if (!processed) {
    el.transcript.innerHTML = placeholder('Nada foi captado. Tente de novo.');
    updateActionButtons();
    return;
  }

  renderStaticText(processed);

  if (!settings.aiEnabled || !settings.apiKey) {
    saveDictation(processed, rawTranscript);
    recordAndRefreshStats(processed);
    maybeAutoCopy();
    return;
  }

  setBusy(true);
  showAiStatus('<span class="spinner"></span> Formatando com IA…');
  try {
    const formatted = await formatText({
      rawText: processed,
      tone: settings.tone,
      provider: settings.provider,
      apiKey: settings.apiKey,
      dictionaryTerms: terms,
      translateTo: settings.translateTo,
      customPrompt: settings.customPrompt,
    });
    currentText = formatted;
    renderStaticText(formatted);
    el.transcriptLabel.textContent = settings.translateTo ? 'Texto traduzido' : 'Texto formatado';
    el.toggleRawBtn.classList.remove('hidden');
    el.toggleRawBtn.textContent = 'Ver texto bruto';
    showingRaw = false;
    showAiStatus('✓ Texto pronto', 'success');
    saveDictation(formatted, processed);
    recordAndRefreshStats(formatted);
    maybeAutoCopy();
  } catch (err) {
    showAiStatus(`⚠ ${err.message} O texto bruto foi mantido.`, 'error');
    saveDictation(processed, rawTranscript);
    recordAndRefreshStats(processed);
  } finally {
    setBusy(false);
  }
}

function renderStaticText(text) {
  el.transcript.textContent = text;
  updateActionButtons();
}

function placeholder(msg) {
  return `<span class="placeholder">${msg}</span>`;
}

function resetForNewDictation() {
  hideAiStatus();
  el.toggleRawBtn.classList.add('hidden');
  el.shareBtn.classList.add('hidden');
  el.transcriptLabel.textContent = 'Transcrição';
  showingRaw = false;
  rawText = '';
  currentText = '';
}

function saveDictation(text, raw) {
  addToHistory({ text, rawText: raw, tone: settings.tone });
  if (!el.historyPanel.classList.contains('hidden')) renderHistory();
}

function recordAndRefreshStats(text) {
  recordDictation(text);
  if (!el.statsModal.classList.contains('hidden')) renderStats();
}

function maybeAutoCopy() {
  if (settings.autoCopy && currentText) {
    copyToClipboard(currentText, 'Copiado automaticamente!');
  }
}

function updateActionButtons() {
  const text = showingRaw ? rawText : currentText;
  el.copyBtn.disabled = !text;
  el.shareBtn.classList.toggle('hidden', !text);
}

// ---------- Estado ocupado (transcrevendo/formatando) ----------

function setBusy(value, message) {
  busy = value;
  el.micBtn.disabled = value;
  el.micBtn.classList.toggle('transcribing', value);
  if (value && message) {
    el.micStatus.textContent = message;
    el.micStatus.classList.remove('recording-label');
  } else if (!value) {
    renderMicState(false);
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

// ---------- Copiar / compartilhar / bruto ----------

async function copyToClipboard(text, message = 'Copiado!') {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch {
    showToast('Não foi possível copiar. Selecione o texto manualmente.');
  }
}

async function shareText(text) {
  if (!text) return;
  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch {
      // usuário cancelou — sem ação
    }
  } else {
    copyToClipboard(text, 'Compartilhamento não suportado — texto copiado!');
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
    el.transcriptLabel.textContent = settings.translateTo ? 'Texto traduzido' : 'Texto formatado';
    el.toggleRawBtn.textContent = 'Ver texto bruto';
  }
}

function clearTranscript() {
  currentText = '';
  rawText = '';
  showingRaw = false;
  el.transcript.innerHTML = placeholder('O texto ditado aparecerá aqui…');
  el.transcriptLabel.textContent = 'Transcrição';
  el.toggleRawBtn.classList.add('hidden');
  el.shareBtn.classList.add('hidden');
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

// ---------- Tema ----------

function applyTheme() {
  document.documentElement.setAttribute('data-theme', settings.theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', settings.theme === 'light' ? '#f4f5fa' : '#0f1117');
}

function toggleTheme() {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  saveSettings(settings);
  applyTheme();
}

// ---------- Configurações ----------

function openSettings() {
  el.settingEngine.value = settings.engine;
  el.settingLang.value = settings.lang;
  el.settingVoiceCommands.checked = settings.voiceCommands;
  el.settingWhisperKey.value = settings.whisperKey;
  el.settingAiEnabled.checked = settings.aiEnabled;
  el.settingProvider.value = settings.provider;
  el.settingApiKey.value = settings.apiKey;
  el.settingTranslate.value = settings.translateTo;
  el.settingCustomPrompt.value = settings.customPrompt;
  el.settingDictionary.value = loadDictionary();
  el.settingSnippets.value = loadSnippets();
  el.settingAutoCopy.checked = settings.autoCopy;
  updateWhisperKeyVisibility();
  el.settingsModal.classList.remove('hidden');
}

function closeSettings() {
  el.settingsModal.classList.add('hidden');
}

function updateWhisperKeyVisibility() {
  el.whisperKeyField.classList.toggle('hidden', el.settingEngine.value !== 'whisper');
}

function submitSettings(event) {
  event.preventDefault();
  settings = {
    ...settings,
    engine: el.settingEngine.value,
    lang: el.settingLang.value,
    voiceCommands: el.settingVoiceCommands.checked,
    whisperKey: el.settingWhisperKey.value.trim(),
    aiEnabled: el.settingAiEnabled.checked,
    provider: el.settingProvider.value,
    apiKey: el.settingApiKey.value.trim(),
    translateTo: el.settingTranslate.value,
    customPrompt: el.settingCustomPrompt.value.trim(),
    autoCopy: el.settingAutoCopy.checked,
  };
  saveSettings(settings);
  saveDictionary(el.settingDictionary.value);
  saveSnippets(el.settingSnippets.value);
  speechSession.setLang(settings.lang);
  updateBanners();
  closeSettings();
  showToast('Configurações salvas!');
}

function updateBanners() {
  el.noKeyBanner.classList.toggle('hidden', !(settings.aiEnabled && !settings.apiKey));
  const speechBroken = settings.engine === 'webspeech' && !isSpeechSupported();
  el.unsupportedBanner.classList.toggle('hidden', !speechBroken);
  el.micBtn.disabled = speechBroken;
}

// ---------- Estatísticas ----------

function renderStats() {
  const s = getSummary();
  el.statDictations.textContent = s.totalDictations;
  el.statWords.textContent = s.totalWords;
  el.statTime.textContent = s.timeSaved;
  el.statStreak.textContent = s.streak;
}

function openStats() {
  renderStats();
  el.statsModal.classList.remove('hidden');
}

// ---------- Histórico ----------

function renderHistory() {
  const history = loadHistory();
  const query = historyQuery.trim().toLowerCase();
  const filtered = query
    ? history.filter((item) => item.text.toLowerCase().includes(query))
    : history;

  el.historyList.innerHTML = '';
  el.historyEmpty.classList.toggle('hidden', filtered.length > 0);
  el.historyEmpty.textContent = query
    ? 'Nenhum resultado para a busca.'
    : 'Nenhuma dictação ainda.';

  for (const item of filtered) {
    el.historyList.append(buildHistoryItem(item));
  }
}

function buildHistoryItem(item) {
  const li = document.createElement('li');
  li.className = `history-item${item.pinned ? ' pinned' : ''}`;

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

  const pinBtn = document.createElement('button');
  pinBtn.className = `pin${item.pinned ? ' active' : ''}`;
  pinBtn.textContent = item.pinned ? '★' : '☆';
  pinBtn.title = item.pinned ? 'Desafixar' : 'Fixar';
  pinBtn.addEventListener('click', () => {
    togglePin(item.id);
    renderHistory();
  });

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copiar';
  copyBtn.addEventListener('click', () => copyToClipboard(item.text));

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Excluir';
  deleteBtn.addEventListener('click', () => {
    removeFromHistory(item.id);
    renderHistory();
  });

  actions.append(pinBtn, copyBtn, deleteBtn);
  meta.append(date, actions);
  li.append(text, meta);
  return li;
}

function exportHistory(format) {
  const history = loadHistory();
  if (!history.length) {
    showToast('Nada para exportar.');
    return;
  }
  const fmtDate = (iso) => new Date(iso).toLocaleString('pt-BR');
  let content;
  let ext;
  let mime;
  if (format === 'md') {
    content = history
      .map((h) => `### ${fmtDate(h.createdAt)}\n\n${h.text}\n`)
      .join('\n---\n\n');
    ext = 'md';
    mime = 'text/markdown';
  } else {
    content = history.map((h) => `[${fmtDate(h.createdAt)}]\n${h.text}\n`).join('\n');
    ext = 'txt';
    mime = 'text/plain';
  }
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(`ditadoporvoz-${stamp}.${ext}`, content, mime);
}

function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Toast ----------

let toastTimer = null;

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2800);
}

// ---------- Inicialização ----------

function init() {
  applyTheme();
  updateBanners();
  selectTone(settings.tone);
  renderHistory();

  el.micBtn.addEventListener('click', toggleRecording);
  el.copyBtn.addEventListener('click', () =>
    copyToClipboard(showingRaw ? rawText : currentText)
  );
  el.shareBtn.addEventListener('click', () => shareText(showingRaw ? rawText : currentText));
  el.clearBtn.addEventListener('click', clearTranscript);
  el.toggleRawBtn.addEventListener('click', toggleRawView);

  el.toneChips.forEach((chip) => {
    chip.addEventListener('click', () => selectTone(chip.dataset.tone));
  });

  el.themeBtn.addEventListener('click', toggleTheme);

  // Configurações
  el.settingsBtn.addEventListener('click', openSettings);
  el.openSettingsInline.addEventListener('click', openSettings);
  el.closeSettingsBtn.addEventListener('click', closeSettings);
  el.settingEngine.addEventListener('change', updateWhisperKeyVisibility);
  el.settingsModal.addEventListener('click', (e) => {
    if (e.target === el.settingsModal) closeSettings();
  });
  el.settingsForm.addEventListener('submit', submitSettings);

  // Estatísticas
  el.statsBtn.addEventListener('click', openStats);
  el.closeStatsBtn.addEventListener('click', () => el.statsModal.classList.add('hidden'));
  el.statsModal.addEventListener('click', (e) => {
    if (e.target === el.statsModal) el.statsModal.classList.add('hidden');
  });
  el.resetStatsBtn.addEventListener('click', () => {
    resetStats();
    renderStats();
    showToast('Estatísticas zeradas.');
  });

  // Histórico
  el.historyBtn.addEventListener('click', () => {
    renderHistory();
    el.historyPanel.classList.toggle('hidden');
  });
  el.closeHistoryBtn.addEventListener('click', () =>
    el.historyPanel.classList.add('hidden')
  );
  el.historySearch.addEventListener('input', (e) => {
    historyQuery = e.target.value;
    renderHistory();
  });
  el.exportTxtBtn.addEventListener('click', () => exportHistory('txt'));
  el.exportMdBtn.addEventListener('click', () => exportHistory('md'));
  el.clearHistoryBtn.addEventListener('click', () => {
    clearHistory();
    renderHistory();
    showToast('Histórico limpo (itens fixados foram mantidos).');
  });

  // Atalhos
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      if (!el.micBtn.disabled) toggleRecording();
    }
    if (e.key === 'Escape') {
      closeSettings();
      el.statsModal.classList.add('hidden');
      el.historyPanel.classList.add('hidden');
    }
  });

  // PWA
  setupInstall(el.installBtn, () => showToast('App instalado!'));
  registerServiceWorker();
}

init();
