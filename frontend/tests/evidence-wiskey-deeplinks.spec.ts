import { test, expect, type Locator, type Page } from '@playwright/test';
import { installStationsMock, newMock as newStationsMock, openStations, type StationsMock } from './wiskey-stations-mocks';
import { install as installPeople, newMock as newPeopleMock } from './wiskey-people-mock';
import { installAccessMock, NOW as ACCESS_NOW, url as accessUrl, type MockOptions } from './access-control-mocks';
import { FAKE_CATALOG, stubPanel, type FakeCatalog } from './wiskey-fake-ha';
import { DEEP_LINKS, linkFor } from '../src/wiskey/deep-links';

// WISKEY-DEEPLINKS-2382 (integration plan task T18): the "no dead end" links from Arx places into the embedded intercom panel, behind
// the real shell against MOCKED backends (tests/wiskey-stations-mocks.ts, wiskey-people-mock.ts, access-control-mocks.ts) and the
// fake panel page of tests/wiskey-fake-ha.ts (embed API v1) - no Home Assistant, no WisKey, no station. What it pins:
//   - the places: the station drawer's technical section, the stations / people / schedules screens (an icon in the page actions),
//     and the Settings page "בקרת כניסה" (one line per segment);
//   - each link's address is the one the table names, and following it opens the embedded panel on exactly that tab / tool (the frame
//     address the fake panel was asked for);
//   - a caller who may not open the panel (no access.read at installation scope, or the area hidden for everyone) gets no link, and the
//     panel's administrator-only tools need access.admin.read;
//   - once the panel's handshake catalog is known, a tool it does not list for this operator is not offered;
//   - no platform name in the links.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-deeplinks.spec.ts --project=desktop --workers=1

const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|\bHA\b/i;
const STATIONS = 'sw-app wiskey-stations';
/** A catalog that lists every tool the table points at (the fake panel's default one is small). */
const FULL_CATALOG: FakeCatalog = {
  tabs: FAKE_CATALOG.tabs,
  tools: [...new Set(Object.values(DEEP_LINKS).map((e) => e.target.tool).filter((t): t is string => !!t))].map((id) => ({ id, label: id })),
};

const links = (host: Locator) => host.locator('[data-wk-deeplink]');
const hrefs = (host: Locator) => links(host).evaluateAll((as) => as.map((a) => `${a.getAttribute('data-wk-deeplink')}=${a.getAttribute('href')}`));
// WISKEY-OPS-VIEWS-2400: where a capability has a native screen (Settings › תפעול האינטרקום), the link goes there (linkFor)
const expected = (ids: string[]) => ids.map((id) => `${id}=${linkFor(id)}`);
const hash = (page: Page) => page.evaluate(() => decodeURIComponent(location.hash));
/** The tab / tool of the last frame address the fake panel was asked for. */
const lastFrame = (hits: string[]) => {
  const u = hits.length ? new URL(hits[hits.length - 1]) : null;
  return u ? `${u.searchParams.get('tab')}/${u.searchParams.get('tool') ?? ''}` : '';
};

async function openList(host: Locator) {
  await expect(host).toBeVisible();
  await host.locator('[data-wk-deeplinks-toggle]').click();
  await expect(host.locator('[data-wk-deeplinks-list]')).toBeVisible();
}

