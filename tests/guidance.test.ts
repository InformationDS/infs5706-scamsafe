import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRuntimeFixture } from '../shared/runtime-fixtures';
import { RuntimeCaseRecordSchema, dependenciesValid, runtimeReviewValid } from '../shared/runtime';
import { activeRecommendations, actionableRecommendations, changeGuidanceContext, decideRecommendation, evaluateGuidance, guidanceHandoff, NO_GUIDANCE, recalculateGuidance, recommendationEdited } from '../shared/guidance';

test('T09 matches approved facts and source context; generated decisions start pending', () => {
  const r = makeRuntimeFixture('T09'), result = evaluateGuidance(r);
  assert.equal(result.guidanceStatus, 'available');
  assert.deepEqual(result.matches.map(m => [m.id, m.matched]), [['EX-G01', true], ['EX-G02', true], ['EX-G03', true]]);
  assert.deepEqual(result.recommendations.map(r => r.id), ['REC-01', 'REC-02', 'REC-03']);
  assert.ok(result.recommendations.every(r => r.decision === 'pending' && !r.simulated));
  assert.match(result.recommendations[0].limits.join(' '), /E09:TX-01: unknown/);
  assert.match(result.recommendations[1].priority.reason, /parallel/);
  assert.match(result.recommendations[2].priority.reason, /lower priority/);
  assert.ok(RuntimeCaseRecordSchema.safeParse(recalculateGuidance(r)).success);
});

test('repeated matching and unchanged package reload do not create new versions or review requirements', () => {
  const r = recalculateGuidance(makeRuntimeFixture('T09'));
  assert.equal(recalculateGuidance(r), r);
  assert.equal(changeGuidanceContext(r, 'reload-guidance'), r);
});

test('reject REC-03, recalculate and reload preserve its ID, reason, history and all facts', () => {
  const r = recalculateGuidance(makeRuntimeFixture('unknown'));
  const rejected = decideRecommendation(r, 'REC-03', 'rejected', { actor: 'TEST-EMPLOYEE', reason: 'Duplicate information.' });
  const recalculated = recalculateGuidance(rejected);
  assert.equal(recalculated, rejected);
  assert.deepEqual(recalculated.facts, r.facts);
  assert.deepEqual(recalculated.followUp, r.followUp);
  assert.deepEqual(recalculated.reviews, r.reviews);
  assert.equal(recalculated.recommendations.find(r => r.id === 'REC-03')?.decisionReason, 'Duplicate information.');
  assert.equal(recalculated.recommendations.find(r => r.id === 'REC-03')?.history.length, 1);
  assert.ok(!actionableRecommendations(recalculated).some(r => r.id === 'REC-03'));
  assert.equal(changeGuidanceContext(recalculated, 'reload-guidance'), recalculated);
});

test('rejection invalidates only outputs depending on the changed recommendation', () => {
  let r = recalculateGuidance(makeRuntimeFixture('output-error'));
  const rec = r.recommendations.find(r => r.id === 'REC-03')!;
  rec.decision = 'pending'; rec.decisionReason = null;
  // Model an E-produced output with exact recommendation dependencies, not the broad A01 mock snapshot.
  r.outputs.forEach(o => { o.dependencies = Object.fromEntries((o.recommendationIds ?? []).map(id => [`recommendation:${id}`, r.recommendations.find(x => x.id === id)!.version])); });
  r.reviews = r.reviews.filter(v => v.stage === 'first');
  for (const o of r.outputs) r.reviews.push({ stage: 'final', objectId: o.id, objectVersion: o.version, dependencies: { ...o.dependencies }, simulated: true, actor: 'MOCK-STAFF', reviewedAt: '2026-10-17T00:00:00.000Z' });
  assert.equal(runtimeReviewValid(r, 'HANDOVER-BANK', true), true);
  r = decideRecommendation(r, 'REC-03', 'rejected', { actor: 'TEST-EMPLOYEE', reason: 'Already included.' });
  assert.equal(runtimeReviewValid(r, 'HANDOVER-BANK', true), true);
  assert.equal(runtimeReviewValid(r, 'HANDOVER-TELCO', true), false);
  assert.deepEqual(guidanceHandoff(r).outputsToRefresh, ['HANDOVER-TELCO']);
});

