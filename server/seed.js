import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { UPLOAD_DIR, SEED_IMAGE_DIR } from './config.js';

export const DEMO_PASSWORD = 'shuka1234';

const CATEGORIES = [
  ['Electronics', 'electronics', 210], ['Books', 'books', 25], ['Home & Kitchen', 'home-kitchen', 30],
  ['Clothing & Shoes', 'clothing-shoes', 330], ['Beauty & Health', 'beauty-health', 300],
  ['Sports & Outdoors', 'sports-outdoors', 140], ['Toys & Kids', 'toys-kids', 50],
  ['Food & Drinks', 'food-drinks', 10], ['Handmade & Crafts', 'handmade-crafts', 275],
];

const SELLERS = [
  { email: 'seller1@shuka.am', name: 'Aram Petrosyan', phone: '+374 91 111111', store: 'Ararat Electronics' },
  { email: 'seller2@shuka.am', name: 'Lilit Hakobyan', phone: '+374 93 222222', store: 'Vernissage Crafts' },
  { email: 'seller3@shuka.am', name: 'Gor Sargsyan', phone: '+374 94 333333', store: 'Gyumri Goods' },
];
const BUYERS = [
  { email: 'buyer1@shuka.am', name: 'Anna Grigoryan', phone: '+374 95 444444' },
  { email: 'buyer2@shuka.am', name: 'Davit Mkrtchyan', phone: '+374 98 555555' },
];

