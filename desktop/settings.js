// Janela de configurações do app desktop (usa a ponte window.ditado).

const $ = (id) => document.getElementById(id);
const FIELDS = ['whisperKey', 'lang', 'voiceCommands', 'aiEnabled', 'provider', 'apiKey', 'tone', 'hotkey', 'autoPaste', 'openAtLogin'];

async function load() {
  const s = await window.ditado.getSettings();
  for (const f of FIELDS) {
    const el = $(f);
    if (el.type === 'checkbox') el.checked = Boolean(s[f]);
    else el.value = s[f];
  }
  if (window.ditado.platform === 'linux') $('linux-hint').style.display = 'block';
  if (window.ditado.platform === 'darwin') $('mac-hint').style.display = 'block';
}

async function save() {
  const patch = {};
  for (const f of FIELDS) {
    const el = $(f);
    patch[f] = el.type === 'checkbox' ? el.checked : el.value.trim ? el.value.trim() : el.value;
  }
  await window.ditado.saveSettings(patch);
  $('saved').textContent = '✓ Salvo! Já pode usar o atalho em qualquer app.';
  setTimeout(() => ($('saved').textContent = ''), 3000);
}

$('save').addEventListener('click', save);
$('link-openai').addEventListener('click', (e) => {
  e.preventDefault();
  window.ditado.openExternal('https://platform.openai.com/api-keys');
});

load();
