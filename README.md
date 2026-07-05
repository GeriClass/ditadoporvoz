# 🎙️ Ditado por Voz

App web de ditado por voz inspirado no [Wispr Flow](https://wisprflow.ai): você fala, o app transcreve em tempo real e uma IA limpa e formata o texto (remove "ééé", "tipo", corrige pontuação, formata listas) — pronto para copiar e colar onde quiser.

## Funcionalidades

- **Transcrição em tempo real** com a Web Speech API (grátis, sem chave), em português do Brasil por padrão — com suporte a outros idiomas.
- **Formatação por IA**: ao parar a gravação, o texto bruto é limpo e formatado pela API da Anthropic (Claude) ou da OpenAI, usando a sua chave.
- **Modos de tom**: Natural, E-mail, Mensagem e Anotações.
- **Atalho de teclado**: `Ctrl+Espaço` inicia/para o ditado.
- **Histórico** das últimas 50 dictações, salvo no navegador.
- **Copiar com um clique** (ou automaticamente, se ativado nas configurações).
- Compare o **texto bruto vs. formatado** com um toggle.

## Como usar

1. Abra o app no **Google Chrome** ou **Microsoft Edge** (a Web Speech API não funciona no Firefox).
2. Clique no microfone (ou `Ctrl+Espaço`) e permita o acesso ao microfone.
3. Fale naturalmente. Clique de novo para parar.
4. O texto formatado aparece na tela — clique em **Copiar** e cole onde quiser.

### Configurar a formatação por IA

1. Clique em ⚙️ **Configurações**.
2. Escolha o provedor: **Anthropic (Claude)** ou **OpenAI (GPT)**.
3. Cole sua chave de API:
   - Anthropic: [console.anthropic.com](https://console.anthropic.com/settings/keys)
   - OpenAI: [platform.openai.com](https://platform.openai.com/api-keys)
4. Salve. A chave fica armazenada **apenas no seu navegador** (localStorage) e é enviada somente ao provedor escolhido.

Sem chave configurada, o app continua funcionando só com a transcrição bruta.

## Rodando localmente

O app é 100% estático — não há build nem dependências. O microfone exige **HTTPS ou localhost**:

```bash
# qualquer servidor estático serve, por exemplo:
python3 -m http.server 8000
# depois abra http://localhost:8000
```

## Publicando

Por ser estático, é só hospedar os arquivos em qualquer serviço com HTTPS:

- **GitHub Pages**: Settings → Pages → deploy da branch principal (raiz).
- **Netlify / Vercel / Cloudflare Pages**: aponte para o repositório, sem comando de build, diretório de saída `/`.

## Estrutura

```
index.html          # página única do app
css/styles.css      # visual (tema escuro, responsivo)
js/app.js           # orquestração e estado da UI
js/speech.js        # wrapper da Web Speech API
js/ai.js            # clientes Anthropic/OpenAI para formatação
js/storage.js       # configurações + histórico em localStorage
```

## Limitações conhecidas

- A Web Speech API requer navegador baseado em Chromium e conexão com a internet (o reconhecimento roda nos servidores do navegador).
- Chamadas de IA direto do navegador expõem a chave a quem tiver acesso ao seu dispositivo/navegador — use uma chave com limite de gasto.
