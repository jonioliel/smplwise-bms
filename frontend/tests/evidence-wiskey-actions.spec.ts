import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';

// Evidence for T054 phase 3 (CR-005, owner-approved physical actions): door release behind a confirmation dialog, call
// answer / reject / hang up (two deliberate taps, only while ringing / in a call), and a spoken announcement - all gated
// on access.release, each recorded in SMPLWISE's audit log under the real actor, and every ambiguous failure shown as
// "outcome unknown".
//
// It runs ONLY against the committed fixture backend, tests/fixtures/wiskey_fake_ha.py: the real SMPLWISE backend with
// an in-process fake Home Assistant that answers like WisKey on a `.test` host (no real Home Assistant, WisKey or door
// station is reachable from it). The beforeAll below refuses to run against anything else. How to start it and run
// this spec is at the top of that file. Runs only with SW_LIVE=1 and SW_WISKEY_FIXTURE=1; one project (desktop).

const HASH = '#/wiskey/overview';
const CONTROL = process.env.SW_WISKEY_CONTROL || 'http://127.0.0.1:8357';
const FIXTURE_VERSION = '4.2.0-fake';

type Sent = { type: string; station_id?: string; command?: string; lock?: number }[];

test.describe('WisKey physical actions (T054 phase 3, access.release)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE !== '1', 'set SW_LIVE=1 SW_WISKEY_FIXTURE=1 against the fixture backend');
  test.describe.configure({ mode: 'serial' });

  let control: APIRequestContext;

  test.beforeAll(async ({ playwright }, testInfo) => {
    // explicit, order-independent precondition: this spec fires release / call / announcement commands, so it must
    // be talking to the fixture WisKey and nothing else
    const api = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
    const feed = await (await api.get('/api/v1/intercom/overview')).json();
    await api.dispose();
    if (feed.state !== 'ready' || feed.overview?.version !== FIXTURE_VERSION) {
      throw new Error(`not the WisKey fixture backend (state ${feed.state}, version ${feed.overview?.version}): refusing to send physical commands`);
    }
    control = await pwRequest.newContext({ baseURL: CONTROL });
    expect((await control.post('/reset')).status()).toBe(200);
  });

  test.afterAll(async () => {
    await control?.post('/reset');
    await control?.dispose();
  });

  async function open(page: Page) {
    await page.goto(`/?design=a${HASH}`);
    await page.waitForSelector('sw-app');
    await expect(page.locator('wiskey-overview [data-wiskey-door="gate"]')).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(800);
  }

  async function sent(kind: string): Promise<Sent> {
    return ((await (await control.get('/sent')).json()) as Sent).filter((m) => m.type === `hikvision_intercom/${kind}`);
  }

  async function auditRows(request: APIRequestContext, action: string, phase?: string): Promise<{ actor_username: string; resource_id: string; reason: string | null; details: Record<string, unknown> }[]> {
    const r = await request.get(`/api/v1/audit?prefix=${encodeURIComponent(action)}&limit=200`);
    expect(r.status()).toBe(200);
    const rows = ((await r.json()) as { rows: { action: string; actor_username: string; resource_id: string; reason: string | null; details: Record<string, unknown> }[] }).rows;
    return rows.filter((row) => row.action === action && (!phase || row.details.phase === phase));
  }

  async function bindUser(request: APIRequestContext, username: string, roleId: string): Promise<string> {
    const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': username } })).json();
    const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: roleId, scope_type: 'installation', scope_id: '*' } });
    expect(r.status()).toBeLessThan(300);
    return ((await r.json()) as { id: string }).id;
  }

  test('door release: the first click only opens a confirmation dialog; cancel sends nothing; only the dialog button releases', async ({ page, request }, testInfo) => {
    await open(page);
    const before = (await auditRows(request, 'intercom.release', 'attempt')).length;
    const gate = page.locator('wiskey-overview [data-wiskey-door="gate"]');
    await gate.locator('[data-wiskey-release="1"]').click();
    const dialog = page.locator('wiskey-overview sw-dialog[data-wiskey-release-dialog]');
    await expect(dialog.locator('[role="dialog"]')).toBeVisible();
    await expect(dialog).toHaveAttribute('heading', 'שחרור דלת');
    await expect(dialog).toHaveAttribute('subheading', 'שער ראשי');
    await expect(dialog).toContainText('פקודת שחרור תישלח עכשיו לעמדה');
    await expect(dialog).toContainText('לא שהדלת נפתחה בפועל');
    await page.screenshot({ path: testInfo.outputPath('release-confirm-dialog.png') });
    // the first click sent nothing
    await page.waitForTimeout(1000);
    expect(await sent('stations/test_unlock')).toHaveLength(0);
    expect((await auditRows(request, 'intercom.release', 'attempt')).length).toBe(before);
    await expect(gate.locator('[data-wiskey-result]')).toHaveCount(0);
    // the initial focus is Cancel, not the release button: Enter on an accidental open does not release
    const focused = await page.evaluate(() => {
      let el: Element | null = document.activeElement;
      while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
      const host = (el?.getRootNode() as ShadowRoot | null)?.host;
      return host?.hasAttribute('data-wiskey-release-cancel') ?? false;
    });
    expect(focused, 'Cancel holds the focus when the dialog opens').toBe(true);
    await dialog.locator('[data-wiskey-release-cancel]').click();
    await expect(dialog).toHaveCount(0);
    expect(await sent('stations/test_unlock')).toHaveLength(0);

    // now for real: open again, confirm with the dialog's own button
    await gate.locator('[data-wiskey-release="1"]').click();
    await expect(dialog.locator('[role="dialog"]')).toBeVisible();
    await dialog.locator('[data-wiskey-release-confirm]').click();
    await expect(dialog).toHaveCount(0, { timeout: 15000 });
    const result = gate.locator('[data-wiskey-result]');
    await expect(result).toContainText('WisKey קיבל אותה');
    await expect(result).toContainText('אין אישור שהדלת נפתחה בפועל');
    await page.screenshot({ path: testInfo.outputPath('release-accepted.png') });
    const frames = await sent('stations/test_unlock');
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ station_id: 'gate', lock: 1 });
    const attempts = await auditRows(request, 'intercom.release', 'attempt');
    const outcomes = await auditRows(request, 'intercom.release', 'outcome');
    expect(attempts.length).toBe(before + 1);
    expect(attempts[0].actor_username).toBe('joni');
    expect(outcomes[0].details.command_id).toBe(attempts[0].details.command_id);
    expect(outcomes[0].details.outcome).toBe('ok');
    expect(typeof attempts[0].details.client_request_id).toBe('string');

    // a two-relay station offers one named button per relay; an offline one's release is disabled
    const lobby = page.locator('wiskey-overview [data-wiskey-door="lobby"]');
    await expect(lobby.locator('[data-wiskey-release]')).toHaveCount(2);
    await expect(lobby.locator('[data-wiskey-release="2"]')).toContainText('מחסום');
    await expect(page.locator('wiskey-overview [data-wiskey-door="store"] [data-wiskey-release="1"] button')).toBeDisabled();
  });

  test('a release WisKey accepted with an unexpected answer reads "outcome unknown" (amber) and that relay is held', async ({ page, request }, testInfo) => {
    expect((await control.post('/mode', { data: { unlock: 'unexpected' } })).status()).toBe(200);
    try {
      await open(page);
      const lobby = page.locator('wiskey-overview [data-wiskey-door="lobby"]');
      await lobby.locator('[data-wiskey-release="2"]').click();
      await page.locator('wiskey-overview sw-dialog[data-wiskey-release-dialog] [data-wiskey-release-confirm]').click();
      const result = lobby.locator('[data-wiskey-result]');
      await expect(result).toContainText('לא ידוע אם הפקודה בוצעה', { timeout: 15000 });
      await expect(result).toHaveClass(/warn/);
      await expect(result).not.toContainText('לא בוצעה');
      const button = lobby.locator('[data-wiskey-release="2"]');
      await expect(button).toHaveAttribute('data-held', 'true');
      await expect(button.locator('button')).toBeDisabled();
      await page.screenshot({ path: testInfo.outputPath('release-unknown.png') });
      // the backend holds the relay too: a direct second release is refused and not sent
      const now = new Date(Date.now() + 15000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const r = await request.post('/api/v1/intercom/stations/lobby/release', { data: { lock: 2, confirmed: true, client_request_id: `retry-${Date.now()}`, expires_at: now } });
      expect(r.status()).toBe(409);
      expect((await r.json()).code).toBe('intercom_release_in_progress');
      expect((await sent('stations/test_unlock')).filter((m) => m.station_id === 'lobby')).toHaveLength(1);
      const [outcome] = await auditRows(request, 'intercom.release', 'outcome');
      expect(outcome.details.outcome).toBe('unknown');
      // after the hold the button is usable again
      await expect(button).toHaveAttribute('data-held', 'false', { timeout: 15000 });

      // WisKey's own `release_unconfirmed` (its device call errored after the open may have reached the device) is
      // "outcome unknown" too, never "refused": the relay is held, and a second press sends no second frame
      expect((await control.post('/mode', { data: { unlock: 'unconfirmed' } })).status()).toBe(200);
      const office = page.locator('wiskey-overview [data-wiskey-door="office"]');
      await office.locator('[data-wiskey-release="1"]').click();
      await page.locator('wiskey-overview sw-dialog[data-wiskey-release-dialog] [data-wiskey-release-confirm]').click();
      await expect(office.locator('[data-wiskey-result]')).toContainText('לא ידוע אם הפקודה בוצעה', { timeout: 15000 });
      await expect(office.locator('[data-wiskey-result]')).toContainText('release_unconfirmed');
      await expect(office.locator('[data-wiskey-release="1"]')).toHaveAttribute('data-held', 'true');
      const again = await request.post('/api/v1/intercom/stations/office/release', { data: { lock: 1, confirmed: true, client_request_id: `again-${Date.now()}`, expires_at: now } });
      expect(again.status()).toBe(409);
      expect((await sent('stations/test_unlock')).filter((m) => m.station_id === 'office')).toHaveLength(1);
      const [unconfirmed] = await auditRows(request, 'intercom.release', 'outcome');
      expect(unconfirmed.details.outcome).toBe('unknown');
      expect(unconfirmed.reason).toBe('release_unconfirmed');
    } finally {
      await control.post('/mode', { data: { unlock: 'accept' } });
    }
  });

  test('a device clock minutes off still releases: the expiry is computed on the server clock', async ({ page, request }) => {
    for (const skewMin of [-5, 3]) {
      // this device's clock is `skewMin` minutes off; before the fix -5 was always "expired", +3 always "too far ahead"
      await page.clock.setSystemTime(new Date(Date.now() + skewMin * 60_000));
      await open(page);
      const gate = page.locator('wiskey-overview [data-wiskey-door="gate"]');
      await gate.locator('[data-wiskey-release="1"]').click();
      await page.locator('wiskey-overview sw-dialog[data-wiskey-release-dialog] [data-wiskey-release-confirm]').click();
      await expect(gate.locator('[data-wiskey-result]')).toContainText('WisKey קיבל אותה', { timeout: 15000 });
      const [attempt] = await auditRows(request, 'intercom.release', 'attempt');
      const expires = Date.parse(String(attempt.details.expires_at));
      expect(Math.abs(expires - Date.now()), `skew ${skewMin} min: expires_at is on the server's time line`).toBeLessThan(30_000);
    }
  });

  test('a dropped connection on a release reads "outcome unknown", never a plain "no connection" failure', async ({ page }) => {
    await open(page);
    await page.route('**/api/v1/intercom/stations/lobby/release', (route) => route.abort('connectionreset'));
    const lobby = page.locator('wiskey-overview [data-wiskey-door="lobby"]');
    await lobby.locator('[data-wiskey-release="1"]').click();
    await page.locator('wiskey-overview sw-dialog[data-wiskey-release-dialog] [data-wiskey-release-confirm]').click();
    const result = lobby.locator('[data-wiskey-result]');
    await expect(result).toContainText('לא ידוע אם הפקודה בוצעה', { timeout: 15000 });
    await expect(result).toHaveClass(/warn/);
    await expect(lobby.locator('[data-wiskey-release="1"]')).toHaveAttribute('data-held', 'true');
    await page.unroute('**/api/v1/intercom/stations/lobby/release');
  });

  test('call controls: only on a ringing or in-call station; a double-click, a too-quick second tap or a lapsed arm sends nothing', async ({ page, request }, testInfo) => {
    await open(page);
    const doors = page.locator('wiskey-overview');
    await expect(doors.locator('[data-wiskey-door="gate"] [data-wiskey-call-command]')).toHaveCount(2);
    await expect(doors.locator('[data-wiskey-door="gate"] [data-wiskey-call-command="answer"]')).toBeVisible();
    await expect(doors.locator('[data-wiskey-door="gate"] [data-wiskey-call-command="reject"]')).toBeVisible();
    await expect(doors.locator('[data-wiskey-door="office"] [data-wiskey-call-command]')).toHaveCount(1);
    await expect(doors.locator('[data-wiskey-door="office"] [data-wiskey-call-command="hangUp"]')).toBeVisible();
    await expect(doors.locator('[data-wiskey-door="lobby"] [data-wiskey-call]')).toHaveCount(0);
    await expect(doors.locator('[data-wiskey-door="store"] [data-wiskey-call]')).toHaveCount(0);

    const answer = doors.locator('[data-wiskey-door="gate"] [data-wiskey-call-command="answer"]');
    // a double-click is one gesture: it arms, it does not confirm
    await answer.dblclick();
    await expect(answer).toHaveAttribute('data-armed', 'true');
    await page.waitForTimeout(700);
    expect(await sent('media/signal'), 'a double-click sends nothing').toHaveLength(0);
    // the arm lapses after 4 s
    await expect(answer).toHaveAttribute('data-armed', 'false', { timeout: 5000 });
    // arm, then a second tap sooner than 500 ms: ignored
    await answer.click();
    await expect(answer).toHaveAttribute('data-armed', 'true');
    await answer.click({ delay: 0 });
    await page.waitForTimeout(700);
    expect(await sent('media/signal'), 'a too-quick second tap sends nothing').toHaveLength(0);
    await expect(answer).toHaveAttribute('data-armed', 'true');
    await expect(answer).toContainText('לחצו שוב למענה');
    await page.screenshot({ path: testInfo.outputPath('call-armed.png') });
    // a deliberate second tap sends
    await answer.click();
    const result = doors.locator('[data-wiskey-door="gate"] [data-wiskey-result]');
    await expect(result).toContainText('מענה נשלח', { timeout: 15000 });
    await expect(result).toContainText('העמדה אישרה קבלה');
    expect(await sent('media/signal')).toHaveLength(1);
    const outcomes = await auditRows(request, 'intercom.call', 'outcome');
    expect(outcomes[0].actor_username).toBe('joni');
    expect(outcomes[0].details.signal).toBe('answer');
    // WisKey's refresh push: the gate is now in a call, so it offers hang up instead of answer / reject
    await expect(doors.locator('[data-wiskey-door="gate"] [data-wiskey-call-command="hangUp"]')).toBeVisible({ timeout: 15000 });
    await expect(doors.locator('[data-wiskey-door="gate"] [data-wiskey-call-command="answer"]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('call-answered.png') });
  });

  test('an armed call control is dropped when that call changes state - it never fires against a call that is gone', async ({ page }) => {
    await open(page);
    const office = page.locator('wiskey-overview [data-wiskey-door="office"]');
    const hangUp = office.locator('[data-wiskey-call-command="hangUp"]');
    await hangUp.click();
    await expect(hangUp).toHaveAttribute('data-armed', 'true');
    // the call ends elsewhere while the button is armed
    expect((await control.post('/station', { data: { id: 'office', call_state: 'idle' } })).status()).toBe(200);
    await expect(office.locator('[data-wiskey-call]')).toHaveCount(0, { timeout: 15000 });
    // a new call comes in: the button is back, NOT armed - one tap only arms again
    expect((await control.post('/station', { data: { id: 'office', call_state: 'in_call' } })).status()).toBe(200);
    await expect(hangUp).toBeVisible({ timeout: 15000 });
    await expect(hangUp).toHaveAttribute('data-armed', 'false');
    await page.waitForTimeout(600);
    await hangUp.click();
    await expect(hangUp).toHaveAttribute('data-armed', 'true');
    await page.waitForTimeout(700);
    expect((await sent('media/signal')).filter((m) => m.station_id === 'office'), 'nothing was sent to the office').toHaveLength(0);
  });

  test('announcement: the engine list populates, a message is composed and sent, and its progress is shown honestly', async ({ page, request }, testInfo) => {
    await open(page);
    const lobby = page.locator('wiskey-overview [data-wiskey-door="lobby"]');
    await lobby.locator('[data-wiskey-speak]').click();
    const dialog = page.locator('wiskey-overview sw-dialog[data-wiskey-tts-dialog]');
    await expect(dialog.locator('[role="dialog"]')).toBeVisible();
    const engine = dialog.locator('select[data-wiskey-tts-engine]');
    await expect(engine.locator('option')).toHaveCount(2, { timeout: 15000 });
    await expect(engine).toHaveValue('tts.piper');
    await expect(dialog.locator('select[data-wiskey-tts-language]')).toHaveValue('he');
    await expect(dialog.locator('[data-wiskey-tts-external]')).toContainText('אם זהו שירות ענן, הטקסט יוצא מהמבנה');
    await expect(dialog.locator('[data-wiskey-tts-send] button')).toBeDisabled();
    await dialog.locator('textarea[data-wiskey-tts-message]').fill('  נא להמתין,   השליח בדרך  ');
    await expect(dialog.locator('[data-wiskey-tts-send] button')).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('tts-compose.png') });
    await dialog.locator('[data-wiskey-tts-send]').click();
    await expect(dialog).toHaveCount(0, { timeout: 15000 });
    const status = lobby.locator('[data-wiskey-tts-status]');
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('data-wiskey-tts-status', 'completed', { timeout: 20000 });
    await expect(status).toContainText('אין אישור שנשמעה בפועל');
    await page.screenshot({ path: testInfo.outputPath('tts-completed.png') });
    const [start] = await sent('tts/start');
    expect(start).toMatchObject({ station_id: 'lobby' });
    const [outcome] = await auditRows(request, 'intercom.tts', 'outcome');
    expect(outcome.actor_username).toBe('joni');
    expect(outcome.resource_id).toBe('lobby');
    expect(outcome.details.message).toBe('נא להמתין, השליח בדרך');
    expect(outcome.details.engine_id).toBe('tts.piper');
  });

  test('a viewer (access.read only) sees the doors but no controls, and the API refuses them; a site_admin sees the controls', async ({ browser, request }) => {
    const bindings: string[] = [];
    try {
      bindings.push(await bindUser(request, 'wiskeyviewer054p3', 'viewer'));
      bindings.push(await bindUser(request, 'wiskeysiteadmin054p3', 'site_admin'));
      const viewer = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': 'wiskeyviewer054p3' } });
      const p1 = await viewer.newPage();
      await open(p1);
      await expect(p1.locator('wiskey-overview [data-wiskey-door]')).toHaveCount(4);
      await expect(p1.locator('wiskey-overview [data-wiskey-actions]')).toHaveCount(0);
      await expect(p1.locator('wiskey-overview [data-wiskey-release]')).toHaveCount(0);
      await expect(p1.locator('wiskey-overview [data-wiskey-call-command]')).toHaveCount(0);
      await expect(p1.locator('wiskey-overview [data-wiskey-speak]')).toHaveCount(0);
      const expires = new Date(Date.now() + 15000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const envl = () => ({ client_request_id: `viewer-${Date.now()}-${Math.random().toString(16).slice(2)}`, expires_at: expires });
      expect((await p1.request.post('/api/v1/intercom/stations/gate/release', { data: { lock: 1, confirmed: true, ...envl() } })).status()).toBe(403);
      expect((await p1.request.post('/api/v1/intercom/stations/office/call', { data: { command: 'hangUp', ...envl() } })).status()).toBe(403);
      expect((await p1.request.get('/api/v1/intercom/tts/engines')).status()).toBe(403);
      expect((await p1.request.post('/api/v1/intercom/stations/lobby/tts', { data: { engine_id: 'tts.piper', language: 'he', message: 'x', ...envl() } })).status()).toBe(403);
      await viewer.close();

      const admin = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': 'wiskeysiteadmin054p3' } });
      const p2 = await admin.newPage();
      await open(p2);
      await expect(p2.locator('wiskey-overview [data-wiskey-actions]')).toHaveCount(4);
      await expect(p2.locator('wiskey-overview [data-wiskey-door="gate"] [data-wiskey-release="1"]')).toBeVisible();
      await admin.close();
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
    }
  });
});
