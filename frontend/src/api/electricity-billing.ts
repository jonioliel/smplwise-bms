/**
 * CR-023 electricity (accounts, bills, customers, billing settings): the ONE module that talks to the billing API.
 * Every screen under src/screens/electricity/ and src/electricity/ imports from here and from nowhere else, so a contract
 * change is an edit in this file and in electricity-billing-mock.ts only. The wire contract is
 * docs/architecture/ELECTRICITY_BILLING_API.md (REST, error codes) and ELECTRICITY_BILL_SNAPSHOT.md (the bill document);
 * the wire types below follow them. Money, kWh and prices are decimal strings; dates are local `YYYY-MM-DD`.
 *
 * Without a backend (static preview, design review, the Playwright specs) every call is answered by the in-memory mock
 * store in ./electricity-billing-mock.ts (the schedules.ts / schedules-mock.ts pattern). The server drops every money key for
 * a caller without `energy.bills` (the keys are absent, not null); the UI never draws money without that permission.
 */
import { ApiError, api, apiUrl, del, get, patch, post, put } from './client';
import { isApi } from './session';
import { MOCK_TODAY, mockBackend } from './electricity-billing-mock';
// the meters endpoints have ONE client (electricity-meters.ts, ELECTRICITY_INTERFACES.md section 3); this module never calls them itself
import { listMeters, type Meter } from './electricity-meters';
import { coefficients, factorLabel, type FormulaAst } from '../electricity/elec-formula';
import { addDays, billNumber, daysInclusive, fmtRange, monthShort, r2 } from '../electricity/elec-format';
import type { TouCheck, TouDefinition, TouTemplate } from '../electricity/elec-tou';

export type { FormulaAst, TouCheck, TouDefinition, TouTemplate };
export type BillState = 'draft' | 'issued' | 'sent' | 'paid' | 'void';
export type PriceMode = 'ex_vat' | 'inc_vat';
export type AutoMode = 'off' | 'draft' | 'issue';
export type SentHow = 'email' | 'hand' | 'other';

export const BILL_STATE_LABEL: Record<BillState, string> = { draft: 'טיוטה', issued: 'הונפק', sent: 'נשלח', paid: 'שולם', void: 'בוטל' };
export const BILL_STATES: BillState[] = ['draft', 'issued', 'sent', 'paid', 'void'];
export const AUTO_LABEL: Record<AutoMode, string> = { draft: 'ליצור טיוטה', issue: 'להנפיק אוטומטית', off: 'בלי יצירה אוטומטית' };

/** Hebrew texts for the server's error codes (used when the server sends no user_message). */
export const ERROR_TEXT: Record<string, string> = {
  forbidden: 'אין הרשאה לפעולה הזו.',
  validation: 'אחד השדות אינו תקין.',
  not_found: 'הפריט לא נמצא.',
  revision_conflict: 'הפריט השתנה בינתיים. רעננו ונסו שוב.',
  formula_invalid: 'הנוסחה אינה תקינה.',
  formula_negative: 'התוצאה שלילית בתקופה הזו. בדקו את הנוסחה או את המונים.',
  tariff_missing: 'אין מחיר בתוקף בתאריך הזה. הגדירו מחיר בהגדרות.',
  vat_missing: 'אין שיעור מע״מ בתוקף בתאריך הזה. הגדירו שיעור בהגדרות.',
  period_invalid: 'התקופה אינה תקינה.',
  period_overlap: 'כבר קיים חיוב לתקופה הזו. אפשר לתקן אותו במקום ליצור חדש.',
  draft_exists: 'כבר קיימת טיוטה לתקופה הזו.',
  bill_not_draft: 'אפשר לבצע את הפעולה רק על טיוטה.',
  bill_state: 'הפעולה אינה אפשרית במצב הנוכחי של החיוב.',
  reason_required: 'צריך לכתוב סיבה.',
  customer_number_taken: 'מספר הלקוח כבר בשימוש.',
  customer_number_locked: 'אי אפשר לשנות מספר של לקוח שיש לו חיובים ממוספרים.',
  customer_has_accounts: 'ללקוח יש חשבונות פעילים. אי אפשר למחוק אותו.',
  tariff_in_use: 'התעריף בשימוש. אי אפשר למחוק אותו.',
  version_exists: 'כבר קיימת גרסה עם תאריך התחלה זהה.',
  pdf_unavailable: 'יצירת PDF אינה זמינה בהתקנה הזו.',
  pdf_render_failed: 'יצירת קובץ ה-PDF נכשלה. החיוב נשמר ואפשר לנסות שוב.',
  pdf_timeout: 'יצירת קובץ ה-PDF לקחה יותר מדי זמן. החיוב נשמר ואפשר לנסות שוב.',
  pdf_page_limit: 'החיוב ארוך מדי לקובץ PDF (יותר מדי עמודים).',
  pdf_too_large: 'קובץ ה-PDF גדול מדי. נסו לוגו קטן יותר.',
  logo_invalid: 'הלוגו חייב להיות PNG או JPEG עד 1MB.',
  tariff_definition_invalid: 'הגדרת התעריף לפי שעות אינה תקינה.',
  tariff_kind_mixed: 'בתקופה יש גם מחיר קבוע וגם תעריף לפי שעות.',
  tou_needs_interval_data: 'לחישוב לפי שעות נדרשים נתוני רבע שעה, ולתקופה זו הם כבר לא נשמרים.',
  nothing_changed: 'לא בוצע שינוי.',
};

