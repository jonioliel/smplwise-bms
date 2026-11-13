/**
 * CR-API-BLOB-2436 (docs/changes/CR-API-BLOB-2436.md): saving a binary answer to disk. One copy of the temporary-link download
 * and of the `Content-Disposition` file name; the bytes themselves come from `apiBlob` in ./client (same credentials, 401 retry
 * and error model as every JSON call). Moved here from api/tickets-costs.ts, which re-exports both names.
 */

/** The file name of a `Content-Disposition` answer (or the fallback). */
export function dispositionName(header: string | null, fallback: string): string {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header ?? '');
  try {
    return m ? decodeURIComponent(m[1]) : fallback;
  } catch {
    return m ? m[1] : fallback;
  }
}

/** Save a blob under a name through a temporary link (the browser's own download; nothing is rendered by the app). */
export function saveBlob(blob: Blob, name: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
}
