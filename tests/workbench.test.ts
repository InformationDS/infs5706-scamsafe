import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRuntimeFixture } from '../shared/runtime-fixtures.js';
import { fixedQuestions } from '../shared/fixtures.js';
import { currentFactGaps, refreshRuntimeGaps, repairStaleRuntimeGaps } from '../shared/case-gaps.js';
import { answerRuntimeQuestion, appendSavedQuestionRound, confirmRuntimeFacts, correctRuntimeFact } from '../shared/intake.js';
import { outputProposals } from '../shared/outputs.js';

function twoQuoteClarification() {
  const record = makeRuntimeFixture('T09');
  const firstQuote = 'First ambiguity.', secondQuote = 'Second ambiguity.';
  record.sources.push({ id: 'PARTIAL-SOURCE', kind: 'answer', text: `${firstQuote} ${secondQuote}` }, { id: 'PARTIAL-CLARIFY', kind: 'correction', text: 'Employee clarified the first statement.' });
  const decision = { target: { fieldId: 'G05' }, quote: firstQuote, status: 'answered' as const, value: false };
  const clarification = { revision: 1, sourceId: 'PARTIAL-CLARIFY', decisions: [decision], retainedQuotes: [] };
  record.conversation = { messages: [{ id: 'PARTIAL-MSG', sourceId: 'PARTIAL-SOURCE', kind: 'supplement', questionIds: [], status: 'needs-clarification', updates: [], unresolvedQuotes: [firstQuote, secondQuote], clarifications: [{ ...clarification, actor: 'STAFF', status: 'recorded' }], createdAt: '2026-11-07T00:00:00Z' }] };
  record.analysisUpdate = { status: 'pending', operation: 'clarification', messageId: 'PARTIAL-MSG' };
  const interaction = { messageId: 'PARTIAL-MSG', sourceId: 'PARTIAL-SOURCE', kind: 'supplement' as const, questionIds: [], clarification };
  const ticket = { caseId: record.caseId, instanceId: record.instanceId, caseVersion: record.version, requestId: 'partial', settingsRevision: 1, dependencies: runtimeDependencies(record) };
  const response: AnalysisResponse = { ticket, meta: { implementation: 'test', providerCalled: false, simulated: true }, proposal: { facts: [{ fieldId: 'G05', value: false, version: 1, status: 'extracted', reviewStatus: 'unreviewed', sourceIds: ['PARTIAL-CLARIFY'], candidates: [], history: [] }], analysis: { ...record.analysis, basedOnCaseVersion: record.version }, questions: [] }, resolution: { messageId: 'PARTIAL-MSG', sourceId: 'PARTIAL-SOURCE', answers: [], unresolvedQuotes: [], clarificationRevision: 1 } };
  return { record, interaction, response, firstQuote, secondQuote };
}

test('public application rejects a partial clarification that omits another unresolved quote atomically', () => {
  const { record, interaction, response } = twoQuoteClarification();
  const snapshot = structuredClone(record);
  assert.throws(() => applyResolvedMessage({ record, interaction, response }), /omitted another unresolved quote/);
  assert.deepEqual(record, snapshot);
});

test('public partial clarification preserves remaining quotes through retry, backup and later revision', () => {
  const { record, interaction, response, secondQuote } = twoQuoteClarification();
  response.resolution!.unresolvedQuotes = [secondQuote];
  const first = applyResolvedMessage({ record, interaction, response }).record;
  assert.deepEqual(first.conversation!.messages[0].unresolvedQuotes, [secondQuote]);
  assert.equal(first.conversation!.messages[0].status, 'needs-clarification');
  assert.equal(deriveAnalysisUpdate(first).state.status, 'pending');
  assert.equal(first.facts.find(f => f.fieldId === 'G05')!.value, false);
  const restored = parseRuntimeBackup(backupRuntimeCase({ ...first, saved: true }));
  const retried = { ...response, ticket: { ...response.ticket, instanceId: restored.instanceId, caseVersion: restored.version, dependencies: runtimeDependencies(restored) } };
  assert.equal(applyResolvedMessage({ record: restored, interaction, response: retried }).record, restored);
  const omittedRetry = structuredClone(retried); omittedRetry.resolution!.unresolvedQuotes = [];
  const snapshot = structuredClone(restored);
  assert.throws(() => applyResolvedMessage({ record: restored, interaction, response: omittedRetry }), /omitted another unresolved quote/);
  assert.deepEqual(restored, snapshot);
  const second = structuredClone(restored);
  second.sources.push({ id: 'PARTIAL-CLARIFY-2', kind: 'correction', text: 'Employee clarified the second statement.' });
  const decision = { target: { fieldId: 'H08' }, quote: secondQuote, status: 'answered' as const, value: true };
  const clarification = { revision: 2, sourceId: 'PARTIAL-CLARIFY-2', decisions: [decision], retainedQuotes: [] };
  second.conversation!.messages[0].clarifications!.push({ ...clarification, actor: 'STAFF', status: 'recorded' });
  second.version++; second.analysisUpdate = { status: 'pending', operation: 'clarification', messageId: 'PARTIAL-MSG' };
  const intent = { ...interaction, clarification };
  const ticket = { ...response.ticket, instanceId: second.instanceId, caseVersion: second.version, dependencies: runtimeDependencies(second) };
  const complete: AnalysisResponse = { ...response, ticket, proposal: { facts: [{ fieldId: 'H08', value: true, version: 1, status: 'extracted', reviewStatus: 'unreviewed', sourceIds: ['PARTIAL-CLARIFY-2'], candidates: [], history: [] }], analysis: { ...second.analysis, basedOnCaseVersion: second.version }, questions: [] }, resolution: { messageId: 'PARTIAL-MSG', sourceId: 'PARTIAL-SOURCE', answers: [], unresolvedQuotes: [], clarificationRevision: 2 } };
  const final = applyResolvedMessage({ record: second, interaction: intent, response: complete }).record;
  assert.equal(final.conversation!.messages[0].status, 'applied'); assert.deepEqual(final.conversation!.messages[0].unresolvedQuotes, []);
  assert.deepEqual(final.conversation!.messages[0].clarifications!.map(c => c.status), ['applied', 'applied']);
  assert.equal(final.facts.find(f => f.fieldId === 'G05')!.value, false); assert.equal(final.facts.find(f => f.fieldId === 'H08')!.value, true);
  assert.equal(deriveAnalysisUpdate(final).state.status, 'current');
});

