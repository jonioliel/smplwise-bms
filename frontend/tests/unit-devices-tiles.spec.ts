import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Owner 2026-09-29 (overview tiles) against the DEMO data (no backend: run the preview with SW_API_PORT pointing at a port
// nothing listens on): a summary tile opens the tiles' panel (items, filter, search, keyboard, deep link, read-only
// reasons), the compact tile layout on a phone, the tree rows, no needless scrolling, no horizontal overflow.
// SW_SHOTS=<dir> also saves screenshots there.
const SHOTS = process.env.SW_SHOTS ?? '';

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

// Failure diagnostics only (no assertion depends on them): the 2.2.0 gate saw this spec fail once on [mobile] and leave
// nothing behind. open() arms a recorder per page; the afterEach below attaches (and prints) it for a failed test only.
const DIAG = new WeakMap<Page, { console: string[]; errors: string[] }>();

async function armDiagnostics(page: Page) {
  const d: { console: string[]; errors: string[] } = { console: [], errors: [] };
  DIAG.set(page, d);
  page.on('console', (m) => {
    if (d.console.length < 200) d.console.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => {
    if (d.errors.length < 50) d.errors.push(String(e.message ?? e).slice(0, 300));
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __swDiag?: { t: number; ev: string; detail?: string }[] };
    if (w.__swDiag) return;
    const log: { t: number; ev: string; detail?: string }[] = (w.__swDiag = []);
    const note = (ev: string, detail?: string) => {
      if (log.length < 400) log.push({ t: Math.round(performance.now()), ev, detail });
    };
    for (const ev of ['panel-changed', 'panel-close', 'panel-filter', 'panel-navigate', 'close', 'open']) {
      document.addEventListener(
        ev,
        (e) => {
          const tag = (e.composedPath()[0] as Element | undefined)?.tagName?.toLowerCase();
          note(ev, `${tag ?? '?'} ${JSON.stringify((e as CustomEvent).detail ?? null).slice(0, 120)}`);
        },
        true,
      );
    }
    window.addEventListener('hashchange', () => note('hashchange', location.hash));
    window.addEventListener('popstate', () => note('popstate', location.hash));
    note('armed', location.hash);
  });
}

async function collectDiagnostics(page: Page) {
  const d = DIAG.get(page);
  const state = await page
    .evaluate(() => {
      const attrs = (el: Element | null | undefined) =>
        el ? Object.fromEntries(Array.from(el.attributes).map((x) => [x.name, x.value.slice(0, 120)])) : null;
      // the panel sits inside shadow roots: search through them
      const deep = (root: ParentNode, sel: string): Element | null => {
        const hit = root.querySelector(sel);
        if (hit) return hit;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const inner = el.shadowRoot ? deep(el.shadowRoot, sel) : null;
          if (inner) return inner;
        }
        return null;
      };
      const panel = deep(document, 'devices-tiles-panel');
      const drawer = panel ? deep(panel.shadowRoot ?? panel, 'sw-drawer') : null;
      const w = window as unknown as { __swDiag?: unknown[] };
      return {
        url: location.href,
        hash: location.hash,
        historyLength: history.length,
        panelAttributes: attrs(panel),
        drawerAttributes: attrs(drawer),
        events: w.__swDiag ?? [],
      };
    })
    .catch((e) => ({ evaluateFailed: String(e).slice(0, 200) }));
  return { ...state, console: d?.console ?? [], pageErrors: d?.errors ?? [] };
}

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  try {
    const diag = await collectDiagnostics(page);
    const json = JSON.stringify(diag, null, 2);
    await testInfo.attach('tiles-panel-diagnostics.json', { body: json, contentType: 'application/json' });
    console.log(`TILES-DIAG [${testInfo.project.name}] ${testInfo.title.slice(0, 60)}: ${JSON.stringify(diag).slice(0, 4000)}`);
  } catch {
    /* diagnostics must never change the verdict */
  }
});

async function open(page: Page, hash: string, tileOverride: 'auto' | 'cards' | 'compact' | null = null) {
  await armDiagnostics(page);
  await page.addInitScript((o) => {
    try {
      localStorage.setItem('sw.devices.layout', 'cards');
      if (o) localStorage.setItem('sw.tiles.override', o);
      else localStorage.removeItem('sw.tiles.override');
    } catch {
      /* storage unavailable */
    }
  }, tileOverride);
  await page.goto('about:blank'); // a second goto that only changes the hash is not a navigation
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(800);
}

