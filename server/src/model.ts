import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { AnalysisEnvelopeSchema, type FactRecord, type Target } from '../../shared/schema.js';
import { AnalysisRequestSchema, parseAnalysisResponseForRequest, type AnalyzeRuntime, type AnalysisRequest, type AnalysisResponse } from '../../shared/module-ports.js';
import { MessageResolutionSchema, hasPendingMessageQuotes } from '../../shared/conversation.js';
import { applyResolvedMessage } from '../../shared/workbench-case.js';
import { limitedWorkbenchMock, isExactT09Initial, UnsupportedWorkbenchMock } from './workbench-mock.js';
import { ticketCurrent } from '../../shared/runtime.js';
import { makeRuntimeFixture } from '../../shared/runtime-fixtures.js';
import { fixedQuestions } from '../../shared/fixtures.js';
import { AnalysisResultSchema, type CaseRecord } from '../../shared/index.js';
import { isConfigured, readConfig, type ServerConfig } from './config.js';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable = false) { super(message); }
}

export async function analyzeLive(caseRecord: CaseRecord, config: ServerConfig, fetchImpl: typeof fetch = fetch) {
  const payload = await requestAnalysis({ caseData: caseRecord, outputSchema: z.toJSONSchema(AnalysisResultSchema) }, config, fetchImpl);
    const parsed = AnalysisResultSchema.safeParse(payload);
    if (!parsed.success) throw new ApiError(502, 'MODEL_INVALID_OUTPUT', 'The model response did not match the shared analysis structure.');
    const sourceIds = new Set(caseRecord.facts.flatMap(f => [...f.sourceIds, ...f.candidates.flatMap(c => c.sourceIds)]));
    const targets = new Set(caseRecord.facts.map(f => `${f.fieldId}:${f.recordId ?? ''}`));
    const invalidFact = parsed.data.facts.some(f =>
      f.reviewStatus !== 'unreviewed' || f.history.length !== 0 || f.candidates.length !== 0 ||
      !/^[B-J]\d{2}$/.test(f.fieldId) || (f.value !== null && f.sourceIds.length === 0) ||
      !targets.has(`${f.fieldId}:${f.recordId ?? ''}`) || f.sourceIds.some(id => !sourceIds.has(id)));
    if (parsed.data.source !== 'model' || parsed.data.basedOnCaseVersion !== caseRecord.version || invalidFact) {
      throw new ApiError(502, 'MODEL_INVALID_OUTPUT', 'The model response used unsupported dependencies, sources or review claims.');
    }
    return parsed.data;

}

async function requestAnalysis(input: unknown, config: ServerConfig, fetchImpl: typeof fetch): Promise<unknown> {
  if (!isConfigured(config)) throw new ApiError(503, 'MODEL_NOT_CONFIGURED', 'Complete the local model configuration before enabling live analysis.');
  const system = await readFile(new URL('../prompts/intake.txt', import.meta.url), 'utf8');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ApiError(504, 'MODEL_TIMEOUT', 'The model request timed out. Your input and saved case are unchanged.', true));
    }, config.timeoutMs);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetchImpl(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', [config.authHeader]: `${config.authScheme ? `${config.authScheme} ` : ''}${config.apiKey}` },
        body: JSON.stringify({ model: config.model, stream: false, messages: [
          { role: 'system', content: system }, { role: 'user', content: JSON.stringify(input) },
        ] }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new ApiError(502, 'MODEL_SERVICE_ERROR', 'The model service rejected the request. Check local configuration or retry.', response.status === 429 || response.status >= 500);
      }
      // Limit bytes during reading, including providers that omit Content-Length.
      const reader = response.body?.getReader();
      if (!reader) throw invalidOutput();
      const decoder = new TextDecoder(); let text = ''; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1_000_000) { await reader.cancel(); throw invalidOutput(); }
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
      } finally { reader.releaseLock(); }
      try {
        const envelope = JSON.parse(text);
        if (typeof envelope?.choices?.[0]?.message?.content !== 'string') throw new Error();
        return JSON.parse(envelope.choices[0].message.content);
      } catch { throw invalidOutput(); }
    })()]);
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError(504, 'MODEL_TIMEOUT', 'The model request timed out. Your input and saved case are unchanged.', true);
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'MODEL_CONNECTION_ERROR', 'The model service could not be reached. Check local configuration or retry.', true);
  } finally { clearTimeout(timer); }
}


