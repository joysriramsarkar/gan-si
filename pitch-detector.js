/**
 * Pitch Detector Engine for Sur Sadhana Pro
 * Features:
 * - Parabolic-Interpolated Autocorrelation Algorithm
 * - EMA Pitch Smoothing & Noise Gate
 * - Sargam & Saptak Mapping (মন্দ্র, মধ্য, তার সপ্তক)
 * - Realtime Canvas Pitch Trail with Reference Swara Lines
 */

class PitchDetector {
  constructor() {
    this.micStream = null;
    this.analyser = null;
    this.isListening = false;
    this.animationId = null;

    // Pitch smoothing and state
    this.smoothedPitch = null;
    this.pitchHistory = [];
    this.maxHistory = 120;
    this.inTuneStreak = 0;
    this.totalSamples = 0;
    this.inTuneSamples = 0;

    // Callbacks
    this.onPitchUpdate = null;

    // Note constants
    this.noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    this.sargamNames = [
      "সা (Sa)", "রে♭ (কোমল)", "রে (শুদ্ধ)", "গা♭ (কোমল)",
      "গা (শুদ্ধ)", "মা (শুদ্ধ)", "মা♯ (কড়ি)", "পা (Pa)",
      "ধা♭ (কোমল)", "ধা (শুদ্ধ)", "নি♭ (কোমল)", "নি (শুদ্ধ)"
    ];
    this.sargamShort = ["সা", "রে♭", "রে", "গা♭", "গা", "মা", "মা♯", "পা", "ধা♭", "ধা", "নি♭", "নি"];

    // Canvas
    this.canvas = null;
    this.ctx = null;
  }

  setCanvas(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
  }

