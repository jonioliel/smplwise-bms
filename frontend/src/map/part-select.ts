import type { GeometryDoc } from './geometry';

/** What a click in the 3D selects, the same on the live map, the history map and the event page (T087): a camera or an
 * entity is itself; a door or an object bound to an entity (`anchor_ref`) selects that entity's anchor; an unbound object
 * is the object; anything else (a room, a wall, a connector, a label, an unbound opening) is a stray click - null, the
 * screen keeps its selection. The empty click (no part: the floor or the background) is the screen's own business. */
export type PartTarget = { anchor: string } | { object: string } | null;

export interface PartAnchorRef {
  id: string;
  resource_type: string;
  resource_id: string;
}

export function boundItemOf(part: { id: string; kind: string }, doc: Pick<GeometryDoc, 'objects' | 'openings'> | null, anchors: readonly PartAnchorRef[]): PartTarget {
  if (part.kind === 'camera' || part.kind === 'entity') return { anchor: part.id }; // the part carries its anchor id (the demo floor has no bundle anchors)
  if (part.kind !== 'object' && part.kind !== 'opening') return null;
  const item = part.kind === 'object' ? doc?.objects.find((o) => o.id === part.id) : doc?.openings.find((o) => o.id === part.id);
  if (!item) return null;
  const ref = item.anchor_ref;
  const bound = ref ? anchors.find((a) => a.resource_type === ref.resource_type && a.resource_id === ref.resource_id) : undefined;
  if (bound) return { anchor: bound.id };
  return part.kind === 'object' ? { object: part.id } : null;
}
