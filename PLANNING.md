# GM Store — Planning & Data Flow

> Marketplace for **game accounts** and **online games**.
> Stack: **React + Tailwind** (frontend) · **Flask** (backend API) · **MySQL** (database).
> Scope: academic / portfolio demo. Real OTP email, ABA PayWay (sandbox/mockable), pragmatic security.
> Payment: **ABA PayWay / KHQR**. Delivery: **auto-reveal from inventory**.

---

## 1. Product Overview

GM Store sells two kinds of digital goods:
- **Game accounts** — a pre-loaded account (login + password / recovery info), delivered from stock.
- **Online games** — a game key / activation code, delivered from stock.

Both are modeled the same way: a **product** with a pool of **stock items** (credentials/keys). When an order is paid, one stock item is atomically assigned to the buyer and revealed in their Purchase History.

### Site map
| Public | Auth required |
|--------|---------------|
| Home | Profile (edit) |
| Category: Best Sale | Purchase History tab |
| Category: Coming Soon | Favorites |
| Category: Sold Out | Reviews (write) |
| Contact | Pre-orders |
| Product detail | Cart → Checkout → Payment |
| Register / Login / OTP verify | |
| | **Admin panel** (full CRUD) |

### Categories are *statuses*, not taxonomy
"Best Sale", "Coming Soon", "Sold Out" are **derived states** of a product, not a genre. This keeps a product in exactly the right bucket automatically:

- **Coming Soon** — `status = 'coming_soon'` (release_date in future, no stock sold yet). Supports **pre-order**.
- **Sold Out** — `stock_available = 0` and `status = 'active'`.
- **Best Sale** — top products by `sold_count` over a window (e.g. last 30 days) OR a manual `is_featured` flag.

A separate `genre`/`platform` field (PUBG, Free Fire, Steam, Mobile Legends, etc.) is real taxonomy for filtering/search.

---

## 2. Architecture

```
┌─────────────────────┐        HTTPS / JSON        ┌──────────────────────────┐
│   React SPA (Vite)  │  ───────────────────────►  │   Flask REST API         │
│   Tailwind CSS      │  ◄───────────────────────  │   (Blueprints + JWT)     │
│   React Router      │        JWT in header       │                          │
│   Axios + Context   │                            │  Services layer          │
└─────────────────────┘                            │   - auth / otp           │
        │                                          │   - catalog              │
        │ redirect to PayWay / show KHQR           │   - cart / orders        │
        ▼                                          │   - payment (PayWay)     │
┌─────────────────────┐   webhook (server→server)  │   - inventory / delivery │
│  ABA PayWay / KHQR  │  ───────────────────────►  │   - reviews / favorites  │
└─────────────────────┘                            └──────────┬───────────────┘
                                                               │ SQLAlchemy ORM
                                                               ▼
                                                     ┌──────────────────┐
                                                     │   MySQL 8        │
                                                     └──────────────────┘
                                          SMTP (OTP + credential delivery emails)
```

**Key principles**
- Backend is a **stateless JSON API**. No server-rendered HTML except the PayWay callback endpoints.
- Auth via **JWT access token** (short-lived) + **refresh token** (httpOnly cookie).
- All money/stock state changes happen **server-side inside DB transactions**. The frontend never decides that an order is paid — only the PayWay webhook + verified transaction does.
- **Roles**: `customer`, `admin`.

---

## 3. Tech Stack (concrete)

### Frontend
- **Vite + React 18**, JavaScript (or TS if you prefer)
- **Tailwind CSS** + a small component set (buttons, cards, modals, toasts)
- **React Router v6** for routing, **Axios** for HTTP (with interceptors for JWT refresh)
- **React Context** (or Zustand) for `AuthContext` and `CartContext`
- **react-hook-form** for forms, **zod** for validation (optional)

