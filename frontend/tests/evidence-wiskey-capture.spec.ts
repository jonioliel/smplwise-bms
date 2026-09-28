import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';
import { useSmplwiseWiskeyScreens } from './wiskey-ui-mode';

// The SMPLWISE WisKey screens, not the embedded WisKey panel (the default since the 2026-09-28 decision).
useSmplwiseWiskeyScreens();

// Evidence for WisKey card capture (CR-005 phase 2, slice A2, `access.cards.capture` + `access.people.manage`): the port
// of WisKey's own capture dialog (panel.ts:1432-1630) opened from the person editor's cards section. Runs against the
// committed fixture backend tests/fixtures/wiskey_fake_ha.py (the real SMPLWISE backend with an in-process fake Home
// Assistant whose cards/* commands follow WisKey's access/enrollment.py: one session per station, a collection window,
// a session TTL, the collected number kept on WisKey's side and shown masked). A person "presents a card" through the
// fixture's control API. Runs with SW_LIVE=1 SW_WISKEY_FIXTURE=1, one project (desktop); how to start the fixture is at
// the top of that file. NOT a test of a real reader: WisKey's own copy says physical collection still needs
// commissioning, and the first real use is the live test (DOCS.md).
//
// Covered: the gating (a people editor without access.cards.capture sees no capture control and every capture endpoint
// refuses; a new person cannot capture; a modified draft must be saved first), start behind the confirmation step with
// WisKey's exact frame -> waiting with a countdown -> a presented card shown masked -> approval (WisKey's exact frame) ->
// the editor reloads with the card saved and masked, the number in no response and nowhere in the document; the timeout
// path (WisKey's collector gives up); cancel; a station that advertises no collection; a start whose outcome is unknown
// ("the reader may still be collecting until WisKey's timeout", the station held).

const HREF = '#/wiskey/people';
const SCREEN = 'wiskey-people';
const EDITOR = 'wiskey-people wiskey-person-editor';
const DIALOG = 'wiskey-people wiskey-person-editor wiskey-card-capture';
const CONTROL = process.env.SW_WISKEY_CONTROL || 'http://127.0.0.1:8357';
const FIXTURE_VERSION = '4.2.0-fake';
const PERSON = 'u013'; // Maya Rosen, gate + lobby, one saved card (•••• 7012)
const NUMBER = 'QRSTWXYZ'; // the card the fixture reader "reads": only WisKey (the fixture) may ever hold it
const MASK = '•••• WXYZ';
type Sent = ({ id: number; type: string } & Record<string, unknown>)[];

