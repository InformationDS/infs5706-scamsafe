import baseline from '../../data/business/T09.json';
import { makeRuntimeFixture } from '../../shared/runtime-fixtures.js';
import { fixedQuestions } from '../../shared/fixtures.js';
import { currentFactGaps } from '../../shared/case-gaps.js';
import { FactRecordSchema, type FactRecord, type Target } from '../../shared/schema.js';
import type { AnalysisRequest } from '../../shared/module-ports.js';
import type { MessageResolution } from '../../shared/conversation.js';

const normalize = (s: string) => s.replaceAll('\r\n', '\n').trim();
const key = (target: Target) => `${target.fieldId}:${target.recordId ?? ''}`;
export class UnsupportedWorkbenchMock extends Error {}
const unsupported = () => new UnsupportedWorkbenchMock('This Mock demo supports the listed examples. Use a configured API for other synthetic input.');
export const limitedMockExamples = ['The debit is pending.', 'reported pending', 'The debit is completed.', 'The debit is pending. The sender has not contacted me again. I do not know the recipient.', 'The debit is pending. It has stopped.', 'It has stopped.', 'The recipient is SYN Merchant C.'] as const;
export function hasExactT09Sources(input: AnalysisRequest): boolean {
  const record = input.case;
  const first = record.conversation?.messages.find(m => m.kind === 'initial');
  const source = first && record.sources.find(s => s.id === first.sourceId);
  const paragraphs = baseline.input.replaceAll('\r\n', '\n').split('\n\n');
  if (!source || normalize(source.text) !== normalize(baseline.input)) return false;
  if (!paragraphs.every((text, i) => record.sources.some(s => s.id === `S${i+1}` && s.kind === 'narrative' && normalize(s.text) === normalize(text)))) return false;
  return record.sources.filter(s => s.kind === 'narrative').every(s => s.id === source.id || paragraphs.some((text, i) => s.id === `S${i+1}` && normalize(s.text) === normalize(text)));
}
export function isExactT09Initial(input: AnalysisRequest): boolean {
  return input.interaction?.kind === 'initial' && hasExactT09Sources(input) && input.case.conversation?.messages.find(m => m.kind === 'initial')?.id === input.interaction.messageId;
}
function analysis(input: AnalysisRequest, facts: FactRecord[], notes: string[] = []) {
  const r = input.case;
  const base = isExactT09Initial(input) ? makeRuntimeFixture('T09').analysis : r.analysis;
  return { ...structuredClone(base), version: r.analysis.version, basedOnCaseVersion: r.version, source: 'mock' as const, facts: [], guidanceStatus: 'unapproved' as const, recommendations: [] as never[], gaps: [...currentFactGaps({ ...r, facts }).map(g => `Unresolved ${key(g.target)}`), ...notes] };
}
function question(input: AnalysisRequest, target: Target) {
  const q = input.case.followUp.questions.find(q => key(q.target) === key(target) && input.interaction!.questionIds.includes(q.id));
  if (!q) throw unsupported();
  return q;
}
export function limitedWorkbenchMock(input: AnalysisRequest): { proposal: unknown; resolution?: MessageResolution } {
  if (!hasExactT09Sources(input)) throw unsupported();
  const r = input.case;
  const facts = structuredClone(r.facts);
  if (!input.interaction) {
    if (!input.purpose) throw unsupported();
    const proposals: FactRecord[] = [];
    if (input.purpose === 'case-reanalysis') {
      const amount = r.facts.find(f => f.fieldId === 'E04' && f.recordId === 'TX-01');
      if (amount) proposals.push({ ...structuredClone(amount), value: 2000, status: 'extracted', sourceIds: ['S3'], reviewStatus: 'unreviewed', history: [], candidates: [] });
    }
    const follow = r.followUp;
    const questions = input.purpose === 'follow-up' && !follow.stopped && follow.rounds < 3 && !follow.questions.some(q => q.status === 'pending') ? fixedQuestions.filter(q => !follow.questions.some(old => key(old.target) === key(q.target))).slice(0, 9 - follow.totalQuestions).map(q => ({ ...structuredClone(q), round: follow.rounds + 1 })) : [];
    return { proposal: { facts: proposals, analysis: analysis(input, facts), questions } };
  }
  const intent = input.interaction;
  const message = r.conversation?.messages.find(m => m.id === intent.messageId);
  const source = r.sources.find(s => s.id === intent.sourceId);
  if (!message || !source) throw unsupported();
  const resolution: MessageResolution = { messageId: intent.messageId, sourceId: intent.sourceId, answers: [], unresolvedQuotes: [] };
  const proposed: FactRecord[] = [];
  if (isExactT09Initial(input)) {
    const fixed = makeRuntimeFixture('T09');
    proposed.push(...fixed.facts.filter(f => /^[B-J]/.test(f.fieldId)).map(f => ({ ...structuredClone(f), version: r.facts.find(old => key(old) === key(f))?.version ?? 1, reviewStatus: 'unreviewed' as const, history: [], candidates: [] })));
    const combined = [...facts.filter(f => !proposed.some(p => key(p) === key(f))), ...proposed];
    const questions = !r.followUp.stopped && !r.followUp.questions.length && !r.followUp.rounds ? fixedQuestions : [];
    return { proposal: { facts: proposed, analysis: analysis(input, combined), questions }, resolution };
  }
  if (intent.kind !== 'supplement') throw unsupported();
  if (intent.clarification) {
    if (!['It has stopped.', 'The debit is pending. It has stopped.'].includes(normalize(source.text)) || [...intent.clarification.decisions.map(d => d.quote), ...intent.clarification.retainedQuotes].some(quote => quote !== 'It has stopped.')) throw unsupported();
    resolution.clarificationRevision = intent.clarification.revision;
    for (const decision of intent.clarification.decisions) {
      if (decision.questionId) resolution.answers.push({ ...decision, questionId: decision.questionId });
      else if (decision.status === 'unknown') (resolution.observations ??= []).push({ target: decision.target, quote: decision.quote, status: 'unknown' });
      else {
        const old = facts.find(f => key(f) === key(decision.target));
        proposed.push(FactRecordSchema.parse({ ...decision.target, value: decision.value, version: old?.version ?? 1, status: decision.status === 'not-applicable' ? 'not-applicable' : 'extracted', reviewStatus: 'unreviewed', sourceIds: [intent.clarification.sourceId], candidates: [], history: [] }));
      }
    }
  } else {
    const text = normalize(source.text);
    const pending = () => { const q = question(input, { fieldId: 'E09', recordId: 'TX-01' }); resolution.answers.push({ questionId: q.id, target: q.target, quote: text === 'reported pending' ? text : 'The debit is pending.', status: 'answered', value: 'reported pending' }); };
    const completed = () => { const q = question(input, { fieldId: 'E09', recordId: 'TX-01' }); resolution.answers.push({ questionId: q.id, target: q.target, quote: 'The debit is completed.', status: 'answered', value: 'reported completed' }); };
    if (text === 'The debit is pending.' || text === 'reported pending') pending();
    else if (text === 'The debit is completed.') completed();
    else if (text === 'The debit is pending. The sender has not contacted me again. I do not know the recipient.') {
      pending(); const contact = question(input, { fieldId: 'C08', recordId: 'CONTACT-01' }), recipient = question(input, { fieldId: 'E08', recordId: 'TX-01' });
      resolution.answers.push({ questionId: contact.id, target: contact.target, quote: 'The sender has not contacted me again.', status: 'answered', value: false }, { questionId: recipient.id, target: recipient.target, quote: 'I do not know the recipient.', status: 'unknown', value: null });
    } else if (text === 'The debit is pending. It has stopped.') { pending(); resolution.unresolvedQuotes.push('It has stopped.'); }
    else if (text === 'It has stopped.') resolution.unresolvedQuotes.push(text);
    else if (text === 'The recipient is SYN Merchant C.') { const q = question(input, { fieldId: 'E08', recordId: 'TX-01' }); resolution.answers.push({ questionId: q.id, target: q.target, quote: text, status: 'answered', value: 'SYN Merchant C' }); }
    else throw unsupported();
  }
  for (const answer of resolution.answers) {
    if (answer.status !== 'answered') continue;
    const fact = facts.find(f => key(f) === key(answer.target));
    if (fact && fact.reviewStatus !== 'corrected') { fact.value = answer.value; fact.status = 'extracted'; }
  }
  const notes = intent.clarification?.retainedQuotes.map(quote => `Unresolved reported detail: ${quote}`) ?? [];
  return { proposal: { facts: proposed, analysis: analysis(input, facts, notes), questions: [] }, resolution };
}
