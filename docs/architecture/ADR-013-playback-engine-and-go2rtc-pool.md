# ADR-013 — Playback engine: go2rtc session pool from NVR RTSP playback, export by file
Status: approved direction (owner, 2026-09-14, option 2א); ADR-006 stays OPEN until T006 measures
Owner / date / linked tasks / requirements: Claude Code / 2026-09-14 / T006, T014, T016, T027, T028, T048 / R011–R012, R027–R032, R053–R058

Context and evidence:
- Owner: legacy playback (go2rtc stream from `rtsp://nvr/Streaming/tracks/<t>?starttime=…&endtime=…`)
  and MP4 download (ISAPI `ContentMgmt/download` by playbackURI) both work today.
- Lab facts (KNOWN_QUIRKS.md): search times are local wall clock; `playbackURI` uses the HTTP port;
  download is supported by file name only (`isSupportDownloadbyTime=false`); `isSupportTransCode=false`;
  one concurrent search.
- Lab fact (go2rtc 1.9.14): `PUT /api/streams` persists to `/config/go2rtc.yaml` and `DELETE` removes it
  (`scripts/lab/go2rtc_persistence_probe.py`, verdict all true). The legacy therefore left `pb_*` entries
  with credentials in the go2rtc configuration.

Alternatives considered:
1. Bounded clip download served to `<video>` — proven for download; inline seekability unknown; latency
   proportional to clip size. Kept as export path and fallback.
2. **Chosen primary:** playback session = one go2rtc stream slot fed by the NVR RTSP playback URL with a
   requested start time; seek = new generation (re-point the slot, reconnect the consumer); measured
   `actual_first_frame_time` and `time_precision` reported to the client (contracts/playback-session).
3. Remux/transcode on the add-on — costly, deferred.

Decision and rationale: option 2 keeps the proven media chain while adding the session/generation model
the spec requires; option 1 covers export and browsers that cannot do MSE.

Effects on API, data, UX, permissions and operations:
- go2rtc objects: fixed pool `smplwise_pb_01..NN` (NN from options, default 4) rewritten in place, never
  growing the config; startup janitor removes stale product slots; credentials only in the RTSP `src`
  held by go2rtc (same as today) — never in stream names, logs or responses.
- Every session carries owner, camera, `permission_revision`, lease and expiry; leases end on tab close,
  revocation or inactivity (T016).
- Export jobs use download-by-file per segment and report partial results honestly (chapter 27).

Validation evidence / rollback: T006 measures on the lab NVR: requested vs first-frame time on ≥20
seeks, keyframe offset, 20 consecutive seeks without stale frames or orphaned slots, go2rtc restart
recovery; results decide ADR-006. Rollback: disable playback sessions → export-only mode.

Approver / supersedes: owner 2026-09-14 / detail for ADR-006.
