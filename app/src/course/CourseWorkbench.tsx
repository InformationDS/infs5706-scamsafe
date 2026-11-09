import { useRef, useState } from 'react';
import {
  applyClientAction,
  applyEmployeeFactEdit,
  buildNextStep,
  caseStatusLabel,
  confirmMaterials,
  createCourseCase,
  editMaterialText,
  recordFailedTurn,
  visibleFacts,
  type CourseCase,
  type CourseMessage,
  type CourseTurnRequest,
  type FactKey,
  type RoleId,
} from '../../../shared/course-case';
import examples from '../../../data/course/examples.json';
import guidelines from '../../../data/course/guidelines.json';
import './course.css';

export type CourseTurnSuccess = {
  case: CourseCase;
  assistantText: string;
  requestId?: string;
};

const LIVE_REQUIRED_MESSAGE =
  'Live model is not configured. Set MODEL_MODE=live and the model URL, name and key, then restart the local service. Your text is kept.';
const TIMEOUT_MESSAGE = 'The model timed out. Your text is kept. Retry uses the same text.';
const INVALID_OUTPUT_MESSAGE =
  'The model returned an unusable result. Your text is kept. Retry does not change the saved facts.';
const UNREACHABLE_MESSAGE = 'The model service could not be reached. Your text is kept.';
const EMPTY_INPUT_MESSAGE = 'Enter a message, or load an example.';
const NEW_CASE_CONFIRMATION =
  'Start a new case? This clears the current report, questions and drafts.';
const EMPTY_GUIDANCE_MESSAGE = 'No guidance yet. Analyze a case, or ask in the conversation.';
const FACT_EDIT_ERROR = 'The fact could not be updated.';
const EMPTY_MATERIALS_MESSAGE = 'No materials generated yet.';
const MATERIALS_STALE_MESSAGE = 'Materials need updating';
const MATERIALS_CONFIRMED_MESSAGE = 'Materials confirmed.';
const REGENERATE_CONFIRMATION = 'Regenerate materials? This replaces the existing drafts.';
const GENERATE_USER_TEXT = 'Generate materials';
const MATERIAL_EDIT_ERROR = 'The material could not be updated.';
const COPY_FALLBACK_MESSAGE = 'Use Ctrl+C to copy the selected text.';

const MATERIAL_PARTS = [
  { id: 'summary', label: 'Case summary' },
  { id: 'personExplanation', label: 'For the person' },
] as const;

const HANDOVER_PART = { id: 'handover', label: 'Handover draft' } as const;

type MaterialPart = (typeof MATERIAL_PARTS)[number]['id'] | typeof HANDOVER_PART.id;

const MATERIAL_LABELS: Record<MaterialPart, string> = {
  summary: 'Case summary',
  personExplanation: 'Explanation for the affected person',
  handover: 'Organisation-specific handover',
};

const MATERIAL_FILENAMES: Record<MaterialPart, string> = {
  summary: 'scamsafe-summary.md',
  personExplanation: 'scamsafe-person.md',
  handover: 'scamsafe-handover.md',
};

const GUIDELINE_BY_ID = new Map(guidelines.map((guideline) => [guideline.id, guideline]));

const GUIDELINE_APPLIES_LABELS: Record<string, string> = {
  bank: 'Bank',
  telecom: 'Telecom',
};

const SLOW_NOTICE_DELAY_MS = 10_000;
const SLOW_NOTICE_MESSAGE = 'The model is taking longer than usual. Please wait.';

const RESULT_TABS = [
  { id: 'overview', label: 'Case overview' },
  { id: 'guidance', label: 'Guidance' },
  { id: 'materials', label: 'Materials' },
] as const;

type ResultTab = (typeof RESULT_TABS)[number]['id'];

const ATTENTION_LABELS: Record<CourseCase['attention'][number]['kind'], string> = {
  urgency: 'Urgency',
  vulnerability: 'Vulnerability',
  'human-support': 'Human support',
};

const QUESTION_STATUS_LABELS: Record<CourseCase['questions'][number]['status'], string> = {
  pending: 'Pending',
  answered: 'Answered',
  unknown: 'Unknown',
  skipped: 'Skipped',
  'not-applicable': 'Not applicable',
};

