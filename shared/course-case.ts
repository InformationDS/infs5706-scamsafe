import { z } from 'zod';

const ROLE_IDS = ['bank', 'telecom'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

const FACT_KEYS = [
  'contactChannel',
  'contactTime',
  'claimedIdentity',
  'reportedAction',
  'amount',
  'currency',
  'transactionStatus',
  'involvedOrganisation',
  'sharedInformation',
  'affectedService',
  'observedIssue',
  'stillInContact',
  'actionsTaken',
  'organisationsContacted',
  'evidenceAvailable',
  'urgencyCue',
  'vulnerabilityCue',
] as const;
export type FactKey = (typeof FACT_KEYS)[number];

const FACT_GROUPS = ['event', 'money', 'account', 'current', 'support'] as const;
export type FactGroup = (typeof FACT_GROUPS)[number];

const ALLOWED_TYPES = [
  'Suspected investment scam',
  'Suspected payment redirection',
  'Suspected romance scam',
  'Suspected phishing',
  'Suspected remote access scam',
  'Other',
  'Insufficient information',
] as const;
export type AllowedType = (typeof ALLOWED_TYPES)[number];

const GUIDELINE_IDS = ['DEMO-G01', 'DEMO-G02', 'DEMO-G03', 'DEMO-G04'] as const;
export type GuidelineId = (typeof GUIDELINE_IDS)[number];

export type CourseFact = {
  key: FactKey;
  label: string;
  group: FactGroup;
  value: string | null;
  status: 'unset' | 'known' | 'unknown';
  uncertainty: string | null;
  evidence: string | null;
  origin: 'unset' | 'narrative' | 'answer' | 'correction' | 'employee-edit';
  pendingConflict: null | { value: string; evidence: string };
};

export type CourseQuestion = {
  id: 'Q1' | 'Q2' | 'Q3';
  text: string;
  purpose: string;
  relatedKeys: FactKey[];
  status: 'pending' | 'answered' | 'unknown' | 'skipped' | 'not-applicable';
  answerText: string | null;
};

export type CourseRecommendation = {
  id: 'R1' | 'R2' | 'R3' | 'R4';
  guidelineId: GuidelineId;
  organisation: string;
  priority: 'now' | 'later';
  audience: 'this-organisation' | 'other-organisation' | 'human-judgement';
  action: string;
  reason: string;
};

export type CourseMaterials = {
  status: 'not-generated' | 'draft' | 'confirmed' | 'needs-update';
  employeeEdited: boolean;
  summary: string;
  personExplanation: string;
  handover: string | null;
};

export type CourseMessage = {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  status: 'complete' | 'failed';
};

export type CourseCase = {
  role: { id: RoleId; title: string; responsibilities: string };
  phase: 'new' | 'open';
  facts: CourseFact[];
  questions: CourseQuestion[];
  questionsEnded: boolean;
  types: Array<{ label: AllowedType; reason: string; evidence: string }>;
  attention: Array<{
    kind: 'urgency' | 'vulnerability' | 'human-support';
    text: string;
    evidence: string;
  }>;
  recommendations: CourseRecommendation[];
  materials: CourseMaterials;
  messages: CourseMessage[];
  messageSeq: number;
};

export type TurnProposal = {
  understoodAs:
    | 'initial-report'
    | 'answer'
    | 'multi-answer'
    | 'query'
    | 'correction'
    | 'uncertainty'
    | 'supplement'
    | 'skip-request'
    | 'end-request'
    | 'generate-request'
    | 'other';
  reply: string;
  factChanges: Array<{
    key: FactKey;
    value: string | null;
    certainty: 'stated' | 'uncertain' | 'unknown';
    evidence: string;
  }>;
  questionUpdates: Array<{
    questionId: 'Q1' | 'Q2' | 'Q3';
    result: 'answered' | 'unknown' | 'skipped' | 'not-applicable';
    evidence: string;
  }>;
  proposedQuestions: Array<{
    id: 'Q1' | 'Q2' | 'Q3';
    text: string;
    purpose: string;
    relatedKeys: FactKey[];
  }>;
  types: CourseCase['types'] | null;
  attention: CourseCase['attention'] | null;
  recommendations: CourseRecommendation[] | null;
  materials: null | {
    summaryNarrative: string;
    personWhatHappened: string;
    personNextSteps: string[];
    personSupport: string | null;
    handoverReason: string | null;
    handoverRequest: string | null;
    handoverGuidelineId: GuidelineId | null;
  };
};

export type CourseProposalInput = {
  userText: string;
  purpose: 'message' | 'generate';
  replaceExisting: boolean;
  retryMessageId: string | null;
  proposal: TurnProposal;
};

export type CourseTurnRequest = {
  case: CourseCase;
  userText: string;
  purpose: 'message' | 'generate';
  replaceExisting: boolean;
  retryMessageId: string | null;
};

export type CourseFailedTurnInput = {
  userText: string;
  errorMessage: string;
  retryMessageId: string | null;
};

export class CourseContractError extends Error {
  readonly code: string;

  constructor(code: string, message: string = code) {
    super(message);
    this.name = 'CourseContractError';
    this.code = code;
  }
}

type FactCatalogEntry = { readonly key: FactKey; readonly label: string; readonly group: FactGroup };

export const FACT_CATALOG: readonly FactCatalogEntry[] = [
  { key: 'contactChannel', label: 'Contact channel', group: 'event' },
  { key: 'contactTime', label: 'Contact time', group: 'event' },
  { key: 'claimedIdentity', label: 'Claimed identity', group: 'event' },
  { key: 'reportedAction', label: 'Reported action', group: 'event' },
  { key: 'amount', label: 'Reported amount', group: 'money' },
  { key: 'currency', label: 'Currency', group: 'money' },
  { key: 'transactionStatus', label: 'Transaction status', group: 'money' },
  { key: 'involvedOrganisation', label: 'Organisation involved', group: 'money' },
  { key: 'sharedInformation', label: 'Information shared', group: 'account' },
  { key: 'affectedService', label: 'Affected service', group: 'account' },
  { key: 'observedIssue', label: 'Observed issue', group: 'account' },
  { key: 'stillInContact', label: 'Still in contact', group: 'current' },
  { key: 'actionsTaken', label: 'Actions already taken', group: 'current' },
  { key: 'organisationsContacted', label: 'Organisations already contacted', group: 'current' },
  { key: 'evidenceAvailable', label: 'Evidence the person can provide', group: 'support' },
  { key: 'urgencyCue', label: 'Urgency cue', group: 'support' },
  { key: 'vulnerabilityCue', label: 'Vulnerability or support need', group: 'support' },
];

export const ROLES = {
  bank: {
    id: 'bank',
    title: 'Bank intake officer',
    responsibilities:
      'Understand reported account, payment and credential concerns. Prepare a local summary and only the handovers supported by the report. Do not freeze an account or promise a refund.',
  },
  telecom: {
    id: 'telecom',
    title: 'Telecom intake officer',
    responsibilities:
      'Understand reported suspicious calls or messages. Prepare a local summary and a bank handover only when the report includes an account or payment concern. Do not change a phone service or assume the provider sent the message.',
  },
} as const satisfies Record<RoleId, CourseCase['role']>;

const RoleIdSchema = z.enum(ROLE_IDS);
const FactKeySchema = z.enum(FACT_KEYS);
const FactGroupSchema = z.enum(FACT_GROUPS);
const AllowedTypeSchema = z.enum(ALLOWED_TYPES);
const GuidelineIdSchema = z.enum(GUIDELINE_IDS);

const CourseFactSchema = z
  .object({
    key: FactKeySchema,
    label: z.string(),
    group: FactGroupSchema,
    value: z.string().nullable(),
    status: z.enum(['unset', 'known', 'unknown']),
    uncertainty: z.string().nullable(),
    evidence: z.string().nullable(),
    origin: z.enum(['unset', 'narrative', 'answer', 'correction', 'employee-edit']),
    pendingConflict: z
      .object({ value: z.string(), evidence: z.string() })
      .strict()
      .nullable(),
  })
  .strict();

const CourseQuestionSchema = z
  .object({
    id: z.enum(['Q1', 'Q2', 'Q3']),
    text: z.string(),
    purpose: z.string(),
    relatedKeys: z.array(FactKeySchema),
    status: z.enum(['pending', 'answered', 'unknown', 'skipped', 'not-applicable']),
    answerText: z.string().nullable(),
  })
  .strict();

const CourseRecommendationSchema = z
  .object({
    id: z.enum(['R1', 'R2', 'R3', 'R4']),
    guidelineId: GuidelineIdSchema,
    organisation: z.string(),
    priority: z.enum(['now', 'later']),
    audience: z.enum(['this-organisation', 'other-organisation', 'human-judgement']),
    action: z.string(),
    reason: z.string(),
  })
  .strict();

const CourseMaterialsSchema = z
  .object({
    status: z.enum(['not-generated', 'draft', 'confirmed', 'needs-update']),
    employeeEdited: z.boolean(),
    summary: z.string(),
    personExplanation: z.string(),
    handover: z.string().nullable(),
  })
  .strict();

const CourseMessageSchema = z
  .object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'error']),
    text: z.string(),
    status: z.enum(['complete', 'failed']),
  })
  .strict();

