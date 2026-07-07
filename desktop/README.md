# Ditado por Voz — App Desktop 🖥️

O modo **Wispr Flow de verdade**: o app mora na bandeja do sistema. Aperte o atalho
em **qualquer aplicativo** (Word, WhatsApp, navegador, e-mail…), um pill flutuante
aparece na parte de baixo da tela, você fala — e ao apertar o atalho de novo o texto
é transcrito, formatado pela IA e **colado automaticamente onde você estava digitando**.

## Instalar (jeito fácil — instaladores prontos)

Os instaladores são gerados pelo GitHub Actions:

1. No GitHub, vá em **Actions → Build desktop installers → Run workflow**.
2. Ao terminar (~5 min), baixe na seção **Artifacts**:
   - `DitadoPorVoz-windows` → `DitadoPorVoz-Setup-1.0.0.exe`
   - `DitadoPorVoz-macos` → `DitadoPorVoz-1.0.0.dmg`
   - `DitadoPorVoz-linux` → `DitadoPorVoz-1.0.0.AppImage`
3. Instale e pronto — o ícone 🎙️ aparece na bandeja do sistema.

Para publicar uma **Release** com os instaladores anexados:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

## Rodar em desenvolvimento

```bash
cd desktop
npm install    # baixa Electron + electron-builder
npm start      # copia o núcleo web e abre o app
npm run dist   # gera o instalador do SEU sistema em desktop/dist/
```

## Primeiro uso

1. Na primeira execução, a janela de **Configurações** abre sozinha.
2. Cole sua **chave OpenAI** (transcrição Whisper — obrigatória no desktop).
3. Opcional: chave Anthropic/OpenAI para a **formatação por IA** e tom do texto.
4. Feche a janela. O app fica na bandeja.

## Fluxo de uso

| Ação | O que acontece |
|---|---|
| `Ctrl+Shift+Espaço` (configurável) | Pill aparece e começa a gravar 🎤 |
| Fale à vontade | Timer e barrinhas animadas mostram que está ouvindo |
| `Ctrl+Shift+Espaço` de novo | Transcreve → formata com IA → **cola no app ativo** |
| ✕ no pill | Cancela a gravação |
| ⚙ no pill / menu da bandeja | Abre as configurações |

O pill **não rouba o foco**: o cursor continua piscando no campo onde você estava,
e o texto entra lá via colagem simulada (`Ctrl+V`).

## Requisitos por sistema

- **Windows**: funciona direto (colagem via PowerShell/SendKeys).
- **macOS**: autorize o app em *Ajustes → Privacidade e Segurança → Acessibilidade*
  (necessário para simular o ⌘V).
- **Linux (X11)**: instale o `xdotool` (`sudo apt install xdotool`).
  Sem ele, o texto fica na área de transferência e você cola com `Ctrl+V`.

## Por que Whisper no desktop?

A Web Speech API (transcrição grátis do app web) depende de um serviço embutido
apenas no Chrome oficial — não existe dentro do Electron. Por isso o desktop grava
o áudio e transcreve com a API Whisper da OpenAI (centavos por minuto, muito precisa).

## Arquivos

```
main.js        processo principal: bandeja, atalho global, overlay, auto-colar
preload.js     ponte segura (IPC) entre main e janelas
overlay.*      o pill flutuante (gravação → transcrição → colagem)
settings.*     janela de configurações (chaves, atalho, comportamento)
copy-core.js   copia o núcleo web (../js, ../css…) para desktop/web
build/icon.png ícone do app (gera .ico/.icns no empacotamento)
```

As configurações ficam em um JSON no perfil do usuário (`userData/settings.json`),
separadas das do app web.
