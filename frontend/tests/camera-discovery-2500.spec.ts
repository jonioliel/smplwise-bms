import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ADMIN, GOOD, OPERATOR, OTHER, installDiscovery, newDiscoveryMock, openApp, type DiscoveryMock } from './camera-discovery-mocks';

// ONVIF-UI-2500: "חיפוש מצלמות ברשת" on the NVR settings page (הגדרות › אבטחה › NVR › מצלמות ללא מקליט) against a MOCKED backend
// (tests/camera-discovery-mocks.ts - routers/camera_discovery.py's shapes; no device, NVR or go2rtc). Desktop 1440 and phone 390:
//   - only system.configure sees the button; the setting off shows a note instead;
//   - scan: the suggested range and the 1,024 cap, a too-large range refused before sending, live progress, stop (DELETE), resume of a
//     running scan, nothing found -> the three reasons and add by hand;
//   - identify: kinds, behind-the-recorder / already-added rows not selectable (Q58), "add as a recorder" opens the recorder form with
//     the address (Q59), one user / password, "same for all" required for several, one attempt (Q57): a refused pair is never resent,
//     the row's retry needs a new password, the lockout stop is shown;
//   - add: the suggested streams, a preview through the preview form (no address in the request), names / areas, per-camera results;
//   - no scrolling inside the dialog at any step, no sideways page scroll; axe-core (critical / serious) on every step when available.
//   npm run build, then SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/camera-discovery-2500.spec.ts --project=desktop --project=mobile
// axe-core: not a dependency of this branch (A11Y-AUDIT-2490 adds it); SW_AXE_PATH=<axe.min.js> runs it, else the axe check is skipped
// (the structural a11y checks below still run).

const NVR = '/system/security/nvr';
const AXE_SRC = (() => {
  try {
    const file = process.env.SW_AXE_PATH || createRequire(import.meta.url).resolve('axe-core/axe.min.js');
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
})();
const SHOTS = process.env.SW_ONVIF_SHOTS ?? '';
// SW_SCHEME=dark runs every test (and every capture) in the dark scheme; the captures get the scheme in their name
const SCHEME = process.env.SW_SCHEME === 'dark' ? 'dark' : 'light';
test.use({ colorScheme: SCHEME });

async function shot(page: Page, info: TestInfo, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(SHOTS, `after-${name}-${info.project.name}${SCHEME === 'dark' ? '-dark' : ''}.png`) });
}

const dialog = (page: Page) => page.locator('camera-discovery-dialog sw-dialog[data-camera-discovery]');

/** Page through the list (the rows per page follow the viewport) until the device's row is shown. */
async function showRow(page: Page, id: string) {
  const row = page.locator(`[data-discovery-device="${id}"]`);
  const prev = page.locator('[data-discovery-pager] [data-pager-prev]');
  const next = page.locator('[data-discovery-pager] [data-pager-next]');
  while ((await prev.count()) && (await prev.isEnabled())) await prev.click();
  while (!(await row.count()) && (await next.count()) && (await next.isEnabled())) await next.click();
  await expect(row).toBeVisible();
  return row;
}

async function openWizard(page: Page, m: DiscoveryMock) {
  await installDiscovery(page, m);
  await openApp(page, NVR);
  await page.locator('[data-discovery-open]').click();
  await expect(dialog(page)).toBeAttached({ timeout: 20_000 });
}

