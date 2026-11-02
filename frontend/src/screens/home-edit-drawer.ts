import { css, html, nothing, type TemplateResult } from 'lit';
import { modalKeydown, tablistKeydown } from '../components/a11y-keys';

/**
 * HOME-EDIT-DRAWER-2351: the home screen's edit mode in a drawer (proposal E11 of HOMEEDIT-POLISH-2331).
 *
 * Before, the home edit panel (title, direction, phone layout, widgets, floor order) and the display options were drawn in the
 * page flow above the floors, so edit mode made the home screen long and scrolled it, and the live preview was pushed off screen.
 * Now both sit in ONE drawer together with the layout editor's card panel (devices-layout.ts `renderPanel`, which used to float
 * in the same slot on its own):
 *   - from 1200 px a side drawer at the inline end, in the slot the card panel always had (the page keeps its padding for it);
 *   - below 1200 px (tablet and phone) a bottom sheet - the owner's rule OWNER-R12-2341 (8B): the 12-column preview keeps the
 *     page's full width on a tablet. A phone reaches edit mode only while "הסתרת עורך פריסת האזור בנייד" is off (phone.ts).
 * Two tabs: "המסך" (the home edit panel + the display options) and "הכרטיס הנבחר" (the card panel; picking a card switches to it).
 * Save / cancel live in the drawer's own footer, which never scrolls away. The drawer is NOT modal: the preview beside it stays
 * visible and the cards on the page stay draggable. While focus is inside, Tab / Shift+Tab wrap inside it (components/a11y-keys.ts
 * `modalKeydown`); Escape closes it and focus goes back to the "הגדרות המסך" key of the edit bar, which opens it again.
 * Nothing here reaches the network: every action is the screen's own (the same handlers, events and permissions as before).
 */

export type HomeDrawerTab = 'home' | 'card';

export const HOME_DRAWER_ID = 'he-drawer';

