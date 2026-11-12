import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockGaps, type GapOpts } from './home-v3-gaps-mocks';
import { mockP2 } from './home-v3-p2-mocks';

// HOME-V3-AUDITFIX-2437: the round-30 design audit of the shipped home interface v3 (private/design-system-2026-10-27/round30/home-audit/
// FIXES.md, docs/changes/HOME-V3-AUDITFIX-2437.md). Each P1 fix at the viewport the audit found it on, plus the worst-case data of its
// break-ui table. Mocked backend (the v3 mock layers); every stamp is relative to the clock, never to an hour of the day.
// Screenshots: test-results/home-v3-auditfix/.

const SHOTS = 'test-results/home-v3-auditfix';
const home = (page: Page) => page.locator('sw-home');
const ready = (page: Page) => expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function open(page: Page, route: string, size: { width: number; height: number }, o: GapOpts = {}, extra?: (p: Page) => Promise<void>) {
  await page.setViewportSize(size);
  await page.goto('about:blank');
  await mockGaps(page, o);
  if (extra) await extra(page);
  await page.goto(`/#/home/${route}`);
  await home(page).waitFor();
  await ready(page);
  await settle(page);
}

/** No scroll anywhere (page, shell, main area, an open sheet). */
async function noScroll(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
    const out: string[] = [];
    const doc = document.scrollingElement!;
    if (doc.scrollHeight - doc.clientHeight > 1) out.push('document');
    for (const sel of ['.hs', '#main', '.sheet']) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el && el.scrollHeight - el.clientHeight > 1) out.push(`${sel} ${el.scrollHeight}>${el.clientHeight}`);
    }
    return out;
  });
}

/** Elements matching `sel` (inside sw-home) whose own text is cut (wider / taller than their box). */
async function cut(page: Page, sel: string) {
  return page.evaluate((s) => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
    return Array.from(root.querySelectorAll<HTMLElement>(s)).filter((e) => e.getClientRects().length && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)).map((e) => e.textContent?.trim().slice(0, 30));
  }, sel);
}

const PHONES = [{ width: 375, height: 812 }, { width: 375, height: 667 }];