// ------------------------------------------------------------------------------------------------ wire types

export interface CustomerRef {
  id: string;
  customer_number: string;
  name: string;
}
export interface Customer extends CustomerRef {
  revision: number;
  account_count: number;
  /** contact fields: only with energy.bills or energy.manage */
  address?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  notes?: string;
  /** on GET /customers/{id} */
  accounts?: { id: string; name: string; status: string }[];
  bills?: BillSummary[];
}
export interface CustomerBody {
  name: string;
  customer_number?: string;
  address: string;
  phone: string;
  email: string;
  tax_id: string;
  notes: string;
}

export type TariffKind = 'fixed' | 'tou';
export interface TariffVersion {
  id: string;
  effective_from: string;
  /** null for a time-of-use version (its prices are per season and band, in `definition`) */
  price: string | null;
  price_mode: PriceMode;
  /** EL5: the time-of-use definition of the version */
  definition?: TouDefinition;
  definition_sha256?: string;
}
export interface TariffVersionBody {
  name: string;
  /** the flat price of a fixed tariff ('' for a time-of-use tariff) */
  price: string;
  price_mode: PriceMode;
  effective_from: string;
  /** EL5: set = a time-of-use version (the tariff's kind is fixed at creation) */
  definition?: TouDefinition | null;
}
/** What saving a corrected price does: `later_only` = sealed bills keep the old price and the new one starts at `applies_from`. */
export interface TariffVersionPlan {
  kind: 'in_place' | 'later_only';
  applies_from: string;
  old: { effective_from: string; price: string | null; price_mode: PriceMode; definition_sha256?: string };
  new: { effective_from: string; price: string | null; price_mode: PriceMode; definition_sha256?: string };
  message_he: string;
}
export interface Tariff {
  id: string;
  name: string;
  currency: string;
  kind: TariffKind;
  versions: TariffVersion[];
  current: TariffVersion | null;
  used_by: number;
}
/** EL5: one special day of the time-of-use calendar (a holiday, its eve, or a cancelled generated day = regular). */
export interface CalendarDay {
  date: string;
  kind: 'holiday' | 'holiday_eve' | 'regular';
  kind_he: string;
  name_he: string;
  source: 'generated' | 'manual';
  /** the computed entry a manual one replaces */
  generated: { date: string; kind: string; kind_he: string; name_he: string; source: string } | null;
}
export interface CalendarYear {
  year: number;
  revision: number;
  generator: 'israel' | 'none';
  days: CalendarDay[];
  note_he: string;
  drafts_to_recalculate?: number;
}
export interface VatRate {
  id: string;
  effective_from: string;
  rate_percent: string;
}
export interface VatRates {
  items: VatRate[];
  current: VatRate | null;
}

export interface Account {
  id: string;
  name: string;
  customer: CustomerRef;
  formula: { ast: FormulaAst; text: string; sentence_he: string; meter_ids: string[] };
  tariff: { id: string; name: string; kind?: TariffKind; price?: string | null; price_mode?: PriceMode };
  period_months: 1 | 2;
  period_anchor_day: number;
  period_anchor_month: number;
  first_period_start: string;
  timezone: string;
  auto_mode: AutoMode;
  status: 'active' | 'paused';
  revision: number;
  next_period: { from: string; to: string };
  last_bill: BillSummary | null;
}
export interface AccountBody {
  name: string;
  customer_id: string;
  formula: { ast: FormulaAst };
  tariff_id: string;
  period_months: 1 | 2;
  period_anchor_day: number;
  period_anchor_month: number;
  first_period_start: string;
  auto_mode: AutoMode;
}

export interface StatusMeterWire {
  meter_id: string;
  name: string;
  kwh: string;
  last_report_at: string | null;
  reporting: boolean;
  /** optional: the readings at the period start and now (shown when the server sends them) */
  start_reading_kwh?: string;
  end_reading_kwh?: string;
}
export interface AccountStatusWire {
  period: { from: string; to: string };
  kwh_so_far: string;
  meters: StatusMeterWire[];
  notes: string[];
  amount_so_far?: string;
}
export interface PeriodRow {
  from: string;
  to: string;
  state: 'billed' | 'draft' | 'open' | 'future';
  bill: BillSummary | null;
}

export interface BillSummary {
  id: string;
  account_id: string;
  account_name: string;
  customer: CustomerRef;
  number: string | null;
  revision: number;
  state: BillState;
  origin: 'manual' | 'auto';
  period: { from: string; to: string };
  issue_date: string | null;
  due_date: string | null;
  kwh: string;
  total: string;
  replaces_bill_id: string | null;
  replaced_by_bill_id: string | null;
  row_version: number;
}

