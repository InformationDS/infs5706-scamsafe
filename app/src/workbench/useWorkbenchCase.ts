import { useEffect, useRef, useState } from 'react';
import { approvedGuidanceRole, approvedGuidelines } from '../../../shared/guidance';
import { RuntimeCaseRecordSchema, runtimeDependencies, ticketCurrent, type RuntimeCaseRecord } from '../../../shared/runtime';
import { createEmptyRuntimeCase, deriveAnalysisUpdate, applyResolvedMessage, resolveEarlierMessageTarget } from '../../../shared/workbench-case';
import { addNarrativeSource, appendSavedQuestionRound, confirmRuntimeFacts, correctRuntimeFact, eligibleQuestionProposals, endRuntimeFollowUp, answerRuntimeQuestion, mergeRuntimeProposal } from '../../../shared/intake';
import { parseAnalysisResponseForRequest, type AnalysisRequest } from '../../../shared/module-ports';
import { ConfirmedMappingSchema, hasPendingMessageQuotes, type ConfirmedMapping, type MessageIntent } from '../../../shared/conversation';
import type { FactRecord, Target } from '../../../shared/schema';
import type { QuestionProposalView } from './types';
import { recalculateGuidance } from '../../../shared/guidance';
import { refreshRuntimeGaps } from '../../../shared/case-gaps';
import baseline from '../../../data/business/T09.json';
import { assertImportAllowed, backupRuntimeCase, listRuntimeCases, loadRuntimeCase, parseRuntimeBackup, saveRuntimeCase } from '../runtime-storage';

const session = 'integration';
const draftWarning = 'Record or discard other working edits, or send the message, before saving or changing cases.';

function explicitLimitations(record: RuntimeCaseRecord): string[] {
  return [...new Set((record.conversation?.messages ?? []).flatMap(message => (message.clarifications ?? []).filter(c => c.status === 'applied').flatMap(c => c.retainedQuotes.map(quote => `Unresolved reported detail: ${quote}`))))];
}
function retainExplicitLimitations(record: RuntimeCaseRecord): RuntimeCaseRecord {
  const notes = explicitLimitations(record);
  const missing = notes.filter(note => !record.analysis.gaps.includes(note));
  if (!missing.length) return record;
  const next = structuredClone(record); next.analysis.gaps.push(...missing); next.analysis.version++; next.version++; next.saved = false;
  return RuntimeCaseRecordSchema.parse(next);
}

