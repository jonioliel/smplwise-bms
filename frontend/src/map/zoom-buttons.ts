/**
 * PLAN3D-FURNMERGE-2434: the 3D map's + / - zoom buttons (round-28 mockup, map3d/app pills.html: a glass chip bar of two
 * icon buttons in the bottom corner opposite the view bar). Kept out of sw-plan-3d.ts so the element's own overlays merge
 * cleanly with the other 3D branches: the element adds ZOOM_CSS to its styles, renders `renderZoom` and calls the view.
 *
 * Placement: the bar's inline end (the left edge in the RTL shell), on the bar's row while that row leaves the group
 * room, else just above the bar's row (watchZoomRoom / zoomPlace) - the bar never wraps for it, so the framing of every
 * view stays as it was; the floor strip stands on the bar's other side, that corner's notes move above the group. Hidden
 * on an element under ZOOM_MIN_HOST px (a phone, an event's card: a pinch / the wheel zooms; the mockup hides it on a
 * phone too), in the walk and on the wall display's bare view.
 */
import { html, css, nothing } from 'lit';
import '../components/sw-icon';

/** One press: the view 1.35x closer (+) or farther (-). */
export const ZOOM_STEP = 1.35;
/** The group's inline size plus a gap to the bar's last chip. */
export const ZOOM_W = 100;
/** Below this element width (a phone, an event card) the group is not shown. */
export const ZOOM_MIN_HOST = 700;

/** Where the group stands (pure: the element's width, the bar's width; the bar starts 12 px in): on the bar's `row`,
 * `above` it, or nowhere (null) on a narrow element. */
export function zoomPlace(hostW: number, barW: number): 'row' | 'above' | null {
  if (hostW < ZOOM_MIN_HOST) return null;
  return hostW - 12 - barW - 12 >= ZOOM_W ? 'row' : 'above';
}

/** Keep `data-zoom-room` (row / above) on the host, absent where the group is not shown (the host and the bar observed). */
export function watchZoomRoom(host: HTMLElement, bar: HTMLElement): ResizeObserver | undefined {
  if (typeof ResizeObserver === 'undefined') return undefined;
  const sync = () => {
    const at = zoomPlace(host.clientWidth, bar.getBoundingClientRect().width);
    if (at) host.setAttribute('data-zoom-room', at);
    else host.removeAttribute('data-zoom-room');
  };
  const ro = new ResizeObserver(sync);
  ro.observe(host);
  ro.observe(bar);
  sync();
  return ro;
}

export const ZOOM_CSS = css`
  .zoom {
    position: absolute;
    inset-inline-end: 12px;
    inset-block-end: 12px;
    z-index: var(--sw-z-map-ui);
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--sw-r-pill);
    background: var(--sw-menu-surface);
    border: 1px solid var(--sw-border-strong);
    box-shadow: var(--sw-shadow-1);
    direction: rtl;
  }
  .zoom button {
    display: inline-grid;
    place-items: center;
    inline-size: 36px;
    block-size: 30px;
    padding: 0;
    border: 0;
    border-radius: var(--sw-r-pill);
    background: transparent;
    color: var(--sw-text-2);
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s, transform 0.12s;
  }
  .zoom button:hover {
    background: color-mix(in srgb, var(--sw-menu-surface) 88%, var(--sw-text));
    color: var(--sw-text);
  }
  .zoom button:active {
    transform: scale(0.94);
  }
  .zoom button:focus-visible {
    outline: 2px solid var(--sw-accent);
    outline-offset: 1px;
  }
  /* watchZoomRoom: on the bar's row where it leaves room, else just above the bar's row (the notes of that corner move up
     over it); never over a chip, and the bar never wraps for it. A narrow element (a phone, an event's card) has none. */
  :host(:not([data-zoom-room])) .zoom {
    display: none;
  }
  :host([data-zoom-room='above']) .zoom {
    inset-block-end: calc(18px + var(--bar-h, 0px));
  }
  @media (min-width: 641px) {
    :host([data-zoom-room='above']) .note {
      inset-block-end: calc(62px + var(--bar-h, 0px));
    }
    :host([data-zoom-room='above']) .note.fb {
      inset-block-end: calc(90px + var(--bar-h, 0px));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .zoom button {
      transition: none;
    }
  }
  :host([data-walk]) .zoom,
  :host([kiosk]) .zoom {
    display: none;
  }
`;

/** The two buttons (DOM order - then +: in the RTL group + stands at the outer, left edge, as in the mockup). */
export function renderZoom(show: boolean, zoom: (factor: number) => void) {
  if (!show) return nothing;
  return html`<div class="zoom" role="group" aria-label="זום" data-3d-zoom>
    <button type="button" aria-label="התרחקות" title="התרחקות" data-3d-zoom-out @click=${() => zoom(1 / ZOOM_STEP)}><sw-icon name="minus" size="18" aria-hidden="true"></sw-icon></button>
    <button type="button" aria-label="התקרבות" title="התקרבות" data-3d-zoom-in @click=${() => zoom(ZOOM_STEP)}><sw-icon name="plus" size="18" aria-hidden="true"></sw-icon></button>
  </div>`;
}
