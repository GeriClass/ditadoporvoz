// Lógica do pill flutuante: gravar → transcrever (Whisper) → formatar (IA)
// → colar automaticamente no app que estava focado.
// Reusa o núcleo do app web (desktop/web = cópia gerada por copy-core.js).

import { WhisperSession } from './web/js/whisper.js';
import { formatText } from './web/js/ai.js';
import { transformLocally } from './web/js/transform.js';

const $ = (id) => document.getElementById(id);
const pill = $('pill');
const title = $('pill-title');
const hint = $('pill-hint');
const timerEl = $('timer');
const bars = $('bars');

let settings = null;
let session = null;
let recording = false;
let working = false;
let timerInterval = null;
let startedAt = 0;
let hideTimeout = null;

function whisperKey() {
  return settings.whisperKey || (settings.provider === 'openai' ? settings.apiKey : '');
}

function setState(state, titleText, hintText) {
  pill.className = `pill state-${state}`;
  title.textContent = titleText;
  hint.textContent = hintText || '';
  const isRecording = state === 'recording';
  timerEl.classList.toggle('hidden', !isRecording);
  bars.classList.toggle('hidden', !isRecording);
  $('orb').textContent =
    { recording: '🎤', working: '✨', done: '✓', error: '⚠', config: '🔑' }[state] || '🎤';
}

function startTimer() {
  startedAt = Date.now();
  timerEl.textContent = '0:00';
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 500);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function scheduleHide(ms) {
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => window.ditado.hide(), ms);
}

// ---------- Fluxo principal ----------

async function startRecording() {
  clearTimeout(hideTimeout);

  if (!whisperKey()) {
    setState(
      'config',
      'Falta a chave de transcrição',
      'Clique em ⚙ e informe sua chave OpenAI (Whisper).'
    );
    scheduleHide(6000);
    return;
  }

  session = new WhisperSession({
    apiKey: whisperKey(),
    lang: settings.lang,
    onError: (code) => {
      setState(
        'error',
        code === 'mic-denied' ? 'Microfone bloqueado' : 'Erro no microfone',
        'Verifique as permissões de microfone do sistema.'
      );
      recording = false;
      stopTimer();
      scheduleHide(5000);
    },
  });

  await session.start();
  if (!session.listening) return; // erro já tratado acima

  recording = true;
  setState('recording', 'Ouvindo…', 'Aperte o atalho de novo para colar no app.');
  startTimer();
}

async function stopAndProcess() {
  recording = false;
  working = true;
  stopTimer();

  try {
    setState('working', 'Transcrevendo…', 'Whisper (OpenAI)');
    const raw = await session.stop();

    if (!raw.trim()) {
      setState('error', 'Nada foi captado', 'Tente falar mais perto do microfone.');
      scheduleHide(4000);
      return;
    }

    let text = transformLocally(raw, {
      voiceCommands: settings.voiceCommands,
      snippets: [],
      replacements: [],
    });

    if (settings.aiEnabled && settings.apiKey) {
      setState('working', 'Formatando com IA…', text.slice(0, 60));
      try {
        text = await formatText({
          rawText: text,
          tone: settings.tone,
          provider: settings.provider,
          apiKey: settings.apiKey,
        });
      } catch {
        // Sem drama: cola o texto bruto se a formatação falhar.
      }
    }

    setState('done', 'Colando…', text.slice(0, 60));
    const result = await window.ditado.paste(text);
    if (!result.pasted) {
      // paste() já esconde o overlay e o main avisa por notificação.
      return;
    }
  } catch (err) {
    setState('error', 'Falhou', err.message || 'Erro inesperado.');
    scheduleHide(5000);
  } finally {
    working = false;
    session = null;
  }
}

function cancel() {
  clearTimeout(hideTimeout);
  stopTimer();
  session?.cancel();
  session = null;
  recording = false;
  working = false;
  window.ditado.hide();
}

// O atalho global alterna: começa a gravar → para e processa.
window.ditado.onToggle(() => {
  if (working) return; // ignora aperto durante transcrição/colagem
  if (recording) {
    stopAndProcess();
  } else {
    startRecording();
  }
});

window.ditado.onSettingsUpdated((updated) => {
  settings = updated;
});

$('btn-cancel').addEventListener('click', cancel);
$('btn-config').addEventListener('click', () => {
  cancel();
  window.ditado.openSettings();
});

// Carrega as configurações na inicialização.
window.ditado.getSettings().then((s) => {
  settings = s;
});
