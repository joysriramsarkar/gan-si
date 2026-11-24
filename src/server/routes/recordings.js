/**
 * Recordings: strict MIME + magic-byte, server-generated names, authenticated stream.
 * Master Plan Sec 4.4 / P1-2. Auth stub: single local user (user_id=1); ownership column ready.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { MAX_UPLOAD_MB, UPLOAD_DIR, MAX_RECORDING_MIN } = require('../config');
const { ALLOWED_MIME_TYPES, isAllowedMime, extForMime, magicOk, safeBasename } = require('../lib/audio-validate');
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

router.post('/', upload.single('audio'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided', code: 'NO_FILE' });
    // Magic-byte verification (read first 16 bytes from disk)
    const fd = fs.openSync(req.file.path, 'r');
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    fs.closeSync(fd);
    if (!magicOk(head, req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return res.status(415).json({ error: 'File content does not match claimed audio type', code: 'MAGIC_MISMATCH' });
    }
    const db = getDb();
    const uid = req.userId || 1;
    db.prepare(`INSERT INTO recordings(user_id, filename, size, created_at) VALUES (?, ?, ?, datetime('now'))`)
      .run(uid, req.file.filename, req.file.size);
    res.status(201).json({
      message: 'Recording saved successfully',
      recording: {
        filename: req.file.filename,
        size: req.file.size,
        url: `/api/recordings/${encodeURIComponent(req.file.filename)}/stream`,
        createdAt: new Date().toISOString(),
        retention: `Server copy is optional backup; local IndexedDB remains primary. Max ${MAX_RECORDING_MIN} min / ${MAX_UPLOAD_MB} MB.`
      }
    });
  } catch (e) { next(e); }
});

router.get('/', (req, res, next) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    const recordings = files
      .filter(f => ['.webm', '.wav', '.mp3', '.ogg', '.m4a'].includes(path.extname(f).toLowerCase()))
      .map(filename => {
        const st = fs.statSync(path.join(UPLOAD_DIR, filename));
        return { filename, size: st.size, url: `/api/recordings/${encodeURIComponent(filename)}/stream`, createdAt: st.birthtime || st.mtime };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ count: recordings.length, recordings });
  } catch (e) { next(e); }
});

// Authenticated (stub) streaming with Range support + ownership check
router.get('/:filename/stream', (req, res) => {
  const safe = safeBasename(req.params.filename);
  const uid = req.userId || 1;
  try {
    const row = getDb().prepare('SELECT user_id FROM recordings WHERE filename=?').get(safe);
    if (row && row.user_id !== uid) return res.status(403).json({ error: 'Not your recording', code: 'FORBIDDEN' });
  } catch {}
  const target = path.join(UPLOAD_DIR, safe);
  if (!fs.existsSync(target)) return res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
  const stat = fs.statSync(target);
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
});

router.delete('/:filename', (req, res, next) => {
  try {
    const safe = safeBasename(req.params.filename);
    const uid = req.userId || 1;
    try {
      const row = getDb().prepare('SELECT user_id FROM recordings WHERE filename=?').get(safe);
      if (row && row.user_id !== uid) return res.status(403).json({ error: 'Not your recording', code: 'FORBIDDEN' });
    } catch {}
    const target = path.join(UPLOAD_DIR, safe);
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
    fs.unlinkSync(target);
    try { getDb().prepare('DELETE FROM recordings WHERE filename=?').run(safe); } catch {}
    res.json({ message: 'Recording deleted successfully' });
  } catch (e) { next(e); }
});

module.exports = router;
