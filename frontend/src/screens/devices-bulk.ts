import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-icon';
import type { IconName } from '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import type { DeviceCounts } from '../api/devices';
import { ALARM_HE } from '../api/devices';
import {
  BULK_KINDS,
  BULK_KIND_LABEL,
  BULK_SCOPE_LABEL,
  OUTCOME_LABEL,
  bulkHeadline,
  followBulk,
  previewBulk,
  runBulk,
  type BulkKind,
  type BulkPreview,
  type BulkRecord,
  type BulkScope,
} from '../api/device-bulk';
import { bidi, ltrNum } from '../i18n/bidi';

/** What a screen asks the dialog to do: the scope, its id and display name, and the kind. `position` (CR-007 slice
 * 4): covers_position's own argument - the area's "כל התריסים" group control (devices-area.ts). */
export interface BulkRequest {
  scope: BulkScope;
  id: string;
  name: string;
  kind: BulkKind;
  position?: number;
}

/** How many entities a kind would reach according to the tree's counts (a hint for the menu only - the server's
 * preview is what the dialog states and what is sent). */
export function activeFor(kind: BulkKind, c: DeviceCounts): number {
  if (kind === 'lights_off') return c.lights_on;
  if (kind === 'covers_close') return c.covers_open;
  if (kind === 'climate_off') return c.climate_active;
  if (kind === 'screens_off') return c.media_on;
  return c.lights_on + c.switches_on + c.covers_open + c.climate_active + c.media_on;
}

/** Owner feedback 2026-09-29 ("hide empty domains"): a quick action for a domain the scope has no entity of at all
 * is not offered (no covers → no "סגור תריסים"); "כבה הכל" always is. The server's preview still decides what is sent. */
export function presentFor(kind: BulkKind, c: DeviceCounts): boolean {
  if (kind === 'lights_off') return c.lights > 0;
  if (kind === 'covers_close' || kind === 'covers_open' || kind === 'covers_stop' || kind === 'covers_position') return c.covers > 0;
  if (kind === 'climate_off') return c.climate > 0;
  if (kind === 'screens_off') return c.media > 0;
  return true;
}

const KIND_ICON: Record<BulkKind, IconName> = { lights_off: 'light', covers_close: 'layers', covers_open: 'layers', covers_stop: 'layers', covers_position: 'layers', climate_off: 'activity', screens_off: 'play', all_off: 'bolt' };

function requestEvent(req: BulkRequest): CustomEvent<BulkRequest> {
  return new CustomEvent<BulkRequest>('bulk-request', { detail: req, bubbles: true, composed: true });
}

/**
 * The quick actions of one scope (CR-007 slice 3, the approved mockup's board 1): a trigger that opens either a menu
 * (a floor: the five actions) or a popover (an area row / tile: the area's state chips, the four quick actions,
 * "כבה הכל באזור" and "פתח אזור ›"). The trigger is a "⋯" button, a text button (`triggerLabel`, e.g. "כבה קומה ▾"), or
 * the caller's own element in the `trigger` slot (a whole tree / card row). Without `actions` (a viewer who does not
 * hold devices.control_bulk there) the popover shows the chips and the link only. Picking an action never sends
 * anything: it raises `bulk-request`, and the screen opens the confirmation dialog (devices-bulk-dialog), the only
 * place that sends.
 *
 * Owner feedback 2026-09-29 (building screen): with `hover`, the slotted row is a LINK into the area (a click enters
 * it), and the popover is a summary shown on hover (mouse / pen, after a short delay) and on keyboard focus of the row;
 * a touch screen has no hover, so the row carries its own "⋯" (`data-area-more`) that opens the same popover. Every
 * panel lives in the top layer (the Popover API: never clipped by a sticky / glass ancestor, never under a sibling) and
 * is placed in the viewport next to its trigger - below it, flipped above near the bottom edge, clamped to the sides.
 * It closes on Escape, on a press outside, when the page scrolls under it (the trigger moved) and on a resize.
 */
