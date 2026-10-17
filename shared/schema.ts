import { z } from 'zod';

export const DependencySchema = z.record(z.string(), z.number().int().nonnegative());
const ValueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.array(z.string()), z.null()]);
const fieldIds = Object.entries({ A: 8, B: 7, C: 8, D: 5, E: 9, F: 7, G: 5, H: 10, I: 6, J: 5, K: 7, L: 7, M: 10, N: 6, O: 9, P: 8 }).flatMap(([group, count]) => Array.from({ length: count }, (_, i) => `${group}${String(i + 1).padStart(2, '0')}`));
export const TargetSchema = z.object({ fieldId: z.enum(fieldIds as [string, ...string[]]), recordId: z.string().optional() });
export const FactRecordSchema = z.object({
  ...TargetSchema.shape, value: ValueSchema, version: z.number().int().positive(),
  status: z.enum(['extracted', 'missing', 'unclear', 'conflict', 'not-applicable']),
  reviewStatus: z.enum(['unreviewed', 'checked', 'corrected']), sourceIds: z.array(z.string()),
  candidates: z.array(z.object({ value: ValueSchema, sourceIds: z.array(z.string()) })),
  history: z.array(z.object({ value: ValueSchema, reason: z.string(), sourceIds: z.array(z.string()) })),
}).superRefine((fact, ctx) => {
  const requiresRecord = /^[CDIJ]/.test(fact.fieldId) || /^E0[2-9]$/.test(fact.fieldId);
  if (requiresRecord && !fact.recordId?.trim()) ctx.addIssue({ code: 'custom', path: ['recordId'], message: 'Repeated fact requires an exact record ID' });
  const checkValue = (value: z.infer<typeof ValueSchema>, path: (string | number)[]) => {
    if (fact.fieldId === 'E04' && value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
      ctx.addIssue({ code: 'custom', path, message: 'E04 amount must be a finite number or null' });
    }
    if (['C08', 'F01', 'G01', 'G05', 'H08'].includes(fact.fieldId) && value !== null && typeof value !== 'boolean') {
      ctx.addIssue({ code: 'custom', path, message: 'Boolean fact must be true, false or null' });
    }
    if (fact.fieldId === 'E05' && value !== null && typeof value !== 'string') {
      ctx.addIssue({ code: 'custom', path, message: 'E05 currency must be a string or null' });
    }
  };
  checkValue(fact.value, ['value']);
  fact.candidates.forEach((candidate, index) => checkValue(candidate.value, ['candidates', index, 'value']));
  fact.history.forEach((history, index) => checkValue(history.value, ['history', index, 'value']));
});
export const RoleProfileSchema = z.object({
  id: z.string(), version: z.number().int().positive(), organisation: z.string(), title: z.string(),
  permissions: z.array(z.string()), recipients: z.array(z.object({ id: z.string(), title: z.string() })),
  contentApproval: z.literal('pending'), enabled: z.literal(false), synthetic: z.literal(true),
});
export const GuidelineSchema = z.object({
  id: z.string(), version: z.number().int().positive(), contentApproval: z.literal('pending'),
  enabled: z.literal(false), synthetic: z.literal(true), roleId: z.string(),
  required: z.array(z.object({ target: TargetSchema, allowedValues: z.array(ValueSchema) })),
  requiredContext: z.array(z.string()),
  allowedUnknown: z.array(TargetSchema), step: z.string(), limits: z.array(z.string()),
  onMismatch: z.string(), humanEscalation: z.string(),
});
export const AnalysisResultSchema = z.object({
  version: z.number().int().positive(), basedOnCaseVersion: z.number().int().positive(),
  source: z.enum(['mock', 'model']), types: z.array(z.string()), reasons: z.array(z.string()),
  alternatives: z.array(z.string()), gaps: z.array(z.string()), facts: z.array(FactRecordSchema),
  guidanceStatus: z.literal('unapproved'), recommendations: z.array(z.never()),
}).strict();
export const QuestionSchema = z.object({
  id: z.string(), round: z.number().int().min(1).max(3), target: TargetSchema,
  text: z.string(), reason: z.string(), status: z.enum(['pending', 'answered', 'unknown', 'not-applicable', 'skipped']),
  answer: z.string().nullable(), history: z.array(z.object({ answer: z.string().nullable(), status: z.string() })),
});
export const AnalysisEnvelopeSchema = z.object({
  facts: z.array(FactRecordSchema), analysis: AnalysisResultSchema, questions: z.array(QuestionSchema),
}).strict();
export const FollowUpSchema = z.object({
  rounds: z.number().int().min(0).max(3), totalQuestions: z.number().int().min(0).max(9),
  stopped: z.boolean(), questions: z.array(QuestionSchema),
}).superRefine((value, ctx) => {
  if (value.totalQuestions !== value.questions.length) ctx.addIssue({ code: 'custom', message: 'Question count differs from saved questions' });
  const rounds = new Set(value.questions.map(q => q.round));
  if (rounds.size !== value.rounds || [...rounds].some(r => r > value.rounds)) ctx.addIssue({ code: 'custom', message: 'Round count differs from saved questions' });
  for (const round of rounds) if (value.questions.filter(q => q.round === round).length > 3) ctx.addIssue({ code: 'custom', message: 'More than 3 questions in a round' });
  if (new Set(value.questions.map(q => q.id)).size !== value.questions.length) ctx.addIssue({ code: 'custom', message: 'Duplicate question ID' });
});
export const RecipientSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), name: z.string().optional(), role: z.string().optional(),
});
export const RecommendationSchema = z.object({
  id: z.string().min(1), version: z.number().int().positive(), responsibleRole: z.string().min(1), step: z.string().min(1),
  priority: z.object({ order: z.number().int().nonnegative(), reason: z.string().min(1) }),
  dependencies: DependencySchema, factRefs: z.array(TargetSchema).min(1),
  guidelineRefs: z.array(z.object({ id: z.string().min(1), version: z.number().int().positive() })).min(1),
  limits: z.array(z.string()), decision: z.enum(['pending', 'accepted', 'modified', 'rejected']),
  decisionReason: z.string().nullable(), simulated: z.literal(true), contentApproval: z.literal('pending'),
}).superRefine((value, ctx) => {
  if ((value.decision === 'modified' || value.decision === 'rejected') && !value.decisionReason?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Modified or rejected simulated decision requires a reason' });
  }
});
export const OutputRecordSchema = z.object({
  id: z.string(), kind: z.enum(['summary', 'handover']), version: z.number().int().positive(),
  title: z.string(), body: z.string(), dependencies: DependencySchema, contentApproval: z.literal('pending'),
  recipient: RecipientSchema.optional(), recommendationIds: z.array(z.string()).optional(),
});
export const SummarySchema = OutputRecordSchema.extend({ kind: z.literal('summary') });
export const HandoverDraftSchema = OutputRecordSchema.extend({
  kind: z.literal('handover'), recipient: RecipientSchema, recommendationIds: z.array(z.string()),
});
export const ReviewRecordSchema = z.object({
  stage: z.enum(['first', 'final']), objectId: z.string(), objectVersion: z.number().int().positive(),
  dependencies: DependencySchema, simulated: z.literal(true),
});
export const CaseRecordSchema = z.object({
  schemaVersion: z.literal(1), synthetic: z.literal(true), mode: z.literal('mock'), contentApproval: z.literal('pending'),
  caseId: z.string(), evaluationId: z.string(), version: z.number().int().positive(), stage: z.string(),
  role: RoleProfileSchema, facts: z.array(FactRecordSchema), analysis: AnalysisResultSchema,
  followUp: FollowUpSchema, outputs: z.array(OutputRecordSchema), reviews: z.array(ReviewRecordSchema),
  saved: z.boolean(), needsFactConfirmation: z.boolean(),
  recommendations: z.array(RecommendationSchema).optional(),
  error: z.object({ kind: z.enum(['model', 'save', 'stale']), message: z.string() }).optional(),
}).superRefine((value, ctx) => {
  const keys = value.facts.map(f => `${f.fieldId}:${f.recordId ?? ''}`);
  if (value.facts.some(f => !/^[A-J]/.test(f.fieldId))) ctx.addIssue({ code: 'custom', path: ['facts'], message: 'Case facts contain only A-J context and fact fields; K-P are derived or review structures' });
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', message: 'Duplicate fact target' });
  if (new Set(value.outputs.map(o => o.id)).size !== value.outputs.length) ctx.addIssue({ code: 'custom', message: 'Duplicate output ID' });
  const recommendationIds = new Set((value.recommendations ?? []).map(r => r.id));
  if (recommendationIds.size !== (value.recommendations ?? []).length) ctx.addIssue({ code: 'custom', message: 'Duplicate recommendation ID' });
  for (const output of value.outputs) {
    if (output.kind === 'handover') {
      if (!HandoverDraftSchema.safeParse(output).success) ctx.addIssue({ code: 'custom', message: `Handover requires recipient and recommendation references: ${output.id}` });
      if (!output.recipient || !value.role.recipients.some(recipient => recipient.id === output.recipient!.id)) ctx.addIssue({ code: 'custom', message: `Handover recipient is absent from the configured teaching role: ${output.id}` });
    }
    if ((output.recommendationIds ?? []).some(id => !recommendationIds.has(id))) ctx.addIssue({ code: 'custom', message: `Unknown recommendation reference: ${output.id}` });
    if (output.kind === 'summary' && output.recipient) ctx.addIssue({ code: 'custom', message: 'Independent summary cannot have a recipient' });
  }
  for (const recommendation of value.recommendations ?? []) {
    if (recommendation.factRefs.some(ref => !keys.includes(`${ref.fieldId}:${ref.recordId ?? ''}`))) ctx.addIssue({ code: 'custom', message: `Unknown recommendation fact target: ${recommendation.id}` });
  }
});
export const ExportSnapshotSchema = z.object({
  caseId: z.string(), caseVersion: z.number().int().positive(), objectId: z.string(), objectVersion: z.number().int().positive(),
  title: z.string(), body: z.string(), synthetic: z.literal(true), mode: z.literal('mock'), contentApproval: z.literal('pending'),
  review: z.object({ simulated: z.literal(true), label: z.literal('Training simulation only') }), dependencies: DependencySchema,
});
export type FactRecord = z.infer<typeof FactRecordSchema>;
export type RoleProfile = z.infer<typeof RoleProfileSchema>;
export type Guideline = z.infer<typeof GuidelineSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type OutputRecord = z.infer<typeof OutputRecordSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type HandoverDraft = z.infer<typeof HandoverDraftSchema>;
export type Summary = z.infer<typeof SummarySchema>;
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;
export type CaseRecord = z.infer<typeof CaseRecordSchema>;
export type ExportSnapshot = z.infer<typeof ExportSnapshotSchema>;
export type Target = z.infer<typeof TargetSchema>;
