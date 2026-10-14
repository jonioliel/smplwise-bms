import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { t, type I18nKey } from '../i18n/he';
import { ROUTE_MIN_STOPS, routeStops } from './walk-route';
import type { WalkStart } from './walk-world';

/**
 * Plan Studio 6, slice S5-A (CR-029 sections 4.2 and 4.4): the walk's own controls - the part of the walk UI that belongs to the
 * hand, kept out of `sw-plan-3d` (the element that also owns the stage, the probe, the time pill and the strip):
 *
 * - the joystick the finger drags (a ring under the thumb and a knob; drawn imperatively, `setStick`, because it moves at the
 *   frame rate), the ring that marks where a tap sent the walk (`setTarget`), and the dim for a jump between saved positions
 *   (`setFade`);
 * - the walk bar: in a view wider than 640 px the compact floating bar of the first walk - exit, "stand at...", the route, the
 *   numeric position fields - and on a phone a bottom sheet: one row of 44 px controls that opens upward to the list of places
 *   and the numeric fields. Every control takes the desktop touch dial (44 px by default) and is never under 44 px below 1100 px
 *   or on a coarse pointer.
 *
 * It shows no hint and no paragraph (operator screens stay clean), it reads only `--sw-*` tokens, and it holds no walk state:
 * the element hands it the start points, the pose it shows and whether the route plays, and listens for what the person did
 * (`hud-exit`, `hud-goto`, `hud-field`, `hud-route`). The geometry of the walk is never mirrored by RTL: the joystick is
 * placed by physical coordinates, the text is Hebrew.
 */
export interface WalkHudGoto {
  id: string;
}
export interface WalkHudField {
  key: 'x' | 'z' | 'heading';
  value: number;
}
export interface WalkHudRoute {
  play: boolean;
}
export interface WalkStickShape {
  /** Client coordinates of the finger's origin and the knob's offset from it. */
  origin: [number, number];
  knob: [number, number];
  run: boolean;
}

/** Up to this width of the element the bar becomes a bottom sheet. */
export const SHEET_MAX_W = 640;
const KINDS = ['saved', 'door', 'room', 'camera', 'centre'] as const;
const KIND_KEY: Record<(typeof KINDS)[number], I18nKey> = { saved: 'walk.kindSaved', door: 'walk.kindDoor', room: 'walk.kindRoom', camera: 'walk.kindCamera', centre: 'walk.kindCentre' };
/** The Hebrew title of a kind of start point (the places list, the select's groups). */
export const kindTitle = (kind: string): string => (kind in KIND_KEY ? t(KIND_KEY[kind as keyof typeof KIND_KEY]) : kind);
/** A drag of the grabber past this opens (up) or closes (down) the sheet. */
const SWIPE_PX = 28;

@customElement('sw-walk-hud')
export class SwWalkHud extends LitElement {
  @property({ attribute: false }) starts: WalkStart[] = [];
  /** The pose the numeric fields show (metres, degrees); null = no pose yet. */
  @property({ attribute: false }) shown: { x: number; z: number; heading: number; level: string } | null = null;
  @property({ type: Boolean }) routePlaying = false;
  @state() private compact = false;
  @state() private open = false;
  private ro?: ResizeObserver;
  private swipe: { y: number; id: number; moved: boolean } | null = null;
  private suppressClick = false;

