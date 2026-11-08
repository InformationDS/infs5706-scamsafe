import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createApp } from '../server/src/app.js';
import { readConfig, type ServerConfig } from '../server/src/config.js';
import { ModelSettingsStore } from '../server/src/model-settings.js';
import type { CourseTurnRunner } from '../server/src/course-turn.js';
import {
  createCourseCase,
  type CourseCase,
  type CourseQuestion,
  type CourseTurnRequest,
  type FactKey,
  type TurnProposal,
} from '../shared/course-case.js';

const liveConfig = (): ServerConfig =>
  readConfig({
    MODEL_MODE: 'live',
    MODEL_BASE_URL: 'https://course-model.invalid/v1',
    MODEL_NAME: 'fake-course-model',
    MODEL_API_KEY: 'test-only-placeholder-key',
    MODEL_TIMEOUT_MS: '5000',
  });

const mockConfig = (): ServerConfig => readConfig({});

type CapturedRequest = { url: string; init: RequestInit | undefined };

function fakeProvider(content: string, captured: CapturedRequest[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), init });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function withApp(
  config: ServerConfig,
  fetchImpl: typeof fetch | undefined,
  run: (base: string) => Promise<void>,
  courseTurn?: CourseTurnRunner,
): Promise<void> {
  const server = createServer(
    createApp({ settingsStore: new ModelSettingsStore({ config }), fetchImpl, courseTurn }),
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP address');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await close(server);
  }
}

