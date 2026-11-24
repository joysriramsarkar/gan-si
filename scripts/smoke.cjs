const { createApp } = require('../src/server/app');
const app = createApp();
const s = app.listen(3103, async () => {
  try {
    for (const p of ['/api/health', '/api/ragas', '/api/alankars', '/api/theory', '/api/stats', '/api/recordings']) {
      const r = await fetch('http://localhost:3103' + p);
      const t = await r.text();
      console.log(p, r.status, t.slice(0, 120).replace(/\n/g, ' '));
    }
  } catch (e) { console.error('smoke fail', e.message); process.exitCode = 1; }
  s.close();
});
