import { useEffect, useState } from "react";
import { api } from "../api";
import useAuth from "../hooks/useAuth";
import { CartContext } from "./CartContextValue";

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      window.queueMicrotask(() => setCart([]));
      return;
    }

    const cacheKey = `artistry_cart_${user.id}`;
    window.queueMicrotask(() => {
      try {
        const cachedCart = JSON.parse(localStorage.getItem(cacheKey) || "[]");
        if (Array.isArray(cachedCart)) setCart(cachedCart);
      } catch {
        localStorage.removeItem(cacheKey);
      }
    });

    api("/cart")
      .then((data) => setCart(data.cart?.items || data.data?.items || []))
      .catch((error) => console.error("Could not load cart:", error.message));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`artistry_cart_${user.id}`, JSON.stringify(cart));
  }, [cart, user]);

  const refreshCart = (items) => setCart(items);

  return (
    <CartContext.Provider
      value={{
        cart,
        setCart,
        cartOpen,
        setCartOpen,
        cartBusy,
        setCartBusy,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
