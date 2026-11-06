import { useState } from 'react';
import type { ModuleProps } from '../../../../shared/module-ports';
import type { RuntimeCaseRecord } from '../../../../shared/runtime';
import { activeRecommendations, approvedGuidanceRole, changeGuidanceContext, decideRecommendation, evaluateGuidance, guidanceHandoff, NO_GUIDANCE, recalculateGuidance, recommendationEdited } from '../../../../shared/guidance';
import { factLabel, outputLabel, readableText } from '../../../../shared/presentation';
import './style.css';

type Rec = RuntimeCaseRecord['recommendations'][number];
const recommendationName = (id: string) => ({ 'REC-01': 'Bank assessment request', 'REC-02': 'Telecom assessment request', 'REC-03': 'Message evidence note' }[id] ?? 'Suggested preparation');
const guidelineName = (id: string) => ({ 'EX-G01': 'Bank assessment guidance', 'EX-G02': 'Telecom intake guidance', 'EX-G03': 'Message evidence guidance' }[id] ?? 'Teaching guidance');
function previousDecision(text: string): string {
  try {
    const previous = JSON.parse(text) as { step?: string; decision?: string; reason?: string };
    return [previous.decision, previous.step, previous.reason].filter(Boolean).join(' · ');
  } catch { return text; }
}
function DecisionCard({ rec, active, actor, integrated, commit }: { rec: Rec; active: boolean; actor: string; integrated?: boolean; commit: (id: string, decision: Rec['decision'], actor: string, reason: string, step: string) => void }) {
  const [reason, setReason] = useState(rec.decisionReason ?? ''), [step, setStep] = useState(rec.step);
  const edited = recommendationEdited(rec);
  return <article className={`guidance-card ${active ? '' : 'guidance-inactive'}`} data-testid={`guidance-${rec.id}`}>
    <div className="guidance-card-top"><h3>{integrated ? recommendationName(rec.id) : `${rec.id} · v${rec.version}`}</h3><span className="guidance-badge">{active ? rec.decision === 'pending' ? 'Decision needed' : rec.decision : 'Inactive — history only'}</span></div>
    <p className="guidance-step">{rec.step}</p>
    {edited && <p className="guidance-warning">Employee edited · employee wording; requires final review.</p>}
    <p>{integrated ? readableText(rec.priority.reason) : rec.priority.reason}</p>
    <p>Based on {rec.factRefs.map(f => integrated ? factLabel(f) : `${f.fieldId}${f.recordId ? ` / ${f.recordId}` : ''}`).join(', ')}.</p>
    {rec.simulated && <p className="guidance-warning">Sample decision. Record your own decision before final review.</p>}
    {rec.decision === 'rejected' && <p className="guidance-warning">Rejected: {rec.decisionReason} · Excluded from recommended actions.</p>}
    <details><summary>Sources, uncertainty and boundaries</summary><p>{rec.guidelineRefs.map(g => integrated ? guidelineName(g.id) : `${g.id} v${g.version}`).join(', ')}</p><ul>{rec.limits.map((limit, i) => <li key={i}>{integrated ? readableText(limit) : limit}</li>)}</ul></details>
    <fieldset disabled={!active || !actor.trim()}>
      <legend>{integrated ? 'Choose what to prepare' : `Employee decision for ${rec.id}`}</legend>
      <label>{integrated ? 'Reason for changing or declining' : `Reason for ${rec.id}`}<textarea aria-label={integrated ? `Decision reason for ${recommendationName(rec.id)}` : `Reason for ${rec.id}`} value={reason} onChange={e => setReason(e.target.value)} placeholder="Required for modification or rejection" /></label>
      <details open={!integrated}><summary>Edit the suggested step</summary><label>{integrated ? 'Your preparation step' : `Edited step for ${rec.id}`}<textarea aria-label={integrated ? `Edited step for ${recommendationName(rec.id)}` : `Edited step for ${rec.id}`} value={step} onChange={e => setStep(e.target.value)} /></label></details>
      <div className="guidance-actions">
        <button onClick={() => commit(rec.id, 'accepted', actor, reason, step)}>Accept {integrated ? 'suggestion' : rec.id}</button>
        <button onClick={() => commit(rec.id, 'modified', actor, reason, step)}>Modify {integrated ? 'suggestion' : rec.id}</button>
        <button onClick={() => commit(rec.id, 'rejected', actor, reason, step)}>Reject {integrated ? 'suggestion' : rec.id}</button>
      </div>
    </fieldset>
    <details><summary>Versions and decision history ({rec.history.length})</summary><p>{rec.id} · v{rec.version} · {rec.guidelineRefs.map(g => `${g.id} v${g.version}`).join(', ')}</p>{rec.history.map((h, i) => <div key={i}><p>{h.actor} · {h.reason}</p><p>{previousDecision(h.previous)}</p></div>)}</details>
  </article>;
}

