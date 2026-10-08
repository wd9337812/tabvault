import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { boot,root,app } from './test-harness.mjs';
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const tab=url=>({url,title:url,pinned:false,fav:''});
const session=(id,auto=false,age=0)=>({id,name:id,auto,createdAt:Date.now()-age*864e5,tabs:[tab('https://example.com/'+id)]});
const task=id=>({id,title:id,listId:'inbox',tags:[],done:false});
test('Serialized concurrent saves retain both records',async()=>{
 const e=await boot();
 const r=await Promise.all(app==='tabtasks'?[e.request('ADD',{title:'A'}),e.request('ADD',{title:'B'})]:[e.request('SAVE_WINDOW'),e.request('SAVE_WINDOW')]);
 assert(r.every(x=>x.ok));assert.equal((e.data.tasks||e.data.tv_sessions).length,2);
});
test('Queue continues after a failed write and preserves existing records',async()=>{
 const e=await boot();e.failNextSet=true;assert.equal((await e.request(app==='tabtasks'?'ADD':'SAVE_WINDOW',{title:'A'})).ok,false);
 assert.equal((await e.request(app==='tabtasks'?'ADD':'SAVE_WINDOW',{title:'B'})).ok,true);assert.equal((e.data.tasks||e.data.tv_sessions).length,1);
});
test('License activation and release return consistent plan',async()=>{
 const e=await boot();assert.equal((await e.activate()).state.plan,'pro');assert.equal((await e.request('LICENSE_RELEASE')).state.plan,'free');assert.equal((await e.request('READ')).state.plan,'free');
});
test('Expired licenses do not grant Pro',async()=>{
 const e=await boot();assert.equal((await e.request('LICENSE_SET',{key:await e.proKey(Math.floor(Date.now()/1000)-1)})).ok,false);
});
test('Invalid import is rejected before any write',async()=>{
 const e=await boot();await e.activate();const before=JSON.stringify(e.data);
 const data=app==='tabtasks'?{lists:[],tasks:[{...task('bad'),tags:{}}]}:{sessions:[{id:'bad',name:'Bad',createdAt:Date.now()}]};
 assert.equal((await e.request('IMPORT',{data})).ok,false);assert.equal(JSON.stringify(e.data),before);
});
test('Valid old-format backup imports once and remains usable',async()=>{
 const e=await boot();await e.activate();const data=app==='tabtasks'?{lists:[{id:'inbox',name:'Inbox',color:'#6d5efc'}],tasks:[task('old')]}:{sessions:[session('old',false,365)]};
 assert.equal((await e.request('IMPORT',{data})).ok,true);assert.equal((await e.request('IMPORT',{data})).ok,true);assert.equal((e.data.tasks||e.data.tv_sessions).length,1);
});
test('Corrupt legacy records are retained in recovery backup before mutations',async()=>{
 const e=await boot(app==='tabtasks'?{tasks:[{...task('bad'),tags:{}}]}:{tv_sessions:[{id:'bad'}]});
 const r=await e.request(app==='tabtasks'?'ADD':'SAVE_WINDOW',{title:'Good'});assert.equal(r.ok,true);assert(e.data[app==='tabtasks'?'tt_recovery_backup_v1':'tv_recovery_backup_v1']);
});
test('Unsafe imported URLs cannot become links',async()=>{
 const e=await boot();await e.activate();const data=app==='tabtasks'?{lists:[],tasks:[{...task('unsafe'),url:'javascript:alert(1)'}]}:{sessions:[{...session('unsafe'),tabs:[tab('javascript:alert(1)')]}]};
 assert.equal((await e.request('IMPORT',{data})).ok,false);
});
test('Favicons are limited to the saved page origin',async()=>{
 const e=await boot();
 const normalize=vm.runInContext('Data.tab',e.context);
 assert.equal(normalize({url:'https://example.com/page',fav:'https://other.example/icon.png'}).fav,'');
 assert.equal(normalize({url:'https://example.com/page',fav:'https://example.com/icon.png'}).fav,'https://example.com/icon.png');
});
if(app==='tabtasks'){
 test('Shortcut captures without an open panel',async()=>{const e=await boot();await e.chrome.commands.onCommand.emit('capture-page',e.tabs[0]);assert.equal(e.data.tasks.length,1);assert.equal(e.data.tasks[0].url,e.tabs[0].url)});
 test('Concurrent menu selections save both without a panel',async()=>{const e=await boot();await Promise.all([e.request('SELECTION',{title:'A',excerpt:'A'}),e.request('SELECTION',{title:'B',excerpt:'B'})]);assert.equal(e.data.tasks.length,2)});
 test('All capture routes respect free active-task limit',async()=>{const e=await boot({tasks:Array.from({length:30},(_,i)=>task('t'+i))});assert.equal((await e.request('ADD',{title:'Blocked'})).code,'limit');assert.equal((await e.request('CAPTURE',{tabId:1})).code,'limit');const r=await e.request('SELECTION',{title:'Deferred'});assert(r.deferred);assert.equal(e.data.tasks.length,30);assert.equal(e.data.pendingCaptures.length,1)});
 test('Pending capture survives failure, then is consumed exactly once',async()=>{const e=await boot({pendingCaptures:[{title:'Old capture',url:'https://example.com',at:1}]});e.failNextSet=true;assert.equal((await e.request('READ')).ok,false);assert.equal(e.data.pendingCaptures.length,1);assert.equal((await e.request('READ')).ok,true);await e.request('READ');assert.equal(e.data.tasks.length,1);assert.equal(e.data.pendingCaptures.length,0)});
 test('Removing one task allows a queued selection to be saved',async()=>{const e=await boot({tasks:Array.from({length:30},(_,i)=>task('t'+i)),pendingCaptures:[{title:'Deferred'}]});await e.request('DELETE',{id:'t0'});assert.equal(e.data.tasks.length,30);assert(e.data.tasks.some(t=>t.title==='Deferred'));assert.equal(e.data.pendingCaptures.length,0)});
 test('Independent edits do not overwrite fields from another window',async()=>{const e=await boot({tasks:[task('t')]});await Promise.all([e.request('PATCH',{id:'t',patch:{note:'A'}}),e.request('PATCH',{id:'t',patch:{due:'2026-11-01'}})]);assert.equal(e.data.tasks[0].note,'A');assert.equal(e.data.tasks[0].due,'2026-11-01')});
 test('Concurrent tag additions preserve both tags',async()=>{const e=await boot({tasks:[task('t')]});await e.activate();await Promise.all([e.request('TAG_ADD',{id:'t',tag:'A'}),e.request('TAG_ADD',{id:'t',tag:'B'})]);assert.deepEqual(e.data.tasks[0].tags,['A','B'])});
 test('AI can add/update dates and tags after Pro activation',async()=>{const e=await boot();await e.activate();const a=await e.request('ADD',{title:'Existing'});assert.equal((await e.request('AI_APPLY',{ops:[{op:'update',id:a.task.id,due:'2026-11-01',tags:['tag'],note:'note'},{op:'add',title:'New'}]})).ok,true);assert.equal(e.data.tasks.length,2);assert.equal(e.data.tasks.find(t=>t.id===a.task.id).due,'2026-11-01')});
 test('Invalid AI batch is atomic and cannot execute after deactivation',async()=>{const e=await boot();await e.activate();assert.equal((await e.request('AI_APPLY',{ops:[{op:'add',title:'A'},{op:'done',id:'missing'}]})).ok,false);assert.equal(e.data.tasks,undefined);await e.request('LICENSE_RELEASE');assert.equal((await e.request('AI_APPLY',{ops:[{op:'add',title:'A'}]})).code,'pro')});
 test('Child tasks are edited in the background',async()=>{const e=await boot();const a=await e.request('ADD',{title:'Parent'});await e.request('SUB_ADD',{id:a.task.id,title:'Child'});const id=e.data.tasks[0].subtasks[0].id;await e.request('SUB_TOGGLE',{id:a.task.id,subId:id});assert.equal(e.data.tasks[0].subtasks[0].done,true);await e.request('SUB_DELETE',{id:a.task.id,subId:id});assert.equal(e.data.tasks[0].subtasks.length,0)});
}else{
 test('Automatic snapshots preserve 365-day-old manual sessions and retain five hundred versions',async()=>{const e=await boot({tv_sessions:[session('manual',false,365)]});await e.activate();await e.request('SETTINGS',{autoOn:true});for(let i=0;i<501;i++){e.tabs[0].url='https://example.com/v'+i;assert.equal((await e.request('SAVE_WINDOW',{auto:true,windowId:1})).ok,true)}assert(e.data.tv_sessions.some(s=>s.id==='manual'));assert.equal(e.data.tv_sessions.filter(s=>s.auto).length,500)});
 test('Normal writes and language changes do not reset existing alarm',async()=>{const e=await boot();await e.activate();await e.request('SETTINGS',{autoOn:true});await e.drain();const scheduled=e.alarms.get('tv-autosave').scheduledTime;const n=e.createAlarmCount;e.clock=300000;await e.request('SAVE_WINDOW');await e.request('SETTINGS',{langPref:'zh'});await e.drain();assert.equal(e.createAlarmCount,n);assert.equal(e.alarms.get('tv-autosave').scheduledTime,scheduled)});
 test('Free shortcut obeys ten-session cap',async()=>{const e=await boot({tv_sessions:Array.from({length:10},(_,i)=>session('m'+i))});await e.chrome.commands.onCommand.emit('save-session',e.tabs[0]);assert.equal(e.data.tv_sessions.length,10);assert.equal((await e.request('PASTE',{tabs:[tab('https://example.com')]})).code,'limit')});
 test('Releasing license clears alarm and disables automatic backups',async()=>{const e=await boot();await e.activate();await e.request('SETTINGS',{autoOn:true});await e.drain();assert(e.alarms.has('tv-autosave'));await e.request('LICENSE_RELEASE');await e.drain();assert.equal(e.alarms.has('tv-autosave'),false);assert.equal((await e.request('SAVE_WINDOW',{auto:true})).ok,false)});
 test('Save and close does not close tabs if storage fails',async()=>{const e=await boot();e.tabs.push({...e.tabs[0],id:2,url:'https://example.com/second'});e.failNextSet=true;assert.equal((await e.request('SAVE_WINDOW',{andClose:true})).ok,false);assert.equal(e.removed.length,0)});
 test('Repeated URLs and pinned tabs survive save and restore',async()=>{const e=await boot();e.tabs=[{id:1,windowId:1,url:'https://example.com/same',title:'One',pinned:true},{id:2,windowId:1,url:'https://example.com/same',title:'Two',pinned:false}];const r=await e.request('SAVE_WINDOW');assert.equal(r.session.tabs.length,2);await e.request('RESTORE',{id:r.session.id,here:true,windowId:1});assert.equal(e.created.length,2);assert.equal(e.created[0].pinned,true);assert.equal(e.created[1].pinned,false)});
 test('Partial restore keeps session even with delete-after-restore enabled',async()=>{const e=await boot({tv_sessions:[{...session('s'),tabs:[tab('https://example.com/1'),tab('https://example.com/2')]}]});await e.request('SETTINGS',{delAfterRestore:true});e.failCreateAt=1;assert.equal((await e.request('RESTORE',{id:'s',here:true,windowId:1})).code,'restore');assert.equal(e.data.tv_sessions.length,1)});
 test('Automatic backup distinguishes tab order and pinned state',async()=>{const e=await boot();await e.activate();await e.request('SETTINGS',{autoOn:true});await e.request('SAVE_WINDOW',{auto:true,windowId:1});e.tabs[0].pinned=true;await e.request('SAVE_WINDOW',{auto:true,windowId:1});assert.equal(e.data.tv_sessions.filter(s=>s.auto).length,2)});
 test('Closing a backed-up window provides a recovery target',async()=>{const e=await boot();await e.activate();await e.request('SETTINGS',{autoOn:true});await e.chrome.windows.onRemoved.emit(1);await e.drain();assert(e.data.tv_startup_hint.target);assert(e.data.tv_sessions.some(s=>s.id===e.data.tv_startup_hint.target))});
}
test('Worker rejects other products, test orders, unpaid orders and accepts own live order',async()=>{
 const src=fs.readFileSync(path.join(root,'worker/index.js'),'utf8');
 const sid='cs_live_regression123',url='https://buy.stripe.com/OWN';let payment={object:'checkout.session',id:sid,status:'complete',mode:'payment',payment_status:'paid',livemode:true,payment_link:'plink_OWN'};let link={object:'payment_link',id:'plink_OWN',url};
 const ctx=vm.createContext({crypto:webcrypto,TextEncoder,btoa,URL,Response,AbortSignal,fetch:async u=>({ok:true,json:async()=>u.includes('/payment_links/')?link:payment})});
 const worker=vm.runInContext(src.replace('export async function computeKey','async function computeKey').replace('export default {','globalThis.worker = {')+'\nworker',ctx);
 const env={LIC_SECRET:'regression-secret',STRIPE_SECRET_KEY:'mock',STRIPE_PAYMENT_LINK:url};
 async function issue(){const r=await worker.fetch(new Request('https://example.com/success?sid='+sid),env);return{status:r.status,html:await r.text()}}
 const invalid=await worker.fetch(new Request('https://example.com/success?sid=invalid'),env);assert.equal(invalid.status,400);assert.equal(invalid.headers.get('cache-control'),'no-store');
 assert.equal((await issue()).status,200);link.url='https://buy.stripe.com/OTHER';assert.equal((await issue()).status,400);link.url=url;payment.livemode=false;assert.equal((await issue()).status,400);payment.livemode=true;payment.payment_status='unpaid';assert.equal((await issue()).status,400);
});

