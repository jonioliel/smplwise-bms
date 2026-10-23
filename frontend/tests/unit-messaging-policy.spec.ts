import { test, expect } from '@playwright/test';
import { MW_KEYS, MW_TABLES, mw } from '../src/i18n/messaging-policy';
import { PAGE_SIZE, blocksEverything, minutesValue, pageCount, pageOf, phoneDigits } from '../src/messaging/policy-model';
import { messagingPolicyApi, resetDemoMessagingPolicy, type PolicyEntry } from '../src/api/messaging-policy';

// WAPACE-295: the pure logic, the words and the demo backend of the WhatsApp policy card (allow-list and self-messages window). Runs in Node:
//   npx playwright test -c playwright.unit.config.ts tests/unit-messaging-policy.spec.ts

const entries = (n: number): PolicyEntry[] => Array.from({ length: n }, (_, i) => ({ id: `e${i}`, label: `n${i}`, role: 'handler', last4: '0191' }));

test('every key exists in all four languages and placeholders match', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    expect(Object.keys(MW_TABLES[lang]).sort(), lang).toEqual([...MW_KEYS].sort());
    for (const k of MW_KEYS) expect(MW_TABLES[lang][k].trim().length, `${lang}.${k}`).toBeGreaterThan(0);
  }
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
  for (const k of MW_KEYS) for (const lang of ['en', 'ar', 'ru'] as const) expect(ph(MW_TABLES[lang][k]), `${lang}.${k}`).toBe(ph(MW_TABLES.he[k]));
});

test('placeholders are filled', () => {
  expect(mw('page', { n: 2, m: 5 }, 'en')).toBe('Page 2 of 5');
  expect(mw('err_minutes', { lo: 1, hi: 240 }, 'he')).toBe('ערך בין 1 ל-240');
});

test('phone digits: 8-15 digits after cleaning, else null', () => {
  expect(phoneDigits('+972 50-123-4567')).toBe('972501234567');
  expect(phoneDigits('(555) 555-0191')).toBe('5555550191');
  for (const bad of ['', '12', 'abc', '1234567890123456', '+97250x']) expect(phoneDigits(bad), bad).toBeNull();
});

test('window minutes: whole numbers within the range only', () => {
  expect(minutesValue('30', [1, 240])).toBe(30);
  for (const bad of ['', '0', '241', '1.5', '-1', 'x', '1000']) expect(minutesValue(bad, [1, 240]), bad).toBeNull();
});

test('a long list is paged, never scrolled', () => {
  expect(pageCount(0)).toBe(1);
  expect(pageCount(PAGE_SIZE)).toBe(1);
  expect(pageCount(PAGE_SIZE + 1)).toBe(2);
  const all = entries(12);
  expect(pageOf(all, 0).items).toHaveLength(PAGE_SIZE);
  expect(pageOf(all, 2).items.map((e) => e.id)).toEqual(['e10', 'e11']);
  expect(pageOf(all, Number.MAX_SAFE_INTEGER).page).toBe(2);
  expect(pageOf(all, -4).page).toBe(0);
});

test('enforcement with an empty list is flagged', () => {
  expect(blocksEverything(true, 0)).toBe(true);
  expect(blocksEverything(true, 1)).toBe(false);
  expect(blocksEverything(false, 0)).toBe(false);
});

test('demo backend: add, remove, enforce and a timed window', async () => {
  resetDemoMessagingPolicy();
  const api = messagingPolicyApi();
  let v = await api.view();
  expect(v.enforce).toBe(false);
  expect(v.self_messages.active).toBe(false);
  const before = v.allow.length;
  v = await api.add({ phone: '+1 555 555 0193', label: ' Ravi ', role: 'provider' });
  expect(v.allow).toHaveLength(before + 1);
  expect(v.allow.at(-1)).toMatchObject({ label: 'Ravi', role: 'provider', last4: '0193' });
  await expect(api.add({ phone: '12', label: 'x', role: 'other' })).rejects.toThrow();
  v = await api.remove(v.allow.at(-1)!.id);
  expect(v.allow).toHaveLength(before);
  expect((await api.setEnforce(true)).enforce).toBe(true);
  v = await api.selfWindow(30);
  expect(v.self_messages.active).toBe(true);
  expect(Date.parse(v.self_messages.until!) - Date.now()).toBeGreaterThan(29 * 60_000);
  expect((await api.selfWindow(null)).self_messages).toMatchObject({ active: false, until: null });
});

test('no text offers a ticket action', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) for (const k of MW_KEYS) expect(MW_TABLES[lang][k]).not.toMatch(/ticket|בקשת שירות|طلب خدمة|заяв/i);
});
