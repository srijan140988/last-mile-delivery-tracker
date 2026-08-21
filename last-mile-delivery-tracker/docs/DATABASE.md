# Database Schema

PostgreSQL via Prisma. Full source of truth: `server/prisma/schema.prisma`.

## Entity overview

| Model | Purpose |
|---|---|
| `User` | Shared identity for all roles (customer/agent/admin); holds credentials. |
| `Customer` | 1:1 with `User` (role=CUSTOMER); optional `companyName` for B2B accounts. |
| `DeliveryAgent` | 1:1 with `User` (role=AGENT); tracks active/available flags, current zone, current lat/lng. |
| `Zone` | Admin-defined delivery zone (e.g. "North Zone"). |
| `Area` | Postcode → Zone mapping, admin-managed. `postcode` is unique. |
| `RateCard` | Admin-configured `ratePerKg` per `(orderType, rateType, zone[s])`. No pricing is hardcoded. |
| `CodSurchargeConfig` | One row per `orderType`, holding flat fee + percentage COD surcharge. |
| `Order` | The shipment: addresses, dimensions, computed weights, pricing snapshot, current `status`. |
| `TrackingEvent` | **Append-only** log of every status change (previous→new, actor, role, remarks, override flag, timestamp). |
| `AgentAssignment` | One row per assignment attempt (`ACTIVE`/`COMPLETED`/`REASSIGNED`/`CANCELLED`) — reassignments never overwrite history. |
| `Reschedule` | One row per failed-delivery reschedule request (reason + requested date). |
| `Notification` | Audit log of every email/SMS attempt, including failures, per order. |

## Key relationships

```
User 1—1 Customer            User 1—1 DeliveryAgent
Customer 1—N Order           DeliveryAgent 1—N AgentAssignment
Zone 1—N Area                Zone 1—N DeliveryAgent (currentZone)
Zone 1—N Order (as pickupZone) 1—N Order (as dropZone)
Order 1—N TrackingEvent      Order 1—N AgentAssignment
Order 1—N Reschedule         Order 1—N Notification
RateCard N—1 Zone (intra)    RateCard N—1 Zone×2 (inter: fromZone/toZone)
```

## Design decisions

- **Immutability of history**: `TrackingEvent` and `AgentAssignment` rows are
  never updated to change their meaning — `AgentAssignment.status` moves
  `ACTIVE → REASSIGNED/COMPLETED`, but a *new* row is always created for a
  reassignment rather than mutating the old one. This gives a complete,
  queryable audit trail for every order.
- **Rate cards as data, not code**: `RateCard` has no natural unique
  constraint because a rate is uniquely identified by the *combination* of
  `orderType + rateType + zone(s)`; the seed/route layer enforces
  "one active rate per lane" by upserting via a `findFirst` lookup rather
  than a DB-level unique index, to keep the schema simple while the
  application layer owns the invariant.
- **Enums over free-text**: `Role`, `OrderType`, `PaymentType`, `RateType`,
  `OrderStatus`, `AssignmentStatus`, `NotificationChannel`,
  `NotificationStatus` are all Postgres enums via Prisma, preventing typo'd
  statuses from ever entering the database.
- **Indexes**: added on all foreign keys used in filtering (`Order.status`,
  `Order.customerId`, `Order.pickupZoneId`/`dropZoneId`,
  `TrackingEvent.orderId+createdAt`, `AgentAssignment.agentId+status`,
  `DeliveryAgent.isActive+isAvailable`) to keep the admin filter/list views
  and the auto-assignment eligibility query fast as data grows.
- **Pricing snapshot on Order**: `ratePerKg`, `baseCharge`, `codSurcharge`,
  `totalCharge`, `volumetricWeightKg`, `chargeableWeightKg` are all stored
  on the `Order` row at creation time rather than recomputed on read. This
  means historical orders keep their original price even if an admin
  changes a `RateCard`'s `ratePerKg` afterwards.

## Running migrations

```bash
cd server
npx prisma generate
npx prisma migrate dev --name init
npm run seed
```
