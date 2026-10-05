import { test, expect, type Page } from '@playwright/test';
import { ADMIN, EDITOR, OPERATOR, SIZES, VIEW_ONLY, fresh, groupsPage, hashOf, install, open, pcards, playersPage, sectionIds, shot, type St } from './media-players-harness';

// CR-016 S2: the players page ("מולטימדיה › נגנים ורמקולים"), its card, the floor "עצור מוזיקה" confirmation, the layout editor of the tab and
// the groups page ("קבוצות": live groups, static groups, saved groups, the editor), in demo / mock mode: a MOCKED backend (page.route on
// api/v1, tests/media-players-harness.ts) answered by the S0 client's MOCK stores - BOTH houses (with a music library: speakers, a
// receiver with zones, a cross-brand group; without one: six Sonos, no floors). Every state: loading, empty, error, ready, view-only,
// unplaced, unavailable, no library, rate-limited, join failed, group conflict; 1440 / 820 / 390, light and dark, RTL. The player panel
// (`<media-player-panel>`) is S3's: a stub element stands in for it here, only to prove the wiring (`.deviceKey`, `.open`, `@close`, the
// address). Screenshots: docs/design/evidence/CR-016/s2/.
//   SW_BASE_URL=http://127.0.0.1:4491/ npx playwright test tests/evidence-media-players.spec.ts --project=desktop --workers=1

const card = (page: Page, key: string) => page.locator(`sw-app multimedia-players media-player-card[data-player-card="${key}"]`);
const gcard = (page: Page, key: string) => page.locator(`sw-app multimedia-groups [data-group-card="${key}"]`);
const preset = (page: Page, name: string) => page.locator('sw-app multimedia-groups [data-preset]', { hasText: name });
const callsTo = (st: St, re: RegExp) => st.calls.filter((c) => re.test(c.path));
const BRANDS = /Home Assistant|Music Assistant|Ingress|Companion|Sonos|\bHA\b/;

async function openMenuAction(page: Page, id: string) {
  await page.locator('sw-app [data-profile-menu]').click();
  await page.locator(`sw-app sw-user-menu [data-menu-screen-edit="${id}"]`).click();
}

