import { test, expect } from '@playwright/test';
import { bulkHeadline, type BulkRecord } from '../src/api/device-bulk';

// CR-007 slice 4 re-review: "stop all covers" sends commands with nothing observable; those entities are "sent",
// not failed. The headline must not read "לא בוצע" for a stop that every blind accepted. Node only.

function record(counts: Partial<BulkRecord['counts']>, done = true): BulkRecord {
  const base = { queued: 0, accepted: 0, confirmed: 0, sent: 0, not_confirmed: 0, refused: 0, unknown: 0, total: 0 };
  return { id: 'b', scope: 'area', scope_id: 'a', scope_name: null, kind: 'covers_stop', kind_label: 'x', status: done ? 'done' : 'waiting', done, all_confirmed: false, counts: { ...base, ...counts }, items: [], note: '' } as BulkRecord;
}

test('all sent reads "נשלח", never "לא בוצע"', () => {
  const h = bulkHeadline(record({ sent: 3, total: 3 }));
  expect(h.tone).toBe('ok');
  expect(h.text).toBe('נשלח');
});

test('confirmed plus sent covers the set', () => {
  const h = bulkHeadline(record({ confirmed: 2, sent: 1, total: 3 }));
  expect(h.tone).toBe('ok');
  expect(h.text).toContain('נשלח');
});

test('sent entities are not counted as missing', () => {
  const h = bulkHeadline(record({ confirmed: 1, sent: 1, not_confirmed: 1, total: 3 }));
  expect(h.tone).toBe('partial');
  expect(h.text).toBe('בוצע חלקית: 1 לא אושרו');
});

test('all confirmed still reads "בוצע"; nothing confirmed or sent reads "לא בוצע"', () => {
  expect(bulkHeadline(record({ confirmed: 2, total: 2 })).text).toBe('בוצע');
  expect(bulkHeadline(record({ not_confirmed: 2, total: 2 })).tone).toBe('none');
});
