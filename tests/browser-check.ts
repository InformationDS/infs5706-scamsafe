import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server/src/app';
import { readConfig } from '../server/src/config';
import { buildSnapshot, makeFixture, markSaved, replaceOutput, reviewOutput } from '../shared';
import { snapshotToMarkdown } from '../shared/export';

const directory = process.argv[2] ?? 'evidence/preparation';
const outputWithinEvidence = relative(resolve('evidence'), resolve(directory));
if (isAbsolute(outputWithinEvidence) || outputWithinEvidence.split(sep).includes('..')) throw new Error('Browser evidence directory must stay inside the project evidence directory');
await mkdir(directory, { recursive: true });
let providerRequests = 0;
const server = createApp({ config: readConfig({ MODEL_MODE: 'mock' }), fetchImpl: async () => { providerRequests++; throw new Error('Browser settings checks do not call a provider'); } }).listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No local server address');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const checks: { name: string; result: string }[] = [];
async function load(name: string) {
  await page.getByLabel('Fixed training state').selectOption(name);
  await page.getByRole('button', { name: 'Load training state', exact: true }).click();
  await page.getByRole('status').filter({ hasText: `Loaded and saved ${name}` }).waitFor();
}
async function saveModelSettings() {
  const response = page.waitForResponse(value => value.url().endsWith('/api/settings/model') && value.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save API settings', exact: true }).click();
  assert.equal((await response).status(), 200);
  await page.getByRole('status').filter({ hasText: 'Model settings saved.' }).waitFor();
}
try {
  await page.goto(`${origin}/?view=foundation`);
  await page.getByRole('status').filter({ hasText: 'No saved history' }).waitFor();
  await page.getByText('BUSINESS-BASELINE-01 · content v1', { exact: true }).waitFor();
  checks.push({ name: 'approved business reference loads independently of legacy mock review', result: 'passed' });
  await page.getByRole('button', { name: 'Configure model API', exact: true }).click();
  await page.getByLabel('Model mode', { exact: true }).selectOption('live');
  await page.getByLabel('API base URL', { exact: true }).fill(`${origin}/unused-provider/v1`);
  await page.getByLabel('Model name', { exact: true }).fill('ui-test-model');
  await page.getByLabel('API key', { exact: true }).fill('UI_TEST_SECRET');
  await saveModelSettings();
  assert.equal(await page.getByLabel('API key', { exact: true }).inputValue(), '');
  assert.equal(providerRequests, 0);
  const publicSettings = await (await context.request.get(`${origin}/api/settings/model`)).json();
  assert.equal(publicSettings.hasApiKey, true);
  assert.equal(publicSettings.mode, 'live');
  assert.doesNotMatch(JSON.stringify(publicSettings), /UI_TEST_SECRET|"apiKey"/);
  await page.reload();
  await page.getByRole('button', { name: 'Configure model API', exact: true }).click();
  await page.getByLabel('Model name', { exact: true }).waitFor();
  await page.waitForFunction(() => (document.querySelector('input[placeholder="Exact model name from your provider"]') as HTMLInputElement | null)?.value === 'ui-test-model');
  assert.equal(await page.getByLabel('Model name', { exact: true }).inputValue(), 'ui-test-model');
  assert.equal(await page.getByLabel('API key', { exact: true }).inputValue(), '');
  await page.getByLabel('Model mode', { exact: true }).selectOption('mock');
  await saveModelSettings();
  assert.equal((await (await context.request.get(`${origin}/api/settings/model`)).json()).hasApiKey, true);
  assert.equal(providerRequests, 0);
  await page.screenshot({ path: `${directory}/model-settings.png`, fullPage: false });
  await page.getByRole('button', { name: 'Close model settings', exact: true }).click();
  checks.push({ name: 'product API settings save and reload without key echo, blank preserves, no automatic provider calls', result: 'passed' });
  await page.getByRole('button', { name: 'Configure model API', exact: true }).click();
  await page.getByLabel('Model name', { exact: true }).fill('unsaved-model');
  await page.getByLabel('API key', { exact: true }).fill('UNSAVED_TEST_SECRET');
  await page.getByRole('button', { name: 'Close model settings', exact: true }).click();
  await page.getByRole('button', { name: 'Configure model API', exact: true }).click();
  assert.equal(await page.getByLabel('Model name', { exact: true }).inputValue(), 'ui-test-model');
  assert.equal(await page.getByLabel('API key', { exact: true }).inputValue(), '');
  assert.equal((await (await context.request.get(`${origin}/api/settings/model`)).json()).model, 'ui-test-model');
  checks.push({ name: 'closing settings discards unsaved edits and typed key', result: 'passed' });
  const delayedSettingsResponse = page.waitForResponse(value => value.url().endsWith('/api/analyze'));
  await page.getByRole('button', { name: 'Delayed response', exact: true }).click();
  await page.getByLabel('Model name', { exact: true }).fill('updated-ui-test-model');
  await saveModelSettings();
  await (await delayedSettingsResponse).finished();
  await page.getByRole('status').filter({ hasText: 'Model settings changed.' }).waitFor();
  assert.equal(await page.getByText('Adapter response', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Close model settings', exact: true }).click();
  checks.push({ name: 'saving settings invalidates an in-flight analysis response', result: 'passed' });
  await load('partial');
  await page.reload();
  await page.getByRole('status').filter({ hasText: 'restored from this browser' }).waitFor();
  assert.match(await page.locator('body').innerText(), /1 rounds · 3 questions/);
  checks.push({ name: 'partial answer and count restore after browser refresh', result: 'passed' });

  const backupEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON backup', exact: true }).click();
  const backup = await backupEvent; await backup.saveAs(`${directory}/training-backup.json`);
  assert.doesNotMatch(await readFile(`${directory}/training-backup.json`, 'utf8'), /UI_TEST_SECRET|apiKey/);
  await load('intake');
  await page.getByLabel('Restore training JSON').setInputFiles(`${directory}/training-backup.json`);
  await page.getByRole('status').filter({ hasText: 'backup validated, saved and restored' }).waitFor();
  assert.match(await page.locator('body').innerText(), /1 rounds · 3 questions/);
  checks.push({ name: 'JSON backup, replace state and restore original partial case', result: 'passed' });
  const invalidBackup = JSON.parse(await readFile(`${directory}/training-backup.json`, 'utf8'));
  invalidBackup.record.caseId = 'UNSUPPORTED-CASE';
  await page.getByLabel('Restore training JSON').setInputFiles({ name: 'unsupported.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalidBackup)) });
  await page.getByRole('status').filter({ hasText: 'Backup rejected' }).waitFor();
  assert.match(await page.locator('body').innerText(), /1 rounds · 3 questions/);

  await page.getByRole('button', { name: 'Simulate timeout', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Simulated timeout' }).waitFor();
  await page.getByRole('button', { name: 'Simulate invalid output', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Simulated invalid model response' }).waitFor();
  checks.push({ name: 'controlled model timeout and invalid output preserve page case', result: 'passed' });

  await page.getByRole('button', { name: 'Delayed response', exact: true }).click();
  await page.getByRole('button', { name: 'Correct TX-01 amount to AUD 200', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Outdated result ignored' }).waitFor();
  checks.push({ name: 'delayed response ignored after correction', result: 'passed' });

  await load('reviewed');
  await page.getByLabel('Simulate next save failure').check();
  await page.getByRole('button', { name: 'Correct TX-01 amount to AUD 200', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Simulated save failure' }).waitFor();
  assert.match(await page.locator('body').innerText(), /Unsaved/);
  assert.match(await page.locator('body').innerText(), /Unsaved state cannot be exported/);
  await page.getByLabel('Simulate next save failure').uncheck();
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Current state saved locally' }).waitFor();
  checks.push({ name: 'save failure retains input, blocks output and permits retry', result: 'passed' });

  await load('stale');
  assert.match(await page.locator('body').innerText(), /Current simulated final review required/);
  await load('no-guidance');
  await page.getByRole('button', { name: 'Simulate final summary review', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Training final review saved' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Download PDF', exact: true }).count(), 1);
  checks.push({ name: 'stale review blocked; current summary can receive labelled training review', result: 'passed' });

  await load('reviewed');
  await page.getByLabel('Simulate output failure').check();
  await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Copy failed' }).waitFor();
  for (const label of ['Download Markdown', 'Download PDF']) {
    const response = page.waitForResponse(value => value.url().endsWith('/api/export'));
    await page.getByRole('button', { name: label, exact: true }).click();
    assert.equal((await response).status(), 503);
    await page.getByRole('status').filter({ hasText: 'Simulated export failure' }).waitFor();
  }
  await page.getByLabel('Simulate output failure').uncheck();
  checks.push({ name: 'copy, Markdown and PDF failure retain review and permit retry', result: 'passed' });
  const mdEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Markdown', exact: true }).click();
  const md = await mdEvent; await md.saveAs(`${directory}/${md.suggestedFilename()}`);
  assert.equal(await readFile(`${directory}/${md.suggestedFilename()}`, 'utf8'), snapshotToMarkdown(buildSnapshot(makeFixture('reviewed'), 'SUMMARY')));
  await page.getByRole('button', { name: 'Copy Markdown', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Copied training snapshot' }).waitFor();
  // The Windows clipboard normalizes LF to CRLF; compare text after newline normalization.
  assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n'), await readFile(`${directory}/${md.suggestedFilename()}`, 'utf8'));
  const pdfEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const pdf = await pdfEvent; await pdf.saveAs(`${directory}/${pdf.suggestedFilename()}`);
  assert.equal((await readFile(`${directory}/${pdf.suggestedFilename()}`)).subarray(0, 5).toString(), '%PDF-');
  await page.screenshot({ path: `${directory}/workbench.png`, fullPage: true });
  checks.push({ name: 'copy and Markdown equal exact selected snapshot; PDF generated', result: 'passed' });

  let probe = makeFixture('reviewed');
  const probeText = 'RENDERING PROBE ONLY — NOT A BUSINESS EXPECTATION\n\n中文排版核对：未知金额不等于零；人工核对不等于外部事实已证实。\n\n' +
    'A long source URL: https://rendering.example/' + 'long-path-segment/'.repeat(18) + '\n\n' +
    'Field | Value | Status\nAmount | 200 AUD | Reported\nRecipient | Unknown | Missing\n\n' +
    Array.from({ length: 40 }, (_, i) => `Paragraph ${i + 1}. Synthetic rendering text for page breaks, line wrapping and readable output. 中文来源文字应完整显示，分页不得截断或缺字。`).join('\n\n');
  probe = markSaved(replaceOutput(probe, { ...probe.outputs[0], title: 'Rendering probe — layout only', body: probeText }), true);
  probe = markSaved(reviewOutput(probe, 'SUMMARY'), true);
  const probeResponse = await context.request.post(`${origin}/api/export`, { data: { case: probe, objectId: 'SUMMARY', format: 'pdf' } });
  assert.equal(probeResponse.status(), 200);
  await writeFile(`${directory}/rendering-probe.pdf`, await probeResponse.body());
  checks.push({ name: 'separate Chinese, long URL, table-text and pagination PDF probe generated', result: 'passed' });

  await load('handover');
  await page.getByLabel('Output object').selectOption('HANDOVER-BANK');
  await page.getByRole('button', { name: 'Download Markdown', exact: true }).waitFor();
  const bankText = await page.frameLocator('iframe').locator('body').innerText();
  assert.match(bankText, /designated human review team/);
  await page.getByLabel('Output object').selectOption('HANDOVER-TELCO');
  const telcoText = await page.frameLocator('iframe').locator('body').innerText();
  assert.match(telcoText, /designated human intake team/);
  assert.match(telcoText, /separate SMS summary was declined/);
  checks.push({ name: 'separate recipient teaching snapshots and rejected step retained as declined', result: 'passed' });
  assert.deepEqual(errors, []);
  checks.push({ name: 'browser console has no uncaught page errors', result: 'passed' });
  await page.getByRole('button', { name: 'Configure model API', exact: true }).click();
  await page.getByLabel('Remove saved API key', { exact: true }).check();
  await saveModelSettings();
  assert.equal((await (await context.request.get(`${origin}/api/settings/model`)).json()).hasApiKey, false);
  assert.equal(providerRequests, 0);
  checks.push({ name: 'explicit API key removal works; settings remain separate from case backup', result: 'passed' });
  await writeFile(`${directory}/browser-check.json`, JSON.stringify({ status: 'passed', mode: 'mock', platform: process.platform, origin, contentApproval: 'pending', checks, pdfVisualInspection: 'separate render required' }, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'passed', checks: checks.length, platform: process.platform }));
} catch (error) {
  await page.screenshot({ path: `${directory}/browser-failure.png`, fullPage: true });
  await writeFile(`${directory}/browser-check.json`, JSON.stringify({ status: 'failed', checks, error: String(error), errors }, null, 2) + '\n');
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
