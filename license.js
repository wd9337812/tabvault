// ============================================================
//  license.js  —  Pro License Key 校验（HMAC-SHA256，纯本地）
// ============================================================
//  Key 结构:  <base64url(payloadJSON)>.<base64url(HMAC-SHA256)>
//  payload:   { "plan": "pro", "exp": 1790000000, "label": "buyer-email" }
//
//  签发工具见 tools/keygen.mjs —— 必须使用与 config.js 中相同的 SECRET。
//
//  注意：这是「客户端校验」，能挡住绝大多数普通用户，但对能读源码的
//  技术用户不是绝对安全。第一版跑通收款足够；等付费用户变多，建议升级
//  为一个极小的 License 校验接口（README 里有升级路线）。

const Lic = (() => {
  const te = new TextEncoder();

  function b64urlEncode(bytes) {
    let s = "";
    const bin = btoa(String.fromCharCode.apply(null, bytes));
    return bin.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecodeToBytes(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function hmac(secret, msgBytes) {
    const key = await crypto.subtle.importKey(
      "raw", te.encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
    return new Uint8Array(sig);
  }

  function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  // 校验密钥。返回 { ok:true, plan, exp, label } 或 { ok:false, reason }
  async function verify(keyStr, secret) {
    if (!keyStr || typeof keyStr !== "string") return { ok: false, reason: "empty" };
    const parts = keyStr.trim().split(".");
    if (parts.length !== 2) return { ok: false, reason: "malformed" };
    const [p, s] = parts;
    try {
      const payloadBytes = b64urlDecodeToBytes(p);
      const providedSig = b64urlDecodeToBytes(s);
      // 对 base64url 载荷字符串本身做 HMAC（与 tools/keygen.mjs 保持一致）
      const expectedSig = await hmac(secret, te.encode(p));
      if (!constantTimeEqual(providedSig, expectedSig))
        return { ok: false, reason: "bad_signature" };
      const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
      if (payload.exp && Date.now() / 1000 > payload.exp)
        return { ok: false, reason: "expired", exp: payload.exp };
      return { ok: true, plan: payload.plan || "pro", exp: payload.exp, label: payload.label || "" };
    } catch (e) {
      return { ok: false, reason: "malformed" };
    }
  }

  return { verify };
})();