const invalidOutput = () => new ApiError(502, 'MODEL_INVALID_OUTPUT', 'The model returned an invalid analysis, source, target or review claim. Input retained; retry is available.', true);
const key = (target: Target) => `${target.fieldId}:${target.recordId ?? ''}`;
const group = (field: string) => ({ C: 'CONTACT', D: 'EVENT', E: 'TX', I: 'RESPONSE', J: 'EVID' }[field[0]]);
const repeated = (field: string) => /^[CDIJ]/.test(field) || /^E0[2-9]$/.test(field);

// Zod strips unknown nested keys in the shared contract. Reject them at this trust boundary.
function noExtraKeys(raw: unknown, parsed: unknown): boolean {
  if (!raw || typeof raw !== 'object') return true;
  if (!parsed || typeof parsed !== 'object') return false;
  return Object.keys(raw).every(k => Object.hasOwn(parsed, k) && noExtraKeys((raw as Record<string, unknown>)[k], (parsed as Record<string, unknown>)[k]));
}

function validateProposal(raw: unknown, input: AnalysisRequest, source: 'mock' | 'model', allowFixedRecords = false) {
  const parsed = AnalysisEnvelopeSchema.safeParse(raw);
  if (!parsed.success || !noExtraKeys(raw, parsed.data)) throw invalidOutput();
  const proposal = parsed.data, record = input.case;
  const knownSources = new Set(record.sources.map(s => s.id));
  const targets = new Set<string>();
  const allRecords = new Set(record.facts.flatMap(f => f.recordId ? [f.recordId] : []));
  const newRecords = new Map<string, Set<number>>();
  for (const fact of proposal.facts) {
    if (!/^[B-J]\d{2}$/.test(fact.fieldId) || targets.has(key(fact)) || fact.reviewStatus !== 'unreviewed' || fact.candidates.length || fact.history.length) throw invalidOutput();
    targets.add(key(fact));
    if (fact.sourceIds.some(id => !knownSources.has(id)) || new Set(fact.sourceIds).size !== fact.sourceIds.length || (fact.value !== null && !fact.sourceIds.length)) throw invalidOutput();
    if (['missing', 'unclear', 'not-applicable'].includes(fact.status) && fact.value !== null) throw invalidOutput();
    if (fact.status === 'extracted' && fact.value === null) throw invalidOutput();
    if (repeated(fact.fieldId)) {
      const family = group(fact.fieldId)!;
      const existing = record.facts.some(f => f.recordId === fact.recordId && group(f.fieldId) === family && repeated(f.fieldId));
      if (!existing) {
        if (allRecords.has(fact.recordId!)) throw invalidOutput();
        const fixed = ({ CONTACT: 'CONTACT-01', EVENT: 'EVENT-01', TX: 'TX-01', EVID: 'EVID-01' } as Record<string, string>)[family];
        if (!(allowFixedRecords && fact.recordId === fixed)) {
          const prefix = `MODEL-${input.ticket.requestId}-${family}-`;
          if (!fact.recordId?.startsWith(prefix)) throw invalidOutput();
          const suffix = fact.recordId.slice(prefix.length);
          if (!/^(?:0[1-9]|[1-9]\d+)$/.test(suffix)) throw invalidOutput();
          const numbers = newRecords.get(family) ?? new Set<number>(); numbers.add(Number(suffix)); newRecords.set(family, numbers);
        }
      }
    } else if (fact.recordId !== undefined) throw invalidOutput();
    const original = record.facts.find(f => key(f) === key(fact));
    if (fact.version !== (original?.version ?? 1)) throw invalidOutput();
    if (['C01', 'D01', 'E02', 'I01', 'J01'].includes(fact.fieldId) && fact.value !== fact.recordId) throw invalidOutput();
  }
  for (const values of newRecords.values()) {
    if ([...values].sort((a,b) => a-b).some((n,i) => n !== i+1)) throw invalidOutput();
  }
  const recordIds = new Set([...allRecords, ...proposal.facts.flatMap(f => f.recordId ? [f.recordId] : [])]);
  for (const f of proposal.facts) if (['D05', 'J05'].includes(f.fieldId) && f.value !== null && (!Array.isArray(f.value) || f.value.some(id => !recordIds.has(id)))) throw invalidOutput();
  const analysis = proposal.analysis;
  if (analysis.source !== source || analysis.basedOnCaseVersion !== record.version || analysis.version !== record.analysis.version ||
      (analysis.facts.length && JSON.stringify(analysis.facts) !== JSON.stringify(proposal.facts)) ||
      (analysis.types.length && (!analysis.reasons.length || !analysis.alternatives.length)) ||
      [...analysis.types, ...analysis.reasons, ...analysis.alternatives, ...analysis.gaps].some(s => !s.trim())) throw invalidOutput();
  if ((input.interaction || input.purpose) && analysis.gaps.some(gap => /^Unresolved [A-J]\d{2}\b/.test(gap) && !/^Unresolved [A-J]\d{2}:[^\r\n]*$/.test(gap))) throw invalidOutput();
  const allowedTypes = new Set(['Suspected investment scam', 'Suspected payment redirection', 'Suspected romance scam', 'Suspected phishing', 'Suspected remote access scam', 'Other', 'Insufficient information']);
  if (analysis.types.some(t => !allowedTypes.has(t)) || new Set(analysis.types).size !== analysis.types.length) throw invalidOutput();
  const follow = record.followUp;
  if (proposal.questions.length > Math.min(3, 9-follow.totalQuestions) || (proposal.questions.length && (follow.stopped || follow.rounds >= 3 || follow.questions.some(q => q.status === 'pending')))) throw invalidOutput();
  const questionTargets = new Set<string>(), questionIds = new Set<string>();
  const available = new Set([...record.facts.map(key), ...targets]);
  for (const q of proposal.questions) {
    if (!q.id.trim() || !q.text.trim() || !q.reason.trim() || !available.has(key(q.target)) || !/^[B-J]/.test(q.target.fieldId) ||
        questionTargets.has(key(q.target)) || questionIds.has(q.id) || follow.questions.some(old => old.id === q.id || key(old.target) === key(q.target)) ||
        q.status !== 'pending' || q.answer !== null || q.history.length || q.round !== follow.rounds+1) throw invalidOutput();
    questionTargets.add(key(q.target)); questionIds.add(q.id);
  }
  // These remain proposals. B owns conflict-aware merging, stable question IDs and counters.
  return proposal;
}