export const CourseCaseSchema = z
  .object({
    role: z
      .object({
        id: RoleIdSchema,
        title: z.string(),
        responsibilities: z.string(),
      })
      .strict(),
    phase: z.enum(['new', 'open']),
    facts: z.array(CourseFactSchema),
    questions: z.array(CourseQuestionSchema),
    questionsEnded: z.boolean(),
    types: z.array(
      z
        .object({
          label: AllowedTypeSchema,
          reason: z.string(),
          evidence: z.string(),
        })
        .strict(),
    ),
    attention: z.array(
      z
        .object({
          kind: z.enum(['urgency', 'vulnerability', 'human-support']),
          text: z.string(),
          evidence: z.string(),
        })
        .strict(),
    ),
    recommendations: z.array(CourseRecommendationSchema),
    materials: CourseMaterialsSchema,
    messages: z.array(CourseMessageSchema),
    messageSeq: z.number().int().nonnegative(),
  })
  .strict();

const UNDERSTOOD_AS = [
  'initial-report',
  'answer',
  'multi-answer',
  'query',
  'correction',
  'uncertainty',
  'supplement',
  'skip-request',
  'end-request',
  'generate-request',
  'other',
] as const;

const ProposalFactChangeSchema = z
  .object({
    key: FactKeySchema,
    value: z.string().nullable(),
    certainty: z.enum(['stated', 'uncertain', 'unknown']),
    evidence: z.string().min(1).max(400),
  })
  .strict();

