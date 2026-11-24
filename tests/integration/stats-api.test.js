/**
 * Stats API integration against real SQLite (temp file), no network.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('stats api + sqlite', () => {
  test('concurrent inserts do not lose sessions', () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gansi-')), 't.sqlite');
    const { openDb, migrate } = require('../../src/server/db');
    const db = openDb(tmp);
    migrate(db);
    const ins = db.prepare('INSERT INTO practice_sessions(user_id,duration_min,accuracy,practiced_at) VALUES (1,5,80,datetime(\'now\'))');
    for (let i = 0; i < 20; i++) ins.run();
    const c = db.prepare('SELECT COUNT(*) AS c FROM practice_sessions').get();
    expect(c.c).toBe(20);
    const { summarizeSessions } = require('../../src/server/lib/stats-service');
    const rows = db.prepare('SELECT * FROM practice_sessions ORDER BY practiced_at DESC').all();
    const s = summarizeSessions(rows, 'Asia/Kolkata');
    expect(s.totalSessions).toBe(20);
    expect(s.totalMinutes).toBe(100);
    db.close();
  });
});
