import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRuntimeFixture } from '../shared/runtime-fixtures.js';
import { fixedQuestions } from '../shared/fixtures.js';
import { correctRuntimeFact, correctRuntimeTypes, eligibleQuestionProposals, intakeTargetKey, mergeRuntimeProposal, parseAnswerValue, confirmRuntimeFacts, appendSavedQuestionRound, answerRuntimeQuestion, endRuntimeFollowUp } from '../shared/intake.js';
import { AnalysisEnvelopeSchema } from '../shared/schema.js';
import { runtimeDependencies, ticketCurrent } from '../shared/runtime.js';

test('re-reading the source retains an employee correction and records a conflicting candidate', () => {
  const start = makeRuntimeFixture('T09');
  const corrected = correctRuntimeFact(start, { fieldId: 'E04', recordId: 'TX-01' }, 200, 'Caller clarified amount');
  const amount = structuredClone(corrected.facts.find(fact => fact.fieldId === 'E04' && fact.recordId === 'TX-01')!);
  amount.value = 2000; amount.status = 'extracted'; amount.reviewStatus = 'unreviewed'; amount.sourceIds = ['S3'];
  const proposal = AnalysisEnvelopeSchema.parse({ facts: [amount], analysis: { ...structuredClone(corrected.analysis), types: ['Suspected phishing', 'Payment fraud'] }, questions: [] });
  const merged = mergeRuntimeProposal(corrected, proposal);
  const fact = merged.facts.find(item => item.fieldId === 'E04' && item.recordId === 'TX-01')!;
  assert.equal(fact.value, 200);
  assert.equal(fact.reviewStatus, 'corrected');
  assert.equal(fact.candidates.some(candidate => candidate.value === 2000 && candidate.sourceIds.includes('S3')), true);
  assert.equal(fact.history.some(item => item.value === 2000), true);
});

test('transaction targets remain keyed by field and record; unknown stays null', () => {
  assert.notEqual(intakeTargetKey({ fieldId: 'E04', recordId: 'TX-01' }), intakeTargetKey({ fieldId: 'E04', recordId: 'TX-02' }));
  assert.equal(parseAnswerValue('E04', 'not sure'), null);
  assert.equal(parseAnswerValue('C08', 'not sure'), null);
});

test('a proposal started before a 250 correction is stale when its delayed response returns', () => {
  const start = makeRuntimeFixture('T09');
  const ticket = { caseId: start.caseId, instanceId: start.instanceId, caseVersion: start.version, requestId: 'old-analysis', settingsRevision: 1, dependencies: runtimeDependencies(start) };
  const current = correctRuntimeFact(start, { fieldId: 'E04', recordId: 'TX-01' }, 250, 'Updated while analysis was pending');
  assert.equal(current.facts.find(fact => fact.fieldId === 'E04' && fact.recordId === 'TX-01')?.value, 250);
  assert.equal(ticketCurrent(current, ticket, ticket.requestId, ticket.settingsRevision), false);
});

test('employee type correction survives later analysis and preserves the conflicting type proposal', () => {
  const checked = confirmRuntimeFacts(makeRuntimeFixture('T09'));
  const corrected = correctRuntimeTypes(checked, ['Suspected romance scam', 'Suspected phishing'], 'Caller described both relationship and bank impersonation contact');
  const proposal = AnalysisEnvelopeSchema.parse({ facts: [], analysis: { ...structuredClone(corrected.analysis), types: ['Suspected investment scam'], alternatives: [] }, questions: [] });
  const merged = mergeRuntimeProposal(corrected, proposal);
  assert.deepEqual(merged.analysis.types, ['Suspected romance scam', 'Suspected phishing']);
  assert.equal(merged.analysis.reasons.some(reason => reason.includes('Caller described both')), true);
  assert.equal(merged.analysis.alternatives.some(reason => reason.includes('Suspected investment scam')), true);
  assert.equal(merged.needsFactConfirmation, true);
});