test('explicitly retained quote is not a missing clarification, while the other quote stays pending', () => {
  const { record, interaction, response, firstQuote, secondQuote } = twoQuoteClarification();
  const clarification = { ...interaction.clarification, decisions: [], retainedQuotes: [firstQuote] };
  record.conversation!.messages[0].clarifications![0] = { ...clarification, actor: 'STAFF', status: 'recorded' };
  const retainedResponse: AnalysisResponse = { ...response, proposal: { ...response.proposal, facts: [] }, resolution: { ...response.resolution!, unresolvedQuotes: [firstQuote, secondQuote] } };
  const result = applyResolvedMessage({ record, interaction: { ...interaction, clarification }, response: retainedResponse }).record;
  assert.deepEqual(result.conversation!.messages[0].unresolvedQuotes, [secondQuote]);
  assert.deepEqual(result.conversation!.messages[0].clarifications![0].retainedQuotes, [firstQuote]);
  assert.equal(result.conversation!.messages[0].status, 'needs-clarification');
  assert.equal(deriveAnalysisUpdate(result).state.status, 'pending');
});

test('F01 gap follows current transaction fact and archives old unstructured notes', () => {
  const initial = makeRuntimeFixture('T09');
  initial.analysis.gaps = ['Unresolved E09:TX-01', 'Previous model limitation'];
  const checked = confirmRuntimeFacts(initial);
  const round = appendSavedQuestionRound(checked, fixedQuestions);
  const answered = answerRuntimeQuestion(round, 'Q1', 'reported pending', 'answered', true);
  assert.equal(answered.facts.find(f => f.fieldId === 'E09' && f.recordId === 'TX-01')?.value, 'reported pending');
  assert.equal(answered.analysis.gaps.includes('Unresolved E09:TX-01'), false);
  assert.ok(answered.analysisGapHistory?.some(h => h.gaps.includes('Previous model limitation')));
  assert.equal(refreshRuntimeGaps(answered), answered);
  const summary = outputProposals(answered).find(o => o.id === 'SUMMARY')!.body;
  const section = summary.split('## Unresolved information')[1].split('## Reported sources')[0];
  assert.doesNotMatch(section, /E09:TX-01/);
  assert.doesNotMatch(summary, /Gap: Unresolved E09:TX-01/);
  assert.equal(answered.followUp.totalQuestions, 3);
});

test('only current unresolved statuses are gaps; resolved historical candidates are retained', () => {
  const r = makeRuntimeFixture('T09');
  const item = r.facts.find(f => f.fieldId === 'E09' && f.recordId === 'TX-01')!;
  item.value = 'reported pending'; item.status = 'extracted'; item.candidates = [{ value: 'reported completed', sourceIds: ['S3'] }];
  assert.equal(currentFactGaps(r).some(g => g.target.fieldId === 'E09'), false);
  item.status = 'conflict';
  assert.equal(currentFactGaps(r).some(g => g.target.fieldId === 'E09'), true);
  item.status = 'not-applicable'; item.value = null;
  assert.equal(currentFactGaps(r).some(g => g.target.fieldId === 'E09'), false);
});

import { createEmptyRuntimeCase, deriveAnalysisUpdate, resolveEarlierMessageTarget, applyRoleSelection } from '../shared/workbench-case.js';
test('empty case contains only known system context and no T09 source or business facts', () => {
  const fixture = makeRuntimeFixture('T09');
  const r = createEmptyRuntimeCase({ role: fixture.role, guidelines: fixture.guidelines, caseId: 'SYN-NEW', instanceId: 'instance', receivedAt: '2026-11-07T12:00:00+11:00' });
  assert.deepEqual(r.facts.map(f => f.fieldId), ['A01', 'A02', 'A04', 'A05', 'A06']);
  assert.deepEqual([r.sources.length, r.followUp.totalQuestions, r.reviews.length, r.outputs.length, r.recommendations.length], [0, 0, 0, 0, 0]);
  assert.equal(r.guidanceStatus, 'none');
  assert.throws(() => createEmptyRuntimeCase({ role: fixture.role, guidelines: [], caseId: 'SYN-NEW', instanceId: 'instance', receivedAt: '2026-11-07T12:00:00' }));
});
test('case analysis state derives every blocker instead of trusting current cache', () => {
  const r = makeRuntimeFixture('T09');
  r.sources.push({ id: 'MSG1', kind: 'answer', text: 'It stopped.' }, { id: 'MSG2', kind: 'answer', text: 'recipient' });
  r.conversation = { messages: [
    { id: 'one', kind: 'supplement', sourceId: 'MSG1', questionIds: [], status: 'needs-clarification', updates: [], unresolvedQuotes: ['It stopped.'], createdAt: '2026-11-07T00:00:00Z' },
    { id: 'two', kind: 'supplement', sourceId: 'MSG2', questionIds: [], status: 'applied', updates: [], unresolvedQuotes: [], createdAt: '2026-11-07T00:01:00Z' },
  ] };
  r.analysisUpdate = { status: 'current' };
  assert.equal(deriveAnalysisUpdate(r).state.status, 'pending');
  assert.deepEqual(deriveAnalysisUpdate(r).blockers.map(b => b.messageId), ['one']);
  r.conversation.messages[0].status = 'failed';
  assert.equal(deriveAnalysisUpdate(r).state.status, 'failed');
  assert.equal(deriveAnalysisUpdate(r, { operation: 'message', messageId: 'two', status: 'pending' }).state.status, 'pending');
  r.conversation.messages[0].status = 'applied';
  r.conversation.messages[0].unresolvedQuotes = [];
  r.analysisUpdate = { status: 'failed', operation: 'reanalysis' };
  assert.equal(deriveAnalysisUpdate(r, { operation: 'message', messageId: 'two', status: 'completed' }).state.status, 'failed');
  assert.equal(deriveAnalysisUpdate(r, { operation: 'reanalysis', status: 'completed' }).state.status, 'current');
  r.analysisUpdate = { status: 'current' };
  r.conversation.messages[0].unresolvedQuotes = ['It stopped.'];
  assert.equal(deriveAnalysisUpdate(r).state.status, 'pending');
});

