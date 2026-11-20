
const express = require("express");
const { Op } = require("sequelize");

const {
  sequelize,
  User,
  Product,
  Cart,
  CartItem,
  Coupon,
  Order,
  OrderItem,
  OrderStatusHistory,
  Payment,
  PaymentAttempt,
} = require("../models");

const { requireAuth } = require("../middleware/auth");
const { createCheckout } = require("../services/maya");

const router = express.Router();

router.use("/cart", requireAuth);
router.use("/coupons/validate", requireAuth);
router.use("/checkout", requireAuth);
router.use("/orders", requireAuth);

const money = (n) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const fail = (res, status, message, code = "REQUEST_ERROR") =>
  res.status(status).json({
    success: false,
    error: { code, message },
  });

async function getCart(userId, transaction) {
  const [cart] = await Cart.findOrCreate({
    where: { userId },
    defaults: { userId },
    transaction,
  });

  return cart;
}

async function cartPayload(userId) {
  const cart = await getCart(userId);

  const items = await CartItem.findAll({
    where: { cartId: cart.id },
    include: [
      {
        model: Product,
        as: "product",
        where: { isActive: true },
        required: false,
      },
    ],
  });

  const clean = items
    .filter((x) => x.product)
    .map((x) => ({
      id: x.product.id,
      name: x.product.name,
      category: x.product.category,
      price: Number(x.product.price),
      stock: x.product.stock,
      imageUrl: x.product.imageUrl,
      quantity: x.quantity,
      lineTotal: money(Number(x.product.price) * x.quantity),
    }));

  return {
    id: cart.id,
    items: clean,
    itemCount: clean.reduce((a, x) => a + x.quantity, 0),
    subtotal: money(clean.reduce((a, x) => a + x.lineTotal, 0)),
  };
}

// GET CART
router.get("/cart", async (req, res, next) => {
  try {
    res.json({
      success: true,
      cart: await cartPayload(req.user.id),
    });
  } catch (error) {
    next(error);
  }
});

// ADD CART ITEM
router.post("/cart/items", async (req, res, next) => {
  try {
    const productId = Number(req.body.productId);
    const quantity = Number(req.body.quantity ?? 1);

    if (
      !Number.isInteger(productId) ||
      productId < 1 ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    ) {
      return fail(res, 400, "Choose a valid product and quantity.");
    }

    const product = await Product.findOne({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      return fail(res, 404, "Product not found.", "PRODUCT_NOT_FOUND");
    }

    const cart = await getCart(req.user.id);

    const [item, created] = await CartItem.findOrCreate({
      where: { cartId: cart.id, productId },
      defaults: { cartId: cart.id, productId, quantity },
    });

    if (!created) {
      await item.update({ quantity: item.quantity + quantity });
    }

    const total = created ? quantity : item.quantity;

    if (total > 99) {
      if (created) await item.destroy();
      else await item.update({ quantity: total - quantity });

      return fail(res, 400, "A cart line cannot exceed 99 items.");
    }

    if (total > product.stock) {
      if (created) await item.destroy();
      else await item.update({ quantity: total - quantity });

      return fail(
        res,
        409,
        `Only ${product.stock} item(s) are currently available.`,
        "INSUFFICIENT_STOCK"
      );
    }

    res.status(201).json({
      success: true,
      cart: await cartPayload(req.user.id),
    });
  } catch (error) {
    next(error);
  }
});

// UPDATE CART ITEM QUANTITY
router.patch("/cart/items/:productId", async (req, res, next) => {
  try {
    const quantity = Number(req.body.quantity);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return fail(res, 400, "Quantity must be between 1 and 99.");
    }

    const cart = await getCart(req.user.id);

    const item = await CartItem.findOne({
      where: {
        cartId: cart.id,
        productId: req.params.productId,
      },
      include: [{ model: Product, as: "product" }],
    });

    if (!item || !item.product) {
      return fail(res, 404, "Cart item not found.");
    }

    if (quantity > item.product.stock) {
      return fail(
        res,
        409,
        `Only ${item.product.stock} item(s) are currently available.`
      );
    }

    await item.update({ quantity });

    res.json({
      success: true,
      cart: await cartPayload(req.user.id),
    });
  } catch (error) {
    next(error);
  }
});