/** The dialog's body never scrolls and the page never scrolls sideways (owner rule: control screens never scroll). */
async function noScroll(page: Page, where: string) {
  const f = await page.evaluate(() => {
    const deep = (root: Document | ShadowRoot, sel: string): Element | null => {
      const hit = root.querySelector(sel);
      if (hit) return hit;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as HTMLElement).shadowRoot;
        const found = sr ? deep(sr, sel) : null;
        if (found) return found;
      }
      return null;
    };
    const host = deep(document, 'camera-discovery-dialog')?.shadowRoot?.querySelector('sw-dialog[data-camera-discovery]');
    const body = host?.shadowRoot?.querySelector('.body') as HTMLElement | null;
    return {
      body: body ? { sh: body.scrollHeight, ch: body.clientHeight, sw: body.scrollWidth, cw: body.clientWidth } : null,
      pageX: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  expect(f.body, `${where}: dialog body`).not.toBeNull();
  expect(f.body!.sh, `${where}: the dialog body scrolls (${JSON.stringify(f.body)})`).toBeLessThanOrEqual(f.body!.ch + 2);
  expect(f.body!.sw, `${where}: the dialog body scrolls sideways`).toBeLessThanOrEqual(f.body!.cw + 2);
  expect(f.pageX, `${where}: the page scrolls sideways`).toBe(false);
}

/** axe-core over the whole document (open shadow roots included); only critical / serious findings fail. */
async function axe(page: Page, where: string, info: TestInfo) {
  if (!AXE_SRC) {
    info.annotations.push({ type: 'axe', description: `${where}: NOT_RUN (axe-core not installed; set SW_AXE_PATH)` });
    return;
  }
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ content: AXE_SRC });
  // RELEASE-2520-TRAIN: sw-dialog fades in (@starting-style opacity 0 -> 1); axe's colour-contrast run right after the open measured
  // half-faded text (intermittent "color-contrast" on every muted text of the wizard). Wait for the finite animations / transitions of
  // the document (shadow trees included) to finish first; the infinite scan spinner is skipped.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const found = await page.evaluate(async () => {
    const w = window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: { id: string; impact: string; nodes: { target: unknown }[] }[] }> } };
    // the whole document (axe walks the open shadow roots); a finding counts when its node is inside the wizard
    const r = await w.axe.run(document, { resultTypes: ['violations'] });
    const out: { mine: string[]; page: string[] } = { mine: [], page: [] };
    for (const v of r.violations.filter((x) => x.impact === 'critical' || x.impact === 'serious')) {
      for (const n of v.nodes) {
        const t = JSON.stringify(n.target);
        (t.includes('camera-discovery-dialog') ? out.mine : out.page).push(`${v.id}: ${t}`);
      }
    }
    return out;
  });
  info.annotations.push({ type: 'axe', description: `${where}: wizard ${found.mine.length}, rest of the page ${found.page.length} critical/serious` });
  if (found.page.length) info.annotations.push({ type: 'axe-page', description: found.page.slice(0, 10).join(' | ') });
  console.log(`[axe] ${where}: wizard ${found.mine.length}, page ${found.page.length}${found.page.length ? ' - ' + found.page.slice(0, 4).join(' | ') : ''}`);
  expect(found.mine, `${where}: axe`).toEqual([]);
}

