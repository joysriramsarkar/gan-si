/* Vercel build step: mark the deployed bundle as static-only.
   No backend exists there, so the frontend must use bundled /data/*.json
   directly instead of probing /api/* (which would log 404 console errors). */
const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', 'public', 'static-mode.js');
fs.writeFileSync(file, [
  '/* Vercel static build: no backend API; use bundled music data. */',
  'window.GANSI_STATIC_MODE = true;',
  ''
].join('\n'));
console.log('marked static mode (GANSI_STATIC_MODE = true)');
