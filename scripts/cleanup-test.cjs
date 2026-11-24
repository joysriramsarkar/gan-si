const { getDb } = require('../src/server/db');
const db = getDb();
const r = db.prepare("DELETE FROM practice_sessions WHERE practiced_at LIKE '2026-11-24 12:%'").run();
console.log('cleaned', r.changes);
console.log(JSON.stringify(db.prepare('SELECT COUNT(*) AS c FROM practice_sessions').get()));
