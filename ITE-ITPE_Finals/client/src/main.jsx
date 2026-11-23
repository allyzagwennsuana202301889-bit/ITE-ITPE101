
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { NetworkStatusProvider } from "./context/NetworkStatusContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <NetworkStatusProvider>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/products" element={<App />} />
              <Route path="/products/:id" element={<App />} />
              <Route path="/ai-assistant" element={<App />} />
              <Route path="/login" element={<App />} />
              <Route path="/register" element={<App />} />
              <Route path="/payment/success" element={<App />} />
              <Route path="/payment/cancelled" element={<App />} />
              <Route path="/payment/failed" element={<App />} />
              <Route path="/cart" element={<ProtectedRoute><App /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute><App /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><App /></ProtectedRoute>} />
              <Route path="/orders/:id" element={<ProtectedRoute><App /></ProtectedRoute>} />
              <Route path="/admin/*" element={<ProtectedRoute adminOnly><App /></ProtectedRoute>} />
              <Route path="/shop" element={<App />} />
              <Route path="/art-kit" element={<App />} />
              <Route path="/compatibility" element={<App />} />
              <Route path="*" element={<App />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </NetworkStatusProvider>
    </BrowserRouter>
  </StrictMode>
);
