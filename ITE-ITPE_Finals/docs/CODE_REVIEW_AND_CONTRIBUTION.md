# Code Review and Contribution Guide

## 1. Introduction and Purpose

This document describes code quality, self-review, testing, bug handling, deployment, and maintenance practices for **Artistry**, an AI-enhanced e-commerce application developed as an individual academic IT project.

The sole developer is responsible for planning, implementation, code review, testing, deployment, and maintenance. Consequently, code quality depends on consistent personal practices rather than an external development team or formal contributor approval process.

The purpose of this guide is to:

- protect application reliability and maintainability;
- establish consistent coding practices across frontend and backend code;
- identify defects before they reach the deployed application;
- document decisions and verification steps for academic and maintenance use; and
- provide a practical process for continuing development by one person.

Code quality matters because the project combines React components, Express routes, database models, authentication, payment integration, background services, and a deployment configuration. A small change can affect several layers. Readable code, explicit validation, and repeatable checks make problems easier to locate and reduce the chance of unintended regressions.

## 2. Project Overview and Structure

### 2.1 System Summary

Artistry is a full-stack e-commerce application for art supplies. It provides product browsing and search, account authentication, shopping carts, coupons, Maya checkout sessions, order history and cancellation, custom art kits, tablet compatibility, an AI assistant, and administrative management functions.

The backend uses MySQL for persistence and exposes a versioned JSON API under `/api/v1`. Maya-related functionality includes checkout creation, payment verification, webhook handling, reconciliation, and payment status updates.

### 2.2 Technologies

| Area | Technologies |
|---|---|
| Frontend | React 19, React Router, Vite 8, JavaScript, CSS, Vite PWA |
| Backend | Node.js, Express 5, CommonJS modules |
| Database | MySQL through Sequelize 6 |
| Authentication | JSON Web Tokens and bcrypt password hashing |
| External services | Maya checkout and webhooks, OpenAI-compatible AI integration |
| API documentation | Swagger UI and `server/openapi.yaml` |
| API testing | Postman collection and environment files |
| Validation | ESLint for frontend JavaScript and JSX |
| Deployment | Vercel configuration for the frontend; Render-style backend and production API configuration |

### 2.3 Actual Project Structure

The project is located in `ITE-ITPE_Finals/` and has the following major areas:

```text
ITE-ITPE_Finals/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── AdminDashboard.jsx
│   │   ├── AIAssistant.jsx
│   │   ├── App.jsx
│   │   ├── AuthModal.jsx
│   │   ├── OrderHistory.jsx
│   │   └── api.js
│   ├── eslint.config.js
│   ├── vite.config.js
│   └── vercel.json
├── server/
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   ├── seeders/
│   ├── services/
│   ├── openapi.yaml
│   └── server.js
├── postman/
│   ├── collection.json
│   ├── environment.example.json
│   └── .postman/resources.yaml
├── docs/
└── package.json
```

Important implementation areas include:

- `client/src/App.jsx` and the components under `client/src/components/` implement the customer interface.
- `client/src/api.js` contains the API base selection, bearer-token handling, request headers, and common response/error processing.
- `client/src/context/` and `client/src/hooks/` manage shared authentication, cart, and network state.
- `server/server.js` mounts route modules, configures middleware, starts the API, and initializes scheduled work.
- `server/routes/` contains authentication, cart and order, administration, AI, art-kit, compatibility, and Maya webhook endpoints.
- `server/middleware/auth.js` validates JWT bearer tokens and enforces the admin role.
- `server/models/` contains Sequelize models and their relationships.
- `server/services/` contains Maya checkout, webhook security, AI, expiry, and reconciliation behavior.
- `server/openapi.yaml` documents the API with OpenAPI 3.
- `postman/` contains the existing Postman collection and local test environment.

## 3. Development Workflow

As a solo project, there is no team branch, assignment, or approval process. A suitable personal workflow is:

1. **Identify the requirement**
   - Describe the feature or bug, affected users, and intended behavior.
   - Check existing frontend pages, API routes, models, OpenAPI documentation, and Postman requests.
2. **Inspect the relevant code**
   - Trace the request from the React component through `client/src/api.js`, Express routing, middleware, models, and database operations.