export function useWorkbenchCase() {
  const [record, setRecord] = useState<RuntimeCaseRecord | null>(null);
  const current = useRef<RuntimeCaseRecord | null>(null);
  const [history, setHistory] = useState<RuntimeCaseRecord[]>([]);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [notice, setNotice] = useState('Loading saved cases…');
  const [pending, setPending] = useState<(() => Promise<void>) | null>(null);
  const drafts = useRef(new Set<string>());
  const [draftKeys, setDraftKeys] = useState<string[]>([]);
  const [actor, setActor] = useState(() => sessionStorage.getItem('scamsafe-workbench-actor') ?? '');
  const [failSave, setFailSave] = useState(false);
  const failSaveRef = useRef(false); failSaveRef.current = failSave;
  const [roleSelected, setRoleSelected] = useState(false);
  const [localCorrectionPending, setLocalCorrectionPending] = useState(false);
  const [composer, setComposer] = useState('');
  const draftRevision = useRef(0), composerRef = useRef('');
  const [operation, setOperation] = useState('');
  const [phase, setPhase] = useState<'idle' | 'storage' | 'network'>('idle');
  const phaseRef = useRef<'idle' | 'storage' | 'network'>('idle');
  function changePhase(value: 'idle' | 'storage' | 'network') { phaseRef.current = value; setPhase(value); }
  const operationId = useRef(''), operationLabel = useRef(''), requestId = useRef('');
  const [proposalView, setProposalView] = useState<QuestionProposalView | null>(null);
  const proposals = proposalView && record && proposalView.caseId === record.caseId && proposalView.instanceId === record.instanceId && JSON.stringify(proposalView.dependencies) === JSON.stringify(runtimeDependencies(record)) ? proposalView.questions : [];
  const pendingSave = useRef<{ snapshot: RuntimeCaseRecord; stage: 'source' | 'result'; operationId: string; label: string; resume?: () => Promise<void>; revision?: number; exposeOnFailure: boolean } | null>(null);
  const [saveStage, setSaveStage] = useState<'source' | 'result' | ''>('');
  const [saveContext, setSaveContext] = useState('');

  function apply(next: RuntimeCaseRecord | null) {
    const valid = next && RuntimeCaseRecordSchema.parse(next);
    if (valid?.instanceId !== current.current?.instanceId) setLocalCorrectionPending(false);
    current.current = valid; setRecord(valid);
  }
  function reportDraft(key: string, dirty: boolean) {
    if (dirty) drafts.current.add(key); else drafts.current.delete(key);
    setDraftKeys([...drafts.current]);
  }
  function changeComposer(value: string) { composerRef.current = value; draftRevision.current++; setComposer(value); reportDraft('composer', !!value); }
  async function refresh() { setHistory(await listRuntimeCases()); }
  async function run(action: () => Promise<void>) {
    if (lock.current || operationId.current || pendingSave.current) return;
    lock.current = true; setBusy(true);
    try { await action(); } catch (error) { setNotice((error as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function save() {
    if (drafts.current.size) throw new Error(draftWarning);
    const before = current.current;
    if (!before) throw new Error('Start or open a case first.');
    const saved = await saveRuntimeCase(before, session, failSave);
    if (current.current && JSON.stringify(current.current) === JSON.stringify(before)) apply(saved);
    else setNotice('An earlier version was saved; newer changes remain unsaved.');
    await refresh();
    return saved;
  }
  function guard(action: () => Promise<void>) {
    if (lock.current || operationId.current || pendingSave.current) return;
    if (drafts.current.size) { setNotice(draftWarning); return; }
    if (current.current && !current.current.saved) setPending(() => action);
    else void run(action);
  }
  useEffect(() => {
    let active = true;
    Promise.all([loadRuntimeCase(undefined, session), listRuntimeCases()]).then(([saved, all]) => {
      if (!active) return;
      if (saved) apply({ ...saved, instanceId: crypto.randomUUID() });
      setHistory(all); setNotice(saved ? 'Previous case restored from local storage.' : 'Choose a configured role to start an empty case.');
    }).catch(error => { if (active) setNotice((error as Error).message); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (drafts.current.size || (current.current && !current.current.saved) || lock.current || operationId.current || pendingSave.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, []);
  function start() {
    if (!roleSelected || current.current) return;
    apply(createEmptyRuntimeCase({ role: structuredClone(approvedGuidanceRole), guidelines: structuredClone(approvedGuidelines), caseId: `SYN-${crypto.randomUUID()}`, instanceId: crypto.randomUUID(), receivedAt: new Date().toISOString() }));
    setNotice('Empty synthetic case started; no case narrative has been analyzed.');
  }
  function newCase() { guard(async () => { apply(null); setRoleSelected(false); setNotice('Choose a configured role to start an empty case.'); }); }
  function openCase(id: string) { guard(async () => {
    const found = await loadRuntimeCase(id); if (!found) throw new Error('Saved case not found.');
    const opened = { ...found, instanceId: crypto.randomUUID() };
    if (opened.saved) await saveRuntimeCase(opened, session, failSave);
    apply(opened); setNotice(opened.saved ? 'Saved case opened.' : 'Case restored with repaired gaps; save after analysis.');
  }); }
  async function importBackup(file: File) {
    const check = () => { if (drafts.current.size) throw new Error(draftWarning); if (current.current) assertImportAllowed(current.current); };
    check(); const next = parseRuntimeBackup(await file.text()); check();
    const existing = await loadRuntimeCase(next.caseId); check();
    if (existing && !window.confirm(`Replace saved case ${next.caseId}? Cancel keeps both cases unchanged.`)) { setNotice('Import cancelled; cases retained.'); return; }
    check(); const saved = await saveRuntimeCase(next, session, failSave); apply(saved); await refresh(); setNotice('Backup validated, saved and opened.');
  }
  function downloadBackup() {
    if (drafts.current.size) { setNotice(draftWarning); return; }
    if (!current.current) return;
    const url = URL.createObjectURL(new Blob([backupRuntimeCase(current.current)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${current.current.caseId}_runtime.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function updateActor(value: string) { setActor(value); sessionStorage.setItem('scamsafe-workbench-actor', value); }

  // Only this operation may bypass the public save guard, and only for its captured composer.
  async function saveOperationSnapshot(next: RuntimeCaseRecord, id: string, consumedRevision?: number) {
    if (operationId.current !== id || !current.current || current.current.caseId !== next.caseId || current.current.instanceId !== next.instanceId) throw new Error('Case or operation changed; snapshot retained.');
    if ([...drafts.current].some(key => key !== 'composer') || (drafts.current.has('composer') && consumedRevision !== draftRevision.current)) throw new Error(draftWarning);
    changePhase('storage');
    try { return await saveRuntimeCase(next, session, failSaveRef.current); }
    finally { changePhase('idle'); }
  }
  async function operate(label: string, action: (id: string) => Promise<void>) {
    if (lock.current || operationId.current || pendingSave.current) return;
    const id = crypto.randomUUID(); operationId.current = id; operationLabel.current = label; setOperation(label); setNotice(`${label}…`); setBusy(true);
    try { await action(id); } catch (error) { setNotice((error as Error).message); }
    finally { if (operationId.current === id) { operationId.current = ''; setOperation(''); changePhase('idle'); setBusy(false); } }
  }
  async function commitSnapshot(next: RuntimeCaseRecord, id: string, stage: 'source' | 'result', resume?: () => Promise<void>, revision?: number, exposeOnFailure = true) {
    try {
      const saved = await saveOperationSnapshot(next, id, revision);
      apply(saved); pendingSave.current = null; setSaveStage(''); setSaveContext('');
      try { await refresh(); } catch { setNotice('Case saved; local history could not be refreshed.'); }
      if (stage === 'source' && revision === draftRevision.current) changeComposer('');
      return true;
    } catch (error) {
      pendingSave.current = { snapshot: next, stage, operationId: id, label: operationLabel.current, resume, revision, exposeOnFailure }; setSaveStage(stage); setSaveContext(operationLabel.current);
      if (stage === 'result' && exposeOnFailure) apply({ ...next, saved: false });
      const detail = operationLabel.current === 'Sending' ? 'Message draft retained.' : operationLabel.current === 'Record clarification' ? 'Clarification choice retained.' : 'Analysis intent retained.';
      setNotice(`${stage === 'source' ? `Recording failed; ${detail}` : exposeOnFailure ? 'Changes applied but unsaved. Retry save only.' : 'Question round not saved or counted. Retry save only.'} ${(error as Error).message}`);
      return false;
    }
  }
  async function retrySave() {
    const pendingItem = pendingSave.current;
    if (!pendingItem || lock.current || operationId.current) return;
    const id = pendingItem.operationId; operationId.current = id; operationLabel.current = pendingItem.label; setOperation('Retry save'); setBusy(true);
    try {
      if (await commitSnapshot(pendingItem.snapshot, id, pendingItem.stage, pendingItem.resume, pendingItem.revision, pendingItem.exposeOnFailure)) { if (pendingItem.resume) await pendingItem.resume(); else setNotice('Pending changes saved.'); }
    } finally { if (operationId.current === id) { operationId.current = ''; setOperation(''); changePhase('idle'); setBusy(false); } }
  }
  async function requestMessage(id: string, intent: MessageIntent) {
    const before = current.current!;
    let token = '';
    try {
      const context = await (await fetch('/api/runtime/context')).json() as { settingsRevision: number };
      token = crypto.randomUUID(); requestId.current = token;
      if (!current.current || JSON.stringify(current.current) !== JSON.stringify(before)) throw new Error('Case changed before analysis.');
      const ticket = { caseId: before.caseId, instanceId: before.instanceId, caseVersion: before.version, requestId: token, settingsRevision: context.settingsRevision, dependencies: runtimeDependencies(before) };
      const input: AnalysisRequest = { case: before, ticket, interaction: intent };
      changePhase('network');
      const response = await fetch('/api/runtime/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? 'Analysis request failed.');
      const result = parseAnalysisResponseForRequest(input, payload);
      const latest = await (await fetch('/api/runtime/context')).json() as { settingsRevision: number };
      if (!current.current || operationId.current !== id || !ticketCurrent(current.current, result.ticket, requestId.current, latest.settingsRevision)) throw new Error('Outdated response ignored; retry the recorded message.');
      if ([...drafts.current].some(key => key !== 'composer')) { setNotice('Working edit pending; response was not applied. Record or discard the edit, then retry the message.'); return; }
      const enriched = { ...result, proposal: { ...result.proposal, analysis: { ...result.proposal.analysis, gaps: [...new Set([...result.proposal.analysis.gaps, ...explicitLimitations(current.current)])] } } };
      const applied = retainExplicitLimitations(applyResolvedMessage({ record: current.current, interaction: intent, response: enriched }).record);
      const nextQuestions = eligibleQuestionProposals(applied, result.proposal.questions);
      const publish = async () => { setProposalView({ caseId: applied.caseId, instanceId: applied.instanceId, basedOnCaseVersion: applied.version, dependencies: runtimeDependencies(applied), questions: nextQuestions }); setNotice(`Message applied and saved (${result.meta.implementation}; provider called: ${result.meta.providerCalled}).`); };
      if (await commitSnapshot(applied, id, 'result', publish)) await publish();
    } catch (error) {
      const r = current.current;
      if (!r || r.caseId !== before.caseId || r.instanceId !== before.instanceId) throw error;
      if ((token && requestId.current !== token) || r.version !== before.version) { setNotice('Outdated response ignored; retry the recorded message.'); return; }
      const next = structuredClone(r), message = next.conversation?.messages.find(m => m.id === intent.messageId);
      if (message) { message.status = 'failed'; const revision = intent.clarification && message.clarifications?.find(c => c.revision === intent.clarification!.revision); if (revision) revision.status = 'failed'; }
      next.analysisUpdate = deriveAnalysisUpdate(next).state; next.saved = false;
      if (await commitSnapshot(next, id, 'result')) setNotice(`Analysis failed; original message retained. ${(error as Error).message}`);
    }
  }
  async function sendMessage(questionIds: string[]) {
    const capturedText = composerRef.current.trim(), revision = draftRevision.current;
    const state = current.current?.analysisUpdate;
    const interrupted = ['reanalysis', 'follow-up'].includes(state?.operation ?? '') && (state?.status === 'failed' || (state?.status === 'pending' && !localCorrectionPending));
    if (!capturedText || !current.current || [...drafts.current].some(key => key !== 'composer') || saveStage || interrupted) return;
    await operate('Sending', async id => {
      const before = current.current!;
      const initial = !before.conversation?.messages.some(m => m.kind === 'initial') && !before.facts.some(f => f.fieldId === 'A07') && !before.sources.some(s => s.kind === 'narrative');
      let next = structuredClone(before), sourceId: string;
      if (initial) { const added = addNarrativeSource(next, capturedText); next = added.record; sourceId = added.sourceId;
        if (capturedText.replaceAll('\r\n', '\n') === baseline.input.replaceAll('\r\n', '\n').trim()) {
          for (const [index, text] of baseline.input.replaceAll('\r\n', '\n').split('\n\n').entries()) {
            const source = next.sources.find(s => s.id === `S${index + 1}`);
            if (source && (source.kind !== 'narrative' || source.text !== text)) throw new Error('T09 source identifier already belongs to different content.');
            if (!source) next.sources.push({ id: `S${index + 1}`, kind: 'narrative', text });
          }
        }
      } else { sourceId = `SRC-${crypto.randomUUID()}`; next.sources.push({ id: sourceId, kind: 'answer', text: capturedText }); next.version++; next.saved = false; }
      const messageId = `MSG-${crypto.randomUUID()}`, kind = initial ? 'initial' : 'supplement';
      next.conversation ??= { messages: [] };
      next.conversation.messages.push({ id: messageId, kind, sourceId, questionIds: [...questionIds], status: 'recorded', recordedFactVersions: Object.fromEntries(before.facts.map(f => [`${f.fieldId}:${f.recordId ?? ''}`, f.version])), updates: [], unresolvedQuotes: [], createdAt: new Date().toISOString() });
      next.analysisUpdate = deriveAnalysisUpdate(next).state; next.saved = false;
      setProposalView(null);
      const intent: MessageIntent = { messageId, sourceId, kind, questionIds: [...questionIds] };
      if (await commitSnapshot(next, id, 'source', undefined, revision)) await requestMessage(id, intent);
      else if (pendingSave.current) pendingSave.current.resume = () => requestMessage(operationId.current, intent);
    });
  }
  async function retryMessage(messageId: string) {
    await operate('Retry message', async id => {
      const message = current.current?.conversation?.messages.find(m => m.id === messageId);
      if (!message || message.status === 'applied' || message.status === 'needs-decision') throw new Error('This message is already complete or needs an employee decision.');
      if (message.updates.some(u => u.decision) && !message.updates.some(u => u.disposition === 'awaiting-decision')) { await requestPurpose(id, 'case-reanalysis', messageId); return; }
      const clarification = [...(message.clarifications ?? [])].reverse().find(c => c.status !== 'applied');
      const intent: MessageIntent = { messageId, sourceId: message.sourceId, kind: message.kind, questionIds: clarification ? clarification.decisions.flatMap(d => d.questionId ? [d.questionId] : []) : message.questionIds, ...(clarification ? { clarification: { revision: clarification.revision, sourceId: clarification.sourceId, decisions: clarification.decisions, retainedQuotes: clarification.retainedQuotes } } : {}) };
      await requestMessage(id, intent);
    });
  }
  async function clarifyMessage(messageId: string, decisions: ConfirmedMapping[], retainedQuotes: string[], expectedCaseVersion: number) {
    if (!actor.trim()) { setNotice('Enter an employee identifier.'); return false; }
    if (drafts.current.size) { setNotice(draftWarning); return false; }
    const previousCount = current.current?.conversation?.messages.find(m => m.id === messageId)?.clarifications?.length ?? 0;
    await operate('Record clarification', async id => {
      const before = current.current!; if (before.version !== expectedCaseVersion) throw new Error('Case changed; review the clarification again.');
      const message = before.conversation?.messages.find(m => m.id === messageId);
      if (!message || message.status !== 'needs-clarification') throw new Error('Message no longer needs clarification.');
      const parsed = decisions.map(d => ConfirmedMappingSchema.parse(d));
      const quotes = [...parsed.map(d => d.quote), ...retainedQuotes];
      if (!quotes.length || new Set(quotes).size !== quotes.length || quotes.some(q => !message.unresolvedQuotes.includes(q)) || new Set(parsed.map(d => `${d.target.fieldId}:${d.target.recordId ?? ''}`)).size !== parsed.length) throw new Error('Clarification must use distinct pending quotes and targets.');
      for (const decision of parsed) {
        const sameTarget = (target: Target) => target.fieldId === decision.target.fieldId && target.recordId === decision.target.recordId;
        const questions = before.followUp.questions.filter(q => sameTarget(q.target));
        const fact = before.facts.find(sameTarget);
        if (decision.questionId && (!message.questionIds.includes(decision.questionId) || !questions.some(q => q.id === decision.questionId))) throw new Error('Question and target no longer match this message.');
        if (!decision.questionId && (questions.some(q => q.status === 'pending') || (decision.status === 'unknown' && questions.length))) throw new Error('Choose the corresponding recorded question for this target.');
        if (decision.status === 'not-applicable' && fact && (fact.value !== null || fact.reviewStatus === 'corrected')) throw new Error('Use explicit fact correction to change a known or corrected value.');
        if (message.updates.some(u => sameTarget(u.target) && u.disposition !== 'awaiting-decision')) throw new Error('This message already applied that target; use a separate correction.');
      }
      const next = structuredClone(before), targetMessage = next.conversation!.messages.find(m => m.id === messageId)!;
      const sourceId = `CORRECTION-${crypto.randomUUID()}`, revision = Math.max(0, ...(targetMessage.clarifications ?? []).map(c => c.revision)) + 1;
      next.sources.push({ id: sourceId, kind: 'correction', text: `Employee clarification for ${messageId}: ${JSON.stringify({ decisions: parsed, retainedQuotes })}` });
      const entry = { revision, sourceId, decisions: parsed, retainedQuotes, actor: actor.trim(), status: 'recorded' as const };
      targetMessage.clarifications ??= []; targetMessage.clarifications.push(entry); next.version++; next.saved = false;
      next.analysisUpdate = deriveAnalysisUpdate(next).state;
      const intent: MessageIntent = { messageId, sourceId: message.sourceId, kind: message.kind, questionIds: parsed.flatMap(d => d.questionId ? [d.questionId] : []), clarification: { revision, sourceId, decisions: parsed, retainedQuotes } };
      if (await commitSnapshot(next, id, 'source')) await requestMessage(id, intent);
      else if (pendingSave.current) pendingSave.current.resume = () => requestMessage(operationId.current, intent);
    });
    return !!pendingSave.current || (current.current?.conversation?.messages.find(m => m.id === messageId)?.clarifications?.length ?? 0) > previousCount;
  }
  async function resolveEarlierAnswer(input: { messageId: string; target: Target; candidateSourceId: string; choice: 'keep-current' | 'use-earlier'; reason: string; expectedCaseVersion: number }) {
    if (drafts.current.size) { setNotice(draftWarning); return false; }
    await operate('Record earlier answer decision', async id => {
      const next = resolveEarlierMessageTarget(current.current!, { ...input, actor });
      const resume = () => requestPurpose(operationId.current, 'case-reanalysis', input.messageId);
      if (await commitSnapshot(next, id, 'result', resume)) await requestPurpose(id, 'case-reanalysis', input.messageId);
    });
    return !!pendingSave.current || !!current.current?.conversation?.messages.find(m => m.id === input.messageId)?.updates.find(u => u.sourceId === input.candidateSourceId)?.decision;
  }
  async function saveLocalChange(next: RuntimeCaseRecord, label: string) { if (drafts.current.size) { setNotice(draftWarning); return false; } let accepted = false; await operate(label, async id => { if (await commitSnapshot(next, id, 'result', undefined, undefined, label !== 'Question round')) { setNotice(`${label} saved.`); accepted = true; } else accepted = true; }); return accepted; }
  async function confirmFacts() { if (!current.current || !actor.trim()) { setNotice('Enter an employee identifier.'); return; } await saveLocalChange(confirmRuntimeFacts(current.current, { actor: actor.trim(), simulated: false }), 'First fact check'); }
  async function displayQuestions() { if (!current.current) return; if (deriveAnalysisUpdate(current.current).blockers.length) { setNotice('Resolve pending analysis and messages before displaying a new question round.'); return; } if (!proposals.length) { await operate('Continue follow-up', id => requestPurpose(id, 'follow-up')); return; } try { const next = appendSavedQuestionRound(current.current, proposals); if (await saveLocalChange(next, 'Question round')) setProposalView(null); } catch (error) { setNotice((error as Error).message); } }
  async function endFollowUp() { if (current.current) { const next = endRuntimeFollowUp(current.current); if (next.conversation) next.analysisUpdate = deriveAnalysisUpdate(next).state; await saveLocalChange(next, 'Follow-up ended'); } }
  async function markUnknown(questionId: string) { if (current.current) { const next = answerRuntimeQuestion(current.current, questionId, 'Unknown / unable to answer', 'unknown', false); if (next.conversation) next.analysisUpdate = deriveAnalysisUpdate(next).state; await saveLocalChange(next, 'Question status'); } }
  async function markNotApplicable(questionId: string, reason: string) {
    if (!reason.trim() || !current.current) { setNotice('Enter a reason for not applicable.'); return false; }
    try {
      const before = current.current, question = before.followUp.questions.find(q => q.id === questionId);
      if (!question) throw new Error('Question not found.');
      const currentFact = before.facts.find(f => f.fieldId === question.target.fieldId && f.recordId === question.target.recordId);
      if (currentFact && (currentFact.value !== null || currentFact.reviewStatus === 'corrected')) throw new Error('Use explicit fact correction to change a known or corrected value.');
      let next = answerRuntimeQuestion(before, questionId, reason.trim(), 'not-applicable', false);
      const sourceId = `SRC-${crypto.randomUUID()}`; next.sources.push({ id: sourceId, kind: 'answer', text: reason.trim(), target: question.target });
      const fact = next.facts.find(f => f.fieldId === question.target.fieldId && f.recordId === question.target.recordId);
      if (fact) { fact.history.push({ value: fact.value, reason: 'Explicit not applicable decision', sourceIds: [...fact.sourceIds] }); fact.status = 'not-applicable'; fact.reviewStatus = 'unreviewed'; fact.sourceIds.push(sourceId); fact.version++; }
      else next.facts.push({ ...question.target, value: null, version: 1, status: 'not-applicable', reviewStatus: 'unreviewed', sourceIds: [sourceId], candidates: [], history: [] });
      next = refreshRuntimeGaps(RuntimeCaseRecordSchema.parse(next)); if (next.conversation) next.analysisUpdate = { status: 'pending', operation: 'reanalysis' };
      return saveLocalChange(next, 'Question status');
    } catch (error) { setNotice((error as Error).message); return false; }
  }
  async function requestPurpose(id: string, purpose: 'case-reanalysis' | 'follow-up', completionId?: string) {
    const before = current.current!;
    const blockers = deriveAnalysisUpdate(before).blockers.filter(b => b.messageId !== completionId && !(b.operation === (purpose === 'follow-up' ? 'follow-up' : 'reanalysis') && !b.messageId));
    if ((!completionId && blockers.length) || drafts.current.size || !before.sources.length) throw new Error('Resolve message blockers and unsent edits before analysis.');
    if (purpose === 'follow-up' && (before.followUp.stopped || before.followUp.rounds >= 3 || before.followUp.totalQuestions >= 9 || before.followUp.questions.some(q => q.status === 'pending') || !before.reviews.some(r => r.stage === 'first') || before.needsFactConfirmation)) throw new Error('Finish the current questions and first check, or respect the follow-up limit.');
    const op = purpose === 'follow-up' ? 'follow-up' : 'reanalysis';
    const marked = structuredClone(before); marked.analysisUpdate = completionId ? { status: 'pending', operation: 'message', messageId: completionId } : { status: 'pending', operation: op }; marked.version++; marked.saved = false;
    const resume = () => executePurpose(operationId.current, purpose, completionId);
    if (await commitSnapshot(marked, id, 'source', resume)) await executePurpose(id, purpose, completionId);
  }
  async function executePurpose(id: string, purpose: 'case-reanalysis' | 'follow-up', completionId?: string) {
    const before = current.current!; let token = '';
    try {
      const context = await (await fetch('/api/runtime/context')).json() as { settingsRevision: number }; token = crypto.randomUUID(); requestId.current = token;
      const ticket = { caseId: before.caseId, instanceId: before.instanceId, caseVersion: before.version, requestId: token, settingsRevision: context.settingsRevision, dependencies: runtimeDependencies(before) };
      const input: AnalysisRequest = { case: before, ticket, purpose };
      changePhase('network');
      const response = await fetch('/api/runtime/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? 'Analysis failed.');
      const parsed = parseAnalysisResponseForRequest(input, body), latest = await (await fetch('/api/runtime/context')).json() as { settingsRevision: number };
      if (!current.current || !ticketCurrent(current.current, parsed.ticket, requestId.current, latest.settingsRevision)) throw new Error('Outdated analysis ignored.');
      if (drafts.current.size) { setNotice('Working edit pending; analysis was not applied. Record or discard the edit, then retry.'); return; }
      const facts = parsed.proposal.facts.filter(f => { const existing = current.current!.facts.find(old => old.fieldId === f.fieldId && old.recordId === f.recordId); return !existing || JSON.stringify(existing.value) !== JSON.stringify(f.value) || existing.status !== f.status || f.sourceIds.some(sourceId => !existing.sourceIds.includes(sourceId)); });
      const analysis = { ...parsed.proposal.analysis, gaps: [...new Set([...parsed.proposal.analysis.gaps, ...explicitLimitations(current.current)])] };
      let next = recalculateGuidance(mergeRuntimeProposal(current.current, { ...parsed.proposal, analysis, facts }, { origin: purpose === 'follow-up' ? 'follow-up' : 'direct' }));
      if (purpose === 'follow-up') { const questions = eligibleQuestionProposals(next, parsed.proposal.questions); if (questions.length) next = appendSavedQuestionRound(next, questions); }
      if (completionId) { const message = next.conversation?.messages.find(m => m.id === completionId); if (!message || message.updates.some(u => u.disposition === 'awaiting-decision') || hasPendingMessageQuotes(message)) throw new Error('Message still has unresolved decisions.'); message.status = 'applied'; for (const clarification of message.clarifications ?? []) if (clarification.status !== 'applied') clarification.status = 'applied'; }
      next = retainExplicitLimitations(next);
      next.analysisUpdate = deriveAnalysisUpdate(next, { operation: completionId ? 'message' : purpose === 'follow-up' ? 'follow-up' : 'reanalysis', ...(completionId ? { messageId: completionId } : {}), status: 'completed' }).state; next.saved = false;
      if (await commitSnapshot(next, id, 'result', undefined, undefined, purpose !== 'follow-up')) { if (!completionId && purpose === 'case-reanalysis') setLocalCorrectionPending(false); setNotice(purpose === 'follow-up' ? 'Follow-up analysis and new questions saved.' : 'Current case analysis saved.'); }
    } catch (error) {
      if (!current.current || current.current.caseId !== before.caseId || current.current.instanceId !== before.instanceId || current.current.version !== before.version || (token && requestId.current !== token)) { setNotice('Outdated analysis ignored; retry required.'); return; }
      const next = structuredClone(current.current); if (completionId) { const message = next.conversation?.messages.find(m => m.id === completionId); if (message) message.status = 'failed'; next.analysisUpdate = deriveAnalysisUpdate(next).state; } else next.analysisUpdate = { status: 'failed', operation: purpose === 'follow-up' ? 'follow-up' : 'reanalysis' }; next.saved = false;
      if (await commitSnapshot(next, id, 'result')) setNotice(`Analysis failed; retry required. ${(error as Error).message}`);
    }
  }
  async function reanalyze() { if (!current.current) return; await operate('Reanalyze', id => requestPurpose(id, 'case-reanalysis')); }
  function correctFact(target: Target, value: FactRecord['value'], reason: string) {
    if (!current.current || pendingSave.current || (operationId.current && phaseRef.current !== 'network') || lock.current) { setNotice('Wait for the current storage operation.'); return false; }
    try { const next = correctRuntimeFact(current.current, target, value, reason); requestId.current = ''; setProposalView(null); setLocalCorrectionPending(true); apply(next); setNotice('Correction recorded in memory; save the case after the current request ends.'); return true; }
    catch (error) { setNotice((error as Error).message); return false; }
  }
  function invalidateSettings() { requestId.current = ''; setNotice('Settings saved; old requests invalidated. No model request was sent.'); }
  return { record, current, history, ready, busy, phase, localCorrectionPending, notice, setNotice, pending, setPending, draftKeys, reportDraft, actor, updateActor, roleSelected, setRoleSelected, failSave, setFailSave, run, save, start, newCase, openCase, importBackup, downloadBackup, composer, changeComposer, sendMessage, retryMessage, retrySave, saveStage, saveContext, operation, proposals, confirmFacts, displayQuestions, endFollowUp, markUnknown, markNotApplicable, reanalyze, invalidateSettings, clarifyMessage, resolveEarlierAnswer, correctFact };
}
