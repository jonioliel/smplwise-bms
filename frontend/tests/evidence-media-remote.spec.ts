import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// CR-015 S3 evidence: the remote (components/media-remote.ts), its editor, the area card and the home widget, in DEMO MODE
// (no backend: the client answers from its in-memory MOCK adapter, docs/architecture/MEDIA_API.md §4) plus one API-mode spec
// that serves the very same mock through fake HTTP routes (the real `httpAdapter`, the real devices-area.ts hook).
// The spec drives the app on the Vite DEV server so it can reach the very same mock store the app uses
// (`import(MOCK_URL)` inside the page):
//   npx vite --host 127.0.0.1 --port 4371   then   SW_BASE_URL=http://127.0.0.1:4371/ npx playwright test evidence-media-remote --project=desktop
// SW_SHOTS=<dir> saves the screenshots there (docs/design/evidence/CR-015/s3). One project only: the spec sets the three widths itself.
const SHOTS = process.env.SW_SHOTS ?? '';
const MOCK_URL = '/src/api/media-screens-mock.ts';
const EDIT_URL = '/src/shell/screen-edit.ts';
const HOME_CFG_URL = '/src/api/home-config.ts';
const SIZES = [
  { w: 1440, h: 900 },
  { w: 820, h: 1180 },
  { w: 390, h: 844 },
] as const;

type Sent = { key: string; command: Record<string, unknown> };

async function shot(page: Page, name: string, only?: readonly number[]) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  void only;
}

