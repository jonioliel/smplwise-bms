import { expect, test, type Page, type Route } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockP2, type P2Opts } from './home-v3-p2-mocks';

// HOME-V3-FOLLOWUP-B-2431 (owner answers 11.11): a wall panel locked to its room ADDS an event to the family calendar (its own route,
// POST /home/wall/events - never the module's /calendar/events, never a booking), and the new-ticket sheet attaches up to three photos
// (POST /home/tickets/{id}/photos after the ticket is opened). An open ticket keeps "add note" only; the tickets module off leaves no
// ticket action at all. Mocked backend (home-v3-p2-mocks.ts + the two routes below).

const home = (page: Page) => page.locator('sw-home');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
// an 8x8 PNG (valid file; the server would re-encode it)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAGklEQVR42mP8sMWGAQb0bvTA2UwMOMDglAAAntADghJ4On4AAAAASUVORK5CYII=', 'base64');

async function open(page: Page, route: string, o: P2Opts = {}, photoStatus = 201) {
  const mock = await mockP2(page, o);
  const photos: { ct: string; size: number }[] = [];
  await page.route('**/api/v1/home/wall/events', (r) => {
    mock.calls.push({ method: r.request().method(), path: 'home/wall/events', body: r.request().postDataJSON() });
    return json(r, { event: { id: 'w1' }, state: 'confirmed' }, 201);
  });
  await page.route('**/api/v1/home/tickets/*/photos', (r) => {
    photos.push({ ct: r.request().headers()['content-type'] ?? '', size: r.request().postDataBuffer()?.length ?? 0 });
    mock.calls.push({ method: 'POST', path: new URL(r.request().url()).pathname.replace(/^.*api\/v1\//, ''), body: null });
    return photoStatus === 201 ? json(r, { ticket: {} }, 201) : json(r, { code: 'ticket_not_new', user_message: 'x', retryable: false }, photoStatus);
  });
  await page.goto(`/#/home/${route}`);
  await home(page).waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await settle(page);
  return { mock, photos };
}

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

test.describe('HOME-V3-FOLLOWUP-B-2431 wall calendar event and ticket photos', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the sizes are set inside the tests');
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('a wall panel adds an event to the family calendar through its own route, and books nothing', async ({ page }) => {
    const { mock } = await open(page, 'calendar', { kiosk: true });
    await expect(home(page).locator('[data-act="p2CalTab"]')).toHaveCount(0); // no shared-room booking on a wall panel
    await home(page).locator('[data-act="p2CalNew"]').click();
    const sheet = home(page).locator('[data-sheet="calNew"]');
    await expect(sheet).toBeVisible();
    await sheet.locator('input.inp').fill('ארוחת ערב משפחתית');
    await sheet.locator('[data-act="p2CalSave"]').click();
    await expect.poll(() => mock.calls.filter((c) => c.path === 'home/wall/events').length).toBe(1);
    const b = mock.calls.find((c) => c.path === 'home/wall/events')!.body as Record<string, unknown>;
    expect(b.title).toBe('ארוחת ערב משפחתית');
    expect(Object.keys(b).every((k) => ['calendar_id', 'end', 'start', 'title'].includes(k))).toBe(true); // never a kind, a room or a series
    expect(mock.calls.filter((c) => c.path.startsWith('calendar/events')).length).toBe(0);
    await expect(sheet).toHaveCount(0);
  });

  test('a resident (not a wall panel) still uses the calendar module route', async ({ page }) => {
    const { mock } = await open(page, 'calendar');
    await home(page).locator('[data-act="p2CalNew"]').click();
    const sheet = home(page).locator('[data-sheet="calNew"]');
    await sheet.locator('input.inp').fill('חוג');
    await sheet.locator('[data-act="p2CalSave"]').click();
    await expect.poll(() => mock.calls.filter((c) => c.path === 'calendar/events').length).toBe(1);
    expect(mock.calls.filter((c) => c.path === 'home/wall/events').length).toBe(0);
  });

  test('the new ticket attaches photos: preview, remove, at most three, sent after the ticket', async ({ page }) => {
    const { mock, photos } = await open(page, 'tickets');
    await home(page).locator('[data-act="p2TkNew"]').click();
    const sheet = home(page).locator('[data-sheet="tkNew"]');
    await expect(sheet.locator('.tkpick')).toContainText('צרף תמונה');
    const input = sheet.locator('.tkpick input[type="file"]');
    await expect(input).toHaveAttribute('accept', 'image/jpeg,image/png');
    // a non-image is refused here already (the server refuses it too)
    await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(sheet.locator('.tkph .ph')).toHaveCount(0);
    await input.setInputFiles([1, 2].map((i) => ({ name: `p${i}.png`, mimeType: 'image/png', buffer: PNG })));
    await expect(sheet.locator('.tkph .ph')).toHaveCount(2);
    await sheet.locator('[data-act="p2TkPhDel"]').first().click();
    await expect(sheet.locator('.tkph .ph')).toHaveCount(1);
    await input.setInputFiles([1, 2, 3].map((i) => ({ name: `q${i}.png`, mimeType: 'image/png', buffer: PNG })));
    await expect(sheet.locator('.tkph .ph')).toHaveCount(3); // the fourth is refused
    await expect(sheet.locator('.tkpick')).toHaveAttribute('aria-disabled', 'true');
    await sheet.locator('.chip2').first().click();
    await sheet.locator('[data-act="p2TkSend"]').click();
    await expect.poll(() => photos.length).toBe(3);
    const order = mock.calls.filter((c) => c.path.startsWith('home/tickets')).map((c) => c.path);
    expect(order[0]).toBe('home/tickets');
    expect(order.slice(1)).toEqual(['home/tickets/t9/photos', 'home/tickets/t9/photos', 'home/tickets/t9/photos']);
    expect(photos.every((p) => p.ct.startsWith('multipart/form-data') && p.size > PNG.length)).toBe(true);
    await expect(sheet).toHaveCount(0);
  });

  test('a refused photo still sends the ticket and says so', async ({ page }) => {
    const { mock } = await open(page, 'tickets', {}, 409);
    await home(page).locator('[data-act="p2TkNew"]').click();
    const sheet = home(page).locator('[data-sheet="tkNew"]');
    await sheet.locator('.tkpick input[type="file"]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
    await sheet.locator('.chip2').first().click();
    await sheet.locator('[data-act="p2TkSend"]').click();
    await expect.poll(() => mock.calls.filter((c) => c.path === 'home/tickets').length).toBe(1);
    await expect(home(page).locator('.toast2').filter({ hasText: 'התמונה לא צורפה' })).toBeVisible();
  });

  test('an open ticket keeps "add note" only', async ({ page }) => {
    await open(page, 'tickets');
    await home(page).locator('[data-act="p2Ticket"]').first().click();
    const sheet = home(page).locator('[data-sheet="ticket"]');
    await expect(sheet.locator('[data-act="p2TkNote"]')).toHaveCount(1);
    await expect(sheet.locator('.tkpick, input[type="file"]')).toHaveCount(0);
  });

  test('the tickets module off leaves no ticket action and no photo picker', async ({ page }) => {
    await open(page, 'tickets', { features: { tickets: { on: false, create: false, view: false } } });
    await expect(home(page).locator('[data-act="p2TkNew"], .tkpick, input[type="file"]')).toHaveCount(0);
    await expect(home(page).locator('.empty h2')).toHaveText('המסך הזה לא זמין');
  });

  for (const [size, w, h] of [['desktop', 1280, 800], ['tablet', 1024, 768], ['phone', 390, 844]] as [string, number, number][]) {
    test(`no scrolling at ${size} with three photos in the new-ticket sheet and on the wall panel's new event`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, 'tickets', { worst: true });
      await home(page).locator('[data-act="p2TkNew"]').click();
      const sheet = home(page).locator('[data-sheet="tkNew"]');
      await sheet.locator('.tkpick input[type="file"]').setInputFiles([1, 2, 3].map((i) => ({ name: `p${i}.png`, mimeType: 'image/png', buffer: PNG })));
      await expect(sheet.locator('.tkph .ph')).toHaveCount(3);
      await settle(page);
      expect(await overflow(page)).toEqual([]);
      const acts = await sheet.locator('.dlg-acts .hbtn').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }));
      expect(acts.length).toBe(3);
      for (const [bw, bh] of acts) expect(bw > 60 && bh >= 44).toBe(true);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await open(page, 'calendar', { kiosk: true, worst: true });
      await home(page).locator('[data-act="p2CalNew"]').click();
      await settle(page);
      expect(await overflow(page)).toEqual([]);
    });
  }
});
