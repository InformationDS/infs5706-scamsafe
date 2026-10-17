import express, { type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { chromium } from 'playwright';
import { CaseRecordSchema, AnalysisResultSchema, buildSnapshot, fixtureNames, makeFixture } from '../../shared/index.js';
import { snapshotFilename, snapshotToHtml, snapshotToMarkdown } from '../../shared/export.js';
import { readConfig, isConfigured, type ServerConfig } from './config.js';
import { analyzeLive, ApiError } from './model.js';
import { loadBusinessBaseline } from './business.js';
import { ModelSettingsStore } from './model-settings.js';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { AnalysisRequestSchema, type AnalyzeRuntime, type ExportRuntime, type ModelRegistration, type OutputRegistration } from '../../shared/module-ports.js';
import { RuntimeCaseRecordSchema, runtimeSnapshot, ticketCurrent } from '../../shared/runtime.js';
import { makeRuntimeFixture } from '../../shared/runtime-fixtures.js';
import { AnalysisEnvelopeSchema } from '../../shared/schema.js';

const AnalyzeRequest = z.object({ case: CaseRecordSchema, fault: z.enum(['timeout', 'invalid', 'delayed']).optional() }).strict();
const ExportRequest = z.object({ case: CaseRecordSchema, objectId: z.string().min(1), format: z.enum(['markdown', 'pdf']), fault: z.literal('failure').optional() }).strict();
type Options = { config?: ServerConfig; settingsStore?: ModelSettingsStore; fetchImpl?: typeof fetch; staticDir?: string; analyzeRuntime?: AnalyzeRuntime; exportRuntime?: ExportRuntime };

async function registered<T>(path: string): Promise<Partial<T>> {
  const absolute = resolve(process.cwd(), path);
  return existsSync(absolute) ? await import(pathToFileURL(absolute).href) as Partial<T> : {};
}
export const mockRuntimeAnalysis: AnalyzeRuntime = async input => {
  if (input.fault === 'timeout') throw new ApiError(504, 'MODEL_TIMEOUT', 'Simulated timeout; input retained.', true);
  if (input.fault === 'invalid') throw new ApiError(502, 'MODEL_INVALID_OUTPUT', 'Simulated invalid response; input retained.', true);
  if (input.fault === 'delayed') await new Promise(resolve => setTimeout(resolve, 1500));
  const fixed = makeRuntimeFixture('T09');
  return { proposal: AnalysisEnvelopeSchema.parse({ facts: fixed.facts.filter(f => !/^[A]/.test(f.fieldId)), analysis: { ...fixed.analysis, basedOnCaseVersion: input.case.version }, questions: [] }), ticket: input.ticket,
    meta: { implementation: 'A01 fixed T09 MOCK proposal (no merge)', simulated: true, providerCalled: false } };
};
export const mockRuntimeExport: ExportRuntime = async input => {
  if (!input.previewMock || input.case.mode !== 'mock') throw new ApiError(409, 'MODULE_NOT_READY', 'E output service is not installed. Use explicit MOCK preview only.');
  let snapshot;
  try { snapshot = runtimeSnapshot(input.case, input.objectId, true); }
  catch { throw new ApiError(409, 'EXPORT_REVIEW_REQUIRED', 'Save and obtain a current MOCK review before preview export.'); }
  if (input.fault) throw new ApiError(503, 'EXPORT_FAILED', 'Simulated output failure; body and reviews retained.', true);
  const legacy = { ...snapshot, mode: 'mock' as const, review: { simulated: true as const, label: 'Training simulation only' as const } };
  const filename = snapshotFilename(legacy, input.format === 'pdf' ? 'pdf' : 'md');
  if (input.format === 'markdown') return { snapshot, filename, bytes: Buffer.from(snapshotToMarkdown(legacy)), contentType: 'text/markdown' };
  let browser;
  try {
    browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    await page.setContent(snapshotToHtml(legacy), { waitUntil: 'load' });
    return { snapshot, filename, bytes: await page.pdf({ format: 'A4', printBackground: true }), contentType: 'application/pdf' };
  } catch { throw new ApiError(503, 'PDF_UNAVAILABLE', 'Install Chromium and retry the same snapshot.', true); }
  finally { await browser?.close(); }
};

function allowedOrigin(origin: string, host: string | undefined): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:') return false;
    // Vite is the only permitted development origin. Production uses the current loopback host.
    return url.host === host || url.origin === 'http://127.0.0.1:5173' || url.origin === 'http://localhost:5173';
  } catch { return false; }
}