test('employee editing retains original content and survives acceptance and recomputation', () => {
  let r = recalculateGuidance(makeRuntimeFixture('T09'));
  const original = r.recommendations[0].step;
  r = decideRecommendation(r, 'REC-01', 'modified', { actor: 'TEST-EMPLOYEE', reason: 'Clarify local preparation.', step: 'Prepare a local note for human assessment with uncertainties.' });
  assert.equal(JSON.parse(r.recommendations[0].history[0].previous).step, original);
  r = decideRecommendation(r, 'REC-01', 'accepted', { actor: 'TEST-EMPLOYEE' });
  assert.equal(recommendationEdited(r.recommendations[0]), true);
  assert.equal(recalculateGuidance(r).recommendations[0].step, 'Prepare a local note for human assessment with uncertainties.');
  assert.equal(r.reviews.filter(v => v.stage === 'final' && !v.simulated).length, 0);
});

test('decision validation requires actor, reasons and current basis', () => {
  const r = recalculateGuidance(makeRuntimeFixture('T09'));
  assert.throws(() => decideRecommendation(r, 'REC-01', 'accepted', { actor: '' }), /identifier/);
  assert.throws(() => decideRecommendation(r, 'REC-01', 'rejected', { actor: 'TEST' }), /reason/);
  assert.throws(() => decideRecommendation(r, 'REC-01', 'modified', { actor: 'TEST', reason: 'Changed' }), /text/);
  const stale = changeGuidanceContext(r, 'suspend-guidance');
  assert.throws(() => decideRecommendation(stale, 'REC-01', 'accepted', { actor: 'TEST' }), /Recalculate/);
});

for (const status of ['conflict', 'not-applicable'] as const) test(`${status} E09 omits only EX-G01`, () => {
  const r = makeRuntimeFixture('T09'), f = r.facts.find(f => f.fieldId === 'E09')!;
  f.status = status;
  const result = evaluateGuidance(r);
  assert.deepEqual(result.recommendations.map(r => r.id), ['REC-02', 'REC-03']);
  assert.ok(result.matches[0].reasons.some(reason => reason.includes(status)));
});

test('completed debit, unapproved bank and missing required SMS are not filled from type labels', () => {
  const r = makeRuntimeFixture('unknown');
  r.facts.find(f => f.fieldId === 'E09')!.value = 'reported completed';
  assert.deepEqual(evaluateGuidance(r).recommendations.map(r => r.id), ['REC-02', 'REC-03']);
  r.facts.find(f => f.fieldId === 'C03')!.value = null;
  assert.equal(evaluateGuidance(r).summaryOnly, true);
  r.facts.find(f => f.fieldId === 'E09')!.value = 'reported pending';
  r.facts.find(f => f.fieldId === 'E07')!.value = 'Some other bank';
  assert.equal(evaluateGuidance(r).summaryOnly, true);
});

test('provider context and SMS clue sources are individually necessary', () => {
  const r = makeRuntimeFixture('T09');
  r.sources.find(s => s.id === 'S4')!.text = 'The sender claims to work at SYN Telco B.';
  assert.deepEqual(evaluateGuidance(r).recommendations.map(r => r.id), ['REC-01', 'REC-03']);
  r.facts.find(f => f.fieldId === 'J02')!.sourceIds = [];
  assert.deepEqual(evaluateGuidance(r).recommendations.map(r => r.id), ['REC-01']);
  r.facts.find(f => f.fieldId === 'F06')!.sourceIds = [];
  assert.equal(evaluateGuidance(r).summaryOnly, true);
});

test('altered, unapproved, expired and duplicate definitions never authorise steps', () => {
  for (const patch of [{ contentApproval: 'pending' }, { enabled: false }, { validity: 'expired' }, { step: 'Freeze funds' }, { version: 2 }]) {
    const r = makeRuntimeFixture('T09');
    Object.assign(r.guidelines[0], patch); // Deliberately malformed negative input to the pure evaluator.
    assert.deepEqual(evaluateGuidance(r).recommendations.map(r => r.id), ['REC-02', 'REC-03']);
  }
  const r = makeRuntimeFixture('T09');
  r.guidelines.push(structuredClone(r.guidelines[0]));
  assert.deepEqual(evaluateGuidance(r).recommendations.map(r => r.id), ['REC-02', 'REC-03']);
});

test('restricted permissions and guidance changes retain facts, first-review history and question counts', () => {
  const initial = recalculateGuidance(makeRuntimeFixture('unknown'));
  const restricted = changeGuidanceContext(initial, 'suspend-role');
  assert.equal(activeRecommendations(restricted).length, 0);
  assert.equal(restricted.guidanceStatus, 'none');
  assert.deepEqual(restricted.facts, initial.facts);
  assert.deepEqual(restricted.followUp, initial.followUp);
  assert.deepEqual(restricted.reviews, initial.reviews);
  const restored = changeGuidanceContext(restricted, 'restore-role');
  assert.equal(activeRecommendations(restored).length, 3);
  const suspended = changeGuidanceContext(restored, 'suspend-guidance');
  assert.equal(activeRecommendations(suspended).length, 0);
  assert.equal(recalculateGuidance(suspended).guidanceStatus, 'stale');
  assert.equal(activeRecommendations(changeGuidanceContext(suspended, 'reload-guidance')).length, 3);
});