async function stationsBoot(page: Page, over: Partial<StationsMock> = {}) {
  const mock = newStationsMock(over);
  await installStationsMock(page, mock);
  await openStations(page);
  await expect(page.locator(`${STATIONS} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
  return mock;
}

async function accessBoot(page: Page, opts: MockOptions, hashRoute: string, ready: string) {
  const mock = await installAccessMock(page, opts);
  await page.clock.setFixedTime(ACCESS_NOW);
  await page.goto('about:blank');
  await page.goto(accessUrl(hashRoute));
  await page.waitForSelector('sw-app');
  await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
  return mock;
}

test.describe('deep links: the stations and doors screen and the station drawer', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'behaviour on one project; the phone check is below'));
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('the page actions open a short list; each link lands on its tab in the embedded panel', async ({ page }) => {
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1', catalog: FULL_CATALOG });
    await stationsBoot(page);
    const host = page.locator(`${STATIONS} wk-deep-links[place="stations"]`);
    await expect(host).toHaveAttribute('slot', 'actions');
    await expect(host.locator('[data-wk-deeplinks-list]')).toHaveCount(0); // closed until asked
    await openList(host);
    expect(await hrefs(host)).toEqual(expected(['stations.technical', 'sync.run', 'alerts.act', 'health.fleet']));
    expect(await links(host).allTextContents()).not.toContainEqual(expect.stringMatching(BANNED));
    // Escape closes and gives the focus back to the button
    await page.keyboard.press('Escape');
    await expect(host.locator('[data-wk-deeplinks-list]')).toHaveCount(0);
    // the sync link: the embedded panel opens on its sync tab
    await openList(host);
    await host.locator('[data-wk-deeplink="sync.run"]').click();
    await expect.poll(() => hash(page)).toMatch(/^#\/wiskey\/sync(\?|$)/);
    await expect(page.locator('sw-app wiskey-embed')).toHaveCount(1, { timeout: 30_000 });
    await expect.poll(() => lastFrame(hits), { timeout: 15_000 }).toBe('sync/');
  });

  test('the drawer\'s technical section: a closed line, then the station links; a tool link opens that tool', async ({ page }) => {
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1', catalog: FULL_CATALOG });
    await stationsBoot(page);
    await page.locator(`${STATIONS} [data-wk-grid] [data-wk-station="gate"] button.open`).click();
    const host = page.locator(`${STATIONS} sw-drawer[data-wk-drawer] [data-wk-dsec="technical"] wk-deep-links[place="station"]`);
    await expect(host.locator('[data-wk-deeplinks-toggle]')).toHaveAttribute('aria-expanded', 'false');
    await expect(host.locator('[data-wk-deeplinks-toggle]')).toContainText('פתיחה בחלון האינטרקום (4)');
    await openList(host);
    await expect(host.locator('[data-wk-deeplinks-toggle]')).toHaveAttribute('aria-expanded', 'true');
    expect(await hrefs(host)).toEqual(expected(['stations.technical', 'sync.run', 'health.fleet', 'clock.settings']));
    await expect(host.locator('[data-wk-deeplink="stations.technical"]')).toHaveAttribute('data-wk-target', 'devices');
    await expect(host.locator('[data-wk-deeplink="clock.settings"]')).toHaveAttribute('data-wk-target', 'tools/clock_options');
    await host.locator('[data-wk-deeplink="clock.settings"]').click();
    await expect.poll(() => hash(page)).toMatch(/^#\/wiskey\/tools\/clock_options(\?|$)/);
    await expect.poll(() => lastFrame(hits), { timeout: 15_000 }).toBe('tools/clock_options');
  });

  test('the station settings link reaches the panel\'s own stations tab although the stations screen is set to Arx', async ({ page }) => {
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1', catalog: FULL_CATALOG });
    await stationsBoot(page);
    await page.locator(`${STATIONS} [data-wk-grid] [data-wk-station="lobby"] button.open`).click();
    const host = page.locator(`${STATIONS} sw-drawer[data-wk-drawer] wk-deep-links[place="station"]`);
    await openList(host);
    await host.locator('[data-wk-deeplink="stations.technical"]').click();
    await expect.poll(() => hash(page)).toMatch(/^#\/wiskey\/devices\?classic=1/);
    await expect(page.locator('sw-app wiskey-embed')).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator(STATIONS)).toHaveCount(0);
    await expect.poll(() => lastFrame(hits), { timeout: 15_000 }).toBe('devices/');
  });

  test('a caller without the technical part has no drawer links; the page list still follows access.read', async ({ page }) => {
    await stationsBoot(page, { persona: 'door' });
    await page.locator(`${STATIONS} [data-wk-grid] [data-wk-station="gate"] button.open`).click();
    await expect(page.locator(`${STATIONS} sw-drawer[data-wk-drawer]`)).toHaveAttribute('open', '');
    await expect(page.locator(`${STATIONS} sw-drawer[data-wk-drawer] wk-deep-links`)).toHaveCount(0);
    await expect(page.locator(`${STATIONS} wk-deep-links[place="stations"]`)).toBeVisible();
  });

  test('after the panel\'s handshake, a tool its catalog does not list for this operator is not offered', async ({ page }) => {
    const narrow: FakeCatalog = { tabs: FAKE_CATALOG.tabs, tools: [{ id: 'health', label: 'בריאות' }] };
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1', catalog: narrow });
    await stationsBoot(page);
    // visit the panel once (any tab): its ready catalog is kept for the session
    await page.evaluate(() => (location.hash = '#/wiskey/sync'));
    await expect.poll(() => lastFrame(hits), { timeout: 15_000 }).toBe('sync/');
    await expect(page.locator('wiskey-embed iframe[data-wiskey-embed-frame]')).toHaveAttribute('data-embed-mode', 'v1', { timeout: 15_000 });
    await page.evaluate(() => (location.hash = '#/wiskey/devices'));
    await expect(page.locator(`${STATIONS} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
    const host = page.locator(`${STATIONS} wk-deep-links[place="stations"]`);
    await openList(host);
    expect(await hrefs(host)).toEqual(expected(['stations.technical', 'sync.run', 'health.fleet'])); // fleet_alerts is not in this catalog
  });
});

