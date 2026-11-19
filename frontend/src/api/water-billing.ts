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
import { del, get, patch, path, post, put } from './client';
import { isApi } from './session';
import type * as Wire from './generated/wire-consumption';

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/water_billing.py and energy_billing.py for the
 * shared parts), generated into ./generated/wire-consumption.ts: a change of the contract is a compile error here and in the screens (code
 * review 07:F8 step 2). Kept by hand: the formula AST (a recursive document the editor owns) and the bill snapshot (the sealed bill
 * document, versioned by its own `schema`; the server passes it through as stored). */
export type BillState = Wire.WaterBillSummary['state'];
export type PriceMode = Wire.WaterTariffVersion['price_mode'];
export type AutoMode = Wire.WaterAccount['auto_mode'];
export type FormulaAst = { m: string } | { op: '+' | '-'; args: FormulaAst[] } | { op: '*'; args: [FormulaAst, { n: string }] } | Record<string, unknown>;

export type Period = Wire.EnergyPeriod;
/** The shared customer card: contact fields and the open water balance with water.bills only; `accounts` / `bills` on the detail. */
export type Customer = Wire.WaterCustomer;
export type TariffVersion = Wire.WaterTariffVersion;
export type Tariff = Wire.WaterTariff;
type AccountFormula = Omit<Wire.EnergyFormula, 'ast'> & { ast: FormulaAst };
export type Account = Omit<Wire.WaterAccount, 'formula'> & { formula: AccountFormula };
export type AccountStatus = Wire.WaterAccountStatus;
export type HistoryPeriod = Wire.WaterHistoryPeriod;
export type BillSummary = Wire.WaterBillSummary;

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

/** The sealed water bill document (the fields the bill page reads). */
interface WaterBillSnapshot {
  schema: string;
  business: { name: string; registration_no: string; address: string; phone: string; email: string };
  customer: { customer_number: string; name: string; address: string; phone: string; email: string };
  account: { name: string; tariff: { name: string }; formula: { sentence_he: string } };
  lines: BillLine[];
  totals: { m3: string; amount_ex_vat: string; vat_amount: string; total: string; by_component_ex_vat: { water: string; sewage: string } };
  notes: { code: string; text_he: string }[];
  bill: { replaces: { number: string | null } | null; expected_due_date: string };
}

