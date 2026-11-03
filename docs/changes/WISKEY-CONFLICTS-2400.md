# WISKEY-CONFLICTS-2400 - WisKey conflicts resolve and fleet alert actions from Arx (T5)

Branch `pilot/WISKEY-CONFLICTS-2400`, cut from `origin/release/2382-train` @ `aec6061ff` (it holds the "מצב WisKey" card of
WISKEY-PAIRING-2382 and the capability link map of WISKEY-DEEPLINKS-2382). Target release 2.40.0. Plan:
`private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md`, task T5 (matrix rows 37, 38, 76, 77). Everything was built and tested
against the fake WisKey and mocked backends only: nothing was sent to a real WisKey, Home Assistant, station or installation; no lab
access; no device write. The notification feed is OFF by default.

## 1. What an operator gets

- **A screen** "התנגשויות והתראות עמדות" at `#/wiskey/conflicts` and `#/wiskey/alerts` (one Arx screen, two tabs, the address follows
  the tab; never the embedded panel) - `frontend/src/screens/wiskey-triage.ts` + `frontend/src/components/wk-triage-panel.ts`:
  - **Conflicts**: WisKey's sync conflicts / errors per (person, station) and the deletions WisKey holds for review ("מחיקה ממתינה"); a
    revocation row says it follows the person's sync and has no resolution of its own.
  - **בדיקה** opens a drawer that asks for WisKey's preview (`conflicts/review` - a READ of the station) and shows the impact: managed
    record vs station (name, validity, doors, PIN set / not set, number of cards - never a PIN or a card number), the fields that
    differ, what would change on the station (person / PIN / cards add-remove-update), the stations the person is on (a "device"
    resolution changes the record all of them receive), and the review's time left (10 minutes).
  - The resolutions WisKey allows right now, each with WisKey's reason when not: "להחיל את הרשומה המנוהלת על העמדה" (`central`),
    "לעדכן את הרשומה לפי העמדה" (`device`), for a removal only "להמשיך במחיקה מהעמדה" (`resolve_deletion`). A choice opens a
    confirmation; the request is sent once; the result is said as it is: "התקבל: הסנכרון של העמדה נכנס לתור" (acknowledged - not
    "done"), "הרשומה השתנתה מאז הבדיקה - לא שונה דבר. בדקו שוב." (WisKey `review_stale` / `revision_conflict`), refused with WisKey's
    code, not sent with the reason, or "נשלח, אך לא התקבלה תשובה ברורה".
  - **Alerts**: the active fleet alerts (kind, station, since when, severity), optionally also the snoozed ones (until when, why).
    Actions: **השתקה** (15 min / 1 h / 4 h / day / week + a reason: planned maintenance / network work / investigating; optionally the
    whole station = WisKey's `maintenance` kind) and **ביטול השתקה**, each behind a confirmation, sent once. WisKey has no acknowledge
    and no close for an alert: the screen says so ("התראה נסגרת מעצמה כשהמצב חוזר לתקין").
  - **Notification setting** (alerts tab): "להעביר התראות עמדות חדשות למרכז ההתראות" - off by default; the system administrator turns
    it on; who is told and on which channel follows the notification settings, quiet hours included.
- **"מצב WisKey" card** (הגדרות › מתגי מסכי כניסה, `system-wiskey-pairing.ts`): a new section "מצב WisKey: התנגשויות והתראות" with the
  compact panel (both lists, first 4 rows, the same review / snooze actions) and "למסך המלא".
- **Stations screen**: its link list (page actions, `wk-deep-links place="stations"`) now holds "פתרון התנגשויות סנכרון" ->
  `#/wiskey/conflicts` and "טיפול בהתראות" -> `#/wiskey/alerts` (both native).
- **Capability link map** (`frontend/src/wiskey/deep-links.ts`): `alerts.act` now carries `native: #/wiskey/alerts`, new key
  `conflicts.resolve` (`native: #/wiskey/conflicts`, panel fallback the `sync` tab), both `need` = `access.admin.read` |
  `access.stations.manage` | `system.configure` (any one, any scope). New viewer field `area`: a native link under `#/wiskey/` is not
  offered while the WisKey area is hidden for everyone (`ui.hide_wiskey`). `settings-status` keeps its seven entries (its count line is
  unchanged; that segment shows the conflicts list itself).

## 2. WisKey commands (checked in `C:\hik intercom` @ `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` = `2834aa5e`, manifest `2.0.1-rc.10`)

| Arx step | WisKey command | rc.10 source | What WisKey does | Arx result |
|---|---|---|---|---|
| review | `conflicts/review {station_id, user_id}` | `websocket.py:456, 1772` -> `access/manager.py:1107 async_review` | reads capabilities + the person's device record in the device transaction; answers comparison, plan, allowed actions, `review_token` (HMAC of the device record); writes nothing | review id (token kept server side) |
| resolve | `conflicts/resolve {station_id, user_id, review_token, revision, direction}` | `websocket.py:457, 1774` -> `manager.py:1069` -> `repository.py:1757` | re-reads the device; `review_stale` if the record changed, `revision_conflict` if the person changed; `central` keeps WisKey's record, `device` adopts the station's; binding -> `pending`; `request_user` QUEUES the person's sync | `acknowledged` |
| continue deletion | `conflicts/resolve_deletion {station_id, user_id, review_token}` | `websocket.py:464, 1782` -> `manager.py:1194` -> `repository.py:1813` | same stale check; the station's deletion -> `delete_pending`; `request(station)` QUEUES the station's sync | `acknowledged` |
| snooze / restore | `fleet/alerts_action {revision, station_id, kind, action, duration_minutes, reason}` | `websocket.py:217, 1602` -> `fleet_alerts_api.py:25` -> `fleet_alerts.py:194` | `suppress` (durations 15/60/240/1440/10080, reasons planned_maintenance/network_work/investigating) or `restore` of station+kind (`maintenance` = all kinds); compare-and-set on the suppression revision (`revision_conflict`); "suppression changes presentation, not device state" | `completed` |
| (fresh read before an alert action) | `fleet/alerts` (existing READ channel) | `fleet_alerts.py:269 report` | the alerts with `revision` | not an action |

All four action commands are in both the pinned catalog (`rc37-contract.4`) and the rc.10 extract
(`docs/integrations/wiskey/catalog/rc10-extract/commands.static.json`) with exactly the keys Arx sends; non-READ, so `api_contract: 1`
on every frame (a backend test reads both catalogs). WisKey's grants: review `users: view`, resolve / resolve_deletion `users: manage`,
alerts_action `stations: manage` (station-restricted).

**Channel**: the add-on's own live WisKey session under a new closed allow-list **`triage`** in `services/wiskey_channels.py` with
exactly these four commands; no other channel lets them through and this guard lets nothing else through. Lane name `triage` (not
special-cased by intercom_sync: a read slot and the read buckets), each command sent ONCE, never queued, never retried.

## 3. Backend

- `services/wiskey_triage.py`: frames, closed projections (`project_review` keeps field names, counts and flags only; `project_resolved`
  keeps the revision and the station states of WisKey's answer; no PIN, card number, phone, photo), honest outcome reading
  (`result_of`: a `success: false` with a code is a refusal; `storage_write_failed` / `storage_stopping` / `storage_corrupt` / no code /
  no frame = unknown), Arx's limits (per target cool-down 3 s review / 10 s write after a SEND, per operator 20 reviews / 10 writes a
  minute, in flight 2 reviews / 1 write installation-wide; 429 `triage_cooldown` | `triage_rate_limited` | `triage_busy` with
  `retry_after_s`), the review store, the notification feed thread.
- `routers/access_control_triage.py`:
  - `GET /access-control/triage` - `may_resolve`, `may_act_alerts`, feed state, notification setting (+ `can_edit`), limits, the newest
    outcome per conflict / alert of the last 7 days from Arx's audit rows. Gate: `access.admin.read` anywhere or the manage rule.
  - `POST /access-control/stations/{station_id}/conflicts/{person_id}/review` body `{kind: person|removal}`.
  - `POST /access-control/triage/reviews/{review_id}/resolve` body `{direction, confirmed: true, client_request_id, expires_at}`.
  - `POST /access-control/stations/{station_id}/alerts/{kind}/{snooze|restore}` body `{duration_minutes, reason, confirmed: true,
    client_request_id, expires_at}`.
  - `PUT /access-control/triage/settings` body `{notify: bool}` - `system.configure` at the installation, audited `settings.changed`.
  - **Manage rule** (permission of the brief): `access.stations.manage` UNRESTRICTED (installation, no deny on a site / building /
    station) **or** `system.configure` at the installation; checked before the body is read, a refusal is an audited 403
    (`reason` `station_scoped` for a station-scoped manager). The named station also needs `access.read` on its chain (else 404).
  - Refused and audited as `not_sent` before anything is sent: not JSON, malformed, expired / duplicate envelope, no confirmation,
    review missing / used / expired / another operator's (one answer, no oracle), a direction WisKey did not allow, a person/removal
    mismatch, an offline station (review / resolve read the device), an alert no longer active / not snoozed (fresh read), the limits.
  - Audit rows `intercom.conflict_review` / `intercom.conflict_resolve` / `intercom.conflict_resolve_deletion` /
    `intercom.fleet_alert_action`: attempt (committed before the send) + outcome; actor, request ids, station, WisKey person id (never a
    name), direction / kind / duration / reason, WisKey's code.
- **Migration `0198_wiskey_conflict_reviews.sql`** - the next free number on `release/2382-train` (ends at 0197); `release_check` /
  `test_migrations_263_upgrade` require a contiguous sequence, so a gap (0200) is not possible on this branch. **Collision**: 0198 is
  also `0198_wiskey_station_people` on WISKEY-PEOPLE-COMPLETE-2390 and 0199 is on WISKEY-LIVE-VALIDATION-2390 (scanned over every remote
  branch and local worktree); the train that merges them renumbers this file (it depends only on its own table): one row per review - operator, kind, station,
  person, WisKey revision, WisKey's token (blanked on use), the impact shown, created / expires / used / direction / outcome. Single use
  (compare-and-set), 10 minutes, kept 30 days. Additive; rollback = drop the table.
- **Notifications**: source `wiskey.fleet_alert` in `services/notify_policy.py` (category device_faults, subject `system` =
  system.configure holders, recipients managers, in the app only by default; listed in Settings only while the setting is on).
  `wiskey_triage.AlertFeed` (started in `main.py`) reads `fleet/alerts` every 60 s ONLY while `access.wiskey_alerts_notify` = `true`
  (default false) and reconciles through `notify_sources.reconcile`: one open notification per station + kind, a snoozed alert is not
  announced, a gone / snoozed one is resolved, an incomplete page resolves nothing, a failed read changes nothing, turning it off closes
  what it left open. Quiet hours / windows and the per-source policy are the notification pipeline's (`notify_channels`): this feed only
  signals. With the setting off it reads nothing and opens no write transaction.

## 4. WisKey gaps (asks for WisKey)

1. **No acknowledge and no close for a fleet alert** (rc.10 `fleet_alerts.py`: actions `suppress` | `restore` only). An alert is a live
   observation that ends with its condition. Arx offers snooze / restore and says so; an "acknowledged by X" state would need WisKey.
2. `fleet/alerts_action` requires `duration_minutes` and `reason` on every frame, also for `restore` (where they are ignored). Arx sends
   valid values (60 / investigating), as WisKey's own panel does. Ask: make them optional for `restore`.
3. **Q-WK-11 still open**: is `conflicts/resolve*` / `fleet/alerts_action` permitted for Arx's service identity over the classic channel
   with `api_contract`? Proven only against the fake; the first real run needs the owner's lab approval (plan T5 "lab approval").
4. No TTL on `review_token`: it is a fingerprint, so only a device change makes it stale. Arx adds its own 10-minute, single-use review.
5. `conflicts/list` returns whole person records (phone, profile, schedules) for every conflict; Arx projects them away. Ask: a lean
   conflicts read (id, name, station states, last error).
6. `conflicts/resolve` answers the whole person record; Arx keeps the revision and the station states only.
7. Revocations (`revocations[]` of `conflicts/list`) have no resolution command: they follow the person's sync.
8. `conflicts/review` reads the device inside WisKey's device transaction: an offline / unreachable station cannot be reviewed (Arx
   refuses before sending for an offline station; an unreachable one answers WisKey's code).
9. The alerts' compare-and-set `revision` is only on the full `fleet/alerts` page; Arx reads it fresh before each action (one extra
   read). A per-alert read would be cheaper.
