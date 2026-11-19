import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/** Apply numbered .sql files whose number is above PRAGMA user_version. */
export function migrate(db, { log = console.log } = {}) {
  const current = db.pragma('user_version', { simple: true });
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
  let applied = 0;
  for (const file of files) {
    const version = parseInt(file, 10);
    if (version <= current) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${version}`);
    })();
    log(`migrate: applied ${file}`);
    applied++;
  }
  if (!applied) log(`migrate: database is up to date (version ${current})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await import('./db.js'); // opening the DB applies pending migrations
}