  async startListening() {
    const audioCtx = window.audioEngine.ctx || new (window.AudioContext || window.webkitAudioContext)();
    window.audioEngine.init();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("মাইক্রোফোন ব্রাউজারে সাপোর্ট করছে না।");
    }

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true
      }
    });

    const source = window.audioEngine.ctx.createMediaStreamSource(this.micStream);
    this.analyser = window.audioEngine.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);

    this.isListening = true;
    this.smoothedPitch = null;
    this.detectLoop();
    return this.micStream;
  }

  stopListening() {
    this.isListening = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
  }

  // Enhanced Autocorrelation with Parabolic Peak Interpolation
  autoCorrelate(buf, sampleRate) {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);

    // RMS Gate: ignore quiet background noise
    if (rms < 0.012) return -1;

    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }

    if (r2 <= r1) return -1;
    const trimmed = buf.slice(r1, r2);
    const trimmedSize = trimmed.length;
    if (trimmedSize < 2) return -1;

    const c = new Float32Array(trimmedSize);
    for (let i = 0; i < trimmedSize; i++) {
      let sum = 0;
      for (let j = 0; j < trimmedSize - i; j++) {
        sum += trimmed[j] * trimmed[j + i];
      }
      c[i] = sum;
    }

    let d = 0;
    while (d + 1 < trimmedSize && c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < trimmedSize; i++) {
      if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }

    if (maxpos <= 0 || maxpos >= trimmedSize - 1) return -1;

    // Parabolic interpolation around peak
    const y1 = c[maxpos - 1];
    const y2 = c[maxpos];
    const y3 = c[maxpos + 1];
    const denom = 2 * (2 * y2 - y1 - y3);
    const delta = Math.abs(denom) > 1e-6 ? (y3 - y1) / denom : 0;
    const refinedPos = maxpos + delta;

    return sampleRate / refinedPos;
  }

  detectLoop() {
    if (!this.isListening) return;

    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);
    const rawFreq = this.autoCorrelate(buffer, window.audioEngine.ctx.sampleRate);

    if (rawFreq > 60 && rawFreq < 1200) {
      // Exponential Moving Average filter for buttery smooth needle movement
      if (this.smoothedPitch === null) {
        this.smoothedPitch = rawFreq;
      } else {
        this.smoothedPitch = this.smoothedPitch * 0.65 + rawFreq * 0.35;
      }

      const freq = this.smoothedPitch;
      const baseA4 = window.audioEngine.baseFreqA4 || 440;
      const noteNum = 12 * (Math.log(freq / baseA4) / Math.log(2)) + 69;
      const roundedNote = Math.round(noteNum);
      const cents = Math.floor((noteNum - roundedNote) * 100);

      const noteIndex = (roundedNote % 12 + 12) % 12;
      const octave = Math.floor(roundedNote / 12) - 1;
      const noteName = this.noteStrings[noteIndex] + octave;

      // Sargam & Saptak calculations
      const root = window.audioEngine.rootOffset;
      const sargamIndex = (noteIndex - root + 12) % 12;
      const sargamText = this.sargamNames[sargamIndex];
      const sargamShortName = this.sargamShort[sargamIndex];

      // Saptak calculation: Mandra (< Sa3/Sa4 depending on male/female), Madhya, Tara
      const middleSaMidi = 48 + root; // C3 + root
      let saptak = "মধ্য সপ্তক (মুদারা)";
      if (roundedNote < middleSaMidi) {
        saptak = "মন্দ্র সপ্তক (উদারা)";
      } else if (roundedNote >= middleSaMidi + 12) {
        saptak = "তার সপ্তক (তারা)";
      }

      // Accuracy evaluation (within 12 cents considered accurate)
      const isInTune = Math.abs(cents) <= 12;
      this.totalSamples++;
      if (isInTune) this.inTuneSamples++;

      const payload = {
        freq: Math.round(freq * 10) / 10,
        noteNum: noteNum,
        cents: cents,
        noteName: noteName,
        noteIndex: noteIndex,
        sargamText: sargamText,
        sargamShortName: sargamShortName,
        sargamIndex: sargamIndex,
        saptak: saptak,
        isInTune: isInTune,
        accuracyPercent: Math.round((this.inTuneSamples / this.totalSamples) * 100)
      };

      this.pitchHistory.push(noteNum);
      if (this.onPitchUpdate) this.onPitchUpdate(payload);
    } else {
      this.smoothedPitch = null;
      this.pitchHistory.push(null);
      if (this.onPitchUpdate) this.onPitchUpdate(null);
    }

    if (this.pitchHistory.length > this.maxHistory) {
      this.pitchHistory.shift();
    }

    this.drawGraph();
    this.animationId = requestAnimationFrame(() => this.detectLoop());
  }

  drawGraph() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Dynamic horizontal reference lines for Sargam notes in chosen scale
    const root = window.audioEngine.rootOffset;
    const baseMidi = 48 + root; // Middle Sa
    const swaraIntervals = [0, 2, 4, 5, 7, 9, 11, 12]; // Shuddha scale
    const swaraNames = ["সা", "রে", "গা", "মা", "পা", "ধা", "নি", "সাঁ"];

    ctx.lineWidth = 1;
    swaraIntervals.forEach((interval, idx) => {
      const midiVal = baseMidi + interval;
      // Map MIDI 45 (A2) to 75 (D#5)
      const y = h - ((midiVal - 45) / 30) * h;
      if (y >= 0 && y <= h) {
        ctx.strokeStyle = idx === 0 || idx === 7 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(36, 50, 82, 0.6)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();

        ctx.fillStyle = idx === 0 || idx === 7 ? '#f59e0b' : '#64748b';
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillText(swaraNames[idx], 8, y - 3);
      }
    });

    // Pitch Trail
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();

    const step = w / this.maxHistory;
    let started = false;

    for (let i = 0; i < this.pitchHistory.length; i++) {
      const val = this.pitchHistory[i];
      if (val !== null) {
        const y = h - ((val - 45) / 30) * h;
        const x = i * step;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      } else {
        started = false;
      }
    }
    ctx.stroke();
  }
}

// Global instance
window.pitchDetector = new PitchDetector();
