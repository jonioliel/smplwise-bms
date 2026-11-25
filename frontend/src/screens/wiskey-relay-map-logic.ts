/**
 * Pure helpers of the "מיפוי ממסרים" card (WISKEY-RELAYMAP-2310, wiskey-relay-map.ts) - no DOM, unit-tested in Node
 * (tests/unit-wiskey-relay-map.spec.ts). Hebrew copy lives here so the card and the spec read the same words.
 */
import type { RelayInventory, RelayMapStation } from '../api/wiskey-relay-map';
import { tr } from '../i18n/msg/wiskey';

/** api relay -> physical relay (null: disabled) */
export type RelayDraft = Record<number, number | null>;

export const OFF = 'off';

export function relayName(s: RelayMapStation, physical: number): string {
  const r = s.relays.find((x) => x.physical_index === physical);
  return r?.name ? `${tr('ממסר פיזי {n}', { n: physical })} · ${r.name}` : tr('ממסר פיזי {n}', { n: physical });
}

/** The select's options for one api relay: disabled, then every physical relay of the station. */
export function relayChoices(s: RelayMapStation): { value: string; label: string }[] {
  return [{ value: OFF, label: tr('מושבת') }, ...s.relays.map((r) => ({ value: String(r.physical_index), label: relayName(s, r.physical_index) }))];
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
  if (!s.in_copy) return { tone: 'stale', text: tr('התחנה אינה מופיעה כעת ב-WisKey') };
  if (s.revision === 0) return { tone: 'unknown', text: tr('לא אושר - חירום ואוטומציות דרך WisKey ייחסמו') };
  const driven = new Set(Object.values(draftOf(s)).filter((p) => p !== null));
  const missing = s.relays.map((r) => r.physical_index).filter((p) => !driven.has(p));
  if (missing.length) return { tone: 'stale', text: `${tr('חלקי')} · ${tr('מהדורה {n}', { n: s.revision })} · ${tr('{relays} לא ממופה', { relays: missing.map((p) => tr('ממסר פיזי {n}', { n: p })).join(', ') })}` };
  return { tone: 'live', text: `${tr('מאושר')} · ${tr('מהדורה {n}', { n: s.revision })}` };
}

export function approvedLine(s: RelayMapStation, fmt: (iso: string) => string): string {
  if (!s.approved_at) return tr('טרם אושר');
  return `${tr('אושר בידי {name}', { name: s.approved_by ?? tr('משתמש לא ידוע') })} · ${fmt(s.approved_at)}`;
}

/** The confirmation dialog's question, naming the doors (by relay name) the change touches. */
export function approveQuestion(s: RelayMapStation, d: RelayDraft): string {
  const diff = mapDiff(s, d);
  const doors = diff.affected.map((p) => relayName(s, p)).join(', ');
  const auto = diff.automated.length ? ` ${tr('לדלתות {doors} יש אוטומציה - היא תפעל לפי המיפוי החדש.', { doors: diff.automated.map((p) => relayName(s, p)).join(', ') })}` : '';
  return `${tr('לאשר את מיפוי הממסרים של {name}? השינוי נוגע ל{doors}.', { name: s.name, doors })}${auto} ${tr('שום פקודה לא נשלחת לתחנה.')}`;
}

// ---- WISKEY-RELAY-INV-2520: WisKey's relay inventory of one station (READ only), shown under the station's mapping

/** One shown line of the inventory: a label and its value; `unknown` marks a value nobody measured (shown as unknown, never guessed). */
export interface InventoryLine {
  key: 'outputs' | 'saved' | 'count' | 'roles' | 'test';
  label: string;
  value: string;
  unknown: boolean;
}

/**
 * The inventory as lines (ready) or one sentence why there is none. WisKey's contract pins the physical count to null, every role to
 * unknown and the relay test to unsupported; the lines say exactly that. API outputs are the station profile's remote-control outputs,
 * not physical relays: a null count is "not observed", never zero, and one output is never read as a single-relay station.
 */
export function inventoryView(inv: RelayInventory): { lines: InventoryLine[]; message: string | null } {
  const d = inv.data;
  if (inv.state !== 'ready' || !d) return { lines: [], message: inventoryMessage(inv) };
  const o = d.api_outputs;
  const outputs = o.count === null || o.evidence !== 'device_capability_at_load'
    ? tr('לא נצפו')
    : `${o.ids.map((n) => tr('ממסר API {n}', { n })).join(', ')} · ${tr('לפי יכולת העמדה בטעינה')}`;
  const saved = d.configured_mapping.length
    ? `${d.configured_mapping.map((m) => `${tr('ממסר פיזי {n}', { n: m.physical_index })} ← ${tr('ממסר API {n}', { n: m.api_id })}`).join(', ')} · ${tr('הגדרה שמורה, לא מדידה')}`
    : tr('לא נשמר מיפוי');
  return {
    message: null,
    lines: [
      { key: 'outputs', label: tr('יציאות API שהעמדה דיווחה'), value: outputs, unknown: o.count === null },
      { key: 'saved', label: tr('מיפוי שמור ב-WisKey'), value: saved, unknown: false },
      { key: 'count', label: tr('מספר ממסרים פיזיים'), value: d.physical_relay_count === null ? tr('לא ידוע') : String(d.physical_relay_count), unknown: d.physical_relay_count === null },
      // the contract pins every role to `unknown`, `physical_verified` to false and the relay test to unsupported: the server refuses
      // a document that says otherwise, so these two lines never show a role or a test the station did not prove
      { key: 'roles', label: tr('תפקיד הממסרים (דלת / שער)'), value: tr('לא ידוע'), unknown: true },
      { key: 'test', label: tr('בדיקת ממסר בלי להפעיל'), value: tr('לא נתמכת ב-WisKey'), unknown: false },
    ],
  };
}

/** Why there is no inventory to show (the read's honest state; nothing is retried by itself). */
export function inventoryMessage(inv: RelayInventory): string {
  switch (inv.state) {
    case 'unsupported':
      return tr('גרסת WisKey המותקנת אינה מציעה את הקריאה הזו - לא נשלח דבר.');
    case 'forbidden':
      return tr('WisKey סירב לקריאה.');
    case 'unavailable':
      return inv.reason === 'station_unloaded' ? tr('העמדה אינה טעונה כרגע ב-WisKey.') : tr('WisKey אינו זמין כרגע.');
    case 'busy':
      return tr('WisKey עסוק כרגע. אפשר לנסות שוב בעוד רגע.');
    default:
      return inv.reason === 'contract_mismatch' ? tr('תשובת WisKey אינה תואמת את החוזה ולכן אינה מוצגת.') : tr('הקריאה מ-WisKey נכשלה.');
  }
}
