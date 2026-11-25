/**
 * Recordings: strict MIME + magic-byte, server-generated names, owner-scoped stream.
 * Master Plan Sec 4.4 / P1-2. Auth supplies req.user; missing credentials use local user 1.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { MAX_UPLOAD_MB, UPLOAD_DIR, MAX_RECORDING_MIN } = require('../config');
const { ALLOWED_MIME_TYPES, isAllowedMime, extForMime, magicOk, safeBasename } = require('../lib/audio-validate');
const { probeDurationSec } = require('../lib/audio-duration');
const { getDb } = require('../db');

const router = express.Router();

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = extForMime(file.mimetype); // never trust client ext
    cb(null, `riyaz-${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (isAllowedMime(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error(`Unsupported audio type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`), { status: 415, code: 'MIME' }));
  }
});

// A file without an ownership row cannot be verified and is treated as missing.
// Database errors propagate to the error handler rather than bypassing ownership.
function rejectUnownedRecording(filename, uid, res) {
  const row = getDb().prepare('SELECT user_id FROM recordings WHERE filename=?').get(filename);
  if (!row) {
    res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
    return true;
  }
  if (Number(row.user_id) !== uid) {
    res.status(403).json({ error: 'Not your recording', code: 'FORBIDDEN' });
    return true;
  }
  return false;
}

router.post('/', upload.single('audio'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided', code: 'NO_FILE' });
    // Magic-byte verification (read first 16 bytes from disk)
    const fd = fs.openSync(req.file.path, 'r');
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    if (!magicOk(head, req.file.mimetype)) {
      fs.closeSync(fd);
      fs.unlink(req.file.path, () => {});
      return res.status(415).json({ error: 'File content does not match claimed audio type', code: 'MAGIC_MISMATCH' });
    }
    // Real duration enforcement (MAX_RECORDING_MIN). WAV and WebM carry the
    // duration in their container headers; other accepted formats are bounded
    // by the byte-size cap only and stored with duration_sec NULL.
    const PROBE_BYTES = 1024 * 1024;
    const probe = Buffer.alloc(Math.min(PROBE_BYTES, req.file.size));
    fs.readSync(fd, probe, 0, probe.length, 0);
    fs.closeSync(fd);
    const durationSec = probeDurationSec(probe, req.file.mimetype);
    if (durationSec != null && durationSec > MAX_RECORDING_MIN * 60) {
      fs.unlink(req.file.path, () => {});
      return res.status(413).json({
        error: `Recording is too long: ${Math.round(durationSec / 60)} min (limit ${MAX_RECORDING_MIN} min)`,
        code: 'DURATION_LIMIT'
      });
    }
    const db = getDb();
    const uid = req.user.id;
    db.prepare(`INSERT INTO recordings(user_id, filename, size, duration_sec, created_at) VALUES (?, ?, ?, ?, datetime('now'))`)
      .run(uid, req.file.filename, req.file.size, durationSec == null ? null : Math.round(durationSec));
    res.status(201).json({
      message: 'Recording saved successfully',
      recording: {
        filename: req.file.filename,
        size: req.file.size,
        durationSec: durationSec == null ? null : Math.round(durationSec),
        url: `/api/recordings/${encodeURIComponent(req.file.filename)}/stream`,
        createdAt: new Date().toISOString(),
        retention: `Server copy is optional backup; local IndexedDB remains primary. Max ${MAX_RECORDING_MIN} min / ${MAX_UPLOAD_MB} MB.`
      }
    });
  } catch (e) { next(e); }
});

router.get('/', (req, res, next) => {
  try {
    const uid = req.user.id;
    // Query ownership rows instead of scanning the shared upload directory,
    // which would expose filenames belonging to other users (and stale files).
    const rows = getDb().prepare(
      'SELECT filename FROM recordings WHERE user_id=? ORDER BY created_at DESC, id DESC'
    ).all(uid);
    const recordings = rows.flatMap(row => {
      const target = path.join(UPLOAD_DIR, row.filename);
      if (!fs.existsSync(target)) return [];
      const st = fs.statSync(target);
      if (!st.isFile()) return [];
      return [{
        filename: row.filename,
        size: st.size,
        url: `/api/recordings/${encodeURIComponent(row.filename)}/stream`,
        createdAt: st.birthtime || st.mtime
      }];
    });
    res.json({ count: recordings.length, recordings });
  } catch (e) { next(e); }
});

// Streaming with Range support + verified recording ownership.
router.get('/:filename/stream', (req, res, next) => {
  try {
    const safe = safeBasename(req.params.filename);
    const uid = req.user.id;
    if (rejectUnownedRecording(safe, uid, res)) return;
    const target = path.join(UPLOAD_DIR, safe);
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
    const stat = fs.statSync(target);
    if (!stat.isFile()) return res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
    const range = req.headers.range;
    const contentType = { '.webm': 'audio/webm', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' }[path.extname(safe).toLowerCase()] || 'audio/webm';
    if (range) {
      const [s, e] = range.replace(/bytes=/, '').split('-').map(Number);
      const start = Number.isFinite(s) ? s : 0;
      const end = Number.isFinite(e) ? e : stat.size - 1;
      res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': contentType });
      fs.createReadStream(target, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': contentType, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(target).pipe(res);
    }
  } catch (e) { next(e); }
});

router.delete('/:filename', (req, res, next) => {
  try {
    const safe = safeBasename(req.params.filename);
    const uid = req.user.id;
    if (rejectUnownedRecording(safe, uid, res)) return;
    const target = path.join(UPLOAD_DIR, safe);
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
    fs.unlinkSync(target);
    getDb().prepare('DELETE FROM recordings WHERE filename=? AND user_id=?').run(safe, uid);
    res.json({ message: 'Recording deleted successfully' });
  } catch (e) { next(e); }
});

module.exports = router;
