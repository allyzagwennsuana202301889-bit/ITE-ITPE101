
const cron = require("node-cron");
const { reconcileMayaPayments } = require("../reconcileMayaPayments");

let isRunning = false;

function startMayaReconciliationJob() {
  cron.schedule("*/5 * * * *", async () => {
    if (isRunning) {
      console.log(
        "[maya-reconciliation] Previous run is still running. Skipping."
      );
      return;
    }

    isRunning = true;

    console.log("[maya-reconciliation] Starting scheduled check.");

    try {
      await reconcileMayaPayments();
    } catch (error) {
      console.error(
        "[maya-reconciliation] Job failed:",
        error.message
      );
    } finally {
      isRunning = false;
    }
  });

  console.log(
    "[maya-reconciliation] Scheduled to run every 5 minutes."
  );
}

module.exports = { startMayaReconciliationJob };