export function validateWorkbenchRequest(input: AnalysisRequest): void {
  const intent = input.interaction;
  if (!intent) return;
  const badRequest = () => new ApiError(400, 'INVALID_INPUT', 'The recorded message, target or clarification no longer matches the request.');
  const message = input.case.conversation?.messages.find(m => m.id === intent.messageId);
  if (!message || message.sourceId !== intent.sourceId || message.kind !== intent.kind || !input.case.sources.some(s => s.id === intent.sourceId) || new Set(intent.questionIds).size !== intent.questionIds.length || intent.questionIds.some(id => !message.questionIds.includes(id) || !input.case.followUp.questions.some(q => q.id === id))) throw badRequest();
  if ((!intent.clarification && message.status === 'applied' && !hasPendingMessageQuotes(message)) || message.status === 'needs-decision' || message.updates.some(u => u.disposition === 'awaiting-decision')) throw badRequest();
  if (intent.clarification) {
    const saved = message.clarifications?.find(c => c.revision === intent.clarification!.revision);
    if (!saved || saved.status === 'applied' || saved.sourceId !== intent.clarification.sourceId || JSON.stringify(saved.decisions) !== JSON.stringify(intent.clarification.decisions) || JSON.stringify(saved.retainedQuotes) !== JSON.stringify(intent.clarification.retainedQuotes)) throw badRequest();
  }
}

