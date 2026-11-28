# DEEP-REVIEW-2570 - FRONTEND-CORE, second pass (id prefix `FE2`)

Reviewed head: `v2.56.0` = `6ea807b2e` (read-only detached worktree; branch `review/DEEP2-2570-FRONTEND-CORE` carries only this file).
Scope: the "Not covered" list of `docs/review/DEEP-REVIEW-2560-FRONTEND-CORE.md` (origin/review/DEEP-2560-FRONTEND-CORE). The 2.56
findings FE-01..FE-06 are not re-reported; their status at `6ea807b2e` is in section 4.

## 1. Summary

| Id | Severity | Status | Title | File:line (6ea807b2e) |
|---|---|---|---|---|
| FE2-01 | medium | CONFIRMED | A sensitive scene (lock / alarm / siren / WisKey door step) can never be started from the automations scenes panel or the launcher: the server's 409 `confirmation_required` has no confirm path | `frontend/src/screens/scenes-panel.ts:275-288`, `frontend/src/api/launcher.ts:96`; server `services/automation_ops.py:1134,1138-1139,1170-1171` |
| FE2-02 | medium | CONFIRMED | Wall photos: switching folder during an upload stores the remaining photos in the other folder (a private set can land on a lobby wall) | `frontend/src/screens/wall-photo-sets.ts:86-114` (line 104), `:147` |
| FE2-03 | low | CONFIRMED | Step-up queue: a dialog queued behind another one is not cancelled by a route change before it opens, and a physical action confirmed inside its own 90 s but more than 120 s after its refusal returns the raw "confirm your identity" refusal | `frontend/src/shell/step-up.ts:28-41`, `components/sw-step-up-dialog.ts:191-198`, `api/client.ts:232-251,283-285` |
| FE2-04 | low | CONFIRMED | Scene card shows "הופעלה" (and scripts "הסקריפט הופעל") on a 202 "request sent" - the physical outcome is unknown | `screens/scenes-panel.ts:279-281,314`, `screens/scripts-panel.ts:200`; server `automation_ops.py:1158` |
| FE2-05 | low | CONFIRMED | Wall photos: a late answer shows folder A's photos under folder B (a delete then targets B with A's id); one tap on "x" deletes a stored photo for good | `screens/wall-photo-sets.ts:67-69,115-122,147,155` |
| FE2-06 | low | CONFIRMED | Building presence times ("empty since HH:MM", reading time) always on the Israel clock; no caller passes the installation zone | `api/building-presence-logic.ts:15,23,81,244,299,316,367,404`; callers `screens/building-presence-chip.ts:73`, `screens/building-presence-widget.ts:208`, `screens/devices-area.ts:1532` |
| FE2-07 | low | CONFIRMED | Messaging pacing card: the mode select and the rate fields keep a value the server refused | `screens/messaging-pacing-card.ts:81-95,167-169,177-180` |
| FE2-08 | low | CONFIRMED | Messaging policy: removing an allow-list entry and switching "enforce" on with an empty list (blocks every outgoing message) take effect on one click | `screens/messaging-policy-card.ts:150-153,160-161` |
| FE2-09 | low | CONFIRMED | Scenario editor: no generation check on `openEditor` / `showRuns` / `runDry` answers (a fast switch shows / marks the other scenario); delete has no busy guard | `screens/scenarios-panel.ts:163-193,362-375,425-436,438-446` |
| FE2-10 | low | CONFIRMED | Cast countdown and "running out" warning compare the server's `expires_at` with the device clock | `screens/cast-logic.ts:54-77`, `components/cast-store.ts:18,47,81,95` |
| FE2-11 | low | PLAUSIBLE | Floor bake: a chunk-load or renderer failure after the job was claimed leaves it locked for the 10-minute lease | `screens/floor-stills.ts:76-113`; server `services/plan_bakes.py:24,1027` |
| FE2-12 | low | PLAUSIBLE | Presence chip keeps its last answer for the life of the page when reads fail (a wall tablet off the server for hours still says "occupied") | `screens/building-presence-chip.ts:65-71` |
| FE2-13 | low | CONFIRMED | Wire drift: Diagnostics reads `ha/status` `bridge.integration_version`, which the server never sends (hand-written type allows it, the generated model does not) | `screens/system-diagnostics.ts:2266`, `api/ha.ts:143`; server `routers/ha.py:74`, `wire/ha.py:33-37` |
| FE2-14 | low | CONFIRMED | 47 of the 106 generated `wire-*.ts` families are imported nowhere; HA, intercom, WisKey and access-control screens use hand-written types that `tsc` never checks; the door release answer has no model at all | `frontend/src/api/generated/` (e.g. `wire-ha.ts`, `wire-intercom-*.ts`, `wire-access-control-*.ts`, `wire-wiskey-*.ts`), `api/intercom.ts:299` |
| FE2-15 | low (latent) | CONFIRMED | The Arabic and Russian `wiskey-managed` tables are ~91 of 119 keys English (`...en` spread); the ar/ru completeness spec cannot see it | `i18n/lang/ar/i18n/wiskey-managed.ts:4-7` (ru identical), `i18n/.../wiskey-managed.ts:136,139`, `scripts/i18n_missing_keys.mjs` |
| FE2-16 | low | CONFIRMED | Tab-mode / dropdown preference saves are optimistic with a per-call `before`: a failed earlier save reverts over a later successful one | `shell/tabs-mode.ts:400-417,461-477,736-810` |
| FE2-17 | low (tests) | CONFIRMED | The FC-01 guard `unit-controlled-toggles-2540` is a hand-kept per-file count, so FE-02 (home administration switches) is still open at 2.56.0 and the guard passes; most shared-component specs assert source text, not behaviour | `tests/unit-controlled-toggles-2540.spec.ts`, `tests/unit-sw-table.spec.ts`, `tests/unit-sw-tabs-2460.spec.ts`, `tests/unit-user-menu-sections.spec.ts`, `tests/unit-modal-stack-2441.spec.ts` |

