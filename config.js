// ============================================================
//  config.js  —  TabVault 唯一可调配置点
// ============================================================
//
//  ⚠️ SECRET：Pro License Key 的 HMAC 签名密钥，与 worker / tools/keygen.mjs 必须一致。
//     首次配置可以生成随机串；已发布产品更新时保留原值，保证旧 Key 可用。
//     真实 SECRET 仅写入发布暂存目录，不提交到公开仓库。
//
//  ⚠️ STRIPE_PAYMENT_LINK：指向你自己 Worker 的 /buy（Worker 核对现有商品价格并创建 Stripe Checkout）。
//
//  免费 / Pro 额度都在这调，改完刷新侧边栏即生效（老用户下次启动生效）。

const CONFIG = {
  PRODUCT: 'tabvault',
  SECRET: "REPLACE_WITH_YOUR_OWN_SECRET",

  STRIPE_PAYMENT_LINK: "https://tabvault-pro-api.wd933781.workers.dev/buy",

  FREE: {
    maxManualSessions: 10,   // 免费可保存的手动会话数
    auto: true,            // 可选自动备份，免费保留最近 3 份
    search: true,          // 免费标题 / 网址搜索
    export: true,          // 免费导出 / 导入 JSON
    projects: false, organize: false, advancedRestore: false,
    keepAutoBackups: 3      // 开启后滚动保留；解除授权不会立即删除旧数据
  },

  PRO: {
    maxManualSessions: Infinity,
    auto: true,
    search: true,
    export: true,
    projects: true, organize: true, advancedRestore: true,
    keepAutoBackups: 500, historyDays: 30
  },

  MAX_AUTO_BYTES: 4 * 1024 * 1024,
  AUTO_INTERVAL_MIN: 15     // 自动备份间隔（分钟）
};