test('a fact version update invalidates only recommendations depending on it', () => {
  const r = recalculateGuidance(makeRuntimeFixture('unknown'));
  r.facts.find(f => f.fieldId === 'E04')!.version++;
  assert.equal(dependenciesValid(r, r.recommendations[0].dependencies), false);
  assert.equal(dependenciesValid(r, r.recommendations[1].dependencies), true);
  assert.equal(dependenciesValid(r, r.recommendations[2].dependencies), true);
  const next = recalculateGuidance(r);
  assert.equal(next.recommendations[0].version, r.recommendations[0].version + 1);
  assert.equal(next.recommendations[1].version, r.recommendations[1].version);
});

test('no-guidance has fixed message and summary-only eligibility without recipients or fabricated actions', () => {
  const r = makeRuntimeFixture('no-guidance'), result = evaluateGuidance(r);
  assert.equal(NO_GUIDANCE, 'Insufficient approved guidance; human review required');
  assert.equal(result.summaryOnly, true);
  assert.deepEqual(result.recommendations, []);
  assert.deepEqual(guidanceHandoff(r).recommendations, []);
  assert.deepEqual(recalculateGuidance(r).outputs, r.outputs);
});

test('rejected records remain historical during loss and restoration of guidance', () => {
  let r = recalculateGuidance(makeRuntimeFixture('unknown'));
  r = decideRecommendation(r, 'REC-03', 'rejected', { actor: 'TEST', reason: 'Duplicate.' });
  r = changeGuidanceContext(r, 'suspend-guidance');
  assert.equal(actionableRecommendations(r).length, 0);
  r = changeGuidanceContext(r, 'reload-guidance');
  assert.equal(r.recommendations.filter(x => x.id === 'REC-03').length, 1);
  assert.equal(r.recommendations.find(x => x.id === 'REC-03')!.decision, 'rejected');
  assert.ok(!actionableRecommendations(r).some(x => x.id === 'REC-03'));
});

test('newly supplied allowed-unknown fact requires recalculation before a stored action is current', () => {
  const input = makeRuntimeFixture('T09');
  const amount = structuredClone(input.facts.find(f => f.fieldId === 'E04')!);
  input.facts = input.facts.filter(f => f.fieldId !== 'E04');
  const r = recalculateGuidance(input);
  r.facts.push(amount);
  assert.ok(RuntimeCaseRecordSchema.safeParse(r).success);
  assert.deepEqual(activeRecommendations(r).map(x => x.id), ['REC-02', 'REC-03']);
  assert.deepEqual(actionableRecommendations(r).map(x => x.id), ['REC-02', 'REC-03']);
  const next = recalculateGuidance(r);
  assert.equal(activeRecommendations(next).length, 3);
  assert.equal(next.recommendations[0].version, r.recommendations[0].version + 1);
  assert.equal(next.recommendations[1].version, r.recommendations[1].version);
});

test('fixture decisions with a different stored basis must be recalculated before employee action', () => {
  const r = makeRuntimeFixture('output-error');
  assert.equal(activeRecommendations(r).length, 0);
  assert.throws(() => decideRecommendation(r, 'REC-01', 'accepted', { actor: 'TEST' }), /Recalculate/);
  assert.equal(activeRecommendations(recalculateGuidance(r)).length, 3);
});

test('rejection and employee wording survive JSON restoration, both context cycles and recalculation', () => {
  let r = recalculateGuidance(makeRuntimeFixture('unknown'));
  const before = structuredClone({ facts: r.facts, followUp: r.followUp, reviews: r.reviews });
  r = decideRecommendation(r, 'REC-03', 'rejected', { actor: 'TEST', reason: 'Duplicate.' });
  r = decideRecommendation(r, 'REC-01', 'modified', { actor: 'TEST', reason: 'Clarify.', step: 'Employee local wording with uncertainty.' });
  const history = structuredClone(r.recommendations.map(x => x.history));
  r = RuntimeCaseRecordSchema.parse(JSON.parse(JSON.stringify(r)));
  for (const change of ['suspend-role', 'restore-role', 'suspend-guidance', 'reload-guidance'] as const) r = changeGuidanceContext(r, change);
  r = recalculateGuidance(r);
  assert.deepEqual({ facts: r.facts, followUp: r.followUp, reviews: r.reviews }, before);
  assert.deepEqual(r.recommendations.map(x => x.history), history);
  assert.equal(r.recommendations[0].step, 'Employee local wording with uncertainty.');
  assert.ok(recommendationEdited(r.recommendations[0]));
  assert.equal(r.recommendations[2].decisionReason, 'Duplicate.');
  assert.deepEqual(actionableRecommendations(r).map(x => x.id), ['REC-01', 'REC-02']);
});

