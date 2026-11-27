const { test, expect } = require('@playwright/test');

test('app loads with all 11 tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/গান-সি|সুর সাধনা/);
  const tabs = page.locator('.tab-btn');
  await expect(tabs).toHaveCount(11);
  await page.click('.tab-btn[data-tab="tab-pianoroll"]');
  await expect(page.locator('#tab-pianoroll')).toHaveClass(/active/);
  await expect(page.locator('#pianoRollCanvas')).toBeVisible();
});

test('tab navigation switches panels', async ({ page }) => {
  await page.goto('/');
  await page.click('.tab-btn[data-tab="tab-theory"]');
  await expect(page.locator('#tab-theory')).toHaveClass(/active/);
  await page.click('.tab-btn[data-tab="tab-ear"]');
  await expect(page.locator('#tab-ear')).toHaveClass(/active/);
});

test('theory centre renders 10 chapters', async ({ page }) => {
  await page.goto('/');
  await page.click('.tab-btn[data-tab="tab-theory"]');
  await expect(page.locator('#theoryList > div').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#theoryList > div')).toHaveCount(10);
});

test('alankar generator produces a pattern', async ({ page }) => {
  await page.goto('/');
  await page.click('.tab-btn[data-tab="tab-progress"]');
  await page.click('#genBtn');
  await expect(page.locator('#genOutput')).not.toBeEmpty();
});

test('ear training play + answer flow', async ({ page }) => {
  await page.goto('/');
  await page.click('.tab-btn[data-tab="tab-ear"]');
  await page.click('#earPlayBtn');
  await page.click('.ear-answer[data-swara="সা"]');
  await expect(page.locator('#earScore')).not.toContainText('0/0');
});

test('mic starts with fake device (guided practice path)', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await page.goto('/');
  await page.click('#startMicBtn');
  await expect(page.locator('#startMicBtn')).toContainText(/থামান/, { timeout: 15000 });
  // pitch hero should leave placeholder state once fake audio flows
  await page.click('#startMicBtn');
  await expect(page.locator('#startMicBtn')).toContainText(/রেও/);
});

test('accessibility basics: zoom, labels, unique ids and keyboard tabs', async ({ page }) => {
  await page.goto('/');
  const audit = await page.evaluate(() => ({
    viewport: document.querySelector('meta[name="viewport"]').content,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    themeSelectScheme: getComputedStyle(document.querySelector('#themeSelect')).colorScheme,
    unlabeled: [...document.querySelectorAll('input,select,textarea')].filter(el =>
      !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('title')
    ).map(el => el.id),
    duplicateIds: [...document.querySelectorAll('[id]')].map(el => el.id).filter((id, i, all) => all.indexOf(id) !== i)
  }));
  expect(audit.viewport).not.toMatch(/user-scalable=no|maximum-scale=1/);
  expect(audit.colorScheme).toBe('light');
  expect(audit.themeSelectScheme).toBe('light');
  expect(await page.evaluate(() => document.body.dataset.theme)).toBe('paper');
  expect(audit.unlabeled).toEqual([]);
  expect(audit.duplicateIds).toEqual([]);
  await page.locator('#tabbtn-pitch').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tabbtn-tanpura')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#tab-tanpura')).toHaveClass(/active/);
});

test('all visible numbers use Bengali digits while form values stay ASCII', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.GanSiNumbers);
  await page.evaluate(() => {
    document.querySelector('#sessionTimer').textContent = '00:42';
    document.querySelector('#taalBpmVal').textContent = '80 BPM';
    document.querySelector('#accuracyScore').textContent = '24%';
  });
  await expect(page.locator('#sessionTimer')).toHaveText('০০:৪২');
  await expect(page.locator('#taalBpmVal')).toHaveText('৮০ BPM');
  await expect(page.locator('#accuracyScore')).toHaveText('২৪%');
  // Piano keys render in app.js DOMContentLoaded after numbers.js starts;
  // wait for the observer to localize them before the full-DOM scan.
  await expect(page.locator('#harmoniumKeyboard')).toContainText('C৩', { timeout: 10000 });
  expect(await page.locator('#scaleSelect').inputValue()).toBe('10');
  expect(await page.evaluate(() => window.GanSiNumbers.toBengaliDigits('123'))).toBe('১২৩');
  const asciiVisible = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const bad = [];
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !/[0-9]/.test(node.nodeValue)) continue;
      const p = node.parentElement;
      if (!p || p.closest('script,style,svg,textarea,input,select,[data-no-bn-digits]')) continue;
      bad.push(node.nodeValue.trim());
    }
    return bad;
  });
  expect(asciiVisible).toEqual([]);
});

