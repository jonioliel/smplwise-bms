/**
 * PLAN3D-FURNMERGE-2434: the 3D map's + / - zoom buttons (round-28 mockup, map3d/app pills.html: a glass chip bar of two
 * icon buttons in the bottom corner opposite the view bar). Kept out of sw-plan-3d.ts so the element's own overlays merge
 * cleanly with the other 3D branches: the element adds ZOOM_CSS to its styles, renders `renderZoom` and calls the view.
 *
 * Placement: the bar's inline end (the left edge in the RTL shell), on the bar's row; the bar wraps before it (the bar's
 * width gives up the group's width), the floor strip stands on the bar's other side, the notes above the bar row. Hidden on
 * a phone (a pinch zooms; the mockup hides it there too), in the walk and on the wall display's bare view.
 */
import { html, css, nothing } from 'lit';
import '../components/sw-icon';

/** One press: the view 1.35x closer (+) or farther (-). */
export const ZOOM_STEP = 1.35;
/** The group's inline size plus its gap (the bar gives it up beside it). */
const ZOOM_W = 92;

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
  @media (min-width: 641px) {
    .bar {
      max-inline-size: calc(100% - 24px - ${ZOOM_W}px);
    }
  }
  @media (max-width: 640px) {
    .zoom {
      display: none;
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
