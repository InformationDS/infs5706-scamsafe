import { useEffect, useRef, useState } from 'react';
import type { AnalysisResponse, ModuleProps } from '../../../../shared/module-ports';
import { runtimeDependencies, ticketCurrent, type RuntimeCaseRecord } from '../../../../shared/runtime';
import './style.css';

type Context = { settingsRevision: number; modelRegistered: boolean };
async function context(): Promise<Context> {
  const response = await fetch('/api/runtime/context');
  if (!response.ok) throw new Error('CONTEXT_UNAVAILABLE');
  const value = await response.json();
  if (!Number.isInteger(value.settingsRevision) || typeof value.modelRegistered !== 'boolean') throw new Error('CONTEXT_UNAVAILABLE');
  return value;
}
const messages: Record<string, string> = {
  MODEL_TIMEOUT: 'Analysis timed out. Your input and saved case are unchanged. Retry when ready.',
  MODEL_INVALID_OUTPUT: 'The provider returned an invalid analysis. Your input and saved case are unchanged.',
  MODEL_NOT_CONFIGURED: 'Complete and save the model API settings on this page before real analysis.',
  MODEL_CONNECTION_ERROR: 'The provider could not be reached. Check the API settings and retry.',
  MODEL_SERVICE_ERROR: 'The provider rejected the request. Check the API settings or retry later.',
  MOCK_INPUT_UNSUPPORTED: 'Mock accepts the fixed T09 narrative only. Configure a real API for another synthetic narrative.',
  STALE_REQUEST: 'Stale response ignored. The case or model settings changed; analyze the current case again.',
  MODULE_NOT_READY: 'The model service is not registered. Restart the local service.',
};
export default function ModelModule({ record, ports, onError }: ModuleProps) {
  const current = useRef(record); current.current = record;
  const active = useRef(true), requestId = useRef('');
  const [busy, setBusy] = useState(false), [result, setResult] = useState<AnalysisResponse | null>(null);
  const [message, setMessage] = useState('Ready. Analysis creates proposals for employee checking.');
  const [invalidated, setInvalidated] = useState(false);
  const [failed, setFailed] = useState(false);
  const [resultCase, setResultCase] = useState<RuntimeCaseRecord | null>(null);
  useEffect(() => {
    active.current = true;
    const changed = () => { requestId.current = ''; setInvalidated(true); setBusy(false); setMessage('Model settings changed. Analyze again to obtain a current proposal.'); };
    window.addEventListener('scamsafe:model-settings-saved', changed);
    return () => { active.current = false; requestId.current = ''; window.removeEventListener('scamsafe:model-settings-saved', changed); };
  }, []);
  async function analyze() {
    const id = crypto.randomUUID(); requestId.current = id;
    const before = structuredClone(current.current);
    setBusy(true); setFailed(false); setMessage('Analyzing… Your input and existing results are retained.');
    try {
      const initial = await context();
      if (!active.current || requestId.current !== id) return;
      if (!initial.modelRegistered) throw new Error('MODULE_NOT_READY');
      const ticket = { caseId: before.caseId, instanceId: before.instanceId, caseVersion: before.version, requestId: id, settingsRevision: initial.settingsRevision, dependencies: runtimeDependencies(before) };
      if (!ticketCurrent(current.current, ticket, id, initial.settingsRevision)) throw new Error('STALE_REQUEST');
      const next = await ports.analyze({ case: before, ticket, previewMock: false });
      const latest = await context();
      if (!active.current || requestId.current !== id) return;
      if (JSON.stringify(next.ticket) !== JSON.stringify(ticket) || !ticketCurrent(current.current, next.ticket, id, latest.settingsRevision)) throw new Error('STALE_REQUEST');
      setResult(next); setResultCase(before); setInvalidated(false);
      setMessage('Analysis ready — proposals only. No facts, reviews or question counts were changed.');
    } catch (error) {
      if (!active.current || requestId.current !== id) return;
      const code = Object.keys(messages).find(code => String(error).includes(code)) ?? 'ANALYSIS_FAILED';
      const safe = messages[code] ?? 'Analysis could not complete. Check the local service and retry. Input and previous results are retained.';
      if (code === 'STALE_REQUEST') setInvalidated(true);
      setFailed(true); setMessage(safe); onError({ code, message: safe, retryable: true });
    } finally { if (active.current && requestId.current === id) setBusy(false); }
  }
  const stale = !!result && (invalidated || !ticketCurrent(record, result.ticket, result.ticket.requestId, result.ticket.settingsRevision));
  return <section className="module-model" aria-label="Model analysis module">
    <header><div><h2>Case analysis</h2><p>Reported information · synthetic training case · employee checking required</p></div>
      <button type="button" onClick={() => void analyze()} disabled={busy}>{busy ? 'Analyzing…' : result ? 'Analyze again' : 'Analyze current case'}</button></header>
    <p>Uses the saved API settings on this page. Real API mode sends this synthetic case to your configured provider and may use credits.</p>
    <details><summary>Input sources ({record.sources.length})</summary>{record.sources.map(source => <p key={source.id}><strong>{source.id} · {source.kind}</strong><br />{source.text}</p>)}</details>
    <p role="status" aria-live="polite">{message}</p>
    {result && <div className="model-result" data-testid="model-result">
      <h3>{stale ? 'Previous proposal — out of date' : busy ? 'Previous proposal — new analysis pending' : failed ? 'Previous proposal — latest attempt failed' : 'Analysis proposal — not reviewed'}</h3>
      <p>{result.meta.simulated ? 'MOCK simulation — no provider called' : 'API analysis — provider called'} · {result.ticket.caseId} · case version {result.ticket.caseVersion} · settings revision {result.ticket.settingsRevision}</p>
      {stale && <p className="model-warning">This proposal is no longer current. It cannot be used as a new analysis.</p>}
      <h4>Candidate types</h4><p>{result.proposal.analysis.types.join(', ') || 'Insufficient information'}</p>
      {(['reasons', 'alternatives', 'gaps'] as const).map(name => <div key={name}><h4>{{reasons:'Supporting reasons', alternatives:'Alternative explanations / uncertainty', gaps:'Information gaps'}[name]}</h4><ul>{result.proposal.analysis[name].map((text, i) => <li key={i}>{text}</li>)}</ul></div>)}
      <h4>Fact proposals</h4><p>Existing employee corrections stay in the case. Differing proposals require conflict-aware review in the intake module.</p>
      <div className="model-table"><table><thead><tr><th>Field / record</th><th>Proposed value</th><th>Current employee correction</th><th>Status / sources</th></tr></thead><tbody>
        {result.proposal.facts.map(f => { const original = resultCase?.facts.find(x => x.fieldId === f.fieldId && x.recordId === f.recordId); return <tr key={`${f.fieldId}:${f.recordId ?? ''}`}><td>{f.fieldId}{f.recordId ? ` / ${f.recordId}` : ''}</td><td>{f.value === null ? 'Unknown / not supplied' : JSON.stringify(f.value)}</td><td>{original?.reviewStatus === 'corrected' ? JSON.stringify(original.value) : '—'}</td><td>{f.status}{f.sourceIds.map(id => <details key={id}><summary>{id}</summary>{resultCase?.sources.find(s => s.id === id)?.text ?? 'Source belongs to previous case context'}</details>)}</td></tr>; })}
      </tbody></table></div>
      <h4>Follow-up proposals ({result.proposal.questions.length})</h4><p>These do not start a round or count as questions asked. Intake controls the follow-up workflow.</p>
      {result.proposal.questions.length ? <ol>{result.proposal.questions.map(q => <li key={q.id}><strong>{q.text}</strong><br />{q.target.fieldId} {q.target.recordId} · {q.reason}</li>)}</ol> : <p>No new questions proposed.</p>}
    </div>}
  </section>;
}
