import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AnalysisEnvelopeSchema, CaseRecordSchema, GuidelineSchema, HandoverDraftSchema, RecommendationSchema, SummarySchema, addQuestionRound, answerQuestion, applyAnalysisResult, buildSnapshot, confirmFacts, correctFact, factDependency, fixtureNames, groupAmounts, isReviewValid, makeFixture, markSaved, mergeAnalysis, replaceOutput, stopFollowUp, type FactRecord } from '../shared/index.js';

test('all fixed states validate without business approval or enabled roles', () => {
  for (const name of fixtureNames) {
    const record = CaseRecordSchema.parse(makeFixture(name));
    assert.equal(record.contentApproval, 'pending'); assert.equal(record.role.enabled, false);
    assert.equal(record.mode, 'mock');
  }
  assert.throws(() => CaseRecordSchema.parse({ ...makeFixture(), facts: [{ ...makeFixture().facts[0], fieldId: 'E99' }] }));
  assert.throws(() => AnalysisEnvelopeSchema.parse({ facts: [], analysis: makeFixture().analysis, questions: [], role: {} }));
  const guidelines = JSON.parse(readFileSync('data/guidelines/example-guidelines.pending.json', 'utf8'));
  for (const guideline of guidelines) { assert.equal(GuidelineSchema.parse(guideline).enabled, false); assert.ok(guideline.requiredContext.length); }
});

