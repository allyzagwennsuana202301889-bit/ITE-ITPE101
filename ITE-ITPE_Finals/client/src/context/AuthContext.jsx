import { useCallback, useEffect, useState } from "react";
import { api, TOKEN_KEY } from "../api";
import { AuthContext } from "./AuthContextValue";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    api("/auth/me")
      .then((data) => setUser(data.data?.user || data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY));
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setAuthMode("login");
    };
    window.addEventListener("artistry:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("artistry:unauthorized", handleUnauthorized);
  }, []);

  const openAuth = useCallback((mode = "login") => setAuthMode(mode), []);
  const closeAuth = useCallback(() => setAuthMode(null), []);
  const handleAuthSuccess = useCallback(({ token, user: loggedInUser }) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(loggedInUser);
    setAuthMode(null);
  }, []);
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, authMode, openAuth, closeAuth, handleAuthSuccess, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
