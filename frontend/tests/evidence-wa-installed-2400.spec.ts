import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOW, url } from './access-control-mocks';
import { installMessagingSettings } from './wiskey-messaging-settings';
import { installWaInstalled, newWaInstalled, type WaInstalledMock } from './wa-installed-mock';
import { settlePage } from './pixel-settle';

// WISKEY-WA-QUEUE-2400 (T12): the installed-client messaging card below the message settings (Settings > access control > messages,
// #/system/access-control/messaging) - what blocks a template send, which WisKey commands the direct join selects now, the template list
// by source with "refresh from WisKey", the newest queue jobs with their honest word, and the paced free-text opt-in - against the mocked
// backend (tests/wa-installed-mock.ts). Desktop and phone, RTL, light and dark. No real WisKey, no message, no number.
// Evidence screenshots (SW_SHOTS=1) go to docs/design/evidence/WISKEY-WA-QUEUE-2400/.
//   npx playwright test tests/evidence-wa-installed-2400.spec.ts --project=desktop --project=mobile --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'WISKEY-WA-QUEUE-2400');
const CARD = 'sw-app system-access-control system-access-messaging wa-installed-card';
const HASH = '/system/access-control/messaging';

test.beforeEach(({}, info) => {
  test.skip(info.project.name === 'tablet', 'desktop and phone (the tablet is covered by the layout guard)');
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
});

