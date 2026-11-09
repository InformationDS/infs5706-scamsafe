/**
 * Batch 8 browser acceptance for the fictional course page (/?view=course).
 *
 * The courseTurn runner below is a FAKE MODEL and exists only in this test file.
 * It maps known texts to TurnProposal JSON and calls the shared applyCourseProposal
 * exactly like the live service does. It is injected through createApp({ courseTurn })
 * so the page, the HTTP route and the shared merge functions run for real, while no
 * external provider is contacted. This is NOT real-model acceptance.
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { chromium, type Browser } from 'playwright';
import { createApp } from '../server/src/app';
import { ApiError } from '../server/src/model';
import type { CourseTurnRunner } from '../server/src/course-turn';
import {
  ROLES,
  applyCourseProposal,
  type CourseCase,
  type CourseTurnRequest,
  type TurnProposal,
} from '../shared/course-case';

type CourseExample = { id: string; name: string; text: string };
type CourseGuideline = { id: string; title: string; appliesTo: string[] };
const examples = JSON.parse(await readFile('data/course/examples.json', 'utf8')) as CourseExample[];
const courseGuidelines = JSON.parse(
  await readFile('data/course/guidelines.json', 'utf8'),
) as CourseGuideline[];

function exampleText(id: string): string {
  const example = examples.find((candidate) => candidate.id === id);
  if (!example) throw new Error(`Missing course example: ${id}`);
  return example.text;
}

const PAYMENT_TEXT = exampleText('supplier-payment');
const SMS_TEXT = exampleText('sms-phishing');
const SUPPORT_TEXT = exampleText('support-needed');

const QUERY_TEXT = 'What is the current amount?';
const CORRECTION_TEXT = 'The amount is 200 AUD, not 2000.';
const UNCERTAINTY_TEXT = 'I am not sure about the amount.';
const MULTI_ANSWER_TEXT = '1: 500 AUD paid; 2: Not sure; 3: Pending.';
const GENERATE_USER_TEXT = 'Generate materials';

const INVALID_OUTPUT_MESSAGE =
  'The model returned an unusable result. Your text is kept. Retry does not change the saved facts.';

/** The only failure path of the fake model: any unmapped text returns the route's 502. */
const invalidOutput = (): ApiError => new ApiError(502, 'MODEL_INVALID_OUTPUT', INVALID_OUTPUT_MESSAGE);

/** Reasonable initial-report for the supplier payment example (bank role, email channel). */
const PAYMENT_INITIAL: TurnProposal = {
  understoodAs: 'initial-report',
  reply:
    'You described a payment request that may not be genuine. The amount and the payment status still need checking.',
  factChanges: [
    { key: 'contactChannel', value: 'Email', certainty: 'stated', evidence: 'emailed' },
    {
      key: 'claimedIdentity',
      value: 'A supplier',
      certainty: 'stated',
      evidence: 'claiming to be a supplier',
    },
    {
      key: 'reportedAction',
      value: 'New payment details requested',
      certainty: 'stated',
      evidence: 'new payment details',
    },
    {
      key: 'evidenceAvailable',
      value: 'The email',
      certainty: 'stated',
      evidence: 'I still have the email',
    },
  ],
  questionUpdates: [],
  proposedQuestions: [
    {
      id: 'Q1',
      text: 'What amount was paid, and in which currency?',
      purpose: 'Confirm the payment amount and currency',
      relatedKeys: ['amount', 'currency'],
    },
    {
      id: 'Q2',
      text: 'Did the supplier confirm the new payment details separately?',
      purpose: 'Check the supplier change through a separate contact',
      relatedKeys: ['observedIssue', 'actionsTaken'],
    },
    {
      id: 'Q3',
      text: 'What is the current transaction status?',
      purpose: 'Confirm whether the payment is pending or completed',
      relatedKeys: ['transactionStatus'],
    },
  ],
  types: [
    {
      label: 'Suspected payment redirection',
      reason: 'New payment details arrived by email from a claimed supplier.',
      evidence: 'new payment details',
    },
  ],
  attention: [],
  recommendations: [
    {
      id: 'R1',
      guidelineId: 'DEMO-G04',
      organisation: 'SYN Bank A',
      priority: 'now',
      audience: 'this-organisation',
      action: 'Check the payment and the changed supplier details before any action.',
      reason: 'A changed payment request can redirect money without the supplier knowing.',
    },
    {
      id: 'R2',
      guidelineId: 'DEMO-G04',
      organisation: 'SYN Bank A',
      priority: 'later',
      audience: 'human-judgement',
      action: 'Ask a human reviewer to verify the supplier contact.',
      reason: 'The genuine supplier contact is not confirmed in the report.',
    },
  ],
  materials: null,
};