test.describe('ONVIF-UI-2500 camera discovery', () => {
  test('only system.configure sees the search; the setting off shows a note instead', async ({ page }) => {
    const op = newDiscoveryMock({ perms: OPERATOR });
    await installDiscovery(page, op);
    await openApp(page, NVR);
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-discovery-open]')).toHaveCount(0);
    expect(op.hits.filter((h) => h.includes('cameras/discovery'))).toEqual([]); // not even asked

    const off = newDiscoveryMock({ enabled: false });
    await page.unrouteAll();
    await installDiscovery(page, off);
    await openApp(page, NVR);
    await expect(page.locator('[data-discovery-off]')).toBeVisible();
    await expect(page.locator('[data-discovery-open]')).toHaveCount(0);
    await expect(page.locator('[data-standalone-add]')).toBeVisible(); // adding by hand stays
  });

  test('the whole flow: scan, identify with one password, add with names and areas', async ({ page }, info) => {
    const m = newDiscoveryMock({ perms: ADMIN, pollsToDone: 3, addRefuse: { 'd-22': 'source_not_allowed' } });
    await installDiscovery(page, m);
    await openApp(page, NVR);
    await expect(page.locator('[data-discovery-open]')).toBeVisible();
    await page.locator('[data-discovery-open]').click();
    const d = dialog(page);
    await expect(d).toBeAttached({ timeout: 20_000 }); // the wizard is a lazy chunk: the first open on a busy PC is slow

    // step 1: the suggested range, the cap explained, a too-large range refused before anything is sent
    const range = page.locator('[data-discovery-range]');
    await expect(range).toHaveValue('192.0.2.0/24');
    await expect(page.locator('[data-discovery-cap]')).toContainText('1,024');
    await expect(page.locator('[data-discovery-range-check]')).toContainText('256');
    await shot(page, info, 'scan-setup');
    await noScroll(page, 'scan setup');
    await axe(page, 'scan setup', info);
    await range.fill('10.0.0.0/21');
    await expect(page.locator('[data-discovery-range-check="bad"]')).toContainText('2,048');
    await expect(page.locator('[data-discovery-start]')).toHaveAttribute('disabled', '');
    await range.fill('192.0.2.0/24');
    await page.locator('[data-discovery-start]').click();

    // running: progress with checked / total, the found list grows, then step 2 on its own
    await expect(d).toHaveAttribute('data-phase', 'running');
    const bar = page.locator('[data-discovery-progress]');
    await expect(bar).toHaveAttribute('role', 'progressbar');
    await expect(page.locator('[data-discovery-checked]')).toContainText('254');
    await shot(page, info, 'scan-running');
    await noScroll(page, 'scan running');
    await axe(page, 'scan running', info);
    await expect(d).toHaveAttribute('data-camera-discovery', 'identify', { timeout: 10_000 });

    // step 2: kinds and marks; behind the recorder / already added / recorder not selectable
    await expect(page.locator('[data-discovery-found-line]')).toContainText('11');
    const row = (id: string) => page.locator(`[data-discovery-device="${id}"]`);
    await expect(row('d-21')).toHaveAttribute('data-kind', 'camera');
    await expect(row('d-10')).toHaveAttribute('data-kind', 'recorder');
    await expect(row('d-21').locator('[data-discovery-select]')).toBeChecked();
    await expect(row('d-10').locator('[data-discovery-select]')).toBeDisabled();
    await shot(page, info, 'identify');
    await noScroll(page, 'identify page 1');
    await axe(page, 'identify page 1', info);

    // Q59: "add as a recorder" opens the recorder form with the device's address (never a credential)
    await row('d-10').locator('[data-discovery-as-recorder]').click();
    const rec = page.locator('[data-discovery-recorder-dialog]');
    await expect(rec).toBeAttached();
    await expect(rec.locator('[data-conn-name]')).toHaveValue('NVR');
    await expect(rec.locator('input[data-conn-field="host"]')).toHaveValue('192.0.2.10');
    await expect(rec.locator('input[data-conn-field="http_port"]')).toHaveValue('80');
    await expect(rec.locator('[data-conn-password]')).toHaveValue(''); // never a credential
    await shot(page, info, 'recorder-prefill');
    await page.keyboard.press('Escape');
    await expect(rec).toHaveCount(0);

    // Q58 on a later page: behind the recorder and already added are marked and not selectable
    await showRow(page, 'd-31');
    await expect(row('d-31').locator('[data-discovery-select]')).toBeDisabled();
    await expect(row('d-31').locator('[data-chip="mark"]')).toBeVisible();
    await noScroll(page, 'identify later page');
    await showRow(page, 'd-30');
    await expect(row('d-30').locator('[data-discovery-select]')).toBeDisabled();
    await showRow(page, 'd-21');

    // one user / password; several ticked need "same for all"
    await page.locator('[data-discovery-user]').fill('viewer');
    await page.locator('[data-discovery-password]').fill(GOOD);
    // DESIGN-LITERALS-2510: "same for all" is the compact switch (sw-toggle reflects `checked`); a press flips it
    const same = page.locator('[data-discovery-same]');
    await expect(same).toHaveAttribute('checked', '');
    await same.click();
    await expect(same).not.toHaveAttribute('checked', '');
    await expect(page.locator('[data-discovery-block="same"]')).toBeVisible();
    await expect(page.locator('[data-discovery-identify]')).toHaveAttribute('disabled', '');
    await same.click();
    await expect(same).toHaveAttribute('checked', '');
    await page.locator('[data-discovery-identify]').click();
    await expect(row('d-21')).toHaveAttribute('data-auth', 'ok');
    const press = m.bodies.find((b) => b.route.endsWith('/identify'))!;
    expect(press.body.same_for_all).toBe(true);
    expect((press.body.device_ids as string[]).sort()).toEqual(['d-21', 'd-22', 'd-37', 'd-40', 'd-44', 'd-51', 'd-52', 'd-53']); // never a recorder or a known camera
    await showRow(page, 'd-40');
    await expect(row('d-40')).toHaveAttribute('data-auth', 'ok');
    await expect(row('d-40').locator('[data-discovery-row-manual]')).toBeVisible(); // identified, but no usable stream
    await showRow(page, 'd-37');
    await expect(row('d-37')).toHaveAttribute('data-auth', 'wrong_password');
    await expect(row('d-37')).toContainText('11'); // the clock is 11 minutes off: evidence, shown
    await shot(page, info, 'identify-results');
    await noScroll(page, 'identify results');
    await axe(page, 'identify results', info);
    await showRow(page, 'd-44');
    await expect(row('d-44')).toHaveAttribute('data-auth', 'locked_guard');
    await expect(row('d-44').locator('[data-discovery-row-try]')).toHaveCount(0); // the guard's stop: no retry at all
    await noScroll(page, 'identify results, later page');
    await showRow(page, 'd-37');

    // Q57: the refused pair is not resent - the bulk press has nothing left; the row's own retry needs a new password
    await expect(page.locator('[data-discovery-identify]')).toHaveAttribute('disabled', '');
    const tryBtn = row('d-37').locator('[data-discovery-row-try]');
    await expect(tryBtn).toHaveAttribute('disabled', '');
    await row('d-37').locator('[data-discovery-row-pw]').fill(GOOD);
    await expect(tryBtn).toHaveAttribute('disabled', ''); // the very pair it refused
    await row('d-37').locator('[data-discovery-row-pw]').fill(OTHER);
    await tryBtn.click();
    await expect(row('d-37')).toHaveAttribute('data-auth', 'ok');
    const retry = m.bodies.filter((b) => b.route.endsWith('/identify')).pop()!;
    expect(retry.body).toMatchObject({ device_ids: ['d-37'], same_for_all: false });
    expect(m.refused['d-37']).toHaveLength(1); // one wrong attempt only, ever

    // step 3: 6 ready (d-21, d-22, d-37, d-51..53; d-40 has no usable stream, d-44 is stopped)
    await expect(page.locator('[data-discovery-next]')).toContainText('6');
    await page.locator('[data-discovery-next]').click();
    await expect(d).toHaveAttribute('data-camera-discovery', 'add');
    await expect(page.locator('[data-discovery-name="d-21"]')).toHaveValue('Vantis DC-4K21 - 21');
    await expect(page.locator('[data-discovery-h265]').first()).toBeVisible(); // its main is H.265
    await page.locator('[data-discovery-preview="d-21"]').click();
    await expect(page.locator('[data-discovery-add-row="d-21"] [data-discovery-thumb="ok"] img')).toBeVisible();
    const pv = m.bodies.filter((b) => b.route === 'POST cameras/source/test').pop()!;
    expect(pv.body).toEqual({ scan_id: 'scan-1', device_id: 'd-21', profile: 'sub', profile_token: 'm2' });
    await page.locator('[data-discovery-name="d-21"]').fill('חניה צפונית');
    await page.locator('[data-discovery-area="d-21"]').selectOption('parking');
    await shot(page, info, 'add');
    await noScroll(page, 'add');
    await axe(page, 'add', info);
    await page.locator('[data-discovery-add]').click();

    // the result per camera: 5 added, d-22 refused with its reason
    await expect(page.locator('[data-discovery-result="warn"]')).toContainText('5');
    const add = m.bodies.find((b) => b.route.endsWith('/add'))!;
    const cams = add.body.cameras as Record<string, unknown>[];
    expect(cams).toHaveLength(6);
    expect(cams.find((c) => c.device_id === 'd-21')).toEqual({ device_id: 'd-21', name: 'חניה צפונית', area_id: 'parking', main_profile: 'm0', sub_profile: 'm2' });
    await expect(page.locator('[data-discovery-result-row="d-22"][data-ok="false"]')).toBeVisible();
    await shot(page, info, 'result');
    await noScroll(page, 'result');
    await axe(page, 'result', info);
    // no request ever carried an address with a password, and no answer the screens read had one
    expect(JSON.stringify(m.bodies)).not.toMatch(/rtsp:\/\/[^/]*@/);
    await page.locator('[data-discovery-finish]').click();
    await expect(dialog(page)).toHaveCount(0);
    expect(m.hits).toContain('DELETE cameras/discovery/scans/scan-1'); // closing forgets the scan's credentials
    await expect(page.locator('[data-standalone-camera="cam-new-d-21"]')).toBeVisible(); // the card's list followed
  });

  test('stop a running scan; resume one that already runs; nothing found', async ({ page }, info) => {
    const m = newDiscoveryMock({ pollsToDone: 60 });
    await openWizard(page, m);
    await page.locator('[data-discovery-start]').click();
    await expect(dialog(page)).toHaveAttribute('data-phase', 'running');
    await page.locator('[data-discovery-stop]').click();
    await expect(dialog(page)).toHaveAttribute('data-phase', 'setup');
    expect(m.hits).toContain('DELETE cameras/discovery/scans/scan-1');
    await expect(page.locator('[data-discovery-msg]')).toBeVisible();

    // a scan started in another tab: the start answers 409 and the wizard follows that scan
    m.runningElsewhere = true;
    await page.locator('[data-discovery-start]').click();
    await expect(dialog(page)).toHaveAttribute('data-phase', 'running');
    await expect(page.locator('[data-discovery-msg]')).toBeVisible();
    await page.locator('[data-discovery-stop]').click();

    // nothing found: the three reasons, another range, add by hand (opens the manual dialog)
    m.empty = true;
    m.pollsToDone = 1;
    await page.locator('[data-discovery-start]').click();
    await expect(page.locator('[data-discovery-none]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-discovery-none] li')).toHaveCount(3);
    await shot(page, info, 'scan-none');
    await noScroll(page, 'none');
    await axe(page, 'none', info);
    await page.locator('[data-discovery-manual]').click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator('[data-camera-source-dialog="add"]')).toBeAttached();
    await expect(page.locator('[data-source-name]')).toBeVisible();
  });

  test('security review: the wizard removed while open forgets the typed pair (the scan job too)', async ({ page }) => {
    const m = newDiscoveryMock({ pollsToDone: 1 });
    await openWizard(page, m);
    await page.locator('[data-discovery-start]').click();
    await expect(dialog(page)).toHaveAttribute('data-camera-discovery', 'identify', { timeout: 10_000 });
    await page.locator('[data-discovery-password]').fill('invented-pass');
    const gone = await page.evaluate(() => {
      const deep = (root: Document | ShadowRoot): Element | null => {
        const hit = root.querySelector('camera-discovery-dialog');
        if (hit) return hit;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as HTMLElement).shadowRoot;
          const found = sr ? deep(sr) : null;
          if (found) return found;
        }
        return null;
      };
      const el = deep(document) as (HTMLElement & { password?: string }) | null;
      if (!el) return null;
      el.remove(); // a route change while the wizard is open
      return { password: (el as unknown as { password: string }).password };
    });
    expect(gone, 'the wizard element').not.toBeNull();
    expect(gone!.password, 'the typed password is dropped on removal').toBe('');
    await expect.poll(() => m.hits.includes('DELETE cameras/discovery/scans/scan-1')).toBe(true); // the job forgets the pair
  });

  test('a refused range says why, in words', async ({ page }) => {
    const m = newDiscoveryMock();
    await openWizard(page, m);
    await page.locator('[data-discovery-range]').fill('192.0.2.0/23');
    await page.locator('[data-discovery-start]').click();
    await expect(page.locator('[data-discovery-msg]')).toHaveAttribute('role', 'alert');
    await expect(page.locator('[data-discovery-msg]')).not.toContainText('range_refused');
    await expect(dialog(page)).toHaveAttribute('data-phase', 'setup');
  });
});