export default function GuidanceModule({ record, onChange, onError, integrated, employeeIdentifier, testMode }: ModuleProps) {
  const [localActor, setActor] = useState(''), [message, setMessage] = useState('');
  const actor = integrated ? employeeIdentifier ?? '' : localActor;
  const evaluation = evaluateGuidance(record), handoff = guidanceHandoff(record);
  const active = new Set(activeRecommendations(record).map(r => r.id));
  const apply = (action: () => RuntimeCaseRecord, success: string) => {
    try { const next = action(); if (next !== record) onChange(next); setMessage(success); }
    catch (error) { const text = error instanceof Error ? error.message : 'Guidance could not be updated.'; setMessage(text); onError({ code: 'GUIDANCE_UPDATE_FAILED', message: text, retryable: true }); }
  };
  return <section className="module-guidance guidance-workspace" aria-label="Guidance and employee decisions">
    <header><h2>Choose next steps</h2><p>Review each suggestion, then accept, change or decline it. Accepted steps are included in your local materials.</p></header>
    {!integrated && <div className="guidance-context">
      <label>Organisation / role<select value={record.role.permissions.length ? record.role.id : 'inactive'} onChange={e => apply(() => changeGuidanceContext(record, e.target.value === 'inactive' ? 'suspend-role' : 'restore-role'), 'Permission context updated; facts and question counts retained.')}>
        <option value={approvedGuidanceRole.id}>{approvedGuidanceRole.organisation} / {approvedGuidanceRole.title}</option>
        <option value="inactive">No drafting authority (restricted context)</option>
      </select></label>
      <label>Employee identifier<input value={actor} onChange={e => setActor(e.target.value)} placeholder="Your identifier; recorded with decisions" /></label>
    </div>}
    {integrated && <p>Decisions recorded by {actor || 'the employee identified in Record case'} · {record.role.organisation} / {record.role.title}</p>}
    <details><summary>Current permission boundaries</summary><p>May: {record.role.permissions.join('; ') || 'No drafting authority.'}</p><p>Excluded: {approvedGuidanceRole.excludedActions.join('; ')}.</p></details>
    {(!integrated || testMode) && <div className="guidance-actions">
      <button className="guidance-primary" onClick={() => apply(() => recalculateGuidance(record), 'Guidance recalculated; employee decisions and edits retained.')}>Recalculate guidance</button>
      <button onClick={() => apply(() => changeGuidanceContext(record, 'suspend-guidance'), 'Guidance suspended; previous steps are inactive.')}>Suspend guidance</button>
      <button onClick={() => apply(() => changeGuidanceContext(record, 'reload-guidance'), 'Approved package reloaded and matched against current facts.')}>Reload approved guidance</button>
    </div>}
    <p className="guidance-feedback" aria-live="polite">{message}</p>
    {(record.needsFactConfirmation || record.facts.some(f => f.reviewStatus === 'unreviewed')) && <p className="guidance-warning">Return to Check information to confirm the latest facts before final review.</p>}
    {evaluation.summaryOnly && <div className="guidance-warning"><strong>{NO_GUIDANCE}</strong><p>Factual summary only. No active handling recommendations or recipient handovers.</p></div>}
    {record.guidanceStatus === 'stale' && <p className="guidance-warning">Guidance context is stale. Reload the approved package to revalidate.</p>}
    <details><summary>Why these suggestions are available</summary>
    {evaluation.matches.length === 0 && <p>No guidelines are configured.</p>}
    <div className="guidance-matches">{evaluation.matches.map((m, i) => <article key={`${m.id}-${i}`}><strong>{integrated ? guidelineName(m.id) : `${m.id} v${m.version}`} · {m.matched ? 'Applicable' : 'Omitted'}</strong>
      <ul>{(m.matched ? ['Current facts and your role support local preparation.', ...m.unknowns] : m.reasons).map((s, j) => <li key={j}>{integrated ? readableText(s) : s}</li>)}</ul>
    </article>)}</div></details>
    {evaluation.recommendations.some(r => !active.has(r.id)) && <p className="guidance-warning">{integrated ? 'Update materials to refresh suggestions against the current facts.' : 'Recalculate guidance to prepare recommendations on the current basis.'}</p>}
    <h3>Suggestions for your decision</h3>
    {active.size > 0 && <p>{activeRecommendations(record).filter(r => r.decision === 'pending' || r.simulated).length} decisions remaining. Then continue to Review and export.</p>}
    {record.recommendations.length === 0 && !evaluation.summaryOnly && <p>Update materials to prepare suggestions from the current facts.</p>}
    {record.recommendations.filter(rec => active.has(rec.id)).map(rec => <DecisionCard key={`${record.instanceId}-${record.caseId}-${rec.id}-${rec.version}`} rec={rec} active actor={actor} integrated={integrated}
      commit={(id, decision, who, reason, step) => apply(() => decideRecommendation(record, id, decision, { actor: who, reason, step }), `${integrated ? recommendationName(id) : id} · ${decision} recorded.`)} />)}
    {record.recommendations.some(rec => !active.has(rec.id)) && <details open={!integrated}><summary>Earlier suggestions — inactive</summary>{record.recommendations.filter(rec => !active.has(rec.id)).map(rec => <DecisionCard key={`${record.instanceId}-${record.caseId}-${rec.id}-${rec.version}`} rec={rec} active={false} actor={actor} integrated={integrated} commit={() => {}} />)}</details>}
    {!evaluation.summaryOnly && <details><summary>Related human responsibilities</summary><ul>{record.role.recipients.filter(p => (p.id === 'HANDOVER-BANK' && evaluation.matches.some(m => m.id === 'EX-G01' && m.matched)) || (p.id === 'HANDOVER-TELCO' && evaluation.matches.some(m => m.id === 'EX-G02' && m.matched))).map(p => <li key={p.id}><strong>{p.title}</strong>: {approvedGuidanceRole.recipientResponsibilities[p.id]}</li>)}</ul></details>}
    {handoff.outputsToRefresh.length > 0 && <p className="guidance-warning">Update required for {handoff.outputsToRefresh.map(id => integrated ? outputLabel(id) : id).join(', ')}. Changed materials need final review.</p>}
    {(!integrated || testMode) && <details><summary>Recommendation versions and output dependencies</summary><pre>{JSON.stringify(handoff, null, 2)}</pre></details>}
  </section>;
}
