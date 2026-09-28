import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';

// Evidence for the WisKey station credentials screen (T054 follow-up to 0.1.109): the per-station RTSP account override
// that shipped API-only now has a card on הגדרות › חיבורים (system-setup.ts), for the system administrator only. The
// card lists every station WisKey knows (and any stored row for a station it no longer lists), says whether the shared
// add-on account is set and whether a station has its own, and lets the administrator set one (username + password,
// never shown again) or clear it behind the screen's usual confirmation. Setting one drops the station's cached still,
// so the Entry Center asks go2rtc for a new frame with the new account on its next round.
//
// Runs against the committed fixture backend, tests/fixtures/wiskey_fake_ha.py (fake Home Assistant and fake go2rtc on
// `.test` hosts; lobby accepts only `lobby-admin` / `lobby-pass`, so its still appears only with an override). How to
// start it is at the top of that file. The backend's still cache is set to 5 s for the run (restored afterwards). Runs
// only with SW_LIVE=1 and SW_WISKEY_FIXTURE=1; one project (desktop). Read-only towards WisKey: no WisKey command is sent.

const SETUP = '#/system/setup';
const ENTRY = '#/wiskey/overview';
const CONTROL = process.env.SW_WISKEY_CONTROL || 'http://127.0.0.1:8357';
const FIXTURE_VERSION = '4.2.0-fake';
const POSTER_MS = 60_000; // live-wall.ts's poster cadence, reused by wiskey-overview.ts
const CACHE_S = 5; // the smallest snapshots.max_age_s the settings accept
const LIST = '/api/v1/intercom/stations/credentials';
const creds = (id: string) => `/api/v1/intercom/stations/${id}/credentials`;
const STALE = 'ghost-station-054'; // a stored row for a station the fixture feed does not list
const PASSWORD = 'lobby-pass';

type Hit = { name: string; raw: boolean; host: string | null; user: string; ok: boolean };
type Row = { station_id: string; name: string | null; has_camera: boolean; known: boolean; override: boolean; override_updated_at: string | null };

