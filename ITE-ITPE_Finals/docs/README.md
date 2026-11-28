# Artistry

Artistry is a full-stack e-commerce application for art supplies. It provides
customer account management, a MySQL-backed catalog, shopping carts, coupons,
Maya payment checkout, order history, saved art kits, tablet-compatibility
lookup, an AI product assistant, and administrator management tools.

## Main Features

### Customers

- Register, log in, retrieve the current account, and access protected
  customer routes.
- Browse active products, search by name, filter by category or price range,
  sort results, and use pagination.
- Manage a server-persisted cart with quantity and stock validation.
- Validate coupons and begin Maya checkout.
- View owned orders, retry eligible payment sessions, and cancel eligible
  unpaid orders.
- Create, view, update, and delete personal art kits.
- Add the products from an owned art kit to the cart.
- Check accessories associated with drawing tablets through compatibility
  records.
- Submit product questions to the AI assistant.

### Administrators

- View dashboard and payment-mismatch information.
- Create, update, list, and deactivate products.
- Adjust inventory and review inventory-adjustment records.
- List and update order statuses according to implemented transition rules.
- Create and update coupons.
- Create, update, and delete categories that are not referenced by products.

## Technology Stack

| Area | Technology |
|---|---|
| Frontend | React 19, React Router, Vite 8, JavaScript, CSS, Vite PWA |
| Backend | Node.js, Express 5 |
| Database | MySQL, Sequelize 6 |
| Authentication | JWT bearer tokens and bcrypt password hashing |
| API reference | OpenAPI 3 and Swagger UI |
| Payment | Maya checkout and webhook processing |
| AI | Groq API through the OpenAI-compatible Node.js SDK |
| API testing | Postman |

## Repository Layout

```text
ITE-ITPE_Finals/
├── client/                 React/Vite frontend
├── server/                 Express/Sequelize backend
├── postman/                Collection and environment template
├── docs/                   Project documentation
└── package.json            Root dependency metadata
```

The backend implementation is under `server/`, with route modules in
`server/routes/`, Sequelize models in `server/models/`, external integrations
and scheduled services in `server/services/`, and configuration in
`server/config/`. The API contract is maintained in `server/openapi.yaml`.

## Prerequisites

- Node.js LTS and npm
- MySQL Server
- A database user that can connect to and modify the Artistry database
- Postman Desktop, optional
- Maya test credentials, optional for payment testing
- A Groq API key, optional for AI-assistant testing

## Quick Start

The detailed procedure is in [INSTALLATION.txt](./INSTALLATION.txt).

1. Create a dedicated MySQL database.
2. Copy `server/.env.example` to `server/.env` and configure database and JWT
   values.
3. Install dependencies in `server/` and `client/`.
4. Run `npm run dev` in `server/`.
5. Run `npm run dev` in `client/`.
6. Open the Vite URL shown in the terminal, normally
   `http://localhost:5173`.

The backend normally listens on `http://localhost:5000`. It verifies the JWT
configuration, authenticates MySQL, synchronizes Sequelize models, links
category data, and starts the order-expiration and Maya-reconciliation jobs.

For local frontend setup, `VITE_API_URL` may be set to
`http://localhost:5000/api/v1`. If it is omitted, the development client uses
the `/api/v1` proxy configured in `client/vite.config.js`. That proxy currently
targets the hosted backend unless `VITE_API_URL` is provided.

## API and Testing

- API welcome/root: `http://localhost:5000/`
- API prefix: `http://localhost:5000/api/v1`
- Product endpoint: `http://localhost:5000/api/v1/products`
- Swagger UI: `http://localhost:5000/api-docs`
- OpenAPI source: `server/openapi.yaml`

See [Artistry_API_Documentation.md](./Artistry_API_Documentation.md) for the
endpoint overview. Import `postman/collection.json` and
`postman/environment.example.json` according to
[Artistry_Postman_Setup_and_User_Guide.md](./Artistry_Postman_Setup_and_User_Guide.md).
Use only a TEST database for state-changing requests.

## Quality Checks

From `ITE-ITPE_Finals/client/`:

```bash
npm run lint
npm run build
```

From `ITE-ITPE_Finals/server/`:

```bash
npm test
npm run seed:phase1
```

The seed command requires configured seed passwords and is intended only for a
dedicated demonstration or TEST database. The repository also includes
standalone Maya and checkout test scripts that have database safety checks;
inspect and run those scripts only in an isolated test environment.

## Deployment

The project can be deployed with a separate Node.js backend and static or
web-service frontend:

- Configure MySQL and the backend environment variables on the backend host.
- Set `CLIENT_ORIGIN` to the exact frontend origin or a comma-separated origin
  list.
- Set `CLIENT_URL` to the frontend origin used for Maya return redirects.
- Set `VITE_API_URL` to the deployed backend base ending in `/api/v1`.
- Configure Maya credentials and a publicly reachable webhook URL when payment
  testing or production payment processing is enabled.
- Keep secrets in hosting environment settings and never place secret keys in
  `VITE_*` variables.

The repository's existing deployment configuration references:

- Frontend: `https://ite-itpe-101.vercel.app`
- Backend: `https://ite-itpe101.onrender.com`
- API root: `https://ite-itpe101.onrender.com/`
- Product endpoint: `https://ite-itpe101.onrender.com/api/v1/products`
- API documentation: `https://ite-itpe101.onrender.com/api-docs`

These URLs describe the existing deployment configuration; availability or
configuration drift should be checked at the deployment host.

Source repository:
`https://github.com/allyzagwennsuana202301889-bit/ITE-ITPE101`

## Documentation

- [Installation Guide](./INSTALLATION.txt)
- [API Documentation](./Artistry_API_Documentation.md)
- [Postman Setup and User Guide](./Artistry_Postman_Setup_and_User_Guide.md)
- [Business Concept](./business-concept.md)
- [Business Rules](./business-rules.md)
- [AI Integration](./ai-integration.md)
- [Code Review and Contribution Guide](./CODE_REVIEW_AND_CONTRIBUTION.md)
