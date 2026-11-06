import assert from 'node:assert/strict';
import { once } from 'node:events';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server/src/app';
import { readConfig } from '../server/src/config';
import { ModelSettingsStore } from '../server/src/model-settings';
import { runtimeReviewValid, ticketCurrent, type RuntimeCaseRecord } from '../shared/runtime';

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
const stage = (number: number) => page.getByRole('navigation', { name: 'Case stages' }).getByRole('button').nth(number - 1).click();
async function confirmContext() {
  await page.getByLabel('Case employee identifier', { exact: true }).fill('SYNTHETIC-TEST-EMPLOYEE');
  await button('Confirm working context').click();
}
async function reset(variant: string) {
  await page.getByLabel('Fixed runtime variant').selectOption(variant);
  await button('Reset fixed input').click();
  if (await page.getByRole('dialog').count()) await button('Discard changes and continue').click();
  await status(`Reset ${variant}`);
}
let failure: string | null = null;
try {
  await page.goto(`http://127.0.0.1:${address.port}/?module=model`);
  await status('No runtime history'); await model.waitFor();
  const context = await page.request.get(`http://127.0.0.1:${address.port}/api/runtime/context`);
  const registration = await context.json();
  assert.equal(registration.modelRegistered, true); assert.equal(registration.outputRegistered, true);
  checks.push('C independent diagnostic entry and C/E services are registered; integrated mount checked after shared-case transfer');
  await reset('corrected'); const original = await state();
  const analyzing = page.waitForResponse(response => response.url().endsWith('/api/runtime/analyze'));
  await model.getByRole('button', { name: 'Analyze current case', exact: true }).click();
  const analysis = await (await analyzing).json();
  await model.getByRole('status').filter({ hasText: 'Analysis ready' }).waitFor();
  assert.deepEqual(await state(), original);
  const amount = model.getByRole('row').filter({ hasText: 'E04 / TX-01' });
  assert.equal(await amount.locator('td').nth(1).innerText(), '2000');
  assert.equal(await amount.locator('td').nth(2).innerText(), '200');
  checks.push('C corrected 200 vs proposal 2000 remains separate; no fake B merge or question counting');
  await button('Save runtime case').click(); await status('Saved after IndexedDB');
  await page.goto(`http://127.0.0.1:${address.port}/?test=1`);
  await status('No runtime history');
  await page.getByText('Test controls and local case management', { exact: true }).click();
  await page.getByLabel('Saved case', { exact: true }).selectOption(original.caseId);
  await button('Open saved case').click();
  if (await page.getByRole('dialog').count()) await button('Discard changes and continue').click();
  await status('Saved case opened');
  assert.equal(await page.locator('section[aria-label="B01 case intake and follow-up"]').count(), 1);
  assert.equal(await page.locator('section[aria-label="Guidance and employee decisions"]').count(), 1);
  assert.equal(await page.locator('section[aria-label="Materials and final review"]').count(), 1);
  await confirmContext(); await stage(4);
  assert.deepEqual((await state()).recommendations.map(r => r.id), ['REC-01','REC-02','REC-03']);
  assert.equal(ticketCurrent(await state(), analysis.ticket, analysis.ticket.requestId, analysis.ticket.settingsRevision), false);
  await page.getByLabel('Decision reason for Message evidence note', { exact: true }).fill('Duplicate information in synthetic test');
  await page.getByTestId('guidance-REC-03').getByRole('button', { name: 'Reject suggestion', exact: true }).click(); await button('Recalculate guidance').click();
  let record = await state();
  assert.equal(record.recommendations.find(r => r.id === 'REC-03')!.decision, 'rejected');
  assert.deepEqual(record.facts, original.facts); assert.deepEqual(record.followUp, original.followUp);
  assert.equal(record.reviews.filter(r => !r.simulated).length, 0);
  checks.push('Integrated B/D/E share the saved C case; D matches three guidelines, rejection survives recalculation without changing facts/counts or reviews; old C ticket is invalid');
  await page.getByLabel('Simulate save failure', { exact: true }).check();
  await button('Save case').click(); await status('Simulated save failure');
  assert.equal((await state()).saved, false);
  await page.getByLabel('Simulate save failure', { exact: true }).uncheck();
  await button('Save case').click(); await status('Case saved locally');
  await page.reload(); await status('Saved runtime case restored');
  record = await state(); assert.equal(record.saved, true);
  assert.equal(record.recommendations.find(r => r.id === 'REC-03')!.decision, 'rejected');
  checks.push('Failed save retains unsaved decision; successful retry and refresh restore rejection/history in integration session');
  await page.getByText('Test controls and local case management', { exact: true }).click();
  await button('Confirm working context').click(); await stage(4);
  const facts = structuredClone(record.facts), follow = structuredClone(record.followUp), reviews = structuredClone(record.reviews);
  await button('Suspend guidance').click(); await button('Recalculate guidance').click();
  assert.equal((await state()).guidanceStatus, 'stale');
  await guidance.getByText('Earlier suggestions — inactive', { exact: true }).click();
  assert.ok(await page.getByTestId('guidance-REC-03').getByRole('button', { name: 'Reject suggestion', exact: true }).isDisabled());
  await button('Reload approved guidance').click();
  assert.equal((await state()).recommendations.find(r => r.id === 'REC-03')!.decision, 'rejected');
  await stage(1); await page.getByRole('combobox', { name: /^Organisation and role/ }).selectOption('inactive');
  record = await state(); assert.equal(record.guidanceStatus, 'none');
  assert.deepEqual(record.facts, facts); assert.deepEqual(record.followUp, follow); assert.deepEqual(record.reviews, reviews);
  await page.getByRole('combobox', { name: /^Organisation and role/ }).selectOption('EX-ROLE-01');
  checks.push('Suspended guidance/restricted role disable actions, retain facts/counts/review history; restoration retains rejection');
  await reset('no-guidance'); await confirmContext(); await stage(4);
  record = await state(); assert.equal(record.recommendations.length, 0); assert.equal(record.outputs.length, 1);
  await guidance.getByText('Insufficient approved guidance; human review required', { exact: true }).waitFor();
  checks.push('No-guidance matching produces no recipient actions; fixture summary awaits explicit E generation and review');
  await page.screenshot({ path: resolve(directory, 'no-guidance.png'), fullPage: true });
  await reset('output-error'); await confirmContext(); await stage(4);
  assert.ok(!(await state()).outputs.some(o => runtimeReviewValid(await state(), o.id)));
  const diagnostic = page.getByText('Diagnostic MOCK controls — foundation fixtures only', { exact: true });
  await diagnostic.click();
  await page.getByLabel('Simulate output failure', { exact: true }).uncheck();
  await button('Save case').click(); await status('Case saved locally');
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
    scope: 'B/C/D/E mounted, C/D and storage regression; complete output flow checked separately', browser: browser.version() }, null, 2));
  await browser.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
}
if (failure) throw new Error(failure);
console.log(`Integration workspace: ${checks.length} checks passed; providerRequests=0`);
