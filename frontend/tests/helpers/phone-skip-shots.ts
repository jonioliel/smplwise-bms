import { test, type Page } from '@playwright/test';

/**
 * PHONE-SKIP-DESKTOP-SHOTS-2490 (owner Q21, "yes, file by file"): the `mobile` project (Pixel 7, 390 px) runs every spec, and a spec
 * that sets a desktop-wide viewport for a picture (1000 px and up) saves a desktop picture there that the `desktop` and `tablet`
 * projects already saved. A picture costs a full-page raster, a PNG encode and a disk write, and each one is a chance for a refused
 * capture; the phone run gains nothing from it.
 *
 * Call `phoneSkipDesktopShot(page)` as the first line of a spec's own `shot()` helper (or before a bare `page.screenshot`): it returns
 * true when the picture is not worth taking - the project is `mobile` AND the page is desktop wide right now - and the caller returns.
 * Only the CAPTURE is skipped: the test runs on, so every assertion still runs in the phone project. A picture that is read back (a
 * pixel probe, a size measurement) must not use this, and neither must `toHaveScreenshot()` baselines.
 *
 * Grep `PHONE-SKIP-DESKTOP-SHOTS-2490` for every file that uses it; the test carries the same text as an annotation.
 */
export const DESKTOP_SHOT_MIN_WIDTH = 1000;

export function phoneSkipDesktopShot(page: Page): boolean {
  const info = test.info();
  if (info.project.name !== 'mobile') return false;
  const width = page.viewportSize()?.width ?? 0;
  if (width < DESKTOP_SHOT_MIN_WIDTH) return false;
  if (!info.annotations.some((a) => a.type === 'PHONE-SKIP-DESKTOP-SHOTS-2490')) {
    info.annotations.push({ type: 'PHONE-SKIP-DESKTOP-SHOTS-2490', description: `desktop-wide pictures (>= ${DESKTOP_SHOT_MIN_WIDTH} px) are not taken in the mobile project; the desktop and tablet projects save them` });
  }
  return true;
}