3. **Plan the smallest complete change**
   - Identify files that need modification and preserve existing naming and response conventions.
   - Consider authentication, authorization, validation, database effects, and frontend error handling.
4. **Implement incrementally**
   - Make one coherent change at a time.
   - Keep unrelated refactoring outside the feature or fix.
5. **Update directly related documentation**
   - Add or correct relevant OpenAPI descriptions and Postman requests.
   - Update project documentation only when behavior or setup has changed.
6. **Run targeted validation**
   - Run frontend lint and build checks.
   - Run relevant backend scripts or test commands.
   - Perform manual testing on local development data.
7. **Perform a final self-review**
   - Inspect the complete diff, confirm no secrets or unintended files were added, and verify that changed behavior matches the requirement.
8. **Record the change**
   - Use clear Git commits and a concise commit message.
   - Deploy only after local verification and environment checks.

## 4. Version Control and GitHub Usage

Git should be used to preserve the history of source code and to make each meaningful change reviewable. GitHub stores the project repository and provides remote backup.

Existing usage should remain based on the actual project:

- use descriptive commits for feature additions, bug fixes, documentation, and configuration changes;
- commit only relevant source and documentation files;
- never commit passwords, JWT secrets, Maya credentials, database credentials, or production tokens;
- inspect the working tree before committing;
- keep generated build output and local environment files out of source control; and
- push only when the current work has been reviewed locally.

This project does not establish a requirement for a formal branching or pull-request workflow. The sole developer may use local branches when they provide practical isolation, but this must be a conscious personal choice rather than an assumed team process.

A simple commit message should state the changed behavior rather than the files touched, for example:

- `Fix invalid Maya webhook timestamp handling`
- `Add customer art kit management requests to Postman`
- `Update cart stock validation`

Before committing, check:

- [ ] Only intended files are changed.
- [ ] No database or secret file is included.
- [ ] The diff contains no unrelated edits.
- [ ] Local validation has been recorded or noted.
- [ ] Postman environment values do not contain real credentials.

## 5. Coding Standards and Guidelines

### 5.1 Naming and Organization

- Use descriptive camelCase names for JavaScript variables and functions.
- Use PascalCase for React components and Sequelize model names.
- Use lowercase route names that describe resources, for example `/products`, `/orders`, and `/compatibility/tablets`.
- Name files according to responsibility:
  - React UI components under `client/src/components/`;
  - React hooks under `client/src/hooks/`;
  - backend routes under `server/routes/`;
  - persistence models under `server/models/`; and
  - reusable external-service behavior under `server/services/`.
- Keep route handlers focused. Place reusable authentication, validation, or external integration logic in middleware or services rather than duplicating it.
- Preserve the existing CommonJS style in the server and ES module style in the Vite client.

### 5.2 Formatting and Readability

- Use consistent indentation and semicolon style within each existing file.
- Prefer readable multi-line expressions over dense long statements.
- Keep React JSX attributes, hook dependencies, and callback functions clear.
- Use meaningful names instead of unexplained abbreviations.
- Remove unused variables and imports when encountered in changed code.
- Avoid unnecessary comments. Add a comment only when the reason for an implementation decision is not evident from the code.
- Use extracted functions for repeated validation or response construction.

### 5.3 Validation and Error Handling

- Validate user-controlled values on the backend even if the frontend already validates them.
- Convert numeric input explicitly and reject invalid types, ranges, and missing values.
- Follow the existing API error conventions:
  - success responses should include `success: true`;
  - expected failures should include a consistent `error` object or an existing route-specific message;
  - authentication failures should use 401 responses;
  - role violations should use 403 responses;
  - invalid input and state conflicts should use 400 or 409 as appropriate;
  - not-found resources should use 404.
- Do not expose secret values or internal stack traces in API responses.
- Roll back database transactions in all failure paths.
- Preserve transaction locks and idempotency behavior for checkout, order, and payment operations.
- Present concise, useful errors in React and clear stale authentication state when a 401 response occurs.

### 5.4 Maintainability

