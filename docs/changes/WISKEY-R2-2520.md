# WISKEY-R2-2520 - WisKey system status page UI ("מערכת האינטרקום"), row R2 of WISKEY-RESYNC-2520

Branch `pilot/WISKEY-R2-2520`, cut from `origin/pilot/WISKEY-RESYNC-2520` (`a7eb3159a`, row R1). Target version: 2.52.
Plan: `docs/changes/WISKEY-RESYNC-2520.md` section 6, row R2 (master ids D1-D5, B3; B6 "null counts shown as unknown").
Nothing was installed, nothing touched the lab, no message went to WisKey.

## 1. What

A new segment **"מערכת האינטרקום" / "Intercom system"** of the Settings page "בקרת כניסה" (`#/system/access-control/wiskey`), built only on
R1's two reads:

| card | source | what it shows | what it never shows |
|---|---|---|---|
| scope note | `system/status_v1` | "a snapshot of WisKey's memory: no device was asked, no physical result measured", when WisKey generated it | - |
| tiles | D1 / D2 / D3 | WisKey version + API contract, profile, stations `connected` of the stations reported (+ how many are in an unknown state), write permission "per command" | a station whose connection WisKey did not state as connected; "writes open" |
| per-station table | D2 | connection, last authentication, last failure (reason in words + `HTTP / ISAPI / sub-status` as written), firmware, sync state + last reconciliation, sync request (waiting / running / last result + "effect not proven"), "not loaded" | a sync result as a proof of effect; a request id as a log (note under the table) |
| jobs by kind | D4 | one row per contract family (`checkpoint`, `schedules`, `maintenance`, `templates`); counts as reported, a null count = "unknown", a real 0 stays 0; a family WisKey did not report = "not reported: the component is not loaded" | a missing family as zero; a total across families; "running" as a live worker (note) |
| writes and schedules | D3 / D5 | "no global permission: every command is checked on its own"; the legacy schedule writer OFF with WisKey's reason; the reviewed execution contract with its reason; physical acceptance "not measured" | a global "writes enabled"; legacy schedules as open |
| message templates | D5 | installation state, configured accounts / templates (null = unknown), WisKey's reason codes, send admission; note "installation state is not a send permission" | an assumed template count |
| checkpoint jobs | B3 | every retained job: short id (full id in the title), kind, state, rows saved / failed / waiting / total (each unknown when absent), error count, approval state + action + expiry, last update; note "history not complete" | a job count invented from nothing; WisKey's refusal hidden behind another read |

States, each said as itself (`access-control/status-wiskey-logic.ts` `readPanel`):

