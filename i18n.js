// ============================================================
//  i18n.js  —  TabVault 双语文案（en / zh），按浏览器语言自动切换
// ============================================================
//  用法：I18N.t("save")、I18N.t("tSaved", { n: 8 })
//  静态 DOM 用 data-i18n / data-i18n-ph / data-i18n-title 属性 + I18N.applyI18n()
//  语言偏好存在 tv_settings.langPref（"auto" | "en" | "zh"），
//  面板每次解析完把 langResolved 也写回去，service worker 读它来命名自动备份会话
//  （service worker 里没有 navigator.language）。
//  ⚠️ 本文件同时被 sidepanel.html 与 background.js(importScripts) 加载，
//     所以不能在顶层访问 document / chrome。

const I18N = (() => {
  const dict = {
    en: {
      // top bar / capture
      save: "Save current window",
      saveTitle: "Save every tab in this window as a session (Alt+Shift+S)",
      saveClose: "Save & close",
      saveCloseTitle: "Keep the first tab, close the rest to free memory",
      searchPro: "Search all saved tabs…",
      searchLocked: "Cross-session search is Pro 🔒",
      export: "Export",
      import: "Import",
      counter: "{n} / {max} sessions · {tabs} tabs",
      // list
      empty: "No sessions yet<br>Hit the button above or press <b>Alt+Shift+S</b><br>to vault this window",
      emptySearch: "No matching session or tab",
      renameTip: "Click to rename",
      auto: "Auto",
      restoreAll: "Restore all",
      toggle: "Expand / collapse",
      del: "Delete",
      more: "…{n} more",
      justNow: "just now",
      minAgo: "{n} min ago",
      hrAgo: "{n} h ago",
      // session naming
      windowWord: "Window",
      tabsSuffix: "· {n} tabs",
      autoName: "Auto backup · {time}",
      // messages
      tNoTabs: "No web pages in this window to save",
      tFreeLimit: "Free plan holds {max} sessions — delete one or go Pro",
      tSaved: "{n} tabs saved",
      tSavedClosed: "Saved — {n} tabs closed, memory freed",
      tRestored: "{n} tabs restored",
      tDelConfirm: "Delete “{name}”?",
      tRenamePrompt: "Session name",
      tImported: "Imported {n} sessions",
      tBadFile: "That file is not a TabVault backup",
      tProOnly: "This is a Pro feature",
      tExportPro: "Exporting backups is Pro",
      tImportPro: "Importing backups is Pro",
      tAutoPro: "Auto-backup is Pro",
      tSearchPro: "Cross-session search is Pro",
      tAutoOn: "Auto-backup every {n} min",
      tAutoOff: "Auto-backup turned off",
      // license
      licPasteFirst: "Paste a key first",
      licInvalid: "Key invalid or expired",
      licActivated: "Activated ({label})",
      licDeactivated: "This device was released",
      // drawer
      proTitle: "TabVault Pro",
      p1: "Unlimited sessions (free: {max})",
      p2: "Auto-backup every {n} min — recover after a crash",
      p3: "Search across every saved tab",
      p4: "Export / import a JSON backup",
      launch: "Launch price",
      priceNow: "$6",
      priceWas: "$9",
      per: "one-time · lifetime updates",
      buy: "Buy Pro",
      buyNote: "Pay once — you get a License Key after payment, paste it below to activate.",
      haveKey: "Already have a License Key?",
      keyPh: "PRO·xxxx.yyyy pasted here",
      activate: "Activate",
      deactivate: "Release device",
      autoHead: "Auto-backup",
      autoRowA: "Vault this window every",
      autoRowB: "min (Pro)",
      delAfterRow: "Delete a session once it has been restored",
      langHead: "Language 语言",
      langAuto: "Auto (browser)",
      themeHead: "Appearance 外观",
      themeAuto: "Auto (system)",
      themeLight: "Light",
      themeDark: "Dark",
      note: "All sessions stay in this browser (chrome.storage). Nothing is uploaded.",
    },
    zh: {
      save: "保存当前窗口",
      saveTitle: "把当前窗口所有标签保存为会话 (Alt+Shift+S)",
      saveClose: "存后关闭",
      saveCloseTitle: "保存后关闭其余标签，释放内存",
      searchPro: "搜索所有会话里的标签…",
      searchLocked: "跨会话搜索属于 Pro 🔒",
      export: "导出",
      import: "导入",
      counter: "{n} / {max} 会话 · {tabs} 标签",
      empty: "还没有会话<br>点上方按钮或按 <b>Alt+Shift+S</b><br>把当前窗口整个存进来",
      emptySearch: "没有匹配的会话或标签",
      renameTip: "点击重命名",
      auto: "自动",
      restoreAll: "恢复全部",
      toggle: "展开/收起",
      del: "删除",
      more: "…还有 {n} 个",
      justNow: "刚刚",
      minAgo: "{n} 分钟前",
      hrAgo: "{n} 小时前",
      windowWord: "窗口",
      tabsSuffix: "· {n} 个标签",
      autoName: "自动备份 · {time}",
      tNoTabs: "当前窗口没有可保存的网页标签",
      tFreeLimit: "免费版最多 {max} 个手动会话，删除旧的或升级 Pro",
      tSaved: "已保存 {n} 个标签",
      tSavedClosed: "已保存并释放 {n} 个标签的内存",
      tRestored: "已恢复 {n} 个标签",
      tDelConfirm: "删除「{name}」？",
      tRenamePrompt: "会话名称",
      tImported: "导入 {n} 个会话",
      tBadFile: "文件格式不对",
      tProOnly: "此功能属于 Pro",
      tExportPro: "导出备份属于 Pro",
      tImportPro: "导入备份属于 Pro",
      tAutoPro: "自动备份属于 Pro",
      tSearchPro: "跨会话搜索属于 Pro",
      tAutoOn: "每 {n} 分钟自动备份当前窗口",
      tAutoOff: "自动备份已关闭",
      licPasteFirst: "先粘贴 Key",
      licInvalid: "Key 无效或已过期",
      licActivated: "激活成功（{label}）",
      licDeactivated: "已解除本设备",
      proTitle: "TabVault Pro",
      p1: "无限手动会话（免费 {max} 个）",
      p2: "每 {n} 分钟自动备份，崩溃后一键找回",
      p3: "跨会话搜索所有标签",
      p4: "导出 / 导入 JSON 备份",
      launch: "起售价",
      priceNow: "$6",
      priceWas: "$9",
      per: "一次性买断 · 终身更新",
      buy: "购买 Pro",
      buyNote: "一次付款，付款后拿到 License Key，粘贴到下方即可激活。",
      haveKey: "已有 License Key？",
      keyPh: "PRO·xxxx.yyyy 粘贴到这里",
      activate: "激活",
      deactivate: "解除本设备",
      autoHead: "自动备份",
      autoRowA: "开启后每",
      autoRowB: "分钟备份当前窗口（Pro）",
      delAfterRow: "恢复会话后自动删除该会话",
      langHead: "语言 Language",
      langAuto: "自动（跟随浏览器）",
      themeHead: "外观 Appearance",
      themeAuto: "自动（跟随系统）",
      themeLight: "浅色",
      themeDark: "深色",
      note: "所有会话只存在本浏览器（chrome.storage），不会上传任何数据。",
    },
  };

  let pref = "auto";

  function browserLang() {
    const l = (typeof navigator !== "undefined" && (navigator.language || (navigator.languages || [])[0])) || "en";
    return /^zh/i.test(l) ? "zh" : "en";
  }
  function lang() { return pref === "en" || pref === "zh" ? pref : browserLang(); }
  function setPref(v) { pref = v === "en" || v === "zh" ? v : "auto"; }
  function getPref() { return pref; }

  function t(key, vars) {
    const d = dict[lang()] || dict.en;
    let s = key in d ? d[key] : (key in dict.en ? dict.en[key] : key);
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return s;
  }

  // 静态 DOM 本地化：data-i18n（innerHTML）/ data-i18n-ph（placeholder）/ data-i18n-title
  function applyI18n(root) {
    if (typeof document === "undefined") return;
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = el.dataset.i18nVars ? safeJSON(el.dataset.i18nVars) : null;
      el.innerHTML = t(el.dataset.i18n, v);
    });
    scope.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    scope.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  }
  function safeJSON(s) { try { return JSON.parse(s); } catch { return null; } }

  return { t, lang, pref: getPref, setPref, applyI18n, dict };
})();

if (typeof globalThis !== "undefined") globalThis.I18N = I18N;