test('earlier-answer choices preserve the current fact until an explicit employee decision', () => {
  let r = makeRuntimeFixture('partial');
  const q = r.followUp.questions.find(q => q.id === 'Q1')!;
  r = answerRuntimeQuestion(r, q.id, 'reported completed', 'answered', true);
  // This fixture represents a newer message whose complete analysis already succeeded.
  r.analysisUpdate = { status: 'current' };
  const f = r.facts.find(f => f.fieldId === 'E09' && f.recordId === 'TX-01')!;
  r.sources.push({ id: 'OLD-MESSAGE', kind: 'answer', text: 'The debit is pending.' }, { id: 'OLD-QUOTE', kind: 'answer', text: 'The debit is pending.', target: q.target }, { id: 'NEW-MESSAGE', kind: 'answer', text: 'reported completed' });
  f.candidates.push({ value: 'reported pending', sourceIds: ['OLD-QUOTE'] }); f.status = 'conflict'; f.version++;
  r.conversation = { messages: [
    { id: 'old', kind: 'supplement', sourceId: 'OLD-MESSAGE', questionIds: [q.id], status: 'needs-decision', updates: [{ questionId: q.id, target: q.target, sourceId: 'OLD-QUOTE', outcome: 'conflict', disposition: 'awaiting-decision', supersededByMessageId: 'new' }], unresolvedQuotes: [], createdAt: '2026-11-07T00:00:00Z' },
    { id: 'new', kind: 'supplement', sourceId: 'NEW-MESSAGE', questionIds: [q.id], status: 'applied', updates: [{ questionId: q.id, target: q.target, sourceId: 'NEW-MESSAGE', outcome: 'answered', disposition: 'current' }], unresolvedQuotes: [], createdAt: '2026-11-07T00:01:00Z' },
  ] };
  const params = { messageId: 'old', target: q.target, candidateSourceId: 'OLD-QUOTE', reason: 'Employee compared both statements', actor: 'STAFF', expectedCaseVersion: r.version };
  const keep = resolveEarlierMessageTarget(r, { ...params, choice: 'keep-current' });
  assert.equal(keep.facts.find(f => f.fieldId === 'E09')!.value, 'reported completed');
  assert.equal(keep.followUp.questions.find(q => q.id === 'Q1')!.answer, 'reported completed');
  assert.equal(keep.conversation!.messages[0].status, 'recorded');
  assert.equal(deriveAnalysisUpdate(keep).state.status, 'pending');
  const adopt = resolveEarlierMessageTarget(r, { ...params, choice: 'use-earlier' });
  assert.equal(adopt.facts.find(f => f.fieldId === 'E09')!.value, 'reported pending');
  assert.equal(adopt.followUp.questions.find(q => q.id === 'Q1')!.answer, 'The debit is pending.');
  assert.equal(adopt.followUp.totalQuestions, r.followUp.totalQuestions);
  assert.ok(adopt.facts.find(f => f.fieldId === 'E09')!.history.some(h => h.value === 'reported completed'));
  assert.throws(() => resolveEarlierMessageTarget(r, { ...params, expectedCaseVersion: r.version - 1, choice: 'use-earlier' }));
});

import { runtimeDependencies, runtimeSnapshot, RuntimeCaseRecordSchema } from '../shared/runtime.js';
import { backupRuntimeCase, parseRuntimeBackup } from '../app/src/runtime-storage.js';
import { applyResolvedMessage } from '../shared/workbench-case.js';
import type { AnalysisResponse } from '../shared/module-ports.js';

test('one response maps each evidence quote to its original question and is idempotent', () => {
  const checked = confirmRuntimeFacts(makeRuntimeFixture('T09'));
  const r = appendSavedQuestionRound(checked, fixedQuestions);
  const text = 'The debit is pending. The sender has not contacted me again. I do not know the recipient.';
  r.sources.push({ id: 'SOURCE-MSG', kind: 'answer', text });
  r.conversation = { messages: [{ id: 'MSG-1', kind: 'supplement', sourceId: 'SOURCE-MSG', questionIds: ['Q1','Q2','Q3'], status: 'recorded', recordedFactVersions: Object.fromEntries(r.facts.map(f => [`${f.fieldId}:${f.recordId ?? ''}`, f.version])), updates: [], unresolvedQuotes: [], createdAt: '2026-11-07T00:00:00Z' }] };
  const interaction = { messageId: 'MSG-1', sourceId: 'SOURCE-MSG', kind: 'supplement' as const, questionIds: ['Q1','Q2','Q3'] };
  const ticket = { caseId: r.caseId, instanceId: r.instanceId, caseVersion: r.version, requestId: 'request', settingsRevision: 1, dependencies: runtimeDependencies(r) };
  const response: AnalysisResponse = { ticket, meta: { implementation: 'test', providerCalled: false, simulated: true }, proposal: { facts: [], analysis: { ...r.analysis, basedOnCaseVersion: r.version }, questions: [] }, resolution: { messageId: 'MSG-1', sourceId: 'SOURCE-MSG', unresolvedQuotes: [], answers: [
    { questionId: 'Q1', target: fixedQuestions[0].target, quote: 'The debit is pending.', status: 'answered', value: 'reported pending' },
    { questionId: 'Q2', target: fixedQuestions[1].target, quote: 'The sender has not contacted me again.', status: 'answered', value: false },
    { questionId: 'Q3', target: fixedQuestions[2].target, quote: 'I do not know the recipient.', status: 'unknown', value: null },
  ] } };
  const applied = applyResolvedMessage({ record: r, interaction, response });
  assert.deepEqual(applied.updatedQuestionIds, ['Q1','Q2','Q3']);
  assert.deepEqual(applied.record.followUp.questions.map(q => q.status), ['answered','answered','unknown']);
  assert.deepEqual(applied.record.followUp.questions.map(q => q.answer), ['The debit is pending.','The sender has not contacted me again.','I do not know the recipient.']);
  assert.equal(applied.record.facts.find(f => f.fieldId === 'C08')!.value, false);
  assert.equal(applied.record.facts.find(f => f.fieldId === 'E09')!.value, 'reported pending');
  assert.equal(applied.record.facts.find(f => f.fieldId === 'E09')!.reviewStatus, 'unreviewed');
  assert.equal(applied.record.reviews.filter(review => review.stage === 'first').length, r.reviews.filter(review => review.stage === 'first').length);
  assert.equal(applied.record.followUp.totalQuestions, 3);
  assert.equal(applied.record.analysisUpdate?.status, 'current');
  assert.equal(applyResolvedMessage({ record: applied.record, interaction, response: { ...response, ticket: { ...ticket, caseVersion: applied.record.version, dependencies: runtimeDependencies(applied.record) } } }).record, applied.record);
  const invalid = structuredClone(response); invalid.resolution!.answers[0].quote = 'unrelated quote';
  assert.throws(() => applyResolvedMessage({ record: r, interaction, response: invalid }));
  const repeated = structuredClone(response); repeated.resolution!.answers.forEach(answer => { answer.quote = text; });
  assert.throws(() => applyResolvedMessage({ record: r, interaction, response: repeated }), /entire message/);
  assert.equal(r.followUp.questions[0].status, 'pending');
});

