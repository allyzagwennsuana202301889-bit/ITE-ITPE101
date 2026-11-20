
const crypto = require("crypto");

// Maya Sandbox webhook public keys.
// Both keys are required to support key rotation.
const MAYA_SANDBOX_PUBLIC_KEYS = [
`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjNkSX6p+goDPaPAYuTzT
zKTCBeLhh8FkPMbZxDKTUxF93dOwiC7jsdx7KyopupeLosiVlbs+gpAJ7XBQP/Ex
giyzXC9TljpyvkUQfyRPMAMKq+BzxdUliTl6hgrLBsH28CP5FuPHCsfxDXe7mDtv
9H4mP3SKO0HfkZ45tudxD9CWbwWKF0lU9LRbLlJ0y7KEaK7Rv9fI1Dp/KPT+9pls
tU+CPNKaxJjGRKGuxW2AOCabSD0cTZNXki+K51mNoma7Mj1HMhnsR68FGJvCqk1q
Wsr3q8+EUMVPBMX+5nKATfZYGvxg4ytzT8pnEVeWl6phYKviB9aVVwurh1gDJB4r
lQIDAQAB
-----END PUBLIC KEY-----`,

`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAp14gezqq4dGWu7EZ7BHx
8wD3y1hqxwQR7UYPXtXJP+WngN4wqwatjsnQaRGnmdPRG8VEzUzw9PlR7t7P24uW
+J08xBrtTVouD2MKglcIcy13rt1XL79zr/LIAFMFI6f4O8/OQi1xsGsZ6xarD+wl
OQKG4W66I3yp2jNAbge25eSPuo0BNqPWvebMcIYJu4f3Fxu1eDgeM6zCEqLc6+jX
cNTP/zFHCvQaiIlLOqfgXDRPBcHPPZ2qcB99UVPAHXBKsKdtBB2w2qT2l99MlTAB
iRy+IKtVQcQyRP7T8blegO25x35G2CZ3VCKPkmUen3eXQ4+r5fVlzEIBSfNvBwT9
jQIDAQAB
-----END PUBLIC KEY-----`,
];

function flattenPayload(obj, prefix = "", result = []) {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0)
    ) {
      continue;
    }

    if (typeof value === "object") {
      flattenPayload(value, fullKey, result);
    } else {
      result.push(`${fullKey}=${String(value)}`);
    }
  }

  return result;
}

// Explains WHY a webhook was accepted or rejected, so the terminal can tell you.
function explainMayaWebhook(payload, signatureHeader, timestamp) {
  const no = (reason) => ({ valid: false, reason });

  if (!payload || typeof payload !== "object" || Object.keys(payload).length === 0) {
    return no("Request body is empty or is not JSON.");
  }
  if (!signatureHeader) return no("Missing X-Maya-Webhook-Signature header (request may not be from Maya).");
  if (!timestamp) return no("Missing X-Maya-Webhook-Timestamp header (request may not be from Maya).");

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return no("X-Maya-Webhook-Timestamp is not a number.");

  // Reject webhook deliveries more than five minutes away from this computer's clock.
  const skewMs = Date.now() - timestampNumber;
  if (Math.abs(skewMs) > 5 * 60 * 1000) {
    return no(
      `Timestamp is ${Math.round(skewMs / 1000)}s away from this computer's clock (limit 300s). ` +
        "Check that your PC date, time and time zone are correct."
    );
  }

  const parts = {};
  for (const segment of String(signatureHeader).split(",")) {
    const separator = segment.indexOf("=");
    if (separator === -1) continue;
    parts[segment.slice(0, separator).trim()] = segment.slice(separator + 1).trim();
  }

  const nonce = parts.nonce;
  const signature = parts.v1;
  if (!nonce || !signature) return no("Signature header has no nonce or v1 value.");

  const flattened = flattenPayload(payload).sort().join("&");
  const verifyString = `${flattened}&nonce=${nonce}`;

  const matched = MAYA_SANDBOX_PUBLIC_KEYS.some((publicKey) => {
    try {
      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(verifyString);
      verifier.end();
      return verifier.verify(publicKey, signature, "hex");
    } catch (error) {
      return false;
    }
  });

  return matched
    ? { valid: true }
    : no("Signature did not match either Maya SANDBOX public key (body altered, or the request was not signed by Maya sandbox).");
}

function verifyMayaWebhook(payload, signatureHeader, timestamp) {
  return explainMayaWebhook(payload, signatureHeader, timestamp).valid;
}

module.exports = { verifyMayaWebhook, explainMayaWebhook };
