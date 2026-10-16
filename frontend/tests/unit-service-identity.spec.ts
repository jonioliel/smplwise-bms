import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// USR2 phase 3: the service-identity card (Settings › משתמשים והרשאות › משתמשי Arx), bundled as it is and run on a mocked same-origin page
// (no backend, no Home Assistant). Negative first: hidden for a caller without system.configure, one line on the remote channel, a refused
// administrator id shows the server's text; then the steps the owner must still take, saving an id, the ready state.
//   npx playwright test tests/unit-service-identity.spec.ts --project=desktop

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'http://arx.test';
const EVIDENCE = path.join(HERE, '../../docs/evidence/USR2');
const SID = '0123456789abcdef0123456789abcdef';

test.use({ serviceWorkers: 'block' });

let bundled = '';

async function bundle(): Promise<string> {
  if (bundled) return bundled;
  const out = await build({
    stdin: { contents: "import '../design/boot';\nimport '../screens/system-service-identity';\n", resolveDir: path.join(HERE, '../src/arx'), loader: 'ts' },
    bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', tsconfig: path.join(HERE, '../tsconfig.json'),
    define: { 'import.meta.env.BASE_URL': '"/arx/"' },
  });
  bundled = out.outputFiles[0].text;
  return bundled;
}

type Answer = { status: number; body: unknown };
type Call = { path: string; method: string; body: string };

const LISTS = {
  allowed: [
    { key: 'devices.control', he: 'שליטה בהתקנים', en: 'Device control' },
    { key: 'alarm', he: 'אזעקה (דריכה / נטרול לפי כללי הקוד)', en: 'Alarm (arm / disarm under the PIN rules)' },
    { key: 'media', he: 'מדיה ומוזיקה', en: 'Media and music' },
    { key: 'cast', he: 'שידור למסך', en: 'Cast to a screen' },
    { key: 'schedules', he: 'תזמונים', en: 'Schedules' },
  ],
  refused: [
    { he: 'אוטומציות, סצנות וסקריפטים (כתיבה והפעלה)', en: 'Automations, scenes and scripts (writing and running)' },
    { he: 'פתיחת דלתות ומנעולים', en: 'Opening doors and locks' },
  ],
};
const BRIDGE = { paired: true, version: '0.9.0', required: '0.9.0', version_ok: true, capable: true, reported_user_id: null, agrees: false };
const NOT_READY = {
  configured_user_id: null, user: null, bridge: BRIDGE, feature_on: true, ready: false, ...LISTS,
  steps: [{ code: 'not_configured', he: 'צרו בתשתית המערכת משתמש רגיל אחד (לא מנהל) והזינו את המזהה שלו כאן.', en: 'Create ONE regular user and enter its id here.' }],
};
const READY = {
  ...NOT_READY, configured_user_id: SID, user: { id: SID, name: 'SmplWise Arx Service', is_active: true, is_admin: false },
  bridge: { ...BRIDGE, reported_user_id: SID, agrees: true }, ready: true, steps: [],
};

async function setup(page: import('@playwright/test').Page, answers: Record<string, Answer | Answer[]>) {
  const calls: Call[] = [];
  await page.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    calls.push({ path: url.pathname, method: req.method(), body: req.postData() ?? '' });
    if (url.pathname === '/arx/' || url.pathname === '/arx/index.html') {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="he" dir="rtl"><head><title>t</title></head><body></body></html>' });
    }
    const key = `${req.method()} ${url.pathname}`;
    const a = answers[key];
    const one = Array.isArray(a) ? a.shift() : a;
    if (one) return route.fulfill({ status: one.status, contentType: 'application/json', body: JSON.stringify(one.body) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"not_found"}' });
  });
  await page.goto(`${ORIGIN}/arx/`);
  await page.addScriptTag({ content: await bundle() });
  return calls;
}

async function mount(page: import('@playwright/test').Page, remote = false) {
  await page.evaluate((r) => {
    const el = document.createElement('system-service-identity');
    if (r) el.setAttribute('remote', '');
    el.style.cssText = 'display:block;padding:16px;max-width:1100px;margin:auto';
    document.body.appendChild(el);
  }, remote);
}

const API = '/arx/api/v1/identity/service-identity';

test('hidden for a caller without system.configure', async ({ page }) => {
  await setup(page, { [`GET ${API}`]: { status: 403, body: { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, details: {} } } });
  await mount(page);
  await page.waitForTimeout(200);
  await expect(page.locator('system-service-identity [data-service-identity]')).toHaveCount(0);
});

test('the remote channel shows one line and asks nothing of the server', async ({ page }) => {
  const calls = await setup(page, {});
  await mount(page, true);
  await expect(page.locator('system-service-identity [data-si-remote]')).toBeVisible();
  expect(calls.filter((c) => c.path === API)).toHaveLength(0);
});

test('an administrator id is refused with the server text; a regular id makes it ready', async ({ page }) => {
  const calls = await setup(page, {
    [`GET ${API}`]: { status: 200, body: NOT_READY },
    [`PUT ${API}`]: [
      { status: 403, body: { code: 'service_identity_admin', user_message: 'המשתמש הזה הוא מנהל בתשתית המערכת. זהות השירות לעולם לא מנהל - בחרו או צרו משתמש רגיל.', retryable: false, details: {} } },
      { status: 200, body: READY },
    ],
  });
  await mount(page);
  await expect(page.locator('system-service-identity [data-si-state="not-ready"]')).toBeVisible();
  await expect(page.locator('system-service-identity [data-si-step="not_configured"]')).toBeVisible();
  await expect(page.locator('system-service-identity [data-si-allowed] li')).toHaveCount(5);
  await expect(page.locator('system-service-identity [data-si-refused] li')).toHaveCount(2);
  await page.locator('system-service-identity [data-si-input]').fill('c'.repeat(32));
  await page.locator('system-service-identity [data-si-save]').click();
  await expect(page.locator('system-service-identity [data-si-error]')).toContainText('לעולם לא מנהל');
  await expect(page.locator('system-service-identity [data-si-state="not-ready"]')).toBeVisible();
  await page.locator('system-service-identity [data-si-input]').fill(SID);
  await page.locator('system-service-identity [data-si-save]').click();
  await expect(page.locator('system-service-identity [data-si-state="ready"]')).toBeVisible();
  await expect(page.locator('system-service-identity [data-si-user]')).toContainText(SID);
  await expect(page.locator('system-service-identity [data-si-steps]')).toHaveCount(0);
  const puts = calls.filter((c) => c.method === 'PUT' && c.path === API);
  expect(puts.map((c) => JSON.parse(c.body))).toEqual([{ user_id: 'c'.repeat(32) }, { user_id: SID }]);
});

for (const view of [{ name: 'desktop', w: 1440, h: 900 }, { name: 'mobile', w: 390, h: 844 }]) {
  test(`screens for review (${view.name})`, async ({ page }) => {
    await page.setViewportSize({ width: view.w, height: view.h });
    await setup(page, { [`GET ${API}`]: [{ status: 200, body: NOT_READY }] });
    await mount(page);
    await expect(page.locator('system-service-identity [data-si-step="not_configured"]')).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE, `service-identity-not-ready-${view.name}.png`), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
}