test('unknown observation does not clear a known checked fact; contradictory proposal is atomic failure', () => {
  const r = makeRuntimeFixture('T09');
  r.facts.push({ fieldId: 'G05', value: false, version: 1, status: 'extracted', reviewStatus: 'checked', sourceIds: ['S1'], candidates: [], history: [] });
  r.sources.push({ id: 'UNKNOWN-MSG', kind: 'answer', text: 'I do not know whether remote access continues.' });
  r.conversation = { messages: [{ id: 'unknown', kind: 'supplement', sourceId: 'UNKNOWN-MSG', questionIds: [], status: 'recorded', recordedFactVersions: Object.fromEntries(r.facts.map(f => [`${f.fieldId}:${f.recordId ?? ''}`, f.version])), updates: [], unresolvedQuotes: [], createdAt: '2026-11-07T00:00:00Z' }] };
  const fact = structuredClone(r.facts.find(f => f.fieldId === 'G05')!);
  const interaction = { messageId: 'unknown', sourceId: 'UNKNOWN-MSG', kind: 'supplement' as const, questionIds: [] };
  const ticket = { caseId: r.caseId, instanceId: r.instanceId, caseVersion: r.version, requestId: 'request', settingsRevision: 1, dependencies: runtimeDependencies(r) };
  const response: AnalysisResponse = { ticket, meta: { implementation: 'test', providerCalled: false, simulated: true }, proposal: { facts: [], analysis: { ...r.analysis, basedOnCaseVersion: r.version }, questions: [] }, resolution: { messageId: 'unknown', sourceId: 'UNKNOWN-MSG', answers: [], observations: [{ target: { fieldId: 'G05' }, quote: 'I do not know whether remote access continues.', status: 'unknown' }], unresolvedQuotes: [] } };
  const applied = applyResolvedMessage({ record: r, interaction, response }).record;
  assert.deepEqual(applied.facts.find(f => f.fieldId === 'G05'), fact);
  const bad = structuredClone(response); bad.proposal.facts.push({ ...fact, value: null, status: 'missing' });
  assert.throws(() => applyResolvedMessage({ record: r, interaction, response: bad }));
  assert.deepEqual(r.facts.find(f => f.fieldId === 'G05'), fact);
  const withdrawn = correctRuntimeFact(applied, { fieldId: 'G05' }, null, 'Employee explicitly withdrew the prior statement');
  assert.equal(withdrawn.facts.find(f => f.fieldId === 'G05')!.value, null);
  assert.equal(withdrawn.facts.find(f => f.fieldId === 'G05')!.history.at(-1)!.value, false);
  assert.deepEqual(withdrawn.analysisUpdate, { status: 'pending', operation: 'reanalysis' });
});

test('retrying an earlier message leaves a newer answer current and creates a decision candidate', () => {
  const checked = confirmRuntimeFacts(makeRuntimeFixture('T09'));
  const r = appendSavedQuestionRound(checked, fixedQuestions);
  const versions = Object.fromEntries(r.facts.map(f => [`${f.fieldId}:${f.recordId ?? ''}`, f.version]));
  r.sources.push({ id: 'OLD', kind: 'answer', text: 'The debit is pending.' }, { id: 'NEW', kind: 'answer', text: 'The debit is completed.' });
  r.conversation = { messages: [
    { id: 'old', kind: 'supplement', sourceId: 'OLD', questionIds: ['Q1'], status: 'failed', recordedFactVersions: versions, updates: [], unresolvedQuotes: [], createdAt: '2026-11-07T00:00:00Z' },
    { id: 'new', kind: 'supplement', sourceId: 'NEW', questionIds: ['Q1'], status: 'recorded', recordedFactVersions: versions, updates: [], unresolvedQuotes: [], createdAt: '2026-11-07T00:01:00Z' },
  ] };
  const request = (record: typeof r, messageId: string, sourceId: string, quote: string, value: string) => {
    const interaction = { messageId, sourceId, kind: 'supplement' as const, questionIds: ['Q1'] };
    const ticket = { caseId: record.caseId, instanceId: record.instanceId, caseVersion: record.version, requestId: 'request', settingsRevision: 1, dependencies: runtimeDependencies(record) };
    const response: AnalysisResponse = { ticket, meta: { implementation: 'test', providerCalled: false, simulated: true }, proposal: { facts: [], analysis: { ...record.analysis, basedOnCaseVersion: record.version }, questions: [] }, resolution: { messageId, sourceId, answers: [{ questionId: 'Q1', target: fixedQuestions[0].target, quote, status: 'answered', value }], unresolvedQuotes: [] } };
    return { record, interaction, response };
  };
  const newer = applyResolvedMessage(request(r, 'new', 'NEW', 'The debit is completed.', 'reported completed')).record;
  assert.equal(deriveAnalysisUpdate(newer).state.status, 'failed');
  const older = applyResolvedMessage(request(newer, 'old', 'OLD', 'The debit is pending.', 'reported pending')).record;
  const fact = older.facts.find(f => f.fieldId === 'E09')!;
  assert.equal(fact.value, 'reported completed');
  assert.equal(older.followUp.questions[0].answer, 'The debit is completed.');
  assert.equal(fact.candidates.filter(c => c.value === 'reported pending').length, 1);
  assert.equal(older.conversation!.messages[0].status, 'needs-decision');
  assert.equal(older.analysisUpdate!.status, 'pending');
  assert.equal(older.followUp.totalQuestions, 3);
  assert.throws(() => applyResolvedMessage(request(older, 'old', 'OLD', 'The debit is pending.', 'reported pending')));
});

