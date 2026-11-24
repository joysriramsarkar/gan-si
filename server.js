const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '25', 10);
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Allows Web Audio and local media streams
  crossOriginEmbedderPolicy: false
}));

// Rate limiting to prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

// Secure Multer storage with UUIDs and MIME validation
const allowedMimeTypes = ['audio/webm', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const randomUuid = crypto.randomUUID();
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `riyaz-${Date.now()}-${randomUuid}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file format'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/recordings-stream', express.static(UPLOAD_DIR));

// JSON data reader helper
const loadJsonData = (relativePath) => {
  const filePath = path.join(__dirname, relativePath);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return [];
};

/* ========================================================
 * REST API ENDPOINTS
 * ======================================================== */

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Sur Sadhana Pro',
    version: '1.1.0',
    timestamp: new Date().toISOString()
  });
});

// Classical Ragas API
app.get('/api/ragas', (req, res) => {
  try {
    const ragas = loadJsonData('data/ragas.json');
    const { thaat, search } = req.query;
    let result = ragas;

    if (thaat) {
      result = result.filter(r => r.thaat && r.thaat.toLowerCase().includes(thaat.toLowerCase()));
    }
    if (search) {
      result = result.filter(r =>
        (r.name && r.name.toLowerCase().includes(search.toLowerCase())) ||
        (r.id && r.id.toLowerCase().includes(search.toLowerCase()))
      );
    }
    res.json({ count: result.length, ragas: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve ragas data' });
  }
});

app.get('/api/ragas/:id', (req, res) => {
  const ragas = loadJsonData('data/ragas.json');
  const safeId = path.basename(req.params.id).toLowerCase();
  const found = ragas.find(r => r.id && r.id.toLowerCase() === safeId);
  if (found) {
    res.json(found);
  } else {
    res.status(404).json({ error: 'Raga not found' });
  }
});

// Alankars API
app.get('/api/alankars', (req, res) => {
  try {
    const alankars = loadJsonData('data/alankars.json');
    res.json({ count: alankars.length, alankars });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve alankars' });
  }
});

// Practice Stats API
app.get('/api/stats', (req, res) => {
  try {
    const stats = loadJsonData('data/stats.json');
    res.json(stats.totalMinutes !== undefined ? stats : {
      totalMinutes: 0,
      totalSessions: 0,
      currentStreak: 0,
      lastPracticedDate: null,
      history: []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

app.post('/api/stats/session', (req, res) => {
  try {
    const statsPath = path.join(__dirname, 'data', 'stats.json');
    let stats = {
      totalMinutes: 0,
      totalSessions: 0,
      currentStreak: 0,
      lastPracticedDate: null,
      history: []
    };

    if (fs.existsSync(statsPath)) {
      stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    }

    const { minutes, accuracy, alankar } = req.body;
    const sessionMins = Math.max(1, parseInt(minutes || 1, 10));
    const todayStr = new Date().toISOString().split('T')[0];

    if (stats.lastPracticedDate) {
      const lastDate = new Date(stats.lastPracticedDate);
      const today = new Date(todayStr);
      const diffDays = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        stats.currentStreak += 1;
      } else if (diffDays > 1) {
        stats.currentStreak = 1;
      }
    } else {
      stats.currentStreak = 1;
    }

    stats.lastPracticedDate = todayStr;
    stats.totalMinutes += sessionMins;
    stats.totalSessions += 1;

    stats.history.unshift({
      date: new Date().toISOString(),
      minutes: sessionMins,
      accuracy: accuracy || null,
      alankar: alankar || null
    });

    if (stats.history.length > 50) stats.history.pop();

    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    res.json({ message: 'Session logged', stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save session stats' });
  }
});

// Recordings API with Path Traversal Protection
app.post('/api/recordings', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const recordingMetadata = {
    filename: req.file.filename,
    size: req.file.size,
    url: `/recordings-stream/${req.file.filename}`,
    createdAt: new Date().toISOString()
  };

  res.status(201).json({
    message: 'Recording saved successfully',
    recording: recordingMetadata
  });
});

app.get('/api/recordings', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    const recordings = files
      .filter(f => f.endsWith('.webm') || f.endsWith('.wav') || f.endsWith('.mp3') || f.endsWith('.ogg'))
      .map(filename => {
        const stats = fs.statSync(path.join(UPLOAD_DIR, filename));
        return {
          filename,
          size: stats.size,
          url: `/recordings-stream/${filename}`,
          createdAt: stats.birthtime || stats.mtime
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ count: recordings.length, recordings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list recordings' });
  }
});

app.delete('/api/recordings/:filename', (req, res) => {
  // Prevent Path Traversal attacks with path.basename
  const safeFilename = path.basename(req.params.filename);
  const target = path.join(UPLOAD_DIR, safeFilename);

  if (fs.existsSync(target)) {
    try {
      fs.unlinkSync(target);
      res.json({ message: 'Recording deleted successfully' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to delete recording file' });
    }
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Fallback SPA route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Sur Sadhana Pro running at http://localhost:${PORT}`);
});