@customElement('devices-bulk-menu')
export class DevicesBulkMenu extends LitElement {
  @property() scope: BulkScope = 'area';
  @property() targetId = '';
  @property() targetName = '';
  @property({ attribute: false }) counts: DeviceCounts | null = null;
  /** "menu": the five actions; "popover": state chips first, then the actions. */
  @property() variant: 'menu' | 'popover' = 'menu';
  @property() label = 'פעולות';
  /** Which edge of the trigger the panel lines up with: `end` (it opens toward the inline start - a tile's corner, the
   * page header) or `start` (it opens toward the inline end - a floor heading near the start edge). */
  @property({ reflect: true }) align: 'start' | 'end' = 'end';
  /** A text trigger instead of the "⋯" icon (the floor card's "כבה קומה ▾"). */
  @property() triggerLabel = '';
  /** Offer the bulk actions (false: chips and the "open" link only). */
  @property({ type: Boolean }) actions = true;
  /** "פתח אזור ›": the area screen's link, shown at the foot of the popover. */
  @property() openHref = '';
  /** The host fills its row (a slotted row trigger). */
  @property({ type: Boolean, reflect: true }) block = false;
  /** The slotted row navigates; the popover is the hover / focus summary (and the row's own "⋯" on touch). */
  @property({ type: Boolean, reflect: true }) hover = false;
  @state() private open = false;
  /** What opened the panel: a hover summary closes when the pointer leaves, a focus one when focus leaves. */
  private how: 'click' | 'hover' | 'focus' = 'click';
  private hoverTimer = 0;
  private watch = 0;
  private placedAt: { x: number; y: number } | null = null;

  static styles = css`
    :host {
      position: relative;
      display: inline-flex;
    }
    :host([block]) {
      display: flex;
    }
    :host([block]) slot[name='trigger'] {
      display: contents;
    }
    :host([block]) ::slotted([slot='trigger']) {
      flex: 1;
      min-inline-size: 0;
    }
    /* the top layer (popover="manual") - or, without the Popover API, a fixed panel above everything; placed by place() */
    .panel {
      position: fixed;
      inset: auto;
      margin: 0;
      z-index: 1000;
      box-sizing: border-box;
      overflow: auto;
      min-inline-size: 220px;
      max-inline-size: min(300px, calc(100vw - 16px));
      color: var(--sw-text);
      /* a summary over the tree must stay readable: the glass palette's solid surface when there is one */
      background: var(--dv-surface-solid, var(--sw-surface));
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .more {
      flex: none;
      display: inline-grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-3);
      font: inherit;
      cursor: pointer;
    }
    .more:hover,
    .more:focus-visible,
    .more[aria-expanded='true'] {
      background: var(--sw-surface-2);
      color: var(--sw-text);
      outline: none;
    }
    .title {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      padding: 4px 8px 2px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 6px;
      padding: 4px 6px 8px;
      border-block-end: 1px solid var(--sw-border);
      margin-block-end: 4px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .chip.warm {
      background: var(--sw-warning-soft);
      color: var(--sw-text);
    }
    button.item {
      display: flex;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
      padding: 8px 10px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
    }
    button.item:hover:not(:disabled),
    button.item:focus-visible {
      background: var(--sw-surface-2);
      outline: none;
    }
    button.item:disabled {
      color: var(--sw-text-3);
      cursor: default;
    }
    button.item.all {
      border-block-start: 1px solid var(--sw-border);
      border-start-start-radius: 0;
      border-start-end-radius: 0;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-danger);
      margin-block-start: 2px;
    }
    button.item.all:disabled {
      color: var(--sw-text-3);
    }
    .n {
      margin-inline-start: auto;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .foot {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      padding: 6px 8px 2px;
    }
    a.open {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-accent);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
    }
    a.open:hover,
    a.open:focus-visible {
      background: var(--sw-surface-2);
      outline: none;
    }
  `;

