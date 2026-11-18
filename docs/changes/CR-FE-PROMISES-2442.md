# CR-FE-PROMISES-2442 - the 27 baselined ESLint reports are fixed (review wave 3B, step FE-7)

Branch: `pilot/CR-FE-PROMISES-2442`. Base: `origin/pilot/CR-FE-GATES-ENFORCE-2442` (`5825283c4`, step FE-6; it contains
`origin/main` 2.43.7 `cc69447f1`). Follow-up of lead decision 6 in `docs/changes/CR-FE-GATES-ENFORCE-2442.md`.

FE-6 made ESLint blocking and counted the 27 reports that existed (14 `no-misused-promises`, 12 `no-floating-promises`,
1 `lit/attribute-value-entities`) in `frontend/eslint-suppressions.json`. Every one is fixed here and **the suppression file is
empty (`{}`)**: from this branch on, any report of the three rule groups fails `npm run lint`.

No success path is changed, no text, no style, no pixel, no PNG. No backend file. No dependency.

## The rule applied

- A promise that can reject for a reason the user should know about gets a handler that shows it the way that screen already
  shows a failure (its error line / notice / fallback).
- A promise whose own function already catches everything is started with `void` (or a plain wrapper), and the function's
  comment says it never rejects and where the failure is shown.
- A promise whose failure is harmless (a scroll or a focus after a render) is started with `void` and a comment that says why.
- An `async` function given to a timer or a DOM listener (which ignore the returned promise) became a plain function; the
  async work inside ends in `.catch(...)` that leads to the same state the old inner `catch` led to - and now also covers the
  lines that were outside the old `try`.

## Per report (file under `frontend/src/`; what the user sees when it fails)

