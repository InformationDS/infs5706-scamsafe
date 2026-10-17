import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { moduleNames, type ModuleEntry, type ModuleName, type ModulePorts, type ModuleProps, type AnalysisRequest, type AnalysisResponse } from '../../shared/module-ports';
import { makeRuntimeFixture, runtimeVariants } from '../../shared/runtime-fixtures';
import { RuntimeCaseRecordSchema, runtimeDependencies, runtimeReviewValid, ticketCurrent, type RuntimeCaseRecord } from '../../shared/runtime';
import { saveRuntimeCase, loadRuntimeCase, listRuntimeCases, backupRuntimeCase, parseRuntimeBackup, assertImportAllowed } from './runtime-storage';
import { ModelSettings } from './components/ModelSettings';

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

export function ModulePreview({ name }: { name: ModuleName }) {
  const [record, setRecord] = useState(() => makeRuntimeFixture('T09', crypto.randomUUID()));
  const current = useRef(record); current.current = record;
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [variant, setVariant] = useState('T09'), [message, setMessage] = useState('Loading runtime history…');
  const [history, setHistory] = useState<RuntimeCaseRecord[]>([]), [selectedCase, setSelectedCase] = useState('');
  const [failSave, setFailSave] = useState(false), [failOutput, setFailOutput] = useState(false);
  const [pending, setPending] = useState<(() => Promise<void>) | null>(null);
  const requestId = useRef(''), revision = useRef(1);
  const Component = components[name];
  const apply = (next: RuntimeCaseRecord) => { const valid = RuntimeCaseRecordSchema.parse(next); current.current = valid; setRecord(valid); };
  const refresh = async () => setHistory(await listRuntimeCases());
  useEffect(() => {
    let active = true;
    Promise.all([loadRuntimeCase(undefined, name), listRuntimeCases()]).then(([saved, all]) => {
      if (!active) return;
      if (saved) { const restored = { ...saved, instanceId: crypto.randomUUID() }; current.current = restored; setRecord(restored); }
      setHistory(all); setMessage(saved ? 'Saved runtime case restored from this browser.' : 'No runtime history; unsaved MOCK input loaded.');
    }).catch(error => { if (active) setMessage(error.message); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [name]);
  async function save(input = current.current) {
    const saved = await saveRuntimeCase(input, name, failSave);
    if (JSON.stringify(current.current) === JSON.stringify(input)) apply(saved);
    await refresh(); return saved;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); try { await action(); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }
  function guard(action: () => Promise<void>) {
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
    guidance: async input => ({ recommendations: structuredClone(input.recommendations), guidanceStatus: input.guidanceStatus, simulated: true }),
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
  const props: ModuleProps = { record, ports, onChange: next => apply({ ...next, saved: false }), onError: error => setMessage(`${error.code}: ${error.message}`), reset };
  // The public fixture harness stays explicitly simulated even after a real module is installed.
  const mockPorts: ModulePorts = { ...ports,
    export: async (input, objectId, format) => (await post('/api/runtime/export', { case: input, objectId, format, previewMock: true, ...(failOutput ? { fault: 'failure' } : {}) })).blob(),
  };
  async function importBackup(file: File) {
    assertImportAllowed(current.current);
    const next = parseRuntimeBackup(await file.text());
    // File reads are asynchronous; recheck before any replacement.
    assertImportAllowed(current.current);
    const existing = await loadRuntimeCase(next.caseId);
    assertImportAllowed(current.current);
    if (existing && !window.confirm(`Replace saved case ${next.caseId}? Cancel keeps both cases unchanged.`)) { setMessage('Import cancelled; cases retained.'); return; }
    const saved = await saveRuntimeCase(next, name, failSave); requestId.current = ''; apply(saved); await refresh(); setMessage('Backup validated, saved and opened.');
  }
  return <main className="module-preview">
    <h1>{name} independent preview</h1>
    <p>A01-20261017-01 · SYNTHETIC · MOCK ports · No actual employee review or external delivery</p>
    <nav>{moduleNames.map(n => <a key={n} href={`/?module=${n}`}>{n}</a>)}</nav>
    <p>Runtime schema v2 · {record.caseId} · case version {record.version} · {record.saved ? 'Saved' : 'Unsaved'} · {record.followUp.rounds} rounds / {record.followUp.totalQuestions} questions</p>
    <p role="status">{message}</p>
    <fieldset disabled={!ready || busy}>
      <legend>Common preview controls</legend>
      <label>Fixed runtime variant <select value={variant} onChange={e => setVariant(e.target.value)}>{runtimeVariants.map(v => <option key={v.id}>{v.id}</option>)}</select></label>
      <button onClick={reset}>Reset fixed input</button>
      <button onClick={() => void run(async () => { await save(); setMessage('Saved after IndexedDB transaction committed.'); })}>Save runtime case</button>
      <label><input type="checkbox" checked={failSave} onChange={e => setFailSave(e.target.checked)} />Simulate save failure</label>
      <label><input type="checkbox" checked={failOutput} onChange={e => setFailOutput(e.target.checked)} />Simulate output failure</label>
      <button onClick={() => guard(async () => {
        const fresh = makeRuntimeFixture('T09', crypto.randomUUID()); fresh.caseId = `SYN-${crypto.randomUUID()}`;
        requestId.current = ''; apply(fresh); setMessage('New synthetic case; fixed MOCK T09 seed, not free intake.');
      })}>New synthetic case</button>
      <label>Saved case <select aria-label="Saved case" value={selectedCase} onChange={e => setSelectedCase(e.target.value)}><option value="">Select a case</option>{history.map(r => <option key={r.caseId}>{r.caseId}</option>)}</select></label>
      <button disabled={!selectedCase} onClick={() => guard(async () => {
        const next = await loadRuntimeCase(selectedCase); if (!next) throw new Error('Saved case not found.');
        const opened = { ...next, instanceId: crypto.randomUUID() }; await saveRuntimeCase(opened, name, failSave); requestId.current = ''; apply(opened); setMessage('Saved case opened.');
      })}>Open saved case</button>
      <button onClick={() => download(new Blob([backupRuntimeCase(record)], { type: 'application/json' }), `${record.caseId}_runtime.json`)}>Download runtime backup</button>
      <label>Import runtime backup <input type="file" accept=".json" onChange={e => { const file = e.target.files?.[0]; if (file) void run(() => importBackup(file)); e.target.value = ''; }} /></label>
    </fieldset>
    {pending && <section role="dialog" aria-label="Unsaved runtime changes"><p>Current changes are unsaved.</p>
      <button disabled={busy} onClick={() => void run(async () => { await save(); const action = pending; setPending(null); await action(); })}>Save and continue</button>
      <button disabled={busy} onClick={() => { const action = pending; setPending(null); void run(action); }}>Discard changes and continue</button>
      <button disabled={busy} onClick={() => { setPending(null); setMessage('Cancelled; current input retained.'); }}>Cancel</button>
    </section>}
    <section className={`module-${name}`}>
      {Component && <Suspense fallback={<p>Loading module…</p>}><Component {...props} /></Suspense>}
      <MockModule {...props} ports={mockPorts} installed={!!Component} name={name} analyze={analyze} message={setMessage} run={run} ready={ready} />
    </section>
    <details><summary>Fixed actions and expectations</summary><pre>{JSON.stringify(runtimeVariants.find(v => v.id === variant), null, 2)}</pre></details>
    <details><summary>Shared runtime record</summary><pre data-testid="runtime-record">{JSON.stringify(record, null, 2)}</pre></details>
    {name === 'model' && <ModelSettings onSaved={() => { requestId.current = ''; revision.current++; setMessage('Settings saved; old analysis invalidated. No provider called.'); }} />}
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
