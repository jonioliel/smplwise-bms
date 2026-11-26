import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// CLIENT-RESILIENCE-2540 (review SCR-23, FC-12): refusals of the server's step-up gate that arrive together share one dialog only when
// they are for the SAME action; a refusal for another action waits for the open dialog and then gets its own, worded for it. The shell's
// step-up handler (shell/step-up.ts), the dialog and the API client are bundled as they are (esbuild) and run on a mocked page (no backend).
//   npx playwright test -c playwright.unit.config.ts tests/unit-step-up-queue-2540.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'http://arx.test';

test.use({ serviceWorkers: 'block' });

let bundled = '';
async function bundle(): Promise<string> {
  if (bundled) return bundled;
  const out = await build({
    stdin: {
      contents: [
        "import '../design/boot';",
        "import { installStepUp } from './step-up';",
        "import * as C from '../api/client';",
        'installStepUp();',
        'Object.assign(window as unknown as Record<string, unknown>, { ArxClient: C });',
      ].join('\n'),
      resolveDir: path.join(HERE, '../src/shell'), loader: 'ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', tsconfig: path.join(HERE, '../tsconfig.json'),
    define: { 'import.meta.env.BASE_URL': '"/app/"', 'import.meta.env.DEV': 'false', __ARX_BUILD__: '"test"' },
  });
  bundled = out.outputFiles[0].text;
  return bundled;
}

const gate = (action: string) => ({ code: 'step_up_required', user_message: 'נדרש אישור', retryable: false, correlation_id: 'c', details: { action, methods: ['totp'], minutes: 5, verify_path: 'auth/step-up/verify' } });

async function setup(page: Page, actions: Record<string, string>): Promise<string[]> {
  const sent: string[] = [];
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/app/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="he" dir="rtl"><head><title>t</title></head><body></body></html>' });
    const p = url.pathname.replace('/app/api/v1/', '');
    sent.push(p);
    const action = actions[p];
    if (action) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify(gate(action)) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"not_found"}' });
  });
  await page.goto(`${ORIGIN}/app/`);
  await page.addScriptTag({ content: await bundle(), type: 'module' });
  await page.waitForFunction(() => 'ArxClient' in window);
  return sent;
}

type W = { ArxClient: { patch(p: string, b: unknown): Promise<unknown>; post(p: string, b?: unknown): Promise<unknown> } };
const dialogs = (page: Page) => page.locator('sw-step-up-dialog');

test('two refusals for different actions: one dialog at a time, each named for its own action', async ({ page }) => {
  await setup(page, { settings: 'system.configure', 'access-control/doors/d1/open': 'door.open' });
  const done = page.evaluate(async () => {
    const C = (window as unknown as W).ArxClient;
    const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: { body?: { code?: string } }) => e?.body?.code ?? 'error');
    return Promise.all([code(C.patch('settings', { a: 1 })), code(C.post('access-control/doors/d1/open', {}))]);
  });
  const NAMES = ['הפעולה: פתיחת דלת', 'הפעולה: שינוי הגדרות'];
  const shown = async (): Promise<string> => {
    const els = await dialogs(page).all();
    return els.length === 1 ? ((await els[0].locator('[data-step-up-action]').textContent()) ?? '').trim() : `count:${els.length}`;
  };
  await expect.poll(shown).toMatch(/^הפעולה: /);
  const first = await shown();
  expect(NAMES).toContain(first);
  const second = NAMES.find((n) => n !== first)!;
  await dialogs(page).locator('[data-step-up-cancel]').click();
  await expect.poll(shown).toBe(second); // the second refusal's own dialog, not the first one's answer
  await dialogs(page).locator('[data-step-up-cancel]').click();
  await expect(dialogs(page)).toHaveCount(0);
  expect(await done).toEqual(['step_up_required', 'step_up_required']);
});

test('two refusals for the same action share one dialog and its answer', async ({ page }) => {
  const sent = await setup(page, { settings: 'system.configure', 'settings/other': 'system.configure' });
  const done = page.evaluate(async () => {
    const C = (window as unknown as W).ArxClient;
    const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: { body?: { code?: string } }) => e?.body?.code ?? 'error');
    return Promise.all([code(C.patch('settings', { a: 1 })), code(C.patch('settings/other', { b: 2 }))]);
  });
  await expect(dialogs(page)).toHaveCount(1);
  await expect.poll(() => sent.length).toBe(2);
  await dialogs(page).locator('[data-step-up-cancel]').click();
  expect(await done).toEqual(['step_up_required', 'step_up_required']);
  await expect(dialogs(page)).toHaveCount(0);
});