  private onDoc = (e: Event) => {
    if (this.open && !e.composedPath().includes(this)) this.open = false;
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open) this.open = false;
  };

  private onResize = () => {
    if (this.open) this.open = false;
  };

  /** Hover (a mouse or a pen - a touch has no hover) opens the summary after a short delay; leaving closes it after a
   * short grace, so the pointer can cross the gap into the panel (a descendant: entering it re-enters the host). */
  private onEnter = (e: PointerEvent) => {
    if (!this.hover || e.pointerType === 'touch') return;
    window.clearTimeout(this.hoverTimer);
    if (this.open) return;
    this.hoverTimer = window.setTimeout(() => this.show('hover'), 300);
  };

  private onLeave = (e: PointerEvent) => {
    if (!this.hover || e.pointerType === 'touch') return;
    window.clearTimeout(this.hoverTimer);
    if (!this.open || this.how !== 'hover') return;
    this.hoverTimer = window.setTimeout(() => {
      if (this.how === 'hover') this.open = false;
    }, 250);
  };

  /** Keyboard focus on the row shows the summary; Tab then reaches its "⋯" and the panel's actions. */
  private onFocusIn = (e: FocusEvent) => {
    if (!this.hover || this.open) return;
    const t = e.target as HTMLElement;
    let visible = false;
    try {
      visible = t.matches(':focus-visible');
    } catch {
      visible = true;
    }
    if (t.getAttribute('slot') === 'trigger' && visible) this.show('focus');
  };

  private onFocusOut = (e: FocusEvent) => {
    if (!this.open) return;
    const to = e.relatedTarget as Node | null;
    if (to && (this.contains(to) || this.shadowRoot?.contains(to))) return;
    // focus moved elsewhere: every panel closes (hover, focus or click); a focus summary also when focus just ends. A
    // press on a non-focusable part of the panel (no relatedTarget) keeps a hover / click panel open.
    if (this.how === 'focus' || to) this.open = false;
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onDoc, true);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
    this.addEventListener('pointerenter', this.onEnter);
    this.addEventListener('pointerleave', this.onLeave);
    this.addEventListener('focusin', this.onFocusIn);
    this.addEventListener('focusout', this.onFocusOut);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this.onDoc, true);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    this.removeEventListener('pointerenter', this.onEnter);
    this.removeEventListener('pointerleave', this.onLeave);
    this.removeEventListener('focusin', this.onFocusIn);
    this.removeEventListener('focusout', this.onFocusOut);
    window.clearTimeout(this.hoverTimer);
    cancelAnimationFrame(this.watch);
    this.watch = 0;
  }

  private show(how: 'click' | 'hover' | 'focus') {
    this.how = how;
    this.open = true;
  }

  private pick(kind: BulkKind) {
    this.open = false;
    this.dispatchEvent(requestEvent({ scope: this.scope, id: this.targetId, name: this.targetName, kind }));
  }

  private toggle(e: Event) {
    e.preventDefault();
    e.stopPropagation(); // a trigger inside a tile must never follow the tile's own link
    window.clearTimeout(this.hoverTimer);
    if (this.open && this.how !== 'click') {
      this.how = 'click'; // a tap on "⋯" while the hover summary shows: keep it, now as a menu
      return;
    }
    this.how = 'click';
    this.open = !this.open;
  }

  protected updated() {
    const panel = this.renderRoot.querySelector<HTMLElement>('.panel');
    if (!panel) {
      cancelAnimationFrame(this.watch);
      this.watch = 0;
      return;
    }
    try {
      if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) panel.showPopover();
    } catch {
      /* no top layer here: the fixed panel above everything */
    }
    this.place(panel);
  }

  /** The panel next to its trigger, inside the viewport: under it, above it near the bottom edge, clamped to the sides
   * and never taller than the viewport (it scrolls then). `align` picks the edge it lines up with (logical, RTL-aware). */
  private place(panel: HTMLElement) {
    const r = this.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    const m = 8;
    panel.style.maxBlockSize = `${Math.max(120, vh - 2 * m)}px`;
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const fromLeft = (this.align === 'start') !== rtl;
    let left = fromLeft ? r.left : r.right - pw;
    left = Math.min(Math.max(m, left), Math.max(m, vw - pw - m));
    let top = r.bottom + 4;
    if (top + ph > vh - m) {
      const above = r.top - 4 - ph;
      top = above >= m ? above : Math.max(m, vh - m - ph);
    }
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.dataset.placement = top < r.top ? 'above' : 'below';
    this.placedAt = { x: r.left, y: r.top };
    if (!this.watch) this.watch = requestAnimationFrame(this.follow);
  }

  /** While open: the trigger moved (the page or a panel scrolled, the layout shifted) - the popover closes. */
  private follow = () => {
    this.watch = 0;
    if (!this.open) return;
    const r = this.getBoundingClientRect();
    if (this.placedAt && (Math.abs(r.left - this.placedAt.x) > 2 || Math.abs(r.top - this.placedAt.y) > 2)) {
      this.open = false;
      return;
    }
    this.watch = requestAnimationFrame(this.follow);
  };

  render() {
    if (this.hover) {
      return html`<slot name="trigger"></slot><button type="button" class="more" data-area-more aria-haspopup="menu" aria-expanded=${String(this.open)} aria-label=${`${this.label}: ${this.targetName}`} title="סיכום ופעולות מהירות" @click=${this.toggle}><sw-icon name="more" size=${16}></sw-icon></button>${this.open ? this.renderPanel() : nothing}`;
    }
    const fallback = this.triggerLabel
      ? html`<sw-button size="sm" data-bulk-trigger=${this.scope} aria-haspopup="menu" aria-expanded=${String(this.open)}>${this.triggerLabel} ▾</sw-button>`
      : html`<sw-button size="sm" variant="ghost" icon="more" iconOnly label=${`${this.label}: ${this.targetName}`} data-bulk-trigger=${this.scope} aria-haspopup="menu" aria-expanded=${String(this.open)}></sw-button>`;
    return html`<slot name="trigger" @click=${this.toggle}>${fallback}</slot>${this.open ? this.renderPanel() : nothing}`;
  }

  private renderPanel() {
    const c = this.counts;
    return html`<div class="panel" popover="manual" role="menu" data-bulk-panel=${this.variant} data-open-how=${this.how} aria-label=${`${BULK_SCOPE_LABEL[this.scope]} ${this.targetName}`} @click=${(e: Event) => e.stopPropagation()}>
      <div class="title">${BULK_SCOPE_LABEL[this.scope]} · ${bidi(this.targetName)}</div>
      ${this.variant === 'popover' && c ? this.renderChips(c) : nothing}
      ${this.actions
        ? html`${BULK_KINDS.filter((k) => !c || presentFor(k, c)).map((k) => {
              const n = c ? activeFor(k, c) : null;
              const label = k === 'all_off' ? `${BULK_KIND_LABEL[k]}${this.scope === 'area' ? ' באזור' : this.scope === 'floor' ? ' בקומה' : ''} · אישור` : BULK_KIND_LABEL[k];
              return html`<button class=${classMap({ item: true, all: k === 'all_off' })} role="menuitem" data-bulk-kind=${k} ?disabled=${n === 0} @click=${() => this.pick(k)}>
                <sw-icon .name=${KIND_ICON[k]} size=${14}></sw-icon>${label}${n !== null ? html`<span class="n">${n === 0 ? 'אין פעילים' : `${ltrNum(n)} פעילים`}</span>` : nothing}
              </button>`;
            })}
            <div class="foot">כל פעולה נפתחת בחלון אישור. מנעולים ואזעקה אינם נכללים.</div>`
        : nothing}
      ${this.openHref ? html`<a class="open" href=${this.openHref} data-open-area role="menuitem" @click=${() => (this.open = false)}>פתח אזור<span aria-hidden="true">›</span></a>` : nothing}
    </div>`;
  }

  private renderChips(c: DeviceCounts) {
    const chip = (icon: IconName, text: string, warm: boolean, key: string) => html`<span class=${classMap({ chip: true, warm })} data-chip=${key}><sw-icon .name=${icon} size=${12}></sw-icon>${text}</span>`;
    return html`<div class="chips">
      ${c.lights ? chip('light', `תאורה ${c.lights_on}/${c.lights}`, c.lights_on > 0, 'lights') : nothing}
      ${c.switches ? chip('bolt', `מתגים ${c.switches_on}/${c.switches}`, c.switches_on > 0, 'switches') : nothing}
      ${c.covers ? chip('layers', `תריסים פתוחים ${c.covers_open}/${c.covers}`, c.covers_open > 0, 'covers') : nothing}
      ${c.climate ? chip('activity', `מיזוג ${c.climate_active}/${c.climate}`, c.climate_active > 0, 'climate') : nothing}
      ${c.media ? chip('play', `מסכים ${c.media_on}/${c.media}`, c.media_on > 0, 'media') : nothing}
      ${c.locks ? chip('lock', `נעולים ${c.locks_locked}/${c.locks}`, false, 'locks') : nothing}
      ${c.alarm ? chip('shield', `אזעקה: ${ALARM_HE[c.alarm] ?? c.alarm}`, false, 'alarm') : nothing}
      ${!c.entities ? html`<span class="chip">אין התקנים</span>` : nothing}
    </div>`;
  }
}

