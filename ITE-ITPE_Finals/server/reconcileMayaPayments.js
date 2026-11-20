
require("dotenv").config();

const { Op } = require("sequelize");

const {
  sequelize,
  Payment,
  PaymentAttempt,
  Order,
  Coupon,
  OrderStatusHistory,
} = require("./models");

const { getPayment } = require("./services/maya");

function toCents(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100);
}

async function reconcileMayaPayments() {
  let reconciledCount = 0;

  try {
    const payments = await Payment.findAll({
      where: {
        provider: "maya",
        status: "pending",
      },
    });

    console.log(`Found ${payments.length} pending Maya payments.`);

    for (const paymentRecord of payments) {
      let transaction;

      try {
        // Retrieve the latest payment status directly from Maya.
        const mayaPayment = await getPayment(
          paymentRecord.providerPaymentId
        );

        if (
          mayaPayment.status !== "PAYMENT_SUCCESS"
        ) {
          console.log(
            `Payment ${paymentRecord.id} is not successful on Maya.`
          );
          continue;
        }

        const mayaCurrency =
          mayaPayment.currency ||
          mayaPayment.totalAmount?.currency;

        const mayaAmount = toCents(
          mayaPayment.totalAmount?.value ?? mayaPayment.amount
        );

        if (
          String(mayaCurrency).toUpperCase() !== "PHP" ||
          mayaAmount === null
        ) {
          console.warn(
            `Payment ${paymentRecord.id} has invalid currency or amount.`
          );
          continue;
        }

        transaction = await sequelize.transaction();

        const order = await Order.findByPk(
          paymentRecord.orderId,
          {
            transaction,
            lock: transaction.LOCK.UPDATE,
          }
        );

        if (!order) {
          throw new Error("Associated order not found.");
        }

        const payment = await Payment.findByPk(
          paymentRecord.id,
          {
            transaction,
            lock: transaction.LOCK.UPDATE,
          }
        );

        if (!payment || payment.status !== "pending") {
          await transaction.rollback();
          transaction = null;
          continue;
        }

        // Verify the Maya payment belongs to this Artistry order.
        if (
          mayaPayment.requestReferenceNumber !== order.orderNumber ||
          mayaAmount !== toCents(order.total) ||
          String(mayaPayment.id) !== String(payment.providerPaymentId)
        ) {
          console.warn(
            `Payment mismatch for ${order.orderNumber}. Manual review required.`
          );

          await transaction.rollback();
          transaction = null;
          continue;
        }

        // Find the exact checkout attempt.
        let attempt = await PaymentAttempt.findOne({
          where: {
            providerPaymentId: String(mayaPayment.id),
            paymentId: payment.id,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        // Support older payments created before PaymentAttempt existed.
        if (!attempt && String(payment.providerPaymentId) === String(mayaPayment.id)) {
          attempt = await PaymentAttempt.create(
            {
              paymentId: payment.id,
              providerPaymentId: String(mayaPayment.id),
              checkoutUrl: payment.checkoutUrl || "legacy-checkout",
              status: "pending",
            },
            { transaction }
          );
        }

        if (!attempt) {
          throw new Error(
            "Matching PaymentAttempt could not be found."
          );
        }

        const previousOrderStatus = order.status;
        const now = new Date();

        // Record the actual successful checkout.
        attempt.status = "paid";
        await attempt.save({ transaction });

        payment.status = "paid";
        payment.paidAt = payment.paidAt || now;
        payment.providerPaymentId = String(mayaPayment.id);
        await payment.save({ transaction });

        // A late payment must never reopen a cancelled or expired order.
        if (order.status !== "pending_payment") {
          await OrderStatusHistory.create(
            {
              orderId: order.id,
              changedBy: null,
              fromStatus: previousOrderStatus,
              toStatus: previousOrderStatus,
              note:
                "WARNING: Maya confirmed payment during reconciliation after the order was no longer awaiting payment. The order was not reopened. Manual payment review or refund is required.",
            },
            { transaction }
          );

          await transaction.commit();
          transaction = null;

          console.error(
            `LATE PAYMENT: ${order.orderNumber}. Manual review required.`
          );

          reconciledCount++;
          continue;
        }

        // First successful payment: mark the order paid.
        order.status = "paid";
        await order.save({ transaction });

        // Cancel other pending checkout attempts.
        await PaymentAttempt.update(
          { status: "cancelled" },
          {
            where: {
              paymentId: payment.id,
              status: "pending",
              providerPaymentId: {
                [Op.ne]: String(mayaPayment.id),
              },
            },
            transaction,
          }
        );

        // Count coupon usage once for the successful order payment.
        if (order.couponId) {
          const coupon = await Coupon.findByPk(
            order.couponId,
            {
              transaction,
              lock: transaction.LOCK.UPDATE,
            }
          );

          if (coupon) {
            await coupon.increment("usedCount", {
              by: 1,
              transaction,
            });
          }
        }

        await OrderStatusHistory.create(
          {
            orderId: order.id,
            changedBy: null,
            fromStatus: previousOrderStatus,
            toStatus: "paid",
            note:
              "Payment successfully verified directly with Maya during automatic reconciliation.",
          },
          { transaction }
        );

        await transaction.commit();
        transaction = null;

        reconciledCount++;

        console.log(
          `SUCCESS: ${order.orderNumber} is now PAID. Attempt ${attempt.id} marked paid.`
        );
      } catch (error) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        console.error(
          `FAILED for payment ${paymentRecord.id}:`,
          error.message
        );
      }
    }

    console.log(
      `Reconciliation finished. ${reconciledCount} payment(s) recorded.`
    );
  } catch (error) {
    console.error("Reconciliation error:", error);
  }
}

// Allow this file to be imported by the running server without
// automatically executing it or closing the shared database connection.
if (require.main === module) {
  reconcileMayaPayments()
    .finally(async () => {
      await sequelize.close();
    });
}

module.exports = {
  reconcileMayaPayments,
};
