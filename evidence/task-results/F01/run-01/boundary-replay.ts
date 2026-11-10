/** Minimal independent boundary reproductions through the real HTTP/model adapter. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, writeFile, access } from 'node:fs/promises';
import { createApp } from '../../../../server/src/app';
import { readConfig } from '../../../../server/src/config';
import { ModelSettingsStore } from '../../../../server/src/model-settings';
import type { CourseCase, TurnProposal } from '../../../../shared/course-case';
const dir='evidence/task-results/F01/run-01';
const resultPath=process.argv[2] ?? `${dir}/boundary-replay-result.json`;
assert.ok(resultPath.startsWith('evidence/task-results/F01/'));
await assert.rejects(access(resultPath), {code:'ENOENT'});
let calls=0, active: any;
const proposal=():TurnProposal=>({understoodAs:'other',reply:'Materials for review.',factChanges:[],questionUpdates:[],proposedQuestions:[],types:null,attention:null,recommendations:null,materials:{summaryNarrative:'The recorded facts need human review.',personWhatHappened:'You reported a concern.',personNextSteps:['You can review the record with a human.'],personSupport:null,handoverReason:null,handoverRequest:null,handoverGuidelineId:null}});
const fetchImpl:typeof fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(active)}}]}),{headers:{'Content-Type':'application/json'}});};
const server=createApp({settingsStore:new ModelSettingsStore({config:readConfig({MODEL_MODE:'live',MODEL_BASE_URL:'https://replay.invalid/v1',MODEL_NAME:'fake-provider',MODEL_API_KEY:'synthetic-placeholder'}),persist:()=>{}}),fetchImpl}).listen(0,'127.0.0.1');
await once(server,'listening');const address=server.address();assert.ok(address&&typeof address!=='string');
const results:any[]=[];
const record=async(id:string):Promise<CourseCase>=>JSON.parse(await readFile(`${dir}/new-suite-attempt-01/${id}-record.json`,'utf8'));
async function run(id:string, label:string, r:CourseCase, p:any, text:string,purpose:'message'|'generate',replaceExisting:boolean, validate:(status:number,body:any,before:number)=>void){
 active=p;const before=calls;
 const response=await fetch(`http://127.0.0.1:${address.port}/api/course/turn`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({case:r,userText:text,purpose,replaceExisting,retryMessageId:null})});
 const body=await response.json();
 try{validate(response.status,body,before);results.push({id,label,status:'passed',http:response.status});}
 catch(error){results.push({id,label,status:'failed',http:response.status,error:String(error),actual:body});}
}
try{
 for(const id of ['N03-telecom','N06-telecom']){
  const r=await record(id);r.materials={status:'not-generated',employeeEdited:false,summary:'',personExplanation:'',handover:null};
  await run(id+'-null-handover','model explicitly returns null for all handover sentences and reference; no unsupported recipient draft',r,proposal(),'Generate materials','generate',false,(status,body)=>{assert.equal(status,200);assert.equal(body.case.materials.handover,null);});
 }
 for(const role of ['bank','telecom']){
  const r=await record('N02-'+role), p=proposal();p.materials=null;p.understoodAs='supplement';p.factChanges=[{key:'amount',value:'86',certainty:'stated',evidence:'86'}];
  await run(role+'-old-amount','old model amount cannot replace employee-edited 23',r,p,'The original report mentioned 86 again.','message',false,(status,body)=>{assert.equal(status,200);const f=body.case.facts.find((x:any)=>x.key==='amount');assert.equal(f.value,'23');assert.equal(f.pendingConflict.value,'86');assert.equal(body.case.materials.status,'needs-update');});
  await run(role+'-unconfirmed-replace','unconfirmed material replacement is blocked before provider call',r,proposal(),'Generate materials','generate',false,(status,body,before)=>{assert.equal(status,409);assert.equal(body.error.code,'MATERIALS_REPLACE_REQUIRED');assert.equal(calls,before);});
  const bad=proposal();bad.materials=null;bad.understoodAs='supplement';bad.factChanges=[{key:'amount',value:'999',certainty:'stated',evidence:'a source that was never reported'}];
  await run(role+'-bad-source','fabricated source evidence rejects whole model proposal',r,bad,'There is no new amount.','message',false,(status,body)=>{assert.equal(status,502);assert.equal(body.error.code,'MODEL_INVALID_OUTPUT');assert.equal('case'in body,false);});
  const tooMany:any=proposal();tooMany.materials=null;tooMany.understoodAs='supplement';tooMany.proposedQuestions=[1,2,3,4].map(n=>({id:'Q'+n,text:'Question?',purpose:'Check',relatedKeys:['amount']}));
  await run(role+'-four-questions','out-of-contract fourth question rejects proposal',r,tooMany,'A further question.','message',false,(status,body)=>{assert.equal(status,502);assert.equal(body.error.code,'MODEL_INVALID_OUTPUT');});
 }
}finally{
 server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));
 await writeFile(resultPath,JSON.stringify({mode:'fake-provider through real HTTP and runCourseTurn',results,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,providerCalls:calls,externalProviderCalls:0},null,2));
}
console.log(JSON.stringify({passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length}));
if(results.some(r=>r.status==='failed'))process.exitCode=1;
