// Motor de transcrição alternativo via API de áudio da OpenAI (Whisper).
// Grava o áudio com MediaRecorder e envia para transcrição ao parar.
// Diferente da Web Speech API, não há transcrição parcial em tempo real:
// o texto só volta depois que a gravação termina.

const TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MODEL = 'whisper-1';

export function isRecordingSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

export class WhisperSession {
  constructor({ apiKey, lang, onStateChange, onError }) {
    this.apiKey = apiKey;
    this.lang = lang;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
    this.listening = false;
  }

  async start() {
    if (this.listening) return;
    if (!isRecordingSupported()) {
      this.onError?.('unsupported');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.onError?.('mic-denied');
      return;
    }
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
    this.listening = true;
    this.onStateChange?.(true);
  }

  /**
   * Para a gravação e resolve com o texto transcrito.
   * Lança Error com mensagem amigável em caso de falha.
   */
  async stop() {
    if (!this.recorder || !this.listening) return '';
    this.listening = false;
    this.onStateChange?.(false);

    const blob = await new Promise((resolve) => {
      this.recorder.onstop = () => resolve(new Blob(this.chunks, { type: this.recorder.mimeType || 'audio/webm' }));
      this.recorder.stop();
    });
    this._releaseStream();

    if (!blob.size) return '';
    return this._transcribe(blob);
  }

  cancel() {
    this.listening = false;
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this._releaseStream();
    this.onStateChange?.(false);
  }

  setLang(lang) {
    this.lang = lang;
  }

  setKey(apiKey) {
    this.apiKey = apiKey;
  }

  _releaseStream() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
  }

  async _transcribe(blob) {
    if (!this.apiKey) {
      throw new Error('Configure uma chave OpenAI para usar o Whisper.');
    }
    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    form.append('model', MODEL);
    if (this.lang) form.append('language', this.lang.split('-')[0]);

    let response;
    try {
      response = await fetch(TRANSCRIBE_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
    } catch {
      throw new Error('Falha de rede ao transcrever com o Whisper.');
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Chave OpenAI inválida para o Whisper.');
      }
      if (response.status === 429) {
        throw new Error('Limite de uso do Whisper atingido. Tente de novo em instantes.');
      }
      throw new Error(`Erro do Whisper (${response.status}).`);
    }

    const data = await response.json();
    return (data.text || '').trim();
  }
}
