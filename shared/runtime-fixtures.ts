import roleJson from '../data/business/role.json';
import guidelinesJson from '../data/business/guidelines.json';
import baselineJson from '../data/business/T09.json';
import prototype from '../data/evaluation/prototype.json';
import { ApprovedRoleSchema, ApprovedGuidelineSchema, BusinessCaseSchema } from './business.js';
import { makeFixture, sourceText } from './fixtures.js';
import { RuntimeCaseRecordSchema, runtimeDependencies, type RuntimeCaseRecord } from './runtime.js';
export const runtimeVariants = prototype.variants;
const baseline = BusinessCaseSchema.parse(baselineJson);
export function makeRuntimeFixture(id = 'T09', instanceId = 'fixture-instance'): RuntimeCaseRecord {
  const spec = runtimeVariants.find(v => v.id === id);
  if (!spec) throw new Error('Unknown runtime fixture');
  const old = makeFixture(spec.start);
  let r: RuntimeCaseRecord = {
    ...old, schemaVersion: 2, instanceId, role: ApprovedRoleSchema.parse(roleJson), roleRevision: 1, guidanceRevision: 1,
    guidelines: guidelinesJson.map(g => ApprovedGuidelineSchema.parse(g)), guidanceStatus: 'available',
    sources: [
      ...['S1','S2','S3','S4','S5'].map((sourceId, i) => ({ id: sourceId, kind: 'narrative' as const, text: baseline.input.split('\n\n')[i] })),
      ...(spec.start !== 'intake' ? [{ id: 'CORRECTION-01', kind: 'correction' as const, text: sourceText.correction, target: baseline.correction.target }] : []),
      ...baseline.questions.filter(q => old.followUp.questions.some(saved => saved.id === q.id && ['answered','unknown'].includes(saved.status))).map((q) => ({ id: q.id, kind: 'answer' as const, text: q.id === 'Q1' ? sourceText.answer1 : sourceText.answer2, target: q.target })),
    ],
    outputs: [], recommendations: [], reviews: old.reviews.filter(v => v.stage === 'first').map(v => ({ ...v, actor: 'MOCK-STAFF', reviewedAt: '2026-10-17T00:00:00.000Z' })), saved: false,
  };
  if (spec.start === 'handover' || id === 'output-error') {
    r.recommendations = baseline.recommendations.map((rec, i) => ({
      id: rec.id, version: 1, responsibleRole: rec.responsibleRole, step: rec.step,
      priority: { order: i + 1, reason: rec.priority }, dependencies: { role: 1, guidance: 1, [`guideline:${rec.guidelineId}`]: 1, 'fact:E04:TX-01': 2 },
      factRefs: [{ fieldId: 'E04', recordId: 'TX-01' }], guidelineRefs: [{ id: rec.guidelineId, version: 1 }], limits: [rec.dependency],
      decision: rec.expectedDecision, decisionReason: rec.reason, simulated: true, contentApproval: 'pending', history: [],
    }));
    const deps = runtimeDependencies(r);
    const baseDeps = Object.fromEntries(Object.entries(deps).filter(([key]) => !key.startsWith('recommendation:')));
    const shared = baseline.bodies.sharedSummary.replace('Reviewed for record accuracy by STAFF-EX01;', 'MOCK reference; no actual employee review;').replaceAll('[current integer version]', String(r.version));
    r.outputs = [
      { id: 'SUMMARY', kind: 'summary', body: shared, recommendationIds: [] },
      { id: 'HANDOVER-BANK', kind: 'handover', body: shared + '\n\n' + baseline.bodies.bank, recipient: r.role.recipients[0], recommendationIds: ['REC-01'] },
      { id: 'HANDOVER-TELCO', kind: 'handover', body: shared + '\n\n' + baseline.bodies.telecom, recipient: r.role.recipients[1], recommendationIds: ['REC-02', 'REC-03'] },
    ].map(o => ({ ...o, kind: o.kind as 'summary' | 'handover', version: 1, title: `${o.id} — MOCK local draft`, contentApproval: 'pending', employeeEdited: false, history: [],
      dependencies: { ...baseDeps, ...Object.fromEntries(o.recommendationIds.map(key => [`recommendation:${key}`, 1])) } }));
  }
  if (id === 'no-guidance') {
    r.guidanceStatus = 'none'; r.guidelines = [];
    r.outputs = [{ id: 'SUMMARY', kind: 'summary', version: 1, title: 'Local factual summary — MOCK', body: baseline.bodies.factualSummary.replaceAll('[current integer version]', String(r.version)), dependencies: runtimeDependencies(r), contentApproval: 'pending', employeeEdited: false, history: [] }];
  }
  if (id === 'stopped') { r.followUp.stopped = true; r.followUp.questions.forEach(q => { if (q.status === 'pending') q.status = 'skipped'; }); }
  if (id === 'limit') {
    const targets = [{fieldId:'E03',recordId:'TX-01'},{fieldId:'E06',recordId:'TX-01'},{fieldId:'C05',recordId:'CONTACT-01'},{fieldId:'C07',recordId:'CONTACT-01'},{fieldId:'J03',recordId:'EVID-01'},{fieldId:'J05',recordId:'EVID-01'}];
    r.followUp.questions.push(...targets.map((target, i) => ({ id: `MOCK-Q${i+4}`, target, round: i < 3 ? 2 : 3, text: `MOCK limit fixture: ${target.fieldId} / ${target.recordId}`, reason: 'Counter boundary only; not approved business wording.', status: 'unknown' as const, answer: null, history: [] })));
    r.followUp.rounds = 3; r.followUp.totalQuestions = 9;
  }
  for (const object of [...r.outputs, ...r.recommendations]) r.reviews.push({ stage: 'final', objectId: object.id, objectVersion: object.version, dependencies: { ...object.dependencies }, simulated: true, actor: 'MOCK-STAFF', reviewedAt: '2026-10-17T00:00:00.000Z' });
  if (id === 'single-edit') {
    const o = r.outputs.find(o => o.id === 'HANDOVER-BANK')!;
    o.history.push({ previous: o.body, reason: 'Independent single-object edit fixture', actor: 'MOCK-STAFF' }); o.employeeEdited = true; o.body += '\nEmployee edited (MOCK): preserve uncertainty.'; o.version++;
  }
  if (id === 'rejected') {
    const rec = r.recommendations.find(x => x.id === 'REC-03')!;
    rec.history.push({ previous: 'pending decision (MOCK pre-review dependency)', reason: rec.decisionReason!, actor: 'MOCK-STAFF' });
    rec.version++; // post-review rejection invalidates only dependent TELCO
  }
  if (id === 'role-stale') { r.roleRevision++; r.role = { ...r.role, permissions: [] }; }
  if (id === 'guidance-stale') { r.guidanceRevision++; r.guidanceStatus = 'stale'; }
  if (id === 'stale') {
    const f = r.facts.find(f => f.fieldId === 'E04')!;
    f.history.push({ value: f.value, reason: 'MOCK late response variant', sourceIds: f.sourceIds }); f.value = 250; f.version++; r.version++; r.needsFactConfirmation = true;
  }
  r.stage = id;
  return RuntimeCaseRecordSchema.parse(r);
}