| # | File : line (before) | Rule | Fix | The user on failure |
|---|---|---|---|---|
| 1-5 | `shell/sw-home-personal.ts` :237 :341 :345 :366 :380 (`setScreen`, `setDirection`, `setPhoneLayout`, `setWidget`, `move`) | floating | `void this.commit(...)`; `commit()` documented as never rejecting | Unchanged and already visible: the choice goes back to what it was and the reason (`describeError`) is the red note under the list (`data-home-personal-error`, `role="alert"`). Nothing was lost before either - `commit()` catches everything - so this is a statement of intent, not a behaviour change. |
| 6-7 | `components/sw-live-player.ts` :920 :922 (`ws.onopen` -> `startWebrtc()`) | floating | `startWebrtc().catch(...)` -> `webrtcFailed('WebRTC לא נתמך בדפדפן')`, only while the connection is still the current one (`gen === this.generation`) | **New visible path.** `startWebrtc()` catches the failures it expects (no `RTCPeerConnection`, a refused offer). Anything else it threw (`addTransceiver`, the first-frame watch) vanished, and the tile stayed on "מתחבר…" until the connecting cap. Now the WebRTC attempt ends the usual way at once: the next step of the plan / chain, MSE in `auto`, otherwise the player's error with its retry. |
| 8 | `components/wk-door-tech.ts` :454 (`ask`) | floating | `void` + reason | Nothing: only the scroll to the confirmation box and the focus of its button; the confirmation is rendered either way. |
| 9-10 | `screens/automation-editor-base.ts` :1342 :1355 (`chooseType`, `goto`) | floating | `void` + reason | Nothing: only the smooth scroll to the block; the block is added / opened either way. |
| 11 | `maintenance/round-run.ts` :209 (`finish`) | floating | `void` + reason | Nothing: only the scroll to the first missing point; "missing required" is already shown. |
| 12 | `public-ticket/rfq/rfq-page.ts` :401 (lazy `rfq-upload`) | floating | rejection handler (no-op, with the reason) | The vendor's page stays as it is **without the upload card**; the quote, questions and the request's files are unaffected; the next paint asks for the module again. Same rule as the page's terms module (`needTerms`). No words exist for "the upload part did not load" - see lead question 1. |
| 13-14 | `public-ticket/rfq/rfq-files.ts` :98 :110 (picture button, document button) | misused | both go through the new `openFile(get, use, onError)`, which never rejects | **New visible path.** A fetch that fails already showed the card's line "לא ניתן להוריד את הקובץ כרגע. נסו שוב." (`data-rfq-file-error`). A failure while opening the lightbox or handing the document to the save dialog vanished; it now shows the same line. |
| 15 | `access-external/identity-card.ts` :249 (push name) | misused | `() => void this.run(...)`; `run()` documented as never rejecting | Unchanged: the card's error line (`this.error`, `describeError`). |
| 16 | `calendars/view-calendar.ts` :1075 (series check timer) | misused | plain timer function; async work ends in `.catch` | No clash count is shown (as before for a failed request; now also when building the request body fails). The server checks every occurrence again on save. |
| 17 | `electricity/elec-bill-page.ts` :104 (`issue` -> first PDF) | misused | plain callback, `void this.pdf('check')` | Unchanged: `pdf()` catches everything and shows the page's PDF note (`pdfFail`); the bill stays issued. |
| 18 | `notice-tv/main.ts` :1487 | misused (a promise as a condition) | `document.fonts.ready !== undefined` | Not a failure path. Same branch as before: a board browser without `fonts.ready` skips the refit. |
| 19 | `notices/compose-dialog.ts` :88 (audience count timer) | misused | plain timer function + `.catch` | Unchanged: no audience number (`audCount = null`). |
| 20 | `screens/explore-plan-editor.ts` :4287 (studio `retry`) | misused | plain function; `flush().then(...).catch(...)` | A save that fails again: unchanged (the studio's own "not saved" state). **New:** a fault outside the save is the editor's error line (`this.error = describeError`). |
| 21 | `screens/explore-sites.ts` :401 (photo upload) | misused | plain listener; `.catch` / `.finally` | Unchanged: the screen's notice line carries the reason; the busy state ends. |
| 22 | `screens/investigate-event-detail.ts` :698 (thumbnail poll timer) | misused | plain timer function + `.catch` | A failed poll already read as "no picture". **New:** a fault after the poll also ends in the "no picture" placeholder instead of staying on "preparing" for ever. |
| 23 | `screens/wiskey-access-diag.ts` :597 (picker search timer) | misused | plain timer function + `.catch` | Unchanged: the picker's "no matches" line. |
| 24 | `screens/wiskey-people.ts` :636 (delete follow-up timer) | misused | plain timer function + `.catch` | A check that answers an error: unchanged (checked again, then "still pending"). **New:** a fault in the check itself shows "still pending" - never read as deleted. |
| 25 | `temperature/report.ts` :172 (preview timer) | misused | plain timer function + `.catch` | Unchanged: the dialog's error line (`describeError`). |
| 26 | `temperature/whatsapp.ts` :169 (send status interval) | misused | plain interval function + `.catch` | Unchanged: the follow-up stops; the list keeps the last statuses shown. |
| 27 | `screens/system-diagnostics.ts` :1716 | lit/attribute-value-entities | `<` `>` in the card's `subheading` attribute written as `&lt;` `&gt;` | Not a failure path. The text shown is the same (`https://<שם ה־Home Assistant>/arx`): the HTML parser decodes the entities of a static attribute. |

Not touched although next to a report: `sw-home-personal.ts` `connectedCallback` (`void Promise.all([...]).then(...)` has no
rejection handler: when the first read fails the section stays empty). ESLint does not report it (`void`), it is a change of what
the user sees on a failed *load*, and it needs a decision - lead question 2.

## Files

- 20 source files under `frontend/src/` (the table).
- `frontend/eslint-suppressions.json` - `{}`.
- `frontend/tests/unit-fe-promises-2442.spec.ts` (new, node only, 12 cases).
- `frontend/tests/evidence-fe-promises-2442.spec.ts` (new, a page spec of the camera player, 2 cases, no screenshot).
- `docs/changes/CR-FE-PROMISES-2442.md`.

## Tests actually run (this workstation, final tree)

1. **`npm ci`** in this worktree's `frontend/` (its own `node_modules`, no junction): exit 0.
2. **The 20 files without any suppression** (`eslint <files> --suppressions-location <empty file>`): before the change 27 reports
   (the table's lines), exit 1; after it 0 reports, exit 0.
3. **`npm run lint`** (whole `src/`, `eslint-suppressions.json` = `{}`): **exit 0, no report** (372 s).
4. **`npx tsc --noEmit`** (project config, includes the two new specs): **exit 0, no output**.
5. **`npx vite build`**: exit 0 (2 min 14 s). **`npm run gate:budget`** on `dist`: entry `assets/index-CQ4BQVQG.js` raw 2,952,383 B,
   gzip 856,583 B - within the budget (883,000 / 3,041,000; +92 B raw, +26 B gzip against FE-6), 0 mock modules, **exit 0**.
   **`npm run gate:unused-exports`**: 12806 exported declarations (one more: `openFile`, used by its spec), 59 unreferenced,
   55 file-local, nothing outside the baseline, **exit 0**.
6. **New unit spec** `tests/unit-fe-promises-2442.spec.ts` (node only): **12 passed**. It runs `openFile` (a file handed on; no
   file; a throw while showing / saving; a rejected fetch - each ends in the card's line, the click never rejects) and pins the
   wiring by source: the empty suppression file, `startWebrtc()` never without its handler, the 5 `void this.commit(` and the
   error note of the personal screen, no `async` timer / listener in the 8 screens, the entities of the diagnostics card.
   With it `tests/unit-rfq-attachments.spec.ts`: 8 passed.
7. **New page spec** `tests/evidence-fe-promises-2442.spec.ts` (demo mode, fake WebSocket, an `RTCPeerConnection` whose
   `addTransceiver` throws; writes no screenshot): **2 passed** on the build (preview, port 4357) and on the Vite dev server
   (port 4358). **With the player fix reverted** (dev server, `git checkout` of the one file, then the patch re-applied):
   **2 failed** - the `webrtc` tile stays on "connecting", the `auto` tile opens no second socket.
8. **Full node-only unit run** (`npx playwright test -c playwright.unit.config.ts tests/unit- --workers=2`, `dist` built):
   **4691 passed, 6 failed, 8 skipped** (15.0 min). FE-6 had 4679 passed; the 12 more are the new spec. The 6 failures are the
   known base failures of the chain: 5 x `unit-session-me-failure-2435` (`:44`, `:76`, `:101`, `:110`, `:121`; a page spec the
   node-only config starts without a server) and `unit-presence-compact-2310:36`. The PNGs the run rewrote were restored.
9. **Desktop evidence specs of the touched screens** (`--project=desktop --workers=1`, demo mode, `SW_BASE_URL` on private
   ports; every PNG the runs wrote or changed was restored / removed - none is committed):
   - preview of the build, port 4357 - `evidence-event-detail`, `evidence-sharedid-293` (identity card), `evidence-wiskey-door-tech`,
     `evidence-maintenance`, `evidence-notice-tv`, `evidence-automations-builder`, `evidence-wiskey-access-diag`,
     `evidence-temperature`, `evidence-calendars-grid-edit-2343`, `evidence-wiskey-editor`, `evidence-board-mgmt-2381`
     (notice compose), `evidence-access-polish-2331` (remote access card), `evidence-media-polish-electricity`:
     **162 passed, 14 skipped, 1 failed**. The failure is `evidence-media-polish-electricity:51` waiting for `[data-harness]`:
     the electricity harness page is served only by the Vite DEV server (the spec files say so), not by a preview - see the next line;
   - Vite dev server, port 4358 - `electricity-bills`, `evidence-media-polish-electricity`, `evidence-electricity-ui-bills`:
     **49 passed** (the spec that failed above included);
   - preview, port 4357 - `evidence-area-row`, `evidence-go2rtc-stream-sync-2436`, `evidence-health-go2rtc-2430` (the camera
     player with a fake socket): **6 passed**; `evidence-home-screen`: 30 skipped (it needs the devices fixture backend,
     `SW_LIVE=1 SW_DEVICES_FIXTURE=1`); `evidence-camera-card`: 1 failed with `ECONNREFUSED 127.0.0.1:8100` (it needs the fixture
     backend's control port), 7 did not run - BLOCKED here, not a product failure;
   - `evidence-public-rfq` (`playwright.public.config.ts`, the vendor page with its files card): **11 passed**;
     `evidence-public-rfq-upload` (main config; the upload module's lazy load): **4 passed**.

## NOT_RUN / BLOCKED

- **Runner entry check, pixel run**: not queued, the runner was not used (instruction for this step).
- **`evidence-home-screen` (30 tests, among them the personal screen "החשבון שלי › המסך שלי") and `evidence-camera-card`**:
  BLOCKED on this workstation - they need the devices fixture backend. The personal screen's change is `void` in front of five
  calls and a comment; its failure note is checked by source in the unit spec only, not in a browser.
- **A failed save of the personal screen in a browser, the RFQ card's line after a lightbox / save fault in a browser, a failed
  `rfq-upload` chunk, the studio `retry` fault, the delete follow-up fault, the thumbnail poll fault**: NOT_RUN as page tests
  (`openFile` is run in node; the rest are the same state the old inner `catch` set, reached through `.catch`).
- **Tablet and phone projects, the full evidence / layout suites, backend tests**: NOT_RUN (no layout or backend change).
- **`build:public` / `build:addon`**: not run as commands (the public RFQ spec builds the public bundle itself and passed);
  `smplwise_vms/www` is not rebuilt here.
- **The negative proof of the unit spec**: only the page spec was run against the reverted fix.

## Lead questions

1. **The vendor's RFQ page when the upload module does not load** (`rfq-page.ts`): today and after this branch the upload card is
   simply absent until the next paint. A line such as "the file upload did not load - refresh" needs new words in the four
   languages of the public page. a) leave as is (recommended: the quote itself is unaffected); b) add the line in a follow-up.
2. **The personal screen when its first read fails** (`sw-home-personal.ts` `connectedCallback`): the section stays empty, with
   no message. ESLint does not report it (it is `void`ed). a) show the section's error note with the reason (recommended, a small
   follow-up with a page test on the runner); b) leave.
