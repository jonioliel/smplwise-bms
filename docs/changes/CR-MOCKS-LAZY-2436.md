# CR-MOCKS-LAZY-2436 - demo stores load on demand

Branch `pilot/CR-MOCKS-LAZY-2436`, cut from `origin/main` @ 665ec8f24. Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.2, wave 1 frontend. Findings: review 07:F2 (demo mocks compiled into
production), review 08:F02 (the `rememberDemoContact` and `electricity/fixtures` imports).

## What changed

- New `frontend/src/api/demo-load.ts`: `lazy()` (one dynamic import, shared, retried after a failed chunk request, `loaded` once it
  arrived) and `lazyAdapter<T>()` (an adapter whose promise-returning methods forward to the store `load` resolves to, resolved again
  on every call so a reset store answers; synchronous and optional members are supplied verbatim and checked by the type
  `SyncPart<T>`; `then`, `toJSON` and other generic probes never load the store).
- The row's selectors are now `isApi() ? rest : <lazy demo>`; with a backend no demo module is fetched:
  - `api/tickets.ts`: `ticketsApi()`'s demo side; new `ticketsMock()` and `withTicketsMock()` - the slice modules that add to the demo
    store (`extendMockView`, the slice-4 staff directory) register there, and the store's first answer waits for every part registered
    by then. `photoUrl` (synchronous) keeps the demo's own rule (`att.url`).
  - `tickets-delete.ts` (the `can.delete` view extension, the demo removal), `tickets-conversation.ts` (`demoMessage`),
    `tickets-s4.ts` (the slice-4 mock loads with the tickets store, as it did when it was imported with it), `tickets-quotes.ts`.
  - `tickets-rfq.ts`: lazy demo adapter; `attachmentUrl` (synchronous) reads the loaded store and answers `''` before it arrived (the
    demo has a file only after an awaited upload, so that is the store's own answer); the eight optional members the demo store lacks
    stay `undefined`. New `rememberDemoContact()` here (demo only), queued on the store's load ahead of the sheet's next call -
    `tickets/rfq-board.ts` and `tickets/rfq-new.ts` import it from the API module instead of the mock (08:F02).
  - `media-players.ts`, `media-screens.ts` (`players()`, `media()`), `media-admin.ts` (the demo admin awaits the players mock).
  - `schedules.ts` (every demo call), `device-activity.ts`, `mapping.ts` (the demo site builds from `mapping-demo.ts` on first use),
    `electricity-meters.ts` (the demo adapter runs behind `lazyAdapter` once `electricity/fixtures.ts` arrived).
- Type-only imports of mock types stay.

## Entry chunk (`npm run build`, `dist/assets/index-*.js`, this workstation)

| | raw bytes | gzip (zlib level 9) |
|---|---:|---:|
| before (origin/main 665ec8f24) | 4,074,343 | 1,156,939 |
| after | 3,940,015 | 1,113,949 |
| saved | 134,328 | 42,990 |

Demo modules in the entry's source map, before: `tickets-mock`, `tickets-s4-mock`, `tickets-rfq-mock`, `tickets-costs-mock`,
`media-players-mock`, `media-screens-mock`, `schedules-mock`, `device-activity-mock`, `mapping-demo`, `electricity/fixtures` (plus
`home-demo`, `home-site-demo`, `automations-demo`, outside this row). After: only `tickets-costs-mock` and `schedules-mock` of the
row's stores (and the three outside the row).

## Not done here (recorded, not resolved)

- `schedules-mock` stays in the entry: `screens/schedule-editor.ts` (in the entry), `devices-schedules.ts`, `schedule-drawer.ts` import
  `DEMO_SUN` from it and `system-schedules.ts` imports `demoStore`. Those screens are not in this row (`schedule-editor.ts` and
  `devices-schedules.ts` belong to `CR-EDITORS-MEMO-2436`). `schedules.ts` is converted, so the store leaves the entry once those
  imports move (for example `DEMO_SUN` into a small module).
- `tickets-costs-mock` stays in the entry: `api/tickets-costs.ts` imports it statically, and its demo has synchronous parts
  (`CostsBackend.pageUrl` reads mock state; see the `CR-API-BLOB-2436` note). `tickets-costs.ts` and `electricity-billing.ts`
  (`logoUrl`, `MOCK_TODAY`) are not in this row and were not touched. `tickets-quotes.ts` already loads it lazily.
- `tickets-table.ts` still imports `./tickets-mock` statically on main; `CR-API-BLOB-2436` converts it (not merged yet). It is not in
  the entry, so it does not change the numbers above.
- The deny-list entry in `tests/unit-entry-chunk.spec.ts` / `scripts/bundle-budget.mjs` belongs to `CR-FE-GATES-2436`, which is not
  merged; this branch carries its own gate instead (`tests/unit-mocks-lazy.spec.ts`, the entry source-map check). The FE-GATES
  report already lists every `*-mock` module of the entry.
- `media-players.ts` and `media-screens.ts` carry a "coordinator-owned contract" header; the change is in the selector only (no
  contract shape changed), as the plan row assigns.

## Behaviour

- With a backend: identical; no demo module is fetched.
- Without one (static preview, design review, demo specs): the first demo call of each store waits for one extra chunk; the answers,
  the order of answers and the store state are the same. A demo method that used to throw synchronously now rejects (every caller
  awaits). The tickets demo store's seed is taken when it loads (first demo call), not at page start - relative times move by the
  load delay only.
- `rememberDemoContact` is no longer called with a backend (it filled a map only the demo store reads).
- `tests/unit-media-players.spec.ts`: "the adapter in force is the mock" compared object identity (`players() === playersMock()`);
  it now checks that the demo adapter answers from the store in force (`list()` equal after a reset) - the identity was the
  implementation, not the contract.

## Tests

New `frontend/tests/unit-mocks-lazy.spec.ts` (written alongside the conversion, not strictly first; the entry check was run red
against the `origin/main` build first - it listed the row's mock modules - and green after the rebuild):

- the 15 row files have no value import of a `*-mock`, `mapping-demo` or `electricity/fixtures` module;
- the built entry's source map carries none of the eight modules this row makes lazy (skipped without a build);
- `lazy` / `lazyAdapter` contract (one load, shared, retry, store in force, sync and optional members, not a thenable, no load on
  `JSON.stringify` / `String`);
- tickets demo through the lazy adapter: the delete right and the outside-contact `link` are on the first answer; a part registered
  after the load applies before the next answer; rfq optional members absent and `attachmentUrl` empty before any upload.

## Results

All on this workstation, `--project=desktop --workers=1`, against this branch's own `npm run build` (preview on port 4436) unless noted.

- `npx tsc --noEmit`: clean. `npm run build`: clean.
- Named specs and units (17 files): `perf-home-load.spec.ts`, `unit-perf-home-devices.spec.ts`, `unit-mocks-lazy.spec.ts`,
  `unit-media-players`, `unit-media-admin-list`, `unit-media-screens`, `unit-media-queue`, `unit-media-player-panel`,
  `unit-media-import-order`, `unit-device-activity`, `unit-mapping-assist-2330`, `unit-mapping-improve-2351`,
  `unit-schedules-followup`, `unit-rfq-attachments`, `unit-rfq-questions`, `unit-public-rfq`, `unit-tickets-3b`:
  **265 passed, 0 failed**.
- Demo-mode evidence sample (20 files): `evidence-tickets`, `-tickets-s4`, `-tickets-delete`, `-tickets-conversation`,
  `-tickets-costs`, `-tickets-rfq2`, `-tickets-rfq-code`, `-tickets-device`, `-tickets-create-assign`, `-tickets-table`,
  `-tickets-drawer`, `evidence-media-admin-list`, `-media-player-panel`, `-media-queue`, `-media-polish`,
  `evidence-schedules-editor`, `evidence-device-activity`, `evidence-electricity-meters`, `evidence-mapping-assist-2330`,
  `layout-tickets-s4`: on the preview **159 passed, 4 skipped (the specs' own skips), 2 failed + 50 not run** - the two failures are
  `evidence-media-player-panel` and `evidence-media-queue`, which by their own header run only on the Vite dev server (they
  `import('/src/api/...-mock.ts')` in the page); the 50 are their serial followers. Those two files on the dev server
  (`npx vite --port 4537`): **52 passed, 0 failed** - this also shows the page's import of the mock and the app's lazy import share
  one store.
- Not run: pixel specs (baselines are the runner's), the tablet and mobile projects, the runner entry check (not queued, as
  instructed).

## Rollback

Revert the commit. No data, settings or wire contract change.
