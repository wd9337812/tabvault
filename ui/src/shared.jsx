import React,{useState,useRef,useEffect,useCallback} from 'react';
import {motion,AnimatePresence,useReducedMotion} from 'motion/react';
import {Moon,Sun,Settings2,Search,Check,Plus,X,Download,Upload,ShieldCheck,Monitor,Globe2,Leaf,ChevronRight} from 'lucide-react';
import {Button} from './ui/button';
import {Switch} from './ui/switch';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from './ui/sheet';
import {Logo} from './logo';
import {translator} from './strings';
import {LicenseSection} from './billing-panel';
export {Button,Switch,Logo};

const empty={lists:[],tasks:[],sessions:[],settings:{},ui:{},plan:'free'};
export const http=x=>{try{return typeof x==='string'&&['https:','http:'].includes(new URL(x).protocol)}catch{return false}};
export const domain=x=>{try{return new URL(x).hostname.replace(/^www\./,'')}catch{return ''}};
export const dateToday=()=>new Date().toLocaleDateString('sv-SE');
export const dateTomorrow=()=>{const day=new Date();day.setDate(day.getDate()+1);return day.toLocaleDateString('sv-SE')};
export function download(text,filename,mime='application/json'){
 const url=URL.createObjectURL(new Blob([text],{type:mime}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export function useWorkspace(app){
 const [state,setState]=useState(empty),[ready,setReady]=useState(false),[error,setError]=useState(false),[busy,setBusy]=useState(0),[notice,setNotice]=useState(''),[windowInfo,setWindowInfo]=useState({id:null,tabs:[]});
 const serial=useRef(0),alive=useRef(true),timer=useRef(null),refreshTimer=useRef(null);
 const vault=app==='tabvault',prefs=vault?state.settings:state.ui,lang=prefs?.langPref==='zh'?'zh':'en',t=translator(lang),isPro=state.plan==='pro',caps=isPro?CONFIG.PRO:CONFIG.FREE;
 const langRef=useRef(lang);langRef.current=lang;
 const notify=useCallback(message=>{setNotice(message);clearTimeout(timer.current);timer.current=setTimeout(()=>setNotice(''),3000)},[]);
 const read=useCallback(async()=>{
  const token=++serial.current;
  try{const r=await chrome.runtime.sendMessage({type:vault?'TV_OP':'TT_OP',op:'READ'});if(!r?.ok)throw new Error();if(alive.current&&token===serial.current){setState(r.state);setError(false);setReady(true)}}
  catch{if(alive.current){setReady(true);setError(true)}}
 },[vault]);
 const rpc=useCallback(async(op,payload={},options={})=>{
  const token=++serial.current;setBusy(n=>n+1);
  try{
   const r=await chrome.runtime.sendMessage({type:vault?'TV_OP':'TT_OP',op,payload});
   if(!r?.ok){const tr=translator(langRef.current);notify(tr(r?.message||'saveFailed'));if((r?.code==='pro'||r?.code==='limit')&&options.upgrade)options.upgrade();return null}
   if(alive.current&&token===serial.current){setState(r.state);setError(false);setReady(true)}return r;
  }catch{notify(translator(langRef.current)('saveFailed'));return null}
  finally{if(alive.current)setBusy(n=>Math.max(0,n-1))}
 },[vault,notify]);
 const refreshTabs=useCallback(async()=>{
  try{const win=await chrome.windows.getCurrent();const tabs=await chrome.tabs.query({windowId:win.id});if(alive.current)setWindowInfo({id:win.id,tabs:tabs.filter(tab=>http(tab.url))})}catch{/* A browser window may close. */}
 },[]);
 useEffect(()=>{
  alive.current=true;read();refreshTabs();rpc('BILLING_CHECK');
  const billingFocus=()=>rpc('BILLING_CHECK');window.addEventListener('focus',billingFocus);
  const changed=(changes,area)=>{if(area!=='local')return;const names=vault?['tv_sessions','tv_projects','tv_settings','tv_license','tv_startup_hint']:['tasks','lists','licenseKey','pendingCaptures','tt_ui'];if(!names.some(k=>changes[k]))return;clearTimeout(refreshTimer.current);refreshTimer.current=setTimeout(read,30)};
  const tabsChanged=()=>refreshTabs();chrome.storage.onChanged.addListener(changed);chrome.tabs.onCreated.addListener(tabsChanged);chrome.tabs.onRemoved.addListener(tabsChanged);chrome.tabs.onUpdated.addListener(tabsChanged);chrome.tabs.onActivated.addListener(tabsChanged);
  return()=>{window.removeEventListener('focus',billingFocus);alive.current=false;serial.current++;clearTimeout(timer.current);clearTimeout(refreshTimer.current);chrome.storage.onChanged.removeListener(changed);chrome.tabs.onCreated.removeListener(tabsChanged);chrome.tabs.onRemoved.removeListener(tabsChanged);chrome.tabs.onUpdated.removeListener(tabsChanged);chrome.tabs.onActivated.removeListener(tabsChanged)};
 },[read,refreshTabs,vault]);
 const [systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme: dark)').matches);
 useEffect(()=>{const mq=matchMedia('(prefers-color-scheme: dark)'),listener=e=>setSystemDark(e.matches);mq.addEventListener('change',listener);return()=>mq.removeEventListener('change',listener)},[]);
 const themePref=prefs?.themePref||'light',dark=themePref==='dark'||themePref==='auto'&&systemDark;
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.dataset.product=vault?'vault':'tasks';document.documentElement.classList.toggle('dark',dark);document.documentElement.lang=lang==='zh'?'zh-CN':'en'},[dark,lang,vault]);
 const savePrefs=patch=>rpc(vault?'SETTINGS':'UI_PREFS',patch);
 const reduced=useReducedMotion(),transition={duration:reduced?0:.2,ease:[.2,.8,.2,1]};
 return {app,vault,state,prefs,lang,t,isPro,caps,ready,error,busy:busy>0,notice,notify,rpc,read,windowInfo,refreshTabs,savePrefs,dark,transition};
}
export function Header({ws,onSettings}){const {vault,t,isPro,dark,lang,savePrefs}=ws;return <header className="app-header"><div className="app-brand"><Logo vault={vault}/><div><strong>{vault?'TabVault':'TabTasks'}</strong><span>{t(vault?'vaultTag':'focus')}</span></div></div><span id="planBadge" className="pro-badge">{isPro?'PRO':'FREE'}</span><Button variant="ghost" className="language-button icon-button" size="icon" aria-label={t('switchLanguage')} title={t('switchLanguage')} onClick={()=>savePrefs({langPref:lang==='en'?'zh':'en'})}>{lang==='zh'?'中':'EN'}</Button><Button variant="ghost" className="icon-button" size="icon" aria-label={t(dark?'switchLight':'switchDark')} onClick={()=>savePrefs({themePref:dark?'light':'dark'})}>{dark?<Sun/>:<Moon/>}</Button><Button variant="ghost" className="icon-button" size="icon" aria-label={t('settings')} onClick={onSettings}><Settings2/></Button></header>}
export function Welcome({ws}){return <section className="welcome"><div className="eyebrow">{ws.t(ws.vault?'vaultEyebrow':'taskEyebrow')}<span className="tiny-dash"/></div><h2>{ws.t(ws.vault?'vaultHeadline':'taskHeadline')}</h2><p>{ws.t(ws.vault?'vaultLead':'taskLead')}</p></section>}
export function Toast({ws}){return <AnimatePresence>{ws.notice&&<motion.div id="toast" role="status" className="toast" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:4}} transition={ws.transition}><span><Check size={13}/></span>{ws.notice}</motion.div>}</AnimatePresence>}
export function Loading({ws}){return <div className={'loading-state '+(ws.error?'load-error':'')}><div><Logo vault={ws.vault} size={48}/><span>{ws.t(ws.error?'loadFailed':'loading')}</span>{ws.error&&<Button variant="outline" onClick={ws.read}>{ws.t('retry')}</Button>}</div></div>}
export function Segments({items,value,onChange,label}){return <div className="segments" role="tablist" aria-label={label} onKeyDown={e=>{const at=items.findIndex(x=>x.id===value),next=e.key==='ArrowRight'?(at+1)%items.length:e.key==='ArrowLeft'?(at+items.length-1)%items.length:e.key==='Home'?0:e.key==='End'?items.length-1:-1;if(next<0)return;e.preventDefault();onChange(items[next].id);e.currentTarget.querySelectorAll('button')[next]?.focus()}}>{items.map(item=><Button key={item.id} role="tab" variant="ghost" tabIndex={value===item.id?0:-1} aria-selected={value===item.id} className={'segment '+(value===item.id?'selected':'')} onClick={()=>onChange(item.id)}>{value===item.id&&<motion.span className="segment-bg" layoutId="active-filter" transition={{type:'spring',stiffness:420,damping:34}}/>}<span>{item.label}{item.count!==undefined&&<em>{item.count}</em>}</span></Button>)}</div>}
export function PanelSheet({ws,panelRef,open,onClose,title,description,children}){return <Sheet open={open} onOpenChange={value=>{if(!value)onClose()}}><SheetContent portalContainer={panelRef.current} closeLabel={ws.t('close')} className="design-sheet"><SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader><div className="sheet-body">{children}</div>{open&&<Toast ws={ws}/>}</SheetContent></Sheet>}
export function Empty({ws,search=false}){return <div className="empty-state"><Leaf size={28}/><b>{ws.t(search?'noMatches':'empty')}</b><span>{ws.t(search?'tryKeyword':ws.vault?'emptyVault':'emptyTask')}</span></div>}
export function SiteMark({url,size}){const name=domain(url),n=[...name].reduce((v,c)=>v+c.charCodeAt(0),0),colors=['#9273c0','#688896','#6d75c2','#b99141','#549789'];return <span className="favicon" style={{color:colors[n%colors.length],...(size?{width:size,height:size}:{})}} aria-hidden="true">{(name[0]||'↗').toUpperCase()}</span>}
export function SiteStack({tabs=[]}){return <span className="favicon-stack" aria-hidden="true">{tabs.slice(0,4).map((tab,index)=><SiteMark key={index} url={tab.url}/>)}</span>}
export function ago(ts,ws){const diff=Date.now()-ts;if(diff<60000)return ws.t('justNow');if(diff<3600000)return ws.t('minutesAgo',{n:Math.floor(diff/60000)});if(diff<86400000)return ws.t('hoursAgo',{n:Math.floor(diff/3600000)});return new Date(ts).toLocaleString(ws.lang==='zh'?'zh-CN':'en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
export function Footer({ws,onExport,onImport,children}){return <footer className="app-footer"><span className="footer-summary"><span className="local-dot"/>{ws.t(ws.vault?'vaultLocal':'taskLocal')}</span><div><Button variant="ghost" size="icon-xs" aria-label={ws.t('export')} title={ws.t('export')} onClick={onExport}><Download size={14}/></Button><Button variant="ghost" size="icon-xs" aria-label={ws.t('import')} title={ws.t('import')} onClick={onImport}><Upload size={14}/></Button>{children}</div></footer>}
export function Preferences({ws}){const {t,prefs,lang,savePrefs}=ws;return <><div className="settings-section"><h4>{t('language')}</h4><div className="theme-choices preferences-language"><button className={lang==='en'?'chosen':''} onClick={()=>savePrefs({langPref:'en'})} aria-pressed={lang==='en'}>English</button><button className={lang==='zh'?'chosen':''} onClick={()=>savePrefs({langPref:'zh'})} aria-pressed={lang==='zh'}>简体中文</button></div></div><div className="settings-section"><h4>{t('appearance')}</h4><div className="theme-choices">{[['light',Sun],['dark',Moon],['auto',Monitor]].map(([value,Icon])=><button key={value} className={(prefs?.themePref||'light')===value?'chosen':''} aria-pressed={(prefs?.themePref||'light')===value} onClick={()=>savePrefs({themePref:value})}><Icon size={14}/>{t(value==='auto'?'system':value)}</button>)}</div></div></>}
export function License({ws,onUpgrade}){return <LicenseSection ws={ws} onUpgrade={onUpgrade}/>}
export function DataSettings({ws,onExport,onImport,children}){return <div className="settings-section"><h4>{ws.t('data')}</h4><div className="setting-data-actions"><Button variant="outline" onClick={onExport}><Download size={14}/>{ws.t('exportBackup')}</Button><Button variant="outline" onClick={onImport}><Upload size={14}/>{ws.t('importBackup')}</Button>{children}</div><p className="settings-note">{ws.t(ws.vault?'vaultDataNote':'taskDataNote')}</p></div>}
export function SettingsBrand({ws}){return <div className="settings-brand"><Logo vault={ws.vault} size={50}/><div><h3>{ws.vault?'TabVault':'TabTasks'}{ws.isPro?' Pro':''}</h3><p>{ws.t(ws.vault?'vaultTag':'focus')}</p></div><span className="pro-badge">{ws.isPro?'PRO':'FREE'}</span></div>}
export function Shortcuts({ws}){return <><div className="settings-section"><h4>{ws.t('shortcuts')}</h4><div className="preference-row"><b>{ws.t(ws.vault?'saveWindow':'capture')}</b><kbd>Alt + Shift + {ws.vault?'S':'T'}</kbd></div></div><div className="quiet-info"><ShieldCheck size={15}/><span>{ws.t('noAccount')}</span></div></>}
