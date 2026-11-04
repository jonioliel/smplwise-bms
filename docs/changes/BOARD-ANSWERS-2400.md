# BOARD-ANSWERS-2400 - notice board: the owner's answers of 04.11 (round 18, questions 12-17)

Branch `pilot/BOARD-ANSWERS-2400` from `origin/release/2400-train` (`8e3ac8398`). Target: 2.40.0. Source: the owner's answers of 04.11
morning, round 18, in `private/planning/OWNER_ANSWERS_2026-10-30_NIGHT_HE.md` (section "04.11 בוקר"); the questions as asked are in
`private/design-system-2026-10-27/round18/index.html`. Background: `docs/changes/BOARD-MGMT-2381.md`, `docs/changes/TV-CHIPS-2381.md`,
NOTICEPERM-295 (migration `0173_notice_board_token_sealed.sql`, `services/connection_store.py`). **No migration** (0203 stays the last),
no version bump, no tag, no merge.

## 1. Outcome per answer

| Q | Answer | Outcome |
|---|---|---|
| 12 | A - imperative button labels | **Verified as built, no change.** "העתק קישור" (row and board header), "החלף קישור" (header, address panel, the confirmation's danger button), "שלח שוב" (row action and its confirmation) - `i18n/notices.ts` `copyLink` / `newLink` / `copyAsk2` / `resend`. The compose dialog's "שמירה ושליחה שוב" keeps the noun form of its neighbour "שמירה" (the question named only the three board buttons). |
| 13 | B - the server keeps the link the next time the TV connects | **Built** (section 2). Security change, reviewed in section 3. |
| 14 | A - accept: a delegate without notice management can no longer hand out "editor" | **Verified as built, no change.** `roles.json` editor holds `notices.view` + `notices.manage` (BOARD-MGMT-2381 section 3); the delegation ceiling is the existing rule. |
| 15 | A - a fault chip outlasts a healthy chip higher in the list | **Verified as built, no change.** `notice-tv/tv-fit.ts` `dropOrder`: healthy first, then off, then warning, alarm last; within one state the lower chip first. The order hint already says "תקלה נשארת עד הסוף". |
| 16 | A - approve the parking / gym rules and add "הפוך" | **Rules approved as built; "הפוך" built** (section 4). |
| 17 | A - only a system administrator picks chip sources | **Verified as built, no change.** `PATCH /notices/settings` requires `system.configure` on the installation; the sources card is inside the defaults card, rendered only for `can.configure`. Only the role `system_admin` holds `system.configure`. The new "הפוך" lists ride the same route (tested: notices_boards, notices_manage, editor and site_admin all get 403). |

## 2. Q13 - the copy of a pre-NOTICEPERM-295 link is kept when its TV connects

**Before.** A board saved before migration 0173 has `token_sealed IS NULL` (hash only). `GET /notices/boards/{id}/link` answered 409
`no_stored_link`, and "העתק קישור" could only offer to replace the link (which disconnects the TV).

**Now.**
- `services/notices/display.py`: `DisplayService(capture=...)`. In `feed()`, after `resolve()` accepted the request (constant-time hash
  compare, module on, board enabled, remote channel allowed, per-network and per-token limits) and the feed was built, a board whose row
  has no `token_sealed` calls `capture(board_id, token)`. Best effort: any exception is swallowed, the feed answer is unchanged.
- `capture_link(db, data_dir)` seals the token with `connection_store.seal_notice_board_token` (AES-GCM, the add-on's key file, associated
  data `notice_board|<board id>|token`) - the same call create / rotate / issue-link use - opens the blob again and compares, then runs one
  conditional write:
  `UPDATE notice_boards SET token_sealed = ? WHERE id = ? AND token_sealed IS NULL AND deleted_at IS NULL AND token_hash = sha256(token)`.
  On exactly one row changed it writes the audit row `notices.board.link_captured` (actor: none = the system, resource the board id,
  details `{"source": "tv_feed"}`).
- Wired in both places a TV reads the feed: the app's display router (`routers/notices.py::_display_service`) and the LAN listener
  (`main.py`, `notice_listener.SERVER.start(DisplayService(..., capture=...))`).
- Only `feed` captures (the TV's first and periodic request); the image / logo / transit routes do not.
- Text: the 409 message now says the copy is kept the next time the TV connects. Screen (`i18n/notices.ts`, `screens/system-notices.ts`):
  `noStoredLink` (the reason inside the replace confirmation) now reads "...העותק יישמר בפעם הבאה שהטלוויזיה מתחברת, ואז "העתק קישור"
  יעתיק אותו בלי להחליף. כדי לקבל קישור עכשיו צריך להחליף אותו."; a new line `linkPending` in the board's address panel (only while
  `has_stored_link === false`): "עותק הקישור יישמר בפעם הבאה שהטלוויזיה מתחברת. עד אז "העתק קישור" מציע רק להחליף אותו." (he + en).
- Not changed: the `issue-link` route (still there, unused by the screen), the hash as the only thing the feed checks, the copy / replace
  permissions and audits.

## 3. Q13 security review

| # | Point | How it holds | Test (`backend/tests/test_board_answers_2400.py`) |
|---|---|---|---|
| S1 | Only a token that verifies against the stored hash is stored | `capture` is reached only after `resolve()` accepted the request (constant-time compare of sha256(token) to `token_hash`; unknown slug, wrong / revoked token, disabled board, module off, remote not allowed all return before it). The write itself repeats the check atomically (`token_hash = sha256(token)` in the `WHERE`). | `test_a_wrong_token_stores_nothing`, `test_a_token_of_another_board_stores_nothing`, `test_a_disabled_board_or_the_module_off_stores_nothing`, `test_the_capture_runs_only_after_the_token_check` (source order) |
| S2 | An existing copy is never replaced | `token_sealed IS NULL` in the `WHERE`; a board with any copy (even one that does not open) is left alone - repairing it stays the administrator's "החלף קישור". | `test_an_existing_copy_is_never_replaced` |
| S3 | Races with replace / issue / delete | All writers hold the SQLite write lock. A link replaced between the TV's read and the capture write no longer matches `token_hash` (and replace stores its own copy), so nothing is written; a deleted board is excluded by `deleted_at IS NULL`. | `test_a_token_rotated_away_in_between_is_not_stored`, `test_a_deleted_board_stores_nothing` |
| S4 | No token in logs or audit | The capture code has no logging at all; a failure (even an exception whose text carried the token) is swallowed silently. The audit row carries the board id and `source` only - no token, no prefix, no sealed blob. The token stays out of URLs (header `X-Board-Token`, unchanged). | `test_one_capture_one_audit_row_without_the_value`, `test_a_failing_capture_never_breaks_the_feed_and_never_logs_the_token`, `test_a_successful_capture_logs_nothing_with_the_token` |
| S5 | Rate and size limits | The feed's own limits apply first (per network 10/s, per token 2/s burst 10, 20 misses / 10 min -> 429). The token must match the feed's shape (20-128 URL-safe characters) before it is even sealed. At most one capture attempt per board per minute (in memory), so a failing key never turns every poll into a write. One write ever per board (`IS NULL`), one bounded value (one column, < 300 characters), no table that grows. | `test_shape_size_and_retry_limits`, `test_one_capture_one_audit_row_without_the_value` |
| S6 | The feed never breaks | Capture runs after the feed document is built and is wrapped in `try / except`; the reply is the same with or without it. | `test_a_failing_capture_never_breaks_the_feed_and_never_logs_the_token` |
| S7 | What an attacker holding a valid token gains | **Nothing new.** He can already read the board's feed with it (that is what the token is for). Capture stores the token he presented, which the server already accepts; it cannot store a token of his choosing (hash check), cannot replace a copy, cannot affect another board (the blob's associated data binds the board id; the `WHERE` binds `id`), and the stored copy is readable only through `GET .../link` (`notices.boards` + the button for `system.configure`, audited `notices.board.link_read`, `no-store`). The one side effect he can trigger is one write + one audit row per legacy board, ever. |  |
| S8 | What changes for the administrator | A legacy board's link becomes copyable without replacement; a link that leaked before still has to be replaced to be revoked - the same as for every board created after NOTICEPERM-295. "החלף קישור" stays the revocation tool. | `test_the_tv_connecting_keeps_the_copy_and_copy_then_works_without_replacing` |
| S9 | Both feed entry points | The app route and the LAN listener build the service with the same `capture`. | `test_the_lan_listener_and_the_app_route_both_capture` |

