import approvedRoleJson from '../data/business/role.json';
import approvedGuidelinesJson from '../data/business/guidelines.json';
import baselineJson from '../data/business/T09.json';
import { ApprovedRoleSchema, ApprovedGuidelineSchema } from './business';
import { RuntimeCaseRecordSchema, dependenciesValid, type RuntimeCaseRecord } from './runtime';
import type { FactRecord, Target } from './schema';

export const NO_GUIDANCE = 'Insufficient approved guidance; human review required';
export const approvedGuidanceRole = ApprovedRoleSchema.parse(approvedRoleJson);
export const approvedGuidelines = approvedGuidelinesJson.map(g => ApprovedGuidelineSchema.parse(g));
type Rec = RuntimeCaseRecord['recommendations'][number];
type Guide = RuntimeCaseRecord['guidelines'][number];
export type GuidanceMatch = { id: string; version: number; matched: boolean; reasons: string[]; factRefs: Target[]; sourceIds: string[]; unknowns: string[] };
export type GuidanceEvaluation = { matches: GuidanceMatch[]; recommendations: Rec[]; guidanceStatus: 'available' | 'none'; summaryOnly: boolean };
const key = (t: Target) => `${t.fieldId}:${t.recordId ?? ''}`;
// Object property order is not part of approved configuration identity.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
function fact(r: RuntimeCaseRecord, target: Target) { return r.facts.find(f => key(f) === key(target)); }
function sourced(r: RuntimeCaseRecord, f: FactRecord | undefined): f is FactRecord {
  return !!f && f.sourceIds.length > 0 && f.sourceIds.every(id => r.sources.some(s => s.id === id && s.text.trim()));
}
function reported(r: RuntimeCaseRecord, f: FactRecord | undefined): f is FactRecord {
  return !!f && f.status === 'extracted' && f.value !== null && sourced(r, f);
}
function roleValid(r: RuntimeCaseRecord) {
  const parsed = ApprovedRoleSchema.safeParse(r.role);
  if (!parsed.success) return false;
  const role = parsed.data;
  // A permission context may restrict this approved role, but cannot grant new powers.
  return role.id === approvedGuidanceRole.id && role.version === approvedGuidanceRole.version &&
    canonical({ ...role, permissions: approvedGuidanceRole.permissions, recipients: approvedGuidanceRole.recipients }) === canonical(approvedGuidanceRole) &&
    role.permissions.every(p => approvedGuidanceRole.permissions.includes(p)) &&
    role.recipients.every(p => approvedGuidanceRole.recipients.some(a => canonical(a) === canonical(p)));
}
const referenceParagraphs = baselineJson.input.split('\n\n');
function referenceSource(r: RuntimeCaseRecord, id: string, index: number) {
  // These approved teaching entries contain textual context, not a general NLP predicate.
  // Fail closed outside the approved source snapshot; never infer provider remit from a label.
  return r.sources.some(s => s.id === id && s.kind === 'narrative' && s.text.trim() === referenceParagraphs[index].trim());
}
function context(r: RuntimeCaseRecord, g: Guide, refs: Target[], reasons: string[], sources: Set<string>) {
  const use = (fieldId: string, recordId?: string) => {
    const target = { fieldId, ...(recordId ? { recordId } : {}) }, f = fact(r, target);
    if (f) { refs.push(target); f.sourceIds.forEach(s => sources.add(s)); }
    return f;
  };
  if (g.id === 'EX-G01') {
    const transaction = use('E02', 'TX-01'), debit = fact(r, { fieldId: 'F06' });
    if (!reported(r, transaction) || transaction.value !== 'TX-01' || !transaction.sourceIds.includes('S3') || !debit?.sourceIds.includes('S3') || !referenceSource(r, 'S3', 2)) reasons.push('F06 must refer specifically to TX-01 in the approved S3 source.');
    if (!r.role.permissions.includes('Prepare human assessment requests as local drafts')) reasons.push('Current role cannot prepare human assessment requests.');
    if (!r.role.recipients.some(p => p.id === 'HANDOVER-BANK')) reasons.push('Configured bank human assessment recipient is missing.');
    if (!fact(r, { fieldId: 'E07', recordId: 'TX-01' })?.sourceIds.includes('S3')) reasons.push('The reported bank must reference the corresponding S3 transaction source.');
  }
  if (g.id === 'EX-G02' || g.id === 'EX-G03') {
    if (!fact(r, { fieldId: 'C03', recordId: 'CONTACT-01' })?.sourceIds.includes('S1') || !referenceSource(r, 'S1', 0)) reasons.push('The SMS contact must reference the approved S1 report.');
  }
  if (g.id === 'EX-G02') {
    if (!referenceSource(r, 'S4', 3)) reasons.push('S4 does not establish the approved SYN Telco B mobile service relationship.');
    else sources.add('S4');
    if (!r.role.recipients.some(p => p.id === 'HANDOVER-TELCO') || !('recipientResponsibilities' in r.role) || r.role.recipientResponsibilities['HANDOVER-TELCO'] !== approvedGuidanceRole.recipientResponsibilities['HANDOVER-TELCO']) reasons.push('Configured telecom human intake responsibilities are missing.');
  }
  if (g.id === 'EX-G03') {
    const clue = use('J02', 'EVID-01');
    if (!reported(r, clue) || clue.value !== 'Text message' || !clue.sourceIds.includes('S5') || !referenceSource(r, 'S5', 4)) reasons.push('Existing corresponding SMS clues and their approved S5 source are required.');
  }
}

