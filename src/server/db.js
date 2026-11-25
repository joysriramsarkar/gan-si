/**
 * SQLite storage (node:sqlite, zero extra dep) — WAL mode.
 * Tables: users, practice_sessions, recordings, user_settings
 * Master Plan Sec 4.3
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH } = require('./config');

// Bearer tokens are never stored raw: only this sha256 hex is persisted, so a
// leaked database file does not leak usable credentials. The client keeps the
// raw token and the server re-hashes it on every lookup.
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

let db = null;

function openDb(dbPath = DB_PATH) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const database = new DatabaseSync(dbPath);
  database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  return database;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS practice_sessions(
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
      duration_min INTEGER NOT NULL CHECK(duration_min BETWEEN 1 AND 180),
      accuracy INTEGER CHECK(accuracy BETWEEN 0 AND 100),
      raga_id TEXT,
      alankar_id INTEGER,
      practiced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON practice_sessions(user_id, practiced_at);
    CREATE TABLE IF NOT EXISTS recordings(
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id),
      filename TEXT NOT NULL UNIQUE,
      size INTEGER NOT NULL,
      duration_sec INTEGER,
      raga_id TEXT,
      alankar_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_settings(
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      preferred_scale INTEGER DEFAULT 10,
      preferred_tuning TEXT DEFAULT 'just_intonation',
      theme TEXT DEFAULT 'dark'
    );
    CREATE TABLE IF NOT EXISTS api_tokens(
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  // Default single user (multi-user ready, Phase 4 will add auth)
  database.prepare(`INSERT OR IGNORE INTO users(id, username) VALUES (1, 'local')`).run();
  database.prepare(`INSERT OR IGNORE INTO user_settings(user_id) VALUES (1)`).run();
}

// One-time migration: older databases stored bearer tokens in plaintext.
// Existing raw tokens are hashed in place; the client still holds the raw
// value, so every issued session keeps working unchanged.
function migrateApiTokens(database) {
  const cols = database.prepare('PRAGMA table_info(api_tokens)').all().map(c => c.name);
  if (cols.includes('token_hash')) return;
  database.exec(`
    CREATE TABLE api_tokens_new(
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  const rows = database.prepare('SELECT token, user_id, created_at FROM api_tokens').all();
  const ins = database.prepare('INSERT OR REPLACE INTO api_tokens_new(token_hash, user_id, created_at) VALUES (?, ?, ?)');
  for (const r of rows) ins.run(hashToken(r.token), r.user_id, r.created_at);
  database.exec('DROP TABLE api_tokens; ALTER TABLE api_tokens_new RENAME TO api_tokens;');
}

function getDb() {
  if (!db) {
    db = openDb();
    migrate(db);
    migrateApiTokens(db);
    migrateStatsJson(db);
  }
  return db;
}

// One-time import: data/stats.json -> practice_sessions
function migrateStatsJson(database) {
  try {
    const statsPath = path.join(__dirname, '..', '..', 'data', 'stats.json');
    if (!fs.existsSync(statsPath)) return;
    const count = database.prepare('SELECT COUNT(*) AS c FROM practice_sessions WHERE user_id=1').get();
    if (count && count.c > 0) return; // already migrated
    const raw = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    const history = Array.isArray(raw.history) ? raw.history : [];
    const ins = database.prepare(
      `INSERT INTO practice_sessions(user_id, duration_min, accuracy, raga_id, alankar_id, practiced_at)
       VALUES (1, ?, ?, ?, ?, ?)`
    );
    for (const h of history.slice(0, 50)) {
      const mins = Math.max(1, Math.min(180, parseInt(h.minutes ?? h.duration ?? 1, 10) || 1));
      const acc = h.accuracy != null ? Math.max(0, Math.min(100, parseInt(h.accuracy, 10))) : null;
      const at = h.date || new Date().toISOString();
      ins.run(mins, acc, h.raga || h.raga_id || null, h.alankar ? String(h.alankar).slice(0, 40) : null, at);
    }
  } catch (e) {
    console.warn('[db] stats.json migration skipped:', e.message);
  }
}

function closeDb() {
  if (db) { try { db.close(); } catch {} db = null; }
}

module.exports = { openDb, migrate, getDb, closeDb, migrateStatsJson, migrateApiTokens, hashToken };
