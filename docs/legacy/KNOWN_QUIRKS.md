# KNOWN_QUIRKS — Hikvision DS-7616NXI-K2(D), firmware V4.84.101 (build 251212)

Profile id: `hikvision.ds-7616nxi-k2d.v4.84.101`. Each entry states how it was established.
"lab" = verified against the production NVR on 2026-09-14 with read-only ISAPI calls
(raw captures in `private-evidence/nvr-probes/20260914T071715Z/`, unredacted, never committed);
"code" = behaviour encoded in the legacy add-on and not yet executed by us.

## 1. Time (T014, chapter 20)

| # | Quirk | Established | Consequence |
|---|---|---|---|
| T1 | `/ISAPI/System/time` → `localTime` shows the correct wall clock but its suffix is the **standard** offset (`+02:00`) even during DST (true offset +03:00). `timeZone` = `CST-2:00:00DST01:00:00,M3.5.5/02:00:00,M10.5.0/02:00:00`, `windowsZone` = `Israel Standard Time`. | lab | Never derive the effective offset from the suffix. Map `windowsZone`/POSIX rule to IANA `Asia/Jerusalem` and compute offsets per instant. Explains the legacy "auto +120" that the owner neutralised with "manual −120". |
| T2 | Plain `POST /ISAPI/ContentMgmt/search`: request `startTime/endTime` and result times are **local wall clock**; the `Z` suffix is ignored in both directions. | lab (Q1/Q2 on track 401: a window written with local wall-clock digits returned a segment ending "now") | TimeAdapter: convert UTC → local wall clock with IANA rules before sending, and parse results as local wall clock. This is the legacy-proven path (effective offset 0). |
| T3 | `POST /ISAPI/ContentMgmt/search?timeType=STD`: the **request** is interpreted as true UTC (found the live segment), but **result** times came back as true UTC **+1 h** (standard offset applied during DST). | lab (Q3, one session in DST) | Do not use STD mode without a documented correction; re-test in winter and across a DST boundary before relying on it. |
| T4 | `playbackURI` times use `YYYYMMDDTHHMMSSZ` (compact) and, like T2, are local wall clock. | lab (search response) | Keep `hik_time()` formatting; label as local. |
| T5 | Legacy display-offset feature (auto/manual/auto+manual) exists because of T1/T2. Owner reports the screen shows "auto +120, manual −120 = +0", but the add-on log (2026-09-08 and 2026-09-14) shows search windows widened by exactly the +120 formula (`00:00 → 20:00` two days earlier), i.e. an effective +120 at search time. | code + owner log | Open parity question: what time the legacy UI displays for a recording the NVR stores at 01:52 local (track 801, 13.09). Resolve before declaring legacy display times "correct" (T004). |

## 2. Search, playback, download (chapters 19, 23, 24)

| # | Quirk | Established | Consequence |
|---|---|---|---|
| S1 | `searchID` must be GUID-shaped (`XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`); an arbitrary string yields HTTP 400 `badXmlContent` "Tag 13 is invalid (two root tags)". | lab | Generate proper GUID-like ids (legacy format works). |
| S2 | Search profile: `maxSearchMatchResults=64`, `maxConcurrentSearches=1`, `maxSearchTracks=16`, `maxSearchTimespans=1`. | lab | Serialize searches per NVR; page size ≤ 64 (legacy used 40); one time span per request. |
| S3 | `playbackURI` returned by search points at the **HTTP** port (`rtsp://host:90/Streaming/tracks/101/?starttime=…&endtime=…&name=…&size=…`). | lab | Rewrite to the RTSP port before handing to go2rtc (legacy `normalize_playback_rtsp`). |
| S4 | Download capabilities: `isSupportDownloadbyTime=false`, `isSupportDownloadbyFileName=true`. | lab | Export must go by file (`name` from playbackURI), not by arbitrary time; multi-file export needs concatenation/remux. |
| S5 | `isSupportTransCode=false`; `isSupportSmartSearch=true`; `recordSearchType` = CMR, MOTION, ALARM, EDR, ALARMANDMOTION, Command, manual, AllEvent. | lab | No server-side transcode by the NVR; event-type filters available. |
| S6 | `/ISAPI/ContentMgmt/download`: the legacy's **variant 1** (`<downloadRequest version="1.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><playbackURI>…</playbackURI></downloadRequest>`) sent with **GET** and a body returns HTTP 200 with `Content-Type: Opaque/data`; the playbackURI from search (HTTP port) is accepted verbatim. | owner log 2026-09-08 (`private-evidence/legacy-run/addon_log_2026-09-14.txt`) | Use this variant first; inspect the container (MP4 vs Hikvision PS) in T006 before serving it as `video/mp4`. |
| S11 | Search throughput on this NVR: 417 matches over 11 pages of 40 in ≈0.5 s. | owner log | Pagination cost is low; still respect `maxConcurrentSearches=1`. |
| S12 | Legacy go2rtc stream names `hik_ch<N>` (grid) / `hik_ch<N>_main` (single view) / `pb_<track>_<ms>` (playback) persist in go2rtc.yaml on 1.9.14. | owner log + lab persistence probe | The product janitor only touches `smplwise_*` names. |
| S7 | Recording tracks `101…1001` map 1:1 to channels; streaming ids `<ch>01` main, `<ch>02` sub. `Track/Enable` reads `false` on tracks that do record. | lab | Use discovery, not the formula; do not treat `Enable` as "recording". |
| S8 | `InputProxyChannelList size="6"` while 10 channels are listed. | lab | Ignore the `size` attribute. |
| S9 | `GET /ISAPI/ContentMgmt/logSearch/capabilities` → 400 `badXmlFormat`; `GET …/Storage/quota` → 403. | lab | logSearch needs a different contract (or is unsupported) — reason the legacy events screen struggled. |
| S10 | Legacy playback creates a fresh go2rtc stream per click; no in-stream seek. | code + owner | New engine: session + generation per seek (ADR-006 evidence pending in T006). |

## 3. Control endpoints (not yet executed — need write approval)

| # | Quirk | Established | Consequence |
|---|---|---|---|
| C1 | Manual record: `POST|PUT /ISAPI/ContentMgmt/record/control/manual/{start|stop}/tracks/<id>` with or without a `manualRecord` body; legacy tries four combinations. | code (owner: works) | Pin the working combination in T004 with one supervised test. |
| C2 | IPC reboot via `GET /ISAPI/ContentMgmt/InputProxy/channels/<id>/reboot`; NVR reboot via PUT/POST/GET `/ISAPI/System/reboot`. | code | Sensitive; never executed in tests without explicit approval. |
| C3 | SMART / bad-sector tests: 4 bodies × PUT/POST/GET; "invalid operation" means unsupported. | code | Same as C2. |
| C4 | `alertStream` emits `videoloss inactive` noise; legacy drops it. | code | Keep the filter when T031 revives events. |

## 4. go2rtc 1.9.14 (AlexxIT add-on)

See `docs/operations/G0_INTAKE.md` for the API persistence verdict (`scripts/lab/go2rtc_persistence_probe.py`).
Legacy appends `#transport=tcp` to RTSP sources and relies on the go2rtc Ingress path being pasted into an
add-on option (changes on every go2rtc rebuild) — fragile, replaced by ADR-011.
