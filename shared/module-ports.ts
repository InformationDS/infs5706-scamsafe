import { z } from 'zod';
import type { ComponentType } from 'react';
import { MessageIntentSchema, MessageResolutionSchema } from './conversation.js';
import { AnalysisEnvelopeSchema } from './schema.js';
import { RuntimeCaseRecordSchema, type RuntimeCaseRecord, type RuntimeExportSnapshot } from './runtime.js';

export const moduleNames = ['intake', 'model', 'guidance', 'outputs'] as const;
export type ModuleName = typeof moduleNames[number];
export type PortError = { code: string; message: string; retryable: boolean };
const RequestTicketSchema = z.object({ caseId: z.string(), instanceId: z.string(), caseVersion: z.number().int(), requestId: z.string(), settingsRevision: z.number().int(), dependencies: z.record(z.string(), z.number().int()) });
export const AnalysisRequestSchema = z.object({ case: RuntimeCaseRecordSchema, ticket: RequestTicketSchema, fault: z.enum(['timeout', 'invalid', 'delayed']).optional(), previewMock: z.boolean().optional(), interaction: MessageIntentSchema.optional(), purpose: z.enum(['case-reanalysis', 'follow-up']).optional() }).strict().refine(input => !(input.interaction && input.purpose), 'interaction and purpose are mutually exclusive');
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
export const AnalysisResponseSchema = z.object({ proposal: AnalysisEnvelopeSchema, ticket: RequestTicketSchema, meta: z.object({ implementation: z.string(), providerCalled: z.boolean(), simulated: z.boolean() }).strict(), resolution: MessageResolutionSchema.optional() }).strict();
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
/** Structural pairing only; model proposal, evidence and target semantics are validated by R04. */
export function parseAnalysisResponseForRequest(input: AnalysisRequest, response: unknown): AnalysisResponse {
  const parsed = AnalysisResponseSchema.parse(response);
  const ticket = parsed.ticket, expected = input.ticket;
  const keys = Object.keys(ticket.dependencies);
  if (ticket.caseId !== expected.caseId || ticket.instanceId !== expected.instanceId || ticket.caseVersion !== expected.caseVersion || ticket.requestId !== expected.requestId || ticket.settingsRevision !== expected.settingsRevision || keys.length !== Object.keys(expected.dependencies).length || keys.some(key => ticket.dependencies[key] !== expected.dependencies[key])) throw new Error('Response ticket does not match request');
  if (!input.interaction) {
    if (parsed.resolution) throw new Error('Unexpected message resolution');
  } else {
    const resolution = parsed.resolution;
    if (!resolution || resolution.messageId !== input.interaction.messageId || resolution.sourceId !== input.interaction.sourceId || resolution.clarificationRevision !== input.interaction.clarification?.revision) throw new Error('Message resolution does not match request');
  }
  return parsed;
}
export type ModelServiceContext = { config: { mode: 'mock' | 'live'; baseUrl: string; model: string; apiKey: string; authHeader: string; authScheme: string; timeoutMs: number; port: number }; fetchImpl?: typeof fetch };
export type AnalyzeRuntime = (input: AnalysisRequest, context?: ModelServiceContext) => Promise<AnalysisResponse>;
export type ExportRuntime = (input: { case: RuntimeCaseRecord; objectId: string; format: 'markdown' | 'pdf'; fault?: 'failure'; previewMock?: boolean }) => Promise<{ snapshot: RuntimeExportSnapshot; bytes: Uint8Array; contentType: string; filename: string }>;
export type ModulePorts = {
  analyze: AnalyzeRuntime;
  save: (record: RuntimeCaseRecord) => Promise<RuntimeCaseRecord>;
  guidance: (record: RuntimeCaseRecord) => Promise<{ recommendations: RuntimeCaseRecord['recommendations']; guidanceStatus: RuntimeCaseRecord['guidanceStatus']; simulated: boolean }>;
  export: (record: RuntimeCaseRecord, objectId: string, format: 'markdown' | 'pdf') => Promise<Blob>;
};
export type ModuleProps = {
  record: RuntimeCaseRecord;
  ports: ModulePorts;
  onChange: (next: RuntimeCaseRecord) => void;
  onError: (error: PortError) => void;
  reset: () => void;
  integrated?: boolean;
  employeeActor?: string;
  onWorkingEditChange?: (dirty: boolean) => void;
};
export type ModuleEntry = { default: ComponentType<ModuleProps> };
export type ModelRegistration = { analyzeRuntime: AnalyzeRuntime };
export type OutputRegistration = { exportRuntime: ExportRuntime };
