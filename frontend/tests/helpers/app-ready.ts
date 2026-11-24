import type { Page } from '@playwright/test';

/**
 * FLAKY-SWEEP-2480: the page-load wait. A spec that asserted a lazy route screen with a 5 s `expect(...).toBeVisible()` right after
 * `page.goto` was measuring the cold start of the whole application (the entry chunk, the session, the settings, the screen's chunk)
 * against a budget meant for a UI reaction; on a gate runner at load 30-60 that start alone took 5-10 s and the spec failed in the full
 * run and passed alone (the gate reports of 19.11 counted ~40 such cases). The shell already says when the first load is over:
 * `sw-app[data-shell-ready]` is set once the session is known, the product settings are applied and no route screen chunk is still in
 * flight (shell/sw-app.ts updated(), shell/lazy-screens.ts pendingScreens). Waiting for it is waiting for the real condition; the
 * assertions that follow keep their short budget for what the screen itself does.
 *
 * No timeout of its own: a page load is bounded by the test's timeout (as `page.goto` is), not by an assertion budget.
 */
export async function appReady(page: Page): Promise<void> {
  await page.locator('sw-app[data-shell-ready]').waitFor({ state: 'attached', timeout: 0 });
}

/** `page.goto(url)` and the shell's first load (see `appReady`). */
export async function gotoApp(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await appReady(page);
}
