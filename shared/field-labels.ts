import type { FactRecord, Target } from './schema.js';

const groups: Record<string, { group: string; labels: string[] }> = {
  A: { group: 'Case context', labels: ['Case ID','Received time','Employee sector','Employee organisation','Employee role','Authorised permissions','Initial description','Case version'] },
  B: { group: 'People and support', labels: ['Report source','Affected person identifier','Reporter relationship to affected person','Expressed feelings or difficulties','Expressed support needs','Communication language needs','Accessibility or communication needs'] },
  C: { group: 'Contacts and events', labels: ['Contact ID','Contact time','Contact channel','Claimed identity or organisation','Platform or service','Other party identifiers','Requests made by the other party','Continuing contact'] },
  D: { group: 'Contacts and events', labels: ['Event ID','Event time','Person acting','Action and reported result','Related contacts, transactions or evidence'] },
  E: { group: 'Transactions', labels: ['Payment reported or requested','Transaction ID','Transaction time','Reported amount','Currency','Payment method','Paying institution or channel','Recipient or channel','Transaction status'] },
  F: { group: 'Information exposure and remote access', labels: ['Information provided or entered','Information categories','Submission channel or recipient','Submission time','Affected account or service','Observed account anomalies','Anomaly discovery time'] },
  G: { group: 'Information exposure and remote access', labels: ['Installation or access requested','Devices involved','Software or tool','Access or permissions granted','Remote connection continuing'] },
  H: { group: 'Scenario details', labels: ['Investment or project description','Promised returns or investment inducement','Withdrawal or additional payment experience','Relationship and duration','Reason for payment request or manipulation','Original payment purpose and recipient','Changed payment instructions and channel','Independent verification of change','Claimed identity and inducement','Claimed technical support and request'] },
  I: { group: 'Reported responses and evidence', labels: ['Response ID','Person taking action','Action taken','Action time','Organisation contacted and case ID','Reported result or outstanding matter'] },
  J: { group: 'Reported responses and evidence', labels: ['Evidence ID','Evidence type','Evidence summary','Evidence availability','Related facts or records'] },
};
export const fieldLabels: Readonly<Record<string, { label: string; group: string }>> = Object.fromEntries(Object.entries(groups).flatMap(([letter, data]) => data.labels.map((label, index) => [`${letter}${String(index + 1).padStart(2, '0')}`, { label, group: data.group }])));
export function fieldLabel(fieldId: string): string { return fieldLabels[fieldId]?.label ?? fieldId; }
export function fieldGroup(fieldId: string): string { return fieldLabels[fieldId]?.group ?? 'Other'; }
export function targetLabel(target: Target): string { return `${fieldLabel(target.fieldId)}${target.recordId ? ` · ${target.recordId}` : ''}`; }
export function factValueLabel(value: FactRecord['value']): string {
  if (value === null) return 'Unknown / not supplied';
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (Array.isArray(value)) return value.join('; ');
  const display: Record<string, string> = { 'reported pending': 'Reported pending', 'reported completed': 'Reported completed', 'requested only': 'Requested only' };
  return typeof value === 'string' ? display[value] ?? value : String(value);
}
