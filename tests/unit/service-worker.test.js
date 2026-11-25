const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadServiceWorker({ cachedResponse, fetchImpl } = {}) {
  const handlers = {};
  const puts = [];
  const cache = {
    addAll: async () => {},
    match: async () => cachedResponse,
    put: async (request, response) => { puts.push({ request, response }); }
  };
  const sandbox = {
    URL,
    Request,
    Response,
    console,
    fetch: fetchImpl || (async () => new Response('{"ok":true}', { status: 200 })),
    caches: {
      open: async () => cache,
      match: async () => cachedResponse,
      keys: async () => [],
      delete: async () => true
    },
    self: {
      location: { origin: 'https://gansi.test' },
      addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} }
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/sw.js'), 'utf8'), sandbox);
  return { handlers, puts };
}

describe('service worker privacy + offline policy', () => {
  test('private stats and recording APIs bypass Cache Storage', () => {
    const { handlers } = loadServiceWorker();
    for (const url of ['https://gansi.test/api/stats', 'https://gansi.test/api/recordings', 'https://gansi.test/api/users/me']) {
      let responded = false;
      handlers.fetch({
        request: new Request(url),
        respondWith: () => { responded = true; }
      });
      expect(responded).toBe(false);
    }
  });

  test('public theory data uses stale-while-revalidate and is cached', async () => {
    const { handlers, puts } = loadServiceWorker();
    let responsePromise;
    handlers.fetch({
      request: new Request('https://gansi.test/api/theory'),
      respondWith: promise => { responsePromise = promise; }
    });
    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(puts).toHaveLength(1);
    expect(puts[0].request.url).toBe('https://gansi.test/api/theory');
  });

  test('app shell prefers fresh network content over stale cache', async () => {
    const stale = new Response('old-bundle', { status: 200 });
    const { handlers, puts } = loadServiceWorker({
      cachedResponse: stale,
      fetchImpl: async () => new Response('fresh-bundle', { status: 200 })
    });
    const request = new Request('https://gansi.test/app.js');
    Object.defineProperty(request, 'destination', { value: 'script' });
    let responsePromise;
    handlers.fetch({
      request,
      respondWith: promise => { responsePromise = promise; }
    });
    expect(await (await responsePromise).text()).toBe('fresh-bundle');
    expect(puts).toHaveLength(1);
  });

  test('app shell falls back to cache when offline', async () => {
    const cached = new Response('offline-bundle', { status: 200 });
    const { handlers } = loadServiceWorker({
      cachedResponse: cached,
      fetchImpl: async () => { throw new Error('offline'); }
    });
    const request = new Request('https://gansi.test/app.js');
    Object.defineProperty(request, 'destination', { value: 'script' });
    let responsePromise;
    handlers.fetch({
      request,
      respondWith: promise => { responsePromise = promise; }
    });
    expect(await (await responsePromise).text()).toBe('offline-bundle');
  });
});
