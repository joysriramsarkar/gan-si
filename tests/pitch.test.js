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
});
