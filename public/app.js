/**
 * Main Application Logic for Sur Sadhana Pro (গান-সি)
 * Handles:
 * - UI Navigation & State
 * - Virtual Harmonium Keyboard Rendering & Interaction
 * - Alankar Practice & Karaoke Mode
 * - Raga Explorer Library
 * - Session Timer & Local Storage History
 */

document.addEventListener('DOMContentLoaded', () => {
  const scaleSelect = document.getElementById('scaleSelect');
  const startMicBtn = document.getElementById('startMicBtn');
  const startTanpuraBtn = document.getElementById('startTanpuraBtn');
  const recordBtn = document.getElementById('recordBtn');
  const sessionTimerEl = document.getElementById('sessionTimer');
  const accuracyScoreEl = document.getElementById('accuracyScore');

  // Pitch elements
  const sargamDisplay = document.getElementById('sargamDisplay');
  const westernDisplay = document.getElementById('westernDisplay');
  const pitchNeedle = document.getElementById('pitchNeedle');
  const saptakBadge = document.getElementById('saptakBadge');
  const pitchHero = document.getElementById('pitchHero');
  const swaraMatrix = document.getElementById('swaraMatrix');
  const pitchCanvas = document.getElementById('pitchCanvas');

  // Tanpura elements
  const tanpuraStrings = document.querySelectorAll('.tanpura-wire');
  const tanpuraBox = document.getElementById('tanpuraBox');
  const tanpuraTuningSelect = document.getElementById('tanpuraTuningSelect');
  const tanpuraTempoSlider = document.getElementById('tanpuraTempoSlider');
  const tanpuraVolumeSlider = document.getElementById('tanpuraVolumeSlider');

  // Tabla elements
  const taalSelect = document.getElementById('taalSelect');
  const taalBpmSlider = document.getElementById('taalBpmSlider');
  const taalBpmVal = document.getElementById('taalBpmVal');
  const startTaalBtn = document.getElementById('startTaalBtn');
  const taalDisplay = document.getElementById('taalDisplay');

  // Harmonium
  const harmoniumKeyboard = document.getElementById('harmoniumKeyboard');

  // Recordings & History
  const recordingsList = document.getElementById('recordingsList');

  /* ========================================================
   * 0. THEME TOGGLE (uses [data-theme="gold"] defined in style.css)
   * ======================================================== */
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const THEME_STORAGE_KEY = 'gan-si-theme';
  const applyTheme = () => {
    const theme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
    if (theme === 'gold') {
      document.documentElement.setAttribute('data-theme', 'gold');
      if (themeToggleBtn) themeToggleBtn.textContent = '🌞 সকাল';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (themeToggleBtn) themeToggleBtn.textContent = '🌙 রাত';
    }
  };
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const cur = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
      localStorage.setItem(THEME_STORAGE_KEY, cur === 'gold' ? 'dark' : 'gold');
      applyTheme();
    });
  }
  applyTheme();

  /* ========================================================
   * About Modal
   * ======================================================== */
  const aboutBtn = document.getElementById('aboutBtn');
  const aboutModal = document.getElementById('aboutModal');
  const closeAboutModal = () => {
    if (aboutModal) aboutModal.classList.remove('open');
  };
  if (aboutBtn && aboutModal) {
    aboutBtn.addEventListener('click', () => aboutModal.classList.add('open'));
    const closeBtn = document.getElementById('modalClose') || document.getElementById('modalCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeAboutModal);
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) closeAboutModal();
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
   * 1. NAVIGATION & TAB SWITCHING
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
   * 2. SCALE SYNC & SWARA MATRIX
   * ======================================================== */
  const updateScaleMatrix = () => {
    const root = parseInt(scaleSelect.value, 10);
    window.audioEngine.rootOffset = root;

    if (!swaraMatrix) return;
    swaraMatrix.innerHTML = '';

    const shuddhaNotes = [
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

    shuddhaNotes.forEach(item => {
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
        // Play audio on harmonium for reference
        const freq = window.audioEngine.getNoteFrequency(noteIdx, 4);
        window.audioEngine.playHarmoniumNote(freq, 'preview');
        setTimeout(() => window.audioEngine.stopHarmoniumNote('preview'), 500);
      });
      swaraMatrix.appendChild(chip);
    });

    renderHarmoniumKeys();
  };

  scaleSelect.addEventListener('change', updateScaleMatrix);
  updateScaleMatrix();

  /* ========================================================
   * 3. LIVE PITCH DETECTOR LISTENER
   * ======================================================== */
  startMicBtn.addEventListener('click', async () => {
    if (pitchDetector.isListening) {
      pitchDetector.stopListening();
      startMicBtn.innerHTML = "🎤 রেওয়াজ শুরু করুন";
      startMicBtn.classList.remove('btn-danger');
      startMicBtn.classList.add('btn-primary');
      sargamDisplay.textContent = "--";
      westernDisplay.innerHTML = "নোট: -- | ফ্রিকোয়েন্সি: 0.0 Hz";
      pitchHero.classList.remove('locked-in');
      return;
    }

    try {
      await pitchDetector.startListening();
      startMicBtn.innerHTML = "⏹️ রেওয়াজ থামান";
      startMicBtn.classList.remove('btn-primary');
      startMicBtn.classList.add('btn-danger');
    } catch (err) {
      alert(err.message || "মাইক্রোফোন চালু করা যায়নি!");
    }
  });

  pitchDetector.onPitchUpdate = (data) => {
    // Reset highlights
    document.querySelectorAll('.swara-chip').forEach(c => c.classList.remove('active-pitch'));

    if (!data) {
      sargamDisplay.classList.remove('active', 'in-tune');
      pitchHero.classList.remove('locked-in');
      return;
    }

    sargamDisplay.textContent = data.sargamShortName;
    westernDisplay.innerHTML = `নোট: <strong>${data.noteName}</strong> | <strong>${data.freq}</strong> Hz | <strong>${data.cents > 0 ? '+' : ''}${data.cents}</strong> cents`;
    saptakBadge.textContent = data.saptak;

    // Cents Needle (-50 to +50 cents mapped to 0% - 100%)
    const pct = Math.max(0, Math.min(100, 50 + data.cents));
    pitchNeedle.style.left = `${pct}%`;

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

    // Highlight chip in matrix
    const activeChip = document.getElementById(`swara-chip-${data.sargamIndex}`);
    if (activeChip) activeChip.classList.add('active-pitch');

    if (accuracyScoreEl && data.accuracyPercent) {
      accuracyScoreEl.textContent = `${data.accuracyPercent}%`;
    }
  };

  /* ========================================================
   * 4. TANPURA CONTROLS
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
    const willPlay = !window.audioEngine.isTanpuraPlaying;
    if (willPlay) {
      window.audioEngine.startTanpura(onStringPluck);
      startTanpuraBtn.innerHTML = "🔇 তানপুরা বন্ধ করুন";
      startTanpuraBtn.classList.add('active');
    } else {
      window.audioEngine.stopTanpura();
      startTanpuraBtn.innerHTML = "🪕 তানপুরা শুরু করুন";
      startTanpuraBtn.classList.remove('active');
    }
    if (tanpuraBox) tanpuraBox.classList.toggle('playing', willPlay);
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
   * 5. VIRTUAL HARMONIUM KEYBOARD
   * ======================================================== */
  function renderHarmoniumKeys() {
    if (!harmoniumKeyboard) return;
    harmoniumKeyboard.innerHTML = '';

    const root = window.audioEngine.rootOffset;
    // 2 full octaves (24 notes starting from C3 to B4)
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

      // Accessibility: keyboard shortcut labels for screen readers
      keyEl.setAttribute('aria-label', `${sargamShort}${octave} [${keyboardKeys[i] || ''}]`);
      keyEl.setAttribute('title', `[${keyboardKeys[i] || ''}] ${noteName}${octave}`);

      // Mouse & touch handlers
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

  // Keyboard shortcut listener for Harmonium
  const keyMap = {
    'KeyA': 48, 'KeyW': 49, 'KeyS': 50, 'KeyE': 51, 'KeyD': 52, 'KeyF': 53,
    'KeyT': 54, 'KeyG': 55, 'KeyY': 56, 'KeyH': 57, 'KeyU': 58, 'KeyJ': 59,
    'KeyK': 60, 'KeyO': 61, 'KeyL': 62, 'KeyP': 63, 'Semicolon': 64, 'Quote': 65,
    'BracketRight': 66, 'Backslash': 67, 'KeyZ': 68, 'KeyX': 69, 'KeyC': 70, 'KeyV': 71
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
   * 6. TABLA & METRONOME UI
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
   * 7. ALANKARS PRACTICE MODULE
   * ======================================================== */
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
    },
    {
      id: 6,
      title: "৬. পল্টা আরোহণ (পল্টা)",
      notes: "সা সা রে রে গা গা মা মা পা পা ধা ধা নি নি সাঁ সাঁ | সাঁ নি ধা পা মা গা রে রে সাঁ",
      description: "সরল আরোহণ পাল্টায়।"
    },
    {
      id: 7,
      title: "৭. নিমজ্জন",
      notes: "সা গা মা পা ধা নি সাঁ | সাঁ ধা পা মা গা রে সা",
      description: "মনমুর্দ গতির সাথে নিমজ্জন অনুশীলন।"
    }
  ];

  const alankarList = document.getElementById('alankarList');
  const alankarNotesToList = (notes) => notes
    .split('|')
    .map(part => part.trim())
    .filter(Boolean)
    .flatMap(part => part.split(/\s+/).filter(Boolean));
  const updateAlankarPlayBtns = () => {
    if (!alankarList) return;
    const text = window.audioEngine.isSwaraSequencePlaying() ? '⏹️ রোকো' : '▶ প্রেক্টিস';
    alankarList.querySelectorAll('.alankar-play-btn').forEach(b => { b.textContent = text; });
  };
  const toggleAlankarPlay = (alankar) => {
    if (window.audioEngine.isSwaraSequencePlaying()) {
      window.audioEngine.stopSwaraSequence();
    } else {
      const seq = alankarNotesToList(alankar.notes);
      if (seq.length > 0) {
        window.audioEngine.playSwaraSequence(seq, { loop: true, noteDurationMs: 500 });
      }
    }
    updateAlankarPlayBtns();
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
          <div class="alankar-meta">${alankarNotesToList(item.notes).length} স্বরের সিকোয়েন্স</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-outline alankar-play-btn">▶ প্রেক্টিস</button>
          <button class="btn-outline" style="font-size:0.8rem;padding:6px 12px;">রেওয়াজ</button>
        </div>
      `;
      card.querySelector('.alankar-play-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAlankarPlay(item);
      });
      card.addEventListener('click', () => {
        document.querySelectorAll('.alankar-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        document.querySelector('.tab-btn[data-tab="tab-pitch"]').click();
      });
      alankarList.appendChild(card);
    });
  };

  fetch('/api/alankars')
    .then(res => res.json())
    .then(data => renderAlankars(data.alankars || defaultAlankars))
    .catch(() => renderAlankars(defaultAlankars));

  /* ========================================================
   * 8. RAGA EXPLORER LIBRARY
   * ======================================================== */
  const defaultRagas = [
    {
      id: "yaman",
      name: "রাগ ইমন / কল্যাণ (Yaman)",
      thaat: "কল্যাণ",
      jati: "সম্পূর্ণ",
      vadi: "গা (Gandhar)",
      samvadi: "নি (Nishad)",
      time: "প্রথম প্রহর (সন্ধ্যা)",
      aroha: "নি্ রে গা, মা♯ ধা নি সাঁ",
      avoroha: "সাঁ নি ধা পা, মা♯ গা রে সা",
      pakad: "নি্ রে গা রে, মা♯ ধা নি সাঁ",
      swaras: ["Sa", "Shuddha Re", "Shuddha Ga", "Teevra Ma", "Pa", "Shuddha Dha", "Shuddha Ni"]
    },
    {
      id: "bilawal",
      name: "রাগ বিলাবল (Bilawal)",
      thaat: "বিলাবল",
      jati: "সম্পূর্ণ",
      vadi: "ধা (Dhaivat)",
      samvadi: "গা (Gandhar)",
      time: "দিনের প্রথম প্রহর (সকাল)",
      aroha: "সা রে গা মা পা ধা নি সাঁ",
      avoroha: "সাঁ নি ধা পা মা গা রে সা",
      pakad: "গা রে, গা পা, ধা নি সাঁ",
      swaras: ["Sa", "Shuddha Re", "Shuddha Ga", "Shuddha Ma", "Pa", "Shuddha Dha", "Shuddha Ni"]
    },
    {
      id: "bhairav",
      name: "রাগ ভৈরব (Bhairav)",
      thaat: "ভৈরব (কোমল রে, কোমল ধা)",
      jati: "সম্পূর্ণ",
      vadi: "ধা♭ (Komal Dha)",
      samvadi: "রে♭ (Komal Re)",
      time: "প্রভাত কাল (ভোর)",
      aroha: "সা রে♭ গা মা পা ধা♭ নি সাঁ",
      avoroha: "সাঁ নি ধা♭ পা মা গা রে♭ সা",
      pakad: "গা মা ধা♭ ধা♭ পা, মা গা রে♭ রে♭ সা",
      swaras: ["Sa", "Komal Re", "Shuddha Ga", "Shuddha Ma", "Pa", "Komal Dha", "Shuddha Ni"]
    },
    {
      id: "bhairavi",
      name: "রাগ ভৈরবী (Bhairavi)",
      thaat: "ভৈরবী (সব কোমল স্বর)",
      jati: "সম্পূর্ণ",
      vadi: "মা (Madhyam)",
      samvadi: "সা (Shadja)",
      time: "প্রভাত / সমাপনী রাগ",
      aroha: "সা রে♭ গা♭ মা পা ধা♭ নি♭ সাঁ",
      avoroha: "সাঁ নি♭ ধা♭ পা মা গা♭ রে♭ সা",
      pakad: "মা পা ধা♭ পা, মা গা♭ রে♭ সা",
      swaras: ["Sa", "Komal Re", "Komal Ga", "Shuddha Ma", "Pa", "Komal Dha", "Komal Ni"]
    },
    {
      id: "kafi",
      name: "রাগ কাফি (Kafi)",
      thaat: "কাফি (কোমল গা, কোমল নি)",
      jati: "সম্পূর্ণ",
      vadi: "পা (Pancham)",
      samvadi: "সা (Shadja)",
      time: "মধ্যরাত্রি",
      aroha: "সা রে গা♭ মা পা ধা নি♭ সাঁ",
      avoroha: "সাঁ নি♭ ধা পা মা গা♭ রে সা",
      pakad: "সা রে রে গা♭ গা♭ মা মা পা",
      swaras: ["Sa", "Shuddha Re", "Komal Ga", "Shuddha Ma", "Pa", "Shuddha Dha", "Komal Ni"]
    },
    {
      id: "bhoopali",
      name: "রাগ ভূপালী (Bhoopali)",
      thaat: "কল্যাণ (ঔড়ব জাতি)",
      jati: "ঔড়ব - ঔড়ব (মা ও নি বর্জিত)",
      vadi: "গা (Gandhar)",
      samvadi: "ধা (Dhaivat)",
      time: "সন্ধ্যা কাল",
      aroha: "সা রে গা পা ধা সাঁ",
      avoroha: "সাঁ ধা পা গা রে সা",
      pakad: "গা রে সা, ধা্ সা রে গা",
      swaras: ["Sa", "Shuddha Re", "Shuddha Ga", "Pa", "Shuddha Dha"]
    },
    {
      id: "asavari",
      name: "রাগ আশাবরী (Asavari)",
      thaat: "আশাবরী",
      jati: "ঔড়ব - সম্পূর্ণ (আরোহে গা ও নি বর্জিত)",
      vadi: "ধা♭ (Komal Dha)",
      samvadi: "গা♭ (Komal Ga)",
      time: "দিনের দ্বিতীয় প্রহর",
      aroha: "সা রে মা পা ধা♭ সাঁ",
      avoroha: "সাঁ নি♭ ধা♭ পা মা গা♭ রে সা",
      pakad: "মা পা ধা♭ পা, মা গা♭ রে সা",
      swaras: ["Sa", "Shuddha Re", "Komal Ga", "Shuddha Ma", "Pa", "Komal Dha", "Komal Ni"]
    },
    {
      id: "khamaj",
      name: "রাগ খাম্বাজ (Khamaj)",
      thaat: "খাম্বাজ",
      jati: "ষাড়ব - সম্পূর্ণ (আরোহে রে বর্জিত)",
      vadi: "গা (Gandhar)",
      samvadi: "নি (Nishad)",
      time: "রাত্রির দ্বিতীয় প্রহর",
      aroha: "সা গা মা পা ধা নি সাঁ",
      avoroha: "সাঁ নি♭ ধা পা মা গা রে সা",
      pakad: "নি ধা, মা পা ধা, মা গা",
      swaras: ["Sa", "Shuddha Re", "Shuddha Ga", "Shuddha Ma", "Pa", "Shuddha Dha", "Komal Ni", "Shuddha Ni"]
    },
    {
      id: "jaitri",
      name: "রাগ জৈত্রি (Jaitri)",
      thaat: "জৈত্রী",
      jati: "সম্পূর্ণ",
      vadi: "পা (Pancham)",
      samvadi: "ধা (Dhaivat)",
      time: "দুপুরের প্রহর",
      aroha: "সা রে গা মা পা ধা নি সাঁ",
      avoroha: "সাঁ নি ধা পা মা গা রে সা",
      pakad: "সা রে গা মা পা ধা নি সাঁ",
      swaras: ["Sa", "Shuddha Re", "Shuddha Ga", "Shuddha Ma", "Pa", "Shuddha Dha", "Shuddha Ni"]
    },
    {
      id: "sri",
      name: "রাগ শ্রী (Sri)",
      thaat: "বিলাবল",
      jati: "সম্পূর্ণ",
      vadi: "মা (Madhyam)",
      samvadi: "সা (Shadja)",
      time: "সন্ধ্যা কাল",
      aroha: "সা রে গা মা পা ধা নি সাঁ",
      avoroha: "সাঁ নি ধা পা মা গা রে সা",
      pakad: "নি ধা পা, মা গা রে",
      swaras: ["Sa", "Shuddha Re", "Shuddha Ga", "Shuddha Ma", "Pa", "Shuddha Dha", "Shuddha Ni"]
    }
  ];

  const ragaGrid = document.getElementById('ragaGrid');
  const ragaSearch = document.getElementById('ragaSearch');
  const ragaCountEl = document.getElementById('ragaCount');

  let allRagas = defaultRagas;
  const updateRagaCount = (items) => {
    if (ragaCountEl) ragaCountEl.textContent = `${items.length} রাগ`;
  };

  const renderRagas = (items) => {
    if (!ragaGrid) return;
    ragaGrid.innerHTML = '';
    items.forEach(r => {
      const card = document.createElement('div');
      card.className = 'raga-card';
      const swarasHtml = (r.swaras || [])
        .map(s => `<span class="swara-tag">${s}</span>`)
        .join('');
      card.innerHTML = `
        <h3>${r.name}</h3>
        <div class="raga-info-row"><strong>ঠাট:</strong> ${r.thaat} | <strong>সময়:</strong> ${r.time}</div>
        <div class="raga-info-row"><strong>বাদী:</strong> ${r.vadi} | <strong>সমবাদী:</strong> ${r.samvadi}</div>
        <div class="raga-info-row"><strong>আরোহ:</strong> ${r.aroha}</div>
        <div class="raga-info-row"><strong>অবরোহ:</strong> ${r.avoroha}</div>
        <div class="raga-info-row"><strong>পকড়:</strong> ${r.pakad}</div>
        <div class="raga-swaras">${swarasHtml}</div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn-outline raga-play-btn">▶ প্রিভিজ করুন</button>
          <button class="btn-outline raga-select-btn" style="font-size:0.8rem;padding:6px 12px;flex:1;">🎵 এই রাগে রেওয়াজ করুন</button>
        </div>
      `;
      const playBtn = card.querySelector('.raga-play-btn');
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleRagaPlay(r);
      });
      const selectBtn = card.querySelector('.raga-select-btn');
      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('.tab-btn[data-tab="tab-pitch"]').click();
      });
      ragaGrid.appendChild(card);
    });
  };

  const updateRagaPlayBtns = () => {
    if (!ragaGrid) return;
    const text = window.audioEngine.isSwaraSequencePlaying() ? '⏹️ রোকো' : '▶ প্রিভিজ করুন';
    ragaGrid.querySelectorAll('.raga-play-btn').forEach(b => { b.textContent = text; });
  };

  const toggleRagaPlay = (raga) => {
    if (window.audioEngine.isSwaraSequencePlaying()) {
      window.audioEngine.stopSwaraSequence();
    } else {
      window.audioEngine.playSwaraSequence(raga.swaras, { loop: true, noteDurationMs: 800 });
    }
    updateRagaPlayBtns();
  };

  const filterRagas = (items, q) => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter(r =>
      String(r.name || '').toLowerCase().includes(query) ||
      String(r.id || '').toLowerCase().includes(query) ||
      String(r.thaat || '').toLowerCase().includes(query) ||
      (r.swaras || []).some(s => String(s).toLowerCase().includes(query))
    );
  };

  if (ragaSearch) {
    ragaSearch.addEventListener('input', () => {
      const items = filterRagas(allRagas, ragaSearch.value);
      updateRagaCount(items);
      renderRagas(items);
      updateRagaPlayBtns();
    });
  }

  updateRagaCount(allRagas);

  fetch('/api/ragas')
    .then(res => res.json())
    .then(data => {
      allRagas = data.ragas || defaultRagas;
      updateRagaCount(allRagas);
      renderRagas(allRagas);
      updateRagaPlayBtns();
    })
    .catch(() => {
      updateRagaCount(allRagas);
      renderRagas(allRagas);
    });

  /* ========================================================
   * 9. AUDIO RECORDING & REST API SYNC
   * ======================================================== */
  const loadServerRecordings = async () => {
    if (!recordingsList) return;
    try {
      const res = await fetch('/api/recordings');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.recordings || data.recordings.length === 0) {
        recordingsList.innerHTML = `
          <div style="color:var(--text-muted);font-size:0.9rem;text-align:center;padding:20px;">
            এখনও কোনো রেকর্ডিং সংরক্ষিত হয়নি। উপরে <strong>"⏺️ রেকর্ড"</strong> চাপুন।
          </div>
        `;
        return;
      }

      recordingsList.innerHTML = '';
      data.recordings.forEach(rec => {
        const item = document.createElement('div');
        item.className = 'recording-item';
        const formattedDate = new Date(rec.createdAt).toLocaleString('bn-BD', {
          dateStyle: 'medium',
          timeStyle: 'short'
        });
        const sizeMb = (rec.size / (1024 * 1024)).toFixed(2);

        item.innerHTML = `
          <div>
            <strong>${rec.filename}</strong>
            <div style="font-size:0.75rem;color:var(--text-muted);">${formattedDate} • ${sizeMb} MB</div>
          </div>
          <audio controls src="${rec.url}"></audio>
          <div style="display:flex;gap:6px;">
            <a class="btn-outline" style="font-size:0.8rem;text-decoration:none;" href="${rec.url}" download="${rec.filename}">ডাউনলোড</a>
            <button class="btn-outline btn-delete" style="font-size:0.8rem;color:var(--accent-red);" title="মুছুন">🗑️</button>
          </div>
        `;

        const deleteBtn = item.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', async () => {
          if (confirm('রেকর্ডিংটি মুছে ফেলতে চান?')) {
            await fetch(`/api/recordings/${rec.filename}`, { method: 'DELETE' });
            loadServerRecordings();
          }
        });

        recordingsList.appendChild(item);
      });
    } catch (e) {
      console.warn('Could not connect to recordings API', e);
    }
  };

  loadServerRecordings();

  recordBtn.addEventListener('click', async () => {
    if (window.audioEngine.isRecording) {
      const blob = await window.audioEngine.stopRecording();
      recordBtn.innerHTML = "⏺️ রেকর্ড করুন";
      recordBtn.classList.remove('btn-danger');

      if (blob) {
        // Upload to server
        const formData = new FormData();
        formData.append('audio', blob, `riyaz-${Date.now()}.webm`);

        try {
          const res = await fetch('/api/recordings', {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            loadServerRecordings();
          }
        } catch (e) {
          console.warn('Server upload failed, displaying locally', e);
          const url = URL.createObjectURL(blob);
          const item = document.createElement('div');
          item.className = 'recording-item';
          item.innerHTML = `
            <div>
              <strong>লোকাল রেকর্ডিং</strong>
              <div style="font-size:0.75rem;color:var(--text-muted);">${new Date().toLocaleTimeString()}</div>
            </div>
            <audio controls src="${url}"></audio>
            <a class="btn-outline" style="font-size:0.8rem;text-decoration:none;" href="${url}" download="riyaz-${Date.now()}.webm">ডাউনলোড</a>
          `;
          recordingsList.prepend(item);
        }
      }
    } else {
      let stream = pitchDetector.micStream;
      if (!stream) {
        try {
          stream = await pitchDetector.startListening();
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
   * 10. SESSION TIMER & LOCAL STORAGE RIYAZ STATS
   * ======================================================== */
  let secondsSpent = 0;
  setInterval(() => {
    secondsSpent++;
    const m = Math.floor(secondsSpent / 60).toString().padStart(2, '0');
    const s = (secondsSpent % 60).toString().padStart(2, '0');
    if (sessionTimerEl) sessionTimerEl.textContent = `${m}:${s}`;
  }, 1000);
});
