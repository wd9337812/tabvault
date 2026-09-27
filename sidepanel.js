// ============================================================
//  sidepanel.js  —  TabVault 主逻辑（会话保存/恢复/搜索/门控）
//  文案全部走 I18N.t()（见 i18n.js），按浏览器语言自动 en / zh。
// ============================================================
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const STORE_SESSIONS = "tv_sessions";
const STORE_SETTINGS = "tv_settings";
const STORE_LICENSE = "tv_license";

const state = {
  sessions: [],
  settings: { autoOn: false, intervalMin: CONFIG.AUTO_INTERVAL_MIN, delAfterRestore: false, plan: "free", langPref: "auto", themePref: "auto" },
  plan: "free",
  query: "",
};

const t = (k, v) => I18N.t(k, v);

// ---------- 基础工具 ----------
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 6e4) return t("justNow");
  if (d < 36e5) return t("minAgo", { n: Math.floor(d / 6e4) });
  if (d < 864e5) return t("hrAgo", { n: Math.floor(d / 36e5) });
  return new Date(ts).toLocaleDateString() + " " + new Date(ts).toLocaleTimeString().slice(0, 5);
}
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.remove("hidden"); clearTimeout(toast._h); toast._h = setTimeout(() => el.classList.add("hidden"), 2600); }
function isPro() { return state.plan === "pro"; }
function caps() { return isPro() ? CONFIG.PRO : CONFIG.FREE; }
function intervalMin() { return state.settings.intervalMin || CONFIG.AUTO_INTERVAL_MIN; }

// ---------- 主题（auto 跟随系统，可手动固定 light/dark） ----------
const MQ_LIGHT = matchMedia("(prefers-color-scheme: light)");
function themePref() { const p = state.settings.themePref; return p === "light" || p === "dark" ? p : "auto"; }
function resolveTheme() { return themePref() === "auto" ? (MQ_LIGHT.matches ? "light" : "dark") : themePref(); }
function applyTheme() { document.documentElement.dataset.theme = resolveTheme(); }
MQ_LIGHT.addEventListener("change", () => { if (themePref() === "auto") applyTheme(); });

async function load() {
  const d = await chrome.storage.local.get([STORE_SESSIONS, STORE_SETTINGS, STORE_LICENSE]);
  state.sessions = d[STORE_SESSIONS] || [];
  Object.assign(state.settings, d[STORE_SETTINGS] || {});
  if (d[STORE_LICENSE] && d[STORE_LICENSE].key) {
    const v = await Lic.verify(d[STORE_LICENSE].key, CONFIG.SECRET);
    state.plan = v.ok ? (v.plan || "pro") : "free";
    if (!v.ok) await chrome.storage.local.remove(STORE_LICENSE);
  }
  state.settings.plan = state.plan;
  // 语言：?lang= 只用于截图/调试，不写回存储
  const forced = (location.search.match(/lang=(\w+)/) || [])[1];
  I18N.setPref(forced || state.settings.langPref || "auto");
  state.settings.langPref = forced || state.settings.langPref || "auto";
  state.settings.langResolved = I18N.lang();          // service worker 命名自动备份用
  document.documentElement.lang = state.settings.langResolved;
  // 主题：?theme= 只用于截图/调试，不写回存储
  const forcedTheme = (location.search.match(/theme=(light|dark)/) || [])[1];
  if (forcedTheme) document.documentElement.dataset.theme = forcedTheme;
  else applyTheme();
  await chrome.storage.local.set({ [STORE_SETTINGS]: state.settings });
}
async function saveSessions() {
  await chrome.storage.local.set({ [STORE_SESSIONS]: state.sessions });
  chrome.runtime.sendMessage({ type: "SETTINGS_CHANGED" }).catch(() => {}); // 让角标/备份同步
}

// ---------- 门控 ----------
function upgradeNeeded(why) {
  toast(why || t("tProOnly"));
  openDrawer();
}
function manualCount() { return state.sessions.filter((s) => !s.auto).length; }

