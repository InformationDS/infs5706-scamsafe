import { useState } from 'react';
import { ModelSettings } from '../components/ModelSettings';
import { useWorkbenchCase } from './useWorkbenchCase';
import { ConversationPane } from './ConversationPane';
import type { RuntimeCaseRecord } from '../../../shared/runtime';
import type { FactRecord, Target } from '../../../shared/schema';
import { deriveAnalysisUpdate } from '../../../shared/workbench-case';
import { currentFactGaps } from '../../../shared/case-gaps';
import { factValueLabel, targetLabel } from '../../../shared/field-labels';
import './workbench.css';

export function CaseWorkbench() {
  const w = useWorkbenchCase();
  const [selected, setSelected] = useState('');
  const stage = !w.record || !w.record.sources.length ? 0 : !w.record.reviews.some(r => r.stage === 'first') || w.record.needsFactConfirmation ? 1 : w.record.followUp.stopped ? 3 : 2;
  return <main className="case-workbench">
    <header><h1>ScamSafe workbench <small>Candidate · synthetic</small></h1>
      <p>{w.record ? `${w.record.caseId} · ${w.record.role.organisation} / ${w.record.role.title} · ${w.record.saved ? 'Saved' : 'Unsaved'}` : 'No case open'}</p>
      <label>Employee identifier <input value={w.actor} onChange={e => w.updateActor(e.target.value)} /></label>
      <nav><a href="/">Integration test workspace</a> <a href="/?module=intake">Test workspace</a></nav>
    </header>
    <p role="status">{w.notice}</p>
    <ol className="workbench-progress" aria-label="Case progress">{['Record case', 'Check information', 'Add information', 'Prepare materials', 'Review and export'].map((label, index) => <li key={label} aria-current={index === stage ? 'step' : undefined}>{label}</li>)}</ol>
    {w.saveStage && <p><button disabled={w.busy} onClick={() => void w.retrySave()}>{w.saveStage === 'result' ? 'Retry save' : w.saveContext === 'Sending' ? 'Retry recording message' : w.saveContext === 'Record clarification' ? 'Retry recording clarification' : 'Retry recording analysis'}</button></p>}
    <fieldset className="case-controls" disabled={!w.ready || w.busy}><legend>Cases and storage</legend>
      <button onClick={w.newCase}>New case</button>
      <button disabled={!w.record} onClick={() => void w.run(async () => { await w.save(); w.setNotice('Case saved locally.'); })}>Save case</button>
      <label>Saved case <select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select a case</option>{w.history.map(r => <option key={r.caseId} value={r.caseId}>{r.caseId}</option>)}</select></label>
      <button disabled={!selected} onClick={() => w.openCase(selected)}>Open saved case</button>
      <button disabled={!w.record} onClick={w.downloadBackup}>Download backup</button>
      <label>Import backup <input type="file" accept=".json,application/json" onChange={e => { const file = e.target.files?.[0]; if (file) void w.run(() => w.importBackup(file)); e.target.value = ''; }} /></label>
      <label><input type="checkbox" checked={w.failSave} onChange={e => w.setFailSave(e.target.checked)} /> Simulate save failure</label>
    </fieldset>
    {w.pending && <section role="dialog" aria-label="Unsaved case changes"><p>Current case changes are unsaved.</p>
      <button disabled={w.busy} onClick={() => void w.run(async () => { const action = w.pending; if (!action) return; await w.save(); w.setPending(null); await action(); })}>Save and continue</button>
      <button disabled={w.busy} onClick={() => { const action = w.pending; if (!action) return; w.setPending(null); void w.run(action); }}>Discard changes and continue</button>
      <button disabled={w.busy} onClick={() => { w.setPending(null); w.setNotice('Cancelled; current case retained.'); }}>Cancel</button>
    </section>}
    <div className="workbench-columns">
      <section aria-label="Information and workflow"><h2>Information and workflow</h2>
        {!w.record ? <><label>Configured role <select value={w.roleSelected ? 'role' : ''} onChange={e => w.setRoleSelected(!!e.target.value)}><option value="">Select a role</option><option value="role">SYN Bank A / Intake Officer</option></select></label> <button disabled={!w.ready || w.busy || !w.roleSelected} onClick={w.start}>Start case</button></> : <>
          <p>Case information: {w.record.facts.length} facts recorded · {w.record.followUp.rounds} rounds · {w.record.followUp.totalQuestions} questions.</p>
          <p>Guidance, materials and export: pending implementation.</p>
          <p>Analysis: {w.record.conversation || w.record.analysisUpdate ? deriveAnalysisUpdate(w.record).state.status : w.record.sources.length ? 'previous' : 'not started'} · {w.record.analysis.types.join(', ') || 'No candidate type'}</p>
          {w.record.facts.filter(f => f.fieldId !== 'A07').map(f => <p key={`${f.fieldId}:${f.recordId ?? ''}`}>{targetLabel(f)} ({f.fieldId}): {factValueLabel(f.value)}</p>)}
          <div data-testid="current-gaps"><h3>Current unresolved information</h3>{currentFactGaps(w.record).map(g => <p key={`${g.target.fieldId}:${g.target.recordId ?? ''}`}>{targetLabel(g.target)} ({g.target.fieldId}) · {g.reason}</p>)}</div>
          <FactCorrection record={w.record} disabled={!!w.saveStage || (w.busy && w.phase !== 'network')} reportDraft={w.reportDraft} correct={w.correctFact} />
          {w.record.conversation?.messages.some(m => m.status === 'applied') && (!w.record.reviews.some(r => r.stage === 'first') || w.record.needsFactConfirmation) && <button disabled={w.busy || !!w.saveStage} onClick={() => void w.confirmFacts()}>Confirm current facts</button>}
          {w.proposals.length > 0 && <button disabled={w.busy || !!w.saveStage || !!w.draftKeys.length || !!deriveAnalysisUpdate(w.record).blockers.length || !w.record.reviews.some(r => r.stage === 'first')} onClick={() => void w.displayQuestions()}>Save and display proposed questions</button>}
          {w.record.reviews.some(r => r.stage === 'first') && !w.record.needsFactConfirmation && !w.record.followUp.stopped && w.record.followUp.rounds < 3 && w.record.followUp.totalQuestions < 9 && !w.record.followUp.questions.some(q => q.status === 'pending') && !w.proposals.length && <button disabled={w.busy || !!w.saveStage} onClick={() => void w.displayQuestions()}>Continue follow-up</button>}
          <button disabled={w.busy || !!w.saveStage} onClick={() => void w.reanalyze()}>Reanalyze current case</button>
          <details><summary>Current case data</summary><pre data-testid="workbench-record">{JSON.stringify(w.record, null, 2)}</pre></details>
        </>}
      </section>
      {w.record ? <ConversationPane key={w.record.instanceId} record={w.record} busy={w.busy} composer={w.composer} changeComposer={w.changeComposer} sendMessage={w.sendMessage} retryMessage={w.retryMessage} markUnknown={w.markUnknown} markNotApplicable={w.markNotApplicable} clarifyMessage={w.clarifyMessage} resolveEarlierAnswer={w.resolveEarlierAnswer} reportDraft={w.reportDraft} endFollowUp={w.endFollowUp} otherDrafts={w.draftKeys.filter(k => k !== 'composer')} saveStage={w.saveStage} localCorrectionPending={w.localCorrectionPending} /> : <section aria-label="Case conversation"><h2>Case conversation</h2><p>Start or open a case to enter a message.</p></section>}
    </div>
    <ModelSettings onSaved={w.invalidateSettings} />
  </main>;
}

