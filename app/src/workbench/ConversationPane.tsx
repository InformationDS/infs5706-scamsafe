import { useState } from 'react';
import type { RuntimeCaseRecord } from '../../../shared/runtime';
import type { ConfirmedMapping } from '../../../shared/conversation';
import type { Target } from '../../../shared/schema';
import { deriveAnalysisUpdate } from '../../../shared/workbench-case';
import baseline from '../../../data/business/T09.json';

type Props = {
  record: RuntimeCaseRecord; busy: boolean; composer: string; changeComposer: (text: string) => void;
  sendMessage: (ids: string[]) => Promise<void>; retryMessage: (id: string) => Promise<void>;
  markUnknown: (id: string) => Promise<void>; endFollowUp: () => Promise<void>;
  markNotApplicable: (id: string, reason: string) => Promise<boolean>;
  clarifyMessage: (id: string, decisions: ConfirmedMapping[], retained: string[], version: number) => Promise<boolean>;
  resolveEarlierAnswer: (input: { messageId: string; target: Target; candidateSourceId: string; choice: 'keep-current' | 'use-earlier'; reason: string; expectedCaseVersion: number }) => Promise<boolean>;
  reportDraft: (key: string, dirty: boolean) => void;
  otherDrafts: string[]; saveStage: string; localCorrectionPending: boolean;
};
export function ConversationPane(p: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const analysis = p.record.analysisUpdate;
  const interrupted = ['reanalysis', 'follow-up'].includes(analysis?.operation ?? '') && (analysis?.status === 'failed' || (analysis?.status === 'pending' && !p.localCorrectionPending));
  const blocked = p.busy || !!p.saveStage || p.otherDrafts.length > 0;
  return <section aria-label="Case conversation"><h2>Case conversation</h2>
    {!p.record.conversation && (p.record.sources.length || p.record.followUp.questions.length ? <p>Previous conversation unavailable. Existing questions are shown below.</p> : <p>Describe the case to begin.</p>)}
    <p>Limited Mock demonstration supports the listed synthetic examples. Other input needs a configured API.</p>
    {interrupted && <p>Analysis was interrupted or failed. Retry the corresponding analysis before sending another message.</p>}
    <details><summary>Mock examples</summary><p>The debit is pending. The sender has not contacted me again. I do not know the recipient.</p><p>It has stopped.</p><p>The recipient is SYN Merchant C.</p></details>
    {deriveAnalysisUpdate(p.record).blockers.map((b, i) => <p key={`${b.messageId}-${b.reason}-${i}`}>Pending: {b.messageId ?? b.operation} · {b.reason}</p>)}
    {p.record.conversation?.messages.map(m => <article key={m.id} className="conversation-message"><strong>{m.id} · {m.status}</strong><p>{p.record.sources.find(s => s.id === m.sourceId)?.text}</p>
      {m.status === 'needs-clarification' && m.unresolvedQuotes.map(q => <Clarification key={q} {...p} messageId={m.id} quote={q} questionIds={m.questionIds} />)}
      {m.updates.filter(u => u.disposition === 'awaiting-decision').map(u => <EarlierDecision key={u.sourceId} {...p} messageId={m.id} target={u.target} sourceId={u.sourceId} />)}
      {(m.status === 'failed' || m.status === 'recorded') && <button disabled={blocked} onClick={() => void p.retryMessage(m.id)}>Retry {m.id}</button>}
    </article>)}
    {p.record.followUp.questions.length > 0 && <div><h3>Recorded questions</h3>{p.record.followUp.questions.map(q => <article key={q.id}>
      <label><input type="checkbox" checked={selected.includes(q.id)} disabled={blocked} onChange={e => setSelected(old => e.target.checked ? [...old, q.id] : old.filter(id => id !== q.id))} /> {q.id} · {q.text}</label>
      <p>{q.reason} · {q.status}{q.answer ? ` · ${q.answer}` : ''}</p>
      {q.status === 'pending' && <><button disabled={blocked || interrupted} onClick={() => void p.markUnknown(q.id)}>Unknown / unable to answer {q.id}</button><NotApplicable {...p} busy={p.busy || interrupted} questionId={q.id} /></>}
    </article>)}</div>}
    {!p.record.followUp.stopped && p.record.reviews.some(r => r.stage === 'first') && <button disabled={blocked || interrupted} onClick={() => void p.endFollowUp()}>End follow-up</button>}
    <label>Message draft <textarea value={p.composer} disabled={p.busy || !!p.saveStage} onChange={e => p.changeComposer(e.target.value)} /></label>
    {!p.record.conversation?.messages.length && !p.record.facts.some(f => f.fieldId === 'A07') && <button disabled={blocked} onClick={() => p.changeComposer(baseline.input)}>Use T09 example</button>}
    <button disabled={blocked || interrupted || !p.composer.trim()} onClick={() => void p.sendMessage(selected)}>Send</button>
    {p.composer && <button disabled={p.busy || !!p.saveStage} onClick={() => p.changeComposer('')}>Discard message draft</button>}
    {p.otherDrafts.length > 0 && <p>Record or discard other edits before sending: {p.otherDrafts.join(', ')}. {p.otherDrafts.some(k => k.startsWith('fact:')) && <a href="#fact-correction">Go to fact edit</a>}</p>}
  </section>;
}