test('missing required fact, unknown permitted condition and one unavailable guideline remain local', () => {
  const r = makeRuntimeFixture('T09');
  r.facts = r.facts.filter(f => f.fieldId !== 'E07');
  assert.deepEqual(evaluateGuidance(r).recommendations.map(x => x.id), ['REC-02', 'REC-03']);
  const fresh = recalculateGuidance(makeRuntimeFixture('T09'));
  const changed = structuredClone(fresh);
  changed.guidelines[0].step = 'Unapproved altered content';
  const next = recalculateGuidance(changed);
  assert.deepEqual(activeRecommendations(next).map(x => x.id), ['REC-02', 'REC-03']);
  assert.equal(next.recommendations.find(x => x.id === 'REC-02')!.version, fresh.recommendations[1].version);
  assert.equal(next.recommendations.find(x => x.id === 'REC-03')!.version, fresh.recommendations[2].version);
  const withoutPermission = makeRuntimeFixture('T09');
  withoutPermission.role.permissions = withoutPermission.role.permissions.filter(p => p !== 'Prepare human assessment requests as local drafts');
  assert.deepEqual(evaluateGuidance(withoutPermission).recommendations.map(x => x.id), ['REC-02', 'REC-03']);
});

// Actual D UI and IndexedDB; optional so the pure module suite needs no browser.
if (process.env.D01_BROWSER === '1') test('D01 actual UI: decisions, edited wording, context cycles, restore and no-guidance', async () => {
  const { chromium } = await import('playwright');
  const { once } = await import('node:events');
  const { mkdir, writeFile, access } = await import('node:fs/promises');
  const { resolve, relative, isAbsolute, sep } = await import('node:path');
  const { createApp } = await import('../server/src/app');
  const { readConfig } = await import('../server/src/config');
  const { ModelSettingsStore } = await import('../server/src/model-settings');
  const directory = resolve(process.env.D01_EVIDENCE_DIR ?? 'evidence/task-results/D01/run-02/actual-ui');
  const within = relative(resolve('evidence/task-results/D01'), directory);
  assert.ok(within && !isAbsolute(within) && !within.split(sep).includes('..'));
  await mkdir(directory, { recursive: true });
  await assert.rejects(access(resolve(directory, 'result.json')), { code: 'ENOENT' });
  let providerRequests = 0;
  const server = createApp({ settingsStore: new ModelSettingsStore({ config: readConfig({}), persist: () => {} }),
    fetchImpl: async () => { providerRequests++; throw new Error('No external provider authorised.'); },
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const checks: string[] = [], errors: string[] = [];
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let currentPage: import('playwright').Page | undefined;
  let failure: string | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    for (const route of ['/', '/?module=guidance']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
      const page = await context.newPage();
      currentPage = page;
      page.setDefaultTimeout(10000);
      page.on('pageerror', e => errors.push(e.message));
      const guidance = page.getByRole('region', { name: 'Guidance and employee decisions' });
      const button = (name: string) => page.getByRole('button', { name, exact: true });
      const status = (text: string) => page.getByRole('status').filter({ hasText: text }).waitFor();
      const state = async () => RuntimeCaseRecordSchema.parse(JSON.parse(await page.getByTestId('runtime-record').textContent() ?? '{}'));
      await page.goto(`http://127.0.0.1:${address.port}${route}`);
      await status('No runtime history'); await guidance.waitFor();
      await page.getByLabel('Fixed runtime variant').selectOption('unknown');
      await button('Reset fixed input').click();
      if (await page.getByRole('dialog').count()) await button('Discard changes and continue').click();
      await status('Reset unknown');
      const original = await state();
      await button('Recalculate guidance').click();
      await guidance.getByLabel('Employee identifier', { exact: true }).fill('SYNTHETIC-D01-TEST');
      await guidance.getByLabel('Reason for REC-03', { exact: true }).fill('Duplicate local preparation.');
      await button('Reject REC-03').click();
      const originalStep = (await state()).recommendations[0].step;
      await guidance.getByLabel('Reason for REC-01', { exact: true }).fill('Clarify local wording.');
      await guidance.getByLabel('Edited step for REC-01', { exact: true }).fill('Employee local wording; preserve uncertainties.');
      await button('Modify REC-01').click();
      await button('Accept REC-01').click();
      await button('Recalculate guidance').click();
      assert.equal(await guidance.getByText('Employee edited · employee wording; requires final review.', { exact: true }).count(), 1);
      const decided = await state();
      assert.equal(JSON.parse(decided.recommendations[0].history[0].previous).step, originalStep);
      for (const change of ['Suspend guidance', 'Reload approved guidance']) {
        await button(change).click();
        if (change === 'Suspend guidance') {
          assert.ok(await button('Accept REC-01').isDisabled());
          await guidance.getByText(NO_GUIDANCE, { exact: true }).waitFor();
        }
      }
      const role = guidance.getByRole('combobox', { name: /^Organisation \/ role/ });
      await role.selectOption('inactive');
      assert.ok(await button('Reject REC-03').isDisabled());
      await role.selectOption('EX-ROLE-01');
      await button('Recalculate guidance').click();
      const current = await state();
      assert.deepEqual(current.facts, original.facts);
      assert.deepEqual(current.followUp, original.followUp);
      assert.deepEqual(current.reviews, original.reviews);
      assert.equal(current.recommendations[0].step, 'Employee local wording; preserve uncertainties.');
      assert.deepEqual(current.recommendations.map(x => x.history), decided.recommendations.map(x => x.history));
      assert.equal(current.recommendations[2].decisionReason, 'Duplicate local preparation.');
      assert.deepEqual(actionableRecommendations(current).map(x => x.id), ['REC-01', 'REC-02']);
      await button('Save runtime case').click(); await status('Saved after IndexedDB');
      await page.reload(); await status('Saved runtime case restored');
      await guidance.waitFor();
      await guidance.getByText('Employee edited · employee wording; requires final review.', { exact: true }).waitFor();
      await guidance.getByText('Rejected: Duplicate local preparation. · Excluded from recommended actions.', { exact: true }).waitFor();
      const restored = await state();
      assert.deepEqual(restored.recommendations, current.recommendations);
      assert.deepEqual(restored.reviews, original.reviews);
      const handoff = guidanceHandoff(restored);
      assert.equal(handoff.recommendations.find(x => x.id === 'REC-01')!.employeeEdited, true);
      assert.equal(handoff.recommendations.find(x => x.id === 'REC-03')!.decisionReason, 'Duplicate local preparation.');
      assert.equal(handoff.recommendations.find(x => x.id === 'REC-03')!.includeAction, false);
      const prefix = route === '/' ? 'integration' : 'independent';
      await page.screenshot({ path: resolve(directory, `${prefix}-decisions.png`), fullPage: true });
      await writeFile(resolve(directory, `${prefix}-handoff.json`), JSON.stringify(guidanceHandoff(restored), null, 2));
      checks.push(`${prefix}: actual accept/modify/reject, original text and Employee edited, both context cycles, stable rejection/history, facts/reviews/counts, IndexedDB save/refresh`);
      await page.getByLabel('Fixed runtime variant').selectOption('no-guidance');
      await button('Reset fixed input').click(); await status('Reset no-guidance');
      await button('Recalculate guidance').click();
      await guidance.getByText(NO_GUIDANCE, { exact: true }).waitFor();
      assert.equal(actionableRecommendations(await state()).length, 0);
      assert.equal(await guidance.getByText('Related human responsibilities', { exact: true }).count(), 0);
      await page.screenshot({ path: resolve(directory, `${prefix}-no-guidance.png`), fullPage: true });
      checks.push(`${prefix}: fixed no-guidance message, no actionable recommendations or related recipient path; E summary remains unimplemented`);
      await context.close();
    }
    assert.deepEqual(errors, []); assert.equal(providerRequests, 0);
  } catch (error) {
    failure = String(error);
    await currentPage?.screenshot({ path: resolve(directory, 'failure.png'), fullPage: true });
    throw error;
  }
  finally {
    await writeFile(resolve(directory, 'result.json'), JSON.stringify({ checks, errors, providerRequests, failure, browser: browser?.version(), scope: 'Actual D module and A storage; no E body generation or human/F acceptance' }, null, 2));
    await browser?.close(); server.closeAllConnections(); await new Promise<void>(done => server.close(() => done()));
  }
});
