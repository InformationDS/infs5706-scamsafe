import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRuntimeFixture } from '../shared/runtime-fixtures.js';
import { fixedQuestions } from '../shared/fixtures.js';
import { correctRuntimeFact, correctRuntimeTypes, eligibleQuestionProposals, intakeTargetKey, mergeRuntimeProposal, parseAnswerValue, confirmRuntimeFacts, appendSavedQuestionRound, answerRuntimeQuestion, endRuntimeFollowUp } from '../shared/intake.js';
import { AnalysisEnvelopeSchema } from '../shared/schema.js';
import { runtimeDependencies, ticketCurrent } from '../shared/runtime.js';

test('re-reading the source retains an employee correction and records a conflicting candidate', () => {
  const start = makeRuntimeFixture('T09');
  const corrected = correctRuntimeFact(start, { fieldId: 'E04', recordId: 'TX-01' }, 200, 'Caller clarified amount');
  const amount = structuredClone(corrected.facts.find(fact => fact.fieldId === 'E04' && fact.recordId === 'TX-01')!);
  amount.value = 2000; amount.status = 'extracted'; amount.reviewStatus = 'unreviewed'; amount.sourceIds = ['S3'];
  const proposal = AnalysisEnvelopeSchema.parse({ facts: [amount], analysis: { ...structuredClone(corrected.analysis), types: ['Suspected phishing', 'Payment fraud'] }, questions: [] });
  const merged = mergeRuntimeProposal(corrected, proposal);
  const fact = merged.facts.find(item => item.fieldId === 'E04' && item.recordId === 'TX-01')!;
  assert.equal(fact.value, 200);
  assert.equal(fact.reviewStatus, 'corrected');
  assert.equal(fact.candidates.some(candidate => candidate.value === 2000 && candidate.sourceIds.includes('S3')), true);
  assert.equal(fact.history.some(item => item.value === 2000), true);
});

test('transaction targets remain keyed by field and record; unknown stays null', () => {
  assert.notEqual(intakeTargetKey({ fieldId: 'E04', recordId: 'TX-01' }), intakeTargetKey({ fieldId: 'E04', recordId: 'TX-02' }));
  assert.equal(parseAnswerValue('E04', 'not sure'), null);
  assert.equal(parseAnswerValue('C08', 'not sure'), null);
});

test('a proposal started before a 250 correction is stale when its delayed response returns', () => {
  const start = makeRuntimeFixture('T09');
  const ticket = { caseId: start.caseId, instanceId: start.instanceId, caseVersion: start.version, requestId: 'old-analysis', settingsRevision: 1, dependencies: runtimeDependencies(start) };
  const current = correctRuntimeFact(start, { fieldId: 'E04', recordId: 'TX-01' }, 250, 'Updated while analysis was pending');
  assert.equal(current.facts.find(fact => fact.fieldId === 'E04' && fact.recordId === 'TX-01')?.value, 250);
  assert.equal(ticketCurrent(current, ticket, ticket.requestId, ticket.settingsRevision), false);
});

test('employee type correction survives later analysis and preserves the conflicting type proposal', () => {
  const checked = confirmRuntimeFacts(makeRuntimeFixture('T09'));
  const corrected = correctRuntimeTypes(checked, ['Suspected romance scam', 'Suspected phishing'], 'Caller described both relationship and bank impersonation contact');
  const proposal = AnalysisEnvelopeSchema.parse({ facts: [], analysis: { ...structuredClone(corrected.analysis), types: ['Suspected investment scam'], alternatives: [] }, questions: [] });
  const merged = mergeRuntimeProposal(corrected, proposal);
  assert.deepEqual(merged.analysis.types, ['Suspected romance scam', 'Suspected phishing']);
  assert.equal(merged.analysis.reasons.some(reason => reason.includes('Caller described both')), true);
  assert.equal(merged.analysis.alternatives.some(reason => reason.includes('Suspected investment scam')), true);
  assert.equal(merged.needsFactConfirmation, true);
});

test('follow-up questions require first check, remain target-specific, and obey the 3/9 cap', () => {
  const firstChecked = confirmRuntimeFacts(makeRuntimeFixture('T09'));
  assert.equal(appendSavedQuestionRound(firstChecked, []).followUp.rounds, 0);
  const round = appendSavedQuestionRound(firstChecked, fixedQuestions);
  assert.equal(round.followUp.rounds, 1);
  assert.equal(round.followUp.totalQuestions, 3);
  assert.equal(round.followUp.questions.length, 3);

  const partlyProcessed = answerRuntimeQuestion(round, 'Q1', 'The app says pending.', 'answered', false);
  const noRecipient = answerRuntimeQuestion(partlyProcessed, 'Q3', 'Not applicable', 'not-applicable', false);
  const unknown = answerRuntimeQuestion(noRecipient, 'Q2', 'Unknown / unable to answer', 'unknown', false);
  const repeatedUnknown = { ...fixedQuestions[1], id: 'Q4' };
  const anotherTransaction = { ...fixedQuestions[0], id: 'Q5', target: { fieldId: 'E09', recordId: 'TX-02' } };
  assert.deepEqual(eligibleQuestionProposals(unknown, [repeatedUnknown, anotherTransaction]).map(q => q.id), ['Q4']);
  assert.equal(eligibleQuestionProposals(makeRuntimeFixture('limit'), [anotherTransaction]).length, 0);
});

test('ending follow-up skips pending questions and accepts a later answer without reopening or recounting', () => {
  const checked = confirmRuntimeFacts(makeRuntimeFixture('T09'));
  const started = appendSavedQuestionRound({ ...checked, saved: true }, fixedQuestions);
  const partial = answerRuntimeQuestion(started, 'Q1', 'The app says pending.', 'answered', true);
  const ended = endRuntimeFollowUp(partial);
  assert.equal(ended.followUp.questions.find(q => q.id === 'Q2')?.status, 'skipped');
  assert.equal(ended.followUp.questions.find(q => q.id === 'Q3')?.status, 'skipped');
  const later = answerRuntimeQuestion(ended, 'Q3', 'Recipient is SYN Person X.', 'answered', true);
  assert.equal(later.followUp.stopped, true);
  assert.equal(later.followUp.rounds, 1);
  assert.equal(later.followUp.totalQuestions, 3);
  assert.equal(later.followUp.questions.find(q => q.id === 'Q3')?.status, 'answered');
  assert.equal(later.needsFactConfirmation, true);
  assert.equal(later.sources.find(source => source.id === 'Q3')?.kind, 'answer');
});
