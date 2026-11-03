# WISKEY-INBOUND-CALLS-2382 — incoming door-station calls as first-class objects

Branch `pilot/WISKEY-INBOUND-CALLS-2382` from `origin/main` (`efc12d0e3`, v2.38.0). Not merged, no tag, no version bump.
No device writes, no lab access, no WisKey / Home Assistant / station contact: every test runs against fakes.

## What the owner asked

When someone presses the call button at a door station: the Arx operator (desktop, the phone web app) sees the call with the
picture, can answer (talk), decline or open the door, and the call is logged.

## What existed before this slice

| Piece | Where | State |
|---|---|---|
| Call state per station (`idle` / `ringing` / `in_call` / `ending`) | WisKey `overview` → `services/intercom_sync._station` (`call_state`) | served; refreshed on the station entities `ringing` / `call_status` (`STATION_WATCH_KEYS`) |
| Answer / decline / hang up | `POST intercom/stations/{id}/call` → WisKey `media/signal` (`access.call` on the station chain, envelope, audited attempt + outcome) | existed; used by the stations screen's call row (two taps) |
| Door | `POST intercom/stations/{id}/release` (the one door rule, confirmed, audited, never retried) | existed |
| Talk | `POST access-control/stations/{id}/talk` + `wiskey/talk-session.ts` (W10 media, off unless `access.station_media = video_talk`) | existed in the station drawer (`wk-talk-button`) |
| Call strings | `i18n/wiskey-stations.ts` (`call.ringing`, `answer`, `reject`, `hangUp`, `none` "אין שיחה") | existed |
| Ring notification | `notify_sources.on_stations` → `door.ring` (alert, push on by default, resolved when the ring stops; never muted by a quiet window) | existed: a row in the notification center + phone / browser push |
| Call history | WisKey keeps a bare `ring` row in `events/list` (no answer / missed / who) | no Arx call log |
| A banner over every screen | — | did not exist (the call was visible only on the stations screen) |

## What this slice builds

1. **The call book + the call log** — `services/intercom_calls.py`, migration `0197_intercom_calls.sql`.
   One call per ring that Arx observes (WisKey has no call id). `intercom_sync._store` hands every changed station copy to
   `on_stations(before, after)` (on the feed loop: in memory only, writes queued for a writer thread). Outcomes:
   ringing→in_call = answered (`arx` + who when an Arx `answer` of that station was accepted in the last 20 s, else `elsewhere`);
   ringing→idle = declined (who) after an Arx `reject`, else missed; in_call→idle = answered, `ended_by` the Arx user whose
   `hangUp` preceded it; offline / unknown mid-ring = unknown. A door opened from Arx during the call (or ≤ 60 s after it) joins the
   row. A lagging copy never mints a second call for the same ring. Calls left open by a previous process are closed at start-up;
   rows older than 90 days are pruned. Station name + Arx operator names only — never a visitor, image or phone.
   Hooks (one line each): `routers/access_control.call_signal` → `note_command`; `open_door` → `note_door`; `main.py` starts/stops
   the writer and registers the router.