type Phase = 'closed' | 'loading' | 'confirm' | 'nothing' | 'sending' | 'running' | 'result' | 'error';

/**
 * The confirmation dialog of every bulk action, and the only place that sends one. It states exactly what the server
 * will send (the server's own preview: scope, kind, entity count by domain, what is skipped and why, and that locks and
 * the alarm are never included); focus starts on Cancel; only its confirm button calls runBulk (`confirmed: true`,
 * with the preview's digest, so a set that changed in between is refused rather than sent). Then progress ("n of m
 * confirmed") and an honest result: "בוצע" only when every entity confirmed, otherwise "בוצע חלקית: k לא אושרו" with the
 * list, "תוצאה לא ידועה" named per entity - never "everything is off". Raises `bulk-done` when the record is done.
 */
@customElement('devices-bulk-dialog')
export class DevicesBulkDialog extends LitElement {
  @state() private phase: Phase = 'closed';
  @state() private req: BulkRequest | null = null;
  @state() private preview: BulkPreview | null = null;
  @state() private record: BulkRecord | null = null;
  @state() private error = '';
  private follow: { stopped: boolean } | null = null;

  static styles = css`
    .what {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .big {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .domains {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
    }
    .domains span {
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .never {
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    details {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    details ul,
    .list {
      margin: 4px 0 0;
      padding-inline-start: 18px;
      max-block-size: 160px;
      overflow: auto;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-block-start: 6px;
      border-block-start: 1px solid var(--sw-border);
      margin-block-start: 4px;
    }
    .bar {
      block-size: 8px;
      border-radius: 999px;
      background: var(--sw-surface-2);
      overflow: hidden;
    }
    .bar > div {
      block-size: 100%;
      background: var(--sw-success);
      transition: inline-size var(--sw-t-med) var(--sw-ease);
    }
    .headline {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .headline.ok {
      color: var(--sw-success);
    }
    .headline.partial,
    .headline.none {
      color: var(--sw-warning);
    }
    .outcome {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-inline-start: 6px;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
  `;

