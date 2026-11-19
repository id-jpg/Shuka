import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { PORT, IS_PROD, UPLOAD_DIR, CLIENT_DIST, DB_PATH } from './config.js';
import { db } from './db.js';
import { loadUser } from './lib/auth.js';
import { errorHandler } from './lib/errors.js';
import { scheduleDailyBackup } from './backup.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import sellerRoutes from './routes/seller.js';

if (process.env.SEED_DEMO !== 'false') {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM categories').get();
  if (count === 0) {
    const { seed } = await import('./seed.js');
    await seed(db);
  }
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, fallthrough: false }));

const api = express.Router();
api.use(express.json({ limit: '100kb' }));
api.use(cookieParser());
api.use(loadUser);
api.get('/health', (_req, res) => res.json({ ok: true }));
api.use(authRoutes, catalogRoutes, cartRoutes, orderRoutes, sellerRoutes);
api.use((_req, _res, next) => next(Object.assign(new Error(), { status: 404 })));
api.use((err, req, res, next) => {
  if (err.status === 404 && !err.code) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such API endpoint' } });
  }
  errorHandler(err, req, res, next);
});
app.use('/api', api);

// The built React app + SPA fallback.
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'), { dotfiles: 'allow' });
  });
} else if (IS_PROD) {
  console.warn('client/dist not found — run "npm run build" first');
}

app.use(errorHandler);

if (IS_PROD || process.env.BACKUPS === 'true') scheduleDailyBackup(db);

const server = app.listen(PORT, () => {
  console.log(`Shuka running on http://localhost:${PORT}  (db: ${DB_PATH})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => { db.close(); process.exit(0); });
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
