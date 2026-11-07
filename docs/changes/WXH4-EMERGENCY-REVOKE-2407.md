# WXH4-EMERGENCY-REVOKE-2407 - emergency revocation of the bridge key and the fresh-key re-pair

Branch `pilot/WXH4-EMERGENCY-REVOKE-2407`, cut from `origin/main` at `a4652fda5` (v2.40.5). No merge, no add-on version bump, no
changelog entry, no UI rebuild, no tag, no runner gate. Bridge version bumped to **0.10.6**. No lab, Home Assistant, bridge, WisKey, NVR
or station contact: fakes, mocks and synthetic data only.

Sources: card WXH4 in `management/tasks.json`; `WXH-LEFTOVERS-2405.md` §8 (the six questions) and §2-§4 (owner contacts, the
`bridge_key_owner` notices, the watchdog); CR-034 §7, §8; `BRIDGE-STALE-DISCOVERY-2383.md` (the re-pair path, bridge 0.10.3);
`BRIDGE-UPDATE-LISTENER-2401` (bridge 0.10.4, Home Assistant 2026.12 reload rule).

## 1. What

An administrator who suspects the bridge key leaked can revoke it at once from Settings › Connections › Bridge key. The key is wiped,
every operation through the bridge stops, and a fresh pairing code is made. The bridge gets the new code by itself through the existing
re-pair path, or an administrator reveals it (after a fresh re-authentication) and types it into the bridge's new "Reconfigure" step.
The revocation ends when the bridge proves the new code to Arx.

## 2. The owner's decisions (07.11) and where each is enforced

| # | Decision | Where |
|---|---|---|
| 1 | ב - the new code reaches the bridge through the existing re-pair path (Arx's Supervisor discovery message; the bridge pings Arx with the code before it takes it); manual entry in the bridge is the fallback; never rely on the old key | `bridge_key_revocation.revoke` + `bridge_install.announce_discovery` after the commit; bridge `config_flow._discovered_for_existing` (0.10.3, unchanged) and the new `async_step_reconfigure` (0.10.6); nothing is signed with the revoked key (`ha_bridge.signing_key` is None while revoked) |
| 2 | א - any system administrator may reveal the new code after a fresh re-authentication; every reveal audited | `POST /system/bridge-key/revoke/reveal`: system administrator + the caller's OWN current authenticator (TOTP) code, checked with the existing `second_factor.verify` (replay guard, lockout); `bridge.key.code_revealed` allowed / denied with the reason |
| 3 | א - allowed while WisKey is installed, with a clear warning | the confirm dialog shows the warning and a checkbox; the server answers 409 `wiskey_ack_required` (audited) without `wiskey_acknowledged: true` while WisKey is present |
| 4 | ב - the notice names the administrator; the audit keeps name + time | `security.bridge_key_revoked` body `"{name} ביטל את מפתח הגשר..."` (the one owner-approved exception to "a notice never names a person", noted in `notify_policy`); `bridge.key.revoked` details `actor_name`, `at` |
| 5 | ב - an administrator may switch the bridge-key notices off | already an ordinary policy (WXH-LEFTOVERS §6 item 3) - kept; the code comments now say so; a test switches both sources off and revokes (outcome `disabled`, audited) |
| 6 | ב - the button is never blocked for want of an owner contact | no check exists; a test revokes with no contact and the notice reaches every system administrator |

## 3. How

### Backend (`smplwise_vms/backend/smplwise/`)

- `services/bridge_key_revocation.py` (new). State in the setting `bridge.revocation` (in `backup.SETTINGS_KEEP`: a restore can neither
  lift nor invent a revocation): `none -> revoked -> repaired`, a second revocation while revoked makes a newer id and a newer code.
  `revoke()` in ONE write transaction: `bridge_keys.reset_set` (every live key wiped, its sealed blob NULLed, an unfinished rotation closed
  - `needs_repair` included), the plain pairing code deleted and a fresh one made (`ha_bridge.ensure_pairing(regenerate=True)`), the
  bridge's announced capability and reported generation forgotten, the state, one audit row, one notice (under its own savepoint: a
  failing notice never undoes the revocation). After the commit: capture leases revoked, lease worker reset, WAL scrub, the new code
  announced. `on_paired()` ends it at the bridge's verified ping (`bridge.key.repaired`). `reveal()` returns the code only while revoked.
