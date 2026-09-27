// ============================================================
//  sidepanel.js  —  TabVault 主逻辑（会话保存/恢复/搜索/门控）
// ============================================================
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const STORE_SESSIONS = "tv_sessions";
const STORE_SETTINGS = "tv_settings";
const STORE_LICENSE = "tv_license";

const state = {
  sessions: [],
  settings: { autoOn: false, intervalMin: CONFIG.AUTO_INTERVAL_MIN, delAfterRestore: false, plan: "free" },
  plan: "free",
  query: "",
};

// ---------- 基础工具 ----------
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 6e4) return "刚刚";
  if (d < 36e5) return Math.floor(d / 6e4) + " 分钟前";
  if (d < 864e5) return Math.floor(d / 36e5) + " 小时前";
  return new Date(ts).toLocaleDateString() + " " + new Date(ts).toLocaleTimeString().slice(0, 5);
}
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toast._h); toast._h = setTimeout(() => t.classList.add("hidden"), 2600); }
function isPro() { return state.plan === "pro"; }
function caps() { return isPro() ? CONFIG.PRO : CONFIG.FREE; }

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
  await chrome.storage.local.set({ [STORE_SETTINGS]: state.settings });
}
async function saveSessions() {
  await chrome.storage.local.set({ [STORE_SESSIONS]: state.sessions });
  chrome.runtime.sendMessage({ type: "SETTINGS_CHANGED" }).catch(() => {}); // 让角标/备份同步
}

// ---------- 门控 ----------
function upgradeNeeded(why) {
  toast(why || "此功能属于 Pro");
  openDrawer();
}
function manualCount() { return state.sessions.filter((s) => !s.auto).length; }

// ---------- 会话操作 ----------
async function currentWindowTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.filter((t) => t.url && /^https?:/i.test(t.url));
}
function sessionName(tabs) {
  const hosts = [...new Set(tabs.map((t) => { try { return new URL(t.url).hostname.replace(/^www\./, ""); } catch { return ""; } }))].filter(Boolean);
  const head = hosts.slice(0, 3).join(", ");
  return `${head || "窗口"}${hosts.length > 3 ? ` +${hosts.length - 3}` : ""} · ${tabs.length} 个标签`;
}

async function saveWindow({ andClose = false } = {}) {
  const tabs = await currentWindowTabs();
  if (!tabs.length) return toast("当前窗口没有可保存的网页标签");
  if (!isPro() && manualCount() >= caps().maxManualSessions) {
    return upgradeNeeded(`免费版最多 ${caps().maxManualSessions} 个手动会话，删除旧的或升级 Pro`);
  }
  const seen = new Set();
  const session = {
    id: uid(),
    name: sessionName(tabs),
    createdAt: Date.now(),
    auto: false,
    tabs: tabs.filter((t) => !seen.has(t.url) && seen.add(t.url)).map((t) => ({ title: t.title || t.url, url: t.url })),
  };
  state.sessions.unshift(session);
  await saveSessions();
  render();
  toast(`已保存 ${session.tabs.length} 个标签`);
  if (andClose) {
    const keep = new Set([tabs[0].id]);
    await chrome.tabs.remove(tabs.filter((t) => !keep.has(t.id)).map((t) => t.id)).catch(() => {});
    toast(`已保存并释放 ${tabs.length - 1} 个标签的内存`);
    render();
  }
}

async function restoreSession(id) {
  const s = state.sessions.find((x) => x.id === id);
  if (!s) return;
  await chrome.windows.create({ url: s.tabs.map((t) => t.url) });
  if (state.settings.delAfterRestore && !s.auto) {
    state.sessions = state.sessions.filter((x) => x.id !== id);
    await saveSessions();
  }
  render();
  toast(`已恢复 ${s.tabs.length} 个标签`);
}

async function deleteSession(id) {
  const s = state.sessions.find((x) => x.id === id);
  if (!s) return;
  if (!confirm(`删除「${s.name}」？`)) return;
  state.sessions = state.sessions.filter((x) => x.id !== id);
  await saveSessions();
  render();
}

