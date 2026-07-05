# Ditado por Voz — App Desktop (Electron)

Empacota o app web em uma janela nativa, com atalho global do sistema.

## Rodar em desenvolvimento

```bash
cd desktop
npm install      # baixa o Electron (~200 MB)
npm start
```

A janela carrega o app da raiz do repositório (`../index.html`).

## Atalho global

`Ctrl/Cmd + Shift + Espaço` traz a janela à frente de qualquer aplicativo.

## Importante: motor de transcrição

A **Web Speech API não funciona no Electron** (depende de um serviço do Google
embutido só no Chrome oficial). Por isso, no desktop use o motor **Whisper**:

1. Abra ⚙️ Configurações no app.
2. Em "Motor de transcrição", escolha **Whisper (OpenAI)**.
3. Informe sua chave OpenAI.

O Whisper grava o áudio e transcreve via API — funciona normalmente no Electron.

## Empacotar para distribuição

Para gerar instaladores (.exe/.dmg/.AppImage), adicione o
[electron-builder](https://www.electron.build/):

```bash
npm install --save-dev electron-builder
npx electron-builder
```
