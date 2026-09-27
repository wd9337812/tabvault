# TabVault 上线清单：剩下 4 步（v1 · 2026-09-28）

> 分工图例：🖱 = 只有你能点（浏览器授权 / Dashboard / 付款）；🤖 = 交给我代跑。
> 顺序有依赖：Stripe 链接 → Worker 部署 → 测试验收 → 切 live → GitHub/Pages → CWS 提审。
> 预计总耗时：你点击约 20 分钟 + 审核等待 1~5 天。
> 配套文档：第 4 步的逐屏字段见 [chrome-store-publish-guide.md](chrome-store-publish-guide.md)。

## 第 0 步 · 预检（🤖 已完成，2026-09-28）

- 三端签名 selftest 6/6 PASS；商店 zip 11 个条目、泄密断言通过（无 sk_live / account_id）。
- 提交历史里的 `config.js` 是占位值，真实 SECRET 由 skip-worktree 保护 → 推 GitHub 安全。
- 全部商店素材为精确尺寸无 alpha JPEG。**直接从第 1 步开始。**

## 第 1 步 · Stripe：$6 Payment Link + 成功跳转（🖱 约 5 分钟）

先用 **Test mode** 零成本跑通，第 2 步验收后再切 live（切法见第 2 步末）。

1. 🖱 打开 dashboard.stripe.com，**右上角切到 Test mode**。
2. 🖱 左侧菜单 **Payment links → New / Create payment link**：
   - 产品：name = `TabVault Pro`；计价 = **One-time**；金额 = `6.00`；币种 = USD
     （账户结算币是 HKD 不影响，顾客看到的就是 $6）。
   - 点 **Create link** → 复制生成的 `https://buy.stripe.com/...` 链接。
