import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBusinessBaseline } from '../server/src/business';
import { ApprovedGuidelineSchema, BusinessBaselineSchema } from '../shared/business';
import { sourceText } from '../shared/source-text';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from '../server/src/app';
import { readConfig } from '../server/src/config';

test('approved baseline preserves fixed inputs, boundaries and conditional expected decisions', () => {
  const bundle = loadBusinessBaseline();
  assert.equal(bundle.role.enabled, true);
  assert.equal(bundle.role.contentApproval, 'approved');
  assert.equal(bundle.baseline.input, sourceText.narrative);
  assert.equal(bundle.baseline.expectedFacts.find(f => f.fieldId === 'E04')?.value, 200);
  assert.equal(bundle.baseline.expectedFacts.find(f => f.fieldId === 'E03')?.value, null);
  assert.deepEqual(bundle.baseline.recommendations.map(r => r.expectedDecision), ['accepted', 'accepted', 'rejected']);
  assert.equal(bundle.baseline.expectationOnly, true);
  assert.equal(bundle.baseline.execution, 'not-executed');
  assert.ok(bundle.baseline.bodyConditions.some(text => text.includes('not actual staff review')));
});

test('business schemas reject pending guidance and invalid approved references', () => {
  const bundle = loadBusinessBaseline();
  assert.equal(ApprovedGuidelineSchema.safeParse({ ...bundle.guidelines[0], contentApproval: 'pending', enabled: false }).success, false);
  const broken = structuredClone(bundle);
  broken.baseline.recommendations[0].guidelineId = 'INVENTED';
  assert.equal(BusinessBaselineSchema.safeParse(broken).success, false);
});

test('modified content fails the approved artifact hash check', () => {
  mkdirSync('local/business-check', { recursive: true });
  const root = mkdtempSync(resolve('local/business-check', 'modified-'));
  mkdirSync(resolve(root, 'data/business'), { recursive: true });
  for (const name of ['approval.json', 'role.json', 'guidelines.json', 'T09.json']) copyFileSync(resolve('data/business', name), resolve(root, 'data/business', name));
  const rolePath = resolve(root, 'data/business/role.json');
  writeFileSync(rolePath, readFileSync(rolePath, 'utf8').replaceAll('\n', '\r\n'));
  assert.equal(loadBusinessBaseline(root).role.enabled, true);
  const role = JSON.parse(readFileSync(rolePath, 'utf8')); role.permissions.push('Unapproved account operation');
  writeFileSync(rolePath, JSON.stringify(role));
  assert.throws(() => loadBusinessBaseline(root), /differs from registry/);
});

test('approved business API is distinct from legacy mock case approval', async () => {
  const server = createApp({ config: readConfig({ MODEL_MODE: 'mock' }) }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${base}/api/business`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).approval.status, 'approved');
    assert.equal((await (await fetch(`${base}/api/health`)).json()).contentApproval, 'pending');
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