const ProposalQuestionUpdateSchema = z
  .object({
    questionId: z.enum(['Q1', 'Q2', 'Q3']),
    result: z.enum(['answered', 'unknown', 'skipped', 'not-applicable']),
    evidence: z.string().min(1).max(400),
  })
  .strict();

const ProposalQuestionSchema = z
  .object({
    id: z.enum(['Q1', 'Q2', 'Q3']),
    text: z.string().min(8).max(240),
    purpose: z.string().min(1).max(400),
    relatedKeys: z.array(FactKeySchema),
  })
  .strict();

const ProposalTypeSchema = z
  .object({
    label: AllowedTypeSchema,
    reason: z.string().min(1).max(400),
    evidence: z.string().min(1).max(400),
  })
  .strict();

const ProposalAttentionSchema = z
  .object({
    kind: z.enum(['urgency', 'vulnerability', 'human-support']),
    text: z.string().min(1).max(400),
    evidence: z.string().min(1).max(400),
  })
  .strict();

const ProposalRecommendationSchema = z
  .object({
    id: z.enum(['R1', 'R2', 'R3', 'R4']),
    guidelineId: GuidelineIdSchema,
    organisation: z.string().min(1).max(400),
    priority: z.enum(['now', 'later']),
    audience: z.enum(['this-organisation', 'other-organisation', 'human-judgement']),
    action: z.string().min(1).max(400),
    reason: z.string().min(1).max(400),
  })
  .strict();

const ProposalMaterialsSchema = z
  .object({
    summaryNarrative: z.string().min(1).max(400),
    personWhatHappened: z.string().min(1).max(400),
    personNextSteps: z.array(z.string().min(1).max(400)),
    personSupport: z.string().min(1).max(400).nullable(),
    handoverReason: z.string().min(1).max(400).nullable(),
    handoverRequest: z.string().min(1).max(400).nullable(),
    handoverGuidelineId: GuidelineIdSchema.nullable(),
  })
  .strict();

export const TurnProposalSchema = z
  .object({
    understoodAs: z.enum(UNDERSTOOD_AS),
    reply: z.string().min(1).max(1200),
    factChanges: z.array(ProposalFactChangeSchema).max(12),
    questionUpdates: z.array(ProposalQuestionUpdateSchema).max(3),
    proposedQuestions: z.array(ProposalQuestionSchema).max(3),
    types: z.array(ProposalTypeSchema).max(3).nullable(),
    attention: z.array(ProposalAttentionSchema).max(4).nullable(),
    recommendations: z.array(ProposalRecommendationSchema).max(4).nullable(),
    materials: ProposalMaterialsSchema.nullable(),
  })
  .strict();

export const CourseTurnRequestSchema = z
  .object({
    case: CourseCaseSchema,
    userText: z.string().min(1).max(8000),
    purpose: z.enum(['message', 'generate']),
    replaceExisting: z.boolean(),
    retryMessageId: z.string().nullable(),
  })
  .strict();

export function createCourseCase(role: RoleId): CourseCase {
  const roleRecord = ROLES[role];
  return {
    role: {
      id: roleRecord.id,
      title: roleRecord.title,
      responsibilities: roleRecord.responsibilities,
    },
    phase: 'new',
    facts: FACT_CATALOG.map(({ key, label, group }) => ({
      key,
      label,
      group,
      value: null,
      status: 'unset',
      uncertainty: null,
      evidence: null,
      origin: 'unset',
      pendingConflict: null,
    })),
    questions: [],
    questionsEnded: false,
    types: [],
    attention: [],
    recommendations: [],
    materials: {
      status: 'not-generated',
      employeeEdited: false,
      summary: '',
      personExplanation: '',
      handover: null,
    },
    messages: [],
    messageSeq: 1,
  };
}

export function visibleFacts(courseCase: CourseCase): CourseFact[] {
  return courseCase.facts.filter(
    (fact) =>
      fact.status === 'known' ||
      fact.status === 'unknown' ||
      fact.uncertainty !== null ||
      fact.pendingConflict !== null,
  );
}

export function caseStatusLabel(courseCase: CourseCase): string {
  if (courseCase.phase === 'new') return 'New case';
  if (courseCase.materials.status === 'needs-update') return 'Needs update';
  if (courseCase.materials.status === 'confirmed') return 'Materials confirmed';
  if (courseCase.materials.status === 'draft') return 'Draft materials';
  if (courseCase.questions.some((question) => question.status === 'pending')) return 'Clarifying case';
  return 'Case in progress';
}

