const { getDb } = require('../src/server/db');
const db = getDb();
const u = db.prepare("SELECT id FROM users WHERE username='smoke-tester'").get();
if (u) {
  db.prepare('DELETE FROM practice_sessions WHERE user_id=?').run(u.id);
  db.prepare('DELETE FROM api_tokens WHERE user_id=?').run(u.id);
  db.prepare('DELETE FROM user_settings WHERE user_id=?').run(u.id);
  db.prepare('DELETE FROM users WHERE id=?').run(u.id);
  console.log('removed smoke-tester id', u.id);
} else console.log('nothing to clean');
console.log('users:', JSON.stringify(db.prepare('SELECT id, username FROM users').all()));
