import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AC_ADMIN, KEYHOLDER, installTrustMock, newTrustMock, openTrust, openUnknown, type TrustMock } from './bridge-trust-mocks';
import { settlePage } from './pixel-settle';

// CR-040 (WXROT) against the mocked backend (tests/bridge-trust-mocks.ts): Settings > בקרת כניסה > "מפתח הגשר". Nothing here reaches a Home
// Assistant, a bridge, a WisKey or a door, and no key, salt, proof or signature exists anywhere in the mock. What it pins:
//   - the segment: the key generation (the epoch the bridge owns), the bridge's support and its last confirmation, the results by name;
//   - one guarded action: the confirmation states the atomic switch, the pause and the UNKNOWN rule, and the button stays off until
//     "הבנתי" is ticked; the write is exactly {confirmed: true};
//   - an unknown outcome holds an open request with "בדיקת מצב" (never a second rotation); a bridge that accepts neither key asks for a
//     re-pair; a refusal says why; an old bridge disables the action and says what is needed;
//   - who sees it: a key holder who is not an access-control administrator sees this one segment; an administrator without the key
//     permission does not see it; the remote channel shows "local only" and asks nothing;
//   - the states: loading, empty, error (and retry), forbidden.
// Evidence screenshots (desktop 1440 and phone 390, Hebrew RTL): docs/design/evidence/WXROT/.
//   SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/evidence-bridge-trust.spec.ts --project=desktop --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'WXROT');
const SEG = 'system-access-trust';
const CARD = `${SEG} sw-card[data-trust-card]`;
const DIALOG = `${SEG} sw-dialog[data-trust-dialog]`;

async function boot(page: Page, m: TrustMock, o: { ready?: string | false; hash?: string } = {}): Promise<string[]> {
  await installTrustMock(page, m);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTrust(page, { hash: o.hash });
  if (o.ready !== false) await expect(page.locator(o.ready ?? CARD)).toBeVisible({ timeout: 30_000 });
  return errors;
}

/** The segment (or the whole window for a dialog) at the desktop width and at a phone's. */
async function shots(page: Page, info: TestInfo, name: string, target = SEG, settle = true) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  for (const [label, width, height] of [['desktop', 1440, 1200], ['mobile', 390, 1400]] as const) {
    await page.setViewportSize({ width, height });
    if (settle) await settlePage(page);
    const file = path.join(EVIDENCE, `${name}-${label}.png`);
    if (target === 'window') await page.screenshot({ path: file });
    else await page.locator(target).first().screenshot({ path: file });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  void info;
}

const text = (page: Page, sel: string) => page.locator(sel).first().innerText();

