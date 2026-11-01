import { css, html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { lt } from './list-text';
import { tIcon } from './icons';

/**
 * TICKETS-POLISH-2331: the ONE toolbar of the request list and the manager board (design audit 27.10, P1-5 / §7.5.3 "filter bar"). Before
 * it, up to five rows of controls stood above the first request (title + departments, scope, a six-way state strip, search / filter / new,
 * the view switch alone on a row, then the filter row). Now:
 *   title row   - the title, page-level actions at the inline end (the view switch, "+ חדשה")
 *   toolbar     - one segmented scope (the list's שלי / המחלקה / הכול, the board's state strip), the search, "סינון", the active-filter chips
 *   "סינון"     - a panel anchored to its button with everything else (state, departments, floors, priority, handler, flags) and its counts
 * Every filter that is not at its default shows as a removable chip next to "סינון", with one "איפוס" - so a narrowed list always says so,
 * also after the panel closes. Template functions plus one controller (Escape, outside press, focus in and back); the hosts keep their own
 * filter state and data hooks.
 */

export interface ActiveChip {
  /** `data-active-chip` (tests, automation) */
  key: string;
  label: string;
  remove: () => void;
  /** extra attributes the older hooks need (e.g. the board's `data-assignee-filter`) */
  attrs?: Record<string, string>;
}

/** The "סינון" button: the count of active choices as a quiet badge (not a loud fill), pressed while the panel is open. */
export function filterToggle(open: boolean, active: number, toggle: () => void, extra = ''): TemplateResult {
  return html`<button type="button" class=${`btn sm filterbtn${open ? ' on' : ''}`} aria-expanded=${String(open)} aria-controls="filter-panel" aria-haspopup="dialog"
    aria-label=${active ? lt('lfBtnCount', { n: active }) : lt('lfBtn')} data-filter-toggle ?data-filter-btn=${extra === 'board'} @click=${toggle}>${tIcon('filter')}<span class="lbl">${lt('lfBtn')}</span>${active ? html`<span class="n" aria-hidden="true">${active}</span>` : nothing}</button>`;
}

/** The chips of the filters that are not at their default, then "איפוס" (only with two or more, one chip is its own reset). */
export function activeChips(chips: readonly ActiveChip[], reset: () => void): TemplateResult | typeof nothing {
  if (!chips.length) return nothing;
  return html`<div class="achips" role="group" aria-label=${lt('tbChips')} data-active-chips>
    ${chips.map((c) => html`<button type="button" class="achip" data-active-chip=${c.key} data-assignee-filter=${c.attrs?.['data-assignee-filter'] ?? nothing}
      aria-label=${c.attrs?.['aria-label'] ?? lt('tbRemove', { name: c.label })} @click=${c.remove}><span class="t">${c.label}</span>${tIcon('x')}</button>`)}
    ${chips.length > 1 ? html`<button type="button" class="areset" data-chips-reset aria-label=${lt('tbResetLabel')} @click=${reset}>${lt('tbReset')}</button>` : nothing}
  </div>`;
}

/** A titled section of the panel. */
export function panelSection(title: string, body: TemplateResult, attr = ''): TemplateResult {
  return html`<section class="fsect" data-panel-section=${attr || nothing}><h2 class="fl">${title}</h2>${body}</section>`;
}

/** The panel: anchored under "סינון" on a tablet / desktop, in the flow under the toolbar on a phone; the reset and "סגירה" at its foot. */
export function filterPanel(sections: TemplateResult, active: number, reset: () => void, close: () => void): TemplateResult {
  return html`<div class="fpop" id="filter-panel" role="dialog" aria-label=${lt('tbPanel')} data-filter-panel>
    ${sections}
    <div class="ffoot">
      <button type="button" class="btn sm" data-f-reset data-f-clear ?disabled=${!active} @click=${reset}>${tIcon('x')}${lt('tbResetLabel')}</button>
      <span class="grow"></span>
      <button type="button" class="btn sm" data-f-close @click=${close}>${lt('tbClose')}</button>
    </div>
  </div>`;
}

/**
 * The panel's behaviour: Escape closes it and returns the focus to "סינון", a press outside the panel and its button closes it, and when it
 * opens the focus moves to its first control (keyboard users land inside, no Tab hunt).
 */
export class FilterPanelController implements ReactiveController {
  private wasOpen = false;
  constructor(private host: ReactiveControllerHost & HTMLElement, private isOpen: () => boolean, private setOpen: (open: boolean) => void) {
    host.addController(this);
  }
  hostConnected(): void {
    window.addEventListener('pointerdown', this.onOutside, true);
    this.host.addEventListener('keydown', this.onKey);
  }
  hostDisconnected(): void {
    window.removeEventListener('pointerdown', this.onOutside, true);
    this.host.removeEventListener('keydown', this.onKey);
  }
  hostUpdated(): void {
    const open = this.isOpen();
    if (open && !this.wasOpen) this.panel()?.querySelector<HTMLElement>('button:not([disabled]), select, input')?.focus({ preventScroll: true });
    this.wasOpen = open;
  }
  private root(): ShadowRoot | null {
    return this.host.shadowRoot;
  }
  private panel(): HTMLElement | null {
    return this.root()?.querySelector<HTMLElement>('[data-filter-panel]') ?? null;
  }
  private toggle(): HTMLElement | null {
    return this.root()?.querySelector<HTMLElement>('[data-filter-toggle]') ?? null;
  }
  private onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !this.isOpen()) return;
    const path = e.composedPath();
    const p = this.panel();
    const t = this.toggle();
    if ((p && path.includes(p)) || (t && path.includes(t))) {
      e.stopPropagation();
      this.setOpen(false);
      t?.focus();
    }
  };
  private onOutside = (e: PointerEvent): void => {
    if (!this.isOpen()) return;
    const path = e.composedPath();
    const p = this.panel();
    const t = this.toggle();
    if ((p && path.includes(p)) || (t && path.includes(t))) return;
    // a native <select> list opens outside the shadow tree in some engines: a press on an option is not "outside"
    if (path.some((n) => n instanceof HTMLOptionElement)) return;
    this.setOpen(false);
  };
}

