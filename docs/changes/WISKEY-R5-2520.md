# WISKEY-R5-2520 - listen gate (row R5 of WISKEY-RESYNC-2520, WisKey C4)

Branch `pilot/WISKEY-R5-2520`, cut from `origin/pilot/WISKEY-RESYNC-2520` at `6a66cca80`. Target version: 2.52.
Spec: section 4.3 and row R5 (section 6) of `docs/changes/WISKEY-RESYNC-2520.md`; WisKey C4 (`MASTER_TASKS_REVIEWED.json`, finding
`ARX-LISTEN-PARTIAL` in `ARX_CURRENT_CONSUMER_REVIEW.json`, `CONSUMER_ADOPTION_DELTA.json` at WisKey hand-off commit `8c6b10208e3f`).
Nothing was installed, nothing touched the lab or a station, no audio was opened, no message went to WisKey.

## What and why

WisKey rc19 states listening as the opt-in `media/talk_open.parameters.listen` of the signed discovery block `station_talk_audio`
(`arx.station_talk_audio.v1`, transport `signed_ws_pcmu_v1`, `default: false`); viewing, listening, talking and the microphone
permission stay separate. Arx's media contract already sends `listen: true`, but the status row "האזנה לעמדה בלי שיחה" appended
`listen_no_downlink` unconditionally (WisKey's finding ARX-LISTEN-PARTIAL, confirmed).

1. **Status row (the gate), `services/wiskey_feature_status.py`** - the row follows the LAST NEGOTIATED signed discovery, never a
   version label:
   - source, in order: the direct join's CURRENT connection document (only when it is bound to the live connection and the join
     admits it - the same guard as `wiskey_media_caps._from_join`, no I/O), else the last pairing probe WisKey ACCEPTED, else none;
   - none -> new reason `listen_unknown` (PAIR, fix "בדוק חיבור חתום"), row state **`unknown`** (new state rule below);
   - block absent -> `listen_no_downlink` (text now says what is missing: the opt-in in the signed discovery);
   - block present in another shape (`rejected_blocks` of the closed reader, e.g. `default: true` or another `opt_in`) -> new reason
     `listen_offer_rejected` (WK);
   - block offered but `media/station_descriptor`, `media/talk_open` or `media/talk_close` not listed in the same document ->
     `direct_no_media` with the missing names (listening needs no floor and no frames);
   - the signed-path reasons (`Facts.direct()`: provider, key, join, acceptance) now apply to this row too, since a listen rides the
     signed talk channel; `listen_off` is unchanged; the setting value `probe` proves nothing.
   - state rule (`_state`): a reason in `UNKNOWN_CODES` (only `listen_unknown`) makes a row `unknown` unless a definite PAIR / WK / POL
     reason is also there (then `blocked`). Every other row keeps its previous state exactly (`probe_unknown` is not an UNKNOWN code).
   - The row can only be `on` with the setting on/probe, the signed path usable, and the exact opt-in plus the three commands in the
     negotiated document: fail closed.
2. **Probe projection, `services/wiskey_pairing.py`** (allowed for R5): the probe's capabilities keep `rejected_blocks` (sorted names of
   optional blocks present but not read), so a rejected `station_talk_audio` is told apart from an absent one. The served `probe` is
   typed `Any`; no wire model changes.
