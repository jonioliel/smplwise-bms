import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOW, SKINS, url, type MockOptions } from './access-control-mocks';
import { installMessagingSettings, type MessagingSettingsMock } from './wiskey-messaging-settings';
import { settlePage } from './pixel-settle';

// CR-036 WA: the Settings page "הודעות" (Settings > access control > messages, #/system/access-control/messaging) - the administrator's
// switch for sending WhatsApp messages from the people screen (OFF until turned on), free text, the bulk and hourly limits, the organization's
// name and the approved TEMPLATES - against the mocked backend (tests/wiskey-messaging-settings.ts: the wire shapes of the two routes, checked
// against the real ones by backend/tests/test_intercom_messaging.py). The app runs for real - shell, navigation, permissions - only the server and the
// sockets are mocked. Behaviour on the desktop project; the page in its states at desktop / tablet / phone; the skins x light / dark.
// Evidence screenshots go to docs/design/evidence/CR-036-WA/.
//   npx playwright test tests/evidence-wiskey-messaging-settings.spec.ts --project=desktop --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'CR-036-WA');
const PAGE = 'sw-app system-access-control';
const MSG = `${PAGE} system-access-messaging`;
const HASH = '/system/access-control/messaging';

async function boot(page: Page, init: Partial<MessagingSettingsMock> = {}, o: { skin?: string; scheme?: 'light' | 'dark'; persona?: MockOptions['persona']; ready?: boolean } = {}) {
  const { access, ms } = await installMessagingSettings(page, { persona: o.persona ?? 'admin' }, init);
  await page.clock.setFixedTime(NOW);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon|\/api\//.test(m.text())) errors.push(m.text());
  });
  await page.goto('about:blank');
  await page.goto(url(HASH, o.skin ?? 'classic', o.scheme ?? 'light'));
  await page.waitForSelector('sw-app');
  if (o.ready !== false) await expect(page.locator(`${MSG} [data-access-status="ready"]`)).toBeVisible({ timeout: 30_000 });
  return { access, ms, errors };
}