10. Deep link: the panel has no address finer than the `sync` tab for one conflict's review (also noted by WISKEY-DEEPLINKS-2382).

## 5. Conflicts with other branches (report)

- `services/wiskey_channels.py`: the new `triage` channel is ADDITIVE (its own frozenset, one entry in `ALLOWLISTS`, `ADAPTER_CHANNELS`,
  `HA_FRAMES`, `describe()`), but the same lines are edited by the 2.39.0 branches that add `maintenance` (WISKEY-STATION-OPS-2390),
  door technical writes (WISKEY-DOOR-TECH-2390) and profiles (WISKEY-PROFILES-EDIT-2390): a textual merge conflict on those four lines,
  resolved by keeping every channel.
- `tests/test_pwclean_295.py` (`_catalog` excludes channels added after the cleanup: here `ADDED_AFTER_CLEANUP = {"triage"}`; STATION-OPS
  writes `k != "maintenance"` on the same line) and `tests/test_wiskey_channels.py` (`ADAPTER_CHANNELS` tuple and the live-guard map):
  same lines as those branches.
- `smplwise/main.py`: the router line sits right after `access_control_writes` - the same anchor WISKEY-STATION-OPS-2390 uses; the feed
  start / shutdown lines sit after `intercom_calls`.
- `frontend/src/wiskey/deep-links.ts` and its two specs: any branch that edits `PLACES.stations` or the `alerts.act` entry.
- Migration number 0198 collides with WISKEY-PEOPLE-COMPLETE-2390 (see above). `contracts/API_INVENTORY.md` is not regenerated here (+5 routes); the train does that.

