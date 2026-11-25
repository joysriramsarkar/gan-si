/**
 * Music data loader with bundled offline fallback.
 * API is preferred when available; native Capacitor/offline and static-only
 * web deployments (GANSI_STATIC_MODE) read public/data directly, so no
 * /api/* request is made and no 404 is logged on a host without a backend.
 */
(function (root) {
  const isStatic = () => !!(root && root.GANSI_STATIC_MODE);

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function asList(data, key) {
    return Array.isArray(data) ? data : (data && data[key]) || [];
  }

  async function loadCollection(apiUrl, fallbackUrl, key) {
    if (!isStatic()) {
      try {
        return asList(await fetchJson(apiUrl), key);
      } catch { /* fall through to bundled data */ }
    }
    return asList(await fetchJson(fallbackUrl), key);
  }

  async function loadDocument(apiUrl, fallbackUrl) {
    if (!isStatic()) {
      try {
        return await fetchJson(apiUrl);
      } catch { /* fall through to bundled data */ }
    }
    return fetchJson(fallbackUrl);
  }

  const api = { loadCollection, loadDocument };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GanSiMusicData = api;
})(typeof window !== 'undefined' ? window : globalThis);
