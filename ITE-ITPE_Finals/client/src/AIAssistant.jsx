
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";
import "./AIAssistant.css";
import useNetworkStatus from "./hooks/useNetworkStatus";

function AIAssistant({ initialOpen = false }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(initialOpen);
  const { isOnline } = useNetworkStatus();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm Artistry's AI Art Supply Assistant. 🎨 Ask me about art supplies, product recommendations, or what materials you need for your next project!",
      products: [],
    },
  ]);
  const [sending, setSending] = useState(false);
  const [showSearchFallback, setShowSearchFallback] = useState(false);

  async function sendMessage(event) {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || sending) return;
    if (!isOnline) {
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: "AI Assistant is unavailable while offline. Please reconnect and try again.", products: [] },
      ]);
      return;
    }

    setMessages((previous) => [
      ...previous,
      { role: "user", content: trimmedQuestion },
    ]);
    setQuestion("");
    setSending(true);

    try {
      const data = await api("/ai/ask", {
        method: "POST",
        body: JSON.stringify({ question: trimmedQuestion }),
      });

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            data.answer ||
            "I couldn't generate an answer. Please try again.",
          products: Array.isArray(data.products) ? data.products : [],
        },
      ]);
    } catch (error) {
      const unavailable =
        error.status === 503 ||
        error.code === "AI_UNAVAILABLE";
      if (unavailable) setShowSearchFallback(true);
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            unavailable
              ? "AI-assisted recommendations are temporarily unavailable. Use the standard product search to continue browsing."
              : error.message || "The AI Assistant is temporarily unavailable.",
          products: [],
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ai-assistant">
      {isOpen && (
        <div className="ai-chat-window">
          <div className="ai-chat-header">
            <div>
              <strong>Artistry Assistant ✨</strong>
              <span>AI-assisted responses and product recommendations</span>
            </div>

            <button
              type="button"
              className="ai-close-button"
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant"
            >
              ×
            </button>
          </div>

          <div className="ai-chat-messages">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`ai-message ${message.role}`}
              >
                {message.role === "assistant" ? (
                  <>
                    <span>{message.content}</span>

                    {message.products?.length > 0 && (
                      <div className="ai-product-list">
                        {message.products.map((product) => (
                          <div
                            className="ai-product-card"
                            key={product.id}
                          >
                            {product.imageUrl && (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="ai-product-image"
                              />
                            )}

                            <div className="ai-product-details">
                              <strong>{product.name}</strong>
                              <span>{product.category}</span>

                              <strong>
                                ₱
                                {Number(product.price).toLocaleString(
                                  "en-PH",
                                  {
                                    minimumFractionDigits: 2,
                                  }
                                )}
                              </strong>

                              <span>
                                {product.stock} in stock
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  message.content
                )}
              </div>
            ))}
          </div>

          {showSearchFallback && (
            <button
              type="button"
              className="ai-fallback-button"
              onClick={() => {
                setIsOpen(false);
                navigate("/products");
              }}
            >
              Open standard product search
            </button>
          )}

          <form
            className="ai-chat-form"
            onSubmit={sendMessage}
          >
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about art supplies..."
              aria-label="Ask Artistry AI about art supplies"
              maxLength={1000}
              disabled={sending || !isOnline}
            />

            <button
              type="submit"
              disabled={!question.trim() || sending || !isOnline}
              title={!isOnline ? "Reconnect to use AI Assistant" : undefined}
            >
              {sending ? "..." : "Send"}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="ai-toggle-button"
        aria-label={isOpen ? "Close Artistry AI" : "Ask Artistry AI"}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        {isOpen ? (
          "×"
        ) : (
          <>
            <span className="ai-toggle-label-full">✨ Ask Artistry AI</span>
            <span className="ai-toggle-label-compact" aria-hidden="true">✨ Ask AI</span>
          </>
        )}
      </button>
    </div>
  );
}

export default AIAssistant;
