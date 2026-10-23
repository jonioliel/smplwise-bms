/**
 * CR-WATER78 slice 3 (section 16, mockup v4 approved 24.10): the ONE module that talks to the water billing API (`/api/v1/infra/water/...`):
 * the shared customer card, water + sewage tariffs, accounts (signed meter formula, the losses account), bills and tenant chargeback, the
 * read of the SHARED billing settings, and the alert snooze. Wire contract: smplwise_vms/backend/smplwise/routers/water_billing.py.
 *
 * Money, m3 and prices are decimal strings; dates are local `YYYY-MM-DD`. The server drops every money key (and the customers' contact
 * fields) for a caller without `water.bills` - the keys are absent, not null; the screens never draw money without that permission.
 * VAT, the business details, payment terms, numbering and retention are the electricity billing settings: read here (`sharedSettings`),
 * edited only in the electricity settings.
 */
import { del, get, patch, post, put } from './client';
import { isApi } from './session';

export type BillState = 'draft' | 'issued' | 'sent' | 'paid' | 'void';
export type PriceMode = 'ex_vat' | 'inc_vat';
export type AutoMode = 'off' | 'draft' | 'issue';
export type FormulaAst = { m: string } | { op: '+' | '-'; args: FormulaAst[] } | { op: '*'; args: [FormulaAst, { n: string }] } | Record<string, unknown>;

export interface Period {
  from: string;
  to: string;
}

export interface Customer {
  id: string;
  customer_number: string;
  name: string;
  revision: number;
  account_count: number;
  energy_account_count: number;
  address?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  notes?: string;
  open_balance?: string;
  accounts?: { id: string; name: string; status: 'active' | 'paused' }[];
  bills?: BillSummary[];
}

export interface TariffVersion {
  id: string;
  effective_from: string;
  water_price: string;
  sewage_price: string;
  price_mode: PriceMode;
  price_inc_vat: string | null;
  locked: boolean;
}

export interface Tariff {
  id: string;
  name: string;
  currency: string;
  versions: TariffVersion[];
  current: TariffVersion | null;
  used_by: number;
  vat_rate_percent: string | null;
}

export interface AccountFormula {
  ast: FormulaAst;
  text: string;
  sentence_he: string;
  meter_ids: string[];
}

export interface Account {
  id: string;
  name: string;
  customer: { id: string; customer_number: string; name: string; address: string } | null;
  formula: AccountFormula;
  tariff: { id: string; name: string; water_price?: string | null; sewage_price?: string | null; price_mode?: PriceMode | null; vat_rate_percent?: string | null; price_inc_vat?: string | null };
  period_months: 1 | 2;
  period_anchor_day: number;
  period_anchor_month: number;
  first_period_start: string;
  timezone: string;
  auto_mode: AutoMode;
  status: 'active' | 'paused';
  revision: number;
  next_period: Period | null;
  last_bill: BillSummary | null;
  stale_meters: { meter_id: string; name: string }[];
}

export interface AccountStatus {
  period: Period | null;
  day_of_period: number | null;
  days: number | null;
  m3_so_far: string | null;
  m3_forecast?: string;
  amount_so_far?: string;
  meters: { meter_id: string; name: string; coefficient: string; start_m3: string | null; current_m3: string | null; consumption_m3: string; contribution_m3: string; reporting: boolean; last_report_at: string | null }[];
  stale: { meter_id: string; name: string; since: string | null }[];
}

export interface HistoryPeriod extends Period {
  m3: string | null;
  status: 'measured' | 'partial' | 'missing' | 'open';
  source: 'bill' | 'readings' | null;
  bill: BillSummary | null;
}

export interface BillSummary {
  id: string;
  account_id: string;
  account_name: string;
  customer: { id: string; customer_number: string | null; name: string | null };
  number: string | null;
  revision: number;
  state: BillState;
  origin: 'manual' | 'auto';
  period: Period;
  issue_date: string | null;
  due_date: string | null;
  m3: string | null;
  total?: string;
  replaces_bill_id: string | null;
  replaced_by_bill_id: string | null;
  row_version: number;
}

