import { LitElement, html, css, nothing, svg } from 'lit';
import { bidi, ltrNum } from '../i18n/bidi';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-tabs';
import '../components/sw-scene';
import '../components/sw-floor-iso';
import '../components/sw-field';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { demoRooms } from '../fixtures/demo';
import { navigate } from '../router';
import { createBuilding, createFloor, deleteFloor, loadTree, updateFloor, type CatalogTree } from '../api/catalog';
import { ApiError, describeError } from '../api/client';
import type { Building, Floor, Site } from '../api/types';
import { getGeometry } from '../api/geometry';
import { buildScene, isoPoint, isoProjection, keepIsos, type IsoScene } from '../map/scene-builder';
import { floorLinks, type FloorLinkDoc } from '../map/connector-targets';
import { DEFAULT_FLOOR_HEIGHT_M, floorHeight } from '../map/geometry';

type Dialog = { kind: 'floor' } | { kind: 'rename'; floor: Floor } | { kind: 'delete'; floor: Floor; force: boolean } | { kind: 'building' } | null;

/** SC03 — floor browser (board 1 screen 3) on real catalogue data: add / rename / delete floors, add buildings. */
@customElement('explore-floors')
export class ExploreFloors extends LitElement {
  @property() buildingId = 'bld-a';
  @state() private tree: CatalogTree | null = null;
  @state() private selected: string | null = null;
  @state() private tab = 'floors';
  @state() private dialog: Dialog = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private formName = '';
  @state() private formLevel = 0;
  /** T087: the true isometric of every floor with a published structure, one document read per version (cached here). */
  @state() private isos = new Map<string, IsoScene | null>();
  private isoPending = new Set<string>();
  /** T085: the connectors of each published structure (by version), for the links between floors. */
  @state() private linkDocs = new Map<string, FloorLinkDoc>();

  /** The cache without the versions the tree no longer lists (a republished or deleted floor). */
  private pruned(): Map<string, IsoScene | null> {
    const listed = (this.tree?.sites ?? []).flatMap((s) => (s.buildings ?? []).flatMap((b) => (b.floors ?? []).map((f) => f.published_version_id))).filter((v): v is string => !!v);
    return keepIsos(this.isos, listed);
  }

  private isoFor(f: Floor): IsoScene | null {
    const vid = f.published_version_id;
    if (!vid || this.tree?.source !== 'api') return null;
    if (this.isos.has(vid)) return this.isos.get(vid) ?? null;
    if (this.isoPending.has(vid)) return null;
    this.isoPending.add(vid);
    void getGeometry(vid)
      .then((r) => {
        const desc = buildScene({ doc: r.doc, width: f.plan_width_px || r.doc.dimensions.width_px, height: f.plan_height_px || r.doc.dimensions.height_px, anchors: [], entityStates: {}, circuitStates: {},
          layers: { objects: false, cameras: false, entities: false, zones: false } });
        this.isos = this.pruned().set(vid, desc.parts.some((p) => p.kind === 'wall') ? isoProjection(desc) : null);
        this.linkDocs = new Map(this.linkDocs).set(vid, { floorId: f.id, connectors: r.doc.connectors, levels: r.doc.levels, floorHeightM: floorHeight(r.doc) });
      })
      .catch(() => {
        this.isos = this.pruned().set(vid, null); // no published structure (404) or no permission: the room outlines stay
      })
      .finally(() => this.isoPending.delete(vid));
    return null;
  }