test.describe('WisKey station credentials screen (system.configure)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE !== '1', 'set SW_LIVE=1 SW_WISKEY_FIXTURE=1 against the fixture backend');
  test.describe.configure({ mode: 'serial' });

  let control: APIRequestContext;
  let api: APIRequestContext;
  let maxAge = 60;

  test.beforeAll(async ({ playwright }, testInfo) => {
    api = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
    const feed = await (await api.get('/api/v1/intercom/overview')).json();
    if (feed.state !== 'ready' || feed.overview?.version !== FIXTURE_VERSION) {
      throw new Error(`not the WisKey fixture backend (state ${feed.state}, version ${feed.overview?.version})`);
    }
    maxAge = (await (await api.get('/api/v1/settings')).json()).settings['snapshots.max_age_s'];
    expect((await api.patch('/api/v1/settings', { data: { 'snapshots.max_age_s': CACHE_S } })).status()).toBe(200);
    control = await pwRequest.newContext({ baseURL: CONTROL });
    expect((await control.post('/reset')).status()).toBe(200);
    for (const row of ((await (await api.get(LIST)).json()) as { stations: Row[] }).stations) if (row.override) await api.delete(creds(row.station_id));
  });

  test.afterAll(async () => {
    if (api) for (const row of ((await (await api.get(LIST)).json()) as { stations: Row[] }).stations) if (row.override) await api.delete(creds(row.station_id));
    await api?.patch('/api/v1/settings', { data: { 'snapshots.max_age_s': maxAge } });
    await control?.post('/reset');
    await control?.dispose();
    await api?.dispose();
  });

  const card = (page: Page) => page.locator('system-setup [data-wiskey-credentials]');
  const stationRow = (page: Page, id: string) => card(page).locator(`[data-wiskey-station="${id}"]`);

  async function openSetup(page: Page) {
    await page.goto(`/?design=a${SETUP}`);
    await page.waitForSelector('sw-app');
    await expect(page.locator('system-setup [data-connections]')).toBeVisible({ timeout: 30000 });
  }

  async function openEntry(page: Page) {
    await page.clock.install();
    await page.goto(`/?design=a${ENTRY}`);
    await page.waitForSelector('sw-app');
    await expect(page.locator('wiskey-overview [data-wiskey-door="gate"]')).toBeVisible({ timeout: 30000 });
  }

  const still = (page: Page, id: string) => page.locator(`wiskey-overview [data-wiskey-camera="${id}"]`);
  const hits = async (station: string): Promise<Hit[]> =>
    ((await (await control.get('/frame-hits')).json()) as Hit[]).filter((h) => h.name === `smplwise_wiskey_${station}`);

  /** The station's still has really arrived (the fixture's 64x36 JPEG): only then has go2rtc been asked. */
  async function loaded(page: Page, id: string) {
    const img = still(page, id).locator('img');
    await expect(img).toHaveCount(1);
    await expect.poll(async () => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), { timeout: 15000 }).toBe(64);
  }

  /** Whether `needle` is anywhere in the live document: text, any attribute value, or the current `.value` of an
   * input / textarea, descending into every shadow root (the screens live inside sw-app's; `page.content()` and
   * `outerHTML` never see them, and a typed value is not in innerHTML at all). */
  function domHolds(page: Page, needle: string): Promise<boolean> {
    return page.evaluate((needle) => {
      const walk = (root: Document | ShadowRoot | Element): boolean => {
        if ('textContent' in root && root.textContent?.includes(needle)) return true;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          if (Array.from(el.attributes).some((a) => a.value.includes(needle))) return true;
          if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.value.includes(needle)) return true;
          if (el.shadowRoot && walk(el.shadowRoot)) return true;
        }
        return false;
      };
      return walk(document);
    }, needle);
  }

  async function bindUser(request: APIRequestContext, username: string, roleId: string): Promise<string> {
    const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': username } })).json();
    const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: roleId, scope_type: 'installation', scope_id: '*' } });
    expect(r.status()).toBeLessThan(300);
    return ((await r.json()) as { id: string }).id;
  }

  test('without system.configure the card is not rendered and the list API refuses; the administrator sees it', async ({ browser, page, request }) => {
    let binding = '';
    try {
      binding = await bindUser(request, 'wiskeycredsiteadmin054', 'site_admin');
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': 'wiskeycredsiteadmin054' } });
      const p = await ctx.newPage();
      await openSetup(p);
      await expect(p.locator('system-setup [data-connections]')).toBeVisible();
      await expect(card(p)).toHaveCount(0);
      expect((await p.request.get(LIST)).status()).toBe(403);
      expect((await p.request.get(creds('lobby'))).status()).toBe(403);
      expect((await p.request.put(creds('lobby'), { data: { username: 'x', password: 'y' } })).status()).toBe(403);
      expect((await p.request.delete(creds('lobby'))).status()).toBe(403);
      await ctx.close();
    } finally {
      if (binding) await request.delete(`/api/v1/access/bindings/${binding}`).catch(() => {});
    }
    await openSetup(page);
    await expect(card(page)).toBeVisible();
  });

  test('the list: every fixture station with the shared account, a stale stored row flagged and clearable, no host anywhere', async ({ page, request }, testInfo) => {
    expect((await request.put(creds(STALE), { data: { username: 'old-admin', password: 'old-pass' } })).status()).toBe(200);
    await openSetup(page);
    const rows = card(page).locator('[data-wiskey-station]');
    await expect(rows).toHaveCount(5, { timeout: 15000 });
    expect(await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-wiskey-station')))).toEqual(['gate', 'lobby', 'office', 'store', STALE]);
    await expect(card(page)).toContainText('חשבון משותף');
    await expect(card(page)).toContainText('מוגדר');
    for (const id of ['gate', 'lobby', 'office', 'store']) {
      await expect(stationRow(page, id)).toHaveAttribute('data-wiskey-cred-state', 'default');
      await expect(stationRow(page, id).locator('[data-wiskey-cred-status]')).toHaveText('החשבון המשותף');
      await expect(stationRow(page, id).locator('[data-wiskey-cred-edit]')).toHaveCount(1);
      await expect(stationRow(page, id).locator('[data-wiskey-cred-clear]')).toHaveCount(0);
    }
    await expect(stationRow(page, 'gate')).toContainText('שער ראשי');
    await expect(stationRow(page, 'lobby')).toContainText('לובי');
    await expect(stationRow(page, 'office')).toContainText('ללא מצלמה');
    // the stale row: named by id, flagged, no "set" button, only removal
    const stale = stationRow(page, STALE);
    await expect(stale).toHaveAttribute('data-wiskey-cred-state', 'override');
    await expect(stale.locator('[data-wiskey-cred-unknown]')).toBeVisible();
    await expect(stale.locator('[data-wiskey-cred-edit]')).toHaveCount(0);
    await expect(stale.locator('[data-wiskey-cred-clear]')).toHaveText('הסרת הרשומה');
    // no host, no stored value, on the page or in the list reply
    const text = await card(page).innerText();
    expect(text).not.toMatch(/192\.0\.2\./);
    expect(text).not.toContain('old-admin');
    expect(text).not.toContain('old-pass');
    const list = await (await request.get(LIST)).text();
    expect(list).not.toMatch(/192\.0\.2\./);
    expect(list).not.toContain('"host"');
    expect(list).not.toContain('old-admin');
    expect(list).not.toContain('old-pass');
    await page.screenshot({ path: testInfo.outputPath('wiskey-credentials-list.png'), fullPage: true });
    // clear it from the screen: confirmation first, then the row is gone
    await stale.locator('[data-wiskey-cred-clear]').click();
    const dialog = card(page).locator('sw-dialog[data-wiskey-cred-confirm]');
    await expect(dialog.locator('[role="dialog"]')).toBeVisible();
    await expect(dialog).toHaveAttribute('subheading', STALE);
    await dialog.locator('[data-wiskey-cred-confirm-run]').click();
    await expect(rows).toHaveCount(4, { timeout: 15000 });
    await expect(card(page).locator('[data-wiskey-cred-msg]')).toContainText('הוסרה');
    expect(((await (await request.get(LIST)).json()) as { stations: Row[] }).stations.map((r) => r.station_id)).toEqual(['gate', 'lobby', 'office', 'store']);
  });

  test('setting lobby its own account: the list updates, the Entry Center fetches its still again with that account, the password is never served or left in the DOM', async ({ browser, page, request }, testInfo) => {
    // a clean slate for lobby whatever an earlier run against this backend process left behind: no stored account and
    // no cached still (a DELETE drops it even when there is no row), and the fake go2rtc forgets its streams (as a
    // restart does), so the grab after the change below is seen registering lobby's source with the new account
    expect((await request.delete(creds('lobby'))).status()).toBe(200);
    expect((await control.post('/go2rtc/restart')).status()).toBe(200);
    // the Entry Center is open in another page: lobby refuses the shared account, so it has no still
    const entryCtx = await browser.newContext();
    const entry = await entryCtx.newPage();
    try {
      await openEntry(entry);
      await expect(still(entry, 'lobby')).toHaveAttribute('data-camera-state', 'unavailable', { timeout: 15000 });
      const mark = (await hits('lobby')).length;

      await openSetup(page);
      const bodies: string[] = [];
      page.on('response', (res) => {
        if (res.url().includes('/api/v1/')) void res.text().then((t) => bodies.push(t)).catch(() => {});
      });
      const lobby = stationRow(page, 'lobby');
      await lobby.locator('[data-wiskey-cred-edit]').click();
      const form = lobby.locator('[data-wiskey-cred-form]');
      await expect(form).toBeVisible();
      const password = form.locator('[data-wiskey-cred-password]');
      await expect(password).toHaveAttribute('type', 'password');
      await expect(password).toHaveAttribute('autocomplete', 'new-password');
      await expect(password).toHaveValue('');
      await expect(form.locator('[data-wiskey-cred-user]')).toHaveAttribute('autocomplete', 'off');
      await expect(form.locator('[data-wiskey-cred-save]')).toHaveAttribute('disabled', ''); // custom element: the attribute is the contract
      await form.locator('[data-wiskey-cred-user]').fill('lobby-admin');
      await password.fill(PASSWORD);
      expect(await domHolds(page, PASSWORD)).toBe(true); // positive control: the walk does see a typed value inside the shadow DOM
      await expect(form.locator('[data-wiskey-cred-save]')).not.toHaveAttribute('disabled', '');
      await page.screenshot({ path: testInfo.outputPath('wiskey-credentials-form.png'), fullPage: true });
      await form.locator('[data-wiskey-cred-save]').click();
      await expect(card(page).locator('[data-wiskey-cred-msg]')).toContainText('נשמר', { timeout: 15000 });
      await expect(lobby).toHaveAttribute('data-wiskey-cred-state', 'override');
      await expect(lobby.locator('[data-wiskey-cred-status]')).toContainText('חשבון משלה · מאז');
      await expect(lobby.locator('[data-wiskey-cred-form]')).toHaveCount(0);
      await expect(lobby.locator('[data-wiskey-cred-clear]')).toHaveText('חזרה לחשבון המשותף');
      await expect(lobby.locator('[data-wiskey-cred-edit]')).toHaveText('החלפת החשבון…');
      // the password: in no API response body, and nowhere in the document after the save
      await expect.poll(() => bodies.length).toBeGreaterThan(1);
      expect(bodies.some((b) => b.includes(PASSWORD) || b.includes('lobby-admin'))).toBe(false);
      expect(await domHolds(page, PASSWORD)).toBe(false);
      const status = await (await request.get(creds('lobby'))).text();
      expect(status).not.toContain(PASSWORD);
      expect(status).not.toContain('lobby-admin');
      expect(JSON.parse(status)).toMatchObject({ station_id: 'lobby', override: true, effective: 'override', default_configured: true });
      await page.screenshot({ path: testInfo.outputPath('wiskey-credentials-set.png'), fullPage: true });

      // the Entry Center: the cached still was dropped on the change, so the next poster round asks go2rtc for lobby
      // again - once with the new account (registration), and the still appears
      const before = await still(entry, 'gate').locator('img').evaluate((el: HTMLImageElement) => el.src);
      await entry.waitForTimeout(CACHE_S * 1000 + 700);
      await entry.clock.fastForward(POSTER_MS);
      await expect.poll(() => still(entry, 'gate').locator('img').evaluate((el: HTMLImageElement) => el.src)).not.toBe(before);
      await expect(still(entry, 'lobby')).toHaveAttribute('data-camera-state', 'image', { timeout: 15000 });
      await loaded(entry, 'lobby');
      const fresh = (await hits('lobby')).slice(mark);
      expect(fresh.filter((h) => h.raw)).toEqual([{ name: 'smplwise_wiskey_lobby', raw: true, host: '192.0.2.22', user: 'lobby-admin', ok: true }]);
      await entry.screenshot({ path: testInfo.outputPath('wiskey-credentials-entry-center.png'), fullPage: true });
    } finally {
      await entryCtx.close();
    }
  });

  test('clearing: cancel keeps the override; confirm removes it and the list shows the shared account again; API errors are shown with their code', async ({ page, request }) => {
    await openSetup(page);
    const lobby = stationRow(page, 'lobby');
    await expect(lobby).toHaveAttribute('data-wiskey-cred-state', 'override', { timeout: 15000 });
    await lobby.locator('[data-wiskey-cred-clear]').click();
    const dialog = card(page).locator('sw-dialog[data-wiskey-cred-confirm]');
    await expect(dialog.locator('[role="dialog"]')).toBeVisible();
    await expect(dialog).toHaveAttribute('subheading', 'לובי');
    await expect(dialog).toContainText('תחזור לחשבון המשותף');
    await dialog.getByText('ביטול').click();
    await expect(dialog).toHaveCount(0);
    await expect(lobby).toHaveAttribute('data-wiskey-cred-state', 'override');
    expect((await (await request.get(creds('lobby'))).json()).override).toBe(true);
    await lobby.locator('[data-wiskey-cred-clear]').click();
    await dialog.locator('[data-wiskey-cred-confirm-run]').click();
    await expect(lobby).toHaveAttribute('data-wiskey-cred-state', 'default', { timeout: 15000 });
    await expect(card(page).locator('[data-wiskey-cred-msg]')).toContainText('הוסר');
    expect((await (await request.get(creds('lobby'))).json()).override).toBe(false);

    // an error from the API is shown as it comes, code included (a 503 stood in for by a route: the fixture backend
    // always has the shared account, so the real endpoint cannot produce this one)
    await page.route('**/api/v1/intercom/stations/gate/credentials', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'source_not_configured', user_message: 'פרטי הגישה למצלמות עמדות WisKey לא הוגדרו', retryable: false, correlation_id: 'x', details: {} }) }),
    );
    const gate = stationRow(page, 'gate');
    await gate.locator('[data-wiskey-cred-edit]').click();
    await gate.locator('[data-wiskey-cred-user]').fill('u');
    await gate.locator('[data-wiskey-cred-password]').fill('p');
    await gate.locator('[data-wiskey-cred-save]').click();
    await expect(card(page).locator('[data-wiskey-cred-msg]')).toContainText('לא נשמר');
    await expect(card(page).locator('[data-wiskey-cred-msg]')).toContainText('(source_not_configured)');
    await expect(gate.locator('[data-wiskey-cred-form]')).toBeVisible(); // the form stays for a retry
    await page.unroute('**/api/v1/intercom/stations/gate/credentials');
    expect((await (await request.get(creds('gate'))).json()).override).toBe(false);
  });
});
