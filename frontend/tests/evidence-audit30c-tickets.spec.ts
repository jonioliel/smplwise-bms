import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { installTicketsMock, url } from './tickets-mocks';
import { installBoardMock, type BoardMockOptions } from './tickets-board-mocks';
import { settlePage } from './pixel-settle';

// AUDIT30-C-TICKETS (design audit round 30, branch C: the service-management screens). One regression check per fix, against the real
// build and the existing mock layers (fake data):
//   #3  dark: the chosen settings tab and the chosen segment key (the name's gender) read >= 4.5:1;
//   #4  a chosen chip is the Blue Wash pair (--sw-accent-soft behind --sw-accent-text), never the black / filled key;
//   #6  board, list, overview, quotes and handlers are framed by ONE sw-page and draw no <h1> of their own;
//   #9  phone board: the state strip is in the "סינון" sheet, not a row above the cards;
//   #14 the board tree rows: the small radius, 36 px, the chosen row in the Blue Wash pair;
//   #16 / #18 the settings page: sw-page + the sw-tabs underline row, fields in the sw-field look, a save key only when something changed;
//   #17 the board's group heading is a step below the page title (--sw-fs-xl);
//   #5  (C9) the board and "my requests" do not scroll the page at 1366x768 (paged by NOSCROLL-1366-2437, kept).
// Pixels: "pixel-stable" in the title (the gate's pixel group); Linux baselines generated on the runner with --update-snapshots, on an OS
// without a baseline the comparison is skipped, not failed.
//   run_smart.py preview pilot/AUDIT30-C-TICKETS tests/evidence-audit30c-tickets.spec.ts --project=desktop --project=mobile --workers=1

const B = 'sw-app tickets-board';
const L = 'sw-app tickets-list';
const S = 'sw-app system-tickets';
const NOW = Date.parse('2026-10-13T10:42:00Z');
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;

async function board(page: Page, o: BoardMockOptions = {}, scheme: 'light' | 'dark' = 'light', hash = '/tickets/board') {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installBoardMock(page, o);
  await page.clock.setFixedTime(NOW);
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
}

async function tickets(page: Page, hash: string, scheme: 'light' | 'dark' = 'light') {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await installTicketsMock(page, { persona: 'admin' });
  await page.clock.setFixedTime(NOW);
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
}

/** The element's own background / text colour and the colour a token resolves to in the same tree (as an rgb() string). */
async function colours(page: Page, selector: string, token: string, inkToken: string) {
  return page.locator(selector).first().evaluate((el, [tok, ink]) => {
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;background:var(${tok});color:var(${ink})`;
    el.parentNode!.appendChild(probe);
    const want = { bg: getComputedStyle(probe).backgroundColor, fg: getComputedStyle(probe).color };
    probe.remove();
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, fg: cs.color, want };
  }, [token, inkToken] as const);
}

/** WCAG contrast of an element's text against the background it is painted on (the first opaque-ish ancestor chain, shadow roots crossed). */
async function contrast(page: Page, selector: string): Promise<number[]> {
  return page.locator(selector).evaluateAll((els) => {
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
    const up = (el: Element): Element | null => el.parentElement ?? ((el.parentNode as ShadowRoot | null)?.host ?? null);
    const dark = document.documentElement.getAttribute('data-theme') === 'dark' || matchMedia('(prefers-color-scheme: dark)').matches;
    return els.map((el) => {
      const chain: Element[] = [];
      for (let e: Element | null = el; e; e = up(e)) chain.push(e);
      let bg: C = dark ? { r: 13, g: 18, b: 32, a: 1 } : { r: 245, g: 247, b: 251, a: 1 };
      for (const e of chain.reverse()) {
        const x = parse(getComputedStyle(e).backgroundColor);
        if (x && x.a > 0) bg = over(x, bg);
      }
      const fg = over(parse(getComputedStyle(el).color)!, bg);
      const [a, b] = [lum(fg), lum(bg)];
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  });
}

/** A length token as the element's own tree resolves it (the glass host bridges the radius scale: --sw-r-sm is 14 px there). */
async function lengthToken(page: Page, selector: string, token: string): Promise<number> {
  return page.locator(selector).first().evaluate((el, tok) => {
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;border-top-left-radius:var(${tok})`;
    el.parentNode!.appendChild(probe);
    const v = parseFloat(getComputedStyle(probe).borderTopLeftRadius);
    probe.remove();
    return v;
  }, token);
}

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(page: Page, name: string) {
  const info = test.info();
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 60, animations: 'disabled', timeout: 20_000 }); // a loaded runner needs more than 5 s for two equal frames
}