test('optional dark theme updates root color scheme and surfaces', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#themeSelect', 'dark');
  const dark = await page.evaluate(() => ({
    theme: document.body.dataset.theme,
    rootTheme: document.documentElement.dataset.theme,
    scheme: getComputedStyle(document.documentElement).colorScheme,
    background: getComputedStyle(document.body).backgroundColor
  }));
  expect(dark.theme).toBe('dark');
  expect(dark.rootTheme).toBe('dark');
  expect(dark.scheme).toBe('dark');
  expect(dark.background).toBe('rgb(18, 20, 22)');
});

test('material layout stays within a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const layout = await page.evaluate(() => ({
    viewport: innerWidth,
    bodyWidth: document.body.scrollWidth,
    docWidth: document.documentElement.scrollWidth,
    cardRadius: getComputedStyle(document.querySelector('.card')).borderRadius,
    tabPosition: getComputedStyle(document.querySelector('.app-tabs')).position,
    iconCount: document.querySelectorAll('svg.icon').length
  }));
  expect(layout.docWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.tabPosition).toBe('sticky');
  expect(layout.iconCount).toBeGreaterThan(10);
});

test('tanpura string labels never overlap on desktop or mobile', async ({ page }) => {
  for (const width of [390, 900]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.click('.tab-btn[data-tab="tab-tanpura"]');
    const boxes = await page.evaluate(() => {
      const root = document.querySelector('.tanpura-strings-visual').getBoundingClientRect();
      const labels = [...document.querySelectorAll('.tanpura-string-label')].map(el => {
        const r = el.getBoundingClientRect();
        return { left:r.left, right:r.right, top:r.top, bottom:r.bottom };
      });
      return { root:{left:root.left,right:root.right}, labels };
    });
    expect(boxes.labels).toHaveLength(4);
    for (let i = 0; i < boxes.labels.length; i++) {
      const a = boxes.labels[i];
      expect(a.left).toBeGreaterThanOrEqual(boxes.root.left);
      expect(a.right).toBeLessThanOrEqual(boxes.root.right);
      for (let j = i + 1; j < boxes.labels.length; j++) {
        const b = boxes.labels[j];
        const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        expect(overlaps).toBe(false);
      }
    }
  }
});

test('C scale keeps root offset 0 instead of falling back to A#', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#scaleSelect', '0');
  expect(await page.evaluate(() => window.audioEngine.rootOffset)).toBe(0);
  expect(await page.evaluate(() => window.pitchDetector.getRootOffset())).toBe(0);
});

test('raga learning completes Sa → Aroha → Avaroha → Pakad with synthetic pitch', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await page.goto('/');
  await page.click('.tab-btn[data-tab="tab-ragas"]');
  await expect(page.locator('.raga-card')).toHaveCount(10);
  await page.locator('.raga-card').filter({ hasText: 'ভূপালী' }).locator('.raga-learn-btn').click();
  await expect(page.locator('#ragaLearningBox')).toBeVisible();
  await expect(page.locator('#ragaLessonTarget')).toContainText('সা');
  await page.click('#startRagaLessonBtn');
  await expect(page.locator('#stopRagaLessonBtn')).toBeVisible();

  const result = await page.evaluate(async () => {
    const session = window.ragaLessonSession;
    session.holdMs = 0; // deterministic browser integration; unit tests cover 300ms timing
    const labels = ['সা', 'রে♭', 'রে', 'গা♭', 'গা', 'মা', 'মা♯', 'পা', 'ধা♭', 'ধা', 'নি♭', 'নি'];
    let guard = 0;
    while (session.finishedAt == null && guard++ < 100) {
      const { stage, target } = session.current();
      window.pitchDetector.onPitchUpdate({
        freq: window.Swara.midiToFreq(target.midi),
        noteNum: target.midi,
        cents: 0,
        noteName: window.pitchDetector.getNoteFromMidi(target.midi),
        noteIndex: ((target.midi % 12) + 12) % 12,
        sargamText: target.label,
        sargamShortName: target.interval === 12 ? 'সাঁ' : labels[((target.interval % 12) + 12) % 12],
        sargamIndex: ((target.interval % 12) + 12) % 12,
        saptak: window.Swara.saptakLabel(window.Swara.saptakOf(target.midi, session.baseMidi - 48)),
        isInTune: true,
        isApaswara: false,
        apaswaraMsg: null,
        tuningSystem: window.pitchDetector.tuningSystem,
        accuracyPercent: 100
      });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return { finished: session.finishedAt != null, progress: session.progress(), message: document.querySelector('#ragaLessonMessage').textContent };
  });
  expect(result.finished).toBe(true);
  expect(result.progress).toBe(100);
  expect(result.message).toContain('সম্পন্ন');
});

