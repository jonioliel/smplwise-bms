import { test, expect, type Page } from '@playwright/test';

// Owner decision 2026-10-01: the grey helper line above every timeline and the diagnostics block under the recording player are
// installation settings - `playback.helper_line` and `playback.diagnostics`, each all | installers | hidden (הגדרות › וידאו ומדיה ›
// צבעי ציר הזמן › תצוגה). "installers" = holders of system.configure at installation scope. Against a MOCKED backend (page.route on
// api/v1; npm run build first, the preview serves dist/); the server-side validation is backend/tests/test_timeline_colors.py.
const PHONE = { width: 390, height: 844 };
const INSTALLER_PERMS = ['video.live', 'video.playback', 'events.read', 'map.read', 'system.configure'];
const VIEWER_PERMS = ['video.live', 'video.playback', 'events.read', 'map.read'];
const MODES = ['all', 'installers', 'hidden'] as const;
type Mode = (typeof MODES)[number];
const HELPER = 'לחיצה או גרירה = חיפוש · גלגלת = זום';

async function mockBackend(page: Page, opts: { installer: boolean; helper: Mode; diagnostics: Mode }) {
  const state = { helper: opts.helper, diagnostics: opts.diagnostics, patches: [] as Record<string, unknown>[] };
  const perms = opts.installer ? INSTALLER_PERMS : VIEWER_PERMS;
  const now = new Date();
  const from = new Date(now.getTime() - 20 * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const to = new Date(now.getTime() - 5 * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u1', username: 'u1', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'תפקיד', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    if (p === 'settings' && req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, string>;
      state.patches.push(body);
      if (body['playback.helper_line']) state.helper = body['playback.helper_line'] as Mode;
      if (body['playback.diagnostics']) state.diagnostics = body['playback.diagnostics'] as Mode;
    }
    if (p === 'settings') {
      return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'time.zone': 'Asia/Jerusalem', 'playback.helper_line': state.helper, 'playback.diagnostics': state.diagnostics }, can_edit: opts.installer });
    }
    if (p === 'cameras') return json({ cameras: [{ id: 'c1', recorder_id: 'r', channel: 1, name: 'כניסה', name_source: 'nvr', alias: null, enabled: true, sort_order: 0, grid_col_span: 1, main_track: 101, sub_track: 102, status: 'online', last_seen_at: null, can_view_live: true }], recorder: null, can_sync: false });
    if (p.startsWith('cameras/c1/recordings')) return json({ camera_id: 'c1', from, to, track_id: 101, segments: [{ start_at: from, end_at: to, kind: 'continuous', track_id: 101, start_raw: '', end_raw: '' }], coverage: 'complete', matches: 1, pages: 1, searched_at: from, timezone: 'Asia/Jerusalem', note: '' });
    if (p.includes('events')) return json({ events: [] });
    if (p.startsWith('cases/bookmarks')) return json({ bookmarks: [] });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-01T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
  return state;
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
}

const visibleFor = (mode: Mode, installer: boolean) => mode === 'all' || (mode === 'installers' && installer);

test.describe('playback screen technical items (playback.helper_line / playback.diagnostics)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
  });

  for (const installer of [true, false]) {
    for (const mode of MODES) {
      test(`${mode} - ${installer ? 'an installer' : 'a viewer'} ${visibleFor(mode, installer) ? 'sees' : 'does not see'} the helper line and the diagnostics block`, async ({ page }) => {
        await mockBackend(page, { installer, helper: mode, diagnostics: mode });
        await open(page, '/investigate/playback');
        const tl = page.locator('investigate-playback sw-timeline');
        await expect(tl).toBeVisible({ timeout: 20000 });
        const diag = page.locator('investigate-playback [data-playback-diagnostics]');
        const helper = tl.locator('[data-timeline-helper]');
        if (visibleFor(mode, installer)) {
          await expect(helper).toContainText(HELPER);
          await expect(helper).not.toContainText('keyframe');
          await expect(helper).not.toContainText('seek');
          await expect(diag).toContainText('Session');
          await expect(diag).toContainText('כיסוי');
        } else {
          await expect(helper).toHaveCount(0);
          await expect(diag).toHaveCount(0);
        }
        // the window buttons stay where they are, the legend is untouched
        await expect(tl.locator('.windows')).toBeVisible();
        await expect(tl.locator('.legend')).toContainText('הקלטה');
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      });
    }
  }

  test('the settings rows show the saved choice, save only what changed, and the screens follow without a reload', async ({ page }) => {
    const mock = await mockBackend(page, { installer: true, helper: 'all', diagnostics: 'all' });
    await open(page, '/system/diagnostics?tab=media');
    const card = page.locator('system-diagnostics system-timeline-colors [data-timeline-colors]');
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.locator('[data-playback-display] .lbl')).toHaveText(['שורת העזר בציר הזמן', 'נתוני אבחון בהקלטה']);
    await expect(card.locator('[data-playback-display="helper_line"] [role="radio"]')).toHaveText(['לכולם', 'מתקינים בלבד', 'מוסתר']);
    await expect(card.locator('[data-playback-display="helper_line"] [data-visibility="all"]')).toHaveAttribute('aria-checked', 'true');
    await expect(card.locator('[data-timeline-save] button')).toBeDisabled();
    await card.locator('[data-playback-display="helper_line"] [data-visibility="hidden"]').click();
    await card.locator('[data-playback-display="diagnostics"] [data-visibility="installers"]').click();
    await card.locator('[data-timeline-save]').click();
    await expect(card.locator('[data-timeline-message]')).toHaveText('הצבעים נשמרו');
    expect(mock.patches).toEqual([{ 'playback.helper_line': 'hidden', 'playback.diagnostics': 'installers' }]);
    // no reload: only the hash changes; the helper line is gone, the diagnostics block stays for this installer
    await page.evaluate(() => (location.hash = '#/investigate/playback'));
    const tl = page.locator('investigate-playback sw-timeline');
    await expect(tl).toBeVisible({ timeout: 20000 });
    await expect(tl.locator('[data-timeline-helper]')).toHaveCount(0);
    await expect(page.locator('investigate-playback [data-playback-diagnostics]')).toHaveCount(1);
  });

  test('a viewer cannot change them: the rows are disabled', async ({ page }) => {
    await mockBackend(page, { installer: false, helper: 'installers', diagnostics: 'hidden' });
    await open(page, '/system/diagnostics?tab=media');
    const card = page.locator('system-diagnostics system-timeline-colors [data-timeline-colors]');
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.locator('[data-playback-display="helper_line"] [data-visibility="installers"]')).toHaveAttribute('aria-checked', 'true');
    await expect(card.locator('[data-playback-display="diagnostics"] [data-visibility="hidden"]')).toHaveAttribute('aria-checked', 'true');
    await expect(card.locator('[data-playback-display] [role="radio"]').first()).toBeDisabled();
    await expect(card.locator('[data-timeline-save]')).toHaveCount(0);
  });
});
