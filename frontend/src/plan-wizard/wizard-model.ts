/**
 * PLAN3D-R28-WIZARD-2433: the pure part of the guided "new plan from a picture" wizard (round 28 mockup, map3d/app/wizard.html).
 * No DOM, no Lit, no network: what a detected item becomes, the review queue, the accept body, the room types, the style kits
 * with their starter furniture and the device placement by area. Runs in node (tests/unit-plan-wizard-2433.spec.ts).
 *
 * The wizard reuses the Plan Studio data model as it is: candidates are document-v2 walls and openings (map/candidates.ts),
 * they go into the draft through POST /plan-versions/{id}/detect/accept, rooms are spatial zones (api/zones.ts) and their floors
 * are document 2.2 room materials (map/studio6-fields.ts setSurface); nothing here invents a new storage shape.
 */
import type { CandidateSet } from '../map/candidates';
import { allIds, withParents } from '../map/candidates';
import type { GeometryDoc, GeomObject, GeomOpening, GeomWall, OpeningKind, Pt, Swing } from '../map/geometry';
import { setSurface } from '../map/studio6-fields';
import { withDocVersion } from '../map/glass-wall';

// ---------------------------------------------------------------- the user's choices (/me/prefs `plan.wizard`)

export type KitId = 'apartment' | 'office' | 'empty';
export type Unreviewed = 'as_detected' | 'reject';
export interface WizardPrefs {
  /** Percent: an item at or above it goes in without review. */
  auto_accept: number;
  /** Percent: under it an item never goes in without an explicit approval. */
  review_min: number;
  /** What an item between the two becomes when nobody looked at it. */
  unreviewed: Unreviewed;
  kit: KitId;
  furniture: boolean;
  auto_place: boolean;
}

/** The recommended answers of round 28 (questions 10-11, not answered by the owner yet): >80% in, 50-80% marked for review and
 * in as detected when skipped, <50% only with an approval; three kits in the first phase, the apartment first. */
export const WIZARD_DEFAULTS: Readonly<WizardPrefs> = { auto_accept: 80, review_min: 50, unreviewed: 'as_detected', kit: 'apartment', furniture: true, auto_place: true };

const pct = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 5 && v <= 99 ? v : null);

/** Any stored value in its full form: every key present, a bad value is the default, the thresholds stay ordered. */
export function normalizePrefs(raw: unknown): WizardPrefs {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: WizardPrefs = { ...WIZARD_DEFAULTS };
  out.auto_accept = pct(o.auto_accept) ?? out.auto_accept;
  out.review_min = pct(o.review_min) ?? out.review_min;
  if (out.review_min >= out.auto_accept) {
    out.auto_accept = WIZARD_DEFAULTS.auto_accept;
    out.review_min = WIZARD_DEFAULTS.review_min;
  }
  if (o.unreviewed === 'as_detected' || o.unreviewed === 'reject') out.unreviewed = o.unreviewed;
  if (o.kit === 'apartment' || o.kit === 'office' || o.kit === 'empty') out.kit = o.kit;
  if (typeof o.furniture === 'boolean') out.furniture = o.furniture;
  if (typeof o.auto_place === 'boolean') out.auto_place = o.auto_place;
  return out;
}

// ---------------------------------------------------------------- confidence bands and the review

export type Band = 'sure' | 'check' | 'doubt';
export function bandOf(confidence: number, p: Pick<WizardPrefs, 'auto_accept' | 'review_min'>): Band {
  const c = Math.round(confidence * 100);
  return c >= p.auto_accept ? 'sure' : c >= p.review_min ? 'check' : 'doubt';
}

export type WallChoice = 'wall' | 'railing' | 'none';
export type OpeningChoice = 'door' | 'sliding' | 'passage' | 'window' | 'none';
export type Choice = WallChoice | OpeningChoice;

export interface ReviewItem {
  id: string;
  kind: 'wall' | OpeningKind;
  band: Band;
  confidence: number;
}