const normalizeEvidence = (value: string): string => value.replace(/\s+/g, ' ').trim();

function evidenceInSources(sources: readonly string[], evidence: string): boolean {
  const normalizedEvidence = normalizeEvidence(evidence);
  if (!normalizedEvidence) return false;
  return sources.some((source) => normalizeEvidence(source).includes(normalizedEvidence));
}

function assertEvidenceIn(label: string, sources: readonly string[], evidence: string): void {
  if (!evidenceInSources(sources, evidence)) {
    throw new CourseContractError(
      'EVIDENCE_NOT_IN_TEXT',
      `${label} evidence is not supported by this message or the saved case.`,
    );
  }
}

function factStateSignature(facts: readonly CourseFact[]): string {
  return JSON.stringify(
    facts.map((fact) => [fact.key, fact.value, fact.status, fact.uncertainty, fact.pendingConflict]),
  );
}

function questionStateSignature(questions: readonly CourseQuestion[]): string {
  return JSON.stringify(
    questions.map((question) => [question.id, question.status, question.answerText]),
  );
}

function nextMessageId(courseCase: CourseCase): string {
  const id = `m${courseCase.messageSeq}`;
  courseCase.messageSeq += 1;
  return id;
}

function reuseOrAppendUserMessage(
  courseCase: CourseCase,
  userText: string,
  retryMessageId: string | null,
  status: CourseMessage['status'],
): void {
  if (retryMessageId) {
    const retryIndex = courseCase.messages.findIndex(
      (message) =>
        message.id === retryMessageId && message.role === 'user' && message.status === 'failed',
    );
    if (retryIndex >= 0) {
      const retried = courseCase.messages[retryIndex];
      retried.text = userText;
      retried.status = status;
      const following = courseCase.messages[retryIndex + 1];
      if (following && following.role === 'error') courseCase.messages.splice(retryIndex + 1, 1);
      return;
    }
  }
  courseCase.messages.push({ id: nextMessageId(courseCase), role: 'user', text: userText, status });
}

function buildAssistantText(
  reply: string,
  questionCount: string | null,
  nextStep: string,
): string {
  const filteredReply = reply
    .split(/\r?\n/)
    .filter((line) => !/question \d+ of \d+/i.test(line))
    .join('\n')
    .trim();
  return [filteredReply, questionCount, nextStep]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join('\n\n');
}

function markMaterialsStale(courseCase: CourseCase): void {
  if (courseCase.materials.status !== 'not-generated') {
    courseCase.materials.status = 'needs-update';
  }
}

function analysisEvidenceSources(courseCase: CourseCase, userText: string): string[] {
  const sources: string[] = [userText];
  for (const fact of courseCase.facts) {
    if (fact.evidence) sources.push(fact.evidence);
  }
  for (const message of courseCase.messages) {
    if (message.role !== 'error' && message.status === 'complete' && message.text) {
      sources.push(message.text);
    }
  }
  for (const type of courseCase.types) sources.push(type.evidence);
  for (const item of courseCase.attention) sources.push(item.evidence);
  return sources;
}

function applyProposedAnalysis(
  courseCase: CourseCase,
  proposal: TurnProposal,
  userText: string,
): void {
  const sources = analysisEvidenceSources(courseCase, userText);
  if (proposal.types !== null) {
    for (const type of proposal.types) assertEvidenceIn('Type', sources, type.evidence);
    courseCase.types = structuredClone(proposal.types);
  }
  if (proposal.attention !== null) {
    for (const item of proposal.attention) assertEvidenceIn('Attention', sources, item.evidence);
    courseCase.attention = structuredClone(proposal.attention);
  }
  if (proposal.recommendations !== null) {
    courseCase.recommendations = structuredClone(proposal.recommendations);
  }
}

function applyFactChange(
  courseCase: CourseCase,
  change: TurnProposal['factChanges'][number],
  intent: TurnProposal['understoodAs'],
  userText: string,
): void {
  const fact = courseCase.facts.find((candidate) => candidate.key === change.key);
  if (!fact) throw new CourseContractError('UNKNOWN_FACT', `Unknown fact key: ${change.key}`);
  assertEvidenceIn('Fact change', [userText], change.evidence);

  if (change.certainty !== 'stated') {
    fact.uncertainty = change.evidence;
    if (fact.status === 'unset') fact.status = 'unknown';
    return;
  }

  if (change.value === null || !change.value.trim()) {
    throw new CourseContractError(
      'INVALID_FACT_VALUE',
      `A stated change for ${change.key} needs a non-empty value.`,
    );
  }
  const value = change.value.trim();

  if (fact.status === 'known' && fact.value === value) {
    fact.evidence = change.evidence;
    return;
  }
  if (intent === 'correction') {
    fact.value = value;
    fact.status = 'known';
    fact.origin = 'correction';
    fact.evidence = change.evidence;
    fact.uncertainty = null;
    fact.pendingConflict = null;
    return;
  }
  if (fact.origin === 'correction' || fact.origin === 'employee-edit') {
    fact.pendingConflict = { value, evidence: change.evidence };
    return;
  }

  if (fact.origin === 'unset') {
    fact.origin = intent === 'initial-report' ? 'narrative' : 'answer';
  } else if (intent !== 'initial-report') {
    fact.origin = 'answer';
  }
  fact.value = value;
  fact.status = 'known';
  fact.evidence = change.evidence;
}

