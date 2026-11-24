/**
 * RESPONSE-HINTS-2480 (owner N57): when the server refuses a booking because the slot is held, the hint says WHAT holds it and when.
 * The server names each row of `details.conflicts` (ADR-019: extra data under `details`): `title` is the entry's title where this
 * viewer may read it, `null` where it may not ("another booking"); `start` / `end` are the held range. An older server sends no `title`
 * key at all: the hint then names only the time. Pure (no DOM): unit-tested in Node (tests/unit-calendars-conflict-hint-2480.spec.ts).
 */
import { ApiError, describeError } from '../api/client';
import { tr } from '../i18n/msg/calendars';
import { ddmm, hm } from './model';
import { ltrIsolate } from '../i18n/bidi';

/** The refusals whose `details.conflicts` lists the entries that hold the slot. */
const CONFLICT_CODES: readonly string[] = ['conflict', 'maintenance_window', 'slot_held', 'displace_disabled'];

export interface ConflictRow {
  start: string;
  end: string;
  /** absent = an older server (not named); null = hidden from this viewer */
  title?: string | null;
}

/** The conflict rows of a refusal (empty for any other error). */
export function conflictsOf(e: unknown): ConflictRow[] {
  if (!(e instanceof ApiError) || !CONFLICT_CODES.includes(e.code)) return [];
  const raw = (e.body.details as { conflicts?: unknown } | undefined)?.conflicts;
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is ConflictRow => !!c && typeof c === 'object' && typeof (c as ConflictRow).start === 'string' && typeof (c as ConflictRow).end === 'string');
}

/** The entry's name for the hint: its title in quotes, "another booking" when hidden, '' when the server did not say. */
export function conflictName(c: Pick<ConflictRow, 'title'>): string {
  if (c.title === undefined) return '';
  return c.title ? `"${c.title}"` : tr('הזמנה אחרת');
}

/** "03.11 10:00–11:00" (the viewer's clock, like every time on the calendar screens) as ONE left-to-right run: a bidi isolate, or
 * inside a Hebrew sentence the range reads reversed ("11:00–10:00"). */
export function conflictWhen(c: Pick<ConflictRow, 'start' | 'end'>): string {
  return ltrIsolate(`${ddmm(new Date(c.start))} ${hm(c.start)}–${hm(c.end)}`);
}

/** The line added under the refusal: 'מתנגש עם "ישיבת הנהלה" · 03.11 10:00–11:00' (+N when several entries hold it); '' when none listed. */
export function conflictLine(rows: readonly ConflictRow[]): string {
  const c = rows[0];
  if (!c) return '';
  const name = conflictName(c);
  const when = conflictWhen(c);
  const more = rows.length > 1 ? ` (${tr('ועוד {n}', { n: rows.length - 1 })})` : '';
  return `${name ? tr('מתנגש עם {what} · {when}', { what: name, when }) : tr('מתנגש עם המועד {when}', { when })}${more}`;
}

/** The calendar screens' error text: the server's words, then what holds the slot when the refusal is a conflict. */
export function calErrorText(e: unknown, base: string = describeError(e)): string {
  const line = conflictLine(conflictsOf(e));
  return line ? `${base} ${line}` : base;
}
