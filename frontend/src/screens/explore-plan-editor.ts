import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-toggle';
import '../map/sw-plan-canvas';
import type { PlanMarker, MarkerSelectDetail, PlanZone, SwPlanCanvas } from '../map/sw-plan-canvas';
import type { IconName } from '../components/sw-icon';
import { navigate } from '../router';
import { cameraState, createAnchor, deleteAnchor, loadMap, publishVersion, updateAnchor, type MapBundle } from '../api/maps';
import { ApiError, describeError } from '../api/client';
import type { Anchor, Camera } from '../api/types';
import { domainLabel, entityMarkerKind, listEntities, stateLabel, type HaEntity } from '../api/ha';
import { setRenderMode, stylizeVersion, type StylizeResult } from '../api/plans';
import { ZONE_KINDS, acceptZones, createZone, deleteZone, detectZones, pointInPolygon, updateZone, zoneKindLabel, type SpatialZone, type ZoneKind, type ZonePoint } from '../api/zones';

type Strength = 'light' | 'medium' | 'strong';
interface ZoneCandidate {
  polygon: ZonePoint[];
  name: string;
  kind: ZoneKind;
  include: boolean;
}
/** Same palette as the backend assigns on save, so candidates keep their colour once accepted. */
const PALETTE = ['#2767ED', '#22A06B', '#F59E0B', '#8B5CF6', '#0EA5E9', '#EC4899', '#14B8A6', '#F97316'];

type Tool = 'select' | 'camera' | 'entity' | 'zones' | 'layers';
type Layer = 'cameras' | 'doors' | 'lights' | 'sensors';

const TOOLS: { id: Tool; icon: IconName; label: string; ready: boolean }[] = [
  { id: 'select', icon: 'target', label: 'בחירה וגרירה', ready: true },
  { id: 'camera', icon: 'camera', label: 'הוספת מצלמה', ready: true },
  { id: 'entity', icon: 'light', label: 'הוספת ישות HA', ready: true },
  { id: 'zones', icon: 'map', label: 'חדרים ואזורים', ready: true },
  { id: 'layers', icon: 'layers', label: 'שכבות', ready: true },
];

const LAYERS: { id: Layer; label: string }[] = [
  { id: 'cameras', label: 'מצלמות' },
  { id: 'doors', label: 'דלתות ומנעולים' },
  { id: 'lights', label: 'תאורה ומתגים' },
  { id: 'sensors', label: 'חיישנים' },
];

/**
 * SC06 / M12 — floor plan editor: drag pins on the published (or draft) background, direction and
 * field-of-view handles on the selected camera, click-to-place for new cameras and HA entities, numeric
 * inspector, keyboard nudges, undo/redo, explicit save with optimistic revisions (409 → reload, nothing
 * is overwritten silently), publish a draft plan, and the stylized "SMPLWISE language" rendering.
 */
