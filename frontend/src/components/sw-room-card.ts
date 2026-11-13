import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import './sw-icon';
import './sw-toggle';
import type { IconName } from './sw-icon';
import type { HaActionSpec } from '../api/ha';
import { snapshotUrl } from '../api/media';

/**
 * PLAN3D-R28-UI-2433 (round 28 mockup, app/room.html): the room card. A tap on a room - its pill, its plate in the 3D, its polygon in
 * the 2D, the popover's "כרטיס החדר" - opens one card for the whole room instead of the card of one device: the camera, the lights,
 * the climate, the doors, windows and shutters. Desktop: a side panel (the 3D centres the room in what is left); a phone: a sheet from
 * the bottom - low (the quick row and what is open) or full (tabs instead of scrolling). Nothing scrolls: a list longer than its
 * space pages. The card runs nothing itself: every control sends `room-card-action` with the entity's own action spec and the host
 * runs it through the floor map's existing path (permission, the sensitive-action confirmation, the audit). A device the person may
 * not control shows "אין הרשאה" and no control. The video is never mirrored (direction ltr, no transform).
 * The open choices of round 28 (group ב) are settings the host reads (`map.room_card_place`, `map.room_card_confirm`,
 * `map.room_card_camera`) and hands in as `place` and `camera`.
 */
export interface RoomCardLight {
  entityId: string;
  label: string;
  /** null = unknown (stale): the switch is shown off and disabled. */
  on: boolean | null;
  /** The action that flips it now (turn_off when on, turn_on when off), null = none the person may run. */
  spec: HaActionSpec | null;
  forbidden: boolean;
}
export interface RoomCardOpening {
  entityId: string;
  label: string;
  words: string;
  open: boolean;
  icon: IconName;
  /** The one action the row offers now (close an open shutter, open a locked door …), null = read-only (a bare sensor). */
  spec: HaActionSpec | null;
  forbidden: boolean;
}
export interface RoomCardClimate {
  entityId: string | null;
  now: number | null;
  /** The set point (a climate entity), null = a sensor only. */
  target: number | null;
  step: number;
  min: number;
  max: number;
  /** climate.set_temperature, when the person may run it. */
  spec: HaActionSpec | null;
  words: string;
}
export interface RoomCardModel {
  id: string;
  name: string;
  levelName: string;
  presence: boolean;
  /** Minutes since the last motion (no presence now), null = unknown. */
  quietMin: number | null;
  open: number;
  lights: RoomCardLight[];
  climate: RoomCardClimate | null;
  openings: RoomCardOpening[];
  cameras: { id: string; label: string }[];
  /** The area page of the room, when it is linked to one. */
  areaHref: string | null;
  /** The entity whose action is running now (its control is disabled). */
  busy: string | null;
  /** A stale screen: no control runs. */
  stale: boolean;
}
export interface RoomCardActionDetail {
  entityId: string;
  spec: HaActionSpec;
  args?: Record<string, unknown>;
}
export interface RoomCardBulkDetail {
  label: string;
  items: { entityId: string; spec: HaActionSpec }[];
}
export type RoomCardPlace = 'side' | 'float' | 'sheet';
export type RoomCardCamera = 'snapshot' | 'live' | 'none';
type Tab = 'lights' | 'climate' | 'opens' | 'cam';

/** How many rows a section shows before it pages (desktop side panel / sheet). */
const ROWS_SIDE = 4;
const ROWS_SHEET = 4;
/** The still refreshes this often while the card is open (snapshot mode). */
const STILL_MS = 5000;

const tempText = (t: number): string => `${Number.isInteger(Math.round(t * 10) / 10) ? Math.round(t) : (Math.round(t * 10) / 10).toFixed(1)}°`;

