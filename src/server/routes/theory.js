const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'data', 'theory.json'), 'utf-8'));
    res.json(raw);
  } catch {
    res.status(500).json({ error: 'Failed to load theory', code: 'THEORY_LOAD' });
  }
});

module.exports = router;
