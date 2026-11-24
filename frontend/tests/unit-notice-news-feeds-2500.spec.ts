import { test, expect } from '@playwright/test';
import { emptyRow, healthOf, rowsOf, type Row } from '../src/notices/news-model';

// NOTICE-NEWS-FEEDS-2500: when the sources editor shows the "not working" chip, and with which reason.
//   npx playwright test -c playwright.unit.config.ts tests/unit-notice-news-feeds-2500.spec.ts

const saved = rowsOf([
  { id: 'walla', name: 'וואלה', url: 'https://rss.walla.co.il/feed/1', last_ok_at: '2026-11-24T04:00:00Z', last_error: 'xml' },
  { id: 'calcalist', name: 'כלכליסט', url: 'https://www.calcalist.co.il/Integration/StoryRss3674.xml', last_ok_at: null, last_error: 'status' },
  { id: 'ynet', name: 'ynet', url: 'https://www.ynet.co.il/Integration/StoryRss2.xml', last_ok_at: '2026-11-24T06:00:00Z', last_error: null },
  { id: 'never', name: 'x', url: 'https://feeds.example.com/rss' },
  { id: 'odd', name: 'y', url: 'https://feeds.example.com/odd', last_error: 'something-new' },
  { id: 'blocked', name: 'z', url: 'https://feeds.example.com/z', last_error: 'address' },
]);
const at = (id: string): Row => saved.find((r) => r.id === id)!;

test('a failure shows its reason and when it last worked', () => {
  expect(healthOf(at('walla'), saved)).toEqual({ why: 'nsWhyXml', code: 'xml', lastOk: '2026-11-24T04:00:00Z' });
  expect(healthOf(at('calcalist'), saved)).toEqual({ why: 'nsWhyStatus', code: 'status', lastOk: null });
  expect(healthOf(at('blocked'), saved)?.why).toBe('nsWhyBlocked');
  expect(healthOf(at('odd'), saved)?.why).toBe('nsWhyOther'); // a reason code this build does not know still shows the chip
});

test('no chip: working, never fetched, a new row, or an address edited since the result', () => {
  expect(healthOf(at('ynet'), saved)).toBeNull();
  expect(healthOf(at('never'), saved)).toBeNull();
  expect(rowsOf([{ id: 'never', name: 'x', url: 'https://x.example.com/' }])[0]).toMatchObject({ last_ok_at: null, last_error: null }); // an older backend
  expect(healthOf({ ...emptyRow(), last_error: 'status' }, saved)).toBeNull();
  expect(healthOf({ ...at('calcalist'), url: 'https://www.calcalist.co.il/Integration/StoryRss2.xml' }, saved)).toBeNull();
  expect(healthOf({ ...at('calcalist'), url: ' https://www.calcalist.co.il/Integration/StoryRss3674.xml ' }, saved)?.code).toBe('status'); // spaces only
});