function applyQuestionUpdate(
  courseCase: CourseCase,
  update: TurnProposal['questionUpdates'][number],
  userText: string,
): void {
  const question = courseCase.questions.find((candidate) => candidate.id === update.questionId);
  if (!question || question.status !== 'pending') return;
  assertEvidenceIn('Question update', [userText], update.evidence);
  question.status = update.result;
  question.answerText = update.result === 'answered' ? update.evidence : null;
}

function skipFirstPendingQuestion(courseCase: CourseCase): void {
  const question = courseCase.questions.find((candidate) => candidate.status === 'pending');
  if (!question) return;
  question.status = 'skipped';
  question.answerText = null;
}

function endQuestions(courseCase: CourseCase): void {
  for (const question of courseCase.questions) {
    if (question.status === 'pending') {
      question.status = 'skipped';
      question.answerText = null;
    }
  }
  courseCase.questionsEnded = true;
}

export function buildNextStep(courseCase: CourseCase): string {
  if (courseCase.phase === 'new') {
    return 'Next: describe a case or load an example, then select Analyze case.';
  }

  const questions = courseCase.questions;
  const pendingIndex = questions.findIndex((question) => question.status === 'pending');
  if (pendingIndex >= 0) {
    const question = questions[pendingIndex];
    let nextStep = `Next: Question ${pendingIndex + 1} of ${questions.length}: ${question.text} You can answer, ask about the case, say you do not know, skip, or end clarification.`;
    if (courseCase.materials.status === 'needs-update') {
      nextStep +=
        ' Your existing drafts are preserved but need regeneration before confirmation or export.';
    } else if (
      courseCase.materials.status === 'draft' ||
      courseCase.materials.status === 'confirmed'
    ) {
      nextStep += ' You may also review the existing materials.';
    }
    return nextStep;
  }

  if (courseCase.materials.status === 'needs-update') {
    return 'Next: existing materials and your edits are preserved. Regenerate them before confirming or exporting, or continue clarifying the case.';
  }
  if (courseCase.materials.status === 'confirmed') {
    return 'Next: copy or download the selected material. You can also review another material or ask about the case.';
  }
  if (courseCase.materials.status === 'draft') {
    return 'Next: review and edit the drafts on the left, then Confirm materials to enable copy or download.';
  }
  if (questions.length > 0) {
    return 'Next: you can add or correct information, view guidance, or generate materials.';
  }
  return 'Next: review the case facts, view guidance, or generate materials.';
}

const TELECOM_CHANNEL_PATTERN = /sms|text message|phone|call/i;
const BANK_IDENTITY_PATTERN = /bank/i;
const BANK_CLUE_KEYS: readonly FactKey[] = [
  'amount',
  'sharedInformation',
  'observedIssue',
  'transactionStatus',
];
const GENERIC_HANDOVER_REASON =
  "Please assess the reported concern within your organisation's responsibilities.";

function knownFact(courseCase: CourseCase, key: FactKey): CourseFact | undefined {
  return courseCase.facts.find((fact) => fact.key === key && fact.status === 'known');
}

export function handoverRecipient(courseCase: CourseCase): 'bank' | 'telecom' | null {
  if (courseCase.types.length === 0) return null;
  if (courseCase.types.every((type) => type.label === 'Insufficient information')) return null;

  const channel = knownFact(courseCase, 'contactChannel');
  const telecomClue = Boolean(channel?.value && TELECOM_CHANNEL_PATTERN.test(channel.value));
  const identity = knownFact(courseCase, 'claimedIdentity');
  const bankClue =
    BANK_CLUE_KEYS.some((key) => knownFact(courseCase, key) !== undefined) ||
    Boolean(identity?.value && BANK_IDENTITY_PATTERN.test(identity.value));

  if (courseCase.role.id === 'bank' && telecomClue) return 'telecom';
  if (courseCase.role.id === 'telecom' && bankClue) return 'bank';
  return null;
}

function materialFactAppears(courseCase: CourseCase, fact: CourseFact): boolean {
  if (fact.status !== 'unset') return true;
  if (fact.uncertainty !== null || fact.pendingConflict !== null) return true;
  return courseCase.questions.some((question) => question.relatedKeys.includes(fact.key));
}

function materialFactLines(courseCase: CourseCase): string[] {
  return courseCase.facts
    .filter((fact) => materialFactAppears(courseCase, fact))
    .map((fact) => {
      const value = fact.status === 'known' ? fact.value?.trim() : undefined;
      return `- ${fact.label}: ${value ? value : 'Unknown'}`;
    });
}

