import { RuntimeCaseRecordSchema, type RuntimeCaseRecord } from './runtime.js';
import { hasPendingMessageQuotes, type AnalysisUpdateState } from './conversation.js';

export function createEmptyRuntimeCase(input: { role: RuntimeCaseRecord['role']; guidelines: RuntimeCaseRecord['guidelines']; caseId: string; instanceId: string; receivedAt: string }): RuntimeCaseRecord {
  if (!input.caseId.trim() || !input.instanceId.trim() || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(input.receivedAt) || !Number.isFinite(Date.parse(input.receivedAt))) throw new Error('Case, instance and timezone-aware received time are required.');
  const context: Array<[string, string | string[]]> = [
    ['A01', input.caseId], ['A02', input.receivedAt], ['A04', input.role.organisation], ['A05', input.role.title], ['A06', input.role.permissions],
  ];
  return RuntimeCaseRecordSchema.parse({
    schemaVersion: 2, synthetic: true, mode: 'mock', contentApproval: 'pending', caseId: input.caseId, instanceId: input.instanceId,
    evaluationId: '', version: 1, stage: 'new', role: input.role, roleRevision: 1, guidanceRevision: 1, guidelines: input.guidelines, guidanceStatus: 'none',
    facts: context.map(([fieldId, value]) => ({ fieldId, value, version: 1, status: 'extracted', reviewStatus: 'unreviewed', sourceIds: [], candidates: [], history: [] })),
    analysis: { version: 1, basedOnCaseVersion: 1, source: 'mock', types: [], reasons: [], alternatives: [], gaps: [], facts: [], guidanceStatus: 'unapproved', recommendations: [] },
    followUp: { rounds: 0, totalQuestions: 0, stopped: false, questions: [] }, sources: [], recommendations: [], outputs: [], reviews: [], saved: false, needsFactConfirmation: false,
  });
}
export type AnalysisActivity = { operation: 'message' | 'clarification' | 'reanalysis' | 'follow-up'; messageId?: string; status: 'pending' | 'failed' | 'completed' };
type Blocker = { messageId?: string; clarificationRevision?: number; operation: AnalysisActivity['operation']; reason: 'recorded' | 'needs-clarification' | 'needs-decision' | 'failed' | 'in-progress' };
export function deriveAnalysisUpdate(record: RuntimeCaseRecord, activity?: AnalysisActivity): { state: AnalysisUpdateState; blockers: Blocker[] } {
  const blockers: Blocker[] = [];
  for (const message of record.conversation?.messages ?? []) {
    const reason = message.status === 'applied' ? undefined : message.status;
    if (reason) blockers.push({ messageId: message.id, operation: 'message', reason });
    if (hasPendingMessageQuotes(message) && reason !== 'needs-clarification') blockers.push({ messageId: message.id, operation: 'message', reason: 'needs-clarification' });
    if (message.updates.some(u => u.disposition === 'awaiting-decision') && reason !== 'needs-decision') blockers.push({ messageId: message.id, operation: 'message', reason: 'needs-decision' });
    for (const clarification of message.clarifications ?? []) if (clarification.status !== 'applied') blockers.push({ messageId: message.id, clarificationRevision: clarification.revision, operation: 'clarification', reason: clarification.status === 'failed' ? 'failed' : 'recorded' });
  }
  const saved = record.analysisUpdate;
  const nonMessage = saved && (saved.operation === 'reanalysis' || saved.operation === 'follow-up') && saved.status !== 'current';
  const completedSaved = activity?.status === 'completed' && activity.operation === saved?.operation && activity.messageId === saved?.messageId;
  if (nonMessage && !completedSaved && !(activity && activity.operation === saved.operation && activity.status === 'pending')) blockers.push({ operation: saved.operation!, reason: 'failed' });
  if (activity && activity.status !== 'completed') blockers.unshift({ operation: activity.operation, ...(activity.messageId ? { messageId: activity.messageId } : {}), reason: activity.status === 'pending' ? 'in-progress' : 'failed' });
  const priority = (b: Blocker) => b.reason === 'in-progress' ? 0 : b.reason === 'failed' ? 1 : 2;
  const first = [...blockers].sort((a, b) => priority(a) - priority(b))[0];
  const state: AnalysisUpdateState = first ? { status: first.reason === 'failed' ? 'failed' : 'pending', operation: first.operation, ...(first.messageId ? { messageId: first.messageId } : {}) } : { status: 'current' };
  return { state, blockers };
}

