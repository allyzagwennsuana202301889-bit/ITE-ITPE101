
require("dotenv").config();

const secretKey = process.env.MAYA_SECRET_KEY;

const webhookId = "32d5e032-eb01-4794-9cb1-70f6d4d6ed70";

const callbackUrl =
  "https://launch-unstable-magical.ngrok-free.dev/api/v1/webhooks/maya";

async function updateWebhook() {
  try {
    const authorization =
      "Basic " + Buffer.from(`${secretKey}:`).toString("base64");

    const response = await fetch(
      `https://pg-sandbox.paymaya.com/payments/v1/webhooks/${webhookId}`,
      {
        method: "PUT",
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ callbackUrl }),
      }
    );

    const result = await response.json();

    console.log("HTTP Status:", response.status);
    console.log("Update Result:");
    console.dir(result, { depth: null });
  } catch (error) {
    console.error("Webhook update failed:", error.message);
  }
}

updateWebhook();
