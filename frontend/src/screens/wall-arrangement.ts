/**
 * The wall arrangement model behind the "סידור הקיר" dialog (T091 order + column span, owner request 2026-09-30:
 * "לא להציג" = a camera hidden in the wall). Pure functions - no DOM, no Lit - so they run in node
 * (tests/unit-wall-arrangement.spec.ts).
 *
 * The arrangement is one system-wide set of per-camera fields (cameras.sort_order, grid_col_span, wall_hidden), written
 * through PATCH /cameras/{id} (sources.configure, audited) - there is no personal copy. The dialog list is kept in two
 * groups: the cameras shown in the wall first, the hidden ones after them (dimmed in the UI). The row order IS the new
 * sort_order (0..N-1), so a hidden camera keeps a place of its own and comes back where it was left.
 */
import type { Camera } from '../api/types';

export interface LayoutRow {
  id: string;
  name: string;
  span: number;
  hidden: boolean;
}

export interface CameraPatchBody {
  sort_order?: number;
  grid_col_span?: number;
  wall_hidden?: boolean;
}

export interface Original {
  sort_order: number;
  grid_col_span: number;
  wall_hidden: boolean;
}

/** A camera the wall shows (the wall grid, its stream budget, the kiosk pages derived from it). */
export const isOnWall = (c: Pick<Camera, 'wall_hidden'>): boolean => !c.wall_hidden;

/** The cameras of the wall, in their saved order. */
export const wallCameras = <T extends Pick<Camera, 'wall_hidden'>>(cams: T[]): T[] => cams.filter(isOnWall);

/** The footer of the wall: "N מתוך M מצלמות", or "מוצגות N מתוך M מצלמות" when some cameras are hidden (M counts them). */
export function wallFooterCount(shown: number, onWall: number, hidden: number): string {
  return hidden > 0 ? `מוצגות ${shown} מתוך ${onWall + hidden} מצלמות` : `${shown} מתוך ${onWall} מצלמות`;
}

/** The dialog's rows from the cameras in their saved order: shown ones first, hidden ones at the end (stable within each). */
export function rowsFromCameras(cams: Camera[]): LayoutRow[] {
  const row = (c: Camera): LayoutRow => ({ id: c.id, name: c.name, span: c.grid_col_span, hidden: !!c.wall_hidden });
  return [...cams.filter(isOnWall).map(row), ...cams.filter((c) => !isOnWall(c)).map(row)];
}

/** What each camera had when the dialog opened, to PATCH only what changed. */
export function originalsOf(cams: Camera[]): Map<string, Original> {
  return new Map(cams.map((c) => [c.id, { sort_order: c.sort_order, grid_col_span: c.grid_col_span, wall_hidden: !!c.wall_hidden }]));
}

/** Move a row one place up (-1) or down (+1) inside its own group: a shown row never passes a hidden one (and back). */
export function moveRow(rows: LayoutRow[], index: number, dir: -1 | 1): LayoutRow[] {
  const j = index + dir;
  if (index < 0 || index >= rows.length || j < 0 || j >= rows.length || rows[j].hidden !== rows[index].hidden) return rows;
  const next = rows.slice();
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

export const canMove = (rows: LayoutRow[], index: number, dir: -1 | 1): boolean => moveRow(rows, index, dir) !== rows;

/** "לא להציג" on or off: the row leaves the shown group for the start of the hidden group (it stays right below the last
 * shown camera), or returns to the end of the shown group. */
export function setHidden(rows: LayoutRow[], index: number, hidden: boolean): LayoutRow[] {
  const row = rows[index];
  if (!row || row.hidden === hidden) return rows;
  const rest = rows.filter((_, i) => i !== index);
  const firstHidden = rest.findIndex((r) => r.hidden);
  const at = firstHidden === -1 ? rest.length : firstHidden; // the end of the shown group / the start of the hidden one
  rest.splice(at, 0, { ...row, hidden });
  return rest;
}

export function setSpan(rows: LayoutRow[], index: number, span: number): LayoutRow[] {
  if (!rows[index]) return rows;
  const next = rows.slice();
  next[index] = { ...rows[index], span };
  return next;
}

/** The PATCHes that save the dialog: the rows take 0..N-1 in their order, every OTHER camera the caller can see (a
 * disabled one) follows right after them in its own relative order so nothing collides (review S2); only a field that
 * really changed is sent. */
export function buildPatches(rows: LayoutRow[], originals: Map<string, Original>, allCams: Camera[]): { id: string; body: CameraPatchBody }[] {
  const patches: { id: string; body: CameraPatchBody }[] = [];
  rows.forEach((row, i) => {
    const original = originals.get(row.id);
    const body: CameraPatchBody = {};
    if (!original || original.sort_order !== i) body.sort_order = i;
    if (!original || original.grid_col_span !== row.span) body.grid_col_span = row.span;
    if ((original?.wall_hidden ?? false) !== row.hidden) body.wall_hidden = row.hidden;
    if (Object.keys(body).length) patches.push({ id: row.id, body });
  });
  const rowIds = new Set(rows.map((r) => r.id));
  const others = allCams.filter((c) => !rowIds.has(c.id)).sort((a, b) => a.sort_order - b.sort_order || a.channel - b.channel);
  others.forEach((c, j) => {
    const target = rows.length + j;
    if (c.sort_order !== target) patches.push({ id: c.id, body: { sort_order: target } });
  });
  return patches;
}
