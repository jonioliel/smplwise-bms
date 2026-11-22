/** Saved views (live review F3): a named set of cameras with a cols × rows layout that opens the live wall or the
 * kiosk. Personal views belong to their owner; shared views need rbac.assign and are visible to everyone. */
import { del, get, path, post, put } from './client';
import type * as Wire from './generated/wire-views';

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/views.py), generated into
 * ./generated/wire-views.ts: a field the server renames or drops is a compile error here (code review 07:F8 step 2). */
export type SavedView = Wire.SavedViewRow;

export interface ViewBody {
  name: string;
  cameras: string[];
  cols: number;
  rows: number;
  shared: boolean;
  kiosk: boolean;
}

export const listViews = () => get<Wire.SavedViewList>('views');
export const createView = (body: ViewBody) => post<SavedView>('views', body);
export const updateView = (id: string, body: ViewBody) => put<SavedView>(path`views/${id}`, body);
export const deleteView = (id: string) => del(path`views/${id}`);

/** Where a view opens: the wall keeps its automatic layout; the kiosk takes cols × rows per page. */
export const wallHref = (v: SavedView) => `#/live/wall?cameras=${encodeURIComponent(v.cameras.join(','))}`;
export const kioskHref = (v: SavedView) => `#/kiosk/all?cameras=${encodeURIComponent(v.cameras.join(','))}&cols=${v.cols}&rows=${v.rows}`;
