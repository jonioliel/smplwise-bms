/**
 * CR-038 slice 9 (spec 11A.6A): opening the phone's own camera app or the gallery / file picker from the vendor page.
 *
 * Release 1 uses `<input type="file" capture="environment">` (the native camera app) - never a live in-page camera stream, so the public CSP and
 * `Permissions-Policy: camera=()` stay as they are. This module is in the claim step's own chunk (NOT the lazy editor chunk): the
 * picker must be opened synchronously inside the tap's handler, before any `await`, or browsers drop the user activation.
 *
 * "No file returned" (camera refused by the OS, an in-app browser that ignores `capture`, a desktop, or the person backed out):
 * resolved as `null` from the input's `cancel` event where the browser has one, else when the window gets its focus back and no
 * `change` came within a grace period. A `change` that arrives after that (a slow camera app) still reaches `onLate`.
 */

export type PickKind = 'camera' | 'gallery' | 'pdf';

export const ACCEPT: Readonly<Record<PickKind, string>> = {
  camera: 'image/jpeg,image/png',
  gallery: 'image/jpeg,image/png',
  pdf: 'application/pdf',
};

/** How long after the window regains focus a missing `change` counts as "no file" (camera apps can take a moment to hand over). */
export const FOCUS_GRACE_MS = 2500;

export interface PickOptions {
  /** a `change` after the picker was already resolved as "no file" */
  onLate?: (file: File) => void;
  /** where the hidden input lives while the picker is open (default document.body) */
  host?: HTMLElement;
}

/** Opens the picker; call it synchronously inside a click handler. */
export function pickFile(kind: PickKind, opts: PickOptions = {}): Promise<File | null> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ACCEPT[kind];
  if (kind === 'camera') input.setAttribute('capture', 'environment');
  input.hidden = true;
  (opts.host ?? document.body).appendChild(input);
  return new Promise<File | null>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      window.removeEventListener('focus', onFocus);
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const finish = (file: File | null) => {
      if (settled) {
        if (file && opts.onLate) opts.onLate(file);
        input.remove();
        return;
      }
      settled = true;
      cleanup();
      if (file) input.remove();
      // a "no file" input stays attached a little longer so a late `change` is still heard
      else setTimeout(() => input.remove(), 60_000);
      resolve(file);
    };
    const onFocus = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => finish(null), FOCUS_GRACE_MS);
    };
    input.addEventListener('change', () => finish(input.files && input.files.length ? input.files[0] : null));
    input.addEventListener('cancel', () => finish(null));
    // focus returns to the window when the picker / camera app closes
    setTimeout(() => window.addEventListener('focus', onFocus), 300);
    try {
      input.click();
    } catch {
      finish(null);
    }
  });
}

/** In-app browsers (WhatsApp, Facebook, Instagram, Telegram, Android WebView) that may ignore `capture` or the camera - the page
 * then adds "open in browser" advice. A heuristic on the user agent; UNVERIFIED on real devices for every app version. */
export function looksInApp(ua: string): boolean {
  return /WhatsApp|FBAN|FBAV|FB_IAB|Instagram|Line\/|Telegram|MicroMessenger|; wv\)/i.test(ua || '');
}

export function looksIos(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua || '');
}

/** What a picked file is - by its declared type, then by its name (the server sniffs the bytes; this only routes the UI). */
export function fileKind(file: { type?: string; name?: string }): 'photo' | 'pdf' | 'other' {
  const t = (file.type || '').toLowerCase();
  const n = (file.name || '').toLowerCase();
  if (t === 'application/pdf' || (!t && n.endsWith('.pdf'))) return 'pdf';
  if (t.startsWith('image/') || /\.(jpe?g|png|heic|heif)$/.test(n)) return 'photo';
  return 'other';
}
