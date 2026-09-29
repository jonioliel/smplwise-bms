/**
 * Review G (owner 2026-09-29, "unnecessary scrolling"): a read-only diagnostic of what makes the app's scroll area
 * (sw-app's `main`) taller than its view. Off by default; opening the app with `?debug=overflow` in the address (before
 * the #) installs `window.__arxOverflow()`, which returns - and logs - the scroll facts of every scroll container that
 * scrolls, and the elements whose bottom edge lies furthest down in `main`'s scroll area (in shadow roots too, hidden
 * ones included and marked), so the element that defines a needless scroll height can be named on a real installation.
 * It changes nothing on the page.
 */

interface OverflowRow {
  path: string;
  bottom: number;
  height: number;
  hidden: boolean;
  position: string;
}

function label(el: Element): string {
  const cls = typeof (el as HTMLElement).className === 'string' && (el as HTMLElement).className ? `.${(el as HTMLElement).className.trim().split(/\s+/).join('.')}` : '';
  const data = Array.from(el.attributes).find((a) => a.name.startsWith('data-'));
  return `${el.tagName.toLowerCase()}${cls}${data ? `[${data.name}=${data.value}]` : ''}`;
}

function pathOf(el: Element): string {
  const parts: string[] = [];
  let n: Node | null = el;
  while (n && parts.length < 6) {
    if (n instanceof Element) parts.unshift(label(n));
    n = n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentNode;
  }
  return parts.join(' > ');
}

/** `el` lies inside `root` in the composed tree (through shadow roots). */
function within(root: Element, el: Element): boolean {
  let n: Node | null = el;
  while (n) {
    if (n === root) return true;
    n = n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentNode;
  }
  return false;
}

export function overflowReport(limit = 15) {
  const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main') as HTMLElement | null;
  const scrollers: { path: string; scrollHeight: number; clientHeight: number }[] = [];
  const rows: OverflowRow[] = [];
  const mTop = main ? main.getBoundingClientRect().top - main.scrollTop : 0;
  const walk = (root: Document | ShadowRoot) => {
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) scrollers.push({ path: pathOf(el), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
      if (main && within(main, el)) {
        const r = el.getBoundingClientRect();
        if (r.height > 0 || r.width > 0) rows.push({ path: pathOf(el), bottom: Math.round(r.bottom - mTop), height: Math.round(r.height), hidden: cs.visibility === 'hidden' || cs.opacity === '0', position: cs.position });
      }
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  rows.sort((a, b) => b.bottom - a.bottom);
  const report = {
    main: main ? { scrollHeight: main.scrollHeight, clientHeight: main.clientHeight, scrolls: main.scrollHeight > main.clientHeight + 1 } : null,
    page: { scrollHeight: document.scrollingElement?.scrollHeight ?? 0, clientHeight: document.scrollingElement?.clientHeight ?? 0 },
    scrollers,
    deepest: rows.slice(0, limit),
  };
  console.table(report.deepest);
  return report;
}

export function installOverflowDebug() {
  try {
    if (new URLSearchParams(window.location.search).get('debug') === 'overflow') (window as unknown as { __arxOverflow: typeof overflowReport }).__arxOverflow = overflowReport;
  } catch {
    /* no window */
  }
}