test('partial message clarification applies only the confirmed new target and preserves earlier answers', () => {
  const r = appendSavedQuestionRound(confirmRuntimeFacts(makeRuntimeFixture('T09')), fixedQuestions);
  const text = 'The debit is pending. It has stopped.';
  r.sources.push({ id: 'MSG', kind: 'answer', text });
  r.conversation = { messages: [{ id: 'msg', kind: 'supplement', sourceId: 'MSG', questionIds: ['Q1'], status: 'recorded', recordedFactVersions: Object.fromEntries(r.facts.map(f => [`${f.fieldId}:${f.recordId ?? ''}`, f.version])), updates: [], unresolvedQuotes: [], createdAt: '2026-11-07T00:00:00Z' }] };
  const interaction = { messageId: 'msg', sourceId: 'MSG', kind: 'supplement' as const, questionIds: ['Q1'] };
  const ticketFor = (record: typeof r) => ({ caseId: record.caseId, instanceId: record.instanceId, caseVersion: record.version, requestId: 'request', settingsRevision: 1, dependencies: runtimeDependencies(record) });
  const response: AnalysisResponse = { ticket: ticketFor(r), meta: { implementation: 'test', providerCalled: false, simulated: true }, proposal: { facts: [], analysis: { ...r.analysis, basedOnCaseVersion: r.version }, questions: [] }, resolution: { messageId: 'msg', sourceId: 'MSG', answers: [{ questionId: 'Q1', target: fixedQuestions[0].target, quote: 'The debit is pending.', status: 'answered', value: 'reported pending' }], unresolvedQuotes: ['It has stopped.'] } };
  const partial = applyResolvedMessage({ record: r, interaction, response }).record;
  assert.equal(partial.conversation!.messages[0].status, 'needs-clarification');
  const firstAnswer = structuredClone(partial.followUp.questions[0]);
  partial.sources.push({ id: 'CLARIFY', kind: 'correction', text: 'Employee confirms remote access stopped.' });
  const decision = { target: { fieldId: 'G05' }, quote: 'It has stopped.', status: 'answered' as const, value: false };
  partial.conversation!.messages[0].clarifications = [{ revision: 1, sourceId: 'CLARIFY', actor: 'STAFF', decisions: [decision], retainedQuotes: [], status: 'recorded' }];
  const clarification = { revision: 1, sourceId: 'CLARIFY', decisions: [decision], retainedQuotes: [] };
  const clarifiedInteraction = { ...interaction, questionIds: [], clarification };
  const clarified: AnalysisResponse = { ticket: ticketFor(partial), meta: response.meta, proposal: { facts: [{ fieldId: 'G05', value: false, version: 1, status: 'extracted', reviewStatus: 'unreviewed', sourceIds: ['CLARIFY'], candidates: [], history: [] }], analysis: { ...partial.analysis, basedOnCaseVersion: partial.version }, questions: [] }, resolution: { messageId: 'msg', sourceId: 'MSG', answers: [], unresolvedQuotes: [], clarificationRevision: 1 } };
  const applied = applyResolvedMessage({ record: partial, interaction: clarifiedInteraction, response: clarified }).record;
  assert.equal(applied.facts.find(f => f.fieldId === 'G05')!.value, false);
  assert.deepEqual(applied.followUp.questions[0], firstAnswer);
  assert.equal(applied.conversation!.messages[0].clarifications![0].status, 'applied');
  assert.equal(applied.conversation!.messages[0].status, 'applied');
  assert.equal(applied.analysisUpdate?.status, 'current');
  assert.equal(applyResolvedMessage({ record: applied, interaction: clarifiedInteraction, response: clarified }).record, applied);
});

test('missing unknown target creates one placeholder without inventing repeated records', () => {
  const r = makeRuntimeFixture('T09');
  const text = 'I do not know if remote access continues.';
  r.sources.push({ id: 'UNKNOWN', kind: 'answer', text });
  r.conversation = { messages: [{ id: 'msg', kind: 'supplement', sourceId: 'UNKNOWN', questionIds: [], status: 'recorded', recordedFactVersions: {}, updates: [], unresolvedQuotes: [], createdAt: '2026-11-07T00:00:00Z' }] };
  const interaction = { messageId: 'msg', sourceId: 'UNKNOWN', kind: 'supplement' as const, questionIds: [] };
  const ticket = { caseId: r.caseId, instanceId: r.instanceId, caseVersion: r.version, requestId: 'req', settingsRevision: 1, dependencies: runtimeDependencies(r) };
  const response: AnalysisResponse = { ticket, meta: { implementation: 'test', providerCalled: false, simulated: true }, proposal: { facts: [], analysis: { ...r.analysis, basedOnCaseVersion: r.version }, questions: [] }, resolution: { messageId: 'msg', sourceId: 'UNKNOWN', answers: [], observations: [{ target: { fieldId: 'G05' }, quote: text, status: 'unknown' }], unresolvedQuotes: [] } };
  const applied = applyResolvedMessage({ record: r, interaction, response }).record;
  assert.equal(applied.facts.filter(f => f.fieldId === 'G05').length, 1);
  assert.equal(applied.facts.find(f => f.fieldId === 'G05')!.value, null);
  assert.equal(applyResolvedMessage({ record: applied, interaction, response }).record, applied);
  const invalid = structuredClone(response); invalid.resolution!.observations![0].target = { fieldId: 'E09', recordId: 'TX-NEW' };
  assert.throws(() => applyResolvedMessage({ record: r, interaction, response: invalid }), /cannot invent/);
});

