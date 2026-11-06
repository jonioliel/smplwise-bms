# WXH-LEFTOVERS-2405 - the Arx side of the key-rotation leftovers (WXH3, WXH5, WXH6)

Branch `pilot/WXH-LEFTOVERS-2405`, cut from `origin/main` at `eab715e53` (v2.40.4). No merge, no version bump, no changelog entry, no UI
rebuild, no tag. No lab, Home Assistant, bridge, WisKey, NVR or station contact: fakes, mocks and synthetic data only.

Sources: the cards WXH3 / WXH5 / WXH6 in `management/tasks.json`; `BOARD-HYGIENE-2403.md` §4.3 item 3; `CR-WISKEY-HMAC-ROTATION-295.md`
(§13, §15, §16.3); `CR-034-WISKEY-HMAC-ROTATION.md` (branch `origin/pilot/WISKEY-CRs`: §2 item 3, §3, §6, §7, §8, §12); `BRIDGE-STALE-DISCOVERY-2383.md`
(§3a, the 2.39.1 WisKey block).

## 1. Scope

| Card | Leftover (BOARD-HYGIENE-2403 §4.3 item 3) | Built here |
|---|---|---|
| WXH3 | owner-contacts setting; emergency notice | §2, §3 |
| WXH5 | the `overlap_overdue` watchdog | §4 |
| WXH6 | the bridge capability status hand-over (Arx side) | §5 |
| WXH4 | fresh-key re-pair, emergency revocation | **not built**: owner decisions first (§8) |

Hard limits kept (checked by tests, §7):

- Nothing here starts, resumes, aborts or repairs a rotation. The 2.39.1 block (no rotation while WisKey is present - not by a click, not
  by the worker) is untouched: `bridge_rotation.wiskey_present`, `view`, `auto_due`, `Engine.start` and the 409 `wiskey_present` are not
  changed, and a test repeats them with the new settings in place.
- The stale-discovery protection (`bridge_discovery`, the K-01 sweep in `worker_pass`, `announce_discovery`, the bridge's 0.10.3 config
  flow) is untouched.