import type { Target } from './schema.js';
import { answerRuntimeQuestion, correctRuntimeFact, intakeTargetKey } from './intake.js';
import { recalculateGuidance } from './guidance.js';

export function applyRoleSelection(record: RuntimeCaseRecord, role: RuntimeCaseRecord['role']): RuntimeCaseRecord {
  if (JSON.stringify(record.role) === JSON.stringify(role)) return record;
  const next = structuredClone(record);
  next.role = structuredClone(role); next.roleRevision++; next.version++; next.saved = false;
  for (const [fieldId, value] of [['A04', role.organisation], ['A05', role.title], ['A06', role.permissions]] as const) {
    const fact = next.facts.find(f => f.fieldId === fieldId && !f.recordId);
    if (fact && JSON.stringify(fact.value) !== JSON.stringify(value)) {
      fact.history.push({ value: structuredClone(fact.value), reason: 'Role selection changed', sourceIds: [...fact.sourceIds] });
      fact.value = structuredClone(value); fact.version++; fact.status = 'extracted'; fact.reviewStatus = 'unreviewed';
    }
  }
  next.guidanceStatus = 'none';
  return recalculateGuidance(RuntimeCaseRecordSchema.parse(next));
}

export function resolveEarlierMessageTarget(record: RuntimeCaseRecord, input: { messageId: string; target: Target; candidateSourceId: string; choice: 'keep-current' | 'use-earlier'; reason: string; actor: string; expectedCaseVersion: number }): RuntimeCaseRecord {
  if (record.version !== input.expectedCaseVersion || !input.actor.trim() || !input.reason.trim()) throw new Error('Current version, employee identifier and decision reason are required.');
  const original = record.conversation?.messages.find(m => m.id === input.messageId);
  const update = original?.updates.find(u => u.sourceId === input.candidateSourceId && intakeTargetKey(u.target) === intakeTargetKey(input.target) && u.disposition === 'awaiting-decision');
  const fact = record.facts.find(f => intakeTargetKey(f) === intakeTargetKey(input.target));
  const candidate = fact?.candidates.find(c => c.sourceIds.includes(input.candidateSourceId));
  const source = record.sources.find(s => s.id === input.candidateSourceId);
  if (!original || !update || !fact || !candidate || !source) throw new Error('Earlier candidate is no longer available.');
  let next = correctRuntimeFact(record, input.target, input.choice === 'use-earlier' ? candidate.value : fact.value, input.reason.trim(), { messageDecision: true });
  const correctionId = `CORRECTION-${crypto.randomUUID()}`;
  next.sources.push({ id: correctionId, kind: 'correction', target: structuredClone(input.target), text: `Employee ${input.actor.trim()} chose ${input.choice} for ${input.messageId}: ${input.reason.trim()}` });
  const changed = next.facts.find(f => intakeTargetKey(f) === intakeTargetKey(input.target))!;
  changed.sourceIds = [...new Set([...changed.sourceIds, correctionId, ...(input.choice === 'use-earlier' ? [input.candidateSourceId] : [])])];
  if (input.choice === 'use-earlier' && update.questionId) next = answerRuntimeQuestion(next, update.questionId, source.text, 'answered', false, { value: candidate.value, sourceId: source.id });
  const message = next.conversation!.messages.find(m => m.id === input.messageId)!;
  const stored = message.updates.find(u => u.sourceId === input.candidateSourceId && intakeTargetKey(u.target) === intakeTargetKey(input.target) && u.disposition === 'awaiting-decision')!;
  stored.disposition = input.choice === 'keep-current' ? 'kept-current' : 'adopted-earlier';
  stored.decision = { choice: input.choice, actor: input.actor.trim(), reason: input.reason.trim() };
  stored.appliedFactVersion = next.facts.find(f => intakeTargetKey(f) === intakeTargetKey(input.target))!.version;
  message.status = message.updates.some(u => u.disposition === 'awaiting-decision') ? 'needs-decision' : 'recorded';
  next.analysisUpdate = deriveAnalysisUpdate(next).state;
  return RuntimeCaseRecordSchema.parse(next);
}