## 6. Tests and receipts

All runs below were actually executed; numbers are the tools' own summaries. Fakes / mocks only (no lab, no device).

| What | Where | Command | Result |
|---|---|---|---|
| Backend, new (fake WisKey) | workstation `.venv` (Py 3.12.10) | `python -m pytest -o addopts= -q -p no:cacheprovider tests/test_wiskey_triage_2400.py` | 22 passed |
| Backend, neighbours | workstation | `pytest tests/test_secfix2_pub07_guard_first.py tests/test_capabilities.py tests/test_plan_routes_unique.py tests/test_notify_core.py tests/test_quiet103.py tests/test_wiskey_channels.py tests/test_pwclean_295.py tests/test_wiskey_contract.py tests/test_eccact_readback_295.py tests/test_wa_pacing_coverage_295.py tests/test_wiskey_diagnostics.py tests/test_intercom_adapter.py tests/test_wkdirect_295.py tests/test_migrations*.py` | 341 passed, 2 skipped, **2 failed** (contiguous migration numbers with 0200; the notify listing set) - both fixed in `e52f57f3d` |
| Backend, re-run of the two + new | workstation | `pytest tests/test_notify_core.py::test_migration_tables_defaults_and_push_prefs_left_readable tests/test_migrations_263_upgrade.py tests/test_wiskey_triage_2400.py tests/test_release_check.py` | 28 passed |
| Typecheck | workstation, Node 24.21.0 | `npx tsc --noEmit` | exit 0 |
| Lazy screens | workstation | `node scripts/lazy-tags-check.mjs` | OK (89 route screens) |
| Unit specs (node, no page) | workstation | `npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-triage-2400.spec.ts tests/unit-wiskey-deeplinks.spec.ts tests/unit-wiskey-stations-nav.spec.ts` | 39 passed |
| Browser evidence (mocked) | runner, `run_smart.py preview` @ `d0d1ef1eb` | `tests/evidence-wiskey-triage-2400.spec.ts tests/evidence-wiskey-deeplinks.spec.ts tests/evidence-wiskey-pairing-2382.spec.ts --project=desktop --project=mobile --workers=1` | 51 passed, 11 skipped (desktop-only cases of the deep-link / pairing specs on mobile) |
| Browser evidence, re-run after the UI fix | runner @ `0a7c02b6e` | `tests/evidence-wiskey-triage-2400.spec.ts --project=desktop --project=mobile` | 20 passed |
| Pixel baselines taken | runner @ `d0d1ef1eb` / `0a7c02b6e` | `tests/pixel-wiskey-deeplinks.spec.ts` / `tests/pixel-wiskey-triage-2400.spec.ts --update-snapshots=changed` | 2 changed (deep-link stations menu, desktop + phone), 6 new (triage list / review / snooze, desktop + phone); reviewed image by image |
| Pixel stability | runner @ `cb7bddedb` | `tests/pixel-wiskey-triage-2400.spec.ts tests/pixel-wiskey-deeplinks.spec.ts --project=desktop --project=mobile --repeat-each=2` | 20 passed |
| Neighbour baselines unchanged | runner @ `cb7bddedb` | `tests/pixel-access-status.spec.ts tests/pixel-wiskey-stations.spec.ts --project=desktop --project=mobile --grep pixel-stable` | 23 passed, 1 skipped |

