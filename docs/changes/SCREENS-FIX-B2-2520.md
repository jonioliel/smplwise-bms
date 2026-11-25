# SCREENS-FIX-B2-2520 - follow-ups of SCREENS-FIX-B-2520 (2.52 if ready before the gate, else 2.53)

Source: the open questions 1 and 2 of `docs/changes/SCREENS-FIX-B-2520.md` (both answered with the recommendation) and finding SCR-40 of
`docs/review/DEEP-REVIEW-2520-FRONTEND-SCREENS.md` (`review/DEEP-2520-FRONTEND-SCREENS`, aa0a3b4aa). Base: `origin/pilot/SCREENS-FIX-B-2520`
(1226df73d). Branch `pilot/SCREENS-FIX-B2-2520`.

## 1. SCR-40 - public handler page: a draft belongs to the link it was written for

Why: the page kept ONE draft per browser tab (`sessionStorage` `arx.t.draft`), not per link. A send pressed offline on link A (queued by
SCR-05) showed on link B opened later in the same tab - A's note and status chip preselected, "waiting to send" - and the next `online`
event posted it to B.

What:
- `state.ts`: the draft carries `link`, a fingerprint of its token (`linkId`: two 32-bit FNV-style hashes in base 36; the token itself
  stays only under its own key). `draftFor(draft, link)` returns the draft when it was written for `link`, else an empty draft of
  `link`. `resendOnReconnect(draft, link)` is true only for a queued send of the link open now. `parseDraft` keeps a well-formed `link`
  only; a draft without one (stored by an older version) is no link's draft.
- `main.ts`:
  - every link change goes through `setToken`, which re-reads the tab's draft through `draftFor` (the boot no longer reads the draft
    on its own);
  - `saveDraft` stores the draft with the current link (no link open: nothing is stored);
  - `send()` plans only this link's draft and stops (nothing more goes out) if another link took the tab while a call was out;
  - the `online` handler, the "waiting to send" line and the offline banner read `queued()` = `resendOnReconnect(draft, linkId(token))`;
  - `forget()` drops only this link's own stored draft.
- Another link's draft is IGNORED, not deleted: back on link A (before anything was written on B) A's queued send is shown again and
  goes out to A, with the request id of the original press (the server replays it if it already arrived). Writing anything on B
  replaces it (the tab keeps one draft) - see open question 1.
- No visible change on a single link; no new strings, no CSS. Public bundle: see "Runs".

Files: `frontend/src/public-ticket/{state.ts,main.ts}`.

## 2. Home: a pending booking request with no booking row can be withdrawn

Why: the home "my bookings" list shows a pending request from `GET /me/calendar` `pending` when no occurrence row of it is in the list.
That item had no revision, so the withdrawal posted `{}` and the server answered 409 "stale" every time.

What:
- Backend (additive, ADR-015): every `pending` item of `GET /me/calendar` carries the request's `revision` (`routers/calendar.py`
  `my_calendar`; `wire/calendar.py` `CalPending.revision: int`). Permissions, audit and the withdraw route are unchanged; the server
  still refuses a missing or old revision.
- Frontend: `frontend/src/api/generated/wire-calendar.ts` regenerated shape (`CalPending.revision: number`; `gen_wire_types.py --check`
  exit 0). `home-p2-api.ts`: `PendingRequest` type; `cancelEvent` / `cancelBody` take the revision as the server sends it (a number - the
  server compares it with `!=`, so a string would be "stale" too). `home-calendar.ts`: the trash of a pending row sends the pending
  item's revision. An older server without the field: nothing is sent, as before.

Files: `smplwise_vms/backend/smplwise/{routers/calendar.py,wire/calendar.py}`, `frontend/src/api/generated/wire-calendar.ts`,
`frontend/src/home/{home-p2-api.ts,home-calendar.ts}`.

## Tests

New or extended:
- `frontend/tests/unit-public-ticket.spec.ts` - new SCR-40 case (fingerprint; A's queued draft is not B's, never sent on B or with no
  link; back on A it is A's; a legacy or forged `link` is no link's; edits keep the link; the page wiring of `setToken`, `saveDraft` and
  `send`). The SCR-05 case follows the new `resendOnReconnect(draft, link)` signature.
- `frontend/tests/evidence-public-ticket.spec.ts` - SCR-40 browser case on the built bundle: A pressed offline -> B opened in the same
  tab shows no note, no chip, no waiting line, and `online` posts nothing; back on A the queued send goes out with A's token and the
  press's request id; nothing was ever posted with B's token. Writes `public-scr40-link-b-he-{desktop,mobile}-light.png`.
- `frontend/tests/unit-screens-fix-b2-2520.spec.ts` (new) - `cancelBody` with a numeric revision; the home wiring; the generated type.
- `frontend/tests/home-v3-p2.spec.ts` + `home-v3-p2-mocks.ts` (the pending item carries `revision: 4`) - browser case: the pending
  row's withdrawal posts `{ revision: 4 }`.
