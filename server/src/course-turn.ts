import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  CourseCaseSchema,
  CourseTurnRequestSchema,
  TurnProposalSchema,
  applyCourseProposal,
  type CourseCase,
  type CourseTurnRequest,
} from '../../shared/course-case.js';
import { isConfigured, type ServerConfig } from './config.js';
import { ApiError } from './model.js';

const LIVE_REQUIRED =
  'Live model is not configured. Set MODEL_MODE=live and the model URL, name and key, then restart the local service. Your text is kept.';
const TIMEOUT_MESSAGE = 'The model timed out. Your text is kept. Retry uses the same text.';
const INVALID_OUTPUT_MESSAGE =
  'The model returned an unusable result. Your text is kept. Retry does not change the saved facts.';

export type CourseTurnRunner = (
  input: CourseTurnRequest,
  context: { config: ServerConfig; fetchImpl: typeof fetch },
) => Promise<{ case: CourseCase; assistantText: string }>;

const invalidOutput = () => new ApiError(502, 'MODEL_INVALID_OUTPUT', INVALID_OUTPUT_MESSAGE, true);

export async function runCourseTurn(
  input: CourseTurnRequest,
  context: { config: ServerConfig; fetchImpl: typeof fetch },
): Promise<{ case: CourseCase; assistantText: string }> {
  const checked = CourseTurnRequestSchema.safeParse(input);
  if (!checked.success) {
    throw new ApiError(400, 'INVALID_INPUT', 'Supply the course case, text, purpose and replacement choice.');
  }
  const request = checked.data;
  const { config } = context;

  if (config.mode !== 'live' || !isConfigured(config)) {
    throw new ApiError(503, 'COURSE_LIVE_REQUIRED', LIVE_REQUIRED, true);
  }
  // Decide on the purpose before the model runs: an unconfirmed regeneration is refused without a call.
  if (
    request.purpose === 'generate' &&
    request.case.materials.status !== 'not-generated' &&
    !request.replaceExisting
  ) {
    throw new ApiError(
      409,
      'MATERIALS_REPLACE_REQUIRED',
      'Existing materials are preserved. Confirm that they should be replaced before generating again.',
    );
  }

  const [system, guidelines] = await Promise.all([
    readFile(new URL('../prompts/course-turn.txt', import.meta.url), 'utf8'),
    loadGuidelines(),
  ]);

  const content = await requestCompletion(config, context.fetchImpl, [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(buildModelInput(request, guidelines)) },
  ]);

  let rawProposal: unknown;
  try {
    rawProposal = JSON.parse(stripCodeFence(content));
  } catch {
    throw invalidOutput();
  }
  const proposal = TurnProposalSchema.safeParse(rawProposal);
  if (!proposal.success) throw invalidOutput();

  let nextCase: CourseCase;
  try {
    nextCase = applyCourseProposal(request.case, {
      userText: request.userText,
      purpose: request.purpose,
      replaceExisting: request.replaceExisting,
      retryMessageId: request.retryMessageId,
      proposal: proposal.data,
    });
  } catch {
    throw invalidOutput();
  }

  const validated = CourseCaseSchema.safeParse(nextCase);
  if (!validated.success) throw invalidOutput();
  const assistant = [...validated.data.messages].reverse().find((message) => message.role === 'assistant');
  if (!assistant) throw invalidOutput();
  return { case: validated.data, assistantText: assistant.text };
}

async function loadGuidelines(): Promise<unknown[]> {
  const parsed: unknown = JSON.parse(
    await readFile(resolve(process.cwd(), 'data/course/guidelines.json'), 'utf8'),
  );
  if (!Array.isArray(parsed)) throw new Error('Course guidelines are not available.');
  return parsed;
}

function buildModelInput(request: CourseTurnRequest, guidelines: unknown[]) {
  const courseCase = request.case;
  const pending = courseCase.questions.find((question) => question.status === 'pending');
  return {
    role: courseCase.role,
    phase: courseCase.phase,
    purpose: request.purpose,
    facts: courseCase.facts.map(({ key, label, value, status, uncertainty, origin }) => ({
      key,
      label,
      value,
      status,
      uncertainty,
      origin,
    })),
    questions: courseCase.questions.map(({ id, text, purpose, relatedKeys, status }) => ({
      id,
      text,
      purpose,
      relatedKeys,
      status,
    })),
    questionProgress: {
      total: courseCase.questions.length,
      handled: courseCase.questions.filter((question) => question.status !== 'pending').length,
      currentId: pending?.id ?? null,
      ended: courseCase.questionsEnded,
    },
    types: courseCase.types,
    attention: courseCase.attention,
    recommendations: courseCase.recommendations,
    materialStatus: courseCase.materials.status,
    guidelines,
    latestUserMessage: request.userText,
    recentMessages: courseCase.messages
      .filter((message) => message.role !== 'error')
      .slice(-6)
      .map(({ role, text }) => ({ role, text })),
  };
}

/** Remove one optional markdown code fence layer before parsing the proposal JSON. */
function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  const withoutOpening = trimmed.replace(/^```[^\r\n]*\r?\n?/, '');
  const withoutClosing = withoutOpening.endsWith('```')
    ? withoutOpening.slice(0, -3)
    : withoutOpening;
  return withoutClosing.trim();
}

async function requestCompletion(
  config: ServerConfig,
  fetchImpl: typeof fetch,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ApiError(504, 'MODEL_TIMEOUT', TIMEOUT_MESSAGE, true));
    }, config.timeoutMs);
  });
  try {
    return await Promise.race([
      timeout,
      (async () => {
        const response = await fetchImpl(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            [config.authHeader]: `${config.authScheme ? `${config.authScheme} ` : ''}${config.apiKey}`,
          },
          body: JSON.stringify({ model: config.model, stream: false, messages }),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new ApiError(
            502,
            'MODEL_SERVICE_ERROR',
            'The model service rejected the request. Your text is kept.',
            response.status === 429 || response.status >= 500,
          );
        }
        // Limit bytes while reading, including providers that omit Content-Length.
        const reader = response.body?.getReader();
        if (!reader) throw invalidOutput();
        const decoder = new TextDecoder();
        let text = '';
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 1_000_000) {
              await reader.cancel();
              throw invalidOutput();
            }
            text += decoder.decode(value, { stream: true });
          }
          text += decoder.decode();
        } finally {
          reader.releaseLock();
        }
        let envelope: unknown;
        try {
          envelope = JSON.parse(text);
        } catch {
          throw invalidOutput();
        }
        const content = (
          envelope as { choices?: Array<{ message?: { content?: unknown } }> } | null
        )?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') throw invalidOutput();
        return content;
      })(),
    ]);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError(504, 'MODEL_TIMEOUT', TIMEOUT_MESSAGE, true);
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      502,
      'MODEL_CONNECTION_ERROR',
      'The model service could not be reached. Your text is kept.',
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}