/** Validate a service result again at the HTTP boundary, including its message pairing. */
export function validateWorkbenchResponse(input: AnalysisRequest, raw: unknown): AnalysisResponse {
  try {
    const response = parseAnalysisResponseForRequest(input, raw);
    if (!noExtraKeys(raw, response)) throw invalidOutput();
    if (response.meta.providerCalled === response.meta.simulated || response.proposal.analysis.source !== (response.meta.providerCalled ? 'model' : 'mock')) throw invalidOutput();
    const fixed = !!input.interaction && !response.meta.providerCalled && response.meta.simulated && response.proposal.analysis.source === 'mock' && isExactT09Initial(input);
    response.proposal = validateProposal(response.proposal, input, response.proposal.analysis.source, fixed);
    if (input.interaction?.kind === 'supplement' && response.proposal.facts.some(f => f.value === null && !(f.status === 'not-applicable' && input.interaction?.clarification?.decisions.some(d => d.status === 'not-applicable' && key(d.target) === key(f) && f.sourceIds.includes(input.interaction!.clarification!.sourceId))))) throw invalidOutput();
    if (input.purpose === 'case-reanalysis' && response.proposal.questions.length) throw invalidOutput();
    if (input.purpose && response.proposal.facts.some(f => f.value === null && input.case.facts.some(current => key(current) === key(f) && current.value !== null))) throw invalidOutput();
    if (input.interaction) {
      validateWorkbenchRequest(input);
      // This transform operates only on a clone; it defends the client boundary as well.
      applyResolvedMessage({ record: input.case, response, interaction: input.interaction });
    }
    if (input.purpose === 'case-reanalysis') for (const fact of response.proposal.facts) {
      const current = input.case.facts.find(f => key(f) === key(fact));
      if (!current || JSON.stringify(current.value) === JSON.stringify(fact.value)) continue;
      const rejectedEarlier = input.case.conversation?.messages.some(m => m.updates.some(u => key(u.target) === key(fact) && (u.disposition === 'kept-current' || u.disposition === 'historical') && fact.sourceIds.some(id => id === u.sourceId || id === m.sourceId)));
      if (rejectedEarlier) throw invalidOutput();
    }
    return response;
  } catch { throw invalidOutput(); }
}

