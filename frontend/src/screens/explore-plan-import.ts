import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-steps';
import '../components/sw-field';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { navigate } from '../router';
import { createVersion, getDxf, listAssets, loadMap, publishVersion, setDxf, uploadAsset, type DxfDetails } from '../api/maps';
import { findFloor, loadTree, type CatalogTree } from '../api/catalog';
import { ApiError, describeError, resourceUrl } from '../api/client';
import { can, isApi } from '../api/session';
import { getDxfEntities, importDxfGeometry, type DetectResult, type DxfEntities, type DxfTarget } from '../api/geometry';
import { stashDxfCandidates } from '../map/candidates';
import type { PlanAsset, PlanVersion } from '../api/types';

const STEPS = ['קובץ', 'עמוד', 'חיתוך וסיבוב', 'שם והערות', 'שמירה ופרסום'];

/** T086: a refused DXF mapping call, in the screen's words (code from ApiError; the server's own Hebrew otherwise). */
interface DxfMapError {
  code: string;
  text: string;
  retry: boolean;
}

function dxfMapError(err: unknown, action: 'load' | 'import'): DxfMapError {
  if (!(err instanceof ApiError)) return { code: 'failed', text: describeError(err), retry: err instanceof TypeError };
  const d = err.body.details as Record<string, unknown> | undefined;
  const list = (k: string) => (Array.isArray(d?.[k]) ? (d?.[k] as unknown[]).map(String).join(', ') : '');
  switch (err.code) {
    case 'dxf_timeout': {
      const s = typeof d?.timeout_s === 'number' ? ` (${d.timeout_s} שנ׳)` : '';
      return { code: err.code, text: action === 'load' ? `קריאת השרטוט לא הסתיימה בזמן${s}. נסה שוב.` : `הייבוא לא הסתיים בזמן${s}. נסה שוב, או מפה פחות שכבות (סמן "התעלם" לשכבות שאינן מבנה).`, retry: true };
    }
    case 'unknown_item':
      return { code: err.code, text: `פריט שנבחר לבלוק לא קיים בספרייה${list('items') ? `: ${list('items')}` : ''}. בחר פריט אחר (או "עצם כללי") ונסה שוב.`, retry: false };
    case 'unknown_layer':
      return { code: err.code, text: `שכבה במיפוי לא קיימת בקובץ${list('unknown') ? `: ${list('unknown')}` : ''}. המיפוי נטען מחדש מהשרטוט.`, retry: false };
    case 'no_layers':
      return { code: err.code, text: 'יש למפות לפחות שכבה אחת (יעד שאינו "התעלם").', retry: false };
    case 'not_dxf':
      return { code: err.code, text: 'הגרסה השמורה לא נוצרה מקובץ DXF, ולכן אין מה למפות.', retry: false };
    case 'dxf_unitless':
      return { code: err.code, text: 'לקובץ אין יחידות: בחר יחידות בכרטיס "DXF · שכבות, יחידות וקנה מידה" לפני הייבוא.', retry: false };
    default:
      return { code: err.code || 'failed', text: describeError(err), retry: !!err.body.retryable };
  }
}

/**
 * SC05 — plan import (board 2 screen 13): file → page → crop/rotate → name → draft → publish.
 * The original stays untouched on the server; every step here only describes a derived version.
 */
function fmtSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

