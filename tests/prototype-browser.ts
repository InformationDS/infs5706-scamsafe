import assert from 'node:assert/strict';
import { once } from 'node:events';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server/src/app';
import { readConfig } from '../server/src/config';
import { ModelSettingsStore } from '../server/src/model-settings';
import { RuntimeCaseRecordSchema, runtimeReviewValid } from '../shared/runtime';
import { outputSnapshot } from '../shared/outputs';
import { outputSnapshotToMarkdown } from '../shared/export';

const directory = resolve(process.argv[2] ?? 'evidence/integration/2026-11-05/run-03/prototype');
const within = relative(resolve('evidence'), directory);
if (!within || isAbsolute(within) || within.split(sep).includes('..')) throw new Error('Use a new evidence subdirectory.');
try { await access(resolve(directory, 'result.json')); throw new Error('Evidence exists. Choose a fresh batch.'); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
await mkdir(directory, { recursive: true });
let providerRequests = 0;
const server = createApp({ settingsStore: new ModelSettingsStore({ config: readConfig({}), persist: () => {} }),
  fetchImpl: async () => { providerRequests++; throw new Error('External providers are not authorised in this check.'); },
}).listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address(); assert.ok(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors: string[] = [], checks: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const intake = page.getByRole('region', { name: 'B01 case intake and follow-up' });
const guidance = page.getByRole('region', { name: 'Guidance and employee decisions' });
const outputs = page.getByRole('region', { name: 'Materials and final review' });
const button = (name: string) => page.getByRole('button', { name, exact: true });
const stage = (number: number) => page.getByRole('navigation', { name: 'Case stages' }).getByRole('button').nth(number - 1).click();
const state = async () => RuntimeCaseRecordSchema.parse(JSON.parse(await page.getByTestId('runtime-record').textContent() ?? '{}'));
const intakeStatus = (text: string) => intake.getByRole('status').filter({ hasText: text }).waitFor();
const outputStatus = (text: string) => outputs.getByRole('status').filter({ hasText: text }).waitFor();
const hostStatus = (text: string) => page.getByRole('status').filter({ hasText: text }).waitFor();
async function review(id: string) {
  await stage(5);
  if (id.startsWith('REC-')) return; // Referenced recommendations are reviewed atomically with the selected documents.
  await outputs.getByLabel('Document to inspect or export', { exact: true }).selectOption(id);
  await outputs.getByRole('checkbox', { name: /^I checked the current facts/ }).check();
  await button('Review selected documents and recommendations').click();
  await outputStatus('Selected documents and referenced recommendations reviewed');
}
async function save() {
  await button('Save case').click();
  await hostStatus('Case saved locally');
  assert.equal((await state()).saved, true);
}
async function download(format: 'markdown' | 'pdf', filename: string) {
  const pending = page.waitForEvent('download');
  await button(format === 'pdf' ? 'Download PDF' : 'Download Markdown').click();
  await (await pending).saveAs(resolve(directory, filename));
}
let failure: string | null = null;
try {
  await page.goto(`${origin}/?test=1`);
  await hostStatus('No runtime history');
  await page.getByText('Test controls and local case management', { exact: true }).click();
  await page.getByLabel('Case employee identifier', { exact: true }).fill('SYNTHETIC-PROTOTYPE-TEST');
  await button('Confirm working context').click(); await intake.waitFor();
  assert.equal(await page.locator('section[aria-label="Guidance and employee decisions"]').count(), 1, 'one D workspace mounted across stages');
  const registration = await (await page.request.get(`${origin}/api/runtime/context`)).json();
  assert.equal(registration.modelRegistered, true); assert.equal(registration.outputRegistered, true);
  await intake.getByRole('button', { name: 'Analyze current description', exact: true }).click();
  await intakeStatus('Analysis proposal received');
  await stage(2);
  const amountRow = intake.getByRole('row').filter({ has: page.getByText('Transaction 1 · Amount', { exact: true }) });
  await amountRow.getByRole('textbox').fill('200');
  await amountRow.getByRole('button', { name: 'Apply', exact: true }).click();
  await button('Complete first fact check').click(); await intakeStatus('First fact check recorded and saved');
  assert.equal((await state()).saved, true);
  await stage(3);
  await button('Save and display proposed questions').click(); await intakeStatus('Round 1 saved and displayed');
  const q1 = intake.locator('.intake-question').filter({ hasText: 'Q1 ·' });
  await q1.getByRole('textbox').fill('reported pending');
  await q1.getByRole('button', { name: 'Save answer and update target', exact: true }).click(); await intakeStatus('Answer for Q1 saved');
  await intake.locator('.intake-question').filter({ hasText: 'Q2 ·' }).getByRole('button', { name: 'Unknown / unable to answer', exact: true }).click();
  await intakeStatus('Answer for Q2 saved');
  await button('End follow-up').click(); await intakeStatus('Follow-up ended and saved');
  const checked = await state();
  assert.equal(checked.followUp.rounds, 1); assert.equal(checked.followUp.totalQuestions, 3);
  assert.equal(checked.followUp.questions[1].status, 'unknown'); assert.equal(checked.followUp.questions[2].status, 'skipped');
  assert.ok(checked.reviews.filter(r => r.stage === 'first').every(r => r.simulated));
  checks.push('T09 starts at B analysis, corrects 2000 to 200, first-checks, saves 3 questions, answers/unknown/stops without fixture shortcuts');

  await stage(4);
  for (const id of ['REC-01', 'REC-02', 'REC-03']) await page.getByTestId(`guidance-${id}`).getByRole('button', { name: 'Accept suggestion', exact: true }).click();
  await button('Update recommendations and materials').click();
  assert.deepEqual((await state()).outputs.map(o => o.id), ['SUMMARY', 'HANDOVER-BANK', 'HANDOVER-TELCO']);
  assert.equal((await state()).reviews.filter(r => r.stage === 'final').length, 0);
  for (const id of ['REC-01', 'REC-02', 'REC-03', 'SUMMARY', 'HANDOVER-BANK', 'HANDOVER-TELCO']) await review(id);
  await save();
  assert.equal((await state()).reviews.filter(r => r.stage === 'final').length, 6);
  await outputs.getByLabel('Document to inspect or export', { exact: true }).selectOption('SUMMARY');
  await outputs.getByTitle('Reviewed document preview').waitFor();
  const summary = outputSnapshot(await state(), 'SUMMARY');
  await button('Copy Markdown').click(); await outputStatus('copy completed from Case summary');
  assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n'), outputSnapshotToMarkdown(summary));
  await download('markdown', 'summary.md');
  assert.equal(await readFile(resolve(directory, 'summary.md'), 'utf8'), outputSnapshotToMarkdown(summary));
  assert.match(summary.body, /\| Transaction 1 · Amount \| 200 \|/);
  await download('pdf', 'summary.pdf');
  checks.push('Actual D decisions and explicit E reviews gate same-snapshot preview, clipboard, Markdown and PDF with current 200');

  await outputs.getByLabel('Document to inspect or export', { exact: true }).selectOption('HANDOVER-BANK');
  await stage(4);
  await outputs.getByText('Edit body (record edits before closing)', { exact: true }).click();
  const bank = (await state()).outputs.find(o => o.id === 'HANDOVER-BANK')!;
  const editedBody = bank.body + '\n\n员工补充：保留不确定性。\n\n| 项目 | 合成说明 |\n| --- | --- |\n| 中文 | 尚未独立核实 |\n';
  let releaseExport!: () => void;
  const exportGate = new Promise<void>(resolve => { releaseExport = resolve; });
  let downloadsDuringEdit = 0;
  const countDownload = () => { downloadsDuringEdit++; };
  page.on('download', countDownload);
  await page.route('**/api/runtime/export', async route => {
    const response = await route.fetch();
    await exportGate;
    await route.fulfill({ response });
  });
  const exporting = page.waitForRequest(request => request.url().endsWith('/api/runtime/export'));
  await stage(5);
  await button('Download PDF').click(); await exporting;
  await stage(4);
  await outputs.getByLabel('Working body for Bank handover', { exact: true }).fill(editedBody);
  releaseExport();
  await outputStatus('Output response is stale');
  assert.equal(downloadsDuringEdit, 0);
  page.off('download', countDownload);
  await page.unroute('**/api/runtime/export');
  const beforeWorkingEdit = await state();
  assert.ok(await button('Download PDF').isDisabled());
  assert.ok(await button('Save case').isDisabled());
  for (const name of ['New synthetic case', 'Reset fixed input']) {
    await button(name).click(); await hostStatus('Record or discard the working output edit');
    assert.deepEqual(await state(), beforeWorkingEdit);
  }
  await page.getByRole('combobox', { name: /^Saved case/ }).selectOption(beforeWorkingEdit.caseId);
  await button('Open saved case').click(); await hostStatus('Record or discard the working output edit');
  await page.getByLabel('Import runtime backup').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await hostStatus('Record or discard the working output edit');
  await page.getByRole('link', { name: 'model', exact: true }).click();
  assert.equal(page.url(), `${origin}/?test=1`);
  assert.deepEqual(await state(), beforeWorkingEdit);
  assert.equal(await outputs.getByLabel('Working body for Bank handover', { exact: true }).inputValue(), editedBody);
  await outputs.getByLabel('Edit reason for Bank handover', { exact: true }).fill('Synthetic integration edit and shared guard exercise');
  await button('Record edit Bank handover').click();
  assert.equal(runtimeReviewValid(await state(), 'HANDOVER-BANK'), false);
  assert.equal(runtimeReviewValid(await state(), 'HANDOVER-TELCO'), true);
  await review('HANDOVER-BANK'); await save();
  const bankSnapshot = outputSnapshot(await state(), 'HANDOVER-BANK');
  await page.getByLabel('Simulate output failure', { exact: true }).check();
  await button('Download PDF').click(); await outputStatus('Output failed');
  assert.deepEqual(outputSnapshot(await state(), 'HANDOVER-BANK'), bankSnapshot);
  await page.getByLabel('Simulate output failure', { exact: true }).uncheck();
  await download('pdf', 'bank-retry.pdf');
  checks.push('Unrecorded E text blocks host save/new/reset/open/import/navigation; single-draft edit preserves TELCO review; same-version failure retry succeeds');

  await stage(4);
  await guidance.getByLabel('Decision reason for Message evidence note', { exact: true }).fill('Existing clues already covered');
  await page.getByTestId('guidance-REC-03').getByRole('button', { name: 'Reject suggestion', exact: true }).click();
  assert.equal(runtimeReviewValid(await state(), 'HANDOVER-BANK'), true);
  assert.equal(runtimeReviewValid(await state(), 'HANDOVER-TELCO'), false);
  await button('Update documents / compare employee edits').click();
  await outputs.getByRole('dialog', { name: 'Protect employee edits' }).waitFor();
  await button('Keep employee content / refresh other drafts').click();
  assert.doesNotMatch((await state()).outputs.find(o => o.id === 'HANDOVER-TELCO')!.body, /Message evidence note v/);
  await stage(2);
  await amountRow.getByRole('textbox').fill('250'); await amountRow.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.equal((await state()).needsFactConfirmation, true);
  assert.ok(await button('Download PDF').isDisabled());
  await button('Confirm changes to checked facts').click(); await intakeStatus('First fact check recorded and saved');
  await stage(4); await button('Update documents / compare employee edits').click();
  await outputs.getByRole('dialog', { name: 'Protect employee edits' }).waitFor();
  assert.equal((await state()).outputs.find(o => o.id === 'HANDOVER-BANK')!.body, editedBody);
  await outputs.getByLabel('Replacement reason', { exact: true }).fill('Compared updated 250 facts with the previous employee draft');
  await button('Confirm replacement of compared drafts').click();
  const replacement = (await state()).outputs.find(o => o.id === 'HANDOVER-BANK')!;
  assert.match(replacement.body, /\| Transaction 1 · Amount \| 250 \|/);
  assert.equal(replacement.history.at(-1)?.previous, editedBody);
  assert.equal((await state()).recommendations.find(r => r.id === 'REC-03')!.decision, 'rejected');
  checks.push('D rejection updates dependent TELCO; B shared correction requires confirmation; regenerating current 250 protects employee text until explicit comparison/replacement');

  await button('Suspend guidance').click(); await button('Update documents / compare employee edits').click();
  await outputs.getByLabel('Document to inspect or export', { exact: true }).selectOption('SUMMARY');
  await review('SUMMARY'); await save();
  const factualSummary = outputSnapshot(await state(), 'SUMMARY');
  assert.match(factualSummary.body, /Insufficient approved guidance; human review required/);
  assert.doesNotMatch(factualSummary.body, /Intended recipient|Message evidence note v|Bank assessment request v/);
  await download('markdown', 'no-guidance.md'); await download('pdf', 'no-guidance.pdf');
  const blocked = await page.request.post(`${origin}/api/runtime/export`, { data: { case: await state(), objectId: 'HANDOVER-BANK', format: 'markdown' } });
  assert.equal(blocked.status(), 409);
  const beforeRefresh = await state();
  await page.reload(); await hostStatus('Saved runtime case restored');
  await button('Confirm working context').click(); await stage(5); await outputs.waitFor();
  assert.deepEqual((await state()).followUp, beforeRefresh.followUp);
  assert.equal(outputSnapshot(await state(), 'SUMMARY').body, factualSummary.body);
  checks.push('No-guidance summary alone is reviewed/exported, historical handover is blocked by server; refresh retains counters, decisions, review and valid summary');
  await outputs.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(directory, 'prototype.png') });
  assert.deepEqual(errors, []); assert.equal(providerRequests, 0);
} catch (error) { failure = String(error); await page.screenshot({ path: resolve(directory, 'failure.png') }); }
finally {
  await writeFile(resolve(directory, 'result.json'), JSON.stringify({ checks, errors, providerRequests, failure, browser: browser.version(), scope: 'Integrated synthetic T09 and no-guidance paths, explicit automated review actions; human/F acceptance remains separate' }, null, 2));
  await browser.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
}
if (failure) throw new Error(failure);
console.log(`Prototype: ${checks.length} workflow groups passed; providerRequests=0`);
