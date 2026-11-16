# CR-EDITORS-MEMO-2440 - schedule editor, automation editor, schedules list, privacy masks, mapping assistant: races and per-render work

Branch `pilot/CR-EDITORS-MEMO-2440` (frontend, load-paths group). Base: `pilot/CR-POLL-SCREENS-B-2440` at `4eddadb04`
(itself on `release/2437-train`), as assigned. Plan row: `CR-EDITORS-MEMO` in the code-review master plan (13.11).
Review findings: 06:RACE-6, PERF-3, PERF-4, GATE-1, MAPA-1, 06:RACE-7 (schedule editor, automation editor, privacy masks),
06:PERF-6 (schedule editor, schedules screen), 06:INFILE-1 (automation editor).

Behaviour is meant to be identical; the row names no behaviour change. The three places where what is sent to the server
or shown differs from before are listed under "What a person could notice".

## Files

Row files (edited):

- `frontend/src/screens/automation-editor-base.ts`
- `frontend/src/screens/schedule-editor.ts`
- `frontend/src/screens/devices-schedules.ts`
- `frontend/src/screens/system-security-privacy-masks.ts`
- `frontend/src/screens/mapping-assistant.ts`

New:

- `frontend/src/screens/editor-guards.ts` - four small pure guards: `KeyedMemo`, `SingleFlight`, `OneAtATime`, `NewestApplied`.
- `frontend/src/screens/automation-save-gate.ts` - the save gate as a pure function with codes.
- `frontend/tests/unit-editors-memo-2440.spec.ts` - 37 node tests.

Outside my rows: nothing edited. `frontend/src/map/memo.ts` is **not edited**; `editor-guards.ts` only imports its
`sameRefs` (the existing identity comparison) instead of writing a second copy. If `CR-INV-PLAYBACK-2440` renames or
removes `sameRefs`, the combine step has to follow in `editor-guards.ts` (one import, one call).
`frontend/src/api/latest.ts` (from the base branch) is used as is by the privacy-mask screen.

## What changed, by finding

### PERF-3 - automation editor: validation once per update
`get issues()` ran `validateDraft` + the merge on every call, and one render called it from the save gate, the validation
box, the warnings box, every block list and every nested block form; `dirty` (a canonical stringify of the draft) and
`blockWarnings` (a walk of the whole draft per block) did the same. Now:

- `issues`, `issuesBy`, `dirty` and the uid -> path map of the blocks are `KeyedMemo`s keyed on what each reads
  (the draft object, `version`, the environment, the fresh preview's errors, the server's issues, the stored id, `initial`).
  Every draft change in this file replaces the draft and bumps `version`, so identity is enough.
- All four are also cleared at the top of `willUpdate` (the pattern `schedule-editor.ts` already uses), so a future
  in-place edit of a draft cannot outlive one update.
- Reads between updates (the save click, the unload guard, `requestCancel`) hit the same memo with the same keys, so they
  see the current draft even before the next render.

### GATE-1 - "save with warnings" decided by a code
`saveGate` returned `{ text }` and both the button and `save()` compared `text === 'יש אזהרות'`. The gate is now
`saveGateOf(facts)` in `automation-save-gate.ts`, returning `{ code, text }` (13 codes); the same order of checks, the
same texts, the costly facts (`issues`, `dirty`, grants, preview) still asked only when the earlier checks passed.
`warningsOnly(gate, warnMode)` is the single test used by the footer button and by `save()`.

### RACE-6 - schedules screen: one refresh round at a time
`refresh()` had no single-flight; every push started a full status + list + detail round beside the one running, the
rounds could land out of order, and `this.detail = await getSchedule(this.sub)` did not re-check `sub`.

- `refresh()` now goes through `SingleFlight`: one round in flight, at most one waiting. A caller that arrives while a round
  runs gets a round that **starts after its call** (so a write that just finished is read back), and all callers in that
  window share it; `recheck` of any of them is kept. Five pushes during a round cost one extra round.
- The round captures `sub` before reading the detail and applies the answer only if it is still the open schedule.
- `onSub` and the round both read the open schedule; `NewestApplied` keeps an older answer from landing on a newer one
  without discarding the older answer when the newer read fails.
- `ack()` read the review list and then called `refresh()`, which reads it again while the review is open. The explicit
  read now happens only when the review is not the open sub-screen.

### RACE-7 - stale answers
- Schedule editor `refreshRemote`: the id is captured; the answer (and a 404) is applied only if that schedule is still the
  one open and loaded. Before, an answer for the previous schedule could be adopted into, raise a conflict on, or mark
  as deleted the schedule the re-used editor had moved to.
- Automation editor `notifyExternalChange`: the id and the load token are captured; an answer for the item that was open
  when the push came no longer raises a conflict banner on the item open now.
