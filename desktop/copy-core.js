// Copia o núcleo do app web (raiz do repositório) para desktop/web,
// para que o app desktop seja autossuficiente ao empacotar.
// Roda automaticamente antes de `npm start` e `npm run dist`.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(__dirname, 'web');

const ITEMS = ['index.html', 'css', 'js', 'icons', 'manifest.webmanifest', 'sw.js'];

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });

for (const item of ITEMS) {
  const src = path.join(ROOT, item);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, path.join(DEST, item), { recursive: true });
}

console.log('Núcleo web copiado para desktop/web');
