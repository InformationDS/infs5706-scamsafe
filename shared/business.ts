import { z } from 'zod';
import { FactRecordSchema, GuidelineSchema, RoleProfileSchema, TargetSchema } from './schema.js';

export const BusinessApprovalSchema = z.object({
  id: z.literal('BUSINESS-BASELINE-01'), contentVersion: z.literal(1), status: z.literal('approved'),
  approvedBy: z.literal('A (user in this conversation)'), approvedOn: z.literal('2026-10-17'),
  authority: z.literal('Direct user instruction in this conversation'), userInstruction: z.literal('你直接完成所有的业务内容，我都批准'),
  hashNormalization: z.literal('utf8-lf'),
  scope: z.array(z.string()).min(1), limitations: z.array(z.string()).min(1),
  artifacts: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
}).strict();
const approvalRef = z.literal('BUSINESS-BASELINE-01');
export const ApprovedRoleSchema = RoleProfileSchema.extend({
  contentApproval: z.literal('approved'), enabled: z.literal(true), approvalRef,
  excludedActions: z.array(z.string()).min(1),
  recipientResponsibilities: z.record(z.string(), z.string()),
});
export const ApprovedGuidelineSchema = GuidelineSchema.extend({
  contentApproval: z.literal('approved'), enabled: z.literal(true), approvalRef,
  validity: z.literal('current'),
});
export const BusinessCaseSchema = z.object({
  evaluationId: z.literal('T09'), caseId: z.literal('EXAMPLE-01'), contentVersion: z.literal(1),
  synthetic: z.literal(true), contentApproval: z.literal('approved'), approvalRef,
  expectationOnly: z.literal(true), roleId: z.string(),
  input: z.string().min(1),
  correction: z.object({ target: TargetSchema, from: z.number(), to: z.number(), text: z.string() }),
  questions: z.array(z.object({ id: z.string(), target: TargetSchema, text: z.string(), reason: z.string() })).length(3),
  answers: z.array(z.object({ text: z.string(), questionStates: z.record(z.string(), z.enum(['answered', 'unknown'])) })).length(2),
  expectedFacts: z.array(FactRecordSchema).min(1),
  recommendations: z.array(z.object({
    id: z.string(), guidelineId: z.string(), guidelineVersion: z.literal(1),
    step: z.string(), responsibleRole: z.string(), priority: z.string(), dependency: z.string(),
    expectedDecision: z.enum(['accepted', 'rejected']), reason: z.string().nullable(),
  })).length(3),
  bodies: z.object({ factualSummary: z.string(), sharedSummary: z.string(), bank: z.string(), telecom: z.string() }),
  bodyConditions: z.array(z.string()).min(1),
  expectedChecks: z.array(z.object({ name: z.string(), precondition: z.string(), expected: z.string(), forbidden: z.string(), source: z.string() })).min(10),
  execution: z.literal('not-executed'),
}).strict();
export const BusinessBaselineSchema = z.object({
  approval: BusinessApprovalSchema, role: ApprovedRoleSchema,
  guidelines: z.array(ApprovedGuidelineSchema).length(3), baseline: BusinessCaseSchema,
}).superRefine((bundle, ctx) => {
  const ids = bundle.guidelines.map(g => g.id);
  if (new Set(ids).size !== 3 || !['EX-G01', 'EX-G02', 'EX-G03'].every(id => ids.includes(id))) ctx.addIssue({ code: 'custom', message: 'Expected exactly EX-G01–03' });
  if (bundle.baseline.roleId !== bundle.role.id || bundle.guidelines.some(g => g.roleId !== bundle.role.id)) ctx.addIssue({ code: 'custom', message: 'Business role reference mismatch' });
  for (const recommendation of bundle.baseline.recommendations) {
    if (!ids.includes(recommendation.guidelineId)) ctx.addIssue({ code: 'custom', message: 'Unknown approved guideline reference' });
    if (recommendation.expectedDecision === 'rejected' && !recommendation.reason?.trim()) ctx.addIssue({ code: 'custom', message: 'Rejected reference recommendation needs its reason' });
  }
  if (new Set(bundle.baseline.questions.map(q => q.id)).size !== 3) ctx.addIssue({ code: 'custom', message: 'Duplicate baseline question' });
  if (!['HANDOVER-BANK', 'HANDOVER-TELCO'].every(id => bundle.role.recipients.some(r => r.id === id))) ctx.addIssue({ code: 'custom', message: 'Missing approved receiver' });
});
export type BusinessBaseline = z.infer<typeof BusinessBaselineSchema>;
