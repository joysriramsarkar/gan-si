const F = require('../../public/js/music/pitch-filters');
const PitchDetector = require('../../public/pitch-detector');

function sine(freq, sr = 44100, n = 2048, noiseAmp = 0, vibratoCents = 0) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const vib = vibratoCents ? (vibratoCents / 100) * Math.sin((2 * Math.PI * 5 * i) / sr) : 0;
    const f = freq * Math.pow(2, vib / 12);
    buf[i] = Math.sin((2 * Math.PI * f * i) / sr) + (noiseAmp ? (Math.random() * 2 - 1) * noiseAmp : 0);
  }
  return buf;
}

describe('pitch filters', () => {
  test('rms gate rejects silence', () => {
    const { voiced } = F.rmsGate(new Float32Array(2048));
    expect(voiced).toBe(false);
  });
  test('median + EMA smooth jitter', () => {
    expect(F.median([440, 445, 438, 441, 900])).toBe(441);
    expect(F.ema(440, 444)).toBeCloseTo(441.4, 1);
  });
  test('octave fix snaps 2x jump', () => {
    expect(F.octaveFix(440, 220)).toBeCloseTo(220, 0);
    expect(F.octaveFix(110, 220)).toBeCloseTo(220, 0);
    expect(F.octaveFix(233, 220)).toBeCloseTo(233, 0);
  });
  test('MPM still detects A4 with mild noise', () => {
    const d = PitchDetector.mcleodPitch(sine(440, 44100, 2048, 0.05), 44100);
    expect(d).toBeGreaterThan(425);
    expect(d).toBeLessThan(455);
  });
  test('MPM detects with vibrato ±30 cents', () => {
    const d = PitchDetector.mcleodPitch(sine(330, 44100, 2048, 0, 30), 44100);
    expect(d).toBeGreaterThan(310);
    expect(d).toBeLessThan(350);
  });
  test('MPM rejects low-level fan hum below gate', () => {
    const d = PitchDetector.mcleodPitch(sine(120, 44100, 2048, 0).map(() => 0.001), 44100);
    expect(d).toBe(-1);
  });
});
