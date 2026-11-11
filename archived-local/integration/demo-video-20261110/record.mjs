import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport:{width:1600,height:800},recordVideo:{dir:out,size:{width:1600,height:800}},acceptDownloads:true});
const page = await context.newPage();
const started = Date.now();
const marks = [];
async function mark(name) { marks.push({name,time:(Date.now()-started)/1000}); await fs.writeFile(path.join(out,'marks.json'),JSON.stringify(marks,null,2)); console.log(name,marks.at(-1).time); }
async function pause(seconds=2) { await page.waitForTimeout(seconds*1000); }
async function turn(button) {
  const response = page.waitForResponse(r=>r.url().includes('/api/course/turn') && r.request().method()==='POST',{timeout:150000});
  await button.click();
  const r = await response;
  const body = await r.json();
  await fs.writeFile(path.join(out,`turn-${marks.length}.json`),JSON.stringify(body,null,2));
  if(!r.ok()) throw new Error(JSON.stringify(body));
  await page.getByRole('button',{name:'Processing…',exact:true}).waitFor({state:'hidden',timeout:10000});
}
try {
  await page.goto('http://127.0.0.1:5173/?view=course');
  await page.getByRole('button',{name:'Bank employee',exact:true}).waitFor();
  await mark('intro'); await pause(3);
  await page.getByRole('button',{name:'Bank employee',exact:true}).click();
  await page.getByLabel('Explore a fictional case').selectOption('sms-phishing');
  await page.getByRole('button',{name:'Load example',exact:true}).click();
  await mark('input'); await pause(5);
  await mark('analysis-start');
  await turn(page.getByRole('button',{name:'Analyze case',exact:true}));
  await mark('analysis-result');
  await page.screenshot({path:path.join(out,'analysis.png')});
  await pause(4);
  await page.getByText('Candidate type',{exact:true}).scrollIntoViewIfNeeded();
  await mark('type'); await pause(4);
  await page.getByRole('textbox',{name:'Transaction status',exact:true}).scrollIntoViewIfNeeded();
  await mark('unknown'); await pause(4);
  const question = page.getByRole('group',{name:'Current question',exact:true});
  if(await question.count()) {
    await fs.writeFile(path.join(out,'question.txt'),await question.innerText());
    await mark('question'); await pause(3);
    await page.getByRole('button',{name:"Don't know",exact:true}).click();
    await mark('question-unknown'); await pause(3);
    if(await page.getByRole('button',{name:'End questions',exact:true}).count()) await page.getByRole('button',{name:'End questions',exact:true}).click();
  }
  await page.getByRole('button',{name:'View guidance',exact:true}).click();
  await mark('guidance'); await pause(6);
  await page.screenshot({path:path.join(out,'guidance.png')});
  await mark('generate-start');
  await turn(page.getByRole('button',{name:'Generate materials',exact:true}));
  await mark('summary'); await pause(4);
  await page.screenshot({path:path.join(out,'summary.png')});
  await page.getByRole('button',{name:'For the person',exact:true}).click();
  await mark('person'); await pause(4);
  const handover = page.getByRole('button',{name:'Handover draft',exact:true});
  if(await handover.count()) { await handover.click(); await mark('handover'); await pause(4); }
  await page.getByRole('button',{name:'Case summary',exact:true}).click();
  const material = page.getByRole('textbox',{name:'Current material text',exact:true});
  const text = await material.inputValue();
  await material.fill(text+'\n\nEmployee review note: Transaction status requires follow-up.');
  await material.press('Control+End');
  await mark('edit'); await pause(4);
  await page.getByRole('button',{name:'Confirm materials',exact:true}).click();
  await mark('confirm'); await pause(3);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button',{name:'Download Markdown',exact:true}).click();
  await (await downloading).saveAs(path.join(out,'scamsafe-summary.md'));
  await mark('download'); await pause(5);
  await page.screenshot({path:path.join(out,'final.png')});
  await mark('end');
} finally {
  const video = page.video();
  await context.close();
  if(video) await video.saveAs(path.join(out,'raw.webm'));
  await browser.close();
}
