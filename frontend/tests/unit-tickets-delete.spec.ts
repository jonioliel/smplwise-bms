import { test, expect } from '@playwright/test';
import { BULK_DELETE_MAX, DELETE_REASON_MAX, deleteConfirmValue, deleteReady } from '../src/tickets/delete-model';
import { DELETE_TEXT_EN_KEYS, DELETE_TEXT_KEYS, deleteTemplate, dlt } from '../src/tickets/delete-text';
import { ticketPermLabel } from '../src/tickets/perm-label';
import { tbt } from '../src/tickets/table-text';

// Owner 14.10: full deletion of tickets - the dialog's rules (the same limits as services/tickets/deletion.py), its words (Hebrew and
// English complete, the module's name only through tokens, never the old words) and the permission's label. Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-delete.spec.ts

const ONE = [{ id: 'a', number: 1042 }];
const THREE = [{ id: 'a', number: 1042 }, { id: 'b', number: 1043 }, { id: 'c', number: 1050 }];

test('one ticket: type its number; several: type how many are selected', () => {
  expect(deleteConfirmValue(ONE)).toBe(1042);
  expect(deleteConfirmValue(THREE)).toBe(3);
  expect(deleteReady(ONE, '1042', 'נפתחה בטעות')).toBe(true);
  expect(deleteReady(ONE, ' 1042 ', ' נפתחה בטעות ')).toBe(true);
  expect(deleteReady(ONE, '1043', 'נפתחה בטעות')).toBe(false);
  expect(deleteReady(THREE, '3', 'כפילויות')).toBe(true);
  expect(deleteReady(THREE, '1042', 'כפילויות')).toBe(false);
  expect(deleteReady([], '0', 'x')).toBe(false);
});

test('the reason is required and at most 300 characters; at most 50 tickets at a time', () => {
  expect(DELETE_REASON_MAX).toBe(300);
  expect(BULK_DELETE_MAX).toBe(50);
  expect(deleteReady(ONE, '1042', '   ')).toBe(false);
  expect(deleteReady(ONE, '1042', 'א'.repeat(300))).toBe(true);
  expect(deleteReady(ONE, '1042', 'א'.repeat(301))).toBe(false);
  const many = Array.from({ length: 51 }, (_, i) => ({ id: `t${i}`, number: 2000 + i }));
  expect(deleteReady(many, '51', 'x')).toBe(false);
  expect(deleteReady(many.slice(0, 50), '50', 'x')).toBe(true);
});

test('the words: complete in both languages, the name through tokens, never the old words', () => {
  expect([...DELETE_TEXT_EN_KEYS].sort()).toEqual([...DELETE_TEXT_KEYS].sort());
  for (const k of DELETE_TEXT_KEYS) {
    const he = deleteTemplate(k, 'he');
    expect(he, k).not.toMatch(/קריא(ה|ות|ת)/);
    expect(he, k).not.toMatch(/בקש(ת|ות) ה?שירות|ניהול השירות/);
  }
  expect(dlt('action')).toBe('מחיקת בקשת שירות');
  expect(dlt('title', { n: 1042 })).toBe('מחיקת בקשת שירות #1042');
  expect(dlt('typeNumber', { n: 1042 })).toContain('בקשת השירות');
  expect(dlt('bulkGoes')).toContain('בקשות השירות');
  expect(tbt('r_cost_claim_approved')).toBeTruthy();
});

test('the permission has words on the הרשאות tab', () => {
  expect(ticketPermLabel('tickets.delete')).toBe('מחיקה מלאה');
});