export interface BillLine {
  component: 'water' | 'sewage';
  label_he: string;
  from: string;
  to: string;
  m3: string;
  price_entered: string;
  price_mode: PriceMode;
  unit_price_ex_vat: string;
  amount_ex_vat: string;
  vat_rate_percent: string;
  vat_amount: string;
  total: string;
}

export interface Bill extends BillSummary {
  snapshot: {
    schema: string;
    business: { name: string; registration_no: string; address: string; phone: string; email: string };
    customer: { customer_number: string; name: string; address: string; phone: string; email: string };
    account: { name: string; tariff: { name: string }; formula: { sentence_he: string } };
    lines: BillLine[];
    totals: { m3: string; amount_ex_vat: string; vat_amount: string; total: string; by_component_ex_vat: { water: string; sewage: string } };
    notes: { code: string; text_he: string }[];
    bill: { replaces: { number: string | null } | null; expected_due_date: string };
  };
  sent: { at: string; how: string; note: string } | null;
  paid: { at: string; reference: string } | null;
  void: { at: string; reason: string } | null;
  actions: ('recalculate' | 'delete' | 'issue' | 'sent' | 'paid' | 'correct' | 'void')[];
}

export interface BillEvent {
  at: string;
  action: string;
  actor: { kind: 'user' | 'system'; display_name: string | null };
  details: Record<string, unknown> | null;
}

export interface SharedSettings {
  vat: { current: { effective_from: string; rate_percent: string } | null; items: { effective_from: string; rate_percent: string }[] };
  payment_terms: { mode: 'net_days' | 'day_of_month'; days: number; day_of_month: number };
  numbering: { customer_digits: number; format: string };
  default_price_mode: PriceMode;
  business: { name: string; registration_no: string };
  retention: { draft_days: number; bill_years: number };
  edit_link: string;
  can_edit: boolean;
}

export interface SnoozeSettings {
  durations: number[];
  default: number;
  max: number;
}

