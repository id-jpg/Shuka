import Database from 'better-sqlite3';
import { DB_PATH } from './config.js';
import { migrate } from './migrate.js';

/** Open a connection with the pragmas every Shuka connection must have. */
export function openDb(file = DB_PATH) {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');   // readers don't block the writer
  db.pragma('busy_timeout = 5000');  // wait instead of failing with SQLITE_BUSY
  db.pragma('foreign_keys = ON');    // off by default in SQLite
  db.pragma('synchronous = NORMAL');
  return db;
}

export const db = openDb();
migrate(db); // schema must exist before any module prepares statements
export const now = () => new Date().toISOString();

/** Run fn inside BEGIN IMMEDIATE ... COMMIT (rolls back if fn throws). */
export function writeTx(fn) {
  return db.transaction(fn).immediate();
}
