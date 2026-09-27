import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Evidence for T054 phase 3 (CR-005, owner-approved physical actions): door release behind a confirmation dialog, call
// answer / reject / hang up (two taps, only while ringing / in a call), and a spoken announcement - all gated on
// access.release, and each recorded in SMPLWISE's audit log under the real actor.
//
// This spec needs a backend whose WisKey feed is READY with the fixture stations below. The developer backend has no
// Home Assistant, so it is run against a throwaway backend whose Home Assistant WebSocket is an in-process fake that
// answers like WisKey (a `.test` host that never resolves: no real Home Assistant, WisKey or door station is reached):
//   gate   "שער ראשי" ringing, 1 lock   | lobby  "לובי" idle, 2 locks
//   office "משרד"     in a call, 1 lock  | store  "מחסן" offline
// The fake keeps call state across requests (answer -> in_call): start a fresh fixture backend for every run, and run
// one project only (`--project=desktop`). Runs only with SW_LIVE=1 and SW_WISKEY_FIXTURE=1.

const HASH = '#/wiskey/overview';

test.describe('WisKey physical actions (T054 phase 3, access.release)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE !== '1', 'set SW_LIVE=1 SW_WISKEY_FIXTURE=1 against the fixture backend');
  test.describe.configure({ mode: 'serial' });

  async function open(page: Page) {
    await page.goto(`/?design=a${HASH}`);
    await page.waitForSelector('sw-app');
    await expect(page.locator('wiskey-overview [data-wiskey-door="gate"]')).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(800);
  }

  async function auditRows(request: APIRequestContext, action: string): Promise<{ actor_username: string; resource_id: string; reason: string | null; details: Record<string, unknown> }[]> {
    const r = await request.get(`/api/v1/audit?prefix=${encodeURIComponent(action)}&limit=50`);
    expect(r.status()).toBe(200);
    return ((await r.json()) as { rows: { action: string; actor_username: string; resource_id: string; reason: string | null; details: Record<string, unknown> }[] }).rows.filter((row) => row.action === action);
  }

  async function bindUser(request: APIRequestContext, username: string, roleId: string): Promise<string> {
    const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': username } })).json();
    const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: roleId, scope_type: 'installation', scope_id: '*' } });
    expect(r.status()).toBeLessThan(300);
    return ((await r.json()) as { id: string }).id;
  }

  test('the feed is the fixture WisKey, ready', async ({ request }) => {
    const feed = await (await request.get('/api/v1/intercom/overview')).json();
    expect(feed.state).toBe('ready');
    expect(feed.overview.version).toBe('4.2.0-fake');
    expect(feed.overview.stations.map((s: { id: string }) => s.id)).toEqual(['gate', 'lobby', 'office', 'store']);
  });

  test('door release: the first click only opens a confirmation dialog; cancel sends nothing; only the dialog button releases', async ({ page, request }, testInfo) => {
    await open(page);
    const before = (await auditRows(request, 'intercom.release')).length;
    const gate = page.locator('wiskey-overview [data-wiskey-door="gate"]');
    await gate.locator('[data-wiskey-release="1"]').click();
    const dialog = page.locator('wiskey-overview sw-dialog[data-wiskey-release-dialog]');
    await expect(dialog.locator('[role="dialog"]')).toBeVisible();
    await expect(dialog).toHaveAttribute('heading', 'שחרור דלת');
    await expect(dialog).toHaveAttribute('subheading', 'שער ראשי');
    await expect(dialog).toContainText('פקודת שחרור תישלח עכשיו לעמדה');
    await expect(dialog).toContainText('לא שהדלת נפתחה בפועל');
    await page.screenshot({ path: testInfo.outputPath('release-confirm-dialog.png') });
    // the first click sent nothing: no audit row, no result line
    await page.waitForTimeout(1000);
    expect((await auditRows(request, 'intercom.release')).length).toBe(before);
    await expect(gate.locator('[data-wiskey-result]')).toHaveCount(0);
    // the default focus is Cancel, not the release button: Enter on an accidental open does not release
    const focused = await page.evaluate(() => {
      let el: Element | null = document.activeElement;
      while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
      const host = (el?.getRootNode() as ShadowRoot | null)?.host;
      return host?.hasAttribute('data-wiskey-release-cancel') ?? false;
    });
    expect(focused, 'Cancel holds the focus when the dialog opens').toBe(true);
    await dialog.locator('[data-wiskey-release-cancel]').click();
    await expect(dialog).toHaveCount(0);
    expect((await auditRows(request, 'intercom.release')).length).toBe(before);

    // now for real: open again, confirm with the dialog's own button
    await gate.locator('[data-wiskey-release="1"]').click();
    await expect(dialog.locator('[role="dialog"]')).toBeVisible();
    await dialog.locator('[data-wiskey-release-confirm]').click();
    await expect(dialog).toHaveCount(0, { timeout: 15000 });
    const result = gate.locator('[data-wiskey-result]');
    await expect(result).toContainText('WisKey קיבל אותה');
    await expect(result).toContainText('אין אישור שהדלת נפתחה בפועל');
    await expect(result).not.toContainText('הדלת נפתחה.');
    await page.screenshot({ path: testInfo.outputPath('release-accepted.png') });
    const rows = await auditRows(request, 'intercom.release');
    expect(rows.length).toBe(before + 1);
    expect(rows[0].actor_username).toBe('joni');
    expect(rows[0].resource_id).toBe('gate');
    expect(rows[0].details.outcome).toBe('ok');
    expect(rows[0].details.lock).toBe(1);

    // a two-relay station offers one named button per relay; an offline one's release is disabled
    const lobby = page.locator('wiskey-overview [data-wiskey-door="lobby"]');
    await expect(lobby.locator('[data-wiskey-release]')).toHaveCount(2);
    await expect(lobby.locator('[data-wiskey-release="2"]')).toContainText('מחסום');
    await expect(page.locator('wiskey-overview [data-wiskey-door="store"] [data-wiskey-release="1"] button')).toBeDisabled();
  });

  test('call controls: only on a ringing or in-call station, and a single tap only arms them', async ({ page, request }, testInfo) => {
    await open(page);
    const doors = page.locator('wiskey-overview');
    // ringing: answer + reject; in a call: hang up; idle and offline: no call controls at all
    await expect(doors.locator('[data-wiskey-door="gate"] [data-wiskey-call-command]')).toHaveCount(2);
    await expect(doors.locator('[data-wiskey-door="gate"] [data-wiskey-call-command="answer"]')).toBeVisible();
    await expect(doors.locator('[data-wiskey-door="gate"] [data-wiskey-call-command="reject"]')).toBeVisible();
    await expect(doors.locator('[data-wiskey-door="office"] [data-wiskey-call-command]')).toHaveCount(1);
    await expect(doors.locator('[data-wiskey-door="office"] [data-wiskey-call-command="hangUp"]')).toBeVisible();
    await expect(doors.locator('[data-wiskey-door="lobby"] [data-wiskey-call]')).toHaveCount(0);
    await expect(doors.locator('[data-wiskey-door="store"] [data-wiskey-call]')).toHaveCount(0);

    const before = (await auditRows(request, 'intercom.call')).length;
    const answer = doors.locator('[data-wiskey-door="gate"] [data-wiskey-call-command="answer"]');
    await answer.click();
    await expect(answer).toHaveAttribute('data-armed', 'true');
    await expect(answer).toContainText('לחצו שוב למענה');
    await page.screenshot({ path: testInfo.outputPath('call-armed.png') });
    await page.waitForTimeout(800);
    expect((await auditRows(request, 'intercom.call')).length, 'one tap sends nothing').toBe(before);
    await answer.click();
    const result = doors.locator('[data-wiskey-door="gate"] [data-wiskey-result]');
    await expect(result).toContainText('מענה נשלח', { timeout: 15000 });
    await expect(result).toContainText('העמדה אישרה קבלה');
    const rows = await auditRows(request, 'intercom.call');
    expect(rows.length).toBe(before + 1);
    expect(rows[0].actor_username).toBe('joni');
    expect(rows[0].details.signal).toBe('answer');
    // WisKey's refresh push: the gate is now in a call, so it offers hang up instead of answer / reject
    await expect(doors.locator('[data-wiskey-door="gate"] [data-wiskey-call-command="hangUp"]')).toBeVisible({ timeout: 15000 });
    await expect(doors.locator('[data-wiskey-door="gate"] [data-wiskey-call-command="answer"]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('call-answered.png') });
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
    const before = (await auditRows(request, 'intercom.tts')).length;
    await dialog.locator('[data-wiskey-tts-send]').click();
    await expect(dialog).toHaveCount(0, { timeout: 15000 });
    const status = lobby.locator('[data-wiskey-tts-status]');
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('data-wiskey-tts-status', 'completed', { timeout: 20000 });
    await expect(status).toContainText('אין אישור שנשמעה בפועל');
    await page.screenshot({ path: testInfo.outputPath('tts-completed.png') });
    const rows = await auditRows(request, 'intercom.tts');
    expect(rows.length).toBe(before + 1);
    expect(rows[0].actor_username).toBe('joni');
    expect(rows[0].resource_id).toBe('lobby');
    expect(rows[0].details.message).toBe('נא להמתין, השליח בדרך');
    expect(rows[0].details.engine_id).toBe('tts.piper');
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
      expect((await p1.request.post('/api/v1/intercom/stations/gate/release', { data: { lock: 1, confirmed: true } })).status()).toBe(403);
      expect((await p1.request.post('/api/v1/intercom/stations/office/call', { data: { command: 'hangUp' } })).status()).toBe(403);
      expect((await p1.request.get('/api/v1/intercom/tts/engines')).status()).toBe(403);
      expect((await p1.request.post('/api/v1/intercom/stations/lobby/tts', { data: { engine_id: 'tts.piper', language: 'he', message: 'x' } })).status()).toBe(403);
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
