import { test, expect, type Page, type Route, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './access-control-mocks';
import { installExternalMock, XNOW } from './access-external-mocks';
import { installTicketsMock, url as ticketsUrl } from './tickets-mocks';
import { installS4Mock } from './tickets-s4-mocks';

// GRANTS3-295 evidence against MOCKED backends (invented sample data; no PIN and no card number anywhere; nothing reaches WisKey, a station,
// a door, a reader or WhatsApp). Runs on the Vite DEV server (SW_BASE_URL), desktop + phone, light + dark:
//   1. the vendor's page (public-ticket.html): the arrival step's form, the request waiting, then the approved doors / dates / hours and
//      when the personal code goes (never the code), a card that is ready;
//   2. the assign dialog's "access needed" tick (offered only by the preview; sent as access_needed: true);
//   3. the external-access drawer of a CARD grant: the card number field (cleared after the save; reading at a reader is off) and the
//      owner's history.
// Screenshots: docs/design/evidence/GRANTS3-295/.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'GRANTS3-295');
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const PIN = /\b9133\d\d\b|\b\d{6}\b(?![-:])/;
const SCHEMES = ['light', 'dark'] as const;

async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${info.project.name}.png`), fullPage: true });
}

// ---------------------------------------------------------------- 1. the vendor's page

const day = (plus: number) => new Date(Date.now() + plus * 86_400_000).toISOString().slice(0, 10);

function ticketView(scheme: 'light' | 'dark'): Record<string, unknown> {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
  return {
    number: 1043, department: 'אחזקה', organization: 'מגדלי הדר', lang: 'he', dir: 'rtl', labels: { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' },
    time_zone: 'Asia/Jerusalem', code_required: false, code_ok: true, read_only: false, read_only_until: null, expires_at: iso(now + 12 * 86_400_000), theme: scheme,
    title: 'החלפת מנוע שער חניון', description: 'השער נתקע במצב פתוח. נדרשת החלפת מנוע.', priority: { key: 'high', name: 'גבוהה' }, place_text: 'בניין A · חניון -1',
    status: 'acknowledged', eta_at: null, assigned_by: 'יוני', assigned_at: iso(now - 20 * 3_600_000), created_at: iso(now - 26 * 3_600_000), kind: 'vendor',
    actions: { statuses: ['in_progress', 'waiting_part', 'done'], note: true, eta: true, photo: true, return: true },
    timeline: [], photos: [], claim: null, history: null, limits: { note_max: 2000, reason_max: 500, photo_max_bytes: 10 * 1024 * 1024, photos_left: 9 },
    arrival: true,
  };
}

type Stage = 'form' | 'waiting' | 'scheduled' | 'sent' | 'card';
function arrivalView(stage: Stage): Record<string, unknown> {
  const access = {
    doors: ['שער חניון', 'לובי ראשי'], from: day(2), to: day(3), hours: '08:00-17:00', credential: stage === 'card' ? 'card' : 'pin',
    ...(stage === 'card' ? { card: { state: 'ready' } } : { code: { state: stage === 'sent' ? 'sent' : 'scheduled', at: stage === 'sent' ? null : `${day(1)}T18:00`, to: '····61' } }),
  };
  return {
    available: true, persons: [{ id: 'p1', label: 'רון ····61' }, { id: 'p2', label: 'אבי ····57' }], can_add: true,
    window: { from: day(2), to: day(4) }, hours: ['07:00-12:00', '07:00-16:00', '08:00-17:00', '12:00-20:00', '07:00-20:00', '00:00-24:00'], max_days: 14,
    notice: { version: 'n2', text: 'בכניסה לבניין נרשמים השם, השעה והדלת. ההודעה נשמרת לפי מדיניות השמירה של הארגון. לשאלות פנו למגדלי הדר.', attest: 'קראתי ומסרתי את ההודעה לטכנאי שמגיע', lang: 'he' },
    current: stage === 'form' ? null : stage === 'waiting' ? { state: 'waiting', person: 'רון ····61', pending_change: false }
      : { state: 'approved', person: 'רון ····61', pending_change: false, access },
  };
}

async function vendorPage(page: Page, scheme: 'light' | 'dark', stage: Stage): Promise<{ posts: unknown[] }> {
  const st = { posts: [] as unknown[], stage };
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.route('**/t/api/**', async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'cache-control': 'no-store' } });
    if (p.endsWith('/api/ticket')) return json(ticketView(scheme));
    if (p.endsWith('/api/arrival') && req.method() === 'GET') return json(arrivalView(st.stage));
    if (p.endsWith('/api/arrival') && req.method() === 'POST') {
      st.posts.push(req.postDataJSON());
      st.stage = 'waiting';
      return json({ ok: true, state: 'waiting', outcome: 'created', outside_window: false, grant_state: 'requested', needs_push: false, pending_sync: false, scope_verified: false, doors_state: 'desired' });
    }
    return json({ code: 'link_unavailable' }, 404);
  });
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`/public-ticket.html#${TOKEN}`);
  await expect(page.locator('section.arrival')).toBeVisible({ timeout: 30_000 });
  return st;
}

