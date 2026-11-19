# Shuka — Amazon-style marketplace for Armenia

Register, become a seller, list products with photos, buy from several sellers in one cart, pay cash on delivery.
One Node.js process serves the REST API, the built React app and uploaded images, and reads one SQLite file.

## Run locally (one command)

Requires Node.js 22+.

```bash
npm install && npm run dev
```

Open http://localhost:5173. The first start creates `data/shuka.db`, applies the migrations and seeds demo data.

| Demo account        | Password    | Role                         |
|---------------------|-------------|------------------------------|
| seller1@shuka.am    | shuka1234   | Seller "Ararat Electronics"  |
| seller2@shuka.am    | shuka1234   | Seller "Vernissage Crafts"   |
| seller3@shuka.am    | shuka1234   | Seller "Gyumri Goods"        |
| buyer1@shuka.am     | shuka1234   | Buyer                        |
| buyer2@shuka.am     | shuka1234   | Buyer                        |

Production-like run: `npm run build && npm start` → http://localhost:3000

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (auto-restart) + Vite dev server |
| `npm run build` | Build the React app into `client/dist` |
| `npm start` | Start the single server process |
| `npm run migrate` | Apply numbered `server/migrations/*.sql` files (also done on every start) |
| `npm run seed` | Seed an empty DB; `npm run seed -- --reset` wipes `data/` first |
| `npm run backup` | `VACUUM INTO data/backups/shuka-YYYY-MM-DD.db` (the server also does this daily in production, keeps 7) |
| `npm test` | Break-it tests on a fresh temporary server |
| `BASE_URL=https://… npm test` | Same HTTP tests against a live deployment |

## Break-it tests

`npm test` runs every test from the brief: last units (stock 3, 30 parallel checkouts → 3 orders, 27 × 409, stock 0),
double click, price changed, old order after edit, someone else's order, move not allowed, cancel returns stock,
foreign keys, bad upload (30 MB file and renamed .exe).

## How the hard parts are solved

| Problem | Where |
|---|---|
| Overselling | `server/routes/orders.js` — checkout in one `BEGIN IMMEDIATE` transaction, `UPDATE … SET stock = stock - ? WHERE id = ? AND stock >= ?`, changed rows checked, whole order rolled back with 409 |
| Database is locked | `server/db.js` — WAL, `busy_timeout = 5000`; image resizing happens outside transactions |
| Price changes | `order_items` copies title and unit price, `orders` copies the address; checkout stops with `PRICE_CHANGED` |
| One cart, many sellers | one `orders` row → one `seller_orders` row per seller, each with its own status |
| Status rules | `server/lib/orders.js` — allowed-move table, 409 otherwise, a `status_history` row per move (triggers make it insert-only) |
| Other people's data | every query is scoped (`WHERE id = ? AND seller_id = ?` / `buyer_id = ?`) → 404 |
| Double checkout | random `requestKey` from the page + `UNIQUE(request_key)` → the existing order is returned |
| Broken references | `PRAGMA foreign_keys = ON` on every connection, STRICT tables, products are unpublished, never deleted |
| Images | `server/lib/images.js` — type + 5 MB limit (multer), real decode check (sharp), 400 px thumb + 1200 px large WebP in `uploads/`, only the path in SQLite |

## Project layout

```
server/
  index.js            Express app: /api, /uploads, built frontend
  db.js config.js     SQLite connection + pragmas, paths, secrets
  migrate.js          numbered .sql migrations (PRAGMA user_version)
  seed.js backup.js
  migrations/001_init.sql   10 STRICT tables
  lib/                auth (bcrypt + signed httpOnly cookie), validation, images, order lifecycle, errors
  routes/             auth, catalog, cart, orders (checkout), seller
client/               React + Vite storefront and seller dashboard
tests/break-it.mjs
Dockerfile
```

## API

All endpoints live under `/api`. Errors: `{ "error": { "code", "message", "fields?" } }` with 400 / 401 / 403 / 404 / 409.

- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /me`, `PATCH /me`
- Catalog: `GET /categories`, `GET /products?q=&category=&minPrice=&maxPrice=&sort=newest|price_asc|price_desc|rating&page=`, `GET /products/:id`, `GET /products/:id/reviews`, `POST /products/:id/reviews`
- Cart: `GET /cart`, `PUT /cart/items/:productId`, `DELETE /cart/items/:productId`, `POST /cart/accept-prices`
- Orders: `POST /orders` (with `requestKey`), `GET /orders`, `GET /orders/:id`, `GET /orders/last-address`, `POST /orders/:id/sellers/:sellerOrderId/cancel`
- Seller: `POST /seller/activate`, `GET /seller/overview`, `GET|POST /seller/products`, `GET|PATCH /seller/products/:id`, `POST /seller/products/:id/images`, `DELETE /seller/products/:id/images/:imageId`, `GET /seller/orders?status=`, `GET /seller/orders/:id`, `POST /seller/orders/:id/status` with `{ "to": "shipped" }`

## Deploy (Railway, with a persistent volume)

1. Push this folder to a GitHub repository.
2. Railway → New Project → Deploy from GitHub repo. The `Dockerfile` is detected automatically.
3. Service → right-click → **Attach volume**, mount path **`/data`** (database, uploads and backups live there).
4. Service → **Variables**: `NODE_ENV=production`, `DATA_DIR=/data`, `SESSION_SECRET=<64 random hex chars>`.
5. Service → Settings → Networking → **Generate Domain**. That HTTPS URL is the product.

Serverless hosts without a persistent disk must not be used: the database would be lost on every deploy.
The demo accounts above exist on a fresh deployment too; set `SEED_DEMO=false` before the first start to skip them.