/** Reasonable initial-report for the SMS phishing example (amount, currency, channel, phishing). */
const SMS_INITIAL: TurnProposal = {
  understoodAs: 'initial-report',
  reply:
    'You described a text message that asked for banking credentials and was followed by an unfamiliar debit.',
  factChanges: [
    { key: 'contactChannel', value: 'Text message', certainty: 'stated', evidence: 'text message' },
    {
      key: 'claimedIdentity',
      value: 'SYN Bank A',
      certainty: 'stated',
      evidence: 'claiming to be SYN Bank A',
    },
    { key: 'amount', value: '2000', certainty: 'stated', evidence: '2,000' },
    { key: 'currency', value: 'AUD', certainty: 'stated', evidence: 'AUD' },
    {
      key: 'sharedInformation',
      value: 'Banking password and a one-time code',
      certainty: 'stated',
      evidence: 'banking password and a one-time code',
    },
    {
      key: 'transactionStatus',
      value: null,
      certainty: 'unknown',
      evidence: 'do not know whether it is pending or completed',
    },
    {
      key: 'evidenceAvailable',
      value: 'The text message on the phone',
      certainty: 'stated',
      evidence: 'message on my phone',
    },
  ],
  questionUpdates: [],
  proposedQuestions: [],
  types: [
    {
      label: 'Suspected phishing',
      reason: 'The message led to a link that asked for banking credentials.',
      evidence: 'opened the link',
    },
  ],
  attention: [],
  recommendations: [
    {
      id: 'R1',
      guidelineId: 'DEMO-G01',
      organisation: 'SYN Bank A',
      priority: 'now',
      audience: 'this-organisation',
      action: 'Review the reported debit and the shared credentials with a human reviewer.',
      reason: 'The report includes a payment concern and credentials shared through a link.',
    },
  ],
  materials: null,
};

/** Limited-information support example: vulnerability cue only, Insufficient information type. */
const SUPPORT_INITIAL: TurnProposal = {
  understoodAs: 'initial-report',
  reply:
    'You described repeated calls that asked you to act quickly, and you feel overwhelmed. The call details are still limited.',
  factChanges: [
    {
      key: 'contactChannel',
      value: 'Phone calls',
      certainty: 'stated',
      evidence: 'repeated calls',
    },
    {
      key: 'vulnerabilityCue',
      value: 'feeling overwhelmed',
      certainty: 'stated',
      evidence: 'I feel overwhelmed',
    },
    {
      key: 'urgencyCue',
      value: 'Someone asking me to act quickly',
      certainty: 'stated',
      evidence: 'asking me to act quickly',
    },
    {
      key: 'reportedAction',
      value: 'Repeated calls asking for immediate action',
      certainty: 'stated',
      evidence: 'repeated calls',
    },
  ],
  questionUpdates: [],
  proposedQuestions: [],
  types: [
    {
      label: 'Insufficient information',
      reason: 'The report does not say what the callers asked for or what was shared.',
      evidence: 'I have not shared details of the calls yet',
    },
  ],
  attention: [
    {
      kind: 'vulnerability',
      text: 'The person reported feeling overwhelmed.',
      evidence: 'I feel overwhelmed',
    },
  ],
  recommendations: [
    {
      id: 'R1',
      guidelineId: 'DEMO-G03',
      organisation: 'SYN Bank A',
      priority: 'now',
      audience: 'this-organisation',
      action: 'Offer human support and record the pressure the person reported.',
      reason: 'The report shows pressure and limited information.',
    },
  ],
  materials: null,
};

const QUERY_PROPOSAL: TurnProposal = {
  understoodAs: 'query',
  reply: 'Nothing in the saved facts changed. The current question and the next step are shown below.',
  factChanges: [],
  questionUpdates: [],
  proposedQuestions: [],
  types: null,
  attention: null,
  recommendations: null,
  materials: null,
};

const CORRECTION_PROPOSAL: TurnProposal = {
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

const UNCERTAINTY_PROPOSAL: TurnProposal = {
  understoodAs: 'uncertainty',
  reply: 'The recorded amount is kept and marked uncertain.',
  factChanges: [
    {
      key: 'amount',
      value: null,
      certainty: 'uncertain',
      evidence: 'not sure about the amount',
    },
  ],
  questionUpdates: [],
  proposedQuestions: [],
  types: null,
  attention: null,
  recommendations: null,
  materials: null,
};

/** Qualitative material sentences only; contains no digits. Payment handover fields stay null. */
const GENERATE_PROPOSAL: TurnProposal = {
  understoodAs: 'other',
  reply: 'Draft materials are ready for review.',
  factChanges: [],
  questionUpdates: [],
  proposedQuestions: [],
  types: null,
  attention: null,
  recommendations: null,
  materials: {
    summaryNarrative:
      'The person described a suspicious contact, and the remaining facts are still being checked.',
    personWhatHappened:
      'You told us about a suspicious contact, and we recorded what you shared.',
    personNextSteps: [
      'Staff should review this later.',
      'Talk with someone you trust before acting on the request.',
      'Contact your bank using a phone number you find yourself.',
    ],
    personSupport: 'A support person can help you plan the next step.',
    handoverReason: null,
    handoverRequest: null,
    handoverGuidelineId: null,
  },
};

/** Multi-answer proposal whose question ids always come from the current case. */
function multiAnswerProposal(courseCase: CourseCase): TurnProposal {
  const results: Array<'answered' | 'unknown'> = ['answered', 'unknown', 'answered'];
  const evidence = ['500 AUD paid', 'Not sure', 'Pending'];
  const questionUpdates: TurnProposal['questionUpdates'] = courseCase.questions
    .slice(0, 3)
    .map((question, index) => ({
      questionId: question.id,
      result: results[index] ?? 'unknown',
      evidence: evidence[index] ?? 'Not sure',
    }));
  return {
    understoodAs: 'multi-answer',
    reply: 'Recorded 500 AUD. The supplier check is unknown. The reported status is Pending.',
    factChanges: [
      { key: 'amount', value: '500', certainty: 'stated', evidence: '500' },
      { key: 'currency', value: 'AUD', certainty: 'stated', evidence: 'AUD' },
      { key: 'transactionStatus', value: 'Pending', certainty: 'stated', evidence: 'Pending' },
    ],
    questionUpdates,
    proposedQuestions: [],
    types: null,
    attention: null,
    recommendations: null,
    materials: null,
  };
}

function proposalFor(request: CourseTurnRequest): TurnProposal {
  if (request.purpose === 'generate') {
    if (request.userText !== GENERATE_USER_TEXT) throw invalidOutput();
    return GENERATE_PROPOSAL;
  }
  switch (request.userText) {
    case PAYMENT_TEXT:
      return PAYMENT_INITIAL;
    case SMS_TEXT:
      return SMS_INITIAL;
    case SUPPORT_TEXT:
      return SUPPORT_INITIAL;
    case QUERY_TEXT:
      return QUERY_PROPOSAL;
    case CORRECTION_TEXT:
      return CORRECTION_PROPOSAL;
    case UNCERTAINTY_TEXT:
      return UNCERTAINTY_PROPOSAL;
    case MULTI_ANSWER_TEXT:
      return multiAnswerProposal(request.case);
    default:
      throw invalidOutput();
  }
}

/** Fake runner: always merges through the real shared function and returns its assistant message. */
const fakeCourseRunner: CourseTurnRunner = async (request) => {
  const nextCase = applyCourseProposal(request.case, {
    userText: request.userText,
    purpose: request.purpose,
    replaceExisting: request.replaceExisting,
    retryMessageId: request.retryMessageId,
    proposal: proposalFor(request),
  });
  const assistant = [...nextCase.messages]
    .reverse()
    .find((message) => message.role === 'assistant');
  if (!assistant) throw invalidOutput();
  return { case: nextCase, assistantText: assistant.text };
};

const server = createApp({ courseTurn: fakeCourseRunner }).listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') {
  throw new Error('The fake-model course check could not obtain a local TCP port.');
}
const origin = `http://127.0.0.1:${address.port}`;
console.log(
  `mode=fake-model: course page at ${origin}/?view=course uses the injected courseTurn runner; no provider is contacted.`,
);