/** Whether the element that really holds focus (through shadow roots) is inside `tag`. */
async function focusInside(page: Page, tag: string): Promise<boolean> {
  return page.evaluate((t) => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    let n: Node | null = a;
    while (n) {
      if (n instanceof Element && n.tagName.toLowerCase() === t) return true;
      n = n.parentNode ?? (n instanceof ShadowRoot ? n.host : null);
    }
    return false;
  }, tag);
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
}

test.describe('overview tiles (demo data)', () => {
  test('a tile is a button that opens the panel with its items; filter, search, read-only reason; Escape closes and focus returns', async ({ page }, testInfo) => {
    await open(page, '/devices/building');
    const b = page.locator('devices-building');
    const tile = b.locator('sw-kpi[data-tile-kind="lights"]');
    await expect(tile).toBeVisible();
    const hit = tile.locator('button.hit');
    await expect(hit).toHaveAttribute('aria-expanded', 'false');
    await expect(hit).toHaveAttribute('aria-label', /3\/9 תאורה דולקת/);
    await hit.click();
    const panel = b.locator('devices-tiles-panel');
    await expect(panel).toHaveAttribute('open', '');
    await expect(hit).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building?domain=lights');
    const drawer = panel.locator('sw-drawer');
    await expect(drawer).toHaveAttribute('heading', 'גופי תאורה במבנה');
    await expect(drawer).toHaveAttribute('subheading', /9 גופי תאורה · ‎?3 דולקים · ‎?1 לא זמינים/);
    const rows = panel.locator('.row[data-entity]');
    await expect(rows).toHaveCount(9);
    // grouped floor › area, in the tree's order
    expect(await panel.locator('section.floor').evaluateAll((els) => els.map((e) => e.getAttribute('data-panel-floor')))).toEqual(['ground', 'first']);
    await shot(page, `panel-demo-${testInfo.project.name}`);
    // the segmented filter and the search
    await panel.locator('.seg button[data-filter="active"]').click();
    await expect(rows).toHaveCount(3);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building?domain=lights&filter=active');
    await panel.locator('.seg button[data-filter="unavailable"]').click();
    await expect(rows).toHaveCount(1);
    await panel.locator('.seg button[data-filter="all"]').click();
    await panel.locator('input[data-panel-search]').fill('מטבח');
    await expect(rows).toHaveCount(2); // by area name
    await panel.locator('input[data-panel-search]').fill('אין כזה');
    await expect(panel.locator('sw-state-panel[data-panel-state="no_match"]')).toBeVisible();
    await panel.locator('input[data-panel-search]').fill('');
    // demo rows are read-only and say why, on tap
    const first = rows.first();
    await expect(first.locator('sw-toggle')).toHaveCount(0);
    await first.locator('button[data-readonly]').click();
    await expect(first.locator('[data-readonly-why]')).toContainText('נתוני הדגמה');
    // Escape closes, the address loses the panel, focus is back on the tile
    await page.keyboard.press('Escape');
    await expect(panel).not.toHaveAttribute('open', '');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building');
    await expect(hit).toHaveAttribute('aria-expanded', 'false');
    expect(await focusInside(page, 'sw-kpi')).toBe(true);
  });

  test('focus is trapped in the panel (Tab and Shift+Tab wrap) and the page behind is inert', async ({ page }) => {
    await open(page, '/devices/building');
    const b = page.locator('devices-building');
    await b.locator('sw-kpi[data-tile-kind="covers"] button.hit').click();
    await expect(b.locator('devices-tiles-panel .row[data-entity]')).toHaveCount(4);
    await page.waitForTimeout(200);
    expect(await focusInside(page, 'devices-tiles-panel')).toBe(true);
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      expect(await focusInside(page, 'devices-tiles-panel'), `Tab #${i + 1}`).toBe(true);
    }
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusInside(page, 'devices-tiles-panel'), `Shift+Tab #${i + 1}`).toBe(true);
    }
    // a press on the dimmed backdrop closes it
    await page.mouse.click(10, 10); // the inline end (left in RTL) on a desktop, above the sheet on a phone
    await expect(b.locator('devices-tiles-panel')).not.toHaveAttribute('open', '');
  });

  test('deep link: #/devices/building?domain=covers&floor=first&filter=active opens the panel on that floor', async ({ page }) => {
    await open(page, '/devices/building?domain=covers&floor=first&filter=active');
    const panel = page.locator('devices-building devices-tiles-panel');
    await expect(panel).toHaveAttribute('open', '');
    await expect(panel.locator('sw-drawer')).toHaveAttribute('heading', 'תריסים בקומה קומה 1');
    await expect(panel.locator('.seg button[data-filter="active"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.locator('.row[data-entity]')).toHaveCount(2);
    await expect(panel.locator('.row[data-entity="cover.kitchen"]')).toHaveCount(0);
    // an unknown kind is no panel
    await page.evaluate(() => (location.hash = '#/devices/building?domain=sensors'));
    await expect(panel).not.toHaveAttribute('open', '');
    // the alarm panel: state only, and the way to the alarm screen
    await page.evaluate(() => (location.hash = '#/devices/building?domain=alarm'));
    await expect(panel).toHaveAttribute('open', '');
    await expect(panel.locator('a[data-alarm-link]')).toHaveAttribute('href', '#/security/alarm');
    await expect(panel.locator('.row[data-entity] [data-row-state]')).toHaveText('דרוכה (בית)');
  });

  test('a floor chip (tiles view) opens the panel for that floor', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sw.devices.layout', 'tiles'));
    await page.goto('/?design=a#/devices/building');
    await page.waitForSelector('sw-app');
    const chip = page.locator('devices-building [data-floor-sum="ground"] button[data-floor-chip="lights"]');
    await expect(chip).toBeVisible();
    await chip.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building?domain=lights&floor=ground');
    await expect(page.locator('devices-building devices-tiles-panel .row[data-entity]')).toHaveCount(6);
    await expect(chip).toHaveAttribute('aria-expanded', 'true');
  });

  test('compact tiles: a rectangle 44-80 px tall, two columns at 390 px, the icon at the end of the text (the left in Hebrew); cards above 600 px with auto; an override wins', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    await open(page, '/devices/building');
    const b = page.locator('devices-building');
    await expect(b).toHaveAttribute('data-tile-layout', 'compact');
    const kpis = b.locator('sw-kpi');
    await expect(kpis.first()).toHaveAttribute('layout', 'compact');
    const boxes = await kpis.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: Math.round(r.x), h: r.height, w: r.width })));
    for (const bx of boxes) {
      expect(bx.h).toBeGreaterThanOrEqual(44); // owner notes 2026-09-30: smaller than before, still a whole-tile tap target
      expect(bx.h).toBeLessThanOrEqual(80);
      expect(bx.w).toBeGreaterThanOrEqual(150);
    }
    expect(new Set(boxes.map((bx) => bx.x)).size).toBe(2); // two columns
    // owner notes 2026-09-30: the icon beside the text block, at its END (RTL: the left), not above it
    const side = await kpis.first().evaluate((k) => {
      const icon = k.shadowRoot!.querySelector('.icon')!.getBoundingClientRect();
      const val = k.shadowRoot!.querySelector('.value')!.getBoundingClientRect();
      return { iconRight: icon.right, valLeft: val.left, sameRow: Math.abs(icon.top + icon.height / 2 - (val.top + val.height / 2)) < 14 };
    });
    expect(side.iconRight).toBeLessThanOrEqual(side.valLeft + 1);
    expect(side.sameRow).toBe(true);
    // numbers in tabular figures
    expect(await kpis.first().evaluate((k) => getComputedStyle(k.shadowRoot!.querySelector('.value')!).fontVariantNumeric)).toContain('tabular-nums');
    await noHorizontalOverflow(page);
    await shot(page, 'building-compact-390');
    // Live overview: the same shape, links
    await page.goto('/?design=a#/live');
    await page.waitForSelector('live-overview');
    const lv = page.locator('live-overview sw-kpi');
    await expect(lv.first()).toHaveAttribute('layout', 'compact');
    const lb = await lv.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: Math.round(r.x), h: r.height })));
    expect(new Set(lb.map((x) => x.x)).size).toBe(2);
    for (const x of lb) expect(x.h).toBeLessThanOrEqual(80);
    await expect(page.locator('live-overview sw-kpi[data-overview-tile="cameras"] a.hit')).toHaveAttribute('href', '#/system/devices?sort=offline');
    await expect(page.locator('live-overview sw-kpi[data-overview-tile="health"] a.hit')).toHaveAttribute('href', '#/system/diagnostics?tab=health');
    await noHorizontalOverflow(page);
    await shot(page, 'live-compact-390');
    // this browser's own override: cards
    await page.evaluate(() => localStorage.setItem('sw.tiles.override', 'cards'));
    await page.goto('/?design=a#/devices/building');
    await page.waitForSelector('devices-building sw-kpi');
    await expect(page.locator('devices-building')).toHaveAttribute('data-tile-layout', 'cards');
    const tall = await page.locator('devices-building sw-kpi').first().evaluate((e) => e.getBoundingClientRect().height);
    expect(tall).toBeGreaterThan(90);
    await shot(page, 'building-cards-390');
  });

  test('desktop: the home screen\'s summary tiles are small rectangles by default (auto), tall cards only on an explicit choice; the Live tiles link to their screens', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    await open(page, '/devices/building');
    // owner notes 2026-09-30: the installation's "auto" (cards on a desktop) no longer makes this screen's tiles tall
    await expect(page.locator('devices-building')).toHaveAttribute('data-tile-layout', 'cards');
    const first = page.locator('devices-building sw-kpi').first();
    await expect(first).toHaveAttribute('layout', 'compact');
    await expect(first).toHaveAttribute('icon-end', '');
    expect(await first.evaluate((e) => e.getBoundingClientRect().height)).toBeLessThanOrEqual(64);
    await shot(page, 'building-compact-auto-desktop');
    await open(page, '/devices/building', 'cards');
    await expect(page.locator('devices-building sw-kpi').first()).toHaveAttribute('layout', 'cards');
    expect(await page.locator('devices-building sw-kpi').first().evaluate((e) => e.getBoundingClientRect().height)).toBeGreaterThan(90);
    await shot(page, 'building-cards-desktop');
    await open(page, '/devices/building', 'compact');
    const kpis = page.locator('devices-building sw-kpi');
    await expect(kpis.first()).toHaveAttribute('layout', 'compact');
    for (const h of await kpis.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeLessThanOrEqual(80);
    await shot(page, 'building-compact-desktop');
    await page.goto('/?design=a#/live');
    await page.waitForSelector('live-overview sw-kpi');
    await page.locator('live-overview sw-kpi[data-overview-tile="sites"] a.hit').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/explore/sites');
  });

  test('the building tree: names take the row, counts line up in one column; no needless scrolling at 1920x1080', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop sizes');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await open(page, '/devices/building');
    const tree = page.locator('devices-building nav.tree');
    await expect(tree).toBeVisible();
    // every lit-count column ends at the same inline edge, and no name is cut while the row has room
    const cols = await tree.locator('.tree-row .lit').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(cols.filter((_, i) => i > 0)).size).toBeLessThanOrEqual(2); // area rows vs floor / building rows (same column)
    for (const cut of await tree.locator('.tree-row .nm').evaluateAll((els) => els.map((e) => e.scrollWidth > e.clientWidth + 1))) expect(cut).toBe(false);
    // exactly one scroll container, and nothing scrolls when the content fits
    const facts = await page.evaluate(() => {
      const se = document.scrollingElement!;
      const scrollers: string[] = [];
      const walk = (root: Document | ShadowRoot) => {
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const cs = getComputedStyle(el);
          if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) scrollers.push(el.tagName.toLowerCase());
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      return { page: se.scrollHeight <= se.clientHeight, scrollers };
    });
    expect(facts.page).toBe(true);
    expect(facts.scrollers).toEqual([]);
    await shot(page, 'tree-1920');
  });

  test('no horizontal overflow with the panel open (desktop + phone)', async ({ page }, testInfo) => {
    await open(page, '/devices/building?domain=switches');
    await expect(page.locator('devices-building devices-tiles-panel .row[data-entity]')).toHaveCount(3);
    await noHorizontalOverflow(page);
    const dlg = await page.locator('devices-building devices-tiles-panel sw-drawer').evaluate((d) => {
      const el = d.shadowRoot!.querySelector('dialog')!;
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, bottom: r.bottom, sw: el.scrollWidth, cw: el.clientWidth };
    });
    expect(dlg.sw).toBeLessThanOrEqual(dlg.cw);
    if (testInfo.project.name === 'mobile') expect(Math.round(dlg.bottom)).toBe(page.viewportSize()!.height); // a bottom sheet
    // the dark device scheme keeps the panel readable (solid surface, light text)
    await page.locator('devices-building').evaluate((h) => {
      h.setAttribute('data-devices-style', 'glass');
      h.setAttribute('data-devices-scheme', 'dark');
    });
    const colours = await page.locator('devices-building devices-tiles-panel sw-drawer').evaluate((d) => {
      const el = d.shadowRoot!.querySelector('dialog')!;
      return { bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color };
    });
    expect(colours.bg).toBe('rgb(28, 28, 30)');
    expect(colours.fg).toBe('rgb(245, 245, 247)');
    await shot(page, `panel-dark-${testInfo.project.name}`);
  });
});

