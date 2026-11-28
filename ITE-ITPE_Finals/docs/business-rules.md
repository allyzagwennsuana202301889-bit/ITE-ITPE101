# Artistry – Business Rules

This document describes the business rules enforced by the Artistry online art supply store. Each rule identifies the relevant API endpoint and the system response or behavior used to enforce it.

## Implemented order states

The order model permits `pending_payment`, `paid`, `processing`, `shipped`,
`completed`, `cancelled`, and `refunded`.

Administrative status changes follow these implemented transitions:

- `pending_payment` may become `cancelled`.
- `paid` may become `processing` or `refunded`.
- `processing` may become `shipped` or `refunded`.
- `shipped` may become `completed` or `refunded`.
- `completed`, `cancelled`, and `refunded` have no forward transitions.
- The administrative API cannot set `paid`; this status is established only
  by verified Maya payment processing.
- Setting `refunded` records administrative refund status only. It does not
  submit a refund transaction to Maya.

## 1. User Authentication and Authorization

| Rule ID | Business Rule | Enforcement Endpoint | Response / Enforcement |
|---|---|---|---|
| BR-001 | Users must be authenticated before accessing protected system functions. | Protected `/api/v1` endpoints | HTTP 401 – `Please log in to continue.` |
| BR-002 | Only users with the administrator role may access administrative functions. | `/api/v1/admin/*` | HTTP 403 – `Admin access required.` for non-admin users. |
| BR-003 | Customers are not permitted to access administrator-only endpoints. | `/api/v1/admin/*` | HTTP 403 – `Admin access required.` |
| BR-004 | Users may only access and manage records that belong to their own account when ownership restrictions apply. | Customer cart, order, and art-kit endpoints | Records belonging to other users are not returned or are rejected with HTTP 404 where applicable. |

## 2. Art Kit Builder

| Rule ID | Business Rule | Enforcement Endpoint | Response / Enforcement |
|---|---|---|---|
| BR-005 | Only authenticated users may create and manage saved art kits. | `/api/v1/art-kits` | Authentication middleware returns HTTP 401 when unauthenticated. |
| BR-006 | An art kit must have a valid, non-empty name. | `POST /api/v1/art-kits` | HTTP 400 – `Kit name is required.` |
| BR-007 | An art kit must contain at least one product. | `POST /api/v1/art-kits` | HTTP 400 – `At least one product is required.` |
| BR-008 | Each product in an art kit must have a valid product ID and a positive whole-number quantity. | `POST /api/v1/art-kits` | HTTP 400 – `Each item needs a valid product ID and quantity.` |
| BR-009 | Duplicate product entries are not allowed within the same kit. | `POST /api/v1/art-kits` | HTTP 400 – `Duplicate products are not allowed in a kit.` |
| BR-010 | Only active products may be added to an art kit. | `POST /api/v1/art-kits` | HTTP 400 – `One or more products are unavailable.` |
| BR-011 | The requested quantity of a product must not exceed its available stock when the kit is created. | `POST /api/v1/art-kits` | HTTP 400 with a message identifying the product and its available stock. |
| BR-012 | Users may only view, update, or delete their own saved art kits. | `GET`, `PATCH`, and `DELETE /api/v1/art-kits/:id` | HTTP 404 – `Art kit not found.` for an unowned or nonexistent kit. |

**Customer interface:** Shop page → Build your own art kit. Customers can select products, specify quantities, name their kits, save them, view saved kits, and delete their own saved kits.

## 3. Device Compatibility Checker

| Rule ID | Business Rule | Enforcement Endpoint | Response / Enforcement |
|---|---|---|---|
| BR-013 | The compatibility checker must display active tablets that have compatibility records. | `GET /api/v1/compatibility/tablets` | Returns tablets based on existing compatibility records and excludes inactive tablets. |
| BR-014 | Accessories displayed for a selected tablet must have a corresponding compatibility record. | `GET /api/v1/compatibility/tablets/:id/accessories` | Only accessories associated with the selected tablet through a compatibility record are returned. |
| BR-015 | Inactive products must not appear as available compatible accessories. | `GET /api/v1/compatibility/tablets/:id/accessories` | Inactive accessories are excluded from the response. |

**Customer interface:** Shop page → Device compatibility checker. Customers select a drawing tablet to view accessories recorded as compatible with that device.

## 4. Administrative Functions

| Rule ID | Business Rule | Enforcement Endpoint | Response / Enforcement |
|---|---|---|---|
| BR-016 | Administrative endpoints require authentication and administrator authorization. | `/api/v1/admin/*` | HTTP 401 for unauthenticated users and HTTP 403 for non-admin users. |
| BR-017 | Customers must receive an access-denied response when attempting to access administrator-only functions. | `/api/v1/admin/*` | HTTP 403 – `Admin access required.` |

## 5. Customer Account and Access Rules

