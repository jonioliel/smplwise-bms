/**
 * LOWS-FRONTEND-2550 (review SCR-48): the pure parts of the audit log screen (screens/system-audit.ts) - no DOM, no fetch, so a unit spec
 * tests them directly.
 */

/** The columns of the CSV export, in order (the server's field names). */
const AUDIT_CSV_COLUMNS = ['at', 'actor', 'action', 'decision', 'resource_type', 'resource_id', 'reason', 'request_id', 'permission_revision'] as const;

/** One CSV cell that a spreadsheet will not run: text starting like a formula (= + - @, a tab or a carriage return, and their full-width
 * forms) gets a leading apostrophe; quotes are doubled and the cell quoted (the rule of tickets/vendor-account-model.ts csvCell and
 * the server's text_hygiene.csv_cell). An audit row carries values other people typed (a user name, a reason, a resource id). */
export function auditCsvCell(value: unknown): string {
  const s = String(value ?? '');
  const t = /^[=+\-@\t\r＝＋－＠]/.test(s) ? `'${s}` : s;
  return `"${t.replace(/"/g, '""')}"`;
}

interface CsvRow {
  at?: unknown;
  actor_username?: unknown;
  action?: unknown;
  decision?: unknown;
  resource_type?: unknown;
  resource_id?: unknown;
  reason?: unknown;
  request_id?: unknown;
  permission_revision?: unknown;
}

/** The CSV text of the rows on screen (header + one line per row). */
export function auditCsv(rows: readonly CsvRow[]): string {
  const lines = [AUDIT_CSV_COLUMNS.join(',')];
  for (const r of rows) lines.push([r.at, r.actor_username, r.action, r.decision, r.resource_type, r.resource_id, r.reason, r.request_id, r.permission_revision].map(auditCsvCell).join(','));
  return lines.join('\n');
}

/** The time column: day, month, year and time of the event in the INSTALLATION's time zone (`time.zone`), as every other log of the
 * product - it used to follow the browser's own zone (a phone abroad, a laptop set to UTC). An unreadable time is shown as written. */
export function auditTime(iso: string, zone: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  try {
    return d.toLocaleString(locale, { ...opts, timeZone: zone });
  } catch {
    return d.toLocaleString(locale, opts); // an unknown zone name: the browser's own, as before
  }
}
