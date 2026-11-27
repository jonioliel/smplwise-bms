/**
 * A11Y-FOLLOWUPS-2560: the one announcer of the app. A screen reader announces a live region reliably only when the region already exists
 * and its text CHANGES; a `role="status"` rendered together with its message ("arrives filled") is often missed. So the app keeps exactly
 * two regions that are always present and empty - one polite, one assertive - in the document body (light DOM: no shadow root between
 * the region and the reader), and every outcome line (success, "unknown", refused) writes its text into one of them.
 *
 * - `announce(text)`: polite - a success or a neutral result; it waits for the reader to finish.
 * - `announce(text, 'assertive')`: an "unknown" or refused outcome the person must hear now.
 * - `mountAnnouncer()`: called by the app shell at start-up so the regions exist before the first message; `announce` also mounts them.
 *
 * The same text twice in a row is still announced (the region is cleared, then filled one frame later). The visible outcome line next to
 * the control keeps its text but carries no live role of its own, so nothing is read twice.
 */
type AnnounceMode = 'polite' | 'assertive';

const HOST_ID = 'sw-announcer';
const CLEAR_AFTER_MS = 6000;
const timers: Record<AnnounceMode, ReturnType<typeof setTimeout> | undefined> = { polite: undefined, assertive: undefined };

/** FIX-NOSCROLL-2560: `position:fixed` pinned to the viewport's top corner, 1px. The host is the LAST child of the body; with
 * `position:absolute` and no offsets it sat at its static place below the full-height app shell and its 1em box made the document
 * 14-15px taller than the viewport - the page scrolled on every control screen. A fixed box never adds to the document's scroll area. */
const visuallyHidden =
  'position:fixed;inset-block-start:0;inset-inline-start:0;inline-size:1px;block-size:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;margin:0;padding:0;border:0;pointer-events:none';

function region(mode: AnnounceMode): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-sw-announcer', '');
    host.setAttribute('style', visuallyHidden);
    for (const m of ['polite', 'assertive'] as const) {
      const r = document.createElement('div');
      r.setAttribute('data-announce', m);
      r.setAttribute('role', m === 'polite' ? 'status' : 'alert');
      r.setAttribute('aria-live', m);
      r.setAttribute('aria-atomic', 'true');
      host.appendChild(r);
    }
    document.body.appendChild(host);
  }
  return host.querySelector<HTMLElement>(`[data-announce="${mode}"]`);
}

export function mountAnnouncer(): void {
  region('polite');
}

export function announce(text: string, mode: AnnounceMode = 'polite'): void {
  const msg = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!msg) return;
  const el = region(mode);
  if (!el) return;
  el.textContent = '';
  const prior = timers[mode];
  if (prior) clearTimeout(prior);
  // a region that was just created needs a moment before its first change is noticed; a repeat needs the empty frame
  const fill = () => {
    el.textContent = msg;
    timers[mode] = setTimeout(() => (el.textContent = ''), CLEAR_AFTER_MS);
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(fill, 30));
  else setTimeout(fill, 30);
}
