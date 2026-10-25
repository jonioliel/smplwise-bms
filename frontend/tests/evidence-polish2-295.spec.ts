import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// POLISH2-295 (owner feedback 2026-10-25 on the POLISH-295 screens), in demo mode (no backend answers):
//  1. the automations list keeps the cards with their explanatory sentence as a choice beside the rows - a view switch where the
//     schedules keep theirs, this browser's choice remembered the same way (localStorage, JSON), the installation's default
//     `ui.automations_view` (rows unless changed; the demo reads it from `?auto_view=`) when this browser has not chosen;
//  2. the home screen's media card is as tall as its content: the counts inline, the chips on the same row, no chips row when nothing is on.
// Light and dark, desktop and phone.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-polish2-295.spec.ts --project=desktop --project=mobile
// Screenshots: docs/design/evidence/POLISH2-295/.

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/POLISH2-295');
type Info = { project: { name: string } };
const phone = (info: Info) => info.project.name === 'mobile';

async function shot(page: Page, name: string, info: Info) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}

const clocked = new WeakSet<Page>();
async function openDemo(page: Page, query: string, hash: string, init: Record<string, string> = {}) {
  await page.route('**/api/v1/**', (route) => route.abort()); // demo mode whatever runs on the preview's proxy target
  if (!clocked.has(page)) {
    clocked.add(page);
    await page.clock.install({ time: new Date('2026-10-23T09:00:00Z') });
  }
  await page.addInitScript((kv) => {
    try {
      for (const [k, v] of Object.entries(kv)) if (!localStorage.getItem(k)) localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  }, init);
  await page.goto('about:blank');
  await page.goto(`/?design=a&fit=off${query}#${hash}`);
  await page.waitForSelector('sw-app');
}

const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const dark = async (page: Page) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
};

test.describe('automations: rows or the cards with their sentence', () => {
  test('rows by default; the switch shows the cards with the sentence; the choice is remembered in this browser', async ({ page }, info) => {
    await openDemo(page, '', '/devices/automations');
    const a = page.locator('sw-app devices-automations');
    // a desktop has the schedules' segmented switch (rows · cards) at the end of the title row; a phone one icon button in the toolbar
    // row that names the other view (no extra header row)
    const views = a.locator('[data-auto-views]');
    const btn = (v: 'rows' | 'cards') => a.locator(`[data-view-btn="${v}"]`);
    const pressed = async (v: 'rows' | 'cards') => {
      if (phone(info)) await expect(btn(v === 'rows' ? 'cards' : 'rows')).toBeVisible();
      else await expect(btn(v)).toHaveAttribute('aria-pressed', 'true');
    };
    await expect(views).toBeVisible();
    await pressed('rows');
    await expect(a.locator('[data-auto-rows] automation-row').first()).toBeVisible();
    await expect(a.locator('automation-card')).toHaveCount(0);
    // no scrolling: 12 rows on the desktop, 7 on the phone (POLISH2-295: 9 scrolled the phone by 81 px)
    await expect(a.locator('[data-auto-rows] automation-row')).toHaveCount(phone(info) ? 7 : 12);
    expect(await a.evaluate((el) => el.scrollHeight - el.clientHeight), 'rows: no scrolling').toBeLessThanOrEqual(1);
    if (phone(info)) {
      // the toggle shares the toolbar row with the search (the header is no taller than without it)
      const t = (await views.boundingBox())!;
      const q = (await a.locator('.dh-det .search').boundingBox())!;
      expect(Math.abs(t.y - q.y)).toBeLessThanOrEqual(2);
    }
    await shot(page, 'automations-rows-light', info);

    await btn('cards').click();
    await pressed('cards');
    await expect(a.locator('automation-row')).toHaveCount(0);
    const card = a.locator('automation-card', { hasText: 'תנועה בפרוזדור' });
    await expect(card.locator('[data-card-sentence]')).toContainText('תנועה');
    expect(await page.evaluate(() => localStorage.getItem('sw.automations.view'))).toBe('"cards"');
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    // the cards have their own page size (6 on the desktop: two rows of three; 1 on the phone): no scrolling either
    await expect(a.locator('automation-card')).toHaveCount(phone(info) ? 1 : 6);
    await expect(a.locator('[data-auto-pager] sw-pager')).toBeVisible();
    expect(await a.evaluate((el) => el.scrollHeight - el.clientHeight), 'cards: no scrolling').toBeLessThanOrEqual(1);
    await shot(page, 'automations-cards-light', info);

    // the choice survives a reload (the same browser)
    await page.reload();
    await page.waitForSelector('sw-app');
    await expect(a.locator('automation-card').first()).toBeVisible();
    await pressed('cards');
    await dark(page);
    await shot(page, 'automations-cards-dark', info);

    await btn('rows').click();
    await expect(a.locator('[data-auto-rows] automation-row').first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('sw.automations.view'))).toBe('"rows"');
    await shot(page, 'automations-rows-dark', info);
  });

  test('without a choice in this browser the installation default (ui.automations_view) decides; a choice beats it', async ({ page }, info) => {
    await openDemo(page, '&auto_view=cards', '/devices/automations');
    const a = page.locator('sw-app devices-automations');
    await expect(a.locator('automation-card').first()).toBeVisible();
    if (phone(info)) await expect(a.locator('[data-view-btn="rows"]')).toBeVisible();
    else await expect(a.locator('[data-view-btn="cards"]')).toHaveAttribute('aria-pressed', 'true');
    // the first POLISH-295 build stored the choice raw: still read
    await openDemo(page, '&auto_view=cards', '/devices/automations', { 'sw.automations.view': 'rows' });
    await expect(a.locator('[data-auto-rows] automation-row').first()).toBeVisible();
    await expect(a.locator('automation-card')).toHaveCount(0);
  });

  test('the switch is the automations list\'s only: the scenes and the scripts have none', async ({ page }) => {
    await openDemo(page, '', '/devices/automations/scenes');
    const a = page.locator('sw-app devices-automations');
    await expect(a.locator('[data-scenes-panel], [data-auto-state]').first()).toBeVisible();
    await expect(a.locator('[data-auto-views]')).toHaveCount(0);
  });
});

