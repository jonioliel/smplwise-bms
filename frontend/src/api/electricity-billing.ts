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
import { can, isApi } from './session';
import { MOCK_TODAY, mockBackend } from './electricity-billing-mock';
import { coefficients, factorLabel, type FormulaAst } from '../electricity/elec-formula';
import { addDays, billNumber, daysInclusive, r2 } from '../electricity/elec-format';

export type { FormulaAst };
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
  logo_invalid: 'הלוגו חייב להיות PNG או JPEG עד 1MB.',
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

export interface TariffVersion {
  id: string;
  effective_from: string;
  price: string;
  price_mode: PriceMode;
}
export interface Tariff {
  id: string;
  name: string;
  currency: string;
  kind: string;
  versions: TariffVersion[];
  current: TariffVersion | null;
  used_by: number;
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
  tariff: { id: string; name: string; price?: string; price_mode?: PriceMode };
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
  account: { id: string; name: string; tariff: { id: string; name: string }; formula: { text: string; sentence_he: string } };
  meters: SnapshotMeter[];
  lines: SnapshotLine[];
  totals: { currency: string; kwh: string; amount_ex_vat: string; vat_amount: string; total: string; vat_breakdown: { rate_percent: string; base: string; vat: string }[]; price_mode_note_he: string | null };
  notes: { code: string; text_he: string }[];
  history: BillHistory;
  meta: { software_version: string; computed_at: string };
  /** the first 12 hex characters of snapshot_sha256 (the server sends the full hash on the Bill) */
}
export type BillAction = 'recalculate' | 'delete' | 'issue' | 'sent' | 'paid' | 'correct' | 'void' | 'pdf';
export interface Bill extends BillSummary {
  snapshot: BillSnapshot;
  snapshot_sha256: string | null;
  sent: { at: string; how: SentHow; note: string } | null;
  paid: { at: string; reference: string } | null;
  void: { at: string; reason: string } | null;
  actions: BillAction[];
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

/** The meter list of the wizard's step 1 (the meters screen owns the full model: src/api/electricity-meters.ts). */
export interface ElecMeter {
  id: string;
  name: string;
  area: string;
  floor: string;
  reading_kwh: number | null;
  status: 'ok' | 'stale' | 'paused';
  last_report: string | null;
  /** consumption of the last full period (the formula editor's chips) */
  last_period_kwh: number | null;
}
/** A sensor of the infrastructure that is NOT a valid meter, with the reason (CR-023 §5). */
export interface MeterCandidate {
  name: string;
  area: string;
  value: string;
  verdict: 'warn' | 'rejected';
  reason: string;
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
export interface HistoryRow {
  label: string;
  from: string;
  to: string;
  kwh: number;
  change_pct: number | null;
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

// ------------------------------------------------------------------------------------------------ permissions

export interface ElecPerms {
  /** energy.view */
  view: boolean;
  /** energy.bills: money, bills, customers */
  bills: boolean;
  /** energy.manage */
  manage: boolean;
}

/** Demo personas for the specs and design review (`localStorage['sw.demo.electricity']`, JSON). */
export interface DemoControl {
  persona?: 'full' | 'view' | 'bills_only';
  empty?: boolean;
  /** make one list fail: accounts | bills | customers | settings | meters */
  fail?: string;
  /** every issued bill's PDF fails until "create the PDF again" */
  pdf_failed?: boolean;
  /** the next bill creation fails with this code: formula_negative | tariff_missing | vat_missing | period_overlap */
  create_error?: string;
  /** artificial delay in ms (loading states) */
  latency?: number;
}
export function demoControl(): DemoControl {
  try {
    return JSON.parse(localStorage.getItem('sw.demo.electricity') || '{}') as DemoControl;
  } catch {
    return {};
  }
}

export function elecPerms(): ElecPerms {
  if (isApi()) return { view: can('energy.view'), bills: can('energy.bills'), manage: can('energy.manage') };
  const p = demoControl().persona ?? 'full';
  return { view: true, bills: p !== 'view', manage: p === 'full' };
}

// ------------------------------------------------------------------------------------------------ the backend contract

/** Everything the screens call. `rest` talks to the server (wire -> view models); `mockBackend` is the in-memory twin. */
export interface ElecBackend {
  listMeters(): Promise<ElecMeter[]>;
  listCandidates(): Promise<MeterCandidate[]>;
  listAccounts(): Promise<AccountRow[]>;
  getAccount(id: string): Promise<Account>;
  accountStatus(id: string): Promise<AccountStatus>;
  accountHistory(id: string, months: 12 | 24): Promise<AccountHistory>;
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
  createTariff(body: { name: string; price: string; price_mode: PriceMode; effective_from: string }): Promise<Tariff>;
  addTariffVersion(id: string, body: { name: string; price: string; price_mode: PriceMode; effective_from: string }): Promise<Tariff>;
  getVat(): Promise<VatRates>;
  addVat(rate_percent: string, effective_from: string): Promise<VatRates>;
  listBills(q?: BillsQuery): Promise<BillList>;
  getBill(id: string): Promise<Bill>;
  billEvents(id: string): Promise<BillEvent[]>;
  createBill(accountId: string, period: PeriodChoice): Promise<Bill>;
  recalcBill(b: BillSummary): Promise<Bill>;
  deleteDraft(b: BillSummary): Promise<void>;
  issueBill(b: BillSummary): Promise<Bill>;
  markSent(id: string, body: { at: string; how: SentHow; note: string }): Promise<Bill>;
  markPaid(id: string, body: { at: string; reference: string }): Promise<Bill>;
  correctBill(id: string): Promise<Bill>;
  voidBill(id: string, reason: string): Promise<Bill>;
  /** fetches the PDF; rejects with pdf_render_failed (503) when the renderer failed */
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
  if (cur && rate !== null) {
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
    default:
      return e.action;
  }
}

/** tolerant mapping of the meters endpoint (owned by the meters screen; reconcile with src/api/electricity-meters.ts) */
function toMeter(x: Record<string, unknown>): ElecMeter {
  const st = String(x.status ?? 'ok');
  return {
    id: String(x.id ?? x.meter_id ?? ''),
    name: String(x.display_name ?? x.name ?? ''),
    area: String(x.area_name ?? x.area ?? ''),
    floor: String(x.floor_name ?? x.floor ?? ''),
    reading_kwh: x.reading_kwh !== undefined && x.reading_kwh !== null ? Number(x.reading_kwh) : x.reading_wh !== undefined && x.reading_wh !== null ? Number(x.reading_wh) / 1000 : null,
    status: st === 'paused' ? 'paused' : st === 'stale' || x.reporting === false ? 'stale' : 'ok',
    last_report: typeof x.last_report_at === 'string' ? x.last_report_at.slice(11, 16) : null,
    last_period_kwh: x.last_period_kwh !== undefined && x.last_period_kwh !== null ? Number(x.last_period_kwh) : null,
  };
}

const rest: ElecBackend = {
  listMeters: async () => {
    const r = await get<{ items?: Record<string, unknown>[]; meters?: Record<string, unknown>[] }>(`${E}meters`);
    return (r.items ?? r.meters ?? []).map(toMeter);
  },
  listCandidates: async () => {
    try {
      const r = await get<{ items?: Record<string, unknown>[]; candidates?: Record<string, unknown>[] }>(`${E}meters/candidates`);
      return (r.items ?? r.candidates ?? [])
        .filter((c) => c.verdict === 'warn' || c.verdict === 'rejected' || c.verdict === 'warning')
        .map((c) => ({ name: String(c.name ?? ''), area: String(c.area_name ?? c.area ?? ''), value: String(c.state ?? c.value ?? ''), verdict: c.verdict === 'rejected' ? 'rejected' : 'warn', reason: String(c.reason ?? c.message ?? '') }) as MeterCandidate);
    } catch {
      return [];
    }
  },
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
  accountHistory: async (id, months) => {
    // kWh per period comes from the bills of the account (the periods endpoint); periods without a bill carry no number: nothing is invented
    const r = await get<{ periods: PeriodRow[] }>(`${E}accounts/${id}/periods${qs({ past: months, future: 0 })}`);
    const billed = r.periods.filter((p) => p.bill && p.bill.state !== 'void');
    const rows: HistoryRow[] = billed.map((p, i) => {
      const kwh = num(p.bill!.kwh);
      const prev = i ? num(billed[i - 1].bill!.kwh) : 0;
      const row: HistoryRow = { label: p.to, from: p.from, to: p.to, kwh, change_pct: i && prev ? ((kwh - prev) / prev) * 100 : null, bill: p.bill };
      if (p.bill!.total !== undefined) row.amount = p.bill!.total;
      return row;
    });
    const last = billed[billed.length - 1];
    return { rows, comparison: { current: last ? { from: last.from, to: last.to, kwh: last.bill!.kwh } : null, previous: billed.slice(0, -1).slice(-12).map((p) => ({ from: p.from, to: p.to, kwh: p.bill!.kwh, status: 'measured' as const, source: 'bill' as const })), same_period_last_year: null } };
  },
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
  createTariff: (b) => post<Tariff>(`${E}tariffs`, b),
  addTariffVersion: async (id, b) => {
    await patch(`${E}tariffs/${id}`, { name: b.name });
    return post<Tariff>(`${E}tariffs/${id}/versions`, { effective_from: b.effective_from, price: b.price, price_mode: b.price_mode });
  },
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
      throw new ApiError(res.status, { code: body.code ?? `http_${res.status}`, user_message: body.user_message ?? '', retryable: res.status === 503, correlation_id: '', details: {} });
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


