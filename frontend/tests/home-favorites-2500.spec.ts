import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockFavs, type FavOpts } from './home-favorites-2500-mocks';

// HOME-FAVORITES-2500 (owner 22.11 Q75-Q79 = the recommendation; docs/changes/HOME-FAVORITES-2500.md): the favourites grid keeps the
// person's order and fills a hole with "+ הוסף" (Q78), a long press in "עריכה" drags a tile (Q77, the arrows stay), a leaving / night
// scene offers to lock the doors and arm the alarm, always confirmed and with the alarm's code (Q79), scene editing follows scene.manage at
// any scope (Q75), and the air conditioner has no "hold" (Q76). Mocked backend; nothing is sent anywhere.

const TABLET = { width: 1024, height: 768 };
const PHONE = { width: 390, height: 844 };
const home = (page: Page) => page.locator('sw-home');
const ready = (page: Page) => expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);

async function open(page: Page, route: string, size = TABLET, o: FavOpts = {}) {
  await page.setViewportSize(size);
  await page.goto('about:blank');
  const mock = await mockFavs(page, o);
  await page.goto(`/#/home/${route}`);
  await home(page).waitFor();
  await ready(page);
  await settle(page);
  return mock;
}

/** No scroll anywhere (page, shell, main area). */
async function noScroll(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
    const out: string[] = [];
    const doc = document.scrollingElement!;
    if (doc.scrollHeight - doc.clientHeight > 1) out.push('document');
    for (const sel of ['.hs', '#main', '.hs-main', '.wgrid']) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el && el.scrollHeight - el.clientHeight > 1) out.push(`${sel} ${el.scrollHeight}>${el.clientHeight}`);
    }
    return out;
  });
}

/** The grid's cells in DOM order: a favourite by its list index, a hole as "+<at>". */
const cells = (page: Page) => home(page).locator('.wgrid > *').evaluateAll((els) => els.map((e) => ((e as HTMLElement).dataset.ix != null ? (e as HTMLElement).dataset.ix! : '+' + (e as HTMLElement).dataset.at)));
const lastFavPut = (m: { calls: { path: string; body: unknown }[] }) => {
  const c = [...m.calls].reverse().find((x) => x.path === 'home/prefs' && (x.body as { favourites?: unknown }).favourites);
  return ((c?.body as { favourites: Record<string, { t: string; id?: string }[]> } | undefined)?.favourites.living ?? []).map((f) => f.id ?? f.t);
};

