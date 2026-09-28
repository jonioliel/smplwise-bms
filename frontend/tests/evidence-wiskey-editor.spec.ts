import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';

// Evidence for the WisKey person editor (CR-005 phase 2, slice A1, `access.people.manage`): the port of WisKey's own
// editor dialog (panel.ts editorBody / save / removeUser) opened from the people directory (#/wiskey/people) - "Add
// user" in the page actions and "Edit" in the details pane, for the permission's holders only. Runs against the
// committed fixture backend tests/fixtures/wiskey_fake_ha.py (the real SMPLWISE backend with an in-process fake Home
// Assistant whose users/create | update | delete follow WisKey's own field and collision rules and keep the PIN and
// card numbers on their private side, as WisKey does). Runs with SW_LIVE=1 SW_WISKEY_FIXTURE=1, one project (desktop);
// how to start the fixture is at the top of that file.
//
// Covered: the gating (a viewer sees no add / edit and every editor endpoint refuses), the create / edit / delete round
// trip with WisKey's exact frames, cards shown masked only, the PIN never in any response or in the document after a
// save (a recursive shadow-root walk), the pin_conflict path with "generate unique PIN", the revision_conflict path
// with reload-and-retry, and the two unknown-outcome paths (a storage failure WisKey cannot classify, an answer of an
// unexpected shape) worded as "unknown", never as saved and never as "nothing happened".

const HREF = '#/wiskey/people';
const SCREEN = 'wiskey-people';
const EDITOR = 'wiskey-people wiskey-person-editor';
const CONTROL = process.env.SW_WISKEY_CONTROL || 'http://127.0.0.1:8357';
const FIXTURE_VERSION = '4.2.0-fake';
const PIN = '735913'; // typed in the create test; must never be seen again after the save
const CARD = 'ABCD1234'; // typed card number; only its last four come back, masked
type Sent = ({ id: number; type: string } & Record<string, unknown>)[];
type Secret = { id: string; revision: number; pin: string | null; cards: Record<string, string> };

