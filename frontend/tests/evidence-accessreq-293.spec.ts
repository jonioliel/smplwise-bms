import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './access-control-mocks';
import { XNOW } from './access-external-mocks';
import { installRequestMock, type RequestOptions } from './access-request-mocks';
import { settlePage } from './pixel-settle';

// ACCESSREQ-293 against the mocked backend (tests/access-request-mocks.ts: invented sample data, no PIN anywhere). Nothing here reaches a
// WisKey, a station, a door or WhatsApp. What it pins (owner-approved mockup private/planning/mockup_access_request_2026-10-20, owner
// decisions of 2026-10-20):
//   (a) "I approve now" is offered to a system administrator only; anyone else sees it blocked ("a second person approves");
//   (b) a manager who may only request chooses from the stations the server marks `may_request` (entrances + the ticket's station);
//       the rest sit locked in a collapsed group;
//   the form: who (directory / new person), purpose, doors (n / max), when, credential, internal notes, approval path + approvers,
//   the privacy notice in the person's language + the tick, what the person receives (the code is never shown); the errors state; the
//   no-permission dialog; WisKey unavailable; desktop and phone, light and dark; the request the server receives.
// Evidence screenshots: docs/design/evidence/ACCESSREQ-293/. Needs the Vite dev server or a built preview (SW_BASE_URL).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'ACCESSREQ-293');
const SCREEN = 'sw-app access-external-screen';
const DLG = `${SCREEN} access-request-dialog`;

async function boot(page: Page, o: RequestOptions & { scheme?: 'light' | 'dark'; hash?: string } = {}) {
  const mock = await installRequestMock(page, o);
  await page.clock.setFixedTime(XNOW);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto(url(o.hash ?? '/wiskey/external', 'classic', o.scheme ?? 'light'));
  await expect(page.locator(`${SCREEN} .kpis`).first()).toBeVisible({ timeout: 30_000 });
  return { mock, errors };
}

async function open(page: Page) {
  await page.locator(`${SCREEN} [data-open-request]`).click();
  await expect(page.locator(`${DLG} [data-sec="doors"] [data-door]`).first()).toBeAttached({ timeout: 15_000 });
}

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}

async function fill(page: Page, o: { self?: boolean } = {}) {
  const d = page.locator(DLG);
  await d.locator('[data-contact="c1"] input').click();
  await d.locator('#tk').selectOption('t1842');
  await d.locator('#pu').fill('החלפת מדחס');
  await d.locator('[data-door="lobby:1"]').check();
  await d.locator('[data-door="base:1"]').check();
  await d.locator('#vf').fill('2026-10-21');
  await d.locator('#vf').dispatchEvent('change');
  await d.locator('#vu').fill('2026-10-22');
  await d.locator('#vu').dispatchEvent('change');
  await d.locator('[data-sec="notes"] textarea').fill('לתאם עם השומר בכניסה');
  await d.locator('[data-told]').check();
  if (o.self === false) await d.locator('[data-path="send"] input').check();
}

