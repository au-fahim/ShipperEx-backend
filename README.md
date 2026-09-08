# ShipperEx Backend

A Courier & Logistics Platform REST API for international document and parcel shipments. Customers request pickups, pay through Stripe Checkout, and track shipments. Hub managers assign work, couriers complete pickup and delivery tasks, and administrators manage users, hubs, and shipment rates.

## Submission Links

| Item                | Link / Details                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Backend repository  | [au-fahim/ShipperEx-backend](https://github.com/au-fahim/ShipperEx-backend)                                 |
| Live API            | [shipperex-backend.vercel.app](https://shipperex-backend.vercel.app/)                                       |
| API base URL        | `https://shipperex-backend.vercel.app/api/v1`                                                               |
| Health check        | [GET /api/v1/health](https://shipperex-backend.vercel.app/api/v1/health)                                    |
| API documentation   | [Postman API Documentation](https://documenter.getpostman.com/view/54943329/2sBYAxQ9p9)                     |
| Postman collection  | [Importable collection](docs/ShipperEx.postman_collection.json)                                             |
| API walkthrough     | [Postman testing guide](docs/postman-testing-guide.md)                                                      |
| Demo video          | [Demo Video Drive Link](https://drive.google.com/file/d/1mnYaODg0t6qesIsiVJ9fWq2bJo2PQCrL/view?usp=sharing) |
| Demo admin email    | `admin@shipperex.com`                                                                                       |
| Demo admin password | `Admin@12345`                                                                                               |

Demo accounts are created by `pnpm prisma:seed`. Existing admin/customer passwords are not overwritten by seeding; confirm credentials against the submission database if those accounts were changed.

## Features

- Email/password authentication, Customer Google sign-in, JWT access tokens, refresh-token issuance, and logout.
- Exactly three primary roles: `CUSTOMER`, `STAFF`, and `ADMIN`; Staff have a `MANAGER` or `COURIER` subtype.
- Export/import quotes, shipment creation, pickup scheduling, and saved price, rate, sender, and recipient snapshots.
- Origin/destination country and hub consistency checks.
- Separate pickup/delivery tasks, manual courier assignment, and manager batch assignment.
- Shipment transitions, transit checkpoints, public tracking, and in-app notifications.
- Three delivery attempts, destination-hub collection, and separately paid return shipments.
- Stripe Checkout, signed webhooks, success reconciliation, cancellation handling, and payment history.
- Admin hub/rate CRUD, staff creation, user management, statistics, reports, and audit logs.
- Pagination, shipment tracking-number search, filtering, sorting, soft deletes, and database indexes.
- Serializable transactions for shipment workflows and optional Redis tracking cache.

## Technology

| Area                       | Implementation                                        |
| -------------------------- | ----------------------------------------------------- |
| Runtime                    | Node.js; use Node.js 24.x for this project            |
| Language / framework       | TypeScript 6.0.2, Express 5.2.1                       |
| Database / ORM             | PostgreSQL, Prisma 7.10.0, `@prisma/adapter-pg`, `pg` |
| Validation                 | Zod 4                                                 |
| Authentication             | `jsonwebtoken`, `bcryptjs`, `google-auth-library`     |
| Payments                   | Stripe Checkout and webhooks in test mode             |
| Optional caching           | Redis through `ioredis`                               |
| Security                   | Helmet, CORS, `express-rate-limit`                    |
| Code quality               | Biome                                                 |
| Documentation / deployment | Postman, Vercel                                       |
| Package manager            | pnpm 12.3.4                                           |

Exact dependencies are pinned in `package.json` and `pnpm-lock.yaml`. Use the committed lockfile to reproduce the submitted build.

## Architecture

```text
HTTP Request
  -> Routes: authentication, authorization, validation middleware
  -> Controllers: request handling and consistent responses
  -> Services: business rules, access scopes, transactions
  -> Prisma -> PostgreSQL

Services also communicate with Stripe and optional Redis.
```

```text
prisma/
  schema.prisma        Models, relations, enums, indexes
  migrations/          Committed PostgreSQL migrations
  seed.ts              Demo accounts, countries, hubs, rates
src/
  app.ts               Express configuration and default Vercel export
  server.ts            Local HTTP listener and shutdown handling
  routes.ts            /api/v1 route registration
  config/              Environment, Prisma, Stripe, Redis
  middlewares/         Authentication, validation, errors, rate limiting
  modules/             Domain routes, controllers, services, validation
  shared/              Response, pagination, transaction helpers
  types/               Express request type extensions
  generated/prisma/    Generated during installation; not committed
docs/                  Endpoint reference, Postman collection and guide
scripts/               API smoke and paid-shipment workflow checks
prisma.config.ts        Prisma CLI datasource and migration configuration
```

Core entities are `User`, `RefreshToken`, `StaffProfile`, `Country`, `RateZone`, `Hub`, `ShipmentRate`, `Shipment`, `CourierTask`, `Payment`, `TrackingEvent`, `CourierEarning`, `Notification`, and `AuditLog`. Users own shipments/payments; staff belong to hubs; shipments reference countries/hubs; tasks connect shipments to couriers. Return shipments reference their original shipment.

The [Prisma schema](prisma/schema.prisma) defines timestamps, foreign keys, unique constraints, indexes, and soft-delete fields. Financial values use PostgreSQL Decimal columns.

## Roles and Demo Accounts

| Primary role | Staff type | Permissions                                                                  |
| ------------ | ---------- | ---------------------------------------------------------------------------- |
| `CUSTOMER`   | None       | Own shipments, quotes, payments, profile, notifications, return requests     |
| `STAFF`      | `MANAGER`  | Associated hub's shipments, courier assignments, transit operations, reports |
| `STAFF`      | `COURIER`  | Own assigned pickup/delivery tasks and permitted task transitions            |
| `ADMIN`      | None       | User/staff administration, hub/rate management, global reports, audit logs   |

| Account             | Email                           | Password         | Hub        |
| ------------------- | ------------------------------- | ---------------- | ---------- |
| Admin               | `admin@shipperex.com`           | `Admin@12345`    | Global     |
| Customer            | `customer@shipperex.com`        | `Customer@12345` | None       |
| Origin manager      | `manager@shipperex.com`         | `Manager@12345`  | Chattogram |
| Origin courier      | `rahim.courier@shipperex.com`   | `Courier@12345`  | Chattogram |
| Destination manager | `manager.lima@shipperex.com`    | `Manager@12345`  | Lima       |
| Destination courier | `carlos.courier@shipperex.com`  | `Courier@12345`  | Lima       |
| New York manager    | `manager.newyork@shipperex.com` | `Manager@12345`  | New York   |
| New York courier    | `john.courier@shipperex.com`    | `Courier@12345`  | New York   |

All password accounts use `POST /api/v1/auth/login`. Only Admin creates managers/couriers through `/admin/staff/managers` and `/admin/staff/couriers`. Public registration always creates a Customer.

Google sign-in accepts a Google ID token at `POST /auth/google`. Existing password Customers can link a verified Google identity with the same email. Google-only Customers have no password and cannot use password login. Staff and Admin cannot use Google login.

## Local Setup

Prerequisites: Node.js 24.x, pnpm 12.3.4, a reachable PostgreSQL database, and Stripe test credentials. Google credentials are needed to demonstrate social login. Redis is optional.

### 1. Clone and Configure

```bash
git clone https://github.com/au-fahim/ShipperEx-backend.git
cd ShipperEx-backend
```

Create `.env` from `.env.example` before installing dependencies. PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux, use `cp .env.example .env`. Edit its values using the table below. Prisma configuration reads `DATABASE_URL` during client generation, so it must exist before the install hook runs.

### 2. Install, Migrate, and Seed

Create an empty PostgreSQL database named `shipperex` using your database client, then configure its connection URL in `.env`.

```bash
pnpm install --frozen-lockfile
pnpm prisma:deploy
pnpm prisma:seed
pnpm dev
```

Installation generates Prisma Client. `prisma:deploy` applies existing committed migrations; creating new migrations is unnecessary to run the submitted project. Seeding adds 13 zones, 21 countries, four hubs, demo accounts, and document/parcel export/import rates. Re-running the seed refreshes seeded rates and staff settings, so use it deliberately on customized databases.

Local API: `http://localhost:5000/api/v1`. Check startup at `http://localhost:5000/api/v1/health`. This endpoint reports process uptime; it does not independently test PostgreSQL, Stripe, or Redis.

For a compiled local run:

```bash
pnpm build
pnpm start
```

## Environment Variables

Store local values in `.env` and deployed values in Vercel's Environment Variables settings. Never commit `.env`, database passwords, JWT secrets, or Stripe keys.

| Variable                 | Required / Default               | Purpose                                                   |
| ------------------------ | -------------------------------- | --------------------------------------------------------- |
| `DATABASE_URL`           | Required                         | PostgreSQL connection URL                                 |
| `JWT_ACCESS_SECRET`      | Required, at least 12 characters | Access-token signing secret                               |
| `JWT_REFRESH_SECRET`     | Required, at least 12 characters | Separate refresh-token signing secret                     |
| `STRIPE_SECRET_KEY`      | Required                         | Stripe test secret key, `sk_test_...`                     |
| `STRIPE_WEBHOOK_SECRET`  | Required                         | Signing secret for the applicable listener/destination    |
| `STRIPE_SUCCESS_URL`     | Required URL                     | Backend success callback, without query parameters        |
| `STRIPE_CANCEL_URL`      | Required URL                     | Backend cancel callback, without query parameters         |
| `GOOGLE_CLIENT_ID`       | Required for Google login        | Google web OAuth client ID                                |
| `NODE_ENV`               | `development`                    | `development`, `test`, or `production`                    |
| `PORT`                   | `5000`                           | Local listener port                                       |
| `JWT_ACCESS_EXPIRES_IN`  | `1d`                             | Access-token lifetime                                     |
| `JWT_REFRESH_EXPIRES_IN` | `30d`                            | Keep the default to match stored refresh-token expiry     |
| `REDIS_ENABLED`          | `false`                          | Set `true` to enable tracking cache                       |
| `REDIS_URL`              | Needed when caching is enabled   | Redis connection URL; omit when unused                    |
| `CORS_ORIGIN`            | `*`                              | Allowed origin, or comma-separated origins without spaces |

Local callback settings:

```env
STRIPE_SUCCESS_URL=http://localhost:5000/api/v1/payments/success
STRIPE_CANCEL_URL=http://localhost:5000/api/v1/payments/cancel
REDIS_ENABLED=false
```

Missing/invalid required variables stop startup. Omit unused optional URL variables rather than setting them to empty strings.

For Google login, configure a web OAuth client in Google Cloud/Google Auth Platform and obtain an ID token using Google Identity Services for that client. Send `{ "idToken": "<google-id-token>" }` as JSON to `/auth/google`. The backend verifies its audience and verified email. This endpoint does not implement a browser redirect callback or accept a Google access token instead of an ID token. See [Google's server-side ID token guide](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Postman Quick Start

Import [ShipperEx.postman_collection.json](docs/ShipperEx.postman_collection.json). Public, Customer, Manager, Courier, and Admin folders include request bodies and scripts that save tokens and IDs.

1. Set collection variable `baseUrl` to `https://shipperex-backend.vercel.app/api/v1` or `http://localhost:5000/api/v1`.
2. Run the Public login requests for the accounts being demonstrated.
3. Run `Public / Countries` and `Customer / List Hubs`. The collection selects Bangladesh/Chattogram as origin and Peru/Lima as destination.
4. Run `Customer / Export Quote`, then `Create Export Shipment`.
5. Run `Initiate Stripe Checkout`, pay in the browser, and read payment/shipment status again.
6. Follow the [testing guide](docs/postman-testing-guide.md) for pickup, transit, delivery, returns, and public tracking.

Private requests require `Authorization: Bearer <accessToken>`. JSON bodies use `Content-Type: application/json`. Assignment `courierId` means the courier's **StaffProfile ID**, not User ID. Origin/destination requests use different staff tokens.

The project has more than 20 meaningful endpoints. See the [complete endpoint reference](docs/api-endpoints.md) for methods, paths, permissions, and purposes, and the collection for request bodies.

Example `POST /auth/login` body:

```json
{
  "email": "admin@shipperex.com",
  "password": "Admin@12345"
}
```

Example Manager list request:

```http
GET /api/v1/shipments?page=1&limit=10&direction=EXPORT&shipmentType=PARCEL&status=PAID_AWAITING_ASSIGNMENT&search=SXP&sortBy=createdAt&sortOrder=desc
Authorization: Bearer <manager-access-token>
```

Success responses contain `success`, `message`, and `data`; paginated responses also include `meta` with `page`, `limit`, and `total`.

```json
{ "success": true, "message": "Operation successful", "data": {} }
```

Errors follow a consistent format:

```json
{
  "success": false,
  "message": "API endpoint not found",
  "errors": [{ "path": "/unknown", "message": "Route does not exist" }]
}
```

Demonstrate invalid email (`400`), missing Bearer token (`401`), Customer access to `/admin/users` (`403`), unknown tracking number (`404`), and a sixth active assignment (`409`). Rate limiting returns structured `429` responses after the configured 300 requests per 15-minute window.

### Pricing and Addresses

- Origin and destination must be different active supported countries. Origin is not restricted to Bangladesh.
- `sender.countryId` must match `originCountryId`; `recipient.countryId` must match `destinationCountryId`. Each hub must belong to its selected country. Address text is supplied by the customer; no geocoding or street-address verification is implemented.
- `EXPORT` uses the destination country's export zone; `IMPORT` uses the origin country's import zone.
- Types are `DOCUMENT` and `PARCEL`. Rates are sample assignment prices in USD, not commercial carrier quotations.
- Volumetric weight is `(lengthCm * widthCm * heightCm) / 5000` when all dimensions are supplied. Chargeable weight is the greater of actual/volumetric weight, rounded up to the next 0.5 kg.
- An applicable active rate matches direction, zone, type, weight band, and effective dates. Pricing uses either the fixed slab price or per-kg rate multiplied by chargeable weight.
- Creation stores price and rate snapshots. Later Admin rate changes do not rewrite existing shipment prices.

### Pickup and Delivery

```text
PENDING_PAYMENT -> PAID_AWAITING_ASSIGNMENT -> PICKUP_ASSIGNED
-> PICKED_UP -> AT_ORIGIN_HUB -> IN_TRANSIT -> AT_DESTINATION_HUB
-> DELIVERY_ASSIGNED -> OUT_FOR_DELIVERY -> DELIVERED
```

Managers assign pickup couriers from the origin hub and delivery couriers from the destination hub. These can be different people in different countries. Couriers update their assigned tasks; managers record hub/transit statuses and checkpoints with locations and notes.

A courier holds at most five active tasks (`ASSIGNED` or `IN_PROGRESS`). Five tasks means `AT_CAPACITY`; completing/failing a task releases capacity. `OFFLINE` or `SUSPENDED` couriers cannot receive new work. Manager batch assignment distributes eligible shipments among available couriers by load.

### Failed Delivery and Return

Failure requires a reason and `contactAttempted: true`. The first two failures produce `DELIVERY_FAILED` and allow another delivery assignment. The third produces `HELD_FOR_COLLECTION`.

The destination manager can record collection as `COLLECTED_FROM_HUB` when no active return blocks collection. Alternatively, the original Customer creates a linked return shipment with countries/hubs reversed, the opposite pricing direction, and a new payment based on current rates. Only successful return payment changes the original to `RETURN_BOOKED`. The paid return begins at `AT_ORIGIN_HUB`, skipping pickup because the parcel is already at a hub. Return delivery marks the original `RETURNED_TO_SENDER`.

## Stripe Payment Flow

This project calls Stripe's Checkout and verification APIs in **test mode**. Test cards do not move real money; payment states come from Stripe, not a manual paid-status endpoint. See [Stripe testing documentation](https://docs.stripe.com/testing).

1. Create a shipment: shipment status is `PENDING_PAYMENT`; its payment is `PENDING`.
2. Call `POST /payments/:shipmentId/initiate` as the owning Customer and open `data.checkoutUrl`.
3. Enter `4242 4242 4242 4242`, any future expiry, and any three-digit CVC.
4. Stripe redirects to the success callback with `session_id`. The backend retrieves the session and reconciles it when Stripe's `payment_status` is `paid`.
5. A signed `checkout.session.completed` webhook independently confirms payment. Signature verification uses the original raw body and `Stripe-Signature` header.
6. Confirmation updates Payment, Shipment, tracking, and audit records in a transaction. Repeat confirmation of an already paid record does not repeat those updates. Tracking cache is invalidated afterward.
7. Read `/payments/my` and `/shipments/:id`: a standard shipment becomes `PAID_AWAITING_ASSIGNMENT` and payment becomes `PAID`.

The cancel callback uses `session_id` to mark a matching unpaid payment `CANCELLED`; it does not downgrade paid records or cancel the shipment itself. Callbacks without a session ID return acknowledgement with `data: null`, not evidence of payment updates. Use a separate unpaid Checkout to demonstrate cancellation.

### Local Webhooks

Install the [Stripe CLI](https://docs.stripe.com/stripe-cli), then authenticate and keep a second terminal listening:

```bash
stripe login
stripe listen --events checkout.session.completed --forward-to localhost:5000/api/v1/payments/webhook
```

Put its `whsec_...` in local `STRIPE_WEBHOOK_SECRET` and restart the backend. Use the same Stripe account/test environment for the CLI and backend key. Complete an app-created Checkout so event metadata matches database records.

## Deployment

`src/app.ts` exports the Express application as default for Vercel. `src/server.ts` starts the local listener; the compiled local start command is `node dist/src/server.js`. See [Vercel Express deployment documentation](https://vercel.com/docs/frameworks/backend/express).

Connect the repository to Vercel and provide Production environment variables. Use hosted PostgreSQL, apply committed migrations with `pnpm prisma:deploy` against that database, and seed the evaluation database once with `pnpm prisma:seed`.

Build command: `pnpm run build`. Installation must include development dependencies and run `postinstall` for Prisma generation. If a production-only install omits TypeScript/types, use this Vercel install command:

```bash
env NODE_ENV=development pnpm install --frozen-lockfile
```

Configure the Stripe test destination for `checkout.session.completed` at:

```text
https://shipperex-backend.vercel.app/api/v1/payments/webhook
```

Use that destination's signing secret on Vercel and these callback URLs:

```env
STRIPE_SUCCESS_URL=https://shipperex-backend.vercel.app/api/v1/payments/success
STRIPE_CANCEL_URL=https://shipperex-backend.vercel.app/api/v1/payments/cancel
```

Redeploy after environment changes. Verify health, login, a database-backed list, and Checkout. A successful build or health response alone does not verify every integration.

## Checks and Scripts

| Command                     | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `pnpm dev`                  | Local watch mode                                     |
| `pnpm build` / `pnpm start` | Compile / run compiled backend                       |
| `pnpm typecheck`            | TypeScript checking without file emission            |
| `pnpm lint`                 | Biome checks                                         |
| `pnpm prisma:generate`      | Regenerate Prisma Client                             |
| `pnpm prisma:deploy`        | Apply committed migrations                           |
| `pnpm prisma:migrate`       | Create/apply migrations during schema development    |
| `pnpm prisma:seed`          | Populate sample data                                 |
| `pnpm prisma:studio`        | Browse the configured database                       |
| `pnpm test:smoke`           | API checks using seeded accounts and test records    |
| `pnpm test:workflow`        | Advance a Stripe-paid demo shipment through delivery |

API scripts need a running backend and seeded database and **change demo data**. They default to `http://localhost:5000/api/v1`; override with `API_BASE_URL` if needed. The workflow script uses the demo Customer, Chattogram staff, and Lima staff. Supply a fresh paid Chattogram-to-Lima shipment awaiting assignment. PowerShell:

```powershell
$env:PAID_SHIPMENT_ID = "your-paid-demo-shipment-id"
pnpm test:workflow
```
