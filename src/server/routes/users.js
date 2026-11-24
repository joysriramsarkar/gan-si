const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');

const router = express.Router();

// Create (or fetch) a personal user + token. Body: {username}
router.post('/', (req, res, next) => {
  try {
    const username = String(req.body?.username || 'local').slice(0, 40).trim() || 'local';
    const db = getDb();
    let user = db.prepare('SELECT id, username FROM users WHERE username=?').get(username);
    if (!user) {
      const r = db.prepare('INSERT INTO users(username) VALUES (?)').run(username);
      user = { id: r.lastInsertRowid, username };
      db.prepare('INSERT OR IGNORE INTO user_settings(user_id) VALUES (?)').run(user.id);
    }
    const token = crypto.randomUUID();
    db.prepare('INSERT INTO api_tokens(token, user_id) VALUES (?, ?)').run(token, user.id);
    res.status(201).json({ user, token, note: 'Tokenটি এই ডিভাইসে সংরক্ষণ করুন; সব API কলে Authorization: Bearer <token> পাঠান।' });
  } catch (e) { next(e); }
});

router.get('/me', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, username, created_at FROM users WHERE id=?').get(req.userId || 1);
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Failed to load user', code: 'USER_LOAD' });
  }
});

module.exports = router;