const postTurn = (base: string, body: unknown) =>
  fetch(`${base}/api/course/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const recordFact = (courseCase: CourseCase, key: FactKey, value: string): void => {
  const fact = courseCase.facts.find((candidate) => candidate.key === key);
  assert.ok(fact, `missing fact ${key}`);
  fact.value = value;
  fact.status = 'known';
  fact.origin = 'narrative';
  fact.evidence = value;
};

const pendingQuestion = (
  id: 'Q1' | 'Q2' | 'Q3',
  text: string,
  purpose: string,
  relatedKeys: FactKey[],
): CourseQuestion => ({ id, text, purpose, relatedKeys, status: 'pending', answerText: null });

const draftMaterials = (): CourseCase['materials'] => ({
  status: 'draft',
  employeeEdited: false,
  summary: 'Employee summary text.',
  personExplanation: 'Person explanation text.',
  handover: null,
});

function paymentCase(withDraftMaterials = false): CourseCase {
  const courseCase = createCourseCase('bank');
  courseCase.phase = 'open';
  recordFact(courseCase, 'amount', '2,000');
  recordFact(courseCase, 'currency', 'AUD');
  courseCase.questions = [
    pendingQuestion('Q1', 'What amount was paid?', 'Clarify the payment amount', [
      'amount',
      'currency',
    ]),
    pendingQuestion('Q2', 'Was the supplier change checked?', 'Clarify the supplier check', [
      'actionsTaken',
    ]),
    pendingQuestion('Q3', 'What is the transaction status?', 'Clarify the transaction status', [
      'transactionStatus',
    ]),
  ];
  if (withDraftMaterials) courseCase.materials = draftMaterials();
  return courseCase;
}

const turnRequest = (
  courseCase: CourseCase,
  userText: string,
  overrides: Partial<
    Pick<CourseTurnRequest, 'purpose' | 'replaceExisting' | 'retryMessageId'>
  > = {},
): CourseTurnRequest => ({
  case: courseCase,
  userText,
  purpose: overrides.purpose ?? 'message',
  replaceExisting: overrides.replaceExisting ?? false,
  retryMessageId: overrides.retryMessageId ?? null,
});

const paymentProposal: TurnProposal = {
  understoodAs: 'multi-answer',
  reply: 'Recorded 500 AUD. The supplier check is unknown. The reported status is Pending.',
  factChanges: [
    { key: 'amount', value: '500', certainty: 'stated', evidence: '500' },
    { key: 'currency', value: 'AUD', certainty: 'stated', evidence: 'AUD' },
    { key: 'transactionStatus', value: 'Pending', certainty: 'stated', evidence: 'Pending' },
  ],
  questionUpdates: [
    { questionId: 'Q1', result: 'answered', evidence: '500 AUD paid' },
    { questionId: 'Q2', result: 'unknown', evidence: 'Not sure' },
    { questionId: 'Q3', result: 'answered', evidence: 'Pending' },
  ],
  proposedQuestions: [],
  types: null,
  attention: null,
  recommendations: null,
  materials: null,
};

const queryProposal: TurnProposal = {
  understoodAs: 'query',
  reply: 'The recorded amount is 2,000 AUD. The question did not change it.',
  factChanges: [],
  questionUpdates: [],
  proposedQuestions: [],
  types: null,
  attention: null,
  recommendations: null,
  materials: null,
};

const correctionProposal: TurnProposal = {
  understoodAs: 'correction',
  reply: 'The recorded amount is now 200 AUD.',
  factChanges: [
    { key: 'amount', value: '200', certainty: 'stated', evidence: '200' },
    { key: 'currency', value: 'AUD', certainty: 'stated', evidence: 'AUD' },
  ],
  questionUpdates: [],
  proposedQuestions: [],
  types: null,
  attention: null,
  recommendations: null,
  materials: null,
};

const factValue = (courseCase: CourseCase, key: FactKey): string | null => {
  const fact = courseCase.facts.find((candidate) => candidate.key === key);
  assert.ok(fact, `missing fact ${key}`);
  return fact.value;
};

test('live turn returns the payment proposal and sends only the allowed model input', async () => {
  const userText = '1: 500 AUD paid; 2: Not sure; 3: Pending.';
  const captured: CapturedRequest[] = [];
  const fenced = `\`\`\`json\n${JSON.stringify(paymentProposal)}\n\`\`\``;

  await withApp(liveConfig(), fakeProvider(fenced, captured), async (base) => {
    const courseCase = paymentCase();
    const before = structuredClone(courseCase);
    const response = await postTurn(base, turnRequest(courseCase, userText));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(factValue(body.case, 'amount'), '500');
    assert.equal(factValue(body.case, 'transactionStatus'), 'Pending');
    assert.equal(typeof body.requestId, 'string');
    assert.ok(body.requestId.length > 0);
    assert.equal(body.assistantText, body.case.messages.at(-1).text);
    assert.equal(body.case.messages.at(-1).role, 'assistant');
    assert.match(body.assistantText, /Recorded 500 AUD/);
    assert.match(body.assistantText, /Next:/);
    assert.equal(JSON.stringify(courseCase), JSON.stringify(before));

    assert.equal(captured.length, 1);
    assert.equal(captured[0].url, 'https://course-model.invalid/v1/chat/completions');
    const sent = JSON.parse(String(captured[0].init?.body)) as {
      model: string;
      stream: boolean;
      messages: Array<{ role: string; content: string }>;
    };
    assert.deepEqual(Object.keys(sent).sort(), ['messages', 'model', 'stream']);
    assert.equal(sent.model, 'fake-course-model');
    assert.equal(sent.stream, false);
    assert.equal(sent.messages.length, 2);
    assert.equal(sent.messages[0].role, 'system');
    assert.match(sent.messages[0].content, /Return exactly ONE JSON object/);

    const payload = JSON.parse(sent.messages[1].content) as Record<string, unknown>;
    assert.deepEqual(Object.keys(payload).sort(), [
      'role',
      'phase',
      'purpose',
      'facts',
      'questions',
      'questionProgress',
      'types',
      'attention',
      'recommendations',
      'materialStatus',
      'guidelines',
      'latestUserMessage',
      'recentMessages',
    ].sort());
    assert.equal(payload.purpose, 'message');
    assert.equal(payload.latestUserMessage, userText);
    assert.deepEqual(payload.role, courseCase.role);
    assert.deepEqual(payload.questionProgress, { total: 3, handled: 0, currentId: 'Q1', ended: false });
    assert.equal(payload.materialStatus, 'not-generated');
    assert.equal((payload.facts as unknown[]).length, 17);
    for (const fact of payload.facts as Array<Record<string, unknown>>) {
      assert.deepEqual(Object.keys(fact).sort(), [
        'key',
        'label',
        'value',
        'status',
        'uncertainty',
        'origin',
      ].sort());
    }
    for (const question of payload.questions as Array<Record<string, unknown>>) {
      assert.deepEqual(Object.keys(question).sort(), [
        'id',
        'text',
        'purpose',
        'relatedKeys',
        'status',
      ].sort());
    }
    const guidelines = JSON.parse(
      await readFile('data/course/guidelines.json', 'utf8'),
    ) as unknown[];
    assert.deepEqual(payload.guidelines, guidelines);
    assert.deepEqual(payload.recentMessages, []);
    assert.equal(JSON.stringify(payload).includes('test-only-placeholder-key'), false);
  });
});