### Backend
- **Flask** + **Blueprints** (modular routes)
- **Flask-SQLAlchemy** (ORM) + **Flask-Migrate** (Alembic migrations)
- **Flask-JWT-Extended** (access/refresh tokens)
- **Flask-CORS**
- **Flask-Mail** (or plain `smtplib`) for OTP + delivery emails
- **Marshmallow** or Pydantic for request/response schemas
- **passlib[bcrypt]** for password hashing
- **requests** for PayWay server-to-server calls
- **APScheduler** (or a simple cron) to expire OTPs / release stale carts / flip Coming Soon → active on release_date

### Database
- **MySQL 8**, InnoDB (needed for transactions + row locking on stock)

---

## 4. Database Schema (MySQL)

> Naming: `snake_case`, plural tables, UTC timestamps, soft-delete via `deleted_at` where useful.

### 4.1 users
| column | type | notes |
|--------|------|-------|
| id | BIGINT PK AI | |
| email | VARCHAR(255) UNIQUE | login identity |
| password_hash | VARCHAR(255) | bcrypt |
| full_name | VARCHAR(120) | |
| phone | VARCHAR(30) | optional |
| avatar_url | VARCHAR(500) | optional |
| role | ENUM('customer','admin') | default 'customer' |
| is_verified | BOOLEAN | false until OTP passed |
| created_at / updated_at | DATETIME | |

### 4.2 otp_codes
| column | type | notes |
|--------|------|-------|
| id | BIGINT PK | |
| user_id | FK → users | |
| code_hash | VARCHAR(255) | store **hashed** 6-digit code, not plaintext |
| purpose | ENUM('register','reset_password') | |
| expires_at | DATETIME | e.g. now + 10 min |
| consumed_at | DATETIME NULL | one-time use |
| attempts | INT | lock after N failures |

### 4.3 categories  *(taxonomy: platform/genre — optional but useful)*
| id | name | slug | icon_url |

### 4.4 products
| column | type | notes |
|--------|------|-------|
| id | BIGINT PK | |
| title | VARCHAR(200) | |
| slug | VARCHAR(220) UNIQUE | |
| description | TEXT | |
| product_type | ENUM('account','game_key') | |
| category_id | FK → categories NULL | genre/platform |
| price | DECIMAL(10,2) | current price |
| compare_at_price | DECIMAL(10,2) NULL | for "sale" strikethrough |
| currency | CHAR(3) | default 'USD' |
| status | ENUM('draft','coming_soon','active','archived') | |
| release_date | DATETIME NULL | for Coming Soon |
| is_featured | BOOLEAN | manual Best Sale override |
| sold_count | INT | denormalized, for Best Sale ranking |
| rating_avg | DECIMAL(3,2) | denormalized from reviews |
| rating_count | INT | |
| created_at / updated_at / deleted_at | | |

> **Derived category logic (computed, not stored):**
> - Sold Out = `status='active'` AND `available_stock = 0`
> - Coming Soon = `status='coming_soon'`
> - Best Sale = `is_featured=1` OR top-N by `sold_count`

### 4.5 product_images
| id | product_id FK | url | sort_order | is_primary |

### 4.6 stock_items  *(the deliverable inventory — this is the money table)*
| column | type | notes |
|--------|------|-------|
| id | BIGINT PK | |
| product_id | FK → products | |
| secret_payload | TEXT (encrypted) | login/password or game key — **encrypt at rest** |
| status | ENUM('available','reserved','sold') | |
| order_id | FK → orders NULL | set when sold |
| reserved_until | DATETIME NULL | during checkout hold |
| created_at | | |

> `available_stock` for a product = `COUNT(stock_items WHERE status='available')`.
> Delivery = flip one row `available → sold`, attach `order_id`, decrypt & show to buyer.

### 4.7 carts / cart_items
**carts**: `id, user_id FK, status ENUM('active','converted','abandoned'), created_at`
**cart_items**: `id, cart_id FK, product_id FK, unit_price (snapshot), qty, created_at`
> Qty is usually 1 for accounts (each is unique). Games keys can be qty > 1.

