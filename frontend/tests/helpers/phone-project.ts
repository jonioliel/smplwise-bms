import { test } from '@playwright/test';

/** The widest viewport that is still a phone's (the phone project draws 390 px; tablets start at 768). */
const PHONE_MAX_WIDTH = 600;

/**
 * FLAKY-SWEEP-2480: a spec that pins its own desktop or tablet viewport (1440 x 900, 1440 x 2400, 820 x 1180) draws that page in every
 * project, so on the phone project (playwright.config.ts: Pixel 7, device scale 2.625, touch) it is the desktop test again at about
 * seven times the pixels: 1440 x 2400 becomes 3780 x 6300 device pixels per frame and per screenshot. In the gates of 19-20.11 those
 * duplicates were the phone project's timeouts (evidence-automations-builder mobile 25 s a test against 12.5 s on desktop, 12 timeouts;
 * evidence-system-multimedia mobile 46 s against 33 s, 8 timeouts; "taking page screenshot" at the end of the budget), and their
 * pictures overwrote the desktop project's files of the same name. The desktop and tablet projects keep running these sizes; the phone
 * project keeps every phone-sized test. Call it before the page is opened.
 */
export function skipDesktopSizeOnPhone(width: number): void {
  test.skip(test.info().project.name === 'mobile' && width > PHONE_MAX_WIDTH, `a ${width} px page is the desktop / tablet projects' test (the phone project would draw it at 2.6x pixels)`);
}
