
require("dotenv").config();

if (process.env.DB_NAME !== "artistry_race_test") {
  throw new Error("STOP: This test must use artistry_race_test.");
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
  WebhookEvent,
  OrderStatusHistory,
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
          resolve({
            statusCode: res.statusCode,
            body: responseBody,
          })
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
  const created = {
    orders: [],
    payments: [],
    attempts: [],
    events: [],
  };

  try {
    await sequelize.authenticate();

    const database = (
      await sequelize.query("SELECT DATABASE() AS db", {
        type: QueryTypes.SELECT,
      })
    )[0].db;

    if (database !== "artistry_race_test") {
      throw new Error(`Wrong database: ${database}`);
    }

    const customer = await User.findByPk(2);
    if (!customer) throw new Error("Test customer ID 2 not found.");

    const suffix = Date.now();

    const staleId = `STALE-RECOVERY-${suffix}`;
    const recentId = `RECENT-RECOVERY-${suffix}`;
    const orderNumber = `RECOVERY-ORDER-${suffix}`;

    const order = await Order.create({
      orderNumber,
      userId: customer.id,
      status: "pending_payment",
      subtotal: 100,
      discountAmount: 0,
      shippingFee: 0,
      total: 100,
      shippingAddress: "Webhook recovery test only",
    });
    created.orders.push(order.id);

    const payment = await Payment.create({
      orderId: order.id,
      provider: "maya",
      providerPaymentId: staleId,
      checkoutUrl: "https://example.invalid/recovery-test",
      amount: 100,
      status: "pending",
    });
    created.payments.push(payment.id);

    const attempt = await PaymentAttempt.create({
      paymentId: payment.id,
      providerPaymentId: staleId,
      checkoutUrl: "https://example.invalid/recovery-test",
      status: "pending",
    });
    created.attempts.push(attempt.id);

    // Create an event that is more than five minutes old.
    const staleEvent = await WebhookEvent.create({
      paymentId: staleId,
      eventType: "PAYMENT_SUCCESS",
      status: "received",
    });
    created.events.push(staleEvent.id);

    await sequelize.query(
      `UPDATE WebhookEvents
       SET updatedAt = DATE_SUB(NOW(), INTERVAL 6 MINUTE)
       WHERE id = ?`,
      { replacements: [staleEvent.id] }
    );

    // Create a separate event that is still recent.
    const recentEvent = await WebhookEvent.create({
      paymentId: recentId,
      eventType: "PAYMENT_SUCCESS",
      status: "received",
    });
    created.events.push(recentEvent.id);

    // Bypass signature verification only in this test process.
    const securityPath = require.resolve(
      "./services/mayaWebhookSecurity"
    );

    require.cache[securityPath] = {
      id: securityPath,
      filename: securityPath,
      loaded: true,
      exports: {
        explainMayaWebhook: () => ({ valid: true }),
        verifyMayaWebhook: () => true,
      },
    };

    // Return a controlled successful Maya response.
    global.fetch = async (url) => {
      const requestedUrl = String(url);

      if (requestedUrl.includes(staleId)) {
        return {
          ok: true,
          json: async () => ({
            id: staleId,
            status: "PAYMENT_SUCCESS",
            paymentStatus: "PAYMENT_SUCCESS",
            requestReferenceNumber: orderNumber,
            totalAmount: {
              value: "100.00",
              currency: "PHP",
            },
          }),
        };
      }

      throw new Error(`Unexpected Maya lookup: ${requestedUrl}`);
    };

    const webhookRouter = require("./routes/mayaWebhook");

    const app = express();
    app.use(express.json());
    app.use("/webhooks", webhookRouter);

    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, "127.0.0.1", () =>
        resolve(instance)
      );
      instance.on("error", reject);
    });

    console.log("\n[WEBHOOK RECOVERY] TEST 1: STALE RECEIVED EVENT");

    const staleResponse = await postWebhook(
      server.address().port,
      {
        id: staleId,
        paymentStatus: "PAYMENT_SUCCESS",
        requestReferenceNumber: orderNumber,
      }
    );

    const finalStaleEvent = await WebhookEvent.findByPk(
      staleEvent.id,
      { raw: true }
    );
    const finalOrder = await Order.findByPk(order.id, { raw: true });
    const finalPayment = await Payment.findByPk(payment.id, {
      raw: true,
    });
    const finalAttempt = await PaymentAttempt.findByPk(attempt.id, {
      raw: true,
    });

    const stalePassed =
      staleResponse.statusCode === 200 &&
      finalStaleEvent.status === "processed" &&
      finalOrder.status === "paid" &&
      finalPayment.status === "paid" &&
      finalAttempt.status === "paid";

    console.log(
      JSON.stringify(
        {
          httpStatus: staleResponse.statusCode,
          response: staleResponse.body,
          eventStatus: finalStaleEvent.status,
          orderStatus: finalOrder.status,
          paymentStatus: finalPayment.status,
          attemptStatus: finalAttempt.status,
          passed: stalePassed,
        },
        null,
        2
      )
    );

    console.log("\n[WEBHOOK RECOVERY] TEST 2: RECENT RECEIVED EVENT");

    const recentResponse = await postWebhook(
      server.address().port,
      {
        id: recentId,
        paymentStatus: "PAYMENT_SUCCESS",
      }
    );

    const finalRecentEvent = await WebhookEvent.findByPk(
      recentEvent.id,
      { raw: true }
    );

    const recentPassed =
      recentResponse.statusCode === 200 &&
      finalRecentEvent.status === "received" &&
      /already being processed/i.test(recentResponse.body);

    console.log(
      JSON.stringify(
        {
          httpStatus: recentResponse.statusCode,
          response: recentResponse.body,
          eventStatus: finalRecentEvent.status,
          passed: recentPassed,
        },
        null,
        2
      )
    );

    console.log("\n[WEBHOOK RECOVERY] FINAL RESULT");

    console.log(
      stalePassed && recentPassed
        ? "PASS: Stale events are reclaimed, while recent events are protected from duplicate processing."
        : "NOT PASSED: Inspect the individual results."
    );

    if (!(stalePassed && recentPassed)) {
      process.exitCode = 1;
    }
  } finally {
    global.fetch = originalFetch;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Remove only records created by this test.
    for (const id of created.events) {
      await WebhookEvent.destroy({ where: { id } });
    }

    for (const id of created.attempts) {
      await PaymentAttempt.destroy({ where: { id } });
    }

    for (const id of created.payments) {
      await Payment.destroy({ where: { id } });
    }

    for (const id of created.orders) {
      await OrderStatusHistory.destroy({
        where: { orderId: id },
      });
      await Order.destroy({ where: { id } });
    }

    await sequelize.close();
  }
}

main().catch((error) => {
  console.error("\n[WEBHOOK RECOVERY] ERROR:", error);
  process.exitCode = 1;
});
