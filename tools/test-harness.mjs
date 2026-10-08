import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const app=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).name.startsWith('TabTasks')?'tabtasks':'tabvault';
const clone=x=>x===undefined?undefined:structuredClone(x);
function event(){const listeners=[];return {listeners,addListener(fn){listeners.push(fn)},async emit(...args){return Promise.all(listeners.map(fn=>fn(...args)))}}}
export async function boot(data={}) {
  const env={data:clone(data),failNextSet:false,alarms:new Map(),createAlarmCount:0,tabs:[{id:1,windowId:1,url:'https://example.com/start',title:'Start',pinned:false}],created:[],removed:[],lastTabId:1,clock:0};
  const chrome={
    storage:{onChanged:event(),local:{
      async get(keys){return Object.fromEntries((typeof keys==='string'?[keys]:keys||Object.keys(env.data)).map(k=>[k,clone(env.data[k])]))},
      async set(patch){if(env.failNextSet){env.failNextSet=false;throw new Error('QUOTA_BYTES exceeded')} const changes={};for(const[k,v]of Object.entries(patch)){if(JSON.stringify(env.data[k])!==JSON.stringify(v)){changes[k]={oldValue:clone(env.data[k]),newValue:clone(v)};env.data[k]=clone(v)}} for(const fn of chrome.storage.onChanged.listeners)fn(changes,'local')},
      async remove(keys){const changes={};for(const k of typeof keys==='string'?[keys]:keys){changes[k]={oldValue:clone(env.data[k])};delete env.data[k]}for(const fn of chrome.storage.onChanged.listeners)fn(changes,'local')}
    }},
    runtime:{id:'test-extension',onInstalled:event(),onStartup:event(),onMessage:event(),onMessageExternal:event(),async sendMessage(msg){if(!/_OP$/.test(msg.type))return;return new Promise(resolve=>{for(const fn of chrome.runtime.onMessage.listeners)fn(msg,{id:'test-extension'},resolve)})}},
    contextMenus:{onClicked:event(),create(){},removeAll(cb){cb()}},commands:{onCommand:event()},sidePanel:{async open(){},async setPanelBehavior(){}},
    action:{async setTitle(){},async setBadgeText(){},async setBadgeBackgroundColor(){}},
    alarms:{onAlarm:event(),async get(n){return env.alarms.get(n)},async create(n,args){env.createAlarmCount++;env.alarms.set(n,{...args,scheduledTime:env.clock+args.periodInMinutes*60000})},async clear(n){env.alarms.delete(n)}},
    tabs:{onMoved:event(),onCreated:event(),onRemoved:event(),onUpdated:event(),
      async query(q){return clone(env.tabs.filter(t=>q.windowId==null||q.windowId===t.windowId))},async get(id){return clone(env.tabs.find(t=>t.id===id))},
      async create(p){if(env.failCreateAt===env.created.length)throw new Error('Could not open tab');const tab={id:++env.lastTabId,...p};env.created.push(tab);env.tabs.push(tab);return clone(tab)},
      async group(options){env.groups||=[];env.groups.push(options);return env.groups.length},
      async remove(ids){env.removed.push(...(Array.isArray(ids)?ids:[ids]));env.tabs=env.tabs.filter(t=>!env.removed.includes(t.id))}
    },
    tabGroups:{onUpdated:event(),async get(id){return env.tabGroupInfo?.[id]||{id,title:'Group',color:'blue',collapsed:false}},async update(id,patch){env.updatedGroups||=[];env.updatedGroups.push({id,...patch});return{id,...patch}}},
    windows:{WINDOW_ID_NONE:-1,onRemoved:event(),onFocusChanged:event(),async getAll(o={}){return [...new Set(env.tabs.map(t=>t.windowId))].map(id=>({id,...(o.populate?{tabs:clone(env.tabs.filter(t=>t.windowId===id))}:{})}))},async create(){const id=10+new Set(env.tabs.filter(tab=>tab.windowId>=10).map(tab=>tab.windowId)).size;env.tabs.push({id:++env.lastTabId,windowId:id,url:'about:blank'});return{id}}},
    scripting:{async executeScript(){return[{result:{title:'Captured',url:'https://example.com/start',excerpt:'Page text'}}]}}
  };
  const ctx=vm.createContext({chrome,crypto:webcrypto,TextEncoder,TextDecoder,btoa,atob,URL,AbortSignal,fetch:(...args)=>env.fetch?env.fetch(...args):Promise.reject(new Error('Network is mocked in tests')),console,Date,setTimeout:()=>1,clearTimeout(){},navigator:{language:'en'}});
  ctx.importScripts=(...files)=>{for(const f of files)vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f})};
  vm.runInContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),ctx,{filename:'background.js'});
  env.chrome=chrome;env.context=ctx;env.request=async(op,p)=>{try{return await vm.runInContext('request',ctx)(op,p)}catch(e){return{ok:false,code:e.code,message:e.message}}};
  env.drain=()=>vm.runInContext('serialize',ctx)(async()=>{});
  await env.drain();
  env.proKey=async(exp)=>{
    const payload=Buffer.from(JSON.stringify({plan:'pro',...(exp?{exp}:{}),label:'test'})).toString('base64url');
    const secret=vm.runInContext('CONFIG.SECRET',ctx),key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    return payload+'.'+Buffer.from(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload))).toString('base64url');
  };
  env.activate=async()=>env.request('LICENSE_SET',{key:await env.proKey()});
  return env;
}
