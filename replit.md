# WhatsApp Commerce Control Panel

A multi-tenant WhatsApp commerce platform. One operator manages many vendors;
vendors interact with the system entirely through WhatsApp (no vendor dashboard).

## Architecture

This is a pnpm monorepo with three artifacts:

- `artifacts/control-panel` — React + Vite admin UI (mounted at `/`).
- `artifacts/api-server` — Express 5 backend (mounted at `/api`).
- `artifacts/mockup-sandbox` — design canvas (auto-generated, not used for production).

Shared libraries:

- `lib/api-spec` — OpenAPI 3 contract (`openapi.yaml`).
- `lib/api-zod` — generated Zod schemas + types from OpenAPI.
- `lib/api-client-react` — generated TanStack Query hooks.
- `lib/db` — Drizzle ORM schema, exports `db` and `pool`. Tables:
  `vendors`, `menu_items`, `orders`, `conversations`, `messages`,
  `customers`, `payments`.

## Bot

`artifacts/api-server/src/lib/bot.ts` handles incoming customer messages.
Recognized intents: greeting, menu, order (parses `order <item> x<qty>`),
paid (marks the latest confirmed order as paid), agent (hands over to a
human and pauses bot replies for that conversation), help.

The webhook lives at `POST /api/webhook/whatsapp` and routes by the `to`
field to the matching vendor's WhatsApp number. The simulator endpoint
`POST /api/simulator/incoming` is the same flow but selects vendor by id.

When the operator confirms an order in the UI, the bot sends payment
instructions (with the vendor's bank info) into the customer's chat.
When the operator marks an order paid, a payment row is recorded and the
customer's lifetime totals are bumped.

## Plans

- **Starter**: bot, menu, orders, manual bank-transfer payments.
- **Pro**: adds analytics (per-vendor) and customer memory views.

The Pro/Starter gating is enforced in the UI on the analytics and
customers pages.

## Local development

- Frontend dev: workflow `artifacts/control-panel: web` (Vite, port from `PORT`).
- Backend dev: workflow `artifacts/api-server: API Server` (Express, port 8080).
- DB push: `pnpm --filter @workspace/db run push`.
- Seed: `pnpm --filter @workspace/scripts run seed` (idempotent — skips if data exists).
- API regen after spec changes: `pnpm --filter @workspace/api-spec run codegen`.

## Conventions

- Money is stored as `numeric(12,2)` strings in Postgres; serializers convert
  to numbers for the API. Display uses each vendor's `currency`.
- No emojis in UI copy.
- All routes validate with `safeParse` from `@workspace/api-zod`.
