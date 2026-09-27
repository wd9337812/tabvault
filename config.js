// ============================================================
//  config.js  —  TabVault 唯一可调配置点
// ============================================================
//
//  ⚠️ SECRET：Pro License Key 的 HMAC 签名密钥，与 worker / tools/keygen.mjs 必须一致。
//     重新生成：node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
//     真实 SECRET 永远不要提交到公开仓库（git update-index --skip-worktree config.js）。
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
    keepAutoBackups: 1      // 免费版只保留最近 1 份自动备份（且默认不开自动备份）
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