@customElement('explore-plan-editor')
export class ExplorePlanEditor extends LitElement {
  @property() floorId = '';
  /** `?entity=<id>` from the catalogue: opens the entity tool with that id pre-searched. */
  @property() presetEntity = '';
  @state() private bundle: MapBundle | null = null;
  @state() private anchors: Anchor[] = [];
  @state() private dirty = new Set<string>();
  @state() private undo: Anchor[][] = [];
  @state() private redo: Anchor[][] = [];
  @state() private selectedId: string | null = null;
  @state() private tool: Tool = 'select';
  @state() private layers = new Set<Layer>(['cameras', 'doors', 'lights', 'sensors']);
  @state() private placing: { kind: 'camera'; camera: Camera } | { kind: 'entity'; entity: HaEntity } | null = null;
  @state() private entQ = '';
  @state() private entResults: HaEntity[] | null = null;
  @state() private entBusy = false;
  @state() private busy = false;
  @state() private error = '';
  @state() private info = '';
  @state() private stylizing = false;
  @state() private stylized: StylizeResult | null = null;
  @state() private zones: SpatialZone[] = [];
  @state() private selectedZoneId: string | null = null;
  @state() private candidates: ZoneCandidate[] | null = null;
  @state() private detecting = false;
  @state() private detectStrength: Strength = 'medium';
  @state() private replaceAuto = true;
  @state() private drawing: ZonePoint[] | null = null;
  @state() private showZones = true;
  @state() private zoneBusy = false;
  @query('sw-plan-canvas') private canvas?: SwPlanCanvas;
  private entTimer = 0;
  private onKey = (e: KeyboardEvent) => this.handleKey(e);

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 16px;
      min-block-size: 560px;
      flex: 1;
    }
    .mapwrap {
      position: relative;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: var(--sw-surface);
      min-block-size: 520px;
      box-shadow: var(--sw-shadow-1);
      display: flex;
      flex-direction: column;
    }
    .mapwrap sw-plan-canvas {
      flex: 1;
    }
    .rail {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 64px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 12px;
      box-shadow: var(--sw-shadow-2);
      padding: 5px;
      z-index: var(--sw-z-map-ui);
    }
    .rail button {
      display: grid;
      place-items: center;
      inline-size: 38px;
      block-size: 38px;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .rail button:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .rail button.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
    }
    .rail button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .rail hr {
      border: 0;
      border-block-start: 1px solid var(--sw-border);
      margin: 2px 4px;
    }
    .floorchip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 12px;
      box-shadow: var(--sw-shadow-1);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      z-index: var(--sw-z-map-ui);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .bar .grow {
      flex: 1;
    }
    .autosave {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .autosave i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .autosave.dirty i {
      background: var(--sw-stale);
    }
    .placing-hint {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 14px;
      display: flex;
      justify-content: center;
      pointer-events: none;
      z-index: var(--sw-z-map-ui);
    }
    .placing-hint span {
      background: var(--sw-text);
      color: #fff;
      border-radius: 999px;
      padding: 6px 14px;
      font-size: var(--sw-fs-sm);
      box-shadow: var(--sw-shadow-2);
    }
    .legend {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      display: flex;
      gap: 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      padding: 5px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      z-index: var(--sw-z-map-ui);
    }
    .legend i {
      display: inline-block;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      margin-inline-end: 5px;
      background: var(--sw-accent);
    }
    .legend i.ent {
      background: var(--sw-live);
    }
    .props {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 260px;
      overflow: auto;
    }
    .list button {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 7px 9px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      text-align: start;
    }
    .list button:hover,
    .list button.on {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
    }
    .kv {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .kv .k {
      color: var(--sw-text-3);
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row .lbl {
      display: flex;
      flex-direction: column;
    }
    .row .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    input[type='range'] {
      inline-size: 100%;
      accent-color: var(--sw-accent);
    }
    .cand {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
      padding: 4px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .cand input.name {
      inline-size: 100%;
      min-inline-size: 0;
      border: 1px solid var(--sw-border);
      border-radius: 6px;
      padding: 4px 6px;
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    .cand select {
      border: 1px solid var(--sw-border);
      border-radius: 6px;
      padding: 3px 4px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface);
    }
    i.sw {
      display: inline-block;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 3px;
      box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.15);
      margin-inline-end: 6px;
      vertical-align: -2px;
    }
    .btns {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-block-start: 8px;
    }
    .legend i.zone {
      border-radius: 2px;
      background: var(--sw-accent);
      opacity: 0.45;
    }
    .layerlist label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: var(--sw-fs-sm);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .compare {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .compare img {
      inline-size: 100%;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-map-bg);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
      .props {
        order: 2;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    window.addEventListener('keydown', this.onKey);
    if (this.presetEntity) {
      this.tool = 'entity';
      this.entQ = this.presetEntity;
      void this.searchEntities();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
  }

  private async load() {
    this.error = '';
    try {
      const b = await loadMap(this.floorId || 'f0', true);
      this.bundle = b;
      this.anchors = b.anchors.map((a) => ({ ...a, position: { ...a.position } }));
      this.zones = b.zones;
      if (this.selectedZoneId && !this.zones.some((z) => z.id === this.selectedZoneId)) this.selectedZoneId = null;
      this.dirty = new Set();
      this.undo = [];
      this.redo = [];
      if (this.selectedId && !this.anchors.some((a) => a.id === this.selectedId)) this.selectedId = null;
    } catch (err) {
      this.error = describeError(err);
    }
  }

  // ---- derived ----

  private get selected(): Anchor | undefined {
    return this.anchors.find((a) => a.id === this.selectedId);
  }

  private layerOf(a: Anchor): Layer {
    if (a.resource_type === 'camera') return 'cameras';
    return a.layer_id === 'doors' ? 'doors' : a.layer_id === 'lights' ? 'lights' : 'sensors';
  }

  private get markers(): PlanMarker[] {
    return this.anchors
      .filter((a) => this.layers.has(this.layerOf(a)))
      .map((a) => ({
        id: a.id,
        kind: a.resource_type === 'camera' ? 'camera' : entityMarkerKind(a.layer_id, a.entity?.domain),
        label: a.camera?.name ?? a.entity?.name ?? a.label ?? a.resource_id,
        x: a.position.x,
        y: a.position.y,
        rotation: a.rotation_degrees,
        fov: a.field_of_view_degrees ?? undefined,
        state: a.resource_type === 'camera' ? (this.bundle?.source === 'demo' ? 'live' : cameraState(a)) : 'neutral',
      }));
  }

  private anchorName(a: Anchor) {
    return a.camera?.name ?? a.entity?.name ?? a.label ?? a.resource_id;
  }

  private get selectedZone(): SpatialZone | undefined {
    return this.zones.find((z) => z.id === this.selectedZoneId);
  }

  private get planZones(): PlanZone[] {
    if (!this.showZones) return [];
    const saved: PlanZone[] = this.zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind, color: z.color, polygon: z.polygon }));
    const cands: PlanZone[] = (this.candidates ?? []).map((c, i) => ({ id: `cand-${i}`, name: c.include ? c.name : '', color: c.include ? PALETTE[i % PALETTE.length] : '#9AA3B5', polygon: c.polygon, candidate: true }));
    return [...saved, ...cands];
  }

  // ---- rooms & zones (M13) ----

  private async detect() {
    const b = this.bundle;
    if (!b) return;
    if (b.source === 'demo') {
      this.info = 'נתוני הדגמה: הזיהוי עובד מול השרת.';
      return;
    }
    this.detecting = true;
    this.error = '';
    try {
      const r = await detectZones(b.floorId, this.detectStrength);
      this.candidates = r.rooms.map((room, i) => ({ polygon: room.polygon, name: `חדר ${i + 1}`, kind: 'room' as ZoneKind, include: true }));
      this.selectedZoneId = null;
      this.selectedId = null;
      this.info = r.rooms.length ? `${r.rooms.length} חדרים זוהו · תן שמות ושמור` : 'לא זוהו חדרים סגורים; נסה עוצמה אחרת או צייר אזור ידנית';
      setTimeout(() => (this.info = ''), 5000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.detecting = false;
    }
  }

  private setCandidate(i: number, patch: Partial<ZoneCandidate>) {
    if (!this.candidates) return;
    this.candidates = this.candidates.map((c, j) => (j === i ? { ...c, ...patch } : c));
  }

  private async acceptCandidates() {
    const b = this.bundle;
    const chosen = (this.candidates ?? []).filter((c) => c.include);
    if (!b || !chosen.length) return;
    this.zoneBusy = true;
    this.error = '';
    try {
      const r = await acceptZones(b.floorId, chosen.map((c) => ({ polygon: c.polygon, name: c.name, kind: c.kind })), this.replaceAuto);
      this.candidates = null;
      this.zones = r.zones;
      this.info = `${r.created.length} חדרים נשמרו`;
      setTimeout(() => (this.info = ''), 3000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.zoneBusy = false;
    }
  }

  private startDrawing() {
    this.drawing = [];
    this.placing = null;
    this.candidates = null;
    this.selectedZoneId = null;
    this.selectedId = null;
  }

  private addDraftPoint(x: number, y: number) {
    const d = this.drawing;
    const b = this.bundle;
    if (!d || !b) return;
    if (d.length >= 3) {
      // a click on the first vertex closes the shape
      const z = this.canvas?.zoom ?? 1;
      const dist = Math.hypot((x - d[0].x) * b.width * z, (y - d[0].y) * b.height * z);
      if (dist < 12) {
        void this.finishDrawing();
        return;
      }
    }
    this.drawing = [...d, { x: +x.toFixed(4), y: +y.toFixed(4) }];
  }

  private async finishDrawing() {
    const d = this.drawing;
    const b = this.bundle;
    if (!d || !b || d.length < 3) return;
    if (b.source === 'demo') {
      this.info = 'נתוני הדגמה: השמירה עובדת מול השרת.';
      this.drawing = null;
      return;
    }
    this.zoneBusy = true;
    this.error = '';
    try {
      const z = await createZone(b.floorId, { name: `אזור ${this.zones.length + 1}`, kind: 'zone', polygon: d });
      this.drawing = null;
      this.zones = [...this.zones, z];
      this.selectedZoneId = z.id;
      this.info = 'האזור נוצר · תן לו שם';
      setTimeout(() => (this.info = ''), 3000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.zoneBusy = false;
    }
  }

  private async patchZone(z: SpatialZone, body: { name?: string; kind?: ZoneKind; color?: string; searchable?: boolean; polygon?: ZonePoint[] }) {
    if (this.bundle?.source === 'demo') return;
    this.zoneBusy = true;
    this.error = '';
    try {
      const nz = await updateZone(z.id, { revision: z.revision, ...body });
      this.zones = this.zones.map((x) => (x.id === nz.id ? nz : x));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        this.error = 'האזור השתנה בינתיים על ידי עורך אחר; נטען מחדש בלי לדרוס.';
        await this.load();
      } else this.error = describeError(err);
    } finally {
      this.zoneBusy = false;
    }
  }

  private async removeZone(z: SpatialZone) {
    if (this.bundle?.source === 'demo') return;
    if (!window.confirm(`למחוק את "${z.name}"? המצלמות והישויות בקומה לא מושפעות.`)) return;
    this.zoneBusy = true;
    this.error = '';
    try {
      await deleteZone(z.id);
      this.zones = this.zones.filter((x) => x.id !== z.id);
      if (this.selectedZoneId === z.id) this.selectedZoneId = null;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.zoneBusy = false;
    }
  }

  // ---- edits (draft state; explicit save) ----

  private snapshot() {
    this.undo = [...this.undo.slice(-40), this.anchors.map((a) => ({ ...a, position: { ...a.position } }))];
    this.redo = [];
  }

  private apply(id: string, patch: Partial<Anchor> & { position?: { x: number; y: number } }) {
    this.snapshot();
    this.anchors = this.anchors.map((a) => (a.id === id ? { ...a, ...patch, position: patch.position ?? a.position } : a));
    this.dirty = new Set(this.dirty).add(id);
  }

  private nudge(dx: number, dy: number) {
    const a = this.selected;
    if (!a) return;
    this.apply(a.id, { position: { x: +Math.min(1, Math.max(0, a.position.x + dx)).toFixed(4), y: +Math.min(1, Math.max(0, a.position.y + dy)).toFixed(4) } });
  }

  private doUndo() {
    const prev = this.undo[this.undo.length - 1];
    if (!prev) return;
    this.redo = [...this.redo, this.anchors];
    this.undo = this.undo.slice(0, -1);
    this.anchors = prev;
    this.dirty = new Set(this.anchors.map((a) => a.id));
  }

  private doRedo() {
    const next = this.redo[this.redo.length - 1];
    if (!next) return;
    this.undo = [...this.undo, this.anchors];
    this.redo = this.redo.slice(0, -1);
    this.anchors = next;
    this.dirty = new Set(this.anchors.map((a) => a.id));
  }

  private handleKey(e: KeyboardEvent) {
    const target = e.composedPath()[0] as HTMLElement | undefined;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
    if (e.key === 'Escape') {
      if (this.drawing) this.drawing = null;
      else if (this.placing) this.placing = null;
      else if (this.candidates) this.candidates = null;
      else {
        this.selectedId = null;
        this.selectedZoneId = null;
      }
      return;
    }
    if (typing) return;
    if (e.key === 'Enter' && this.drawing) {
      e.preventDefault();
      void this.finishDrawing();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !this.selected && this.selectedZone) {
      e.preventDefault();
      void this.removeZone(this.selectedZone);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.doRedo();
      else this.doUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.doRedo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void this.save();
      return;
    }
    if (!this.selected) return;
    const step = e.shiftKey ? 0.01 : 0.002;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.nudge(-step, 0);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.nudge(step, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.nudge(0, -step);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.nudge(0, step);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      void this.removeSelected();
    }
  }

  private async save(): Promise<boolean> {
    if (!this.bundle || this.bundle.source === 'demo') {
      this.info = 'נתוני הדגמה: השינויים נשמרים רק במסך זה.';
      this.dirty = new Set();
      return true;
    }
    if (!this.dirty.size) return true;
    this.busy = true;
    this.error = '';
    let conflict = false;
    try {
      for (const id of this.dirty) {
        const a = this.anchors.find((x) => x.id === id);
        if (!a) continue;
        try {
          const saved = await updateAnchor(id, { revision: a.revision, x: a.position.x, y: a.position.y, rotation_degrees: a.rotation_degrees, field_of_view_degrees: a.field_of_view_degrees, label: a.label });
          this.anchors = this.anchors.map((x) => (x.id === id ? { ...x, revision: saved.revision } : x));
        } catch (err) {
          if (err instanceof ApiError && err.code === 'stale_revision') conflict = true;
          else throw err;
        }
      }
      if (conflict) {
        this.error = 'חלק מהפריטים השתנו בינתיים על ידי עורך אחר; המפה נטענה מחדש בלי לדרוס את השינוי שלו.';
        await this.load();
        return false;
      }
      this.dirty = new Set();
      this.info = 'המיקומים נשמרו';
      setTimeout(() => (this.info = ''), 2500);
      return true;
    } catch (err) {
      this.error = describeError(err);
      return false;
    } finally {
      this.busy = false;
    }
  }

  private async place(x: number, y: number) {
    const p = this.placing;
    if (!p || !this.bundle) return;
    if (this.bundle.source === 'demo') {
      this.info = 'נתוני הדגמה: הוספה עובדת מול השרת.';
      this.placing = null;
      return;
    }
    if (this.dirty.size && !(await this.save())) return;
    this.busy = true;
    this.error = '';
    try {
      const a =
        p.kind === 'camera'
          ? await createAnchor(this.bundle.floorId, { resource_type: 'camera', resource_id: p.camera.id, x, y, rotation_degrees: 0, field_of_view_degrees: 90 })
          : await createAnchor(this.bundle.floorId, { resource_type: 'ha_entity', resource_id: p.entity.entity_id, x, y, rotation_degrees: 0, field_of_view_degrees: null });
      this.placing = null;
      await this.load();
      this.selectedId = a.id;
      this.tool = 'select';
      this.info = `${this.anchorName(a)} הוצב · גרור לדיוק, קבע כיוון בידיות`;
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async removeSelected() {
    const a = this.selected;
    if (!a || !this.bundle) return;
    if (this.bundle.source === 'demo') {
      this.info = 'נתוני הדגמה: הסרה עובדת מול השרת.';
      return;
    }
    if (!window.confirm(`להסיר את "${this.anchorName(a)}" מהמפה? המקור עצמו לא נמחק.`)) return;
    this.busy = true;
    this.error = '';
    try {
      await deleteAnchor(a.id);
      this.selectedId = null;
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async publish() {
    if (!this.bundle?.planVersionId) return;
    if (this.dirty.size && !(await this.save())) return;
    this.busy = true;
    this.error = '';
    try {
      await publishVersion(this.bundle.planVersionId);
      this.info = 'הגרסה פורסמה; הצופים רואים אותה עכשיו';
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async searchEntities() {
    if (this.bundle?.source === 'demo') return;
    this.entBusy = true;
    try {
      const r = await listEntities({ q: this.entQ || undefined, limit: 40 });
      this.entResults = r.entities;
    } catch (err) {
      this.error = describeError(err);
      this.entResults = [];
    } finally {
      this.entBusy = false;
    }
  }

  private onEntQuery(v: string) {
    this.entQ = v;
    window.clearTimeout(this.entTimer);
    this.entTimer = window.setTimeout(() => void this.searchEntities(), 250);
  }

  private async stylize(strength: 'light' | 'medium' | 'strong', keepLines: boolean) {
    if (!this.bundle?.planVersionId || this.bundle.source === 'demo') return;
    this.stylizing = true;
    this.error = '';
    try {
      this.stylized = await stylizeVersion(this.bundle.planVersionId, { strength, keep_lines: keepLines });
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.stylizing = false;
    }
  }

  private async useRender(mode: 'source' | 'stylized') {
    if (!this.bundle?.planVersionId) return;
    this.busy = true;
    this.error = '';
    try {
      await setRenderMode(this.bundle.planVersionId, mode);
      this.stylized = null;
      await this.load();
      this.info = mode === 'stylized' ? 'המפה מציגה עכשיו את שפת SMPLWISE' : 'המפה מציגה את תוכנית המקור';
      setTimeout(() => (this.info = ''), 3000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private pickTool(tool: Tool) {
    this.tool = tool;
    this.placing = null;
    if (tool === 'entity' && this.entResults === null) void this.searchEntities();
  }

  // ---- panels ----

  private renderCameraInspector(a: Anchor) {
    const cam = a.camera;
    const fov = a.field_of_view_degrees ?? 0;
    return html`<sw-card heading="הגדרות מצלמה" subheading="גרירה במפה, ידיות לכיוון ולשדה הראייה, או הזנה מדויקת">
      <div class="kv"><span class="k">מצלמה</span><strong>${this.anchorName(a)}</strong></div>
      <div class="kv"><span class="k">מקור</span><span class="ltr">${cam ? `NVR · ch ${cam.channel}` : a.resource_id}</span></div>
      <div class="two" style="margin-block-start:10px">
        <sw-field label="כיוון מבט (°)"><input type="number" step="1" min="0" max="359" data-ltr .value=${String(Math.round(a.rotation_degrees))} @change=${(e: Event) => this.apply(a.id, { rotation_degrees: ((Number((e.target as HTMLInputElement).value) % 360) + 360) % 360 })} /></sw-field>
        <sw-field label="שדה ראייה (°)"><input type="number" step="1" min="10" max="180" data-ltr .value=${String(Math.round(fov || 90))} ?disabled=${!fov} @change=${(e: Event) => this.apply(a.id, { field_of_view_degrees: Math.min(180, Math.max(10, Number((e.target as HTMLInputElement).value))) })} /></sw-field>
      </div>
      <input type="range" min="10" max="180" step="1" .value=${String(fov || 90)} ?disabled=${!fov} aria-label="שדה ראייה" @input=${(e: Event) => this.apply(a.id, { field_of_view_degrees: Number((e.target as HTMLInputElement).value) })} />
      <div class="two">
        <sw-field label="מיקום X (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(a.position.x * 100).toFixed(1)} @change=${(e: Event) => this.apply(a.id, { position: { x: Math.min(1, Math.max(0, Number((e.target as HTMLInputElement).value) / 100)), y: a.position.y } })} /></sw-field>
        <sw-field label="מיקום Y (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(a.position.y * 100).toFixed(1)} @change=${(e: Event) => this.apply(a.id, { position: { x: a.position.x, y: Math.min(1, Math.max(0, Number((e.target as HTMLInputElement).value) / 100)) } })} /></sw-field>
      </div>
      <sw-field label="תווית (אופציונלי)"><input .value=${a.label ?? ''} @change=${(e: Event) => this.apply(a.id, { label: (e.target as HTMLInputElement).value || null })} /></sw-field>
      <div class="row"><span class="lbl">הצג כיסוי משוער<span class="muted">זווית לתכנון, לא מדידת כיסוי בפועל</span></span><sw-toggle ?checked=${!!fov} label=${fov ? 'מוצג' : 'מוסתר'} @click=${() => this.apply(a.id, { field_of_view_degrees: fov ? null : 90 })}></sw-toggle></div>
      <div class="row"><span class="lbl">0° = למעלה, עם כיוון השעון<span class="muted">שינוי כיוון במפה אינו פקודת PTZ למצלמה</span></span></div>
      <div class="note" style="margin-block-start:6px">revision ${a.revision}${this.dirty.has(a.id) ? ' · שינויים לא שמורים' : ''} · חצים = הזזה עדינה (Shift = גדולה) · Delete = הסרה</div>
      <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${!this.dirty.size || this.busy} @click=${() => this.save()}>שמירת מיקום</sw-button>
        <sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${() => this.removeSelected()}>הסר מהמפה</sw-button>
      </div>
    </sw-card>`;
  }

  private renderEntityInspector(a: Anchor) {
    const e = a.entity;
    return html`<sw-card heading="הגדרות ישות" subheading="הצבה בלבד; שליטה דורשת הרשאה נפרדת">
      <div class="kv"><span class="k">ישות</span><strong>${this.anchorName(a)}</strong></div>
      <div class="kv"><span class="k">מזהה</span><span class="ltr">${a.resource_id}</span></div>
      ${e ? html`<div class="kv"><span class="k">מצב עכשיו</span><span>${stateLabel(e)}</span></div><div class="kv"><span class="k">סוג</span><span>${domainLabel(e.domain)}</span></div>` : nothing}
      <sw-field label="שכבה" style="margin-block-start:8px"><select @change=${(ev: Event) => this.apply(a.id, { layer_id: (ev.target as HTMLSelectElement).value })}>${LAYERS.filter((l) => l.id !== 'cameras').map((l) => html`<option value=${l.id} ?selected=${a.layer_id === l.id}>${l.label}</option>`)}</select></sw-field>
      <div class="two">
        <sw-field label="מיקום X (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(a.position.x * 100).toFixed(1)} @change=${(ev: Event) => this.apply(a.id, { position: { x: Math.min(1, Math.max(0, Number((ev.target as HTMLInputElement).value) / 100)), y: a.position.y } })} /></sw-field>
        <sw-field label="מיקום Y (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(a.position.y * 100).toFixed(1)} @change=${(ev: Event) => this.apply(a.id, { position: { x: a.position.x, y: Math.min(1, Math.max(0, Number((ev.target as HTMLInputElement).value) / 100)) } })} /></sw-field>
      </div>
      <sw-field label="תווית (אופציונלי)"><input .value=${a.label ?? ''} @change=${(ev: Event) => this.apply(a.id, { label: (ev.target as HTMLInputElement).value || null })} /></sw-field>
      <div class="note" style="margin-block-start:6px">revision ${a.revision}${this.dirty.has(a.id) ? ' · שינויים לא שמורים' : ''}</div>
      <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${!this.dirty.size || this.busy} @click=${() => this.save()}>שמירת מיקום</sw-button>
        <sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${() => this.removeSelected()}>הסר מהמפה</sw-button>
      </div>
    </sw-card>`;
  }

  private renderToolPanel(b: MapBundle) {
    const anchoredIds = new Set(this.anchors.map((a) => a.resource_id));
    if (this.tool === 'camera') {
      const available = b.cameras.filter((c) => !anchoredIds.has(c.id));
      return html`<sw-card heading="הוספת מצלמה" subheading="בחר מצלמה ואז לחץ על התוכנית במקום המבוקש">
        ${available.length
          ? html`<div class="list">${available.map((c) => html`<button class=${this.placing?.kind === 'camera' && this.placing.camera.id === c.id ? 'on' : ''} @click=${() => (this.placing = { kind: 'camera', camera: c })}><span>${c.name}</span><span class="ltr">ch ${c.channel} · ${c.status}</span></button>`)}</div>`
          : html`<div class="note">${b.cameras.length ? 'כל המצלמות הרשומות כבר מוצבות על הקומה.' : 'אין מצלמות רשומות עדיין; הגילוי מה־NVR רץ אוטומטית.'}</div><div style="margin-block-start:8px"><sw-button size="sm" @click=${() => navigate('/system/devices')}>למצלמות</sw-button></div>`}
      </sw-card>`;
    }
    if (this.tool === 'entity') {
      const results = (this.entResults ?? []).filter((e) => !anchoredIds.has(e.entity_id));
      return html`<sw-card heading="הוספת ישות Home Assistant" subheading="בחר ישות מהקטלוג ואז לחץ על התוכנית">
        <sw-field><input type="search" placeholder="חיפוש לפי שם, entity_id או אזור" data-ltr .value=${this.entQ} @input=${(e: Event) => this.onEntQuery((e.target as HTMLInputElement).value)} /></sw-field>
        ${b.source === 'demo'
          ? html`<div class="note">נתוני הדגמה: החיפוש עובד מול השרת.</div>`
          : this.entBusy && !this.entResults
            ? html`<div class="note">מחפש…</div>`
            : results.length
              ? html`<div class="list">${results.map((e) => html`<button class=${this.placing?.kind === 'entity' && this.placing.entity.entity_id === e.entity_id ? 'on' : ''} @click=${() => (this.placing = { kind: 'entity', entity: e })}><span>${e.name || e.original_name || e.entity_id}<div class="note" style="margin:0">${domainLabel(e.domain)}${e.area_name ? ` · ${e.area_name}` : ''} · ${stateLabel(e)}</div></span><span class="ltr">${e.entity_id}</span></button>`)}</div>`
              : html`<div class="note">${this.entResults ? 'לא נמצאו ישויות (או שכולן כבר מוצבות).' : ''}</div>`}
      </sw-card>`;
    }
    if (this.tool === 'layers') {
      return html`<sw-card heading="שכבות" subheading="מה מוצג בעורך (לא משפיע על הצופים)">
        <div class="layerlist">${LAYERS.map((l) => html`<label><input type="checkbox" .checked=${this.layers.has(l.id)} @change=${(e: Event) => { const next = new Set(this.layers); if ((e.target as HTMLInputElement).checked) next.add(l.id); else next.delete(l.id); this.layers = next; }} /> ${l.label} <span class="note">(${this.anchors.filter((a) => this.layerOf(a) === l.id).length})</span></label>`)}
          <label><input type="checkbox" .checked=${this.showZones} @change=${(e: Event) => (this.showZones = (e.target as HTMLInputElement).checked)} /> חדרים ואזורים <span class="note">(${this.zones.length})</span></label></div>
      </sw-card>`;
    }
    if (this.tool === 'zones') return this.renderZonesPanel(b);
    return html`<sw-card heading="מאפיינים"><div class="note">בחר סיכה במפה כדי לערוך אותה, או הוסף מצלמה / ישות מסרגל הכלים. גרירה מזיזה; הידיות על המצלמה הנבחרת קובעות כיוון ושדה ראייה. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור.</div></sw-card>`;
  }

  private renderZoneInspector(z: SpatialZone) {
    const cams = this.anchors.filter((a) => a.resource_type === 'camera' && pointInPolygon(a.position, z.polygon));
    const ents = this.anchors.filter((a) => a.resource_type !== 'camera' && pointInPolygon(a.position, z.polygon));
    return html`<div class="zone-insp" data-zone-inspector>
      <sw-field label="שם"><input .value=${z.name} placeholder="למשל: לובי, מחסן, חדר ישיבות" @change=${(e: Event) => this.patchZone(z, { name: (e.target as HTMLInputElement).value })} /></sw-field>
      <div class="two">
        <sw-field label="סוג"><select @change=${(e: Event) => this.patchZone(z, { kind: (e.target as HTMLSelectElement).value as ZoneKind })}>${ZONE_KINDS.map((k) => html`<option value=${k.id} ?selected=${z.kind === k.id}>${k.label}</option>`)}</select></sw-field>
        <sw-field label="צבע"><input type="color" data-ltr .value=${z.color} @change=${(e: Event) => this.patchZone(z, { color: (e.target as HTMLInputElement).value })} /></sw-field>
      </div>
      <div class="kv"><span class="k">מצלמות באזור</span><span>${cams.length ? cams.map((a) => this.anchorName(a)).join(', ') : 'אין'}</span></div>
      <div class="kv"><span class="k">ישויות HA באזור</span><span>${ents.length ? `${ents.length} ישויות` : 'אין'}</span></div>
      <div class="row"><span class="lbl">הכללה בחיפוש מרחבי<span class="muted">זמין לחוקי התראה ולחיפוש לפי מקום</span></span><sw-toggle ?checked=${z.searchable} label=${z.searchable ? 'כלול' : 'לא כלול'} @click=${() => this.patchZone(z, { searchable: !z.searchable })}></sw-toggle></div>
      <div class="note">${z.polygon.length} פינות · ${z.source === 'auto' ? 'זוהה אוטומטית מהתוכנית' : 'צויר ידנית'} · revision ${z.revision}</div>
      <div class="note">עריכת הצורה במפה: גרירת פינה מזיזה אותה, גרירת נקודת האמצע שבין פינות מוסיפה פינה, לחיצה כפולה על פינה מוחקת אותה. השינוי נשמר מיד.</div>
      <div class="note">אזור במפה הוא הקשר מרחבי בלבד: אינו אזור זיהוי במצלמה ואינו מסכת פרטיות, ואינו משנה תצורת NVR.</div>
      <div class="btns"><sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.zoneBusy} @click=${() => this.removeZone(z)}>מחק אזור</sw-button><sw-button size="sm" variant="ghost" @click=${() => (this.selectedZoneId = null)}>סגור</sw-button></div>
    </div>`;
  }

  private renderZonesPanel(b: MapBundle) {
    const cands = this.candidates;
    const sel = this.selectedZone;
    return html`<sw-card heading="חדרים ואזורים" subheading="זיהוי מהתוכנית או ציור ידני; השמות מופיעים במפה">
      ${cands
        ? html`<div class="note">${cands.length} חדרים זוהו · סמן, תן שם ושמור. הפוליגונים מוצגים במפה בקו מקווקו.</div>
            <div class="candlist">${cands.map((c, i) => html`<div class="cand" data-candidate><input type="checkbox" .checked=${c.include} aria-label="כלול" @change=${(e: Event) => this.setCandidate(i, { include: (e.target as HTMLInputElement).checked })} /><i class="sw" style="background:${PALETTE[i % PALETTE.length]}"></i><input class="name" .value=${c.name} placeholder="שם החדר" aria-label="שם החדר" @input=${(e: Event) => this.setCandidate(i, { name: (e.target as HTMLInputElement).value })} /><select aria-label="סוג" @change=${(e: Event) => this.setCandidate(i, { kind: (e.target as HTMLSelectElement).value as ZoneKind })}>${ZONE_KINDS.map((k) => html`<option value=${k.id} ?selected=${c.kind === k.id}>${k.label}</option>`)}</select></div>`)}</div>
            ${this.zones.some((z) => z.source === 'auto') ? html`<label class="chk"><input type="checkbox" .checked=${this.replaceAuto} @change=${(e: Event) => (this.replaceAuto = (e.target as HTMLInputElement).checked)} /> החלף את החדרים שזוהו אוטומטית בעבר (${this.zones.filter((z) => z.source === 'auto').length})</label>` : nothing}
            <div class="btns"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.zoneBusy || !cands.some((c) => c.include)} @click=${() => this.acceptCandidates()}>שמור ${cands.filter((c) => c.include).length} חדרים</sw-button><sw-button variant="ghost" size="sm" @click=${() => (this.candidates = null)}>בטל</sw-button></div>`
        : this.drawing
          ? html`<div class="note">לחץ על התוכנית להוספת פינות (${this.drawing.length} עד כה). לחיצה על הפינה הראשונה או Enter סוגרים את הצורה · Esc לביטול.</div>
            <div class="btns"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.drawing.length < 3 || this.zoneBusy} @click=${() => this.finishDrawing()}>סיים אזור</sw-button><sw-button variant="ghost" size="sm" @click=${() => (this.drawing = null)}>בטל</sw-button></div>`
          : html`<div class="row"><span class="lbl">זיהוי חדרים מהתוכנית<span class="muted">עיבוד מקומי של הקירות (ללא AI); החדרים מוצעים ואתה נותן להם שמות</span></span><select aria-label="עוצמת זיהוי" @change=${(e: Event) => (this.detectStrength = (e.target as HTMLSelectElement).value as Strength)}><option value="light" ?selected=${this.detectStrength === 'light'}>קל</option><option value="medium" ?selected=${this.detectStrength === 'medium'}>בינוני</option><option value="strong" ?selected=${this.detectStrength === 'strong'}>חזק</option></select></div>
            <div class="btns"><sw-button variant="primary" size="sm" icon="map" ?disabled=${this.detecting || b.source === 'demo' || b.planStatus === 'none'} @click=${() => this.detect()}>${this.detecting ? 'מזהה…' : 'זהה חדרים'}</sw-button><sw-button size="sm" icon="edit" ?disabled=${this.zoneBusy} @click=${() => this.startDrawing()}>צייר אזור</sw-button></div>`}
      ${this.zones.length
        ? html`<div class="note" style="margin-block-start:10px">${this.zones.length} אזורים בקומה · לחיצה בוחרת במפה</div>
            <div class="list">${this.zones.map((z) => html`<button class=${z.id === this.selectedZoneId ? 'on' : ''} data-zone-row @click=${() => { this.selectedZoneId = z.id === this.selectedZoneId ? null : z.id; this.selectedId = null; }}><span><i class="sw" style="background:${z.color}"></i>${z.name}</span><span class="note" style="margin:0">${zoneKindLabel(z.kind)}${z.source === 'auto' ? ' · אוטומטי' : ''}</span></button>`)}</div>`
        : cands || this.drawing ? nothing : html`<div class="note" style="margin-block-start:10px">עדיין אין חדרים או אזורים בקומה.</div>`}
      ${sel ? this.renderZoneInspector(sel) : nothing}
    </sw-card>`;
  }

  private renderVersionCard(b: MapBundle) {
    const st = this.stylized;
    return html`<sw-card heading="גרסת תוכנית" subheading=${b.planStatus === 'draft' ? 'טיוטה: צופים רואים את הגרסה הקודמת' : b.planStatus === 'published' ? 'גרסה מפורסמת' : 'אין תוכנית'}>
      ${b.planStatus === 'none'
        ? nothing
        : html`<div class="row"><span class="lbl">תצוגת המפה<span class="muted">${b.renderMode === 'stylized' ? 'שפת SMPLWISE (עיבוד אוטומטי של המקור)' : 'תוכנית המקור כפי שהועלתה'}</span></span>${b.renderMode === 'stylized' ? html`<sw-button size="sm" ?disabled=${this.busy} @click=${() => this.useRender('source')}>הצג מקור</sw-button>` : b.stylizedAvailable ? html`<sw-button size="sm" ?disabled=${this.busy} @click=${() => this.useRender('stylized')}>הצג שפת SMPLWISE</sw-button>` : nothing}</div>
          <div class="row"><span class="lbl">עיבוד לשפת SMPLWISE<span class="muted">ניקוי טקסט ומידות, הדגשת קירות וחדרים; המקור נשמר</span></span><span style="display:flex;gap:4px"><sw-button size="sm" ?disabled=${this.stylizing || b.source === 'demo'} @click=${() => this.stylize('light', false)}>קל</sw-button><sw-button size="sm" ?disabled=${this.stylizing || b.source === 'demo'} @click=${() => this.stylize('medium', false)}>בינוני</sw-button><sw-button size="sm" ?disabled=${this.stylizing || b.source === 'demo'} @click=${() => this.stylize('strong', true)}>חזק</sw-button></span></div>
          ${this.stylizing ? html`<div class="note">מעבד את התוכנית…</div>` : nothing}
          ${st
            ? html`<div class="compare" style="margin-block-start:8px"><div><div class="note">מקור</div><img src=${st.source_url} alt="תוכנית מקור" /></div><div><div class="note">שפת SMPLWISE · ${st.rooms} חדרים</div><img src=${st.stylized_url} alt="שפת SMPLWISE" /></div></div>
              <div style="display:flex;gap:8px;margin-block-start:8px"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${() => this.useRender('stylized')}>השתמש בתוצאה</sw-button><sw-button variant="ghost" size="sm" @click=${() => (this.stylized = null)}>סגור</sw-button></div>
              <div class="note" style="margin-block-start:6px">עיבוד תמונה מקומי (ללא AI וללא שליחה החוצה): קירות וחדרים מזוהים לפי עובי הקווים; חדרים אינם מזוהים בשמם. אפשר לחזור למקור בכל רגע.</div>`
            : nothing}`}
      <div style="margin-block-start:8px"><sw-button size="sm" icon="upload" @click=${() => navigate(`/explore/floors/${b.floorId}/import`)}>ייבוא תוכנית חדשה</sw-button></div>
    </sw-card>`;
  }

  render() {
    const b = this.bundle;
    if (this.error && !b) return html`<sw-page heading="עורך תוכנית"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel></sw-page>`;
    if (!b) return html`<sw-page heading="עורך תוכנית"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    const sel = this.selected;
    const dirty = this.dirty.size;
    const cams = this.anchors.filter((a) => a.resource_type === 'camera').length;
    const ents = this.anchors.length - cams;
    return html`
      <sw-page heading="עורך תוכנית" subheading=${`${b.buildingName} · ${b.floorName} · ${b.planStatus === 'draft' ? 'טיוטה' : b.planStatus === 'published' ? 'תוכנית מפורסמת' : 'אין תוכנית'} · העוגנים נשמרים בנפרד מתמונת המקור${b.source === 'demo' ? ' · נתוני הדגמה' : ''}`} crumbs=${`אתרים | ${b.siteName} | ${b.buildingName} | ${b.floorName}`} wide>
        ${b.planStatus === 'draft' && b.permissions.publish ? html`<sw-button slot="actions" variant="primary" icon="check" ?disabled=${this.busy} @click=${() => this.publish()}>פרסום גרסה</sw-button>` : nothing}
        <sw-button slot="actions" icon="eye" @click=${() => navigate(`/explore/floors/${b.floorId}`)}>תצוגה מקדימה</sw-button>
        <sw-button slot="actions" ?disabled=${!dirty || this.busy} icon="check" @click=${() => this.save()}>${dirty ? `שמירה (${dirty})` : 'הכל שמור'}</sw-button>
        <sw-button slot="actions" variant="ghost" icon="history" ?disabled=${!this.undo.length} @click=${() => this.doUndo()}>ביטול שינוי</sw-button>
        ${b.planStatus === 'none'
          ? html`<sw-state-panel state="empty" heading="לקומה אין תוכנית" hint="העלה תוכנית קודם; אחר כך אפשר להציב מצלמות וישויות."><div style="margin-block-start:10px"><sw-button variant="primary" icon="upload" @click=${() => navigate(`/explore/floors/${b.floorId}/import`)}>העלאת תוכנית</sw-button></div></sw-state-panel>`
          : html`<div class="layout">
              <div class="mapwrap">
                <div class="bar">
                  <span class="autosave ${dirty ? 'dirty' : ''}"><i></i>${dirty ? `${dirty} שינויים לא שמורים` : 'הכל שמור'}</span>
                  ${this.info ? html`<span style="color:#15803d">${this.info}</span>` : nothing}
                  ${this.error ? html`<span class="err">${this.error}</span>` : nothing}
                  <span class="grow"></span>
                  ${b.needsAlignment ? html`<sw-badge kind="partial" label="פריטים מגרסת תוכנית קודמת — בדוק מיקומים"></sw-badge>` : nothing}
                  <span>גרירה מזיזה · גלגלת = זום · ידיות = כיוון ושדה ראייה</span>
                </div>
                <div class="floorchip"><sw-icon name="building" size=${14}></sw-icon>${b.floorName}</div>
                <div class="rail" role="toolbar" aria-label="כלי עריכה">
                  ${TOOLS.map((tl) => html`<button class=${tl.id === this.tool ? 'on' : ''} ?disabled=${!tl.ready} title=${tl.label} aria-label=${tl.label} aria-pressed=${tl.id === this.tool} @click=${() => this.pickTool(tl.id)}><sw-icon .name=${tl.icon} size=${18}></sw-icon></button>`)}
                  <hr />
                  <button title="ביטול (Ctrl+Z)" aria-label="ביטול" ?disabled=${!this.undo.length} @click=${() => this.doUndo()}><sw-icon name="history" size=${18}></sw-icon></button>
                  <button title="בצע שוב (Ctrl+Y)" aria-label="בצע שוב" ?disabled=${!this.redo.length} @click=${() => this.doRedo()}><sw-icon name="refresh" size=${18}></sw-icon></button>
                </div>
                <sw-plan-canvas editable alwaysLabel .placing=${!!this.placing || !!this.drawing} .planWidth=${b.width} .planHeight=${b.height} .plan=${b.planSvg} .imageUrl=${b.imageUrl} .markers=${this.markers} .selectedId=${this.selectedId}
                  .zones=${this.planZones} .selectedZoneId=${this.selectedZoneId} .draftPoints=${this.drawing ?? []}
                  @zone-select=${(e: CustomEvent<{ id: string }>) => { if (this.placing || this.drawing || e.detail.id.startsWith('cand-')) return; this.selectedZoneId = e.detail.id; this.selectedId = null; }}
                  @zone-edit=${(e: CustomEvent<{ id: string; polygon: ZonePoint[] }>) => { const z = this.zones.find((x) => x.id === e.detail.id); if (z) void this.patchZone(z, { polygon: e.detail.polygon }); }}
                  @marker-select=${(e: CustomEvent<MarkerSelectDetail>) => { if (this.placing || this.drawing) return; this.selectedId = e.detail.id; this.selectedZoneId = null; }}
                  @marker-move=${(e: CustomEvent<{ id: string; x: number; y: number }>) => { this.apply(e.detail.id, { position: { x: +e.detail.x.toFixed(4), y: +e.detail.y.toFixed(4) } }); this.selectedId = e.detail.id; }}
                  @marker-orient=${(e: CustomEvent<{ id: string; rotation: number; fov: number }>) => this.apply(e.detail.id, { rotation_degrees: e.detail.rotation, field_of_view_degrees: e.detail.fov })}
                  @plan-click=${(e: CustomEvent<{ x: number; y: number }>) => (this.drawing ? this.addDraftPoint(e.detail.x, e.detail.y) : this.place(e.detail.x, e.detail.y))}></sw-plan-canvas>
                ${this.placing ? html`<div class="placing-hint"><span>לחץ על התוכנית כדי להציב את ${this.placing.kind === 'camera' ? this.placing.camera.name : this.placing.entity.name || this.placing.entity.entity_id} · Esc לביטול</span></div>` : nothing}
                ${this.drawing ? html`<div class="placing-hint"><span>ציור אזור: לחץ להוספת פינות (${this.drawing.length}) · לחיצה על הפינה הראשונה או Enter מסיימים · Esc לביטול</span></div>` : nothing}
                <div class="legend"><span><i></i>מצלמות · ${cams}</span><span><i class="ent"></i>ישויות HA · ${ents}</span><span><i class="zone"></i>אזורים · ${this.zones.length}</span></div>
              </div>
              <div class="props">
                ${sel ? (sel.resource_type === 'camera' ? this.renderCameraInspector(sel) : this.renderEntityInspector(sel)) : this.selectedZone && this.tool !== 'zones' ? html`<sw-card heading="אזור" subheading=${this.selectedZone.name}>${this.renderZoneInspector(this.selectedZone)}</sw-card>` : this.renderToolPanel(b)}
                ${(sel || (this.selectedZone && this.tool !== 'zones')) && this.tool !== 'select' ? this.renderToolPanel(b) : nothing}
                ${this.renderVersionCard(b)}
              </div>
            </div>`}
      </sw-page>
    `;
  }
}
