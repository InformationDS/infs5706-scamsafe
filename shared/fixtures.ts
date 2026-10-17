import { CaseRecordSchema, type CaseRecord, type FactRecord, type Question } from './schema.js';
import { answerQuestion, confirmFacts, correctFact, currentDependencies, factDependency, markSaved, reviewOutput, stopFollowUp } from './core.js';
import { sourceText } from './source-text.js';

export { sourceText };
export const fixtureNames = ['intake', 'corrected', 'partial', 'stopped', 'no-guidance', 'reviewed', 'stale', 'model-error', 'save-error', 'handover'];
const fact = (fieldId: string, value: FactRecord['value'], sourceIds: string[], recordId?: string): FactRecord => ({
  fieldId, ...(recordId ? { recordId } : {}), value, version: 1, status: value === null ? 'missing' : 'extracted',
  reviewStatus: 'unreviewed', sourceIds, candidates: [], history: [],
});
export const fixedQuestions: Question[] = [
  { id: 'Q1', round: 1, target: { fieldId: 'E09', recordId: 'TX-01' }, text: 'Is the debit shown as pending or completed?', reason: 'Transaction status affects the bank record and human assessment.', status: 'pending', answer: null, history: [] },
  { id: 'Q2', round: 1, target: { fieldId: 'C08', recordId: 'CONTACT-01' }, text: 'Has the sender contacted you again?', reason: 'Establish whether this contact is continuing.', status: 'pending', answer: null, history: [] },
  { id: 'Q3', round: 1, target: { fieldId: 'E08', recordId: 'TX-01' }, text: 'Does the bank app identify the recipient of the debit?', reason: 'The recipient affects the human assessment record and is not provided.', status: 'pending', answer: null, history: [] },
];