test.describe('deep links: the people screen', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'behaviour on one project'));
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('the page actions list the people tools (groups and fields native); a tool link opens that tool', async ({ page }) => {
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1', catalog: FULL_CATALOG });
    await page.clock.setFixedTime(new Date('2026-10-12T10:00:00Z'));
    await installPeople(page, newPeopleMock('admin'));
    await page.goto('/?design=a&skin=classic&scheme=light#/wiskey/people');
    await expect(page.locator('wiskey-people sw-page')).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
    const host = page.locator('sw-app wiskey-people wk-deep-links[place="people"]');
    await openList(host);
    // profiles.edit is the native "קבוצות ושדות" screen since WISKEY-PROFILES-EDIT-2390 (2.39.0 train); the rest open the panel
    expect(await hrefs(host)).toEqual(
      expected(['people.unmanaged', 'profiles.edit', 'people.lifecycle', 'access.reviews', 'access.compare', 'people.quality']).map((x) =>
        x.startsWith('profiles.edit=') ? 'profiles.edit=#/wiskey/profiles' : x,
      ),
    );
    await expect(host.locator('[data-wk-deeplink="profiles.edit"]')).toHaveAttribute('data-wk-kind', 'native');
    await host.locator('[data-wk-deeplink="people.lifecycle"]').click();
    await expect.poll(() => hash(page)).toMatch(/^#\/wiskey\/tools\/identity_lifecycle(\?|$)/);
    await expect.poll(() => lastFrame(hits), { timeout: 15_000 }).toBe('tools/identity_lifecycle');
  });
});

test.describe('deep links: the schedules screen', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'behaviour on one project'));
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('the device schedules editor and the station settings; the edit button opens the schedules tool itself', async ({ page }) => {
    await accessBoot(page, { settings: { 'access.ui.schedules': 'smplwise' } }, '/wiskey/schedules', 'sw-app wiskey-schedules [data-sch-program]');
    const host = page.locator('sw-app wiskey-schedules wk-deep-links[place="schedules"]');
    await openList(host);
    expect(await hrefs(host)).toEqual(expected(['schedules.edit', 'stations.technical']));
    await page.keyboard.press('Escape');
    await page.locator('sw-app wiskey-schedules sw-button[data-sch-edit]').click();
    await expect.poll(() => hash(page)).toMatch(/^#\/wiskey\/tools\/schedules(\?|$)/);
  });

  test('a station-scoped operator (no access.read at installation scope) sees the screen but no link into the panel', async ({ page }) => {
    await accessBoot(page, { persona: 'scoped', settings: { 'access.ui.schedules': 'smplwise' } }, '/wiskey/schedules', 'sw-app wiskey-schedules [data-sch]');
    await expect(page.locator('sw-app wiskey-schedules wk-deep-links')).toHaveAttribute('hidden', '');
    await expect(page.locator('sw-app wiskey-schedules [data-wk-deeplinks-toggle]')).toHaveCount(0);
  });
});

