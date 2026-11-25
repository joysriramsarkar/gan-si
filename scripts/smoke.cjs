// Isolated API smoke test: never touches the developer's real SQLite/uploads.
const fs = require('fs');
const os = require('os');
const path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gansi-smoke-'));
process.env.DB_PATH = path.join(tmp, 'smoke.sqlite');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');

const { createApp } = require('../src/server/app');
const { closeDb } = require('../src/server/db');
const app = createApp();
const s = app.listen(3103, async () => {
  try {
    for (const p of ['/api/health', '/api/ragas', '/api/alankars', '/api/theory', '/api/stats', '/api/recordings']) {
      const r = await fetch('http://localhost:3103' + p);
      const t = await r.text();
      console.log(p, r.status, t.slice(0, 120).replace(/\n/g, ' '));
      if (!r.ok) process.exitCode = 1;
    }
  } catch (e) { console.error('smoke fail', e.message); process.exitCode = 1; }
  s.close(() => {
    closeDb();
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
});
