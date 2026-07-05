# 🎙️ Ditado por Voz

App de ditado por voz inspirado no [Wispr Flow](https://wisprflow.ai): você fala, o app transcreve em tempo real e uma IA limpa e formata o texto (remove "ééé", "tipo", corrige pontuação, formata listas) — pronto para copiar, compartilhar ou inserir em qualquer campo.

Disponível em **três formatos** que compartilham o mesmo núcleo:

| Formato | Onde roda | Destaque |
|---|---|---|
| **App web / PWA** (raiz) | Chrome/Edge, desktop e celular | Instalável, funciona offline (menos a IA) |
| **Extensão do Chrome** (`extension/`) | Qualquer site | Insere o texto direto no campo focado |
| **App desktop** (`desktop/`) | Windows/macOS/Linux (Electron) | Atalho global do sistema |

## Funcionalidades

- **Transcrição em tempo real** com a Web Speech API (grátis, sem chave), em português do Brasil por padrão — e vários outros idiomas.
- **Motor Whisper (OpenAI)** opcional: transcrição mais precisa, boa com ruído, e funciona onde a Web Speech não vai (Firefox, Electron).
- **Formatação por IA** ao parar a gravação, via API da Anthropic (Claude) ou OpenAI, com a sua chave.
- **Tradução no ditado**: fale em um idioma e receba o texto em outro.
- **Modos de tom**: Natural, E-mail, Mensagem e Anotações.
- **Comandos de voz de pontuação**: "vírgula", "ponto", "nova linha", "novo parágrafo", "abre aspas", "apagar última frase", "apagar tudo"…
- **Dicionário pessoal**: cadastre nomes/termos e correções ("guéri clas => Gericlass").
- **Snippets**: gatilhos de voz que viram texto completo ("minha assinatura" → bloco de assinatura).
- **Histórico** com busca, itens fixados (⭐) e exportação em `.txt`/`.md`.
- **Estatísticas**: dictações, palavras, tempo economizado e sequência de dias.
- **Tema claro/escuro**, atalho `Ctrl+Espaço`, copiar/compartilhar com um clique (Web Share API) e copiar automático.

## Como usar (app web)

1. Abra no **Google Chrome** ou **Microsoft Edge** (a Web Speech API não funciona no Firefox — nesse caso, use o Whisper).
2. Clique no microfone (ou `Ctrl+Espaço`) e permita o acesso ao microfone.
3. Fale naturalmente. Clique de novo para parar.
4. O texto formatado aparece na tela — **Copiar** ou **Compartilhar**.

### Configurar a formatação por IA

Clique em ⚙️ **Configurações**, escolha o provedor e cole sua chave:

- Anthropic: [console.anthropic.com](https://console.anthropic.com/settings/keys)
- OpenAI: [platform.openai.com](https://platform.openai.com/api-keys)

A chave fica armazenada **apenas no seu navegador** (localStorage) e é enviada somente ao provedor escolhido. Sem chave, o app funciona só com a transcrição bruta (+ comandos de voz, snippets e dicionário locais).

## Rodando localmente

O app web é 100% estático — sem build nem dependências. O microfone exige **HTTPS ou localhost**:

```bash
python3 -m http.server 8000
# abra http://localhost:8000 no Chrome
```

## Publicando (Vercel / Netlify / GitHub Pages)

Por ser estático, é só apontar o serviço para o repositório, **sem comando de build** e com diretório de saída `/` (raiz):

- **Vercel**: [vercel.com/new](https://vercel.com/new) → importe o repositório → Deploy.
- **Netlify / Cloudflare Pages**: mesmo processo, sem build command.
- **GitHub Pages**: Settings → Pages → deploy da branch (raiz).

O `vercel.json` já está incluído para servir os arquivos estáticos corretamente.

## Estrutura

```
index.html                app web (PWA)
css/styles.css            visual (temas claro/escuro, responsivo)
js/app.js                 orquestração e estado da UI
js/speech.js              Web Speech API (tempo real)
js/whisper.js             motor Whisper (OpenAI)
js/ai.js                  formatação/tradução (Anthropic/OpenAI)
js/transform.js           comandos de voz, snippets, dicionário (local)
js/stats.js               estatísticas de uso
js/storage.js             configurações, histórico, dicionário, snippets, stats
js/pwa.js                 service worker + instalação
manifest.webmanifest      metadados PWA
sw.js                     cache offline do app shell
icons/                    ícones do PWA
extension/                extensão do Chrome (MV3) — ver extension/README.md
desktop/                  app Electron — ver desktop/README.md
```

## Privacidade

- O áudio da Web Speech API é processado pelo mecanismo do navegador; com o Whisper, o áudio vai para a OpenAI.
- O texto só é enviado ao provedor de IA que você configurar, e apenas quando a formatação está ativa.
- Chaves de API e histórico ficam **somente no seu dispositivo**. Use chaves com limite de gasto.

## Limitações conhecidas

- A Web Speech API requer navegador baseado em Chromium e conexão com a internet.
- Chamadas de IA direto do navegador expõem a chave a quem tiver acesso ao seu dispositivo.
- No Electron, use o motor Whisper (a Web Speech API não funciona lá).
