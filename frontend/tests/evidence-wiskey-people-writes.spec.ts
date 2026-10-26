import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { install, newMock, type PeopleMock, type Role } from './wiskey-people-mock';
import { PIN_SENTINEL, TAKEN_CARD, installWrites, newWrites, type WritesMock } from './wiskey-writes-mock';
import { skinsUnderTest } from './helpers/frozen-skins';

// CR-036 S11: evidence for the person WRITES of the native people screen (אנשים) - the "פעולות" dialog of a person's page (switch off /
// on, end a visitor's access, archive / restore, delete, the cards, the photo) and the editor's new parts (the access category, the
// timing, the field level, PIN generation by its own permission) - against the S7 people mock plus the writes mock
// (tests/wiskey-writes-mock.ts: the shapes of tests/fixtures/access_writes_wire.json, held to the real endpoints by
// smplwise_vms/backend/tests/test_access_writes_wire.py). No Home Assistant, no WisKey, no station, no device: nothing here can open a
// door or change a real person. Three projects (desktop / tablet / mobile), five skins, light and dark for the dialog; the functional
// specs run on desktop. Screenshots go to the test's output folder (the pixel baselines are pixel-wiskey-people-writes.spec.ts).
//   npx playwright test tests/evidence-wiskey-people-writes.spec.ts --workers=1        (against the built preview, or SW_BASE_URL)

const SKINS = skinsUnderTest(['classic', 'domus', 'tesla', 'bubble', 'crystal'] as const);
const SCHEMES = ['light', 'dark'] as const;
const SCREEN = 'wiskey-people';
const ACTIONS = 'wiskey-person-actions';
const EDITOR = 'wiskey-person-editor';
const NOW = '2026-10-12T10:00:00Z';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const desktopOnly = (info: TestInfo) => test.skip(info.project.name !== 'desktop', 'desktop project: functional spec');
const shot = (page: Page, info: TestInfo, name: string) => settle(page).then(() => page.screenshot({ path: info.outputPath(`${name}.png`) }));

interface Opts {
  skin?: (typeof SKINS)[number];
  scheme?: (typeof SCHEMES)[number];
}

async function open(page: Page, st: PeopleMock, w: WritesMock, o: Opts = {}): Promise<void> {
  await page.clock.setFixedTime(new Date(NOW)); // the invented dates are those of 2026-10-12; the timers still run
  await install(page, st);
  await installWrites(page, st, w); // after the S7 mock: its routes win, everything else falls back
  await page.goto(`/?design=a&skin=${o.skin ?? 'classic'}&scheme=${o.scheme ?? 'light'}#/wiskey/people`);
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
  await expect(page.locator(`${SCREEN} [data-person-row]`).first()).toBeVisible();
}

const world = (role: Role = 'admin') => ({ st: newMock(role), w: newWrites() });
const drawer = (page: Page) => page.locator('wiskey-person-drawer');
const dialog = (page: Page) => page.locator(`${ACTIONS} sw-dialog`);
const result = (page: Page) => page.locator(`${ACTIONS} [data-action-result]`);
const editor = (page: Page) => page.locator(EDITOR);
const field = (page: Page, name: string) => editor(page).locator(`[data-wiskey-editor-${name}]`);
const sentTo = (w: WritesMock, tail: string) => w.sent.filter((s) => s.path.endsWith(tail));
const personHits = (st: PeopleMock, id: string) => st.hits.filter((h) => h === `GET access-control/people/${id}`).length;
const listHits = (st: PeopleMock) => st.hits.filter((h) => h.startsWith('GET access-control/people?')).length;

async function openPerson(page: Page, id: string): Promise<void> {
  await page.locator(`${SCREEN} [data-person-row="${id}"]`).click();
  await expect(drawer(page).locator('sw-drawer[open]')).toBeVisible();
  await expect(drawer(page).locator('[data-person-section="details"]')).toBeVisible();
}

async function openActions(page: Page): Promise<void> {
  await drawer(page).locator('[data-person-actions-open]').click();
  await expect(dialog(page)).toHaveAttribute('data-person-actions', 'menu');
}

async function choose(page: Page, action: string): Promise<void> {
  await page.locator(`${ACTIONS} [data-person-action="${action}"]`).click();
  await expect(dialog(page)).toHaveAttribute('data-person-actions', action);
}

