/**
 * The control image of an AI-rendered floor skin (CR-006 phase 2, slice 2a): our own deterministic level-2 isometric
 * render of a floor in a synthetic state, with nothing on it that names or shows anyone - the picture an image provider
 * is asked to make photoreal while keeping the geometry. Pure functions here (no three.js): the element renders the
 * result with SceneView.renderControl (sw-plan-3d.captureControl), the screen uploads it
 * (POST floors/{id}/skins/control-image). Design rule 4 holds: the same plan JSON + synthetic state give the same
 * description, and the same description gives the same bytes in the one fixed CONTROL_PALETTE, on every viewer and in
 * both designs (unit-plan-skin-control.spec.ts).
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

/** The ONE palette every control image is drawn in (review 2a): the base design tokens (tokens.css :root) frozen here,
 * so the same geometry key gives the same bytes on every viewer, whatever design (a / b) that viewer uses. A token not
 * listed draws in CONTROL_FALLBACK - never in a value read from the page. */
export const CONTROL_PALETTE: Readonly<Record<string, string>> = Object.freeze({
  bg: '#f6f7fb', surface: '#ffffff', 'surface-2': '#f8f9fc', 'surface-3': '#eff2f7', border: '#e9edf3', text: '#111827', 'text-2': '#5b6478', 'text-3': '#98a2b3',
  accent: '#2f6bff', danger: '#ef4444', warning: '#f59e0b', success: '#22c55e', live: '#22c55e', offline: '#9aa3b5', stale: '#f59e0b', unknown: '#b3bac7', purple: '#8b5cf6',
  'map-bg': '#ffffff', 'map-wall': '#aab7cc', 'map-room-fill': '#ffffff', 'map-furniture': '#eef2f8', 'map-furniture-line': '#c9d3e3', 'map-structure': '#4b5567',
  'map-glass': '#7fb2ff', 'map-candidate': '#2f6bff', 'map-label': '#8b96a8', 'map-glow': '#ffd166', 'map-sky': '#dfe9f7', 'map-sky-horizon': '#f7f9fc',
  'map-wall-3d': '#d7dde6', 'map-lit': '#ffc857', 'map-presence': '#3b82f6', 'map-temp': '#1f3a5f',
  'obj-object': '#7b8794', 'obj-structure': '#4b5567', 'obj-circulation': '#6b7f99', 'obj-furniture': '#9aa7b8', 'obj-light': '#f2b544', 'obj-electrical': '#e07a2f',
  'obj-safety': '#e0443c', 'obj-medical': '#2fa7b3', 'obj-sport': '#3fa25b', 'obj-sanitary': '#5b9bd5', 'obj-security': '#7a5cc7', 'obj-outdoor': '#5c9e4f',
  'circuit-1': '#2f6bff', 'circuit-2': '#f59e0b', 'circuit-3': '#22c55e', 'circuit-4': '#a855f7', 'circuit-5': '#ef4444', 'circuit-6': '#14b8a6',
});
export const CONTROL_FALLBACK = '#9aa7b8';
export const controlColor = (token: string): string => CONTROL_PALETTE[token] ?? CONTROL_FALLBACK;

const KEEP_KINDS = new Set<ScenePart['kind']>(['floor', 'room', 'wall', 'lintel', 'sill', 'head', 'door', 'window', 'object', 'connector']);

/** The synthetic "every light on" layer: each room lit, nothing else (no presence, no open opening, no temperature). */
export function allOnLayer(input: SceneInput): RoomStateLayer {
  const rooms: Record<string, RoomState> = {};
  for (const z of [...(input.zones ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    rooms[z.id] = { id: z.id, level_id: z.level_id ?? null, lit: true, presence: false, presenceAge: null, presenceFade: 0, openings: [], temperature: null, temperatureSource: null, lock: null, alarm: null };
  }
  return { rooms, openOpenings: [], levels: {} };
}

/** The builder input of a control image: the floor's structure and rooms with every live value replaced by the
 * synthetic state - no labels, no names, every level, every structural layer, cameras and entities off. No anchors:
 * they are not part of the geometry key, so a body bound to an anchor stands where the document stores it (review 2a) -
 * the same key gives the same scene for every viewer, whatever anchors that viewer may see. */
export function controlSceneInput(input: SceneInput, state: ControlState): SceneInput {
  const anchors: SceneAnchor[] = [];
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