test('English first-run default ignores browser language',async()=>{const e=await boot();vm.runInContext("navigator.language='zh-CN'",e.context);const r=await e.request('READ');assert.equal(app==='tabtasks'?r.state.ui.langPref:r.state.settings.langPref,'en')});
test('Language/theme preferences persist without changing user records',async()=>{const data=app==='tabtasks'?{tasks:[task('old')]}:{tv_sessions:[session('old')]};const e=await boot(data);const before=JSON.stringify(e.data[app==='tabtasks'?'tasks':'tv_sessions']);const r=await e.request(app==='tabtasks'?'UI_PREFS':'SETTINGS',{langPref:'zh',themePref:'dark'});assert(r.ok);const again=await e.request('READ');const prefs=app==='tabtasks'?again.state.ui:again.state.settings;assert.equal(prefs.langPref,'zh');assert.equal(prefs.themePref,'dark');assert.equal(JSON.stringify(e.data[app==='tabtasks'?'tasks':'tv_sessions']),before)});
test('Invalid language preferences are rejected without mutation',async()=>{const e=await boot();const before=JSON.stringify(e.data);assert.equal((await e.request(app==='tabtasks'?'UI_PREFS':'SETTINGS',{langPref:'invalid'})).ok,false);assert.equal(JSON.stringify(e.data),before)});
test('An explicitly chosen Chinese preference survives upgrading',async()=>{const e=await boot(app==='tabtasks'?{tt_ui:{langPref:'zh',themePref:'dark'}}:{tv_settings:{langPref:'zh',themePref:'dark',langResolved:'zh'}});const r=await e.request('READ');assert.equal(app==='tabtasks'?r.state.ui.langPref:r.state.settings.langPref,'zh')});
test('Both UI locales contain the same complete set of strings',async()=>{const {strings,translator}=await import('../ui/src/strings.js');for(const[key,values]of Object.entries(strings)){assert.equal(values.length,2,key);assert(values.every(value=>typeof value==='string'&&value.trim()),key);assert.equal(translator('en')(key),values[0]);assert.equal(translator('zh')(key),values[1])}});

let failed=0;for(const[name,fn]of tests){try{await fn();console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack)}}
console.log(`${app}: ${tests.length-failed}/${tests.length} passed`);process.exitCode=failed?1:0;