// REMOVE CART ITEM
router.delete("/cart/items/:productId", async (req, res, next) => {
  try {
    const cart = await getCart(req.user.id);

    await CartItem.destroy({
      where: {
        cartId: cart.id,
        productId: req.params.productId,
      },
    });

    res.json({
      success: true,
      cart: await cartPayload(req.user.id),
    });
  } catch (error) {
    next(error);
  }
});

// CLEAR CART
router.delete("/cart", async (req, res, next) => {
  try {
    const cart = await getCart(req.user.id);

    await CartItem.destroy({
      where: { cartId: cart.id },
    });

    res.json({
      success: true,
      cart: await cartPayload(req.user.id),
    });
  } catch (error) {
    next(error);
  }
});

// VALIDATE COUPON
router.post("/coupons/validate", async (req, res, next) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const subtotal = money(Number(req.body.subtotal));

    if (!code || !Number.isFinite(subtotal) || subtotal < 0) {
      return fail(res, 400, "Enter a valid coupon code and subtotal.");
    }

    const coupon = await Coupon.findOne({
      where: { code, isActive: true },
    });

    if (
      !coupon ||
      (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) ||
      (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) ||
      subtotal < Number(coupon.minimumSpend)
    ) {
      return fail(
        res,
        422,
        "This coupon is invalid, expired, fully used, or the minimum spend has not been reached.",
        "COUPON_INVALID"
      );
    }

    if (coupon.perCustomerLimit != null) {
      const used = await Order.count({
        where: {
          userId: req.user.id,
          couponId: coupon.id,
          status: { [Op.notIn]: ["cancelled", "refunded"] },
        },
      });

      if (used >= coupon.perCustomerLimit) {
        return fail(
          res,
          422,
          "You have reached this coupon's per-customer limit.",
          "COUPON_LIMIT_REACHED"
        );
      }
    }

    const raw =
      coupon.discountType === "percentage"
        ? (subtotal * Number(coupon.discountValue)) / 100
        : Number(coupon.discountValue);

    const discountAmount = money(Math.min(subtotal, raw));

    res.json({
      success: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
      },
      discountAmount,
      subtotalAfterDiscount: money(subtotal - discountAmount),
    });
  } catch (error) {
    next(error);
  }
});

