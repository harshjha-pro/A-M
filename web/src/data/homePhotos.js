// Home photos (1.0.16): the cover slideshow, couple photos and monogram. The bytes are
// stored in the database; the service worker keeps a copy of each image on the phone.
import { useQuery } from '@tanstack/react-query';
import { api, upload, newIdemKey } from '../api/client.js';
import { withRelogin } from '../api/auth.js';
import { compressImage } from '../lib/compressImage.js';
import { sha256Hex, formatBytes } from './documents.js';
import { t } from '../i18n/strings.en.js';

export const SLOTS = ['cover', 'couple', 'monogram'];
export const MAX = { cover: 8, couple: 4, monogram: 1 };
export const MAX_BYTES = 3 * 1024 * 1024;
export const ACCEPT = 'image/jpeg,image/png,image/webp';

/** Every live photo, grouped: { cover: [...], couple: [...], monogram: [...] }. */
export function groupPhotos(list = []) {
  const out = { cover: [], couple: [], monogram: [] };
  for (const p of list) if (out[p.slot]) out[p.slot].push(p);
  for (const s of SLOTS) out[s].sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : 1));
  return out;
}

export function useHomePhotos() {
  return useQuery({
    queryKey: ['home-photos'],
    queryFn: () => api('GET', '/home-photos').then((r) => groupPhotos(r.data)),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * A picked file → what will be sent. A monogram PNG/WebP under 1 MB is kept as it is,
 * so a see-through background stays see-through; everything else is made small (JPEG).
 */
export async function prepareHomePhoto(file, slot) {
  const keep = slot === 'monogram' && /^image\/(png|webp)$/.test(file.type) && file.size <= 1024 * 1024;
  const out = keep ? { blob: file, name: file.name || 'monogram.png', type: file.type } : await compressImage(file);
  if (out.type === 'application/pdf') {
    const err = new Error(t('homePhotos.onlyPhotos'));
    err.code = 'unsupported_type';
    throw err;
  }
  if (out.blob.size > MAX_BYTES) {
    const err = new Error(t('homePhotos.tooBig', { size: formatBytes(out.blob.size) }));
    err.code = 'file_too_big';
    throw err;
  }
  return { ...out, sha256: await sha256Hex(out.blob), idemKey: newIdemKey() };
}

export function uploadHomePhoto(prepared, slot, onProgress) {
  const fields = { file: [prepared.blob, prepared.name], sha256: prepared.sha256, slot };
  return withRelogin(() => upload('/home-photos', fields, { idemKey: prepared.idemKey, onProgress }));
}
