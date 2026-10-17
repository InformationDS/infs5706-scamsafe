import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server/src/app';
import { readConfig } from '../server/src/config';
import { moduleNames, type ModuleName } from '../shared/module-ports';

const name = process.argv[2] as ModuleName;
if (!moduleNames.includes(name)) throw new Error('Use npm run check:module -- intake|model|guidance|outputs evidence/task-results/A01/run-N/module');
const directory = resolve(process.argv[3] ?? `evidence/task-results/A01/run-01/${name}`);
const within = relative(resolve('evidence'), directory);
if (!within || isAbsolute(within) || within.split(sep).includes('..')) throw new Error('Evidence directory must be within project evidence.');
try { await access(resolve(directory, 'result.json')); throw new Error('Evidence already exists; choose a fresh batch.'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
await mkdir(directory, { recursive: true });
let providerRequests = 0;
const server = createApp({ config: readConfig({ MODEL_MODE: 'mock' }), fetchImpl: async () => { providerRequests++; throw new Error('No provider authorized'); } }).listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address(); if (!address || typeof address === 'string') throw new Error('No loopback address');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1100 } });
const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
const checks: string[] = []; let failure: string | undefined;
const status = (text: string) => page.getByRole('status').filter({ hasText: text }).waitFor();
const state = async () => JSON.parse(await page.getByTestId('runtime-record').textContent() ?? '{}');
const button = (text: string) => page.getByRole('button', { name: text, exact: true });
async function reset(variant: string) {
  await page.getByLabel('Fixed runtime variant').selectOption(variant); await button('Reset fixed input').click();
  if (await page.getByRole('dialog').count()) await button('Discard changes and continue').click();
  await status(`Reset ${variant}`);
}
try {
  await page.goto(`http://127.0.0.1:${address.port}/?module=${name}`);
  await status('No runtime history');
  await page.getByRole('heading', { name: new RegExp(`MOCK (substitute|test controls) — ${name}`) }).waitFor();
  checks.push('independent URL starts with explicit MOCK substitute');
  await reset('corrected'); assert.equal((await state()).facts.find((f: {fieldId:string}) => f.fieldId === 'E04').value, 200);
  await button('Save runtime case').click(); await status('Saved after IndexedDB');
  await page.reload(); await status('Saved runtime case restored');
  assert.equal((await state()).saved, true); assert.equal((await state()).stage, 'corrected');
  checks.push('save commits, refresh restores facts/history');
  await button('Delayed MOCK analysis').click(); await status('MOCK analysis pending');
  await button('MOCK change amount to 250').click(); await status('Stale response ignored');
  assert.equal((await state()).facts.find((f: {fieldId:string}) => f.fieldId === 'E04').value, 250);
  checks.push('delayed old 2000 proposal cannot overwrite current 250');
  await button('New synthetic case').click(); await button('Cancel').click(); assert.equal((await state()).caseId, 'EXAMPLE-01');
  await page.getByLabel('Simulate save failure', {exact:true}).check();
  await button('New synthetic case').click(); await button('Save and continue').click(); await status('Simulated save failure');
  assert.equal((await state()).caseId, 'EXAMPLE-01'); assert.equal((await state()).saved, false);
  await page.getByLabel('Simulate save failure', {exact:true}).uncheck(); await button('Save and continue').click(); await status('New synthetic case');
  const newId = (await state()).caseId; assert.notEqual(newId, 'EXAMPLE-01');
  await button('Save runtime case').click(); await status('Saved after IndexedDB');
  await page.getByLabel('Saved case', {exact:true}).selectOption('EXAMPLE-01'); await button('Open saved case').click(); await status('Saved case opened');
  assert.equal((await state()).facts.find((f:{fieldId:string}) => f.fieldId === 'E04').value, 250);
  checks.push('new/list/open isolates cases; Cancel and failed Save and continue retain original; retry switches');
  await button('MOCK timeout').click(); await status('MODEL_TIMEOUT'); await button('MOCK invalid output').click(); await status('MODEL_INVALID_OUTPUT');
  assert.equal((await state()).facts.find((f:{fieldId:string}) => f.fieldId === 'E04').value, 250);
  checks.push('timeout/invalid errors preserve input');
  await button('Run MOCK guidance port').click(); await status('MOCK guidance port');
  checks.push('injected guidance decisions port is callable without D');
  const downloadEvent = page.waitForEvent('download'); await button('Download runtime backup').click(); const backup = await downloadEvent; await backup.saveAs(resolve(directory, 'runtime-backup.json'));
  await button('MOCK change amount to 250').click();
  await page.getByLabel('Import runtime backup').setInputFiles(resolve(directory, 'runtime-backup.json')); await status('Import with unsaved changes is not supported');
  await button('Save runtime case').click(); await status('Saved after IndexedDB');
  await page.getByLabel('Import runtime backup').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
  await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent?.includes('JSON'));
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByLabel('Import runtime backup').setInputFiles(resolve(directory, 'runtime-backup.json')); await status('Import cancelled');
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('Import runtime backup').setInputFiles(resolve(directory, 'runtime-backup.json')); await status('Backup validated, saved and opened');
  assert.equal((await state()).saved, true);
  checks.push('JSON backup, invalid rejection, unsaved guard, same-ID cancel/confirm restore');
  for (const variant of ['partial','unknown','limit','stopped','rejected','role-stale','guidance-stale','single-edit','save-error']) {
    await reset(variant); assert.equal((await state()).stage, variant);
  }
  checks.push('all partial/unknown/limits/stopped/rejection/context/edit/save-failure variants reset independently');
  await reset('no-guidance'); await button('Save runtime case').click(); await status('Saved after IndexedDB');
  const noGuidance = await state(); assert.equal(noGuidance.outputs.length,1); assert.equal(noGuidance.recommendations.length,0);
  const markdownEvent = page.waitForEvent('download'); await button('Download MOCK markdown').click(); const md = await markdownEvent; await md.saveAs(resolve(directory, 'no-guidance.md'));
  await status('MOCK markdown downloaded');
  const pdfEvent = page.waitForEvent('download'); await button('Download MOCK pdf').click(); const pdf = await pdfEvent; await pdf.saveAs(resolve(directory, 'no-guidance.pdf')); await status('MOCK pdf downloaded');
  const pdfPageEvent = context.waitForEvent('page'); await button('Open MOCK PDF').click(); const pdfPage = await pdfPageEvent; await status('MOCK PDF opened locally.'); await writeFile(resolve(directory,'pdf-open.json'), JSON.stringify({url:pdfPage.url(), pages:context.pages().length}));
  assert.ok(context.pages().includes(pdfPage)); assert.equal((await readFile(resolve(directory,'no-guidance.pdf'))).subarray(0,5).toString(), '%PDF-'); await pdfPage.close();
  checks.push('no-guidance saved summary generates Markdown and PDF; PDF popup created (native renderer not observable headlessly; render files separately)');
  await reset('output-error'); await button('Save runtime case').click(); await status('Saved after IndexedDB');
  const before = await state(); await button('Download MOCK pdf').click(); await status('EXPORT_FAILED');
  assert.deepEqual((await state()).reviews, before.reviews); assert.deepEqual((await state()).outputs, before.outputs);
  await page.getByLabel('Simulate output failure', {exact:true}).uncheck();
  const retry = page.waitForEvent('download'); await button('Download MOCK pdf').click(); await (await retry).saveAs(resolve(directory, 'retry-same-snapshot.pdf')); await status('MOCK pdf downloaded');
  checks.push('output failure retains body/reviews; same snapshot PDF retry succeeds');
  await reset('guidance-stale'); await button('Save runtime case').click(); await status('Saved after IndexedDB');
  await page.getByLabel('Output object').selectOption('HANDOVER-BANK'); await button('Download MOCK pdf').click(); await status('EXPORT_REVIEW_REQUIRED');
  checks.push('stale guidance blocks reviewed handover output');
  await page.screenshot({ path: resolve(directory, 'preview.png'), fullPage: true });
  assert.deepEqual(errors, []); assert.equal(providerRequests,0);
} catch (error) { failure = String(error); await page.screenshot({ path: resolve(directory,'failure.png'), fullPage:true }).catch(() => {}); }
finally {
  await writeFile(resolve(directory,'result.json'), JSON.stringify({module:name, browser:browser.version(), checks, errors, providerRequests, failure:failure ?? null, scope:'A01 MOCK foundation only'}, null,2));
  await context.close(); await browser.close(); await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
}
if (failure) throw new Error(failure);
console.log(`${name}: ${checks.length} browser checks passed; providerRequests=0. Evidence: ${directory}`);
