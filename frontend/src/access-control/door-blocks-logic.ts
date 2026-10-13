/**
 * WXUNBLK: the pure logic of Settings › חיבורים › "חסימות פתיחת דלתות" - the search and the filter over the blocked entities, the
 * paging, the words of a row, and the check of the note a release needs. Plain node (no DOM, no Lit, no network): the unit spec
 * (tests/unit-wxunblk.spec.ts) imports this module. The server decides everything that matters (what may be released, the note's
 * rules, the audit); this module only keeps the screen from sending what the server will refuse.
 */
import type { DoorBlockDevice, DoorBlockEntity, DoorBlockItem, DoorBlocks } from '../api/door-blocks';
import { bt, btDynamic } from '../i18n/door-blocks';

/** The server's limits of a note (services/door_overrides.py NOTE_MIN / NOTE_MAX). */
export const NOTE_MIN = 3;
export const NOTE_MAX = 300;
/** Rows drawn at first, and added by each "show more". */
export const PAGE = 50;

export type StatusFilter = 'all' | 'blocked' | 'released';
export const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'blocked', 'released'];
const FILTER_LABEL: Record<StatusFilter, 'fAll' | 'fBlocked' | 'fReleased'> = { all: 'fAll', blocked: 'fBlocked', released: 'fReleased' };
export const filterLabel = (f: StatusFilter): string => bt(FILTER_LABEL[f]);

/** The note as the server stores it: whitespace collapsed (a note is one line). */
export const cleanNote = (note: string): string => note.split(/\s+/).filter(Boolean).join(' ');

/** What is wrong with a note a release would send: nothing (null), too short, or too long. */
export function noteProblem(note: string): 'required' | 'too_long' | null {
  const n = cleanNote(note).length;
  if (n < NOTE_MIN) return 'required';
  return n > NOTE_MAX ? 'too_long' : null;
}

export function noteProblemText(problem: 'required' | 'too_long'): string {
  return problem === 'required' ? bt('needNote') : bt('tooLong', { max: NOTE_MAX });
}

const norm = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean).join(' ');

/** The entities a search and a filter leave: every word of the search must appear in the name, the entity id, the area, the kind of
 * device, or the reason of a release (a released one's note and who wrote it). */
export function filterEntities(entities: readonly DoorBlockEntity[], q: string, status: StatusFilter): DoorBlockEntity[] {
  const words = norm(q).split(' ').filter(Boolean);
  return entities.filter((e) => {
    if (status === 'blocked' && e.state === 'unblocked') return false;
    if (status === 'released' && e.state !== 'unblocked') return false;
    if (!words.length) return true;
    const hay = norm([e.name, e.entity_id, e.area ?? '', domainLabel(e.domain), e.override?.note ?? '', e.override?.by ?? ''].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

/** The first `shown` rows of a list, and how many are left. */
export function page<T>(rows: readonly T[], shown: number): { rows: T[]; left: number } {
  return { rows: rows.slice(0, shown), left: Math.max(0, rows.length - shown) };
}

/** A device's kind as a word ("מתג", "תאורה") - the entity's domain; unknown domains read as "התקן". */
export const domainLabel = (domain: string): string => btDynamic(`d_${domain}`, 'd_other');

/** "מתג · חצר": the kind and, when Home Assistant knows it, the area. */
export function entityMeta(e: Pick<DoorBlockEntity, 'domain' | 'area'>): string {
  return [domainLabel(e.domain), e.area].filter(Boolean).join(' · ');
}

/** The badge of an entity: blocked, released, or mapped to a door (never switchable). A release whose entity is gone says so. */
export function entityBadge(e: Pick<DoorBlockEntity, 'state' | 'stale'>): { kind: 'stale' | 'live' | 'unknown'; text: string } {
  if (e.state === 'door') return { kind: 'unknown', text: bt('sDoor') };
  if (e.state === 'unblocked') return { kind: 'live', text: e.stale ? `${bt('sReleased')} · ${bt('sStale')}` : bt('sReleased') };
  return { kind: 'stale', text: bt('sBlocked') };
}

/** "בשימוש: A, B ועוד 2": the saved items that use the entity (names; the server sends a few and counts the rest). */
export function usedByLine(e: Pick<DoorBlockEntity, 'used_by' | 'used_more'>): string {
  if (!e.used_by.length) return '';
  return bt('usedBy', { names: e.used_by.join(', ') }) + (e.used_more ? bt('usedMore', { n: e.used_more }) : '');
}

/** "שוחרר בידי X · <when>" for a released entity, '' for any other; `fmt` formats the instant (the screen passes its locale one). */
export function releasedLine(e: Pick<DoorBlockEntity, 'override'>, fmt: (iso: string) => string): string {
  return e.override ? bt('releasedBy', { who: e.override.by || '—', when: fmt(e.override.at) }) : '';
}

/** The blocked item's devices as one line: "התקנים וירטואליים: A, B (משוחרר) ועוד 2"; '' when its block has nothing to do with devices. */
export function itemDevicesLine(item: Pick<DoorBlockItem, 'devices' | 'devices_more'>): string {
  if (!item.devices.length) return '';
  const names = item.devices.map((d: DoorBlockDevice) => (d.state === 'unblocked' ? bt('itemDeviceReleased', { name: d.name }) : d.name)).join(', ');
  return bt('itemDevices', { names }) + (item.devices_more ? bt('itemDevicesMore', { n: item.devices_more }) : '');
}

/** The badge of an item: still refused, or freed by the releases. */
export function itemBadge(item: Pick<DoorBlockItem, 'blocked'>): { kind: 'stale' | 'live'; text: string } {
  return item.blocked ? { kind: 'stale', text: bt('itemBlocked') } : { kind: 'live', text: bt('itemFreed') };
}

/** The card's one-line summary of the entities. */
export function summaryLine(data: Pick<DoorBlocks, 'wiskey_present' | 'counts'>): string {
  if (!data.wiskey_present && !data.counts.entities) return bt('none');
  return bt('summary', { blocked: data.counts.blocked, released: data.counts.unblocked });
}
