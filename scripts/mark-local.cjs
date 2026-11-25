/* Local / self-hosted build: restore backend mode. Runs from `sync:data`,
   which every local, dev and Android build invokes, so a previous Vercel-style
   static marking can never leak into a backend deployment. */
const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', 'public', 'static-mode.js');
fs.writeFileSync(file, [
  '/* Local / self-hosted build: a full Express + SQLite backend is available.',
  '   The Vercel build (scripts/mark-static.cjs) overwrites this file to true,',
  '   so the frontend never makes an /api/* request on a static-only host. */',
  'window.GANSI_STATIC_MODE = false;',
  ''
].join('\n'));
console.log('marked local mode (GANSI_STATIC_MODE = false)');