test('role restrictions preserve facts, question counts, decisions and review history', () => {
  const r = makeRuntimeFixture('rejected');
  const role = { ...r.role, permissions: r.role.permissions.filter(p => p !== 'Prepare local drafts') };
  const updated = applyRoleSelection(r, role);
  assert.equal(updated.roleRevision, r.roleRevision + 1);
  assert.deepEqual(updated.followUp, r.followUp);
  assert.deepEqual(updated.reviews, r.reviews);
  assert.deepEqual(updated.recommendations.map(x => [x.id, x.decision, x.decisionReason]), r.recommendations.map(x => [x.id, x.decision, x.decisionReason]));
  assert.deepEqual(updated.facts.filter(f => !['A04','A05','A06'].includes(f.fieldId)), r.facts.filter(f => !['A04','A05','A06'].includes(f.fieldId)));
});

test('typed follow-up cannot overwrite an employee-corrected target', () => {
  let r = appendSavedQuestionRound(confirmRuntimeFacts(makeRuntimeFixture('T09')), fixedQuestions);
  r = correctRuntimeFact(r, fixedQuestions[0].target, 'reported completed', 'Employee confirmed the current value');
  const text = 'The debit is pending.';
  r.sources.push({ id: 'MSG-CORRECTED', kind: 'answer', text });
  r.conversation = { messages: [{ id: 'msg', kind: 'supplement', sourceId: 'MSG-CORRECTED', questionIds: ['Q1'], status: 'recorded', recordedFactVersions: Object.fromEntries(r.facts.map(f => [`${f.fieldId}:${f.recordId ?? ''}`, f.version])), updates: [], unresolvedQuotes: [], createdAt: '2026-11-07T00:00:00Z' }] };
  const interaction = { messageId: 'msg', sourceId: 'MSG-CORRECTED', kind: 'supplement' as const, questionIds: ['Q1'] };
  const ticket = { caseId: r.caseId, instanceId: r.instanceId, caseVersion: r.version, requestId: 'req', settingsRevision: 1, dependencies: runtimeDependencies(r) };
  const response: AnalysisResponse = { ticket, meta: { implementation: 'test', providerCalled: false, simulated: true }, proposal: { facts: [], analysis: { ...r.analysis, basedOnCaseVersion: r.version }, questions: [] }, resolution: { messageId: 'msg', sourceId: 'MSG-CORRECTED', answers: [{ questionId: 'Q1', target: fixedQuestions[0].target, quote: text, status: 'answered', value: 'reported pending' }], unresolvedQuotes: [] } };
  const result = applyResolvedMessage({ record: r, interaction, response }).record;
  const fact = result.facts.find(f => f.fieldId === 'E09')!;
  assert.equal(fact.value, 'reported completed');
  assert.equal(fact.reviewStatus, 'corrected');
  assert.equal(fact.status, 'conflict');
  assert.equal(fact.candidates.some(c => c.value === 'reported pending'), true);
  assert.equal(result.conversation!.messages[0].updates[0].outcome, 'conflict');
});

test('imported messages without version snapshots compare conservatively and isolate transactions', () => {
  const run = (incoming: string, quote: string) => {
    const r = makeRuntimeFixture('partial');
    const original = r.facts.find(f => f.fieldId === 'E09' && f.recordId === 'TX-01')!;
    r.facts.push({ ...structuredClone(original), recordId: 'TX-02', value: 'reported pending' });
    r.sources.push({ id: 'OLDER', kind: 'answer', text: quote });
    r.conversation = { messages: [{ id: 'older', kind: 'supplement', sourceId: 'OLDER', questionIds: ['Q1'], status: 'failed', updates: [], unresolvedQuotes: [], createdAt: '2026-11-07T00:00:00Z' }] };
    const interaction = { messageId: 'older', sourceId: 'OLDER', kind: 'supplement' as const, questionIds: ['Q1'] };
    const ticket = { caseId: r.caseId, instanceId: r.instanceId, caseVersion: r.version, requestId: 'req', settingsRevision: 1, dependencies: runtimeDependencies(r) };
    const response: AnalysisResponse = { ticket, meta: { implementation: 'test', providerCalled: false, simulated: true }, proposal: { facts: [], analysis: { ...r.analysis, basedOnCaseVersion: r.version }, questions: [] }, resolution: { messageId: 'older', sourceId: 'OLDER', answers: [{ questionId: 'Q1', target: fixedQuestions[0].target, quote, status: 'answered', value: incoming }], unresolvedQuotes: [] } };
    return { original: r, result: applyResolvedMessage({ record: r, interaction, response }).record };
  };
  const different = run('reported completed', 'The debit is completed.');
  assert.equal(different.result.facts.find(f => f.fieldId === 'E09' && f.recordId === 'TX-01')!.value, 'reported pending');
  assert.equal(different.result.conversation!.messages[0].status, 'needs-decision');
  assert.deepEqual(different.result.facts.find(f => f.fieldId === 'E09' && f.recordId === 'TX-02'), different.original.facts.find(f => f.fieldId === 'E09' && f.recordId === 'TX-02'));
  const same = run('reported pending', 'The debit is pending.');
  assert.equal(same.result.conversation!.messages[0].updates[0].disposition, 'historical');
  assert.deepEqual(same.result.facts.find(f => f.fieldId === 'E09' && f.recordId === 'TX-01'), same.original.facts.find(f => f.fieldId === 'E09' && f.recordId === 'TX-01'));
  assert.deepEqual(same.result.followUp.questions[0], same.original.followUp.questions[0]);
});

