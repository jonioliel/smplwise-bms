/**
 * ST7HIST (CR-029 section 14): the 3D of a past instant - the history map's cursor and the event page's time - drawn by the
 * same element (`sw-plan-3d`) and the same quality ladder (map/quality-ladder.ts) as the live map. Pure helpers both screens
 * share (no three, no Lit, no DOM; node specs pin them):
 *
 * - `replayStates`: the device states the scene replays at the instant. An entity's state only when the local history knows
 *   it at that instant (`state_at.known`), a circuit's switch only when the bundle says `known`; everything else is an
 *   explicit null - drawn as unknown (no lamp lit, no door open, no lock drawn locked). Never the live value, never the last
 *   value before the history began (master rule: historical unknown is not current state). Keys are sorted, so the same
 *   bundle gives the same description whatever order the server listed the anchors in (determinism, design rule 4).
 * - `replayInstant`: the instant as UTC milliseconds for the element's `sunAt` (the realistic level's sun of that instant).
 * - `REPLAY_VIEW`: what a replay screen hands the element - no walk (the walk is a live-map tool: it opens doors by their
 *   present sensors) and no stills (a still is a picture of the present structure in present light; it cannot replay a
 *   past instant, so the ladder ends at schematic there).
 */

/** The parts of a map bundle's anchor the replay reads (api/types Anchor). */
export interface ReplayAnchor {
  resource_type: 'camera' | 'ha_entity';
  resource_id: string;
  entity?: { state_at?: { state: string | null; known: boolean } | null } | null;
}
/** The parts of a circuit state the replay reads (api/types CircuitState). */
export interface ReplayCircuit {
  state: string | null;
  known: boolean;
}
export interface ReplayStates {
  /** Entity id -> its state at the instant, or null (unknown). */
  entityStates: Record<string, string | null>;
  /** Circuit id -> its switch at the instant, or null (unknown). */
  circuitStates: Record<string, string | null>;
}

/** An anchored entity's state at the instant: known only (null otherwise); cameras have none. */
export function stateAtOf(a: ReplayAnchor): string | null {
  if (a.resource_type !== 'ha_entity') return null;
  const s = a.entity?.state_at;
  return s && s.known === true && typeof s.state === 'string' ? s.state : null;
}

const sorted = (entries: [string, string | null][]): Record<string, string | null> =>
  Object.fromEntries([...entries].sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)));

/** The states a replay draws (module note). An entity anchored twice keeps a known state over an unknown one. */
export function replayStates(anchors: readonly ReplayAnchor[], circuits: Readonly<Record<string, ReplayCircuit>>): ReplayStates {
  const ents = new Map<string, string | null>();
  for (const a of anchors) {
    if (a.resource_type !== 'ha_entity') continue;
    const s = stateAtOf(a);
    if (!ents.has(a.resource_id) || (ents.get(a.resource_id) === null && s !== null)) ents.set(a.resource_id, s);
  }
  const circ: [string, string | null][] = Object.entries(circuits).map(([id, c]) => [id, c && c.known === true && typeof c.state === 'string' ? c.state : null]);
  return { entityStates: sorted([...ents.entries()]), circuitStates: sorted(circ) };
}

/** An ISO instant (or epoch ms) as UTC ms for `sunAt`; null when it is not a valid instant. */
export function replayInstant(at: string | number | null | undefined): number | null {
  if (at === null || at === undefined || at === '') return null;
  const ms = typeof at === 'number' ? at : Date.parse(at);
  return Number.isFinite(ms) ? ms : null;
}

/** The element's switches on a replay screen (module note). */
export const REPLAY_VIEW = { walkable: false, stillsAvailable: false } as const;