  /** T085: the stacked floors of the building as plates, one above the other by floor number, and a line for every
   * connector linked between two floors, from its position on one plate to its twin's on the other (published
   * structures only). Nothing when no two floors are linked. */
  private renderLinks(floors: Floor[]) {
    const docs = floors.map((f) => (f.published_version_id ? this.linkDocs.get(f.published_version_id) : undefined)).filter((d): d is FloorLinkDoc => !!d);
    const links = floorLinks(docs, floors.map((f) => ({ id: f.id, name: f.name })));
    if (!links.length) return nothing;
    const order = [...floors].sort((a, b) => a.level - b.level || a.sort_order - b.sort_order);
    // the plates are spaced by each floor's height, floor to floor (owner 2026-09-29): 3 m = 34 units
    const UNIT = 34 / 3;
    const heightOf = (f: Floor) => (f.published_version_id ? this.linkDocs.get(f.published_version_id)?.floorHeightM : undefined) ?? DEFAULT_FLOOR_HEIGHT_M;
    const base = new Map<string, number>();
    let acc = 0;
    for (const f of order) {
      base.set(f.id, acc);
      acc += heightOf(f) * UNIT;
    }
    const top = order.length ? base.get(order[order.length - 1].id)! : 0;
    const dy = (floorId: string) => top - (base.get(floorId) ?? 0); // the lowest floor at the bottom
    const pt = (floorId: string, p: [number, number]) => {
      const q = isoPoint(p[0], p[1]);
      return { x: q.x, y: q.y + dy(floorId) };
    };
    const plate = (floorId: string) => [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => pt(floorId, [u, v])).map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
    const height = 72 + top;
    return html`<sw-card heading="קשרים בין קומות" subheading="מדרגות ומעליות שמקשרות קומות (מבנה מפורסם)" data-floor-links>
      <div class="links">
        <svg class="stack" viewBox=${`0 0 120 ${height}`} aria-hidden="true">
          ${order.map((f) => svg`<g data-stack-floor=${f.id}><polygon class="plate" points=${plate(f.id)} /><text class="pname" x="2" y=${(dy(f.id) + 38).toFixed(1)}>${f.name}</text></g>`)}
          ${links.map((l) => {
            const a = pt(l.a.floorId, l.a.at);
            const b = l.b ? pt(l.b.floorId, l.b.at) : null;
            return svg`<g data-stack-link=${l.id}>
              ${b ? svg`<line class="lk" x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y} />` : nothing}
              <circle class="lkdot" cx=${a.x} cy=${a.y} r="2.2" />${b ? svg`<circle class="lkdot" cx=${b.x} cy=${b.y} r="2.2" />` : nothing}
            </g>`;
          })}
        </svg>
        <ul class="lklist">
          ${links.map((l) => html`<li data-link-row=${l.id}>${l.kindLabel}: ${bidi(l.a.label)} ↔ ${bidi(l.b?.label ?? l.farLabel)}${l.b ? '' : ' (התאום עדיין לא פורסם)'}</li>`)}
        </ul>
      </div>
    </sw-card>`;
  }

