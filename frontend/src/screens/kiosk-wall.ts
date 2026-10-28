import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/sw-icon';
import { demoScene, demoWall } from '../fixtures/catalog';
import { isApi, onSession } from '../api/session';
import { snapshotUrl, type ProductSettings } from '../api/media';
import { listCameras } from '../api/maps';
import { effectiveTransport, productSettings } from '../api/prefs';
import { healthSummary, STATUS_LABEL, type HealthSummary } from '../api/health';
import { parseRoute } from '../router';
import type { Camera } from '../api/types';
import { PhoneWidth, isPhoneWidth } from '../shell/phone';
import { isOnWall } from './wall-arrangement';
import { timeText } from '../api/day-format';
import '../components/sw-brand';

/** Saved view = the URL: #/kiosk/all?cameras=a,b,c&cols=3&rows=2&rotate=30 (seconds per page; 0 = no rotation).
 * Default 3×2: with nine sub streams at once the lab NVR / relay let the last tiles stall (live review F15). */
const LAYOUT_KEY = 'sw.kiosk.layout';
const LAYOUTS = [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [5, 4], [6, 4]] as const;
/** The choices on a phone (mobile audit 2026-09-30): a single column at the tile's own 16:9 height is the natural phone view. */
const PHONE_LAYOUTS = [[1, 1], [1, 2], [1, 3], [1, 4], [2, 2], [2, 3]] as const;
/** What a phone opens with when this browser has not chosen a layout and the address carries none: one column, three tiles
 * a page. The installation's default (ui.kiosk_cols x ui.kiosk_rows) is for a wall display, not for a phone. */
const PHONE_DEFAULT = { cols: 1, rows: 3 };
/** Idle minutes before the header and the counters recede (the video never dims). */
const IDLE_DIM_MS = 10 * 60_000;

/** cols x rows for a kiosk page: the URL wins, then this browser's last pick, then the owner's default (0.1.61). */
function defaultLayout(settings?: { 'ui.kiosk_cols'?: number | string; 'ui.kiosk_rows'?: number | string } | null): { cols: number; rows: number } {
  try {
    const s = localStorage.getItem(LAYOUT_KEY);
    if (s) {
      const [c, r] = s.split('x').map(Number);
      if (c >= 1 && r >= 1) return { cols: c, rows: r };
    }
  } catch {
    /* private mode */
  }
  if (isPhoneWidth()) return { ...PHONE_DEFAULT };
  const c = Number(settings?.['ui.kiosk_cols'] ?? 0);
  const r = Number(settings?.['ui.kiosk_rows'] ?? 0);
  return { cols: c >= 1 ? c : 3, rows: r >= 1 ? r : 2 };
}

function viewParams(def = defaultLayout()) {
  const p = parseRoute().params;
  const cols = Math.min(6, Math.max(1, Number(p.get('cols') ?? def.cols) || def.cols));
  const rows = Math.min(5, Math.max(1, Number(p.get('rows') ?? def.rows) || def.rows));
  return { cameras: (p.get('cameras') ?? '').split(',').map((s) => s.trim()).filter(Boolean), cols, rows, rotate: Math.max(0, Number(p.get('rotate') ?? 0) || 0) };
}

/** SC31 — wall display / kiosk (board 3 screen 24): dark navy, 3×3 tiles (real sub streams when a backend exists), big stat tiles, no admin controls. */
@customElement('kiosk-wall')
export class KioskWall extends LitElement {
  private readonly phone = new PhoneWidth(this);
  @state() private cams: Camera[] | null = null;
  @state() private settings: ProductSettings | null = null;
  @state() private clock = { time: '', date: '' };
  /** The last touch / click on the screen: after IDLE_DIM_MS the chrome recedes (data-idle), never the video. */
  private touchedAt = Date.now();
  private readonly onTouch = () => {
    this.touchedAt = Date.now();
    this.removeAttribute('data-idle');
  };
  @state() private page = 0; // restored per view in connectedCallback / onHash (T057)
  @state() private health: HealthSummary | null = null;
  @state() private disconnected = false;
  @state() private view = viewParams();
  private timer: number | undefined;
  private rotateTimer: number | undefined;
  private healthTimer: number | undefined;
  private failures = 0;
  private unsubscribe: (() => void) | undefined;
  private onHash = () => {
    this.view = viewParams();
    this.page = this.restorePage();
    this.startRotation();
  };