- `smplwise_vms/backend/tests/test_screens_fix_b2_2520.py` (new, 3 tests) - the pending item carries the request's current revision
  (an int; every earlier key still there); `{}` is still 409 "stale"; the item's revision withdraws it; after a change of the request the
  re-read item carries the new revision; the wire model declares it.

## Runs

PC (Windows, one file): `pytest tests/test_screens_fix_b2_2520.py` - 3 passed, exit 0; the same file with the two backend source files
stashed - 3 failed (`KeyError: 'revision'`), as expected. `gen_wire_types.py --check` exit 0; `ruff check` on the three Python files clean.

Runner (Linux, slot B, job `~/work/p2520_scrfixb2_run.sh` at 86b3f0fee; base for fails-before `origin/pilot/SCREENS-FIX-B-2520` 1226df73d):

| Check | Command | Result |
|---|---|---|
| Backend | `pytest` one process per file: test_screens_fix_b2_2520, test_calendar_engine_2300, test_home_v3_p2, test_wire_calendar_2470, test_wire_consumption_2450, test_wire_ratchet_2480, test_wire_route_coverage_2460, test_wire_routers_e_2480 | 3 + 45 + 42 + 3 + 13 + 7 + 5 + 95 passed, 0 failed, every file exit 0 |
| Wire types | `python scripts/gen_wire_types.py --check` | exit 0 |
| Ruff | `ruff check` (3 changed Python files) | exit 0 |
| App types | `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| Test types | `npx tsc --noEmit -p tsconfig.tests.json` | exit 0 |
| Lint (changed files) | `npx eslint --pass-on-unpruned-suppressions <changed files>` | exit 0 |
| Design ratchet | `python3 scripts/design_ratchet.py` | exit 0 |
| Builds | `npx vite build`; `npm run build:public:addon` | exit 0 (public-ticket chunk 60.23 kB raw, 20.13 kB gzip; was 19.87 kB gzip) |
| Unit | `playwright -c playwright.unit.config.ts` unit-public-ticket, unit-screens-fix-b2-2520, unit-screens-fix-b-2520, unit-i18n-home | 40 passed, 1 failed - the SCR-05 wiring check read a 300-character window that the new comment pushed the call out of (a test fault, widened to 500 in 44860110e); see the rerun |
| Public page | `evidence-public-ticket.spec.ts --project=desktop --project=mobile` | 16 passed, exit 0 (incl. the new SCR-40 case on both) |
| Home | `home-v3-p2.spec.ts --project=desktop --project=mobile` | 17 passed, 17 skipped (the spec's own phone skips), exit 0 |

Fails before (the branch's new browser cases on the base build):
- SCR-40 `evidence-public-ticket.spec.ts -g SCR-40` (desktop + mobile): 2 failed, exit 1 - link B showed A's "waiting to send" line
  (`[data-queued]` count 1, expected 0), as expected.
- Home `home-v3-p2.spec.ts -g SCREENS-FIX-B2`: 1 failed, exit 1 - the withdrawal body was `{}` (expected `{ revision: 4 }`), as expected.

After the test fix (44860110e), PC (Windows, unit only - the runner queue was full, the queued rerun was cancelled):
`npx playwright test -c playwright.unit.config.ts tests/unit-public-ticket.spec.ts tests/unit-screens-fix-b2-2520.spec.ts --workers=1` -
32 passed, exit 0. The bundle budget case in that file reads the committed/PC build; on the runner's fresh build it passed in the first
job (part of the 40 passed). The public-page browser spec was not re-run after 44860110e (that commit only drops the dark picture loop
of the SCR-40 case and widens a source-text window; NOT_RUN for that exact head).

Pixel: no screen's look changed (behaviour only; no CSS, no strings), so no Linux baseline refresh; the touched specs' screens are the
same. Before/after pictures of link B after a queued send on link A (desktop + phone): `private/planning/screens_fix_b2_2520_compare_2026-11-25.html`
(local). Light only: the page takes light / dark from the server's setting, not from the browser, so an emulated dark gave the same picture.

NOT_RUN: the full gate; pixel suites (no visual change); a live check in the lab (not allowed for this row).

## Open questions

1. A tab keeps ONE draft: opening link B ignores A's draft, and the first thing written on B replaces it (A's queued send is then lost,
   never misrouted). a) keep one draft per tab with the link check (recommended - the simplest safe rule; two links worked in one tab
   at once is rare); b) keep a draft per link in the tab (a small map, several drafts).
2. Noticed, not changed: the code session (`arx.t.session`) is also one per tab and is sent with whichever link the tab opens. The
   server checks it against the link, so this is no leak, but a session of link A is offered with link B. a) a follow-up that keys
   the session by `linkId` as well (recommended); b) leave.