Counts: critical 0, high 0, medium 2, low 15.

## 2. Findings

### FE2-01 (medium) - a sensitive scene cannot be started from the scenes panel or the launcher

- `screens/scenes-panel.ts:275-288` (`activate`) calls `activateScene(i.id)` with no options. `api/automations.ts:607` supports
  `{ confirm, client_request_id }`, but nothing on this path ever passes `confirm: true`.
- Server `services/automation_ops.py` `apply_scene`: `_door_plan(...)` (line 1134) refuses an item with a WisKey door step without
  `confirm` (409 `confirmation_required`, line 1170-1171); then `(facts["sensitive"] or facts["unknown_effects"]) and confirm is not True`
  -> 409 `confirmation_required` (1138-1139). A scene that touches a lock, the alarm or a siren is `sensitive` (bridge rule, line 474-490).
- The catch at `scenes-panel.ts:283` only shows the message "פעולה זו דורשת אישור מפורש." There is no confirm dialog and no retry.
- `api/launcher.ts:96` (the quick launcher) has the same gap. Outside area (7 MAPS-HOME): `screens/area-quick-sheet.ts:582-591` calls
  `activateScene(it.id)` and swallows every error, so there the press does nothing at all, with no message.
- Contrast: `scripts-panel.ts:192-209` checks `runNeedsConfirm`, catches the 409, opens "להפעיל עכשיו?" and re-sends with `confirm: true`;
  the home screen asks first (`home/sw-home.ts:928`).

Failure scenario: an operator presses "הפעל" on a "leaving home" scene that arms the alarm and locks the door. The server refuses with
"requires explicit confirmation"; the panel offers no way to confirm. The scene can never be started from the automations screen or
the launcher (fail-safe - nothing runs - but the feature is broken for exactly the scenes that matter).

Fix: copy the scripts-panel pattern (a `confirm` state, a dialog with the scene's effects, `runNeedsConfirm(i)` first, on
`confirmation_required` open the dialog and send again with `{ confirm: true }` and the same `client_request_id`). Same in the launcher
and the area quick sheet. Regression spec: a sensitive scene gets 409, the dialog opens, confirming sends exactly one more POST with
`confirm: true`; cancelling sends none.