function clarifiedInformationLines(courseCase: CourseCase): string[] {
  const lines: string[] = [];
  courseCase.questions.forEach((question, index) => {
    if (question.status !== 'answered') return;
    const answer = question.answerText?.trim();
    lines.push(`- Question ${index + 1}: ${answer ? answer : 'Answered.'}`);
  });
  return lines.length > 0 ? lines : ['- No additional information was clarified.'];
}

function remainingGapLines(courseCase: CourseCase): string[] {
  const lines: string[] = [];
  courseCase.questions.forEach((question, index) => {
    if (question.status === 'pending') {
      lines.push(`- Question ${index + 1} is still pending: ${question.text}`);
    } else if (question.status === 'unknown') {
      lines.push(`- Question ${index + 1} was answered as unknown: ${question.text}`);
    } else if (question.status === 'skipped') {
      lines.push(`- Question ${index + 1} was skipped: ${question.text}`);
    }
  });
  for (const fact of courseCase.facts) {
    if (fact.status === 'unknown') {
      lines.push(`- ${fact.label} is unknown.`);
    } else if (fact.status === 'unset' && materialFactAppears(courseCase, fact)) {
      lines.push(`- ${fact.label} has not been recorded.`);
    }
    if (fact.uncertainty !== null) {
      lines.push(`- ${fact.label} needs confirmation: ${fact.uncertainty}`);
    }
    if (fact.pendingConflict !== null) {
      lines.push(
        `- ${fact.label} has not been confirmed: ${fact.pendingConflict.value} was also reported.`,
      );
    }
  }
  return lines.length > 0 ? lines : ['- No remaining gaps were recorded.'];
}

function summaryNextStepLines(courseCase: CourseCase): string[] {
  if (courseCase.recommendations.length === 0) return ['- No next step was suggested.'];
  return courseCase.recommendations.map(
    (recommendation) =>
      `- ${recommendation.action} (${recommendation.organisation}; ${recommendation.priority})`,
  );
}

function summaryBasis(courseCase: CourseCase): string {
  const ids = [
    ...new Set(courseCase.recommendations.map((recommendation) => recommendation.guidelineId)),
  ];
  return ids.length > 0 ? ids.join(', ') : 'no guideline recorded';
}

function filterPersonNextSteps(steps: readonly string[]): string[] {
  const kept = steps
    .map((step) => step.trim())
    .filter((step) => step.length > 0)
    .filter((step) => !/^(ask|tell|record|instruct)/i.test(step))
    .filter((step) => !/staff should/i.test(step) && !/the employee should/i.test(step));
  return kept.length > 0
    ? kept
    : ['You can review this explanation and tell us what is missing or incorrect.'];
}

function composeSummary(
  courseCase: CourseCase,
  pieces: NonNullable<TurnProposal['materials']>,
): string {
  const narrative = /\d/.test(pieces.summaryNarrative)
    ? 'See the facts below.'
    : pieces.summaryNarrative;
  const typeLines =
    courseCase.types.length > 0
      ? courseCase.types.map((type) => `- ${type.label}: ${type.reason}`)
      : ['- No candidate type was recorded.'];
  const factLines = materialFactLines(courseCase);
  return [
    'FICTIONAL COURSE CASE',
    `Receiving role: ${courseCase.role.title}`,
    '',
    'CASE SUMMARY',
    narrative,
    '',
    'CANDIDATE TYPES',
    ...typeLines,
    '',
    'REPORTED FACTS',
    ...(factLines.length > 0 ? factLines : ['- No facts were recorded.']),
    '',
    'CLARIFIED INFORMATION',
    ...clarifiedInformationLines(courseCase),
    '',
    'REMAINING GAPS',
    ...remainingGapLines(courseCase),
    '',
    'NEXT STEP',
    ...summaryNextStepLines(courseCase),
    '',
    `Basis: fictional ${summaryBasis(courseCase)}.`,
    'Local draft only. No action or referral has been completed.',
  ].join('\n');
}

function composePersonExplanation(
  courseCase: CourseCase,
  pieces: NonNullable<TurnProposal['materials']>,
): string {
  const lines = [
    'EXPLANATION FOR THE AFFECTED PERSON',
    '',
    'Thank you for telling us what happened.',
    '',
    pieces.personWhatHappened,
  ];

  const vulnerability = knownFact(courseCase, 'vulnerabilityCue');
  const vulnerabilityValue = vulnerability?.value?.trim();
  if (vulnerabilityValue) lines.push('', `You told us: ${vulnerabilityValue}.`);

  const recordings: string[] = [];
  const amount = knownFact(courseCase, 'amount')?.value?.trim();
  if (amount) recordings.push(`Recorded amount: ${amount}.`);
  const currency = knownFact(courseCase, 'currency')?.value?.trim();
  if (currency) recordings.push(`Recorded currency: ${currency}.`);
  const transactionStatus = knownFact(courseCase, 'transactionStatus')?.value?.trim();
  if (transactionStatus) recordings.push(`Recorded transaction status: ${transactionStatus}.`);
  if (recordings.length > 0) lines.push('', ...recordings);

  lines.push(
    '',
    'What you can do next:',
    ...filterPersonNextSteps(pieces.personNextSteps).map((step) => `- ${step}`),
  );
  if (pieces.personSupport) lines.push('', `Support: ${pieces.personSupport}`);
  return lines.join('\n');
}