2. **Routes** — `routers/intercom_calls.py` (its own router):
   - `GET intercom/calls/active` (`access.call` somewhere): ringing calls of stations where the caller holds `access.read` +
     `access.call` on the station chain and the setting includes him; plus the calls HE answered from Arx; `sound` / `sound_reason`;
     empty unless the feed is live (a ring on a last-known copy is never offered). Does not count as "someone looking" (does not
     keep WisKey's overview polling alive).
   - `GET intercom/calls?station_id&limit&before` — the log, per row `access.read` + (`access.events.read` or `access.call`) on the
     station; user ids stay on the server (`answered_by_me` only).
   - `GET/PUT intercom/calls/settings` (`system.configure`, PUT audited old/new).
3. **The setting `intercom.call_banner`** (new behaviour → **OFF by default**): `off` / `everyone` (everyone holding the call right
   on the station) / `roles` (only holders of chosen roles); optional station list (empty = all); `sound` (default on). The banner
   never widens a right. UI: `screens/system-call-banner.ts`, under "תצוגת מסך התחנות" in הגדרות › מתגי מסכי כניסה.
4. **The global banner** — `components/sw-incoming-call.ts`, mounted once in `shell/sw-app.ts` (the normal application; not the
   wall / kiosk / embed). Station name, a still refreshed every 2 s (live video stays in the drawer), the ring clock, and:
   - **מענה**: when the station media offers talk, answers once (same route/audit) AND opens Arx's own talk session from the same
     gesture (same talk routes as the drawer; mute / unmute; hang up ends both). When talk is NOT offered (off in Settings, only in
     the classic panel, no permission, descriptor unreadable): **nothing is sent**, the station opens (`#/wiskey/devices?station=…`:
     the native drawer, or the embedded panel where the native screen is off) and the banner stays with the reason line.
   - **דחייה**: one signal. **פתיחת דלת** (per relay, named when >1): an inline "לפתוח את X?" and ONE confirmed release; the line says
     "sent", never "opened".
   - **הסתרה** (remembered for the tab session), **השתקת צלצול**, "לתחנה", "עוד N" for several calls (newest first; my answered call
     in front). A ringing call whose station drawer is open is left to the drawer.
   - Updates: the existing `intercom/ws` notices (refetch on `intercom_refresh`), polling 3 s while a call is shown, 4 s without the
     socket (station-scoped users get 4403 there), 20 s idle, 60 s while off. Only users with `access.call` somewhere ever ask.
   - **Sound** (`wiskey/ring-tone.ts`): a Web-Audio two-note chime every 3 s for ≤ 45 s. Server-decided: silent when the setting's
     sound is off, or during the notification quiet hours unless the `door.ring` severity passes them for push (the same
     pass-through matrix). Quiet windows never mute a doorbell (REL2140 M-5, unchanged). Never the critical / DND-bypassing sound
     (doors are not in `CRITICAL_SOUND_SOURCES`). Browser autoplay: unlocked on the first touch; until then the banner says so.
   - **Phone**: ≤ 600 px it is a bottom sheet (full width, safe-area padding, 44 px+ targets, three action columns).
5. **Call history in the station activity** — `components/wk-call-history.ts`, a section "שיחות אחרונות" of the station drawer
   (one line in `screens/wiskey-stations-views.ts`). Drawn only when the station HAS logged calls (no empty box, no error box), so
   the existing drawer baselines do not change.

Kept apart from the talk/dial drawer slice (`pilot/WISKEY-TALK-DIAL-2382`): no edit to `wk-talk-button`, `wk-station-live`,
`wiskey-stations-actions` or the drawer's call section; the banner owns a `TalkSession` over the same backend routes. Once that slice
lands, the banner's talk line can be replaced by its component. Not touched: `system-wiskey-diagnostics` (pairing), managed install.

## What WisKey would need to make it "perfect" (requests, not done here)

Read on `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` (static reading):
1. **A pushed call-state event** with a **call id** and the **ring-start time** (today: `call_state` is polled from ISAPI `callStatus`,
   2 s idle / 0.75 s active; `subscribe` sends a data-free refresh only on the ring row; nothing on ringing→in_call→idle).
2. **How the call ended**: `answered` (and where: which indoor unit / panel), `rejected`, `missed` (timeout), `hung_up` — WisKey's
   `events/list` has only `ring`, and `events/list` refuses `event_type: "ring"` as a filter (`EVENT_TYPES` excludes it).
3. **Caller context** where the device knows it (the dialled room / unit number). None today.
4. **`ending`** is declared but never produced; `onCall` "means busy, does not prove the call was answered" (WisKey's own comment).
5. **A signed (W10) answer / reject / hangUp** next to the W10 talk commands — today `media/signal` is a plain HA websocket command
   (bridge-wrapped at best); `physical_result` is always "unverified".
6. **Answer + talk as one operation** (today talk does not check or change the call state; Arx sends both).
7. The HA bus event `hikvision_intercom_operations_event` drops `event_type`, so a ring cannot be told apart there.

## Tests

- Backend: `smplwise_vms/backend/tests/test_intercom_calls_2382.py` — the call book on fake WisKey station copies (answer from Arx /
  elsewhere, missed, declined with who, stale command window, offline mid-ring, lagging copy, first seen in a call, ring after a call,
  ring in progress at feed start, door during / after / long after), the writer + orphan close + retention, and the routes over the
  real feed path (`intercom_sync._store` with a fake WisKey copy, `FakeWisKeyFeed` transport): off by default, everyone / station scope
  / roles / station list, viewer refused, stale copy never offered, quiet hours + pass-through + sound off, answer / door / hang up /
  decline logged with who, log rights per station, settings validation + audit.
- Unit (node): `frontend/tests/unit-incoming-calls.spec.ts` — which calls show, ring rule, answer plan + talk reasons, clocks, poll
  cadence, door labels, log lines, durations, he/en key parity, no platform names.
- Browser (runner): `frontend/tests/evidence-incoming-call.spec.ts` (desktop / tablet / mobile) and
  `frontend/tests/pixel-incoming-call.spec.ts` ("pixel-stable" titles; Linux baselines generated on the runner).

## Rollback

Revert the branch. The migration is additive (`DROP TABLE intercom_calls` removes it); the setting key `intercom.call_banner` is
ignored by older code; with the setting off (default) nothing new is shown and no request is made by users without `access.call`.

## Receipts (03.11)

| What | Where / SHA | Result |
|---|---|---|
| Backend: `test_intercom_calls_2382.py` + `test_notify_sources.py` + `test_security_review_wxd_fixes.py` + `test_access_permissions_wxperm.py` + `test_intercom.py` | workstation, repo `.venv`, backend as in `0f39b01e4` (unchanged since) | 280 passed |
| Backend: `test_intercom_calls_2382.py` + `test_notify_sources.py` | runner `run_smart.py backend` @ `6bc7fb1d3` | 54 passed |
| `tsc --noEmit` | workstation; runner `run_smart.py tsc` @ `0f39b01e4` | ok / ok |
| Unit `unit-incoming-calls.spec.ts` (node only) | workstation, `playwright.unit.config.ts` | 13 passed |
| `evidence-incoming-call.spec.ts` desktop / tablet / mobile | runner @ `6eccd2d58` | 35 passed, 0 failed, 4 skipped (project-only tests) |
| Regression `evidence-wiskey-stations`, `layout-wiskey-stations`, `evidence-access-s12`, `layout-access-s12` (3 projects) | runner @ `6eccd2d58` (load 11.8) | 6 failed: 3 = the hygiene allow-list did not know the banner's reads (fixed in `6bc7fb1d3`), 3 = `sw-app` / dialog timeouts under load |
| The 6 above, again | runner @ `6bc7fb1d3` | 18 passed, 0 failed |
| Pixel `pixel-incoming-call` (new, "pixel-stable") + `pixel-wiskey-stations` + `pixel-access-s12`, desktop + mobile | runner `linux-pixel` @ `6eccd2d58` | 35 passed, 1 skipped; main @ `efc12d0e3` 27 passed on the two existing files |
| Linux baselines of `pixel-incoming-call` | runner `--update-snapshots` @ `d78e95576`, committed in `fcfc1892b` | 10 PNG |

Evidence screenshots are written on the runner under `docs/design/evidence/WISKEY-INBOUND-CALLS-2382/` and were not copied back.

## NOT_RUN

- Anything against the real WisKey / Home Assistant / door station (no lab access by rule): the ring → banner latency, a real
  answer / decline / hang-up, the call log on real transitions.
- Real two-way audio from the banner (the runner browser has no microphone; the talk start is mocked as refused). The talk session
  itself is the existing `wiskey/talk-session.ts`, unchanged.
- The ring tone's audibility (Web Audio is not asserted; only the server-side sound decision and the "touch to enable" line).
- The fixture job (real backend + UI together) and the full release gate.
- iOS Safari (autoplay / microphone rules differ there).
