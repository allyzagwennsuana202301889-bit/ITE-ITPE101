
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
  Coupon,
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

  try {
    await sequelize.authenticate();

    const database = (
      await sequelize.query("SELECT DATABASE() AS db", {
        type: require("sequelize").QueryTypes.SELECT,
      })
    )[0].db;

    if (database !== "artistry_race_test") {
      throw new Error(`Wrong database: ${database}`);
    }

    const customer = await User.findByPk(2);

    if (!customer) {
      throw new Error("Test customer ID 2 not found.");
    }

    const suffix = String(Date.now());

    const cases = [
      {
        name: "WRONG CURRENCY",
        id: `MISMATCH-CURRENCY-${suffix}`,
        orderNumber: `MISMATCH-CURRENCY-ORDER-${suffix}`,
        amount: "100.00",
        currency: "USD",
      },
      {
        name: "WRONG AMOUNT",
        id: `MISMATCH-AMOUNT-${suffix}`,
        orderNumber: `MISMATCH-AMOUNT-ORDER-${suffix}`,
        amount: "101.00",
        currency: "PHP",
      },
    ];

    const mockPayments = new Map();
    const records = [];

    for (const test of cases) {
      const coupon = await Coupon.create({
        code: `MIS${test.id.slice()}`,
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
        orderNumber: test.orderNumber,
        userId: customer.id,
        status: "pending_payment",
        subtotal: 100,
        discountAmount: 0,
        shippingFee: 0,
        couponId: coupon.id,
        total: 100,
        shippingAddress: "Mismatch test only",
      });

      const payment = await Payment.create({
        orderId: order.id,
        provider: "maya",
        providerPaymentId: test.id,
        checkoutUrl: "https://example.invalid/mismatch-test",
        amount: 100,
        status: "pending",
      });

      const attempt = await PaymentAttempt.create({
        paymentId: payment.id,
        providerPaymentId: test.id,
        checkoutUrl: "https://example.invalid/mismatch-test",
        status: "pending",
      });

      mockPayments.set(test.id, {
        id: test.id,
        status: "PAYMENT_SUCCESS",
        paymentStatus: "PAYMENT_SUCCESS",
        requestReferenceNumber: test.orderNumber,
        totalAmount: {
          value: test.amount,
          currency: test.currency,
        },
      });

      records.push({
        test,
        order,
        payment,
        attempt,
        coupon,
      });
    }

    // Bypass signature verification only in this temporary test process.
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

    const webhookRouter = require("./routes/mayaWebhook");

    // Return controlled fake Maya responses. No real Maya request is made.
    global.fetch = async (url) => {
      const paymentId = decodeURIComponent(
        String(url).split("/").pop()
      );

      const payment = mockPayments.get(paymentId);

      if (!payment) {
        throw new Error(`Unexpected Maya lookup: ${paymentId}`);
      }

      return {
        ok: true,
        json: async () => payment,
      };
    };

    const app = express();
    app.use(express.json());
    app.use("/webhooks", webhookRouter);

    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, "127.0.0.1", () =>
        resolve(instance)
      );
      instance.on("error", reject);
    });

    const results = [];

    for (const record of records) {
      const { test, order, payment, attempt, coupon } = record;

      console.log(`\n[MISMATCH TEST] Running: ${test.name}`);

      const response = await postWebhook(server.address().port, {
        id: test.id,
        paymentStatus: "PAYMENT_SUCCESS",
        requestReferenceNumber: test.orderNumber,
      });

      const finalOrder = await Order.findByPk(order.id, {
        raw: true,
      });

      const finalPayment = await Payment.findByPk(payment.id, {
        raw: true,
      });

      const finalAttempt = await PaymentAttempt.findByPk(attempt.id, {
        raw: true,
      });

      const finalCoupon = await Coupon.findByPk(coupon.id, {
        raw: true,
      });

      const event = await WebhookEvent.findOne({
        where: {
          paymentId: test.id,
          eventType: "PAYMENT_SUCCESS",
        },
        raw: true,
      });

      const passed =
        response.statusCode === 200 &&
        finalOrder.status === "pending_payment" &&
        finalPayment.status === "pending" &&
        finalAttempt.status === "pending" &&
        Number(finalCoupon.usedCount) === 0 &&
        event &&
        event.status === "failed" &&
        /mismatch/i.test(event.errorMessage || "");

      const result = {
        test: test.name,
        mayaAmount: test.amount,
        mayaCurrency: test.currency,
        httpStatus: response.statusCode,
        response: response.body,
        orderStatus: finalOrder.status,
        paymentStatus: finalPayment.status,
        attemptStatus: finalAttempt.status,
        couponUsedCount: Number(finalCoupon.usedCount),
        webhookEventStatus: event && event.status,
        mismatchRecorded: Boolean(
          event && /mismatch/i.test(event.errorMessage || "")
        ),
        passed,
      };

      results.push(result);
      console.log(JSON.stringify(result, null, 2));
    }

    const allPassed = results.length === 2 &&
      results.every((result) => result.passed);

    console.log("\n[MISMATCH TEST] FINAL RESULT");

    console.log(
      allPassed
        ? "PASS: Incorrect amount and currency were both rejected."
        : "NOT PASSED: Inspect the individual results."
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
  console.error("\n[MISMATCH TEST] ERROR:", error);
  process.exitCode = 1;
});
