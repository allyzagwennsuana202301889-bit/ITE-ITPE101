
require("dotenv").config();

const secretKey = process.env.MAYA_SECRET_KEY;

async function checkWebhooks() {
  const authorization =
    "Basic " + Buffer.from(`${secretKey}:`).toString("base64");

  const response = await fetch(
    "https://pg-sandbox.paymaya.com/payments/v1/webhooks",
    {
      headers: {
        Authorization: authorization,
        Accept: "application/json",
      },
    }
  );

  const result = await response.json();

  console.log("HTTP Status:", response.status);
  console.log(JSON.stringify(result, null, 2));
}

checkWebhooks().catch(console.error);
