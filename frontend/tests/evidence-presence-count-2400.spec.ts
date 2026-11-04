import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PICKER_SKINS } from './helpers/frozen-skins';

// PRESENCE-COUNT-2400: the home card "count and names" (round-16 direction A; owner round 18, Q25-27), the DEFAULT presence style since
// 2.40.0, drawn by the shipped code in the real home band (clock, alarm, presence) of tests/presence-design-harness. Asserts the measured
// constraint of the round-16 mockup: the card keeps its row's height (178 px desktop 1440 at medium, 140 px phone 390) - it never grows the
// row and clips nothing - in every state (ready / one / empty / no data / 500 rooms / loading / error), size, skin and scheme, RTL, no
// sideways scroll, the map link a 44 px target, green only in the lamp and the bar. Invented data only. Desktop and phone (tablet skipped).
// Needs the Vite dev server (the harness imports /src/; a preview build has no tests/ page; the gate's classifier reads this line).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-presence-count-2400.spec.ts --project=desktop --project=mobile
// P24_SHOTS=<dir> also writes one picture per case and fit.json (private-evidence/presence-2400/).
const SHOTS = process.env.P24_SHOTS;
const FIXED = new Date('2026-11-04T08:20:00Z'); // 10:20 in the installation's zone, as in round 16
type Scheme = 'light' | 'dark';
type Mount = (ds: string, layout: string, size: string, card?: Record<string, string>) => Promise<void>;

async function open(page: Page, scheme: Scheme, skin?: string) {
  await page.clock.setFixedTime(FIXED);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: scheme });
  await page.goto('about:blank');
  await page.goto(`/tests/presence-design-harness/index.html?scheme=${scheme}${skin ? `&skin=${skin}` : ''}`);
  await page.waitForFunction(() => (window as unknown as { pdReady?: boolean }).pdReady === true, null, { timeout: 30_000 });
}

async function mount(page: Page, ds: string, layout: string, size: string, card: Record<string, string> = {}) {
  await page.evaluate(([d, l, s, c]) => (window as unknown as { pdMountHome: Mount }).pdMountHome(d as string, l as string, s as string, c as Record<string, string>), [ds, layout, size, card] as const);
  await page.evaluate(() => document.fonts.ready);
}

/** The band: every card's height, the presence card's height and min, whether anything inside it leaves its box, and sideways scroll. */
async function fit(page: Page) {
  return page.evaluate(() => {
    const sr = document.querySelector('home-widgets')?.shadowRoot;
    const cards = ([...(sr?.querySelectorAll('.wg') ?? [])] as HTMLElement[]).filter((c) => c.offsetParent !== null);
    const card = (sr?.querySelector('.wg-pres') ?? null) as HTMLElement | null;
    const tb = card?.getBoundingClientRect();
    const kids = card ? ([...card.querySelectorAll('*')] as HTMLElement[]).filter((k) => k.offsetParent !== null) : [];
    // vertically nothing may leave the card; sideways the card's own blocks (a long name inside the names line is cut by its ellipsis on purpose)
    const blocks = new Set(card ? [...card.querySelectorAll('.wg-h, .pn, .pn-row, .pn-n, .pn-t, .pn-w, .pn-names, .pn-names > span, .pn-bar, .pn-fl')] : []);
    const out = tb ? kids.filter((k) => {
      const r = k.getBoundingClientRect();
      if (!(r.height > 0)) return false;
      return r.bottom > tb.bottom + 0.5 || r.top < tb.top - 0.5 || (blocks.has(k) && (r.left < tb.left - 0.5 || r.right > tb.right + 0.5));
    }).map((k) => k.className || k.tagName) : [];
    const link = sr?.querySelector('[data-building-card-map]') as HTMLElement | null;
    return {
      heights: Object.fromEntries(cards.map((c) => [c.getAttribute('data-w'), Math.round(c.getBoundingClientRect().height)])),
      h: tb ? Math.round(tb.height) : null,
      min: card ? parseFloat(getComputedStyle(card).minBlockSize) || 0 : 0,
      clipped: card ? card.scrollHeight > card.clientHeight + 1 : false,
      out,
      link: link ? Math.round(link.getBoundingClientRect().height) : null,
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dir: getComputedStyle(document.documentElement).direction,
    };
  });
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  const dir = path.join(SHOTS, 'shots');
  fs.mkdirSync(dir, { recursive: true });
  await page.locator('home-widgets').screenshot({ path: path.join(dir, `${name}.png`) });
}

