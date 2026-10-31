import { LitElement, html, css, nothing, svg } from 'lit';
import { bidi, ltrNum } from '../i18n/bidi';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import { openArchitectRequest } from '../components/architect-request-dialog';
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
import { PhoneWidth } from '../shell/phone';
import { canAnywhere, isApi } from '../api/session';
import { parseRoute } from '../router';
import { xt } from '../i18n/xsection';
import '../xsection/sw-xsection';
import { xsTile, xsTileStyles, type RowBox } from '../xsection/sw-xsection';
import '../xsection/sw-floor-home-link';
import { demoBuilding, demoSignals, demoTree, loadXsData, matchContext, sectionLinksOf, type XsData } from '../xsection/xs-data';
import type { HomeLinks } from '../api/catalog';
import { fireReport, onFire, setFireMock } from '../xsection/fire-store';
import { linksFold, listStep, nearFloors, onXsOptions, phonePlaceFor, signalsOf, xsFromParams, xsOptions, type FloorSignal, type XsOptions } from '../xsection/xs-model';

type Dialog = { kind: 'floor' } | { kind: 'rename'; floor: Floor } | { kind: 'delete'; floor: Floor; force: boolean } | { kind: 'building' } | { kind: 'home'; floor: Floor } | null;

/** SC03 — floor browser (board 1 screen 3) on real catalogue data: add / rename / delete floors, add buildings. */
@customElement('explore-floors')
export class ExploreFloors extends LitElement {
  /** Owner decision 2026-09-30 (option ui.mobile hide_structure, default on): no structure management on a phone (new floor / building, rename, delete, plan upload). A UX guard only; the server enforces permissions. */
  private readonly phone = new PhoneWidth(this);
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
  /** 2.29.0: the building cross-section - the installation's options (ui.xs), the per-floor signals' sources, the phone sheet, and the row / card hover that links the two. */
  @state() private xsData: XsData | null = null;
  @state() private sheetOpen = false;
  @state() private hoverId: string | null = null;
  private stopXs?: () => void;
  private stopFire?: () => void;
  /** T085: the connectors of each published structure (by version), for the links between floors. */
  @state() private linkDocs = new Map<string, FloorLinkDoc>();
  /** SYNOPTIC-HA-2310: where each floor card sits in its column, so the section's rows line up with the cards (null = not aligned). */
  @state() private rowBoxes: RowBox[] | null = null;
  @state() private boxesHeight = 0;
  private cardsObs?: ResizeObserver;
  private cardsEl: Element | null = null;

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

