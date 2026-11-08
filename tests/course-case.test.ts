import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CourseCaseSchema,
  CourseContractError,
  CourseTurnRequestSchema,
  FACT_CATALOG,
  ROLES,
  TurnProposalSchema,
  applyClientAction,
  applyCourseProposal,
  applyEmployeeFactEdit,
  buildNextStep,
  caseStatusLabel,
  composeMaterials,
  confirmMaterials,
  createCourseCase,
  editMaterialText,
  handoverRecipient,
  recordFailedTurn,
  visibleFacts,
  type CourseCase,
  type CourseFact,
  type CourseFailedTurnInput,
  type CourseProposalInput,
  type CourseQuestion,
  type CourseRecommendation,
  type FactKey,
  type TurnProposal,
} from '../shared/course-case';

type ExampleRecord = { id: string; name: string; text: string };
type GuidelineRecord = {
  id: string;
  title: string;
  appliesTo: string[];
  when: string;
  thisOrganisation: string;
  otherOrganisation: string;
  humanJudgement: string;
};

const readCourseJson = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../data/course/${name}`, import.meta.url), 'utf8'));

const examples = readCourseJson('examples.json') as ExampleRecord[];
const guidelines = readCourseJson('guidelines.json') as GuidelineRecord[];

const question = (status: CourseQuestion['status']): CourseQuestion => ({
  id: 'Q1',
  text: 'What was the amount?',
  purpose: 'Clarify the reported amount.',
  relatedKeys: ['amount'],
  status,
  answerText: null,
});

test('empty bank case has 17 unset facts, empty analysis and no visible facts', () => {
  const courseCase = createCourseCase('bank');
  assert.equal(courseCase.phase, 'new');
  assert.equal(courseCase.facts.length, 17);
  assert.deepEqual(
    courseCase.facts.map((fact) => fact.key),
    FACT_CATALOG.map((entry) => entry.key),
  );
  assert.ok(courseCase.facts.every((fact) => fact.status === 'unset'));
  assert.ok(courseCase.facts.every((fact) => fact.value === null));
  assert.ok(courseCase.facts.every((fact) => fact.origin === 'unset'));
  assert.ok(
    courseCase.facts.every(
      (fact) =>
        fact.uncertainty === null && fact.evidence === null && fact.pendingConflict === null,
    ),
  );
  assert.deepEqual(visibleFacts(courseCase), []);
  assert.equal(caseStatusLabel(courseCase), 'New case');
  assert.deepEqual(courseCase.questions, []);
  assert.equal(courseCase.questionsEnded, false);
  assert.deepEqual(courseCase.types, []);
  assert.deepEqual(courseCase.attention, []);
  assert.deepEqual(courseCase.recommendations, []);
  assert.deepEqual(courseCase.messages, []);
  assert.equal(courseCase.messageSeq, 1);
  assert.deepEqual(courseCase.materials, {
    status: 'not-generated',
    employeeEdited: false,
    summary: '',
    personExplanation: '',
    handover: null,
  });
  assert.equal('activeView' in courseCase, false);
  assert.equal('stage' in courseCase, false);
  assert.equal('caseId' in courseCase, false);
});

test('telecom case uses the fixed telecom role text', () => {
  const telecomCase = createCourseCase('telecom');
  assert.equal(telecomCase.role.id, 'telecom');
  assert.equal(telecomCase.role.title, 'Telecom intake officer');
  assert.equal(
    telecomCase.role.responsibilities,
    'Understand reported suspicious calls or messages. Prepare a local summary and a bank handover only when the report includes an account or payment concern. Do not change a phone service or assume the provider sent the message.',
  );
  assert.equal(createCourseCase('bank').role.title, 'Bank intake officer');
  assert.equal(ROLES.bank.title, 'Bank intake officer');
  assert.equal(ROLES.telecom.title, 'Telecom intake officer');
});

test('CourseCaseSchema accepts its own case and rejects missing or extra fields', () => {
  const courseCase = createCourseCase('bank');
  assert.equal(CourseCaseSchema.safeParse(courseCase).success, true);
  const { facts: _facts, ...withoutFacts } = courseCase;
  assert.equal(CourseCaseSchema.safeParse(withoutFacts).success, false);
  assert.equal(CourseCaseSchema.safeParse({ ...courseCase, activeView: 'overview' }).success, false);
  const invalidStatus = {
    ...courseCase,
    facts: [{ ...courseCase.facts[0], status: 'maybe' }],
  };
  assert.equal(CourseCaseSchema.safeParse(invalidStatus).success, false);
});

test('visibleFacts returns only recorded or qualified facts in catalog order', () => {
  const courseCase = createCourseCase('bank');
  courseCase.facts[0].status = 'known';
  courseCase.facts[0].value = 'SMS';
  courseCase.facts[1].status = 'unknown';
  courseCase.facts[2].uncertainty = 'The person is not sure who contacted them.';
  courseCase.facts[3].pendingConflict = { value: 'opened a link', evidence: 'I opened the link' };
  assert.deepEqual(
    visibleFacts(courseCase).map((fact) => fact.key),
    ['contactChannel', 'contactTime', 'claimedIdentity', 'reportedAction'],
  );
});

test('caseStatusLabel follows phase, materials and pending questions', () => {
  const openCase = createCourseCase('bank');
  openCase.phase = 'open';
  assert.equal(caseStatusLabel(openCase), 'Case in progress');
  const answeredCase = createCourseCase('bank');
  answeredCase.phase = 'open';
  answeredCase.questions.push(question('answered'));
  assert.equal(caseStatusLabel(answeredCase), 'Case in progress');
  openCase.questions.push(question('pending'));
  assert.equal(caseStatusLabel(openCase), 'Clarifying case');
  openCase.materials.status = 'draft';
  assert.equal(caseStatusLabel(openCase), 'Draft materials');
  openCase.materials.status = 'confirmed';
  assert.equal(caseStatusLabel(openCase), 'Materials confirmed');
  openCase.materials.status = 'needs-update';
  assert.equal(caseStatusLabel(openCase), 'Needs update');
  openCase.phase = 'new';
  assert.equal(caseStatusLabel(openCase), 'New case');
});

test('FACT_CATALOG and ROLES keep the fixed order and wording', () => {
  assert.deepEqual(
    FACT_CATALOG.map(({ key, label, group }) => [key, label, group]),
    [
      ['contactChannel', 'Contact channel', 'event'],
      ['contactTime', 'Contact time', 'event'],
      ['claimedIdentity', 'Claimed identity', 'event'],
      ['reportedAction', 'Reported action', 'event'],
      ['amount', 'Reported amount', 'money'],
      ['currency', 'Currency', 'money'],
      ['transactionStatus', 'Transaction status', 'money'],
      ['involvedOrganisation', 'Organisation involved', 'money'],
      ['sharedInformation', 'Information shared', 'account'],
      ['affectedService', 'Affected service', 'account'],
      ['observedIssue', 'Observed issue', 'account'],
      ['stillInContact', 'Still in contact', 'current'],
      ['actionsTaken', 'Actions already taken', 'current'],
      ['organisationsContacted', 'Organisations already contacted', 'current'],
      ['evidenceAvailable', 'Evidence the person can provide', 'support'],
      ['urgencyCue', 'Urgency cue', 'support'],
      ['vulnerabilityCue', 'Vulnerability or support need', 'support'],
    ],
  );
  assert.equal(
    ROLES.bank.responsibilities,
    'Understand reported account, payment and credential concerns. Prepare a local summary and only the handovers supported by the report. Do not freeze an account or promise a refund.',
  );
});

test('examples contain the three fixed narratives with no prewritten facts or types', () => {
  assert.deepEqual(
    examples.map((example) => [example.id, example.name]),
    [
      ['sms-phishing', 'SMS phishing · unfamiliar debit'],
      ['supplier-payment', 'Missing information · payment request'],
      ['support-needed', 'Limited information · support needed'],
    ],
  );
  assert.deepEqual(
    examples.map((example) => example.text),
    [
      'I received a text message claiming to be SYN Bank A. I opened the link and entered my banking password and a one-time code. Later I noticed an unfamiliar AUD 2,000 debit. I do not know whether it is pending or completed. I have the message on my phone and have not contacted the bank or mobile provider yet.',
      'Someone claiming to be a supplier emailed new payment details. I may have sent a payment, but I need to check the amount and whether it went through. I still have the email.',
      'I am worried about repeated calls from someone asking me to act quickly. I feel overwhelmed and do not know what to do. I have not shared details of the calls yet.',
    ],
  );
  for (const example of examples) {
    assert.deepEqual(Object.keys(example).sort(), ['id', 'name', 'text']);
    assert.doesNotMatch(JSON.stringify(example), /"(facts?|types?)"\s*:/);
  }
});

test('guidelines contain the four fixed entries and their handover limits', () => {
  assert.deepEqual(
    guidelines.map((guideline) => guideline.id),
    ['DEMO-G01', 'DEMO-G02', 'DEMO-G03', 'DEMO-G04'],
  );
  for (const guideline of guidelines) {
    assert.equal(Object.keys(guideline).length, 7);
    for (const field of ['id', 'title', 'when', 'thisOrganisation', 'otherOrganisation', 'humanJudgement'] as const) {
      assert.ok(guideline[field].length > 0, `${guideline.id} is missing ${field}`);
    }
    assert.ok(guideline.appliesTo.length > 0);
    assert.doesNotMatch(JSON.stringify(guideline), /"(facts?|types?)"\s*:/);
  }
  assert.deepEqual(guidelines[0].appliesTo, ['bank']);
  assert.deepEqual(guidelines[1].appliesTo, ['telecom']);
  assert.deepEqual(guidelines[2].appliesTo, ['bank', 'telecom']);
  assert.deepEqual(guidelines[3].appliesTo, ['bank']);
  assert.match(guidelines[0].thisOrganisation, /freeze/i);
  assert.match(guidelines[0].thisOrganisation, /refund/i);
  assert.match(guidelines[1].thisOrganisation, /SIM/i);
  const supportGuideline = [
    guidelines[2].thisOrganisation,
    guidelines[2].otherOrganisation,
    guidelines[2].humanJudgement,
  ].join(' ');
  assert.match(supportGuideline, /no organisation handover/i);
  assert.match(guidelines[3].otherOrganisation, /no SMS or phone call/i);
  assert.match(guidelines[3].otherOrganisation, /telecom handover/i);
});

const factOf = (courseCase: CourseCase, key: FactKey): CourseFact => {
  const fact = courseCase.facts.find((candidate) => candidate.key === key);
  assert.ok(fact, `missing fact ${key}`);
  return fact;
};

const recordFact = (
  courseCase: CourseCase,
  key: FactKey,
  value: string,
  origin: CourseFact['origin'] = 'narrative',
  evidence: string = value,
): CourseFact => {
  const fact = factOf(courseCase, key);
  fact.value = value;
  fact.status = 'known';
  fact.origin = origin;
  fact.evidence = evidence;
  return fact;
};

const pendingQuestion = (
  id: 'Q1' | 'Q2' | 'Q3',
  text = 'What was the amount?',
  purpose = 'Clarify the reported amount',
): CourseQuestion => ({
  id,
  text,
  purpose,
  relatedKeys: ['amount'],
  status: 'pending',
  answerText: null,
});

const makeProposal = (overrides: Partial<TurnProposal> = {}): TurnProposal => ({
  understoodAs: 'answer',
  reply: 'Recorded.',
  factChanges: [],
  questionUpdates: [],
  proposedQuestions: [],
  types: null,
  attention: null,
  recommendations: null,
  materials: null,
  ...overrides,
});

const makeMessageInput = (
  userText: string,
  overrides: Partial<TurnProposal> = {},
  inputOverrides: Partial<Omit<CourseProposalInput, 'proposal' | 'userText'>> = {},
): CourseProposalInput => ({
  userText,
  purpose: 'message',
  replaceExisting: false,
  retryMessageId: null,
  proposal: makeProposal(overrides),
  ...inputOverrides,
});

const callProposal = (courseCase: CourseCase, input: CourseProposalInput): CourseCase => {
  const before = structuredClone(courseCase);
  const result = applyCourseProposal(courseCase, input);
  assert.equal(JSON.stringify(courseCase), JSON.stringify(before));
  return result;
};

const expectProposalContractError = (
  courseCase: CourseCase,
  input: CourseProposalInput,
  code?: string,
): void => {
  const before = structuredClone(courseCase);
  assert.throws(
    () => applyCourseProposal(courseCase, input),
    (error: unknown) =>
      error instanceof CourseContractError && (code === undefined || error.code === code),
  );
  assert.equal(JSON.stringify(courseCase), JSON.stringify(before));
};

const callClientAction = (
  courseCase: CourseCase,
  action: 'unknown' | 'skip' | 'end',
): CourseCase => {
  const before = structuredClone(courseCase);
  const result = applyClientAction(courseCase, action);
  assert.equal(JSON.stringify(courseCase), JSON.stringify(before));
  return result;
};

const callFactEdit = (courseCase: CourseCase, key: FactKey, rawValue: string): CourseCase => {
  const before = structuredClone(courseCase);
  const result = applyEmployeeFactEdit(courseCase, key, rawValue);
  assert.equal(JSON.stringify(courseCase), JSON.stringify(before));
  return result;
};

const callFailedTurn = (
  courseCase: CourseCase,
  input: CourseFailedTurnInput,
): CourseCase => {
  const before = structuredClone(courseCase);
  const result = recordFailedTurn(courseCase, input);
  assert.equal(JSON.stringify(courseCase), JSON.stringify(before));
  return result;
};

const openCase = (): CourseCase => {
  const courseCase = createCourseCase('bank');
  courseCase.phase = 'open';
  return courseCase;
};

type MaterialPieces = NonNullable<TurnProposal['materials']>;

const materialPieces = (overrides: Partial<MaterialPieces> = {}): MaterialPieces => ({
  summaryNarrative: 'The report describes a message that asked for banking details.',
  personWhatHappened: 'You told us about a message that asked for your banking details.',
  personNextSteps: ['Keep the message so it can be reviewed.'],
  personSupport: null,
  handoverReason: null,
  handoverRequest: null,
  handoverGuidelineId: null,
  ...overrides,
});

const makeGenerateInput = (
  pieces: MaterialPieces | null,
  proposalOverrides: Partial<TurnProposal> = {},
  inputOverrides: Partial<Omit<CourseProposalInput, 'proposal' | 'userText'>> = {},
): CourseProposalInput =>
  makeMessageInput(
    'Generate materials.',
    { ...proposalOverrides, materials: pieces },
    { purpose: 'generate', replaceExisting: false, ...inputOverrides },
  );

const generate = (
  courseCase: CourseCase,
  pieces: MaterialPieces | null,
  proposalOverrides: Partial<TurnProposal> = {},
  inputOverrides: Partial<Omit<CourseProposalInput, 'proposal' | 'userText'>> = {},
): CourseCase => callProposal(courseCase, makeGenerateInput(pieces, proposalOverrides, inputOverrides));

const callHandoverRecipient = (courseCase: CourseCase): 'bank' | 'telecom' | null => {
  const before = structuredClone(courseCase);
  const result = handoverRecipient(courseCase);
  assert.equal(JSON.stringify(courseCase), JSON.stringify(before));
  return result;
};

const callComposeMaterials = (
  courseCase: CourseCase,
  pieces: MaterialPieces,
): ReturnType<typeof composeMaterials> => {
  const caseBefore = structuredClone(courseCase);
  const piecesBefore = structuredClone(pieces);
  const result = composeMaterials(courseCase, pieces);
  assert.equal(JSON.stringify(courseCase), JSON.stringify(caseBefore));
  assert.equal(JSON.stringify(pieces), JSON.stringify(piecesBefore));
  return result;
};

const callEditMaterial = (
  courseCase: CourseCase,
  part: 'summary' | 'personExplanation' | 'handover',
  text: string,
): CourseCase => {
  const before = structuredClone(courseCase);
  const result = editMaterialText(courseCase, part, text);
  assert.equal(JSON.stringify(courseCase), JSON.stringify(before));
  return result;
};

const expectEditMaterialError = (
  courseCase: CourseCase,
  part: 'summary' | 'personExplanation' | 'handover',
  text: string,
): void => {
  const before = structuredClone(courseCase);
  assert.throws(
    () => editMaterialText(courseCase, part, text),
    (error: unknown) => error instanceof CourseContractError,
  );
  assert.equal(JSON.stringify(courseCase), JSON.stringify(before));
};

const callConfirmMaterials = (courseCase: CourseCase): CourseCase => {
  const before = structuredClone(courseCase);
  const result = confirmMaterials(courseCase);
  assert.equal(JSON.stringify(courseCase), JSON.stringify(before));
  return result;
};

const expectConfirmMaterialsError = (courseCase: CourseCase): void => {
  const before = structuredClone(courseCase);
  assert.throws(
    () => confirmMaterials(courseCase),
    (error: unknown) => error instanceof CourseContractError,
  );
  assert.equal(JSON.stringify(courseCase), JSON.stringify(before));
};

const recommendation = (overrides: Partial<CourseRecommendation> = {}): CourseRecommendation => ({
  id: 'R1',
  guidelineId: 'DEMO-G01',
  organisation: 'SYN Bank A',
  priority: 'now',
  audience: 'this-organisation',
  action: 'Have a human reviewer assess the reported payment concern.',
  reason: 'The report describes an unfamiliar debit.',
  ...overrides,
});

const phishingCase = (role: 'bank' | 'telecom' = 'bank'): CourseCase => {
  const courseCase = createCourseCase(role);
  courseCase.phase = 'open';
  recordFact(courseCase, 'contactChannel', 'SMS');
  recordFact(courseCase, 'claimedIdentity', 'SYN Bank A');
  recordFact(courseCase, 'amount', '2,000');
  recordFact(courseCase, 'currency', 'AUD');
  const transactionStatus = factOf(courseCase, 'transactionStatus');
  transactionStatus.status = 'unknown';
  transactionStatus.origin = 'answer';
  courseCase.types = [
    {
      label: 'Suspected phishing',
      reason: 'The message imitated the bank.',
      evidence: 'The person received a text message.',
    },
  ];
  courseCase.recommendations = [recommendation()];
  return courseCase;
};

const supportCase = (): CourseCase => {
  const courseCase = openCase();
  recordFact(courseCase, 'contactChannel', 'phone calls');
  recordFact(courseCase, 'vulnerabilityCue', 'feeling overwhelmed');
  const urgencyCue = factOf(courseCase, 'urgencyCue');
  urgencyCue.status = 'unknown';
  urgencyCue.origin = 'answer';
  courseCase.types = [
    {
      label: 'Insufficient information',
      reason: 'The calls are not described in enough detail.',
      evidence: 'I have not shared details of the calls yet.',
    },
  ];
  courseCase.recommendations = [
    recommendation({
      guidelineId: 'DEMO-G03',
      organisation: 'ScamSafe',
      audience: 'human-judgement',
      action: 'Offer human support and agree the next step with the person.',
      reason: 'The person reports feeling overwhelmed.',
    }),
  ];
  return courseCase;
};

test('query keeps the recorded amount, pending question, analysis and materials', () => {
  const base = openCase();
  recordFact(base, 'amount', '2,000');
  base.questions.push(pendingQuestion('Q1'));
  base.types.push({
    label: 'Suspected phishing',
    reason: 'The message imitated the bank.',
    evidence: 'The person received a text message.',
  });
  base.materials = {
    status: 'draft',
    employeeEdited: false,
    summary: 'Employee note.',
    personExplanation: 'Person text.',
    handover: null,
  };

  const result = callProposal(
    base,
    makeMessageInput('What is the current amount?', {
      understoodAs: 'query',
      reply: 'The recorded amount is 2,000 AUD. The question did not change it.',
      factChanges: [
        { key: 'amount', value: '9,999', certainty: 'stated', evidence: 'not in this message' },
      ],
      types: [],
      attention: [],
      recommendations: [],
    }),
  );

  assert.equal(factOf(result, 'amount').value, '2,000');
  assert.equal(factOf(result, 'amount').status, 'known');
  assert.equal(result.questions[0].status, 'pending');
  assert.deepEqual(result.types, base.types);
  assert.equal(result.materials.status, 'draft');
  assert.equal(result.materials.summary, 'Employee note.');
  assert.equal(result.phase, 'open');
  assert.deepEqual(result.messages.map((message) => message.role), ['user', 'assistant']);
  assert.equal(result.messageSeq, 3);
  assert.match(result.messages[0].text, /current amount/);
  assert.match(result.messages[1].text, /Question 1 of 1/);
});

test('correction replaces the amount and currency without touching question progress', () => {
  const base = openCase();
  recordFact(base, 'amount', '2,000');
  base.questions.push(pendingQuestion('Q1'));
  base.materials = {
    status: 'draft',
    employeeEdited: false,
    summary: 'Employee note.',
    personExplanation: 'Person text.',
    handover: null,
  };

  const result = callProposal(
    base,
    makeMessageInput('The amount is 200 AUD, not 2,000.', {
      understoodAs: 'correction',
      reply: 'The recorded amount is now 200 AUD.',
      factChanges: [
        { key: 'amount', value: '200', certainty: 'stated', evidence: '200' },
        { key: 'currency', value: 'AUD', certainty: 'stated', evidence: 'AUD' },
      ],
    }),
  );

  assert.equal(factOf(result, 'amount').value, '200');
  assert.equal(factOf(result, 'amount').origin, 'correction');
  assert.equal(factOf(result, 'currency').value, 'AUD');
  assert.equal(factOf(result, 'currency').origin, 'correction');
  assert.equal(result.questions[0].status, 'pending');
  assert.equal(result.materials.status, 'needs-update');
  assert.equal(result.materials.summary, 'Employee note.');
});

test('an initial report after a correction keeps the corrected value and records a conflict', () => {
  const base = openCase();
  recordFact(base, 'amount', '200', 'correction');
  factOf(base, 'amount').uncertainty = 'The corrected amount is still under review.';
  base.questions.push(pendingQuestion('Q1'));

  const result = callProposal(
    base,
    makeMessageInput('The amount is 2,000, not 200.', {
      understoodAs: 'initial-report',
      reply: 'The corrected amount is still 200 AUD.',
      factChanges: [{ key: 'amount', value: '2000', certainty: 'stated', evidence: '2,000' }],
      types: [],
      attention: [],
      recommendations: [],
    }),
  );

  assert.equal(factOf(result, 'amount').value, '200');
  assert.equal(factOf(result, 'amount').origin, 'correction');
  assert.deepEqual(factOf(result, 'amount').pendingConflict, {
    value: '2000',
    evidence: '2,000',
  });
});

test('uncertainty keeps a recorded amount and only adds the uncertainty note', () => {
  const base = openCase();
  recordFact(base, 'amount', '2,000');
  base.questions.push(pendingQuestion('Q1'));

  const result = callProposal(
    base,
    makeMessageInput('I am not sure about the amount.', {
      understoodAs: 'uncertainty',
      reply: 'The amount remains 2,000 and is now marked uncertain.',
      factChanges: [
        { key: 'amount', value: null, certainty: 'uncertain', evidence: 'not sure about the amount' },
      ],
    }),
  );

  assert.equal(factOf(result, 'amount').value, '2,000');
  assert.equal(factOf(result, 'amount').status, 'known');
  assert.equal(factOf(result, 'amount').uncertainty, 'not sure about the amount');
  assert.equal(factOf(result, 'amount').origin, 'narrative');

  const empty = openCase();
  const unknownResult = callProposal(
    empty,
    makeMessageInput('I do not know the time.', {
      understoodAs: 'uncertainty',
      factChanges: [{ key: 'contactTime', value: null, certainty: 'unknown', evidence: 'do not know' }],
    }),
  );
  assert.equal(factOf(unknownResult, 'contactTime').status, 'unknown');
  assert.equal(factOf(unknownResult, 'contactTime').value, null);
  assert.equal(factOf(unknownResult, 'contactTime').origin, 'unset');
  assert.equal(factOf(unknownResult, 'contactTime').uncertainty, 'do not know');
});

test('multi-answer records the payment example and marks all three questions handled', () => {
  const base = openCase();
  base.questions.push(
    pendingQuestion('Q1', 'What amount was paid?', 'Clarify the paid amount'),
    pendingQuestion('Q2', 'Did the supplier confirm the payment?', 'Clarify the supplier check'),
    pendingQuestion('Q3', 'What is the transaction status?', 'Clarify the transaction status'),
  );

  const result = callProposal(
    base,
    makeMessageInput('1: 500 AUD paid; 2: Not sure; 3: Pending.', {
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
    }),
  );

  assert.equal(factOf(result, 'amount').value, '500');
  assert.equal(factOf(result, 'currency').value, 'AUD');
  assert.equal(factOf(result, 'transactionStatus').value, 'Pending');
  assert.notEqual(factOf(result, 'transactionStatus').value, 'completed');
  assert.deepEqual(
    result.questions.map((question) => question.status),
    ['answered', 'unknown', 'answered'],
  );
  assert.equal(result.questions.some((question) => question.status === 'pending'), false);
  assert.match(
    result.messages[1].text,
    /Next: you can add or correct information, view guidance, or generate materials\./,
  );
});

test('answering only Q1 and Q3 leaves Q2 pending and points the next step at Q2', () => {
  const base = openCase();
  base.questions.push(
    pendingQuestion('Q1', 'What amount was paid?', 'Clarify the paid amount'),
    pendingQuestion('Q2', 'Did the supplier confirm the payment?', 'Clarify the supplier check'),
    pendingQuestion('Q3', 'What is the transaction status?', 'Clarify the transaction status'),
  );

  const result = callProposal(
    base,
    makeMessageInput('1: 500 AUD; 3: Pending.', {
      understoodAs: 'multi-answer',
      reply: 'Recorded the first and third answers.',
      questionUpdates: [
        { questionId: 'Q1', result: 'answered', evidence: '500 AUD' },
        { questionId: 'Q3', result: 'answered', evidence: 'Pending' },
      ],
    }),
  );

  assert.equal(result.questions[1].status, 'pending');
  assert.equal(
    buildNextStep(result),
    'Next: Question 2 of 3: Did the supplier confirm the payment? You can answer, ask about the case, say you do not know, skip, or end clarification.',
  );
  assert.match(result.messages[1].text, /Question 2 of 3/);
});

test('the unknown button marks the question without inferring facts', () => {
  const base = openCase();
  recordFact(base, 'amount', '2,000');
  base.questions.push(pendingQuestion('Q1'));

  const result = callClientAction(base, 'unknown');

  assert.equal(result.questions[0].status, 'unknown');
  assert.equal(JSON.stringify(result.facts), JSON.stringify(base.facts));
  assert.deepEqual(result.messages.map((message) => message.role), ['assistant']);
  assert.equal(
    result.messages[0].text,
    'Question 1 marked unknown. No fact was inferred.\n\nNext: you can add or correct information, view guidance, or generate materials.',
  );
});

test('the end button skips every remaining question and keeps the unanswered gaps', () => {
  const base = openCase();
  base.questions.push(
    pendingQuestion('Q1'),
    pendingQuestion('Q2', 'Did the payment go through?', 'Clarify the payment'),
    pendingQuestion('Q3', 'What evidence is available?', 'Clarify the evidence'),
  );

  const result = callClientAction(base, 'end');

  assert.deepEqual(
    result.questions.map((question) => question.status),
    ['skipped', 'skipped', 'skipped'],
  );
  assert.ok(result.questions.every((question) => question.answerText === null));
  assert.equal(result.questionsEnded, true);
  assert.equal(
    result.messages[0].text,
    'Clarification ended. Unanswered items remain unknown.\n\nNext: you can add or correct information, view guidance, or generate materials.',
  );
});

test('fact evidence must be in the message while type evidence may come from a saved message', () => {
  const base = openCase();
  base.messages.push({
    id: 'm1',
    role: 'user',
    text: 'I received a text message claiming to be SYN Bank A.',
    status: 'complete',
  });
  base.messageSeq = 2;

  expectProposalContractError(
    base,
    makeMessageInput('I got a message from my bank.', {
      understoodAs: 'initial-report',
      reply: 'Noted.',
      factChanges: [
        {
          key: 'contactChannel',
          value: 'SMS',
          certainty: 'stated',
          evidence: 'text message from my bank',
        },
      ],
      types: [],
      attention: [],
      recommendations: [],
    }),
    'EVIDENCE_NOT_IN_TEXT',
  );

  const result = callProposal(
    base,
    makeMessageInput('It looked like my bank.', {
      understoodAs: 'initial-report',
      reply: 'Noted.',
      types: [
        {
          label: 'Suspected phishing',
          reason: 'The message imitated the bank.',
          evidence: 'I received a text message claiming to be SYN Bank A.',
        },
      ],
      attention: [],
      recommendations: [],
    }),
  );

  assert.equal(result.types.length, 1);
  assert.equal(result.types[0].label, 'Suspected phishing');
});

test('uncertainty and client actions mark existing drafts needs-update without changing their text', () => {
  const base = openCase();
  recordFact(base, 'amount', '2,000');
  base.questions.push(pendingQuestion('Q1'));
  base.materials = {
    status: 'draft',
    employeeEdited: true,
    summary: 'Employee note.',
    personExplanation: 'Person text.',
    handover: null,
  };

  const result = callProposal(
    base,
    makeMessageInput('I am not sure about the amount.', {
      understoodAs: 'uncertainty',
      factChanges: [
        { key: 'amount', value: null, certainty: 'uncertain', evidence: 'not sure about the amount' },
      ],
    }),
  );
  assert.equal(result.materials.status, 'needs-update');
  assert.equal(result.materials.summary, 'Employee note.');
  assert.equal(result.materials.personExplanation, 'Person text.');
  assert.equal(result.materials.employeeEdited, true);

  const buttonResult = callClientAction(base, 'unknown');
  assert.equal(buttonResult.materials.status, 'needs-update');
  assert.equal(buttonResult.materials.summary, 'Employee note.');
  assert.equal(JSON.stringify(buttonResult.facts), JSON.stringify(base.facts));
});

test('a supplement can replace an answer value and keeps origin answer', () => {
  const base = openCase();

  const answered = callProposal(
    base,
    makeMessageInput('It was 500 AUD.', {
      understoodAs: 'answer',
      factChanges: [{ key: 'amount', value: '500', certainty: 'stated', evidence: '500' }],
    }),
  );
  assert.equal(factOf(answered, 'amount').value, '500');
  assert.equal(factOf(answered, 'amount').origin, 'answer');

  const supplemented = callProposal(
    answered,
    makeMessageInput('Actually 450 AUD.', {
      understoodAs: 'supplement',
      factChanges: [{ key: 'amount', value: '450', certainty: 'stated', evidence: '450' }],
    }),
  );
  assert.equal(factOf(supplemented, 'amount').value, '450');
  assert.equal(factOf(supplemented, 'amount').origin, 'answer');
});

test('an initial report cannot overwrite a corrected value and writes pendingConflict instead', () => {
  const base = openCase();
  recordFact(base, 'amount', '200', 'correction');

  const result = callProposal(
    base,
    makeMessageInput('The amount is 2000.', {
      understoodAs: 'initial-report',
      factChanges: [{ key: 'amount', value: '2000', certainty: 'stated', evidence: '2000' }],
      types: [],
      attention: [],
      recommendations: [],
    }),
  );

  assert.equal(factOf(result, 'amount').value, '200');
  assert.equal(factOf(result, 'amount').origin, 'correction');
  assert.equal(factOf(result, 'amount').pendingConflict?.value, '2000');
});

test('query keeps analysis, null analysis keeps it and an empty array clears it', () => {
  const base = openCase();
  base.messages.push({
    id: 'm1',
    role: 'user',
    text: 'The caller claimed to be from the bank.',
    status: 'complete',
  });
  base.messageSeq = 2;
  base.types = [
    {
      label: 'Suspected phishing',
      reason: 'The caller imitated the bank.',
      evidence: 'The caller claimed to be from the bank.',
    },
  ];
  base.attention = [
    {
      kind: 'urgency',
      text: 'The person was asked to act quickly.',
      evidence: 'The caller claimed to be from the bank.',
    },
  ];

  const queryResult = callProposal(
    base,
    makeMessageInput('What do we know?', {
      understoodAs: 'query',
      types: [],
      attention: [],
      recommendations: [],
      factChanges: [
        { key: 'amount', value: '9,999', certainty: 'stated', evidence: '9,999' },
      ],
    }),
  );
  assert.equal(queryResult.types.length, 1);
  assert.equal(queryResult.attention.length, 1);

  const nullCorrection = callProposal(
    base,
    makeMessageInput('Actually the amount was 200 AUD.', {
      understoodAs: 'correction',
      factChanges: [{ key: 'amount', value: '200', certainty: 'stated', evidence: '200' }],
      types: null,
      attention: null,
      recommendations: null,
    }),
  );
  assert.equal(nullCorrection.types.length, 1);
  assert.equal(nullCorrection.attention.length, 1);

  const clearedCorrection = callProposal(
    base,
    makeMessageInput('Remove the saved analysis.', {
      understoodAs: 'correction',
      types: [],
      attention: [],
      recommendations: [],
    }),
  );
  assert.deepEqual(clearedCorrection.types, []);
  assert.deepEqual(clearedCorrection.attention, []);
});

test('a generate request inside a message changes nothing and ignores replaceExisting false', () => {
  const base = openCase();
  recordFact(base, 'amount', '2,000');
  base.questions.push(pendingQuestion('Q1'));
  base.types = [
    { label: 'Suspected phishing', reason: 'Prior analysis.', evidence: 'Prior user message.' },
  ];
  base.materials = {
    status: 'draft',
    employeeEdited: false,
    summary: 'Employee note.',
    personExplanation: 'Person text.',
    handover: null,
  };

  const result = callProposal(
    base,
    makeMessageInput('Please generate the materials.', {
      understoodAs: 'generate-request',
      reply: 'Use Generate materials when you want a draft.',
      factChanges: [{ key: 'amount', value: '9,999', certainty: 'stated', evidence: 'generate now' }],
      questionUpdates: [{ questionId: 'Q1', result: 'answered', evidence: 'generate now' }],
      types: [],
      attention: [],
      recommendations: [],
    }),
  );

  assert.equal(factOf(result, 'amount').value, '2,000');
  assert.equal(result.questions[0].status, 'pending');
  assert.equal(result.types.length, 1);
  assert.equal(result.materials.status, 'draft');
  assert.equal(result.materials.summary, 'Employee note.');
  assert.equal(result.messages.length, 2);

  const noQuestions = openCase();
  const ignored = callProposal(
    noQuestions,
    makeMessageInput('Generate now.', {
      understoodAs: 'generate-request',
      proposedQuestions: [
        {
          id: 'Q1',
          text: 'What else should we check?',
          purpose: 'Check the remaining gap',
          relatedKeys: ['amount'],
        },
      ],
      types: [],
      attention: [],
      recommendations: [],
    }),
  );
  assert.deepEqual(ignored.questions, []);
});

test('a generate turn ignores the intent name, keeps facts and replaces analysis arrays', () => {
  const base = openCase();
  base.messages.push({
    id: 'm1',
    role: 'user',
    text: 'I received a suspicious text message.',
    status: 'complete',
  });
  base.messageSeq = 2;

  const result = callProposal(
    base,
    makeMessageInput(
      'Generate materials.',
      {
        understoodAs: 'generate-request',
        reply: 'Draft prepared.',
        factChanges: [{ key: 'amount', value: '999', certainty: 'stated', evidence: '999' }],
        questionUpdates: [{ questionId: 'Q1', result: 'answered', evidence: '999' }],
        types: [
          {
            label: 'Suspected phishing',
            reason: 'The report mentions a suspicious text message.',
            evidence: 'I received a suspicious text message.',
          },
        ],
        attention: [],
        recommendations: [],
        materials: materialPieces(),
      },
      { purpose: 'generate', replaceExisting: false },
    ),
  );

  assert.equal(result.types.length, 1);
  assert.equal(factOf(result, 'amount').value, null);
  assert.equal(result.materials.status, 'draft');
  assert.match(result.materials.summary, /FICTIONAL COURSE CASE/);
  assert.equal(result.phase, 'open');
});

test('the first successful message opens the case and adds accepted questions', () => {
  const base = createCourseCase('bank');
  const narrative =
    'I received a text message claiming to be SYN Bank A and I opened the link.';

  const result = callProposal(
    base,
    makeMessageInput(narrative, {
      understoodAs: 'initial-report',
      reply: 'Question 1 of 3 was about the amount.\nI recorded the initial report.',
      factChanges: [
        { key: 'contactChannel', value: 'SMS', certainty: 'stated', evidence: 'text message' },
      ],
      proposedQuestions: [
        {
          id: 'Q1',
          text: 'What amount was involved?',
          purpose: 'Clarify the amount',
          relatedKeys: ['amount'],
        },
        {
          id: 'Q2',
          text: 'Was the message still available?',
          purpose: 'Clarify the evidence',
          relatedKeys: ['evidenceAvailable'],
        },
      ],
      types: [
        {
          label: 'Suspected phishing',
          reason: 'The message imitated the bank.',
          evidence: 'text message claiming to be SYN Bank A',
        },
      ],
      attention: [],
      recommendations: [],
    }),
  );

  assert.equal(result.phase, 'open');
  assert.equal(factOf(result, 'contactChannel').origin, 'narrative');
  assert.deepEqual(result.questions.map((question) => question.id), ['Q1', 'Q2']);
  assert.deepEqual(result.messages.map((message) => message.id), ['m1', 'm2']);
  assert.equal(result.messageSeq, 3);
  const assistant = result.messages[1].text;
  assert.ok(!assistant.includes('Question 1 of 3 was about the amount.'));
  assert.ok(assistant.includes('I recorded the initial report.'));
  assert.ok(
    assistant.includes(
      'I have 2 questions to clarify this case, covering Clarify the amount; Clarify the evidence. You can answer more than one, say you do not know, skip a question, or end early.',
    ),
  );
  assert.ok(assistant.includes('Next: Question 1 of 2: What amount was involved?'));
});

test('proposed questions must start at Q1 and are ignored once questions exist', () => {
  const base = createCourseCase('bank');
  expectProposalContractError(
    base,
    makeMessageInput('I need help with a case.', {
      understoodAs: 'initial-report',
      proposedQuestions: [
        {
          id: 'Q2',
          text: 'What amount was involved?',
          purpose: 'Clarify the amount',
          relatedKeys: ['amount'],
        },
      ],
      types: [],
      attention: [],
      recommendations: [],
    }),
    'PROPOSED_QUESTIONS_INVALID',
  );

  const withExisting = openCase();
  withExisting.questions.push(pendingQuestion('Q1'));
  const result = callProposal(
    withExisting,
    makeMessageInput('Add more questions.', {
      understoodAs: 'answer',
      proposedQuestions: [
        {
          id: 'Q2',
          text: 'A different question?',
          purpose: 'Check something else',
          relatedKeys: ['amount'],
        },
      ],
    }),
  );
  assert.deepEqual(result.questions.map((question) => question.id), ['Q1']);
  assert.equal(result.questions[0].text, 'What was the amount?');
});

test('an initial report must supply all three analysis arrays', () => {
  const base = createCourseCase('bank');
  expectProposalContractError(
    base,
    makeMessageInput('A narrative.', { understoodAs: 'initial-report' }),
    'INITIAL_REPORT_ANALYSIS_REQUIRED',
  );
});

test('correction ignores question updates, including unsupported evidence', () => {
  const base = openCase();
  base.questions.push(pendingQuestion('Q1'));

  const result = callProposal(
    base,
    makeMessageInput('The amount is 200 AUD.', {
      understoodAs: 'correction',
      factChanges: [{ key: 'amount', value: '200', certainty: 'stated', evidence: '200' }],
      questionUpdates: [
        { questionId: 'Q1', result: 'answered', evidence: 'not present in the message' },
      ],
    }),
  );

  assert.equal(result.questions[0].status, 'pending');
});

test('skip-request skips only the first pending question and end-request skips the rest', () => {
  const base = openCase();
  base.questions.push(
    pendingQuestion('Q1'),
    pendingQuestion('Q2', 'Did the payment go through?', 'Clarify the payment'),
    pendingQuestion('Q3', 'What evidence is available?', 'Clarify the evidence'),
  );

  const skipped = callProposal(
    base,
    makeMessageInput('Skip this one.', { understoodAs: 'skip-request', reply: 'Skipped it.' }),
  );
  assert.deepEqual(
    skipped.questions.map((question) => question.status),
    ['skipped', 'pending', 'pending'],
  );
  assert.ok(buildNextStep(skipped).startsWith('Next: Question 2 of 3:'));

  const ended = callProposal(
    base,
    makeMessageInput('End the questions.', {
      understoodAs: 'end-request',
      reply: 'Clarification ended.',
    }),
  );
  assert.deepEqual(
    ended.questions.map((question) => question.status),
    ['skipped', 'skipped', 'skipped'],
  );
  assert.equal(ended.questionsEnded, true);
});

test('a message that only corrects an identical value keeps origin and leaves evidence only', () => {
  const base = openCase();
  recordFact(base, 'amount', '2,000');
  const corrected = callProposal(
    base,
    makeMessageInput('The amount is 2,000.', {
      understoodAs: 'correction',
      factChanges: [
        { key: 'amount', value: '2,000', certainty: 'stated', evidence: '2,000' },
      ],
    }),
  );
  assert.equal(factOf(corrected, 'amount').origin, 'narrative');
  assert.equal(factOf(corrected, 'amount').pendingConflict, null);
  assert.equal(factOf(corrected, 'amount').evidence, '2,000');
});

test('a correction can replace a corrected value and clears uncertainty and conflict', () => {
  const base = openCase();
  const amount = recordFact(base, 'amount', '200', 'correction');
  amount.uncertainty = 'The earlier correction still needs checking.';
  amount.pendingConflict = { value: '300', evidence: '300' };

  const result = callProposal(
    base,
    makeMessageInput('Actually 150 AUD.', {
      understoodAs: 'correction',
      factChanges: [{ key: 'amount', value: '150', certainty: 'stated', evidence: '150' }],
    }),
  );

  assert.equal(factOf(result, 'amount').value, '150');
  assert.equal(factOf(result, 'amount').status, 'known');
  assert.equal(factOf(result, 'amount').origin, 'correction');
  assert.equal(factOf(result, 'amount').uncertainty, null);
  assert.equal(factOf(result, 'amount').pendingConflict, null);
  assert.equal(factOf(result, 'amount').evidence, '150');
});

test('a correction can replace an employee-edited value and clears conflict', () => {
  const base = openCase();
  const edited = callFactEdit(base, 'amount', '250');
  assert.equal(factOf(edited, 'amount').origin, 'employee-edit');

  const result = callProposal(
    edited,
    makeMessageInput('Actually 150 AUD.', {
      understoodAs: 'correction',
      factChanges: [{ key: 'amount', value: '150', certainty: 'stated', evidence: '150' }],
    }),
  );

  assert.equal(factOf(result, 'amount').value, '150');
  assert.equal(factOf(result, 'amount').status, 'known');
  assert.equal(factOf(result, 'amount').origin, 'correction');
  assert.equal(factOf(result, 'amount').pendingConflict, null);
});

test('employee fact edits set origin employee-edit and clear uncertainty and conflict', () => {
  const base = openCase();
  const amount = recordFact(base, 'amount', '2,000', 'correction');
  amount.uncertainty = 'Unsure.';
  amount.pendingConflict = { value: '2,500', evidence: '2,500' };
  base.materials = {
    status: 'draft',
    employeeEdited: false,
    summary: 'Employee note.',
    personExplanation: 'Person text.',
    handover: null,
  };

  const unknown = callFactEdit(base, 'amount', 'Unknown');
  assert.equal(factOf(unknown, 'amount').status, 'unknown');
  assert.equal(factOf(unknown, 'amount').value, null);
  assert.equal(factOf(unknown, 'amount').origin, 'employee-edit');
  assert.equal(factOf(unknown, 'amount').uncertainty, null);
  assert.equal(factOf(unknown, 'amount').pendingConflict, null);
  assert.equal(unknown.materials.status, 'needs-update');
  assert.equal(unknown.materials.summary, 'Employee note.');

  const blank = callFactEdit(base, 'amount', '   ');
  assert.equal(factOf(blank, 'amount').status, 'unknown');
  assert.equal(factOf(blank, 'amount').value, null);

  const edited = callFactEdit(base, 'amount', '  250  ');
  assert.equal(factOf(edited, 'amount').status, 'known');
  assert.equal(factOf(edited, 'amount').value, '250');
  assert.equal(factOf(edited, 'amount').origin, 'employee-edit');
});

test('recordFailedTurn appends or reuses a failed user message and keeps an error note', () => {
  const base = openCase();
  const failed = callFailedTurn(base, {
    userText: 'The amount is 500 AUD.',
    errorMessage: 'The model timed out. Your text is kept.',
    retryMessageId: null,
  });

  assert.deepEqual(
    failed.messages.map((message) => [message.id, message.role, message.status]),
    [
      ['m1', 'user', 'failed'],
      ['m2', 'error', 'failed'],
    ],
  );
  assert.equal(failed.messageSeq, 3);

  const retried = callFailedTurn(failed, {
    userText: 'The amount is 500 AUD.',
    errorMessage: 'Retry failed.',
    retryMessageId: 'm1',
  });
  assert.deepEqual(
    retried.messages.map((message) => [message.id, message.role, message.status]),
    [
      ['m1', 'user', 'failed'],
      ['m3', 'error', 'failed'],
    ],
  );
  assert.equal(retried.messageSeq, 4);
});

test('a successful retry reuses the failed user message and removes the following error', () => {
  const base = openCase();
  const failed = recordFailedTurn(base, {
    userText: 'I am not sure about the amount.',
    errorMessage: 'The model timed out. Your text is kept.',
    retryMessageId: null,
  });

  const result = callProposal(
    failed,
    makeMessageInput(
      'I am not sure about the amount.',
      {
        understoodAs: 'uncertainty',
        factChanges: [
          {
            key: 'amount',
            value: null,
            certainty: 'uncertain',
            evidence: 'not sure about the amount',
          },
        ],
      },
      { retryMessageId: 'm1' },
    ),
  );

  assert.deepEqual(
    result.messages.map((message) => [message.id, message.role, message.status]),
    [
      ['m1', 'user', 'complete'],
      ['m3', 'assistant', 'complete'],
    ],
  );
  assert.equal(result.messageSeq, 4);
  assert.equal(factOf(result, 'amount').uncertainty, 'not sure about the amount');
});

test('buildNextStep returns the fixed sentence for every documented state', () => {
  const fresh = createCourseCase('bank');
  assert.equal(
    buildNextStep(fresh),
    'Next: describe a case or load an example, then select Analyze case.',
  );

  const pending = openCase();
  pending.questions.push(pendingQuestion('Q1', 'What was the amount?'));
  assert.equal(
    buildNextStep(pending),
    'Next: Question 1 of 1: What was the amount? You can answer, ask about the case, say you do not know, skip, or end clarification.',
  );

  pending.materials.status = 'needs-update';
  assert.equal(
    buildNextStep(pending),
    'Next: Question 1 of 1: What was the amount? You can answer, ask about the case, say you do not know, skip, or end clarification. Your existing drafts are preserved but need regeneration before confirmation or export.',
  );

  pending.materials.status = 'draft';
  assert.equal(
    buildNextStep(pending),
    'Next: Question 1 of 1: What was the amount? You can answer, ask about the case, say you do not know, skip, or end clarification. You may also review the existing materials.',
  );

  pending.materials.status = 'confirmed';
  assert.equal(
    buildNextStep(pending),
    'Next: Question 1 of 1: What was the amount? You can answer, ask about the case, say you do not know, skip, or end clarification. You may also review the existing materials.',
  );

  const stale = openCase();
  stale.materials.status = 'needs-update';
  assert.equal(
    buildNextStep(stale),
    'Next: existing materials and your edits are preserved. Regenerate them before confirming or exporting, or continue clarifying the case.',
  );

  const confirmed = openCase();
  confirmed.materials.status = 'confirmed';
  assert.equal(
    buildNextStep(confirmed),
    'Next: copy or download the selected material. You can also review another material or ask about the case.',
  );

  const draft = openCase();
  draft.materials.status = 'draft';
  assert.equal(
    buildNextStep(draft),
    'Next: review and edit the drafts on the left, then Confirm materials to enable copy or download.',
  );

  const handled = openCase();
  handled.questions.push({ ...pendingQuestion('Q1'), status: 'answered', answerText: '500 AUD' });
  assert.equal(
    buildNextStep(handled),
    'Next: you can add or correct information, view guidance, or generate materials.',
  );

  const analyzed = openCase();
  assert.equal(
    buildNextStep(analyzed),
    'Next: review the case facts, view guidance, or generate materials.',
  );
});

test('TurnProposalSchema is strict and enforces the documented field limits', () => {
  const valid = makeProposal({ reply: 'Valid reply.' });
  assert.equal(TurnProposalSchema.safeParse(valid).success, true);
  assert.equal(TurnProposalSchema.safeParse({ ...valid, extra: true }).success, false);
  assert.equal(TurnProposalSchema.safeParse({ ...valid, reply: '' }).success, false);
  assert.equal(TurnProposalSchema.safeParse({ ...valid, reply: 'x'.repeat(1201) }).success, false);
  assert.equal(TurnProposalSchema.safeParse({ ...valid, understoodAs: 'pending' }).success, false);

  const factChange = { key: 'amount', value: '200', certainty: 'stated', evidence: '200' };
  assert.equal(
    TurnProposalSchema.safeParse({
      ...valid,
      factChanges: Array.from({ length: 13 }, () => ({ ...factChange })),
    }).success,
    false,
  );
  assert.equal(
    TurnProposalSchema.safeParse({
      ...valid,
      factChanges: [{ ...factChange, evidence: 'x'.repeat(401) }],
    }).success,
    false,
  );

  const questionUpdate = { questionId: 'Q1', result: 'answered', evidence: 'yes' };
  assert.equal(
    TurnProposalSchema.safeParse({
      ...valid,
      questionUpdates: Array.from({ length: 4 }, () => ({ ...questionUpdate })),
    }).success,
    false,
  );

  const proposedQuestion = {
    id: 'Q1',
    text: 'What amount was involved?',
    purpose: 'Clarify the amount',
    relatedKeys: ['amount'],
  };
  assert.equal(
    TurnProposalSchema.safeParse({
      ...valid,
      proposedQuestions: Array.from({ length: 4 }, () => ({ ...proposedQuestion })),
    }).success,
    false,
  );
  assert.equal(
    TurnProposalSchema.safeParse({
      ...valid,
      proposedQuestions: [{ ...proposedQuestion, text: 'Short' }],
    }).success,
    false,
  );
  assert.equal(
    TurnProposalSchema.safeParse({
      ...valid,
      proposedQuestions: [{ ...proposedQuestion, text: 'x'.repeat(241) }],
    }).success,
    false,
  );

  const typeItem = { label: 'Other', reason: 'Reason.', evidence: 'Evidence.' };
  assert.equal(
    TurnProposalSchema.safeParse({
      ...valid,
      types: Array.from({ length: 4 }, () => ({ ...typeItem })),
    }).success,
    false,
  );
  assert.equal(
    TurnProposalSchema.safeParse({
      ...valid,
      types: [{ ...typeItem, reason: 'x'.repeat(401) }],
    }).success,
    false,
  );

  const attentionItem = { kind: 'urgency', text: 'Urgent.', evidence: 'Evidence.' };
  assert.equal(
    TurnProposalSchema.safeParse({
      ...valid,
      attention: Array.from({ length: 5 }, () => ({ ...attentionItem })),
    }).success,
    false,
  );

  const recommendation = {
    id: 'R1',
    guidelineId: 'DEMO-G01',
    organisation: 'SYN Bank A',
    priority: 'now',
    audience: 'this-organisation',
    action: 'Action.',
    reason: 'Reason.',
  };
  assert.equal(
    TurnProposalSchema.safeParse({
      ...valid,
      recommendations: Array.from({ length: 5 }, () => ({ ...recommendation })),
    }).success,
    false,
  );
});

test('CourseTurnRequestSchema accepts a complete request and rejects extra or missing fields', () => {
  const request = {
    case: createCourseCase('bank'),
    userText: 'A message',
    purpose: 'message' as const,
    replaceExisting: false,
    retryMessageId: null,
  };
  assert.equal(CourseTurnRequestSchema.safeParse(request).success, true);
  assert.equal(CourseTurnRequestSchema.safeParse({ ...request, extra: true }).success, false);
  const { case: _case, ...withoutCase } = request;
  assert.equal(CourseTurnRequestSchema.safeParse(withoutCase).success, false);
  assert.equal(CourseTurnRequestSchema.safeParse({ ...request, userText: '' }).success, false);
  assert.equal(CourseTurnRequestSchema.safeParse({ ...request, purpose: 'other' }).success, false);
  assert.equal(
    CourseTurnRequestSchema.safeParse({ ...request, retryMessageId: 5 }).success,
    false,
  );
});

test('generate assembles the reported facts and gaps from the current case only', () => {
  const base = phishingCase();
  const generated = generate(
    base,
    materialPieces({
      summaryNarrative: 'The person reported an unfamiliar debit of 9,999 AUD.',
    }),
  );

  const summary = generated.materials.summary;
  assert.equal(generated.materials.status, 'draft');
  assert.equal(generated.materials.employeeEdited, false);
  assert.match(summary, /^FICTIONAL COURSE CASE/);
  assert.match(summary, /Receiving role: Bank intake officer/);
  assert.match(summary, /CASE SUMMARY/);
  assert.match(summary, /CANDIDATE TYPES/);
  assert.match(summary, /Suspected phishing/);
  assert.match(summary, /REPORTED FACTS/);
  assert.match(summary, /Reported amount: 2,000/);
  assert.match(summary, /Currency: AUD/);
  assert.match(summary, /Transaction status: Unknown/);
  assert.match(summary, /CLARIFIED INFORMATION/);
  assert.match(summary, /REMAINING GAPS/);
  assert.match(summary, /NEXT STEP/);
  assert.match(summary, /Have a human reviewer assess the reported payment concern\./);
  assert.match(summary, /Basis: fictional DEMO-G01\./);
  assert.match(summary, /Local draft only\. No action or referral has been completed\./);
  assert.match(summary, /See the facts below\./);
  assert.doesNotMatch(summary, /9,999/);
  assert.doesNotMatch(summary, /Unknown Unknown/);
  assert.doesNotMatch(summary, /Contact time:/);
  assert.doesNotMatch(summary, /Still in contact:/);
  assert.doesNotMatch(summary, /Organisations already contacted:/);

  const edited = callEditMaterial(generated, 'summary', 'Employee note.');
  assert.equal(edited.materials.status, 'draft');
  assert.equal(edited.materials.employeeEdited, true);

  const factEdited = callFactEdit(edited, 'amount', '500');
  assert.equal(factEdited.materials.status, 'needs-update');
  assert.equal(factEdited.materials.summary, 'Employee note.');
  assert.equal(factOf(factEdited, 'amount').value, '500');
  assert.equal(factOf(factEdited, 'amount').status, 'known');
});

test('regenerating without replaceExisting raises MATERIALS_REPLACE_REQUIRED and keeps the drafts', () => {
  const base = phishingCase();
  const generated = generate(base, materialPieces());
  const edited = callEditMaterial(generated, 'summary', 'Employee note.');

  const before = structuredClone(edited);
  assert.throws(
    () =>
      applyCourseProposal(
        edited,
        makeGenerateInput(materialPieces(), {}, { replaceExisting: false }),
      ),
    (error: unknown) =>
      error instanceof CourseContractError &&
      error.code === 'MATERIALS_REPLACE_REQUIRED' &&
      error.message === 'MATERIALS_REPLACE_REQUIRED',
  );
  assert.equal(JSON.stringify(edited), JSON.stringify(before));
  assert.equal(edited.materials.summary, 'Employee note.');
});

test('a message turn still succeeds with existing drafts when replaceExisting is false', () => {
  const base = phishingCase();
  const generated = generate(base, materialPieces());
  const edited = callEditMaterial(generated, 'summary', 'Employee note.');

  const result = callProposal(
    edited,
    makeMessageInput(
      'The amount is 500 AUD.',
      {
        understoodAs: 'correction',
        factChanges: [{ key: 'amount', value: '500', certainty: 'stated', evidence: '500' }],
      },
      { replaceExisting: false },
    ),
  );

  assert.equal(factOf(result, 'amount').value, '500');
  assert.equal(result.materials.status, 'needs-update');
  assert.equal(result.materials.summary, 'Employee note.');
  assert.equal(result.materials.employeeEdited, true);
});

test('replaceExisting true replaces the draft text and clears employeeEdited', () => {
  const base = phishingCase();
  const edited = callEditMaterial(
    generate(base, materialPieces({ summaryNarrative: 'The first summary sentence.' })),
    'summary',
    'Employee note.',
  );

  const replaced = generate(
    edited,
    materialPieces({
      summaryNarrative: 'The second summary sentence.',
      personWhatHappened: 'You told us a different description of what happened.',
    }),
    {},
    { replaceExisting: true },
  );

  assert.equal(replaced.materials.status, 'draft');
  assert.equal(replaced.materials.employeeEdited, false);
  assert.match(replaced.materials.summary, /The second summary sentence\./);
  assert.doesNotMatch(replaced.materials.summary, /Employee note\./);
  assert.match(replaced.materials.personExplanation, /a different description/);
});

test('confirmed materials return to draft on a later edit', () => {
  const generated = generate(phishingCase(), materialPieces());
  const confirmed = callConfirmMaterials(generated);
  assert.equal(confirmed.materials.status, 'confirmed');

  const edited = callEditMaterial(
    confirmed,
    'personExplanation',
    'Updated explanation for the person.',
  );
  assert.equal(edited.materials.status, 'draft');
  assert.equal(edited.materials.employeeEdited, true);
  assert.equal(edited.materials.summary, confirmed.materials.summary);
  assert.equal(edited.materials.personExplanation, 'Updated explanation for the person.');

  const stale = callFactEdit(edited, 'amount', '300');
  const stillStale = callEditMaterial(stale, 'summary', 'Later note.');
  assert.equal(stillStale.materials.status, 'needs-update');
});

test('handoverRecipient only crosses a bank report to telecom and a telecom report to a bank', () => {
  const emailPayment = openCase();
  recordFact(emailPayment, 'contactChannel', 'Email');
  recordFact(emailPayment, 'amount', '2,000');
  emailPayment.types = [
    {
      label: 'Suspected payment redirection',
      reason: 'New payment details arrived by email.',
      evidence: 'The supplier emailed new payment details.',
    },
  ];
  assert.equal(callHandoverRecipient(emailPayment), null);
  const emailMaterials = callComposeMaterials(
    emailPayment,
    materialPieces({
      handoverReason: 'The amount 2,000 AUD needs review.',
      handoverRequest: 'Please check the payment.',
      handoverGuidelineId: 'DEMO-G04',
    }),
  );
  assert.equal(emailMaterials.handover, null);

  const bankSms = phishingCase('bank');
  assert.equal(callHandoverRecipient(bankSms), 'telecom');
  const telecomHandover = callComposeMaterials(
    bankSms,
    materialPieces({ handoverReason: 'The message asked for a one-time code.' }),
  ).handover;
  assert.ok(telecomHandover);
  assert.match(telecomHandover, /^HANDOVER DRAFT/);
  assert.match(telecomHandover, /Recipient: SYN Telecom B intake team/);
  assert.match(telecomHandover, /Reason: The message asked for a one-time code\./);

  const phoneOnlyBank = openCase();
  recordFact(phoneOnlyBank, 'contactChannel', 'Phone call');
  phoneOnlyBank.types = [
    {
      label: 'Suspected phishing',
      reason: 'A caller asked for details.',
      evidence: 'The person received a call.',
    },
  ];
  assert.equal(callHandoverRecipient(phoneOnlyBank), 'telecom');

  const telecomBank = phishingCase('telecom');
  assert.equal(callHandoverRecipient(telecomBank), 'bank');
  const bankHandover = callComposeMaterials(
    telecomBank,
    materialPieces({
      handoverReason: 'The amount 2,000 AUD was reported.',
      handoverRequest: 'Please review the reported payment.',
    }),
  ).handover;
  assert.ok(bankHandover);
  assert.match(bankHandover, /Recipient: SYN Bank A intake team/);
  assert.match(
    bankHandover,
    /Please assess the reported concern within your organisation's responsibilities\./,
  );
  assert.doesNotMatch(bankHandover, /The amount 2,000 AUD was reported/);

  const noTelecomClue = createCourseCase('telecom');
  noTelecomClue.phase = 'open';
  recordFact(noTelecomClue, 'contactChannel', 'Email');
  noTelecomClue.types = [
    {
      label: 'Suspected phishing',
      reason: 'The email looked suspicious.',
      evidence: 'The person received an email.',
    },
  ];
  assert.equal(callHandoverRecipient(noTelecomClue), null);

  const insufficientOnly = createCourseCase('bank');
  insufficientOnly.phase = 'open';
  recordFact(insufficientOnly, 'contactChannel', 'SMS');
  recordFact(insufficientOnly, 'amount', '2,000');
  insufficientOnly.types = [
    {
      label: 'Insufficient information',
      reason: 'The report is limited.',
      evidence: 'The report is limited.',
    },
  ];
  assert.equal(callHandoverRecipient(insufficientOnly), null);

  const noTypes = createCourseCase('bank');
  noTypes.phase = 'open';
  recordFact(noTypes, 'contactChannel', 'SMS');
  assert.equal(callHandoverRecipient(noTypes), null);

  const bankClueOnly = openCase();
  recordFact(bankClueOnly, 'amount', '2,000');
  bankClueOnly.types = [
    {
      label: 'Suspected investment scam',
      reason: 'An investment was offered.',
      evidence: 'The person was offered an investment.',
    },
  ];
  assert.equal(callHandoverRecipient(bankClueOnly), null);
});

test('support case keeps the vulnerability text and drops staff instructions from the person material', () => {
  const generated = generate(
    supportCase(),
    materialPieces({
      personNextSteps: [
        'Ask the employee to check the account.',
        'Tell the bank to freeze the account.',
        'Record the amount in the system.',
        'Instruct the person to call back later.',
        'The staff should contact the provider.',
        'The employee should confirm the details.',
        'You can keep the message on your phone.',
      ],
      personSupport: 'A support person can speak with you.',
    }),
  );

  const explanation = generated.materials.personExplanation;
  const summary = generated.materials.summary;
  assert.match(explanation, /^EXPLANATION FOR THE AFFECTED PERSON/);
  assert.match(explanation, /Thank you for telling us what happened\./);
  assert.match(explanation, /You told us: feeling overwhelmed\./);
  assert.match(explanation, /You can keep the message on your phone\./);
  assert.match(explanation, /Support: A support person can speak with you\./);
  assert.doesNotMatch(explanation, /Ask the employee/);
  assert.doesNotMatch(explanation, /Tell the bank/);
  assert.doesNotMatch(explanation, /Record the amount/);
  assert.doesNotMatch(explanation, /Instruct the person/);
  assert.doesNotMatch(explanation, /staff should/i);
  assert.doesNotMatch(explanation, /the employee should/i);
  assert.doesNotMatch(explanation, /Recorded amount/);
  assert.equal(generated.materials.handover, null);
  assert.doesNotMatch(summary, /Unknown Unknown/);
  assert.match(summary, /Urgency cue: Unknown/);
  assert.doesNotMatch(summary, /Reported amount:/);
  assert.match(summary, /Basis: fictional DEMO-G03\./);

  const fallback = generate(
    supportCase(),
    materialPieces({ personNextSteps: ['Ask the employee to check the account.'] }),
  );
  assert.match(
    fallback.materials.personExplanation,
    /You can review this explanation and tell us what is missing or incorrect\./,
  );
});

test('a generate turn with no material sentences throws and leaves the case unchanged', () => {
  const base = phishingCase();
  expectProposalContractError(base, makeGenerateInput(null), 'MATERIALS_REQUIRED');
  expectProposalContractError(
    base,
    makeGenerateInput(null, { understoodAs: 'generate-request' }, { replaceExisting: true }),
    'MATERIALS_REQUIRED',
  );

  const generated = generate(base, materialPieces());
  expectProposalContractError(
    generated,
    makeGenerateInput(null, {}, { replaceExisting: true }),
    'MATERIALS_REQUIRED',
  );
});

test('purpose generate ignores the generate-request intent and builds a draft', () => {
  const base = phishingCase();
  base.questions.push(pendingQuestion('Q1'));
  base.attention = [
    {
      kind: 'urgency',
      text: 'The message asked the person to act quickly.',
      evidence: 'The person received a text message.',
    },
  ];

  const generated = generate(
    base,
    materialPieces({ summaryNarrative: 'The message asked for a code.' }),
    {
      understoodAs: 'generate-request',
      reply: 'Draft prepared.',
      factChanges: [{ key: 'amount', value: '999', certainty: 'stated', evidence: '999' }],
      questionUpdates: [{ questionId: 'Q1', result: 'answered', evidence: '999' }],
      types: [
        {
          label: 'Suspected remote access scam',
          reason: 'The report describes remote access.',
          evidence: 'Generate materials.',
        },
      ],
    },
  );

  assert.equal(generated.materials.status, 'draft');
  assert.match(generated.materials.summary, /FICTIONAL COURSE CASE/);
  assert.match(generated.materials.summary, /The message asked for a code\./);
  assert.match(generated.materials.summary, /Suspected remote access scam/);
  assert.doesNotMatch(generated.materials.summary, /Suspected phishing/);
  assert.equal(generated.materials.employeeEdited, false);
  assert.equal(factOf(generated, 'amount').value, '2,000');
  assert.equal(generated.questions[0].status, 'pending');
  assert.equal(generated.attention.length, 1);
});

test('composeMaterials builds clarified information and remaining gaps from the case only', () => {
  const base = phishingCase();
  const questions: CourseQuestion[] = [
    {
      id: 'Q1',
      text: 'What was the amount?',
      purpose: 'Clarify the reported amount',
      relatedKeys: ['amount'],
      status: 'answered',
      answerText: '2,000',
    },
    {
      id: 'Q2',
      text: 'Was the transaction completed?',
      purpose: 'Clarify the transaction status',
      relatedKeys: ['transactionStatus'],
      status: 'pending',
      answerText: null,
    },
    {
      id: 'Q3',
      text: 'Did you keep the message?',
      purpose: 'Clarify the evidence',
      relatedKeys: ['evidenceAvailable'],
      status: 'skipped',
      answerText: null,
    },
  ];
  base.questions = questions;
  factOf(base, 'amount').uncertainty = 'The person is not sure about the exact amount.';
  factOf(base, 'contactChannel').pendingConflict = {
    value: 'Email',
    evidence: 'It might have been an email.',
  };

  const materials = callComposeMaterials(
    base,
    materialPieces({ summaryNarrative: 'A qualitative summary without figures.' }),
  );
  const summary = materials.summary;

  assert.equal(materials.status, 'draft');
  assert.equal(materials.employeeEdited, false);
  assert.match(summary, /A qualitative summary without figures\./);

  const headings = [
    'FICTIONAL COURSE CASE',
    'Receiving role: Bank intake officer',
    'CASE SUMMARY',
    'CANDIDATE TYPES',
    'REPORTED FACTS',
    'CLARIFIED INFORMATION',
    'REMAINING GAPS',
    'NEXT STEP',
    'Basis: fictional DEMO-G01.',
    'Local draft only. No action or referral has been completed.',
  ];
  let previousIndex = -1;
  for (const heading of headings) {
    const index = summary.indexOf(heading);
    assert.ok(index > previousIndex, `heading out of order: ${heading}`);
    previousIndex = index;
  }

  assert.match(summary, /Question 1: 2,000/);
  assert.match(summary, /Question 2 is still pending: Was the transaction completed\?/);
  assert.match(summary, /Question 3 was skipped: Did you keep the message\?/);
  assert.match(
    summary,
    /Reported amount needs confirmation: The person is not sure about the exact amount\./,
  );
  assert.match(summary, /Contact channel has not been confirmed: Email was also reported\./);
  assert.match(summary, /Evidence the person can provide: Unknown/);
  assert.match(summary, /Evidence the person can provide has not been recorded\./);
  assert.doesNotMatch(summary, /Still in contact:/);
  assert.match(summary, /- Have a human reviewer assess the reported payment concern\./);
});

test('editMaterialText rejects unknown parts and cases without drafts, and changes only the requested part', () => {
  expectEditMaterialError(openCase(), 'summary', 'Note.');

  const generated = generate(phishingCase(), materialPieces());
  expectEditMaterialError(generated, 'extra' as 'summary', 'Note.');

  const edited = callEditMaterial(generated, 'handover', 'Edited handover text.');
  assert.equal(edited.materials.handover, 'Edited handover text.');
  assert.equal(edited.materials.summary, generated.materials.summary);
  assert.equal(edited.materials.personExplanation, generated.materials.personExplanation);
  assert.equal(edited.materials.employeeEdited, true);
  assert.equal(edited.materials.status, 'draft');

  const summaryEdit = callEditMaterial(generated, 'summary', 'Edited summary text.');
  assert.equal(summaryEdit.materials.personExplanation, generated.materials.personExplanation);
  assert.equal(summaryEdit.materials.handover, generated.materials.handover);
});

test('confirmMaterials only accepts draft materials', () => {
  expectConfirmMaterialsError(openCase());

  const generated = generate(phishingCase(), materialPieces());
  const stale = callFactEdit(generated, 'amount', '300');
  assert.equal(stale.materials.status, 'needs-update');
  expectConfirmMaterialsError(stale);

  const confirmed = callConfirmMaterials(generated);
  assert.equal(confirmed.materials.status, 'confirmed');
  assert.equal(confirmed.materials.employeeEdited, false);
  assert.equal(confirmed.materials.summary, generated.materials.summary);
  expectConfirmMaterialsError(confirmed);
});
