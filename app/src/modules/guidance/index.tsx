import { useState } from 'react';
import type { ModuleProps } from '../../../../shared/module-ports';
import type { RuntimeCaseRecord } from '../../../../shared/runtime';
import { activeRecommendations, approvedGuidanceRole, changeGuidanceContext, decideRecommendation, evaluateGuidance, guidanceHandoff, NO_GUIDANCE, recalculateGuidance, recommendationEdited } from '../../../../shared/guidance';
import './style.css';

type Rec = RuntimeCaseRecord['recommendations'][number];
function DecisionCard({ rec, active, actor, commit }: { rec: Rec; active: boolean; actor: string; commit: (id: string, decision: Rec['decision'], actor: string, reason: string, step: string) => void }) {
  const [reason, setReason] = useState(rec.decisionReason ?? ''), [step, setStep] = useState(rec.step);
  const edited = recommendationEdited(rec);
  return <article className={`guidance-card ${active ? '' : 'guidance-inactive'}`} data-testid={`guidance-${rec.id}`}>
    <div className="guidance-card-top"><h3>{rec.id} · v{rec.version}</h3><span className="guidance-badge">{active ? rec.decision : 'Inactive — history only'}</span></div>
    <p className="guidance-step">{rec.step}</p>
    {edited && <p className="guidance-warning">Employee edited · employee wording; requires final review.</p>}
    <p>{rec.responsibleRole} · Priority {rec.priority.order}: {rec.priority.reason}</p>
    <p>Basis: {rec.guidelineRefs.map(g => `${g.id} v${g.version}`).join(', ')} · Facts: {rec.factRefs.map(f => `${f.fieldId}${f.recordId ? ` / ${f.recordId}` : ''}`).join(', ')}</p>
    <p>{rec.simulated ? 'Injected MOCK decision; no actual employee review.' : 'Local decision record; final review is separate.'} Acceptance means preparation only.</p>
    {rec.decision === 'rejected' && <p className="guidance-warning">Rejected: {rec.decisionReason} · Excluded from recommended actions.</p>}
    <details><summary>Sources, uncertainty and boundaries</summary><ul>{rec.limits.map((limit, i) => <li key={i}>{limit}</li>)}</ul></details>
    <fieldset disabled={!active}>
      <legend>Employee decision for {rec.id}</legend>
      <label>Reason for {rec.id}<textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Required for modification or rejection" /></label>
      <label>Edited step for {rec.id}<textarea value={step} onChange={e => setStep(e.target.value)} /></label>
      <div className="guidance-actions">
        <button onClick={() => commit(rec.id, 'accepted', actor, reason, step)}>Accept {rec.id}</button>
        <button onClick={() => commit(rec.id, 'modified', actor, reason, step)}>Modify {rec.id}</button>
        <button onClick={() => commit(rec.id, 'rejected', actor, reason, step)}>Reject {rec.id}</button>
      </div>
    </fieldset>
    <details><summary>Decision history ({rec.history.length})</summary>{rec.history.map((h, i) => <div key={i}><p>{h.actor}: {h.reason}</p><pre>{h.previous}</pre></div>)}</details>
  </article>;
}

