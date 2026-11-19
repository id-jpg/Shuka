import { badRequest, notFound } from './errors.js';

/**
 * Collects per-field errors and throws one 400 with { fields } at the end.
 * With partial=true, missing fields are skipped (for PATCH).
 */
export function validator(src = {}, { partial = false } = {}) {
  const errors = {};
  const out = {};
  const missing = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

  const api = {
    str(name, { label = name, min = 1, max = 200, optional = false, pattern, patternMsg } = {}) {
      const v = src[name];
      if (missing(v)) {
        if (optional) { if (!partial || v !== undefined) out[name] = ''; return api; }
        if (partial && v === undefined) return api;
        errors[name] = `${label} is required`;
        return api;
      }
      if (typeof v !== 'string') { errors[name] = `${label} must be text`; return api; }
      const s = v.trim();
      if (s.length < min) errors[name] = `${label} must be at least ${min} characters`;
      else if (s.length > max) errors[name] = `${label} must be at most ${max} characters`;
      else if (pattern && !pattern.test(s)) errors[name] = patternMsg || `${label} is not valid`;
      else out[name] = s;
      return api;
    },
    int(name, { label = name, min = -Infinity, max = Infinity, optional = false } = {}) {
      const v = src[name];
      if (missing(v)) {
        if (optional || (partial && v === undefined)) return api;
        errors[name] = `${label} is required`;
        return api;
      }
      const n = typeof v === 'number' ? v : (/^-?\d+$/.test(String(v).trim()) ? Number(v) : NaN);
      if (!Number.isSafeInteger(n)) errors[name] = `${label} must be a whole number`;
      else if (n < min) errors[name] = `${label} must be at least ${min}`;
      else if (n > max) errors[name] = `${label} must be at most ${max}`;
      else out[name] = n;
      return api;
    },
    bool(name, { label = name } = {}) {
      const v = src[name];
      if (v === undefined) return api;
      if (typeof v !== 'boolean') errors[name] = `${label} must be true or false`;
      else out[name] = v;
      return api;
    },
    oneOf(name, list, { label = name } = {}) {
      const v = src[name];
      if (missing(v)) { if (!(partial && v === undefined)) errors[name] = `${label} is required`; return api; }
      if (!list.includes(v)) errors[name] = `${label} must be one of: ${list.join(', ')}`;
      else out[name] = v;
      return api;
    },
    fail(name, message) { errors[name] = message; return api; },
    done() {
      if (Object.keys(errors).length) throw badRequest('Please fix the highlighted fields', errors);
      return out;
    },
  };
  return api;
}

export const PHONE = /^\+?[0-9][0-9 ()-]{6,18}[0-9]$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const REGIONS = [
  'Yerevan', 'Aragatsotn', 'Ararat', 'Armavir', 'Gegharkunik', 'Kotayk',
  'Lori', 'Shirak', 'Syunik', 'Tavush', 'Vayots Dzor',
];

/** Parse a positive integer route param or throw 404. */
export function idParam(v) {
  const n = /^\d+$/.test(String(v)) ? Number(v) : NaN;
  if (!Number.isSafeInteger(n) || n < 1) throw notFound();
  return n;
}
