/**
 * Music data loader with bundled offline fallback.
 * API is preferred when available; native Capacitor/offline uses public/data.
 */
(function (root) {
  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function loadCollection(apiUrl, fallbackUrl, key) {
    try {
      const data = await fetchJson(apiUrl);
      return Array.isArray(data) ? data : (data[key] || []);
    } catch {
      const data = await fetchJson(fallbackUrl);
      return Array.isArray(data) ? data : (data[key] || []);
    }
  }

  async function loadDocument(apiUrl, fallbackUrl) {
    try {
      return await fetchJson(apiUrl);
    } catch {
      return fetchJson(fallbackUrl);
    }
  }

  const api = { loadCollection, loadDocument };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GanSiMusicData = api;
})(typeof window !== 'undefined' ? window : globalThis);
