import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { moduleNames, type ModuleEntry, type ModuleName, type ModulePorts, type ModuleProps, type AnalysisRequest, type AnalysisResponse } from '../../shared/module-ports';
import { makeRuntimeFixture, runtimeVariants } from '../../shared/runtime-fixtures';
import { RuntimeCaseRecordSchema, runtimeDependencies, runtimeReviewValid, ticketCurrent, type RuntimeCaseRecord } from '../../shared/runtime';
import { saveRuntimeCase, loadRuntimeCase, listRuntimeCases, backupRuntimeCase, parseRuntimeBackup, assertImportAllowed } from './runtime-storage';
import { ModelSettings } from './components/ModelSettings';
import { reconcileAnalysisGaps } from '../../shared/intake';
import { regenerateOutputs, outputCurrent } from '../../shared/outputs';
import { recalculateGuidance, approvedGuidanceRole, changeGuidanceContext, activeRecommendations } from '../../shared/guidance';
import { evaluateGuidance } from '../../shared/guidance';

const entries = import.meta.glob<ModuleEntry>('./modules/*/index.tsx');
const components = Object.fromEntries(moduleNames.map(name => [name, entries[`./modules/${name}/index.tsx`] ? lazy(entries[`./modules/${name}/index.tsx`]) : null]));
async function post(path: string, body: unknown): Promise<Response> {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const result = await response.json(); throw new Error(`${result.error?.code}: ${result.error?.message}`); }
  return response;
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function ModulePreview({ name, integrated = false }: { name: ModuleName; integrated?: boolean }) {
  const session = integrated ? 'integration' : name;
  const testMode = !integrated || new URLSearchParams(location.search).get('test') === '1';
  const [workflowStage, setWorkflowStage] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [record, setRecord] = useState(() => makeRuntimeFixture('T09', crypto.randomUUID()));
  const current = useRef(record); current.current = record;
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [variant, setVariant] = useState('T09'), [message, setMessage] = useState('Loading runtime history…');
  const [history, setHistory] = useState<RuntimeCaseRecord[]>([]), [selectedCase, setSelectedCase] = useState('');
  const [failSave, setFailSave] = useState(false), [failOutput, setFailOutput] = useState(false);
  const [pending, setPending] = useState<(() => Promise<void>) | null>(null);
  const [workingEditDirty, setWorkingEditDirty] = useState(false);
  const workingEdit = useRef(workingEditDirty); workingEdit.current = workingEditDirty;
  const requestId = useRef(''), revision = useRef(1);
  useEffect(() => { setIdentityConfirmed(false); setWorkflowStage(1); }, [record.caseId, record.instanceId]);
  const Component = components[name];
  const apply = (next: RuntimeCaseRecord) => { const valid = RuntimeCaseRecordSchema.parse(next); current.current = valid; setRecord(valid); };
  const refresh = async () => setHistory(await listRuntimeCases());
  const workingEditMessage = 'Record or discard the working output edit before saving or changing cases.';
  useEffect(() => {
    if (!workingEditDirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [workingEditDirty]);
  useEffect(() => {
    let active = true;
    Promise.all([loadRuntimeCase(undefined, session), listRuntimeCases()]).then(([saved, all]) => {
      if (!active) return;
      if (saved) { const restored = reconcileAnalysisGaps({ ...saved, instanceId: crypto.randomUUID() }); current.current = restored; setRecord(restored); }
      setHistory(all); setMessage(saved ? 'Saved runtime case restored from this browser.' : 'No runtime history; unsaved MOCK input loaded.');
    }).catch(error => { if (active) setMessage(error.message); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [session]);
  async function save(input = current.current) {
    if (workingEdit.current) throw new Error(workingEditMessage);
    const contentBeforeSave = JSON.stringify(current.current);
    const submittedContent = JSON.stringify(input);
    const saved = await saveRuntimeCase(input, session, failSave);
    const currentContent = JSON.stringify(current.current);
    if (currentContent === contentBeforeSave || currentContent === submittedContent) apply(saved);
    await refresh(); return saved;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); try { await action(); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }
  function guard(action: () => Promise<void>) {
    if (workingEdit.current) { setMessage(workingEditMessage); return; }
    if (!current.current.saved) setPending(() => action);
    else void run(action);
  }
  const reset = () => guard(async () => {
    requestId.current = ''; const next = makeRuntimeFixture(variant, crypto.randomUUID()); apply(next);
    setFailSave(variant === 'save-error'); setFailOutput(variant === 'output-error');
    setMessage(`Reset ${variant}; MOCK input is unsaved. Existing history retained.`);
  });
  const ports: ModulePorts = {
    analyze: async input => {
      const context = await (await fetch('/api/runtime/context')).json();
      return (await (await post('/api/runtime/analyze', { ...input, previewMock: input.previewMock ?? !context.modelRegistered })).json()) as AnalysisResponse;
    },
    save,
    guidance: async input => { const result = evaluateGuidance(input); return { recommendations: result.recommendations, guidanceStatus: result.guidanceStatus, simulated: false }; },
    export: async (input, objectId, format) => {
      const context = await (await fetch('/api/runtime/context')).json();
      return (await post('/api/runtime/export', { case: input, objectId, format, previewMock: !context.outputRegistered, ...(failOutput ? { fault: 'failure' } : {}) })).blob();
    },
  };
  async function analyze(fault?: AnalysisRequest['fault']) {
    const context = await (await fetch('/api/runtime/context')).json(); revision.current = context.settingsRevision;
    const before = current.current, id = crypto.randomUUID(); requestId.current = id;
    const ticket = { caseId: before.caseId, instanceId: before.instanceId, caseVersion: before.version, requestId: id, settingsRevision: revision.current, dependencies: runtimeDependencies(before) };
    setMessage('MOCK analysis pending; input retained.');
    try {
      const result = await ports.analyze({ case: before, ticket, fault, previewMock: true });
      const latest = await (await fetch('/api/runtime/context')).json();
      if (!ticketCurrent(current.current, result.ticket, requestId.current, latest.settingsRevision)) { setMessage('Stale response ignored; current facts and reviews retained.'); return; }
      setMessage(`MOCK response ready: ${result.proposal.facts.length} fact proposals; providerCalled=false. No automatic merge (B/C responsibility).`);
    } catch (error) { if (requestId.current === id) setMessage((error as Error).message); }
  }
  const props: ModuleProps = { record, ports, onChange: next => apply({ ...next, saved: false }), onError: error => setMessage(`${error.code}: ${error.message}`), reset, integrated, onWorkingEditChange: setWorkingEditDirty, workflowStage, employeeIdentifier: record.employeeIdentifier ?? '', testMode };
  // The public fixture harness stays explicitly simulated even after a real module is installed.
  const mockPorts: ModulePorts = { ...ports,
    guidance: async input => ({ recommendations: structuredClone(input.recommendations), guidanceStatus: input.guidanceStatus, simulated: true }),
    export: async (input, objectId, format) => (await post('/api/runtime/export', { case: input, objectId, format, previewMock: true, ...(failOutput ? { fault: 'failure' } : {}) })).blob(),
  };
  async function importBackup(file: File) {
    const checkImport = () => {
      if (workingEdit.current) throw new Error(workingEditMessage);
      assertImportAllowed(current.current);
    };
    checkImport();
    const next = reconcileAnalysisGaps(parseRuntimeBackup(await file.text()));
    // File reads are asynchronous; recheck before any replacement.
    checkImport();
    const existing = await loadRuntimeCase(next.caseId);
    checkImport();
    if (existing && !window.confirm(`Replace saved case ${next.caseId}? Cancel keeps both cases unchanged.`)) { setMessage('Import cancelled; cases retained.'); return; }
    const saved = await saveRuntimeCase(next, session, failSave); requestId.current = ''; apply(saved); await refresh(); setMessage('Backup validated, saved and opened.');
  }
  const checked = record.reviews.some(r => r.stage === 'first') && !record.needsFactConfirmation;
  const stages = ['Record case', 'Check information', 'Add information', 'Prepare materials', 'Review and export'];
  const complete = [identityConfirmed, checked, record.followUp.stopped, record.outputs.some(o => outputCurrent(record, o.id)) && activeRecommendations(record).every(r => r.decision !== 'pending' && !r.simulated), record.outputs.some(o => outputCurrent(record, o.id) && runtimeReviewValid(record, o.id))];
  function prepareMaterials() {
    if (workingEdit.current) { setMessage(workingEditMessage); return; }
    setMessage('Updating recommendations and materials…');
    try {
      const guidance = recalculateGuidance(current.current);
      const result = regenerateOutputs(guidance);
      apply(result.record);
      setMessage(result.protectedIds.length ? 'Materials updated. Employee-edited drafts were kept. Compare current text and proposed updates before replacement.' : 'Materials updated. Record recommendation decisions, then continue to final review.');
    } catch (error) { setMessage(`Materials could not update. ${(error as Error).message}`); }
  }
  function goStage(next: 1 | 2 | 3 | 4 | 5) {
    if (workingEdit.current) { setMessage(workingEditMessage); return; }
    if (!identityConfirmed && next > 1) { setMessage('Confirm your organisation, role and employee identifier before continuing.'); return; }
    if (next >= 4 && !checked) { setMessage('Complete the current fact check before preparing materials.'); return; }
    setWorkflowStage(next); window.scrollTo({ top: 0, behavior: 'smooth' });
    if (next === 4 || next === 5) prepareMaterials();
  }
  return <main className={`module-preview ${integrated ? 'workflow' : ''}`}>
    <header><div><h1>{integrated ? 'ScamSafe case workspace' : `${name} independent preview`}</h1><p>Synthetic case · English interface · Chinese or English input</p></div>{integrated && <a href="/?test=1" onClick={e => { if (workingEdit.current) { e.preventDefault(); setMessage(workingEditMessage); } }}>Test workspace</a>}</header>
    {integrated && <>
      <div className="workflow-save"><span><strong>{record.caseId}</strong> · {workingEditDirty ? 'Unrecorded document edit' : record.saved ? 'Saved locally' : 'Unsaved changes'}</span><button className="primary" disabled={!ready || busy || workingEditDirty} onClick={() => void run(async () => { await save(); setMessage('Case saved locally. Refresh will restore this saved version.'); })}>Save case</button></div>
      <nav className="workflow-steps" aria-label="Case stages">{stages.map((label, i) => <button key={label} aria-current={workflowStage === i + 1 ? 'step' : undefined} onClick={() => goStage((i + 1) as 1 | 2 | 3 | 4 | 5)}><strong>{i + 1}. {label}</strong><span>{complete[i] ? 'Completed' : workflowStage === i + 1 ? 'Current task' : 'To do'}</span></button>)}</nav>
      <section className="card" hidden={workflowStage !== 1}><h2>Confirm your working context</h2><label>Organisation and role<select value={record.role.permissions.length ? record.role.id : 'inactive'} onChange={e => { apply(changeGuidanceContext(record, e.target.value === 'inactive' ? 'suspend-role' : 'restore-role')); setIdentityConfirmed(false); }}><option value={approvedGuidanceRole.id}>{approvedGuidanceRole.organisation} / {approvedGuidanceRole.title}</option>{testMode && <option value="inactive">Restricted role for testing</option>}</select></label><label>Employee identifier<input aria-label="Case employee identifier" value={record.employeeIdentifier ?? ''} onChange={e => { apply({ ...record, employeeIdentifier: e.target.value, saved: false, version: record.version + 1 }); setIdentityConfirmed(false); }} placeholder="Synthetic employee identifier" /></label><button disabled={!record.employeeIdentifier?.trim()} onClick={() => { setIdentityConfirmed(true); setMessage('Working context confirmed. Analyze the description, then check information.'); }}>Confirm working context</button><p>{identityConfirmed ? 'Working context confirmed' : 'Confirm the configured organisation, role and your identifier for this case.'}</p></section>
      <p className="workflow-task">{['Confirm your working context and analyze the caller description.', 'Check current facts and suspected types. Correct information before completing the first check.', 'Answer what is known, retain uncertainty, then end follow-up when ready.', 'Review recommendations and prepare readable materials. Changes require final review.', 'Review selected files and their referenced recommendations, save, then export.'][workflowStage - 1]}</p>
    </>}
    <p role="status">{message}</p>
    {integrated && !testMode && <details className="card"><summary>Local cases and backup</summary>
      <button onClick={() => guard(async () => { const fresh = makeRuntimeFixture('T09', crypto.randomUUID()); fresh.caseId = `SYN-${crypto.randomUUID()}`; requestId.current = ''; apply(fresh); setMessage('New synthetic case ready. Confirm the working context before analysis.'); })}>New synthetic case</button>
      <label>Saved case<select aria-label="Saved case" value={selectedCase} onChange={e => setSelectedCase(e.target.value)}><option value="">Select a case</option>{history.map(r => <option key={r.caseId}>{r.caseId}</option>)}</select></label>
      <button disabled={!selectedCase} onClick={() => guard(async () => { const next = await loadRuntimeCase(selectedCase); if (!next) throw new Error('Saved case not found.'); const opened = reconcileAnalysisGaps({ ...next, instanceId: crypto.randomUUID() }); requestId.current = ''; apply(opened); setMessage('Saved case opened. Confirm working context to continue.'); })}>Open saved case</button>
      <button onClick={() => { if (workingEdit.current) { setMessage(workingEditMessage); return; } download(new Blob([backupRuntimeCase(record)], { type: 'application/json' }), `${record.caseId}_runtime.json`); }}>Download case backup</button>
      <label>Import case backup<input type="file" accept=".json" onChange={e => { const file = e.target.files?.[0]; if (file) void run(() => importBackup(file)); e.target.value = ''; }} /></label>
    </details>}
    {testMode && <details className="test-tools" open={!integrated}><summary>Test controls and local case management</summary><nav onClick={event => { if (workingEdit.current) { event.preventDefault(); setMessage(workingEditMessage); } }}><a href="/">Case workspace</a>{moduleNames.map(n => <a key={n} href={`/?module=${n}`}>{n}</a>)}<a href="/?view=foundation">Legacy foundation</a></nav><p>Runtime schema v2 · {record.caseId} · case version {record.version}</p>
    <fieldset disabled={!ready || busy}>
      <legend>Common preview controls</legend>
      <label>Fixed runtime variant <select value={variant} onChange={e => setVariant(e.target.value)}>{runtimeVariants.map(v => <option key={v.id}>{v.id}</option>)}</select></label>
      <button onClick={reset}>Reset fixed input</button>
      {!integrated && <button onClick={() => void run(async () => { await save(); setMessage('Saved after IndexedDB transaction committed.'); })}>Save runtime case</button>}
      <label><input type="checkbox" checked={failSave} onChange={e => setFailSave(e.target.checked)} />Simulate save failure</label>
      <label><input type="checkbox" checked={failOutput} onChange={e => setFailOutput(e.target.checked)} />Simulate output failure</label>
      <button onClick={() => guard(async () => {
        const fresh = makeRuntimeFixture('T09', crypto.randomUUID()); fresh.caseId = `SYN-${crypto.randomUUID()}`;
        requestId.current = ''; apply(fresh); setMessage('New synthetic case; fixed MOCK T09 seed, not free intake.');
      })}>New synthetic case</button>
      <label>Saved case <select aria-label="Saved case" value={selectedCase} onChange={e => setSelectedCase(e.target.value)}><option value="">Select a case</option>{history.map(r => <option key={r.caseId}>{r.caseId}</option>)}</select></label>
      <button disabled={!selectedCase} onClick={() => guard(async () => {
        const next = await loadRuntimeCase(selectedCase); if (!next) throw new Error('Saved case not found.');
        const opened = reconcileAnalysisGaps({ ...next, instanceId: crypto.randomUUID() }); await saveRuntimeCase(opened, session, failSave); requestId.current = ''; apply(opened); setMessage('Saved case opened.');
      })}>Open saved case</button>
      <button onClick={() => { if (workingEdit.current) { setMessage(workingEditMessage); return; } download(new Blob([backupRuntimeCase(record)], { type: 'application/json' }), `${record.caseId}_runtime.json`); }}>Download runtime backup</button>
      <label>Import runtime backup <input type="file" accept=".json" onChange={e => { const file = e.target.files?.[0]; if (file) void run(() => importBackup(file)); e.target.value = ''; }} /></label>
    </fieldset>
    </details>}
    {pending && <section role="dialog" aria-label="Unsaved runtime changes"><p>Current changes are unsaved.</p>
      <button disabled={busy} onClick={() => void run(async () => { await save(); const action = pending; setPending(null); await action(); })}>Save and continue</button>
      <button disabled={busy} onClick={() => { if (workingEdit.current) { setMessage(workingEditMessage); return; } const action = pending; setPending(null); void run(action); }}>Discard changes and continue</button>
      <button disabled={busy} onClick={() => { setPending(null); setMessage('Cancelled; current input retained.'); }}>Cancel</button>
    </section>}
    {integrated ? <>
      {moduleNames.filter(n => n !== 'model').map(n => { const Installed = components[n]; const visible = n === 'intake' ? workflowStage <= 3 : n === 'guidance' ? workflowStage === 4 : workflowStage >= 4; return <section key={n} hidden={!visible} className={`module-${n}`} inert={busy || !ready || n === 'intake' && !identityConfirmed}><Suspense fallback={<p>Loading…</p>}>{ready && Installed ? <Installed {...props} /> : <p>Loading case…</p>}</Suspense></section>; })}
      {workflowStage === 4 && <button disabled={workingEditDirty || busy} onClick={prepareMaterials}>Update recommendations and materials</button>}
      <div className="workflow-next">{workflowStage > 1 && <button onClick={() => goStage((workflowStage - 1) as 1 | 2 | 3 | 4 | 5)}>Back</button>}{workflowStage < 5 && <button className="primary" onClick={() => goStage((workflowStage + 1) as 1 | 2 | 3 | 4 | 5)}>Continue to {stages[workflowStage]}</button>}</div>
      {testMode && <details><summary>Diagnostic MOCK controls — foundation fixtures only</summary><MockModule {...props} ports={mockPorts} installed={false} name={name} analyze={analyze} message={setMessage} run={run} ready={ready} /></details>}
    </> : <section className={`module-${name}`} inert={busy || !ready}>
      {Component && <Suspense fallback={<p>Loading module…</p>}><Component {...props} /></Suspense>}
      <MockModule {...props} ports={mockPorts} installed={!!Component} name={name} analyze={analyze} message={setMessage} run={run} ready={ready} />
    </section>}
    {testMode && <><details><summary>Fixed actions and expectations</summary><pre>{JSON.stringify(runtimeVariants.find(v => v.id === variant), null, 2)}</pre></details>
    <details><summary>Shared runtime record</summary><pre data-testid="runtime-record">{JSON.stringify(record, null, 2)}</pre></details>
    </>}
    {testMode && (integrated || name === 'model') && <ModelSettings onSaved={() => { requestId.current = ''; revision.current++; setMessage('Settings saved; old analysis invalidated. No provider called.'); }} />}
  </main>;
}
function MockModule({ record, ports, onChange, name, analyze, message, run, ready, installed }: ModuleProps & { name: ModuleName; analyze: (fault?: AnalysisRequest['fault']) => Promise<void>; message: (s: string) => void; run: (action: () => Promise<void>) => Promise<void>; ready: boolean; installed: boolean }) {
  const [objectId, setObjectId] = useState('SUMMARY');
  return <section><h2>{installed ? `MOCK test controls — ${name} module loaded above` : `MOCK substitute — ${name} module not installed`}</h2>
    <p>Runnable contract demonstration only. Module business logic belongs to B/C/D/E.</p>
    <p data-testid="amount">Reported amount: {String(record.facts.find(f => f.fieldId === 'E04' && f.recordId === 'TX-01')?.value)} AUD — unverified</p>
    <fieldset disabled={!ready}><legend>Injected MOCK operations</legend>
      <button onClick={() => {
        const next = structuredClone(record), f = next.facts.find(f => f.fieldId === 'E04' && f.recordId === 'TX-01')!;
        f.history.push({ value: f.value, reason: 'MOCK preview correction to 250', sourceIds: [...f.sourceIds] }); f.value = 250; f.version++; f.reviewStatus = 'corrected'; next.version++; next.needsFactConfirmation = next.reviews.some(r => r.stage === 'first'); onChange(next); message('MOCK amount changed to 250; unsaved.');
      }}>MOCK change amount to 250</button>
      <button onClick={() => void analyze()}>Run MOCK analysis</button>
      <button onClick={() => void analyze('delayed')}>Delayed MOCK analysis</button>
      <button onClick={() => void analyze('timeout')}>MOCK timeout</button>
      <button onClick={() => void analyze('invalid')}>MOCK invalid output</button>
      <button onClick={() => void run(async () => { const result = await ports.guidance(record); message(`MOCK guidance port: ${result.guidanceStatus}; ${result.recommendations.length} fixed decisions; no matching executed.`); })}>Run MOCK guidance port</button>
      <label>Output object <select value={objectId} onChange={e => setObjectId(e.target.value)}><option value="SUMMARY">SUMMARY</option>{record.outputs.filter(o => o.id !== 'SUMMARY').map(o => <option key={o.id}>{o.id}</option>)}</select></label>
      {(['markdown', 'pdf'] as const).map(format => <button key={format} onClick={() => void run(async () => { const blob = await ports.export(record, objectId, format); download(blob, `${record.caseId}_${objectId}.${format === 'pdf' ? 'pdf' : 'md'}`); message(`MOCK ${format} downloaded; same selected object and version.`); })}>Download MOCK {format}</button>)}
      <button onClick={() => void run(async () => { const blob = await ports.export(record, objectId, 'pdf'); const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); message('MOCK PDF opened locally.'); })}>Open MOCK PDF</button>
    </fieldset>
    <p>{record.guidanceStatus !== 'available' ? 'Insufficient approved guidance; human review required' : 'Approved reference package loaded; matching is not implemented here.'}</p>
    {record.outputs.map(o => <article key={o.id}><h3>{o.id} v{o.version} · {runtimeReviewValid(record, o.id, true) ? 'MOCK review current' : 'Review required'}</h3><pre>{o.body}</pre></article>)}
  </section>;
}
