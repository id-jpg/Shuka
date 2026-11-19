import { Router } from 'express';
import { db, now, writeTx } from '../db.js';
import { validator, idParam, PHONE } from '../lib/validate.js';
import { requireAuth, requireSeller, publicUser } from '../lib/auth.js';
import { upload, saveImage, deleteImageFiles, imageUrls, MAX_IMAGES } from '../lib/images.js';
import { moveSellerOrder, historyFor, SELLER_MOVES } from '../lib/orders.js';
import { badRequest, notFound, conflict } from '../lib/errors.js';

const r = Router();

r.post('/seller/activate', requireAuth, (req, res) => {
  if (req.user.store_name) throw conflict('ALREADY_SELLER', 'You are already a seller');
  const v = validator(req.body)
    .str('storeName', { label: 'Store name', min: 2, max: 60 })
    .str('phone', { label: 'Phone', pattern: PHONE, patternMsg: 'Enter a valid phone number' })
    .done();
  try {
    db.prepare('UPDATE users SET store_name = ?, phone = ? WHERE id = ?').run(v.storeName, v.phone, req.user.id);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw conflict('STORE_NAME_TAKEN', 'This store name is taken', { fields: { storeName: 'This store name is already taken' } });
    }
    throw e;
  }
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

r.use('/seller', requireSeller);

/** Overview: plain SQL, every query scoped to the current seller. */
r.get('/seller/overview', (req, res) => {
  const sid = req.user.id;
  const counts = Object.fromEntries(['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((s) => [s, 0]));
  for (const row of db.prepare('SELECT status, COUNT(*) AS n FROM seller_orders WHERE seller_id = ? GROUP BY status').all(sid)) {
    counts[row.status] = row.n;
  }
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const last30 = db.prepare(`
    SELECT COALESCE(SUM(subtotal_amd), 0) AS revenue, COUNT(*) AS orders FROM seller_orders
    WHERE seller_id = ? AND status = 'delivered' AND updated_at >= ?`).get(sid, since);
  const allTime = db.prepare(`
    SELECT COALESCE(SUM(subtotal_amd), 0) AS revenue FROM seller_orders WHERE seller_id = ? AND status = 'delivered'`).get(sid);
  const products = db.prepare(`
    SELECT COUNT(*) AS total, COALESCE(SUM(is_published), 0) AS published, COALESCE(SUM(stock = 0 AND is_published = 1), 0) AS soldOut
    FROM products WHERE seller_id = ?`).get(sid);
  res.json({
    counts, toConfirm: counts.placed, toShip: counts.confirmed,
    revenue30d: last30.revenue, delivered30d: last30.orders, revenueAllTime: allTime.revenue, products,
  });
});

const sellerProductRow = (p) => ({
  id: p.id, title: p.title, priceAmd: p.price_amd, stock: p.stock, isPublished: !!p.is_published,
  image: imageUrls(p.image), imageCount: p.image_count, unitsSold: p.units_sold,
  ratingAvg: Math.round(p.rating_avg * 10) / 10, ratingCount: p.rating_count, createdAt: p.created_at,
});

r.get('/seller/products', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT file_path FROM product_images WHERE product_id = p.id ORDER BY position LIMIT 1) AS image,
      (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) AS image_count,
      COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN seller_orders so ON so.id = oi.seller_order_id
                WHERE oi.product_id = p.id AND so.status != 'cancelled'), 0) AS units_sold
    FROM products p WHERE p.seller_id = ? ORDER BY p.created_at DESC, p.id DESC`).all(req.user.id);
  res.json({ products: rows.map(sellerProductRow) });
});

function ownProduct(id, sellerId) {
  const p = db.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').get(id, sellerId);
  if (!p) throw notFound('Product not found');
  return p;
}

function editorView(id, sellerId) {
  const p = ownProduct(id, sellerId);
  const images = db.prepare('SELECT id, file_path FROM product_images WHERE product_id = ? ORDER BY position').all(id);
  return {
    id: p.id, title: p.title, description: p.description, categoryId: p.category_id, priceAmd: p.price_amd,
    stock: p.stock, isPublished: !!p.is_published,
    images: images.map((i, idx) => ({ id: i.id, isMain: idx === 0, ...imageUrls(i.file_path) })),
  };
}

r.get('/seller/products/:id', (req, res) => {
  res.json({ product: editorView(idParam(req.params.id), req.user.id) });
});

function productValidator(body, partial) {
  const v = validator(body, { partial })
    .str('title', { label: 'Title', min: 3, max: 120 })
    .str('description', { label: 'Description', min: 10, max: 5000 })
    .int('priceAmd', { label: 'Price', min: 1, max: 100_000_000 })
    .int('stock', { label: 'Stock', min: 0, max: 100_000 })
    .int('categoryId', { label: 'Category', min: 1 })
    .bool('isPublished', { label: 'Published' });
  if (body.categoryId != null && !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(Number(body.categoryId))) {
    v.fail('categoryId', 'Choose a category from the list');
  }
  return v;
}

r.post('/seller/products', (req, res) => {
  const v = productValidator(req.body, false).done();
  const t = now();
  // A new product has no images yet, so it starts unpublished; the editor publishes after upload.
  const info = db.prepare(`
    INSERT INTO products (seller_id, category_id, title, description, price_amd, stock, is_published, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`)
    .run(req.user.id, v.categoryId, v.title, v.description, v.priceAmd, v.stock, t, t);
  res.status(201).json({ product: editorView(info.lastInsertRowid, req.user.id) });
});

r.patch('/seller/products/:id', (req, res) => {
  const id = idParam(req.params.id);
  const vv = productValidator(req.body, true);
  if (req.body.mainImageId !== undefined) vv.int('mainImageId', { label: 'Main image', min: 1 });
  const v = vv.done();
  writeTx(() => {
    const p = ownProduct(id, req.user.id);
    const imageCount = db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?').get(id).n;
    if (v.isPublished === true && imageCount === 0) {
      throw badRequest('Add at least one image before publishing', { images: 'Add at least one image before publishing' });
    }
    db.prepare(`
      UPDATE products SET title = ?, description = ?, price_amd = ?, stock = ?, category_id = ?, is_published = ?, updated_at = ?
      WHERE id = ? AND seller_id = ?`).run(
      v.title ?? p.title, v.description ?? p.description, v.priceAmd ?? p.price_amd, v.stock ?? p.stock,
      v.categoryId ?? p.category_id, v.isPublished === undefined ? p.is_published : Number(v.isPublished),
      now(), id, req.user.id);
    if (v.mainImageId) {
      const ids = db.prepare('SELECT id FROM product_images WHERE product_id = ? ORDER BY position').all(id).map((r) => r.id);
      if (!ids.includes(v.mainImageId)) throw badRequest('Unknown image', { mainImageId: 'Unknown image' });
      reorder(id, [v.mainImageId, ...ids.filter((x) => x !== v.mainImageId)]);
    }
  });
  res.json({ product: editorView(id, req.user.id) });
});

function reorder(productId, orderedIds) {
  const set = db.prepare('UPDATE product_images SET position = ? WHERE id = ? AND product_id = ?');
  orderedIds.forEach((imgId, i) => set.run(-(i + 1), imgId, productId)); // avoid UNIQUE clashes while swapping
  orderedIds.forEach((imgId, i) => set.run(i, imgId, productId));
}

r.post('/seller/products/:id/images',
  (req, _res, next) => { ownProduct(idParam(req.params.id), req.user.id); next(); }, // check owner before reading files
  upload.array('images', MAX_IMAGES),
  async (req, res) => {
    const id = idParam(req.params.id);
    const files = req.files || [];
    if (!files.length) throw badRequest('Choose at least one image', { images: 'Choose at least one image' });
    const existing = db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?').get(id).n;
    if (existing + files.length > MAX_IMAGES) {
      throw badRequest(`A product can have at most ${MAX_IMAGES} images`, { images: `You can add ${MAX_IMAGES - existing} more image(s)` });
    }
    // Resize OUTSIDE the transaction; only the short insert holds the write lock.
    const keys = [];
    try {
      for (const f of files) keys.push(await saveImage(id, f.buffer, f.originalname));
      writeTx(() => {
        let pos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM product_images WHERE product_id = ?').get(id).m;
        const count = db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?').get(id).n;
        if (count + keys.length > MAX_IMAGES) throw badRequest(`A product can have at most ${MAX_IMAGES} images`);
        const ins = db.prepare('INSERT INTO product_images (product_id, file_path, position) VALUES (?, ?, ?)');
        for (const k of keys) ins.run(id, k, ++pos);
      });
    } catch (e) {
      await Promise.all(keys.map(deleteImageFiles));
      throw e;
    }
    res.status(201).json({ product: editorView(id, req.user.id) });
  });

r.delete('/seller/products/:id/images/:imageId', async (req, res) => {
  const id = idParam(req.params.id);
  const imageId = idParam(req.params.imageId);
  const key = writeTx(() => {
    ownProduct(id, req.user.id);
    const img = db.prepare('SELECT * FROM product_images WHERE id = ? AND product_id = ?').get(imageId, id);
    if (!img) throw notFound('Image not found');
    db.prepare('DELETE FROM product_images WHERE id = ?').run(imageId);
    const rest = db.prepare('SELECT id FROM product_images WHERE product_id = ? ORDER BY position').all(id).map((r) => r.id);
    reorder(id, rest);
    if (!rest.length) db.prepare('UPDATE products SET is_published = 0, updated_at = ? WHERE id = ?').run(now(), id);
    return img.file_path;
  });
  await deleteImageFiles(key);
  res.json({ product: editorView(id, req.user.id) });
});

const STATUSES = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];

r.get('/seller/orders', (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : null;
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of db.prepare('SELECT status, COUNT(*) AS n FROM seller_orders WHERE seller_id = ? GROUP BY status').all(req.user.id)) {
    counts[row.status] = row.n;
  }
  const rows = db.prepare(`
    SELECT so.id, so.order_id AS orderId, so.status, so.subtotal_amd AS subtotalAmd, so.updated_at AS updatedAt,
           o.created_at AS createdAt, o.recipient, o.city, o.region,
           (SELECT SUM(quantity) FROM order_items WHERE seller_order_id = so.id) AS itemCount
    FROM seller_orders so JOIN orders o ON o.id = so.order_id
    WHERE so.seller_id = ? ${status ? 'AND so.status = ?' : ''}
    ORDER BY o.created_at DESC, so.id DESC LIMIT 500`).all(...(status ? [req.user.id, status] : [req.user.id]));
  res.json({ orders: rows, counts });
});

function loadSellerOrder(id, sellerId) {
  const so = db.prepare(`
    SELECT so.*, o.recipient, o.phone, o.region, o.city, o.street, o.apartment, o.note, o.created_at AS order_created_at,
           u.name AS buyer_name
    FROM seller_orders so JOIN orders o ON o.id = so.order_id JOIN users u ON u.id = o.buyer_id
    WHERE so.id = ? AND so.seller_id = ?`).get(id, sellerId);
  if (!so) throw notFound('Order not found');
  const items = db.prepare(`
    SELECT oi.*, (SELECT file_path FROM product_images pi WHERE pi.product_id = oi.product_id ORDER BY position LIMIT 1) AS image
    FROM order_items oi WHERE oi.seller_order_id = ? ORDER BY oi.id`).all(id);
  return {
    id: so.id, orderId: so.order_id, status: so.status, subtotalAmd: so.subtotal_amd, cashToCollect: so.subtotal_amd,
    createdAt: so.order_created_at, updatedAt: so.updated_at, buyerName: so.buyer_name,
    delivery: { recipient: so.recipient, phone: so.phone, region: so.region, city: so.city, street: so.street, apartment: so.apartment, note: so.note },
    items: items.map((i) => ({ id: i.id, productId: i.product_id, title: i.title, unitPriceAmd: i.unit_price_amd, quantity: i.quantity, image: imageUrls(i.image) })),
    allowedMoves: SELLER_MOVES[so.status],
    history: historyFor([so.id])[so.id] || [],
  };
}

r.get('/seller/orders/:id', (req, res) => {
  res.json({ order: loadSellerOrder(idParam(req.params.id), req.user.id) });
});

/** The ONLY way to change a seller order's status. */
r.post('/seller/orders/:id/status', (req, res) => {
  const id = idParam(req.params.id);
  const { to } = validator(req.body).oneOf('to', STATUSES, { label: 'Status' }).done();
  writeTx(() => {
    const so = db.prepare('SELECT * FROM seller_orders WHERE id = ? AND seller_id = ?').get(id, req.user.id);
    if (!so) throw notFound('Order not found');
    moveSellerOrder(so, to, 'seller', req.user.id);
  });
  res.json({ order: loadSellerOrder(id, req.user.id) });
});

export default r;
