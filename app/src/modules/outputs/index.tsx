import { useEffect, useRef, useState } from 'react';
import type { ModuleProps } from '../../../../shared/module-ports';
import { runtimeReviewValid, type RuntimeCaseRecord } from '../../../../shared/runtime';
import { editOutput, finalReview, outputCurrent, outputProposals, outputSnapshot, regenerateOutputs } from '../../../../shared/outputs';
import { outputSnapshotFilename, outputSnapshotToHtml, outputSnapshotToMarkdown } from '../../../../shared/export';
import { activeRecommendations, evaluateGuidance, NO_GUIDANCE } from '../../../../shared/guidance';
import { downloadBlob } from '../../export/OutputPanel';
import GuidanceModule from '../guidance';
import './style.css';

type Out = RuntimeCaseRecord['outputs'][number];
function OutputEditor({ record, output, actor, onChange, report, onDirty }: { record: RuntimeCaseRecord; output: Out; actor: string; onChange: ModuleProps['onChange']; report: (s: string) => void; onDirty: (dirty: boolean) => void }) {
  const [body, setBody] = useState(output.body), [reason, setReason] = useState('');
  useEffect(() => { onDirty(body !== output.body); return () => onDirty(false); }, [body, output.body, onDirty]);
  return <div className="e-editor"><label>Working body for {output.id}<textarea aria-label={`Working body for ${output.id}`} value={body} onChange={e => setBody(e.target.value)} /></label>
    <label>Edit reason for {output.id}<input value={reason} onChange={e => setReason(e.target.value)} /></label>
    <button onClick={() => { try { onChange(editOutput(record, output.id, body, { actor, reason })); report('Employee edit recorded; this object needs final review and saving.'); } catch (e) { report((e as Error).message); } }}>Record edit {output.id}</button>
    {body !== output.body && <><p className="e-warning">Unrecorded edit. Record or discard it before review / output.</p><button onClick={() => setBody(output.body)}>Discard working edit</button></>}
  </div>;
}
export default function OutputsModule({ record, onChange, ports, onError, reset }: ModuleProps) {
  const [actor, setActor] = useState(''), [message, setMessage] = useState(''), [selected, setSelected] = useState('SUMMARY');
  const [dirty, setDirty] = useState(false);
  const [ack, setAck] = useState(false), [busy, setBusy] = useState(false), [replacement, setReplacement] = useState('');
  const [pending, setPending] = useState<{ caseId: string; instanceId: string; version: number; proposals: Out[] } | null>(null);
  const current = useRef(record); current.current = record;
  const selection = useRef(selected); selection.current = selected;
  const out = record.outputs.find(o => o.id === selected) ?? record.outputs[0];
  useEffect(() => setAck(false), [record.caseId, record.instanceId, record.version, out?.id]);
  const report = (s: string) => setMessage(s);
  const apply = (fn: () => RuntimeCaseRecord, success: string) => { try { const next = fn(); if (next !== record) onChange(next); setAck(false); report(success); } catch (e) { report((e as Error).message); } };
  let html = '', blocked = '';
  try { if (!out) throw new Error('Generate current outputs first.'); html = outputSnapshotToHtml(outputSnapshot(record, out.id)); } catch (e) { blocked = (e as Error).message; }
  const stalePending = pending && (pending.caseId !== record.caseId || pending.instanceId !== record.instanceId || pending.version !== record.version);
  async function deliver(format: 'copy' | 'markdown' | 'pdf') {
    if (!out || dirty || pending) return;
    const before = record, id = out.id, chosen = selected;
    setBusy(true);
    try {
      const snapshot = outputSnapshot(before, id);
      const blob = format === 'copy' ? null : await ports.export(before, id, format);
      if (current.current.caseId !== before.caseId || current.current.instanceId !== before.instanceId || current.current.version !== before.version || !current.current.saved || selection.current !== chosen) throw new Error('Output response is stale; current case retained. Retry current content.');
      if (format === 'copy') await navigator.clipboard.writeText(outputSnapshotToMarkdown(snapshot));
      else downloadBlob(blob!, outputSnapshotFilename(snapshot, format === 'pdf' ? 'pdf' : 'md'));
      report(`${format} completed from ${id} v${snapshot.objectVersion}. No sending performed.`);
    } catch (e) { const text = (e as Error).message; report(`${text} Body and reviews retained.`); onError({ code: 'E01_OUTPUT_FAILED', message: text, retryable: true }); }
    finally { setBusy(false); }
  }
  return <section className="module-outputs e-workspace" aria-label="E01 final review and outputs">
    <header><p>SYNTHETIC CASE · E01 RUNTIME</p><h2>Summary, final review & local output</h2><p>Generate from current facts and D guidance. Employee review records an explicit local event; it does not approve business content or execute actions.</p></header>
    <p>First-check input: {record.reviews.some(r => r.stage === 'first' && !r.simulated) ? 'Employee event present' : 'Fixed input / simulated history; B runtime not implemented'}. {record.needsFactConfirmation ? 'B must confirm changes before final review.' : 'Current recorded fact-check flags are consumed as supplied.'}</p>
    <label>E employee identifier<input value={actor} onChange={e => { setActor(e.target.value); setAck(false); }} placeholder="Enter your own identifier" /></label>
    <details><summary>D guidance and decisions for this same case</summary><GuidanceModule record={record} onChange={onChange} ports={ports} onError={onError} reset={reset} /></details>
    <div className="e-actions"><button disabled={dirty} onClick={() => {
      try {
        const result = regenerateOutputs(record);
        if (result.protectedIds.length) { setPending({ caseId: record.caseId, instanceId: record.instanceId, version: record.version, proposals: outputProposals(record).filter(o => result.protectedIds.includes(o.id)) }); report(`Employee content protected: ${result.protectedIds.join(', ')}. Compare before replacement.`); }
        else { if (result.record !== record) onChange(result.record); report('Current outputs generated. No review was added.'); }
        setAck(false);
      } catch (e) { report((e as Error).message); }
    }}>Generate / refresh E outputs</button><button disabled={busy || dirty} onClick={async () => { setBusy(true); try { await ports.save(record); report('Saved through A01 storage.'); } catch (e) { report((e as Error).message); } finally { setBusy(false); } }}>Save E case</button></div>
    {pending && <section className="e-warning" role="dialog" aria-label="Protect employee edits"><h3>Compare protected drafts</h3><p>No changes have been applied. Compare the current employee text with the generated proposal. Keeping employee text can still refresh other drafts; stale employee drafts remain blocked. Replacing retains prior text in history.</p>{stalePending && <p>Case changed since comparison. Cancel and generate again.</p>}
      {pending.proposals.map(p => <div key={p.id}><h4>{p.id}</h4><div className="e-comparison"><pre>{record.outputs.find(o => o.id === p.id)?.body}</pre><pre>{p.body}</pre></div></div>)}
      <label>Replacement reason<input value={replacement} onChange={e => setReplacement(e.target.value)} /></label>
      <button disabled={!!stalePending} onClick={() => { try { const result = regenerateOutputs(record, { actor, reason: replacement, replaceEdited: pending.proposals.map(p => p.id) }); onChange(result.record); setPending(null); setAck(false); report('Replacement explicitly confirmed; previous employee content retained in history.'); } catch (e) { report((e as Error).message); } }}>Confirm replacement of compared drafts</button>
      <button onClick={() => { if (!stalePending) { const result = regenerateOutputs(record); if (result.record !== record) onChange(result.record); } setPending(null); setAck(false); report('Employee content kept; other generated drafts refreshed. Stale employee drafts remain blocked.'); }}>Keep employee content / refresh other drafts</button>
      <button onClick={() => { setPending(null); report('Comparison cancelled; all content retained.'); }}>Cancel comparison</button>
    </section>}
    <p role="status" className="e-feedback">{message}</p>
    {evaluateGuidance(record).summaryOnly && <p className="e-warning">{NO_GUIDANCE}. Factual summary only; historical handovers are inactive.</p>}
    <details><summary>Final-review checklist: current facts, candidates, gaps and guidance</summary>
      <pre>{JSON.stringify({ facts: record.facts, analysis: record.analysis, sources: record.sources, recommendations: record.recommendations, role: record.role, guidanceStatus: record.guidanceStatus }, null, 2)}</pre>
    </details>
    <label className="e-check"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />I checked the current facts, candidate analysis, gaps, uncertainty, guidance and selected text. I am explicitly recording final review, not external verification or action.</label>
    <h3>Recommendation final reviews</h3>
    {activeRecommendations(record).filter(r => r.decision !== 'rejected').map(rec => <article key={rec.id}><h4>{rec.id} v{rec.version} · {runtimeReviewValid(record, rec.id) ? 'Employee final review current' : 'Final review required'}</h4><p>{rec.step}</p><p>{rec.decision} · {rec.simulated ? 'MOCK decision; replace in D before reviewing' : 'D decision event'}</p><button disabled={!!pending || dirty} onClick={() => apply(() => finalReview(record, rec.id, actor, ack), `Final review recorded for ${rec.id}; save required.`)}>Final review {rec.id}</button></article>)}
    <label>E draft selection<select aria-label="E draft selection" disabled={dirty} value={out?.id ?? ''} onChange={e => { setSelected(e.target.value); setAck(false); }}>{!record.outputs.length && <option value="">No generated objects</option>}{record.outputs.map(o => <option key={o.id} value={o.id}>{o.id} v{o.version}</option>)}</select></label>
    {out && <article><h3>{out.title} · v{out.version}</h3><p>{out.employeeEdited ? 'Employee edited · wording is not automatically verified' : 'Generated draft'} · {outputCurrent(record, out.id) ? 'Current basis' : 'Inactive / dependencies changed'} · {runtimeReviewValid(record, out.id) && outputCurrent(record, out.id) ? 'Employee final review current' : 'Final review required'}</p>
      <p>Draft for inspection (not a valid output preview until all gates pass).</p><pre className="e-body">{out.body}</pre>
      <details><summary>Edit body (record edits before closing)</summary><OutputEditor key={`${record.instanceId}-${out.id}-${out.version}`} record={record} output={out} actor={actor} onChange={onChange} report={report} onDirty={setDirty} /></details>
      <details><summary>Versions, dependencies and edit history</summary><pre>{JSON.stringify({ dependencies: out.dependencies, history: out.history, reviews: record.reviews.filter(r => r.objectId === out.id) }, null, 2)}</pre></details>
      <button disabled={!!pending || dirty} onClick={() => apply(() => finalReview(record, out.id, actor, ack), `Final review recorded for ${out.id}; save required.`)}>Final review {out.id}</button>
    </article>}
    <h3>Effective snapshot preview & output</h3>
    {blocked || pending || dirty ? <p className="e-warning" data-testid="e-output-blocked">{dirty ? 'Record or discard the working edit before review / output.' : pending ? 'Finish or cancel the replacement comparison before output.' : blocked}</p> : <iframe title="E reviewed output preview" sandbox="" srcDoc={html} />}
    <div className="e-actions">{(['copy','markdown','pdf'] as const).map(f => <button key={f} disabled={busy || !!blocked || !!pending || dirty} onClick={() => void deliver(f)}>{f === 'copy' ? 'Copy E Markdown' : `Download E ${f}`}</button>)}</div>
  </section>;
}
