# Billing 2.1.0 部署与购买恢复

代码待发布，2026-10-08。保留现有 Stripe 商品、Price、Payment Link、D1、Webhook 和 LIC_SECRET，禁止为更新新建商品或轮换旧授权签名。

## 流程

插件生成本机随机凭证 → /buy?claim=… → 订单处理同意 → /checkout → Stripe → 签名 Webhook／Stripe API 核对 → 成功页通知已发布的 EXTENSION_ID → 插件用原凭证请求 /api/activation → 本地验证原格式授权 → Pro。外部消息本身不授予 Pro；关闭成功页仍可通过启动／焦点检查或手动按钮恢复。重复结账请求复用同一订单与 Checkout Session。

## 部署顺序

1. 先核对 wrangler.toml 的 Worker、D1、Price、产品及 EXTENSION_ID 为已有商店条目。
2. 在 worker 目录执行迁移，再发布 Worker：

```sh
npx wrangler d1 migrations apply ORDERS_DB --remote
npx wrangler deploy
```

0002_activation.sql 新增凭证、购买邮箱摘要及验证码表，不删除原订单。默认 deploy 同步当前 wrangler.toml vars；若你使用 --keep-vars，应先在 Cloudflare 手动添加 EXTENSION_ID 等新 vars。Secrets 保留现有值。先验证 /status 的 version=2.1.0、activation=true，再发布扩展更新。

## 邮件恢复配置

| 配置 | 位置与用途 |
| --- | --- |
| LIC_SECRET | 原 Worker secret；保留原值 |
| STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET | 原付款与回调 secrets |
| ADMIN_TOKEN | 原后台认证 secret |
| EXTENSION_ID | wrangler vars；原商店 ID |
| RESEND_API_KEY | 新 Worker secret；通过 wrangler secret put 交互设置 |
| BILLING_EMAIL_FROM | 新 Worker secret 或 vars；Resend 已验证域名下的发件地址 |

邮件服务配置缺失时，恢复购买会明确提示，自动激活与旧授权码不受影响。验证码 10 分钟、最多 5 次、成功后不可重用；邮箱及请求 IP 做带密钥摘要，D1 不存明文邮箱或验证码。挑战记录超过 24 小时在后续申请时清理，订单摘要保留用于找回。

旧历史订单没有全量邮箱回填。通过管理员 /admin 的付款编号核对、旧成功页或后续有效回调重新核对时会建立摘要索引；若未建立索引，继续使用旧授权码或私下联系支持。不可通过用户填写一个邮箱直接激活。

## 运营与验证

/admin 保留受保护的订单搜索、核对、领取授权及关闭自有未付款订单。退款在 Stripe 后台处理，签名回调更新退款状态，服务器拒绝重新签发；已在本机激活的离线 HMAC 授权不会自动撤销，不支持设备数量控制。网站直接购买没有安装实例凭证，可使用成功页的备用授权码。

npm test 包含原付款测试与新增自动激活／购买恢复测试。使用真实 SQLite 和模拟 Stripe／Resend，不真实扣款、不发邮件。上线前在独立测试环境验证真实邮箱送达与已发布扩展回调；真实 AI 也需你的可用服务 Key 验收。测试配置不得临时覆盖生产 Price 或开放 ALLOW_TEST_PAYMENTS。

回退时可发布上一 Worker，但先停用新版自动入口或恢复上一扩展版本；保留 D1 所有表、Webhook 和签名 secrets。切换旧 Payment Link 不具备安装实例自动配对，须说明手动授权备用流程。
