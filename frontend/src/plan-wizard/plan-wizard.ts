/**
 * PLAN3D-R28-WIZARD-2433: "תוכנית חדשה מתמונה" - the guided seven-step path from a picture of a floor plan to a 3D floor with
 * its devices (approved round 28 mockup, map3d/app/wizard.html): upload, detection, review, rooms, style, devices, done.
 *
 * It is a front for the Plan Studio that already exists - the same plan version, the same detector and accept, the same zones,
 * room materials and anchors (wizard-backend.ts) - so everything it makes stays editable in the studio ("המשך עריכה בסטודיו").
 * Nothing reaches the viewers before "פרסם": the version stays a draft and the devices are placed only when it is published.
 * Route: #/explore/floors/<id>/wizard (the shell's structure guard applies on a phone, like /edit and /import).
 */
import { LitElement, html, nothing, svg, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import type { IconName } from '../components/sw-icon';
import { navigate } from '../router';
import { ApiError, describeError } from '../api/client';
import { findFloor, loadTree } from '../api/catalog';
import type { DetectResult } from '../api/geometry';
import { fromResult, rescale, type CandidateSet } from '../map/candidates';
import { effectiveScale, type GeometryDoc } from '../map/geometry';
import { buildScene, type SceneDescription } from '../map/scene-builder';
import { MATERIALS } from '../map/material-resolve';
import { wizardBackend, type CreatedRoom, type Draft, type SceneCatalog, type UploadedPlan, type VersionInfo, type WizardBackend } from './wizard-backend';
import {
  KITS, OPENING_CHOICES, ROOM_TYPES, WALL_CHOICES, WHERE_HE, WIZARD_DEFAULTS, applyKit, bandCounts, bandOf, detectedChoice, detectedText, fallbackRoomName,
  guessRoomType, kitFloor, kitOf, longestWall, normalizePrefs, placeByArea, reviewQueue, roomType, selection, type Choice, type KitId, type Placement, type WizardPrefs,
} from './wizard-model';
import { candidateGeometry, detectOverlay, devicesOverlay, itemPoint, roomColour, roomsOverlay, type CandidateGeometry } from './wizard-draw';
import { wizardStyles } from './wizard-styles';

const STEPS = ['העלאה', 'זיהוי', 'בדיקה', 'חדרים', 'סגנון', 'התקנים', 'סיום'] as const;
const ROOMS_PAGE = 8;
const ROOMS_PAGE_SMALL = 4;
const DEVS_PAGE = 7;
const DEVS_PAGE_SMALL = 4;

interface RoomRow {
  polygon: { x: number; y: number }[];
  name: string;
  typeId: string;
}
type Phase = 'idle' | 'run' | 'done' | 'error';

const tint = (id: string, dark: boolean): string => {
  const m = MATERIALS.find((x) => x.id === id) as unknown as { tint?: { light: string; dark: string } } | undefined;
  return m?.tint ? (dark ? m.tint.dark : m.tint.light) : '#cccccc';
};
const iconOf = (domain: string): IconName => (domain === 'light' ? 'light' : domain === 'lock' ? 'lock' : domain === 'cover' ? 'coverClose' : domain === 'camera' ? 'camera' : domain === 'sensor' ? 'thermometer' : 'sensor');

@customElement('plan-wizard-screen')
export class PlanWizardScreen extends LitElement {
  static styles = wizardStyles;

  @property() floorId = '';
  /** Demo mode only (`?step=`): open the sample house at that step, the steps before it done (the screenshots' entry). */
  @property({ type: Number }) demoStep = 0;

  @state() private step = 1;
  @state() private prefs: WizardPrefs = { ...WIZARD_DEFAULTS };
  @state() private prefsOpen = false;
  @state() private prefsDraft: WizardPrefs = { ...WIZARD_DEFAULTS };
  @state() private floor: { name: string; crumb: string; hasPlan: boolean; siblings: { id: string; name: string }[] } | null = null;
  @state() private ceiling = 2.8;
  @state() private busy = false;
  @state() private error = '';
  @state() private dragOver = false;
  @state() private uploaded: UploadedPlan | null = null;
  @state() private page = 1;
  @state() private version: VersionInfo | null = null;
  // detection
  @state() private phases: { structure: Phase; rooms: Phase } = { structure: 'idle', rooms: 'idle' };
  @state() private elapsed = 0;
  @state() private result: DetectResult | null = null;
  @state() private set: CandidateSet | null = null;
  @state() private draft: Draft | null = null;
  // review
  @state() private decisions: Record<string, Choice> = {};
  @state() private current: string | null = null;
  @state() private measure: { open: boolean; metres: string } = { open: false, metres: '' };
  // rooms
  @state() private rooms: RoomRow[] = [];
  @state() private roomsPage = 0;
  @state() private roomFocus: number | null = null;
  @state() private existingAuto = 0;
  @state() private replaceAuto = false;
  @state() private areas: { area_id: string; name: string }[] = [];
  @state() private created: CreatedRoom[] = [];
  // style
  @state() private kit: KitId = 'apartment';
  @state() private furniture = true;
  @state() private catalog: SceneCatalog = { lookup3d: null, materials: null };
  @state() private three: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  // devices
  @state() private placements: Placement[] = [];
  @state() private skipped: Set<string> = new Set();
  @state() private selDev: string | null = null;
  @state() private devPage = 0;
  // done
  @state() private done: { placed: number; failed: number } | null = null;

  private backend: WizardBackend | null = null;
  private timer: number | undefined;
  private token = 0;
  private small = false;
  private mq: MediaQueryList | null = null;
  private onMq = () => {
    this.small = !!this.mq?.matches;
    this.requestUpdate();
  };
  private onKey = (e: KeyboardEvent) => this.key(e);

  connectedCallback(): void {
    super.connectedCallback();
    try {
      this.mq = window.matchMedia('(max-width: 767px), (max-height: 760px)');
      this.small = this.mq.matches;
      this.mq.addEventListener('change', this.onMq);
    } catch {
      this.mq = null;
    }
    window.addEventListener('keydown', this.onKey);
    void this.init();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.mq?.removeEventListener('change', this.onMq);
    window.removeEventListener('keydown', this.onKey);
    clearInterval(this.timer);
    this.token++;
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('floorId') && changed.get('floorId') !== undefined) void this.init();
  }

  private async init() {
    const token = ++this.token;
    this.backend = wizardBackend(this.floorId);
    const b = this.backend;
    try {
      const [prefs, tree] = await Promise.all([b.prefs(), loadTree()]);
      if (token !== this.token) return;
      this.prefs = prefs;
      this.kit = prefs.kit;
      this.furniture = prefs.furniture && prefs.kit !== 'empty';
      const hit = findFloor(tree, this.floorId);
      if (hit) {
        this.floor = {
          name: hit.floor.name, crumb: `${hit.site.name} · ${hit.building.name}`, hasPlan: hit.floor.has_plan,
          siblings: (hit.building.floors ?? []).map((f) => ({ id: f.id, name: f.name })),
        };
      } else this.floor = { name: '', crumb: '', hasPlan: false, siblings: [] };
    } catch (err) {
      if (token === this.token) this.error = describeError(err);
    }
    if (b.demo && this.demoStep > 1) await this.demoTo(Math.min(7, this.demoStep), token);
  }

  /** Demo screenshots: walk the sample house to step `n` with the recommended answers (step 2 stays mid-detection). */
  private async demoTo(n: number, token: number) {
    await this.onFile(new File(['demo'], 'תוכנית-קרקע.png', { type: 'image/png' }), n === 2);
    if (token !== this.token || n <= 3) return;
    await this.confirmReview();
    if (token !== this.token || n <= 4) return;
    await this.saveRooms();
    if (token !== this.token || n <= 5) return;
    await this.saveStyle();
    if (token !== this.token || n <= 6) return;
    this.step = 7;
  }

  // ------------------------------------------------------------ step 1: upload

  private async onFile(file: File | undefined, holdDetection = false) {
    const b = this.backend;
    if (!file || !b || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      this.uploaded = await b.upload(file);
      this.page = 1;
      if (this.uploaded.pages.length > 1) return; // the page is chosen first
      await this.startVersion(holdDetection);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async startVersion(holdDetection = false) {
    const b = this.backend;
    if (!b || !this.uploaded) return;
    this.version = await b.createVersion(this.uploaded.assetId, this.page);
    this.step = 2;
    await this.runDetect(holdDetection);
  }

  private async pickPage() {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await this.startVersion();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  // ------------------------------------------------------------ step 2: detection

  private async runDetect(hold = false) {
    const b = this.backend;
    const v = this.version;
    if (!b || !v) return;
    const token = this.token;
    this.error = '';
    this.phases = { structure: 'run', rooms: 'idle' };
    const started = Date.now();
    this.elapsed = 0;
    clearInterval(this.timer);
    this.timer = window.setInterval(() => (this.elapsed = Math.floor((Date.now() - started) / 1000)), 1000);
    if (hold) {
      clearInterval(this.timer);
      return;
    }
    try {
      const [draft, r] = await Promise.all([b.draft(v.versionId), b.detect(v.versionId)]);
      if (token !== this.token) return;
      this.draft = draft;
      this.result = r;
      this.set = this.scaled(fromResult(r), draft.doc);
      this.phases = { structure: 'done', rooms: 'run' };
      this.decisions = {};
      this.current = reviewQueue(this.set, this.prefs)[0]?.id ?? null;
      try {
        const rooms = await b.detectRooms();
        if (token !== this.token) return;
        this.rooms = rooms.rooms.map((c) => ({ polygon: c.polygon, name: c.name, typeId: guessRoomType(c.name) ?? 'other' }));
        this.existingAuto = rooms.existingAuto;
        this.phases = { structure: 'done', rooms: 'done' };
      } catch {
        this.rooms = []; // the rooms can still be drawn in the studio; the structure is not lost
        this.phases = { structure: 'done', rooms: 'error' };
      }
      this.step = 3;
    } catch (err) {
      if (token !== this.token) return;
      const timedOut = err instanceof ApiError && err.code === 'detect_timeout';
      this.error = timedOut ? 'הזיהוי לא הסתיים בזמן. תוכנית גדולה או סריקה רועשת לוקחות זמן: נסה שוב, או המשך בסטודיו התוכניות.' : describeError(err);
      this.phases = { ...this.phases, structure: 'error' };
    } finally {
      clearInterval(this.timer);
    }
  }

  /** The metres follow the draft's effective scale, whatever the server assumed (as the studio's detect tool does). */
  private scaled(set: CandidateSet, doc: GeometryDoc): CandidateSet {
    const { scale } = effectiveScale(doc);
    return set.scaleMPerPx === null || Math.abs(set.scaleMPerPx - scale) > scale * 1e-6 ? rescale(set, scale) : set;
  }

  // ------------------------------------------------------------ step 3: review

  private get queue() {
    return this.set ? reviewQueue(this.set, this.prefs) : [];
  }

  private decide(choice: Choice) {
    const id = this.current;
    if (!id) return;
    this.decisions = { ...this.decisions, [id]: choice };
    const q = this.queue;
    const i = q.findIndex((x) => x.id === id);
    const next = q.slice(i + 1).find((x) => !(x.id in this.decisions)) ?? q.find((x) => !(x.id in this.decisions));
    if (next) this.current = next.id;
  }

  private moveQueue(d: number) {
    const q = this.queue;
    if (!q.length) return;
    const i = q.findIndex((x) => x.id === this.current);
    this.current = q[Math.max(0, Math.min(q.length - 1, (i < 0 ? 0 : i) + d))].id;
  }

  private async measureWall() {
    const b = this.backend;
    const v = this.version;
    const set = this.set;
    const m = parseFloat(this.measure.metres.replace(',', '.'));
    if (!b || !v || !set || !this.draft || !(m > 0) || this.busy) return;
    const target = longestWall(set, this.draft.doc.dimensions.width_px, this.draft.doc.dimensions.height_px);
    if (!target) return;
    this.busy = true;
    this.error = '';
    try {
      await b.measure(v.versionId, target.a, target.b, m);
      this.draft = await b.draft(v.versionId);
      this.set = this.scaled(set, this.draft.doc);
      this.measure = { open: false, metres: '' };
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async confirmReview() {
    const b = this.backend;
    const v = this.version;
    const r = this.result;
    if (!b || !v || !r || !this.set || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      let draft = await b.draft(v.versionId);
      const cal = draft.doc.dimensions.calibration?.status;
      if (cal !== 'measured' && cal !== 'estimated' && r.calibration_hint) {
        await b.estimate(v.versionId, r.calibration_hint);
        draft = await b.draft(v.versionId);
      }
      const set = this.scaled(this.set, draft.doc);
      const sel = selection(set, this.decisions, this.prefs);
      this.draft = await b.accept(v.versionId, {
        accepted: sel.accepted, edits: sel.edits, replace_auto: true,
        candidates: { walls: set.walls, openings: set.openings, objects: set.objects }, base_revision: draft.revision, detector: r.detector,
      });
      this.set = set;
      this.step = 4;
      this.roomsPage = 0;
      if (!this.areas.length) this.areas = await b.areas().catch(() => []);
    } catch (err) {
      this.error = err instanceof ApiError && err.code === 'stale_revision' ? 'טיוטת המבנה השתנתה בינתיים בחלון אחר. אשר שוב.' : describeError(err);
    } finally {
      this.busy = false;
    }
  }

  // ------------------------------------------------------------ step 4: rooms

  private areaOf(name: string): string | null {
    const n = name.trim();
    return n ? (this.areas.find((a) => a.name === n)?.area_id ?? null) : null;
  }

  private setRoom(i: number, patch: Partial<RoomRow>) {
    this.rooms = this.rooms.map((r, k) => {
      if (k !== i) return r;
      const next = { ...r, ...patch };
      // a typed name suggests the type while the type was not chosen by hand
      if (patch.name !== undefined && (r.typeId === 'other' || r.typeId === guessRoomType(r.name))) next.typeId = guessRoomType(patch.name) ?? r.typeId;
      return next;
    });
  }

  private async saveRooms() {
    const b = this.backend;
    if (!b || this.busy) return;
    if (!this.rooms.length) {
      this.created = [];
      this.step = 5;
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      const list = this.rooms.map((r, i) => ({ polygon: r.polygon, name: r.name.trim() || fallbackRoomName(i), kind: roomType(r.typeId).kind }));
      const made = await b.acceptRooms(list, this.replaceAuto, this.created.map((c) => c.id));
      for (let i = 0; i < made.length; i++) await b.tagRoom(made[i], roomType(this.rooms[i]?.typeId).tags, this.areaOf(this.rooms[i]?.name ?? ''));
      this.created = made;
      this.step = 5;
      void this.loadThree();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  // ------------------------------------------------------------ step 5: style

  private async loadThree() {
    if (this.three !== 'idle' || !this.backend) return;
    this.three = 'loading';
    try {
      const [, cat] = await Promise.all([import('../map/sw-plan-3d'), this.backend.catalog()]);
      this.catalog = cat;
      this.three = 'ready';
    } catch {
      this.three = 'failed';
    }
  }

  private styledRooms() {
    return this.created.map((c, i) => ({ id: c.id, typeId: this.rooms[i]?.typeId ?? 'other', polygon: c.polygon, level_id: c.level_id }));
  }

  /** The draft as it will be saved: the kit, the furniture and the ceiling height of step 1. */
  private styledDoc(): GeometryDoc | null {
    const d = this.draft?.doc;
    if (!d) return null;
    const withCeiling: GeometryDoc = { ...d, levels: d.levels.map((l) => (l.is_default || d.levels.length === 1 ? { ...l, ceiling_height_m: this.ceiling } : l)) };
    return applyKit(withCeiling, this.styledRooms(), kitOf(this.kit), this.furniture && this.kit !== 'empty', effectiveScale(d).scale);
  }

  private sceneMemo: { key: string; desc: SceneDescription | null } = { key: '', desc: null };
  private scene(): SceneDescription | null {
    const doc = this.styledDoc();
    if (!doc || this.three !== 'ready') return null;
    const key = `${this.draft?.revision}|${this.kit}|${this.furniture}|${this.ceiling}|${this.created.map((c) => c.id).join(',')}`;
    if (this.sceneMemo.key === key) return this.sceneMemo.desc;
    let desc: SceneDescription | null = null;
    try {
      desc = buildScene({
        doc, width: doc.dimensions.width_px, height: doc.dimensions.height_px, anchors: [], entityStates: {}, circuitStates: {},
        catalog: this.catalog.lookup3d, materialsCatalog: this.catalog.materials, realistic: true,
        zones: this.created.map((c, i) => ({ id: c.id, name: this.rooms[i]?.name || fallbackRoomName(i), polygon: c.polygon, level_id: c.level_id })),
      });
    } catch {
      desc = null;
    }
    this.sceneMemo = { key, desc };
    return desc;
  }

  private async saveStyle() {
    const b = this.backend;
    const v = this.version;
    const doc = this.styledDoc();
    if (!b || !v || !doc || !this.draft || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      this.draft = await b.saveDraft(v.versionId, doc, this.draft.revision);
      await this.proposeDevices();
      this.step = 6;
    } catch (err) {
      this.error = err instanceof ApiError && err.code === 'stale_revision' ? 'טיוטת המבנה השתנתה בינתיים בחלון אחר. חזור לשלב הזה ונסה שוב.' : describeError(err);
    } finally {
      this.busy = false;
    }
  }

  // ------------------------------------------------------------ step 6: devices

  private async proposeDevices() {
    const b = this.backend;
    if (!b || !this.draft) return;
    const ents = await b.entities().catch(() => []);
    const doc = this.draft.doc;
    const W = doc.dimensions.width_px;
    const H = doc.dimensions.height_px;
    const g = candidateGeometry(doc, { walls: doc.walls, openings: doc.openings, objects: [], pixels: {}, scaleMPerPx: null });
    const openings = doc.openings.map((o) => {
      const p = itemPoint(g, o.id);
      return p ? { id: o.id, kind: o.kind, x: p[0] / W, y: p[1] / H } : null;
    }).filter((o): o is NonNullable<typeof o> => !!o);
    const rooms = this.created.map((c, i) => ({ id: c.id, name: this.rooms[i]?.name.trim() || fallbackRoomName(i), area_id: this.areaOf(this.rooms[i]?.name ?? ''), polygon: c.polygon }));
    // the floor's own catalogue: devices of the areas this floor's rooms stand for, plus (demo) the unassigned ones of the floor
    const linked = new Set(rooms.map((r) => r.area_id).filter(Boolean));
    const mine = ents.filter((e) => (e.area_id ? linked.has(e.area_id) : b.demo));
    // the ones a person places by hand go first, as in the mockup: they are what is left to do
    const list = placeByArea(mine, rooms, openings, this.prefs.auto_place);
    this.placements = [...list.filter((p) => p.where === 'manual'), ...list.filter((p) => p.where !== 'manual')];
    this.skipped = new Set();
    this.selDev = null;
    this.devPage = 0;
  }

  private placeAt(e: MouseEvent) {
    if (this.step !== 6 || !this.selDev || !this.draft) return;
    const svgEl = (e.currentTarget as SVGSVGElement);
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svgEl.getScreenCTM();
    if (!m) return;
    const p = pt.matrixTransform(m.inverse());
    const W = this.draft.doc.dimensions.width_px;
    const H = this.draft.doc.dimensions.height_px;
    const x = Math.round(Math.min(1, Math.max(0, p.x / W)) * 1e5) / 1e5;
    const y = Math.round(Math.min(1, Math.max(0, p.y / H)) * 1e5) / 1e5;
    const id = this.selDev;
    this.placements = this.placements.map((d) => (d.entity_id === id ? { ...d, x, y, where: d.where === 'manual' ? 'centre' : d.where } : d));
    const s = new Set(this.skipped);
    s.delete(id);
    this.skipped = s;
    this.selDev = null;
  }

  private toggleSkip(id: string) {
    const s = new Set(this.skipped);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.skipped = s;
    if (this.selDev === id) this.selDev = null;
  }

  private get toPlace() {
    return this.placements.filter((d) => d.x !== null && d.y !== null && d.where !== 'manual' && !this.skipped.has(d.entity_id));
  }

  // ------------------------------------------------------------ step 7: publish

  private async publish() {
    const b = this.backend;
    const v = this.version;
    if (!b || !v || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const level = this.draft?.doc.levels.find((l) => l.is_default)?.id ?? this.draft?.doc.levels[0]?.id ?? null;
      this.done = await b.publish(v.versionId, this.toPlace.map((d) => ({ entity_id: d.entity_id, x: d.x!, y: d.y!, level_id: level })));
      if (!this.done.failed) navigate(`/explore/floors/${this.floorId}`);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private toStudio() {
    navigate(`/explore/floors/${this.floorId}/edit`);
  }

  // ------------------------------------------------------------ navigation

  private back() {
    if (this.busy || this.step <= 1) return;
    this.error = '';
    // step 2 is a run, not a place: back from the review goes to the upload
    this.step = this.step === 3 ? 1 : this.step - 1;
    if (this.step === 1) {
      this.version = null;
      this.uploaded = null;
      this.phases = { structure: 'idle', rooms: 'idle' };
    }
  }

  private next() {
    if (this.busy) return;
    if (this.step === 1 && this.uploaded && this.uploaded.pages.length > 1) void this.pickPage();
    else if (this.step === 2 && this.phases.structure === 'error') void this.runDetect();
    else if (this.step === 3) void this.confirmReview();
    else if (this.step === 4) void this.saveRooms();
    else if (this.step === 5) void this.saveStyle();
    else if (this.step === 6) this.step = 7;
    else if (this.step === 7) void this.publish();
  }

  private key(e: KeyboardEvent) {
    if (this.step !== 3 || this.prefsOpen || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.composedPath()[0] as HTMLElement | undefined;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    const n = Number(e.key);
    const choices = this.choicesFor(this.current);
    if (n >= 1 && n <= choices.length) {
      e.preventDefault();
      this.decide(choices[n - 1].id);
    }
  }

  private choicesFor(id: string | null): readonly { id: Choice; he: string }[] {
    if (!id || !this.set) return [];
    if (this.set.walls.some((w) => w.id === id)) return WALL_CHOICES;
    // two by two, as in the mockup: a window's own choice instead of the sliding door for an item seen as a window
    const win = this.set.openings.find((o) => o.id === id)?.kind === 'window';
    return OPENING_CHOICES.filter((c) => (win ? c.id !== 'sliding' : c.id !== 'window'));
  }

  // ------------------------------------------------------------ settings

  private openPrefs() {
    this.prefsDraft = { ...this.prefs };
    this.prefsOpen = true;
  }

  private async savePrefs() {
    const b = this.backend;
    const p = normalizePrefs(this.prefsDraft);
    this.prefsOpen = false;
    this.prefs = p;
    if (this.step <= 3) {
      this.kit = p.kit;
      this.furniture = p.furniture && p.kit !== 'empty';
    }
    if (this.set && !this.queue.some((q) => q.id === this.current)) this.current = this.queue[0]?.id ?? null;
    try {
      await b?.savePrefs(p);
    } catch (err) {
      this.error = describeError(err);
    }
  }

  // ------------------------------------------------------------ render

  render() {
    const step = this.step;
    const W = this.draft?.doc.dimensions.width_px ?? this.version?.width ?? 1000;
    const H = this.draft?.doc.dimensions.height_px ?? this.version?.height ?? 1000;
    return html`<div class="wz" data-wizard-step=${step}>
        ${this.renderSteps()}
        <div class="wz-canvas" data-wz-canvas>${this.renderCanvas(W, H)}</div>
        <div class="wz-side" data-wz-side>${this.renderSide(W, H)}</div>
        ${this.renderFoot()}
      </div>
      ${this.prefsOpen ? this.renderPrefs() : nothing}`;
  }

  private renderSteps() {
    const step = this.step;
    return html`<div class="wz-steps" role="list" aria-label="שלבי האשף">
      ${STEPS.map((n, i) => html`${i ? html`<i class="ln ${i < step ? 'done' : ''}" aria-hidden="true"></i>` : nothing}<span role="listitem" class="st ${i + 1 < step ? 'done' : i + 1 === step ? 'now' : ''}" aria-current=${i + 1 === step ? 'step' : 'false'}><i class="num">${i + 1 < step ? html`<sw-icon name="check" size="14"></sw-icon>` : i + 1}</i><span>${n}</span></span>`)}
      <div class="mob"><span>${STEPS[step - 1]}</span><small class="num">שלב ${step} מתוך 7</small><span class="bar" aria-hidden="true"><i style="inline-size:${(step / 7) * 100}%"></i></span></div>
      <button class="gear" data-wz-prefs aria-label="הגדרות האשף" title="הגדרות האשף" @click=${() => this.openPrefs()}><sw-icon name="system" size="18"></sw-icon></button>
    </div>`;
  }

  private planSvg(W: number, H: number, overlay: unknown, opts: { crop?: [number, number, number, number]; click?: (e: MouseEvent) => void; placing?: boolean } = {}) {
    const url = this.version?.imageUrl ?? '';
    const vb = opts.crop ?? [0, 0, W, H];
    return html`<svg class="plan ${opts.placing ? 'placing' : ''}" viewBox=${vb.join(' ')} preserveAspectRatio=${opts.crop ? 'xMidYMid slice' : 'xMidYMid meet'}
        style=${opts.crop ? '' : `aspect-ratio:${W}/${H}`} role="img" aria-label="תוכנית הקומה" @click=${opts.click ?? (() => undefined)}>
      <rect x=${vb[0]} y=${vb[1]} width=${vb[2]} height=${vb[3]} fill="#fff"/>
      ${url ? svg`<image href=${url} x="0" y="0" width=${W} height=${H} preserveAspectRatio="none" opacity=${overlay === nothing ? 1 : 0.55}/>` : nothing}
      ${overlay}
    </svg>`;
  }

  private get geom(): CandidateGeometry | null {
    if (!this.set || !this.draft) return null;
    const key = `${this.draft.revision}|${this.set.walls.length}|${this.set.openings.length}|${this.set.scaleMPerPx}`;
    if (this.geomMemo?.key !== key) this.geomMemo = { key, g: candidateGeometry(this.draft.doc, this.set) };
    return this.geomMemo.g;
  }
  private geomMemo: { key: string; g: CandidateGeometry } | null = null;

  private onCandClick(e: MouseEvent) {
    const el = (e.target as Element).closest('[data-cand]');
    const id = el?.getAttribute('data-cand');
    if (id) this.current = id;
  }

  private onRoomClick(e: MouseEvent) {
    const el = (e.target as Element).closest('[data-room]');
    const i = el ? Number(el.getAttribute('data-room')) : NaN;
    if (!Number.isFinite(i)) return;
    const size = this.small ? ROOMS_PAGE_SMALL : ROOMS_PAGE;
    this.roomFocus = i;
    this.roomsPage = Math.floor(i / size);
    void this.updateComplete.then(() => (this.renderRoot.querySelector(`[data-room-name="${i}"]`) as HTMLInputElement | null)?.focus());
  }

  private renderCanvas(W: number, H: number) {
    const step = this.step;
    if (step === 1) {
      return html`<div class="drop ${this.dragOver ? 'over' : ''}" data-wz-drop
          @dragover=${(e: DragEvent) => { e.preventDefault(); this.dragOver = true; }} @dragleave=${() => (this.dragOver = false)}
          @drop=${(e: DragEvent) => { e.preventDefault(); this.dragOver = false; void this.onFile(e.dataTransfer?.files?.[0]); }}>
        <sw-icon class="big" name="upload" size="44"></sw-icon>
        <b>${this.uploaded ? this.uploaded.name : 'גרור לכאן את תוכנית הקומה'}</b>
        <span class="hide-ph">${this.uploaded && this.uploaded.pages.length > 1 ? 'בחר בצד את העמוד שבו נמצאת התוכנית' : 'תמונה או PDF של תוכנית אדריכלית, שרטוט מכירות או סריקה'}</span>
        <div class="row">
          <span><input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" data-wz-file @change=${(e: Event) => void this.onFile((e.target as HTMLInputElement).files?.[0])} /><sw-button variant="primary" size="lg" ?disabled=${this.busy} @click=${(e: Event) => ((e.currentTarget as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement | null)?.click()}>${this.busy ? 'מעלה…' : 'בחר קובץ'}</sw-button></span>
          <span><input type="file" accept="image/*" capture="environment" @change=${(e: Event) => void this.onFile((e.target as HTMLInputElement).files?.[0])} /><sw-button size="lg" icon="camera" ?disabled=${this.busy} @click=${(e: Event) => ((e.currentTarget as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement | null)?.click()}>צלם</sw-button></span>
        </div>
        <div class="fmts"><span class="tag">PNG</span><span class="tag">JPG</span><span class="tag">PDF</span><a class="tag" href=${`#/explore/floors/${this.floorId}/import`}>DXF / IFC: ייבוא מדויק, בלי זיהוי</a></div>
      </div>`;
    }
    if (step === 2) {
      return html`<div class="sheet">${this.planSvg(W, H, nothing)}</div>${this.phases.structure === 'run' ? html`<i class="scan" aria-hidden="true"></i>` : nothing}`;
    }
    if (step === 3) {
      const g = this.geom;
      const set = this.set;
      if (!g || !set) return nothing;
      const rejected = new Set(Object.entries(this.decisions).filter(([, c]) => c === 'none').map(([id]) => id));
      return html`<div class="sheet">${this.planSvg(W, H, detectOverlay(g, set, this.prefs, new Set(Object.keys(this.decisions)), rejected, this.current), { click: (e) => this.onCandClick(e) })}</div>
        <div class="legend"><span><i style="background:var(--wz-sure)"></i>זוהה בביטחון</span><span><i style="background:var(--wz-check)"></i>לבדיקה</span><span><i class="dash"></i>בספק, לא ייכנס בלי אישור</span><span><i style="background:var(--wz-out)"></i>הושמט</span></div>`;
    }
    if (step === 4) {
      return html`<div class="sheet">${this.planSvg(W, H, roomsOverlay(this.rooms, W, H, 'name', this.roomFocus), { click: (e) => this.onRoomClick(e) })}</div>`;
    }
    if (step === 5 || step === 7) {
      const desc = this.scene();
      if (desc) return html`<div class="preview3d"><sw-plan-3d data-wz-3d .description=${desc} .frameKey=${`wizard-${this.version?.versionId ?? ''}`} .preset=${'iso'} kiosk .qualityForce=${'full'} .minFps=${0}></sw-plan-3d></div><span class="preview-note">תצוגה מקדימה</span>`;
      // no 3D (loading, no WebGL): the plan with the kit's floors, so the choice still shows
      const dark = matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
      const kit = kitOf(this.kit);
      const fills = svg`<g>${this.created.map((c, i) => svg`<polygon points=${c.polygon.map((p) => `${p.x * W},${p.y * H}`).join(' ')} fill=${tint(kitFloor(kit, this.rooms[i]?.typeId ?? 'other'), dark)} fill-opacity=".85"/>`)}</g>`;
      return html`<div class="sheet">${this.planSvg(W, H, fills)}</div><span class="preview-note">${this.three === 'loading' ? 'טוען תצוגה בתלת־ממד…' : 'תצוגה מקדימה'}</span>`;
    }
    // step 6
    const overlay = svg`${roomsOverlay(this.created.map((c) => ({ polygon: c.polygon })), W, H, 'faint', null)}${devicesOverlay(this.placements.filter((d) => !this.skipped.has(d.entity_id)), W, H, this.selDev)}`;
    return html`<div class="sheet">${this.planSvg(W, H, overlay, { click: (e) => this.placeAt(e), placing: !!this.selDev })}</div>
      <div class="legend"><span><i class="dot" style="background:var(--wz-sure)"></i>הוצב</span><span><i class="dot" style="background:var(--wz-check)"></i>ממתין למקום</span></div>`;
  }

  private renderSide(W: number, H: number) {
    return html`${this.sideFor(W, H)}${this.error ? html`<div class="card err" role="alert" data-wz-error>${this.error}</div>` : nothing}`;
  }

  private sideFor(W: number, H: number) {
    const step = this.step;
    if (step === 1) {
      const multi = this.uploaded && this.uploaded.pages.length > 1;
      return html`<h2>העלאת תוכנית</h2><p>המערכת תזהה קירות, דלתות, חלונות וחדרים, ואתה תאשר. כמה דקות לקומה.</p>
        <div class="card"><div class="kv">
          <b>לאיזו קומה?</b>
          <select style="inline-size:160px" aria-label="הקומה" data-wz-floor .value=${this.floorId} @change=${(e: Event) => navigate(`/explore/floors/${(e.target as HTMLSelectElement).value}/wizard`)}>
            ${(this.floor?.siblings.length ? this.floor.siblings : [{ id: this.floorId, name: this.floor?.name || this.floorId }]).map((f) => html`<option value=${f.id} ?selected=${f.id === this.floorId}>${f.name}</option>`)}
          </select>
          <b class="hide-ph">גובה תקרה</b>
          <select class="hide-ph" style="inline-size:160px" aria-label="גובה תקרה" .value=${String(this.ceiling)} @change=${(e: Event) => (this.ceiling = Number((e.target as HTMLSelectElement).value))}>
            ${[2.5, 2.6, 2.7, 2.8, 3, 3.2, 3.5, 4, 5].map((v) => html`<option value=${String(v)} ?selected=${v === this.ceiling}>${v.toFixed(2)} מ׳</option>`)}
          </select>
        </div></div>
        ${multi
          ? html`<div class="card"><b>באיזה עמוד התוכנית?</b><div class="side-actions" style="margin-block-start:8px">${this.uploaded!.pages.map((p) => html`<button class="opt" style="inline-size:64px" aria-pressed=${p.page === this.page ? 'true' : 'false'} @click=${() => (this.page = p.page)}>${p.page}</button>`)}</div></div>`
          : html`<div class="card soft hide-ph"><b>כדי שהזיהוי יצליח</b><div class="tips"><span>סריקה ישרה וחדה, בלי צל או קיפול.</span><span>קירות כהים על רקע בהיר.</span><span>ריהוט וכיתוב על התוכנית לא מפריעים.</span></div></div>`}
        ${this.floor?.hasPlan ? html`<div class="side-actions"><sw-button variant="ghost" icon="edit" @click=${() => this.toStudio()}>שרטוט ידני בסטודיו</sw-button></div>` : nothing}`;
    }
    if (step === 2) {
      const p = (st: Phase, t: string, v = '') => html`<div class="p ${st === 'done' ? 'done' : st === 'run' ? 'run' : ''}"><i>${st === 'done' ? html`<sw-icon name="check" size="13"></sw-icon>` : st === 'error' ? html`<sw-icon name="warning" size="13"></sw-icon>` : nothing}</i>${t}<span class="v">${v}</span></div>`;
      const s = this.phases.structure;
      const r = this.phases.rooms;
      return html`<h2>מזהה את התוכנית</h2><p>הזיהוי רץ אצלך במערכת. התוכנית לא נשלחת לשום מקום.</p>
        <div class="card"><div class="prog" data-wz-progress>
          ${p(s, 'קירות', s === 'done' ? `${this.set?.walls.length ?? 0} נמצאו` : '')}
          ${p(s, 'דלתות, חלונות ומעברים', s === 'done' ? `${this.set?.openings.length ?? 0} נמצאו` : '')}
          ${p(s === 'done' ? 'done' : s === 'run' ? 'idle' : s, 'עמודים ומדרגות', s === 'done' ? `${this.set?.objects.length ?? 0}` : '')}
          ${p(r, 'חדרים סגורים', r === 'done' ? `${this.rooms.length} נמצאו` : r === 'error' ? 'לא זוהו' : '')}
          ${p(s === 'done' ? 'done' : 'idle', 'קנה מידה', s === 'done' ? (this.result?.calibration_hint ? 'משוער לפי רוחב דלת' : 'לא ידוע') : '')}
        </div></div>
        <div class="card soft hide-ph">קווי מידה, קווים מקווקווים ומסגרת הגיליון מזוהים ומושמטים, כדי שלא יהפכו לקירות.</div>
        ${s === 'run' ? html`<div class="why num" data-wz-elapsed>${this.elapsed ? `${this.elapsed} שנ׳` : ''}</div>` : nothing}`;
    }
    if (step === 3) return this.sideReview(W, H);
    if (step === 4) return this.sideRooms();
    if (step === 5) return this.sideStyle();
    if (step === 6) return this.sideDevices();
    return this.sideDone();
  }

  private sideReview(W: number, H: number) {
    const set = this.set;
    const g = this.geom;
    if (!set || !g) return nothing;
    const c = bandCounts(set, this.prefs);
    const q = this.queue;
    const id = this.current;
    const qi = q.findIndex((x) => x.id === id);
    const item = id ? (set.walls.find((w) => w.id === id) ?? set.openings.find((o) => o.id === id)) : undefined;
    const band = item ? bandOf(item.confidence, this.prefs) : 'sure';
    const pressed = id ? (this.decisions[id] ?? detectedChoice(set, id)) : null;
    const at = id ? itemPoint(g, id) : null;
    const crop: [number, number, number, number] | undefined = at ? [at[0] - 235, at[1] - 125, 470, 250] : undefined;
    const choices = this.choicesFor(id);
    const opening = id ? set.openings.find((o) => o.id === id) : undefined;
    const doc = this.draft?.doc;
    const cal = doc?.dimensions.calibration?.status;
    const rejected = new Set(Object.entries(this.decisions).filter(([, ch]) => ch === 'none').map(([k]) => k));
    return html`<h2>בדיקת הזיהוי</h2>
      <div class="cnts" data-wz-counts><div class="cnt"><b class="num">${c.sure}</b><span>בביטחון</span></div><div class="cnt chk"><b class="num">${c.check}</b><span>לבדיקה</span></div><div class="cnt low"><b class="num">${c.doubt}</b><span>בספק</span></div></div>
      ${q.length && item
        ? html`<div class="card" style="display:grid;gap:10px" data-wz-item=${id}>
            <div class="qhead"><b>מה יש כאן?</b><span class="pager"><button aria-label="הקודם" ?disabled=${qi <= 0} @click=${() => this.moveQueue(-1)}><sw-icon name="chevron" size="16"></sw-icon></button><span class="num" data-wz-pos>${qi < 0 ? '–' : qi + 1} / ${q.length}</span><button aria-label="הבא" ?disabled=${qi >= q.length - 1} @click=${() => this.moveQueue(1)}><sw-icon name="chevronBack" size="16"></sw-icon></button></span></div>
            <div class="q-crop">${this.planSvg(W, H, detectOverlay(g, set, this.prefs, new Set(Object.keys(this.decisions)), rejected, id), { crop })}</div>
            <div class="conf ${band}"><span>${detectedText(set, id!)}</span><span class="bar"><i style="inline-size:${Math.round(item.confidence * 100)}%"></i></span><b class="num">${Math.round(item.confidence * 100)}%</b></div>
            ${opening ? html`<div class="why hide-ph">${opening.kind === 'passage' ? `יש רווח בקיר ברוחב ${opening.width_m.toFixed(2)} מ׳, אבל לא נמצאה קשת של דלת.` : `ברוחב ${opening.width_m.toFixed(2)} מ׳.`}</div>` : nothing}
            <div class="opts" role="group" aria-label="מה יש כאן">${choices.map((ch, k) => html`<button class="opt" data-choice=${ch.id} aria-pressed=${pressed === ch.id ? 'true' : 'false'} @click=${() => this.decide(ch.id)}>${ch.he}<kbd class="hide-ph">${k + 1}</kbd></button>`)}</div>
          </div>`
        : html`<div class="card soft">כל מה שזוהה נמצא מעל סף הביטחון ויכנס לתוכנית. אפשר לתקן כל פריט אחר כך בסטודיו.</div>`}
      <div class="card soft hide-ph">${this.measure.open
        ? html`<div class="measure"><span>אורך הקיר הארוך ביותר</span><input type="number" inputmode="decimal" min="0.5" step="0.01" aria-label="אורך במטרים" placeholder="מ׳" .value=${this.measure.metres} @input=${(e: Event) => (this.measure = { ...this.measure, metres: (e.target as HTMLInputElement).value })} /><sw-button size="sm" variant="primary" ?disabled=${this.busy || !(parseFloat(this.measure.metres) > 0)} @click=${() => void this.measureWall()}>שמור</sw-button></div>`
        : html`<div class="kv"><span>קנה מידה <b>${cal === 'measured' ? 'נמדד' : 'משוער'}</b>${cal === 'measured' ? '' : this.result?.calibration_hint ? ', לפי רוחב דלת' : ''}</span><sw-button size="sm" icon="ruler" @click=${() => (this.measure = { open: true, metres: '' })}>מדוד קיר</sw-button></div>`}</div>`;
  }

  private sideRooms() {
    const size = this.small ? ROOMS_PAGE_SMALL : ROOMS_PAGE;
    const pages = Math.max(1, Math.ceil(this.rooms.length / size));
    const page = Math.min(this.roomsPage, pages - 1);
    const unnamed = this.rooms.filter((r) => !r.name.trim()).length;
    return html`<h2>שמות החדרים</h2><p>${this.rooms.length ? `נמצאו ${this.rooms.length} חדרים סגורים. תן שם לכל אחד, או בחר שם של אזור שכבר קיים במערכת כדי לקשר אליו.` : 'לא נמצאו חדרים סגורים. אפשר להמשיך ולסמן חדרים אחר כך בסטודיו.'}</p>
      <datalist id="wz-areas">${this.areas.map((a) => html`<option value=${a.name}></option>`)}</datalist>
      <div class="rooms" data-wz-rooms>${this.rooms.slice(page * size, page * size + size).map((r, k) => {
        const i = page * size + k;
        const linked = !!this.areaOf(r.name);
        return html`<div class="rrow"><i style="background:${roomColour(i)}"></i>
          <input type="text" list="wz-areas" data-room-name=${i} class="${r.name.trim() ? (linked ? 'linked' : '') : 'empty'}" .value=${r.name} placeholder=${`${fallbackRoomName(i)}: שם`} aria-label=${`שם חדר ${i + 1}`} title=${linked ? 'מקושר לאזור קיים' : ''}
            @focus=${() => (this.roomFocus = i)} @input=${(e: Event) => this.setRoom(i, { name: (e.target as HTMLInputElement).value })} />
          <select aria-label=${`סוג חדר ${i + 1}`} .value=${r.typeId} @change=${(e: Event) => this.setRoom(i, { typeId: (e.target as HTMLSelectElement).value })}>${ROOM_TYPES.map((t) => html`<option value=${t.id} ?selected=${t.id === r.typeId}>${t.id === 'other' ? 'סוג' : t.he}</option>`)}</select>
        </div>`;
      })}</div>
      <div class="rnote">${unnamed ? html`<span class="warn">${unnamed === 1 ? 'חדר אחד עוד בלי שם' : `${unnamed} חדרים עוד בלי שם`}</span>` : html`<span>${this.rooms.filter((r) => this.areaOf(r.name)).length} מקושרים לאזורים קיימים</span>`}
        ${pages > 1 ? html`<span class="pager"><button aria-label="הקודם" ?disabled=${page <= 0} @click=${() => (this.roomsPage = page - 1)}><sw-icon name="chevron" size="16"></sw-icon></button><span class="num">${page + 1} / ${pages}</span><button aria-label="הבא" ?disabled=${page >= pages - 1} @click=${() => (this.roomsPage = page + 1)}><sw-icon name="chevronBack" size="16"></sw-icon></button></span>` : nothing}</div>
      ${this.existingAuto ? html`<label class="check"><input type="checkbox" .checked=${this.replaceAuto} @change=${(e: Event) => (this.replaceAuto = (e.target as HTMLInputElement).checked)} />להחליף ${this.existingAuto === 1 ? 'חדר אוטומטי קודם' : `${this.existingAuto} חדרים אוטומטיים קודמים`} בקומה</label>` : nothing}`;
  }

  private sideStyle() {
    const dark = matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const sw = (k: (typeof KITS)[number]) => [kitFloor(k, 'living'), kitFloor(k, 'kitchen'), 'plaster_white', k.id === 'empty' ? 'plaster_ceiling' : k.id === 'office' ? 'fabric_accent' : 'wood_light'].map((m) => html`<i style="background:${tint(m, dark)}"></i>`);
    return html`<h2>סגנון וריהוט</h2><p>ערכה קובעת חומרים וריהוט התחלתי לכל חדר לפי הסוג שלו. אפשר לשנות אחר כך חדר־חדר בסטודיו.</p>
      <div class="presets" role="radiogroup" aria-label="ערכת סגנון">${KITS.map((k) => html`<button class="preset" role="radio" data-kit=${k.id} aria-checked=${k.id === this.kit ? 'true' : 'false'} aria-pressed=${k.id === this.kit ? 'true' : 'false'}
          @click=${() => { this.kit = k.id; if (k.id === 'empty') this.furniture = false; else if (this.prefs.furniture) this.furniture = true; }}><span class="sw" aria-hidden="true">${sw(k)}</span><span class="tx"><b>${k.he}</b><span>${k.note}</span></span></button>`)}</div>
      <label class="check"><input type="checkbox" data-wz-furniture .checked=${this.furniture} ?disabled=${this.kit === 'empty'} @change=${(e: Event) => (this.furniture = (e.target as HTMLInputElement).checked)} /><sw-icon name="cube" size="16"></sw-icon>להציב ריהוט התחלתי</label>
      <div class="card soft hide-ph">ערכות לובי, טכני וחניון ומסחרי יתווספו בהמשך.</div>`;
  }

  private sideDevices() {
    const size = this.small ? DEVS_PAGE_SMALL : DEVS_PAGE;
    const list = this.placements;
    const pages = Math.max(1, Math.ceil(list.length / size));
    const page = Math.min(this.devPage, pages - 1);
    const auto = list.filter((d) => d.where !== 'manual').length;
    const sel = this.selDev ? list.find((d) => d.entity_id === this.selDev) : null;
    return html`<h2>מיקום התקנים</h2>
      <p>${list.length ? `${auto} מתוך ${list.length} הוצבו לבד, לפי האזור והסוג. את השאר בוחרים ומסמנים על המפה.` : 'אין התקנים שמחכים למקום באזורים של החדרים האלה. אפשר להציב התקנים אחר כך מהמפה.'}</p>
      <div class="devs" data-wz-devs>${list.slice(page * size, page * size + size).map((d) => {
        const off = this.skipped.has(d.entity_id);
        const todo = d.where === 'manual' && !off;
        return html`<button class="dev ${todo ? 'todo' : ''} ${off ? 'off' : ''}" data-dev-row=${d.entity_id} aria-pressed=${this.selDev === d.entity_id ? 'true' : 'false'} @click=${() => (this.selDev = this.selDev === d.entity_id ? null : d.entity_id)}>
          <sw-icon name=${iconOf(d.domain)} size="16"></sw-icon><span class="nm">${d.name}</span><span class="w">${off ? WHERE_HE.none : WHERE_HE[d.where]}</span></button>`;
      })}</div>
      ${sel ? html`<div class="card soft" data-wz-dev-sel><b>${sel.name}</b>: לחץ על המפה כדי ${sel.where === 'manual' ? 'להציב' : 'להזיז'}.<div class="side-actions" style="margin-block-start:8px"><sw-button size="sm" variant="ghost" @click=${() => this.toggleSkip(sel.entity_id)}>${this.skipped.has(sel.entity_id) ? 'להציב בכל זאת' : 'לא להציב'}</sw-button></div></div>` : nothing}
      <div class="rnote"><span>רק התקנים מהקטלוג המאושר, שעוד לא על אף מפה</span>${pages > 1 ? html`<span class="pager"><button aria-label="הקודם" ?disabled=${page <= 0} @click=${() => (this.devPage = page - 1)}><sw-icon name="chevron" size="16"></sw-icon></button><span class="num">${page + 1} / ${pages}</span><button aria-label="הבא" ?disabled=${page >= pages - 1} @click=${() => (this.devPage = page + 1)}><sw-icon name="chevronBack" size="16"></sw-icon></button></span>` : nothing}</div>`;
  }

  private sideDone() {
    const doc = this.draft?.doc;
    const cal = doc?.dimensions.calibration?.status;
    return html`<h2>הקומה מוכנה</h2><p>נשמרה כטיוטה. היא תופיע לכולם רק אחרי פרסום.</p>
      <div class="card"><div class="kv" data-wz-summary>
        <span>קירות</span><b class="num">${doc?.walls.length ?? 0}</b>
        <span>דלתות, חלונות ומעברים</span><b class="num">${doc?.openings.length ?? 0}</b>
        <span>חדרים</span><b class="num">${this.created.length}</b>
        <span>התקנים שיוצבו</span><b class="num">${this.toPlace.length}</b>
        <span>סגנון</span><b>${kitOf(this.kit).he}</b>
        <span>קנה מידה</span><b>${cal === 'measured' ? 'נמדד' : 'משוער'}</b>
      </div></div>
      ${this.done?.failed ? html`<div class="card err">${this.done.placed} התקנים הוצבו, ${this.done.failed} לא הוצבו (אין הרשאה או שכבר הוצבו בינתיים). אפשר להציב אותם מהמפה.<div><sw-button size="sm" @click=${() => navigate(`/explore/floors/${this.floorId}`)}>פתח את המפה</sw-button></div></div>` : nothing}
      <div class="card soft hide-ph">רוצה לדייק קיר, להזיז רהיט או להוסיף מצלמה? הכול פתוח לעריכה בסטודיו התוכניות. התקנים מוצבים רק בפרסום מכאן.</div>
      <sw-button data-wz-studio @click=${() => this.toStudio()}>המשך עריכה בסטודיו</sw-button>`;
  }

  private renderFoot() {
    const step = this.step;
    const multi = step === 1 && this.uploaded && this.uploaded.pages.length > 1;
    const hint = step === 1 ? 'אפשר להעלות קומה אחת בכל פעם'
      : step === 2 ? 'בדרך כלל 5 עד 20 שניות'
      : step === 3 ? (this.prefs.unreviewed === 'as_detected' ? 'מה שלא תבדוק: "לבדיקה" ייכנס כמו שזוהה, "בספק" לא ייכנס' : 'מה שלא תבדוק לא ייכנס לתוכנית')
      : step === 4 ? 'חדר בלי שם יקבל "חדר 7", ואפשר לשנות אחר כך'
      : step === 5 ? 'התצוגה מתעדכנת מיד כשבוחרים ערכה'
      : step === 6 ? 'אפשר לדלג ולהציב התקנים אחר כך מהמפה'
      : 'אפשר לחזור ולתקן כל שלב';
    const label = step === 1 ? (multi ? 'המשך' : 'המשך') : step === 2 ? (this.phases.structure === 'error' ? 'נסה שוב' : 'מזהה…') : step === 3 ? 'אשר והמשך' : step === 7 ? 'פרסם ופתח במפה' : 'המשך';
    const disabled = this.busy || (step === 1 && !multi) || (step === 2 && this.phases.structure !== 'error');
    return html`<div class="wz-foot">
      ${step > 1 ? html`<sw-button size="lg" data-wz-back ?disabled=${this.busy || step === 2} @click=${() => this.back()}>חזרה</sw-button>` : html`<sw-button size="lg" variant="ghost" @click=${() => navigate(`/explore/floors/${this.floorId}`)}>ביטול</sw-button>`}
      <span class="hint">${hint}</span><span class="sp"></span>
      <sw-button size="lg" variant="primary" data-wz-next ?disabled=${disabled} aria-busy=${this.busy ? 'true' : 'false'} @click=${() => this.next()}>${this.busy && step > 2 ? 'שומר…' : label}</sw-button>
    </div>`;
  }

  private renderPrefs() {
    const d = this.prefsDraft;
    const set = (p: Partial<WizardPrefs>) => (this.prefsDraft = { ...this.prefsDraft, ...p });
    const bad = d.review_min >= d.auto_accept;
    return html`<sw-dialog open wide heading="הגדרות האשף" subheading="נשמרות לחשבון שלך" data-wz-prefs-dialog @close=${() => (this.prefsOpen = false)}>
      <div class="prefs">
        <div class="two">
          <label>נכנס בלי בדיקה מעל (%)<input type="number" min="5" max="99" .value=${String(d.auto_accept)} @input=${(e: Event) => set({ auto_accept: Math.round(Number((e.target as HTMLInputElement).value)) })} /></label>
          <label>לא נכנס בלי אישור מתחת ל־(%)<input type="number" min="5" max="99" .value=${String(d.review_min)} @input=${(e: Event) => set({ review_min: Math.round(Number((e.target as HTMLInputElement).value)) })} /></label>
        </div>
        ${bad ? html`<span class="note" style="color:var(--sw-danger-text)">הסף התחתון חייב להיות נמוך מהעליון.</span>` : nothing}
        <label>פריט "לבדיקה" שלא בדקת<select .value=${d.unreviewed} @change=${(e: Event) => set({ unreviewed: (e.target as HTMLSelectElement).value as WizardPrefs['unreviewed'] })}><option value="as_detected" ?selected=${d.unreviewed === 'as_detected'}>נכנס כמו שזוהה</option><option value="reject" ?selected=${d.unreviewed === 'reject'}>לא נכנס</option></select></label>
        <label>ערכת סגנון ראשונה<select .value=${d.kit} @change=${(e: Event) => set({ kit: (e.target as HTMLSelectElement).value as KitId })}>${KITS.map((k) => html`<option value=${k.id} ?selected=${k.id === d.kit}>${k.he}</option>`)}</select></label>
        <label class="check"><input type="checkbox" .checked=${d.furniture} @change=${(e: Event) => set({ furniture: (e.target as HTMLInputElement).checked })} />להציב ריהוט התחלתי</label>
        <label class="check"><input type="checkbox" .checked=${d.auto_place} @change=${(e: Event) => set({ auto_place: (e.target as HTMLInputElement).checked })} />להציב התקנים לבד לפי האזור</label>
        <span class="note">ברירת המחדל: מעל 80% נכנס, בין 50% ל־80% לבדיקה ונכנס כמו שזוהה אם דילגת, מתחת ל־50% לא נכנס בלי אישור.</span>
      </div>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        <sw-button variant="ghost" @click=${() => (this.prefsDraft = { ...WIZARD_DEFAULTS })}>ברירת מחדל</sw-button>
        <sw-button variant="primary" data-wz-prefs-save ?disabled=${bad} @click=${() => void this.savePrefs()}>שמור</sw-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'plan-wizard-screen': PlanWizardScreen;
  }
}