/** Deterministic matching of the three approved teaching entries, never model labels. */
export function evaluateGuidance(r: RuntimeCaseRecord): GuidanceEvaluation {
  const matches: GuidanceMatch[] = r.guidelines.map(g => {
    const reasons: string[] = [], refs: Target[] = [], sources = new Set<string>(), unknowns: string[] = [];
    const approved = approvedGuidelines.find(a => a.id === g.id);
    if (!approved || !ApprovedGuidelineSchema.safeParse(g).success || canonical(g) !== canonical(approved)) reasons.push('Guideline is unapproved, altered, disabled or not current in the approved package.');
    if (r.guidelines.filter(other => other.id === g.id).length !== 1) reasons.push('Conflicting or duplicate guideline definitions require human review.');
    if (!roleValid(r) || r.role.id !== g.roleId || !r.role.permissions.includes('Prepare local drafts')) reasons.push('Current organisation / role lacks approved drafting authority.');
    if (r.guidanceStatus === 'stale') reasons.push('Guidance context is stale; explicitly reload the approved package.');
    for (const condition of g.required) {
      const f = fact(r, condition.target), label = key(condition.target);
      if (f) refs.push(condition.target);
      if (f?.status === 'conflict' || f?.status === 'not-applicable') { reasons.push(`${label}: ${f.status} does not satisfy the condition.`); continue; }
      if (!f || f.value === null || f.status === 'missing' || f.status === 'unclear') {
        if (g.allowedUnknown.some(t => key(t) === label)) unknowns.push(`${label}: unknown; local preparation only.`);
        else reasons.push(`${label}: required fact is missing or unclear.`);
        continue;
      }
      if (!reported(r, f)) reasons.push(`${label}: a current fact with source references is required.`);
      else if (!condition.allowedValues.some(v => canonical(v) === canonical(f.value))) reasons.push(`${label}: reported value is outside this guideline.`);
      f.sourceIds.forEach(s => sources.add(s));
    }
    for (const t of g.allowedUnknown) {
      const f = fact(r, t);
      if (f) refs.push(t);
      if ((!f || f.value === null) && !unknowns.some(s => s.startsWith(key(t)))) unknowns.push(`${key(t)}: unknown; preserve this gap.`);
    }
    context(r, g, refs, reasons, sources);
    const uniqueRefs = [...new Map(refs.map(t => [key(t), t])).values()];
    return { id: g.id, version: g.version, matched: reasons.length === 0, reasons, factRefs: uniqueRefs, sourceIds: [...sources].sort(), unknowns };
  });
  const recommendations = matches.filter(m => m.matched).map(m => {
    const g = r.guidelines.find(g => g.id === m.id)!;
    const template = baselineJson.recommendations.find(b => b.guidelineId === g.id)!;
    const order = baselineJson.recommendations.indexOf(template) + 1;
    const dependencies = { role: r.roleRevision, [`guideline:${g.id}`]: g.version,
      ...Object.fromEntries(m.factRefs.map(t => [`fact:${key(t)}`, fact(r, t)!.version])) };
    return { id: template.id, version: 1, responsibleRole: `${r.role.organisation} / ${r.role.title}`, step: g.step,
      priority: { order, reason: template.priority }, dependencies, factRefs: m.factRefs, guidelineRefs: [{ id: g.id, version: g.version }],
      limits: [...g.limits, template.dependency, g.humanEscalation, ...m.unknowns,
        ...m.sourceIds.map(id => `Reported source ${id}: ${r.sources.find(s => s.id === id)!.text}`)],
      decision: 'pending' as const, decisionReason: null, simulated: false, contentApproval: 'pending' as const, history: [] };
  });
  return { matches, recommendations, guidanceStatus: recommendations.length ? 'available' : 'none', summaryOnly: recommendations.length === 0 };
}

/** Preserve stable IDs, employee decisions and edits. Inactive records remain as history only. */
export function recalculateGuidance(record: RuntimeCaseRecord): RuntimeCaseRecord {
  const next = structuredClone(record), result = evaluateGuidance(record);
  const activeIds = new Set(result.recommendations.map(r => r.id));
  next.recommendations = result.recommendations.map(proposal => {
    const old = record.recommendations.find(r => r.id === proposal.id);
    if (!old) return proposal;
    const updated = { ...proposal, decision: old.decision, decisionReason: old.decisionReason, history: old.history,
      step: recommendationEdited(old) ? old.step : proposal.step, simulated: old.simulated, version: old.version };
    if (canonical(updated) !== canonical(old)) updated.version++;
    return updated;
  });
  for (const old of record.recommendations.filter(r => !activeIds.has(r.id))) {
    // Keep references valid for output/review history, but permanently invalidate this basis.
    const inactive = { ...old, dependencies: { ...old.dependencies, role: 0 } };
    if (canonical(inactive) !== canonical(old)) inactive.version++;
    next.recommendations.push(inactive);
  }
  next.guidanceStatus = record.guidanceStatus === 'stale' ? 'stale' : result.guidanceStatus;
  if (record.guidanceStatus !== next.guidanceStatus) next.guidanceRevision++;
  if (canonical(next) === canonical(record)) return record;
  next.version++; next.saved = false;
  return RuntimeCaseRecordSchema.parse(next);
}