export interface HistoryPoint {
  from: string;
  to: string;
  kwh: string | null;
  status?: 'measured' | 'partial' | 'missing';
  source?: 'bill' | 'readings' | null;
}
/** snapshot.history: the comparison series of the consumption chart (owner round 3). Absent data is absent: nothing is invented. */
export interface BillHistory {
  current: { from: string; to: string; kwh: string } | null;
  previous: HistoryPoint[];
  same_period_last_year: HistoryPoint | null;
}
export interface SnapshotMeter {
  meter_id: string;
  name: string;
  coefficient: string;
  start: { at: string; reading_kwh: string; kind: string };
  end: { at: string; reading_kwh: string; kind: string };
  consumption_kwh: string;
  contribution_kwh: string;
  carried_in_kwh?: string;
  resets?: { at: string }[];
  last_report_at?: string | null;
  reported_to_end?: boolean;
}
export interface SnapshotLine {
  from: string;
  to: string;
  kwh: string;
  price_entered: string;
  price_mode: PriceMode;
  unit_price_ex_vat: string;
  amount_ex_vat: string;
  vat_rate_percent: string;
  vat_amount: string;
  total: string;
  /** EL5: a time-of-use line names its season and band; `hours` = clock hours of the period in them */
  season?: { id: string; name_he: string };
  band?: { id: string; name_he: string };
  hours?: string;
}
/** EL5: snapshot.tou of a time-of-use bill (ELECTRICITY_BILL_SNAPSHOT.md section 6). */
export interface SnapshotTou {
  engine: string;
  names: { seasons: Record<string, string>; day_types: Record<string, string>; bands: Record<string, string> };
  versions: { tariff_version_id: string; effective_from: string; price_mode: PriceMode; definition: TouDefinition; definition_sha256: string }[];
  special_days: { date: string; kind: string; kind_he: string; name_he: string; source: string }[];
  by_band: { band: { id: string; name_he: string }; kwh: string; amount_ex_vat: string; total: string; hours: string }[];
  daily: { date: string; season: string; day_type: string; kwh: string; bands: { band: string; kwh: string }[]; special: { kind: string; name_he: string } | null }[];
}
export interface BillSnapshot {
  schema: string;
  doc: { title_he: string; subtitle_he: string; is_tax_invoice: boolean };
  bill: {
    id: string;
    number: string | null;
    revision: number;
    replaces: { bill_id: string; number: string } | null;
    state: string;
    issue_date: string | null;
    due_date: string | null;
    expected_due_date: string | null;
    payment_terms: { mode: string; days: number | null; day_of_month: number | null };
  };
  period: { from: string; to: string; days: number };
  business: { name: string; registration_no: string; address: string; phone: string; email: string; accent_color: string; footer_note: string; logo: { sha256: string; mime: string } | null };
  customer: { id: string; customer_number: string; name: string; address: string; phone: string; email: string; tax_id: string };
  account: { id: string; name: string; tariff: { id: string; name: string; kind?: TariffKind }; formula: { text: string; sentence_he: string } };
  meters: SnapshotMeter[];
  lines: SnapshotLine[];
  /** EL5: present on a time-of-use bill only */
  tou?: SnapshotTou;
  totals: { currency: string; kwh: string; amount_ex_vat: string; vat_amount: string; total: string; vat_breakdown: { rate_percent: string; base: string; vat: string }[]; price_mode_note_he: string | null };
  notes: { code: string; text_he: string }[];
  history: BillHistory;
  meta: { software_version: string; computed_at: string };
  /** the first 12 hex characters of snapshot_sha256 (the server sends the full hash on the Bill) */
}
export type BillAction = 'recalculate' | 'delete' | 'issue' | 'sent' | 'paid' | 'correct' | 'void' | 'pdf';
/** The PDF codes of the server (GET /energy/bills/{id}/pdf): 503 render_failed / timeout (retryable), 422 page_limit / too_large, 503 unavailable. */
export type PdfErrorCode = 'pdf_render_failed' | 'pdf_timeout' | 'pdf_page_limit' | 'pdf_too_large' | 'pdf_unavailable';
export const PDF_RETRYABLE: readonly string[] = ['pdf_render_failed', 'pdf_timeout'];
/**
 * The bill's PDF: stored = an issued bill whose PDF file is saved; ready = can be produced on request; failed = the last attempt failed
 * (`error_code`, `failed_at` UTC ISO); unavailable = no PDF engine in this build.
 */
export interface BillPdf {
  state: 'stored' | 'ready' | 'failed' | 'unavailable';
  error_code: string | null;
  failed_at: string | null;
  engine: 'weasyprint' | 'fpdf2' | null;
}
export interface Bill extends BillSummary {
  snapshot: BillSnapshot;
  snapshot_sha256: string | null;
  /** `at` is a DATE (`YYYY-MM-DD`) */
  sent: { at: string; how: SentHow; note: string } | null;
  /** `at` is a DATE (`YYYY-MM-DD`) */
  paid: { at: string; reference: string } | null;
  void: { at: string; reason: string } | null;
  actions: BillAction[];
  /** absent from an older server: treated as "ready" */
  pdf?: BillPdf;
}
/** POST /energy/bills/{id}/sent: `at` a date (`YYYY-MM-DD`, default today on the server) */
export interface SentBody {
  at?: string;
  how: SentHow;
  note?: string;
  row_version?: number;
}
/** POST /energy/bills/{id}/paid: `at` a date (`YYYY-MM-DD`) */
export interface PaidBody {
  at?: string;
  reference?: string;
  row_version?: number;
}
export interface BillEventWire {
  at: string;
  action: string;
  actor: { kind: string; display_name?: string };
  details: Record<string, unknown>;
}
export interface BillList {
  items: BillSummary[];
  total: number;
  counts: Record<BillState, number>;
}
export interface BillsQuery {
  state?: BillState | '';
  from?: string;
  to?: string;
  q?: string;
  account_id?: string;
  customer_id?: string;
}
export type PeriodChoice = { kind: 'last' } | { kind: 'range'; from: string; to: string };