export interface HomeDrawerView {
  open: boolean;
  tab: HomeDrawerTab;
  /** The layout editor has a card (or a card's device tiles) selected. */
  cardSelected: boolean;
  home: TemplateResult | typeof nothing;
  card: TemplateResult | typeof nothing;
  dirty: boolean;
  busy: boolean;
  onTab: (tab: HomeDrawerTab) => void;
  onClose: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const TAB_LABEL: Record<HomeDrawerTab, string> = { home: 'המסך', card: 'הכרטיס הנבחר' };

/** The drawer's keys: Escape closes (unless something inside already took the key), Tab wraps inside. */
export function drawerKeydown(e: KeyboardEvent, close: () => void): void {
  if (e.key === 'Escape' && e.defaultPrevented) return;
  const box = e.currentTarget as Element | null;
  if (box) modalKeydown(e, box, close);
}

export function renderHomeDrawer(v: HomeDrawerView): TemplateResult {
  const tab = (id: HomeDrawerTab) =>
    html`<button type="button" role="tab" id=${`he-tab-${id}`} aria-controls=${`he-pane-${id}`} aria-selected=${String(v.tab === id)} tabindex=${v.tab === id ? 0 : -1} data-home-drawer-tab=${id} @click=${() => v.onTab(id)}>${TAB_LABEL[id]}${id === 'card' && v.cardSelected ? html`<span class="he-dot" aria-hidden="true"></span>` : nothing}</button>`;
  return html`<aside id=${HOME_DRAWER_ID} class="he-drawer" data-home-drawer role="dialog" aria-modal="false" aria-labelledby="he-drawer-h" ?hidden=${!v.open} @keydown=${(e: KeyboardEvent) => drawerKeydown(e, v.onClose)}>
    <header class="he-dh">
      <span class="he-grip" aria-hidden="true"></span>
      <div class="he-dtop">
        <h2 id="he-drawer-h" class="he-dt">עריכת המסך הראשי</h2>
        <button type="button" class="he-x" data-home-drawer-close aria-label="סגירת חלונית העריכה" title="סגירה (Esc)" @click=${v.onClose}><sw-icon name="close" size=${16}></sw-icon></button>
      </div>
      <div class="he-tabs" role="tablist" aria-label="חלונית העריכה" @keydown=${tablistKeydown}>${tab('home')}${tab('card')}</div>
    </header>
    <div class="he-db" data-home-drawer-body>
      <div role="tabpanel" id="he-pane-home" class="he-pane" aria-labelledby="he-tab-home" data-home-drawer-pane="home" ?hidden=${v.tab !== 'home'}>${v.home}</div>
      <div role="tabpanel" id="he-pane-card" class="he-pane" aria-labelledby="he-tab-card" data-home-drawer-pane="card" ?hidden=${v.tab !== 'card'}>${v.card}</div>
    </div>
    <footer class="he-df">
      <span class="he-state" role="status" data-home-drawer-state>${v.dirty ? 'יש שינויים שלא נשמרו' : 'אין שינויים'}</span>
      <sw-button size="sm" data-home-drawer-cancel ?disabled=${v.busy} @click=${v.onCancel}>${v.dirty ? 'בטל' : 'סיום עריכה'}</sw-button>
      <sw-button size="sm" variant="primary" icon="check" data-home-drawer-save ?disabled=${v.busy || !v.dirty} @click=${v.onSave}>שמור</sw-button>
    </footer>
  </aside>`;
}

/** The edit bar's key that opens / closes the drawer (the way back after Escape). */
export function renderDrawerToggle(open: boolean, toggle: () => void): TemplateResult {
  return html`<button type="button" class="he-tog" data-home-drawer-toggle aria-controls=${HOME_DRAWER_ID} aria-expanded=${String(open)} @click=${toggle}><sw-icon name="home" size=${15}></sw-icon>הגדרות המסך</button>`;
}

export const HOME_DRAWER_CSS = css`
  /* the drawer is wider than the card panel was (300 px): the widget rows and the entity pickers need the room */
  :host([data-lay-editing]) {
    --lay-panel: clamp(340px, 27vw, 420px);
  }
  .he-drawer {
    position: fixed;
    z-index: 30;
    inset-block: 76px 16px;
    inset-inline-end: 16px;
    inline-size: var(--lay-panel, 360px);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface-solid, var(--sw-surface));
    box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight);
    color: var(--sw-text);
    overflow: hidden;
    opacity: 1;
    transform: none;
    transition:
      opacity var(--sw-t-sheet) var(--sw-ease-out),
      transform var(--sw-t-sheet) var(--sw-ease-out);
  }
  .he-drawer[hidden] {
    display: none;
  }
  @starting-style {
    .he-drawer {
      opacity: 0;
      transform: translateX(var(--he-from, 12px));
    }
  }
  .he-drawer:dir(rtl) {
    --he-from: -12px;
  }
  .he-dh {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-2);
    padding: var(--sw-s-3) var(--sw-s-4) 0;
    border-block-end: 1px solid var(--sw-border);
  }
  .he-grip {
    display: none;
  }
  .he-dtop {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
  }
  .he-dt {
    flex: 1;
    min-inline-size: 0;
    margin: 0;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading);
  }
  .he-x {
    display: inline-grid;
    place-items: center;
    inline-size: var(--sw-ctl-h-md);
    block-size: var(--sw-ctl-h-md);
    padding: 0;
    border: 0;
    border-radius: var(--sw-r-sm);
    background: transparent;
    color: var(--sw-text-2);
    cursor: pointer;
    transition: transform var(--sw-t-press) var(--sw-ease-out), background var(--sw-t-hover) var(--sw-ease-color);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .he-tabs {
    display: flex;
    gap: var(--sw-s-1);
    margin-block-end: -1px;
  }
  .he-tabs [role='tab'] {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-1h);
    min-block-size: var(--sw-ctl-h-md);
    padding: 0 var(--sw-s-3);
    border: 0;
    border-block-end: 2px solid transparent;
    background: transparent;
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text-2);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .he-tabs [role='tab'][aria-selected='true'] {
    color: var(--sw-accent-text, var(--sw-accent));
    font-weight: var(--sw-fw-semibold);
    border-block-end-color: var(--sw-accent);
  }
  .he-dot {
    inline-size: 6px;
    block-size: 6px;
    border-radius: 50%;
    background: var(--sw-accent);
  }
  .he-x:focus-visible,
  .he-tabs [role='tab']:focus-visible,
  .he-tog:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: -2px;
  }
  /* the ONE scroll container of edit mode: the page beside it stays put */
  .he-db {
    flex: 1;
    min-block-size: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: var(--sw-s-4);
  }
  .he-pane {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-4);
  }
  .he-pane[hidden] {
    display: none;
  }
  /* the card panel of the layout editor, inside the drawer: its own floating box is the drawer now */
  .he-drawer .lay-panel {
    position: static;
    inset: auto;
    inline-size: auto;
    max-block-size: none;
    overflow: visible;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: none;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .he-drawer .hs-edit {
    padding: 0;
    border: 0;
    border-block-start: 1px solid var(--sw-border);
    border-radius: 0;
    background: none;
    box-shadow: none;
    padding-block-start: var(--sw-s-4);
  }
  .he-drawer .hs-edit h3 {
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
  }
  /* save / cancel: always in view, whatever the body scrolls */
  .he-df {
    flex: none;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-2);
    padding: var(--sw-s-3) var(--sw-s-4);
    border-block-start: 1px solid var(--sw-border);
    background: var(--sw-surface-2);
  }
  .he-state {
    flex: 1;
    min-inline-size: 0;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .he-tog {
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-1h);
    min-block-size: var(--sw-ctl-h-sm);
    padding: 0 var(--sw-s-3);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    font: inherit;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text);
    cursor: pointer;
    white-space: nowrap;
    transition: transform var(--sw-t-press) var(--sw-ease-out), background var(--sw-t-hover) var(--sw-ease-color);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .he-tog[aria-expanded='true'] {
    background: var(--sw-accent-soft);
    border-color: var(--sw-accent);
    color: var(--sw-accent-text, var(--sw-accent));
  }
  @media (hover: hover) and (pointer: fine) {
    .he-x:hover,
    .he-tog:hover {
      background: var(--sw-hover-wash);
    }
    .he-tabs [role='tab']:hover {
      color: var(--sw-text);
    }
  }
  .he-x:active,
  .he-tog:active,
  .he-tabs [role='tab']:active {
    transform: scale(var(--sw-press-scale));
  }
  /* OWNER-R12-2341 (8B): below 1200 px a bottom sheet over the lower part of the page (the page keeps 52vh of room under it) */
  @media (max-width: 1199px) {
    .he-drawer {
      inset-block: auto calc(8px + env(safe-area-inset-bottom, 0px));
      inset-inline: 8px;
      inline-size: auto;
      block-size: min(50vh, 640px);
    }
    @starting-style {
      .he-drawer {
        opacity: 0;
        transform: translateY(16px);
      }
    }
    .he-grip {
      display: block;
      align-self: center;
      inline-size: 40px;
      block-size: 4px;
      border-radius: 2px;
      background: var(--sw-border-strong);
    }
    .he-dh {
      padding-block-start: var(--sw-s-2);
    }
  }
  /* a phone (only when the installation lets the layout editor open there): 44 px targets */
  @media (max-width: 767px) {
    .he-x,
    .he-tabs [role='tab'],
    .he-tog {
      min-block-size: var(--sw-touch-desktop);
    }
    .he-x {
      inline-size: var(--sw-touch-desktop);
      block-size: var(--sw-touch-desktop);
    }
    .he-df {
      padding-block-end: max(var(--sw-s-3), env(safe-area-inset-bottom, 0px));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .he-drawer {
      transition: opacity var(--sw-t-sheet) var(--sw-ease-out);
    }
    @starting-style {
      .he-drawer {
        transform: none;
      }
    }
  }
`;
