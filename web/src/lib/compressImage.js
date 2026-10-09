// Photos are made small on the phone before upload (FEATURES B7, AC-DOC-01):
// longest side 1,600 px, JPEG 80%, orientation fixed. Drawing to a canvas and
// re-encoding keeps only pixels, so EXIF (GPS, camera, time) is gone.
// PDFs pass through untouched. iPhone Safari decodes HEIC itself; where it can't,
// the person is asked to share a JPEG instead.

export const MAX_SIDE = 1600;
export const QUALITY = 0.8;
export const MAX_BYTES = 10 * 1024 * 1024;

export class HeicError extends Error {
  constructor() { super('Please share it as a JPEG photo.'); this.code = 'heic_not_supported'; }
}
export class UnsupportedError extends Error {
  constructor() { super('This file type is not allowed. Use JPEG, PNG, WebP or PDF.'); this.code = 'unsupported_type'; }
}

const IMAGE = /^image\/(jpeg|png|webp|heic|heif)$/;

export function isHeic(file) {
  return /^image\/hei[cf]$/.test(file.type) || /\.hei[cf]$/i.test(file.name || '');
}

export function isPdf(file) {
  return file.type === 'application/pdf' || (!file.type && /\.pdf$/i.test(file.name || ''));
}

export function isImage(file) {
  return IMAGE.test(file.type) || isHeic(file) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name || ''));
}

/** The size to draw at: longest side at most `max`, never enlarged, whole pixels. */
export function fitSize(width, height, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** "IMG_2041.HEIC" → "IMG_2041.jpg" */
export function jpegName(name) {
  const base = (name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.jpg`;
}

async function decode(file) {
  // createImageBitmap applies the EXIF orientation (Chrome, Safari 15+); <img> does too
  // in every current browser (image-orientation: from-image is the default).
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * @param {File} file
 * @returns {Promise<{ blob: Blob, name: string, type: string, width?: number, height?: number }>}
 */
export async function compressImage(file) {
  if (isPdf(file)) return { blob: file, name: file.name || 'document.pdf', type: 'application/pdf' };
  if (!isImage(file)) throw new UnsupportedError();
  let src;
  try {
    src = await decode(file);
  } catch {
    if (isHeic(file)) throw new HeicError();
    throw new UnsupportedError();
  }
  const w = src.naturalWidth || src.width;
  const h = src.naturalHeight || src.height;
  const size = fitSize(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // PNG transparency → white, not black
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, size.width, size.height);
  src.close?.();
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new UnsupportedError())), 'image/jpeg', QUALITY));
  canvas.width = 0; // free the memory at once on low-end phones
  return { blob, name: jpegName(file.name), type: 'image/jpeg', ...size };
}
