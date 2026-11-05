import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRuntimeFixture } from '../shared/runtime-fixtures';
import { RuntimeCaseRecordSchema, runtimeReviewValid, type RuntimeCaseRecord } from '../shared/runtime';
import { recalculateGuidance, activeRecommendations, decideRecommendation, changeGuidanceContext, NO_GUIDANCE } from '../shared/guidance';
import { editOutput, finalReview, outputCurrent, outputProposals, outputSnapshot, regenerateOutputs } from '../shared/outputs';
import { outputSnapshotToHtml, outputSnapshotToMarkdown, outputSnapshotFilename } from '../shared/export';
import { exportRuntime } from '../server/src/output-service';
import { createApp } from '../server/src/app';

// These are executed synthetic test events, never evidence of human product approval.
const actor = 'E01-AUTOMATED-TEST';
function prepared() {
  let r = recalculateGuidance(makeRuntimeFixture('corrected'));
  for (const rec of activeRecommendations(r)) r = decideRecommendation(r, rec.id, 'accepted', { actor });
  return regenerateOutputs(r).record;
}
function reviewed(r: RuntimeCaseRecord) {
  for (const rec of activeRecommendations(r).filter(r => r.decision !== 'rejected')) r = finalReview(r, rec.id, actor, true);
  for (const out of outputProposals(r)) r = finalReview(r, out.id, actor, true);
  return { ...r, saved: true };
}
test('E01 generates current values with uncertainty, sources, version and no borrowed approval', () => {
  const r = prepared();
  assert.deepEqual(r.outputs.map(o => o.id), ['SUMMARY', 'HANDOVER-BANK', 'HANDOVER-TELCO']);
  const body = r.outputs[0].body;
  assert.match(body, /E04:TX-01 \| 200/); assert.match(body, /Unknown \/ not supplied/);
  assert.match(body, /S3 \(narrative\)/); assert.match(body, /previous 2000/);
  assert.doesNotMatch(body, /Reviewed for record accuracy by STAFF/);
  assert.equal(r.reviews.filter(v => v.stage === 'final' && !v.simulated).length, 0);
  assert.throws(() => outputSnapshot(r, 'SUMMARY'));
  assert.equal(regenerateOutputs(r).record, r, 'identical regeneration is a no-op');
});
test('E01 same gate requires current unsimulated review and saved, checked facts', () => {
  const r = reviewed(prepared());
  const s = outputSnapshot(r, 'HANDOVER-BANK');
  assert.equal(s.review.simulated, false); assert.equal(s.review.actor, actor);
  assert.throws(() => outputSnapshot({ ...r, saved: false }, 'HANDOVER-BANK'));
  assert.throws(() => outputSnapshot({ ...r, needsFactConfirmation: true }, 'HANDOVER-BANK'));
  assert.throws(() => finalReview(prepared(), 'SUMMARY', actor, false));
  assert.throws(() => finalReview(prepared(), 'SUMMARY', '', true));
  const simulated = structuredClone(r); simulated.reviews.forEach(v => { v.simulated = true; });
  assert.throws(() => outputSnapshot(simulated, 'SUMMARY'));
  assert.throws(() => finalReview(makeRuntimeFixture('T09'), 'SUMMARY', actor, true));
});
test('E01 single edit invalidates bank alone; exact dependency change invalidates shared outputs', () => {
  const r = reviewed(prepared()), telco = outputSnapshot(r, 'HANDOVER-TELCO');
  const edited = editOutput(r, 'HANDOVER-BANK', r.outputs[1].body + '\nEmployee wording.', { actor, reason: 'Clarify uncertainty.' });
  assert.equal(runtimeReviewValid(edited, 'HANDOVER-BANK'), false);
  assert.equal(runtimeReviewValid(edited, 'HANDOVER-TELCO'), true);
  assert.deepEqual(outputSnapshot({ ...edited, saved: true }, 'HANDOVER-TELCO').body, telco.body);
  const next = structuredClone(r), amount = next.facts.find(f => f.fieldId === 'E04')!;
  amount.value = 250; amount.version++; next.version++; next.saved = false;
  for (const o of next.outputs) { assert.equal(outputCurrent(next, o.id), false); assert.throws(() => outputSnapshot(next, o.id)); }
  assert.match(regenerateOutputs(recalculateGuidance(next)).record.outputs[1].body, /E04:TX-01 \| 250/);
});
test('E01 protects employee text and keeps previous bodies after explicit replacement', () => {
  const initial = reviewed(prepared());
  const r = editOutput(initial, 'HANDOVER-BANK', '员工补充：保留不确定性。', { actor, reason: 'Employee wording.' });
  const protectedResult = regenerateOutputs(r);
  assert.deepEqual(protectedResult.protectedIds, ['HANDOVER-BANK']); assert.equal(protectedResult.record, r);
  assert.throws(() => regenerateOutputs(r, { replaceEdited: ['HANDOVER-BANK'] }));
  const updated = regenerateOutputs(r, { actor, reason: 'Compared current basis.', replaceEdited: ['HANDOVER-BANK'] }).record;
  assert.equal(updated.outputs[1].employeeEdited, true);
  assert.equal(updated.outputs[1].history.at(-1)?.previous, '员工补充：保留不确定性。');
  assert.equal(runtimeReviewValid(updated, 'HANDOVER-BANK'), false);
  assert.equal(runtimeReviewValid(updated, 'HANDOVER-TELCO'), true);
});
test('E01 D rejection never becomes a pending action; unrelated bank review survives', () => {
  const r = reviewed(prepared());
  const rejected = decideRecommendation(r, 'REC-03', 'rejected', { actor, reason: 'Existing drafts contain the clues.' });
  assert.equal(outputCurrent(rejected, 'HANDOVER-BANK'), true);
  assert.equal(outputCurrent(rejected, 'HANDOVER-TELCO'), false);
  assert.equal(runtimeReviewValid(rejected, 'HANDOVER-BANK'), true);
  const generated = regenerateOutputs(rejected).record;
  assert.doesNotMatch(generated.outputs.find(o => o.id === 'HANDOVER-TELCO')!.body, /REC-03 v/);
  assert.doesNotMatch(generated.outputs[0].body, /REC-03 v/);
  assert.equal(recalculateGuidance(generated).recommendations.find(r => r.id === 'REC-03')!.decision, 'rejected');
  assert.equal(runtimeReviewValid(generated, 'HANDOVER-TELCO'), false);
});
test('E01 no effective guidance gives factual summary only, never recipient paths', () => {
  for (const change of ['suspend-role','suspend-guidance'] as const) {
    const r = changeGuidanceContext(reviewed(prepared()), change), p = outputProposals(r);
    assert.deepEqual(p.map(o => o.id), ['SUMMARY']); assert.match(p[0].body, new RegExp(NO_GUIDANCE));
    assert.doesNotMatch(p[0].body, /Intended recipient|REC-0[123] v|designated human review team/);
    assert.deepEqual(p[0].recommendationIds, []);
    assert.equal(outputCurrent(r, 'HANDOVER-BANK'), false);
    let refreshed = regenerateOutputs(r).record;
    refreshed = finalReview(refreshed, 'SUMMARY', actor, true);
    assert.equal(outputSnapshot({ ...refreshed, saved: true }, 'SUMMARY').body, p[0].body);
  }
});
test('E01 pending / mocked decisions cannot be reviewed or exported; available means actual D matching', () => {
  let r = recalculateGuidance(makeRuntimeFixture('corrected')); r = regenerateOutputs(r).record;
  assert.throws(() => finalReview(r, 'REC-01', actor, true));
  assert.throws(() => finalReview(r, 'HANDOVER-BANK', actor, true));
  const mock = makeRuntimeFixture('output-error');
  assert.throws(() => outputSnapshot(mock, 'HANDOVER-BANK'));
  mock.saved = true; assert.throws(() => outputSnapshot(mock, 'HANDOVER-BANK'));
});
test('E01 precision includes added facts and missing dependency references; stale basis cannot be rebased by edit', () => {
  const r = reviewed(prepared()), next = structuredClone(r);
  next.facts.push({ fieldId: 'A01', value: 'Synthetic new context', status: 'extracted', reviewStatus: 'checked', sourceIds: ['S1'], version: 1, candidates: [], history: [] });
  assert.equal(outputCurrent(next, 'SUMMARY'), false);
  const removed = structuredClone(r); delete removed.outputs[0].dependencies.analysis;
  assert.throws(() => outputSnapshot(removed, 'SUMMARY'));
  const changed = changeGuidanceContext(r, 'suspend-role');
  const edited = editOutput(changed, 'HANDOVER-BANK', 'Manual wording cannot grant permission.', { actor, reason: 'Test.' });
  assert.throws(() => finalReview(edited, 'HANDOVER-BANK', actor, true));
});
test('E01 unified HTML / Markdown render text safely and use same snapshot', async () => {
  const r = reviewed(prepared());
  const edited = editOutput(r, 'HANDOVER-BANK', r.outputs[1].body + '\n<script>alert(1)</script>\n中文完整性终点', { actor, reason: 'Synthetic rendering test.' });
  const ready = { ...finalReview(edited, 'HANDOVER-BANK', actor, true), saved: true };
  const s = outputSnapshot(ready, 'HANDOVER-BANK'), html = outputSnapshotToHtml(s), md = outputSnapshotToMarkdown(s);
  assert.ok(md.includes(s.body)); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<table>/); assert.match(html, /<thead>/); assert.match(html, /中文完整性终点/);
  assert.match(outputSnapshotFilename(s, 'pdf'), /EXAMPLE-01_HANDOVER-BANK_v2.pdf/);
  const result = await exportRuntime({ case: ready, objectId: s.objectId, format: 'markdown' });
  assert.equal(Buffer.from(result.bytes).toString(), md); assert.deepEqual(result.snapshot, s);
});
test('E01 output failure preserves saved body and review; same version retry succeeds', async () => {
  const r = reviewed(prepared()), previous = JSON.stringify(r), s = outputSnapshot(r, 'SUMMARY');
  await assert.rejects(exportRuntime({ case: r, objectId: 'SUMMARY', format: 'markdown', fault: 'failure' }));
  assert.equal(JSON.stringify(r), previous);
  const retry = await exportRuntime({ case: r, objectId: 'SUMMARY', format: 'markdown' });
  assert.deepEqual(retry.snapshot, s);
});