test.describe('owner answers 2026-09-29 (demo data)', () => {
  test('floor cards carry the domain chips (icon + count, words in the tooltip); a chip opens the panel for that floor', async ({ page }) => {
    await open(page, '/devices/building');
    const chips = page.locator('devices-building [data-floor-chips="ground"]');
    await expect(chips).toBeVisible();
    // lights stay the card's own lit count; the chips are the other domains present on the floor
    expect(await chips.locator('button[data-floor-chip]').evaluateAll((els) => els.map((e) => e.getAttribute('data-floor-chip')))).toEqual(['switches', 'covers', 'climate', 'media', 'locks']);
    const sw = chips.locator('button[data-floor-chip="switches"]');
    await expect(sw).toHaveText(/^\s*1\/2\s*$/);
    await expect(sw).toHaveAttribute('title', /מתגים/);
    await sw.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building?domain=switches&floor=ground');
    await expect(page.locator('devices-building devices-tiles-panel .row[data-entity]')).toHaveCount(2);
  });

  test('the Live cameras tile opens the FULL camera list with the offline cameras first, marked "מנותקת"', async ({ page }) => {
    await open(page, '/system/devices?sort=offline');
    const states = await page.locator('system-devices [data-cam-state]').evaluateAll((els) => els.map((e) => e.getAttribute('data-cam-state')));
    expect(states.length).toBeGreaterThan(1);
    const offline = states.filter((s) => s === 'offline').length;
    expect(offline).toBeGreaterThan(0);
    expect(states.slice(0, offline).every((s) => s === 'offline')).toBe(true); // offline first
    expect(states.slice(offline).some((s) => s !== 'offline')).toBe(true); // and not filtered to them
    await expect(page.locator('system-devices [data-cam-state="offline"]').first()).toContainText('מנותקת');
  });
});
test.describe('review fixes (demo data)', () => {
  test('M1: Back closes the panel (its own history entry) and stays on the building screen; a filter adds no entry', async ({ page }) => {
    await open(page, '/devices/building');
    const b = page.locator('devices-building');
    const before = await page.evaluate(() => history.length);
    await b.locator('sw-kpi[data-tile-kind="switches"] button.hit').click();
    await expect(b.locator('devices-tiles-panel')).toHaveAttribute('open', '');
    await b.locator('devices-tiles-panel .seg button[data-filter="active"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building?domain=switches&filter=active');
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
    await page.goBack();
    await expect(b.locator('devices-tiles-panel')).not.toHaveAttribute('open', '');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building');
    await expect(b.locator('sw-kpi').first()).toBeVisible();
    // closing with Escape goes back over the same entry: a second Back leaves nothing of the panel behind
    await b.locator('sw-kpi[data-tile-kind="switches"] button.hit').click();
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building');
    await page.goForward();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building?domain=switches');
    await expect(b.locator('devices-tiles-panel')).toHaveAttribute('open', '');
  });

  test('M2 / M3 / M6: the page behind does not scroll while the panel is open; a drag ending outside never closes it; no empty footer bar', async ({ page }) => {
    await open(page, '/devices/building?domain=lights');
    const panel = page.locator('devices-building devices-tiles-panel');
    await expect(panel).toHaveAttribute('open', '');
    const mainOverflow = () => page.evaluate(() => (document.querySelector('sw-app')!.shadowRoot!.querySelector('main') as HTMLElement).style.overflow);
    expect(await mainOverflow()).toBe('hidden');
    // the drawer's footer is not drawn when nothing is slotted into it
    expect(await panel.locator('sw-drawer').evaluate((d) => d.shadowRoot!.querySelector('footer')!.hidden)).toBe(true);
    // a press inside the panel, dragged out and released over the backdrop, keeps it open
    const row = panel.locator('.row[data-entity]').first();
    const box = (await row.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(5, 5, { steps: 5 });
    await page.mouse.up();
    await expect(panel).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(panel).not.toHaveAttribute('open', '');
    expect(await mainOverflow()).toBe('');
  });

  test('M6: on a phone the Live events tile keeps its value and label together - the badge rides the corner', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    await open(page, '/live');
    const ev = page.locator('live-overview sw-kpi[data-overview-tile="events"]');
    await expect(ev).toHaveAttribute('layout', 'compact');
    const g = await ev.evaluate((k) => {
      const q = (s: string) => k.shadowRoot!.querySelector(s)!.getBoundingClientRect();
      const v = q('.value');
      const l = q('.label');
      const b = q('.badge');
      const line = q('.line');
      const overlap = !(b.right <= line.left || b.left >= line.right || b.bottom <= line.top || b.top >= line.bottom);
      return { sameLine: Math.abs(v.top - l.top) < 8, overlap, h: k.getBoundingClientRect().height };
    });
    expect(g.sameLine).toBe(true);
    expect(g.overlap).toBe(false);
    expect(g.h).toBeLessThanOrEqual(80);
    // every compact tile of the row equally tall
    const hs = await page.locator('live-overview sw-kpi').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(new Set(hs).size).toBe(1);
  });
});
