import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRuntimeFixture } from '../shared/runtime-fixtures';
import { RuntimeCaseRecordSchema, dependenciesValid, runtimeReviewValid } from '../shared/runtime';
import { activeRecommendations, actionableRecommendations, changeGuidanceContext, decideRecommendation, evaluateGuidance, guidanceHandoff, NO_GUIDANCE, recalculateGuidance, recommendationEdited } from '../shared/guidance';

test('T09 matches approved facts and source context; generated decisions start pending', () => {
  const r = makeRuntimeFixture('T09'), result = evaluateGuidance(r);
  assert.equal(result.guidanceStatus, 'available');
  assert.deepEqual(result.matches.map(m => [m.id, m.matched]), [['EX-G01', true], ['EX-G02', true], ['EX-G03', true]]);
  assert.deepEqual(result.recommendations.map(r => r.id), ['REC-01', 'REC-02', 'REC-03']);
  assert.ok(result.recommendations.every(r => r.decision === 'pending' && !r.simulated));
  assert.match(result.recommendations[0].limits.join(' '), /E09:TX-01: unknown/);
  assert.match(result.recommendations[1].priority.reason, /parallel/);
  assert.match(result.recommendations[2].priority.reason, /lower priority/);
  assert.ok(RuntimeCaseRecordSchema.safeParse(recalculateGuidance(r)).success);
});

test('repeated matching and unchanged package reload do not create new versions or review requirements', () => {
  const r = recalculateGuidance(makeRuntimeFixture('T09'));
  assert.equal(recalculateGuidance(r), r);
  assert.equal(changeGuidanceContext(r, 'reload-guidance'), r);
});

test('reject REC-03, recalculate and reload preserve its ID, reason, history and all facts', () => {
  const r = recalculateGuidance(makeRuntimeFixture('unknown'));
  const rejected = decideRecommendation(r, 'REC-03', 'rejected', { actor: 'TEST-EMPLOYEE', reason: 'Duplicate information.' });
  const recalculated = recalculateGuidance(rejected);
  assert.equal(recalculated, rejected);
  assert.deepEqual(recalculated.facts, r.facts);
  assert.deepEqual(recalculated.followUp, r.followUp);
  assert.deepEqual(recalculated.reviews, r.reviews);
  assert.equal(recalculated.recommendations.find(r => r.id === 'REC-03')?.decisionReason, 'Duplicate information.');
  assert.equal(recalculated.recommendations.find(r => r.id === 'REC-03')?.history.length, 1);
  assert.ok(!actionableRecommendations(recalculated).some(r => r.id === 'REC-03'));
  assert.equal(changeGuidanceContext(recalculated, 'reload-guidance'), recalculated);
});

test('rejection invalidates only outputs depending on the changed recommendation', () => {
  let r = recalculateGuidance(makeRuntimeFixture('output-error'));
  const rec = r.recommendations.find(r => r.id === 'REC-03')!;
  rec.decision = 'pending'; rec.decisionReason = null;
  // Model an E-produced output with exact recommendation dependencies, not the broad A01 mock snapshot.
  r.outputs.forEach(o => { o.dependencies = Object.fromEntries((o.recommendationIds ?? []).map(id => [`recommendation:${id}`, r.recommendations.find(x => x.id === id)!.version])); });
  r.reviews = r.reviews.filter(v => v.stage === 'first');
  for (const o of r.outputs) r.reviews.push({ stage: 'final', objectId: o.id, objectVersion: o.version, dependencies: { ...o.dependencies }, simulated: true, actor: 'MOCK-STAFF', reviewedAt: '2026-10-17T00:00:00.000Z' });
  assert.equal(runtimeReviewValid(r, 'HANDOVER-BANK', true), true);
  r = decideRecommendation(r, 'REC-03', 'rejected', { actor: 'TEST-EMPLOYEE', reason: 'Already included.' });
  assert.equal(runtimeReviewValid(r, 'HANDOVER-BANK', true), true);
  assert.equal(runtimeReviewValid(r, 'HANDOVER-TELCO', true), false);
  assert.deepEqual(guidanceHandoff(r).outputsToRefresh, ['HANDOVER-TELCO']);
});

test('employee editing retains original content and survives acceptance and recomputation', () => {
  let r = recalculateGuidance(makeRuntimeFixture('T09'));
  const original = r.recommendations[0].step;
  r = decideRecommendation(r, 'REC-01', 'modified', { actor: 'TEST-EMPLOYEE', reason: 'Clarify local preparation.', step: 'Prepare a local note for human assessment with uncertainties.' });
  assert.equal(JSON.parse(r.recommendations[0].history[0].previous).step, original);
  r = decideRecommendation(r, 'REC-01', 'accepted', { actor: 'TEST-EMPLOYEE' });
  assert.equal(recommendationEdited(r.recommendations[0]), true);
  assert.equal(recalculateGuidance(r).recommendations[0].step, 'Prepare a local note for human assessment with uncertainties.');
  assert.equal(r.reviews.filter(v => v.stage === 'final' && !v.simulated).length, 0);
});

test('decision validation requires actor, reasons and current basis', () => {
  const r = recalculateGuidance(makeRuntimeFixture('T09'));
  assert.throws(() => decideRecommendation(r, 'REC-01', 'accepted', { actor: '' }), /identifier/);
  assert.throws(() => decideRecommendation(r, 'REC-01', 'rejected', { actor: 'TEST' }), /reason/);
  assert.throws(() => decideRecommendation(r, 'REC-01', 'modified', { actor: 'TEST', reason: 'Changed' }), /text/);
  const stale = changeGuidanceContext(r, 'suspend-guidance');
  assert.throws(() => decideRecommendation(stale, 'REC-01', 'accepted', { actor: 'TEST' }), /Recalculate/);
});