async function closeActions(page: Page): Promise<void> {
  await page.locator(`${ACTIONS} [data-action-close]`).click();
  await expect(page.locator(ACTIONS)).toHaveCount(0);
}

const menu = async (page: Page) => page.locator(`${ACTIONS} [data-person-action]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-person-action')));

/** No platform name and no internal code in what a person reads (UI_COPY_RULES). */
async function plainCopy(where: Locator): Promise<void> {
  const text = await where.evaluateAll((els) => {
    const out: string[] = [];
    const walk = (n: Node) => {
      if (n.nodeType === Node.TEXT_NODE) out.push(n.textContent ?? '');
      if (n instanceof Element) {
        if (n.tagName === 'STYLE' || n.tagName === 'SCRIPT') return;
        for (const a of ['aria-label', 'title', 'placeholder', 'heading', 'subheading', 'label']) if (n.hasAttribute(a)) out.push(n.getAttribute(a)!);
        if (n.shadowRoot) n.shadowRoot.childNodes.forEach(walk);
      }
      n.childNodes.forEach(walk);
    };
    els.forEach(walk);
    return out.join(' ');
  });
  expect(text.length).toBeGreaterThan(10); // the walk read something
  expect(text).not.toMatch(/WisKey|Home Assistant|Ingress|\bHA\b|CR-\d|access\.[a-z]/);
}

/** Whether `needle` is anywhere in the live document (text, attribute values, input values), through every shadow root. */
function domHolds(page: Page, needle: string): Promise<boolean> {
  return page.evaluate((needle) => {
    const walk = (root: Document | ShadowRoot | Element): boolean => {
      if ('textContent' in root && root.textContent?.includes(needle)) return true;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (Array.from(el.attributes).some((a) => a.value.includes(needle))) return true;
        if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.value.includes(needle)) return true;
        if (el.shadowRoot && walk(el.shadowRoot)) return true;
      }
      return false;
    };
    return walk(document);
  }, needle);
}

/** The frame size and the bytes of a JPEG data URL (its SOF0 / SOF2 segment). */
function jpeg(dataUrl: string): { width: number; height: number; bytes: number } {
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  for (let i = 2; i + 9 < buf.length; ) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc2) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), bytes: buf.length };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('no JPEG frame');
}

// ---------------------------------------------------------------- the dialog in every skin

test.describe('the actions of a person\'s page in every skin (light and dark, every project)', () => {
  for (const skin of SKINS) {
    for (const scheme of SCHEMES) {
      test(`${skin} ${scheme}: the menu, the question, the answer`, async ({ page }, info) => {
        const { st, w } = world();
        await open(page, st, w, { skin, scheme });
        await openPerson(page, 'p1');
        await openActions(page);
        await shot(page, info, `menu-${skin}-${scheme}`);
        await choose(page, 'deactivate');
        await expect(page.locator(`${ACTIONS} [data-action-question]`)).toContainText('דנה כהן');
        await shot(page, info, `ask-${skin}-${scheme}`);
        await page.locator(`${ACTIONS} [data-action-confirm]`).click();
        await expect(result(page)).toHaveAttribute('data-action-result', 'saved');
        await shot(page, info, `saved-${skin}-${scheme}`);
        await closeActions(page);
        await expect(drawer(page).locator('[data-person-result="saved"]')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'horizontal overflow of the page').toBeLessThanOrEqual(1);
      });
    }
  }
});

// ---------------------------------------------------------------- what is offered

test.describe('the page offers only what the server allows', () => {
  test('the menu follows the person: staff, a contractor, switched off, archived; no photo when the photo switch is off', async ({ page }, info) => {
    desktopOnly(info);
    const { st, w } = world();
    await open(page, st, w);
    await openPerson(page, 'p1');
    await openActions(page);
    expect(await menu(page)).toEqual(['deactivate', 'cards', 'photo', 'archive', 'delete']); // staff: no "end temporary access"
    await plainCopy(page.locator(ACTIONS));
    await page.keyboard.press('Escape'); // Escape closes the dialog on top, not the person's page under it
    await expect(page.locator(ACTIONS)).toHaveCount(0);
    await expect(drawer(page).locator('sw-drawer[open]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer(page).locator('sw-drawer[open]')).toHaveCount(0);
    await openPerson(page, 'p4');
    await openActions(page);
    expect(await menu(page)).toContain('temporary_cancel'); // a contractor
    await closeActions(page);
    await page.keyboard.press('Escape');
    await openPerson(page, 'p6');
    await openActions(page);
    expect(await menu(page)).toEqual(['activate', 'cards', 'photo', 'archive', 'delete']); // switched off
    await closeActions(page);
    await page.keyboard.press('Escape');
    await page.locator(`${SCREEN} select[data-wiskey-people-filter="state"]`).selectOption('archived');
    await expect(page.locator(`${SCREEN} [data-person-row="p10"]`)).toBeVisible();
    await openPerson(page, 'p10');
    await openActions(page);
    expect(await menu(page)).toEqual(['cards', 'photo', 'restore', 'delete']); // archived: restored first, never switched on from here
  });

  test('without the photo switch there is no photo; an operator gets neither "פעולות" nor "עריכה"', async ({ page }, info) => {
    desktopOnly(info);
    const { st, w } = world();
    st.photoEnabled = false;
    await open(page, st, w);
    await openPerson(page, 'p1');
    await openActions(page);
    expect(await menu(page)).not.toContain('photo');
    const op = world('operator');
    const p2 = await page.context().newPage();
    await open(p2, op.st, op.w);
    await openPerson(p2, 'p1');
    await expect(drawer(p2).locator('[data-person-actions-open]')).toHaveCount(0);
    await expect(drawer(p2).locator('[data-wiskey-person-edit]')).toHaveCount(0);
    expect(op.w.sent).toEqual([]);
    await p2.close();
  });
});

// ---------------------------------------------------------------- one write, how its answer reads

test.describe('a write is one request; its answer reads by what the server says', () => {
  test('switch off: one request with a fresh envelope, "נשמר" in the dialog and under the header, the list and the page read again', async ({ page }, info) => {
    desktopOnly(info);
    const { st, w } = world();
    await open(page, st, w);
    await openPerson(page, 'p1');
    const pageReads = personHits(st, 'p1');
    const lists = listHits(st);
    await openActions(page);
    await choose(page, 'deactivate');
    await expect(page.locator(`${ACTIONS} [data-action-question]`)).toHaveText('להשבית את הגישה של דנה כהן?');
    expect(w.sent).toEqual([]); // nothing before the confirmation
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'saved');
    await expect(result(page)).toHaveText('נשמר · 13:00');
    const [one] = sentTo(w, '/active');
    expect(w.sent).toHaveLength(1);
    expect(one.method).toBe('POST');
    expect(one.body).toMatchObject({ active: false, revision: 1 });
    expect(one.body.client_request_id).toEqual(expect.any(String));
    expect(Date.parse(String(one.body.expires_at))).toBeGreaterThan(Date.parse(NOW));
    await expect.poll(() => personHits(st, 'p1')).toBeGreaterThan(pageReads);
    await expect.poll(() => listHits(st)).toBeGreaterThan(lists);
    await closeActions(page);
    await expect(drawer(page).locator('[data-person-result="saved"]')).toHaveText('נשמר · 13:00');
    await shot(page, info, 'drawer-result-saved');
    // on again: the menu now offers it, and the second command has its own id
    await openActions(page);
    await choose(page, 'activate');
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'saved');
    const ids = w.sent.map((s) => s.body.client_request_id);
    expect(new Set(ids).size).toBe(2);
    expect(sentTo(w, '/active')[1].body).toMatchObject({ active: true, revision: 2 });
  });

  test('not sent and refused say so by name; an unknown answer says "unknown", reads the page again and is never sent again', async ({ page }, info) => {
    desktopOnly(info);
    const { st, w } = world();
    await open(page, st, w);
    await openPerson(page, 'p1');
    w.failOnce.active = 'scope';
    await openActions(page);
    await choose(page, 'deactivate');
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'not_sent');
    await expect(result(page)).toHaveText('לא נשלח · האדם משויך גם לעמדה שאינה בניהולך');
    await shot(page, info, 'result-not-sent');
    await closeActions(page);
    w.failOnce.archive = 'refused';
    await openActions(page);
    await choose(page, 'archive');
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'refused');
    await expect(result(page)).toHaveText('לא בוצע · מצב הארכיון כבר השתנה');
    await shot(page, info, 'result-refused');
    await closeActions(page);
    w.failOnce.active = 'unknown';
    const reads = personHits(st, 'p1');
    await openActions(page);
    await choose(page, 'deactivate');
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'unknown');
    await expect(result(page)).toHaveText('לא ידוע אם בוצע · טענו מחדש לפני ניסיון נוסף');
    await expect(result(page)).not.toContainText('נשמר');
    await shot(page, info, 'result-unknown');
    await expect.poll(() => personHits(st, 'p1')).toBeGreaterThan(reads); // a read is always safe
    await page.waitForTimeout(3500);
    expect(sentTo(w, '/active')).toHaveLength(2); // the scope refusal and the unknown one - each once, nothing again by itself
    await plainCopy(page.locator(ACTIONS));
  });

  test('a dropped connection is "unknown", never success', async ({ page }, info) => {
    desktopOnly(info);
    const { st, w } = world();
    await open(page, st, w);
    await openPerson(page, 'p2');
    w.failOnce.active = 'network';
    await openActions(page);
    await choose(page, 'deactivate');
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'unknown');
    expect(sentTo(w, '/active')).toHaveLength(1);
  });

  test('a delete is sent and PENDING until the person\'s page is gone; then the person leaves the list', async ({ page }, info) => {
    desktopOnly(info);
    test.setTimeout(60_000);
    const { st, w } = world();
    w.deleteLag = 1;
    await open(page, st, w);
    await openPerson(page, 'p9');
    await openActions(page);
    await choose(page, 'delete');
    await expect(page.locator(`${ACTIONS} [data-action-question]`)).toHaveText('למחוק את שירה מזרחי? ההסרה מהעמדות מתוזמנת.');
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'pending');
    await expect(result(page)).toHaveText('נשלח · ממתין לאישור');
    await expect(dialog(page)).toHaveAttribute('data-person-actions-step', 'checking');
    await shot(page, info, 'delete-pending');
    expect(sentTo(w, '/delete')).toHaveLength(1);
    expect(sentTo(w, '/delete')[0].body).toMatchObject({ revision: 1, confirmed: true });
    // the read model still finds the person once, then no more: "האדם הוסר", the page closes, the list no longer has them
    await expect(page.locator(`${SCREEN} [data-wiskey-people-notice="ok"]`)).toHaveText(/האדם הוסר/, { timeout: 20_000 });
    await expect(drawer(page).locator('sw-drawer[open]')).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-person-row="p9"]`)).toHaveCount(0);
    expect(sentTo(w, '/delete')).toHaveLength(1);
  });

  test('a pending delete is still watched after the dialog is closed', async ({ page }, info) => {
    desktopOnly(info);
    test.setTimeout(60_000);
    const { st, w } = world();
    w.deleteLag = 2;
    await open(page, st, w);
    await openPerson(page, 'p9');
    await openActions(page);
    await choose(page, 'delete');
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'pending');
    await closeActions(page);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-notice="warn"]`)).toHaveText(/נשלח · ממתין לאישור/);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-notice="ok"]`)).toHaveText(/האדם הוסר/, { timeout: 25_000 });
  });
});