  /** Open the dialog for one request: loads the server's preview, then waits for Cancel or the confirm button. */
  async show(req: BulkRequest) {
    if (this.phase === 'sending' || this.phase === 'running') return; // one at a time from this screen
    this.req = req;
    this.preview = null;
    this.record = null;
    this.error = '';
    this.phase = 'loading';
    try {
      const p = await previewBulk(req.scope, req.id, req.kind, req.position);
      if (this.req !== req) return;
      this.preview = p;
      this.phase = p.count ? 'confirm' : 'nothing';
    } catch (err) {
      if (this.req !== req) return;
      this.error = err instanceof ApiError && err.status === 403 ? 'אין לך הרשאה לפעולות מרוכזות בהיקף הזה.' : describeError(err);
      this.phase = 'error';
    }
  }

  get running(): boolean {
    return this.phase === 'sending' || this.phase === 'running';
  }

  private close = () => {
    if (this.phase === 'sending') return; // the request is on its way: the dialog stays until the server answered
    this.phase = 'closed';
  };

  private async confirm() {
    const req = this.req;
    const p = this.preview;
    if (!req || !p || this.phase !== 'confirm') return;
    this.phase = 'sending';
    try {
      const first = await runBulk(req.scope, req.id, req.kind, p.digest, req.position);
      this.phase = 'running';
      this.follow = { stopped: false };
      const done = await followBulk(first, (r) => (this.record = r), this.follow);
      this.record = done;
      this.phase = 'result';
      this.dispatchEvent(new CustomEvent('bulk-done', { detail: done, bubbles: true, composed: true }));
    } catch (err) {
      this.error = err instanceof ApiError && err.code === 'target_changed'
        ? 'רשימת ההתקנים השתנתה מאז שנפתח החלון, ולכן לא נשלח דבר. פתחו את הפעולה מחדש.'
        : describeError(err);
      this.phase = 'error';
      this.dispatchEvent(new CustomEvent('bulk-done', { detail: null, bubbles: true, composed: true }));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.follow) this.follow.stopped = true;
  }