function FactCorrection(p: { record: RuntimeCaseRecord; disabled: boolean; reportDraft: (key: string, dirty: boolean) => void; correct: (target: Target, value: FactRecord['value'], reason: string) => boolean }) {
  const [targetKey, setTargetKey] = useState(''), [value, setValue] = useState(''), [reason, setReason] = useState('');
  const key = 'fact:correction';
  const facts = p.record.facts.filter(f => /^[B-J]/.test(f.fieldId) && !Array.isArray(f.value));
  const fact = facts.find(f => `${f.fieldId}:${f.recordId ?? ''}` === targetKey);
  function updateDraft(nextTarget: string, nextValue: string, nextReason: string) { p.reportDraft(key, !!(nextTarget || nextValue || nextReason)); }
  function apply() {
    if (!fact) return;
    let parsed: FactRecord['value'] = value;
    if (value === 'unknown') parsed = null;
    else if (typeof fact.value === 'boolean' || ['C08', 'F01', 'G01', 'G05', 'H08'].includes(fact.fieldId)) { if (value !== 'true' && value !== 'false') return; parsed = value === 'true'; }
    else if (fact.fieldId === 'E04' || typeof fact.value === 'number') { if (!value.trim() || !Number.isFinite(Number(value))) return; parsed = Number(value); }
    p.reportDraft(key, false);
    if (p.correct({ fieldId: fact.fieldId, ...(fact.recordId ? { recordId: fact.recordId } : {}) }, parsed, reason)) { setTargetKey(''); setValue(''); setReason(''); }
    else p.reportDraft(key, true);
  }
  return <details id="fact-correction"><summary>Correct an existing fact</summary>
    <label>Fact target <select value={targetKey} disabled={p.disabled} onChange={e => { setTargetKey(e.target.value); updateDraft(e.target.value, value, reason); }}><option value="">Select a fact</option>{facts.map(f => <option key={`${f.fieldId}:${f.recordId ?? ''}`} value={`${f.fieldId}:${f.recordId ?? ''}`}>{f.fieldId}{f.recordId ? ` / ${f.recordId}` : ''}</option>)}</select></label>
    <label>Corrected value <input value={value} disabled={p.disabled} onChange={e => { setValue(e.target.value); updateDraft(targetKey, e.target.value, reason); }} /></label>
    <label>Correction reason <input value={reason} disabled={p.disabled} onChange={e => { setReason(e.target.value); updateDraft(targetKey, value, e.target.value); }} /></label>
    <p>Use true, false or unknown for boolean facts; use unknown to withdraw a value.</p>
    <button disabled={p.disabled || !fact || !value.trim() || !reason.trim()} onClick={apply}>Record fact correction</button>
    {(targetKey || value || reason) && <button disabled={p.disabled} onClick={() => { setTargetKey(''); setValue(''); setReason(''); p.reportDraft(key, false); }}>Discard fact correction</button>}
  </details>;
}