Residual: a board whose TV never connects again keeps showing "יישמר בפעם הבאה שהטלוויזיה מתחברת" and can only be replaced (as before).
The capture key is the add-on's existing key file; if it is unreadable the capture fails silently and the board stays as it was.

## 4. Q16 - parking / gym rules approved, "הפוך" per picked on / off entity

**Rules approved as built** (TV-CHIPS-2381 section 2): parking - a number = free spaces (summed), an on / off entity = one space (on =
taken), a list = its option as written; gym - on / off = open / closed (an occupancy / presence / motion sensor: in use / free), a list =
its option as written, never a number.

**"הפוך".**
- Storage: `notices.info.parking_inverted` / `notices.info.gym_inverted` - JSON lists of entity ids, kept next to the source lists
  (`<kind>_entities`), always a subset of them. A separate key rather than objects inside the source list, so a rollback to 2.38.x / 2.39.x
  reads the source list unchanged (the old code would drop objects it does not know) and simply ignores the flags.
- API: `parking_inverted` / `gym_inverted` on `GET` / `PATCH /notices/settings` (`system.configure`, the existing route). Only on / off
  domains (`binary_sensor`, `input_boolean`, `switch`, `schedule`) and only picked entities (422 otherwise; at most 8). A source list sent
  alone keeps the flags of the entities still in it and drops the rest (`model.with_info_invert`), so removing a source removes its flag
  and adding it back does not bring the old flag back. A stored bad value reads as empty / filtered.
