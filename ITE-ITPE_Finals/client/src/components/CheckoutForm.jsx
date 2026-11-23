import { useState } from "react";

export default function CheckoutForm({ busy, isOnline, onSubmit, onClose }) {
  const [shippingAddress, setShippingAddress] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!isOnline) {
      setError("Checkout requires an internet connection.");
      return;
    }
    if (shippingAddress.trim().length < 10) {
      setError("Enter a complete shipping address (at least 10 characters).");
      return;
    }

    try {
      await onSubmit({
        shippingAddress: shippingAddress.trim(),
        couponCode: couponCode.trim(),
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to start Maya Checkout. Please try again."
      );
    }
  };

  return (
    <div className="cart-overlay" role="presentation" onClick={onClose}>
      <section className="cart-panel" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onClick={(event) => event.stopPropagation()}>
        <header className="cart-header">
          <h2 id="checkout-title">Checkout details</h2>
          <button type="button" aria-label="Close checkout" onClick={onClose}>✕</button>
        </header>
        <form className="checkout-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="shipping-address">Complete shipping address</label>
          <textarea
            id="shipping-address"
            value={shippingAddress}
            onChange={(event) => setShippingAddress(event.target.value)}
            maxLength={500}
            autoComplete="street-address"
            required
          />
          <label htmlFor="coupon-code">Coupon code <span>(optional)</span></label>
          <input
            id="coupon-code"
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value)}
            maxLength={50}
            autoComplete="off"
          />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="checkout-button" type="submit" disabled={busy || !isOnline}>
            {!isOnline ? "Reconnect to checkout" : busy ? "Please wait..." : "Continue to Maya"}
          </button>
        </form>
      </section>
    </div>
  );
}
