import { CaseRecordSchema, type CaseRecord } from '../../shared';

export async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('scamsafe-foundation', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('cases', { keyPath: 'caseId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Local database unavailable. Keep this page open and retry.'));
    request.onblocked = () => reject(new Error('Close other workbench tabs and retry.'));
  });
}

export async function saveCase(input: CaseRecord, fail = false): Promise<CaseRecord> {
  const record = CaseRecordSchema.parse({ ...input, saved: true });
  if (fail) throw new Error('Simulated save failure. Current input remains unsaved.');
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('cases', 'readwrite');
    transaction.objectStore('cases').put(record);
    transaction.oncomplete = () => { database.close(); resolve(record); };
    transaction.onerror = transaction.onabort = () => { database.close(); reject(new Error('Save failed. Current input is retained; retry saving.')); };
  });
}

export async function loadCase(): Promise<CaseRecord | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('cases', 'readonly');
    const request = transaction.objectStore('cases').get('EXAMPLE-01');
    let value: unknown;
    request.onsuccess = () => { value = request.result; };
    transaction.oncomplete = () => {
      database.close();
      if (!value) { resolve(undefined); return; }
      const result = CaseRecordSchema.safeParse(value);
      if (result.success) resolve(result.data);
      else reject(new Error('Stored case has an incompatible structure. Preserve it and contact A.'));
    };
    transaction.onerror = () => { database.close(); reject(new Error('Cannot read saved case.')); };
  });
}

export function backupCase(record: CaseRecord): string {
  return JSON.stringify({ kind: 'ScamSafe training backup', schemaVersion: 1, record: CaseRecordSchema.parse(record) }, null, 2);
}

export function parseBackup(text: string): CaseRecord {
  const parsed = JSON.parse(text) as { kind?: string; schemaVersion?: number; record?: unknown };
  if (parsed.kind !== 'ScamSafe training backup' || parsed.schemaVersion !== 1) throw new Error('Unsupported backup. Current case was kept.');
  const record = CaseRecordSchema.parse(parsed.record);
  if (record.caseId !== 'EXAMPLE-01' || record.evaluationId !== 'T09') throw new Error('This foundation restores only the EXAMPLE-01 / T09 training case. Current case was kept.');
  return CaseRecordSchema.parse({ ...record, saved: false });
}
