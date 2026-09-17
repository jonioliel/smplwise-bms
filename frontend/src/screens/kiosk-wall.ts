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

/** Saved view = the URL: #/kiosk/all?cameras=a,b,c&cols=3&rows=2&rotate=30 (seconds per page; 0 = no rotation).
 * Default 3×2: with nine sub streams at once the lab NVR / relay let the last tiles stall (live review F15). */
const LAYOUT_KEY = 'sw.kiosk.layout';
const LAYOUTS = [[2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [5, 4], [6, 4]] as const;

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
  @state() private cams: Camera[] | null = null;
  @state() private settings: ProductSettings | null = null;
  @state() private clock = '';
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

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
      background: #0f172a;
      color: #fff;
      padding: 14px 20px 16px;
      gap: 12px;
    }
    header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    header img {
      block-size: 24px;
      inline-size: auto;
      filter: brightness(0) invert(1);
      opacity: 0.9;
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-semibold);
    }
    .spacer {
      flex: 1;
    }
    .clock {
      font-size: var(--sw-fs-sm);
      color: rgba(255, 255, 255, 0.75);
      font-variant-numeric: tabular-nums;
      direction: ltr;
    }
    .overlay {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(15, 23, 42, 0.86);
      color: #fff;
      font-size: var(--sw-fs-xl);
      z-index: 50;
      text-align: center;
      line-height: 1.6;
    }
    .pill {
      font-size: var(--sw-fs-xs);
      padding: 3px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.85);
    }
    .pill[data-status='warn'] {
      background: rgba(245, 158, 11, 0.25);
    }
    .pill[data-status='error'] {
      background: rgba(239, 68, 68, 0.3);
    }
    header select.layout {
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      padding: 3px 8px;
      font: inherit;
      font-size: 12px;
    }
    .grid {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr));
      gap: 10px;
    }
    .grid sw-camera-tile {
      border-radius: 8px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .stat {
      background: #172036;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stat .ic {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: 8px;
      background: rgba(47, 107, 255, 0.22);
      color: #8fb0ff;
    }
    .stat .ic.red {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
    }
    .stat .ic.green {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }
    .stat b {
      display: block;
      font-size: var(--sw-fs-2xl);
      line-height: 1.1;
    }
    .stat span {
      color: rgba(255, 255, 255, 0.6);
      font-size: var(--sw-fs-xs);
    }
    .note {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
    }
    @media (max-width: 767px) {
      .grid,
      .stats {
        grid-template-columns: repeat(2, 1fr);
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
    const all = (this.cams ?? []).filter((c) => this.view.cameras.length === 0 || this.view.cameras.includes(c.id));
    return this.view.cameras.length ? this.view.cameras.map((id) => all.find((c) => c.id === id)).filter((c): c is Camera => !!c) : all;
  }

  private get pages() {
    return Math.max(1, Math.ceil(this.selected.length / this.pageSize));
  }

  private tick() {
    const d = new Date();
    this.clock = `${d.toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('he-IL')}`;
  }

  private async load() {
    if (!isApi()) return;
    try {
      const [list, settings] = await Promise.all([listCameras(), productSettings()]);
      this.cams = list.cameras.filter((c) => c.enabled);
      this.settings = settings;
      this.view = viewParams(defaultLayout(settings));
    } catch {
      this.cams = [];
    }
  }

  render() {
    const base = import.meta.env.BASE_URL;
    const api = isApi();
    const pageIndex = this.page % this.pages;
    const real = api ? this.selected.slice(pageIndex * this.pageSize, (pageIndex + 1) * this.pageSize) : [];
    const demo = demoWall.filter((c) => c.state !== 'forbidden').slice(0, 9);
    const online = api ? real.filter((c) => c.status === 'online').length : 7;
    const cap = this.settings?.['media.max_live_sessions'] ?? 8;
    return html`
      <header>
        <img src="${base}brand/smplwise-mark.png" alt="SmplWise" />
        <h1>ניטור חי</h1>
        <span class="spacer"></span>
        <sw-badge kind="live" label=${`${api ? this.selected.length : demo.length} מצלמות · ${online} חיות`}></sw-badge>
        ${api && this.pages > 1 ? html`<span class="pill" data-kiosk-page>עמוד ${pageIndex + 1}/${this.pages}${this.view.rotate ? ` · כל ${this.view.rotate} שנ׳` : ''}</span>` : nothing}
        ${api ? html`<select class="layout" data-kiosk-layout aria-label="פריסה" @change=${(e: Event) => this.setLayout((e.target as HTMLSelectElement).value)}>
          ${LAYOUTS.map(([c, r]) => html`<option value=${`${c}x${r}`} ?selected=${c === this.view.cols && r === this.view.rows}>${c}×${r} · ${c * r} מצלמות בעמוד</option>`)}
        </select>` : nothing}
        ${api && this.health ? html`<span class="pill" data-kiosk-health data-status=${this.health.status}>מערכת: ${STATUS_LABEL[this.health.status]}${this.health.items.filter((i) => i.status !== 'ok').length ? ` · ${this.health.items.filter((i) => i.status !== 'ok').map((i) => i.label).join(', ')}` : ''}</span>` : nothing}
        <span class="clock">${this.clock || '—'}</span>
      </header>
      ${this.disconnected ? html`<div class="overlay" data-kiosk-disconnected>אין קשר לשרת ה־VMS<br /><small>הזרמים אינם חיים · מנסה להתחבר מחדש</small></div>` : nothing}
      <div class="grid" style=${`--cols:${api ? this.view.cols : 3}`}>
        ${api
          ? real.map((c, i) => html`<sw-camera-tile dark data-kiosk-tile name=${c.name} state=${this.disconnected ? 'unknown' : c.status === 'online' ? 'live' : c.status === 'offline' ? 'offline' : 'unknown'} ?live=${!this.disconnected && c.status !== 'offline' && i < cap && i < this.started} cameraId=${c.id} profile="sub" transport=${effectiveTransport(this.settings)} poster=${c.status === 'offline' ? '' : snapshotUrl(c.id)} noDemo></sw-camera-tile>`)
          : demo.map((c) => html`<sw-camera-tile dark name=${c.name} state=${c.state} scene=${demoScene[c.id] ?? 'lobby'} noDemo></sw-camera-tile>`)}
      </div>
      <div class="stats">
        <div class="stat"><div class="ic"><sw-icon name="camera" size=${16}></sw-icon></div><div><b>${api ? `${online}/${real.length}` : '7/9'}</b><span>מצלמות מחוברות</span></div></div>
        <div class="stat"><div class="ic red"><sw-icon name="warning" size=${16}></sw-icon></div><div><b>${api ? real.filter((c) => c.status === 'offline').length : 3}</b><span>${api ? 'מצלמות מנותקות' : 'התראות פתוחות'}</span></div></div>
        <div class="stat"><div class="ic"><sw-icon name="building" size=${16}></sw-icon></div><div><b>${api ? Math.min(real.length, cap) : 2}</b><span>${api ? 'זרמים חיים במקביל' : 'מבנים'}</span></div></div>
        <div class="stat"><div class="ic green"><sw-icon name="check" size=${16}></sw-icon></div><div><b style="font-size:var(--sw-fs-lg)">${api ? 'פעיל' : 'חלקי'}</b><span>${api ? 'go2rtc + NVR' : 'מצב מערכת · גשר HA לא רענן'}</span></div></div>
      </div>
      <div class="note">תצוגת קיוסק: קריאה בלבד, ללא פקדי ניהול, חיבור מחדש אוטומטי · תצוגה שמורה = הכתובת (cameras, cols, rotate)${api ? '' : ' · נתוני הדגמה (סצנות מאוירות עד חיבור הזרמים)'}</div>
    `;
  }
}