test('case entrypoints require complete handovers and a configured teaching recipient', () => {
  const record = makeFixture('handover');
  const bank = record.outputs.find(output => output.kind === 'handover')!;
  const withBank = (output: typeof bank) => ({ ...record, outputs: record.outputs.map(old => old.id === bank.id ? output : old) });
  assert.throws(() => CaseRecordSchema.parse(withBank({ ...bank, recipient: undefined })));
  assert.throws(() => CaseRecordSchema.parse(withBank({ ...bank, recommendationIds: undefined })));
  assert.throws(() => CaseRecordSchema.parse(withBank({ ...bank, recipient: { id: 'UNCONFIGURED', title: 'Unconfigured receiver' } })));
  assert.throws(() => buildSnapshot(withBank({ ...bank, recipient: undefined }), bank.id));
  assert.equal(CaseRecordSchema.parse(record).outputs.length, 3);
});
test('single-case fact semantics reject wrong types and missing record targets while preserving false versus unknown', () => {
  const record = makeFixture();
  const amount = record.facts.find(f => f.fieldId === 'E04')!;
  const contact = record.facts.find(f => f.fieldId === 'C08')!;
  const withFact = (fact: FactRecord) => ({ ...record, facts: record.facts.filter(f => f.fieldId !== fact.fieldId || f.recordId !== fact.recordId).concat(fact) });
  assert.throws(() => CaseRecordSchema.parse(withFact({ ...amount, value: true })));
  assert.throws(() => CaseRecordSchema.parse(withFact({ ...amount, value: Infinity })));
  assert.throws(() => CaseRecordSchema.parse(withFact({ ...amount, candidates: [{ value: '200', sourceIds: ['S3'] }] })));
  assert.throws(() => CaseRecordSchema.parse(withFact({ ...contact, value: 'No' })));
  assert.throws(() => CaseRecordSchema.parse(withFact({ ...amount, recordId: undefined })));
  assert.throws(() => CaseRecordSchema.parse(withFact({ ...record.facts.find(f => f.fieldId === 'E05')!, value: 123 })));
  assert.throws(() => CaseRecordSchema.parse({ ...record, facts: [...record.facts, { ...amount, fieldId: 'O01' }] }));
  const negative = CaseRecordSchema.parse(withFact({ ...contact, value: false }));
  const unknown = CaseRecordSchema.parse(withFact({ ...contact, value: null }));
  assert.equal(negative.facts.find(f => f.fieldId === 'C08')!.value, false);
  assert.equal(unknown.facts.find(f => f.fieldId === 'C08')!.value, null);
  assert.equal(CaseRecordSchema.parse(withFact({ ...amount, value: 0 })).facts.find(f => f.fieldId === 'E04')!.value, 0);
});
test('manual amount correction is preserved as model conflict and history survives', () => {
  const record = makeFixture('corrected');
  const amount = record.facts.find(f => f.fieldId === 'E04')!;
  const proposed = { ...structuredClone(amount), value: 2000, reviewStatus: 'corrected' as const, history: [] };
  const result = mergeAnalysis(record, { ...record.analysis, basedOnCaseVersion: record.version, facts: [proposed] }, record.version);
  const updated = result.facts.find(f => f.fieldId === 'E04')!;
  assert.equal(updated.value, 200); assert.equal(updated.status, 'conflict'); assert.equal(updated.history[0].value, 2000);
  assert.equal(updated.candidates[0].value, 2000); assert.equal(amount.status, 'extracted');
});
test('model cannot impersonate employee review or invent source references', () => {
  const record = makeFixture(); const existing = record.facts.find(f => f.fieldId === 'C04')!;
  const incoming = { ...record.analysis, facts: [{ ...existing, value: 'New claim', reviewStatus: 'corrected' as const, history: [{ value: 'fake', reason: 'fake employee', sourceIds: [] }] }] };
  const result = mergeAnalysis(record, incoming, record.version);
  const fact = result.facts.find(f => f.fieldId === 'C04')!;
  assert.equal(fact.reviewStatus, 'unreviewed'); assert.deepEqual(fact.history, []);
  assert.throws(() => mergeAnalysis(record, { ...incoming, facts: [{ ...existing, sourceIds: ['INVENTED'] }] }, record.version));
  assert.throws(() => mergeAnalysis(record, { ...incoming, facts: [{ ...existing, fieldId: 'A06' }] }, record.version));
});
test('equal analysis with changed request provenance does not change content or review', () => {
  const record = makeFixture('reviewed');
  const result = mergeAnalysis(record, { ...record.analysis, source: 'model', basedOnCaseVersion: record.version }, record.version);
  assert.equal(result, record); assert.equal(isReviewValid(result, result.outputs[0]), true);
});
test('unknown amount is separate; independent transactions group by currency and state', () => {
  const record = makeFixture('corrected');
  const original = record.facts.filter(f => f.recordId === 'TX-01');
  const second = original.map(f => ({ ...structuredClone(f), recordId: 'TX-02', value: f.fieldId === 'E02' ? 'TX-02' : f.fieldId === 'E04' ? 50 : f.fieldId === 'E05' ? 'USD' : f.value }));
  const third = original.map(f => ({ ...structuredClone(f), recordId: 'TX-03', value: f.fieldId === 'E02' ? 'TX-03' : f.fieldId === 'E04' ? null : f.value }));
  record.facts.push(...second, ...third);
  const totals = groupAmounts(record);
  assert.deepEqual(totals.groups.map(g => [g.currency, g.status, g.total]), [['AUD', 'unknown', 200], ['USD', 'unknown', 50]]);
  assert.deepEqual(totals.unknown, [{ recordId: 'TX-03', missing: ['amount'] }]);
  const updated = correctFact(record, { fieldId: 'E04', recordId: 'TX-02' }, 60, 'Second transaction only');
  assert.equal(updated.facts.find(f => f.fieldId === 'E04' && f.recordId === 'TX-01')?.value, 200);
});
test('partial answer retains round; stop and later answer update original without new count', () => {
  const partial = makeFixture('partial'); assert.equal(partial.followUp.rounds, 1); assert.equal(partial.followUp.totalQuestions, 3);
  assert.throws(() => addQuestionRound(partial, [{ id: 'Q4', target: { fieldId: 'E03', recordId: 'TX-01' }, text: 'When?', reason: 'Time' }], true));
  const stopped = stopFollowUp(partial); assert.equal(stopped.followUp.questions[1].status, 'skipped');
  const updated = answerQuestion(stopped, 'Q3', 'Recipient-SYN', 'answered', [{ target: { fieldId: 'E08', recordId: 'TX-01' }, value: 'Recipient-SYN' }]);
  assert.equal(updated.followUp.stopped, true); assert.equal(updated.followUp.totalQuestions, 3); assert.equal(updated.followUp.questions[2].history.at(-1)?.status, 'skipped');
  assert.equal(updated.needsFactConfirmation, true);
  assert.throws(() => addQuestionRound(updated, [{ id: 'Q4', target: { fieldId: 'E03', recordId: 'TX-01' }, text: 'When?', reason: 'Time' }], true));
});
test('rounds require display and save and enforce 3 per round, 3 rounds, 9 total', () => {
  let record = markSaved(confirmFacts(makeFixture()), true);
  const questions = (round: number) => ['E03', 'E06', 'E08'].map((fieldId, i) => ({ id: `R${round}Q${i}`, target: { fieldId, recordId: 'TX-01' }, text: 'Fixed test question', reason: 'Test boundary' }));
  assert.equal(addQuestionRound(record, questions(1), false), record);
  for (let round = 1; round <= 3; round++) {
    record = addQuestionRound(record, questions(round), true);
    for (const q of record.followUp.questions.filter(q => q.status === 'pending')) record = answerQuestion(record, q.id, 'Not applicable', 'not-applicable');
  }
  assert.equal(record.followUp.rounds, 3); assert.equal(record.followUp.totalQuestions, 9);
  assert.throws(() => addQuestionRound(record, questions(4), true));
});
test('dependency invalidation is per object and old reviews remain as history', () => {
  const record = makeFixture('handover'); const summary = record.outputs[0];
  const changed = replaceOutput(record, { ...record.outputs[1], body: 'Changed bank teaching text' });
  assert.equal(isReviewValid(changed, changed.outputs[1]), false);
  assert.equal(isReviewValid(changed, summary), true); assert.equal(isReviewValid(changed, changed.outputs[2]), true);
  assert.equal(changed.reviews.length, record.reviews.length);
  const amountChanged = correctFact(record, { fieldId: 'E04', recordId: 'TX-01' }, 250, 'Updated reported amount');
  assert.ok(amountChanged.outputs.every(o => !isReviewValid(amountChanged, o)));
});
test('snapshot gate blocks unsaved, stale review, modified body and requires explicit simulated marker', () => {
  assert.throws(() => buildSnapshot(makeFixture('no-guidance'), 'SUMMARY'));
  assert.throws(() => buildSnapshot(makeFixture('save-error'), 'SUMMARY'));
  assert.throws(() => buildSnapshot(markSaved(makeFixture('stale'), true), 'SUMMARY'));
  const valid = makeFixture('reviewed'); const snapshot = buildSnapshot(valid, 'SUMMARY');
  assert.equal(snapshot.contentApproval, 'pending'); assert.equal(snapshot.review.label, 'Training simulation only');
  assert.equal(snapshot.body, valid.outputs[0].body);
  assert.throws(() => buildSnapshot(markSaved(replaceOutput(valid, { ...valid.outputs[0], body: 'Changed' }), true), 'SUMMARY'));
});
test('old case and superseded same-version requests cannot overwrite facts or reviews', () => {
  const record = makeFixture('reviewed');
  const outdated = mergeAnalysis(record, { ...record.analysis, facts: [] }, record.version - 1);
  assert.deepEqual(outdated.facts, record.facts); assert.deepEqual(outdated.reviews, record.reviews); assert.equal(outdated.error?.kind, 'stale');
  const superseded = applyAnalysisResult(record, record.analysis, { caseVersion: record.version, requestId: 'old' }, 'new');
  assert.deepEqual(superseded.outputs, record.outputs); assert.equal(superseded.error?.kind, 'stale');
});
test('summary and handover contracts keep recipient and recommendation boundaries explicit', () => {
  const record = makeFixture('handover');
  assert.equal(SummarySchema.parse(record.outputs[0]).kind, 'summary');
  for (const draft of record.outputs.slice(1)) {
    assert.ok(HandoverDraftSchema.parse(draft).recipient.title);
    assert.deepEqual(draft.recommendationIds, []);
    assert.throws(() => HandoverDraftSchema.parse({ ...draft, recipient: undefined }));
  }
  const invalid = structuredClone(record); invalid.outputs[1].recommendationIds = ['MISSING'];
  assert.throws(() => CaseRecordSchema.parse(invalid));
  assert.throws(() => CaseRecordSchema.parse({ ...record, outputs: [{ ...record.outputs[0], recipient: record.outputs[1].recipient }] }));
});
test('recommendation schema requires traceable simulated decisions without enabling business content', () => {
  const recommendation = { id: 'REC-TEST', version: 1, responsibleRole: 'EX-ROLE-01', step: 'Unapproved structural test only',
    priority: { order: 1, reason: 'Schema validation test' }, dependencies: {}, factRefs: [{ fieldId: 'E04', recordId: 'TX-01' }],
    guidelineRefs: [{ id: 'EX-G01', version: 1 }], limits: ['Not approved'], decision: 'rejected', decisionReason: 'Testing rejection reason', simulated: true, contentApproval: 'pending' };
  const parsed = RecommendationSchema.parse(recommendation);
  assert.equal(parsed.contentApproval, 'pending');
  assert.throws(() => RecommendationSchema.parse({ ...recommendation, simulated: false }));
  assert.throws(() => RecommendationSchema.parse({ ...recommendation, decisionReason: null }));
  const record = makeFixture('handover'); record.recommendations = [parsed]; record.outputs[1].recommendationIds = [parsed.id];
  CaseRecordSchema.parse(record);
  record.recommendations[0].factRefs[0].recordId = 'MISSING-TX';
  assert.throws(() => CaseRecordSchema.parse(record));
});
