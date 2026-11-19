import { Router } from 'express';
import { db } from '../db.js';
import { validator, idParam } from '../lib/validate.js';
import { requireAuth } from '../lib/auth.js';
import { imageUrls } from '../lib/images.js';
import { notFound, forbidden, conflict } from '../lib/errors.js';

const r = Router();
r.use('/cart', requireAuth);

export function loadCart(userId) {
  const rows = db.prepare(`
    SELECT ci.product_id, ci.quantity, ci.price_when_added,
           p.title, p.price_amd, p.stock, p.is_published, p.seller_id, u.store_name,
           (SELECT file_path FROM product_images pi WHERE pi.product_id = p.id ORDER BY position LIMIT 1) AS image
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    JOIN users u ON u.id = p.seller_id
    WHERE ci.user_id = ?
    ORDER BY u.store_name, p.title`).all(userId);

  const groups = new Map();
  let total = 0, count = 0, canCheckout = rows.length > 0;
  for (const row of rows) {
    const available = row.is_published === 1 && row.stock > 0;
    const item = {
      productId: row.product_id, title: row.title, image: imageUrls(row.image),
      quantity: row.quantity, stock: row.stock, priceAmd: row.price_amd,
      priceWhenAdded: row.price_when_added,
      priceChanged: row.price_amd !== row.price_when_added,
      soldOut: !available,
      exceedsStock: available && row.quantity > row.stock,
      lineTotal: row.price_amd * row.quantity,
    };
    if (item.priceChanged || item.soldOut || item.exceedsStock) canCheckout = false;
    if (!groups.has(row.seller_id)) {
      groups.set(row.seller_id, { sellerId: row.seller_id, storeName: row.store_name, items: [], subtotal: 0 });
    }
    const g = groups.get(row.seller_id);
    g.items.push(item);
    if (available) { g.subtotal += item.lineTotal; total += item.lineTotal; }
    count += row.quantity;
  }
  return { groups: [...groups.values()], total, count, canCheckout };
}

r.get('/cart', (req, res) => res.json({ cart: loadCart(req.user.id) }));

r.put('/cart/items/:productId', (req, res) => {
  const productId = idParam(req.params.productId);
  const { quantity } = validator(req.body).int('quantity', { label: 'Quantity', min: 1, max: 999 }).done();
  const p = db.prepare('SELECT id, seller_id, title, stock, price_amd, is_published FROM products WHERE id = ?').get(productId);
  if (!p || !p.is_published) throw notFound('Product not found');
  if (p.seller_id === req.user.id) throw forbidden("You can't buy your own product", 'OWN_PRODUCT');
  if (quantity > p.stock) {
    throw conflict('NOT_ENOUGH_STOCK',
      p.stock === 0 ? `"${p.title}" is out of stock` : `Only ${p.stock} of "${p.title}" left in stock`,
      { available: p.stock });
  }
  db.prepare(`
    INSERT INTO cart_items (user_id, product_id, quantity, price_when_added) VALUES (?, ?, ?, ?)
    ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = excluded.quantity`)
    .run(req.user.id, productId, quantity, p.price_amd);
  res.json({ cart: loadCart(req.user.id) });
});

r.delete('/cart/items/:productId', (req, res) => {
  const productId = idParam(req.params.productId);
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, productId);
  res.json({ cart: loadCart(req.user.id) });
});

/** Buyer has seen the new prices and accepts them. */
r.post('/cart/accept-prices', (req, res) => {
  db.prepare(`
    UPDATE cart_items SET price_when_added = (SELECT price_amd FROM products WHERE products.id = cart_items.product_id)
    WHERE user_id = ?`).run(req.user.id);
  res.json({ cart: loadCart(req.user.id) });
});

export default r;