  static styles = css`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: var(--sw-z-map-ui);
      direction: rtl;
      --hud-tap: var(--sw-touch-desktop);
    }
    /* a finger needs 44 px: below 1100 px and on a coarse pointer whatever the desktop dial says */
    @media (max-width: 1100px), (pointer: coarse) {
      :host {
        --hud-tap: 44px;
      }
    }
    [hidden] {
      display: none !important;
    }
    /* ---- the joystick: a ring under the thumb and a knob; moved by transforms from setStick (no Lit render per frame) */
    .stick {
      position: absolute;
      left: 0;
      top: 0;
      inline-size: 112px;
      block-size: 112px;
      margin: -56px 0 0 -56px;
      border-radius: 50%;
      border: 2px solid var(--sw-on-video-2);
      background: color-mix(in srgb, var(--sw-video-scrim) 30%, transparent);
      box-shadow: 0 0 0 1px var(--sw-video-scrim); /* a dark edge: the white ring alone vanishes on a white wall */
      box-sizing: border-box;
      pointer-events: none;
    }
    .stick[data-run] {
      border-color: var(--sw-accent);
    }
    .knob {
      position: absolute;
      left: 50%;
      top: 50%;
      inline-size: 44px;
      block-size: 44px;
      margin: -22px 0 0 -22px;
      border-radius: 50%;
      background: var(--sw-accent);
      border: 2px solid var(--sw-on-video);
      box-sizing: border-box;
      box-shadow: var(--sw-shadow-2);
    }
    /* ---- where a tap sent the walk */
    .target {
      position: absolute;
      left: 0;
      top: 0;
      inline-size: 28px;
      block-size: 28px;
      margin: -14px 0 0 -14px;
      border-radius: 50%;
      border: 3px solid var(--sw-live);
      background: color-mix(in srgb, var(--sw-live) 22%, transparent);
      box-sizing: border-box;
      pointer-events: none;
      animation: pulse calc(var(--sw-t-med) * 6) ease-in-out infinite alternate;
    }
    @keyframes pulse {
      from {
        opacity: 0.55;
      }
      to {
        opacity: 1;
      }
    }
    /* ---- the dim between two saved positions of a route */
    .fade {
      position: absolute;
      inset: 0;
      background: var(--sw-video-bg);
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .fade[data-on] {
      opacity: 0.85;
    }
    /* ---- the controls both layouts share */
    .btn {
      min-inline-size: var(--hud-tap);
      min-block-size: var(--hud-tap);
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding-inline: var(--sw-s-3);
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      line-height: 1;
      white-space: nowrap;
      cursor: pointer;
      touch-action: manipulation;
    }
    .btn.ghost {
      background: transparent;
      border-color: transparent;
      color: var(--sw-text-2);
    }
    .btn[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .btn:focus-visible,
    select:focus-visible,
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .chev {
      display: block;
      inline-size: 9px;
      block-size: 9px;
      border-left: 2px solid currentColor; /* physical: the chevron is a shape, not text (RTL must not turn it sideways) */
      border-top: 2px solid currentColor;
      transform: translateY(2px) rotate(45deg);
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    .btn[aria-expanded='true'] .chev {
      transform: translateY(-2px) rotate(225deg);
    }
    label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    input {
      inline-size: 72px;
      min-block-size: var(--hud-tap);
      box-sizing: border-box;
      font: inherit;
      font-size: var(--sw-fs-sm);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      padding: 3px 6px;
      background: var(--sw-surface);
      color: var(--sw-text);
      direction: ltr;
    }
    select {
      min-block-size: var(--hud-tap);
      box-sizing: border-box;
      font: inherit;
      font-size: var(--sw-fs-sm);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-pill);
      padding: 4px 10px;
      background: var(--sw-surface);
      color: var(--sw-text);
      max-inline-size: 170px;
    }
    /* ---- the floating bar (a desktop, a tablet, any view wider than 640 px) */
    .walkbar {
      position: absolute;
      inset-block-end: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: 6px 8px;
      border-radius: var(--sw-r-md);
      /* over the live 3D scene the bar is opaque (owner 2026-10-13, like the phone sheet below): the menu surface and the strong hairline, no blur */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      box-shadow: var(--sw-shadow-1);
      max-inline-size: calc(100% - 24px);
      overflow-x: auto;
      pointer-events: auto;
      color: var(--sw-text);
    }
    /* ---- the phone: a bottom sheet that opens upward from one row of controls */
    .sheet {
      --hud-tap: 44px;
      position: absolute;
      inset-inline: 0;
      inset-block-end: 0;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      max-block-size: min(64%, 480px);
      border-start-start-radius: var(--sw-r-xl);
      border-start-end-radius: var(--sw-r-xl);
      /* over a live 3D scene the bottom sheet (places, fields) is a menu: fully opaque so the text always reads, whatever the look dial or the
         skin says (owner 2026-10-13; it was 94 % of the solid twin under a blur) */
      background: var(--sw-menu-surface);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong), var(--sw-shadow-3);
      color: var(--sw-text);
      padding-block-end: env(safe-area-inset-bottom, 0px);
      pointer-events: auto;
    }
    .sheet .body {
      flex: 1 1 auto;
      min-block-size: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      touch-action: pan-y;
      padding: var(--sw-s-3) var(--sw-s-3) var(--sw-s-1);
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .sheet .group {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
    }
    .sheet .group h4 {
      margin: 0;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .sheet .places,
    .sheet .fields {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    /* a long position name (up to 40 characters) stays inside the sheet */
    .sheet .places .btn {
      max-inline-size: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sheet .fields {
      gap: var(--sw-s-3);
    }
    .sheet label {
      font-size: var(--sw-fs-sm);
    }
    .sheet input {
      inline-size: 84px;
      font-size: var(--sw-fs-md);
    }
    .sheet .row {
      flex: none;
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: var(--sw-s-2) var(--sw-s-3);
    }
    .sheet .row .gap {
      flex: 1;
    }
    .sheet .body + .row {
      border-block-start: 1px solid var(--sw-border);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    const box = ((this.getRootNode() as ShadowRoot).host as HTMLElement | undefined) ?? this;
    this.compact = box.clientWidth > 0 && box.clientWidth <= SHEET_MAX_W;
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => {
        const w = box.clientWidth;
        if (w > 0) this.compact = w <= SHEET_MAX_W;
      });
      this.ro.observe(box);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
  }

  // ---- imperative drawing (called at the frame rate; no Lit render)

  /** Show the joystick (client coordinates of the finger's origin; the knob's offset) or hide it (null). */
  setStick(s: WalkStickShape | null): void {
    const el = this.renderRoot.querySelector<HTMLElement>('.stick');
    if (!el) return;
    if (!s) {
      el.hidden = true;
      return;
    }
    const r = this.getBoundingClientRect();
    el.hidden = false;
    el.style.transform = `translate(${Math.round(s.origin[0] - r.left)}px, ${Math.round(s.origin[1] - r.top)}px)`;
    el.toggleAttribute('data-run', s.run);
    const knob = el.querySelector<HTMLElement>('.knob');
    if (knob) knob.style.transform = `translate(${Math.round(s.knob[0])}px, ${Math.round(s.knob[1])}px)`;
  }

  /** Mark where the walk is going (host-local pixels) or clear the mark (null). */
  setTarget(p: { x: number; y: number } | null): void {
    const el = this.renderRoot.querySelector<HTMLElement>('.target');
    if (!el) return;
    if (!p) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
  }

  /** Dim the view (the jump between two saved positions of a route). */
  setFade(on: boolean): void {
    this.renderRoot.querySelector<HTMLElement>('.fade')?.toggleAttribute('data-on', on);
  }

  /** The sheet is open (tests). */
  get sheetOpen(): boolean {
    return this.compact && this.open;
  }

  // ---- events

  private emit<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(name, { detail }));
  }

  private onField(key: WalkHudField['key'], e: Event): void {
    const v = Number((e.target as HTMLInputElement).value);
    if (Number.isFinite(v)) this.emit<WalkHudField>('hud-field', { key, value: v });
  }

  private goto(id: string): void {
    if (!id) return;
    this.emit<WalkHudGoto>('hud-goto', { id });
    this.open = false;
  }

  private toggleRoute(): void {
    this.emit<WalkHudRoute>('hud-route', { play: !this.routePlaying });
  }

  private onGrabDown = (e: PointerEvent): void => {
    this.swipe = { y: e.clientY, id: e.pointerId, moved: false };
  };
  private onGrabMove = (e: PointerEvent): void => {
    const s = this.swipe;
    if (!s || e.pointerId !== s.id || s.moved) return;
    const d = e.clientY - s.y;
    if (d <= -SWIPE_PX) {
      this.open = true;
      s.moved = true;
    } else if (d >= SWIPE_PX) {
      this.open = false;
      s.moved = true;
    }
  };
  private onGrabUp = (e: PointerEvent): void => {
    if (!this.swipe || e.pointerId !== this.swipe.id) return;
    const moved = this.swipe.moved;
    this.swipe = null;
    if (moved) {
      // a swipe already did its job: the click that may follow the lift must not toggle it back (and must not outlive it)
      this.suppressClick = true;
      window.setTimeout(() => (this.suppressClick = false), 80);
    }
  };
  private onGrabClick = (): void => {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.open = !this.open;
  };

  // ---- templates

  private routeButton() {
    if (routeStops(this.starts).length < ROUTE_MIN_STOPS) return nothing;
    return html`<button type="button" class="btn ${this.compact ? '' : 'ghost'}" data-walk-route aria-pressed=${this.routePlaying ? 'true' : 'false'} @click=${() => this.toggleRoute()}>${this.routePlaying ? t('walk.routeStop') : t('walk.route')}</button>`;
  }

  private fields() {
    const s = this.shown;
    if (!s) return nothing;
    return html`<label class="num">x <input type="number" step="0.1" inputmode="decimal" data-walk-x aria-label=${t('walk.xMetres')} .value=${s.x.toFixed(2)} @change=${(e: Event) => this.onField('x', e)} /></label>
      <label class="num">y <input type="number" step="0.1" inputmode="decimal" data-walk-y aria-label=${t('walk.yMetres')} .value=${s.z.toFixed(2)} @change=${(e: Event) => this.onField('z', e)} /></label>
      <label class="num">${t('walk.heading')} <input type="number" step="5" inputmode="numeric" data-walk-heading aria-label=${t('walk.headingDeg')} .value=${String(s.heading)} @change=${(e: Event) => this.onField('heading', e)} /></label>`;
  }

  private bar() {
    const kinds = KINDS.filter((k) => this.starts.some((s) => s.kind === k));
    return html`<div class="walkbar" role="group" aria-label=${t('walk.bar')} data-walk-bar>
      <button type="button" class="btn ghost" data-walk-exit @click=${() => this.emit('hud-exit', null)}>${t('walk.exit')}</button>
      <select data-walk-start aria-label=${t('walk.standAt')} @change=${(e: Event) => {
        const sel = e.target as HTMLSelectElement;
        const id = sel.value;
        sel.value = '';
        this.goto(id);
      }}>
        <option value="">${t('walk.standAt')}</option>
        ${kinds.map((k) => html`<optgroup label=${kindTitle(k)}>${this.starts.filter((q) => q.kind === k).map((q) => html`<option value=${q.id}>${q.label || kindTitle(k)}</option>`)}</optgroup>`)}
      </select>
      ${this.routeButton()}
      ${this.fields()}
    </div>`;
  }

  private sheet() {
    const kinds = KINDS.filter((k) => this.starts.some((s) => s.kind === k));
    return html`<div class="sheet" role="group" aria-label=${t('walk.bar')} data-walk-bar data-walk-sheet data-open=${this.open ? 'true' : 'false'}>
      ${this.open
        ? html`<div class="body" id="walk-sheet-body" data-walk-sheet-body>
            ${kinds.map((k) => html`<div class="group"><h4>${kindTitle(k)}</h4>
              <div class="places">${this.starts.filter((q) => q.kind === k).map((q) => html`<button type="button" class="btn" data-walk-place=${q.id} @click=${() => this.goto(q.id)}>${q.label || kindTitle(k)}</button>`)}</div></div>`)}
            <div class="fields">${this.fields()}</div>
          </div>`
        : nothing}
      <div class="row">
        <button type="button" class="btn ghost" data-walk-exit @click=${() => this.emit('hud-exit', null)}>${t('walk.exit')}</button>
        <button type="button" class="btn" data-walk-sheet-toggle aria-expanded=${this.open ? 'true' : 'false'} aria-controls="walk-sheet-body"
          style="touch-action: none" @pointerdown=${this.onGrabDown} @pointermove=${this.onGrabMove} @pointerup=${this.onGrabUp} @pointercancel=${this.onGrabUp} @click=${this.onGrabClick}>${t('walk.standAt')}<i class="chev" aria-hidden="true"></i></button>
        <span class="gap"></span>
        ${this.routeButton()}
      </div>
    </div>`;
  }

  render() {
    return html`<i class="stick" hidden aria-hidden="true"><i class="knob"></i></i><i class="target" hidden aria-hidden="true"></i><i class="fade" aria-hidden="true"></i>${this.compact ? this.sheet() : this.bar()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-walk-hud': SwWalkHud;
  }
}
