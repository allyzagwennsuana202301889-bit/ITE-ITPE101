const defaultApiBase = import.meta.env.DEV
  ? "/api/v1"
  : "https://ite-itpe101.onrender.com/api/v1";
export const API_BASE = (import.meta.env.VITE_API_URL || defaultApiBase).replace(/\/$/, "");
export const TOKEN_KEY = "artistry_token";

export class ApiError extends Error {
  constructor(message, { code = "", details = null, status = 0, requestId = "" } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status;
    this.requestId = requestId;
  }
}

export async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  if (!navigator.onLine && ["POST", "PATCH", "PUT", "DELETE"].includes((options.method || "GET").toUpperCase())) {
    throw new ApiError("This action requires an internet connection.", { code: "OFFLINE", status: 0 });
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new ApiError(
      data.error?.message || data.message || "The request could not be completed.",
      {
        code: data.error?.code || "",
        details: data.error?.details || null,
        status: response.status,
        requestId: data.requestId || "",
      }
    );
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!location.pathname.startsWith("/login") && !location.pathname.startsWith("/register")) {
        window.dispatchEvent(new CustomEvent("artistry:unauthorized"));
      }
    }
    throw error;
  }
  return data;
}
