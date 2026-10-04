// ============================================================
//  config.js  —  TabVault 唯一可调配置点
// ============================================================
//
//  ⚠️ SECRET：Pro License Key 的 HMAC 签名密钥，与 worker / tools/keygen.mjs 必须一致。
//     首次配置可以生成随机串；已发布产品更新时保留原值，保证旧 Key 可用。
//     真实 SECRET 仅写入发布暂存目录，不提交到公开仓库。
//
//  ⚠️ STRIPE_PAYMENT_LINK：指向你自己 Worker 的 /buy（Worker 再 302 到 Stripe Payment Link）。
//
//  免费 / Pro 额度都在这调，改完刷新侧边栏即生效（老用户下次启动生效）。

const CONFIG = {
  SECRET: "REPLACE_WITH_YOUR_OWN_SECRET",

  STRIPE_PAYMENT_LINK: "https://tabvault-pro-api.wd933781.workers.dev/buy",

  FREE: {
    maxManualSessions: 5,   // 免费可保存的手动会话数
    auto: false,            // 自动备份（Pro）
    search: false,          // 跨会话搜索标签（Pro）
    export: false,          // 导出/导入 JSON（Pro）
    keepAutoBackups: 1      // 免费版不开自动备份；已有快照不会在降级时删除
  },

  PRO: {
    maxManualSessions: Infinity,
    auto: true,
    search: true,
    export: true,
    keepAutoBackups: 20
  },

  AUTO_INTERVAL_MIN: 15     // 自动备份间隔（分钟）
};
