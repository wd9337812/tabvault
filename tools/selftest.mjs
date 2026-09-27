// selftest.mjs — 三端签名一致性测试：worker computeKey / keygen CLI / license.js 验签
// 用法: node tools/selftest.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { computeKey } from "../worker/index.js";

const SECRET = "test_secret_1234567890abcdef";
const SID = "cs_test_a1b2c3d4e5f6";

// license.js 是浏览器 IIFE，注入为全局后使用
const src = readFileSync(new URL("../license.js", import.meta.url), "utf8");
(0, eval)(src + "\nglobalThis.Lic = Lic;");
const Lic = globalThis.Lic;

let fail = 0;
const ok = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + "  " + name); if (!cond) fail = 1; };

// 1) Worker 签发的 key 能被扩展验签通过
const wk = await computeKey(SECRET, SID);
const v1 = await Lic.verify(wk, SECRET);
ok("worker key -> license.verify ok", v1.ok === true && v1.plan === "pro");

// 2) keygen CLI（--sid 确定性模式）签发的 key 也能验签通过
const kg = execFileSync("node", [fileURLToPath(new URL("./keygen.mjs", import.meta.url)), "--secret", SECRET, "--sid", SID], { encoding: "utf8" });
const keyFromCli = (kg.match(/[\w-]+\.[\w-]+/) || [""])[0];
const v2 = await Lic.verify(keyFromCli, SECRET);
ok("keygen CLI key -> license.verify ok", v2.ok === true);

// 3) worker 与 keygen 对同一 sid 产出完全相同的 key（补发/自动发必须一致）
ok("worker key === keygen key", keyFromCli === wk.trim());

// 4) 篡改 1 个字符必须验签失败
const tampered = wk.slice(0, -1) + (wk.slice(-1) === "A" ? "B" : "A");
const v3 = await Lic.verify(tampered, SECRET);
ok("tampered key rejected", v3.ok === false && v3.reason === "bad_signature");

// 5) 错误 SECRET 必须失败
const v4 = await Lic.verify(wk, "wrong_secret");
ok("wrong secret rejected", v4.ok === false);

// 6) 伪造/畸形 key 必须失败
const v5 = await Lic.verify("garbage", SECRET);
const v6 = await Lic.verify("eyJhIjoxfQ.deadbeef", SECRET);
ok("malformed keys rejected", v5.ok === false && v6.ok === false);

process.exit(fail);
