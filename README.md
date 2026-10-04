# TabVault

Chrome 侧边栏扩展，当前版本 0.2.1；需要 Chrome 116 或更新版本。

保存窗口中的 HTTP/HTTPS 标签并恢复到新窗口或当前窗口，保留重复网址和固定标签。免费版 5 个手动会话；Pro 增加跨会话搜索、导入导出和可选自动备份。自动备份默认关闭，开启后每 15 分钟备份普通窗口，保留最多 20 份自动快照（所有窗口合计），并维护本地窗口恢复缓存。恢复只能找回已有快照中的内容。

## 本地加载与测试

1. 在 chrome://extensions 开启开发者模式，加载本仓库目录。
2. 工具栏点击扩展图标打开侧栏。
3. 回归测试：node tools/regression.mjs。 签名兼容测试：node tools/selftest.mjs。
4. UI 预览仅用于浏览器直接打开 sidepanel.html?demo=pro；真实扩展会忽略 demo 参数。

## 存储与迁移

界面发送具体操作；service worker 串行读取最新数据并持久保存，所有侧栏监听存储变化。旧数据键保留。异常旧记录修改前会保留在 tv_recovery_backup_v1，导入则必须完整通过校验。不要卸载扩展来更新，以免删除已有数据。

## 发布与付款服务

- 扩展 ZIP 只包含 manifest、运行脚本、样式、页面和图标。manifest.json 放在 ZIP 根目录。
- config.js 在公开仓库中保持占位密钥；发布包注入与现有线上服务一致的原密钥，避免老 Key 失效。不要把真实密钥提交到 GitHub。
- Worker 部署：在 worker 目录执行 wrangler deploy --keep-vars，保留现有 LIC_SECRET 和 STRIPE_SECRET_KEY。
- Worker 将 paid、complete、payment 模式的正式 Session 与 STRIPE_PAYMENT_LINK 对应的实际 Payment Link 核对后才签发。测试环境如需测试订单，单独配置 ALLOW_TEST_PAYMENTS=true；生产默认拒绝。
- 当前仍为客户端 HMAC，能读取安装包的技术用户可以取得签名密钥；设备限制和退款撤销并未实现。更强的许可方案应另行迁移到服务端私钥签发或授权记录。

## 隐私

会话、快照和窗口缓存仅存本机；主动开启备份后会监听标签变化用于本地恢复。显示图标会直接请求对应站点的同源图标，不通过开发者服务。 购买页由 Stripe 处理；开发者不接收使用遥测。完整隐私政策见 docs/PRIVACY.html。

修复列表见 CHANGELOG.md。
