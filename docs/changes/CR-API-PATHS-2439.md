# CR-API-PATHS-2439 - one way to build an API path: `path` and `query` in the client

Branch `pilot/CR-API-PATHS-2439` (master plan row `CR-API-PATHS-2436`, section 3.3 wave 2 frontend; theme T16).
**Base: `origin/pilot/CR-WAVE1B-COMBINED-2436` (1a7e19ae3)** - `api/client.ts`, `api/access-grants.ts`, `api/notifications.ts` and
`api/tickets.ts` were changed by wave 1 (API-BLOB, NAV-LABELS); no `api/` file is held by AUDIT30. No version bump, no backend change,
no pixel change.

## Findings covered

- **07:F15**: raw `${id}` path segments in the API modules (`new URL()` normalises `..`, so an id holding a slash or dots would address
  another route); hand-concatenated query strings (`access-grants.ts` left `credential` unencoded).
- **07:F21**: duplicate type names with the same meaning.

## What changed

`api/client.ts` (additive):
- `` path`cases/${id}/items/${itemId}` `` - a tagged template that encodes every interpolated value as one segment
  (`encodeURIComponent`); the literal parts are the route as written. For a server-issued id the URL is byte-identical.
- `query({ ... })` - `?k=v&...` in key order, `encodeURIComponent` on keys and values (the same bytes as the strings it replaces, not
  `URLSearchParams`), `undefined` / `null` / `''` left out, `false` and `0` kept. Nothing to send = `''`.

145 call sites in 21 modules moved onto them: `access.ts`, `access-grants.ts` (the approvers query: `credential` now encoded),
`access-profiles.ts` (two queries), `background.ts`, `brand.ts`, `cases.ts`, `catalog.ts`, `floor-images.ts`, `frigate.ts`,
`geometry.ts`, `maps.ts`, `media.ts`, `nvr.ts`, `plans.ts`, `recordings.ts`, `rules.ts`, `setup.ts`, `skins.ts`, `views.ts`,
`water-billing.ts`, `zones.ts`. Every optional query flag keeps its old shape (`?force=true` / nothing, `?check=false` / nothing,
`?revision=N` only when set, `&h265=0` kept, ...): pinned in the spec. In `zones.ts` the local `path` variables became `url` (they
would shadow the helper).

Left as they are, on purpose: the four socket files and `exports.ts` (other rows: CR-SOCKETS, CR-FORMAT); `automations.ts`,
`tickets-rfq.ts`, `second-factor.ts` (already encoded; the raw part is a literal-union kind or a base constant);
`building-presence-logic.ts`, `search.ts`, `media-screens.ts`, `media-players-mock.ts` (not an API path: a display string, an
in-app route rewrite, an already-built relative path, a mock's error text). The ten local `const enc = encodeURIComponent` helpers
in other modules are correct and stay (no behaviour to fix there).

07:F21 (type only, no runtime change):
- `Severity` (`'info' | 'alert' | 'critical'`): one definition in `api/types.ts`; `notices.ts`, `notifications.ts`, `tickets.ts`
  re-export it (importers unchanged).
- `Weekday`: the automations' copy (written "mon" first) and the notifications' copy ("sun" first) are the same seven values - a union
  has no order, so there is nothing to rename; one definition in `api/types.ts`, both modules re-export it. The display order is each
  module's `WEEKDAYS` array (Sunday first in both), unchanged.
- Not shared, on purpose: `StreamEncoding` (`types.ts` vs `nvr-settings.ts`) and `Tariff` / `TariffVersion` / `Period`
  (`electricity-billing.ts` vs `water-billing.ts`) have the same names but different fields - they are not the same type.
  `generator.ts`, `temperature.ts` and `notice-tv/tv-logic.ts` have their own `Severity` (other sets or outside `api/`): not in this row.

## Tests (run locally, Windows, Node 24.21.0)

- `npx tsc --noEmit` (full project): **0 errors**.
- New `unit-client-path.spec.ts` (`playwright.unit.config.ts`, `--workers=1`), **27 passed**: `path` byte-identical for hex / uuid / usual ids,
  a slash, dots, `?` and `#` stay inside their segment (and resolved against the API base the route stays the route), the
  `encodeURIComponent` bytes; `query` order, empties, `false` / `0`, same bytes as the replaced strings, every converted optional flag;
  per converted module no raw interpolated path segment left; the two named query strings; the shared type names.
- The 13 node unit specs that read these modules' source (`unit-access-parity-logic`, `unit-board-answers-2400`, `unit-mocks-lazy`,
  `unit-nav-labels-2436`, `unit-noticeperm-295`, `unit-rfq-question-settings`, `unit-rfq-vendor-upload`, `unit-station-ws-path-2381`,
  `unit-tickets-naming`, `unit-tickets-quotes`, `unit-tv-chips-2381`, `unit-wall-phone-bar-2401`, `unit-wxmedset`): **104 passed, 1 skipped**.

## Not run

- Runner entry check and pixel baselines: not queued, by the lead's instruction. Browser evidence specs (they mock `**/api/v1/...`
  with the same server-style ids, which come out byte-identical): NOT_RUN locally. Pixels: none expected.
