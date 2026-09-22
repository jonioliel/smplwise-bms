import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-camera-tile';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { demoScene, demoWall } from '../fixtures/catalog';
import { navigate } from '../router';
import { isApi } from '../api/session';
import { snapshotUrl, type ProductSettings, type Transport } from '../api/media';
import { listCameras } from '../api/maps';
import { effectiveTransport, productSettings } from '../api/prefs';
import { describeError } from '../api/client';
import type { Camera } from '../api/types';

const COUNTS = [1, 2, 4, 6, 8, 9, 12, 16, 20, 25, 32];
const COUNT_KEY = 'sw.wall.count';
const VIEWS = [
  { id: 'all', label: 'כל המצלמות' },
  { id: 'outside', label: 'חוץ' },
  { id: 'inside', label: 'פנים' },
  { id: 'night', label: 'לילה' },
];

/** SC07 — multi-camera grid (board 1 screen 6): real streams (sub profile) with snapshot posters, or the demo grid. */
@customElement('live-wall')
export class LiveWall extends LitElement {
  /** Comma-separated camera ids chosen on a floor map (T043); empty = all cameras. */
  @property() cameras = '';
  @state() private count = 4;
  @state() private stream: 'auto' | 'main' | 'sub' = 'auto';
  @state() private view = 'all';
  @state() private cams: Camera[] | null = null;
  @state() private settings: ProductSettings | null = null;
  @state() private error = '';
  @state() private posterBust = Date.now();
  private posterTimer: number | undefined;

  static styles = css`
    .layouts {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: 8px;
      padding: 2px;
    }
    .layouts button {
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      min-inline-size: 28px;
      block-size: 26px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--sw-text-2);
      padding: 0 6px;
    }
    .layouts button.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    sw-field {
      inline-size: 140px;
    }
    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    }
    /* best fit (0.1.68): the tiles fill the screen as a rectangle - as many columns as make the tiles biggest */
    .colbtn {
      font: inherit;
      font-size: var(--sw-fs-xs);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      border-radius: 6px;
      padding: 2px 8px;
      cursor: pointer;
    }
    .colbtn.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
    }
    .grid.fit {
      grid-template-columns: repeat(var(--cols), var(--tile));
      justify-content: center;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    @media (max-width: 767px) {
      .grid {
        gap: 8px;
      }
      /* a safe default cap on phones so auto layout never crams tiny tiles - but an explicit column
         choice (owner round 4, 1.7) is a deliberate override and wins even here. */
      .grid:not([data-wall-cols-manual]) {
        grid-template-columns: repeat(min(var(--cols), 2), minmax(0, 1fr));
      }
    }
  `;

  /** Owner round 3 (2.5): columns chosen by hand for the wall (0 = best fit); kept per browser. */
  @state() private colsOverride = (() => { try { return Number(localStorage.getItem('sw.wall.cols') ?? 0) || 0; } catch { return 0; } })();

  private setCols(n: number) {
    this.colsOverride = n;
    try {
      localStorage.setItem('sw.wall.cols', String(n));
    } catch {
      /* private mode */
    }
  }

  /** The room the grid has: its width and the height left under it in the window (0 until measured). */
  @state() private box = { w: 0, h: 0 };
  private ro: ResizeObserver | undefined;

  private measure = () => {
    const g = this.renderRoot.querySelector<HTMLElement>('.grid');
    if (!g) return;
    const w = Math.round(g.clientWidth);
    const h = Math.round(window.innerHeight - g.getBoundingClientRect().top - 56);
    if (w !== this.box.w || h !== this.box.h) this.box = { w, h };
  };

  /** Columns and tile width that make the tiles biggest for n tiles (16:9) inside w × h; null when not measured. */
  private bestFit(n: number): { cols: number; tile: number } | null {
    const { w, h } = this.box;
    if (!w || h < 120 || n < 1) return null;
    const gap = 12;
    let best = { cols: 1, tile: 0 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const tile = Math.min((w - gap * (cols - 1)) / cols, ((h - gap * (rows - 1)) / rows) * (16 / 9));
      if (tile > best.tile) best = { cols, tile };
    }
    return best.tile > 80 ? { cols: best.cols, tile: Math.floor(best.tile) } : null;
  }

