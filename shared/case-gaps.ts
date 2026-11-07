import type { FactRecord, Target } from './schema.js';
import type { RuntimeCaseRecord } from './runtime.js';

export type CurrentFactGap = { target: Target; status: FactRecord['status']; reason: string };
const gapPattern = /^Unresolved ([A-J]\d{2}):(.*)$/;
export function isFieldGap(note: string): boolean { return gapPattern.test(note); }
export function currentFactGaps(record: RuntimeCaseRecord): CurrentFactGap[] {
  return record.facts.filter(f => f.status !== 'not-applicable' && (f.value === null || ['missing', 'unclear', 'conflict'].includes(f.status)))
    .map(f => ({ target: { fieldId: f.fieldId, ...(f.recordId ? { recordId: f.recordId } : {}) }, status: f.status, reason: f.status === 'conflict' ? 'Conflict requires employee review' : 'Information not supplied or unclear' }));
}
export function hasStaleFieldGaps(record: RuntimeCaseRecord): boolean {
  const current = new Set(currentFactGaps(record).map(gap => `Unresolved ${gap.target.fieldId}:${gap.target.recordId ?? ''}`));
  return record.analysis.gaps.some(gap => isFieldGap(gap) && !current.has(gap));
}
export function refreshRuntimeGaps(record: RuntimeCaseRecord, options: { origin: 'local' | 'analysis' } = { origin: 'local' }): RuntimeCaseRecord {
  const notes = record.analysis.gaps.filter(gap => !isFieldGap(gap));
  const gaps = [...currentFactGaps(record).map(gap => `Unresolved ${gap.target.fieldId}:${gap.target.recordId ?? ''}`), ...(options.origin === 'analysis' ? notes : [])];
  if (JSON.stringify(gaps) === JSON.stringify(record.analysis.gaps)) return record;
  const next = structuredClone(record);
  if (options.origin === 'local' && notes.length) {
    next.analysisGapHistory ??= [];
    if (!next.analysisGapHistory.some(h => h.analysisVersion === record.analysis.version && JSON.stringify(h.gaps) === JSON.stringify(notes))) next.analysisGapHistory.push({ analysisVersion: record.analysis.version, gaps: notes });
  }
  next.analysis.gaps = gaps;
  next.analysis.version++;
  next.version++;
  next.saved = false;
  return next;
}
export function repairStaleRuntimeGaps(record: RuntimeCaseRecord): RuntimeCaseRecord {
  if (!hasStaleFieldGaps(record)) return record;
  const repaired = refreshRuntimeGaps(record);
  if (!repaired.analysisUpdate || repaired.analysisUpdate.status === 'current') repaired.analysisUpdate = { status: 'pending', operation: 'reanalysis' };
  return repaired;
}