test('explicit not-applicable clarification updates the original question without erasing a known fact', () => {
  const r = appendSavedQuestionRound(confirmRuntimeFacts(makeRuntimeFixture('T09')), fixedQuestions);
  const quote = 'The debit status is not applicable.';
  r.sources.push({ id: 'NOTAPP', kind: 'answer', text: quote }, { id: 'NOTAPP-CONFIRMED', kind: 'correction', text: 'Employee confirmed not applicable and provided a reason.' });
  const decision = { questionId: 'Q1', target: fixedQuestions[0].target, quote, status: 'not-applicable' as const, value: null };
  r.conversation = { messages: [{ id: 'msg', kind: 'supplement', sourceId: 'NOTAPP', questionIds: ['Q1'], status: 'needs-clarification', recordedFactVersions: Object.fromEntries(r.facts.map(f => [`${f.fieldId}:${f.recordId ?? ''}`, f.version])), updates: [], unresolvedQuotes: [quote], clarifications: [{ revision: 1, sourceId: 'NOTAPP-CONFIRMED', actor: 'STAFF', decisions: [decision], retainedQuotes: [], status: 'recorded' }], createdAt: '2026-11-07T00:00:00Z' }] };
  const clarification = { revision: 1, sourceId: 'NOTAPP-CONFIRMED', decisions: [decision], retainedQuotes: [] };
  const interaction = { messageId: 'msg', sourceId: 'NOTAPP', kind: 'supplement' as const, questionIds: ['Q1'], clarification };
  const ticket = { caseId: r.caseId, instanceId: r.instanceId, caseVersion: r.version, requestId: 'req', settingsRevision: 1, dependencies: runtimeDependencies(r) };
  const response: AnalysisResponse = { ticket, meta: { implementation: 'test', providerCalled: false, simulated: true }, proposal: { facts: [], analysis: { ...r.analysis, basedOnCaseVersion: r.version }, questions: [] }, resolution: { messageId: 'msg', sourceId: 'NOTAPP', answers: [decision], unresolvedQuotes: [], clarificationRevision: 1 } };
  const result = applyResolvedMessage({ record: r, interaction, response }).record;
  assert.equal(result.followUp.questions[0].status, 'not-applicable');
  assert.equal(result.facts.find(f => f.fieldId === 'E09')!.status, 'not-applicable');
  const known = structuredClone(r); known.facts.find(f => f.fieldId === 'E09')!.value = 'reported pending';
  assert.throws(() => applyResolvedMessage({ record: known, interaction, response }), /explicit fact correction/);
});

import { analyzeRuntime } from '../server/src/model.js';
import { readConfig } from '../server/src/config.js';
import { mergeRuntimeProposal } from '../shared/intake.js';
test('legacy answer marks analysis pending until a fresh Mock analysis preserves the answer', async () => {
  const round = appendSavedQuestionRound(confirmRuntimeFacts(makeRuntimeFixture('T09')), fixedQuestions);
  const answered = answerRuntimeQuestion(round, 'Q1', 'reported pending', 'answered', true);
  assert.deepEqual(answered.analysisUpdate, { status: 'pending', operation: 'reanalysis' });
  const ticket = { caseId: answered.caseId, instanceId: answered.instanceId, caseVersion: answered.version, requestId: 'legacy', settingsRevision: 1, dependencies: runtimeDependencies(answered) };
  const response = await analyzeRuntime({ case: answered, ticket }, { config: readConfig({ MODEL_MODE: 'mock' }) });
  assert.equal(response.meta.providerCalled, false);
  const refreshed = mergeRuntimeProposal(answered, response.proposal);
  assert.equal(refreshed.analysisUpdate?.status, 'current');
  assert.equal(refreshed.facts.find(f => f.fieldId === 'E09' && f.recordId === 'TX-01')!.value, 'reported pending');
  assert.equal(refreshed.analysis.gaps.includes('Unresolved E09:TX-01'), false);
});

test('role switch retains previous recipient drafts as inactive history', () => {
  const r = makeRuntimeFixture('rejected');
  const old = structuredClone(r.outputs);
  const role = { ...r.role, recipients: [] };
  const changed = applyRoleSelection(r, role);
  assert.deepEqual(changed.outputs, old);
  assert.equal(changed.followUp.totalQuestions, r.followUp.totalQuestions);
  const restored = parseRuntimeBackup(backupRuntimeCase(changed));
  assert.deepEqual(restored.outputs, old);
  assert.throws(() => runtimeSnapshot({ ...restored, saved: true }, 'HANDOVER-BANK', true));
  const forged = structuredClone(changed); forged.outputs.find(o => o.id === 'HANDOVER-BANK')!.dependencies.role = forged.roleRevision;
  assert.equal(RuntimeCaseRecordSchema.safeParse(forged).success, false);
});

test('first review keeps the old simulated default and accepts only explicit employee identity', () => {
  const r = makeRuntimeFixture('T09');
  const training = confirmRuntimeFacts(r);
  const employee = confirmRuntimeFacts(r, { actor: 'STAFF-01', simulated: false });
  assert.equal(training.reviews.at(-1)!.simulated, true);
  assert.equal(training.reviews.at(-1)!.actor, 'MOCK-STAFF');
  assert.equal(employee.reviews.at(-1)!.simulated, false);
  assert.equal(employee.reviews.at(-1)!.actor, 'STAFF-01');
  assert.throws(() => confirmRuntimeFacts(r, { actor: ' ', simulated: false }));
});

