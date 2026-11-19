import { Router } from 'express';
import { db, now, writeTx } from '../db.js';
import { validator, idParam, PHONE, REGIONS } from '../lib/validate.js';
import { requireAuth } from '../lib/auth.js';
import { moveSellerOrder, historyFor, BUYER_MOVES } from '../lib/orders.js';
import { imageUrls } from '../lib/images.js';
import { badRequest, notFound, forbidden, conflict } from '../lib/errors.js';

const r = Router();
r.use('/orders', requireAuth);

const findByKey = db.prepare('SELECT id, buyer_id FROM orders WHERE request_key = ?');

/** Last delivery address, used to pre-fill checkout. */
r.get('/orders/last-address', (req, res) => {
  const a = db.prepare(`
    SELECT recipient, phone, region, city, street, apartment FROM orders
    WHERE buyer_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`).get(req.user.id);
  res.json({ address: a || null });
});

/**
 * Checkout. One BEGIN IMMEDIATE transaction:
 *  - re-reads cart and products, stops on a changed price,
 *  - reduces stock with a guarded UPDATE and checks changed rows (no overselling),
 *  - creates 1 order + 1 seller_order per seller + order_items with copied title/price,
 *  - empties the cart.
 * The UNIQUE request_key makes a double submit return the first order.
 */
