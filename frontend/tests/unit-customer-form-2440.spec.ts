import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { blankCustomerForm, customerFormOf, customerFormProblems, customerSaveBody } from '../src/components/customer-form';

// CR-WATER-CUSTOMER-FORM-2440: the customer form shared by the electricity and the water customers pages (components/customer-form.ts).
// RELEASE-2440-TRAIN joined it with the text-free helpers of CR-I18N-ELECTRICITY-2443 (formerly electricity/customer-form.ts); the
// helper rules themselves are covered by unit-electricity-customer-form.spec.ts. This spec keeps the water side of the contract.
// Node-only:  npx playwright test -c playwright.unit.config.ts tests/unit-customer-form-2440.spec.ts

test('a blank form carries the next customer number; a stored customer fills every field, missing ones empty', () => {
  expect(blankCustomerForm()).toEqual({ name: '', customer_number: '', tax_id: '', address: '', phone: '', email: '', notes: '' });
  expect(blankCustomerForm('0042').customer_number).toBe('0042');
  expect(customerFormOf({ name: 'א', customer_number: '7', phone: '050' })).toEqual({ name: 'א', customer_number: '7', tax_id: '', address: '', phone: '050', email: '', notes: '' });
});

test('checks: digits-only customer number, required on electricity, optional on water; errors in form order', () => {
  const ok = { ...blankCustomerForm('12'), name: 'לקוח' };
  expect(customerFormProblems({ ...ok, customer_number: '1234567890' }, { numberRequired: false })).toEqual(['customer_number']);
  expect(customerFormProblems({ ...ok, customer_number: '' }, { numberRequired: true })).toEqual(['customer_number']);
  expect(customerFormProblems({ ...ok, customer_number: '' }, { numberRequired: false })).toEqual([]);
  expect(customerFormProblems({ ...blankCustomerForm('x'), email: 'bad' }, { numberRequired: false })).toEqual(['name', 'email', 'customer_number']);
});

test('an update sends the customer number only when it changed', () => {
  const f = { ...blankCustomerForm('5'), name: 'n' };
  expect('customer_number' in customerSaveBody(f, { customer_number: '5' })).toBe(false);
  expect(customerSaveBody(f, { customer_number: '4' }).customer_number).toBe('5');
  expect(customerSaveBody(f, { customer_number: '5' }).name).toBe('n');
});

test('both customers pages use the one shared module and keep no copy of their own', () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const water = read('../src/screens/water/page-customers.ts');
  const elecPage = read('../src/electricity/elec-customers.ts');
  for (const src of [water, elecPage]) {
    expect(src).toContain("/components/customer-form'");
    expect(src).toContain('customerField(');
    expect(src).not.toMatch(/const EMAIL\s*=|interface Form\b|const blank\s*=/);
  }
  expect(water).toContain('numberRequired: false');
  expect(water).toContain("idPrefix: 'wc-'");
  expect(elecPage).toContain("idPrefix: 'f-'");
  expect(() => read('../src/electricity/customer-form.ts')).toThrow();
});
