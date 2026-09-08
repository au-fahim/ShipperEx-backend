# ShipperEx API Endpoints

Base URL: `/api/v1`

Live base URL: `https://shipperex-backend.vercel.app/api/v1`.
See the [Postman collection](ShipperEx.postman_collection.json) for request bodies
and the [testing guide](postman-testing-guide.md) for demonstration order.
`GET /` (outside `/api/v1`) returns the public welcome message.

Primary roles are `CUSTOMER`, `STAFF`, and `ADMIN`. Manager and Courier below are
Staff subtypes. Private endpoints require `Authorization: Bearer <accessToken>`.

All responses use the assignment format:

```json
{ "success": true, "message": "Operation successful", "data": {} }
```

```json
{ "success": false, "message": "Something went wrong", "errors": [] }
```

## Public And Authentication

| Method | Endpoint                    | Access                      | Purpose                                                       |
| ------ | --------------------------- | --------------------------- | ------------------------------------------------------------- |
| GET    | `/health`                   | Public                      | API health                                                    |
| POST   | `/auth/register`            | Public                      | Register Customer                                             |
| POST   | `/auth/login`               | Public                      | Shared password login                                         |
| POST   | `/auth/google`              | Customer only               | Verify Google ID token and login/link                         |
| POST   | `/auth/refresh-token`       | Valid refresh token in body | Issue new tokens; previous token is not automatically revoked |
| POST   | `/auth/logout`              | Public                      | Revoke refresh token                                          |
| GET    | `/countries`                | Public                      | Active pricing countries                                      |
| GET    | `/tracking/:trackingNumber` | Public                      | Privacy-safe shipment tracking                                |

## Profiles And Admin Users

| Method | Endpoint                  | Access        | Purpose                                  |
| ------ | ------------------------- | ------------- | ---------------------------------------- |
| GET    | `/users/me`               | Authenticated | Own profile and staff context            |
| PATCH  | `/users/me`               | Authenticated | Update own profile                       |
| GET    | `/admin/users`            | Admin         | Paginated/searchable user list           |
| GET    | `/admin/users/:id`        | Admin         | User detail                              |
| PATCH  | `/admin/users/:id/status` | Admin         | Block/unblock user                       |
| PATCH  | `/admin/users/:id/role`   | Admin         | Safe role update; Staff requires profile |

## Staff, Hubs, And Rates

| Method | Endpoint                | Access        | Purpose                                          |
| ------ | ----------------------- | ------------- | ------------------------------------------------ |
| POST   | `/admin/staff/managers` | Admin         | Create password Manager and hub membership       |
| POST   | `/admin/staff/couriers` | Admin         | Create password Courier and hub membership       |
| GET    | `/couriers`             | Manager/Admin | Hub-scoped Courier list and capacity             |
| PATCH  | `/couriers/:id`         | Manager/Admin | Availability/profile update; Admin transfers hub |
| DELETE | `/couriers/:id`         | Admin         | Soft-delete idle Courier                         |
| GET    | `/hubs`                 | Authenticated | Paginated hub list                               |
| POST   | `/hubs`                 | Admin         | Create hub linked to Country                     |
| PATCH  | `/hubs/:id`             | Admin         | Update hub                                       |
| DELETE | `/hubs/:id`             | Admin         | Soft-delete hub                                  |
| GET    | `/shipment-rates`       | Manager/Admin | List rates                                       |
| POST   | `/shipment-rates`       | Admin         | Create rate                                      |
| PATCH  | `/shipment-rates/:id`   | Admin         | Update rate                                      |
| DELETE | `/shipment-rates/:id`   | Admin         | Soft-delete rate                                 |

## Customer Shipments

| Method | Endpoint                       | Access                 | Purpose                                        |
| ------ | ------------------------------ | ---------------------- | ---------------------------------------------- |
| POST   | `/shipments/quote`             | Authenticated          | Export/import price quote                      |
| POST   | `/shipments`                   | Customer               | Create shipment and pending Payment atomically |
| GET    | `/shipments/my`                | Customer               | Paginated/filterable own shipments             |
| GET    | `/shipments/:id`               | Authorized owner/staff | Shipment detail with safe Courier names        |
| PATCH  | `/shipments/:id`               | Customer               | Update unpaid shipment                         |
| DELETE | `/shipments/:id`               | Customer/Admin         | Soft-delete eligible shipment                  |
| GET    | `/shipments/:id/timeline`      | Authorized owner/staff | Shipment timeline                              |
| POST   | `/shipments/:id/return-orders` | Customer               | Create priced return shipment from held parcel |

Shipment creation requires `sender.countryId` to equal `originCountryId` and
`recipient.countryId` to equal `destinationCountryId`. Each hub must also belong to
its corresponding country. Invalid combinations return `400` before anything is
written to the database.

## Manager Operations

| Method | Endpoint                     | Access                    | Purpose                                            |
| ------ | ---------------------------- | ------------------------- | -------------------------------------------------- |
| GET    | `/shipments`                 | Manager/Admin             | Hub-scoped list with pagination/search/filter/sort |
| POST   | `/shipments/:id/assignments` | Manager/Admin             | Manual Pickup/Delivery task assignment             |
| POST   | `/shipments/auto-assign`     | Manager                   | Least-loaded batch assignment at own hub           |
| PATCH  | `/shipments/:id/status`      | Manager/Admin             | Origin/transit/destination hub status              |
| POST   | `/shipments/:id/checkpoints` | Manager/Admin             | Add in-transit location and note                   |
| POST   | `/shipments/:id/collect`     | Destination Manager/Admin | Confirm receiver hub collection                    |
| GET    | `/admin/reports/shipments`   | Manager/Admin             | Hub-scoped report for Manager                      |

## Courier Tasks

| Method | Endpoint                      | Access           | Purpose                                     |
| ------ | ----------------------------- | ---------------- | ------------------------------------------- |
| GET    | `/courier/tasks`              | Courier          | Own paginated/filterable tasks              |
| GET    | `/courier/tasks/:id`          | Assigned Courier | Own task detail                             |
| PATCH  | `/courier/tasks/:id/start`    | Assigned Courier | Start Pickup or Delivery task               |
| PATCH  | `/courier/tasks/:id/complete` | Assigned Courier | Complete task and shipment transition       |
| PATCH  | `/courier/tasks/:id/fail`     | Delivery Courier | Record failed attempt after contact attempt |

## Payments And Notifications

| Method | Endpoint                                  | Access              | Purpose                                |
| ------ | ----------------------------------------- | ------------------- | -------------------------------------- |
| POST   | `/payments/:shipmentId/initiate`          | Customer            | Create real Stripe Checkout Session    |
| POST   | `/payments/webhook`                       | Stripe signature    | Verify and process Checkout event      |
| GET    | `/payments/success?session_id=:sessionId` | Public              | Retrieve and reconcile Stripe Session  |
| GET    | `/payments/cancel?session_id=:sessionId`  | Public              | Mark matching unpaid payment cancelled |
| GET    | `/payments/my`                            | Customer            | Own payment history                    |
| GET    | `/payments/:id`                           | Owner/Manager/Admin | Scoped payment detail                  |
| GET    | `/notifications`                          | Authenticated       | Own notifications                      |
| PATCH  | `/notifications/:id/read`                 | Authenticated       | Mark own notification read             |
| GET    | `/admin/dashboard-stats`                  | Admin               | Global dashboard statistics            |
| GET    | `/admin/audit-logs`                       | Admin               | Paginated/filterable audit trail       |
