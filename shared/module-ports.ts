import { z } from 'zod';
import type { ComponentType } from 'react';
import { AnalysisEnvelopeSchema } from './schema.js';
import { RuntimeCaseRecordSchema, type RuntimeCaseRecord, type RuntimeExportSnapshot, type RequestTicket } from './runtime.js';

export const moduleNames = ['intake', 'model', 'guidance', 'outputs'] as const;
export type ModuleName = typeof moduleNames[number];
export type PortError = { code: string; message: string; retryable: boolean };
export const AnalysisRequestSchema = z.object({ case: RuntimeCaseRecordSchema, ticket: z.object({ caseId: z.string(), instanceId: z.string(), caseVersion: z.number().int(), requestId: z.string(), settingsRevision: z.number().int(), dependencies: z.record(z.string(), z.number().int()) }), fault: z.enum(['timeout', 'invalid', 'delayed']).optional(), previewMock: z.boolean().optional() }).strict();
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
export type AnalysisResponse = { proposal: z.infer<typeof AnalysisEnvelopeSchema>; ticket: RequestTicket; meta: { implementation: string; providerCalled: boolean; simulated: boolean } };
export type ModelServiceContext = { config: { mode: 'mock' | 'live'; baseUrl: string; model: string; apiKey: string; authHeader: string; authScheme: string; timeoutMs: number; port: number }; fetchImpl?: typeof fetch };
export type AnalyzeRuntime = (input: AnalysisRequest, context?: ModelServiceContext) => Promise<AnalysisResponse>;
export type ExportRuntime = (input: { case: RuntimeCaseRecord; objectId: string; format: 'markdown' | 'pdf'; fault?: 'failure'; previewMock?: boolean }) => Promise<{ snapshot: RuntimeExportSnapshot; bytes: Uint8Array; contentType: string; filename: string }>;
export type ModulePorts = {
  analyze: AnalyzeRuntime;
  save: (record: RuntimeCaseRecord) => Promise<RuntimeCaseRecord>;
  guidance: (record: RuntimeCaseRecord) => Promise<{ recommendations: RuntimeCaseRecord['recommendations']; guidanceStatus: RuntimeCaseRecord['guidanceStatus']; simulated: boolean }>;
  export: (record: RuntimeCaseRecord, objectId: string, format: 'markdown' | 'pdf') => Promise<Blob>;
};
export type ModuleProps = { record: RuntimeCaseRecord; ports: ModulePorts; onChange: (next: RuntimeCaseRecord) => void; onError: (error: PortError) => void; reset: () => void };
export type ModuleEntry = { default: ComponentType<ModuleProps> };
export type ModelRegistration = { analyzeRuntime: AnalyzeRuntime };
export type OutputRegistration = { exportRuntime: ExportRuntime };