Before every runner job: `gate_status.json` not `running` and no `release_gate` process (checked by the job script each time).

## 7. Not run / known limits

- **NOT_RUN**: any real WisKey / lab run (no lab access by brief). Q-WK-11 (is the add-on's service identity allowed `conflicts/resolve*`
  and `fleet/alerts_action` with `api_contract`) is unproven; the first real resolve / snooze needs the owner's lab approval.
- **NOT_RUN**: the full backend suite and the full release gate; the full frontend unit config (by rule never without a file filter);
  tablet project; other skins than classic for the new pixel spec; `SW_SHOTS=1` evidence pictures (the runner does not copy them back -
  the pixel baselines are the visual record).
- `contracts/API_INVENTORY.md` not regenerated (+5 routes); `management/tasks.json` / `test_catalog.json` not edited (the lead's).
- The notification feed is proven with direct `tick()` calls against the database; its thread's timing (30 s first, 60 s cadence) is not
  exercised in a test.
- Limits are per process (memory), like WISKEY-STATION-OPS'; a restart forgets cool-downs.
- A review taken and then refused before sending (e.g. a limit) stays usable; one consumed by a send that ended `not_sent` must be taken
  again (single use, the token is blanked).

## 8. Rollback

Revert the branch's commits. The migration only adds `wiskey_conflict_reviews` (drop it). The setting `access.wiskey_alerts_notify`
is a plain settings row (delete it); open `wiskey.fleet_alert` notifications resolve when the feed is turned off.
