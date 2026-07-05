# Ditado por Voz — Extensão do Chrome

Versão em extensão do app, para ditar por voz **direto em qualquer campo de texto** de qualquer site (Gmail, WhatsApp Web, Notion, etc.), com a mesma limpeza/formatação por IA.

## Como instalar (modo desenvolvedor)

1. Abra `chrome://extensions` no Chrome ou Edge.
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione esta pasta `extension/`.
4. Fixe o ícone 🎙️ na barra de ferramentas.

## Como usar

1. Clique no campo onde quer escrever (e-mail, post, mensagem…).
2. Clique no ícone da extensão e depois no microfone (ou configure a chave de API em ⚙️ na primeira vez).
3. Fale e clique de novo para parar. O texto é limpo/formatado.
4. Clique em **Inserir na página** para colocar o texto no último campo focado, ou **Copiar**.

## Notas

- Os módulos em `lib/` (`speech.js`, `ai.js`, `transform.js`) são cópias dos módulos do app web (`../js/`). Se editar o núcleo, copie novamente:
  ```bash
  cp ../js/speech.js ../js/ai.js ../js/transform.js lib/
  ```
- A chave de API é salva em `chrome.storage.local` (apenas neste navegador).
- A transcrição usa a Web Speech API (Chrome/Edge). O motor Whisper não está incluído nesta extensão.
