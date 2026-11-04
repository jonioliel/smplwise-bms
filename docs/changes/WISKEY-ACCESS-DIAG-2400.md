# WISKEY-ACCESS-DIAG-2400 — "אבחון הרשאות": native access diagnostics views

Branch `pilot/WISKEY-ACCESS-DIAG-2400`, from `origin/release/2382-train` (@ `9d5b2963b`, 2.38.1 + the 2.38.2 train). Task T10 of
`private/planning/WISKEY_FULL_INTEGRATION_PLAN_2026-11-03.md` (group G7; capability matrix rows 28, 29, 36, 89). Target release 2.40.0.
No version bump, no tag, no merge. No lab access and no device write was made to build or test it (fake WisKey and mocked backends only).

## What it is

A new Arx screen "אבחון הרשאות" at `#/wiskey/access-diag[?view=...]`, under the access-control area (the tab row marks "אנשים"),
reached from the people screen's and the stations and doors screen's link menus. It answers "why did / didn't the door open" in Arx,
from WisKey's own diagnostics (WisKey 2.0.1-rc.10, ref `origin/codex/wiskey-mac-m12-policy-b-2026-11-02` @ `2834aa5e`):

| View | Route | WisKey commands | What the operator sees |
|---|---|---|---|
| האם יכול לפתוח | (default) | `users/access_scenario`, `users/access_compare` (the person vs themselves), `users/access_compare_options` | pick a person (search by name), a door, now or a time -> **yes / no** and WisKey's explanation: its reason (archived / inactive / no assignment / door not assigned / outside validity / outside schedule), where the grant comes from (group + group names / personal allow / personal block / direct / none), validity, schedule mode, holidays (see gaps), the station's online state, the sync state and the station's last timing evidence. "A prediction from the central policy - the physical door is not checked" is said every time (`physical_result: not_verified`). |
| השוואה | `view=compare` | `users/access_compare`, `users/access_compare_options`; two doors: `users/access_reviews` x2 | two people or two groups per station and door (shared / only one / neither, each side's source); two doors: who of the people assigned to either door is granted at one, the other, both (Arx compares the two review reports, up to 1 000 people per door; `complete: false` says when cut). |
| סקירות תקופתיות | `view=reviews` | `users/access_reviews`, `users/access_review_preview`, `users/access_review_decide` | one door's people with their review state (not reviewed / due / changed since / follow-up / reviewed / archived), the last decision, who in Arx took it, the next due date; "סקירה" opens one person: central grant, validity, schedule, history, and the decision form where allowed (below). |
| איכות נתונים | `view=quality` | `users/data_quality` | missing / invalid / duplicate data per person (field and problem, never the value); filters and paging on WisKey's snapshot. |
| פג תוקף בקרוב | `view=lifecycle` | `users/lifecycle` | who loses access in the next 7 / 14 / 30 / 60 / 90 days (and who already did), temporary people (visitors / contractors), possible duplicates (reason only), active people without any credential (sensitive level only). |
| ביקורת עמדה | `view=audit` | `stations/permission_audit` | on demand, for one online station: the device's users vs WisKey's desired users (matched / differs + which fields / unmanaged / not checked). Device READ only (`device_writes: 0`). |
| סנכרון | `view=sync` | `sync/diagnostics` | per-station sync worker state (WisKey's pseudonymous station references), failures by code, the last stages. |

## Writes

One: the periodic review decision (`keep` / `followup`, reason, next review in 30 / 90 / 180 / 365 days). It is a durable receipt in
WisKey that changes **no** access and **nothing** on a device (WisKey `access/permission_reviews.py`: "decisions never mutate admission
policy or equipment"). Flow: the form -> a confirmation step naming the person, the door, the decision and the cadence -> ONE
`POST /access-control/diag/reviews/decide` with `confirmed: true` and the command envelope (`client_request_id`, `expires_at` 15 s) ->
the saved line. Never retried, never queued. Server side (routers/access_control_diag.py): `access.people.manage` anywhere before the body
is read (audited 403), then on the door's station; `access.read` + `access.people.read` unrestricted; WisKey must list
`users/access_review_decide` for the add-on's identity; refusals before sending are audited `not_sent`; then the attempt row (committed),
the send on the `access_review` channel, the outcome row (`intercom.access_review_decide`), and Arx's own record of who decided (table
`wiskey_access_review_decisions`, migration **0198**). WisKey's `access_review_stale` -> 409 "the data changed, reload"; WisKey refusing the
identity (`unauthorized` / `field_access_denied`) -> 403 with the panel wording. Where WisKey does not offer the decision, or the operator
does not manage people at that station, the review is **view only** with "פתיחה בחלון האינטרקום" (`#/wiskey/tools/access_reviews`).

## Permissions

- every view: `access.read` at **installation** scope, unrestricted (a deny at a site / building / station counts) - WisKey answers these
  installation-wide, so a station-scoped caller is refused (audited 403 `station_scoped`) instead of being shown a filtered guess;
- views that name people (all but sync): also `access.people.read` unrestricted (the projection filter's people rule cannot be applied
  to these installation-wide answers row by row). This is one step stricter than "access.read for the views" in the task card - recorded
  here as a deliberate choice: names, validity and review states of people are people data in Arx's RBAC;
- the employee number follows the administrator's `access.employee_no_sensitive` (with `access.people.sensitive` it is always shown);
  the "without credentials" list needs `access.people.sensitive` unrestricted (credential kinds are sensitive); otherwise the count only;
- the decision: `access.people.manage` on the station (above).
- `GET /access-control/diag` says to the screen what the caller may do; the screen never decides a permission itself.

## Privacy

Built field by field (services/wiskey_access_diag.py, the adapter's closed-projection rule). Never in any reply, whatever WisKey sends: a
PIN, a card number or a card's last digits (WisKey's `card_last4` duplicate keeps its reason, never `•••• 1234`), a phone number, the
responsible person / purpose, WisKey's actor ids (an HA user id), the sync stages' user pseudonyms, schedule bindings, the audit's `plan`
(what a sync would change, PIN included), WisKey's review fingerprints other than the one a decision must carry back. People data is
never cached. The backend tests plant each of these in the fake WisKey's answers and assert they never reach a reply.

## WisKey channels (additive - expect a merge conflict)

`smplwise_vms/backend/smplwise/services/wiskey_channels.py` gets two closed channels on the service socket: `diagnostics` (the nine reads:
eight READ commands + `stations/permission_audit`, which is non-READ in the catalog and carries `api_contract`) and `access_review` (the one
decision). Both are added to `ALLOWLISTS`, `ADAPTER_CHANNELS`, `HA_FRAMES` and `describe()`; `tests/test_wiskey_channels.py` (the two
tuples) and `tests/test_pwclean_295.py` (the pre-cleanup catalog excludes them) follow. Other 2.39 / 2.40 branches add their own channel
on the same lines (`maintenance` - WISKEY-STATION-OPS-2390; the people-complete and profiles branches likewise): a textual conflict whose
resolution is the union of the lines; nothing else in the channel module changes.

## Deep links (`frontend/src/wiskey/deep-links.ts`)

`access.reviews`, `access.compare` and `people.quality` now carry `native` routes (`#/wiskey/access-diag?view=reviews|compare|quality`,
`need: ['access.read']`), so the people screen's link menu opens Arx's views instead of the panel tools. Two new capabilities join the
stations and doors screen's menu, both native: `access.scenario` ("האם יכול לפתוח את הדלת עכשיו", row 29, panel target `users`) and
`stations.permission_audit` ("ביקורת הרשאות עמדה", row 89, panel target `tools/audit`). The panel targets stay (the screen's own fallback
link, the rows' coverage test). `people.lifecycle` stays a panel link: the panel's tool also holds the renewals, which are not native.
`tests/unit-wiskey-deeplinks.spec.ts` and `tests/evidence-wiskey-deeplinks.spec.ts` follow (a native link is `linkFor(id)`); the stations
menu's pixel baselines (`pixel-wiskey-deeplinks`) are refreshed on the runner.

## Files

Backend: `services/wiskey_access_diag.py` (new), `routers/access_control_diag.py` (new), `main.py` (one include),
`services/wiskey_channels.py`, `migrations/0198_wiskey_access_review_decisions.sql` (new), `tests/test_wiskey_access_diag.py` (new),
`tests/test_wiskey_channels.py`, `tests/test_pwclean_295.py`.
Frontend: `screens/wiskey-access-diag.ts`, `access-control/access-diag-logic.ts`, `api/access-diag.ts`, `i18n/access-diag.ts` (new);
`shell/sw-app.ts`, `shell/nav.ts`, `shell/lazy-screens.ts` (one line each); `wiskey/deep-links.ts`; tests `unit-wiskey-access-diag.spec.ts`,
`evidence-wiskey-access-diag.spec.ts`, `pixel-wiskey-access-diag.spec.ts`, `wiskey-access-diag-mocks.ts` (new), the two deep-link specs.
Not touched: `contracts/API_INVENTORY.md` (the train regenerates it: +12 routes under `/access-control/diag`).

## WisKey gaps (asks for WisKey; none blocks the views)

1. **Holidays**: rc.10's `users/access_scenario` evaluates the person's validity and weekly / dated schedule only; no holiday calendar
   enters the answer. The screen says so on every answer. Ask: a `holiday` reason (and the holiday's name) when one applies.
2. **The grant's source is not in the scenario**: Arx asks `users/access_compare` (the person vs themselves) as a second read to show
   "via group X / personal block". Ask: put `source`, `groups`, `override` in the scenario's `desired`.
3. **Sync diagnostics name no station**: `sync/diagnostics` keys stations with a secret-keyed 12-hex reference; Arx cannot map it to a
   station name. Ask: the station id for an authorized caller (or a mapping read).
4. **The review receipt's actor is the add-on's identity**: WisKey records the HA user of the add-on, not the Arx operator. Arx keeps its own
   record (migration 0198). Ask: an `on_behalf_of` display field on `users/access_review_decide`.
5. **Permission audit duration**: WisKey allows it 90 s (three device reads); Home Assistant's call limit in Arx is 60 s, so Arx waits 50 s.
   A very large station may time out in Arx while WisKey finishes. Ask: an async job form (start + status) like the bulk jobs.
6. **No door-vs-door comparison in WisKey**: Arx builds it from two review reports (≤ 1 000 people per door, `complete` says when cut).
7. **`users/lifecycle` is not caller-projected** in rc.10 (every user, phone and card suffixes included): fine for the add-on's
   administrator identity; Arx drops those fields. Ask: the same projection as `users/data_quality`.
8. **Renewals** (`workflows/renew_*`, `users/bulk_renewal_preview`) are not native here (administrator-only in WisKey); the lifecycle view
   shows who expires, the renewal itself stays in the panel (`people.lifecycle` link).
9. The decision depends on WisKey's panel permissions granting `users/access_review_decide` to the add-on's identity; where they do not,
   the views are read-only with the panel link (Q-WK-11 of the plan covers the general question).

## Tests and receipts

All fakes / mocks; no lab, no device, no Home Assistant. Receipts (2026-11-04):

| Run | Where | Command | Result |
|---|---|---|---|
| backend, new + neighbours | runner @ `986f600be` | `run_smart.py backend <branch> --machine runner tests/test_wiskey_access_diag.py tests/test_wiskey_channels.py tests/test_pwclean_295.py tests/test_fake_wiskey.py tests/test_eccact_readback_295.py tests/test_wa_pacing_coverage_295.py tests/test_intercom_adapter.py tests/test_intercom_authority.py tests/test_access_control_wire.py tests/test_release_check.py` | 228 passed, 2 skipped, **1 failed**: `test_release_check` (migrations must be contiguous; the file was 0200) -> renumbered to 0198 |
| backend after the fix | runner @ `aaada4c86` | `... tests/test_wiskey_access_diag.py tests/test_release_check.py tests/test_wiskey_channels.py tests/test_pwclean_295.py` | 69 passed, 2 skipped |
| backend (local loop) | workstation, project venv (Python 3.12.10) | `python -m pytest tests/test_wiskey_access_diag.py tests/test_wiskey_channels.py tests/test_pwclean_295.py` | 65 passed, 2 skipped (18 of them the new file) |
| unit (node) | workstation | `npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-access-diag.spec.ts tests/unit-wiskey-deeplinks.spec.ts` | 29 passed |
| static unit lints | workstation | the same config with `unit-token-lint`, `unit-a11y-polished-lint`, `unit-menu-lint`, `unit-designtokens-297`, `unit-dialog-toplayer-2381`, `unit-empty-state-icons`, `unit-page-background`, `unit-a11y-r4-leftovers-2380`, `unit-uxfix-rtl`, `unit-entity-id-sweep`, `unit-date-format-module`, `unit-day-format`, `unit-design-tokens`, `unit-arx-pending-tokens` | 110 passed (after adding `lang` to the date-time input) |
| tsc, lazy tags | workstation | `npx tsc --noEmit`; `node scripts/lazy-tags-check.mjs` | clean; OK |
| baselines | runner @ `aaada4c86` | `run_smart.py spec <branch> --machine runner tests/pixel-wiskey-access-diag.spec.ts tests/pixel-wiskey-deeplinks.spec.ts --project=desktop --project=mobile --workers=1 --update-snapshots` | 14 passed; 12 new + 2 refreshed `*-linux.png`, reviewed image by image |
| browser specs | runner @ `3ad7c33ec` | `run_smart.py spec <branch> --machine runner tests/pixel-wiskey-access-diag.spec.ts tests/pixel-wiskey-deeplinks.spec.ts tests/evidence-wiskey-access-diag.spec.ts tests/evidence-wiskey-deeplinks.spec.ts --project=desktop --project=mobile --workers=1` | 40 passed, 12 skipped by design (phone-only / desktop-only behaviour tests), 0 pixel skips |

NOT_RUN: the full backend suite (started once, stopped at ~3 % on the coordinator's disk instruction; the train gate covers it), the
preview / fixture / tablet projects, the dark scheme and the other skins (pixel baselines are classic light only), `contracts/API_INVENTORY.md`
regeneration, any lab check (the views have never seen a real WisKey answer; the shapes come from rc.10's source).

## Rollback

Revert the branch's commits; drop table `wiskey_access_review_decisions` (or leave it: nothing else reads it). The deep links fall back to
the panel tools once the `native` entries are removed.
