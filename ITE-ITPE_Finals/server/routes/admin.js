
const express = require("express");
const { Op } = require("sequelize");

const {
  sequelize,
  User,
  Product,
  Category,
  Order,
  OrderItem,
  Coupon,
  InventoryAdjustment,
  OrderStatusHistory,
  Payment,
  WebhookEvent,
} = require("../models");

const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireAdmin);

const fail = (res, status, message, code = "REQUEST_ERROR") =>
  res.status(status).json({
    success: false,
    error: { code, message },
  });

const validProduct = (body) => {
  const name = String(body.name || "").trim();
  const category = String(body.category || "").trim();
  const price = Number(body.price);
  const stock = Number(body.stock);

  if (name.length < 2 || name.length > 255) {
    return "Product name must be 2-255 characters.";
  }

  if (!category || category.length > 100) {
    return "A valid category is required.";
  }

  if (!Number.isFinite(price) || price < 0) {
    return "Price must be a non-negative number.";
  }

  if (!Number.isInteger(stock) || stock < 0) {
    return "Stock must be a non-negative whole number.";
  }

  return null;
};

// DASHBOARD
router.get("/dashboard", async (req, res, next) => {
  try {
    const [
      products,
      customers,
      orders,
      revenue,
      lowStock,
      recentOrders,
      pendingOrders,
    ] = await Promise.all([
      Product.count({ where: { isActive: true } }),

      User.count({ where: { role: "customer" } }),

      Order.count(),

      Order.sum("total", {
        where: {
          status: {
            [Op.in]: ["paid", "processing", "shipped", "completed"],
          },
        },
      }),

      Product.count({
        where: {
          isActive: true,
          stock: { [Op.lte]: 5 },
        },
      }),

      Order.findAll({
        limit: 8,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email"],
          },
          { model: OrderItem, as: "items" },
        ],
      }),

      Order.count({
        where: { status: "pending_payment" },
      }),
    ]);

    res.json({
      success: true,
      stats: {
        products,
        customers,
        orders,
        revenue: Number(revenue || 0),
        lowStock,
        pendingOrders,
      },
      recentOrders,
    });
  } catch (error) {
    next(error);
  }
});

