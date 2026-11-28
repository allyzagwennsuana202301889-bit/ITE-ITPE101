# Artistry API: Postman Setup and User Guide

## Document Purpose

This guide explains how to install, import, configure, and use the provided Artistry API Postman collection. It is intended for local testing and ITPE101 academic project work.

The source files used for this guide are:

- `postman/collection.json`
- `postman/environment.example.json`

The collection is part of the **Artistry** React, Express, and MySQL application. It sends HTTP requests to the local backend API and is designed for a **local TEST database only**.

> **Safety warning:** Do not connect this collection to a production database or deployed production environment. Many requests create, update, deactivate, or delete records. Run state-changing requests deliberately and use only test accounts and test data.

## 1. Collection Overview

The Artistry Postman collection contains:

| Collection property | Value |
|---|---|
| Collection name | Artistry API |
| Total requests | **52** |
| Folders | **5** |
| Intended environment | Local TEST database |
| API base URL variable | `{{baseUrl}}` |
| Example local base URL | `http://localhost:5000` |
| API prefix | `/api/v1` |

The five folders are:

1. `01 - Authentication`
2. `02 - Public Catalog`
3. `03 - Customer Features`
4. `04 - Admin Features`
5. `05 - Security and Negative Tests`

The collection also contains Postman test assertions. A green test assertion means the assertion script passed; it does not prove that every intended business operation succeeded. Always inspect the HTTP status code and response body.

## 2. Requirements

### Software requirements

- Node.js LTS and npm
- MySQL Server
- A local MySQL database for Artistry
- Postman Desktop
- An internet browser for the optional frontend

Optional integrations, such as Maya and the Groq-powered AI assistant, require the relevant backend credentials. They are not required for ordinary local catalog and account setup.

### Local database and backend setup

Use the existing project installation guide if the backend is not already configured:

1. Start MySQL.
2. Create a dedicated local database, for example `artistry_db`.
3. In `server/`, copy `.env.example` to `.env`.
4. Configure the local database and JWT values in `server/.env`.
5. Configure `CLIENT_ORIGIN=http://localhost:5173` for the local frontend.
6. Run `npm install` in `server/`.
7. Run `npm install` in `client/`.
8. Start the backend from `server/` with:

```bash
npm run dev
```

The backend is normally available at:

```text
http://localhost:5000
```

The API documentation is normally available at:

```text
http://localhost:5000/api-docs
```

Optional demonstration data can be created by setting the seed account values in `server/.env` and running:

```bash
npm run seed:phase1
```

Back up the database before seeding or testing destructive requests. Do not run seed or destructive test procedures against production data.

## 3. Import the Collection and Environment

### Import the collection

1. Open Postman Desktop.
2. Select **Import**.
3. Choose the project file `postman/collection.json`.
4. Confirm the import.
5. Open the collection and verify that it contains the five folders described above.

### Import the environment

1. Select **Import** in Postman.
2. Choose `postman/environment.example.json`.
3. Confirm the import.
4. Open the environment selector in the upper-right area of Postman.
5. Select **Artistry Local TEST**.
6. Click the environment editor or eye/environment controls to view its variables.

Do not import a production environment for these tests unless you deliberately replace `baseUrl` and understand the security and data risks.

## 4. Environment Configuration

The environment template contains these variables:

| Variable | Example/template value | Purpose |
|---|---|---|
| `baseUrl` | `http://localhost:5000` | Backend root URL |
| `customerEmail` | Empty | Email used by the customer login request |
| `customerPassword` | Empty | Password used by the customer login request |
| `adminEmail` | Empty | Email used by the administrator login request |
| `adminPassword` | Empty | Password used by the administrator login request |
| `customerToken` | Empty | JWT returned for the customer |
| `adminToken` | Empty | JWT returned for the administrator |
| `productId` | `1` | Product identifier used by catalog and customer/admin requests |
| `tabletId` | `1` | Tablet identifier used by compatibility requests |
| `orderId` | `1` | Order identifier used by customer/admin order requests |
| `artKitId` | `1` | Art-kit identifier used by art-kit requests |
| `couponId` | `1` | Coupon identifier used by coupon update requests |
| `categoryId` | `1` | Category identifier used by category update/delete requests |