/** Green belongs to the lamp and the bar only: the number and the word are drawn in ink (or grey when empty / no data). */
async function inkCheck(page: Page) {
  return page.evaluate(() => {
    const sr = document.querySelector('home-widgets')!.shadowRoot!;
    const probe = document.createElement('span');
    probe.style.color = 'var(--sw-success)';
    sr.querySelector('.wg-pres')!.append(probe);
    const green = getComputedStyle(probe).color;
    probe.remove();
    const num = getComputedStyle(sr.querySelector('.pn-n b')!).color;
    const word = getComputedStyle(sr.querySelector('.pn-w > span:not(.pr-lamp)')!).color;
    return { green, num, word };
  });
}

test.describe('PRESENCE-COUNT-2400: count and names - the home card', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'desktop 1440 and the phone 390 (the round-16 measurement)'));
  test.describe.configure({ timeout: 300_000 });

  for (const scheme of ['light', 'dark'] as Scheme[]) {
    test(`${scheme}: every state and size keeps the row height, clips nothing and scrolls nowhere`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      const phone = info.project.name === 'mobile';
      const layout = phone ? 'stack' : 'hero';
      const report: Record<string, unknown> = {};
      await open(page, scheme);
      // the band without the card (loading: no answer yet - the card is absent, it never holds an empty slot)
      await mount(page, 'loading', layout, 'm');
      await expect(page.locator('[data-home-widget="presence"]')).toHaveCount(0);
      report[`loading-m`] = await fit(page);
      await shot(page, `${phone ? 'phone' : 'desktop'}-loading-m-${scheme}`);
      const cases: [string, 's' | 'm' | 'l'][] = [['ready', 's'], ['ready', 'm'], ['ready', 'l'], ['one', 'm'], ['empty', 'm'], ['empty', 'l'], ['unknown', 'm'], ['worst', 's'], ['worst', 'm'], ['worst', 'l'], ['error', 'm']];
      for (const [ds, size] of cases) {
        await mount(page, ds, layout, size);
        const name = `${phone ? 'phone' : 'desktop'}-${ds}-${size}-${scheme}`;
        await expect(page.locator('[data-home-widget="presence"]')).toBeVisible();
        if (ds === 'error') {
          await expect(page.locator('[data-home-widget-failed="presence"]')).toBeVisible();
          await shot(page, name);
          continue;
        }
        await expect(page.locator('.wg-pres.pr-count')).toHaveCount(1);
        const f = await fit(page);
        report[name] = f;
        expect(f.dir, 'RTL').toBe('rtl');
        expect(f.sideways, `${name}: sideways scroll`).toBeLessThanOrEqual(1);
        expect(f.clipped, `${name}: content clipped`).toBe(false);
        expect(f.out, `${name}: something leaves the card`).toEqual([]);
        expect(f.link ?? 0, `${name}: the map link is a 44 px target`).toBeGreaterThanOrEqual(44);
        // the row's height: never taller than its neighbours or its own size's minimum (the card does not grow the row)
        const others = Object.entries(f.heights).filter(([k]) => k !== 'presence').map(([, v]) => v as number);
        if (!phone) {
          expect(f.h!, `${name}: taller than the row`).toBeLessThanOrEqual(Math.max(...others, f.min) + 1);
          if (size === 'm') expect(f.h, `${name}: the measured 178 px row`).toBe(178);
        } else {
          expect(f.h!, `${name}: grew past its own size`).toBeLessThanOrEqual(Math.max(f.min, 0) + 1);
          if (size === 'm') expect(f.h, `${name}: the measured 140 px card`).toBe(140);
        }
        // what the card says, per state
        const big = page.locator('[data-building-presence-big]');
        if (ds === 'ready') {
          await expect(big).toHaveText('2/5');
          await expect(big).toHaveAttribute('role', 'img');
          await expect(big).toHaveAttribute('aria-label', '2 מתוך 5 חדרים פעילים');
        }
        if (ds === 'empty') await expect(big).toHaveText('0/5');
        if (ds === 'unknown') await expect(big).toHaveText('–/5');
        if (ds === 'worst') await expect(big).toHaveText('167/500');
        if (size === 's') await expect(page.locator('[data-building-bar]')).toHaveCount(0);
        else await expect(page.locator(`[data-building-bar="${ds === 'worst' ? 'share' : 'ticks'}"]`)).toHaveCount(1);
        if (ds === 'ready' && size !== 's') {
          await expect(page.locator('[data-building-bar] i')).toHaveCount(5);
          await expect(page.locator('[data-building-bar] i[data-t="on"]')).toHaveCount(2);
        }
        if (ds === 'ready') await expect(page.locator('[data-building-rooms] .nm')).toHaveText('⁨אופן ספייס⁩ · ⁨לובי⁩');
        if (ds === 'empty') await expect(page.locator('[data-building-last]')).toContainText('ריק מ־');
        if (size === 'l' && ds === 'ready' && !phone) await expect(page.locator('[data-building-floors]')).toContainText('קרקע');
        if (ds === 'ready' && size === 'm') {
          const ink = await inkCheck(page);
          expect(ink.num, 'the number is not green').not.toBe(ink.green);
          expect(ink.word, 'the word is not green').not.toBe(ink.green);
        }
        await shot(page, name);
      }
      if (SHOTS) fs.writeFileSync(path.join(SHOTS, `fit-${phone ? 'phone' : 'desktop'}-${scheme}.json`), JSON.stringify(report, null, 1));
      expect(errors).toEqual([]);
    });
  }

  test('every skin the picker offers (frozen skins left out; the foundation skins infra and soft in), light and dark: the medium card keeps the row and clips nothing', async ({ page }, info) => {
    const phone = info.project.name === 'mobile';
    const layout = phone ? 'stack' : 'hero';
    const report: Record<string, unknown> = {};
    for (const skin of PICKER_SKINS) {
      for (const scheme of ['light', 'dark'] as Scheme[]) {
        await open(page, scheme, skin);
        for (const ds of ['ready', 'worst'] as const) {
          await mount(page, ds, layout, 'm');
          expect(await page.evaluate(() => document.documentElement.getAttribute('data-skin')), 'the skin in force').toBe(skin);
          const f = await fit(page);
          const name = `${phone ? 'phone' : 'desktop'}-skin-${skin}-${ds}-m-${scheme}`;
          report[name] = f;
          expect(f.clipped, `${name}: content clipped`).toBe(false);
          expect(f.out, `${name}: something leaves the card`).toEqual([]);
          expect(f.sideways, `${name}: sideways scroll`).toBeLessThanOrEqual(1);
          const others = Object.entries(f.heights).filter(([k]) => k !== 'presence').map(([, v]) => v as number);
          expect(f.h!, `${name}: taller than the row`).toBeLessThanOrEqual(phone ? f.min + 1 : Math.max(...others, f.min) + 1);
          if (ds === 'ready') await shot(page, name);
        }
      }
    }
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, `fit-${phone ? 'phone' : 'desktop'}-skins.json`), JSON.stringify(report, null, 1));
  });

  test('the earlier styles stay selectable and an explicit "strip" still draws the strip', async ({ page }) => {
    await open(page, 'light');
    await mount(page, 'ready', page.viewportSize()!.width < 700 ? 'stack' : 'hero', 'm', { card_style: 'strip' });
    await expect(page.locator('.wg-pres.pr-strip')).toHaveCount(1);
    await expect(page.locator('presence-pills')).toHaveCount(1);
    await expect(page.locator('[data-building-bar]')).toHaveCount(0);
  });
});
