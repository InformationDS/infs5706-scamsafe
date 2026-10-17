import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { AnalysisResultSchema, type CaseRecord } from '../../shared/index.js';
import { isConfigured, type ServerConfig } from './config.js';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable = false) { super(message); }
}

export async function analyzeLive(caseRecord: CaseRecord, config: ServerConfig, fetchImpl: typeof fetch = fetch) {
  if (!isConfigured(config)) throw new ApiError(503, 'MODEL_NOT_CONFIGURED', 'Complete the local model configuration before enabling live analysis.');
  const system = await readFile(new URL('../prompts/intake.txt', import.meta.url), 'utf8');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', [config.authHeader]: `${config.authScheme ? `${config.authScheme} ` : ''}${config.apiKey}` },
      body: JSON.stringify({ model: config.model, stream: false, messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify({ caseData: caseRecord, outputSchema: z.toJSONSchema(AnalysisResultSchema) }) },
      ] }),
    });
    if (!response.ok) throw new ApiError(502, 'MODEL_SERVICE_ERROR', 'The model service rejected the request. Check local configuration or retry.', response.status === 429 || response.status >= 500);
    // Provider errors and generated text are never forwarded through error messages.
    const rawText = await response.text();
    if (rawText.length > 1_000_000) throw new ApiError(502, 'MODEL_INVALID_OUTPUT', 'The model response exceeded the supported size.');
    let payload: unknown;
    try {
      const envelope = JSON.parse(rawText);
      const content = envelope?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error();
      payload = JSON.parse(content);
    } catch { throw new ApiError(502, 'MODEL_INVALID_OUTPUT', 'The model response was not a JSON analysis object.'); }
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
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError(504, 'MODEL_TIMEOUT', 'The model request timed out. Your saved case is unchanged.', true);
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'MODEL_CONNECTION_ERROR', 'The model service could not be reached. Check local configuration or retry.', true);
  } finally { clearTimeout(timer); }
}
