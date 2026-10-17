import { z } from 'zod';
import { CaseRecordSchema, OutputRecordSchema, RecommendationSchema, ReviewRecordSchema, ExportSnapshotSchema, TargetSchema } from './schema.js';
import { ApprovedRoleSchema, ApprovedGuidelineSchema } from './business.js';

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
  instanceId: z.string().min(1), // changes on reset/open/import, even for the same case/version
}).strict().superRefine((record, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  const keys = record.facts.map(f => `${f.fieldId}:${f.recordId ?? ''}`);
  if (!unique(keys) || record.facts.some(f => !/^[A-J]/.test(f.fieldId))) issue('Invalid or duplicate fact target');
  if (!unique(record.sources.map(s => s.id)) || !unique(record.outputs.map(o => o.id)) || !unique(record.recommendations.map(r => r.id))) issue('Duplicate identity');
  const sourceIds = new Set(record.sources.map(s => s.id));
  for (const fact of record.facts) if ([...fact.sourceIds, ...fact.candidates.flatMap(c => c.sourceIds), ...fact.history.flatMap(h => h.sourceIds)].some(id => !sourceIds.has(id))) issue('Missing source reference');
  for (const rec of record.recommendations) {
    if (rec.factRefs.some(ref => !keys.includes(`${ref.fieldId}:${ref.recordId ?? ''}`))) issue('Missing recommendation fact');
    if (rec.guidelineRefs.some(ref => !record.guidelines.some(g => g.id === ref.id && g.version === ref.version))) issue('Missing recommendation guideline');
  }
  for (const out of record.outputs) {
    if (out.kind === 'summary' && out.recipient) issue('Summary cannot have a recipient');
    if (out.kind === 'handover' && (!out.recipient || !out.recommendationIds || !record.role.recipients.some(r => r.id === out.recipient!.id))) issue('Missing configured recipient or recommendation references');
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