  /** Focus starts on Cancel whenever the dialog shows a new step (sw-dialog itself focuses only when it opens, and
   * the preview arrives after that): a stray Enter can never confirm a bulk action. */
  protected updated(changed: Map<string, unknown>) {
    if (!changed.has('phase') || this.phase === 'closed' || this.phase === 'sending' || this.phase === 'running') return;
    requestAnimationFrame(() => {
      const btn = this.renderRoot.querySelector<HTMLElement>('sw-button[data-bulk-cancel]');
      const inner = btn?.shadowRoot?.querySelector<HTMLElement>('button');
      (inner ?? btn)?.focus({ preventScroll: true });
    });
  }

  render() {
    const req = this.req;
    if (this.phase === 'closed' || !req) return html`<sw-dialog data-bulk-dialog="closed"></sw-dialog>`;
    const heading = `${BULK_KIND_LABEL[req.kind]} · ${BULK_SCOPE_LABEL[req.scope]}${req.scope === 'building' ? '' : ` ${req.name}`}`;
    return html`<sw-dialog open data-bulk-dialog=${this.phase} heading=${heading} subheading="פעולה מרוכזת על כמה התקנים בבת אחת" @close=${this.close}>
      ${this.renderBody()}
    </sw-dialog>`;
  }

  private renderBody() {
    const cancel = (label = 'ביטול') => html`<sw-button data-bulk-cancel autofocus @click=${this.close}>${label}</sw-button>`;
    if (this.phase === 'loading') return html`<div class="muted">בודק מה יישלח…</div><div class="actions">${cancel()}</div>`;
    if (this.phase === 'error') return html`<div class="err" data-bulk-error>${this.error}</div><div class="actions">${cancel('סגור')}</div>`;
    const p = this.preview;
    if (this.phase === 'nothing' && p) {
      return html`<div class="what" data-bulk-nothing>
          <div class="big">אין מה לשלוח</div>
          <div>לפי הדיווח האחרון אין ב${BULK_SCOPE_LABEL[p.scope]} ${p.scope === 'building' ? '' : bidi(p.name)} התקן פעיל מהסוג הזה.</div>
          ${this.renderSkipped(p)}
          <div class="never">${p.note}</div>
        </div>
        <div class="actions">${cancel('סגור')}</div>`;
    }
    if (this.phase === 'confirm' && p) return this.renderConfirm(p);
    const r = this.record;
    if (this.phase === 'sending' || !r) return html`<div class="muted" data-bulk-progress>שולח…</div>`;
    return this.renderProgress(r);
  }

  private renderSkipped(p: BulkPreview) {
    return html`${p.skipped.already ? html`<div class="muted" data-bulk-skipped="already">${ltrNum(p.skipped.already)} כבר במצב המבוקש - לא יישלח אליהם.</div>` : nothing}
      ${p.skipped.unavailable ? html`<div class="muted" data-bulk-skipped="unavailable">${ltrNum(p.skipped.unavailable)} לא זמינים - לא יישלח אליהם.</div>` : nothing}
      ${p.excluded.length
        ? html`<div class="muted" data-bulk-excluded>לא נכלל (${ltrNum(p.excluded.length)}):
            <ul class="list">${p.excluded.map((x) => html`<li data-entity=${x.entity_id} data-reason=${x.reason}>${bidi(x.name)} - ${x.reason_label}</li>`)}</ul>
          </div>`
        : nothing}`;
  }

