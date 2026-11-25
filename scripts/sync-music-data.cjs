// Keep bundled PWA/Android music data in sync with canonical server data.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });
for (const name of ['ragas.json', 'alankars.json', 'theory.json']) {
  const source = path.join(root, 'data', name);
  const target = path.join(outDir, name);
  fs.copyFileSync(source, target);
  console.log(`synced public/data/${name}`);
}
