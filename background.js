importScripts('config.js', 'license.js', 'data.js', 'i18n.js', 'billing-client.js');
const STORE_SESSIONS = 'tv_sessions', STORE_SETTINGS = 'tv_settings', ALARM_AUTOSAVE = 'tv-autosave';
const serialize = Data.queue();
const defaultSettings = { autoOn: false, intervalMin: CONFIG.AUTO_INTERVAL_MIN, delAfterRestore: false, langPref: 'en', themePref: 'light' };
async function readState() {
  const raw = await chrome.storage.local.get([STORE_SESSIONS, STORE_SETTINGS, 'tv_license', 'tv_projects']);
  const projects = Data.records(raw.tv_projects, Data.project),records = Data.records(raw[STORE_SESSIONS], Data.session), stored = Data.object(raw[STORE_SETTINGS]) ? raw[STORE_SETTINGS] : {};
  const settings = { ...defaultSettings, ...Object.fromEntries(Object.keys(defaultSettings).filter(k => k in stored).map(k => [k, stored[k]])) };
  settings.autoOn = !!settings.autoOn; settings.delAfterRestore = !!settings.delAfterRestore;
  settings.intervalMin = Number.isFinite(settings.intervalMin) && settings.intervalMin >= 1 ? settings.intervalMin : CONFIG.AUTO_INTERVAL_MIN;
  if (!['en', 'zh'].includes(settings.langPref)) settings.langPref = 'en';
  if (!['light', 'dark', 'auto'].includes(settings.themePref)) settings.themePref = 'auto';
  const key = raw.tv_license?.key, v = key ? await Lic.verify(key, CONFIG.SECRET) : { ok: false };
  const plan = v.ok && v.plan === 'pro' ? 'pro' : 'free'; settings.plan = plan;
  I18N.setPref(settings.langPref);
  return { projects:projects.values,sessions: records.values.sort((a, b) => b.createdAt - a.createdAt), settings, plan, raw, invalid: records.invalid||projects.invalid, license: v.ok ? v : null };
}
const capsFor = s => s.plan === 'pro' ? CONFIG.PRO : CONFIG.FREE;
const snapshot = s => ({ projects:s.projects,sessions: s.sessions, settings: s.settings, plan: s.plan, license: s.license, recoveryAvailable: s.invalid });
async function writeSessions(s) {
  await Data.protect(s.raw, [STORE_SESSIONS,'tv_projects'], 'tv_recovery_backup_v1', s.invalid);
  await chrome.storage.local.set({ [STORE_SESSIONS]: s.sessions, tv_projects:s.projects });
  updateTitle(s).catch(console.warn);
}
async function updateTitle(s) {
  s ||= await readState();
  await chrome.action.setTitle({ title: I18N.t('badgeTitle', { n: s.sessions.filter(x => !x.auto).length }) });
}
async function updateTabBadge() {
  try {
    const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
    const n = tabs.filter(t => Data.http(t.url)).length;
    await chrome.action.setBadgeText({ text: n ? (n > 99 ? '99+' : String(n)) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#8a8a93' });
  } catch { /* A window can disappear while being queried. */ }
}
function sessionName(tabs) {
  const hosts = [...new Set(tabs.map(t => new URL(t.url).hostname.replace(/^www\./, '')))];
  return `${hosts.slice(0, 3).join(', ')}${hosts.length > 3 ? ` +${hosts.length - 3}` : ''} ${I18N.t('tabsSuffix', { n: tabs.length })}`;
}
const tabSig = tabs => JSON.stringify(tabs.map(t => [t.url, t.pinned, t.title, t.group]));
async function currentTabs(windowId) {
  const tabs = await chrome.tabs.query(Number.isInteger(windowId) ? { windowId } : { lastFocusedWindow: true });
  const groups=new Map();return Promise.all(tabs.filter(t=>Data.http(t.url)).map(async tab=>{
    let group;if(tab.groupId>=0&&chrome.tabGroups?.get){if(!groups.has(tab.groupId))groups.set(tab.groupId,chrome.tabGroups.get(tab.groupId).catch(()=>null));const value=await groups.get(tab.groupId);if(value)group={id:String(tab.groupId),title:value.title||'',color:value.color||'grey',collapsed:!!value.collapsed};}
    return {...tab,...(group?{group}:{})};
  }));
}
function insertSession(s, tabs, { auto = false, windowId, name, projectId='' } = {}) {
  if (!tabs.length) Data.fail('empty', I18N.t('tNoTabs'));
  if (auto && (!s.settings.autoOn || !capsFor(s).auto)) Data.fail('pro', I18N.t('tAutoPro'));
  if (!auto && s.sessions.filter(x => !x.auto).length >= capsFor(s).maxManualSessions) Data.fail('limit', I18N.t('tFreeLimit', { max: CONFIG.FREE.maxManualSessions }));
  if(projectId){requireFeature(s,'projects');if(!s.projects.some(project=>project.id===projectId))Data.fail('missing','missingProject')}
  const cleanTabs = tabs.map(Data.tab);
  if (auto) {
    const last = s.sessions.find(x => x.auto && x.windowId === windowId);
    if (last && tabSig(last.tabs) === tabSig(cleanTabs)) return { session: last, skipped: true };
  }
  const session = Data.session({ id: Data.id(), name: name || (auto ? I18N.t('autoName', { time: new Date().toLocaleString(I18N.lang()==='zh'?'zh-CN':'en-US') }) : sessionName(cleanTabs)),
    createdAt: Date.now(), auto, tabs: cleanTabs, projectId, ...(Number.isInteger(windowId) ? { windowId } : {}) });
  if (auto) {
    if(new TextEncoder().encode(JSON.stringify([session])).length>CONFIG.MAX_AUTO_BYTES)Data.fail('storage','snapshotTooLarge');
    const manual = s.sessions.filter(x => !x.auto);
    const cutoff=capsFor(s).historyDays?Date.now()-capsFor(s).historyDays*864e5:0;
    const history=[session,...s.sessions.filter(x=>x.auto&&x.createdAt>=cutoff)].slice(0,capsFor(s).keepAutoBackups);
    while(history.length>1&&new TextEncoder().encode(JSON.stringify(history)).length>CONFIG.MAX_AUTO_BYTES)history.pop();
    s.sessions = [...manual, ...history].sort((a, b) => b.createdAt - a.createdAt);
  } else s.sessions.unshift(session);
  return { session, skipped: false };
}
async function syncAlarm(s) {
  s ||= await readState();
  const existing = await chrome.alarms.get(ALARM_AUTOSAVE);
  if (s.settings.autoOn && capsFor(s).auto) {
    if (!existing || existing.periodInMinutes !== s.settings.intervalMin) await chrome.alarms.create(ALARM_AUTOSAVE, { periodInMinutes: s.settings.intervalMin });
  } else if (existing) await chrome.alarms.clear(ALARM_AUTOSAVE);
}
async function saveWindow(s, { auto = false, windowId, andClose = false, projectId='' } = {}) {
  const tabs = await currentTabs(windowId);
  const result = insertSession(s, tabs.map(t => ({ ...t, fav: t.favIconUrl || '' })), { auto, windowId: windowId ?? tabs[0]?.windowId, projectId });
  if (!result.skipped) await writeSessions(s);
  // Only close tabs after successful durable storage; retain the first tab.
  if (andClose && tabs.length > 1) await chrome.tabs.remove(tabs.slice(1).map(t => t.id));
  return result;
}
function requireFeature(s,feature){if(!capsFor(s)[feature])Data.fail('pro',feature==='projects'?'projectPro':feature==='organize'?'organizePro':'restorePro');}
async function restoreSession(s, {id,here=false,windowId,indices,preserveGroups=false,skipDuplicates=false,keepSession=false}={}) {
  const session=s.sessions.find(x=>x.id===id);if(!session)Data.fail('missing',I18N.t('missingSession'));
  if(preserveGroups||skipDuplicates)requireFeature(s,'advancedRestore');
  if(indices!==undefined&&(!Array.isArray(indices)||!indices.length||indices.some(index=>!Number.isInteger(index)||index<0||index>=session.tabs.length)))Data.fail('invalid','invalidSelection');
  const chosen=indices?new Set(indices):null,selected=session.tabs.filter((tab,index)=>!chosen||chosen.has(index));
  const seen=new Set(skipDuplicates?(await chrome.tabs.query({})).filter(tab=>Data.http(tab.url)).map(tab=>new URL(tab.url).href):[]);
  let skipped=0;const tabs=selected.filter(tab=>{const url=new URL(tab.url).href;if(skipDuplicates&&seen.has(url)){skipped++;return false}seen.add(url);return true});
  if(!tabs.length)return{restored:0,skipped};
  let targetWindow=windowId,restored=0;const groups=new Map();
  if(here&&!Number.isInteger(targetWindow))Data.fail('invalid','invalidWindow');
  if(!here){const win=await chrome.windows.create({url:'about:blank'});targetWindow=win.id;}
  try{
    for(const tab of tabs){const created=await chrome.tabs.create({windowId:targetWindow,url:tab.url,pinned:tab.pinned,active:false});restored++;if(preserveGroups&&tab.group&&!tab.pinned){if(!groups.has(tab.group.id))groups.set(tab.group.id,{info:tab.group,ids:[]});groups.get(tab.group.id).ids.push(created.id)}}
    for(const group of groups.values()){const groupId=await chrome.tabs.group({tabIds:group.ids,createProperties:{windowId:targetWindow}});await chrome.tabGroups.update(groupId,{title:group.info.title,color:group.info.color,collapsed:group.info.collapsed})}
    if(!here){const blanks=(await chrome.tabs.query({windowId:targetWindow})).filter(tab=>tab.url==='about:blank');if(blanks.length)await chrome.tabs.remove(blanks.map(tab=>tab.id))}
  }catch{Data.fail('restore',I18N.t('restorePartial',{n:restored,total:tabs.length}));}
  // A selective or deduplicated restore is not permission to delete the original saved session.
  if(!keepSession&&s.settings.delAfterRestore&&!session.auto&&selected.length===session.tabs.length&&skipped===0){s.sessions=s.sessions.filter(x=>x.id!==id);await writeSessions(s)}
  return{restored,skipped};
}

async function dispatch(op, p = {}) {
  const s = await readState(); let extra = {};
  if (op.startsWith('BILLING_')) { const billing=await BillingClient.dispatch(op,p); return {ok:true,state:snapshot(await readState()),...billing}; }
  else if (op === 'READ') { /* Reading never writes stale page state. */ }
  else if (op === 'SAVE_WINDOW') extra = await saveWindow(s, p);
  else if (op === 'PASTE') { extra = insertSession(s, p.tabs || [],{projectId:p.projectId||'',name:p.name}); await writeSessions(s); }
  else if (op === 'DELETE') { s.sessions = s.sessions.filter(x => x.id !== p.id); await writeSessions(s); }
  else if (op === 'RENAME') {
    const session = s.sessions.find(x => x.id === p.id); if (!session || session.auto) Data.fail('missing', 'Session no longer exists');
    if (typeof p.name !== 'string' || !p.name.trim()) Data.fail('invalid', I18N.t('nameRequired')); session.name = p.name.trim().slice(0, 200); await writeSessions(s);
  }
  else if (op === 'RESTORE') extra = await restoreSession(s,p);
  else if (op === 'IMPORT') {
    if (!capsFor(s).export) Data.fail('pro', I18N.t('tImportPro'));
    if (!Data.object(p.data) || (p.data.app && p.data.app !== 'tabvault')) Data.fail('invalid', I18N.t('tBadFile'));
    const sessions = Data.records(p.data.sessions, Data.session, true).values, ids = new Set(s.sessions.map(x => x.id));
    const incoming = sessions.filter(x => !ids.has(x.id));
    const projects=Data.records(p.data.projects||[],Data.project,true).values,known=new Set(s.projects.map(x=>x.id));
    const available=new Set([...known,...projects.map(project=>project.id)]);
    if(incoming.some(session=>session.projectId&&!available.has(session.projectId)))Data.fail('invalid','missingProject');
    // Restoring a backup never holds existing user data behind the creation quota.
    s.projects.push(...projects.filter(x=>!known.has(x.id)));
    s.sessions = [...incoming, ...s.sessions].sort((a, b) => b.createdAt - a.createdAt); await writeSessions(s); extra.imported = incoming.length;
  }
  else if(op==='PROJECT_ADD'){
    requireFeature(s,'projects');const project=Data.project({id:Data.id(),name:p.name,color:p.color,note:p.note});s.projects.push(project);await writeSessions(s);extra.project=project;
  }
  else if(op==='PROJECT_PATCH'){
    requireFeature(s,'projects');const project=s.projects.find(x=>x.id===p.id);if(!project)Data.fail('missing','missingProject');Object.assign(project,Data.project({...project,...Object.fromEntries(['name','note','color'].filter(key=>Object.hasOwn(p,key)).map(key=>[key,p[key]]))}));await writeSessions(s);
  }
  else if(op==='PROJECT_DELETE'){
    requireFeature(s,'projects');if(!s.projects.some(x=>x.id===p.id))Data.fail('missing','missingProject');s.projects=s.projects.filter(x=>x.id!==p.id);s.sessions.forEach(session=>{if(session.projectId===p.id)session.projectId=''});await writeSessions(s);
  }
  else if(op==='SESSION_PATCH'){
    requireFeature(s,'organize');const session=s.sessions.find(x=>x.id===p.id);if(!session||session.auto)Data.fail('missing','missingSession');
    const fields=Object.fromEntries(['name','note','tags','projectId','pinned'].filter(key=>Object.hasOwn(p,key)).map(key=>[key,p[key]]));
    if(fields.projectId&&!s.projects.some(x=>x.id===fields.projectId))Data.fail('missing','missingProject');Object.assign(session,Data.session({...session,...fields}));await writeSessions(s);
  }
  else if(op==='BULK_MOVE'||op==='MERGE'){
    requireFeature(s,'organize');if(!Array.isArray(p.ids)||!p.ids.length||new Set(p.ids).size!==p.ids.length)Data.fail('invalid','invalidSelection');
    const selected=p.ids.map(id=>s.sessions.find(session=>session.id===id&&!session.auto));if(selected.some(x=>!x))Data.fail('missing','missingSession');
    if(p.projectId&&!s.projects.some(x=>x.id===p.projectId))Data.fail('missing','missingProject');
    if(op==='BULK_MOVE')selected.forEach(session=>{session.projectId=p.projectId||''});
    else{if(selected.length<2)Data.fail('invalid','invalidSelection');const result=insertSession(s,selected.flatMap(session=>session.tabs),{name:p.name||selected.map(x=>x.name).join(' + ').slice(0,200),projectId:p.projectId||''});extra.session=result.session;}
    await writeSessions(s);
  }
  else if(op==='DEDUP'){
    requireFeature(s,'organize');const session=s.sessions.find(x=>x.id===p.id&&!x.auto);if(!session)Data.fail('missing','missingSession');const seen=new Set(),before=session.tabs.length;
    session.tabs=session.tabs.filter(tab=>{const key=new URL(tab.url).href;if(seen.has(key))return false;seen.add(key);return true});extra.removed=before-session.tabs.length;if(extra.removed)await writeSessions(s);
  }
  else if(op==='RESTORE_PROJECT'){
    requireFeature(s,'projects');if(!s.projects.some(x=>x.id===p.id))Data.fail('missing','missingProject');const sessions=s.sessions.filter(x=>!x.auto&&x.projectId===p.id);if(!sessions.length)Data.fail('empty','projectEmpty');
    let restored=0,skipped=0;for(const session of sessions){const result=await restoreSession(s,{id:session.id,skipDuplicates:!!p.skipDuplicates,preserveGroups:true,keepSession:true});restored+=result.restored;skipped+=result.skipped;}extra={restored,skipped,windows:sessions.length};
  }

  else if (op === 'SETTINGS') {
    for (const key of Object.keys(defaultSettings)) if (Object.hasOwn(p, key)) s.settings[key] = p[key];
    if (p.autoOn === true && !capsFor(s).auto) Data.fail('pro', I18N.t('tAutoPro'));
    if (!capsFor(s).auto) s.settings.autoOn = false;
    if (!Number.isFinite(s.settings.intervalMin) || s.settings.intervalMin < 1) Data.fail('invalid', 'Invalid interval');
    if (!['en','zh','auto'].includes(s.settings.langPref) || !['light','dark','auto'].includes(s.settings.themePref)) Data.fail('invalid', 'Invalid preference');
    I18N.setPref(s.settings.langPref); s.settings.langResolved = I18N.lang();
    await chrome.storage.local.set({ [STORE_SETTINGS]: s.settings }); await syncAlarm(s);
    if (s.settings.autoOn && capsFor(s).auto) await refreshWindowCaches();
  }
  else if (op === 'LICENSE_SET') {
    const v = await Lic.verify(p.key, CONFIG.SECRET); if (!v.ok || v.plan !== 'pro') Data.fail('invalid', I18N.t('licInvalid'));
    await chrome.storage.local.set({ tv_license: { key: p.key, ...v } }); await syncAlarm();
    return { ok: true, state: snapshot(await readState()) };
  }
  else if (op === 'LICENSE_RELEASE') {
    await chrome.storage.local.remove('tv_license');
    await chrome.storage.local.set({ [STORE_SETTINGS]: { ...s.settings, autoOn: false, plan: 'free' } }); await syncAlarm();
    return { ok: true, state: snapshot(await readState()) };
  }
  else Data.fail('invalid', 'Unknown operation');
  return { ok: true, state: snapshot(s), ...extra };
}
function request(op, payload) { return serialize(() => dispatch(op, payload)); }
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id && sender.id !== chrome.runtime.id) return;
  if (!msg || msg.type !== 'TV_OP') return;
  request(msg.op, msg.payload).then(sendResponse, e => sendResponse({ ok: false, code: e.code || 'storage', message: e.code ? e.message : I18N.t('tSaveFailed') })); return true;
});
async function refreshWindowCaches() {
  const s = await readState(); if (!s.settings.autoOn || !capsFor(s).auto) return;
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'], populate: true }), cache = {};
  for (const win of windows) {
    const tabs = (win.tabs || []).filter(t => Data.http(t.url)).map(t => Data.tab({ ...t, fav: t.favIconUrl || '' }));
    if (tabs.length&&!win.incognito) cache[win.id] = (await currentTabs(win.id)).map(Data.tab);
  }
  await chrome.storage.local.set({ tv_window_cache: cache });
}
let cacheTimer;
function scheduleCache() { clearTimeout(cacheTimer); cacheTimer = setTimeout(() => serialize(refreshWindowCaches).catch(console.warn), 500); }
chrome.tabs.onCreated.addListener(() => { updateTabBadge(); scheduleCache(); });
chrome.tabs.onUpdated.addListener(() => { updateTabBadge(); scheduleCache(); });
chrome.tabGroups?.onUpdated?.addListener(scheduleCache);
chrome.tabs.onMoved?.addListener(scheduleCache);
chrome.tabs.onRemoved.addListener((id, info) => { updateTabBadge(); if (!info.isWindowClosing) scheduleCache(); });
chrome.windows.onFocusChanged.addListener(w => { if (w !== chrome.windows.WINDOW_ID_NONE) updateTabBadge(); });
chrome.windows.onRemoved.addListener(windowId => serialize(async () => {
  const s = await readState(), d = await chrome.storage.local.get('tv_window_cache'), tabs = d.tv_window_cache?.[windowId];
  if (!tabs?.length || !s.settings.autoOn || !capsFor(s).auto) return;
  const result = insertSession(s, tabs, { auto: true, windowId }); if (!result.skipped) await writeSessions(s);
  const cache = d.tv_window_cache; delete cache[windowId];
  await chrome.storage.local.set({ tv_window_cache: cache, tv_startup_hint: { at: Date.now(), target: result.session.id } });
}).catch(console.warn));
chrome.alarms.onAlarm.addListener(a => {
  if (a.name !== ALARM_AUTOSAVE) return;
  serialize(async () => {
    const s = await readState(); if (!s.settings.autoOn || !capsFor(s).auto) { await syncAlarm(s); return; }
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    for (const win of windows.filter(win=>!win.incognito)) { try { await saveWindow(s, { auto: true, windowId: win.id }); } catch(e) { console.warn('backup:', e.message); } }
    await refreshWindowCaches();
  }).catch(console.warn);
});
chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (cmd !== 'save-session') return;
  try { await request('SAVE_WINDOW', { windowId: tab?.windowId }); }
  catch(e) { chrome.action.setBadgeText({ text: '!' }); chrome.action.setTitle({ title: e.code ? e.message : I18N.t('tSaveFailed') }); }
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.warn);
  serialize(() => syncAlarm()).catch(console.warn);
});
chrome.runtime.onStartup.addListener(() => serialize(async () => {
  await chrome.storage.local.set({ tv_startup_hint: { at: Date.now() } }); await syncAlarm(); updateTabBadge();
}).catch(console.warn));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.tv_license || changes.tv_settings) serialize(() => syncAlarm()).catch(console.warn);
});
serialize(() => syncAlarm()).catch(console.warn);
updateTitle().catch(console.warn); updateTabBadge();

BillingClient.attach(request);