### Credential fields

The environment example contains **empty** values for:

- `customerEmail`
- `customerPassword`
- `adminEmail`
- `adminPassword`
- `customerToken`
- `adminToken`

Enter only credentials that belong to the local TEST database. Do not enter real passwords or production secrets. If an account is created from the Register Customer request, use the same email and password when configuring `customerEmail` and `customerPassword`.

### Base URL

Keep `baseUrl` set to:

```text
http://localhost:5000
```

The collection composes URLs as `{{baseUrl}}/api/v1/...`. Do not add `/api/v1` to `baseUrl`; the paths already contain it.

### Resource IDs

Every resource ID in the environment example defaults to `1`. These are examples only.

Before running a request that uses an ID, verify that the local database contains a matching record owned or accessible in the appropriate role. Replace the environment value with an actual local ID when necessary:

- `productId`: use an active or intended test product.
- `tabletId`: use a tablet recognized by the compatibility endpoints.
- `orderId`: use an order belonging to the test customer or accessible to the test administrator.
- `artKitId`: use an art kit belonging to the test customer.
- `couponId`: use a local test coupon.
- `categoryId`: use a local test category.

The collection also includes a **Product Not Found** request that intentionally uses `99999999`.

## 5. Customer and Administrator Authentication

### Obtain a customer token

1. Configure `customerEmail` and `customerPassword`.
2. Open `01 - Authentication`.
3. Send **Customer Login**.
4. Confirm an HTTP `200` response and a response body containing `token`.
5. The collection's Tests script stores the returned token in `customerToken`.

The login request body is:

```json
{
  "email": "{{customerEmail}}",
  "password": "{{customerPassword}}"
}
```

Authenticated customer requests send:

```http
Authorization: Bearer {{customerToken}}
```

### Obtain an administrator token

1. Configure `adminEmail` and `adminPassword` for an account with the `admin` role.
2. Open `04 - Admin Features`.
3. Send **Admin Login**.
4. Confirm an HTTP `200` response and that the response user role is `admin`.
5. The collection stores the returned token in `adminToken`.

The login request body is:

```json
{
  "email": "{{adminEmail}}",
  "password": "{{adminPassword}}"
}
```

Authenticated administrator requests send:

```http
Authorization: Bearer {{adminToken}}
```

If a token is missing or expired, most protected endpoints return `401`. A valid customer token used on an administrator-only endpoint may return `403`.

## 6. Sending a Request in Postman

1. Select **Artistry Local TEST**.
2. Start the local backend and confirm `http://localhost:5000` is reachable.
3. Expand the desired collection folder.
4. Select a request.
5. Review the HTTP method shown beside the request name.
6. Review the URL. Environment variables appear in double braces, such as `{{baseUrl}}` and `{{productId}}`.
7. Open **Params** for query parameters or open **Headers** for required headers.
8. Open **Body** for requests that accept JSON. The collection uses raw JSON for JSON request bodies.
9. Replace example resource IDs and credential values where needed.
10. Review whether the request modifies or deletes data.
11. Click **Send**.
12. Inspect the status code, response time, and response body. Do not rely only on the green test indicator.

Postman resolves variables before sending the request. For example:

```text
{{baseUrl}}/api/v1/products/{{productId}}
```

may become:

```text
http://localhost:5000/api/v1/products/1
```

### Headers

Public GET requests generally do not require a header. Requests that send JSON use:

```http
Content-Type: application/json
```

Protected requests use either:

```http
Authorization: Bearer {{customerToken}}
```

or:

```http
Authorization: Bearer {{adminToken}}
```

**Create Maya Checkout** also sends an `Idempotency-Key` generated by Postman with `{{$guid}}`.

## 7. HTTP Methods Used in the Collection

