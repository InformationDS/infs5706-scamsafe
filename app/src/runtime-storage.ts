import { RuntimeCaseRecordSchema, type RuntimeCaseRecord } from '../../shared/runtime';
import { z } from 'zod';
const BackupSchema = z.object({ kind: z.literal('ScamSafe runtime backup'), schemaVersion: z.literal(2), record: RuntimeCaseRecordSchema }).strict();
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('scamsafe-runtime', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('cases', { keyPath: 'caseId' }); request.result.createObjectStore('sessions'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = request.onblocked = () => reject(new Error('Runtime storage unavailable; keep current input and retry.'));
  });
}
export async function saveRuntimeCase(input: RuntimeCaseRecord, session = 'default', fail = false): Promise<RuntimeCaseRecord> {
  const record = RuntimeCaseRecordSchema.parse({ ...input, saved: true });
  if (fail) throw new Error('Simulated save failure; input retained and unsaved.');
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cases', 'sessions'], 'readwrite');
    tx.objectStore('cases').put(record); tx.objectStore('sessions').put(record.caseId, session);
    tx.oncomplete = () => { db.close(); resolve(record); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Save failed; current input retained.')); };
  });
}
export async function listRuntimeCases(): Promise<RuntimeCaseRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cases', 'readonly'), request = tx.objectStore('cases').getAll();
    tx.oncomplete = () => { db.close(); try { resolve(request.result.map(r => RuntimeCaseRecordSchema.parse(r))); } catch { reject(new Error('Stored runtime data is incompatible; preserve it and contact A.')); } };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Cannot read runtime history.')); };
  });
}
export async function loadRuntimeCase(caseId?: string, session = 'default'): Promise<RuntimeCaseRecord | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cases', 'sessions'], 'readonly'); let record: unknown;
    const read = (id: string) => { const req = tx.objectStore('cases').get(id); req.onsuccess = () => { record = req.result; }; };
    if (caseId) read(caseId);
    else { const request = tx.objectStore('sessions').get(session); request.onsuccess = () => { if (request.result) read(request.result); }; }
    tx.oncomplete = () => { db.close(); try { resolve(record ? RuntimeCaseRecordSchema.parse(record) : undefined); } catch { reject(new Error('Stored runtime case invalid; current input retained.')); } };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Cannot restore runtime case.')); };
  });
}
export const backupRuntimeCase = (record: RuntimeCaseRecord) => JSON.stringify(BackupSchema.parse({ kind: 'ScamSafe runtime backup', schemaVersion: 2, record }), null, 2);
export const parseRuntimeBackup = (text: string): RuntimeCaseRecord => ({ ...BackupSchema.parse(JSON.parse(text)).record, saved: false, instanceId: crypto.randomUUID() });
export function assertImportAllowed(current: RuntimeCaseRecord): void {
  if (!current.saved) throw new Error('Import with unsaved changes is not supported pending the product rule. Save first; current case kept.');
}
