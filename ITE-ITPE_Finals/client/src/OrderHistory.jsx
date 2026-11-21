import { useEffect, useState } from "react";
import { api } from "./api";

export default function OrderHistory({ onClose }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [retryingId, setRetryingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  async function loadOrders() {
    try {
      const response = await api("/orders");
      setOrders(response.orders || []);
      setError("");
    } catch (e) {
      setError(e.message || "Unable to load your orders.");
    }
  }

  useEffect(() => {
    window.queueMicrotask(() => {
      void loadOrders();
    });
  }, []);

  async function handleRetryPayment(orderId) {
    setRetryingId(orderId);
    setActionError("");

    try {
      const response = await api(`/orders/${orderId}/retry-payment`, {
        method: "POST",
      });

      if (!response.checkoutUrl) {
        throw new Error("Maya did not return a checkout URL.");
      }

      window.location.assign(response.checkoutUrl);
    } catch (e) {
      setActionError(e.message || "Unable to create a new payment session.");
      setRetryingId(null);
    }
  }

  async function handleCancelOrder(orderId) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this order? The reserved stock will be released."
    );

    if (!confirmed) return;

    setCancellingId(orderId);
    setActionError("");

    try {
      await api(`/orders/${orderId}/cancel`, {
        method: "PATCH",
      });

      await loadOrders();
    } catch (e) {
      setActionError(e.message || "Unable to cancel this order.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="admin-overlay" onClick={onClose}>
      <section
        className="history-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="history-close"
          aria-label="Close order history"
          onClick={onClose}
        >
          ✕
        </button>
        <header className="admin-header">
          <h2>Your orders</h2>
        </header>

        {error && <p className="empty-message">{error}</p>}

        {actionError && (
          <p className="empty-message">{actionError}</p>
        )}

        {orders.length === 0 && !error && (
          <p className="empty-message">No orders yet.</p>
        )}

        {orders.map((order) => (
          <article className="history-order" key={order.id}>
            <div className="history-order-head">
              <strong>{order.orderNumber}</strong>
              <span>
                {new Date(order.createdAt).toLocaleDateString()}
              </span>
            </div>

            <p>
              Status: <b>{order.status}</b>
            </p>

            {order.items?.map((item) => (
              <p key={item.id}>
                {item.productName} × {item.quantity} — ₱
                {Number(item.lineTotal).toLocaleString("en-PH")}
              </p>
            ))}

            <strong className="history-order-total">
              Total: ₱{Number(order.total).toLocaleString("en-PH")}
            </strong>

            {order.status === "pending_payment" && (
              <div className="history-order-actions">
                <button
                  className="history-retry-button"
                  onClick={() => handleRetryPayment(order.id)}
                  disabled={retryingId !== null || cancellingId !== null}
                >
                  {retryingId === order.id
                    ? "Creating new payment session..."
                    : "Retry Payment"}
                </button>

                <button
                  className="history-cancel-button"
                  onClick={() => handleCancelOrder(order.id)}
                  disabled={retryingId !== null || cancellingId !== null}
                >
                  {cancellingId === order.id
                    ? "Cancelling order..."
                    : "Cancel Order"}
                </button>
              </div>
            )}

            {order.statusHistory?.length > 0 && (
              <div className="history-order-timeline">
                <strong>Order history</strong>

                {order.statusHistory.map((entry) => (
                  <p key={entry.id}>
                    <b>{entry.toStatus}</b>
                    {entry.note ? ` · ${entry.note}` : ""}
                    {entry.createdAt && (
                      <span>
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    )}
                  </p>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}