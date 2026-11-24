const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage configuration for audio recordings
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = `riyaz-${timestamp}.webm`;
    cb(null, safeName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max recording
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/recordings-stream', express.static(UPLOAD_DIR));

// Load data files helper
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

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'সুর সাধনা Pro (Gan-si)',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 2. Classical Ragas API
app.get('/api/ragas', (req, res) => {
  try {
    const ragas = loadJsonData('data/ragas.json');
    const { thaat, search } = req.query;
    let result = ragas;

    if (thaat) {
      result = result.filter(r => r.thaat.toLowerCase().includes(thaat.toLowerCase()));
    }
    if (search) {
      result = result.filter(r => 
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.id.toLowerCase().includes(search.toLowerCase())
      );
    }
    res.json({ count: result.length, ragas: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve ragas data' });
  }
});

app.get('/api/ragas/:id', (req, res) => {
  const ragas = loadJsonData('data/ragas.json');
  const found = ragas.find(r => r.id.toLowerCase() === req.params.id.toLowerCase());
  if (found) {
    res.json(found);
  } else {
    res.status(404).json({ error: 'Raga not found' });
  }
});

// 3. Alankars API
app.get('/api/alankars', (req, res) => {
  try {
    const alankars = loadJsonData('data/alankars.json');
    res.json({ count: alankars.length, alankars });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve alankars' });
  }
});

// 4. Recordings API (Upload, List, Delete, Stream)
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
      .filter(f => f.endsWith('.webm') || f.endsWith('.wav') || f.endsWith('.mp3'))
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
  const target = path.join(UPLOAD_DIR, path.basename(req.params.filename));
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

// Fallback route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🎵 সুর সাধনা Pro (Gan-si) Node.js Server Running!`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`====================================================`);
});