// ---------------------------------------------------------------- the other actions

test.describe('the other actions', () => {
  test('end a visitor\'s access: the reason travels with it', async ({ page }, info) => {
    desktopOnly(info);
    const { st, w } = world();
    await open(page, st, w);
    await openPerson(page, 'p8');
    await openActions(page);
    await choose(page, 'temporary_cancel');
    await expect(page.locator(`${ACTIONS} [data-action-question]`)).toHaveText('לסיים עכשיו את הגישה של תומר אדר?');
    await page.locator(`${ACTIONS} select[data-action-reason]`).selectOption('visit_cancelled');
    await shot(page, info, 'temporary-cancel');
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'saved');
    expect(sentTo(w, '/temporary-cancel')[0].body).toMatchObject({ reason_code: 'visit_cancelled', confirmed: true, revision: 1 });
  });

  test('archive, then restore from the archive view (restored switched off)', async ({ page }, info) => {
    desktopOnly(info);
    const { st, w } = world();
    await open(page, st, w);
    await openPerson(page, 'p2');
    await openActions(page);
    await choose(page, 'archive');
    await expect(page.locator(`${ACTIONS} [data-action-question]`)).toHaveText('להעביר את יוסי לוי לארכיון? הגישה תושבת.');
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'saved');
    await closeActions(page);
    await page.keyboard.press('Escape');
    await expect(page.locator(`${SCREEN} [data-person-row="p2"]`)).toHaveCount(0); // the list is read again: not among the current people
    await page.locator(`${SCREEN} select[data-wiskey-people-filter="state"]`).selectOption('archived');
    await openPerson(page, 'p2');
    await openActions(page);
    expect(await menu(page)).toContain('restore');
    await choose(page, 'restore');
    await page.locator(`${ACTIONS} [data-action-confirm]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'saved');
    expect(sentTo(w, '/unarchive')[0].body).toMatchObject({ confirmed: true, revision: 2 });
    expect(st.people.find((p) => p.id === 'p2')).toMatchObject({ archived: false, active: false });
  });

  test('the cards: one by number in (masked back, the typed number gone), a taken number refused by name, one out behind a question', async ({ page }, info) => {
    desktopOnly(info);
    const { st, w } = world();
    await open(page, st, w);
    await openPerson(page, 'p1');
    await openActions(page);
    await choose(page, 'cards');
    const cards = page.locator(`${ACTIONS} [data-person-cards] [data-person-card]`);
    await expect(cards).toHaveCount(1);
    await expect(page.locator(`${ACTIONS} [data-card-read]`)).toBeVisible(); // the caller may read one at a station of their chain
    await page.locator(`${ACTIONS} [data-card-number]`).fill('bad number!');
    await page.locator(`${ACTIONS} [data-card-add]`).click();
    await expect(page.locator(`${ACTIONS} [data-card-number]`)).toHaveAttribute('aria-invalid', 'true');
    expect(w.sent).toEqual([]); // refused before it leaves the browser
    await page.locator(`${ACTIONS} [data-card-number]`).fill('QX7731ZK');
    await page.locator(`${ACTIONS} [data-card-label]`).fill('תג חניון');
    await shot(page, info, 'cards-typed');
    await page.locator(`${ACTIONS} [data-card-add]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'saved');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(1)).toContainText('•••• 31ZK');
    await expect(page.locator(`${ACTIONS} [data-card-number]`)).toHaveValue('');
    expect(await domHolds(page, 'QX7731ZK')).toBe(false);
    expect(sentTo(w, '/cards')[0].body).toMatchObject({ card_no: 'QX7731ZK', label: 'תג חניון', enabled: true, revision: 1 });
    await shot(page, info, 'cards-added');
    await page.locator(`${ACTIONS} [data-card-number]`).fill(TAKEN_CARD);
    await page.locator(`${ACTIONS} [data-card-add]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'refused');
    await expect(result(page)).toHaveText('לא בוצע · הכרטיס משויך לאדם אחר');
    const added = cards.nth(1);
    await added.locator('[data-card-remove]').click();
    await expect(added).toContainText('להסיר את הכרטיס •••• 31ZK?');
    await shot(page, info, 'cards-remove-ask');
    await added.locator('[data-card-remove-confirm]').click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'saved');
    await expect(cards).toHaveCount(1);
    const removal = w.sent.find((s) => s.path.endsWith('/remove'))!;
    expect(removal.body).toMatchObject({ confirmed: true, revision: 2 });
    expect(removal.path).toMatch(/^intercom\/people\/p1\/cards\/card-p1-n\d+\/remove$/);
    await plainCopy(page.locator(ACTIONS));
  });

  test('the photo: a large picture becomes a JPEG within the budget before it leaves the browser; removing asks first', async ({ page }, info) => {
    desktopOnly(info);
    const { st, w } = world();
    await open(page, st, w);
    await openPerson(page, 'p2');
    await openActions(page);
    await choose(page, 'photo');
    await expect(page.locator(`${ACTIONS} [data-photo-save]`)).toHaveAttribute('disabled', '');
    // not a picture
    await page.locator(`${ACTIONS} [data-photo-input]`).setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.locator(`${ACTIONS} [data-photo-problem]`)).toHaveAttribute('data-photo-problem', 'photo.not_image');
    // a 2400 x 1600 picture drawn in the page
    await page.locator(`${ACTIONS} [data-photo-input]`).evaluate(async (input: HTMLInputElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = 2400;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 0, 2400, 1600);
      g.addColorStop(0, 'rgb(40, 90, 160)');
      g.addColorStop(1, 'rgb(230, 200, 120)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 2400, 1600);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgb(${(i * 53) % 255}, ${(i * 97) % 255}, ${(i * 31) % 255})`;
        ctx.beginPath();
        ctx.arc((i * 211) % 2400, (i * 137) % 1600, 60 + (i % 7) * 25, 0, Math.PI * 2);
        ctx.fill();
      }
      const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'big.png', { type: 'image/png' }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.locator(`${ACTIONS} [data-photo-preview]`)).toBeVisible({ timeout: 15_000 });
    await shot(page, info, 'photo-ready');
    await page.locator(`${ACTIONS} [data-photo-save]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'saved');
    const [put] = sentTo(w, '/photo');
    expect(put.method).toBe('PUT');
    const photo = String(put.body.photo);
    expect(photo.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(photo.length).toBeLessThanOrEqual(44_000);
    const frame = jpeg(photo);
    expect(frame.bytes).toBeLessThanOrEqual(32_768);
    expect(Math.max(frame.width, frame.height)).toBeLessThanOrEqual(512);
    expect(frame.width / frame.height).toBeCloseTo(1.5, 1); // the aspect kept
    expect(put.body).toMatchObject({ sync_now: true, revision: 1 });
    // the photo is set now: removing it asks first
    await page.locator(`${ACTIONS} [data-photo-remove]`).click();
    await expect(page.locator(`${ACTIONS} [data-person-photo-form]`)).toContainText('להסיר את התמונה של יוסי לוי?');
    await page.locator(`${ACTIONS} [data-photo-remove-confirm]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'saved');
    expect(sentTo(w, '/photo')[1].body).toMatchObject({ photo: null, revision: 2 });
  });

  test('the photo switched off meanwhile is refused by name; a small JPEG goes through as it is', async ({ page }, info) => {
    desktopOnly(info);
    const { st, w } = world();
    await open(page, st, w);
    await openPerson(page, 'p5');
    await openActions(page);
    await choose(page, 'photo');
    const small = JSON.parse(readFileSync(path.resolve(HERE, '../../smplwise_vms/backend/tests/fixtures/wiskey_rc37/users_photo_get.json'), 'utf8')) as { photo: string };
    await page.locator(`${ACTIONS} [data-photo-input]`).setInputFiles({ name: 'face.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(small.photo.split(',')[1], 'base64') });
    await expect(page.locator(`${ACTIONS} [data-photo-preview]`)).toBeVisible();
    w.failOnce.photo = 'photo_disabled';
    await page.locator(`${ACTIONS} [data-photo-save]`).click();
    await expect(result(page)).toHaveAttribute('data-action-result', 'refused');
    await expect(result(page)).toHaveText('לא בוצע · תמונות אינן מופעלות');
    expect(jpeg(String(sentTo(w, '/photo')[0].body.photo)).width).toBe(16);
  });
});