export const analyzeRuntime: AnalyzeRuntime = async (rawInput, context) => {
  const checked = AnalysisRequestSchema.safeParse(rawInput);
  if (!checked.success) throw new ApiError(400, 'INVALID_INPUT', 'Supply the runtime case and request ticket.');
  const input = checked.data;
  if (!input.ticket.requestId.trim() || !ticketCurrent(input.case, input.ticket, input.ticket.requestId, input.ticket.settingsRevision)) throw new ApiError(409, 'STALE_REQUEST', 'The request no longer matches the case.', true);
  const config = { ...(context?.config ?? readConfig({})) };
  const mock = input.previewMock || config.mode === 'mock';
  if (!mock && input.fault) throw new ApiError(400, 'FAULT_NOT_ALLOWED', 'Fault injection is available only in mock mode.');
  if (input.interaction || input.purpose) {
    validateWorkbenchRequest(input);
    let payload: unknown;
    if (mock) {
      if (input.fault === 'timeout') throw new ApiError(504, 'MODEL_TIMEOUT', 'Simulated timeout. Input retained.', true);
      if (input.fault === 'invalid') throw invalidOutput();
      if (input.fault === 'delayed') await new Promise(resolve => setTimeout(resolve, 1500));
      try { payload = limitedWorkbenchMock(input); }
      catch (error) { if (error instanceof UnsupportedWorkbenchMock) throw new ApiError(422, 'MOCK_INPUT_UNSUPPORTED', error.message); throw error; }
    } else {
      const record = input.case;
      const chronologicalSources = (record.conversation?.messages ?? []).map((m, messageOrder) => ({ messageId: m.id, sourceId: m.sourceId, messageOrder, updates: m.updates.map(u => ({ target: u.target, sourceId: u.sourceId, disposition: u.disposition, decision: u.decision ? { choice: u.decision.choice, reason: u.decision.reason } : undefined })) }));
      const outputSchema = input.interaction ? z.object({ proposal: AnalysisEnvelopeSchema, resolution: MessageResolutionSchema }).strict() : z.object({ proposal: AnalysisEnvelopeSchema }).strict();
      payload = await requestAnalysis({ contract: 'runtime-workbench-v2', requestId: input.ticket.requestId,
        caseData: { version: record.version, analysisVersion: record.analysis.version, sources: record.sources, facts: record.facts, followUp: record.followUp, chronologicalSources, ...(input.interaction ? { interaction: input.interaction } : { purpose: input.purpose }) },
        outputSchema: z.toJSONSchema(outputSchema) }, config, context?.fetchImpl ?? fetch);
    }
    if (!payload || typeof payload !== 'object') throw invalidOutput();
    const raw = payload as Record<string, unknown>;
    if (Object.keys(raw).some(key => key !== 'proposal' && !(key === 'resolution' && input.interaction))) throw invalidOutput();
    return validateWorkbenchResponse(input, { ...raw, ticket: structuredClone(input.ticket), meta: { implementation: mock ? 'Limited workbench Mock' : 'Workbench model analysis', providerCalled: !mock, simulated: Boolean(mock) } });
  }
  let proposal;
  if (mock) {
    if (input.fault === 'timeout') throw new ApiError(504, 'MODEL_TIMEOUT', 'Simulated timeout. Input retained.', true);
    if (input.fault === 'invalid') throw invalidOutput();
    if (input.fault === 'delayed') await new Promise(resolve => setTimeout(resolve, 1500));
    const fixed = makeRuntimeFixture('T09');
    // Never pass fixed T09 results off as analysis of an unrelated free narrative.
    if (JSON.stringify(input.case.sources.filter(s => s.kind === 'narrative')) !== JSON.stringify(fixed.sources)) throw new ApiError(422, 'MOCK_INPUT_UNSUPPORTED', 'Mock supports the fixed T09 narrative only. Use a configured real API for another synthetic narrative.');
    const facts: FactRecord[] = input.case.facts.filter(f => /^[B-J]/.test(f.fieldId)).map(f => ({ ...structuredClone(f), reviewStatus: 'unreviewed', history: [], candidates: [] }));
    const amount = facts.find(f => f.fieldId === 'E04' && f.recordId === 'TX-01');
    if (amount) { amount.value = 2000; amount.status = 'extracted'; amount.sourceIds = ['S3']; }
    const follow = input.case.followUp;
    const questions = follow.stopped || follow.rounds >= 3 || follow.questions.some(q => q.status === 'pending') ? [] : fixedQuestions.filter(q => !follow.questions.some(old => key(old.target) === key(q.target))).slice(0, 9-follow.totalQuestions).map(q => ({ ...structuredClone(q), round: follow.rounds+1 }));
    proposal = validateProposal({ facts, analysis: { ...fixed.analysis, version: input.case.analysis.version, basedOnCaseVersion: input.case.version, facts: [], gaps: facts.filter(f => f.value === null || f.status === 'conflict').map(f => `Unresolved ${key(f)}`) }, questions }, input, 'mock');
  } else {
    const record = input.case;
    const payload = await requestAnalysis({
      contract: 'runtime-v2', requestId: input.ticket.requestId,
      // Do not send configuration, credentials, permissions, guidelines or previous drafts.
      caseData: { version: record.version, analysisVersion: record.analysis.version, sources: record.sources, facts: record.facts, followUp: record.followUp },
      outputSchema: z.toJSONSchema(AnalysisEnvelopeSchema),
    }, config, context?.fetchImpl ?? fetch);
    proposal = validateProposal(payload, input, 'model');
  }
  return { proposal, ticket: structuredClone(input.ticket), meta: { implementation: 'C01 runtime analysis proposals', providerCalled: !mock, simulated: Boolean(mock) } };
};
