import assert from 'node:assert/strict';
import { once } from 'node:events';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server/src/app';
import { readConfig } from '../server/src/config';
import { ModelSettingsStore } from '../server/src/model-settings';
import type { RuntimeCaseRecord } from '../shared/runtime';

const directory = resolve(process.argv[2] ?? 'evidence/integration/2026-10-30/run-02/workspace');
const within = relative(resolve('evidence'), directory);
if (!within || isAbsolute(within) || within.split(sep).includes('..')) throw new Error('Use a fresh evidence subdirectory.');
try { await access(resolve(directory, 'result.json')); throw new Error('Evidence exists; choose a new batch.'); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
await mkdir(directory, { recursive: true });
let providerRequests = 0;
const server = createApp({ settingsStore: new ModelSettingsStore({ config: readConfig({}), persist: () => {} }),
  fetchImpl: async () => { providerRequests++; throw new Error('No external provider authorised.'); },
}).listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address(); assert.ok(address && typeof address !== 'string');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors: string[] = [], checks: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const button = (name: string) => page.getByRole('button', { name, exact: true });
const status = (text: string) => page.getByRole('status').filter({ hasText: text }).waitFor();
const state = async (): Promise<RuntimeCaseRecord> => JSON.parse(await page.getByTestId('runtime-record').textContent() ?? '{}');
const model = page.getByRole('region', { name: 'Model analysis module' });
const guidance = page.getByRole('region', { name: 'Guidance and employee decisions' });
async function reset(variant: string) {
  await page.getByLabel('Fixed runtime variant').selectOption(variant);
  await button('Reset fixed input').click();
  if (await page.getByRole('dialog').count()) await button('Discard changes and continue').click();
  await status(`Reset ${variant}`);
}
let failure: string | null = null;
try {
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await status('No runtime history'); await model.waitFor(); await guidance.waitFor();
  await page.getByRole('heading', { name: 'B · Intake unavailable' }).waitFor();
  await page.getByRole('heading', { name: 'E · Review and output unavailable' }).waitFor();
  const context = await page.request.get(`http://127.0.0.1:${address.port}/api/runtime/context`);
  const registration = await context.json();
  assert.equal(registration.modelRegistered, true); assert.equal(registration.outputRegistered, false);
  checks.push('Root mounts actual C/D with explicit B/E gaps; C service registered, E absent');
  await reset('corrected'); const original = await state();
  await model.getByRole('button', { name: 'Analyze current case', exact: true }).click();
  await model.getByRole('status').filter({ hasText: 'Analysis ready' }).waitFor();
  assert.deepEqual(await state(), original);
  const amount = model.getByRole('row').filter({ hasText: 'E04 / TX-01' });
  assert.equal(await amount.locator('td').nth(1).innerText(), '2000');
  assert.equal(await amount.locator('td').nth(2).innerText(), '200');
  checks.push('C corrected 200 vs proposal 2000 remains separate; no fake B merge or question counting');
  await button('Recalculate guidance').click();
  assert.deepEqual((await state()).recommendations.map(r => r.id), ['REC-01','REC-02','REC-03']);
  await model.getByRole('heading', { name: 'Previous proposal — out of date' }).waitFor();
  await page.getByLabel('Employee identifier', { exact: true }).fill('SYNTHETIC-TEST-EMPLOYEE');
  await page.getByLabel('Reason for REC-03', { exact: true }).fill('Duplicate information in synthetic test');
  await button('Reject REC-03').click(); await button('Recalculate guidance').click();
  let record = await state();
  assert.equal(record.recommendations.find(r => r.id === 'REC-03')!.decision, 'rejected');
  assert.deepEqual(record.facts, original.facts); assert.deepEqual(record.followUp, original.followUp);
  assert.equal(record.reviews.filter(r => !r.simulated).length, 0);
  checks.push('D matches all three guidelines; rejection survives recomputation without changing facts/counts or creating reviews; C sees shared change');
  await page.getByLabel('Simulate save failure', { exact: true }).check();
  await button('Save runtime case').click(); await status('Simulated save failure');
  assert.equal((await state()).saved, false);
  await page.getByLabel('Simulate save failure', { exact: true }).uncheck();
  await button('Save runtime case').click(); await status('Saved after IndexedDB');
  await page.reload(); await status('Saved runtime case restored'); await guidance.waitFor();
  record = await state(); assert.equal(record.saved, true);
  assert.equal(record.recommendations.find(r => r.id === 'REC-03')!.decision, 'rejected');
  checks.push('Failed save retains unsaved decision; successful retry and refresh restore rejection/history in integration session');
  const facts = structuredClone(record.facts), follow = structuredClone(record.followUp), reviews = structuredClone(record.reviews);
  await button('Suspend guidance').click(); await button('Recalculate guidance').click();
  assert.equal((await state()).guidanceStatus, 'stale');
  assert.ok(await button('Reject REC-03').isDisabled());
  await button('Reload approved guidance').click();
  assert.equal((await state()).recommendations.find(r => r.id === 'REC-03')!.decision, 'rejected');
  await guidance.getByRole('combobox', { name: /^Organisation \/ role/ }).selectOption('inactive');
  record = await state(); assert.equal(record.guidanceStatus, 'none');
  assert.deepEqual(record.facts, facts); assert.deepEqual(record.followUp, follow); assert.deepEqual(record.reviews, reviews);
  await guidance.getByRole('combobox', { name: /^Organisation \/ role/ }).selectOption('EX-ROLE-01');
  checks.push('Suspended guidance/restricted role disable actions, retain facts/counts/review history; restoration retains rejection');
  await reset('no-guidance'); await button('Recalculate guidance').click();
  record = await state(); assert.equal(record.recommendations.length, 0); assert.equal(record.outputs.length, 1);
  await guidance.getByText('Insufficient approved guidance; human review required', { exact: true }).waitFor();
  checks.push('No-guidance matching produces no recipient actions; existing summary is a MOCK fixture, E workflow remains missing');
  await page.screenshot({ path: resolve(directory, 'no-guidance.png'), fullPage: true });
  await reset('output-error'); await button('Recalculate guidance').click();
  assert.ok((await guidance.innerText()).includes('Dependent output update required'));
  const diagnostic = page.getByText('Diagnostic MOCK controls — foundation fixtures only', { exact: true });
  await diagnostic.click();
  await page.getByLabel('Simulate output failure', { exact: true }).uncheck();
  await button('Save runtime case').click(); await status('Saved after IndexedDB');
  await page.getByRole('combobox', { name: /^Output object/ }).selectOption('HANDOVER-TELCO');
  const blocked = page.waitForResponse(r => r.url().endsWith('/api/runtime/export'));
  await button('Download MOCK markdown').click();
  assert.equal((await blocked).status(), 409);
  await status('EXPORT_REVIEW_REQUIRED');
  checks.push('D changes invalidate fixture dependencies; retained historical body cannot be exported by MOCK gate');
  await page.screenshot({ path: resolve(directory, 'workspace.png'), fullPage: true });
  assert.deepEqual(errors, []); assert.equal(providerRequests, 0);
} catch (error) { failure = String(error); await page.screenshot({ path: resolve(directory, 'failure.png'), fullPage: true }); }
finally {
  await writeFile(resolve(directory, 'result.json'), JSON.stringify({ checks, errors, providerRequests, failure,
    scope: 'Actual C/D integration and A storage; B/E absent; no full workflow acceptance', browser: browser.version() }, null, 2));
  await browser.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
}
if (failure) throw new Error(failure);
console.log(`Integration workspace: ${checks.length} checks passed; providerRequests=0`);