### GET

GET retrieves data and does not add a JSON request body. GET can still be safe for public catalog browsing or protected retrieval.

Examples:

| Request | Example URL |
|---|---|
| List Products | `GET {{baseUrl}}/api/v1/products?page=1&limit=10` |
| Get Product Details | `GET {{baseUrl}}/api/v1/products/{{productId}}` |
| Get Cart | `GET {{baseUrl}}/api/v1/cart` |

### POST

POST creates a resource, performs an action, or submits login/input data.

Examples:

| Request | Example body or action |
|---|---|
| Register Customer | Sends name, timestamp-based email, and password |
| Add Cart Item | Sends `productId` and `quantity` |
| Create Maya Checkout | Sends shipping address and optional coupon code |
| Ask AI Assistant | Sends a natural-language question |

Example:

```json
{
  "productId": {{productId}},
  "quantity": 1
}
```

When the body is raw JSON, select **raw** and **JSON** in Postman's Body tab.

### PUT

PUT replaces or updates the requested resource according to the endpoint.

Examples from the collection:

- `PUT {{baseUrl}}/api/v1/admin/products/{{productId}}`
- `PUT {{baseUrl}}/api/v1/admin/categories/{{categoryId}}`

These requests contain complete update fields in JSON.

### PATCH

PATCH applies a partial update or state change.

Examples:

- `PATCH {{baseUrl}}/api/v1/cart/items/{{productId}}`
- `PATCH {{baseUrl}}/api/v1/orders/{{orderId}}/cancel`
- `PATCH {{baseUrl}}/api/v1/admin/orders/{{orderId}}/status`
- `PATCH {{baseUrl}}/api/v1/admin/coupons/{{couponId}}`

Example cart update body:

```json
{
  "quantity": 1
}
```

### DELETE

DELETE removes or deactivates a resource.

Examples:

- `DELETE {{baseUrl}}/api/v1/cart/items/{{productId}}`
- `DELETE {{baseUrl}}/api/v1/cart`
- `DELETE {{baseUrl}}/api/v1/art-kits/{{artKitId}}`
- `DELETE {{baseUrl}}/api/v1/admin/products/{{productId}}`
- `DELETE {{baseUrl}}/api/v1/admin/categories/{{categoryId}}`

> **Do not run destructive requests blindly.** Confirm the environment, role token, resource ID, and target database before sending DELETE.

## 8. Complete Request Reference

The following tables reproduce the actual 52 request names and paths found in `collection.json`.

### 01 - Authentication — 5 requests

| Request | Method | URL | Body or header notes |
|---|---|---|---|
| API Welcome | GET | `{{baseUrl}}/` | No body or authentication |
| Register Customer | POST | `{{baseUrl}}/api/v1/auth/register` | JSON: name, timestamp-based email, password |
| Customer Login | POST | `{{baseUrl}}/api/v1/auth/login` | JSON: customerEmail and customerPassword |
| Get Current Customer | GET | `{{baseUrl}}/api/v1/auth/me` | Bearer `customerToken` |
| Reject Invalid Login | POST | `{{baseUrl}}/api/v1/auth/login` | JSON: invalid email and password |

**Register Customer example body from the collection**

```json
{
  "name": "Postman Test Customer",
  "email": "postman-{{$timestamp}}@example.test",
  "password": "PostmanTest123!"
}
```

### 02 - Public Catalog — 7 requests

| Request | Method | URL | Authentication |
|---|---|---|---|
| List Products | GET | `{{baseUrl}}/api/v1/products?page=1&limit=10` | None |
| Search Products | GET | `{{baseUrl}}/api/v1/products?search=paint&sort=price&direction=ASC` | None |
| Get Product Details | GET | `{{baseUrl}}/api/v1/products/{{productId}}` | None |
| Product Not Found | GET | `{{baseUrl}}/api/v1/products/99999999` | None |
| List Categories | GET | `{{baseUrl}}/api/v1/categories` | None |
| List Compatible Tablets | GET | `{{baseUrl}}/api/v1/compatibility/tablets` | None |
| Get Tablet Accessories | GET | `{{baseUrl}}/api/v1/compatibility/tablets/{{tabletId}}/accessories` | None |

