/**
 * Main Application Logic for Sur Sadhana Pro
 * Upgraded Features:
 * - IndexedDB Client-Side Private Recording Storage (Zero-Server Offline Friendly)
 * - Screen Wake Lock API (keeps mobile display on during riyaz)
 * - 22-Shruti Just Intonation Tuning System Toggle
 * - Raga Audio Preview ("▶️ আরোহ-অবরোহ শুনুন") via Web Audio synthesis
 * - Two-Clocks Lookahead Tabla Machine with 8 Taals & Laya Multipliers
 * - Progressive Web App (PWA) Service Worker Registration
 */

// IndexedDB Helper for private client-side vocal recordings
const RiyazIDB = {
  db: null,
  async init() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open('SurSadhanaRecordingsDB', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('recordings')) {
          db.createObjectStore('recordings', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = () => resolve(null);
    });
  },
  async save(blob, name) {
    if (!this.db) await this.init();
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db.transaction('recordings', 'readwrite');
      const store = tx.objectStore('recordings');
      const item = {
        id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: name || `রেওয়াজ-${new Date().toLocaleTimeString('bn-BD')}`,
        blob: blob,
        size: blob.size,
        createdAt: new Date().toISOString()
      };
      store.put(item);
      tx.oncomplete = () => resolve(item);
      tx.onerror = () => resolve(null);
    });
  },
  async getAll() {
    if (!this.db) await this.init();
    if (!this.db) return [];
    return new Promise((resolve) => {
      const tx = this.db.transaction('recordings', 'readonly');
      const store = tx.objectStore('recordings');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  },
  async delete(id) {
    if (!this.db) await this.init();
    if (!this.db) return false;
    return new Promise((resolve) => {
      const tx = this.db.transaction('recordings', 'readwrite');
      const store = tx.objectStore('recordings');
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Screen Wake Lock Handler
  let wakeLock = null;
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake lock failed', err);
      }
    }
  };
  const releaseWakeLock = () => {
    if (wakeLock) {
      wakeLock.release().then(() => { wakeLock = null; }).catch(() => {});
    }
  };

  const scaleSelect = document.getElementById('scaleSelect');
  const startMicBtn = document.getElementById('startMicBtn');
  const startTanpuraBtn = document.getElementById('startTanpuraBtn');
  const recordBtn = document.getElementById('recordBtn');
  const sessionTimerEl = document.getElementById('sessionTimer');
  const accuracyScoreEl = document.getElementById('accuracyScore');
  const totalMinsDisplay = document.getElementById('totalMinsDisplay');
  const streakCount = document.getElementById('streakCount');

  // Tuning System Select (Shruti vs 12-TET)
  const tuningSelect = document.getElementById('tuningSelect');

  // Pitch elements
  const sargamDisplay = document.getElementById('sargamDisplay');
  const westernDisplay = document.getElementById('westernDisplay');
  const pitchNeedle = document.getElementById('pitchNeedle');
  const saptakBadge = document.getElementById('saptakBadge');
  const pitchHero = document.getElementById('pitchHero');
  const swaraMatrix = document.getElementById('swaraMatrix');
  const pitchCanvas = document.getElementById('pitchCanvas');
  const apaswaraAlert = document.getElementById('apaswaraAlert');
  const activeRagaPill = document.getElementById('activeRagaPill');
  const activeRagaName = document.getElementById('activeRagaName');
  const clearRagaBtn = document.getElementById('clearRagaBtn');

  // Tanpura elements
  const tanpuraStrings = document.querySelectorAll('.tanpura-wire');
  const tanpuraTuningSelect = document.getElementById('tanpuraTuningSelect');
  const tanpuraTempoSlider = document.getElementById('tanpuraTempoSlider');
  const tanpuraVolumeSlider = document.getElementById('tanpuraVolumeSlider');

  // Tabla elements
  const taalSelect = document.getElementById('taalSelect');
  const layaSelect = document.getElementById('layaSelect');
  const taalBpmSlider = document.getElementById('taalBpmSlider');
  const taalBpmVal = document.getElementById('taalBpmVal');
  const startTaalBtn = document.getElementById('startTaalBtn');
  const taalDisplay = document.getElementById('taalDisplay');

  // Harmonium & Drones
  const harmoniumKeyboard = document.getElementById('harmoniumKeyboard');
  const droneSaBtn = document.getElementById('droneSaBtn');
  const dronePaBtn = document.getElementById('dronePaBtn');

  // Studio Ambience & Swaramandal
  const reverbToggle = document.getElementById('reverbToggle');
  const reverbLevelSlider = document.getElementById('reverbLevelSlider');
  const swaramandalBtn = document.getElementById('swaramandalBtn');

  // Guided Alankar Practice Elements
  const guidedPracticeBox = document.getElementById('guidedPracticeBox');
  const guidedPracticeTitle = document.getElementById('guidedPracticeTitle');
  const guidedSwaraTrail = document.getElementById('guidedSwaraTrail');
  const startGuidedPracticeBtn = document.getElementById('startGuidedPracticeBtn');
  const stopGuidedPracticeBtn = document.getElementById('stopGuidedPracticeBtn');
  const guidedStatsStrip = document.getElementById('guidedStatsStrip');
  const practiceScoreEl = document.getElementById('practiceScore');
  const practiceHitRateEl = document.getElementById('practiceHitRate');
  const currentTargetNoteEl = document.getElementById('currentTargetNote');
  const alankarList = document.getElementById('alankarList');

  // Vocal Range Finder Elements
  const vocalRangeBtn = document.getElementById('vocalRangeBtn');
  const vocalRangeModal = document.getElementById('vocalRangeModal');
  const closeRangeModalBtn = document.getElementById('closeRangeModalBtn');
  const toggleRangeTestBtn = document.getElementById('toggleRangeTestBtn');
  const rangeCurrentNote = document.getElementById('rangeCurrentNote');
  const rangeLowestNote = document.getElementById('rangeLowestNote');
  const rangeHighestNote = document.getElementById('rangeHighestNote');
  const rangeResultSummary = document.getElementById('rangeResultSummary');
  const rangeVoiceTypeTitle = document.getElementById('rangeVoiceTypeTitle');
  const rangeOctavesSpan = document.getElementById('rangeOctavesSpan');
  const rangeRecommendedScale = document.getElementById('rangeRecommendedScale');
  const applyRecommendedScaleBtn = document.getElementById('applyRecommendedScaleBtn');

  // Theme Select
  const themeSelect = document.getElementById('themeSelect');
  const THEME_KEY = 'gan-si-theme-selection';

  // Recordings & History
  const recordingsList = document.getElementById('recordingsList');

  /* ========================================================
   * 1. THEME SWITCHER
   * ======================================================== */
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  document.body.setAttribute('data-theme', savedTheme);
  if (themeSelect) {
    themeSelect.value = savedTheme;
    themeSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      document.body.setAttribute('data-theme', val);
      localStorage.setItem(THEME_KEY, val);
    });
  }

  /* ========================================================
   * 2. TUNING SYSTEM SELECTOR (SHRUTI VS 12-TET)
   * ======================================================== */
  if (tuningSelect) {
    tuningSelect.addEventListener('change', (e) => {
      pitchDetector.setTuningSystem(e.target.value);
    });
  }

  /* ========================================================
   * 3. STATS & DAILY STREAK INITIALIZATION
   * ======================================================== */
  const loadUserStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const stats = await res.json();
        if (streakCount) streakCount.textContent = stats.currentStreak || 1;
        if (totalMinsDisplay) totalMinsDisplay.textContent = `${stats.totalMinutes || 0} মি.`;
      }
    } catch (e) {
      console.warn('Stats API unreachable', e);
    }
  };
  loadUserStats();

  /* ========================================================
   * 4. STUDIO AMBIENCE & SWARAMANDAL
   * ======================================================== */
  if (reverbToggle) {
    reverbToggle.addEventListener('change', (e) => {
      window.audioEngine.setReverbEnabled(e.target.checked);
    });
  }
  if (reverbLevelSlider) {
    reverbLevelSlider.addEventListener('input', (e) => {
      window.audioEngine.setReverbLevel(parseFloat(e.target.value));
    });
  }
  if (swaramandalBtn) {
    swaramandalBtn.addEventListener('click', () => {
      const root = parseInt(scaleSelect.value, 10);
      const intervals = pitchDetector.activeRaga && pitchDetector.activeRaga.allowedIntervals
        ? pitchDetector.activeRaga.allowedIntervals
        : [0, 2, 4, 5, 7, 9, 11];
      window.audioEngine.strumSwaramandal(root, intervals);
    });
  }

  /* ========================================================
   * 5. ABOUT / HELP MODAL
   * ======================================================== */
  const aboutBtn = document.getElementById('aboutBtn');
  const aboutModal = document.getElementById('aboutModal');
  const closeAboutModalBtn = document.getElementById('closeAboutModalBtn');
  if (aboutBtn && aboutModal) {
    aboutBtn.addEventListener('click', () => aboutModal.classList.add('open'));
    if (closeAboutModalBtn) {
      closeAboutModalBtn.addEventListener('click', () => aboutModal.classList.remove('open'));
    }
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) aboutModal.classList.remove('open');
    });
  }

  // Initialize Canvas
  if (pitchCanvas) {
    pitchDetector.setCanvas(pitchCanvas);
    const resizeCanvas = () => {
      const w = pitchCanvas.parentElement ? pitchCanvas.parentElement.clientWidth : 0;
      pitchCanvas.width = w > 50 ? w : 480;
      pitchCanvas.height = 180;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  /* ========================================================
   * 6. NAVIGATION & TAB SWITCHING
   * ======================================================== */
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const activePanel = document.getElementById(target);
      if (activePanel) activePanel.classList.add('active');
    });
  });

  /* ========================================================
   * 7. SCALE SYNC & SWARA MATRIX
   * ======================================================== */
  const updateScaleMatrix = () => {
    const root = parseInt(scaleSelect.value, 10);
    window.audioEngine.rootOffset = root;

    if (!swaraMatrix) return;
    swaraMatrix.innerHTML = '';

    const allNotes = [
      { name: "সা", interval: 0 },
      { name: "রে♭", interval: 1 },
      { name: "রে", interval: 2 },
      { name: "গা♭", interval: 3 },
      { name: "গা", interval: 4 },
      { name: "মা", interval: 5 },
      { name: "মা♯", interval: 6 },
      { name: "পা", interval: 7 },
      { name: "ধা♭", interval: 8 },
      { name: "ধা", interval: 9 },
      { name: "নি♭", interval: 10 },
      { name: "নি", interval: 11 },
      { name: "সাঁ", interval: 12 }
    ];

    allNotes.forEach(item => {
      const noteIdx = (root + item.interval) % 12;
      const western = pitchDetector.noteStrings[noteIdx];

      const chip = document.createElement('div');
      chip.className = 'swara-chip';
      chip.id = `swara-chip-${item.interval % 12}`;
      chip.innerHTML = `
        <div class="swara-name">${item.name}</div>
        <div class="western-name">${western}</div>
      `;
      chip.addEventListener('click', () => {
        const freq = window.audioEngine.getNoteFrequency(noteIdx, 4);
        window.audioEngine.playHarmoniumNote(freq, 'preview');
        setTimeout(() => window.audioEngine.stopHarmoniumNote('preview'), 550);
      });
      swaraMatrix.appendChild(chip);
    });

    renderHarmoniumKeys();
  };

  scaleSelect.addEventListener('change', updateScaleMatrix);
  updateScaleMatrix();

  /* ========================================================
   * 8. LIVE PITCH DETECTOR LISTENER & APASWARA DETECTION
   * ======================================================== */
  startMicBtn.addEventListener('click', async () => {
    if (pitchDetector.isListening) {
      pitchDetector.stopListening();
      releaseWakeLock();
      startMicBtn.innerHTML = "🎤 রেওয়াজ শুরু করুন";
      startMicBtn.classList.remove('btn-danger');
      startMicBtn.classList.add('btn-primary');
      sargamDisplay.textContent = "--";
      westernDisplay.innerHTML = "নোট: -- | ফ্রিকোয়েন্সি: 0.0 Hz";
      pitchHero.classList.remove('locked-in');
      if (apaswaraAlert) apaswaraAlert.classList.remove('visible');
      return;
    }

    try {
      await pitchDetector.startListening();
      requestWakeLock();
      startMicBtn.innerHTML = "⏹️ রেওয়াজ থামান";
      startMicBtn.classList.remove('btn-primary');
      startMicBtn.classList.add('btn-danger');
    } catch (err) {
      alert(err.message || "মাইক্রোফোন চালু করা যায়নি!");
    }
  });

  pitchDetector.onPitchUpdate = (data) => {
    document.querySelectorAll('.swara-chip').forEach(c => c.classList.remove('active-pitch'));

    if (!data) {
      sargamDisplay.classList.remove('active', 'in-tune');
      pitchHero.classList.remove('locked-in');
      if (apaswaraAlert) apaswaraAlert.classList.remove('visible');
      return;
    }

    sargamDisplay.textContent = data.sargamShortName;
    westernDisplay.innerHTML = `নোট: <strong>${data.noteName}</strong> | <strong>${data.freq}</strong> Hz | <strong>${data.cents > 0 ? '+' : ''}${data.cents}</strong> cents (${data.tuningSystem === 'just_intonation' ? 'শ্রুতি' : '12-TET'})`;
    saptakBadge.textContent = data.saptak;

    const pct = Math.max(0, Math.min(100, 50 + data.cents));
    pitchNeedle.style.left = `${pct}%`;

    if (data.isApaswara && apaswaraAlert) {
      apaswaraAlert.textContent = data.apaswaraMsg;
      apaswaraAlert.classList.add('visible');
    } else if (apaswaraAlert) {
      apaswaraAlert.classList.remove('visible');
    }

    if (data.isInTune) {
      sargamDisplay.classList.add('in-tune');
      pitchHero.classList.add('locked-in');
      pitchNeedle.style.backgroundColor = '#10b981';
      pitchNeedle.style.boxShadow = '0 0 14px #10b981';
    } else {
      sargamDisplay.classList.remove('in-tune');
      sargamDisplay.classList.add('active');
      pitchHero.classList.remove('locked-in');
      pitchNeedle.style.backgroundColor = '#f59e0b';
      pitchNeedle.style.boxShadow = '0 0 8px #f59e0b';
    }

    const activeChip = document.getElementById(`swara-chip-${data.sargamIndex}`);
    if (activeChip) activeChip.classList.add('active-pitch');

    if (accuracyScoreEl && data.accuracyPercent) {
      accuracyScoreEl.textContent = `${data.accuracyPercent}%`;
    }

    handleGuidedPracticePitch(data);
  };

  /* ========================================================
   * 9. ACTIVE RAGA SELECTION & DISMISS
   * ======================================================== */
  if (clearRagaBtn) {
    clearRagaBtn.addEventListener('click', () => {
      pitchDetector.setActiveRaga(null);
      activeRagaPill.style.display = 'none';
      if (apaswaraAlert) apaswaraAlert.classList.remove('visible');
    });
  }

  /* ========================================================
   * 10. TANPURA CONTROLS
   * ======================================================== */
  const onStringPluck = (stringIdx) => {
    tanpuraStrings.forEach((wire, i) => {
      if (i === stringIdx) {
        wire.classList.add('plucked');
        setTimeout(() => wire.classList.remove('plucked'), 600);
      }
    });
  };

  startTanpuraBtn.addEventListener('click', () => {
    if (window.audioEngine.isTanpuraPlaying) {
      window.audioEngine.stopTanpura();
      startTanpuraBtn.innerHTML = "🪕 তানপুরা";
      startTanpuraBtn.classList.remove('active');
    } else {
      window.audioEngine.startTanpura(onStringPluck);
      startTanpuraBtn.innerHTML = "🔇 তানপুরা বন্ধ";
      startTanpuraBtn.classList.add('active');
    }
  });

  tanpuraTuningSelect.addEventListener('change', (e) => {
    window.audioEngine.tanpuraTuning = parseInt(e.target.value, 10);
  });

  tanpuraTempoSlider.addEventListener('input', (e) => {
    window.audioEngine.tanpuraTempoBpm = parseInt(e.target.value, 10);
  });

  tanpuraVolumeSlider.addEventListener('input', (e) => {
    window.audioEngine.tanpuraVolume = parseFloat(e.target.value);
  });

  /* ========================================================
   * 11. VIRTUAL HARMONIUM KEYBOARD & CONTINUOUS DRONE STOPS
   * ======================================================== */
  function renderHarmoniumKeys() {
    if (!harmoniumKeyboard) return;
    harmoniumKeyboard.innerHTML = '';

    const root = window.audioEngine.rootOffset;
    const totalKeys = 24;
    const startMidi = 48; // C3

    const keyboardKeys = [
      'A','W','S','E','D','F','T','G','Y','H','U','J',
      'K','O','L','P',';',"'",']','\\','Z','X','C','V'
    ];

    for (let i = 0; i < totalKeys; i++) {
      const midi = startMidi + i;
      const noteIdx = midi % 12;
      const isBlack = [1, 3, 6, 8, 10].includes(noteIdx);
      const noteName = pitchDetector.noteStrings[noteIdx];
      const sargamIdx = (noteIdx - root + 12) % 12;
      const sargamShort = pitchDetector.sargamShort[sargamIdx];

      const keyEl = document.createElement('div');
      keyEl.className = `piano-key ${isBlack ? 'black' : 'white'}`;
      keyEl.dataset.midi = midi;
      keyEl.dataset.note = noteName;

      const octave = Math.floor(midi / 12) - 1;
      const freq = window.audioEngine.baseFreqA4 * Math.pow(2, (midi - 69) / 12);

      keyEl.innerHTML = `
        <div><strong>${sargamShort}</strong></div>
        <div style="font-size:0.6rem;opacity:0.8;">${noteName}${octave}</div>
        <div class="key-shortcut">[${keyboardKeys[i] || ''}]</div>
      `;

      const startPlay = (e) => {
        e.preventDefault();
        keyEl.classList.add('pressed');
        window.audioEngine.playHarmoniumNote(freq, `key-${midi}`);
      };

      const stopPlay = (e) => {
        e.preventDefault();
        keyEl.classList.remove('pressed');
        window.audioEngine.stopHarmoniumNote(`key-${midi}`);
      };

      keyEl.addEventListener('mousedown', startPlay);
      keyEl.addEventListener('mouseup', stopPlay);
      keyEl.addEventListener('mouseleave', stopPlay);
      keyEl.addEventListener('touchstart', startPlay, { passive: false });
      keyEl.addEventListener('touchend', stopPlay, { passive: false });

      harmoniumKeyboard.appendChild(keyEl);
    }
  }

  if (droneSaBtn) {
    droneSaBtn.addEventListener('click', () => {
      const root = parseInt(scaleSelect.value, 10);
      const saFreq = window.audioEngine.getNoteFrequency(root, 3);
      const isPlaying = window.audioEngine.toggleHarmoniumDrone(saFreq, 'drone-sa');
      if (isPlaying) {
        droneSaBtn.classList.add('active');
        droneSaBtn.textContent = '🔊 সা ড্রোন চালু';
      } else {
        droneSaBtn.classList.remove('active');
        droneSaBtn.textContent = 'সা সুরতি (Sa Drone)';
      }
    });
  }

  if (dronePaBtn) {
    dronePaBtn.addEventListener('click', () => {
      const root = parseInt(scaleSelect.value, 10);
      const paFreq = window.audioEngine.getNoteFrequency((root + 7) % 12, 3);
      const isPlaying = window.audioEngine.toggleHarmoniumDrone(paFreq, 'drone-pa');
      if (isPlaying) {
        dronePaBtn.classList.add('active');
        dronePaBtn.textContent = '🔊 পা ড্রোন চালু';
      } else {
        dronePaBtn.classList.remove('active');
        dronePaBtn.textContent = 'পা সুরতি (Pa Drone)';
      }
    });
  }

  const keyMap = {
    'KeyA': 48, 'KeyW': 49, 'KeyS': 50, 'KeyE': 51, 'KeyD': 52, 'KeyF': 53,
    'KeyT': 54, 'KeyG': 55, 'KeyY': 56, 'KeyH': 57, 'KeyU': 58, 'KeyJ': 59,
    'KeyK': 60, 'KeyO': 61, 'KeyL': 62, 'KeyP': 63, 'Semicolon': 64, 'Quote': 65
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat || !keyMap[e.code]) return;
    const midi = keyMap[e.code];
    const keyEl = document.querySelector(`.piano-key[data-midi="${midi}"]`);
    if (keyEl) {
      keyEl.classList.add('pressed');
      const freq = window.audioEngine.baseFreqA4 * Math.pow(2, (midi - 69) / 12);
      window.audioEngine.playHarmoniumNote(freq, `key-${midi}`);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (!keyMap[e.code]) return;
    const midi = keyMap[e.code];
    const keyEl = document.querySelector(`.piano-key[data-midi="${midi}"]`);
    if (keyEl) {
      keyEl.classList.remove('pressed');
      window.audioEngine.stopHarmoniumNote(`key-${midi}`);
    }
  });

  /* ========================================================
   * 12. TABLA LOOKAHEAD SCHEDULER UI
   * ======================================================== */
  const renderTaalMatras = () => {
    if (!taalDisplay) return;
    taalDisplay.innerHTML = '';

    const data = window.audioEngine.getTaalData(window.audioEngine.currentTaal);
    data.bols.forEach((b, idx) => {
      const pill = document.createElement('div');
      pill.className = `matra-pill ${b.division}`;
      pill.id = `matra-pill-${idx + 1}`;
      pill.innerHTML = `
        <span>${b.name}</span>
        <span style="font-size:0.6rem;opacity:0.7;">${idx + 1}</span>
      `;
      taalDisplay.appendChild(pill);
    });
  };

  taalSelect.addEventListener('change', (e) => {
    window.audioEngine.currentTaal = e.target.value;
    renderTaalMatras();
  });

  if (layaSelect) {
    layaSelect.addEventListener('change', (e) => {
      window.audioEngine.setLayaMultiplier(parseInt(e.target.value, 10));
    });
  }

  taalBpmSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    window.audioEngine.taalBpm = val;
    taalBpmVal.textContent = `${val} BPM`;
  });

  startTaalBtn.addEventListener('click', () => {
    if (window.audioEngine.isMetronomePlaying) {
      window.audioEngine.stopMetronome();
      startTaalBtn.innerHTML = "🥁 তাল শুরু করুন";
      startTaalBtn.classList.remove('active');
      document.querySelectorAll('.matra-pill').forEach(p => p.classList.remove('current-beat'));
    } else {
      window.audioEngine.startMetronome((beat) => {
        document.querySelectorAll('.matra-pill').forEach(p => p.classList.remove('current-beat'));
        const active = document.getElementById(`matra-pill-${beat.matra}`);
        if (active) active.classList.add('current-beat');
      });
      startTaalBtn.innerHTML = "⏹️ তাল বন্ধ করুন";
      startTaalBtn.classList.add('active');
    }
  });
  renderTaalMatras();

  /* ========================================================
   * 13. GUIDED INTERACTIVE ALANKAR PRACTICE ARENA
   * ======================================================== */
  let guidedNotesQueue = [];
  let currentTargetIndex = 0;
  let isGuidedPracticeRunning = false;
  let practiceScore = 0;
  let targetHoldCounter = 0;

  const defaultAlankars = [
    {
      title: "১. সরল আরোহণ-অবরোহণ (১ম অলংকার)",
      notes: "সা রে গা মা পা ধা নি সাঁ | সাঁ নি ধা পা মা গা রে সা"
    },
    {
      title: "২. দ্বিত্ব স্বর অলংকার (২য় অলংকার)",
      notes: "সা সা রে রে গা গা মা মা পা পা ধা ধা নি নি সাঁ সাঁ | সাঁ সাঁ নি নি ধা ধা পা পা মা মা গা গা রে রে সা সা"
    },
    {
      title: "৩. ত্রিস্বর মিলন (৩য় অলংকার)",
      notes: "সা রে গা, রে গা মা, গা মা পা, মা পা ধা, পা ধা নি, ধা নি সাঁ | সাঁ নি ধা, নি ধা পা, ধা পা মা, পা মা গা, মা গা রে, গা রে সা"
    },
    {
      title: "৪. চতুর্বিধ গতি (৪র্থ অলংকার)",
      notes: "সা রে গা মা, রে গা মা পা, গা মা পা ধা, মা পা ধা নি, পা ধা নি সাঁ"
    },
    {
      title: "৫. লম্ফ স্বর / বক্র পল্টা (৫ম অলংকার)",
      notes: "সা গা, রে মা, গা পা, মা ধা, পা নি, ধা সাঁ | সাঁ ধা, নি পা, ধা মা, পা গা, মা রে, গা সা"
    }
  ];

  const parseAlankarSwaras = (noteString) => {
    const rawTokens = noteString.replace(/[|,]/g, ' ').split(/\s+/).filter(Boolean);
    return rawTokens.map(tok => tok.trim()).filter(t => t.length > 0);
  };

  const setupGuidedPractice = (alankar) => {
    guidedNotesQueue = parseAlankarSwaras(alankar.notes);
    currentTargetIndex = 0;
    practiceScore = 0;
    targetHoldCounter = 0;

    if (guidedPracticeTitle) {
      guidedPracticeTitle.textContent = `🎯 ${alankar.title}`;
    }

    if (guidedSwaraTrail) {
      guidedSwaraTrail.innerHTML = '';
      guidedNotesQueue.forEach((sw, idx) => {
        const item = document.createElement('div');
        item.className = `guided-swara-item ${idx === 0 ? 'target-current' : ''}`;
        item.id = `guided-swara-${idx}`;
        item.textContent = sw;
        guidedSwaraTrail.appendChild(item);
      });
    }

    if (currentTargetNoteEl && guidedNotesQueue[0]) {
      currentTargetNoteEl.textContent = guidedNotesQueue[0];
    }
  };

  const startGuidedPractice = async () => {
    if (!pitchDetector.isListening) {
      try {
        await pitchDetector.startListening();
        requestWakeLock();
        startMicBtn.innerHTML = "⏹️ রেওয়াজ থামান";
        startMicBtn.classList.remove('btn-primary');
        startMicBtn.classList.add('btn-danger');
      } catch (err) {
        alert("মাইক্রোফোন চালু করা যায়নি!");
        return;
      }
    }

    isGuidedPracticeRunning = true;
    startGuidedPracticeBtn.style.display = 'none';
    stopGuidedPracticeBtn.style.display = 'inline-flex';
    guidedStatsStrip.style.display = 'flex';
  };

  const stopGuidedPractice = () => {
    isGuidedPracticeRunning = false;
    startGuidedPracticeBtn.style.display = 'inline-flex';
    stopGuidedPracticeBtn.style.display = 'none';

    fetch('/api/stats/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        minutes: 2,
        accuracy: Math.min(100, Math.round(practiceScore * 2)),
        alankar: guidedPracticeTitle ? guidedPracticeTitle.textContent : "অলংকার"
      })
    }).then(() => loadUserStats()).catch(() => {});
  };

  if (startGuidedPracticeBtn) startGuidedPracticeBtn.addEventListener('click', startGuidedPractice);
  if (stopGuidedPracticeBtn) stopGuidedPracticeBtn.addEventListener('click', stopGuidedPractice);

  const handleGuidedPracticePitch = (data) => {
    if (!isGuidedPracticeRunning || currentTargetIndex >= guidedNotesQueue.length) return;

    const targetSwara = guidedNotesQueue[currentTargetIndex];
    const normTarget = targetSwara.replace(/['ঁ♭♯]/g, '').trim();
    const normSung = data.sargamShortName.replace(/['ঁ♭♯]/g, '').trim();

    if (data.isInTune && normTarget === normSung) {
      targetHoldCounter++;
      if (targetHoldCounter >= 4) {
        targetHoldCounter = 0;
        const currentCard = document.getElementById(`guided-swara-${currentTargetIndex}`);
        if (currentCard) {
          currentCard.classList.remove('target-current');
          currentCard.classList.add('hit-success');
        }

        practiceScore += 10;
        if (practiceScoreEl) practiceScoreEl.textContent = practiceScore;

        currentTargetIndex++;
        if (currentTargetIndex < guidedNotesQueue.length) {
          const nextCard = document.getElementById(`guided-swara-${currentTargetIndex}`);
          if (nextCard) nextCard.classList.add('target-current');
          if (currentTargetNoteEl) currentTargetNoteEl.textContent = guidedNotesQueue[currentTargetIndex];
        } else {
          if (currentTargetNoteEl) currentTargetNoteEl.textContent = "সম্পূর্ণ! 🎉";
          stopGuidedPractice();
          alert(`অভিনন্দন! আপনি সফলভাবে অলংকারটি সম্পন্ন করেছেন!\nমোট স্কোর: ${practiceScore} পয়েন্ট`);
        }
      }
    } else {
      targetHoldCounter = Math.max(0, targetHoldCounter - 1);
    }
  };

  const renderAlankars = (items) => {
    if (!alankarList) return;
    alankarList.innerHTML = '';
    items.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = `alankar-card ${idx === 0 ? 'selected' : ''}`;
      card.innerHTML = `
        <div>
          <div class="alankar-title">${item.title}</div>
          <div class="alankar-notes">${item.notes}</div>
        </div>
        <button class="btn-outline" style="font-size:0.8rem;padding:6px 12px;">অনুশীলন</button>
      `;
      card.addEventListener('click', () => {
        document.querySelectorAll('.alankar-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        setupGuidedPractice(item);
      });
      alankarList.appendChild(card);
    });

    if (items[0]) setupGuidedPractice(items[0]);
  };

  fetch('/api/alankars')
    .then(res => res.json())
    .then(data => renderAlankars(data.alankars || defaultAlankars))
    .catch(() => renderAlankars(defaultAlankars));

  /* ========================================================
   * 14. VOCAL RANGE FINDER
   * ======================================================== */
  let recommendedRootScaleIndex = 1;

  if (vocalRangeBtn && vocalRangeModal) {
    vocalRangeBtn.addEventListener('click', () => {
      vocalRangeModal.classList.add('open');
      rangeResultSummary.style.display = 'none';
      rangeLowestNote.textContent = '--';
      rangeHighestNote.textContent = '--';
      rangeCurrentNote.textContent = '--';
    });
  }

  if (closeRangeModalBtn && vocalRangeModal) {
    closeRangeModalBtn.addEventListener('click', () => {
      if (pitchDetector.isTestingRange) {
        pitchDetector.stopRangeTest();
      }
      vocalRangeModal.classList.remove('open');
    });
  }

  if (toggleRangeTestBtn) {
    toggleRangeTestBtn.addEventListener('click', async () => {
      if (pitchDetector.isTestingRange) {
        const result = pitchDetector.stopRangeTest();
        toggleRangeTestBtn.textContent = '🎙️ পুনরায় টেস্ট করুন';
        toggleRangeTestBtn.classList.remove('btn-danger');
        toggleRangeTestBtn.classList.add('btn-primary');

        if (result) {
          rangeResultSummary.style.display = 'block';
          rangeVoiceTypeTitle.textContent = `ভোকাল ক্যাটাগরি: ${result.voiceType}`;
          rangeOctavesSpan.textContent = `সর্বনিম্ন: ${result.minNote} ➔ সর্বোচ্চ: ${result.maxNote} (মোট ${result.octavesSpan} অক্টেভ)`;
          rangeRecommendedScale.textContent = `আপনার জন্য আদর্শ স্কেল: সা = ${result.idealRootName}`;
          recommendedRootScaleIndex = result.idealRootIdx;
        }
      } else {
        if (!pitchDetector.isListening) {
          try {
            await pitchDetector.startListening();
            requestWakeLock();
            startMicBtn.innerHTML = "⏹️ রেওয়াজ থামান";
            startMicBtn.classList.remove('btn-primary');
            startMicBtn.classList.add('btn-danger');
          } catch (e) {
            alert("মাইক্রোফোন অনুমতি ছাড়া রেঞ্জ টেস্ট সম্ভব নয়।");
            return;
          }
        }

        pitchDetector.startRangeTest();
        toggleRangeTestBtn.textContent = '⏹️ টেস্ট সমাপ্ত করুন';
        toggleRangeTestBtn.classList.remove('btn-primary');
        toggleRangeTestBtn.classList.add('btn-danger');
        rangeResultSummary.style.display = 'none';

        pitchDetector.onRangeSample = (sample) => {
          rangeCurrentNote.textContent = sample.currentNote;
          rangeLowestNote.textContent = sample.minNote;
          rangeHighestNote.textContent = sample.maxNote;
        };
      }
    });
  }

  if (applyRecommendedScaleBtn) {
    applyRecommendedScaleBtn.addEventListener('click', () => {
      scaleSelect.value = recommendedRootScaleIndex;
      updateScaleMatrix();
      vocalRangeModal.classList.remove('open');
      alert(`স্কেল সফলভাবে সা = ${pitchDetector.noteStrings[recommendedRootScaleIndex]} সেট করা হয়েছে!`);
    });
  }

  /* ========================================================
   * 15. RAGA EXPLORER & AUDIO PREVIEW (আরোহ-অবরোহ শুনুন)
   * ======================================================== */
  const ragaGrid = document.getElementById('ragaGrid');
  const renderRagas = (items) => {
    if (!ragaGrid) return;
    ragaGrid.innerHTML = '';
    items.forEach(r => {
      const card = document.createElement('div');
      card.className = 'raga-card';
      card.innerHTML = `
        <h3>${r.name}</h3>
        <div class="raga-info-row"><strong>ঠাট:</strong> ${r.thaat} | <strong>সময়:</strong> ${r.time}</div>
        <div class="raga-info-row"><strong>বাদী:</strong> ${r.vadi} | <strong>সমবাদী:</strong> ${r.samvadi}</div>
        <div class="raga-info-row"><strong>বর্জিত স্বর:</strong> ${r.varjya || 'নেই'}</div>
        <div class="raga-info-row"><strong>আরোহ:</strong> ${r.aroha}</div>
        <div class="raga-info-row"><strong>অবরোহ:</strong> ${r.avoroha}</div>
        <div class="raga-info-row"><strong>পকড়:</strong> ${r.pakad}</div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn-outline raga-play-btn" style="font-size:0.8rem;padding:6px 12px;flex:1;">▶️ আরোহ-অবরোহ শুনুন</button>
          <button class="btn-primary raga-select-btn" style="font-size:0.8rem;padding:6px 12px;flex:1;">🎵 এই রাগে রেওয়াজ</button>
        </div>
      `;

      // Play Aroha/Avoroha Preview
      const playBtn = card.querySelector('.raga-play-btn');
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.audioEngine.swaraSeqPlaying) {
          window.audioEngine.stopSwaraSequence();
          playBtn.textContent = '▶️ আরোহ-অবরোহ শুনুন';
        } else {
          playBtn.textContent = '⏹️ থামান';
          const intervals = r.allowedIntervals || [0, 2, 4, 5, 7, 9, 11];
          // Construct Aroha + Avoroha sequence
          const fullSeq = [...intervals, 12, ...[...intervals].reverse()];
          window.audioEngine.playIntervalSequence(fullSeq, null, () => {
            playBtn.textContent = '▶️ আরোহ-অবরোহ শুনুন';
          });
        }
      });

      // Select Raga for Practice
      const selectBtn = card.querySelector('.raga-select-btn');
      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        pitchDetector.setActiveRaga(r);
        if (activeRagaPill && activeRagaName) {
          activeRagaName.textContent = r.name;
          activeRagaPill.style.display = 'inline-flex';
        }
        if (r.firstString !== undefined) {
          tanpuraTuningSelect.value = r.firstString;
          window.audioEngine.tanpuraTuning = r.firstString;
        }
        document.querySelector('.tab-btn[data-tab="tab-pitch"]').click();
      });

      ragaGrid.appendChild(card);
    });
  };

  fetch('/api/ragas')
    .then(res => res.json())
    .then(data => renderRagas(data.ragas || []))
    .catch(() => console.warn('Could not fetch ragas API'));

  /* ========================================================
   * 16. INDEXEDDB CLIENT-SIDE PRIVATE RECORDINGS & CLOUD SYNC
   * ======================================================== */
  const loadLocalRecordings = async () => {
    if (!recordingsList) return;
    const localItems = await RiyazIDB.getAll();

    if (!localItems || localItems.length === 0) {
      recordingsList.innerHTML = `
        <div style="color:var(--text-muted);font-size:0.9rem;text-align:center;padding:20px;">
          কোনো রেকর্ডিং নেই। উপরে <strong>"⏺️ রেকর্ড"</strong> বাটন চেপে আপনার রেওয়াজ রেকর্ড করুন। (এটি সম্পূর্ণ গোপনে আপনার ব্রাউজারে সংরক্ষিত থাকবে)
        </div>
      `;
      return;
    }

    recordingsList.innerHTML = '';
    // Show newest first
    localItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    localItems.forEach(rec => {
      const item = document.createElement('div');
      item.className = 'recording-item';
      const formattedDate = new Date(rec.createdAt).toLocaleString('bn-BD', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      const sizeMb = (rec.size / (1024 * 1024)).toFixed(2);
      const audioUrl = URL.createObjectURL(rec.blob);

      item.innerHTML = `
        <div>
          <strong>${rec.name}</strong>
          <div style="font-size:0.75rem;color:var(--text-muted);">${formattedDate} • ${sizeMb} MB (ব্যক্তিগত অফলাইন স্টোরেজ)</div>
        </div>
        <audio controls src="${audioUrl}"></audio>
        <div style="display:flex;gap:6px;">
          <a class="btn-outline" style="font-size:0.8rem;text-decoration:none;" href="${audioUrl}" download="${rec.name}.webm">ডাউনলোড</a>
          <button class="btn-outline btn-delete" style="font-size:0.8rem;color:var(--accent-red);" title="মুছুন">🗑️</button>
        </div>
      `;

      const deleteBtn = item.querySelector('.btn-delete');
      deleteBtn.addEventListener('click', async () => {
        if (confirm('রেকর্ডিংটি মুছে ফেলতে চান?')) {
          await RiyazIDB.delete(rec.id);
          loadLocalRecordings();
        }
      });

      recordingsList.appendChild(item);
    });
  };

  loadLocalRecordings();

  recordBtn.addEventListener('click', async () => {
    if (window.audioEngine.isRecording) {
      const blob = await window.audioEngine.stopRecording();
      recordBtn.innerHTML = "⏺️ রেকর্ড";
      recordBtn.classList.remove('btn-danger');

      if (blob) {
        // 1. Save locally in private IndexedDB
        await RiyazIDB.save(blob, `রেওয়াজ-${new Date().toLocaleTimeString('bn-BD')}`);
        loadLocalRecordings();

        // 2. Optional server upload if backend available
        const formData = new FormData();
        formData.append('audio', blob, `riyaz-${Date.now()}.webm`);
        fetch('/api/recordings', { method: 'POST', body: formData }).catch(() => {});
      }
    } else {
      let stream = pitchDetector.micStream;
      if (!stream) {
        try {
          stream = await pitchDetector.startListening();
          requestWakeLock();
          startMicBtn.innerHTML = "⏹️ রেওয়াজ থামান";
          startMicBtn.classList.remove('btn-primary');
          startMicBtn.classList.add('btn-danger');
        } catch (e) {
          alert("মাইক্রোফোন অনুমতি ছাড়া রেকর্ড করা সম্ভব নয়।");
          return;
        }
      }

      await window.audioEngine.startRecording(stream);
      recordBtn.innerHTML = "⏹️ রেকর্ডিং থামান";
      recordBtn.classList.add('btn-danger');
    }
  });

  /* ========================================================
   * 17. SESSION STOPWATCH & INTERVAL AUTO-LOGGER
   * ======================================================== */
  let secondsSpent = 0;
  setInterval(() => {
    secondsSpent++;
    const m = Math.floor(secondsSpent / 60).toString().padStart(2, '0');
    const s = (secondsSpent % 60).toString().padStart(2, '0');
    if (sessionTimerEl) sessionTimerEl.textContent = `${m}:${s}`;

    if (secondsSpent % 60 === 0 && pitchDetector.isListening) {
      fetch('/api/stats/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: 1 })
      }).then(() => loadUserStats()).catch(() => {});
    }
  }, 1000);
});
