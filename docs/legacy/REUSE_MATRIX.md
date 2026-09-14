# REUSE_MATRIX — legacy add-on v1.5.27 → SMPLWISE VMS

Decision codes: **reuse** (take the logic, wrap in a typed adapter with tests), **refactor** (same
behaviour, new structure), **replace** (new implementation; legacy is evidence only), **learn** (study,
no code carried over). Evidence: "code" = observed in source; "lab" = verified against the production
NVR/go2rtc on 2026-09-14 with read-only probes. Legacy line numbers refer to `app/main.py` unless noted.

| # | Capability | Legacy source | Observed behaviour | Decision | Risk / rationale |
|---|---|---|---|---|---|
| 1 | ISAPI HTTP client (Digest, base URL, 15 s timeout, redirects) | 1871–1890 | Single shared client, rebuilt on config change | **reuse** | Digest with httpx is proven (lab). Add per-NVR token bucket: `maxConcurrentSearches=1` (lab). |
| 2 | XML helpers, namespace-agnostic dict conversion | 126–160, 272–303 | Handles Hikvision `ver20` namespace and attribute-bearing nodes | **reuse** | Small, correct; keep with unit tests on captured XML. |
| 3 | NVR time/offset parsing | 163–205 | Takes `+02:00` from `localTime` even in DST → "auto +120"; owner compensates with manual −120 | **replace** (TimeAdapter, T014) | Lab proves the suffix is the standard offset and that search times are local wall clock. Keep the parser only as a fixture generator. |
| 4 | Track/channel id mapping (`<ch>01`) | 262–269, 1916–1923 | Formula, no discovery | **wrap** with discovery from `/ContentMgmt/record/tracks` | Lab confirms 101…1001 on this NVR, but the spec forbids assuming the formula. |
| 5 | Recording search with pagination and dedupe | 3081–3176 | GUID-style searchID, page 40, up to 25 pages, `//recordType.meta.std-cgi.com` | **refactor** | Verified shape (lab). Add coverage/partial reporting, cancellation, cache buckets (chapter 23). |
| 6 | Daily distribution (recorded days per month) | 2778–2807 | POST `trackDailyParam` | **wrap** | Not yet verified; cheap and useful for the calendar. |
| 7 | Playback RTSP URL builder + playbackURI normalisation | 89–124 | `Streaming/tracks/<t>?starttime=YYYYMMDDTHHMMSSZ&endtime=…#transport=tcp`; rewrites port | **reuse** | playbackURI from search carries the HTTP port (lab) — the rewrite is required. |
| 8 | Playback via go2rtc stream from RTSP | 2913–2936, index.html `playRecGo2rtc` | Creates `pb_<track>_<ts>` with credentials in `src`; iframe player | **refactor** (T006/T028) | Proven to play (owner). Replace with a bounded, namespaced session pool, no credentials in names, cleanup, seek = new generation. |
| 9 | go2rtc WebSocket relay | 2947–3005 | Browser ↔ add-on ↔ go2rtc `/api/ws?src=` | **reuse** + per-camera authorization | Exactly the transport the new design needs (ADR-011). Not exercised by the final frontend; must be tested. |
| 10 | go2rtc generic HTTP proxy | 3008–3070 | Any method/path forwarded; `Access-Control-Allow-Origin: *` | **replace** | Too broad; expose only signalling, MSE and snapshot paths we own. |
| 11 | ISAPI download → MP4 stream | 2809–2900 | 4 XML variants × GET/POST until HTTP 200; `video/mp4`, inline or attachment | **wrap** for export (T048) and fallback | Owner: download works. Which variant succeeds is unknown → record in T006 and pin it; download-by-filename only (lab capability). |
| 12 | Snapshot with 3 URL fallbacks (main/InputProxy/sub) | 2231–2256 | `Cache-Control: no-store`, optional attachment | **wrap** | Keep fallbacks; add per-camera authorization and rate limit. |
| 13 | Channel status parsing | 2258–2283 | Tag-tolerant online detection | **wrap** | Verify against `workingstatus` JSON (lab) which is richer (record/signal/bitrate). |
| 14 | Storage: HDD list, deep status, SMART / bad-sector tests | 2318–2382 | GET lists; tests try 4 bodies × 3 methods | **wrap** behind `nvr.config.write` | Tests are device writes → sensitive permission + confirmation + audit. |
| 15 | Maintenance aggregate | 2384–2450 | One call gathers device, channels, storage, caps, tracks | **refactor** into health model (chapter 30) | Separate states instead of one blob. |
| 16 | Manual recording start/stop, duration auto-stop, restore after restart | 1904–2004, 2716–2776 | Tries POST/PUT with/without body; state persisted in override JSON | **wrap** behind `nvr.record.manual` | Proven by owner; keep the variant probing but pin the working variant per firmware after T004. |
| 17 | Camera reboot / NVR reboot | 2286–2316 | GET reboot for IPC; PUT/POST/GET for NVR | **wrap** behind sensitive permission | Physical/disruptive; explicit confirmation and audit (spec chapter 8, 15). |
| 18 | Event engines: alertStream split/parse, payload normaliser, filters, local JSONL store, logSearch/metadata/picture search | 372–1870 | Disabled in production; `logSearch/capabilities` → 400 on this NVR (lab) | **learn**; later **refactor** alertStream parser (T031) | Large, unproven; the alertStream splitter and normaliser are the most reusable parts once verified. |
| 19 | PIN authentication, technician gate, sessions | 2006–2116 | Shared PIN, IP-based lockout, in-memory sessions | **replace** (HA identity, T011/T076) | Mandated by v1.1. |
| 20 | Config overrides in `/config/*.json` | 81–87, 207–260 | JSON files edited in place | **replace** (SQLite in `/data`, migrations) | Keep a one-time importer for `camera_names` and offsets. |
| 21 | Camera aliases (`camera_names`) | 238–249, UI rename | Local display names separate from NVR names | **reuse concept**, migrate data | Matches spec chapter 4 (display_name ≠ OSD). |
| 22 | Live grid: screen counts, camera picker with ordering, tile sizing, snapshot fallback with backoff | index.html 900–988, 2875–2969, 3611–3727, 3747–3783 | Works today | **learn → rebuild** in Lit (T018) | Preserve behaviours: 1/2/4/6/8/12/16, ordering, muted autoplay, backoff. |
| 23 | Single live player: HD/SD toggle, manual record modal, snapshot | index.html 3443–3568, 2759–2841 | Works today | **learn → rebuild** (T017) | Same controls behind permissions. |
| 24 | Recordings UI: search panel, list, canvas timeline, summary chips, display formatting | index.html 4545–4895 | Works today | **learn → rebuild** (T029) | Timeline becomes shared `Timeline` component with gaps/events. |
| 25 | Themes / CSS tokens (dark, graphite, light) | index.html 8–12 | Dark by default | **replace** with design tokens from the mockups (T007) | Owner decision: light + blue, SmplWise logo. |
| 26 | `config.yaml` / Dockerfile / `run.sh` | root | Local build, options copied to `/tmp` | **refactor** (T009) | New slug, `panel_admin: false`, `password` option types, proper init. |
| 27 | Generic ISAPI GET proxy `/api/isapi/{path}` | 2225–2229 | Any ISAPI GET for any logged-in user | **replace** | Security: no raw device proxy in the product (spec chapter 32). |
| 28 | `/api/live-stream-url` (RTSP with credentials to browser) | 3072–3079 | Credentials leave the server | **replace** | Spec: credentials never reach the browser. |

Migration notes: import `camera_names`, display-offset settings and manual-recording state from
`/config/hikvision_nvr_override.json` during first setup (dry run + report, chapter 4); never modify
that file. The legacy add-on keeps running side by side (shadow mode) until the pilot gate.
