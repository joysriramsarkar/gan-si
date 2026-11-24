const { createApp } = require('../src/server/app');
const app = createApp();
const s = app.listen(3104, async () => {
  try {
    const base = 'http://localhost:3104';
    let r = await fetch(base + '/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'smoke-tester' }) });
    const u = await r.json();
    console.log('create-user', r.status, u.user.username, 'token:', !!u.token);
    r = await fetch(base + '/api/stats/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + u.token }, body: JSON.stringify({ minutes: 7, accuracy: 77 }) });
    console.log('post-as-user', r.status);
    r = await fetch(base + '/api/stats', { headers: { Authorization: 'Bearer ' + u.token } });
    const st = await r.json();
    console.log('user-stats', 'sessions=' + st.totalSessions, 'minutes=' + st.totalMinutes);
    r = await fetch(base + '/api/users/me', { headers: { Authorization: 'Bearer ' + u.token } });
    console.log('me', r.status, JSON.stringify(await r.json()).slice(0, 80));
  } catch (e) { console.error('fail', e.message); process.exitCode = 1; }
  s.close();
});
