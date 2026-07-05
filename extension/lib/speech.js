// Wrapper da Web Speech API (SpeechRecognition).
// A API nativa encerra sozinha após pausas de silêncio; este wrapper
// reinicia automaticamente enquanto o usuário não mandar parar.

export function isSpeechSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export class SpeechSession {
  constructor({ lang, onResult, onError, onStateChange }) {
    this.lang = lang;
    this.onResult = onResult;
    this.onError = onError;
    this.onStateChange = onStateChange;
    this.listening = false;
    this.finalTranscript = '';
    this.recognition = null;
  }

  start() {
    if (this.listening) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      this.onError?.('unsupported');
      return;
    }

    this.finalTranscript = '';
    this.listening = true;
    this._createRecognition(Recognition);
    this.recognition.start();
    this.onStateChange?.(true);
  }

  stop() {
    this.listening = false;
    if (this.recognition) {
      this.recognition.onend = null;
      this.recognition.stop();
      this.recognition = null;
    }
    this.onStateChange?.(false);
    return this.finalTranscript.trim();
  }

  setLang(lang) {
    this.lang = lang;
  }

  _createRecognition(Recognition) {
    const recognition = new Recognition();
    recognition.lang = this.lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const chunk = result[0].transcript.trim();
          if (chunk) this.finalTranscript += `${chunk} `;
        } else {
          interim += result[0].transcript;
        }
      }
      this.onResult?.(this.finalTranscript, interim);
    };

    recognition.onerror = (event) => {
      // 'no-speech' e 'aborted' são esperados no uso normal; o restart
      // em onend cobre esses casos.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.listening = false;
        this.onStateChange?.(false);
        this.onError?.('mic-denied');
      } else if (event.error === 'network') {
        this.listening = false;
        this.onStateChange?.(false);
        this.onError?.('network');
      }
    };

    recognition.onend = () => {
      // Reinicia se o usuário ainda não pediu para parar.
      if (this.listening) {
        try {
          recognition.start();
        } catch {
          this._createRecognition(Recognition);
          this.recognition.start();
        }
      }
    };

    this.recognition = recognition;
  }
}