test('a non-JSON model result returns 502 without a case', async () => {
  await withApp(liveConfig(), fakeProvider('not JSON at all'), async (base) => {
    const response = await postTurn(base, turnRequest(paymentCase(), '1: 500 AUD paid'));
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.error.code, 'MODEL_INVALID_OUTPUT');
    assert.equal(
      body.error.message,
      'The model returned an unusable result. Your text is kept. Retry does not change the saved facts.',
    );
    assert.equal(body.error.retryable, true);
    assert.equal('case' in body, false);
    assert.equal('assistantText' in body, false);
  });
});

test('mock mode returns 503 and makes no provider call', async () => {
  const captured: CapturedRequest[] = [];
  await withApp(mockConfig(), fakeProvider(JSON.stringify(paymentProposal), captured), async (base) => {
    const response = await postTurn(base, turnRequest(paymentCase(), '1: 500 AUD paid'));
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error.code, 'COURSE_LIVE_REQUIRED');
    assert.equal(
      body.error.message,
      'Live model is not configured. Set MODEL_MODE=live and the model URL, name and key, then restart the local service. Your text is kept.',
    );
    assert.equal('case' in body, false);
    assert.equal(captured.length, 0);
  });
});

test('a message query keeps the amount and the draft summary while calling the provider', async () => {
  const captured: CapturedRequest[] = [];
  await withApp(liveConfig(), fakeProvider(JSON.stringify(queryProposal), captured), async (base) => {
    const courseCase = paymentCase(true);
    const summaryBefore = courseCase.materials.summary;
    const response = await postTurn(base, turnRequest(courseCase, 'What is the current amount?'));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(factValue(body.case, 'amount'), '2,000');
    assert.equal(body.case.materials.status, 'draft');
    assert.equal(body.case.materials.summary, summaryBefore);
    assert.equal(body.case.materials.personExplanation, 'Person explanation text.');
    assert.equal(captured.length, 1);
  });
});

test('a message correction updates the amount and marks the draft materials for update', async () => {
  await withApp(liveConfig(), fakeProvider(JSON.stringify(correctionProposal)), async (base) => {
    const courseCase = paymentCase(true);
    const summaryBefore = courseCase.materials.summary;
    const response = await postTurn(base, turnRequest(courseCase, 'The amount is 200 AUD, not 2000.'));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(factValue(body.case, 'amount'), '200');
    assert.equal(factValue(body.case, 'currency'), 'AUD');
    assert.equal(body.case.materials.status, 'needs-update');
    assert.equal(body.case.materials.summary, summaryBefore);
    assert.match(body.assistantText, /The recorded amount is now 200 AUD/);
  });
});

test('regenerating over draft materials without replacement returns 409 and calls no provider', async () => {
  const captured: CapturedRequest[] = [];
  await withApp(liveConfig(), fakeProvider(JSON.stringify(paymentProposal), captured), async (base) => {
    const request = turnRequest(paymentCase(true), 'Generate the materials.', {
      purpose: 'generate',
      replaceExisting: false,
    });
    const callsBefore = captured.length;
    const response = await postTurn(base, request);
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.error.code, 'MATERIALS_REPLACE_REQUIRED');
    assert.equal('case' in body, false);
    assert.equal(captured.length, callsBefore);
    assert.equal(captured.length, 0);
  });
});

test('the optional courseTurn runner is used through createApp without a provider call', async () => {
  const captured: CapturedRequest[] = [];
  const injectedFetch = fakeProvider('{}', captured);
  let received: CourseTurnRequest | undefined;
  let contextConfig: ServerConfig | undefined;
  const runner: CourseTurnRunner = async (input, context) => {
    received = input;
    contextConfig = context.config;
    assert.equal(context.fetchImpl, injectedFetch);
    return { case: input.case, assistantText: 'Injected reply.' };
  };
  await withApp(
    mockConfig(),
    injectedFetch,
    async (base) => {
      const request = turnRequest(paymentCase(), 'Injected turn.');
      const response = await postTurn(base, request);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.assistantText, 'Injected reply.');
      assert.equal(body.case.role.id, 'bank');
      assert.equal(typeof body.requestId, 'string');
      assert.deepEqual(received, request);
      assert.equal(contextConfig?.mode, 'mock');
      assert.equal(captured.length, 0);
    },
    runner,
  );
});
