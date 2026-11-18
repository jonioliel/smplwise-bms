# CR-WISKEY-NOTIF-2443 - people screen subscription, lookups and poll; notification settings section guard and mail draft

Branch `pilot/CR-WISKEY-NOTIF-2443`, cut from `origin/release/2438-train` at aa20f05ae. Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) row `pilot/CR-WISKEY-NOTIF-2436` (renumbered 2443), group G2 of
`private/planning/REMAINING_WORK_2026-11-18.md`. No version bump, no backend change, no pixel change, no wording change
(owner decision O8 is not touched: no text was edited).

## Findings covered

### 06:WK-1 (`screens/wiskey-people.ts`, `wiskey-person-editor.ts`, `wiskey-format.ts`)

- **Late permission never subscribed.** `connectedCallback` returned early on "forbidden" before `subscribeIntercom`, and the
  session listener's late-permission branch only called `begin()`: a viewer granted `access.people.read` while the screen was
  open got the list but never the change notices (no refresh on a change, no fallback poll). The subscription moved into an
  idempotent `subscribe()` called from `begin()`, so the first open, the late-permission path and the retry button all end up
  subscribed exactly once.
- **Lookups per render.** The drawer's three `Object.fromEntries` maps and the bulk dialog's two arrays were rebuilt on every
  render (each search keystroke). `peopleLookupsMemo()` (in `wiskey-format.ts`) rebuilds them only when the station or group
  array is replaced; same values as before.
- **Import cycle.** `syncBadge` was exported by the screen and imported back by the editor the screen imports. It moved to
  `wiskey-format.ts` unchanged (same table); the editor imports it from there. The different `syncBadge` of
  `access-control/station-permissions-logic.ts` is a separate contract and stays.

### D2 / 06:POLL-1 for the people screen

The fallback poll (only while the change-notice socket is down) was a bare `setInterval` ticking the 800 ms coalesced
refresh. It is now `PollController` (`components/poll-controller.ts`, from CR-POLL-SCREENS-A): same 30 s period, the read is
`refresh()` itself (which already single-flights and queues), nothing while the page is hidden, one catch-up read on resume.
The socket-connected catch-up and the notice coalescing are unchanged.

### 06:NOTIF-1 (`screens/system-notifications.ts`)

- **Section id guard.** The screen cast any string to its section id (`e.detail.id as SecId`, the route's `section`); an id that
  is not a section (e.g. `quiet-windows`, a block inside the quiet section) made `sections[this.sec]()` throw. New
  `notifySection(id)` in `components/notify-logic.ts` accepts only the nine ids; `setSec` and `willUpdate` go through it.
- **A revision conflict discarded an unsaved mail form.** `conflict()` reloads all settings, and the reload refilled the mail
  form from the server. New `mailDraftAfterReload(draft, before, after)`: a form that differs from what the previous settings
  would fill (`mailDraftDirty`) is kept as typed; a clean one follows the new settings. `MailDraft` and `mailDraftOf` moved from
  the screen into `notify-logic.ts` so they can be unit-tested (same fields, same mapping).
- **Not applicable any more:** the IntersectionObserver re-arm on phone/desktop and "every mail keystroke re-renders all nine
  sections" - since AUDIT30-I6 (owner Q11 a) the screen shows one section at a time with tabs and has no section observer, so a
  mail keystroke renders only the mail section. `matrixGroups` therefore runs only while the sources tab is open; not memoised.

## Files

- `frontend/src/screens/wiskey-people.ts`, `wiskey-person-editor.ts`, `wiskey-format.ts`, `system-notifications.ts` (row list)
- `frontend/src/components/notify-logic.ts` - **outside the row's list**: the pure helpers of the notification settings
  screen live there already (its header: "the draft operations of the settings sections"), and a Node unit cannot import the
  screen itself. Additive only (new exports at the end of the mail block).
- `frontend/tests/unit-wiskey-notif-2443.spec.ts` (new), `frontend/tests/unit-poll-controller.spec.ts` (wiskey-people added to
  the migrated families table: source pin + hidden / resume / no-overlap run).

## Tests

Run locally (workstation, PC under load, `--workers=1`):

- `npx tsc --noEmit`: clean (exit 0).
- `npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-notif-2443.spec.ts tests/unit-poll-controller.spec.ts
  tests/unit-notify-center.spec.ts --workers=1`: **60 passed** (10 new in unit-wiskey-notif-2443, 2 new wiskey-people family
  cases in unit-poll-controller, the rest existing).

NOT_RUN (need the runner or a running backend; the runner is reserved for the 2.43.8 release gate tonight):

- `evidence-wiskey-people-native.spec.ts`, `evidence-wiskey-people-writes.spec.ts`, `evidence-wiskey-people.spec.ts`,
  `evidence-wiskey-editor.spec.ts`, `evidence-notifications.spec.ts`, layout/pixel wiskey-people specs (no pixel change expected).
- The late-permission flow in a real browser (covered here by source pins on `begin()`/`subscribe()` only).

## Update: brought to the newest train head

The train moved while this branch was being written (aa20f05ae -> 5bcea468d, 64 commits). Merged
`origin/release/2438-train` 5bcea468d into the branch (no conflicts; the train only touched `wiskey-format.ts`'s locale default).
Re-run after the merge: `npx tsc --noEmit` clean; the same three unit files **60 passed** (`--workers=1`).
