const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');
const { safeBasename } = require('../lib/audio-validate');

const router = express.Router();

function loadJsonData(relativePath) {
  const filePath = path.join(__dirname, '..', '..', '..', relativePath);
  if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return [];
}

router.get('/', (req, res) => {
  try {
    const ragas = loadJsonData('data/ragas.json');
    const { thaat, search } = req.query;
    let result = Array.isArray(ragas) ? ragas : (ragas.ragas || []);
    if (thaat) result = result.filter(r => r.thaat && r.thaat.includes(thaat));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => (r.name && r.name.toLowerCase().includes(q)) || (r.id && r.id.toLowerCase().includes(q)));
    }
    res.json({ count: result.length, ragas: result });
  } catch {
    res.status(500).json({ error: 'Failed to retrieve ragas data', code: 'RAGA_LOAD' });
  }
});

router.get('/:id', (req, res) => {
  const ragas = loadJsonData('data/ragas.json');
  const list = Array.isArray(ragas) ? ragas : (ragas.ragas || []);
  const safeId = safeBasename(req.params.id).toLowerCase();
  const found = list.find(r => r.id && r.id.toLowerCase() === safeId);
  if (found) res.json(found);
  else res.status(404).json({ error: 'Raga not found', code: 'NOT_FOUND' });
});

module.exports = router;