  static styles = [xsTileStyles, css`
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
    /* R5-MAPS-297 (impeccable bolder, HOMEFABLE pattern): the floor rows are the hero objects - large radius, a 17/700 heading, the
       counts as a 13/500 line with tabular digits; the selected floor is a FILLED accent field with the accent edge and shadow 2
       (not a 3 px halo around a white card). Press on pointer-down; hover only with a fine pointer. */
    .pic {
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-2);
    }
    .floor {
      padding: 12px 16px;
      border-color: transparent;
      border-radius: var(--sw-r-lg);
      transition: border-color var(--sw-t-hover) var(--sw-ease-color), background var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
    }
    .floor:active {
      transform: scale(var(--sw-press-scale));
    }
    .floor.on {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      box-shadow: var(--sw-shadow-2);
    }
    @media (hover: none) {
      .floor:hover {
        border-color: transparent;
        box-shadow: var(--sw-shadow-1);
      }
      .floor.on:hover {
        border-color: var(--sw-accent);
        box-shadow: var(--sw-shadow-2);
      }
    }
    .title {
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      letter-spacing: -0.01em;
    }
    .floor.on .title {
      color: var(--sw-accent-text);
    }
    .counts {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
      margin-block-start: 4px;
      font-variant-numeric: tabular-nums;
    }
    .floor.on .counts {
      color: var(--sw-text);
    }
    .empty {
      background: var(--sw-surface-2);
      font-weight: var(--sw-fw-medium);
    }
    dd {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    dt {
      color: var(--sw-text-2);
    }
    /* R5-MAPS-297 loop 2: three steps, not one - the unselected floors are WELLS (surface 2, no shadow, no edge), the selected floor is the
       one hero (accent field, 2 px accent edge, shadow 2), the heading 20/700 and the counts 14/500 with 700 digits. */
    .floor {
      background: var(--sw-surface-2);
      box-shadow: none;
      border-width: 2px;
      padding: 14px 18px;
    }
    .floor.on {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      box-shadow: var(--sw-shadow-2);
    }
    @media (hover: hover) and (pointer: fine) {
      .floor:hover:not(.on) {
        background: var(--sw-surface-3);
        border-color: transparent;
        box-shadow: none;
      }
    }
    .title {
      font-size: var(--sw-fs-2xl);
      /* break-ui (shots/final/floors-worst-*): a 90-character unbreakable name ran out of the row; a name wraps to two lines at most */
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .counts {
      overflow-wrap: anywhere;
    }
    .counts {
      font-size: var(--sw-fs-md);
    }
    .pic {
      inline-size: 124px;
      block-size: 80px;
    }
    /* 2.29.0: the cross-section beside the list. The list is frozen (no scroll): its cards share the height and shrink in steps; the section takes the free area. */
    :host {
      display: block;
      block-size: 100%;
    }
    sw-page {
      block-size: 100%;
      box-sizing: border-box;
    }
    .tabsrow {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .fl {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
      min-block-size: 0;
      block-size: 100%;
    }
    .fl.beside {
      grid-template-columns: minmax(0, 720px) minmax(0, 1fr);
    }
    .fl.beside.right .xscol {
      order: -1;
    }
    .xscol {
      min-inline-size: 0;
      min-block-size: 0;
      block-size: 100%;
      max-block-size: 100%;
    }
    @media (max-width: 1023px) {
      .fl.beside {
        grid-template-columns: minmax(0, 1fr) minmax(0, 300px);
      }
    }
    .list {
      min-block-size: 0;
      max-inline-size: none;
    }
    .cards {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-block-size: 0;
    }
    .cards[data-cols='2'] {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .frow {
      display: flex;
      gap: 8px;
      align-items: stretch;
    }
    .frow > .floor {
      flex: 1;
      min-inline-size: 0;
    }
    .floor.hl:not(.on) {
      background: var(--sw-surface-3);
    }
    /* the steps: the more floors, the smaller the card (no scrolling) */
    .cards[data-step='1'] { gap: 8px; }
    .cards[data-step='1'] .floor { padding: 10px 16px; }
    .cards[data-step='1'] .title { font-size: var(--sw-fs-xl); }
    .cards[data-step='1'] .counts { font-size: var(--sw-fs-sm); }
    .cards[data-step='1'] sw-floor-iso { display: none; }
    .cards[data-step='2'] { gap: 6px; }
    .cards[data-step='2'] .floor { padding: 7px 14px; border-radius: var(--sw-r-md); }
    .cards[data-step='2'] .title { font-size: var(--sw-fs-lg); }
    .cards[data-step='2'] .counts { font-size: var(--sw-fs-xs); }
    .cards[data-step='2'] sw-floor-iso, .cards[data-step='2'] .chev { display: none; }
    .cards[data-step='3'] { gap: 4px; }
    .cards[data-step='3'] .floor { padding: 4px 12px; border-radius: var(--sw-r-sm); border-width: 1.5px; }
    .cards[data-step='3'] .title { font-size: var(--sw-fs-md); -webkit-line-clamp: 1; line-clamp: 1; }
    .cards[data-step='3'] .counts, .cards[data-step='3'] sw-floor-iso, .cards[data-step='3'] .chev { display: none; }
    .linkrow {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .linkrow .lt { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); white-space: nowrap; }
    .linkrow .ll { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* SYNOPTIC-HA-2310: the column has the page's height and the cards give way inside it (they shrank in steps but could still run under
       the actions at 12 floors); the section's rows follow the cards' boxes, so both columns keep one rhythm. */
    .fl.beside { grid-template-rows: minmax(0, 1fr); }
    .fl.beside .list { min-block-size: 0; }
    .fl.beside .cards { flex: 0 1 auto; }
    .fl.beside .cards > .floor { flex: 0 1 auto; min-block-size: 0; overflow: hidden; }
    .xssheet { block-size: min(72dvh, 640px); min-block-size: 360px; }
    .xsbtn { margin-inline-start: auto; }
    @media (max-width: 767px) {
      .fl { block-size: auto; }
      .floor { padding: 10px 12px; gap: 10px; }
      .frow .floor sw-floor-iso { display: none; }
      .frow .floor .chev { display: none; }
      .title { font-size: var(--sw-fs-xl); }
      .counts { font-size: var(--sw-fs-sm); }
      .cards[data-step='1'] .title, .cards[data-step='2'] .title { font-size: var(--sw-fs-md); }
      .cards[data-step='3'] .title { font-size: var(--sw-fs-sm); }
      .xscol { display: none; }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.reload();
    this.stopXs = onXsOptions(() => this.requestUpdate());
    this.stopFire = onFire(() => this.requestUpdate());
    void loadXsData().then((d) => (this.xsData = d));
  }

  disconnectedCallback() {
    this.cardsObs?.disconnect();
    this.cardsObs = undefined;
    this.cardsEl = null;
    this.stopXs?.();
    this.stopFire?.();
    super.disconnectedCallback();
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('buildingId') && changed.get('buildingId') !== undefined) this.selected = null;
    this.watchCards();
    this.measureCards();
    this.openHomeFromRoute();
  }

  /** `?ha=<floor id>` (the synoptic's "link the floors" hint): opens that floor's home-system link once. */
  private homeRouteDone = '';
  private openHomeFromRoute() {
    const want = parseRoute().params.get('ha');
    if (!want || want === this.homeRouteDone || !this.tree) return;
    const ctx = this.context;
    const b = ctx && this.demoN() ? demoBuilding(this.demoN(), ctx.building) : ctx?.building;
    const f = b?.floors?.find((x) => x.id === want);
    this.homeRouteDone = want;
    if (f && !this.dialog) this.openDialog({ kind: 'home', floor: f });
  }

  /** SYNOPTIC-HA-2310: the card column is observed, so a resize (window, density step, a name that wraps) re-measures the boxes. */
  private watchCards() {
    const el = this.renderRoot.querySelector('.cards[data-align]');
    if (el === this.cardsEl) return;
    this.cardsObs?.disconnect();
    this.cardsEl = el;
    if (!el) {
      if (this.rowBoxes) this.rowBoxes = null;
      return;
    }
    this.cardsObs ??= new ResizeObserver(() => this.measureCards());
    this.cardsObs.observe(el);
    el.querySelectorAll('[data-floor-card]').forEach((c) => this.cardsObs!.observe(c));
  }

  /** The boxes of the cards relative to their column (rounded to a pixel); the section's rows take the same top and height. */
  private measureCards() {
    const el = this.cardsEl;
    if (!el) return;
    const base = el.getBoundingClientRect();
    const boxes: RowBox[] = [...el.querySelectorAll<HTMLElement>('[data-floor-card]')].map((c) => {
      const r = c.getBoundingClientRect();
      return { id: c.dataset.floorCard!, top: Math.round(r.top - base.top), height: Math.round(r.height) };
    });
    const h = Math.round(base.height);
    const same = this.rowBoxes && this.rowBoxes.length === boxes.length && this.rowBoxes.every((b, i) => b.id === boxes[i].id && b.top === boxes[i].top && b.height === boxes[i].height);
    if (!same) this.rowBoxes = boxes;
    if (h !== this.boxesHeight) this.boxesHeight = h;
  }

  /** The options in force: the installation's (ui.xs); the static demo and the specs may override single options from the route (`?xs_phone_place=card`). */
  private xsEff(): XsOptions {
    return isApi() ? xsOptions() : xsFromParams(xsOptions(), parseRoute().params);
  }

  /** `?xsdemo=16` (static demo only): a synthetic building of N floors, for the many-floor layouts. */
  private demoN(): number {
    if (isApi()) return 0;
    const n = Number(parseRoute().params.get('xsdemo'));
    return Number.isInteger(n) && n >= 1 && n <= 40 ? n : 0;
  }

  /** Does the section sit beside the list (a computer or a tablet, option not off)? Then the building drawing makes room for it. */
  private sectionBeside(): boolean {
    return !this.phone.matches && this.xsEff().desktop_place !== 'off';
  }

  /** `?xsdata=ha|none` (static demo only): the floors run through the real home-system matching against a synthetic tree. */
  private demoData(): string | null {
    return isApi() ? null : parseRoute().params.get('xsdata');
  }

  private signalsFor(floors: Floor[]): FloorSignal[] {
    if (!isApi() || this.xsData?.demo) return demoSignals([...floors].sort((a, b) => b.level - a.level || b.sort_order - a.sort_order), this.demoData());
    return signalsOf(floors, this.xsData?.tree ?? null, this.xsData?.people ?? null, matchContext(this.xsData, this.context?.site));
  }

  /** A card or a section row was pressed: the first press selects, a second press on the selected floor opens its map (option click = open: at once). */
  private pickFloor(id: string, fromSection = false) {
    const open = this.selected === id || (fromSection && this.xsEff().click === 'open');
    if (open) navigate(`/explore/floors/${id}`);
    else this.selected = id;
  }

  private linksFor(floors: Floor[]) {
    const docs = floors.map((f) => (f.published_version_id ? this.linkDocs.get(f.published_version_id) : undefined)).filter((d): d is FloorLinkDoc => !!d);
    return floorLinks(docs, floors.map((f) => ({ id: f.id, name: f.name })));
  }

  /** The floors tab: the frozen list of cards (shrinking in steps, never scrolling), the links, the actions - and the cross-section in the free area. */
  private renderFloorsTab(floors: Floor[], sel: Floor | null, demo: boolean) {
    const tree = this.tree!;
    const o = this.xsEff();
    const phone = this.phone.matches;
    const sigs = this.signalsFor(floors);
    const sigOf = new Map(sigs.map((x) => [x.id, x]));
    const links = this.linksFor(floors);
    const secLinks = links.length ? sectionLinksOf(links) : demo || !isApi() ? [{ kind: 'stairs' as const, label: 'מדרגות', floors: sigs.map((x) => x.id) }] : [];
    const mock = parseRoute().params.get('firemock');
    if (o.fire_ui) setFireMock(mock, sigs);
    else setFireMock(null);
    const fire = o.fire_ui ? fireReport().floors : null;
    const place = phone ? phonePlaceFor(o.phone_place, floors.length) : 'none';
    const { step, cols } = listStep(floors.length, phone);
    const shown = o.many === 'near' ? nearFloors(floors, sel?.id ?? null, 2) : floors;
    const folded = linksFold(o.links, floors.length, window.innerHeight) || phone;
    const withTile = phone && place === 'side';
    // SYNOPTIC-HA-2310: beside the list, one column of cards and every floor shown - the section's rows take the cards' boxes
    const aligns = this.sectionBeside() && cols === 1 && shown.length === floors.length;
    const canLink = !this.phone.restricted('structure') && (!isApi() || canAnywhere('site.content.configure'));
    const cards = shown.map((f) => {
      const card = html`<button class="floor ${sel?.id === f.id ? 'on' : ''} ${this.hoverId === f.id ? 'hl' : ''}" data-floor-card=${f.id} @click=${() => this.pickFloor(f.id)} @pointerenter=${(e: PointerEvent) => e.pointerType === 'mouse' && (this.hoverId = f.id)} @pointerleave=${(e: PointerEvent) => e.pointerType === 'mouse' && (this.hoverId = null)} aria-pressed=${sel?.id === f.id}>
        <div class="txt">
          <div class="title">${bidi(f.name)}</div>
          <div class="counts">${f.camera_count} מצלמות${f.shared_camera_count ? html` <span class="shared" data-floor-shared=${f.id}>(+${f.shared_camera_count} משותפות)</span>` : nothing} · ${f.anchor_count} פריטים במפה · מפלס ${ltrNum(f.level)}${f.has_plan ? '' : ' · אין תוכנית עדיין'}${f.draft_version_id ? ' · טיוטה ממתינה לפרסום' : ''}</div>
        </div>
        <sw-floor-iso data-floor-iso=${f.id} .rooms=${tree.source === 'demo' ? demoRooms(f.id) : []} .iso=${this.isoFor(f)} ?selected=${sel?.id === f.id} ?empty=${!f.has_plan} width=${128}></sw-floor-iso>
        <span class="chev"><sw-icon name="chevron" size=${16}></sw-icon></span>
      </button>`;
      const sg = sigOf.get(f.id);
      return withTile && sg ? html`<div class="frow">${card}${xsTile(sg, o, sel?.id === f.id, () => this.pickFloor(f.id))}</div>` : card;
    });
    const actions = html`<div class="actions" data-floor-actions>
      ${this.phone.restricted('structure')
        ? nothing
        : html`<div>
            <sw-button icon="plus" @click=${() => this.openDialog({ kind: 'floor' })}>קומה חדשה</sw-button>
            <sw-button variant="ghost" icon="building" @click=${() => this.openDialog({ kind: 'building' })}>מבנה חדש</sw-button>
          </div>`}
      ${sel
        ? html`<div>
            ${this.phone.restricted('structure')
              ? nothing
              : html`<sw-button variant="ghost" icon="edit" @click=${() => this.openDialog({ kind: 'rename', floor: sel })}>עריכה</sw-button>
                <sw-button variant="ghost" icon="link" data-home-link-btn @click=${() => this.openDialog({ kind: 'home', floor: sel })}>${xt('homeLinkBtn')}</sw-button>
                <sw-button variant="ghost" icon="trash" @click=${() => this.openDialog({ kind: 'delete', floor: sel, force: false })}>מחיקה</sw-button>
                <sw-button icon="upload" @click=${() => navigate(`/explore/floors/${sel.id}/import`)}>${sel.has_plan ? 'תוכנית חדשה' : 'העלאת תוכנית'}</sw-button>`}
            ${sel.has_plan || sel.draft_version_id ? nothing : html`<sw-button variant="ghost" icon="mail" data-architect-request @click=${() => openArchitectRequest()}>בקשה לאדריכל</sw-button>`}
            <sw-button variant="primary" icon="map" @click=${() => navigate(`/explore/floors/${sel.id}`)}>פתח את ${sel.name}</sw-button>
          </div>`
        : nothing}
    </div>`;
    const section = html`<sw-xsection .floors=${sigs} .links=${secLinks} .opts=${o} .fire=${fire} selectedId=${sel?.id ?? ''} hoverId=${this.hoverId ?? ''}
      .rowBoxes=${aligns ? this.rowBoxes : null} boxesHeight=${aligns ? this.boxesHeight : 0} ?canLink=${canLink}
      @xs-link=${(e: CustomEvent<{ id: string }>) => { const f = floors.find((x) => x.id === e.detail.id); if (f) this.openDialog({ kind: 'home', floor: f }); }}
      @xs-pick=${(e: CustomEvent<{ id: string }>) => this.pickFloor(e.detail.id, true)} @xs-hover=${(e: CustomEvent<{ id: string | null }>) => (this.hoverId = e.detail.id)}></sw-xsection>`;
    const beside = this.sectionBeside();
    const list = html`<div class="list" data-floor-list data-step=${step} data-cols=${cols} data-many=${o.many}>
      ${floors.length ? nothing : html`<div class="empty">${this.phone.restricted('structure') ? 'למבנה הזה אין עדיין קומות. הוספת קומות ותוכניות זמינה במחשב.' : 'למבנה הזה אין עדיין קומות. הוסף קומה, ואז העלה תוכנית (PDF או תמונה).'}<div style="margin-block-start:10px"><sw-button variant="ghost" icon="mail" data-architect-request @click=${() => openArchitectRequest()}>בקשה לאדריכל</sw-button></div></div>`}
      ${phone && place === 'card' ? html`<sw-xs-compact .floors=${sigs} .opts=${o} selectedId=${sel?.id ?? ''} @xs-open-sheet=${() => (this.sheetOpen = true)}></sw-xs-compact>` : nothing}
      <div class="cards" data-step=${step} data-cols=${cols} ?data-align=${aligns}>${cards}</div>
      ${folded ? this.renderLinksFolded(links) : this.renderLinks(floors)}
      ${this.error && !this.dialog ? html`<div class="err">${this.error}</div>` : nothing}
      ${actions}
    </div>`;
    return html`<div class="fl ${beside ? `beside ${o.desktop_place}` : ''}" data-xs-place=${phone ? place : beside ? o.desktop_place : 'off'}>
      ${list}
      ${beside ? html`<aside class="xscol" data-xs-col>${section}</aside>` : nothing}
      ${this.sheetOpen && phone && floors.length
        ? html`<sw-dialog open heading=${xt('sectionSheetTitle')} data-xs-sheet @close=${() => (this.sheetOpen = false)}>
            <div class="xssheet">${section}</div>
            <sw-button slot="footer" variant="ghost" @click=${() => (this.sheetOpen = false)}>${xt('close')}</sw-button>
          </sw-dialog>`
        : nothing}
    </div>`;
  }

  /** "Links between floors" folded to one row (option A, when space is short): the lines are drawn on the section instead. */
  private renderLinksFolded(links: ReturnType<typeof floorLinks>) {
    if (!links.length) return nothing;
    return html`<div class="linkrow" data-floor-links-folded><sw-icon name="layers" size=${14}></sw-icon><span class="lt">${xt('linksTitle')}</span>
      <span class="ll">${links.map((l) => `${l.kindLabel}: ${l.a.label} ↔ ${l.b?.label ?? l.farLabel}${l.b ? '' : ` ${xt('linksPending')}`}`).join(' · ')}</span></div>`;
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
    if (this.phone.restricted('structure')) return;
    this.error = '';
    this.formName = d?.kind === 'rename' ? d.floor.name : '';
    this.formLevel = d?.kind === 'rename' ? d.floor.level : 0;
    this.dialog = d;
  }

  private renderDialog(building: Building) {
    const d = this.dialog;
    if (!d || this.phone.restricted('structure')) return nothing;
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
      case 'home': {
        const floors = building.floors ?? [];
        const tree = demo || !isApi() ? demoTree(floors, this.demoData() === 'none' ? 'none' : 'ha') : this.xsData?.tree ?? null;
        const names = new Map((this.tree?.sites ?? []).flatMap((s) => (s.buildings ?? []).flatMap((b) => (b.floors ?? []).map((x) => [x.id, (s.buildings?.length ?? 0) > 1 ? `${b.name} · ${x.name}` : x.name] as [string, string]))));
        return html`<sw-floor-home-link .floor=${d.floor} .floors=${floors} .floorNames=${names} .tree=${tree} .links=${this.xsData?.links ?? null}
          ?singleBuilding=${matchContext(this.xsData, this.context?.site).singleBuilding} ?demo=${demo || !isApi()}
          @close=${() => (this.dialog = null)}
          @saved=${(e: CustomEvent<{ links: HomeLinks }>) => { this.dialog = null; if (this.xsData) this.xsData = { ...this.xsData, links: e.detail.links }; void loadXsData().then((x) => (this.xsData = x)); }}></sw-floor-home-link>`;
      }
      case 'building':
        return html`<sw-dialog open heading="מבנה חדש" subheading=${this.context?.site.name ?? ''} @close=${() => (this.dialog = null)}>
          ${nameField}${errorLine}${demoLine}
          <sw-button slot="footer" variant="ghost" @click=${() => (this.dialog = null)}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim() || this.busy || demo} @click=${() => this.run(async () => { const b = await createBuilding(this.context!.site.id, { name: this.formName.trim() }); navigate(`/explore/buildings/${b.id}/floors`); })}>הוסף מבנה</sw-button>
        </sw-dialog>`;
    }
  }

  render() {
    if (!this.tree) return html`<sw-page heading="קומות"><sw-state-panel icon="floor" state=${this.error ? 'error' : 'loading'} hint=${this.error}></sw-state-panel></sw-page>`;
    const ctx = this.context;
    if (!ctx) {
      return html`<sw-page heading="קומות" subheading="אין עדיין אתרים ומבנים">
        <sw-state-panel icon="floor" state="empty" heading="עוד אין מבנים" hint="צור אתר ומבנה כדי להוסיף קומות ותוכניות.">
          <div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${() => navigate('/explore/sites')}>לאתרים</sw-button></div>
        </sw-state-panel>
      </sw-page>`;
    }
    const { site } = ctx;
    const building = this.demoN() ? demoBuilding(this.demoN(), ctx.building, parseRoute().params.get('xsnames') === 'long') : ctx.building;
    const floors = building.floors ?? [];
    const sel = floors.find((f) => f.id === this.selected) ?? floors[0] ?? null;
    const totalCams = floors.reduce((n, f) => n + f.camera_count, 0);
    const tree = this.tree;
    return html`
      <sw-page heading=${building.name} subheading=${`${site.address || site.name} · ${floors.length} קומות${tree.source === 'demo' ? ' · נתוני הדגמה' : ''}`} crumbs=${`אתרים | ${site.name} | ${building.name}`}>
        ${this.sectionBeside() ? nothing : html`<div slot="actions" class="pic"><sw-scene kind="building"></sw-scene></div>`}
        <div class="tabsrow"><sw-tabs .items=${[{ id: 'floors', label: 'קומות', count: floors.length }, { id: 'cameras', label: 'מצלמות', count: totalCams }, { id: 'details', label: 'פרטים' }]} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
          ${this.phone.matches && this.tab === 'floors' && this.xsEff().phone_place === 'sheet' && floors.length ? html`<sw-button class="xsbtn" size="sm" variant="ghost" data-xs-sheet-btn @click=${() => (this.sheetOpen = true)}>${xt('sectionOpenBtn')}</sw-button>` : nothing}
        </div>
        ${this.tab === 'floors'
          ? this.renderFloorsTab(floors, sel, tree.source === 'demo')
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