test.describe('GRANTS3-295 the vendor page', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'desktop and phone'));

  for (const scheme of SCHEMES) {
    test(`the arrival step: the form, the request, then the approved doors and the code's schedule (${scheme})`, async ({ page }, info) => {
      const st = await vendorPage(page, scheme, 'form');
      const card = page.locator('section.arrival');
      await expect(card).toHaveAttribute('data-arrival', 'form');
      await card.locator('[data-arrival-person="p1"]').click();
      await card.locator('[data-arrival-send]').click();
      await expect(card.locator('[data-arrival-error="errRequired"]')).toBeVisible();
      expect(st.posts).toEqual([]);
      await card.locator('details.arr-notice summary').click();
      await card.locator('[data-arrival-ack]').check();
      await card.scrollIntoViewIfNeeded();
      await shot(page, info, `01-arrival-form-${scheme}`);
      await card.locator('[data-arrival-send]').click();
      await expect(card).toHaveAttribute('data-arrival', 'waiting');
      expect(st.posts).toHaveLength(1);
      expect(st.posts[0]).toMatchObject({ person_id: 'p1', notice_ack: true, notice_version: 'n2', hours: '08:00-17:00', date_from: day(2) });
      await shot(page, info, `02-arrival-waiting-${scheme}`);

      for (const stage of ['scheduled', 'sent', 'card'] as const) {
        await vendorPage(page, scheme, stage);
        await expect(card).toHaveAttribute('data-arrival', 'approved');
        await expect(card.locator('[data-arrival-doors]')).toContainText('שער חניון');
        const text = await card.innerText();
        expect(text).not.toMatch(PIN);
        expect(text).not.toMatch(/st-|station/i);
        if (stage === 'scheduled') await expect(card.locator('[data-arrival-code="scheduled"]')).toContainText('····61');
        if (stage === 'sent') await expect(card.locator('[data-arrival-code="sent"]')).toBeVisible();
        if (stage === 'card') await expect(card.locator('[data-arrival-code="ready"]')).toBeVisible();
        await card.scrollIntoViewIfNeeded();
        await shot(page, info, `03-arrival-approved-${stage}-${scheme}`);
      }
    });
  }
});

// ---------------------------------------------------------------- 2. the assign dialog's "access needed" tick

test.describe('GRANTS3-295 the assign dialog', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'desktop and phone'));

  for (const scheme of SCHEMES) {
    test(`"access needed" is offered by the preview and sent with the assignment (${scheme})`, async ({ page }, info) => {
      test.setTimeout(120_000);
      const D = 'sw-app tickets-list ticket-detail';
      const FRESH = '0000000000000a02';
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await installTicketsMock(page, { persona: 'admin', name: { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' } });
      const mock = await installS4Mock(page, { accessNeeded: true });
      await page.goto('about:blank');
      await page.goto(ticketsUrl(`/tickets/mine?t=${FRESH}`, 'classic', scheme));
      await page.waitForSelector(`${D} [data-ticket-detail="${FRESH}"]`, { timeout: 30_000 });
      await page.locator(`${D} [data-assign]`).click();
      await page.locator(`${D} [data-assign-kind="person"]`).click();
      await page.locator(`${D} [data-contact="c000000000000p01"] input`).check();
      await page.waitForSelector(`${D} [data-assign-preview]`);
      const tick = page.locator(`${D} [data-access-needed]`);
      await expect(tick).toBeVisible();
      await expect(tick).not.toBeChecked();
      await tick.check();
      await page.locator(`${D} [data-access-needed-switch]`).scrollIntoViewIfNeeded();
      await shot(page, info, `04-assign-access-needed-${scheme}`);
      await page.locator(`${D} [data-dialog-ok]`).click();
      await expect.poll(() => [...mock.calls].reverse().find((c) => c.method === 'POST' && /^tickets\/[^/]+\/assign$/.test(c.path))?.body).toMatchObject({ access_needed: true });
    });
  }
});

// ---------------------------------------------------------------- 3. the drawer of a card grant and the owner's history

test.describe('GRANTS3-295 the card and the history in the drawer', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'desktop and phone'));

  for (const scheme of SCHEMES) {
    test(`a card grant: type the number (never kept), reading is off; the history (${scheme})`, async ({ page }, info) => {
      const mock = await installExternalMock(page, { cards: true });
      await page.clock.setFixedTime(XNOW);
      await page.goto('about:blank');
      await page.goto(url(`/wiskey/external?grant=${'g15'.padEnd(32, '0')}`, 'classic', scheme));
      const drawer = page.locator('sw-app access-external-screen sw-drawer[data-grant-drawer]');
      await expect(drawer.locator('[data-card-block="awaiting"]')).toBeVisible({ timeout: 30_000 });
      await expect(drawer.locator('[data-action="card-read"]')).toBeDisabled();
      const input = drawer.locator('[data-card-no]');
      await input.fill('A1B2C3D4');
      await drawer.locator('[data-card-block]').scrollIntoViewIfNeeded();
      await shot(page, info, `05-card-awaiting-${scheme}`);
      await drawer.locator('[data-action="card-save"]').click();
      await expect.poll(() => mock.posts.find((x) => /\/card$/.test(x.path))?.body).toMatchObject({ card_no: 'A1B2C3D4' });
      await expect(drawer.locator('[data-card-state="attached"]')).toBeVisible();
      expect(await drawer.innerText()).not.toContain('A1B2C3D4');
      await drawer.locator('[data-history-show]').click();
      await expect(drawer.locator('[data-history] li')).toHaveCount(6);
      await expect(drawer.locator('[data-history-action="approve"]').first()).toContainText('self_approval');
      await drawer.locator('[data-grant-history]').scrollIntoViewIfNeeded();
      await shot(page, info, `06-card-attached-history-${scheme}`);
    });
  }
});
