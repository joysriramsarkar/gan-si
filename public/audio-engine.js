/**
 * Audio Engine for Sur Sadhana Pro
 * Features:
 * - Two-Clocks Web Audio Lookahead Scheduler Pattern for Precision Tabla & Metronome
 * - 8 Indian Classical Taals (Teental, Keherwa, Dadra, Rupak, Jhaptal, Ektaal, Tewra, Deepchandi)
 * - Laya Multipliers (একগুণ 1x, দ্বিগুণ 2x, চৌগুণ 4x)
 * - Synthetic Acoustic Tanpura with Javari Overtone Plucking
 * - Virtual Harmonium Dual-Reed Synthesis with Continuous Drone Stops
 * - Swaramandal Cascading Glissando Strum
 * - Algorithmic Convolver Studio Reverb
 * - iOS Safari User Interaction Auto-Resume
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isTanpuraPlaying = false;
    this.tanpuraTimer = null;
    this.tanpuraCurrentString = 0;
    
    // Tanpura Settings
    this.tanpuraTuning = 0; // 0 = Pa, 1 = Ma, 2 = Ni, 3 = Shuddha Dha
    this.tanpuraTempoBpm = 40;
    this.tanpuraVolume = 0.7;
    this.baseFreqA4 = 440;
    this.rootOffset = 10; // A#
    
    // Harmonium Active Voices & Drone Stops
    this.activeHarmoniumVoices = new Map();
    this.activeHarmoniumDrones = new Set();

    // Studio Reverb
    this.convolver = null;
    this.reverbGain = null;
    this.dryGain = null;
    this.isReverbEnabled = true;
    this.reverbLevel = 0.35;

    // Two-Clocks Lookahead Tabla Scheduler
    this.isMetronomePlaying = false;
    this.currentTaal = 'teental';
    this.taalBpm = 110;
    this.layaMultiplier = 1; // 1 = Ekgun, 2 = Dwigun, 4 = Chougun
    this.currentMatra = 0;
    this.onBeatCallback = null;
    
    this.lookaheadMs = 25.0; // Interval for scheduler timer
    this.scheduleAheadTime = 0.1; // 100ms lookahead audio buffer
    this.nextBeatTime = 0.0;
    this.schedulerTimerId = null;

    // Mixed Audio Recorder
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordDest = null;
    this.isRecording = false;

    // Swara sequence player
    this.swaraSeqPlaying = false;
    this.swaraSeqTimer = null;
    this.swaraSeqIntervals = [];
    this.swaraSeqIndex = 0;

    // Attach iOS Safari touch listener
    this.attachSafariUnlock();
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.9, this.ctx.currentTime);

      this.setupReverb();

      this.recordDest = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.recordDest);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  attachSafariUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('touchstart', unlock, true);
      window.removeEventListener('touchend', unlock, true);
      window.removeEventListener('click', unlock, true);
    };
    window.addEventListener('touchstart', unlock, true);
    window.addEventListener('touchend', unlock, true);
    window.addEventListener('click', unlock, true);
  }

  setupReverb() {
    try {
      const ctx = this.ctx;
      this.convolver = ctx.createConvolver();
      this.reverbGain = ctx.createGain();
      this.dryGain = ctx.createGain();

      const rate = ctx.sampleRate;
      const length = rate * 2.5;
      const decay = 2.0;
      const impulse = ctx.createBuffer(2, length, rate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const n = i / length;
        const e = Math.exp(-n * decay * 3.5);
        left[i] = (Math.random() * 2 - 1) * e;
        right[i] = (Math.random() * 2 - 1) * e;
      }

      this.convolver.buffer = impulse;

      this.reverbGain.gain.setValueAtTime(this.isReverbEnabled ? this.reverbLevel : 0, ctx.currentTime);
      this.dryGain.gain.setValueAtTime(1.0, ctx.currentTime);

      this.masterGain.connect(this.dryGain);
      this.masterGain.connect(this.convolver);
      this.convolver.connect(this.reverbGain);

      this.dryGain.connect(ctx.destination);
      this.reverbGain.connect(ctx.destination);
    } catch (e) {
      console.warn("Reverb fallback to dry output", e);
      this.masterGain.connect(this.ctx.destination);
    }
  }

  setReverbEnabled(enabled) {
    this.isReverbEnabled = enabled;
    if (this.reverbGain && this.ctx) {
      this.reverbGain.gain.setValueAtTime(enabled ? this.reverbLevel : 0, this.ctx.currentTime);
    }
  }

  setReverbLevel(level) {
    this.reverbLevel = Math.max(0, Math.min(1, level));
    if (this.isReverbEnabled && this.reverbGain && this.ctx) {
      this.reverbGain.gain.setValueAtTime(this.reverbLevel, this.ctx.currentTime);
    }
  }

  getNoteFrequency(noteIndex, octave = 4) {
    const midi = (octave + 1) * 12 + noteIndex;
    return this.baseFreqA4 * Math.pow(2, (midi - 69) / 12);
  }

  /* ========================================================
   * 1. TANPURA SYNTHESIS
   * ======================================================== */
  startTanpura(onStringPlucked) {
    this.init();
    if (this.isTanpuraPlaying) return;
    this.isTanpuraPlaying = true;
    this.tanpuraCurrentString = 0;

    const pluckIntervalMs = (60 / this.tanpuraTempoBpm) * 1000;

    const runLoop = () => {
      if (!this.isTanpuraPlaying) return;
      this.pluckNextTanpuraString(onStringPlucked);
      this.tanpuraTimer = setTimeout(runLoop, pluckIntervalMs);
    };

    runLoop();
  }

  stopTanpura() {
    this.isTanpuraPlaying = false;
    if (this.tanpuraTimer) {
      clearTimeout(this.tanpuraTimer);
      this.tanpuraTimer = null;
    }
  }

  pluckNextTanpuraString(callback) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const root = this.rootOffset;

    let freq = 0;
    const stringIdx = this.tanpuraCurrentString;
    const baseOctave = root < 5 ? 3 : 2;

    if (stringIdx === 0) {
      if (this.tanpuraTuning === 0) {
        freq = this.getNoteFrequency((root + 7) % 12, baseOctave);
      } else if (this.tanpuraTuning === 1) {
        freq = this.getNoteFrequency((root + 5) % 12, baseOctave);
      } else if (this.tanpuraTuning === 2) {
        freq = this.getNoteFrequency((root + 11) % 12, baseOctave - 1);
      } else {
        freq = this.getNoteFrequency((root + 9) % 12, baseOctave);
      }
    } else if (stringIdx === 1 || stringIdx === 2) {
      const detune = stringIdx === 1 ? -1.8 : 1.8;
      const baseSa = this.getNoteFrequency(root, baseOctave);
      freq = baseSa * Math.pow(2, detune / 1200);
    } else {
      freq = this.getNoteFrequency(root, baseOctave - 1);
    }

    this.synthesizeTanpuraPluck(freq, now, stringIdx);

    if (callback) {
      callback(stringIdx);
    }

    this.tanpuraCurrentString = (this.tanpuraCurrentString + 1) % 4;
  }

  synthesizeTanpuraPluck(freq, time, stringIndex) {
    const ctx = this.ctx;
    const stringGain = ctx.createGain();
    stringGain.gain.setValueAtTime(0.0001, time);
    stringGain.gain.linearRampToValueAtTime(0.18 * this.tanpuraVolume, time + 0.025);
    stringGain.gain.exponentialRampToValueAtTime(0.0001, time + 4.2);

    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      const panPositions = [-0.35, -0.12, 0.12, 0.35];
      panner.pan.setValueAtTime(panPositions[stringIndex] || 0, time);
      stringGain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      stringGain.connect(this.masterGain);
    }

    const harmonics = [1, 2, 3, 4, 5, 6, 7];
    const amplitudes = [0.95, 0.7, 0.52, 0.38, 0.28, 0.18, 0.12];

    harmonics.forEach((h, i) => {
      const osc = ctx.createOscillator();
      const hGain = ctx.createGain();

      osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq * h, time);

      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      vibrato.frequency.setValueAtTime(4.2 + i * 0.35, time);
      vibratoGain.gain.setValueAtTime(0.6 * h, time);
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start(time);
      vibrato.stop(time + 4.5);

      hGain.gain.setValueAtTime(amplitudes[i], time);
      osc.connect(hGain);
      hGain.connect(stringGain);

      osc.start(time);
      osc.stop(time + 4.5);
    });
  }

  /* ========================================================
   * 2. SWARAMANDAL HARP GLISSANDO
   * ======================================================== */
  strumSwaramandal(scaleRoot = 10, intervals = [0, 2, 4, 5, 7, 9, 11]) {
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const root = scaleRoot !== undefined ? scaleRoot : this.rootOffset;

    const notes = [];
    intervals.forEach(i => notes.push({ interval: i, octave: 3 }));
    intervals.forEach(i => notes.push({ interval: i, octave: 4 }));
    notes.push({ interval: 0, octave: 5 });

    notes.forEach((item, index) => {
      const noteIdx = (root + item.interval) % 12;
      const freq = this.getNoteFrequency(noteIdx, item.octave);
      const pluckTime = now + index * 0.065;

      const stringGain = ctx.createGain();
      stringGain.gain.setValueAtTime(0.0001, pluckTime);
      stringGain.gain.linearRampToValueAtTime(0.12, pluckTime + 0.015);
      stringGain.gain.exponentialRampToValueAtTime(0.0001, pluckTime + 2.8);

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, pluckTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * 1.5, pluckTime);
      filter.Q.setValueAtTime(4.0, pluckTime);

      osc.connect(filter);
      filter.connect(stringGain);
      stringGain.connect(this.masterGain);

      osc.start(pluckTime);
      osc.stop(pluckTime + 3.0);
    });
  }

  /* ========================================================
   * 3. HARMONIUM SYNTHESIS & CONTINUOUS DRONES
   * ======================================================== */
  playHarmoniumNote(freq, noteKey) {
    this.init();
    if (this.activeHarmoniumVoices.has(noteKey)) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0.001, now);
    voiceGain.gain.linearRampToValueAtTime(0.24, now + 0.04);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, now);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq * 1.0025, now);

    const osc3 = ctx.createOscillator();
    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(freq * 2.003, now);

    const oscGain3 = ctx.createGain();
    oscGain3.gain.setValueAtTime(0.35, now);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(oscGain3);
    oscGain3.connect(filter);

    filter.connect(voiceGain);
    voiceGain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    this.activeHarmoniumVoices.set(noteKey, {
      oscillators: [osc1, osc2, osc3],
      gain: voiceGain
    });
  }

  stopHarmoniumNote(noteKey) {
    if (!this.activeHarmoniumVoices.has(noteKey)) return;
    const voice = this.activeHarmoniumVoices.get(noteKey);
    const now = this.ctx.currentTime;

    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    setTimeout(() => {
      voice.oscillators.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch (e) {}
      });
      voice.gain.disconnect();
    }, 140);

    this.activeHarmoniumVoices.delete(noteKey);
  }

  toggleHarmoniumDrone(freq, droneId) {
    if (this.activeHarmoniumDrones.has(droneId)) {
      this.stopHarmoniumNote(droneId);
      this.activeHarmoniumDrones.delete(droneId);
      return false;
    } else {
      this.playHarmoniumNote(freq, droneId);
      this.activeHarmoniumDrones.add(droneId);
      return true;
    }
  }

  /* ========================================================
   * 4. TWO-CLOCKS LOOKAHEAD TABLA SCHEDULER (PRECISION WEB AUDIO)
   * ======================================================== */
  playScheduledTablaBol(type, time) {
    const ctx = this.ctx;

    if (type === 'dha' || type === 'ge' || type === 'dhin') {
      const bayanOsc = ctx.createOscillator();
      const bayanGain = ctx.createGain();
      bayanOsc.type = 'sine';
      bayanOsc.frequency.setValueAtTime(135, time);
      bayanOsc.frequency.exponentialRampToValueAtTime(70, time + 0.2);

      bayanGain.gain.setValueAtTime(0.55, time);
      bayanGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

      bayanOsc.connect(bayanGain);
      bayanGain.connect(this.masterGain);
      bayanOsc.start(time);
      bayanOsc.stop(time + 0.32);
    }

    if (type === 'dha' || type === 'na' || type === 'tin' || type === 'ta' || type === 'dhin') {
      const dayanOsc = ctx.createOscillator();
      const dayanGain = ctx.createGain();
      dayanOsc.type = 'triangle';
      
      const pitch = (type === 'tin' || type === 'ta') ? 430 : 365;
      dayanOsc.frequency.setValueAtTime(pitch, time);

      dayanGain.gain.setValueAtTime(0.42, time);
      dayanGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

      dayanOsc.connect(dayanGain);
      dayanGain.connect(this.masterGain);
      dayanOsc.start(time);
      dayanOsc.stop(time + 0.25);
    }
  }

  startMetronome(onBeat) {
    this.init();
    if (this.isMetronomePlaying) return;
    this.isMetronomePlaying = true;
    this.currentMatra = 0;
    this.onBeatCallback = onBeat;

    // Initialize schedule time
    this.nextBeatTime = this.ctx.currentTime + 0.05;

    // Two-Clocks Scheduler Loop (Chris Wilson pattern)
    const scheduler = () => {
      while (this.nextBeatTime < this.ctx.currentTime + this.scheduleAheadTime) {
        this.scheduleBeat(this.currentMatra, this.nextBeatTime);
        this.advanceBeat();
      }
      if (this.isMetronomePlaying) {
        this.schedulerTimerId = setTimeout(scheduler, this.lookaheadMs);
      }
    };

    scheduler();
  }

  scheduleBeat(matraIdx, time) {
    const taalData = this.getTaalData(this.currentTaal);
    const bol = taalData.bols[matraIdx % taalData.bols.length];
    const isSam = matraIdx === 0;

    // Schedule audio sound in Web Audio queue
    this.playScheduledTablaBol(bol.type, time);

    // Schedule UI callback synchronized with audio time
    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => {
      if (this.isMetronomePlaying && this.onBeatCallback) {
        this.onBeatCallback({
          matra: matraIdx + 1,
          totalMatras: taalData.bols.length,
          bolName: bol.name,
          isSam: isSam,
          division: bol.division
        });
      }
    }, delayMs);
  }

  advanceBeat() {
    const taalData = this.getTaalData(this.currentTaal);
    // Effective BPM adjusted by Laya Multiplier (1x, 2x, 4x)
    const effectiveBpm = this.taalBpm * this.layaMultiplier;
    const secondsPerBeat = 60.0 / effectiveBpm;
    this.nextBeatTime += secondsPerBeat;
    this.currentMatra = (this.currentMatra + 1) % taalData.bols.length;
  }

  stopMetronome() {
    this.isMetronomePlaying = false;
    if (this.schedulerTimerId) {
      clearTimeout(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
    this.currentMatra = 0;
  }

  setLayaMultiplier(mult) {
    if ([1, 2, 4].includes(mult)) {
      this.layaMultiplier = mult;
    }
  }

  getTaalData(taalKey) {
    const taals = {
      teental: {
        name: "ত্রিতাল (Teental - ১৬ মাত্রা)",
        bols: [
          { name: "ধা", type: "dha", division: "sam" },
          { name: "ধিন", type: "dhin", division: "tali" },
          { name: "ধিন", type: "dhin", division: "tali" },
          { name: "ধা", type: "dha", division: "tali" },
          { name: "ধা", type: "dha", division: "tali" },
          { name: "ধিন", type: "dhin", division: "tali" },
          { name: "ধিন", type: "dhin", division: "tali" },
          { name: "ধা", type: "dha", division: "tali" },
          { name: "ধা", type: "ta", division: "khali" },
          { name: "তিন", type: "tin", division: "khali" },
          { name: "তিন", type: "tin", division: "khali" },
          { name: "তা", type: "ta", division: "khali" },
          { name: "তা", type: "dha", division: "tali" },
          { name: "ধিন", type: "dhin", division: "tali" },
          { name: "ধিন", type: "dhin", division: "tali" },
          { name: "ধা", type: "dha", division: "tali" }
        ]
      },
      keherwa: {
        name: "কাহারবা (Keherwa - ৮ মাত্রা)",
        bols: [
          { name: "ধা", type: "dha", division: "sam" },
          { name: "গে", type: "ge", division: "tali" },
          { name: "না", type: "na", division: "tali" },
          { name: "তি", type: "tin", division: "tali" },
          { name: "না", type: "na", division: "khali" },
          { name: "কে", type: "ta", division: "khali" },
          { name: "ধি", type: "dhin", division: "khali" },
          { name: "না", type: "na", division: "khali" }
        ]
      },
      dadra: {
        name: "দাদরা (Dadra - ৬ মাত্রা)",
        bols: [
          { name: "ধা", type: "dha", division: "sam" },
          { name: "ধী", type: "dhin", division: "tali" },
          { name: "না", type: "na", division: "tali" },
          { name: "ধা", type: "ta", division: "khali" },
          { name: "তী", type: "tin", division: "khali" },
          { name: "না", type: "na", division: "khali" }
        ]
      },
      rupak: {
        name: "রূপক (Rupak - ৭ মাত্রা)",
        bols: [
          { name: "তী", type: "tin", division: "sam" },
          { name: "তী", type: "tin", division: "khali" },
          { name: "না", type: "na", division: "khali" },
          { name: "ধী", type: "dhin", division: "tali" },
          { name: "না", type: "na", division: "tali" },
          { name: "ধী", type: "dhin", division: "tali" },
          { name: "না", type: "na", division: "tali" }
        ]
      },
      jhaptal: {
        name: "ঝাঁপতাল (Jhaptal - ১০ মাত্রা)",
        bols: [
          { name: "ধী", type: "dhin", division: "sam" },
          { name: "না", type: "na", division: "tali" },
          { name: "ধী", type: "dhin", division: "tali" },
          { name: "ধী", type: "dhin", division: "tali" },
          { name: "না", type: "na", division: "tali" },
          { name: "তী", type: "tin", division: "khali" },
          { name: "না", type: "na", division: "khali" },
          { name: "ধী", type: "dhin", division: "tali" },
          { name: "ধী", type: "dhin", division: "tali" },
          { name: "না", type: "na", division: "tali" }
        ]
      },
      ektaal: {
        name: "একতাল (Ektaal - ১২ মাত্রা)",
        bols: [
          { name: "ধিন", type: "dhin", division: "sam" },
          { name: "ধিন", type: "dhin", division: "tali" },
          { name: "ধাগে", type: "ge", division: "khali" },
          { name: "তিরিকিট", type: "ta", division: "khali" },
          { name: "তু", type: "tin", division: "tali" },
          { name: "না", type: "na", division: "tali" },
          { name: "কত", type: "ta", division: "khali" },
          { name: "তা", type: "ta", division: "khali" },
          { name: "ধাগে", type: "ge", division: "tali" },
          { name: "তিরিকিট", type: "ta", division: "tali" },
          { name: "ধিন", type: "dhin", division: "tali" },
          { name: "না", type: "na", division: "tali" }
        ]
      },
      tewra: {
        name: "তেওড়া (Tewra - ৭ মাত্রা)",
        bols: [
          { name: "ধা", type: "dha", division: "sam" },
          { name: "দিন", type: "dhin", division: "tali" },
          { name: "তা", type: "ta", division: "tali" },
          { name: "তিট", type: "tin", division: "tali" },
          { name: "কত", type: "ta", division: "tali" },
          { name: "গদি", type: "ge", division: "tali" },
          { name: "গন", type: "na", division: "tali" }
        ]
      },
      deepchandi: {
        name: "দীপচন্দী (Deepchandi - ১৪ মাত্রা)",
        bols: [
          { name: "ধা", type: "dha", division: "sam" },
          { name: "ধিন", type: "dhin", division: "tali" },
          { name: "—", type: "na", division: "tali" },
          { name: "ধা", type: "dha", division: "tali" },
          { name: "ধা", type: "dha", division: "tali" },
          { name: "তিন", type: "tin", division: "tali" },
          { name: "—", type: "tin", division: "tali" },
          { name: "তা", type: "ta", division: "khali" },
          { name: "তিন", type: "tin", division: "khali" },
          { name: "—", type: "tin", division: "khali" },
          { name: "ধা", type: "dha", division: "tali" },
          { name: "ধা", type: "dha", division: "tali" },
          { name: "ধিন", type: "dhin", division: "tali" },
          { name: "—", type: "dhin", division: "tali" }
        ]
      }
    };
    return taals[taalKey] || taals.teental;
  }

  /* ========================================================
   * 5. RECORDING AUDIO (MIC + INSTRUMENTS MIXED)
   * ======================================================== */
  async startRecording(micStream) {
    this.init();
    this.recordedChunks = [];

    if (micStream) {
      const micSource = this.ctx.createMediaStreamSource(micStream);
      micSource.connect(this.recordDest);
    }

    const options = { mimeType: 'audio/webm' };
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      options.mimeType = '';
    }

    this.mediaRecorder = new MediaRecorder(this.recordDest.stream, options);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.start(250);
    this.isRecording = true;
  }

  stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        this.isRecording = false;
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  /* ========================================================
   * 6. SWARA SEQUENCE PLAYER (Raga Aroha/Avoroha Preview)
   * ======================================================== */
  playIntervalSequence(intervals, onNoteStep, onComplete) {
    this.init();
    this.stopSwaraSequence();
    if (!intervals || intervals.length === 0) return;

    this.swaraSeqIntervals = intervals;
    this.swaraSeqIndex = 0;
    this.swaraSeqPlaying = true;

    const stepIntervalMs = 700;
    const playNext = () => {
      if (!this.swaraSeqPlaying || this.swaraSeqIndex >= this.swaraSeqIntervals.length) {
        this.stopSwaraSequence();
        if (onComplete) onComplete();
        return;
      }

      const interval = this.swaraSeqIntervals[this.swaraSeqIndex];
      const root = this.rootOffset;
      const noteIdx = (root + interval) % 12;
      const octave = interval >= 12 ? 5 : 4;
      const freq = this.getNoteFrequency(noteIdx, octave);

      this.playHarmoniumNote(freq, 'seq-step');
      setTimeout(() => this.stopHarmoniumNote('seq-step'), 600);

      if (onNoteStep) {
        onNoteStep(interval, this.swaraSeqIndex);
      }

      this.swaraSeqIndex++;
      this.swaraSeqTimer = setTimeout(playNext, stepIntervalMs);
    };

    playNext();
  }

  stopSwaraSequence() {
    this.swaraSeqPlaying = false;
    if (this.swaraSeqTimer) {
      clearTimeout(this.swaraSeqTimer);
      this.swaraSeqTimer = null;
    }
    this.stopHarmoniumNote('seq-step');
  }
}

// Global instance
window.audioEngine = new AudioEngine();