test.describe('CR-040: the bridge key segment in Settings', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project; the phone width is shot inside it and swept by the layout guard');
  });

  test('ready: the generation, the bridge and the results, by name, nothing secret', async ({ page }, info) => {
    const m = newTrustMock();
    const errors = await boot(page, m);
    await expect(page.locator('system-access-control sw-tabs[data-access-segments] a[href$="/trust"]')).toHaveText('מפתח הגשר');
    await expect(page.locator(`${SEG} [data-trust-fact="epoch"]`)).toContainText('דור 3');
    await expect(page.locator(`${SEG} [data-trust-fact="bridge"]`)).toContainText('גרסה 0.8.1 · תומך בהחלפת מפתח');
    await expect(page.locator(`${SEG} [data-trust-fact="seen"]`)).toHaveAttribute('data-tone', 'ok');
    const rows = page.locator(`${SEG} [data-trust-row]`);
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('הוחלף');
    await expect(rows.nth(0)).toContainText('יוני');
    await expect(rows.nth(0)).toContainText('מדור 2 לדור 3');
    await expect(rows.nth(1)).toHaveAttribute('data-state', 'not_rotated');
    await expect(rows.nth(1)).toContainText('הגשר לא הצליח לשמור');
    await expect(rows.nth(0).locator('[data-trust-ref]')).toHaveText('1a2b3c4d');
    const all = await text(page, SEG);
    for (const word of ['salt', 'proof', 'sig', 'nonce', 'key=', 'TEST-ONLY']) expect(all).not.toContain(word);
    await expect(page.locator(`${SEG} sw-button[data-trust-rotate]`)).not.toHaveAttribute('disabled', '');
    expect(m.posts).toEqual([]);
    await shots(page, info, 'trust-ready');
    expect(errors).toEqual([]);
  });

  test('rotate: a confirmation that states the switch, then exactly {confirmed: true}', async ({ page }, info) => {
    const m = newTrustMock();
    const errors = await boot(page, m);
    await page.locator(`${SEG} sw-button[data-trust-rotate]`).click();
    await expect(page.locator(DIALOG)).toHaveAttribute('open', '');
    const body = await text(page, DIALOG);
    expect(body).toContain('בבת אחת');
    expect(body).toContain('לדור 4');
    expect(body).toContain('לא תישלח שוב');
    expect(body).toContain('צימוד מחדש');
    const go = page.locator(`${DIALOG} sw-button[data-trust-go]`);
    await expect(go).toHaveAttribute('disabled', '');
    await shots(page, info, 'trust-confirm', 'window');
    await page.locator(`${DIALOG} input[data-trust-ack]`).check();
    await expect(go).not.toHaveAttribute('disabled', '');
    await go.click();
    await expect(page.locator(`${SEG} [data-trust-outcome="info"]`)).toContainText('המפתח הוחלף');
    await expect(page.locator(DIALOG)).toHaveCount(0);
    await expect(page.locator(`${SEG} [data-trust-fact="epoch"]`)).toContainText('דור 4');
    await expect(page.locator(`${SEG} [data-trust-row]`)).toHaveCount(4);
    expect(m.posts).toEqual([{ path: 'ha/bridge/trust/rotations', body: { confirmed: true } }]);
    await shots(page, info, 'trust-rotated');
    expect(errors).toEqual([]);
  });

  test('cancel sends nothing', async ({ page }) => {
    const m = newTrustMock();
    await boot(page, m);
    await page.locator(`${SEG} sw-button[data-trust-rotate]`).click();
    await page.locator(`${DIALOG} input[data-trust-ack]`).check();
    await page.locator(`${DIALOG} sw-button[data-trust-cancel]`).click();
    await expect(page.locator(DIALOG)).toHaveCount(0);
    expect(m.posts).toEqual([]);
  });

  test('unknown: the open request holds and is resolved by a status check, never by a second rotation', async ({ page }, info) => {
    const m = newTrustMock({ next: 'unknown' });
    const errors = await boot(page, m);
    await page.locator(`${SEG} sw-button[data-trust-rotate]`).click();
    await page.locator(`${DIALOG} input[data-trust-ack]`).check();
    await page.locator(`${DIALOG} sw-button[data-trust-go]`).click();
    await expect(page.locator(`${SEG} [data-trust-open="unknown"]`)).toContainText('לא ידוע אם המפתח הוחלף');
    await expect(page.locator(`${SEG} [data-trust-outcome="stale"]`)).toContainText('לא התקבלה תשובה');
    await expect(page.locator(`${SEG} sw-button[data-trust-rotate]`)).toHaveAttribute('disabled', '');
    await shots(page, info, 'trust-unknown');
    await page.locator(`${SEG} sw-button[data-trust-check]`).click();
    await expect(page.locator(`${SEG} [data-trust-open]`)).toHaveCount(0);
    await expect(page.locator(`${SEG} [data-trust-fact="epoch"]`)).toContainText('דור 4');
    await expect(page.locator(`${SEG} [data-trust-row]`).first()).toContainText('בדיקת המצב אישרה');
    expect(m.posts.map((p) => p.path)).toEqual(['ha/bridge/trust/rotations', expect.stringMatching(/\/check$/)]);
    expect(errors).toEqual([]);
  });

  test('a bridge that accepts neither key asks for a re-pair; a refusal says why', async ({ page }, info) => {
    const m = newTrustMock({ history: [...newTrustMock().history, openUnknown('neither_key')] });
    await boot(page, m);
    await expect(page.locator(`${SEG} [data-trust-open="neither"]`)).toContainText('נדרש צימוד מחדש');
    await expect(page.locator(`${SEG} sw-button[data-trust-check]`)).toHaveCount(0);
    await shots(page, info, 'trust-neither');
    const r = newTrustMock({ next: 'not_rotated' });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, r);
    await page.locator(`${SEG} sw-button[data-trust-rotate]`).click();
    await page.locator(`${DIALOG} input[data-trust-ack]`).check();
    await page.locator(`${DIALOG} sw-button[data-trust-go]`).click();
    await expect(page.locator(`${SEG} [data-trust-outcome="err"]`)).toContainText('המפתח לא הוחלף');
    await expect(page.locator(`${SEG} [data-trust-outcome="err"]`)).toContainText('הגשר בדור אחר');
  });

  test('an old bridge: the action is off and the reason says what is needed', async ({ page }, info) => {
    const m = newTrustMock({ version: '0.8.0', supported: false, epochSeen: null });
    await boot(page, m);
    await expect(page.locator(`${SEG} sw-button[data-trust-rotate]`)).toHaveAttribute('disabled', '');
    await expect(page.locator(`${SEG} [data-trust-blocked="unsupported"]`)).toHaveText('מותקנת גרסה 0.8.0; נדרשת 0.8.1 לפחות');
    await expect(page.locator(`${SEG} [data-trust-fact="seen"]`)).toContainText('עוד לא התקבל דיווח מהגשר');
    await shots(page, info, 'trust-unsupported');
  });

  test('empty, loading, error with retry, forbidden', async ({ page }, info) => {
    const empty = newTrustMock({ history: [], epoch: 1, epochSeen: 1 });
    await boot(page, empty);
    await expect(page.locator(`${SEG} [data-trust-empty]`)).toHaveText('עדיין לא הוחלף מפתח');
    await shots(page, info, 'trust-empty');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, newTrustMock({ getDelay: 4000 }), { ready: `${SEG} [data-trust-state="loading"]` });
    await shots(page, info, 'trust-loading', SEG, false);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const broken = newTrustMock({ getStatus: 500 });
    await boot(page, broken, { ready: `${SEG} [data-trust-state="error"]` });
    await shots(page, info, 'trust-error');
    broken.getStatus = null;
    await page.locator(`${SEG} sw-state-panel`).locator('sw-button, button').first().click();
    await expect(page.locator(CARD)).toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, newTrustMock({ perms: KEYHOLDER, getStatus: 403 }), { ready: `${SEG} [data-trust-state="forbidden"]` });
    await shots(page, info, 'trust-forbidden');
  });

  test('who sees it: a key holder sees only this segment; an administrator without the key does not', async ({ page }, info) => {
    const keyholder = newTrustMock({ perms: KEYHOLDER });
    await boot(page, keyholder);
    await expect(page.locator('system-access-control sw-tabs[data-access-segments]')).toHaveCount(0);
    await expect(page.locator('system-access-control [data-access-segment="trust"]')).toBeVisible();
    await expect(page.locator('system-access-status')).toHaveCount(0);
    await expect(page.locator('sw-app sw-tabs:not([data-access-segments]) a[href="#/system/access-control"]')).toHaveCount(1);
    await shots(page, info, 'trust-keyholder', 'window');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const acAdmin = newTrustMock({ perms: AC_ADMIN });
    await boot(page, acAdmin, { ready: 'system-access-control [data-access-segment]' });
    await expect(page.locator('system-access-control sw-tabs[data-access-segments] a[href$="/trust"]')).toHaveCount(0);
    await expect(page.locator(SEG)).toHaveCount(0);
    expect(acAdmin.gets).toBe(0);
  });

  test('the remote channel: local only, nothing asked', async ({ page }, info) => {
    const m = newTrustMock({ channel: 'remote' });
    await boot(page, m, { ready: `${SEG} [data-trust-state="local_only"]` });
    await expect(page.locator(`${SEG} sw-state-panel`)).toHaveAttribute('heading', 'זמין רק מהרשת המקומית');
    expect(m.gets).toBe(0);
    await shots(page, info, 'trust-local-only');
  });
});
