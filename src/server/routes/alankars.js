const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const filePath = path.join(__dirname, '..', '..', '..', 'data', 'alankars.json');
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const list = Array.isArray(raw) ? raw : (raw.alankars || []);
    const { level, search } = req.query;
    let result = list;
    if (level) result = result.filter(a => (a.level || 'beginner') === level);
    if (search) result = result.filter(a => (a.title || '').includes(search) || (a.notes || '').includes(search));
    res.json({ count: result.length, alankars: result });
  } catch {
    res.status(500).json({ error: 'Failed to retrieve alankars', code: 'ALANKAR_LOAD' });
  }
});

module.exports = router;