export interface PaymentTerms {
  mode: 'net_days' | 'day_of_month';
  days: number;
  day_of_month: number;
}
export interface BillingSettings {
  revision: number;
  default_price_mode: PriceMode;
  payment_terms: PaymentTerms;
  business: { name: string; registration_no: string; address: string; phone: string; email: string; accent_color: string; footer_note: string };
  numbering: { customer_digits: number; format: string };
  auto: { delay_hours: number };
  logo: { sha256: string; mime: string; width: number; height: number } | null;
  /** the PDF engine of this installation (read only; null or absent from an older server) */
  pdf_engine?: PdfEngine | null;
}
export interface PdfEngine {
  configured: string;
  active: 'weasyprint' | 'fpdf2' | null;
  checked: string | null;
  detail: string | null;
  last_render_engine: string | null;
  slow_fallbacks: number;
  fallback_after_s: number;
}
export type BillingSettingsPatch = Partial<Pick<BillingSettings, 'default_price_mode' | 'payment_terms' | 'business' | 'auto'>>;

export interface FormulaCheckWire {
  ok: boolean;
  errors: { code: string; message: string; pos?: number }[];
  warnings: { code: string; message: string }[];
  preview: { period: { from: string; to: string }; meters: { meter_id: string; name: string; kwh: string }[]; result_kwh: string; negative: boolean } | null;
}
/** The editor's live check: each meter's consumption on the last full period and the account result. */
export interface FormulaPreview {
  ok: boolean;
  errors: string[];
  warnings: string[];
  period_from: string;
  period_to: string;
  rows: { meter_id: string; name: string; kwh: number }[];
  result_kwh: number | null;
  negative: boolean;
}

// ------------------------------------------------------------------------------------------------ view models

/** A meter of the wizard and the formula editor: the meters module's model (src/api/electricity-meters.ts) plus the consumption of the last full
 * period for the editor's chips (null = not known; the formula check endpoint gives the numbers of the preview). */
export interface ElecMeter extends Meter {
  last_period_kwh: number | null;
}

export interface AccountRow {
  account: Account;
  kwh: number | null;
  amount?: string;
  stale: boolean;
}
export interface StatusRow {
  meter_id: string;
  name: string;
  stale: boolean;
  start: number | null;
  end: number | null;
  kwh: number;
  factor: string;
  part: number;
}
export interface AccountStatus {
  account: Account;
  period: { from: string; to: string; day: number; days: number };
  kwh: number;
  forecast_kwh: number;
  avg_per_day: number;
  amount_so_far?: string;
  rows: StatusRow[];
  stale: { meter: string; since: string } | null;
  notes: string[];
  next: { from: string; to: string; number: string; draft_on: string };
  customer: Customer | null;
  price?: { tariff: string; ex_vat: string; inc_vat: string; vat: string };
}
/** GET /energy/accounts/{aid}/history?past=N: the ENDED regular periods, oldest first (the last one is the latest ended period). */
export interface HistoryPeriodWire {
  from: string;
  /** inclusive last day */
  to: string;
  /** null = no data (never invented) */
  kwh: string | null;
  status: 'measured' | 'partial' | 'missing';
  source: 'bill' | 'readings' | null;
  /** `total` only for energy.bills holders */
  bill: BillSummary | null;
}
export interface AccountHistoryWire {
  periods: HistoryPeriodWire[];
  /** snapshot.history's shape, for the latest ended period */
  comparison: BillHistory;
}
export interface HistoryRow {
  label: string;
  from: string;
  to: string;
  /** null = no data for the period (shown as such, never as zero) */
  kwh: number | null;
  status: 'measured' | 'partial' | 'missing';
  source: 'bill' | 'readings' | null;
  /** against the period just before, when both have data */
  change_pct: number | null;
  /** the issued bill's total (energy.bills only); a period without a bill has none */
  amount?: string;
  bill: BillSummary | null;
}
export interface AccountHistory {
  rows: HistoryRow[];
  comparison: BillHistory;
}
export interface BillEvent {
  at: string;
  text: string;
}

// ------------------------------------------------------------------------------------------------ demo control
// Who may do what: src/electricity/access.ts (energyAccess, the one source of the energy permissions; it reads `persona` below in demo mode).

