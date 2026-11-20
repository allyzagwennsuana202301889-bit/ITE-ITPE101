
const express = require("express");
const { Op } = require("sequelize");

const router = express.Router();

const {
  sequelize,
  Payment,
  PaymentAttempt,
  Order,
  Coupon,
  OrderStatusHistory,
  WebhookEvent,
} = require("../models");

const { getPayment } = require("../services/maya");
const { explainMayaWebhook } = require("../services/mayaWebhookSecurity");

const SUPPORTED_STATUSES = [
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILED",
  "PAYMENT_EXPIRED",
  "PAYMENT_CANCELLED",
];

// A received event older than this can be reclaimed on redelivery.
const STALE_RECEIVED_MS = 5 * 60 * 1000;

function pickEventStatus(payload) {
  if (!payload) return undefined;

  const candidates = [payload.paymentStatus, payload.status];

  return (
    candidates.find((value) => SUPPORTED_STATUSES.includes(value)) ||
    candidates.find(Boolean)
  );
}

function getAmountInCents(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100);
}

function attemptStatusFromEvent(eventStatus) {
  switch (eventStatus) {
    case "PAYMENT_SUCCESS":
      return "paid";
    case "PAYMENT_EXPIRED":
      return "expired";
    case "PAYMENT_CANCELLED":
      return "cancelled";
    default:
      return "failed";
  }
}

