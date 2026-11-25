const Ear = require('../../public/js/practice/ear-training');
const Tanpura = require('../../public/js/audio/tanpura');
const Tabla = require('../../public/js/audio/tabla');

describe('ear training', () => {
  test('pickTarget stays in pool, deterministic with seeded rand', () => {
    const seq = () => 0.5;
    const t = Ear.pickTarget(['সা', 'গা', 'পা'], seq);
    expect(['সা', 'গা', 'পা']).toContain(t.swara);
    expect(Ear.checkAnswer('গা', 'গা')).toBe(true);
    expect(Ear.checkAnswer('গা', 'মা')).toBe(false);
  });
  test('interval names cover saptak', () => {
    expect(Ear.INTERVAL_NAMES[7]).toMatch(/পঞ্চম/);
    expect(Ear.INTERVAL_NAMES[12]).toMatch(/সাঁ/);
  });
});

describe('tanpura theory', () => {
  test('4 tunings with correct string-1 intervals', () => {
    expect(Tanpura.TUNINGS.map(t => t.string1Interval)).toEqual([7, 5, 11, 9]);
    const s = Tanpura.stringIntervals(10, 1);
    expect(s).toHaveLength(4);
    expect(s[0].interval).toBe(5);
  });
});

describe('auth middleware defaults + users flow', () => {
  test('no token -> userId 1', () => {
    const { auth } = require('../../src/server/middleware/auth');
    const req = { headers: {} };
    auth(req, {}, () => {});
    expect(req.userId).toBe(1);
  });
  test('user create + token lookup in temp db', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gansi-')), 'u.sqlite');
    const { openDb, migrate, hashToken } = require('../../src/server/db');
    const db = openDb(tmp);
    migrate(db);
    const r = db.prepare('INSERT INTO users(username) VALUES (?)').run('tester');
    const uid = Number(r.lastInsertRowid);
    db.prepare('INSERT INTO api_tokens(token_hash, user_id) VALUES (?,?)').run(hashToken('tok-123'), uid);
    const row = db.prepare('SELECT user_id FROM api_tokens WHERE token_hash=?').get(hashToken('tok-123'));
    expect(row.user_id).toBe(uid);
    db.close();
  });
});
