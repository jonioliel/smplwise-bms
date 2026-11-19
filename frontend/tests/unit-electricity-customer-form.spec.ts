import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { CUSTOMER_EMAIL, blankCustomerForm, customerFormOf, customerFormProblems, customerMatches, customerSaveBody, type CustomerForm } from '../src/components/customer-form';

// CR-I18N-ELECTRICITY-2443 (code review 08:F25): the customer form shared by the electricity and water customer cards. The
// rules are the ones elec-customers.ts held in its own copy (the electricity case, `numberRequired`) and the ones
// screens/water/page-customers.ts holds in its copy (an empty number is allowed). No DOM: the module is plain logic.

const filled = (o: Partial<CustomerForm> = {}): CustomerForm => ({ ...blankCustomerForm('0007'), name: 'דנה כהן', ...o });

test('the empty form, and the form of a loaded customer (absent contact fields become empty)', () => {
  expect(blankCustomerForm()).toEqual({ name: '', customer_number: '', tax_id: '', address: '', phone: '', email: '', notes: '' });
  expect(blankCustomerForm('0012').customer_number).toBe('0012');
  expect(customerFormOf({ name: 'א', customer_number: '12' })).toEqual({ name: 'א', customer_number: '12', tax_id: '', address: '', phone: '', email: '', notes: '' });
  const full = { name: 'א', customer_number: '12', tax_id: '5', address: 'ב', phone: '050', email: 'a@b.co', notes: 'ג' };
  expect(customerFormOf({ ...full, id: 'c1', revision: 3 } as typeof full)).toEqual(full);
});

test('checks: name, e-mail and customer number, in form order', () => {
  expect(customerFormProblems(filled(), { numberRequired: true })).toEqual([]);
  expect(customerFormProblems(filled({ name: '   ' }), { numberRequired: true })).toEqual(['name']);
  expect(customerFormProblems(filled({ email: 'a@b' }), { numberRequired: true })).toEqual(['email']);
  expect(customerFormProblems(filled({ email: '' }), { numberRequired: true })).toEqual([]); // the e-mail is optional
  expect(customerFormProblems(filled({ customer_number: '12a' }), { numberRequired: true })).toEqual(['customer_number']);
  expect(customerFormProblems(filled({ customer_number: '1234567890' }), { numberRequired: true })).toEqual(['customer_number']);
  expect(customerFormProblems(filled({ customer_number: '123456789' }), { numberRequired: true })).toEqual([]);
  expect(customerFormProblems(filled({ name: '', email: 'x', customer_number: '' }), { numberRequired: true })).toEqual(['name', 'email', 'customer_number']);
  // electricity always sends a number; water lets the server pick one when it is empty
  expect(customerFormProblems(filled({ customer_number: '' }), { numberRequired: true })).toEqual(['customer_number']);
  expect(customerFormProblems(filled({ customer_number: '' }), { numberRequired: false })).toEqual([]);
  expect(customerFormProblems(filled({ customer_number: 'x' }), { numberRequired: false })).toEqual(['customer_number']);
  for (const ok of ['a@b.co', 'first.last@mail.example.org']) expect(CUSTOMER_EMAIL.test(ok), ok).toBe(true);
  for (const bad of ['a b@c.d', 'a@b', '@b.c', 'a@.c', 'a@b.']) expect(CUSTOMER_EMAIL.test(bad), bad).toBe(false);
});

test('the save body: name trimmed; an unchanged customer number is left out of an edit', () => {
  const f = filled({ name: '  דנה  ', customer_number: '0007' });
  expect(customerSaveBody(f)).toEqual({ ...f, name: 'דנה' });
  expect(customerSaveBody(f, { customer_number: '0007' })).toEqual({ name: 'דנה', tax_id: '', address: '', phone: '', email: '', notes: '' });
  expect(customerSaveBody(f, { customer_number: '0008' })).toEqual({ ...f, name: 'דנה' });
  expect(f.name).toBe('  דנה  '); // the form itself is not changed
});

test('the list search: name or number (trimmed query), plus the page\'s own extra texts', () => {
  const c = { name: 'דנה כהן', customer_number: '0042' };
  expect(customerMatches(c, '')).toBe(true);
  expect(customerMatches(c, '   ')).toBe(true);
  expect(customerMatches(c, ' כהן ')).toBe(true);
  expect(customerMatches(c, '42')).toBe(true);
  expect(customerMatches(c, 'לוי')).toBe(false);
  expect(customerMatches(c, 'הרצל', ['רחוב הרצל 1'])).toBe(true);
  expect(customerMatches(c, 'הרצל', [undefined])).toBe(false);
});

test('the electricity customers page uses the shared form and keeps no copy of its own', () => {
  const src = readFileSync(new URL('../src/electricity/elec-customers.ts', import.meta.url), 'utf8');
  expect(src).toContain("from '../components/customer-form'");
  expect(src).not.toMatch(/const EMAIL\s*=|interface Form\b|const blank\s*=/);
  expect(src).toContain('numberRequired: true');
});
