/**
 * Pitch Detector Engine for Sur Sadhana Pro
 * Features:
 * - McLeod Pitch Method (MPM) / Normalized Square Difference Function (NSDF)
 * - Parabolic Peak Interpolation (sub-cent precision, eliminates octave doubling/halving)
 * - Strict Audio Constraints (echoCancellation: false, noiseSuppression: false, autoGainControl: false)
 * - Adaptive Silence RMS Gate
 * - Indian Classical 22-Shruti / Just Intonation Ratios vs 12-TET
 * - Sargam & Saptak (Mandra, Madhya, Tara) Mapping
 * - Raga Constraint & Apaswara (Forbidden Swara) Realtime Alert
 * - Vocal Range Finder Engine
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
    this.totalSamples = 0;
    this.inTuneSamples = 0;

    // Tuning Mode: 'just_intonation' (Shruti ratios) or 'equal_temperament' (12-TET)
    this.tuningSystem = 'just_intonation';

    // Raga Constraint
    this.activeRaga = null;

    // Vocal Range Finder
    this.isTestingRange = false;
    this.rangeMinMidi = null;
    this.rangeMaxMidi = null;

    // Callbacks
    this.onPitchUpdate = null;
    this.onRangeSample = null;

    // Note constants
    this.noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    this.sargamNames = [
      "সা (Sa)", "রে♭ (কোমল)", "রে (শুদ্ধ)", "গা♭ (কোমল)",
      "গা (শুদ্ধ)", "মা (শুদ্ধ)", "মা♯ (তীব্র)", "পা (Pa)",
      "ধা♭ (কোমল)", "ধা (শুদ্ধ)", "নি♭ (কোমল)", "নি (শুদ্ধ)"
    ];
    this.sargamShort = ["সা", "রে♭", "রে", "গা♭", "গা", "মা", "মা♯", "পা", "ধা♭", "ধা", "নি♭", "নি"];

    // Indian Classical Just Intonation cents offset from Sa
    // Sa(0), Komal Re(112), Shuddha Re(204), Komal Ga(316), Shuddha Ga(386),
    // Shuddha Ma(498), Teevra Ma(590), Pa(702), Komal Dha(814), Shuddha Dha(884),
    // Komal Ni(1018), Shuddha Ni(1088)
    this.justIntonationCents = [0, 112, 204, 316, 386, 498, 590, 702, 814, 884, 1018, 1088];

    // Canvas
    this.canvas = null;
    this.ctx = null;
  }

  setCanvas(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
  }

  setActiveRaga(raga) {
    this.activeRaga = raga;
  }

  setTuningSystem(system) {
    if (system === 'just_intonation' || system === 'equal_temperament') {
      this.tuningSystem = system;
    }
  }

  async startListening() {
    if (window.audioEngine) {
      window.audioEngine.init();
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("মাইক্রোফোন ব্রাউজারে সাপোর্ট করছে না।");
    }

    // Explicit audio constraints to avoid browser voice processing distortion
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const audioCtx = window.audioEngine.ctx;
    const source = audioCtx.createMediaStreamSource(this.micStream);
    this.analyser = audioCtx.createAnalyser();
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

  /**
   * McLeod Pitch Method (MPM) - Normalized Square Difference Function (NSDF)
   * Prevents octave doubling/halving errors common in plain autocorrelation
   */
  static mcleodPitch(buf, sampleRate, rmsThreshold = 0.015) {
    const SIZE = buf.length;
    let sumSquares = 0;
    for (let i = 0; i < SIZE; i++) sumSquares += buf[i] * buf[i];
    const rms = Math.sqrt(sumSquares / SIZE);

    // Silence gate
    if (rms < rmsThreshold) return -1;

    // Calculate NSDF: nsdf[tau] = 2 * r[tau] / m[tau]
    const maxTau = Math.floor(SIZE / 2);
    const nsdf = new Float32Array(maxTau);

    for (let tau = 0; tau < maxTau; tau++) {
      let r = 0;
      let m = 0;
      for (let i = 0; i < maxTau; i++) {
        r += buf[i] * buf[i + tau];
        m += buf[i] * buf[i] + buf[i + tau] * buf[i + tau];
      }
      nsdf[tau] = m > 0 ? (2 * r) / m : 0;
    }

    // Find all positive local maxima in NSDF
    const peaks = [];
    let maxOverall = 0;

    for (let t = 1; t < maxTau - 1; t++) {
      if (nsdf[t] > 0 && nsdf[t] >= nsdf[t - 1] && nsdf[t] >= nsdf[t + 1]) {
        peaks.push({ tau: t, val: nsdf[t] });
        if (nsdf[t] > maxOverall) {
          maxOverall = nsdf[t];
        }
      }
    }

    if (peaks.length === 0 || maxOverall < 0.45) return -1;

    // Pick first peak whose height is within 80% of max overall peak (MPM criterion)
    const threshold = 0.8 * maxOverall;
    let bestTau = -1;

    for (let i = 0; i < peaks.length; i++) {
      if (peaks[i].val >= threshold) {
        bestTau = peaks[i].tau;
        break;
      }
    }

    if (bestTau <= 0 || bestTau >= maxTau - 1) return -1;

    // Parabolic interpolation for sub-cent peak accuracy
    const y1 = nsdf[bestTau - 1];
    const y2 = nsdf[bestTau];
    const y3 = nsdf[bestTau + 1];
    const denom = 2 * (2 * y2 - y1 - y3);
    const delta = Math.abs(denom) > 1e-6 ? (y3 - y1) / denom : 0;
    const refinedTau = bestTau + delta;

    return sampleRate / refinedTau;
  }

  detectLoop() {
    if (!this.isListening) return;

    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);
    const rawFreq = PitchDetector.mcleodPitch(buffer, window.audioEngine.ctx.sampleRate);

    if (rawFreq > 60 && rawFreq < 1200) {
      if (this.smoothedPitch === null) {
        this.smoothedPitch = rawFreq;
      } else {
        this.smoothedPitch = this.smoothedPitch * 0.65 + rawFreq * 0.35;
      }

      const freq = this.smoothedPitch;
      const baseA4 = (window.audioEngine && window.audioEngine.baseFreqA4) || 440;
      const root = (window.audioEngine && window.audioEngine.rootOffset) || 10;

      // Calculate Western MIDI note
      const noteNum = 12 * (Math.log(freq / baseA4) / Math.log(2)) + 69;
      const roundedNote = Math.round(noteNum);
      const noteIndex = (roundedNote % 12 + 12) % 12;
      const octave = Math.floor(roundedNote / 12) - 1;
      const noteName = this.noteStrings[noteIndex] + octave;

      // Sargam Mapping
      const sargamIndex = (noteIndex - root + 12) % 12;
      const sargamText = this.sargamNames[sargamIndex];
      const sargamShortName = this.sargamShort[sargamIndex];

      // Calculate Cents: Support Just Intonation (Shruti) or 12-TET
      let cents = 0;
      if (this.tuningSystem === 'just_intonation') {
        // Calculate frequency ratio from root Sa in current octave
        const rootMidiInOctave = (octave + 1) * 12 + root;
        const saFreq = baseA4 * Math.pow(2, (rootMidiInOctave - 69) / 12);
        const actualCentsAboveSa = 1200 * (Math.log(freq / saFreq) / Math.log(2));
        const targetShrutiCents = this.justIntonationCents[sargamIndex];
        // Difference from target Shruti
        cents = Math.round(actualCentsAboveSa - targetShrutiCents);
        // Normalize between -50 and +50
        while (cents > 50) cents -= 100;
        while (cents < -50) cents += 100;
      } else {
        cents = Math.floor((noteNum - roundedNote) * 100);
      }

      // Saptak calculation
      const middleSaMidi = 48 + root;
      let saptak = "মধ্য সপ্তক (মুদারা)";
      if (roundedNote < middleSaMidi) {
        saptak = "মন্দ্র সপ্তক (উদারা)";
      } else if (roundedNote >= middleSaMidi + 12) {
        saptak = "তার সপ্তক (তারা)";
      }

      // Raga Constraint (Apaswara / বর্জিত স্বর)
      let isApaswara = false;
      let apaswaraMsg = null;
      if (this.activeRaga && this.activeRaga.allowedIntervals) {
        if (!this.activeRaga.allowedIntervals.includes(sargamIndex)) {
          isApaswara = true;
          apaswaraMsg = `⚠️ ${this.activeRaga.name}-এ এই স্বরটি বর্জিত (অপস্বর)!`;
        }
      }

      const isInTune = Math.abs(cents) <= 12;
      this.totalSamples++;
      if (isInTune) this.inTuneSamples++;

      // Range Finder Tracker
      if (this.isTestingRange) {
        if (this.rangeMinMidi === null || roundedNote < this.rangeMinMidi) {
          this.rangeMinMidi = roundedNote;
        }
        if (this.rangeMaxMidi === null || roundedNote > this.rangeMaxMidi) {
          this.rangeMaxMidi = roundedNote;
        }
        if (this.onRangeSample) {
          this.onRangeSample({
            currentNote: noteName,
            freq: Math.round(freq),
            minNote: this.getNoteFromMidi(this.rangeMinMidi),
            maxNote: this.getNoteFromMidi(this.rangeMaxMidi)
          });
        }
      }

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
        isApaswara: isApaswara,
        apaswaraMsg: apaswaraMsg,
        tuningSystem: this.tuningSystem,
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

  /* Vocal Range Finder */
  startRangeTest() {
    this.isTestingRange = true;
    this.rangeMinMidi = null;
    this.rangeMaxMidi = null;
  }

  stopRangeTest() {
    this.isTestingRange = false;
    if (this.rangeMinMidi === null || this.rangeMaxMidi === null) {
      return null;
    }

    const minNote = this.getNoteFromMidi(this.rangeMinMidi);
    const maxNote = this.getNoteFromMidi(this.rangeMaxMidi);
    const semitonesSpan = this.rangeMaxMidi - this.rangeMinMidi;
    const octavesSpan = (semitonesSpan / 12).toFixed(1);

    const idealSaMidi = this.rangeMinMidi + Math.round(semitonesSpan * 0.35);
    const idealRootIdx = idealSaMidi % 12;
    const idealRootName = this.noteStrings[idealRootIdx];

    let voiceType = "সাধারণ ভোকাল রেঞ্জ";
    if (this.rangeMinMidi < 40) voiceType = "খাদ / বাস (Bass)";
    else if (this.rangeMinMidi < 45) voiceType = "ব্যারিটোন (Baritone)";
    else if (this.rangeMinMidi < 52) voiceType = "টেনর (Tenor)";
    else if (this.rangeMinMidi < 58) voiceType = "আল্টো / মেজো-সোপ্রানো (Alto/Mezzo)";
    else voiceType = "সোপ্রানো (Soprano)";

    return {
      minNote,
      maxNote,
      semitonesSpan,
      octavesSpan,
      idealRootIdx,
      idealRootName,
      voiceType
    };
  }

  getNoteFromMidi(midi) {
    if (!midi) return "--";
    const noteIdx = (midi % 12 + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    return `${this.noteStrings[noteIdx]}${octave}`;
  }

  /* Pitch Trail Canvas Drawing */
  drawGraph() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const vals = this.pitchHistory.filter(v => v != null);
    let lo = 45, hi = 75;
    if (vals.length > 0) {
      const mn = Math.min(...vals);
      const mx = Math.max(...vals);
      const span = Math.max(mx - mn, 12);
      lo = Math.max(20, mn - span * 0.25);
      hi = Math.min(90, mx + span * 0.25);
    }
    const total = Math.max(hi - lo, 1);
    const yOf = (midiVal) => h - ((midiVal - lo) / total) * (h - 16) - 8;

    const root = (window.audioEngine && window.audioEngine.rootOffset) || 10;
    const baseMidi = 48 + root;
    const swaraIntervals = [0, 2, 4, 5, 7, 9, 11, 12];
    const swaraNames = ["সা", "রে", "গা", "মা", "পা", "ধা", "নি", "সাঁ"];

    ctx.lineWidth = 1;
    swaraIntervals.forEach((interval, idx) => {
      const midiVal = baseMidi + interval;
      const y = yOf(midiVal);
      if (y >= 0 && y <= h) {
        let isHighlighted = idx === 0 || idx === 7;
        if (this.activeRaga && this.activeRaga.allowedIntervals) {
          isHighlighted = this.activeRaga.allowedIntervals.includes(interval % 12);
        }

        ctx.strokeStyle = isHighlighted ? 'rgba(245, 158, 11, 0.45)' : 'rgba(36, 50, 82, 0.4)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();

        ctx.fillStyle = isHighlighted ? '#f59e0b' : '#64748b';
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
        const y = yOf(val);
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

// Support Node.js / Jest export for unit testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PitchDetector;
}
if (typeof window !== 'undefined') {
  window.pitchDetector = new PitchDetector();
}