// ---------- 会话操作 ----------
async function currentWindowTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.filter((tab) => tab.url && /^https?:/i.test(tab.url));
}
function sessionName(tabs) {
  const hosts = [...new Set(tabs.map((x) => { try { return new URL(x.url).hostname.replace(/^www\./, ""); } catch { return ""; } }))].filter(Boolean);
  const head = hosts.slice(0, 3).join(", ");
  return `${head || t("windowWord")}${hosts.length > 3 ? ` +${hosts.length - 3}` : ""} ${t("tabsSuffix", { n: tabs.length })}`;
}

async function saveWindow({ andClose = false } = {}) {
  const tabs = await currentWindowTabs();
  if (!tabs.length) return toast(t("tNoTabs"));
  if (!isPro() && manualCount() >= caps().maxManualSessions) {
    return upgradeNeeded(t("tFreeLimit", { max: caps().maxManualSessions }));
  }
  const seen = new Set();
  const session = {
    id: uid(),
    name: sessionName(tabs),
    createdAt: Date.now(),
    auto: false,
    tabs: tabs.filter((x) => !seen.has(x.url) && seen.add(x.url)).map((x) => ({ title: x.title || x.url, url: x.url, fav: x.favIconUrl || "" })),
  };
  state.sessions.unshift(session);
  await saveSessions();
  render();
  toast(t("tSaved", { n: session.tabs.length }));
  if (andClose) {
    const keep = new Set([tabs[0].id]);
    await chrome.tabs.remove(tabs.filter((x) => !keep.has(x.id)).map((x) => x.id)).catch(() => {});
    toast(t("tSavedClosed", { n: tabs.length - 1 }));
    render();
  }
}

async function restoreSession(id) {
  const s = state.sessions.find((x) => x.id === id);
  if (!s) return;
  await chrome.windows.create({ url: s.tabs.map((x) => x.url) });
  if (state.settings.delAfterRestore && !s.auto) {
    state.sessions = state.sessions.filter((x) => x.id !== id);
    await saveSessions();
  }
  render();
  toast(t("tRestored", { n: s.tabs.length }));
}

async function deleteSession(id) {
  const s = state.sessions.find((x) => x.id === id);
  if (!s) return;
  if (!confirm(t("tDelConfirm", { name: s.name }))) return;
  state.sessions = state.sessions.filter((x) => x.id !== id);
  await saveSessions();
  render();
}

async function renameSession(id) {
  const s = state.sessions.find((x) => x.id === id);
  if (!s || s.auto) return;
  const name = prompt(t("tRenamePrompt"), s.name);
  if (name && name.trim()) { s.name = name.trim().slice(0, 80); await saveSessions(); render(); }
}

// ---------- 渲染 ----------
function hl(text) {
  if (!state.query) return esc(text);
  const i = text.toLowerCase().indexOf(state.query.toLowerCase());
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + state.query.length)) + "</mark>" + esc(text.slice(i + state.query.length));
}

