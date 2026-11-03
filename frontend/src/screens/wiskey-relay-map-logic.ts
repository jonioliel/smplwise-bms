/**
 * Pure helpers of the "מיפוי ממסרים" card (WISKEY-RELAYMAP-2310, wiskey-relay-map.ts) - no DOM, unit-tested in Node
 * (tests/unit-wiskey-relay-map.spec.ts). Hebrew copy lives here so the card and the spec read the same words.
 */
import type { RelayMapStation } from '../api/wiskey-relay-map';

/** api relay -> physical relay (null: disabled) */
export type RelayDraft = Record<number, number | null>;

export const OFF = 'off';

export function relayName(s: RelayMapStation, physical: number): string {
  const r = s.relays.find((x) => x.physical_index === physical);
  return r?.name ? `ממסר פיזי ${physical} · ${r.name}` : `ממסר פיזי ${physical}`;
}

/** The select's options for one api relay: disabled, then every physical relay of the station. */
export function relayChoices(s: RelayMapStation): { value: string; label: string }[] {
  return [{ value: OFF, label: 'מושבת' }, ...s.relays.map((r) => ({ value: String(r.physical_index), label: relayName(s, r.physical_index) }))];
}

export function parseChoice(value: string): number | null {
  const n = Number(value);
  return value !== OFF && Number.isInteger(n) && n >= 1 ? n : null;
}

export function draftOf(s: RelayMapStation): RelayDraft {
  const out: RelayDraft = {};
  for (const r of s.rows) out[r.api_relay] = r.active ? r.physical_relay : null;
  return out;
}

export function rowsBody(d: RelayDraft): { api_relay: number; physical_relay: number | null }[] {
  return Object.keys(d)
    .map(Number)
    .sort((a, b) => a - b)
    .map((a) => ({ api_relay: a, physical_relay: d[a] ?? null }));
}

/** What the draft changes against the saved map: the doors (physical relays) it touches, the automated ones, a duplicate. */
export function mapDiff(s: RelayMapStation, d: RelayDraft): { changed: boolean; affected: number[]; automated: number[]; duplicate: number[] } {
  const saved = draftOf(s);
  const affected = new Set<number>();
  for (const a of Object.keys(saved).map(Number)) {
    const before = saved[a] ?? null;
    const after = d[a] ?? null;
    if (before === after) continue;
    if (before !== null) affected.add(before);
    if (after !== null) affected.add(after);
  }
  const active = Object.values(d).filter((p): p is number => p !== null);
  const duplicate = [...new Set(active.filter((p, i) => active.indexOf(p) !== i))].sort((a, b) => a - b);
  const sorted = [...affected].sort((a, b) => a - b);
  return { changed: sorted.length > 0, affected: sorted, automated: sorted.filter((p) => s.automated_relays.includes(p)), duplicate };
}

export function canApprove(s: RelayMapStation, d: RelayDraft, canEdit: boolean): boolean {
  const diff = mapDiff(s, d);
  return canEdit && s.in_copy && diff.changed && diff.duplicate.length === 0;
}

export function typedWordNeeded(s: RelayMapStation, d: RelayDraft): boolean {
  return mapDiff(s, d).automated.length > 0;
}

/** The station badge: not approved, partial (a physical relay no api relay drives) or approved, with the revision. */
export function stationStatus(s: RelayMapStation): { tone: 'live' | 'stale' | 'unknown'; text: string } {
  if (!s.in_copy) return { tone: 'stale', text: 'התחנה אינה מופיעה כעת ב-WisKey' };
  if (s.revision === 0) return { tone: 'unknown', text: 'לא אושר - חירום ואוטומציות דרך WisKey ייחסמו' };
  const driven = new Set(Object.values(draftOf(s)).filter((p) => p !== null));
  const missing = s.relays.map((r) => r.physical_index).filter((p) => !driven.has(p));
  if (missing.length) return { tone: 'stale', text: `חלקי · מהדורה ${s.revision} · ${missing.map((p) => `ממסר פיזי ${p}`).join(', ')} לא ממופה` };
  return { tone: 'live', text: `מאושר · מהדורה ${s.revision}` };
}

export function approvedLine(s: RelayMapStation, fmt: (iso: string) => string): string {
  if (!s.approved_at) return 'טרם אושר';
  return `אושר בידי ${s.approved_by ?? 'משתמש לא ידוע'} · ${fmt(s.approved_at)}`;
}

/** The confirmation dialog's question, naming the doors (by relay name) the change touches. */
export function approveQuestion(s: RelayMapStation, d: RelayDraft): string {
  const diff = mapDiff(s, d);
  const doors = diff.affected.map((p) => relayName(s, p)).join(', ');
  const auto = diff.automated.length ? ` לדלתות ${diff.automated.map((p) => relayName(s, p)).join(', ')} יש אוטומציה - היא תפעל לפי המיפוי החדש.` : '';
  return `לאשר את מיפוי הממסרים של ${s.name}? השינוי נוגע ל${doors}.${auto} שום פקודה לא נשלחת לתחנה.`;
}