test('recording stays local when cloud backup is off; manual backup is explicit', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  let uploads = 0;
  await page.route('**/api/recordings', async route => {
    if (route.request().method() === 'POST') {
      uploads++;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ message: 'ok', recording: { filename: 'test.webm' } }) });
    } else {
      await route.continue();
    }
  });
  await page.goto('/');
  await expect(page.locator('#cloudBackupToggle')).not.toBeChecked();
  await page.click('#recordBtn');
  await page.waitForTimeout(600);
  await page.click('#recordBtn');
  await expect(page.locator('.recording-item')).toHaveCount(1, { timeout: 10000 });
  expect(uploads).toBe(0);
  await page.click('.tab-btn[data-tab="tab-recordings"]');
  await page.click('.btn-backup');
  await expect(page.locator('#backupStatus')).toContainText('সম্পন্ন', { timeout: 10000 });
  expect(uploads).toBe(1);
});

test('stale bearer token can be cleared back to local mode', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gan-si-token', 'invalid-token'));
  await page.goto('/');
  await page.click('.tab-btn[data-tab="tab-progress"]');
  await expect(page.locator('#accountStatus')).toContainText('টোকেন আছে', { timeout: 10000 });
  page.once('dialog', dialog => dialog.accept());
  await page.click('#accountResetBtn');
  await expect(page.locator('#accountStatus')).toContainText('স্থানীয় মোড', { timeout: 10000 });
  expect(await page.evaluate(() => localStorage.getItem('gan-si-token'))).toBeNull();
});

test('raga and theory data load from bundled fallback when API is offline', async ({ page }) => {
  await page.route('**/api/ragas**', route => route.abort());
  await page.route('**/api/theory**', route => route.abort());
  await page.goto('/');
  await page.click('.tab-btn[data-tab="tab-ragas"]');
  await expect(page.locator('.raga-card')).toHaveCount(10);
  await page.click('.tab-btn[data-tab="tab-theory"]');
  await expect(page.locator('#theoryList > div')).toHaveCount(10);
});

