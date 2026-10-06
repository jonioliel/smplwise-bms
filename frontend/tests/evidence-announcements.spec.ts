import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERMS, installCastMock } from './cast-mocks';

// MU2 (voice announcements): the Settings tab against a mocked wire contract (invented names, nothing is sent to a device): the switch, the engine,
// the allowed-speaker list with a test button per row, "announce now", the history, the Hebrew / English strings, and the rule editor's announce action.
//   SW_BASE_URL=http://127.0.0.1:5262/ npx playwright test tests/evidence-announcements.spec.ts --workers=1
// SW_SHOTS=1 writes evidence screenshots (the Settings tab off, then set up with a tested speaker and history) and the guide screenshot
// (announce-<project>.png) to docs/design/evidence/mu2.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/mu2');
async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

interface Mock {
  calls: { method: string; path: string; body: Record<string, unknown> | null }[];
}

async function setup(page: Page, perms: string[] = [...PERMS.admin, 'media.announce']): Promise<Mock> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installCastMock(page, { perms });
  const m: Mock = { calls: [] };
  const state = {
    config: { enabled: false, engine: '', language: 'he', devices: [] as string[], max_per_minute: 6, max_text: 200, cooldown_s: 5,
      volume: null as number | null, pause_music: false,
      quiet: { enabled: false, from: '22:00', to: '07:00', days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], mode: 'suppress', night_volume: null as number | null },
      notify: { enabled: false, scope: 'area', ref: '', categories: [] as string[], min_severity: 'alert' },
    },
    speakers: [
      { key: 'sp-1', name: 'רמקול סלון', kind: 'speaker', floor_name: 'קומת קרקע', area_id: 'living', area_name: 'סלון', allowed: false },
      { key: 'sp-2', name: 'רמקול מטבח', kind: 'speaker', floor_name: 'קומת קרקע', area_id: 'kitchen', area_name: 'מטבח', allowed: false },
    ],
    history: [] as Record<string, unknown>[],
  };
  const answer = () => ({ config: { ...state.config }, speakers: state.speakers.map((s) => ({ ...s, allowed: state.config.devices.includes(s.key) })), engines: ['tts.demo_engine'], history: state.history });
  await page.route(/\/api\/v1\/announcements(\/|\?|$)/, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\/announcements\/?/, '');
    const body = req.postData() ? (JSON.parse(req.postData() as string) as Record<string, unknown>) : null;
    m.calls.push({ method: req.method(), path: p, body });
    if (p === 'config' && req.method() === 'GET') return json(route, answer());
    if (p === 'config' && req.method() === 'PUT') {
      const { quiet, notify, ...flat } = (body ?? {}) as Record<string, Record<string, unknown>>;
      Object.assign(state.config, flat);
      Object.assign(state.config.quiet, quiet ?? {});
      Object.assign(state.config.notify, notify ?? {});
      return json(route, { changed: Object.keys(body ?? {}), ...answer() });
    }
    if (p === 'areas') return json(route, { enabled: state.config.enabled, max_text: 200, areas: state.config.enabled ? [{ area_id: 'living', name: 'סלון', floor_name: 'קומת קרקע', devices: [{ key: 'sp-1', name: 'רמקול סלון' }] }] : [] });
    if (p === 'test' || p === '') {
      state.history.unshift({ id: `h${state.history.length}`, at: '2026-10-06T09:00:00Z', source: p === 'test' ? 'test' : 'manual', username: 'joni', rule_id: null, scope: 'device', scope_ref: 'sp-1', targets: 1, message: p === 'test' ? 'x' : String(body?.text ?? ''), status: 'sent', error: null });
      return json(route, { id: 'h', status: 'sent', targets: 1 });
    }
    return json(route, {});
  });
  return m;
}

const tab = (page: Page) => page.locator('sw-app system-multimedia system-announcements');