const FACT_LABELS = [
  'Contact channel',
  'Contact time',
  'Claimed identity',
  'Reported action',
  'Reported amount',
  'Currency',
  'Transaction status',
  'Organisation involved',
  'Information shared',
  'Affected service',
  'Observed issue',
  'Still in contact',
  'Actions already taken',
  'Organisations already contacted',
  'Evidence the person can provide',
  'Urgency cue',
  'Vulnerability or support need',
] as const;

const checks: Array<{ id: string; name: string }> = [];
const pageErrors: string[] = [];
const dialogs: string[] = [];
const turnBodies: Array<{
  userText?: unknown;
  purpose?: unknown;
  retryMessageId?: unknown;
  case?: CourseCase;
}> = [];
let turnRequests = 0;
let dialogAnswer: 'accept' | 'dismiss' = 'accept';
let clipboardResult = 'not-executed';
let browser: Browser | undefined;

try {
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    console.error(
      'mode=fake-model [FAILED] Chromium could not start. This check never installs a browser; install it separately with `npm run browser:install` and run the command again.',
    );
    throw error;
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    return dialogAnswer === 'dismiss' ? dialog.dismiss() : dialog.accept();
  });
  page.on('request', (request) => {
    if (request.method() !== 'POST' || !request.url().endsWith('/api/course/turn')) return;
    turnRequests += 1;
    try {
      turnBodies.push(
        request.postDataJSON() as {
          userText?: unknown;
          purpose?: unknown;
          retryMessageId?: unknown;
          case?: CourseCase;
        },
      );
    } catch {
      // A malformed body is not expected from the page; the UI assertions cover the outcome.
    }
  });

  const panel = page.getByRole('region', { name: 'Case information and results' });
  const conversation = page.getByRole('complementary', { name: 'Case conversation' });
  const draft = page.getByLabel('Case description or additional information');
  const exampleSelect = page.getByLabel('Explore a fictional case');
  const materialEditor = page.getByLabel('Current material text');
  const primary = page.getByRole('button', {
    name: /^(Analyze case|Send message|Retry|Processing…)$/,
  });
  const resultTab = (name: 'Case overview' | 'Guidance' | 'Materials') =>
    panel.getByRole('button', { name, exact: true });
  const leftScroll = panel.locator('.course-scroll');
  const roundQuestions = leftScroll.getByRole('group', { name: 'Round questions' });
  const currentQuestionBar = conversation.getByRole('group', { name: 'Current question' });
  const roleSummary = page.getByRole('region', { name: 'Current employee role' });
  const remainingGaps = leftScroll.getByRole('region', { name: 'Remaining gaps' });
  const turnSummary = conversation.getByRole('region', { name: 'This turn' });
  const materialTab = (name: 'Case summary' | 'For the person' | 'Handover draft') =>
    page
      .getByRole('group', { name: 'Material views' })
      .getByRole('button', { name, exact: true });
  const button = (name: string) => page.getByRole('button', { name, exact: true });

  function pass(id: string, name: string): void {
    checks.push({ id, name });
    console.log(`[fake-model] check ${id} passed: ${name}`);
  }

  async function waitUntil(
    check: () => Promise<boolean>,
    description: string,
    timeoutMs = 15_000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await check()) return;
      await page.waitForTimeout(100);
    }
    throw new Error(`Timed out waiting for ${description}.`);
  }

  async function waitIdle(): Promise<void> {
    await waitUntil(async () => primary.isEnabled(), 'the course turn to finish');
  }

  async function submitTurn(expectedStatus = 200): Promise<number> {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/course/turn') &&
        response.request().method() === 'POST',
    );
    await primary.click();
    const response = await responsePromise;
    await waitIdle();
    assert.equal(response.status(), expectedStatus, 'POST /api/course/turn status');
    return response.status();
  }

  async function sendText(text: string): Promise<void> {
    await draft.fill(text);
    await submitTurn(200);
  }

  async function loadExample(id: string): Promise<void> {
    await exampleSelect.selectOption(id);
    await button('Load example').click();
    await waitUntil(
      async () => (await draft.inputValue()) === exampleText(id),
      `the ${id} example text in the composer`,
    );
  }

  async function runGenerate(label: 'Generate materials' | 'Regenerate materials'): Promise<void> {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/course/turn') &&
        response.request().method() === 'POST',
    );
    await button(label).click();
    const response = await responsePromise;
    await waitIdle();
    assert.equal(response.status(), 200, `${label} status`);
    await waitUntil(async () => (await materialEditor.count()) === 1, 'the materials editor');
  }

  async function startNewCase(): Promise<void> {
    dialogAnswer = 'accept';
    await button('New case').click();
    await waitUntil(
      async () =>
        (await page.getByRole('heading', { name: 'Who is receiving this report?' }).count()) > 0,
      'a cleared course case',
    );
    assert.equal(await turnSummary.count(), 0, 'New case clears the This turn summary');
  }

  async function factValue(label: string): Promise<string | null> {
    const input = page.getByLabel(label, { exact: true });
    if ((await input.count()) === 0) return null;
    return input.inputValue();
  }

  async function visibleFacts(): Promise<Record<string, string>> {
    const values: Record<string, string> = {};
    for (const label of FACT_LABELS) {
      const value = await factValue(label);
      if (value !== null) values[label] = value;
    }
    return values;
  }

  async function progressLabel(): Promise<string> {
    const pending = panel.getByText(/^Question \d+ of \d+$/);
    if ((await pending.count()) > 0) return (await pending.first().innerText()).trim();
    const handled = panel.getByText(/^\d+ of \d+ handled$/);
    assert.ok((await handled.count()) > 0, 'a question progress label should be visible');
    return (await handled.first().innerText()).trim();
  }

  /** The pending card must expose every question in the round, not only the active one. */
  async function assertQuestionListVisible(): Promise<void> {
    const expected = [
      {
        id: 'Q1',
        text: 'What amount was paid, and in which currency?',
        purpose: 'Confirm the payment amount and currency',
      },
      {
        id: 'Q2',
        text: 'Did the supplier confirm the new payment details separately?',
        purpose: 'Check the supplier change through a separate contact',
      },
      {
        id: 'Q3',
        text: 'What is the current transaction status?',
        purpose: 'Confirm whether the payment is pending or completed',
      },
    ];
    assert.equal(await leftScroll.getByRole('group', { name: 'Round questions' }).count(), 1);
    assert.equal(await panel.locator('.course-scroll').count(), 1, 'the results column has one scroll container');
    const nestedScrollers = await leftScroll.evaluate((root) =>
      Array.from(root.querySelectorAll<HTMLElement>('*')).filter((element) => {
        const overflowY = window.getComputedStyle(element).overflowY;
        return (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          element.scrollHeight > element.clientHeight + 1
        );
      }).length,
    );
    assert.equal(nestedScrollers, 0, 'the results column must not have a nested scroll container');
    assert.equal(await leftScroll.getByLabel('Contact channel', { exact: true }).count(), 1);
    assert.equal(await roundQuestions.locator('.course-question-item').count(), 3);
    for (const item of expected) {
      await roundQuestions.getByText(item.id, { exact: true }).waitFor();
      await roundQuestions.getByText(item.text, { exact: true }).waitFor();
      await roundQuestions.getByText(item.purpose, { exact: true }).waitFor();
    }
    await roundQuestions
      .getByText('Numbered answers follow this list: 1 → Q1, 2 → Q2, 3 → Q3.', { exact: true })
      .waitFor();
    const activeItem = roundQuestions.locator('.course-question-item-active');
    assert.equal(await activeItem.count(), 1, 'exactly the active question is highlighted');
    await activeItem.getByText('Q1', { exact: true }).waitFor();
    await activeItem.getByText('Pending', { exact: true }).waitFor();

    assert.equal(
      await conversation.locator('.course-question-item').count(),
      0,
      'the conversation must not hold the full question list',
    );
    const currentBarBox = await currentQuestionBar.boundingBox();
    assert.ok(currentBarBox && currentBarBox.height <= 120, 'the current-question bar stays compact');
    await currentQuestionBar.getByText('Question 1 of 3', { exact: true }).waitFor();
    await currentQuestionBar
      .getByText('What amount was paid, and in which currency?', { exact: true })
      .waitFor();
    for (const name of ["Don't know", 'Skip question', 'End questions']) {
      assert.equal(await currentQuestionBar.getByRole('button', { name, exact: true }).count(), 1);
    }

    await roleSummary.getByText(ROLES.bank.title, { exact: true }).waitFor();
    await roleSummary.getByText(ROLES.bank.responsibilities, { exact: true }).waitFor();
  }

  async function bubbleTexts(label: 'Case assistant' | 'Request failed'): Promise<string[]> {
    const labels = conversation.getByText(label, { exact: true });
    const total = await labels.count();
    const texts: string[] = [];
    for (let index = 0; index < total; index += 1) {
      texts.push(
        (await labels.nth(index).locator('..').innerText()).replace(/\s+/g, ' ').trim(),
      );
    }
    return texts;
  }

  async function lastBubbleText(label: 'Case assistant' | 'Request failed'): Promise<string> {
    const texts = await bubbleTexts(label);
    assert.ok(texts.length > 0, `expected at least one ${label} message`);
    return texts[texts.length - 1];
  }

  async function materialText(): Promise<string> {
    await waitUntil(async () => (await materialEditor.count()) === 1, 'the materials editor');
    return materialEditor.inputValue();
  }

  async function waitForPanelText(text: RegExp | string): Promise<void> {
    await waitUntil(
      async () => (await panel.getByText(text).count()) > 0,
      `visible text ${String(text)} in the results panel`,
    );
  }

  await page.goto(`${origin}/?view=course`);
  const banner = page.locator('.course-top');
  await banner.waitFor();
  assert.equal(await page.getByText('A clearer next step for every case.').count(), 0);
  assert.equal(await page.getByText('Fictional course case').count(), 0);
  await roleSummary.getByText(ROLES.bank.title, { exact: true }).waitFor();
  await roleSummary.getByText(ROLES.bank.responsibilities, { exact: true }).waitFor();

  const bannerBox = await banner.boundingBox();
  const initialLeftPanelBox = await panel.boundingBox();
  const initialConversationBox = await conversation.boundingBox();
  assert.ok(bannerBox && initialLeftPanelBox && initialConversationBox);
  const initialLayout = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    bodyScrollHeight: document.body.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  assert.ok(
    initialLayout.scrollHeight <= initialLayout.innerHeight + 1 &&
      initialLayout.bodyScrollHeight <= initialLayout.innerHeight + 1,
    'the desktop course page must not scroll vertically',
  );
  assert.ok(
    Math.abs(initialLeftPanelBox.height - initialConversationBox.height) <= 1,
    'the results and conversation panels must have the same height',
  );
  const availableHeight = initialLayout.innerHeight - bannerBox.height;
  assert.ok(
    initialLeftPanelBox.height >= availableHeight * 0.9,
    'the panels must use most of the space below the banner',
  );
  assert.ok(
    initialLeftPanelBox.y + initialLeftPanelBox.height >= initialLayout.innerHeight - 32,
    'the panels must reach close to the viewport bottom',
  );

  // ---------------------------------------------------------------- Flow A: payment example
  // Checks 1-4, 10-13, 16 and 17 (download content) on the supplier payment narrative.
  await loadExample('supplier-payment');
  await submitTurn(200);
  assert.equal(await factValue('Contact channel'), 'Email');
  assert.equal(await factValue('Claimed identity'), 'A supplier');
  assert.equal(await factValue('Reported action'), 'New payment details requested');
  assert.equal(await factValue('Evidence the person can provide'), 'The email');
  await leftScroll.getByRole('heading', { name: 'Event', exact: true }).waitFor();
  await leftScroll.getByRole('heading', { name: 'Support', exact: true }).waitFor();
  assert.equal(await leftScroll.getByLabel('Reported amount', { exact: true }).count(), 0);
  await remainingGaps.waitFor();
  assert.match(await remainingGaps.innerText(), /Question 1 is still pending/);
  await waitForPanelText('Suspected payment redirection');
  const initialReply = await lastBubbleText('Case assistant');
  assert.match(initialReply, /Next:/);
  await assertQuestionListVisible();
  await turnSummary.waitFor();
  const initialTurn = await turnSummary.innerText();
  assert.match(initialTurn, /Recorded updates/);
  assert.match(initialTurn, /Contact channel: Email/);
  assert.match(initialTurn, /Still unclear/);
  assert.match(initialTurn, /Question 1 is still pending/);
  pass('1', 'payment example analysis shows facts on the left and the reply contains Next:');

  assert.match(initialReply, /I have 3 questions/);
  assert.match(initialReply, /questions/);
  assert.equal(await progressLabel(), 'Question 1 of 3');
  pass('2', 'the first reply to the proposal with questions contains I have and questions');

  const factsBeforeQuery = await visibleFacts();
  await sendText(QUERY_TEXT);
  assert.deepEqual(await visibleFacts(), factsBeforeQuery);
  assert.equal(await progressLabel(), 'Question 1 of 3');
  const queryReply = await lastBubbleText('Case assistant');
  assert.match(queryReply, /Question 1 of 3/);
  assert.match(queryReply, /Next:/);
  await turnSummary.getByText('No case facts changed', { exact: true }).waitFor();
  assert.match(await turnSummary.innerText(), /Question 1 is still pending/);
  pass('3', 'What is the current amount? keeps facts and progress and replies with the current question or next step');

  await sendText(CORRECTION_TEXT);
  assert.equal(await factValue('Reported amount'), '200');
  assert.equal(await factValue('Currency'), 'AUD');
  await leftScroll.getByRole('heading', { name: 'Money', exact: true }).waitFor();
  await runGenerate('Generate materials');
  const summaryAfterCorrection = await materialText();
  assert.match(summaryAfterCorrection, /FICTIONAL COURSE CASE/);
  assert.match(summaryAfterCorrection, /Reported amount: 200/);
  pass('4', 'the correction shows 200 on the left and the generated summary reports amount 200');

  const materialTabs = page.getByRole('group', { name: 'Material views' }).getByRole('button');
  assert.equal(await materialTab('Handover draft').count(), 0);
  assert.doesNotMatch(summaryAfterCorrection, /SYN Telecom B intake team/);
  pass('13', 'the supplier payment bank case has no handover draft and no telecom recipient');

  // Check 10: an employee sentence survives a fact edit, and download is disabled.
  const summaryWithNote = `${summaryAfterCorrection}\n\nEmployee note. This draft is used for training only.`;
  await materialEditor.fill(summaryWithNote);
  await resultTab('Case overview').click();
  await page.getByLabel('Reported amount', { exact: true }).fill('250');
  await page.getByRole('heading', { name: 'Reported facts' }).click();
  await resultTab('Materials').click();
  const summaryAfterFactEdit = await materialText();
  assert.ok(summaryAfterFactEdit.includes('Employee note.'));
  await waitForPanelText('Materials need updating');
  assert.equal(await button('Download Markdown').isDisabled(), true);
  assert.equal(await button('Copy').isDisabled(), true);
  pass('10', 'editing a fact after drafting keeps the employee sentence and disables download');

  // Check 11: cancelling a regeneration keeps the manual text; accepting replaces it.
  const dialogsBeforeRegenerate = dialogs.length;
  const requestsBeforeRegenerate = turnRequests;
  dialogAnswer = 'dismiss';
  await button('Regenerate materials').click();
  await waitUntil(
    async () => dialogs.length > dialogsBeforeRegenerate,
    'the regeneration confirmation dialog',
  );
  assert.match(
    dialogs[dialogsBeforeRegenerate],
    /Regenerate materials\? This replaces the existing drafts\./,
  );
  assert.equal(turnRequests, requestsBeforeRegenerate);
  const cancelledSummary = await materialText();
  assert.equal(cancelledSummary, summaryAfterFactEdit);
  assert.ok(cancelledSummary.includes('Employee note.'));
  dialogAnswer = 'accept';
  await runGenerate('Regenerate materials');
  const regeneratedSummary = await materialText();
  assert.ok(!regeneratedSummary.includes('Employee note.'));
  assert.match(regeneratedSummary, /Reported amount: 250/);
  pass('11', 'cancelling regeneration keeps the manual sentence and accepting replaces the draft');

  // Check 12: confirming then editing clears Materials confirmed and disables download.
  await button('Confirm materials').click();
  await waitForPanelText('Materials confirmed.');
  assert.equal(await button('Download Markdown').isEnabled(), true);
  const confirmedSummary = await materialText();
  await materialEditor.fill(`${confirmedSummary}\n\nEmployee addendum.`);
  await waitUntil(
    async () => (await panel.getByText('Materials confirmed.', { exact: true }).count()) === 0,
    'the Materials confirmed banner to clear',
  );
  assert.equal(await button('Download Markdown').isDisabled(), true);
  assert.equal(await button('Copy').isDisabled(), true);
  pass('12', 'editing after confirmation clears Materials confirmed and disables download');

  // Check 16: confirmed download equals the textarea; clipboard failure is only reported.
  await button('Confirm materials').click();
  await waitForPanelText('Materials confirmed.');
  const finalSummaryText = await materialText();
  clipboardResult = await attemptClipboardCopy(page, button, materialEditor, finalSummaryText);
  const downloadPromise = page.waitForEvent('download');
  await button('Download Markdown').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'scamsafe-summary.md');
  const downloadPath = await download.path();
  assert.ok(downloadPath, 'the downloaded file should have a local path');
  assert.equal(await readFile(downloadPath, 'utf8'), finalSummaryText);
  pass(
    '16',
    `confirmed download equals the textarea (clipboard: ${clipboardResult})`,
  );
  assert.equal(await materialTabs.count(), 2);

  // ---------------------------------------------------------------- Flow B: multi-answer
  // Checks 5 and 6.
  await startNewCase();
  await loadExample('supplier-payment');
  await submitTurn(200);
  assert.equal(await factValue('Reported amount'), null);
  await assertQuestionListVisible();
  await sendText(MULTI_ANSWER_TEXT);
  assert.equal(await factValue('Reported amount'), '500');
  assert.equal(await factValue('Currency'), 'AUD');
  assert.equal(await factValue('Transaction status'), 'Pending');
  assert.equal(await progressLabel(), '3 of 3 handled');
  await runGenerate('Generate materials');
  const multiSummary = await materialText();
  assert.match(multiSummary, /Reported amount: 500/);
  assert.match(multiSummary, /Question 1: 500 AUD paid/);
  assert.match(multiSummary, /Question 2 was answered as unknown/);
  pass('5', 'one numbered multi-answer records 500 AUD and Pending, marks Q2 unknown and shows 3 of 3');

  await sendText(UNCERTAINTY_TEXT);
  await resultTab('Case overview').click();
  assert.equal(await factValue('Reported amount'), '500');
  await waitForPanelText(/Uncertain report: not sure about the amount/);
  pass('6', 'the uncertainty sentence keeps the recorded amount and adds an uncertain note');

  // ---------------------------------------------------------------- Flow C: pending question
  // Checks 7, 8 and 9.
  await startNewCase();
  await loadExample('supplier-payment');
  await submitTurn(200);
  assert.equal(await progressLabel(), 'Question 1 of 3');
  await runGenerate('Generate materials');
  const pendingSummary = await materialText();
  assert.match(pendingSummary, /Question 1 is still pending/);
  await sendText(QUERY_TEXT);
  const pendingQueryReply = await lastBubbleText('Case assistant');
  assert.match(pendingQueryReply, /Question 1 of 3/);
  assert.match(pendingQueryReply, /materials/i);
  assert.equal(await factValue('Reported amount'), null);
  pass('7', 'asking about the amount with a pending question keeps the question and mentions materials');

  await resultTab('Case overview').click();
  const conversationBeforeTabs = await conversation.innerText();
  const progressBeforeTabs = await progressLabel();
  assert.equal(await roundQuestions.count(), 1, 'the round questions must be in the left scroll container');
  assert.equal(
    await conversation.locator('.course-question-item').count(),
    0,
    'the conversation panel must not contain the full round question list',
  );
  for (const tabName of ['Guidance', 'Materials', 'Case overview'] as const) {
    await resultTab(tabName).click();
    assert.equal(await conversation.innerText(), conversationBeforeTabs, `conversation on ${tabName}`);
    assert.equal(await roundQuestions.count(), 1, `round questions remain in the left scroll on ${tabName}`);
    assert.equal(await currentQuestionBar.count(), 1, `current question bar remains on ${tabName}`);
    if (tabName === 'Guidance') {
      await leftScroll.getByText('Audience: This organisation', { exact: true }).waitFor();
      await leftScroll.getByText('Audience: Human judgement', { exact: true }).waitFor();
      const guideline = courseGuidelines.find((candidate) => candidate.id === 'DEMO-G04');
      assert.ok(guideline, 'DEMO-G04 must exist in data/course/guidelines.json');
      const appliesTo = guideline.appliesTo
        .map((role) => (role === 'bank' ? 'Bank' : role === 'telecom' ? 'Telecom' : role))
        .join('/');
      await leftScroll
        .getByText(`Guideline: ${guideline.id} — ${guideline.title}; Applies to: ${appliesTo}`, {
          exact: true,
        })
        .first()
        .waitFor();
    }
  }
  assert.equal(await progressLabel(), progressBeforeTabs);
  pass('9', 'switching Case overview, Guidance and Materials keeps conversation text and progress');

  await currentQuestionBar.getByRole('button', { name: "Don't know", exact: true }).click();
  await waitUntil(
    async () =>
      (await conversation
        .getByText('Question 1 marked unknown. No fact was inferred.')
        .count()) > 0,
    'the unknown-question reply',
  );
  assert.equal(await progressLabel(), 'Question 2 of 3');
  await roundQuestions.getByText('Question 2 of 3', { exact: true }).waitFor();
  await roundQuestions
    .getByText('Did the supplier confirm the new payment details separately?', { exact: true })
    .waitFor();
  assert.equal(
    await roundQuestions.locator('.course-question-item-active .course-question-id').innerText(),
    'Q2',
  );
  await roundQuestions.locator('.course-question-item').first().getByText('Unknown', { exact: true }).waitFor();
  assert.equal(await factValue('Reported amount'), null);
  assert.equal(await factValue('Currency'), null);
  assert.equal(await factValue('Transaction status'), null);

  await currentQuestionBar.getByRole('button', { name: 'Skip question', exact: true }).click();
  await waitUntil(
    async () =>
      (await conversation
        .getByText('Question 2 marked skipped. No fact was inferred.')
        .count()) > 0,
    'the skipped-question reply',
  );
  assert.equal(await progressLabel(), 'Question 3 of 3');
  await roundQuestions.getByText('Question 3 of 3', { exact: true }).waitFor();
  assert.equal(
    await roundQuestions.locator('.course-question-item-active .course-question-id').innerText(),
    'Q3',
  );
  await roundQuestions.locator('.course-question-item').nth(1).getByText('Skipped', { exact: true }).waitFor();

  await currentQuestionBar.getByRole('button', { name: 'End questions', exact: true }).click();
  await waitUntil(
    async () =>
      (await conversation
        .getByText('Clarification ended. Unanswered items remain unknown.')
        .count()) > 0,
    'the end-questions reply',
  );
  assert.equal(await progressLabel(), '3 of 3 handled');
  assert.equal(await roundQuestions.count(), 0, 'the round question list hides after End questions');
  assert.equal(await currentQuestionBar.count(), 0, 'the current question bar hides after End questions');
  assert.ok((await panel.innerText()).includes('Clarification ended.'));
  assert.equal(await factValue('Reported amount'), null);
  assert.equal(await factValue('Currency'), null);
  assert.equal(await factValue('Transaction status'), null);
  pass('8', "Don't know, Skip question and End questions keep the remaining items visible without guessing facts");

  // ---------------------------------------------------------------- Flow D: support example
  // Check 14.
  await startNewCase();
  await loadExample('support-needed');
  await submitTurn(200);
  assert.equal(await factValue('Vulnerability or support need'), 'feeling overwhelmed');
  await waitForPanelText('Insufficient information');
  await remainingGaps.waitFor();
  await leftScroll.getByText('No remaining gaps.', { exact: true }).waitFor();
  await runGenerate('Generate materials');
  const supportSummary = await materialText();
  assert.match(supportSummary, /overwhelmed/i);
  await materialTab('For the person').click();
  await waitUntil(
    async () => (await materialEditor.inputValue()).includes('EXPLANATION FOR THE AFFECTED PERSON'),
    'the person explanation',
  );
  const personExplanation = await materialText();
  assert.match(personExplanation, /You told us: feeling overwhelmed\./);
  assert.doesNotMatch(personExplanation, /staff should/i);
  assert.doesNotMatch(personExplanation, /Unknown Unknown/);
  assert.equal(await materialTab('Handover draft').count(), 0);
  pass('14', 'the support summary keeps overwhelmed and the person explanation has no staff should or Unknown Unknown');

  // ---------------------------------------------------------------- Flow E: failure and retry
  // Check 15.
  const unmappedNarrative = 'This narrative is not mapped by the fake runner.';
  await draft.fill(unmappedNarrative);
  const requestsBeforeFailure = turnRequests;
  const failureResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/course/turn') && response.request().method() === 'POST',
  );
  await primary.click();
  const failedTurn = await failureResponse;
  await waitIdle();
  assert.equal(failedTurn.status(), 502);
  assert.ok(turnRequests > requestsBeforeFailure);
  assert.equal(await draft.inputValue(), unmappedNarrative);
  assert.equal(await turnSummary.count(), 0, 'a failed turn clears the This turn summary');
  await waitUntil(
    async () => (await conversation.getByText('Request failed', { exact: true }).count()) > 0,
    'the failed turn message',
  );
  const failedReply = await lastBubbleText('Request failed');
  assert.match(failedReply, /The model returned an unusable result\. Your text is kept\./);
  await conversation.getByText('Employee · not sent', { exact: true }).first().waitFor();

  const bodiesBeforeRetry = turnBodies.length;
  const retryResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/course/turn') && response.request().method() === 'POST',
  );
  await primary.click();
  const retriedTurn = await retryResponsePromise;
  await waitIdle();
  assert.equal(retriedTurn.status(), 502);
  assert.equal(await draft.inputValue(), unmappedNarrative);
  assert.equal(turnBodies.length, bodiesBeforeRetry + 1);
  const retriedBody = turnBodies[turnBodies.length - 1];
  assert.ok(retriedBody);
  assert.equal(retriedBody.userText, unmappedNarrative);
  assert.equal(retriedBody.purpose, 'message');
  assert.notEqual(retriedBody.retryMessageId, null);
  assert.ok(
    retriedBody.case?.messages.some(
      (message) =>
        message.role === 'user' &&
        message.text === unmappedNarrative &&
        message.status === 'failed',
    ),
  );
  pass('15', 'a runner failure keeps the textarea text and Retry resends the same narrative');

  // ---------------------------------------------------------------- Extra runner mapping smoke
  // All three examples in data/course/examples.json must round-trip through the fake runner.
  await startNewCase();
  await loadExample('sms-phishing');
  await submitTurn(200);
  assert.equal(await factValue('Reported amount'), '2000');
  assert.equal(await factValue('Currency'), 'AUD');
  assert.equal(await factValue('Contact channel'), 'Text message');
  await leftScroll.getByRole('heading', { name: 'Money', exact: true }).waitFor();
  const transactionStatusInput = leftScroll.getByLabel('Transaction status', { exact: true });
  await transactionStatusInput.waitFor();
  assert.equal(await transactionStatusInput.inputValue(), '');
  const unknownBadge = leftScroll.locator('.course-fact-status').filter({ hasText: 'Unknown' });
  assert.equal(await unknownBadge.count(), 1);
  assert.equal(await unknownBadge.first().isVisible(), true);
  assert.match(await remainingGaps.innerText(), /Transaction status is unknown/);
  await waitForPanelText('Suspected phishing');
  pass('extra', 'all three example narratives (payment, support, SMS) are handled by the fake runner');

  // Long-running request notice: delay the HTTP response past the 10s UI threshold.
  const slowNotice = page
    .getByRole('status')
    .filter({ hasText: 'The model is taking longer than usual. Please wait.' });
  await page.route('**/api/course/turn', async (route) => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 11_500));
    await route.continue();
  });
  const requestsBeforeSlowTurn = turnRequests;
  const slowResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/course/turn') && response.request().method() === 'POST',
  );
  await draft.fill(QUERY_TEXT);
  await primary.click();
  await slowNotice.waitFor({ timeout: 12_500 });
  assert.equal((await slowResponsePromise).status(), 200);
  await waitIdle();
  assert.equal(turnRequests, requestsBeforeSlowTurn + 1, 'the slow request is not retried automatically');
  await waitUntil(async () => (await slowNotice.count()) === 0, 'the slow notice to clear');
  await page.unroute('**/api/course/turn');

  assert.deepEqual(pageErrors, [], 'the page must not raise uncaught errors');
  console.log(
    JSON.stringify(
      {
        status: 'passed',
        mode: 'fake-model',
        note: 'Injected courseTurn runner; this is not real-model acceptance.',
        checks: checks.length,
        clipboard: clipboardResult,
        chromium: browser.version(),
        pageErrors,
        viewport: '1440x900',
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: 'failed',
        mode: 'fake-model',
        checks,
        pageErrors,
        turnRequests,
        error: String(error),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Closing is best effort; the server is still shut down below.
    }
  }
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

/** Clipboard is optional: only report not-executed, never fail the run on a copy failure. */
async function attemptClipboardCopy(
  page: import('playwright').Page,
  button: (name: string) => import('playwright').Locator,
  materialEditor: import('playwright').Locator,
  expected: string,
): Promise<string> {
  let clipboard: string;
  try {
    await button('Copy').click();
    const feedback = await waitForCopyFeedback(page);
    if (feedback !== 'copied') {
      console.log(`[fake-model] clipboard not-executed: browser copy feedback was ${feedback}.`);
      return 'not-executed';
    }
    clipboard = await page.evaluate(() => navigator.clipboard.readText());
  } catch (error) {
    // Only an unavailable clipboard is tolerated; a copied value that differs still fails below.
    console.log(`[fake-model] clipboard not-executed: ${String(error)}`);
    return 'not-executed';
  }
  // Windows clipboard normalizes LF to CRLF.
  assert.equal(clipboard.replaceAll('\r\n', '\n'), expected);
  assert.equal(await materialEditor.inputValue(), expected);
  return 'compared';
}

async function waitForCopyFeedback(
  page: import('playwright').Page,
): Promise<'copied' | 'fallback' | 'none'> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await page.getByRole('status').filter({ hasText: 'Material copied.' }).count()) > 0) {
      return 'copied';
    }
    if (
      (await page
        .getByRole('status')
        .filter({ hasText: 'Use Ctrl+C to copy the selected text.' })
        .count()) > 0
    ) {
      return 'fallback';
    }
    await page.waitForTimeout(100);
  }
  return 'none';
}
