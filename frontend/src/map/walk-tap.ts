/**
 * Plan Studio 6, slice S5-A (CR-029 section 4.2, touch row): what a tap and a long press MEAN in the walk - pure, no DOM, no
 * three: the view and the walker are small interfaces the element fills with the real SceneView and WalkController (and the
 * unit spec with fakes).
 *
 * - A tap is "walk there": the floor point under the finger (or, when the finger landed on something - a wall, a chair, a lamp -
 *   the point where the ray met it, so the walk goes to the foot of what was tapped; the path finder takes the nearest free cell
 *   when that is solid). A tap NEVER operates a device: on a phone a finger covers a lot of the screen, and a tap that
 *   toggled a lamp circuit on the way across a room (the plan view's click does exactly that) would be an accident.
 * - A tap while the walk is under way stops it ("a tap mid-way cancels"); the next tap starts a new one.
 * - A long press on a device (entity, camera, object, door / window) is the same thing a click is on a mouse: the element
 *   hands the hit to the host as `part-select`, and the host's existing action path (permission, confirmation, stale guard)
 *   decides. The walk adds no action path of its own.
 */
export interface TapHit {
  id: string;
  kind: string;
  partId: string;
  /** Where the ray met the part (scene metres, y up). */
  point: [number, number, number];
}

export interface TapView {
  pickAt(clientX: number, clientY: number): TapHit | null;
  floorPoint(clientX: number, clientY: number, groundY: number): [number, number] | null;
}

export interface TapWalker {
  readonly path: readonly unknown[] | null;
  pose(): { ground: number };
  pathTo(x: number, z: number): [number, number][] | null;
  cancelPath(): void;
}

/** The kinds a long press may open (the walk's `aim` list: the crosshair names the same ones). */
export const DEVICE_KINDS: ReadonlySet<string> = new Set(['entity', 'camera', 'object', 'opening']);

export type TapResult =
  | { kind: 'cancel' }
  | { kind: 'walk'; target: [number, number]; path: [number, number][] }
  | { kind: 'unreachable' }
  | { kind: 'none' };

export function resolveTap(view: TapView, walker: TapWalker, x: number, y: number): TapResult {
  if (walker.path && walker.path.length) {
    walker.cancelPath();
    return { kind: 'cancel' };
  }
  const hit = view.pickAt(x, y);
  // a room's tint plane (zone) and a level plate are the floor itself: the floor point is the exact place under the finger
  const target: [number, number] | null = hit && hit.kind !== 'zone' && hit.kind !== 'level' ? [hit.point[0], hit.point[2]] : view.floorPoint(x, y, walker.pose().ground);
  if (!target) return { kind: 'none' };
  const path = walker.pathTo(target[0], target[1]);
  if (!path || !path.length) return { kind: 'unreachable' };
  return { kind: 'walk', target: path[path.length - 1], path };
}

/** The device under a long press, or null (a wall, the floor, nothing). */
export function resolveLongPress(view: Pick<TapView, 'pickAt'>, x: number, y: number): TapHit | null {
  const hit = view.pickAt(x, y);
  return hit && DEVICE_KINDS.has(hit.kind) ? hit : null;
}
