import { useMemo } from 'react';
import type { FactRecord, Target } from '../../../../shared/schema';
import type { ModuleProps } from '../../../../shared/module-ports';
import { currentFactGaps, isFieldGap } from '../../../../shared/case-gaps';
import { useIntake } from './useIntake';
import './style.css';

const valueText = (value: FactRecord['value']) => value === null ? 'Unknown' : Array.isArray(value) ? value.join(', ') : String(value);
const inputValue = (fact: FactRecord) => fact.value === null ? '' : Array.isArray(fact.value) ? fact.value.join(', ') : String(fact.value);
function targetLabel(fact: Target) { return `${fact.fieldId}${fact.recordId ? ` / ${fact.recordId}` : ''}`; }
function correctionValue(fact: FactRecord, raw: string): FactRecord['value'] {
  const value = raw.trim();
  if (!value) return null;
  if (fact.fieldId === 'E04') { const n = Number(value.replace(/[,$\s]/g, '')); if (!Number.isFinite(n) || !/\d/.test(value)) throw new Error('Enter a numeric amount, or leave the value blank to record it as unknown.'); return n; }
  if (['C08', 'F01', 'G01', 'G05', 'H08'].includes(fact.fieldId)) return value === 'true' ? true : value === 'false' ? false : null;
  if (Array.isArray(fact.value)) return value.split(',').map(item => item.trim()).filter(Boolean);
  return value;
}
function amountGroups(facts: FactRecord[]) {
  const ids = [...new Set(facts.filter(fact => ['E04', 'E05', 'E09'].includes(fact.fieldId)).map(fact => fact.recordId).filter((id): id is string => !!id))];
  const groups = new Map<string, { currency: string; status: string; total: number; records: string[] }>();
  const unknown: string[] = [];
  for (const id of ids) {
    const get = (fieldId: string) => facts.find(fact => fact.fieldId === fieldId && fact.recordId === id);
    const amount = get('E04'), currency = get('E05'), status = get('E09');
    if (amount?.status === 'conflict' || typeof amount?.value !== 'number' || currency?.status === 'conflict' || typeof currency?.value !== 'string') { unknown.push(`${id}: amount/currency unknown or conflicting`); continue; }
    const state = status?.status === 'conflict' ? 'conflict' : status?.value == null ? 'unknown' : String(status.value);
    const key = `${currency.value}:${state}`, group = groups.get(key) ?? { currency: currency.value, status: state, total: 0, records: [] };
    group.total += amount.value; group.records.push(id); groups.set(key, group);
  }
  return { groups: [...groups.values()], unknown };
}

