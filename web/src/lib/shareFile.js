// Share or open a stored document (FEATURES B7: PDFs open in the phone's own viewer).
// Share sheet with the file itself where the phone allows it (Android Chrome,
// iPhone Safari 15+); otherwise the file opens in a new tab, from where it can be
// saved or forwarded.
import { fetchFile } from '../api/client.js';

/** "/api/v1/documents/01…/file" → with ?download=1 when asked. */
export function fileHref(doc, download = false) {
  return download ? `${doc.fileUrl}?download=1` : doc.fileUrl;
}

export function openFile(doc) {
  window.open(fileHref(doc), '_blank', 'noopener');
}

/**
 * @returns {Promise<'shared'|'opened'|'cancelled'>}
 */
export async function shareFile(doc) {
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && typeof File === 'function') {
    try {
      const blob = await fetchFile(fileHref(doc));
      if (blob) {
        const file = new File([blob], doc.file?.originalName || doc.title, { type: blob.type || doc.file?.mimeType });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: doc.title });
          return 'shared';
        }
      }
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'; // the person closed the share sheet
    }
  }
  openFile(doc);
  return 'opened';
}
