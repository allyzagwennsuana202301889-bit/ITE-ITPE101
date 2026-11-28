# Artistry API Documentation

## 1. Overview

The Artistry backend exposes a JSON REST API under `/api/v1`. The React
frontend calls this API from `client/src/api.js`.

- Local API root: `http://localhost:5000/`
- Local API prefix: `http://localhost:5000/api/v1`
- Local product endpoint: `http://localhost:5000/api/v1/products`
- Local Swagger UI: `http://localhost:5000/api-docs`
- OpenAPI source: `server/openapi.yaml`
- Deployment API root: `https://ite-itpe101.onrender.com/`
- Deployment product endpoint: `https://ite-itpe101.onrender.com/api/v1/products`

Send `Content-Type: application/json` for POST, PUT, and PATCH requests that
use JSON bodies. The API's exact schemas may also be inspected in Swagger UI;
the OpenAPI file is the machine-readable route reference.

## 2. Authentication

Customer and administrator login both use
`POST /api/v1/auth/register` and `POST /api/v1/auth/login`. Login returns a JWT.

Protected requests send:

```http
Authorization: Bearer <token>
```

The server validates the token in `server/middleware/auth.js`. Missing or
invalid bearer credentials normally produce `401`; an authenticated account
without the administrator role produces `403`.

| Role | Access |
|---|---|
| Public | No login required |
| Customer | Valid customer or administrator bearer token |
| Administrator | Valid bearer token with `role: "admin"` |

## 3. Endpoint Reference

### 3.1 API, products, and categories

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/` | Public | Return the API welcome response |
| GET | `/api/v1/products` | Public | List active products; supports `page`, `limit`, `search`, `category`, `categoryId`, `minPrice`, `maxPrice`, `sort`, and `direction` |
| GET | `/api/v1/products/{id}` | Public | Retrieve one active product |
| GET | `/api/v1/categories` | Public | List categories |

The public product route rejects invalid pagination and price-filter values
when applicable. The response includes product records and pagination
information.

### 3.2 Authentication

| Method | Endpoint | Access | Request |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | `{ "name", "email", "password" }` |
| POST | `/api/v1/auth/login` | Public | `{ "email", "password" }` |
| GET | `/api/v1/auth/me` | Authenticated | Bearer token; no body |

Registration uses name length 2-120, email length and format validation,
password length 8-72, unique email lookup, and bcrypt password hashing.
Registration and login return `success`, `token`, and a public user object.
Login is rate-limited per IP and email for 10 failed attempts within 15
minutes.

### 3.3 Cart, coupons, checkout, and orders

| Method | Endpoint | Access | Request or purpose |
|---|---|---|---|
| GET | `/api/v1/cart` | Authenticated | Retrieve the user's cart |
| POST | `/api/v1/cart/items` | Authenticated | `{ "productId", "quantity" }` |
| PATCH | `/api/v1/cart/items/{productId}` | Authenticated | `{ "quantity" }` |
| DELETE | `/api/v1/cart/items/{productId}` | Authenticated | Remove one line |
| DELETE | `/api/v1/cart` | Authenticated | Clear the user's cart |
| POST | `/api/v1/coupons/validate` | Authenticated | `{ "code", "subtotal" }` |
| POST | `/api/v1/checkout` | Authenticated | Shipping address and optional coupon |
| GET | `/api/v1/orders` | Authenticated | List owned orders |
| GET | `/api/v1/orders/{id}` | Authenticated | Retrieve one owned order |
| POST | `/api/v1/orders/{id}/retry-payment` | Authenticated | Create a new Maya attempt for an eligible pending-payment order |
| PATCH | `/api/v1/orders/{id}/cancel` | Authenticated | Cancel an eligible unpaid order |

Checkout requires `shippingAddress` and an `Idempotency-Key` header of
8-100 characters. It also accepts an optional `couponCode`. Checkout validates
stock and coupon state, calculates server-side totals, decrements reserved
stock, creates order/payment records, and creates a Maya checkout session.

Cart and order queries are limited to the authenticated user.

### 3.4 Administration

Every route in this section requires an authenticated account with the
administrator role.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/admin/dashboard` | Dashboard statistics and recent orders |
| GET | `/api/v1/admin/payment-mismatches` | Payment mismatch and webhook-event review |
| GET | `/api/v1/admin/products` | List products for administration |
| POST | `/api/v1/admin/products` | Create a product |
| PUT | `/api/v1/admin/products/{id}` | Update a product |
| DELETE | `/api/v1/admin/products/{id}` | Deactivate rather than physically delete a product |
| POST | `/api/v1/admin/inventory/{productId}/adjust` | Adjust stock and create an adjustment record |
| GET | `/api/v1/admin/inventory/adjustments` | List stock-adjustment history |
| GET | `/api/v1/admin/orders` | List orders with implemented filters |
| PATCH | `/api/v1/admin/orders/{id}/status` | Change an order status through allowed transitions |
| GET | `/api/v1/admin/coupons` | List coupons |
| POST | `/api/v1/admin/coupons` | Create a coupon |
| PATCH | `/api/v1/admin/coupons/{id}` | Update a coupon |
| GET | `/api/v1/admin/categories` | List categories |
| POST | `/api/v1/admin/categories` | Create a category |
| PUT | `/api/v1/admin/categories/{id}` | Update a category |
| DELETE | `/api/v1/admin/categories/{id}` | Delete an unreferenced category |