### 4.8 orders
| column | type | notes |
|--------|------|-------|
| id | BIGINT PK | |
| order_number | VARCHAR(30) UNIQUE | human-readable e.g. GM-2026-000123 |
| user_id | FK → users | |
| status | ENUM('pending_payment','paid','fulfilled','cancelled','refunded','failed') | |
| subtotal / discount / total | DECIMAL(10,2) | |
| currency | CHAR(3) | |
| is_preorder | BOOLEAN | |
| created_at / paid_at / fulfilled_at | | |

### 4.9 order_items
| id | order_id FK | product_id FK | title_snapshot | unit_price | qty | stock_item_id FK NULL |
> `stock_item_id` links to the exact delivered credential once fulfilled.

### 4.10 payments
| column | type | notes |
|--------|------|-------|
| id | BIGINT PK | |
| order_id | FK → orders | |
| provider | ENUM('payway','mock') | |
| method | ENUM('khqr','card','abapay') | |
| provider_txn_id | VARCHAR(100) | PayWay transaction ref |
| amount | DECIMAL(10,2) | |
| status | ENUM('created','pending','success','failed','refunded') | |
| raw_response | JSON | audit of gateway callbacks |
| created_at / updated_at | | |

### 4.11 reviews
| id | product_id FK | user_id FK | rating TINYINT(1-5) | comment TEXT | is_verified_purchase BOOL | created_at |
> UNIQUE(product_id, user_id) — one review per user per product. Optionally require ownership.

### 4.12 favorites (wishlist)
| id | user_id FK | product_id FK | created_at | UNIQUE(user_id, product_id) |

### 4.13 preorders
| id | user_id FK | product_id FK | status ENUM('waiting','notified','converted','cancelled') | created_at |
> When a Coming Soon product goes `active`, notify waiting pre-orderers (email) and optionally auto-create a discounted order.

### 4.14 Entity relationships (text ER)
```
users 1──* orders 1──* order_items *──1 products 1──* stock_items
users 1──1 carts 1──* cart_items *──1 products 1──* product_images
users 1──* reviews *──1 products
users 1──* favorites *──1 products
users 1──* preorders *──1 products
users 1──* otp_codes
orders 1──* payments
```

---

## 5. REST API (Flask Blueprints)

Base URL: `/api/v1`. All list endpoints support `?page=&limit=&sort=&q=`.

### Auth  `/auth`
| Method | Path | Body / notes | Auth |
|--------|------|--------------|------|
| POST | `/register` | email, password, full_name → creates unverified user, sends OTP | – |
| POST | `/verify-otp` | email, code → marks verified, returns tokens | – |
| POST | `/resend-otp` | email (rate-limited) | – |
| POST | `/login` | email, password → tokens (blocked if unverified) | – |
| POST | `/refresh` | refresh cookie → new access token | cookie |
| POST | `/logout` | revoke refresh | user |
| POST | `/forgot-password` | email → OTP | – |
| POST | `/reset-password` | email, code, new_password | – |

### Users / Profile  `/me`
| GET | `/me` | current profile | user |
| PATCH | `/me` | update name/phone/avatar | user |
| PATCH | `/me/password` | old + new password | user |
| GET | `/me/orders` | **Purchase History tab** | user |
| GET | `/me/orders/:id` | order detail + revealed credentials if fulfilled | user (owner) |
| GET | `/me/favorites` | list | user |
| GET | `/me/preorders` | list | user |

### Catalog  `/products` (public)
| GET | `/products` | filters: `?category=&type=&min=&max=&q=&sort=` | – |
| GET | `/products/best-sale` | Best Sale list | – |
| GET | `/products/coming-soon` | Coming Soon list | – |
| GET | `/products/sold-out` | Sold Out list | – |
| GET | `/products/:slug` | detail + images + reviews + available_stock | – |
| GET | `/products/:id/reviews` | paginated reviews | – |

