/**
 * Audio upload validation: strict allowlist + magic-byte sniffing.
 * Master Plan Sec 4.4 / P1-2
 */
const ALLOWED = new Map([
  ['audio/webm', { ext: '.webm', magic: [Buffer.from([0x1a, 0x45, 0xdf, 0xa3])] }],
  ['audio/wav', { ext: '.wav', magic: [Buffer.from('RIFF'), Buffer.from('RIFX')] }],
  ['audio/x-wav', { ext: '.wav', magic: [Buffer.from('RIFF')] }],
  ['audio/ogg', { ext: '.ogg', magic: [Buffer.from('OggS')] }],
  ['audio/mpeg', { ext: '.mp3', magic: [Buffer.from('ID3'), Buffer.from([0xff, 0xfb]), Buffer.from([0xff, 0xf3]), Buffer.from([0xff, 0xf2])] }],
  ['audio/mp4', { ext: '.m4a', magic: [Buffer.from('ftyp')] }],
  ['audio/x-m4a', { ext: '.m4a', magic: [Buffer.from('ftyp')] }],
]);

function isAllowedMime(m) {
  return ALLOWED.has(m);
}

function extForMime(m) {
  return ALLOWED.get(m)?.ext || '.webm';
}

// Check first bytes of file buffer against expected magic for claimed mime
function magicOk(buffer, mime) {
  const entry = ALLOWED.get(mime);
  if (!entry) return false;
  const head = buffer.slice(0, 16);
  return entry.magic.some(m => {
    if (m.toString() === 'ftyp') return head.includes(Buffer.from('ftyp'));
    return head.slice(0, m.length).equals(m);
  });
}

function safeBasename(name) {
  return String(name || '').split(/[/\\]/).pop().replace(/[^a-zA-Z0-9._-]/g, '') || 'file';
}

module.exports = { ALLOWED_MIME_TYPES: [...ALLOWED.keys()], isAllowedMime, extForMime, magicOk, safeBasename };
