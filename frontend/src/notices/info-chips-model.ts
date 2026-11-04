/**
 * TV-CHIPS-2381 (owner answers 03.11): the pure rules behind two Settings pieces, read by the elements and the unit spec alike.
 *
 *  - Q3 = B: a board's building chips (`display.blocks.info`) are an ORDERED list. The order is the order on the TV and the priority of
 *    the portrait "one row" footer (`portrait_chips: drop`, now the default): healthy chips leave first, and within one state the chip
 *    lowest in this list leaves first (notice-tv/tv-fit.ts `dropOrder`). The editor shows the picked kinds in their order, then the
 *    others in the factory order (elevators, generator, parking, gym).
 *  - Q4 = A: the parking and gym chips read entities picked in Settings › Notice board (`parking_entities` / `gym_entities`, at most 8
 *    each; the server checks the domain again). Nothing picked = no chip.
 */
export const INFO_KINDS = ['elevators', 'generator', 'parking', 'gym'] as const;
export type InfoKind = (typeof INFO_KINDS)[number];
export const SOURCE_KINDS = ['parking', 'gym'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export const SOURCE_MAX = 8;

export interface SourceEntity { entity_id: string; name: string; domain?: string }

const isKind = (k: unknown): k is InfoKind => (INFO_KINDS as readonly string[]).includes(k as string);

/** The picked kinds in the administrator's order (unknown and repeated entries left out). */
export function pickedOrder(value: readonly string[] | null | undefined): InfoKind[] {
  return [...new Set((value ?? []).filter(isKind))];
}

/** The rows of the editor: the picked kinds in their order, then the others in the factory order. */
export function infoRows(value: readonly string[] | null | undefined): { kind: InfoKind; on: boolean; pos: number; count: number }[] {
  const on = pickedOrder(value);
  const off = INFO_KINDS.filter((k) => !on.includes(k));
  return [...on.map((kind, pos) => ({ kind, on: true, pos, count: on.length })), ...off.map((kind) => ({ kind, on: false, pos: -1, count: on.length }))];
}

/** Ticking a kind adds it after the picked ones (lowest priority); unticking removes it. The order of the others is kept. */
export function toggleInfo(value: readonly string[] | null | undefined, kind: InfoKind, on: boolean): InfoKind[] {
  const cur = pickedOrder(value).filter((k) => k !== kind);
  return on ? [...cur, kind] : cur;
}

/** Moves a picked kind one place up (-1, higher priority) or down (+1); at an end, or for a kind not picked, nothing changes. */
export function moveInfo(value: readonly string[] | null | undefined, kind: InfoKind, dir: -1 | 1): InfoKind[] {
  const cur = pickedOrder(value);
  const i = cur.indexOf(kind);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cur.length) return cur;
  [cur[i], cur[j]] = [cur[j], cur[i]];
  return cur;
}

/** Parking / gym picked without a source: the chip will not show (the editor says so). `sources` absent = unknown, no note. */
export function needsSource(kind: InfoKind, sources: Partial<Record<SourceKind, readonly string[]>> | null | undefined): boolean {
  if (!sources || (kind !== 'parking' && kind !== 'gym')) return false;
  return !(sources[kind]?.length);
}

/** Adds an entity to a source list (no repeats, at most SOURCE_MAX). */
export function addSource(list: readonly string[], id: string): string[] {
  if (!id || list.includes(id) || list.length >= SOURCE_MAX) return [...list];
  return [...list, id];
}

export function removeSource(list: readonly string[], id: string): string[] {
  return list.filter((x) => x !== id);
}

/** What the "pick" list offers: the candidates not already picked. */
export function offerable(candidates: readonly SourceEntity[] | null | undefined, list: readonly string[]): SourceEntity[] {
  return (candidates ?? []).filter((c) => !list.includes(c.entity_id));
}

/**
 * BOARD-ANSWERS-2400 (owner 04.11, Q16 = A): "הפוך" per picked ON / OFF entity - its state is read the other way round (parking: on =
 * free instead of on = taken; gym: on = closed / free instead of on = open / in use). Numbers and lists cannot be inverted. Saved with
 * the sources (`parking_inverted` / `gym_inverted`, a subset of the picked list; the server checks it again and drops the flag of a
 * removed source). System administrators only, like the sources.
 */
export const INVERT_DOMAINS = ['binary_sensor', 'input_boolean', 'switch', 'schedule'] as const;

/** The change event of `<notice-info-sources>`: one chip's sources, or one chip's inverted list. */
export type InfoSourcesPatch = Partial<Record<`${SourceKind}_entities` | `${SourceKind}_inverted`, string[]>>;

/** Whether a picked entity can be inverted (an on / off entity, read from its id: a source the mirror lost keeps its flag visible). */
export function canInvert(id: string): boolean {
  return (INVERT_DOMAINS as readonly string[]).includes(id.split('.')[0] ?? '');
}

/** Turns "הפוך" on or off for one picked entity; the result keeps only picked, invertible entities, in the picked order. */
export function toggleInvert(picked: readonly string[], inverted: readonly string[], id: string, on: boolean): string[] {
  const set = new Set(inverted.filter((x) => x !== id));
  if (on) set.add(id);
  return picked.filter((x) => set.has(x) && canInvert(x));
}

/** The name shown for a picked entity: its name in the candidates, else null (the mirror no longer has it). */
export function sourceName(candidates: readonly SourceEntity[] | null | undefined, id: string): string | null {
  return (candidates ?? []).find((c) => c.entity_id === id)?.name ?? null;
}