### Engagement (auth)
| POST | `/products/:id/favorite` / DELETE | toggle wishlist | user |
| POST | `/products/:id/reviews` | rating + comment (verified purchase check) | user |
| POST | `/products/:id/preorder` / DELETE | pre-order Coming Soon | user |

### Cart  `/cart` (auth)
| GET | `/cart` | current cart | user |
| POST | `/cart/items` | product_id, qty → reserves stock check | user |
| PATCH | `/cart/items/:id` | qty | user |
| DELETE | `/cart/items/:id` | remove | user |

### Checkout & Payment  `/checkout` (auth)
| POST | `/checkout` | creates **order (pending_payment)**, reserves stock, returns PayWay params / KHQR string | user |
| GET | `/orders/:id/payment-status` | poll status (frontend polls while KHQR shown) | user |
| POST | `/payment/payway/callback` | **server-to-server webhook** from PayWay → verifies signature, marks paid, triggers delivery | PayWay (HMAC) |
| POST | `/payment/mock/pay` | dev-only: simulate success | user (dev) |

### Admin CRUD  `/admin` (role=admin)
| Products | GET/POST/PATCH/DELETE `/admin/products` | full CRUD + image upload |
| Stock | POST `/admin/products/:id/stock` (bulk add keys/accounts), GET/DELETE | inventory |
| Orders | GET `/admin/orders`, PATCH status, refund | manage orders |
| Users | GET `/admin/users`, PATCH role/ban | manage users |
| Reviews | GET/DELETE `/admin/reviews` | moderation |
| Dashboard | GET `/admin/stats` | sales, top products, low stock |

---

## 6. Core Data Flows

### 6.1 Registration + OTP
```
User submits email/password
  → POST /auth/register
  → create user (is_verified=false), hash password
  → generate 6-digit code, store code_hash + expires_at (10 min)
  → send OTP email (Flask-Mail / SMTP)
  → respond 201 "check your email"

User enters code
  → POST /auth/verify-otp
  → compare hash, check not expired / not consumed / attempts < 5
  → set is_verified=true, consume OTP
  → issue access + refresh tokens
  → frontend stores access token in memory, refresh in httpOnly cookie
```
**Guards:** login refused until `is_verified`. Resend rate-limited (e.g. 1/60s, 5/hour). OTP hashed at rest.

### 6.2 Browse → Product detail
```
Home loads: /products/best-sale + /products/coming-soon + newest
Category pages call the matching endpoint.
Product detail: /products/:slug → images, price, available_stock,
   reviews, "Favorite", "Add to cart" (or "Pre-order" if coming_soon).
```

### 6.3 Cart → Checkout → Payment (PayWay / KHQR) → Delivery  ⭐ critical path
```
1. Add to cart (POST /cart/items)
     - soft-check available_stock; do NOT reserve yet.

2. Checkout (POST /checkout)   ── DB TRANSACTION ──
     a. Re-validate prices & stock
     b. For each item: SELECT ... FOR UPDATE an available stock_item,
        set status='reserved', reserved_until = now+15min
     c. Create order (pending_payment) + order_items linked to reserved stock
     d. Create payment (provider=payway, status=created)
     e. Call PayWay: create transaction / generate KHQR string
     f. Return { order_number, khqr_payload, deeplink, amount } to frontend
   ── COMMIT ──

3. Frontend shows KHQR (QR code) + a countdown; polls
   GET /orders/:id/payment-status every ~3s.

4. User pays in bank app. PayWay calls our webhook:
   POST /payment/payway/callback   ── DB TRANSACTION ──
     a. Verify HMAC signature + amount + txn id (server-side, trust this only)
     b. payment.status='success', order.status='paid', paid_at=now
     c. DELIVERY: for each reserved stock_item → status='sold', attach order_id
     d. order.status='fulfilled', fulfilled_at=now
     e. products.sold_count += qty ; recompute available_stock
     f. Send credential-delivery email
   ── COMMIT ──

5. Poll now returns 'fulfilled' → frontend redirects to
   Purchase History / order detail, which reveals decrypted credentials.

TIMEOUT PATH: APScheduler job releases reserved stock whose
   reserved_until has passed and order still pending_payment →
   stock back to 'available', order → 'failed'/'cancelled'.
```
> **Demo/mock mode:** if `PAYMENT_PROVIDER=mock`, step 2e is skipped and a `POST /payment/mock/pay` (or an auto-success toggle) drives the same webhook logic — so the entire flow works with zero real bank setup, and switching to real PayWay is a config change.

