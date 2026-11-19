import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, now } from '../db.js';
import { validator, EMAIL, PHONE } from '../lib/validate.js';
import { setSession, clearSession, requireAuth, publicUser } from '../lib/auth.js';
import { HttpError, conflict } from '../lib/errors.js';

const r = Router();

r.post('/auth/register', async (req, res) => {
  const v = validator(req.body)
    .str('email', { label: 'Email', max: 200, pattern: EMAIL, patternMsg: 'Enter a valid email address' })
    .str('password', { label: 'Password', min: 8, max: 200 })
    .str('name', { label: 'Name', min: 2, max: 100 })
    .str('phone', { label: 'Phone', pattern: PHONE, patternMsg: 'Enter a valid phone number, e.g. +374 91 123456' })
    .done();
  const hash = await bcrypt.hash(req.body.password, 10);
  let info;
  try {
    info = db.prepare('INSERT INTO users (email, password_hash, name, phone, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(v.email.toLowerCase(), hash, v.name, v.phone, now());
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw conflict('EMAIL_TAKEN', 'An account with this email already exists', { fields: { email: 'This email is already registered' } });
    }
    throw e;
  }
  setSession(res, info.lastInsertRowid);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user: publicUser(user) });
});

r.post('/auth/login', async (req, res) => {
  const v = validator(req.body).str('email', { label: 'Email' }).str('password', { label: 'Password' }).done();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(v.email);
  const ok = user && await bcrypt.compare(req.body.password, user.password_hash);
  if (!ok) throw new HttpError(401, 'BAD_CREDENTIALS', 'Wrong email or password');
  setSession(res, user.id);
  res.json({ user: publicUser(user) });
});

r.post('/auth/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

r.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

r.patch('/me', requireAuth, (req, res) => {
  const v = validator(req.body, { partial: true })
    .str('name', { label: 'Name', min: 2, max: 100 })
    .str('phone', { label: 'Phone', pattern: PHONE, patternMsg: 'Enter a valid phone number' })
    .done();
  db.prepare('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?')
    .run(v.name ?? null, v.phone ?? null, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

export default r;