  /** The page shown for this exact view (cameras + layout), kept in the browser so a reload, a power cycle or a
   * reconnect brings the wall back to the same page (T057). */
  /** The picker writes the layout into the URL (a kiosk view is its URL) and remembers it for this browser. */
  private setLayout(v: string) {
    const [c, r] = v.split('x').map(Number);
    if (!(c >= 1 && r >= 1)) return;
    try {
      localStorage.setItem(LAYOUT_KEY, `${c}x${r}`);
    } catch {
      /* private mode */
    }
    const p = new URLSearchParams(parseRoute().params);
    p.set('cols', String(c));
    p.set('rows', String(r));
    window.location.replace(`#/kiosk/all?${p.toString()}`);
  }

  private get pageKey(): string {
    return `sw.kiosk.page:${this.view.cameras.join(',')}|${this.view.cols}x${this.view.rows}`;
  }

  private restorePage(): number {
    try {
      const n = Number(localStorage.getItem(this.pageKey) ?? '0');
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  private setPage(n: number) {
    this.page = n;
    try {
      localStorage.setItem(this.pageKey, String(n % Math.max(1, this.pages)));
    } catch {
      /* private mode */
    }
  }

  /**
   * KIOSK polish (2026-10-11): the route is read from across a room, so the clock is the largest text (3xl, tabular) with the
   * date under it, the counters are one tier up, every control is a 44 px target at every size, and the page keeps clear of the
   * device's safe areas on every side. Colours are the product's on-video family and state tokens with `color-mix` washes - the
   * kiosk is dark in both schemes (video is), and nothing on it is a literal any more. After ten idle minutes the chrome (header,
   * counters) recedes to 70 % - the video itself never dims - and a touch brings it back; the tiles fade in when they appear.
   * Nothing on the screen explains itself (clean operator screens): the former footnote is gone.
   */
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      background: var(--sw-video-bg);
      color: var(--sw-on-video);
      padding-block: max(14px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-bottom, 0px));
      padding-inline: max(20px, env(safe-area-inset-right, 0px)) max(20px, env(safe-area-inset-left, 0px));
      gap: 12px;
      --k-wash: var(--sw-video-hover);
      --k-line: var(--sw-video-line);
    }
    header,
    .stats {
      transition: opacity 3s ease;
    }
    :host([data-idle]) header,
    :host([data-idle]) .stats {
      opacity: 0.7;
    }
    header {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 48px;
    }
    header sw-brand[kind='product'] {
      opacity: 0.9; /* NOTICEPUSH-295: the approved mockup mark (sw-brand draws it inline, 24 px), as before the mint PNG it replaces */
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
    }
    .spacer {
      flex: 1;
    }
    .clock {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      direction: ltr;
    }
    .clock b {
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: 0.02em;
    }
    .clock span {
      font-size: var(--sw-fs-sm);
      color: var(--sw-on-video-2);
      direction: rtl;
    }
    .overlay {
      position: fixed;
      inset: 0;
      display: grid;
      place-content: center;
      gap: 8px;
      background: var(--sw-video-scrim-strong);
      color: var(--sw-on-video);
      z-index: var(--sw-z-modal);
      text-align: center;
      animation: k-in 0.6s var(--sw-ease) both;
    }
    .overlay b {
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
    }
    .overlay span {
      font-size: var(--sw-fs-lg);
      color: var(--sw-on-video-2);
    }
    .overlay .mark {
      inline-size: 56px;
      block-size: 56px;
      margin: 0 auto 8px;
      display: grid;
      place-content: center;
      border-radius: 50%;
      background: color-mix(in srgb, var(--sw-danger) 24%, transparent);
      color: var(--sw-danger);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 36px;
      padding: 0 14px;
      border-radius: var(--sw-r-pill);
      background: var(--k-wash);
      color: var(--sw-on-video);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      animation: k-rise 0.4s var(--sw-ease) both;
    }
    .pill::before {
      content: '';
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-live);
      flex: none;
    }
    .pill[data-status='warn'] {
      background: color-mix(in srgb, var(--sw-warning) 24%, transparent);
    }
    .pill[data-status='warn']::before {
      background: var(--sw-warning);
    }
    .pill[data-status='error'] {
      background: color-mix(in srgb, var(--sw-danger) 28%, transparent);
    }
    .pill[data-status='error']::before {
      background: var(--sw-danger);
      animation: k-breathe 2.4s ease-in-out infinite;
    }
    .pill[data-kiosk-page]::before {
      display: none;
    }
    header select.layout {
      min-block-size: 44px;
      background: var(--k-wash);
      color: var(--sw-on-video);
      border: 1px solid var(--k-line);
      border-radius: var(--sw-r-md);
      padding: 0 12px;
      font: inherit;
      font-size: var(--sw-fs-md);
      cursor: pointer;
    }
    header select.layout option {
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    header a.exit {
      display: inline-flex;
      align-items: center;
      min-block-size: 44px;
      min-inline-size: 44px;
      padding-inline: 16px;
      color: var(--sw-on-video);
      text-decoration: none;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      border: 1px solid var(--k-line);
      border-radius: var(--sw-r-md);
      transition: background-color var(--sw-t-fast) ease;
    }
    header a.exit:hover {
      background: var(--k-wash);
    }
    .grid {
      flex: 1;
      min-block-size: 0;
      display: grid;
      grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr));
      grid-auto-rows: minmax(0, 1fr);
      gap: 10px;
    }
    /* a cell centres its 16:9 picture (container units): a page of three rows fits the tablet's height with the counters under
       it instead of pushing them off the screen; where the units are missing the picture fills the cell's width as before */
    .cell {
      display: grid;
      place-items: center;
      min-block-size: 0;
      min-inline-size: 0;
      container-type: size;
    }
    .grid sw-camera-tile {
      inline-size: 100%;
      inline-size: min(100%, calc(100cqh * 16 / 9));
      border-radius: var(--sw-r-md);
      animation: k-in 0.6s var(--sw-ease) both;
    }
    /* a portrait tablet cannot fill its height with 16:9 pictures: the rows pack from the top and the counters follow them */
    @media (orientation: portrait) and (min-width: 768px) {
      .grid {
        flex: none;
        align-content: start;
        grid-auto-rows: max-content;
      }
      .cell {
        container-type: normal;
      }
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .stat {
      background: var(--k-wash);
      border: 1px solid var(--k-line);
      border-radius: var(--sw-r-lg);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      min-inline-size: 0;
    }
    .stat .ic {
      display: grid;
      place-items: center;
      flex: none;
      inline-size: 40px;
      block-size: 40px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--sw-recorded) 24%, transparent);
      color: var(--sw-recorded);
    }
    .stat .ic.red {
      background: color-mix(in srgb, var(--sw-danger) 22%, transparent);
      color: var(--sw-danger);
    }
    .stat .ic.green {
      background: color-mix(in srgb, var(--sw-live) 22%, transparent);
      color: var(--sw-live);
    }
    .stat > div:last-child {
      min-inline-size: 0;
    }
    .stat b {
      display: block;
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .stat b[data-word] {
      font-size: var(--sw-fs-xl);
    }
    .stat span {
      display: block;
      color: var(--sw-on-video-2);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @keyframes k-in {
      from {
        opacity: 0;
      }
    }
    @keyframes k-rise {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
    }
    @keyframes k-breathe {
      50% {
        opacity: 0.45;
      }
    }
    /* the reference tablets (820 x 1280, 1280 x 800): the counters stay four across in landscape and become two rows in portrait */
    @media (max-width: 1023px) {
      .stats {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    /* the phone (mobile audit 2026-09-30): the header wraps instead of running off the screen, the tiles keep their own 16:9
       height and pack from the top (no dead space between rows), the summary tiles become one scrolling row, the targets
       are 44 px and the page keeps clear of the device's safe areas */
    @media (max-width: 767px) {
      :host {
        padding-block: max(10px, env(safe-area-inset-top, 0px)) max(14px, env(safe-area-inset-bottom, 0px));
        padding-inline: max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-left, 0px));
        gap: 10px;
      }
      header {
        flex-wrap: wrap;
        row-gap: 8px;
      }
      h1 {
        font-size: var(--sw-fs-xl);
      }
      header select.layout {
        flex: 1 1 150px;
        min-inline-size: 0;
      }
      .clock {
        order: 10;
        flex: 1 1 100%;
        flex-direction: row;
        justify-content: center;
        gap: 10px;
        align-items: baseline;
      }
      .clock b {
        font-size: var(--sw-fs-2xl);
      }
      .grid {
        flex: none;
        align-content: start;
        grid-auto-rows: max-content;
      }
      .cell {
        container-type: normal;
      }
      .stats {
        display: flex;
        overflow-x: auto;
        gap: 8px;
        scrollbar-width: none;
        padding-block-end: 2px;
      }
      .stat {
        flex: 0 0 auto;
        min-inline-size: 150px;
        padding: 8px 12px;
        gap: 10px;
      }
      .stat .ic {
        inline-size: 32px;
        block-size: 32px;
      }
      .stat b {
        font-size: var(--sw-fs-xl);
      }
      .stat b[data-word] {
        font-size: var(--sw-fs-lg);
      }
    }
    /* R5-LIVE-297 (the HOMEFABLE type scale on the wall display, read from across the room): the title 800, the clock a 32 px / 800
       display numeral, the counters 34 px / 800 tight over a 14 px label; a counter that needs someone (open alerts) is a filled danger
       field, a healthy one keeps the quiet wash; the exit is a key that tints on hover only under a fine pointer and sinks on press */
    h1 {
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .clock b {
      font-size: var(--sw-fs-4xl);
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .stat {
      padding: 14px 18px;
      border-color: transparent;
    }
    .stat:has(.ic.red) {
      background: color-mix(in srgb, var(--sw-danger) 26%, var(--sw-video-bg));
    }
    .stat .ic {
      inline-size: 44px;
      block-size: 44px;
    }
    .stat .ic.red {
      background: var(--sw-danger);
      color: var(--sw-text-inverse);
    }
    .stat b {
      font-size: var(--sw-fs-4xl); /* the kiosk's display numeral, read at three metres */
      font-weight: 800;
      letter-spacing: -0.03em;
    }
    .stat b[data-word] {
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
    }
    .stat span {
      font-size: var(--sw-fs-md);
    }
    header a.exit {
      font-weight: var(--sw-fw-semibold);
      background: var(--k-wash);
      -webkit-tap-highlight-color: transparent;
      transition: background-color var(--sw-t-fast) ease, transform var(--sw-t-press) var(--sw-ease-out);
    }
    header a.exit:hover {
      background: var(--k-wash);
    }
    @media (hover: hover) and (pointer: fine) {
      header a.exit:hover {
        background: color-mix(in srgb, var(--sw-on-video) 16%, transparent);
      }
    }
    header a.exit:active {
      transform: scale(var(--sw-press-scale, 0.96));
    }
    @media (max-width: 767px) {
      .stat {
        padding: 8px 12px;
      }
      .stat .ic {
        inline-size: 34px;
        block-size: 34px;
      }
      .stat b {
        font-size: var(--sw-fs-2xl);
      }
      .stat b[data-word] {
        font-size: var(--sw-fs-lg);
      }
      .clock b {
        font-size: var(--sw-fs-2xl);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      * {
        animation: none !important;
        transition: none !important;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.page = this.restorePage();
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 1000);
    // The kiosk renders outside the session gate, so wait for the backend answer instead of assuming demo.
    this.unsubscribe = onSession((s) => {
      if (s.mode === 'api' && this.cams === null) void this.load();
      else if (s.mode !== 'loading') this.requestUpdate();
    });
    window.addEventListener('hashchange', this.onHash);
    this.addEventListener('pointerdown', this.onTouch);
    this.startRotation();
    void this.pollHealth();
    this.healthTimer = window.setInterval(() => void this.pollHealth(), 15000);
  }

  disconnectedCallback() {
    window.clearTimeout(this.staggerTimer);
    super.disconnectedCallback();
    window.clearInterval(this.timer);
    window.clearInterval(this.rotateTimer);
    window.clearInterval(this.healthTimer);
    window.removeEventListener('hashchange', this.onHash);
    this.removeEventListener('pointerdown', this.onTouch);
    this.unsubscribe?.();
  }

  private startRotation() {
    window.clearInterval(this.rotateTimer);
    if (this.view.rotate > 0) this.rotateTimer = window.setInterval(() => { this.setPage(this.page + 1); this.stagger(); }, this.view.rotate * 1000);
    this.stagger();
  }

  /** The wall never shows a dead feed as live: three failed health polls dim the wall; the first success reloads it. */
  private async pollHealth() {
    if (!isApi()) return;
    try {
      this.health = await healthSummary();
      if (this.disconnected || this.failures >= 3) void this.load();
      this.failures = 0;
      this.disconnected = false;
    } catch {
      this.failures += 1;
      if (this.failures >= 3) this.disconnected = true;
    }
  }

  /** The layout choices: the phone's own list on a phone; the layout in force is always one of them (an address may carry another). */
  private layoutChoices(): readonly (readonly [number, number])[] {
    const base: readonly (readonly [number, number])[] = this.phone.matches ? PHONE_LAYOUTS : LAYOUTS;
    return base.some(([c, r]) => c === this.view.cols && r === this.view.rows) ? base : [[this.view.cols, this.view.rows], ...base];
  }

  private get pageSize() {
    return this.view.cols * this.view.rows;
  }

  /** Streams start one after another (~400 ms apart) so the relay is not hit by a page of requests at once. */
  @state() private started = 0;
  private staggerTimer = 0;

  private stagger() {
    window.clearTimeout(this.staggerTimer);
    this.started = 0;
    const step = () => {
      if (this.started < this.pageSize) {
        this.started += 1;
        this.staggerTimer = window.setTimeout(step, 400);
      }
    };
    step();
  }

  private get selected(): Camera[] {
    // the address's own camera list (a saved view, a map selection) is an explicit choice and shows a camera hidden in the wall
    // ("לא להציג" in סידור הקיר); "all" follows the wall arrangement and leaves those out
    const all = (this.cams ?? []).filter((c) => (this.view.cameras.length === 0 ? isOnWall(c) : this.view.cameras.includes(c.id)));
    return this.view.cameras.length ? this.view.cameras.map((id) => all.find((c) => c.id === id)).filter((c): c is Camera => !!c) : all;
  }

  private get pages() {
    return Math.max(1, Math.ceil(this.selected.length / this.pageSize));
  }

  private tick() {
    const d = new Date();
    this.clock = {
      time: timeText(d),
      date: d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }),
    };
    if (Date.now() - this.touchedAt >= IDLE_DIM_MS) this.setAttribute('data-idle', '');
  }

  private async load() {
    if (!isApi()) return;
    try {
      const [list, settings] = await Promise.all([listCameras(), productSettings()]);
      this.cams = list.cameras.filter((c) => c.enabled && c.recorder_enabled !== false); // CR-024: a disabled recorder leaves the kiosk wall too
      this.settings = settings;
      this.view = viewParams(defaultLayout(settings));
    } catch {
      this.cams = [];
    }
  }

  render() {
    const api = isApi();
    const pageIndex = this.page % this.pages;
    const real = api ? this.selected.slice(pageIndex * this.pageSize, (pageIndex + 1) * this.pageSize) : [];
    const demo = demoWall.filter((c) => c.state !== 'forbidden').slice(0, 9);
    const online = api ? real.filter((c) => c.status === 'online').length : 7;
    const cap = this.settings?.['media.max_live_sessions'] ?? 16;
    return html`
      <header>
        <sw-brand kind="product" scheme="dark" .h=${24} data-kiosk-product-logo></sw-brand>
        <h1>ניטור חי</h1>
        <sw-brand kind="company" scheme="dark" .h=${24} .maxw=${120} data-kiosk-company-logo></sw-brand>
        <span class="spacer"></span>
        <sw-badge kind="live" label=${`${api ? this.selected.length : demo.length} מצלמות · ${online} חיות`}></sw-badge>
        ${api && this.pages > 1 ? html`<span class="pill" data-kiosk-page>עמוד ${pageIndex + 1}/${this.pages}${this.view.rotate ? ` · כל ${this.view.rotate} שנ׳` : ''}</span>` : nothing}
        ${api ? html`<select class="layout" data-kiosk-layout aria-label="פריסה" @change=${(e: Event) => this.setLayout((e.target as HTMLSelectElement).value)}>
          ${this.layoutChoices().map(([c, r]) => html`<option value=${`${c}x${r}`} ?selected=${c === this.view.cols && r === this.view.rows}>${c}×${r} · ${c * r} מצלמות בעמוד</option>`)}
        </select>` : nothing}
        ${api && this.health ? html`<span class="pill" data-kiosk-health data-status=${this.health.status}>מערכת: ${STATUS_LABEL[this.health.status]}${this.health.items.filter((i) => i.status !== 'ok').length ? ` · ${this.health.items.filter((i) => i.status !== 'ok').map((i) => i.label).join(', ')}` : ''}</span>` : nothing}
        <span class="clock" data-kiosk-clock><b>${this.clock.time || '—'}</b><span>${this.clock.date}</span></span>
        <a class="exit" href="#/live/wall" data-kiosk-exit title="חזרה למערכת (משתמש קיוסק בלבד נשאר כאן)">יציאה</a>
      </header>
      ${this.disconnected ? html`<div class="overlay" data-kiosk-disconnected><span class="mark"><sw-icon name="warning" size=${28}></sw-icon></span><b>אין קשר לשרת Arx</b><span>הזרמים אינם חיים · מנסה להתחבר מחדש</span></div>` : nothing}
      <div class="grid" style=${`--cols:${api ? this.view.cols : 3}`}>
        ${api
          ? real.map((c, i) => html`<div class="cell"><sw-camera-tile dark data-kiosk-tile name=${c.name} state=${this.disconnected ? 'unknown' : c.status === 'online' ? 'live' : c.status === 'offline' ? 'offline' : 'unknown'} ?live=${!this.disconnected && c.status !== 'offline' && c.live_kind !== 'still' && i < cap && i < this.started} .stillRefresh=${c.live_kind === 'still' && c.status !== 'offline' ? c.still_refresh_s ?? 10 : 0} cameraId=${c.id} profile="sub" transport=${effectiveTransport(this.settings)} poster=${c.status === 'offline' ? '' : snapshotUrl(c.id)} noDemo></sw-camera-tile></div>`)
          : demo.map((c) => html`<div class="cell"><sw-camera-tile dark name=${c.name} state=${c.state} scene=${demoScene[c.id] ?? 'lobby'} noDemo></sw-camera-tile></div>`)}
      </div>
      <div class="stats">
        <div class="stat"><div class="ic"><sw-icon name="camera" size=${16}></sw-icon></div><div><b>${api ? `${online}/${real.length}` : '7/9'}</b><span>מצלמות מחוברות</span></div></div>
        <div class="stat"><div class="ic red"><sw-icon name="warning" size=${16}></sw-icon></div><div><b>${api ? real.filter((c) => c.status === 'offline').length : 3}</b><span>${api ? 'מצלמות מנותקות' : 'התראות פתוחות'}</span></div></div>
        <div class="stat"><div class="ic"><sw-icon name="building" size=${16}></sw-icon></div><div><b>${api ? Math.min(real.length, cap) : 2}</b><span>${api ? 'זרמים חיים במקביל' : 'מבנים'}</span></div></div>
        <div class="stat"><div class="ic green"><sw-icon name="check" size=${16}></sw-icon></div><div><b data-word>${api ? 'פעיל' : 'חלקי'}</b><span>${api ? 'go2rtc + NVR' : 'מצב מערכת · גשר לא רענן'}</span></div></div>
      </div>
    `;
  }
}
