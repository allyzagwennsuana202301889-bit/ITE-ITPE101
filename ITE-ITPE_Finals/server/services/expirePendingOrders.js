
const { QueryTypes } = require("sequelize");

const {
  sequelize,
  Order,
  OrderItem,
  Product,
  Payment,
  PaymentAttempt,
  OrderStatusHistory,
} = require("../models");

let isRunning = false;

async function expirePendingOrders() {
  if (isRunning) return;

  isRunning = true;

  try {
    const expiredOrders = await sequelize.query(
      `SELECT id
       FROM Orders
       WHERE status = 'pending_payment'
       AND expiresAt IS NOT NULL
       AND expiresAt <= NOW()
       ORDER BY expiresAt ASC
       LIMIT 100`,
      {
        type: QueryTypes.SELECT,
      }
    );

    for (const candidate of expiredOrders) {
      try {
        await sequelize.transaction(async (transaction) => {
          const order = await Order.findByPk(candidate.id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (!order || order.status !== "pending_payment") {
            return;
          }

          const stillExpired = await sequelize.query(
            `SELECT id
             FROM Orders
             WHERE id = :orderId
             AND status = 'pending_payment'
             AND expiresAt IS NOT NULL
             AND expiresAt <= NOW()
             FOR UPDATE`,
            {
              replacements: { orderId: order.id },
              type: QueryTypes.SELECT,
              transaction,
            }
          );

          if (stillExpired.length === 0) {
            return;
          }

          const payment = await Payment.findOne({
            where: { orderId: order.id },
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (!payment || payment.status !== "pending") {
            return;
          }

          const items = await OrderItem.findAll({
            where: { orderId: order.id },
            transaction,
          });

          // Restore reserved stock.
          for (const item of items) {
            await Product.increment("stock", {
              by: Number(item.quantity),
              where: { id: item.productId },
              transaction,
            });
          }

          await order.update(
            { status: "cancelled" },
            { transaction }
          );

          await payment.update(
            { status: "failed" },
            { transaction }
          );

          // Mark any still-pending checkout attempts as expired.
          await PaymentAttempt.update(
            { status: "expired" },
            {
              where: {
                paymentId: payment.id,
                status: "pending",
              },
              transaction,
            }
          );

          await OrderStatusHistory.create(
            {
              orderId: order.id,
              changedBy: null,
              fromStatus: "pending_payment",
              toStatus: "cancelled",
              note: "Automatically cancelled because the 30-minute payment reservation expired. Reserved stock was restored.",
            },
            { transaction }
          );
        });
      } catch (error) {
        console.error(
          `[order-expiration] Failed to process order ${candidate.id}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error(
      "[order-expiration] Expiration check failed:",
      error
    );
  } finally {
    isRunning = false;
  }
}

function startOrderExpirationJob() {
  expirePendingOrders();

  return setInterval(expirePendingOrders, 60 * 1000);
}

module.exports = {
  expirePendingOrders,
  startOrderExpirationJob,
};
