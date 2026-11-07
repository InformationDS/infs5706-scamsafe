import { useEffect, useRef, useState } from 'react';
import type { AnalysisRequest, ModuleProps } from '../../../../shared/module-ports';
import { runtimeDependencies, ticketCurrent } from '../../../../shared/runtime';
import type { Question } from '../../../../shared/schema';
import { hasStaleFieldGaps, repairStaleRuntimeGaps } from '../../../../shared/case-gaps';
import {
  addNarrativeSource, answerRuntimeQuestion, appendSavedQuestionRound, confirmRuntimeFacts,
  correctRuntimeFact, correctRuntimeTypes, eligibleQuestionProposals, endRuntimeFollowUp, intakeTargetKey,
  mergeRuntimeProposal,
} from '../../../../shared/intake';

function sameCaseContent(a: ModuleProps['record'], b: ModuleProps['record']) {
  const left = structuredClone(a), right = structuredClone(b);
  left.saved = right.saved = false;
  delete left.error; delete right.error;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useIntake({ record, ports, onChange, onError }: ModuleProps) {
  const current = useRef(record); current.current = record;
  const activeRequest = useRef('');
  const [narrative, setNarrative] = useState(() => String(record.facts.find(f => f.fieldId === 'A07')?.value ?? ''));
  const [correctionReason, setCorrectionReason] = useState('Caller clarification');
  const [typeDraft, setTypeDraft] = useState(record.analysis.types.join(', '));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [questionProposals, setQuestionProposals] = useState<Question[]>([]);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    setNarrative(String(record.facts.find(f => f.fieldId === 'A07')?.value ?? ''));
    setQuestionProposals([]); setAnswerDrafts({}); setDrafts({}); activeRequest.current = '';
  }, [record.caseId, record.instanceId]);
  useEffect(() => { setTypeDraft(record.analysis.types.join(', ')); }, [record.caseId, record.instanceId, record.analysis.version]);

  const update = (next: typeof record) => { current.current = next; onChange(next); };
  useEffect(() => {
    const old = current.current;
    if (hasStaleFieldGaps(old)) {
      const repaired = repairStaleRuntimeGaps(old);
      current.current = repaired; onChange(repaired);
      setNotice('Outdated field gaps were updated in memory. Save and review affected materials.');
    }
  }, [record.caseId, record.instanceId]);
  async function save(next = current.current) {
    const before = structuredClone(current.current);
    try {
      const saved = await ports.save(next);
      if (sameCaseContent(current.current, before) || sameCaseContent(current.current, next)) {
        current.current = saved;
        setNotice('Saved after the A01 storage transaction committed.');
        return saved;
      }
      setNotice('An earlier version was saved; newer edits remain current and unsaved. Save again before continuing.');
    } catch (error) {
      if (sameCaseContent(current.current, before)) update({ ...next, saved: false });
      onError({ code: 'SAVE_FAILED', message: (error as Error).message, retryable: true });
      setNotice('Save failed. Current values remain available; no question count was added.');
    }
  }
  async function runAnalysis() {
    setBusy(true); setNotice('Recording the source before requesting analysis…'); setQuestionProposals([]);
    const requestId = crypto.randomUUID(); activeRequest.current = requestId;
    try {
      const withSource = addNarrativeSource(current.current, narrative);
      const savedSource = await save(withSource.record);
      if (!savedSource) return;
      if (current.current.caseId !== savedSource.caseId || current.current.instanceId !== savedSource.instanceId || current.current.version !== savedSource.version) {
        setNotice('Current edits changed while saving the source; analysis was not started on the older version.'); return;
      }
      const context = await (await fetch('/api/runtime/context')).json() as { settingsRevision: number };
      const ticket = { caseId: savedSource.caseId, instanceId: savedSource.instanceId, caseVersion: savedSource.version,
        requestId, settingsRevision: context.settingsRevision, dependencies: runtimeDependencies(savedSource) };
      setNotice('Analysis request in progress. The original narrative is retained as a source.');
      setRequestPending(true);
      const result = await ports.analyze({ case: savedSource, ticket, previewMock: undefined } satisfies AnalysisRequest);
      const latestContext = await (await fetch('/api/runtime/context')).json() as { settingsRevision: number };
      if (!ticketCurrent(current.current, result.ticket, activeRequest.current, latestContext.settingsRevision)) {
        setNotice('Outdated analysis ignored; current facts and manual changes were retained.'); return;
      }
      const merged = mergeRuntimeProposal(current.current, result.proposal);
      update(merged);
      setQuestionProposals(eligibleQuestionProposals(merged, result.proposal.questions));
      setNotice(`Analysis proposal received (${result.meta.implementation}; provider called: ${result.meta.providerCalled}). Proposed facts were merged with manual-change protection. Proposed questions are not counted until saved.`);
    } catch (error) {
      onError({ code: 'ANALYSIS_FAILED', message: (error as Error).message, retryable: true });
      setNotice(`Analysis failed; narrative and current case remain available. ${(error as Error).message}`);
    } finally { setRequestPending(false); setBusy(false); }
  }
  async function confirmFacts() {
    setBusy(true);
    try {
      const saved = await save(confirmRuntimeFacts(current.current));
      if (saved) setNotice('First fact check recorded and saved. Reported statements remain unverified external facts.');
    }
    catch { /* save() already reported the failure and retained the unsaved review input */ }
    finally { setBusy(false); }
  }
  async function saveQuestionProposals() {
    if (!questionProposals.length) return;
    setBusy(true);
    try {
      const next = appendSavedQuestionRound(current.current, questionProposals);
      const before = structuredClone(current.current);
      const saved = await ports.save(next);
      if (!sameCaseContent(current.current, before) && !sameCaseContent(current.current, saved)) {
        setNotice('An earlier question round was saved; newer case changes remain current. Reload the saved case before continuing that round.');
        return;
      }
      current.current = saved;
      setQuestionProposals([]);
      setNotice(`Round ${saved.followUp.rounds} saved and displayed (${saved.followUp.totalQuestions} questions total).`);
    } catch (error) {
      onError({ code: 'SAVE_FAILED', message: (error as Error).message, retryable: true });
      setNotice(`Question round was not counted because save did not complete. Retry is available. ${(error as Error).message}`);
    } finally { setBusy(false); }
  }
  async function answerQuestion(question: Question, status: 'answered' | 'unknown' | 'not-applicable', updateFact: boolean) {
    if (status === 'not-applicable' && !answerDrafts[question.id]?.trim()) {
      setNotice('Enter a short reason before marking this question not applicable.');
      return;
    }
    setBusy(true);
    try {
      const answer = status === 'answered' ? answerDrafts[question.id] ?? '' : status === 'unknown' ? 'Unknown / unable to answer' : answerDrafts[question.id]!.trim();
      const saved = await save(answerRuntimeQuestion(current.current, question.id, answer, status, updateFact));
      if (saved) {
        setAnswerDrafts(old => ({ ...old, [question.id]: '' }));
        setNotice(`Answer for ${question.id} saved. The existing question count is unchanged.`);
      }
    } catch { /* save() reports storage errors */ }
    finally { setBusy(false); }
  }
  async function endQuestions() {
    setBusy(true);
    try {
      const saved = await save(endRuntimeFollowUp(current.current));
      if (saved) setNotice('Follow-up ended and saved. Unanswered questions are skipped; gaps remain.');
    }
    catch { /* save() reports storage errors */ }
    finally { setBusy(false); }
  }
  function correct(target: { fieldId: string; recordId?: string }, value: Parameters<typeof correctRuntimeFact>[2]) {
    try { update(correctRuntimeFact(current.current, target, value, correctionReason)); setNotice('Correction is unsaved. Previous value and source history are retained.'); }
    catch (error) { onError({ code: 'INVALID_CORRECTION', message: (error as Error).message, retryable: false }); }
  }
  function correctTypes() {
    try { update(correctRuntimeTypes(current.current, typeDraft.split(',').map(type => type.trim()), correctionReason)); setNotice('Suspected-type correction is unsaved; previous analysis and the reason are retained.'); }
    catch (error) { onError({ code: 'INVALID_TYPE_CORRECTION', message: (error as Error).message, retryable: false }); }
  }
  function keepCandidate(target: { fieldId: string; recordId?: string }, candidateIndex: number) {
    const fact = current.current.facts.find(item => intakeTargetKey(item) === intakeTargetKey(target));
    const candidate = fact?.candidates[candidateIndex];
    if (!fact || !candidate) return;
    correct(target, candidate.value);
    const latest = current.current;
    const selected = latest.facts.find(item => intakeTargetKey(item) === intakeTargetKey(target));
    if (selected) { selected.sourceIds = [...new Set([...selected.sourceIds, ...candidate.sourceIds])]; selected.status = 'extracted'; update(latest); }
  }
  return {
    narrative, setNarrative, correctionReason, setCorrectionReason, typeDraft, setTypeDraft, drafts, setDrafts, answerDrafts, setAnswerDrafts,
    questionProposals, setQuestionProposals, busy, requestPending, notice, setNotice, save, runAnalysis, confirmFacts, saveQuestionProposals,
    answerQuestion, endQuestions, correct, correctTypes, keepCandidate,
  };
}
