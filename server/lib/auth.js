import crypto from 'node:crypto';
import { db } from '../db.js';
import { SESSION_SECRET, IS_PROD } from '../config.js';
import { unauthorized, forbidden } from './errors.js';

const COOKIE = 'shuka_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const hmac = (data) => crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');

function sign(userId) {
  const payload = `${userId}.${Date.now() + MAX_AGE_MS}`;
  return `${payload}.${hmac(payload)}`;
}

function verify(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  const expected = hmac(`${uid}.${exp}`);
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now()) return null;
  return Number(uid);
}

export function setSession(res, userId) {
  res.cookie(COOKIE, sign(userId), {
    httpOnly: true, sameSite: 'lax', secure: IS_PROD, maxAge: MAX_AGE_MS, path: '/',
  });
}
export function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, path: '/' });
}

const findUser = db.prepare('SELECT id, email, name, phone, store_name, created_at FROM users WHERE id = ?');

/** Attach req.user (or null) from the signed httpOnly cookie. */
export function loadUser(req, _res, next) {
  const uid = verify(req.cookies?.[COOKIE]);
  req.user = uid ? findUser.get(uid) || null : null;
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireSeller(req, _res, next) {
  if (!req.user) return next(unauthorized());
  if (!req.user.store_name) return next(forbidden('Become a seller first', 'NOT_SELLER'));
  next();
}

export const publicUser = (u) => u && ({
  id: u.id, email: u.email, name: u.name, phone: u.phone,
  storeName: u.store_name, isSeller: !!u.store_name,
});