- Audit: the existing `notices.settings.update` row with the changed keys (`notices.info.parking_inverted` etc.), no values - as the other
  settings.
- Reading (`services/notices/info.py`): an inverted on / off entity's state is flipped before the approved rule applies - parking: on =
  free; gym: on = closed, or for an occupancy sensor on = free. `unknown` / `unavailable` stay unavailable; numbers and lists are never
  inverted. Still read-only (no mirror write, no service call).
- Screen (`notices/info-sources.ts`): each picked on / off entity's pill carries a "הפוך" checkbox (labelled, `aria-label` "הפוך: <name>",
  disabled with the card); a hint per chip appears when such an entity is picked ("הפוך: לחיישן או מתג שבו פעיל = פנוי (במקום פעיל = תפוס)."
  / "הפוך: למתג או חיישן שבו פעיל = סגור, או בחיישן נוכחות פעיל = פנוי."). Saved at once (`info-sources-change {parking_inverted}`), like the
  list. Pure rules in `notices/info-chips-model.ts` (`INVERT_DOMAINS`, `canInvert`, `toggleInvert`, `InfoSourcesPatch`). Text in
  `i18n/notice-chips.ts` (he + en, no platform words).

## 5. Files

- Backend: `services/notices/display.py` (`capture`, `capture_link`, `CAPTURE_RETRY_S`), `routers/notices.py` (wiring, 409 text,
  `SettingsIn` fields, `with_info_invert`), `main.py` (LAN listener wiring), `services/notices/model.py` (invert keys, validation, settings
  document), `services/notices/info.py` (flip before reading).
- Frontend: `i18n/notices.ts` (`noStoredLink`, new `linkPending`), `screens/system-notices.ts` (pending line, `.inverted`, event type),
  `notices/info-sources.ts`, `notices/info-chips-model.ts`, `i18n/notice-chips.ts`, `api/notices.ts` (two optional typed fields).
- Tests: new `backend/tests/test_board_answers_2400.py`; new `frontend/tests/unit-board-answers-2400.spec.ts`; new
  `frontend/tests/evidence-board-answers-2400.spec.ts` (runner); `unit-tv-chips-2381.spec.ts` (the event type in the wiring assertion);
  `evidence-board-mgmt-2381.spec.ts` (the legacy-board text and the pending line).
- `contracts/API_INVENTORY.md`: no new route (two new optional fields on an existing one); the release commit regenerates it.

## 6. Rollback

Revert the branch commits. No schema change. A copy captured by a TV is the same sealed format NOTICEPERM-295 writes, so older code reads
it (the board simply has a stored link). The `*_inverted` settings rows are ignored by older code (the chips read un-inverted).

## 7. Evidence

Code commit `d2601bc68`.

| Check | Where | Result |
|---|---|---|
| `npx tsc --noEmit` (tsconfig includes `src` + `tests`) | workstation | 0 errors |
| `playwright test -c playwright.unit.config.ts tests/unit-board-answers-2400.spec.ts tests/unit-board-mgmt-2381.spec.ts tests/unit-tv-chips-2381.spec.ts tests/unit-noticeperm-295.spec.ts tests/unit-token-lint.spec.ts tests/unit-a11y-polished-lint.spec.ts tests/unit-tv-fit-2380.spec.ts --workers=1` | workstation (Node only) | **43 passed, 0 failed** (first run: 1 failed - the stale wiring assertion in `unit-tv-chips-2381`, updated for the intended event type) |
| `pytest tests/test_board_answers_2400.py` (`.venv` Python) | workstation | **35 passed** |
| `pytest test_notices_perm_295 test_board_mgmt_2381 test_notice_tvchips_2381 test_notices_info_295 test_notices_security_295 test_notice_caps_295 test_notice_tvsettings_2380 test_notices_106 test_docs_config_consistency` | workstation, one process | **228 passed, 0 failed** |
| `scripts/release_check.py --root .` | workstation | all checks ok ("ready for the owner's approval"; version still 2.38.1 on the train - no bump here); migrations contiguous, last 0203 |
| `run_smart.py preview pilot/BOARD-ANSWERS-2400 evidence-board-answers-2400 evidence-board-mgmt-2381 evidence-tv-chips-2381 --machine runner` @ `d2601bc68` | runner, desktop / tablet / mobile | **27 passed, 0 failed** |
| Pixel baselines | - | none touched: no pixel spec covers `#/system/notices`; the TV page is unchanged |

Gate check before the runner job: `gate_status.json` = `release/2382-train` finished (`fail`, not this branch), no `release_gate` process,
112 GB free. No `.tmp_*` left (the preview job uses none; none in the worktree).

NOT_RUN: the full backend suite and the full Playwright tier (the release gate); `run_smart.py backend` on the runner; the runner entry
check (`branch_check.sh`); a real TV on a real pre-0173 board (the capture is proven with the test client and the service only); a live
parking / gym entity with "הפוך" (mirror rows in tests).