### 03 - Customer Features — 19 requests

| Request | Method | URL | Body/header notes |
|---|---|---|---|
| Get Cart | GET | `{{baseUrl}}/api/v1/cart` | Bearer `customerToken` |
| Add Cart Item | POST | `{{baseUrl}}/api/v1/cart/items` | Bearer `customerToken`; productId and quantity |
| Update Cart Item | PATCH | `{{baseUrl}}/api/v1/cart/items/{{productId}}` | Bearer `customerToken`; quantity |
| Remove Cart Item | DELETE | `{{baseUrl}}/api/v1/cart/items/{{productId}}` | Bearer `customerToken` |
| Clear Cart | DELETE | `{{baseUrl}}/api/v1/cart` | Bearer `customerToken` — clears customer cart |
| Reject Invalid Cart Quantity | POST | `{{baseUrl}}/api/v1/cart/items` | Bearer `customerToken`; quantity `0` |
| Validate Invalid Coupon | POST | `{{baseUrl}}/api/v1/coupons/validate` | Bearer `customerToken`; invalid coupon code |
| Create Maya Checkout | POST | `{{baseUrl}}/api/v1/checkout` | Bearer token and Idempotency-Key |
| List Customer Orders | GET | `{{baseUrl}}/api/v1/orders` | Bearer `customerToken` |
| Get Customer Order | GET | `{{baseUrl}}/api/v1/orders/{{orderId}}` | Bearer `customerToken` |
| Retry Customer Payment | POST | `{{baseUrl}}/api/v1/orders/{{orderId}}/retry-payment` | Bearer `customerToken` |
| Cancel Customer Order | PATCH | `{{baseUrl}}/api/v1/orders/{{orderId}}/cancel` | Bearer `customerToken` |
| List Customer Art Kits | GET | `{{baseUrl}}/api/v1/art-kits` | Bearer `customerToken` |
| Create Customer Art Kit | POST | `{{baseUrl}}/api/v1/art-kits` | Bearer `customerToken`; name, description, kitType, items |
| Get Customer Art Kit | GET | `{{baseUrl}}/api/v1/art-kits/{{artKitId}}` | Bearer `customerToken` |
| Update Customer Art Kit | PATCH | `{{baseUrl}}/api/v1/art-kits/{{artKitId}}` | Bearer `customerToken`; name and description |
| Add Customer Art Kit To Cart | POST | `{{baseUrl}}/api/v1/art-kits/{{artKitId}}/add-to-cart` | Bearer `customerToken` |
| Delete Customer Art Kit | DELETE | `{{baseUrl}}/api/v1/art-kits/{{artKitId}}` | Bearer `customerToken` — deletes art kit |
| Ask AI Assistant | POST | `{{baseUrl}}/api/v1/ai/ask` | JSON question; no authentication header in collection |

**Customer request JSON bodies**

Add cart item:

```json
{
  "productId": {{productId}},
  "quantity": 1
}
```

Update cart item:

```json
{
  "quantity": 1
}
```

Invalid cart quantity:

```json
{
  "productId": 1,
  "quantity": 0
}
```

Invalid coupon:

```json
{
  "code": "INVALID-POSTMAN-COUPON",
  "subtotal": 100
}
```

Maya checkout:

```json
{
  "shippingAddress": "Postman LOCAL TEST address, 123 Test Street",
  "couponCode": ""
}
```

Create art kit:

```json
{
  "name": "Postman LOCAL TEST Kit",
  "description": "Created only for local Postman testing",
  "kitType": "test",
  "items": [
    {
      "productId": {{productId}},
      "quantity": 1
    }
  ]
}
```

Update art kit:

```json
{
  "name": "Postman LOCAL TEST Kit Updated",
  "description": "Updated locally"
}
```

