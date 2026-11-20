
const MAYA_BASE_URL =
  process.env.MAYA_BASE_URL || "https://pg-sandbox.paymaya.com";

// Public key authentication for creating checkout sessions
function getPublicAuthHeader() {
  const publicKey = process.env.MAYA_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error("MAYA_PUBLIC_KEY is missing from .env.");
  }

  return `Basic ${Buffer.from(`${publicKey}:`).toString("base64")}`;
}

// Secret key authentication for retrieving payment details
function getSecretAuthHeader() {
  const secretKey = process.env.MAYA_SECRET_KEY;

  if (!secretKey) {
    throw new Error("MAYA_SECRET_KEY is missing from .env.");
  }

  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

// Create a Maya Checkout session
async function createCheckout({ order, items, buyer }) {
  const response = await fetch(
    `${MAYA_BASE_URL}/checkout/v1/checkouts`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: getPublicAuthHeader(),
      },
      body: JSON.stringify({
        totalAmount: {
          value: Number(order.total).toFixed(2),
          currency: "PHP",
        },
        requestReferenceNumber: order.orderNumber,
        buyer: {
          firstName: buyer?.firstName || "Artistry",
          lastName: buyer?.lastName || "Customer",
          email: buyer?.email || undefined,
          phone: buyer?.phone || undefined,
        },
        items: items.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          amount: {
            value: Number(item.unitPrice).toFixed(2),
            currency: "PHP",
          },
          totalAmount: {
            value: Number(item.lineTotal).toFixed(2),
            currency: "PHP",
          },
        })),
        redirectUrl: {
          success: `${process.env.CLIENT_URL || "http://localhost:5173"}/payment/success`,
          failure: `${process.env.CLIENT_URL || "http://localhost:5173"}/payment/failed`,
          cancel: `${process.env.CLIENT_URL || "http://localhost:5173"}/payment/cancelled`,
        },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));
  console.log("Maya Checkout Response:", JSON.stringify(data, null, 2));

  if (!response.ok) {
    console.error("Maya Checkout error:", data);
    throw new Error(
      data.message || data.error || `Maya Checkout failed (${response.status}).`
    );
  }

  if (!data.checkoutId || !data.redirectUrl) {
    console.error("Unexpected Maya response:", data);
    throw new Error("Maya did not return a checkout ID and redirect URL.");
  }

  return data;
}

// Retrieve payment details directly from Maya
async function getPayment(paymentId) {
  if (!paymentId) {
    throw new Error("Payment ID is required.");
  }

  const response = await fetch(
    `${MAYA_BASE_URL}/payments/v1/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: getSecretAuthHeader(),
      },
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Maya payment verification error:", data);
    throw new Error(
      data.message || data.error || `Payment verification failed (${response.status}).`
    );
  }

  return data;
}

module.exports = {
  createCheckout,
  getPayment,
};
