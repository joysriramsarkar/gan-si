const PitchDetector = require('../public/pitch-detector');

describe('PitchDetector MPM Algorithm', () => {
  function generateSineWave(freq, sampleRate = 44100, length = 2048) {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      buffer[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }
    return buffer;
  }

  test('Detects A4 (440 Hz) accurately', () => {
    const sampleRate = 44100;
    const buf = generateSineWave(440, sampleRate);
    const detected = PitchDetector.mcleodPitch(buf, sampleRate);
    expect(detected).toBeGreaterThan(435);
    expect(detected).toBeLessThan(445);
  });

  test('Detects A3 (220 Hz) accurately', () => {
    const sampleRate = 44100;
    const buf = generateSineWave(220, sampleRate);
    const detected = PitchDetector.mcleodPitch(buf, sampleRate);
    expect(detected).toBeGreaterThan(217);
    expect(detected).toBeLessThan(223);
  });

  test('Detects Middle C (C4, 261.63 Hz) accurately', () => {
    const sampleRate = 44100;
    const buf = generateSineWave(261.63, sampleRate);
    const detected = PitchDetector.mcleodPitch(buf, sampleRate);
    expect(detected).toBeGreaterThan(258);
    expect(detected).toBeLessThan(265);
  });

  test('Detects a quiet sung note (low amplitude) when the gate is lowered', () => {
    const sampleRate = 44100;
    const buf = new Float32Array(2048);
    for (let i = 0; i < buf.length; i++) buf[i] = 0.008 * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
    expect(PitchDetector.mcleodPitch(buf, sampleRate, 0.005)).toBeGreaterThan(215);
    expect(PitchDetector.mcleodPitch(buf, sampleRate, 0.005)).toBeLessThan(225);
  });

  test('DC offset on the mic signal does not hide the pitch', () => {
    const sampleRate = 44100;
    const buf = new Float32Array(2048);
    for (let i = 0; i < buf.length; i++) buf[i] = 0.35 + 0.12 * Math.sin((2 * Math.PI * 294 * i) / sampleRate);
    const detected = PitchDetector.mcleodPitch(buf, sampleRate, 0.02);
    expect(detected).toBeGreaterThan(290);
    expect(detected).toBeLessThan(298);
  });

  test('holding a note relaxes the noise gate', () => {
    const previous = global.window;
    global.window = {}; // exercise the in-class fallback
    try {
      const pd = new PitchDetector();
      const normal = pd.gateThresholdFor(0.01);
      const held = pd.gateThresholdFor(0.01, true);
      expect(held).toBeLessThan(normal);
      expect(held).toBeGreaterThanOrEqual(0.004);
    } finally {
      global.window = previous;
    }
  });

  test('Rejects silence / background noise below threshold', () => {
    const sampleRate = 44100;
    const buf = new Float32Array(2048); // all zeros
    const detected = PitchDetector.mcleodPitch(buf, sampleRate);
    expect(detected).toBe(-1);
  });

  test('C scale root offset 0 is preserved instead of falling back to A#', () => {
    const previous = global.window;
    global.window = { audioEngine: { rootOffset: 0 } };
    try {
      expect(new PitchDetector().getRootOffset()).toBe(0);
    } finally {
      global.window = previous;
    }
  });

  test('jiCents measures from the Sa below the note (no 100c sign fold)', () => {
    // Sa=C. ET Ga is 400c above Sa, JI Ga target 386c. A Ga sung 45c sharp
    // of ET is +59c from the shruti — the old code reported -41c.
    const sa = 261.63;
    const sharpGa = sa * Math.pow(2, 445 / 1200);
    const r = PitchDetector.jiCents(sharpGa, 0, 440);
    expect(r.sargamIndex).toBe(4);
    expect(r.cents).toBe(59);
    // Same pitch with Sa=A#: F# is ধা♭ (index 8), JI 814c above A#2.
    const r2 = PitchDetector.jiCents(185, 10, 440);
    expect(r2.sargamIndex).toBe(8);
    expect(r2.cents).toBe(-14);
    // Exact Sa is zero in its own scale.
    expect(PitchDetector.jiCents(233.08, 10, 440).cents).toBe(0);
  });

  test('session accuracy and pitch history reset on a new listening session', () => {
    const detector = new PitchDetector();
    detector.totalSamples = 50;
    detector.inTuneSamples = 40;
    detector.pitchHistory = [60, 61];
    detector.rawWindow = [220];
    detector.resetSessionStats();
    expect(detector.totalSamples).toBe(0);
    expect(detector.inTuneSamples).toBe(0);
    expect(detector.pitchHistory).toEqual([]);
    expect(detector.rawWindow).toEqual([]);
  });
});
