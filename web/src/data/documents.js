// Document helpers (FEATURES B7): types, who may edit, checksum, and one upload that
// survives a login ending mid-way (401 → login sheet → the in-memory file is sent again).
import { useQuery } from '@tanstack/react-query';
import { api, upload, newIdemKey } from '../api/client.js';
import { withRelogin } from '../api/auth.js';
import { compressImage, MAX_BYTES } from '../lib/compressImage.js';
import { t } from '../i18n/strings.en.js';

export const DOC_TYPES = ['receipt', 'contract', 'quotation', 'booking', 'id', 'photo', 'other'];
// No HEIC here on purpose: iPhone Safari then hands over a JPEG copy of HEIC photos.
export const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

export const isImageDoc = (d) => /^image\//.test(d.file?.mimeType || '');

/** Family edits and deletes their own uploads; Owner and Partner everything (FEATURES B7). */
export function canChange(doc, user, permissions) {
  if (permissions?.admin) return true;
  return Boolean(permissions?.edit && doc.createdBy?.id && doc.createdBy.id === user?.id);
}

/** 1,234,567 bytes → "1.2 MB"; 14,000,000 → "14 MB" (same wording as the server). */
export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  const mb = n / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

async function readBuffer(blob) {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
}

/** Lowercase hex SHA-256 — the server checks it against what arrived (API.md §8.2). */
export async function sha256Hex(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await readBuffer(blob));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A picked file → what will be sent. Images are compressed once; the result stays in
 * memory so Try again and the re-upload after login send the same bytes.
 * Throws HeicError / UnsupportedError / a too-big Error with the server's wording.
 */
export async function prepareFile(file) {
  const out = await compressImage(file);
  if (out.blob.size > MAX_BYTES) {
    const err = new Error(t('documents.tooBig', { size: formatBytes(out.blob.size) }));
    err.code = 'file_too_big';
    throw err;
  }
  return { ...out, sha256: await sha256Hex(out.blob), idemKey: newIdemKey() };
}

/**
 * @param {{ blob: Blob, name: string, sha256: string, idemKey: string }} prepared
 * @param {{ type: string, title?: string, isPrivate?: boolean, paymentId?: string, vendorId?: string, eventId?: string, allowDuplicate?: boolean }} details
 */
export function uploadDocument(prepared, details, onProgress) {
  const fields = {
    file: [prepared.blob, prepared.name],
    sha256: prepared.sha256,
    type: details.type,
    title: details.title?.trim() || undefined,
    isPrivate: details.isPrivate === undefined ? undefined : String(details.isPrivate),
    paymentId: details.paymentId,
    vendorId: details.vendorId,
    eventId: details.eventId,
    allowDuplicate: details.allowDuplicate ? 'true' : undefined,
  };
  return withRelogin(() => upload('/documents', fields, { idemKey: prepared.idemKey, onProgress }));
}

/** Documents linked to a payment, vendor or event (the sections on those pages). */
export function useLinkedDocuments(link, enabled = true) {
  return useQuery({
    queryKey: ['documents', 'linked', link],
    queryFn: () => api('GET', '/documents', { query: { ...link, limit: 50 } }).then((r) => r.data),
    enabled,
  });
}