test.describe('AUDIT30-C-TICKETS', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  test('#6: board, list, overview, quotes and handlers are framed by one sw-page, with no <h1> of their own', async ({ page }) => {
    const cases: [hash: string, host: string, ready: string][] = [
      ['/tickets/board', 'tickets-board', 'ticket-card'],
      ['/tickets/mine', 'tickets-list', 'ticket-card'],
      ['/tickets/overview', 'tickets-overview', '[data-overview-header]'],
      ['/tickets/rfqs', 'tickets-rfqs', '[data-rfq-header]'],
      ['/tickets/handlers', 'tickets-handlers', '[data-tickets-header]'],
    ];
    for (const [hash, host, ready] of cases) {
      await board(page, {}, 'light', hash);
      await page.waitForSelector(`sw-app ${host} ${ready}`, { timeout: 20_000 });
      const r = await page.locator(`sw-app ${host}`).evaluate((h) => ({
        pages: h.shadowRoot!.querySelectorAll('sw-page').length,
        ownH1: h.shadowRoot!.querySelectorAll('h1').length,
        heading: h.shadowRoot!.querySelector('sw-page')?.getAttribute('heading') ?? '',
        frameH1: h.shadowRoot!.querySelector('sw-page')?.shadowRoot?.querySelectorAll('h1').length ?? 0,
      }));
      expect(r, hash).toMatchObject({ pages: 1, ownH1: 0, frameH1: 1 });
      expect(r.heading.length, `${hash}: the frame's title`).toBeGreaterThan(0);
    }
  });

  test('#4: a chosen chip is the Blue Wash pair, never the black key (board floor chips, list filter state)', async ({ page }) => {
    await board(page, { board: { board_floors: 'chips' } });
    await page.waitForSelector(`${B} [data-floor-chips] .rc[aria-pressed="true"]`);
    const c = await colours(page, `${B} [data-floor-chips] .rc[aria-pressed="true"]`, '--sw-accent-soft', '--sw-accent-text');
    expect(c.bg).toBe(c.want.bg);
    expect(c.fg).toBe(c.want.fg);
    await tickets(page, '/tickets/mine');
    await page.waitForSelector(`${L} ticket-card`);
    await page.locator(`${L} [data-filter-toggle]`).click();
    const sel = `${L} [data-filter-panel] .fchips .rc[aria-checked="true"]`;
    await page.waitForSelector(sel);
    const s = await colours(page, sel, '--sw-accent-soft', '--sw-accent-text');
    expect(s.bg).toBe(s.want.bg);
    expect(s.fg).toBe(s.want.fg);
    for (const k of await contrast(page, sel)) expect(k).toBeGreaterThanOrEqual(4.5);
  });

  test('#14: the board tree rows - small radius, 36 px, the chosen row in the Blue Wash pair', async ({ page }) => {
    test.skip(isPhone(page), 'the tree is never drawn on a phone');
    await board(page);
    const row = `${B} ticket-board-tree .row[aria-pressed="true"]`;
    await page.waitForSelector(row);
    const g = await page.locator(row).first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { radius: parseFloat(cs.borderTopLeftRadius), h: el.getBoundingClientRect().height };
    });
    expect(g.radius, 'row radius = --sw-r-sm').toBe(await lengthToken(page, row, '--sw-r-sm'));
    expect(g.radius, 'row radius (was --sw-r-lg, 28 px)').toBeLessThan(28);
    expect(Math.round(g.h)).toBe(36);
    const c = await colours(page, row, '--sw-accent-soft', '--sw-accent-text');
    expect(c.bg).toBe(c.want.bg);
    expect(c.fg).toBe(c.want.fg);
  });

  test('#17: the board group heading is a step below the page title', async ({ page }) => {
    await board(page);
    await page.waitForSelector(`${B} [data-section] .sh h2`);
    const h2 = await page.locator(`${B} [data-section] .sh h2`).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const h1 = await page.locator(`${B} sw-page`).evaluate((p) => parseFloat(getComputedStyle(p.shadowRoot!.querySelector('h1')!).fontSize));
    const xl = await page.locator(`${B} sw-page`).evaluate((p) => {
      const probe = document.createElement('span');
      probe.style.fontSize = 'var(--sw-fs-xl)';
      p.appendChild(probe);
      const v = parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();
      return v;
    });
    expect(h2).toBe(xl);
    // the phone title is --sw-h1-phone (a smaller step); the desktop title 30 px
    expect(h1 - h2, 'heading step').toBeGreaterThanOrEqual(isPhone(page) ? 2 : 6);
  });

  test('#9: on a phone the board state strip is in the filter sheet, not a row above the cards', async ({ page }) => {
    test.skip(!isPhone(page), 'phone only');
    await board(page);
    await page.waitForSelector(`${B} ticket-card`);
    await expect(page.locator(`${B} [data-toolbar] > [data-state-strip]`)).toHaveCount(0);
    // the frame's actions (view switch, "+") stay inside the screen; the board / handlers switch is its own row under the title
    const vw = page.viewportSize()!.width;
    for (const sel of [`${B} [data-new]`, `${B} .vsw`, `${B} [data-board-pane]`]) {
      const box = (await page.locator(sel).first().boundingBox())!;
      expect(box.x, `${sel} left edge`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${sel} right edge`).toBeLessThanOrEqual(vw);
    }
    await page.locator(`${B} [data-filter-toggle]`).click();
    await expect(page.locator(`${B} [data-filter-panel] [data-state-strip] [data-state="all"]`)).toBeVisible();
    await page.locator(`${B} [data-filter-panel] [data-state="stuck"]`).click();
    await expect(page).toHaveURL(/state=stuck/);
  });

  test('#3 / #18: dark settings - the chosen tab and the chosen gender key read >= 4.5:1; the tabs are the sw-tabs underline row', async ({ page }) => {
    await tickets(page, '/system/tickets', 'dark');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.waitForSelector(`${S} [data-name-editor]`);
    await expect(page.locator(`${S} sw-page[heading]`)).toHaveCount(1);
    await expect(page.locator(`${S} sw-tabs[data-tickets-settings-tabs]`)).toHaveAttribute('variant', 'underline');
    for (const k of await contrast(page, `${S} sw-tabs[data-tickets-settings-tabs] [role="tab"][aria-selected="true"]`)) expect(k, 'chosen tab').toBeGreaterThanOrEqual(4.5);
    const gender = `${S} [data-name-gender][aria-checked="true"]`;
    if (await page.locator(gender).count()) {
      for (const k of await contrast(page, gender)) expect(k, 'chosen gender').toBeGreaterThanOrEqual(4.5);
      const c = await colours(page, gender, '--sw-accent-soft', '--sw-accent-text');
      expect(c.bg).toBe(c.want.bg);
    }
  });

  test('#16: settings fields are the sw-field look; a card shows its save key only after a change', async ({ page }) => {
    await tickets(page, '/system/tickets');
    await page.waitForSelector(`${S} [data-card="links"]`);
    const f = await page.locator(`${S} input.in`).first().evaluate((el) => ({ radius: parseFloat(getComputedStyle(el).borderTopLeftRadius), h: el.getBoundingClientRect().height }));
    expect(f.radius, 'field radius = --sw-r-sm').toBe(await lengthToken(page, `${S} input.in`, '--sw-r-sm'));
    expect(f.radius, 'field radius (was 999 px)').toBeLessThan(28);
    if (!isPhone(page)) expect(f.h, 'field height (was 44 px)').toBeLessThanOrEqual(38);
    const save = page.locator(`${S} sw-button[data-inst-links-save]`);
    await expect(save).toBeHidden();
    const field = page.locator(`${S} [data-card="links"] input.in`).first();
    const v = await field.inputValue();
    await field.fill(String(Number(v || '0') + 1));
    await expect(save).toBeVisible();
  });

  test('#5 (C9): the board and "my requests" do not scroll the page at 1366x768', async ({ page }) => {
    test.skip(isPhone(page), 'desktop only');
    await page.setViewportSize({ width: 1366, height: 768 });
    for (const [hash, host] of [['/tickets/board', 'tickets-board'], ['/tickets/mine', 'tickets-list']] as const) {
      await board(page, {}, 'light', hash);
      await page.waitForSelector(`sw-app ${host} ticket-card`);
      await page.waitForTimeout(600);
      const over = await page.evaluate((h) => {
        const els: Element[] = [document.documentElement];
        const app = document.querySelector('sw-app');
        const main = app?.shadowRoot?.querySelector('main');
        if (main) els.push(main);
        const scr = main?.querySelector(h) ?? app?.shadowRoot?.querySelector(h) ?? document.querySelector(`sw-app ${h}`);
        if (scr) els.push(scr);
        return els.map((e) => e.scrollHeight - e.clientHeight);
      }, host);
      for (const o of over) expect(o, `${hash}: page scroll`).toBeLessThanOrEqual(1);
    }
  });

  test('classic is pixel-stable: the board (light and dark)', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await board(page, {}, scheme);
      if (scheme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.waitForSelector(`${B} ticket-card`);
      await settlePage(page);
      await compare(page, `audit30c-board-${scheme}`);
    }
  });

  test('classic is pixel-stable: the settings page (light and dark)', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await tickets(page, '/system/tickets', scheme);
      if (scheme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.waitForSelector(`${S} [data-card="links"]`);
      await settlePage(page);
      await compare(page, `audit30c-settings-${scheme}`);
    }
  });
});
