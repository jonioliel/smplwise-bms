/**
 * The small pieces the three floor screens wrote two or three times each (code review 06:DUP-9): the live floor map
 * (screens/explore-floor-map.ts), the historical map (screens/investigate-history-map.ts) and the plan editor
 * (screens/explore-plan-editor.ts). One definition each, so the past, the present and the editor cannot drift apart:
 * the "a key belongs to a field" predicate, the plan picture switch per floor, the library lookups, the 3D chunk load,
 * the default-3D rule, the zones as the scene and the room-state layer read them, the lamps of the state facts, the
 * hover labels and the level fallback. Pure except for localStorage (the picture switch) and the dynamic import.
 */
import { describeError } from '../api/client';
import { lookup3dOf, lookupMaterialsOf, lookupOf, type CatalogLibrary } from '../api/plan-catalog';
import type { GeometryDoc } from './geometry';
import type { StateFacts } from './state-facts';
import { defaultLevelId } from './studio-ops';
import { webglAvailable } from './webgl';

/** A key pressed inside a text field, a select or an editable node belongs to it (pass `e.composedPath()[0]`). */
export function isTypingTarget(target: EventTarget | null | undefined): boolean {
  return target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
}

/** Each screen keeps its own plan picture switch per floor in this browser: the live map, the history and the editor. */
type PlanImageScope = 'floor' | 'history' | 'editor';

const planImageKey = (scope: PlanImageScope, floorId: string): string => `sw.${scope}.background.${floorId}`;

/** The stored plan picture switch of a floor; a floor never switched shows its picture. */
export function readPlanImage(scope: PlanImageScope, floorId: string): boolean {
  try {
    return localStorage.getItem(planImageKey(scope, floorId)) !== '0';
  } catch {
    return true;
  }
}

/** Remembers the plan picture switch of a floor. */
export function writePlanImage(scope: PlanImageScope, floorId: string, on: boolean): void {
  try {
    localStorage.setItem(planImageKey(scope, floorId), on ? '1' : '0');
  } catch {
    /* private mode or blocked storage: the choice lives for this page only */
  }
}

/** What a floor screen keeps of the object library: the 2D lookup, the 3D lookup, the materials and the Hebrew names. */
interface LibraryLookups {
  catalogLookup: ReturnType<typeof lookupOf>;
  catalog3d: ReturnType<typeof lookup3dOf>;
  materials3d: ReturnType<typeof lookupMaterialsOf>;
  itemNames: Map<string, string>;
}

export function libraryLookups(lib: CatalogLibrary): LibraryLookups {
  return { catalogLookup: lookupOf(lib), catalog3d: lookup3dOf(lib), materials3d: lookupMaterialsOf(lib), itemNames: new Map(lib.items.map((i) => [i.id, i.names.he])) };
}

/** Loads the 3D element's chunk (once per page: the module system keeps it). null when it is ready, else the error text. */
export async function loadPlan3d(): Promise<string | null> {
  try {
    await import('./sw-plan-3d');
    return null;
  } catch (err) {
    return describeError(err);
  }
}

/** The setting map.default_view asks for the 3D. */
export function defaultViewIs3d(settings: { readonly 'map.default_view'?: unknown }): boolean {
  return settings['map.default_view'] === '3d';
}

/** The pending "open in 3D" of a floor load is due: the 2D is shown, the floor's scene is there and the browser has WebGL. */
export function default3dDue(pending: boolean, view3d: boolean, hasScene: boolean): boolean {
  return pending && !view3d && hasScene && webglAvailable();
}

interface ZoneLike {
  id: string;
  name: string;
  polygon: unknown;
  level_id?: string | null;
}

/** The zones as the scene builder reads them. */
export function sceneZonesOf<Z extends ZoneLike>(zones: readonly Z[]): { id: string; name: string; polygon: Z['polygon']; level_id: string | null }[] {
  return zones.map((z) => ({ id: z.id, name: z.name, polygon: z.polygon, level_id: z.level_id ?? null }));
}

/** The zones as the rooms of the room-state layer. */
export function stateRoomsOf<Z extends ZoneLike>(zones: readonly Z[]): { id: string; polygon: Z['polygon']; level_id: string | null }[] {
  return zones.map((z) => ({ id: z.id, polygon: z.polygon, level_id: z.level_id ?? null }));
}

/** The lamps of the state facts, lit by their circuit's switch or by their own entity. */
export function stateLampsOf(facts: StateFacts | null | undefined, circuits: Readonly<Record<string, string | null>>, states: Readonly<Record<string, string | null>>): { x: number; y: number; level_id: string; on: boolean }[] {
  return (facts?.lamps ?? []).map((l) => ({ x: l.x, y: l.y, level_id: l.level_id, on: (l.circuit !== null && circuits[l.circuit] === 'on') || (l.entity !== null && states[l.entity] === 'on') }));
}

/** The level a zone or an anchor without one stands on: the document's default level, else the bundle's, else 'L0'. */
export function fallbackLevelId(geometry: GeometryDoc | null, bundle: { levels: readonly { id: string; is_default?: boolean }[] } | null | undefined): string {
  return geometry ? defaultLevelId(geometry) : (bundle?.levels.find((l) => l.is_default)?.id ?? 'L0');
}

/** The 3D hover labels: anchors by their map name, objects by label or library name, zones by name. */
export function hoverLabelsOf<A extends { id: string }>(
  anchors: readonly A[],
  nameOf: (a: A) => string,
  objects: readonly { id: string; label?: string | null; item_id: string }[],
  itemNames: ReadonlyMap<string, string>,
  zones: readonly { id: string; name: string }[],
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const a of anchors) labels[a.id] = nameOf(a);
  for (const o of objects) labels[o.id] = o.label || itemNames.get(o.item_id) || o.item_id;
  for (const z of zones) labels[z.id] = z.name;
  return labels;
}