test('pitch trail: two panels, stepped targets, freeze, toolbar and local PNG export', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__pitchTrail);
  const result = await page.evaluate(() => {
    const tr = window.__pitchTrail;
    tr.clear();
    tr.setBaseMidi(48);
    tr.setWindow(15000);
    tr.setTarget(48, 12);
    for (let i = 0; i < 12; i++) tr.push({ midi: 48 + Math.sin(i / 3) * 0.02, inTune: true, cents: 3 });
    tr.setTarget(55, 12);
    for (let i = 0; i < 12; i++) tr.push({ midi: 55 + Math.sin(i / 3) * 0.02, inTune: false, cents: 30 });
    const st = tr.stats();
    const pngLen = tr.exportPNG();
    const targets = tr.targetHistory().map(e => e.midi);
    tr.stop();
    const canvas = document.querySelector('#pitchCanvas');
    return {
      count: st.count,
      accuracy: st.accuracy,
      pngLen,
      targets,
      liveAfterStop: tr.isLive(),
      summary: document.querySelector('#trailSummary').textContent,
      canvasHeight: canvas.height / (devicePixelRatio || 1),
      ribbonToken: getComputedStyle(document.documentElement).getPropertyValue('--chart-ribbon').trim()
    };
  });
  expect(result.count).toBeGreaterThan(20);
  expect(result.accuracy).toBeGreaterThan(0);
  expect(result.pngLen).toBeGreaterThan(1000);          // local PNG, no upload
  expect(result.targets).toContain(55);                // stepped target history
  expect(result.liveAfterStop).toBe(false);            // freeze semantics preserved
  expect(result.summary).toContain('নমুনা');            // screen-reader summary refreshed on stop
  expect(result.canvasHeight).toBe(460); // desktop graph uses the full-width layout
  expect(result.ribbonToken).not.toBe('');             // cents ribbon is themed
  // New pitch auto-resumes (guided / raga paths).
  expect(await page.evaluate(() => {
    window.__pitchTrail.push({ midi: 50, inTune: true, cents: 0 });
    return window.__pitchTrail.isLive();
  })).toBe(true);
  // Toolbar controls stay wired.
  await page.click('#trailHoldsBtn');
  await expect(page.locator('#trailHoldsBtn')).toHaveAttribute('aria-pressed', 'false');
  await page.click('#trailHoldsBtn');
  await page.click('#trailClearBtn');
  await expect(page.locator('#trailStatus')).toContainText('মোছা');
  await expect(page.locator('#trailSummary')).toContainText('খালি');
});

test('pitch trail repaints when the theme switches', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__pitchTrail);
  const pixel = () => page.evaluate(() => {
    const c = document.querySelector('#pitchCanvas');
    const dpr = window.devicePixelRatio || 1;
    const d = c.getContext('2d').getImageData(Math.floor(200 * dpr), Math.floor(100 * dpr), 1, 1).data;
    return [d[0], d[1], d[2]];
  });
  const light = await pixel();
  await page.selectOption('#themeSelect', 'dark');
  await page.waitForTimeout(250);
  const dark = await pixel();
  expect(dark).not.toEqual(light);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--chart-ribbon').trim())).toBe('#14181b');
});

test('pitch trail two-panel layout fits a 390px mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => !!window.__pitchTrail);
  const info = await page.evaluate(() => {
    const r = document.querySelector('#pitchCanvas').getBoundingClientRect();
    return {
      height: r.height,
      right: r.right,
      docWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      buttons: document.querySelectorAll('.pitch-trail-toolbar button').length
    };
  });
  expect(info.height).toBe(360);
  expect(info.docWidth).toBeLessThanOrEqual(info.viewport);
  expect(info.right).toBeLessThanOrEqual(info.viewport);
  expect(info.buttons).toBeGreaterThanOrEqual(7);
});

const denyMic = () => {
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    value: async () => {
      const err = new Error('Permission denied');
      err.name = 'NotAllowedError';
      throw err;
    }
  });
};