- The watchdog is timer-driven (it runs in the rotation worker's round) and is therefore named `bridge_key_watchdog.py` on purpose: SR-1's
  `TIMER_SHAPED` rule applies to it, and it names no door, lock or door-program primitive. `test_fake_doorwin_closed_rule_sr1.py` passes
  unchanged (no new pinned site).

## 2. Owner contacts (`security.owner_contacts`, CR-034 §7)

- One to five Arx users who are "the owner" for the bridge-key notices. Each must be an **active system administrator** (CR-034 §7: the
  owner is a system administrator in Arx; Arx never derives a role from a home-system flag). `[]` clears the setting.
- `PUT /api/v1/system/bridge-key/owner-contacts` `{user_ids: [...]}`: `system.configure` + system administrator (the card's own gate,
  403 `not_system_admin` audited), local sessions only (the whole `/system/bridge-key` prefix is in `remote_channel.BLOCKED_ON_REMOTE`).
  Refusals: 422 `validation` (not a list, more than five, duplicates, extra fields), 422 `contact_not_admin`, both audited
  (`settings.changed` denied). A change is audited `settings.changed` with the before / after id lists.
- A contact who later stops being an active system administrator stays in the stored list, is marked on the card ("no longer a system
  administrator") and simply stops counting (`valid_contacts`) - never an error.
- In `backup.SETTINGS_KEEP`: an archive never carries it and a restore never redirects who is told.
- `GET /api/v1/system/bridge-key` now also answers `owner_contacts` {ids, users (name, valid), candidates (the active system
  administrators), set, max, recipients}.

## 3. Bridge-key notices and the Settings banner (CR-034 §7, §8, §12)

- `services/bridge_key_notice.py`. Two notification sources in the one catalogue (`notify_policy.SOURCES`), category `security`, a
  `system` subject (visible with `system.configure`), e-mail and the phone app on by default:
  - `security.bridge_key_attention` (alert; the watchdog may raise it to critical) - the watchdog's report (§4); it resolves itself when
    the condition ends (with a quiet "resolved" update);
  - `security.bridge_key_revoked` (critical) - the emergency revocation's notice (CR-034 §8 step 2). `bridge_key_notice.emergency()` exists and
    is tested, but **no route calls it**: the revocation is WXH4. One row per revocation id; the acknowledge closes it.
- New recipients rule `bridge_key_owner` (`notify_policy.RECIPIENT_RULES`, `notify.recipients_for`): the valid owner contacts first, then
  every other active system administrator (CR-034 §8: "to the owner contacts and every other system administrator"). Visibility is
  re-checked by the pipeline as for every source.
- `queue()` emits INSIDE the caller's transaction under a SAVEPOINT: a notice that fails never undoes or blocks what the caller did
  (CR-034 §8: "a notice failure never blocks the revocation"); delivery retries are the pipeline's own (outbox). Every notice is audited
  `bridge.rotation.notice_sent` with the outcome (`created` / `folded` / `disabled` / `failed`) and the recipient count.
- Bodies are content-free: no key, key id, person or address (contradiction 1 in §6).
- **Banner** (CR-034 §7: "until set, the notice goes to every system administrator and a banner stays on all Settings screens until one of
  them acknowledges it"): `GET /api/v1/system/bridge-key/notice` (system administrator, read only, never drives a rotation) answers
  `{show, open, contacts_set}`; `show` = an OPEN bridge-key notice exists AND no valid owner contact is set. The new
  `sw-bridge-key-banner` is drawn by the shell on every Settings (`#/system/...`) screen, local sessions with `system.configure` only; it
  links to the notification center (where the acknowledge happens) and to the card. It renders nothing on 403 / 404 / error.

## 4. The watchdog (`services/bridge_key_watchdog.py`, CR-034 §3, §12, slice H5)

Reports conditions that already fail closed; it never acts on them.

| Code | When | Audit (once) | Notice |
|---|---|---|---|
| `overlap_overdue` | a rotation is still unfinished more than 180 s + 60 s after it began (its publish, else its start). By then Arx already refuses the old key (`key_expired`) and the peer's own cap has ended its window. | `bridge.rotation.overlap_overdue` (CR-034 §12) | critical |
| `needs_repair` | the latest rotation waits for an administrator (remote doors stay paused while the switch is on, HMACACT2-295) | `bridge.key.watchdog` | critical |
| `verify_failed` | the latest rotation could not prove that the bridge dropped the old key (V1) | `bridge.key.watchdog` | alert |
| `generation_mismatch` | a VERIFIED directory push reported a key generation other than Arx's current one, while no rotation runs (a bridge that reports none is never a mismatch; the report is believed for 10 minutes like the capability) | `bridge.key.watchdog` | alert |

- Runs once per rotation-worker round (`bridge_rotation.worker_pass`, after the engine's own round; 60 s idle / 5 s busy), in its own short
  write transaction. A new condition: one audit row and one notice (dedupe key per condition and rotation). An ended condition: the
  notice is resolved and `bridge.key.watchdog` `cleared` is audited. What was reported is kept in `bridge.watchdog` (SETTINGS_KEEP), so
  a restart does not repeat a report.
- Never: an engine call (`start` / `resume` / `tick`), a peer call, a key state change, a signature, a door / lock / program primitive.
  An AST test pins that, and SR-1's timer-shaped rule covers the module by name.
- The card shows each present condition as one line (`watchdog` in `GET /system/bridge-key`) and the state badge says "needs attention".

## 5. Capability status hand-over, Arx side (CR-034 §2 item 3, §6, R-25; slice H6)

CR-034 asks how WisKey learns, without key material, that a generation change completed with V1c; the proposal is that the bridge passes
`{key_generation, last_rotation: {...}}` through the capability's status. The Arx side is built:

- `bridge_rotation.key_status(conn)`: `{protocol: "smplwise-key-status-v1", key_generation, rotation_active, last_rotation: {rotation_id, mode,
  state, gen_from, gen_to, verified_old_rejected, anchor_eligible, completed_at} | null, anchor_decrease_available: false}`. Generation 0 for
  the plain pairing code. `verified_old_rejected` is true only for a `verified` rotation (V1 passed, the old key rejected);
  `anchor_eligible` only for a verified `hard_cut` (R-25). `anchor_decrease_available` stays **false**: the decrease needs WisKey's
  high-water mechanism, which does not exist (R-25, the safe default). No key, key id, salt, proof or nonce.
- Every answer of `POST /ha/bridge/directory` now carries `key_status`, signed with the current key under its own `purpose: "key_status"`
  (the same pattern as the existing `cast` field). An older bridge ignores the field (it reads `cast` only - checked in its push code).
- The push may report the bridge's own `key_generation` (an integer); it is recorded (`bridge.peer_key_generation`, state only, cleared at a
  re-pair) and feeds the watchdog's `generation_mismatch`. Today's bridge does not send it.
- Reflection guard: `POST /ha/bridge/ping` refuses (422 `bridge_bad_request`, before verification and before any side effect) a body with a
  `purpose` field. `purpose` marks a message Arx signs FOR the bridge (cast origin, key status); replayed at Arx's own ping it would
  otherwise verify (HMAC is symmetric) and re-mark the bridge paired / revoke the capture leases. The bridge's ping body is
  `{version}` and is unaffected.
- The card shows the generation the bridge reports ("not reported" today) and, after an anchor-eligible rotation, the line "lowering the clock
  anchor is not available yet" (CR-034 §6).
- **Not built (bridge / WisKey side):** the bridge does not yet verify `key_status`, forward it through the capability's status, or report
  its `key_generation`; WisKey has no high-water mechanism. Both need a bridge release and a WisKey answer (CR-034 §2 items 1-3).

## 6. Contradictions recorded (not silently resolved)

1. **The emergency notice names the revoker.** CR-034 §8 words it "בוטל מפתח הגשר בידי <שם> ב-<שעה>"; the notification catalogue's rule
   is that titles and bodies never name a person (`notify_policy` module docstring). Built content-free ("מנהל מערכת ביטל את מפתח הגשר
   ... פרטים באודיט"); the audit row carries the actor id and the time. Owner question 4 in §8.
2. **What the watchdog reports.** CR-034 §3 names `generation mismatch` and `overlap_overdue`. `needs_repair` and `verify_failed` were added:
   both are fail-closed states the card already showed only to whoever opened it, and `needs_repair` keeps remote doors paused. They are
   reports only, like the other two.
3. **"Immediate notice" vs an editable policy.** Like every source, an administrator can switch the bridge-key sources off in the
   notification settings; the notice is then not sent (audited `notice_sent` / `disabled`). CR-034 §7 / §8 imply the notice is
   unconditional. Owner question 5 in §8.
4. **The banner on "all Settings screens"** is read when the Settings area opens and does not poll; after the acknowledge it disappears at
   the next entry to Settings (or a reload).

## 7. Tests (fakes only)

- `smplwise_vms/backend/tests/test_wxh_leftovers_2405.py` (new): owner contacts (admins only, audit, malformed bodies, gate for operator /
  site admin, a demoted contact drops out, keep-list); notices (recipients = contacts + admins, never an operator; the savepoint keeps the
  caller's work when the notice fails; the emergency notice one row per revocation and no caller in the code); the banner (open notice +
  no contact, contact set, acknowledge); the watchdog (overdue once + cleared + resolved, no t0, `needs_repair` / `verify_failed`, finished
  rotations not reported, generation mismatch from a verified push incl. older bridges / running rotation / junk values, never drives a
  rotation or calls the peer, the AST pin, SR-1's timer-shaped rule covers it, `worker_pass` with WisKey present starts nothing);
  the hand-over (`key_status` matrix, no key material, the signed `key_status` in the directory answer verified with the bridge's own
  0.9.4 verifier, the ping refusing it, an honest ping still pairing); the card view; the WisKey block repeated.
- `tests/test_fake_doorwin_closed_rule_sr1.py` unchanged and green.
- Frontend: `tests/unit-bridge-key.spec.ts` (+3 node-only tests: the watchdog words, the card's select-only editing and single watchdog
  line, the banner local / read-only / Settings-only), `tests/evidence-wxh-leftovers-2405.spec.ts` (new, mocked backend: five card states in
  he / en, the watchdog lines and the anchor note, add / remove a contact, the banner on two Settings screens and absent without an open
  notice); `tsc --noEmit`.

### Receipts

All on the runner through `private/runner/run_smart.py` (gate_status checked first: no release gate running), except where marked.

| What | Where / commit | Result |
|---|---|---|
| `test_wxh_leftovers_2405.py` (23 cases) + `test_fake_doorwin_closed_rule_sr1.py` (5) | workstation, `b5aa0548c` | 28 passed |
| Backend selection, 25 files: the new file, SR-1, every bridge-key / rotation / harness file, stale discovery, bridge install / lease / 080 / service identity / update listener, cast sessions, notify core / sources / channels / payload golden, quiet hours, backup / backup sensitive, WisKey pairing, self-update S3, release check | runner, `b5aa0548c` | 724 passed, 2 failed, 1 error |
| Same selection without the new file, on `main` (`eab715e53`) for comparison | runner | 702 passed, **the same 2 failed** |
| The three affected files alone (`test_notify_channels`, `test_wiskey_pairing_2382`, `test_self_update_s3`) | runner, `b5aa0548c` | 93 passed |
| Backend selection again | runner, `68bed91b3` | 724 passed, the same 2 failed, 1 error |
| `unit-bridge-key.spec.ts` (node only) | workstation, explicit file | 8 passed |
| `evidence-wxh-leftovers-2405`, `evidence-bridge-key`, `evidence-breakui-bridgekey`, `unit-bridge-key` (desktop / tablet / mobile) | runner, `b5aa0548c` | 96 passed, 3 failed (my mock: the card reloads after a PUT and the mock answered the old state; fixed in `68bed91b3`) |
| `evidence-wxh-leftovers-2405` | runner, `68bed91b3` | 24 passed |
| `tsc --noEmit` | workstation | exit 0 |
| `scripts/release_check.py` | workstation | RESULT: ready for the owner's approval (2.40.4, unchanged) |

Classification of the non-passes:
- `test_notify_channels::test_release_route_accepts_and_audits_the_notification_origin` and
  `test_wiskey_pairing_2382::test_rotation_switch_on_is_a_warning_with_a_fix`: fail identically on `main` `eab715e53` in this selection and
  pass when their files run alone - an order dependency that predates this branch (not touched here; worth a ticket).
- The one setup ERROR per run hit a different test each time (`test_self_update_s3::test_a_restart_loop_never_ends_in_success`:
  `sqlite3.OperationalError: unable to open database file`; then `test_wxh_leftovers_2405::test_owner_contacts_...`: `FileExistsError` on
  the runner worktree's `.tmp_b`) - the runner's temp-directory set-up with two workers, not the code; both tests pass in the other runs.
- Not run: the full backend suite, the pixel baselines (the banner renders nothing without an open notice, so no baseline should move -
  NOT verified), the evidence screenshots (`SW_SHOTS=1` is not passed by the runner job: NOT_RUN), any live run.

## 8. WXH4 - the owner decisions it waits for (not built)

The questions are in the segment report (Hebrew, numbered, lettered options, with a recommendation). In short:

1. How a fresh pairing code reaches the bridge in a re-pair with a new key: manual entry only / Arx's discovery message (the 2.39.1
   re-pair path; the 0.10.3 bridge confirms the code with Arx before it takes it) / a message signed with the key being replaced.
2. Who may reveal that code on screen, and with which re-check.
3. Whether the emergency revocation is available while WisKey is installed (it disconnects WisKey's door path until the re-pair).
4. Whether the emergency notice names the administrator (§6 item 1).
5. Whether an administrator may switch the bridge-key notices off (§6 item 3).
6. Whether the emergency button stays disabled until an owner contact is set (CR-034 §7).

## 9. Not run / limits

- No live bridge, WisKey or Home Assistant; no rotation was started anywhere. The bridge-side hand-over and WisKey's high-water mechanism
  do not exist (§5).
- The evidence screenshots are produced only with `SW_SHOTS=1`; see the receipts for what ran.
- The refused-push counter and the capability are process / setting state as before; the bridge's reported generation is believed for
  10 minutes.

## 10. Rollback

Revert the branch commits. The new settings rows (`security.owner_contacts`, `bridge.watchdog`, `bridge.peer_key_generation*`) and the two
notification policy rows are ignored by an older Arx; an older bridge ignores `key_status`. No migration.
