/**
 * PLAN3D-R28-UI-2433 (round 28 mockup, app/stack.html): the floor's levels shown together. Today "every level" draws the
 * building as it stands and the top level hides almost all of the ones under it; the mockup's "פרוס" (spread) lifts the levels
 * apart, one above the other, each with a summary tag beside it (open, presence, lights, temperature). A tap on a level focuses
 * it (it alone stays in view, its rooms get their pills); a second tap - or "פתח את הקומה" - enters it (the level filter). Pure
 * transforms of the built description: every part, every realistic part and every level elevation of a level moves up by that
 * level's offset, so the view (scene-three) frames, cuts and lights the spread building as any other description - nothing in the
 * renderer knows about the spread. The open choices of round 28 (group ג) are product settings (stackPrefsOf):
 * `map.stack_backdrop` and `map.stack_pick`.
 */
import type { SceneDescription, ScenePart, Vec3 } from './scene-builder';
import type { RoomSummary } from './room-pills';

/** Round 28 Q7 (ג1): the spread view's backdrop follows the light / dark mode and the hour like a single level (`theme`,
 * recommended), or is always dark as in the owner's reference picture (`dark`). */
export type StackBackdrop = 'theme' | 'dark';
/** Round 28 Q8 (ג2): the first tap on a level focuses it and the second enters it (`two_tap`, recommended), or one tap enters (`one_tap`). */
export type StackPick = 'two_tap' | 'one_tap';
export interface StackPrefs {
  backdrop: StackBackdrop;
  pick: StackPick;
}
export const DEFAULT_STACK_PREFS: StackPrefs = { backdrop: 'theme', pick: 'two_tap' };
export function stackPrefsOf(s: Record<string, unknown> | null | undefined): StackPrefs {
  const b = s?.['map.stack_backdrop'];
  const p = s?.['map.stack_pick'];
  return { backdrop: b === 'dark' ? 'dark' : 'theme', pick: p === 'one_tap' ? 'one_tap' : 'two_tap' };
}

/** How the levels of "every level" stand: as built (`closed`, the building) or lifted apart (`open`). */
export type StackMode = 'closed' | 'open';
/** The browser's last choice (per device, like the night switch). The mockup opens "כל הקומות" spread. */
export const STACK_KEY = 'sw.plan3d.stack';
export const DEFAULT_STACK_MODE: StackMode = 'open';
/** The clear air between two spread levels, as a share of the plan's larger side (a 20 m house: 7 m), at least STACK_GAP_MIN_M. */
export const STACK_GAP_SHARE = 0.35;
export const STACK_GAP_MIN_M = 4;

/** The parts a spread shows no more: the connectors (a stair between two lifted levels would stand in the air). */
const DROPPED: ReadonlySet<ScenePart['kind']> = new Set(['connector']);

/** The extra lift of every level (metres) in elevation order: 0 for the lowest, one gap more for each level above. */
export function stackOffsets(desc: SceneDescription): Map<string, number> {
  const gap = Math.max(STACK_GAP_MIN_M, Math.max(desc.size[0] * desc.scale_m_per_px, desc.size[1] * desc.scale_m_per_px) * STACK_GAP_SHARE);
  const order = [...desc.levels].sort((a, b) => a.elevation_m - b.elevation_m || (a.id < b.id ? -1 : 1));
  return new Map(order.map((l, i) => [l.id, i * gap]));
}

const lift = (v: Vec3, dy: number): Vec3 => [v[0], v[1] + dy, v[2]];

