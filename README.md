# TabVault

Chrome 侧边栏扩展，当前版本 0.3.0；需要 Chrome 116 或更新版本。

保存窗口中的 HTTP/HTTPS 标签并恢复到新窗口或当前窗口，保留重复网址和固定标签。免费版 5 个手动会话；Pro 增加跨会话搜索、导入导出和可选自动备份。自动备份默认关闭，开启后每 15 分钟备份普通窗口，保留最多 20 份自动快照（所有窗口合计），并维护本地窗口恢复缓存。恢复只能找回已有快照中的内容。

## 本地加载与测试

1. 在 chrome://extensions 开启开发者模式，加载本仓库目录。
2. 工具栏点击扩展图标打开侧栏。
3. 回归测试：npm test。 签名兼容测试：node tools/selftest.mjs。
4. UI 构建：npm ci 后执行 npm run build；生成的 sidepanel.js / sidepanel.css 已随仓库提交，普通本地加载不需要先构建。
5. 默认英文。顶部 EN / 中 或设置中的语言选项可切换简体中文；语言、浅色 / 深色 / 跟随系统偏好保存在本机并在多个窗口同步。

## 界面与品牌

React + Tailwind CSS + shadcn/ui（Base UI）+ Motion + Lucide；使用本地打包组件，符合扩展 CSP，无运行时 CDN。保留原 Manifest V3 service worker 的数据与授权结构。Motion 与样式遵循减少动态效果偏好。

新版界面示例和 Logo 见 docs/assets。

## 存储与迁移

界面发送具体操作；service worker 串行读取最新数据并持久保存，所有侧栏监听存储变化。旧数据键保留。异常旧记录修改前会保留在 tv_recovery_backup_v1，导入则必须完整通过校验。不要卸载扩展来更新，以免删除已有数据。

## 发布与付款服务

- 扩展 ZIP 只包含 manifest、运行脚本、样式、页面和图标。manifest.json 放在 ZIP 根目录。
- config.js 在公开仓库中保持占位密钥；发布包注入与现有线上服务一致的原密钥，避免老 Key 失效。不要把真实密钥提交到 GitHub。
- Worker Billing 2.0.0：API 创建 Stripe Checkout，D1 独立订单库，签名 Webhook 核对支付。部署与后台使用说明见 [worker/DEPLOY.md](worker/DEPLOY.md)。保留原 LIC_SECRET；Stripe、Webhook 和管理员密钥仅存 Worker secrets。
- 购买页先披露订单数据处理，确认后用本商品现有 Price 创建订单。只对正确商品、价格和已完成付款签发；旧 Payment Link 订单兼容。生产拒绝测试订单，首次配置入口已关闭。
- 当前仍为客户端 HMAC，能读取安装包的技术用户可以取得签名密钥；设备限制和退款撤销并未实现。更强的许可方案应另行迁移到服务端私钥签发或授权记录。

## 隐私

会话、快照和窗口缓存仅存本机；主动开启备份后会监听标签变化用于本地恢复。显示图标会直接请求对应站点的同源图标，不通过开发者服务。 付款由 Stripe 处理；Cloudflare 保存订单编号、金额与付款／退款状态，用于授权签发和找回，任务与标签会话不会上传到订单服务。开发者不接收使用遥测。完整隐私政策见 docs/PRIVACY.html。

修复列表见 CHANGELOG.md。