- Privacy masks: `select(A)` then `select(B)` while A's mask was still being read ended with A's late
  `loadHistory(A)` blanking B's history and then dropping its own answer - B's history section stayed hidden until the
  next action. `select` now stops after its mask read when another camera was chosen, `loadHistory` does nothing for a
  camera that is not selected, and two reads for the same camera go by `Latest` (newest wins).

### PERF-4 - privacy masks: no forced layout per pointer move
`updated()` called `measure()` (a walk of every ancestor with `getComputedStyle`, then `getBoundingClientRect`) after every
render, and a drag renders on every `pointermove`. Now `updated()` returns at once while a drag is on, and for an update
that changed only `drafts` / `ghost` / `regionKey` (state that redraws regions inside the picture; nothing above the
layout depends on it - the switch row and the lock banner read other state). The scrolling ancestor found is kept while
it is still connected and still scrolls, and dropped on resize. Every other update, and every resize, measures as before.
Not done: the optional rAF coalescing of `setRect` - browsers already deliver pointer moves once per frame, and with the
measurement gone a drag render is a plain re-render; a flush-on-pointerup path would be new risk for no measurable gain.

### PERF-6 - schedule editor and schedules screen
- Schedule editor `dirty` = two canonical stringifies, called by every render, by every click anywhere in the document
  (`onDocClick`) and by the unload guard. Now a `KeyedMemo` on the draft and the baseline objects (both are replaced on
  every change) and `creating`; an open day split still answers `true` before the memo.
- Schedule editor `slotViews`: linked days show the same slot array, and the view models were built once per day; the
  conflict marks (`kavConflictUids`) were rebuilt once per slot. Both are now built once per update (`viewCache`, cleared in
  `willUpdate` and in `mark()` beside the two caches that were already there).
- Schedules screen: the filtered list and the sorted list are `KeyedMemo`s on the list / filters objects and the sort key.
  `updated()` skips its two layout measurements (`measureHeaderBar`, `measureFit`) for an update that changed only
  `menuFor`, `note` or `busy` (a popover menu, the toast, disabled buttons); an update with no changed property
  (the `requestUpdate()` after a resize) and every other update measure as before.

### MAPA-1 - mapping assistant
- `go()` runs through `OneAtATime`: a second press while the step's save is in flight is dropped (it used to send a second
  save with the same revision). The guard is a private flag, not `busy`, so no button changes its look.
- `persist()` skips the save when the state object is the one the server already holds (the stored draft as read, or the
  last state saved). Every edit replaces the state, so the same object is the same content.
- The model memo is keyed on `data` as well as `st`.
- The ternary with two identical arms in the position chooser is gone (`seps` is simply kept by the spread).

### INFILE-1 - automation editor copy-paste
- `dryRun` and `loadDry` shared six identical lines: `computeDry(draft)`.
- `keepMine` and `saveMerged` shared the "my edit on top of their revision" pair: `rebaseOn(cur)`.
- The dialogs' footer row was written out eight times: `dlgFoot(buttons)` (the same element, attributes and children).

## What a person could notice
1. Schedules screen: during a burst of pushes the list refreshes once more after the round in flight, instead of once per
   push in parallel. The end state is the same; it arrives with fewer requests.
2. Mapping assistant: moving between steps without changing anything no longer saves (and no longer bumps the stored
   revision); a double click on "continue" moves one step with one save.
3. Privacy masks: the history section of the camera chosen second no longer disappears after a quick switch.

## Tests actually run (workstation, node 24, `--workers=1`)
- `npx tsc --noEmit`: clean (run after the last source edit).
- `npx playwright test -c playwright.unit.config.ts tests/unit-editors-memo-2440.spec.ts`: 37 passed.
- Related node unit specs in one run - `unit-shell-lazy-2436`, `unit-a11y-polished-lint`, `unit-menu-lint`, `unit-token-lint`,
  `unit-lead-reserve`, `unit-dark-polish-beds`, `unit-switch-contrast-2380`, `unit-automation-builder`, `unit-automations`,
  `unit-schedules-logic`, `unit-schedule-editor-logic`, `unit-schedules-editor-logic`, `unit-privacy-mask`,
  `unit-mapping-assist-2330`, `unit-mapping-improve-2351`, `unit-scene-memo`: 226 passed, 8 skipped (the page tests the
  node config leaves out).
- Browser evidence specs: see the follow-up commit of this note.

## NOT_RUN
See the follow-up commit of this note.

## Pixels to refresh
None expected: no markup, class, text or style changed (the dialog footers render the same element). No PNG was
regenerated or committed.

## For the closing chain / the lead
- The automation editor, schedules and privacy-mask evidence and pixel specs are the row's proof that nothing moved; they
  belong to the combined branch's entry check.
- `editor-guards.ts` is a candidate for the other editors' races (devices-area, devices-layout, plan editor, case detail)
  that the row leaves to their own branches.
