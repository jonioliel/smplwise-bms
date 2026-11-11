import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockP3, P3_PERMS, type P3Opts } from './home-v3p3-mocks';

// HOME-V3-P3-2432: phase 3 of the home interface (mockup v3, round 27) - music and screens, the TV remote, play in more rooms, the
// announcement sheet, the electricity bill, water, the house systems (view only) and the home map. Mocked backend
// (tests/home-v3p3-mocks.ts on top of tests/home-simple-mocks.ts); nothing is sent anywhere. Screenshots: test-results/home-v3-p3/.

const SIZES = [{ id: 'tablet', width: 1280, height: 800 }, { id: 'tablet1024', width: 1024, height: 768 }, { id: 'phone', width: 390, height: 844 }];
const SCREENS = ['media', 'bills', 'water', 'systems', 'map'];
const FORBIDDEN = ['Home Assistant', 'go2rtc', 'NVR', 'WebRTC', 'entity', 'ישות', 'Music Assistant', 'Sonos', 'undefined', 'NaN'];
const SHOTS = 'test-results/home-v3-p3';
const THEMES = ['classic', 'ocean', 'sand', 'plum', 'midnight', 'nordic', 'pastel'];

const inHome = (page: Page) => page.locator('sw-home');

async function open(page: Page, route: string, o: P3Opts = {}) {
  const mock = await mockP3(page, o);
  await page.goto('about:blank'); // a second open in one test must reload (a hash-only change keeps the old page and its data)
  await page.goto(`/#/home/${route}`);
  await page.locator('sw-home').waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await settle(page);
  // phase 3 reads load after the rooms: wait until the controller has them (the screen draws its real state, not the first frame)
  await expect.poll(() => page.evaluate(() => (document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home') as unknown as { p3?: { loaded?: boolean } }).p3?.loaded === true)).toBe(true);
  await settle(page);
  return mock;
}

async function go(page: Page, route: string) {
  await page.evaluate((r) => { location.hash = `#/home/${r}`; }, route);
  await settle(page);
}

/** Geometry of the home element: overflow of the page, the shell and the main area (and an open sheet), small targets, words. */
async function audit(page: Page, minTarget: number) {
  return page.evaluate((min) => {
    const host = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!;
    const root = host.shadowRoot!;
    const out: string[] = [];
    const doc = document.scrollingElement!;
    if (doc.scrollHeight - doc.clientHeight > 1) out.push(`document ${doc.scrollHeight}>${doc.clientHeight}`);
    for (const sel of ['.hs', '#main', '.ovl .sheet']) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el && el.scrollHeight - el.clientHeight > 1) out.push(`${sel} ${el.scrollHeight}>${el.clientHeight}`);
      if (el && sel === '.hs' && el.scrollWidth - el.clientWidth > 1) out.push(`hs-x ${el.scrollWidth}>${el.clientWidth}`);
    }
    const small: string[] = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('#main button, #main a[href], #main input[type=range], .ovl button'))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || el.classList.contains('cover')) continue;
      const after = getComputedStyle(el, '::after');
      const grow = after.content !== 'none' && after.position === 'absolute' ? Math.max(0, -parseFloat(after.top || '0')) + Math.max(0, -parseFloat(after.bottom || '0')) : 0;
      if (Math.min(r.width, r.height + grow) < min - 0.5) small.push(`${el.tagName.toLowerCase()}.${el.className}[${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 16)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const hs = root.querySelector('.hs') as HTMLElement;
    const text = (root as unknown as { textContent: string }).textContent + ' ' + Array.from(root.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label')).join(' ');
    return { out, small, text, dir: getComputedStyle(hs).direction };
  }, minTarget);
}

const shadowClick = (page: Page, sel: string) => inHome(page).locator(sel).first().click();
const callsTo = (m: { calls: { path: string; body: unknown }[] }, prefix: string) => m.calls.filter((c) => c.path.startsWith(prefix));

test.describe('HOME-V3-P3-2432 sizes', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  for (const size of SIZES) {
    test(`phase 3 screens and sheets fit without scrolling, RTL, targets, words - ${size.id}`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      const problems: string[] = [];
      const check = async (name: string) => {
        const a = await audit(page, size.id === 'phone' ? 44 : 56);
        if (a.out.length) problems.push(`${name}: overflow ${a.out.join(', ')}`);
        if (size.id !== 'phone' && a.small.length) problems.push(`${name}: small ${a.small.slice(0, 4).join('; ')}`);
        if (a.dir !== 'rtl') problems.push(`${name}: direction ${a.dir}`);
        for (const w of FORBIDDEN) if (a.text.includes(w)) problems.push(`${name}: says "${w}"`);
        await page.screenshot({ path: `${SHOTS}/${size.id}-${name}.png` });
      };
      await open(page, 'media', { systems: 'bad' });
      await expect(inHome(page).locator('[data-p3-media]')).toBeVisible();
      await expect(inHome(page).locator('[data-p3-systems], [data-p3-bills]')).toHaveCount(0);
      for (const s of SCREENS) {
        await go(page, s);
        await check(s);
      }
      await go(page, 'media');
      await shadowClick(page, '[data-p3-dev="tv_living"] .cover');
      await shadowClick(page, '[data-p3-remote]');
      await settle(page);
      await check('remote');
      await page.keyboard.press('Escape');
      await shadowClick(page, '[data-p3-dev="sp_living"] .cover');
      await shadowClick(page, '[data-p3-group]');
      await settle(page);
      await check('group');
      await page.keyboard.press('Escape');
      await shadowClick(page, '[data-p3-announce]');
      await settle(page);
      await check('announce');
      await page.keyboard.press('Escape');
      await go(page, 'r/living');
      await check('room-living');
      expect(problems).toEqual([]);
    });
  }

  test('the media and systems screens in all seven themes, dark and light', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const t of THEMES) {
      for (const scheme of t === 'midnight' ? ['dark'] : ['dark', 'light']) {
        await open(page, 'media');
        await page.evaluate(([th, sc]) => { const h = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!; h.setAttribute('data-hs-theme', th); h.setAttribute('data-hs-scheme', sc); }, [t, scheme]);
        await settle(page);
        const bg = await page.evaluate(() => getComputedStyle(document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!.querySelector('.md-now')!).backgroundColor);
        expect(bg).not.toBe('rgba(0, 0, 0, 0)');
        await page.screenshot({ path: `${SHOTS}/theme-${t}-${scheme}-media.png` });
      }
    }
  });
});

test.describe('HOME-V3-P3-2432 behaviour', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one size is enough for the behaviour');
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('media: play / pause, previous / next and volume go through the device command route', async ({ page }) => {
    const m = await open(page, 'media');
    await expect(inHome(page).locator('.hs-head h2')).toHaveText('2 מכשירים מנגנים');
    await shadowClick(page, '[data-p3-play]');
    await expect.poll(() => callsTo(m, 'media/sp_living').map((c) => JSON.stringify(c.body))).toContainEqual(expect.stringContaining('"action":"pause"'));
    await inHome(page).locator('.md-ctl [aria-label="הבא"]').click();
    await expect.poll(() => callsTo(m, 'media/sp_living').map((c) => (c.body as { action?: string }).action)).toContain('next');
    await inHome(page).locator('[data-p3-vol]').fill('60');
    await expect.poll(() => callsTo(m, 'media/sp_living').map((c) => `${(c.body as { command: string }).command}:${(c.body as { level?: number }).level ?? ''}`)).toContain('volume_set:60');
    // every command carries its own request id and an expiry (one per deliberate tap; never retried)
    for (const c of callsTo(m, 'media/')) expect(c.body).toEqual(expect.objectContaining({ client_request_id: expect.any(String), expires_at: expect.any(String) }));
  });

  test('media: a television turns on, takes a source, and its remote sends keys and power', async ({ page }) => {
    const m = await open(page, 'media');
    await shadowClick(page, '[data-p3-dev="tv_living"] .cover');
    await shadowClick(page, '[data-p3-play]');
    await expect.poll(() => callsTo(m, 'media/tv_living').map((c) => (c.body as { command: string }).command)).toContain('power_on');
    await shadowClick(page, '[data-p3-remote]');
    await expect(inHome(page).locator('[data-p3-sheet="remote"]')).toContainText('טלוויזיה בסלון');
    await expect(inHome(page).locator('[data-p3-key="up"]')).toBeDisabled(); // the screen is off: only power is offered
    await shadowClick(page, '[data-p3-power]');
    await expect.poll(() => callsTo(m, 'media/tv_living').filter((c) => (c.body as { command: string }).command === 'power_on').length).toBe(2);
  });

  test('media: the room screen has a "מדיה" category that opens the room\'s devices only', async ({ page }) => {
    await open(page, 'r/living');
    const chip = inHome(page).locator('.chip3[data-cat="media"]');
    await expect(chip).toContainText('מדיה');
    await expect(chip).toContainText('מתנגן');
    await chip.click();
    await settle(page);
    await expect(inHome(page).locator('[data-p3-dev]')).toHaveCount(2);
    await expect(inHome(page).locator('.hs-head .sub')).toHaveText('בסלון');
    await go(page, 'r/garden');
    await expect(inHome(page).locator('.chip3[data-cat="media"]')).toHaveCount(0);
  });

  test('media: play in more rooms joins the chosen speakers in one batch, and asks first when the server wants it', async ({ page }) => {
    const m = await open(page, 'media', { groupConfirm: true });
    await shadowClick(page, '[data-p3-group]');
    await shadowClick(page, '[data-p3-grp="sp_kitchen"]');
    await shadowClick(page, '[data-p3-grp="sp_yuval"]');
    await shadowClick(page, '[data-p3-grp-save]');
    await expect(inHome(page).locator('.sheet.dialog h2')).toContainText('לנגן ב-3 חדרים?');
    await shadowClick(page, '[data-act="askYes"]');
    await expect.poll(() => callsTo(m, 'media/join').length).toBe(2);
    const last = callsTo(m, 'media/join')[1].body as { leader_key: string; member_keys: string[]; confirmed: boolean };
    expect(last).toEqual(expect.objectContaining({ leader_key: 'sp_living', member_keys: ['sp_kitchen', 'sp_yuval'], confirmed: true }));
  });

  test('announcement: a ready message to the whole house; the emergency template is never offered', async ({ page }) => {
    const m = await open(page, 'media');
    await shadowClick(page, '[data-p3-announce]');
    const sheet = inHome(page).locator('[data-p3-sheet="announce"]');
    await expect(sheet.locator('[data-p3-tpl]')).toHaveCount(2);
    await expect(sheet.locator('[data-p3-tpl="fire"]')).toHaveCount(0);
    await expect(sheet.locator('[data-p3-ann-send]')).toBeDisabled();
    await shadowClick(page, '[data-p3-tpl="dinner"]');
    await shadowClick(page, '[data-p3-ann-send]');
    await expect.poll(() => callsTo(m, 'announcements').map((c) => c.body)).toEqual([expect.objectContaining({ scope: 'all', ref: '*', text: 'ארוחת ערב מוכנה, כולם לשולחן', template_id: 'dinner' })]);
    await expect(inHome(page).locator('.toast2')).toContainText('ההודעה הושמעה בכל הבית');
    expect(callsTo(m, 'announcements/emergency')).toEqual([]);
  });

  test('announcement: own words to this room from a room\'s media screen', async ({ page }) => {
    const m = await open(page, 'r/kitchen');
    await shadowClick(page, '.chip3[data-cat="media"]');
    await settle(page);
    await shadowClick(page, '[data-p3-announce]');
    await inHome(page).locator('[data-p3-ann-text]').fill('הקפה מוכן');
    await inHome(page).locator('[data-p3-sheet="announce"] .seg button', { hasText: 'מטבח' }).click();
    await shadowClick(page, '[data-p3-ann-send]');
    await expect.poll(() => callsTo(m, 'announcements').map((c) => c.body)).toEqual([expect.objectContaining({ scope: 'area', ref: 'kitchen', text: 'הקפה מוכן' })]);
  });

  test('announcement is hidden without its permission, and media without the module', async ({ page }) => {
    await open(page, 'media', { perms: P3_PERMS.filter((p) => p !== 'media.announce') });
    await expect(inHome(page).locator('[data-p3-announce]')).toHaveCount(0);
    await open(page, 'r/living', { media: 'off' });
    await expect(inHome(page).locator('.chip3[data-cat="media"]')).toHaveCount(0);
    await go(page, 'media');
    await expect(inHome(page).locator('#main')).toContainText('המסך הזה לא זמין');
  });

  test('bill: so far, the estimate and the previous bills; nothing without the bills permission', async ({ page }) => {
    await open(page, 'bills');
    await expect(inHome(page).locator('[data-p3-sofar]')).toContainText('215');
    if (new Date().getDate() >= 3) await expect(inHome(page).locator('[data-p3-forecast]')).toContainText('בערך'); // no estimate in a period's first two days
    await expect(inHome(page).locator('.blr')).toHaveCount(3);
    await expect(inHome(page).locator('.blr').first()).toContainText('לתשלום');
    await go(page, 'energy');
    await expect(inHome(page).locator('[data-p3-go="bills"]')).toHaveCount(1);
    await expect(inHome(page).locator('[data-p3-go="water"]')).toHaveCount(1);
    await open(page, 'energy', { perms: P3_PERMS.filter((p) => p !== 'energy.bills') });
    await expect(inHome(page).locator('[data-p3-go="bills"]')).toHaveCount(0);
    await go(page, 'bills');
    await expect(inHome(page).locator('#main')).toContainText('המסך הזה לא זמין');
  });

  test('water: today, the week and the leak state; nothing when the water module is off', async ({ page }) => {
    await open(page, 'water', { water: 'leak' });
    await expect(inHome(page).locator('.hs-head h2')).toContainText('412');
    await expect(inHome(page).locator('.wb')).toHaveCount(7);
    await expect(inHome(page).locator('[data-p3-leak="yes"]')).toContainText('חשד לנזילה');
    await open(page, 'water', { water: 'off' });
    await expect(inHome(page).locator('#main')).toContainText('המסך הזה לא זמין');
  });

  test('house systems: power, generator, lifts and temperatures, view only', async ({ page }) => {
    await open(page, 'systems', { systems: 'bad' });
    await expect(inHome(page).locator('.hs-head .sub')).toHaveText('2 דברים דורשים תשומת לב');
    await expect(inHome(page).locator('[data-p3-sys="power"]')).toContainText('חשמל מהרשת');
    await expect(inHome(page).locator('[data-p3-sys="generator"]')).toContainText('מוכן');
    await expect(inHome(page).locator('[data-p3-sys="lifts"]')).toContainText('תקלה');
    await expect(inHome(page).locator('.foot-note')).toContainText('לצפייה בלבד');
    // no control at all: the only buttons are the pagers
    const buttons = await inHome(page).locator('[data-p3-systems] button').evaluateAll((l) => l.map((b) => b.getAttribute('aria-label')));
    expect(buttons.every((b) => b === 'הקודם' || b === 'הבא')).toBe(true);
    await open(page, 'systems', { systems: 'none' });
    await expect(inHome(page).locator('#main')).toContainText('אין מערכות להצגה');
  });

  test('map: a schematic plan per floor, never mirrored; a tap opens the room', async ({ page }) => {
    await open(page, 'map');
    await expect(inHome(page).locator('[data-p3-map="g"] .pr')).toHaveCount(5);
    expect(await inHome(page).locator('.plan-in').evaluate((e) => getComputedStyle(e).direction)).toBe('ltr');
    await expect(inHome(page).locator('[data-p3-room="living"]')).toHaveClass(/lit/);
    await inHome(page).locator('.hs-head .seg button').nth(1).click();
    await expect(inHome(page).locator('[data-p3-map="f1"] .pr')).toHaveCount(4);
    await inHome(page).locator('[data-p3-room="yuval"]').click();
    await settle(page);
    await expect(inHome(page).locator('.tb-room h1')).toHaveText('החדר של יובל');
    await open(page, 'map', { perms: P3_PERMS.filter((p) => p !== 'map.read') });
    await expect(inHome(page).locator('#main')).toContainText('המסך הזה לא זמין');
  });

  test('a wall panel locked to its room offers only that room\'s media and announcement', async ({ page }) => {
    const m = await open(page, 'media', { policy: { kiosk: true, home_only: true, may_switch: false, kiosk_area_id: 'living' } });
    await expect(inHome(page).locator('[data-p3-dev]')).toHaveCount(2);
    await expect(inHome(page).locator('.hs-head .seg')).toHaveCount(0);
    await shadowClick(page, '[data-p3-announce]');
    await expect(inHome(page).locator('[data-p3-sheet="announce"] .seg')).toHaveCount(0);
    await shadowClick(page, '[data-p3-tpl="dinner"]');
    await shadowClick(page, '[data-p3-ann-send]');
    await expect.poll(() => callsTo(m, 'announcements').map((c) => c.body)).toEqual([expect.objectContaining({ scope: 'area', ref: 'living' })]);
    await expect.poll(() => page.evaluate(() => (document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home') as unknown as { p3: { tiles(): { id: string }[] } }).p3.tiles().map((t) => t.id))).toEqual(['media', 'announce']);
    await go(page, 'bills');
    await expect(inHome(page).locator('.tb-room h1')).toHaveText('סלון');
    await expect(inHome(page).locator('[data-p3-bills]')).toHaveCount(0);
  });

  test('the hub registry hands phase 1 one tile per capability with its live line', async ({ page }) => {
    await open(page, 'r/home', { water: 'leak', systems: 'bad' });
    const read = () => page.evaluate(() => (document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home') as unknown as { p3: { tiles(): { id: string; line: string; tone: string }[] } }).p3.tiles());
    await expect.poll(async () => (await read()).map((t) => t.id)).toEqual(['media', 'announce', 'bills', 'water', 'systems', 'map']);
    const tiles = await read();
    expect(tiles.find((t) => t.id === 'media')!.line).toBe('2 חדרים מנגנים');
    expect(tiles.find((t) => t.id === 'water')).toEqual(expect.objectContaining({ line: 'חשד לנזילה', tone: 'warn' }));
    expect(tiles.find((t) => t.id === 'bills')!.line).toBe('215 ₪ עד עכשיו');
    const none = await (async () => { await open(page, 'r/home', { modules: ['lights', 'climate', 'shades', 'doors', 'cameras', 'energy', 'alerts', 'scenes', 'security'] }); return page.evaluate(() => (document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home') as unknown as { p3: { tiles(): unknown[] } }).p3.tiles().length); })();
    expect(none).toBe(0);
  });
});