// POLISH2-295 (owner: the dark choice buttons were hard to read): every choice button on the touched screens, dark scheme - the label at
// least 4.5:1 on its own background, chosen or not, and a chosen segment at least 3:1 from its track (WCAG 1.4.3 / 1.4.11). Backgrounds are
// composited through every ancestor (shadow hosts included); the glass blur is ignored (it only averages what is already counted).
async function choiceContrast(page: Page) {
  return page.evaluate(() => {
    type C = { r: number; g: number; b: number; a: number };
    const parse = (s: string): C | null => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const over = (t: C, b: C): C => {
      const a = t.a + b.a * (1 - t.a);
      const mix = (x: number, y: number) => (x * t.a + y * b.a * (1 - t.a)) / a;
      return { r: mix(t.r, b.r), g: mix(t.g, b.g), b: mix(t.b, b.b), a };
    };
    const lum = (c: C) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (x: C, y: C) => {
      const [a, b] = [lum(x), lum(y)];
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const up = (el: Element): Element | null => el.parentElement ?? ((el.parentNode as ShadowRoot | null)?.host ?? null);
    const bgOf = (el: Element): C => {
      const chain: Element[] = [];
      for (let e: Element | null = el; e; e = up(e)) chain.push(e);
      let c: C = { r: 0, g: 0, b: 0, a: 1 };
      for (const e of chain.reverse()) {
        const x = parse(getComputedStyle(e).backgroundColor);
        if (x && x.a > 0) c = over(x, c);
      }
      return c;
    };
    const found: Element[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
        if (el.matches('.seg button, .views button, button.vtog, .rc[aria-pressed]')) found.push(el);
      }
    };
    walk(document);
    return found
      .filter((el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden')
      .map((el) => {
        const chosen = ['aria-pressed', 'aria-checked', 'aria-selected'].some((a) => el.getAttribute(a) === 'true');
        const bg = bgOf(el);
        const fg = over(parse(getComputedStyle(el).color)!, bg);
        return { what: `${(el.getRootNode() as ShadowRoot).host?.tagName.toLowerCase() ?? 'doc'} .${el.parentElement?.className ?? ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 16)}"`, chosen, text: ratio(fg, bg), track: ratio(bg, bgOf(up(el)!)) };
      });
  });
}

test.describe('dark scheme: the choice buttons are legible', () => {
  for (const [name, hash] of [['automations', '/devices/automations'], ['schedules', '/devices/schedules'], ['settings-automations', '/system/automations'], ['settings-schedules', '/system/schedules']] as const) {
    test(`${name}: every label 4.5:1, a chosen segment 3:1 from its track`, async ({ page }, info) => {
      await openDemo(page, '', hash, { 'sw.demo.automations': JSON.stringify({ scheme: 'dark' }), 'sw.demo.schedules': JSON.stringify({ persona: 'admin' }) });
      await dark(page);
      await page.waitForTimeout(800);
      const all = await choiceContrast(page);
      expect(all.length, 'choice buttons found').toBeGreaterThan(0);
      expect(all.some((x) => x.chosen), 'a chosen one').toBe(true);
      for (const x of all) {
        expect(x.text, `label ${x.what} chosen=${x.chosen}`).toBeGreaterThanOrEqual(4.5);
        if (x.chosen) expect(x.track, `chosen ${x.what} vs its track`).toBeGreaterThanOrEqual(3);
      }
      await shot(page, `choices-dark-${name}`, info);
    });
  }
});
test.describe('home: the media card is as tall as its content', () => {
  test('one header line and one row (the counts inline, the chips beside them); consistent light and dark', async ({ page }, info) => {
    await openDemo(page, '', '/devices/building', { 'sw.devices.layout': 'tiles' });
    const b = page.locator('sw-app devices-building');
    await b.locator('sw-kpi').first().waitFor();
    const card = b.locator('home-widgets [data-home-widget="media"]');
    await expect(card).toBeVisible();
    const row = card.locator('[data-home-media-row]');
    await expect(row).toBeVisible();
    const box = (await card.boundingBox())!;
    // before: 150 px on a desktop, ~230 px on a phone (the counts stacked over a wrapped chips block)
    expect(box.height, 'media card height').toBeLessThanOrEqual(phone(info) ? 140 : 100);
    const count = (await card.locator('[data-home-media-count]').boundingBox())!;
    const chips = card.locator('[data-home-media-chips]');
    if (await chips.count()) {
      const c = (await chips.boundingBox())!;
      // the chips are one row (never wrapped onto a second chips line)
      expect(c.height).toBeLessThanOrEqual(40);
      // desktop: the chips share the counts' row
      if (!phone(info)) expect(Math.abs(c.y + c.height / 2 - (count.y + count.height / 2))).toBeLessThanOrEqual(12);
    }
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await shot(page, 'home-media-light', info);
    await dark(page);
    await shot(page, 'home-media-dark', info);
  });
});
