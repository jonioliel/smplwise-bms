import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-camera-tile';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-dialog';
import { demoScene, demoWall } from '../fixtures/catalog';
import { navigate } from '../router';
import { isApi } from '../api/session';
import { snapshotUrl, type ProductSettings, type Transport } from '../api/media';
import { listCameras, updateCamera } from '../api/maps';
import { effectiveTransport, productSettings } from '../api/prefs';
import { describeError } from '../api/client';
import type { Camera } from '../api/types';

/** T091 (owner request 2026-09-27): one row of the grid-layout settings dialog - the order the rows are kept
 * in IS the new sort_order (recomputed as 0..N-1 on save); `span` is the camera's grid_col_span. */
interface LayoutRow {
  id: string;
  name: string;
  span: number;
}

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

  /** Gated on `sources.configure` (the same permission and `can_sync` flag system-devices already uses) - the
   * owner can reorder the grid and set panoramic cameras to span more than one column (T091). */
  @state() private canManage = false;
  @state() private editingRows: LayoutRow[] | null = null;
  @state() private dialogError = '';
  @state() private dialogBusy = false;
  private editingOriginal = new Map<string, { sort_order: number; grid_col_span: number }>();
  /** Every camera the caller may see, enabled or not (listCameras() already returns both - see cameras.py's
   * `list_cameras`, which filters only by visibility, not by `enabled`). Only used to keep disabled/hidden
   * cameras' sort_order out of the way of the dialog's own 0..N-1 renumbering (T091, review S2); the dialog
   * itself still only lists the enabled ones in `this.cams`, same as the grid. */
  private allCams: Camera[] = [];

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
      /* T091 review: a spanned tile can leave a gap sparse auto-placement would not backfill (e.g. spans
         [1,2,1] at 2 columns), producing more real rows than bestFit()'s ideal-packing estimate and
         overflowing the wall - dense placement keeps the actual row count matching the estimate. */
      grid-auto-flow: dense;
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
    .settings-rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-block-size: 50vh;
      overflow-y: auto;
    }
    .settings-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-surface);
    }
    .settings-move {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .settings-move button {
      font: inherit;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      border-radius: 4px;
      inline-size: 24px;
      block-size: 20px;
      line-height: 1;
      cursor: pointer;
    }
    .settings-move button:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .settings-name {
      flex: 1;
      font-size: var(--sw-fs-sm);
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

  /** Columns and tile width that make the tiles biggest inside w × h; null when not measured. `spans` is
   * one grid_col_span per shown camera (plain 1 for every tile before T091).
   *
   * B2 review fix (superseded by T018): the first version of this widened a spanned tile's OWN aspect ratio
   * (16:9 per occupied column) so every row stayed a uniform height. That kept the grid's own box math simple,
   * but a real camera's live video is genuinely 16:9 - `sw-live-player`'s `<video>` uses `object-fit: contain`
   * (never `cover`, so a live feed is never cropped), so forcing its container to a wider-than-16:9 box just
   * letterboxed the real picture inside a normal-looking sub-rectangle (owner report, 2026-09-27: a span-2 tile
   * showed the picture squeezed into its right half, the left half solid background).
   *
   * T018 fix: every tile - spanned or not - keeps the SAME real 16:9 ratio (`sw-camera-tile`'s own `:host`
   * default; nothing here overrides it per-tile any more). A span-N tile is simply N columns wide, so its own
   * height (governed by its own width at 16:9) comes out taller than a normal tile's - a real "hero tile", not
   * a same-height wide strip. That means the row(s) holding a spanned tile are taller than a plain row, so the
   * old "every row is `tile` pixels tall" estimate below (`rows` uniform rows of `tile*9/16`) would under-count
   * the box's real height and could overflow the screen again. `maxTileForHeight` generalizes that estimate:
   * a row containing a spanned tile is assumed to need THAT tile's own real height instead of the uniform row
   * height (a documented approximation - see its own comment for the exact assumption and its known limit). */
  private bestFit(spans: number[]): { cols: number; tile: number } | null {
    const { w, h } = this.box;
    const total = spans.reduce((a, s) => a + s, 0);
    if (!w || h < 120 || total < 1) return null;
    const gap = 12;
    let best = { cols: 1, tile: 0 };
    for (let cols = 1; cols <= total; cols++) {
      const tile = Math.min((w - gap * (cols - 1)) / cols, this.maxTileForHeight(spans, cols, h, gap));
      if (tile > best.tile) best = { cols, tile };
    }
    return best.tile > 80 ? { cols: best.cols, tile: Math.floor(best.tile) } : null;
  }

  /** T018: the widest a span-1 "column unit" can be while every row still fits inside `h` pixels, for a given
   * column count. Generalizes the original "N uniform rows of `tile*9/16`" estimate to account for a spanned
   * tile's real (taller) own height at native 16:9.
   *
   * Approximation and its limit: dense auto-flow can in principle pack more than one spanned tile into the same
   * physical row (e.g. two span-2 tiles at 4 columns) - this function does not model that packing exactly (that
   * would need a real masonry solver). Instead it assumes as many DISTINCT rows are "spanned rows" as there are
   * spanned tiles (up to the total row count), and - to stay on the safe, non-overflowing side - charges each
   * such row the height of the largest remaining spanned tile first. When two spanned tiles really do share one
   * row, this over-counts (the estimate asks for a bit more height / a bit smaller tile than strictly necessary)
   * rather than under-counting, which is the direction that cannot overflow the screen. With no span above 1 this
   * reduces to exactly the original formula. */
  private maxTileForHeight(spans: number[], cols: number, h: number, gap: number): number {
    const clamped = spans.map((s) => Math.min(s, cols));
    const rows = Math.ceil(clamped.reduce((a, s) => a + s, 0) / cols);
    const spannedSpans = clamped
      .filter((s) => s > 1)
      .sort((a, b) => b - a);
    const spannedRows = Math.min(spannedSpans.length, rows);
    const used = spannedSpans.slice(0, spannedRows); // the largest spans first: see the comment above
    const normalRows = rows - spannedRows;
    // total estimated height = A*tile + B; solve for the largest tile with A*tile + B <= h.
    const a = (normalRows + used.reduce((sum, s) => sum + s, 0)) * (9 / 16);
    const b = used.reduce((sum, s) => sum + gap * (s - 1) * (9 / 16), 0) + gap * Math.max(0, rows - 1);
    return a > 0 ? (h - b) / a : Infinity;
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
      this.error = ''; // N6: a stale error panel must not linger once a retry actually succeeds
      this.allCams = list.cameras;
      this.cams = list.cameras.filter((c) => c.enabled);
      this.canManage = list.can_sync;
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

  /** Opens the grid-layout settings dialog: one row per camera, in the current sort_order (the backend already
   * sorts `this.cams` this way - see cameras.py ORDER BY sort_order, channel), snapshotting the original
   * sort_order / grid_col_span so save() only PATCHes what actually changed. */
  private openSettings() {
    const cams = this.cams ?? [];
    this.editingOriginal = new Map(cams.map((c) => [c.id, { sort_order: c.sort_order, grid_col_span: c.grid_col_span }]));
    this.editingRows = cams.map((c) => ({ id: c.id, name: c.name, span: c.grid_col_span }));
    this.dialogError = '';
  }

  /** N3: sw-dialog closes itself (Escape, backdrop click, the (X)) before this handler ever runs, so while a
   * save is in flight we cannot intercept the close - only reopen the very same element right back up, or a
   * save failure could be silently dropped along with the dialog. */
  private closeSettings(ev?: Event) {
    if (this.dialogBusy) {
      const dlg = ev?.currentTarget as (HTMLElement & { open?: boolean }) | undefined;
      if (dlg) dlg.open = true;
      return;
    }
    this.editingRows = null;
    this.dialogError = '';
  }

  private moveRow(index: number, dir: -1 | 1) {
    const rows = this.editingRows;
    if (!rows) return;
    const j = index + dir;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[index], next[j]] = [next[j], next[index]];
    this.editingRows = next;
  }

  private setSpan(index: number, span: number) {
    const rows = this.editingRows;
    if (!rows) return;
    const next = rows.slice();
    next[index] = { ...next[index], span };
    this.editingRows = next;
  }

  /** Only the cameras that actually changed - new position (0..N-1 from the row order) or column span - are
   * PATCHed; on failure the dialog stays open with the owner's edits intact (T091).
   *
   * S2: the dialog only lists enabled/visible cameras (`this.cams`), so renumbering just those to 0..N-1 would
   * collide with a disabled or hidden camera that kept its old (often much larger, channel-derived) sort_order -
   * it would land in an arbitrary middle position everywhere sort_order is read, and jump again on re-enable.
   * Every OTHER camera the caller can see (`this.allCams`, already fetched by load() - listCameras() returns
   * disabled ones too, only filtered by visibility) is renumbered right after the dialog's own rows, in its
   * current relative order, so nothing collides. */
  private async saveSettings() {
    const rows = this.editingRows;
    if (!rows) return;
    this.dialogBusy = true;
    this.dialogError = '';
    try {
      const rowIds = new Set(rows.map((r) => r.id));
      const patches: { id: string; body: { sort_order?: number; grid_col_span?: number } }[] = [];
      rows.forEach((row, i) => {
        const original = this.editingOriginal.get(row.id);
        const body: { sort_order?: number; grid_col_span?: number } = {};
        if (!original || original.sort_order !== i) body.sort_order = i;
        if (!original || original.grid_col_span !== row.span) body.grid_col_span = row.span;
        if (Object.keys(body).length) patches.push({ id: row.id, body });
      });
      const others = this.allCams
        .filter((c) => !rowIds.has(c.id))
        .sort((a, b) => a.sort_order - b.sort_order || a.channel - b.channel);
      others.forEach((c, j) => {
        const target = rows.length + j;
        if (c.sort_order !== target) patches.push({ id: c.id, body: { sort_order: target } });
      });
      await Promise.all(patches.map((p) => updateCamera(p.id, p.body)));
      this.editingRows = null;
      await this.load();
    } catch (err) {
      this.dialogError = describeError(err);
      // S3: Promise.all does not roll back the PATCHes that DID land before one failed (no bulk transaction
      // here) - reload in the background so the screen's own data reflects reality even though the dialog
      // (with the owner's pending edits) stays open; a later Cancel must not show falsely-stale data.
      await this.load();
    } finally {
      this.dialogBusy = false;
    }
  }

  private renderSettingsDialog() {
    const rows = this.editingRows;
    if (!rows) return nothing;
    const spanOptions = [
      { v: 1, label: '1 עמודה' },
      { v: 2, label: '2 עמודות' },
      { v: 3, label: '3 עמודות' },
      { v: 4, label: '4 עמודות' },
    ];
    return html`<sw-dialog open heading="סידור הקיר" subheading="סדר הופעה של המצלמות ורוחב אריח בעמודות (למצלמות פנורמיות)" data-wall-settings-dialog @close=${(ev: Event) => this.closeSettings(ev)}>
      <div class="settings-rows" data-wall-settings-rows>
        ${rows.map(
          (row, i) => html`<div class="settings-row" data-wall-settings-row=${row.id}>
            <div class="settings-move">
              <button data-wall-move-up=${row.id} ?disabled=${i === 0} @click=${() => this.moveRow(i, -1)} aria-label="הזז למעלה">↑</button>
              <button data-wall-move-down=${row.id} ?disabled=${i === rows.length - 1} @click=${() => this.moveRow(i, 1)} aria-label="הזז למטה">↓</button>
            </div>
            <div class="settings-name">${row.name}</div>
            <sw-field label="רוחב"><select data-wall-span=${row.id} .value=${String(row.span)} @change=${(ev: Event) => this.setSpan(i, Number((ev.target as HTMLSelectElement).value))}>${spanOptions.map((o) => html`<option value=${o.v} ?selected=${o.v === row.span}>${o.label}</option>`)}</select></sw-field>
          </div>`,
        )}
      </div>
      ${this.dialogError ? html`<div class="err" data-wall-settings-error>${this.dialogError}</div>` : nothing}
      <div slot="footer">
        <sw-button variant="primary" icon="check" data-wall-settings-save ?disabled=${this.dialogBusy} @click=${() => this.saveSettings()}>${this.dialogBusy ? 'שומר…' : 'שמור'}</sw-button>
        <sw-button variant="ghost" ?disabled=${this.dialogBusy} @click=${() => this.closeSettings()}>ביטול</sw-button>
      </div>
    </sw-dialog>`;
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
    // A span is capped at 4 columns server-side already (CameraPatch), clamped again here defensively.
    const spanOf = (c: Camera) => Math.max(1, Math.min(c.grid_col_span, 4));
    // owner round 4 (1.7): "עמודות" only ever adjusted `bestFit`'s own column count, so on any screen narrower
    // than 768px - or before the grid's box was first measured - bestFit never ran and the buttons did nothing.
    // Columns are chosen first (override beats auto-fit beats the static ladder); fit only sizes the tiles after.
    // B2 review fix: bestFit is fed each shown camera's column weight (1 for a plain tile, more for a spanned
    // one) instead of a flat tile count, and clamps every span against whatever column count it is trying at
    // that moment - see bestFit()'s own comment for why this cannot be precomputed once outside the search.
    const autoFit = window.innerWidth >= 768 ? this.bestFit(shown.map(spanOf)) : null;
    const cols = this.colsOverride ? Math.min(this.colsOverride, Math.max(1, shown.length)) : autoFit ? autoFit.cols : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : n <= 25 ? 5 : 6;
    // S1: below 768px without a manual override, the phone media query further caps the RENDERED grid at
    // min(cols, 2) columns (see `.grid:not([data-wall-cols-manual])` below) - a span (and the fit-sizing
    // math below, T091 re-review nit) must both use what CSS actually renders, or a span of 3-4 adds extra
    // implicit auto-columns and a zero-width column.
    const gridCols = !this.colsOverride && window.innerWidth < 768 ? Math.min(cols, 2) : cols;
    let fit: { cols: number; tile: number } | null = autoFit && !this.colsOverride ? autoFit : null;
    if (this.box.w && (this.colsOverride || !fit)) {
      // T018: same "spanned rows are taller" accounting as bestFit()'s own search - see maxTileForHeight().
      const spans = shown.map((c) => Math.min(spanOf(c), gridCols));
      const tile = Math.min((this.box.w - 12 * (cols - 1)) / cols, this.box.h > 120 ? this.maxTileForHeight(spans, cols, this.box.h, 12) : Infinity);
      if (tile > 80 && Number.isFinite(tile)) fit = { cols, tile: Math.floor(tile) };
    }
    const cap = this.settings?.['media.max_live_sessions'] ?? 8;
    const profile: 'sub' | 'main' = this.stream === 'auto' ? (this.settings?.['media.wall_profile'] ?? 'sub') : this.stream;
    const transport: Transport = effectiveTransport(this.settings);
    return html`
      <div class="grid ${fit ? 'fit' : ''}" style="--cols:${cols};--tile:${fit ? `${fit.tile}px` : 'auto'}" data-wall-cols=${cols} ?data-wall-cols-manual=${!!this.colsOverride}>
        ${shown.map((c, i) => {
          const span = Math.min(spanOf(c), gridCols);
          // T018 fix: no per-tile aspect-ratio override any more - every tile (spanned or not) keeps
          // `sw-camera-tile`'s own native 16:9 `:host` ratio, so a real (non-panoramic) camera's live picture
          // is never letterboxed by `object-fit: contain` inside a wrongly-widened box (see bestFit()'s own
          // comment for the full reasoning). A span-N tile is just N columns wide, and 16:9 at that own width
          // makes it a taller "hero tile" - bestFit()/maxTileForHeight() size the base tile so that still fits.
          return html`<sw-camera-tile
            name=${c.name}
            state=${c.status === 'online' ? 'live' : c.status === 'offline' ? 'offline' : 'unknown'}
            ?live=${c.status !== 'offline' && c.can_view_live !== false && i < cap}
            cameraId=${c.id}
            profile=${profile}
            transport=${transport}
            poster=${c.status === 'offline' ? '' : snapshotUrl(c.id, this.posterBust)}
            ?compact=${n >= 9}
            style=${`grid-column: span ${span}`}
            @click=${() => navigate(`/live/cameras/${c.id}`)}></sw-camera-tile>`;
        })}
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
        ${api && this.canManage && this.cams?.length ? html`<sw-button slot="actions" variant="ghost" icon="grid" data-wall-settings-open title="סדר הופעה ורוחב עמודות" @click=${() => this.openSettings()}>סידור הקיר</sw-button>` : nothing}
        <sw-button slot="actions" variant="ghost" icon="expand" data-open-kiosk title="פותח את הקיוסק בלשונית חדשה" @click=${() => this.openKiosk()}>קיוסק</sw-button>
        ${api ? this.renderApi() : this.renderDemo()}
        ${this.renderSettingsDialog()}
      </sw-page>
    `;
  }
}
