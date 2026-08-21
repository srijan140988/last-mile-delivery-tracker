# API Documentation

Base URL: `http://localhost:4000/api` (or your deployed backend URL + `/api`)

All endpoints except `/auth/register` and `/auth/login` require:

```
Authorization: Bearer <jwt>
```

Error responses are always shaped as:

```json
{ "error": { "message": "...", "details": [...optional] } }
```

## Auth

### `POST /auth/register`
Registers a **customer** account (agents/admins are provisioned by an admin).

Body:
```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "secret123", "phone": "9999900000", "companyName": "Acme Pvt Ltd" }
```
Returns `201` with `{ token, user }`.

### `POST /auth/login`
Body: `{ "email": "...", "password": "..." }` → `{ token, user }`. Works for customer, agent, and admin accounts alike.

### `GET /auth/me`
Returns the authenticated user's profile.

---

## Orders

### `POST /orders/calculate-price`
Preview the charge before creating an order. No order is persisted.

Body:
```json
{
  "pickupPincode": "110085",
  "dropPincode": "110017",
  "lengthCm": 20, "breadthCm": 20, "heightCm": 10,
  "actualWeightKg": 5,
  "orderType": "B2C",
  "paymentType": "COD"
}
```
Returns the full pricing breakdown (zones, volumetric/chargeable weight, rate type, rate/kg, base charge, COD surcharge, total charge).

### `POST /orders`
Creates an order. Customers create for themselves; admins must pass `customerId` to create on a customer's behalf. Same body as above plus `pickupAddress`, `dropAddress`, optional `preferredDeliveryDate`.

### `GET /orders`
Lists orders, scoped by role (customers see only their own, agents see only assigned orders, admins see all). Query params: `status`, `zone`, `agentId`, `date`, `page`, `pageSize`.

### `GET /orders/:id`
Order detail including zones, active/past assignments, tracking events, reschedules. Access-controlled per role.

### `GET /orders/:id/tracking`
The full immutable tracking timeline for an order.

### `POST /orders/:id/assign` — **admin only**
Manually assign a specific agent. Body: `{ "agentId": "...", "reason": "optional" }`.

### `POST /orders/:id/auto-assign` — **admin only**
Triggers automatic nearest-available-agent assignment.

### `PATCH /orders/:id/status` — **agent or admin**
Body: `{ "status": "PICKED_UP", "remarks": "optional", "failureReason": "required if status=FAILED", "override": true|false }`.
Agents can only progress orders assigned to them through the normal state machine. Admins may set `override: true` to force any transition (still logs an immutable, flagged tracking event).

### `POST /orders/:id/reschedule` — **customer or admin**
Only valid when order status is `FAILED`. Body: `{ "requestedDate": "2026-09-01T00:00:00.000Z" }`. Automatically attempts to reassign an agent.

---

## Zones

- `GET /zones` — list zones with area/agent counts.
- `POST /zones` — **admin** — `{ "name": "North Zone", "description": "optional" }`
- `PATCH /zones/:id` — **admin**
- `DELETE /zones/:id` — **admin** — fails if areas are still mapped to the zone.

## Areas

- `GET /areas?zoneId=...` — list postcode→zone mappings.
- `POST /areas` — **admin** — `{ "name": "Rohini", "postcode": "110085", "zoneId": "..." }`
- `PATCH /areas/:id` — **admin**

## Rate Cards

- `GET /rates?orderType=&rateType=` — list rate cards.
- `POST /rates` — **admin** — intra-zone: `{ orderType, rateType: "INTRA_ZONE", zoneId, ratePerKg }`; inter-zone: `{ orderType, rateType: "INTER_ZONE", fromZoneId, toZoneId, ratePerKg }`.
- `PATCH /rates/:id` — **admin**
- `GET /rates/cod-surcharge` — list COD surcharge configs (one per order type).
- `POST /rates/cod-surcharge` — **admin** — upserts `{ orderType, flatFee, percentage }`.

## Agents

- `GET /agents?zoneId=&isAvailable=&isActive=` — **admin** — list all agents.
- `GET /agents/me` — **agent** — own profile.
- `PATCH /agents/:id/availability` — **agent (self) or admin** — `{ isAvailable, isActive }`.
- `PATCH /agents/:id/location` — **agent (self) or admin** — `{ lat, lng, zoneId? }`.

## Admin

- `GET /admin/customers` — list all customers with order counts.
- `POST /admin/agents` — provision a new agent account — `{ name, email, password, phone?, currentZoneId? }`.

---

## HTTP status codes

| Code | Meaning |
|------|---------|
| 200/201 | Success |
| 400 | Validation error / invalid state transition / bad request |
| 401 | Missing/invalid/expired token |
| 403 | Authenticated but not permitted (role or ownership) |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, no agent available, etc.) |
| 500 | Unexpected server error |
