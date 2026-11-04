import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// ROUND4-LEFTOVERS-2390: the owner's design round 16 - three compact directions for the home card "נוכחות במבנה" next to the card that
// ships today, drawn inside the real home band (clock, alarm, the real card shell and tokens) by tests/presence-design-harness/
// round16-options.ts. Capture only (no pixel baseline, nothing shipped): one picture per option, dataset, size, scheme and width, plus a
// fit report (the card is never taller than its row and clips nothing). Runs only with R16_SHOTS=<dir>; the gate skips it.
// Needs the Vite dev server (the harness imports /src/; a preview build has no tests/ page).
//   R16_SHOTS=<dir> SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-presence-round16.spec.ts --project=desktop --project=mobile
const SHOTS = process.env.R16_SHOTS;
const FIXED = new Date('2026-11-04T08:20:00Z'); // 10:20 in the installation's zone

type Opt = 'current' | 'a' | 'b' | 'c';
const OPTS: Opt[] = ['current', 'a', 'b', 'c'];

async function draw(page: Page, opt: Opt, ds: string, layout: string, size: string, scheme: 'light' | 'dark') {
  await page.clock.setFixedTime(FIXED);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: scheme });
  await page.goto('about:blank');
  await page.goto(`/tests/presence-design-harness/index.html?scheme=${scheme}`);
  await page.waitForFunction(() => (window as unknown as { pdReady?: boolean }).pdReady === true, null, { timeout: 30_000 });
  await page.evaluate(
    async ([d, l, s, o]) => {
      const w = window as unknown as { pdMountHome: (...a: string[]) => Promise<void>; pdOption16: (o: string) => Promise<void> };
      await w.pdMountHome(d, l, s);
      await w.pdOption16(o);
    },
    [ds, layout, size, opt] as const,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

/** The band's cards: heights, and whether the presence card (or the clock card for option C) clips its own content. */
async function fit(page: Page, opt: Opt) {
  return page.evaluate((o) => {
    const sr = document.querySelector('home-widgets')?.shadowRoot;
    const cards = [...(sr?.querySelectorAll('.wg') ?? [])] as HTMLElement[];
    const vis = cards.filter((c) => c.offsetParent !== null);
    const target = (sr?.querySelector(o === 'c' ? '.wg-clock' : '.wg-pres') ?? null) as HTMLElement | null;
    const kids = target ? ([...target.querySelectorAll('*')] as HTMLElement[]).filter((k) => k.offsetParent !== null) : [];
    const tb = target?.getBoundingClientRect();
    const clipped = tb ? kids.filter((k) => { const r = k.getBoundingClientRect(); return r.height > 0 && (r.bottom > tb.bottom + 0.5 || r.top < tb.top - 0.5); }).length : -1;
    return {
      heights: vis.map((c) => `${c.getAttribute('data-w')}:${Math.round(c.getBoundingClientRect().height)}`),
      target: tb ? Math.round(tb.height) : null,
      clipped,
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, opt);
}

test.describe('round 16: compact presence card directions (capture)', () => {
  test.skip(!SHOTS, 'set R16_SHOTS=<dir> to capture the round-16 pictures');
  test.describe.configure({ timeout: 300_000 });
  test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'desktop 1440 and the phone 390'));

  for (const opt of OPTS) {
    test(`option ${opt}`, async ({ page }, info) => {
      const phone = info.project.name === 'mobile';
      const layout = phone ? 'stack' : 'hero';
      const cases: [string, string, 'light' | 'dark'][] = phone
        ? [['ready', 'm', 'light'], ['ready', 'm', 'dark'], ['worst', 'm', 'light'], ['worst', 'm', 'dark'], ['empty', 'm', 'light'], ['empty', 'm', 'dark']]
        : [
            ['ready', 'm', 'light'], ['ready', 'm', 'dark'], ['empty', 'm', 'light'], ['empty', 'm', 'dark'], ['unknown', 'm', 'light'], ['unknown', 'm', 'dark'],
            ['worst', 'm', 'light'], ['worst', 'm', 'dark'], ['ready', 's', 'light'], ['ready', 's', 'dark'], ['ready', 'l', 'light'], ['ready', 'l', 'dark'],
          ];
      const out = path.join(SHOTS as string, 'shots');
      fs.mkdirSync(out, { recursive: true });
      const report: Record<string, unknown> = {};
      for (const [ds, size, scheme] of cases) {
        await draw(page, opt, ds, layout, size, scheme);
        const name = `${opt}-${phone ? 'phone' : 'desktop'}-${ds}-${size}-${scheme}`;
        const f = await fit(page, opt);
        report[name] = f;
        expect(f.sideways, `${name}: sideways overflow`).toBeLessThanOrEqual(1);
        await page.locator('home-widgets').screenshot({ path: path.join(out, `${name}.png`) });
      }
      fs.writeFileSync(path.join(SHOTS as string, `fit-${opt}-${phone ? 'phone' : 'desktop'}.json`), JSON.stringify(report, null, 1));
    });
  }
});
