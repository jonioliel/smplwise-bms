import { test } from '@playwright/test';

/**
 * NOSCROLL-1366-2437: from 1024 px the card screens (multimedia, the service-management list and board, the WisKey stations) put the
 * cards that do not fit the window on later pages (sw-pager) instead of scrolling. A functional spec that works with EVERY card of its
 * mock at once (counts them, clicks the last one) calls this inside its describe block: on a viewport of 1024 px or wider the window is
 * made tall enough for one page to hold the whole mock. The paging itself is guarded by tests/layout-noscroll-1366.spec.ts.
 * A test that sets its own viewport later overrides this, as it should. Phones (< 1024 px) are never touched.
 */
export function tallDesktop(height = 2400) {
  test.beforeEach(async ({ page }) => {
    const v = page.viewportSize();
    if (v && v.width >= 1024 && v.height < height) await page.setViewportSize({ width: v.width, height });
  });
}
