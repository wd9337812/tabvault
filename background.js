// ============================================================
//  background.js  —  TabVault service worker (MV3)
// ============================================================
//  职责：侧边栏行为、快捷键保存、自动备份 alarm、角标。
//  数据与 UI 都在 sidepanel.js；这里只做"面板没打开也得干活"的部分。
//  文案：service worker 里没有 navigator.language，所以语言取面板写回的
//  tv_settings.langResolved（默认 en）。

importScripts("i18n.js");

const STORE_SESSIONS = "tv_sessions";
const STORE_SETTINGS = "tv_settings";
const ALARM_AUTOSAVE = "tv-autosave";

async function syncLang() {
  try {
    const d = await chrome.storage.local.get(STORE_SETTINGS);
    const s = (d && d[STORE_SETTINGS]) || {};
    I18N.setPref(s.langResolved || s.langPref || "auto");
  } catch { /* 首次运行没有设置，用默认 en */ }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.warn("sidePanel behavior:", e));
  syncAlarm();
});
chrome.runtime.onStartup.addListener(syncAlarm);

// ---------- 工具 ----------
async function getLocal(keys) {
  return chrome.storage.local.get(keys);
}

function isSaveableUrl(u) {
  return !!u && /^https?:/i.test(u);
}

function tabSig(tabs) {
  return tabs.map((t) => t.url).sort().join("|");
}

async function snapshotActiveWindow() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.filter((t) => isSaveableUrl(t.url)).map((t) => ({ title: t.title || t.url, url: t.url }));
}

function sessionName(tabs) {
  try {
    const hosts = [...new Set(tabs.map((t) => { try { return new URL(t.url).hostname.replace(/^www\./, ""); } catch { return ""; } }))].filter(Boolean);
    const head = hosts.slice(0, 3).join(", ");
    return `${head || I18N.t("windowWord")}${hosts.length > 3 ? ` +${hosts.length - 3}` : ""} ${I18N.t("tabsSuffix", { n: tabs.length })}`;
  } catch {
    return `${I18N.t("windowWord")} ${new Date().toLocaleString()}`;
  }
}

async function updateBadge() {
  const { [STORE_SESSIONS]: list } = await getLocal([STORE_SESSIONS]);
  const n = (list || []).filter((s) => !s.auto).length;
  chrome.action.setBadgeText({ text: n ? (n > 99 ? "99+" : String(n)) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#6d5efc" });
}

// ---------- 保存会话（快捷键 / 面板共用逻辑的核心） ----------
async function saveCurrentWindow({ auto = false } = {}) {
  await syncLang();
  const tabs = await snapshotActiveWindow();
  if (!tabs.length) return { ok: false, reason: "empty" };

  const { [STORE_SESSIONS]: sessions = [], [STORE_SETTINGS]: settings = {} } = await getLocal([STORE_SESSIONS, STORE_SETTINGS]);

  if (auto) {
    // 与最近一份自动备份相同则跳过；不同则替换（滚动保留 keepAutoBackups 份）
    const lastAuto = sessions.find((s) => s.auto);
    if (lastAuto && tabSig(lastAuto.tabs) === tabSig(tabs)) return { ok: true, skipped: true };
    const keep = settings.autoOn ? 20 : 1;
    const others = sessions.filter((s) => !s.auto);
    const fresh = { id: "auto_" + Date.now(), name: I18N.t("autoName", { time: new Date().toLocaleString() }), createdAt: Date.now(), auto: true, tabs };
    const trimmed = [fresh, ...others.filter((s) => Date.now() - s.createdAt < 30 * 864e5)].slice(0, others.length + keep);
    await chrome.storage.local.set({ [STORE_SESSIONS]: trimmed });
    notifyPanel();
    return { ok: true, auto: true };
  }

  const session = { id: "s" + Date.now(), name: sessionName(tabs), createdAt: Date.now(), auto: false, tabs };
  sessions.unshift(session);
  await chrome.storage.local.set({ [STORE_SESSIONS]: sessions });
  updateBadge();
  notifyPanel();
  return { ok: true, session };
}

function notifyPanel() {
  chrome.runtime.sendMessage({ type: "SESSIONS_CHANGED" }).catch(() => {});
}

// ---------- alarm 调度 ----------
async function syncAlarm() {
  const { [STORE_SETTINGS]: settings = {} } = await getLocal([STORE_SETTINGS]);
  if (settings.autoOn && settings.plan === "pro") {
    chrome.alarms.create(ALARM_AUTOSAVE, { periodInMinutes: settings.intervalMin || 15 });
  } else {
    chrome.alarms.clear(ALARM_AUTOSAVE);
  }
}
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "SETTINGS_CHANGED") { syncAlarm(); updateBadge(); }
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM_AUTOSAVE) saveCurrentWindow({ auto: true });
});

// ---------- 快捷键 ----------
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "save-session") saveCurrentWindow();
});

updateBadge();
