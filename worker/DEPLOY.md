# 订单服务部署与管理（Billing 2.0.0）

更新时间：2026-10-05。仅更新 Worker 与网站说明，扩展运行包版本不变。

## 已上线的购买流程

插件 /buy → 中英文购买说明与同意 → POST /checkout → Worker 用服务器 Price 创建 Stripe Checkout Session → Stripe 付款 → /success 展示授权 Key。Stripe Webhook 即使用户未返回成功页，也会核对付款并将授权签发状态记入订单。Key 仍由原 LIC_SECRET 确定性派生；本次不轮换它。

每个插件有独立的 D1 ORDERS_DB 与管理员密钥。GET /admin 打开订单后台，语言默认英文，?lang=zh 为中文。登录后可搜索、筛选、分页、向 Stripe 核对状态、领取已付款订单的授权和关闭自有未付款订单。输入完整旧 cs_ 编号后点击 Reconcile checkout reference 可录入、核对旧 Payment Link 订单。旧订单没有全量自动回填；通过旧成功页、回调或管理员核对时记录。

## 配置

wrangler.toml 中的 Price / Payment Link / Webhook 编号可公开。API key、webhook 签名密钥、管理员密钥只放 Worker secrets，不放扩展、GitHub 或文档。LIC_SECRET 继续保留原值，以兼容原有发布包和授权。

| Worker secret | 用途 |
| --- | --- |
| LIC_SECRET | 原授权签名配置，禁止随意更换 |
| STRIPE_SECRET_KEY | Stripe 服务器 API；已有线上值继续使用 |
| STRIPE_WEBHOOK_SECRET | 本 Worker 的 Stripe 回调签名；两个端点分别配置 |
| ADMIN_TOKEN | 高强度随机管理员访问密钥；两个后台分别配置 |

关键 vars：CHECKOUT_MODE=api、ALLOW_TEST_PAYMENTS=false、ENABLE_PROVISIONING=false；STRIPE_PRICE_ID 为本产品现有一次性价格；PUBLIC_ORIGIN 为本 Worker HTTPS 地址。旧 STRIPE_PAYMENT_LINK 与 EXPECTED_PAYMENT_LINK_ID 保留用于兼容订单；ALLOW_PROMOTION_CODES、AUTOMATIC_TAX 沿用原链接设置。

## 现有服务后续部署

在 worker 目录操作，使用已登录 Cloudflare 的 Wrangler。执行前确认目标 Worker / 数据库名称，保留 wrangler.toml 的绑定与价格配置：

```sh
npx wrangler d1 migrations apply ORDERS_DB --remote
npx wrangler deploy --keep-vars
```

已应用的迁移不会重复创建表。不要删库、清表或覆盖 LIC_SECRET。秘密值通过交互 secret put 或私密 JSON 的 secret bulk 注入，切勿加到命令参数或提交 JSON 文件。不要将 Wrangler 登录缓存、管理员密钥或 Stripe secret 放进发布包。

## Stripe 回调

端点为 PUBLIC_ORIGIN/webhook；API 版本固定 2025-02-24.acacia，启用 checkout.session.completed、checkout.session.async_payment_succeeded、checkout.session.async_payment_failed、checkout.session.expired、charge.refunded。Worker 验证原始请求签名和 5 分钟时间窗，通过 Stripe API 再核对本产品、服务器订单、价格与付款状态。D1 将订单更新与事件记录放在同一批事务；重复回调不重复签发，临时失败返回错误供 Stripe 重试。

GET /api/admin/config（Bearer ADMIN_TOKEN）可读回端点状态、URL、事件列表和 Price 编号，不返回秘密值。GET /status 是不含秘密值的公开运行状态。

首次部署助手曾短暂开启 POST /api/admin/provision，并通过受保护请求沿用原链接商品、价格和设置创建回调。现已 ENABLE_PROVISIONING=false，返回 403。日常管理不要开启它；更换端点应在 Stripe 创建对应端点并在 Cloudflare 更换对应签名密钥。

## 运营与兼容

- 退款在 Stripe Dashboard 处理；回调在后台记录部分／全额退款，拒绝重新签发已退款订单的 Key。
- 已在扩展中激活的离线授权不会自动撤销。当前客户端 HMAC 签名方案的限制保持不变；若需强制撤销、设备数控制或账户体系，应另做授权协议迁移。
- 延迟付款在 Stripe 显示成功前不签发；优惠产生 0 金额的自有 API 订单通过服务端 SKU 核对后可签发。
- 找回旧订单时核实购买者身份，私下发送 Key；勿在 GitHub Issue 公开付款编号或授权。
- 没有自动授权邮件；用户从成功页领取。Stripe 收据邮件取决于 Stripe 账户配置。
- 订单数据库只保存授权与付款状态相关字段，不存卡信息、结账邮箱、任务或标签会话；目前不自动清理，数据删除请求由管理员处理。
- 如需临时回退，设 CHECKOUT_MODE=payment_link 后部署。保留数据库、Webhook 与原签名密钥，原 API 订单仍可通过成功页领取授权。

## 测试

仓库根目录 npm test：原扩展回归 + worker/billing.test.mjs。需要 Node >=22.13（测试使用内置 SQLite 验证 SQL）；生产 Worker 无 Node/Stripe SDK 依赖。

本次验证了正式 Stripe 的待付款创建与关闭，没有真实扣款。已付款、延迟付款、退款与失败重试由本地模拟 Stripe API 和真实 SQLite 测试覆盖。正式卡不能使用测试卡号；测试购买必须使用独立测试 Worker、测试价格、测试密钥和测试回调，勿临时放开线上 ALLOW_TEST_PAYMENTS。
