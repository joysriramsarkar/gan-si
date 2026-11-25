const { test, expect } = require('@playwright/test');

test('app loads with all 10 tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/গান-সি|সুর সাধনা/);
  const tabs = page.locator('.tab-btn');
  await expect(tabs).toHaveCount(10);
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
      if (!p || p.closest('script,style,svg,textarea,input,select')) continue;
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
  expect(result.canvasHeight).toBe(400);
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
