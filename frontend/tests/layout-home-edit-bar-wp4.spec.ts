import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// POLISH4-WP4 (D2, PRE-GATE-2360): in edit mode the home card's edit bar (size, arrows, settings, hide) sat over the last rows of
// "פעולות מהירות" at 1920 / 1440 - the fixed 52 px room under the content lost to the band's fit steps and was too short for a bar that
// wraps in a narrow card. Each card now keeps its bar's measured height free. This spec mounts the REAL band (one <home-widgets>) in
// edit mode through the widget-break harness, in every direction and fit step the home uses, and checks that no part of a card's
// content reaches under its edit bar and that the bar stays inside its card. Geometry only, no pixel baseline.
// Needs the Vite DEV server (the harness imports /src/; a preview build has no tests/ page, the gate's classifier reads this line).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-home-edit-bar-wp4.spec.ts --project=desktop
// WF_SHOTS=<dir> also writes a screenshot per case.
const IDS = ['clock', 'weather', 'quick', 'notices', 'alarm'];
const CASES: { w: number; h: number; layout: string; fit?: string }[] = [
  { w: 1920, h: 1080, layout: 'row' },
  { w: 1920, h: 1080, layout: 'row', fit: '1' },
  { w: 1920, h: 1080, layout: 'hero', fit: '2' },
  { w: 1440, h: 900, layout: 'row', fit: '2' },
  { w: 1440, h: 900, layout: 'hero' },
  { w: 1440, h: 900, layout: 'side', fit: '1' },
  { w: 1024, h: 768, layout: 'row' },
  { w: 1024, h: 768, layout: 'two' },
  { w: 390, h: 844, layout: 'snap' },
  { w: 390, h: 844, layout: 'stack' },
];
const SHOTS = process.env.WF_SHOTS;

async function open(page: Page, skin: string, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('about:blank');
  await page.goto(`/tests/widget-break-harness/index.html?skin=${skin}&scheme=light`);
  await page.waitForFunction(() => (window as unknown as { wbReady?: boolean }).wbReady === true, null, { timeout: 60_000 });
}

/** Per edited card: the parts of its content that reach under its edit bar, and whether the bar leaves the card. */
async function overlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sr = (document.querySelector('home-widgets') as HTMLElement).shadowRoot as ShadowRoot;
    const out: string[] = [];
    for (const card of Array.from(sr.querySelectorAll<HTMLElement>('[data-home-widget]'))) {
      const id = card.getAttribute('data-home-widget');
      const bar = card.querySelector<HTMLElement>('[data-home-edit-bar]');
      if (!bar) {
        out.push(`${id}: no edit bar`);
        continue;
      }
      const c = card.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      if (b.bottom > c.bottom + 1 || b.top < c.top - 1) out.push(`${id}: the bar leaves its card (${Math.round(b.top - c.top)}..${Math.round(b.bottom - c.top)} of ${Math.round(c.height)})`);
      for (const e of Array.from(card.querySelectorAll<HTMLElement>('*'))) {
        if (e.closest('[data-home-edit-bar]') || /^(STYLE|SCRIPT)$/.test(e.tagName)) continue;
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        // only what is drawn inside the card counts (a clipped part of the card is not under the bar)
        const top = Math.max(r.top, c.top);
        const bottom = Math.min(r.bottom, c.bottom);
        if (bottom <= top) continue;
        if (bottom > b.top + 1 && r.right > b.left && r.left < b.right) {
          out.push(`${id}: ${e.tagName.toLowerCase()}.${(typeof e.className === 'string' ? e.className : '').split(' ')[0]} reaches ${Math.round(bottom - b.top)} px under the bar`);
          break;
        }
      }
    }
    return out;
  });
}

test.describe('home edit mode: the edit bar never covers a card', () => {
  test.beforeAll(() => { if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true }); });
  for (const skin of ['classic', 'bubble']) {
    test(`${skin}: every direction and fit step, 1920 / 1440 / 1024 / 390`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'the spec sets its own viewports');
      test.setTimeout(180_000);
      const bad: string[] = [];
      let last = 0;
      for (const k of CASES) {
        if (k.w !== last) await open(page, skin, k.w, k.h);
        last = k.w;
        await page.evaluate(([ids, o]) => (window as unknown as { wbMountRow: (a: string[], b: null, c: object) => Promise<void> }).wbMountRow(ids as string[], null, o as object), [IDS, { layout: k.layout, fit: k.fit, editing: true }] as const);
        // the bar reports its height through a ResizeObserver: one more frame for the card to take it
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const tag = `${k.w} ${k.layout}${k.fit ? ` fit ${k.fit}` : ''}`;
        for (const p of await overlaps(page)) bad.push(`${tag}: ${p}`);
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `edit-bar-${skin}-${k.w}-${k.layout}${k.fit ? `-fit${k.fit}` : ''}.png`), fullPage: true });
      }
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }
});
