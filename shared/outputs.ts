import { targetLabel, factValueLabel } from './field-labels';
import { currentFactGaps, isFieldGap } from './case-gaps';
import { RuntimeCaseRecordSchema, dependenciesValid, runtimeSnapshot, runtimeReviewValid, type RuntimeCaseRecord, type RuntimeExportSnapshot } from './runtime';
import { actionableRecommendations, activeRecommendations, evaluateGuidance, NO_GUIDANCE } from './guidance';

type Output = RuntimeCaseRecord['outputs'][number];
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(',')}}`;
  return JSON.stringify(v) ?? 'undefined';
}
const equal = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
const target = (f: Pick<RuntimeCaseRecord['facts'][number], 'fieldId' | 'recordId'>) => `${f.fieldId}:${f.recordId ?? ''}`;
const value = (v: unknown): string => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || (Array.isArray(v) && v.every(x => typeof x === 'string')) ? factValueLabel(v) : String(v);
const cell = (v: unknown) => value(v).replaceAll('|', '\\|').replaceAll('\n', '<br>');
export const outputNotice = 'SYNTHETIC · Content approval pending · Local draft only. Reported information is not independently verified. No action, delivery or referral has been performed.';

/** Uses current structured values, never the reference body's approval wording. */
export function outputProposals(r: RuntimeCaseRecord): Output[] {
  RuntimeCaseRecordSchema.parse(r);
  const available = r.guidanceStatus === 'available' && !evaluateGuidance(r).summaryOnly;
  const recs = available ? actionableRecommendations(r) : [];
  const usedSources = new Set(r.facts.flatMap(f => [...f.sourceIds, ...f.candidates.flatMap(c => c.sourceIds), ...f.history.flatMap(h => h.sourceIds)]));
  const facts = r.facts.filter(f => f.fieldId !== 'A07'); // narrative is retained below as labelled source, not a second current value
  const base = { analysis: r.analysis.version, role: r.roleRevision, guidance: r.guidanceRevision,
    ...Object.fromEntries(r.facts.map(f => [`fact:${target(f)}`, f.version])) };
  const reported = [outputNotice, '', '## Current reported facts',
    '| Field / record | Current reported value | Status / check | Sources |', '| --- | --- | --- | --- |',
    ...facts.map(f => `| ${cell(`${targetLabel(f)} (${target(f)})`)} | ${cell(f.value)} | ${cell(`${f.status} / ${f.reviewStatus}`)} | ${cell(f.sourceIds.join(', ') || 'None')} |`), '',
    'Amounts are reported values, not verified losses. Transactions remain separate by record, currency and status; unknown values are not zero.', '',
    '## Candidate analysis (not a confirmed scam finding)', ...r.analysis.types.map(t => `- ${t}`),
    ...r.analysis.reasons.map(t => `- Basis: ${t}`), ...r.analysis.alternatives.map(t => `- Uncertainty: ${t}`),
    ...r.analysis.gaps.filter(t => !isFieldGap(t)).map(t => `- Gap: ${t}`), '', '## Unresolved information',
    ...currentFactGaps(r).filter(g => g.target.fieldId !== 'A07').map(g => { const f = facts.find(f => target(f) === target(g.target))!; return `- ${cell(`${targetLabel(f)} (${target(f)})`)}: ${f.status}; current ${cell(f.value)}; candidates ${cell(JSON.stringify(f.candidates))}`; }),
    '', '## Reported sources and correction history (historical wording may differ from current values)',
    ...r.sources.filter(s => usedSources.has(s.id)).map(s => `- ${s.id} (${s.kind}): ${s.text}`),
    ...facts.flatMap(f => f.history.map(h => `- ${cell(`${targetLabel(f)} (${target(f)})`)} previous ${cell(h.value)}: ${h.reason} [${h.sourceIds.join(', ')}]`)),
    '', '## Recorded response boundaries',
    'Reported responses are listed in the current facts when supplied. Unknown response details remain unknown. No external execution or receipt is established by this local record.'
  ].join('\n');
  const guidanceText = (selected: typeof recs) => available ? ['## Proposed local preparation (acceptance is not execution)',
    ...selected.flatMap(rec => [`- ${rec.id} v${rec.version} [${rec.decision}${rec.simulated ? '; MOCK decision' : ''}]: ${rec.step}`,
      `  Basis: ${rec.guidelineRefs.map(g => `${g.id} v${g.version}`).join(', ')}; ${rec.responsibleRole}; priority ${rec.priority.order}: ${rec.priority.reason}`,
      ...rec.limits.map(l => `  Limit / uncertainty: ${l}`)]),
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
  if (r.needsFactConfirmation || r.facts.some(f => f.reviewStatus === 'unreviewed')) throw new Error('Current facts / changes require confirmation in B before final review. Fixed checked inputs may be used for independent E testing; their first reviews remain simulated.');
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
    if (!rec || rec.simulated || !['accepted','modified'].includes(rec.decision)) throw new Error('Record an actual accept / modify decision in D before final review of its dependent output.');
    if (output && !runtimeReviewValid(record, ref)) throw new Error(`Final review required for recommendation ${ref}.`);
  }
  const next = structuredClone(record);
  next.reviews.push({ stage: 'final', objectId: id, objectVersion: object.version, dependencies: { ...object.dependencies }, simulated: false, actor: actor.trim(), reviewedAt });
  return changed(next);
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
