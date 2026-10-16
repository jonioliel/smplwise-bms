/**
 * VPORTAL: the organisation's mark at the top of every public screen (handler page, quote request page, vendor portal). With a logo
 * set in Settings it is that picture - a separate image file of the public listener (`<prefix>/brand/<stamp>.jpg`: same origin, which
 * the CSP's `img-src 'self'` allows; re-encoded on the server, never part of a bundle; its name carries its stamp, so the browser keeps
 * it `immutable`); without one, or when it fails to load, the first letter of the organisation name, as before. The name is checked
 * against the server's exact shape before it becomes a path - nothing else ever reaches the address.
 */
import { withBase } from './base';
import { h } from './dom';

function initial(org: string): HTMLElement {
  return h('div', { class: 'avatar', attrs: { 'aria-hidden': 'true' } }, (org.trim()[0] ?? '#').toUpperCase());
}

export function brandMark(org: string, logo: string | null | undefined): HTMLElement {
  if (!logo || !/^[0-9a-f]{16}\.jpg$/.test(logo)) return initial(org);
  const el = document.createElement('img');
  el.className = 'avatar brand-logo';
  el.alt = org;
  el.addEventListener('error', () => el.replaceWith(initial(org)));
  el.src = withBase(`/t/brand/${logo}`);
  return el;
}
