import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERMS, installCastMock } from './cast-mocks';

// SW_SHOTS=1 writes the guide screenshot to docs/design/evidence/mu2 (invented names, no real host).
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/mu2');
async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

// MU2 (voice announcements): the Settings tab against a mocked wire contract (invented names, nothing is sent to a device): the switch, the engine,
// the allowed-speaker list with a test button per row, "announce now", the history, the Hebrew / English strings, and the rule editor's announce action.
//   SW_BASE_URL=http://127.0.0.1:5262/ npx playwright test tests/evidence-announcements.spec.ts --workers=1
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

interface Mock {
  calls: { method: string; path: string; body: Record<string, unknown> | null }[];
}

async function setup(page: Page, perms: string[] = [...PERMS.admin, 'media.announce']): Promise<Mock> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installCastMock(page, { perms });
  const m: Mock = { calls: [] };
  const state = {
    config: { enabled: false, engine: '', language: 'he', devices: [] as string[], max_per_minute: 6, max_text: 200, cooldown_s: 5 },
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
      Object.assign(state.config, body);
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
    await tab(page).locator('[data-announce-engine]').fill('tts.demo_engine');
    await tab(page).locator('[data-announce-engine]').dispatchEvent('change');
    await tab(page).locator('[data-announce-enabled]').click();
    await tab(page).locator('[data-announce-speaker="sp-1"] [data-announce-allow]').check();
    await expect(test1).not.toHaveAttribute('disabled', '');
    await test1.click();
    await expect.poll(() => m.calls.some((c) => c.path === 'test' && c.body?.ref === 'sp-1' && c.body?.scope === 'device')).toBe(true);
    await expect(tab(page).locator('[data-announce-history] tr')).toHaveCount(1);
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
