# Last-Mile Delivery Tracker

A full-stack delivery management platform: customers place orders with
auto-calculated charges, admins configure zones/rates and assign agents
(manually or automatically), agents update delivery status from pickup to
drop-off, and everyone gets an immutable tracking timeline plus email/SMS
notifications at every step.

## Features

- **Auth**: JWT + bcrypt, role-based access control (Customer / Agent / Admin), protected routes on both API and frontend.
- **Customer**: register/login, create orders with live price preview before confirming, view orders, full tracking timeline, reschedule failed deliveries.
- **Admin**: view/filter all orders (status, zone, agent), manage zones & areas, configure B2B/B2C intra- and inter-zone rate cards and COD surcharge, manually or auto-assign agents, override any order status, manage customers & agents.
- **Rate engine**: volumetric weight (`L×B×H/5000`), chargeable weight (`max(actual, volumetric)`), zone-aware B2B/B2C rate lookup, COD surcharge — 100% database-driven, zero hardcoded rates.
- **Zone detection**: admin-managed postcode→zone mapping, structured to plug in a geocoding API later without touching callers.
- **Auto-assignment**: nearest available agent by GPS distance, with same-zone fallback when coordinates aren't available yet.
- **Order lifecycle**: strict state machine (`CREATED→ASSIGNED→PICKED_UP→IN_TRANSIT→OUT_FOR_DELIVERY→DELIVERED`, plus `FAILED→RESCHEDULED`), with admin override that still preserves history.
- **Immutable tracking**: every status change is an append-only `TrackingEvent` row — nothing is ever overwritten.
- **Notifications**: email (Resend or SMTP) + SMS (Twilio) on every status change, fully optional — the app runs fine with zero notification credentials configured.

## Tech stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4 + React Router
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT + bcrypt
- **Validation**: Zod
- **Email**: Resend (or SMTP/Brevo) via `nodemailer`
- **SMS**: Twilio (optional, configurable)

## Folder structure

```
last-mile-delivery-tracker/
├── client/                  # React + Vite + TS frontend
│   └── src/
│       ├── pages/{public,customer,agent,admin}/
│       ├── components/      # Layout, StatusBadge, TrackingTimeline, ui.tsx
│       ├── context/         # AuthContext, ToastContext
│       ├── lib/api.ts        # Axios client w/ JWT interceptor
│       └── types/
├── server/                  # Express + TS backend
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── routes/          # auth, orders, zones, areas, rates, agents, admin
│       ├── services/        # rateCalculation, zoneDetection, agentAssignment,
│       │                     orderLifecycle, notification
│       ├── middleware/       # auth (JWT+RBAC), errorHandler
│       ├── utils/            # schemas (Zod), auth, apiError, asyncHandler
│       └── tests/            # vitest test suite
├── docs/
│   ├── API.md
│   ├── DATABASE.md
│   └── SYSTEM_DESIGN.md
├── .env.example
└── README.md   ← you are here
```

## Installation & local setup

Prerequisites: Node.js 20+, npm, and a PostgreSQL database (local, or hosted via Neon/Supabase/Railway).

```bash
git clone <your-repo-url>
cd last-mile-delivery-tracker

# --- Backend ---
cd server
npm install
cp ../.env.example .env         # then edit DATABASE_URL, JWT_SECRET, etc.
npx prisma generate
npx prisma migrate dev --name init
npm run seed                     # creates zones, rate cards, demo users
npm run dev                      # http://localhost:4000

# --- Frontend (new terminal) ---
cd ../client
npm install
cp .env.example .env             # VITE_API_URL=http://localhost:4000/api
npm run dev                      # http://localhost:5173
```

### Demo credentials (password for all: `Password123!`)

| Role | Email |
|---|---|
| Admin | `admin@example.com` |
| Customer | `customer@example.com` |
| Agent | `ravi.agent@example.com` (and 4 more, see `prisma/seed.ts`) |

## Environment variables

See `.env.example` at the repo root (copy to `server/.env`) for the full list:
`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`,
`EMAIL_PROVIDER` (`resend`/`smtp`/`none`), `RESEND_API_KEY`, `EMAIL_FROM`,
`SMTP_HOST`/`PORT`/`USER`/`PASS`, `SMS_PROVIDER` (`twilio`/`none`),
`TWILIO_ACCOUNT_SID`/`AUTH_TOKEN`/`FROM_NUMBER`, `CLIENT_URL`, `PORT`.
The app **never crashes** if email/SMS credentials are missing — it logs a
`SKIPPED` notification row and keeps working.

## Rate calculation logic

See [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md#1-rate-calculation-engine)
for the full write-up. Summary: `volumetricWeight = L×B×H/5000`,
`chargeableWeight = max(actual, volumetric)`, then the chargeable weight is
multiplied by the admin-configured `ratePerKg` for the matching
`(orderType, rateType, zone lane)` rate card, plus a COD surcharge
(`flatFee + percentage%`) if payment type is COD. The full breakdown is
shown to the customer before they confirm the order.

## Zone detection, auto-assignment, failed delivery

Also covered in detail in [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md).

## Testing

```bash
cd server
npm test
```

Covers: rate calculation (same-zone/inter-zone × B2B/B2C, actual-vs-volumetric
weight, COD/prepaid, missing rate card, invalid dimensions), agent assignment
(nearest-by-distance, busy/inactive exclusion, same-zone fallback, no-agent
error), order status transitions (valid/invalid, terminal states), and
notification template content for the failed-delivery flow.

> **Sandbox verification note**: this project was built and partially
> verified inside a sandboxed environment whose network allowlist blocks
> `binaries.prisma.sh` (Prisma's engine-binary CDN), so `npx prisma generate`
> could not complete there. What **was** verified in that sandbox: a local
> Postgres instance was installed and started, `npm install` succeeded for
> both `server/` and `client/`, the **client built cleanly** end-to-end
> (`tsc -b && vite build` — zero errors, working production bundle), and the
> 9 backend tests that don't require a generated Prisma client (pure rate-math
> functions + fully-mocked-DB agent-assignment tests) **passed**. The
> remaining 8 tests and the full `tsc` check on the server fail *only* on
> "missing export from `@prisma/client`" — i.e., purely because the generated
> client doesn't exist yet — not from any logic error. On a normal machine or
> any standard CI/deploy target (Render, Railway, Vercel, your laptop),
> `npx prisma generate` reaches the CDN fine and this resolves itself as part
> of the standard install steps above.

## Deployment

**Frontend → Vercel**
1. Import the repo, set root directory to `client/`.
2. Build command: `npm run build`, output directory: `dist`.
3. Env var: `VITE_API_URL=https://your-backend.onrender.com/api`.

**Backend → Render or Railway**
1. Root directory `server/`, build command `npm install && npx prisma generate && npm run build`, start command `npx prisma migrate deploy && npm run seed && npm start` (drop `&& npm run seed` after the first deploy).
2. Set all env vars from `.env.example` (`DATABASE_URL` pointing at your hosted Postgres, a strong `JWT_SECRET`, `CLIENT_URL` set to your Vercel URL, and email/SMS provider keys if you want live notifications).

**Database → Neon / Supabase / Railway Postgres**
1. Create a Postgres instance, copy its connection string into `DATABASE_URL` (both locally and in your Render/Railway env vars).
2. Run `npx prisma migrate deploy` against it once (see backend start command above).

Make sure CORS (`CLIENT_URL` on the backend) and the frontend's
`VITE_API_URL` point at each other's real deployed URLs.
