
// Isolated Artistry Maya webhook/reconciliation race test.
// RUN ONLY with DB_NAME=artistry_race_test.

require("dotenv").config();

if (process.env.DB_NAME !== "artistry_race_test") {
  console.error(
    `STOP: DB_NAME is "${process.env.DB_NAME}". Expected "artistry_race_test".`
  );
  process.exit(1);
}

const express = require("express");
const http = require("http");
const { QueryTypes } = require("sequelize");

const {
  sequelize,
  User,
  Order,
  Payment,
  PaymentAttempt,
  Coupon,
  OrderStatusHistory,
  WebhookEvent,
} = require("./models");

async function postWebhook(port, payload) {
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
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
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => (responseBody += chunk));
        res.on("end", () =>
          resolve({ statusCode: res.statusCode, body: responseBody })
        );
      }
    );

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

    const rows = await sequelize.query(
      "SELECT DATABASE() AS db",
      { type: QueryTypes.SELECT }
    );
    const database = rows[0].db;

    if (database !== "artistry_race_test") {
      throw new Error(`Connected to ${database}, not artistry_race_test.`);
    }

    const customer = await User.findByPk(2);
    if (!customer) {
      throw new Error("Test customer ID 2 was not found.");
    }

    const suffix = String(Date.now());
    const orderNumber = `RACE-TEST-${suffix}`;
    const providerPaymentId = `RACE-PAY-${suffix}`;

    const coupon = await Coupon.create({
      code: `RACE${suffix}`,
      discountType: "fixed",
      discountValue: 0,
      minimumSpend: 0,
      usageLimit: null,
      perCustomerLimit: null,
      usedCount: 0,
      expiresAt: null,
      isActive: true,
    });

    const order = await Order.create({
      orderNumber,
      userId: customer.id,
      status: "pending_payment",
      subtotal: 100,
      discountAmount: 0,
      shippingFee: 0,
      couponId: coupon.id,
      total: 100,
      shippingAddress: "Race test only",
    });

    const payment = await Payment.create({
      orderId: order.id,
      provider: "maya",
      providerPaymentId,
      checkoutUrl: "https://example.invalid/race-test",
      amount: 100,
      status: "pending",
    });

    const attempt = await PaymentAttempt.create({
      paymentId: payment.id,
      providerPaymentId,
      checkoutUrl: "https://example.invalid/race-test",
      status: "pending",
    });

    const verifiedMayaPayment = {
      id: providerPaymentId,
      status: "PAYMENT_SUCCESS",
      paymentStatus: "PAYMENT_SUCCESS",
      requestReferenceNumber: orderNumber,
      totalAmount: {
        value: "100.00",
        currency: "PHP",
      },
    };

    // Bypass signature verification in memory for this test process only.
    const securityPath = require.resolve("./services/mayaWebhookSecurity");

    require.cache[securityPath] = {
      id: securityPath,
      filename: securityPath,
      loaded: true,
      exports: {
        explainMayaWebhook: () => ({ valid: true }),
      },
    };

    const webhookRouter = require("./routes/mayaWebhook");
    const { reconcileMayaPayments } = require("./reconcileMayaPayments");

    // Wait until BOTH paths request the same Maya payment before
    // allowing either path to continue to its database transaction.
    let releaseBoth;
    let timeoutHandle;

    const bothLookupsReady = new Promise((resolve, reject) => {
      releaseBoth = resolve;

      timeoutHandle = setTimeout(() => {
        reject(new Error("Timed out waiting for both Maya lookups."));
      }, 10000);
    });

    let fetchCount = 0;

    global.fetch = async () => {
      fetchCount += 1;

      console.log(
        `[RACE TEST] Maya lookup intercepted: ${fetchCount}/2`
      );

      if (fetchCount > 2) {
        throw new Error("Unexpected extra Maya lookup.");
      }

      if (fetchCount === 2) {
        clearTimeout(timeoutHandle);
        releaseBoth();
      }

      await bothLookupsReady;

      return {
        ok: true,
        json: async () => verifiedMayaPayment,
      };
    };

    const app = express();
    app.use(express.json());
    app.use("/webhooks", webhookRouter);

    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, "127.0.0.1", () => {
        resolve(instance);
      });
      instance.on("error", reject);
    });

    const payload = {
      id: providerPaymentId,
      paymentStatus: "PAYMENT_SUCCESS",
      requestReferenceNumber: orderNumber,
    };

    console.log("\n[RACE TEST] Starting both processes together...");

    const webhookPromise = postWebhook(server.address().port, payload);
    const reconciliationPromise = reconcileMayaPayments();

    const [webhookResult] = await Promise.all([
      webhookPromise,
      reconciliationPromise,
    ]);

    const finalOrder = await Order.findByPk(order.id, { raw: true });
    const finalPayment = await Payment.findByPk(payment.id, { raw: true });
    const finalAttempt = await PaymentAttempt.findByPk(attempt.id, {
      raw: true,
    });
    const finalCoupon = await Coupon.findByPk(coupon.id, { raw: true });

    const paidHistoryCount = await OrderStatusHistory.count({
      where: {
        orderId: order.id,
        toStatus: "paid",
      },
    });

    const webhookEvent = await WebhookEvent.findOne({
      where: {
        paymentId: providerPaymentId,
        eventType: "PAYMENT_SUCCESS",
      },
      raw: true,
    });

    const results = {
      database,
      orderNumber,
      providerPaymentId,
      webhookHttpStatus: webhookResult.statusCode,
      webhookResponse: webhookResult.body,
      interceptedMayaLookups: fetchCount,
      orderStatus: finalOrder.status,
      paymentStatus: finalPayment.status,
      attemptStatus: finalAttempt.status,
      couponUsedCount: Number(finalCoupon.usedCount),
      paidOrderHistoryEntries: paidHistoryCount,
      webhookEventStatus: webhookEvent && webhookEvent.status,
    };

    console.log("\n[RACE TEST] RESULTS");
    console.log(JSON.stringify(results, null, 2));

    const passed =
      webhookResult.statusCode === 200 &&
      fetchCount === 2 &&
      finalOrder.status === "paid" &&
      finalPayment.status === "paid" &&
      finalAttempt.status === "paid" &&
      Number(finalCoupon.usedCount) === 1 &&
      paidHistoryCount === 1 &&
      webhookEvent &&
      webhookEvent.status === "processed";

    console.log(
      passed
        ? "\n[RACE TEST] PASS: both paths ran; payment and coupon were applied once."
        : "\n[RACE TEST] NOT PASSED: inspect the results above."
    );
  } finally {
    global.fetch = originalFetch;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await sequelize.close();
  }
}

main().catch((error) => {
  console.error("\n[RACE TEST] ERROR:", error);
  process.exitCode = 1;
});