// CHECKOUT WITH MAYA AND IDEMPOTENCY
router.post("/checkout", async (req, res, next) => {
  let transaction;

  try {
    const idempotencyKey = String(
      req.get("Idempotency-Key") || ""
    ).trim();

    if (
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 100 ||
      !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)
    ) {
      return fail(
        res,
        400,
        "A valid Idempotency-Key header is required (8-100 characters).",
        "INVALID_IDEMPOTENCY_KEY"
      );
    }

    transaction = await sequelize.transaction();

    const customer = await User.findByPk(req.user.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!customer) {
      await transaction.rollback();
      transaction = null;
      return fail(res, 401, "Customer account not found.");
    }

    const existingOrder = await Order.findOne({
      where: {
        userId: req.user.id,
        idempotencyKey,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (existingOrder) {
      const existingPayment = await Payment.findOne({
        where: { orderId: existingOrder.id },
        transaction,
      });

      if (
        existingOrder.status !== "pending_payment" ||
        !existingPayment ||
        !existingPayment.checkoutUrl
      ) {
        await transaction.rollback();
        transaction = null;

        return fail(
          res,
          409,
          "The previous checkout is no longer available. Please check your order history.",
          "CHECKOUT_SESSION_UNAVAILABLE"
        );
      }

      const existingItems = await OrderItem.findAll({
        where: { orderId: existingOrder.id },
        transaction,
      });

      const existingOrderPayload = {
        id: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        status: existingOrder.status,
        subtotal: Number(existingOrder.subtotal),
        discountAmount: Number(existingOrder.discountAmount),
        shippingFee: Number(existingOrder.shippingFee),
        total: Number(existingOrder.total),
        shippingAddress: existingOrder.shippingAddress,
        items: existingItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
        })),
      };

      const checkoutUrl = existingPayment.checkoutUrl;

      await transaction.commit();
      transaction = null;

      return res.status(200).json({
        success: true,
        message: "Existing checkout session returned.",
        idempotent: true,
        checkoutUrl,
        order: existingOrderPayload,
      });
    }

    const shippingAddress = String(
      req.body.shippingAddress || ""
    ).trim();

    const couponCode = String(req.body.couponCode || "")
      .trim()
      .toUpperCase();

    if (shippingAddress.length < 10 || shippingAddress.length > 1000) {
      await transaction.rollback();
      transaction = null;

      return fail(
        res,
        400,
        "Please provide a complete shipping address (10-1000 characters)."
      );
    }

    const cart = await getCart(req.user.id, transaction);

    const items = await CartItem.findAll({
      where: { cartId: cart.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!items.length) {
      await transaction.rollback();
      transaction = null;
      return fail(res, 400, "Your cart is empty.");
    }

    const orderLines = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findByPk(item.productId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!product || !product.isActive || product.stock < item.quantity) {
        await transaction.rollback();
        transaction = null;

        return fail(
          res,
          409,
          `${product?.name || "A product"} is unavailable or has insufficient stock. Please update your cart.`,
          "INSUFFICIENT_STOCK"
        );
      }

      const unitPrice = Number(product.price);
      const lineTotal = money(unitPrice * item.quantity);

      subtotal += lineTotal;

      orderLines.push({
        product,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      });
    }

    subtotal = money(subtotal);

    let coupon = null;
    let discountAmount = 0;

    if (couponCode) {
      coupon = await Coupon.findOne({
        where: {
          code: couponCode,
          isActive: true,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (
        !coupon ||
        (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) ||
        (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) ||
        subtotal < Number(coupon.minimumSpend)
      ) {
        await transaction.rollback();
        transaction = null;

        return fail(
          res,
          422,
          "The coupon is invalid or its requirements are not met.",
          "COUPON_INVALID"
        );
      }

      if (coupon.perCustomerLimit != null) {
        const used = await Order.count({
          where: {
            userId: req.user.id,
            couponId: coupon.id,
            status: { [Op.notIn]: ["cancelled", "refunded"] },
          },
          transaction,
        });

        if (used >= coupon.perCustomerLimit) {
          await transaction.rollback();
          transaction = null;

          return fail(
            res,
            422,
            "You have reached this coupon's per-customer limit."
          );
        }
      }

      const raw =
        coupon.discountType === "percentage"
          ? (subtotal * Number(coupon.discountValue)) / 100
          : Number(coupon.discountValue);

      discountAmount = money(Math.min(subtotal, raw));
    }

    const shippingFee = Number(process.env.SHIPPING_FEE ?? 80);

    if (!Number.isFinite(shippingFee) || shippingFee < 0) {
      await transaction.rollback();
      transaction = null;

      return fail(
        res,
        500,
        "Shipping fee configuration is invalid.",
        "CONFIGURATION_ERROR"
      );
    }

    const total = money(
      Math.max(0, subtotal - discountAmount) + shippingFee
    );

    const order = await Order.create(
      {
        orderNumber: `ART-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
        userId: req.user.id,
        idempotencyKey,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        couponId: coupon?.id || null,
        status: "pending_payment",
        subtotal,
        discountAmount,
        shippingFee,
        total,
        shippingAddress,
      },
      { transaction }
    );

    const paymentItems = [];

    for (const line of orderLines) {
      await OrderItem.create(
        {
          orderId: order.id,
          productId: line.product.id,
          productName: line.product.name,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          lineTotal: line.lineTotal,
        },
        { transaction }
      );

      await line.product.update(
        { stock: line.product.stock - line.quantity },
        { transaction }
      );

      paymentItems.push({
        productName: line.product.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      });
    }

    await OrderStatusHistory.create(
      {
        orderId: order.id,
        changedBy: req.user.id,
        fromStatus: null,
        toStatus: "pending_payment",
        note: "Order created; awaiting Maya payment.",
      },
      { transaction }
    );

    const nameParts = String(req.user.name || "Artistry Customer")
      .trim()
      .split(/\s+/);

    const mayaCheckout = await createCheckout({
      order,
      items: paymentItems,
      buyer: {
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" ") || "Customer",
        email: req.user.email,
      },
    });

    if (!mayaCheckout?.checkoutId || !mayaCheckout?.redirectUrl) {
      throw new Error("Maya did not return a valid checkout session.");
    }

    const payment = await Payment.create(
      {
        orderId: order.id,
        provider: "maya",
        providerPaymentId: mayaCheckout.checkoutId,
        checkoutUrl: mayaCheckout.redirectUrl,
        amount: total,
        status: "pending",
      },
      { transaction }
    );

    // Save the first Maya checkout as attempt number one.
    await PaymentAttempt.create(
      {
        paymentId: payment.id,
        providerPaymentId: mayaCheckout.checkoutId,
        checkoutUrl: mayaCheckout.redirectUrl,
        status: "pending",
      },
      { transaction }
    );

    await CartItem.destroy({
      where: { cartId: cart.id },
      transaction,
    });

    await transaction.commit();
    transaction = null;

    return res.status(201).json({
      success: true,
      message: "Maya Checkout created successfully.",
      idempotent: false,
      checkoutUrl: mayaCheckout.redirectUrl,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal,
        discountAmount,
        shippingFee,
        total,
        shippingAddress,
        items: paymentItems,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    next(error);
  }
});

// GET CUSTOMER ORDERS
router.get("/orders", async (req, res, next) => {
  try {
    const orders = await Order.findAll({
      where: { userId: req.user.id },
      include: [
        { model: OrderItem, as: "items" },
        {
          model: OrderStatusHistory,
          as: "statusHistory",
          order: [["createdAt", "ASC"]],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      orders,
    });
  } catch (error) {
    next(error);
  }
});

// GET ONE CUSTOMER ORDER
router.get("/orders/:id", async (req, res, next) => {
  try {
    const order = await Order.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: [
        { model: OrderItem, as: "items" },
        { model: OrderStatusHistory, as: "statusHistory" },
      ],
    });

    if (!order) {
      return fail(res, 404, "Order not found.");
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    next(error);
  }
});

// RETRY MAYA PAYMENT FOR AN EXISTING PENDING ORDER
router.post("/orders/:id/retry-payment", async (req, res, next) => {
  let transaction;

  try {
    transaction = await sequelize.transaction();

    const order = await Order.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      await transaction.rollback();
      transaction = null;
      return fail(res, 404, "Order not found.", "ORDER_NOT_FOUND");
    }

    if (order.status !== "pending_payment") {
      await transaction.rollback();
      transaction = null;

      return fail(
        res,
        409,
        "Only orders that are still awaiting payment can be retried.",
        "ORDER_NOT_RETRYABLE"
      );
    }

    // Compare expiry using the database clock to avoid timezone differences.
    const [expiryRows] = await sequelize.query(
      "SELECT (expiresAt > NOW()) AS isValid FROM Orders WHERE id = ?",
      {
        replacements: [order.id],
        transaction,
      }
    );

    if (!expiryRows.length || Number(expiryRows[0].isValid) !== 1) {
      await transaction.rollback();
      transaction = null;

      return fail(
        res,
        409,
        "This order's payment reservation has expired. Please place a new order.",
        "ORDER_RESERVATION_EXPIRED"
      );
    }

    const payment = await Payment.findOne({
      where: {
        orderId: order.id,
        provider: "maya",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!payment || payment.status !== "pending") {
      await transaction.rollback();
      transaction = null;

      return fail(
        res,
        409,
        "This order cannot be retried because its payment has already been processed.",
        "PAYMENT_NOT_RETRYABLE"
      );
    }

    const orderItems = await OrderItem.findAll({
      where: { orderId: order.id },
      transaction,
    });

    if (!orderItems.length) {
      throw new Error("The order has no items to use for payment.");
    }

    const customer = await User.findByPk(req.user.id, { transaction });

    if (!customer) {
      await transaction.rollback();
      transaction = null;
      return fail(res, 401, "Customer account not found.");
    }

    const nameParts = String(customer.name || "Artistry Customer")
      .trim()
      .split(/\s+/);

    const paymentItems = orderItems.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    }));

    // Create a fresh Maya checkout for the SAME order.
    // Do not decrement stock or change the original expiry.
    const mayaCheckout = await createCheckout({
      order,
      items: paymentItems,
      buyer: {
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" ") || "Customer",
        email: customer.email,
      },
    });

    if (!mayaCheckout?.checkoutId || !mayaCheckout?.redirectUrl) {
      throw new Error("Maya did not return a valid retry checkout session.");
    }

    await PaymentAttempt.create(
      {
        paymentId: payment.id,
        providerPaymentId: mayaCheckout.checkoutId,
        checkoutUrl: mayaCheckout.redirectUrl,
        status: "pending",
      },
      { transaction }
    );

    // Keep the Payment row pointed at the latest checkout for compatibility.
    await payment.update(
      {
        providerPaymentId: mayaCheckout.checkoutId,
        checkoutUrl: mayaCheckout.redirectUrl,
      },
      { transaction }
    );

    await transaction.commit();
    transaction = null;

    return res.status(200).json({
      success: true,
      message: "A new Maya payment session has been created.",
      checkoutUrl: mayaCheckout.redirectUrl,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: Number(order.total),
        expiresAt: order.expiresAt,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    next(error);
  }
});

// CANCEL CUSTOMER ORDER
router.patch("/orders/:id/cancel", async (req, res, next) => {
  let transaction;

  try {
    transaction = await sequelize.transaction();

    const order = await Order.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      await transaction.rollback();
      transaction = null;
      return fail(res, 404, "Order not found.", "ORDER_NOT_FOUND");
    }

    if (order.status !== "pending_payment") {
      await transaction.rollback();
      transaction = null;

      return fail(
        res,
        409,
        "Only unpaid pending orders can be cancelled.",
        "ORDER_CANNOT_BE_CANCELLED"
      );
    }

    const payment = await Payment.findOne({
      where: { orderId: order.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (payment && payment.status !== "pending") {
      await transaction.rollback();
      transaction = null;

      return fail(
        res,
        409,
        "This payment can no longer be cancelled.",
        "PAYMENT_ALREADY_PROCESSED"
      );
    }

    const items = await OrderItem.findAll({
      where: { orderId: order.id },
      transaction,
    });

    for (const item of items) {
      await Product.increment(
        { stock: item.quantity },
        {
          where: { id: item.productId },
          transaction,
        }
      );
    }

    const previousStatus = order.status;

    await order.update({ status: "cancelled" }, { transaction });

    if (payment) {
      await payment.update({ status: "failed" }, { transaction });

      await PaymentAttempt.update(
        { status: "cancelled" },
        {
          where: {
            paymentId: payment.id,
            status: "pending",
          },
          transaction,
        }
      );
    }

    await OrderStatusHistory.create(
      {
        orderId: order.id,
        changedBy: req.user.id,
        fromStatus: previousStatus,
        toStatus: "cancelled",
        note: "Customer cancelled the unpaid order.",
      },
      { transaction }
    );

    await transaction.commit();
    transaction = null;

    return res.json({
      success: true,
      message: "Order cancelled successfully.",
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    next(error);
  }
});

module.exports = router;
