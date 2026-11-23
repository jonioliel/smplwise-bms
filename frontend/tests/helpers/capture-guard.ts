/**
 * FLAKY-CAPTURE-SCREENSHOT-2490: one guarded retry of a picture, never of an assertion.
 *
 * Chromium sometimes refuses `Page.captureScreenshot` with "Unable to capture screenshot" (seen in the 2.46.0 gate list and in
 * FLAKY-SWEEP-2480 session 3, in desktop, tablet and phone projects alike). The refusal says nothing about the app: the browser
 * could not copy a frame out of the compositor at that instant (no presented frame yet after a layout change, or a starved GPU
 * process on a loaded runner). Taking the same picture again a beat later works. `playwright.config.ts` calls installCaptureGuard()
 * once; it wraps `Page.screenshot` and `Locator.screenshot` for every spec, so no spec file changes and every picture - the evidence
 * shots and the ones that are read back - gets the same guard.
 *
 * What the guard does and does not do:
 *  - only the message "Unable to capture screenshot" is retried; any other error (a closed page, a timeout, a bad option) is thrown
 *    at once and a page that keeps refusing is thrown after the last try, so a real fault still fails the test;
 *  - the retry waits two animation frames and a growing beat first, so the compositor has produced a frame;
 *  - the options are passed through untouched: the bytes of a successful capture are exactly what Playwright always produced, so
 *    pixel baselines do not move. `toHaveScreenshot()` is not wrapped (it goes through its own protocol call and stability loop);
 *  - nothing here touches an `expect`: a failed assertion is never run again.
 *
 * SW_SHOT_LOG=<file> appends one line per capture ("<image w>x<h> vp=<viewport w>x<h> <spec>:<line>", plus "retry n" when a capture was repeated): the
 * measurement behind PHONE-SKIP-DESKTOP-SHOTS-2490 and the retry rate.
 */
import { appendFileSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';

const REFUSED = /Unable to capture screenshot/i;
const TRIES = 4;
const MARK = Symbol.for('smplwise.captureGuard');

export type Shoot = (this: unknown, options?: unknown) => Promise<Buffer>;

/** where in the spec the capture was asked for (first stack frame inside tests/) */
function callSite(): string {
  for (const m of (new Error().stack ?? '').matchAll(/tests[\\/]([^\s:()]+\.ts):(\d+)/g)) {
    if (!/capture-guard\.ts$/.test(m[1])) return `${m[1].replace(/\\/g, '/')}:${m[2]}`;
  }
  return 'unknown';
}

/** width and height of a PNG or JPEG buffer, '?' when it is neither */
function dimensions(b: Buffer): string {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) { i += 1; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return `${b.readUInt16BE(i + 7)}x${b.readUInt16BE(i + 5)}`;
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return '?';
}

export function guardShot(original: Shoot, pageOf: (self: unknown) => Page | null): Shoot {
  const wrapped: Shoot = async function (this: unknown, options?: unknown) {
    const log = process.env.SW_SHOT_LOG;
    const site = log ? callSite() : '';
    for (let attempt = 1; ; attempt += 1) {
      try {
        const buf = await original.call(this, options);
        if (log) {
          try { const vp = pageOf(this)?.viewportSize();
          appendFileSync(log, `${dimensions(buf)} vp=${vp ? `${vp.width}x${vp.height}` : '?'} ${site}${attempt > 1 ? ` retry ${attempt - 1}` : ''}\n`); } catch { /* a log is not worth a test */ }
        }
        return buf;
      } catch (e) {
        const page = pageOf(this);
        if (attempt >= TRIES || !page || !REFUSED.test(e instanceof Error ? e.message : String(e))) throw e;
        // let the compositor present a frame, then a growing beat; a page that went away throws its own error here and that one wins
        await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
        await page.waitForTimeout(250 * attempt);
      }
    }
  };
  (wrapped as unknown as Record<symbol, boolean>)[MARK] = true;
  return wrapped;
}

let installed = false;

/**
 * Wrap the screenshot methods of every page a browser opens. Called from playwright.config.ts, which the workers load too; it is a
 * no-op (the specs still run, unguarded) if the browser object does not look as expected.
 */
export function installCaptureGuard(): void {
  if (installed) return;
  installed = true;
  const launch = chromium.launch.bind(chromium);
  (chromium as unknown as { launch: typeof launch }).launch = async (...args: Parameters<typeof launch>) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...a: Parameters<typeof newContext>) => {
      const context = await newContext(...a);
      const newPage = context.newPage.bind(context);
      let patched = false;
      const patch = (page: Page) => {
        if (patched) return;
        patched = true;
        try {
          const pageProto = Object.getPrototypeOf(page) as { screenshot: Shoot };
          const locatorProto = Object.getPrototypeOf(page.locator('html')) as { screenshot: Shoot };
          if (!(pageProto.screenshot as unknown as Record<symbol, boolean>)[MARK]) pageProto.screenshot = guardShot(pageProto.screenshot, (s) => s as Page);
          if (!(locatorProto.screenshot as unknown as Record<symbol, boolean>)[MARK]) {
            locatorProto.screenshot = guardShot(locatorProto.screenshot, (s) => (s as { page(): Page }).page());
          }
        } catch { /* unguarded, never broken */ }
      };
      context.on('page', patch);
      context.newPage = async () => {
        const page = await newPage();
        patch(page);
        return page;
      };
      return context;
    };
    return browser;
  };
}
