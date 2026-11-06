import assert from 'node:assert/strict';
import { once } from 'node:events';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { chromium, type Page } from 'playwright';
import { createApp } from '../server/src/app';
import { readConfig } from '../server/src/config';
import { ModelSettingsStore } from '../server/src/model-settings';
import { RuntimeCaseRecordSchema, runtimeReviewValid, type RuntimeCaseRecord } from '../shared/runtime';
import { outputSnapshot } from '../shared/outputs';
import { outputSnapshotToMarkdown } from '../shared/export';
import { changeGuidanceContext } from '../shared/guidance';

const directory = resolve(process.argv[2] ?? 'evidence/usability/2026-11-06/independent-auto/run-01');
const withinEvidence = relative(resolve('evidence'), directory);
if (!withinEvidence || isAbsolute(withinEvidence) || withinEvidence.split(sep).includes('..')) throw new Error('Use a new evidence subdirectory.');
await mkdir(directory, { recursive: true });
try { await access(resolve(directory, 'result.json')); throw new Error('Evidence batch exists. Use a new directory.'); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
let providerRequests = 0;
const server = createApp({ settingsStore: new ModelSettingsStore({ config: readConfig({}), persist: () => {} }),
  fetchImpl: async () => { providerRequests++; throw new Error('External providers are disabled in this check.'); },
}).listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address(); assert.ok(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
const page = await context.newPage(); page.setDefaultTimeout(10000);
const checks: string[] = [], errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const button = (name: string) => page.getByRole('button', { name, exact: true });
const stage = (number: number) => page.getByRole('navigation', { name: 'Case stages' }).getByRole('button').nth(number - 1).click();
const intake = page.getByRole('region', { name: 'B01 case intake and follow-up' });
const outputs = page.getByRole('region', { name: 'Materials and final review' });
async function save() {
  await button('Save case').click();
  await page.getByRole('status').filter({ hasText: 'Case saved locally' }).waitFor();
}
async function stored(target: Page = page): Promise<RuntimeCaseRecord> {
  const record = await target.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('scamsafe-runtime', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    return new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(['cases', 'sessions'], 'readonly');
      const session = tx.objectStore('sessions').get('integration'); let record: unknown;
      session.onsuccess = () => { const request = tx.objectStore('cases').get(session.result); request.onsuccess = () => { record = request.result; }; };
      tx.oncomplete = () => { db.close(); resolve(record); }; tx.onerror = () => reject(tx.error);
    });
  });
  return RuntimeCaseRecordSchema.parse(record);
}
async function reviewAll() {
  await outputs.getByRole('checkbox', { name: /^I checked the current facts/ }).check();
  await button('Review selected documents and recommendations').click();
  await outputs.getByRole('status').filter({ hasText: 'Selected documents and referenced recommendations reviewed' }).waitFor();
  await save();
}
async function download(name: string, filename: string) {
  const pending = page.waitForEvent('download'); await button(name).click(); await (await pending).saveAs(resolve(directory, filename));
}
async function seededPage(record: RuntimeCaseRecord): Promise<Page> {
  const isolated = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  const target = await isolated.newPage(); target.setDefaultTimeout(10000);
  target.on('pageerror', error => errors.push(error.message));
  await target.goto(origin); await target.getByRole('status').filter({ hasText: 'No runtime history' }).waitFor();
  await target.evaluate(async record => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('scamsafe-runtime', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['cases', 'sessions'], 'readwrite'); tx.objectStore('cases').put(record); tx.objectStore('sessions').put(record.caseId, 'integration');
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    });
  }, record);
  await target.reload(); await target.getByRole('status').filter({ hasText: 'Saved runtime case restored' }).waitFor();
  return target;
}
let failure: string | null = null;
try {
  await page.goto(origin); await page.getByRole('status').filter({ hasText: 'No runtime history' }).waitFor();
  await stage(2); assert.ok(await button('Confirm working context').isVisible());
  await page.getByLabel('Case employee identifier', { exact: true }).fill('SYN-USABILITY-AUTO');
  await button('Confirm working context').click();
  await button('Analyze current description').click();
  await intake.getByRole('status').filter({ hasText: 'Analysis proposal received' }).waitFor();
  await stage(2);
  const amountRow = intake.getByRole('row').filter({ has: page.getByText('Transaction 1 · Amount', { exact: true }) });
  await amountRow.getByRole('textbox').fill('200'); await amountRow.getByRole('button', { name: 'Apply', exact: true }).click();
  await button('Complete first fact check').click();
  await intake.getByRole('status').filter({ hasText: 'First fact check recorded and saved' }).waitFor();
  await stage(3); await button('Save and display proposed questions').click();
  await intake.getByRole('status').filter({ hasText: 'Round 1 saved and displayed' }).waitFor();
  const q1 = intake.locator('.intake-question').filter({ hasText: 'Q1 ·' });
  await q1.getByRole('textbox').fill('reported pending');
  await q1.getByRole('button', { name: 'Save answer and update target', exact: true }).click();
  await intake.getByRole('status').filter({ hasText: 'Answer for Q1 saved' }).waitFor();
  await intake.locator('.intake-question').filter({ hasText: 'Q2 ·' }).getByRole('button', { name: 'Unknown / unable to answer', exact: true }).click();
  await intake.getByRole('status').filter({ hasText: 'Answer for Q2 saved' }).waitFor();
  await button('End follow-up').click(); await intake.getByRole('status').filter({ hasText: 'Follow-up ended and saved' }).waitFor();
  const answered = await stored();
  assert.equal(answered.facts.find(f => f.fieldId === 'E09')!.value, 'reported pending');
  assert.ok(!answered.analysis.gaps.some(g => g.includes('E09')));
  assert.equal(answered.followUp.rounds, 1); assert.equal(answered.followUp.totalQuestions, 3);
  assert.deepEqual(answered.followUp.questions.map(q => q.status), ['answered', 'unknown', 'skipped']);
  checks.push('Normal five-stage intake, identity gating, 200 correction, first check, partial answer, unknown and stop; F01-001 current analysis reconciled.');

  await stage(4);
  for (const id of ['REC-01', 'REC-02', 'REC-03']) await page.getByTestId(`guidance-${id}`).getByRole('button', { name: 'Accept suggestion', exact: true }).click();
  await stage(5); await reviewAll();
  let record = await stored();
  assert.ok(record.outputs.every(o => runtimeReviewValid(record, o.id)));
  assert.ok(record.reviews.filter(r => r.stage === 'final').every(r => r.actor === 'SYN-USABILITY-AUTO'));
  assert.equal(record.reviews.filter(r => r.stage === 'final').length, 6);
  const summary = outputSnapshot(record, 'SUMMARY');
  assert.match(summary.body, /Transaction 1 · Amount \| 200/); assert.doesNotMatch(summary.body, /Unresolved E09/);
  await button('Copy Markdown').click();
  assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n'), outputSnapshotToMarkdown(summary));
  await download('Download Markdown', 'summary.md'); await download('Download PDF', 'summary.pdf');
  assert.equal(await readFile(resolve(directory, 'summary.md'), 'utf8'), outputSnapshotToMarkdown(summary));
  await page.screenshot({ path: resolve(directory, 'reviewed-summary.png'), fullPage: true });
  checks.push('Shared actor, coordinated decisions/materials, six per-object review records from one acknowledgement; clipboard and Markdown exact snapshot, PDF downloaded.');

  await stage(4);
  await page.getByLabel('Document to inspect or export', { exact: true }).selectOption('HANDOVER-BANK');
  await outputs.getByText('Edit body (record edits before closing)', { exact: true }).click();
  const bank = record.outputs.find(o => o.id === 'HANDOVER-BANK')!;
  const edited = `${bank.body}\n\n员工补充，信息尚未独立核实。\n\n| 项目 | 状态 |\n| --- | --- |\n| 中文测试 | 合成案例 |\n`;
  await outputs.getByLabel('Working body for Bank handover', { exact: true }).fill(edited);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Save case' && button.disabled));
  assert.ok(await button('Save case').isDisabled());
  await stage(5); assert.ok(await page.getByLabel('Working body for Bank handover', { exact: true }).isVisible());
  await outputs.getByLabel('Edit reason for Bank handover', { exact: true }).fill('Synthetic Chinese body and protection test');
  await button('Record edit Bank handover').click();
  await stage(5); await reviewAll();
  await download('Download PDF', 'bank-chinese.pdf');
  record = await stored();
  assert.equal(record.outputs.find(o => o.id === 'HANDOVER-BANK')!.body, edited);
  assert.ok(runtimeReviewValid(record, 'HANDOVER-TELCO'));
  checks.push('Unrecorded body blocks save and stage navigation; recorded Chinese bank edit keeps other review current and exports PDF.');

  await stage(4);
  await page.getByTestId('guidance-REC-03').getByRole('textbox', { name: 'Decision reason for Message evidence note', exact: true }).fill('Duplicate clue preparation');
  await page.getByTestId('guidance-REC-03').getByRole('button', { name: 'Reject suggestion', exact: true }).click();
  await stage(5); await save(); record = await stored();
  assert.equal(record.recommendations.find(r => r.id === 'REC-03')!.decision, 'rejected');
  assert.doesNotMatch(record.outputs.find(o => o.id === 'HANDOVER-TELCO')!.body, /Message evidence note v/);
  assert.ok(!runtimeReviewValid(record, 'HANDOVER-TELCO'));
  assert.equal(record.outputs.find(o => o.id === 'HANDOVER-BANK')!.body, edited);
  await stage(2); await amountRow.getByRole('textbox').fill('250'); await amountRow.getByRole('button', { name: 'Apply', exact: true }).click();
  await button('Confirm changes to checked facts').click();
  await intake.getByRole('status').filter({ hasText: 'First fact check recorded and saved' }).waitFor();
  await stage(4); await button('Update documents / compare employee edits').click();
  await page.getByRole('dialog', { name: 'Protect employee edits' }).waitFor();
  await button('Keep employee content / refresh other drafts').click(); await save(); record = await stored();
  assert.equal(record.outputs.find(o => o.id === 'HANDOVER-BANK')!.body, edited);
  assert.ok(!runtimeReviewValid(record, 'HANDOVER-BANK'));
  await button('Update documents / compare employee edits').click();
  await page.getByLabel('Replacement reason', { exact: true }).fill('Compared current 250 report with prior employee wording');
  await button('Confirm replacement of compared drafts').click();
  await stage(5); await reviewAll(); record = await stored();
  assert.match(record.outputs.find(o => o.id === 'HANDOVER-BANK')!.body, /Transaction 1 · Amount \| 250/);
  assert.equal(record.outputs.find(o => o.id === 'HANDOVER-BANK')!.history.at(-1)!.previous, edited);
  checks.push('Rejection propagated to telecom actions; fact change invalidated dependent reviews; employee body survived refresh until explicit comparison/replacement.');

  await page.reload(); await page.getByRole('status').filter({ hasText: 'Saved runtime case restored' }).waitFor();
  assert.equal(await page.getByLabel('Case employee identifier', { exact: true }).inputValue(), 'SYN-USABILITY-AUTO');
  await button('Confirm working context').click(); await stage(5);
  const restored = await stored(); assert.deepEqual(restored.followUp, record.followUp); assert.deepEqual(restored.recommendations, record.recommendations);
  assert.ok(runtimeReviewValid(restored, 'SUMMARY'));
  checks.push('Save and refresh retains actor, questions, decisions, bodies and effective reviews.');

  const scopeFixture = structuredClone(restored);
  scopeFixture.reviews = scopeFixture.reviews.filter(r => r.stage === 'first');
  const scopePage = await seededPage(scopeFixture);
  await scopePage.getByRole('button', { name: 'Confirm working context', exact: true }).click();
  await scopePage.getByRole('navigation', { name: 'Case stages' }).getByRole('button').nth(4).click();
  const scopeOutputs = scopePage.getByRole('region', { name: 'Materials and final review' });
  await scopeOutputs.locator('.e-scope-option').filter({ hasText: 'Case summary' }).getByRole('checkbox').uncheck();
  await scopeOutputs.locator('.e-scope-option').filter({ hasText: 'Telecommunications handover' }).getByRole('checkbox').uncheck();
  await scopeOutputs.getByRole('checkbox', { name: /^I checked the current facts/ }).check();
  await scopePage.getByRole('button', { name: 'Review selected documents and recommendations', exact: true }).click();
  await scopePage.getByRole('button', { name: 'Save case', exact: true }).click();
  await scopePage.getByRole('status').filter({ hasText: 'Case saved locally' }).waitFor();
  const scoped = await stored(scopePage);
  assert.deepEqual(scoped.reviews.filter(r => r.stage === 'final').map(r => r.objectId).sort(), ['HANDOVER-BANK', 'REC-01']);
  assert.ok(!runtimeReviewValid(scoped, 'SUMMARY'));
  await scopePage.screenshot({ path: resolve(directory, 'selected-bank-review.png'), fullPage: true });
  checks.push('Diagnostic isolated saved fixture with cleared final reviews; bank-only UI scope records only bank and its referenced recommendation.');
  await scopePage.context().close();

  const legacy = changeGuidanceContext(scopeFixture, 'suspend-guidance');
  legacy.analysis.gaps.push('Unresolved E09:TX-01'); legacy.saved = true;
  const legacyPage = await seededPage(legacy);
  assert.ok(await legacyPage.getByText('Unsaved changes', { exact: false }).first().isVisible());
  await legacyPage.getByRole('button', { name: 'Confirm working context', exact: true }).click();
  await legacyPage.getByRole('navigation', { name: 'Case stages' }).getByRole('button').nth(4).click();
  const legacyOutputs = legacyPage.getByRole('region', { name: 'Materials and final review' });
  assert.equal(await legacyOutputs.locator('.e-scope-option input:checked').count(), 1);
  await legacyOutputs.getByRole('checkbox', { name: /^I checked the current facts/ }).check();
  await legacyPage.getByRole('button', { name: 'Review selected documents and recommendations', exact: true }).click();
  await legacyPage.getByRole('button', { name: 'Save case', exact: true }).click();
  await legacyPage.getByRole('status').filter({ hasText: 'Case saved locally' }).waitFor();
  const reconciled = await stored(legacyPage);
  assert.ok(!reconciled.analysis.gaps.some(g => g.includes('E09')));
  assert.deepEqual(reconciled.sources, legacy.sources); assert.deepEqual(reconciled.followUp, legacy.followUp);
  assert.match(outputSnapshot(reconciled, 'SUMMARY').body, /Insufficient approved guidance; human review required/);
  assert.doesNotMatch(outputSnapshot(reconciled, 'SUMMARY').body, /Unresolved E09|Proposed local preparation/);
  assert.deepEqual(reconciled.reviews.filter(r => r.stage === 'final').map(r => r.objectId), ['SUMMARY']);
  const legacyDownload = legacyPage.waitForEvent('download');
  await legacyPage.getByRole('button', { name: 'Download Markdown', exact: true }).click();
  await (await legacyDownload).saveAs(resolve(directory, 'legacy-no-guidance.md'));
  await legacyPage.screenshot({ path: resolve(directory, 'legacy-no-guidance-review.png'), fullPage: true });
  checks.push('Diagnostic isolated legacy stale-gap and suspended-guidance fixture; restore reconciles gaps as unsaved, preserves sources/questions, and summary-only UI review/export needs no recommendation.');
  await legacyPage.context().close();

  await page.getByText('Local cases and backup', { exact: true }).click();
  await button('New synthetic case').click();
  if (await page.getByRole('dialog').isVisible()) await button('Discard changes and continue').click();
  await page.getByRole('status').filter({ hasText: 'New synthetic case' }).waitFor();
  assert.equal(await page.getByLabel('Case employee identifier', { exact: true }).inputValue(), '');
  await stage(2); assert.ok(await button('Confirm working context').isVisible());
  checks.push('New case resets identity confirmation and requires a fresh employee identifier before checking facts.');

  const fixedContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const fixedPage = await fixedContext.newPage(); fixedPage.setDefaultTimeout(10000);
  fixedPage.on('pageerror', error => errors.push(error.message));
  await fixedPage.goto(`${origin}/?module=outputs`);
  await fixedPage.getByRole('status').filter({ hasText: 'No runtime history' }).waitFor();
  if (!await fixedPage.getByLabel('Fixed runtime variant').isVisible()) await fixedPage.getByText('Test controls and local case management', { exact: true }).click();
  await fixedPage.getByLabel('Fixed runtime variant').selectOption('corrected');
  await fixedPage.getByRole('button', { name: 'Reset fixed input', exact: true }).click();
  await fixedPage.getByRole('button', { name: 'Discard changes and continue', exact: true }).click();
  const fixedOutputs = fixedPage.getByRole('region', { name: 'E01 final review and outputs' });
  await fixedOutputs.getByText('D guidance and decisions for this same case', { exact: true }).click();
  await fixedOutputs.getByLabel('Employee identifier', { exact: true }).fill('SYN-FIXED-RESTORE');
  await fixedPage.getByRole('button', { name: 'Recalculate guidance', exact: true }).click();
  for (const id of ['REC-01', 'REC-02', 'REC-03']) await fixedPage.getByRole('button', { name: `Accept ${id}`, exact: true }).click();
  await fixedOutputs.getByLabel('E employee identifier', { exact: true }).fill('SYN-FIXED-RESTORE');
  await fixedPage.getByRole('button', { name: 'Generate / refresh E outputs', exact: true }).click();
  for (const id of ['REC-01', 'REC-02', 'REC-03', 'SUMMARY']) {
    await fixedOutputs.getByRole('checkbox', { name: /^I checked the current facts/ }).check();
    await fixedPage.getByRole('button', { name: `Final review ${id}`, exact: true }).click();
  }
  await fixedPage.getByRole('button', { name: 'Save E case', exact: true }).click();
  await fixedOutputs.getByRole('status').filter({ hasText: 'Saved through A01 storage' }).waitFor();
  const fixedBefore = RuntimeCaseRecordSchema.parse(JSON.parse(await fixedPage.getByTestId('runtime-record').textContent() ?? '{}'));
  assert.ok(runtimeReviewValid(fixedBefore, 'SUMMARY'));
  await fixedPage.reload(); await fixedPage.getByRole('status').filter({ hasText: 'Saved runtime case restored' }).waitFor();
  const fixedAfter = RuntimeCaseRecordSchema.parse(JSON.parse(await fixedPage.getByTestId('runtime-record').textContent() ?? '{}'));
  assert.equal(fixedAfter.analysis.version, fixedBefore.analysis.version);
  assert.ok(runtimeReviewValid(fixedAfter, 'SUMMARY'));
  assert.ok(await fixedPage.getByRole('button', { name: 'Copy E Markdown', exact: true }).isEnabled());
  await fixedPage.screenshot({ path: resolve(directory, 'fixed-corrected-restored.png'), fullPage: true });
  checks.push('Diagnostic corrected fixed input generated and explicitly reviewed before save; refresh keeps the same reconciled analysis and effective summary review.');
  await fixedContext.close();
  assert.deepEqual(errors, []); assert.equal(providerRequests, 0);
} catch (error) { failure = String(error); await page.screenshot({ path: resolve(directory, 'failure.png'), fullPage: true }); }
finally {
  await writeFile(resolve(directory, 'result.json'), JSON.stringify({ checks, errors, providerRequests, failure, browser: browser.version(), scope: 'Independent headless automated regression through normal five-stage UI; not computer-use or human acceptance.' }, null, 2));
  await browser.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
}
if (failure) throw new Error(failure);
console.log(`Usability regression passed ${checks.length} groups; providerRequests=0`);
