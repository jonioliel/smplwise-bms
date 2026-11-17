# CR-GO2RTC-OWNED-2438 - one "owned streams" rule for go2rtc

Branch `pilot/CR-GO2RTC-OWNED-2438`, based on `origin/pilot/CR-WAVE1B-COMBINED-2436` (`ffb4af2d5`), which carries
`CR-GO2RTC-ADAPTER-2436` (the adapter's `grab_probe`, `create_stream`, `streams=`). Code review 2026-11-13, MASTER_PLAN
section 3.3 entry `CR-GO2RTC-OWNED-2436`: report 03 F09 and the caller half of F10 (plus the `_WRITTEN` name clash of F26).

## The namespace rule (acceptance list: report 03 section 3.0)

The lab go2rtc also serves a separate intercom project. Nothing here widens what Arx may touch: every write and delete still
requires `smplwise_`, and per feature its own prefix and, where the feature had one, its exact shape regex. `OwnedStreams.owns`
checks `smplwise_` on top of the feature prefix, so even a feature built with a foreign prefix owns nothing (pinned by a test).
Every row of the 3.0 table still holds; the adapter guards in `Go2rtc.ensure_stream` / `delete_stream` are unchanged.

## What changed

| Finding | Change |
|---|---|
| 03:F09 | `services/go2rtc.py` gains `names_foreign_stream(src, names, own_prefix)`, `refuse_foreign(src, own_prefix, refusal)`, `OwnedStreams(prefix, shape_re)` (`write`, `delete`, `note_written`, `forget`, `reconcile(wanted, grace_s, key, on_deleted)`) and `delete_listed(client, names, owns)`. |
| 03:F09 | `camera_sources`: `names_foreign_stream` / `_refuse_foreign` delegate (same code `source_not_allowed`, 422); writes and deletes go through `_OWNED`; `reconcile` uses `OwnedStreams.reconcile` and so **gains the lock** across grace check, second database look and delete (before, the grace was read outside it). `_STREAM_LOCK`, `_WRITTEN`, `WRITE_GRACE_S`, `_delete` keep their names (same objects). |
| 03:F09 | `ha_camera_streams`: same delegation; `_write_stream`'s "still wanted" check runs inside the lock as before (`before=`); reconcile unchanged in behaviour (it already had the strict locking). Audit rows, actions, reasons and texts unchanged. |
| 03:F09 | `playback.sweep_orphans`: through `OwnedStreams(own_prefix)` (this instance's prefix only, as before). New: a generation's stream is noted right before it is written, so a janitor sweep never deletes a stream written a moment ago whose session has not recorded `stream` yet (grace `SWEEP_GRACE_S` = 60 s; the startup sweep has no notes and removes every orphan at once, as before). The live set is asked again right before each delete. |
| 03:F09 | `recorder_live.delete_streams`: through `delete_listed` (same single listing, same exact-name and prefix guard). |
| 03:F09 | `frigate_restream.refuse_foreign`: the shared first-segment rule is added; the whole-name comparison of before stays next to it (never weaker). Code `frigate_restream_ambiguous` unchanged. |
| 03:F10 (caller half) | `camera_sources._grab_probe` is now `client.grab_probe(...)`: same request, cap and timeout, through the adapter's client (shared TLS context and the reachability hooks every other go2rtc call carries). |
| 03:F26 (part) | `go2rtc._WRITTEN` (a digest map) renamed `_SOURCE_DIGEST` so it no longer shares a name with the feature modules' timestamp maps; the duplicate `import hashlib` inside `wiskey_stream_name` and the local `unquote` import in `compare_source` removed. |

Intentional behaviour changes (both stricter or safer, no feature removed): the camera-sources reconcile holds the stream lock
across its three steps; the playback janitor sweep skips a stream noted within the last 60 s.

## Tests (workstation, Windows, Python 3.12 venv, `-p no:xdist`)

| Run | Result |
|---|---|
| New `tests/test_go2rtc_owned_streams.py` (21 tests: namespace guarantee with intercom-like and other-feature names, foreign prefix owns nothing, "written a moment ago is not deleted", second look, lock, grace read under the lock, `before` inside the lock, transcode key, partial deletes reported, foreign-source rule, module delegation and aliases, Frigate whole-name rule, `delete_listed`, `recorder_live`, playback sweep with a noted generation and another instance, F10 delegation) | 21 passed |
| The new file + `test_camera_sources_2410.py`, `test_ha_camera_live.py`, `test_multi_nvr_live.py`, `test_playback_release.py`, `test_recordings.py`, `test_frigate_restream.py`, `test_go2rtc_stream_sync_2436.py` | 245 passed, rc 0 (20 min serial) |
| `ruff check` on the touched files | clean |

Mocks only: every go2rtc in these tests is an in-memory fake or an httpx `MockTransport`; no request to a real go2rtc or the lab.

NOT_RUN locally: the full backend suite and the API inventory diff (no router changed) - left to the runner entry check.