export function recommendationEdited(rec: Rec): boolean {
  return rec.decision === 'modified' || rec.history.some(h => { try { return JSON.parse(h.previous).decision === 'modified'; } catch { return false; } });
}

export function activeRecommendations(record: RuntimeCaseRecord): Rec[] {
  const matched = new Set(evaluateGuidance(record).recommendations.map(r => r.id));
  return record.recommendations.filter(r => matched.has(r.id) && dependenciesValid(record, r.dependencies));
}
export function actionableRecommendations(record: RuntimeCaseRecord): Rec[] {
  return activeRecommendations(record).filter(r => r.decision !== 'rejected');
}
export function decideRecommendation(record: RuntimeCaseRecord, id: string, decision: Rec['decision'], options: { actor: string; reason?: string; step?: string }): RuntimeCaseRecord {
  if (!options.actor.trim()) throw new Error('Enter an employee identifier to record a decision.');
  if (decision === 'pending') throw new Error('Use an explicit employee decision.');
  if (['modified', 'rejected'].includes(decision) && !options.reason?.trim()) throw new Error('A reason is required for modification or rejection.');
  if (decision === 'modified' && !options.step?.trim()) throw new Error('Modified recommendation text is required.');
  if (!activeRecommendations(record).some(r => r.id === id)) throw new Error('Recalculate current guidance before deciding this recommendation.');
  const next = structuredClone(record), rec = next.recommendations.find(r => r.id === id)!;
  const step = decision === 'modified' ? options.step!.trim() : rec.step;
  const reason = options.reason?.trim() || null;
  if (rec.decision === decision && rec.step === step && rec.decisionReason === reason) return record;
  rec.history.push({ previous: JSON.stringify({ step: rec.step, decision: rec.decision, reason: rec.decisionReason }), reason: reason ?? 'Employee accepted local preparation; no action performed.', actor: options.actor.trim() });
  rec.step = step; rec.decision = decision; rec.decisionReason = reason; rec.simulated = false; rec.version++;
  next.version++; next.saved = false;
  // E owns rewriting dependent bodies. Their dependency snapshots now fail validation.
  return RuntimeCaseRecordSchema.parse(next);
}

/** Handoff to E: refresh only listed outputs; never treat retained historical bodies as current. */
export function guidanceHandoff(record: RuntimeCaseRecord) {
  const active = new Set(activeRecommendations(record).map(r => r.id));
  const actionable = new Set(actionableRecommendations(record).map(r => r.id));
  return {
    summaryOnly: evaluateGuidance(record).summaryOnly,
    recommendations: record.recommendations.map(r => ({ id: r.id, version: r.version, decision: r.decision, dependencies: r.dependencies, active: active.has(r.id), includeAction: actionable.has(r.id) })),
    outputsToRefresh: record.outputs.filter(o => !dependenciesValid(record, o.dependencies) || (o.recommendationIds ?? []).some(id => !actionable.has(id)) || (evaluateGuidance(record).summaryOnly && o.kind === 'handover')).map(o => o.id),
  };
}

export function changeGuidanceContext(record: RuntimeCaseRecord, change: 'suspend-role' | 'restore-role' | 'suspend-guidance' | 'reload-guidance'): RuntimeCaseRecord {
  const next = structuredClone(record);
  if (change === 'suspend-role' || change === 'restore-role') {
    const role = structuredClone(approvedGuidanceRole);
    if (change === 'suspend-role') role.permissions = [];
    if (canonical(role) === canonical(record.role)) return record;
    next.role = role; next.roleRevision++;
  } else {
    if (change === 'suspend-guidance') { if (record.guidanceStatus === 'stale') return record; next.guidanceStatus = 'stale'; }
    else {
      // New guideline versions/removal while referenced need an A-owned archive contract.
      if (record.recommendations.some(r => r.guidelineRefs.some(ref => !approvedGuidelines.some(g => g.id === ref.id && g.version === ref.version)))) throw new Error('Referenced guideline versions require A to coordinate migration; history retained.');
      if (record.guidanceStatus !== 'stale' && canonical(record.guidelines) === canonical(approvedGuidelines)) return recalculateGuidance(record);
      next.guidelines = structuredClone(approvedGuidelines); next.guidanceStatus = 'available';
    }
    next.guidanceRevision++;
  }
  next.version++; next.saved = false;
  // A suspended context stays visibly stale; matching returns no active steps.
  if (change === 'suspend-guidance') {
    for (const rec of next.recommendations) { rec.dependencies.role = 0; rec.version++; }
    return RuntimeCaseRecordSchema.parse(next);
  }
  return recalculateGuidance(next);
}
