import { test, expect, type Page, type Route } from '@playwright/test';
import { PERMS, installCastMock } from './cast-mocks';
import { lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';

// ANNOUNCE-297 (voice announcements, stage C): the automatic translation in the announce form and in Settings, and the machine mark on a wall display.
// Mocked wire contract only: the translation answer is a fixture, nothing reaches a translation service, a speaker or a screen.
//   SW_BASE_URL=http://127.0.0.1:5262/ npx playwright test tests/evidence-announce-297.spec.ts --project=desktop --workers=1
// 1. the form offers "translate" only while the server says so; a translation is a draft that fills the languages, is marked, can be edited, and
//    cannot be sent before "I reviewed the translation" is ticked; the send carries `machine: true`; the screen still fits 1366x768 without scrolling.
// 2. Settings: the translation card is off by default; the switch is disabled until the approval is recorded.

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'the viewport is set by the spec itself; one project is enough'));

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
interface Call { method: string; path: string; body: Record<string, unknown> | null }

async function setup(page: Page, o: { translate: boolean; approved?: boolean }) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installCastMock(page, { perms: [...PERMS.admin, 'media.announce'] });
  const calls: Call[] = [];
  const tr = { enabled: false, provider: o.approved ? 'cloud' : 'off', source: 'he', targets: ['ar', 'en', 'ru'], approval: o.approved ? { provider: 'cloud', by: 'owner', at: '2026-10-27T08:00:00Z' } : null, key_set: false };
  const cfg = {
    enabled: true, engine: 'tts.demo_engine', engine_kind: 'local', cloud_enabled: false, cloud_key_set: false, emergency_languages: ['he', 'en', 'ru'], language: 'he', devices: ['sp-1'], max_per_minute: 6, max_text: 200, cooldown_s: 5, volume: null, pause_music: false,
    quiet: { enabled: false, from: '22:00', to: '07:00', days: ['sun'], mode: 'suppress', night_volume: null },
    notify: { enabled: false, scope: 'area', ref: '', categories: [], min_severity: 'alert' },
    screens: { enabled: false, default_on: true, seconds: 30, critical_seconds: 180, poll_s: 5, critical_close_s: 15, targets: [] },
    translate: tr,
  };
  const answer = () => ({ config: JSON.parse(JSON.stringify(cfg)), speakers: [], engines: ['tts.demo_engine'], history: [], templates: [], screen_options: { screens: [], devices: [] } });
  await page.route(/\/api\/v1\/announcements(\/|\?|$)/, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\/announcements\/?/, '');
    const body = req.postData() ? (JSON.parse(req.postData() as string) as Record<string, unknown>) : null;
    calls.push({ method: req.method(), path: p, body });
    if (p === 'config' && req.method() === 'GET') return json(route, answer());
    if (p === 'config' && req.method() === 'PUT') return json(route, { changed: [], ...answer() });
    if (p === 'areas') return json(route, { enabled: true, max_text: 200, areas: [{ area_id: 'living', name: 'סלון', floor_name: null, devices: [{ key: 'sp-1', name: 'רמקול' }] }], templates: [], languages: ['he', 'en', 'ru', 'ar'],
      default_language: 'he', emergency_languages: ['he'], quiet_mode: 'suppress', screens_enabled: false, translate_enabled: o.translate, translate_targets: ['ar', 'en', 'ru'] });
    if (p === 'translate') {
      const text = String(body?.text ?? '');
      return json(route, { provider: 'cloud', source: 'he', items: [{ language: 'ar', text: `AR ${text}`, machine: true, cached: false }, { language: 'en', text: `EN ${text}`, machine: true, cached: false }, { language: 'ru', text: `RU ${text}`, machine: true, cached: false }] });
    }
    if (p === '') return json(route, { id: 'x', status: 'sent', targets: 1 });
    return json(route, {});
  });
  return calls;
}

