/**
 * Auth + recording ownership integration tests against Express and a temporary
 * SQLite database/upload directory. No network access outside localhost.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const WAV_BYTES = Buffer.from('RIFF-test-audio-data');
let tmpDir;
let uploadDir;
let server;
let baseUrl;
let dbModule;
let originalEnv;

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function createUser(username) {
  const response = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  expect(response.status).toBe(201);
  return response.json();
}

async function uploadRecording(token, clientFilename = 'clip.wav') {
  const form = new FormData();
  form.append('audio', new Blob([WAV_BYTES], { type: 'audio/wav' }), clientFilename);
  const response = await fetch(`${baseUrl}/api/recordings`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form
  });
  expect(response.status).toBe(201);
  return (await response.json()).recording;
}

async function listRecordings(token) {
  const response = await fetch(`${baseUrl}/api/recordings`, { headers: authHeaders(token) });
  expect(response.status).toBe(200);
  return response.json();
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gansi-auth-recordings-'));
  uploadDir = path.join(tmpDir, 'uploads');
  originalEnv = { DB_PATH: process.env.DB_PATH, UPLOAD_DIR: process.env.UPLOAD_DIR };
  process.env.DB_PATH = path.join(tmpDir, 'test.sqlite');
  process.env.UPLOAD_DIR = uploadDir;

  jest.resetModules();
  const { createApp } = require('../../src/server/app');
  dbModule = require('../../src/server/db');
  const app = createApp();
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  if (dbModule) dbModule.closeDb();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  for (const [key, value] of Object.entries(originalEnv || {})) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  jest.resetModules();
});

describe('bearer authentication', () => {
  test('unknown or malformed supplied credentials return INVALID_TOKEN', async () => {
    for (const authorization of ['Bearer not-a-real-token', 'Bearer', 'Basic not-a-bearer-token']) {
      const response = await fetch(`${baseUrl}/api/users/me`, { headers: { Authorization: authorization } });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: 'Invalid or unknown bearer token',
        code: 'INVALID_TOKEN'
      });
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
    }
  });

  test('unauthenticated local mode remains user 1', async () => {
    const response = await fetch(`${baseUrl}/api/users/me`);
    expect(response.status).toBe(200);
    expect((await response.json()).user).toMatchObject({ id: 1, username: 'local' });
  });
});

describe('recording ownership', () => {
  test('POST binds to req.user.id and lists are isolated between users', async () => {
    const alice = await createUser('recording-owner-alice');
    const bob = await createUser('recording-owner-bob');
    const aliceRecording = await uploadRecording(alice.token, 'alice.wav');
    const bobRecording = await uploadRecording(bob.token, 'bob.wav');

    const aliceRow = dbModule.getDb().prepare('SELECT user_id FROM recordings WHERE filename=?').get(aliceRecording.filename);
    const bobRow = dbModule.getDb().prepare('SELECT user_id FROM recordings WHERE filename=?').get(bobRecording.filename);
    expect(Number(aliceRow.user_id)).toBe(alice.user.id);
    expect(Number(bobRow.user_id)).toBe(bob.user.id);

    const aliceList = await listRecordings(alice.token);
    const bobList = await listRecordings(bob.token);
    expect(aliceList.recordings.map(recording => recording.filename)).toEqual([aliceRecording.filename]);
    expect(bobList.recordings.map(recording => recording.filename)).toEqual([bobRecording.filename]);
    expect(aliceList.count).toBe(1);
    expect(bobList.count).toBe(1);
  });

  test('cross-user stream and delete are denied without removing the file', async () => {
    const owner = await createUser('recording-stream-owner');
    const other = await createUser('recording-stream-other');
    const recording = await uploadRecording(owner.token, 'private.wav');
    const streamUrl = `${baseUrl}/api/recordings/${encodeURIComponent(recording.filename)}/stream`;

    const deniedStream = await fetch(streamUrl, { headers: authHeaders(other.token) });
    expect(deniedStream.status).toBe(403);
    expect(await deniedStream.json()).toMatchObject({ code: 'FORBIDDEN' });

    const deniedDelete = await fetch(`${baseUrl}/api/recordings/${encodeURIComponent(recording.filename)}`, {
      method: 'DELETE',
      headers: authHeaders(other.token)
    });
    expect(deniedDelete.status).toBe(403);
    expect(await deniedDelete.json()).toMatchObject({ code: 'FORBIDDEN' });
    expect(fs.existsSync(path.join(uploadDir, recording.filename))).toBe(true);
    expect(dbModule.getDb().prepare('SELECT user_id FROM recordings WHERE filename=?').get(recording.filename)).toBeTruthy();

    const ownerStream = await fetch(streamUrl, { headers: authHeaders(owner.token) });
    expect(ownerStream.status).toBe(200);
    expect(Buffer.from(await ownerStream.arrayBuffer())).toEqual(WAV_BYTES);

    const ownerDelete = await fetch(`${baseUrl}/api/recordings/${encodeURIComponent(recording.filename)}`, {
      method: 'DELETE',
      headers: authHeaders(owner.token)
    });
    expect(ownerDelete.status).toBe(200);
    expect(fs.existsSync(path.join(uploadDir, recording.filename))).toBe(false);
    expect(dbModule.getDb().prepare('SELECT user_id FROM recordings WHERE filename=?').get(recording.filename)).toBeUndefined();
  });

  test('files without an ownership row cannot be streamed or deleted', async () => {
    const user = await createUser('unregistered-file-owner');
    const filename = 'unregistered.wav';
    const target = path.join(uploadDir, filename);
    fs.writeFileSync(target, WAV_BYTES);
    try {
      const stream = await fetch(`${baseUrl}/api/recordings/${filename}/stream`, { headers: authHeaders(user.token) });
      expect(stream.status).toBe(404);
      expect(await stream.json()).toMatchObject({ code: 'NOT_FOUND' });

      const removed = await fetch(`${baseUrl}/api/recordings/${filename}`, {
        method: 'DELETE',
        headers: authHeaders(user.token)
      });
      expect(removed.status).toBe(404);
      expect(await removed.json()).toMatchObject({ code: 'NOT_FOUND' });
      expect(fs.existsSync(target)).toBe(true);
    } finally {
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
  });

  test('local user 1 can upload, list, stream, and delete without a token', async () => {
    const recording = await uploadRecording(null, 'local.wav');
    const row = dbModule.getDb().prepare('SELECT user_id FROM recordings WHERE filename=?').get(recording.filename);
    expect(Number(row.user_id)).toBe(1);

    const localList = await listRecordings(null);
    expect(localList.recordings.map(item => item.filename)).toEqual([recording.filename]);

    const stream = await fetch(`${baseUrl}${recording.url}`);
    expect(stream.status).toBe(200);
    expect(Buffer.from(await stream.arrayBuffer())).toEqual(WAV_BYTES);

    const removed = await fetch(`${baseUrl}/api/recordings/${encodeURIComponent(recording.filename)}`, { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect((await listRecordings(null)).count).toBe(0);
  });
});

describe('token storage and revocation', () => {
  test('tokens are stored only as hashes, never raw', async () => {
    const created = await createUser('hashed-token-user');
    const db = dbModule.getDb();

    const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='api_tokens'").get();
    expect(schema.sql).toMatch(/token_hash/);
    expect(schema.sql).not.toMatch(/token\s+TEXT\s+PRIMARY\s+KEY/);

    const rawHit = db.prepare('SELECT COUNT(*) AS c FROM api_tokens WHERE token_hash=?').get(created.token);
    expect(rawHit.c).toBe(0); // the raw token is not a stored hash

    const { hashToken } = dbModule;
    const hashHit = db.prepare('SELECT COUNT(*) AS c FROM api_tokens WHERE token_hash=?').get(hashToken(created.token));
    expect(hashHit.c).toBe(1);
  });

  test('logout revokes the token server-side', async () => {
    const created = await createUser('logout-revoker');
    const other = await createUser('logout-survivor');

    const me = await fetch(`${baseUrl}/api/users/me`, { headers: authHeaders(created.token) });
    expect(me.status).toBe(200);

    const logout = await fetch(`${baseUrl}/api/users/logout`, {
      method: 'POST',
      headers: authHeaders(created.token)
    });
    expect(logout.status).toBe(200);
    expect(await logout.json()).toMatchObject({ revoked: true });

    const revokedUse = await fetch(`${baseUrl}/api/users/me`, { headers: authHeaders(created.token) });
    expect(revokedUse.status).toBe(401);

    const otherStillValid = await fetch(`${baseUrl}/api/users/me`, { headers: authHeaders(other.token) });
    expect(otherStillValid.status).toBe(200);
  });

  test('logout without a token is rejected', async () => {
    const response = await fetch(`${baseUrl}/api/users/logout`, { method: 'POST' });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  test('a revoked token cannot log out twice', async () => {
    const created = await createUser('double-logout-user');
    await fetch(`${baseUrl}/api/users/logout`, { method: 'POST', headers: authHeaders(created.token) });
    const again = await fetch(`${baseUrl}/api/users/logout`, { method: 'POST', headers: authHeaders(created.token) });
    expect(again.status).toBe(401);
  });
});

describe('username claiming', () => {
  test('existing username does not issue a token to an unauthenticated caller', async () => {
    const created = await createUser('already-claimed-user');
    const tokenCount = () => dbModule.getDb().prepare('SELECT COUNT(*) AS count FROM api_tokens WHERE user_id=?').get(created.user.id).count;

    const before = tokenCount();
    const response = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: created.user.username })
    });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'USERNAME_TAKEN' });
    expect(body.error).toMatch(/token originally issued/i);
    expect(body).not.toHaveProperty('token');
    expect(tokenCount()).toBe(before);
  });

  test('same authenticated local session is idempotent and reuses its token', async () => {
    const created = await createUser('idempotent-local-user');
    const tokenCount = () => dbModule.getDb().prepare('SELECT COUNT(*) AS count FROM api_tokens WHERE user_id=?').get(created.user.id).count;

    const response = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(created.token) },
      body: JSON.stringify({ username: created.user.username })
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { id: created.user.id }, token: created.token });
    expect(tokenCount()).toBe(1);
  });

  test('another authenticated user cannot claim an existing username', async () => {
    const owner = await createUser('protected-username-owner');
    const other = await createUser('protected-username-other');

    const response = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(other.token) },
      body: JSON.stringify({ username: owner.user.username })
    });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'USERNAME_TAKEN' });
    expect(body).not.toHaveProperty('token');
  });
});
