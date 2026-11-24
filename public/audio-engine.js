/**
 * Audio Engine for Sur Sadhana Pro
 * Features:
 * - Realistic Tanpura Plucked Synthesis with Javari buzz harmonics
 * - Harmonium Dual-Reed Sound Synthesis
 * - Indian Tabla Synthesizer (Bayan & Dayan) + Metronome
 * - Mixed Audio Recording (Mic + Instruments)
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
    this.tanpuraTempoBpm = 40; // Pluck interval
    this.tanpuraVolume = 0.7;
    this.baseFreqA4 = 440; // Standard pitch
    this.rootOffset = 10; // A# (কালো ৫) default
    
    // Harmonium Active Voices
    this.activeHarmoniumVoices = new Map();

    // Tabla & Rhythm
    this.isMetronomePlaying = false;
    this.metronomeTimer = null;
    this.currentTaal = 'teental';
    this.taalBpm = 110;
    this.currentMatra = 0;
    this.onBeatCallback = null;

    // Recorder
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordDest = null;
    this.isRecording = false;

    // Swara Sequence Player (Raga preview / Alankar practice)
    this.swaraSeqPlaying = false;
    this.swaraSeqTimer = null;
    this.swaraSeqIntervals = [];
    this.swaraSeqIndex = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Create recording mixing bus
      this.recordDest = this.ctx.createMediaStreamDestination();
      this.masterGain.connect(this.recordDest);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Frequency calculation from note index (0 = C, 1 = C#... 11 = B)
  getNoteFrequency(noteIndex, octave = 4) {
    const midi = (octave + 1) * 12 + noteIndex;
    return this.baseFreqA4 * Math.pow(2, (midi - 69) / 12);
  }

  /* ========================================================
   * 1. AUTHENTIC ACOUSTIC TANPURA SYNTHESIS (JAVARI EFFECT)
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

    // 4 strings:
    // String 0: First string (Pa, Ma, or Ni depending on raga/scale)
    // String 1: Middle Sa
    // String 2: Middle Sa
    // String 3: Kharaj Sa (Lower octave)
    let freq = 0;
    const stringIdx = this.tanpuraCurrentString;

    // Male octave typically lower (octave 2-3), female (octave 3-4)
    const baseOctave = root < 5 ? 3 : 2;

    if (stringIdx === 0) {
      // 1st string tuning
      if (this.tanpuraTuning === 0) {
        // Pa (5th)
        freq = this.getNoteFrequency((root + 7) % 12, baseOctave);
      } else if (this.tanpuraTuning === 1) {
        // Shuddha Ma (4th)
        freq = this.getNoteFrequency((root + 5) % 12, baseOctave);
      } else if (this.tanpuraTuning === 2) {
        // Shuddha Ni (7th)
        freq = this.getNoteFrequency((root + 11) % 12, baseOctave - 1);
      } else {
        // Shuddha Dha (6th)
        freq = this.getNoteFrequency((root + 9) % 12, baseOctave);
      }
    } else if (stringIdx === 1 || stringIdx === 2) {
      // Middle Sa (Sa jodi)
      // Subtle micro-detuning (cents) between the twin Sa strings creates natural acoustic shimmering!
      const detune = stringIdx === 1 ? -1.5 : 1.5;
      const baseSa = this.getNoteFrequency(root, baseOctave);
      freq = baseSa * Math.pow(2, detune / 1200);
    } else {
      // Kharaj Sa (lower octave)
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
    // Pluck attack
    stringGain.gain.linearRampToValueAtTime(0.18 * this.tanpuraVolume, time + 0.025);
    // Long resonant sustain decay
    stringGain.gain.exponentialRampToValueAtTime(0.0001, time + 3.8);

    // Stereo Panning for immersive sound
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      const panPositions = [-0.3, -0.1, 0.1, 0.35];
      panner.pan.setValueAtTime(panPositions[stringIndex] || 0, time);
      stringGain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      stringGain.connect(this.masterGain);
    }

    // Additive synthesis with Javari (buzzing overtones characteristic of Indian bridge)
    const harmonics = [1, 2, 3, 4, 5, 6, 7];
    const amplitudes = [0.9, 0.65, 0.5, 0.35, 0.25, 0.18, 0.12];

    harmonics.forEach((h, i) => {
      const osc = ctx.createOscillator();
      const hGain = ctx.createGain();

      osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq * h, time);

      // Subtle frequency wobble for string vibration
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      vibrato.frequency.setValueAtTime(4.5 + i * 0.3, time);
      vibratoGain.gain.setValueAtTime(0.6 * h, time);
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start(time);
      vibrato.stop(time + 4.0);

      hGain.gain.setValueAtTime(amplitudes[i], time);
      osc.connect(hGain);
      hGain.connect(stringGain);

      osc.start(time);
      osc.stop(time + 4.0);
    });
  }

  /* ========================================================
   * 2. VIRTUAL HARMONIUM SOUND SYNTHESIS
   * ======================================================== */
  playHarmoniumNote(freq, noteKey) {
    this.init();
    if (this.activeHarmoniumVoices.has(noteKey)) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0.001, now);
    voiceGain.gain.linearRampToValueAtTime(0.25, now + 0.04); // quick harmonium attack

    // Filter to emulate wooden harmonium body
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now);

    // Dual reeds: Male reed + Female reed (octave + slight detune)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq * 1.002, now); // slight chorus detune

    const osc3 = ctx.createOscillator();
    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(freq * 2.003, now); // upper octave reed

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

    // Release envelope
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    setTimeout(() => {
      voice.oscillators.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch (e) {}
      });
      voice.gain.disconnect();
    }, 120);

    this.activeHarmoniumVoices.delete(noteKey);
  }

  /* ========================================================
   * 3. TABLA & METRONOME SYNTHESIS
   * ======================================================== */
  playTablaBol(type) {
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (type === 'dha' || type === 'ge' || type === 'dhin') {
      // Bayan (bass dagga pitch-bend modulation)
      const bayanOsc = ctx.createOscillator();
      const bayanGain = ctx.createGain();
      bayanOsc.type = 'sine';
      bayanOsc.frequency.setValueAtTime(130, now);
      bayanOsc.frequency.exponentialRampToValueAtTime(75, now + 0.18); // slide

      bayanGain.gain.setValueAtTime(0.5, now);
      bayanGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      bayanOsc.connect(bayanGain);
      bayanGain.connect(this.masterGain);
      bayanOsc.start(now);
      bayanOsc.stop(now + 0.3);
    }

    if (type === 'dha' || type === 'na' || type === 'tin' || type === 'ta' || type === 'dhin') {
      // Dayan (resonant high metallic ping)
      const dayanOsc = ctx.createOscillator();
      const dayanGain = ctx.createGain();
      dayanOsc.type = 'triangle';
      
      const pitch = type === 'tin' || type === 'ta' ? 420 : 360;
      dayanOsc.frequency.setValueAtTime(pitch, now);

      dayanGain.gain.setValueAtTime(0.4, now);
      dayanGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      dayanOsc.connect(dayanGain);
      dayanGain.connect(this.masterGain);
      dayanOsc.start(now);
      dayanOsc.stop(now + 0.25);
    }
  }

  startMetronome(onBeat) {
    this.init();
    if (this.isMetronomePlaying) return;
    this.isMetronomePlaying = true;
    this.currentMatra = 0;
    this.onBeatCallback = onBeat;

    const tick = () => {
      if (!this.isMetronomePlaying) return;

      const taalData = this.getTaalData(this.currentTaal);
      const bol = taalData.bols[this.currentMatra % taalData.bols.length];
      const isSam = this.currentMatra === 0;

      this.playTablaBol(bol.type);

      if (this.onBeatCallback) {
        this.onBeatCallback({
          matra: this.currentMatra + 1,
          totalMatras: taalData.bols.length,
          bolName: bol.name,
          isSam: isSam,
          division: bol.division
        });
      }

      this.currentMatra = (this.currentMatra + 1) % taalData.bols.length;

      const intervalMs = (60 / this.taalBpm) * 1000;
      this.metronomeTimer = setTimeout(tick, intervalMs);
    };

    tick();
  }

  stopMetronome() {
    this.isMetronomePlaying = false;
    if (this.metronomeTimer) {
      clearTimeout(this.metronomeTimer);
      this.metronomeTimer = null;
    }
    this.currentMatra = 0;
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
      }
    };
    return taals[taalKey] || taals.teental;
  }

  /* ========================================================
   * 4. RECORDING AUDIO (MIC + TANPURA/INSTRUMENTS MIXED)
   * ======================================================== */
  async startRecording(micStream) {
    this.init();
    this.recordedChunks = [];

    // Connect mic stream to our recorder mixing bus
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
   * 5. SWARA SEQUENCE PLAYER (Raga Preview / Alankar Practice)
   * ======================================================== */
  swaraToInterval(name) {
    if (typeof name !== 'string') return null;
    const norm = name.trim().toLowerCase().replace(/\s+/g, ' ');
    const map = {
      // English swaras (used in data/ragas.json)
      'sa': 0, 'shadja': 0,
      're': 2, 'shuddha re': 2, 'shuddha ri': 2, 'komal re': 1, 'chhota re': 1,
      'ga': 4, 'shuddha ga': 4, 'komal ga': 3,
      'ma': 5, 'shuddha ma': 5, 'teevra ma': 6, 'tivra ma': 6,
      'pa': 7,
      'dha': 9, 'shuddha dha': 9, 'komal dha': 8,
      'ni': 11, 'shuddha ni': 11, 'komal ni': 10,
      // Bengali sargam names (used in Alankars practice)
      'সা': 0, 'সাঁ': 0,
      'রে': 2, 'রেঁ': 2, 'কোমল রে': 1,
      'গা': 4, 'গাঁ': 4, 'কোমল গা': 3,
      'মা': 5, 'মাঁ': 5, 'মাষড়': 6,
      'পা': 7, 'পাঁ': 7,
      'ধা': 9, 'ধাঁ': 9, 'কোমল ধা': 8,
      'নি': 11, 'নিঁ': 11, 'কোমল নি': 10
    };
    return Object.prototype.hasOwnProperty.call(map, norm) ? map[norm] : null;
  }

  playSwaraSequence(swaraNames, { loop = true, noteDurationMs = 700 } = {}) {
    this.stopSwaraSequence();
    const intervals = (Array.isArray(swaraNames) ? swaraNames : [])
      .map(n => this.swaraToInterval(n))
      .filter(v => v != null);
    if (intervals.length === 0) return false;

    this.swaraSeqIntervals = intervals;
    this.swaraSeqIndex = 0;
    this.swaraSeqPlaying = true;
    this._playNextSwara(noteDurationMs);
    return true;
  }

  _playNextSwara(durationMs) {
    const intervals = this.swaraSeqIntervals;
    const idx = this.swaraSeqIndex % intervals.length;
    const interval = intervals[idx];

    const root = this.rootOffset;
    const noteIdx = ((root + interval) % 12 + 12) % 12;

    this.stopHarmoniumNote('swara-seq');
    this.playHarmoniumNote(this.getNoteFrequency(noteIdx, 4), 'swara-seq');

    this.swaraSeqTimer = setTimeout(() => {
      if (!this.swaraSeqPlaying) return;
      this.swaraSeqIndex = (this.swaraSeqIndex + 1) % intervals.length;
      this._playNextSwara(durationMs);
    }, durationMs);
  }

  stopSwaraSequence() {
    this.swaraSeqPlaying = false;
    if (this.swaraSeqTimer) {
      clearTimeout(this.swaraSeqTimer);
      this.swaraSeqTimer = null;
    }
    this.stopHarmoniumNote('swara-seq');
  }

  isSwaraSequencePlaying() {
    return this.swaraSeqPlaying;
  }
}

// Global instance
window.audioEngine = new AudioEngine();
