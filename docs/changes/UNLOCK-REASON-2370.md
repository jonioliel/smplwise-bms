# UNLOCK-REASON-2370 - a lock that cannot be opened says why

Branch `fix/UNLOCK-REASON-2370` (from `origin/release/2360-train`). Targets release 2.37.0. No version bump, no merge, no tag.

## Problem

The locks panel ("מנעולים במבנה") showed "פתיחה דורשת הרשאה נפרדת" for every lock whose `can_unlock` was false, whatever the real
reason. In a lab installation all ten locks were WisKey intercom doors that were not mapped to their station and relay in
"שיוך דלתות": `_wiskey_open_allowed` returned false at `intercom_doors.resolve` before any permission was evaluated, and the
panel blamed a permission. Time was spent granting permissions that were never the problem.

## What changed

### Backend - one rule, a reason per lock

`services/door_authority.unlock_reason(...)` is now the only place that decides `can_unlock` (`can_unlock == (reason == "ok")`).
It replaces the two inline formulas (the WisKey one in `routers/ha._wiskey_open_allowed`, the ordinary one in
`routers/devices.items`) and is used by:

- `GET /devices/items?kind=locks` - each row carries `unlock_reason` next to `can_unlock`;
- `GET /ha/entities/{id}` (what the map card reads) - the entity carries `unlock_reason`, and its `lock.unlock` action carries
  `granted` (= reason is `ok`) and `reason`.

Closed set, first match wins:

| reason | meaning |
|---|---|
| `alarm_managed` | the alarm section owns the control |
| `door_not_mapped` | WisKey/intercom door with no (or a stale) door-map entry; nothing else is evaluated, the door has no station to check a grant against |
| `wall_profile` | the caller is a wall-display account (the door rule refuses it as such) |
| `not_placed` | the caller's door grant is bound to floors and this lock is not placed on one of them |
| `no_permission` | no `door.unlock` / door-open grant that reaches this lock (or an explicit deny) |
| `no_control` | ordinary lock only: holds the door grant but not `ha.entity.control` at the lock |
| `ok` | may be offered |

The answer is a code only. No station, relay, role or binding is returned, so a caller without `system.configure` learns nothing
about the configuration. Configuration links exist only in the frontend and only for `system.configure` holders.

Also (counts only, read-only):

- `intercom_doors.unmapped_summary(conn)` - `{count, with_suggestion}` of present, enabled WisKey locks that do not resolve now.
- `GET /access/door-grants` returns `unmapped_doors` (the door-permissions tab notice).
- Readiness (`services/readiness.py`, check `integrations`, "חיבורים לתשתית"): a fact "שיוך דלתות" with
  "N דלתות ממתינות לשיוך - אשר הצעות" (every waiting door has a clear one-to-one suggestion), or a variant when some need manual
  mapping. The waiting doors count as half credit in that check while they wait, and the check's next step becomes
  "שיוך דלתות" -> `#/system/setup` when the health connections are otherwise fine. It never maps anything. No new check id was
  added on purpose: a new id would change the closed readiness id set that the fleet-report schema and its receiver fixtures
  are generated from.

### Frontend

- `src/screens/lock-reason.ts` (pure, unit-tested): the Hebrew sentence per reason, the optional link, and the notes below.
- Locks panel (`devices-controls.ts renderLockControls`): "הדלת לא משויכת לתחנה" + link "לשיוך דלתות" (system.configure only);
  "אין לך הרשאת פתיחה לדלת זו"; "המנעול מנוהל ממסך האזעקה"; "ההרשאה שלך לפי קומה - המנעול לא ממוקם על מפת הקומה";
  wall display and no-control sentences. An older server (no reason) keeps the old generic sentence.
- Map card (`explore-floor-map.ts`): the note under a dimmed open action and the dimmed button's tooltip use the specific
  reason. Other dimmed actions keep "נדרשת הרשאה נפרדת: ...". The label "רגישה — הרשאה נפרדת" (`risk_label`) is left on enabled
  sensitive actions, where it is accurate (the action needs its own grant); it no longer appears as the explanation of a
  dimmed open button.
- Door-permissions tab (`sw-door-grants`): a notice "N דלתות אינטרקום עדיין לא משויכות לתחנה - אף אחד לא יוכל לפתוח אותן, גם עם
  הרשאה" with the link for administrators.
- "הרשאות אפקטיביות": when `door.unlock` / `access.doors.open` is shown as allowed, a note that intercom doors also need a door
  mapping, with the link for administrators.

### Link target

"לשיוך דלתות" goes to `#/system/setup` (Settings › חיבורים), where the "שיוך דלתות" card sits. The page has no card anchor
yet; a deep link to the card is a possible follow-up.

## Tests

- Backend: `tests/test_unlock_reason_2370.py` - each reason (unmapped, stale mapping, wall display, floor-scoped grant / not
  placed, no permission, no control, alarm managed), list and single view agree, `can_unlock` follows `ok`, nothing about the
  configuration leaks through the reason, door-grants count, readiness fact / wording / next step / read-only. Fixtures and fakes
  only (the `world` fixture of `test_wiskey_door_path.py`); no device, no Home Assistant.
- Frontend: `tests/unit-lock-reason-2370.spec.ts` (texts, links per permission, fallback, map card, effective note, tab notice).
- Results: new backend file 13 passed; adjacent backend files (devices, ha, ha authority, kiosk, readiness, readyfleet, door path, door gate, wxperm, security-review, emergency readiness) 224 tests, 223 passed, 1 failed (`test_readiness_96::test_a_demo_runs_on_a_separate_database_and_leaves_the_real_one_untouched`, which fails identically on the unmodified base - a Windows temp-directory cleanup assertion); frontend unit specs 14 passed (new spec + `unit-door-path`); `tsc --noEmit` clean.
- NOT_RUN: browser / pixel evidence of the new notes (no local build on the workstation; no runner job started).

## Rollback

Revert the branch. The new fields are additive (`unlock_reason`, `reason`, `unmapped_doors`); an older frontend ignores them and
an older backend makes the new frontend fall back to the generic sentence.
