import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { SKINS_UNDER_TEST } from './helpers/frozen-skins';

// WIDGETFIX-298 (owner report 28.10 on 2.24.0): on the home's top row at a wide desktop the elevators card collapsed to a stub (its
// inline-size container `.el-box` was a content-sized flex item of the row band's card and shrank to 0 px), and every card of the row
// stretched to ~250 px after it. The infrastructure cards (temperature, doors, notices, generator) had their parts laid side by side in
// the row band and their names squeezed to 0 px. This spec mounts the REAL row (one <home-widgets>, the product's band) through the
// widget-break harness at 2000 / 1440 / 1024 (layout row, as the home uses it from 900 px) and 390 (the phone's snap row), with two
// elevators (one out of service), a generator on the grid, temperature, doors and notices. Geometry only, no pixel baseline.
// Needs the Vite DEV server (the harness imports /src/; a preview build has no tests/ page, the gate's classifier reads this line).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-home-widgets-wide-298.spec.ts --project=desktop
// WF_SHOTS=<dir> also writes a screenshot per case.
const VIEWS: [number, number][] = [[2000, 950], [1440, 900], [1024, 768], [390, 844]];
const ROWS: Record<string, string[]> = {
  top: ['clock', 'weather', 'elevators', 'generators', 'shabbat'],
  infra: ['temperature', 'doors', 'notices', 'elevators', 'generators'],
  // PRESENCE-2280: the building presence card beside the elevators and the generator (the six-card infra row has no room for one more)
  pres: ['presence', 'clock', 'elevators', 'generators'],
};
/** The tallest a card of the row band may grow (2.23.x drew the top row at ~113 px; 2.24.0 drew it at ~250 px). The 1024 infra row
 * carries the harness's extreme -1234.6° reading, which puts the unit's name under it. */
const MAX_H: Record<string, Record<number, number>> = { top: { 2000: 130, 1440: 170, 1024: 170 }, infra: { 2000: 180, 1440: 180, 1024: 240 }, pres: { 2000: 180, 1440: 180, 1024: 240 } };
const ELEVATOR_NAMES = ['מעלית צפונית', 'מעלית דרומית'];
const SHOTS = process.env.WF_SHOTS;

async function open(page: Page, skin: string, scheme: string, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('about:blank');
  await page.goto(`/tests/widget-break-harness/index.html?skin=${skin}&scheme=${scheme}`);
  await page.waitForFunction(() => (window as unknown as { wbReady?: boolean }).wbReady === true, null, { timeout: 60_000 });
}

interface Card { id: string; w: number; h: number; problems: string[] }

async function measure(page: Page): Promise<Card[]> {
  return page.evaluate(() => {
    const sr = (document.querySelector('home-widgets') as HTMLElement).shadowRoot as ShadowRoot;
    const name = (e: Element) => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : ''}`;
    return Array.from(sr.querySelectorAll('[data-home-widget]')).map((s) => {
      const c = s.getBoundingClientRect();
      const problems: string[] = [];
      for (const e of Array.from(s.querySelectorAll('*')) as HTMLElement[]) {
        if (e.closest('svg, sw-icon, .eicon, .wg-e') || /^(STYLE|SCRIPT)$/.test(e.tagName)) continue;
        const b = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || !b.height) continue;
        const text = (e.textContent ?? '').trim();
        // the failure class: a part with words in it squeezed to a stub (a forecast day's "25°" is narrow by design)
        if (text.length >= 4 && b.width < 24 && !e.closest('.fc')) problems.push(`${name(e)} collapsed to ${Math.round(b.width)} px: "${text.slice(0, 16)}"`);
        if (b.width && (b.left < c.left - 1.5 || b.right > c.right + 1.5)) problems.push(`${name(e)} leaves its card (${Math.round(b.left - c.left)}..${Math.round(b.right - c.left)} of ${Math.round(c.width)})`);
        const hidden = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
        const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
        if (hidden && !clamp && cs.whiteSpace === 'nowrap' && e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && text) problems.push(`${name(e)} cuts its text without an ellipsis`);
      }
      return { id: s.getAttribute('data-home-widget') ?? '?', w: Math.round(c.width), h: Math.round(c.height), problems };
    });
  });
}

test.describe('home widgets in the wide row band', () => {
  test.beforeAll(() => { if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true }); });
  for (const skin of SKINS_UNDER_TEST) for (const scheme of ['light', 'dark'] as const) {
    test(`${skin} ${scheme}: every card keeps its title and rows at 2000 / 1440 / 1024 / 390`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'the spec sets its own viewports');
      test.setTimeout(180_000);
      const bad: string[] = [];
      for (const [w, h] of VIEWS) {
        await open(page, skin, scheme, w, h);
        for (const [row, ids] of Object.entries(ROWS)) {
          const layout = w <= 600 ? 'snap' : 'row';
          await page.evaluate(([i, l]) => (window as unknown as { wbMountRow: (a: string[], b: null, c: object) => Promise<void> }).wbMountRow(i as string[], null, { layout: l }), [ids, layout] as const);
          const cards = await measure(page);
          expect(cards.map((c) => c.id), `${w} ${row}: every widget is drawn`).toEqual(ids);
          for (const c of cards) for (const p of c.problems) bad.push(`${w} ${row} ${c.id}: ${p}`);
          // the elevators card: its content box spans the card, the heading and each elevator's name have a readable width
          const elev = await page.evaluate(() => {
            const s = (document.querySelector('home-widgets') as HTMLElement).shadowRoot!.querySelector('[data-home-widget="elevators"]') as HTMLElement;
            const wd = (sel: string) => Array.from(s.querySelectorAll(sel)).map((e) => Math.round(e.getBoundingClientRect().width));
            return { card: Math.round(s.getBoundingClientRect().width), box: wd('.el-box')[0] ?? 0, title: wd('.el-h b')[0] ?? 0, names: wd('.el-row .nm'), text: s.textContent ?? '' };
          });
          if (elev.box < elev.card * 0.6) bad.push(`${w} ${row} elevators: content box ${elev.box} px of a ${elev.card} px card`);
          if (elev.title < 40) bad.push(`${w} ${row} elevators: title ${elev.title} px`);
          if (elev.names.length !== 2 || elev.names.some((n) => n < 60)) bad.push(`${w} ${row} elevators: names ${elev.names.join('/')} px`);
          for (const word of ELEVATOR_NAMES) if (!elev.text.includes(word)) bad.push(`${w} ${row} elevators: an elevator name is missing`);
          if (layout === 'row') {
            const tallest = Math.max(...cards.map((c) => c.h));
            const cap = MAX_H[row][w];
            if (tallest > cap) bad.push(`${w} ${row}: the row band is ${tallest} px tall (cap ${cap}; heights ${cards.map((c) => `${c.id}=${c.h}`).join(' ')})`);
          }
          if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${skin}-${scheme}-${w}-${row}.png`), clip: { x: 0, y: 0, width: w, height: Math.min(h, 420) } });
        }
      }
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }
});