r.post('/orders', (req, res) => {
  const v = validator(req.body)
    .str('requestKey', { label: 'Request key', min: 8, max: 100 })
    .str('recipient', { label: 'Recipient name', min: 2, max: 100 })
    .str('phone', { label: 'Phone', pattern: PHONE, patternMsg: 'Enter a valid phone number, e.g. +374 91 123456' })
    .oneOf('region', REGIONS, { label: 'Region' })
    .str('city', { label: 'City or village', min: 2, max: 100 })
    .str('street', { label: 'Street and building', min: 2, max: 200 })
    .str('apartment', { label: 'Apartment', max: 50, optional: true })
    .str('note', { label: 'Note', max: 500, optional: true })
    .done();
  const userId = req.user.id;

  const existing = findByKey.get(v.requestKey);
  if (existing) {
    if (existing.buyer_id !== userId) throw conflict('REQUEST_KEY_USED', 'This request key was already used');
    return res.status(200).json({ orderId: existing.id, duplicate: true });
  }

  let orderId;
  try {
    orderId = writeTx(() => {
      const lines = db.prepare(`
        SELECT ci.product_id, ci.quantity, ci.price_when_added,
               p.title, p.price_amd, p.seller_id, p.is_published
        FROM cart_items ci JOIN products p ON p.id = ci.product_id
        WHERE ci.user_id = ? ORDER BY p.seller_id, p.id`).all(userId);
      if (!lines.length) throw badRequest('Your cart is empty');

      const changed = lines.filter((l) => l.price_amd !== l.price_when_added);
      if (changed.length) {
        throw conflict('PRICE_CHANGED', `The price of "${changed[0].title}" changed to ${changed[0].price_amd} AMD`, {
          items: changed.map((l) => ({ productId: l.product_id, title: l.title, oldPrice: l.price_when_added, newPrice: l.price_amd })),
        });
      }
      for (const l of lines) {
        if (!l.is_published) throw conflict('UNAVAILABLE', `"${l.title}" is no longer available`, { productId: l.product_id });
        if (l.seller_id === userId) throw forbidden("You can't buy your own product", 'OWN_PRODUCT');
      }

      // Stock: guarded decrement, never read-check-write in JS.
      const take = db.prepare('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?');
      const t = now();
      for (const l of lines) {
        const { changes } = take.run(l.quantity, t, l.product_id, l.quantity);
        if (changes !== 1) {
          throw conflict('OUT_OF_STOCK', `Not enough stock left for "${l.title}"`, { productId: l.product_id });
        }
      }

      const total = lines.reduce((s, l) => s + l.price_amd * l.quantity, 0);
      const order = db.prepare(`
        INSERT INTO orders (buyer_id, recipient, phone, region, city, street, apartment, note, total_amd, request_key, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(userId, v.recipient, v.phone, v.region, v.city, v.street, v.apartment, v.note, total, v.requestKey, t);
      const oid = Number(order.lastInsertRowid);

      const bySeller = Map.groupBy(lines, (l) => l.seller_id);
      const insSo = db.prepare(`INSERT INTO seller_orders (order_id, seller_id, status, subtotal_amd, updated_at) VALUES (?, ?, 'placed', ?, ?)`);
      const insItem = db.prepare(`INSERT INTO order_items (seller_order_id, product_id, title, unit_price_amd, quantity) VALUES (?, ?, ?, ?, ?)`);
      const insHist = db.prepare(`INSERT INTO status_history (seller_order_id, from_status, to_status, changed_by, created_at) VALUES (?, NULL, 'placed', ?, ?)`);
      for (const [sellerId, items] of bySeller) {
        const subtotal = items.reduce((s, l) => s + l.price_amd * l.quantity, 0);
        const soId = insSo.run(oid, sellerId, subtotal, t).lastInsertRowid;
        for (const l of items) insItem.run(soId, l.product_id, l.title, l.price_amd, l.quantity);
        insHist.run(soId, userId, t);
      }
      db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
      return oid;
    });
  } catch (e) {
    // Two identical submits racing: the UNIQUE constraint rejects the second one.
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' && String(e.message).includes('request_key')) {
      const again = findByKey.get(v.requestKey);
      if (again?.buyer_id === userId) return res.status(200).json({ orderId: again.id, duplicate: true });
    }
    throw e;
  }
  res.status(201).json({ orderId });
});

r.get('/orders', (req, res) => {
  const orders = db.prepare(`
    SELECT o.id, o.created_at AS createdAt, o.total_amd AS totalAmd,
      (SELECT SUM(oi.quantity) FROM order_items oi JOIN seller_orders so ON so.id = oi.seller_order_id WHERE so.order_id = o.id) AS itemCount
    FROM orders o WHERE o.buyer_id = ? ORDER BY o.created_at DESC, o.id DESC`).all(req.user.id);
  const parts = db.prepare(`
    SELECT so.id, so.order_id, so.status, so.subtotal_amd, u.store_name FROM seller_orders so
    JOIN orders o ON o.id = so.order_id JOIN users u ON u.id = so.seller_id
    WHERE o.buyer_id = ? ORDER BY so.id`).all(req.user.id);
  const byOrder = Map.groupBy(parts, (p) => p.order_id);
  res.json({
    orders: orders.map((o) => ({
      ...o,
      sellers: (byOrder.get(o.id) || []).map((p) => ({ id: p.id, storeName: p.store_name, status: p.status, subtotalAmd: p.subtotal_amd })),
    })),
  });
});

function loadBuyerOrder(orderId, buyerId) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND buyer_id = ?').get(orderId, buyerId);
  if (!o) throw notFound('Order not found');
  const sos = db.prepare(`
    SELECT so.*, u.store_name FROM seller_orders so JOIN users u ON u.id = so.seller_id
    WHERE so.order_id = ? ORDER BY so.id`).all(orderId);
  const items = db.prepare(`
    SELECT oi.*, (SELECT file_path FROM product_images pi WHERE pi.product_id = oi.product_id ORDER BY position LIMIT 1) AS image,
      EXISTS (SELECT 1 FROM reviews r WHERE r.product_id = oi.product_id AND r.buyer_id = ?) AS reviewed
    FROM order_items oi JOIN seller_orders so ON so.id = oi.seller_order_id
    WHERE so.order_id = ? ORDER BY oi.id`).all(buyerId, orderId);
  const hist = historyFor(sos.map((s) => s.id));
  return {
    id: o.id, createdAt: o.created_at, totalAmd: o.total_amd,
    address: { recipient: o.recipient, phone: o.phone, region: o.region, city: o.city, street: o.street, apartment: o.apartment, note: o.note },
    sellers: sos.map((so) => ({
      id: so.id, storeName: so.store_name, status: so.status, subtotalAmd: so.subtotal_amd, updatedAt: so.updated_at,
      canCancel: BUYER_MOVES[so.status].includes('cancelled'),
      history: hist[so.id] || [],
      items: items.filter((i) => i.seller_order_id === so.id).map((i) => ({
        id: i.id, productId: i.product_id, title: i.title, unitPriceAmd: i.unit_price_amd, quantity: i.quantity,
        image: imageUrls(i.image), canReview: so.status === 'delivered' && !i.reviewed, reviewed: !!i.reviewed,
      })),
    })),
  };
}

r.get('/orders/:id', (req, res) => {
  res.json({ order: loadBuyerOrder(idParam(req.params.id), req.user.id) });
});

r.post('/orders/:id/sellers/:sellerOrderId/cancel', (req, res) => {
  const orderId = idParam(req.params.id);
  const soId = idParam(req.params.sellerOrderId);
  writeTx(() => {
    const so = db.prepare(`
      SELECT so.* FROM seller_orders so JOIN orders o ON o.id = so.order_id
      WHERE so.id = ? AND so.order_id = ? AND o.buyer_id = ?`).get(soId, orderId, req.user.id);
    if (!so) throw notFound('Order not found');
    moveSellerOrder(so, 'cancelled', 'buyer', req.user.id);
  });
  res.json({ order: loadBuyerOrder(orderId, req.user.id) });
});

export default r;
