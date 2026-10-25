# WK4ADOPT-295 - Arx adoption of the WisKey reply-4 deliverables (Windows review of the Mac delivery, 2026-10-25)

Source of the review (read from the private WisKey clone without touching its working tree):
`origin/codex/wiskey-windows-mac-reply4-review-2026-10-25` @ `09b5343c905dc0d0529193d187e0f087ad3ee1ca`,
`docs/owner-development-2026-10-25/windows-mac-reply4-review/`. WisKey product CODE named there: `924df3e9366c262c165fddf31d04dad5e9cb4ede`.
Base of this branch: `origin/release/2200` @ `00c7ae463930c23b009c2361a70866a17767fc53`.

Everything below is implemented and tested on FAKES only. Installation: NOT_PERFORMED. Live: NOT_MEASURED. No equipment, door,
microphone, speaker or capture action, no WhatsApp, no auto-mode change and no replay of an UNKNOWN outcome was made by this work.

## W-001 - `reply4-wkf01f02.patch` (sha256 `df1d604b8a15a73ea790f46fe557e8f75388cb49319ab6213accc37643f31f35`)

Target named by the patch: `pilot/WKF01F02-295` @ `9eca5e92441a40eff8b197b58a43ae6a543afc8b`. The three service files on
release/2200 were byte-identical to that base (before-hashes of `PATCH_TARGET.json` matched), so the patch applied without drift and
reproduced the three after-hashes exactly:

| file | after-hash (patch) | kept as is |
|---|---|---|
| `services/wiskey_media_bridge.py` | `7c8181d6...a842c` | yes, byte-identical |
| `services/intercom_media.py` | `f2ce57ab...45bc3` | the heartbeat hunk moved to the W-002 commit (taken together with the W-002 wiring) |
| `services/wiskey_listen_adapter.py` | `c87fcd07...df43a` | NO - one identified merge, below |

Adopted as reviewed: the terminal `VideoChannel.closed` fence before registry cleanup, `_get` checks before and after `connect` and
closes a late link, `_register_lease` refuses a closed owner under `_LEASE_LOCK`, `LoopThread.stop` is terminal and keeps its handles
when the join is not decided, `_LEASED` stays the only stream registry, `_LEASE_TIMERS` holds cleanup handles of every owner
generation (retired ones too) until joined, `close_leased_streams` returns False while a generation is alive and keeps quarantine and
ownership on a failed DELETE. The old WKF01F02 delta was not re-applied.

Identified merge (R04, `wiskey_listen_adapter.py`): the patch drained the frame queue in `_Downlink._end`, i.e. on EVERY end. On the
combined tree that broke four existing tests of `tests/test_wkaudin_295.py` (WKAUDIN-295 is an ancestor of 9eca; the Mac delivery did
not run the combined tree): frames admitted while current were dropped on a natural upstream end. The drain is now in a separate
`_fence(reason)` used by every close (`_Downlink.close`, `_join_downlink`) - a close still stops publication synchronously, drains the
queue, cancels and joins the producer and the close hook (a cancelled caller still waits) - while the producer's own `_end` keeps the
frames already admitted. `frames()` stops on the sentinel or on the fence.

Tests: `tests/test_wk4adopt_295.py` (W-001 section) plus the existing WKLIVE / WKF01F02 / WKAUDIN / router / app suites (see the
report for the exact runs and exit codes).