test('microphone permission failure is explained inline, not by a blocking alert', async ({ page }) => {
  let dialogs = 0;
  page.on('dialog', async (dialog) => { dialogs++; await dialog.dismiss(); });
  await page.addInitScript(denyMic);
  await page.goto('/');
  await page.click('#startMicBtn');
  await expect(page.locator('#micStatus')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#micStatus')).toContainText('অনুমতি');
  expect(await page.evaluate(() => window.pitchDetector.isListening)).toBe(false);
  expect(dialogs).toBe(0);
});

test('record button reports mic failure inline and saves nothing', async ({ page }) => {
  let dialogs = 0;
  page.on('dialog', async (dialog) => { dialogs++; await dialog.dismiss(); });
  await page.addInitScript(denyMic);
  await page.goto('/');
  await page.click('#recordBtn');
  await expect(page.locator('#micStatus')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#backupStatus')).toContainText('রেকর্ডিং');
  expect(await page.evaluate(() => window.audioEngine.isRecording)).toBe(false);
  expect(await page.locator('.recording-item').count()).toBe(0);
  expect(dialogs).toBe(0);
});

test('mic self-check reports a working input with the fake device', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await page.goto('/');
  await page.click('#micCheckBtn');
  await expect(page.locator('#micStatus')).toHaveAttribute('data-state', 'ok', { timeout: 10000 });
  await expect(page.locator('#micStatus')).toContainText('কাজ করছে');
});

test('mic device loss tears down the ghost session instead of keeping score 0', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await page.goto('/');
  await page.click('#startMicBtn');
  await expect(page.locator('#startMicBtn')).toContainText('থামান', { timeout: 15000 });
  const result = await page.evaluate(() => {
    const track = window.pitchDetector.micStream.getAudioTracks()[0];
    track.dispatchEvent(new Event('ended'));
    return { listening: window.pitchDetector.isListening, trackCount: window.pitchDetector.micTracks.length };
  });
  expect(result.listening).toBe(false);
  await expect(page.locator('#startMicBtn')).toContainText('রেওয়াজ শুরু করুন');
  await expect(page.locator('#micStatus')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#micStatus')).toContainText('সংযোগ বিচ্ছিন্ন');
});

test('an outdated cached bundle is flagged with a reload action', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', version: '৯৯৯.০.০' })
  }));
  await page.goto('/');
  await expect(page.locator('#versionNotice')).toBeVisible();
  await expect(page.locator('#versionNotice')).toContainText('পুরোনো');
  await expect(page.locator('#versionNotice button')).toContainText('রিলোড');
});

test('a stale cached bundle on the static host (Vercel) is flagged with a reload action', async ({ page }) => {
  // The deployed app has no /api/health, so the check must compare the
  // bundled SW version with the live /sw.js instead.
  await page.route('**/static-mode.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript', body: 'window.GANSI_STATIC_MODE = true;'
  }));
  await page.route('**/sw.js*', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript',
    body: "const CACHE_VERSION = 'sur-sadhana-v99';"
  }));
  await page.goto('/');
  await expect(page.locator('#versionNotice')).toBeVisible();
  await expect(page.locator('#versionNotice')).toContainText('পুরোনো');
  // numbers.js localises digits across the document, so 99 reads as ৯৯.
  await expect(page.locator('#versionNotice')).toContainText('sur-sadhana-v৯৯');
  await expect(page.locator('#versionNotice button')).toContainText('রিলোড');
});

