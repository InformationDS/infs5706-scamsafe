import { z } from 'zod';
import { FactRecordSchema, TargetSchema } from './schema.js';

const Target = z.object(TargetSchema.shape).strict().superRefine((target, ctx) => {
  if (!/^[A-J]/.test(target.fieldId) || !FactRecordSchema.safeParse({ ...target, value: null, version: 1, status: 'missing', reviewStatus: 'unreviewed', sourceIds: [], candidates: [], history: [] }).success) ctx.addIssue({ code: 'custom', message: 'Invalid case fact target' });
});
const Value = FactRecordSchema.shape.value;
const Id = z.string().min(1);
const status = z.enum(['answered', 'unknown', 'not-applicable']);
const typedMapping = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict().superRefine((mapping, ctx) => {
  const m = mapping as { target: z.infer<typeof Target>; status: 'answered' | 'unknown' | 'not-applicable'; value: z.infer<typeof Value> };
  if ((m.status === 'answered') === (m.value === null)) ctx.addIssue({ code: 'custom', message: 'Answered requires a value; unknown and not-applicable require null' });
  if (!FactRecordSchema.safeParse({ ...m.target, value: m.value, version: 1, status: 'extracted', reviewStatus: 'unreviewed', sourceIds: [], candidates: [], history: [] }).success) ctx.addIssue({ code: 'custom', message: 'Invalid target or value type' });
});
export const ConfirmedMappingSchema = typedMapping({ questionId: Id.optional(), target: Target, quote: z.string().min(1), status, value: Value });
export const AnswerMappingSchema = typedMapping({ questionId: Id, target: Target, quote: z.string().min(1), status, value: Value });
export const UnknownObservationSchema = z.object({ target: Target, quote: z.string().min(1), status: z.literal('unknown') }).strict();
const clarificationIntent = z.object({ revision: z.number().int().positive(), sourceId: Id, decisions: z.array(ConfirmedMappingSchema), retainedQuotes: z.array(z.string().min(1)) }).strict();
export const MessageIntentSchema = z.object({ messageId: Id, sourceId: Id, kind: z.enum(['initial', 'supplement']), questionIds: z.array(Id), clarification: clarificationIntent.optional() }).strict();
export const MessageResolutionSchema = z.object({ messageId: Id, sourceId: Id, answers: z.array(AnswerMappingSchema), observations: z.array(UnknownObservationSchema).optional(), unresolvedQuotes: z.array(z.string().min(1)), clarificationRevision: z.number().int().positive().optional() }).strict();
const UpdateSchema = z.object({ questionId: Id.optional(), target: Target, sourceId: Id, outcome: z.enum(['answered', 'unknown', 'not-applicable', 'conflict']), appliedFactVersion: z.number().int().positive().optional(), disposition: z.enum(['current', 'historical', 'awaiting-decision', 'kept-current', 'adopted-earlier']).optional(), supersededByMessageId: Id.optional(), decision: z.object({ choice: z.enum(['keep-current', 'use-earlier']), actor: Id, reason: Id }).strict().optional() }).strict();
const ClarificationSchema = clarificationIntent.extend({ actor: Id, status: z.enum(['recorded', 'applied', 'failed']) }).strict();
export const ConversationMessageSchema = z.object({ id: Id, kind: z.enum(['initial', 'supplement']), sourceId: Id, questionIds: z.array(Id), status: z.enum(['recorded', 'needs-clarification', 'needs-decision', 'applied', 'failed']), recordedFactVersions: z.record(z.string(), z.number().int().nonnegative()).optional(), updates: z.array(UpdateSchema), unresolvedQuotes: z.array(z.string().min(1)), clarifications: z.array(ClarificationSchema).optional(), createdAt: z.string().datetime({ offset: true }) }).strict();
export const ConversationStateSchema = z.object({ messages: z.array(ConversationMessageSchema) }).strict();
export const AnalysisUpdateStateSchema = z.object({ status: z.enum(['pending', 'current', 'failed']), messageId: Id.optional(), operation: z.enum(['message', 'clarification', 'reanalysis', 'follow-up']).optional() }).strict();
export type MessageIntent = z.infer<typeof MessageIntentSchema>;
export type AnswerMapping = z.infer<typeof AnswerMappingSchema>;
export type MessageResolution = z.infer<typeof MessageResolutionSchema>;
export type ConfirmedMapping = z.infer<typeof ConfirmedMappingSchema>;
export type UnknownObservation = z.infer<typeof UnknownObservationSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type ConversationState = z.infer<typeof ConversationStateSchema>;
export type AnalysisUpdateState = z.infer<typeof AnalysisUpdateStateSchema>;

/** Retained notes are not pending only after their clarification has been applied. */
export function hasPendingMessageQuotes(message: ConversationMessage): boolean {
  return message.unresolvedQuotes.some(quote => !message.clarifications?.some(c => c.status === 'applied' && c.retainedQuotes.includes(quote)));
}
