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
    assert.equal((await post('/api/runtime/analyze', { case: r, ticket, interaction: { messageId: 'MSG-1', sourceId: r.sources[0].id, kind: 'supplement', questionIds: [] } })).status, 400);
    assert.equal(calls, 1); // Invalid message context is rejected before the service is called.
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
import { MessageIntentSchema, MessageResolutionSchema } from '../shared/conversation';
import { AnalysisRequestSchema, parseAnalysisResponseForRequest } from '../shared/module-ports';

test('v2 conversation fields preserve old backups and reject invalid message references', () => {
  const old = makeRuntimeFixture('partial');
  assert.equal(RuntimeCaseRecordSchema.safeParse(old).success, true);
  const r = structuredClone(old);
  const source = r.sources[0];
  const q = r.followUp.questions[0];
  r.conversation = { messages: [{ id: 'MSG-1', kind: 'supplement', sourceId: source.id, questionIds: [q.id], status: 'needs-decision', recordedFactVersions: { [`${q.target.fieldId}:${q.target.recordId ?? ''}`]: 1 }, updates: [{ questionId: q.id, target: q.target, sourceId: source.id, outcome: 'conflict', disposition: 'awaiting-decision' }], unresolvedQuotes: [], createdAt: '2026-11-07T00:00:00Z' }] };
  r.analysisUpdate = { status: 'pending', messageId: 'MSG-1', operation: 'message' };
  assert.equal(RuntimeCaseRecordSchema.safeParse(r).success, true);
  const restored = parseRuntimeBackup(backupRuntimeCase(r));
  assert.deepEqual(restored.conversation, r.conversation);
  for (const mutate of [
    (x: typeof r) => { x.conversation!.messages[0].sourceId = 'missing'; },
    (x: typeof r) => { x.conversation!.messages[0].questionIds = ['missing']; },
    (x: typeof r) => { x.conversation!.messages.push(structuredClone(x.conversation!.messages[0])); },
    (x: typeof r) => { x.conversation!.messages[0].updates[0].sourceId = 'missing'; },
    (x: typeof r) => { x.conversation!.messages[0].updates[0].target = { fieldId: 'G05' }; },
  ]) { const bad = structuredClone(r); mutate(bad); assert.equal(RuntimeCaseRecordSchema.safeParse(bad).success, false); }
  assert.equal(RuntimeCaseRecordSchema.safeParse({ ...r, unexpected: true }).success, false);
});

test('message contract checks typed values, unknown observations, strict objects and mutually exclusive purposes', () => {
  const r = makeRuntimeFixture('partial');
  const ticket = { caseId: r.caseId, instanceId: r.instanceId, caseVersion: r.version, requestId: 'req', settingsRevision: 1, dependencies: runtimeDependencies(r) };
  const intent = { messageId: 'MSG-1', sourceId: r.sources[0].id, kind: 'supplement' as const, questionIds: [] };
  assert.equal(AnalysisRequestSchema.safeParse({ case: r, ticket }).success, true);
  assert.equal(AnalysisRequestSchema.safeParse({ case: r, ticket, interaction: intent, purpose: 'follow-up' }).success, false);
  assert.equal(MessageIntentSchema.safeParse({ ...intent, extra: true }).success, false);
  const answer = { questionId: 'Q1', target: { fieldId: 'C08', recordId: 'CONTACT-01' }, quote: 'No', status: 'answered', value: false };
  const result = { messageId: 'MSG-1', sourceId: 'SRC-1', answers: [answer], observations: [{ target: { fieldId: 'G05' }, quote: 'unknown', status: 'unknown' }], unresolvedQuotes: [], clarificationRevision: 1 };
  assert.equal(MessageResolutionSchema.safeParse(result).success, true);
  assert.equal(MessageResolutionSchema.safeParse({ ...result, answers: [{ ...answer, value: 'false' }] }).success, false);
  assert.equal(MessageResolutionSchema.safeParse({ ...result, answers: [{ ...answer, status: 'unknown', value: false }] }).success, false);
  assert.equal(MessageResolutionSchema.safeParse({ ...result, clarificationRevision: 0 }).success, false);
  assert.equal(MessageResolutionSchema.safeParse({ ...result, answers: [{ ...answer, extra: 'x' }] }).success, false);
});

test('unfinished messages block snapshot even if saved analysis cache says current', () => {
  const r = { ...makeRuntimeFixture('no-guidance'), saved: true };
  r.conversation = { messages: [{ id: 'MSG-1', kind: 'supplement', sourceId: r.sources[0].id, questionIds: [], status: 'failed', updates: [], unresolvedQuotes: [], createdAt: '2026-11-07T00:00:00Z' }] };
  r.analysisUpdate = { status: 'current' };
  assert.throws(() => runtimeSnapshot(r, 'SUMMARY', true), /pending analysis/);
  r.conversation.messages[0].status = 'applied';
  r.conversation.messages[0].unresolvedQuotes = [r.sources[0].text];
  assert.throws(() => runtimeSnapshot(r, 'SUMMARY', true), /pending analysis/);
});

