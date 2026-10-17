import assert from 'node:assert/strict';
import { createServer, request, type Server } from 'node:http';
import { test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../server/src/app.js';
import { readConfig, type ServerConfig } from '../server/src/config.js';
import { makeFixture } from '../shared/index.js';

async function listen(server: Server): Promise<string> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP address');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server) { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
async function withApp(run: (base: string) => Promise<void>, config: ServerConfig = readConfig({})) {
  const server = createServer(createApp({ config }));
  const base = await listen(server);
  try { await run(base); } finally { await close(server); }
}
const post = (base: string, route: string, body: unknown, headers = {}) => fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('health exposes configuration status, never credential values', async () => {
  await withApp(async base => {
    const result = await (await fetch(`${base}/api/health`)).json();
    assert.deepEqual(result, { ok: true, mode: 'mock', configured: false, contentApproval: 'pending' });
    assert.equal(JSON.stringify(result).includes('apiKey'), false);
  });
});

test('mock analysis is deterministic and rejects arbitrary modified facts and client configuration', async () => {
  await withApp(async base => {
    const record = makeFixture('intake');
    const first = await post(base, '/api/analyze', { case: record });
    assert.equal(first.status, 200);
    const payload = await first.json();
    assert.equal(payload.meta.providerCalled, false);
    assert.equal(payload.analysis.source, 'mock');
    assert.equal(payload.analysis.basedOnCaseVersion, record.version);
    const second = await (await post(base, '/api/analyze', { case: record })).json();
    assert.deepEqual(second.analysis, payload.analysis);
    record.facts[0].value = 'unrecognized synthetic input';
    assert.equal((await post(base, '/api/analyze', { case: record })).status, 422);
    assert.equal((await post(base, '/api/analyze', { case: makeFixture('intake'), apiKey: 'do-not-use' })).status, 400);
  });
});

test('mock fault responses preserve supplied case and identify timeout/invalid separately', async () => {
  await withApp(async base => {
    const record = makeFixture('intake'), original = structuredClone(record);
    const timeout = await post(base, '/api/analyze', { case: record, fault: 'timeout' });
    assert.equal(timeout.status, 504);
    assert.equal((await timeout.json()).error.code, 'MODEL_TIMEOUT');
    const invalid = await post(base, '/api/analyze', { case: record, fault: 'invalid' });
    assert.equal(invalid.status, 502);
    assert.equal((await invalid.json()).error.code, 'MODEL_INVALID_OUTPUT');
    assert.deepEqual(record, original);
  });
});

test('foreign origins and DNS rebinding hosts cannot call local API', async () => {
  await withApp(async base => {
    const response = await post(base, '/api/analyze', { case: makeFixture('intake') }, { Origin: 'https://foreign.example' });
    assert.equal(response.status, 403);
    const hostStatus = await new Promise<number | undefined>((resolve, reject) => {
      const operation = request(`${base}/api/health`, { headers: { Host: 'foreign.example' } }, response => {
        response.resume(); response.on('end', () => resolve(response.statusCode));
      });
      operation.on('error', reject); operation.end();
    });
    assert.equal(hostStatus, 403);
  });
});

test('Markdown export requires current saved simulated review', async () => {
  await withApp(async base => {
    const record = makeFixture('reviewed');
    const objectId = record.outputs[0].id;
    const response = await post(base, '/api/export', { case: record, objectId, format: 'markdown' });
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.match(text, /MOCK/);
    assert.match(text, /Content not approved/i);
    for (const format of ['markdown', 'pdf']) {
      const failure = await post(base, '/api/export', { case: record, objectId, format, fault: 'failure' });
      assert.equal(failure.status, 503);
      assert.equal((await failure.json()).error.code, 'EXPORT_FAILED');
    }
    assert.equal((await post(base, '/api/export', { case: record, objectId, format: 'markdown' })).status, 200);
    record.saved = false;
    assert.equal((await post(base, '/api/export', { case: record, objectId, format: 'markdown' })).status, 409);
    const stale = makeFixture('stale');
    stale.saved = true;
    assert.equal((await post(base, '/api/export', { case: stale, objectId: stale.outputs[0].id, format: 'markdown' })).status, 409);
    const incomplete = makeFixture('handover');
    delete incomplete.outputs.find(output => output.kind === 'handover')!.recipient;
    assert.equal((await post(base, '/api/export', { case: incomplete, objectId: 'HANDOVER-BANK', format: 'markdown' })).status, 400);
  });
});

test('OpenAI-compatible adapter uses a local fake provider, validates output, and redacts external errors', async () => {
  let receivedAuth = '', receivedPath = '', receivedPrompt = '';
  let responseMode: 'valid' | 'invalid' | 'error' | 'forged' | 'context' | 'unreferenced' | 'timeout' = 'valid';
  const provider = createServer(async (req, res) => {
    receivedAuth = req.headers.authorization ?? ''; receivedPath = req.url ?? '';
    for await (const chunk of req) receivedPrompt += chunk;
    if (responseMode === 'timeout') { await new Promise(resolve => setTimeout(resolve, 700)); res.end('{}'); return; }
    if (responseMode === 'error') { res.writeHead(500); res.end('secret-provider-message TEST_SECRET'); return; }
    const record = makeFixture('intake');
    const analysis = { ...record.analysis, source: 'model', basedOnCaseVersion: record.version,
      facts: record.facts.filter(f => /^[B-J]\d{2}$/.test(f.fieldId)).map(f => ({ ...f, reviewStatus: 'unreviewed', history: [], candidates: [] })) };
    if (responseMode === 'forged') analysis.facts[0].sourceIds = ['invented-source'];
    if (responseMode === 'context') analysis.facts.push({ ...record.facts.find(f => f.fieldId === 'A07')!, reviewStatus: 'unreviewed', history: [], candidates: [] });
    if (responseMode === 'unreferenced') analysis.facts[0].sourceIds = [];
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: responseMode === 'invalid' ? 'not JSON' : JSON.stringify(analysis) } }] }));
  });
  const providerBase = await listen(provider);
  try {
    const config = readConfig({ MODEL_MODE: 'live', MODEL_BASE_URL: `${providerBase}/v1`, MODEL_NAME: 'fake-only', MODEL_API_KEY: 'TEST_SECRET', MODEL_TIMEOUT_MS: '300' });
    await withApp(async base => {
      const good = await post(base, '/api/analyze', { case: makeFixture('intake') });
      assert.equal(good.status, 200);
      assert.equal((await good.json()).meta.providerCalled, true);
      assert.equal(receivedAuth, 'Bearer TEST_SECRET');
      assert.equal(receivedPath, '/v1/chat/completions');
      assert.match(receivedPrompt, /untrusted data/);
      for (const mode of ['invalid', 'forged', 'context', 'unreferenced'] as const) {
        responseMode = mode;
        const invalid = await post(base, '/api/analyze', { case: makeFixture('intake') });
        assert.equal(invalid.status, 502);
        const errorBody = await invalid.text();
        assert.equal(JSON.parse(errorBody).error.code, 'MODEL_INVALID_OUTPUT');
        assert.doesNotMatch(errorBody, /TEST_SECRET|secret-provider-message|Person concerned/);
      }
      responseMode = 'error';
      const failure = await post(base, '/api/analyze', { case: makeFixture('intake') });
      assert.equal(failure.status, 502);
      assert.doesNotMatch(await failure.text(), /TEST_SECRET|secret-provider-message/);
      responseMode = 'timeout';
      const timeout = await post(base, '/api/analyze', { case: makeFixture('intake') });
      assert.equal(timeout.status, 504);
      assert.equal((await timeout.json()).error.code, 'MODEL_TIMEOUT');
      assert.equal((await post(base, '/api/analyze', { case: makeFixture('intake'), fault: 'timeout' })).status, 400);
    }, config);
  } finally { await close(provider); }
});

test('missing live configuration makes no provider call', async () => {
  await withApp(async base => {
    const response = await post(base, '/api/analyze', { case: makeFixture('intake') });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'MODEL_NOT_CONFIGURED');
  }, readConfig({ MODEL_MODE: 'live' }));
});