test.describe('WisKey card capture against the fixture WisKey (CR-005 phase 2 A2)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE !== '1', 'set SW_LIVE=1 SW_WISKEY_FIXTURE=1 against the fixture backend');
  test.describe.configure({ mode: 'serial' });

  let control: APIRequestContext;
  let api: APIRequestContext;

  test.beforeAll(async ({ playwright }, testInfo) => {
    api = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
    const feed = await (await api.get('/api/v1/intercom/overview')).json();
    if (feed.state !== 'ready' || feed.overview?.version !== FIXTURE_VERSION) throw new Error(`not the WisKey fixture backend (state ${feed.state}, version ${feed.overview?.version})`);
    control = await pwRequest.newContext({ baseURL: CONTROL });
    expect((await control.post('/reset')).status()).toBe(200);
    expect((await control.post('/limits', { data: { user_burst: 100, user_rate: 10, global_burst: 200, global_rate: 20, config_user_burst: 50, config_user_rate: 5 } })).status()).toBe(200);
  });

  test.afterAll(async () => {
    await control?.post('/reset');
    await control?.dispose();
    await api?.dispose();
  });

  const rows = (page: Page) => page.locator(`${SCREEN} sw-table[data-wiskey-people-table] tbody tr`);
  const editor = (page: Page) => page.locator(EDITOR);
  const field = (page: Page, name: string) => editor(page).locator(`[data-wiskey-editor-${name}]`);
  const dialog = (page: Page) => page.locator(DIALOG);
  const cap = (page: Page, name: string) => dialog(page).locator(`[data-wiskey-capture-${name}]`);
  const state = (page: Page) => dialog(page).locator('sw-dialog[data-wiskey-capture]');

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

  async function openCapture(page: Page) {
    await openPeople(page);
    await openEditorFor(page, PERSON);
    await field(page, 'capture-open').click();
    await expect(state(page)).toHaveAttribute('data-wiskey-capture-step', 'choose', { timeout: 15000 });
  }

  async function startAt(page: Page, station: string) {
    await cap(page, 'station').selectOption(station);
    await expect(cap(page, 'next').locator('button')).toBeEnabled({ timeout: 15000 });
    await cap(page, 'next').click();
    await expect(state(page)).toHaveAttribute('data-wiskey-capture-step', 'confirm');
    await cap(page, 'start').click();
  }

  async function sent(kind: string): Promise<Sent> {
    return ((await (await control.get('/sent')).json()) as Sent).filter((m) => m.type === `hikvision_intercom/${kind}`);
  }

  /** Whether `needle` is anywhere in the live document (text, attribute values, input values), through every shadow root. */
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

  test('gating: people editing without access.cards.capture offers no capture and every capture endpoint refuses; a new person and a modified draft cannot capture', async ({ browser, page, request }, testInfo) => {
    const role = await request.post('/api/v1/access/roles', { data: { name: `people-no-capture-${Date.now()}`, description: 'A1 without A2', permissions: ['access.read'], sensitive: ['access.people.manage'] } });
    expect(role.status()).toBe(201);
    const roleId = ((await role.json()) as { id: string }).id;
    const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': 'wiskeypeopleonly' } })).json();
    const bound = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: roleId, scope_type: 'installation', scope_id: '*' } });
    expect(bound.status()).toBeLessThan(300);
    const binding = ((await bound.json()) as { id: string }).id;
    try {
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': 'wiskeypeopleonly' } });
      const p = await ctx.newPage();
      await openPeople(p);
      await openEditorFor(p, PERSON);
      await expect(field(p, 'capture-denied')).toBeVisible();
      await expect(field(p, 'capture-denied')).toContainText('access.cards.capture');
      await expect(field(p, 'capture-open')).toHaveCount(0);
      expect((await p.request.get('/api/v1/intercom/stations/gate/card-readers')).status()).toBe(403);
      expect((await p.request.post(`/api/v1/intercom/people/${PERSON}/card-capture`, { data: { station_id: 'gate', reader_id: 0, revision: 1, confirmed: true } })).status()).toBe(403);
      expect((await p.request.get('/api/v1/intercom/card-capture/0123456789abcdef')).status()).toBe(403);
      expect((await p.request.post('/api/v1/intercom/card-capture/0123456789abcdef/cancel', { data: {} })).status()).toBe(403);
      await ctx.close();
    } finally {
      await request.delete(`/api/v1/access/bindings/${binding}`).catch(() => {});
    }
    expect(await sent('cards/capture_start')).toHaveLength(0);
    // the administrator: a new person cannot capture yet (WisKey: save the person first)
    await openPeople(page);
    await page.locator(`${SCREEN} [data-wiskey-people-add]`).click();
    await expect(field(page, 'name')).toBeVisible({ timeout: 15000 });
    await expect(field(page, 'capture-open').locator('button')).toBeDisabled();
    await expect(field(page, 'capture')).toContainText('יש לשמור תחילה את המשתמש החדש');
    await field(page, 'cancel').click();
    await expect(editor(page)).toHaveCount(0);
    // an existing person with a modified draft: save or discard first (WisKey editorAction)
    await openEditorFor(page, PERSON);
    await field(page, 'name').fill('שינוי שלא נשמר');
    await field(page, 'capture-open').click();
    await expect(field(page, 'error')).toHaveAttribute('data-wiskey-editor-error-code', 'profile_save_first');
    await expect(dialog(page)).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('wiskey-capture-editor-cards.png'), fullPage: true });
  });

  test('start -> present -> approve: confirmation step, WisKey\'s exact frames, the card masked, saved to the person; the number in no response and not in the document', async ({ page }, testInfo) => {
    const bodies: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/v1/')) void res.text().then((t) => bodies.push(t)).catch(() => {});
    });
    await openCapture(page);
    // WisKey's defaults: the first online station with a managed lock, its readers read from the device
    await expect(cap(page, 'station')).toHaveValue('gate');
    await expect(cap(page, 'station').locator('option:not([disabled])')).toHaveCount(3); // gate, lobby, office (store is offline)
    await expect(cap(page, 'reader').locator('option')).toHaveText(['קורא ברירת המחדל בתחנה']);
    await cap(page, 'station').selectOption('lobby');
    await expect(cap(page, 'reader').locator('option')).toHaveText(['1', '2'], { timeout: 15000 });
    await cap(page, 'reader').selectOption('2');
    await cap(page, 'next').click();
    // the confirmation step: what happens at the door, what the person must do
    await expect(cap(page, 'confirm-step')).toContainText('להפעיל את קורא הכרטיסים בעמדה לובי?');
    await expect(cap(page, 'confirm-step')).toContainText('כרטיס אחד');
    await expect(cap(page, 'confirm-step')).toContainText('רק אחרי אישורכם');
    expect(await sent('cards/capture_start')).toHaveLength(0);
    await page.screenshot({ path: testInfo.outputPath('wiskey-capture-confirm-step.png'), fullPage: true });
    await cap(page, 'start').click();
    await expect(state(page)).toHaveAttribute('data-wiskey-capture-state', 'waiting', { timeout: 15000 });
    await expect(cap(page, 'status')).toContainText('הצמד כעת כרטיס אחד');
    const left = Number(await cap(page, 'countdown').getAttribute('data-wiskey-capture-countdown'));
    expect(left).toBeGreaterThan(20); // the reader's own 30 s wait (WisKey's device deadline), not WisKey's 70 s bound
    expect(left).toBeLessThanOrEqual(30);
    const person = (await (await page.request.get(`/api/v1/intercom/people/${PERSON}/editor`)).json()).person as { revision: number; cards: { masked_number: string }[] };
    const [start] = await sent('cards/capture_start');
    expect(start).toEqual({ id: start.id, type: 'hikvision_intercom/cards/capture_start', station_id: 'lobby', user_id: PERSON, revision: person.revision, reader_id: 2, api_contract: 1 });
    await page.screenshot({ path: testInfo.outputPath('wiskey-capture-waiting.png'), fullPage: true });
    // the person holds a card to the lobby reader
    expect((await control.post('/capture/present', { data: { number: NUMBER, station: 'lobby' } })).status()).toBe(200);
    await expect(state(page)).toHaveAttribute('data-wiskey-capture-state', 'captured', { timeout: 15000 });
    await expect(cap(page, 'card')).toContainText(MASK);
    await expect(cap(page, 'card')).toContainText('TypeA_M1');
    await expect(cap(page, 'status')).toContainText('הכרטיס נקרא');
    await expect(dialog(page)).toContainText('שיוכים קיימים לאינטרקומים: שער ראשי, לובי');
    await cap(page, 'label').fill('תג אורח');
    await page.screenshot({ path: testInfo.outputPath('wiskey-capture-captured.png'), fullPage: true });
    // approval: behind WisKey's own question naming the person
    await cap(page, 'save').click();
    await expect(cap(page, 'save-prompt')).toContainText('להוסיף את הכרטיס שנקרא למשתמש Maya Rosen');
    expect(await sent('cards/capture_confirm')).toHaveLength(0);
    await cap(page, 'save-confirm').click();
    await expect(dialog(page)).toHaveCount(0, { timeout: 15000 });
    const [confirm] = await sent('cards/capture_confirm');
    expect(confirm).toEqual({ id: confirm.id, type: 'hikvision_intercom/cards/capture_confirm', session_id: confirm.session_id, label: 'תג אורח', api_contract: 1 });
    expect(confirm.session_id).toMatch(/^[0-9a-f]{32}$/);
    // the editor now shows the saved record: the new card among the saved ones, masked and read-only
    await expect(field(page, 'notice')).toContainText('הכרטיס נוסף למשתמש');
    const saved = editor(page).locator('[data-wiskey-editor-card="saved"]');
    await expect(saved).toHaveCount(person.cards.length + 1);
    await expect(saved.last().locator('[data-wiskey-editor-card-masked]')).toHaveValue(MASK);
    await expect(saved.last().locator('[data-wiskey-editor-card-label]')).toHaveValue('תג אורח');
    // WisKey (the fixture) holds the number; SMPLWISE never had it
    const secret = await (await control.get(`/people/${PERSON}/secret`)).json();
    expect(Object.values(secret.cards)).toContain(NUMBER);
    expect(secret.revision).toBe(person.revision + 1);
    await expect.poll(() => bodies.length).toBeGreaterThan(5);
    expect(bodies.some((b) => b.includes(NUMBER))).toBe(false);
    expect(await domHolds(page, NUMBER)).toBe(false);
    expect(await domHolds(page, 'WXYZ')).toBe(true); // positive control: the masked last four are shown
    await page.screenshot({ path: testInfo.outputPath('wiskey-capture-saved.png'), fullPage: true });
    await field(page, 'cancel').click();
    await expect(editor(page)).toHaveCount(0);
  });

  test('timeout: WisKey\'s collector gives up - "no card was saved", WisKey\'s failed session let go, collect again', async ({ page }, testInfo) => {
    expect((await control.post('/capture/mode', { data: { collect_s: 4 } })).status()).toBe(200);
    try {
      await openCapture(page);
      await startAt(page, 'gate');
      await expect(state(page)).toHaveAttribute('data-wiskey-capture-state', 'waiting', { timeout: 15000 });
      await expect(state(page)).toHaveAttribute('data-wiskey-capture-state', 'error', { timeout: 20000 });
      await expect(cap(page, 'wiskey-error')).toHaveAttribute('data-wiskey-capture-wiskey-error', 'capture_timeout');
      await expect(dialog(page)).toContainText('לא התקבלה תשובה לפני תום זמן ההמתנה. לא נשמר כרטיס.');
      await expect(cap(page, 'save')).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath('wiskey-capture-timeout.png'), fullPage: true });
      // the backend released WisKey's failed session (WisKey keeps it, and the station's slot, until its TTL otherwise)
      await expect.poll(async () => (await (await control.get('/captures')).json()).length, { timeout: 10000 }).toBe(0);
      await cap(page, 'again').click();
      await expect(state(page)).toHaveAttribute('data-wiskey-capture-step', 'choose');
      await cap(page, 'close').click();
      await expect(dialog(page)).toHaveCount(0);
    } finally {
      await control.post('/capture/mode', { data: { collect_s: 70 } });
    }
  });

  test('cancel: the administrator stops the collection - WisKey gets capture_cancel, the dialog says cancelled and that the reader\'s own timeout is the firmware\'s', async ({ page }, testInfo) => {
    await openCapture(page);
    await startAt(page, 'gate');
    await expect(state(page)).toHaveAttribute('data-wiskey-capture-state', 'waiting', { timeout: 15000 });
    const before = (await sent('cards/capture_cancel')).length;
    await cap(page, 'cancel').click();
    await expect(state(page)).toHaveAttribute('data-wiskey-capture-state', 'cancelled', { timeout: 15000 });
    await expect(cap(page, 'status')).toContainText('הקריאה בוטלה. לא נשמר כרטיס.');
    await expect(dialog(page)).toContainText('זמן ההמתנה בקורא נקבע בקושחה');
    const cancels = await sent('cards/capture_cancel');
    expect(cancels.length).toBe(before + 1);
    expect(cancels.at(-1)).toEqual({ id: cancels.at(-1)!.id, type: 'hikvision_intercom/cards/capture_cancel', session_id: cancels.at(-1)!.session_id, api_contract: 1 });
    expect(await (await control.get('/captures')).json()).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('wiskey-capture-cancelled.png'), fullPage: true });
    // closing the dialog mid-collection cancels too (WisKey clearCapture)
    await cap(page, 'again').click();
    await startAt(page, 'gate');
    await expect(state(page)).toHaveAttribute('data-wiskey-capture-state', 'waiting', { timeout: 15000 });
    await cap(page, 'close').click();
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(async () => (await sent('cards/capture_cancel')).length, { timeout: 10000 }).toBe(before + 2);
    await expect.poll(async () => (await (await control.get('/captures')).json()).length).toBe(0);
  });

  test('a station that advertises no card collection is said so; nothing is started there', async ({ page }) => {
    await openCapture(page);
    await cap(page, 'station').selectOption('office');
    await expect(cap(page, 'error')).toHaveAttribute('data-wiskey-capture-error', 'capture_unsupported', { timeout: 15000 });
    await expect(cap(page, 'error')).toContainText('האינטרקום אינו מפרסם יכולת נתמכת לקריאת כרטיס');
    await expect(cap(page, 'next').locator('button')).toBeDisabled();
    expect((await sent('cards/capture_start')).filter((m) => m.station_id === 'office')).toHaveLength(0);
    await cap(page, 'close').click();
  });

  test('unknown outcome: a start WisKey does not clearly answer - "the reader may still be collecting", never "nothing happened"; the station is held', async ({ page }, testInfo) => {
    expect((await control.post('/capture/mode', { data: { start: 'unknown' } })).status()).toBe(200);
    try {
      await openCapture(page);
      await startAt(page, 'lobby');
      await expect(state(page)).toHaveAttribute('data-wiskey-capture-step', 'start_unknown', { timeout: 15000 });
      const err = cap(page, 'error');
      await expect(err).toHaveAttribute('data-wiskey-capture-outcome', 'unknown');
      await expect(err).toContainText('לא ידוע אם הקורא נכנס למצב קריאה');
      await expect(err).not.toContainText('לא בוצעה');
      const left = Number(await cap(page, 'countdown').getAttribute('data-wiskey-capture-countdown'));
      expect(left).toBeGreaterThan(100);
      await expect(cap(page, 'countdown')).toContainText('שום כרטיס לא יתווסף בלי אישורכם');
      await page.screenshot({ path: testInfo.outputPath('wiskey-capture-start-unknown.png'), fullPage: true });
      // a second start at the held station is refused by SMPLWISE itself (nothing sent), with the wait
      const starts = (await sent('cards/capture_start')).length;
      await cap(page, 'again').click();
      await startAt(page, 'lobby');
      await expect(cap(page, 'error')).toHaveAttribute('data-wiskey-capture-error', 'intercom_capture_station_busy', { timeout: 15000 });
      await expect(cap(page, 'error')).toContainText('ייתכן שהקורא עדיין במצב קריאה');
      expect((await sent('cards/capture_start')).length).toBe(starts);
      await cap(page, 'close').click();
    } finally {
      await control.post('/capture/mode', { data: { start: 'accept' } });
    }
  });
});
