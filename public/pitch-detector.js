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
    this.rawWindow = []; // P2-1: median window for stability
    this.lastStableFreq = null;

    // Tuning Mode: 'just_intonation' (Shruti ratios) or 'equal_temperament' (12-TET)
    this.tuningSystem = 'just_intonation';

    // Noise gate: 'auto' | 'normal' | 'strong' | 'off' (RiyazDaily-style).
    this.noiseGateMode = 'auto';
    this.noiseFloorRms = null;

    // Raga Constraint
    this.activeRaga = null;
    this.practiceDirection = null;
    this.practiceTargetMidi = null;

    // Vocal Range Finder
    this.isTestingRange = false;
    this.rangeMinMidi = null;
    this.rangeMaxMidi = null;

    // Callbacks
    this.onPitchUpdate = null;
    this.lastPayload = null;
    this.lastNoteNum = null;
    this.onRangeSample = null;
    this.onSessionStart = null;
    this.onMicEnded = null;   // device unplugged / permission revoked mid-session
    this.onMicError = null;   // getUserMedia failed

    // Mic lifecycle + signal watchdog
    this.micTracks = [];
    this.micSource = null;
    this.lastPitchAt = null;
    this._onTrackEnded = () => this.handleMicEnded('ended');

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

  getRootOffset() {
    return (typeof window !== 'undefined' && window.audioEngine && window.audioEngine.rootOffset) ?? 10;
  }

  resetSessionStats() {
    this.totalSamples = 0;
    this.inTuneSamples = 0;
    this.pitchHistory = [];
    this.rawWindow = [];
    this.rmsWindow = [];
    this.lastStableFreq = null;
    this.smoothedPitch = null;
    this.lastPitchAt = null;
  }

  setTuningSystem(system) {
    if (system === 'just_intonation' || system === 'equal_temperament') {
      this.tuningSystem = system;
    }
  }

  async startListening(deviceId) {
    if (window.audioEngine) {
      window.audioEngine.init();
      // A suspended AudioContext yields an all-zero analyser buffer forever,
      // which looks exactly like "nothing is being recorded". Await the resume.
      if (window.audioEngine.ctx && window.audioEngine.ctx.state === 'suspended') {
        try { await window.audioEngine.ctx.resume(); } catch (_) { /* handled below */ }
      }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error('getUserMedia unsupported');
      err.name = 'TypeError';
      if (this.onMicError) this.onMicError(err);
      throw err;
    }

    // Explicit audio constraints to avoid browser voice processing distortion.
    // Optional exact deviceId (Piano-Roll monitor's mic picker, Singing Carrots-style).
    const audioConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    };
    if (deviceId) audioConstraints.deviceId = { exact: deviceId };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
    } catch (err) {
      if (this.onMicError) this.onMicError(err);
      throw err;
    }
    this.micStream = stream;

    const audioCtx = window.audioEngine.ctx;
    const source = audioCtx.createMediaStreamSource(this.micStream);
    this.analyser = audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);
    this.micSource = source;

    // If the device is unplugged / permission is revoked mid-session, the old
    // code kept isListening=true forever: a ghost session with score 0.
    this.micTracks = [];
    this.micStream.getAudioTracks().forEach((track) => {
      this.micTracks.push(track);
      track.addEventListener('ended', this._onTrackEnded);
    });

    this.isListening = true;
    this.resetSessionStats();
    if (this.onSessionStart) this.onSessionStart();
    this.detectLoop();
    return this.micStream;
  }

  handleMicEnded(reason) {
    if (!this.isListening) return;
    this.isListening = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.micStream = null;
    this.analyser = null;
    if (this.onMicEnded) this.onMicEnded(reason);
  }

  /** True when a valid pitch was detected within the last `ms` milliseconds. */
  hasRecentSignal(ms = 6000) {
    return this.lastPitchAt != null && (Date.now() - this.lastPitchAt) < ms;
  }

  stopListening() {
    this.isListening = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.micTracks) {
      this.micTracks.forEach((t) => t.removeEventListener('ended', this._onTrackEnded));
      this.micTracks = [];
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
  }

  /**
   * Just-Intonation cents deviation from the nearest Sa below the note.
   * Pure/static so it is unit-testable. The old code measured from the Sa
   * *above* the note and folded the result by 100 cents, which flipped the
   * sign once a note was clearly sharp/flat (e.g. +59c displayed as -41c).
   */
  static jiCents(freq, rootOffset, a4 = 440) {
    const JI = [0, 112, 204, 316, 386, 498, 590, 702, 814, 884, 1018, 1088];
    const root = ((Number(rootOffset) % 12) + 12) % 12;
    const noteNum = 12 * (Math.log(freq / a4) / Math.log(2)) + 69;
    const roundedNote = Math.round(noteNum);
    const noteIndex = ((roundedNote % 12) + 12) % 12;
    const sargamIndex = (noteIndex - root + 12) % 12;
    const saMidi = roundedNote - sargamIndex; // Sa at or below the sung note
    const saFreq = a4 * Math.pow(2, (saMidi - 69) / 12);
    const cents = Math.round(1200 * (Math.log(freq / saFreq) / Math.log(2)) - JI[sargamIndex]) || 0;
    return { cents, sargamIndex, noteIndex, roundedNote };
  }

  /** RMS gate threshold for the current noise-gate mode (auto = room-adaptive).
   *  `held` lowers the gate briefly while a note is being sustained, so quiet
   *  syllables between voiced frames are not dropped. */
  gateThresholdFor(rms, held = false) {
    let threshold;
    if (typeof window !== 'undefined' && window.PitchFilters && window.PitchFilters.gateThreshold) {
      threshold = window.PitchFilters.gateThreshold(this.noiseGateMode, this.noiseFloorRms);
    } else if (this.noiseGateMode === 'off') {
      threshold = 0.003;
    } else if (this.noiseGateMode === 'strong') {
      threshold = 0.04;
    } else if (this.noiseGateMode === 'auto') {
      const floor = this.noiseFloorRms > 0 ? this.noiseFloorRms : 0.01;
      threshold = Math.max(0.008, Math.min(0.04, floor * 3));
    } else {
      threshold = 0.015;
    }
    return held ? Math.max(0.004, threshold * 0.6) : threshold;
  }

  setNoiseGateMode(mode) {
    if (['auto', 'normal', 'strong', 'off'].includes(mode)) this.noiseGateMode = mode;
  }

  /**
   * McLeod Pitch Method (MPM) - Normalized Square Difference Function (NSDF)
   * Prevents octave doubling/halving errors common in plain autocorrelation
   */
  static mcleodPitch(buf, sampleRate, rmsThreshold = 0.015) {
    const SIZE = buf.length;
    // Remove DC offset first: a mic with a biased baseline gives a flat NSDF
    // and the real periodic peak can be missed entirely.
    let mean = 0;
    for (let i = 0; i < SIZE; i++) mean += buf[i];
    mean /= Math.max(1, SIZE);
    const data = new Float32Array(SIZE);
    let sumSquares = 0;
    for (let i = 0; i < SIZE; i++) {
      const v = buf[i] - mean;
      data[i] = v;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, SIZE));

    // Silence gate
    if (rms < rmsThreshold) return -1;

    // Calculate NSDF: nsdf[tau] = 2 * r[tau] / m[tau]
    const maxTau = Math.floor(SIZE / 2);
    const nsdf = new Float32Array(maxTau);

    for (let tau = 0; tau < maxTau; tau++) {
      let r = 0;
      let m = 0;
      for (let i = 0; i < maxTau; i++) {
        r += data[i] * data[i + tau];
        m += data[i] * data[i] + data[i + tau] * data[i + tau];
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

    // A singing voice is noisier than a sine wave; accept weaker peaks rather
    // than silently treating the phrase as silence.
    if (peaks.length === 0 || maxOverall < 0.32) return -1;

    // Pick the first strong peak (MPM criterion, slightly relaxed).
    const threshold = Math.max(0.72 * maxOverall, 0.28);
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
    // Noise gate: measure room RMS first; Auto learns the floor from silence.
    let frameRms = 0;
    for (let i = 0; i < buffer.length; i++) frameRms += buffer[i] * buffer[i];
    frameRms = Math.sqrt(frameRms / Math.max(1, buffer.length));
    // Median over a few frames keeps one loud click from raising the gate and
    // hiding the quiet note that follows it.
    this.rmsWindow = this.rmsWindow || [];
    this.rmsWindow.push(frameRms);
    if (this.rmsWindow.length > 6) this.rmsWindow.shift();
    const smoothRms = (window.PitchFilters && window.PitchFilters.median)
      ? (window.PitchFilters.median(this.rmsWindow) || frameRms)
      : frameRms;
    // While a note is being held, relax the gate so soft syllables survive.
    const held = this.lastPitchAt != null && (Date.now() - this.lastPitchAt) < 250;
    const gateThreshold = this.gateThresholdFor(smoothRms, held);
    const rawFreq = PitchDetector.mcleodPitch(buffer, window.audioEngine.ctx.sampleRate, gateThreshold);
    if (rawFreq <= 0 && smoothRms > 0) {
      this.noiseFloorRms = this.noiseFloorRms == null ? smoothRms : this.noiseFloorRms * 0.95 + smoothRms * 0.05;
    }
    // Sustained silence must clear the detector's short-term memory: the old
    // lastStableFreq would otherwise octave-anchor the next phrase to the
    // previous swara instead of the one actually being sung.
    if (rawFreq <= 0) {
      this.silentFrames = (this.silentFrames || 0) + 1;
      if (this.silentFrames >= 25) { // ~0.4s at rAF cadence
        this.rawWindow = [];
        this.lastStableFreq = null;
      }
    } else {
      this.silentFrames = 0;
    }
    // P2-1: octave-fix + median smoothing (fps-independent, confidence-weighted)
    let procFreq = rawFreq;
    if (window.PitchFilters && rawFreq > 0) {
      this.rawWindow.push(rawFreq);
      if (this.rawWindow.length > 5) this.rawWindow.shift();
      const med = window.PitchFilters.median(this.rawWindow);
      const ref = this.lastStableFreq || this.smoothedPitch || med;
      procFreq = window.PitchFilters.octaveFix(med != null ? med : rawFreq, ref);
    }

    if (procFreq > 50 && procFreq < 1200) {
      this.lastPitchAt = Date.now();
      if (this.smoothedPitch === null) {
        this.smoothedPitch = procFreq;
      } else {
        const alpha = 0.35;
        this.smoothedPitch = this.smoothedPitch * (1 - alpha) + procFreq * alpha;
      }
      this.lastStableFreq = this.smoothedPitch;

      const freq = this.smoothedPitch;
      const baseA4 = (window.audioEngine && window.audioEngine.baseFreqA4) || 440;
      const root = this.getRootOffset();

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

      // Calculate Cents: Support Just Intonation (Shruti) or 12-TET.
      // JI is measured from the Sa at/below the note (see jiCents) — no
      // 100-cent folding, so a clearly sharp note can never read as flat.
      let cents = 0;
      if (this.tuningSystem === 'just_intonation') {
        cents = PitchDetector.jiCents(freq, root, baseA4).cents;
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

      // Raga Constraint (Apaswara / বর্জিত স্বর) — direction-aware via RagaEngine when available
      let isApaswara = false;
      let apaswaraMsg = null;
      if (this.activeRaga) {
        if (window.RagaEngine) {
          // Guided/learning direction hint (aroha default); full phrase validation lives in raga-engine.js
          const dir = this.practiceDirection || 'either';
          const r = window.RagaEngine.validateNote({ sargamIndex, direction: dir, raga: this.activeRaga });
          isApaswara = !r.ok;
          apaswaraMsg = r.msg || null;
        } else if (this.activeRaga.allowedIntervals) {
          if (!this.activeRaga.allowedIntervals.includes(sargamIndex)) {
            isApaswara = true;
            apaswaraMsg = `⚠️ ${this.activeRaga.name}-এ এই স্বরটি বর্জিত (অপস্বর)!`;
          }
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
      this.lastPayload = payload;
      this.lastNoteNum = noteNum;
      if (this.onPitchUpdate) this.onPitchUpdate(payload);
    } else {
      this.smoothedPitch = null;
      this.pitchHistory.push(null);
      this.lastPayload = null;
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
    const css = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const token = (name, fallback) => (css && css.getPropertyValue(name).trim()) || fallback;
    const colors = {
      bg: token('--chart-bg', '#fbfaf7'),
      grid: token('--chart-grid', '#e4ddd3'),
      gridActive: token('--chart-grid-active', '#d9b8a6'),
      label: token('--chart-label', '#756d64'),
      line: token('--chart-line', '#a44a2a'),
      target: token('--chart-target', '#2f6f5e'),
      band: token('--chart-band', 'rgba(47,111,94,.12)')
    };

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    const vals = this.pitchHistory.filter(v => v != null);
    let lo = 45, hi = 75;
    if (Number.isFinite(this.practiceTargetMidi)) {
      lo = this.practiceTargetMidi - 2;
      hi = this.practiceTargetMidi + 2;
    } else if (vals.length > 0) {
      const mn = Math.min(...vals);
      const mx = Math.max(...vals);
      const span = Math.max(mx - mn, 12);
      lo = Math.max(20, mn - span * 0.25);
      hi = Math.min(90, mx + span * 0.25);
    }
    const total = Math.max(hi - lo, 1);
    const yOf = (midiVal) => h - ((midiVal - lo) / total) * (h - 16) - 8;

    const root = this.getRootOffset();
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

        ctx.strokeStyle = isHighlighted ? colors.gridActive : colors.grid;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();

        ctx.fillStyle = isHighlighted ? colors.line : colors.label;
        ctx.font = '10px "Segoe UI", sans-serif';
        ctx.fillText(swaraNames[idx], 8, y - 3);
      }
    });

    // Guided target line + ±12 cents tolerance band
    if (Number.isFinite(this.practiceTargetMidi)) {
      const targetY = yOf(this.practiceTargetMidi);
      const band = (12 / 100) * ((h - 16) / Math.max(hi - lo, 1));
      ctx.fillStyle = colors.band;
      ctx.fillRect(0, targetY - band, w, band * 2);
      ctx.strokeStyle = colors.target;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, targetY);
      ctx.lineTo(w, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = colors.target;
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillText('লক্ষ্য', w - 42, targetY - 5);
    }

    // Pitch Trail
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colors.line;
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
