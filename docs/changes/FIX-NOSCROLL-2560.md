# FIX-NOSCROLL-2560 - the announcer made every control screen scroll

Row of the 2.56 train; blocks the release. Base: `origin/release/2560-train` @ 3739e3ded.

## Finding

The 2.56 full gate (57de3270c) stopped at the early layout stage: 102 failures "vertical overflow of <screen> at <size>" in
`layout-noscroll-1366.spec.ts`, `evidence-noscroll-295.spec.ts` and `layout-timescrub-noscroll.spec.ts`. Every failure measured the
same thing: the document overflowed by 14-15px (one `1em` of the skin's body font: tesla/crystal 14, classic/domus 15); the shell's
`<main>`, the screen wrapper, the screen and every panel were at 0.

Cause (A11Y-FOLLOWUPS-2560, `frontend/src/components/announcer.ts`): the live-region host `#sw-announcer` is appended as the LAST child
of `<body>` with `position:absolute; inline-size:1em; block-size:1em` and no offsets. An absolute box without offsets sits at its static
position - below the full-height app shell - and its 1em box extended the document's scroll area by 1em.

Bisect (runner, `layout-noscroll-1366.spec.ts` alarm / live / tickets-mine at 1366x768, desktop):

| commit | what | result |
|---|---|---|
| ad778e4ea | v2.55.0 | 3 passed |
| 809326af5 | train, before the A11Y-FOLLOWUPS merge (CORE10-EVENTLOOP merged) | 3 passed |
| 6da512f2d | Merge A11Y-FOLLOWUPS-2560 | 3 failed (doc 14-15px) |
| 3739e3ded | train head | 3 failed (doc 14-15px) |

The other merges after v2.55.0 do not touch the shell layout (OPEN-FINDINGS changes screen code only; the rest no frontend source).

## Fix

`announcer.ts`: the host is `position:fixed` at the viewport's top corner (`inset-block-start:0; inset-inline-start:0`), 1px, clipped
(`clip`, `clip-path:inset(50%)`), `pointer-events:none`. A fixed box never adds to the document's scroll area. The regions, their roles,
`aria-live`, `aria-atomic`, the light-DOM placement (direct child of the body) and the announce logic are unchanged.

Not changed: `sw-button`'s hidden `description` span (`.sr` from `styles/fragments.ts`) is 1px and used only inside the step-up dialog;
it is not part of the failures.

## Tests

New: `a11y-new-2550.spec.ts` "announcer: takes no room - inside the viewport, the document does not scroll" (1366x768).

Results (runner, slot B, job `~/work/p2520_noscroll_run.sh`; vite build + preview; projects desktop + mobile; workers 2; no retries):

| run | commit | result |
|---|---|---|
| before: new announcer tests (tests from 08edae18d) | 3739e3ded (train head) | 2 failed (desktop + mobile: announcer box 14.5px tall, below the shell), 2 passed (the existing announcer test) |
| after: `layout-noscroll-1366.spec.ts` (full file) | 08edae18d | 66 passed, 66 skipped (mobile project; the viewports are set by the test) |
| after: `evidence-noscroll-295.spec.ts` (full file) | 08edae18d | 25 passed, 25 skipped (same) |
| after: `layout-timescrub-noscroll.spec.ts` (full file) | 08edae18d | 10 passed |
| after: `a11y-new-2550.spec.ts` (full file: live regions present and announced, button descriptions referenced, axe) | 08edae18d | 64 passed, 2 skipped |

NOT_RUN: tsc / eslint (one inline style string and one spec test changed; the train's gate runs them), the rest of the gate.

UI changed: the shipped `smplwise_vms/www` must be rebuilt by the train (this branch does not rebuild it).
