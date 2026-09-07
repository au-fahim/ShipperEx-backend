# Postman Testing Guide

Import `docs/ShipperEx.postman_collection.json`. The collection is organized as:

- `Public`
- `Customer`
- `Manager`
- `Courier`
- `Admin`

Set collection variable `baseUrl` to `https://shipperex-backend.vercel.app/api/v1`
for evaluation, or `http://localhost:5000/api/v1` locally. Login requests save role
tokens automatically; creation/lookup requests save IDs used by later requests.
Use the [README demo accounts](../README.md#roles-and-demo-accounts). The default
route is Chattogram, Bangladesh to Lima, Peru. Destination requests use Lima staff
tokens, not origin staff tokens.

## Main Demonstration

1. Run `Public / Login Customer`, `Login Origin Manager`, `Login Origin Courier`, `Login Destination Manager`, and `Login Destination Courier`.
2. Run `Public / Countries` and `Customer / List Hubs` to obtain country/hub IDs.
3. Run `Customer / Export Quote` and `Create Export Shipment`.
4. Run `Customer / Initiate Stripe Checkout` and open `checkoutUrl`.
5. Pay with Stripe test card `4242 4242 4242 4242`, a future expiry, and any three-digit CVC. Locally, keep `stripe listen` forwarding the webhook; for deployment, use a Stripe Dashboard webhook destination.
6. Confirm the shipment becomes `PAID_AWAITING_ASSIGNMENT`.
7. Run `Manager / Assign Pickup Courier`.
8. Run Courier Pickup requests: list task, start, complete.
9. Run Manager status requests: origin hub, in transit, checkpoint, destination hub.
10. Run `Manager / Assign Delivery Courier`.
11. Run Courier Delivery requests: list task, start, complete or fail.
12. Run `Customer / Shipment Timeline` and `Public / Track Shipment`.

## Failed Delivery And Return

For each delivery attempt, the destination Manager creates a new Delivery assignment, then the Courier starts and fails it with `contactAttempted: true`.

- Attempts 1 and 2 produce `DELIVERY_FAILED`.
- Attempt 3 produces `HELD_FOR_COLLECTION`.
- The receiver can be recorded through `Manager / Destination - Confirm Hub Collection` if no active return exists.
- Alternatively, the Customer creates a return order and completes a new Stripe payment.
- A paid return starts at `AT_ORIGIN_HUB`; do not assign a Pickup task.

## Stripe CLI

```bash
stripe listen --events checkout.session.completed --forward-to localhost:5000/api/v1/payments/webhook
```

Use the CLI's current `whsec_...` value as `STRIPE_WEBHOOK_SECRET` and restart the backend. A manually opened success URL is not proof of payment. The response should show `verified: true`, and the Stripe CLI should show a webhook `200`.

For Vercel, use `https://shipperex-backend.vercel.app/api/v1/payments/webhook`
as the Stripe test destination and its signing secret in Vercel.

Checkout initiation saves `sessionId` in collection variables for the Public
success/cancel requests. For return Checkout, copy the response's `sessionId`
into that variable when testing callbacks manually. Without it, callbacks only
acknowledge the request and do not update payments.

Demonstrate cancellation on a separate unpaid shipment: initiate Checkout, then
return through its cancel link. Check `/payments/my` for `CANCELLED`; the shipment
still awaits payment. Already paid payments are not downgraded by cancellation.

## Required Error Demonstrations

- Customer calls `/admin/users` and receives `403`.
- Courier calls `/couriers` and receives `403`.
- Origin Manager attempts a destination-only assignment and receives `403`.
- Sixth active assignment to one Courier receives `409`.
- Sender/recipient country mismatch receives `400`.
- A hub outside the selected origin/destination country receives `400`.
- Invalid request body receives structured Zod errors.
- Unknown resource receives `404`.

Thunder Client is not required.