3. 🖱 设成功跳转（API 改不动，只能 Dashboard，实测结论）：
   Payment links 列表 → 点开该链接 → 编辑 → **「After the payment」** 区块 →
   把默认确认页改成 **跳转到自定义 URL** → 粘贴（占位符照抄，Stripe 会自动替换成真实
   session id，见[官方 post-payment 文档](https://docs.stripe.com/payment-links/post-payment)）：
   ```
   https://tabvault-pro-api.wd933781.workers.dev/success?sid={CHECKOUT_SESSION_ID}
   ```
4. 🖱→🤖 把 buy.stripe.com 链接发我，我回填 `worker/wrangler.toml` 的 `STRIPE_PAYMENT_LINK`。

## 第 2 步 · Worker 部署 + 两个 secret + 测试验收（🤖 为主）

1. 🤖 我跑 `cd tab-vault/worker && npx wrangler deploy`。
   🖱 首次会弹 Cloudflare 授权页：用 **wd933781@gmail.com**（与 TabTasks 同账号）登录点 Allow。
2. 🤖 我代注入 LIC_SECRET（从本地 config.js 管道读取，密钥全程不进聊天）：
   ```bash
   cd worker
   node -e "const s=require('fs').readFileSync('../config.js','utf8');process.stdout.write(s.match(/SECRET:\s*\"([0-9a-f]{32,})\"/)[1])" | npx wrangler secret put LIC_SECRET
   ```
3. 🖱 **唯一需要你亲手敲的一条命令**（sk 不经我/聊天中转）：
   ```bash
   npx wrangler secret put STRIPE_SECRET_KEY
   ```
   回车后粘贴 **sk_test_...**（Dashboard → Developers → API keys → Standard keys → Reveal）。
4. 🤖 我验证三件事：`/buy` 返回 302 且 location 是 buy.stripe.com；
   `/success?sid=cs_test_garbage` 返回拒绝页（伪造防御生效）；`/health` 返回 200。
5. 🖱 测试验收：扩展抽屉 → Buy Pro → 测试卡 `4242 4242 4242 4242`、任意未来有效期、
   任意 CVC/邮编 → 付款 → 跳回 /success 出现 License Key → 复制粘贴进抽屉激活 →
   PRO 徽标亮起；再把 key 改一个字符重贴 → **必须失败**。任何一步红屏截图发我。
6. 🖱+🤖 全绿后切 live（三处替换）：
   - 关掉 Test mode，**live 模式另建一个 $6 链接**（test 链接在 live 不生效）并按第 1.3 设同样跳转；新链接发我替换 wrangler.toml 并重新 deploy；
   - 你重跑 `npx wrangler secret put STRIPE_SECRET_KEY` 粘贴 **sk_live_...**（覆盖旧值）；
   - 可选：真付 $6 一单再 Refund（Dashboard → Payments → 该笔 → Refund）；
     已发出的 key 不受退款影响（本地验签设计，属预期）。

## 第 3 步 · GitHub 公开仓库 + Pages（🖱 两次点击，🤖 推代码）

1. 🤖 推前自查：`git show HEAD:config.js` 含占位值、`git ls-files -v | grep '^S'` 只有
   config.js、工作区干净。
2. 🖱 github.com/new → owner `wd9337812`、Repository name `tabvault`、**Public**、
   三个初始化勾（README/.gitignore/license）**都不勾** → Create repository。
3. 🤖 我跑：`git remote add origin https://github.com/wd9337812/tabvault.git &&
   git push -u origin master:main`（弹凭据窗时你点授权）。
4. 🖱 仓库 Settings → **Pages** → Build and deployment：Source = *Deploy from a branch*；
   Branch = `main` + `/docs` → Save。约 1 分钟后生效，记下三个 URL（第 4 步要填）：
   ```
   https://wd9337812.github.io/tabvault/            落地页
   https://wd9337812.github.io/tabvault/PRIVACY.html   隐私政策
   https://wd9337812.github.io/tabvault/SUPPORT.html   支持页
   ```

## 第 4 步 · CWS 提审（🖱 全点击，照逐屏指南填）

1. 🖱 打开 [chrome-store-publish-guide.md](chrome-store-publish-guide.md)，对照左侧 4 个
   标签页逐屏填，**不要凭记忆**。
2. 🖱 chrome.google.com/webstore/devconsole → **New item** → 上传：
   `C:\Users\27877\Documents\Qoder\2026-09-26\5b75f644\tabvault-extension-store.zip`
3. 🖱 素材用 `..\tabvault-store-images\`：4 张 1280x800 截图 + 440x280 小图块 + 1400x560 大图块。
4. 🖱 隐私政策 / 支持页填第 3 步记下的 Pages URL。
5. 🖱 提交前自查（指南文末拒审表）：description ≤132 字符；五格权限理由逐格对应；
   数据声明按指南勾；价格选 **Free**（Pro 是产品内一次性 $6，不开 CWS 内购）。
6. 🖱 点提交 → 状态变 *Pending review*（新账号 1~5 天常见）。**审核期间不要换包**，
   否则重置排队。

## 附录 A · 总验收单

- [ ] `/buy` 302 → buy.stripe.com（live 链接）
- [ ] live 真单或 test 单：/success 出 key → 激活成功 → 改 1 字符激活失败
- [ ] 三个 Pages URL 均 200
- [ ] CWS 状态 Pending review → 过审后 Published
- [ ] 过审后把 en/zh 字典回灌 TabTasks（它过审之后再做）

## 附录 B · 故障速查

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| /buy 不跳 Stripe | wrangler.toml 改后没 redeploy | 🤖 重跑 deploy |
| /success 报 sid 无效 | 跳转 URL 占位符拼错 | 核对 `{CHECKOUT_SESSION_ID}` 逐字符 |
| 激活失败但 key 看着对 | Worker LIC_SECRET ≠ config.js SECRET | 🤖 重跑第 2.2 管道注入 |
| Pages 404 | 分支/目录选错 | 必须是 main + /docs |
| CWS 报"图片尺寸不正确" | 尺寸或 alpha | 用 tabvault-store-images 里的 JPEG，别用 PNG |
