import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockP2, type P2Opts } from './home-v3-p2-mocks';

// HOME-V3-P2-2431: the family and building screens of the home interface (round-27 mockup v3, phase 2) - who is home with the
// personal hide switch, the calendar day and a new event, shared-room booking, the notice board with the buses and the long notice
// that scrolls only inside its sheet, service requests (only the caller's own; nothing when the module is off), weather, my
// notifications with "do not disturb", scene schedules and a new scene from the current state. Mocked backend (home-v3-p2-mocks.ts).

const home = (page: Page) => page.locator('sw-home');

async function open(page: Page, route: string, o: P2Opts = {}) {
  const mock = await mockP2(page, o);
  await page.goto(`/#/home/${route}`);
  await home(page).waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await settle(page);
  return mock;
}

/** No scrolling on the home element (the page, the shell, the main area); the only allowed scroll is a long notice inside its sheet. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
    const out: string[] = [];
    const doc = document.scrollingElement!;
    if (doc.scrollHeight - doc.clientHeight > 1) out.push('document');
    for (const sel of ['.hs', '#main', '.sheet']) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el && el.scrollHeight - el.clientHeight > 1) out.push(sel);
    }
    return out;
  });
}

const SIZES: [string, number, number][] = [['desktop', 1280, 800], ['tablet', 1024, 768], ['phone', 390, 844]];

test.describe('HOME-V3-P2-2431 family and building', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the sizes are set inside the tests');
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('the hub lists the family tiles with live lines', async ({ page }) => {
    await open(page, 'more');
    for (const id of ['presence', 'calendar', 'notices', 'tickets', 'schedules', 'weather', 'notif']) await expect(home(page).locator(`.hubt[data-mod="${id}"]`)).toHaveCount(1);
    await expect(home(page).locator('.hubt[data-mod="notices"] .count')).toHaveText('2');
    await expect(home(page).locator('.hubt[data-mod="presence"] .hs2')).toContainText('3 בבית');
  });

  test('a switched-off module or a hidden category leaves no tile and no screen', async ({ page }) => {
    await open(page, 'more', { features: { tickets: { on: false, create: false, view: false }, presence: { on: false, can: true } }, modules: ['lights', 'climate', 'shades', 'doors', 'cameras', 'energy', 'alerts', 'scenes', 'security', 'notices'] });
    for (const id of ['tickets', 'presence', 'calendar', 'schedules']) await expect(home(page).locator(`.hubt[data-mod="${id}"]`)).toHaveCount(0);
    await expect(home(page).locator('.hubt[data-mod="notices"]')).toHaveCount(1);
    await page.goto('/#/home/tickets');
    await settle(page);
    await expect(home(page).locator('[data-act="p2TkNew"]')).toHaveCount(0);
    await expect(home(page).locator('.empty h2')).toHaveText('המסך הזה לא זמין');
  });

  test('who is home: the household, and my own hide switch', async ({ page }) => {
    const m = await open(page, 'presence');
    await expect(home(page).locator('.prow')).toHaveCount(4);
    await expect(home(page).locator('.prow[data-person="me"] .pn')).toContainText('(אני)'); // HOME-V3-AUDITFIX-2437: the mark sits beside the name
    await home(page).locator('[data-act="p2ShowMe"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path === 'home/presence/me').map((c) => JSON.stringify(c.body))).toContain('{"hidden":true}');
    await expect(home(page).locator('.prow[data-person="me"]')).toContainText('מוסתר מהאחרים');
    expect(await overflow(page)).toEqual([]);
  });

  test('calendar: the day, a new event from the sheet', async ({ page }) => {
    const m = await open(page, 'calendar');
    await expect(home(page).locator('.week .wd')).toHaveCount(7);
    await expect(home(page).locator('.cev').first()).toBeVisible();
    await home(page).locator('[data-act="p2CalNew"]').click();
    const sheet = home(page).locator('[data-sheet="calNew"]');
    await sheet.locator('input.inp').fill('ארוחת ערב');
    await sheet.locator('[data-act="p2CalStp"][data-k="from"][data-d="1"]').click();
    await sheet.locator('[data-act="p2CalSave"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path === 'calendar/events').length).toBe(1);
    const body = m.calls.find((c) => c.path === 'calendar/events')!.body as { kind: string; title: string; calendar_id: string; start: string; end: string };
    expect(body.kind).toBe('event');
    expect(body.title).toBe('ארוחת ערב');
    expect(Date.parse(body.end) - Date.parse(body.start)).toBe(60 * 60_000);
    expect(await overflow(page)).toEqual([]);
  });

  test('shared rooms: book a room, cancel my booking with a confirmation', async ({ page }) => {
    const m = await open(page, 'calendar/book');
    await expect(home(page).locator('.door-list .arow')).toHaveCount(2);
    await home(page).locator('[data-act="p2BookNew"][data-id="room-club"]').click();
    await home(page).locator('[data-sheet="bookNew"] [data-act="p2CalSave"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path === 'calendar/events').map((c) => (c.body as { kind: string }).kind)).toContain('booking');
    await home(page).locator('[data-act="p2BookDel"]').first().click();
    await home(page).locator('[data-act="askYes"]').click();
    await expect.poll(() => m.calls.some((c) => /calendar\/events\/[^/]+\/(cancel|withdraw)$/.test(c.path))).toBe(true);
  });

  test('notice board: buses line, open a notice and mark it read; a long notice scrolls only inside its sheet', async ({ page }) => {
    const m = await open(page, 'notices', { worst: true });
    await expect(home(page).locator('.transit')).toContainText('קו 18');
    await home(page).locator('[data-act="p2Notice"]').first().click();
    const body = home(page).locator('[data-sheet="notice"] .n-body');
    await expect(body).toBeVisible();
    await settle(page);
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === 'auto')).toBe(true);
    expect(await overflow(page)).toEqual([]);
    await home(page).locator('[data-act="p2NoticeRead"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path.endsWith('/read')).length).toBe(1);
  });

  test('service requests: only mine, a new ticket from the sheet, a note', async ({ page }) => {
    const m = await open(page, 'tickets');
    await expect(home(page).locator('.tkrow')).toHaveCount(2); // the open ones
    await home(page).locator('[data-act="p2TkNew"]').click();
    const sheet = home(page).locator('[data-sheet="tkNew"]');
    await sheet.locator('[data-act="p2TkCat"]').nth(1).click();
    await sheet.locator('input.inp').fill('מטבח');
    await sheet.locator('textarea.inp').fill('השקע ליד הכיור לא עובד');
    await sheet.locator('[data-act="p2TkSend"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path === 'home/tickets').length).toBe(1);
    const b = m.calls.find((c) => c.path === 'home/tickets')!.body as { category_id: string; where: string; title: string };
    expect(b).toMatchObject({ category_id: 'c2', where: 'מטבח', title: 'השקע ליד הכיור לא עובד' });
    await home(page).locator('[data-act="p2Ticket"]').first().click();
    await home(page).locator('[data-act="p2TkNote"]').click();
    await home(page).locator('[data-sheet="ticket"] textarea').fill('עדיין מטפטף');
    await home(page).locator('[data-act="p2TkNoteSend"]').click();
    await expect.poll(() => m.calls.some((c) => /home\/tickets\/[^/]+\/notes$/.test(c.path))).toBe(true);
  });

  test('weather: now, hours and days; the strip opens it', async ({ page }) => {
    await open(page, 'r/home');
    await home(page).locator('a.wx').click();
    await settle(page);
    await expect(home(page).locator('.wx-now .huge')).toHaveText('22°');
    await expect(home(page).locator('.wxc')).toHaveCount(6);
    await expect(home(page).locator('.wxd')).toHaveCount(5);
    expect(await overflow(page)).toEqual([]);
  });

  test('my notifications: switch a kind off, "do not disturb" and its hours', async ({ page }) => {
    const m = await open(page, 'notif');
    await expect(home(page).locator('[data-act="p2NfTog"][data-id="safety"]')).toHaveCount(0); // a safety notification is never muted
    await home(page).locator('[data-act="p2NfTog"][data-id="building"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path === 'home/notify').map((c) => JSON.stringify(c.body))).toContain(JSON.stringify({ muted: ['building', 'alerts'] }));
    await home(page).locator('[data-act="p2Dnd"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path === 'home/notify').map((c) => JSON.stringify(c.body))).toContain(JSON.stringify({ dnd: { enabled: true } }));
    await expect(home(page).locator('[data-act="p2DndStp"]')).toHaveCount(4);
  });

  test('schedules: pause one, run one, a new scene schedule', async ({ page }) => {
    const m = await open(page, 'schedules');
    await expect(home(page).locator('.srow')).toHaveCount(3);
    await home(page).locator('[data-act="p2SchTog"][data-id="s1"]').click();
    await expect.poll(() => m.calls.map((c) => c.path)).toContain('home/schedules/s1/disable');
    await home(page).locator('[data-act="p2SchRun"][data-id="s2"]').click();
    await expect.poll(() => m.calls.map((c) => c.path)).toContain('home/schedules/s2/run');
    await home(page).locator('[data-act="p2SchNew"]').click();
    await home(page).locator('[data-sheet="schNew"] [data-act="p2SchDay"][data-v="6"]').click();
    await home(page).locator('[data-act="p2SchSave"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path === 'home/schedules').length).toBe(1);
    const b = m.calls.find((c) => c.path === 'home/schedules')!.body as { scene: string; at: string; days: string[] };
    expect(b.scene).toMatch(/^scene\./);
    expect(b.at).toBe('07:00');
    expect(b.days).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'sat']);
  });

  test('a new scene from the current state, from the scenes screen', async ({ page }) => {
    const m = await open(page, 'scenes');
    await expect(home(page).locator('.hs-head a[href$="/schedules"]')).toHaveCount(1);
    await home(page).locator('[data-act="p2CapNew"]').click();
    await home(page).locator('[data-sheet="capNew"] input.inp').fill('ערב סרט');
    await home(page).locator('[data-act="p2CapSave"]').click();
    await expect.poll(() => m.calls.map((c) => c.path)).toContain('automations/scene');
    const cap = m.calls.find((c) => c.path === 'automations/scene/capture')!.body as { entity_ids: string[] };
    expect(cap.entity_ids.every((e) => /^(light|switch|cover)\./.test(e))).toBe(true); // lights and shades by default, never a lock
  });

  // HOME-V3-FOLLOWUP-B-2431 (owner answer 11.11): the wall panel may now ADD a family event (its own route); it still books no room
  test('a wall panel locked to its room shows the notice board and the calendar, adds an event, books nothing', async ({ page }) => {
    await open(page, 'r/living', { kiosk: true });
    await expect(home(page).locator('.chip3[data-cat="notices"]')).toHaveCount(1);
    await expect(home(page).locator('.chip3[data-cat="calendar"]')).toHaveCount(1);
    await home(page).locator('.chip3[data-cat="calendar"]').click();
    await settle(page);
    await expect(home(page).locator('.cev').first()).toBeVisible();
    await expect(home(page).locator('[data-act="p2CalNew"]')).toHaveCount(1);
    await expect(home(page).locator('[data-act="p2CalTab"]')).toHaveCount(0);
    await expect(home(page).locator('[data-act="p2BookNew"]')).toHaveCount(0);
  });

  for (const [size, w, h] of SIZES) {
    test(`no scrolling at ${size} ${w}x${h} on every family screen (worst case)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, 'presence', { worst: true });
      for (const r of ['presence', 'calendar', 'calendar/book', 'notices', 'tickets', 'weather', 'notif', 'schedules']) {
        await page.goto(`/#/home/${r}`);
        await settle(page);
        expect(await overflow(page), r).toEqual([]);
      }
    });
  }
});
