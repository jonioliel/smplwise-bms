import { test, expect } from '@playwright/test';
import { agoText, effective, ts } from '../src/notice-tv/transit-logic';
import { sidePanel, slidePanel, stripPanel } from '../src/notice-tv/transit-view';
import { NOW, columns, digest } from './bustimes-fixtures';

// BUSSTATUS-297: while the public-transport PROVIDER is down the card keeps the last scheduled rows, says how old they are and says
// in one calm line that the external source is unavailable; it is never empty or broken. Node only - no browser page.
//   npx playwright test -c playwright.unit.config.ts tests/unit-busstatus-297.spec.ts

const ctx = { lang: 'he' as const, nowMs: NOW };
const down = (p: Parameters<typeof digest>[0] = {}) => digest({ state: 'cached', source_down: true, partial: false, age_s: 42 * 60, updated_hm: '08:30', ...p });

test('"updated N min ago" follows the digest age and the screen stopwatch; hours from two hours on', () => {
  expect(agoText('he', { age_s: 42 * 60 }, 0)).toBe('עודכן לפני 42 דק׳');
  expect(agoText('he', { age_s: 42 * 60 }, 3 * 60_000)).toBe('עודכן לפני 45 דק׳');
  expect(agoText('he', { age_s: 3 * 3600 }, 0)).toBe('עודכן לפני 3 שעות');
  expect(agoText('en', { age_s: 5 * 60 }, 0)).toBe('Updated 5 min ago');
  expect(agoText('he', {}, 0)).toBe('');
});

test('a provider outage: rows stay, the header says how old they are, one calm line says the source is down', () => {
  const html = sidePanel(down(), ctx);
  expect(html).toContain('class="brow');
  expect(html).toContain('עודכן לפני 42 דק׳');
  expect(html).toContain('מקור הנתונים החיצוני אינו זמין כרגע');
  expect(html).toContain('data-bus-note="source-down"');
  expect(html).not.toContain('לא מעודכן מ-'); // the old wording is for a silent cache, not for a known outage
  const strip = stripPanel(down(), ctx);
  expect(strip).not.toContain('class="brow');
  expect(strip).toContain('class="bcard');
  expect(strip).toContain('עודכן לפני 42 דק׳ · מקור הנתונים החיצוני אינו זמין כרגע');
  const slide = slidePanel(down({ columns: columns(2), nstops: 2 }), ctx, '');
  expect(slide).toContain('עודכן לפני 42 דק׳');
  expect(slide).toContain('data-bus-note="source-down"');
});

test('a cached card without an outage keeps its old wording', () => {
  const html = sidePanel(digest({ state: 'cached', updated_hm: '08:53' }), ctx);
  expect(html).toContain('לא מעודכן מ-08:53');
  expect(html).not.toContain('data-bus-note');
});

test('when the cached window no longer covers the display window an empty list says "unknown", not "no buses"', () => {
  const html = sidePanel(down({ items: [], overflow: 0, partial: true }), ctx);
  expect(html).toContain('data-bus-state="unknown"');
  expect(html).toContain('אין זמני לוח מעודכנים לטווח הזה');
  expect(html).not.toContain('אין אוטובוסים');
  const empty = sidePanel(digest({ state: 'cached', items: [], overflow: 0 }), ctx);
  expect(empty).toContain('אין אוטובוסים'); // a genuine empty window is still "no buses"
});

test('expired during an outage names the source, never a blank card', () => {
  const html = sidePanel(digest({ state: 'expired', source_down: true, items: [] }), ctx);
  expect(html).toContain('data-bus-state="expired"');
  expect(html).toContain('מקור הנתונים החיצוני אינו זמין כרגע');
  const strip = stripPanel(digest({ state: 'expired', source_down: true, items: [] }), ctx);
  expect(strip).toContain('מקור הנתונים החיצוני אינו זמין כרגע');
});

test('on the screen own stopwatch an outage keeps the rows past the grace, up to a day', () => {
  const d = down({ age_s: 40 * 60 });
  expect(effective(d, 60_000)?.state).toBe('cached');
  expect(effective(d, 3 * 3600_000)?.state).toBe('cached');
  expect(effective(d, 24 * 3600_000)?.state).toBe('expired');
  const silent = digest({ state: 'cached', age_s: 20 * 60, source_down: false });
  expect(effective(silent, 11 * 60_000)?.state).toBe('expired'); // no outage: the installation grace (30 min) still decides
});

test('the new strings exist in both languages', () => {
  for (const k of ['agoMin', 'agoH', 'sourceDown', 'sourceDownPartial'] as const) {
    expect(ts('he', k, { n: 1 }).length).toBeGreaterThan(3);
    expect(ts('en', k, { n: 1 }).length).toBeGreaterThan(3);
  }
});