test.describe('settings: voice announcements', () => {
  test('off by default; setup is saved at once; only ticked speakers can be tested', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const m = await setup(page);
    await page.goto('/?design=a#/system/multimedia?tab=announce');
    await expect(tab(page).locator('[data-announce]')).toBeVisible();
    const test1 = tab(page).locator('[data-announce-speaker="sp-1"] [data-announce-test]');
    await expect(test1).toHaveAttribute('disabled', '');
    await shot(page, 'announce-off');
    await tab(page).locator('[data-announce-engine]').fill('tts.demo_engine');
    await tab(page).locator('[data-announce-engine]').dispatchEvent('change');
    await tab(page).locator('[data-announce-enabled]').click();
    await tab(page).locator('[data-announce-speaker="sp-1"] [data-announce-allow]').check();
    await expect(test1).not.toHaveAttribute('disabled', '');
    await test1.click();
    await expect.poll(() => m.calls.some((c) => c.path === 'test' && c.body?.ref === 'sp-1' && c.body?.scope === 'device')).toBe(true);
    await expect(tab(page).locator('[data-announce-history] tr')).toHaveCount(1);
    await shot(page, 'announce-on');
    await shot(page, 'announce');
    expect(errors).toEqual([]);
  });

  test('announce now: a room and a text, sent once; the button needs a text', async ({ page }) => {
    const m = await setup(page);
    await page.goto('/?design=a#/system/multimedia?tab=announce');
    await tab(page).locator('[data-announce-engine]').fill('tts.demo_engine');
    await tab(page).locator('[data-announce-engine]').dispatchEvent('change');
    await tab(page).locator('[data-announce-enabled]').click();
    await tab(page).locator('[data-announce-speaker="sp-1"] [data-announce-allow]').check();
    const send = tab(page).locator('[data-announce-send]');
    await expect(send).toHaveAttribute('disabled', '');
    await tab(page).locator('[data-announce-text]').fill('ארוחת ערב מוכנה');
    await expect(send).not.toHaveAttribute('disabled', '');
    await send.click();
    await expect.poll(() => m.calls.filter((c) => c.method === 'POST' && c.path === '' && c.body?.text === 'ארוחת ערב מוכנה' && c.body?.scope === 'area' && c.body?.ref === 'living').length).toBe(1);
  });

  test('volume, pause-music, quiet hours and notification routing are saved at once and nothing is on by default', async ({ page }) => {
    const m = await setup(page);
    await page.goto('/?design=a#/system/multimedia?tab=announce');
    await expect(tab(page).locator('[data-announce]')).toBeVisible();
    await expect(tab(page).locator('[data-announce-pause] input, [data-announce-pause]').first()).toBeVisible();
    await expect(tab(page).locator('[data-announce-volume]')).toHaveValue('');
    await tab(page).locator('[data-announce-volume]').fill('40');
    await tab(page).locator('[data-announce-volume]').dispatchEvent('change');
    await expect.poll(() => m.calls.some((c) => c.method === 'PUT' && c.body?.volume === 40)).toBe(true);
    await tab(page).locator('[data-announce-pause]').click();
    await expect.poll(() => m.calls.some((c) => c.method === 'PUT' && c.body?.pause_music === true)).toBe(true);
    await tab(page).locator('[data-announce-quiet-enabled]').click();
    await expect.poll(() => m.calls.some((c) => c.method === 'PUT' && (c.body?.quiet as { enabled?: boolean } | undefined)?.enabled === true)).toBe(true);
    await tab(page).locator('[data-announce-quiet-mode]').selectOption('lower');
    await expect(tab(page).locator('[data-announce-night-volume]')).toBeVisible();
    await tab(page).locator('[data-announce-night-volume]').fill('20');
    await tab(page).locator('[data-announce-night-volume]').dispatchEvent('change');
    await expect.poll(() => m.calls.some((c) => (c.body?.quiet as { night_volume?: number } | undefined)?.night_volume === 20)).toBe(true);
    await tab(page).locator('[data-announce-routing-category="doors"]').check();
    await expect.poll(() => m.calls.some((c) => JSON.stringify((c.body?.notify as { categories?: string[] } | undefined)?.categories) === '["doors"]')).toBe(true);
    await tab(page).locator('[data-announce-routing-severity]').selectOption('critical');
    await expect.poll(() => m.calls.some((c) => (c.body?.notify as { min_severity?: string } | undefined)?.min_severity === 'critical')).toBe(true);
    await shot(page, 'announce-extras');
  });

  test('English strings when the document language is English; without system.configure there is no screen', async ({ page }) => {
    await setup(page);
    await page.goto('/?design=a#/system/multimedia?tab=announce');
    await expect(tab(page).locator('[data-announce]')).toContainText('מנוע דיבור');
    await page.evaluate(() => {
      document.documentElement.setAttribute('lang', 'en');
      (document.querySelector('sw-app')?.shadowRoot?.querySelector('system-multimedia')?.shadowRoot?.querySelector('system-announcements') as (HTMLElement & { requestUpdate(): void }) | null)?.requestUpdate();
    });
    await expect(tab(page).locator('[data-announce]')).toContainText('Speech engine');
    const p2 = await page.context().newPage();
    await setup(p2, PERMS.operator);
    await p2.goto('/?design=a#/system/multimedia?tab=announce');
    await expect(p2.locator('sw-app system-multimedia system-announcements [data-announce]')).toHaveCount(0);
  });
});
