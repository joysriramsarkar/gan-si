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
    if (window.audioEngine.isTanpuraPlaying) {
      window.audioEngine.stopTanpura();
      startTanpuraBtn.innerHTML = "🪕 তানপুরা শুরু করুন";
      startTanpuraBtn.classList.remove('active');
    } else {
      window.audioEngine.startTanpura(onStringPluck);
      startTanpuraBtn.innerHTML = "🔇 তানপুরা বন্ধ করুন";
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
  const alankars = [
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

  const alankarList = document.getElementById('alankarList');
  if (alankarList) {
    alankarList.innerHTML = '';
    alankars.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = `alankar-card ${idx === 0 ? 'selected' : ''}`;
      card.innerHTML = `
        <div>
          <div class="alankar-title">${item.title}</div>
          <div class="alankar-notes">${item.notes}</div>
        </div>
        <button class="btn-outline" style="font-size:0.8rem;padding:6px 12px;">রেওয়াজ</button>
      `;
      card.addEventListener('click', () => {
        document.querySelectorAll('.alankar-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        // Switch to Live Riyaz tab to practice
        document.querySelector('.tab-btn[data-tab="tab-pitch"]').click();
      });
      alankarList.appendChild(card);
    });
  }

  /* ========================================================
   * 8. RAGA EXPLORER LIBRARY
   * ======================================================== */
  const ragas = [
    {
      name: "রাগ ইমন / কল্যাণ (Yaman)",
      thaat: "কল্যাণ",
      jati: "সম্পূর্ণ",
      vadi: "গা (Gandhar)",
      samvadi: "নি (Nishad)",
      time: "প্রথম প্রহর (সন্ধ্যা)",
      aroha: "নি্ রে গা, মা♯ ধা নি সাঁ",
      avoroha: "সাঁ নি ধা পা, মা♯ গা রে সা",
      pakad: "নি্ রে গা রে, মা♯ ধা নি সাঁ"
    },
    {
      name: "রাগ বিলাবল (Bilawal)",
      thaat: "বিলাবল",
      jati: "সম্পূর্ণ",
      vadi: "ধা (Dhaivat)",
      samvadi: "গা (Gandhar)",
      time: "দিনের প্রথম প্রহর (সকাল)",
      aroha: "সা রে গা মা পা ধা নি সাঁ",
      avoroha: "সাঁ নি ধা পা মা গা রে সা",
      pakad: "গা রে, গা পা, ধা নি সাঁ"
    },
    {
      name: "রাগ ভৈরব (Bhairav)",
      thaat: "ভৈরব (কোমল রে, কোমল ধা)",
      jati: "সম্পূর্ণ",
      vadi: "ধা♭ (Komal Dha)",
      samvadi: "রে♭ (Komal Re)",
      time: "প্রভাত কাল (ভোর)",
      aroha: "সা রে♭ গা মা পা ধা♭ নি সাঁ",
      avoroha: "সাঁ নি ধা♭ পা মা গা রে♭ সা",
      pakad: "গা মা ধা♭ ধা♭ পা, মা গা রে♭ রে♭ সা"
    },
    {
      name: "রাগ ভৈরবী (Bhairavi)",
      thaat: "ভৈরবী (সব কোমল স্বর)",
      jati: "সম্পূর্ণ",
      vadi: "মা (Madhyam)",
      samvadi: "সা (Shadja)",
      time: "প্রভাত / সমাপনী রাগ",
      aroha: "সা রে♭ গা♭ মা পা ধা♭ নি♭ সাঁ",
      avoroha: "সাঁ নি♭ ধা♭ পা মা গা♭ রে♭ সা",
      pakad: "মা পা ধা♭ পা, মা গা♭ রে♭ সা"
    },
    {
      name: "রাগ কাফি (Kafi)",
      thaat: "কাফি (কোমল গা, কোমল নি)",
      jati: "সম্পূর্ণ",
      vadi: "পা (Pancham)",
      samvadi: "সা (Shadja)",
      time: "মধ্যরাত্রি",
      aroha: "সা রে গা♭ মা পা ধা নি♭ সাঁ",
      avoroha: "সাঁ নি♭ ধা পা মা গা♭ রে সা",
      pakad: "সা রে রে গা♭ গা♭ মা মা পা"
    },
    {
      name: "রাগ ভূপালী (Bhoopali)",
      thaat: "কল্যাণ (ঔড়ব জাতি)",
      jati: "ঔড়ব - ঔড়ব (মা ও নি বর্জিত)",
      vadi: "গা (Gandhar)",
      samvadi: "ধা (Dhaivat)",
      time: "সন্ধ্যা কাল",
      aroha: "সা রে গা পা ধা সাঁ",
      avoroha: "সাঁ ধা পা গা রে সা",
      pakad: "গা রে সা, ধা্ সা রে গা"
    }
  ];

  const ragaGrid = document.getElementById('ragaGrid');
  if (ragaGrid) {
    ragaGrid.innerHTML = '';
    ragas.forEach(r => {
      const card = document.createElement('div');
      card.className = 'raga-card';
      card.innerHTML = `
        <h3>${r.name}</h3>
        <div class="raga-info-row"><strong>ঠাট:</strong> ${r.thaat} | <strong>সময়:</strong> ${r.time}</div>
        <div class="raga-info-row"><strong>বাদী:</strong> ${r.vadi} | <strong>সমবাদী:</strong> ${r.samvadi}</div>
        <div class="raga-info-row"><strong>আরোহ:</strong> ${r.aroha}</div>
        <div class="raga-info-row"><strong>অবরোহ:</strong> ${r.avoroha}</div>
        <div class="raga-info-row"><strong>পকড়:</strong> ${r.pakad}</div>
        <button class="btn-outline raga-select-btn" style="margin-top:10px;font-size:0.8rem;padding:6px 12px;width:100%;">🎵 এই রাগে রেওয়াজ করুন</button>
      `;
      const selectBtn = card.querySelector('.raga-select-btn');
      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('.tab-btn[data-tab="tab-pitch"]').click();
      });
      ragaGrid.appendChild(card);
    });
  }

  /* ========================================================
   * 9. AUDIO RECORDING & RIYAZ TRACKING
   * ======================================================== */
  recordBtn.addEventListener('click', async () => {
    if (window.audioEngine.isRecording) {
      const blob = await window.audioEngine.stopRecording();
      recordBtn.innerHTML = "⏺️ রেকর্ড করুন";
      recordBtn.classList.remove('btn-danger');

      if (blob && recordingsList) {
        const url = URL.createObjectURL(blob);
        const item = document.createElement('div');
        item.className = 'recording-item';
        item.innerHTML = `
          <div>
            <strong>রেওয়াজ রেকর্ডিং</strong>
            <div style="font-size:0.75rem;color:var(--text-muted);">${new Date().toLocaleTimeString()}</div>
          </div>
          <audio controls src="${url}"></audio>
          <a class="btn-outline" style="font-size:0.8rem;text-decoration:none;" href="${url}" download="riyaz-${Date.now()}.webm">ডাউনলোড</a>
        `;
        recordingsList.prepend(item);
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