const FACT_GROUP_ORDER = ['event', 'money', 'account', 'current', 'support'] as const;

const FACT_GROUP_LABELS: Record<CourseCase['facts'][number]['group'], string> = {
  event: 'Event',
  money: 'Money',
  account: 'Account',
  current: 'Current',
  support: 'Support',
};

const AUDIENCE_LABELS: Record<CourseCase['recommendations'][number]['audience'], string> = {
  'this-organisation': 'This organisation',
  'other-organisation': 'Other organisation',
  'human-judgement': 'Human judgement',
};

class CourseApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'CourseApiError';
    this.status = status;
    this.code = code;
  }
}

/** POST one course turn to the local service. */
export async function postCourseTurn(request: CourseTurnRequest): Promise<CourseTurnSuccess> {
  let response: Response;
  try {
    response = await fetch('/api/course/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new CourseApiError(0, 'NETWORK_ERROR', UNREACHABLE_MESSAGE);
  }

  if (!response.ok) {
    let code = 'REQUEST_FAILED';
    let message = 'The request could not be completed. Your text is kept.';
    try {
      const body = (await response.json()) as { error?: { code?: unknown; message?: unknown } };
      if (typeof body.error?.code === 'string') code = body.error.code;
      if (typeof body.error?.message === 'string') message = body.error.message;
    } catch {
      // Keep the generic message when the response body is not the expected error JSON.
    }
    throw new CourseApiError(response.status, code, message);
  }

  const body = (await response.json()) as Partial<CourseTurnSuccess> | null;
  if (!body || typeof body !== 'object' || !body.case || typeof body.assistantText !== 'string') {
    throw new CourseApiError(502, 'MODEL_INVALID_OUTPUT', INVALID_OUTPUT_MESSAGE);
  }
  return {
    case: body.case,
    assistantText: body.assistantText,
    ...(typeof body.requestId === 'string' ? { requestId: body.requestId } : {}),
  };
}

function failureMessage(error: unknown): string {
  if (!(error instanceof CourseApiError)) return UNREACHABLE_MESSAGE;
  if (error.status === 503) return LIVE_REQUIRED_MESSAGE;
  if (error.status === 504) return TIMEOUT_MESSAGE;
  if (error.status === 502 && error.code === 'MODEL_INVALID_OUTPUT') return INVALID_OUTPUT_MESSAGE;
  if (error.status === 502) return UNREACHABLE_MESSAGE;
  return error.message;
}

function messageLabel(message: CourseMessage): string {
  if (message.role === 'assistant') return 'Case assistant';
  if (message.role === 'error') return 'Request failed';
  return message.status === 'failed' ? 'Employee · not sent' : 'Employee';
}

type TurnSummary = {
  updates: string[];
  gaps: string[];
};

function factSummaryValue(fact: CourseCase['facts'][number]): string {
  if (fact.status === 'unknown') return 'Unknown';
  return fact.value ?? 'Unknown';
}

/** Program-generated summary of the case changes in one successful turn. */
function buildTurnUpdates(before: CourseCase, after: CourseCase): string[] {
  const updates: string[] = [];
  for (const fact of after.facts) {
    const previous = before.facts.find((candidate) => candidate.key === fact.key);
    if (!previous) continue;
    const changed =
      previous.value !== fact.value ||
      previous.status !== fact.status ||
      previous.uncertainty !== fact.uncertainty ||
      JSON.stringify(previous.pendingConflict) !== JSON.stringify(fact.pendingConflict);
    if (changed) updates.push(`${fact.label}: ${factSummaryValue(fact)}`);
  }
  for (const question of after.questions) {
    const previous = before.questions.find((candidate) => candidate.id === question.id);
    if (previous && previous.status !== question.status) {
      updates.push(
        `${question.id}: ${QUESTION_STATUS_LABELS[previous.status]} → ${QUESTION_STATUS_LABELS[question.status]}`,
      );
    }
  }
  return updates;
}

/** Current unclear information without evidence text. */
function buildStillUnclear(courseCase: CourseCase): string[] {
  const gaps: string[] = [];
  for (const fact of courseCase.facts) {
    if (fact.status === 'unknown') gaps.push(`${fact.label} is unknown.`);
    if (fact.uncertainty) gaps.push(`${fact.label} is uncertain: ${fact.uncertainty}`);
    if (fact.pendingConflict) {
      gaps.push(`${fact.label} has an unresolved new statement: ${fact.pendingConflict.value}`);
    }
  }
  courseCase.questions.forEach((question, index) => {
    if (question.status === 'pending') {
      gaps.push(`Question ${index + 1} is still pending: ${question.text}`);
    }
  });
  return gaps;
}

/** Append a local assistant message using the same message id sequence as the shared case. */
function appendAssistantMessage(courseCase: CourseCase, text: string): CourseCase {
  const next = structuredClone(courseCase);
  next.messages.push({ id: `m${next.messageSeq}`, role: 'assistant', text, status: 'complete' });
  next.messageSeq += 1;
  return next;
}

export function CourseWorkbench() {
  const [courseCase, setCourseCase] = useState<CourseCase>(() => createCourseCase('bank'));
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<ResultTab>('overview');
  const [exampleId, setExampleId] = useState(examples[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [materialTab, setMaterialTab] = useState<MaterialPart>('summary');
  const [toast, setToast] = useState('');
  const [turnSummary, setTurnSummary] = useState<TurnSummary | null>(null);
  const [slowNotice, setSlowNotice] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const slowTimer = useRef<number | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const materialRef = useRef<HTMLTextAreaElement | null>(null);

  const facts = visibleFacts(courseCase);
  const userMessages = courseCase.messages.filter((message) => message.role === 'user');
  const hasUserMessage = userMessages.length > 0;
  const lastUserMessage = [...userMessages].reverse()[0];
  const retryTarget = lastUserMessage && lastUserMessage.status === 'failed' ? lastUserMessage : null;
  const firstUserMessage = courseCase.messages.find((message) => message.role === 'user');
  const pendingIndex = courseCase.questions.findIndex((question) => question.status === 'pending');
  const activeQuestion = pendingIndex >= 0 ? courseCase.questions[pendingIndex] : null;
  const handledQuestions = courseCase.questions.filter((question) => question.status !== 'pending').length;
  const primaryLabel = busy
    ? 'Processing…'
    : retryTarget
      ? 'Retry'
      : courseCase.phase === 'new'
        ? 'Analyze case'
        : 'Send message';
  const hasCaseContent =
    facts.length > 0 ||
    courseCase.types.length > 0 ||
    courseCase.attention.length > 0 ||
    courseCase.questions.length > 0 ||
    Boolean(firstUserMessage);
  const factGroups = FACT_GROUP_ORDER.map((group) => ({
    group,
    label: FACT_GROUP_LABELS[group],
    facts: facts.filter((fact) => fact.group === group),
  })).filter((entry) => entry.facts.length > 0);
  const remainingGaps: Array<{ key: string; text: string }> = [];
  for (const fact of courseCase.facts) {
    if (fact.status === 'unknown') {
      remainingGaps.push({ key: `unknown:${fact.key}`, text: `${fact.label} is unknown.` });
    }
    if (fact.uncertainty) {
      remainingGaps.push({
        key: `uncertainty:${fact.key}`,
        text: `${fact.label} is uncertain: ${fact.uncertainty}`,
      });
    }
    if (fact.pendingConflict) {
      remainingGaps.push({
        key: `conflict:${fact.key}`,
        text: `${fact.label} has an unresolved new statement: ${fact.pendingConflict.value}`,
      });
    }
  }
  courseCase.questions.forEach((question, index) => {
    if (question.status === 'pending') {
      remainingGaps.push({
        key: `question:${question.id}`,
        text: `Question ${index + 1} is still pending: ${question.text}`,
      });
    } else if (question.status === 'unknown') {
      remainingGaps.push({
        key: `question:${question.id}`,
        text: `Question ${index + 1} was answered as unknown: ${question.text}`,
      });
    } else if (question.status === 'skipped') {
      remainingGaps.push({
        key: `question:${question.id}`,
        text: `Question ${index + 1} was skipped: ${question.text}`,
      });
    }
  });
  const materialTabs = courseCase.materials.handover !== null
    ? [...MATERIAL_PARTS, HANDOVER_PART]
    : [...MATERIAL_PARTS];
  const activeMaterialTab = materialTabs.some((part) => part.id === materialTab)
    ? materialTab
    : 'summary';
  const currentMaterialText = courseCase.materials[activeMaterialTab] ?? '';
  const hasMaterials = courseCase.materials.status !== 'not-generated';

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 5000);
  }

  function startSlowNotice() {
    window.clearTimeout(slowTimer.current);
    slowTimer.current = window.setTimeout(() => setSlowNotice(true), SLOW_NOTICE_DELAY_MS);
  }

  function stopSlowNotice() {
    if (slowTimer.current !== undefined) window.clearTimeout(slowTimer.current);
    slowTimer.current = undefined;
    setSlowNotice(false);
  }

  function switchRole(role: RoleId) {
    if (busy || hasUserMessage || role === courseCase.role.id) return;
    setTurnSummary(null);
    setCourseCase(createCourseCase(role));
  }

  function loadExample() {
    if (busy) return;
    const example = examples.find((candidate) => candidate.id === exampleId) ?? examples[0];
    if (!example) return;
    setDraft(example.text);
    textareaRef.current?.focus();
  }

  function startNewCase() {
    if (busy) return;
    const empty = courseCase.messages.length === 0 && draft.trim() === '';
    if (!empty && !window.confirm(NEW_CASE_CONFIRMATION)) return;
    setTurnSummary(null);
    setCourseCase(createCourseCase(courseCase.role.id));
    setDraft('');
    setTab('overview');
    setToast('');
  }

  async function sendTurn() {
    if (busy) return;
    const text = draft.trim();
    if (!text) {
      showToast(EMPTY_INPUT_MESSAGE);
      return;
    }
    const retryMessageId = retryTarget?.id ?? null;
    const before = courseCase;
    setBusy(true);
    startSlowNotice();
    try {
      const result = await postCourseTurn({
        case: before,
        userText: text,
        purpose: 'message',
        replaceExisting: false,
        retryMessageId,
      });
      setCourseCase(result.case);
      setDraft('');
      setTurnSummary({
        updates: buildTurnUpdates(before, result.case),
        gaps: buildStillUnclear(result.case),
      });
    } catch (error) {
      setTurnSummary(null);
      const message = failureMessage(error);
      setCourseCase(
        recordFailedTurn(courseCase, {
          userText: text,
          errorMessage: message,
          retryMessageId,
        }),
      );
    } finally {
      stopSlowNotice();
      setBusy(false);
    }
  }

  function editFact(key: FactKey, input: HTMLInputElement) {
    if (busy) return;
    try {
      setCourseCase(applyEmployeeFactEdit(courseCase, key, input.value));
    } catch {
      input.value = input.defaultValue;
      showToast(FACT_EDIT_ERROR);
    }
  }

  function runQuestionAction(action: 'unknown' | 'skip' | 'end') {
    if (busy) return;
    if (action !== 'end' && pendingIndex < 0) return;
    setCourseCase(applyClientAction(courseCase, action));
  }

  function viewGuidance() {
    if (busy) return;
    setTab('guidance');
    setCourseCase(
      appendAssistantMessage(
        courseCase,
        ['Guidance is shown on the left.', buildNextStep(courseCase)].join('\n\n'),
      ),
    );
  }

  function editMaterial(part: MaterialPart, text: string) {
    if (busy) return;
    try {
      setCourseCase(editMaterialText(courseCase, part, text));
    } catch {
      showToast(MATERIAL_EDIT_ERROR);
    }
  }

  function confirmCurrentMaterials() {
    if (busy || courseCase.materials.status !== 'draft') return;
    try {
      setCourseCase(confirmMaterials(courseCase));
    } catch {
      showToast('The materials could not be confirmed.');
    }
  }

  async function copyMaterial() {
    if (busy || courseCase.materials.status !== 'confirmed') return;
    const text = materialRef.current?.value ?? currentMaterialText;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Material copied.');
    } catch {
      const field = materialRef.current;
      if (field) {
        field.focus();
        field.select();
      }
      showToast(COPY_FALLBACK_MESSAGE);
    }
  }

  function downloadMaterial() {
    if (busy || courseCase.materials.status !== 'confirmed') return;
    const text = materialRef.current?.value ?? currentMaterialText;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = MATERIAL_FILENAMES[activeMaterialTab];
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function generateMaterials() {
    if (busy) return;
    const replaceExisting = courseCase.materials.status !== 'not-generated';
    if (replaceExisting && !window.confirm(REGENERATE_CONFIRMATION)) return;
    setTab('materials');
    setBusy(true);
    startSlowNotice();
    try {
      const result = await postCourseTurn({
        case: courseCase,
        userText: GENERATE_USER_TEXT,
        purpose: 'generate',
        replaceExisting,
        retryMessageId: null,
      });
      setCourseCase(result.case);
    } catch (error) {
      setTurnSummary(null);
      showToast(failureMessage(error));
    } finally {
      stopSlowNotice();
      setBusy(false);
    }
  }

  return (
    <div className="course-app">
      <header className="course-top">
        <div className="course-top-left">
          <div className="course-brand">
            <span className="course-mark" aria-hidden="true">
              S
            </span>
            ScamSafe
          </div>
          <span className="course-divider" aria-hidden="true" />
          <span className="course-eyebrow">Frontline employee workspace</span>
        </div>
        <div className="course-top-right">
          <span className="course-role-label">{courseCase.role.title}</span>
          <span className="course-pill">{caseStatusLabel(courseCase)}</span>
          <button type="button" className="course-button course-small" onClick={startNewCase} disabled={busy}>
            New case
          </button>
        </div>
      </header>

      <main className="course-main">
        <div className="course-workspace">
          <section className="course-panel" aria-label="Case information and results">
            <nav className="course-tabs" aria-label="Case result views">
              {RESULT_TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`course-tab${tab === id ? ' course-tab-active' : ''}`}
                  aria-pressed={tab === id}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="course-scroll">
              <section className="course-role-summary" role="region" aria-label="Current employee role">
                <p className="course-eyebrow">Current employee role</p>
                <h2>{courseCase.role.title}</h2>
                <p className="course-role-responsibilities">{courseCase.role.responsibilities}</p>
              </section>

              {activeQuestion && (
                <section className="course-round-questions" role="group" aria-label="Round questions">
                  <p className="course-question-progress">
                    Question {pendingIndex + 1} of {courseCase.questions.length}
                  </p>
                  <p className="course-question-mapping">
                    Numbered answers follow this list:{' '}
                    {courseCase.questions
                      .map((question, index) => `${index + 1} → ${question.id}`)
                      .join(', ')}
                    .
                  </p>
                  <p className="course-question-focus">Current purpose: {activeQuestion.purpose}</p>
                  <ol className="course-question-list" aria-label="All questions in this round">
                    {courseCase.questions.map((question, index) => (
                      <li
                        key={question.id}
                        className={`course-question-item${
                          index === pendingIndex ? ' course-question-item-active' : ''
                        }`}
                        aria-current={index === pendingIndex ? 'step' : undefined}
                      >
                        <div className="course-question-item-head">
                          <span className="course-question-id">{question.id}</span>
                          <span className="course-question-status">
                            {QUESTION_STATUS_LABELS[question.status]}
                          </span>
                        </div>
                        <p className="course-question-item-text">{question.text}</p>
                        <p className="course-question-item-purpose">{question.purpose}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {tab === 'overview' && (
                <>
                  {!hasUserMessage && (
                    <section className="course-section course-section-first">
                      <h2>Who is receiving this report?</h2>
                      <p className="course-muted">
                        Choose the employee role before the first message. The case starts in that role.
                      </p>
                      <div className="course-role-grid">
                        <button
                          type="button"
                          className={`course-role${courseCase.role.id === 'bank' ? ' course-role-selected' : ''}`}
                          aria-pressed={courseCase.role.id === 'bank'}
                          onClick={() => switchRole('bank')}
                          disabled={busy}
                        >
                          Bank employee
                        </button>
                        <button
                          type="button"
                          className={`course-role${courseCase.role.id === 'telecom' ? ' course-role-selected' : ''}`}
                          aria-pressed={courseCase.role.id === 'telecom'}
                          onClick={() => switchRole('telecom')}
                          disabled={busy}
                        >
                          Telecom employee
                        </button>
                      </div>
                    </section>
                  )}

                  {!hasCaseContent && (
                    <section className="course-section">
                      <p className="course-empty">
                        Start in the conversation: describe the case or load an example, then select
                        Analyze case to see the case overview.
                      </p>
                    </section>
                  )}

                  {courseCase.types.length > 0 && (
                    <section className="course-section">
                      <h2>Candidate type</h2>
                      <div className="course-list">
                        {courseCase.types.map((type) => (
                          <article className="course-card" key={`${type.label}:${type.reason}`}>
                            <span className="course-pill">{type.label}</span>
                            <p className="course-card-text">{type.reason}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  )}

                  {courseCase.attention.length > 0 && (
                    <section className="course-section">
                      <h2>Attention</h2>
                      <div className="course-list">
                        {courseCase.attention.map((item) => (
                          <article className="course-card" key={`${item.kind}:${item.text}`}>
                            <span className="course-label">
                              {ATTENTION_LABELS[item.kind] ?? item.kind}
                            </span>
                            <p className="course-card-text">{item.text}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  )}

                  {facts.length > 0 && (
                    <section className="course-section">
                      <h2>Reported facts</h2>
                      {factGroups.map((group) => (
                        <div className="course-fact-group" key={group.group}>
                          <h3 className="course-fact-group-title">{group.label}</h3>
                          <div className="course-facts">
                            {group.facts.map((fact) => (
                              <label className="course-fact" key={fact.key}>
                                <span className="course-fact-head">
                                  <span className="course-fact-label">{fact.label}</span>
                                  {fact.status === 'unknown' && (
                                    <span className="course-fact-status">Unknown</span>
                                  )}
                                </span>
                                <input
                                  className="course-fact-input"
                                  aria-label={fact.label}
                                  key={`${fact.key}:${fact.status}:${fact.origin}:${fact.value ?? ''}:${
                                    fact.uncertainty ?? ''
                                  }:${fact.pendingConflict?.value ?? ''}`}
                                  defaultValue={fact.value ?? ''}
                                  disabled={busy}
                                  onBlur={(event) => editFact(fact.key, event.currentTarget)}
                                />
                                {fact.uncertainty && (
                                  <span className="course-note">Uncertain report: {fact.uncertainty}</span>
                                )}
                                {fact.pendingConflict && (
                                  <span className="course-note course-note-conflict">
                                    New statement: {fact.pendingConflict.value}. The current value is kept
                                    until the conflict is reviewed.
                                  </span>
                                )}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </section>
                  )}

                  {courseCase.questions.length > 0 && (
                    <section className="course-section">
                      <h2>Questions</h2>
                      <p className="course-progress">
                        {pendingIndex >= 0
                          ? `Question ${pendingIndex + 1} of ${courseCase.questions.length}`
                          : `${handledQuestions} of ${courseCase.questions.length} handled`}
                      </p>
                      {courseCase.questionsEnded && <p className="course-muted">Clarification ended.</p>}
                    </section>
                  )}

                  <section className="course-section" aria-label="Remaining gaps">
                    <h2>Remaining gaps</h2>
                    {remainingGaps.length === 0 ? (
                      <p className="course-empty">No remaining gaps.</p>
                    ) : (
                      <ul className="course-gaps-list">
                        {remainingGaps.map((gap) => (
                          <li key={gap.key}>{gap.text}</li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {firstUserMessage && (
                    <section className="course-section">
                      <h2>First report</h2>
                      <p className="course-narrative">{firstUserMessage.text}</p>
                    </section>
                  )}

                  <section className="course-section course-sample">
                    <label htmlFor="course-example">Explore a fictional case</label>
                    <select
                      id="course-example"
                      value={exampleId}
                      onChange={(event) => setExampleId(event.target.value)}
                    >
                      {examples.map((example) => (
                        <option key={example.id} value={example.id}>
                          {example.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="course-button course-small"
                      onClick={loadExample}
                      disabled={busy}
                    >
                      Load example
                    </button>
                  </section>
                </>
              )}

              {tab === 'guidance' && (
                <section className="course-section">
                  <h2>Guidance</h2>
                  {courseCase.recommendations.length === 0 ? (
                    <p className="course-empty">{EMPTY_GUIDANCE_MESSAGE}</p>
                  ) : (
                    <div className="course-list">
                      {courseCase.recommendations.map((recommendation) => {
                        const guideline = GUIDELINE_BY_ID.get(recommendation.guidelineId);
                        return (
                          <article className="course-card course-recommendation" key={recommendation.id}>
                            <div className="course-recommendation-meta">
                              <span className="course-pill">{recommendation.organisation}</span>
                              <span className="course-meta">Priority: {recommendation.priority}</span>
                              <span className="course-meta">
                                Audience: {AUDIENCE_LABELS[recommendation.audience]}
                              </span>
                              <span className="course-meta">{recommendation.guidelineId}</span>
                            </div>
                            {guideline && (
                              <p className="course-recommendation-source">
                                Guideline: {guideline.id} — {guideline.title}; Applies to:{' '}
                                {guideline.appliesTo
                                  .map((role) => GUIDELINE_APPLIES_LABELS[role] ?? role)
                                  .join('/')}
                              </p>
                            )}
                            <h3 className="course-recommendation-action">{recommendation.action}</h3>
                            <p className="course-card-text">{recommendation.reason}</p>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {tab === 'materials' && (
                <section className="course-section">
                  <h2>Materials</h2>
                  {!hasMaterials ? (
                    <p className="course-empty">{EMPTY_MATERIALS_MESSAGE}</p>
                  ) : (
                    <>
                      {courseCase.materials.status === 'needs-update' && (
                        <div className="course-banner course-banner-warning" role="status">
                          <strong>{MATERIALS_STALE_MESSAGE}</strong>
                          <p>
                            Your existing edits are preserved. Cancelling a regeneration keeps the
                            current drafts.
                          </p>
                        </div>
                      )}
                      {courseCase.materials.status === 'confirmed' && (
                        <div className="course-banner course-banner-success" role="status">
                          <strong>{MATERIALS_CONFIRMED_MESSAGE}</strong>
                        </div>
                      )}
                      <div className="course-material-tabs" role="group" aria-label="Material views">
                        {materialTabs.map((part) => (
                          <button
                            key={part.id}
                            type="button"
                            className={`course-material-tab${
                              activeMaterialTab === part.id ? ' course-material-tab-active' : ''
                            }`}
                            aria-pressed={activeMaterialTab === part.id}
                            onClick={() => setMaterialTab(part.id)}
                          >
                            {part.label}
                          </button>
                        ))}
                      </div>
                      <label className="course-material-label" htmlFor="course-material">
                        {MATERIAL_LABELS[activeMaterialTab]}
                      </label>
                      <textarea
                        id="course-material"
                        ref={materialRef}
                        className="course-material-text"
                        aria-label="Current material text"
                        value={currentMaterialText}
                        disabled={busy}
                        onChange={(event) => editMaterial(activeMaterialTab, event.target.value)}
                      />
                      <div className="course-material-actions">
                        <button
                          type="button"
                          className="course-button course-small"
                          onClick={confirmCurrentMaterials}
                          disabled={busy || courseCase.materials.status !== 'draft'}
                        >
                          Confirm materials
                        </button>
                        <button
                          type="button"
                          className="course-button course-small"
                          onClick={() => void copyMaterial()}
                          disabled={busy || courseCase.materials.status !== 'confirmed'}
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          className="course-button course-small"
                          onClick={downloadMaterial}
                          disabled={busy || courseCase.materials.status !== 'confirmed'}
                        >
                          Download Markdown
                        </button>
                      </div>
                    </>
                  )}
                </section>
              )}
            </div>
          </section>

          <aside className="course-panel course-panel-chat" aria-label="Case conversation">
            <div className="course-panel-head">
              <h2>Case conversation</h2>
              <p className="course-muted">The report, your additions, and what happens next.</p>
            </div>

            <div className="course-chat" aria-live="polite">
              {courseCase.messages.length === 0 && (
                <div className="course-bubble course-bubble-assistant">
                  <p className="course-bubble-label">Case assistant</p>
                  <p className="course-bubble-text">{buildNextStep(courseCase)}</p>
                </div>
              )}
              {courseCase.messages.map((message) => (
                <div
                  className={`course-bubble course-bubble-${message.role}${
                    message.role === 'user' && message.status === 'failed' ? ' course-bubble-failed' : ''
                  }`}
                  key={message.id}
                >
                  <p className="course-bubble-label">{messageLabel(message)}</p>
                  <p className="course-bubble-text">{message.text}</p>
                </div>
              ))}
              {turnSummary && (
                <section className="course-turn-summary" role="region" aria-label="This turn">
                  <p className="course-turn-summary-title">This turn</p>
                  <div className="course-turn-summary-block">
                    <p className="course-turn-summary-label">Recorded updates</p>
                    {turnSummary.updates.length > 0 ? (
                      <ul className="course-turn-summary-list">
                        {turnSummary.updates.map((update, index) => (
                          <li key={`${update}:${index}`}>{update}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="course-turn-summary-empty">No case facts changed</p>
                    )}
                  </div>
                  <div className="course-turn-summary-block">
                    <p className="course-turn-summary-label">Still unclear</p>
                    {turnSummary.gaps.length > 0 ? (
                      <ul className="course-turn-summary-list">
                        {turnSummary.gaps.map((gap, index) => (
                          <li key={`${gap}:${index}`}>{gap}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="course-turn-summary-empty">No recorded gaps</p>
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className="course-chat-actions">
              {slowNotice && (
                <p className="course-slow-notice" role="status">
                  {SLOW_NOTICE_MESSAGE}
                </p>
              )}
              <div className="course-shortcuts">
                <button
                  type="button"
                  className="course-button course-small"
                  onClick={viewGuidance}
                  disabled={busy}
                >
                  View guidance
                </button>
                <button
                  type="button"
                  className="course-button course-small"
                  onClick={() => void generateMaterials()}
                  disabled={busy}
                >
                  {courseCase.materials.status === 'not-generated'
                    ? 'Generate materials'
                    : 'Regenerate materials'}
                </button>
              </div>
              {activeQuestion && (
                <div className="course-current-question" role="group" aria-label="Current question">
                  <div className="course-current-question-copy">
                    <p className="course-current-question-progress">
                      Question {pendingIndex + 1} of {courseCase.questions.length}
                    </p>
                    <p className="course-current-question-text">{activeQuestion.text}</p>
                  </div>
                  <div className="course-current-question-buttons">
                    <button
                      type="button"
                      className="course-button course-small"
                      onClick={() => runQuestionAction('unknown')}
                      disabled={busy}
                    >
                      Don't know
                    </button>
                    <button
                      type="button"
                      className="course-button course-small"
                      onClick={() => runQuestionAction('skip')}
                      disabled={busy}
                    >
                      Skip question
                    </button>
                    <button
                      type="button"
                      className="course-button course-small"
                      onClick={() => runQuestionAction('end')}
                      disabled={busy}
                    >
                      End questions
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="course-composer">
              <label htmlFor="course-draft">Case description or additional information</label>
              <textarea
                id="course-draft"
                ref={textareaRef}
                value={draft}
                disabled={busy}
                placeholder="Describe what happened, what was shared, and any action taken…"
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="course-composer-actions">
                <span className="course-hint">
                  {busy ? 'Waiting for the local service…' : 'Your text is only sent when you select the main button.'}
                </span>
                <button
                  type="button"
                  className="course-button course-primary"
                  onClick={() => void sendTurn()}
                  disabled={busy}
                >
                  {primaryLabel}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {toast && (
        <div className="course-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
