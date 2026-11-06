import type { Target } from './schema.js';

const fieldNames: Record<string, string> = {
  A01: 'Case number', A02: 'Report time', A03: 'Industry', A04: 'Organisation', A05: 'Role', A06: 'Authority', A07: 'Original description', A08: 'Case version',
  B01: 'Report source', B02: 'Person reference', B03: 'Reporter relationship', B04: 'Reported concerns', B05: 'Support needs', B06: 'Language needs', B07: 'Communication needs',
  C01: 'Contact reference', C02: 'Contact time', C03: 'Contact channel', C04: 'Claimed identity', C05: 'Platform or service', C06: 'Reported identifiers', C07: 'Requested action', C08: 'Continuing contact',
  D01: 'Event reference', D02: 'Event time', D03: 'Person involved', D04: 'Reported action and result', D05: 'Related records',
  E01: 'Payment involvement', E02: 'Transaction reference', E03: 'Transaction time', E04: 'Amount', E05: 'Currency', E06: 'Payment method', E07: 'Paying institution or channel', E08: 'Recipient', E09: 'Transaction status',
  F01: 'Information provided', F02: 'Information categories', F03: 'Submission channel', F04: 'Submission time', F05: 'Affected account or service', F06: 'Account anomalies', F07: 'Anomaly discovery time',
  G01: 'Software or access requested', G02: 'Devices involved', G03: 'Software or tool', G04: 'Access granted', G05: 'Remote connection continuing',
  H01: 'Investment description', H02: 'Promised returns', H03: 'Withdrawal or additional payment', H04: 'Relationship and duration', H05: 'Payment request reason', H06: 'Original payment purpose', H07: 'Changed payment instructions', H08: 'Change independently checked', H09: 'Impersonation claim', H10: 'Technical support claim',
  I01: 'Response reference', I02: 'Person responding', I03: 'Action reported', I04: 'Response time', I05: 'Institution and case reference', I06: 'Reported result or next step',
  O07: 'Data sharing permission',
  J01: 'Evidence reference', J02: 'Evidence type', J03: 'Evidence description', J04: 'Evidence availability', J05: 'Related records',
};
export function recordLabel(id: string): string {
  const match = /^(TX|CONTACT|EVENT|RESPONSE|EVID)-(\d+)$/.exec(id);
  if (!match) return id;
  const names: Record<string, string> = { TX: 'Transaction', CONTACT: 'Contact', EVENT: 'Event', RESPONSE: 'Response', EVID: 'Evidence' };
  return `${names[match[1]]} ${Number(match[2])}`;
}
export function factLabel(target: Target): string {
  const field = fieldNames[target.fieldId] ?? target.fieldId;
  return target.recordId ? `${recordLabel(target.recordId)} · ${field}` : field;
}
export function outputLabel(id: string): string {
  return ({ SUMMARY: 'Case summary', 'HANDOVER-BANK': 'Bank handover', 'HANDOVER-TELCO': 'Telecommunications handover' } as Record<string, string>)[id] ?? id;
}
export function readableText(text: string): string {
  return text.replace(/(?<![A-Za-z0-9_-])([A-JO]\d{2})\b(?:\s*[:/]\s*((?:TX|CONTACT|EVENT|RESPONSE|EVID)-\d+))?/g, (_match, fieldId: string, recordId?: string) => factLabel({ fieldId, ...(recordId ? { recordId } : {}) }))
    .replace(/(Data sharing permission)::/g, '$1:')
    .replace(/\b(?:SUMMARY|HANDOVER-BANK|HANDOVER-TELCO)\b/g, outputLabel)
    .replace(/\b(?:TX|CONTACT|EVENT|RESPONSE|EVID)-\d+\b/g, recordLabel)
    .replace(/\b(?:REC-0[123]|EX-G0[123])\b/g, id => ({ 'REC-01': 'Bank assessment request', 'REC-02': 'Telecommunications assessment request', 'REC-03': 'Message evidence note', 'EX-G01': 'Bank assessment guidance', 'EX-G02': 'Telecommunications intake guidance', 'EX-G03': 'Message evidence guidance' } as Record<string, string>)[id]);
}
