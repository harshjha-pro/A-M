// Workspaces and the Attachment Vault (1.0.17). Ayush and Mahi only; online only.
// Files of any size go up in 2 MB pieces (hosts cap one request at ~4.5 MB): start → each
// missing piece (tried up to 3 times) → finish, then the attachment is made from the upload.
// A file already in the Vault (same SHA-256) is not sent again.
import { useQuery } from '@tanstack/react-query';
import { api, upload, newIdemKey } from '../api/client.js';
import { withRelogin } from '../api/auth.js';
import { compressImage } from '../lib/compressImage.js';
import { sha256Hex, formatBytes } from './documents.js';
import { t } from '../i18n/strings.en.js';

export const KINDS = ['photo', 'video', 'document', 'link', 'text'];
export const CODE_RE = /^[A-Za-z0-9_-]{3,30}$/;
export const SECTIONS = {
  general: 'Files', bride_outfit: 'Bride outfit', groom_outfit: 'Groom outfit', family_outfit: 'Family outfits',
  decor: 'Theme & decoration', menu: 'Menu', contacts: 'Contacts', guests: 'Guest details', timeline: 'Event timeline',
};
export { formatBytes };

export function useWorkspaces() {
  return useQuery({ queryKey: ['workspaces'], queryFn: () => api('GET', '/workspaces').then((r) => r.data) });
}

export function useWorkspace(id) {
  return useQuery({ queryKey: ['workspace', id], queryFn: () => api('GET', `/workspaces/${id}`).then((r) => r.data), enabled: Boolean(id) });
}

/** Attachments for a place (workspace + section) or the whole Vault with filters. */
export function useAttachments(query, enabled = true) {
  return useQuery({
    queryKey: ['attachments', query],
    queryFn: () => api('GET', '/attachments', { query }).then((r) => ({ items: r.data, meta: r.meta })),
    enabled,
  });
}

/** What kind a picked file is. */
export function kindOf(file) {
  if (/^image\//.test(file.type)) return 'photo';
  if (/^video\//.test(file.type)) return 'video';
  return 'document';
}

/**
 * A picked file → a finished upload id. Photos are made small first (like Documents);
 * everything else goes as it is, any size.
 * @returns {Promise<{ uploadId: string, kind: string, name: string }>}
 */
export async function sendFile(file, { onProgress } = {}) {
  const kind = kindOf(file);
  let blob = file;
  let name = file.name || 'file';
  if (kind === 'photo' && !/gif$/.test(file.type)) {
    try {
      const out = await compressImage(file);
      blob = out.blob;
      name = out.name;
    } catch { /* a photo the phone can't redraw goes as it is */ }
  }
  const sha256 = await sha256Hex(blob);
  const start = await withRelogin(() => api('POST', '/attachment-uploads', { body: { name: name.slice(0, 255), mimeType: blob.type || 'application/octet-stream', sizeBytes: blob.size, sha256 } }));
  const up = start.data;
  if (!up.complete) {
    const have = new Set(up.received);
    let sent = have.size;
    for (let seq = 0; seq < up.chunkCount; seq++) {
      if (have.has(seq)) continue;
      const piece = blob.slice(seq * up.chunkSize, Math.min(blob.size, (seq + 1) * up.chunkSize));
      let tries = 0;
      for (;;) {
        try {
          await withRelogin(() => upload(`/attachment-uploads/${up.uploadId}/chunks`, { seq: String(seq), chunk: [piece, 'blob'] }, { idemKey: newIdemKey() }));
          break;
        } catch (e) {
          tries += 1;
          if (tries >= 3) throw e;
        }
      }
      sent += 1;
      onProgress?.(sent / up.chunkCount);
    }
    await withRelogin(() => api('POST', `/attachment-uploads/${up.uploadId}/finish`, { body: {} }));
  }
  onProgress?.(1);
  return { uploadId: up.uploadId, kind, name };
}

/** Make an attachment (file, link or text), optionally used in a place at once. */
export function createAttachment(body) {
  return withRelogin(() => api('POST', '/attachments', { body, idemKey: newIdemKey() })).then((r) => r.data);
}

/** "Mehndi › Bride outfit" paths of an attachment, for lists. */
export function paths(a) {
  return (a.usedIn ?? []).map((u) => u.path);
}

export function codeHelp() {
  return t('vault.codeHelp');
}
