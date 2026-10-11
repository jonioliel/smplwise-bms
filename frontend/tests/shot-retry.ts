import type { Page } from '@playwright/test';

/**
 * `page.screenshot` for the evidence pictures a spec saves next to its assertions. On a very busy machine the browser sometimes
 * answers "Unable to capture screenshot" (the compositor has not produced a frame for a page that has just loaded, or its GPU
 * process is starved): that says nothing about the app, and the picture is not an assertion, so it is simply taken again - a few
 * times, a beat apart, after two animation frames. Any other error, and a page that keeps refusing, still fail the test.
 */
export async function screenshotRetrying(page: Page, options: Parameters<Page['screenshot']>[0], tries = 4): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await page.screenshot(options);
    } catch (e) {
      if (attempt >= tries || !/Unable to capture screenshot/i.test(e instanceof Error ? e.message : String(e))) throw e;
      await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
      await page.waitForTimeout(250 * attempt);
    }
  }
}
