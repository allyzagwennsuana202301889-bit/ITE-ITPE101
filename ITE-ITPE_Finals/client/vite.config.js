
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    proxy: {
      "/api/v1": {
        target: "https://ite-itpe101.onrender.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      manifest: {
        name: "Artistry",
        short_name: "Artistry",
        description: "Discover art supplies and build your creative kits.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#ed795e",
        background_color: "#fffdf9",

        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      includeAssets: ["favicon.svg", "offline.html", "pwa-192x192.png", "pwa-512x512.png"],

      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,jpg,jpeg,webp}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/checkout/, /^\/webhooks\//],

        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET" &&
              url.origin === "https://ite-itpe101.onrender.com" &&
              url.pathname.startsWith("/api/v1/products"),
            handler: "NetworkFirst",
            options: {
              cacheName: "artistry-products",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 86400,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "artistry-product-images",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
