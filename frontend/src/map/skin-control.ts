/**
 * The control image of an AI-rendered floor skin (CR-006 phase 2, slice 2a): our own deterministic level-2 isometric
 * render of a floor in a synthetic state, with nothing on it that names or shows anyone - the picture an image provider
 * is asked to make photoreal while keeping the geometry. Pure functions here (no three.js): the element renders the
 * result with SceneView.renderControl (sw-plan-3d.captureControl), the screen uploads it
 * (POST floors/{id}/skins/control-image). Design rule 4 holds: the same plan JSON + tokens + synthetic state give the
 * same description, and the same description gives the same bytes (unit-plan-skin-control.spec.ts).
 *
 * What the control scene keeps: floor plates, rooms (their faint plate), walls with lintels / sills / heads, doors (the
 * leaf closed: no live state), windows, objects, connectors, and - in `all_on` - the warm lit plate of every room and
 * the glow of every lamp. What it drops: every sprite (room names, labels, entity pills, temperature chips), cameras and
 * their cones, entities, open-opening markers, presence tints. The live states never enter: `all_off` / `all_on` are
 * synthetic snapshots.
 */
import type { RoomState, RoomStateLayer } from './room-state';
import type { SceneAnchor, SceneDescription, SceneInput, ScenePart } from './scene-builder';

export type ControlState = 'all_off' | 'all_on';
export const CONTROL_STATES: readonly ControlState[] = ['all_off', 'all_on'];
/** The provider's landscape size (OpenAI edits: 1536x1024): the answer comes back on the control image's pixel grid, so
 * the room polygons projected with our camera matrix line up with it (2c's masks). The backend refuses other sizes. */
export const CONTROL_W = 1536;
export const CONTROL_H = 1024;
/** The opaque backdrop the transparent canvas is flattened on (a fixed value: not the theme's sky, not a design token). */
export const CONTROL_BACKDROP = '#ffffff';

const KEEP_KINDS = new Set<ScenePart['kind']>(['floor', 'room', 'wall', 'lintel', 'sill', 'head', 'door', 'window', 'object', 'connector']);

/** The synthetic "every light on" layer: each room lit, nothing else (no presence, no open opening, no temperature). */
export function allOnLayer(input: SceneInput): RoomStateLayer {
  const rooms: Record<string, RoomState> = {};
  for (const z of [...(input.zones ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    rooms[z.id] = { id: z.id, level_id: z.level_id ?? null, lit: true, presence: false, presenceAge: null, presenceFade: 0, openings: [], temperature: null, temperatureSource: null, lock: null, alarm: null };
  }
  return { rooms, openOpenings: [], levels: {} };
}

/** The builder input of a control image: the floor's structure, rooms and anchor positions (a body bound to an anchor
 * follows it) with every live value replaced by the synthetic state - no labels, no entity names, every level, every
 * structural layer, cameras and entities off. */
export function controlSceneInput(input: SceneInput, state: ControlState): SceneInput {
  const anchors: SceneAnchor[] = input.anchors.map((a) => ({ ...a, label: '', state: null, online: null }));
  const circuitStates: Record<string, string | null> = {};
  const entityStates: Record<string, string | null> = {};
  if (state === 'all_on') {
    for (const c of input.doc.circuits ?? []) circuitStates[c.id] = 'on';
    for (const o of input.doc.objects) if (o.anchor_ref && o.anchor_ref.resource_type === 'ha_entity' && o.anchor_ref.resource_id) entityStates[o.anchor_ref.resource_id] = 'on';
  }
  return {
    doc: input.doc,
    width: input.width,
    height: input.height,
    anchors,
    entityStates,
    circuitStates,
    catalog: input.catalog ?? null,
    zones: (input.zones ?? []).map((z) => ({ ...z, name: '' })),
    level: null,
    layers: { structure: true, objects: true, connectors: true, zones: true, cameras: false, entities: false },
    roomStates: state === 'all_on' ? allOnLayer(input) : null,
  };
}

/** The parts a control image may draw (see the module note): a filter over any description, so a label or a camera can
 * never reach the picture whatever the input carried. */
export function controlDescription(desc: SceneDescription, state: ControlState): SceneDescription {
  const parts = desc.parts.filter((p) => {
    if (p.shape === 'sprite') return false;
    if (KEEP_KINDS.has(p.kind)) return true;
    if (state !== 'all_on') return false;
    if (p.kind === 'glow') return true;
    return p.kind === 'tint' && p.id.endsWith('#lit');
  });
  return { ...desc, parts: parts.map((p) => (p.text === undefined ? p : { ...p, text: undefined })) };
}

/** A data URL as bytes (the upload body). */
export function dataUrlBytes(url: string): Uint8Array<ArrayBuffer> {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
