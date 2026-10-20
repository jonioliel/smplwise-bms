/**
 * VENDORQ2-295: the pure rules of `<tickets-reports-settings>` (Settings > the module > message channel). Mirrors the server's
 * `reports.*` keys (services/tickets/settings_doc.py): three switches, all OFF by default, and the document link's two limits
 * (hours 1..168, downloads 1..20). The server validates again; nothing here grants anything.
 */
export interface ReportsSettings { to_contacts: boolean; email: boolean; documents: boolean; document_hours: number; document_max_opens: number }
export type ReportsPatch = Partial<ReportsSettings>;

export const REPORTS_DEFAULTS: ReportsSettings = { to_contacts: false, email: false, documents: false, document_hours: 72, document_max_opens: 5 };
export const REPORT_LIMITS = { document_hours: [1, 168], document_max_opens: [1, 20] } as const;

/** The stored block with the defaults filled in (an older server without the block answers null: the card is not shown). */
export function reportsOf(raw: Partial<ReportsSettings> | undefined | null): ReportsSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    to_contacts: raw.to_contacts === true,
    email: raw.email === true,
    documents: raw.documents === true,
    document_hours: Number.isInteger(raw.document_hours) ? (raw.document_hours as number) : REPORTS_DEFAULTS.document_hours,
    document_max_opens: Number.isInteger(raw.document_max_opens) ? (raw.document_max_opens as number) : REPORTS_DEFAULTS.document_max_opens,
  };
}

/** A typed whole number inside the key's range, or null. */
export function limitedInt(raw: string, key: keyof typeof REPORT_LIMITS): number | null {
  if (!/^\d{1,4}$/.test(raw.trim())) return null;
  const n = Number(raw);
  const [lo, hi] = REPORT_LIMITS[key];
  return n >= lo && n <= hi ? n : null;
}

/** The sub-switches (e-mail, documents) only make sense under the master switch; their inputs are disabled while it is off. */
export function subControlsEnabled(s: ReportsSettings): boolean {
  return s.to_contacts;
}
export function documentFieldsEnabled(s: ReportsSettings): boolean {
  return s.to_contacts && s.documents;
}

/** The patch for one number field, or null when the text is invalid or unchanged. */
export function numberPatch(s: ReportsSettings, key: 'document_hours' | 'document_max_opens', raw: string): ReportsPatch | null {
  const n = limitedInt(raw, key);
  return n === null || n === s[key] ? null : { [key]: n };
}
