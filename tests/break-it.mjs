/**
 * Break-it tests from the project brief.
 *   npm test                                   -> starts a fresh server on a temp database and runs everything
 *   BASE_URL=https://your-app.example npm test -> runs the HTTP tests against a live deployment
 *                                                (the foreign-key test needs the DB file, so it runs locally only)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let BASE = process.env.BASE_URL?.replace(/\/$/, '');
let server, dataDir;

const results = [];
const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m` };

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body, headers = {}) {
    const opts = { method, headers: { ...headers } };
    if (this.cookie) opts.headers.cookie = this.cookie;
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch(BASE + '/api' + url, opts);
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    let data = null;
    try { data = await res.json(); } catch { /* not json */ }
    return { status: res.status, data };
  }
  get(u) { return this.req('GET', u); }
  post(u, b = {}) { return this.req('POST', u, b); }
  put(u, b) { return this.req('PUT', u, b); }
  patch(u, b) { return this.req('PATCH', u, b); }
}

const uid = () => crypto.randomBytes(4).toString('hex');
async function newUser(prefix = 'buyer') {
  const cl = new Client();
  const r = await cl.post('/auth/register', { email: `${prefix}-${uid()}@test.am`, password: 'password123', name: `Test ${prefix}`, phone: '+374 91 000000' });
  if (r.status !== 201) throw new Error('register failed: ' + JSON.stringify(r.data));
  cl.user = r.data.user;
  return cl;
}
async function newSeller() {
  const cl = await newUser('seller');
  const r = await cl.post('/seller/activate', { storeName: `Store ${uid()}`, phone: '+374 91 000000' });
  if (r.status !== 200) throw new Error('activate failed: ' + JSON.stringify(r.data));
  return cl;
}
let pngCache;
async function png() {
  pngCache ||= await sharp({ create: { width: 300, height: 300, channels: 3, background: '#4a90d9' } }).png().toBuffer();
  return pngCache;
}
let categoryId;
async function createProduct(seller, { stock = 10, price = 1000, title = `Test product ${uid()}` } = {}) {
  categoryId ||= (await seller.get('/categories')).data.categories[0].id;
  const r = await seller.post('/seller/products', { title, description: 'A product made by the break-it tests.', priceAmd: price, stock, categoryId });
  if (r.status !== 201) throw new Error('create product failed: ' + JSON.stringify(r.data));
  const fd = new FormData();
  fd.append('images', new Blob([await png()], { type: 'image/png' }), 'test.png');
  const up = await seller.post(`/seller/products/${r.data.product.id}/images`, fd);
  if (up.status !== 201) throw new Error('upload failed: ' + JSON.stringify(up.data));
  const pub = await seller.patch(`/seller/products/${r.data.product.id}`, { isPublished: true });
  if (pub.status !== 200) throw new Error('publish failed: ' + JSON.stringify(pub.data));
  return r.data.product.id;
}
const ADDRESS = { recipient: 'Test Buyer', phone: '+374 91 000000', region: 'Yerevan', city: 'Yerevan', street: 'Abovyan 1', apartment: '2', note: '' };
const checkout = (cl, key = crypto.randomUUID()) => cl.post('/orders', { ...ADDRESS, requestKey: key });
const stockOf = async (seller, id) => (await seller.get(`/seller/products/${id}`)).data.product.stock;

async function test(name, fn) {
  try {
    const detail = await fn();
    results.push([name, true]);
    console.log(`${c.g('PASS')} ${name}${detail ? c.d('  — ' + detail) : ''}`);
  } catch (e) {
    results.push([name, false]);
    console.log(`${c.r('FAIL')} ${name}\n     ${e.message}`);
  }
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }

async function startServer() {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shuka-test-'));
  const port = 3900 + Math.floor(Math.random() * 90);
  BASE = `http://localhost:${port}`;
  server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT, env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not start:\n' + log);
}