test.describe('players page (mocked backend)', () => {
  let st: St;
  test.beforeEach(async ({ page }) => {
    st = fresh(ADMIN);
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('sw.nav.order');
        localStorage.removeItem('sw.security.section');
      } catch {
        /* storage unavailable */
      }
    });
  });

  test('the tab row: three tabs with their counts; the players and groups tabs leave when the installation has none', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/players');
    const tabs = page.locator('sw-app .subnav sw-tabs');
    await expect(tabs).toHaveCount(1);
    await expect(tabs.locator('a')).toHaveCount(3);
    await expect(tabs.locator('a[aria-current="page"]')).toContainText('נגנים ורמקולים');
    await expect(tabs).toContainText('מסכים');
    await expect(tabs).toContainText('קבוצות');
    await expect(tabs.locator('a', { hasText: 'נגנים ורמקולים' })).toContainText('16');
    await tabs.locator('a', { hasText: 'קבוצות' }).click();
    await expect.poll(() => hashOf(page)).toContain('/multimedia/groups');
    // none of the kind: the row is gone (one tab: no row)
    st.emptyList = true;
    await open(page, '/multimedia/screens');
    await expect(page.locator('sw-app .subnav sw-tabs')).toHaveCount(0);
  });

  test('the section is entered through the screens page: the players and groups tabs are offered there too (owner report 2026-10-01)', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens'); // a fresh load of the section's first page, never the players page first
    const tabs = page.locator('sw-app .subnav sw-tabs');
    await expect(tabs.locator('a')).toHaveCount(3);
    await expect(tabs.locator('a[aria-current="page"]')).toContainText('מסכים');
    await expect(tabs.locator('a', { hasText: 'נגנים ורמקולים' })).toBeVisible();
    await tabs.locator('a', { hasText: 'נגנים ורמקולים' }).click();
    await expect.poll(() => hashOf(page)).toContain('/multimedia/players');
  });

  test('ready: one card per physical speaker, player and receiver, by floor, the unplaced last; a member plays with its leader', async ({ page }) => {
    await install(page, st);
    for (const size of ['1440', '820', '390'] as const) {
      await open(page, '/multimedia/players', size);
      await expect(pcards(page)).toHaveCount(16);
      await shot(page, 'players-ready-ma', size);
    }
    await open(page, '/multimedia/players');
    expect(await sectionIds(page)).toEqual(['g', 'u1', 'b', 'none']);
    expect(await playersPage(page).locator('section[data-group] h2').allTextContents()).toEqual(['קומת קרקע', 'קומה 1', 'מרתף', 'לא משויכים']);
    await expect(playersPage(page).locator('.amb')).toContainText('7 מנגנים מתוך 16');
    await expect(playersPage(page).locator('.amb')).toContainText('2 לא זמין');
    // a leader: the title of the song, the group chip; a member: "מנגן עם סלון", no title of its own
    const liv = card(page, 'mp-liv');
    await expect(liv).toContainText('רמקול סלון');
    await expect(liv.locator('.gchip')).toContainText('2 חדרים');
    await expect(liv.locator('small.now')).toContainText('Blue in Green');
    await expect(liv.locator('.vrock .vv')).toContainText('34');
    const kit = card(page, 'mp-kit');
    await expect(kit.locator('.tx')).toContainText('מנגן עם סלון');
    await expect(kit.locator('small.now')).toHaveCount(0);
    await expect(kit.locator('.gchip')).toHaveCount(0);
    // a station, a receiver (a source tile, power instead of play), an unavailable one (dashed, since when), an unplaced one
    await expect(card(page, 'mp-per').locator('.cov .live')).toBeVisible();
    await expect(card(page, 'mp-ampl').locator('.cov.rcv')).toContainText('טלוויזיה');
    await expect(card(page, 'mp-ampl').locator('.pw')).toHaveCount(1);
    await expect(card(page, 'mp-gym').locator('.pcard.un')).toHaveCount(1);
    await expect(card(page, 'mp-gym')).toContainText(/לא זמין מאז \d\d:\d\d/);
    await expect(playersPage(page).locator('section[data-group="none"] media-player-card')).toHaveCount(3);
    // the operator screen names no product: no Home Assistant, no Music Assistant, no brand, no logo, no hint paragraph
    expect(await playersPage(page).innerText()).not.toMatch(BRANDS);
    await expect(playersPage(page).locator('img')).toHaveCount(0);
    await expect(playersPage(page).locator('p')).toHaveCount(0);
    // RTL: the cover sits at the start (right) edge, the name left of it
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const cov = await liv.locator('.cov').boundingBox();
    const tx = await liv.locator('.tx').boundingBox();
    expect(cov!.x).toBeGreaterThan(tx!.x);
  });

  test('ready, dark scheme (devices.scheme): the same screen, dark glass', async ({ page }) => {
    st.scheme = 'dark';
    await install(page, st);
    for (const size of ['1440', '390'] as const) {
      await open(page, '/multimedia/players', size);
      await expect(pcards(page)).toHaveCount(16);
      await expect(playersPage(page)).toHaveAttribute('data-devices-scheme', 'dark');
      await shot(page, 'players-ready-ma-dark', size);
    }
  });

  test('the house without a music library and without floors: ONE list "כל החדרים" and the unplaced section; no floor menu', async ({ page }) => {
    st = fresh(ADMIN, 'sonos');
    await install(page, st);
    for (const size of ['1440', '820', '390'] as const) {
      await open(page, '/multimedia/players', size);
      await expect(pcards(page)).toHaveCount(6);
      await shot(page, 'players-ready-sonos', size);
    }
    await open(page, '/multimedia/players');
    expect(await sectionIds(page)).toEqual(['all', 'none']);
    expect(await playersPage(page).locator('section[data-group] h2').allTextContents()).toEqual(['כל החדרים', 'לא משויכים']);
    await expect(playersPage(page).locator('[data-floor-menu]')).toHaveCount(0);
    await expect(playersPage(page).locator('[data-floor-pause]')).toHaveCount(0); // no floors: no floor pause
    // the room chips are the filter
    await playersPage(page).locator('.rc[data-room="kitchen"]').click();
    await expect(pcards(page)).toHaveCount(1);
    await expect.poll(() => hashOf(page)).toContain('area=kitchen');
    await playersPage(page).locator('.rc[data-room="none"]').click();
    await expect(pcards(page)).toHaveCount(1);
    await expect(card(page, 'mp-bath')).toBeVisible();
    expect(await playersPage(page).innerText()).not.toMatch(BRANDS);
  });

  test('loading, empty and error states', async ({ page }) => {
    await install(page, st);
    st.listDelay = 4000;
    for (const size of ['1440', '390'] as const) {
      await open(page, '/multimedia/players', size);
      await expect(playersPage(page).locator('[data-mm-state="loading"]')).toBeVisible();
      await shot(page, 'players-loading', size);
    }
    st.listDelay = 0;
    st.emptyList = true;
    for (const size of ['1440', '390'] as const) {
      await open(page, '/multimedia/players', size);
      await expect(playersPage(page).locator('[data-mm-state="empty"]')).toBeVisible();
      await expect(playersPage(page).locator('[data-mm-state="empty"] a[href="#/system/multimedia"]')).toHaveCount(1); // the administrator's way to the settings
      await shot(page, 'players-empty', size);
    }
    st.emptyList = false;
    st.failList = true;
    for (const size of ['1440', '390'] as const) {
      await open(page, '/multimedia/players', size);
      await expect(playersPage(page).locator('[data-mm-state="error"]')).toBeVisible();
      await shot(page, 'players-error', size);
    }
    st.failList = false;
    await playersPage(page).locator('[data-mm-retry]').click();
    await expect(pcards(page)).toHaveCount(16);
    // closed: no permission, and the feature switched off
    st.perms = ['devices.read'];
    await open(page, '/multimedia/players');
    await expect(playersPage(page).locator('[data-mm-state="forbidden"]')).toBeVisible();
    st.perms = ADMIN;
    st.enabled = false;
    await open(page, '/multimedia/players');
    await expect(playersPage(page).locator('[data-mm-state="disabled"]')).toBeVisible();
  });

  test('a holder of media.read only: the cards show, nothing can be pressed but the cover', async ({ page }) => {
    st.perms = VIEW_ONLY;
    await install(page, st);
    for (const size of ['1440', '390'] as const) {
      await open(page, '/multimedia/players', size);
      await expect(pcards(page)).toHaveCount(16);
      await shot(page, 'players-view-only', size);
    }
    await expect(playersPage(page).locator('media-player-card .pk')).toHaveCount(0);
    await expect(playersPage(page).locator('media-player-card .vrock')).toHaveCount(0);
    await expect(playersPage(page).locator('media-player-card .pcard:not(.un) .rbtn')).toHaveCount(0); // (an unavailable card keeps "נגן": it opens the panel to look)
    await expect(playersPage(page).locator('media-player-card .cov').first()).toBeVisible();
    await expect(playersPage(page).locator('[data-floor-pause]')).toHaveCount(0);
    await page.setViewportSize(SIZES['1440']);
    await page.locator('sw-app [data-profile-menu]').click();
    await expect(page.locator('sw-app sw-user-menu [data-menu-screen-edit]')).toHaveCount(0);
  });

  test('unavailable and unplaced: the state filter, the floor menu and the room chips reach them', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/players');
    await playersPage(page).locator('[data-state-filter="unavailable"]').click();
    await expect(pcards(page)).toHaveCount(2);
    await expect(card(page, 'mp-gym').locator('.pcard')).toHaveAttribute('data-state', 'un');
    await expect(card(page, 'mp-bath').locator('.pcard')).toHaveAttribute('data-state', 'un');
    await expect.poll(() => hashOf(page)).toContain('state=unavailable');
    await shot(page, 'players-unavailable', '1440');
    await playersPage(page).locator('[data-state-filter="all"]').click();
    await playersPage(page).locator('[data-state-filter="playing"]').click();
    await expect(pcards(page)).toHaveCount(7);
    await playersPage(page).locator('[data-state-filter="all"]').click();
    // the floor menu: floors with their counts, the unplaced last
    await playersPage(page).locator('[data-floor-menu]').click();
    expect(await playersPage(page).locator('[data-floor-menu] [role=option]').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))).toEqual(['', 'g', 'u1', 'b', 'none']);
    await playersPage(page).locator('[data-floor-menu] [role=option][data-id="none"]').click();
    await expect(pcards(page)).toHaveCount(3);
    expect(await sectionIds(page)).toEqual(['none']);
    await expect(playersPage(page).locator('.rc[data-room="none"]')).toHaveText('ללא חדר');
    await shot(page, 'players-unplaced', '1440');
    await shot(page, 'players-unplaced', '390');
    // a search that finds nothing, and the way out
    await playersPage(page).locator('[data-search]').fill('אין כזה');
    await expect(playersPage(page).locator('[data-mm-state="filtered"]')).toBeVisible();
    await playersPage(page).locator('[data-clear-filters]').click();
    await expect(pcards(page)).toHaveCount(16);
  });

  test('no music library: the card works as before, the page says the library is unavailable', async ({ page }) => {
    st.library = 'unavailable';
    await install(page, st);
    for (const size of ['1440', '390'] as const) {
      await open(page, '/multimedia/players', size);
      await expect(pcards(page)).toHaveCount(16);
      await expect(playersPage(page).locator('[data-lib-state="unavailable"]')).toContainText('ספרייה לא זמינה');
      await shot(page, 'players-no-library', size);
    }
    await card(page, 'mp-liv').locator('.pk').click();
    await expect.poll(() => callsTo(st, /mp-liv\/commands/).length).toBe(1);
  });

  test('commands: one press, one command to the right device; a member is told to its own key (the server resolves the leader)', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/players');
    await card(page, 'mp-liv').locator('.pk').click();
    await expect.poll(() => callsTo(st, /mp-liv\/commands/).map((c) => c.body)).toContainEqual(expect.objectContaining({ command: 'transport', action: 'play_pause' }));
    await expect(card(page, 'mp-liv').locator('.pk')).toHaveAttribute('aria-label', /המשך/);
    await card(page, 'mp-kit').locator('.pk').click();
    await expect.poll(() => callsTo(st, /mp-kit\/commands/).length).toBe(1);
    // volume: a step of two, mute, the receiver's power
    await card(page, 'mp-per').locator('.vrock button[aria-label="הגבר"]').click();
    await expect.poll(() => callsTo(st, /mp-per\/commands/).map((c) => c.body)).toContainEqual(expect.objectContaining({ command: 'volume_set', level: 42 }));
    await card(page, 'mp-per').locator('button[aria-label^="השתק"]').click();
    await expect.poll(() => callsTo(st, /mp-per\/commands/).map((c) => c.body)).toContainEqual(expect.objectContaining({ command: 'mute', muted: true }));
    // the receiver's inputs
    await card(page, 'mp-ampl').locator('button[aria-haspopup="menu"]').click();
    await expect(card(page, 'mp-ampl').locator('[role="menuitemradio"]')).toHaveCount(4);
    await shot(page, 'players-receiver-sources', '1440');
    await card(page, 'mp-ampl').locator('[role="menuitemradio"]', { hasText: 'רדיו' }).click();
    await expect.poll(() => callsTo(st, /mp-ampl\/commands/).map((c) => c.body)).toContainEqual(expect.objectContaining({ command: 'source', source_id: 'Tuner' }));
    await card(page, 'mp-ampl').locator('.pw').click();
    await expect.poll(() => callsTo(st, /mp-ampl\/commands/).map((c) => c.body)).toContainEqual(expect.objectContaining({ command: 'power_off' }));
    // an off player: its power button, no transport
    await expect(card(page, 'mp-off').locator('.pw')).toHaveCount(1);
    await expect(card(page, 'mp-off').locator('.pk')).toHaveCount(0);
    // a refused command says so shortly, on the card
    st.rateLimit = false;
    await card(page, 'mp-bath').locator('.pcard').hover(); // restored and unknown: nothing to press
    await expect(card(page, 'mp-bath').locator('.pk')).toHaveCount(0);
  });

  test('rate-limited: a press over the limit is dropped with a shake, no text', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/players');
    st.rateLimit = true;
    const before = callsTo(st, /mp-liv\/commands/).length;
    await card(page, 'mp-liv').locator('.vrock button[aria-label="הגבר"]').click();
    await expect(card(page, 'mp-liv').locator('.vrock.shake')).toHaveCount(1);
    await shot(page, 'players-rate-limited', '1440');
    expect(callsTo(st, /mp-liv\/commands/).length).toBe(before + 1);
    await expect(card(page, 'mp-liv').locator('small.bad')).toHaveCount(0); // no sentence for a dropped press
    await expect(card(page, 'mp-liv').locator('.vrock.shake')).toHaveCount(0);
  });

  test('a command the player does not confirm says so on the card, shortly', async ({ page }) => {
    st.actionStatus = 'unknown';
    await install(page, st);
    await open(page, '/multimedia/players');
    await card(page, 'mp-liv').locator('.pk').click();
    await expect(card(page, 'mp-liv').locator('small.bad')).toContainText('הנגן לא אישר את הפקודה', { timeout: 12_000 });
    await shot(page, 'players-not-confirmed', '1440');
  });

  test('group conflict: a speaker grouped in one layer and not the other says "קיבוץ לא תואם"', async ({ page }) => {
    await install(page, st);
    for (const size of ['1440', '390'] as const) {
      await open(page, '/multimedia/players', size);
      const gst = card(page, 'mp-gst');
      await expect(gst.locator('.gchip.warn')).toContainText('קיבוץ לא תואם');
      await gst.scrollIntoViewIfNeeded();
      await shot(page, 'players-group-conflict', size);
    }
  });

  test('floor "עצור מוזיקה": confirmed once, with the server\'s preview; the result by room; only for media.bulk', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/players');
    await expect(playersPage(page).locator('[data-floor-pause]')).toHaveCount(2); // the ground floor and floor 1 play something; the basement and the unplaced do not
    await playersPage(page).locator('[data-floor-pause="g"]').click();
    const dlg = playersPage(page).locator('media-group-dialog [data-group-dialog="confirm"]');
    await expect(dlg).toHaveAttribute('open', ''); // (a sw-dialog host has no box of its own)
    await expect(dlg).toHaveAttribute('heading', /לעצור 5 נגנים/);
    await shot(page, 'players-pause-confirm', '1440');
    await dlg.locator('[data-gd-details] summary').click();
    await dlg.locator('[data-gd-confirm]').click();
    await expect(playersPage(page).locator('media-group-dialog [data-group-dialog="result"] [data-gd-result="ok"]')).toBeVisible();
    await expect.poll(() => callsTo(st, /^multimedia\/actions$/).map((c) => c.body)).toContainEqual(expect.objectContaining({ scope: 'floor', id: 'g', kind: 'players_pause', confirmed: true }));
    await shot(page, 'players-pause-result', '1440');
    await playersPage(page).locator('media-group-dialog [data-gd-cancel]').click();
    await expect(card(page, 'mp-per').locator('.pk')).toHaveAttribute('aria-label', /המשך/);
    // without media.bulk the button is not there
    st.perms = OPERATOR;
    await open(page, '/multimedia/players');
    await expect(playersPage(page).locator('[data-floor-pause]')).toHaveCount(0);
  });

  test('address: the room chip, the search and the state filter live in the address; Back keeps its meaning', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/players?area=living');
    await expect(pcards(page)).toHaveCount(2);
    await expect(playersPage(page).locator('.rc[data-room="living"]')).toHaveAttribute('aria-pressed', 'true');
    await playersPage(page).locator('.rc[data-room=""]').click();
    await expect(pcards(page)).toHaveCount(16);
    await playersPage(page).locator('[data-search]').fill('חדר הורים');
    await expect(pcards(page)).toHaveCount(1);
    await expect.poll(() => hashOf(page)).toContain('q=');
  });

  test('the address (?player=) opens the player panel (the page imports it itself) and Back closes it', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/players');
    await card(page, 'mp-liv').locator('.cov').click();
    await expect.poll(() => hashOf(page)).toContain('player=mp-liv');
    await expect(page.locator('sw-app multimedia-players media-player-panel')).toHaveCount(1);
    expect(await page.locator('sw-app multimedia-players media-player-panel').evaluate((e) => (e as unknown as { deviceKey: string }).deviceKey)).toBe('mp-liv');
    await page.locator('sw-app multimedia-players media-player-panel').evaluate((e) => e.dispatchEvent(new CustomEvent('close')));
    await expect.poll(() => hashOf(page)).not.toContain('player=');
    await expect(page.locator('sw-app multimedia-players media-player-panel')).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------------------------- the editor of the tab

  test('edit mode: order, "מועדפים" and hide for this tab, saved for everyone in the layout document\'s `tabs.players`', async ({ page }) => {
    st.perms = EDITOR;
    await install(page, st);
    await open(page, '/multimedia/players');
    await openMenuAction(page, 'multimedia-players-layout');
    await expect(playersPage(page).locator('[data-mm-editbar]')).toBeVisible();
    await expect.poll(() => hashOf(page)).toContain('edit=1');
    await expect(page.locator('sw-app .subnav sw-tabs')).toHaveCount(0); // the tab row leaves while editing
    const panel = playersPage(page).locator('multimedia-edit-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-mm-size]')).toHaveCount(0); // a player card has one size
    await expect(panel.locator('[data-mm-phone-toggle]')).toHaveCount(0);
    await shot(page, 'players-edit', '1440');
    await panel.locator('[data-mm-on="mp-off"]').uncheck();
    await panel.locator('[data-mm-pin="mp-per"]').click();
    await panel.locator('[data-mm-row="mp-hal"] [data-mm-up]').click();
    await shot(page, 'players-edit-changed', '1440');
    await playersPage(page).locator('[data-mm-save]').click();
    await expect.poll(() => callsTo(st, /^multimedia\/layout$/).filter((c) => c.method === 'PUT').length).toBe(1);
    const sent = callsTo(st, /^multimedia\/layout$/).find((c) => c.method === 'PUT')!.body as { layout: { tabs: { players: { pinned: string[]; cards: Record<string, { on: boolean }>; order: string[]; group_by: string } }; pinned: string[] } };
    expect(sent.layout.tabs.players.pinned).toEqual(['mp-per']);
    expect(sent.layout.tabs.players.cards).toEqual({ 'mp-off': { on: false } });
    expect(sent.layout.tabs.players.order).toContain('mp-hal');
    expect(sent.layout.pinned).toEqual([]); // the screens' own part is untouched
    await expect(pcards(page)).toHaveCount(15);
    expect(await sectionIds(page)).toEqual(['pinned', 'g', 'u1', 'b', 'none']);
    await expect(playersPage(page).locator('section[data-group="pinned"] h2')).toHaveText('מועדפים');
    await shot(page, 'players-edited', '1440');
    // the screens page is not disturbed by the new tab
    expect(((st.screens.layoutState.layout as unknown) as { tabs?: unknown }).tabs).toBeTruthy();
    // a second round: back to the default for this tab
    await openMenuAction(page, 'multimedia-players-layout');
    await playersPage(page).locator('[data-mm-reset]').click();
    await playersPage(page).locator('[data-mm-confirm-yes]').click();
    await expect(pcards(page)).toHaveCount(16);
    expect(((st.screens.layoutState.layout as unknown) as { tabs?: Record<string, unknown> }).tabs?.players).toBeUndefined();
  });

  test('the editor is for media.layout holders only', async ({ page }) => {
    st.perms = OPERATOR;
    await install(page, st);
    await open(page, '/multimedia/players?edit=1');
    await expect(playersPage(page).locator('[data-mm-editbar]')).toHaveCount(0);
    await expect.poll(() => hashOf(page)).not.toContain('edit=1');
    await page.locator('sw-app [data-profile-menu]').click();
    await expect(page.locator('sw-app sw-user-menu [data-menu-screen-edit="multimedia-players-layout"]')).toHaveCount(0);
  });
});

