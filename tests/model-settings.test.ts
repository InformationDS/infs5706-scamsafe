import assert from 'node:assert/strict';
import { createServer, request, type Server } from 'node:http';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve, isAbsolute } from 'node:path';
import { test } from 'node:test';
import { ModelSettingsStore } from '../server/src/model-settings.js';
import { readConfig } from '../server/src/config.js';
import { createApp } from '../server/src/app.js';
import { makeFixture } from '../shared/index.js';

const seed = () => readConfig({ MODEL_API_KEY: 'ENV_SECRET', MODEL_NAME: 'env-model', MODEL_BASE_URL: 'https://provider.example/v1' });
async function listen(server: Server) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server) { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
async function withStore(store: ModelSettingsStore, run: (base: string) => Promise<void>) {
  const server = createServer(createApp({ settingsStore: store }));
  const base = await listen(server);
  try { await run(base); } finally { await close(server); }
}
const put = (base: string, body: unknown, headers = {}) => fetch(`${base}/api/settings/model`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('settings DTO never returns keys; blank preserves and explicit clear removes credentials', () => {
  const store = new ModelSettingsStore({ config: seed() });
  const copy = store.getConfig(); copy.apiKey = 'MUTATED';
  assert.equal(store.getConfig().apiKey, 'ENV_SECRET');
  assert.doesNotMatch(JSON.stringify(store.publicSettings()), /ENV_SECRET|apiKey|port/);
  store.save({ apiKey: '   ', model: 'updated' });
  assert.equal(store.getConfig().apiKey, 'ENV_SECRET');
  assert.throws(() => store.save({ clearApiKey: true, apiKey: 'NEW_SECRET' }), /replacement/);
  assert.equal(store.getConfig().apiKey, 'ENV_SECRET');
  assert.equal(store.save({ clearApiKey: true }).hasApiKey, false);
  assert.equal(store.getConfig().apiKey, '');
});

test('settings validation rejects incomplete live mode, unsafe URLs, unknown fields and invalid headers', () => {
  const store = new ModelSettingsStore({ config: readConfig({}) });
  for (const input of [
    { mode: 'live' }, { baseUrl: 'http://provider.example/v1' }, { baseUrl: 'https://secret:password@provider.example' },
    { baseUrl: 'https://provider.example?api_key=SECRET' }, { baseUrl: 'bad SECRET' },
    { port: 1234 }, { timeoutMs: 99 }, { authHeader: 'Cookie' }, { authScheme: 'Bear\ner' }, { apiKey: 'key\r\nextra' },
  ]) {
    assert.throws(() => store.save(input), error => {
      assert.doesNotMatch(String(error), /password|api_key|SECRET|extra/);
      return (error as { status?: number }).status === 400;
    });
  }
  assert.equal(store.getConfig().mode, 'mock');
  assert.equal(store.save({ baseUrl: 'http://127.0.0.1:9876/v1' }).mode, 'mock');
});

test('local atomic persistence restores after restart and explicit cleared key overrides env fallback', () => {
  mkdirSync(join(process.cwd(), 'local'), { recursive: true });
  const directory = mkdtempSync(join(process.cwd(), 'local', '.settings-test-'));
  try {
    const filePath = join(directory, 'local', 'model-settings.json');
    const store = new ModelSettingsStore({ config: seed(), filePath });
    store.save({ model: 'persisted', apiKey: 'FILE_SECRET', mode: 'live' });
    assert.equal(new ModelSettingsStore({ config: readConfig({}), filePath }).getConfig().apiKey, 'FILE_SECRET');
    assert.equal(JSON.parse(readFileSync(filePath, 'utf8')).port, undefined);
    if (process.platform !== 'win32') assert.equal(statSync(filePath).mode & 0o777, 0o600);
    store.save({ mode: 'mock', clearApiKey: true });
    const restarted = new ModelSettingsStore({ config: seed(), filePath });
    assert.equal(restarted.getConfig().model, 'persisted');
    assert.equal(restarted.getConfig().apiKey, '');
  } finally {
    const target = resolve(directory);
    const within = relative(resolve(process.cwd(), 'local'), target);
    if (!within || within.startsWith('..') || isAbsolute(within)) throw new Error('Test cleanup path is outside local workspace');
    rmSync(target, { recursive: true, force: true });
  }
});

test('failed persistence returns safe 503 and retains last settings in memory', async () => {
  const store = new ModelSettingsStore({ config: seed(), persist: () => { throw new Error('FILE_SECRET /private/path'); } });
  await withStore(store, async base => {
    const response = await put(base, { apiKey: 'NEW_SECRET', model: 'changed' });
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.doesNotMatch(body, /FILE_SECRET|NEW_SECRET|private/);
    assert.equal(store.getConfig().model, 'env-model');
    assert.equal(store.getConfig().apiKey, 'ENV_SECRET');
  });
});

test('settings routes enforce host/origin, strict input and never echo secrets', async () => {
  const store = new ModelSettingsStore({ config: readConfig({}) });
  await withStore(store, async base => {
    assert.equal((await put(base, { apiKey: 'KEY_SECRET' }, { Origin: 'https://foreign.example' })).status, 403);
    const hostStatus = await new Promise<number | undefined>((resolve, reject) => {
      const operation = request(`${base}/api/settings/model`, { headers: { Host: 'foreign.example' } }, response => {
        response.resume(); response.on('end', () => resolve(response.statusCode));
      });
      operation.on('error', reject); operation.end();
    });
    assert.equal(hostStatus, 403);
    assert.equal((await put(base, { apiKey: 'KEY_SECRET', port: 1 })).status, 400);
    const result = await put(base, { apiKey: 'KEY_SECRET', model: 'new-model' });
    assert.equal(result.status, 200);
    assert.doesNotMatch(await result.text(), /KEY_SECRET|apiKey/);
    const loaded = await (await fetch(`${base}/api/settings/model`)).json();
    assert.equal(loaded.model, 'new-model'); assert.equal(loaded.hasApiKey, true);
    assert.equal((await put(base, { clearApiKey: true })).status, 200);
    assert.equal((await put(base, { mode: 'live' })).status, 400);
  });
});

test('saved settings immediately route real adapter to local fake provider without external calls', async () => {
  let calls = 0;
  const received: { auth: string; model: string; path: string }[] = [];
  const provider = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    calls += 1;
    received.push({ auth: req.headers.authorization ?? '', model: JSON.parse(body).model, path: req.url ?? '' });
    const record = makeFixture('intake');
    const analysis = { ...record.analysis, source: 'model', basedOnCaseVersion: record.version,
      facts: record.facts.filter(f => /^[B-J]\d{2}$/.test(f.fieldId)).map(f => ({ ...f, reviewStatus: 'unreviewed', history: [], candidates: [] })) };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(analysis) } }] }));
  });
  const providerBase = await listen(provider);
  try {
    await withStore(new ModelSettingsStore({ config: readConfig({}) }), async base => {
      assert.equal((await put(base, { mode: 'live', baseUrl: `${providerBase}/first`, model: 'model-one', apiKey: 'KEY_ONE' })).status, 200);
      assert.equal(calls, 0);
      assert.equal((await (await fetch(`${base}/api/health`)).json()).mode, 'live');
      const analyze = () => fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case: makeFixture('intake') }) });
      assert.equal((await analyze()).status, 200);
      assert.equal((await put(base, { baseUrl: `${providerBase}/second`, model: 'model-two', apiKey: 'KEY_TWO' })).status, 200);
      assert.equal((await analyze()).status, 200);
      assert.deepEqual(received, [
        { auth: 'Bearer KEY_ONE', model: 'model-one', path: '/first/chat/completions' },
        { auth: 'Bearer KEY_TWO', model: 'model-two', path: '/second/chat/completions' },
      ]);
      assert.equal((await put(base, { mode: 'mock' })).status, 200);
      assert.equal((await analyze()).status, 200);
      assert.equal(calls, 2);
    });
  } finally { await close(provider); }
});
