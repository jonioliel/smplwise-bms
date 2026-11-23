/**
 * MULTI-BUILDING-SAFETY-2500 (owner decisions 22.11, Q62 / Q63 = the recommendations): the two safety steps of a multi-building site.
 *
 * Q62 - moving a floor to another building of its site (`GET /floors/{id}/move-preview?building=`, `POST /floors/{id}/move`): allowed only
 * to someone who manages the content of BOTH buildings (the server checks it), after a preview that names who loses access.
 * Q63 - the check before turning the multi-building switch on (`GET /home/multi-building/check`, then `PUT /home/multi-building` with the
 * check's digest); the installation setting `home.multi_building.review` = `skip` (an administrator of roles) skips it.
 *
 * Pure rules here (unit-tested) and the routes; the static demo's stand-ins are in ./mb-safety-demo.ts. No text: the screens word it.
 */
import { get, path, post, put, query } from './client';
import { isApi } from './session';
import type * as WireCatalog from './generated/wire-catalog';
import type * as WireMapping from './generated/wire-home-mapping';

export type MovePreview = WireCatalog.FloorMovePreview;
type MoveResult = WireCatalog.FloorMoveResult;
type MovePerson = WireCatalog.FloorMovePerson;
export type MultiCheck = WireMapping.HomeMultiBuildingCheck;
export type MultiFinding = WireMapping.HomeMultiBuildingFinding;
export type ReviewMode = WireMapping.HomeMultiBuildingReview['mode'];
export const REVIEW_MODES: readonly ReviewMode[] = ['required', 'skip'];

// ------------------------------------------------------------------------------------------------------------------------------ rules

/** The buildings a floor of `current` may move to: the other buildings of its site (none = the edit dialog shows no move row, so a
 * one-building site looks exactly as before). */
export function moveTargets<B extends { id: string }>(siteBuildings: readonly B[] | undefined, current: string): B[] {
  return (siteBuildings ?? []).filter((b) => b.id !== current);
}

/** The move button of the preview: enabled with no blocker, and - when anybody loses access - only after "אני מבין" is checked. */
export function moveGate(p: MovePreview | null, ack: boolean): { canMove: boolean; needsAck: boolean } {
  if (!p) return { canMove: false, needsAck: false };
  const needsAck = p.people.loses > 0;
  return { canMove: p.can_move && p.blockers.length === 0 && (!needsAck || ack), needsAck };
}

/** The first `max` people of one kind of change, and how many more there are (the list never scrolls). */
export function peopleOf(p: MovePreview, change: MovePerson['change'], max = 6): { shown: MovePerson[]; more: number } {
  const all = p.people.items.filter((x) => x.change === change);
  const total = change === 'loses' ? p.people.loses : change === 'gains' ? p.people.gains : p.people.changes;
  const shown = all.slice(0, max);
  return { shown, more: Math.max(0, total - shown.length) };
}

/** The records whose copy of the building follows the floor, summed. */
export function recordsMoving(p: MovePreview): number {
  const r = p.moves_with.records;
  return r.tickets + r.ticket_rfqs + r.maint_tasks + r.notices + r.incidents;
}

/** The "turn on" button of the check: enabled with no blocking finding and "בדקתי" checked. With the check skipped the switch goes on as
 * before (no dialog). */
export function checkGate(c: MultiCheck | null, ack: boolean): { canEnable: boolean; blocked: boolean } {
  if (!c) return { canEnable: false, blocked: false };
  const blocked = c.blocking > 0;
  return { canEnable: !blocked && ack, blocked };
}

/** Whether turning the switch on goes through the check dialog: `required` (the default, and any value an older server leaves out). */
export const needsCheck = (mode: ReviewMode | undefined | null): boolean => mode !== 'skip';

/** The findings in the order the dialog lists them: blocking, then warnings, then information; the server's order inside each. */
export function orderedFindings(c: MultiCheck): MultiFinding[] {
  const rank = { blocking: 0, warning: 1, info: 2 } as const;
  return c.findings.map((f, i) => ({ f, i })).sort((a, b) => rank[a.f.severity] - rank[b.f.severity] || a.i - b.i).map((x) => x.f);
}

// ----------------------------------------------------------------------------------------------------------------------------- routes

export async function previewMove(floorId: string, buildingId: string, demo?: import('./mb-safety-demo').DemoMoveContext): Promise<MovePreview> {
  if (!isApi()) return (await import('./mb-safety-demo')).demoPreview(floorId, buildingId, demo);
  return get<MovePreview>(path`floors/${floorId}/move-preview` + query({ building: buildingId }));
}

export async function moveFloor(floorId: string, buildingId: string, digest: string): Promise<MoveResult> {
  if (!isApi()) throw new Error('demo');
  return post<MoveResult>(path`floors/${floorId}/move`, { building_id: buildingId, preview_digest: digest });
}

export async function loadCheck(): Promise<MultiCheck> {
  if (!isApi()) return (await import('./mb-safety-demo')).demoCheck();
  return get<MultiCheck>('home/multi-building/check');
}

export async function setReview(mode: ReviewMode): Promise<WireMapping.HomeMultiBuildingReview> {
  if (!isApi()) return { mode };
  return put<WireMapping.HomeMultiBuildingReview>('home/multi-building/review', { mode });
}
