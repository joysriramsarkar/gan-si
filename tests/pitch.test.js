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
