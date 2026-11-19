import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const IS_PROD = process.env.NODE_ENV === 'production';
export const PORT = Number(process.env.PORT || 3000);
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
export const DB_PATH = path.join(DATA_DIR, 'shuka.db');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const BACKUP_DIR = path.join(DATA_DIR, 'backups');
export const CLIENT_DIST = path.join(ROOT, 'client', 'dist');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (IS_PROD) {
    // Don't crash the deploy: use a random secret for this process. Sessions then end on every restart.
    console.warn('WARNING: SESSION_SECRET is not set. Using a random one; users are logged out on every restart.');
    return crypto.randomBytes(32).toString('hex');
  }
  // Local development only: keep a generated secret next to the DB so sessions survive restarts.
  const file = path.join(DATA_DIR, '.dev-session-secret');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'));
  return fs.readFileSync(file, 'utf8').trim();
}
export const SESSION_SECRET = loadSecret();
