/**
 * Minimal token auth (Phase 4). Bearer token -> req.userId, default 1 (local).
 * Tokens issued via POST /api/users. No password — single-device personal use;
 * multi-device = same token. Full session/OAuth deferred to PostgreSQL phase.
 */
function auth(req, res, next) {
  req.userId = 1;
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) {
    try {
      const { getDb } = require('../db');
      const row = getDb().prepare('SELECT user_id FROM api_tokens WHERE token=?').get(m[1].trim());
      if (row) req.userId = row.user_id;
    } catch {}
  }
  next();
}

module.exports = { auth };