function composeHandover(
  courseCase: CourseCase,
  pieces: NonNullable<TurnProposal['materials']>,
  recipient: 'bank' | 'telecom' | null,
): string | null {
  if (recipient === null) return null;
  const team =
    recipient === 'telecom' ? 'SYN Telecom B intake team' : 'SYN Bank A intake team';
  const reason =
    pieces.handoverReason && !/\d/.test(pieces.handoverReason)
      ? pieces.handoverReason
      : GENERIC_HANDOVER_REASON;
  const factLines = materialFactLines(courseCase);
  const lines = [
    'HANDOVER DRAFT',
    `Recipient: ${team}`,
    '',
    'REPORTED FACTS',
    ...(factLines.length > 0 ? factLines : ['- No facts were recorded.']),
    '',
    `Reason: ${reason}`,
  ];
  if (pieces.handoverRequest) lines.push(`Request: ${pieces.handoverRequest}`);
  if (pieces.handoverGuidelineId) {
    lines.push('', `Basis: fictional ${pieces.handoverGuidelineId}.`);
  }
  lines.push('', 'Local draft only. No action or referral has been completed.');
  return lines.join('\n');
}

export function composeMaterials(
  courseCase: CourseCase,
  pieces: NonNullable<TurnProposal['materials']>,
): CourseMaterials {
  return {
    status: 'draft',
    employeeEdited: false,
    summary: composeSummary(courseCase, pieces),
    personExplanation: composePersonExplanation(courseCase, pieces),
    handover: composeHandover(courseCase, pieces, handoverRecipient(courseCase)),
  };
}

export function editMaterialText(
  courseCase: CourseCase,
  part: 'summary' | 'personExplanation' | 'handover',
  text: string,
): CourseCase {
  if (part !== 'summary' && part !== 'personExplanation' && part !== 'handover') {
    throw new CourseContractError(
      'INVALID_MATERIAL_PART',
      `Unsupported material part: ${String(part)}`,
    );
  }
  const next = structuredClone(courseCase);
  if (next.materials.status === 'not-generated') {
    throw new CourseContractError(
      'MATERIALS_NOT_GENERATED',
      'There are no generated materials to edit.',
    );
  }
  next.materials[part] = text;
  next.materials.employeeEdited = true;
  if (next.materials.status === 'confirmed') next.materials.status = 'draft';
  return next;
}

export function confirmMaterials(courseCase: CourseCase): CourseCase {
  const next = structuredClone(courseCase);
  if (next.materials.status !== 'draft') {
    throw new CourseContractError(
      'MATERIALS_NOT_DRAFT',
      'Only draft materials can be confirmed.',
    );
  }
  next.materials.status = 'confirmed';
  return next;
}

export function applyEmployeeFactEdit(
  courseCase: CourseCase,
  key: FactKey,
  rawValue: string,
): CourseCase {
  const next = structuredClone(courseCase);
  const fact = next.facts.find((candidate) => candidate.key === key);
  if (!fact) throw new CourseContractError('UNKNOWN_FACT', `Unknown fact key: ${key}`);
  const trimmed = rawValue.trim();
  const unknown = trimmed === '' || trimmed.toLowerCase() === 'unknown';
  fact.status = unknown ? 'unknown' : 'known';
  fact.value = unknown ? null : trimmed;
  fact.origin = 'employee-edit';
  fact.uncertainty = null;
  fact.pendingConflict = null;
  markMaterialsStale(next);
  return next;
}

export function applyClientAction(
  courseCase: CourseCase,
  action: 'unknown' | 'skip' | 'end',
): CourseCase {
  if (action !== 'unknown' && action !== 'skip' && action !== 'end') {
    throw new CourseContractError(
      'INVALID_CLIENT_ACTION',
      `Unsupported client action: ${String(action)}`,
    );
  }
  const next = structuredClone(courseCase);
  let reply: string;

  if (action === 'end') {
    endQuestions(next);
    reply = 'Clarification ended. Unanswered items remain unknown.';
  } else {
    const index = next.questions.findIndex((question) => question.status === 'pending');
    if (index < 0) {
      throw new CourseContractError('NO_PENDING_QUESTION', 'There is no pending question to update.');
    }
    const question = next.questions[index];
    question.status = action === 'unknown' ? 'unknown' : 'skipped';
    question.answerText = null;
    const verb = action === 'unknown' ? 'marked unknown' : 'marked skipped';
    reply = `Question ${index + 1} ${verb}. No fact was inferred.`;
  }

  markMaterialsStale(next);
  next.messages.push({
    id: nextMessageId(next),
    role: 'assistant',
    text: [reply, buildNextStep(next)].join('\n\n'),
    status: 'complete',
  });
  return next;
}

