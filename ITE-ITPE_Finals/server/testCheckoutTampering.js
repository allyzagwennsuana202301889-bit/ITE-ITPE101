
require("dotenv").config();

if (process.env.DB_NAME !== "artistry_race_test") {
  throw new Error("STOP: This test must use artistry_race_test.");
}

const express = require("express");
const http = require("http");

const {
  sequelize,
  User,
  Product,
  Cart,
  CartItem,
  Order,
  OrderItem,
  OrderStatusHistory,
  Payment,
  PaymentAttempt,
} = require("./models");

async function postCheckout(port, idempotencyKey, payload) {
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/v1/checkout",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "Idempotency-Key": idempotencyKey,
        },
      },
      (res) => {
        let responseBody = "";

        res.on("data", (chunk) => {
          responseBody += chunk;
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: responseBody,
          });
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  let server;
  let testOrderId = null;
  let testPaymentId = null;

  const originalStock = null;
  let stockBefore;
  let originalCartItem;

  try {
    await sequelize.authenticate();

    const QueryTypes = require("sequelize").QueryTypes;

    const database = (
      await sequelize.query("SELECT DATABASE() AS db", {
        type: QueryTypes.SELECT,
      })
    )[0].db;

    if (database !== "artistry_race_test") {
      throw new Error(`Wrong database: ${database}`);
    }

    const customer = await User.findByPk(1);
    const product = await Product.findByPk(4);
    const cart = await Cart.findOne({
      where: { userId: 1 },
    });

    if (!customer || !product || !cart) {
      throw new Error("Test customer, product, or cart not found.");
    }

    if (!product.isActive || Number(product.stock) < 1) {
      throw new Error("Test product is unavailable.");
    }

    originalCartItem = await CartItem.findOne({
      where: {
        cartId: cart.id,
        productId: product.id,
      },
    });

    if (!originalCartItem || Number(originalCartItem.quantity) !== 1) {
      throw new Error(
        "Expected exactly one Premium Sketchbook in the test cart."
      );
    }

    stockBefore = Number(product.stock);

    const idempotencyKey = `PRICE-TAMPER-${Date.now()}`;
    const fakeCheckoutId = `TEST-MAYA-${Date.now()}`;

    // Replace authentication only inside this temporary test process.
    const authPath = require.resolve("./middleware/auth");

    require.cache[authPath] = {
      id: authPath,
      filename: authPath,
      loaded: true,
      exports: {
        requireAuth: async (req, res, next) => {
          req.user = customer;
          next();
        },
      },
    };

    // Replace Maya checkout before loading the route.
    const mayaPath = require.resolve("./services/maya");

    require.cache[mayaPath] = {
      id: mayaPath,
      filename: mayaPath,
      loaded: true,
      exports: {
        createCheckout: async ({ order, items }) => {
          console.log("\n[TEST] Mock Maya received:");
          console.log(JSON.stringify({
            orderId: order.id,
            items,
          }, null, 2));

          return {
            checkoutId: fakeCheckoutId,
            redirectUrl: "https://example.invalid/test-checkout",
          };
        },
      },
    };

    const cartOrdersRouter = require("./routes/cartOrders");

    const app = express();
    app.use(express.json());
    app.use("/api/v1", cartOrdersRouter);

    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, "127.0.0.1", () => {
        resolve(instance);
      });

      instance.on("error", reject);
    });

    console.log("\n[CHECKOUT TAMPERING TEST]");
    console.log("Database:", database);
    console.log("Customer:", customer.id);
    console.log("Product:", product.name);
    console.log("Actual database price:", Number(product.price));
    console.log("Forged client price: 0.01");

    const response = await postCheckout(
      server.address().port,
      idempotencyKey,
      {
        shippingAddress: "123 Test Street, Test City, Philippines",

        // Deliberately forged client-side prices.
        items: [
          {
            productId: 4,
            quantity: 1,
            price: 0.01,
            unitPrice: 0.01,
            lineTotal: 0.01,
          },
        ],
        subtotal: 0.01,
        shippingFee: 0,
        total: 0.01,
      }
    );

    console.log("\n[TEST] HTTP response:");
    console.log("Status:", response.statusCode);
    console.log(response.body);

    const order = await Order.findOne({
      where: {
        userId: customer.id,
        idempotencyKey,
      },
    });

    if (!order) {
      throw new Error("Checkout did not create the expected order.");
    }

    testOrderId = order.id;

    const orderItem = await OrderItem.findOne({
      where: { orderId: order.id },
    });

    const payment = await Payment.findOne({
      where: { orderId: order.id },
    });

    if (payment) {
      testPaymentId = payment.id;
    }

    const actualPrice = Number(product.price);
    const actualSubtotal = Number(order.subtotal);
    const actualItemPrice = Number(orderItem?.unitPrice);
    const actualLineTotal = Number(orderItem?.lineTotal);
    const actualTotal = Number(order.total);
    const actualShipping = Number(order.shippingFee);

    const expectedTotal = Number(
      (actualPrice + actualShipping).toFixed(2)
    );

    const passed =
      response.statusCode === 201 &&
      order.status === "pending_payment" &&
      actualSubtotal === actualPrice &&
      actualItemPrice === actualPrice &&
      actualLineTotal === actualPrice &&
      actualTotal === expectedTotal &&
      payment &&
      Number(payment.amount) === expectedTotal;

    console.log("\n[CHECKOUT TAMPERING TEST] DATABASE VERIFICATION");

    console.log(JSON.stringify({
      forgedClientPrice: 0.01,
      databaseProductPrice: actualPrice,
      orderSubtotal: actualSubtotal,
      orderItemUnitPrice: actualItemPrice,
      orderItemLineTotal: actualLineTotal,
      shippingFee: actualShipping,
      orderTotal: actualTotal,
      paymentAmount: payment ? Number(payment.amount) : null,
      expectedTotal,
      passed,
    }, null, 2));

    if (!passed) {
      throw new Error(
        "FAIL: Checkout did not preserve the database product price."
      );
    }

    console.log(
      "\nPASS: Forged client prices were ignored. " +
      "Checkout used the database product price."
    );
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Remove only the records created by this test.
    if (testOrderId) {
      if (!testPaymentId) {
        const payment = await Payment.findOne({
          where: { orderId: testOrderId },
        });
        testPaymentId = payment?.id || null;
      }

      if (testPaymentId) {
        await PaymentAttempt.destroy({
          where: { paymentId: testPaymentId },
        });
      }

      await OrderItem.destroy({
        where: { orderId: testOrderId },
      });

      await OrderStatusHistory.destroy({
        where: { orderId: testOrderId },
      });

      if (testPaymentId) {
        await Payment.destroy({
          where: { id: testPaymentId },
        });
      }

      await Order.destroy({
        where: { id: testOrderId },
      });
    }

    // Restore the test product's original stock.
    if (typeof stockBefore === "number") {
      await Product.update(
        { stock: stockBefore },
        { where: { id: 4 } }
      );
    }

    // Restore the original cart item if checkout cleared it.
    if (originalCartItem) {
      const existingItem = await CartItem.findOne({
        where: {
          cartId: originalCartItem.cartId,
          productId: originalCartItem.productId,
        },
      });

      if (!existingItem) {
        await CartItem.create({
          cartId: originalCartItem.cartId,
          productId: originalCartItem.productId,
          quantity: originalCartItem.quantity,
        });
      }
    }

    await sequelize.close();
  }
}

main().catch((error) => {
  console.error("\n[CHECKOUT TAMPERING TEST] ERROR:", error);
  process.exitCode = 1;
});