### 6.4 Pre-order (Coming Soon)
```
Coming Soon product → "Pre-order" button → POST /products/:id/preorder
   → row in preorders (status='waiting')
When admin sets product active (or release_date passes via scheduler):
   → notify waiting users (email), status='notified'
   → user can now checkout normally.
```

### 6.5 Review & Favorite
```
Favorite: toggle POST/DELETE → favorites table → shows on /me/favorites.
Review: POST /products/:id/reviews
   → require is_verified_purchase (user has a fulfilled order_item for it)
   → insert review, recompute products.rating_avg / rating_count.
```

### 6.6 Admin CRUD
```
Product lifecycle: draft → coming_soon → active → archived
Admin creates product → uploads images → bulk-adds stock_items (paste keys/accounts)
Stock auto-drives Sold Out. sold_count auto-drives Best Sale.
Orders view: see status, manually refund (stock stays sold, payment→refunded).
```

---

## 7. Frontend Structure (React + Tailwind)

```
src/
├── main.jsx
├── App.jsx                      # routes
├── api/
│   ├── client.js                # axios + JWT interceptors (auto-refresh)
│   └── endpoints.js
├── context/
│   ├── AuthContext.jsx
│   └── CartContext.jsx
├── components/
│   ├── layout/ (Navbar, Footer, Container)
│   ├── ui/ (Button, Card, Modal, Toast, Badge, Rating, Spinner)
│   ├── product/ (ProductCard, ProductGrid, PriceTag, StatusBadge)
│   └── forms/ (Input, OTPInput, ...)
├── pages/
│   ├── Home.jsx
│   ├── BestSale.jsx  ComingSoon.jsx  SoldOut.jsx
│   ├── Contact.jsx
│   ├── ProductDetail.jsx
│   ├── auth/ (Register.jsx, VerifyOtp.jsx, Login.jsx, ForgotPassword.jsx)
│   ├── Cart.jsx  Checkout.jsx  PaymentKhqr.jsx  OrderSuccess.jsx
│   ├── account/ (Profile.jsx, PurchaseHistory.jsx, Favorites.jsx, Preorders.jsx)
│   └── admin/ (Dashboard, Products, ProductForm, Stock, Orders, Users, Reviews)
├── routes/ (ProtectedRoute.jsx, AdminRoute.jsx)
└── styles/ (tailwind index.css, theme tokens)
```

**Design direction (modern, clean):** dark-first palette with a neon/game accent (e.g. slate‑900 base + violet/emerald accent), rounded‑2xl cards, soft shadows, generous spacing, skeleton loaders, status badges (Coming Soon = amber, Sold Out = red/muted, Best Sale = gradient). Fully responsive grid.

---

## 8. Backend Structure (Flask)

```
backend/
├── app.py                  # app factory, blueprint registration
├── config.py               # env config (DB, JWT, SMTP, PayWay keys, PAYMENT_PROVIDER)
├── extensions.py           # db, migrate, jwt, mail, cors
├── models/                 # SQLAlchemy models (one file per group)
├── schemas/                # Marshmallow schemas (validation/serialization)
├── blueprints/
│   ├── auth.py  otp.py
│   ├── products.py  reviews.py  favorites.py  preorders.py
│   ├── cart.py  checkout.py  payment_payway.py
│   ├── me.py
│   └── admin/ (products.py, stock.py, orders.py, users.py, stats.py)
├── services/
│   ├── auth_service.py  otp_service.py  mail_service.py
│   ├── order_service.py  inventory_service.py  delivery_service.py
│   └── payway_service.py     # build request, verify HMAC callback, KHQR
├── utils/ (security.py [encrypt secret_payload], decorators [role_required])
├── migrations/             # Alembic
└── requirements.txt
```