// ---------------------------------------------------------------- the editor's new parts

test.describe('the editor: the access category, the timing, the field level, the PIN', () => {
  async function openEditor(page: Page, id: string): Promise<void> {
    await openPerson(page, id);
    await drawer(page).locator('[data-wiskey-person-edit]').click();
    await expect(editor(page).locator('[data-wiskey-editor-mode="edit"]')).toBeVisible({ timeout: 15_000 });
    await expect(field(page, 'name')).toBeVisible();
  }

  test('a contractor needs a responsible person; the weekly timing is sent once, in WisKey\'s normal form', async ({ page }, info) => {
    desktopOnly(info);
    const { st, w } = world();
    await open(page, st, w);
    await openEditor(page, 'p2');
    await field(page, 'category').selectOption('contractor');
    await expect(field(page, 'responsible')).toBeVisible();
    await field(page, 'timing-select').selectOption('weekly');
    await expect(field(page, 'timing-days')).toBeVisible();
    await editor(page).locator('[data-timing-day="Thursday"]').check();
    await editor(page).locator('[data-timing-day="Sunday"]').check();
    await field(page, 'save').click();
    await expect(field(page, 'error')).toHaveAttribute('data-wiskey-editor-error-code', 'err.guest');
    expect(sentTo(w, 'people/p2')).toHaveLength(0); // refused before it leaves the browser
    await field(page, 'responsible').fill('רונית גל');
    await field(page, 'purpose').fill('שיפוץ הלובי');
    await editor(page).locator('[data-timing-period="0"] [data-timing-start]').fill('07:30');
    await shot(page, info, 'editor-category-timing');
    await field(page, 'save').click();
    await expect(editor(page)).toHaveCount(0, { timeout: 15_000 });
    const [put] = sentTo(w, 'people/p2');
    expect(put.method).toBe('PUT');
    const data = put.body.data as Record<string, unknown>;
    expect(data).toMatchObject({
      access_category: 'contractor', responsible_person: 'רונית גל', access_purpose: 'שיפוץ הלובי',
      access_timing_draft: { mode: 'weekly', timezone: 'Asia/Jerusalem', days: ['Thursday', 'Sunday'], dates: [], periods: [{ start: '07:30', end: '17:00' }] },
      access_timing_policy: null,
    });
    expect(put.body.revision).toBe(1);
    await expect(page.locator(`${SCREEN} [data-wiskey-people-notice="ok"]`)).toHaveText(/נשמר · 13:00/);
  });

  test('a device-enforced timing is shown, not edited, and a save leaves it out', async ({ page }, info) => {
    desktopOnly(info);
    const { st, w } = world();
    await open(page, st, w);
    await openEditor(page, 'p1'); // p1's weekdays are enforced by the stations themselves
    await expect(field(page, 'timing-native')).toBeVisible();
    await expect(field(page, 'timing-select')).toHaveCount(0);
    await shot(page, info, 'editor-timing-native');
    await field(page, 'name').fill('דנה כהן-לוי');
    await field(page, 'save').click();
    await expect(editor(page)).toHaveCount(0, { timeout: 15_000 });
    const data = sentTo(w, 'people/p1')[0].body.data as Record<string, unknown>;
    expect(data.display_name).toBe('דנה כהן-לוי');
    expect('access_timing_draft' in data || 'access_timing_policy' in data).toBe(false);
    expect('access_category' in data).toBe(false); // unchanged: not sent
  });

  test('PIN generation is offered only with its own permission; the value is shown once and is gone once hidden', async ({ page }, info) => {
    desktopOnly(info);
    const { st, w } = world();
    w.pinGenerate = false;
    await open(page, st, w);
    await openEditor(page, 'p1');
    await expect(field(page, 'pin')).toBeVisible();
    await expect(field(page, 'pin-generate')).toHaveCount(0);
    await field(page, 'cancel').click();
    await expect(editor(page)).toHaveCount(0);
    w.pinGenerate = true;
    await expect(drawer(page).locator('sw-drawer[open]')).toBeVisible(); // closing the editor brings the person's page back
    await drawer(page).locator('[data-wiskey-person-edit]').click();
    await expect(field(page, 'name')).toBeVisible({ timeout: 15_000 });
    await field(page, 'pin-generate').click();
    await expect(field(page, 'pin-reveal-value')).toHaveText(PIN_SENTINEL);
    await shot(page, info, 'editor-pin-once');
    await field(page, 'pin-hide').click();
    await expect(field(page, 'pin-reveal')).toHaveCount(0);
    expect(await page.locator(EDITOR).evaluate((el, pin) => (el.shadowRoot?.textContent ?? '').includes(pin), PIN_SENTINEL)).toBe(false);
    expect(sentTo(w, 'pin-generate')).toHaveLength(1);
    expect(sentTo(w, 'pin-generate')[0].body).toEqual({ user_id: 'p1' });
  });

  test('a names-level manager: actions without cards and photo; an editor without the sensitive fields, whose save sends none of them', async ({ page }, info) => {
    desktopOnly(info);
    const st = newMock('operator');
    const w = newWrites();
    w.manager = true;
    await open(page, st, w);
    await openPerson(page, 'p1');
    await openActions(page);
    expect(await menu(page)).toEqual(['deactivate', 'archive', 'delete']);
    await shot(page, info, 'names-manager-menu');
    await closeActions(page);
    await drawer(page).locator('[data-wiskey-person-edit]').click();
    await expect(field(page, 'name')).toBeVisible({ timeout: 15_000 });
    for (const hidden of ['phone', 'pin', 'pin-generate', 'card-add', 'responsible', 'capture']) await expect(field(page, hidden), hidden).toHaveCount(0);
    await field(page, 'category').selectOption('visitor');
    await expect(field(page, 'responsible')).toHaveCount(0); // a sensitive field: not shown at this level
    await field(page, 'category').selectOption('staff');
    await field(page, 'name').fill('דנה כ.');
    await shot(page, info, 'names-manager-editor');
    await field(page, 'save').click();
    await expect(editor(page)).toHaveCount(0, { timeout: 15_000 });
    const data = sentTo(w, 'people/p1')[0].body.data as Record<string, unknown>;
    expect(data.display_name).toBe('דנה כ.');
    for (const k of ['phone', 'pin', 'cards', 'responsible_person', 'access_purpose']) expect(k in data, k).toBe(false);
  });
});