AI question:

```json
{
  "question": "What should I consider when choosing watercolor paper?"
}
```

### 04 - Admin Features — 19 requests

| Request | Method | URL | Body/header notes |
|---|---|---|---|
| Admin Login | POST | `{{baseUrl}}/api/v1/auth/login` | JSON: adminEmail and adminPassword |
| Admin Dashboard | GET | `{{baseUrl}}/api/v1/admin/dashboard` | Bearer `adminToken` |
| Admin Product List | GET | `{{baseUrl}}/api/v1/admin/products?page=1&limit=10` | Bearer `adminToken` |
| Admin Orders List | GET | `{{baseUrl}}/api/v1/admin/orders` | Bearer `adminToken` |
| Admin Coupons List | GET | `{{baseUrl}}/api/v1/admin/coupons` | Bearer `adminToken` |
| Admin Categories List | GET | `{{baseUrl}}/api/v1/admin/categories` | Bearer `adminToken` |
| Admin Create Product | POST | `{{baseUrl}}/api/v1/admin/products` | Bearer `adminToken`; creates test product |
| Admin Update Product | PUT | `{{baseUrl}}/api/v1/admin/products/{{productId}}` | Bearer `adminToken`; updates test product |
| Admin Deactivate Product | DELETE | `{{baseUrl}}/api/v1/admin/products/{{productId}}` | Bearer `adminToken`; destructive/deactivation |
| Admin Update Order Status | PATCH | `{{baseUrl}}/api/v1/admin/orders/{{orderId}}/status` | Bearer `adminToken`; status and note |
| Admin Create Coupon | POST | `{{baseUrl}}/api/v1/admin/coupons` | Bearer `adminToken`; creates coupon |
| Admin Update Coupon | PATCH | `{{baseUrl}}/api/v1/admin/coupons/{{couponId}}` | Bearer `adminToken`; partial coupon update |
| Admin Create Category | POST | `{{baseUrl}}/api/v1/admin/categories` | Bearer `adminToken`; creates category |
| Admin Update Category | PUT | `{{baseUrl}}/api/v1/admin/categories/{{categoryId}}` | Bearer `adminToken`; updates category |
| Admin Delete Category | DELETE | `{{baseUrl}}/api/v1/admin/categories/{{categoryId}}` | Bearer `adminToken`; destructive |
| Admin Payment Mismatch Report | GET | `{{baseUrl}}/api/v1/admin/payment-mismatches?page=1&limit=20` | Bearer `adminToken` |
| Admin Inventory Adjustment History | GET | `{{baseUrl}}/api/v1/admin/inventory/adjustments` | Bearer `adminToken` |
| Reject Invalid Inventory Adjustment | POST | `{{baseUrl}}/api/v1/admin/inventory/{{productId}}/adjust` | Bearer `adminToken`; change `0` |
| Customer Forbidden From Admin Dashboard | GET | `{{baseUrl}}/api/v1/admin/dashboard` | Bearer `customerToken` |

**Admin request JSON bodies**

Create product:

```json
{
  "name": "Postman LOCAL TEST Product",
  "category": "Accessories",
  "price": 99,
  "stock": 10,
  "description": "Created only by the local test environment",
  "isActive": true
}
```

Update product:

```json
{
  "name": "Postman LOCAL TEST Product",
  "category": "Accessories",
  "price": 99,
  "stock": 10,
  "description": "Updated locally",
  "isActive": true
}
```

Update order status:

```json
{
  "status": "processing",
  "note": "Postman local verification"
}
```

Create coupon:

```json
{
  "code": "LOCALPOSTMAN",
  "discountType": "fixed",
  "discountValue": 10,
  "minimumSpend": 100,
  "usageLimit": 10,
  "perCustomerLimit": 1,
  "isActive": true
}
```

Update coupon:

```json
{
  "isActive": true
}
```

Create category:

```json
{
  "name": "Postman Local Category",
  "description": "Created only in the local TEST environment"
}
```