export default function GuidanceModule({ record, onChange, onError }: ModuleProps) {
  const [actor, setActor] = useState(''), [message, setMessage] = useState('');
  const evaluation = evaluateGuidance(record), handoff = guidanceHandoff(record);
  const active = new Set(activeRecommendations(record).map(r => r.id));
  const apply = (action: () => RuntimeCaseRecord, success: string) => {
    try { const next = action(); if (next !== record) onChange(next); setMessage(success); }
    catch (error) { const text = error instanceof Error ? error.message : 'Guidance could not be updated.'; setMessage(text); onError({ code: 'GUIDANCE_UPDATE_FAILED', message: text, retryable: true }); }
  };
  return <section className="module-guidance guidance-workspace" aria-label="Guidance and employee decisions">
    <header><p className="guidance-kicker">SYNTHETIC CASE · APPROVED TEACHING GUIDANCE</p><h2>Guidance & next steps</h2><p>Review the basis, then choose what to prepare. No account action, sending or referral is performed.</p></header>
    <div className="guidance-context">
      <label>Organisation / role<select value={record.role.permissions.length ? record.role.id : 'inactive'} onChange={e => apply(() => changeGuidanceContext(record, e.target.value === 'inactive' ? 'suspend-role' : 'restore-role'), 'Permission context updated; facts and question counts retained.')}>
        <option value={approvedGuidanceRole.id}>{approvedGuidanceRole.organisation} / {approvedGuidanceRole.title}</option>
        <option value="inactive">No drafting authority (restricted context)</option>
      </select></label>
      <label>Employee identifier<input value={actor} onChange={e => setActor(e.target.value)} placeholder="Your identifier; recorded with decisions" /></label>
    </div>
    <details><summary>Current permission boundaries</summary><p>May: {record.role.permissions.join('; ') || 'No drafting authority.'}</p><p>Excluded: {approvedGuidanceRole.excludedActions.join('; ')}.</p></details>
    <div className="guidance-actions">
      <button className="guidance-primary" onClick={() => apply(() => recalculateGuidance(record), 'Guidance recalculated; employee decisions and edits retained.')}>Recalculate guidance</button>
      <button onClick={() => apply(() => changeGuidanceContext(record, 'suspend-guidance'), 'Guidance suspended; previous steps are inactive.')}>Suspend guidance</button>
      <button onClick={() => apply(() => changeGuidanceContext(record, 'reload-guidance'), 'Approved package reloaded and matched against current facts.')}>Reload approved guidance</button>
    </div>
    <p className="guidance-feedback" aria-live="polite">{message}</p>
    {record.needsFactConfirmation || record.facts.some(f => f.reviewStatus === 'unreviewed') ? <p className="guidance-warning">Reported — not yet checked. Confirm current facts before final review.</p> : <p>Facts retain their recorded review status. Final review of recommendations is still required.</p>}
    {evaluation.summaryOnly && <div className="guidance-warning"><strong>{NO_GUIDANCE}</strong><p>Factual summary only. No active handling recommendations or recipient handovers.</p></div>}
    {record.guidanceStatus === 'stale' && <p className="guidance-warning">Guidance context is stale. Reload the approved package to revalidate.</p>}
    <h3>Guideline applicability</h3>
    {evaluation.matches.length === 0 && <p>No guidelines are configured.</p>}
    <div className="guidance-matches">{evaluation.matches.map((m, i) => <article key={`${m.id}-${i}`}><strong>{m.id} v{m.version} · {m.matched ? 'Applicable' : 'Omitted'}</strong>
      <ul>{(m.matched ? ['Required facts, role and approved source context support local preparation.', ...m.unknowns] : m.reasons).map((s, j) => <li key={j}>{s}</li>)}</ul>
    </article>)}</div>
    {evaluation.recommendations.some(r => !active.has(r.id)) && <p className="guidance-warning">Recalculate guidance to prepare recommendations on the current basis.</p>}
    <h3>Employee recommendations</h3>
    {record.recommendations.length === 0 && <p>No stored recommendations. Recalculate when applicable guidance is available.</p>}
    {record.recommendations.map(rec => <DecisionCard key={`${record.instanceId}-${record.caseId}-${rec.id}-${rec.version}`} rec={rec} active={active.has(rec.id)} actor={actor}
      commit={(id, decision, who, reason, step) => apply(() => decideRecommendation(record, id, decision, { actor: who, reason, step }), `${id}: ${decision} recorded; no action performed.`)} />)}
    {!evaluation.summaryOnly && <details><summary>Related human responsibilities</summary><ul>{record.role.recipients.filter(p => (p.id === 'HANDOVER-BANK' && evaluation.matches.some(m => m.id === 'EX-G01' && m.matched)) || (p.id === 'HANDOVER-TELCO' && evaluation.matches.some(m => m.id === 'EX-G02' && m.matched))).map(p => <li key={p.id}><strong>{p.title}</strong>: {approvedGuidanceRole.recipientResponsibilities[p.id]}</li>)}</ul></details>}
    {handoff.outputsToRefresh.length > 0 && <p className="guidance-warning">Dependent output update required: {handoff.outputsToRefresh.join(', ')}. Retained draft bodies are history pending the output module update and final review.</p>}
    <details><summary>Recommendation versions and output dependencies</summary><pre>{JSON.stringify(handoff, null, 2)}</pre></details>
    <p className="guidance-footnote">No approved risk notice triggers are configured in this package.</p>
  </section>;
}