async function renameSession(id) {
  const s = state.sessions.find((x) => x.id === id);
  if (!s || s.auto) return;
  const name = prompt("会话名称", s.name);
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
  $("#planBadge").textContent = isPro() ? "PRO" : "FREE";
  $("#planBadge").className = "plan " + (isPro() ? "plan-pro" : "plan-free");
  $("#btnSaveClose").title = "保存当前窗口后关闭其余标签，释放内存";

  const q = state.query;
  const list = state.sessions
    .map((s) => {
      if (!q) return { s, tabs: s.tabs };
      const hit = s.tabs.filter((t) => (t.title + " " + t.url).toLowerCase().includes(q.toLowerCase()));
      return (s.name.toLowerCase().includes(q.toLowerCase()) || hit.length) ? { s, tabs: hit.length ? hit : s.tabs } : null;
    })
    .filter(Boolean);

  const el = $("#sessionList");
  if (!list.length) {
    el.innerHTML = `<div class="empty">${q ? "没有匹配的会话或标签" : "还没有会话<br>点上方按钮或按 <b>Alt+Shift+S</b><br>把当前窗口整个存进来"}</div>`;
  } else {
    el.innerHTML = list.map(({ s, tabs }) => `
      <div class="session ${s.auto ? "auto" : ""}" data-id="${s.id}">
        <div class="sess-head">
          <span class="sess-name" title="点击重命名">${hl(s.name)}</span>
          ${s.auto ? '<span class="badge-auto">自动</span>' : ""}
          <span class="sess-count">${s.tabs.length}</span>
          <span class="sess-time">${timeAgo(s.createdAt)}</span>
        </div>
        <ul class="sess-tabs">${tabs.slice(0, 12).map((t) => `
          <li><span class="fav"></span><a href="${esc(t.url)}" target="_blank" rel="noopener" title="${esc(t.url)}">${hl(t.title)}</a></li>`).join("")}
          ${tabs.length > 12 ? `<li><span class="fav" style="opacity:.3"></span><span style="color:var(--muted);font-size:12px">…还有 ${tabs.length - 12} 个</span></li>` : ""}
        </ul>
        <div class="sess-actions">
          <button class="restore-btn" data-act="restore">恢复全部</button>
          <button class="ghost-btn" data-act="toggle">${q ? "" : "展开/收起"}</button>
          ${s.auto ? "" : '<button class="ghost-btn del" data-act="del">删除</button>'}
        </div>
      </div>`).join("");
    // 搜索态默认展开命中项
    if (q) $$(".session").forEach((n) => n.classList.add("open"));
  }

  const total = state.sessions.reduce((n, s) => n + s.tabs.length, 0);
  $("#counter").textContent = `${manualCount()} / ${isPro() ? "∞" : caps().maxManualSessions} 会话 · ${total} 标签`;

  $("#searchBox").placeholder = isPro() ? "搜索所有会话里的标签…" : "跨会话搜索属于 Pro 🔒";
  $("#chkAuto").checked = !!state.settings.autoOn && isPro();
  $("#chkAuto").disabled = !isPro();
  $("#chkDelAfterRestore").checked = !!state.settings.delAfterRestore;
  $("#lblInterval").textContent = state.settings.intervalMin || CONFIG.AUTO_INTERVAL_MIN;
  $("#btnBuy").href = CONFIG.STRIPE_PAYMENT_LINK;
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
  if (!caps().export) return upgradeNeeded("导出备份属于 Pro");
  const blob = new Blob([JSON.stringify({ app: "tabvault", v: 1, sessions: state.sessions }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tabvault-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
$("#btnImport").addEventListener("click", () => { if (!caps().export) return upgradeNeeded("导入备份属于 Pro"); $("#fileImport").click(); });
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
    toast(`导入 ${data.sessions.length} 个会话`);
  } catch { toast("文件格式不对"); }
  e.target.value = "";
});

// ---------- 抽屉 / 授权 ----------
function openDrawer() { $("#drawer").classList.remove("hidden"); }
$("#btnUpgrade").addEventListener("click", openDrawer);
$("#btnCloseDrawer").addEventListener("click", () => $("#drawer").classList.add("hidden"));

$("#btnActivate").addEventListener("click", async () => {
  const key = $("#licenseInput").value.trim();
  if (!key) return licStatus("先粘贴 Key", false);
  const v = await Lic.verify(key, CONFIG.SECRET);
  if (!v.ok) return licStatus("Key 无效或已过期", false);
  await chrome.storage.local.set({ [STORE_LICENSE]: { key, plan: v.plan, label: v.label, exp: v.exp } });
  licStatus(`激活成功（${v.label || v.plan}）`, true);
  await load();
  render();
});
$("#btnDeactivate").addEventListener("click", async () => {
  await chrome.storage.local.remove(STORE_LICENSE);
  licStatus("已解除本设备", true);
  await load();
  render();
});
function licStatus(text, ok) {
  const el = $("#licStatus");
  el.textContent = text;
  el.className = "lic-status " + (ok ? "ok" : "err");
}

$("#chkAuto").addEventListener("change", async (e) => {
  if (!isPro()) { e.target.checked = false; return upgradeNeeded("自动备份属于 Pro"); }
  state.settings.autoOn = e.target.checked;
  await chrome.storage.local.set({ [STORE_SETTINGS]: state.settings });
  chrome.runtime.sendMessage({ type: "SETTINGS_CHANGED" }).catch(() => {});
  toast(e.target.checked ? `每 ${state.settings.intervalMin} 分钟自动备份当前窗口` : "自动备份已关闭");
});
$("#chkDelAfterRestore").addEventListener("change", async (e) => {
  state.settings.delAfterRestore = e.target.checked;
  await chrome.storage.local.set({ [STORE_SETTINGS]: state.settings });
});

// ---------- 事件绑定 ----------
$("#btnSave").addEventListener("click", () => saveWindow());
$("#btnSaveClose").addEventListener("click", () => saveWindow({ andClose: true }));
$("#btnExport").addEventListener("click", exportAll);
$("#searchBox").addEventListener("input", (e) => {
  if (!isPro() && e.target.value) { e.target.value = ""; state.query = ""; return upgradeNeeded("跨会话搜索属于 Pro"); }
  state.query = e.target.value.trim();
  render();
});
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && (msg.type === "SESSIONS_CHANGED" || msg.type === "SETTINGS_CHANGED")) load().then(render);
});