Update category:

```json
{
  "name": "Postman Local Category",
  "description": "Updated only in the local TEST environment"
}
```

Invalid inventory adjustment:

```json
{
  "change": 0,
  "reason": "Invalid test adjustment"
}
```

### 05 - Security and Negative Tests — 2 requests

| Request | Method | URL | Expected behavior |
|---|---|---|---|
| Reject Unauthenticated Cart Access | GET | `{{baseUrl}}/api/v1/cart` | Sent without Authorization; should be rejected |
| Reject Invalid Maya Webhook Signature | POST | `{{baseUrl}}/api/v1/webhooks/maya` | Invalid signature/timestamp should be rejected |

The invalid webhook request uses:

```http
Content-Type: application/json
X-Maya-Webhook-Signature: invalid-signature
X-Maya-Webhook-Timestamp: {{mayaWebhookTimestamp}}
```

The collection pre-request script sets `mayaWebhookTimestamp` from the current date/time. This is a negative test and does not use a real Maya webhook.

## 9. HTTP Response Codes

| Code | Meaning | How to interpret it |
|---|---|---|
| `200 OK` | Request succeeded | Inspect the body and verify the expected data or state |
| `201 Created` | Resource was created | Inspect the returned resource and consider whether the environment ID should be updated |
| `400 Bad Request` | Request or field is invalid | Read the validation message; correct JSON or resource values |
| `401 Unauthorized` | Authentication is missing or invalid | Login again and update the applicable bearer token |
| `403 Forbidden` | Authentication is valid but role/permission is insufficient | Use the correct administrator or customer token |
| `404 Not Found` | Resource or route is missing | Verify the URL and replace the example ID |
| `409 Conflict` | Operation conflicts with current state or uniqueness | Review existing data and business-rule constraints |
| `422 Unprocessable Entity` | Data is understood but fails validation/business rules | Inspect the response code and message |
| `500 Internal Server Error` | Backend encountered an unhandled server failure | Inspect server logs and response body |
| `503 Service Unavailable` | A dependency or optional service is unavailable | For example, an unavailable AI or payment integration |

The response body is commonly structured with fields such as `success`, `message`, `error`, or resource-specific fields. Read the entire body rather than assuming that status `200` means the operation changed data as expected.

### Green tests versus business success

Postman test scripts may pass if the response code is within an accepted set. For example, some checkout and resource mutation requests accept several HTTP status codes because missing stock, invalid resources, conflicts, or unavailable integrations are possible outcomes.

Therefore:

- Check the actual HTTP status.
- Read the response body.
- Check the local database for state changes when relevant.
- Re-run only with a backup or disposable test database if a request may modify data.
- Do not report that all 52 requests were successfully tested unless you actually completed them and documented their evidence.

## 10. Troubleshooting

### `ECONNREFUSED 127.0.0.1:5000`

This usually means the backend is not reachable on port `5000`.

1. Confirm that MySQL is running.
2. Confirm that `server/.env` exists and its database values are valid.
3. Start the backend:

```bash
cd server
npm run dev
```

4. Verify the terminal says that the API started, or open:

```text
http://localhost:5000/
```

5. Confirm `baseUrl` is `http://localhost:5000`.
6. If port `5000` is occupied or configured differently, stop the conflicting process or set a matching backend `PORT` and Postman `baseUrl`.

### Authentication errors

#### `401 Unauthorized`

- Run the applicable login request.
- Confirm `customerEmail` and `customerPassword` or `adminEmail` and `adminPassword`.
- Confirm the token environment variable is populated.
- Confirm the token was not cleared or changed.
- Send the request again after a successful login.

#### `403 Forbidden`

- Confirm the request is allowed for the intended role.
- Use `adminToken` for administrator endpoints.
- Use `customerToken` for customer endpoints.
- Confirm the logged-in account has the `admin` role when using `adminToken`.

### Missing resources

For `404` responses:

- Replace resource IDs with valid IDs from the local TEST database.
- Do not assume ID `1` exists.
- Verify that an order belongs to the test customer.
- Verify that an art kit belongs to the test customer.
- Verify that a product, coupon, or category is present.
- Check URL spelling and variable substitution.

### Validation errors

For `400` or `422` responses:

- Verify JSON syntax.
- Confirm `Content-Type: application/json`.
- Use positive quantities where quantities are required.
- Replace placeholder IDs.
- Review required fields and value formats.
- Inspect the response body's `error` or `message` field.
- Retain only actual test values from the local database.

### Conflicts

For `409` responses:

- The record may already exist.
- A coupon code may already be used.
- A stock or order-state rule may prevent the action.
- A requested state transition may not be permitted.
- Existing cart, order, product, coupon, or category state may conflict with the request.

Check the response body and database state before retrying.

### Server and dependency errors

For `500`:

- Review the backend terminal logs.
- Verify MySQL is connected.
- Verify `JWT_SECRET` and database values in `server/.env`.
- Check whether the request triggered an unhandled server exception.

For `503`:

- Check whether the relevant integration is unavailable or not configured.
- The AI Assistant and Maya-related operations may depend on external services.
- Do not replace integration fields with fabricated credentials.

### Unexpected response from a green test

Open the Test Results in Postman and inspect:

- HTTP status.
- Response body.
- Which assertion passed.
- Whether the assertion accepted multiple status codes.

A collection assertion may intentionally accept `400`, `404`, `409`, or `503` for a safe negative or state-dependent test.

## 11. Testing Precautions and Best Practices

Before testing:

- Use a separate local TEST database.
- Back up or reset test data before a destructive testing sequence.
- Use test customer and administrator accounts.
- Confirm `baseUrl` points to localhost.
- Never place real passwords or tokens in source-control submissions.
- Replace ID defaults with valid local IDs.
- Confirm the active Postman environment before clicking Send.

When testing state changes:

- Review each DELETE and update request before sending it.
- Refrain from testing against production.
- Avoid repeated creates that generate duplicate records or coupons.
- Use unique generated data where the collection uses `{{$timestamp}}`.
- Use an `Idempotency-Key` for the Maya checkout request as supplied.
- Do not run the collection in one blind **Run** operation without reviewing destructive requests.
- Inspect database state for mutations that Postman only asserts as HTTP status.

When reporting results:

- Record the request name, folder, method, status code, and observed body.
- Distinguish successful, negative, state-dependent, and unavailable-service results.
- Do not claim that all 52 requests passed unless they were actually run and verified.
- Note any test database state used and whether it was reset.

## 12. Suggested Beginner Test Sequence

For a safe introduction to the collection:

1. Import both JSON files.
2. Select **Artistry Local TEST**.
3. Set `baseUrl`.
4. Send **API Welcome**.
5. Send **List Products**, **Search Products**, **List Categories**, and **List Compatible Tablets**.
6. Configure and send **Customer Login**.
7. Verify **Get Current Customer**.
8. Send read-only customer requests such as **Get Cart** and **List Customer Orders**.
9. Configure and send **Admin Login**.
10. Verify read-only administrator requests such as **Admin Dashboard** and list endpoints.
11. Run negative tests such as invalid login, unauthenticated cart access, and customer access to the admin dashboard.
12. Only then consider mutating or deleting requests, and only in the local TEST database.

## 13. Submission Checklist

- Collection and environment JSON files imported.
- Environment is named **Artistry Local TEST**.
- `baseUrl` is `http://localhost:5000`.
- Customer credential variables are set only with local TEST account values.
- Administrator credential variables are set only with local TEST account values.
- Customer and administrator tokens were obtained from login responses.
- Resource IDs were replaced with valid local TEST IDs where needed.
- Protected requests use `Authorization: Bearer {{customerToken}}` or `Authorization: Bearer {{adminToken}}`.
- Negative tests and destructive tests were reviewed before execution.
- HTTP status codes and response bodies were inspected.
- No production database or real credentials were used.
