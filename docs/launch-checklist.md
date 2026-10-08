# TabVault 0.4.0 发布核对

- [ ] Worker 先应用 0002_activation.sql，再部署 Billing 2.1.0。
- [ ] 核对原商店 EXTENSION_ID；保留旧签名、商品与订单库。
- [ ] 如启用邮箱恢复，配置 Resend 已验证发件域名、RESEND_API_KEY、BILLING_EMAIL_FROM，实际验收邮件送达。
- [ ] 独立测试环境验收付款成功通知、关闭成功页后核对、延迟付款及失败重试。
- [ ] 在原 Chrome 商店条目上传 tabvault-0.4.0.zip，并使用新版中英文素材和隐私声明；不要卸载旧扩展或新建条目。
- [ ] 原历史订单的邮箱摘要需要重新核对建立；旧授权码始终作为备用。
- [ ] 核对 Pages 官网、隐私与支持链接。源码分支和本地 ZIP 不等于商店已发布。

详见 worker/DEPLOY.md 与 chrome-store-publish-guide.md。
