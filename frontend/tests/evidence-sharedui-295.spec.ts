import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './access-control-mocks';
import { installExternalMock, XNOW, type ExternalOptions } from './access-external-mocks';
import { installRequestMock, type RequestOptions } from './access-request-mocks';
import { settlePage } from './pixel-settle';

// SHAREDUI-295: every state of the external-access screen, the identity card and the request form, against the mocked backend
// (tests/access-external-mocks.ts + access-request-mocks.ts: invented sample data, no PIN anywhere). Nothing here reaches WisKey, a
// station, a door or WhatsApp.
//
// The owner (2026-10-20): "fix everything you think needs fixing; the 75-second counter looks problematic to me". What this pins:
//  - the read-back wait is shown WITHOUT a number: no countdown, no seconds, no "75" - an indeterminate "waiting for a read-back", a
//    "read back now" that ends in a terminal answer (still not known at HH:MM / the new state / why it failed) and can be pressed again;
//  - WisKey offline (the list's `wiskey` freshness): a banner with the last-known time and "check again"; read / retry wait for it;
//  - Arx not answering a poll (stale): a banner with the time of the list shown and "try again" - no raw error line;
//  - the first load failing, the empty list (with "new request" when allowed), the identity card's own error with a retry;
//  - the request form: a load error with a retry and a way out, the offline banner with "check again";
//  - text contrast >= 4.5:1 on the badges, chips and notes; every button a 44 px target.
// SW_PHASE=before captures the screenshots of the shipped screens (no new-behaviour assertions); anything else = after.
// Evidence: docs/design/evidence/SHAREDUI-295/<phase>/. Needs the Vite dev server or a built preview (SW_BASE_URL).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PHASE = process.env.SW_PHASE === 'before' ? 'before' : 'after';
const AFTER = PHASE === 'after';
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'SHAREDUI-295', PHASE);
const SCREEN = 'sw-app access-external-screen';
const DRAWER = `${SCREEN} sw-drawer[data-grant-drawer]`;
const DLG = `${SCREEN} access-request-dialog`;
type Scheme = 'light' | 'dark';
const SCHEMES: Scheme[] = ['light', 'dark'];

async function boot(page: Page, o: ExternalOptions & RequestOptions & { scheme?: Scheme; request?: boolean; ready?: boolean } = {}) {
  const mock = o.request ? await installRequestMock(page, o) : await installExternalMock(page, o);
  await page.clock.setFixedTime(XNOW);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto(url('/wiskey/external', 'classic', o.scheme ?? 'light'));
  if (o.ready !== false) await expect(page.locator(`${SCREEN} .kpis`).first()).toBeVisible({ timeout: 30_000 });
  return { mock, errors };
}

