import { useState } from "react";
import { API_BASE } from "./api";

const API_URL = `${API_BASE}/auth`;

function AuthModal({ initialMode = "login", onClose, onSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";

  function switchMode(next) {
    setMode(next);
    setError("");
    setPassword("");
    setConfirm("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!navigator.onLine) {
      setError("Login and registration require an internet connection.");
      return;
    }

    if (isSignup) {
      if (password.length < 8) {
        return setError("Password must be at least 8 characters.");
      }
      if (password !== confirm) {
        return setError("Passwords do not match.");
      }
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `${API_URL}/${isSignup ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isSignup ? { name, email, password } : { email, password }
          ),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error?.message || data.message || "Something went wrong. Please try again.");
      }

      onSuccess(data);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Cannot reach the server. Make sure the backend is running."
          : err.message
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="auth-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>

        <span className="auth-brand">
          <span className="brand-icon">✳</span> artistry
          <span className="brand-dot">.</span>
        </span>

        <h2 id="auth-title">{isSignup ? "Create your account" : "Welcome back"}</h2>
        <p className="auth-subtitle">
          {isSignup
            ? "Join Artistry to save your cart and check out faster."
            : "Log in to continue shopping."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <label>
              Full name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={120}
                required
                autoFocus
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              maxLength={190}
              required
              autoFocus={!isSignup}
            />
          </label>

          <label>
            Password
            <div className="auth-password">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength={isSignup ? 8 : undefined}
                maxLength={72}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {isSignup && <small>At least 8 characters.</small>}
          </label>

          {isSignup && (
            <label>
              Confirm password
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                maxLength={72}
                required
              />
            </label>
          )}

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting
              ? "Please wait..."
              : isSignup
              ? "Create account"
              : "Log in"}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "New to Artistry?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(isSignup ? "login" : "signup")}
          >
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default AuthModal;