async function main() {
  if (!BASE) await startServer();
  console.log(`Running break-it tests against ${BASE}\n`);

  await test('Last units: stock 3, 30 simultaneous checkouts', async () => {
    const seller = await newSeller();
    const pid = await createProduct(seller, { stock: 3 });
    const buyers = await Promise.all(Array.from({ length: 30 }, () => newUser()));
    for (const b of buyers) {
      const r = await b.put(`/cart/items/${pid}`, { quantity: 1 });
      expect(r.status === 200, `add to cart failed: ${r.status}`);
    }
    const res = await Promise.all(buyers.map((b) => checkout(b)));
    const ok = res.filter((r) => r.status === 201).length;
    const conflicts = res.filter((r) => r.status === 409).length;
    const other = res.filter((r) => ![201, 409].includes(r.status));
    const locked = res.some((r) => /locked|busy/i.test(JSON.stringify(r.data)));
    const stock = await stockOf(seller, pid);
    expect(ok === 3, `expected 3 orders, got ${ok}`);
    expect(conflicts === 27, `expected 27 × 409, got ${conflicts}`);
    expect(!other.length && !locked, `unexpected responses: ${JSON.stringify(other.slice(0, 2))}`);
    expect(stock === 0, `expected stock 0, got ${stock}`);
    return `3 orders, 27 × 409, stock ${stock}`;
  });

  const seller = await newSeller();
  const sellerB = await newSeller();
  const buyer = await newUser();
  const buyerB = await newUser();

  await test('Double click: same request key sent twice', async () => {
    const pid = await createProduct(seller, { stock: 10 });
    await buyer.put(`/cart/items/${pid}`, { quantity: 1 });
    const before = (await buyer.get('/orders')).data.orders.length;
    const key = crypto.randomUUID();
    const [a, b] = await Promise.all([checkout(buyer, key), checkout(buyer, key)]);
    const after = (await buyer.get('/orders')).data.orders.length;
    expect(a.data.orderId && a.data.orderId === b.data.orderId, `got two different results: ${JSON.stringify([a.data, b.data])}`);
    expect(after - before === 1, `expected 1 new order, got ${after - before}`);
    return `one order #${a.data.orderId}`;
  });

  await test('Price changed: seller raises price before checkout', async () => {
    const pid = await createProduct(seller, { stock: 10, price: 5000 });
    await buyer.put(`/cart/items/${pid}`, { quantity: 1 });
    await seller.patch(`/seller/products/${pid}`, { priceAmd: 7000 });
    const r = await checkout(buyer);
    expect(r.status === 409 && r.data.error.code === 'PRICE_CHANGED', `expected 409 PRICE_CHANGED, got ${r.status} ${JSON.stringify(r.data)}`);
    expect(r.data.error.items[0].newPrice === 7000, 'new price not shown');
    await buyer.req('DELETE', `/cart/items/${pid}`);
    return `409 PRICE_CHANGED, new price ${r.data.error.items[0].newPrice}`;
  });

  let orderId, soId, pidOrdered;
  await test('Old order after edit: order keeps title and price', async () => {
    pidOrdered = await createProduct(seller, { stock: 10, price: 4000, title: 'Original title' });
    await buyer.put(`/cart/items/${pidOrdered}`, { quantity: 2 });
    const r = await checkout(buyer);
    expect(r.status === 201, `checkout failed ${r.status} ${JSON.stringify(r.data)}`);
    orderId = r.data.orderId;
    await seller.patch(`/seller/products/${pidOrdered}`, { title: 'Changed title', priceAmd: 9999 });
    const o = (await buyer.get(`/orders/${orderId}`)).data.order;
    const item = o.sellers[0].items[0];
    soId = o.sellers[0].id;
    expect(item.title === 'Original title' && item.unitPriceAmd === 4000, `order changed: ${item.title} ${item.unitPriceAmd}`);
    return `"${item.title}" at ${item.unitPriceAmd} AMD`;
  });

  await test("Someone else's order: seller B and buyer B get 404", async () => {
    const s = await sellerB.get(`/seller/orders/${soId}`);
    const s2 = await sellerB.post(`/seller/orders/${soId}/status`, { to: 'confirmed' });
    const b = await buyerB.get(`/orders/${orderId}`);
    const b2 = await buyerB.post(`/orders/${orderId}/sellers/${soId}/cancel`);
    for (const [n, r] of Object.entries({ sellerGet: s, sellerMove: s2, buyerGet: b, buyerCancel: b2 })) {
      expect([403, 404].includes(r.status), `${n}: expected 403/404, got ${r.status}`);
      expect(!r.data?.order, `${n}: data leaked`);
    }
    return 'all 404, no data';
  });

  await test('Move not allowed: placed→delivered, buyer cancels shipped', async () => {
    const r1 = await seller.post(`/seller/orders/${soId}/status`, { to: 'delivered' });
    expect(r1.status === 409, `placed→delivered: expected 409, got ${r1.status}`);
    const st = (await seller.get(`/seller/orders/${soId}`)).data.order;
    expect(st.status === 'placed' && st.history.length === 1, 'status or history changed');
    expect((await seller.post(`/seller/orders/${soId}/status`, { to: 'confirmed' })).status === 200, 'confirm failed');
    expect((await seller.post(`/seller/orders/${soId}/status`, { to: 'shipped' })).status === 200, 'ship failed');
    const r2 = await buyer.post(`/orders/${orderId}/sellers/${soId}/cancel`);
    expect(r2.status === 409, `cancel shipped: expected 409, got ${r2.status}`);
    const after = (await seller.get(`/seller/orders/${soId}`)).data.order;
    expect(after.status === 'shipped', `status is ${after.status}`);
    return '409 both times, nothing changed';
  });

  await test('Cancel returns stock', async () => {
    const pid = await createProduct(seller, { stock: 10 });
    await buyer.put(`/cart/items/${pid}`, { quantity: 4 });
    const r = await checkout(buyer);
    expect(r.status === 201, `checkout ${r.status}`);
    const mid = await stockOf(seller, pid);
    const so = (await buyer.get(`/orders/${r.data.orderId}`)).data.order.sellers[0];
    const c1 = await buyer.post(`/orders/${r.data.orderId}/sellers/${so.id}/cancel`);
    expect(c1.status === 200, `cancel ${c1.status}`);
    const end = await stockOf(seller, pid);
    expect(mid === 6 && end === 10, `stock 10 → ${mid} → ${end}`);
    return `stock 10 → ${mid} → ${end}`;
  });

  if (dataDir) {
    await test('Foreign keys: order item for a missing product is rejected', async () => {
      const { default: Database } = await import('better-sqlite3');
      const db = new Database(path.join(dataDir, 'shuka.db'));
      db.pragma('foreign_keys = ON');
      const so = db.prepare('SELECT id FROM seller_orders LIMIT 1').get();
      let err;
      try {
        db.prepare('INSERT INTO order_items (seller_order_id, product_id, title, unit_price_amd, quantity) VALUES (?, 999999, ?, 100, 1)').run(so.id, 'ghost');
      } catch (e) { err = e; }
      db.close();
      expect(err && /FOREIGN KEY/.test(err.message), 'insert was accepted');
      return err.message;
    });
  } else {
    console.log(c.d('SKIP Foreign keys (needs local DB file; run "npm test" locally)'));
  }

  await test('Bad upload: 30 MB file and a renamed .exe', async () => {
    const pid = await createProduct(seller, { stock: 1 });
    const big = new FormData();
    big.append('images', new Blob([Buffer.alloc(30 * 1024 * 1024, 1)], { type: 'image/jpeg' }), 'huge.jpg');
    const r1 = await seller.post(`/seller/products/${pid}/images`, big);
    const exe = Buffer.concat([Buffer.from('MZ\x90\x00\x03\x00\x00\x00'), crypto.randomBytes(4000)]);
    const fake = new FormData();
    fake.append('images', new Blob([exe], { type: 'image/jpeg' }), 'photo.jpg');
    const r2 = await seller.post(`/seller/products/${pid}/images`, fake);
    const raw = new FormData();
    raw.append('images', new Blob([exe], { type: 'application/x-msdownload' }), 'virus.exe');
    const r3 = await seller.post(`/seller/products/${pid}/images`, raw);
    for (const [n, r] of Object.entries({ '30MB': r1, renamedExe: r2, exe: r3 })) {
      expect(r.status === 400 && r.data?.error?.message, `${n}: expected 400 with message, got ${r.status}`);
    }
    const imgs = (await seller.get(`/seller/products/${pid}`)).data.product.images.length;
    expect(imgs === 1, `images changed: ${imgs}`);
    return `"${r1.data.error.message}" / "${r2.data.error.message}"`;
  });

  const failed = results.filter((r) => !r[1]).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  return failed;
}

let failed = 1;
try { failed = await main(); } catch (e) { console.error(e); }
finally {
  if (server) server.kill();
  if (dataDir) setTimeout(() => fs.rmSync(dataDir, { recursive: true, force: true }), 300);
}
process.exitCode = failed ? 1 : 0;