// Opt-in actual UI/PDF exercise. Kept in this task's allowed test file, not a public MOCK assertion.
test('E01 actual UI review, editing, storage, copy, HTTP export and PDF stress exercise', { skip: process.env.E01_BROWSER !== '1', timeout: 180000 }, async () => {
  const { chromium } = await import('playwright');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const dir = resolve(process.env.E01_EVIDENCE_DIR ?? 'evidence/task-results/E01/run-01/business');
  assert.ok(dir.includes('/evidence/task-results/E01/'));
  await mkdir(dir, { recursive: true });
  const server = createApp({ staticDir: resolve('dist') }).listen(0, '127.0.0.1');
  await new Promise<void>(done => server.once('listening', done));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ permissions: ['clipboard-read','clipboard-write'], acceptDownloads: true });
  const page = await context.newPage(), errors: string[] = [], steps: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  let providerRequests = 0;
  page.on('request', req => { if (!req.url().startsWith(`http://127.0.0.1:${port}`) && !req.url().startsWith('data:')) providerRequests++; });
  const record = async () => RuntimeCaseRecordSchema.parse(JSON.parse((await page.getByTestId('runtime-record').textContent()) ?? '{}'));
  const e = page.getByRole('region', { name: 'E01 final review and outputs' });
  const button = (name: string) => e.getByRole('button', { name, exact: true });
  const ack = () => e.getByRole('checkbox', { name: /^I checked the current facts/ }).check();
  try {
    await page.goto(`http://127.0.0.1:${port}/?module=outputs`);
    await page.getByText('No runtime history; unsaved MOCK input loaded.', { exact: true }).waitFor();
    const ctx = await (await page.request.get(`http://127.0.0.1:${port}/api/runtime/context`)).json();
    assert.equal(ctx.outputRegistered, true);
    await page.getByLabel('Fixed runtime variant').selectOption('corrected');
    await page.getByRole('button', { name: 'Reset fixed input', exact: true }).click();
    await page.getByRole('button', { name: 'Discard changes and continue', exact: true }).click();
    await e.getByText('D guidance and decisions for this same case', { exact: true }).click();
    await e.getByLabel('Employee identifier', { exact: true }).fill(actor);
    await button('Recalculate guidance').click();
    for (const id of ['REC-01','REC-02','REC-03']) await button(`Accept ${id}`).click();
    await e.getByLabel('E employee identifier', { exact: true }).fill(actor);
    await button('Generate / refresh E outputs').click();
    assert.equal((await record()).outputs.length, 3);
    assert.equal((await record()).reviews.filter(v => v.stage === 'final' && !v.simulated).length, 0);
    steps.push('Generated three current unreviewed E objects, no borrowed reference approval.');
    for (const id of ['REC-01','REC-02','REC-03','SUMMARY']) { await ack(); await button(`Final review ${id}`).click(); }
    await button('Save E case').click(); await e.getByText('Saved through A01 storage.', { exact: true }).waitFor();
    await e.getByTitle('E reviewed output preview').waitFor();
    await page.frameLocator('iframe[title="E reviewed output preview"]').getByRole('heading', { name: 'Unified factual summary', exact: true }).waitFor();
    await button('Copy E Markdown').click();
    await e.getByText(/copy completed from SUMMARY/).waitFor();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(clipboard, outputSnapshotToMarkdown(outputSnapshot(await record(), 'SUMMARY')));
    let downloadPromise = page.waitForEvent('download'); await button('Download E markdown').click();
    let download = await downloadPromise; await download.saveAs(resolve(dir, 'summary.md'));
    downloadPromise = page.waitForEvent('download'); await button('Download E pdf').click();
    download = await downloadPromise; await download.saveAs(resolve(dir, 'summary.pdf'));
    steps.push('Actual E review clicks, IndexedDB save, same-snapshot preview, clipboard, Markdown and PDF downloads.');
    await page.reload(); await page.getByText('Saved runtime case restored from this browser.', { exact: true }).waitFor();
    assert.ok(runtimeReviewValid(await record(), 'SUMMARY'));
    await e.getByLabel('E employee identifier', { exact: true }).fill(actor);
    await e.getByLabel('E draft selection', { exact: true }).selectOption('HANDOVER-BANK');
    await ack(); await button('Final review HANDOVER-BANK').click();
    await e.getByText('Edit body (record edits before closing)', { exact: true }).click();
    const currentBank = (await record()).outputs.find(o => o.id === 'HANDOVER-BANK')!;
    const longText = Array.from({ length: 16 }, (_, i) => `中文段落 ${i + 1}：这是合成测试，员工保留不确定性，交易尚未独立核实。中文换行与分页必须完整。${'长文本边界验证，不代表真实案件或审核批准。'.repeat(5)}`).join('\n\n');
    const body = `${currentBank.body}\n\n## 中文表格与长文本\n| 条目 | 合成说明 |\n| --- | --- |\n| 中文 | 保留未知、来源和员工修改 |\n| 长单词 | ${'SyntheticLongToken'.repeat(35)} |\n\n${longText}\n\n中文正文完整性终点 E01-END`;
    await e.getByLabel('Working body for HANDOVER-BANK', { exact: true }).fill(body);
    assert.equal(await button('Final review HANDOVER-BANK').isDisabled(), true);
    assert.equal(await button('Download E pdf').isDisabled(), true);
    await e.getByLabel('Edit reason for HANDOVER-BANK', { exact: true }).fill('Automated synthetic CJK / long text / table stress exercise.');
    await button('Record edit HANDOVER-BANK').click();
    const afterEdit = await record(); assert.equal(runtimeReviewValid(afterEdit, 'HANDOVER-BANK'), false);
    await button('Generate / refresh E outputs').click();
    await e.getByRole('dialog', { name: 'Protect employee edits' }).waitFor();
    assert.equal((await record()).outputs.find(o => o.id === 'HANDOVER-BANK')!.body, body);
    await button('Keep employee content / refresh other drafts').click();
    await ack(); await button('Final review HANDOVER-BANK').click();
    await button('Save E case').click(); await e.getByText('Saved through A01 storage.', { exact: true }).waitFor();
    const valid = await record(), snapshot = outputSnapshot(valid, 'HANDOVER-BANK');
    downloadPromise = page.waitForEvent('download'); await button('Download E pdf').click(); download = await downloadPromise;
    await download.saveAs(resolve(dir, 'chinese-long-table.pdf'));
    await writeFile(resolve(dir, 'chinese-long-table.md'), outputSnapshotToMarkdown(snapshot));
    await writeFile(resolve(dir, 'chinese-long-table.html'), outputSnapshotToHtml(snapshot));
    await page.screenshot({ path: resolve(dir, 'reviewed-output.png'), fullPage: true });
    steps.push('Recorded employee edit with history, blocked unrecorded edit, protected regeneration, re-reviewed and generated Chinese / long text / table PDF.');
    const fail = await page.request.post(`http://127.0.0.1:${port}/api/runtime/export`, { data: { case: valid, objectId: 'HANDOVER-BANK', format: 'pdf', fault: 'failure' } });
    assert.equal(fail.status(), 503); assert.deepEqual(await record(), valid);
    const retry = await page.request.post(`http://127.0.0.1:${port}/api/runtime/export`, { data: { case: valid, objectId: 'HANDOVER-BANK', format: 'markdown' } });
    assert.equal(retry.status(), 200); assert.equal(await retry.text(), outputSnapshotToMarkdown(snapshot));
    await page.getByLabel('Simulate output failure', { exact: true }).check();
    await button('Download E pdf').click();
    await e.getByText(/Output failed; body and valid reviews retained/).waitFor();
    assert.deepEqual(await record(), valid);
    await page.getByLabel('Simulate output failure', { exact: true }).uncheck();
    downloadPromise = page.waitForEvent('download'); await button('Download E pdf').click(); download = await downloadPromise;
    await download.saveAs(resolve(dir, 'same-version-retry.pdf'));
    assert.deepEqual(outputSnapshot(await record(), 'HANDOVER-BANK'), snapshot);
    steps.push('Actual HTTP and UI export failure retain body and valid review; same-version Markdown and PDF retry succeed.');
    await e.getByLabel('E draft selection', { exact: true }).selectOption('HANDOVER-TELCO');
    await ack(); await button('Final review HANDOVER-TELCO').click();
    let beforeReject = await record(); assert.equal(runtimeReviewValid(beforeReject, 'HANDOVER-TELCO'), true);
    // D's own control, on the same record.
    await e.getByText('D guidance and decisions for this same case', { exact: true }).click();
    await e.getByLabel('Employee identifier', { exact: true }).fill(actor);
    await e.getByLabel('Reason for REC-03', { exact: true }).fill('Existing drafts contain the clues.');
    await button('Reject REC-03').click();
    const rejected = await record();
    assert.equal(runtimeReviewValid(rejected, 'HANDOVER-BANK'), true);
    assert.equal(runtimeReviewValid(rejected, 'HANDOVER-TELCO'), false);
    assert.equal(await button('Download E pdf').isDisabled(), true);
    steps.push('Actual D REC-03 rejection invalidates TELCO while bank review remains current.');
    await button('Generate / refresh E outputs').click();
    // Preserve the independent employee bank draft while applying other refreshes.
    if (await e.getByRole('dialog', { name: 'Protect employee edits' }).count()) await button('Keep employee content / refresh other drafts').click();
    assert.doesNotMatch((await record()).outputs.find(o => o.id === 'HANDOVER-TELCO')!.body, /REC-03 v/);
    await button('Suspend guidance').click(); await button('Generate / refresh E outputs').click();
    // The edited bank is now history-only; proposals contain summary alone.
    let noGuide = await record(); assert.deepEqual(outputProposals(noGuide).map(o => o.id), ['SUMMARY']);
    await e.getByLabel('E draft selection', { exact: true }).selectOption('SUMMARY');
    await ack(); await button('Final review SUMMARY').click();
    await button('Save E case').click(); await e.getByText('Saved through A01 storage.', { exact: true }).waitFor();
    noGuide = await record(); assert.match(outputSnapshot(noGuide, 'SUMMARY').body, new RegExp(NO_GUIDANCE));
    downloadPromise = page.waitForEvent('download'); await button('Download E pdf').click(); download = await downloadPromise; await download.saveAs(resolve(dir, 'no-guidance.pdf'));
    steps.push('Actual guidance suspension: factual summary review and PDF available; historical recipient drafts blocked.');
    assert.deepEqual(errors, []); assert.equal(providerRequests, 0);
    await writeFile(resolve(dir, 'result.json'), JSON.stringify({ status: 'passed', actor, scope: 'Automated synthetic UI events, not human approval or F acceptance', steps, errors, providerRequests, context: ctx }, null, 2));
  } catch (error) {
    await page.screenshot({ path: resolve(dir, 'failure.png'), fullPage: true });
    await writeFile(resolve(dir, 'failure.json'), JSON.stringify({ steps, errors, message: String(error) }, null, 2));
    throw error;
  } finally { await browser.close(); server.closeAllConnections(); await new Promise<void>((done, reject) => server.close(e => e ? reject(e) : done())); }
});
