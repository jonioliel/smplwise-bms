# CR-API-BLOB-2436 - binary reads through the API client; one error model

Branch `pilot/CR-API-BLOB-2436` (from `origin/main` @ 665ec8f24, v2.43.4). Code review 2026-11-13, master plan section 3.2 (wave 1,
frontend). Frontend `src/api/` only; no backend file, no UI markup or CSS. Pixels: none expected.

## Findings covered

- **07:F5 - binary reads bypassed the client.** `api/client.ts` was the only place with the remote channel's 401
  refresh-and-retry; 18 raw `fetch` calls in `api/` skipped it and rebuilt the error body by hand (four `blobOf` copies).
- **07:F16 - client robustness.** A JSON error body that is not the error model (FastAPI's 422 `{detail}`) was cast to
  `ApiErrorBody`, so `code` / `details` were `undefined` and the message empty; the helpers took no `signal`; `api/events.ts` used
  `credentials: 'include'` where everything else uses `same-origin`.

## Change

- `src/api/client.ts`
  - `fetchApi` (internal): the one place a request leaves - same-origin credentials, the JSON content type for a non-form body,
    the 401 retry (once, only when a handler is set and answers true). `send` (JSON) is built on it, unchanged in behaviour.
  - `errorBody` (internal): the error body normalised field by field. A body with a string `code` is the server's model (missing
    fields filled - `''`, `false`, `''`, `{}` - extra keys kept); anything else (422 `{detail}`, a proxy HTML page, a JSON array or
    scalar, an empty body) is the existing fallback `{ code: 'http_<status>', user_message: <status text>, ... }`.
  - New `apiBlob(path, init?)` -> `{ blob, headers }` (throws `ApiError`), and `apiResponse(path, init?)` -> the raw `Response`
    (never throws on a status; for reads that branch on 202 / 404 / 503 themselves). Both accept an API-relative path or an
    absolute address built by `apiUrl`.
  - `get` / `post` / `patch` / `put` / `del` take an optional `{ signal }`. A GET with a signal is never shared (as before for any
    GET with options); without one the call is exactly as before.
- New `src/api/download.ts`: `saveBlob` and `dispositionName`, moved verbatim from `api/tickets-costs.ts` (which re-exports both
  for its existing importers, the demo store among them).
- The 18 raw calls now go through the client:
  - `apiBlob`: `access-events.ts` (`blobOf`, 2 callers), `tickets-table.ts` (`blobOf`, 2 callers), `temperature.ts` (2),
    `tickets-costs.ts` (`download`), `maintenance.ts`, `insights.ts`, `access-grants.ts`, `bulk-people.ts`, `intercom-ops.ts`,
    `electricity-billing.ts` (keeps its own `retryable` rule from `PDF_RETRYABLE`, `correlation_id: ''`, `details: {}`),
    `geometry.ts` (POST with its JSON body), `wiskey-validation.ts`.
  - `apiResponse` (status-branching reads): `frame-preview.ts` (`fetchFrameHttp`), `access-people.ts` (photo, `cache: 'no-store'`,
    a network error still answers `unavailable`), `events.ts` (`pollThumbnail`, `cache: 'no-store'`; `credentials` now
    `same-origin`), `brand.ts` (keeps `Error('pack <status>')` and now saves through `saveBlob`).
  - File-name parsing per call site is unchanged (each keeps its own regex and fallback name).
- Mock selector (plan row): `tickets-table.ts` no longer imports `./tickets-mock` statically; its demo backend loads it with
  `import()` on the first demo call (`page`, `bulk`). With a backend it is never loaded from this module.

## Behaviour

- Under Ingress (no unauthorized handler) every request is the same request as before: same address, method, body, credentials
  and cache mode. On the remote channel an expired cookie on a file read now recovers through the refresh, like a JSON call.
- Conforming error answers are unchanged. Malformed error answers (non-JSON or not the model) now carry the fallback body
  everywhere: sites that used `user_message: ''` for those (access-events, tickets-table, access-grants, bulk-people, intercom-ops,
  wiskey-validation, electricity-billing) now get the status text, as `api()` already did.
- `events.ts` thumbnail poll: `credentials: 'include'` -> `same-origin` (the address is same-origin, so the same cookies are sent).
- `brand.ts` pack download: the temporary link is now hidden, `rel=noopener`, revoked after 30 s instead of 2 s (the shared helper).

## Skipped / not done

- **Mock selector of `tickets-costs.ts` and `electricity-billing.ts` not converted.** The plan's assumption ("every adapter method
  already returns a promise") does not hold for these two: `CostsBackend.pageUrl` and `ElecBackend.logoUrl` are synchronous and
  read state inside the mock module, and `elecToday()` returns the mock's `MOCK_TODAY` synchronously. A lazy mock would need a
  preload or a changed interface (a behaviour risk on the demo screens and their pixel baselines). Left for `CR-MOCKS-LAZY` (or a
  follow-up) to decide; note that `tickets-costs-mock` is also statically imported by `tickets-mock.ts` and `tickets-quotes.ts`.
- `timeoutMs` on the helpers (07:F16) - not added; no caller in scope needs it.
- The two fixed Hebrew strings of `describeError` stay in `client.ts` (`i18n/he.ts` is held by AUDIT30), as the row says.
- The save-to-disk copies in `screens/wiskey-events-export.ts` and `screens/access-external.ts` (07:F5) are outside this row's file
  list; they can adopt `api/download.ts` later.

## Tests

All run locally on the workstation (Windows, Node 24.21.0), `frontend/`, node-only unit config. Fixture `fetch` stubs only; no
device, no lab, no runner.

- New `tests/unit-client-blob.spec.ts` (7) and `tests/unit-client.spec.ts` (7), written first; red against the old client
  (`apiBlob` not exported), then **14 passed**. Cases: 200 (blob, headers, one same-origin request, signal passed on); error with
  the JSON model; 401 -> handler true -> retried once; 401 -> handler false -> thrown, no retry; 401 without a handler (Ingress)
  final; `apiResponse` raw answer with the retry and caller options; absolute `apiUrl` address kept; 422 `{detail}`; conforming
  body unchanged (extra keys kept); partial model filled; 204; non-JSON 502; JSON scalar body; shared in-flight GET and a GET with
  a signal never shared.
- Touched-area suite: every `unit-*` spec that imports one of the 18 touched `api/` modules, or reads their source (67 files):
  `npx playwright test -c playwright.unit.config.ts --workers=1 <67 specs>` -> **940 passed, 8 skipped, 0 failed** (43.3 min on a
  loaded machine). (Skips not inspected individually.)
- After removing the now-unused imports: `npx tsc --noEmit` -> **exit 0, no output**; rerun of `unit-client`, `unit-client-blob`,
  `unit-tickets-table`, `unit-playback-scrub`, `unit-access-events-logic` -> **77 passed**.
- NOT_RUN: `vite build` / bundle check, evidence / layout / pixel specs and page-driven unit specs (`SW_UNIT_PAGES=1`). They are
  left to the lead's combined wave-1 runner entry check. Pixels are expected unchanged (no markup or CSS touched).

## Rollback

Revert the branch commit; no data, migration or setting is involved.