test.describe('groups page (mocked backend)', () => {
  let st: St;
  test.beforeEach(async ({ page }) => {
    st = fresh(ADMIN);
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('sw.nav.order');
      } catch {
        /* storage unavailable */
      }
    });
  });

  test('ready: live groups with the group slider and a slider per room, the static group and the saved groups', async ({ page }) => {
    await install(page, st);
    for (const size of ['1440', '820', '390'] as const) {
      await open(page, '/multimedia/groups', size);
      await expect(page.locator('sw-app multimedia-groups [data-group-card]')).toHaveCount(3);
      await shot(page, 'groups-ready-ma', size);
    }
    await open(page, '/multimedia/groups');
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toContainText('קבוצות');
    expect(await groupsPage(page).locator('section[data-section] h2').allTextContents()).toEqual(['פועלות עכשיו', 'קבוצות קבועות', 'קבוצות שמורות']);
    const live = gcard(page, 'mp-liv');
    await expect(live).toContainText('סלון + מטבח');
    await expect(live).toContainText('2 חדרים');
    await expect(live.locator('.gnp')).toContainText('Blue in Green');
    await expect(live.locator('.mrow')).toHaveCount(2);
    await expect(live.locator('.mrow.lead')).toContainText('מוביל');
    await expect(live.locator('[data-ungroup]')).toHaveCount(1);
    const cross = gcard(page, 'mp-stu'); // the cross-brand group, resolved to ONE consistent group of four
    await expect(cross.locator('.mrow')).toHaveCount(4);
    await expect(cross).toContainText('2 קומות');
    const stat = gcard(page, 'mp-sgrp');
    await expect(stat).toHaveAttribute('data-group-type', 'static');
    await expect(stat.locator('[data-ungroup]')).toHaveCount(0); // a static group is not dissolved from here
    await expect(groupsPage(page).locator('[data-preset]')).toHaveCount(4);
    await expect(preset(page, 'סלון + מטבח').locator('[data-preset-state="live"]')).toContainText('פועל');
    await expect(preset(page, 'סלון + מטבח').locator('[data-apply]')).toBeDisabled();
    await expect(preset(page, 'מסיבה')).toContainText('2 קומות');
    await expect(preset(page, 'מסיבה')).toContainText('עם עוצמות');
    expect(await groupsPage(page).innerText()).not.toMatch(BRANDS);
    await expect(groupsPage(page).locator('p')).toHaveCount(0);
  });

  test('ready, dark scheme', async ({ page }) => {
    st.scheme = 'dark';
    await install(page, st);
    for (const size of ['1440', '390'] as const) {
      await open(page, '/multimedia/groups', size);
      await expect(page.locator('sw-app multimedia-groups [data-group-card]')).toHaveCount(3);
      await expect(groupsPage(page)).toHaveAttribute('data-devices-scheme', 'dark');
      await shot(page, 'groups-ready-ma-dark', size);
    }
  });

  test('the group slider scales every room by the same factor; a ceiling that is set limits only that room; a slider per room', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/groups');
    const live = gcard(page, 'mp-liv');
    await live.locator('[data-group-volume]').evaluate((el) => { (el as HTMLInputElement).value = '60'; el.dispatchEvent(new Event('input')); });
    await expect.poll(() => callsTo(st, /groups\/mp-liv\/volume/).map((c) => c.body)).toContainEqual(expect.objectContaining({ level: 60, mode: 'relative' }));
    await expect(live.locator('[data-member="mp-liv"] .vv')).toHaveText('60'); // 34 x (60 / 34) = 60, under its ceiling of 70
    await expect(live.locator('[data-member="mp-kit"] .vv')).toHaveText('39'); // 22 x (60 / 34)
    // a room of its own: one command to that device
    await live.locator('[data-member="mp-kit"] input[type="range"]').evaluate((el) => { (el as HTMLInputElement).value = '25'; el.dispatchEvent(new Event('input')); });
    await expect.poll(() => callsTo(st, /mp-kit\/commands/).map((c) => c.body)).toContainEqual(expect.objectContaining({ command: 'volume_set', level: 25 }));
    // the ceiling of the living room is drawn on its slider (only where an administrator set one)
    await expect(live.locator('[data-member="mp-liv"] .cap')).toHaveCount(1);
    await expect(live.locator('[data-member="mp-kit"] .cap')).toHaveCount(0);
    // a lower group level and a group whose room has a ceiling: clamped, said by name
    await live.locator('[data-group-volume]').evaluate((el) => { (el as HTMLInputElement).value = '100'; el.dispatchEvent(new Event('input')); });
    await expect(live.locator('[data-member="mp-liv"] small')).toContainText('הוגבל לתקרה');
    await shot(page, 'groups-volume-clamped', '1440');
  });

  test('leave a room, dissolve a group', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/groups');
    await gcard(page, 'mp-stu').locator('[data-leave="mp-ter"]').click();
    await expect.poll(() => callsTo(st, /groups\/leave/).map((c) => c.body)).toContainEqual(expect.objectContaining({ device_keys: ['mp-ter'] }));
    await expect(gcard(page, 'mp-stu').locator('.mrow')).toHaveCount(3);
    await gcard(page, 'mp-liv').locator('[data-ungroup]').click();
    await expect.poll(() => callsTo(st, /groups\/leave/).map((c) => c.body)).toContainEqual(expect.objectContaining({ device_keys: ['mp-liv'] }));
    await expect(gcard(page, 'mp-liv')).toHaveCount(0);
    await expect(preset(page, 'סלון + מטבח').locator('[data-preset-state="idle"]')).toBeVisible(); // no longer live
  });

  test('a saved group: "הפעל" - the running state, then "פועל"', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/groups');
    const p = preset(page, 'קומת קרקע');
    await expect(p.locator('[data-preset-state="idle"]')).toContainText('3 חדרים');
    await p.locator('[data-apply]').click();
    await expect.poll(() => callsTo(st, /presets\/[a-f0-9]{32}\/apply/).length).toBe(1);
    await expect(p.locator('[data-preset-state="live"]')).toContainText('פועל');
    await expect(p.locator('.chipx.ok')).toHaveCount(3);
    await shot(page, 'groups-preset-live', '1440');
  });

  test('join failed: the room that did not join is named, the others are fine', async ({ page }) => {
    st.players.refuseJoin.add('mp-per');
    await install(page, st);
    for (const size of ['1440', '390'] as const) {
      await open(page, '/multimedia/groups', size);
      const p = preset(page, 'קומת קרקע');
      await p.locator('[data-apply]').click();
      await expect(p.locator('[data-preset-state="partial"]')).toContainText('פרגולה לא הצטרף');
      await expect(p.locator('.chipx.bad')).toHaveCount(1);
      await expect(p.locator('.chipx.bad')).toContainText('פרגולה');
      await p.scrollIntoViewIfNeeded();
      await shot(page, 'groups-join-failed', size);
      st.players = (await import('../src/api/media-players-mock')).resetPlayersMock('ma');
      st.players.refuseJoin.add('mp-per');
    }
  });

  test('a group of 4 rooms or more, or on more than one floor, asks once; the confirmation sends it', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/groups');
    const p = preset(page, 'מסיבה');
    await p.locator('[data-apply]').click();
    const dlg = groupsPage(page).locator('media-group-dialog [data-group-dialog="confirm"]');
    await expect(dlg).toHaveAttribute('open', '');
    await expect(dlg).toHaveAttribute('heading', 'לצרף 5 חדרים לקבוצה אחת?');
    await expect(dlg).toContainText('הקבוצה תשמיע ב־2 קומות');
    expect(callsTo(st, /\/apply/)).toHaveLength(1); // the first request was refused with the preview: nothing joined yet
    await shot(page, 'groups-confirm', '1440');
    await shot(page, 'groups-confirm', '390');
    await dlg.locator('[data-gd-confirm]').click();
    await expect.poll(() => callsTo(st, /\/apply/).map((c) => c.body)).toContainEqual(expect.objectContaining({ confirmed: true }));
    await expect(p.locator('[data-preset-state="live"]')).toContainText('פועל');
    // Cancel sends nothing
    const n = callsTo(st, /\/apply/).length;
    await preset(page, 'ערב שקט').locator('[data-apply]').click();
    await expect(groupsPage(page).locator('media-group-dialog [data-group-dialog="confirm"]')).toHaveCount(0); // 2 rooms on 1 floor: no question
    expect(callsTo(st, /\/apply/).length).toBe(n + 1);
  });

  test('the editor of saved groups (media.layout): new, edit, delete - from the user menu', async ({ page }) => {
    st.perms = EDITOR;
    await install(page, st);
    await open(page, '/multimedia/groups');
    await expect(groupsPage(page).locator('[data-preset-new]')).toHaveCount(1); // the button of the saved groups' header
    await openMenuAction(page, 'multimedia-groups-edit');
    await expect(groupsPage(page).locator('[data-mm-editbar]')).toBeVisible();
    await expect.poll(() => hashOf(page)).toContain('edit=1');
    await expect(page.locator('sw-app .subnav sw-tabs')).toHaveCount(0);
    await shot(page, 'groups-edit', '1440');
    // new
    await groupsPage(page).locator('[data-mm-editbar] [data-preset-new]').click();
    const ed = groupsPage(page).locator('media-preset-editor');
    await expect(ed.locator('[data-preset-editor="open"]')).toHaveAttribute('open', '');
    await expect(ed.locator('[data-pe-save]')).toHaveAttribute('disabled', '');
    await ed.locator('[data-pe-name]').fill('בוקר');
    await ed.locator('[data-pe-row="mp-kit"] input[type="checkbox"]').check();
    await ed.locator('[data-pe-row="mp-per"] input[type="checkbox"]').check();
    await ed.locator('[data-pe-vol="mp-per"]').fill('30');
    await ed.locator('[data-pe-vol="mp-per"]').press('Tab');
    await shot(page, 'groups-editor', '1440');
    await shot(page, 'groups-editor', '390');
    await ed.locator('[data-pe-save]').click();
    await expect.poll(() => callsTo(st, /groups\/presets$/).filter((c) => c.method === 'POST').map((c) => c.body)).toContainEqual(
      expect.objectContaining({ name: 'בוקר', leader_key: 'mp-kit', member_keys: ['mp-per'], volumes: { 'mp-per': 30 } }));
    await expect(groupsPage(page).locator('[data-preset]')).toHaveCount(5);
    // edit: rename
    await preset(page, 'בוקר').locator('[data-preset-edit]').click();
    await ed.locator('[data-pe-name]').fill('בוקר טוב');
    await ed.locator('[data-pe-save]').click();
    await expect.poll(() => callsTo(st, /groups\/presets\/[a-f0-9]{32}$/).filter((c) => c.method === 'PUT').map((c) => c.body)).toContainEqual(expect.objectContaining({ name: 'בוקר טוב', base_revision: 1 }));
    await expect(preset(page, 'בוקר טוב')).toHaveCount(1);
    // delete, after a question
    await preset(page, 'בוקר טוב').locator('[data-preset-delete]').click();
    await expect(groupsPage(page).locator('[data-preset-delete-dialog="open"]')).toHaveAttribute('open', '');
    await groupsPage(page).locator('[data-pd-no]').click();
    expect(callsTo(st, /presets\/[a-f0-9]{32}\?base_revision/).filter((c) => c.method === 'DELETE')).toHaveLength(0);
    await preset(page, 'בוקר טוב').locator('[data-preset-delete]').click();
    await groupsPage(page).locator('[data-pd-yes]').click();
    await expect(groupsPage(page).locator('[data-preset]')).toHaveCount(4);
    await groupsPage(page).locator('[data-mm-done]').click();
    await expect.poll(() => hashOf(page)).not.toContain('edit=1');
  });

  test('a holder of media.read only: the groups show, nothing starts, nothing changes', async ({ page }) => {
    st.perms = VIEW_ONLY;
    await install(page, st);
    for (const size of ['1440', '390'] as const) {
      await open(page, '/multimedia/groups', size);
      await expect(groupsPage(page).locator('[data-preset]')).toHaveCount(4);
      await shot(page, 'groups-view-only', size);
    }
    await expect(groupsPage(page).locator('[data-apply]')).toHaveCount(0);
    await expect(groupsPage(page).locator('[data-ungroup]')).toHaveCount(0);
    await expect(groupsPage(page).locator('[data-group-volume]')).toHaveCount(0);
    await expect(groupsPage(page).locator('[data-preset-new]')).toHaveCount(0);
    await page.setViewportSize(SIZES['1440']);
    await page.locator('sw-app [data-profile-menu]').click();
    await expect(page.locator('sw-app sw-user-menu [data-menu-screen-edit]')).toHaveCount(0);
  });

  test('the house without a music library: a helper group is a shortcut, never joinable; no live group says so', async ({ page }) => {
    st = fresh(ADMIN, 'sonos');
    await install(page, st);
    for (const size of ['1440', '390'] as const) {
      await open(page, '/multimedia/groups', size);
      await expect(page.locator('sw-app multimedia-groups [data-group-card]')).toHaveCount(2);
      await shot(page, 'groups-ready-sonos', size);
    }
    const helper = groupsPage(page).locator('[data-group-type="helper"]');
    await expect(helper).toContainText('קבוצה וירטואלית');
    await expect(helper.locator('[data-ungroup]')).toHaveCount(0);
    await expect(helper.locator('[data-leave]')).toHaveCount(0);
    await gcard(page, 'mp-liv').locator('[data-ungroup]').click();
    await expect(groupsPage(page).locator('section[data-section="live"] [data-mm-state], section[data-section="live"] .statebox')).toContainText('אין קבוצה פעילה');
    await shot(page, 'groups-none-live', '1440');
  });

  test('loading, error and the closed states', async ({ page }) => {
    await install(page, st);
    st.listDelay = 4000;
    await open(page, '/multimedia/groups', '1440');
    await expect(groupsPage(page).locator('[data-mm-state="loading"]')).toBeVisible();
    await shot(page, 'groups-loading', '1440');
    st.listDelay = 0;
    st.failList = true;
    for (const size of ['1440', '390'] as const) {
      await open(page, '/multimedia/groups', size);
      await expect(groupsPage(page).locator('[data-mm-state="error"]')).toBeVisible();
      await shot(page, 'groups-error', size);
    }
    st.failList = false;
    st.perms = ['devices.read'];
    await open(page, '/multimedia/groups');
    await expect(groupsPage(page).locator('[data-mm-state="forbidden"]')).toBeVisible();
  });
});