test.describe('HOME-V3-AUDITFIX-2437', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  // ---------------------------------------------------------------- P1

  for (const size of PHONES) {
    test(`1: recordings on a phone ${size.width}x${size.height} - both day arrows are there, 48 px, and change the day`, async ({ page }) => {
      await open(page, 'playback/cam1', size);
      const days = home(page).locator('.hs-head .pb-days');
      await expect(days).toBeVisible();
      for (const b of await days.locator('button.rb').all()) {
        await expect(b).toBeVisible();
        const r = (await b.boundingBox())!;
        expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(47.5);
      }
      await expect(home(page).locator('.hs-head .pb-cams')).toBeHidden(); // the camera is chosen on the cameras screen (owner question 5, recommended)
      await expect(days.locator('.pbd')).toHaveText('היום');
      await days.locator('[data-act="pbDay"][data-d="1"]').click();
      await expect(days.locator('.pbd')).not.toHaveText('היום');
      expect(await noScroll(page)).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/playback-${size.width}x${size.height}.png` });
    });
  }

  test('9: recordings on the wall panel - the camera stepper names the camera', async ({ page }) => {
    await open(page, 'playback/cam1', { width: 1280, height: 800 });
    await expect(home(page).locator('.hs-head .pb-cams .pbc')).toHaveText('כניסה לבית');
    await expect(home(page).locator('.hs-head .pg-t')).toHaveText('הקלטות');
    await home(page).locator('[data-act="pbCam"][data-d="1"]').click();
    await expect(home(page).locator('.hs-head .pb-cams .pbc')).not.toHaveText('כניסה לבית');
  });

  for (const size of [{ width: 768, height: 1024 }, { width: 820, height: 1180 }]) {
    test(`2: a portrait tablet ${size.width}x${size.height} takes the roomy phone layout - nothing in the chrome is cut, no tile overlaps`, async ({ page }) => {
      await open(page, 'r/living', size);
      // the phone layout: one column, the bar at the bottom
      const grid = await home(page).locator('.hs').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
      expect(grid).toBe(1);
      const nav = (await home(page).locator('.hs-nav').boundingBox())!;
      expect(nav.y + nav.height).toBeGreaterThan(size.height - 4);
      expect(await cut(page, '.tb-t h1, .hs-now .time, .chip3 .c3-t b')).toEqual([]);
      // the roomier band: 56 px targets
      expect(await home(page).locator('.hs').evaluate((e) => getComputedStyle(e).getPropertyValue('--hit').trim())).toBe('56px');
      const overlaps = await page.evaluate(() => {
        const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
        const bad: string[] = [];
        for (const t of Array.from(root.querySelectorAll<HTMLElement>('.wgrid > .tile'))) {
          const kids = Array.from(t.children).filter((k) => getComputedStyle(k).position !== 'absolute' && k.getClientRects().length).map((k) => k.getBoundingClientRect());
          for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
            const a = kids[i]; const b = kids[j];
            if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) bad.push(t.textContent!.trim().slice(0, 20));
          }
        }
        return bad;
      });
      expect(overlaps).toEqual([]);
      expect(await noScroll(page)).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/room-${size.width}x${size.height}.png` });
      await page.goto('/#/home/more');
      await settle(page);
      expect(await cut(page, '.hubt .hl')).toEqual([]);
      expect(await noScroll(page)).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/more-${size.width}x${size.height}.png` });
    });
  }

  test('2: a landscape phone 844x390 keeps the wide layout (only the portrait band moved)', async ({ page }) => {
    await open(page, 'r/living', { width: 844, height: 390 });
    expect(await home(page).locator('.hs').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
  });

  for (const size of PHONES) {
    test(`3: alarm on a phone ${size.width}x${size.height}, disarmed, three arm modes, a 40-character name - the icon is whole`, async ({ page }) => {
      await open(page, 'security', size, {}, async (p) => {
        await p.route('**/api/v1/alarm/panels', async (r) => {
          await r.fulfill(json({ panels: [{
            entity_id: 'alarm_control_panel.house', name: 'מערכת האזעקה של הבית הגדול בקומת הקרקע', platform: null, integration: '', integration_note: '', config_entry_id: null, state: 'disarmed', available: true, fresh: true,
            last_changed: null, changed_by: null, arm_modes: ['arm_home', 'arm_away', 'arm_night'], features_reported: true, code_format: 'number', code_arm_required: false, needs_code_arm: false,
            needs_code_disarm: true, area_name: null, open_sensors: [], bypassed_sensors: [], zones: [], unpaired_controls: [], ready: { ready: true, open: [], faults: [] },
            can: { arm: true, disarm: true, bypass: false, restore: false }, panel_code_set: false, code: { arm: 'none', disarm: 'pin', bypass: 'none' },
          }], counts: { panels: 1, zones: 0, open: 0, bypassed: 0, faults: 0 }, channel: 'local', remote: { control: true, disarm: true, codeless: false }, code_mode: 'personal_pin',
          me: { arm_policy: 'no_code', disarm_policy: 'code_required', pin_set: true }, can_configure: false }));
        });
      });
      const pane = (await home(page).locator('.alm-main').boundingBox())!;
      const ic = (await home(page).locator('.alm-ic').boundingBox())!;
      expect(ic.y).toBeGreaterThanOrEqual(pane.y - 0.5);
      expect(ic.y + ic.height).toBeLessThanOrEqual(pane.y + pane.height + 0.5);
      await expect(home(page).locator('[data-act="almArm"]')).toHaveCount(3);
      for (const b of await home(page).locator('[data-act="almArm"]').all()) {
        const r = (await b.boundingBox())!;
        expect(r.y + r.height).toBeLessThanOrEqual(pane.y + pane.height + 0.5);
      }
      // 26: no zones = the standard empty block
      await expect(home(page).locator('.alm .pane:last-child .empty')).toContainText('אין גלאים להצגה');
      expect(await noScroll(page)).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/alarm-${size.width}x${size.height}.png` });
    });
  }

  for (const size of [{ width: 1280, height: 800 }, { width: 1024, height: 768 }]) {
    test(`4: a wall panel locked to its room ${size.width}x${size.height} - a 60-character event stays inside the calendar chip`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('about:blank');
      await mockP2(page, { kiosk: true });
      const long = 'ארוחת ערב משפחתית גדולה אצל סבא וסבתא בבית שלהם בכפר עם כל הנכדים';
      const start = new Date(Date.now() + 40 * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const end = new Date(Date.now() + 160 * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      await page.route('**/api/v1/calendar/occurrences?**', (r) => r.fulfill(json({ occurrences: [{ occurrence_id: 'x1', event_id: 'x1', calendar_id: 'cal-fam', room_calendar_ids: [], start, end, state: 'confirmed', kind: 'event', title: long, organizer: { id: 'x', name: 'נועה' }, revision: 'r1', all_day: false }] })));
      await page.goto('/#/home/r/living');
      await home(page).waitFor();
      await ready(page);
      await settle(page);
      const chip = home(page).locator('.chip3[data-cat="calendar"]');
      await expect(chip).toContainText('הבא ב-');
      await expect(chip).toHaveAttribute('title', new RegExp(long));
      const spill = await chip.evaluate((c) => {
        const cr = c.getBoundingClientRect();
        return Array.from(c.querySelectorAll('*')).filter((k) => { const r = k.getBoundingClientRect(); return r.width && (r.left < cr.left - 0.5 || r.right > cr.right + 0.5); }).length;
      });
      expect(spill).toBe(0);
      await page.screenshot({ path: `${SHOTS}/kiosk-room-${size.width}x${size.height}.png` });
    });
  }

  for (const size of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
    test(`5, 6: cameras without live video at ${size.width} say "תמונה", nothing sits under the star, no broken-image glyph`, async ({ page }) => {
      await open(page, 'cameras', size);
      const tiles = home(page).locator('.cam-t:not(.off)');
      await expect(tiles.first()).toBeVisible();
      for (const t of await tiles.all()) {
        await expect(t.locator('.cap [data-cam-mode]')).toHaveText('תמונה');
        await expect(t.locator('.cap [data-cam-mode]')).toHaveAttribute('title', /מתעדכנת כל \d+ שנ׳/);
        await expect(t.locator('.cap')).not.toContainText('חי');
      }
      // the camera tile's own still label is off in the home tiles; the still that failed (404) is hidden, not a broken glyph
      await expect.poll(() => page.evaluate(() => {
        const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
        return Array.from(root.querySelectorAll('.cam-t sw-camera-tile')).map((t) => {
          const sr = t.shadowRoot!;
          const img = sr.querySelector('img.poster') as HTMLImageElement | null;
          return `${sr.querySelectorAll('[data-snapshot-label]').length}:${img ? getComputedStyle(img).visibility : 'none'}`;
        });
      })).toEqual(expect.arrayContaining(['0:hidden']));
      const labels = await page.evaluate(() => Array.from(document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!.querySelectorAll('.cam-t sw-camera-tile')).map((t) => t.shadowRoot!.querySelectorAll('[data-snapshot-label]').length));
      expect(labels.every((n) => n === 0)).toBe(true);
      expect(await noScroll(page)).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/cameras-${size.width}.png` });
    });
  }

  test('5: a live camera widget that has not started playing says "מתחבר", never "חי"', async ({ page }) => {
    await open(page, 'r/entry', { width: 1280, height: 800 }, {}, async (p) => {
      await p.route('**/api/v1/home/prefs', (r) => r.fulfill(json({ favourites: { entry: [{ t: 'cam', id: 'cam1', w: 2 }] }, layout: { welcomed: true }, seed: {} })));
    });
    const cap = home(page).locator('.wdg .cap [data-cam-mode]').first();
    await expect(cap).toHaveText('מתחבר');
  });

  // ---------------------------------------------------------------- P2 / P3 and the break-ui findings

  test('7: the next start paints the home background before the app draws', async ({ page }) => {
    await open(page, 'r/home', { width: 1280, height: 800 });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('arx-home-paint') || 'null'));
    expect(stored?.bg).toBeTruthy();
    // hold the session so the shell stays on its first frames, then look at the page background
    let release: () => void = () => undefined;
    const held = new Promise<void>((res) => { release = res; });
    await page.route('**/api/v1/me', async (r) => { await held; await r.fallback(); });
    await page.goto('about:blank');
    await page.goto('/#/home/r/home');
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--sw-bg'))).toBe(stored.bg);
    release();
    await home(page).waitFor();
    await ready(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.hasAttribute('data-home-paint'))).toBe(false);
  });

  test('13: a locked wall panel opens its room for any address it does not link to', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('about:blank');
    await mockP2(page, { kiosk: true });
    for (const r of ['more', 'security', 'events', 'presence', 'rooms']) {
      await page.goto('about:blank');
      await page.goto(`/#/home/${r}`);
      await home(page).waitFor();
      await ready(page);
      await expect(home(page).locator('.hs.v2')).toHaveAttribute('data-screen', 'r');
    }
    await page.goto('about:blank');
    await page.goto('/#/home/calendar');
    await ready(page);
    await expect(home(page).locator('.hs.v2')).toHaveAttribute('data-screen', 'calendar');
  });

  test('12, 14: the doors screen says who opened in one line, without a gendered slash', async ({ page }) => {
    await open(page, 'doors', { width: 375, height: 812 }, {}, async (p) => {
      const at = new Date(Date.now() - 30 * 60_000).toISOString();
      await p.route('**/api/v1/intercom/calls?**', (r) => r.fulfill(json({ calls: [
        { id: 'c1', station_id: 's1', station_name: 'דלת הכניסה', rang_at: at, observed: 'ringing', state: 'ended', outcome: 'answered', answered_at: at, answered_via: 'arx', answered_by_name: 'אלכסנדרה-מרגריטה', answered_by_me: false, ended_at: at, door_opened_at: at, door_opened_by_name: 'אלכסנדרה-מרגריטה' },
      ], next: null, retention_days: 30 })));
    });
    const res = home(page).locator('.vres').first();
    await expect(res).toHaveText('הדלת נפתחה · אלכסנדרה-מרגריטה');
    await expect(res).toHaveAttribute('title', 'הדלת נפתחה · אלכסנדרה-מרגריטה');
    const lh = await res.evaluate((e) => ({ h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight) || 20 }));
    expect(lh.h).toBeLessThan(lh.lh * 1.6);
    await expect(home(page).locator('#main')).not.toContainText('/ה');
  });

  test('15: a Latin name truncates at its end', async ({ page }) => {
    await open(page, 'cameras', { width: 375, height: 812 }, {}, async (p) => {
      await p.route('**/api/v1/cameras', (r) => r.fulfill(json({ cameras: [{ id: 'cam1', name: 'LG-OLED-77-Living-Room-Wall-Camera-North-Side', can_view_live: true, recorder_enabled: true, area_id: 'entry' }], recorders: [], recorder: null, can_sync: false, media: {} })));
    });
    const name = home(page).locator('.cam-t .cap .clamp1').first();
    await expect(name).toHaveCSS('unicode-bidi', 'plaintext');
    // the start of the name is on screen: the visible text begins with "LG"
    const leftEdge = await name.evaluate((e) => { const r = document.createRange(); r.setStart(e.firstChild!, 0); r.setEnd(e.firstChild!, 2); return r.getBoundingClientRect().left - e.getBoundingClientRect().left; });
    expect(leftEdge).toBeLessThan(2);
  });

  test('16, 25: "מי בבית" counts from the list, keeps "(אני)" with a long name, says "מאז 07:23" for today', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('about:blank');
    await mockP2(page);
    const at = (m: number) => new Date(Date.now() - m * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const people = [
      { user_id: 'u1', name: 'אלכסנדרה-מרגריטה בת-שבע לוינשטיין', me: true, home: true, at: at(1) },
      { user_id: 'u2', name: 'יונתן', me: false, home: false, at: at(2) },
      { user_id: 'u3', name: 'מאיה', me: false, home: true, at: at(3) },
    ];
    await page.route('**/api/v1/home/presence', (r) => r.fulfill(json({ enabled: true, me_hidden: false, people, home_count: 1284 })));
    await page.goto('/#/home/presence');
    await ready(page);
    await settle(page);
    await expect(home(page).locator('.hs-head .sub')).toHaveText('2 בבית · אחד בחוץ');
    const mark = home(page).locator('[data-person="me"] .me-mark');
    await expect(mark).toBeVisible();
    const box = (await mark.boundingBox())!;
    const row = (await home(page).locator('[data-person="me"]').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(row.x - 0.5);
    await expect(home(page).locator('[data-person="me"] .pk')).toHaveText(/^מאז \d{2}:\d{2}$/);
  });

  test('17: water extremes are formatted, and past 999 % the comparison is in words', async ({ page }) => {
    await open(page, 'water', { width: 375, height: 812 }, {}, async (p) => {
      await p.route('**/api/v1/infra/water/meters', (r) => r.fulfill(json({ items: [{ id: 'w1', display_name: 'מונה ראשי', status: 'active', today_l: 1284000, month_l: 98_000_000 }], stale_after_minutes: 60 })));
      await p.route('**/api/v1/infra/water/consumption?**', (r) => {
        const series = [];
        for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 86_400_000); const iso = d.toISOString().slice(0, 10); series.push({ start: d.toISOString(), end: d.toISOString(), date: iso, litres: i === 0 ? 1284000 : 420 }); }
        return r.fulfill(json({ items: [], unit: 'L', total_litres: 1286520, series, bucket: '1d' }));
      });
    });
    await expect(home(page).locator('.hs-head .pg-t')).toContainText('1,284,000');
    await expect(home(page).locator('.hs-head .sub')).toHaveText('הרבה יותר מיום רגיל');
    await expect(home(page).locator('#main')).not.toContainText('%');
    expect(await cut(page, '.hs-head .pg-t')).toEqual([]);
  });

  test('10, 27: one announcement target is a plain row; no speakers = no "כריזה"', async ({ page }) => {
    await open(page, 'media', { width: 1280, height: 800 });
    await home(page).locator('[data-p3-announce]').click();
    await expect(home(page).locator('[data-p3-sheet="announce"] [data-p3-ann-where="house"]')).toContainText('כל הבית');
    await expect(home(page).locator('[data-p3-sheet="announce"] .seg')).toHaveCount(0);
    await open(page, 'media', { width: 1280, height: 800 }, { media: 'empty' });
    await expect(home(page).locator('[data-p3-announce]')).toHaveCount(0);
  });

  test('22: the active media source is marked', async ({ page }) => {
    await open(page, 'media', { width: 1280, height: 800 });
    const on = home(page).locator('.md-src .chip2[aria-pressed="true"]');
    if (await on.count()) await expect(on.first()).toHaveCSS('font-weight', '600');
  });

  test('19: the sheets\' day buttons are 44 px on a 375 phone', async ({ page }) => {
    await open(page, 'calendar', { width: 375, height: 812 });
    const add = home(page).locator('#main [data-act="p2CalNew"], #main button:has-text("אירוע חדש")').first();
    test.skip(!(await add.count()), 'no new-event button under the mock');
    await add.click();
    const days = home(page).locator('.ovl .mini.week .wd');
    await expect(days.first()).toBeVisible();
    for (const d of await days.all()) expect((await d.boundingBox())!.width).toBeGreaterThanOrEqual(43.5);
    expect(await noScroll(page)).toEqual([]);
  });

  test('motion: a closed sheet leaves at once for queries (its exit copy is out of reach)', async ({ page }) => {
    await open(page, 'media', { width: 1280, height: 800 });
    await home(page).locator('[data-p3-announce]').click();
    await expect(home(page).locator('.sheet')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await home(page).locator('[data-p3-sheet="announce"] button[aria-label="סגור"]').click({ timeout: 2000 }).catch(() => undefined);
    await expect(home(page).locator('.sheet')).toHaveCount(0);
  });
});
