/* ============================================================
   keygen.mjs — 为 TabVault Pro 签发 License Key
   ------------------------------------------------------------
   两种模式:

   A) 手动签发（任意标签/期限）:
     node tools/keygen.mjs --secret "你的SECRET" --days 365 --label buyer@x.com
     node tools/keygen.mjs --secret "你的SECRET" --plan pro            # 永不过期

   B) 与 Cloudflare Worker 一致的确定性签发（按 Stripe 会话 id）:
     node tools/keygen.mjs --secret "你的SECRET" --sid cs_test_abc123
     # 同一个 sid 永远得到同一个 key —— Worker 的 /success 页就是这么算的

   说明:
     - --secret 必须与扩展 config.js / Worker SECRET 完全一致。
     - SECRET=xxx 环境变量方式同样可用。
   ============================================================ */
import { createHmac } from "node:crypto";

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const args = process.argv.slice(2);
const get = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const secret = get("secret") || process.env.SECRET;
if (!secret || secret.includes("CHANGE_ME")) {
  console.error("❌ 请用 --secret 或环境变量 SECRET 提供与 config.js 相同的密钥。");
  process.exit(1);
}

const sid = get("sid");

if (sid) {
  // 确定性模式：payload 只由 sid 决定，与 Worker /success 页算法一致
  const payload = { plan: "pro", label: sid, via: "stripe" };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret).update(payloadB64).digest());
  console.log("\nLicense Key (确定性，由 sid 派生):\n");
  console.log(`${payloadB64}.${sig}\n`);
  process.exit(0);
}

// 批量模式：node tools/keygen.mjs --secret X --num 50 --out keys.txt
// 用途：把 keys.txt 每行一把导入 Gumroad / Lemon Squeezy 的 license key 池，实现自动发货
const num = get("num");
if (num) {
  const { randomBytes } = await import("node:crypto");
  const lines = [];
  for (let i = 0; i < Number(num); i++) {
    const payload = { plan: "pro", label: "pool_" + randomBytes(6).toString("hex"), via: "pool" };
    const payloadB64 = b64url(JSON.stringify(payload));
    const sig = b64url(createHmac("sha256", secret).update(payloadB64).digest());
    lines.push(`${payloadB64}.${sig}`);
  }
  const out = get("out");
  if (out) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(out, lines.join("\n") + "\n");
    console.log(`✅ ${num} 把密钥已写入 ${out}`);
  } else console.log(lines.join("\n"));
  process.exit(0);
}

const plan = get("plan") || "pro";
const days = get("days");
const label = get("label") || "";

const payload = { plan, label };
if (days) payload.exp = Math.floor(Date.now() / 1000) + Number(days) * 86400;
// 不传 --days => 无 exp => 永久

const payloadB64 = b64url(JSON.stringify(payload));
const sig = b64url(createHmac("sha256", secret).update(payloadB64).digest());
const key = `${payloadB64}.${sig}`;

console.log("\nLicense Key:\n");
console.log(key);
console.log("\n" + (payload.exp
  ? `有效期至: ${new Date(payload.exp * 1000).toLocaleString()}`
  : "有效期: 永久"));
console.log(`计划: ${plan}  标签: ${label || "(无)"}\n`);
