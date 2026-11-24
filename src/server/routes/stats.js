const express = require('express');
const { getDb } = require('../db');
const { TZ } = require('../config');
const { summarizeSessions, validateSession } = require('../lib/stats-service');

const router = express.Router();

// GET /api/stats?range=7d|30d|all
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const uid = req.userId || 1;
    const range = req.query.range || 'all';
    let since = null;
    if (range === '7d') since = `datetime('now','-7 days')`;
    else if (range === '30d') since = `datetime('now','-30 days')`;
    const rows = since
      ? db.prepare(`SELECT * FROM practice_sessions WHERE user_id=? AND practiced_at >= ${since} ORDER BY practiced_at DESC LIMIT 500`).all(uid)
      : db.prepare(`SELECT * FROM practice_sessions WHERE user_id=? ORDER BY practiced_at DESC LIMIT 500`).all(uid);
    res.json(summarizeSessions(rows, TZ));
  } catch (e) { next(e); }
});

router.post('/session', (req, res, next) => {
  try {
    const { errors, value } = validateSession(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join('; '), code: 'VALIDATION' });
    const db = getDb();
    const uid = req.userId || 1;
    db.prepare(
      `INSERT INTO practice_sessions(user_id, duration_min, accuracy, raga_id, alankar_id, practiced_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uid, value.minutes, value.accuracy, value.raga_id, value.alankar_id, new Date().toISOString());
    const rows = db.prepare(`SELECT * FROM practice_sessions WHERE user_id=? ORDER BY practiced_at DESC LIMIT 500`).all(uid);
    res.json({ message: 'Session logged', stats: summarizeSessions(rows, TZ) });
  } catch (e) { next(e); }
});

module.exports = router;