| Rule ID | Business Rule | Enforcement Endpoint | Response / Enforcement |
|---|---|---|---|
| BR-018 | Customer registration must use a valid name, email address, and password within the accepted length limits. | `POST /api/v1/auth/register` | HTTP 400 with a validation message identifying the invalid field. |
| BR-019 | An email address already registered cannot be used to create another account. | `POST /api/v1/auth/register` | HTTP 409 – `An account with this email already exists.` |
| BR-020 | Customer passwords must be securely hashed before storage. | `POST /api/v1/auth/register` | Passwords are hashed using bcrypt before being saved. |
| BR-021 | Users must provide valid credentials to sign in. | `POST /api/v1/auth/login` | HTTP 401 – `Invalid email or password.` |
| BR-022 | Repeated failed login attempts must be rate-limited. | `POST /api/v1/auth/login` | HTTP 429 – `Too many failed attempts. Please try again in 15 minutes.` |
| BR-023 | Customers may only view and manage their own carts and orders. | `/api/v1/cart/*` and `/api/v1/orders/*` | Queries are restricted using the authenticated user's ID. |

## 6. Shopping Cart Rules

| Rule ID | Business Rule | Enforcement Endpoint | Response / Enforcement |
|---|---|---|---|
| BR-024 | Only active products may be added to the shopping cart. | `POST /api/v1/cart/items` | HTTP 404 – `Product not found.` |
| BR-025 | Product quantities must be whole numbers between 1 and 99. | `POST /api/v1/cart/items` | HTTP 400 – `Choose a valid product and quantity.` |
| BR-026 | A cart line cannot contain more than 99 items, including quantities added to an existing line. | `POST /api/v1/cart/items` | HTTP 400 – `A cart line cannot exceed 99 items.` |
| BR-027 | A cart item's quantity cannot exceed the product's available stock. | `POST /api/v1/cart/items` and `PATCH /api/v1/cart/items/:productId` | HTTP 409 when the requested quantity exceeds available stock. |
| BR-028 | Updating a cart item's quantity must pass quantity and stock validation. | `PATCH /api/v1/cart/items/:productId` | HTTP 400 for invalid quantities and HTTP 409 for insufficient stock. |
| BR-029 | Customers may remove individual cart items or clear their own cart. | `DELETE /api/v1/cart/items/:productId` and `DELETE /api/v1/cart` | Only the authenticated customer's cart is modified. |

## 7. Coupon Rules

| Rule ID | Business Rule | Enforcement Endpoint | Response / Enforcement |
|---|---|---|---|
| BR-030 | A coupon must exist, be active, and not be expired to be used. | `POST /api/v1/coupons/validate` and `POST /api/v1/checkout` | HTTP 422 – `COUPON_INVALID` or the checkout coupon validation message. |
| BR-031 | A coupon cannot be used after reaching its overall usage limit. | `POST /api/v1/coupons/validate` and `POST /api/v1/checkout` | HTTP 422 when the coupon is invalid or fully used. |
| BR-032 | Orders must meet the coupon's minimum spending requirement. | `POST /api/v1/coupons/validate` and `POST /api/v1/checkout` | HTTP 422 when the minimum spend is not reached. |
| BR-033 | Customers must not exceed the coupon's per-customer usage limit. | `POST /api/v1/coupons/validate` and `POST /api/v1/checkout` | HTTP 422 – `COUPON_LIMIT_REACHED` during validation; checkout also rejects the request. |
| BR-034 | The discount must not exceed the order subtotal. | `POST /api/v1/coupons/validate` and `POST /api/v1/checkout` | The calculated discount is capped at the subtotal. |

## 8. Checkout and Order Creation Rules

| Rule ID | Business Rule | Enforcement Endpoint | Response / Enforcement |
|---|---|---|---|
| BR-035 | Customers must provide a complete shipping address before checkout. | `POST /api/v1/checkout` | HTTP 400 if the address is shorter than 10 or longer than 1,000 characters. |
| BR-036 | The shopping cart must contain at least one item before checkout. | `POST /api/v1/checkout` | HTTP 400 – `Your cart is empty.` |
| BR-037 | The server must verify product availability, active status, and stock before creating an order. | `POST /api/v1/checkout` | HTTP 409 – `INSUFFICIENT_STOCK` when a product is unavailable or insufficiently stocked. |
| BR-038 | Product prices, subtotals, discounts, shipping fees, and order totals must be calculated by the server. | `POST /api/v1/checkout` | Values are calculated using database product prices, coupon information, and the configured shipping fee. |
| BR-039 | Each order must be associated with the authenticated customer. | `POST /api/v1/checkout` | The order's `userId` is taken from the authenticated session. |
| BR-040 | Checkout must create an order with an initial pending-payment status. | `POST /api/v1/checkout` | The order is created with status `pending_payment`. |
| BR-041 | The system must record the order's initial status in its status history. | `POST /api/v1/checkout` | An initial `pending_payment` history entry is created. |
| BR-042 | Checkout must use a valid idempotency key to prevent duplicate orders from repeated requests. | `POST /api/v1/checkout` | HTTP 400 – `INVALID_IDEMPOTENCY_KEY` for an invalid key; eligible repeated requests return the existing checkout session. |
| BR-043 | A repeated checkout request using the same customer's idempotency key must not create another order. | `POST /api/v1/checkout` | HTTP 200 with `idempotent: true` when the existing checkout session is still available. |

