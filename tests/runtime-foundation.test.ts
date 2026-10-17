import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { makeRuntimeFixture, runtimeVariants } from '../shared/runtime-fixtures';
import { RuntimeCaseRecordSchema, runtimeDependencies, runtimeReviewValid, runtimeSnapshot, ticketCurrent } from '../shared/runtime';
import { mockRuntimeAnalysis, createApp } from '../server/src/app';
import { readConfig } from '../server/src/config';
import { parseRuntimeBackup, backupRuntimeCase, assertImportAllowed } from '../app/src/runtime-storage';

test('all independent runtime inputs validate, future answers do not leak into initial sources', () => {
  for (const variant of runtimeVariants) assert.equal(RuntimeCaseRecordSchema.parse(makeRuntimeFixture(variant.id)).stage, variant.id);
  const r = makeRuntimeFixture();
  assert.equal(r.sources.some(s => s.kind === 'answer'), false);
  assert.equal(r.reviews.length, 0);
  assert.equal(r.saved, false);
});
test('correction and delayed identity cannot overwrite 200 or current 250', async () => {
  const r = makeRuntimeFixture('corrected');
  const ticket = { caseId: r.caseId, instanceId: r.instanceId, caseVersion: r.version, requestId: 'req-1', settingsRevision: 1, dependencies: runtimeDependencies(r) };
  const result = await mockRuntimeAnalysis({ case: r, ticket });
  assert.equal(result.proposal.facts.find(f => f.fieldId === 'E04')!.value, 2000);
  assert.equal(r.facts.find(f => f.fieldId === 'E04')!.value, 200);
  assert.equal(r.facts.find(f => f.fieldId === 'E04')!.history[0].value, 2000);
  assert.equal(ticketCurrent(r, ticket, 'req-1', 1), true);
  for (const changed of [{ ...r, instanceId: 'opened-again' }, { ...r, version: r.version + 1 }, { ...r, caseId: 'other' }, makeRuntimeFixture('stale')]) assert.equal(ticketCurrent(changed, ticket, 'req-1', 1), false);
  assert.equal(ticketCurrent(r, ticket, 'req-2', 1), false);
  assert.equal(ticketCurrent(r, ticket, 'req-1', 2), false);
});
test('partial, unknown, stopped and 3/9 counters remain distinct independent inputs', () => {
  const partial = makeRuntimeFixture('partial');
  assert.deepEqual(partial.followUp.questions.map(q => q.status), ['answered','pending','pending']);
  assert.deepEqual(makeRuntimeFixture('unknown').followUp.questions.map(q => q.status), ['answered','unknown','unknown']);
  assert.deepEqual(makeRuntimeFixture('stopped').followUp.questions.map(q => q.status), ['answered','skipped','skipped']);
  assert.equal(makeRuntimeFixture('limit').followUp.totalQuestions, 9);
  assert.equal(makeRuntimeFixture('limit').followUp.rounds, 3);
});
test('single edit, rejected recommendation and shared context invalidate only dependencies', () => {
  const edit = makeRuntimeFixture('single-edit');
  assert.equal(runtimeReviewValid(edit, 'HANDOVER-BANK', true), false);
  assert.equal(runtimeReviewValid(edit, 'HANDOVER-TELCO', true), true);
  assert.equal(edit.outputs.find(o => o.id === 'HANDOVER-BANK')!.history.length, 1);
  const rejected = makeRuntimeFixture('rejected');
  assert.equal(runtimeReviewValid(rejected, 'HANDOVER-BANK', true), true);
  assert.equal(runtimeReviewValid(rejected, 'HANDOVER-TELCO', true), false);
  assert.equal(rejected.recommendations[2].decision, 'rejected');
  assert.ok(rejected.recommendations[2].decisionReason);
  for (const id of ['role-stale','guidance-stale']) {
    const stale = makeRuntimeFixture(id);
    assert.equal(runtimeReviewValid(stale, 'HANDOVER-BANK', true), false);
    assert.equal(stale.followUp.totalQuestions, 3);
    assert.ok(stale.reviews.some(r => r.stage === 'first'));
  }
});
test('mock review never becomes actual employee review; unsaved output is blocked', () => {
  const r = { ...makeRuntimeFixture('no-guidance'), saved: true };
  assert.equal(r.outputs.length, 1); assert.equal(r.recommendations.length, 0);
  assert.throws(() => runtimeSnapshot(r, 'SUMMARY'));
  assert.equal(runtimeSnapshot(r, 'SUMMARY', true).review.simulated, true);
  assert.throws(() => runtimeSnapshot({ ...r, saved: false }, 'SUMMARY', true));
  assert.throws(() => runtimeSnapshot(r, 'HANDOVER-BANK', true));
});
test('backup rejects version, missing references, duplicate targets; unsaved import guarded', () => {
  const r = makeRuntimeFixture('output-error');
  const parsed = JSON.parse(backupRuntimeCase(r));
  parsed.schemaVersion = 1; assert.throws(() => parseRuntimeBackup(JSON.stringify(parsed)));
  const bad = structuredClone(r); bad.sources = []; assert.equal(RuntimeCaseRecordSchema.safeParse(bad).success, false);
  const duplicate = structuredClone(r); duplicate.facts.push(duplicate.facts[0]); assert.equal(RuntimeCaseRecordSchema.safeParse(duplicate).success, false);
  const badDependency = structuredClone(r); badDependency.outputs[0].dependencies['fact:E04:TX-MISSING'] = 1; assert.equal(RuntimeCaseRecordSchema.safeParse(badDependency).success, false);
  assert.throws(() => assertImportAllowed(r));
  assert.doesNotThrow(() => assertImportAllowed({ ...r, saved: true }));
  const copy = parseRuntimeBackup(backupRuntimeCase(r)); assert.equal(copy.saved, false); assert.notEqual(copy.instanceId, r.instanceId);
  assert.equal(copy.reviews.every(v => v.simulated), true);
});
test('runtime routes use injected registrations and validate identity; explicit mock never calls provider', async () => {
  let calls = 0, outputs = 0;
  const app = createApp({ config: readConfig({ MODEL_MODE: 'mock' }),
    analyzeRuntime: async input => { calls++; return { ...await mockRuntimeAnalysis(input), meta: { simulated: false, providerCalled: false, implementation: 'local test registration' } }; },
    exportRuntime: async input => { outputs++; return { snapshot: runtimeSnapshot(input.case, input.objectId, true), bytes: Buffer.from('registered output'), filename: 'test.md', contentType: 'text/markdown' }; },
    fetchImpl: async () => { throw new Error('No provider authorized'); },
  });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const post = (path: string, data: unknown) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  try {
    const r = makeRuntimeFixture('corrected');
    const ticket = { caseId: r.caseId, instanceId: r.instanceId, caseVersion: r.version, requestId: 'req', settingsRevision: 1, dependencies: runtimeDependencies(r) };
    assert.equal((await post('/api/runtime/analyze', { case: r, ticket })).status, 200); assert.equal(calls, 1);
    const mock = await (await post('/api/runtime/analyze', { case: r, ticket, previewMock: true })).json(); assert.equal(mock.meta.providerCalled, false); assert.equal(calls, 1);
    assert.equal((await post('/api/runtime/analyze', { case: r, ticket: { ...ticket, caseId: 'wrong' } })).status, 409);
    const out = { ...makeRuntimeFixture('output-error'), saved: true };
    assert.equal(await (await post('/api/runtime/export', { case: out, objectId: 'SUMMARY', format: 'markdown' })).text(), 'registered output'); assert.equal(outputs, 1);
    assert.equal((await post('/api/runtime/export', { case: { ...out, saved: false }, objectId: 'SUMMARY', format: 'markdown', previewMock: true })).status, 409);
    assert.equal((await post('/api/runtime/export', { case: out, objectId: 'SUMMARY', format: 'markdown', previewMock: true, fault: 'failure' })).status, 503);
    assert.equal((await post('/api/runtime/export', { case: out, objectId: 'SUMMARY', format: 'markdown', previewMock: true })).status, 200);
    assert.equal(outputs, 1);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
