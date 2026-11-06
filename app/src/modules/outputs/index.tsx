import { useEffect, useRef, useState } from 'react';
import type { ModuleProps } from '../../../../shared/module-ports';
import { runtimeReviewValid, type RuntimeCaseRecord } from '../../../../shared/runtime';
import { editOutput, finalReview, finalReviewSelection, outputCurrent, outputProposals, outputSnapshot, regenerateOutputs } from '../../../../shared/outputs';
import { outputSnapshotFilename, outputSnapshotToHtml, outputSnapshotToMarkdown } from '../../../../shared/export';
import { factLabel, outputLabel, readableText } from '../../../../shared/presentation';
import { activeRecommendations, evaluateGuidance, NO_GUIDANCE } from '../../../../shared/guidance';
import { downloadBlob } from '../../export/OutputPanel';
import GuidanceModule from '../guidance';
import './style.css';

type Out = RuntimeCaseRecord['outputs'][number];
const valueText = (value: unknown) => value === null ? 'Unknown' : Array.isArray(value) ? value.join(', ') : String(value);
function OutputEditor({ record, output, actor, onChange, report, onDirty, integrated }: { record: RuntimeCaseRecord; output: Out; actor: string; onChange: ModuleProps['onChange']; report: (s: string) => void; onDirty: (dirty: boolean) => void; integrated?: boolean }) {
  const [body, setBody] = useState(output.body), [reason, setReason] = useState('');
  const name = integrated ? outputLabel(output.id) : output.id;
  useEffect(() => { onDirty(body !== output.body); return () => onDirty(false); }, [body, output.body, onDirty]);
  return <div className="e-editor"><label>Working body for {name}<textarea aria-label={`Working body for ${name}`} value={body} onChange={e => setBody(e.target.value)} /></label>
    <label>Edit reason for {name}<input value={reason} onChange={e => setReason(e.target.value)} /></label>
    <button onClick={() => { try { onChange(editOutput(record, output.id, body, { actor, reason })); report('Employee edit recorded. Review the changed document, then save.'); } catch (e) { report((e as Error).message); } }}>Record edit {name}</button>
    {body !== output.body && <><p className="e-warning">Working edit has not been recorded.</p><button onClick={() => setBody(output.body)}>Discard working edit</button></>}
  </div>;
}
export default function OutputsModule({ record, onChange, ports, onError, reset, integrated, onWorkingEditChange, employeeIdentifier, workflowStage }: ModuleProps) {
  const [localActor, setActor] = useState(''), [message, setMessage] = useState(''), [selected, setSelected] = useState('SUMMARY');
  const actor = integrated ? employeeIdentifier ?? '' : localActor;
  const [dirty, setDirty] = useState(false);
  const workingEdit = useRef(dirty); workingEdit.current = dirty;
  useEffect(() => { onWorkingEditChange?.(dirty); return () => onWorkingEditChange?.(false); }, [dirty, onWorkingEditChange]);
  const [ack, setAck] = useState(false), [busy, setBusy] = useState(false), [replacement, setReplacement] = useState('');
  const [reviewIds, setReviewIds] = useState<string[] | null>(null);
  const [pending, setPending] = useState<{ caseId: string; instanceId: string; version: number; proposals: Out[] } | null>(null);
  const current = useRef(record); current.current = record;
  const selection = useRef(selected); selection.current = selected;
  const out = record.outputs.find(o => o.id === selected) ?? record.outputs[0];
  const eligible = record.outputs.filter(o => outputCurrent(record, o.id));
  const scope = eligible.filter(o => reviewIds === null || reviewIds.includes(o.id));
  const refs = new Set(scope.flatMap(o => o.recommendationIds ?? []));
  const scopeRecommendations = activeRecommendations(record).filter(rec => refs.has(rec.id));
  const preparing = !integrated || workflowStage === 4;
  const reviewing = !integrated || workflowStage === 5;
  useEffect(() => setAck(false), [record.caseId, record.instanceId, record.version, out?.id, actor]);
  useEffect(() => { setReviewIds(null); setPending(null); }, [record.caseId, record.instanceId]);
  const report = (s: string) => setMessage(s);
  const apply = (fn: () => RuntimeCaseRecord, success: string) => { try { const next = fn(); if (next !== record) onChange(next); setAck(false); report(success); } catch (e) { report((e as Error).message); } };
  let html = '', blocked = '';
  try { if (!out) throw new Error('Prepare materials to generate documents first.'); html = outputSnapshotToHtml(outputSnapshot(record, out.id)); } catch (e) { blocked = (e as Error).message; }
  const stalePending = pending && (pending.caseId !== record.caseId || pending.instanceId !== record.instanceId || pending.version !== record.version);
  function generate() {
    try {
      const result = regenerateOutputs(record);
      if (result.protectedIds.length) {
        setPending({ caseId: record.caseId, instanceId: record.instanceId, version: record.version, proposals: outputProposals(record).filter(o => result.protectedIds.includes(o.id)) });
        report(`Compare employee edits in ${result.protectedIds.map(outputLabel).join(', ')} before replacing them.`);
      } else { if (result.record !== record) onChange(result.record); report('Documents updated. Continue to Review and export.'); }
      setAck(false);
    } catch (e) { report((e as Error).message); }
  }
  async function deliver(format: 'copy' | 'markdown' | 'pdf') {
    if (!out || dirty || pending) return;
    const before = record, id = out.id, chosen = selected;
    setBusy(true);
    try {
      const snapshot = outputSnapshot(before, id);
      const blob = format === 'copy' ? null : await ports.export(before, id, format);
      if (workingEdit.current || current.current.caseId !== before.caseId || current.current.instanceId !== before.instanceId || current.current.version !== before.version || !current.current.saved || selection.current !== chosen) throw new Error('Output response is stale. Retry with the current saved document.');
      if (format === 'copy') await navigator.clipboard.writeText(outputSnapshotToMarkdown(snapshot));
      else downloadBlob(blob!, outputSnapshotFilename(snapshot, format === 'pdf' ? 'pdf' : 'md'));
      report(`${format} completed from ${integrated ? outputLabel(id) : id} v${snapshot.objectVersion}.`);
    } catch (e) { const text = (e as Error).message; report(`${text} Body and reviews retained.`); onError({ code: 'E01_OUTPUT_FAILED', message: text, retryable: true }); }
    finally { setBusy(false); }
  }
  return <section className="module-outputs e-workspace" aria-label={integrated ? 'Materials and final review' : 'E01 final review and outputs'}>
    <header><h2>{reviewing && integrated ? 'Review and export' : 'Prepare documents'}</h2><p>Check reported information and uncertainty before sharing a local copy.</p></header>
    {record.needsFactConfirmation && <p className="e-warning">Return to Check information and confirm the changed facts.</p>}
    {!integrated && <><label>E employee identifier<input value={localActor} onChange={e => { setActor(e.target.value); setAck(false); }} placeholder="Enter your own identifier" /></label>
      <details><summary>D guidance and decisions for this same case</summary><GuidanceModule record={record} onChange={onChange} ports={ports} onError={onError} reset={reset} /></details></>}
    <div hidden={!preparing}>
      <div className="e-actions"><button disabled={dirty} onClick={generate}>{integrated ? 'Update documents / compare employee edits' : 'Generate / refresh E outputs'}</button>
        {!integrated && <button disabled={busy || dirty} onClick={async () => { setBusy(true); try { await ports.save(record); report('Saved through A01 storage.'); } catch (e) { report((e as Error).message); } finally { setBusy(false); } }}>Save E case</button>}</div>
      {pending && <section className="e-warning" role="dialog" aria-label="Protect employee edits"><h3>Compare protected drafts</h3><p>Compare employee text with the proposed update. Keeping employee text retains its existing basis. Changed dependencies require an explicit replacement before review.</p>{stalePending && <p>Case changed since comparison. Cancel and generate again.</p>}
        {pending.proposals.map(p => <div key={p.id}><h4>{outputLabel(p.id)}</h4><div className="e-comparison"><div><strong>Employee text</strong><pre>{record.outputs.find(o => o.id === p.id)?.body}</pre></div><div><strong>Proposed update</strong><pre>{p.body}</pre></div></div></div>)}
        <label>Replacement reason<input value={replacement} onChange={e => setReplacement(e.target.value)} /></label>
        <button disabled={!!stalePending} onClick={() => { try { const result = regenerateOutputs(record, { actor, reason: replacement, replaceEdited: pending.proposals.map(p => p.id) }); onChange(result.record); setPending(null); setAck(false); report('Replacement recorded. Previous employee text remains in history. Review changed documents.'); } catch (e) { report((e as Error).message); } }}>Confirm replacement of compared drafts</button>
        <button onClick={() => { if (!stalePending) { const result = regenerateOutputs(record); if (result.record !== record) onChange(result.record); } setPending(null); setAck(false); report('Employee content kept; other generated drafts refreshed. Changed dependencies still require an update.'); }}>Keep employee content / refresh other drafts</button>
        <button onClick={() => { setPending(null); report('Comparison cancelled.'); }}>Cancel comparison</button>
      </section>}
    </div>
    <p role="status" className="e-feedback">{message}</p>
    {evaluateGuidance(record).summaryOnly && <p className="e-warning">{NO_GUIDANCE}. Review the factual summary only.</p>}
    <div hidden={!reviewing}>
      <details open={integrated}><summary>Review current facts, suspected types and information gaps</summary>
        <table><thead><tr><th>Information</th><th>Current report</th><th>Check</th></tr></thead><tbody>{record.facts.filter(f => f.fieldId !== 'A07').map(f => <tr key={`${f.fieldId}:${f.recordId ?? ''}`}><td>{factLabel(f)}</td><td>{valueText(f.value)}</td><td>{f.status} · {f.reviewStatus}{f.candidates.length > 0 && <p>Alternative proposals remain in the fact history.</p>}</td></tr>)}</tbody></table>
        <h3>Suspected types</h3><p>{record.analysis.types.join(', ') || 'Insufficient information'}</p>
        <ul>{record.analysis.reasons.map((s, i) => <li key={i}>{readableText(s)}</li>)}</ul>
        <h3>Uncertainty and remaining gaps</h3><ul>{[...record.analysis.alternatives, ...record.analysis.gaps].map((s, i) => <li key={i}>{readableText(s)}</li>)}</ul>
      </details>
      {integrated ? <section className="e-review-scope"><h3>Documents included in this review</h3>
        {record.outputs.map(o => <label className="e-scope-option" key={o.id}><input type="checkbox" disabled={dirty || !outputCurrent(record, o.id)} checked={scope.some(s => s.id === o.id)} onChange={e => { const ids = scope.map(s => s.id); setReviewIds(e.target.checked ? [...ids, o.id] : ids.filter(id => id !== o.id)); setAck(false); }} />{outputLabel(o.id)} · v{o.version} · {outputCurrent(record, o.id) ? runtimeReviewValid(record, o.id) ? 'Reviewed' : 'Awaiting review' : 'Content changed — update required'}</label>)}
        {!record.outputs.length && <p>Return to Prepare materials to generate documents.</p>}
        {activeRecommendations(record).some(r => r.decision === 'pending' || r.simulated) && <p className="e-warning">Some suggestions still await your decision. Documents referencing them cannot be reviewed yet. Return to Prepare materials to accept, change or decline them.</p>}
        <h3>Referenced recommendations included</h3>
        {scopeRecommendations.length ? scopeRecommendations.map(rec => <article key={rec.id}><p>{rec.step}</p><p>Decision · {rec.decision}. {runtimeReviewValid(record, rec.id) ? 'Review current.' : 'Included in this review.'}</p><details><summary>Evidence and version</summary><p>{rec.id} v{rec.version} · {rec.guidelineRefs.map(g => `${g.id} v${g.version}`).join(', ')}</p></details></article>) : <p>The selected documents contain no handling recommendations.</p>}
        {scope.map(o => <details key={o.id}><summary>{outputLabel(o.id)} · review full text</summary><pre className="e-body">{o.body}</pre></details>)}
        <label className="e-check"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />I checked the current facts, suspected types, gaps, selected documents and referenced recommendations shown above.</label>
        <button disabled={!scope.length || !!pending || dirty || !ack || !actor.trim() || scopeRecommendations.some(r => r.decision === 'pending' || r.simulated)} onClick={() => apply(() => finalReviewSelection(record, scope.map(o => o.id), actor, ack), 'Selected documents and referenced recommendations reviewed. Save case to enable export.')}>Review selected documents and recommendations</button>
        <p>{record.saved ? 'Saved locally.' : 'Unsaved changes.'} {scope.length > 0 && scope.every(o => runtimeReviewValid(record, o.id)) ? record.saved ? 'Reviewed documents are ready to export.' : 'Review recorded — save case next.' : 'Review the selected documents before export.'}</p>
      </section> : <><label className="e-check"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />I checked the current facts, candidate analysis, gaps, uncertainty, guidance and selected text.</label>
        <h3>Recommendation final reviews</h3>{activeRecommendations(record).filter(r => r.decision !== 'rejected').map(rec => <article key={rec.id}><h4>{rec.id} v{rec.version} · {runtimeReviewValid(record, rec.id) ? 'Employee final review current' : 'Final review required'}</h4><p>{rec.step}</p><p>{rec.decision}</p><button disabled={!!pending || dirty} onClick={() => apply(() => finalReview(record, rec.id, actor, ack), `Final review recorded for ${rec.id}; save required.`)}>Final review {rec.id}</button></article>)}</>}
    </div>
    <label>{integrated ? 'Document to inspect or export' : 'E draft selection'}<select aria-label={integrated ? 'Document to inspect or export' : 'E draft selection'} disabled={dirty} value={out?.id ?? ''} onChange={e => { setSelected(e.target.value); setAck(false); }}>{!record.outputs.length && <option value="">No generated documents</option>}{record.outputs.map(o => <option key={o.id} value={o.id}>{integrated ? outputLabel(o.id) : o.id} v{o.version}</option>)}</select></label>
    {out && <article><h3>{out.title} · v{out.version}</h3><p>{out.employeeEdited ? 'Employee edited' : 'Generated draft'} · {outputCurrent(record, out.id) ? runtimeReviewValid(record, out.id) ? 'Reviewed' : 'Awaiting review' : 'Content changed — update and review again'}</p>
      <div hidden={!preparing}><details><summary>Document text</summary><pre className="e-body">{out.body}</pre></details>
        <details><summary>Edit body (record edits before closing)</summary><OutputEditor key={`${record.instanceId}-${out.id}-${out.version}`} record={record} output={out} actor={actor} onChange={onChange} report={report} onDirty={setDirty} integrated={integrated} /></details></div>
      <details><summary>Versions, dependencies and edit history</summary><p>Document reference · {out.id}</p>{out.history.map((h, i) => <div key={i}><p>{h.actor} · {h.reason}</p><pre>{h.previous}</pre></div>)}<p>Recorded reviews · {record.reviews.filter(r => r.objectId === out.id).map(r => `${r.actor} · ${r.reviewedAt} · v${r.objectVersion}`).join(' / ') || 'None'}</p></details>
      {!integrated && <button disabled={!!pending || dirty} onClick={() => apply(() => finalReview(record, out.id, actor, ack), `Final review recorded for ${out.id}; save required.`)}>Final review {out.id}</button>}
    </article>}
    <div hidden={!reviewing}><h3>Reviewed preview and export</h3>
      {blocked || pending || dirty ? <p className="e-warning" data-testid="e-output-blocked">{dirty ? 'Record or discard the working edit before review / output.' : pending ? 'Finish or cancel the replacement comparison before output.' : blocked}</p> : <iframe title={integrated ? 'Reviewed document preview' : 'E reviewed output preview'} sandbox="" srcDoc={html} />}
      <div className="e-actions">{(['copy','markdown','pdf'] as const).map(f => <button key={f} disabled={busy || !!blocked || !!pending || dirty} onClick={() => void deliver(f)}>{integrated ? f === 'copy' ? 'Copy Markdown' : f === 'pdf' ? 'Download PDF' : 'Download Markdown' : f === 'copy' ? 'Copy E Markdown' : `Download E ${f}`}</button>)}</div>
    </div>
  </section>;
}