test('filled by a system administrator: one step "approve now", the notice in the person\'s language, the request on the wire', async ({ page }, info) => {
  const { mock, errors } = await boot(page);
  await open(page);
  await fill(page);
  const d = page.locator(DLG);
  await expect(d.locator('[data-door-count]')).toHaveText('2 / 4');
  await expect(d.locator('[data-approvers]')).toHaveAttribute('data-approvers', '3');
  await expect(d.locator('[data-path="self"] input')).toBeEnabled();
  await expect(d.locator('[data-path="self"] input')).toBeChecked();
  await expect(d.locator('[data-extended-identity="locked"]')).toBeVisible();
  await expect(d.locator('[data-notice-text]')).toContainText('לצורך כניסת הטכנאי');
  await expect(d.locator('[data-preview]')).toContainText('לובי ראשי');
  const text = await d.innerText();
  expect(text).not.toMatch(/אינטרקום|intercom|home assistant/i);
  expect(text).not.toMatch(/913\d{3}/); // no PIN-like value anywhere
  await shot(page, info, '01-filled-light');
  await d.locator('[data-request-ok]').click();
  await expect(page.locator(`${SCREEN} [data-toast]`)).toContainText('אושר ונשלח ל-WisKey');
  expect(mock.requests).toHaveLength(1);
  const body = mock.requests[0] as Record<string, any>;
  expect(body).toMatchObject({ contact_id: 'c1', ticket_id: 't1842', doors: { base: [1], lobby: [1] }, credential: 'pin', purpose: 'החלפת מדחס', notes: 'לתאם עם השומר בכניסה', told: true, approve_now: true });
  expect(body.valid_from).toBe('2026-10-20T21:00:00Z');
  expect(body.valid_until).toBe('2026-10-22T21:00:00Z');
  expect(body.timing).toMatchObject({ mode: 'weekly', timezone: 'Asia/Jerusalem', days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'], periods: [{ start: '07:00', end: '16:00' }] });
  expect(errors).toEqual([]);
});

test('owner decision (a)+(b): a manager who may only request - entrances + the ticket\'s station, "approve now" blocked', async ({ page }, info) => {
  const { mock } = await boot(page, { requesterOnly: true, systemAdmin: false });
  await open(page);
  const d = page.locator(DLG);
  await expect(d.locator('[data-open-stations] [data-door]')).toHaveCount(4); // lobby x2 + park x2 (the entrances)
  await d.locator('#tk').selectOption('t1842');
  await expect(d.locator('[data-open-stations] [data-door="base:1"]')).toBeAttached(); // the ticket's station joins
  await expect(d.locator('[data-locked-stations]')).toBeVisible();
  await expect(d.locator('[data-locked-stations] [data-door="roof:1"]')).toBeDisabled();
  await d.locator('[data-contact="c1"] input').click();
  await d.locator('[data-door="lobby:1"]').check();
  await expect(d.locator('[data-path="self"] input')).toBeDisabled();
  await expect(d.locator('[data-self-block="blk_second"]')).toBeVisible();
  await expect(d.locator('[data-approvers]')).toHaveAttribute('data-approvers', '2');
  await d.locator('#vf').fill('2026-10-21');
  await d.locator('#vf').dispatchEvent('change');
  await d.locator('#vu').fill('2026-10-21');
  await d.locator('#vu').dispatchEvent('change');
  await d.locator('[data-told]').check();
  await shot(page, info, '03-requester-light');
  await d.locator('[data-request-ok]').click();
  await expect(page.locator(`${SCREEN} [data-toast]`)).toContainText('הבקשה נשלחה למאשרים');
  expect((mock.requests[0] as Record<string, unknown>).approve_now).toBe(false);
});

test('the errors state names each field, in dark', async ({ page }, info) => {
  const { mock } = await boot(page, { scheme: 'dark' });
  await open(page);
  const d = page.locator(DLG);
  await d.locator('[data-pmode="new"]').click();
  await d.locator('#np-name').fill('ג');
  await d.locator('#np-ph').fill('05-12');
  for (const k of ['lobby:1', 'lobby:2', 'park:1', 'park:2', 'base:1']) await d.locator(`[data-door="${k}"]`).check();
  await d.locator('#vf').fill('2026-10-22');
  await d.locator('#vf').dispatchEvent('change');
  await d.locator('#vu').fill('2026-10-21');
  await d.locator('#vu').dispatchEvent('change');
  await d.locator('[data-request-ok]').click();
  for (const k of ['npName', 'npPhone', 'doors', 'dates', 'told']) await expect(d.locator(`[data-err="${k}"]`)).toBeVisible();
  await expect(d.locator('[data-door-count]')).toHaveText('5 / 4');
  await expect(d.locator('[data-fix-count]')).toBeVisible();
  expect(mock.requests).toHaveLength(0);
  expect(mock.contactsCreated).toHaveLength(0);
  await shot(page, info, '02-errors-dark');
});

test('a new person: the contact is created, the confirmation code is sent, then the request', async ({ page }) => {
  const { mock } = await boot(page);
  await open(page);
  const d = page.locator(DLG);
  await d.locator('[data-pmode="new"]').click();
  await d.locator('#np-name').fill('גיא לוי');
  await d.locator('#np-co').fill('קר־טק מיזוג');
  await d.locator('#np-ph').fill('050-1234567');
  await d.locator('[data-door="park:1"]').check();
  await d.locator('#vf').fill('2026-10-23');
  await d.locator('#vf').dispatchEvent('change');
  await d.locator('#vu').fill('2026-10-23');
  await d.locator('#vu').dispatchEvent('change');
  await d.locator('[data-told]').check();
  await expect(d.locator('[data-self-block="blk_numberNew"]')).toBeVisible();
  await d.locator('[data-request-ok]').click();
  await expect(page.locator(`${SCREEN} [data-toast]`)).toContainText('הבקשה נשלחה');
  expect(mock.contactsCreated[0]).toMatchObject({ kind: 'person', display_name: 'גיא לוי', vendor_id: 'c4', phone: '050-1234567', lang: 'he' });
  expect(mock.requests[0]).toMatchObject({ contact_id: 'c-new', approve_now: false, told: true });
});

test('long names and many doors on the phone, light', async ({ page }, info) => {
  await boot(page, { longNames: true, manyDoors: true });
  await open(page);
  const d = page.locator(DLG);
  await d.locator('[data-contact="c1"] input').click();
  await expect(d.locator('[data-locked-stations]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await shot(page, info, '04-long-many-light');
});

test('WisKey unavailable: the banner with the list time, "approve now" blocked, dark', async ({ page }, info) => {
  await boot(page, { offline: true, scheme: 'dark' });
  await open(page);
  const d = page.locator(DLG);
  await expect(d.locator('[data-offline]')).toContainText('09:41');
  await d.locator('[data-contact="c1"] input').click();
  await d.locator('[data-door="lobby:1"]').check();
  await expect(d.locator('[data-self-block="blk_offline"]')).toBeVisible();
  await shot(page, info, '05-offline-dark');
});

test('"approve now" refused after the request was stored: the request stays and the toast says why', async ({ page }) => {
  await boot(page, { approval: 'failed' });
  await open(page);
  await fill(page);
  await page.locator(`${DLG} [data-request-ok]`).click();
  await expect(page.locator(`${SCREEN} [data-toast]`)).toContainText('האישור לא בוצע');
});

test('no permission: no button, and the direct link shows the short refusal', async ({ page }, info) => {
  await boot(page, { mayRequest: false, hash: '/wiskey/external?request=1' });
  await expect(page.locator(`${SCREEN} [data-open-request]`)).toHaveCount(0);
  await expect(page.locator(`${SCREEN} access-request-dialog [data-request-noperm] .nop h3`)).toBeVisible();
  await shot(page, info, '06-noperm-light');
});

test('the empty form, in dark', async ({ page }, info) => {
  await boot(page, { scheme: 'dark' });
  await open(page);
  await expect(page.locator(`${DLG} [data-path="send"] input`)).toBeChecked();
  await shot(page, info, '07-empty-dark');
});
