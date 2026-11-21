# Artistry

Mobile-first e-commerce Progressive Web Application for browsing art supplies, building custom kits, checking device compatibility, managing a cart, placing Maya checkout orders, and viewing orders.

## Technology Stack

- React
- Vite
- React Router
- vite-plugin-pwa and Workbox
- Existing Express REST API

## Architecture

- `src/api.js` contains the API base URL and authenticated fetch wrapper.
- `src/context/` contains shared auth, cart, and network status state.
- `src/components/` contains reusable mobile UI primitives and protected routing.
- `src/App.jsx` contains the existing storefront and feature screens.
- `public/` contains PWA icons and the offline fallback.
- The Express backend, database, payment secrets, and webhooks are not included in this frontend.

## Installation

```bash
cd client
npm install
```

No environment file is required for local development. The Vite server proxies `/api/v1` to the deployed Render API, avoiding the backend's production CORS allowlist in the browser. If you need a custom API, create `.env` from `.env.example` and set `VITE_API_URL`.

For Vercel, set `VITE_API_URL` to `https://ite-itpe101.onrender.com/api/v1` in the project environment variables; the backend must allow the deployed frontend origin.

## Development

```bash
npm run dev
```

## Production Build

```bash
npm run lint
npm run build
npm run preview
```

PWA artifacts are generated in `dist/`, including `manifest.webmanifest`, `sw.js`, and Workbox files.

## API Configuration

The frontend uses `VITE_API_URL`. In development it defaults to the Vite `/api/v1` proxy; in production it defaults to:

`https://ite-itpe101.onrender.com/api/v1`

The API wrapper sends JWT authentication from local storage and parses standard success/error response envelopes.

## PWA and Offline Behavior

- Standalone portrait manifest.
- 192×192 and 512×512 PNG icons.
- App-shell precaching.
- NetworkFirst caching for product GET requests.
- CacheFirst caching for images.
- Persistent offline status indicator.
- Locally cached cart display.
- Checkout, authentication, payment, AI, and mutations are blocked while offline.
- POST, PATCH, DELETE, authentication, checkout, payment, and webhook routes are not configured for runtime caching.

## Deployment

Deploy this `client` directory to Vercel. Configure `VITE_API_URL` in Vercel environment variables if needed. The included `vercel.json` rewrites deep links to `index.html`.

## Verification Checklist

- Test direct navigation and browser refresh for `/products/:id`, `/orders/:id`, `/payment/success`, `/payment/cancelled`, `/payment/failed`, `/login`, `/admin/*`, and `/checkout`.
- Test at 360×800, 390×844, 412×915, and 800×600.
- Build and preview the PWA over HTTPS.
- Inspect the manifest and service worker in Chrome DevTools.
- Load the catalog online, enable offline mode, and reload to verify cached products and images.
- Run a mobile Lighthouse audit after deployment and preserve the exported report for final defense.

Deployment URL:

- `[ADD DEPLOYED VERCEL HTTPS URL HERE]`

Lighthouse evidence:

- `[ADD MOBILE LIGHTHOUSE PDF OR SCREENSHOT HERE]`