export default function IntakeModule(props: ModuleProps) {
  const { record, ports } = props;
  const intake = useIntake(props);
  const review = record.reviews.some(item => item.stage === 'first');
  const totals = useMemo(() => amountGroups(record.facts), [record.facts]);
  const sources = new Map(record.sources.map(source => [source.id, source]));
  return <section className="module-intake" aria-label="B01 case intake and follow-up">
    <header className="intake-heading"><div><p className="intake-eyebrow">B01 · FR-02–FR-05</p><h2>Case intake and fact check</h2>
      <p>Structured proposals support the employee’s review. Reported information is not independently verified.</p></div>
      <button type="button" disabled={intake.busy || !intake.narrative.trim()} onClick={() => void intake.runAnalysis()}>Analyze current description</button>
    </header>
    <p className="intake-notice" role="status">{intake.notice || 'Enter or edit the caller’s description, then request analysis.'}</p>
    <section className="intake-card">
      <h3>Original caller description</h3>
      <label>Source text <textarea value={intake.narrative} onChange={event => intake.setNarrative(event.target.value)} rows={7} placeholder="Enter the caller’s own words…" /></label>
      <small>Original wording is retained as a narrative source before analysis. Do not enter passwords, one-time codes, full account numbers, or identity document numbers.</small>
    </section>

    <section className="intake-card">
      <div className="intake-section-title"><h3>Suspected types and alternatives</h3><span className={`intake-status ${record.analysis.source}`}>{record.analysis.source} proposal</span></div>
      {record.analysisUpdate && record.analysisUpdate.status !== 'current' && <p className="intake-notice">Previous analysis — {record.analysisUpdate.status}. Analyze the current description again before treating it as current.</p>}
      {record.analysis.types.length ? <ul className="intake-tags">{record.analysis.types.map((type, index) => <li key={`${type}-${index}`}>{type}</li>)}</ul> : <p className="intake-muted">No type proposal yet. Multiple types or insufficient information may be retained.</p>}
      <div className="intake-type-edit"><label>Suspected types (comma-separated; clear for insufficient information)<input aria-label="Correct suspected types" value={intake.typeDraft} onChange={event => intake.setTypeDraft(event.target.value)} placeholder="e.g. suspected phishing, payment redirection" /></label><button type="button" disabled={intake.busy && !intake.requestPending} onClick={intake.correctTypes}>Apply type correction</button></div>
      <p className="intake-muted">Type labels remain employee-reviewed candidates, not a determination that a scam occurred.</p>
      <h4>Reasons</h4>{record.analysis.reasons.length ? <ul>{record.analysis.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul> : <p className="intake-muted">No reasons recorded.</p>}
      <h4>Alternative explanations</h4>{record.analysis.alternatives.length ? <ul>{record.analysis.alternatives.map((reason, index) => <li key={index}>{reason}</li>)}</ul> : <p className="intake-muted">No alternatives recorded.</p>}
      {(currentFactGaps(record).length > 0 || record.analysis.gaps.some(gap => !isFieldGap(gap))) && <><h4>Information gaps</h4><ul>{currentFactGaps(record).map(gap => <li key={`${gap.target.fieldId}:${gap.target.recordId ?? ''}`}>Unresolved {gap.target.fieldId}:{gap.target.recordId ?? ''}</li>)}{record.analysis.gaps.filter(gap => !isFieldGap(gap)).map((gap, index) => <li key={`note-${index}`}>{gap}</li>)}</ul></>}
      {!!record.analysisGapHistory?.length && <details><summary>Previous analysis notes</summary>{record.analysisGapHistory.map((entry, index) => <ul key={`${entry.analysisVersion}-${index}`}>{entry.gaps.map((gap, i) => <li key={i}>{gap}</li>)}</ul>)}</details>}
    </section>

    <section className="intake-card">
      <div className="intake-section-title"><h3>Facts and candidate conflicts</h3><span className="intake-status">{record.facts.length} targets</span></div>
      <p className="intake-muted">Repeated facts remain separate by field and record ID. Unknown values stay empty; amounts are not treated as zero.</p>
      <label className="intake-reason">Correction reason <input value={intake.correctionReason} onChange={event => intake.setCorrectionReason(event.target.value)} /></label>
      <div className="intake-table-wrap"><table><thead><tr><th>Field / record</th><th>Current value</th><th>Status</th><th>Sources</th><th>Correction</th></tr></thead><tbody>
        {record.facts.map((fact, index) => {
          const key = `${fact.fieldId}:${fact.recordId ?? ''}`, raw = intake.drafts[key] ?? inputValue(fact);
          return <tr key={key || index}>
            <td><code>{targetLabel(fact)}</code></td>
            <td>{fact.value === null ? <em>Unknown</em> : valueText(fact.value)}</td>
            <td><span className={`intake-status ${fact.status}`}>{fact.status} · {fact.reviewStatus}</span>
              {fact.candidates.length > 0 && <div className="intake-candidates"><strong>{fact.status === 'conflict' ? 'Conflicting proposals' : 'Earlier proposals retained'}</strong>{fact.candidates.map((candidate, ci) => <p key={ci}>{valueText(candidate.value)} <small>({candidate.sourceIds.map(id => sources.get(id)?.text ?? id).join('; ')})</small><button type="button" disabled={intake.busy && !intake.requestPending} onClick={() => intake.keepCandidate(fact, ci)}>Use candidate</button></p>)}</div>}
            </td>
            <td>{fact.sourceIds.length ? fact.sourceIds.map(id => <details key={id}><summary>{id}</summary><p>{sources.get(id)?.text ?? 'Source text unavailable.'}</p></details>) : <em>None — unknown</em>}</td>
            <td><div className="intake-edit">
              {['C08', 'F01', 'G01', 'G05', 'H08'].includes(fact.fieldId) ? <select aria-label={`Correction ${targetLabel(fact)}`} value={raw === 'true' || raw === 'false' ? raw : ''} onChange={event => intake.setDrafts(old => ({ ...old, [key]: event.target.value }))}><option value="">Unknown</option><option value="true">Yes</option><option value="false">No</option></select> : <input aria-label={`Correction ${targetLabel(fact)}`} value={raw} placeholder="Leave blank for unknown" onChange={event => intake.setDrafts(old => ({ ...old, [key]: event.target.value }))} />}
              <button type="button" disabled={intake.busy && !intake.requestPending} onClick={() => { try { intake.correct(fact, correctionValue(fact, raw)); intake.setDrafts(old => { const next = { ...old }; delete next[key]; return next; }); } catch (error) { intake.setNotice((error as Error).message); } }}>Apply</button>
            </div></td>
          </tr>;
        })}
      </tbody></table></div>
      <div className="intake-summary"><strong>Reported transaction totals, separated by currency and status</strong>
        {totals.groups.map(group => <p key={`${group.currency}:${group.status}`}>{group.currency} {group.total.toLocaleString()} · {group.status} · {group.records.join(', ')}</p>)}
        {totals.unknown.map(item => <p key={item}>{item}</p>)}
        {!totals.groups.length && !totals.unknown.length && <p>No transaction amounts recorded.</p>}
      </div>
      <div className="intake-actions"><button type="button" disabled={intake.busy} onClick={() => void intake.save()}>Save fact changes</button>
        <button type="button" className="primary" disabled={intake.busy || record.saved && !record.needsFactConfirmation && review} onClick={() => void intake.confirmFacts()}>{review ? 'Confirm changes to checked facts' : 'Complete first fact check'}</button></div>
      <p className="intake-muted">{record.needsFactConfirmation ? 'A change after the first check requires confirmation before follow-up.' : review ? 'First fact check is recorded. Ordinary chat replies do not substitute for this action.' : 'First check has not been recorded.'}</p>
    </section>

    <section className="intake-card">
      <div className="intake-section-title"><h3>Targeted follow-up</h3><span className="intake-status">{record.followUp.rounds}/3 rounds · {record.followUp.totalQuestions}/9 questions</span></div>
      {record.followUp.questions.length === 0 && <p className="intake-muted">No saved questions. No round is created when analysis proposes zero questions.</p>}
      {record.followUp.questions.map(question => <article className="intake-question" key={question.id}>
        <div><strong>{question.id} · Round {question.round} · {targetLabel(question.target)}</strong><span className={`intake-status ${question.status}`}>{question.status}</span></div>
        <p>{question.text}</p><small>{question.reason}</small>
        <label>Answer or later update <textarea rows={2} value={intake.answerDrafts[question.id] ?? ''} onChange={event => intake.setAnswerDrafts(old => ({ ...old, [question.id]: event.target.value }))} placeholder={question.answer ?? 'Record the caller’s answer…'} /></label>
        <div className="intake-actions"><button type="button" disabled={intake.busy} onClick={() => void intake.answerQuestion(question, 'answered', true)}>Save answer and update target</button>
          <button type="button" disabled={intake.busy} onClick={() => void intake.answerQuestion(question, 'answered', false)}>Save answer as source only</button>
          <button type="button" disabled={intake.busy} onClick={() => void intake.answerQuestion(question, 'unknown', false)}>Unknown / unable to answer</button>
          <button type="button" disabled={intake.busy} onClick={() => void intake.answerQuestion(question, 'not-applicable', false)}>Not applicable</button></div>
      </article>)}
      {intake.questionProposals.length > 0 && <div className="intake-proposals"><h4>New question proposals — not yet counted</h4>{intake.questionProposals.map(question => <p key={question.id}><strong>{targetLabel(question.target)}:</strong> {question.text} <small>{question.reason}</small></p>)}
        <button type="button" className="primary" disabled={intake.busy || record.needsFactConfirmation || !review} onClick={() => void intake.saveQuestionProposals()}>Save and display proposed questions</button>
      </div>}
      <div className="intake-actions"><button type="button" disabled={intake.busy || record.followUp.stopped || !review} onClick={() => void intake.endQuestions()}>End follow-up</button>
        <button type="button" disabled={intake.busy || !intake.questionProposals.length} onClick={() => intake.setQuestionProposals([])}>Discard question proposals</button></div>
      {record.followUp.stopped && <p className="intake-muted">Follow-up ended. New information can be recorded, but questioning will not restart.</p>}
    </section>
    <footer className="intake-footer">A01 runtime case {record.caseId} · version {record.version} · {record.saved ? 'saved' : 'unsaved'} · simulated first review</footer>
  </section>;
}
