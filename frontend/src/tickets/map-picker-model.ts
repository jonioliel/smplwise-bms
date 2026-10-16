/**
 * TKMAP1: the pure part of the "הוסף רכיב מהמפה" picker and of the request's map line - which elements a floor offers (its cameras and
 * devices placed on the map, and the objects of its published structure), the element nearest to a click, and the line a request shows.
 * No DOM, no fetch: tests/unit-tickets-map.spec.ts runs it in node.
 */
import type { Anchor } from '../api/types';
import type { MapElementInfo, MapElementPick } from '../api/tickets-map';

export interface PickerElement {
  /** unique within the floor: `anchor:<id>` / `object:<id>` */
  key: string;
  kind: 'anchor' | 'object';
  type: 'camera' | 'ha_entity' | 'object';
  id: string;
  name: string;
  /** plan-normalised 0..1 */
  x: number;
  y: number;
  level: string | null;
}

export interface PickerObject {
  id: string;
  item_id: string;
  level_id?: string | null;
  position: [number, number] | number[];
  label: string | null;
}

/** The name a map shows for an anchor (maps.ts entityName's rule: label, then the camera / device name, then the id). */
export function anchorName(a: Pick<Anchor, 'resource_type' | 'label' | 'resource_id'> & { camera?: { name?: string; alias?: string | null; name_source?: string } | null; entity?: { name?: string | null } | null }): string {
  if (a.label && a.label.trim()) return a.label.trim();
  if (a.resource_type === 'camera') return (a.camera?.alias || a.camera?.name || a.camera?.name_source || a.resource_id).trim();
  return (a.entity?.name || a.resource_id).trim();
}

/** Every element of a floor a request can point at: its anchors (cameras, devices), then its objects; a position outside the plan is skipped. */
export function pickerElements(anchors: readonly Anchor[], objects: readonly PickerObject[], objectName: (o: PickerObject) => string): PickerElement[] {
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -0.01 && v <= 1.01;
  const out: PickerElement[] = [];
  for (const a of anchors) {
    if (!ok(a.position?.x) || !ok(a.position?.y)) continue;
    out.push({ key: `anchor:${a.id}`, kind: 'anchor', type: a.resource_type, id: a.id, name: anchorName(a), x: a.position.x, y: a.position.y, level: a.level_id ?? null });
  }
  for (const o of objects) {
    const [x, y] = o.position ?? [];
    if (!ok(x) || !ok(y)) continue;
    out.push({ key: `object:${o.id}`, kind: 'object', type: 'object', id: o.id, name: objectName(o), x, y, level: o.level_id ?? null });
  }
  return out;
}

/** The element nearest to a click (plan-normalised point, `aspect` = width / height so the distance is round on screen), within `radius`
 * (a share of the plan's width); null when nothing is close enough. */
export function nearestElement(list: readonly PickerElement[], x: number, y: number, aspect: number, radius = 0.03): PickerElement | null {
  let best: { d: number; e: PickerElement } | null = null;
  for (const e of list) {
    const dx = e.x - x;
    const dy = (e.y - y) / (aspect || 1);
    const d = Math.hypot(dx, dy);
    if (d <= radius && (!best || d < best.d)) best = { d, e };
  }
  return best ? best.e : null;
}

/** What the attach call sends for a picked element. */
export function pickOf(floorId: string, e: Pick<PickerElement, 'kind' | 'id'>): MapElementPick {
  return { element: { floor_id: floorId, kind: e.kind, id: e.id } };
}

/** The request's map line state: what to say and which actions apply. */
export interface MapLine {
  text: string;
  gone: boolean;
  canShow: boolean;
  vendorImage: boolean;
}

export function mapLine(e: MapElementInfo): MapLine {
  const text = [e.name, e.floor_name, e.room_name ?? ''].map((s) => s.trim()).filter(Boolean).join(' · ');
  return { text, gone: !e.present, canShow: e.present && Boolean(e.floor_id), vendorImage: e.vendor_image };
}
