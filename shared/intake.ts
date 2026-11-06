import { AnalysisEnvelopeSchema, FactRecordSchema, QuestionSchema, type FactRecord, type Question, type Target } from './schema.js';
import { RuntimeCaseRecordSchema, runtimeDependencies, type RuntimeCaseRecord } from './runtime.js';

const clone = <T>(value: T): T => structuredClone(value);
export const intakeTargetKey = (target: Target) => `${target.fieldId}:${target.recordId ?? ''}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const requiresRecord = (fieldId: string) => /^[CDIJ]/.test(fieldId) || /^E0[2-9]$/.test(fieldId);

const unresolvedFact = (fact: FactRecord) => fact.value === null || ['missing', 'unclear', 'conflict'].includes(fact.status);
function currentAnalysisGaps(record: RuntimeCaseRecord): string[] {
  const legacyFields: Record<string, string> = { 'Transaction time': 'E03', 'Payment method': 'E06', Recipient: 'E08', 'Continuing contact': 'C08' };
  const retained = record.analysis.gaps.filter(gap => {
    const target = /^Unresolved ([A-J]\d{2}):([^\s]*)$/.exec(gap);
    if (target) return !record.facts.some(f => f.fieldId === target[1] && (f.recordId ?? '') === target[2]);
    const field = legacyFields[gap];
    if (!field) return true;
    return !record.facts.some(f => f.fieldId === field);
  });
  return [...new Set([...retained, ...record.facts.filter(unresolvedFact).map(fact => `Unresolved ${intakeTargetKey(fact)}`)])];
}
/** Reconcile fact-derived gaps on updates and when opening older saved cases. */
export function reconcileAnalysisGaps(record: RuntimeCaseRecord): RuntimeCaseRecord {
  const gaps = currentAnalysisGaps(record);
  if (same(gaps, record.analysis.gaps)) return record;
  const next = clone(record);
  next.analysis.gaps = gaps; next.analysis.version++; next.version++; next.saved = false;
  return RuntimeCaseRecordSchema.parse(next);
}


export function addNarrativeSource(record: RuntimeCaseRecord, text: string): { record: RuntimeCaseRecord; sourceId: string } {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Enter the caller’s description before analysis.');
  const existing = [...record.sources].reverse().find(source => source.kind === 'narrative' && source.text === trimmed);
  if (existing) return { record, sourceId: existing.id };
  const narrativeSources = record.sources.filter(source => source.kind === 'narrative');
  if (narrativeSources.length && narrativeSources.map(source => source.text).join('\n\n') === trimmed) return { record, sourceId: narrativeSources[0].id };
  const next = clone(record);
  const sourceId = `SRC-${crypto.randomUUID()}`;
  next.sources.push({ id: sourceId, kind: 'narrative', text: trimmed });
  const narrative = next.facts.find(f => f.fieldId === 'A07');
  if (narrative) {
    narrative.history.push({ value: narrative.value, reason: 'New caller narrative recorded; previous narrative retained in source history.', sourceIds: [...narrative.sourceIds] });
    narrative.value = trimmed; narrative.status = 'extracted'; narrative.reviewStatus = 'unreviewed';
    narrative.sourceIds = [...new Set([...narrative.sourceIds, sourceId])]; narrative.version++;
  } else {
    next.facts.push({ fieldId: 'A07', value: trimmed, version: 1, status: 'extracted', reviewStatus: 'unreviewed', sourceIds: [sourceId], candidates: [], history: [] });
  }
  next.version++;
  next.needsFactConfirmation ||= record.reviews.some(review => review.stage === 'first');
  next.saved = false;
  return { record: RuntimeCaseRecordSchema.parse(next), sourceId };
}

export function mergeRuntimeProposal(record: RuntimeCaseRecord, proposalInput: unknown): RuntimeCaseRecord {
  const proposal = AnalysisEnvelopeSchema.parse(proposalInput);
  const next = clone(record);
  const sourceIds = new Set(next.sources.map(source => source.id));
  for (const incoming of proposal.facts) {
    if (/^[K-P]/.test(incoming.fieldId)) throw new Error(`Analysis cannot propose derived/review field ${incoming.fieldId}.`);
    if (requiresRecord(incoming.fieldId) && !incoming.recordId?.trim()) throw new Error(`${incoming.fieldId} requires a transaction/contact/event record ID.`);
    if (incoming.sourceIds.some(id => !sourceIds.has(id))) throw new Error(`Analysis cited an unknown source for ${incoming.fieldId}.`);
    const parsed = FactRecordSchema.parse(incoming);
    const found = next.facts.find(f => intakeTargetKey(f) === intakeTargetKey(parsed));
    if (!found) {
      next.facts.push({ ...clone(parsed), version: 1, reviewStatus: 'unreviewed', candidates: clone(parsed.candidates), history: clone(parsed.history) });
      continue;
    }
    if (found.reviewStatus === 'corrected') {
      if (!same(found.value, parsed.value) && !found.candidates.some(c => same(c.value, parsed.value) && same(c.sourceIds, parsed.sourceIds))) {
        found.candidates.push({ value: clone(parsed.value), sourceIds: [...parsed.sourceIds] });
        found.status = 'conflict'; found.version++;
      }
    } else if (!same({ value: found.value, status: found.status, sourceIds: found.sourceIds }, { value: parsed.value, status: parsed.status, sourceIds: parsed.sourceIds })) {
      found.value = clone(parsed.value); found.status = parsed.status; found.sourceIds = [...parsed.sourceIds];
      found.candidates = clone(parsed.candidates); found.reviewStatus = 'unreviewed'; found.version++;
    }
  }
  const correctedTypes = record.analysis.reasons.find(reason => reason.startsWith('Employee correction of suspected types:'));
  const incomingAnalysis = clone(proposal.analysis);
  if (correctedTypes) {
    incomingAnalysis.types = [...record.analysis.types];
    incomingAnalysis.reasons = [...new Set([...incomingAnalysis.reasons, correctedTypes])];
    if (!same(proposal.analysis.types, record.analysis.types)) {
      const alternative = `Conflicting type proposal retained: ${proposal.analysis.types.join(', ') || 'insufficient information'}. Employee selection remains current.`;
      if (!incomingAnalysis.alternatives.includes(alternative)) incomingAnalysis.alternatives.push(alternative);
    }
  }
  incomingAnalysis.gaps = currentAnalysisGaps({ ...next, analysis: incomingAnalysis });
  const semantics = (a: RuntimeCaseRecord['analysis']) => ({ types: a.types, reasons: a.reasons, alternatives: a.alternatives, gaps: a.gaps, guidanceStatus: a.guidanceStatus, recommendations: a.recommendations });
  const changed = !same(semantics(next.analysis), semantics(incomingAnalysis)) || !same(next.facts, record.facts);
  if (!changed) return record;
  next.analysis = { ...incomingAnalysis, version: record.analysis.version + 1, facts: [] };
  next.needsFactConfirmation ||= record.reviews.some(review => review.stage === 'first');
  next.version++;
  next.saved = false;
  return RuntimeCaseRecordSchema.parse(next);
}

export function correctRuntimeTypes(record: RuntimeCaseRecord, types: string[], reason: string): RuntimeCaseRecord {
  const selected = [...new Set(types.map(type => type.trim()).filter(Boolean))];
  if (!reason.trim()) throw new Error('Enter a reason for the suspected-type correction.');
  if (same(selected, record.analysis.types)) return record;
  const next = clone(record);
  const sourceId = `CORRECTION-${crypto.randomUUID()}`;
  const text = `Suspected type correction: ${record.analysis.types.join(', ') || 'insufficient information'} → ${selected.join(', ') || 'insufficient information'}. Reason: ${reason.trim()}`;
  next.sources.push({ id: sourceId, kind: 'correction', text });
  next.analysis.reasons.push(`Employee correction of suspected types: ${text}`);
  next.analysis.types = selected;
  next.analysis.version++;
  next.version++; next.saved = false;
  next.needsFactConfirmation ||= next.reviews.some(review => review.stage === 'first');
  return RuntimeCaseRecordSchema.parse(next);
}

export function correctRuntimeFact(record: RuntimeCaseRecord, target: Target, value: FactRecord['value'], reason: string): RuntimeCaseRecord {
  if (!reason.trim()) throw new Error('Enter a reason for the correction.');
  const next = clone(record), fact = next.facts.find(item => intakeTargetKey(item) === intakeTargetKey(target));
  if (!fact) throw new Error('Fact target not found.');
  fact.history.push({ value: clone(fact.value), reason: reason.trim(), sourceIds: [...fact.sourceIds] });
  fact.value = value; fact.reviewStatus = 'corrected'; fact.status = value === null ? 'missing' : 'extracted'; fact.version++;
  const gaps = currentAnalysisGaps(next);
  if (!same(gaps, next.analysis.gaps)) { next.analysis.gaps = gaps; next.analysis.version++; }
  next.version++; next.saved = false;
  next.needsFactConfirmation ||= next.reviews.some(review => review.stage === 'first');
  return RuntimeCaseRecordSchema.parse(next);
}

export function confirmRuntimeFacts(record: RuntimeCaseRecord): RuntimeCaseRecord {
  const next = clone(record);
  next.facts.forEach(fact => { if (fact.reviewStatus !== 'corrected') fact.reviewStatus = 'checked'; });
  next.needsFactConfirmation = false;
  next.version++;
  next.reviews.push({ stage: 'first', objectId: 'facts', objectVersion: next.version, dependencies: { case: next.version, ...runtimeDependencies(next) }, simulated: true, actor: 'MOCK-STAFF', reviewedAt: new Date().toISOString() });
  next.saved = false;
  return RuntimeCaseRecordSchema.parse(next);
}

export function eligibleQuestionProposals(record: RuntimeCaseRecord, questions: Question[]): Question[] {
  if (record.followUp.stopped || record.followUp.rounds >= 3 || record.followUp.totalQuestions >= 9 || record.followUp.questions.some(q => q.status === 'pending')) return [];
  const blocked = new Set(record.followUp.questions.filter(q => ['pending', 'unknown', 'not-applicable', 'skipped'].includes(q.status)).map(q => intakeTargetKey(q.target)));
  const seen = new Set<string>();
  const existingIds = new Set(record.followUp.questions.map(q => q.id));
  const selected = questions.filter(question => {
    const target = intakeTargetKey(question.target);
    if (blocked.has(target) || seen.has(target)) return false;
    seen.add(target); return true;
  }).slice(0, Math.min(3, 9 - record.followUp.totalQuestions));
  let number = record.followUp.totalQuestions + 1;
  return selected.map(question => {
    while (existingIds.has(`Q${number}`)) number++;
    const id = `Q${number++}`; existingIds.add(id);
    return { ...question, id };
  });
}

export function appendSavedQuestionRound(record: RuntimeCaseRecord, questions: Question[]): RuntimeCaseRecord {
  if (!questions.length) return record;
  if (!record.reviews.some(review => review.stage === 'first') || record.needsFactConfirmation) throw new Error('Complete and save the first fact check before asking follow-up questions.');
  const eligible = eligibleQuestionProposals(record, questions);
  if (!eligible.length) throw new Error('No new question can be added; finish the current round or the case limit was reached.');
  const next = clone(record), round = record.followUp.rounds + 1;
  if (round > 3 || next.followUp.totalQuestions + eligible.length > 9) throw new Error('Follow-up limit reached.');
  const normalized = eligible.map(question => QuestionSchema.parse({ ...question, round, status: 'pending', answer: null, history: [] }));
  next.followUp.questions.push(...normalized); next.followUp.rounds = round; next.followUp.totalQuestions += normalized.length;
  next.version++; next.saved = false;
  return RuntimeCaseRecordSchema.parse(next);
}

export function answerRuntimeQuestion(record: RuntimeCaseRecord, questionId: string, answer: string | null, status: 'answered' | 'unknown' | 'not-applicable', updateFact: boolean): RuntimeCaseRecord {
  const next = clone(record), question = next.followUp.questions.find(item => item.id === questionId);
  if (!question) throw new Error('Question not found.');
  if (question.status === 'skipped' && status !== 'answered') throw new Error('A skipped question can only be completed with a later answer.');
  if (status === 'answered' && !answer?.trim()) throw new Error('Enter an answer or choose an unknown state.');
  question.history.push({ answer: question.answer, status: question.status }); question.answer = answer; question.status = status;
  if (status === 'answered') {
    const text = answer!.trim();
    const original = next.sources.find(item => item.id === question.id);
    const sourceId = original && original.text !== text ? `SRC-${crypto.randomUUID()}` : question.id;
    if (!next.sources.some(item => item.id === sourceId)) {
      next.sources.push({ id: sourceId, kind: 'answer', text, target: question.target });
    }
    if (updateFact) {
      const fact = next.facts.find(item => intakeTargetKey(item) === intakeTargetKey(question.target));
      if (!fact) throw new Error('The question target is not present in the fact record; answer saved as source only.');
      const value = parseAnswerValue(fact.fieldId, answer!.trim());
      if (fact.reviewStatus === 'corrected' && !same(fact.value, value)) {
        if (!fact.candidates.some(candidate => same(candidate.value, value) && candidate.sourceIds.includes(sourceId))) fact.candidates.push({ value, sourceIds: [sourceId] });
        fact.status = 'conflict';
      } else {
        fact.history.push({ value: clone(fact.value), reason: `Follow-up answer ${question.id}`, sourceIds: [...fact.sourceIds] });
        fact.value = value; fact.status = value === null ? 'missing' : 'extracted'; fact.sourceIds = [...new Set([...fact.sourceIds, sourceId])];
      }
      fact.version++;
    }
  }
  const gaps = currentAnalysisGaps(next);
  if (!same(gaps, next.analysis.gaps)) { next.analysis.gaps = gaps; next.analysis.version++; }
  if (record.followUp.stopped && status === 'answered' && updateFact) next.needsFactConfirmation = true;
  next.version++; next.saved = false;
  return RuntimeCaseRecordSchema.parse(next);
}

export function endRuntimeFollowUp(record: RuntimeCaseRecord): RuntimeCaseRecord {
  if (record.followUp.stopped) return record;
  const next = clone(record); next.followUp.stopped = true;
  for (const question of next.followUp.questions) if (question.status === 'pending') {
    question.history.push({ answer: question.answer, status: question.status }); question.status = 'skipped';
  }
  next.version++; next.saved = false;
  return RuntimeCaseRecordSchema.parse(next);
}

export function parseAnswerValue(fieldId: string, answer: string): FactRecord['value'] {
  const value = answer.trim();
  if (value === '') return null;
  if (fieldId === 'E04') { const parsed = Number(value.replace(/[,$\s]/g, '')); return Number.isFinite(parsed) && /\d/.test(value) ? parsed : null; }
  if (['C08', 'F01', 'G01', 'G05', 'H08'].includes(fieldId)) {
    if (/^(yes|true|contacted|still active)$/i.test(value)) return true;
    if (/^(no|false|not contacted|ended)$/i.test(value)) return false;
    return null;
  }
  return value;
}