- Do not duplicate endpoint prefixes or response structures unnecessarily.
- Keep route mounting in `server/server.js` synchronized with `server/openapi.yaml` and Postman requests.
- Check product, cart, coupon, order, art-kit, and compatibility changes across all affected frontend and backend surfaces.
- Be cautious with schema changes in `server/models/` because they affect API data and MySQL synchronization.
- Treat scheduled expiry and Maya reconciliation services as production-sensitive code and verify their test environment before execution.
- Keep environment-specific URLs and credentials outside source code.

## 6. Code Review and Self-Inspection Process

Before considering a change complete, inspect it as if the reviewer were another developer:

### 6.1 Review Scope

- List the modified, created, or deleted files.
- Check whether each file change is necessary for the requirement.
- Trace affected frontend requests through `client/src/api.js`.
- Trace backend requests through route mounting, middleware, route logic, models, and any payment or AI service.
- Check `server/openapi.yaml` and existing Postman requests for consistency.

### 6.2 Logic Review Checklist

- [ ] The HTTP method and path are correct.
- [ ] Authentication and authorization match the resource.
- [ ] Required request fields and query parameters are validated.
- [ ] Numeric values, arrays, and optional values are handled safely.
- [ ] Null and not-found cases are handled.
- [ ] Transactional operations commit and roll back correctly.
- [ ] Stock, coupon, payment, and order state changes remain consistent.
- [ ] Maya signature and timestamp handling remains validated.
- [ ] Frontend loading, success, error, offline, and unauthorized states remain usable.
- [ ] Response fields used by the frontend exist in the backend response.
- [ ] No production URL or production credential is used for local testing.

### 6.3 Regression Review

Review nearby behavior even if the edit is small:

- cart updates may affect checkout totals and stock;
- coupon changes may affect cart and checkout validation;
- order status changes may affect payment and stock behavior;
- product changes may affect categories, compatibility, art kits, and public listings;
- authentication changes may affect every protected endpoint;
- API configuration changes may affect development proxying and production API calls.

### 6.4 Final Inspection

Run `git diff --stat` and `git diff` or an equivalent visual diff. Review the complete patch for accidental formatting changes, secrets, debug output, temporary test overrides, or unrelated modifications.

## 7. Testing and Validation

Testing should be based on evidence from the local environment. A test is only considered passed after it has actually been executed and the relevant result has been observed.

### 7.1 Frontend Validation

The client package provides these scripts:

```text
npm run dev
npm run lint
npm run build
npm run preview
```

- **Lint:** run `npm run lint` from `ITE-ITPE_Finals/client/` to check JavaScript and JSX.
- **Production build:** run `npm run build` to verify Vite can compile the client.
- **Development server:** use `npm run dev` for manual frontend testing.
- **Preview:** use `npm run preview` only after a build to inspect the built application.

### 7.2 Backend Validation

The backend package provides:

```text
npm run dev
npm start
npm test
npm run seed:phase1
```

`npm test` uses Node's test runner with `node --test`. Additional dedicated scripts exist for payment and webhook scenarios, including checkout tampering, late payment, amount mismatch, race conditions, and webhook recovery. These scripts are not general safe production tests. Several are explicitly restricted to named test databases or mock external payment behavior.

Before executing a dedicated backend test:

- verify it uses an isolated TEST database;
- confirm database and Maya environment variables;
- check for destructive cleanup or reset behavior;
- read the script before running it;
- do not run it against production; and
- stop and investigate unexpected database or service behavior.

### 7.3 API and Manual Testing

The existing Postman collection should be used with `postman/environment.example.json` or a local Postman environment. The environment must remain local-only.

The collection should verify:

- mounted `/api/v1` prefixes;
- authentication and bearer-token handling;
- customer and admin permissions;
- request bodies and required headers;
- response shapes and status codes;
- negative validation cases;
- cart and stock behavior;
- checkout idempotency;
- order operations;
- Maya webhook signature and timestamp rules;
- and the actual mounted webhook path `/api/v1/webhooks/maya`.

Manual browser testing should cover login, public catalog, cart, checkout entry, order history, art kits, compatibility, AI assistant behavior, responsive layouts, and administrative actions. Test one normal flow and one relevant failure flow for each changed feature.

### 7.4 Verification Evidence

Record validation accurately. A useful local record can include:

