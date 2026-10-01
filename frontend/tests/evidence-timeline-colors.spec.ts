import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Owner 2026-10-01: on the investigation timeline the person dots and the recording bars were both blue. Each kind now has a
// colour, an installation setting (`timeline.colors`, הגדרות › וידאו ומדיה › צבעי ציר הזמן): a card with a row per option
// (name, live dot, ten swatches, a native colour input), "איפוס לברירת מחדל", and a soft note when two options look alike.
// The timeline, its legend and event dots follow through custom properties (--sw-tl-*), with no reload.
// Against a MOCKED backend (page.route on api/v1; npm run build first, the preview serves dist/). The server-side validation is
// smplwise_vms/backend/tests/test_timeline_colors.py.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/timeline-colors');
const PHONE = { width: 390, height: 844 };
const ALL_PERMS = ['video.live', 'video.playback', 'video.export', 'map.read', 'map.edit', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign'];
const DEFAULTS: Record<string, string> = { recording: 'accent', motion: 'red', person: 'orange', vehicle: 'green', door: 'purple', line: 'amber', offline: 'gray' };
const LABELS = ['הקלטה', 'תנועה', 'אדם', 'רכב', 'דלת', 'חציית קו', 'אובדן וידאו'];
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
}

async function shot(page: Page, name: string, locator?: ReturnType<Page['locator']>) {
  fs.mkdirSync(OUT, { recursive: true });
  if (locator) await locator.screenshot({ path: path.join(OUT, `${name}.png`) });
  else await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function mockBackend(page: Page, colors: Record<string, string> | null) {
  const state = { colors, patches: [] as Record<string, unknown>[] };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: ALL_PERMS, permissions_any: ALL_PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    if (p === 'settings' && req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      state.patches.push(body);
      if (body['timeline.colors']) state.colors = { ...DEFAULTS, ...(body['timeline.colors'] as Record<string, string>) };
    }
    if (p === 'settings') {
      const settings: Record<string, unknown> = { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'timeline.colors': state.colors ?? DEFAULTS };
      return json({ settings, can_edit: true });
    }
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-01T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
  return state;
}

/** What the timeline on the style-guide page really draws with: the legend dots and the event dots. */
async function timelineColours(page: Page) {
  return page.locator('styleguide-screen sw-timeline').first().evaluate((el) => {
    const root = el.shadowRoot!;
    const legend: Record<string, string> = {};
    for (const span of Array.from(root.querySelectorAll('.legend span'))) legend[(span.textContent ?? '').trim()] = getComputedStyle(span, '::before').backgroundColor;
    const dots = Array.from(root.querySelectorAll('svg circle')).map((c) => getComputedStyle(c).fill);
    const bar = root.querySelector('svg rect[rx="1.5"]');
    return { legend, dots, bar: bar ? getComputedStyle(bar).fill : null };
  });
}

test.describe('timeline colours (timeline.colors)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
  });

  test('the card lists seven options with their defaults - the person is no longer the recording blue', async ({ page }) => {
    await mockBackend(page, null);
    await open(page, '/system/diagnostics?tab=media');
    const card = page.locator('system-diagnostics system-timeline-colors [data-timeline-colors]');
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.locator('[data-timeline-option] .lbl')).toHaveText(LABELS);
    for (const [option, token] of Object.entries(DEFAULTS)) {
      await expect(card.locator(`[data-timeline-option="${option}"] [data-timeline-swatch="${token}"]`)).toHaveAttribute('aria-pressed', 'true');
    }
    const dot = (o: string) => card.locator(`[data-timeline-option="${o}"] [data-timeline-dot]`).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await dot('recording')).toBe(rgb('#2767ed'));
    expect(await dot('person')).toBe(rgb('#ea580c'));
    expect(await dot('person')).not.toBe(await dot('recording'));
    await expect(card.locator('[data-timeline-warning]')).toHaveCount(0);
    await expect(card.locator('[data-timeline-save] button')).toBeDisabled();
    await expect(card.locator('[data-timeline-reset] button')).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'settings-card-phone-390');
  });

  test('a changed colour is saved as the whole object and the timeline follows at once, no reload', async ({ page }) => {
    const mock = await mockBackend(page, null);
    await open(page, '/system/diagnostics?tab=media');
    const card = page.locator('system-diagnostics system-timeline-colors [data-timeline-colors]');
    await expect(card).toBeVisible({ timeout: 15000 });
    const person = card.locator('[data-timeline-option="person"]');
    await person.locator('[data-timeline-swatch="teal"]').click();
    await expect(person.locator('[data-timeline-swatch="teal"]')).toHaveAttribute('aria-pressed', 'true');
    // a custom colour from the native input
    const door = card.locator('[data-timeline-option="door"]');
    await door.locator('[data-timeline-custom]').fill('#aa11cc');
    await card.locator('[data-timeline-save]').click();
    await expect(card.locator('[data-timeline-message]')).toHaveText('הצבעים נשמרו');
    expect(mock.patches).toEqual([{ 'timeline.colors': { ...DEFAULTS, person: 'teal', door: '#aa11cc' } }]);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sw-tl-person').trim())).toBe('#14b8a6');
    // the timeline on the style guide (no reload: the hash changes) draws with the new colours
    await page.evaluate(() => (location.hash = '#/styleguide'));
    await expect(page.locator('styleguide-screen sw-timeline').first()).toBeVisible({ timeout: 15000 });
    const got = await timelineColours(page);
    expect(got.legend['אדם']).toBe(rgb('#14b8a6'));
    expect(got.legend['דלת']).toBe(rgb('#aa11cc'));
    expect(got.legend['הקלטה (גובה = פעילות)']).toBe(rgb('#2767ed'));
    expect(got.dots).toContain(rgb('#14b8a6')); // the person's dot on the track
    expect(got.dots).not.toContain(rgb('#ea580c'));
    await page.locator('styleguide-screen sw-timeline').first().scrollIntoViewIfNeeded();
    await shot(page, 'timeline-custom-colours-phone-390', page.locator('styleguide-screen sw-timeline').first());
  });

  test('a saved colour is what a fresh page load draws with; the recording bars follow their own colour', async ({ page }) => {
    await mockBackend(page, { ...DEFAULTS, recording: '#009688', person: 'pink' });
    await open(page, '/styleguide');
    await expect(page.locator('styleguide-screen sw-timeline').first()).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => (await timelineColours(page)).bar, { timeout: 10000 }).toBe(rgb('#009688'));
    const got = await timelineColours(page);
    expect(got.legend['אדם']).toBe(rgb('#ec4899'));
    expect(got.legend['הקלטה (גובה = פעילות)']).toBe(rgb('#009688'));
    expect(got.dots).toContain(rgb('#ec4899'));
  });

  test('two options with (nearly) the same colour get a soft note, nothing is blocked; reset puts the defaults back', async ({ page }) => {
    const mock = await mockBackend(page, null);
    await open(page, '/system/diagnostics?tab=media');
    const card = page.locator('system-diagnostics system-timeline-colors [data-timeline-colors]');
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.locator('[data-timeline-option="person"] [data-timeline-swatch="accent"]').click(); // the recording's own blue
    await expect(card.locator('[data-timeline-warning]')).toHaveCount(2); // both rows say so
    await expect(card.locator('[data-timeline-option="person"] [data-timeline-warning]')).toContainText('דומה להקלטה');
    await expect(card.locator('[data-timeline-option="recording"] [data-timeline-warning]')).toContainText('דומה לאדם');
    // nearly the same: a custom colour a few steps from the red
    await card.locator('[data-timeline-option="person"] [data-timeline-swatch="red"]').click();
    await card.locator('[data-timeline-option="motion"] [data-timeline-custom]').fill('#ee4040');
    await expect(card.locator('[data-timeline-option="motion"] [data-timeline-warning]')).toContainText('דומה לאדם');
    await shot(page, 'settings-card-similar-warning-phone-390', card);
    await expect(card.locator('[data-timeline-save] button')).toBeEnabled(); // a note, never a block
    await card.locator('[data-timeline-reset]').click();
    for (const [option, token] of Object.entries(DEFAULTS)) {
      await expect(card.locator(`[data-timeline-option="${option}"] [data-timeline-swatch="${token}"]`)).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(card.locator('[data-timeline-warning]')).toHaveCount(0);
    expect(mock.patches).toEqual([]); // nothing was sent
  });

  test('the recording player screen in the static demo shows the defaults: orange person, blue recording', async ({ page }) => {
    await open(page, '/investigate/playback');
    const tl = page.locator('investigate-playback sw-timeline').first();
    await expect(tl).toBeVisible({ timeout: 15000 });
    const legend = await tl.evaluate((el) => {
      const out: Record<string, string> = {};
      for (const span of Array.from(el.shadowRoot!.querySelectorAll('.legend span'))) out[(span.textContent ?? '').trim()] = getComputedStyle(span, '::before').backgroundColor;
      return out;
    });
    expect(legend['הקלטה (גובה = פעילות)']).toBe(rgb('#2767ed'));
    expect(legend['אדם']).toBe(rgb('#ea580c'));
    expect(legend['תנועה']).toBe(rgb('#ef4444'));
    await tl.scrollIntoViewIfNeeded();
    await shot(page, 'timeline-defaults-phone-390', tl);
  });
});
