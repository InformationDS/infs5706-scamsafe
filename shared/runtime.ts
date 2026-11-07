import { z } from 'zod';
import { CaseRecordSchema, OutputRecordSchema, RecommendationSchema, ReviewRecordSchema, ExportSnapshotSchema, TargetSchema } from './schema.js';
import { ConversationStateSchema, AnalysisUpdateStateSchema, hasPendingMessageQuotes } from './conversation.js';
import { ApprovedRoleSchema, ApprovedGuidelineSchema } from './business.js';
import { hasStaleFieldGaps } from './case-gaps.js';

const EditSchema = z.object({ previous: z.string(), reason: z.string().min(1), actor: z.string().min(1) });
export const RuntimeOutputSchema = OutputRecordSchema.extend({ employeeEdited: z.boolean(), history: z.array(EditSchema) });
export const RuntimeReviewSchema = ReviewRecordSchema.extend({
  simulated: z.boolean(), actor: z.string().min(1), reviewedAt: z.string().datetime(),
});
export const RuntimeRecommendationSchema = z.object({ ...RecommendationSchema.shape,
  simulated: z.boolean(), contentApproval: z.enum(['pending', 'approved']), history: z.array(EditSchema),
}).superRefine((value, ctx) => {
  if (['modified', 'rejected'].includes(value.decision) && !value.decisionReason?.trim()) ctx.addIssue({ code: 'custom', message: 'Modified or rejected decision requires a reason' });
});
export const RuntimeCaseRecordSchema = z.object({
  ...CaseRecordSchema.shape,
  schemaVersion: z.literal(2), mode: z.enum(['mock', 'live']),
  // Content approval belongs to the business configuration, never to employee reviews.
  role: z.union([ApprovedRoleSchema, CaseRecordSchema.shape.role]),
  roleRevision: z.number().int().positive(), guidanceRevision: z.number().int().positive(),
  guidelines: z.array(ApprovedGuidelineSchema), guidanceStatus: z.enum(['available', 'none', 'stale']),
  sources: z.array(z.object({ id: z.string().min(1), kind: z.enum(['narrative', 'answer', 'correction']), text: z.string(), target: TargetSchema.optional() })),
  recommendations: z.array(RuntimeRecommendationSchema), outputs: z.array(RuntimeOutputSchema), reviews: z.array(RuntimeReviewSchema),
  conversation: ConversationStateSchema.optional(),
  analysisUpdate: AnalysisUpdateStateSchema.optional(),
  analysisGapHistory: z.array(z.object({ analysisVersion: z.number().int().positive(), gaps: z.array(z.string()) }).strict()).optional(),
  instanceId: z.string().min(1), // changes on reset/open/import, even for the same case/version
}).strict().superRefine((record, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  const keys = record.facts.map(f => `${f.fieldId}:${f.recordId ?? ''}`);
  if (!unique(keys) || record.facts.some(f => !/^[A-J]/.test(f.fieldId))) issue('Invalid or duplicate fact target');
  if (!unique(record.sources.map(s => s.id)) || !unique(record.outputs.map(o => o.id)) || !unique(record.recommendations.map(r => r.id))) issue('Duplicate identity');
  const sourceIds = new Set(record.sources.map(s => s.id));
  const questions = new Map(record.followUp.questions.map(q => [q.id, q]));
  const messages = record.conversation?.messages ?? [];
  if (!unique(messages.map(m => m.id))) issue('Duplicate message identity');
  const sameTarget = (a: { fieldId: string; recordId?: string }, b: { fieldId: string; recordId?: string }) => a.fieldId === b.fieldId && a.recordId === b.recordId;
  for (const [messageIndex, message] of messages.entries()) {
    const original = record.sources.find(s => s.id === message.sourceId);
    if (!original || message.questionIds.some(id => !questions.has(id))) issue('Missing message source or question reference');
    if (!unique(message.questionIds)) issue('Duplicate message question reference');
    if (message.unresolvedQuotes.some(quote => !original?.text.includes(quote))) issue('Unresolved quote is absent from message source');
    for (const update of message.updates) {
      const q = update.questionId && questions.get(update.questionId);
      const source = record.sources.find(s => s.id === update.sourceId);
      const laterIndex = update.supersededByMessageId ? messages.findIndex(m => m.id === update.supersededByMessageId) : -1;
      if (!source || (source.target && !sameTarget(source.target, update.target)) || (update.questionId && (!q || !sameTarget(q.target, update.target))) || (update.supersededByMessageId && laterIndex <= messageIndex)) issue('Invalid message update reference');
      if (update.disposition === 'awaiting-decision' && update.outcome !== 'conflict') issue('An awaiting decision must refer to a conflict');
      if ((update.disposition === 'kept-current' || update.disposition === 'adopted-earlier') && (!update.decision || update.decision.choice !== (update.disposition === 'kept-current' ? 'keep-current' : 'use-earlier'))) issue('Missing or inconsistent earlier-message decision');
      if (update.decision && !['kept-current', 'adopted-earlier'].includes(update.disposition ?? '')) issue('Decision requires a completed disposition');
    }
    const revisions = (message.clarifications ?? []).map(c => c.revision);
    if (new Set(revisions).size !== revisions.length) issue('Duplicate clarification revision');
    for (const clarification of message.clarifications ?? []) {
      const clarificationSource = record.sources.find(s => s.id === clarification.sourceId);
      if (!clarificationSource || clarificationSource.kind !== 'correction' || !clarificationSource.text.trim()) issue('Missing clarification correction source');
      const targets = clarification.decisions.map(d => `${d.target.fieldId}:${d.target.recordId ?? ''}`);
      if (!unique(targets) || clarification.decisions.some(d => clarification.retainedQuotes.includes(d.quote))) issue('Duplicate or overlapping clarification decision');
      for (const decision of clarification.decisions) {
        const q = decision.questionId && questions.get(decision.questionId);
        if ((decision.questionId && (!q || !sameTarget(q.target, decision.target))) || !original?.text.includes(decision.quote)) issue('Invalid clarification decision reference');
      }
      if (clarification.retainedQuotes.some(q => !original?.text.includes(q))) issue('Invalid retained quote');
    }
  }
  if (record.analysisUpdate?.messageId && !messages.some(m => m.id === record.analysisUpdate!.messageId)) issue('Missing analysis message reference');
  for (const fact of record.facts) if ([...fact.sourceIds, ...fact.candidates.flatMap(c => c.sourceIds), ...fact.history.flatMap(h => h.sourceIds)].some(id => !sourceIds.has(id))) issue('Missing source reference');
  for (const rec of record.recommendations) {
    if (rec.factRefs.some(ref => !keys.includes(`${ref.fieldId}:${ref.recordId ?? ''}`))) issue('Missing recommendation fact');
    if (rec.guidelineRefs.some(ref => !record.guidelines.some(g => g.id === ref.id && g.version === ref.version))) issue('Missing recommendation guideline');
  }
  for (const out of record.outputs) {
    if (out.kind === 'summary' && out.recipient) issue('Summary cannot have a recipient');
    const historicalRole = typeof out.dependencies.role === 'number' && out.dependencies.role > 0 && out.dependencies.role < record.roleRevision;
    if (out.kind === 'handover' && (!out.recipient || !out.recommendationIds || (!historicalRole && !record.role.recipients.some(r => r.id === out.recipient!.id)))) issue('Missing configured recipient or recommendation references');
    if ((out.recommendationIds ?? []).some(id => !record.recommendations.some(r => r.id === id))) issue('Missing output recommendation');
  }
  const dependencyKeys = new Set(['case', ...Object.keys(runtimeDependencies(record))]);
  for (const object of [...record.outputs, ...record.recommendations, ...record.reviews]) if (Object.keys(object.dependencies).some(key => !dependencyKeys.has(key))) issue('Missing dependency reference');
  for (const review of record.reviews) if (review.stage === 'first' && review.objectId !== 'facts') issue('Invalid first-review target');
  for (const review of record.reviews) if (review.stage === 'final' && !record.outputs.some(o => o.id === review.objectId) && !record.recommendations.some(r => r.id === review.objectId)) issue('Missing review object');
});
export type RuntimeCaseRecord = z.infer<typeof RuntimeCaseRecordSchema>;
export const RuntimeExportSnapshotSchema = ExportSnapshotSchema.extend({
  schemaVersion: z.literal(2), mode: z.enum(['mock', 'live']),
  review: z.object({ simulated: z.boolean(), label: z.string(), actor: z.string(), reviewedAt: z.string().datetime() }),
});
export type RuntimeExportSnapshot = z.infer<typeof RuntimeExportSnapshotSchema>;
export function runtimeDependencies(r: RuntimeCaseRecord): Record<string, number> {
  return { analysis: r.analysis.version, role: r.roleRevision, guidance: r.guidanceRevision,
    ...Object.fromEntries(r.guidelines.map(g => [`guideline:${g.id}`, g.version])),
    ...Object.fromEntries(r.facts.map(f => [`fact:${f.fieldId}:${f.recordId ?? ''}`, f.version])),
    ...Object.fromEntries(r.recommendations.map(x => [`recommendation:${x.id}`, x.version])),
    ...Object.fromEntries(r.outputs.map(x => [`output:${x.id}`, x.version])) };
}
export function dependenciesValid(r: RuntimeCaseRecord, deps: Record<string, number>): boolean {
  const current = runtimeDependencies(r);
  return Object.entries(deps).every(([key, version]) => current[key] === version);
}
export function runtimeReviewValid(r: RuntimeCaseRecord, id: string, allowSimulation = false): boolean {
  const object = [...r.outputs, ...r.recommendations].find(o => o.id === id);
  return !!object && dependenciesValid(r, object.dependencies) && r.reviews.some(v => v.stage === 'final' && v.objectId === id && v.objectVersion === object.version &&
    (allowSimulation || !v.simulated) && JSON.stringify(v.dependencies) === JSON.stringify(object.dependencies) && dependenciesValid(r, v.dependencies));
}
export function runtimeSnapshot(r: RuntimeCaseRecord, id: string, allowSimulation = false): RuntimeExportSnapshot {
  RuntimeCaseRecordSchema.parse(r);
  const output = r.outputs.find(o => o.id === id);
  const unfinishedMessages = r.conversation?.messages.some(m => m.status !== 'applied' || hasPendingMessageQuotes(m) || m.updates.some(u => u.disposition === 'awaiting-decision') || m.clarifications?.some(c => c.status !== 'applied'));
  if (unfinishedMessages || hasStaleFieldGaps(r) || (r.analysisUpdate && r.analysisUpdate.status !== 'current')) throw new Error('Complete the pending analysis before export.');
  if (!output || !r.saved || r.needsFactConfirmation || !runtimeReviewValid(r, id, allowSimulation)) throw new Error('Save and review the current output and dependencies before export.');
  if ((output.recommendationIds ?? []).some(key => !runtimeReviewValid(r, key, allowSimulation))) throw new Error('Recommendation review required.');
  if (r.guidanceStatus !== 'available' && (output.kind !== 'summary' || (output.recommendationIds ?? []).length)) throw new Error('Only a factual summary is available without guidance.');
  const review = [...r.reviews].reverse().find(v => v.stage === 'final' && v.objectId === id && v.objectVersion === output.version && (allowSimulation || !v.simulated))!;
  return RuntimeExportSnapshotSchema.parse({ schemaVersion: 2, caseId: r.caseId, caseVersion: r.version, objectId: id, objectVersion: output.version,
    title: output.title, body: output.body, dependencies: output.dependencies, synthetic: true, mode: r.mode, contentApproval: 'pending',
    review: { simulated: review.simulated, actor: review.actor, reviewedAt: review.reviewedAt, label: review.simulated ? 'Training simulation only' : 'Employee reviewed synthetic record' } });
}
export type RequestTicket = { caseId: string; instanceId: string; caseVersion: number; requestId: string; settingsRevision: number; dependencies: Record<string, number> };
export function ticketCurrent(r: RuntimeCaseRecord, ticket: RequestTicket, currentRequestId: string, settingsRevision: number): boolean {
  return ticket.caseId === r.caseId && ticket.instanceId === r.instanceId && ticket.caseVersion === r.version && ticket.requestId === currentRequestId && ticket.settingsRevision === settingsRevision && dependenciesValid(r, ticket.dependencies);
}