async function boot(page: Page, st: WaInstalledMock, scheme: 'light' | 'dark' = 'light') {
  await installMessagingSettings(page, { persona: 'admin' });
  await installWaInstalled(page, st);
  await page.clock.setFixedTime(NOW);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon|\/api\//.test(m.text())) errors.push(m.text());
  });
  await page.goto('about:blank');
  await page.goto(url(HASH, 'classic', scheme));
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${CARD} [data-wa-installed]`)).toHaveAttribute('data-state', st.readFails ? 'error' : 'ready', { timeout: 30_000 });
  await page.locator(CARD).scrollIntoViewIfNeeded();
  return errors;
}

async function shot(page: Page, info: TestInfo, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.locator(CARD).screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}

/** No horizontal page scroll and nothing inside the card wider than the card. */
async function fits(page: Page) {
  const r = await page.locator(CARD).evaluate((card) => {
    const box = card.getBoundingClientRect();
    const wide: string[] = [];
    card.shadowRoot?.querySelectorAll('*').forEach((n) => {
      const b = (n as HTMLElement).getBoundingClientRect();
      if (b.width > 0 && (b.right > box.right + 1 || b.left < box.left - 1)) wide.push(`${n.tagName.toLowerCase()}.${(n as HTMLElement).className}`);
    });
    return { scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, wide, dir: getComputedStyle(card).direction };
  });
  expect(r.scroll, 'horizontal page scroll').toBeLessThanOrEqual(1);
  expect(r.wide, 'elements wider than the card').toEqual([]);
  expect(r.dir).toBe('rtl');
}

test('the card says why a template send is blocked, what WisKey offers now, and never claims delivery', async ({ page }, info) => {
  const st = newWaInstalled();
  const errors = await boot(page, st);
  const card = page.locator(CARD);
  await expect(card.locator('[data-wa-blocker="permit_closed"]')).toBeVisible();
  await expect(card.locator('[data-wa-ready]')).toHaveCount(0);
  await expect(card.locator('[data-wa-command]')).toHaveCount(6);
  await expect(card.locator('[data-wa-command="whatsapp/template_enqueue_v1"]')).toHaveAttribute('data-on', 'true');
  await expect(card.locator('[data-wa-command="whatsapp/send_pacing_v1"]')).toHaveAttribute('data-on', 'false');
  await expect(card.locator('[data-wa-template]')).toHaveCount(2);
  await expect(card.locator('[data-wa-template][data-source="wiskey"]')).toHaveCount(1);
  await expect(card.locator('[data-wa-native-locked]')).toBeVisible();
  await expect(card.locator('[data-wa-job][data-word="sent"]')).toHaveCount(1);
  await expect(card.locator('[data-wa-job][data-word="cancelled"]')).toHaveCount(1);
  await expect(card.locator('[data-wa-no-delivery]')).toBeVisible();
  await expect(card.locator('[data-wa-history]')).toBeVisible();
  const text = (await card.innerText()).toLowerCase();
  expect(text).not.toMatch(/home assistant|wiskey|hikvision|\bha\b/);  // the page's copy rule: the provider is "שירות ההודעות"
  expect(text).not.toMatch(/נמסרה|delivered/);
  await fits(page);
  await shot(page, info, 'ready-light');
  expect(errors).toEqual([]);
});

test('the dark scheme and a long job list still fit', async ({ page }, info) => {
  const st = newWaInstalled((v) => {
    v.jobs = Array.from({ length: 8 }, (_, i) => ({ ...v.jobs[i % 2], operation_id: `tplq-long${String(i).padStart(8, '0')}`, template_id: 'a_very_long_template_identifier_without_any_breaks_' + i }));
    v.registry.templates.push({ id: 'x', name: 'unbreakable_template_name_that_goes_on_and_on_and_on_forever', language: 'he', purpose: 'notice', source: 'arx', account: null, template_revision: null, bound: false });
  });
  const errors = await boot(page, st, 'dark');
  await expect(page.locator(`${CARD} [data-wa-job]`)).toHaveCount(5);  // the newest five
  await fits(page);
  await shot(page, info, 'long-dark');
  expect(errors).toEqual([]);
});

test('refresh from WisKey: a sync says so, a refusal keeps the list and says why', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'behaviour runs on one project');
  const st = newWaInstalled((v) => (v.registry.last_sync = null));
  await boot(page, st);
  const card = page.locator(CARD);
  await expect(card.locator('[data-wa-last-sync="never"]')).toBeVisible();
  await card.locator('[data-wa-sync]').click();
  await expect(card.locator('[data-wa-notice]')).toBeVisible();
  await expect(card.locator('[data-wa-last-sync="synced"]')).toBeVisible();
  st.sync = 'refused';
  await card.locator('[data-wa-sync]').click();
  await expect(card.locator('[data-wa-error]')).toBeVisible();
  await expect(card.locator('[data-wa-last-sync="refused"]')).toBeVisible();
  await expect(card.locator('[data-wa-template]')).toHaveCount(2);
  expect((await card.innerText()).toLowerCase()).not.toContain('wiskey');  // the server's error words follow the copy rule too
  expect(st.syncs).toBe(2);
  await shot(page, info, 'sync-refused');
});

test('the paced send: off and locked while WisKey does not list it; on only by the administrator', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'behaviour runs on one project');
  const st = newWaInstalled();
  await boot(page, st);
  const toggle = page.locator(`${CARD} [data-wa-paced-toggle]`);
  await expect(toggle).toHaveAttribute('disabled', '');
  expect(st.puts).toEqual([]);
  st.view.commands['whatsapp/send_pacing_v1'] = true;
  await page.reload();
  await expect(page.locator(`${CARD} [data-wa-installed]`)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(toggle).not.toHaveAttribute('disabled', '');
  await toggle.click();
  await expect.poll(() => st.puts).toEqual([{ send_pacing_v1: true }]);
  await expect(page.locator(`${CARD} [data-wa-notice]`)).toBeVisible();
  await expect(toggle).toHaveAttribute('checked', '');
  await shot(page, info, 'paced-on');
});

test('a failed read shows the error state with a retry', async ({ page }, info) => {
  const st = newWaInstalled();
  st.readFails = true;
  await boot(page, st);
  const card = page.locator(CARD);
  await expect(card.locator('[data-wa-error]')).toBeVisible();
  await fits(page);
  await shot(page, info, 'error');
  st.readFails = false;
  await card.locator('[data-wa-retry]').click();
  await expect(card.locator('[data-wa-installed]')).toHaveAttribute('data-state', 'ready');
});
