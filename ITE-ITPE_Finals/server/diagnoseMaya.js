/**
 * Run from the server folder:   node diagnoseMaya.js
 * (keep your server AND ngrok running in their own terminals first)
 *
 * It checks each link in the chain  Maya -> ngrok -> your server  and prints PASS / FAIL / WARN
 * for each one, so you can see exactly where payment confirmations are being lost.
 */
require("dotenv").config();

const MAYA = process.env.MAYA_BASE_URL || "https://pg-sandbox.paymaya.com";
const PORT = process.env.PORT || 5000;
const WEBHOOK_PATH = "/api/v1/webhooks/maya";
const NEEDED_EVENTS = ["PAYMENT_SUCCESS", "PAYMENT_FAILED", "PAYMENT_EXPIRED", "PAYMENT_CANCELLED"];

const results = [];
const say = (level, text, detail) => {
  results.push(level);
  console.log(`${level.padEnd(5)} ${text}`);
  if (detail) console.log(`      ${String(detail).split("\n").join("\n      ")}`);
};

const basic = (key) => "Basic " + Buffer.from(`${key}:`).toString("base64");
async function timed(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try { return await fetch(url, { ...options, signal: controller.signal }); } finally { clearTimeout(timer); }
}

async function diagnose() {
  results.length = 0; // start fresh on every run
  console.log("\nArtistry / Maya webhook diagnostic\n" + "-".repeat(40));

  // 1. Environment
  const pk = process.env.MAYA_PUBLIC_KEY, sk = process.env.MAYA_SECRET_KEY;
  pk && pk.startsWith("pk-") ? say("PASS", "MAYA_PUBLIC_KEY is set (pk-...)") : say("FAIL", "MAYA_PUBLIC_KEY missing or does not start with pk-");
  sk && sk.startsWith("sk-") ? say("PASS", "MAYA_SECRET_KEY is set (sk-...)") : say("FAIL", "MAYA_SECRET_KEY missing or does not start with sk-");
  if (!sk) return finish();

  // 2. Local server
  try {
    const r = await timed(`http://localhost:${PORT}/`);
    say(r.ok ? "PASS" : "FAIL", `Your server answers on http://localhost:${PORT}`, `HTTP ${r.status}`);
  } catch {
    say("FAIL", `Your server is NOT answering on http://localhost:${PORT}`, "Start it with: npm run dev");
  }

  // 3. ngrok tunnel (ngrok's local API)
  let publicUrl = null;
  try {
    const r = await timed("http://127.0.0.1:4040/api/tunnels");
    const data = await r.json();
    const tunnel = (data.tunnels || []).find((t) => t.public_url.startsWith("https://")) || (data.tunnels || [])[0];
    if (!tunnel) say("FAIL", "ngrok is running but has no tunnels");
    else {
      publicUrl = tunnel.public_url;
      say("PASS", `ngrok tunnel is up: ${publicUrl}`, `forwarding to ${tunnel.config?.addr}`);
      const port = String(tunnel.config?.addr || "").match(/(\d+)\s*$/)?.[1];
      if (port && port !== String(PORT)) say("FAIL", `ngrok forwards to port ${port} but your server uses ${PORT}`, `Restart ngrok with:  ngrok http ${PORT}`);
    }
  } catch {
    say("FAIL", "Could not reach ngrok's local API (http://127.0.0.1:4040)", "Is ngrok running? Start it with:  ngrok http " + PORT);
  }

  // 4. Webhooks registered at Maya
  let registered = [];
  try {
    const r = await timed(`${MAYA}/payments/v1/webhooks`, { headers: { Authorization: basic(sk), Accept: "application/json" } });
    const serverDate = r.headers.get("date");
    const body = await r.json().catch(() => null);
    if (!r.ok) say("FAIL", `Maya refused the webhook list request (HTTP ${r.status})`, JSON.stringify(body));
    else {
      registered = Array.isArray(body) ? body : body?.webhooks || [];
      say("PASS", `Maya has ${registered.length} webhook(s) registered for these keys`);
      for (const w of registered) console.log(`        ${String(w.name).padEnd(18)} ${w.callbackUrl}`);
    }
    if (serverDate) {
      const skew = Math.round((Date.now() - new Date(serverDate).getTime()) / 1000);
      Math.abs(skew) > 120
        ? say("FAIL", `Your computer's clock is ${skew}s off from Maya's`, "Webhooks older/newer than 300s are rejected. Fix your PC date/time/time zone.")
        : say("PASS", `Computer clock is within ${Math.abs(skew)}s of Maya's`);
    }
  } catch (e) {
    say("FAIL", "Could not contact Maya sandbox", e.message);
  }

  // 5. Do the registered URLs match the live tunnel?
  const expected = publicUrl ? publicUrl + WEBHOOK_PATH : null;
  for (const name of NEEDED_EVENTS) {
    const w = registered.find((x) => x.name === name);
    if (!w) say("FAIL", `${name} is NOT registered at Maya`, "Register it (see below).");
    else if (expected && w.callbackUrl !== expected) say("FAIL", `${name} points to the WRONG URL`, `registered: ${w.callbackUrl}\nlive tunnel: ${expected}`);
    else if (!expected) say("WARN", `${name} is registered (${w.callbackUrl}) but the tunnel could not be checked`);
    else say("PASS", `${name} points at your live tunnel`);
  }

  // 6. End-to-end reachability: a deliberately unsigned request must reach YOUR route and be rejected with 401
  async function probe(label, base) {
    try {
      const r = await timed(base + WEBHOOK_PATH, {
        method: "POST", headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" }, body: JSON.stringify({ probe: true }),
      });
      const text = await r.text();
      if (r.status === 401 && /signature/i.test(text)) say("PASS", `${label}: request reached the webhook route (correctly rejected as unsigned)`);
      else say("FAIL", `${label}: unexpected answer HTTP ${r.status}`, text.slice(0, 200));
    } catch (e) {
      say("FAIL", `${label}: request failed`, e.message);
    }
  }
  await probe("localhost", `http://localhost:${PORT}`);
  if (publicUrl) await probe("through ngrok", publicUrl);

  finish(expected);
}

const publicUrlOnly = (full) => (full || "").replace("/api/v1/webhooks/maya", "");

function finish(expected) {
  const fails = results.filter((r) => r === "FAIL").length;
  console.log("\n" + "-".repeat(40));
  if (!fails) {
    console.log("All checks passed. If orders still stay pending, complete a test payment and watch for\n" +
      "'[maya-webhook] request received' in the server terminal.");
  } else {
    console.log(`${fails} problem(s) found. Fix the FAIL lines above, top to bottom.`);
    if (expected) console.log(`\nTo point every webhook at the live tunnel, run:\n  node updateMayaWebhooks.js ${publicUrlOnly(expected)}`);
  }
}

module.exports = { diagnose };
if (require.main === module) diagnose().catch((e) => { console.error("Diagnostic crashed:", e); process.exit(1); });