test('follow-up questions require first check, remain target-specific, and obey the 3/9 cap', () => {
  const firstChecked = confirmRuntimeFacts(makeRuntimeFixture('T09'));
  assert.equal(appendSavedQuestionRound(firstChecked, []).followUp.rounds, 0);
  const round = appendSavedQuestionRound(firstChecked, fixedQuestions);
  assert.equal(round.followUp.rounds, 1);
  assert.equal(round.followUp.totalQuestions, 3);
  assert.equal(round.followUp.questions.length, 3);

  const partlyProcessed = answerRuntimeQuestion(round, 'Q1', 'The app says pending.', 'answered', false);
  const noRecipient = answerRuntimeQuestion(partlyProcessed, 'Q3', 'Not applicable', 'not-applicable', false);
  const unknown = answerRuntimeQuestion(noRecipient, 'Q2', 'Unknown / unable to answer', 'unknown', false);
  const repeatedUnknown = { ...fixedQuestions[1], id: 'Q4' };
  const anotherTransaction = { ...fixedQuestions[0], id: 'Q5', target: { fieldId: 'E09', recordId: 'TX-02' } };
  assert.deepEqual(eligibleQuestionProposals(unknown, [repeatedUnknown, anotherTransaction]).map(q => q.id), ['Q4']);
  assert.equal(eligibleQuestionProposals(makeRuntimeFixture('limit'), [anotherTransaction]).length, 0);
});

test('ending follow-up skips pending questions and accepts a later answer without reopening or recounting', () => {
  const checked = confirmRuntimeFacts(makeRuntimeFixture('T09'));
  const started = appendSavedQuestionRound({ ...checked, saved: true }, fixedQuestions);
  const partial = answerRuntimeQuestion(started, 'Q1', 'The app says pending.', 'answered', true);
  const ended = endRuntimeFollowUp(partial);
  assert.equal(ended.followUp.questions.find(q => q.id === 'Q2')?.status, 'skipped');
  assert.equal(ended.followUp.questions.find(q => q.id === 'Q3')?.status, 'skipped');
  const later = answerRuntimeQuestion(ended, 'Q3', 'Recipient is SYN Person X.', 'answered', true);
  assert.equal(later.followUp.stopped, true);
  assert.equal(later.followUp.rounds, 1);
  assert.equal(later.followUp.totalQuestions, 3);
  assert.equal(later.followUp.questions.find(q => q.id === 'Q3')?.status, 'answered');
  assert.equal(later.needsFactConfirmation, true);
  assert.equal(later.sources.find(source => source.id === 'Q3')?.kind, 'answer');
});