  private renderConfirm(p: BulkPreview) {
    const never = Object.entries(p.never_included);
    const posSuffix = p.kind === 'covers_position' && p.position !== null && p.position !== undefined ? ` למיקום ${ltrNum(p.position)}%` : '';
    return html`<div class="what" data-bulk-what>
        <div class="big" data-bulk-count=${p.count}>יישלח ${p.kind_label}${posSuffix} ל־${ltrNum(p.count)} התקנים${p.scope === 'building' ? ' במבנה כולו' : ` ב${BULK_SCOPE_LABEL[p.scope]} ${bidi(p.name)}`}${p.floor_name ? ` (${bidi(p.floor_name)})` : ''}:</div>
        <div class="domains" data-bulk-domains>${Object.entries(p.by_domain).map(([d, n]) => html`<span data-domain=${d}>${p.domain_labels[d] ?? d}: ${ltrNum(n)}</span>`)}</div>
        <details><summary>רשימת ההתקנים</summary><ul>${p.targets.map((t) => html`<li>${bidi(t.name)}${t.area_name && p.scope !== 'area' ? html` <span class="muted">· ${bidi(t.area_name)}</span>` : nothing}</li>`)}</ul></details>
        ${this.renderSkipped(p)}
        <div class="never" data-bulk-never>
          ${p.note}${never.length ? html`<br />נמצאים כאן ואינם נכללים: ${never.map(([d, n]) => `${p.domain_labels[d] ?? d} (${n})`).join(', ')}.` : nothing}
        </div>
        <div class="muted">התקן ייחשב כבוי / סגור רק כשיתקבל דיווח על כך.</div>
      </div>
      <div class="actions">
        <sw-button data-bulk-cancel autofocus @click=${this.close}>ביטול</sw-button>
        <sw-button data-bulk-confirm variant="danger" @click=${() => void this.confirm()}>${BULK_KIND_LABEL[p.kind]} (${ltrNum(p.count)})</sw-button>
      </div>`;
  }

  private renderProgress(r: BulkRecord) {
    const h = bulkHeadline(r);
    const c = r.counts;
    const pct = c.total ? Math.round((c.confirmed / c.total) * 100) : 0;
    const notOk = r.items.filter((i) => i.outcome !== 'confirmed');
    return html`<div class="what" data-bulk-progress data-confirmed=${c.confirmed} data-total=${c.total} data-done=${String(r.done)}>
        <div class=${classMap({ headline: true, [h.tone]: true })} data-bulk-result=${r.done ? h.tone : 'running'}>
          ${r.done ? html`<sw-icon .name=${h.tone === 'ok' ? 'check' : 'warning'} size=${16}></sw-icon>` : nothing}${h.text}
        </div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax=${c.total} aria-valuenow=${c.confirmed} aria-label="אושרו"><div style=${`inline-size:${pct}%`}></div></div>
        <div class="muted">${ltrNum(c.confirmed)} מתוך ${ltrNum(c.total)} אושרו${r.done ? '' : ` · ${ltrNum(c.accepted + c.queued)} ממתינים`}${c.unknown ? ` · ${ltrNum(c.unknown)} תוצאה לא ידועה` : ''}</div>
        ${r.done && notOk.length
          ? html`<div data-bulk-not-confirmed>
              <div class="muted">${notOk.length === 1 ? 'התקן שלא אושר:' : 'התקנים שלא אושרו:'}</div>
              <ul class="list">${notOk.map((i) => html`<li data-entity=${i.entity_id} data-outcome=${i.outcome}>${bidi(i.name)}<span class="outcome">${OUTCOME_LABEL[i.outcome]}${i.outcome === 'refused' && !i.sent ? ' (לא נשלח)' : ''}</span></li>`)}</ul>
            </div>`
          : nothing}
        ${r.done ? html`<div class="muted">${r.note}</div>` : html`<div class="muted">אפשר לסגור את החלון; הפעולה ממשיכה בשרת.</div>`}
      </div>
      <div class="actions"><sw-button data-bulk-cancel autofocus @click=${this.close}>סגור</sw-button></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-bulk-menu': DevicesBulkMenu;
    'devices-bulk-dialog': DevicesBulkDialog;
  }
}
