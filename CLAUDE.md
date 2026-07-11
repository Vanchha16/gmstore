# GM Store

Marketplace for game accounts and online games. Full planning, schema, API design, and
build order lives in [PLANNING.md](PLANNING.md) — **read it before writing any code.**

## Tech stack
- Frontend: React 18 (Vite) + Tailwind CSS + React Router v6 + Axios
- Backend: Flask (Blueprints) + SQLAlchemy + Flask-Migrate + Flask-JWT-Extended + Flask-Mail
- Database: MySQL 8

## Payment & delivery (decided — do not re-derive)
- Payment provider: **ABA PayWay / KHQR**, behind a `PAYMENT_PROVIDER=mock|payway` config switch.
  Build and test the entire flow in `mock` mode first; flip to `payway` only in the final phase.
- Delivery model: **auto-reveal from inventory** — each product has a pool of `stock_items`
  (encrypted credentials/keys). A paid order atomically claims one row and reveals it in
  Purchase History. Never trust the frontend to mark an order paid — only the payment
  webhook (HMAC-verified) does that, inside a DB transaction.

## Categories are derived, not manual tags
Coming Soon / Sold Out / Best Sale are computed from `products.status`, live stock counts,
and `sold_count` — see PLANNING.md §1 and §4.4. Don't add a manual "category" enum for these;
genre/platform is a separate taxonomy field.

## How to build this
Work **one phase at a time** from PLANNING.md §10 (Phase 0 → Phase 6). Don't attempt to
scaffold the whole app in one pass. After each phase, it should be runnable and testable
before moving to the next.

## Scope — important
Do not create, modify, or delete anything outside the `GMstore` folder. All files, config,
and commands must stay scoped to this project directory. Do not touch parent directories,
global/system config, or install anything system-wide.

## Conventions
- DB: snake_case, plural table names, UTC timestamps.
- API: REST under `/api/v1`, JSON only, JWT access token (header) + httpOnly refresh cookie.
- Money/stock mutations happen server-side inside transactions — never trust client state.
