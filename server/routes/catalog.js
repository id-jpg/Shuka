import { Router } from 'express';
import { db, now, writeTx } from '../db.js';
import { validator, idParam } from '../lib/validate.js';
import { requireAuth } from '../lib/auth.js';
import { imageUrls } from '../lib/images.js';
import { badRequest, notFound, forbidden, conflict } from '../lib/errors.js';

const r = Router();
export const PAGE_SIZE = 24;

const MAIN_IMAGE = '(SELECT pi.file_path FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.position LIMIT 1)';

export const productCard = (p) => ({
  id: p.id, title: p.title, priceAmd: p.price_amd, stock: p.stock,
  ratingAvg: Math.round(p.rating_avg * 10) / 10, ratingCount: p.rating_count,
  image: imageUrls(p.image), createdAt: p.created_at,
});

r.get('/categories', (_req, res) => {
  const categories = db.prepare(`
    SELECT c.id, c.name, c.slug,
      (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_published = 1) AS productCount
    FROM categories c ORDER BY c.name`).all();
  res.json({ categories });
});

const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price_amd ASC, p.id DESC',
  price_desc: 'p.price_amd DESC, p.id DESC',
  rating: 'p.rating_avg DESC, p.rating_count DESC, p.id DESC',
};

r.get('/products', (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 100);
  const category = String(req.query.category ?? '').trim();
  const sort = SORTS[req.query.sort] ? req.query.sort : 'newest';
  const v = validator(req.query, { partial: true })
    .int('minPrice', { label: 'Min price', min: 0, optional: true })
    .int('maxPrice', { label: 'Max price', min: 0, optional: true })
    .int('page', { label: 'Page', min: 1, max: 10000, optional: true })
    .done();
  const page = v.page ?? 1;

  const where = ['p.is_published = 1'];
  const params = [];
  for (const term of q.split(/\s+/).filter(Boolean).slice(0, 6)) {
    const like = `%${term.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    where.push(`(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')`);
    params.push(like, like);
  }
  if (category) { where.push('c.slug = ?'); params.push(category); }
  if (v.minPrice != null) { where.push('p.price_amd >= ?'); params.push(v.minPrice); }
  if (v.maxPrice != null) { where.push('p.price_amd <= ?'); params.push(v.maxPrice); }
  const whereSql = where.join(' AND ');

  const { total } = db.prepare(`
    SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.category_id WHERE ${whereSql}`).get(...params);
  const rows = db.prepare(`
    SELECT p.*, ${MAIN_IMAGE} AS image FROM products p JOIN categories c ON c.id = p.category_id
    WHERE ${whereSql} ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`).all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);

  res.json({
    items: rows.map(productCard), total, page, pageSize: PAGE_SIZE,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), sort,
  });
});

r.get('/products/:id', (req, res) => {
  const id = idParam(req.params.id);
  const p = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug, u.store_name
    FROM products p JOIN categories c ON c.id = p.category_id JOIN users u ON u.id = p.seller_id
    WHERE p.id = ?`).get(id);
  const isOwner = p && req.user?.id === p.seller_id;
  if (!p || (!p.is_published && !isOwner)) throw notFound('Product not found');
  const images = db.prepare('SELECT id, file_path FROM product_images WHERE product_id = ? ORDER BY position').all(id);
  res.json({
    product: {
      ...productCard({ ...p, image: images[0]?.file_path }),
      description: p.description, isPublished: !!p.is_published, isOwner,
      category: { name: p.category_name, slug: p.category_slug },
      seller: { id: p.seller_id, storeName: p.store_name },
      images: images.map((i) => ({ id: i.id, ...imageUrls(i.file_path) })),
    },
  });
});

r.get('/products/:id/reviews', (req, res) => {
  const id = idParam(req.params.id);
  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.body, r.created_at AS createdAt, u.name AS buyerName
    FROM reviews r JOIN users u ON u.id = r.buyer_id
    WHERE r.product_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 100`).all(id);
  res.json({ reviews });
});

r.post('/products/:id/reviews', requireAuth, (req, res) => {
  const id = idParam(req.params.id);
  const v = validator(req.body)
    .int('rating', { label: 'Rating', min: 1, max: 5 })
    .str('body', { label: 'Review', min: 3, max: 2000 })
    .done();
  const review = writeTx(() => {
    const delivered = db.prepare(`
      SELECT 1 FROM order_items oi
      JOIN seller_orders so ON so.id = oi.seller_order_id
      JOIN orders o ON o.id = so.order_id
      WHERE oi.product_id = ? AND o.buyer_id = ? AND so.status = 'delivered' LIMIT 1`).get(id, req.user.id);
    if (!delivered) throw forbidden('You can review only products delivered to you', 'NOT_DELIVERED');
    let info;
    try {
      info = db.prepare('INSERT INTO reviews (product_id, buyer_id, rating, body, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, req.user.id, v.rating, v.body, now());
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw conflict('ALREADY_REVIEWED', 'You have already reviewed this product');
      throw e;
    }
    db.prepare(`
      UPDATE products SET
        rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = ?),
        rating_avg   = (SELECT AVG(rating) FROM reviews WHERE product_id = ?)
      WHERE id = ?`).run(id, id, id);
    return { id: info.lastInsertRowid, rating: v.rating, body: v.body };
  });
  res.status(201).json({ review });
});

export default r;