test.describe('deep links: Settings › בקרת כניסה', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'behaviour on one project'));
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  const PAGE = 'sw-app system-access-control';

  test('one line per segment, the segment\'s own links; a link opens the panel tool', async ({ page }) => {
    const { hits } = await stubPanel(page, { kiosk: true, panels: true, api: 'v1', catalog: FULL_CATALOG });
    await accessBoot(page, {}, '/system/access-control', `${PAGE} [data-access-segment="status"]`);
    const status = page.locator(`${PAGE} wk-deep-links[place="settings-status"]`);
    await openList(status);
    expect(await hrefs(status)).toEqual(expected(['sync.run', 'alerts.act', 'health.fleet', 'clock.settings', 'operations.center', 'operations.investigations', 'platform.center']));
    await page.goto(accessUrl('/system/access-control/audit'));
    const audit = page.locator(`${PAGE} wk-deep-links[place="settings-audit"]`);
    await openList(audit);
    expect(await hrefs(audit)).toEqual(expected(['audit.panel', 'events.report']));
    await page.goto(accessUrl('/system/access-control/groups'));
    await openList(page.locator(`${PAGE} wk-deep-links[place="settings-groups"]`));
    await page.goto(accessUrl('/system/access-control/policy'));
    const policy = page.locator(`${PAGE} wk-deep-links[place="settings-policy"]`);
    await openList(policy);
    expect(await hrefs(policy)).toEqual(expected(['permissions.panel', 'permissions.directory', 'media.settings', 'workflows.center']));
    await policy.locator('[data-wk-deeplink="permissions.panel"]').click();
    await expect.poll(() => hash(page)).toMatch(/^#\/wiskey\/tools\/access_control(\?|$)/);
    await expect.poll(() => lastFrame(hits), { timeout: 15_000 }).toBe('tools/access_control');
  });

  test('a station-scoped administrator sees the page but no link; with the area hidden for everyone nobody gets a panel link', async ({ page }) => {
    await accessBoot(page, { persona: 'scopedAdmin' }, '/system/access-control', `${PAGE} [data-access-segment="status"]`);
    await expect(page.locator(`${PAGE} wk-deep-links`)).toHaveAttribute('hidden', '');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await accessBoot(page, { settings: { 'ui.hide_wiskey': 'true' } }, '/system/access-control', `${PAGE} [data-access-segment="status"]`);
    // WISKEY-OPS-VIEWS-2400: no PANEL link with the area hidden; Arx's own native views (Settings › תפעול האינטרקום) stay
    const status = page.locator(`${PAGE} wk-deep-links[place="settings-status"]`);
    await openList(status);
    expect(await hrefs(status)).toEqual(expected(['health.fleet', 'operations.center', 'operations.investigations']));
    expect((await hrefs(status)).every((h) => h.includes('=#/system/intercom-operations/'))).toBe(true);
  });
});

test.describe('deep links: the phone', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'mobile', 'the phone project'));
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('the list opened from the page actions stays inside the screen and every link is a 44 px target', async ({ page }) => {
    await stationsBoot(page);
    const host = page.locator(`${STATIONS} wk-deep-links[place="stations"]`);
    await openList(host);
    const vw = page.viewportSize()!.width;
    const box = (await host.locator('[data-wk-deeplinks-list]').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vw + 0.5);
    for (const b of await links(host).evaluateAll((as) => as.map((a) => a.getBoundingClientRect().height))) expect(b).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
});