async function longDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, holdMs = 650) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}
const centre = async (page: Page, sel: string) => {
  const b = (await home(page).locator(sel).first().boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
/** A point inside a tile clear of its edit buttons (they sit in the middle of the edit layer). */
const grip = async (page: Page, sel: string) => {
  const b = (await home(page).locator(sel).first().boundingBox())!;
  return { x: b.x + 10, y: b.y + 8 };
};

test.describe('HOME-FAVORITES-2500', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  test('Q78: the tablet grid keeps my order; the hole a wide tile leaves is "+ הוסף", which adds exactly there', async ({ page }) => {
    const m = await open(page, 'r/living');
    // row 1: two scenes, the heater, the wide main light, then a hole (the wide reading light does not fit); the corner light stays last
    await expect.poll(() => cells(page)).toEqual(['0', '1', '2', '3', '+4', '4', '5', '6', '7', '+8']);
    const hole = home(page).locator('.wgrid > .fav-add[data-at="4"]');
    await expect(hole).toContainText('הוסף');
    const pos = await hole.evaluate((e) => [getComputedStyle(e).gridRowStart, getComputedStyle(e).gridColumnStart]);
    expect(pos).toEqual(['1', '6']);
    const corner = await home(page).locator('.wdg[data-ix="7"]').boundingBox();
    const shade = await home(page).locator('.wdg[data-ix="6"]').boundingBox();
    expect(corner!.y).toBeGreaterThan(shade!.y + 10); // the dense flow used to pull the corner light up into the hole
    expect(await noScroll(page)).toEqual([]);
    await hole.click();
    const sheet = home(page).locator('[data-sheet="favAdd"]');
    await expect(sheet).toBeVisible();
    // the living room's own things that are not favourites yet: the shelf strip first
    await expect(sheet.locator('[data-act="favAddPick"]').first()).toContainText('פס תאורה במדפים');
    await sheet.locator('[data-act="favAddPick"]').first().click();
    await expect.poll(() => lastFavPut(m)).toEqual(['cinema', 'reading', 'switch.l_heater', 'light.l_main', 'switch.l_shelf', 'light.l_read', 'climate.living', 'cover.l_win', 'light.l_corner']);
    await expect(sheet).toHaveCount(0);
  });

  test('Q78: the phone grid (a wide tile takes the row) has no hole; the trailing cells end the list', async ({ page }) => {
    await open(page, 'r/living', PHONE);
    await expect.poll(() => cells(page)).toEqual(['0', '1', '2', '3', '4', '5', '6']);
    await home(page).locator('.pager [data-d="1"]').first().click();
    await settle(page);
    await expect.poll(() => cells(page)).toEqual(['7', '+8']);
    expect(await noScroll(page)).toEqual([]);
  });

  test('Q77: in "עריכה" a long press drags a tile onto another tile; the arrows stay', async ({ page }) => {
    const m = await open(page, 'r/living');
    await home(page).locator('[data-act="edit"]').click();
    await settle(page);
    await expect(home(page).locator('.wdg[data-ix="0"] [data-act="wgMove"]')).toHaveCount(2);
    // a short press-and-move is not a drag
    await longDrag(page, await grip(page, '.wdg[data-ix="0"]'), await centre(page, '.wdg[data-ix="3"]'), 100);
    await page.waitForTimeout(600);
    expect(lastFavPut(m)).toEqual([]);
    await longDrag(page, await grip(page, '.wdg[data-ix="0"]'), await centre(page, '.wdg[data-ix="3"]'));
    await expect.poll(() => lastFavPut(m)).toEqual(['reading', 'switch.l_heater', 'light.l_main', 'cinema', 'light.l_read', 'climate.living', 'cover.l_win', 'light.l_corner']);
    await expect(home(page).locator('.toast2').filter({ hasText: 'הסדר נשמר' })).toBeVisible();
    expect(await noScroll(page)).toEqual([]);
  });

  test('Q77: a tile dropped on a hole goes in at the hole; an arrow still moves one step', async ({ page }) => {
    const m = await open(page, 'r/living');
    await home(page).locator('[data-act="edit"]').click();
    await settle(page);
    await longDrag(page, await grip(page, '.wdg[data-ix="7"]'), await centre(page, '.fav-add[data-at="4"]'));
    await expect.poll(() => lastFavPut(m)).toEqual(['cinema', 'reading', 'switch.l_heater', 'light.l_main', 'light.l_corner', 'light.l_read', 'climate.living', 'cover.l_win']);
    await settle(page);
    await home(page).locator('.wdg[data-ix="1"] [data-act="wgMove"][data-d="-1"]').click();
    await expect.poll(() => lastFavPut(m)[0]).toBe('reading');
  });

  test('Q79: after a leaving scene - lock the doors, then arm with the code; nothing is sent before the code', async ({ page }) => {
    const m = await open(page, 'scenes', TABLET, { backDoor: true, armCode: 'pin' });
    await home(page).locator('[data-act="scene"][data-scene="leave"]').first().click();
    await expect.poll(() => m.calls.some((c) => c.path.includes('automations/scene/leave/apply'))).toBe(true);
    const lock = home(page).locator('[data-scene-next="lock"]');
    await expect(lock).toBeVisible();
    await expect(lock).toContainText('הדלת האחורית');
    expect(m.calls.some((c) => c.path.includes('lock.back'))).toBe(false);
    await lock.locator('[data-act="scNextYes"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path.includes('ha/entities/lock.back/actions')).length).toBe(1);
    const arm = home(page).locator('[data-scene-next="arm"]');
    await expect(arm).toBeVisible();
    await expect(arm).toContainText('הקוד');
    await arm.locator('[data-act="scNextYes"]').click();
    // the code pad of the alarm: no arm request until the code is entered and confirmed
    await expect(home(page).locator('.kiosk-pad [data-act="codeGo"]')).toBeDisabled();
    expect(m.calls.some((c) => c.path === 'alarm/actions')).toBe(false);
    for (const k of ['4', '8', '1', '5']) await home(page).locator(`[data-act="codeKey"][data-k="${k}"]`).click();
    await home(page).locator('[data-act="codeGo"]').click();
    await expect.poll(() => m.calls.filter((c) => c.path === 'alarm/actions').map((c) => c.body)).toEqual([expect.objectContaining({ action: 'arm_away', confirmed: true, code: '4815' })]);
  });

  test('Q79: "לא עכשיו" sends nothing; another scene suggests nothing; the personal switch turns it off', async ({ page }) => {
    const m = await open(page, 'scenes', TABLET, { backDoor: true, armCode: 'none' });
    await home(page).locator('[data-act="scene"][data-scene="evening"]').first().click();
    await expect.poll(() => m.calls.some((c) => c.path.includes('automations/scene/evening/apply'))).toBe(true);
    await page.waitForTimeout(400);
    await expect(home(page).locator('[data-scene-next]')).toHaveCount(0);
    await home(page).locator('[data-act="scene"][data-scene="night"]').first().click();
    await expect(home(page).locator('[data-scene-next="lock"]')).toBeVisible();
    await home(page).locator('[data-scene-next="lock"] [data-act="close"]').last().click();
    await expect(home(page).locator('[data-scene-next]')).toHaveCount(0);
    expect(m.calls.some((c) => c.path.includes('lock.back') || c.path === 'alarm/actions')).toBe(false);
    // off in "הגדרות › סצנות"
    await page.evaluate(() => { location.hash = '#/home/settings/scenes'; });
    await settle(page);
    const row = home(page).locator('[data-scene-suggest-set] [role="switch"]');
    await expect(row).toHaveAttribute('aria-checked', 'true');
    await row.click();
    await expect.poll(() => m.calls.some((c) => c.path === 'home/prefs' && (c.body as { layout?: { scene_suggest?: boolean } }).layout?.scene_suggest === false)).toBe(true);
    await page.evaluate(() => { location.hash = '#/home/scenes'; });
    await settle(page);
    await home(page).locator('[data-act="scene"][data-scene="night"]').first().click();
    await expect.poll(() => m.calls.filter((c) => c.path.includes('automations/scene/night/apply')).length).toBe(2);
    await page.waitForTimeout(400);
    await expect(home(page).locator('[data-scene-next]')).toHaveCount(0);
  });

  test('Q75: a home manager with scene.manage at a floor edits a scene from the home interface', async ({ page }) => {
    const m = await open(page, 'scenes', TABLET, { sceneManager: true, editable: ['evening'], policy: { home_only: true, may_switch: false } });
    await expect(home(page).locator('a[href$="settings/scenes"]').filter({ hasText: 'עריכת סצנות' })).toBeVisible();
    await page.evaluate(() => { location.hash = '#/home/settings/scenes'; });
    await settle(page);
    await expect(home(page).locator('[data-scene-edit]')).toHaveCount(1);
    await home(page).locator('[data-scene-edit="evening"]').click();
    const sheet = home(page).locator('[data-sheet="sceneEdit"]');
    await expect(sheet.locator('input.inp')).toHaveValue('ערב');
    await sheet.locator('input.inp').fill('ערב רגוע');
    await sheet.locator('[data-act="scEditNow"]').click();
    await sheet.locator('[data-act="scEditSave"]').click();
    await expect.poll(() => m.calls.find((c) => c.path === 'automations/scene/evening' && c.method === 'PUT')?.body).toMatchObject({ base_revision: 'r1', draft: { name: 'ערב רגוע', members: [{ entity_id: 'light.l_main', state: 'off' }] } });
    expect(m.calls.some((c) => c.path === 'automations/scene/capture')).toBe(true);
    // to the trash: asked in the sheet first, then sent confirmed
    await home(page).locator('[data-scene-edit="evening"]').click();
    await sheet.locator('[data-act="scDelAsk"]').click();
    expect(m.calls.some((c) => c.path.endsWith('/delete'))).toBe(false);
    await sheet.locator('[data-act="scDelYes"]').click();
    await expect.poll(() => m.calls.find((c) => c.path === 'automations/scene/evening/delete')?.body).toMatchObject({ confirm: true, base_revision: 'r1' });
  });

  test('Q75: without scene.manage there is no edit control, even where the server row says editable', async ({ page }) => {
    await open(page, 'scenes', TABLET, { sceneManager: false, editable: ['evening'] });
    await expect(home(page).locator('a[href$="settings/scenes"]').filter({ hasText: 'עריכת סצנות' })).toHaveCount(0);
    await page.evaluate(() => { location.hash = '#/home/settings/scenes'; });
    await settle(page);
    await expect(home(page).locator('[data-scene-edit]')).toHaveCount(0);
    await expect(home(page).locator('.hint').first()).toContainText('הרשאת ניהול סצנות');
  });

  test('Q76: the air conditioner offers no "hold"', async ({ page }) => {
    await open(page, 'climate');
    await expect(home(page).locator('main')).not.toContainText('החזק');
    await expect(home(page).locator('main')).not.toContainText('השאר כך');
  });
});
