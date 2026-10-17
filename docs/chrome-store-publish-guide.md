> 内部留档：按交付的“TabVault-0.5.0-上线资料”文件夹理解文中素材路径；正式可操作版本为交付文件夹的上线指南.html。此仓库文档不包含私密审核授权或生产运行包。

# TabVault 0.5.0 详细上线指南

修订日期：2026-10-17。本文替代上一份简版指南。**按第 1 步到第 14 步顺序执行，每一步都标明由你还是由我处理。** 文内后台字段同时给出英文，实际排列以你的开发者后台为准。

本指南是内部上线资料，不放到官网。整套资料含私密审核授权，只用于你的开发者后台；公开商店文案和截图已单独放好。

## 第 1 步｜你：解压本款资料，确认哪些文件要上传

建议先把 `TabVault-0.5.0-上线资料.zip` 完整解压到一个固定文件夹，再打开里面的 `上线指南.html`。HTML 版带目录、文案复制按钮和截图预览；`上线指南.md` 内容相同。所有相对文件位置均以该资料文件夹为准。

| 要用的文件 | 在资料中的位置 | 用途 |
| --- | --- | --- |
| 商店唯一运行包 | `extension/tabvault-0.5.0.zip`（见交付资料文件夹） | 上传到 Package；保持 ZIP，不解压重压 |
| 英文截图 5 张 | `screenshots/en/shot-01.png` 至 `shot-05.png` | 英文商店资料使用 |
| 简体中文截图 5 张 | `screenshots/zh/shot-01.png` 至 `shot-05.png` | 简体中文商店资料使用 |
| 128×128 图标 | [branding/icon-128.png](../icons/icon-128.png) | 商店图标；包内也已包含 |
| 440×280 小型宣传图 | [branding/small-440x280.jpg](assets/tile-small.jpg) | 小型宣传图字段，品牌图可继续使用 |
| 全套可复制文案 | `store-copy.txt`（见交付资料文件夹） | 第 5 步也已完整列出，不必另找 |
| 私密审核说明与有效审核码 | `review-notes-private.txt`（见交付资料文件夹） | 只填开发者后台私密审核字段 |
| 本轮测试报告 | `测试报告.md`（见交付资料文件夹） | 了解已测范围及待验收项 |
| 最后核对清单 | `发布检查清单.txt`（见交付资料文件夹） | 提交和发布前逐项核对 |

**不要上传错包：** “上线资料.zip”是整套交付，`store-materials.zip` 是图片与文案，`-source.zip` 是开发源码；它们都不是 Package 所需的插件 ZIP。只有上表 `extension/tabvault-0.5.0.zip` 是商店安装包。当前完整交付目录中也有同名运行包，两者字节一致。

正式运行包已保留原 Pro 授权兼容配置。不要把源码中的占位配置覆盖进运行包，不需要自己修改 `config.js` 或添加 Key。此次只是改写指南和整理资料，运行包版本、内容和原测试结果没有改变。

**完成标志：** 能打开 HTML 指南，能在 `extension` 文件夹看到唯一对应的运行 ZIP，英文／中文截图各 5 张。

## 第 2 步｜你：进入原商店条目并备份

