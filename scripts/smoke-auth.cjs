// Isolated auth smoke test: temporary DB/uploads, automatic cleanup.
const fs = require('fs');
const os = require('os');
const path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gansi-smoke-auth-'));
process.env.DB_PATH = path.join(tmp, 'smoke.sqlite');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');

const { createApp } = require('../src/server/app');
const { closeDb } = require('../src/server/db');
const app = createApp();
const s = app.listen(3104, async () => {
  try {
    const base = 'http://localhost:3104';
    const username = `smoke-${Date.now()}`;
    let r = await fetch(base + '/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    const u = await r.json();
    console.log('create-user', r.status, u.user.username, 'token:', !!u.token);
    if (!r.ok) throw new Error(u.error || 'user create failed');
    r = await fetch(base + '/api/stats/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.token }, body: JSON.stringify({ minutes: 7, accuracy: 77 }) });
    console.log('post-as-user', r.status);
    r = await fetch(base + '/api/stats', { headers: { Authorization: 'Bearer ' + u.token } });
    const st = await r.json();
    console.log('user-stats', 'sessions=' + st.totalSessions, 'minutes=' + st.totalMinutes);
    r = await fetch(base + '/api/users/me', { headers: { Authorization: 'Bearer ' + u.token } });
    console.log('me', r.status, JSON.stringify(await r.json()).slice(0, 80));
    r = await fetch(base + '/api/users/me', { headers: { Authorization: 'Bearer invalid-token' } });
    console.log('invalid-token', r.status, (await r.json()).code);
    if (r.status !== 401) process.exitCode = 1;
  } catch (e) { console.error('fail', e.message); process.exitCode = 1; }
  s.close(() => {
    closeDb();
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
});
