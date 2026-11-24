const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '25', 10);
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const DB_PATH = path.resolve(process.env.DB_PATH || './data/gansi.sqlite');
const CORS_ORIGIN = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
const TZ = process.env.TZ || 'Asia/Kolkata';
const MAX_RECORDING_MIN = parseInt(process.env.MAX_RECORDING_MIN || '15', 10);

module.exports = { PORT, MAX_UPLOAD_MB, UPLOAD_DIR, DB_PATH, CORS_ORIGIN, TZ, MAX_RECORDING_MIN };
