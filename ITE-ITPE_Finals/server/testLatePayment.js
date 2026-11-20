
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
    orderId: null,
    paymentId: null,
    attemptId: null,
    eventId: null,
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
    const providerPaymentId = `LATE-PAYMENT-${suffix}`;
    const orderNumber = `LATE-ORDER-${suffix}`;

    // Simulate an order that was already cancelled.
    const order = await Order.create({
      orderNumber,
      userId: customer.id,
      status: "cancelled",
      subtotal: 100,
      discountAmount: 0,
      shippingFee: 0,
      total: 100,
      shippingAddress: "Late payment test only",
    });
    created.orderId = order.id;

    const payment = await Payment.create({
      orderId: order.id,
      provider: "maya",
      providerPaymentId,
      checkoutUrl: "https://example.invalid/late-payment-test",
      amount: 100,
      status: "pending",
    });
    created.paymentId = payment.id;

    const attempt = await PaymentAttempt.create({
      paymentId: payment.id,
      providerPaymentId,
      checkoutUrl: "https://example.invalid/late-payment-test",
      status: "pending",
    });
    created.attemptId = attempt.id;

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
        verifyMayaWebhook: () => true,
      },
    };

    // Simulate Maya confirming that payment succeeded.
    global.fetch = async (url) => {
      if (String(url).includes(providerPaymentId)) {
        return {
          ok: true,
          json: async () => ({
            id: providerPaymentId,
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

      throw new Error(`Unexpected Maya lookup: ${url}`);
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

    console.log("\n[LATE PAYMENT] INITIAL DATABASE STATE");
    console.log({
      orderStatus: order.status,
      paymentStatus: payment.status,
      attemptStatus: attempt.status,
    });

    console.log("\n[LATE PAYMENT] SENDING SIMULATED SUCCESS WEBHOOK");

    const response = await postWebhook(
      server.address().port,
      {
        id: providerPaymentId,
        paymentStatus: "PAYMENT_SUCCESS",
        requestReferenceNumber: orderNumber,
      }
    );

    const finalOrder = await Order.findByPk(order.id, { raw: true });
    const finalPayment = await Payment.findByPk(payment.id, {
      raw: true,
    });
    const finalAttempt = await PaymentAttempt.findByPk(attempt.id, {
      raw: true,
    });

    const finalEvent = await WebhookEvent.findOne({
      where: {
        paymentId: providerPaymentId,
        eventType: "PAYMENT_SUCCESS",
      },
      raw: true,
    });

    if (finalEvent) created.eventId = finalEvent.id;

    const history = await OrderStatusHistory.findAll({
      where: { orderId: order.id },
      raw: true,
    });

    const warningRecorded = history.some((entry) =>
      /late|manual|review|cancelled|refund/i.test(
        JSON.stringify(entry)
      )
    );

    const passed =
      response.statusCode === 200 &&
      finalEvent?.status === "processed" &&
      finalPayment.status === "paid" &&
      finalAttempt.status === "paid" &&
      finalOrder.status === "cancelled" &&
      warningRecorded;

    console.log("\n[LATE PAYMENT] FINAL DATABASE STATE");

    console.log(
      JSON.stringify(
        {
          httpStatus: response.statusCode,
          response: response.body,
          webhookStatus: finalEvent?.status,
          orderStatus: finalOrder.status,
          paymentStatus: finalPayment.status,
          attemptStatus: finalAttempt.status,
          historyEntries: history,
          warningRecorded,
          passed,
        },
        null,
        2
      )
    );

    console.log(
      passed
        ? "\nPASS: Late payment was recorded without reopening the cancelled order."
        : "\nNOT PASSED: Inspect the results above."
    );

    if (!passed) process.exitCode = 1;
  } finally {
    global.fetch = originalFetch;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Clean up only this test's records.
    if (created.eventId) {
      await WebhookEvent.destroy({
        where: { id: created.eventId },
      });
    }

    if (created.attemptId) {
      await PaymentAttempt.destroy({
        where: { id: created.attemptId },
      });
    }

    if (created.paymentId) {
      await Payment.destroy({
        where: { id: created.paymentId },
      });
    }

    if (created.orderId) {
      await OrderStatusHistory.destroy({
        where: { orderId: created.orderId },
      });

      await Order.destroy({
        where: { id: created.orderId },
      });
    }

    await sequelize.close();
  }
}

main().catch((error) => {
  console.error("\n[LATE PAYMENT] ERROR:", error);
  process.exitCode = 1;
});