@customElement('sw-room-card')
export class SwRoomCard extends LitElement {
  @property({ attribute: false }) model: RoomCardModel | null = null;
  @property({ reflect: true }) place: RoomCardPlace = 'side';
  @property() camera: RoomCardCamera = 'snapshot';
  /** The sheet's height: low (the quick row and what is open) or full (tabs). */
  @property({ reflect: true }) sheet: 'peek' | 'full' = 'peek';
  @state() private tab: Tab = 'lights';
  @state() private pages: Record<string, number> = {};
  @state() private liveOn = false;
  @state() private bust = Date.now();
  private stillTimer = 0;
  /** Rows per section before it pages, from the card's own height (no scrolling). */
  @state() private rows = ROWS_SIDE;
  private ro: ResizeObserver | null = null;

  static styles = css`
    :host {
      position: absolute;
      z-index: var(--sw-z-map-ui);
      direction: rtl;
      display: flex;
      flex-direction: column;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xl);
      box-shadow: var(--sw-shadow-3);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
      overflow: hidden;
      box-sizing: border-box;
    }
    :host([place='side']) {
      inset-block: 12px;
      inset-inline-end: 12px;
      inline-size: min(360px, calc(100% - 24px));
      animation: side-in 300ms var(--sw-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1));
    }
    :host([place='float']) {
      inset-block-start: 12px;
      inset-inline-end: 12px;
      inline-size: min(320px, calc(100% - 24px));
      max-block-size: calc(100% - 24px);
      animation: pop-in 180ms var(--sw-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
      transform-origin: top left;
    }
    :host([place='sheet']) {
      inset-inline: 0;
      inset-block-end: 0;
      block-size: 47%;
      border-radius: var(--sw-r-2xl) var(--sw-r-2xl) 0 0;
      border-inline: 0;
      border-block-end: 0;
      padding-block-end: env(safe-area-inset-bottom);
      animation: sheet-in 320ms var(--sw-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1));
      transition: block-size 260ms var(--sw-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1));
    }
    :host([place='sheet'][sheet='full']) {
      block-size: 86%;
    }
    @keyframes side-in {
      from {
        opacity: 0;
        translate: -16px 0;
      }
    }
    @keyframes pop-in {
      from {
        opacity: 0;
        scale: 0.97;
      }
    }
    @keyframes sheet-in {
      from {
        translate: 0 100%;
      }
    }
    @keyframes fade-in {
      from {
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: fade-in 160ms ease !important;
        transition: none !important;
      }
    }
    button,
    footer a {
      font: inherit;
      color: inherit;
      cursor: pointer;
      transition: scale 120ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    button:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .grab {
      display: none;
      flex: none;
      inline-size: 100%;
      block-size: 22px;
      border: 0;
      background: none;
      padding: 0;
      touch-action: none;
    }
    .grab::after {
      content: '';
      display: block;
      inline-size: 40px;
      block-size: 5px;
      margin: 8px auto 0;
      border-radius: 3px;
      background: var(--sw-border-strong);
    }
    :host([place='sheet']) .grab {
      display: block;
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 14px 14px 8px 16px;
      flex: none;
    }
    :host([place='sheet']) header {
      padding-block: 4px 6px;
    }
    h2 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.01em;
    }
    .sub {
      margin-block-start: 2px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-start: 6px;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      block-size: 22px;
      padding-inline: 8px;
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      background: linear-gradient(var(--sw-accent-soft), var(--sw-accent-soft)), var(--sw-menu-surface);
      color: var(--sw-text-2);
    }
    .tag.pres {
      color: var(--sw-accent-text);
    }
    .tag.open {
      color: var(--sw-danger-text);
    }
    .x {
      margin-inline-start: auto;
      flex: none;
      inline-size: 36px;
      block-size: 36px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: var(--sw-r-md);
      background: var(--sw-menu-surface);
      color: var(--sw-text-2);
    }
    @media (hover: hover) and (pointer: fine) {
      .x:hover,
      .act:hover,
      .pager button:hover {
        background: linear-gradient(var(--sw-accent-soft), var(--sw-accent-soft)), var(--sw-menu-surface);
      }
    }
    .quick {
      display: none;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      padding: 0 12px 8px;
      flex: none;
    }
    :host([place='sheet']) .quick {
      display: grid;
    }
    .quick button {
      display: grid;
      justify-items: center;
      gap: 2px;
      min-block-size: 52px;
      padding: 6px 4px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-menu-surface);
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      color: var(--sw-text-2);
    }
    .quick button:disabled,
    footer button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .quick button.on {
      color: var(--sw-warning-text);
    }
    .quick button.al {
      color: var(--sw-danger-text);
    }
    .tabs {
      display: none;
      gap: 4px;
      padding: 0 12px 6px;
      flex: none;
    }
    :host([place='sheet'][sheet='full']) .tabs {
      display: flex;
    }
    .tabs button {
      flex: 1;
      block-size: 40px;
      border: 0;
      border-radius: var(--sw-r-md);
      background: var(--sw-menu-surface);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .tabs button[aria-pressed='true'] {
      background: linear-gradient(var(--sw-accent-soft), var(--sw-accent-soft)), var(--sw-menu-surface);
      color: var(--sw-accent-text);
      font-weight: 700;
    }
    .body {
      flex: 1;
      min-block-size: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    /* the sheet: the low sheet shows what is open, the full one the chosen tab */
    :host([place='sheet']) [data-tab] {
      display: none;
    }
    :host([place='sheet'][sheet='peek']) [data-tab='opens'],
    :host([place='sheet'][sheet='full']) [data-tab].cur {
      display: block;
    }
    .still {
      position: relative;
      margin: 0 12px 4px;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-video-bg);
      direction: ltr;
      flex: none;
      border: 0;
      padding: 0;
      inline-size: calc(100% - 24px);
      display: block;
    }
    .still img,
    .still sw-live-player {
      display: block;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .still .cap {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 0;
      direction: rtl;
      display: flex;
      gap: 8px;
      padding: 18px 10px 7px;
      background: linear-gradient(transparent, var(--sw-video-scrim));
      color: var(--sw-on-video);
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      text-align: start;
    }
    .still .cap span:last-child {
      margin-inline-start: auto;
      opacity: 0.85;
      font-weight: 500;
    }
    .still .none {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--sw-on-video-2);
      direction: rtl;
      font-size: var(--sw-fs-xs);
    }
    .sec {
      padding: 6px 16px 0;
    }
    :host([place='sheet']) .sec {
      padding-inline: 14px;
    }
    h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      block-size: 28px;
      margin: 0;
      font-size: var(--sw-fs-xs);
      font-weight: 700;
      color: var(--sw-text-2);
    }
    .act {
      margin-inline-start: auto;
      block-size: 28px;
      padding-inline: 8px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: var(--sw-menu-surface);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-xs);
      font-weight: 700;
    }
    .r {
      display: flex;
      align-items: center;
      gap: 10px;
      block-size: 40px;
    }
    :host([place='sheet']) .r {
      block-size: 44px;
    }
    .r > sw-icon {
      color: var(--sw-text-2);
      flex: none;
    }
    .r.lit > sw-icon {
      color: var(--sw-warning-text);
    }
    .r.open > sw-icon,
    .r.open .st {
      color: var(--sw-danger-text);
    }
    .r .l {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .r .st {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
    }
    .r .no {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .r.forbidden {
      opacity: 0.6;
    }
    .r .do {
      min-block-size: 32px;
      padding-inline: 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-menu-surface);
      font-size: var(--sw-fs-xs);
      font-weight: 700;
    }
    .r .do:disabled,
    .step button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .r .do.sens {
      color: var(--sw-danger-text);
    }
    .climate {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 48px;
    }
    .climate .now {
      font-size: var(--sw-fs-2xl);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .climate .now small {
      margin-inline-start: 6px;
      font-size: var(--sw-fs-xs);
      font-weight: 500;
      color: var(--sw-text-2);
    }
    .step {
      margin-inline-start: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .step button {
      inline-size: 36px;
      block-size: 36px;
      display: grid;
      place-items: center;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-menu-surface);
    }
    .step b {
      min-inline-size: 40px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .num {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      block-size: 28px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .pager button {
      inline-size: 28px;
      block-size: 28px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: var(--sw-menu-surface);
    }
    .empty {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      padding-block: 6px;
    }
    footer {
      margin-block-start: auto;
      display: flex;
      gap: 8px;
      padding: 10px 12px;
      border-block-start: 1px solid var(--sw-border-strong);
      flex: none;
    }
    :host([place='sheet'][sheet='peek']) footer {
      display: none;
    }
    footer a,
    footer button {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      block-size: 40px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      font-weight: 700;
      text-decoration: none;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-menu-surface);
      color: var(--sw-text);
    }
    footer .pri {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .pri:active,
    .do:active,
    .quick button:active {
      scale: 0.97;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.ro = new ResizeObserver(() => {
      const h = this.clientHeight;
      const rows = this.place === 'sheet' ? ROWS_SHEET : h >= 760 ? 4 : h >= 640 ? 3 : 2;
      if (rows !== this.rows) this.rows = rows;
    });
    this.ro.observe(this);
    this.stillTimer = window.setInterval(() => {
      if (this.camera === 'snapshot' && !this.liveOn && !document.hidden) this.bust = Date.now();
    }, STILL_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.stillTimer);
    this.ro?.disconnect();
    this.ro = null;
  }

  protected updated(): void {
    if (this.liveOn) void import('./sw-live-player'); // the player rides in its own chunk until a video is asked for
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    const prev = changed.get('model') as RoomCardModel | null | undefined;
    if (changed.has('model') && prev && this.model && prev.id !== this.model.id) {
      this.pages = {};
      this.liveOn = false;
      this.sheet = 'peek';
    }
    if (changed.has('camera')) this.liveOn = this.camera === 'live';
  }

  private emit<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
  }

  private run(entityId: string, spec: HaActionSpec, args?: Record<string, unknown>): void {
    this.emit<RoomCardActionDetail>('room-card-action', { entityId, spec, ...(args ? { args } : {}) });
  }

  private openTab(t: Tab): void {
    this.tab = t;
    this.sheet = 'full';
  }

  /** One page of a list and its pager (no scrolling: a long list pages). */
  private paged<T>(key: string, list: readonly T[], per: number, row: (x: T) => TemplateResult): TemplateResult {
    const pages = Math.max(1, Math.ceil(list.length / per));
    const page = Math.min(this.pages[key] ?? 0, pages - 1);
    const go = (d: number) => (this.pages = { ...this.pages, [key]: Math.max(0, Math.min(pages - 1, page + d)) });
    return html`${list.slice(page * per, page * per + per).map(row)}${pages > 1
      ? html`<div class="pager" data-room-pager=${key}><button type="button" aria-label="הקודם" ?disabled=${page === 0} @click=${() => go(-1)}><sw-icon name="chevron" size=${14} flip></sw-icon></button><span class="num">${page + 1}/${pages}</span><button type="button" aria-label="הבא" ?disabled=${page >= pages - 1} @click=${() => go(1)}><sw-icon name="chevron" size=${14}></sw-icon></button></div>`
      : nothing}`;
  }

  private renderCamera(m: RoomCardModel): TemplateResult | typeof nothing {
    if (this.camera === 'none') return nothing;
    const cam = m.cameras[0];
    if (!cam) return nothing;
    const live = this.liveOn;
    return html`<button type="button" class="still" data-room-camera=${cam.id} aria-label=${live ? `וידאו חי: ${cam.label}` : `תמונה מהמצלמה: ${cam.label}. לחץ לווידאו חי`} @click=${() => { if (!live) this.liveOn = true; else this.emit('room-card-camera', { id: cam.id }); }}>
      ${live ? html`<sw-live-player .cameraId=${cam.id} profile="sub" compact .poster=${snapshotUrl(cam.id, this.bust)} fit="cover"></sw-live-player>` : html`<img alt="" src=${snapshotUrl(cam.id, this.bust)} @error=${(e: Event) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />`}
      <span class="cap"><span>מצלמה · ${cam.label}</span><span>${live ? 'למסך המצלמה' : 'לחץ לווידאו חי'}</span></span>
    </button>`;
  }

  private renderLights(m: RoomCardModel, per: number): TemplateResult {
    const on = m.lights.filter((l) => l.on).length;
    const off = m.lights.filter((l) => l.on && l.spec && !l.forbidden);
    return html`<div class=${`sec${this.tab === 'lights' ? ' cur' : ''}`} data-tab="lights" data-room-lights>
      <h3>אורות · ${m.lights.length ? `${on} מתוך ${m.lights.length} דולקים` : 'אין אורות בחדר'}${off.length > 1
        ? html`<button type="button" class="act" data-room-all-off ?disabled=${m.stale} @click=${() => this.emit<RoomCardBulkDetail>('room-card-bulk', { label: 'כבה הכול', items: off.map((l) => ({ entityId: l.entityId, spec: l.spec! })) })}>כבה הכול</button>`
        : nothing}</h3>
      ${this.paged('lights', m.lights, per, (l) => html`<div class=${`r${l.on ? ' lit' : ''}${l.forbidden ? ' forbidden' : ''}`} data-room-light=${l.entityId}><sw-icon name="light" size=${18}></sw-icon><span class="l">${l.label}</span>
        ${l.forbidden ? html`<span class="no">אין הרשאה</span>` : html`<sw-toggle label=${l.label} labelHidden .checked=${live(!!l.on)} ?disabled=${!l.spec || l.on === null || m.stale || m.busy === l.entityId} @change=${() => l.spec && this.run(l.entityId, l.spec)}></sw-toggle>`}</div>`)}
    </div>`;
  }

  private renderClimate(m: RoomCardModel): TemplateResult | typeof nothing {
    const c = m.climate;
    if (!c) return html`<div class=${`sec${this.tab === 'climate' ? ' cur' : ''}`} data-tab="climate"><h3>אקלים</h3><div class="empty">אין חיישן טמפרטורה בחדר</div></div>`;
    const set = (d: number) => c.spec && c.entityId && c.target !== null && this.run(c.entityId, c.spec, { temperature: Math.min(c.max, Math.max(c.min, Math.round((c.target + d * c.step) * 10) / 10)) });
    return html`<div class=${`sec${this.tab === 'climate' ? ' cur' : ''}`} data-tab="climate" data-room-climate>
      <h3>אקלים</h3>
      <div class="climate"><span class="now num">${c.now !== null ? tempText(c.now) : '—'}<small>${c.target === null ? 'עכשיו · חיישן בלבד' : `עכשיו${c.words ? ` · ${c.words}` : ''}`}</small></span>
        ${c.target !== null
          ? html`<span class="step"><button type="button" aria-label="הורד" ?disabled=${!c.spec || m.stale || m.busy === c.entityId} @click=${() => set(-1)}><sw-icon name="minus" size=${16}></sw-icon></button><b class="num" aria-label="יעד">${tempText(c.target)}</b><button type="button" aria-label="העלה" ?disabled=${!c.spec || m.stale || m.busy === c.entityId} @click=${() => set(1)}><sw-icon name="plus" size=${16}></sw-icon></button></span>`
          : nothing}</div>
    </div>`;
  }

  private renderOpenings(m: RoomCardModel, per: number): TemplateResult {
    return html`<div class=${`sec${this.tab === 'opens' ? ' cur' : ''}`} data-tab="opens" data-room-openings>
      <h3>דלתות, חלונות ותריסים</h3>
      ${m.openings.length
        ? this.paged('opens', m.openings, per, (o) => html`<div class=${`r${o.open ? ' open' : ''}${o.forbidden ? ' forbidden' : ''}`} data-room-opening=${o.entityId}><sw-icon name=${o.icon} size=${18}></sw-icon><span class="l">${o.label}</span><span class="st">${o.forbidden ? 'אין הרשאה' : o.words}</span>
            ${o.spec && !o.forbidden ? html`<button type="button" class=${`do${o.spec.sensitive ? ' sens' : ''}`} data-room-opening-action=${o.spec.id} ?disabled=${m.stale || m.busy === o.entityId} @click=${() => this.run(o.entityId, o.spec!)}>${o.spec.label}</button>` : nothing}</div>`)
        : html`<div class="empty">אין דלתות או חלונות עם חיישן בחדר</div>`}
    </div>`;
  }

  render() {
    const m = this.model;
    if (!m) return nothing;
    const sheet = this.place === 'sheet';
    const per = sheet ? ROWS_SHEET : this.rows;
    const on = m.lights.filter((l) => l.on).length;
    return html`
      <button type="button" class="grab" aria-label=${this.sheet === 'full' ? 'הקטן את הכרטיס' : 'הגדל את הכרטיס'} @click=${() => (this.sheet = this.sheet === 'full' ? 'peek' : 'full')}></button>
      <header>
        <div>
          <h2>${m.name || 'חדר'}</h2>
          <div class="sub">${m.levelName}</div>
          <div class="tags">
            ${m.presence ? html`<span class="tag pres"><sw-icon name="user" size=${13}></sw-icon>נוכחות עכשיו</span>` : m.quietMin !== null ? html`<span class="tag">אין תנועה ${m.quietMin} דק׳</span>` : nothing}
            ${m.open ? html`<span class="tag open">${m.open === 1 ? 'פתוח 1' : `${m.open} פתוחים`}</span>` : nothing}
          </div>
        </div>
        <button type="button" class="x" aria-label="סגור" data-room-close @click=${() => this.emit('room-card-close', {})}><sw-icon name="close" size=${18}></sw-icon></button>
      </header>
      <div class="quick">
        <button type="button" class=${on ? 'on' : ''} @click=${() => this.openTab('lights')}><sw-icon name="light" size=${18}></sw-icon>אורות <span class="num">${on}/${m.lights.length}</span></button>
        <button type="button" @click=${() => this.openTab('climate')}><sw-icon name="thermometer" size=${18}></sw-icon><span class="num">${m.climate?.now != null ? tempText(m.climate.now) : '—'}</span></button>
        <button type="button" class=${m.open ? 'al' : ''} @click=${() => this.openTab('opens')}><sw-icon name="door" size=${18}></sw-icon>${m.open ? (m.open === 1 ? 'פתוח 1' : `${m.open} פתוחים`) : 'סגור'}</button>
        <button type="button" ?disabled=${!m.cameras.length || this.camera === 'none'} @click=${() => this.openTab('cam')}><sw-icon name="camera" size=${18}></sw-icon>מצלמה</button>
      </div>
      <div class="tabs" role="tablist">${([['lights', 'אורות'], ['climate', 'אקלים'], ['opens', 'פתחים'], ['cam', 'מצלמה']] as const).map(([k, t]) => html`<button type="button" role="tab" aria-pressed=${this.tab === k ? 'true' : 'false'} @click=${() => (this.tab = k)}>${t}</button>`)}</div>
      <div class="body">
        ${sheet ? html`<div data-tab="cam" class=${this.tab === 'cam' ? 'cur' : ''}>${this.renderCamera(m)}</div>` : this.renderCamera(m)}
        ${this.renderLights(m, sheet ? per + 1 : per)}
        ${this.renderClimate(m)}
        ${this.renderOpenings(m, sheet ? per : Math.max(2, per - 1))}
      </div>
      <footer>
        ${m.areaHref ? html`<a class="pri" href=${m.areaHref} data-room-open-area>לעמוד החדר</a>` : nothing}
        <button type="button" data-room-recordings ?disabled=${!m.cameras.length} @click=${() => m.cameras[0] && this.emit('room-card-recordings', { id: m.cameras[0].id })}><sw-icon name="history" size=${16}></sw-icon>הקלטות</button>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-room-card': SwRoomCard;
  }
}