// ---------- 预览演示数据（仅 ?demo= 生效，不影响正常使用） ----------
const demo = (location.search.match(/demo=(\w+)/) || [])[1];
async function seedDemo() {
  const mk = (name, host, n, agoH) => ({
    id: uid(), name, createdAt: Date.now() - agoH * 36e5, auto: false,
    tabs: Array.from({ length: n }, (_, i) => ({ title: `${host} page ${i + 1} — reading list`, url: `https://${host}.com/${name.slice(0, 3)}-${i}` })),
  });
  state.sessions = [
    mk("Q4 规划调研", "notion", 8, 1),
    mk("竞品 + 设计参考", "figma", 12, 5),
    { id: uid(), name: "Auto backup · 今天 14:30", createdAt: Date.now() - 2 * 36e5, auto: true, tabs: Array.from({ length: 5 }, (_, i) => ({ title: `HN discussion ${i + 1}`, url: `https://news.ycombinator.com/item?id=${100 + i}` })) },
    mk("写稿资料", "github", 6, 26),
    mk("旅行计划", "google", 4, 50),
    mk("周报模板搜索", "linear", 7, 74),
    mk("旧项目收尾", "figma", 3, 98),
  ];
  if (demo === "pro" || demo === "paywall") { state.plan = "pro"; state.settings.plan = "pro"; }
  if (demo === "paywall") { $("#drawer").classList.remove("hidden"); }
}

(async function init() {
  await load();
  if (demo) await seedDemo();
  render();
})();
