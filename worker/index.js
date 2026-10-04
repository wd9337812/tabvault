/**
 * TabVault Pro — Cloudflare Worker 收款后端（零成本方案）
 * ================================================================
 * 思路：不用 webhook、不发邮件。
 *   1) 扩展/落地页打开  /buy      → 302 跳到你的 Stripe Payment Link
 *   2) Stripe 付款成功后回到       /success?sid={CHECKOUT_SESSION_ID}
 *      （Payment Link 的 Success URL 支持该占位符，会自动替换；
 *        也兼容 Stripe 追加的 ?reference=cs_xxx）
 *   3) Worker 拿 sid 调 Stripe API 核实 payment_status == paid
 *      （防任何人编造 sid 白嫖），核实通过才用 HMAC(SECRET, sid)
 *      派生「确定性 License Key」展示。同一订单刷新页面 Key 不变。
 *
 * 密钥算法与扩展 license.js / tools/keygen.mjs --sid 完全一致：
 *   payload = {"plan":"pro","label":"<sid>","via":"stripe"}
 *   key = base64url(JSON payload) + "." + base64url(HMAC_SHA256(SECRET, base64url(payload)))
 *
 * 部署（免费计划即可）:
 *   cd worker
 *   npx wrangler secret put LIC_SECRET      # 与 config.js 的 SECRET 相同
 *   npx wrangler deploy
 * 然后把扩展 config.js 的 STRIPE_PAYMENT_LINK 改为
 *   https://<你的worker域名>/buy
 */

const te = new TextEncoder();

function b64urlBytes(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function computeKey(secret, sid) {
  const payloadB64 = b64urlBytes(
    te.encode(JSON.stringify({ plan: "pro", label: sid, via: "stripe" }))
  );
  const cryptoKey = await crypto.subtle.importKey(
    "raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, te.encode(payloadB64))
  );
  return `${payloadB64}.${b64urlBytes(sig)}`;
}

const HTML = (body) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TabVault Pro</title><style>
body{font:15px/1.6 system-ui,'Segoe UI','PingFang SC',sans-serif;background:#0f1117;color:#e7e9ee;
display:flex;justify-content:center;padding:40px 16px}
.card{max-width:520px;width:100%;background:#161a23;border:1px solid #262c3d;border-radius:16px;padding:28px}
h1{font-size:20px;margin:0 0 6px}.ok{color:#10b981}.err{color:#ef4444}
.key{background:#0f1117;border:1px dashed #6d5efc;border-radius:10px;padding:14px;
font-family:monospace;font-size:12px;word-break:break-all;margin:14px 0;user-select:all}
button{background:linear-gradient(135deg,#6d5efc,#9b6bff);color:#fff;border:none;
border-radius:9px;padding:9px 16px;font-size:14px;cursor:pointer}
.note{color:#8b93a7;font-size:13px}ol{padding-left:20px}
</style></head><body><div class="card">${body}</div></body></html>`;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/buy") {
      return Response.redirect(env.STRIPE_PAYMENT_LINK, 302);
    }

    if (url.pathname === "/success") {
      // 兼容两种来源：我们配置的 ?sid={CHECKOUT_SESSION_ID}，
      // 以及 Stripe Payment Link 自动追加的 ?reference=cs_xxx
      const sid = url.searchParams.get("sid") || url.searchParams.get("reference") || "";
      const errPage = (msg, status = 400) => new Response(
        HTML(`<h1 class="err">⚠️ ${msg}</h1><p class="note">如刚完成付款请刷新重试；仍不行请联系支持。</p>`),
        { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } }
      );
      if (!/^cs_(?:live|test)_[A-Za-z0-9]{6,}$/.test(sid)) {
        return new Response(
          HTML(`<h1 class="err">未找到付款编号</h1><p class="note">URL 缺少 <code>?sid=</code>。请确认 Stripe 的
          Success URL 设为：<code>${url.origin}/success?sid={CHECKOUT_SESSION_ID}</code></p>`),
          { status: 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } }
        );
      }
      // —— 关键防伪造：向 Stripe API 核实该订单确实已付款 ——
      if (!env.STRIPE_SECRET_KEY || !env.LIC_SECRET) return errPage("授权服务暂未配置完成，请联系支持", 503);
      let session = null;
      try {
        const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sid)}`, {
          headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) return errPage("订单查询失败，请确认付款编号或联系支持", 502);
        session = await r.json();
      } catch (e) { return errPage("查询 Stripe 超时，请刷新重试", 502); }
      if (!session || session.object !== "checkout.session" || session.id !== sid || session.payment_status !== "paid" || session.mode !== "payment" || session.status !== "complete") {
        return errPage("该订单未查到已付款记录");
      }
      if (!session.livemode && env.ALLOW_TEST_PAYMENTS !== "true") return errPage("测试订单不能用于正式版激活");
      // Match the actual Stripe Payment Link, not merely a paid session in the same account.
      const linkId = typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id;
      if (!/^plink_[A-Za-z0-9]+$/.test(linkId || "")) return errPage("订单不属于本插件的付款链接");
      if (env.EXPECTED_PAYMENT_LINK_ID && linkId !== env.EXPECTED_PAYMENT_LINK_ID) return errPage("订单不属于本插件");
      try {
        const r = await fetch(`https://api.stripe.com/v1/payment_links/${encodeURIComponent(linkId)}`, {
          headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }, signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) return errPage("无法核对商品，请稍后重试", 502);
        const link = await r.json();
        if (link.object !== "payment_link" || link.id !== linkId || link.url !== env.STRIPE_PAYMENT_LINK) return errPage("订单不属于本插件");
      } catch { return errPage("商品查询超时，请刷新重试", 502); }
      const key = await computeKey(env.LIC_SECRET, sid);
      return new Response(
        HTML(`<h1 class="ok">✅ 付款成功 — TabVault Pro</h1>
        <p class="note">你的 License Key（请保存本页截图或邮件备份）：</p>
        <div class="key" id="k">${key}</div>
        <button onclick="navigator.clipboard.writeText(document.getElementById('k').innerText).then(()=>this.textContent='已复制 ✓')">复制 Key</button>
        <p class="note" style="margin-top:18px">激活方法：</p>
        <ol class="note"><li>打开 Chrome 扩展 TabVault 侧边栏</li>
        <li>点右上角 ⚙ 打开设置</li><li>粘贴上面的 Key → 点「激活」</li></ol>`),
        { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } }
      );
    }

    if (url.pathname === "/health") return new Response("ok");
    return new Response(HTML(`<h1>TabVault Pro backend</h1><p class="note">endpoints: /buy /success?sid= /health</p>`),
      { headers: { "content-type": "text/html; charset=utf-8" } });
  },
};