  firstUpdated() {
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this);
    window.addEventListener('resize', this.measure);
  }

  updated() {
    this.measure();
  }

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    this.posterTimer = window.setInterval(() => (this.posterBust = Date.now()), 60_000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.posterTimer);
    this.ro?.disconnect();
    window.removeEventListener('resize', this.measure);
  }

  /** The layout the wall opens with: this browser's last choice, else the owner's default (הגדרות › כללי). */
  private setCount(n: number) {
    this.count = n;
    try {
      localStorage.setItem(COUNT_KEY, String(n));
    } catch {
      /* private mode */
    }
  }

  private async load() {
    if (!isApi()) return;
    try {
      const [list, settings] = await Promise.all([listCameras(), productSettings()]);
      this.cams = list.cameras.filter((c) => c.enabled);
      this.settings = settings;
      let stored = 0;
      try {
        stored = Number(localStorage.getItem(COUNT_KEY) ?? 0);
      } catch {
        /* private mode */
      }
      const def = Number(settings['ui.wall_count'] ?? 0);
      const pick = COUNTS.includes(stored) ? stored : COUNTS.includes(def) ? def : 0;
      if (pick) this.count = pick;
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private renderApi() {
    const cams = this.cams;
    if (this.error) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel>`;
    if (!cams) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (!cams.length) return html`<sw-state-panel state="empty" heading="אין מצלמות זמינות" hint="המצלמות מתגלות אוטומטית מה־NVR בהפעלה ובכל 10 דקות. אם הרשימה ריקה: בדוק את פרטי ה־NVR בהגדרות ה־Add-on ואת יומן ה־Add-on, או הרץ סנכרון ידני; ייתכן גם שאין לך הרשאה למצלמות."><div style="margin-block-start:10px"><sw-button @click=${() => navigate('/system/devices')}>למצלמות</sw-button></div></sw-state-panel>`;
    const wanted = this.cameras ? this.cameras.split(',').filter(Boolean) : [];
    const pool = wanted.length ? cams.filter((c) => wanted.includes(c.id)) : cams;
    const n = wanted.length ? Math.max(1, pool.length) : this.count;
    const shown = pool.slice(0, n);
    // owner round 4 (1.7): "עמודות" only ever adjusted `bestFit`'s own column count, so on any screen narrower
    // than 768px - or before the grid's box was first measured - bestFit never ran and the buttons did nothing.
    // Columns are chosen first (override beats auto-fit beats the static ladder); fit only sizes the tiles after.
    const autoFit = window.innerWidth >= 768 ? this.bestFit(shown.length) : null;
    const cols = this.colsOverride ? Math.min(this.colsOverride, Math.max(1, shown.length)) : autoFit ? autoFit.cols : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : n <= 25 ? 5 : 6;
    let fit: { cols: number; tile: number } | null = autoFit && !this.colsOverride ? autoFit : null;
    if (this.box.w && (this.colsOverride || !fit)) {
      const rows = Math.ceil(shown.length / cols);
      const tile = Math.min((this.box.w - 12 * (cols - 1)) / cols, this.box.h > 120 ? ((this.box.h - 12 * (rows - 1)) / rows) * (16 / 9) : Infinity);
      if (tile > 80 && Number.isFinite(tile)) fit = { cols, tile: Math.floor(tile) };
    }
    const cap = this.settings?.['media.max_live_sessions'] ?? 8;
    const profile: 'sub' | 'main' = this.stream === 'auto' ? (this.settings?.['media.wall_profile'] ?? 'sub') : this.stream;
    const transport: Transport = effectiveTransport(this.settings);
    return html`
      <div class="grid ${fit ? 'fit' : ''}" style="--cols:${cols};--tile:${fit ? `${fit.tile}px` : 'auto'}" data-wall-cols=${cols} ?data-wall-cols-manual=${!!this.colsOverride}>
        ${shown.map(
          (c, i) => html`<sw-camera-tile
            name=${c.name}
            state=${c.status === 'online' ? 'live' : c.status === 'offline' ? 'offline' : 'unknown'}
            ?live=${c.status !== 'offline' && c.can_view_live !== false && i < cap}
            cameraId=${c.id}
            profile=${profile}
            transport=${transport}
            poster=${c.status === 'offline' ? '' : snapshotUrl(c.id, this.posterBust)}
            ?compact=${n >= 9}
            @click=${() => navigate(`/live/cameras/${c.id}`)}></sw-camera-tile>`,
        )}
      </div>
      ${wanted.length ? html`<div class="note" data-wall-picked>מפה: ${shown.length} מצלמות שנבחרו${shown.length < wanted.length ? ` (${wanted.length - shown.length} לא זמינות)` : ''} · <a href="#/live/wall">כל המצלמות</a></div>` : nothing}
      <div class="note" data-wall-cols-row style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">עמודות:
        ${[0, 1, 2, 3, 4, 5, 6].map((n) => html`<button class="colbtn ${this.colsOverride === n ? 'on' : ''}" data-wall-cols-set=${n} @click=${() => this.setCols(n)}>${n === 0 ? 'אוטו' : n}</button>`)}
      </div>
      <div class="note">${shown.length} מתוך ${cams.length} מצלמות · פרופיל ${profile === 'sub' ? 'משני' : 'ראשי'} · תעבורה ${transport} · מכסת זרמים ${cap}${shown.length > cap ? ` — מעבר למכסה מוצג צילום בלבד` : ''} · צילומים מתרעננים כל דקה</div>
    `;
  }

  private renderDemo() {
    const cams = demoWall.slice(0, this.count);
    const cols = this.count === 1 ? 1 : this.count === 2 ? 2 : this.count <= 4 ? 2 : this.count <= 9 ? 3 : 4;
    return html`
      <div class="grid" style="--cols:${cols}">
        ${cams.map((c) => html`<sw-camera-tile name=${c.name} meta=${`${c.floor} · ${this.stream === 'auto' ? (this.count > 4 ? 'משני' : 'ראשי') : this.stream === 'main' ? 'ראשי' : 'משני'}`} state=${c.state} scene=${demoScene[c.id] ?? 'lobby'} ?compact=${this.count >= 9} @click=${() => navigate(`/live/cameras/${c.id}`)}></sw-camera-tile>`)}
      </div>
      <div class="note">נתוני הדגמה: קיר של ${this.count} אריחים אינו פותח ${this.count} זרמים ראשיים במקביל; במצב אוטומטי מוצג הזרם המשני במטריצה והראשי במיקוד.</div>
    `;
  }

  /** Owner round 4 (5.1): a plain `href="#/kiosk/all"` opened a new tab that landed outside HA's Ingress path
   * (the token-bearing prefix comes only from the CURRENT document's own location, not from a bare hash link).
   * Reusing this page's own origin+path - proven to work, since it's what's rendering right now - keeps the
   * new tab under the same Ingress session instead of guessing at URL resolution. */
  private openKiosk() {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#/kiosk/all`;
    window.open(url, '_blank', 'noopener');
  }

  render() {
    const api = isApi();
    const total = api ? this.cams?.length ?? 0 : demoWall.length;
    return html`
      <sw-page heading="כל המצלמות" subheading="${total} מצלמות${api ? '' : ` · תצוגה: ${VIEWS.find((v) => v.id === this.view)?.label} · נתוני הדגמה`}" wide>
        ${api ? nothing : html`<sw-field slot="actions"><select aria-label="תצוגה" @change=${(e: Event) => (this.view = (e.target as HTMLSelectElement).value)}>${VIEWS.map((v) => html`<option value=${v.id} ?selected=${v.id === this.view}>${v.label}</option>`)}</select></sw-field>`}
        <sw-field slot="actions"><select aria-label="זרם" @change=${(e: Event) => (this.stream = (e.target as HTMLSelectElement).value as 'auto')}><option value="auto">חי · אוטומטי</option><option value="main">חי · ראשי</option><option value="sub">חי · משני</option></select></sw-field>
        <div slot="actions" class="layouts" role="group" aria-label="פריסה">
          ${COUNTS.map((n) => html`<button class=${n === this.count && !this.cameras ? 'on' : ''} @click=${() => { this.setCount(n); if (this.cameras) navigate('/live/wall'); }} aria-pressed=${n === this.count && !this.cameras}>${n}</button>`)}
        </div>
        <sw-button slot="actions" variant="ghost" icon="expand" data-open-kiosk title="פותח את הקיוסק בלשונית חדשה" @click=${() => this.openKiosk()}>קיוסק</sw-button>
        ${api ? this.renderApi() : this.renderDemo()}
      </sw-page>
    `;
  }
}