3. **Runtime refusal before `talk_open` (separate commit; outside the plan's R5 file list, see open question 1)** -
   `services/intercom_media.py` `WiskeyBridgeTalkChannel(..., listen_only=False)` and `services/wiskey_listen_adapter.py`
   (`WiskeyDownlinkChannel` passes `listen_only=True`). Before this, a LISTEN session (setting `probe`, or a descriptor that changed between
   the availability read and the open) read the fresh descriptor and, when it did not offer `signed_ws_pcmu_v1`, still sent
   `talk_open` without `listen`, opened a real talk on the station and closed it again. Now the listen session is refused with
   `listen_not_offered` after the read-only descriptor and BEFORE `talk_open`; nothing is opened. An ordinary talk is unchanged
   (it still opens without the offer, as WKF01F02-295 tests). No other row touches these two files.
4. **Runbook**, `docs/operations/WISKEY_ACTIVATION_RUNBOOK.md` step 5: expected outcome and reason codes follow the new row.

Not done here (by decision): station media over direct v2 (a later separate row; not enabled), any live listen, any rc19 install.

## Files

- `smplwise_vms/backend/smplwise/services/wiskey_feature_status.py` - `_listen_offer`, `_listen`, `_state`, `UNKNOWN_CODES`,
  `LISTEN_COMMANDS`, reasons `listen_unknown`, `listen_offer_rejected`, `listen_no_downlink` (text)
- `smplwise_vms/backend/smplwise/services/wiskey_pairing.py` - probe keeps `rejected_blocks`
- `smplwise_vms/backend/smplwise/services/intercom_media.py`, `smplwise_vms/backend/smplwise/services/wiskey_listen_adapter.py` -
  `listen_only` refusal (commit 2)
- `smplwise_vms/backend/tests/test_wiskey_listen_gate_2520.py` (new), `smplwise_vms/backend/tests/test_wiskey_pairing_2382.py`
  (one assertion: a fresh installation now says `listen_unknown`, and the row is not `on`)
- `docs/operations/WISKEY_ACTIVATION_RUNBOOK.md`, this note

No registry change (`wiskey_channels.py` untouched: listening is a direct-capabilities opt-in of an existing W10 command, not a WS channel).
No UI file changed: the row's texts are served by the backend and rendered by the existing "מצב WisKey" block; no compare page needed.
The reason texts are Hebrew only, like every other reason of that block (the block has no English copy of server texts today).

## Tests (real results)

PC (repo venv, one file at a time, cwd `smplwise_vms/backend`):

| command | exit | result |
|---|---|---|
| `python -m pytest tests/test_wiskey_listen_gate_2520.py` | 0 | 31 passed |
| `python -m pytest tests/test_wiskey_pairing_2382.py` | 0 | 32 passed |
| `python -m pytest tests/test_wiskey_activation_runbook.py` | 0 | 16 passed |
| `py -3.12 -m ruff check` on the six changed Python files | 0 | All checks passed |

Runner (slot B, `~/work/slotb.sh`, worktree of `origin/pilot/WISKEY-R5-2520` at `e61a81f95`, one pytest process per file):

| file | exit | result |
|---|---|---|
| `tests/test_wiskey_listen_gate_2520.py` | 0 | 31 passed |
| `tests/test_wkf01f02_295.py` (talk + station sound) | 0 | 28 passed |
| `tests/test_wkaudin_295.py` (listen sessions) | 0 | 19 passed |
| `tests/test_asgi_wiskey_295.py` (ASGI fake WisKey, incl. listen-only) | 0 | 28 passed |
| `tests/test_wiskey_pairing_2382.py` | 0 | 32 passed |
| `tests/test_wiskey_activation_runbook.py` | 0 | 16 passed |
| `tests/test_wiskey_adopt_2272_contrib.py` | 0 | 39 passed |
| `tests/test_wiskey_mac_adopt_298.py` | 0 | 45 passed |
| `tests/test_wiskey_mac_adopt_298_review.py` | 0 | 40 passed |
| `tests/test_intercom_shared_2440.py` | 0 | 9 passed |
| `tests/test_wk4adopt_295.py` | 0 | 44 passed |
| `tests/test_wiskey_talk_caps_2382.py` | 0 | 28 passed |
| `tests/test_singletons_registered.py` | 0 | 4 passed |

After the rc.10 wording fix in the runbook (doc only), `tests/test_wiskey_activation_runbook.py` was run again on the PC: exit 0, 16 passed.

NOT_RUN: the full backend suite, frontend `tsc` / Playwright (no frontend file changed; the train gate runs them). Live WisKey / lab /
any station audio: NOT_RUN by rule - every listen test runs against the in-memory fake station.

Note for the lab (no action taken): WisKey rc.10's catalog copy (`tests/test_wiskey_rc10_pin.py`) already carries the exact
`station_talk_audio` block and all W10 commands. So once a signed discovery is read, the row changes from the old fixed `blocked` to
`off` (setting off, `listen_off` only) or, with the setting on and the signed path usable, `on`. Each station's drawer still decides
by that station's own descriptor (`no_listen`), and a listen session WisKey's descriptor does not offer is now refused before
`talk_open`. Opening a listen session in the lab stays a separate owner approval (AGENTS.md: microphone session).

## Rollback

Revert the two commits. No migration, no setting, no stored data.

## Open questions

1. The runtime refusal (item 3) touches `intercom_media.py` and `wiskey_listen_adapter.py`, which the plan's R5 list does not name
   (no other 2.52 row touches them). a) keep it in R5 as its own commit (recommended: it is the fail-closed half of the gate, small and
   file-disjoint) b) drop that commit and open a separate row.
2. Source of "last negotiated discovery": a) the join's current document, else the last accepted probe (built) b) the probe only
   (simpler, but stale while the join runs on a newer document).
3. A listen that WisKey offers but the station's own descriptor does not: the row is installation-level and can say `on`, while the
   drawer still answers `no_listen` per station (unchanged). a) keep (recommended; per-station truth stays in the drawer) b) add a
   per-station count to the row later.
