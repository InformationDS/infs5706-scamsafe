import { useEffect, useRef, useState } from 'react';
import { answerQuestion, confirmFacts, correctFact, fixtureNames, makeFixture, reviewOutput, sourceText, stopFollowUp, type CaseRecord } from '../../shared';
import { backupCase, loadCase, parseBackup, saveCase } from './storage';
import { CasePanel } from './components/CasePanel';
import { AnalysisPanel } from './components/AnalysisPanel';
import { downloadBlob, OutputPanel } from './export/OutputPanel';
import type { BusinessBaseline } from '../../shared/business';
import { ModelSettings } from './components/ModelSettings';

export function Workbench() {
  const [record, setRecord] = useState<CaseRecord>(() => ({ ...makeFixture('intake'), saved: false }));
  const current = useRef(record);
  const [fixture, setFixture] = useState('intake');
  const [message, setMessage] = useState('Loading local history…');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [modelBusy, setModelBusy] = useState(false);
  const [result, setResult] = useState<unknown>(undefined);
  const request = useRef(0);
  const settingsChanged = useRef(false);
  const [failSave, setFailSave] = useState(false);
  const [health, setHealth] = useState('Checking local service');
  const [business, setBusiness] = useState<BusinessBaseline>();
  const [businessError, setBusinessError] = useState('Loading approved business reference…');
  const update = (next: CaseRecord) => { current.current = next; setRecord(next); };

  useEffect(() => {
    let active = true;
    loadCase().then(saved => {
      if (!active) return;
      if (saved) { update(saved); setMessage('Saved training case restored from this browser.'); }
      else setMessage('No saved history. Load a fixed training state to begin.');
    }).catch(error => { if (active) setMessage((error as Error).message); }).finally(() => { if (active) setReady(true); });
    fetch('/api/health').then(response => response.json()).then(data => { if (active && !settingsChanged.current) setHealth(`Adapter: ${data.mode} · ${data.configured ? 'configured' : 'credentials not configured'}`); }).catch(() => { if (active && !settingsChanged.current) setHealth('Local service unavailable'); });
    fetch('/api/business').then(async response => { if (!response.ok) throw new Error('Approved business reference unavailable. Check its structure and approval hashes.'); return response.json(); }).then(data => { if (active) setBusiness(data); }).catch(error => { if (active) setBusinessError((error as Error).message); });
    return () => { active = false; };
  }, []);

  async function persist(next: CaseRecord, success: string) {
    setSaving(true); update({ ...next, saved: false });
    try { const saved = await saveCase(next, failSave || next.stage === 'save-error'); update(saved); setMessage(success); }
    catch (error) { update({ ...next, saved: false }); setMessage((error as Error).message); }
    finally { setSaving(false); }
  }
  async function operate(operation: (value: CaseRecord) => CaseRecord, success: string) {
    try { await persist(operation(current.current), success); } catch (error) { setMessage((error as Error).message); }
  }
  async function analyze(fault?: 'timeout' | 'invalid' | 'delayed') {
    const id = ++request.current; const input = current.current; setModelBusy(true); setMessage('Analyzing current training input…');
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case: input, ...(fault ? { fault } : {}) }) });
      const payload = await response.json();
      if (id !== request.current) return;
      if (input !== current.current) { setMessage('Outdated result ignored. Current facts and review state were retained.'); return; }
      if (!response.ok) throw new Error(payload.error?.message ?? 'Analysis failed. Saved results were retained.');
      setResult(payload); setMessage(`Received ${payload.meta.mode} adapter result for case v${payload.meta.caseVersion}. Shown for comparison; case facts were retained.`);
    } catch (error) { if (id === request.current) setMessage((error as Error).message); }
    finally { if (id === request.current) setModelBusy(false); }
  }
  async function restore(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error('Backup exceeds the supported 1 MB size. Current case was kept.');
      await persist(parseBackup(await file.text()), 'Training backup validated, saved and restored.');
    } catch (error) { setMessage(`Backup rejected: ${(error as Error).message}`); }
  }
  return <main>
    <header><div className="brand"><span className="logo">S</span><div><h1>ScamSafe <span>Foundation Workbench</span></h1><p>One shared case · fixed inputs · verifiable outputs</p></div></div><div className="environment">LOCAL DEVELOPMENT<span>{health}</span></div></header>
    <div className="banner"><strong>SYNTHETIC / MOCK</strong><span>Approved business references are separate from these legacy training states. All review actions below are simulations. No account operation or external delivery.</span></div>
    <ModelSettings onSaved={summary => {
      settingsChanged.current = true; request.current++; setModelBusy(false); setResult(undefined);
      setHealth(`Adapter: ${summary.mode} · ${summary.hasApiKey && summary.baseUrl && summary.model ? 'configured' : 'credentials not configured'}`);
      setMessage('Model settings changed. Previous adapter results were cleared; case facts and reviews were retained.');
    }} />
    <section className="toolbar card"><div><label>Fixed training state<select value={fixture} onChange={event => setFixture(event.target.value)}>{fixtureNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label><button className="primary" disabled={!ready || saving} onClick={() => { setResult(undefined); persist(makeFixture(fixture), `Loaded and saved ${fixture} training state.`); }}>Load training state</button></div><div className="case-meta"><strong>{record.caseId}</strong><span>{record.evaluationId} · case v{record.version} · {record.stage}</span><span className={record.saved ? 'status good' : 'status'}>{record.saved ? 'Saved locally' : 'Unsaved'}</span></div></section>
    <div className="message" role="status" aria-live="polite">{saving ? 'Saving local transaction…' : message}</div>
    <div className="columns"><div>
      <section className="card"><h2>Approved business reference</h2>{business ? <><p><strong>{business.approval.id} · content v{business.approval.contentVersion}</strong></p><p>{business.role.organisation} / {business.role.title}</p><p>{business.guidelines.map(g => `${g.id} v${g.version}`).join(' · ')}</p><p className="muted">{business.baseline.evaluationId} / {business.baseline.caseId} · {business.baseline.expectedChecks.length} approved reference checks. Content approval is not staff case review or test execution.</p><a href="/api/business" target="_blank" rel="noreferrer">Open approved reference JSON</a></> : <p className="notice">{businessError}</p>}</section>
      <section className="card"><h2>Role & working boundary</h2><p><strong>{record.role.organisation} / {record.role.title}</strong></p><p className="muted">Teaching profile · approval pending · business configuration disabled</p><p>{record.role.permissions.join(' · ')}</p><p className="notice">Insufficient approved guidance; human review required</p></section>
      <CasePanel record={record} />
      <OutputPanel record={record} report={setMessage} />
    </div><aside>
      <section className="card"><h2>Fixed input & operations</h2><details><summary>Original report · S1–S5</summary><p className="source-text">{sourceText.narrative}</p></details><p className="muted">Operations use the shared state functions. Load another state for an independent variant.</p>
        <fieldset disabled={!ready || saving}><div className="stack">
          <button onClick={() => operate(value => correctFact(value, { fieldId: 'E04', recordId: 'TX-01' }, 200, sourceText.correction), 'Amount corrected to AUD 200; original value and history retained.')}>Correct TX-01 amount to AUD 200</button>
          <button onClick={() => operate(confirmFacts, 'Current facts confirmed in training simulation.')}>Simulate first fact review</button>
          <button onClick={() => operate(value => answerQuestion(value, 'Q1', sourceText.answer1, 'answered', [{ target: { fieldId: 'E09', recordId: 'TX-01' }, value: 'reported pending' }]), 'Q1 answer saved; other questions and counts retained.')}>Answer Q1: The app says pending.</button>
          <button onClick={() => operate(stopFollowUp, 'Questioning ended. Remaining pending questions were skipped.')}>End questioning</button>
          <button onClick={() => operate(value => reviewOutput(value, 'SUMMARY'), 'Training final review saved. Legacy training case remains pending; this review is simulated.')}>Simulate final summary review</button>
        </div></fieldset>
      </section>
      <section className="card"><h2>Adapter & recovery checks</h2><p className="muted">Mock replays fixed inputs. Model results are displayed for comparison, with no automatic overwrite.</p><div className="actions"><button className="primary" disabled={modelBusy} onClick={() => analyze()}>Run adapter</button><button disabled={modelBusy} onClick={() => analyze('timeout')}>Simulate timeout</button><button disabled={modelBusy} onClick={() => analyze('invalid')}>Simulate invalid output</button><button disabled={modelBusy} onClick={() => analyze('delayed')}>Delayed response</button></div>
        <label className="checkbox"><input type="checkbox" checked={failSave} onChange={event => setFailSave(event.target.checked)} />Simulate next save failure</label><button disabled={saving || !ready} onClick={() => persist({ ...current.current, stage: current.current.stage === 'save-error' ? 'reviewed' : current.current.stage }, 'Current state saved locally.')}>Retry save</button>
      </section>
      <AnalysisPanel record={record} result={result} />
      <section className="card"><h2>Local backup</h2><p className="muted">This browser and origin only. JSON backups move synthetic records between Windows and macOS. Content approval stays pending.</p><button disabled={!ready || saving} onClick={() => downloadBlob(new Blob([backupCase(record)], { type: 'application/json' }), 'EXAMPLE-01_training-backup.json')}>Download JSON backup</button><label className="file-label">Restore training JSON<input type="file" accept=".json,application/json" disabled={!ready || saving} onChange={event => { restore(event.target.files?.[0]); event.target.value = ''; }} /></label></section>
    </aside></div><footer>Foundation for component, prompt, content and output development · No real-model or full business acceptance claimed</footer>
  </main>;
}
