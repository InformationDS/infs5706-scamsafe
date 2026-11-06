import { RuntimeCaseRecordSchema, dependenciesValid, runtimeSnapshot, runtimeReviewValid, type RuntimeCaseRecord, type RuntimeExportSnapshot } from './runtime';
import { factLabel, readableText } from './presentation';
import { reconcileAnalysisGaps } from './intake';
import { actionableRecommendations, activeRecommendations, evaluateGuidance, NO_GUIDANCE } from './guidance';

type Output = RuntimeCaseRecord['outputs'][number];
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(',')}}`;
  return JSON.stringify(v) ?? 'undefined';
}
const equal = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
const target = (f: RuntimeCaseRecord['facts'][number]) => `${f.fieldId}:${f.recordId ?? ''}`;
const value = (v: unknown): string => v === null ? 'Unknown / not supplied' : Array.isArray(v) ? v.join('; ') : String(v);
const cell = (v: unknown) => value(v).replaceAll('|', '\\|').replaceAll('\n', '<br>');
export const outputNotice = 'SYNTHETIC CASE · Reported information requires verification. Prepared locally for employee review.';

/** Uses current structured values, never the reference body's approval wording. */
export function outputProposals(r: RuntimeCaseRecord): Output[] {
  RuntimeCaseRecordSchema.parse(r);
  const available = r.guidanceStatus === 'available' && !evaluateGuidance(r).summaryOnly;
  const recs = available ? actionableRecommendations(r) : [];
  const usedSources = new Set(r.facts.flatMap(f => [...f.sourceIds, ...f.candidates.flatMap(c => c.sourceIds), ...f.history.flatMap(h => h.sourceIds)]));
  const facts = r.facts.filter(f => f.fieldId !== 'A07'); // narrative is retained below as labelled source, not a second current value
  const base = { analysis: r.analysis.version, role: r.roleRevision, guidance: r.guidanceRevision,
    ...Object.fromEntries(r.facts.map(f => [`fact:${target(f)}`, f.version])) };
  const reported = ['## Current reported facts',
    '| Information | Current reported value | Status / check | Sources |', '| --- | --- | --- | --- |',
    ...facts.map(f => `| ${cell(factLabel(f))} | ${cell(f.fieldId === 'E02' ? readableText(value(f.value)) : f.value)} | ${cell(`${f.status} / ${f.reviewStatus}`)} | ${cell(f.sourceIds.join(', ') || 'None')} |`), '',
    'Amounts are reported values, not verified losses. Transactions remain separate by record, currency and status; unknown values are not zero.', '',
    '## Candidate analysis (not a confirmed scam finding)', ...r.analysis.types.map(t => `- ${t}`),
    ...r.analysis.reasons.map(t => `- Basis: ${readableText(t)}`), ...r.analysis.alternatives.map(t => `- Uncertainty: ${readableText(t)}`),
    ...r.analysis.gaps.map(t => `- Gap: ${readableText(t)}`), '', '## Unresolved information',
    ...facts.filter(f => f.value === null || ['missing','unclear','conflict'].includes(f.status)).map(f => `- ${factLabel(f)}: ${f.status}; current ${value(f.value)}${f.status === 'conflict' && f.candidates.length ? `; alternative reports ${f.candidates.map(c => `${value(c.value)} [${c.sourceIds.join(', ')}]`).join(' / ')}` : ''}`),
    '', '## Reported sources and correction history (historical wording may differ from current values)',
    ...r.sources.filter(s => usedSources.has(s.id)).map(s => `- ${s.id} (${s.kind}): ${s.text}`),
    ...facts.flatMap(f => f.history.map(h => `- ${factLabel(f)} previous ${value(h.value)}: ${h.reason} [${h.sourceIds.join(', ')}]`)),
    '', '## Recorded response boundaries',
    'Reported responses are listed in the current facts when supplied. Unknown response details remain unknown. No external execution or receipt is established by this local record.'
  ].join('\n');
  const guidanceText = (selected: typeof recs) => available ? ['## Proposed local preparation (acceptance is not execution)',
    ...selected.flatMap(rec => [`- ${readableText(rec.id)} [${rec.decision}${rec.simulated ? '; MOCK decision' : ''}]: ${rec.step}`,
      `  Basis: ${rec.guidelineRefs.map(g => `${readableText(g.id)} v${g.version}`).join(', ')}; ${rec.responsibleRole}; priority ${rec.priority.order}: ${readableText(rec.priority.reason)}`,
      ...rec.limits.map(l => `  Limit / uncertainty: ${readableText(l)}`)]),
    selected.length ? '' : 'No actionable local preparation remains after the recorded decisions.'
  ].join('\n') : NO_GUIDANCE;
  const make = (id: string, selected: typeof recs, recipient?: Output['recipient']): Output => ({
    id, kind: recipient ? 'handover' : 'summary', version: 1, title: recipient ? `Local draft for ${recipient.title}` : 'Unified factual summary',
    body: [reported, recipient ? `\n## Intended recipient\n${recipient.title}\n${'recipientResponsibilities' in r.role ? r.role.recipientResponsibilities[recipient.id] ?? '' : ''}\nSharing permission remains unverified unless explicitly recorded. No sending performed.` : '', guidanceText(selected)].filter(Boolean).join('\n\n'),
    dependencies: { ...base, ...Object.fromEntries(selected.flatMap(rec => Object.entries({ ...rec.dependencies, [`recommendation:${rec.id}`]: rec.version }))) },
    contentApproval: 'pending', employeeEdited: false, history: [], recommendationIds: selected.map(rec => rec.id), ...(recipient ? { recipient } : {}),
  });
  const outputs = [make('SUMMARY', recs)];
  for (const recipient of r.role.recipients) {
    const basis = recipient.id === 'HANDOVER-BANK' ? 'EX-G01' : recipient.id === 'HANDOVER-TELCO' ? 'EX-G02' : null;
    const selected = recs.filter(rec => rec.guidelineRefs.some(g => g.id === basis || (basis === 'EX-G02' && g.id === 'EX-G03')));
    if (basis && selected.some(rec => rec.guidelineRefs.some(g => g.id === basis))) outputs.push(make(recipient.id, selected, recipient));
  }
  return outputs;
}

