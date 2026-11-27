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
        mimeType: blob.type || 'audio/webm',
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
  const uiIcon = (name) => `<svg class="icon" aria-hidden="true"><use href="/icons.svg#${name}"></use></svg>`;

  // Recover a browser that was previously stuck on an HTML bundle without
  // number localization. One reload after installation is sufficient and is
  // ignored while the document is loading, so first visit has no reload loop.
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const type = event.data?.type;
      if ((type !== 'GANSI_REFRESH' && type !== 'GANSI_REFRESH_REQUIRED') || document.readyState !== 'complete') return;
      if (sessionStorage.getItem('gansi-sw-refresh') === event.data.version) return;
      sessionStorage.setItem('gansi-sw-refresh', event.data.version);
      location.reload();
    });
  }

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  }

  // Stale-tab check: a tab kept open across a deploy keeps running old JS,
  // which looks like "nothing works" (e.g. the old 8-tab UI on Vercel).
  // Self-hosted: compare with the server's health endpoint.
  // Static host (Vercel): no /api, so compare the SW cache version baked into
  // this HTML with the live /sw.js. A stale cached bundle carries an older
  // meta value and gets a one-click reload. Offline = silent.
  (() => {
    const meta = document.querySelector('meta[name="gansi-version"]');
    const notice = document.getElementById('versionNotice');
    if (!meta || !notice) return;
    const bundled = (meta.content || '').trim();
    if (!bundled) return;
    const showNotice = (liveVersion) => {
      notice.hidden = false;
      const text = document.createElement('span');
      text.textContent = `এই ট্যাবটি পুরোনো সংস্করণ (${bundled}) চালাচ্ছে; এখন আছে ${liveVersion}। নতুন ফিচার পেতে রিলোড করুন।`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-outline';
      btn.textContent = 'এখনই রিলোড';
      btn.addEventListener('click', () => location.reload());
      notice.replaceChildren(text, btn);
    };

    if (!window.GANSI_STATIC_MODE) {
      fetch('/api/health', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.version && data.version !== bundled) showNotice(data.version);
        })
        .catch(() => {});
      return;
    }

    const swMeta = document.querySelector('meta[name="gansi-sw-version"]');
    if (!swMeta) return;
    const bundledSw = Number((swMeta.content || '').trim());
    if (!Number.isFinite(bundledSw)) return;
    fetch('/sw.js?check=' + Date.now(), { cache: 'no-store' })
      .then((res) => (res.ok ? res.text() : null))
      .then((src) => {
        if (!src) return;
        const m = src.match(/CACHE_VERSION\s*=\s*['"]sur-sadhana-v(\d+)['"]/);
        if (m && Number(m[1]) > bundledSw) showNotice('sur-sadhana-v' + m[1]);
      })
      .catch(() => {});
  })();

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
  const micCheckBtn = document.getElementById('micCheckBtn');
  const micStatusEl = document.getElementById('micStatus');
  const sessionTimerEl = document.getElementById('sessionTimer');
  const accuracyScoreEl = document.getElementById('accuracyScore');
  const totalMinsDisplay = document.getElementById('totalMinsDisplay');
  const streakCount = document.getElementById('streakCount');

  // ---- Microphone status: a dead mic must never look like a live session ----
  const setMicStatus = (kind, message) => {
    if (!micStatusEl) return;
    micStatusEl.dataset.state = kind;
    micStatusEl.textContent = message;
  };
  const micFailure = (err) => {
    const msg = (window.GanSiMic && window.GanSiMic.describe)
      ? window.GanSiMic.describe(err)
      : 'মাইক্রোফোন চালু করা যায়নি। «মাইক যাচাই» বাটন চাপুন।';
    setMicStatus('error', '❌ ' + msg);
    console.warn('[Gan-si] microphone:', (err && (err.name || err.message)) || err);
    return msg;
  };
  const micUiReset = () => {
    try { stopGuidedPractice(false); } catch (_) {}
    try { stopRagaLesson(false); } catch (_) {}
    if (window.__pitchTrail) window.__pitchTrail.stop();
    releaseWakeLock();
    if (startMicBtn) {
      startMicBtn.innerHTML = `${uiIcon('mic')} রেওয়াজ শুরু করুন`;
      startMicBtn.classList.remove('btn-danger');
      startMicBtn.classList.add('btn-primary');
    }
  };
  if (window.pitchDetector) {
    window.pitchDetector.onMicError = (err) => micFailure(err);
    window.pitchDetector.onMicEnded = () => {
      micUiReset();
      setMicStatus('error', '❌ মাইক্রোফোনের সংযোগ বিচ্ছিন্ন হয়েছে। ডিভাইস/অনুমতি যাচাই করে আবার «রেওয়াজ শুরু করুন» চাপুন।');
    };
  }
  // The Piano-Roll tab can start/stop the shared mic on its own; keep the
  // main mic button + status in sync with whichever surface toggled it.
  window.addEventListener('gansi:micstate', (e) => {
    const listening = !!(e.detail && e.detail.listening);
    if (listening) {
      requestWakeLock();
      setMicStatus('ok', '✅ মাইক্রোফোন চালু — গাইলে সুরের রেখা ও স্কোর এখানে ধরা পড়বে।');
      if (window.__pitchTrail) window.__pitchTrail.start();
      if (startMicBtn) {
        startMicBtn.innerHTML = `${uiIcon('stop')} রেওয়াজ থামান`;
        startMicBtn.classList.remove('btn-primary');
        startMicBtn.classList.add('btn-danger');
      }
    } else {
      micUiReset();
      setMicStatus('idle', '⏹ মাইক্রোফোন বন্ধ। শুরু করতে «রেওয়াজ শুরু করুন» চাপুন।');
    }
  });
  if (micCheckBtn) {
    micCheckBtn.addEventListener('click', async () => {
      setMicStatus('pending', '⏳ মাইক্রোফোন যাচাই করা হচ্ছে…');
      const result = window.GanSiMic
        ? await window.GanSiMic.check()
        : { ok: false, message: 'মাইক যাচাই মডিউল লোড হয়নি — পেজ রিলোড করুন।' };
      setMicStatus(result.ok ? 'ok' : 'error', (result.ok ? '✅ ' : '❌ ') + result.message);
    });
  }

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
  let pitchTrail = null;
  // Override pitch detector's drawGraph to use advanced trail.
  pitchDetector.drawGraph = () => {
    if (pitchTrail) pitchTrail.draw();
  };
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
  const THEME_KEY = 'gan-si-theme-selection-v2';

  // Recordings & History
  const recordingsList = document.getElementById('recordingsList');
  const cloudBackupToggle = document.getElementById('cloudBackupToggle');
  const backupStatus = document.getElementById('backupStatus');
  const BACKUP_KEY = 'gan-si-cloud-backup-enabled';
  let activePracticeMeta = null;
  if (cloudBackupToggle) {
    try { cloudBackupToggle.checked = localStorage.getItem(BACKUP_KEY) === 'true'; } catch {}
    cloudBackupToggle.addEventListener('change', () => {
      try { localStorage.setItem(BACKUP_KEY, String(cloudBackupToggle.checked)); } catch {}
      if (backupStatus) backupStatus.textContent = cloudBackupToggle.checked ? '☁️ ব্যাকআপ চালু — নতুন রেকর্ডিং আপলোড হবে।' : '🔒 ব্যাকআপ বন্ধ — রেকর্ডিং শুধু এই ডিভাইসে থাকবে।';
    });
  }

  /* ========================================================
   * 1. THEME SWITCHER
   * ======================================================== */
  const savedTheme = localStorage.getItem(THEME_KEY) || 'paper';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.body.setAttribute('data-theme', savedTheme);
  if (themeSelect) {
    themeSelect.value = savedTheme;
    themeSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      document.documentElement.setAttribute('data-theme', val);
      document.body.setAttribute('data-theme', val);
      localStorage.setItem(THEME_KEY, val);
      window.dispatchEvent(new CustomEvent('gansi:themechange', { detail: { theme: val } }));
      if (pitchDetector.drawGraph) pitchDetector.drawGraph();
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
   * 2b. A4 REFERENCE / NOISE GATE / NOTATION (RiyazDaily Pitch Monitor)
   * + current-scale readout. All persisted locally, all live-applied.
   * ======================================================== */
  const NOTE_NAMES_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const currentScaleInfoEl = document.getElementById('currentScaleInfo');
  const tanpuraScaleLabelEl = document.getElementById('tanpuraScaleLabel');
  const updateScaleInfo = () => {
    const root = window.audioEngine ? window.audioEngine.rootOffset : parseInt(scaleSelect.value, 10);
    const a4 = window.audioEngine ? window.audioEngine.baseFreqA4 : 440;
    const saFreq = a4 * Math.pow(2, ((48 + root) - 69) / 12);
    const tuningNames = { 0: 'Sa–Pa', 1: 'Sa–Ma', 2: 'Sa–Ni', 3: 'Sa–Dha' };
    const tuningId = window.audioEngine ? window.audioEngine.tanpuraTuning : 0;
    if (currentScaleInfoEl) {
      currentScaleInfoEl.textContent = `বর্তমান স্কেল: সা = ${NOTE_NAMES_EN[root]} · মধ্য সা ${saFreq.toFixed(1)} Hz · A4 ${a4} Hz`;
    }
    if (tanpuraScaleLabelEl) {
      tanpuraScaleLabelEl.textContent = `তানপুরা: সা = ${NOTE_NAMES_EN[root]} • ${tuningNames[tuningId] || 'Sa–Pa'} — নির্বাচিত ‘সা’ অনুসরণ করে`;
    }
  };

  const a4Input = document.getElementById('a4Input');
  const applyA4 = (val, save = true) => {
    const v = Math.max(415, Math.min(465, Math.round(Number(val) || 440)));
    if (window.audioEngine) window.audioEngine.baseFreqA4 = v;
    if (a4Input) a4Input.value = String(v);
    if (save) { try { localStorage.setItem('gan-si-a4', String(v)); } catch {} }
    window.dispatchEvent(new CustomEvent('gansi:a4change', { detail: { a4: v } }));
    updateScaleInfo();
    return v;
  };
  try { const savedA4 = parseInt(localStorage.getItem('gan-si-a4') || '', 10); if (savedA4 >= 415 && savedA4 <= 465) applyA4(savedA4, false); } catch {}
  if (a4Input) a4Input.addEventListener('change', () => applyA4(a4Input.value));
  const a4MinusBtn = document.getElementById('a4MinusBtn');
  const a4PlusBtn = document.getElementById('a4PlusBtn');
  if (a4MinusBtn) a4MinusBtn.addEventListener('click', () => applyA4((window.audioEngine ? window.audioEngine.baseFreqA4 : 440) - 1));
  if (a4PlusBtn) a4PlusBtn.addEventListener('click', () => applyA4((window.audioEngine ? window.audioEngine.baseFreqA4 : 440) + 1));

  const noiseGateSelect = document.getElementById('noiseGateSelect');
  try {
    const savedGate = localStorage.getItem('gan-si-noise-gate');
    if (savedGate && pitchDetector.setNoiseGateMode) pitchDetector.setNoiseGateMode(savedGate);
    if (noiseGateSelect && savedGate) noiseGateSelect.value = savedGate;
  } catch {}
  if (noiseGateSelect) noiseGateSelect.addEventListener('change', () => {
    if (pitchDetector.setNoiseGateMode) pitchDetector.setNoiseGateMode(noiseGateSelect.value);
    try { localStorage.setItem('gan-si-noise-gate', noiseGateSelect.value); } catch {}
  });

  let notationMode = 'indian';
  const notationSelect = document.getElementById('notationSelect');
  try {
    const savedNotation = localStorage.getItem('gan-si-notation');
    if (['indian', 'western', 'solfege'].includes(savedNotation)) {
      notationMode = savedNotation;
      if (notationSelect) notationSelect.value = savedNotation;
    }
  } catch {}
  if (notationSelect) notationSelect.addEventListener('change', () => {
    notationMode = notationSelect.value;
    try { localStorage.setItem('gan-si-notation', notationMode); } catch {}
    if (window.__pitchTrail && window.__pitchTrail.setNotation) window.__pitchTrail.setNotation(notationMode);
  });

  /* ========================================================
   * 3. STATS & DAILY STREAK INITIALIZATION
   * ======================================================== */
  const loadUserStats = async () => {
    if (window.GANSI_STATIC_MODE) return; // personal stats stay in this device
    try {
      const res = await (window.GanSiAuth ? window.GanSiAuth.fetch('/api/stats') : fetch('/api/stats'));
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

  // Initialize Canvas + advanced pitch trail (400px: 25 swara lines + cents ribbon).
  if (pitchCanvas) {
    pitchDetector.setCanvas(pitchCanvas);
    const resizeCanvas = () => {
      const w = pitchCanvas.parentElement ? pitchCanvas.parentElement.clientWidth : 0;
      pitchCanvas.width = w > 50 ? w : 480;
      pitchCanvas.height = 400;
      if (pitchTrail) pitchTrail.resize();
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create advanced trail.
    if (window.PitchTrail) {
      const trailSummary = document.getElementById('trailSummary');
      const refreshSummary = () => { if (trailSummary) trailSummary.textContent = trail.describe(); };
      const trail = window.PitchTrail.create(pitchCanvas, { height: 400, mobileHeight: 360, onStop: refreshSummary });
      pitchTrail = trail;
      // Hook into pitch updates via a global bridge so the section-8 handler
      // (which is assigned later) can push samples without being overwritten.
      window.__pitchTrail = trail;
      if (trail.setNotation) trail.setNotation(notationMode);
      trail.start();
      resizeCanvas();

      // Screen-reader summary + toolbar status (privacy-first, all local).
      const trailStatus = document.getElementById('trailStatus');
      const sayStatus = (msg) => { if (trailStatus) { trailStatus.textContent = msg; } };
      window.__updateTrailSummary = refreshSummary;
      refreshSummary();

      // Graph toolbar: time window / hold labels / reset view / clear / PNG export.
      document.querySelectorAll('.trail-window-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.trail-window-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          trail.setWindow(Number(btn.dataset.trailWindow) || 60000);
          sayStatus('উইন্ডো বদলানো হয়েছে');
        });
      });
      const trailHoldsBtn = document.getElementById('trailHoldsBtn');
      if (trailHoldsBtn) trailHoldsBtn.addEventListener('click', () => {
        const on = trailHoldsBtn.getAttribute('aria-pressed') !== 'true';
        trailHoldsBtn.setAttribute('aria-pressed', String(on));
        trail.setHolds(on);
        sayStatus(on ? 'স্বর লেবেল চালু' : 'স্বর লেবেল বন্ধ');
      });
      const trailResetBtn = document.getElementById('trailResetBtn');
      if (trailResetBtn) trailResetBtn.addEventListener('click', () => { trail.resetView(); sayStatus('ভিউ রিসেট'); });
      const trailClearBtn = document.getElementById('trailClearBtn');
      if (trailClearBtn) trailClearBtn.addEventListener('click', () => {
        trail.clear(); window.__updateTrailSummary(); sayStatus('ট্রেইল মোছা হয়েছে');
      });
      const trailExportBtn = document.getElementById('trailExportBtn');
      if (trailExportBtn) trailExportBtn.addEventListener('click', () => {
        trail.exportPNG(); sayStatus('ছবি ডিভাইসে সংরক্ষিত');
      });
    }
  }

  /* ========================================================
   * 6. NAVIGATION & TAB SWITCHING
   * ======================================================== */
  const tabBtns = [...document.querySelectorAll('.tab-btn')];
  const tabPanels = [...document.querySelectorAll('.tab-panel')];

  const activateTab = (btn) => {
    const target = btn.dataset.tab;
    tabBtns.forEach(b => {
      const selected = b === btn;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-selected', String(selected));
      b.tabIndex = selected ? 0 : -1;
    });
    tabPanels.forEach(p => {
      const selected = p.id === target;
      p.classList.toggle('active', selected);
      p.setAttribute('aria-hidden', String(!selected));
    });
  };

  tabBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => activateTab(btn));
    btn.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = (index + 1) % tabBtns.length;
      else if (e.key === 'ArrowLeft') next = (index - 1 + tabBtns.length) % tabBtns.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabBtns.length - 1;
      if (next == null) return;
      e.preventDefault();
      tabBtns[next].focus();
      activateTab(tabBtns[next]);
    });
  });
  activateTab(tabBtns.find(b => b.classList.contains('active')) || tabBtns[0]);

  /* ========================================================
   * 7. SCALE SYNC & SWARA MATRIX
   * ======================================================== */
  // Restore the saved scale before the first render: a chosen Sa used to
  // reset to A# on every reload, so the monitor and the singer disagreed.
  try {
    const savedScale = parseInt(localStorage.getItem('gan-si-scale-root-v1') || '', 10);
    if (savedScale >= 0 && savedScale <= 11) scaleSelect.value = String(savedScale);
  } catch {}

  const updateScaleMatrix = () => {
    const root = parseInt(scaleSelect.value, 10);
    window.audioEngine.rootOffset = root;
    try { localStorage.setItem('gan-si-scale-root-v1', String(root)); } catch {}
    // Follow the new Sa everywhere at once, even while the mic is silent:
    // pitch-trail grid, scale readout, tanpura label and dependent tools.
    if (window.__pitchTrail && window.__pitchTrail.setBaseMidi) window.__pitchTrail.setBaseMidi(48 + root);
    updateScaleInfo();
    window.dispatchEvent(new CustomEvent('gansi:scalechange', { detail: { root } }));
    // A drone struck on the old Sa would keep sounding under the new one.
    if (window.audioEngine.activeHarmoniumDrones && window.audioEngine.activeHarmoniumDrones.size) {
      [...window.audioEngine.activeHarmoniumDrones].forEach((id) => window.audioEngine.stopHarmoniumNote(id));
      window.audioEngine.activeHarmoniumDrones.clear();
      [droneSaBtn, dronePaBtn].forEach((btn) => {
        if (!btn) return;
        btn.classList.remove('active');
        btn.textContent = btn === droneSaBtn ? 'সা সুরতি (Sa Drone)' : 'পা সুরতি (Pa Drone)';
      });
    }

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

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'swara-chip';
      chip.dataset.sargamIndex = String(item.interval);
      chip.setAttribute('aria-label', `${item.name} (${western}) শুনুন`);
      chip.innerHTML = `
        <span class="swara-name">${item.name}</span>
        <span class="western-name">${western}</span>
      `;
      chip.addEventListener('click', () => {
        // Middle-Sa anchored MIDI (48 + root + interval) so the chips rise
        // in order; the old pc + octave-4 wrap dropped an octave mid-scale.
        const midi = 48 + root + item.interval;
        const freq = window.audioEngine.baseFreqA4 * Math.pow(2, (midi - 69) / 12);
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
  pitchDetector.onSessionStart = () => {
    if (accuracyScoreEl) accuracyScoreEl.textContent = '--';
  };

  startMicBtn.addEventListener('click', async () => {
    if (pitchDetector.isListening) {
      stopRagaLesson(false);
      stopGuidedPractice(false);
      pitchDetector.stopListening();
      if (window.__pitchTrail) window.__pitchTrail.stop(); // freeze graph
      if (window.__updateTrailSummary) window.__updateTrailSummary();
      releaseWakeLock();
      setMicStatus('idle', '⏹ মাইক্রোফোন বন্ধ। শুরু করতে «রেওয়াজ শুরু করুন» চাপুন।');
      startMicBtn.innerHTML = `${uiIcon('mic')} রেওয়াজ শুরু করুন`;
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
      if (window.__pitchTrail) window.__pitchTrail.start(); // resume scrolling
      requestWakeLock();
      setMicStatus('ok', '✅ মাইক্রোফোন চালু — গাইলে সুরের রেখা ও স্কোর এখানে ধরা পড়বে।');
      startMicBtn.innerHTML = `${uiIcon('stop')} রেওয়াজ থামান`;
      startMicBtn.classList.remove('btn-primary');
      startMicBtn.classList.add('btn-danger');
    } catch (err) {
      micFailure(err);
    }
  });

  pitchDetector.onPitchUpdate = (data) => {
    document.querySelectorAll('.swara-chip').forEach(c => c.classList.remove('active-pitch'));
    handleRagaLearningPitch(data);

    if (window.__pitchTrail) {
      if (data) {
        window.__pitchTrail.push({ midi: data.noteNum, inTune: data.isInTune, cents: data.cents });
        window.__pitchTrail.setTarget(pitchDetector.practiceTargetMidi, 12);
      } else {
        window.__pitchTrail.push({ midi: null }); // silence: break the line
      }
      window.__pitchTrail.setBaseMidi(48 + pitchDetector.getRootOffset());
    }

    if (!data) {
      sargamDisplay.classList.remove('active', 'in-tune');
      pitchHero.classList.remove('locked-in');
      // Silence must bring the needle back to zero. Without this it stayed
      // pinned at the last (often far-right) reading until the mic was stopped.
      pitchNeedle.style.left = '50%';
      if (apaswaraAlert) apaswaraAlert.classList.remove('visible');
      updateGuidedLive(null);
      return;
    }

    sargamDisplay.textContent = notationMode === 'western' ? data.noteName
      : notationMode === 'solfege' ? (window.Swara ? window.Swara.solfegeOf(data.sargamIndex) : data.sargamShortName)
      : data.sargamShortName;
    westernDisplay.innerHTML = `নোট: <strong>${data.noteName}</strong> (${data.sargamShortName}) | <strong>${data.freq}</strong> Hz | <strong>${data.cents > 0 ? '+' : ''}${data.cents}</strong> cents (${data.tuningSystem === 'just_intonation' ? 'শ্রুতি' : '12-TET'})`;
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
      pitchNeedle.style.removeProperty('background-color');
      pitchNeedle.style.removeProperty('box-shadow');
    } else {
      sargamDisplay.classList.remove('in-tune');
      sargamDisplay.classList.add('active');
      pitchHero.classList.remove('locked-in');
      pitchNeedle.style.removeProperty('background-color');
      pitchNeedle.style.removeProperty('box-shadow');
    }

    const activeChip = document.querySelector(`.swara-chip[data-sargam-index="${data.sargamIndex}"]`);
    if (activeChip) activeChip.classList.add('active-pitch');

    if (accuracyScoreEl && data.accuracyPercent) {
      accuracyScoreEl.textContent = `${data.accuracyPercent}%`;
    }

    handleGuidedPracticePitch(data);
    updateGuidedLive(data);
  };

  /* ========================================================
   * 9. ACTIVE RAGA SELECTION & DISMISS
   * ======================================================== */
  if (clearRagaBtn) {
    clearRagaBtn.addEventListener('click', () => {
      stopRagaLesson(false);
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
      startTanpuraBtn.innerHTML = `${uiIcon('tanpura')} তানপুরা`;
      startTanpuraBtn.classList.remove('active');
    } else {
      window.audioEngine.startTanpura(onStringPluck);
      startTanpuraBtn.innerHTML = `${uiIcon('stop')} তানপুরা বন্ধ`;
      startTanpuraBtn.classList.add('active');
    }
  });

  tanpuraTuningSelect.addEventListener('change', (e) => {
    window.audioEngine.tanpuraTuning = parseInt(e.target.value, 10);
    updateScaleInfo();
  });

  tanpuraTempoSlider.addEventListener('input', (e) => {
    window.audioEngine.tanpuraTempoBpm = parseInt(e.target.value, 10);
  });

  tanpuraVolumeSlider.addEventListener('input', (e) => {
    window.audioEngine.tanpuraVolume = parseFloat(e.target.value);
  });

  // P5-B: decay, auto-stop, per-string gains, sample layer (persisted locally)
  try {
    const savedTanpura = JSON.parse(localStorage.getItem('gan-si-tanpura') || '{}');
    if (savedTanpura.decay) window.audioEngine.setTanpuraDecay(savedTanpura.decay);
    if (savedTanpura.autoStop) window.audioEngine.setTanpuraAutoStop(savedTanpura.autoStop);
    if (Array.isArray(savedTanpura.gains)) savedTanpura.gains.forEach((g, i) => window.audioEngine.setTanpuraStringGain(i, g));
    if (savedTanpura.sampleUrl) window.audioEngine.loadTanpuraSample(savedTanpura.sampleUrl).catch(() => {});
  } catch {}
  const saveTanpura = () => {
    try {
      localStorage.setItem('gan-si-tanpura', JSON.stringify({
        decay: window.audioEngine.tanpuraDecaySec,
        autoStop: window.audioEngine.tanpuraAutoStopMin,
        gains: window.audioEngine.tanpuraStringGains,
        sampleUrl: window.audioEngine.tanpuraSampleUrl
      }));
    } catch {}
  };
  const decaySlider = document.getElementById('tanpuraDecaySlider');
  if (decaySlider) {
    decaySlider.value = window.audioEngine.tanpuraDecaySec;
    decaySlider.addEventListener('input', (e) => {
      window.audioEngine.setTanpuraDecay(parseFloat(e.target.value));
      const v = document.getElementById('tanpuraDecayVal');
      if (v) v.textContent = parseFloat(e.target.value).toFixed(1);
      saveTanpura();
    });
  }
  const autoStopSel = document.getElementById('tanpuraAutoStopSelect');
  if (autoStopSel) {
    autoStopSel.value = String(window.audioEngine.tanpuraAutoStopMin || 0);
    autoStopSel.addEventListener('change', (e) => {
      window.audioEngine.setTanpuraAutoStop(parseInt(e.target.value, 10));
      saveTanpura();
    });
  }
  document.querySelectorAll('.tanpura-string-gain').forEach(el => {
    el.addEventListener('input', (e) => {
      window.audioEngine.setTanpuraStringGain(parseInt(e.target.dataset.string, 10), parseFloat(e.target.value));
      saveTanpura();
    });
  });
  const sampleBtn = document.getElementById('tanpuraSampleBtn');
  if (sampleBtn) {
    sampleBtn.addEventListener('click', async () => {
      const url = document.getElementById('tanpuraSampleUrl').value.trim();
      try {
        await window.audioEngine.loadTanpuraSample(url || null);
        saveTanpura();
        sampleBtn.textContent = url ? '✅ লোড হয়েছে' : 'সিন্থ মোড';
      } catch {
        sampleBtn.textContent = '❌ লোড হয়নি';
      }
    });
  }

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
        droneSaBtn.innerHTML = `${uiIcon('play')} সা ড্রোন চালু`;
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
        dronePaBtn.innerHTML = `${uiIcon('play')} পা ড্রোন চালু`;
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
      startTaalBtn.innerHTML = `${uiIcon('drum')} তাল শুরু করুন`;
      startTaalBtn.classList.remove('active');
      document.querySelectorAll('.matra-pill').forEach(p => p.classList.remove('current-beat'));
    } else {
      window.audioEngine.startMetronome((beat) => {
        document.querySelectorAll('.matra-pill').forEach(p => p.classList.remove('current-beat'));
        const active = document.getElementById(`matra-pill-${beat.matra}`);
        if (active) active.classList.add('current-beat');
      });
      startTaalBtn.innerHTML = `${uiIcon('stop')} তাল বন্ধ করুন`;
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
  let guidedHoldStart = null; // P2-2: time-based hold (300ms), fps-independent
  let guidedSessionStartedAt = null;
  let guidedAlankarId = null;
  let guidedTonicHintShown = false;
  let guidedMissStreak = 0;
  const GUIDED_HOLD_MS = 300;

  // Swara identity by semitone, not by display string. Stripping accidentals
  // from names (the old normalizer) made রে and রে♭ indistinguishable, so a
  // komal note could pass as its shuddha neighbour. The detector reports
  // sargamIndex (0-11 from Sa); guided targets are mapped to the same scale.
  const SWARA_INDEX = { 'সা': 0, 'রে♭': 1, 'রে': 2, 'গা♭': 3, 'গা': 4, 'মা': 5, 'মা♯': 6, 'পা': 7, 'ধা♭': 8, 'ধা': 9, 'নি♭': 10, 'নি': 11 };
  const swaraIndexOf = (name) => {
    const t = String(name || '').trim().replace('াঁ', 'া');
    return SWARA_INDEX[t] ?? null;
  };
  // Per-swara miss counts for the practice-suggestion engine (analytics).
  const missBySwara = {};
  let lastMissAtBySwara = {};
  const trackMiss = (swara, now) => {
    const t = String(swara || '').trim();
    if (!t) return;
    const last = lastMissAtBySwara[t] || 0;
    if (now - last < 1500) return; // one miss per target per ~1.5s
    lastMissAtBySwara[t] = now;
    missBySwara[t] = (missBySwara[t] || 0) + 1;
    window.GanSiPracticeMiss = missBySwara;
  };

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

  // Target MIDI in the octave nearest the singer, so the graph's target line
  // and tolerance band sit where the voice actually is (a fixed middle-Sa
  // target could be an octave above a low male voice and look "wrong").
  const guidedTargetMidiFor = (swaraName, nearMidi) => {
    const idx = swaraIndexOf(swaraName);
    if (idx == null) return null;
    let midi = 48 + pitchDetector.getRootOffset() + idx;
    if (Number.isFinite(nearMidi)) {
      while (midi - nearMidi > 6) midi -= 12;
      while (nearMidi - midi > 6) midi += 12;
    }
    return midi;
  };
  const setGuidedTarget = (swaraName, nearMidi) => {
    const midi = guidedTargetMidiFor(swaraName, nearMidi);
    pitchDetector.practiceTargetMidi = midi;
    if (window.__pitchTrail) window.__pitchTrail.setTarget(midi, 12);
  };

  const setupGuidedPractice = (alankar) => {
    guidedNotesQueue = parseAlankarSwaras(alankar.notes);
    currentTargetIndex = 0;
    practiceScore = 0;
    guidedHoldStart = null;
    guidedTonicHintShown = false;
    guidedMissStreak = 0;
    const hintEl0 = document.getElementById('guidedTonicHint');
    if (hintEl0) { hintEl0.hidden = true; hintEl0.textContent = ''; }
    guidedAlankarId = alankar.id != null ? String(alankar.id) : null;

    if (guidedPracticeTitle) {
      guidedPracticeTitle.innerHTML = `${uiIcon('target')} ${alankar.title}`;
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
    if (isRagaLessonRunning) stopRagaLesson(false);
    if (!pitchDetector.isListening) {
      try {
        await pitchDetector.startListening();
        requestWakeLock();
        setMicStatus('ok', '✅ মাইক্রোফোন চালু — লক্ষ্য স্বরটি গাইলে স্কোর বাড়বে।');
        startMicBtn.innerHTML = `${uiIcon('stop')} রেওয়াজ থামান`;
        startMicBtn.classList.remove('btn-primary');
        startMicBtn.classList.add('btn-danger');
      } catch (err) {
        micFailure(err);
        return;
      }
    }

    isGuidedPracticeRunning = true;
    guidedSessionStartedAt = Date.now();
    activePracticeMeta = guidedAlankarId ? { alankar_id: guidedAlankarId } : null;
    startGuidedPracticeBtn.style.display = 'none';
    stopGuidedPracticeBtn.style.display = 'inline-flex';
    guidedStatsStrip.style.display = 'flex';
    setGuidedTarget(guidedNotesQueue[0], pitchDetector.lastPayload && pitchDetector.lastPayload.noteNum);
    updateGuidedLive(null);
  };

  const stopGuidedPractice = (log = true) => {
    isGuidedPracticeRunning = false;
    guidedHoldStart = null;
    pitchDetector.practiceTargetMidi = null;
    if (window.__pitchTrail) window.__pitchTrail.setTarget(null, 12);
    if (activePracticeMeta && activePracticeMeta.alankar_id) activePracticeMeta = null;
    startGuidedPracticeBtn.style.display = 'inline-flex';
    stopGuidedPracticeBtn.style.display = 'none';
    const liveEl = document.getElementById('guidedLiveReadout');
    if (liveEl) liveEl.hidden = true;

    // Whole minutes are logged by the interval logger with alankar_id.
    // Do not add a fixed two-minute session on every stop.
    if (log && guidedSessionStartedAt) {
      const elapsed = formatElapsed(Date.now() - guidedSessionStartedAt);
      if (currentTargetNoteEl) currentTargetNoteEl.textContent = `থামানো হয়েছে (${elapsed})`;
    }
    guidedSessionStartedAt = null;
  };

  if (startGuidedPracticeBtn) startGuidedPracticeBtn.addEventListener('click', startGuidedPractice);
  if (stopGuidedPracticeBtn) stopGuidedPracticeBtn.addEventListener('click', stopGuidedPractice);

  // Live verdict line in the alankar arena: correct / near / wrong, with the
  // note actually heard and the cents, so the singer does not need to switch
  // to the pitch tab to know whether the phrase is right.
  function updateGuidedLive(data) {
    const el = document.getElementById('guidedLiveReadout');
    if (!el) return;
    if (!isGuidedPracticeRunning) { el.hidden = true; return; }
    el.hidden = false;
    if (!data) {
      el.className = 'guided-live';
      el.textContent = '🎤 শুনছি… গাইতে শুরু করুন';
      return;
    }
    const targetSwara = guidedNotesQueue[currentTargetIndex];
    const targetIdx = swaraIndexOf(targetSwara);
    let verdict, cls;
    if (data.isInTune && (targetIdx == null || data.sargamIndex === targetIdx)) { verdict = '✓ সঠিক'; cls = 'ok'; }
    else if (data.isInTune) { verdict = '≈ সুরে, ভিন্ন স্বর'; cls = 'near'; }
    else { verdict = '✗ বেঠিক'; cls = 'bad'; }
    const cents = (data.cents > 0 ? '+' : '') + data.cents;
    el.className = 'guided-live ' + cls;
    el.textContent = `${verdict} · শোনা: ${data.sargamShortName} (${cents}¢) · লক্ষ্য: ${targetSwara || '—'}`;
  }

  const handleGuidedPracticePitch = (data) => {
    if (!isGuidedPracticeRunning || currentTargetIndex >= guidedNotesQueue.length) return;

    const targetSwara = guidedNotesQueue[currentTargetIndex];
    const now = Date.now();

    // Match by semitone index so komal and shuddha variants of the same swara
    // stay distinct; the string fallback remains only for unknown notations.
    const targetIdx = swaraIndexOf(targetSwara);
    const matched = data.isInTune && (
      targetIdx != null
        ? targetIdx === data.sargamIndex
        : String(data.sargamShortName || '').trim() === String(targetSwara || '').trim()
    );

    if (matched) {
      guidedMissStreak = 0;
      if (guidedHoldStart == null) guidedHoldStart = now;
      if (now - guidedHoldStart >= GUIDED_HOLD_MS) {
        guidedHoldStart = null;
        const currentCard = document.getElementById(`guided-swara-${currentTargetIndex}`);
        if (currentCard) {
          currentCard.classList.remove('target-current');
          currentCard.classList.add('hit-success');
        }

        practiceScore += 10;
        if (practiceScoreEl) practiceScoreEl.textContent = practiceScore;
        const hitRate = Math.round(((currentTargetIndex + 1) / guidedNotesQueue.length) * 100);
        const hitEl = document.getElementById('practiceHitRate');
        if (hitEl) hitEl.textContent = `${hitRate}%`;

        currentTargetIndex++;
        if (currentTargetIndex < guidedNotesQueue.length) {
          const nextCard = document.getElementById(`guided-swara-${currentTargetIndex}`);
          if (nextCard) nextCard.classList.add('target-current');
          if (currentTargetNoteEl) currentTargetNoteEl.textContent = guidedNotesQueue[currentTargetIndex];
          setGuidedTarget(guidedNotesQueue[currentTargetIndex], data.noteNum);
        } else {
          if (currentTargetNoteEl) currentTargetNoteEl.textContent = "সম্পূর্ণ! 🎉";
          stopGuidedPractice();
          alert(`অভিনন্দন! আপনি সফলভাবে অলংকারটি সম্পন্ন করেছেন!\nমোট স্কোর: ${practiceScore} পয়েন্ট\n(সহায়ক পরিমাপ — শিল্পের চূড়ান্ত মান নয়)`);
        }
      }
    } else {
      guidedHoldStart = null;
      if (data.isInTune) trackMiss(targetSwara, now);
      // A stable sung pitch that never matches the target is the classic sign
      // that the app's Sa is not the singer's Sa (e.g. singing in C while the
      // scale selector says A#): every swara is shifted, every cent reading is
      // off, and the score stays 0. Explain it instead of failing silently.
      guidedMissStreak++;
      if (!guidedTonicHintShown && guidedMissStreak >= 8) {
        guidedTonicHintShown = true;
        const hintEl = document.getElementById('guidedTonicHint');
        if (hintEl) {
          hintEl.hidden = false;
          hintEl.textContent = '⚠️ সুর ধরা পড়ছে কিন্তু লক্ষ্যের সঙ্গে মিলছে না। সম্ভবত «সা = ...»-এ আপনার আসল সা বাছা হয়নি (যেমন C-তে গেয়ে অ্যাপে A# ধরে থাকা)। উপরের ড্রপডাউন থেকে সঠিক সা বাছুন।';
        }
      }
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

  const loadAlankars = async () => {
    try {
      const items = window.GanSiMusicData
        ? await window.GanSiMusicData.loadCollection('/api/alankars', '/data/alankars.json', 'alankars')
        : await fetch(window.GANSI_STATIC_MODE ? '/data/alankars.json' : '/api/alankars')
            .then(r => r.json()).then(d => Array.isArray(d) ? d : (d.alankars || []));
      renderAlankars(items.length ? items : defaultAlankars);
    } catch { renderAlankars(defaultAlankars); }
  };
  loadAlankars();

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
        toggleRangeTestBtn.innerHTML = `${uiIcon('mic')} পুনরায় টেস্ট করুন`;
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
            startMicBtn.innerHTML = `${uiIcon('stop')} রেওয়াজ থামান`;
            startMicBtn.classList.remove('btn-primary');
            startMicBtn.classList.add('btn-danger');
          } catch (e) {
            micFailure(e);
            return;
          }
        }

        pitchDetector.startRangeTest();
        toggleRangeTestBtn.innerHTML = `${uiIcon('stop')} টেস্ট সমাপ্ত করুন`;
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
  const ragaLearningBox = document.getElementById('ragaLearningBox');
  const ragaLearningBadge = document.getElementById('ragaLearningBadge');
  const ragaStageStepper = document.getElementById('ragaStageStepper');
  const ragaLessonStage = document.getElementById('ragaLessonStage');
  const ragaLessonTarget = document.getElementById('ragaLessonTarget');
  const ragaLessonProgress = document.getElementById('ragaLessonProgress');
  const ragaHoldMeter = document.getElementById('ragaHoldMeter');
  const ragaHoldFill = document.getElementById('ragaHoldFill');
  const ragaLessonTrail = document.getElementById('ragaLessonTrail');
  const ragaLessonMessage = document.getElementById('ragaLessonMessage');
  const startRagaLessonBtn = document.getElementById('startRagaLessonBtn');
  const stopRagaLessonBtn = document.getElementById('stopRagaLessonBtn');
  const playRagaTargetBtn = document.getElementById('playRagaTargetBtn');
  const ragaLessonStats = document.getElementById('ragaLessonStats');
  const ragaLessonElapsed = document.getElementById('ragaLessonElapsed');
  const ragaLessonAccuracy = document.getElementById('ragaLessonAccuracy');
  const ragaLessonPakad = document.getElementById('ragaLessonPakad');
  let ragaLessonSession = null;
  let isRagaLessonRunning = false;
  let ragaLessonTimer = null;
  const ragaPitchHistory = window.PitchHistory ? new window.PitchHistory({ windowSec: 30 }) : null;

  const formatElapsed = (ms) => {
    const sec = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
  };

  const syncRagaPracticeTarget = () => {
    if (!ragaLessonSession) return;
    const { stage, target } = ragaLessonSession.current();
    pitchDetector.practiceDirection = stage ? stage.direction : null;
    pitchDetector.practiceTargetMidi = target ? target.midi : null;
  };

  const renderRagaLesson = () => {
    if (!ragaLessonSession || !ragaLearningBox) return;
    const s = ragaLessonSession;
    const { stage, target } = s.current();
    ragaLearningBox.hidden = false;
    ragaLearningBadge.textContent = s.raga.verified ? 'যাচাইকৃত' : 'শিক্ষক-যাচাই বাকি';
    ragaStageStepper.innerHTML = '';
    s.stages.forEach((st, i) => {
      const el = document.createElement('div');
      el.className = `lesson-step ${i < s.stageIndex ? 'complete' : ''} ${i === s.stageIndex ? 'current' : ''}`;
      el.textContent = `${i < s.stageIndex ? '✅ ' : ''}${st.title}`;
      ragaStageStepper.appendChild(el);
    });
    ragaLessonStage.textContent = stage ? stage.title : 'সম্পন্ন';
    ragaLessonTarget.textContent = target ? `${target.label} · ${window.Swara.saptakLabel(window.Swara.saptakOf(target.midi, s.baseMidi - 48))}` : '🎉';
    ragaLessonProgress.textContent = `${s.progress()}%`;
    ragaLessonTrail.innerHTML = '';
    if (stage) {
      stage.targets.forEach((t, i) => {
        const el = document.createElement('div');
        el.className = `guided-swara-item ${i < s.targetIndex ? 'hit-success' : ''} ${i === s.targetIndex ? 'target-current' : ''}`;
        el.textContent = t.label;
        ragaLessonTrail.appendChild(el);
      });
    }
    syncRagaPracticeTarget();
    updateRagaLessonLive();
  };

  const updateRagaLessonLive = () => {
    if (!ragaLessonSession) return;
    const s = ragaLessonSession;
    const holdPct = Math.round(s.holdProgress() * 100);
    ragaHoldFill.style.width = `${holdPct}%`;
    ragaHoldMeter.setAttribute('aria-valuenow', String(holdPct));
    if (s.lastMessage) ragaLessonMessage.textContent = s.lastMessage;
    const summary = s.summary();
    ragaLessonElapsed.textContent = formatElapsed(summary.elapsedMs);
    ragaLessonAccuracy.textContent = `${summary.accuracy}%`;
    ragaLessonPakad.textContent = s.pakadSequence.length ? `${Math.round(summary.pakadSimilarity * 100)}%` : '--';
  };

  const prepareRagaLesson = (raga) => {
    if (isRagaLessonRunning) stopRagaLesson(false);
    const root = pitchDetector.getRootOffset();
    ragaLessonSession = window.RagaLearning.createSession(raga, { baseMidi: 48 + root, holdMs: 300 });
    window.ragaLessonSession = ragaLessonSession;
    ragaPitchHistory && ragaPitchHistory.clear();
    isRagaLessonRunning = false;
    startRagaLessonBtn.style.display = 'inline-flex';
    stopRagaLessonBtn.style.display = 'none';
    ragaLessonStats.style.display = 'none';
    ragaLessonMessage.textContent = `${raga.name} প্রস্তুত — “শিক্ষা শুরু করুন” চাপুন।`;
    renderRagaLesson();
    ragaLearningBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const startRagaLesson = async () => {
    if (!ragaLessonSession || isRagaLessonRunning) return;
    if (ragaLessonSession.finishedAt != null) {
      prepareRagaLesson(ragaLessonSession.raga);
    }
    if (isGuidedPracticeRunning) stopGuidedPractice(false);
    if (!pitchDetector.isListening) {
      try {
        await pitchDetector.startListening();
        requestWakeLock();
        startMicBtn.innerHTML = `${uiIcon('stop')} রেওয়াজ থামান`;
        startMicBtn.classList.remove('btn-primary');
        startMicBtn.classList.add('btn-danger');
      } catch (err) {
        ragaLessonMessage.textContent = micFailure(err);
        return;
      }
    }
    isRagaLessonRunning = true;
    activePracticeMeta = { raga_id: ragaLessonSession.raga.id };
    ragaLessonSession.start();
    startRagaLessonBtn.style.display = 'none';
    stopRagaLessonBtn.style.display = 'inline-flex';
    ragaLessonStats.style.display = 'flex';
    ragaLessonMessage.textContent = 'সা স্থির করুন…';
    syncRagaPracticeTarget();
    clearInterval(ragaLessonTimer);
    ragaLessonTimer = setInterval(updateRagaLessonLive, 250);
  };

  const stopRagaLesson = (log = true) => {
    if (!ragaLessonSession) return;
    const wasRunning = isRagaLessonRunning;
    const summary = ragaLessonSession.summary();
    if (wasRunning) ragaLessonSession.stop('stopped');
    isRagaLessonRunning = false;
    clearInterval(ragaLessonTimer);
    ragaLessonTimer = null;
    pitchDetector.practiceDirection = null;
    pitchDetector.practiceTargetMidi = null;
    if (activePracticeMeta && activePracticeMeta.raga_id) activePracticeMeta = null;
    startRagaLessonBtn.style.display = 'inline-flex';
    stopRagaLessonBtn.style.display = 'none';
    updateRagaLessonLive();
    // Whole minutes are already logged by the interval logger with raga_id.
    // Avoid a second, inflated POST here; sub-minute practice remains local UI data.
    if (log && wasRunning) ragaLessonMessage.textContent = `থামানো হয়েছে — ${formatElapsed(summary.elapsedMs)} অনুশীলন।`;
  };

  const completeRagaLesson = () => {
    const summary = ragaLessonSession.summary();
    stopRagaLesson(false);
    ragaLessonMessage.textContent = `🎉 শিক্ষা-ক্রম সম্পন্ন! পাকড়ের সম্ভাব্য মিল ${Math.round(summary.pakadSimilarity * 100)}% — সহায়ক পরিমাপ, শিল্পের চূড়ান্ত বিচার নয়।`;
  };

  // A scale change re-anchors a prepared lesson on the new Sa (an in-progress
  // lesson is stopped first, so its targets can never point at the old Sa).
  window.addEventListener('gansi:scalechange', () => {
    // Alankar practice: the target swara moved with the new Sa, so re-anchor
    // the graph line too (otherwise it keeps pointing at the old Sa).
    if (isGuidedPracticeRunning && guidedNotesQueue[currentTargetIndex]) {
      setGuidedTarget(guidedNotesQueue[currentTargetIndex], pitchDetector.lastPayload && pitchDetector.lastPayload.noteNum);
    }
    if (!ragaLessonSession) return;
    const raga = ragaLessonSession.raga;
    if (isRagaLessonRunning) stopRagaLesson(false);
    prepareRagaLesson(raga);
    ragaLessonMessage.textContent = 'স্কেল বদলেছে — পাঠ নতুন ‘সা’-তে সাজানো হয়েছে।';
  });

  const handleRagaLearningPitch = (data) => {
    if (!isRagaLessonRunning || !ragaLessonSession) return;
    const now = Date.now();
    const { target } = ragaLessonSession.current();
    if (data && target) {
      ragaPitchHistory && ragaPitchHistory.push({ freq: data.freq, targetMidi: target.midi, cents: data.cents, t: now });
    }
    const result = ragaLessonSession.feed({
      midi: data ? data.noteNum : null,
      cents: data ? data.cents : 999,
      inTune: !!(data && data.isInTune),
      now
    });
    if (result === 'advanced' || result === 'stage-complete' || result === 'done') renderRagaLesson();
    else updateRagaLessonLive();
    if (result === 'done') completeRagaLesson();
  };

  startRagaLessonBtn && startRagaLessonBtn.addEventListener('click', startRagaLesson);
  stopRagaLessonBtn && stopRagaLessonBtn.addEventListener('click', () => stopRagaLesson(true));
  playRagaTargetBtn && playRagaTargetBtn.addEventListener('click', () => {
    if (!ragaLessonSession) return;
    const { target } = ragaLessonSession.current();
    if (!target) return;
    const root = ragaLessonSession.baseMidi - 48;
    const saFreq = window.audioEngine.getNoteFrequency(root, 3);
    const jiCents = window.Swara.JI_CENTS[((target.interval % 12) + 12) % 12] + 1200 * Math.floor(target.interval / 12);
    const freq = pitchDetector.tuningSystem === 'just_intonation'
      ? saFreq * Math.pow(2, jiCents / 1200)
      : window.Swara.midiToFreq(target.midi, window.audioEngine.baseFreqA4);
    window.audioEngine.playHarmoniumNote(freq, 'raga-lesson-target');
    setTimeout(() => window.audioEngine.stopHarmoniumNote('raga-lesson-target'), 700);
  });

  const renderRagas = (items) => {
    if (!ragaGrid) return;
    ragaGrid.innerHTML = '';
    items.forEach(r => {
      const card = document.createElement('div');
      card.className = 'raga-card';
      card.innerHTML = `
        <h3>${r.name}</h3>
        <div class="raga-info-row"><strong>ঠাট:</strong> ${r.thaat} | <strong>সময়:</strong> ${r.time}</div>
        <div class="raga-info-row"><strong>বাদী:</strong> ${r.vadi_text || r.vadi} | <strong>সমবাদী:</strong> ${r.samvadi_text || r.samvadi}</div>
        <div class="raga-info-row"><strong>বর্জিত স্বর:</strong> ${r.varjya || 'নেই'} ${r.verified ? '• ✅ যাচাইকৃত' : '• ⏳ শিক্ষক-যাচাই বাকি'}</div>
        <div class="raga-info-row"><strong>আরোহ:</strong> ${r.aroha}</div>
        <div class="raga-info-row"><strong>অবরোহ:</strong> ${r.avoroha}</div>
        <div class="raga-info-row"><strong>পকড়:</strong> ${r.pakad}</div>
        <div class="raga-actions">
          <button class="btn-outline raga-play-btn">${uiIcon('play')} আরোহ-অবরোহ শুনুন</button>
          <button class="btn-primary raga-select-btn">${uiIcon('music')} এই রাগে রেওয়াজ</button>
          <button class="btn-outline raga-learn-btn">${uiIcon('target')} ধাপে ধাপে শিখুন</button>
        </div>
      `;

      // Play Aroha/Avoroha Preview
      const playBtn = card.querySelector('.raga-play-btn');
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.audioEngine.swaraSeqPlaying) {
          window.audioEngine.stopSwaraSequence();
          playBtn.innerHTML = `${uiIcon('play')} আরোহ-অবরোহ শুনুন`;
        } else {
          playBtn.innerHTML = `${uiIcon('stop')} থামান`;
          // Aroha and avaroha are distinct melodic lines: play each as
          // written. When aroha ends on সাঁ (12) and avaroha starts there,
          // sound that Sa' once instead of twice. Ragas without interval data
          // fall back to the plain scale up and down.
          const aroha = Array.isArray(r.aroha_intervals) && r.aroha_intervals.length ? r.aroha_intervals : null;
          const avaroha = Array.isArray(r.avaroha_intervals) && r.avaroha_intervals.length ? r.avaroha_intervals : null;
          let fullSeq;
          if (aroha && avaroha) {
            fullSeq = aroha[aroha.length - 1] === avaroha[0]
              ? [...aroha, ...avaroha.slice(1)]
              : [...aroha, ...avaroha];
          } else {
            const base = r.allowedIntervals || [0, 2, 4, 5, 7, 9, 11];
            fullSeq = [...base, 12, ...[...base].reverse()];
          }
          window.audioEngine.playIntervalSequence(fullSeq, null, () => {
            playBtn.innerHTML = `${uiIcon('play')} আরোহ-অবরোহ শুনুন`;
          });
        }
      });

      // Select Raga for Practice
      const selectBtn = card.querySelector('.raga-select-btn');
      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopRagaLesson(false);
        if (isGuidedPracticeRunning) stopGuidedPractice(false);
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

      const learnBtn = card.querySelector('.raga-learn-btn');
      learnBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopRagaLesson(false);
        pitchDetector.setActiveRaga(r);
        if (activeRagaPill && activeRagaName) {
          activeRagaName.textContent = r.name;
          activeRagaPill.style.display = 'inline-flex';
        }
        if (r.firstString !== undefined) {
          tanpuraTuningSelect.value = r.firstString;
          window.audioEngine.tanpuraTuning = r.firstString;
        }
        prepareRagaLesson(r);
      });

      ragaGrid.appendChild(card);
    });
  };

  const loadRagas = async () => {
    try {
      const items = window.GanSiMusicData
        ? await window.GanSiMusicData.loadCollection('/api/ragas', '/data/ragas.json', 'ragas')
        : await fetch(window.GANSI_STATIC_MODE ? '/data/ragas.json' : '/api/ragas')
            .then(r => r.json()).then(d => Array.isArray(d) ? d : (d.ragas || []));
      renderRagas(items);
    } catch { console.warn('Could not load raga data'); }
  };
  loadRagas();

  /* ========================================================
   * 16. INDEXEDDB CLIENT-SIDE PRIVATE RECORDINGS & CLOUD SYNC
   * ======================================================== */
  const recordingExtension = (mime = '') => {
    if (mime.includes('ogg')) return 'ogg';
    if (mime.includes('mp4')) return 'm4a';
    if (mime.includes('mpeg')) return 'mp3';
    if (mime.includes('wav')) return 'wav';
    return 'webm';
  };

  const backupRecording = async (rec) => {
    if (!rec || !rec.blob) return false;
    if (window.GANSI_STATIC_MODE) {
      if (backupStatus) backupStatus.textContent = '🔒 এই সাইটে সার্ভার ব্যাকআপ নেই; রেকর্ডিং শুধু আপনার ডিভাইসে সংরক্ষিত আছে।';
      return false;
    }
    if (backupStatus) backupStatus.textContent = '☁️ ব্যাকআপ আপলোড হচ্ছে…';
    try {
      const ext = recordingExtension(rec.mimeType || rec.blob.type);
      const formData = new FormData();
      formData.append('audio', rec.blob, `riyaz-${Date.now()}.${ext}`);
      const f = window.GanSiAuth ? window.GanSiAuth.fetch : fetch;
      const res = await f('/api/recordings', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`backup failed: ${res.status}`);
      if (backupStatus) backupStatus.textContent = '✅ ব্যাকআপ সম্পন্ন।';
      return true;
    } catch {
      if (backupStatus) backupStatus.textContent = '⚠️ ব্যাকআপ ব্যর্থ; রেকর্ডিংটি এখনো নিরাপদে এই ডিভাইসে আছে।';
      return false;
    }
  };

  const loadLocalRecordings = async () => {
    if (!recordingsList) return;
    const localItems = await RiyazIDB.getAll();

    if (!localItems || localItems.length === 0) {
      recordingsList.innerHTML = '<div class="empty-state">কোনো রেকর্ডিং নেই। উপরে <strong>“রেকর্ড”</strong> বাটন চেপে আপনার রেওয়াজ রেকর্ড করুন। এটি সম্পূর্ণ গোপনে আপনার ব্রাউজারে সংরক্ষিত থাকবে।</div>';
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

      const ext = recordingExtension(rec.mimeType || rec.blob.type);
      const safeName = String(rec.name || 'রেওয়াজ').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      item.innerHTML = `
        <div class="recording-meta">
          <strong>${safeName}</strong>
          <div class="recording-details">${formattedDate} • ${sizeMb} MB (ব্যক্তিগত অফলাইন স্টোরেজ)</div>
        </div>
        <audio controls src="${audioUrl}"></audio>
        <div class="recording-actions">
          <a class="btn-outline" href="${audioUrl}" download="${safeName}.${ext}">${uiIcon('download')} ডাউনলোড</a>
          <button class="btn-outline btn-backup">${uiIcon('cloud')} ব্যাকআপ</button>
          <button class="btn-outline btn-delete" title="মুছুন" aria-label="রেকর্ডিং মুছুন">${uiIcon('trash')}</button>
        </div>
      `;

      const backupBtn = item.querySelector('.btn-backup');
      backupBtn.addEventListener('click', async () => {
        backupBtn.disabled = true;
        const ok = await backupRecording(rec);
        backupBtn.disabled = false;
        backupBtn.innerHTML = ok ? `${uiIcon('cloud')} ব্যাকআপ হয়েছে` : `${uiIcon('cloud')} পুনরায় চেষ্টা`;
      });

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
      recordBtn.innerHTML = `${uiIcon('record')} রেকর্ড`;
      recordBtn.classList.remove('btn-danger');

      if (blob) {
        // 1. Always save locally in private IndexedDB.
        const rec = await RiyazIDB.save(blob, `রেওয়াজ-${new Date().toLocaleTimeString('bn-BD')}`);
        loadLocalRecordings();

        // 2. Upload only after explicit opt-in.
        if (rec && cloudBackupToggle && cloudBackupToggle.checked) await backupRecording(rec);
        else if (backupStatus) backupStatus.textContent = '🔒 রেকর্ডিং শুধু এই ডিভাইসে সংরক্ষিত হয়েছে।';
        if (rec) setMicStatus('ok', '✅ রেকর্ডিং এই ডিভাইসে সংরক্ষিত হয়েছে (' + (window.GanSiMic ? window.GanSiMic.bn(blob.size) : blob.size) + ' বাইট)।');
      } else {
        const why = window.audioEngine.lastRecordingError
          ? 'মিডিয়া রেকর্ডার ত্রুটি: ' + window.audioEngine.lastRecordingError
          : 'কোনো অডিও ধরা পড়েনি — মাইক্রোফোন অনুমতি ও ইনপুট যাচাই করুন।';
        setMicStatus('error', '❌ রেকর্ডিং খালি ছিল, কিছু সংরক্ষিত হয়নি। ' + why);
        if (backupStatus) backupStatus.textContent = '⚠️ রেকর্ডিং খালি ছিল — সংরক্ষিত হয়নি।';
      }
    } else {
      let stream = pitchDetector.micStream;
      if (!stream) {
        try {
          stream = await pitchDetector.startListening();
          requestWakeLock();
          setMicStatus('ok', '✅ মাইক্রোফোন চালু — রেকর্ডিং শুরু হচ্ছে।');
          startMicBtn.innerHTML = `${uiIcon('stop')} রেওয়াজ থামান`;
          startMicBtn.classList.remove('btn-primary');
          startMicBtn.classList.add('btn-danger');
        } catch (e) {
          micFailure(e);
          if (backupStatus) backupStatus.textContent = '⚠️ মাইক্রোফোন না থাকায় রেকর্ডিং শুরু হয়নি।';
          return;
        }
      }

      const started = await window.audioEngine.startRecording(stream);
      if (!started) {
        setMicStatus('error', '❌ রেকর্ডার শুরু করা যায়নি: ' + (window.audioEngine.lastRecordingError || 'অজানা ত্রুটি') + '। «মাইক যাচাই» চাপুন।');
        return;
      }
      setMicStatus('recording', '⏺ রেকর্ডিং চলছে — থামাতে «রেকর্ডিং থামান» চাপুন।');
      recordBtn.innerHTML = `${uiIcon('stop')} রেকর্ডিং থামান`;
      recordBtn.classList.add('btn-danger');
    }
  });

  /* ========================================================
   * 17. SESSION STOPWATCH & INTERVAL AUTO-LOGGER
   * ======================================================== */
  let secondsSpent = 0;
  let noSignalSeconds = 0;
  setInterval(() => {
    if (!pitchDetector.isListening) return;
    secondsSpent++;
    const m = Math.floor(secondsSpent / 60).toString().padStart(2, '0');
    const s = (secondsSpent % 60).toString().padStart(2, '0');
    if (sessionTimerEl) sessionTimerEl.textContent = `${m}:${s}`;

    // A session that is "listening" but never captures a pitch is not a
    // practice session. Say so plainly instead of silently logging minutes.
    if (pitchDetector.hasRecentSignal && pitchDetector.hasRecentSignal(6000)) {
      noSignalSeconds = 0;
      if (micStatusEl && micStatusEl.dataset.state === 'warn') {
        setMicStatus('ok', '✅ সুর ধরা পড়ছে — গ্রাফ ও স্কোর হালনাগাদ হচ্ছে।');
      }
    } else {
      noSignalSeconds++;
      if (noSignalSeconds >= 6 && micStatusEl && micStatusEl.dataset.state !== 'error') {
        setMicStatus('warn', '⚠️ মাইক চালু আছে, কিন্তু কোনো সুর ধরা পড়ছে না — নীরবতা, ভুল ইনপুট বা অনুমতি যাচাই করতে «মাইক যাচাই» চাপুন।');
      }
    }

    // Only count a minute as practiced when the mic actually captured singing.
    if (!window.GANSI_STATIC_MODE && secondsSpent % 60 === 0 && (!pitchDetector.hasRecentSignal || pitchDetector.hasRecentSignal(60000))) {
      (window.GanSiAuth ? window.GanSiAuth.fetch : fetch)('/api/stats/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: 1, ...(activePracticeMeta || {}) })
      }).then(() => loadUserStats()).catch(() => {});
    }
  }, 1000);
});