### FE2-02 (medium) - photos uploaded to the wrong wall folder

- `screens/wall-photo-sets.ts:86-114` (`upload`): the loop calls `uploadSetPhoto(this.current, f)` (line 104), reading `this.current`
  again for every file.
- While it runs only the file input is disabled (`?disabled=${this.busy}`); the folder buttons (line 147) stay live and set
  `this.current = s.id`.

Failure scenario: an administrator uploads 30 family photos to a private folder and, while it runs, clicks the "Lobby" folder to look
at it. Every remaining photo is stored in "Lobby", which a lobby wall display shows. A privacy leak on a public screen; the progress
line gives no hint.

Fix: `const setId = this.current;` before the loop and use it; disable the folder buttons (and "new folder" / delete) while `busy`.

### FE2-03 (low) - step-up queue: a queued dialog outlives its screen; a late physical confirmation returns the raw refusal

- `shell/step-up.ts:28-41`: a refusal for another action (or any once-action) waits for the open dialog (`queue.then(...)`) before its
  own dialog is created.
- `components/sw-step-up-dialog.ts:191-198`: the 90 s expiry timer and the `hashchange` cancel (SCR-23: "the request belonged to the
  screen that is gone") are installed only in `connectedCallback`, i.e. when the queued dialog finally opens.
- `api/client.ts:234-251`: `refusedAt` is taken before `onStepUp` (so the queue wait counts), and `replayAllowed` (283-285) refuses a
  physical replay after `STEP_UP_REPLAY_MS = 120_000`. When it refuses, `fetchApi` returns the ORIGINAL 403 `step_up_required` (not the
  `pressAgain` answer FE-01 added for the stale-envelope case).

Failure scenario A: a settings save and a door release are refused at the same moment (e.g. the incoming-call banner's door button
while the settings code dialog is open). The user leaves the screen; the settings dialog is cancelled by the route change, and the
queued "פתיחת דלת" dialog then opens on the new screen for a request of the screen that is gone. Confirming it opens the door (if within
120 s). The dialog does name the action, so this is a consistency gap with SCR-23, not a silent unlock.
Failure scenario B: the first dialog took 60 s; the door dialog is confirmed 70 s after it opened (inside its own 90 s). The client
refuses the replay (130 s > 120 s) and the screen shows "צריך לאשר שוב את הזהות" right after the person confirmed.

Fix: measure the physical window from the moment the dialog opened (pass a `shownAt` back with the answer) or start the 90 s / route
cancel at enqueue time; drop queued physical requests on `hashchange`; return `pressAgain(details)` instead of the raw 403 when
`replayAllowed` says no. Spec: two refusals, route change while the first is open -> the second never opens and nothing is sent.

### FE2-04 (low) - "activated" on a request that was only accepted

`screens/scenes-panel.ts:279-281` marks the card `done` (green, "הופעלה", line 314) as soon as `activateScene` resolves; the server
answers 202 with `note: "הבקשה נשלחה."` (`automation_ops.py:1158`) - the bridge accepted the request, the devices' outcome is not known.
`screens/scripts-panel.ts:200` says "הסקריפט הופעל" the same way. Against the honest-outcome rule for physical actions.
Fix: say "נשלחה" / "הבקשה נשלחה" (the server's own words), as the other physical paths do (`api/physical-outcome.ts`).

### FE2-05 (low) - wall photos: stale list, one-tap delete

- `wall-photo-sets.ts:67-69` (`loadPhotos`) writes `this.photos` with no check of which folder the answer belongs to; the folder buttons
  (147) call it on every click. Click A then B: if A answers last, A's photos show under B's heading; their "x" then calls
  `deleteSetPhoto(B, idOfA)` (115-122) and fails 404.
- `wall-photo-sets.ts:155`: "x" deletes a stored photo with no confirmation and no undo (the folder delete does confirm, 156). SCR-25 class.
Fix: `const id = this.current` and drop the answer when it changed; confirm (or undo) the photo delete.

### FE2-06 (low) - building presence on the Israel clock

`api/building-presence-logic.ts` defaults `zone = 'Asia/Jerusalem'` in every formatter (lines 15, 23, 81, 244, 299, 316, 367, 404) and
no caller passes a zone: `building-presence-chip.ts:73` (`chipView(this.snap)`), `building-presence-widget.ts:208` (`compactView`),
`devices-area.ts:1532` (`areaLineView`, area 7). An installation in another zone shows "ריק מאז HH:MM" and the reading time in Israel
time (AGENTS.md: convert by the installation's IANA zone). Fix: pass the installation zone (the home config already carries
`time_zone`, `api/home-config.ts:402,415`) or have the snapshot carry it.

### FE2-07 (low) - messaging pacing: select and number fields keep a refused value

`messaging-pacing-card.ts:167-169` (`?selected` on the mode options) and `177-180` (`.value` of `per_minute` / `burst`): on a failed
`save()` (81-95) `this.view` is unchanged, so Lit does not touch the controls; they keep showing the refused value and only the red line
says it was not saved (FC-01 class for non-switch controls; the card's switch is `controlled` and fine). Fix: `live()` bindings, or
re-render from a reloaded view in the failure path.

### FE2-08 (low) - messaging policy: delivery-blocking changes on one click

`messaging-policy-card.ts:160-161`: "remove" deletes an allow-list entry at once (only the last 4 digits are shown, so adding it back needs
the full number). `150-151`: turning "enforce" on with an empty list blocks every outgoing message; the warning (153) appears only after
it took effect. Fix: confirm when the change blocks delivery (enforce on with an empty list; removing the last entry while enforce is on).

### FE2-09 (low) - scenario editor: stale answers and a double delete

`scenarios-panel.ts:163-193` (`openEditor`) does not compare the `getScenario(id)` answer with the id still wanted: open card A then B on
a slow link and A's answer may fill the drawer while the address says B. `showRuns` (438-446) and `runDry` (362-375, which sets
`tested_version` on whatever scenario is open when it returns) have the same shape. `removeScenario` (425-436) has no busy guard: a double
click sends two DELETEs and the second reports "not found" after "deleted". Fix: a generation token (`LoadGeneration`,
`floor-map-state.ts`) and a busy guard on delete.

### FE2-10 (low) - cast countdown on the device clock

`screens/cast-logic.ts:54-77` (`msLeft`, `leftText`, `isLow`) compare the server's `expires_at` with `castStore.now = Date.now()`
(`components/cast-store.ts:18,47,81,95`); shown in `sw-cast-pill.ts:262,270`, `live-camera.ts:985`, `system-cast.ts:395`. A tablet 3 min
behind shows 3 extra minutes and warns late. Display only (FE-03 / FE-04 class). Fix: `serverNow()` in cast-store.

### FE2-11 (low, PLAUSIBLE) - floor bake left claimed

`screens/floor-stills.ts:76-113`: after the job is claimed (77), a failing `import('../map/bake-runner')` / `sw-plan-3d` (89 - exactly
the case of a page left open across an update) or a throwing renderer constructor (90) reaches the catch (111), which returns the error
text without `finishBake(..., 'failed')`. The job stays claimed until its 10-minute lease (`services/plan_bakes.py:24,1027`), so no other
editor can bake meanwhile; it clears by itself. Fix: in the catch, once claimed, `await finishBake(..., 'failed', why).catch(() => undefined)`.

### FE2-12 (low, PLAUSIBLE) - presence chip never ages out

`building-presence-chip.ts:65-71`: a failed read keeps the last snapshot indefinitely, with no stale marker. A wall tablet that lost the
server for hours keeps saying "occupied · 3 rooms". Fix: after N failed reads, or when the snapshot's `at` is older than a few poll
intervals, show the unknown state.

### FE2-13 (low) - wire drift: `bridge.integration_version`

`screens/system-diagnostics.ts:2266` reads `this.ha?.integration?.active_version ?? this.ha?.bridge.integration_version ?? null`. The
hand-written `HaStatus` (`api/ha.ts:143`) allows `bridge.integration_version`; the server builds `bridge` with paired / paired_at /
directory_users / last_directory_at only (`routers/ha.py:74`), and the generated model `HaStatusBridge` (`wire/ha.py:33-37`, an
`ExactModel`; `generated/wire-ha.ts`) has no such field. The value the bridge reports is stored in the setting `bridge.integration_version`
(`routers/ha.py:748,794`) but never sent. When the add-on's own integration copy is not active (not_available / not_installed /
installed_pending, e.g. a bridge installed by hand) the support card shows "unknown" although the server knows the version.
Fix: add the field to `ha/status` `bridge` (model + regenerate) or drop the dead fallback; then switch `api/ha.ts` to the generated type (FE2-14).

### FE2-14 (low) - most generated wire families are not consumed

`scripts/gen_wire_types.py --check` is clean at `6ea807b2e` (run, exit 0: every committed `generated/wire-*.ts` matches the models), and
`scripts/wire_ratchet.py --list` holds the baseline (897 unmodelled routes). But 47 of the 106 generated files are imported nowhere in
`frontend/src` - among them `wire-ha`, `wire-intercom-calls/listen/media`, `wire-access-control-reads/writes/people/profiles/ops/diag/
capture/door-tech/station-ops/station-people/triage/wa-queue/messaging`, `wire-access-grants`, `wire-access-station-permissions`,
`wire-cast`, `wire-health`, `wire-backup`, `wire-settings`, `wire-storage`, every `wire-wiskey-*`. Those screens use hand-written types
that `tsc` never compares with the server (FE2-13 is one result). The WisKey door release answer has no model at all (`FAMILIES_D` names
`wire-access-control-door.ts`, no file is generated; the ratchet lists `POST /intercom/stations/{id}/release`, door hold and door program
as unmodelled), so `IntercomReleaseReply` (`api/intercom.ts:299`, requires `state`, `configured`, `last_error`, `fetched_at`) does not
describe the signed-transport answer (`{release:{accepted:true}, command_id, door_request_id, note}`, `routers/access_control_door.py`);
harmless today (the three callers ignore the value).
Fix: move `api/ha.ts`, `api/intercom.ts` and the access-control clients to the generated types, model the door release / hold / program
routes, and add a ratchet "generated but not imported" that may only go down.

### FE2-15 (low, latent) - ar/ru `wiskey-managed` is mostly English

`i18n/lang/ar/i18n/wiskey-managed.ts:4-7` (ru identical) is `{ ...en, <28 own keys> }`; the Hebrew table has 119 keys, so ~91 (adoption,
upgrade, rollback, risk-acceptance texts) are English inside the Arabic / Russian tables. `scripts/i18n_missing_keys.mjs` counts a gap only
for Hebrew letters and checks the script (Cyrillic in ar / Arabic in ru), so `tests/unit-i18n-arru-completeness-2550.spec.ts` passes;
the `packTable` cast (`wiskey-managed.ts:136,139`) hides missing keys from `tsc`. Latent: `UI_LANGS = ['he','en']`
(`i18n/ui-lang-boot.ts:5-6`), so no user can choose ar / ru today. Fix: translate or drop the spread; add an "identical to English, Latin
only" check for ar / ru entries.

### FE2-16 (low) - preference saves revert out of order

`saveOwnTabsMode` (`shell/tabs-mode.ts:736-752`), `saveOwnDdStyle` / `Size` / `Phone` (755-810), `Dial.save` (400-417) and `Choice.save`
(461-477) each keep their own `before` and restore it on failure. Two quick changes A then B: B succeeds, A's PUT fails afterwards ->
the state is put back to what it was before A, while the server holds B. The screen shows a choice that is neither saved nor current until
the next load. Fix: a per-key sequence number - a failure restores only when no later save was started (or re-read the prefs).

### FE2-17 (low, test quality) - guards that cannot see the bug

- `tests/unit-controlled-toggles-2540.spec.ts` counts `<sw-toggle controlled` per file in a hand-kept list. A file not on the list is
  never checked: `home/sw-home-admin.ts` is not listed and its eight save-at-once switches are still uncontrolled at `6ea807b2e`
  (`:196,329,333,491-497` - FE-02 open), while the guard passes. Of 166 files with an `sw-toggle`, 123 have no `controlled` one; the guard
  cannot tell a draft switch from a save-at-once switch that was forgotten.
- The shared-component specs are mostly source-text assertions (`readFileSync` of `src` + `toContain` / `toMatch` on the code text):
  `unit-sw-table.spec.ts` (27 tests, 77 text assertions), `unit-sw-tabs-2460.spec.ts` (13 / 50), `unit-physical-confirm-2540.spec.ts`
  (13 / 35), `unit-modal-stack-2441.spec.ts`, and `unit-user-menu-sections.spec.ts` (both tests read the source). They fail on a refactor,
  but they cannot catch a behaviour bug (e.g. a `close` handler that fires twice).
- No spec covers the step-up dialog's own 90 s expiry or its `hashchange` cancel (`expiresMs` appears in no spec); the client window
  (`STEP_UP_REPLAY_MS`) is covered (`unit-client-resilience-2540.spec.ts:157-200`).
Fix: make the controlled guard structural (every `sw-toggle` whose `@change` calls a save / `put` / `post` must be `controlled` or carry an
explicit `// draft` marker), and add behaviour specs for the shared components (node + a minimal DOM, as `unit-fix-server-clock-2560`
does for the client) and for the dialog expiry / route cancel.

## 3. Tests run (real results)

All on the runner (slot B, `~/work/p2570r_fe` = detached worktree of `6ea807b2e`, frontend deps linked from the runner checkout).

| What | Command | Result |
|---|---|---|
| App typecheck | `npx tsc --noEmit -p tsconfig.json` | PASS (exit 0) |
| Tests + scripts typecheck | `npm run -s typecheck` | PASS (exit 0) |
| Node-only unit lane (all 600+ `unit-*` specs that do not need a page; covers every area spec listed below) | `npx playwright test -c playwright.unit.config.ts --workers=2 --reporter=line` | PASS: 5539 passed, 18 skipped, 0 failed (1.8 min) |
| The area's page-unit specs | `SW_UNIT_PAGES=1 ... tests/unit-step-up-ui.spec.ts tests/unit-session-me-failure-2435.spec.ts --workers=1` against a Vite dev server | PASS: 10 passed, 4 skipped (the screenshot cases, which need `SW_SHOTS_DIR`) |
| Wire types (PC, repo `.venv`, read-only) | `python -I scripts/gen_wire_types.py --check`; `python -I scripts/wire_ratchet.py --list` | PASS: exit 0 (no drift); exit 0 (897 unmodelled = baseline) |
| ar / ru key parity (PC, scratchpad script over `src/i18n/lang/{ar,ru,en}`) | ad-hoc comparison | ar = ru key sets in all 36 files (3041 keys each), placeholder sets ar = ru = en, no empty ar / ru values; FE2-15 found |

Area specs in the node-only lane (sampled for assertion strength): `unit-client.spec.ts`, `unit-client-path`, `unit-client-blob`,
`unit-client-resilience-2540`, `unit-step-up-client`, `unit-step-up-queue-2540`, `unit-fix-server-clock-2560`, `unit-arx-resilience-2540`,
`unit-controlled-toggles-2540`, `unit-confirm-words-2442`, `unit-physical-confirm-2540`, `unit-modal-stack-2441`, `unit-modal-stack-guard-2442`,
`unit-sw-table`, `unit-sw-tabs-2460`, `unit-dropdown-fit`, `unit-user-menu-sections`, `unit-reconnecting-socket-2435`, `unit-lows-frontend-2550-*`,
`unit-i18n-*` (incl. `unit-i18n-arru-completeness-2550`), the `*-nav` specs. Strong (behaviour, stubbed fetch / clock, both outcomes):
`unit-fix-server-clock-2560`, `unit-client-resilience-2540`, `unit-step-up-client`, `unit-session-me-failure-2435`, `unit-step-up-ui`.
Weak (source text only): see FE2-17. No spec found that cannot fail at all.

NOT_RUN: the evidence / layout / pixel suites (`playwright.config.ts`), the other 34 page-unit specs, a production build, lint, and any
browser run of the findings (each finding is confirmed by reading the path end to end, not by a failing test).

## 4. Status of the 2.56 findings at `6ea807b2e`

| Id | Status | Evidence |
|---|---|---|
| FE-01 | FIXED (FIX-SERVER-CLOCK-2560) | `api/client.ts:239-250` `freshEnvelope` / `pressAgain`; spec `unit-fix-server-clock-2560` (ran, PASS). Residual in FE2-03 (the `replayAllowed` path still returns the raw 403) |
| FE-02 | OPEN | `home/sw-home-admin.ts:196,329,333,491-497` still plain `sw-toggle` with `?checked`; not in any 2.56 change note; see FE2-17 |
| FE-03 | FIXED (FIX-SERVER-CLOCK-2560) | `api/server-clock.ts:16,29` (`SAMPLE_MAX_RTT_MS = 2_000`) |
| FE-04 | FIXED (FIX-SERVER-CLOCK-2560) | `api/alarm.ts:55` and `api/ha.ts` `runAction` on `serverNow()`; FE2-10 is the display-only remainder |
| FE-05 | OPEN | bare `decodeURIComponent` still in the five files (`automations-logic.ts:46`, `devices-automations.ts:544`, `devices-schedules.ts:339`, `infra-generator.ts:205`, `home/home-recordings.ts:169`); no new file of this area adds one |
| FE-06 | FIXED (FIX-PUSH-APPROVAL-2560) | `shell/push-approval-watch.ts:49-61` resets `showing` on every path |

## 5. Checked and fine

- `components/sw-step-up-dialog.ts` end to end: one answer only (`resolver` nulled first), expiry and `hashchange` cleared in `answer`
  and `disconnectedCallback`, an open phone approval cancelled on a negative answer, push poll stops when the dialog is gone, 429 back-off,
  the code field never sent when invalid, the refused action named, recovery codes never offered for once-actions. (A verify still in flight
  when the 90 s expire records a proof server-side while the client answers "not confirmed" - nothing is replayed; acceptable.)
- `shell/step-up.ts` keying (same action shares, once-actions each their own) - apart from FE2-03.
- `shell/nav.ts`: `TAB_PERMISSIONS`, `NATIVE_WISKEY_TABS`, `INSTALLATION_ONLY_HREFS`, `tabAllowed`, `visibleTabs`, `permittedTabs`,
  `visibleAreas`, `settingsEntry`, `landingTarget`, `parseRouteLite`, `legacyRedirect` (maintenance sticker token pattern, query carried,
  nothing decided while the session loads), `demoRedirect`, `liveOverviewTarget` (no redirect loop), `securityTarget`, `crumbsOf`,
  `activeAreaTab`. Navigation visibility only; every screen's server call checks its own permission. Noted, not a finding: the calendars
  rail entry (`withCalendarsArea`) has no `calendar.view` check while the home tab has one - calendar access is per calendar on the server.
- `shell/tabs-mode.ts` (apart from FE2-16): cache keyed by user id, server copy wins after load, stale answer for another user dropped,
  `TabsModeController` listener balance.
- `shell/header-fit.ts`: `FitScheduler` (no tick while hidden, settle / idle rhythm, stop clears timer and visibility listener),
  `HeaderFit` (pump cancelled on disconnect, ResizeObserver re-targeted only when the observed set changes).
- `shell/sw-user-menu.ts`: sections dropped on level change, lazy chunks with failure logged, focus trap, Escape through the modal stack,
  sign-out and "sign out everywhere" through `arx/auth.ts logout` (revoke, push row dropped first, session DELETE, native told once).
- `components/sw-drawer.ts` (dialog open / close, stale native `close` ignored after disconnect, nested confirmation keeps Escape, scroll
  lock released), `components/sw-dropdown.ts` (outside-press, close timer, inert page released on close and disconnect, visual-viewport
  listeners balanced, `multiple` limit and disabled options), `components/sw-table.ts` (row-select listener count, keyboard rows),
  `components/sw-tabs.ts` (`controlled`, roving tabindex, dropdown mode), `components/sw-sheet.ts` (listeners, Escape via the stack).
- `vite.config.ts` (build id from `config.yaml`, relative base for Ingress, service worker and TV entries, three chunks),
  `vite.public.config.ts` (separate output outside `www`, no inline script / style, no data: URLs, no source maps), source maps archived
  out of the add-on (`scripts/sourcemaps-archive.mjs`, release check fails on a `.map`).
- `frontend/public/`: manifest (relative scope / start URL), `home-paint.js` (reads only a validated colour from this origin's storage,
  classic script for CSP), fonts with their OFL texts (lobby fonts bundled from `src/notice-tv/*`, licences shipped), Plan 3D assets with a
  per-file manifest (CC0 only, sha256, checked by `unit-plan3d-assets`).
- Small screens read in full or by their write paths: `scripts-panel.ts`, `script-editor.ts`, `scenes-panel.ts` (editor, capture, save
  with revision conflict, delete to trash), `scenarios-panel.ts` (enable needs a tested version), `kiosk-wall.ts` (timers, health dimming,
  `PollController` refresh), `mb-enable-check.ts` (enable bound to the reviewed digest), `wa-installed-card.ts`, `meters-page-base.ts`,
  `media-admin-list.ts` (switch controlled, listeners), `wall-refresh.ts`, `camera-reboot-logic.ts`, `camera-source-logic.ts`,
  `privacy-mask-logic.ts`, `floor-map-state.ts`, `intercom-ops-logic.ts` (`canCancel`). A grep over all 35 small-screen files found no new
  bare route decode and no new device-clock command expiry.
- Generated types: generator check and ratchet clean; `HaRunAction` / `HaActionRecord` statuses and `HaIntegrationStatus.state` match
  the server; alarm, me, push-approval, second-factor, local passkeys, catalog, cameras, plans and doors import the generated types.
  The 2.55 "wire drift x4" is covered by `test_wire_drift_2550.py` (WIRE-DRIFT-2550; not re-run here).

## 6. Still not covered (honest)

- `shell/nav.ts` beyond the functions named above (the tab registry `TAB_SECTIONS` and the WisKey embed catalogue rebuild were sampled,
  not read line by line); `sw-dropdown.ts` render and placement code (`place`, `renderItems`, the six styles' CSS) and `sw-sheet.ts` /
  `sw-tabs.ts` scrolling and styles were sampled only.
- Small screens by grep / exports only: `bubble-demo.ts`, `bubble-sliders.ts`, `styleguide-screen.ts`, `tree-unassigned.ts`,
  `building-presence-widget.ts` render, `wall-arrangement/count/grid/phone-bar.ts`, `media-cast-label.ts`, `media-integration-names.ts`,
  `media-admin-form-css.ts`, `camera-discovery-logic.ts` (credential pairing logic), `media-admin-list-logic.ts`; not read: the `water/`
  directory and the `kiosk-wall.ts` styles.
- The 47 unimported generated families were not compared field by field (FE2-14 names the gap); route payloads that no backend test
  reaches were not checked (`scripts/wire_route_coverage.py` needs a recorded pytest run).
- `scripts/i18n_missing_keys.mjs` itself was not run on the PC (the completeness spec that wraps it ran and passed on the runner); the
  he / en-only `msg/*` `tr()` tables have no ar / ru and were not compared.
- No browser run of any finding; the 34 other page-unit specs and the evidence / pixel suites were not run.
- Outside area, noted only: `screens/area-quick-sheet.ts:582-591` (FE2-01, swallows every scene error); `screens/devices-area.ts:1532`
  (FE2-06).