| Check | Result | Evidence |
|---|---|---|
| Frontend lint | Not automatically known | Record command output after execution |
| Frontend build | Not automatically known | Record command output after execution |
| Backend tests | Not automatically known | Record command and output |
| Postman collection | JSON structure can be inspected | API calls should be marked executed only after local HTTP responses are observed |

The document and repository should not claim that tests passed unless the check was actually run.

## 8. Bug Reporting and Resolution

Bug handling is also performed personally. A bug report does not require team members or an approval system, but it should be detailed enough to reproduce the problem later.

For each bug, record:

- a short title;
- the affected page or API endpoint;
- environment, including local or production context;
- exact steps to reproduce;
- expected behavior;
- actual behavior;
- HTTP status or browser console result;
- relevant request fields and response data;
- database state when it is relevant;
- and whether production data was involved.

Do not record passwords or tokens. Redact credentials and use test accounts.

### Resolution Process

1. **Reproduce locally**
   - Prefer an isolated local database or clearly marked TEST database.
   - Never reproduce destructive behavior against production data.
2. **Identify the smallest failing component**
   - Determine whether the problem is frontend state, API mounting, validation, authorization, database logic, or an external service.
3. **Trace inputs and outputs**
   - Inspect the route, middleware, service, model, and frontend request handling.
4. **Form a hypothesis**
   - Document likely causes before changing code.
5. **Apply a focused fix**
   - Correct the root cause rather than suppressing the visible symptom.
6. **Add a verification case**
   - Use an existing test script or a targeted Postman/manual check where appropriate.
7. **Check related behavior**
   - Run relevant lint/build/API checks and inspect state changes.
8. **Record the resolution**
   - Commit with a clear bug-fix message and update documentation if behavior or setup changed.

## 9. Deployment and Maintenance

### 9.1 Pre-Deployment Checks

Before deployment:

- [ ] Confirm required environment variables are configured on the deployed frontend and backend.
- [ ] Verify JWT, database, Maya, and AI secrets are available but never committed.
- [ ] Verify frontend API URL and backend CORS origin configuration.
- [ ] Run the frontend lint and production build.
- [ ] Run relevant backend validation and local API tests.
- [ ] Verify `server/openapi.yaml` and the Postman collection match mounted routes.
- [ ] Verify that model synchronization is understood before startup; the
  repository does not provide a general production migration workflow.
- [ ] Confirm no test-only database name or mock Maya configuration is present in production.
- [ ] Inspect the Git diff and working tree.

The Vite client is configured for Vercel-style SPA rewriting in `client/vercel.json`. Development API requests use the Vite proxy or `VITE_API_URL`, while production builds use the configured hosted backend unless overridden.

### 9.2 Safe Deployment

- Use the actual hosting platforms and credentials configured for the project.
- Deploy the backend and frontend only after local validation.
- Verify the deployed API welcome endpoint and public catalog before testing protected features.
- Avoid destructive administrative or inventory actions on production.
- Test production with read-only requests and approved account procedures whenever possible.
- Keep Maya webhook delivery and payment changes limited to sandbox or TEST environments unless a live payment is explicitly intended.

### 9.3 Maintenance

Maintenance tasks should include:

- reviewing logs and unexpected API status patterns;
- checking Maya reconciliation and pending-order expiry behavior;
- reviewing dependency updates for compatibility;
- rerunning lint and build checks after package or framework updates;
- revalidating authentication and protected routes after middleware changes;
- updating OpenAPI and Postman documentation after API changes;
- reviewing database growth and indexes when performance issues appear;
- backing up important production data according to the hosting provider's procedures; and
- documenting a regression or incident before applying a corrective release.

For updates, make a focused change, validate it locally, commit it clearly, deploy it, and verify the smallest affected production behavior.

## 10. Conclusion

Code quality and maintainability are important for this individually developed academic project because there is no separate team to inspect, test, or maintain the system. The sole developer must therefore combine implementation, self-review, testing, deployment, and maintenance responsibilities.

By following a consistent workflow, preserving clear naming and structure, tracing changes across frontend and backend layers, validating against local TEST resources, reviewing diffs, and documenting both existing practices and verification evidence, the developer can keep Artistry understandable and reliable throughout its lifecycle.