**Security notes (demo-pragmatic):**
- Passwords: bcrypt. OTP: hashed + expiry + attempt lock.
- `stock_items.secret_payload` encrypted at rest (Fernet/AES key in env).
- Stock assignment uses `SELECT ... FOR UPDATE` inside a transaction to prevent double-selling.
- PayWay callback trusted **only** after HMAC verification; never trust frontend for "paid".
- JWT: short access + httpOnly refresh; `role_required('admin')` on admin routes.
- CORS locked to frontend origin. Basic rate limiting on auth/OTP endpoints.

---

## 9. ABA PayWay / KHQR Integration (summary)

- Use PayWay's **purchase / create transaction** API. Server builds request with `merchant_id`, `tran_id` (= our order_number), `amount`, `items`, and an **HMAC hash** of the payload signed with the API secret.
- Two UX options: **KHQR** (render QR string returned by PayWay; user scans in any bank app) or **ABA PAY deeplink**. Plan uses KHQR + status polling.
- **Return/continue URL** (browser) is cosmetic; the **pushback/callback URL** (server-to-server) is the source of truth — it delivers final status; we verify its HMAC before marking paid.
- Config-switch `PAYMENT_PROVIDER=mock|payway` so the whole flow is demoable without live credentials, then flips to sandbox, then production.

> Exact field names/endpoints come from the PayWay merchant docs/sandbox you'll get with a merchant account — the service layer (`payway_service.py`) isolates all of that so nothing else changes.

---

## 10. Build Order (phased — hand these to the Sonnet build session)

**Phase 0 — Scaffold**
1. Vite+React+Tailwind app; Flask app factory + config + extensions; MySQL connection; CORS. "Hello" endpoint reachable from React.

**Phase 1 — Auth + OTP**
2. users + otp_codes models & migrations. Register → OTP email → verify → login → JWT refresh. `AuthContext`, Register/VerifyOtp/Login pages, ProtectedRoute.

**Phase 2 — Catalog (read) + Admin CRUD (write)**
3. products, product_images, stock_items, categories. Admin product CRUD + stock bulk-add. Public listing + detail + the 3 category endpoints. Home + category + detail pages. StatusBadge logic.

**Phase 3 — Engagement**
4. Favorites, reviews (verified purchase), pre-orders. Account pages: Favorites, Preorders. Review UI on detail.

**Phase 4 — Cart → Checkout → Payment → Delivery**
5. cart/cart_items, orders/order_items, payments. Checkout transaction with stock reservation. PayWay service in **mock mode** first → KHQR page + polling → webhook → auto-delivery → Purchase History reveal. Reservation-timeout scheduler.

**Phase 5 — Profile, history, polish**
6. Profile edit + change password. Purchase History tab with revealed credentials. Admin dashboard stats. Contact page (stores message / emails admin). Empty states, skeletons, toasts, responsive pass.

**Phase 6 — Swap payment to PayWay sandbox**
7. Flip `PAYMENT_PROVIDER=payway`, wire real sandbox keys, verify callback HMAC end-to-end.

---

## 11. Open Items / Assumptions
- Currency assumed **USD** (KHQR supports USD & KHR — configurable).
- One review per user per product; reviews require a fulfilled purchase.
- Account-type products are qty 1 (unique); game keys may allow qty > 1.
- Contact page stores messages in a small `contact_messages` table and/or emails admin.
- File uploads (product images, avatar): local `/uploads` folder for demo (swap to S3/Cloud later).
- Email delivery of credentials is a convenience copy; the canonical reveal is in Purchase History.