function Clarification(p: Props & { messageId: string; quote: string; questionIds: string[] }) {
  const [choice, setChoice] = useState(''), [value, setValue] = useState('');
  const key = `clarification:${p.messageId}:${p.quote}`;
  const options = p.record.followUp.questions.filter(q => p.questionIds.includes(q.id) && q.status !== 'skipped');
  const extraFacts = p.record.facts.filter(f => /^[B-J]/.test(f.fieldId));
  const selectedQuestion = options.find(q => q.id === choice);
  const selectedFact = extraFacts.find(f => `fact:${f.fieldId}:${f.recordId ?? ''}` === choice);
  const target = selectedQuestion?.target ?? (selectedFact ? { fieldId: selectedFact.fieldId, ...(selectedFact.recordId ? { recordId: selectedFact.recordId } : {}) } : choice === 'G05' ? { fieldId: 'G05' } : undefined);
  const isBoolean = target && ['C08', 'F01', 'G01', 'G05', 'H08'].includes(target.fieldId);
  async function submit() {
    const status = value === 'unknown' ? 'unknown' : value === 'not-applicable' ? 'not-applicable' : 'answered';
    const mappedValue = status !== 'answered' ? null : isBoolean ? value === 'yes' : target?.fieldId === 'E04' ? Number(value) : value;
    const decisions: ConfirmedMapping[] = target ? [{ ...(selectedQuestion ? { questionId: selectedQuestion.id } : {}), target, quote: p.quote, status, value: mappedValue }] : [];
    p.reportDraft(key, false);
    const saved = await p.clarifyMessage(p.messageId, decisions, choice === 'retain' ? [p.quote] : [], p.record.version);
    if (!saved) p.reportDraft(key, true);
  }
  return <div><p>Needs clarification: “{p.quote}”</p>
    <label>Clarification target <select value={choice} disabled={p.busy || !!p.saveStage} onChange={e => { setChoice(e.target.value); setValue(''); p.reportDraft(key, !!e.target.value); }}><option value="">Choose a target</option>{options.map(q => <option key={q.id} value={q.id}>{q.id} · {q.target.fieldId} {q.target.recordId}</option>)}<option value="G05">G05 · Remote connection</option>{extraFacts.filter(f => f.fieldId !== 'G05').map(f => <option key={`${f.fieldId}:${f.recordId ?? ''}`} value={`fact:${f.fieldId}:${f.recordId ?? ''}`}>Fact {f.fieldId} {f.recordId}</option>)}<option value="retain">Retain as unresolved note</option></select></label>
    {choice && choice !== 'retain' && (isBoolean ? <label>Confirmed value <select value={value} disabled={p.busy || !!p.saveStage} onChange={e => { setValue(e.target.value); p.reportDraft(key, true); }}><option value="">Choose a value</option><option value="no">No</option><option value="yes">Yes</option><option value="unknown">Unknown</option><option value="not-applicable">Not applicable</option></select></label> : <label>Confirmed value <input value={value} disabled={p.busy || !!p.saveStage} onChange={e => { setValue(e.target.value); p.reportDraft(key, true); }} placeholder="Value, unknown or not-applicable" /></label>)}
    <button disabled={p.busy || !!p.saveStage || !choice || (choice !== 'retain' && !value)} onClick={() => void submit()}>Record clarification</button>
    {(choice || value) && <button disabled={p.busy || !!p.saveStage} onClick={() => { setChoice(''); setValue(''); p.reportDraft(key, false); }}>Discard clarification</button>}
  </div>;
}
function EarlierDecision(p: Props & { messageId: string; target: Target; sourceId: string }) {
  const [reason, setReason] = useState(''); const key = `decision:${p.messageId}:${p.sourceId}`;
  const fact = p.record.facts.find(f => f.fieldId === p.target.fieldId && f.recordId === p.target.recordId);
  const candidate = fact?.candidates.find(c => c.sourceIds.includes(p.sourceId));
  async function decide(choice: 'keep-current' | 'use-earlier') { p.reportDraft(key, false); const saved = await p.resolveEarlierAnswer({ messageId: p.messageId, target: p.target, candidateSourceId: p.sourceId, choice, reason, expectedCaseVersion: p.record.version }); if (!saved) p.reportDraft(key, true); }
  return <div><p>Earlier answer · {p.target.fieldId} {p.target.recordId}: current {String(fact?.value)}, earlier {String(candidate?.value)}. Source: {p.record.sources.find(s => s.id === p.sourceId)?.text}</p>
    <label>Decision reason <input value={reason} onChange={e => { setReason(e.target.value); p.reportDraft(key, !!e.target.value); }} /></label>
    <button disabled={p.busy || !!p.saveStage || !reason.trim()} onClick={() => void decide('keep-current')}>Keep current value</button><button disabled={p.busy || !!p.saveStage || !reason.trim()} onClick={() => void decide('use-earlier')}>Use earlier answer</button>
    {reason && <button onClick={() => { setReason(''); p.reportDraft(key, false); }}>Discard decision</button>}
  </div>;
}
function NotApplicable(p: Props & { questionId: string }) {
  const [reason, setReason] = useState(''); const key = `not-applicable:${p.questionId}`;
  async function submit() { p.reportDraft(key, false); if (await p.markNotApplicable(p.questionId, reason)) setReason(''); else p.reportDraft(key, true); }
  return <span><label>Not applicable reason {p.questionId} <input value={reason} disabled={p.busy || !!p.saveStage} onChange={e => { setReason(e.target.value); p.reportDraft(key, !!e.target.value); }} /></label><button disabled={p.busy || !!p.saveStage || !reason.trim()} onClick={() => void submit()}>Mark not applicable {p.questionId}</button></span>;
}
