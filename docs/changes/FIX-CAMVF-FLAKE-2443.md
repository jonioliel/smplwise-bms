# FIX-CAMVF-FLAKE-2443 - the live camera's shutter answers at once; the camera evidence spec fits its budget under load

Branch `pilot/FIX-CAMVF-FLAKE-2443`, cut from `origin/main` @ `cc69447f1` (2.43.7). Frontend only: no version bump, no CHANGELOG
entry, no backend change, no setting, no text change. No pixel spec covers the viewfinder (no baseline to refresh). The evidence
PNGs under `docs/design/evidence/camera-viewfinder/` are NOT regenerated in this branch.

## What failed

`frontend/tests/evidence-camera-viewfinder.spec.ts:101 [mobile]` ("on: nothing before the click, live preview, shot, zero uploads
before "use", one after, every track ended"), about 1 run in 16 on the runner, on main and on branches. Two signatures:

1. `expect(sw-dialog).toHaveAttribute('data-camvf', 'review')` - received `live` for the whole 5 s after the shutter click
   (entry check CR-MODAL-STACK-2441 436fdb701).
2. `Test timeout of 60000ms exceeded` inside `page.screenshot` at the review step (gate_main 14.11, entry check DOMUS-DEFAULT-2439
   98d8d4b44, failed again alone).

## Cause 1 - a real product defect: the shutter waited for the JPEG encode (measured)

`shoot()` drew the frame, stopped the camera, and then AWAITED `canvas.toBlob('image/jpeg')` before leaving `live`; the review was
rendered only from the finished blob (an object URL in an `<img>`). Chromium encodes a canvas JPEG in idle time on the page's main
thread and forces the encode only after its own timeouts (about 1 s to start, then up to 5 s to complete). Instrumented on the runner
(the shipped code plus timing logs, 32 runs per project, load ~40): drawing the frame and stopping the camera took 12-225 ms; the blob
arrived after 0.05-0.55 s on desktop, but on the phone project a cluster arrived at 1.05-1.15 s (the 1 s start fallback), five at
1.15-1.93 s, and in 2 of 32 runs it had not arrived when the 5 s expectation ended - while `requestAnimationFrame` kept firing (the
page was not frozen; only the encode was late). For the person: after the shutter the dialog showed a dead preview with an active
shutter button and no sign that anything happened, for seconds on a busy phone.

`OffscreenCanvas.convertToBlob` was measured as an alternative (same flow, alternating per run): the same ~1 s cluster and outliers
of 2.0 s and 4.2 s - idle-time encoding too, so it is NOT used.

## Cause 2 - the test: device-scale evidence captures used up the 60 s budget (measured from traces)

Signature 2 is not a hang. The Playwright traces of the timed-out runs (base and fixed code alike, load 40-60) show every page capture
on the phone project (device scale 2.625, a 1024x2216 PNG) taking 4-40 s: e.g. "on-tiles" 3.8 s, "live" 27.6 s, then the shutter
click 5.2 s and "review" 16.7 s - the review capture was simply the step running when the 60 s ran out. The screencast frames kept
coming during the slow captures (the page kept painting). A lower fake-camera frame rate (`fps=10`) changed nothing (same durations,
same 1 timeout in 8); capturing in CSS pixels (`scale: 'css'`) halved the typical duration of the test (A/B in parallel, mobile, 8
runs each, load ~40: 15-20 s -> 7.5-13 s; 7/8 -> 8/8).

## Fix (product), `frontend/src/tickets/camera-viewfinder.ts`

- `shoot()` is synchronous: draw the frame on a canvas, stop every track, and switch to `review` in the same click, showing THAT canvas
  as the still (`data-camvf-still`, `role="img"`, the same label as the old `<img>`). The JPEG encode starts at the same moment and
  runs while the person looks at the still. An encode failure (null blob) still ends in `camera-failed` and a closed dialog.
- `use()` ("שימוש בתמונה") uses the blob when it is ready; when it is not ready yet the button is disabled and waits for it. A retake,
  close or any exit while it waits sends nothing (generation check, as before).
- No object URL any more: the still is the canvas itself, dropped on every exit (T9 of CR-CAMVF-295-SECURITY.md updated; T3 "never put
  in a URL" now holds literally).

Unchanged: the camera is asked for only from the click; the camera is off as soon as the shot is taken; nothing leaves the browser
before "שימוש בתמונה"; exactly one upload, through the same `uploadFiles` as the file input; every track ended on every exit.

## Test change, `frontend/tests/evidence-camera-viewfinder.spec.ts`

Every product assertion is kept as it was (no camera before the click, live preview, `review` and the still after the shutter with
the default 5 s, camera off after the shot, zero uploads before "use", one upload after, the JPEG multipart, every track ended). Two
changes, both measured:
- `shot()` captures the evidence PNGs with `scale: 'css'` (cause 2). Desktop (scale 1) is unchanged; phone evidence images are now
  390x844 instead of 1024x2216 when they are regenerated.
- After "שימוש בתמונה" the dialog closes when the encode that the shutter started is done, so that single step waits up to
  `ENCODE_BOUND` (15 s: the browser's ~1 s + 5 s forced-encode bound with margin for the loaded runner) instead of the 5 s default.
  The behaviour is intended; the test was stale for it.

Tried and dropped: a memory canvas (`willReadFrequently`) for the still - one sequential A/B looked better (16/16 vs 8/16) but the
load differed between the two runs, and in parallel runs at load ~65 both variants failed alike; not proven, so not shipped.

## Tests actually run

Runner (own checkout `~/work/camvf`, own `vite preview` on 127.0.0.1, own output dirs; removed afterwards), while the gate of
CR-W2-FOLLOWUPS-2441 / CR-I18N-COMBINED-C-2442 ran beside it. Whole file = 5 tests x desktop + mobile (tablet is skipped by the spec).

| Run | Code | Command | Load (1 min) | Result |
|---|---|---|---|---|
| before | main `cc69447f1` | whole file, `--repeat-each 16 --workers 2` | 40-48 | 158/160 - 2 x signature 1 (line 101 mobile) |
| diag | main + timing logs | line 101, `--repeat-each 32 --workers 2` | ~35-45 | 62/64 - 2 x signature 1; the encode timings above |
| round 1, in parallel | main / this branch | whole file, `--repeat-each 8 --workers 1` each, both at once | 34-47 | main 79/80 (1 x signature 1) / branch **80/80** |
| round 2, in parallel | main / this branch | same | 37-61 | main 79/80 (1 x signature 1) / branch **80/80** |

In the two parallel rounds the mobile "on" test took 15-42 s on main and 6-13 s on this branch.

Investigation runs (not evidence for the verdict, listed for completeness): encode probes (toBlob vs convertToBlob), a canvas-type
A/B, a screenshot-cost A/B (control / `scale: 'css'` / fake camera `fps=10`), and runs with 8 workers. At load 60-85 (the gate plus 8
of my workers) every variant, main included, failed the mobile "on" test in most runs (captures of 20-40 s); I stopped my own
8-worker job at that point. This spec, like the other phone-project evidence specs, still depends on the runner not being overloaded.

PC: `npx tsc --noEmit` passed; `npx vite build` + `npx playwright test tests/evidence-camera-viewfinder.spec.ts --project=desktop
--project=mobile --workers=1` on a private port: 10/10 (twice, before and after the last spec change). Regenerated PNGs discarded.
`tests/unit-camera-viewfinder.spec.ts` (the model, untouched): 6/6.

## NOT_RUN

- The full frontend suite and the pixel lanes: left to the entry check.
- Real phones (Android Chrome / iOS Safari): the device rows of CR-CAMVF-295-SECURITY.md stay UNVERIFIED.