const W = 'infra/water/';
const qs = (o: Record<string, string | number | undefined>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** A client request id for the idempotent create / issue / correct calls (a double click returns the same bill). */
export const requestId = (): string => `wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const waterBilling = {
  sharedSettings: () => get<SharedSettings>(`${W}billing/shared`),
  // customers (the shared card)
  // without a backend the lists answer empty (the pages show their empty states, never invented data)
  listCustomers: (q?: string) => (isApi() ? get<{ items: Customer[]; total: number }>(`${W}customers${qs({ q })}`) : Promise.resolve({ items: [] as Customer[], total: 0 })),
  customer: (id: string) => get<Customer>(`${W}customers/${id}`),
  nextCustomerNumber: () => get<{ customer_number: string }>(`${W}customers/next-number`),
  createCustomer: (body: Partial<Customer> & { name: string }) => post<Customer>(`${W}customers`, body),
  updateCustomer: (id: string, body: Partial<Customer> & { base_revision: number }) => patch<Customer>(`${W}customers/${id}`, body),
  deleteCustomer: (id: string, revision: number) => del(`${W}customers/${id}${qs({ base_revision: revision })}`),
  // tariffs
  listTariffs: () => (isApi() ? get<{ items: Tariff[] }>(`${W}tariffs`) : Promise.resolve({ items: [] as Tariff[] })),
  createTariff: (body: { name: string; water_price: string; sewage_price: string; effective_from: string; price_mode?: PriceMode }) => post<Tariff>(`${W}tariffs`, body),
  renameTariff: (id: string, name: string) => patch<Tariff>(`${W}tariffs/${id}`, { name }),
  deleteTariff: (id: string) => del(`${W}tariffs/${id}`),
  addVersion: (id: string, body: { effective_from: string; water_price: string; sewage_price: string; price_mode?: PriceMode }) => post<Tariff>(`${W}tariffs/${id}/versions`, body),
  correctVersion: (id: string, vid: string, body: { effective_from: string; water_price: string; sewage_price: string; price_mode?: PriceMode }) =>
    patch<Tariff>(`${W}tariffs/${id}/versions/${vid}`, body),
  deleteVersion: (id: string, vid: string) => del(`${W}tariffs/${id}/versions/${vid}`),
  // accounts
  listAccounts: (q?: string) =>
    isApi() ? get<{ items: Account[]; summary: { active: number; drafts: number | null } }>(`${W}accounts${qs({ q })}`) : Promise.resolve({ items: [] as Account[], summary: { active: 0, drafts: 0 } }),
  account: (id: string) => get<Account>(`${W}accounts/${id}`),
  accountStatus: (id: string) => get<AccountStatus>(`${W}accounts/${id}/status`),
  accountHistory: (id: string, past = 12) => get<{ periods: HistoryPeriod[] }>(`${W}accounts/${id}/history${qs({ past })}`),
  accountBills: (id: string) => get<{ items: BillSummary[] }>(`${W}accounts/${id}/bills`),
  createAccount: (body: Record<string, unknown>) => post<Account>(`${W}accounts`, body),
  updateAccount: (id: string, body: Record<string, unknown> & { base_revision: number }) => patch<Account>(`${W}accounts/${id}`, body),
  deleteAccount: (id: string, revision: number) => del(`${W}accounts/${id}${qs({ base_revision: revision })}`),
  preset: (preset: 'sum' | 'main_minus_subs' | 'share', meterIds: string[], mainMeterId?: string, percent?: string) =>
    post<{ ast: FormulaAst; text: string; sentence_he: string }>(`${W}formula/preset`, { preset, meter_ids: meterIds, main_meter_id: mainMeterId, percent }),
  // bills
  listBills: (o: { state?: BillState; q?: string; account_id?: string; customer_id?: string } = {}) =>
    isApi()
      ? get<{ items: BillSummary[]; total: number; counts: Record<BillState, number>; sums: { open: string; paid: string } }>(`${W}bills${qs(o)}`)
      : Promise.resolve({ items: [] as BillSummary[], total: 0, counts: { draft: 0, issued: 0, sent: 0, paid: 0, void: 0 }, sums: { open: '0.00', paid: '0.00' } }),
  bill: (id: string) => get<Bill>(`${W}bills/${id}`),
  billEvents: (id: string) => get<{ items: BillEvent[] }>(`${W}bills/${id}/events`),
  createBill: (accountId: string, period?: Period) => post<Bill>(`${W}accounts/${accountId}/bills`, { period, client_request_id: requestId() }),
  recalculate: (b: Bill) => post<Bill>(`${W}bills/${b.id}/recalculate`, { row_version: b.row_version }),
  deleteDraft: (b: Bill) => del(`${W}bills/${b.id}${qs({ row_version: b.row_version })}`),
  issue: (b: Bill, clientRequestId = requestId()) => post<Bill>(`${W}bills/${b.id}/issue`, { row_version: b.row_version, client_request_id: clientRequestId }),
  markSent: (b: Bill, how: 'email' | 'hand' | 'other', note = '') => post<Bill>(`${W}bills/${b.id}/sent`, { how, note, row_version: b.row_version }),
  markPaid: (b: Bill, reference = '') => post<Bill>(`${W}bills/${b.id}/paid`, { reference, row_version: b.row_version }),
  void: (b: Bill, reason: string) => post<Bill>(`${W}bills/${b.id}/void`, { reason, row_version: b.row_version }),
  correct: (b: Bill) => post<Bill>(`${W}bills/${b.id}/correct`, { client_request_id: requestId() }),
  // the alert snooze (section 16)
  snooze: (eventId: string, minutes?: number) => post<{ id: string; snoozed_until: string | null }>(`infra/water/events/${eventId}/snooze`, minutes === undefined ? {} : { minutes }),
  unsnooze: (eventId: string) => del(`infra/water/events/${eventId}/snooze`),
  saveSnooze: (snooze: SnoozeSettings, rowVersion?: number) => put<{ snooze: SnoozeSettings; row_version: number }>(`infra/water/alerts`, { snooze, row_version: rowVersion }),
};
