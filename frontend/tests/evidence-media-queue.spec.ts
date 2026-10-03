import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN, fresh, install, open } from './media-players-harness';
import { inPageCheck, summarize, type Finding } from './layout-guard';

// CR-016 phase 2b evidence (docs/changes/CR-016-MEDIA-PLAYERS.md section 17.8): the FULL queue in the player panel (drag to reorder, play next, delete,
// clear with one question, locked rows, read-only without media.queue, "לא זמין" when the read fails), the "ספרייה" tab (types, search, play / next /
// add) and the settings' direct connection card - DEMO MODE (the in-memory mock; the panel parts on the Vite DEV server so the spec reaches the app's own
// mock store) and the mocked backend harness for the settings.
//   npx vite --host 127.0.0.1 --port 4561   then   SW_BASE_URL=http://127.0.0.1:4561/ SW_SHOTS=../docs/design/evidence/CR-016/2b npx playwright test evidence-media-queue --project=desktop
const SHOTS = process.env.SW_SHOTS ?? '';
const PM_URL = '/src/api/media-players-mock.ts';
const STUB = fileURLToPath(new URL('./fixtures/media-player-card-stub.js', import.meta.url));
const SIZES = [
  { w: 1440, h: 900 },
  { w: 820, h: 1180 },
  { w: 390, h: 844 },
] as const;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function shots(page: Page, name: string, widths: readonly number[] = [1440, 820, 390]) {
  for (const s of SIZES) {
    if (!widths.includes(s.w)) continue;
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(350);
    await shot(page, `${name}-${s.w}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function stage(page: Page, scheme: 'light' | 'dark' = 'light') {
  await page.goto('./');
  await page.waitForFunction(() => !!customElements.get('media-player-panel') && !!customElements.get('sw-drawer'));
  await page.addScriptTag({ path: STUB });
  await page.evaluate(
    async ([sch, url]) => {
      const mod = await import(/* @vite-ignore */ url);
      const m = mod.resetPlayersMock('ma');
      m.enablePhase2b();
      delete m.grp.liv; // the living-room speaker plays on its own
      document.querySelectorAll('#pn-stage').forEach((e) => e.remove());
      const st = document.createElement('div');
      st.id = 'pn-stage';
      st.style.cssText = `position:fixed;inset:0;z-index:50;overflow:auto;padding:24px;background:${
        sch === 'dark'
          ? 'radial-gradient(1200px 600px at 80% -10%,rgba(255,184,86,.22),transparent 60%),radial-gradient(900px 500px at 10% 110%,rgba(10,132,255,.25),transparent 60%),#0a0a0c'
          : 'radial-gradient(1100px 560px at 85% -12%,rgba(255,184,86,.2),transparent 60%),radial-gradient(900px 520px at 8% 112%,rgba(10,132,255,.16),transparent 60%),linear-gradient(180deg,#eef2f9,#e5eaf4)'
      }`;
      document.body.appendChild(st);
    },
    [scheme, PM_URL] as const,
  );
}

async function withMock<T>(page: Page, fn: (m: any) => T | Promise<T>): Promise<T> {
  return page.evaluate(
    async ([url, src]) => {
      const mod = await import(/* @vite-ignore */ url);
      // eslint-disable-next-line no-new-func
      return new Function('m', `return (${src})(m)`)(mod.playersMock());
    },
    [PM_URL, fn.toString()] as const,
  );
}

async function openPanel(page: Page, key: string, scheme: 'light' | 'dark' = 'light') {
  await page.evaluate(([k, sch]) => {
    const st = document.querySelector('#pn-stage')!;
    st.querySelectorAll('media-player-panel').forEach((e) => e.remove());
    const el = document.createElement('media-player-panel') as HTMLElement & { deviceKey: string; open: boolean; scheme: string };
    el.scheme = sch;
    el.deviceKey = k;
    el.open = true;
    st.appendChild(el);
  }, [key, scheme] as const);
  await page.locator('media-player-panel [data-pn-state]:not([data-pn-state="loading"])').first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(450);
}

const q = (page: Page, sel: string): Locator => page.locator('#pn-stage media-player-panel').locator(sel);
const names = (page: Page) => q(page, 'media-queue-list [data-qx-row] .t b').allInnerTexts();
const scrollTo = async (loc: Locator) => {
  await loc.first().scrollIntoViewIfNeeded();
  await loc.page().waitForTimeout(200);
};

async function noOverflow(page: Page) {
  const w = await page.evaluate(() => {
    const p = document.querySelector('#pn-stage media-player-panel') as HTMLElement | null;
    const r = p?.shadowRoot?.querySelector('sw-drawer')?.shadowRoot?.querySelector('.body') as HTMLElement | null;
    return r ? { sw: r.scrollWidth, cw: r.clientWidth } : null;
  });
  expect(w).not.toBeNull();
  expect(w!.sw).toBeLessThanOrEqual(w!.cw + 1);
}

test.describe.configure({ mode: 'serial' });

test.describe('phase 2b: the full queue in the player panel', () => {
  test('the full list replaces the short block: current row first, locked rows without handles, the rest with handle / next / delete', async ({ page }) => {
    await stage(page);
    await openPanel(page, 'mp-liv');
    const list = q(page, 'media-queue-list [data-pn-upnext="queue"]');
    await expect(list).toBeVisible();
    await expect(q(page, '[data-pn-upnext="rows"]')).toHaveCount(0); // the 0.1.150 block is gone, nothing else moved
    const locked = q(page, 'media-queue-list [data-qx-row][data-qx-locked="true"]');
    await expect(locked).toHaveCount(2);
    await expect(locked.locator('[data-qx-grip]')).toHaveCount(0);
    await expect(q(page, 'media-queue-list [data-qx-row][data-qx-locked="false"]').first().locator('[data-qx-grip]')).toHaveCount(1);
    await expect(q(page, 'media-queue-list [data-qx-clear]')).toBeVisible();
    await scrollTo(list);
    await shots(page, 'queue-light');
    await noOverflow(page);
    // no infrastructure name, no hint paragraph on the operator screen
    const text = await q(page, 'media-queue-list').evaluate((el) => (el.shadowRoot?.textContent ?? ''));
    expect(text).not.toMatch(/Home Assistant|Music Assistant|תשתית/);
  });

  test('dark at 1440 / 820 / 390', async ({ page }) => {
    await stage(page, 'dark');
    await openPanel(page, 'mp-liv', 'dark');
    await scrollTo(q(page, 'media-queue-list [data-pn-upnext="queue"]'));
    await shots(page, 'queue-dark');
  });

  test('drag a row up: one move, the row lands where it was dropped, never in the locked zone', async ({ page }) => {
    await stage(page);
    await openPanel(page, 'mp-liv');
    await scrollTo(q(page, 'media-queue-list [data-pn-upnext="queue"]'));
    const before = await names(page);
    const rows = q(page, 'media-queue-list [data-qx-row]');
    const from = rows.nth(5);
    const to = rows.nth(2);
    const g = await from.locator('[data-qx-grip]').boundingBox();
    const t = await to.boundingBox();
    await page.mouse.move(g!.x + g!.width / 2, g!.y + g!.height / 2);
    await page.mouse.down();
    await page.mouse.move(g!.x + g!.width / 2, t!.y + t!.height / 2, { steps: 8 });
    await shot(page, 'queue-dragging-1440');
    await page.mouse.up();
    await page.waitForTimeout(400);
    const after = await names(page);
    expect(after[2]).toBe(before[5]);
    expect(after.slice(0, 2)).toEqual(before.slice(0, 2)); // the locked rows did not move
    // a drop onto a locked row lands right after the locked zone
    const g2 = await rows.nth(6).locator('[data-qx-grip]').boundingBox();
    const t2 = await rows.nth(0).boundingBox();
    const moved = after[6];
    await page.mouse.move(g2!.x + g2!.width / 2, g2!.y + g2!.height / 2);
    await page.mouse.down();
    await page.mouse.move(g2!.x + g2!.width / 2, t2!.y + 4, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect((await names(page))[2]).toBe(moved);
  });

  test('keyboard: ArrowUp on a handle moves the row by one', async ({ page }) => {
    await stage(page);
    await openPanel(page, 'mp-liv');
    const before = await names(page);
    await q(page, 'media-queue-list [data-qx-row]').nth(4).locator('[data-qx-grip]').focus();
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    const after = await names(page);
    expect(after[3]).toBe(before[4]);
    expect(after[4]).toBe(before[3]);
  });

  test('play next, delete, and "נקה תור" asks once', async ({ page }) => {
    await stage(page);
    await openPanel(page, 'mp-liv');
    const rows = q(page, 'media-queue-list [data-qx-row]');
    const before = await names(page);
    await rows.nth(7).locator('[data-qx-next]').click();
    await page.waitForTimeout(400);
    expect((await names(page))[2]).toBe(before[7]);
    const n = await rows.count();
    await rows.nth(3).locator('[data-qx-delete]').click();
    await page.waitForTimeout(400);
    await expect(rows).toHaveCount(n - 1);
    await q(page, 'media-queue-list [data-qx-clear]').click();
    await expect(q(page, 'media-queue-list [data-qx-ask]')).toBeVisible();
    await expect(q(page, 'media-queue-list [data-qx-ask]')).toContainText('לנקות');
    await scrollTo(q(page, 'media-queue-list [data-qx-ask]'));
    await shots(page, 'queue-clear-ask', [1440, 390]);
    await q(page, 'media-queue-list [data-qx-clear-upcoming]').click();
    await page.waitForTimeout(400);
    await expect(q(page, 'media-queue-list [data-qx-row][data-qx-locked="false"]')).toHaveCount(0);
    await expect(q(page, 'media-queue-list [data-qx-row][data-qx-locked="true"]')).toHaveCount(2); // the current song and the buffered one stay
  });

  test('tapping a row plays it now; the current row is not a button; a buffered row can be played', async ({ page }) => {
    await stage(page);
    await openPanel(page, 'mp-liv');
    const rows = q(page, 'media-queue-list [data-qx-row]');
    await expect(rows.nth(0).locator('[data-qx-play]')).toHaveCount(0);
    await expect(rows.nth(1).locator('[data-qx-play]')).toHaveCount(1);
    const before = await names(page);
    await rows.nth(5).locator('[data-qx-play]').click();
    await page.waitForTimeout(500);
    const after = await names(page);
    expect(after[0]).toBe(before[5]); // the list starts at the new current row
    await expect(rows.nth(0).locator('[data-qx-play]')).toHaveCount(0);
  });

  test('"בחר": tick several rows, one question, one removal; locked rows cannot be ticked', async ({ page }) => {
    await stage(page);
    await openPanel(page, 'mp-liv');
    const rows = q(page, 'media-queue-list [data-qx-row]');
    const n = await rows.count();
    const before = await names(page);
    await q(page, 'media-queue-list [data-qx-select]').click();
    await expect(rows.locator('[data-qx-grip]')).toHaveCount(0); // no per-row actions while selecting
    await expect(rows.nth(0).locator('[data-qx-pick]')).toHaveCount(0);
    await expect(q(page, 'media-queue-list [data-qx-remove-sel]')).toBeDisabled();
    for (const i of [3, 5, 6]) await rows.nth(i).locator('[data-qx-pick]').click();
    await expect(q(page, 'media-queue-list [data-qx-sel-count]')).toHaveText('3 נבחרו');
    await expect(rows.nth(3).locator('[data-qx-pick]')).toHaveAttribute('aria-checked', 'true');
    await rows.nth(5).locator('[data-qx-pick]').click(); // untick
    await expect(q(page, 'media-queue-list [data-qx-sel-count]')).toHaveText('2 נבחרו');
    await scrollTo(q(page, 'media-queue-list [data-pn-upnext="queue"]'));
    await shots(page, 'queue-select', [1440, 390]);
    await noOverflow(page);
    await q(page, 'media-queue-list [data-qx-remove-sel]').click();
    await expect(q(page, 'media-queue-list [data-qx-ask="remove"]')).toContainText('להסיר 2 שירים');
    await shots(page, 'queue-remove-ask', [1440, 390]);
    await q(page, 'media-queue-list [data-qx-remove-yes]').click();
    await page.waitForTimeout(500);
    await expect(rows).toHaveCount(n - 2);
    const after = await names(page);
    expect(after).not.toContain(before[3]);
    expect(after).not.toContain(before[6]);
    expect(after).toContain(before[5]);
    await expect(q(page, 'media-queue-list [data-qx-select]')).toBeVisible(); // back to the normal header
  });

  test('"נקה תור" asks which clear: the upcoming songs (the current continues) or everything (stops); cancel changes nothing', async ({ page }) => {
    await stage(page);
    await openPanel(page, 'mp-liv');
    const rows = q(page, 'media-queue-list [data-qx-row]');
    const n = await rows.count();
    await q(page, 'media-queue-list [data-qx-clear]').click();
    const ask = q(page, 'media-queue-list [data-qx-ask="clear"]');
    await expect(ask).toContainText('לנקות את התור?');
    await expect(ask.locator('[data-qx-clear-upcoming]')).toContainText('השיר הנוכחי ממשיך');
    await expect(ask.locator('[data-qx-clear-all]')).toContainText('הניגון ייעצר');
    await ask.locator('[data-qx-ask-no]').click();
    await expect(ask).toHaveCount(0);
    await expect(rows).toHaveCount(n);
    await scrollTo(q(page, 'media-queue-list [data-qx-clear]'));
    await q(page, 'media-queue-list [data-qx-clear]').click();
    await q(page, 'media-queue-list [data-qx-clear-all]').click();
    await page.waitForTimeout(500);
    await expect(q(page, 'media-queue-list [data-qx-empty]')).toBeVisible();
    await expect(q(page, 'media-queue-list [data-qx-clear]')).toHaveCount(0);
    await expect(q(page, 'media-queue-list [data-qx-select]')).toHaveCount(0);
  });

  test('the dialogs and select mode fit at phone width in the dark scheme', async ({ page }) => {
    await stage(page, 'dark');
    await openPanel(page, 'mp-liv', 'dark');
    await q(page, 'media-queue-list [data-qx-clear]').click();
    await scrollTo(q(page, 'media-queue-list [data-qx-ask]'));
    await shots(page, 'queue-clear-ask-dark', [1440, 820, 390]);
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    await q(page, 'media-queue-list [data-qx-ask-no]').click();
    await q(page, 'media-queue-list [data-qx-select]').click();
    await q(page, 'media-queue-list [data-qx-row]').nth(4).locator('[data-qx-pick]').click();
    await scrollTo(q(page, 'media-queue-list [data-pn-upnext="queue"]'));
    await shots(page, 'queue-select-dark', [1440, 820, 390]);
    await noOverflow(page);
  });

  // the layout guard (tests/layout-guard.ts) over the queue block in its states: normal, select mode, both questions - phone / tablet / desktop x light / dark
  for (const scheme of ['light', 'dark'] as const) {
    test(`layout guard: the queue block, its select mode and its two questions [${scheme}]`, async ({ page }) => {
      await stage(page, scheme);
      await openPanel(page, 'mp-liv', scheme);
      const findings: Finding[] = [];
      const run = async (ctx: string) => {
        await page.waitForTimeout(250);
        findings.push(...(await page.evaluate(inPageCheck, { ctx, bubble: '.row.qrow, .ask, .uq, .tap, .opt', skip: '.skl, .grip', roots: [] })));
      };
      for (const w of [320, 390, 820, 1440]) {
        await page.setViewportSize({ width: w, height: w <= 480 ? 844 : 1000 });
        await scrollTo(q(page, 'media-queue-list [data-pn-upnext="queue"]'));
        await run(`${scheme} ${w} normal`);
        await q(page, 'media-queue-list [data-qx-clear]').click();
        await run(`${scheme} ${w} clear-ask`);
        await q(page, 'media-queue-list [data-qx-ask-no]').click();
        await q(page, 'media-queue-list [data-qx-select]').click();
        await q(page, 'media-queue-list [data-qx-row]').nth(4).locator('[data-qx-pick]').click();
        await run(`${scheme} ${w} select`);
        await q(page, 'media-queue-list [data-qx-remove-sel]').click();
        await run(`${scheme} ${w} remove-ask`);
        await q(page, 'media-queue-list [data-qx-ask-no]').click();
        await q(page, 'media-queue-list [data-qx-select-cancel]').click();
      }
      // only what the queue block owns (the rest of the panel is outside this change)
      const mine = findings.filter((f) => /qrow|tap|\bask\b|\bopt\b|\bqb\b|\blnk\b|\byes\b|\bno\b|hacts|data-qx/.test(f.el));
      const { lines } = summarize(mine);
      expect(lines, 'layout findings in the queue block').toEqual([]);
    });
  }

  test('the selection is capped at 25 (the server caps it too)', async ({ page }) => {
    await page.goto('./');
    const out = await page.evaluate(async (url) => {
      const m = await import(/* @vite-ignore */ url);
      let sel: string[] = [];
      for (let i = 0; i < 40; i++) sel = m.toggleSelected(sel, `i${i}`);
      return { n: sel.length, max: m.QUEUE_SELECT_MAX, off: m.toggleSelected(['a', 'b'], 'a') };
    }, '/src/api/media-players.ts');
    expect(out).toEqual({ n: 25, max: 25, off: ['b'] });
  });

  test('without media.queue the list is read-only; a failed read is "לא זמין", never an empty queue', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => void (m.canQueue = false));
    await openPanel(page, 'mp-liv');
    await expect(q(page, 'media-queue-list [data-qx-row]').first()).toBeVisible();
    await expect(q(page, 'media-queue-list [data-qx-grip]')).toHaveCount(0);
    await expect(q(page, 'media-queue-list [data-qx-delete]')).toHaveCount(0);
    await expect(q(page, 'media-queue-list [data-qx-clear]')).toHaveCount(0);
    await expect(q(page, 'media-queue-list [data-qx-select]')).toHaveCount(0);
    await expect(q(page, 'media-queue-list [data-qx-play]')).toHaveCount(0);
    await scrollTo(q(page, 'media-queue-list [data-pn-upnext="queue"]'));
    await shots(page, 'queue-readonly', [1440, 390]);
    await stage(page);
    await withMock(page, (m) => void (m.failQueue = true));
    await openPanel(page, 'mp-liv');
    await expect(q(page, 'media-queue-list [data-pn-upnext="unavailable"]')).toContainText('לא זמין');
    await scrollTo(q(page, 'media-queue-list [data-pn-upnext="unavailable"]'));
    await shots(page, 'queue-unavailable', [1440, 390]);
  });

  test('without the direct connection the panel keeps the 0.1.150 block', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => void (m.ma.state = 'unreachable'));
    await openPanel(page, 'mp-liv');
    await expect(q(page, 'media-queue-list')).toHaveCount(0);
    await expect(q(page, '[data-pn-upnext="rows"]')).toBeVisible();
    await expect(q(page, 'media-library-browse [data-lb-search]')).toHaveCount(0);
  });
});

test.describe('phase 2b: the library tab', () => {
  test('"ספרייה": the types, search, a tap plays, the "+" adds to the queue', async ({ page }) => {
    await stage(page);
    await openPanel(page, 'mp-liv');
    await q(page, `[data-pn-libtab="library"]`).click();
    const lib = q(page, 'media-library-browse');
    await expect(lib.locator('[data-lb-type]')).toHaveCount(5);
    await expect(lib.locator('[data-lb="track"] [data-lb-item]')).toHaveCount(4);
    await lib.locator('[data-lb-type="album"]').click();
    await expect(lib.locator('[data-lb="album"] [data-lb-item]')).toHaveCount(3);
    await scrollTo(lib);
    await shots(page, 'library-light');
    await lib.locator('[data-lb-type="track"]').click();
    await lib.locator('[data-lb-search] input').fill('blue');
    await expect(lib.locator('[data-lb="track"] [data-lb-item]')).toHaveCount(2);
    await shots(page, 'library-search', [1440, 390]);
    await lib.locator('[data-lb-add]').first().click();
    await page.waitForTimeout(1300); // play_item: one a second per device (CR §6.4); the item that was added is pending until the state confirms
    await lib.locator('[data-lb-item]').nth(1).click();
    await page.waitForTimeout(300);
    const sent = await withMock(page, (m) => m.sent.filter((x: any) => x.command.command === 'play_item').map((x: any) => x.command.enqueue ?? 'play'));
    expect(sent).toEqual(['add', 'play']);
    await lib.locator('[data-lb-search] input').fill('zzzz');
    await expect(lib.locator('[data-lb="empty"]')).toHaveText('לא נמצאו פריטים');
  });

  test('dark at 1440 / 820 / 390', async ({ page }) => {
    await stage(page, 'dark');
    await openPanel(page, 'mp-liv', 'dark');
    await q(page, `[data-pn-libtab="library"]`).click();
    await scrollTo(q(page, 'media-library-browse'));
    await shots(page, 'library-dark');
  });

  test('without media.browse there is no library tab; without the connection there is no search box', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => void (m.canBrowse = false));
    await openPanel(page, 'mp-liv');
    await expect(q(page, '[data-pn-libtab="library"]')).toHaveCount(0);
    await expect(q(page, '[data-pn-libtab]')).toHaveCount(3);
    await stage(page);
    await withMock(page, (m) => void (m.ma.state = 'off'));
    await openPanel(page, 'mp-liv');
    await q(page, `[data-pn-libtab="library"]`).click();
    await expect(q(page, 'media-library-browse [data-lb-item]').first()).toBeVisible();
    await expect(q(page, 'media-library-browse [data-lb-search]')).toHaveCount(0);
  });
});

test.describe('phase 2b: settings › מולטימדיה › חיבור (mocked backend)', () => {
  // the settings screens have no dark scheme yet (only the devices area and the media panels do): light only
  for (const scheme of ['light'] as const) {
    test(`set the address and the token, test the connection (${scheme})`, async ({ page }) => {
      const st = fresh(ADMIN);
      st.scheme = scheme;
      await page.emulateMedia({ colorScheme: scheme });
      await install(page, st);
      await open(page, '/system/multimedia');
      const c = page.locator('sw-app system-multimedia [data-mm-connection] media-ma-connection');
      await expect(c.locator('[data-mc-state]')).toHaveAttribute('data-mc-state', 'off');
      await c.locator('[data-mc-url]').fill('http://music.local:8095');
      await c.locator('[data-mc-url-save]').click();
      await c.locator('[data-mc-token-input]').fill('demo-token-0123456789abcdef');
      await c.locator('[data-mc-token-save]').click();
      await expect(c.locator('[data-mc-token]')).toContainText('הוגדר');
      await expect(c.locator('[data-mc-token-input]')).toHaveCount(0); // write-only: the token is never shown again
      await c.locator('sw-toggle[data-mc-enabled]').click();
      await expect(c.locator('[data-mc-state]')).toHaveAttribute('data-mc-state', 'ready');
      await c.locator('[data-mc-test-run]').click();
      await expect(c.locator('[data-mc-test]')).toContainText('סכמה 28');
      const puts = st.calls.filter((x) => x.path.startsWith('multimedia/admin/ma-connection') && x.method === 'PUT').map((x) => x.body);
      expect(puts).toEqual([{ url: 'http://music.local:8095' }, { token: 'demo-token-0123456789abcdef' }, { enabled: true }]);
      await c.scrollIntoViewIfNeeded();
      for (const w of [1440, 390]) {
        await page.setViewportSize({ width: w, height: w === 1440 ? 900 : 844 });
        await page.waitForTimeout(400);
        await c.scrollIntoViewIfNeeded();
        await shot(page, `settings-connection-${scheme}-${w}`);
      }
    });
  }
});