/** The toolbar, the chips and the panel (tokens only; logical properties; 44 px targets on a phone). */
export const ticketToolbarStyles = css`
  .dh-det.tb {
    flex-wrap: nowrap;
    gap: 10px;
    min-inline-size: 0;
    position: relative;
  }
  .tb .search {
    flex: 1 1 220px;
    min-inline-size: 160px;
    max-inline-size: 340px;
  }
  .tb > .seg {
    flex: none;
  }
  .dh-row .pact {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex: none;
    margin-inline-start: auto;
  }
  .fanchor {
    position: relative;
    flex: none;
  }
  /* "סינון": a neutral button whose active count is a small accent badge; pressed (open) = the control's pressed look */
  .filterbtn .n {
    display: inline-grid;
    place-items: center;
    min-inline-size: 20px;
    block-size: 20px;
    padding-inline: 6px;
    box-sizing: border-box;
    border-radius: var(--sw-r-pill);
    background: var(--dv-accent);
    color: var(--sw-text-inverse);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .filterbtn.on {
    background: var(--dv-surface-3);
    border-color: var(--dv-border-strong);
  }
  /* the active-filter chips: soft accent, the remove mark inside the chip, one quiet reset */
  .achips {
    display: flex;
    align-items: center;
    gap: 6px;
    min-inline-size: 0;
    flex: 0 1 auto;
    overflow: hidden;
  }
  .achip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    max-inline-size: 220px;
    min-block-size: 32px;
    padding-inline: 12px 8px;
    border: 1px solid transparent;
    border-radius: var(--sw-r-pill);
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
    transition: transform var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease);
    -webkit-tap-highlight-color: transparent;
  }
  .achip .t {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .achip .ic {
    flex: none;
    inline-size: 14px;
    block-size: 14px;
    opacity: 0.75;
  }
  .achip:active {
    transform: scale(0.97);
  }
  .areset {
    flex: none;
    min-block-size: 32px;
    padding-inline: 8px;
    border: 0;
    background: transparent;
    color: var(--dv-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
    border-radius: var(--sw-r-md);
  }
  @media (hover: hover) and (pointer: fine) {
    .achip:hover {
      border-color: color-mix(in srgb, var(--dv-accent) 40%, transparent);
    }
    .areset:hover {
      color: var(--dv-text);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }
  .achip:focus-visible,
  .areset:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 2px;
  }
  /* the panel: opaque, anchored under its button, enters from just above (transform + opacity; zero under reduced motion) */
  .fpop {
    position: absolute;
    inset-block-start: calc(100% + 8px);
    inset-inline-start: 0;
    z-index: 30;
    inline-size: min(560px, calc(100vw - 48px));
    max-block-size: min(70dvh, 560px);
    overflow-y: auto;
    overscroll-behavior: contain;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    border-radius: var(--sw-r-2xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-solid);
    box-shadow: var(--dv-shadow-2);
    color: var(--dv-text);
    transform-origin: top;
    transition: opacity var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
  }
  @starting-style {
    .fpop {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
  }
  .fsect {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-inline-size: 0;
  }
  .fsect .fl {
    margin: 0;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    color: var(--dv-text-2);
  }
  .fchips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .fchips .rc {
    block-size: auto;
    min-block-size: 36px;
    padding-inline: 14px;
    font-size: var(--sw-fs-base);
  }
  .fchips .rc small {
    display: inline-grid;
    place-items: center;
    min-inline-size: 18px;
    block-size: 18px;
    padding-inline: 5px;
    box-sizing: border-box;
    margin-inline-start: 8px;
    border-radius: var(--sw-r-pill);
    background: color-mix(in srgb, var(--dv-text) 8%, transparent);
    color: var(--dv-text-2);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  /* a single-choice group (the state) reads as the same chips; the chosen one takes the pressed look */
  .fchips .rc[aria-checked='true'] {
    background: var(--dv-text);
    border-color: transparent;
    color: var(--mm-text-inverse);
    font-weight: 600;
    box-shadow: var(--dv-shadow-control);
  }
  .fchips .rc[aria-pressed='true'] small,
  .fchips .rc[aria-checked='true'] small {
    background: color-mix(in srgb, currentColor 18%, transparent);
    color: inherit;
  }
  .fpop .frow {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    padding: 0;
    background: none;
    border: 0;
    box-shadow: none;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
  .fpop .frow select {
    inline-size: min(100%, 280px);
    max-inline-size: none;
    min-block-size: 36px;
  }
  .fpop ticket-board-tree {
    max-block-size: 280px;
    overflow-y: auto;
  }
  .ffoot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-block-start: 12px;
    border-block-start: 1px solid var(--dv-border);
  }
  .ffoot .grow {
    flex: 1;
  }
  @media (max-width: 1279px) {
    /* the label of the active view hides first: the icons keep their names in aria-label and title */
    .dh-row .vsw button .lbl {
      display: none;
    }
  }
  @media (max-width: 767px) {
    .dh-det.tb {
      flex-wrap: wrap;
      gap: 8px;
    }
    .tb > .seg {
      order: 0;
      inline-size: 100%;
      box-sizing: border-box;
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr);
      border-radius: var(--sw-r-xl);
    }
    .tb > .seg button {
      min-block-size: 44px;
      padding-inline: 6px;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tb .search {
      order: 1;
      flex: 1 1 0;
      min-inline-size: 0;
      max-inline-size: none;
    }
    .tb .fanchor {
      order: 1;
      position: static;
    }
    .tb .filterbtn {
      min-block-size: 44px;
    }
    .tb .filterbtn .lbl {
      display: none;
    }
    .tb .achips {
      order: 2;
      inline-size: 100%;
      flex-wrap: wrap;
      overflow: visible;
    }
    .achip,
    .areset {
      min-block-size: 44px;
    }
    /* on a phone the panel opens in the flow under the toolbar, the full width (nothing hangs off the screen) */
    .fpop {
      position: static;
      order: 3;
      inline-size: 100%;
      max-block-size: none;
      overflow: visible;
      padding: 14px;
    }
    .fchips .rc,
    .fpop .frow select {
      min-block-size: 44px;
    }
    .dh-row .pact .newbtn .lbl {
      display: none;
    }
    .dh-row .pact .newbtn {
      min-inline-size: 44px;
      min-block-size: 44px;
      justify-content: center;
    }
  }
`;
