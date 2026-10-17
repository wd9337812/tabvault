import assert from 'node:assert/strict';
import {boot} from './test-harness.mjs';
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const tab=(url,extra={})=>({url,title:url,pinned:false,...extra});
const session=(id,urls,extra={})=>({id,name:id,createdAt:Date.now(),auto:false,tabs:urls.map(url=>typeof url==='string'?tab(url):url),...extra});
const A='https://example.com/a',B='https://example.com/b',C='https://example.com/c';
test('Free creation permits thirty manual sessions and three projects, snapshots remain separate',async()=>{
 const e=await boot();for(let i=0;i<3;i++)assert((await e.request('PROJECT_ADD',{name:'Project '+i})).ok);assert.equal((await e.request('PROJECT_ADD',{name:'Fourth'})).code,'limit');for(let i=0;i<30;i++)assert((await e.request('SAVE_WINDOW',{windowId:1})).ok);assert.equal((await e.request('SAVE_WINDOW',{windowId:1})).code,'limit');assert((await e.request('SETTINGS',{autoOn:true})).ok);assert((await e.request('SAVE_WINDOW',{auto:true,windowId:1})).ok);assert.equal(e.data.tv_sessions.filter(x=>!x.auto).length,30);
});
test('Free notes, tags, pins, groups and duplicate skipping work without Pro',async()=>{
 const group={id:'g',title:'Research',color:'blue',collapsed:false},e=await boot({tv_sessions:[session('one',[tab(A,{group}),tab(B,{pinned:true})])]});const project=await e.request('PROJECT_ADD',{name:'Research'});assert((await e.request('SESSION_PATCH',{id:'one',note:'Note',tags:['ref'],pinned:true,projectId:project.project.id})).ok);e.tabs=[];assert((await e.request('RESTORE',{id:'one',here:true,windowId:1,preserveGroups:true,skipDuplicates:true})).ok);assert.equal(e.created.length,2);assert.equal(e.groups.length,1);assert(e.data.tv_sessions.some(x=>x.id==='one'));
});
test('Free snapshots use time, count and bytes; expired snapshots never remove manual records',async()=>{
 const e=await boot({tv_sessions:[session('manual',[A],{createdAt:1}),session('expired',[B],{auto:true,createdAt:Date.now()-2*864e5})]});await e.request('SETTINGS',{autoOn:true});for(let i=0;i<52;i++){e.tabs[0].url='https://example.com/'+i;assert((await e.request('SAVE_WINDOW',{auto:true,windowId:1})).ok)}assert.equal(e.data.tv_sessions.filter(x=>x.auto).length,50);assert(!e.data.tv_sessions.some(x=>x.id==='expired'));assert(e.data.tv_sessions.some(x=>x.id==='manual'));
});
test('Difference preview reports missing, added and group changes without writing',async()=>{
 const e=await boot({tv_sessions:[session('past',[A,tab(B,{pinned:true})])]});e.tabs=[{id:1,windowId:1,url:B,title:B,pinned:false},{id:2,windowId:1,url:C,title:C,pinned:false}];const before=JSON.stringify(e.data),r=await e.request('DIFF_PREVIEW',{id:'past',windowId:1});assert(r.ok);assert.equal(r.missing.length,1);assert.equal(r.missing[0].tab.url,A);assert.equal(r.added.length,1);assert.equal(r.changed.length,1);assert.equal(JSON.stringify(e.data),before);assert.equal((await e.request('DIFF_RESTORE',{id:'past',windowId:1,indices:[0],revision:r.revision})).code,'pro');
});
test('Difference recovery recomputes open pages and preserves saved sources',async()=>{
 const e=await boot({tv_sessions:[session('past',[A,B])]});await e.activate();e.tabs=[{id:1,windowId:1,url:C,title:C}];let r=await e.request('DIFF_PREVIEW',{id:'past',windowId:1});e.tabs.push({id:2,windowId:1,url:A,title:A});let restored=await e.request('DIFF_RESTORE',{id:'past',windowId:1,indices:[0,1],revision:r.revision});assert(restored.ok);assert.equal(restored.restored,1);assert.equal(e.created[0].url,B);assert(e.data.tv_sessions.some(x=>x.id==='past'));
 await e.request('RENAME',{id:'past',name:'Changed'});assert.equal((await e.request('DIFF_RESTORE',{id:'past',windowId:1,indices:[0],revision:r.revision})).code,'stale');
});
test('Saved-to-saved comparisons and invalid selections are checked',async()=>{
 const e=await boot({tv_sessions:[session('left',[A,B]),session('right',[B,C])]});const r=await e.request('DIFF_PREVIEW',{id:'left',targetId:'right',windowId:1});assert(r.ok);assert.equal(r.missing[0].tab.url,A);assert.equal(r.added[0].url,C);await e.activate();assert.equal((await e.request('DIFF_RESTORE',{id:'left',windowId:1,indices:[99],revision:r.revision})).code,'invalid');
});
test('Launch plan records are Pro, retain selected windows/pins/groups and are reusable',async()=>{
 const e=await boot(),windows=[{name:'Docs',tabs:[tab(A,{pinned:true})]},{name:'Admin',tabs:[tab(B,{group:{id:'g',title:'Admin',color:'red',collapsed:false}})]}];assert.equal((await e.request('LAUNCH_SAVE',{name:'Release',windows})).code,'pro');await e.activate();const saved=await e.request('LAUNCH_SAVE',{name:'Release',windows,skipDuplicates:true,preserveGroups:true});assert(saved.ok);let r=await e.request('LAUNCH_OPEN',{id:saved.record.id,windows:[0]});assert(r.ok);assert.equal(r.restored,1);assert(e.created[0].pinned);assert((await e.request('LAUNCH_OPEN',{id:saved.record.id,windows:[1]})).ok);assert(e.groups.length);assert.equal((await e.request('LAUNCH_OPEN',{id:saved.record.id,windows:[0]})).restored,0);assert.equal((await e.request('LAUNCH_OPEN',{id:saved.record.id,windows:[0,1]})).code,'invalid');
});
test('Launch partial failure leaves the plan and saved sessions untouched',async()=>{
 const e=await boot({tv_sessions:[session('source',[A,B])]});await e.activate();const saved=await e.request('LAUNCH_SAVE',{name:'Two pages',windows:[{tabs:[tab(A),tab(B)]}]});e.failCreateAt=1;const r=await e.request('LAUNCH_OPEN',{id:saved.record.id,windows:[0]});assert.equal(r.code,'restore');assert.equal(e.data.tv_sessions.length,1);assert.equal(e.data.tv_launches.length,1);
});
test('Cleanup defaults to exact URLs and optional tracking rules preserve meaningful queries and hashes',async()=>{
 const e=await boot({tv_sessions:[session('one',[A+'?utm_source=x',A+'?id=1',A+'#section']),session('two',[A+'?utm_source=y',A+'?id=2',A+'#other'])]});let r=await e.request('CLEANUP_PREVIEW',{ids:['one','two']});assert(r.ok);assert.equal(r.groups.length,0);r=await e.request('CLEANUP_PREVIEW',{ids:['one','two'],tracking:true});assert.equal(r.groups.length,1);assert.equal(r.groups[0].url,A);assert.equal((await e.request('CLEANUP_APPLY',{ids:['one','two'],revision:r.revision,tracking:true,remove:[{sessionId:'two',index:0}]})).code,'pro');
});
test('Cross-session cleanup preserves notes/project context and is undoable',async()=>{
 const e=await boot({tv_sessions:[session('one',[A,B],{note:'First note',tags:['one']}),session('two',[A,C],{note:'Second note',tags:['two']})]});await e.activate();const p=await e.request('CLEANUP_PREVIEW',{ids:['one','two']});const r=await e.request('CLEANUP_APPLY',{ids:['one','two'],revision:p.revision,remove:[{sessionId:'two',index:0}]});assert(r.ok);assert.equal(r.removed,1);const second=e.data.tv_sessions.find(x=>x.id==='two');assert.equal(second.tabs.length,1);assert.equal(second.note,'Second note');assert.deepEqual(second.tags,['two']);assert((await e.request('UNDO')).ok);assert.equal(e.data.tv_sessions.find(x=>x.id==='two').tabs.length,2);
});
test('Cleanup cannot remove every reference or empty a session, and rejects stale previews',async()=>{
 const e=await boot({tv_sessions:[session('one',[A,B]),session('two',[A])]});await e.activate();const p=await e.request('CLEANUP_PREVIEW',{ids:['one','two']});const before=JSON.stringify(e.data);assert.equal((await e.request('CLEANUP_APPLY',{ids:['one','two'],revision:p.revision,remove:[{sessionId:'one',index:0},{sessionId:'two',index:0}]})).code,'invalid');assert.equal(JSON.stringify(e.data),before);assert.equal((await e.request('CLEANUP_APPLY',{ids:['one','two'],revision:p.revision,remove:[{sessionId:'two',index:0}]})).code,'invalid');await e.request('RENAME',{id:'two',name:'Updated'});assert.equal((await e.request('CLEANUP_APPLY',{ids:['one','two'],revision:p.revision,remove:[{sessionId:'one',index:0}]})).code,'stale');
});
test('Undo keeps new automatic snapshots and failed writes never replace the previous undo',async()=>{
 const e=await boot({tv_sessions:[session('one',[A])]});await e.request('DELETE',{id:'one'});await e.request('SETTINGS',{autoOn:true});await e.request('SAVE_WINDOW',{auto:true,windowId:1});assert((await e.request('UNDO')).ok);assert.equal(e.data.tv_sessions.length,2);await e.request('RENAME',{id:'one',name:'Changed'});const old=JSON.stringify(e.data.tv_undo);e.failNextSet=true;assert.equal((await e.request('DELETE',{id:'one'})).ok,false);assert.equal(JSON.stringify(e.data.tv_undo),old);
});
test('Oversized backup imports retain sessions, projects and launch plans after downgrade',async()=>{
 const e=await boot();const r=await e.request('IMPORT',{data:{sessions:Array.from({length:35},(_,i)=>session('s'+i,[A])),projects:[],launches:[{id:'launch',name:'Imported',windows:[{tabs:[tab(B)]}]}]}});assert(r.ok);assert.equal(r.state.sessions.length,35);assert.equal(r.state.launches.length,1);assert.equal((await e.request('SAVE_WINDOW',{windowId:1})).code,'limit');assert((await e.request('SESSION_PATCH',{id:'s0',note:'Still editable'})).ok);assert.equal((await e.request('LAUNCH_OPEN',{id:'launch',windows:[0]})).code,'pro');assert((await e.request('LAUNCH_DELETE',{id:'launch'})).ok);
});
test('Browser language changes follow auto; manual choice and large size persist',async()=>{
 const e=await boot();e.chrome.i18n={getUILanguage:()=> 'zh-CN'};assert.equal((await e.request('READ')).state.settings.langResolved,'zh');await e.request('SETTINGS',{fontSize:'large'});assert.equal((await e.request('READ')).state.settings.fontSize,'large');e.chrome.i18n.getUILanguage=()=> 'fr';assert.equal((await e.request('READ')).state.settings.langResolved,'en');await e.request('SETTINGS',{langPref:'zh'});assert.equal((await e.request('READ')).state.settings.langResolved,'zh');
});
let failed=0;for(const[name,fn]of tests){try{await fn();console.log('PASS '+name)}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack)}}console.log('Vault workflows: '+(tests.length-failed)+'/'+tests.length);process.exitCode=failed?1:0;