- Blocking while revoked (fail closed): `ha_bridge.signing_key` -> None (every outbound path: doors, devices, casts, leases, WisKey);
  `ha_bridge.verify_message` -> 401 `bridge_revoked` for every inbound message, except `pairing=True` (only `POST /ha/bridge/ping`), which
  verifies against the NEW plain code only; `bridge_rotation`: `preflight`, `resume`, `auto_due` refuse, `view.blocked_by =
  bridge_revoked`; `GET /ha/bridge/pairing` returns `pairing_code: null, revoked: true` and refuses `regenerate` (409); the WisKey re-pair
  route refuses (409). Only the step-up reveal hands out the code.
- `routers/bridge_key.py`: `POST /system/bridge-key/revoke` (`bridge.key.rotate` + system administrator; local sessions only - the prefix
  is in `remote_channel.BLOCKED_ON_REMOTE`; runs under the rotation lock with a 15 s wait so no rotation step interleaves, 409 `revoke_busy`
  otherwise) and `POST /system/bridge-key/revoke/reveal` (`system.configure` + system administrator + step-up). `GET /system/bridge-key`
  carries `revocation` {state, id, revoked_at, revoked_by_name, repaired_at, reveals, last_reveal_at, wiskey_present, announce_path,
  paired_at, step_up_ready}. Never the code.
- `services/bridge_key_notice.emergency(..., name=)` and the `security.bridge_key_revoked` template carry the administrator's name.

### UI (`frontend/src/`)