// PAYMENT MISMATCH REPORTS
router.get("/payment-mismatches", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const result = await WebhookEvent.findAndCountAll({
      where: {
        status: "failed",
        errorMessage: {
          [Op.ne]: null,
        },
      },
      order: [["createdAt", "DESC"]],
      limit,
      offset: (page - 1) * limit,
    });

    const paymentIds = [
      ...new Set(result.rows.map((event) => event.paymentId)),
    ];

    const payments = paymentIds.length
      ? await Payment.findAll({
          where: {
            provider: "maya",
            providerPaymentId: {
              [Op.in]: paymentIds,
            },
          },
          attributes: [
            "id",
            "orderId",
            "providerPaymentId",
            "status",
            "amount",
          ],
        })
      : [];

    const orderIds = [
      ...new Set(payments.map((payment) => payment.orderId)),
    ];

    const orders = orderIds.length
      ? await Order.findAll({
          where: {
            id: {
              [Op.in]: orderIds,
            },
          },
          attributes: [
            "id",
            "orderNumber",
            "status",
            "total",
            "userId",
          ],
        })
      : [];

    const paymentMap = new Map(
      payments.map((payment) => [
        payment.providerPaymentId,
        payment,
      ])
    );

    const orderMap = new Map(
      orders.map((order) => [order.id, order])
    );

    const mismatches = result.rows.map((event) => {
      const payment = paymentMap.get(event.paymentId);
      const order = payment
        ? orderMap.get(payment.orderId)
        : null;

      return {
        ...event.toJSON(),
        payment: payment
          ? {
              id: payment.id,
              status: payment.status,
              amount: payment.amount,
            }
          : null,
        order: order
          ? {
              id: order.id,
              orderNumber: order.orderNumber,
              status: order.status,
              total: order.total,
              userId: order.userId,
            }
          : null,
      };
    });

    res.json({
      success: true,
      mismatches,
      pagination: {
        page,
        limit,
        total: result.count,
        pages: Math.ceil(result.count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET PRODUCTS
router.get("/products", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const where = {};

    if (req.query.search) {
      where.name = {
        [Op.like]: `%${String(req.query.search).slice(0, 80)}%`,
      };
    }

    const result = await Product.findAndCountAll({
      where,
      include: [{ model: Category, as: "productCategory" }],
      limit,
      offset: (page - 1) * limit,
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      products: result.rows,
      pagination: {
        page,
        limit,
        total: result.count,
        pages: Math.ceil(result.count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// CREATE PRODUCT
router.post("/products", async (req, res, next) => {
  try {
    const error = validProduct(req.body);

    if (error) return fail(res, 400, error);

    const category = await Category.findOne({
      where: { name: String(req.body.category).trim() },
    });

    if (!category) {
      return fail(res, 400, "Choose an existing category.");
    }

    const product = await Product.create({
      name: String(req.body.name).trim(),
      category: category.name,
      categoryId: category.id,
      price: Number(req.body.price),
      stock: Number(req.body.stock),
      description: req.body.description
        ? String(req.body.description).trim()
        : null,
      imageUrl: req.body.imageUrl
        ? String(req.body.imageUrl).trim()
        : null,
      isActive: req.body.isActive !== false,
    });

    res.status(201).json({ success: true, product });
  } catch (error) {
    next(error);
  }
});

// UPDATE PRODUCT
router.put("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) return fail(res, 404, "Product not found.");

    const merged = { ...product.toJSON(), ...req.body };
    const error = validProduct(merged);

    if (error) return fail(res, 400, error);

    const category = await Category.findOne({
      where: { name: String(merged.category).trim() },
    });

    if (!category) {
      return fail(res, 400, "Choose an existing category.");
    }

    await product.update({
      name: String(merged.name).trim(),
      category: category.name,
      categoryId: category.id,
      price: Number(merged.price),
      stock: Number(merged.stock),
      description: merged.description
        ? String(merged.description).trim()
        : null,
      imageUrl: merged.imageUrl
        ? String(merged.imageUrl).trim()
        : null,
      isActive: merged.isActive !== false,
    });

    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
});

// DEACTIVATE PRODUCT
router.delete("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) return fail(res, 404, "Product not found.");

    await product.update({ isActive: false });

    res.json({
      success: true,
      message: "Product deactivated.",
    });
  } catch (error) {
    next(error);
  }
});

// ADJUST INVENTORY
router.post("/inventory/:productId/adjust", async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const change = Number(req.body.change);
    const reason = String(req.body.reason || "").trim();

    if (
      !Number.isInteger(change) ||
      change === 0 ||
      Math.abs(change) > 100000 ||
      reason.length < 3 ||
      reason.length > 255
    ) {
      await transaction.rollback();

      return fail(
        res,
        400,
        "Provide a non-zero whole-number stock change and a reason (3-255 characters)."
      );
    }

    const product = await Product.findByPk(req.params.productId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!product) {
      await transaction.rollback();
      return fail(res, 404, "Product not found.");
    }

    const previousStock = product.stock;
    const newStock = previousStock + change;

    if (newStock < 0) {
      await transaction.rollback();

      return fail(res, 409, "Inventory cannot become negative.");
    }

    await product.update(
      { stock: newStock },
      { transaction }
    );

    await InventoryAdjustment.create(
      {
        productId: product.id,
        adminId: req.user.id,
        quantityChange: change,
        previousStock,
        newStock,
        reason,
      },
      { transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      product,
      adjustment: {
        change,
        previousStock,
        newStock,
        reason,
      },
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

// INVENTORY ADJUSTMENT HISTORY
router.get("/inventory/adjustments", async (req, res, next) => {
  try {
    const rows = await InventoryAdjustment.findAll({
      limit: 100,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "admin",
          attributes: ["id", "name"],
        },
      ],
    });

    res.json({ success: true, adjustments: rows });
  } catch (error) {
    next(error);
  }
});

// GET ORDERS
router.get("/orders", async (req, res, next) => {
  try {
    const where = {};

    if (req.query.status) {
      where.status = req.query.status;
    }

        const { startDate, endDate } = req.query;

    if (startDate || endDate) {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;

      if (
        (startDate && !datePattern.test(startDate)) ||
        (endDate && !datePattern.test(endDate))
      ) {
        return fail(res, 400, "Invalid date format. Use YYYY-MM-DD.");
      }

      if (startDate && endDate && startDate > endDate) {
        return fail(res, 400, "Start date cannot be after end date.");
      }

      const dateFilter = {};

      if (startDate) {
        dateFilter[Op.gte] = new Date(`${startDate}T00:00:00.000Z`);
      }

      if (endDate) {
        const end = new Date(`${endDate}T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 1);
        dateFilter[Op.lt] = end;
      }

      where.createdAt = dateFilter;
    }

    const orders = await Order.findAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
        },
        { model: OrderItem, as: "items" },
        { model: OrderStatusHistory, as: "statusHistory" },
      ],
      order: [["createdAt", "DESC"]],
      limit: 200,
    });

    res.json({ success: true, orders });
  } catch (error) {
    next(error);
  }
});

// UPDATE ORDER STATUS
router.patch("/orders/:id/status", async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const status = String(req.body.status || "");

    const allowedStatuses = [
      "pending_payment",
      "paid",
      "processing",
      "shipped",
      "completed",
      "cancelled",
      "refunded",
    ];

    if (!allowedStatuses.includes(status)) {
      await transaction.rollback();
      return fail(res, 400, "Invalid order status.");
    }

    const order = await Order.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!order) {
      await transaction.rollback();
      return fail(res, 404, "Order not found.");
    }

    const previous = order.status;

    if (previous === status) {
      await transaction.rollback();

      return res.json({
        success: true,
        message: "Order already has this status.",
        order,
      });
    }

    // Only Maya's verified webhook can mark an order as paid.
    if (status === "paid") {
      await transaction.rollback();

      return fail(
        res,
        409,
        "Payment status can only be updated through verified Maya payment processing."
      );
    }

    // Define legal admin transitions.
    const transitions = {
      pending_payment: ["cancelled"],
      paid: ["processing", "refunded"],
      processing: ["shipped", "refunded"],
      shipped: ["completed", "refunded"],
      completed: [],
      cancelled: [],
      refunded: [],
      pending: ["cancelled"],
    };

    if (!(transitions[previous] || []).includes(status)) {
      await transaction.rollback();

      return fail(
        res,
        409,
        `Cannot change order status from ${previous} to ${status}.`,
        "INVALID_ORDER_TRANSITION"
      );
    }

    const payment = await Payment.findOne({
      where: { orderId: order.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    // An unpaid order may be cancelled only while its payment is pending.
    if (status === "cancelled") {
      if (payment && payment.status !== "pending") {
        await transaction.rollback();

        return fail(
          res,
          409,
          "This payment has already been processed and cannot be cancelled."
        );
      }

      const lines = await OrderItem.findAll({
        where: { orderId: order.id },
        transaction,
      });

      for (const line of lines) {
        await Product.increment(
          { stock: line.quantity },
          {
            where: { id: line.productId },
            transaction,
          }
        );
      }

      if (payment) {
        await payment.update(
          { status: "failed" },
          { transaction }
        );
      }
    }

    // A refund status is administrative tracking only.
    // It does not issue a refund through Maya.
    if (status === "refunded") {
      if (!payment || payment.status !== "paid") {
        await transaction.rollback();

        return fail(
          res,
          409,
          "Only an order with a verified successful payment can be marked for refund."
        );
      }

      await payment.update(
        { status: "refunded" },
        { transaction }
      );
    }

    await order.update(
      { status },
      { transaction }
    );

    await OrderStatusHistory.create(
      {
        orderId: order.id,
        changedBy: req.user.id,
        fromStatus: previous,
        toStatus: status,
        note:
          String(req.body.note || "").trim().slice(0, 255) ||
          null,
      },
      { transaction }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: "Order status updated.",
      order,
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

// GET COUPONS
router.get("/coupons", async (req, res, next) => {
  try {
    const coupons = await Coupon.findAll({
      order: [["createdAt", "DESC"]],
    });

    res.json({ success: true, coupons });
  } catch (error) {
    next(error);
  }
});

// CREATE COUPON
router.post("/coupons", async (req, res, next) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const discountType = req.body.discountType;
    const discountValue = Number(req.body.discountValue);
    const minimumSpend = Number(req.body.minimumSpend || 0);

    if (
      !/^[A-Z0-9_-]{3,50}$/.test(code) ||
      !["percentage", "fixed"].includes(discountType) ||
      !Number.isFinite(discountValue) ||
      discountValue <= 0 ||
      (discountType === "percentage" && discountValue > 100) ||
      !Number.isFinite(minimumSpend) ||
      minimumSpend < 0
    ) {
      return fail(
        res,
        400,
        "Enter a valid coupon code, discount type, discount value, and minimum spend."
      );
    }

    const usageLimit =
      req.body.usageLimit == null || req.body.usageLimit === ""
        ? null
        : Number(req.body.usageLimit);

    const perCustomerLimit =
      req.body.perCustomerLimit == null || req.body.perCustomerLimit === ""
        ? null
        : Number(req.body.perCustomerLimit);

    if (
      (usageLimit !== null &&
        (!Number.isInteger(usageLimit) || usageLimit < 1)) ||
      (perCustomerLimit !== null &&
        (!Number.isInteger(perCustomerLimit) || perCustomerLimit < 1))
    ) {
      return fail(
        res,
        400,
        "Usage limits must be positive whole numbers."
      );
    }

    const coupon = await Coupon.create({
      code,
      discountType,
      discountValue,
      minimumSpend,
      usageLimit,
      perCustomerLimit,
      expiresAt: req.body.expiresAt || null,
      isActive: req.body.isActive !== false,
    });

    res.status(201).json({ success: true, coupon });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return fail(res, 409, "That coupon code already exists.");
    }

    next(error);
  }
});

// UPDATE COUPON
router.patch("/coupons/:id", async (req, res, next) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);

    if (!coupon) return fail(res, 404, "Coupon not found.");

    if (req.body.isActive !== undefined) {
      await coupon.update({
        isActive: Boolean(req.body.isActive),
      });
    }

    res.json({ success: true, coupon });
  } catch (error) {
    next(error);
  }
});

// GET CATEGORIES
router.get("/categories", async (req, res, next) => {
  try {
    res.json({
      success: true,
      categories: await Category.findAll({
        order: [["name", "ASC"]],
      }),
    });
  } catch (error) {
    next(error);
  }
});

// CREATE CATEGORY
router.post("/categories", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();

    if (name.length < 2 || name.length > 100) {
      return fail(res, 400, "Category name must be 2-100 characters.");
    }

    const category = await Category.create({
      name,
      description: description || null,
    });

    res.status(201).json({ success: true, category });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return fail(res, 409, "That category already exists.");
    }

    next(error);
  }
});

// UPDATE CATEGORY
router.put("/categories/:id", async (req, res, next) => {
  try {
    const category = await Category.findByPk(req.params.id);

    if (!category) return fail(res, 404, "Category not found.");

    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();

    if (name.length < 2 || name.length > 100) {
      return fail(res, 400, "Category name must be 2-100 characters.");
    }

    await category.update({
      name,
      description: description || null,
    });

    await Product.update(
      { category: name },
      { where: { categoryId: category.id } }
    );

    res.json({ success: true, category });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return fail(res, 409, "That category already exists.");
    }

    next(error);
  }
});

// DELETE CATEGORY
router.delete("/categories/:id", async (req, res, next) => {
  try {
    const category = await Category.findByPk(req.params.id);

    if (!category) return fail(res, 404, "Category not found.");

    const used = await Product.count({
      where: { categoryId: category.id },
    });

    if (used) {
      return fail(
        res,
        409,
        "This category still has products. Reassign or deactivate them first."
      );
    }

    await category.destroy();

    res.json({
      success: true,
      message: "Category deleted.",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