if (process.env.B01_BROWSER === '1') test('B01 saved state, failed saves, question counts and newer edits survive the actual host', async () => {
  const { chromium } = await import('playwright');
  const { once } = await import('node:events');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { resolve, relative, isAbsolute, sep } = await import('node:path');
  const { createApp } = await import('../server/src/app');
  const { readConfig } = await import('../server/src/config');
  const { ModelSettingsStore } = await import('../server/src/model-settings');
  const directory = resolve(process.env.B01_EVIDENCE_DIR ?? 'evidence/task-results/B01/fix-20261104/browser');
  const within = relative(resolve('evidence/task-results/B01'), directory);
  assert.ok(within && !isAbsolute(within) && !within.split(sep).includes('..'));
  await mkdir(directory, { recursive: true });
  let providerRequests = 0;
  const server = createApp({ settingsStore: new ModelSettingsStore({ config: readConfig({}), persist: () => {} }),
    fetchImpl: async () => { providerRequests++; throw new Error('No external provider authorised.'); },
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  const checks: string[] = [], errors: string[] = [];
  try {
    for (const route of ['/', '/?module=intake']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => errors.push(error.message));
      // Delay only the storage completion notification to exercise an in-flight save.
      await page.addInitScript(() => {
        const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete')!;
        Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { ...descriptor, set(handler) {
          const transaction = this as IDBTransaction;
          descriptor.set!.call(transaction, function (event: Event) {
            const delay = transaction.mode === 'readwrite' ? (window as Window & { saveDelay?: number }).saveDelay ?? 0 : 0;
            if (delay) setTimeout(() => handler?.call(transaction, event), delay);
            else handler?.call(transaction, event);
          });
        } });
      });
      const intake = page.getByRole('region', { name: 'B01 case intake and follow-up' });
      const button = (name: string) => page.getByRole('button', { name, exact: true });
      const notice = (text: string) => intake.getByRole('status').filter({ hasText: text }).waitFor();
      const state = async () => JSON.parse(await page.getByTestId('runtime-record').textContent() ?? '{}');
      await page.goto(`http://127.0.0.1:${address.port}${route}`);
      await page.getByRole('status').filter({ hasText: 'No runtime history' }).waitFor();
      await intake.waitFor();
      await button('Save fact changes').click(); await notice('Saved after the A01 storage transaction');
      assert.equal((await state()).saved, true);
      await button('Analyze current description').click(); await notice('Analysis proposal received');
      await page.getByLabel('Simulate save failure', { exact: true }).check();
      await button('Complete first fact check').click(); await notice('Save failed');
      assert.equal((await state()).saved, false);
      await page.getByLabel('Simulate save failure', { exact: true }).uncheck();
      await button('Confirm changes to checked facts').click(); await notice('First fact check recorded and saved');
      assert.equal((await state()).saved, true);
      checks.push(`${route}: fact save remains saved; failed first check reports failure; retry persists current review`);
      await page.getByLabel('Simulate save failure', { exact: true }).check();
      await button('Save and display proposed questions').click(); await notice('Question round was not counted');
      assert.equal((await state()).followUp.totalQuestions, 0);
      await page.getByLabel('Simulate save failure', { exact: true }).uncheck();
      await button('Save and display proposed questions').click(); await notice('Round 1 saved and displayed');
      assert.equal((await state()).saved, true);
      assert.equal((await state()).followUp.totalQuestions, 3);
      const question = intake.locator('.intake-question').filter({ hasText: 'Q1 ·' });
      await question.getByRole('textbox').fill('reported pending');
      await question.getByRole('button', { name: 'Save answer and update target', exact: true }).click();
      await notice('Answer for Q1 saved'); assert.equal((await state()).saved, true);
      await button('End follow-up').click(); await notice('Follow-up ended and saved');
      assert.equal((await state()).saved, true);
      const savedRecord = await state();
      await page.reload();
      await page.getByRole('status').filter({ hasText: 'Saved runtime case restored' }).waitFor();
      assert.deepEqual((await state()).followUp, savedRecord.followUp);
      assert.equal((await state()).saved, true);
      checks.push(`${route}: failed question save counts zero; retry counts three once; answer/end save and refresh preserve saved state`);
      await page.evaluate(() => { (window as Window & { saveDelay?: number }).saveDelay = 800; });
      await button('Save fact changes').click();
      if (route === '/') await page.getByText('Diagnostic MOCK controls — foundation fixtures only', { exact: true }).click();
      await button('MOCK change amount to 250').click();
      await notice('An earlier version was saved');
      assert.equal((await state()).facts.find((f: { fieldId: string }) => f.fieldId === 'E04').value, 250);
      assert.equal((await state()).saved, false);
      await page.evaluate(() => { (window as Window & { saveDelay?: number }).saveDelay = 0; });
      await button('Save fact changes').click(); await notice('Saved after the A01 storage transaction');
      assert.equal((await state()).saved, true);
      checks.push(`${route}: delayed save preserves newer 250 as unsaved; explicit retry saves latest version`);
      await page.screenshot({ path: resolve(directory, route === '/' ? 'integrated.png' : 'independent.png'), fullPage: true });
      await context.close();
    }
    assert.deepEqual(errors, []); assert.equal(providerRequests, 0);
  } finally {
    await writeFile(resolve(directory, 'result.json'), JSON.stringify({ checks, errors, providerRequests, scope: 'B01 save regression, Mock training reviews', browser: browser.version() }, null, 2));
    await browser.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