// [seller index, category slug, title, price AMD, stock, description]
const PRODUCTS = [
  [0, 'electronics', 'Wireless Earbuds Pro', 24900, 25, 'Bluetooth 5.3 earbuds with active noise cancelling, 30 hours of battery with the case and a USB-C charging port.'],
  [0, 'electronics', 'Smartphone Stand Aluminium', 5900, 40, 'Adjustable aluminium desk stand for phones and small tablets. Folds flat for travel.'],
  [0, 'electronics', 'USB-C Fast Charger 65W', 12500, 30, 'GaN charger with two USB-C ports and one USB-A port. Charges a laptop and a phone at the same time.'],
  [0, 'electronics', 'Mechanical Keyboard (Armenian layout)', 38000, 12, 'Hot-swappable mechanical keyboard with Armenian and English keycaps, white backlight and a detachable cable.'],
  [0, 'electronics', 'Portable Power Bank 20000 mAh', 15900, 3, 'High-capacity power bank with fast charging. Enough for four full phone charges. Only a few left!'],
  [0, 'electronics', 'Smart LED Bulb (set of 2)', 7900, 50, 'Wi-Fi bulbs with 16 million colours and app control. Works with voice assistants.'],
  [0, 'electronics', 'Noise-Cancelling Headphones', 64900, 8, 'Over-ear headphones with 40 hours of battery, comfortable memory foam and a carrying case.'],
  [0, 'electronics', '4K Action Camera', 79000, 6, 'Waterproof action camera with image stabilisation, mounts for helmet and bike, and a 64 GB card.'],
  [0, 'electronics', 'Wireless Mouse Silent', 6500, 45, 'Quiet-click wireless mouse with a USB receiver and 18-month battery life.'],
  [0, 'electronics', 'Laptop Backpack 15.6"', 18900, 20, 'Water-resistant backpack with a padded laptop pocket, USB charging port and anti-theft zip.'],
  [0, 'sports-outdoors', 'Fitness Tracker Band', 14900, 18, 'Tracks steps, heart rate and sleep. Seven-day battery and a waterproof strap.'],
  [0, 'books', 'Learn JavaScript in Armenian', 8900, 15, 'A beginner-friendly guide to JavaScript with exercises, written in Armenian for students.'],
  [0, 'home-kitchen', 'Electric Kettle 1.7 L', 13900, 22, 'Stainless steel kettle with auto shut-off and a blue LED. Boils water in three minutes.'],
  [0, 'electronics', 'Bluetooth Speaker Mini', 11900, 0, 'Pocket-size speaker with surprisingly big sound and 12 hours of play time.'],
  [1, 'handmade-crafts', 'Pomegranate Ceramic Plate', 12000, 10, 'Hand-painted ceramic plate with a traditional Armenian pomegranate pattern. 26 cm, food safe.'],
  [1, 'handmade-crafts', 'Hand-Knotted Wool Rug (small)', 145000, 2, 'Small rug knotted by hand from natural wool with plant dyes. 80 x 120 cm. Each one is unique.'],
  [1, 'handmade-crafts', 'Obsidian Pendant Necklace', 9500, 25, 'Polished Armenian obsidian on a silver-plated chain. Comes in a gift box.'],
  [1, 'handmade-crafts', 'Wooden Backgammon (Nardi) Set', 42000, 7, 'Carved walnut nardi board with inlay work, wooden checkers and two pairs of dice.'],
  [1, 'handmade-crafts', 'Duduk Souvenir Miniature', 6800, 30, 'Small apricot-wood duduk replica, a perfect souvenir from Yerevan.'],
  [1, 'home-kitchen', 'Copper Jazzve (Coffee Pot)', 8500, 35, 'Hand-hammered copper jazzve for Armenian coffee, tin-lined, 300 ml.'],
  [1, 'handmade-crafts', 'Embroidered Table Runner', 16500, 12, 'Linen table runner with Marash-style embroidery. 150 x 35 cm.'],
  [1, 'clothing-shoes', 'Wool Knitted Socks', 3900, 60, 'Warm hand-knitted socks from sheep wool, made in Gegharkunik. One size fits most.'],
  [1, 'beauty-health', 'Apricot Oil Natural Soap (3 pcs)', 4500, 40, 'Cold-process soap with apricot kernel oil and mountain herbs. No artificial colours.'],
  [1, 'beauty-health', 'Mountain Herbal Tea Set', 5800, 28, 'Thyme, mint and rosehip teas collected in the mountains of Syunik.'],
  [1, 'handmade-crafts', 'Silver Filigree Earrings', 27500, 9, 'Delicate filigree earrings made by a silversmith in Yerevan. 925 silver.'],
  [1, 'books', 'Armenian Cookbook: Family Recipes', 11000, 14, 'Over 100 family recipes from all regions of Armenia, with colour photos.'],
  [1, 'toys-kids', 'Wooden Alphabet Blocks (Armenian)', 9900, 16, 'Thirty-nine wooden blocks with the Armenian alphabet. Painted with child-safe colours.'],
  [1, 'handmade-crafts', 'Khachkar Stone Carving Replica', 23000, 5, 'Small tuff stone replica of a traditional khachkar, 20 cm high.'],
  [2, 'food-drinks', 'Dried Apricots 1 kg', 4900, 80, 'Sun-dried Ararat valley apricots, no sugar added.'],
  [2, 'food-drinks', 'Gata Sweet Bread (2 pcs)', 2500, 40, 'Traditional sweet bread with a buttery filling, baked fresh in Gyumri.'],
  [2, 'food-drinks', 'Lavash Pack (10 sheets)', 1200, 100, 'Thin traditional lavash, soft and fresh. Keeps for a week.'],
  [2, 'food-drinks', 'Mulberry Jam 500 g', 3200, 45, 'Homemade white mulberry jam from Ararat. No preservatives.'],
  [2, 'food-drinks', 'Sujukh Walnut Sweet (3 pcs)', 3800, 50, 'Walnuts dipped in thickened grape juice. A classic Armenian treat.'],
  [2, 'clothing-shoes', 'Men\'s Leather Shoes', 36000, 10, 'Hand-stitched genuine leather shoes made in Gyumri. Sizes 40 to 45.'],
  [2, 'clothing-shoes', 'Women\'s Wool Coat', 59000, 4, 'Warm wool-blend coat with a classic cut, made by a local workshop.'],
  [2, 'clothing-shoes', 'Cotton T-Shirt "Shuka"', 6900, 70, 'Soft 100% cotton t-shirt with a small printed logo. Unisex sizes S to XXL.'],
  [2, 'sports-outdoors', 'Hiking Backpack 40 L', 27000, 11, 'Lightweight backpack for trips to Dilijan and Aragats, with rain cover and hip belt.'],
  [2, 'sports-outdoors', 'Yoga Mat Non-Slip', 8900, 25, '6 mm thick non-slip yoga mat with a carrying strap.'],
  [2, 'sports-outdoors', 'Football Size 5', 7500, 30, 'Match-quality football, hand-stitched, size 5.'],
  [2, 'home-kitchen', 'Cast Iron Pan 28 cm', 17500, 15, 'Pre-seasoned cast iron pan for khorovats-style vegetables and everyday cooking.'],
  [2, 'home-kitchen', 'Glass Food Containers (set of 5)', 9800, 20, 'Oven-safe glass containers with snap lids.'],
  [2, 'toys-kids', 'Building Blocks 500 pcs', 14500, 13, 'Colourful building blocks compatible with major brands. Ages 4+.'],
  [2, 'toys-kids', 'Plush Bear "Mishik"', 6200, 22, 'Soft and cuddly teddy bear, 35 cm.'],
  [2, 'beauty-health', 'Rose Water Face Toner', 4200, 35, 'Natural rose water from Armenian roses. Refreshes and tones the skin.'],
  [2, 'books', 'History of Armenia (illustrated)', 15500, 9, 'An illustrated history of Armenia from Urartu to today, for readers of all ages.'],
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function wrap(text, max = 16) {
  const lines = []; let line = '';
  for (const w of text.split(' ')) {
    if ((line + ' ' + w).trim().length > max && line) { lines.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/** Generate a placeholder product photo locally (no network needed). */
function productSvg(title, category, hue, variant) {
  const h2 = (hue + 35 + variant * 40) % 360;
  const lines = wrap(title);
  const shapes = [
    `<circle cx="400" cy="270" r="160" fill="hsl(${h2},70%,62%)" opacity=".9"/>`,
    `<rect x="250" y="120" width="300" height="300" rx="44" fill="hsl(${h2},65%,58%)" opacity=".9" transform="rotate(12 400 270)"/>`,
    `<polygon points="400,90 570,420 230,420" fill="hsl(${h2},70%,60%)" opacity=".9"/>`,
  ][variant % 3];
  const text = lines.map((l, i) =>
    `<text x="400" y="${590 + i * 50 - (lines.length - 1) * 18}" font-size="44" font-weight="700" text-anchor="middle" fill="#1f2937" font-family="DejaVu Sans, Arial, sans-serif">${esc(l)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},80%,94%)"/><stop offset="1" stop-color="hsl(${hue},70%,84%)"/></linearGradient></defs>
    <rect width="800" height="800" fill="url(#g)"/>
    ${shapes}
    <circle cx="400" cy="270" r="60" fill="#fff" opacity=".55"/>
    ${text}
    <text x="400" y="770" font-size="24" text-anchor="middle" fill="#4b5563" font-family="DejaVu Sans, Arial, sans-serif">${esc(category)} · view ${variant + 1}</text>
  </svg>`;
}

/** Same key every time, so images rendered at build time can be reused on every start. */
const seedKey = (i, v) => `seed/p${i + 1}-v${v}`;

async function renderSeedImage(outDir, key, svg) {
  const base = path.join(outDir, key);
  await fs.mkdir(path.dirname(base), { recursive: true });
  const buf = Buffer.from(svg);
  await sharp(buf).resize(1200, 1200).webp({ quality: 80 }).toFile(`${base}-large.webp`);
  await sharp(buf).resize(400, 400).webp({ quality: 75 }).toFile(`${base}-thumb.webp`);
}

const hasImage = (dir, key) => existsSync(path.join(dir, `${key}-large.webp`)) && existsSync(path.join(dir, `${key}-thumb.webp`));

/** Render every demo image into outDir unless it already exists in SEED_IMAGE_DIR or outDir. Returns keys per product. */
export async function ensureSeedImages(outDir = UPLOAD_DIR) {
  const all = [];
  for (let i = 0; i < PRODUCTS.length; i++) {
    const [, slug, title] = PRODUCTS[i];
    const [catName, , hue] = CATEGORIES.find((c) => c[1] === slug);
    const keys = [];
    for (let v = 0; v < 1 + (i % 3); v++) {
      const key = seedKey(i, v);
      if (!hasImage(SEED_IMAGE_DIR, key) && !hasImage(outDir, key)) {
        await renderSeedImage(outDir, key, productSvg(title, catName, (hue + i * 7) % 360, v));
      }
      keys.push(key);
    }
    all.push(keys);
  }
  return all;
}

export async function seed(db, { log = console.log } = {}) {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const base = Date.now() - 40 * 24 * 3600 * 1000;
  const iso = (offsetMs) => new Date(base + offsetMs).toISOString();

  // Generate images first (slow work outside the transaction).
  // Uses the images pre-rendered at build time; renders only what is missing.
  const images = await ensureSeedImages();

  db.transaction(() => {
    const insCat = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)');
    const catId = {};
    for (const [name, slug] of CATEGORIES) catId[slug] = Number(insCat.run(name, slug).lastInsertRowid);

    const insUser = db.prepare('INSERT INTO users (email, password_hash, name, phone, store_name, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const sellerIds = SELLERS.map((s, i) => Number(insUser.run(s.email, hash, s.name, s.phone, s.store, iso(i * 1000)).lastInsertRowid));
    const buyerIds = BUYERS.map((b, i) => Number(insUser.run(b.email, hash, b.name, b.phone, null, iso(5000 + i * 1000)).lastInsertRowid));

    const insProd = db.prepare(`INSERT INTO products (seller_id, category_id, title, description, price_amd, stock, is_published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`);
    const insImg = db.prepare('INSERT INTO product_images (product_id, file_path, position) VALUES (?, ?, ?)');
    const productIds = PRODUCTS.map(([s, slug, title, price, stock, desc], i) => {
      const t = iso(24 * 3600 * 1000 + i * 3 * 3600 * 1000);
      const id = Number(insProd.run(sellerIds[s], catId[slug], title, desc, price, stock, t, t).lastInsertRowid);
      images[i].forEach((k, pos) => insImg.run(id, k, pos));
      return id;
    });

    // A few past orders so ratings, history and seller stats are not empty.
    const insOrder = db.prepare(`INSERT INTO orders (buyer_id, recipient, phone, region, city, street, apartment, note, total_amd, request_key, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)`);
    const insSo = db.prepare('INSERT INTO seller_orders (order_id, seller_id, status, subtotal_amd, updated_at) VALUES (?, ?, ?, ?, ?)');
    const insItem = db.prepare('INSERT INTO order_items (seller_order_id, product_id, title, unit_price_amd, quantity) VALUES (?, ?, ?, ?, ?)');
    const insHist = db.prepare('INSERT INTO status_history (seller_order_id, from_status, to_status, changed_by, created_at) VALUES (?, ?, ?, ?, ?)');
    const insReview = db.prepare('INSERT INTO reviews (product_id, buyer_id, rating, body, created_at) VALUES (?, ?, ?, ?, ?)');
    const takeStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');

    const pastOrders = [
      { buyer: 0, items: [[0, 1], [14, 1]], status: 'delivered', day: 30, reviews: [[0, 5, 'Great sound and the battery lasts forever.'], [14, 5, 'Beautiful plate, packed very carefully.']] },
      { buyer: 1, items: [[0, 1], [28, 2]], status: 'delivered', day: 32, reviews: [[0, 4, 'Good earbuds for the price, the case is a bit big.'], [28, 5, 'Sweet and soft apricots, like from grandma\'s garden.']] },
      { buyer: 0, items: [[19, 1], [31, 2]], status: 'delivered', day: 34, reviews: [[19, 5, 'Makes perfect Armenian coffee.'], [31, 4, 'Tasty jam, would buy again.']] },
      { buyer: 1, items: [[2, 1]], status: 'shipped', day: 37, reviews: [] },
      { buyer: 0, items: [[36, 1], [16, 1]], status: 'placed', day: 39, reviews: [] },
    ];
    const flow = ['placed', 'confirmed', 'shipped', 'delivered'];
    pastOrders.forEach((po, n) => {
      const buyerId = buyerIds[po.buyer];
      const b = BUYERS[po.buyer];
      const t0 = base + po.day * 24 * 3600 * 1000;
      const lines = po.items.map(([pi, q]) => ({ pi, q, p: PRODUCTS[pi], id: productIds[pi], seller: sellerIds[PRODUCTS[pi][0]] }));
      const total = lines.reduce((s, l) => s + l.p[3] * l.q, 0);
      const oid = Number(insOrder.run(buyerId, b.name, b.phone, 'Yerevan', 'Yerevan', 'Abovyan St 10', String(12 + n), total, `seed-${n}`, new Date(t0).toISOString()).lastInsertRowid);
      for (const [sellerId, ls] of Map.groupBy(lines, (l) => l.seller)) {
        const steps = flow.slice(0, flow.indexOf(po.status) + 1);
        const soId = Number(insSo.run(oid, sellerId, po.status, ls.reduce((s, l) => s + l.p[3] * l.q, 0), new Date(t0 + (steps.length - 1) * 86400000).toISOString()).lastInsertRowid);
        for (const l of ls) { insItem.run(soId, l.id, l.p[2], l.p[3], l.q); takeStock.run(l.q, l.id, l.q); }
        steps.forEach((s, i) => insHist.run(soId, i ? steps[i - 1] : null, s, i ? sellerId : buyerId, new Date(t0 + i * 86400000).toISOString()));
      }
      for (const [pi, rating, body] of po.reviews) insReview.run(productIds[pi], buyerId, rating, body, new Date(t0 + 4 * 86400000).toISOString());
    });
    db.prepare(`UPDATE products SET rating_count = (SELECT COUNT(*) FROM reviews r WHERE r.product_id = products.id),
      rating_avg = COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.product_id = products.id), 0)`).run();
  })();
  log(`seed: ${CATEGORIES.length} categories, ${SELLERS.length} sellers, ${BUYERS.length} buyers, ${PRODUCTS.length} products. Demo password: ${DEMO_PASSWORD}`);
}

/** CLI: `npm run seed` seeds an empty DB; `npm run seed -- --reset` wipes data/ first. */
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--images')) {
  // Build step: `node server/seed.js --images` renders all demo images into seed-images/.
  await ensureSeedImages(SEED_IMAGE_DIR);
  console.log(`seed: demo images ready in ${SEED_IMAGE_DIR}`);
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { DB_PATH } = await import('./config.js');
  if (process.argv.includes('--reset')) {
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) await fs.rm(f, { force: true });
    await fs.rm(UPLOAD_DIR, { recursive: true, force: true });
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
  const { db } = await import('./db.js');
  if (db.prepare('SELECT COUNT(*) AS n FROM categories').get().n > 0) {
    console.log('seed: database already has data. Use "npm run seed -- --reset" to start over.');
  } else {
    await seed(db);
  }
  db.close();
}