/** Demo personas for the specs and design review (`localStorage['sw.demo.electricity']`, JSON). */
export interface DemoControl {
  persona?: 'full' | 'view' | 'bills_only';
  empty?: boolean;
  /** make one list fail: accounts | bills | customers | settings */
  fail?: string;
  /** every issued bill's PDF failed last time (pdf.state = failed) until "create the PDF again" succeeds */
  pdf_failed?: boolean;
  /** every PDF request fails with this code (pdf_render_failed | pdf_timeout | pdf_page_limit | pdf_too_large | pdf_unavailable; the last also makes
   * every bill's pdf.state "unavailable") */
  pdf_error?: string;
  /** the next bill creation fails with this code: formula_negative | tariff_missing | vat_missing | period_overlap */
  create_error?: string;
  /** artificial delay in ms (loading states) */
  latency?: number;
  /** EL5: the shared-areas account bills on a time-of-use tariff (band lines, the daily table) */
  tou?: boolean;
}
export function demoControl(): DemoControl {
  try {
    return JSON.parse(localStorage.getItem('sw.demo.electricity') || '{}') as DemoControl;
  } catch {
    return {};
  }
}

// ------------------------------------------------------------------------------------------------ the backend contract

/** Everything the screens call. `rest` talks to the server (wire -> view models); `mockBackend` is the in-memory twin. */
export interface ElecBackend {
  /** kWh of the last full period per meter id, for the formula editor's chips (the server has no such read: an empty map). */
  lastPeriodKwh(ids: string[]): Promise<Record<string, number>>;
  listAccounts(): Promise<AccountRow[]>;
  getAccount(id: string): Promise<Account>;
  accountStatus(id: string): Promise<AccountStatus>;
  /** `past`: how many ended periods (1-24) */
  accountHistory(id: string, past: number): Promise<AccountHistory>;
  createAccount(body: AccountBody, afterSave: 'draft' | 'none'): Promise<{ account: Account; bill: BillSummary | null; billError: string }>;
  updateAccount(id: string, revision: number, body: Partial<AccountBody>): Promise<Account>;
  checkFormula(ast: FormulaAst): Promise<FormulaPreview>;
  nextCustomerNumber(): Promise<string>;
  listCustomers(q?: string): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer>;
  createCustomer(body: CustomerBody): Promise<Customer>;
  updateCustomer(id: string, revision: number, body: Partial<CustomerBody>): Promise<Customer>;
  deleteCustomer(id: string, revision: number): Promise<void>;
  listTariffs(): Promise<Tariff[]>;
  /** a fixed tariff (price) or, with `definition`, a time-of-use tariff */
  createTariff(body: TariffVersionBody): Promise<Tariff>;
  addTariffVersion(id: string, body: TariffVersionBody): Promise<Tariff>;
  /** EL5: the time-of-use templates (empty prices) */
  touTemplates(): Promise<TouTemplate[]>;
  /** EL5: validate a definition without saving (the day grid also when only prices are missing) */
  checkTou(definition: TouDefinition): Promise<TouCheck>;
  /** EL5: the special days of a year */
  getCalendar(year: number): Promise<CalendarYear>;
  setCalendarDay(date: string, kind: CalendarDay['kind'], name_he: string, revision: number): Promise<CalendarYear>;
  removeCalendarDay(date: string, revision: number): Promise<CalendarYear>;
  setCalendarGenerator(generator: CalendarYear['generator'], revision: number, year: number): Promise<CalendarYear>;
  /** A correction of one price version (or a new price on the date of an existing one). `confirm: false` only returns the plan. */
  correctTariffVersion(id: string, body: TariffVersionBody, opts: { replaceId: string | null; base: TariffVersion | null; confirm: boolean }): Promise<{ applied: boolean; plan: TariffVersionPlan | null }>;
  getVat(): Promise<VatRates>;
  addVat(rate_percent: string, effective_from: string): Promise<VatRates>;
  listBills(q?: BillsQuery): Promise<BillList>;
  getBill(id: string): Promise<Bill>;
  billEvents(id: string): Promise<BillEvent[]>;
  createBill(accountId: string, period: PeriodChoice): Promise<Bill>;
  recalcBill(b: BillSummary): Promise<Bill>;
  deleteDraft(b: BillSummary): Promise<void>;
  issueBill(b: BillSummary): Promise<Bill>;
  markSent(id: string, body: SentBody): Promise<Bill>;
  markPaid(id: string, body: PaidBody): Promise<Bill>;
  correctBill(id: string): Promise<Bill>;
  voidBill(id: string, reason: string): Promise<Bill>;
  /** fetches the PDF; rejects with a PdfErrorCode: 503 pdf_render_failed / pdf_timeout (retryable), 422 pdf_page_limit / pdf_too_large, 503 pdf_unavailable */
  fetchPdf(id: string): Promise<Blob>;
  getSettings(): Promise<BillingSettings>;
  saveSettings(revision: number, body: BillingSettingsPatch): Promise<BillingSettings>;
  uploadLogo(file: File): Promise<void>;
  removeLogo(): Promise<void>;
  logoUrl(sha: string): string;
}