/** The same state at 1440 / 820 / 390. */
async function shots(page: Page, name: string) {
  for (const s of SIZES) {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(350);
    await shot(page, `${name}-${s.w}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

/** The app in demo mode with a glass stage behind the remote (what the screens page / area screen would be). */
async function stage(page: Page, opts: { scheme?: 'light' | 'dark' } = {}) {
  await page.goto('./');
  await page.waitForFunction(() => !!customElements.get('media-remote') && !!customElements.get('sw-drawer'));
  await page.evaluate(
    async ([scheme, url]) => {
      const mod = await import(/* @vite-ignore */ url);
      mod.resetMediaMock();
      document.querySelectorAll('#mr-stage').forEach((e) => e.remove());
      const st = document.createElement('div');
      st.id = 'mr-stage';
      const dark = scheme === 'dark';
      st.style.cssText = `position:fixed;inset:0;z-index:50;overflow:auto;padding:24px;background:${
        dark
          ? 'radial-gradient(1200px 600px at 80% -10%,rgba(255,184,86,.22),transparent 60%),radial-gradient(900px 500px at 10% 110%,rgba(10,132,255,.25),transparent 60%),#0a0a0c'
          : 'radial-gradient(1100px 560px at 85% -12%,rgba(255,184,86,.2),transparent 60%),radial-gradient(900px 520px at 8% 112%,rgba(10,132,255,.16),transparent 60%),linear-gradient(180deg,#eef2f9,#e5eaf4)'
      }`;
      document.body.appendChild(st);
    },
    [opts.scheme ?? 'light', MOCK_URL] as const,
  );
}

/** Runs `fn(mockStore)` in the page against the app's own mock store. */
async function withMock<T>(page: Page, fn: (m: any) => T | Promise<T>): Promise<T> {
  return page.evaluate(
    async ([url, src]) => {
      const mod = await import(/* @vite-ignore */ url);
      // eslint-disable-next-line no-new-func
      return new Function('m', `return (${src})(m)`)(mod.mediaMock());
    },
    [MOCK_URL, fn.toString()] as const,
  );
}

const sent = (page: Page): Promise<Sent[]> => withMock(page, (m) => m.sent.map((x: any) => ({ key: x.key, command: x.command })));

/** Opens a remote on the stage for a mock screen and waits for it to be drawn. */
async function openRemote(page: Page, key: string, scheme: 'light' | 'dark' = 'light') {
  await page.evaluate(([k, sch]) => {
    const st = document.querySelector('#mr-stage')!;
    st.querySelectorAll('media-remote').forEach((e) => e.remove());
    const el = document.createElement('media-remote') as HTMLElement & { deviceKey: string; open: boolean; scheme: string };
    el.scheme = sch;
    el.deviceKey = k;
    el.open = true;
    st.appendChild(el);
  }, [key, scheme] as const);
  await page.locator('media-remote [data-mr-state]:not([data-mr-state="loading"])').first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(250);
}

const R = (page: Page) => page.locator('#mr-stage media-remote');
const key = (page: Page, k: string): Locator => R(page).locator(`[data-key="${k}"]`).first();
const padBtn = (page: Page, k: string): Locator => R(page).locator('media-remote-pad').locator(`[data-k="${k}"]`);

test.describe.configure({ mode: 'serial' });

test.describe('the remote: states and profiles (demo mode)', () => {
  test('on: a Samsung-profile screen with a linked receiver - pad, rockers, recent, tabs; light at 1440 / 820 / 390', async ({ page }) => {
    await stage(page);
    await openRemote(page, 'md-living');
    await expect(R(page).locator('[data-mr-state="on"]')).toBeVisible();
    expect(await sent(page)).toEqual([]); // opening sends nothing
    await expect(R(page).locator('[data-mr-power="off"]')).toHaveCount(1);
    await expect(padBtn(page, 'up')).toBeVisible();
    await expect(R(page).locator('[data-mr-audio]')).toBeVisible();
    await expect(R(page).locator('[data-mr-recent-item]')).toHaveCount(3);
    await shots(page, 'remote-on-samsung-light');
  });

  test('on, dark: the same remote in the dark scheme at 1440 and 390', async ({ page }) => {
    await stage(page, { scheme: 'dark' });
    await openRemote(page, 'md-living', 'dark');
    await shots(page, 'remote-on-samsung-dark');
  });

  test('LG profile: source + channel, no text field; "עוד מקשים" opens numbers, colours and the extra keys', async ({ page }) => {
    await stage(page);
    await openRemote(page, 'md-kitchen');
    await expect(R(page).locator('[data-mr-rocker="ch"]')).toBeVisible();
    await shots(page, 'remote-on-lg-light');
    await R(page).locator('[data-mr-more]').click();
    await expect(R(page).locator('[data-mr-nums]')).toBeVisible();
    await expect(R(page).locator('[data-mr-colors]')).toBeVisible();
    await expect(R(page).locator('[data-mr-text]')).toHaveCount(0); // LG: no typing
    await R(page).locator('[data-mr-morebody]').scrollIntoViewIfNeeded();
    await page.setViewportSize({ width: 1440, height: 1500 });
    await page.waitForTimeout(300);
    await shot(page, 'remote-more-lg-light-1440');
    await page.setViewportSize({ width: 390, height: 1500 });
    await page.waitForTimeout(300);
    await shot(page, 'remote-more-lg-light-390');
  });

  test('Android profile: off = one big "הפעל" over a dimmed pad; turning on is an explicit tap; steps only (no slider); typing exists', async ({ page }) => {
    await stage(page, { scheme: 'dark' });
    await openRemote(page, 'md-parents', 'dark');
    await expect(R(page).locator('[data-mr-state="off"]')).toBeVisible();
    await expect(R(page).locator('[data-mr-off] [data-mr-power="on"]')).toBeEnabled();
    expect(await sent(page)).toEqual([]); // the remote never powers a screen on by itself
    await expect(R(page).locator('.rpad.dim')).toHaveAttribute('aria-hidden', 'true');
    await shots(page, 'remote-off-android-dark');
    await R(page).locator('[data-mr-off] [data-mr-power="on"]').click();
    await expect(R(page).locator('[data-mr-state="on"]')).toBeVisible({ timeout: 10_000 });
    expect((await sent(page)).map((s) => s.command.command)).toEqual(['power_on']);
    await expect(R(page).locator('[data-mr-vrow]')).toHaveCount(0); // Android Remote: steps only
    await R(page).locator('[data-mr-more]').click();
    await expect(R(page).locator('[data-mr-text]')).toBeVisible();
    await page.waitForTimeout(250);
    await shots(page, 'remote-on-android-dark');
  });

  test('generic profile: power, volume slider, sources and playback only - no pad, no keys', async ({ page }) => {
    await stage(page);
    await openRemote(page, 'md-kids');
    await expect(R(page).locator('media-remote-pad')).toHaveCount(0);
    await expect(R(page).locator('[data-key]')).toHaveCount(1); // the mute button of the slider row
    await shots(page, 'remote-generic-light');
  });

  test('art mode: turn off or switch to viewing; nothing else', async ({ page }) => {
    await stage(page);
    await openRemote(page, 'md-pergola');
    await expect(R(page).locator('[data-mr-art]')).toBeVisible();
    await expect(R(page).locator('[data-mr-art-watch]')).toBeEnabled();
    await shots(page, 'remote-art-light');
  });

  test('unavailable: "המסך לא זמין" and since when, nothing else', async ({ page }) => {
    await stage(page);
    await openRemote(page, 'md-gym');
    await expect(R(page).locator('[data-mr-unavailable]')).toContainText('המסך לא זמין');
    await expect(R(page).locator('[data-mr-unavailable] small')).toContainText('מאז');
    await expect(R(page).locator('[data-key], [data-mr-power], media-remote-pad')).toHaveCount(0);
    await shots(page, 'remote-unavailable-light');
  });

  test('no remote wake: power-on is disabled, the reason is its tooltip only, and a press sends nothing', async ({ page }) => {
    await stage(page);
    await openRemote(page, 'md-office');
    const p = R(page).locator('[data-mr-off] [data-mr-power="on"]');
    await expect(p).toBeDisabled();
    await expect(p).toHaveAttribute('title', 'אין הפעלה מרחוק');
    await p.click({ force: true });
    expect(await sent(page)).toEqual([]);
    await shots(page, 'remote-nowake-light');
  });

  test('view-only: the state is visible, no control exists', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => void (m.rows.find((r: any) => r.device.key === 'md-living').device.can = { control: false, power: false, public_ok: true, bulk: false }));
    await openRemote(page, 'md-living');
    await expect(R(page).locator('[data-mr-now]')).toBeVisible();
    await expect(R(page).locator('[data-key], [data-mr-power], media-remote-pad, [data-mr-tab], .rng')).toHaveCount(0);
    await shots(page, 'remote-viewonly-light');
  });
});

test.describe('the remote: sources, apps and the touchpad', () => {
  test('sources and apps tabs: a pick is pending until the state confirms, then checked and first in "אחרונים"', async ({ page }) => {
    await stage(page, { scheme: 'dark' });
    await openRemote(page, 'md-living', 'dark');
    await R(page).locator('[data-mr-tab="apps"]').click();
    await expect(R(page).locator('[data-mr-app]')).toHaveCount(8);
    await shots(page, 'remote-apps-dark');
    await R(page).locator('[data-mr-tab="sources"]').click();
    await expect(R(page).locator('[data-mr-source]')).toHaveCount(4);
    await R(page).locator('[data-mr-source="HDMI2"]').click();
    await expect(R(page).locator('[data-mr-source="HDMI2"]')).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    expect((await sent(page)).map((s) => s.command)).toEqual([{ command: 'source', source_id: 'HDMI2' }]); // the TV's own string, not the label
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await shot(page, 'remote-sources-dark-390');
  });

  test('touchpad: a swipe is an arrow, a tap is OK - only d-pad keys, never mirrored', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => {
      const d = m.rows.find((r: any) => r.device.key === 'md-living').device;
      d.remote.sections = d.remote.sections.map((s: any) => (s.id === 'touch' ? { ...s, on: true } : s));
    });
    await openRemote(page, 'md-living');
    await R(page).locator('[role="radio"]', { hasText: 'משטח' }).click();
    const tp = R(page).locator('media-remote-pad').locator('.tpad');
    await expect(tp).toBeVisible();
    await tp.scrollIntoViewIfNeeded(); // the phone's sheet scrolls: the pad may sit below the fold
    const b = (await tp.boundingBox())!;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy, { steps: 4 });
    await page.mouse.up(); // right
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 60, { steps: 4 });
    await page.mouse.up(); // up
    await page.mouse.click(cx, cy); // tap
    const keys = (await sent(page)).map((s) => (s.command as any).key);
    expect(keys).toEqual(['right', 'up', 'ok']);
    await shots(page, 'remote-touchpad-light');
  });
});

test.describe('the remote: every press goes through the gate', () => {
  test('hold-to-repeat: an arrow repeats every 200 ms while held and stops on release; OK does not repeat', async ({ page }) => {
    await stage(page);
    await openRemote(page, 'md-living');
    const up = padBtn(page, 'up');
    const b = (await up.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();
    const held = (await sent(page)).filter((s) => (s.command as any).key === 'up').length;
    expect(held).toBeGreaterThanOrEqual(4);
    expect(held).toBeLessThanOrEqual(8);
    await page.waitForTimeout(1000);
    expect((await sent(page)).filter((s) => (s.command as any).key === 'up')).toHaveLength(held); // released: no more
    const ok = padBtn(page, 'ok');
    const o = (await ok.boundingBox())!;
    await page.mouse.move(o.x + o.width / 2, o.y + o.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await page.mouse.up();
    expect((await sent(page)).filter((s) => (s.command as any).key === 'ok')).toHaveLength(1);
  });

  test('volume rocker: a step is a volume_step command (never a power key), repeats while held', async ({ page }) => {
    await stage(page);
    await openRemote(page, 'md-kitchen');
    const plus = key(page, 'volup');
    const b = (await plus.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1100);
    await page.mouse.up();
    const cmds = (await sent(page)).map((s) => s.command);
    expect(cmds.length).toBeGreaterThanOrEqual(3);
    expect(cmds.every((c) => c.command === 'volume_step' && c.direction === 'up')).toBe(true);
    expect(JSON.stringify(cmds)).not.toMatch(/power/i);
  });

  test('rate limit: a burst over 8 presses is dropped (a short shake, no text, nothing queued)', async ({ page }) => {
    await stage(page);
    await openRemote(page, 'md-living');
    await R(page).locator('[data-mr-pad]').evaluate((el) => {
      (window as any).__shakes = 0;
      new MutationObserver(() => el.classList.contains('shake') && (window as any).__shakes++).observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    const ok = padBtn(page, 'ok');
    const b = (await ok.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    const t0 = Date.now();
    for (let i = 0; i < 24; i++) {
      await page.mouse.down();
      await page.mouse.up();
    }
    const elapsed = (Date.now() - t0) / 1000;
    const n = (await sent(page)).filter((s) => (s.command as any).key === 'ok').length;
    expect(n).toBeGreaterThanOrEqual(8);
    // the burst (8) plus what the bucket (5/s) refilled while the clicks ran: the clicks' own speed depends on the machine's load
    expect(n).toBeLessThanOrEqual(8 + Math.ceil(elapsed * 5) + 1);
    expect(n).toBeLessThan(24); // and some presses were dropped
    await expect(R(page).locator('[data-mr-notice]')).toHaveCount(0); // rate-limited: no text
    expect(await page.evaluate(() => (window as any).__shakes)).toBeGreaterThan(0); // the short shake
    // the state, frozen mid-shake for the evidence (the real one lasts 260 ms)
    await R(page).locator('[data-mr-pad]').evaluate((el) => {
      el.classList.add('shake');
      (el as HTMLElement).style.animationPlayState = 'paused';
      (el as HTMLElement).style.animationDelay = '-70ms';
    });
    await shots(page, 'remote-ratelimited-light');
    await page.waitForTimeout(1500);
    expect((await sent(page)).filter((s) => (s.command as any).key === 'ok')).toHaveLength(n); // nothing was queued
  });

  test('keyboard: arrows, Enter, Backspace reach the screen; typing in the text field does not send keys; Enter there sends the text once', async ({ page }) => {
    await stage(page);
    await openRemote(page, 'md-living');
    await R(page).locator('[data-mr-now]').click(); // focus inside the remote (a click outside would close it)
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(150);
    expect((await sent(page)).map((s) => (s.command as any).key)).toEqual(['down', 'ok', 'back']);
    await R(page).locator('[data-mr-more]').click();
    const fld = R(page).locator('[data-mr-text] input');
    await fld.click();
    await fld.fill('');
    await page.keyboard.type('hello');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Backspace');
    expect((await sent(page)).length).toBe(3); // typing sent no key
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const last = (await sent(page)).at(-1)!;
    expect(last.command).toEqual({ command: 'text', text: 'hell' });
    await expect(fld).toHaveValue(''); // never pre-filled, cleared after sending
  });

  test('RTL: the d-pad is not mirrored (left stays left), the page is RTL, targets are at least 44 px', async ({ page }) => {
    await stage(page);
    await openRemote(page, 'md-living');
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    const l = (await padBtn(page, 'left').boundingBox())!;
    const r = (await padBtn(page, 'right').boundingBox())!;
    expect(l.x).toBeLessThan(r.x);
    const small = await R(page).evaluate((host) => {
      const out: string[] = [];
      const walk = (root: ParentNode) => {
        root.querySelectorAll('button, [role="radio"], [role="tab"], input[type="range"]').forEach((b) => {
          const rc = (b as HTMLElement).getBoundingClientRect();
          if (rc.width && rc.height && (rc.width < 44 || rc.height < 44)) out.push(`${(b as HTMLElement).dataset.key ?? (b as HTMLElement).className}:${Math.round(rc.width)}x${Math.round(rc.height)}`);
        });
        root.querySelectorAll('*').forEach((e) => (e as HTMLElement).shadowRoot && e.tagName !== 'SW-DRAWER' && walk((e as HTMLElement).shadowRoot!));
      };
      walk(host.shadowRoot!);
      return out;
    });
    // the drawer's own close button (inside sw-drawer's shadow) is the product's; everything the remote draws is 44 px or more
    expect(small.filter((s) => !/^$/.test(s))).toEqual([]);
  });

  test('focus: the keyboard focus ring is visible on the pad; reduced motion removes the spinner\'s movement', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stage(page);
    await openRemote(page, 'md-living');
    await page.keyboard.press('Tab');
    await padBtn(page, 'ok').focus();
    await page.waitForTimeout(150);
    await shot(page, 'remote-focus-ok-light-1440');
    const ring = await padBtn(page, 'ok').evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(ring).not.toBe('none');
    // pending ring animation is off under reduced motion
    await withMock(page, (m) => {
      const orig = m.command.bind(m);
      m.command = async (...a: any[]) => {
        await new Promise((r) => setTimeout(r, 1500));
        return orig(...a);
      };
    });
    await R(page).locator('[data-mr-power="off"]').click();
    const ringAnim = R(page).locator('.pendring').first();
    await expect(ringAnim).toBeVisible();
    expect(await ringAnim.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });
});

test.describe('the remote: pending and not confirmed', () => {
  test('pending: a power command shows a spinner until the screen confirms; the power button cannot be pressed twice', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => {
      const orig = m.command.bind(m);
      m.command = async (...a: any[]) => {
        await new Promise((r) => setTimeout(r, 2500));
        return orig(...a);
      };
    });
    await openRemote(page, 'md-living');
    const off = R(page).locator('[data-mr-power="off"]');
    await off.click();
    await expect(R(page).locator('.pendring').first()).toBeVisible();
    await expect(off).toBeDisabled();
    await shots(page, 'remote-pending-light');
    await expect(R(page).locator('[data-mr-state="off"]')).toBeVisible({ timeout: 10_000 });
    expect((await sent(page)).filter((s) => (s.command as any).command === 'power_off')).toHaveLength(1);
  });

  test('not confirmed: a command the screen never confirms ends after 8 s in "המסך לא אישר את הפקודה" on the last confirmed state', async ({ page }) => {
    test.setTimeout(60_000);
    await stage(page);
    await withMock(page, (m) => {
      // the screen accepts the command but never changes: the state stays as it was
      m.command = async (_key: string, body: any) => ({ command_id: body.client_request_id, status: 'accepted', action_id: null, confirm: 'state', error: null });
    });
    await openRemote(page, 'md-living');
    await R(page).locator('[data-mr-power="off"]').click();
    await expect(R(page).locator('.pendring').first()).toBeVisible();
    await expect(R(page).locator('[data-mr-notice]')).toHaveText('המסך לא אישר את הפקודה', { timeout: 14_000 });
    await expect(R(page).locator('[data-mr-state="on"]')).toBeVisible(); // back on the last confirmed state
    await expect(R(page).locator('[data-mr-power="off"]')).toBeEnabled();
    await shots(page, 'remote-notconfirmed-light');
  });

  test('refused by the server: the Hebrew reason shows and the state is re-read', async ({ page }) => {
    await stage(page);
    await openRemote(page, 'md-living');
    await withMock(page, (m) => {
      m.command = async () => {
        const { ApiError } = await import('/src/api/client.ts' as string);
        throw new ApiError(409, { code: 'power_pending', user_message: 'x', retryable: false, correlation_id: '', details: {} });
      };
    });
    await R(page).locator('[data-mr-power="off"]').click();
    await expect(R(page).locator('[data-mr-notice]')).toHaveText('פקודת הפעלה קודמת עדיין ממתינה');
  });
});

test.describe('the remote editor ("עריכת השלט")', () => {
  test('from the user menu registration: sections on / off / order / folded, sources renamed and hidden, saved per screen and as the default', async ({ page }) => {
    await stage(page);
    await openRemote(page, 'md-living');
    const run = () =>
      page.evaluate(async (url) => {
        const m = await import(/* @vite-ignore */ url);
        const a = m.screenEdits().find((x: { id: string }) => x.id === 'multimedia-remote');
        if (a) a.run();
        return !!a;
      }, EDIT_URL);
    await expect.poll(run).toBe(true); // registered by the remote, visible to a media.layout holder
    await expect(R(page).locator('[data-mr-editor]')).toBeVisible();
    await shots(page, 'remote-editor-light');
    // hide "אחרונים", fold "ניגון", rename a source
    await R(page).locator('[data-ed-section="recent"] [role="switch"]').click();
    await R(page).locator('[data-ed-section="pbk"] input[type="checkbox"]').check();
    const name = R(page).locator('[data-ed-item="HDMI1"] input[type="text"]');
    await name.fill('HDMI 1 · ממיר');
    await R(page).locator('[data-ed-save]').click();
    await expect(R(page).locator('[data-mr-state="on"]')).toBeVisible();
    await expect(R(page).locator('[data-mr-recent]')).toHaveCount(0);
    await expect(R(page).locator('[data-mr-pbk]')).toHaveCount(0); // folded behind "עוד מקשים"
    await R(page).locator('[data-mr-tab="sources"]').click();
    await expect(R(page).locator('[data-mr-source="HDMI1"]')).toContainText('HDMI 1 · ממיר');
    // the screen's scope is now "device"; the editor offers the way back
    await run();
    await expect(R(page).locator('[data-ed-reset]')).toBeVisible();
    await R(page).locator('[data-ed-scope="default"]').click();
    await R(page).locator('[data-ed-section="nums"] [role="switch"]').click();
    await R(page).locator('[data-ed-save]').click();
    await expect(R(page).locator('[data-mr-state="on"]')).toBeVisible();
    expect(await sent(page)).toEqual([]); // the editor never sends a command to a screen
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('dark editor with the connections list (system.configure)', async ({ page }) => {
    await stage(page, { scheme: 'dark' });
    await openRemote(page, 'md-living', 'dark');
    await page.evaluate(async (url) => {
      const m = await import(/* @vite-ignore */ url);
      m.screenEdits().find((x: { id: string }) => x.id === 'multimedia-remote')?.run();
    }, EDIT_URL);
    await expect(R(page).locator('[data-ed-conns]')).toBeVisible();
    // MS3: the connection rows name the integration, not its registry id ('cast' -> Google Cast)
    await expect(R(page).locator('[data-ed-conns]')).toContainText('Google Cast');
    await page.setViewportSize({ width: 1440, height: 1700 });
    await page.waitForTimeout(300);
    await shot(page, 'remote-editor-dark-1440');
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// the area card and the home widget

/** A glass frame like the area screen's media card, with `<media-area-card>` inside (the real S2 screen card). */
async function mountAreaCard(page: Page) {
  await page.evaluate(() => {
    const st = document.querySelector('#mr-stage') as HTMLElement;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'max-inline-size:520px;margin-inline:auto;padding-block-start:40px';
    const card = document.createElement('sw-card') as HTMLElement & { heading: string; subheading: string };
    card.heading = 'מסכים';
    card.subheading = '2 התקנים · 2 פעילים';
    const el = document.createElement('media-area-card') as HTMLElement & { areaId: string; areaName: string };
    el.areaId = 'living';
    el.areaName = 'סלון';
    card.appendChild(el);
    wrap.appendChild(card);
    st.appendChild(wrap);
  });
  await page.locator('[data-media-tile]').first().waitFor();
}

test.describe('the area card (<media-area-card>)', () => {
  test('one compact card per physical screen, every "שלט" opens the same remote; "כבה הכל" asks, sends only to screens confirmed on and reports each one', async ({ page }) => {
    await stage(page);
    await withMock(page, (m) => {
      const k = m.rows.find((r: any) => r.device.key === 'md-kitchen').device;
      k.area_id = 'living';
      k.area_name = 'סלון';
      k.floor_id = 'g';
      k.live.confirmed = false; // an "on" that is only a heuristic: bulk off must skip it
    });
    await mountAreaCard(page);
    await expect(page.locator('[data-media-tile]')).toHaveCount(2);
    await shots(page, 'areacard-light');
    // the tile's "שלט" opens the remote of THAT screen
    await page.locator('[data-media-tile="md-living"] .rbtn').click();
    await expect(page.locator('media-area-card media-remote[open]')).toHaveCount(1);
    await expect(page.locator('media-area-card media-remote [data-mr-state="on"]')).toBeVisible();
    await expect(page.locator('media-area-card media-remote sw-drawer')).toHaveAttribute('heading', 'טלוויזיה סלון');
    await shots(page, 'areacard-remote-light');
    await page.keyboard.press('Escape');
    await expect(page.locator('media-area-card media-remote[open]')).toHaveCount(0);
    expect(await sent(page)).toEqual([]); // opening a remote from the card sent nothing
    // "כבה הכל": a question with a count, the details folded
    await page.locator('[data-media-off-all]').click();
    const dlg = page.locator('sw-dialog[data-mac-dialog="ask"]');
    await expect(dlg.locator('[role="dialog"]')).toBeVisible();
    await expect(dlg).toHaveAttribute('heading', 'לכבות מסך אחד בסלון?');
    await expect(dlg.locator('details')).not.toHaveAttribute('open', '');
    await shots(page, 'areacard-offall-dialog-light');
    await dlg.locator('details summary').click();
    await page.waitForTimeout(200);
    await shot(page, 'areacard-offall-details-light-1440');
    await page.locator('[data-mac-confirm]').click();
    const done = page.locator('sw-dialog[data-mac-dialog="done"]');
    await expect(done.locator('[role="dialog"]')).toBeVisible({ timeout: 10_000 });
    await expect(done.locator('[data-mac-headline]')).toHaveText('בוצע');
    await expect(done).toContainText('טלוויזיה סלון · אושר');
    await expect(done).toContainText('טלוויזיה מטבח · דולג · מצב לא מאושר');
    await shots(page, 'areacard-offall-result-light');
    const states = await withMock(page, (m) => Object.fromEntries(m.rows.map((r: any) => [r.device.key, r.device.live.power])));
    expect(states['md-living']).toBe('off');
    expect(states['md-kitchen']).toBe('on'); // unconfirmed: skipped, not assumed
    expect((await sent(page)).length).toBe(0); // bulk is the bulk engine's, not a per-screen command
  });

  test('dark at 1440 and 390; the button goes away when no screen is confirmed on', async ({ page }) => {
    await stage(page, { scheme: 'dark' });
    await mountAreaCard(page);
    await shot(page, 'areacard-dark-1440');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await shot(page, 'areacard-dark-390');
    await withMock(page, (m) => void (m.rows.find((r: any) => r.device.key === 'md-living').device.live.power = 'off'));
    await page.evaluate(() => (document.querySelector('media-area-card') as any).load());
    await expect(page.locator('[data-media-off-all]')).toHaveCount(0);
  });
});

async function widgets(page: Page, size: 's' | 'm' | 'l', layout: 'hero' | 'snap' = 'hero', wait = true) {
  await page.evaluate(
    async ([sz, lay, cfgUrl]) => {
      const cfgMod = await import(/* @vite-ignore */ cfgUrl);
      const st = document.querySelector('#mr-stage') as HTMLElement;
      st.querySelectorAll('home-widgets').forEach((e) => e.remove());
      const cfg = cfgMod.defaultConfig();
      const el = document.createElement('home-widgets') as any;
      el.config = cfg;
      el.layout = lay;
      el.items = [
        { id: 'clock', avail: 'ok', size: sz, title: 'שעון' },
        { id: 'media', avail: 'ok', size: sz, title: 'מסכים' },
        { id: 'quick', avail: 'ok', size: sz, title: 'פעולות מהירות' },
      ];
      el.quick = { allowed: { lights_off: true, all_off: true }, lightsOn: 4, switchesOn: 2 };
      el.data = cfgMod.NO_DATA;
      el.style.cssText = 'display:block;max-inline-size:1100px;margin-inline:auto;padding-block-start:40px';
      st.appendChild(el);
    },
    [size, layout, HOME_CFG_URL] as const,
  );
  if (wait) await page.locator('#mr-stage [data-home-widget="media"]').waitFor();
}

test.describe('the home widget "מסכים"', () => {
  for (const size of ['s', 'm', 'l'] as const) {
    test(`size ${size}: how many screens are on; from medium up the on screens as chips that open the remote`, async ({ page }) => {
      await stage(page);
      await widgets(page, size);
      await expect(page.locator('#mr-stage [data-home-media-count]')).toHaveText(/5/); // living, kitchen, kids, cinema + the art-mode screen
      if (size !== 's') await expect(page.locator('#mr-stage [data-home-media-chip]').first()).toBeVisible();
      await shots(page, `home-widget-${size}-light`);
    });
  }

  test('a chip opens the remote of that screen (nothing is sent, nothing powers on); without a screen the widget is absent', async ({ page }) => {
    await stage(page);
    await widgets(page, 'm');
    await page.locator('#mr-stage [data-home-media-chip="md-kitchen"]').click();
    await expect(page.locator('#mr-stage home-widgets media-remote [data-mr-state="on"]')).toBeVisible();
    await expect(page.locator('#mr-stage home-widgets media-remote sw-drawer')).toHaveAttribute('heading', 'טלוויזיה מטבח');
    await shots(page, 'home-widget-remote-light');
    expect(await sent(page)).toEqual([]);
    await page.keyboard.press('Escape');
    // no screens and (CR-016) no players either: the widget draws nothing
    await withMock(page, (m) => void (m.rows.length = 0));
    await page.evaluate(async (url) => {
      (await import(/* @vite-ignore */ url)).playersMock().rows.length = 0;
    }, '/src/api/media-players-mock.ts');
    await widgets(page, 'm', 'hero', false);
    await page.waitForTimeout(900);
    await expect(page.locator('#mr-stage [data-home-widget="media"]')).toHaveCount(0);
  });

  test('phone snap row on the dark stage', async ({ page }) => {
    await stage(page, { scheme: 'dark' });
    await widgets(page, 'm', 'snap');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await shot(page, 'home-widget-snap-dark-390');
  });

  test('the home screen in demo mode carries the widget', async ({ page }) => {
    await page.goto('./#/devices/building');
    await expect(page.locator('home-widgets').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-home-widget="media"]').first()).toBeVisible();
    await shots(page, 'home-screen-demo-light');
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// API mode: the real devices-area.ts hook and the real `httpAdapter`, against fake HTTP routes that delegate to the same mock logic

const PERMS = ['devices.read', 'devices.control', 'devices.control_bulk', 'media.read', 'media.control', 'media.power', 'media.bulk', 'media.layout', 'system.configure'];

function row(entity_id: string, name: string, state: string, extra: Record<string, unknown> = {}) {
  return { entity_id, name, domain: entity_id.split('.')[0], device_class: null, state, available: true, fresh: true, active: state === 'playing' || state === 'on', icon: null, last_changed: '2026-09-30T18:00:00Z', can_control: true, ...extra };
}

const emptyCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };

function areaDetail() {
  const card = (id: string, label: string, entities: unknown[]) => ({ id, label, entities, count: entities.length, active: entities.length });
  const media = [
    row('media_player.living_tv_vendor', 'טלוויזיה סלון', 'playing', { device_class: 'tv', media_title: 'סדרה' }),
    row('media_player.living_tv_cast', 'טלוויזיה סלון (הקרנה)', 'playing', { device_class: 'tv' }),
    row('media_player.living_amp', 'מגבר סלון', 'on', { device_class: 'receiver' }),
    row('media_player.kitchen_radio', 'רמקול מטבח', 'off', { device_class: 'speaker' }),
  ];
  return {
    area: { area_id: 'living', name: 'סלון', icon: null, floor_id: 'g', floor_name: 'קומת קרקע', level: 0 },
    floor_areas: [{ area_id: 'living', name: 'סלון', icon: null, counts: { ...emptyCounts, entities: 6 } }],
    cards: {
      lighting: card('lighting', 'תאורה', [row('light.living_ceiling', 'תקרה', 'on', { brightness_pct: 80 })]),
      switches: card('switches', 'מתגים', []),
      climate: card('climate', 'מיזוג', []),
      heating: card('heating', 'חימום', []),
      covers: card('covers', 'תריסים', []),
      security: card('security', 'אבטחה', []),
      media: card('media', 'מסכים', media),
      sensors: card('sensors', 'חיישנים', []),
    },
    counts: { ...emptyCounts, entities: 6, media: 4, media_on: 2 },
    scoped: false,
    can_bulk: true,
    sync: { connected: true, last_snapshot_at: '2026-09-30T18:00:00Z', last_event_at: '2026-09-30T18:00:00Z', last_registry_at: null },
  };
}

/** The app in API mode: `/me` says who we are, `/multimedia/*` and `/devices/actions/*` are answered by the mock of a second, demo-mode page. */
async function apiMode(page: Page) {
  const holder = await page.context().newPage();
  await holder.goto('./');
  await holder.waitForFunction(() => !!customElements.get('media-remote'));
  await holder.evaluate(async (url) => (await import(/* @vite-ignore */ url)).resetMediaMock(), MOCK_URL);
  await withMock(holder, (m) => {
    const k = m.rows.find((r: any) => r.device.key === 'md-kitchen').device;
    k.area_id = 'living';
    k.area_name = 'סלון';
    k.floor_id = 'g';
  });
  let lastPreview: any = null;
  const calls: { method: string; path: string }[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json(200, { user: { id: 'u1', username: 'tester', display_name: 'בוחן', source: 'dev' }, bindings: [], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, bootstrap_state: 'ready' });
    }
    if (p === 'devices/areas/living') return json(200, areaDetail());
    if (p.startsWith('multimedia/') || p.startsWith('devices/actions/')) {
      calls.push({ method, path: p });
      const body = req.postDataJSON?.() ?? null;
      const query = Object.fromEntries(url.searchParams);
      const out = await holder.evaluate(
        async ([murl, m, path, q, b, prev]) => {
          const mod = await import(/* @vite-ignore */ murl);
          const s = mod.mediaMock();
          try {
            if (path === 'multimedia/status') return { ok: await s.status() };
            if (path === 'multimedia/devices') return { ok: await s.list(q) };
            let x = /^multimedia\/devices\/([^/]+)$/.exec(path);
            if (x) return { ok: await s.get(decodeURIComponent(x[1])) };
            x = /^multimedia\/devices\/([^/]+)\/commands$/.exec(path);
            if (x) return { ok: await s.command(decodeURIComponent(x[1]), b), status: 202 };
            if (path === 'multimedia/actions/preview') return { ok: await s.bulkPreview(q.scope, q.id), preview: true };
            if (path === 'multimedia/actions' && m === 'POST') return { ok: await s.bulkRun(b.scope, b.id, b.client_request_id, b.expires_at), status: 202 };
            if (path.startsWith('devices/actions/')) {
              const items = (prev?.devices ?? []).filter((d: any) => d.will === 'off').map((d: any) => ({ entity_id: d.key, name: d.name, domain: 'media_player', area_name: null, action_id: 'a', outcome: 'confirmed', status: 'confirmed', error: null, observed_state: 'off', expected_state: 'off', sent: true }));
              const counts = { queued: 0, accepted: 0, confirmed: items.length, sent: 0, not_confirmed: 0, refused: 0, unknown: 0, total: items.length };
              return { ok: { id: path.split('/').pop(), scope: 'area', scope_id: 'living', scope_name: 'סלון', kind: 'screens_off', kind_label: 'כיבוי מסכים', status: 'done', done: true, all_confirmed: true, counts, items, note: '' } };
            }
            return { fail: { status: 404, body: { code: 'not_found', user_message: 'nf', retryable: false, correlation_id: 'x', details: {} } } };
          } catch (e: any) {
            return { fail: { status: e.status ?? 500, body: e.body ?? { code: 'error', user_message: String(e), retryable: false, correlation_id: 'x', details: {} } } };
          }
        },
        [MOCK_URL, method, p, query, body, lastPreview] as const,
      );
      if ((out as any).fail) return json((out as any).fail.status, (out as any).fail.body);
      if ((out as any).preview) lastPreview = (out as any).ok;
      return json((out as any).status ?? 200, (out as any).ok);
    }
    return json(404, { code: 'not_found', user_message: 'not_found', retryable: false, correlation_id: 'fake', details: {} });
  });
  return { holder, calls, mock: <T,>(fn: (m: any) => T | Promise<T>) => withMock(holder, fn) };
}

test.describe('the area screen in API mode (devices-area.ts hook, HTTP adapter)', () => {
  test('the media card draws one card per physical screen (the two endpoints of one TV are one), keeps the speaker\'s row, and opens the remote over HTTP', async ({ page }) => {
    const api = await apiMode(page);
    await page.goto('./#/devices/areas/living');
    const card = page.locator('devices-area sw-card[data-card="media"]');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.locator('media-area-card')).toBeVisible();
    await expect(card.locator('[data-media-tile]')).toHaveCount(2); // the mock's two screens of the area (the four entity rows are not cards)
    // the rows the screens replace are gone; the receiver and the speaker keep theirs (until the players of 0.1.150)
    await expect(card.getByText('טלוויזיה סלון (הקרנה)')).toHaveCount(0);
    await expect(card.getByText('מגבר סלון')).toBeVisible();
    await expect(card.getByText('רמקול מטבח')).toBeVisible();
    await page.waitForTimeout(400);
    await shots(page, 'area-screen-api-light');
    await card.locator('[data-media-tile="md-living"] .rbtn').click();
    await expect(card.locator('media-remote [data-mr-state="on"]')).toBeVisible();
    await shots(page, 'area-screen-api-remote-light');
    expect(api.calls.some((c) => c.path === 'multimedia/devices/md-living' && c.method === 'GET')).toBe(true);
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false); // opening sent nothing
    // a key goes over HTTP as one command
    await card.locator('media-remote').locator('media-remote-pad').locator('[data-k="ok"]').click();
    await expect.poll(() => api.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/commands')).length).toBe(1);
    expect(await api.mock((m) => m.sent.map((x: any) => x.command))).toEqual([{ command: 'key', key: 'ok' }]);
    await page.keyboard.press('Escape');
    // "כבה הכל" over HTTP: preview, then the bulk, then the record
    await card.locator('[data-section-bulk-kind="screens_off"]').click(); // in the section header, like the other sections
    await expect(page.locator('sw-dialog[data-mac-dialog="ask"]')).toHaveAttribute('heading', 'לכבות 2 מסכים בסלון?');
    await page.locator('[data-mac-confirm]').click();
    await expect(page.locator('sw-dialog[data-mac-dialog="done"] [data-mac-headline]')).toHaveText('בוצע', { timeout: 15_000 });
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual(expect.arrayContaining(['GET multimedia/actions/preview', 'POST multimedia/actions']));
    await shots(page, 'area-screen-api-offall-light');
    await api.holder.close();
  });

  test('without media.read the card keeps its classic rows exactly as before', async ({ page }) => {
    const api = await apiMode(page);
    await page.unroute('**/api/v1/**').catch(() => undefined);
    await page.route('**/api/v1/**', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'not_found', user_message: 'nf', retryable: false, correlation_id: 'x', details: {} }) }));
    await page.route('**/api/v1/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'u1', username: 't', display_name: 't', source: 'dev' }, bindings: [], permissions_installation: ['devices.read'], permissions_any: ['devices.read'], has_access: true, permission_revision: 1, bootstrap_state: 'ready' }) }));
    await page.route('**/api/v1/devices/areas/living', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(areaDetail()) }));
    await page.goto('./#/devices/areas/living');
    const card = page.locator('devices-area sw-card[data-card="media"]');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.locator('media-area-card')).toHaveCount(0);
    await expect(card.getByText('טלוויזיה סלון (הקרנה)')).toBeVisible();
    await api.holder.close();
  });
});
