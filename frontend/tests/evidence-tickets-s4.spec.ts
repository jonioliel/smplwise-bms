import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url } from './tickets-mocks';
import { installS4Mock, serveBuiltApp, type S4Mock, type S4MockOptions } from './tickets-s4-mocks';

// CR-038 slice 4 evidence: the internal screens of outside contacts from the REAL build against the mock layer (fake data) - the
// directory and its editor (since the owner's request of 2026-10-14 on the area's "מטפלים וספקים" page, one segment per kind), the "דף המטפלים" card on the general tab, sending a ticket outside
// from the assign dialog (the kind switch, the contact picker, the preview's text and refusals) and the link panel of a ticket sent
// outside (copy once, new link, revoke behind a confirmation). Desktop 1440 and phone 390, light and dark, classic and domus. The
// module's Hebrew name is the owner's (2026-10-14). Also asserts what the screens send.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-s4.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-s4');
const S = 'sw-app system-tickets';
const HP = 'sw-app tickets-handlers'; // owner 2026-10-14: the directory left Settings for this page
const L = 'sw-app tickets-list';
const NAME = { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' };
const SENT = '0000000000000a01';
const FRESH = '0000000000000a02';

async function go(page: Page, hash: string, o: S4MockOptions = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<S4Mock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const base = test.info().project.use.baseURL;
  if (process.env.SW_DIST_ROUTE === '1' && base) await serveBuiltApp(page, new URL(base).origin); // no server: the built app by route
  await installTicketsMock(page, { persona: o.persona ?? 'admin', name: NAME });
  const mock = await installS4Mock(page, o);
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  return mock;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic', full = true): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`), fullPage: full });
}

const last = (mock: S4Mock, method: string, re: RegExp) => [...mock.calls].reverse().find((c) => c.method === method && re.test(c.path));

test.describe('outside contacts - internal screens (slice 4)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(240_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the directory: the list and a vendor\'s card - light / dark x classic / domus; an edit sends only what changed', async ({ page }) => {
    const C = `${HP} tickets-contacts`;
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/tickets/handlers?seg=vendors', {}, scheme, skin);
        await page.waitForSelector(`${C} [data-contacts-list]`);
        await page.locator(`${C} [data-contact-item="c000000000000v01"]`).click();
        await page.waitForSelector(`${C} [data-card="contact-editor"]`);
        await shot(page, 'contacts', scheme, skin);
        if (test.info().project.name === 'mobile') { // the card sits under the list on a phone
          await page.locator(`${C} [data-card="contact-editor"]`).scrollIntoViewIfNeeded();
          await shot(page, 'contacts-editor', scheme, skin);
        }
      }
    const mock = await go(page, '/tickets/handlers?seg=contacts');
    await page.locator(`${C} [data-contact-item="c000000000000p01"]`).click();
    await page.locator(`${C} [data-field="company"]`).fill('טכנאי בכיר');
    await page.locator(`${C} [data-field="lang"]`).selectOption('ru');
    await page.locator(`${C} [data-contact-save]`).click();
    await expect.poll(() => last(mock, 'PATCH', /^tickets\/contacts\/c000000000000p01$/)?.body).toEqual({ company: 'טכנאי בכיר', lang: 'ru', revision: 1 });
    // TKGATEFIX4: the PATCH is recorded when it LEAVES; the save then re-reads the list and re-opens the editor from the saved row
    // (open(saved) rebuilds the draft), so a value typed before that lands is wiped - on the slower phone run the phone typed below
    // was lost and the warning never came. Wait until the save is over (busy clears in its finally, after the editor re-opened).
    await expect(page.locator(`${C} [data-contact-save]:not([disabled])`)).toHaveCount(1);
    // a phone change of a contact holding a live link says what it will revoke before anything is saved (review T19-4)
    await expect(page.locator(`${C} [data-contact-links-warning]`)).toHaveCount(0);
    await page.locator(`${C} [data-field="phone"]`).fill('050-000-0099');
    await expect(page.locator(`${C} [data-contact-links-warning]`)).toBeVisible();
    // a new contact: the name is required
    await page.locator(`${C} [data-contact-cancel]`).click(); // the editor is a modal drawer: close it first
    await page.locator(`${HP} [data-handlers-new]`).click(); // the page's "+ איש קשר" opens a new row
    await page.locator(`${C} [data-contact-save]`).click();
    await expect(page.locator(`${C} [data-contact-problem]`)).toBeVisible();
    expect(last(mock, 'POST', /^tickets\/contacts$/)).toBeUndefined();
    await page.locator(`${C} [data-contact-cancel]`).click();
    // erase asks first, with the history option
    await page.locator(`${C} [data-contact-item="c000000000000p02"]`).click();
    await page.locator(`${C} [data-contact-erase]`).click();
    await expect(page.locator(`${C} [data-contact-erase-confirm]`)).toBeVisible();
    if (test.info().project.name === 'mobile') await shot(page, 'contacts-erase', 'light', 'classic', false);
  });

  test('a manager without the settings right reads the list with masked phones and edits nothing', async ({ page }) => {
    const C = `${HP} tickets-contacts`;
    await go(page, '/tickets/handlers?seg=contacts', { persona: 'manager' });
    await page.waitForSelector(`${C} [data-contacts-list]`);
    await expect(page.locator(`${C} [data-contact-new]`)).toHaveCount(0);
    await page.locator(`${C} [data-contact-item="c000000000000p01"]`).click();
    await expect(page.locator(`${C} [data-card="contact"]`)).toContainText('•••• 0031');
    await expect(page.locator(`${C} [data-contact-save]`)).toHaveCount(0);
  });

  test('the handler page card in a remote session: the address is read-only with one explanation, a failed save names the reason', async ({ page }) => {
    const P = `${S} tickets-public-card`;
    await go(page, '/system/tickets', {}, 'light');
    await page.waitForSelector(`${P} [data-public-state="ready"]`);
    await expect(page.locator(`${P} [data-public-local-only]`)).toHaveCount(0);
    await page.locator(P).evaluate((el) => { (el as unknown as { remote: boolean; saveError: string }).remote = true; (el as unknown as { saveError: string }).saveError = 'שינוי כתובת הדף הציבורי אפשרי רק בגישה מקומית'; });
    await expect(page.locator(`${P} [data-public-local-only]`)).toHaveText('זמין רק בגישה מקומית (דרך Home Assistant)');
    await expect(page.locator(`${P} [data-public-address]`)).toHaveAttribute('readonly', '');
    await expect(page.locator(`${P} [data-public-address-save]`)).toHaveAttribute('disabled', '');
    await expect(page.locator(`${P} [data-public-probe]`)).toHaveAttribute('disabled', '');
    await expect(page.locator(`${P} [data-public-save-error]`)).toContainText('בגישה מקומית');
    await page.locator(`${P} [data-public-advanced]`).click();
    await expect(page.locator(`${P} [data-public-header="x-forwarded-for"]`)).toBeDisabled();
    await expect(page.locator(`${P} [data-public-org]`)).toBeEnabled(); // the other keys stay editable
  });

  test('the handler page card: state, address with its check, proxies', async ({ page }) => {
    const P = `${S} tickets-public-card`;
    for (const scheme of ['light', 'dark'] as const) {
      const mock = await go(page, '/system/tickets', {}, scheme);
      await page.waitForSelector(`${P} [data-public-state="ready"]`);
      await page.locator(`${P} [data-public-probe]`).click();
      await expect(page.locator(`${P} [data-probe-result="reachable"]`)).toBeVisible();
      await page.locator(`${P} [data-public-advanced]`).click();
      await expect(page.locator(`${P} [data-public-cidrs]`)).toBeVisible();
      await page.locator(`${P} [data-card="public"]`).screenshot({ path: path.join(OUT, `public-card-${test.info().project.name}-${scheme}-classic.png`) });
      if (scheme === 'light') {
        await page.locator(`${P} [data-public-org]`).fill('מגדלי הדר - אגף צפון');
        await page.locator(`${P} [data-public-org-save]`).click();
        await expect.poll(() => last(mock, 'PUT', /^tickets\/settings$/)?.body).toMatchObject({ organization_name: 'מגדלי הדר - אגף צפון' });
        await page.locator(`${P} [data-public-header="x-forwarded-for"]`).click();
        await expect.poll(() => last(mock, 'PUT', /^tickets\/settings$/)?.body).toMatchObject({ public: { client_ip_header: 'x-forwarded-for' } });
      }
    }
    // not set up: what is missing is named
    await go(page, '/system/tickets', { publicReady: false });
    await expect(page.locator(`${P} [data-missing="option"]`)).toBeVisible();
  });

  test('send outside: the kind switch, a vendor\'s technician, the outgoing text; a code that cannot leave is refused before anything is sent', async ({ page }) => {
    const D = `${L} ticket-detail`;
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, `/tickets/mine?t=${FRESH}`, {}, scheme);
      await page.waitForSelector(`${D} [data-ticket-detail="${FRESH}"]`);
      await page.locator(`${D} [data-assign]`).click();
      await page.locator(`${D} [data-assign-kind="person"]`).click();
      await page.locator(`${D} [data-contact="c000000000000p01"] input`).check();
      await page.waitForSelector(`${D} [data-assign-preview]`);
      await page.locator(`${D} [data-preview-toggle]`).click();
      await expect(page.locator(`${D} [data-preview-text]`)).toContainText('בקשת שירות 1043');
      await shot(page, 'assign-outside', scheme, 'classic', false);
    }
    const mock = await go(page, `/tickets/mine?t=${FRESH}`);
    await page.waitForSelector(`${D} [data-ticket-detail="${FRESH}"]`);
    await page.locator(`${D} [data-assign]`).click();
    await page.locator(`${D} [data-assign-kind="person"]`).click();
    // a contact whose own setting requires a code: locked on, and refused while no channel can carry the code (slice 4)
    await page.locator(`${D} [data-contact="c000000000000p02"] input`).check();
    await expect(page.locator(`${D} [data-require-code]`)).toBeChecked();
    await expect(page.locator(`${D} [data-require-code]`)).toBeDisabled();
    await expect(page.locator(`${D} [data-refusal="code_channel_unavailable"]`)).toBeVisible();
    await expect(page.locator(`${D} [data-dialog-ok]`)).toBeDisabled();
    // the technician: assigned with the contact kind; the link panel appears
    await page.locator(`${D} [data-contact="c000000000000p01"] input`).check();
    await page.waitForSelector(`${D} [data-assign-preview]`);
    await page.locator(`${D} [data-dialog-ok]`).click();
    await expect.poll(() => last(mock, 'POST', new RegExp(`^tickets/${FRESH}/assign$`))?.body).toMatchObject({ assignee: { kind: 'contact', id: 'c000000000000p01' } });
    await expect(page.locator(`${D} [data-link-panel]`)).toBeVisible();
  });

  test('the link panel: state and opens, copy once, a new link and revoke behind a confirmation', async ({ page, context }) => {
    const D = `${L} ticket-detail`;
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, `/tickets/mine?t=${SENT}`, { sentTicket: true }, scheme, skin);
        await page.waitForSelector(`${D} [data-link-panel][data-link-state="live"]`);
        await shot(page, 'link-panel', scheme, skin);
      }
    const mock = await go(page, `/tickets/mine?t=${SENT}`, { sentTicket: true });
    await page.waitForSelector(`${D} [data-link-panel]`);
    await expect(page.locator(`${D} [data-link-opened]`)).toContainText('3');
    await page.locator(`${D} [data-link-copy]`).click();
    await expect.poll(() => last(mock, 'POST', new RegExp(`^tickets/${SENT}/link/copy$`))).toBeTruthy();
    await page.locator(`${D} [data-link-revoke]`).click();
    await expect(page.locator(`${D} [data-link-confirm="revoke"]`)).toBeVisible();
    await shot(page, 'link-revoke-confirm', 'light', 'classic', false);
    await page.locator(`${D} [data-link-confirm-ok]`).click();
    await expect(page.locator(`${D} [data-link-panel][data-link-state="revoked"]`)).toBeVisible();
    await page.locator(`${D} [data-link-new]`).click();
    await page.locator(`${D} [data-link-confirm-ok]`).click();
    await expect(page.locator(`${D} [data-link-panel][data-link-state="live"]`)).toBeVisible();
    expect(last(mock, 'POST', new RegExp(`^tickets/${SENT}/link/new$`))).toBeTruthy();
  });
});