async function shot(page: Page, info: TestInfo, name: string, scheme: Scheme) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${scheme}-${info.project.name}.png`) });
}

async function openDrawer(page: Page, sel: string) {
  await page.locator(`${SCREEN} ${sel}`).first().click();
  await expect(page.locator(DRAWER)).toBeVisible();
}

/** No countdown anywhere: no m:ss, no "75", no seconds left. */
async function expectNoCountdown(scope: Locator) {
  const text = await scope.innerText();
  expect(text).not.toMatch(/\b\d{1,2}:\d{2}\s*(?:שנ|sec|s\b)/);
  expect(text).not.toMatch(/\b75\b/);
  expect(text).not.toMatch(/(?<![\d:])0:\d{2}(?!:)/); // a 0:52-style countdown, not a clock time like 10:20
}

/** WCAG contrast of every visible element matched by `selector` (shadow roots included) against the backgrounds it sits on. */
async function lowContrast(page: Page, selector: string, min = 4.5): Promise<string[]> {
  return page.evaluate(
    ({ selector: sel, min: lim }) => {
      const parse = (c: string): number[] | null => {
        const m = /rgba?\(([^)]+)\)/.exec(c);
        if (m) {
          const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
          return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
        }
        const s = /color\(srgb ([^)]+)\)/.exec(c);
        if (s) {
          const p = s[1].split(/[ /]+/).filter(Boolean).map(Number);
          return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1];
        }
        return null;
      };
      const lum = (c: number[]) => {
        const f = (v: number) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
      };
      const over = (top: number[], bottom: number[]) => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
      const parentOf = (el: Element): Element | null => (el.parentElement ?? ((el.getRootNode() as ShadowRoot).host as Element | undefined) ?? null);
      const bgOf = (el: Element): number[] => {
        const stack: number[][] = [];
        for (let e: Element | null = el; e; e = parentOf(e)) {
          const c = parse(getComputedStyle(e).backgroundColor);
          if (c && c[3] > 0) {
            stack.push(c);
            if (c[3] >= 1) break;
          }
        }
        let out = [255, 255, 255, 1];
        const body = parse(getComputedStyle(document.body).backgroundColor);
        if (body && body[3] >= 1) out = body;
        for (const c of stack.reverse()) out = over(c, out);
        return out;
      };
      const all: Element[] = [];
      const walk = (root: ParentNode) => {
        for (const el of Array.from(root.querySelectorAll('*'))) {
          if (el.matches(sel)) all.push(el);
          const sr = (el as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
          if (sr) walk(sr);
        }
      };
      walk(document);
      const bad: string[] = [];
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || !(el.textContent ?? '').trim()) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || Number(cs.opacity) < 1) continue;
        const fg = parse(cs.color);
        if (!fg) continue;
        const bg = bgOf(el);
        const a = lum(over(fg, bg));
        const b = lum(bg);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (ratio < lim) bad.push(`${el.className || el.tagName} "${(el.textContent ?? '').trim().slice(0, 24)}" ${ratio.toFixed(2)}`);
      }
      return bad;
    },
    { selector, min },
  );
}

/** Every visible button / sw-button inside `root` is at least 44 px tall. */
async function smallTargets(root: Locator): Promise<string[]> {
  return root.evaluate((host) => {
    const out: string[] = [];
    const walk = (r: ParentNode) => {
      for (const el of Array.from(r.querySelectorAll('button, sw-button, .kpi, label.cb, summary'))) {
        if (el.tagName === 'BUTTON' && (el.getRootNode() as ShadowRoot).host?.tagName === 'SW-BUTTON') continue;
        const b = el.getBoundingClientRect();
        if (b.width && b.height && b.height < 43.5 && getComputedStyle(el).visibility !== 'hidden') out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 20)}" ${Math.round(b.height)}`);
        const sr = (el as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
        if (sr && el.tagName !== 'SW-BUTTON') walk(sr);
      }
      for (const el of Array.from(r.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
        if (sr && el.tagName !== 'SW-BUTTON') walk(sr);
      }
    };
    walk((host as Element & { shadowRoot: ShadowRoot | null }).shadowRoot ?? host);
    return [...new Set(out)];
  });
}

