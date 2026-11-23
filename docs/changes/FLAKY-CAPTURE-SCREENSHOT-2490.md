# FLAKY-CAPTURE-SCREENSHOT-2490 and PHONE-SKIP-DESKTOP-SHOTS-2490

Branch `pilot/FLAKY-CAPTURE-SCREENSHOT-2490`, base `main` 619f94d04. Test-only: nothing under `frontend/src` or the backend changed.
Two owner-approved rows (Q29 and Q21 of the 22.11 answers).

## Row 1 - "Unable to capture screenshot"

### Where it was seen

21 refusals in the runner logs between 16 and 22 Nov (`~/smplwise-results/gate_*.logs/*.json`, `~/work/*-out/*.json`), in all three
projects (desktop 9, mobile 8, tablet 4), full-page and viewport captures alike. Every stack names `page.screenshot`, except 5
`visual-matrix` pixel tests whose test line holds both a `page.screenshot` (read back for the duplicate check) and a
`toHaveScreenshot()`; the guard covers the former, not the latter. Examples: evidence-public-ui5 L273 / L323 (phone), notice-tv-bustimes-295
(1920x1080 and 3840x2160 viewports), evidence-audit30a-glass-bridge (a viewport capture read back for one pixel),
evidence-design-foundation (tesla dark), evidence-automations-list (tablet).

### What it is not

Measured on a quiet workstation (Playwright 1.63, Chromium, Pixel 7 emulation, 25 contexts per variant): 0 refusals for a plain
viewport shot, a full-page shot, a capture racing `setViewportSize`, a capture racing `setContent` / `goto('about:blank')`, a capture
straight after `emulateMedia`, a 3840x2160 viewport, and a 30000 px full page at 2.625x. So it is not the size of the picture and not
a navigation or resize race. Under CPU saturation (16 busy processes, 8 browsers) the capture times out (30 s) instead of being refused,
and the runner re-run of evidence-public-ui5 in the phone project, 6 repeats under 12 busy processes, passed 66 of 66.

### What the logs show

The refusals come in clusters seconds apart across different workers and even different runs: 19 Nov 03:45:50 (preview run) and
03:46:00 (dev run); 19 Nov 16:17 / 16:18 / 16:19 / 16:52 / 16:55; 19 Nov 19:45 and 19:50; 22 Nov 09:07:02 and 09:07:19 (two workers, the
second test failed after 474 ms, i.e. at its first picture); 22 Nov 09:14:30 and 09:15:08. The runner shares 15 GB between many
sessions (`free` showed 273 MB unused), and its kernel journal has one OOM kill of a `chrome-headless` process (22 Nov 10:13). The
reading that fits: a host-wide moment in which Chromium cannot get the frame copy out of the compositor (empty bitmap), not anything in
the app or the picture. This is an inference from the clustering and the failed reproductions - it was NOT reproduced on demand, and the
note says so rather than claiming a proof.

### The fix

`frontend/tests/helpers/capture-guard.ts`, installed once from `playwright.config.ts` (the workers load the config too): it wraps
`Page.screenshot` and `Locator.screenshot` for EVERY spec, so no spec file changed for this row.

- only the message "Unable to capture screenshot" is retried; any other error (closed page, timeout, bad option) is thrown at once;
- the retry waits two animation frames and 0.5 s, 1.0 s, 1.5 s, at most 3 more tries (about 3 s: the clusters above last seconds);
  a page that keeps refusing fails with the browser's own message;
- options and bytes are passed through untouched, so a successful capture is exactly what Playwright always produced; `expect` is never
  wrapped, an assertion is never run again; `toHaveScreenshot()` is not wrapped.
- `SW_CAPTURE_GUARD=0` switches it off (to measure the rate without it); `SW_SHOT_LOG=<file>` appends one line per capture (image size,
  viewport, call site, "retry n"); `SW_SHOT_LOG_ONLY=1` takes no picture and logs only (the dry run used for row 2).
- `tests/unit-capture-guard.spec.ts` (no browser): retried after frames and a growing beat with the options unchanged; another error
  not retried; a page that keeps refusing fails after 4 tries; a page that went away during the retry throws its own error.
- `tests/shot-retry.ts` (the earlier per-spec retry of FLAKY-SWEEP-2480, used by schedules-editor and tabs-ui) stays; the guard makes it
  redundant but harmless.

## Row 2 - PHONE-SKIP-DESKTOP-SHOTS-2490

The `mobile` project (Pixel 7, 390 px, deviceScaleFactor 2.625) runs every spec; a spec that sets a desktop-wide viewport for a picture
saved a desktop picture there too (a 1440 px capture is 3780 px wide in that project and was measured at ~4.4 s). Those pictures are
already saved by the desktop and tablet projects.

`frontend/tests/helpers/phone-skip-shots.ts`: `phoneSkipDesktopShot(page)` is true when the project is `mobile` AND the viewport is
1000 px wide or more right now. A spec's own `shot()` helper (or the inline `page.screenshot`) returns / is skipped on true; only the
CAPTURE is skipped, the test runs on, every assertion still runs. The call carries the greppable text `PHONE-SKIP-DESKTOP-SHOTS-2490`
and the test gets an annotation of the same name: `grep -rn PHONE-SKIP-DESKTOP-SHOTS-2490 frontend/tests`.

How the files were found: not by reading but by a dry run of the whole mobile project over every spec that contains a
`screenshot(` call and could reach a wide viewport (193 + 35 + 1 files, 2588 + 405 tests): `SW_SHOT_LOG_ONLY=1` logs the viewport of
every capture without taking it. 1468 captures reached, 208 of them at 1000 px or wider, in 15 files:

| file | wide captures skipped in mobile |
|---|---|
| evidence-audit30g-video | 9 |
| evidence-automations-builder | 27 |
| evidence-automations-list | 56 |
| evidence-door-automation | 7 |
| evidence-ha2610-compat | 1 |
| evidence-infra-tabs | 14 |
| evidence-kavarnit-ext | 1 |
| evidence-media-screens | 9 |
| evidence-schedules-editor | 1 + the helper |
| evidence-system-multimedia | 3 sites |
| evidence-tabs-ui | via the helper |
| layout-incidents | 3 sites |
| shoot-sched-polish-2331 | 1 helper |
| unit-arx-local-login | 7 sites |
| unit-service-identity | 2 sites |

(`unit-capture-guard.spec.ts` is the guard's own spec, new, not a skip.) Not touched on purpose: pictures that are read back (pixel
probes, size measurements), `toHaveScreenshot()` baselines, 768-999 px pictures (a tablet-portrait picture is not a desktop picture).

## Verification

See the numbers in the report of the row (runner slot B, own folder `~/work/capflake`, `--workers=2`, never `-u`).
