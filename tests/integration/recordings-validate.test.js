const { isAllowedMime, magicOk } = require('../../src/server/lib/audio-validate');
const { safeBasename } = require('../../src/server/lib/audio-validate');

describe('recordings validation', () => {
  test('strict allowlist rejects audio/ prefix bypass', () => {
    expect(isAllowedMime('audio/webm')).toBe(true);
    expect(isAllowedMime('audio/x-evil')).toBe(false);
  });
  test('magic bytes verified', () => {
    expect(magicOk(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0]), 'audio/webm')).toBe(true);
    expect(magicOk(Buffer.from('RIFFxxxx'), 'audio/webm')).toBe(false);
    expect(magicOk(Buffer.from('RIFFxxxx'), 'audio/wav')).toBe(true);
    expect(magicOk(Buffer.from('OggSxxxx'), 'audio/ogg')).toBe(true);
  });
  test('path traversal neutralized', () => {
    expect(safeBasename('../../etc/passwd')).toBe('passwd');
    expect(safeBasename('/abs/path.webm')).toBe('path.webm');
  });
});
