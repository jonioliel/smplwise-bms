/**
 * CR-I18N-ELECTRICITY-2443 (code review 08:F25): the customer form of the customer card. The electricity customers
 * (elec-customers.ts) and the water customers (screens/water/page-customers.ts) edit the same customer record (CR-WATER78
 * section 16: "the SHARED customer card"), and both pages carried a copy of the same pieces: the fields, the empty form, the
 * form of a loaded customer, the checks, the body sent on save and the list search. They live here once.
 *
 * No text and no UI here: each page words its own errors (`customerFormProblems` returns the failing fields) and draws its
 * own fields. The water page still has its copy; it adopts this module in its own branch (the file is held by A11Y-ROWS).
 */

/** A plausible e-mail address: something@something.something, no spaces. */
export const CUSTOMER_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** A customer number: 1 to 9 digits. */
const CUSTOMER_NUMBER = /^\d{1,9}$/;

/** The customer card's fields, as the inputs hold them (an absent value is ''). */
export interface CustomerForm {
  name: string;
  customer_number: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
}

/** What a customer record from either API carries for the form (the contact fields come only with the bills permission). */
interface CustomerRecord {
  name: string;
  customer_number: string;
  tax_id?: string;
  address?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

/** An empty form; `no` is the suggested next customer number. */
export const blankCustomerForm = (no = ''): CustomerForm => ({ name: '', customer_number: no, tax_id: '', address: '', phone: '', email: '', notes: '' });

/** The form of a loaded customer. */
export const customerFormOf = (c: CustomerRecord): CustomerForm => ({
  name: c.name,
  customer_number: c.customer_number,
  tax_id: c.tax_id ?? '',
  address: c.address ?? '',
  phone: c.phone ?? '',
  email: c.email ?? '',
  notes: c.notes ?? '',
});

/** A field the checks can refuse. */
type CustomerFormProblem = 'name' | 'email' | 'customer_number';

/**
 * The fields that fail, in form order: an empty name (spaces only counts as empty), an e-mail that is written and malformed,
 * a customer number that is not 1-9 digits. An empty customer number fails only with `numberRequired` (electricity always
 * sends one; water lets the server pick it).
 */
export function customerFormProblems(f: CustomerForm, o: { numberRequired: boolean }): CustomerFormProblem[] {
  const out: CustomerFormProblem[] = [];
  if (!f.name.trim()) out.push('name');
  if (f.email && !CUSTOMER_EMAIL.test(f.email)) out.push('email');
  if ((o.numberRequired || f.customer_number) && !CUSTOMER_NUMBER.test(f.customer_number)) out.push('customer_number');
  return out;
}

/**
 * The body to save: the form with the name trimmed. When editing (`current` given), a customer number that did not change is
 * left out, so the server does not check it again.
 */
export function customerSaveBody(f: CustomerForm): CustomerForm;
export function customerSaveBody(f: CustomerForm, current: { customer_number: string }): Partial<CustomerForm>;
export function customerSaveBody(f: CustomerForm, current?: { customer_number: string }): Partial<CustomerForm> {
  const body: Partial<CustomerForm> = { ...f, name: f.name.trim() };
  if (current && body.customer_number === current.customer_number) delete body.customer_number;
  return body;
}

/**
 * The list search: the query (trimmed; empty matches all) is part of the name or of the customer number, or of one of the
 * page's `more` texts (water also searches the address).
 */
export function customerMatches(c: Pick<CustomerRecord, 'name' | 'customer_number'>, query: string, more: readonly (string | undefined)[] = []): boolean {
  const q = query.trim();
  return !q || c.name.includes(q) || c.customer_number.includes(q) || more.some((t) => (t ?? '').includes(q));
}