export function createApp(options: Options = {}) {
  const settings = options.settingsStore ?? new ModelSettingsStore({ config: options.config ?? readConfig(),
    filePath: options.config ? undefined : resolve(process.cwd(), 'local/model-settings.json') });
  const app = express();
  let runtimeSettingsRevision = 1;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    const host = req.headers.host;
    // Reject DNS rebinding hostnames even when an attacker omits Origin.
    if (!host || !/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) return res.status(403).json({ error: { code: 'HOST_REJECTED', message: 'Use a loopback URL.', retryable: false } });
    if (req.headers.origin && !allowedOrigin(req.headers.origin, host)) return res.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'This origin cannot access the local service.', retryable: false } });
    next();
  });
  app.use('/api', express.json({ limit: '1mb', type: 'application/json' }));
  app.get('/api/health', (_req, res) => {
    const config = settings.getConfig();
    res.json({ ok: true, mode: config.mode, configured: isConfigured(config), contentApproval: 'pending' });
  });
  app.get('/api/settings/model', (_req, res) => res.json(settings.publicSettings()));
  app.put('/api/settings/model', (req, res, next) => {
    try { const saved = settings.save(req.body); runtimeSettingsRevision++; res.json(saved); } catch (error) { next(error); }
  });
  app.get('/api/business', (_req, res, next) => {
    try { res.json(loadBusinessBaseline()); } catch (error) { next(error); }
  });

  app.get('/api/runtime/context', async (_req, res, next) => {
    try { res.json({ settingsRevision: runtimeSettingsRevision, previewMode: 'mock',
      modelRegistered: !!(options.analyzeRuntime ?? (await registered<ModelRegistration>('server/src/model.ts')).analyzeRuntime),
      outputRegistered: !!(options.exportRuntime ?? (await registered<OutputRegistration>('server/src/output-service.ts')).exportRuntime) }); }
    catch (error) { next(error); }
  });
  app.post('/api/runtime/analyze', async (req, res, next) => {
    try {
      const parsed = AnalysisRequestSchema.safeParse(req.body);
      if (!parsed.success) throw new ApiError(400, 'INVALID_INPUT', 'Supply the runtime case and request ticket.');
      const input = parsed.data;
      if (!ticketCurrent(input.case, input.ticket, input.ticket.requestId, runtimeSettingsRevision)) throw new ApiError(409, 'STALE_REQUEST', 'Request identity or settings changed; request current context again.', true);
      const service = input.previewMock ? mockRuntimeAnalysis : options.analyzeRuntime ?? (await registered<ModelRegistration>('server/src/model.ts')).analyzeRuntime;
      if (!service) throw new ApiError(503, 'MODULE_NOT_READY', 'C analyzeRuntime service is not installed.', true);
      const revision = runtimeSettingsRevision;
      const response = await service(input, { config: settings.getConfig(), fetchImpl: options.fetchImpl });
      if (revision !== runtimeSettingsRevision) throw new ApiError(409, 'STALE_REQUEST', 'Model settings changed during analysis.', true);
      AnalysisEnvelopeSchema.parse(response.proposal);
      if (JSON.stringify(response.ticket) !== JSON.stringify(input.ticket)) throw new ApiError(502, 'INVALID_TICKET', 'Service returned a different request identity.');
      res.json(response);
    } catch (error) { next(error); }
  });
  app.post('/api/runtime/export', async (req, res, next) => {
    try {
      const parsed = z.object({ case: RuntimeCaseRecordSchema, objectId: z.string().min(1), format: z.enum(['markdown','pdf']), fault: z.literal('failure').optional(), previewMock: z.boolean().optional() }).strict().safeParse(req.body);
      if (!parsed.success) throw new ApiError(400, 'INVALID_INPUT', 'Supply the runtime case, object and format.');
      const service = parsed.data.previewMock ? mockRuntimeExport : options.exportRuntime ?? (await registered<OutputRegistration>('server/src/output-service.ts')).exportRuntime;
      if (!service) throw new ApiError(503, 'MODULE_NOT_READY', 'E exportRuntime service is not installed.', true);
      const result = await service(parsed.data);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename.replace(/[^A-Za-z0-9_.-]/g, '_')}"`);
      res.type(result.contentType).send(Buffer.from(result.bytes));
    } catch (error) { next(error); }
  });

  app.post('/api/analyze', async (req, res, next) => {
    const config = settings.getConfig();
    try {
      const parsed = AnalyzeRequest.safeParse(req.body);
      if (!parsed.success) throw new ApiError(400, 'INVALID_INPUT', 'Supply a valid shared case and supported fault option.');
      const { case: record, fault } = parsed.data;
      let analysis;
      if (config.mode === 'live') {
        if (fault) throw new ApiError(400, 'FAULT_NOT_ALLOWED', 'Fault injection is available only in mock mode.');
        analysis = await analyzeLive(record, config, options.fetchImpl);
      } else {
        if (fault === 'timeout') throw new ApiError(504, 'MODEL_TIMEOUT', 'Simulated timeout. Saved results are unchanged.', true);
        if (fault === 'invalid') throw new ApiError(502, 'MODEL_INVALID_OUTPUT', 'Simulated invalid model response. Saved results are unchanged.');
        const baseline = fixtureNames.map(name => makeFixture(name)).find(f => f.caseId === record.caseId && f.evaluationId === record.evaluationId && JSON.stringify(f.facts) === JSON.stringify(record.facts));
        if (!baseline) throw new ApiError(422, 'MOCK_INPUT_UNSUPPORTED', 'Mock analysis accepts only the fixed synthetic fixture facts. Restore a fixed state or configure the model locally.');
        if (fault === 'delayed') await new Promise(resolveDelay => setTimeout(resolveDelay, 1500));
        analysis = AnalysisResultSchema.parse({ ...baseline.analysis, source: 'mock', basedOnCaseVersion: record.version });
      }
      res.json({ analysis, meta: { mode: config.mode, providerCalled: config.mode === 'live', requestId: randomUUID(), caseVersion: record.version, contentApproval: 'pending' } });
    } catch (error) { next(error); }
  });

  app.post('/api/export', async (req, res, next) => {
    const config = settings.getConfig();
    try {
      const parsed = ExportRequest.safeParse(req.body);
      if (!parsed.success) throw new ApiError(400, 'INVALID_INPUT', 'Supply a valid shared case, output identifier and format.');
      let snapshot;
      try { snapshot = buildSnapshot(parsed.data.case, parsed.data.objectId); }
      catch { throw new ApiError(409, 'EXPORT_REVIEW_REQUIRED', 'Save the current state and obtain a current simulated review before export.'); }
      if (parsed.data.fault) {
        if (config.mode !== 'mock') throw new ApiError(400, 'FAULT_NOT_ALLOWED', 'Fault injection is available only in mock mode.');
        throw new ApiError(503, 'EXPORT_FAILED', 'Simulated export failure. The reviewed snapshot was retained; turn off the failure switch and retry.', true);
      }
      const extension = parsed.data.format === 'markdown' ? 'md' : 'pdf';
      res.setHeader('Content-Disposition', `attachment; filename="${snapshotFilename(snapshot, extension)}"`);
      if (parsed.data.format === 'markdown') return res.type('text/markdown').send(snapshotToMarkdown(snapshot));
      let browser;
      try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.route('**/*', route => route.abort());
        await page.setContent(snapshotToHtml(snapshot), { waitUntil: 'load' });
        const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '16mm', right: '16mm' } });
        res.type('application/pdf').send(pdf);
      } catch { throw new ApiError(503, 'PDF_UNAVAILABLE', 'PDF generation failed. Install the local Chromium runtime and retry the same reviewed version.', true); }
      finally { await browser?.close(); }
    } catch (error) { next(error); }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API route.', retryable: false } }));
  app.use(express.static(options.staticDir ?? resolve(process.cwd(), 'dist')));
  const handler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ApiError) return void res.status(error.status).json({ error: { code: error.code, message: error.message, retryable: error.retryable } });
    if (error?.type === 'entity.too.large') return void res.status(413).json({ error: { code: 'INPUT_TOO_LARGE', message: 'The case exceeds the supported request size.', retryable: false } });
    if (error instanceof SyntaxError) return void res.status(400).json({ error: { code: 'INVALID_JSON', message: 'The request must contain valid JSON.', retryable: false } });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The local operation failed. Saved data is unchanged.', retryable: true } });
  };
  app.use(handler);
  return app;
}