  static styles = css`
    .links {
      display: flex;
      gap: 18px;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    svg.stack {
      inline-size: 180px;
      block-size: auto;
      overflow: visible;
    }
    svg.stack .plate {
      fill: var(--sw-surface);
      stroke: var(--sw-border-strong);
      stroke-width: 0.8;
    }
    svg.stack .pname {
      font-size: 6px;
      fill: var(--sw-text-3);
    }
    svg.stack .lk {
      stroke: var(--sw-accent);
      stroke-width: 1.4;
      stroke-dasharray: 3 2;
    }
    svg.stack .lkdot {
      fill: var(--sw-accent);
    }
    .lklist {
      margin: 0;
      padding-inline-start: 18px;
      font-size: var(--sw-fs-sm);
      display: grid;
      gap: 4px;
    }
    .pic {
      inline-size: 112px;
      block-size: 72px;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      position: relative;
      box-shadow: var(--sw-shadow-1);
    }
    .pic sw-scene {
      position: absolute;
      inset: 0;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-inline-size: 720px;
    }
    .floor {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 14px;
      border: 1.5px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      text-align: start;
      font: inherit;
      color: inherit;
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    .floor:hover {
      border-color: var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
    }
    .floor.on {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .floor .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .title {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
    }
    .counts {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .counts .shared {
      color: var(--sw-accent);
    }
    .chev {
      color: var(--sw-text-3);
    }
    .floor.on .chev {
      color: var(--sw-accent);
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .actions div {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .empty {
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      padding: 24px;
      text-align: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
      max-inline-size: 520px;
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
    }
    .cams {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.reload();
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('buildingId') && changed.get('buildingId') !== undefined) this.selected = null;
  }

  private async reload() {
    try {
      this.tree = await loadTree();
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private get context(): { site: Site; building: Building } | null {
    if (!this.tree) return null;
    for (const site of this.tree.sites) for (const b of site.buildings ?? []) if (b.id === this.buildingId) return { site, building: b };
    const site = this.tree.sites[0];
    const building = site?.buildings?.[0];
    return site && building ? { site, building } : null;
  }

  private async run(action: () => Promise<unknown>) {
    this.busy = true;
    this.error = '';
    try {
      await action();
      this.dialog = null;
      await this.reload();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'has_anchors' && this.dialog?.kind === 'delete') {
        this.dialog = { ...this.dialog, force: true };
        this.error = `${err.body.user_message} (${(err.body.details as { anchors?: number }).anchors ?? ''} פריטים)`;
      } else this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private openDialog(d: Dialog) {
    this.error = '';
    this.formName = d?.kind === 'rename' ? d.floor.name : '';
    this.formLevel = d?.kind === 'rename' ? d.floor.level : 0;
    this.dialog = d;
  }

  private renderDialog(building: Building) {
    const d = this.dialog;
    if (!d) return nothing;
    const demo = this.tree?.source === 'demo';
    const nameField = html`<sw-field label="שם"><input .value=${this.formName} @input=${(e: Event) => (this.formName = (e.target as HTMLInputElement).value)} placeholder="למשל: קומה 1" autofocus /></sw-field>`;
    const levelField = html`<sw-field label="מפלס (0 = קרקע, שלילי = מרתף)" hint="קובע את סדר התצוגה בין הקומות"><input type="number" data-ltr .value=${String(this.formLevel)} @input=${(e: Event) => (this.formLevel = Number((e.target as HTMLInputElement).value))} /></sw-field>`;
    const errorLine = this.error ? html`<div class="err">${this.error}</div>` : nothing;
    const demoLine = demo ? html`<div class="err">נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.</div>` : nothing;
    switch (d.kind) {
      case 'floor':
        return html`<sw-dialog open heading="קומה חדשה" subheading=${`${building.name}`} @close=${() => (this.dialog = null)}>
          ${nameField}${levelField}${errorLine}${demoLine}
          <sw-button slot="footer" variant="ghost" @click=${() => (this.dialog = null)}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim() || this.busy || demo} @click=${() => this.run(async () => { const f = await createFloor(building.id, { name: this.formName.trim(), level: this.formLevel }); this.selected = f.id; })}>הוסף קומה</sw-button>
        </sw-dialog>`;
      case 'rename':
        return html`<sw-dialog open heading="עריכת קומה" subheading=${d.floor.name} @close=${() => (this.dialog = null)}>
          ${nameField}${levelField}${errorLine}${demoLine}
          <sw-button slot="footer" variant="ghost" @click=${() => (this.dialog = null)}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim() || this.busy || demo} @click=${() => this.run(() => updateFloor(d.floor.id, { name: this.formName.trim(), level: this.formLevel }))}>שמירה</sw-button>
        </sw-dialog>`;
      case 'delete':
        return html`<sw-dialog open heading="מחיקת קומה" subheading=${d.floor.name} @close=${() => (this.dialog = null)}>
          <div style="font-size:var(--sw-fs-sm)">${d.force ? 'על הקומה מוצבים פריטים. מחיקה תסיר אותם מהמפה (ההיסטוריה נשמרת באודיט). להמשיך?' : 'הקומה תוסר מהמערכת. תוכניות שפורסמו נשמרות בארכיון; מצלמות והקלטות ב־NVR אינן נמחקות.'}</div>
          ${errorLine}${demoLine}
          <sw-button slot="footer" variant="ghost" @click=${() => (this.dialog = null)}>ביטול</sw-button>
          <sw-button slot="footer" variant="danger" ?disabled=${this.busy || demo} @click=${() => this.run(async () => { await deleteFloor(d.floor.id, d.force); if (this.selected === d.floor.id) this.selected = null; })}>${d.force ? 'מחק כולל הפריטים' : 'מחק קומה'}</sw-button>
        </sw-dialog>`;
      case 'building':
        return html`<sw-dialog open heading="מבנה חדש" subheading=${this.context?.site.name ?? ''} @close=${() => (this.dialog = null)}>
          ${nameField}${errorLine}${demoLine}
          <sw-button slot="footer" variant="ghost" @click=${() => (this.dialog = null)}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim() || this.busy || demo} @click=${() => this.run(async () => { const b = await createBuilding(this.context!.site.id, { name: this.formName.trim() }); navigate(`/explore/buildings/${b.id}/floors`); })}>הוסף מבנה</sw-button>
        </sw-dialog>`;
    }
  }

  render() {
    if (!this.tree) return html`<sw-page heading="קומות"><sw-state-panel state=${this.error ? 'error' : 'loading'} hint=${this.error}></sw-state-panel></sw-page>`;
    const ctx = this.context;
    if (!ctx) {
      return html`<sw-page heading="קומות" subheading="אין עדיין אתרים ומבנים">
        <sw-state-panel state="empty" heading="עוד אין מבנים" hint="צור אתר ומבנה כדי להוסיף קומות ותוכניות.">
          <div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${() => navigate('/explore/sites')}>לאתרים</sw-button></div>
        </sw-state-panel>
      </sw-page>`;
    }
    const { site, building } = ctx;
    const floors = building.floors ?? [];
    const sel = floors.find((f) => f.id === this.selected) ?? floors[0] ?? null;
    const totalCams = floors.reduce((n, f) => n + f.camera_count, 0);
    const tree = this.tree;
    return html`
      <sw-page heading=${building.name} subheading=${`${site.address || site.name} · ${floors.length} קומות${tree.source === 'demo' ? ' · נתוני הדגמה' : ''}`} crumbs=${`אתרים | ${site.name} | ${building.name}`}>
        <div slot="actions" class="pic"><sw-scene kind="building"></sw-scene></div>
        <sw-tabs .items=${[{ id: 'floors', label: 'קומות', count: floors.length }, { id: 'cameras', label: 'מצלמות', count: totalCams }, { id: 'details', label: 'פרטים' }]} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
        ${this.tab === 'floors'
          ? html`<div class="list">
              ${floors.length ? nothing : html`<div class="empty">למבנה הזה אין עדיין קומות. הוסף קומה, ואז העלה תוכנית (PDF או תמונה).</div>`}
              ${floors.map(
                (f) => html`<button class="floor ${sel?.id === f.id ? 'on' : ''}" @click=${() => (sel?.id === f.id ? navigate(`/explore/floors/${f.id}`) : (this.selected = f.id))} aria-pressed=${sel?.id === f.id}>
                  <div class="txt">
                    <div class="title">${bidi(f.name)}</div>
                    <div class="counts">${f.camera_count} מצלמות${f.shared_camera_count ? html` <span class="shared" data-floor-shared=${f.id}>(+${f.shared_camera_count} משותפות)</span>` : nothing} · ${f.anchor_count} פריטים במפה · מפלס ${ltrNum(f.level)}${f.has_plan ? '' : ' · אין תוכנית עדיין'}${f.draft_version_id ? ' · טיוטה ממתינה לפרסום' : ''}</div>
                  </div>
                  <sw-floor-iso data-floor-iso=${f.id} .rooms=${tree.source === 'demo' ? demoRooms(f.id) : []} .iso=${this.isoFor(f)} ?selected=${sel?.id === f.id} ?empty=${!f.has_plan} width=${128}></sw-floor-iso>
                  <span class="chev"><sw-icon name="chevron" size=${16}></sw-icon></span>
                </button>`,
              )}
              ${this.renderLinks(floors)}
              ${this.error && !this.dialog ? html`<div class="err">${this.error}</div>` : nothing}
              <div class="actions">
                <div>
                  <sw-button icon="plus" @click=${() => this.openDialog({ kind: 'floor' })}>קומה חדשה</sw-button>
                  <sw-button variant="ghost" icon="building" @click=${() => this.openDialog({ kind: 'building' })}>מבנה חדש</sw-button>
                </div>
                ${sel
                  ? html`<div>
                      <sw-button variant="ghost" icon="edit" @click=${() => this.openDialog({ kind: 'rename', floor: sel })}>עריכה</sw-button>
                      <sw-button variant="ghost" icon="trash" @click=${() => this.openDialog({ kind: 'delete', floor: sel, force: false })}>מחיקה</sw-button>
                      <sw-button icon="upload" @click=${() => navigate(`/explore/floors/${sel.id}/import`)}>${sel.has_plan ? 'תוכנית חדשה' : 'העלאת תוכנית'}</sw-button>
                      <sw-button variant="primary" icon="map" @click=${() => navigate(`/explore/floors/${sel.id}`)}>פתח את ${sel.name}</sw-button>
                    </div>`
                  : nothing}
              </div>
            </div>`
          : this.tab === 'cameras'
            ? html`<div class="cams">${floors.map((f) => html`<sw-card heading=${bidi(f.name)} subheading="${f.camera_count} מצלמות" interactive @click=${() => navigate(`/explore/floors/${f.id}`)}></sw-card>`)}</div>`
            : html`<sw-card heading="פרטי המבנה">
                <dl>
                  <dt>אתר</dt><dd>${site.name}</dd>
                  <dt>כתובת</dt><dd>${site.address || '—'}</dd>
                  <dt>אזור זמן</dt><dd><span class="ltr">${site.timezone}</span></dd>
                  <dt>קומות</dt><dd>${floors.length} · ${floors.filter((f) => f.has_plan).length} עם תוכנית מפורסמת</dd>
                  <dt>קשרים בין קומות</dt><dd>מדרגות ומעלית בין קומות מוגדרות בעורך התוכנית ("מחבר אל"); הקשרים שפורסמו מופיעים בלשונית הקומות</dd>
                </dl>
              </sw-card>`}
        ${this.renderDialog(building)}
      </sw-page>
    `;
  }
}
