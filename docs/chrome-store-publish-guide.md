# Chrome 应用商店上架操作指南（TabVault）v1

> 面向零基础：对照开发者后台左侧 4 个标签页逐屏填写，所有英文文案可直接复制粘贴。
> 依据：Google 官方 [cws-dashboard-privacy](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)、
> [best-listing](https://developer.chrome.com/docs/webstore/best-listing)、
> [program-policies](https://developer.chrome.com/docs/webstore/program-policies)。
> 审核时长：新账号首次 1~5 天常见；后续更新几小时~1 天。
> TabVault 从第一版起就**没有任何 host_permissions**（只有 storage/tabs/alarms/sidePanel），
> 不会触发「发布将被推迟 / 深入审核」黄条。

---

## 0. 准备材料（已全部做好 ✅）

| 材料 | 规格（商店硬性要求） | 位置 |
|------|---------------------|------|
| 代码包 zip | manifest 合法、`description` ≤132 字符（当前 116） | `5b75f644/tabvault-extension-store.zip`（50,770 B，8 个源文件 + 3 个图标） |
| 屏幕截图 | **必须 1280x800 或 640x400**，JPEG 或 24 位 PNG（无 alpha），1~5 张 | `5b75f644/tabvault-store-images/shot-1-pro.jpg` … `shot-4-paywall.jpg`（4 张，全 1280x800 / 24bpp） |
| 小型宣传图块 | 440x280，可选但建议传 | `tabvault-store-images/tile-small.jpg` |
| 顶部宣传图块 | 1400x560，可选 | `tabvault-store-images/tile-top.jpg` |
| 图标 | 已在包内（16/48/128），表单无需单独上传 | — |
| 隐私政策 URL | 公开可访问、无登录墙 | `https://wd9337812.github.io/tabvault/PRIVACY.html`（需先开 Pages，见 §2） |
| 支持页面 URL | 建议填 | `https://wd9337812.github.io/tabvault/SUPPORT.html` |

> 改过代码后要重新打包：`cd tab-vault` →
> `powershell -NoProfile -ExecutionPolicy Bypass -File dev\repack-store.ps1`
> （脚本会打印包内文件清单，并确认 config.js 里是真 SECRET 而不是占位值）。

---

## 1. 注册开发者账号（一次性 $5，已注册可跳过）

chrome.google.com/webstore/devconsole → 登录 → 付 $5 → 同意协议。
$5 是 Google 收的，与 Stripe / Cloudflare 无关。TabVault 用**同一个账号**新建条目即可，
不必再付费：后台左上「新增项目 / Add new item」。

---

## 2. 开启 GitHub Pages（30 秒，只做一次）

先在 GitHub 建仓库 `tabvault`（**Public**），把 `tab-vault/` 内容推上去，然后：

```
https://github.com/wd9337812/tabvault/settings/pages
Source = Deploy from a branch → Branch = main → Folder = /docs → Save
```

约 1 分钟后能公开打开下面两个 URL 即成功（隐私政策、支持页都依赖它）：

```
https://wd9337812.github.io/tabvault/
https://wd9337812.github.io/tabvault/PRIVACY.html
https://wd9337812.github.io/tabvault/SUPPORT.html
```

> ⚠️ 公开仓库里的 `config.js` 必须是占位 SECRET（当前仓库已是：真值只存在于本地
> skip-worktree 状态和商店 zip 里）。推之前跑一次
> `git show HEAD:config.js | grep SECRET` 自查。

---

## 3. 后台标签页 ①「软件包」

上传 `tabvault-extension-store.zip`。上传后这一页应无红字；有红字原样截图发我。
包内只含 8 个源文件（manifest / background / config / i18n / license / sidepanel 三件套）+ icons，
没有 README / dev / worker / tools（商店不接受多余无关文件，且这些会暴露部署细节）。

---

## 4. 后台标签页 ②「商店信息」

**名称（≤128 字符，当前 28）**

```
TabVault: Tab Session Saver & Restore
```

**简短说明（≤132 字符，当前 116）**

```
Save all open tabs as a session in one click, restore anytime. Auto-backup so a crash never loses your window again.
```

**详细描述**（官方建议：首句直给、要点列表、不堆关键词、不蹭别家品牌词）

```
TabVault turns "too many open tabs" into named sessions you can close, and reopen in one click.

ONE-CLICK WINDOW VAULTING
Click the toolbar icon (or press Alt+Shift+S) and every page in the current window becomes one session, automatically named after the sites inside it. "Save & close" keeps the first tab and releases the rest, so you get your memory back without losing your place.

RESTORE EXACTLY AS YOU LEFT IT
Restoring opens a fresh window with your tabs in the original order, pinned tabs pinned again — or drops them straight into the window you already have open. It never reorders or overwrites what you already have open.

CRASH INSURANCE (PRO)
Auto-backup quietly snapshots your active window every 15 minutes. Blue screen, accidental window close, "Chrome didn't respond" — reopen the browser and a banner in the side panel offers the last snapshot in one click, instead of rebuilding a research thread from history.

MADE FOR FOCUS
• Side panel UI — sessions live beside your work, not in another tab
• Search across every saved tab — find the page, not the session
• Paste a pile of URLs or plain text — open them as tabs or vault them as a session
• Toolbar badge shows how many tabs the current window is holding
• Rename, delete, per-session tab counts
• 100% local — sessions live in chrome.storage on your device; no account, no tracking

PRO (one-time $6 launch price, regular $9 — lifetime license, no subscription)
• Unlimited sessions (free: 5 saved sessions)
• Auto-backup every 15 minutes, rolling 20 snapshots
• Search across all saved tabs
• Export / import a JSON backup, or export Markdown / CSV / plain text

Privacy: all data is stored locally via chrome.storage. The extension itself runs no servers, no analytics and collects no personal data. Purchasing the optional Pro license is handled entirely on Stripe's hosted checkout.

Support: https://wd9337812.github.io/tabvault/SUPPORT.html
```

**其余字段（逐项）**

| 字段 | 填什么 |
|---|---|
| 类别 | **Productivity / 生产力** |
| 语言 | **English**（界面已内置 en/zh 自动切换：英文浏览器出英文、中文浏览器出中文，设置抽屉里还能手动固定。可再点「添加语言」挂一份中文 listing 文案，不强制） |
| 屏幕截图（1~5 张） | 顺序建议：`shot-1-pro.jpg` → `shot-2-pro.jpg` → `shot-3-pro.jpg` → `shot-4-paywall.jpg`（均为英文界面，与 English listing 一致） |
| 小型宣传图块 | `tile-small.jpg`（440x280） |
| 顶部宣传图块 | `tile-top.jpg`（1400x560） |
| 其他字段 → 首页网址 | `https://wd9337812.github.io/tabvault/` |
| 其他字段 → 支持信息页面网址 | `https://wd9337812.github.io/tabvault/SUPPORT.html` |
| 成人内容 | 关（本扩展不涉及） |
| 可见性 | **公开**（想先自测可选「不公开」拿链接，测完再切公开） |

---

## 5. 后台标签页 ③「隐私」——最容易被拒的一页，逐格照抄

### 5.1 单一用途声明（一句话，必须窄）

```
Save the tabs open in the current browser window as a named session, and restore or auto-backup that session locally in the side panel.
```

> 官方口径：宽泛话术（"improves browsing"、"increases productivity"）秒拒。
> 上面这句只描述 TabVault 真正做的事。

### 5.2 需请求权限的理由（每个权限一格，英文，勿中英混排、勿串格）

> 写错格子（把 tabs 的理由填进 storage）会被视为披露不实 → 拒审。
> TabVault 只有下面 4 格，**没有主机权限**，所以不会出现「需请求主机权限的理由」那一格。

**storage**

```
chrome.storage.local is the extension's only persistence layer: it stores the user's saved tab sessions (page titles and URLs), session names, extension settings, and a pasted License Key on the device, so sessions survive browser restarts. Nothing stored is ever transmitted off the device.
```

**tabs**

```
Reads the title, URL and favicon address of the tabs in the window the user chooses to save, so a session can be rebuilt later with its site icons; the same data is used to create a new window on restore and to close the tabs the user explicitly clicked "Save & close" on. Saved favicons are displayed by loading them directly from each site's own origin, with no third-party service involved. This permission is used only at those moments: the extension does not read browsing history, does not monitor tab changes continuously, and does not track which pages the user visits.
```

**alarms**

```
A single chrome.alarms timer (periodInMinutes, default 15) triggers the optional auto-backup feature, which the user must enable in the settings drawer and which is off by default. When it fires, the extension takes the same tab title/URL snapshot described above and writes it to local storage. No network request is made.
```

**sidePanel**

```
chrome.sidePanel opens the extension's entire user interface — the list of saved sessions, the save/restore buttons, search and the settings drawer. Without it there is nowhere to show or manage sessions.
```

### 5.3 是否使用远程代码

选 **「不，我并未使用远程代码」**。

事实依据：所有 JS（background.js / sidepanel.js / license.js / config.js）都打在包里；
License 校验是本地 HMAC-SHA256 计算，不下载、不 `eval` 任何外部脚本。
购买时打开的 Cloudflare Worker / Stripe 结账页是普通网页跳转，不属于扩展内执行远程代码。
⚠️ 这一项误选「是」必须附技术理由且大概率被拒——如实选「不」。

### 5.4 数据使用（收集与共享声明）

TabVault 全部处理都在本机完成，扩展不向开发者服务器或第三方传输任何用户数据
（购买发生在 Stripe 托管页，由 Stripe 处理，扩展本身不经手）。因此：

- 数据类型清单（个人身份 / 财务 / 位置 / 用户生成内容 / 网站内容 / 活动与浏览记录 …）：**全部不勾**
- 勾选列表末尾的 **「我的扩展程序不会收集任何用户数据」**
- 「我确认下列披露信息均属实」三条：**全部勾上**（政策硬性要求，少一条就驳回）

> 若你的账号被 AB 测试成不允许勾「不收集」：只勾「网站内容」，
> 用途写 `session titles/URLs the user saves, processed and stored locally only, never transmitted`。

### 5.5 隐私权政策网址

```
https://wd9337812.github.io/tabvault/PRIVACY.html
```

必须已按 §2 开启 Pages 且能公开打开。商店会核对政策内容与声明是否一致，
我们的 PRIVACY.html 已如实写明「仅本地存储、四个权限各自用途、扩展不收集、Stripe 处理支付」。

---

## 6. 后台标签页 ④「分发」

| 字段 | 填什么 |
|---|---|
| 类别 | 生产力（与 §4 一致） |
| 地区 | **所有国家/地区**（Stripe 全球收款，无需限制） |
| 定价 | **免费** |
| 语言 | 默认英语 |

> 合规：商店内免费 + 扩展内链到自家 Stripe 卖 License 是主流做法（Grammarly、Loom 同款）。
> 商店文案只陈述功能与「一次性授权」事实，不做促销性价格堆砌。

---

## 7. 提交与审核后

1. 右上角「保存草稿」→ 页面顶部无红字 →「提请审核」
2. 状态 Pending → Live（首次 1~5 天常见）
3. 通过后拿到 `https://chromewebstore.google.com/detail/<slug>/<id>` 发我，
   我把落地页 `docs/index.html` 里的 "Add to Chrome" 按钮链接换上
4. 立刻做：README 挂商店链接 → Product Hunt / 目录站提交（套路见 skill 的
   `references/directory-submissions.md`）→ 首批评价决定搜索转化

---

## 8. 上架前必须完成的收款链路（否则「购买」按钮是死的）

商店审核**不要求**付费功能真的能用，但你自己要先测通再对外宣传：

1. 建 Stripe **$6 一次性** Payment Link → 链接填进 `worker/wrangler.toml` 的 `STRIPE_PAYMENT_LINK`
   （实收 $6；界面与落地页上的 `$9` 只是划线锚定价，文案在 `i18n.js` 的 `priceNow/priceWas`，
   以后提价改这两个键 + 新建一条 Payment Link 即可，老 key 不受影响）
2. `cd tab-vault/worker && npx wrangler deploy`
3. `npx wrangler secret put LIC_SECRET`（值 = config.js 里的 SECRET）
   `npx wrangler secret put STRIPE_SECRET_KEY`（Stripe sk_live_…）
4. 在该 Payment Link 的设置里把 **After completion → Redirect to URL** 设为
   `https://tabvault-pro-api.wd933781.workers.dev/success?sid={CHECKOUT_SESSION_ID}`
   （这一条只能后台点，API 改不了）
5. 用测试卡走一遍：付款成功页应显示 License Key → 粘贴进扩展「激活」→ 顶部出现 PRO 徽标

---

## 9. 常见拒审原因自查（官方口径 + 社区统计）

| 拒审原因 | TabVault 的状态 |
|----------|----------------|
| 权限理由为空 / 含糊 / 与功能对不上 | §5.2 四格逐一对应，写清触发时机与数据去向 |
| 请求超出单一用途的权限 | 4 项权限全部服务于「保存/恢复标签会话」，无 host_permissions、无 content script |
| 披露与隐私政策矛盾 | 政策页、数据声明、代码行为三者一致（全本地、零外传） |
| 执行远程代码未申报 | 无远程代码，如实申报「不」 |
| 截图尺寸不符 | tabvault-store-images/ 全部 1280x800 JPEG 24bpp 无 alpha |
| 蹭品牌词 / 关键词堆砌 | 文案无竞品名、无重复堆词 |
| 功能过于单薄 | 会话保存/恢复/存后关闭/搜索/自动备份/导入导出/门控完整 |
| 有购买入口但无法完成购买 | §8 测通后再对外宣传；审核期本身不拦 |

---

### 卡住了怎么办

后台任何红字 / 黄条，原样截图发我，我直接改。改文案不需要重新传包，
保存草稿再提审即可；只有改了代码（manifest/JS）才要重跑 §0 的打包脚本。