test('clarification and earlier-message references survive backup and reject inconsistent records', () => {
  const r = makeRuntimeFixture('partial');
  const q = r.followUp.questions[0];
  r.sources.push({ id: 'MSG-SOURCE', kind: 'answer', text: 'It has stopped.' });
  r.sources.push({ id: 'DECISION-SOURCE', kind: 'correction', text: 'Employee clarified the target.' });
  r.sources.push({ id: 'LATER-SOURCE', kind: 'answer', text: 'Later answer.' });
  r.conversation = { messages: [
    { id: 'MSG-1', kind: 'supplement', sourceId: 'MSG-SOURCE', questionIds: [q.id], status: 'needs-clarification', recordedFactVersions: { [`${q.target.fieldId}:${q.target.recordId ?? ''}`]: 1 }, updates: [], unresolvedQuotes: ['It has stopped.'], clarifications: [{ revision: 1, sourceId: 'DECISION-SOURCE', actor: 'STAFF', status: 'recorded', decisions: [{ questionId: q.id, target: q.target, quote: 'It has stopped.', status: 'answered', value: 'reported pending' }], retainedQuotes: [] }], createdAt: '2026-11-07T00:00:00Z' },
    { id: 'MSG-2', kind: 'supplement', sourceId: 'LATER-SOURCE', questionIds: [], status: 'applied', updates: [], unresolvedQuotes: [], createdAt: '2026-11-07T00:01:00Z' },
  ] };
  assert.deepEqual(parseRuntimeBackup(backupRuntimeCase(r)).conversation, r.conversation);
  const first = r.conversation.messages[0];
  first.updates.push({ questionId: q.id, target: q.target, sourceId: 'MSG-SOURCE', outcome: 'conflict', disposition: 'awaiting-decision', supersededByMessageId: 'MSG-2' });
  assert.equal(RuntimeCaseRecordSchema.safeParse(r).success, true);
  for (const mutate of [
    (x: typeof r) => { x.conversation!.messages[0].updates[0].supersededByMessageId = 'MSG-1'; },
    (x: typeof r) => { x.conversation!.messages[0].updates[0].disposition = 'kept-current'; },
    (x: typeof r) => { x.conversation!.messages[0].clarifications![0].sourceId = 'missing'; },
    (x: typeof r) => { x.conversation!.messages[0].clarifications![0].decisions[0].quote = 'invented'; },
    (x: typeof r) => { x.conversation!.messages[0].clarifications![0].retainedQuotes = ['It has stopped.']; },
    (x: typeof r) => { x.conversation!.messages[0].clarifications!.push(structuredClone(x.conversation!.messages[0].clarifications![0])); },
  ]) { const bad = structuredClone(r); mutate(bad); assert.equal(RuntimeCaseRecordSchema.safeParse(bad).success, false); }
});

test('response pairing keeps legacy responses and requires the matching message and revision', async () => {
  const r = makeRuntimeFixture('partial');
  const ticket = { caseId: r.caseId, instanceId: r.instanceId, caseVersion: r.version, requestId: 'req', settingsRevision: 1, dependencies: runtimeDependencies(r) };
  const legacy = await mockRuntimeAnalysis({ case: r, ticket });
  assert.doesNotThrow(() => parseAnalysisResponseForRequest({ case: r, ticket }, legacy));
  const interaction = { messageId: 'MSG-1', sourceId: r.sources[0].id, kind: 'supplement' as const, questionIds: [], clarification: { revision: 2, sourceId: r.sources[0].id, decisions: [], retainedQuotes: [] } };
  const resolution = { messageId: interaction.messageId, sourceId: interaction.sourceId, answers: [], unresolvedQuotes: [], clarificationRevision: 2 };
  assert.doesNotThrow(() => parseAnalysisResponseForRequest({ case: r, ticket, interaction }, { ...legacy, resolution }));
  assert.throws(() => parseAnalysisResponseForRequest({ case: r, ticket, interaction }, legacy));
  assert.throws(() => parseAnalysisResponseForRequest({ case: r, ticket, interaction }, { ...legacy, resolution: { ...resolution, clarificationRevision: 1 } }));
  assert.throws(() => parseAnalysisResponseForRequest({ case: r, ticket, purpose: 'case-reanalysis' }, { ...legacy, resolution }));
  assert.throws(() => parseAnalysisResponseForRequest({ case: r, ticket }, { ...legacy, ticket: { ...ticket, requestId: 'other' } }));
});