export function applyCourseProposal(
  courseCase: CourseCase,
  input: CourseProposalInput,
): CourseCase {
  if (input.purpose !== 'message' && input.purpose !== 'generate') {
    throw new CourseContractError(
      'INVALID_PURPOSE',
      'A turn must be a message or a material generation.',
    );
  }

  const next = structuredClone(courseCase);
  const proposal = input.proposal;

  if (input.purpose === 'generate') {
    if (proposal.materials === null) {
      throw new CourseContractError(
        'MATERIALS_REQUIRED',
        'A generate turn needs the material sentences from the model.',
      );
    }
    if (next.materials.status !== 'not-generated' && !input.replaceExisting) {
      throw new CourseContractError('MATERIALS_REPLACE_REQUIRED');
    }
    applyProposedAnalysis(next, proposal, input.userText);
    next.materials = composeMaterials(next, proposal.materials);
    reuseOrAppendUserMessage(next, input.userText, input.retryMessageId, 'complete');
    next.messages.push({
      id: nextMessageId(next),
      role: 'assistant',
      text: buildAssistantText(proposal.reply, null, buildNextStep(next)),
      status: 'complete',
    });
    return next;
  }

  const intent = proposal.understoodAs;
  const isMessage = input.purpose === 'message';
  const keepsAnalysis =
    isMessage && (intent === 'query' || intent === 'other' || intent === 'generate-request');
  const isControlIntent = isMessage && (intent === 'skip-request' || intent === 'end-request');

  if (
    isMessage &&
    intent === 'initial-report' &&
    (proposal.types === null || proposal.attention === null || proposal.recommendations === null)
  ) {
    throw new CourseContractError(
      'INITIAL_REPORT_ANALYSIS_REQUIRED',
      'An initial report must replace types, attention and recommendations.',
    );
  }

  const factsBefore = factStateSignature(next.facts);
  const questionsBefore = questionStateSignature(next.questions);
  const typesBefore = JSON.stringify(next.types);
  const attentionBefore = JSON.stringify(next.attention);
  const recommendationsBefore = JSON.stringify(next.recommendations);

  if (isMessage && !keepsAnalysis && !isControlIntent) {
    for (const change of proposal.factChanges) {
      applyFactChange(next, change, intent, input.userText);
    }
    if (intent !== 'correction') {
      for (const update of proposal.questionUpdates) {
        applyQuestionUpdate(next, update, input.userText);
      }
    }
  }

  if (isMessage && intent === 'skip-request') skipFirstPendingQuestion(next);
  if (isMessage && intent === 'end-request') endQuestions(next);

  let acceptedQuestions: CourseQuestion[] = [];
  if (
    isMessage &&
    !keepsAnalysis &&
    !isControlIntent &&
    next.questions.length === 0 &&
    proposal.proposedQuestions.length > 0
  ) {
    acceptedQuestions = proposal.proposedQuestions.map((question, index) => {
      if (question.id !== `Q${index + 1}`) {
        throw new CourseContractError(
          'PROPOSED_QUESTIONS_INVALID',
          'New questions must be numbered Q1, Q2 and Q3 in order.',
        );
      }
      return {
        id: question.id,
        text: question.text,
        purpose: question.purpose,
        relatedKeys: [...question.relatedKeys],
        status: 'pending' as const,
        answerText: null,
      };
    });
    next.questions = acceptedQuestions;
  }

  if (!keepsAnalysis) {
    applyProposedAnalysis(next, proposal, input.userText);
  }

  if (isMessage) {
    next.phase = 'open';
    const factsChanged = factStateSignature(next.facts) !== factsBefore;
    const questionsChanged = questionStateSignature(next.questions) !== questionsBefore;
    const analysisChanged =
      JSON.stringify(next.types) !== typesBefore ||
      JSON.stringify(next.attention) !== attentionBefore ||
      JSON.stringify(next.recommendations) !== recommendationsBefore;
    if (factsChanged || questionsChanged || analysisChanged) markMaterialsStale(next);
  }

  reuseOrAppendUserMessage(next, input.userText, input.retryMessageId, 'complete');
  const questionCount =
    acceptedQuestions.length > 0
      ? `I have ${acceptedQuestions.length} questions to clarify this case, covering ${acceptedQuestions
          .map((question) => question.purpose)
          .join('; ')}. You can answer more than one, say you do not know, skip a question, or end early.`
      : null;
  const assistantText = buildAssistantText(proposal.reply, questionCount, buildNextStep(next));
  next.messages.push({
    id: nextMessageId(next),
    role: 'assistant',
    text: assistantText,
    status: 'complete',
  });
  return next;
}

export function recordFailedTurn(
  courseCase: CourseCase,
  input: CourseFailedTurnInput,
): CourseCase {
  const next = structuredClone(courseCase);
  reuseOrAppendUserMessage(next, input.userText, input.retryMessageId, 'failed');
  next.messages.push({
    id: nextMessageId(next),
    role: 'error',
    text: input.errorMessage,
    status: 'failed',
  });
  return next;
}
