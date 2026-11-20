
require("dotenv").config();

if (process.env.DB_NAME !== "artistry_race_test") {
  throw new Error("STOP: This test must use artistry_race_test.");
}

const express = require("express");
const http = require("http");

const {
  sequelize,
  User,
  Order,
  Payment,
  PaymentAttempt,
  WebhookEvent,
} = require("./models");

async function sendWebhook(port, payload) {
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: "/webhooks/maya",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "X-Maya-Webhook-Signature": "TEST-ONLY-BYPASS",
        "X-Maya-Webhook-Timestamp": String(Date.now()),
      },
    }, (res) => {
      let responseBody = "";
      res.on("data", chunk => responseBody += chunk);
      res.on("end", () => resolve({
        statusCode: res.statusCode,
        body: responseBody,
      }));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  let server;
  const originalFetch = global.fetch;

  try {
    await sequelize.authenticate();

    const [[database]] = await sequelize.query(
      "SELECT DATABASE() AS db"
    );

    if (database.db !== "artistry_race_test") {
      throw new Error("Wrong database: " + database.db);
    }

    const customer = await User.findByPk(2);
    if (!customer) throw new Error("Test customer not found.");

    const suffix = Date.now();
    const orderNumber = `AMOUNT-TEST-${suffix}`;
    const paymentId = `AMOUNT-PAY-${suffix}`;

    const order = await Order.create({
      orderNumber,
      userId: customer.id,
      status: "pending_payment",
      subtotal: 100,
      discountAmount: 0,
      shippingFee: 0,
      total: 100,
      shippingAddress: "Test only",
    });

    const payment = await Payment.create({
      orderId: order.id,
      provider: "maya",
      providerPaymentId: paymentId,
      checkoutUrl: "https://example.invalid/test",
      amount: 100,
      status: "pending",
    });

    const attempt = await PaymentAttempt.create({
      paymentId: payment.id,
      providerPaymentId: paymentId,
      checkoutUrl: "https://example.invalid/test",
      status: "pending",
    });

    // Maya claims success, but reports ₱99 instead of ₱100.
    const fakeMayaPayment = {
      id: paymentId,
      status: "PAYMENT_SUCCESS",
      paymentStatus: "PAYMENT_SUCCESS",
      requestReferenceNumber: orderNumber,
      totalAmount: {
        value: "99.00",
        currency: "PHP",
      },
    };

    // Bypass signature verification only inside this test process.
    const securityPath = require.resolve(
      "./services/mayaWebhookSecurity"
    );

    require.cache[securityPath] = {
      id: securityPath,
      filename: securityPath,
      loaded: true,
      exports: {
        explainMayaWebhook: () => ({ valid: true }),
      },
    };

    const webhookRouter = require("./routes/mayaWebhook");

    global.fetch = async () => ({
      ok: true,
      json: async () => fakeMayaPayment,
    });

    const app = express();
    app.use(express.json());
    app.use("/webhooks", webhookRouter);

    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
      instance.on("error", reject);
    });

    console.log("\n[AMOUNT TEST] Sending mismatched payment...");
    console.log("Order total: PHP 100.00");
    console.log("Mock Maya amount: PHP 99.00");

    const result = await sendWebhook(server.address().port, {
      id: paymentId,
      paymentStatus: "PAYMENT_SUCCESS",
      requestReferenceNumber: orderNumber,
    });

    const finalOrder = await Order.findByPk(order.id);
    const finalPayment = await Payment.findByPk(payment.id);
    const finalAttempt = await PaymentAttempt.findByPk(attempt.id);

    const event = await WebhookEvent.findOne({
      where: {
        paymentId,
        eventType: "PAYMENT_SUCCESS",
      },
    });

    const results = {
      database: database.db,
      webhookHttpStatus: result.statusCode,
      webhookResponse: result.body,
      orderStatus: finalOrder.status,
      paymentStatus: finalPayment.status,
      attemptStatus: finalAttempt.status,
      webhookEventStatus: event?.status,
      mismatchReason: event?.errorMessage,
    };

    console.log("\n[AMOUNT TEST] RESULTS");
    console.log(JSON.stringify(results, null, 2));

    const passed =
      result.statusCode === 200 &&
      finalOrder.status === "pending_payment" &&
      finalPayment.status === "pending" &&
      finalAttempt.status === "pending" &&
      event?.status === "failed" &&
      event?.errorMessage?.includes("Amount mismatch");

    console.log(
      passed
        ? "\n[AMOUNT TEST] PASS: mismatched payment was not accepted."
        : "\n[AMOUNT TEST] NOT PASSED: inspect the results."
    );

  } finally {
    global.fetch = originalFetch;

    if (server) {
      await new Promise(resolve => server.close(resolve));
    }

    await sequelize.close();
  }
}

main().catch(error => {
  console.error("\n[AMOUNT TEST] ERROR:", error);
  process.exitCode = 1;
});
