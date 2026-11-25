const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cfg = require('../vercel.json');
const pkg = require('../package.json');

describe('Vercel pure-static deployment', () => {
  test('there are no serverless functions that could throw FUNCTION_INVOCATION_FAILED', () => {
    expect(cfg.framework).toBeNull();
    expect(cfg.outputDirectory).toBe('public');
    expect(cfg.rewrites).toBeUndefined();
    expect(cfg.functions).toBeUndefined();
    expect(cfg.builds).toBeUndefined();
    // No api/ directory: Vercel cannot wrap server.js as a function.
    expect(fs.existsSync(path.join(root, 'api'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'public', 'index.html'))).toBe(true);
  });

  test('bundled music data exists so /api/* 404s fall back cleanly', () => {
    const files = ['ragas.json', 'alankars.json', 'theory.json'];
    for (const f of files) {
      const p = path.join(root, 'public', 'data', f);
      expect(fs.existsSync(p)).toBe(true);
      expect(() => JSON.parse(fs.readFileSync(p, 'utf8'))).not.toThrow();
    }
    const ragas = JSON.parse(fs.readFileSync(path.join(root, 'public', 'data', 'ragas.json'), 'utf8'));
    expect((Array.isArray(ragas) ? ragas : ragas.ragas).length).toBe(10);
    const loader = fs.readFileSync(path.join(root, 'public', 'js', 'ui', 'music-data.js'), 'utf8');
    expect(loader).toMatch(/fallbackUrl/);
    expect(loader).toMatch(/catch/);
  });

  test('the bundled version meta matches package version (no false stale banner)', () => {
    const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
    const m = html.match(/name="gansi-version"\s+content="([^"]+)"/);
    expect(m).not.toBeNull();
    expect(m[1]).toBe(pkg.version);
  });

  test('service worker is versioned and still never caches private APIs', () => {
    const sw = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
    expect(sw).toMatch(/const CACHE_VERSION = 'sur-sadhana-v\d+'/);
    expect(sw).toMatch(/PRIVATE_API_URLS/);
    expect(sw).toMatch(/'\/static-mode\.js'/);
  });

  test('static-mode flag is false locally and flipped to true only on Vercel', () => {
    const marker = fs.readFileSync(path.join(root, 'public', 'static-mode.js'), 'utf8');
    expect(marker).toMatch(/GANSI_STATIC_MODE = false/);
    expect(cfg.buildCommand).toMatch(/mark:static/);
    expect(fs.existsSync(path.join(root, 'scripts', 'mark-static.cjs'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'scripts', 'mark-local.cjs'))).toBe(true);
    expect(pkg.scripts['sync:data']).toMatch(/mark-local/);

    const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
    expect(html).toMatch(/<script src="static-mode\.js"><\/script>/);

    const loader = fs.readFileSync(path.join(root, 'public', 'js', 'ui', 'music-data.js'), 'utf8');
    expect(loader).toMatch(/GANSI_STATIC_MODE/);
    expect(loader).toMatch(/fallbackUrl/);
  });
});
