import type { XtKey } from '../i18n/access-external';

/**
 * VENDMARK-295 (owner decision GRANTS3 Q1, 2026-10-21): the "permanent vendor" marker of the directory. Pure decisions, no DOM and no
 * module state, so the list, the editor and the identity card ask the same thing and a node test can pin it.
 * The marker is information only: it opens nothing and links nowhere (in particular it never offers a ticket action - the tickets
 * module may be off, and there is nothing here to hide behind the module switch).
 * Words come from the four-language access-external catalogue (he / en / ar / ru).
 */
export type MarkerFilter = 'all' | 'permanent' | 'temporary';
export const MARKER_FILTERS: readonly MarkerFilter[] = ['all', 'permanent', 'temporary'];

export interface MarkerView { permanent: boolean; key: XtKey; tone: 'ok' | 'off' }

/** The chip of one row: an unknown value (an older server) shows nothing rather than a wrong "temporary". */
export function markerView(flag: boolean | null | undefined): MarkerView | null {
  if (flag === undefined || flag === null) return null;
  return flag ? { permanent: true, key: 'vm_permanent', tone: 'ok' } : { permanent: false, key: 'vm_temporary', tone: 'off' };
}

export const filterKey = (f: MarkerFilter): XtKey => (f === 'all' ? 'vm_all' : f === 'permanent' ? 'vm_permanent' : 'vm_temporary');

/** The rows a filter leaves. */
export function byMarker<T extends { permanent_vendor?: boolean }>(rows: readonly T[], f: MarkerFilter): T[] {
  if (f === 'all') return [...rows];
  return rows.filter((r) => (r.permanent_vendor === true) === (f === 'permanent'));
}

/** A vendor company or an external person carries the marker; an employee without an account never does. */
export const carriesMarker = (kind: string | undefined): boolean => kind === 'vendor' || kind === 'person';