/** Everything that is not "sure", the least sure first (the order the pager walks), ties by id. */
export function reviewQueue(set: CandidateSet, p: WizardPrefs): ReviewItem[] {
  const items: ReviewItem[] = [
    ...set.walls.map((w): ReviewItem => ({ id: w.id, kind: 'wall', band: bandOf(w.confidence, p), confidence: w.confidence })),
    ...set.openings.map((o): ReviewItem => ({ id: o.id, kind: o.kind, band: bandOf(o.confidence, p), confidence: o.confidence })),
  ];
  return items.filter((i) => i.band !== 'sure').sort((a, b) => a.confidence - b.confidence || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function bandCounts(set: CandidateSet, p: WizardPrefs): Record<Band, number> {
  const out: Record<Band, number> = { sure: 0, check: 0, doubt: 0 };
  for (const w of set.walls) out[bandOf(w.confidence, p)] += 1;
  for (const o of set.openings) out[bandOf(o.confidence, p)] += 1;
  return out;
}

/** The choice a reviewer starts from: what the detector said (a sliding door is its own choice). */
export function detectedChoice(set: CandidateSet, id: string): Choice | null {
  const w = set.walls.find((x) => x.id === id);
  if (w) return w.kind === 'railing' ? 'railing' : 'wall';
  const o = set.openings.find((x) => x.id === id);
  if (!o) return null;
  return o.kind === 'door' ? (o.swing === 'sliding' ? 'sliding' : 'door') : o.kind;
}

export const WALL_CHOICES: readonly { id: WallChoice; he: string }[] = [
  { id: 'wall', he: 'קיר' },
  { id: 'railing', he: 'מעקה או קיר נמוך' },
  { id: 'none', he: 'אין כאן קיר' },
];
export const OPENING_CHOICES: readonly { id: OpeningChoice; he: string }[] = [
  { id: 'sliding', he: 'דלת הזזה' },
  { id: 'door', he: 'דלת רגילה' },
  { id: 'passage', he: 'מעבר פתוח' },
  { id: 'window', he: 'חלון' },
  { id: 'none', he: 'אין כאן פתח' },
];

const KIND_HE: Record<'wall' | OpeningKind, string> = { wall: 'קיר', door: 'דלת', window: 'חלון', passage: 'מעבר פתוח' };

/** "זוהה כמעבר פתוח" - what the detector thought, in the wizard's words. */
export function detectedText(set: CandidateSet, id: string): string {
  const o = set.openings.find((x) => x.id === id);
  if (o) return o.kind === 'door' && o.swing === 'sliding' ? 'זוהה כדלת הזזה' : o.kind === 'passage' ? 'זוהה כמעבר פתוח' : `זוהה כ${KIND_HE[o.kind]}`;
  const w = set.walls.find((x) => x.id === id);
  return w?.kind === 'railing' ? 'זוהה כמעקה' : 'זוהה כקיר';
}

/** The edit an opening choice sends (only document-v2 editable fields; the server ignores the rest). */
export function openingEdit(o: GeomOpening, c: OpeningChoice): Partial<GeomOpening> | null {
  if (c === 'none') return null;
  if (c === 'sliding') return o.kind === 'door' && o.swing === 'sliding' ? {} : { kind: 'door', swing: 'sliding', height_m: 2.1, sill_m: 0 };
  if (c === 'door') return o.kind === 'door' && o.swing !== 'sliding' ? {} : { kind: 'door', swing: 'left' as Swing, height_m: 2.1, sill_m: 0 };
  if (c === 'passage') return o.kind === 'passage' ? {} : { kind: 'passage', swing: 'none', height_m: 2.1, sill_m: 0 };
  return o.kind === 'window' ? {} : { kind: 'window', swing: 'none', height_m: 1.2, sill_m: 0.9 };
}

export function wallEdit(w: GeomWall, c: WallChoice): Partial<GeomWall> | null {
  if (c === 'none') return null;
  if (c === 'railing') return w.kind === 'railing' ? {} : { kind: 'railing' };
  return w.kind === 'railing' ? { kind: 'interior' } : {};
}

export interface Selection {
  accepted: string[];
  edits: Record<string, Partial<GeomWall> | Partial<GeomOpening>>;
  /** Items that stay out, by reason (for the summary). */
  rejected: { byChoice: number; byDoubt: number; byPolicy: number; orphans: number };
}

/**
 * What goes into the draft: a decided item as decided; an undecided one by its band - "sure" in, "check" as the
 * `unreviewed` choice says, "doubt" out. An opening whose wall stays out goes out with it (the server refuses an orphan);
 * an accepted opening's wall always comes along (withParents). Object candidates (columns, tribunes) go in when "sure".
 */
export function selection(set: CandidateSet, decisions: Readonly<Record<string, Choice>>, p: WizardPrefs): Selection {
  const keep = new Set<string>();
  const edits: Selection['edits'] = {};
  const rejected = { byChoice: 0, byDoubt: 0, byPolicy: 0, orphans: 0 };
  const undecided = (conf: number): boolean => {
    const b = bandOf(conf, p);
    if (b === 'sure') return true;
    if (b === 'check' && p.unreviewed === 'as_detected') return true;
    if (b === 'check') rejected.byPolicy += 1;
    else rejected.byDoubt += 1;
    return false;
  };
  for (const w of set.walls) {
    const c = decisions[w.id] as WallChoice | undefined;
    if (c === undefined) {
      if (undecided(w.confidence)) keep.add(w.id);
      continue;
    }
    const e = wallEdit(w, c);
    if (!e) {
      rejected.byChoice += 1;
      continue;
    }
    keep.add(w.id);
    if (Object.keys(e).length) edits[w.id] = e;
  }
  for (const o of set.openings) {
    const c = decisions[o.id] as OpeningChoice | undefined;
    let ok: boolean;
    if (c === undefined) ok = undecided(o.confidence);
    else {
      const e = openingEdit(o, c);
      ok = !!e;
      if (!e) rejected.byChoice += 1;
      else if (Object.keys(e).length) edits[o.id] = e;
    }
    if (!ok) continue;
    if (!keep.has(o.wall_id) && decisions[o.wall_id] === 'none') {
      rejected.orphans += 1; // its wall was said not to be a wall: the opening cannot stand on its own
      delete edits[o.id];
      continue;
    }
    keep.add(o.id);
  }
  const shapes = withParents(set, allIds(set).filter((id) => keep.has(id)));
  const objects = set.objects.filter((o) => bandOf(o.confidence, p) === 'sure').map((o) => o.id);
  return { accepted: [...shapes, ...objects], edits, rejected };
}

/** The candidate set with the review applied, for drawing the draft-to-be (previews before the server answered). */
export function applySelection(set: CandidateSet, sel: Selection): CandidateSet {
  const keep = new Set(sel.accepted);
  return {
    ...set,
    walls: set.walls.filter((w) => keep.has(w.id)).map((w) => ({ ...w, ...(sel.edits[w.id] as Partial<GeomWall> | undefined) })),
    openings: set.openings.filter((o) => keep.has(o.id)).map((o) => ({ ...o, ...(sel.edits[o.id] as Partial<GeomOpening> | undefined) })),
    objects: set.objects.filter((o) => keep.has(o.id)),
  };
}

// ---------------------------------------------------------------- scale

/** The longest candidate wall (the "מדוד קיר" default target): its id and its length in plan pixels. */
export function longestWall(set: Pick<CandidateSet, 'walls'>, width: number, height: number): { id: string; a: Pt; b: Pt; px: number } | null {
  let best: { id: string; a: Pt; b: Pt; px: number } | null = null;
  for (const w of set.walls) {
    for (let i = 1; i < w.polyline.length; i++) {
      const a = w.polyline[i - 1];
      const b = w.polyline[i];
      const px = Math.hypot((b[0] - a[0]) * width, (b[1] - a[1]) * height);
      if (!best || px > best.px) best = { id: w.id, a: [a[0], a[1]], b: [b[0], b[1]], px };
    }
  }
  return best;
}

// ---------------------------------------------------------------- rooms

export type ZoneKindId = 'room' | 'zone' | 'corridor' | 'outdoor' | 'service';
export interface RoomType {
  id: string;
  he: string;
  kind: ZoneKindId;
  /** The zone's tags: map/material-resolve ROOM_FLOOR_RULES reads them when a room has no floor of its own. */
  tags: string[];
  /** Hebrew words that suggest the type from a typed name. */
  words: string[];
}
export const ROOM_TYPES: readonly RoomType[] = [
  { id: 'entrance', he: 'כניסה', kind: 'room', tags: ['entrance'], words: ['כניסה', 'לובי', 'מבואה'] },
  { id: 'corridor', he: 'מעבר', kind: 'corridor', tags: ['corridor'], words: ['מסדרון', 'מעבר', 'פרוזדור'] },
  { id: 'living', he: 'סלון', kind: 'room', tags: ['living'], words: ['סלון', 'מגורים', 'אירוח'] },
  { id: 'kitchen', he: 'מטבח', kind: 'room', tags: ['kitchen'], words: ['מטבח', 'מטבחון', 'פינת אוכל'] },
  { id: 'bedroom', he: 'חדר שינה', kind: 'room', tags: ['bedroom'], words: ['שינה', 'הורים', 'ילדים'] },
  { id: 'office', he: 'חדר עבודה', kind: 'room', tags: ['office'], words: ['עבודה', 'משרד', 'מחשב'] },
  { id: 'meeting', he: 'חדר ישיבות', kind: 'room', tags: ['meeting'], words: ['ישיבות', 'כנסים'] },
  { id: 'wc', he: 'שירותים', kind: 'room', tags: ['wc'], words: ['שירותים', 'אורחים'] },
  { id: 'bath', he: 'אמבטיה', kind: 'room', tags: ['bath'], words: ['אמבטיה', 'מקלחת', 'רחצה'] },
  { id: 'stairs', he: 'חדר מדרגות', kind: 'corridor', tags: ['stairs'], words: ['מדרגות'] },
  { id: 'service', he: 'חדר שירות', kind: 'service', tags: ['service'], words: ['שירות', 'כביסה'] },
  { id: 'storage', he: 'מחסן', kind: 'service', tags: ['storage'], words: ['מחסן', 'אחסון'] },
  { id: 'technical', he: 'חדר טכני', kind: 'service', tags: ['technical'], words: ['טכני', 'שרתים', 'חשמל', 'תקשורת'] },
  { id: 'balcony', he: 'מרפסת', kind: 'outdoor', tags: ['balcony'], words: ['מרפסת'] },
  { id: 'parking', he: 'חניה', kind: 'outdoor', tags: ['parking'], words: ['חניה', 'חנייה', 'חניון'] },
  { id: 'other', he: 'אחר', kind: 'zone', tags: [], words: [] },
];
export const roomType = (id: string | null | undefined): RoomType => ROOM_TYPES.find((t) => t.id === id) ?? ROOM_TYPES[ROOM_TYPES.length - 1];

/** The type a name suggests ("חדר שינה הורים" -> bedroom), or null. */
export function guessRoomType(name: string): string | null {
  const n = name.trim();
  if (!n) return null;
  for (const t of ROOM_TYPES) if (t.words.some((w) => n.includes(w))) return t.id;
  return null;
}

/** The name a room without one gets (the server does the same: "חדר 7"). */
export const fallbackRoomName = (index: number): string => `חדר ${index + 1}`;

/** A polygon's area-weighted centre (normalized points; a degenerate one falls back to the vertex mean). */
export function centroid(poly: readonly { x: number; y: number }[]): { x: number; y: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
    a += f;
    cx += (poly[j].x + poly[i].x) * f;
    cy += (poly[j].y + poly[i].y) * f;
  }
  if (Math.abs(a) < 1e-12) {
    const n = Math.max(1, poly.length);
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

// ---------------------------------------------------------------- style kits

export interface Kit {
  id: KitId;
  he: string;
  note: string;
  /** The level's floor and each room type's floor (materials.json ids); `default` for every type not listed. */
  level: string;
  floors: Record<string, string>;
  furniture: Record<string, readonly string[]>;
}
/** Round 28 question 11, recommended answer: the apartment, the office and the empty kit in the first phase. */
export const KITS: readonly Kit[] = [
  {
    id: 'apartment', he: 'דירה', note: 'פרקט, קירות בהירים, ריהוט בית', level: 'oak',
    floors: { default: 'oak', kitchen: 'tiles_grey', wc: 'tiles_grey', bath: 'tiles_grey', service: 'tiles_grey', stairs: 'tiles_grey', balcony: 'tiles_grey', storage: 'concrete', technical: 'concrete', parking: 'asphalt' },
    furniture: { living: ['sofa.3', 'table.side'], kitchen: ['table.dining'], bedroom: ['wardrobe'], office: ['table.desk', 'chair.office'], meeting: ['table.meeting'], wc: ['toilet.standard'], bath: ['bathtub', 'sink.bathroom'], entrance: ['coat.rack'] },
  },
  {
    id: 'office', he: 'משרד', note: 'שטיח, שולחנות עבודה, חדרי ישיבות', level: 'carpet',
    floors: { default: 'carpet', entrance: 'tiles_grey', corridor: 'tiles_grey', kitchen: 'tiles_grey', wc: 'tiles_grey', bath: 'tiles_grey', stairs: 'tiles_grey', balcony: 'tiles_grey', storage: 'concrete', technical: 'concrete', service: 'concrete', parking: 'asphalt' },
    furniture: { office: ['table.desk', 'chair.office'], living: ['sofa.2', 'table.side'], meeting: ['table.meeting'], kitchen: ['table.round'], wc: ['toilet.standard'], bath: ['sink.bathroom'], entrance: ['bench.indoor'], technical: ['rack.server'] },
  },
  { id: 'empty', he: 'ריק', note: 'חומרים בלבד, בלי ריהוט', level: 'concrete', floors: { default: 'concrete', parking: 'asphalt' }, furniture: {} },
];
export const kitOf = (id: KitId): Kit => KITS.find((k) => k.id === id) ?? KITS[0];
export const kitFloor = (kit: Kit, typeId: string): string => kit.floors[typeId] ?? kit.floors.default;

/** The catalog sizes the starter furniture needs (objects.json); the wizard never places an item it has no size for. */
export const FURNITURE_SIZE: Readonly<Record<string, { w_m: number; d_m: number; h_m: number }>> = {
  'sofa.3': { w_m: 2.1, d_m: 0.9, h_m: 0.85 }, 'sofa.2': { w_m: 1.6, d_m: 0.9, h_m: 0.85 }, 'table.side': { w_m: 0.5, d_m: 0.5, h_m: 0.5 },
  'table.dining': { w_m: 1.6, d_m: 0.9, h_m: 0.75 }, 'table.round': { w_m: 1.2, d_m: 1.2, h_m: 0.75 }, wardrobe: { w_m: 1.5, d_m: 0.6, h_m: 2.2 },
  'table.desk': { w_m: 1.4, d_m: 0.7, h_m: 0.75 }, 'chair.office': { w_m: 0.6, d_m: 0.6, h_m: 1.1 }, 'table.meeting': { w_m: 3, d_m: 1.2, h_m: 0.75 },
  'toilet.standard': { w_m: 0.4, d_m: 0.7, h_m: 0.8 }, bathtub: { w_m: 1.7, d_m: 0.75, h_m: 0.6 }, 'sink.bathroom': { w_m: 0.6, d_m: 0.45, h_m: 0.85 },
  'coat.rack': { w_m: 0.4, d_m: 0.4, h_m: 1.8 }, 'bench.indoor': { w_m: 1.8, d_m: 0.4, h_m: 0.45 }, 'rack.server': { w_m: 0.6, d_m: 1, h_m: 2 },
};
export const WIZARD_TAG = 'plan-wizard';

export interface StyledRoom {
  id: string;
  typeId: string;
  polygon: { x: number; y: number }[];
  level_id?: string | null;
}

/**
 * The draft with a kit applied: the level's floor, every wizard room's floor by its type and tags, and - with `furniture` -
 * the kit's starter items at the room's centre, side by side, only where the room's box holds them with 0.3 m to spare.
 * Starter items carry the WIZARD_TAG, so applying another kit first takes the previous wizard furniture away (nothing else).
 */
export function applyKit(doc: GeometryDoc, rooms: readonly StyledRoom[], kit: Kit, furniture: boolean, scaleMPerPx: number): GeometryDoc {
  const level = doc.levels.find((l) => l.is_default) ?? doc.levels[0];
  let next: GeometryDoc = { ...doc, objects: doc.objects.filter((o) => !o.tags?.includes(WIZARD_TAG)) };
  if (level) next = { ...next, levels: next.levels.map((l) => (l.id === level.id ? { ...l, floor_material_id: kit.level } : l)) };
  const W = doc.dimensions.width_px || 1000;
  const H = doc.dimensions.height_px || 1000;
  const objects: GeomObject[] = [];
  for (const r of rooms) {
    const t = roomType(r.typeId);
    if (!next.rooms.some((x) => x.id === r.id)) next = { ...next, rooms: [...next.rooms, { id: r.id, level_id: r.level_id ?? level?.id ?? null, tags: t.tags }] };
    else next = { ...next, rooms: next.rooms.map((x) => (x.id === r.id ? { ...x, tags: t.tags } : x)) };
    next = setSurface(next, 'rooms', r.id, 'floor_material_id', kitFloor(kit, t.id));
    if (!furniture) continue;
    const items = (kit.furniture[t.id] ?? []).filter((id) => FURNITURE_SIZE[id]);
    if (!items.length || r.polygon.length < 3) continue;
    const xs = r.polygon.map((p) => p.x);
    const ys = r.polygon.map((p) => p.y);
    const boxW = (Math.max(...xs) - Math.min(...xs)) * W * scaleMPerPx;
    const boxD = (Math.max(...ys) - Math.min(...ys)) * H * scaleMPerPx;
    const c = centroid(r.polygon);
    const rowW = items.reduce((s, id) => s + FURNITURE_SIZE[id].w_m, 0) + 0.3 * (items.length - 1);
    const rowD = Math.max(...items.map((id) => FURNITURE_SIZE[id].d_m));
    if (rowW + 0.6 > boxW || rowD + 0.6 > boxD) continue; // a small room keeps only its floor
    let x = -rowW / 2;
    items.forEach((itemId, k) => {
      const s = FURNITURE_SIZE[itemId];
      const cxM = x + s.w_m / 2;
      x += s.w_m + 0.3;
      objects.push({
        id: `wz-${r.id}-${k}`.slice(0, 64), item_id: itemId, level_id: r.level_id ?? level?.id ?? 'L0',
        position: [round5(c.x + cxM / (W * scaleMPerPx)), round5(c.y)], rotation_deg: 0, size: { ...s }, z_m: 0, params: {}, label: null,
        anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, tags: [WIZARD_TAG],
      });
    });
  }
  return withDocVersion({ ...next, objects: [...next.objects, ...objects] });
}

const round5 = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 1e5) / 1e5;

// ---------------------------------------------------------------- devices by area

export interface PlaceEntity {
  entity_id: string;
  name: string;
  domain: string;
  device_class: string | null;
  area_id: string | null;
}
export interface PlaceRoom {
  id: string;
  name: string;
  area_id: string | null;
  polygon: { x: number; y: number }[];
}
export interface PlaceOpening {
  id: string;
  kind: OpeningKind;
  /** The opening's middle, normalized. */
  x: number;
  y: number;
}
export type PlaceWhere = 'door' | 'window' | 'centre' | 'manual' | 'none';
export interface Placement {
  entity_id: string;
  name: string;
  domain: string;
  room: string | null;
  x: number | null;
  y: number | null;
  where: PlaceWhere;
}

const DOOR_CLASSES = new Set(['door', 'garage_door', 'opening']);
const WINDOW_CLASSES = new Set(['window']);
/** Which opening an entity belongs at: a door contact or a lock at a door, a window contact or a shutter at a window. */
export function openingFor(e: Pick<PlaceEntity, 'domain' | 'device_class'>): 'door' | 'window' | null {
  if (e.domain === 'lock') return 'door';
  if (e.domain === 'cover') return e.device_class === 'garage' || e.device_class === 'door' || e.device_class === 'gate' ? 'door' : 'window';
  if (e.domain === 'binary_sensor' && e.device_class && DOOR_CLASSES.has(e.device_class)) return 'door';
  if (e.domain === 'binary_sensor' && e.device_class && WINDOW_CLASSES.has(e.device_class)) return 'window';
  return null;
}

/** Ray casting on normalized points. */
export function inside(p: { x: number; y: number }, poly: readonly { x: number; y: number }[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/**
 * Where each entity of a linked room goes: a door / window device at the room's own opening of that kind (the one nearest the
 * room's centre, nudged 4% of the way into the room, each opening used once), everything else at the centre spread on a small
 * ring so markers never stack. An entity whose area no room of this floor stands for is left to place by hand ('manual').
 */
export function placeByArea(entities: readonly PlaceEntity[], rooms: readonly PlaceRoom[], openings: readonly PlaceOpening[], auto = true): Placement[] {
  const used = new Set<string>();
  const spread = new Map<string, number>();
  return entities.map((e): Placement => {
    const room = e.area_id ? rooms.find((r) => r.area_id === e.area_id) : undefined;
    if (!room || !auto) return { entity_id: e.entity_id, name: e.name, domain: e.domain, room: room?.name ?? null, x: null, y: null, where: 'manual' };
    const c = centroid(room.polygon);
    const want = openingFor(e);
    if (want) {
      const near = openings
        .filter((o) => o.kind === want && !used.has(o.id) && inside(nudge(o, c, 0.04), room.polygon))
        .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
      if (near) {
        used.add(near.id);
        const p = nudge(near, c, 0.06);
        return { entity_id: e.entity_id, name: e.name, domain: e.domain, room: room.name, x: p.x, y: p.y, where: want };
      }
    }
    const k = spread.get(room.id) ?? 0;
    spread.set(room.id, k + 1);
    const ang = k * 2.399963; // the golden angle: an even spiral whatever the count
    const r = k === 0 ? 0 : 0.028 * Math.sqrt(k);
    return { entity_id: e.entity_id, name: e.name, domain: e.domain, room: room.name, x: round5(c.x + r * Math.cos(ang)), y: round5(c.y + r * Math.sin(ang)), where: 'centre' };
  });
}

function nudge(o: { x: number; y: number }, c: { x: number; y: number }, f: number): { x: number; y: number } {
  return { x: round5(o.x + (c.x - o.x) * f), y: round5(o.y + (c.y - o.y) * f) };
}

export const WHERE_HE: Record<PlaceWhere, string> = { door: 'ליד הדלת שזוהתה', window: 'ליד החלון שזוהה', centre: 'מרכז החדר', manual: 'בחר ולחץ על המפה', none: 'לא יוצב' };
