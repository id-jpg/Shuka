import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { UPLOAD_DIR } from '../config.js';
import { HttpError } from './errors.js';

export const MAX_IMAGES = 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

/** Files stay in memory (max 5 x 5 MB) only until sharp has checked and resized them. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_IMAGES },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new HttpError(400, 'BAD_FILE_TYPE', `"${file.originalname}" is not a JPEG, PNG or WebP image`));
    }
    cb(null, true);
  },
});

export const imageUrls = (key) => key ? ({
  thumb: `/uploads/${key}-thumb.webp`,
  large: `/uploads/${key}-large.webp`,
}) : null;

/**
 * Verify the bytes really are an image (a renamed .exe fails here), then write
 * a 400px thumbnail and a 1200px large version. Returns the key stored in SQLite.
 */
export async function saveImage(productId, buffer, originalName = 'file') {
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new HttpError(400, 'BAD_IMAGE', `"${originalName}" is not a valid image file`);
  }
  if (!ALLOWED_FORMATS.has(meta.format)) {
    throw new HttpError(400, 'BAD_IMAGE', `"${originalName}" must be a JPEG, PNG or WebP image`);
  }
  const key = `${productId}/${crypto.randomUUID()}`;
  const base = path.join(UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(base), { recursive: true });
  const img = sharp(buffer).rotate(); // respect phone EXIF orientation
  await Promise.all([
    img.clone().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(`${base}-large.webp`),
    img.clone().resize(400, 400, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).webp({ quality: 78 }).toFile(`${base}-thumb.webp`),
  ]);
  return key;
}

export async function deleteImageFiles(key) {
  const base = path.join(UPLOAD_DIR, key);
  await Promise.allSettled([fs.unlink(`${base}-large.webp`), fs.unlink(`${base}-thumb.webp`)]);
}