The administrative order-status route does not mark an order paid. A verified
Maya payment flow performs that state change. Administrative status
`refunded` is status tracking and does not issue a Maya refund.

### 3.5 Art kits and compatibility

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/art-kits` | Authenticated | List owned art kits |
| POST | `/api/v1/art-kits` | Authenticated | Create a kit with name and product items |
| GET | `/api/v1/art-kits/{id}` | Authenticated | Retrieve an owned kit |
| PATCH | `/api/v1/art-kits/{id}` | Authenticated | Update details and optionally replace items |
| DELETE | `/api/v1/art-kits/{id}` | Authenticated | Delete an owned kit |
| POST | `/api/v1/art-kits/{id}/add-to-cart` | Authenticated | Add kit items to the user's cart |
| GET | `/api/v1/compatibility/tablets` | Public | List active tablets with compatibility records |
| GET | `/api/v1/compatibility/tablets/{id}/accessories` | Public | List active accessories linked to the tablet |

Create an art kit with:

```json
{
  "name": "Beginner Drawing Kit",
  "description": "Optional description",
  "kitType": "drawing",
  "items": [
    {
      "productId": 1,
      "quantity": 1
    }
  ]
}
```

Names, duplicate products, active products, and requested stock are validated
by the backend.

### 3.6 AI assistant

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/v1/ai/ask` | Public and rate-limited | Submit a product question |

Request:

```json
{
  "question": "Recommend watercolor supplies for beginners."
}
```

The question is required, must be a string, and is limited to 1,000 characters.
The endpoint is limited to 10 requests per IP address per 15-minute window.

### 3.7 Maya webhook

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/v1/webhooks/maya` | Maya server-to-server | Deliver and process a payment webhook |

The webhook verifies the configured Maya signature/timestamp and event
information before updating payment and order state. It is not a substitute
customer API and should not be called manually except for a controlled negative
test or webhook-provider verification.

## 4. Response Handling

Success responses commonly contain `success: true`. Route-specific data may
appear in fields such as `cart`, `order`, `orders`, `product`, `products`,
`data`, or `coupon`.

Expected backend failures may use:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A description of the error."
  }
}
```

AI and payment routes use route-specific response shapes, for example
`{ "code", "message" }`.

| Status | Meaning |
|---|---|
| 200 | Request completed successfully |
| 201 | A resource was created |
| 400 | Invalid request data or field validation |
| 401 | Missing or invalid authentication |
| 403 | Authenticated account lacks administrator role |
| 404 | Resource or accessible resource was not found |
| 409 | Current state conflicts with the requested action |
| 422 | Coupon or other business-rule validation failed |
| 429 | Request or login rate limit reached |
| 500 | Unexpected server error |
| 503 | External AI or payment service unavailable |

Use Swagger and the route implementation as the detailed contract. Update
`server/openapi.yaml` and this document together whenever the API changes.