export function makeFixture(stage: string = 'intake'): CaseRecord {
  if (!fixtureNames.includes(stage)) throw new Error(`Unknown fixture: ${stage}`);
  const facts: FactRecord[] = [
    fact('A07', sourceText.narrative, ['S1', 'S2', 'S3', 'S4', 'S5']),
    fact('B01', 'Person concerned', ['S1', 'S2', 'S3', 'S4', 'S5']),
    fact('C02', '16 October 2026 09:00 Australia/Sydney', ['S1'], 'CONTACT-01'),
    fact('C03', 'SMS', ['S1'], 'CONTACT-01'), fact('C04', 'Claims to be SYN Bank A', ['S1'], 'CONTACT-01'),
    fact('C06', 'verify-bank.example', ['S2'], 'CONTACT-01'), fact('C08', null, [], 'CONTACT-01'),
    fact('D04', 'Opened the link and entered banking password and one-time code categories; no secret values recorded.', ['S2'], 'EVENT-01'),
    fact('E01', 'Reported debit', ['S3']), fact('E02', 'TX-01', ['S3'], 'TX-01'),
    fact('E03', null, [], 'TX-01'), fact('E04', 2000, ['S3'], 'TX-01'), fact('E05', 'AUD', ['S3'], 'TX-01'),
    fact('E06', null, [], 'TX-01'), fact('E07', 'SYN Bank A', ['S3'], 'TX-01'), fact('E08', null, [], 'TX-01'), fact('E09', null, [], 'TX-01'),
    fact('F01', true, ['S2']), fact('F02', ['Banking password', 'One-time code'], ['S2']),
    fact('F03', 'Linked page', ['S2']), fact('F05', 'SYN Bank A online banking', ['S2', 'S3']),
    fact('F06', ['Unfamiliar debit'], ['S3']), fact('F07', '16 October 2026 09:30 Australia/Sydney', ['S3']),
    fact('J02', 'Text message', ['S5'], 'EVID-01'), fact('J04', 'Reported available on phone; not provided or verified', ['S5'], 'EVID-01'),
  ];
  let record: CaseRecord = {
    schemaVersion: 1, synthetic: true, mode: 'mock', contentApproval: 'pending', caseId: 'EXAMPLE-01', evaluationId: 'T09', version: 1, stage,
    role: { id: 'EX-ROLE-01', version: 1, organisation: 'SYN Bank A', title: 'Intake Officer', permissions: ['Record synthetic case', 'Check facts', 'Prepare local drafts'], recipients: [{ id: 'HANDOVER-BANK', title: 'SYN Bank A / designated human review team' }, { id: 'HANDOVER-TELCO', title: 'SYN Telco B / designated human intake team' }], contentApproval: 'pending', enabled: false, synthetic: true },
    facts, analysis: { version: 1, basedOnCaseVersion: 1, source: 'mock', types: ['Suspected phishing'], reasons: ['CONTACT-01: reported bank impersonation SMS; EVENT-01: reported credential entry.'], alternatives: ["Sender identity and the debit's connection to the SMS are unverified."], gaps: ['Transaction time', 'Payment method', 'Recipient', 'Continuing contact'], facts: [], guidanceStatus: 'unapproved', recommendations: [] },
    followUp: { rounds: 0, totalQuestions: 0, stopped: false, questions: [] }, outputs: [], reviews: [], saved: true, needsFactConfirmation: false,
  };
  if (stage === 'intake' || stage === 'model-error') {
    if (stage === 'model-error') record.error = { kind: 'model', message: 'Simulated timeout. Input and saved facts retained; retry available.' };
    return CaseRecordSchema.parse(record);
  }
  record = markSaved(confirmFacts(correctFact(record, { fieldId: 'E04', recordId: 'TX-01' }, 200, sourceText.correction)), true);
  if (stage === 'corrected') return CaseRecordSchema.parse(record);
  record.followUp = { rounds: 1, totalQuestions: 3, stopped: false, questions: structuredClone(fixedQuestions) };
  record = answerQuestion(record, 'Q1', sourceText.answer1, 'answered', [{ target: { fieldId: 'E09', recordId: 'TX-01' }, value: 'reported pending' }]);
  if (stage === 'partial') return CaseRecordSchema.parse(markSaved(record, true));
  record = answerQuestion(record, 'Q2', sourceText.answer2, 'unknown');
  record = answerQuestion(record, 'Q3', sourceText.answer2, 'unknown');
  record = markSaved(stopFollowUp(record), true);
  if (stage === 'stopped') return CaseRecordSchema.parse(record);
  const dependencies = Object.fromEntries(record.facts.map(f => [factDependency(f), f.version]));
  Object.assign(dependencies, { analysis: record.analysis.version, role: record.role.version });
  record.outputs = [{ id: 'SUMMARY', kind: 'summary', version: 1, title: 'Local factual summary — training simulation',
    body: sourceText.summary.replaceAll('[current integer version]', String(record.version)), dependencies, contentApproval: 'pending' }];
  if (stage === 'handover') {
    record.outputs.push(...(['BANK', 'TELCO'] as const).map(recipient => ({ id: `HANDOVER-${recipient}`, kind: 'handover' as const, version: 1,
      title: `Draft for ${recipient} — unapproved teaching text`, body: `TRAINING SIMULATION ONLY — CONTENT NOT APPROVED\n\n${sourceText.sharedSummary}\n\n${sourceText[recipient === 'BANK' ? 'bank' : 'telco']}`.replaceAll('[current integer version]', String(record.version)),
      recipient: { ...record.role.recipients.find(profile => profile.id === `HANDOVER-${recipient}`)! }, recommendationIds: [],
      dependencies: { ...dependencies }, contentApproval: 'pending' as const })));
  }
  if (stage === 'reviewed' || stage === 'stale' || stage === 'save-error' || stage === 'handover') {
    for (const output of record.outputs) record = markSaved(reviewOutput(record, output.id), true);
  }
  if (stage === 'stale') record = correctFact(record, { fieldId: 'E04', recordId: 'TX-01' }, 250, 'Independent post-review correction variant');
  if (stage === 'save-error') record = markSaved(record, false);
  record.stage = stage;
  return CaseRecordSchema.parse(record);
}
