# GM Store

A digital-goods marketplace for game accounts and online game keys — React (Vite) + Tailwind
frontend, Flask (Blueprints) + SQLAlchemy + MySQL backend, JWT auth, and a companion Telegram
storefront bot. Built as an academic/portfolio demo with pragmatic (not enterprise-grade) security.

Full design rationale, schema, and API design live in [PLANNING.md](PLANNING.md).

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 19 (Vite) · Tailwind CSS 4 · React Router v7 · Axios · Socket.IO client |
| Backend | Flask 3 (Blueprints) · SQLAlchemy · Flask-Migrate (Alembic) · Flask-JWT-Extended · Flask-Mail |
| Database | MySQL 8 |
| Payments | ABA PayWay / Bakong KHQR, behind a `PAYMENT_PROVIDER=mock\|bakong` switch |
| Messaging | Telegram Bot API (storefront bot + admin notification/relay bot) |
| Crypto | Fernet (stock credentials encrypted at rest) |

## Features

**Storefront**
- Catalog with derived status buckets — Best Sale / Coming Soon / Sold Out — plus genre/platform
  taxonomy, categories, and search
- Cart, checkout (KHQR / ABA PAY / card / wallet), promo/discount codes
- On-demand purchasing — buyers can order at 0 stock; availability is an admin-controlled manual
  flag (`is_available`), never a live stock count
- Reviews, favorites, pre-orders (coming-soon notify-on-release), contact form, live chat widget
- Wallet — top-up via KHQR, balance, spend at checkout

**Delivery model**
- Payment never auto-reveals credentials. A paid order sits in **Pending Delivery**; an admin
  resolves each line item by picking an existing stock item or typing in freshly-sourced
  credentials, in one action. The order flips to **Fulfilled**, the buyer sees revealed
  credentials in Purchase History, and a delivery email (+ Telegram message, for bot users) fires
  automatically.

**Admin panel**
- Full CRUD over catalog, categories, stock, orders (deliver/refund), users, wallets, promo
  codes, contact messages, reviews, live chat — plus a stats dashboard

**Telegram bot** (`@autosale16_bot`)
- Mirrors the storefront: browse, cart, checkout, payment, admin delivery relay — kept in sync
  with the website's availability rules (manual flag, not stock count)

## Repo layout

```
backend/
  blueprints/        REST endpoints, grouped by resource (admin/* for admin-only routes)
  models/            SQLAlchemy models
  services/          Business logic (order, promo, wallet, mail, inventory, OTP, PayWay)
  migrations/        Alembic migration history
  telegram_bot.py    Standalone bot process (run alongside the Flask app)
  app.py             Flask app factory + background scheduler jobs
frontend/
  src/pages/         Route-level pages (public, account/*, admin/*)
  src/context/       Auth/Cart/Toast React contexts
  src/api/           Axios client + endpoint definitions
```

## Local setup

Prerequisites: Python 3.11+, Node 18+, MySQL 8 running locally.

### 1. Database
```sql
CREATE DATABASE IF NOT EXISTS gmstore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend
```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # or: source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env           # then fill in DATABASE_URL, MAIL_*, etc. — see below
flask db upgrade                # applies all migrations
python app.py                   # runs on http://localhost:5000
```
Health check: `GET http://localhost:5000/api/v1/health`

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                     # runs on http://localhost:5173, proxies /api/* to Flask
```

### 4. Telegram bot (optional)
```bash
cd backend
python telegram_bot.py
```
Requires `TELEGRAM_STORE_BOT_TOKEN` set in `.env`. Runs alongside the Flask app, sharing the same
app config and database.

## Environment variables

See `backend/.env.example` for the minimal set. Full list read by `config.py`:

| Variable | Purpose |
|---|---|
| `SECRET_KEY`, `JWT_SECRET_KEY` | Flask/JWT signing keys — set real values outside dev |
| `DATABASE_URL` | MySQL connection string |
| `FERNET_KEY` | Encryption key for stock credentials at rest (derives a dev fallback from `SECRET_KEY` if unset — set a real one before going beyond local dev) |
| `PAYMENT_PROVIDER` | `mock` or `bakong` — build/test flows in `mock` first |
| `PAYWAY_API_KEY`, `BAKONG_TOKEN`, `BAKONG_ACCOUNT_ID` | ABA PayWay / Bakong KHQR credentials |
| `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_DEFAULT_SENDER` | SMTP for OTP/delivery/contact emails |
| `ADMIN_EMAIL` | Where admin notifications (new paid order, contact form) are sent |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Admin notification bot |
| `TELEGRAM_STORE_BOT_TOKEN` | Storefront bot (`@autosale16_bot`) |
| `GOOGLE_CLIENT_ID` | Google Sign-In audience verification |
| `FRONTEND_ORIGIN` | CORS allow-origin for the API |

## Conventions

- DB: snake_case, plural table names, UTC timestamps
- API: REST under `/api/v1`, JSON only, JWT access token (header) + httpOnly refresh cookie
- Money/stock mutations happen server-side inside transactions — the frontend never supplies a
  price, discount, or delivery outcome; it only displays what the backend computed
- Categories (Best Sale / Coming Soon / Sold Out) are derived states, not manual tags — see
  `PLANNING.md` §1 and §4.4

## Branching

- `main` — always deployable
- `utility` — staging branch for small maintenance fixes; PR into `main` periodically
- `feature/*` / `fix/*` — larger features or bugs get their own branch off `main` or `utility`,
  PR'd back in when done

## Known gaps / roadmap

- No automated test suite (backend or frontend) and no CI — the highest-priority gap given the
  size of the codebase
- No rate-limiting on login, OTP resend, or promo-code attempts
- Telegram bot doesn't support pre-order/coming-soon purchasing (website-only feature currently)
- No production deployment story (Docker/reverse-proxy/process manager) — dev servers only, by
  design for the current demo scope