for (const status of ['conflict', 'not-applicable'] as const) test(`${status} E09 omits only EX-G01`, () => {
  const r = makeRuntimeFixture('T09'), f = r.facts.find(f => f.fieldId === 'E09')!;
  f.status = status;
  const result = evaluateGuidance(r);
  assert.deepEqual(result.recommendations.map(r => r.id), ['REC-02', 'REC-03']);
  assert.ok(result.matches[0].reasons.some(reason => reason.includes(status)));
});

test('completed debit, unapproved bank and missing required SMS are not filled from type labels', () => {
  const r = makeRuntimeFixture('unknown');
  r.facts.find(f => f.fieldId === 'E09')!.value = 'reported completed';
  assert.deepEqual(evaluateGuidance(r).recommendations.map(r => r.id), ['REC-02', 'REC-03']);
  r.facts.find(f => f.fieldId === 'C03')!.value = null;
  assert.equal(evaluateGuidance(r).summaryOnly, true);
  r.facts.find(f => f.fieldId === 'E09')!.value = 'reported pending';
  r.facts.find(f => f.fieldId === 'E07')!.value = 'Some other bank';
  assert.equal(evaluateGuidance(r).summaryOnly, true);
});

test('provider context and SMS clue sources are individually necessary', () => {
  const r = makeRuntimeFixture('T09');
  r.sources.find(s => s.id === 'S4')!.text = 'The sender claims to work at SYN Telco B.';
  assert.deepEqual(evaluateGuidance(r).recommendations.map(r => r.id), ['REC-01', 'REC-03']);
  r.facts.find(f => f.fieldId === 'J02')!.sourceIds = [];
  assert.deepEqual(evaluateGuidance(r).recommendations.map(r => r.id), ['REC-01']);
  r.facts.find(f => f.fieldId === 'F06')!.sourceIds = [];
  assert.equal(evaluateGuidance(r).summaryOnly, true);
});

test('altered, unapproved, expired and duplicate definitions never authorise steps', () => {
  for (const patch of [{ contentApproval: 'pending' }, { enabled: false }, { validity: 'expired' }, { step: 'Freeze funds' }, { version: 2 }]) {
    const r = makeRuntimeFixture('T09');
    Object.assign(r.guidelines[0], patch); // Deliberately malformed negative input to the pure evaluator.
    assert.deepEqual(evaluateGuidance(r).recommendations.map(r => r.id), ['REC-02', 'REC-03']);
  }
  const r = makeRuntimeFixture('T09');
  r.guidelines.push(structuredClone(r.guidelines[0]));
  assert.deepEqual(evaluateGuidance(r).recommendations.map(r => r.id), ['REC-02', 'REC-03']);
});

test('restricted permissions and guidance changes retain facts, first-review history and question counts', () => {
  const initial = recalculateGuidance(makeRuntimeFixture('unknown'));
  const restricted = changeGuidanceContext(initial, 'suspend-role');
  assert.equal(activeRecommendations(restricted).length, 0);
  assert.equal(restricted.guidanceStatus, 'none');
  assert.deepEqual(restricted.facts, initial.facts);
  assert.deepEqual(restricted.followUp, initial.followUp);
  assert.deepEqual(restricted.reviews, initial.reviews);
  const restored = changeGuidanceContext(restricted, 'restore-role');
  assert.equal(activeRecommendations(restored).length, 3);
  const suspended = changeGuidanceContext(restored, 'suspend-guidance');
  assert.equal(activeRecommendations(suspended).length, 0);
  assert.equal(recalculateGuidance(suspended).guidanceStatus, 'stale');
  assert.equal(activeRecommendations(changeGuidanceContext(suspended, 'reload-guidance')).length, 3);
});

test('a fact version update invalidates only recommendations depending on it', () => {
  const r = recalculateGuidance(makeRuntimeFixture('unknown'));
  r.facts.find(f => f.fieldId === 'E04')!.version++;
  assert.equal(dependenciesValid(r, r.recommendations[0].dependencies), false);
  assert.equal(dependenciesValid(r, r.recommendations[1].dependencies), true);
  assert.equal(dependenciesValid(r, r.recommendations[2].dependencies), true);
  const next = recalculateGuidance(r);
  assert.equal(next.recommendations[0].version, r.recommendations[0].version + 1);
  assert.equal(next.recommendations[1].version, r.recommendations[1].version);
});

test('no-guidance has fixed message and summary-only eligibility without recipients or fabricated actions', () => {
  const r = makeRuntimeFixture('no-guidance'), result = evaluateGuidance(r);
  assert.equal(NO_GUIDANCE, 'Insufficient approved guidance; human review required');
  assert.equal(result.summaryOnly, true);
  assert.deepEqual(result.recommendations, []);
  assert.deepEqual(guidanceHandoff(r).recommendations, []);
  assert.deepEqual(recalculateGuidance(r).outputs, r.outputs);
});

test('rejected records remain historical during loss and restoration of guidance', () => {
  let r = recalculateGuidance(makeRuntimeFixture('unknown'));
  r = decideRecommendation(r, 'REC-03', 'rejected', { actor: 'TEST', reason: 'Duplicate.' });
  r = changeGuidanceContext(r, 'suspend-guidance');
  assert.equal(actionableRecommendations(r).length, 0);
  r = changeGuidanceContext(r, 'reload-guidance');
  assert.equal(r.recommendations.filter(x => x.id === 'REC-03').length, 1);
  assert.equal(r.recommendations.find(x => x.id === 'REC-03')!.decision, 'rejected');
  assert.ok(!actionableRecommendations(r).some(x => x.id === 'REC-03'));
});