| server answer | panel |
|---|---|
| `unsupported` / `not_listed` (the lab's rc10), `wiskey_unknown_command` | "The installed WisKey does not offer this information" + "the read is not in WisKey's command list. Nothing was sent." - no retry |
| `unsupported` / `no_copy`, `commands_unknown`, `api_incompatible` | the same heading, its own reason sentence |
| `forbidden` / `wiskey_refused` | "WisKey refused the read" + (jobs) "WisKey shows the job list to its owner only. No other way was tried." / (system) "Arx's service account may not see all of WisKey..." + `Code: unauthorized` - no retry |
| `error` / `contract_mismatch` | "WisKey answered outside its contract" + "the whole answer was refused and none of it is shown" |
| `error` / `jobs_unavailable` | "WisKey's job component is not loaded" + "that does not mean there are no jobs" |
| `unavailable` (connecting, not configured, not installed, other) | the page's existing sentences; "WisKey did not answer. No earlier data is shown." |
| `busy` | the page's existing "busy" panel |
| any other state / code | "the data could not be loaded" + the code as written |
| Arx's own HTTP 403 (a station-scoped administrator) | the page's existing "administrators of every station only" panel (never WisKey's refusal) |

Loading rules: the two reads (plus the status segment's own `status/stations`, for the stations' names and the installation's zone) run
when the segment opens and when the page's refresh is pressed - **never on a timer** (each is a WisKey command). Every HTTP 200 replaces
what is shown, so a later WisKey refusal / unavailability is never covered by an earlier copy; only a failure of Arx's own request (403,
429, 5xx, network) keeps the last answer, marked "not current" (the page's existing stale note).

Permission: the segment is offered only to an installation-wide holder of `access.admin.read` (`can()`, the same gate as the intercom log;
the server additionally requires it unrestricted). A station-scoped administrator has no tab; a typed address opens the status segment and
neither read is sent.

## 2. Why

WisKey's 24.11 reply delivered `system/status_v1` (D1-D5) and `jobs/status_v1` (B3); R1 added the reads; R2 makes them visible to the
administrator with the contract's own honesty rules (unknown / missing / not measured / refused stay visible as such).

## 3. Files

| file | change |
|---|---|
| `frontend/src/api/wiskey-system-status.ts` | new: the two typed GETs; the closed projection's shapes (the generated wire type keeps `data` open) |
| `frontend/src/access-control/status-wiskey-logic.ts` | new: pure logic (no DOM, no Hebrew) - `readPanel`, `systemView`, `jobsView`, `familyRows`, `tiles`, badge kinds, closed-set words |
| `frontend/src/screens/system-access-wiskey.ts` | new: the segment element `system-access-wiskey` (existing components only: sw-card, sw-table with phone card marks, sw-badge, sw-state-panel; the status page's shared CSS; tokens only) |
| `frontend/src/screens/system-access-control.ts` | the segment `wiskey` (after the intercom log, `wide` callers only) |
| `frontend/src/i18n/access-status.ts`, `frontend/src/i18n/lang/en/i18n/access-status.ts` | `segWiskey` + `wk*` strings, Hebrew and English (137 each) |
| `frontend/tests/unit-access-wiskey-status-2520.spec.ts` | new: node unit spec of the logic + every shown key exists in he and en |
| `frontend/tests/evidence-access-wiskey-status-2520.spec.ts` | new: behaviour against the mocked backend |
| `frontend/tests/pixel-access-wiskey-status-2520.spec.ts` (+ 10 Linux baselines) | new: ready in classic + domus, and in classic the rc10 state, WisKey's refusal of the jobs read and the empty answer; desktop 1440 / phone 390 |
| `frontend/tests/wiskey-system-status-mock.ts` | new: the two routes' mock (installed after `access-control-mocks.ts`; the shared mock is unchanged) |
| `frontend/tests/evidence-access-status.spec.ts` | segment counts 5 -> 6 (admin), 3 -> 4 (site manager) |
| 32 existing Linux baselines of `pixel-access-status`, `pixel-access-s12`, `pixel-wiskey-messaging` | refreshed on the runner: the page's tab bar has one more tab (diff images checked - only the tab bar changes; on the phone the tab strip scrolls sideways, as before) |

Deviation from the plan's file list (recorded, not silently resolved): the plan named "`frontend/src/access-control/status-*.ts`" and
"status page section". The UI is a **segment of the same Settings page** in its own element, not a card appended to the status segment,
because (a) the two reads are WisKey commands and the status segment re-reads every minute, (b) appending would change the status
segment's content in its pixel baselines and its "exactly these reads" behaviour test (the segment changes only the tab bar of the
page's baselines), (c) the content (7 cards) would double the status segment's length. This needed one more file than listed: `frontend/src/screens/system-access-control.ts` (+3 lines) and the new
`frontend/src/screens/system-access-wiskey.ts`; no other row owns either. Open question 1.

No registry file of R1 was touched (`services/wiskey_channels.py`, routers, wire, generated TS unchanged). No backend change.

## 4. Tests (real results)

PC (one unit file, as the PC rule allows):

| command | exit | result |
|---|---|---|
| `npx playwright test -c playwright.unit.config.ts tests/unit-access-wiskey-status-2520.spec.ts` | 0 | 10 passed (a first run found a job error row 0 accepted - fixed to the server's 1-based bound) |

Runner, slot B (`~/work/slotb.sh`), final run at `77760cd66` (+ the new baselines committed after it, unchanged code):

| command | exit | result |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` / `-p tsconfig.tests.json` | 0 / 0 | 0 errors / 0 errors |
| `eslint` on the four changed `src` files (the test files are on ESLint's ignore list) | 0 | 0 problems |
| `python scripts/design_ratchet.py` | 0 | no count above the baseline (color-literal 1986, px-literal 25639, undefined-token 0, scroll-container 13 ...) |
| unit: `unit-access-wiskey-status-2520`, `unit-access-status-logic`, `unit-access-status-feed`, `unit-i18n-en-ratchet-2490`, `unit-i18n-lang-packs-2443` | 0 | 56 passed |
| `npx vite build` | 0 | built |
| `pixel-access-wiskey-status-2520.spec.ts --project=desktop --project=mobile --update-snapshots`, then the same without `-u` | 0 / 0 | 10 passed / 10 passed |
| `pixel-access-status`, `pixel-access-s12`, `pixel-wiskey-messaging` (desktop + mobile) against the refreshed baselines | 0 | 48 passed (before the refresh: 18 failed, 72-1097 px each, all in the tab bar) |
| evidence: `evidence-access-wiskey-status-2520`, `evidence-access-status`, `evidence-wiskey-messaging-settings` (desktop) | 0 | 56 passed, 1 skipped (the first run failed 1: the phone card line of `sw-table` doubled the badge count - the spec now counts visible badges) |
| `layout-access-status.spec.ts` (desktop + mobile) | 0 | 8 passed, 8 skipped (project split of the spec) |
| `prettier --check` | 1 | not a repo gate: no Prettier config, and unchanged files (`status-logic.ts`, `evidence-access-status.spec.ts`) fail the same check |

Compare page (Hebrew, desktop + phone, light + dark, made on the runner): `private/planning/wiskey_r2_status_compare_2026-11-24.html`
(images in `private/planning/wiskey_r2_compare_2026-11-24/`; not in git).

## 5. NOT_RUN

- Live WisKey / lab: NOT_RUN by rule (no lab access). The lab runs WisKey rc10, where both reads answer `unsupported` (`not_listed`) and
  send nothing - the rc10 panel is covered by the evidence and pixel specs against the mock only.
- Full frontend suite, a11y sweeps and the release gate: NOT_RUN (the train gate runs them). Tablet project: NOT_RUN (the pixel specs
  skip it by design).
- Backend: no backend change in this row; R1's backend tests were not re-run here.

## 6. Open questions

1. Where the WisKey status lives: a) its own segment "מערכת האינטרקום" of the same page (built; recommended) b) a card at the bottom of
   the status segment (re-read every minute, longer page, existing baselines change) c) both (a summary tile on the status segment linking
   to the segment).
2. Refresh: a) on open + the page's refresh button only (built; recommended - each read is a WisKey command) b) also every minute like the
   status segment.
3. Station names: a) Arx's own station names from `status/stations`, the WisKey id when Arx does not know the station (built;
   recommended) b) WisKey's ids only.
4. (From R6, via the lead) the WisKey visit status `ended` shows as "לא ידוע": its label lives in
   `frontend/src/access-external/wiskey-visits-logic.ts` `STATUS_TEXT` (type `VisitStatus` in `frontend/src/api/wiskey-visits.ts`, English
   through the shared `i18n/msg/misc` pack, test `frontend/tests/unit-wiskey-visits.spec.ts`) - outside R2's files, so NOT edited here; the
   backend `services/wiskey_visits.py` `STATUSES` (R6's file) also lacks `ended`, so a label alone would still read unknown. a) R6 adds
   `ended` end to end: backend set, type, label "הסתיים" / "Ended", unit test (recommended) b) R2 takes the three frontend files by a plan
   change c) a separate small row after R6.

