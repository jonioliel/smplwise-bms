/** Saved views (live review F3): a named set of cameras with a cols × rows layout that opens the live wall or the
 * kiosk. Personal views belong to their owner; shared views need rbac.assign and are visible to everyone. */
import { del, get, post, put } from './client';

export interface SavedView {
  id: string;
  name: string;
  cameras: string[];
  camera_names: string[];
  hidden_cameras: number;
  cols: number;
  rows: number;
  shared: boolean;
  kiosk: boolean;
  owner_user_id: string;
  owner_username: string | null;
  created_at: string;
  updated_at: string;
}

export interface ViewBody {
  name: string;
  cameras: string[];
  cols: number;
  rows: number;
  shared: boolean;
  kiosk: boolean;
}

export const listViews = () => get<{ views: SavedView[]; can_share: boolean; can_manage_all: boolean }>('views');
export const createView = (body: ViewBody) => post<SavedView>('views', body);
export const updateView = (id: string, body: ViewBody) => put<SavedView>(`views/${id}`, body);
export const deleteView = (id: string) => del(`views/${id}`);

/** Where a view opens: the wall keeps its automatic layout; the kiosk takes cols × rows per page. */
export const wallHref = (v: SavedView) => `#/live/wall?cameras=${encodeURIComponent(v.cameras.join(','))}`;
export const kioskHref = (v: SavedView) => `#/kiosk/all?cameras=${encodeURIComponent(v.cameras.join(','))}&cols=${v.cols}&rows=${v.rows}`;