test('wrong Sa explains a stuck score, correct Sa scores, silence re-centres the needle', async ({ page }) => {
  await page.addInitScript(() => {
    // A synthetic "singer" at C4, so the app's default Sa (A#) reads it as re.
    navigator.mediaDevices.getUserMedia = async () => {
      const ac = new AudioContext();
      const osc = ac.createOscillator(); const g = ac.createGain();
      osc.type = 'sine'; g.gain.value = 0.3; osc.frequency.value = 261.63;
      osc.connect(g);
      const dest = ac.createMediaStreamDestination();
      g.connect(dest); osc.start();
      window.__osc = osc;
      return dest.stream;
    };
  });
  await page.goto('/');
  await page.evaluate(() => {
    const s = document.getElementById('scaleSelect');
    s.value = '10'; s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.click('#tabbtn-alankars');
  await page.click('#startGuidedPracticeBtn');
  await expect(page.locator('#guidedTonicHint')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#practiceScore')).toHaveText(/^০$/);
  // Live verdict + the target line follow the practice target.
  await expect(page.locator('#guidedLiveReadout')).toBeVisible();
  await expect(page.locator('#guidedLiveReadout')).toContainText('লক্ষ্য: সা');
  expect(await page.evaluate(() => {
    const h = window.__pitchTrail.targetHistory();
    return h[h.length - 1].midi;
  })).toBe(58); // A#3, the app's Sa with the selector on A#

  await page.evaluate(() => {
    const s = document.getElementById('scaleSelect');
    s.value = '0'; s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#practiceScore')).not.toHaveText(/^০$/, { timeout: 8000 });
  await expect(page.locator('#currentTargetNote')).toHaveText('রে');
  expect(await page.evaluate(() => {
    const h = window.__pitchTrail.targetHistory();
    return h[h.length - 1].midi;
  })).not.toBe(null);

  await page.evaluate(() => { window.__osc.frequency.value = 40; }); // below detector range = silence
  await expect.poll(async () => page.locator('#pitchNeedle').evaluate((el) => el.style.left)).toBe('50%');
});

test('static host reads streak and minutes from local-first storage', async ({ page }) => {
  await page.route('**/static-mode.js', (route) => route.fulfill({
    status: 200, contentType: 'application/javascript', body: 'window.GANSI_STATIC_MODE = true;'
  }));
  await page.addInitScript(() => {
    const d = new Date();
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('gan-si-local-stats-v1', JSON.stringify({ days: { [k]: 25 } }));
  });
  await page.goto('/');
  await expect(page.locator('#streakCount')).toHaveText('১');
  await expect(page.locator('#totalMinsDisplay')).toContainText('২৫');
});

test('the live head sits on the centre focus line, not at the edge', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.__pitchTrail.clear();
    window.__pitchTrail.push({ midi: 60, cents: 0, inTune: true });
  });
  await page.waitForTimeout(350);
  const focusPixels = await page.evaluate(() => {
    const c = document.getElementById('pitchCanvas');
    const g = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const gridLeft = 98 * dpr, gridRight = 14 * dpr;
    const plotW = c.width - gridLeft - gridRight;
    const focus = Math.round(gridLeft + plotW * 0.6);
    const d = g.getImageData(focus - 3, 0, 7, Math.round(c.height * 0.6)).data;
    let accent = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      if (gg > 80 && r < 130 && b < 130) accent++;
    }
    return { focus, accent };
  });
  expect(focusPixels.accent).toBeGreaterThan(0);
});

test('the swara ladder scrolls with the voice without changing row spacing', async ({ page }) => {
  await page.goto('/');
  const gutterHash = () => page.evaluate(() => {
    const c = document.getElementById('pitchCanvas');
    const g = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const d = g.getImageData(0, 0, Math.round(98 * dpr), c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0;
    return h;
  });
  await page.evaluate(() => {
    window.__pitchTrail.clear();
    window.__pitchTrail.push({ midi: 60, cents: 0, inTune: true });
  });
  await page.waitForTimeout(300);
  const before = await gutterHash();
  const spanBefore = await page.evaluate(() => window.__pitchTrail.span());
  // A note far above the ladder scrolls the names up/down...
  await page.evaluate(() => window.__pitchTrail.push({ midi: 95, cents: 0, inTune: true }));
  await page.waitForTimeout(400);
  expect(await gutterHash()).not.toBe(before);
  // ...but the row size / number of visible rows never auto-fits.
  expect(await page.evaluate(() => window.__pitchTrail.span())).toBe(spanBefore);
});

test('western notation shows C4 (Latin) while the frequency stays Bengali', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const n = document.getElementById('notationSelect');
    n.value = 'western';
    n.dispatchEvent(new Event('change', { bubbles: true }));
    window.pitchDetector.onPitchUpdate({
      freq: 261.6, noteNum: 60, cents: 3, noteName: 'C4', noteIndex: 0,
      sargamText: 'সা (Sa)', sargamShortName: 'সা', sargamIndex: 0,
      saptak: 'মধ্য সপ্তক', isInTune: true, isApaswara: false,
      tuningSystem: 'just_intonation', accuracyPercent: 80
    });
  });
  await expect(page.locator('#sargamDisplay')).toHaveText('C4');
  await expect(page.locator('#westernDisplay')).toContainText('C4');
  await expect(page.locator('#westernDisplay')).toContainText('২৬১.৬');
});

test('note names keep Latin octaves while ordinary numbers localise', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    document.getElementById('sargamDisplay').textContent = 'C4';
    const probe = document.createElement('span');
    probe.id = 'digitProbe';
    probe.textContent = 'C4';
    document.body.appendChild(probe);
  });
  // Protected element (this is a musical note) stays C4...
  await expect(page.locator('#sargamDisplay')).toHaveText('C4');
  // ...while an ordinary node still gets Bengali digits.
  await expect(page.locator('#digitProbe')).toHaveText('C৪');
  await page.evaluate(() => document.getElementById('digitProbe').remove());
});
