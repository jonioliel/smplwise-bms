/**
 * CR-WATER-CUSTOMER-FORM-2440 (code review 2026-11-13, frontend features F25): the customer form shared by the electricity customers page
 * (electricity/elec-customers.ts) and the water customers page (screens/water/page-customers.ts). One customer record serves both modules,
 * so both cards edit the same seven fields with the same checks; each page keeps its own words, permissions, API calls and error mapping.
 * Pure helpers plus one field renderer - no element, no state.
 */
import { html, nothing, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';

export const CUSTOMER_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CUSTOMER_NUMBER = /^\d{1,9}$/;

export interface CustomerForm {
  name: string;
  customer_number: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
}
export type CustomerFormKey = keyof CustomerForm;

/** the fields of a stored customer that the form edits (the electricity and the water Customer both carry them) */
export interface CustomerFields {
  name: string;
  customer_number: string;
  tax_id?: string;
  address?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export const blankCustomerForm = (no = ''): CustomerForm => ({ name: '', customer_number: no, tax_id: '', address: '', phone: '', email: '', notes: '' });

export const customerFormOf = (c: CustomerFields): CustomerForm => ({
  name: c.name,
  customer_number: c.customer_number,
  tax_id: c.tax_id ?? '',
  address: c.address ?? '',
  phone: c.phone ?? '',
  email: c.email ?? '',
  notes: c.notes ?? '',
});

export interface CustomerFormMessages {
  name: string;
  email: string;
  customerNumber: string;
}

/**
 * The client checks, as field -> message (empty = valid): a name, a well-formed e-mail when one is given, a customer number of digits only.
 * `numberOptional`: an empty customer number is allowed (the server assigns the next one - the water page).
 */
export function validateCustomerForm(f: CustomerForm, msg: CustomerFormMessages, o: { numberOptional?: boolean } = {}): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = msg.name;
  if (f.email && !CUSTOMER_EMAIL.test(f.email)) e.email = msg.email;
  if ((!o.numberOptional || f.customer_number) && !CUSTOMER_NUMBER.test(f.customer_number)) e.customer_number = msg.customerNumber;
  return e;
}

/** the body of an update: every field, the customer number only when it changed */
export function customerUpdateBody(f: CustomerForm, current: { customer_number: string }): Partial<CustomerForm> {
  const body: Partial<CustomerForm> = { ...f };
  if (f.customer_number === current.customer_number) delete body.customer_number;
  return body;
}

export interface CustomerFieldOptions {
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