router.post("/maya", async (req, res) => {
  const webhook = req.body;

  const signatureHeader = req.get("X-Maya-Webhook-Signature");
  const timestamp = req.get("X-Maya-Webhook-Timestamp");

  console.log("[maya-webhook] Request received:", {
    time: new Date().toISOString(),
    hasSignature: Boolean(signatureHeader),
    hasTimestamp: Boolean(timestamp),
    contentType: req.get("content-type"),
    bodyKeys:
      webhook && typeof webhook === "object"
        ? Object.keys(webhook)
        : null,
  });

  // 1. Verify the Maya webhook signature and timestamp.
  const verification = explainMayaWebhook(
    webhook,
    signatureHeader,
    timestamp
  );

  if (!verification.valid) {
    console.warn(
      "[maya-webhook] Signature rejected:",
      verification.reason
    );

    return res.status(401).json({
      success: false,
      message: "Invalid Maya webhook signature or timestamp.",
    });
  }

  const paymentId = webhook.id;
  const eventStatus = pickEventStatus(webhook);

  if (!paymentId || !SUPPORTED_STATUSES.includes(eventStatus)) {
    console.log("[maya-webhook] Unsupported event ignored:", {
      paymentId,
      eventStatus,
    });

    return res.status(200).json({
      success: true,
      message: "Webhook ignored.",
    });
  }

  // 2. Record the signed event.
  // Existing events:
  // - processed: ignore
  // - recently received: another request may be processing it
  // - stale received: reclaim for retry
  // - failed: reclaim for retry

  let webhookEvent;

  try {
    webhookEvent = await WebhookEvent.create({
      paymentId: String(paymentId),
      eventType: eventStatus,
      status: "received",
    });
  } catch (error) {
    if (error.name !== "SequelizeUniqueConstraintError") {
      console.error(
        "[maya-webhook] Could not record incoming event:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Could not record webhook event.",
      });
    }

    let retryTransaction;

    try {
      retryTransaction = await sequelize.transaction();

      const existingEvent = await WebhookEvent.findOne({
        where: {
          paymentId: String(paymentId),
          eventType: eventStatus,
        },
        transaction: retryTransaction,
        lock: retryTransaction.LOCK.UPDATE,
      });

      if (!existingEvent) {
        throw new Error(
          "Existing webhook event could not be found."
        );
      }

      const lastUpdated = new Date(
        existingEvent.updatedAt || existingEvent.createdAt
      ).getTime();

      const receivedAge = Date.now() - lastUpdated;

      const isStaleReceived =
        existingEvent.status === "received" &&
        receivedAge >= STALE_RECEIVED_MS;

      const canRetry =
        existingEvent.status === "failed" ||
        isStaleReceived;

      if (!canRetry) {
        await retryTransaction.rollback();
        retryTransaction = null;

        console.log(
          "[maya-webhook] Duplicate webhook event ignored:",
          {
            paymentId,
            eventStatus,
            existingStatus: existingEvent.status,
            receivedAgeMs:
              existingEvent.status === "received"
                ? receivedAge
                : null,
          }
        );

        return res.status(200).json({
          success: true,
          message:
            existingEvent.status === "processed"
              ? "Webhook event already processed."
              : existingEvent.status === "received"
                ? "Webhook event is already being processed."
                : "Webhook event already exists.",
        });
      }

      // Reclaim the failed or stale event.
      existingEvent.status = "received";
      existingEvent.errorMessage = null;
      existingEvent.processedAt = null;

      await existingEvent.save({
        transaction: retryTransaction,
      });

      await retryTransaction.commit();
      retryTransaction = null;

      webhookEvent = existingEvent;

      console.log(
        "[maya-webhook] Reclaimed webhook event for retry:",
        {
          paymentId,
          eventStatus,
          previousStatus: isStaleReceived
            ? "stale received"
            : "failed",
          receivedAgeMs: isStaleReceived
            ? receivedAge
            : null,
        }
      );
    } catch (retryError) {
      if (retryTransaction && !retryTransaction.finished) {
        try {
          await retryTransaction.rollback();
        } catch (rollbackError) {
          console.error(
            "[maya-webhook] Retry transaction rollback failed:",
            rollbackError.message
          );
        }
      }

      console.error(
        "[maya-webhook] Could not reclaim webhook event:",
        retryError.message
      );

      return res.status(500).json({
        success: false,
        message: "Could not retry webhook event.",
      });
    }
  }

  // Update the event outside the payment transaction when processing fails.
  const markWebhookFailed = async (reason) => {
    try {
      webhookEvent.status = "failed";
      webhookEvent.errorMessage = String(reason).slice(0, 500);
      webhookEvent.processedAt = new Date();

      await webhookEvent.save();
    } catch (error) {
      console.error(
        "[maya-webhook] Could not update webhook event status:",
        error.message
      );
    }
  };

  let transaction;

  try {
    // 3. Retrieve the payment directly from Maya.
    const verifiedPayment = await getPayment(paymentId);
    const verifiedStatus = pickEventStatus(verifiedPayment);
    console.log("[maya-webhook] PAYMENT IDENTIFIERS:", {
  webhookId: webhook.id,
  webhookReference: webhook.requestReferenceNumber,
  verifiedId: verifiedPayment.id,
  verifiedReference: verifiedPayment.requestReferenceNumber,
});

    if (
      String(verifiedPayment.id) !== String(paymentId) ||
      verifiedStatus !== eventStatus
    ) {
      console.warn("[maya-webhook] Payment verification mismatch:", {
        webhookId: paymentId,
        verifiedId: verifiedPayment.id,
        webhookStatus: eventStatus,
        verifiedStatus,
      });

      await markWebhookFailed("Maya payment verification failed.");

      return res.status(400).json({
        success: false,
        message: "Maya payment verification failed.",
      });
    }

    // 4. Find the Artistry order using Maya's reference number.
    const referenceNumber = verifiedPayment.requestReferenceNumber;

    if (!referenceNumber) {
      console.warn(
        "[maya-webhook] Payment has no order reference:",
        paymentId
      );

      await markWebhookFailed(
        "Maya payment has no Artistry order reference."
      );

      return res.status(200).json({
        success: true,
        message: "Payment has no matching Artistry order. Ignored.",
      });
    }

    const order = await Order.findOne({
      where: { orderNumber: referenceNumber },
    });

    if (!order) {
      console.warn(
        "[maya-webhook] Unknown order reference:",
        referenceNumber
      );

      await markWebhookFailed(
        `No matching Artistry order for reference: ${referenceNumber}`
      );

      return res.status(200).json({
        success: true,
        message: "No matching Artistry order. Webhook ignored.",
      });
    }

    // 5. Start a transaction and lock the order.
    transaction = await sequelize.transaction();

    const lockedOrder = await Order.findOne({
      where: { id: order.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!lockedOrder) {
      throw new Error("Artistry order could not be found.");
    }

    // 6. Lock the order-level payment record.
    const payment = await Payment.findOne({
      where: {
        orderId: lockedOrder.id,
        provider: "maya",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!payment) {
      throw new Error("Maya payment record not found.");
    }

    // 7. Find the specific checkout attempt.
    let attempt = await PaymentAttempt.findOne({
      where: { providerPaymentId: String(paymentId) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    // Backward compatibility for older payments.
    if (
      !attempt &&
      String(payment.providerPaymentId) === String(paymentId)
    ) {
      attempt = await PaymentAttempt.create(
        {
          paymentId: payment.id,
          providerPaymentId: String(paymentId),
          checkoutUrl: payment.checkoutUrl || "legacy-checkout",
          status:
            payment.status === "paid"
              ? "paid"
              : payment.status === "failed"
                ? "failed"
                : "pending",
        },
        { transaction }
      );
    }

    if (!attempt || Number(attempt.paymentId) !== Number(payment.id)) {
      throw new Error(
        "Maya checkout ID does not match an attempt for this Artistry payment."
      );
    }

    // 8. Confirm the order reference.
    if (referenceNumber !== lockedOrder.orderNumber) {
      throw new Error("Maya order reference does not match.");
    }

    // 9. Validate amount and currency.
    const mayaCurrency =
      verifiedPayment.currency ||
      verifiedPayment.totalAmount?.currency;

    const mayaAmount =
      verifiedPayment.totalAmount?.value ??
      verifiedPayment.amount;

    const mayaAmountCents = getAmountInCents(mayaAmount);
    const orderAmountCents = getAmountInCents(lockedOrder.total);

    let mismatchReason = null;

    if (String(mayaCurrency).toUpperCase() !== "PHP") {
      mismatchReason =
        `Currency mismatch. Expected: PHP; Received: ${mayaCurrency || "unknown"}.`;
    } else if (
      mayaAmountCents === null ||
      orderAmountCents === null ||
      mayaAmountCents !== orderAmountCents
    ) {
      mismatchReason =
        `Amount mismatch. Maya amount: ${mayaAmount}; Artistry order amount: ${lockedOrder.total}.`;
    }

    // 10. Save mismatches for review.
    if (mismatchReason) {
      webhookEvent.status = "failed";
      webhookEvent.errorMessage = mismatchReason.slice(0, 500);
      webhookEvent.processedAt = new Date();

      await webhookEvent.save({ transaction });

      await transaction.commit();
      transaction = null;

      console.error("[maya-webhook] PAYMENT MISMATCH FLAGGED:", {
        paymentId,
        orderNumber: lockedOrder.orderNumber,
        expectedAmount: String(lockedOrder.total),
        receivedAmount: String(mayaAmount),
        expectedCurrency: "PHP",
        receivedCurrency: mayaCurrency || "unknown",
        reason: mismatchReason,
      });

      return res.status(200).json({
        success: true,
        message:
          "Payment mismatch recorded. The payment was not marked as paid and requires admin review.",
      });
    }

    const previousOrderStatus = lockedOrder.status;

    // 11. Handle successful payment.
    if (eventStatus === "PAYMENT_SUCCESS") {
      if (payment.status === "paid" || lockedOrder.status === "paid") {
        const wasAlreadyPaidAttempt = attempt.status === "paid";

        attempt.status = "paid";
        await attempt.save({ transaction });

        if (!wasAlreadyPaidAttempt) {
          await OrderStatusHistory.create(
            {
              orderId: lockedOrder.id,
              changedBy: null,
              fromStatus: lockedOrder.status,
              toStatus: lockedOrder.status,
              note:
                "WARNING: An additional Maya checkout attempt succeeded after this order was already paid. Possible duplicate charge; manual payment review or refund is required.",
            },
            { transaction }
          );

          console.error(
            `[maya-webhook] POSSIBLE DUPLICATE CHARGE: ${lockedOrder.orderNumber}; attempt ${paymentId}`
          );
        }

        webhookEvent.status = "processed";
        webhookEvent.processedAt = new Date();
        await webhookEvent.save({ transaction });

        await transaction.commit();
        transaction = null;

        return res.status(200).json({
          success: true,
          message: wasAlreadyPaidAttempt
            ? "This payment attempt was already recorded."
            : "Additional successful attempt recorded for manual review.",
        });
      }

      // A successful payment after cancellation/expiry is not reopened.
      if (lockedOrder.status !== "pending_payment") {
        attempt.status = "paid";
        payment.status = "paid";
        payment.paidAt = new Date();

        await attempt.save({ transaction });
        await payment.save({ transaction });

        await OrderStatusHistory.create(
          {
            orderId: lockedOrder.id,
            changedBy: null,
            fromStatus: lockedOrder.status,
            toStatus: lockedOrder.status,
            note:
              "WARNING: Maya confirmed payment after the order was no longer awaiting payment. The order was not reopened. Manual payment review or refund is required.",
          },
          { transaction }
        );

        webhookEvent.status = "processed";
        webhookEvent.processedAt = new Date();
        await webhookEvent.save({ transaction });

        await transaction.commit();
        transaction = null;

        console.error(
          `[maya-webhook] LATE PAYMENT: ${lockedOrder.orderNumber}. Manual review required.`
        );

        return res.status(200).json({
          success: true,
          message:
            "Late payment recorded. Order requires manual payment review.",
        });
      }

      // First successful attempt.
      attempt.status = "paid";
      payment.status = "paid";
      payment.paidAt = new Date();
      lockedOrder.status = "paid";

      await attempt.save({ transaction });
      await payment.save({ transaction });
      await lockedOrder.save({ transaction });

      // Cancel other pending checkout sessions.
      await PaymentAttempt.update(
        { status: "cancelled" },
        {
          where: {
            paymentId: payment.id,
            status: "pending",
            providerPaymentId: {
              [Op.ne]: String(paymentId),
            },
          },
          transaction,
        }
      );

      // Count coupon usage only for the first successful payment.
      if (lockedOrder.couponId) {
        const coupon = await Coupon.findByPk(lockedOrder.couponId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (coupon) {
          await coupon.increment("usedCount", {
            by: 1,
            transaction,
          });
        }
      }

      await OrderStatusHistory.create(
        {
          orderId: lockedOrder.id,
          changedBy: null,
          fromStatus: previousOrderStatus,
          toStatus: "paid",
          note: "Payment successfully verified through Maya Sandbox.",
        },
        { transaction }
      );

      webhookEvent.status = "processed";
      webhookEvent.processedAt = new Date();
      await webhookEvent.save({ transaction });

      await transaction.commit();
      transaction = null;

      console.log("[maya-webhook] Successfully processed payment:", {
        eventStatus,
        orderNumber: lockedOrder.orderNumber,
        paymentStatus: payment.status,
        orderStatus: lockedOrder.status,
        attemptId: attempt.id,
      });

      return res.status(200).json({
        success: true,
        message: "Maya payment successfully processed.",
      });
    }

    // 12. Handle unsuccessful attempts.
    // The order reservation remains active until its original expiry time.
    if (payment.status === "paid" || lockedOrder.status === "paid") {
      if (attempt.status === "pending") {
        attempt.status = attemptStatusFromEvent(eventStatus);
        await attempt.save({ transaction });
      }

      webhookEvent.status = "processed";
      webhookEvent.processedAt = new Date();
      await webhookEvent.save({ transaction });

      await transaction.commit();
      transaction = null;

      return res.status(200).json({
        success: true,
        message:
          "Unsuccessful event for an order that is already paid was recorded.",
      });
    }

    if (attempt.status === "pending") {
      attempt.status = attemptStatusFromEvent(eventStatus);
      await attempt.save({ transaction });
    }

    webhookEvent.status = "processed";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save({ transaction });

    await transaction.commit();
    transaction = null;

    console.log("[maya-webhook] Checkout attempt ended without payment:", {
      eventStatus,
      orderNumber: lockedOrder.orderNumber,
      orderStatus: lockedOrder.status,
      paymentStatus: payment.status,
      attemptId: attempt.id,
      attemptStatus: attempt.status,
    });

    return res.status(200).json({
      success: true,
      message:
        "This Maya checkout attempt ended without payment. The order reservation remains active until its original expiry time.",
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          "[maya-webhook] Transaction rollback failed:",
          rollbackError.message
        );
      }
    }

    // Save failure outside the rolled-back payment transaction.
    await markWebhookFailed(error.message);

    console.error("[maya-webhook] Processing failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed.",
    });
  }
});

module.exports = router;