function changed(r: RuntimeCaseRecord): RuntimeCaseRecord { r.version++; r.saved = false; return RuntimeCaseRecordSchema.parse(r); }
export function regenerateOutputs(record: RuntimeCaseRecord, options: { actor?: string; reason?: string; replaceEdited?: string[] } = {}): { record: RuntimeCaseRecord; protectedIds: string[] } {
  record = reconcileAnalysisGaps(record);
  const next = structuredClone(record), protectedIds: string[] = [];
  for (const proposal of outputProposals(record)) {
    const old = next.outputs.find(o => o.id === proposal.id);
    if (old && equal({ ...old, version: 1, employeeEdited: false, history: [] }, proposal)) continue;
    if (old?.employeeEdited && !options.replaceEdited?.includes(old.id)) { protectedIds.push(old.id); continue; }
    if (old?.employeeEdited && (!options.actor?.trim() || !options.reason?.trim())) throw new Error('Employee identifier and replacement reason are required.');
    if (old) {
      const history = [...old.history, { previous: old.body, actor: options.actor?.trim() || 'SYSTEM', reason: options.reason?.trim() || 'Regenerated on current structured facts and guidance; prior body retained.' }];
      Object.assign(old, proposal, { version: old.version + 1, employeeEdited: old.employeeEdited, history });
    } else next.outputs.push(proposal);
  }
  // Ineligible historical objects remain visible for inspection only; outputCurrent blocks them.
  return { record: equal(next, record) ? record : changed(next), protectedIds };
}
export function editOutput(record: RuntimeCaseRecord, id: string, body: string, options: { actor: string; reason: string }): RuntimeCaseRecord {
  if (!options.actor.trim() || !options.reason.trim() || !body.trim()) throw new Error('Employee identifier, edit reason and body are required.');
  const next = structuredClone(record), o = next.outputs.find(o => o.id === id);
  if (!o) throw new Error('Output not found.');
  if (o.body === body) return record;
  o.history.push({ previous: o.body, actor: options.actor.trim(), reason: options.reason.trim() });
  o.body = body; o.employeeEdited = true; o.version++;
  return changed(next);
}
export function outputCurrent(r: RuntimeCaseRecord, id: string): boolean {
  const o = r.outputs.find(o => o.id === id), p = outputProposals(r).find(o => o.id === id);
  return !!o && !!p && dependenciesValid(r, o.dependencies) && equal(o.dependencies, p.dependencies) && equal(o.recommendationIds, p.recommendationIds) && equal(o.recipient, p.recipient);
}
function readyForReview(r: RuntimeCaseRecord) {
  if (r.needsFactConfirmation || r.facts.some(f => f.reviewStatus === 'unreviewed')) throw new Error('Return to Check information and confirm the current facts or changes before final review.');
}
export function finalReview(record: RuntimeCaseRecord, id: string, actor: string, acknowledged: boolean, reviewedAt = new Date().toISOString()): RuntimeCaseRecord {
  if (!actor.trim() || !acknowledged) throw new Error('Employee identifier and explicit final-review acknowledgement are required.');
  readyForReview(record);
  const output = record.outputs.find(o => o.id === id);
  const object = output ?? activeRecommendations(record).find(o => o.id === id);
  if (!object || !dependenciesValid(record, object.dependencies) || (output && !outputCurrent(record, id))) throw new Error('Regenerate the affected output on current dependencies before final review.');
  const refs = output?.recommendationIds ?? [id];
  for (const ref of refs) {
    const rec = activeRecommendations(record).find(r => r.id === ref);
    if (!rec || rec.simulated || !['accepted','modified'].includes(rec.decision)) throw new Error('Accept or modify each referenced recommendation in Prepare materials before final review.');
    if (output && !runtimeReviewValid(record, ref)) throw new Error(`Final review required for recommendation ${ref}.`);
  }
  const next = structuredClone(record);
  next.reviews.push({ stage: 'final', objectId: id, objectVersion: object.version, dependencies: { ...object.dependencies }, simulated: false, actor: actor.trim(), reviewedAt });
  return changed(next);
}
/** Records one explicit review scope while preserving each object's dependency record. */
export function finalReviewSelection(record: RuntimeCaseRecord, outputIds: string[], actor: string, acknowledged: boolean): RuntimeCaseRecord {
  const ids = [...new Set(outputIds)];
  if (!ids.length) throw new Error('Select at least one document to review.');
  const outputs = ids.map(id => {
    const output = record.outputs.find(o => o.id === id);
    if (!output || !outputCurrent(record, id)) throw new Error('Update all selected documents before reviewing them.');
    return output;
  });
  if (!actor.trim() || !acknowledged) throw new Error('Employee identifier and explicit final-review acknowledgement are required.');
  readyForReview(record);
  // Work on returned copies only. A failure never publishes a partial review batch.
  let next = record;
  const refs = [...new Set(outputs.flatMap(o => o.recommendationIds ?? []))];
  for (const id of refs) if (!runtimeReviewValid(next, id)) next = finalReview(next, id, actor, true);
  for (const id of ids) if (!runtimeReviewValid(next, id)) next = finalReview(next, id, actor, true);
  return next;
}

/** One gate for preview, clipboard and both downloads, also called by the server. */
export function outputSnapshot(record: RuntimeCaseRecord, id: string): RuntimeExportSnapshot {
  RuntimeCaseRecordSchema.parse(record); readyForReview(record);
  if (!outputCurrent(record, id)) throw new Error('Output is inactive or its basis changed. Regenerate and review current content.');
  const o = record.outputs.find(o => o.id === id)!;
  for (const ref of o.recommendationIds ?? []) {
    const rec = activeRecommendations(record).find(r => r.id === ref);
    if (!rec || rec.simulated || !['accepted','modified'].includes(rec.decision)) throw new Error('Current employee recommendation decision required.');
  }
  return runtimeSnapshot(record, id);
}
