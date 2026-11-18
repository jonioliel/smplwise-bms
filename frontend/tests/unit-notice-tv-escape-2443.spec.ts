import { test, expect } from '@playwright/test';
import * as logic from '../src/notice-tv/tv-logic';
import { digitsHtml, hoursRow, metaHtml, words } from '../src/notice-tv/hx-parts';
import { estimateLine, sidePanel, slidePanel, stripPanel } from '../src/notice-tv/transit-view';
import { v2Eta, v2Panel, v2Slide, v2Strip } from '../src/notice-tv/v2-transit';
import type { TransitDigest, TransitItem } from '../src/notice-tv/transit-logic';

// CR-TV-FONTS-ESCAPE-2443 (code review 08:F05): the TV board builds its HTML by string concatenation from a feed that is cast, never
// validated. Every builder that runs in Node gets a hostile string in EVERY field it reads (numbers included: JSON can carry a string
// where the type says number) and the produced HTML must carry none of it as markup: no element, no attribute breaking out of "..." or '...'.
// The DOM engines (main.ts, skin-board.ts, hx-engine.ts) are covered in a browser by notice-tv-hostile-2443.spec.ts.
//   npx playwright test tests/unit-notice-tv-escape-2443.spec.ts --project=desktop --workers=1

const { esc, tickerItemHtml } = logic;
const num = (x: unknown): string => (logic as unknown as { num: (x: unknown) => string }).num(x); // a namespace read: the spec loads before num() exists

const P = `"'><x-pwn data-pwn="1" data-pwn2='1'>`;
const H = P as unknown as number; // a hostile string where the feed type says number

function clean(html: string, where: string): void {
  expect(html, where + ': an element from the data').not.toContain('<x-pwn');
  expect(html, where + ': a "..." attribute broken out').not.toContain('data-pwn="1');
  expect(html, where + ": a '...' attribute broken out").not.toContain("data-pwn2='1");
}

test('esc escapes the five HTML specials, the single quote included; num keeps a number and escapes anything else', () => {
  expect(esc(`<a href="x" title='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  expect(esc('מגדל הים 12:00')).toBe('מגדל הים 12:00');
  expect(num(24)).toBe('24');
  expect(num(-3.5)).toBe('-3.5');
  expect(num(0)).toBe('0');
  expect(num(P)).toBe(esc(P));
  expect(num(undefined)).toBe('undefined'); // what the old concatenation printed: a valid feed never sends it, an invalid one stays inert
});

test('hi-tech parts: the meta line, the title words, the clock digits and the hours row', () => {
  clean(metaHtml({ severity: P, word: P, when: P }), 'metaHtml');
  clean(words('lumen', P), 'words lumen');
  clean(words('axis', P), 'words axis');
  clean(digitsHtml(P), 'digitsHtml');
  clean(hoursRow([{ at: P, t: H }], P), 'hoursRow');
});

test('the news ticker item', () => {
  clean(tickerItemHtml({ source: P, title: P, logo: P }, P), 'tickerItemHtml');
});

const NOW = Date.parse('2026-10-23T06:12:00Z');
const item = (over: Partial<TransitItem> = {}): TransitItem => ({
  line: P, dest: P, stop: H, at: '2026-10-23T06:20:00Z', hm: P, mins: 8, quality: 'realtime', distance_m: H,
  more: [{ at: '2026-10-23T06:40:00Z', hm: P, mins: 28 }, { at: P, hm: P, mins: H }], ...over,
} as TransitItem);

function digest(state: string, over: Partial<TransitDigest> = {}): TransitDigest {
  return {
    state: state as TransitDigest['state'], now: '2026-10-23T06:12:00Z', updated_hm: P, window_min: H, rows: 5, multi: true, realtime: true, show_distance: true,
    stops: [{ code: H, name: P }], items: [item(), item({ at: P, mins: H, quality: 'scheduled' })], overflow: H, grouped: true, next: item(),
    columns: [{ stop: H, name: P, items: [item()], overflow: H, grouped: true, next: item() }], source_down: false, ...over,
  } as TransitDigest;
}

test('bus times (classic board): side, strip and slide panels in every state', () => {
  for (const lang of ['he', 'en'] as const) {
    const c = { lang, nowMs: NOW, elapsedMs: 0 };
    for (const st of [P, 'fresh', 'cached', 'expired', 'empty']) {
      for (const over of [{}, { items: [] }, { source_down: true }, { source_down: true, partial: true, items: [] }] as Partial<TransitDigest>[]) {
        const d = digest(st, over);
        const where = `${lang}/${st === P ? 'hostile' : st}/${JSON.stringify(Object.keys(over))}`;
        clean(sidePanel(d, c), 'sidePanel ' + where);
        clean(stripPanel(d, c), 'stripPanel ' + where);
        clean(slidePanel(d, c, '<div class="clk"></div>'), 'slidePanel ' + where);
        clean(estimateLine(item(), d, c), 'estimateLine ' + where);
      }
    }
  }
});

test('bus times (V2 board): panel, strip and slide in every state', () => {
  for (const lang of ['he', 'en'] as const) {
    for (const next of [true, false]) {
      const c = { lang, nowMs: NOW, next };
      for (const st of [P, 'fresh', 'cached', 'expired', 'empty']) {
        for (const over of [{}, { items: [] }, { multi: false }] as Partial<TransitDigest>[]) {
          const d = digest(st, over);
          const where = `${lang}/${next}/${st === P ? 'hostile' : st}/${JSON.stringify(Object.keys(over))}`;
          clean(v2Panel(d, c), 'v2Panel ' + where);
          clean(v2Strip(d, c), 'v2Strip ' + where);
          clean(v2Slide(d, c, true), 'v2Slide ' + where);
          clean(v2Eta(item(), d, c), 'v2Eta ' + where);
        }
      }
    }
  }
});
