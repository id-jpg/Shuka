import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BACKUP_DIR } from './config.js';

const KEEP = 7;

/** Copy the live database with VACUUM INTO (safe while the app is running). Keeps the last 7 days. */
export function backup(db) {
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(BACKUP_DIR, `shuka-${day}.db`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  db.prepare('VACUUM INTO ?').run(file);
  const old = fs.readdirSync(BACKUP_DIR).filter((f) => /^shuka-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -KEEP);
  for (const f of old) fs.unlinkSync(path.join(BACKUP_DIR, f));
  return file;
}

/** Called by the server: back up once at start (if today's copy is missing), then every 24 h. */
export function scheduleDailyBackup(db) {
  const run = () => {
    try { console.log('backup: wrote', backup(db)); } catch (e) { console.error('backup failed:', e.message); }
  };
  const today = path.join(BACKUP_DIR, `shuka-${new Date().toISOString().slice(0, 10)}.db`);
  if (!fs.existsSync(today)) setTimeout(run, 10_000).unref();
  setInterval(run, 24 * 3600 * 1000).unref();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { db } = await import('./db.js');
  console.log('backup: wrote', backup(db));
}
