const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { CORS_ORIGIN, UPLOAD_DIR } = require('./config');
const { notFound, errorHandler } = require('./middleware/error');
const { auth } = require('./middleware/auth');

function createApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        mediaSrc: ["'self'", 'blob:', 'data:'],
        connectSrc: ["'self'", 'blob:', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:']
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  // CORS allowlist (empty = same-origin only in production; dev allows all if CORS_ORIGIN unset and NODE_ENV!=production)
  const allowAllDev = !CORS_ORIGIN.length && process.env.NODE_ENV !== 'production';
  app.use(cors(allowAllDev ? {} : { origin: CORS_ORIGIN }));

  const strictLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
  app.use('/api/', apiLimiter);
  app.use('/api/stats', strictLimiter);
  app.use('/api/recordings', strictLimiter);
  app.use('/api/', auth);

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    let db = 'ok';
    try { require('./db').getDb().prepare('SELECT 1').get(); } catch { db = 'error'; }
    res.json({ status: 'ok', app: 'Sur Sadhana Pro', version: '2.0.0', timestamp: new Date().toISOString(), db });
  });

  app.use('/api/ragas', require('./routes/ragas'));
  app.use('/api/alankars', require('./routes/alankars'));
  app.use('/api/theory', require('./routes/theory'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/stats', require('./routes/stats'));
  app.use('/api/recordings', require('./routes/recordings'));

  // Legacy compat: old public stream path redirects to authenticated stream
  app.get('/recordings-stream/:filename', (req, res) => {
    res.redirect(302, `/api/recordings/${encodeURIComponent(req.params.filename)}/stream`);
  });

  app.use(express.static(path.join(__dirname, '..', '..', 'public')));
  // NOTE: uploads no longer served statically (P1-2 security fix)

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return notFound(req, res);
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