- `components/sw-bridge-key-revoke.ts` (new), drawn at the foot of the existing "Bridge key" card (Settings › Connections; system
  administrator, local only - the card's own rules). A danger button "ביטול חירום של המפתח" / "Revoke the key now"; the confirm dialog
  lists what happens (key deleted, every bridge operation stopped until the re-pair, a new code sent automatically when possible, the
  notice with your name) and, with WisKey installed, the warning and the acknowledgement checkbox. While revoked: who and when, whether
  the code goes out by itself, and "הצגת הקוד החדש" / "Show the new code" - a dialog asking for the authenticator code (or explaining how
  to turn two-step verification on), then the code, the address, the bridge steps and a copy button. The code is kept in the element's
  memory only while the dialog is open. The card's badge reads "בוטל בחירום" / "Revoked".
- `api/bridge-key.ts`: `Revocation`, `revokeBridgeKey`, `revealNewCode`. `i18n/bridge-key.ts`: 31 new keys in he / en (ar / ru filled
  and dev-marked as before). No home-system branding, no internal codes on screen.

### Bridge 0.10.6 (`custom_components/smplwise_bridge/`, mirrored byte-identical into `smplwise_vms/integration/smplwise_bridge/`)

- `config_flow.async_step_reconfigure`: Settings › Devices & services › SMPLWISE Bridge › Reconfigure takes the add-on address and a
  new pairing code. One signed ping with that code (`_try_pair`, the same as a first install and as the 0.10.3 discovery path): refused /
  unreachable / empty -> the form says why and nothing changes; accepted -> `async_update_entry`; the loaded entry's update listener
  (0.10.4) schedules the one reload (K-02: a fresh key set from the new code); an entry without a listener is reloaded through
  `async_schedule_reload`. Never a flow reload on top of an update listener (refused from Home Assistant 2026.12); `_get_reconfigure_entry`
  is used where the core has it, else the context's entry id. Options are kept.
- `push_health.REFUSED_TEXT` names Reconfigure as the manual fix. Strings / translations (en, he): the `reconfigure` step and two aborts.
- `const.VERSION`, `manifest.json`, `www/smplwise-card.js`: 0.10.6. Version pins in 17 test files moved to 0.10.6.
- Needs one Home Assistant restart (by the owner) to load. Until then the automatic path (0.10.3+) still works; only the manual
  fallback needs 0.10.6.

## 4. Tests

- `smplwise_vms/backend/tests/test_wxh4_emergency_revoke_2407.py` (new, 22 cases): revoke wipes the key set and makes a new code, audited
  with name + time, the code never in an answer or audit row; system administrator + confirmation (operator / site admin refused); the
  notice names the administrator and reaches every system administrator with no owner contact (decisions 4, 6); notices switched off ->
  the revocation still happens, audited `disabled` (decision 5); a failing notice never blocks it; WisKey installed -> 409 without the
  acknowledgement, allowed with it (decision 3); an unfinished rotation is closed and a running step is waited for (`revoke_busy`);
  while revoked nothing is signed or accepted (old and new code), no rotation starts / resumes, `auto_due` is false, the old pairing route
  and the WisKey re-pair route never hand out the code; the old code never re-pairs, the new one does (`repaired`, audited, signing works
  again with the new code only); a second revocation kills the first code; the automatic path announces the NEW code after the commit
  (decision 1); the reveal: not revoked / no authenticator / no code / wrong code / replayed code refused and audited, the right code
  reveals, any system administrator may, nobody else, not after the re-pair (decision 2); local-only and never from an archive; the
  bridge's Reconfigure step (refused / empty / unreachable / accepted with and without an update listener, options kept, no entry); end to
  end: revoke -> reveal with step-up -> the bridge's real Reconfigure pings the real Arx app -> repaired; end to end through the 0.10.3
  discovery path; version 0.10.6 in both copies and the mirror byte-identical.
- `test_wxh_leftovers_2405.py`: the "no route sends the emergency notice" case now pins the revocation service as its one caller.
- 17 files: the bridge version pins moved from 0.10.5 to 0.10.6 (no behaviour change).
- `frontend/tests/unit-bridge-key.spec.ts`: +4 node-only tests (the he / en words naming the revoker and the time, the WisKey warning and
  acknowledgement, the button never waiting for an owner contact, the code held in memory only, no storage / address / console, no
  home-system branding).

### 4.1 Receipts (workstation, this branch)

| What | Result |
|---|---|
| `pytest tests/test_wxh4_emergency_revoke_2407.py` (first run, `-x`) | 22 passed |
| Backend selection, 24 files: the new file, `test_wxh_leftovers_2405`, SR-1 (`test_fake_doorwin_closed_rule_sr1`), `test_bridge_stale_discovery_2383`, `test_bridge_update_listener_2401`, `test_door_bridge_block_2404`, `test_bridge_080`, `test_bridge_config_drift`, `test_bridge_key_activation_295`, `test_bridge_key_pause_295`, `test_bridge_key_rotation_295`, `test_bridge_lease_event`, `test_bridge_media_players`, `test_bridge_media_policy`, `test_bridge_runnable`, `test_bridge_schedule_service`, `test_bridge_service_identity`, `test_bridge_stream_source`, `test_extid_followups`, `test_lovelace_card`, `test_wiskey_adopt_2272_review`, `test_wiskey_s4_core_observer`, `test_wiskey_pairing_2382`, `test_bridge_install` | 898 passed, 5 skipped, 0 failed, 0 errors (counted from pytest's progress marks; the final tally line was not written to the log) |
| `npx playwright test -c playwright.unit.config.ts tests/unit-bridge-key.spec.ts` | 12 passed (8 existing + 4 new) |
| `npx tsc --noEmit` | exit 0 |

A wider selection (55 files incl. notify / backup / second-factor suites) was started and stopped by me after ~200 tests for time (the
workstation ran ~1 test/s): NOT a result.

## 5. NOT_RUN / limits

- No live run of any kind: no lab, Home Assistant, bridge, WisKey, Supervisor or device was contacted; no revocation, re-pair or reveal
  ran anywhere real. The bridge's Reconfigure step ran only under the minimal Home Assistant stub of the 2383 tests (not inside a real
  2026.11 / 2026.12 core).
- Not run: the full backend suite, the evidence / pixel / layout Playwright suites (no screenshots of the new section: NOT_RUN), the
  runner gate, `scripts/release_check.py`.
- The step-up is the administrator's own authenticator (TOTP) code. An administrator without one cannot reveal (the dialog says how to
  turn it on); another administrator who has one can. Arx has no other fresh re-authentication for a Home Assistant-identified session.
  Owner question 1 in §6.
- Between the revocation and the re-pair the OLD bridge entry still holds the old key. Arx no longer signs or accepts anything with it, but
  a holder of the leaked key who can also call the bridge's services inside Home Assistant could still be verified by that entry until it
  takes the new code. The automatic path closes that window within seconds; the manual path closes it when the code is entered.
- WisKey verifies Arx against the bridge entry's pairing code: after the re-pair it follows the new code (no WisKey change needed, not
  verified live).

## 6. Questions for the owner (Hebrew, in the segment report)

1. Step-up = own authenticator code only (a) / also allow "sign in again" once Arx has a way to re-check a Home Assistant identity (b).
   Built: a.

## 7. Rollback

Revert the branch commits. The setting `bridge.revocation` is ignored by an older Arx; while a revocation is open an older Arx would
simply use the fresh plain code (no key material is lost: the old key is already wiped). Bridge 0.10.5 ignores nothing new (the
Reconfigure step simply does not exist there). No migration.
