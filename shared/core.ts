import { CaseRecordSchema, ExportSnapshotSchema, type AnalysisResult, type CaseRecord, type ExportSnapshot, type FactRecord, type OutputRecord, type Question, type ReviewRecord, type Target } from './schema.js';

export const targetKey = (target: Target): string => `${target.fieldId}:${target.recordId ?? ''}`;
export const factDependency = (target: Target): string => `fact:${targetKey(target)}`;
const clone = <T>(value: T): T => structuredClone(value);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const changed = (record: CaseRecord): CaseRecord => ({ ...record, version: record.version + 1, saved: false });

export function currentDependencies(record: CaseRecord): Record<string, number> {
  return { case: record.version, analysis: record.analysis.version, role: record.role.version,
    ...Object.fromEntries(record.facts.map(f => [factDependency(f), f.version])),
    ...Object.fromEntries(record.outputs.map(o => [`output:${o.id}`, o.version])) };
}
export function dependenciesCurrent(record: CaseRecord, dependencies: Record<string, number>): boolean {
  const current = currentDependencies(record);
  return Object.entries(dependencies).every(([key, version]) => current[key] === version);
}
export function isReviewValid(record: CaseRecord, output: OutputRecord): boolean {
  return dependenciesCurrent(record, output.dependencies) && record.reviews.some(review =>
    review.stage === 'final' && review.objectId === output.id && review.objectVersion === output.version &&
    same(review.dependencies, output.dependencies) && dependenciesCurrent(record, review.dependencies));
}
export function correctFact(record: CaseRecord, target: Target, value: FactRecord['value'], reason: string): CaseRecord {
  if (!reason.trim()) throw new Error('A correction reason is required');
  const result = clone(record);
  const fact = result.facts.find(f => targetKey(f) === targetKey(target));
  if (!fact) throw new Error('Unknown fact target');
  fact.history.push({ value: fact.value, reason, sourceIds: [...fact.sourceIds] });
  fact.value = value; fact.reviewStatus = 'corrected'; fact.status = value === null ? 'missing' : 'extracted'; fact.version++;
  result.needsFactConfirmation = result.reviews.some(r => r.stage === 'first');
  return changed(result);
}
export function confirmFacts(record: CaseRecord): CaseRecord {
  const result = clone(record); result.needsFactConfirmation = false;
  result.facts.forEach(f => { if (f.reviewStatus !== 'corrected') f.reviewStatus = 'checked'; });
  result.reviews.push({ stage: 'first', objectId: 'facts', objectVersion: result.version, dependencies: { case: result.version }, simulated: true });
  return { ...result, saved: false };
}
export function mergeAnalysis(record: CaseRecord, incoming: AnalysisResult, requestCaseVersion: number): CaseRecord {
  if (record.version !== requestCaseVersion || incoming.basedOnCaseVersion !== requestCaseVersion) {
    return { ...clone(record), error: { kind: 'stale', message: 'Outdated result ignored; current facts and reviews retained.' } };
  }
  const result = clone(record);
  const knownSources = new Set([...record.facts.flatMap(f => f.sourceIds), ...record.followUp.questions.map(q => q.id)]);
  for (const candidate of incoming.facts) {
    if (/^[AKLMNOP]/.test(candidate.fieldId)) throw new Error('Model cannot replace context, derived outputs or employee review fields');
    if (candidate.sourceIds.some(id => !knownSources.has(id))) throw new Error('Model fact cites an unknown source');
    const existing = result.facts.find(f => targetKey(f) === targetKey(candidate));
    if (!existing) { result.facts.push({ ...clone(candidate), version: 1, reviewStatus: 'unreviewed', candidates: [], history: [] }); continue; }
    if (existing.reviewStatus === 'corrected') {
      if (!same(existing.value, candidate.value) && !existing.candidates.some(c => same(c.value, candidate.value) && same(c.sourceIds, candidate.sourceIds))) {
        existing.candidates.push({ value: candidate.value, sourceIds: candidate.sourceIds }); existing.status = 'conflict'; existing.version++;
      }
    } else if (!same({ value: existing.value, status: existing.status, sourceIds: existing.sourceIds }, { value: candidate.value, status: candidate.status, sourceIds: candidate.sourceIds })) {
      existing.value = clone(candidate.value); existing.status = candidate.status; existing.sourceIds = [...candidate.sourceIds]; existing.version++;
      existing.reviewStatus = 'unreviewed';
    }
  }
  const semantics = (analysis: AnalysisResult) => ({ types: analysis.types, reasons: analysis.reasons, alternatives: analysis.alternatives, gaps: analysis.gaps, guidanceStatus: analysis.guidanceStatus, recommendations: analysis.recommendations });
  const payload = semantics(incoming);
  const previous = semantics(record.analysis);
  if (same(payload, previous) && same(result.facts, record.facts)) return record;
  result.analysis = { ...incoming, version: record.analysis.version + 1, facts: [] };
  result.needsFactConfirmation = record.reviews.some(r => r.stage === 'first');
  return changed(result);
}
export function applyAnalysisResult(record: CaseRecord, incoming: AnalysisResult, ticket: { caseVersion: number; requestId: string }, currentRequestId: string): CaseRecord {
  if (ticket.requestId !== currentRequestId) return { ...clone(record), error: { kind: 'stale', message: 'Superseded request ignored; current state retained.' } };
  return mergeAnalysis(record, incoming, ticket.caseVersion);
}
export function groupAmounts(record: CaseRecord): { groups: { currency: string; status: string; total: number; recordIds: string[] }[]; unknown: { recordId: string; missing: string[] }[] } {
  const ids = [...new Set(record.facts.filter(f => f.fieldId === 'E02' || f.fieldId === 'E04').map(f => f.recordId).filter((id): id is string => !!id))];
  const groups = new Map<string, { currency: string; status: string; total: number; recordIds: string[] }>();
  const unknown: { recordId: string; missing: string[] }[] = [];
  for (const id of ids) {
    const find = (field: string) => record.facts.find(f => f.fieldId === field && f.recordId === id);
    const amount = find('E04'), currency = find('E05'), status = find('E09');
    const missing = [typeof amount?.value !== 'number' || amount.status === 'conflict' ? 'amount' : '', typeof currency?.value !== 'string' || currency.status === 'conflict' ? 'currency' : ''].filter(Boolean);
    if (missing.length) { unknown.push({ recordId: id, missing }); continue; }
    const state = status?.status === 'conflict' ? 'conflict' : typeof status?.value === 'string' ? status.value : 'unknown';
    const key = `${currency!.value}:${state}`;
    const group = groups.get(key) ?? { currency: currency!.value as string, status: state, total: 0, recordIds: [] };
    group.total += amount!.value as number; group.recordIds.push(id); groups.set(key, group);
  }
  return { groups: [...groups.values()], unknown };
}
export function addQuestionRound(record: CaseRecord, questions: Omit<Question, 'round' | 'status' | 'answer' | 'history'>[], displayedAndSaved: boolean): CaseRecord {
  if (!displayedAndSaved) return record;
  if (!questions.length) return record;
  const follow = record.followUp;
  if (record.needsFactConfirmation || !record.reviews.some(r => r.stage === 'first')) throw new Error('Confirm current facts before follow-up');
  if (follow.stopped || follow.rounds >= 3 || questions.length > 3 || follow.totalQuestions + questions.length > 9) throw new Error('Follow-up stopped or question limit reached');
  if (follow.questions.some(q => q.status === 'pending')) throw new Error('Finish current round first');
  if (new Set(questions.map(q => q.id)).size !== questions.length || questions.some(q => follow.questions.some(old => old.id === q.id || targetKey(old.target) === targetKey(q.target) && old.status === 'unknown'))) throw new Error('Duplicate question or unknown target');
  const result = clone(record); result.followUp.rounds++;
  result.followUp.questions.push(...questions.map(q => ({ ...q, round: result.followUp.rounds, status: 'pending' as const, answer: null, history: [] })));
  result.followUp.totalQuestions += questions.length;
  return changed(result);
}
export function answerQuestion(record: CaseRecord, id: string, answer: string | null, status: 'answered' | 'unknown' | 'not-applicable', updates: { target: Target; value: FactRecord['value'] }[] = []): CaseRecord {
  const result = clone(record); const question = result.followUp.questions.find(q => q.id === id);
  if (!question) throw new Error('Unknown question');
  question.history.push({ answer: question.answer, status: question.status }); question.answer = answer; question.status = status;
  for (const update of updates) {
    const fact = result.facts.find(f => targetKey(f) === targetKey(update.target));
    if (!fact) throw new Error('Unknown answer target');
    if (targetKey(update.target) !== targetKey(question.target)) throw new Error('Answer update must match its question target');
    if (status !== 'answered') throw new Error('Unknown answer cannot create a fact value');
    if (fact.reviewStatus === 'corrected' && !same(fact.value, update.value)) {
      fact.candidates.push({ value: update.value, sourceIds: [id] }); fact.status = 'conflict';
    } else { fact.value = update.value; fact.sourceIds = [...new Set([...fact.sourceIds, id])]; fact.status = update.value === null ? 'missing' : 'extracted'; }
    fact.version++;
  }
  result.needsFactConfirmation ||= result.followUp.stopped && updates.length > 0;
  return changed(result);
}
export function stopFollowUp(record: CaseRecord): CaseRecord {
  if (record.followUp.stopped) return record;
  const result = clone(record); result.followUp.stopped = true;
  result.followUp.questions.forEach(q => { if (q.status === 'pending') { q.history.push({ answer: null, status: 'pending' }); q.status = 'skipped'; } });
  return changed(result);
}
export function reviewOutput(record: CaseRecord, objectId: string): CaseRecord {
  const output = record.outputs.find(o => o.id === objectId);
  if (!output || !dependenciesCurrent(record, output.dependencies) || record.needsFactConfirmation || !record.reviews.some(r => r.stage === 'first')) throw new Error('Current output and confirmed facts required');
  if (!record.saved) throw new Error('Save before simulated review');
  const review: ReviewRecord = { stage: 'final', objectId, objectVersion: output.version, dependencies: { ...output.dependencies }, simulated: true };
  return { ...clone(record), reviews: [...record.reviews, review], saved: false };
}
export function replaceOutput(record: CaseRecord, output: OutputRecord): CaseRecord {
  const result = clone(record); const index = result.outputs.findIndex(o => o.id === output.id);
  if (index < 0) result.outputs.push(output); else result.outputs[index] = { ...output, version: result.outputs[index].version + 1 };
  return changed(result);
}
export function markSaved(record: CaseRecord, succeeded: boolean): CaseRecord {
  const result = clone(record); result.saved = succeeded;
  if (succeeded) delete result.error; else result.error = { kind: 'save', message: 'Save failed; current inputs remain on this page.' };
  return result;
}
export function buildSnapshot(record: CaseRecord, objectId: string): ExportSnapshot {
  CaseRecordSchema.parse(record);
  const output = record.outputs.find(o => o.id === objectId);
  if (!record.saved) throw new Error('Unsaved state cannot be exported');
  if (!output || !isReviewValid(record, output) || record.needsFactConfirmation) throw new Error('Current simulated final review required');
  return ExportSnapshotSchema.parse({ caseId: record.caseId, caseVersion: record.version, objectId: output.id,
    objectVersion: output.version, title: output.title, body: output.body, synthetic: true, mode: 'mock', contentApproval: 'pending',
    review: { simulated: true, label: 'Training simulation only' }, dependencies: { ...output.dependencies } });
}