test('the announce form: translate is a reviewed, marked draft; it never sends unseen; the screen does not scroll', async ({ page }) => {
  const off = await setup(page, { translate: false });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/?design=a#/devices/announce');
  await expect(page.locator('devices-announce [data-announce-form]')).toBeVisible();
  await expect(page.locator('devices-announce [data-announce-translate]')).toHaveCount(0);
  expect(off.some((c) => c.path === 'translate')).toBe(false);

  const p2 = await page.context().newPage();
  const calls = await setup(p2, { translate: true });
  await p2.setViewportSize({ width: 1366, height: 768 });
  await p2.goto('/?design=a#/devices/announce');
  const form = p2.locator('devices-announce');
  const btn = form.locator('[data-announce-translate]');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAttribute('disabled', '');
  await form.locator('[data-announce-text="he"]').fill('המים יופסקו');
  await btn.click();
  await expect.poll(() => calls.some((c) => c.path === 'translate' && c.body?.text === 'המים יופסקו')).toBe(true);
  await expect(form.locator('[data-announce-text="en"]')).toHaveValue('EN המים יופסקו');
  await expect(form.locator('[data-announce-text="ar"]')).toHaveAttribute('dir', 'rtl');
  await expect(form.locator('[data-announce-machine]')).toHaveCount(3);
  expect(calls.some((c) => c.method === 'POST' && c.path === '')).toBe(false); // a translation sends nothing
  const send = form.locator('[data-announce-send]');
  await expect(send).toHaveAttribute('disabled', ''); // not reviewed yet
  await form.locator('[data-announce-text="en"]').fill('Water will be cut (edited)');
  await expect(form.locator('[data-announce-machine="en"]')).toBeVisible(); // edited, still marked
  await form.locator('[data-announce-reviewed]').check();
  await expect(send).not.toHaveAttribute('disabled', '');
  const fit = await p2.evaluate(() => ({ h: document.documentElement.scrollHeight, w: innerHeight }));
  expect(fit.h).toBeLessThanOrEqual(fit.w + 1);
  await send.click();
  await expect.poll(() => calls.find((c) => c.method === 'POST' && c.path === '')?.body?.texts).toEqual([
    { language: 'he', text: 'המים יופסקו' }, { language: 'en', text: 'Water will be cut (edited)', machine: true },
    { language: 'ru', text: 'RU המים יופסקו', machine: true }, { language: 'ar', text: 'AR המים יופסקו', machine: true },
  ]);
});

test('the TV page: four full-length languages, three machine-translated, each marked and all inside the screen (landscape and portrait)', async ({ page }) => {
  const t = (s: string) => s.repeat(20).slice(0, 200);
  const announcement = { id: 'w1', critical: true, until: '2026-10-23T06:20:00Z', texts: [{ language: 'he', text: t('המים יופסקו בבניין ') }, { language: 'ar', text: t('سيتم قطع المياه في المبنى '), machine: true },
    { language: 'ru', text: t('Водоснабжение будет отключено '), machine: true }, { language: 'en', text: t('Water will be cut in the building '), machine: true }] };
  for (const [w, h] of [[1366, 768], [1080, 1920]]) {
    await page.setViewportSize({ width: w, height: h });
    const feed = lobbyFeed({}, undefined, { announcement: announcement as never });
    await serveFeed(page, feed);
    await page.goto(new URL(tvUrl(), (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/').toString());
    await page.waitForSelector('#cv[data-ann="crit"]');
    await expect(page.locator('#cv .ann .ann-mt')).toHaveCount(3);
    await expect(page.locator('#cv .ann [data-machine="1"][lang="ru"] .ann-mt')).toHaveText('Машинный перевод');
    const r = await page.evaluate(() => { const el = document.querySelector('#cv .ann') as HTMLElement; return { sh: el.scrollHeight, ch: el.clientHeight }; });
    expect(r.sh, `no overflow at ${w}x${h}`).toBeLessThanOrEqual(r.ch + 1);
  }
});

test('Settings: the translation card is off by default and cannot be switched on before the approval is recorded', async ({ page }) => {
  const calls = await setup(page, { translate: false });
  await page.goto('/?design=a#/system/multimedia?tab=announce');
  const card = page.locator('sw-app system-multimedia system-announcements [data-announce-translate-card]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-announce-translate-provider]')).toHaveValue('off');
  await expect(card.locator('[data-announce-translate-approve]')).toHaveAttribute('disabled', '');
  await expect(card.locator('[data-announce-translate-enabled]')).toHaveAttribute('disabled', '');
  await card.locator('[data-announce-translate-provider]').selectOption('cloud');
  await expect.poll(() => calls.some((c) => c.method === 'PUT' && (c.body?.translate as { provider?: string } | undefined)?.provider === 'cloud')).toBe(true);
  await expect(card).not.toContainText(/home assistant|ingress/i);

  const p2 = await page.context().newPage();
  await setup(p2, { translate: false, approved: true });
  await p2.goto('/?design=a#/system/multimedia?tab=announce');
  const c2 = p2.locator('sw-app system-multimedia system-announcements [data-announce-translate-card]');
  await expect(c2.locator('[data-announce-translate-approved]')).toContainText('owner');
  await expect(c2.locator('[data-announce-translate-enabled]')).not.toHaveAttribute('disabled', '');
  await expect(c2.locator('[data-announce-translate-key]')).toBeVisible();
});