async function shot(page: Page, info: TestInfo, name: string, full = false) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`), fullPage: full });
}

const rows = (page: Page) => page.locator(`${MSG} [data-msg-template-row]`);
const save = (page: Page) => page.locator(`${MSG} [data-msg-save]`);
const switchOf = (page: Page, key: string) => page.locator(`${MSG} [data-msg-setting="${key}"]`);
const input = (page: Page, key: string) => page.locator(`${MSG} [data-msg-setting="${key}"]`);
const disabled = (l: Locator) => expect(l).toHaveAttribute('disabled', '');
const enabled = (l: Locator) => expect(l).not.toHaveAttribute('disabled', '');

test.describe('the message settings: behaviour', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project; the states run on all three below');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('a system administrator has the segment; the page starts OFF with the starter templates and says whether the service is connected', async ({ page }, info) => {
    const { ms, errors } = await boot(page);
    await expect(page.locator(`${PAGE} sw-tabs[data-access-segments] a[href$="/messaging"]`)).toHaveCount(1);
    await expect(switchOf(page, 'enabled')).toHaveAttribute('aria-checked', 'false');
    await expect(switchOf(page, 'free_text')).toHaveAttribute('aria-checked', 'true');
    await expect(input(page, 'bulk_max')).toHaveValue('50');
    await expect(input(page, 'rate_per_hour')).toHaveValue('60');
    await expect(rows(page)).toHaveCount(3);
    await expect(page.locator(`${MSG} [data-msg-service="connected"]`)).toContainText('שירות ההודעות מחובר');
    await expect(page.locator(`${MSG} [data-msg-service="connected"]`)).toContainText('Office line');
    await disabled(save(page)); // nothing changed
    await disabled(page.locator(`${MSG} [data-msg-revert]`));
    expect(ms.gets).toBe(1);
    await shot(page, info, 'settings-default');
    expect(errors).toEqual([]);
  });

  test('a site manager (no system.configure) has no segment and a typed address does not give it', async ({ page }) => {
    await boot(page, {}, { persona: 'siteAdmin', ready: false });
    await expect(page.locator(`${PAGE} [data-access-segment]`).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`${PAGE} sw-tabs[data-access-segments] a[href$="/messaging"]`)).toHaveCount(0);
    await expect(page.locator(`${MSG}`)).toHaveCount(0);
  });

  test('switch it on and save: one PUT with the revision the page read, the saved note, the new revision; a stale tab cannot overwrite', async ({ page }, info) => {
    const { ms } = await boot(page);
    await switchOf(page, 'enabled').click();
    await expect(switchOf(page, 'enabled')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator(`${MSG} [data-msg-notice="unsaved"]`)).toBeVisible();
    await enabled(save(page));
    await save(page).click();
    await expect(page.locator(`${MSG} [data-msg-notice="saved"]`)).toBeVisible();
    expect(ms.puts).toHaveLength(1);
    expect(ms.puts[0]).toMatchObject({ base_revision: 0, enabled: true, free_text: true, bulk_max: 50, rate_per_hour: 60 });
    expect(ms.doc.revision).toBe(1);
    await disabled(save(page)); // saved: nothing left to save
    await shot(page, info, 'settings-saved');
    // the next save carries revision 1
    await switchOf(page, 'free_text').click();
    await save(page).click();
    await expect(page.locator(`${MSG} [data-msg-notice="saved"]`)).toBeVisible();
    expect(ms.puts[1]).toMatchObject({ base_revision: 1, free_text: false });
  });

  test('the limits and the organization are validated at once; a refused value is said under its field and nothing is sent', async ({ page }, info) => {
    const { ms } = await boot(page);
    await input(page, 'bulk_max').fill('0');
    await expect(page.locator(`${MSG} [data-msg-problem-path="bulk_max"]`)).toHaveAttribute('data-msg-problem', 'range');
    await input(page, 'rate_per_hour').fill('abc');
    await expect(page.locator(`${MSG} [data-msg-problem-path="rate_per_hour"]`)).toHaveAttribute('data-msg-problem', 'type');
    await input(page, 'organization').fill('{name}');
    await expect(page.locator(`${MSG} [data-msg-problem-path="organization"]`)).toHaveAttribute('data-msg-problem', 'bad_braces');
    await save(page).click();
    await expect(page.locator(`${MSG} [data-msg-notice="invalid"]`)).toBeVisible();
    expect(ms.puts).toEqual([]);
    await shot(page, info, 'settings-invalid-limits');
    await input(page, 'bulk_max').fill('25');
    await input(page, 'rate_per_hour').fill('30');
    await input(page, 'organization').fill('מגדל הדגמה');
    await save(page).click();
    await expect(page.locator(`${MSG} [data-msg-notice="saved"]`)).toBeVisible();
    expect(ms.puts[0]).toMatchObject({ bulk_max: 25, rate_per_hour: 30, organization: 'מגדל הדגמה' });
  });

  test('a template: edit, add, delete; the placeholders go in at the caret; the count; a new one gets its id from the server', async ({ page }, info) => {
    const { ms } = await boot(page);
    const first = rows(page).first();
    await first.locator('[data-msg-template-label]').fill('כרטיס מוכן לאיסוף');
    const body = first.locator('[data-msg-template-body]');
    await body.fill('שלום , הכרטיס מוכן.');
    await body.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 5));
    await first.locator('[data-msg-insert="name"]').click();
    await expect(body).toHaveValue('שלום {name}, הכרטיס מוכן.');
    await expect(first.locator('.cnt')).toHaveText(/^\d+\/600$/);
    await page.locator(`${MSG} [data-msg-template-add]`).click();
    await expect(rows(page)).toHaveCount(4);
    const added = rows(page).nth(3);
    await added.locator('[data-msg-template-label]').fill('הודעה חדשה');
    await added.locator('[data-msg-template-body]').fill('שלום {name}, נעדכן אתכם.');
    await rows(page).nth(1).locator('[data-msg-template-remove]').click();
    await expect(rows(page)).toHaveCount(3);
    await shot(page, info, 'settings-templates-edited');
    await save(page).click();
    await expect(page.locator(`${MSG} [data-msg-notice="saved"]`)).toBeVisible();
    const sent = ms.puts[0].templates as { id?: string; label: string }[];
    expect(sent.map((t) => t.label)).toEqual(['כרטיס מוכן לאיסוף', 'הכניסה סגורה', 'הודעה חדשה']);
    expect(sent[0].id).toBe('card_ready'); // a saved template keeps its id (the history refers to it)
    expect(sent[2].id).toBeUndefined(); // a new one has none: the server assigns it
    expect(ms.doc.templates[2].id).toMatch(/^t\d+/);
    await expect(rows(page).nth(2)).toHaveAttribute('data-msg-template-key', ms.doc.templates[2].id);
  });

  test('never a PIN or a code in a template: said under the field as the sender types, before anything is sent', async ({ page }, info) => {
    const { ms } = await boot(page);
    const body = rows(page).first().locator('[data-msg-template-body]');
    for (const bad of ['שלום {name}, הקוד שלך {pin}', 'שלום {name}, הקוד שלך 4821', 'your PIN is 123456']) {
      await body.fill(bad);
      await expect(page.locator(`${MSG} [data-msg-problem-path="templates.0.body"]`), bad).toHaveAttribute('data-msg-problem', 'credential');
    }
    await shot(page, info, 'settings-credential-refused');
    await body.fill('שלום {phone}');
    await expect(page.locator(`${MSG} [data-msg-problem-path="templates.0.body"]`)).toHaveAttribute('data-msg-problem', 'unknown_placeholder');
    await body.fill('שלום {name');
    await expect(page.locator(`${MSG} [data-msg-problem-path="templates.0.body"]`)).toHaveAttribute('data-msg-problem', 'bad_braces');
    await body.fill('שלום מ{organization}');
    await expect(page.locator(`${MSG} [data-msg-problem-path="templates.0.body"]`)).toHaveAttribute('data-msg-problem', 'organization_missing');
    await input(page, 'organization').fill('מגדל');
    await expect(page.locator(`${MSG} [data-msg-problem-path="templates.0.body"]`)).toHaveCount(0);
    await rows(page).nth(1).locator('[data-msg-template-label]').fill('כרטיס מוכן');
    await expect(page.locator(`${MSG} [data-msg-problem-path="templates.1.label"]`)).toHaveAttribute('data-msg-problem', 'duplicate_label');
    await body.fill('שלום {name} {pin}');
    await save(page).click();
    expect(ms.puts).toEqual([]);
  });

  test('a problem only the server finds is shown under its field; a failed save says so and keeps the form', async ({ page }) => {
    const { ms } = await boot(page);
    await switchOf(page, 'enabled').click();
    ms.next = 'server_problem';
    ms.problems = [{ path: 'templates.1.body', code: 'credential' }];
    await save(page).click();
    await expect(page.locator(`${MSG} [data-msg-problem-path="templates.1.body"]`)).toHaveAttribute('data-msg-problem', 'credential');
    await expect(page.locator(`${MSG} [data-msg-notice="failed"]`)).toContainText('יש לתקן את השדות המסומנים');
    await expect(switchOf(page, 'enabled')).toHaveAttribute('aria-checked', 'true'); // the form is kept
    ms.next = 'fail';
    await rows(page).first().locator('[data-msg-template-label]').fill('שם אחר');
    await save(page).click();
    await expect(page.locator(`${MSG} [data-msg-notice="failed"]`)).toContainText('השמירה נכשלה');
    await expect(rows(page).first().locator('[data-msg-template-label]')).toHaveValue('שם אחר');
  });

  test('someone else saved first: a conflict, said calmly; reloading takes their version', async ({ page }, info) => {
    const { ms } = await boot(page);
    await switchOf(page, 'enabled').click();
    ms.next = 'conflict';
    ms.doc.organization = 'שם מהמסך השני';
    await save(page).click();
    await expect(page.locator(`${MSG} [data-msg-notice="conflict"]`)).toBeVisible();
    await shot(page, info, 'settings-conflict');
    await page.locator(`${MSG} [data-msg-reload]`).click();
    await expect(input(page, 'organization')).toHaveValue('שם מהמסך השני');
    await expect(switchOf(page, 'enabled')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator(`${MSG} [data-msg-notice="conflict"]`)).toHaveCount(0);
  });

  test('the revert button puts the saved version back', async ({ page }) => {
    await boot(page);
    await input(page, 'organization').fill('משהו');
    await rows(page).first().locator('[data-msg-template-body]').fill('שונה');
    await page.locator(`${MSG} [data-msg-revert]`).click();
    await expect(input(page, 'organization')).toHaveValue('');
    await expect(rows(page).first().locator('[data-msg-template-body]')).toHaveValue(/שלום \{name\}/);
    await disabled(save(page));
  });

  test('the service states: not connected, several accounts and none chosen, a chosen account that is gone', async ({ page }, info) => {
    const { ms } = await boot(page, { service: { state: 'ready', connected: false, accounts: [], problem: null, last_error: null } });
    await expect(page.locator(`${MSG} [data-msg-service="not_connected"]`)).toContainText('שירות ההודעות אינו מחובר');
    expect(ms.service.connected).toBe(false);
    await shot(page, info, 'settings-service-down');
    const ctx = await page.context().browser()!.newContext({ baseURL: info.project.use.baseURL, locale: 'he-IL' });
    const p2 = await ctx.newPage();
    await boot(p2, { service: { state: 'ready', connected: true, accounts: [{ id: 'wa-1', name: 'Office line' }, { id: 'wa-2', name: 'Spare line' }], problem: 'account_required', last_error: null } });
    await expect(p2.locator(`${MSG} [data-msg-service]`)).toContainText('יש כמה חשבונות');
    await p2.locator(`${MSG} [data-msg-setting="account"]`).selectOption('wa-2');
    await save(p2).click();
    await expect(p2.locator(`${MSG} [data-msg-notice="saved"]`)).toBeVisible();
    await ctx.close();
  });

  test('the read fails: the error panel with a retry; slow: the skeleton first', async ({ page }) => {
    const { ms } = await boot(page, { readFails: true }, { ready: false });
    await expect(page.locator(`${MSG} [data-access-status="error"]`)).toBeVisible({ timeout: 30_000 });
    ms.readFails = false;
    await page.locator(`${MSG} sw-state-panel`).locator('button, sw-button').first().click();
    await expect(page.locator(`${MSG} [data-access-status="ready"]`)).toBeVisible();
  });

  test('copy hygiene: no platform name, no internal code and no permission id on the page', async ({ page }) => {
    await boot(page);
    const text = await page.evaluate(() => {
      const out: string[] = [];
      const walk = (n: Node) => {
        if (n instanceof Element) for (const a of ['aria-label', 'title', 'placeholder', 'heading', 'label', 'hint']) n.getAttribute(a) && out.push(n.getAttribute(a)!);
        if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) out.push(n.textContent.trim());
        if (n instanceof Element && n.shadowRoot) n.shadowRoot.childNodes.forEach(walk);
        n.childNodes.forEach(walk);
      };
      const find = (root: Document | ShadowRoot): Element | null => {
        for (const el of root.querySelectorAll('*')) {
          if (el.tagName === 'SYSTEM-ACCESS-MESSAGING') return el;
          const inner = el.shadowRoot && find(el.shadowRoot);
          if (inner) return inner;
        }
        return null;
      };
      walk(find(document)!);
      return out.join('\n');
    });
    expect(text).not.toMatch(/WisKey|Home Assistant|Ingress|hikvision|add-on|תוסף|\bHA\b/i);
    expect(text).not.toMatch(/\bCR-\d+|\bS\d+\b|access\.[a-z]+\.[a-z]+/);
  });
});

test.describe('the message settings: the page at desktop, tablet and phone', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'horizontal overflow of the page').toBeLessThanOrEqual(1);

  test('the default page and a page with errors, no horizontal overflow', async ({ page }, info) => {
    await boot(page);
    await noOverflow(page);
    await shot(page, info, 'settings-page', true);
    await rows(page).first().locator('[data-msg-template-body]').fill('הקוד שלך {pin}');
    await input(page, 'bulk_max').fill('0');
    await noOverflow(page);
    await shot(page, info, 'settings-page-errors', true);
  });
});

test.describe('the message settings in every skin (light and dark, one project each)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  for (const skin of SKINS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${skin} ${scheme}`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'one project');
        await boot(page, {}, { skin, scheme });
        await switchOf(page, 'enabled').click();
        await rows(page).first().locator('[data-msg-template-body]').fill('שלום {name}, הקוד שלך {pin}');
        await shot(page, info, `settings-${skin}-${scheme}`, true);
      });
    }
  }
});