@customElement('explore-plan-import')
export class ExplorePlanImport extends LitElement {
  @property() floorId = '';
  @state() private step = 0;
  @state() private tree: CatalogTree | null = null;
  @state() private assets: PlanAsset[] = [];
  @state() private asset: PlanAsset | null = null;
  @state() private page = 1;
  @state() private rotation = 0;
  @state() private crop = { x: 0, y: 0, w: 1, h: 1 };
  @state() private notes = '';
  @state() private version: PlanVersion | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private dragOver = false;
  /** T065: DXF details for the selected asset, the layer/units choice being edited, and a cache-buster for re-rendered previews. */
  @state() private dxf: DxfDetails | null = null;
  @state() private dxfLayers: string[] | null = null;
  @state() private dxfUnits: string | null = null;
  @state() private dxfBusy = false;
  @state() private previewBust = 0;
  /** T086: the DXF entity summary of the saved version's asset, the mapping being edited and the import in flight. */
  @state() private dxfEnt: DxfEntities | null = null;
  @state() private dxfEntLoading = false;
  @state() private layerMap: Record<string, DxfTarget> = {};
  @state() private blockMap: Record<string, string | null> = {};
  @state() private importing = false;
  @state() private importSecs = 0;
  @state() private imported: DetectResult | null = null;
  @state() private dxfMapErr: (DxfMapError & { action: 'load' | 'import' }) | null = null;
  /** The drawing was re-rendered (layers / units) after the version was saved: the version no longer matches it. */
  @state() private dxfStale = false;
  /** map.edit on this floor (from the floor bundle's permissions): only then are the candidates handed to the editor. */
  @state() private canStructure: boolean | null = null;
  private importTimer: number | undefined;
  /** The asset the layer / block choices above were made for. */
  private mapAssetId = '';

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .stage {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      padding: 14px;
      min-block-size: 360px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .drop {
      flex: 1;
      min-block-size: 300px;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      text-align: center;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    .drop.over,
    .drop:hover {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .drop .ic {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      margin: 0 auto 8px;
    }
    .drop small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin-block-start: 4px;
    }
    input[type='file'] {
      display: none;
    }
    .pages {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px;
    }
    .pg {
      border: 1.5px solid var(--sw-border);
      border-radius: 8px;
      padding: 6px;
      background: var(--sw-surface);
      cursor: pointer;
      font: inherit;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .pg.on {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .pg img {
      inline-size: 100%;
      aspect-ratio: 1;
      object-fit: contain;
      background: #f3f5f9;
      border-radius: 4px;
      display: block;
      margin-block-end: 4px;
    }
    .preview {
      position: relative;
      flex: 1;
      min-block-size: 320px;
      background: #f3f5f9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      display: grid;
      place-items: center;
    }
    .preview .frame {
      position: relative;
      display: inline-block;
      line-height: 0;
      cursor: crosshair;
      touch-action: none;
      user-select: none;
      overflow: hidden;
    }
    .preview .frame img {
      max-inline-size: 100%;
      max-block-size: 420px;
      display: block;
      pointer-events: none;
    }
    .preview .cropbox {
      position: absolute;
      border: 2px dashed var(--sw-accent);
      box-shadow: 0 0 0 9999px rgba(17, 24, 39, 0.28);
      pointer-events: none;
      box-sizing: border-box;
    }
    .preview .hint {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
      background: rgba(17, 24, 39, 0.7);
      color: #fff;
      font-size: var(--sw-fs-xs);
      border-radius: 6px;
      padding: 3px 8px;
      line-height: 1.4;
      pointer-events: none;
    }
    .row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .foot {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: #15803d;
      font-size: var(--sw-fs-sm);
    }
    .assets button {
      display: flex;
      justify-content: space-between;
      inline-size: 100%;
      gap: 8px;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: 6px;
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      text-align: start;
      margin-block-end: 4px;
    }
    /* T086: the DXF mapping tables scroll inside their own box on a narrow screen, never the page */
    .stage {
      min-inline-size: 0;
    }
    .mapwrap {
      max-inline-size: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    table.map {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    table.map th,
    table.map td {
      text-align: start;
      padding: 4px 6px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
    }
    table.map th {
      font-weight: 600;
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    table.map td.sample {
      max-inline-size: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    table.map tr.muted {
      color: var(--sw-text-2);
    }
    table.map select {
      font: inherit;
      max-inline-size: 140px;
    }
    table.map .nowrap {
      white-space: nowrap;
    }
    /* phone: the sample column and the kind breakdown give way so the target select stays in view */
    @media (max-width: 767px) {
      table.map .sample,
      table.map .kinds {
        display: none;
      }
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.init();
  }

  private async init() {
    try {
      this.tree = await loadTree();
      if (isApi() && this.floorId) this.assets = (await listAssets(this.floorId)).assets;
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private get floor() {
    return this.tree && this.floorId ? findFloor(this.tree, this.floorId) : null;
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('asset') && isApi()) {
      const a = this.asset;
      if (a && a.kind === 'dxf' && (!this.dxf || this.dxf.asset_id !== a.id)) void this.loadDxf(a.id);
      else if (!a || a.kind !== 'dxf') this.dxf = null;
    }
    if ((changed.has('version') || changed.has('asset')) && isApi()) {
      const a = this.asset;
      const v = this.version;
      if (v && a && a.kind === 'dxf' && v.asset_id === a.id) {
        if (changed.has('version') && (changed.get('version') as PlanVersion | null | undefined)?.id !== v.id) this.resetDxfMap();
        if (!this.dxfEnt || this.dxfEnt.asset_id !== a.id) void this.loadDxfEntities(a.id);
        if (this.canStructure === null) void this.loadFloorRights();
      } else if (!v || !a || a.kind !== 'dxf') {
        this.dxfEnt = null;
        this.resetDxfMap();
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopImportTimer();
  }

  private resetDxfMap() {
    this.imported = null;
    this.dxfMapErr = null;
    this.dxfStale = false;
  }

  /** map.edit on the floor: an installation-wide grant answers at once, a floor-scoped one comes with the floor bundle. */
  private async loadFloorRights() {
    if (can('map.edit')) {
      this.canStructure = true;
      return;
    }
    try {
      this.canStructure = (await loadMap(this.floorId)).permissions.structure;
    } catch {
      this.canStructure = false;
    }
  }

  private async loadDxfEntities(assetId: string) {
    if (this.dxfEntLoading) return;
    this.dxfEntLoading = true;
    this.dxfMapErr = null;
    try {
      const ent = await getDxfEntities(assetId);
      // the generic object is the fallback of an unmatched block: a null suggestion shows as the first choice
      const fallback = ent.catalog_choices[0]?.id ?? null;
      // a reload of the same drawing (after a re-render or a refusal) keeps the choices that still apply
      const same = this.mapAssetId === ent.asset_id;
      const targets = new Set(ent.targets.map((t) => t.id));
      const items = new Set(ent.catalog_choices.map((c) => c.id));
      const keptLayer = (name: string) => (same && name in this.layerMap && targets.has(this.layerMap[name]) ? this.layerMap[name] : undefined);
      const keptBlock = (name: string) => (same && name in this.blockMap && items.has(this.blockMap[name]) ? this.blockMap[name] : undefined);
      this.dxfEnt = ent;
      this.mapAssetId = ent.asset_id;
      this.layerMap = Object.fromEntries(ent.layers.map((l) => [l.name, l.count ? keptLayer(l.name) ?? l.suggested : 'ignore']));
      this.blockMap = Object.fromEntries(ent.blocks.map((b) => [b.name, keptBlock(b.name) ?? b.suggested.catalog_id ?? fallback]));
      this.imported = null;
    } catch (err) {
      this.dxfMapErr = { ...dxfMapError(err, 'load'), action: 'load' };
    } finally {
      this.dxfEntLoading = false;
    }
  }

  private stopImportTimer() {
    if (this.importTimer !== undefined) window.clearInterval(this.importTimer);
    this.importTimer = undefined;
  }

  private async importDxf() {
    const v = this.version;
    const ent = this.dxfEnt;
    if (!v || !ent || this.importing) return;
    const layer_map = Object.fromEntries(Object.entries(this.layerMap).filter(([, t]) => t !== 'ignore'));
    if (!Object.keys(layer_map).length) {
      this.dxfMapErr = { code: 'no_layers', text: 'יש למפות לפחות שכבה אחת (יעד שאינו "התעלם").', retry: false, action: 'import' };
      return;
    }
    this.importing = true;
    this.importSecs = 0;
    this.dxfMapErr = null;
    this.imported = null;
    const t0 = Date.now();
    this.importTimer = window.setInterval(() => (this.importSecs = Math.round((Date.now() - t0) / 1000)), 1000);
    try {
      // only the blocks of the drawing travel; a block left on the fallback choice goes as its id, never as a prefix guess
      this.imported = await importDxfGeometry(v.id, { layer_map, block_map: { ...this.blockMap } });
    } catch (err) {
      const e = dxfMapError(err, 'import');
      this.dxfMapErr = { ...e, action: 'import' };
      if (e.code === 'unknown_layer' || e.code === 'unknown_item') {
        this.dxfEnt = null;
        void this.loadDxfEntities(ent.asset_id).then(() => {
          // keep the refusal visible after the reload replaced the table
          if (!this.dxfMapErr) this.dxfMapErr = { ...e, action: 'import' };
        });
      }
    } finally {
      this.stopImportTimer();
      this.importing = false;
    }
  }

  /** The hand-off: the candidates go to sessionStorage for this version and the editor opens its detect tool on them. */
  private openEditorWithCandidates() {
    const v = this.version;
    const r = this.imported;
    if (!v || !r || !this.canStructure) return;
    stashDxfCandidates(v.id, r);
    navigate(`/explore/floors/${this.floorId}/edit`, { candidates: 'dxf' });
  }

  private setLayerTarget(name: string, t: DxfTarget) {
    this.layerMap = { ...this.layerMap, [name]: t };
    this.imported = null;
    if (this.dxfMapErr?.action === 'import') this.dxfMapErr = null;
  }

  private setBlockItem(name: string, id: string | null) {
    this.blockMap = { ...this.blockMap, [name]: id };
    this.imported = null;
    if (this.dxfMapErr?.action === 'import') this.dxfMapErr = null;
  }

  private async loadDxf(assetId: string) {
    try {
      const d = await getDxf(assetId);
      this.dxf = d;
      this.dxfLayers = d.options.layers;
      this.dxfUnits = d.options.units ?? (d.info?.units && d.info.units !== 'unitless' ? d.info.units : null);
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private toggleDxfLayer(name: string) {
    const all = this.dxf?.info?.layers.filter((l) => l.drawable > 0).map((l) => l.name) ?? [];
    const cur = this.dxfLayers ?? all;
    this.dxfLayers = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
  }

  private async applyDxf() {
    if (!this.dxf) return;
    this.dxfBusy = true;
    this.error = '';
    try {
      const all = this.dxf.info?.layers.filter((l) => l.drawable > 0).map((l) => l.name) ?? [];
      const layers = this.dxfLayers && this.dxfLayers.length !== all.length ? this.dxfLayers : null;
      this.dxf = await setDxf(this.dxf.asset_id, { layers, units: this.dxfUnits });
      this.dxfLayers = this.dxf.options.layers;
      this.previewBust = Date.now();
      // T086: a saved version of this drawing no longer matches the new rendering; the mapping table follows the drawing
      if (this.version && this.version.asset_id === this.dxf.asset_id) {
        this.dxfStale = true;
        this.imported = null;
        void this.loadDxfEntities(this.dxf.asset_id);
      }
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.dxfBusy = false;
    }
  }

  private renderDxf() {
    const d = this.dxf;
    if (!d || !d.info) return nothing;
    const all = d.info.layers.filter((l) => l.drawable > 0).map((l) => l.name);
    const chosen = this.dxfLayers ?? all;
    const ext = d.info.extent;
    const skipped = Object.entries(d.render?.skipped ?? d.info.unsupported);
    const m = d.render?.meters_per_px;
    const unitsKnown = d.render?.units && d.render.units !== 'unitless';
    return html`<sw-card heading="DXF · שכבות, יחידות וקנה מידה" subheading=${`${d.adapter.library} (${d.adapter.license}) · המקור נשמר כפי שהועלה; התצוגה נגזרת ממנו`} data-dxf>
      <div class="note">גרסה ${d.info.version} · יחידות בקובץ: <strong data-dxf-units>${d.info.units}</strong>${ext ? html` · היקף ${ext.width.toFixed(0)} × ${ext.height.toFixed(0)} יחידות` : nothing}${unitsKnown && ext && m ? html` · כ־${((ext.width * (m * (d.render!.px_per_unit))) ).toFixed(1)} × ${((ext.height * (m * (d.render!.px_per_unit)))).toFixed(1)} מ׳` : nothing}</div>
      <div class="note">ישויות: ${Object.entries(d.info.entity_counts).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>
      ${skipped.length ? html`<div class="err" data-dxf-partial>המרה חלקית: ${skipped.map(([k, v]) => `${v} × ${k}`).join(', ')} לא מצוירים (טקסטים, מילויים, מידות וגופים תלת־ממדיים אינם מומרים). הדבר יוצג גם על הגרסה.</div>` : html`<div class="note">כל הישויות בקובץ מצוירות.</div>`}
      <div class="note" style="margin-block-start:6px">שכבות (${chosen.length} מתוך ${all.length}):</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px 12px">${d.info.layers.map((l) => html`<label style="display:flex;gap:6px;align-items:center;font-size:var(--sw-fs-sm)"><input type="checkbox" data-dxf-layer=${l.name} .checked=${chosen.includes(l.name)} ?disabled=${l.drawable === 0} @change=${() => this.toggleDxfLayer(l.name)} /> <span class="ltr">${l.name}</span> <span class="note">(${l.drawable})</span></label>`)}</div>
      <div class="row" style="margin-block-start:8px;align-items:center;gap:8px">
        <sw-field label="יחידות השרטוט"><select data-dxf-units-select @change=${(e: Event) => (this.dxfUnits = (e.target as HTMLSelectElement).value || null)}><option value="" ?selected=${!this.dxfUnits}>לפי הקובץ (${d.info.units})</option>${d.units_choices.map((u) => html`<option value=${u} ?selected=${this.dxfUnits === u}>${u}</option>`)}</select></sw-field>
        <sw-button size="sm" variant="primary" data-dxf-apply ?disabled=${this.dxfBusy || chosen.length === 0} @click=${() => this.applyDxf()}>החל ורנדר מחדש</sw-button>
      </div>
      ${d.render ? html`<div class="note" style="margin-block-start:6px" data-dxf-render>רונדר: ${d.render.width}×${d.render.height} px · ${d.render.rendered} ישויות מ־${d.render.layers.length} שכבות${m ? ` · ${(m * 100).toFixed(2)} ס״מ לפיקסל (מיחידות ${d.render.units}; ייכנס לגרסה כקנה מידה)` : ' · קנה מידה לא ידוע: הקובץ ללא יחידות, בחר יחידות או כייל מאוחר יותר'}</div>` : nothing}
      <div class="note">DWG אינו נתמך (פורמט סגור) — יש להמיר ל־DXF לפני הייבוא.</div>
    </sw-card>`;
  }

  /** T086: layers and blocks of the drawing mapped to structure candidates for the saved version (design 9.4). */
  private renderDxfMap() {
    const v = this.version;
    const a = this.asset;
    if (!v || !a || a.kind !== 'dxf' || v.asset_id !== a.id) return nothing;
    const ent = this.dxfEnt;
    const err = this.dxfMapErr;
    const busy = this.dxfEntLoading || this.importing;
    const errLine = err
      ? html`<div class="err" role="alert" data-dxf-map-error=${err.code}>${err.text}${err.retry
          ? html` <sw-button size="sm" variant="ghost" icon="refresh" data-dxf-retry ?disabled=${busy} @click=${() => (err.action === 'load' ? void this.loadDxfEntities(a.id) : void this.importDxf())}>נסה שוב</sw-button>`
          : nothing}</div>`
      : nothing;
    const heading = 'DXF · מיפוי שכבות ובלוקים למבנה';
    const sub = 'שכבות → קירות / דלתות / חלונות / עצמים / חדרים; בלוקים → פריטי ספרייה. התוצאה נכנסת לעורך כמועמדים, לא לטיוטה';
    if (!ent)
      return html`<sw-card heading=${heading} subheading=${sub} data-dxf-map aria-busy=${busy ? 'true' : 'false'}>
        ${this.dxfEntLoading ? html`<div class="note" data-dxf-map-loading>קורא את השכבות והבלוקים של השרטוט…</div>` : nothing}${errLine}
      </sw-card>`;
    const unitless = ent.metres_per_unit === null;
    const mapped = Object.values(this.layerMap).filter((t) => t !== 'ignore').length;
    const rooms = ent.layers.filter((l) => this.layerMap[l.name] === 'rooms').length;
    const objectsMapped = ent.layers.some((l) => this.layerMap[l.name] === 'objects');
    const r = this.imported;
    return html`<sw-card heading=${heading} subheading=${sub} data-dxf-map aria-busy=${busy ? 'true' : 'false'}>
      ${unitless
        ? html`<div class="err" data-dxf-map-units>לקובץ אין יחידות: בחר יחידות בכרטיס "DXF · שכבות, יחידות וקנה מידה", לחץ "החל ורנדר מחדש" ושמור גרסה חדשה - רק אז המידות במטרים אמיתיים.</div>`
        : html`<div class="note">יחידות: <span class="ltr">${ent.units}</span> · המידות ייכנסו במטרים אמיתיים (מדוד)</div>`}
      ${this.dxfStale
        ? html`<div class="err" data-dxf-map-stale>השרטוט רונדר מחדש אחרי שמירת הגרסה, והגרסה השמורה כבר לא תואמת אותו. שמור גרסה חדשה לפני הייבוא.
            <sw-button size="sm" variant="primary" icon="check" data-dxf-map-resave ?disabled=${this.busy} @click=${() => this.save()}>שמור גרסה חדשה</sw-button></div>`
        : nothing}
      <div class="mapwrap" data-dxf-map-layers>
        <table class="map">
          <thead><tr><th scope="col">שכבה</th><th scope="col">ישויות</th><th scope="col" class="sample">דוגמה</th><th scope="col">יעד</th></tr></thead>
          <tbody>
            ${ent.layers.map((l, i) => html`<tr data-dxf-map-row=${l.name} class=${l.count ? '' : 'muted'}>
              <td><label for=${`dxf-map-layer-${i}`} class="ltr">${l.name}</label>${l.in_render ? nothing : html` <span class="note">(לא מצוירת)</span>`}</td>
              <td><span class="ltr">${l.count}</span>${l.count ? html` <span class="note ltr kinds">${Object.entries(l.kinds).map(([k, n]) => `${k} ${n}`).join(', ')}</span>` : nothing}</td>
              <td class="ltr sample">${l.sample}</td>
              <td><select id=${`dxf-map-layer-${i}`} data-dxf-map-target aria-label=${`יעד לשכבה ${l.name}`} ?disabled=${!l.count || this.importing} @change=${(e: Event) => this.setLayerTarget(l.name, (e.target as HTMLSelectElement).value as DxfTarget)}>
                ${ent.targets.map((t) => html`<option value=${t.id} ?selected=${(this.layerMap[l.name] ?? 'ignore') === t.id}>${t.label}</option>`)}
              </select></td>
            </tr>`)}
          </tbody>
        </table>
      </div>
      ${ent.blocks.length
        ? html`<div class="note" style="margin-block-start:8px">בלוקים (${ent.blocks.length}) - נכנסים כעצמים רק מתוך שכבות שמופו ל"עצמים"${objectsMapped ? '' : ' (כרגע אף שכבה לא ממופה ל"עצמים")'}; בלוק בלי התאמה נכנס כ"עצם כללי":</div>
            <div class="mapwrap" data-dxf-map-blocks>
              <table class="map">
                <thead><tr><th scope="col">בלוק</th><th scope="col">מופעים</th><th scope="col" data-dxf-block-size-unit=${unitless ? 'drawing' : 'm'}>${unitless ? 'מידות (יחידות שרטוט)' : 'מידות (מ׳)'}</th><th scope="col">פריט</th></tr></thead>
                <tbody>
                  ${ent.blocks.map((b, i) => html`<tr data-dxf-block-row=${b.name}>
                    <td><label for=${`dxf-map-block-${i}`} class="ltr">${b.name}</label></td>
                    <td class="ltr">${b.count}</td>
                    <td class="ltr nowrap">${b.size_m[0].toFixed(2)} × ${b.size_m[1].toFixed(2)}</td>
                    <td><select id=${`dxf-map-block-${i}`} data-dxf-block-target aria-label=${`פריט לבלוק ${b.name}`} ?disabled=${this.importing} @change=${(e: Event) => this.setBlockItem(b.name, (e.target as HTMLSelectElement).value || null)}>
                      ${ent.catalog_choices.map((c) => html`<option value=${c.id ?? ''} ?selected=${(this.blockMap[b.name] ?? null) === c.id}>${c.name}</option>`)}
                    </select></td>
                  </tr>`)}
                </tbody>
              </table>
            </div>`
        : nothing}
      <div class="row" style="margin-block-start:8px">
        <sw-button variant="primary" size="sm" icon="sparkle" data-dxf-import aria-busy=${this.importing ? 'true' : 'false'} ?disabled=${unitless || this.dxfStale || busy || !mapped} @click=${() => this.importDxf()}>${this.importing ? `מייבא… ${this.importSecs} שנ׳` : 'ייבא כמועמדים'}</sw-button>
        <span class="note" data-dxf-map-count>${mapped ? `${mapped} שכבות ממופות` : 'אף שכבה לא ממופה - בחר יעד לשכבה אחת לפחות'}${rooms ? ` · חדרים נכנסים דרך קבלת האזורים, לא כמבנה` : ''}</span>
      </div>
      ${this.importing ? html`<div class="note" data-dxf-importing>קורא את השרטוט בשרת; שרטוט גדול עשוי לקחת עד דקה.</div>` : nothing}
      ${errLine}
      ${r
        ? html`<div class="ok" data-dxf-imported>נמצאו מועמדים: קירות ${r.walls.length} · פתחים ${r.openings.length} · עצמים ${r.objects?.length ?? 0} · <span data-dxf-imported-rooms>חדרים: ${r.rooms?.length ?? 0} (דרך קבלת האזורים)</span></div>
            ${r.existing_auto.walls + r.existing_auto.openings
              ? html`<div class="note" data-dxf-imported-existing>בטיוטת המבנה כבר יש ${r.existing_auto.walls} קירות ו־${r.existing_auto.openings} פתחים מיובאים; בעורך אפשר להחליף אותם.</div>`
              : nothing}
            ${this.canStructure
              ? html`<div class="row" style="margin-block-start:6px">
                  <sw-button variant="primary" size="sm" icon="edit" data-dxf-open-editor @click=${() => this.openEditorWithCandidates()}>המשך לעורך</sw-button>
                  <span class="note">העורך ייפתח בכלי "זיהוי" עם המועמדים בשכבה מקווקווה; שם מאשרים או דוחים. שום דבר לא נשמר עד האישור.</span>
                </div>`
              : html`<div class="note" data-dxf-no-edit>${this.canStructure === null ? 'בודק הרשאות עריכה…' : 'אין לך הרשאת עריכת מבנה בקומה זו, ולכן אי אפשר לאשר את המועמדים. עורך הקומה יכול לייבא אותם מהמסך הזה.'}</div>`}`
        : nothing}
    </sw-card>`;
  }

  private async onFile(file: File | undefined) {
    if (!file || !this.floorId) return;
    this.busy = true;
    this.error = '';
    try {
      this.asset = await uploadAsset(this.floorId, file);
      this.page = 1;
      this.rotation = 0;
      this.crop = { x: 0, y: 0, w: 1, h: 1 };
      this.version = null;
      this.step = this.asset.page_count > 1 ? 1 : 2;
      this.assets = [this.asset, ...this.assets.filter((a) => a.id !== this.asset!.id)];
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async save() {
    if (!this.asset || !this.floorId) return;
    this.busy = true;
    this.error = '';
    try {
      const full = this.crop.x === 0 && this.crop.y === 0 && this.crop.w === 1 && this.crop.h === 1;
      this.version = await createVersion(this.floorId, { asset_id: this.asset.id, page: this.page, rotation: this.rotation, crop: full ? null : this.crop, notes: this.notes });
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async publish() {
    if (!this.version) return;
    this.busy = true;
    this.error = '';
    try {
      this.version = await publishVersion(this.version.id);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private setCrop(key: 'x' | 'y' | 'w' | 'h', pct: number) {
    const v = Math.max(0, Math.min(100, pct)) / 100;
    const c = { ...this.crop, [key]: v };
    if (c.x + c.w > 1) c.w = 1 - c.x;
    if (c.y + c.h > 1) c.h = 1 - c.y;
    if (c.w <= 0.02) c.w = 0.02;
    if (c.h <= 0.02) c.h = 0.02;
    this.crop = c;
  }

  private previewUrl() {
    const p = this.asset?.pages.find((x) => x.page === this.page) ?? this.asset?.pages[0];
    if (!p) return '';
    const url = resourceUrl(p.preview_url) + (this.previewBust ? `${p.preview_url.includes('?') ? '&' : '?'}v=${this.previewBust}` : '');
    return this.rotation ? `${url}${url.includes('?') ? '&' : '?'}rotation=${this.rotation}` : url;
  }

  /** Draw the crop rectangle with the mouse over the (already rotated) preview; coordinates are fractions of the image. */
  private startCrop = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const frame = e.currentTarget as HTMLElement;
    const rect = frame.getBoundingClientRect();
    const norm = (ev: PointerEvent) => ({ x: Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height)) });
    const start = norm(e);
    frame.setPointerCapture(e.pointerId);
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const cur = norm(ev);
      const x = Math.min(start.x, cur.x);
      const y = Math.min(start.y, cur.y);
      const w = Math.abs(cur.x - start.x);
      const h = Math.abs(cur.y - start.y);
      if (w > 0.01 && h > 0.01) this.crop = { x: +x.toFixed(4), y: +y.toFixed(4), w: +w.toFixed(4), h: +h.toFixed(4) };
    };
    const up = () => {
      frame.removeEventListener('pointermove', move);
      frame.removeEventListener('pointerup', up);
      frame.removeEventListener('pointercancel', up);
      if (this.crop.w < 0.02 || this.crop.h < 0.02) this.crop = { x: 0, y: 0, w: 1, h: 1 };
    };
    frame.addEventListener('pointermove', move);
    frame.addEventListener('pointerup', up);
    frame.addEventListener('pointercancel', up);
  };

  private renderStep() {
    const a = this.asset;
    switch (this.step) {
      case 0:
        return html`
          <label class="drop ${this.dragOver ? 'over' : ''}" @dragover=${(e: DragEvent) => { e.preventDefault(); this.dragOver = true; }} @dragleave=${() => (this.dragOver = false)} @drop=${(e: DragEvent) => { e.preventDefault(); this.dragOver = false; void this.onFile(e.dataTransfer?.files[0]); }}>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.dxf,application/pdf,image/png,image/jpeg,image/vnd.dxf" @change=${(e: Event) => void this.onFile((e.target as HTMLInputElement).files?.[0])} />
            <div>
              <div class="ic"><sw-icon name="upload" size=${20}></sw-icon></div>
              <strong>${this.busy ? 'מעלה…' : 'גרור לכאן PDF, תמונה או DXF של התוכנית, או לחץ לבחירה'}</strong>
              <small>PDF עד 20 עמודים, PNG / JPG, DXF (AutoCAD; DWG יש להמיר) · עד 40 MB · הזיהוי לפי תוכן הקובץ · המקור נשמר ללא שינוי</small>
            </div>
          </label>
          ${this.assets.length
            ? html`<div class="assets"><div class="note" style="margin-block-end:4px">קבצים שכבר הועלו לקומה זו:</div>${this.assets.map((x) => html`<button @click=${() => { this.asset = x; this.page = 1; this.step = x.page_count > 1 ? 1 : 2; }}><span>${x.original_name}</span><span class="ltr">${x.page_count} עמ׳ · ${fmtSize(x.bytes)}</span></button>`)}</div>`
            : nothing}`;
      case 1:
        return html`<div class="note">בחר את העמוד שמכיל את התוכנית של הקומה.</div>
          <div class="pages">${a?.pages.map((p) => html`<button class="pg ${p.page === this.page ? 'on' : ''}" @click=${() => (this.page = p.page)}><img src=${resourceUrl(p.preview_url)} alt=${`עמוד ${p.page}`} loading="lazy" />עמוד ${p.page}</button>`)}</div>`;
      case 2: {
        const c = this.crop;
        const full = c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1;
        return html`
          <div class="preview">
            <div class="frame" @pointerdown=${this.startCrop}>
              <img src=${this.previewUrl()} alt="תצוגה מקדימה (אחרי סיבוב)" />
              ${full ? nothing : html`<div class="cropbox" style="left:${c.x * 100}%;top:${c.y * 100}%;width:${c.w * 100}%;height:${c.h * 100}%"></div>`}
              <div class="hint">${full ? 'גרור מלבן על התוכנית כדי לחתוך' : `חיתוך ${Math.round(c.w * 100)}%×${Math.round(c.h * 100)}% · גרור שוב כדי לשנות`}</div>
            </div>
          </div>
          <div class="row">
            <sw-button size="sm" icon="refresh" @click=${() => { this.rotation = (this.rotation + 90) % 360; this.crop = { x: 0, y: 0, w: 1, h: 1 }; }}>סובב 90°</sw-button>
            <sw-badge kind="neutral" label=${`סיבוב ${this.rotation}°`}></sw-badge>
            <sw-button size="sm" variant="ghost" icon="fit" ?disabled=${full} @click=${() => (this.crop = { x: 0, y: 0, w: 1, h: 1 })}>אפס חיתוך</sw-button>
            <span class="note">התצוגה כבר מסובבת; המלבן המקווקו הוא בדיוק מה שיישמר. אפשר גם להזין אחוזים.</span>
          </div>
          <div class="two">
            <sw-field label="שמאל %"><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(c.x * 100))} @change=${(e: Event) => this.setCrop('x', Number((e.target as HTMLInputElement).value))} /></sw-field>
            <sw-field label="עליון %"><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(c.y * 100))} @change=${(e: Event) => this.setCrop('y', Number((e.target as HTMLInputElement).value))} /></sw-field>
            <sw-field label="רוחב %"><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(c.w * 100))} @change=${(e: Event) => this.setCrop('w', Number((e.target as HTMLInputElement).value))} /></sw-field>
            <sw-field label="גובה %"><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(c.h * 100))} @change=${(e: Event) => this.setCrop('h', Number((e.target as HTMLInputElement).value))} /></sw-field>
          </div>`;
      }
      case 3:
        return html`
          <sw-field label="קומה"><input .value=${this.floor?.floor.name ?? ''} disabled /></sw-field>
          <sw-field label="הערות לגרסה (אופציונלי)" hint="למשל: תוכנית מעודכנת אחרי שיפוץ 2026"><input .value=${this.notes} @input=${(e: Event) => (this.notes = (e.target as HTMLInputElement).value)} /></sw-field>
          <div class="note">קנה מידה (מטרים לפיקסל) יכויל בעורך בשתי נקודות ומרחק ידוע; עד אז מרחקים מוצגים כמשוערים.</div>`;
      default:
        return html`
          ${this.version
            ? html`<div class="ok">✓ הגרסה נשמרה (${this.version.width_px}×${this.version.height_px} px) · ${this.version.status === 'published' ? 'פורסמה — היא הרקע של הקומה' : 'טיוטה — עורכי הקומה רואים אותה, צופים עדיין לא'}</div>
                <div class="preview" style="min-block-size:220px"><img src=${resourceUrl(this.version.image_url)} alt="רקע התוכנית" /></div>`
            : html`<div class="note">סיכום: ${a?.original_name} · עמוד ${this.page} · סיבוב ${this.rotation}° · חיתוך ${Math.round(this.crop.w * 100)}%×${Math.round(this.crop.h * 100)}%. השמירה מייצרת רקע נגזר; המקור לא משתנה.</div>`}
          <div class="row">
            ${!this.version ? html`<sw-button variant="primary" icon="check" ?disabled=${this.busy} @click=${() => this.save()}>שמור כטיוטה</sw-button>` : nothing}
            ${this.version && this.version.status === 'draft' ? html`<sw-button variant="primary" icon="check" ?disabled=${this.busy} @click=${() => this.publish()}>פרסום</sw-button>` : nothing}
            ${this.version ? html`<sw-button icon="map" @click=${() => navigate(`/explore/floors/${this.floorId}`)}>פתח במפה</sw-button><sw-button variant="ghost" icon="edit" @click=${() => navigate(`/explore/floors/${this.floorId}/edit`)}>הצב מצלמות</sw-button>` : nothing}
          </div>
          ${a?.kind === 'dxf' ? this.renderDxfMap() : nothing}`;
    }
  }

  private renderDemo() {
    return html`<sw-card><sw-state-panel state="empty" heading="ייבוא תוכנית עובד מול השרת" hint="בתצוגת ההדגמה אין שרת מחובר. בהתקנה ב־Home Assistant המסך מעלה PDF/PNG, בוחר עמוד, מסובב וחותך, ומפרסם גרסה."></sw-state-panel></sw-card>`;
  }

  render() {
    const f = this.floor;
    const canNext = this.step === 0 ? !!this.asset : this.step === 1 ? !!this.asset : true;
    return html`
      <sw-page heading=${f ? `ייבוא תוכנית ל${f.floor.name}` : 'ייבוא תוכנית'} subheading="המקור נשמר ללא שינוי; כל תיקון הוא שכבה נגזרת" crumbs=${f ? `אתרים | ${f.site.name} | ${f.building.name} | ${f.floor.name}` : 'אתרים'}>
        ${!isApi()
          ? this.renderDemo()
          : !this.floorId || (this.tree && !f)
            ? html`<sw-state-panel state="empty" heading="בחר קומה" hint="ייבוא תוכנית מתחיל מדף הקומות."><div style="margin-block-start:10px"><sw-button variant="primary" @click=${() => navigate('/explore/sites')}>לאתרים</sw-button></div></sw-state-panel>`
            : html`
                <sw-card><sw-steps .steps=${STEPS} .current=${this.step}></sw-steps></sw-card>
                <div class="layout">
                  <div class="stage">${this.renderStep()}${this.error ? html`<div class="err">${this.error}</div>` : nothing}</div>
                  <div class="side">
                    <sw-card heading="קובץ">
                      ${this.asset
                        ? html`<div class="note">${this.asset.original_name}</div><div class="row" style="margin-block-start:6px"><sw-badge kind="neutral" label=${`${this.asset.mime.split('/')[1].toUpperCase()} · ${fmtSize(this.asset.bytes)} · ${this.asset.page_count} עמ׳`}></sw-badge></div><div class="note ltr" style="margin-block-start:6px">sha256 ${this.asset.sha256.slice(0, 16)}…</div>`
                        : html`<div class="note">עדיין לא נבחר קובץ.</div>`}
                    </sw-card>
                    ${this.renderDxf()}
                    <sw-card heading="בטיחות">
                      <div class="note">הקובץ מזוהה לפי תוכנו; PDF מרונדר בתהליך נפרד עם מגבלת זמן; SVG נדחה עד sanitization. תוכן טקסטואלי בתוך הקובץ הוא נתון בלבד.</div>
                    </sw-card>
                    <div class="foot">
                      <sw-button variant="ghost" icon="chevron" ?disabled=${this.step === 0 || this.busy} @click=${() => (this.step = Math.max(0, this.step - 1))}>הקודם</sw-button>
                      ${this.step < STEPS.length - 1 ? html`<sw-button variant="primary" ?disabled=${!canNext || this.busy} @click=${() => (this.step = Math.min(STEPS.length - 1, this.step + 1))}>הבא</sw-button>` : nothing}
                    </div>
                  </div>
                </div>`}
      </sw-page>
    `;
  }
}