import { AnalysisEnvelopeSchema, FactRecordSchema, type FactRecord } from './schema.js';
import { MessageIntentSchema, type MessageIntent } from './conversation.js';
import { parseAnalysisResponseForRequest, type AnalysisResponse } from './module-ports.js';
import { ticketCurrent } from './runtime.js';
import { mergeRuntimeProposal } from './intake.js';
import { refreshRuntimeGaps } from './case-gaps.js';

/** Applies one complete, validated message response to a clone. It never saves or requests a model. */
export function applyResolvedMessage(input: { record: RuntimeCaseRecord; response: AnalysisResponse; interaction: MessageIntent }): { record: RuntimeCaseRecord; updatedQuestionIds: string[] } {
  const record = RuntimeCaseRecordSchema.parse(input.record), interaction = MessageIntentSchema.parse(input.interaction);
  const response = parseAnalysisResponseForRequest({ case: record, ticket: input.response.ticket, interaction }, input.response);
  const messageIndex = record.conversation?.messages.findIndex(m => m.id === interaction.messageId) ?? -1;
  const originalMessage = record.conversation?.messages[messageIndex];
  const originalSource = record.sources.find(s => s.id === interaction.sourceId);
  if (!originalMessage || !originalSource || originalMessage.sourceId !== interaction.sourceId || originalMessage.kind !== interaction.kind) throw new Error('Message intent does not refer to a recorded message.');
  const clarification = interaction.clarification;
  const savedClarification = clarification && originalMessage.clarifications?.find(c => c.revision === clarification.revision);
  if (clarification && (!savedClarification || savedClarification.sourceId !== clarification.sourceId || JSON.stringify(savedClarification.decisions) !== JSON.stringify(clarification.decisions) || JSON.stringify(savedClarification.retainedQuotes) !== JSON.stringify(clarification.retainedQuotes))) throw new Error('Clarification is absent or differs from the recorded decision.');
  const resolution = response.resolution!;
  if (clarification) {
    const handled = new Set([...clarification.decisions.map(decision => decision.quote), ...clarification.retainedQuotes]);
    if (originalMessage.unresolvedQuotes.some(quote => !handled.has(quote) && !resolution.unresolvedQuotes.includes(quote))) throw new Error('Clarification response omitted another unresolved quote.');
  }
  if ((!clarification && originalMessage.status === 'applied' && !hasPendingMessageQuotes(originalMessage) && !originalMessage.updates.some(u => u.disposition === 'awaiting-decision') && !originalMessage.clarifications?.some(c => c.status !== 'applied')) || savedClarification?.status === 'applied') return { record: input.record, updatedQuestionIds: [] };
  if (!ticketCurrent(record, response.ticket, response.ticket.requestId, response.ticket.settingsRevision)) throw new Error('Stale message response.');
  if (originalMessage.status === 'needs-decision' || originalMessage.updates.some(u => u.disposition === 'awaiting-decision')) throw new Error('Resolve the existing earlier-message decision first.');
  if (response.proposal.analysis.basedOnCaseVersion !== response.ticket.caseVersion) throw new Error('Analysis was not based on the current case version.');
  if (record.followUp.questions.some(q => q.status === 'pending') && response.proposal.questions.length) throw new Error('A pending round cannot be replaced by new questions.');
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const knownQuestionIds = new Set(interaction.questionIds);
  const uniqueProcessedQuestion = (target: Target) => {
    const matches = record.followUp.questions.filter(q => intakeTargetKey(q.target) === intakeTargetKey(target));
    return matches.length === 1 && ['answered', 'unknown', 'skipped'].includes(matches[0].status) ? matches[0] : undefined;
  };
  if (new Set(interaction.questionIds).size !== interaction.questionIds.length || interaction.questionIds.some(id => !originalMessage.questionIds.includes(id) || !record.followUp.questions.some(q => q.id === id))) throw new Error('Invalid interaction question reference.');
  if (resolution.answers.length > 1 && resolution.answers.filter(answer => answer.quote === originalSource.text).length > 1) throw new Error('The entire message cannot be reused as multiple answers.');
  const seenTargets = new Set<string>(), seenQuestions = new Set<string>();
  for (const answer of resolution.answers) {
    const question = record.followUp.questions.find(q => q.id === answer.questionId);
    const key = intakeTargetKey(answer.target);
    if (!question || (!knownQuestionIds.has(answer.questionId) && uniqueProcessedQuestion(answer.target)?.id !== answer.questionId) || intakeTargetKey(question.target) !== key || !originalSource.text.includes(answer.quote) || seenQuestions.has(answer.questionId) || seenTargets.has(key)) throw new Error('Invalid answer mapping.');
    seenQuestions.add(answer.questionId); seenTargets.add(key);
  }
  for (const observation of resolution.observations ?? []) {
    const key = intakeTargetKey(observation.target);
    if (seenTargets.has(key) || !originalSource.text.includes(observation.quote) || record.followUp.questions.some(q => intakeTargetKey(q.target) === key)) throw new Error('Invalid unknown observation.');
    seenTargets.add(key);
  }
  if (resolution.unresolvedQuotes.some(q => !originalSource.text.includes(q) || resolution.answers.some(a => a.quote === q) || (resolution.observations ?? []).some(o => o.quote === q))) throw new Error('Invalid or already mapped unresolved quote.');
  if (clarification) {
    for (const decision of clarification.decisions) {
      if (!originalMessage.unresolvedQuotes.includes(decision.quote) || originalMessage.updates.some(u => intakeTargetKey(u.target) === intakeTargetKey(decision.target) && u.disposition !== 'awaiting-decision')) throw new Error('Clarification must address a previously unresolved target and quote.');
      if (decision.questionId) {
        const match = resolution.answers.find(a => a.questionId === decision.questionId);
        if (!match || !same(match, decision)) throw new Error('Clarified answer differs from the employee decision.');
      } else if (decision.status === 'unknown') {
        if (!(resolution.observations ?? []).some(o => intakeTargetKey(o.target) === intakeTargetKey(decision.target) && o.quote === decision.quote)) throw new Error('Clarified unknown observation is missing.');
      } else if (decision.status === 'answered') {
        if (!response.proposal.facts.some(f => intakeTargetKey(f) === intakeTargetKey(decision.target) && same(f.value, decision.value) && f.sourceIds.includes(clarification.sourceId))) throw new Error('Clarified fact differs from the employee decision.');
      } else if (!response.proposal.facts.some(f => intakeTargetKey(f) === intakeTargetKey(decision.target) && f.value === null && f.status === 'not-applicable' && f.sourceIds.includes(clarification.sourceId))) throw new Error('Clarified not-applicable fact is missing.');
    }
    if (clarification.retainedQuotes.some(q => !originalMessage.unresolvedQuotes.includes(q))) throw new Error('Retained quote was not awaiting clarification.');
    if (resolution.answers.some(a => !clarification.decisions.some(d => d.questionId === a.questionId && same(d, a))) || (resolution.observations ?? []).some(o => !clarification.decisions.some(d => !d.questionId && d.status === 'unknown' && intakeTargetKey(d.target) === intakeTargetKey(o.target) && d.quote === o.quote))) throw new Error('Clarification contains an unconfirmed mapping.');
    if (clarification.retainedQuotes.some(q => resolution.answers.some(a => a.quote === q) || (resolution.observations ?? []).some(o => o.quote === q))) throw new Error('Retained quote cannot become a fact.');
  }
  const factsByKey = new Map<string, FactRecord>();
  for (const fact of response.proposal.facts) {
    const key = intakeTargetKey(fact);
    if (factsByKey.has(key)) throw new Error('Duplicate proposal target.');
    if (fact.sourceIds.some(id => !record.sources.some(s => s.id === id))) throw new Error('Proposal cites an unknown source.');
    factsByKey.set(key, fact);
    const answer = resolution.answers.find(a => intakeTargetKey(a.target) === key);
    if ((answer && (answer.status === 'unknown' || !same(answer.value, fact.value) || (answer.status === 'not-applicable' && fact.status !== 'not-applicable'))) || (resolution.observations ?? []).some(o => intakeTargetKey(o.target) === key)) throw new Error('Fact proposal conflicts with answer or unknown observation.');
    if (interaction.kind === 'supplement' && fact.value === null && !(fact.status === 'not-applicable' && clarification?.decisions.some(d => d.status === 'not-applicable' && intakeTargetKey(d.target) === key && fact.sourceIds.includes(clarification.sourceId)))) throw new Error('A supplemental unknown must be recorded as an observation, not a fact proposal.');
    const existing = record.facts.find(f => intakeTargetKey(f) === key);
    if (existing?.value !== null && existing && fact.value === null) throw new Error('A message cannot silently clear a known fact.');
  }
  let next = structuredClone(record);
  let message = next.conversation!.messages[messageIndex];
  const updatedQuestionIds: string[] = [];
  let awaitingDecision = false;
  const alreadyApplied = (key: string, quote: string) => message.updates.some(u => intakeTargetKey(u.target) === key && next.sources.find(s => s.id === u.sourceId)?.text === quote && u.disposition !== 'awaiting-decision');
  const addQuote = (target: Target, quote: string) => {
    const existing = message.updates.find(u => intakeTargetKey(u.target) === intakeTargetKey(target) && next.sources.find(s => s.id === u.sourceId)?.text === quote);
    if (existing) return existing.sourceId;
    const id = `SRC-${crypto.randomUUID()}`;
    next.sources.push({ id, kind: 'answer', text: quote, target: structuredClone(target) });
    return id;
  };
  const laterMessage = (target: Target) => next.conversation!.messages.slice(messageIndex + 1).find(m => m.updates.some(u => intakeTargetKey(u.target) === intakeTargetKey(target) && (u.disposition === 'current' || u.disposition === 'adopted-earlier')));
  const compare = (target: Target, value: FactRecord['value'], quote: string, questionId?: string): boolean => {
    const fact = next.facts.find(f => intakeTargetKey(f) === intakeTargetKey(target));
    const newer = laterMessage(target);
    const recordedVersion = originalMessage.recordedFactVersions?.[intakeTargetKey(target)] ?? (originalMessage.recordedFactVersions ? 0 : undefined);
    const changed = !!fact && (newer !== undefined || recordedVersion === undefined || fact.version !== recordedVersion);
    if (!fact || !changed) return false;
    const sourceId = addQuote(target, quote);
    if (same(fact.value, value)) {
      message.updates.push({ ...(questionId ? { questionId } : {}), target: structuredClone(target), sourceId, outcome: 'answered', disposition: 'historical', ...(newer ? { supersededByMessageId: newer.id } : {}) });
    } else {
      if (!fact.candidates.some(c => same(c.value, value) && c.sourceIds.includes(sourceId))) fact.candidates.push({ value: structuredClone(value), sourceIds: [sourceId] });
      fact.status = 'conflict'; fact.version++; next.version++; next.saved = false;
      message.updates.push({ ...(questionId ? { questionId } : {}), target: structuredClone(target), sourceId, outcome: 'conflict', disposition: 'awaiting-decision', ...(newer ? { supersededByMessageId: newer.id } : {}) });
      awaitingDecision = true;
    }
    return true;
  };
  for (const answer of resolution.answers) {
    const key = intakeTargetKey(answer.target);
    if (alreadyApplied(key, answer.quote)) continue;
    if (!message.questionIds.includes(answer.questionId)) message.questionIds.push(answer.questionId);
    if (answer.status === 'not-applicable' && !clarification?.decisions.some(d => d.questionId === answer.questionId && same(d, answer))) throw new Error('Not applicable requires an explicit employee decision.');
    if (answer.status === 'not-applicable' && next.facts.find(f => intakeTargetKey(f) === key)?.value != null) throw new Error('Use explicit fact correction to change a known value.');
    if (answer.status === 'not-applicable' && next.facts.find(f => intakeTargetKey(f) === key)?.reviewStatus === 'corrected') throw new Error('Use explicit fact correction to change an employee correction.');
    if (answer.status === 'answered' && compare(answer.target, answer.value, answer.quote, answer.questionId)) continue;
    const sourceId = addQuote(answer.target, answer.quote);
    if (answer.status === 'answered' && !next.facts.some(f => intakeTargetKey(f) === key)) {
      next.facts.push(FactRecordSchema.parse({ ...answer.target, value: null, version: 1, status: 'missing', reviewStatus: 'unreviewed', sourceIds: [], candidates: [], history: [] }));
    }
    next = answerRuntimeQuestion(next, answer.questionId, answer.quote, answer.status, answer.status === 'answered', { value: answer.value, sourceId });
    message = next.conversation!.messages[messageIndex];
    let fact = next.facts.find(f => intakeTargetKey(f) === key);
    if (answer.status === 'not-applicable') {
      if (!fact) { fact = FactRecordSchema.parse({ ...answer.target, value: null, version: 1, status: 'not-applicable', reviewStatus: 'unreviewed', sourceIds: [sourceId], candidates: [], history: [] }); next.facts.push(fact); }
      else { fact.status = 'not-applicable'; fact.reviewStatus = 'unreviewed'; fact.sourceIds = [...new Set([...fact.sourceIds, sourceId])]; fact.version++; }
    }
    const outcome = answer.status === 'answered' && fact?.status === 'conflict' && !same(fact.value, answer.value) ? 'conflict' : answer.status;
    message.updates.push({ questionId: answer.questionId, target: structuredClone(answer.target), sourceId, outcome, ...((answer.status === 'answered' || answer.status === 'not-applicable') ? { disposition: 'current', appliedFactVersion: fact!.version } : {}) });
    updatedQuestionIds.push(answer.questionId);
  }
  for (const observation of resolution.observations ?? []) {
    const key = intakeTargetKey(observation.target);
    if (alreadyApplied(key, observation.quote)) continue;
    const sourceId = addQuote(observation.target, observation.quote);
    if (!next.facts.some(f => intakeTargetKey(f) === key)) {
      if (observation.target.recordId && !next.facts.some(f => f.recordId === observation.target.recordId)) throw new Error('Unknown observation cannot invent a repeated record.');
      next.facts.push(FactRecordSchema.parse({ ...observation.target, value: null, version: 1, status: 'missing', reviewStatus: 'unreviewed', sourceIds: [sourceId], candidates: [], history: [] }));
    }
    message.updates.push({ target: structuredClone(observation.target), sourceId, outcome: 'unknown' });
  }
  const extraFacts: FactRecord[] = [];
  const extraUpdates: Array<{ fact: FactRecord; sourceId: string }> = [];
  for (const fact of response.proposal.facts) {
    const key = intakeTargetKey(fact);
    if (resolution.answers.some(a => intakeTargetKey(a.target) === key)) continue;
    const prior = next.facts.find(f => intakeTargetKey(f) === key);
    const source = fact.sourceIds.map(id => next.sources.find(s => s.id === id)).find(s => s && s.text.trim() && (originalSource.text.includes(s.text) || s.id === clarification?.sourceId));
    if (!source && prior && same(prior.value, fact.value) && prior.status === fact.status) continue; // Unchanged context, not a new observation.
    if (!source && interaction.kind === 'initial' && fact.value === null && ['missing', 'unclear'].includes(fact.status) && (!fact.recordId || next.facts.some(f => f.recordId === fact.recordId) || response.proposal.facts.some(f => f.recordId === fact.recordId && f.value !== null && f.sourceIds.length))) {
      extraFacts.push(fact); // Empty placeholders are not attributed as a positive observation.
      continue;
    }
    if (!source) throw new Error('Additional fact lacks evidence in the message.');
    const quote = source.id === clarification?.sourceId ? clarification.decisions.find(d => intakeTargetKey(d.target) === key)?.quote : source.text;
    if (!quote) throw new Error('Additional fact has no confirmed quote.');
    if (alreadyApplied(key, quote)) continue;
    if (clarification && !clarification.decisions.some(d => !d.questionId && intakeTargetKey(d.target) === key && same(d.value, fact.value))) throw new Error('Clarification proposed an unconfirmed fact.');
    const targetQuestions = record.followUp.questions.filter(q => intakeTargetKey(q.target) === key);
    if (targetQuestions.some(q => q.status === 'pending')) throw new Error('A pending question must be mapped by its question ID.');
    if (targetQuestions.length > 1 && targetQuestions.some(q => ['answered', 'unknown', 'skipped'].includes(q.status))) throw new Error('Multiple historical questions require clarification.');
    const previousQuestion = uniqueProcessedQuestion(fact);
    if (previousQuestion && fact.value !== null && fact.status === 'extracted') {
      if (source.id === originalSource.id && response.proposal.facts.filter(candidate => candidate.sourceIds.includes(source.id) && (!record.facts.some(old => intakeTargetKey(old) === intakeTargetKey(candidate) && same(old.value, candidate.value) && old.status === candidate.status))).length > 1) throw new Error('Multiple targets share an undifferentiated source; clarify their evidence.');
      if (!message.questionIds.includes(previousQuestion.id)) message.questionIds.push(previousQuestion.id);
      if (compare(fact, fact.value, quote, previousQuestion.id)) continue;
      const quoteSourceId = addQuote(fact, quote);
      if (!next.facts.some(f => intakeTargetKey(f) === key)) next.facts.push(FactRecordSchema.parse({ ...previousQuestion.target, value: null, version: 1, status: 'missing', reviewStatus: 'unreviewed', sourceIds: [], candidates: [], history: [] }));
      next = answerRuntimeQuestion(next, previousQuestion.id, quote, 'answered', true, { value: fact.value, sourceId: quoteSourceId });
      message = next.conversation!.messages[messageIndex];
      const actual = next.facts.find(f => intakeTargetKey(f) === key)!;
      message.updates.push({ questionId: previousQuestion.id, target: structuredClone(previousQuestion.target), sourceId: quoteSourceId, outcome: actual.status === 'conflict' && !same(actual.value, fact.value) ? 'conflict' : 'answered', disposition: 'current', appliedFactVersion: actual.version });
      updatedQuestionIds.push(previousQuestion.id);
      continue;
    }
    if (compare(fact, fact.value, quote)) continue;
    const quoteSourceId = addQuote(fact, quote);
    extraFacts.push({ ...fact, sourceIds: [...new Set([...(prior?.sourceIds ?? []), ...fact.sourceIds, quoteSourceId])] });
    extraUpdates.push({ fact, sourceId: quoteSourceId });
  }
  if (!awaitingDecision || extraFacts.length) {
    const proposal = AnalysisEnvelopeSchema.parse({ ...response.proposal, analysis: awaitingDecision ? next.analysis : response.proposal.analysis, facts: extraFacts });
    next = mergeRuntimeProposal(next, proposal, { origin: interaction.kind === 'initial' ? 'initial' : (!next.followUp.stopped && resolution.answers.length ? 'follow-up' : 'direct') });
  }
  next = refreshRuntimeGaps(next, { origin: awaitingDecision ? 'local' : 'analysis' });
  message = next.conversation!.messages[messageIndex];
  for (const update of extraUpdates) {
    const actual = next.facts.find(f => intakeTargetKey(f) === intakeTargetKey(update.fact))!;
    message.updates.push({ target: { fieldId: update.fact.fieldId, ...(update.fact.recordId ? { recordId: update.fact.recordId } : {}) }, sourceId: update.sourceId, outcome: actual.status === 'conflict' ? 'conflict' : 'answered', disposition: 'current', appliedFactVersion: actual.version });
  }
  if (!awaitingDecision && clarification) message.clarifications!.find(c => c.revision === clarification.revision)!.status = 'applied';
  message = next.conversation!.messages[messageIndex];
  message.unresolvedQuotes = resolution.unresolvedQuotes.filter(q => !clarification?.retainedQuotes.includes(q));
  message.status = awaitingDecision ? 'needs-decision' : message.unresolvedQuotes.length ? 'needs-clarification' : 'applied';
  next.version++; next.saved = false;
  next = recalculateGuidance(next);
  next.analysisUpdate = deriveAnalysisUpdate(next, { operation: clarification ? 'clarification' : 'message', messageId: message.id, status: 'completed' }).state;
  return { record: RuntimeCaseRecordSchema.parse(next), updatedQuestionIds };
}