Checkout reservations expire after 30 minutes. The scheduled expiration service
cancels eligible `pending_payment` orders and restores the reserved stock. A
late verified payment must not reopen an expired or cancelled order.

## 9. Inventory Rules

| Rule ID | Business Rule | Enforcement Endpoint | Response / Enforcement |
|---|---|---|---|
| BR-044 | Product stock must be sufficient to fulfill the requested order quantity. | `POST /api/v1/checkout` | Checkout is rejected with HTTP 409 when stock is insufficient. |
| BR-045 | Stock must be deducted when an order is successfully created during checkout. | `POST /api/v1/checkout` | Stock is decremented for each order item within the checkout transaction. |
| BR-046 | Stock changes during checkout must be handled within a database transaction. | `POST /api/v1/checkout` | Failed checkout operations roll back their database changes. |
| BR-047 | If an eligible unpaid order is cancelled, its reserved stock must be restored. | `PATCH /api/v1/orders/:id/cancel` | Each order item's quantity is added back to its product stock. |
| BR-048 | Retrying payment for an existing order must not deduct stock again. | `POST /api/v1/orders/:id/retry-payment` | A new payment attempt is created for the existing order without changing stock. |
| BR-049 | Administrative inventory adjustments must not result in negative stock. | `POST /api/v1/admin/inventory/:productId/adjust` | HTTP 409 – `Inventory cannot become negative.` |

## 10. Payment Rules

| Rule ID | Business Rule | Enforcement Endpoint | Response / Enforcement |
|---|---|---|---|
| BR-050 | The system must create a Maya checkout session for a new order. | `POST /api/v1/checkout` | A valid Maya checkout session is required before the checkout transaction is committed. |
| BR-051 | Payment information and payment attempts must be recorded. | `POST /api/v1/checkout` and `POST /api/v1/orders/:id/retry-payment` | Payment and PaymentAttempt records are saved. |
| BR-052 | Only orders that are still awaiting payment may have their payment retried. | `POST /api/v1/orders/:id/retry-payment` | HTTP 409 – `ORDER_NOT_RETRYABLE` when the order is not pending payment. |
| BR-053 | Expired payment reservations cannot be retried. | `POST /api/v1/orders/:id/retry-payment` | HTTP 409 – `ORDER_RESERVATION_EXPIRED`. |
| BR-054 | A payment that has already been processed cannot be treated as an unpaid payment. | `POST /api/v1/orders/:id/retry-payment` and `PATCH /api/v1/orders/:id/cancel` | HTTP 409 when the payment is no longer pending. |
| BR-055 | Retrying payment must create a new Maya session and payment-attempt record for the same order. | `POST /api/v1/orders/:id/retry-payment` | HTTP 200 with a new checkout URL; the existing order remains unchanged. |

## 11. Order Access and Cancellation Rules

| Rule ID | Business Rule | Enforcement Endpoint | Response / Enforcement |
|---|---|---|---|
| BR-056 | Customers may only retrieve orders belonging to their own account. | `GET /api/v1/orders` and `GET /api/v1/orders/:id` | The order queries are restricted by the authenticated user's ID; inaccessible orders return HTTP 404. |
| BR-057 | Customers may cancel only orders that are still awaiting payment. | `PATCH /api/v1/orders/:id/cancel` | HTTP 409 – `ORDER_CANNOT_BE_CANCELLED` for orders outside the pending-payment status. |
| BR-058 | Orders with already processed payments cannot be cancelled through the unpaid-order cancellation process. | `PATCH /api/v1/orders/:id/cancel` | HTTP 409 – `PAYMENT_ALREADY_PROCESSED`. |
| BR-059 | Cancelling an eligible unpaid order must update its order status and payment records. | `PATCH /api/v1/orders/:id/cancel` | The order becomes `cancelled`, the payment becomes `failed`, and pending payment attempts become `cancelled`. |
| BR-060 | The system must record order cancellation in the order status history. | `PATCH /api/v1/orders/:id/cancel` | A cancellation history entry records the previous status, new status, customer, and cancellation note. |

---

*Implementation note: The endpoints and responses above describe the inspected application behavior. Some endpoints return different messages depending on the specific validation failure. Successful operations are described by their resulting system behavior rather than an error response.*
