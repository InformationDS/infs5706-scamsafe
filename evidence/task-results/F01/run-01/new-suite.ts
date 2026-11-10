/** User-requested fresh-case validation. Fake provider through the REAL course HTTP/model adapter.
 * No production functions, model settings or approved guideline content are changed.
 * Run from repository root: node --import tsx evidence/task-results/F01/run-01/new-suite.ts <fresh-evidence-dir>
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright';
import { createApp } from '../../../../server/src/app';
import { readConfig } from '../../../../server/src/config';
import { ModelSettingsStore } from '../../../../server/src/model-settings';
import { createCourseCase, CourseCaseSchema, ROLES, type CourseCase, type TurnProposal } from '../../../../shared/course-case';

const out = resolve(process.argv[2] ?? 'evidence/task-results/F01/run-01/new-suite-attempt-01');
assert.ok(out.startsWith(resolve('evidence/task-results/F01') + '/'));
await mkdir(out, { recursive: true });
await assert.rejects(access(resolve(out, 'result.json')), { code: 'ENOENT' });
const cases = JSON.parse(await readFile('evidence/task-results/F01/run-01/new-cases.json', 'utf8')).cases;
const checks: any[] = [], errors: string[] = [], requests: any[] = [];
let providerCalls = 0, current: any, failNext = false;
const check = async (id: string, label: string, fn: () => unknown | Promise<unknown>, details?: unknown) => {
  try { await fn(); checks.push({ id, label, status: 'passed' }); }
  catch (error) { checks.push({ id, label, status: 'failed', error: String(error), details }); }
};
const value = (r: CourseCase, key: string) => r.facts.find(f => f.key === key)?.value;
const empty = (): TurnProposal => ({ understoodAs: 'other', reply: 'The current record is preserved.', factChanges: [], questionUpdates: [], proposedQuestions: [], types: null, attention: null, recommendations: null, materials: null });
function proposal(payload: any): TurnProposal {
  const text = payload.latestUserMessage, p = empty(), role = payload.role.id;
  if (payload.purpose === 'generate') {
    p.materials = {
      summaryNarrative: 'The person described the reported concern. The facts and gaps below remain for human review.',
      personWhatHappened: 'You described a concern and we recorded your report without claiming it is verified.',
      personNextSteps: ['You can review the recorded information with a human reviewer.'],
      personSupport: 'You can ask someone you trust to support you.',
      handoverReason: 'The receiving team can assess the relevant reported concern.',
      handoverRequest: 'Please review the relevant facts and confirm whether further assessment is appropriate.',
      handoverGuidelineId: current.recipient[role] === 'bank' ? 'DEMO-G01' : current.recipient[role] === 'telecom' ? 'DEMO-G02' : null,
    };
    return p;
  }
  if (text === current.text) {
    p.understoodAs = 'initial-report'; p.reply = 'Your report has been recorded for human assessment.';
    p.factChanges = current.facts.map(([key, val, evidence]: any[]) => ({ key, value: val, certainty: val === null ? 'unknown' : 'stated', evidence }));
    p.types = [{ label: current.type, reason: 'This candidate reflects the reported description and remains unverified.', evidence: current.typeEvidence }];
    p.attention = current.id === 'N04' ? [{ kind: 'vulnerability', text: 'The person reported feeling overwhelmed.', evidence: 'feel overwhelmed' }] : [];
    const guideline = current.id === 'N02' || current.id === 'N05' ? (role === 'telecom' ? 'DEMO-G02' : 'DEMO-G01') : current.guideline;
    const other = (role === 'bank' && guideline === 'DEMO-G02') || (role === 'telecom' && ['DEMO-G01','DEMO-G04'].includes(guideline));
    p.recommendations = guideline ? [{ id: 'R1', guidelineId: guideline, organisation: other ? (role === 'bank' ? 'SYN Telecom B' : 'SYN Bank A') : (role === 'bank' ? 'SYN Bank A' : 'SYN Telecom B'), priority: 'now', audience: other ? 'other-organisation' : 'this-organisation', action: 'Ask a human reviewer to assess the reported concern within the receiving team remit.', reason: 'The stated facts require human judgement before any action.' }] : [];
    if (current.questions) p.proposedQuestions = [
      { id: 'Q1', text: 'Is contact continuing?', purpose: 'Clarify current contact', relatedKeys: ['stillInContact'] },
      { id: 'Q2', text: 'What is the current debit status?', purpose: 'Clarify reported debit status', relatedKeys: ['transactionStatus'] },
      { id: 'Q3', text: 'Have you contacted an organisation?', purpose: 'Clarify existing support', relatedKeys: ['organisationsContacted'] },
    ];
    return p;
  }
  if (text === 'Is the amount 13 GBP?') {
    p.understoodAs = 'query'; p.reply = 'The recorded amount remains unchanged; this is a question.';
    // A query must ignore an erroneous model fact change and question answer.
    p.factChanges = [{ key: 'amount', value: '13', certainty: 'stated', evidence: '13' }];
    p.questionUpdates = [{ questionId: 'Q1', result: 'answered', evidence: '13' }]; return p;
  }
  if (text === 'The correct amount is 19 GBP, not 86.') {
    p.understoodAs = 'correction'; p.reply = 'The amount is corrected to the amount you explicitly supplied.';
    p.factChanges = [{ key: 'amount', value: '19', certainty: 'stated', evidence: '19' }]; return p;
  }
  if (text === 'I cannot confirm whether the amount is exact.') {
    p.understoodAs = 'uncertainty'; p.factChanges = [{ key: 'amount', value: null, certainty: 'uncertain', evidence: 'cannot confirm' }]; return p;
  }
  if (text === '1: No further contact; 2: Pending; 3: I do not know.') {
    p.understoodAs = 'multi-answer'; p.reply = 'The first two answers are recorded and the third remains unknown.';
    p.factChanges = [{ key: 'stillInContact', value: 'No', certainty: 'stated', evidence: 'No further contact' }, { key: 'transactionStatus', value: 'Pending', certainty: 'stated', evidence: 'Pending' }];
    p.questionUpdates = [{ questionId: 'Q1', result: 'answered', evidence: 'No further contact' }, { questionId: 'Q2', result: 'answered', evidence: 'Pending' }, { questionId: 'Q3', result: 'unknown', evidence: 'I do not know' }]; return p;
  }
  if (text === 'The message was deleted.') {
    p.understoodAs = 'supplement'; p.factChanges = [{ key: 'evidenceAvailable', value: 'Message deleted', certainty: 'stated', evidence: 'message was deleted' }]; return p;
  }
  return p;
}
const config = readConfig({ MODEL_MODE: 'live', MODEL_BASE_URL: 'https://fixture-provider.invalid/v1', MODEL_NAME: 'F01-fake-provider', MODEL_API_KEY: 'synthetic-placeholder', MODEL_TIMEOUT_MS: '1000' });
const store = new ModelSettingsStore({ config, persist: () => {} });
const fakeFetch: typeof fetch = async (url, options) => {
  assert.equal(String(url), 'https://fixture-provider.invalid/v1/chat/completions');
  providerCalls++;
  await new Promise(done => setTimeout(done, 150));
  if (failNext) { failNext = false; return new Response(JSON.stringify({ choices: [{ message: { content: 'INVALID JSON' } }] })); }
  const body = JSON.parse(String(options?.body)); const payload = JSON.parse(body.messages[1].content);
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(proposal(payload)) } }] }), { headers: { 'Content-Type': 'application/json' } });
};
const server = createApp({ settingsStore: store, fetchImpl: fakeFetch }).listen(0, '127.0.0.1');
await once(server, 'listening'); const address = server.address(); assert.ok(address && typeof address !== 'string');
const base = `http://127.0.0.1:${address.port}`;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch({ headless: true });
  for (const scenario of cases) for (const role of ['bank','telecom'] as const) {
    current = scenario;
    const id = `${scenario.id}-${role}`;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read','clipboard-write'], acceptDownloads: true });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', e => errors.push(`${id}: ${e.message}`));
    let dialog = 'accept'; page.on('dialog', d => dialog === 'accept' ? d.accept() : d.dismiss());
    const button = (name: string) => page.getByRole('button', { name, exact: true });
    const input = page.getByLabel('Case description or additional information', { exact: true });
    const panel = page.getByRole('region', { name: 'Case information and results' });
    const editor = page.getByRole('textbox', { name: 'Current material text', exact: true });
    let record: CourseCase | undefined;
    async function turn(text?: string, generate = false, expectedStatus = 200) {
      if (text !== undefined) await input.fill(text);
      const responsePromise = page.waitForResponse(r => r.url().endsWith('/api/course/turn') && r.request().method() === 'POST');
      const trigger = generate ? button(record?.materials.status === 'not-generated' ? 'Generate materials' : 'Regenerate materials') : page.locator('.course-primary');
      await trigger.click();
      await check(`${id}-busy-${requests.length}`, 'busy controls prevent duplicate submissions', async () => { assert.equal(await input.isDisabled(),true); assert.equal(await button('New case').isDisabled(),true); });
      const response = await responsePromise; const data = await response.json();
      requests.push({ id, status: response.status(), request: response.request().postDataJSON(), response: data });
      await page.locator('.course-primary').filter({ hasNotText: 'Processing' }).waitFor();
      assert.equal(response.status(), expectedStatus, JSON.stringify(data));
      if (data.case) record = CourseCaseSchema.parse(data.case);
      return data;
    }
    try {
      await page.goto(`${base}/?view=course`); await input.waitFor();
      await input.fill(scenario.text); await button(role === 'bank' ? 'Bank employee' : 'Telecom employee').click();
      assert.equal(await input.inputValue(), scenario.text);
      await turn(); assert.ok(record);
      await check(`${id}-analysis`, 'fresh report, role, facts and current next step', () => {
        assert.equal(record!.role.id,role); assert.equal(record!.questions.length,scenario.questions ? 3 : 0);
        assert.ok(record!.messages.at(-1)!.text.includes('Next:'));
        for (const [key,val] of scenario.facts) assert.equal(value(record!,key),val);
      });
      await check(`${id}-role-ui`, 'role responsibilities and role picker reflect active case', async () => {
        assert.match(await page.getByRole('region',{name:'Current employee role'}).innerText(), new RegExp(ROLES[role].title));
        assert.equal(await button('Bank employee').count(),0); assert.equal(await button('Telecom employee').count(),0);
      });
      if (scenario.id === 'N02') {
        const before = structuredClone(record!);
        await turn('Is the amount 13 GBP?');
        await check(`${id}-query`, 'query and model-proposed answers do not alter facts or question progress', () => { assert.deepEqual(record!.facts,before.facts); assert.deepEqual(record!.questions,before.questions); });
        await turn('The correct amount is 19 GBP, not 86.');
        await turn('I cannot confirm whether the amount is exact.');
        await check(`${id}-uncertainty`, 'explicit correction wins; uncertainty retains amount and records gap', () => { assert.equal(value(record!,'amount'),'19'); assert.ok(record!.facts.find(f=>f.key==='amount')!.uncertainty); });
        await turn('1: No further contact; 2: Pending; 3: I do not know.');
        await check(`${id}-multi-answer`, 'numbered answers close only their questions and retain unknown', () => { assert.deepEqual(record!.questions.map(q=>q.status),['answered','answered','unknown']); assert.equal(value(record!,'transactionStatus'),'Pending'); });
        failNext = true; const beforeFailure = structuredClone(record!);
        await turn('The message was deleted.',false,502);
        assert.equal(await input.inputValue(),'The message was deleted.');
        await turn(undefined,false,200);
        await check(`${id}-retry`, 'invalid output retains input; retry reuses failed message identity', () => {
          const last = requests.at(-1); assert.ok(last.request.retryMessageId);
          assert.equal(record!.messages.filter(m=>m.role==='user'&&m.text==='The message was deleted.').length,1);
          assert.equal(value(record!,'amount'),value(beforeFailure,'amount'));
        });
      }
      await button('Guidance').click();
      await check(`${id}-guidance-ui`, 'guidance facts and role differences render without losing conversation', async () => {
        if (record!.recommendations.length) assert.ok((await panel.innerText()).includes(record!.recommendations[0].guidelineId));
        else assert.match(await panel.innerText(),/No guidance yet/);
      });
      await turn(undefined,true);
      const expected = scenario.recipient[role]; const actual = record!.materials.handover;
      await check(`${id}-handover`, 'only appropriate receiving institution gets a handover', () => {
        if (expected === null) assert.equal(actual,null);
        else assert.match(actual ?? '',expected==='bank' ? /Recipient: SYN Bank A/ : /Recipient: SYN Telecom B/);
      },{ expected, actual });
      await check(`${id}-materials`, 'materials contain current facts, unknowns and fictional summary marker', () => {
        assert.match(record!.materials.summary,/FICTIONAL COURSE CASE/);
        for (const key of ['amount','currency']) { const v=value(record!,key); if(v) assert.ok(record!.materials.summary.includes(v)); }
        assert.doesNotMatch(record!.materials.personExplanation,/Unknown Unknown|staff should|the employee should/i);
      });
      await button('Confirm materials').click();
      for (const [label,filename] of [['Case summary','scamsafe-summary.md'],['For the person','scamsafe-person.md'],...(actual ? [['Handover draft','scamsafe-handover.md']] : [])]) {
        await page.getByRole('group',{name:'Material views'}).getByRole('button',{name:label,exact:true}).click();
        const shown=await editor.inputValue();
        await button('Copy').click();
        const copied=await page.evaluate(()=>navigator.clipboard.readText());
        const event=page.waitForEvent('download'); await button('Download Markdown').click(); const download=await event;
        await download.saveAs(resolve(out,`${id}-${filename}`));
        await check(`${id}-export-${label}`, 'copy and Markdown bytes match the selected material',async()=>{ assert.equal(copied,shown);assert.equal(download.suggestedFilename(),filename);assert.equal(await readFile(resolve(out,`${id}-${filename}`),'utf8'),shown); });
      }
      if (scenario.id === 'N02') {
        await page.getByRole('group',{name:'Material views'}).getByRole('button',{name:'Case summary',exact:true}).click();
        const manual=(await editor.inputValue())+'\nEmployee note: keep this uncertainty visible.';
        await editor.fill(manual);
        await check(`${id}-edit-lock`, 'editing removes confirmation and blocks copy/download',async()=>{ assert.ok(await button('Copy').isDisabled());assert.ok(await button('Download Markdown').isDisabled()); });
        await button('Case overview').click();
        const amount=page.getByLabel('Reported amount',{exact:true}); await amount.fill('23');await amount.press('Tab');
        await button('Materials').click();
        await check(`${id}-stale`, 'fact edits preserve employee wording while disabling confirmation',async()=>{ assert.equal(await editor.inputValue(),manual); assert.ok(await button('Confirm materials').isDisabled()); });
        const calls=providerCalls;dialog='dismiss';await button('Regenerate materials').click();dialog='accept';
        await check(`${id}-cancel-regenerate`, 'cancelled regeneration preserves text without a provider request',async()=>{ assert.equal(providerCalls,calls);assert.equal(await editor.inputValue(),manual); });
        await turn(undefined,true);
        await check(`${id}-regenerate`, 'confirmed replacement reflects employee fact edit',()=>{ assert.match(record!.materials.summary,/Reported amount: 23/);assert.equal(value(record!,'amount'),'23'); });
      }
      await page.screenshot({path:resolve(out,`${id}.png`),fullPage:true});
      await writeFile(resolve(out,`${id}-record.json`),JSON.stringify(record,null,2));
      dialog='dismiss';await button('New case').click();
      await check(`${id}-cancel-new`, 'cancel new case retains the existing materials',async()=>{ assert.ok(await editor.count()); });
      dialog='accept';await button('New case').click();
      await page.getByRole('heading',{name:'Who is receiving this report?'}).waitFor();
      await check(`${id}-new-case`, 'new case clears facts, drafts and messages',async()=>{assert.equal(await editor.count(),0);assert.equal(await input.inputValue(),'');});
      await page.reload();await page.getByRole('heading',{name:'Who is receiving this report?'}).waitFor();
    } catch(error) {
      checks.push({id:`${id}-workflow`,label:'complete independent UI workflow',status:'failed',error:String(error)});
      await page.screenshot({path:resolve(out,`${id}-failure.png`),fullPage:true});
    } finally { await context.close(); }
  }
  // Check the real unconfigured service path independently of the fake-model server.
  const unconfigured=createApp({settingsStore:new ModelSettingsStore({config:readConfig({}),persist:()=>{}}),fetchImpl:async()=>{throw new Error('Unexpected provider call');}}).listen(0,'127.0.0.1');
  await once(unconfigured,'listening');const a=unconfigured.address();assert.ok(a&&typeof a!=='string');
  try {
    const r=await fetch(`http://127.0.0.1:${a.port}/api/course/turn`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({case:createCourseCase('telecom'),userText:'A fictional test report.',purpose:'message',replaceExisting:false,retryMessageId:null})});
    const b=await r.json();await check('ENV-01','unconfigured real course service returns safe 503 with no model call',()=>{assert.equal(r.status,503);assert.equal(b.error.code,'COURSE_LIVE_REQUIRED');assert.equal('case'in b,false);});
  } finally {unconfigured.closeAllConnections();await new Promise<void>(done=>unconfigured.close(()=>done()));}
  await check('UI-ERRORS','no uncaught browser errors',()=>assert.deepEqual(errors,[]));
} finally {
  const failures=checks.filter(c=>c.status==='failed');
  await writeFile(resolve(out,'result.json'),JSON.stringify({mode:'fake-provider through real runCourseTurn/HTTP and browser; NOT real-model semantic acceptance',cases:cases.length,roles:['bank','telecom'],checks,passed:checks.length-failures.length,failed:failures.length,errors,providerCalls,externalProviderCalls:0,liveStatus:'not executed: no local model configuration',browser:browser?.version()},null,2));
  await writeFile(resolve(out,'requests.json'),JSON.stringify(requests,null,2));
  await browser?.close();server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));
}
console.log(JSON.stringify({passed:checks.filter(c=>c.status==='passed').length,failed:checks.filter(c=>c.status==='failed').length,out},null,2));
if(checks.some(c=>c.status==='failed')) process.exitCode=1;
