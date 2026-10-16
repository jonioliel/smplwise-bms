/**
 * CR-038 slice 4: the handler page's only way to build DOM. Text is ALWAYS a text node (`textContent` semantics) - never
 * innerHTML / insertAdjacentHTML / document.write, never a link built from anything a person typed (review W20, spec 16: no
 * auto-linkify): a URL a vendor writes in a note stays plain text. tests/unit-public-ticket.spec.ts scans the bundle's sources.
 */

type Child = Node | string | number | null | undefined | false;

export interface Props {
  class?: string;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  on?: Partial<Record<keyof HTMLElementEventMap, (e: Event) => void>>;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props?.class) el.className = props.class;
  for (const [k, v] of Object.entries(props?.attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'href' || k === 'src' || k.startsWith('on')) continue; // never an attribute that navigates or runs code
    el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const [ev, fn] of Object.entries(props?.on ?? {})) if (fn) el.addEventListener(ev, fn as EventListener);
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

/** A picture shown from a blob: URL (the only image source the CSP allows besides the page's own files). */
export function img(blobUrl: string, alt: string, cls: string): HTMLImageElement {
  const el = document.createElement('img');
  el.className = cls;
  el.alt = alt;
  if (blobUrl.startsWith('blob:')) el.src = blobUrl;
  return el;
}

/** A tiny inline icon (static path data from this file only - no external sprite, no data: URL). */
const ICONS: Record<string, string> = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.6-.6-2.5z',
  box: 'M4 7.5L12 3l8 4.5v9L12 21l-8-4.5zM4 7.5l8 4.5 8-4.5M12 12v9',
  done: 'M4 12.5l5 5L20 6.5',
  camera: 'M4 8h3l2-2.5h6L17 8h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  send: 'M4 12l16-8-6 16-2.5-6.5z',
  back: 'M10 7l-5 5 5 5M5 12h12a3 3 0 0 1 3 3v2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  device: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  out: 'M14 5h5v14h-5M10 8l-4 4 4 4M6 12h10',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
};

export function icon(name: keyof typeof ICONS | string): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ic');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICONS[name] ?? '');
  svg.appendChild(path);
  return svg;
}
