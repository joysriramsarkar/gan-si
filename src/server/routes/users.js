const express = require('express');
const crypto = require('crypto');
const { getDb, hashToken } = require('../db');

const router = express.Router();

// Create a personal user + token. Body: {username}
// A username is a local display name, not proof of ownership. Existing names
// never mint another bearer token: only a caller already authenticated as that
// same user may repeat the request, and receives the same token it presented.
// Everyone else gets 409. BEGIN IMMEDIATE serializes first-use username claims
// without adding passwords, OAuth, or token-recovery dependencies.
router.post('/', (req, res, next) => {
  try {
    const username = String(req.body?.username || 'local').slice(0, 40).trim() || 'local';
    const db = getDb();
    let inTransaction = false;
    try {
      db.exec('BEGIN IMMEDIATE');
      inTransaction = true;
      let user = db.prepare('SELECT id, username FROM users WHERE username=?').get(username);
      if (user) {
        db.exec('COMMIT');
        inTransaction = false;
        if (req.authenticated && req.user.id === Number(user.id) && req.token) {
          return res.status(200).json({ user, token: req.token, note: 'Existing local session token reused; no new token was issued.' });
        }
        return res.status(409).json({
          error: 'Username already exists. Use the token originally issued for this local session.',
          code: 'USERNAME_TAKEN'
        });
      }

      const r = db.prepare('INSERT INTO users(username) VALUES (?)').run(username);
      user = { id: Number(r.lastInsertRowid), username };
      db.prepare('INSERT OR IGNORE INTO user_settings(user_id) VALUES (?)').run(user.id);
      const token = crypto.randomUUID();
      db.prepare('INSERT INTO api_tokens(token_hash, user_id) VALUES (?, ?)').run(hashToken(token), user.id);
      db.exec('COMMIT');
      inTransaction = false;
      res.status(201).json({ user, token, note: 'Tokenটি এই ডিভাইসে সংরক্ষণ করুন; সব API কলে Authorization: Bearer <token> পাঠান। সার্ভার টোকেনের হ্যাশ ছাড়া কিছু সংরক্ষণ করে না।' });
    } catch (e) {
      if (inTransaction) { try { db.exec('ROLLBACK'); } catch {} }
      throw e;
    }
  } catch (e) { next(e); }
});

// Logout: revoke the presented bearer token. Requires authentication — a
// missing or unknown token has nothing to revoke.
router.post('/logout', (req, res, next) => {
  try {
    if (!req.authenticated || !req.token) {
      return res.status(401).json({ error: 'Logout requires a valid bearer token', code: 'AUTH_REQUIRED' });
    }
    const db = getDb();
    const info = db.prepare('DELETE FROM api_tokens WHERE token_hash=? AND user_id=?').run(hashToken(req.token), req.user.id);
    if (info.changes === 0) {
      return res.status(401).json({ error: 'Token not found', code: 'INVALID_TOKEN' });
    }
    res.json({ message: 'Logged out; the token has been revoked and can no longer be used.', revoked: true });
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