test('old stale gap is repaired on backup import without rewriting reviews or body and cannot export directly', () => {
  const r = { ...makeRuntimeFixture('no-guidance'), saved: true };
  const fact = r.facts.find(f => f.fieldId === 'E09' && f.recordId === 'TX-01')!;
  fact.value = 'reported pending'; fact.status = 'extracted';
  r.analysis.gaps = ['Unresolved E09:TX-01', 'Historic non-field limitation'];
  const beforeBody = r.outputs[0].body, beforeReviews = structuredClone(r.reviews), beforeVersion = r.analysis.version;
  assert.throws(() => runtimeSnapshot(r, 'SUMMARY', true), /pending analysis/);
  const json = backupRuntimeCase(r);
  const restored = parseRuntimeBackup(json);
  assert.equal(restored.saved, false);
  assert.ok(restored.analysis.version > beforeVersion);
  assert.equal(restored.analysisUpdate?.status, 'pending');
  assert.equal(restored.analysis.gaps.includes('Unresolved E09:TX-01'), false);
  assert.ok(restored.analysisGapHistory?.some(h => h.gaps.includes('Historic non-field limitation')));
  assert.equal(restored.outputs[0].body, beforeBody);
  assert.deepEqual(restored.reviews, beforeReviews);
  assert.equal(repairStaleRuntimeGaps(restored), restored);
  assert.equal(JSON.parse(json).record.analysis.gaps[0], 'Unresolved E09:TX-01');
});

import { fieldLabels, fieldLabel, fieldGroup, targetLabel, factValueLabel } from '../shared/field-labels.js';
import { outputSnapshotToHtml, outputSnapshotToMarkdown } from '../shared/export.js';
test('all dictionary fields have English names and generated Markdown/HTML retain IDs safely', () => {
  assert.equal(Object.keys(fieldLabels).length, 70);
  for (const [letter, count] of Object.entries({ A:8, B:7, C:8, D:5, E:9, F:7, G:5, H:10, I:6, J:5 })) for (let i = 1; i <= count; i++) assert.ok(fieldLabels[`${letter}${String(i).padStart(2, '0')}`]);
  assert.equal(fieldLabel('E09'), 'Transaction status'); assert.equal(fieldLabel('E04'), 'Reported amount'); assert.equal(fieldLabel('C08'), 'Continuing contact');
  assert.equal(targetLabel({ fieldId: 'E09', recordId: 'TX-01' }), 'Transaction status · TX-01');
  assert.equal(fieldLabel('UNKNOWN'), 'UNKNOWN'); assert.equal(fieldGroup('UNKNOWN'), 'Other');
  assert.equal(factValueLabel(false), 'No'); assert.equal(factValueLabel(null), 'Unknown / not supplied');
  const r = makeRuntimeFixture('T09');
  r.facts.push({ fieldId: 'C08', recordId: 'CONTACT-X|Y\nZ', value: false, version: 1, status: 'extracted', reviewStatus: 'checked', sourceIds: ['S1'], candidates: [], history: [] });
  const body = outputProposals(r)[0].body;
  assert.match(body, /Continuing contact · CONTACT-X\\\|Y<br>Z \(C08:CONTACT-X\\\|Y<br>Z\) \| No/);
  const snapshot = runtimeSnapshot({ ...makeRuntimeFixture('no-guidance'), saved: true }, 'SUMMARY', true);
  snapshot.body = body;
  const md = outputSnapshotToMarkdown(snapshot), html = outputSnapshotToHtml(snapshot);
  assert.ok(md.includes(body));
  assert.match(html, /Continuing contact · CONTACT-X\|Y<br>Z \(C08:CONTACT-X\|Y<br>Z\)/);
  assert.doesNotMatch(html, /<script>/);
});


test('unselected later supplement fills the unique original skipped question and retains stopped count', () => {
  const r = makeRuntimeFixture('stopped');
  const quote = 'The recipient is SYN Merchant C.';
  r.sources.push({ id: 'LATER', kind: 'answer', text: quote });
  r.conversation = { messages: [{ id: 'late', kind: 'supplement', sourceId: 'LATER', questionIds: [], status: 'recorded', recordedFactVersions: Object.fromEntries(r.facts.map(f => [`${f.fieldId}:${f.recordId ?? ''}`, f.version])), updates: [], unresolvedQuotes: [], createdAt: '2026-11-07T00:00:00Z' }] };
  const interaction = { messageId: 'late', sourceId: 'LATER', kind: 'supplement' as const, questionIds: [] };
  const ticket = { caseId: r.caseId, instanceId: r.instanceId, caseVersion: r.version, requestId: 'late', settingsRevision: 1, dependencies: runtimeDependencies(r) };
  const original = r.facts.find(f => f.fieldId === 'E08' && f.recordId === 'TX-01')!;
  const proposed = { ...structuredClone(original), value: 'SYN Merchant C', status: 'extracted' as const, reviewStatus: 'unreviewed' as const, sourceIds: ['LATER'], candidates: [], history: [] };
  const response: AnalysisResponse = { ticket, meta: { implementation: 'test', providerCalled: true, simulated: false }, proposal: { facts: [proposed], analysis: { ...r.analysis, source: 'model', basedOnCaseVersion: r.version }, questions: [] }, resolution: { messageId: 'late', sourceId: 'LATER', answers: [], unresolvedQuotes: [] } };
  const applied = applyResolvedMessage({ record: r, interaction, response }).record;
  assert.equal(applied.followUp.questions.find(q => q.id === 'Q3')!.answer, quote);
  assert.equal(applied.followUp.questions.find(q => q.id === 'Q3')!.history.at(-1)!.status, 'skipped');
  assert.equal(applied.followUp.stopped, true); assert.equal(applied.followUp.totalQuestions, r.followUp.totalQuestions);
  assert.equal(applied.needsFactConfirmation, true);
  assert.deepEqual(applied.conversation!.messages[0].questionIds, ['Q3']);
  const mapped = structuredClone(response); mapped.proposal.facts = []; mapped.resolution!.answers = [{ questionId: 'Q3', target: fixedQuestions[2].target, quote, status: 'answered', value: 'SYN Merchant C' }];
  assert.equal(applyResolvedMessage({ record: r, interaction, response: mapped }).record.followUp.questions[2].answer, quote);
  const ambiguous = structuredClone(response);
  ambiguous.proposal.facts.push({ fieldId: 'G05', value: false, version: 1, status: 'extracted', reviewStatus: 'unreviewed', sourceIds: ['LATER'], candidates: [], history: [] });
  assert.throws(() => applyResolvedMessage({ record: r, interaction, response: ambiguous }), /undifferentiated source/);
  assert.equal(r.followUp.questions[2].status, 'skipped');
});
