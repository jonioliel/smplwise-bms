# FIX-2438-REDS: the two RED entry checks of 18.11 (LOCAL-USER-CREATE e26f001ec, DOMUS-DEFAULT 2771a0b90)

Branch `pilot/FIX-2438-REDS`, cut from `origin/release/2438-train` @ `aa20f05ae` (2026-11-18 evening). Both branches are merged
into the train anyway (owner acceleration c); this branch fixes the two failures forward so the 2.43.8 release gate does not hit
them. No device, lab, NVR, go2rtc or Home Assistant contact. No entry check queued (the train release gate covers it).

## A. evidence-tickets-drawer.spec.ts:40 and :87 [mobile] (entry pilot/CR-LOCAL-USER-CREATE-2438 @ e26f001ec)

**Failure.** Both tests hit the 60 s test timeout, first run and isolated retry (1 worker): `:40` waiting for the overview panel
after the 9th-10th app boot, `:87` once in `page.goto` (waiting for `load`) and once in `page.screenshot`. Desktop passed.

**Cause: a test budget too small for the work, exposed by runner load - pre-existing on main, not this branch.**
`:40` boots the app ten times (five skins x light/dark, seven screenshots), `:87` nine times; every step already waits on a
settled marker, but the 60 s default leaves ~6 s per boot on a phone-sized page. Evidence (runner, `~/smplwise-results`):
- main nightlies, phone `:40`: 33.4 s (cc69447f1), 51.3 s (4a345f8af), 39.5 s, 45.5 s, 28.6 s - and **TIMED OUT on main
  0a8fb55e1, retry included**. Same spec on other entry checks: timed out on DOMUS 98d8d4b44, POLISH-PHONE 8e7b0c439,
  HOME-V3-AUDITFIX 4b969588b; 45.3 s on I18N-C 89d53b12d. On the LOCAL-USER-CREATE run `:147` took 57.6 s too (4-43 s elsewhere):
  the whole phone tickets chunk was slow, not one screen.
- The branch changes the Arx local-users screen, `sw-button` (a submit button submits its host form) and the session cache; the
  tickets drawer has no submit `sw-button`, no form, and no session-cache path in the mock.

**Fix (test).** `test.setTimeout(240_000)` in the spec's `beforeEach`, the budget every sibling ticket evidence spec already
uses (conversation, ui6, s2, s4, costs, handlers, rfq2/4 ...). The waits stay marker-based; nothing is slept. No quarantine.

## B. evidence-media-queue.spec.ts:425 [desktop] (entry pilot/DOMUS-DEFAULT-2439 @ 2771a0b90)

**Failure.** `expect([data-mc-token-input]).toHaveCount(0)` received 1, first run and retry: the token field was still there
after "save". The page snapshot of the repro: token line "לא הוגדר" (not set), the token field EMPTY, its save button disabled.

**Cause: a real product race in `media-ma-connection` (settings > multimedia > connection), plus a test that hid it.**
- `save()` reset BOTH drafts after ANY save: `this.url = conn.url; this.token = ''`. Saving the address while the installer
  types the token wiped the typed token when the address answer landed; the token save button then went disabled (draft
  shorter than 16) and the click on it did nothing (a disabled native button inside `sw-button` swallows the click). Likewise a
  token save reset an address being edited.
- The test clicked "save address" and typed the token at once, without waiting for the save to settle, and asserted
  `toContainText('הוגדר')` - which "לא הוגדר" also contains, so it passed the unsaved state and failed one line later.
- Timing decides who wins. On main the address answer lands first (3/3 pass, 9-10 s); on the DOMUS head (Domus the default
  skin) the typing wins: reproduced 2 of 3 runs on the runner. Same code on DOMUS 98d8d4b44 passed once - a race.

**Fix (product + test).**
- `frontend/src/components/media-ma-connection.ts`: a save resets only the draft it sent (`url` -> the address draft; `token` /
  `clear_token` -> the token draft and the edit mode). The host reflects `aria-busy` while a save / test is in flight (the
  settled marker; also tells assistive tech).
- `frontend/tests/evidence-media-queue.spec.ts:425`: waits for `aria-busy="false"` after each save and for the native token save
  button to be enabled before clicking it; the token line is anchored (`/^\s*הוגדר/`).
- New regression test (same file, "a token typed while the address is still saving is kept"): holds the address PUT, types the
  token meanwhile, releases; the token draft must survive and be the one saved (PUT bodies `[{url}, {token}]`).

## Tests actually run

- Runner (load 43-54, a gate running; own worktree `~/work/redfix-b`, `nice -n 10`, `--workers=1 --retries=0`, vite dev):
  - `:425` unpatched on DOMUS 2771a0b90: 1 passed, **2 failed** (reproduced). On origin/main cc69447f1: 3/3 passed.
  - `:425` with this fix applied on DOMUS 2771a0b90: 7/7 passed; the new regression test: 3/3 passed.
- Drawer (A): a repro chain was started on the runner (`~/work/redfix-chain-a.sh`: phone `:40`/`:87` x3 on e26f001ec and on
  main cc69447f1 with vite preview builds, then the whole spec x2 with this fix). Its results were NOT read before this branch
  was pushed: logs `~/work/redfix-a-*-preview.log`. The A diagnosis rests on the gate history above.
- Workstation: `npx tsc --noEmit` (frontend) clean.

## NOT_RUN

- The full frontend / backend suites: the train release gate runs them.
