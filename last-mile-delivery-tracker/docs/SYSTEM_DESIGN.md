# System Design — Last-Mile Delivery Tracker

## 1. Rate Calculation Engine

Pricing lives entirely in `server/src/services/rateCalculationService.ts` and is
deliberately isolated from the HTTP layer so it can be unit-tested and reused
by both the price-preview endpoint and order creation.

**Flow:** given dimensions, actual weight, order type, payment type, and
pickup/drop zone IDs, the engine:

1. Validates dimensions and weight are positive (`calculateChargeableWeight`,
   a pure function with no I/O — this is what's unit-tested directly).
2. Computes `volumetricWeightKg = (L × B × H) / 5000` and
   `chargeableWeightKg = max(actualWeightKg, volumetricWeightKg)`.
3. Determines `rateType`: `INTRA_ZONE` if pickup zone === drop zone, else
   `INTER_ZONE`.
4. Looks up the matching `RateCard` row from Postgres, filtered by
   `orderType` (B2B/B2C), `rateType`, and the relevant zone(s). Rate cards are
   the single source of truth for pricing — nothing is hardcoded in
   frontend or backend code. If no active rate card matches, the engine
   throws a descriptive `400` rather than silently defaulting.
5. `baseCharge = ratePerKg × chargeableWeightKg`.
6. If `paymentType === COD`, adds a surcharge from `CodSurchargeConfig`
   (`flatFee + percentage% of baseCharge`), also admin-configurable per
   order type.
7. Returns a full breakdown (zones, weights, rate type, rate/kg, base
   charge, COD surcharge, total) — this is what the customer sees **before**
   confirming (`POST /api/orders/calculate-price`), and the exact same
   function is called again server-side at order creation so the persisted
   charge can never be spoofed by the client.

Because the engine only depends on `pickupZoneId`/`dropZoneId` (not raw
postcodes), it composes cleanly with the Zone Detection Service below.

## 2. Zone Detection Approach

`ZoneDetectionService` resolves an address to a zone via an admin-managed
`Area` table: `postcode → zoneId`. Admins map postcodes to zones through
`POST /api/areas`; end users never see or configure zone boundaries
directly, and the mapping is 100% data-driven.

At order-creation and price-preview time, both pickup and drop postcodes are
independently resolved to zone IDs. If a postcode has no mapping, the
request fails fast with a clear error asking an admin to map that area —
this is preferable to silently guessing a zone and mispricing a shipment.

The service's public contract already accepts an optional `coordinates`
parameter that is unused today. This is intentional: it lets a future
geocoding integration (e.g. Google Maps Geocoding API) resolve free-text
addresses to lat/lng, and then to a zone via reverse-geocoding or a
polygon/radius lookup, **without changing any caller** — order creation,
price preview, and agent assignment all call this service through the same
interface regardless of which resolution strategy is active behind it.

## 3. Auto-Assignment Logic

`AgentAssignmentService.findBestAgent` implements a two-tier strategy:

1. **Eligibility filter** — only agents with `isActive = true` and
   `isAvailable = true` are considered at all. Busy or deactivated agents
   are excluded before any distance math runs.
2. **Nearest-by-coordinates** — if the pickup point has lat/lng and at
   least one eligible agent has reported a current location, the engine
   computes haversine great-circle distance from each such agent to the
   pickup point and picks the minimum. This models "nearest available
   agent" directly rather than approximating it by zone.
3. **Same-zone fallback** — if no agent has a live location (common early
   in a rollout, before every agent's app is reporting GPS), the engine
   falls back to any eligible agent whose `currentZoneId` matches the
   order's pickup zone.
4. **No-agent case** — if neither strategy finds a candidate, the service
   throws a `409 Conflict` with a clear message rather than silently
   leaving the order unassigned; the admin can retry later or assign
   manually.

`assignAgentToOrder` wraps this in a transaction: it creates a new
`AgentAssignment` row (`ACTIVE`), marks any previous active assignment for
the order as `REASSIGNED` (never deleted or overwritten — full audit
trail), flips the chosen agent's `isAvailable` to `false`, and — if the
order was still `CREATED` — advances it to `ASSIGNED` with a corresponding
immutable `TrackingEvent`. Manual assignment (admin picks a specific agent)
and auto-assignment share this same function, differing only in whether
`agentId` is supplied.

## 4. Failed Delivery Handling

When an agent marks an order `FAILED` (`PATCH /api/orders/:id/status`), the
API: (a) transitions the order via the strict status state machine, writing
an immutable `TrackingEvent`; (b) creates a `Reschedule` row capturing the
failure reason; (c) frees the previously assigned agent
(`isAvailable = true`) while leaving their `AgentAssignment` row `ACTIVE`
until a new one supersedes it; (d) sends a customer notification.

The customer then calls `POST /api/orders/:id/reschedule` with a new date.
This is only permitted when the order's current status is `FAILED`
(enforced server-side, not just in the UI). The system records a new
`Reschedule` entry, transitions the order to `RESCHEDULED` with its own
tracking event, sends a "rescheduled" notification, and immediately
re-invokes `assignAgentToOrder` — which marks the old assignment
`REASSIGNED` and creates a fresh `ACTIVE` one, then sends a "reassigned"
notification naming the new agent. If no agent is available at that moment,
the reschedule still succeeds (the order sits at `RESCHEDULED` /
unassigned) and an admin can retry assignment later — a transient shortage
of agents never blocks the customer's ability to request a new date.

Throughout, `TrackingEvent` rows are append-only: the `Order.status` column
is the only mutable pointer to "current state," while every state it has
ever held remains permanently queryable for support, audits, and the
customer-facing tracking timeline.
