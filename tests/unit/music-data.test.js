const fs = require('fs');
const path = require('path');
const MusicData = require('../../public/js/ui/music-data');

describe('music data offline fallback', () => {
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  test('uses API collection when available', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ragas: [{ id: 'api-raga' }] }) });
    await expect(MusicData.loadCollection('/api/ragas', '/data/ragas.json', 'ragas')).resolves.toEqual([{ id: 'api-raga' }]);
  });

  test('falls back to bundled collection when API fails', async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'bundled-raga' }] });
    await expect(MusicData.loadCollection('/api/ragas', '/data/ragas.json', 'ragas')).resolves.toEqual([{ id: 'bundled-raga' }]);
  });

  test('falls back to bundled theory document on non-2xx response', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ chapters: [{ title: 'offline' }] }) });
    await expect(MusicData.loadDocument('/api/theory', '/data/theory.json')).resolves.toEqual({ chapters: [{ title: 'offline' }] });
  });

  test('bundled PWA/Android data matches canonical server data', () => {
    for (const name of ['ragas.json', 'alankars.json', 'theory.json']) {
      const canonical = fs.readFileSync(path.join(__dirname, '../../data', name), 'utf8');
      const bundled = fs.readFileSync(path.join(__dirname, '../../public/data', name), 'utf8');
      expect(JSON.parse(bundled)).toEqual(JSON.parse(canonical));
    }
  });
});
