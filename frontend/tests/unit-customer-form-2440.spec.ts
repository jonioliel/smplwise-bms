import { test, expect } from '@playwright/test';
import { blankCustomerForm, customerFormOf, customerUpdateBody, validateCustomerForm } from '../src/components/customer-form';

// CR-WATER-CUSTOMER-FORM-2440: the customer form shared by the electricity and the water customers pages (components/customer-form.ts).
// Node-only:  npx playwright test -c playwright.unit.config.ts tests/unit-customer-form-2440.spec.ts

const MSG = { name: 'name', email: 'email', customerNumber: 'number' };

test('a blank form carries the next customer number; a stored customer fills every field, missing ones empty', () => {
  expect(blankCustomerForm()).toEqual({ name: '', customer_number: '', tax_id: '', address: '', phone: '', email: '', notes: '' });
  expect(blankCustomerForm('0042').customer_number).toBe('0042');
  expect(customerFormOf({ name: 'א', customer_number: '7', phone: '050' })).toEqual({ name: 'א', customer_number: '7', tax_id: '', address: '', phone: '050', email: '', notes: '' });
});

test('checks: a name, a well-formed e-mail when given, digits-only customer number (required on electricity, optional on water)', () => {
  const ok = { ...blankCustomerForm('12'), name: 'לקוח' };
  expect(validateCustomerForm(ok, MSG)).toEqual({});
  expect(validateCustomerForm({ ...ok, name: '  ' }, MSG)).toEqual({ name: 'name' });
  expect(validateCustomerForm({ ...ok, email: 'a@b' }, MSG)).toEqual({ email: 'email' });
  expect(validateCustomerForm({ ...ok, email: 'a@b.co' }, MSG)).toEqual({});
  expect(validateCustomerForm({ ...ok, customer_number: '12a' }, MSG)).toEqual({ customer_number: 'number' });
  expect(validateCustomerForm({ ...ok, customer_number: '1234567890' }, MSG, { numberOptional: true })).toEqual({ customer_number: 'number' });
  // an empty number: the electricity page asks for one, the water page lets the server assign it
  expect(validateCustomerForm({ ...ok, customer_number: '' }, MSG)).toEqual({ customer_number: 'number' });
  expect(validateCustomerForm({ ...ok, customer_number: '' }, MSG, { numberOptional: true })).toEqual({});
  // the order of the errors stays name, e-mail, number
  expect(Object.keys(validateCustomerForm({ ...blankCustomerForm('x'), email: 'bad' }, MSG))).toEqual(['name', 'email', 'customer_number']);
});

test('an update sends the customer number only when it changed', () => {
  const f = { ...blankCustomerForm('5'), name: 'n' };
  expect('customer_number' in customerUpdateBody(f, { customer_number: '5' })).toBe(false);
  expect(customerUpdateBody(f, { customer_number: '4' }).customer_number).toBe('5');
  expect(customerUpdateBody(f, { customer_number: '5' }).name).toBe('n');
});