1. 打开 [Chrome Web Store 开发者后台](https://chrome.google.com/webstore/devconsole)，登录管理原扩展的账号。
2. 进入已有的 **TabVault** 条目，不创建新的正式条目。
3. 在后台确认扩展 ID 与下表一致；公开商店地址可以用于对照身份。
4. 上传前，在原插件设置中导出一份 JSON 备份，并记录当前公开版本及旧 Pro 是否正常。不要卸载原扩展；卸载会删除本地内容。

| 核对项 | 本次值 |
| --- | --- |
| 原扩展 ID | `lcdbcmmcbonjgbjnagnbfpaadfnlaimm` |
| 公开安装地址 | https://chromewebstore.google.com/detail/lcdbcmmcbonjgbjnagnbfpaadfnlaimm |
| 本次上传版本 | **0.5.0** |
| 本地上一轮归档版本 | 0.4.1；线上实际版本以后台为准 |
| 软件包名称 | `TabVault — Tab Session Saver` |
| 发布方式 | 保持原条目、原地区及可见范围 |

若 ID 不同，先把实际 ID 和条目名称发给我核对。若后台已有版本等于或高于 0.5.0，需要重新打更高版本的完整包，不要反复提交旧版本号。[完整包与递增版本规则](https://developer.chrome.com/docs/webstore/update)

**完成标志：** 原 ID 对得上、待上传版本高于后台已有版本、备份在手，旧扩展仍保留。

## 第 3 步｜你和我：明确本轮服务状态与更新顺序

**本轮没有修改支付后端。** 支付 Worker、D1 数据库、Stripe 商品及 Webhook、Resend、DNS 沿用现有配置，无需迁移、重建商品或重新填密钥。插件内只调整权益展示和从付费墙返回原操作时保留输入内容；付款核验、自动激活、邮箱恢复及旧授权码继续沿用。

| 项目 | 本轮谁处理、何时处理 |
| --- | --- |
| 插件运行包与商店素材 | 我已准备；你按本指南上传原条目 |
| 公开隐私页 | 新文案已在源码准备；提交审核前由我同步并核对线上实际页面 |
| 产品官网新权益与截图 | 源码已准备；商店审核通过、确定发布时间后由我同步 |
| 商店提交、审核后发布 | 你在开发者后台操作，两款分别提交 |
| 支付、邮件、域名服务 | 继续使用现有服务；发布前做状态检查，本轮不重新部署 |
| 正式支付与邮箱投递 | 发布窗口做实际验收，模拟测试不代替生产收件和扣款 |

可以直接发我：

```text
TabVault 0.5.0 商店草稿已准备，请先同步本轮隐私页并检查官网、付款和恢复服务；产品首页的新权益与截图等发布窗口再同步。
```

这句话是可复制的下一步通知，不表示我已在改写指南时替你部署。**截至本指南修订，未因本次文档工作发布网站或修改服务。**

公开隐私页应在提交审核前反映本地新增流程、撤销缓存和相关数据处理；首页宣传与商店包同步，避免先宣传尚未公开的功能。两款 Pro 分别购买，不能用其中一款的授权激活另一款。

## 第 4 步｜你：在 Package 上传完整插件包

1. 原条目左侧进入 **Build → Package／软件包**（后台也可能直接显示 Package）。
2. 点击 **Upload New Package／上传新软件包**。
3. 选择解压资料中的 `extension/tabvault-0.5.0.zip`。
4. 等待校验结束，确认识别到 **0.5.0**，插件名和 ID 没变。
5. 查看权限是否出现异常。本轮没有新增必需权限、可选主机范围或最低 Chrome 要求（仍为 Chrome 116）；若有非预期提示，将原文发给我核对。
6. 保存草稿。草稿上传并不等于公开发布，当前商店用户继续使用原公开版本。[更新操作说明](https://developer.chrome.com/docs/webstore/update)

若报找不到 manifest，通常是选错了资料总包或 ZIP 多套了一层目录；改选上述运行 ZIP。若报版本不够高，先核对后台版本，不要自己改版本文件后重压。若报告代码或权限问题，保留错误文本交给我修复。

**完成标志：** Package 草稿显示版本 0.5.0，上传校验完成。

## 第 5 步｜你：逐个填写商店文字，下面可直接复制

进入 **Store listing／商店详情**。保持现有名称、合适的原类别和发布范围；此次不必重新命名。默认商店语言沿用现有设置（如当前为 English 就保留），维护 English 和简体中文两套资料。通过语言选择器添加或切换 Simplified Chinese／简体中文；若后台只显示英文，先完成英文，再添加中文资料并保存。

**商店默认语言与插件界面语言是两回事。** 实际插件默认跟随浏览器，未支持或识别失败时用英文；顶部 **EN／中** 切换按钮保留，设置中有“跟随浏览器、English、简体中文”。示例设计图漏画按钮，不代表安装包删掉它。

下面每个代码框只复制框内文字。短介绍通常读取软件包 `description`；若后台没有可编辑摘要字段，不用为此重打包。更新摘要只在后台提供对应字段时使用；没有该字段则放在完整介绍末尾也可以。

### 产品名称
沿用原条目名称；软件包名称为：

```text
TabVault — Tab Session Saver
```

### 英文短介绍
软件包 description 已设为下文；如后台不可编辑短介绍，不必另改包。

```text
Save tabs by project, restore browser groups and revisit local snapshots. Free JSON backups; optional Pro organization and history.
```

### 简体中文短介绍
仅在后台提供该语言的可编辑摘要字段时填写；不要为了修改摘要覆盖软件包 manifest。

```text
按项目保存标签会话，恢复分组与固定标签，比较本地记录，随时继续工作。
```

### 英文完整介绍

```text
Save your browser workspace and return when you are ready. TabVault keeps tab sessions and project context in a readable browser sidebar.

FREE — Save, organize and restore
• Save up to 30 manual sessions in 3 projects.
• Add session notes, tags and pins; search saved titles and URLs.
• Restore selected pages, browser groups and pinned tabs, and skip URLs that are already open.
• Import and export JSON backups and use basic Markdown or link-text exports.
• Preview differences between saved records and your current window; open individual pages.
• Preview launch-plan editing and duplicate references across sessions.
• Choose compact, standard or large text and light or dark appearance.

OPTIONAL PRO — Return to a working setup
• Remove the product's manual-session and project count limits.
• Compare records and recover selected missing pages in a batch, without replacing the source record.
• Save named launch plans with selected pages, pinned tabs and groups across multiple windows. Preview the windows before opening them.
• Apply cross-session cleanup after reviewing selected duplicate references, with undo for the last supported local data change.
• Use advanced batch organization, project launch and CSV export.

OPTIONAL LOCAL SNAPSHOTS
Automatic snapshots are off by default. If enabled, Free keeps up to 24 hours and 50 snapshots; Pro keeps up to 30 days and 500 snapshots. Both are subject to a total snapshot limit of 4 MB. Actual recovery coverage can be shorter. Snapshot cleanup does not delete manual sessions.

LOCAL DATA, CLEAR LIMITS
Saved sessions, projects, launch plans and snapshots stay in local browser storage. No cloud sync or extension usage analytics. JSON backups include local workflow records and exclude Pro licenses. Restoring reopens saved URLs and supported tab metadata; it does not restore passwords, form inputs, logins or unsaved page state. Opened websites make their normal network requests.

The interface follows your browser language by default, with English as the fallback. English and Simplified Chinese can also be selected manually.

PRO PURCHASE
Pro is an optional $6 one-time purchase for TabVault. Applicable tax is shown at checkout. Purchases started in the extension support automatic activation after server verification, with email recovery and existing license-code support. TabTasks Pro is a separate purchase.

Support: support@tabplugins.top
Privacy: https://tabvault.tabplugins.top/PRIVACY.html
```

### 简体中文完整介绍

```text
保存当前工作台，准备好时再继续。TabVault 将标签会话和项目背景保存在清楚易读的浏览器侧栏中。

免费版：保存、整理与恢复的基础功能完整开放
• 保存最多 30 个手动会话、创建 3 个项目。
• 会话备注、标签、置顶，以及标题／网址搜索。
• 勾选页面恢复，保留浏览器分组和固定标签，跳过已经打开的重复网址。
• JSON 备份导入导出，以及基本 Markdown／链接文本导出。
• 预览已保存记录与当前窗口的差异，逐个打开页面。
• 体验启动方案编辑预览与跨会话重复引用预览。
• 免费选择紧凑、标准、大字及明暗主题。

可选 Pro：把资料保存升级为可继续工作的工作台
• 解除手动会话和项目的产品数量限制。
• 比较记录，批量找回所选缺页，保留原始记录。
• 将所选页面、固定状态和分组保存为命名启动方案，预览后按多个窗口打开。
• 在跨会话整理中心预览并勾选重复引用后再清理，支持撤销最近一次受支持的本地数据修改。
• 高级批量整理、项目启动与 CSV 导出。

可选的本地自动快照
自动快照默认关闭。主动开启后，免费版最长保留 24 小时、最多 50 份；Pro 最长 30 天、最多 500 份，两者均受快照合计 4 MB 限制。实际可恢复范围可能更短，以已有记录为准。快照清理不会删除手动保存的会话。

本地保存，能力边界清楚
会话、项目、命名启动方案和快照保存在本机，不提供云同步，插件内不收集使用统计。JSON 备份包含本地流程记录，不包含 Pro 授权。恢复是重新打开网址及受支持的标签元数据，不保存或还原密码、表单输入、登录态和未提交网页状态；打开的网站会正常联网。

默认跟随浏览器语言，识别失败或语言未支持时使用英文，也可手动选择 English／简体中文。

Pro 购买说明
TabVault Pro 为可选的 $6 一次性买断，适用税费以结账页为准。从插件内发起购买后，服务核验付款并支持自动激活，也支持邮箱恢复和已有授权码。TabTasks Pro 需要单独购买。

客服：support@tabplugins.top
隐私政策：https://tabvault.tabplugins.top/PRIVACY.html
```

### 英文更新摘要（如后台提供此字段）

```text
Larger session titles and restore controls, with three free text sizes. Browser-language default with English fallback. Free: 30 manual sessions and 3 projects. New difference previews, Pro launch plans and cross-session cleanup. Existing sessions, preferences and Pro licenses are preserved.
```

### 简体中文更新摘要（如后台提供此字段）

```text
增大会话标题和恢复按钮字号，免费提供三档字号；默认跟随浏览器语言，英文兜底。免费额度为 30 个手动会话和 3 个项目。新增差异预览、Pro 命名启动方案与跨会话整理，保留原会话、偏好和 Pro 授权。
```


**价格及权益口径核对：**

| 功能 | 免费版 | Pro |
| --- | --- | --- |
| 手动保存的会话 | 30 个；自动快照另计 | 解除产品数量限制 |
| 项目 | 3 个 | 解除产品数量限制 |
| 会话备注、标签、置顶、搜索 | 可用 | 可用 |
| 选页恢复、浏览器分组、固定标签、跳过已打开页面 | 可用 | 可用 |
| JSON 备份、基本 Markdown／链接导出、三档字号 | 可用 | 可用 |
| 历史差异 | 预览、逐个打开页面 | 批量找回所选缺页 |
| 命名启动方案 | 编辑预览 | 保存方案并按多个窗口启动 |
| 跨会话整理 | 重复引用预览 | 勾选后应用清理 |
| 高级批量整理、项目启动、CSV 导出 | Pro 入口可查看 | 可用 |
| 主动开启的自动快照 | 最长 24 小时、最多 50 份 | 最长 30 天、最多 500 份 |
| 自动快照合计容量 | 4 MB | 4 MB；数量／时间／容量共同限制 |

Pro 是每款 **$6 一次性买断**，适用税费以结账页为准。数量限制解除仍受本机存储与浏览器资源约束，不写“无限云存储”。不要写“无限自动历史”“保证找回所有崩溃页面”或“恢复完整网页状态”。第二阶段的智能集合规则、手动会话版本和研究资料清单尚未提供。

**完成标志：** 英文和简体中文完整介绍都已保存，额度、价格和已上线功能与上表一致。

## 第 6 步｜你：按语言替换截图，核对图标与宣传图

1. 在英文商店资料中，移除本次已过时的截图，再按 01 → 05 上传 `screenshots/en` 的 5 张。
2. 切换简体中文资料，按相同顺序上传 `screenshots/zh` 的 5 张。不要把英文 5 张和中文 5 张混到同一个语言列表。
3. 每张均为 **1280×800 PNG**，源于这轮真实插件界面，使用示例数据，图片注明包含 Pro 功能。
4. 保存后逐张预览，检查顺序、语言、完整边缘及文字显示。不要使用交互示例图来替代实际功能截图。

| 顺序 | 展示内容 | 英文素材 | 中文素材 |
| --- | --- | --- | --- |
| 01 | 会话与项目总览 | [英文图 01](assets/en/shot-01.png) | [中文图 01](assets/zh/shot-01.png) |
| 02 | 真实差异与缺页找回 | [英文图 02](assets/en/shot-02.png) | [中文图 02](assets/zh/shot-02.png) |
| 03 | 命名启动方案与多窗口 | [英文图 03](assets/en/shot-03.png) | [中文图 03](assets/zh/shot-03.png) |
| 04 | 跨会话整理与撤销 | [英文图 04](assets/en/shot-04.png) | [中文图 04](assets/zh/shot-04.png) |
| 05 | 三档字号与语言设置 | [英文图 05](assets/en/shot-05.png) | [中文图 05](assets/zh/shot-05.png) |

| 其他图片字段 | 本次做法 | 文件位置 |
| --- | --- | --- |
| Extension icon／图标 | 保持品牌一致，后台需要时用所附 PNG | `branding/icon-128.png`，128×128 |
| Small promo tile／小型宣传图 | 可沿用当前品牌图，需要替换时用所附 JPG | `branding/small-440x280.jpg`，440×280 |
| Marquee／大型宣传横幅 | 本轮不上传旧横幅；若后台已有展示旧界面的横幅，移除该可选项 | 本套不提供 1400×560 旧图 |
| 社交分享图／logo.svg | 不属于商店截图，不上传到截图字段 | 本套不要求处理 |

上一版素材包 `shared/tile-top.jpg` 含旧界面，还含“崩溃绝不丢失”的过度承诺，**不要沿用**。本次重整的素材包已去掉该旧大横幅；440×280 品牌图不含这类承诺，可继续使用。

商店截图按语言提供，每种最多 5 张；小型宣传图与可选大型宣传图是独立字段，并非按语言分别上传。[Chrome 图片规格与字段区别](https://developer.chrome.com/docs/webstore/images)

**完成标志：** 中英文分别 5 张，图标与小型宣传图正确，没有继续展示过时的大横幅。

## 第 7 步｜你：填写公开地址和客服邮箱

| 后台字段 | 直接填写 |
| --- | --- |
| Website／官网 | https://tabvault.tabplugins.top/ |
| Privacy policy／隐私政策 | https://tabvault.tabplugins.top/PRIVACY.html |
| Support URL／支持地址 | https://tabvault.tabplugins.top/SUPPORT.html |
| Developer support email／客服邮箱 | support@tabplugins.top |

逐个用浏览器打开，确认 HTTPS、页面归属和客服地址正确，隐私页已含本轮本地流程与撤销说明。不要用本地文件路径、后台管理地址或仓库地址填这些公开字段。官网不放 GitHub／源码入口。

客服邮件沿用 **support@tabplugins.top → 你已有的 Gmail** 转发。请从另一个邮箱发一封注明 `TabVault support test` 的信，并在目标 Gmail 确认收到。客服转发与 Resend 的验证码发信是不同服务；用 Gmail 直接回复仍可能显示 Gmail 地址，不把它误认为已配置域名发信身份。

| 运营检查入口 | 地址／说明 |
| --- | --- |
| 付款入口 | https://pay-tabvault.tabplugins.top/buy |
| 只读服务状态 | https://pay-tabvault.tabplugins.top/status |
| 管理后台 | https://pay-tabvault.tabplugins.top/admin；使用原管理员 Token，不填入公开字段 |
| 恢复邮件发件地址 | tabvault@send.tabplugins.top |
| 产品总入口 | https://tabplugins.top/ |

查看 `/status` 不会支付；重点看自动激活和邮箱恢复配置是否启用。**单纯检查状态不需要点击 /buy 创建新订单。** 之前部署版本为 Billing 2.1.1，本轮未改它；当前线上状态以发布前实际检查为准。`emailRecovery=true` 只表明配置开启，不能证明真实用户已收到邮件。

**完成标志：** 公开链接可访问且内容与新包一致，客服收信测试完成；后台 Token 没进入公开资料。

## 第 8 步｜你：填写隐私用途、权限理由与数据披露

进入 **Privacy practices／隐私权实践**，隐私 URL 填第 7 步地址。下面按实际软件包给出可直接粘贴的英文；若后台把多个主机权限合成一个字段，把对应理由合并填写。

### Single purpose description／单一用途说明

```text
Save, organize and restore browser tab sessions locally, with projects, user-reviewed recovery and launch workflows, and optional automatic local snapshots.
```

### Permission justification／权限理由

| 权限／后台字段 | 可粘贴的英文说明 |
| --- | --- |
| `storage` | Stores saved sessions, projects, notes, tags, launch plans, local snapshots, preferences, the last undo record and license state locally. |
| `tabs` | Reads tab titles, URLs, order and pinned state to save sessions, compares saved metadata with the current window, and opens user-selected tabs and launch-plan windows. |
| `alarms` | Schedules automatic local snapshots only when the user enables this feature. |
| `sidePanel` | Displays session management and its related settings in the Chrome side panel. |
| `tabGroups` | Reads group names, colors and collapsed state and restores browser groups when requested by the user. |
| `主机权限：https://pay-tabvault.tabplugins.top/* 及原 tabvault-pro-api.wd933781.workers.dev/*` | Connects to this product’s billing service to start checkout, verify payment, activate a Pro license and recover a purchase. The legacy billing origin remains for compatibility. |

### Remote code／远程代码

本包选择 **No／否**。本地随包脚本处理支付响应，没有下载执行远程 JavaScript。若要求文字说明，可用：

```text
All executable JavaScript and UI resources are bundled in the extension. Billing responses are data processed by predefined local code; the extension does not download or execute remote JavaScript.
```


### Data usage／处理的数据类型

按这款插件及配套购买／恢复服务的实际行为核对以下类别。不要因为主要数据留在本机，就跳过本地数据的隐私说明。下表是基于当前实现的填写建议；后台字段若变化，按等义名称核对，不机械勾选不相关类型。

| 类别 | 当前涉及的处理 |
| --- | --- |
| Personally identifiable information／个人身份信息 | 购买邮箱和主动恢复购买邮箱；付款服务以带密钥摘要匹配，Resend 处理待投递邮箱。主动支持邮件另由邮件服务处理。 |
| Financial and payment information／财务与付款信息 | Stripe 结账；订单服务保存交易编号、金额、币种及付款／退款状态，不保存银行卡详情。 |
| Authentication information／身份验证信息 | Pro 授权、激活凭证、恢复验证码及其摘要。 |
| Web history／网页历史 | 用户保存的网页标题与网址，以及主动开启的本地快照记录。 |
| Website content／网站内容 | 用户保存的标签标题、会话和项目备注等内容；不抓取页面正文。 |

当前插件没有健康、地理位置、私人通讯采集或使用行为统计功能，不因此额外勾选对应类别。联系支持时用户主动发来的邮件在公开隐私政策中另有说明。官网 GA4 只属于网站访问统计，未打进扩展、支付页或管理页。

后台如要求确认“不出售用户数据”“仅用于扩展单一用途”“不用于信用判断”等承诺，逐条阅读并按当前实现确认；隐私页和商店披露保持一致。本地新增流程会进入 JSON 备份；最近一次撤销缓存可能保留刚修改／删除的内容，直到撤销、被后续记录替换，或满 24 小时后的下一次读取清理。备份不包含授权。

**恢复额外披露（TabVault 专用）：** 保存的是网址、标题、固定状态、浏览器分组和用户备注等元数据，差异比较与去重在本机进行，不抓取网页正文。恢复时会重新打开网站，不恢复密码、登录态、表单输入或未提交内容。自动快照需用户主动开启，隐身窗口不纳入自动快照。

依据：[隐私字段说明](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)、[用户数据与本地处理 FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)。

**完成标志：** 单一用途、每项权限理由、远程代码回答、数据类型及隐私 URL 全部保存；线上隐私页已同步。

## 第 9 步｜你：填私密审核说明，让审核员可以直接测 Pro

1. 打开本资料 `review-notes-private.txt`（见交付资料文件夹）。它包含本版英文测试步骤及沿用的临时 Pro 审核码，已对本次运行包验证签名与有效期。
2. 将文件内容复制到后台的 **Test instructions／Reviewer notes／私密审核或测试说明** 字段，具体名称以后台为准。不要复制到公开完整介绍或更新摘要。
3. 审核码有效至 **2026-12-09 08:00（北京时间）**。若实际提交或复审接近／超过该时间，让我换新审核码；不要只沿用过期的旧后台备注。
4. 审核员安装后点击工具栏图标打开侧栏。基础功能无需账号。Pro 测试路径为：**设置 → 了解 Pro／管理购买 → 已有授权码？ → 粘贴本款审核码 → 激活 Pro**。不要求审核员付款。
5. 使用普通测试网页保存两个会话，再进行差异比较、启动方案与整理。自动快照需主动开启，不需要账号或云端内容同步。
6. 两款的审核码不可混用。该私密文件不提交到源码仓库、不作为官网资源。

**完成标志：** 私密审核字段里有本版测试说明及本款有效审核码，公开介绍和截图里没有。

## 第 10 步｜你：核对购买声明与分发设置

1. 打开 **Distribution／分发** 或后台对应购买声明位置。
2. 若显示 **In-app purchases／提供应用内购买**，选择 **Yes／是**。扩展免费安装，Pro 是可选外部 Stripe 一次性购买，不是订阅。
3. 保持当前正式条目的公开／非公开状态、地区及原有类别。不要为了测试把原正式条目改成私密，也不要新建重复条目。
4. 如果后台没有独立购买字段，至少保留公开介绍中的价格、免费范围、税费说明及私密测试入口。
5. 两款分别填各自 Pro。自动历史受时间、份数和总容量共同限制。

可用于补充购买说明的英文：

```text
TabVault is free to install. Optional Pro is a separate $6 one-time purchase through Stripe, with applicable tax shown at checkout. Free features do not require an account or payment. Reviewers can use the temporary license supplied in the private test instructions without purchasing.
```


**完成标志：** 购买声明、公开价格、免费权益和原分发范围一致。

## 第 11 步｜你：提交前逐项检查，再选择手动发布

- [ ] 原条目 ID 为 `lcdbcmmcbonjgbjnagnbfpaadfnlaimm`，Package 显示 0.5.0。
- [ ] 运行 ZIP 来自 `extension`，不是源码包、素材包或整套资料包。
- [ ] 中英文完整介绍已分别保存，免费额度为 30／3。
- [ ] 两种语言各 5 张新截图，图标／小型宣传图正确，过时大横幅已移除。
- [ ] 官网、支持、隐私地址及客服邮箱正确；新版隐私页已在线。
- [ ] 权限理由和隐私数据披露已保存，没有声称“不处理任何数据”。
- [ ] 私密审核说明包含本版步骤及未过期的本款 Pro 审核码。
- [ ] 购买声明正确，价格为每款 $6 一次性买断。
- [ ] 已有数据备份，原插件没有卸载，当前公开版本已记录。

然后点击 **Submit for review／提交审核**。在确认窗口中，建议取消“审核通过后自动发布”，选择 **审核通过后手动发布**。这样能在官网与商店都准备好时一起发布。当前官方说明要求通过后在待发布期限内发布，通常最多 30 天，以后台显示的过期时间为准。[提交和延迟发布规则](https://developer.chrome.com/docs/webstore/update)

分批发布只在符合资格的条目显示，当前官方条件包括超过 10,000 个七日活跃用户；如果你没有该选项，正常提交即可，不需要找一个不存在的按钮。

提交后可发我：

```text
TabVault 0.5.0 已提交审核，选择了审核通过后手动发布。
```

审核被拒时，把邮件中的原因或后台错误原文发给我；先按具体问题改，不要重复上传相同内容。提交审核本身不会让老用户立即更新。

## 第 12 步｜你和我：审核通过后，按顺序发布

1. **你：** 审核通过时先不要直接卸载重装。在后台记录待发布截止时间，并发我：

```text
TabVault 0.5.0 已通过审核，准备发布。请检查正式服务和公开链接，并在商店版本公开后同步新版权益与截图。
```

2. **我：** 检查官网、支持／隐私页、支付只读状态，以及现有自动激活／邮件恢复配置；确认官网发布文件已准备。此处不需要更改 Worker、D1、Stripe 或邮件 Key。
3. **你：** 在准备好的时间窗口点击 **Publish／发布**，记录实际发布时间。
4. **你和我：** 确认公开商店版本已显示 0.5.0 后，立即在同一窗口同步产品官网的新权益、截图和对应隐私说明；官网的安装按钮继续指向原扩展 ID。两款如果不同时间过审，分别同步。
5. **你和我：** 按第 13 步验收正式商店版本，再看旧用户更新情况。

不要把“已推仓库”“已上传草稿”“已过审待发布”当成“用户已收到新版”。在公开版本仍旧时，首页不应把新 Pro 功能写成已可安装体验。

## 第 13 步｜你和我：验收正式包、旧数据、付款及恢复

### A. 原安装升级和阅读体验

1. 保留原安装，升级后在 `chrome://extensions` 确认版本为 **0.5.0**。旧会话、项目、分组和备注、已有 Pro 和手动语言偏好应保留。
2. 在 English、简体中文、浅色、深色下查看主列表、设置、付费墙和恢复预览；右上角 **EN／中** 可切换。
3. 在设置中选择“跟随浏览器”：支持中文时用中文，其他未支持语言或识别失败时用英文。手动选择后重新打开仍应记住；不会因这次更新强制覆盖旧选择。
4. 检查紧凑／标准／大字，侧栏 320／360／400／480px，以及 Chrome 放大到 200%。长标题、元信息可换行，主要按钮能点击。标准主列表标题约 16px、输入框 16px、正文／主按钮 15px、来源日期约 13px。

### B. 免费／Pro 核心功能

1. 用免费用户保存 30 个手动会话，再保存第 31 个；应出现额度提示，原记录保留。创建 3 个项目后，第 4 个进入升级引导。自动快照不占手动会话额度。
2. 免费检查备注、标签、置顶、JSON 备份、Markdown／链接导出；用包含固定标签和浏览器分组的测试窗口保存，再选页恢复并跳过已打开页面。
3. 在测试窗口关闭一个普通网页，与已保存会话比较；免费可预览和逐个打开页面，Pro 可勾选缺页批量恢复。原会话仍应保留。
4. Pro 保存包含两个窗口的命名启动方案，预览并启动；检查页面、固定标签、分组及跳过重复。停止操作在当前窗口处理完后生效，不承诺撤销已打开的窗口。
5. 两个测试会话包含相同网址，先预览重复引用，再选中清理；确认保留至少一份网址引用，并且每个会话保留至少一个页面以保留上下文。撤销应恢复这次本地数据修改。不要先拿唯一一份重要资料做清理测试。
6. 自动快照默认关闭；主动开启后看实际历史覆盖范围。免费最长 24 小时／50 份，Pro 最长 30 天／500 份，两者均受合计 4 MB 限制；不能承诺一定留满 30 天。手动会话不随快照清理删除。JSON 备份应包含命名启动方案，排除授权。

### C. 正式付款与购买恢复

1. 首先用已有 Pro 用户确认旧授权仍有效，不需要重新付费。管理后台原 Token 沿用。
2. 从**新版插件内**点击购买，确认进入本产品的付款入口、商品名称和价格正确；仅打开页面不等于付款。真实扣款测试应使用你指定的测试买家并在明确同意后完成一次，不在检查时反复创建订单。
3. 付款成功后返回原浏览器，确认服务核验后自动成为 Pro。关闭付款页或回调延迟时，在原插件中点“检查付款状态”，不要重复支付。付款成功页通知本身不直接授予 Pro。
4. 使用本产品的合法已付款邮箱，在“恢复购买”申请验证码，核对真实收件、垃圾邮件分类、验证码验证和 Pro 恢复。未购买邮箱不能解锁；界面正常响应也不代表已存在订单。
5. 必要时用已有授权码作为备用恢复。部分旧订单若未建邮箱摘要索引，需要从后台核对，不通过重新购买解决。
6. 若这次确实做了一笔生产付款，私下留存时间、产品、付款编号、自动激活结果；若按约定退款，再核对订单状态。现有离线授权不会因退款立即在全部设备撤销，不向用户承诺即时全设备停用。

本轮已完成 **87 项自动测试、8 个最终运行目录浏览器场景**；两款合计 167 项／15 场景，并做了对比度和新旧版本往返兼容检查。**支付、邮件和 AI 自动测试使用模拟响应，没有真实扣款、投递或收费 API 请求。** 不能把这些结果写成“生产支付和真实邮箱已全部验收”。

**完成标志：** 正式商店版本、原数据、旧 Pro、免费边界、新功能和生产购买／恢复都有结果记录；未做的项目明确记为待验收。

## 第 14 步｜你：了解老用户更新，遇到问题按表处理

### 老用户会不会自动更新

从原 Chrome 商店安装的用户通常会自动更新，但不会在你发布的一刻同时全部更新。关闭插件侧栏或设置页，等待浏览器空闲，必要时重新启动 Chrome；需要手动检查时打开 `chrome://extensions`，启用开发者模式后点“更新”。公司设备可能由管理员策略控制。

通过“加载已解压”安装的用户不能依赖商店自动更新，需要替换其本地运行文件后重新加载。始终提醒先备份，不要用“卸载重装”作为常规更新步骤。[Chrome 更新生命周期](https://developer.chrome.com/docs/extensions/develop/concepts/extensions-update-lifecycle)

### 常见问题

| 现象 | 你先做什么 | 交给我核对什么 |
| --- | --- | --- |
| 上传包结构错误 | 确认选了 `extension/tabvault-0.5.0.zip` | 原错误文字与所选文件名 |
| 版本号不够高 | 查看后台最新草稿／公开版本 | 重新打更高版本的完整包 |
| 英文中文混在一起 | 分别进入对应语言的商店资料 | 截图顺序和对应文案 |
| 用户仍显示旧版本 | 保留原安装，关闭侧栏、等待／重启后检查更新 | 原扩展 ID、版本、是否企业管理 |
| 已付款仍为 Free | 原浏览器检查付款状态，勿重复付款 | 本款商品、订单、回调和授权签名 |
| 邮箱没有验证码 | 核对结账邮箱及垃圾邮件，用旧授权码备用 | 发件服务、投递日志、旧订单邮箱索引 |
| 收不到客服邮件 | 从其他邮箱测试 support@tabplugins.top | Cloudflare 转发与目的地验证 |
| 免费额度提示不对 | 核对手动会话与项目，排除自动快照 | 本地记录与额度计算，不删除用户数据来试 |
| 历史范围不足 30 天 | 查看实际快照范围与总容量；旧内容可能已按规则清理 | 快照开启时间、数量及容量，不承诺找回不存在的记录 |
| 发布后出现明显故障 | 先保存新版 JSON，记录版本与重现操作 | 判断插件／服务问题，再选择修复或回滚 |

### 如果必须回退

先保留新版完整 JSON 和本次运行 ZIP，再在开发者后台 **Package → Roll back to previous version**（或更多菜单）选择回滚；是否可用以条目状态为准。按后台要求提供一个新版本号和原因，不能直接上传较低版本覆盖。回滚可能丢弃待审核／待发布提交，所以先和我核对要回到哪个归档版本。

本轮做过新版 → 原版本代码 → 新版的兼容检查；旧版无法显示新增命名启动方案等流程，不要让旧版导出覆盖唯一一份新版完整备份。回退后也要通过原条目更新，不卸载、不删订单库、不换 Stripe 商品或旧签名配置。[官方回滚说明](https://developer.chrome.com/docs/webstore/rollback)

### 最终发布记录（做完后填写）

| 项目 | 记录 |
| --- | --- |
| 上传版本／时间 | 0.5.0 ／ 待填写 |
| 提交审核时间 | 待填写 |
| 审核通过／待发布截止 | 待填写 |
| 正式发布时间 | 待填写 |
| 线上隐私页同步时间 | 待填写 |
| 官网权益与截图同步时间 | 待填写 |
| 旧用户数据及 Pro 验收 | 待填写 |
| 生产自动激活与邮件恢复 | 待填写；未测试则写待验收 |
| 后台／源码留档 | 本次原分支及发布归档保留；不要公开私密审核资料 |

做到这里，这款插件才完成从上传、审核到公开发布和正式验收的整套流程。另一款按它自己的指南、扩展 ID、软件包和审核码分别操作。