const E = 'energy/';
const qs = (o: Record<string, string | number | undefined>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
const uid = (): string => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
/** The value of a version on the wire: a time-of-use definition, or the flat price. */
const valueOf = (b: TariffVersionBody): Record<string, unknown> => (b.definition ? { definition: b.definition } : { price: b.price });
const num = (s: string | number | null | undefined): number => (s === null || s === undefined || s === '' ? 0 : Number(s));

/** Derives the status screen's model from the wire answers (shared by the REST adapter and the mock). */
export function buildStatus(account: Account, w: AccountStatusWire, ctx: { today: string; customer: Customer | null; tariffs?: Tariff[]; vat?: VatRates | null }): AccountStatus {
  const days = daysInclusive(w.period.from, w.period.to);
  const day = Math.min(days, Math.max(1, daysInclusive(w.period.from, ctx.today)));
  const kwh = num(w.kwh_so_far);
  const coef = coefficients(account.formula.ast);
  const rows: StatusRow[] = w.meters.map((m) => ({
    meter_id: m.meter_id,
    name: m.name,
    stale: !m.reporting,
    start: m.start_reading_kwh !== undefined ? num(m.start_reading_kwh) : null,
    end: m.end_reading_kwh !== undefined ? num(m.end_reading_kwh) : null,
    kwh: num(m.kwh),
    factor: factorLabel(coef[m.meter_id] ?? 1),
    part: r2(num(m.kwh) * (coef[m.meter_id] ?? 1)),
  }));
  const stale = w.meters.find((m) => !m.reporting);
  const nf = account.next_period;
  const t = ctx.tariffs?.find((x) => x.id === account.tariff.id);
  const cur = t?.current;
  const rate = ctx.vat?.current ? Number(ctx.vat.current.rate_percent) : null;
  const out: AccountStatus = {
    account,
    period: { from: w.period.from, to: w.period.to, day, days },
    kwh,
    forecast_kwh: r2((kwh / day) * days),
    avg_per_day: r2(kwh / day),
    rows,
    stale: stale ? { meter: stale.name, since: stale.last_report_at ? stale.last_report_at.slice(11, 16) : '' } : null,
    notes: w.notes,
    next: { from: nf.from, to: nf.to, number: billNumber(nf.to, account.customer.customer_number, ''), draft_on: addDays(nf.to, 1) },
    customer: ctx.customer,
  };
  if (w.amount_so_far !== undefined) out.amount_so_far = w.amount_so_far;
  if (cur && cur.price !== null && !cur.definition && rate !== null) {
    const v = Number(cur.price);
    out.price = { tariff: t!.name, ex_vat: (cur.price_mode === 'ex_vat' ? v : v / (1 + rate / 100)).toFixed(4), inc_vat: (cur.price_mode === 'inc_vat' ? v : v * (1 + rate / 100)).toFixed(4), vat: String(rate) };
  }
  return out;
}

/** Hebrew line of the bill log for a server event. */
export function eventText(e: BillEventWire): string {
  const d = e.details ?? {};
  const how = { email: 'בדוא״ל', hand: 'במסירה ידנית', other: 'באופן אחר' } as Record<string, string>;
  switch (e.action) {
    case 'draft':
      return e.actor?.kind === 'system' ? 'טיוטה נוצרה אוטומטית' : 'טיוטה נוצרה';
    case 'auto_draft':
      return 'טיוטה נוצרה אוטומטית';
    case 'recalculate':
      return 'חושב מחדש';
    case 'issue':
    case 'auto_issue':
      return d.replaces ? `הונפק, מחליף את ${String(d.replaces)}` : 'הונפק';
    case 'sent':
      return `סומן כנשלח ${how[String(d.how)] ?? ''}`.trim();
    case 'paid':
      return d.reference ? `סומן כשולם, אסמכתה ${String(d.reference)}` : 'סומן כשולם';
    case 'correct':
      return 'נוצרה טיוטה מתוקנת';
    case 'void':
      return d.reason ? `בוטל: ${String(d.reason)}` : 'בוטל';
    case 'pdf':
      return 'קובץ ה-PDF נוצר';
    case 'pdf_failed':
      return 'הפקת ה-PDF נכשלה';
    default:
      return e.action;
  }
}

/** A period's label: the month for a period of one calendar month, the dates otherwise. */
export function periodRowLabel(from: string, to: string): string {
  return from.slice(0, 7) === to.slice(0, 7) && from.endsWith('-01') && addDays(to, 1).endsWith('-01') ? monthShort(to) : fmtRange(from, to);
}

/** The account page's history model from the history answer (shared by the REST adapter and the mock): one row per ended period, a period with
 * no data stays a row with kWh null (never zero), the change against the period just before when both have data, the amount only from a bill. */
export function buildHistory(w: AccountHistoryWire): AccountHistory {
  const rows = w.periods.map((p, i): HistoryRow => {
    const kwh = p.kwh === null ? null : num(p.kwh);
    const before = i ? w.periods[i - 1].kwh : null;
    const prev = before === null ? null : num(before);
    const row: HistoryRow = { label: periodRowLabel(p.from, p.to), from: p.from, to: p.to, kwh, status: kwh === null ? 'missing' : p.status, source: p.source, change_pct: kwh !== null && prev ? ((kwh - prev) / prev) * 100 : null, bill: p.bill };
    if (p.bill && p.bill.total !== undefined && p.bill.total !== '') row.amount = p.bill.total;
    return row;
  });
  return { rows, comparison: w.comparison };
}

/** The registered meters for the wizard and the formula editor: read through the meters client (electricity-meters.ts), the last-period kWh added. */
export async function elecMeters(): Promise<ElecMeter[]> {
  const list = await listMeters();
  const last = await elec().lastPeriodKwh(list.map((m) => m.id)).catch(() => ({}) as Record<string, number>);
  return list.map((m) => ({ ...m, last_period_kwh: last[m.id] ?? null }));
}

const rest: ElecBackend = {
  lastPeriodKwh: async () => ({}),
  listAccounts: async () => {
    const r = await get<{ items: Account[] }>(`${E}accounts`);
    const rows = await Promise.all(
      r.items.map(async (account): Promise<AccountRow> => {
        try {
          const st = await get<AccountStatusWire>(`${E}accounts/${account.id}/status`);
          const row: AccountRow = { account, kwh: num(st.kwh_so_far), stale: st.meters.some((m) => !m.reporting) };
          if (st.amount_so_far !== undefined) row.amount = st.amount_so_far;
          return row;
        } catch {
          return { account, kwh: null, stale: false };
        }
      }),
    );
    return rows;
  },
  getAccount: (id) => get<Account>(`${E}accounts/${id}`),
  accountStatus: async (id) => {
    const [account, w] = await Promise.all([get<Account>(`${E}accounts/${id}`), get<AccountStatusWire>(`${E}accounts/${id}/status`)]);
    const money = w.amount_so_far !== undefined;
    const [customer, tariffs, vat] = await Promise.all([
      get<Customer>(`${E}customers/${account.customer.id}`).catch(() => null),
      money ? get<{ items: Tariff[] }>(`${E}tariffs`).then((x) => x.items).catch(() => undefined) : Promise.resolve(undefined),
      money ? get<VatRates>(`${E}vat-rates`).catch(() => null) : Promise.resolve(null),
    ]);
    return buildStatus(account, w, { today: new Date().toISOString().slice(0, 10), customer, tariffs, vat });
  },
  // kWh per ended period from the server: an issued bill of exactly that period, else the readings with the account formula, else null (no data)
  accountHistory: async (id, past) => buildHistory(await get<AccountHistoryWire>(`${E}accounts/${id}/history${qs({ past: Math.max(1, Math.min(24, Math.round(past))) })}`)),
  createAccount: async (body, afterSave) => {
    const account = await post<Account>(`${E}accounts`, body);
    let bill: BillSummary | null = null;
    let billError = '';
    if (afterSave === 'draft') {
      try {
        bill = await post<Bill>(`${E}accounts/${account.id}/bills`, { client_request_id: uid() });
      } catch (e) {
        billError = elecErrorText(e);
      }
    }
    return { account, bill, billError };
  },
  updateAccount: (id, revision, body) => patch<Account>(`${E}accounts/${id}`, { base_revision: revision, ...body }),
  checkFormula: async (ast) => {
    const w = await post<FormulaCheckWire>(`${E}formula/check`, { formula: { ast } });
    return {
      ok: w.ok && !(w.preview?.negative ?? false),
      errors: w.errors.map((e) => e.message),
      warnings: w.warnings.map((e) => e.message),
      period_from: w.preview?.period.from ?? '',
      period_to: w.preview?.period.to ?? '',
      rows: (w.preview?.meters ?? []).map((m) => ({ meter_id: m.meter_id, name: m.name, kwh: num(m.kwh) })),
      result_kwh: w.preview ? num(w.preview.result_kwh) : null,
      negative: w.preview?.negative ?? false,
    };
  },
  nextCustomerNumber: async () => (await get<{ customer_number: string }>(`${E}customers/next-number`)).customer_number,
  listCustomers: async (q) => (await get<{ items: Customer[] }>(`${E}customers${qs({ q, limit: 500 })}`)).items,
  getCustomer: (id) => get<Customer>(`${E}customers/${id}`),
  createCustomer: (body) => post<Customer>(`${E}customers`, body),
  updateCustomer: (id, revision, body) => patch<Customer>(`${E}customers/${id}`, { base_revision: revision, ...body }),
  deleteCustomer: (id, revision) => del(`${E}customers/${id}${qs({ base_revision: revision })}`),
  listTariffs: async () => (await get<{ items: Tariff[] }>(`${E}tariffs`)).items,
  createTariff: (b) =>
    post<Tariff>(`${E}tariffs`, b.definition
      ? { name: b.name, kind: 'tou', definition: b.definition, price_mode: b.price_mode, effective_from: b.effective_from }
      : { name: b.name, price: b.price, price_mode: b.price_mode, effective_from: b.effective_from }),
  addTariffVersion: async (id, b) => {
    await patch(`${E}tariffs/${id}`, { name: b.name });
    return post<Tariff>(`${E}tariffs/${id}/versions`, { effective_from: b.effective_from, ...valueOf(b), price_mode: b.price_mode });
  },
  correctTariffVersion: async (id, b, o) => {
    if (o.confirm) await patch(`${E}tariffs/${id}`, { name: b.name });
    const r = await post<{ applied?: boolean; plan?: TariffVersionPlan }>(`${E}tariffs/${id}/versions`, {
      effective_from: b.effective_from,
      ...valueOf(b),
      price_mode: b.price_mode,
      confirm: o.confirm,
      ...(o.replaceId ? { replace_version_id: o.replaceId } : {}),
      ...(o.base
        ? { base: o.base.definition ? { effective_from: o.base.effective_from, definition_sha256: o.base.definition_sha256, price_mode: o.base.price_mode } : { effective_from: o.base.effective_from, price: o.base.price, price_mode: o.base.price_mode } }
        : {}),
    });
    return { applied: r.applied !== false, plan: r.plan ?? null };
  },
  touTemplates: async () => (await get<{ items: TouTemplate[] }>(`${E}tou/templates`)).items,
  checkTou: (definition) => post<TouCheck>(`${E}tou/check`, { definition }),
  getCalendar: (year) => get<CalendarYear>(`${E}calendar${qs({ year })}`),
  setCalendarDay: (date, kind, name_he, revision) => put<CalendarYear>(`${E}calendar/days/${date}`, { kind, name_he, base_revision: revision }),
  removeCalendarDay: (date, revision) => api<CalendarYear>(`${E}calendar/days/${date}${qs({ base_revision: revision })}`, { method: 'DELETE' }),
  setCalendarGenerator: (generator, revision, year) => put<CalendarYear>(`${E}calendar/settings${qs({ year })}`, { generator, base_revision: revision }),
  getVat: () => get<VatRates>(`${E}vat-rates`),
  addVat: async (rate_percent, effective_from) => {
    await post(`${E}vat-rates`, { effective_from, rate_percent });
    return get<VatRates>(`${E}vat-rates`);
  },
  listBills: (q = {}) => get<BillList>(`${E}bills${qs({ ...q, limit: 500 })}`),
  getBill: (id) => get<Bill>(`${E}bills/${id}`),
  billEvents: async (id) => (await get<{ items: BillEventWire[] }>(`${E}bills/${id}/events`)).items.map((e) => ({ at: e.at, text: eventText(e) })),
  createBill: (accountId, period) => post<Bill>(`${E}accounts/${accountId}/bills`, { ...(period.kind === 'range' ? { period: { from: period.from, to: period.to } } : {}), client_request_id: uid() }),
  recalcBill: (b) => post<Bill>(`${E}bills/${b.id}/recalculate`, { row_version: b.row_version }),
  deleteDraft: (b) => del(`${E}bills/${b.id}${qs({ row_version: b.row_version })}`),
  issueBill: (b) => post<Bill>(`${E}bills/${b.id}/issue`, { row_version: b.row_version, client_request_id: uid() }),
  markSent: (id, body) => post<Bill>(`${E}bills/${id}/sent`, body),
  markPaid: (id, body) => post<Bill>(`${E}bills/${id}/paid`, body),
  correctBill: (id) => post<Bill>(`${E}bills/${id}/correct`, { client_request_id: uid() }),
  voidBill: (id, reason) => post<Bill>(`${E}bills/${id}/void`, { reason }),
  fetchPdf: async (id) => {
    const res = await fetch(apiUrl(`${E}bills/${id}/pdf`), { credentials: 'same-origin' });
    if (!res.ok) {
      let body: { code?: string; user_message?: string } = {};
      try {
        body = (await res.json()) as typeof body;
      } catch {
        body = {};
      }
      const code = body.code ?? `http_${res.status}`;
      throw new ApiError(res.status, { code, user_message: body.user_message ?? '', retryable: PDF_RETRYABLE.includes(code), correlation_id: '', details: {} });
    }
    return res.blob();
  },
  getSettings: () => get<BillingSettings>(`${E}billing-settings`),
  saveSettings: (revision, body) => put<BillingSettings>(`${E}billing-settings`, { base_revision: revision, ...body }),
  uploadLogo: async (file) => {
    await api(`${E}billing-settings/logo`, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  },
  removeLogo: () => del(`${E}billing-settings/logo`),
  logoUrl: (sha) => apiUrl(`${E}billing-settings/logo`) + (sha ? `?v=${sha.slice(0, 12)}` : ""),
};

/** Today's local date: the fixed demo date in demo mode (specs), the browser's date with a server. */
export function elecToday(): string {
  return isApi() ? new Date().toLocaleDateString('sv-SE') : MOCK_TODAY;
}

/** The backend in force: REST with a server, the mock store without one. */
export function elec(): ElecBackend {
  return isApi() ? rest : mockBackend;
}

export function elecErrorText(err: unknown): string {
  if (err instanceof ApiError) return err.body.user_message || ERROR_TEXT[err.body.code] || (err.status === 403 ? ERROR_TEXT.forbidden : `השרת דחה את הבקשה (${err.status})`);
  if (err instanceof TypeError) return 'אין חיבור לשרת.';
  return err instanceof Error ? err.message : String(err);
}
export const elecErrorCode = (err: unknown): string => (err instanceof ApiError ? err.body.code : '');
/** `details.fields` of a 422 validation error: field name -> message */
export function elecFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {};
  const f = err.body.details?.fields as unknown;
  if (f && typeof f === 'object' && !Array.isArray(f)) return f as Record<string, string>;
  return {};
}


