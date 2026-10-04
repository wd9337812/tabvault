importScripts('config.js', 'license.js', 'data.js', 'i18n.js');
const STORE_SESSIONS = 'tv_sessions', STORE_SETTINGS = 'tv_settings', ALARM_AUTOSAVE = 'tv-autosave';
const serialize = Data.queue();
const defaultSettings = { autoOn: false, intervalMin: CONFIG.AUTO_INTERVAL_MIN, delAfterRestore: false, langPref: 'en', themePref: 'light' };
async function readState() {
  const raw = await chrome.storage.local.get([STORE_SESSIONS, STORE_SETTINGS, 'tv_license']);
  const records = Data.records(raw[STORE_SESSIONS], Data.session), stored = Data.object(raw[STORE_SETTINGS]) ? raw[STORE_SETTINGS] : {};
  const settings = { ...defaultSettings, ...Object.fromEntries(Object.keys(defaultSettings).filter(k => k in stored).map(k => [k, stored[k]])) };
  settings.autoOn = !!settings.autoOn; settings.delAfterRestore = !!settings.delAfterRestore;
  settings.intervalMin = Number.isFinite(settings.intervalMin) && settings.intervalMin >= 1 ? settings.intervalMin : CONFIG.AUTO_INTERVAL_MIN;
  if (!['en', 'zh'].includes(settings.langPref)) settings.langPref = 'en';
  if (!['light', 'dark', 'auto'].includes(settings.themePref)) settings.themePref = 'auto';
  const key = raw.tv_license?.key, v = key ? await Lic.verify(key, CONFIG.SECRET) : { ok: false };
  const plan = v.ok && v.plan === 'pro' ? 'pro' : 'free'; settings.plan = plan;
  I18N.setPref(settings.langPref);
  return { sessions: records.values.sort((a, b) => b.createdAt - a.createdAt), settings, plan, raw, invalid: records.invalid, license: v.ok ? v : null };
}
const capsFor = s => s.plan === 'pro' ? CONFIG.PRO : CONFIG.FREE;
const snapshot = s => ({ sessions: s.sessions, settings: s.settings, plan: s.plan, license: s.license, recoveryAvailable: s.invalid });
async function writeSessions(s) {
  await Data.protect(s.raw, [STORE_SESSIONS], 'tv_recovery_backup_v1', s.invalid);
  await chrome.storage.local.set({ [STORE_SESSIONS]: s.sessions });
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
const tabSig = tabs => JSON.stringify(tabs.map(t => [t.url, t.pinned, t.title]));
async function currentTabs(windowId) {
  const tabs = await chrome.tabs.query(Number.isInteger(windowId) ? { windowId } : { lastFocusedWindow: true });
  return tabs.filter(t => Data.http(t.url));
}
function insertSession(s, tabs, { auto = false, windowId, name } = {}) {
  if (!tabs.length) Data.fail('empty', I18N.t('tNoTabs'));
  if (auto && (!s.settings.autoOn || !capsFor(s).auto)) Data.fail('pro', I18N.t('tAutoPro'));
  if (!auto && s.sessions.filter(x => !x.auto).length >= capsFor(s).maxManualSessions) Data.fail('limit', I18N.t('tFreeLimit', { max: CONFIG.FREE.maxManualSessions }));
  const cleanTabs = tabs.map(Data.tab);
  if (auto) {
    const last = s.sessions.find(x => x.auto && x.windowId === windowId);
    if (last && tabSig(last.tabs) === tabSig(cleanTabs)) return { session: last, skipped: true };
  }
  const session = Data.session({ id: Data.id(), name: name || (auto ? I18N.t('autoName', { time: new Date().toLocaleString(I18N.lang()==='zh'?'zh-CN':'en-US') }) : sessionName(cleanTabs)),
    createdAt: Date.now(), auto, tabs: cleanTabs, ...(Number.isInteger(windowId) ? { windowId } : {}) });
  if (auto) {
    const manual = s.sessions.filter(x => !x.auto);
    const history = [session, ...s.sessions.filter(x => x.auto)].slice(0, capsFor(s).keepAutoBackups);
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
async function saveWindow(s, { auto = false, windowId, andClose = false } = {}) {
  const tabs = await currentTabs(windowId);
  const result = insertSession(s, tabs.map(t => ({ ...t, fav: t.favIconUrl || '' })), { auto, windowId: windowId ?? tabs[0]?.windowId });
  if (!result.skipped) await writeSessions(s);
  // Only close tabs after successful durable storage; retain the first tab.
  if (andClose && tabs.length > 1) await chrome.tabs.remove(tabs.slice(1).map(t => t.id));
  return result;
}
async function restoreSession(s, id, here, windowId) {
  const session = s.sessions.find(x => x.id === id); if (!session) Data.fail('missing', I18N.t('missingSession'));
  let targetWindow = windowId, restored = 0;
  if (!here) { const win = await chrome.windows.create({ url: 'about:blank' }); targetWindow = win.id; }
  // Explicit windowId prevents focus changes from splitting a restore across windows.
  try {
    for (const tab of session.tabs) { await chrome.tabs.create({ windowId: targetWindow, url: tab.url, pinned: tab.pinned, active: false }); restored++; }
  } catch { Data.fail('restore', I18N.t('restorePartial',{n:restored,total:session.tabs.length})); }
  if (!here) {
    const blanks = (await chrome.tabs.query({ windowId: targetWindow })).filter(t => t.url === 'about:blank');
    if (blanks.length) await chrome.tabs.remove(blanks.map(t => t.id));
  }
  if (s.settings.delAfterRestore && !session.auto) { s.sessions = s.sessions.filter(x => x.id !== id); await writeSessions(s); }
  return { restored };
}
async function dispatch(op, p = {}) {
  const s = await readState(); let extra = {};
  if (op === 'READ') { /* Reading never writes stale page state. */ }
  else if (op === 'SAVE_WINDOW') extra = await saveWindow(s, p);
  else if (op === 'PASTE') { extra = insertSession(s, p.tabs || []); await writeSessions(s); }
  else if (op === 'DELETE') { s.sessions = s.sessions.filter(x => x.id !== p.id); await writeSessions(s); }
  else if (op === 'RENAME') {
    const session = s.sessions.find(x => x.id === p.id); if (!session || session.auto) Data.fail('missing', 'Session no longer exists');
    if (typeof p.name !== 'string' || !p.name.trim()) Data.fail('invalid', I18N.t('nameRequired')); session.name = p.name.trim().slice(0, 80); await writeSessions(s);
  }
  else if (op === 'RESTORE') extra = await restoreSession(s, p.id, p.here, p.windowId);
  else if (op === 'IMPORT') {
    if (!capsFor(s).export) Data.fail('pro', I18N.t('tImportPro'));
    if (!Data.object(p.data) || (p.data.app && p.data.app !== 'tabvault')) Data.fail('invalid', I18N.t('tBadFile'));
    const sessions = Data.records(p.data.sessions, Data.session, true).values, ids = new Set(s.sessions.map(x => x.id));
    const incoming = sessions.filter(x => !ids.has(x.id));
    s.sessions = [...incoming, ...s.sessions].sort((a, b) => b.createdAt - a.createdAt); await writeSessions(s); extra.imported = incoming.length;
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
    if (tabs.length) cache[win.id] = tabs;
  }
  await chrome.storage.local.set({ tv_window_cache: cache });
}
let cacheTimer;
function scheduleCache() { clearTimeout(cacheTimer); cacheTimer = setTimeout(() => serialize(refreshWindowCaches).catch(console.warn), 500); }
chrome.tabs.onCreated.addListener(() => { updateTabBadge(); scheduleCache(); });
chrome.tabs.onUpdated.addListener(() => { updateTabBadge(); scheduleCache(); });
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
    for (const win of windows) { try { await saveWindow(s, { auto: true, windowId: win.id }); } catch(e) { console.warn('backup:', e.message); } }
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
