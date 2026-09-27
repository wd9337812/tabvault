/**
 * setup.mjs — TabVault 付费闭环一键部署（交互式，面向新手）
 * ================================================================
 * 运行：  node setup.mjs        （在 side-task-collector 目录下）
 *
 * 你只需要准备两样东西：
 *   1) 一个 Cloudflare 免费账号（脚本会弹浏览器让你点一下授权）
 *   2) 一个 Stripe Payment Link（https://buy.stripe.com/xxxx）
 *
 * 脚本自动完成：
 *   生成 SECRET → 写入扩展 config.js → 部署 Worker → 回填域名
 *   → 健康检查 → 给你本人签发一把永久 Pro Key（自己先解锁体验）
 * 最后打印 2 个需要你去 Stripe 后台粘贴的 URL，全程闭环。
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = path.join(ROOT, "worker");
const CONFIG_PATH = path.join(ROOT, "config.js");
const WRANGLER_TOML = path.join(WORKER_DIR, "wrangler.toml");

const rl = createInterface({ input: stdin, output: stdout });
const ask = (q) => rl.question(q);

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || ROOT,
      stdio: opts.pipe ? ["pipe", "pipe", "pipe"] : "inherit",
      shell: true,
      env: { ...process.env, ...(opts.env || {}) },
    });
    let out = "";
    if (opts.pipe) {
      child.stdout.on("data", (d) => { out += d; process.stdout.write(d); });
      child.stderr.on("data", (d) => { out += d; process.stderr.write(d); });
    }
    if (opts.stdinValue != null) { child.stdin.write(opts.stdinValue); child.stdin.end(); }
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`命令退出码 ${code}: ${cmd}`))));
  });
}

const step = (n, msg) => console.log(`\n\x1b[36m【第 ${n} 步】\x1b[0m ${msg}`);

async function main() {
  console.log("\n========== TabVault 付费闭环部署向导 ==========\n");

  // ---------- 1. Cloudflare 登录 ----------
  step(1, "检查 Cloudflare 登录状态");
  try {
    await run("npx", ["--yes", "wrangler", "whoami"]);
    console.log("✅ 已登录 Cloudflare，直接进入下一步");
  } catch {
    console.log(`
  ┌─ 你还没有登录 Cloudflare，接下来会发生：
  │  1) 自动弹出浏览器，打开 Cloudflare 授权页（没弹就等几秒或看任务栏）
  │  2) 页面里：有账号 → 输密码登录；没账号 → 点 sign up 用邮箱免费注册
  │  3) 登录后点蓝色的 【Allow】 允许 wrangler 访问
  │  4) 回到本终端，看到 Successfully logged in 即成功，脚本自动继续
  │
  │  ⚠️ 若长时间没反应（你可能开了代理）：按 Ctrl+C 退出本脚本，
  │     手动执行  npx wrangler login  完成授权后，再重新运行 node setup.mjs
  └─`);
    await run("npx", ["--yes", "wrangler", "login"]);
    await run("npx", ["--yes", "wrangler", "whoami"]);
    console.log("✅ 授权完成");
  }

  // ---------- 2. Stripe 链接 + API key ----------
  step(2, "输入你的 Stripe Payment Link 与 API secret key");
  console.log("（Payment Link：Stripe 后台 → Payment links → 复制 https://buy.stripe.com/…）");
  console.log("（API key：Stripe 后台 → Developers → API keys → 复制 sk_test_… 开头的标准密钥）");
  let stripeLink = (await ask("粘贴 Payment Link: ")).trim();
  while (!/^https:\/\/buy\.stripe\.com\/.+/.test(stripeLink) && !/^https:\/\/[a-z0-9.-]+\.(lemonsqueezy|gumroad|paddle)/i.test(stripeLink)) {
    stripeLink = (await ask("  链接格式不对，请重新粘贴: ")).trim();
  }
  let stripeKey = (await ask("粘贴 API secret key（sk_test_… / sk_live_…）: ")).trim();
  while (!/^sk_(test|live)_[A-Za-z0-9]+/.test(stripeKey)) {
    stripeKey = (await ask("  key 格式不对（应以 sk_test_ 或 sk_live_ 开头），重新粘贴: ")).trim();
  }

  // ---------- 3. 生成 SECRET 并写入三处 ----------
  step(3, "生成随机 SECRET 并写入配置");
  const SECRET = randomBytes(24).toString("hex");
  console.log(`生成的 SECRET: ${SECRET}`);
  console.log(" 拿个小本本记下来（以后客服补发 Key 要用），本脚本也会写入 config.js");

  let cfg = readFileSync(CONFIG_PATH, "utf8");
  cfg = cfg.replace(/SECRET:\s*"[^"]*"/, `SECRET: "${SECRET}"`);
  writeFileSync(CONFIG_PATH, cfg);

  let toml = readFileSync(WRANGLER_TOML, "utf8");
  toml = toml.replace(/STRIPE_PAYMENT_LINK\s*=\s*"[^"]*"/, `STRIPE_PAYMENT_LINK = "${stripeLink}"`);
  writeFileSync(WRANGLER_TOML, toml);
  console.log("✅ config.js SECRET / wrangler.toml Stripe 链接 已写入");
  console.log("⚠️ config.js 现在含有真实 SECRET——若仓库在 GitHub 是公开的，请勿把这个版本的 config.js 再 commit/push。");

  // ---------- 4. 部署 Worker ----------
  step(4, "上传 SECRET / STRIPE_SECRET_KEY 并部署 Worker 到 Cloudflare（约 30 秒）");
  await run("npx", ["--yes", "wrangler", "secret", "put", "LIC_SECRET"], {
    cwd: WORKER_DIR, stdinValue: SECRET, pipe: true,
  });
  await run("npx", ["--yes", "wrangler", "secret", "put", "STRIPE_SECRET_KEY"], {
    cwd: WORKER_DIR, stdinValue: stripeKey, pipe: true,
  });
  const deployOut = await run("npx", ["--yes", "wrangler", "deploy"], {
    cwd: WORKER_DIR, pipe: true,
  });
  const m = deployOut.match(/https:\/\/[\w-]+\.[\w-]+\.workers\.dev/);
  if (!m) { console.log("⚠️ 未能自动识别域名，请从上方输出复制 workers.dev 地址"); var domain = (await ask("你的 Worker 域名: ")).trim().replace(/\/$/, ""); }
  else var domain = m[0];
  console.log(`✅ Worker 已上线: ${domain}`);

  // ---------- 5. 回填购买入口 + 健康检查 ----------
  step(5, "回填扩展购买链接并做健康检查");
  cfg = readFileSync(CONFIG_PATH, "utf8");
  cfg = cfg.replace(/STRIPE_PAYMENT_LINK:\s*"[^"]*"/, `STRIPE_PAYMENT_LINK: "${domain}/buy"`);
  writeFileSync(CONFIG_PATH, cfg);
  const health = await fetch(`${domain}/health`).then((r) => r.text()).catch(() => "");
  console.log(health.trim() === "ok" ? "✅ /health 检查通过" : "⚠️ /health 未返回 ok，请检查网络后重试");

  // ---------- 6. 给你自己签发 Pro Key ----------
  step(6, "给你本人签发一把永久 Pro Key（先解锁自己体验）");
  const { computeKey } = await import(pathToFileURL(path.join(WORKER_DIR, "index.js")).href);
  const selfSid = "cs_owner_" + randomBytes(8).toString("hex");
  const myKey = await computeKey(SECRET, selfSid);
  console.log(`\n🔑 你的专属 Key（扩展 ⚙ 里粘贴激活）:\n${myKey}\n`);

  // ---------- 7. 收尾：需要手动做的 2 件事 ----------
  step(7, "最后只剩 2 件手动的事");
  console.log(`
  ① 去 Stripe 后台把你 Payment Link 的 Success URL 设为：
     \x1b[33m${domain}/success?sid={CHECKOUT_SESSION_ID}\x1b[0m

  ② 打开 chrome://extensions → 本扩展点 ⟳ 重新加载 → 双击侧边栏图标
     → 在 ⚙ 里粘贴上面的 🔑 Key → 激活 → 看到 PRO 角标即全部打通！

  验证收款闭环：结账页用测试卡 4242 4242 4242 4242（测试模式链接）
  付款后成功页应自动出现你的 License Key。
`);
  rl.close();
}

main().catch((e) => { console.error("\n❌ 部署中断:", e.message, "\n（把报错截图发给 Qoder 即可继续排查）"); process.exit(1); });