for (const scheme of SCHEMES) {
  test.describe(`${scheme}`, () => {
    test(`01 the list (${scheme})`, async ({ page }, info) => {
      const { errors } = await boot(page, { scheme });
      const s = page.locator(SCREEN);
      if (AFTER) {
        expect(await lowContrast(page, `.badge, .chip, .note, .legend span, .pn small, .pn .sr, .st .why, .win small, .kpi span`)).toEqual([]);
        expect(await smallTargets(s)).toEqual([]);
        await expect(s.locator('[data-banner="wiskey-offline"]')).toHaveCount(0);
      }
      await shot(page, info, '01-list', scheme);
      expect(errors).toEqual([]);
    });

    test(`02 an unknown outcome waits for a read-back without a number (${scheme})`, async ({ page }, info) => {
      await boot(page, { scheme });
      await openDrawer(page, '.gl-r[data-ui-state="unknown"]');
      const d = page.locator(DRAWER);
      if (AFTER) {
        const box = d.locator('[data-readback="pending"]');
        await expect(box).toBeVisible();
        await expectNoCountdown(d);
        await expect(box.locator('[data-action="read"]')).not.toHaveAttribute('disabled', '');
        expect(await lowContrast(page, `${'.badge, .chip, .note, .callout, .ku li, .ku h4, .ladder .stp, .dtable small, .tl li'}`)).toEqual([]);
        expect(await smallTargets(page.locator(SCREEN))).toEqual([]);
      }
      await shot(page, info, '02-unknown-pending', scheme);
    });

    test(`03 "read back now" ends in a terminal answer and can be pressed again (${scheme})`, async ({ page }, info) => {
      const { mock } = await boot(page, { scheme, readNow: 'still' });
      await openDrawer(page, '.gl-r[data-ui-state="unknown"]');
      const d = page.locator(DRAWER);
      await d.locator('[data-action="read"]').first().click();
      if (AFTER) {
        await expect(d.locator('[data-readback-result="still"]')).toBeVisible();
        await expect(d.locator('[data-readback-result="still"]')).toContainText('10:20');
        await expectNoCountdown(d);
        await expect(d.locator('[data-action="read"]').first()).not.toHaveAttribute('disabled', '');
        expect(mock.posts.filter((p) => p.path.endsWith('/read-now'))).toHaveLength(1);
      }
      await shot(page, info, '03-readback-still', scheme);
    });

    test(`04 a read-back that fails says why and keeps the retry (${scheme})`, async ({ page }, info) => {
      await boot(page, { scheme, readNow: 'error' });
      await openDrawer(page, '.gl-r[data-ui-state="unknown"]');
      const d = page.locator(DRAWER);
      await d.locator('[data-action="read"]').first().click();
      if (AFTER) {
        await expect(d.locator('[data-readback-result="error"]')).toContainText('WisKey לא ענה');
        await expect(d.locator('[data-action="read"]').first()).not.toHaveAttribute('disabled', '');
      }
      await shot(page, info, '04-readback-error', scheme);
    });

    test(`05 a read-back that settles the outcome says so (${scheme})`, async ({ page }) => {
      await boot(page, { scheme, readNow: 'settled' });
      await openDrawer(page, '.gl-r[data-ui-state="unknown"]');
      await page.locator(DRAWER).locator('[data-action="read"]').first().click();
      if (AFTER) await expect(page.locator(`${SCREEN} [data-toast]`)).toContainText('טרם אומת');
    });

    test(`06 WisKey offline: the banner, the last-known time and "check again" (${scheme})`, async ({ page }, info) => {
      const { mock } = await boot(page, { scheme, wiskeyOffline: true });
      const s = page.locator(SCREEN);
      if (AFTER) {
        const b = s.locator('[data-banner="wiskey-offline"]');
        await expect(b).toBeVisible();
        await expect(b).toContainText('10:14');
        const before = (mock as { listCalls: number }).listCalls;
        await b.locator('sw-button').click();
        await expect.poll(() => (mock as { listCalls: number }).listCalls).toBeGreaterThan(before);
        expect(await lowContrast(page, '.banner, .banner b')).toEqual([]);
      }
      await shot(page, info, '06-wiskey-offline', scheme);
      await openDrawer(page, '.gl-r[data-ui-state="unknown"]');
      if (AFTER) {
        await expect(page.locator(DRAWER).locator('[data-action="read"]').first()).toHaveAttribute('disabled', '');
        await expect(page.locator(DRAWER).locator('[data-readback="offline"]')).toBeVisible();
      }
      await shot(page, info, '07-wiskey-offline-drawer', scheme);
    });

    test(`08 Arx stops answering the poll: stale, with the time shown and "try again" (${scheme})`, async ({ page }, info) => {
      await boot(page, { scheme, listFails: 'after-first' });
      const s = page.locator(SCREEN);
      await s.evaluate((el) => (el as unknown as { load(): Promise<void> }).load());
      if (AFTER) {
        const b = s.locator('[data-banner="stale"]');
        await expect(b).toBeVisible();
        await expect(b).toContainText('10:20');
        await expect(b.locator('sw-button')).toBeVisible();
        await expect(s.locator('.err-line')).toHaveCount(0);
      }
      await shot(page, info, '08-stale', scheme);
    });

    test(`09 the first load fails: a plain error and a retry (${scheme})`, async ({ page }, info) => {
      await boot(page, { scheme, listFails: 'always', ready: false });
      const s = page.locator(SCREEN);
      await expect(s.locator('sw-state-panel')).toBeVisible({ timeout: 30_000 });
      if (AFTER) await expect(s.locator('sw-state-panel[state="error"]')).toBeVisible();
      await shot(page, info, '09-load-error', scheme);
    });

    test(`10 the empty list offers a new request (${scheme})`, async ({ page }, info) => {
      await boot(page, { scheme, empty: true });
      const s = page.locator(SCREEN);
      await expect(s.locator('[data-external-empty="empty"]')).toBeVisible();
      if (AFTER) {
        await s.locator('[data-external-empty="empty"] sw-state-panel').evaluate((el) => el.dispatchEvent(new CustomEvent('action', { bubbles: true, composed: true })));
        await expect(page.locator(DLG)).toBeAttached();
        await page.locator(DLG).evaluate((el) => el.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })));
      }
      await shot(page, info, '10-empty', scheme);
    });

    test(`11 the identity card cannot load: says so, with a retry (${scheme})`, async ({ page }, info) => {
      await boot(page, { scheme, identityFails: true });
      await openDrawer(page, '.gl-r[data-ui-state="verified"]');
      const card = page.locator(`${DRAWER} access-identity-card`);
      if (AFTER) {
        await expect(card.locator('[data-identity-error]')).toBeVisible();
        await expect(card.locator('[data-identity-error] sw-button')).toBeVisible();
      }
      await page.locator(`${DRAWER} [data-grant-identity]`).scrollIntoViewIfNeeded();
      await shot(page, info, '11-identity-error', scheme);
    });

    test(`12 a revocation that is not proven yet (${scheme})`, async ({ page }, info) => {
      await boot(page, { scheme });
      await openDrawer(page, '.gl-r[data-grant^="g08"]');
      const d = page.locator(DRAWER);
      if (AFTER) {
        await expect(d.locator('[data-readback="pending"]')).toBeVisible();
        await expectNoCountdown(d);
      }
      await shot(page, info, '12-revoking', scheme);
    });

    test(`13 the identity card in the drawer (${scheme})`, async ({ page }, info) => {
      await boot(page, { scheme });
      await openDrawer(page, '.gl-r[data-ui-state="verified"]');
      await page.locator(`${DRAWER} [data-grant-identity]`).scrollIntoViewIfNeeded();
      if (AFTER) expect(await smallTargets(page.locator(`${DRAWER} access-identity-card`))).toEqual([]);
      await shot(page, info, '13-identity', scheme);
    });

    test(`14 the request form while WisKey is offline (${scheme})`, async ({ page }, info) => {
      await boot(page, { scheme, request: true, offline: true });
      await page.locator(`${SCREEN} [data-open-request]`).click();
      const d = page.locator(DLG);
      await expect(d.locator('[data-offline]')).toBeVisible({ timeout: 15_000 });
      if (AFTER) {
        await expect(d.locator('[data-offline] sw-button')).toBeVisible();
        expect(await smallTargets(d)).toEqual([]);
        expect(await lowContrast(page, '.banner, .chip, .note, .hint')).toEqual([]);
      }
      await shot(page, info, '14-request-offline', scheme);
    });

    test(`15 the request form cannot load: a retry and a way out (${scheme})`, async ({ page }, info) => {
      await boot(page, { scheme, request: true, doorsFailOnce: true });
      await page.locator(`${SCREEN} [data-open-request]`).click();
      const d = page.locator(DLG);
      await expect(d.locator('.err-line, [data-request-load-error]').first()).toBeVisible({ timeout: 15_000 });
      if (AFTER) {
        await expect(d.locator('[data-request-load-error] sw-button[data-retry]')).toBeVisible();
        await expect(d.locator('[data-request-load-error] sw-button[data-close]')).toBeVisible();
      }
      await shot(page, info, '15-request-load-error', scheme);
      if (AFTER) {
        await d.locator('[data-request-load-error] sw-button[data-retry]').click();
        await expect(d.locator('[data-sec="doors"] [data-door]').first()).toBeAttached({ timeout: 15_000 });
      }
    });
  });
}
