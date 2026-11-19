/**
 * The customer form of the customer card, shared by the electricity customers page (electricity/elec-customers.ts) and the water
 * customers page (screens/water/page-customers.ts). Both edit the same customer record (CR-WATER78 section 16: "the SHARED customer
 * card"), so the fields, the empty form, the form of a loaded customer, the checks, the body sent on save, the list search and the
 * field renderer live here once.
 *
 * CR-I18N-ELECTRICITY-2443 (code review 08:F25) wrote the text-free helpers (in electricity/customer-form.ts);
 * CR-WATER-CUSTOMER-FORM-2440 moved the water page onto a shared module with the field renderer. RELEASE-2440-TRAIN joined the
 * two into this one file. No words here: each page words its own errors (`customerFormProblems` returns the failing fields) and
 * labels, and keeps its own permissions, API calls and error mapping.
 */
import { html, nothing, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

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
type CustomerFormKey = keyof CustomerForm;

/** What a customer record from either API carries for the form (the contact fields come only with the bills permission). */
interface CustomerFields {
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
export const customerFormOf = (c: CustomerFields): CustomerForm => ({
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
export function customerMatches(c: Pick<CustomerFields, 'name' | 'customer_number'>, query: string, more: readonly (string | undefined)[] = []): boolean {
  const q = query.trim();
  return !q || c.name.includes(q) || c.customer_number.includes(q) || more.some((t) => (t ?? '').includes(q));
}

interface CustomerFieldOptions {
  /** the id prefix of the control (the label's `for`), unique per page */
  idPrefix: string;
  label: unknown;
  value: string;
  error?: string;
  readonly: boolean;
  wide?: boolean;
  ltr?: boolean;
  area?: boolean;
  /** undefined = no placeholder attribute */
  placeholder?: string;
  onInput: (value: string) => void;
}

/** one labelled field of the form: an input (or a textarea for notes) and its error line */
export function customerField(k: CustomerFormKey, o: CustomerFieldOptions): TemplateResult {
  const id = `${o.idPrefix}${k}`;
  const err = o.error;
  return html`<div class="fld ${o.wide ? 'wide' : ''}"><label for=${id}>${o.label}</label>
      ${o.area
        ? html`<textarea id=${id} name=${k} ?readonly=${o.readonly} placeholder=${ifDefined(o.placeholder)} .value=${o.value} @input=${(e: Event) => o.onInput((e.target as HTMLTextAreaElement).value)}></textarea>`
        : html`<input id=${id} name=${k} class="${o.ltr ? 'ltr' : ''} ${err ? 'err' : ''}" aria-invalid=${err ? 'true' : 'false'} ?readonly=${o.readonly} placeholder=${ifDefined(o.placeholder)} .value=${o.value} @input=${(e: Event) => o.onInput((e.target as HTMLInputElement).value)} />`}
      ${err ? html`<div class="msg" role="alert" data-field-error=${k}>${err}</div>` : nothing}</div>`;
}