export type Bill =Omit<Wire.WaterBill, 'snapshot'> & { snapshot: WaterBillSnapshot };
export type BillEvent = Wire.WaterBillEvent;
export type SharedSettings = Wire.WaterSharedSettings;
export type SnoozeSettings = Wire.WaterSnooze;

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
  listCustomers: (q?: string) => (isApi() ? get<Wire.WaterCustomerList>(`${W}customers${qs({ q })}`) : Promise.resolve({ items: [] as Customer[], total: 0 })),
  customer: (id: string) => get<Customer>(`${W}customers/${id}`),
  nextCustomerNumber: () => get<Wire.EnergyNextNumber>(`${W}customers/next-number`),
  createCustomer: (body: Partial<Customer> & { name: string }) => post<Customer>(`${W}customers`, body),
  updateCustomer: (id: string, body: Partial<Customer> & { base_revision: number }) => patch<Customer>(`${W}customers/${id}`, body),
  deleteCustomer: (id: string, revision: number) => del(`${W}customers/${id}${qs({ base_revision: revision })}`),
  // tariffs
  listTariffs: () => (isApi() ? get<Wire.WaterTariffList>(`${W}tariffs`) : Promise.resolve({ items: [] as Tariff[] })),
  createTariff: (body: { name: string; water_price: string; sewage_price: string; effective_from: string; price_mode?: PriceMode }) => post<Tariff>(`${W}tariffs`, body),
  renameTariff: (id: string, name: string) => patch<Tariff>(`${W}tariffs/${id}`, { name }),
  deleteTariff: (id: string) => del(`${W}tariffs/${id}`),
  addVersion: (id: string, body: { effective_from: string; water_price: string; sewage_price: string; price_mode?: PriceMode }) => post<Tariff>(`${W}tariffs/${id}/versions`, body),
  correctVersion: (id: string, vid: string, body: { effective_from: string; water_price: string; sewage_price: string; price_mode?: PriceMode }) =>
    patch<Tariff>(`${W}tariffs/${id}/versions/${vid}`, body),
  deleteVersion: (id: string, vid: string) => del(`${W}tariffs/${id}/versions/${vid}`),
  // accounts
  listAccounts: (q?: string) =>
    isApi() ? get<{ items: Account[]; summary: Wire.WaterAccountsSummary }>(`${W}accounts${qs({ q })}`) : Promise.resolve({ items: [] as Account[], summary: { active: 0, drafts: 0 } }),
  account: (id: string) => get<Account>(`${W}accounts/${id}`),
  accountStatus: (id: string) => get<AccountStatus>(`${W}accounts/${id}/status`),
  accountHistory: (id: string, past = 12) => get<Wire.WaterAccountHistory>(`${W}accounts/${id}/history${qs({ past })}`),
  accountBills: (id: string) => get<Wire.WaterBillList>(`${W}accounts/${id}/bills`),
  createAccount: (body: Record<string, unknown>) => post<Account>(`${W}accounts`, body),
  updateAccount: (id: string, body: Record<string, unknown> & { base_revision: number }) => patch<Account>(`${W}accounts/${id}`, body),
  deleteAccount: (id: string, revision: number) => del(`${W}accounts/${id}${qs({ base_revision: revision })}`),
  preset: (preset: 'sum' | 'main_minus_subs' | 'share', meterIds: string[], mainMeterId?: string, percent?: string) =>
    post<Omit<Wire.EnergyFormulaPreset, 'ast'> & { ast: FormulaAst }>(`${W}formula/preset`, { preset, meter_ids: meterIds, main_meter_id: mainMeterId, percent }),
  // bills
  listBills: (o: { state?: BillState; q?: string; account_id?: string; customer_id?: string } = {}) =>
    isApi()
      ? get<Wire.WaterBillsPage>(`${W}bills${qs(o)}`)
      : Promise.resolve({ items: [] as BillSummary[], total: 0, counts: { draft: 0, issued: 0, sent: 0, paid: 0, void: 0 }, sums: { open: '0.00', paid: '0.00' } }),
  bill: (id: string) => get<Bill>(`${W}bills/${id}`),
  billEvents: (id: string) => get<Wire.WaterBillEvents>(`${W}bills/${id}/events`),
  createBill: (accountId: string, period?: Period) => post<Bill>(`${W}accounts/${accountId}/bills`, { period, client_request_id: requestId() }),
  recalculate: (b: Bill) => post<Bill>(`${W}bills/${b.id}/recalculate`, { row_version: b.row_version }),
  deleteDraft: (b: Bill) => del(`${W}bills/${b.id}${qs({ row_version: b.row_version })}`),
  issue: (b: Bill, clientRequestId = requestId()) => post<Bill>(`${W}bills/${b.id}/issue`, { row_version: b.row_version, client_request_id: clientRequestId }),
  markSent: (b: Bill, how: 'email' | 'hand' | 'other', note = '') => post<Bill>(`${W}bills/${b.id}/sent`, { how, note, row_version: b.row_version }),
  markPaid: (b: Bill, reference = '') => post<Bill>(`${W}bills/${b.id}/paid`, { reference, row_version: b.row_version }),
  void: (b: Bill, reason: string) => post<Bill>(`${W}bills/${b.id}/void`, { reason, row_version: b.row_version }),
  correct: (b: Bill) => post<Bill>(`${W}bills/${b.id}/correct`, { client_request_id: requestId() }),
  // the alert snooze (section 16)
  snooze: (eventId: string, minutes?: number) => post<Wire.WaterEvent>(path`infra/water/events/${eventId}/snooze`, minutes === undefined ? {} : { minutes }),
  unsnooze: (eventId: string) => del(path`infra/water/events/${eventId}/snooze`),
  saveSnooze: (snooze: SnoozeSettings, rowVersion?: number) => put<Wire.WaterAlerts>(`infra/water/alerts`, { snooze, row_version: rowVersion }),
};
