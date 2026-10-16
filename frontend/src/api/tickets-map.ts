/**
 * TKMAP1 (owner 16.10): the map element of a service request (routers/tickets_map.py) - a camera / device anchor or a plan object,
 * attached from the live map, a camera page or the request's own picker. The server keeps a reference and a snapshot of the names; the
 * vendor page shows a server-drawn picture of that floor only (the manager can preview exactly that picture).
 * Without a server (the demo) a tiny in-memory store answers, so the screens render.
 */
import { api, apiUrl, get, put } from './client';
import { isApi } from './session';

export type MapElementKind = 'anchor' | 'object';
export type MapElementType = 'camera' | 'ha_entity' | 'object';

/** What the request stores (the snapshot) and, for a reader of that map, where to show it. */
export interface MapElementInfo {
  kind: MapElementKind;
  type: MapElementType;
  name: string;
  floor_name: string;
  room_name: string | null;
  attached_at: string;
  /** still on the floor's current map */
  present: boolean;
  /** the vendor page has a picture (a live element on a floor with a published plan) */
  vendor_image: boolean;
  floor_id?: string;
  element_id?: string;
  resource_id?: string | null;
  level_id?: string | null;
  plan_version_id?: string | null;
  x_px?: number;
  y_px?: number;
}

export interface MapElementAnswer {
  ticket_id: string;
  element: MapElementInfo | null;
  can: { attach: boolean; detach: boolean };
}

/** What a picker / an entry point sends: an element of a floor's map, or a camera / device found through its current anchor. */
export type MapElementPick =
  | { element: { floor_id: string; kind: MapElementKind; id: string }; resource?: undefined }
  | { resource: { type: 'camera' | 'ha_entity'; id: string }; element?: undefined };

/** A pick with the words shown before it is saved (the create form's line). */
export interface MapElementDraft {
  pick: MapElementPick;
  name: string;
  floorName: string;
  /** a device on the map: the request is opened FOR that device too (the server resolves its place and history, slice 3) */
  entityId?: string;
}

const demo = new Map<string, MapElementAnswer>();

function demoAnswer(id: string): MapElementAnswer {
  return demo.get(id) ?? { ticket_id: id, element: null, can: { attach: true, detach: false } };
}

export const ticketsMapApi = {
  get: (ticketId: string): Promise<MapElementAnswer> =>
    isApi() ? get<MapElementAnswer>(`tickets/${encodeURIComponent(ticketId)}/map-element`) : Promise.resolve(demoAnswer(ticketId)),
  attach: (ticketId: string, pick: MapElementPick, draft?: { name: string; floorName: string }): Promise<MapElementAnswer> => {
    if (!isApi()) {
      const a: MapElementAnswer = {
        ticket_id: ticketId, can: { attach: true, detach: true },
        element: { kind: pick.element ? pick.element.kind : 'anchor', type: pick.resource ? pick.resource.type : 'object', name: draft?.name ?? '', floor_name: draft?.floorName ?? '',
          room_name: null, attached_at: new Date().toISOString(), present: true, vendor_image: true },
      };
      demo.set(ticketId, a);
      return Promise.resolve(a);
    }
    return put<MapElementAnswer>(`tickets/${encodeURIComponent(ticketId)}/map-element`, pick.element ? { element: pick.element } : { resource: pick.resource });
  },
  detach: (ticketId: string): Promise<MapElementAnswer> => {
    if (!isApi()) {
      demo.delete(ticketId);
      return Promise.resolve(demoAnswer(ticketId));
    }
    return api<MapElementAnswer>(`tickets/${encodeURIComponent(ticketId)}/map-element`, { method: 'DELETE' });
  },
  /** exactly the picture the vendor page shows (same bytes as the public route) */
  vendorPreviewUrl: (ticketId: string): string => apiUrl(`tickets/${encodeURIComponent(ticketId)}/map-element/vendor.svg`),
};

/** "הצג במפה": the live map of the element's floor with the element focused (the map's existing `camera` / `entity` / `focus` address). */
export function mapHref(e: MapElementInfo): string | null {
  if (!e.present || !e.floor_id) return null;
  const base = `#/explore/floors/${encodeURIComponent(e.floor_id)}`;
  if (e.type === 'camera' && e.resource_id) return `${base}?camera=${encodeURIComponent(e.resource_id)}`;
  if (e.type === 'ha_entity' && e.resource_id) return `${base}?entity=${encodeURIComponent(e.resource_id)}`;
  if (e.type === 'object' && e.element_id) return `${base}?focus=${encodeURIComponent(`object:${e.element_id}`)}`;
  return base;
}

/** "<name> · <floor> · <room>" with empty parts left out (the server's describe()). */
export function describeElement(name: string, floor: string, room?: string | null): string {
  return [name, floor, room ?? ''].map((s) => s.trim()).filter(Boolean).join(' · ');
}