test.describe('WisKey person editor against the fixture WisKey (CR-005 phase 2 A1)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE !== '1', 'set SW_LIVE=1 SW_WISKEY_FIXTURE=1 against the fixture backend');
  test.describe.configure({ mode: 'serial' });

  let control: APIRequestContext;
  let api: APIRequestContext;
  let createdId = '';
  let createdEmployee = '';

  test.beforeAll(async ({ playwright }, testInfo) => {
    api = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
    const feed = await (await api.get('/api/v1/intercom/overview')).json();
    if (feed.state !== 'ready' || feed.overview?.version !== FIXTURE_VERSION) throw new Error(`not the WisKey fixture backend (state ${feed.state}, version ${feed.overview?.version})`);
    control = await pwRequest.newContext({ baseURL: CONTROL });
    expect((await control.post('/reset')).status()).toBe(200);
    // the whole run is one SMPLWISE user clicking far faster than a person: widen its own read bucket (the backend's
    // fairness limit, USER_BURST 10 at 1/s) so the editor's context + record reads are never refused `rate_limited`
    // between tests; /reset in afterAll restores the defaults
    expect((await control.post('/limits', { data: { user_burst: 100, user_rate: 10, config_user_burst: 50, config_user_rate: 5 } })).status()).toBe(200);
  });

  test.afterAll(async () => {
    await control?.post('/reset');
    await control?.dispose();
    await api?.dispose();
  });

  const rows = (page: Page) => page.locator(`${SCREEN} sw-table[data-wiskey-people-table] tbody tr`);
  const editor = (page: Page) => page.locator(EDITOR);
  const field = (page: Page, name: string) => editor(page).locator(`[data-wiskey-editor-${name}]`);

  async function openPeople(page: Page) {
    await page.goto(`/?design=a${HREF}`);
    await page.waitForSelector('sw-app');
    await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(400);
  }

  async function openEditorFor(page: Page, id: string) {
    await page.locator(`${SCREEN} tr[data-row-id="${id}"]`).click();
    const detail = page.locator(`${SCREEN} [data-wiskey-person-detail="${id}"]`);
    await expect(detail).toHaveAttribute('data-wiskey-person-detail-source', 'record', { timeout: 15000 });
    await detail.locator('[data-wiskey-person-edit]').click();
    await expect(editor(page).locator('[data-wiskey-editor-mode="edit"]')).toBeVisible({ timeout: 15000 });
    await expect(field(page, 'name')).toBeVisible({ timeout: 15000 });
  }

  async function sent(kind: string): Promise<Sent> {
    return ((await (await control.get('/sent')).json()) as Sent).filter((m) => m.type === `hikvision_intercom/${kind}`);
  }

  const secret = async (id: string): Promise<Secret> => (await control.get(`/people/${id}/secret`)).json();

  /** Whether `needle` is anywhere in the live document (text, attribute values, input values), through every shadow
   * root - the screens live inside sw-app's, so `page.content()` never sees them. */
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

  test('gating: a viewer (access.read) sees no add or edit and every editor endpoint refuses; the administrator sees both', async ({ browser, page, request }, testInfo) => {
    let binding = '';
    try {
      binding = await bindUser(request, 'wiskeyeditorviewer', 'viewer');
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': 'wiskeyeditorviewer' } });
      const p = await ctx.newPage();
      await openPeople(p);
      await expect(p.locator(`${SCREEN} [data-wiskey-people-add]`)).toHaveCount(0);
      await rows(p).nth(1).click();
      const detail = p.locator(`${SCREEN} [data-wiskey-person-detail="u002"]`);
      await expect(detail).toHaveAttribute('data-wiskey-person-detail-source', 'record', { timeout: 15000 });
      await expect(detail.locator('[data-wiskey-person-edit]')).toHaveCount(0);
      await expect(detail).toContainText('עריכת אנשים מתבצעת ב־WisKey עצמו');
      expect((await p.request.get('/api/v1/intercom/people-editor/context')).status()).toBe(403);
      expect((await p.request.get('/api/v1/intercom/people/u002/editor')).status()).toBe(403);
      expect((await p.request.post('/api/v1/intercom/people/pin-generate', { data: { user_id: '' } })).status()).toBe(403);
      expect((await p.request.post('/api/v1/intercom/people', { data: { data: { display_name: 'x', employee_no: '1' } } })).status()).toBe(403);
      expect((await p.request.put('/api/v1/intercom/people/u002', { data: { data: { active: false }, revision: 1 } })).status()).toBe(403);
      expect((await p.request.post('/api/v1/intercom/people/u002/delete', { data: { revision: 1, confirmed: true } })).status()).toBe(403);
      expect((await p.request.get('/api/v1/intercom/people/u002')).status()).toBe(200);
      const read = await (await p.request.get('/api/v1/intercom/people/u002')).text();
      expect(read).not.toMatch(/phone|cards|pin_configured|masked_number|\+9725/);
      await ctx.close();
    } finally {
      if (binding) await request.delete(`/api/v1/access/bindings/${binding}`).catch(() => {});
    }
    expect(await sent('users/create')).toHaveLength(0);
    await openPeople(page);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-add]`)).toBeVisible();
    await expect(page.locator(`${SCREEN} [data-wiskey-people-add]`)).toContainText('הוספת משתמש');
    await rows(page).nth(1).click();
    const detail = page.locator(`${SCREEN} [data-wiskey-person-detail="u002"]`);
    await expect(detail.locator('[data-wiskey-person-edit]')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: testInfo.outputPath('wiskey-editor-people-admin.png'), fullPage: true });
  });

  test('create: the form, a typed PIN and card, two stations; WisKey gets the exact frame; the PIN is in no response and gone from the document; the card comes back masked', async ({ page }, testInfo) => {
    await openPeople(page);
    const bodies: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/v1/')) void res.text().then((t) => bodies.push(t)).catch(() => {});
    });
    await page.locator(`${SCREEN} [data-wiskey-people-add]`).click();
    await expect(editor(page).locator('[data-wiskey-editor-mode="new"]')).toBeVisible({ timeout: 15000 });
    await expect(field(page, 'name')).toBeVisible({ timeout: 15000 });
    // the notes are honest about what this slice does not edit yet, and no disabled stubs for it
    await expect(editor(page).locator('[data-wiskey-editor-section]')).toHaveCount(5); // person, validity, pin, cards, assignments (no actions for a new person)
    await expect(editor(page).locator('[data-wiskey-editor-validity-mode] option')).toHaveCount(2); // permanent / period only
    await expect(editor(page).getByText(/weekly|native|photo|תמונה/)).toHaveCount(0);
    // a random nine-digit employee number, as WisKey's edit() gives a new person
    createdEmployee = await field(page, 'employee').inputValue();
    expect(createdEmployee).toMatch(/^[1-9]\d{8}$/);
    await field(page, 'name').fill('נועה ברק');
    await field(page, 'phone').fill('0507771234');
    await expect(field(page, 'phone')).toHaveValue('050-777-1234'); // mobileDisplay
    // PIN: password inputs, no live availability check offered; mismatch is refused locally
    await expect(field(page, 'pin')).toHaveAttribute('type', 'password');
    await expect(field(page, 'pin')).toHaveAttribute('autocomplete', 'new-password');
    await expect(field(page, 'pin-remove')).toHaveAttribute('disabled', ''); // not configured yet
    await field(page, 'pin').fill(PIN);
    await field(page, 'pin-confirm').fill('000000');
    await field(page, 'save-sync').click();
    await expect(field(page, 'error')).toHaveAttribute('data-wiskey-editor-error-code', 'pin_mismatch');
    expect(await sent('users/create')).toHaveLength(0);
    await field(page, 'pin-confirm').fill(PIN);
    expect(await domHolds(page, PIN)).toBe(true); // positive control: the walk sees a typed value
    // a card by number (capture from a station is the next slice)
    await field(page, 'card-add').click();
    const card = editor(page).locator('[data-wiskey-editor-card="new"]');
    await expect(card).toHaveCount(1);
    await card.locator('[data-wiskey-editor-card-number]').fill(CARD);
    await card.locator('[data-wiskey-editor-card-label]').fill('תג ראשי');
    // stations: gate (one relay) and lobby (two relays: keep only the first)
    const gate = editor(page).locator('[data-wiskey-editor-station="gate"]');
    const lobby = editor(page).locator('[data-wiskey-editor-station="lobby"]');
    await gate.locator('[data-wiskey-editor-station-toggle]').check();
    await lobby.locator('[data-wiskey-editor-station-toggle]').check();
    await expect(lobby.locator('[data-wiskey-editor-lock]')).toHaveCount(2);
    await lobby.locator('[data-wiskey-editor-lock="2"]').uncheck();
    await expect(editor(page).locator('[data-wiskey-editor-stations-count]')).toHaveAttribute('data-wiskey-editor-stations-count', '2');
    await page.screenshot({ path: testInfo.outputPath('wiskey-editor-create-form.png'), fullPage: true });
    await field(page, 'save-sync').click();
    // the editor closed, the page says what WisKey answered (saved, sync requested - not "synced")
    await expect(editor(page)).toHaveCount(0, { timeout: 15000 });
    const notice = page.locator(`${SCREEN} [data-wiskey-people-notice="ok"]`);
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('נשלחה בקשה לסנכרון');
    await expect(notice).toContainText('WisKey שמר');
    // WisKey's exact users/create frame
    const [frame] = await sent('users/create');
    expect(frame).toEqual({
      id: frame.id, type: 'hikvision_intercom/users/create', api_contract: 1, sync_now: true,
      data: {
        employee_no: createdEmployee, phone: '050-777-1234', display_name: 'נועה ברק', active: true, valid_from: null, valid_until: null, pin: PIN,
        // WisKey's own editor payload: overrides + the enabled stations' relays (no access_policy_revision: the fixture
        // WisKey has no profile policy, and WisKey would answer group_policy_changed to one)
        permission_overrides: { gate: 'allow', lobby: 'allow' },
        door_permissions: { gate: [1], lobby: [1] },
        cards: [{ card_no: CARD, label: 'תג ראשי', card_type: 'normalCard', enabled: true }],
      },
    });
    // the fixture WisKey stored the PIN and the number - and only it has them
    const search = page.locator(`${SCREEN} [data-wiskey-people-search]`);
    await search.fill(createdEmployee);
    await expect(rows(page)).toHaveCount(1, { timeout: 15000 });
    createdId = (await rows(page).first().getAttribute('data-row-id')) ?? '';
    expect(createdId).not.toBe('');
    const stored = await secret(createdId);
    expect(stored.pin).toBe(PIN);
    expect(Object.values(stored.cards)).toEqual([CARD]);
    // the PIN: in no API response body, and nowhere in the document after the save
    await expect.poll(() => bodies.length).toBeGreaterThan(2);
    expect(bodies.some((b) => b.includes(PIN))).toBe(false);
    expect(bodies.some((b) => b.includes(CARD))).toBe(false);
    expect(await domHolds(page, PIN)).toBe(false);
    expect(await domHolds(page, CARD)).toBe(false);
    // the details pane (read projection) still shows no phone / card / PIN (the new person sorts onto the last page, so
    // the refetch dropped the selection: select the found row)
    await rows(page).first().click();
    const detail = page.locator(`${SCREEN} [data-wiskey-person-detail="${createdId}"]`);
    await expect(detail).toBeVisible({ timeout: 15000 });
    await expect(detail).toHaveAttribute('data-wiskey-person-detail-source', 'record', { timeout: 15000 });
    await expect(detail).toContainText('נועה ברק');
    await expect(detail).not.toContainText(/050-777|••••|PIN/);
    // re-opened for editing: PIN "configured", the card masked and read-only, the stations as saved
    await openEditorFor(page, createdId);
    await expect(field(page, 'section="pin"')).toHaveAttribute('data-wiskey-editor-pin-configured', 'true');
    await expect(field(page, 'pin')).toHaveValue('');
    const saved = editor(page).locator('[data-wiskey-editor-card="saved"]');
    await expect(saved).toHaveCount(1);
    await expect(saved.locator('[data-wiskey-editor-card-masked]')).toHaveValue('•••• 1234');
    await expect(saved.locator('[data-wiskey-editor-card-masked]')).toHaveAttribute('readonly', '');
    await expect(saved.locator('[data-wiskey-editor-card-number]')).toHaveCount(0);
    await expect(editor(page).locator('[data-wiskey-editor-station="gate"]')).toHaveAttribute('data-wiskey-editor-station-enabled', 'true');
    await expect(editor(page).locator('[data-wiskey-editor-station="lobby"] [data-wiskey-editor-lock="2"]')).not.toBeChecked();
    await expect(editor(page).locator('[data-wiskey-editor-station="store"]')).toHaveAttribute('data-wiskey-editor-station-enabled', 'false');
    expect(await domHolds(page, PIN)).toBe(false);
    expect(await domHolds(page, CARD)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('wiskey-editor-edit-form.png'), fullPage: true });
    await field(page, 'cancel').click();
    await expect(editor(page)).toHaveCount(0);
  });

  async function openCreated(page: Page) {
    await openPeople(page);
    await page.locator(`${SCREEN} [data-wiskey-people-search]`).fill(createdEmployee);
    await expect(rows(page)).toHaveCount(1, { timeout: 15000 });
    await openEditorFor(page, createdId);
  }

  test('edit: a patch on the loaded revision - name, PIN removed, the saved card kept by id, a date range - and WisKey gets exactly that', async ({ page }) => {
    await openCreated(page);
    const before = await secret(createdId);
    await field(page, 'name').fill('נועה ברק-לוי');
    await field(page, 'pin-remove').click();
    await expect(field(page, 'pin')).toHaveAttribute('disabled', '');
    await expect(field(page, 'pin-keep')).toBeVisible();
    await field(page, 'validity-mode').selectOption('period');
    await field(page, 'valid-from').fill('2026-10-01T08:00');
    await field(page, 'valid-until').fill('2026-10-01T07:00');
    await field(page, 'save').click();
    await expect(field(page, 'error')).toHaveAttribute('data-wiskey-editor-error-code', 'invalid_validity');
    await field(page, 'valid-until').fill('2026-12-31T18:00');
    await field(page, 'save').click();
    await expect(editor(page)).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator(`${SCREEN} [data-wiskey-people-notice="ok"]`)).toContainText('הסנכרון האוטומטי ממשיך לפעול');
    const [frame] = await sent('users/update');
    const cardId = Object.keys(before.cards)[0];
    expect(frame).toEqual({
      id: frame.id, type: 'hikvision_intercom/users/update', user_id: createdId, revision: before.revision, sync_now: false, api_contract: 1,
      data: {
        employee_no: createdEmployee, phone: '050-777-1234', display_name: 'נועה ברק-לוי', active: true, pin: null,
        valid_from: '2026-10-01T05:00:00.000Z', valid_until: '2026-12-31T16:00:00.000Z', // typed in Asia/Jerusalem (the HA zone), sent as instants
        permission_overrides: { gate: 'allow', lobby: 'allow' },
        door_permissions: { gate: [1], lobby: [1] },
        cards: [{ id: cardId, label: 'תג ראשי', card_type: 'normalCard', enabled: true }], // by id only: WisKey keeps the number
      },
    });
    const after = await secret(createdId);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.pin).toBeNull();
    expect(after.cards).toEqual(before.cards);
    await expect(page.locator(`${SCREEN} tr[data-row-id="${createdId}"] [data-wiskey-person-validity]`)).toHaveAttribute('data-wiskey-person-validity', 'validity_future', { timeout: 15000 });
  });

  test('relays: adding the lobby barrier to an existing assignment and removing it again both reach WisKey and stay (review B1)', async ({ page }) => {
    const lobbyDoors = async () => ((await (await page.request.get(`/api/v1/intercom/people/${createdId}/editor`)).json()).person.stations as { station_id: string; doors: number[] }[]).find((s) => s.station_id === 'lobby')?.doors;
    expect(await lobbyDoors()).toEqual([1]);
    await openCreated(page);
    const lock2 = editor(page).locator('[data-wiskey-editor-station="lobby"] [data-wiskey-editor-lock="2"]');
    await expect(lock2).not.toBeChecked();
    await lock2.check();
    await field(page, 'save').click();
    await expect(editor(page)).toHaveCount(0, { timeout: 15000 });
    expect((await sent('users/update')).at(-1)?.data).toMatchObject({ door_permissions: { gate: [1], lobby: [1, 2] } });
    expect(await lobbyDoors()).toEqual([1, 2]);
    // the case the first review caught: a relay REMOVED from an existing assignment must not be kept by WisKey
    await openCreated(page);
    await expect(lock2).toBeChecked();
    await lock2.uncheck();
    await field(page, 'save').click();
    await expect(editor(page)).toHaveCount(0, { timeout: 15000 });
    expect((await sent('users/update')).at(-1)?.data).toMatchObject({ permission_overrides: { gate: 'allow', lobby: 'allow' }, door_permissions: { gate: [1], lobby: [1] } });
    expect(await lobbyDoors()).toEqual([1]);
    await openCreated(page);
    await expect(lock2).not.toBeChecked();
    // unchecking the last relay denies the station (WisKey), and a denied station carries no relays (the relay row
    // disappears with the deny, so this is a click, not an `uncheck` that would wait to re-verify a detached box)
    await editor(page).locator('[data-wiskey-editor-station="lobby"] [data-wiskey-editor-lock="1"]').click();
    await expect(editor(page).locator('[data-wiskey-editor-station="lobby"]')).toHaveAttribute('data-wiskey-editor-station-enabled', 'false');
    await field(page, 'save').click();
    await expect(editor(page)).toHaveCount(0, { timeout: 15000 });
    expect((await sent('users/update')).at(-1)?.data).toMatchObject({ permission_overrides: { gate: 'allow', lobby: 'deny' }, door_permissions: { gate: [1] } });
    const stations = ((await (await page.request.get(`/api/v1/intercom/people/${createdId}/editor`)).json()).person.stations as { station_id: string; enabled: boolean }[]);
    expect(stations.find((s) => s.station_id === 'lobby')?.enabled).toBe(false);
  });

  test('pin_conflict: a PIN another person holds is refused by WisKey at save time, by name, and "generate unique PIN" gives a free one', async ({ page }, testInfo) => {
    await openPeople(page);
    const taken = (await secret('u001')).pin; // u001 has a PIN (every 2nd person)
    expect(taken).toBeTruthy();
    await page.locator(`${SCREEN} [data-wiskey-people-add]`).click();
    await expect(field(page, 'name')).toBeVisible({ timeout: 15000 });
    await field(page, 'name').fill('כפילות PIN');
    await field(page, 'pin').fill(taken!);
    await field(page, 'pin-confirm').fill(taken!);
    await field(page, 'save').click();
    const error = field(page, 'error');
    await expect(error).toHaveAttribute('data-wiskey-editor-error-code', 'intercom_pin_conflict', { timeout: 15000 });
    await expect(error).toHaveAttribute('data-wiskey-editor-outcome', 'refused');
    await expect(error).toContainText('קוד זה כבר משויך למשתמש מרכזי');
    await expect(error).toContainText('יצירת PIN ייחודי');
    await expect(editor(page)).toHaveCount(1); // the form stays for a retry
    await page.screenshot({ path: testInfo.outputPath('wiskey-editor-pin-conflict.png'), fullPage: true });
    await field(page, 'pin-generate').click();
    await expect(field(page, 'pin-status')).toHaveAttribute('data-wiskey-editor-pin-status', 'generated', { timeout: 15000 });
    const generated = await field(page, 'pin').inputValue();
    expect(generated).toMatch(/^\d{6}$/);
    expect(generated).not.toBe(taken);
    await expect(field(page, 'pin-confirm')).toHaveValue(generated);
    const [gen] = await sent('users/pin_generate');
    expect(gen).toEqual({ id: gen.id, type: 'hikvision_intercom/users/pin_generate', user_id: '', api_contract: 1 });
    await field(page, 'save').click();
    await expect(editor(page)).toHaveCount(0, { timeout: 15000 });
    const frames = (await sent('users/create')).filter((m) => (m.data as { display_name: string }).display_name === 'כפילות PIN');
    expect(frames).toHaveLength(2); // the refused one and the accepted one, each sent once
    expect((frames[0].data as { pin: string }).pin).toBe(taken);
    expect((frames[1].data as { pin: string }).pin).toBe(generated);
    expect(await domHolds(page, generated)).toBe(false);
  });

  test('revision_conflict: the person changed in WisKey while the editor was open; the save is refused, reload brings the current revision, then the save goes through', async ({ page }, testInfo) => {
    await openPeople(page);
    await openEditorFor(page, 'u002');
    const before = await secret('u002');
    expect((await control.post('/people/touch', { data: { id: 'u002' } })).status()).toBe(200); // revision + 1 behind our back
    await field(page, 'name').fill('יוסי לוי (ערוך)');
    await field(page, 'save').click();
    const error = field(page, 'error');
    await expect(error).toHaveAttribute('data-wiskey-editor-error-code', 'intercom_revision_conflict', { timeout: 15000 });
    await expect(error).toHaveAttribute('data-wiskey-editor-outcome', 'refused');
    await expect(error).toContainText('המשתמש השתנה בזמן העריכה');
    expect((await sent('users/update')).at(-1)?.revision).toBe(before.revision);
    await page.screenshot({ path: testInfo.outputPath('wiskey-editor-revision-conflict.png'), fullPage: true });
    await field(page, 'reload').click();
    await expect(field(page, 'name')).toHaveValue('Yossi Levi', { timeout: 15000 }); // the fresh record replaces the draft
    await expect(field(page, 'error')).toHaveCount(0);
    await field(page, 'name').fill('יוסי לוי (ערוך)');
    await field(page, 'save').click();
    await expect(editor(page)).toHaveCount(0, { timeout: 15000 });
    expect((await sent('users/update')).at(-1)?.revision).toBe(before.revision + 1);
    expect((await secret('u002')).revision).toBe(before.revision + 2);
  });

  test('unknown outcome: a storage failure WisKey cannot classify, and an answer of an unexpected shape, are "unknown" - never "saved", never "nothing happened"', async ({ page }, testInfo) => {
    await openPeople(page);
    expect((await control.post('/mode', { data: { people: 'storage_write_failed' } })).status()).toBe(200);
    try {
      await openEditorFor(page, 'u003');
      await field(page, 'active').uncheck();
      await field(page, 'save').click();
      const error = field(page, 'error');
      await expect(error).toHaveAttribute('data-wiskey-editor-outcome', 'unknown', { timeout: 15000 });
      await expect(error).toHaveAttribute('data-wiskey-editor-error-code', 'intercom_outcome_unknown');
      await expect(error).toContainText('לא ידוע אם השינוי נשמר');
      await expect(error).toContainText('storage_write_failed');
      await expect(error).toContainText('טענו מחדש');
      await expect(error).not.toContainText('לא בוצעה');
      await expect(field(page, 'reload')).toBeVisible();
      await expect(editor(page)).toHaveCount(1);
      await expect(page.locator(`${SCREEN} [data-wiskey-people-notice]`)).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath('wiskey-editor-unknown.png'), fullPage: true });
      expect((await control.post('/mode', { data: { people: 'unexpected' } })).status()).toBe(200);
      await field(page, 'save').click();
      await expect(error).toHaveAttribute('data-wiskey-editor-outcome', 'unknown', { timeout: 15000 });
      await expect(error).toContainText('לא התקבלה מ־WisKey תשובה ברורה'); // success: true with an unexpected shape reads the same as no answer
      await expect(error).not.toContainText('storage_write_failed');
      expect((await sent('users/update')).filter((m) => m.user_id === 'u003')).toHaveLength(2); // one frame per attempt, never a retry
    } finally {
      expect((await control.post('/mode', { data: { people: 'accept' } })).status()).toBe(200);
    }
    // an unknown outcome on a NEW person says to look the employee number up in the directory
    await field(page, 'cancel').click();
    await field(page, 'close-discard').click();
    await expect(editor(page)).toHaveCount(0);
  });

  test('delete: only from an unmodified draft, behind WisKey\'s confirmation naming the stations; WisKey gets {user_id, revision}; the person leaves the list', async ({ page }, testInfo) => {
    await openPeople(page);
    await openEditorFor(page, 'u005'); // gate + lobby assigned (n % 4 == 0)
    const before = await secret('u005');
    await field(page, 'name').fill('שינוי לפני מחיקה');
    await field(page, 'delete').click();
    await expect(field(page, 'error')).toHaveAttribute('data-wiskey-editor-error-code', 'profile_save_first');
    await expect(field(page, 'delete-dialog')).toHaveCount(0);
    await field(page, 'name').fill('Noa Shalev');
    await field(page, 'delete').click();
    const dialog = field(page, 'delete-dialog');
    await expect(dialog.locator('[role="dialog"]')).toBeVisible();
    await expect(dialog).toContainText('ההסרה תתוזמן ב־2 תחנות');
    await page.screenshot({ path: testInfo.outputPath('wiskey-editor-delete-dialog.png'), fullPage: true });
    await dialog.getByText('ביטול').click();
    await expect(dialog).toHaveCount(0);
    expect(await sent('users/delete')).toHaveLength(0);
    await field(page, 'delete').click();
    await field(page, 'delete-confirm').click();
    await expect(editor(page)).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator(`${SCREEN} [data-wiskey-people-notice="ok"]`)).toContainText('ההסרה תוזמנה');
    const [frame] = await sent('users/delete');
    expect(frame).toEqual({ id: frame.id, type: 'hikvision_intercom/users/delete', user_id: 'u005', revision: before.revision, api_contract: 1 });
    await expect(page.locator(`${SCREEN} tr[data-row-id="u005"]`)).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator(`${SCREEN} [data-wiskey-person-detail]`)).toHaveCount(0);
    expect((await control.get('/people/u005/secret')).status()).toBe(404);
  });
});
