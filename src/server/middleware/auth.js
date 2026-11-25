/**
 * Bearer token auth. Bearer token -> req.user; no header -> local user 1.
 * Tokens are issued via POST /api/users and stored only as a sha256 hash.
 * This is a single-device local-first app, so missing credentials retain the
 * local fallback. Supplied credentials, however, must be a known bearer
 * token and never fall back to user 1.
 */
function invalidToken(res) {
  res.set('WWW-Authenticate', 'Bearer');
  return res.status(401).json({ error: 'Invalid or unknown bearer token', code: 'INVALID_TOKEN' });
}

function auth(req, res, next) {
  req.userId = 1;
  req.user = { id: 1 };
  req.authenticated = false;

  const header = req.headers.authorization;
  if (header == null || String(header).trim() === '') return next();

  const match = String(header).match(/^Bearer\s+(\S+)\s*$/i);
  if (!match) return invalidToken(res);

  try {
    const { getDb, hashToken } = require('../db');
    const row = getDb().prepare('SELECT user_id FROM api_tokens WHERE token_hash=?').get(hashToken(match[1]));
    if (!row) return invalidToken(res);
    req.userId = Number(row.user_id);
    req.user = { id: req.userId };
    req.authenticated = true;
    req.token = match[1];
  } catch (e) {
    return next(e);
  }
  next();
}

module.exports = { auth };