/** The description with its levels spread (`focus` set: only that level and the parts of no level). Unchanged with one level. */
export function spreadDescription(desc: SceneDescription, focus: string | null = null): SceneDescription {
  if (desc.levels.length < 2) return desc;
  const off = stackOffsets(desc);
  const dy = (level: string | null | undefined): number => (level ? off.get(level) ?? 0 : 0);
  const keep = (level: string | null | undefined): boolean => !focus || !level || level === focus;
  const parts = desc.parts.filter((p) => !DROPPED.has(p.kind) && keep(p.level_id)).map((p) => (dy(p.level_id) ? { ...p, position: lift(p.position, dy(p.level_id)) } : p));
  const out: SceneDescription = { ...desc, levels: desc.levels.filter((l) => keep(l.id)).map((l) => ({ ...l, elevation_m: l.elevation_m + dy(l.id) })), parts };
  const r = desc.real;
  if (r) {
    out.real = {
      ...r,
      parts: r.parts.filter((p) => keep(p.level_id)).map((p) => ({ ...p, position: lift(p.position, dy(p.level_id)) })),
      floors: r.floors.filter((f) => keep(f.level_id)).map((f) => ({ ...f, y: f.y + dy(f.level_id) })),
      ...(r.ceilings ? { ceilings: r.ceilings.filter((c) => keep(c.level_id)).map((c) => ({ ...c, y: c.y + dy(c.level_id) })) } : {}),
      caps: r.caps.filter((c) => keep(c.level_id)).map((c) => ({ ...c, y: c.y + dy(c.level_id) })),
      models: r.models.filter((m) => keep(m.level_id)).map((m) => ({ ...m, position: lift(m.position, dy(m.level_id)), tiles: m.tiles.map((t) => lift(t, dy(m.level_id))) })),
      lamps: r.lamps.filter((l) => keep(l.level_id)).map((l) => ({ ...l, position: lift(l.position, dy(l.level_id)) })),
      shutters: r.shutters.filter((s) => keep(s.level_id)).map((s) => ({ ...s, position: lift(s.position, dy(s.level_id)) })),
    };
  }
  if (desc.walk) delete out.walk; // the walk never runs on a spread building (the element hides the walk button there)
  return out;
}

/** A level's tag beside the spread building: its name, its summary and the point it stands at (the plate's start edge, the
 * level's own height after the spread). */
export interface LevelTag {
  id: string;
  name: string;
  /** A short mark for the badge ("0", "1", "-1"): the level's order from the ground, else its name's first letter. */
  short: string;
  pos: Vec3;
  open: number;
  presence: boolean;
  lit: number;
  temp: number | null;
  state: 'normal' | 'sel' | 'away';
}

/** The tags of a spread description: one per level that has a plate, at the plate's +x / -z corner (the far start corner of the
 * isometric picture, where a tag beside the building reads in RTL) raised half a storey. The summary sums the rooms of the level. */
export function levelTags(desc: SceneDescription, names: ReadonlyMap<string, string>, rooms: readonly RoomSummary[], focus: string | null, levelOf: (id: string | null) => string = (id) => id ?? ''): LevelTag[] {
  const order = [...desc.levels].sort((a, b) => a.elevation_m - b.elevation_m || (a.id < b.id ? -1 : 1));
  // the ground level: the first at or above 0 (a basement stays below 0 when spread: the lowest level never moves)
  const ground = Math.max(0, order.findIndex((l) => l.elevation_m >= -0.5));
  const out: LevelTag[] = [];
  order.forEach((l, i) => {
    const plate = desc.parts.find((p) => p.kind === 'floor' && p.shape === 'box' && p.level_id === l.id);
    if (!plate) return;
    const mine = rooms.filter((r) => levelOf(r.level_id) === l.id);
    const temps = mine.map((r) => r.temp).filter((t): t is number => t !== null);
    out.push({
      id: l.id,
      name: names.get(l.id) ?? l.id,
      short: String(i - ground),
      pos: [plate.position[0] + plate.size[0] / 2, l.elevation_m + l.ceiling_height_m * 0.5, plate.position[2] - plate.size[2] / 2],
      open: mine.reduce((a, r) => a + r.open, 0),
      presence: mine.some((r) => r.presence),
      lit: mine.reduce((a, r) => a + r.lit, 0),
      temp: temps.length ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : null,
      state: !focus ? 'normal' : focus === l.id ? 'sel' : 'away',
    });
  });
  return out;
}

/** What a tap on a level does: focus it (the first tap of `two_tap`) or enter it (the second tap, or `one_tap`). */
export function stackTap(pick: StackPick, focus: string | null, id: string): { focus: string | null; enter: string | null } {
  if (pick === 'one_tap' || focus === id) return { focus: null, enter: id };
  return { focus: id, enter: null };
}