function render() {
  I18N.applyI18n();
  $("#planBadge").textContent = isPro() ? "PRO" : "FREE";
  $("#planBadge").className = "plan " + (isPro() ? "plan-pro" : "plan-free");

  const q = state.query;
  const list = state.sessions
    .map((s) => {
      if (!q) return { s, tabs: s.tabs };
      const hit = s.tabs.filter((x) => (x.title + " " + x.url).toLowerCase().includes(q.toLowerCase()));
      return (s.name.toLowerCase().includes(q.toLowerCase()) || hit.length) ? { s, tabs: hit.length ? hit : s.tabs } : null;
    })
    .filter(Boolean);

  const el = $("#sessionList");
  if (!list.length) {
    el.innerHTML = `<div class="empty"><div class="empty-ico">${q ? "🔍" : "🗂"}</div>${q ? t("emptySearch") : t("empty")}</div>`;
  } else {
    el.innerHTML = list.map(({ s, tabs }) => `
      <div class="session ${s.auto ? "auto" : ""}" data-id="${s.id}">
        <div class="sess-head">
          <span class="sess-name" title="${esc(t("renameTip"))}">${hl(s.name)}</span>
          ${s.auto ? `<span class="badge-auto">${esc(t("auto"))}</span>` : ""}
          <span class="sess-count">${s.tabs.length}</span>
          <span class="sess-time">${timeAgo(s.createdAt)}</span>
        </div>
        <ul class="sess-tabs">${tabs.slice(0, 12).map((x) => `
          <li><span class="fav">${x.fav ? `<img src="${esc(x.fav)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span><a href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.url)}">${hl(x.title)}</a></li>`).join("")}
          ${tabs.length > 12 ? `<li><span class="fav" style="opacity:.3"></span><span style="color:var(--muted);font-size:12px">${esc(t("more", { n: tabs.length - 12 }))}</span></li>` : ""}
        </ul>
        <div class="sess-actions">
          <button class="restore-btn" data-act="restore">${esc(t("restoreAll"))}</button>
          <button class="ghost-btn" data-act="toggle">${q ? "" : esc(t("toggle"))}</button>
          ${s.auto ? "" : `<button class="ghost-btn del" data-act="del">${esc(t("del"))}</button>`}
        </div>
      </div>`).join("");
    // 搜索态默认展开命中项
    if (q) $$(".session").forEach((n) => n.classList.add("open"));
  }

  const total = state.sessions.reduce((n, s) => n + s.tabs.length, 0);
  $("#counter").textContent = t("counter", { n: manualCount(), max: isPro() ? "∞" : caps().maxManualSessions, tabs: total });

  $("#searchBox").placeholder = isPro() ? t("searchPro") : t("searchLocked");
  $("#chkAuto").checked = !!state.settings.autoOn && isPro();
  $("#chkAuto").disabled = !isPro();
  $("#chkDelAfterRestore").checked = !!state.settings.delAfterRestore;
  $("#lblInterval").textContent = intervalMin();
  $("#btnBuy").href = CONFIG.STRIPE_PAYMENT_LINK;
  $("#selLang").value = state.settings.langPref || "auto";
  $("#selTheme").value = themePref();
  // 抽屉里的数量/间隔提示跟随实际配置
  $$("[data-i18n='p1']").forEach((n) => (n.innerHTML = t("p1", { max: CONFIG.FREE.maxManualSessions })));
  $$("[data-i18n='p2']").forEach((n) => (n.innerHTML = t("p2", { n: intervalMin() })));
}

$("#sessionList").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  const card = e.target.closest(".session");
  if (!card) return;
  const id = card.dataset.id;
  if (btn) {
    if (btn.dataset.act === "restore") return restoreSession(id);
    if (btn.dataset.act === "del") return deleteSession(id);
    if (btn.dataset.act === "toggle") return card.classList.toggle("open");
  } else if (e.target.closest(".sess-name")) {
    return renameSession(id);
  }
});

// ---------- 导入 / 导出 ----------
function exportAll() {
  if (!caps().export) return upgradeNeeded(t("tExportPro"));
  const blob = new Blob([JSON.stringify({ app: "tabvault", v: 1, sessions: state.sessions }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tabvault-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
$("#btnImport").addEventListener("click", () => { if (!caps().export) return upgradeNeeded(t("tImportPro")); $("#fileImport").click(); });
$("#fileImport").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.sessions)) throw 0;
    const have = new Set(state.sessions.map((s) => s.id));
    state.sessions = [...data.sessions.filter((s) => !have.has(s.id)), ...state.sessions].sort((a, b) => b.createdAt - a.createdAt);
    await saveSessions();
    render();
    toast(t("tImported", { n: data.sessions.length }));
  } catch { toast(t("tBadFile")); }
  e.target.value = "";
});

// ---------- 抽屉 / 授权 ----------
function openDrawer() { $("#drawer").classList.remove("hidden"); }
$("#btnUpgrade").addEventListener("click", openDrawer);
$("#btnCloseDrawer").addEventListener("click", () => $("#drawer").classList.add("hidden"));

$("#btnActivate").addEventListener("click", async () => {
  const key = $("#licenseInput").value.trim();
  if (!key) return licStatus(t("licPasteFirst"), false);
  const v = await Lic.verify(key, CONFIG.SECRET);
  if (!v.ok) return licStatus(t("licInvalid"), false);
  await chrome.storage.local.set({ [STORE_LICENSE]: { key, plan: v.plan, label: v.label, exp: v.exp } });
  licStatus(t("licActivated", { label: v.label || v.plan }), true);
  await load();
  render();
});
$("#btnDeactivate").addEventListener("click", async () => {
  await chrome.storage.local.remove(STORE_LICENSE);
  licStatus(t("licDeactivated"), true);
  await load();
  render();
});
function licStatus(text, ok) {
  const el = $("#licStatus");
  el.textContent = text;
  el.className = "lic-status " + (ok ? "ok" : "err");
}

$("#chkAuto").addEventListener("change", async (e) => {
  if (!isPro()) { e.target.checked = false; return upgradeNeeded(t("tAutoPro")); }
  state.settings.autoOn = e.target.checked;
  await chrome.storage.local.set({ [STORE_SETTINGS]: state.settings });
  chrome.runtime.sendMessage({ type: "SETTINGS_CHANGED" }).catch(() => {});
  toast(e.target.checked ? t("tAutoOn", { n: intervalMin() }) : t("tAutoOff"));
});
$("#chkDelAfterRestore").addEventListener("change", async (e) => {
  state.settings.delAfterRestore = e.target.checked;
  await chrome.storage.local.set({ [STORE_SETTINGS]: state.settings });
});
$("#selLang").addEventListener("change", async (e) => {
  state.settings.langPref = e.target.value;
  state.settings.langResolved = (I18N.setPref(e.target.value), I18N.lang());
  document.documentElement.lang = state.settings.langResolved;
  await chrome.storage.local.set({ [STORE_SETTINGS]: state.settings });
  chrome.runtime.sendMessage({ type: "SETTINGS_CHANGED" }).catch(() => {});
  render();
});
$("#selTheme").addEventListener("change", async (e) => {
  state.settings.themePref = e.target.value;
  applyTheme();
  await chrome.storage.local.set({ [STORE_SETTINGS]: state.settings });
});

// ---------- 事件绑定 ----------
$("#btnSave").addEventListener("click", () => saveWindow());
$("#btnSaveClose").addEventListener("click", () => saveWindow({ andClose: true }));
$("#btnExport").addEventListener("click", exportAll);
$("#searchBox").addEventListener("input", (e) => {
  if (!isPro() && e.target.value) { e.target.value = ""; state.query = ""; return upgradeNeeded(t("tSearchPro")); }
  state.query = e.target.value.trim();
  render();
});
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && (msg.type === "SESSIONS_CHANGED" || msg.type === "SETTINGS_CHANGED")) load().then(render);
});

// ---------- 预览演示数据（仅 ?demo= 生效，不影响正常使用） ----------
const demo = (location.search.match(/demo=(\w+)/) || [])[1];
const DEMO_POOL_EN = [
  ["Notion — Q4 roadmap draft", "https://notion.so/wd/q4-roadmap"],
  ["Figma — Session card UI v3", "https://figma.com/file/session-card-ui"],
  ["GitHub — tabvault / issues", "https://github.com/wd9337812/tabvault/issues"],
  ["Stripe docs — Checkout sessions", "https://docs.stripe.com/api/checkout/sessions"],
  ["HN — Show HN: I got tired of losing tabs", "https://news.ycombinator.com/item?id=42000123"],
  ["Google Flights — SFO → LIS, Nov 12", "https://www.google.com/travel/flights"],
  ["Longreads — Deep Work in a Noisy World", "https://longreads.com/2026/09/deep-work"],
  ["Linear — Backlog grooming", "https://linear.app/team/backlog"],
  ["Gmail — Inbox (14 unread)", "https://mail.google.com/mail/u/0"],
  ["MDN — chrome.storage API", "https://developer.mozilla.org/en-US/docs/Mozilla/Extensions/Chrome/chrome.storage"],
  ["Notion — Competitor pricing matrix", "https://notion.so/wd/pricing-matrix"],
  ["YouTube — MV3 service worker lifecycle", "https://youtube.com/watch?v=tabvault-demo"],
  ["Chrome docs — Side Panel API", "https://developer.chrome.com/docs/extensions/reference/api/sidePanel"],
  ["Reddit — r/productivity: tab overload", "https://reddit.com/r/productivity/comments/tab-overload"],
];
const DEMO_POOL_ZH = [
  ["Notion — Q4 路线图草稿", "https://notion.so/wd/q4-roadmap"],
  ["Figma — 会话卡片 UI v3", "https://figma.com/file/session-card-ui"],
  ["GitHub — tabvault / issues", "https://github.com/wd9337812/tabvault/issues"],
  ["语雀 — 自动备份方案评审", "https://yuque.com/tabvault/auto-backup"],
  ["HN — 又丢标签页了怎么办", "https://news.ycombinator.com/item?id=42000123"],
  ["Google 机票 — SFO → LIS 11/12", "https://www.google.com/travel/flights"],
  ["少数派 — 我如何治理 60 个标签页", "https://sspai.com/post/tab-vault"],
  ["Linear — 待办梳理", "https://linear.app/team/backlog"],
  ["Gmail — 收件箱（14 封未读）", "https://mail.google.com/mail/u/0"],
  ["MDN — chrome.storage API", "https://developer.mozilla.org/en-US/docs/Mozilla/Extensions/Chrome/chrome.storage"],
  ["Notion — 竞品定价对照表", "https://notion.so/wd/pricing-matrix"],
  ["B 站 — MV3 Service Worker 生命周期", "https://bilibili.com/video/tabvault-demo"],
  ["Chrome 文档 — Side Panel API", "https://developer.chrome.com/docs/extensions/reference/api/sidePanel"],
  ["知乎 — 标签页太多怎么整理", "https://zhihu.com/question/tab-overload"],
];
async function seedDemo() {
  const zh = I18N.lang() === "zh";
  const pool = zh ? DEMO_POOL_ZH : DEMO_POOL_EN;
  // 演示数据也带真实站点 favicon（截图里列表才不像线框稿）；加载失败自动回落渐变方块
  const favOf = (url) => { try { return "https://www.google.com/s2/favicons?domain=" + new URL(url).hostname + "&sz=64"; } catch { return ""; } };
  const names = zh
    ? ["Q4 规划调研", "竞品 + 设计参考", "写稿资料", "旅行计划", "周报模板收集", "旧项目收尾"]
    : ["Q4 planning research", "Competitors + design refs", "Writing sources", "Trip planning", "Weekly report digging", "Old project wrap-up"];
  const spans = [8, 12, 6, 4, 7, 3];
  const ages = [1, 5, 26, 50, 74, 98];
  let cursor = 0;
  const mk = (idx) => ({
    id: uid(), name: names[idx], createdAt: Date.now() - ages[idx] * 36e5, auto: false,
    tabs: Array.from({ length: spans[idx] }, () => {
      const [title, url] = pool[cursor % pool.length];
      cursor += 1;
      const full = url + (url.includes("?") ? "&" : "?") + "p=" + cursor;
      return { title, url: full, fav: favOf(url) };
    }),
  });
  const autoCard = {
    id: uid(), name: zh ? "自动备份 · 今天 14:30" : "Auto backup · today 14:30",
    createdAt: Date.now() - 2 * 36e5, auto: true,
    tabs: pool.slice(4, 9).map(([title, url]) => ({ title, url, fav: favOf(url) })),
  };
  const manual = names.map((_, i) => mk(i));
  // 免费版没有自动备份，且正好卡在 5 个会话的上限
  state.sessions = demo === "free"
    ? manual.slice(0, CONFIG.FREE.maxManualSessions)
    : [manual[0], manual[1], autoCard, ...manual.slice(2)];
  if (demo === "pro" || demo === "paywall") { state.plan = "pro"; state.settings.plan = "pro"; }
  if (demo === "paywall") { $("#drawer").classList.remove("hidden"); }
}

(async function init() {
  await load();
  if (demo) await seedDemo();
  render();
  // 预览态默认展开前几张，截图里能看到标签列表
  if (demo) $$(".session").slice(0, 3).forEach((n) => n.classList.add("open"));
})();
