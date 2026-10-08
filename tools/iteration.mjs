import assert from 'node:assert/strict';
import vm from 'node:vm';
import {boot,app} from './test-harness.mjs';
const checks=[];
async function test(name,fn){await fn();checks.push(name);console.log('PASS '+name)}
await test('Automatic activation persists a private pending capability and verifies the returned license',async()=>{
 const env=await boot(),purchase=await env.request('BILLING_START',{lang:'zh'});assert(purchase.ok);const url=new URL(purchase.checkoutUrl);assert.match(url.searchParams.get('claim'),/^[a-f0-9]{64}$/);assert.equal(url.searchParams.get('lang'),'zh');
 const key=await env.proKey();env.fetch=async url=>{assert(url.includes('/api/activation?token='));return Response.json({status:'pending'})};assert.equal((await env.request('BILLING_CHECK')).billingStatus,'waiting');assert.equal((await env.request('READ')).state.plan,'free');
 env.fetch=async()=>Response.json({status:'paid',key,sid:'cs_live_mock123456'});assert.equal((await env.request('BILLING_CHECK')).state.plan,'pro');assert.equal(env.data[app==='tabtasks'?'tt_billing':'tv_billing'].pending,null);
});
await test('Forged callback, invalid license and storage failure cannot grant or lose a purchase',async()=>{
 const env=await boot();await env.request('BILLING_START');env.fetch=async()=>Response.json({status:'paid',key:'invalid',sid:'cs_live_mock123456'});assert.equal((await env.request('BILLING_CHECK')).ok,false);assert.equal((await env.request('READ')).state.plan,'free');assert(env.data[app==='tabtasks'?'tt_billing':'tv_billing'].pending);
 assert.equal((await env.request('BILLING_CHECK',{token:'0'.repeat(64)})).ok,false);const key=await env.proKey();env.fetch=async()=>Response.json({status:'paid',key,sid:'cs_live_mock123456'});env.failNextSet=true;assert.equal((await env.request('BILLING_CHECK')).ok,false);assert(env.data[app==='tabtasks'?'tt_billing':'tv_billing'].pending);assert.equal((await env.request('BILLING_CHECK')).state.plan,'pro');
});
await test('External notifications are accepted only from the product success page and matching installation',async()=>{
 const env=await boot();await env.request('BILLING_START');const listener=env.chrome.runtime.onMessageExternal.listeners[0];let replies=0;const body={type:'BILLING_COMPLETE',token:'0'.repeat(64)};
 assert.equal(listener(body,{url:'https://evil.example/success'},()=>replies++),undefined);assert.equal(listener(body,{url:new URL(vm.runInContext('CONFIG.STRIPE_PAYMENT_LINK',env.context)).origin+'/admin'},()=>replies++),undefined);assert.equal(replies,0);
});
if(app==='tabtasks'){
 const {normalizeAiConfig,aiRequest,aiResponseText,requestAi}=await import('../ui/src/ai-client.js');
 await test('Both AI protocols use the configured endpoint and their own message format',async()=>{
  const open=normalizeAiConfig({provider:'custom',protocol:'openai',baseUrl:'https://gateway.example/v1/',model:'custom-model',key:'vendor-key'}),request=aiRequest(open,'System','Task');assert.equal(request.endpoint,'https://gateway.example/v1/chat/completions');assert.equal(request.headers.Authorization,'Bearer vendor-key');assert.equal(request.body.messages[0].role,'system');assert.equal(request.body.response_format,undefined);
  const anthropic=aiRequest(normalizeAiConfig({provider:'anthropic',key:'vendor-key'}),'System','Task');assert.equal(anthropic.body.system,'System');assert.equal(anthropic.headers['x-api-key'],'vendor-key');assert(anthropic.endpoint.endsWith('/messages'));assert.equal(aiResponseText({content:[{type:'thinking',thinking:'hidden'},{type:'text',text:'{"ops":[]}'},{type:'text',text:' '}],stop_reason:'end_turn'},'anthropic'),' {"ops":[]} '.trimStart());
 });
 await test('Provider credentials cannot be embedded in URLs or redirected to another host',async()=>{
  for(const baseUrl of ['http://remote.example/v1','https://user:pass@api.example/v1','https://api.example/v1?key=secret','javascript:alert(1)'])assert.throws(()=>normalizeAiConfig({provider:'custom',baseUrl,model:'model'}));assert.equal(normalizeAiConfig({provider:'custom',baseUrl:'http://localhost:11434/v1',model:'local'}).key,'');
  const original=globalThis.fetch;try{globalThis.fetch=async(url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');return Response.json({choices:[{finish_reason:'stop',message:{content:'OK'}}]})};assert.equal(await requestAi(normalizeAiConfig({key:'test'}),'System','Prompt'),'OK')}finally{globalThis.fetch=original}
 });
 await test('Incomplete or refused AI responses cannot become task edits',async()=>{assert.throws(()=>aiResponseText({stop_reason:'max_tokens',content:[{type:'text',text:'{}'}]},'anthropic'));assert.throws(()=>aiResponseText({choices:[{finish_reason:'length',message:{content:'{}'}}]},'openai'));assert.throws(()=>aiResponseText({choices:[{message:{refusal:'No'}}]},'openai'))});
}else{
 const tab=(url,group)=>({url,title:url,...(group?{group}:{} )}),saved=(id,extras={})=>({id,name:id,createdAt:Date.now(),auto:false,tabs:[tab('https://example.com/'+id)],...extras});
 await test('Free backups, ten-session cap and rolling snapshots retain existing records',async()=>{
  const env=await boot();assert((await env.request('IMPORT',{data:{sessions:[saved('old')]}})).ok);await env.request('SETTINGS',{autoOn:true});for(let index=0;index<5;index++){env.tabs[0].url='https://example.com/'+index;assert((await env.request('SAVE_WINDOW',{auto:true,windowId:1})).ok)}assert.equal(env.data.tv_sessions.filter(session=>session.auto).length,3);assert(env.data.tv_sessions.some(session=>session.id==='old'));assert.equal((await env.request('PROJECT_ADD',{name:'Free project'})).code,'pro');
 });
 await test('Project edits, notes and batch moves are atomic and survive JSON normalization',async()=>{
  const env=await boot();await env.activate();const project=(await env.request('PROJECT_ADD',{name:'Research',color:'#11836e'})).project;const saved=(await env.request('SAVE_WINDOW',{projectId:project.id})).session;
  assert((await env.request('SESSION_PATCH',{id:saved.id,note:'Context',tags:['tag'],pinned:true})).ok);const state=(await env.request('READ')).state;assert.equal(state.sessions[0].note,'Context');assert.equal(state.sessions[0].tags[0],'tag');assert.equal(state.sessions[0].pinned,true);const before=JSON.stringify(env.data);assert.equal((await env.request('BULK_MOVE',{ids:[saved.id,'missing'],projectId:''})).ok,false);assert.equal(JSON.stringify(env.data),before);await env.request('PROJECT_DELETE',{id:project.id});assert.equal(env.data.tv_sessions[0].projectId,'');assert.equal(env.data.tv_sessions.length,1);
 });
 await test('Selective, skipped and partial restores never delete the original saved session',async()=>{
  const env=await boot({tv_sessions:[saved('s',{tabs:[tab('https://example.com/start'),tab('https://example.com/two'),tab('https://example.com/two')]})]});await env.activate();await env.request('SETTINGS',{delAfterRestore:true});assert.equal((await env.request('RESTORE',{id:'s',here:true,windowId:1,indices:[1]})).restored,1);assert.equal(env.data.tv_sessions.length,1);const restored=await env.request('RESTORE',{id:'s',here:true,windowId:1,skipDuplicates:true});assert.equal(restored.restored,0);assert.equal(restored.skipped,3);assert.equal(env.data.tv_sessions.length,1);assert.equal((await env.request('RESTORE',{id:'s',here:true,windowId:1,indices:[999]})).ok,false);
 });
 await test('Group metadata survives saving and restores group names, colors and collapse state',async()=>{
  const env=await boot();await env.activate();env.tabs[0].groupId=7;env.tabGroupInfo={7:{title:'Research',color:'purple',collapsed:true}};const session=(await env.request('SAVE_WINDOW')).session;assert.equal(session.tabs[0].group.title,'Research');assert.equal((await env.request('RESTORE',{id:session.id,here:true,windowId:1,preserveGroups:true})).ok,true);assert.equal(env.updatedGroups[0].color,'purple');assert.equal(env.updatedGroups[0].collapsed,true);
 });
 await test('Project restore opens separate windows and merges preserve their original sessions',async()=>{
  const env=await boot();await env.activate();const project=(await env.request('PROJECT_ADD',{name:'Research'})).project;await env.request('IMPORT',{data:{sessions:[saved('one',{projectId:project.id}),saved('two',{projectId:project.id})]}});await env.request('SETTINGS',{delAfterRestore:true});const opened=await env.request('RESTORE_PROJECT',{id:project.id});assert.equal(opened.windows,2);assert.equal(new Set(env.created.map(tab=>tab.windowId)).size,2);assert.equal(env.data.tv_sessions.length,2);assert((await env.request('MERGE',{ids:['one','two'],projectId:project.id})).ok);assert.equal(env.data.tv_sessions.length,3);
 });
 await test('Thirty-day retention removes only old automatic snapshots',async()=>{
  const old=Date.now()-31*864e5,env=await boot({tv_sessions:[saved('manual',{createdAt:old}),saved('auto',{createdAt:old,auto:true})]});await env.activate();await env.request('SETTINGS',{autoOn:true});await env.request('SAVE_WINDOW',{auto:true,windowId:1});assert(env.data.tv_sessions.some(session=>session.id==='manual'));assert(!env.data.tv_sessions.some(session=>session.id==='auto'));
 });
 await test('Downgraded users can restore complete backups and continue reading over-quota records',async()=>{
  const env=await boot(),projects=[{id:'research',name:'Research',color:'#11836e'}];const result=await env.request('IMPORT',{data:{projects,sessions:Array.from({length:12},(_,index)=>saved('old'+index,{projectId:'research'}))}});assert(result.ok);assert.equal(result.state.sessions.length,12);assert.equal((await env.request('SAVE_WINDOW')).code,'limit');assert.equal((await env.request('RESTORE',{id:'old0',here:true,windowId:1})).ok,true);
 });
}

await test('Expired purchase claims offer a new checkout without losing saved content',async()=>{
 const env=await boot();await env.request('BILLING_START');env.fetch=async()=>Response.json({code:'claim_expired'},{status:410});const result=await env.request('BILLING_CHECK');assert(result.ok);assert.equal(result.billingStatus,'expired');assert.equal(result.state.plan,'free');assert(env.data[app==='tabtasks'?'tt_billing':'tv_billing'].pending);await env.request('BILLING_RESET');assert.equal(env.data[app==='tabtasks'?'tt_billing':'tv_billing'].pending,null);
});
await test('Verified success notification activates only its matching pending purchase',async()=>{
 const env=await boot();const started=await env.request('BILLING_START'),token=new URL(started.checkoutUrl).searchParams.get('claim'),key=await env.proKey();env.fetch=async()=>Response.json({status:'paid',key});const listener=env.chrome.runtime.onMessageExternal.listeners[0];const result=await new Promise(resolve=>listener({type:'BILLING_COMPLETE',token},{url:new URL(started.checkoutUrl).origin+'/success?sid=cs_live_fixture123'},resolve));assert(result.ok);assert.equal(result.state.plan,'pro');
});
await test('An oversized automatic snapshot leaves manual sessions and previous history intact',async()=>{
 const env=await boot({tv_sessions:[{id:'old',name:'Manual',createdAt:Date.now(),tabs:[{url:'https://example.com/old',title:'Old'}]}]});await env.request('SETTINGS',{autoOn:true});const before=JSON.stringify(env.data.tv_sessions);vm.runInContext('CONFIG.MAX_AUTO_BYTES=100',env.context);const result=await env.request('SAVE_WINDOW',{auto:true,windowId:1});assert.equal(result.ok,false);assert.equal(result.message,'snapshotTooLarge');assert.equal(JSON.stringify(env.data.tv_sessions),before);
});
await test('Unchanged windows still roll expired history off at the thirty-day boundary',async()=>{
 const env=await boot();await env.activate();await env.request('SETTINGS',{autoOn:true});const first=await env.request('SAVE_WINDOW',{auto:true,windowId:1});env.data.tv_sessions[0].createdAt=Date.now()-31*864e5;const result=await env.request('SAVE_WINDOW',{auto:true,windowId:1});assert(result.ok);assert.notEqual(result.session.id,first.session.id);assert.equal(env.data.tv_sessions.filter(session=>session.auto).length,1);assert(env.data.tv_sessions[0].createdAt>Date.now()-10000);
});
console.log(`${app} iteration: ${checks.length}/${checks.length} passed`);
