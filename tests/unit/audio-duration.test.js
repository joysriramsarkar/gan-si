/**
 * Audio duration probing: real container parsing for MAX_RECORDING_MIN
 * enforcement (WAV chunk math + WebM EBML Segment→Info→Duration).
 */
const { probeDurationSec } = require('../../src/server/lib/audio-duration');

function buildWav({ seconds = 1, rate = 8000, channels = 1, bits = 16 }) {
  const dataBytes = Math.round(seconds * rate * channels * (bits / 8));
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'latin1');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'latin1');
  buf.write('fmt ', 12, 'latin1');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * channels * (bits / 8), 28); // byte rate
  buf.writeUInt16LE(channels * (bits / 8), 32);
  buf.writeUInt16LE(bits, 34);
  buf.write('data', 36, 'latin1');
  buf.writeUInt32LE(dataBytes, 40);
  return buf;
}

function vintBytes(value, len) {
  // EBML vint with the length marker kept (as element ids are encoded).
  const out = [];
  let v = value;
  for (let i = len - 1; i >= 0; i--) out[i] = v % 256, v = Math.floor(v / 256);
  out[0] |= (1 << (8 - len)) & 0xff;
  return Buffer.from(out);
}

function buildWebm({ seconds }) {
  // Minimal matroska: EBML header + unknown-size Segment containing
  // Info{TimecodeScale=1e6 ns, Duration=<seconds*1e3 units>} (8-byte double).
  const tcs = Buffer.from([0x00, 0x0f, 0x42, 0x40]); // 1_000_000
  const durationUnits = seconds * 1000;
  const dur = Buffer.alloc(8);
  dur.writeDoubleBE(durationUnits);

  const tcsEl = Buffer.concat([Buffer.from([0x2a, 0xd7, 0xb1]), Buffer.from([0x84]), tcs]);
  const durEl = Buffer.concat([Buffer.from([0x44, 0x89]), Buffer.from([0x88]), dur]);
  const infoBody = Buffer.concat([tcsEl, durEl]);
  const infoEl = Buffer.concat([Buffer.from([0x15, 0x49, 0xa9, 0x66]), vintBytes(infoBody.length, 4), infoBody]);

  const ebmlHeader = Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from([0x82]), Buffer.from([0x42, 0x86])
  ]);
  const unknownSize = Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
  const segmentEl = Buffer.concat([Buffer.from([0x18, 0x53, 0x80, 0x67]), unknownSize, infoEl]);
  return Buffer.concat([ebmlHeader, segmentEl, Buffer.alloc(64)]);
}

describe('probeDurationSec', () => {
  test('computes WAV duration from fmt byte rate and data size', () => {
    const buf = buildWav({ seconds: 93.5, rate: 8000, channels: 1, bits: 16 });
    expect(probeDurationSec(buf, 'audio/wav')).toBeCloseTo(93.5, 3);
  });

  test('computes stereo 24-bit WAV duration', () => {
    const buf = buildWav({ seconds: 42, rate: 48000, channels: 2, bits: 24 });
    expect(probeDurationSec(buf, 'audio/x-wav')).toBeCloseTo(42, 3);
  });

  test('computes WebM duration from Segment Info with unknown segment size', () => {
    const buf = buildWebm({ seconds: 60 });
    expect(probeDurationSec(buf, 'audio/webm')).toBeCloseTo(60, 3);
  });

  test('returns null for formats without a parseable container duration', () => {
    expect(probeDurationSec(Buffer.alloc(1024, 7), 'audio/mpeg')).toBeNull();
  });

  test('returns null for truncated or malformed input', () => {
    expect(probeDurationSec(Buffer.alloc(8), 'audio/wav')).toBeNull();
    expect(probeDurationSec(Buffer.from('RIFF-not-a-wave-at-all!!'), 'audio/wav')).toBeNull();
    expect(probeDurationSec(Buffer.alloc(0), 'audio/webm')).toBeNull();
  });

  test('a WebM without a Duration element is null, not a guess', () => {
    const buf = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from([0x82]), Buffer.from([0x42, 0x86]),
      Buffer.from([0x18, 0x53, 0x80, 0x67]), Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
      Buffer.alloc(128)
    ]);
    expect(probeDurationSec(buf, 'audio/webm')).toBeNull();
  });
});
