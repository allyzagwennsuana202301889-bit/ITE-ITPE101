/**
 * Points Maya's sandbox webhooks at your CURRENT ngrok URL.
 *
 *   node updateMayaWebhooks.js https://your-name.ngrok-free.dev
 *
 * (or set MAYA_WEBHOOK_BASE_URL in .env and run it without an argument)
 * For each event it finds the existing webhook by NAME and updates it,
 * or creates it if it does not exist yet. No webhook IDs to copy around.
 */
require("dotenv").config();

const secretKey = process.env.MAYA_SECRET_KEY;
const MAYA = process.env.MAYA_BASE_URL || "https://pg-sandbox.paymaya.com";
const EVENTS = ["PAYMENT_SUCCESS", "PAYMENT_FAILED", "PAYMENT_EXPIRED", "PAYMENT_CANCELLED"];

const base = (process.argv[2] || process.env.MAYA_WEBHOOK_BASE_URL || "").trim().replace(/\/+$/, "").replace(/\/api\/v1\/webhooks\/maya$/, "");
const callbackUrl = `${base}/api/v1/webhooks/maya`;

async function main() {
  if (!secretKey) throw new Error("MAYA_SECRET_KEY is missing from .env.");
  if (!/^https:\/\/.+/.test(base)) {
    throw new Error("Give your public HTTPS URL, e.g.  node updateMayaWebhooks.js https://your-name.ngrok-free.dev");
  }

  const headers = {
    Authorization: "Basic " + Buffer.from(`${secretKey}:`).toString("base64"),
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const listResponse = await fetch(`${MAYA}/payments/v1/webhooks`, { headers });
  const existing = await listResponse.json().catch(() => []);
  if (!listResponse.ok) throw new Error(`Could not list webhooks (HTTP ${listResponse.status}): ${JSON.stringify(existing)}`);
  const list = Array.isArray(existing) ? existing : existing.webhooks || [];

  console.log(`Target URL: ${callbackUrl}\n`);
  for (const name of EVENTS) {
    const found = list.find((w) => w.name === name);
    const response = found
      ? await fetch(`${MAYA}/payments/v1/webhooks/${found.id}`, { method: "PUT", headers, body: JSON.stringify({ callbackUrl }) })
      : await fetch(`${MAYA}/payments/v1/webhooks`, { method: "POST", headers, body: JSON.stringify({ name, callbackUrl }) });
    const result = await response.json().catch(() => ({}));
    console.log(`${response.ok ? "OK  " : "FAIL"} ${name.padEnd(18)} ${found ? "updated" : "created"}  (HTTP ${response.status})`);
    if (!response.ok) console.log("     ", JSON.stringify(result));
  }
  console.log("\nDone. Run  node diagnoseMaya.js  to confirm everything lines up.");
}

main().catch((error) => { console.error(error.message); process.exit(1); });
