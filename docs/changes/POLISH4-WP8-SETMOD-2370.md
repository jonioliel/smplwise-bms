# POLISH4-WP8-SETMOD-2370: settings (modules) polish, round 4

Branch `pilot/POLISH4-WP8-SETMOD-2370`, cut from `origin/release/2360-train` @ 44b8383c2 (the train did not yet contain v2.34.2), then
`origin/release/2360-train` @ eb9525d9b (v2.34.2 + 2.35.0 + 2.36.0) merged in cleanly (no conflict; none of the package files changed on
the train side). No version bump, no merge to the train, no tag.

Package scope: notifications (+ the device registration everyone sees), notices, public transport, voice announcements, infrastructure
settings (electricity retention, generator, elevators), the access-control segments (status, health, action log, groups, policy, messages),
the mobile tab (presence), and external access (D18, owner Q4/Q9a). Frozen structure: menus, tabs, titles, control order and every `data-*`
hook are unchanged; each edit is a style, a token, a state, a copy line or (transit, owner-approved addition) one new button and route.

## Defects

| # | Before | After |
|---|---|---|
| D6 | `pwa/notifications-settings.ts` - the registration screen every user sees named "Home Assistant" three times: the doors category ("...מ־Home Assistant (אירועי WisKey כשיהיו זמינים)"), the https support text ("...או דרך Home Assistant בכתובת https") and the framed-app note. The administrator-only VAPID key note also named it. | Neutral copy: "פתיחה, נעילה ושחרור של דלתות ומנעולים במבנה"; "פתחו את Arx בכתובת שמתחילה ב־https"; "Arx פתוח כאן בתוך אפליקציית הבית ... פותחת את Arx באותה אפליקציה"; key note "גיבוי של המערכת". The file has no platform name left. Also: the device card showed "כבוי" while loading and an unreadable list as "off" - now a compact loading panel, and a first-read failure is an error panel with "נסו שוב"; the error ink is `--sw-danger-text`. Note: `docs/design/UI_COPY_RULES.md` lists this file as "kept exact" (settings area); the survey/owner D6 wins (recorded, not resolved in the rule file). |
| D16 transit | `system-transit.ts` had no `@media`: on a phone a stop row put the code chip, the name field and three keys (up / down / remove) on one line, the name field shrank to a sliver; `.two` could force a 300 px card; a long source error ran out of its cell; the toast sat on the bottom bar. | Phone: a stop is two lines (code + name, then the keys, end-aligned); `.two` is `minmax(min(300px,100%),1fr)`; `.kv dd` wraps; fields / checkboxes 44 px on a coarse pointer; the toast clears `--sw-bottomnav-h`. |
| D16 access-control | Card subtitles showed the integration's call names: `health/get`, `fleet/alerts · n`, `... · sync/status`, `conflicts/list`, `... · audit/list`, `לצפייה · profiles/settings_get`, `profiles/versions` (several in `.ltr` Latin). No phone rules in the segments; `button.row` / `.sw` hover washes not gated (stuck on a tablet). | Subtitles in words (`i18n/access-status.ts`, he; en falls back): "חיבור וסנכרון של כל תחנה", "{n} ברשימה", "ספירות בלבד, בלי פרטי אנשים", "רשומות שהסנכרון לא השלים", "לצפייה בלבד · פעולות שנעשו מ־Arx מתועדות ביומן של Arx", "לצפייה בלבד", "כל שינוי בקבוצות ובשדות, מהחדש לישן"; the `ltr` class dropped from them. New `screens/system-access-polish-css.ts` (added after `statusStyles` in status / audit / groups / policy / messaging): hover only on `(hover:hover) and (pointer:fine)`, rows give on pointer-down, chip keys press + focus ring, reduced motion; phone: the card head stacks and its filters sit in two even columns. Messages: the save row is sticky on a phone (Q7). `evidence-access-status.spec.ts` pin updated (`'2 ברשימה'`). |
| D17 | Announcements tab (`system-announcements.ts`, `system-announce-templates.ts`) never reviewed: the "נשמר" line was drawn after the last card in `--sw-live` (the live-video dot colour), out of sight on a long page; the error state was `heading=<error text>` with a "↻" key; error box `--sw-danger` ink on a mixed fill; 36 px fields on touch; the history table (4 columns) ran off a phone; templates kept a 90 px label column on a phone. Long settings pages had no phone save row in view. | Announcements: the "נשמר" answer is a sticky status pill (success soft / text) at the bottom of the view; error panel with a heading, the error as hint and "נסו שוב" (he / en / ru / ar); `--sw-danger-soft` / `-text`; focus rings; 44 px fields and checkboxes on a coarse pointer; phone history entry = two lines (time, source, status; then the message in full); templates: labels above fields on a phone, 44 px summary, the add / save row sticky on a phone. Q7 sticky save rows on a phone (the settings kit `.foot.sticky` look, kept local because these elements do not load the kit): notifications preferences and the outgoing-mail form, access-control messages, presence (mobile tab), electricity data retention, announcement templates. |
| D18 | External access scrolled the page at every width (ACCESS-POLISH-2331 measured 506 / 1,149 / 3,924 px at 1440 / 1024 / 390). | From a 1024 px window up (and >= 600 px tall) the page does not scroll: the title, banners and KPI filters stay, the grants list scrolls inside its card under its filters and column head (`.gl-body`, thin scrollbar, contained overscroll), the pending panel caps at 38 % and scrolls, the side panels scroll in their own column when taller than the window. 1024-1180 keeps two columns with a 290 px side (was one column, side panels under the list) and the list card switches to its two-line rows by its own width (container query `xgrants` <= 860 px). A phone, a narrow or a short window keeps the page scroll (no trapped inner list). Rows: hover only on a fine pointer, press wash; KPI keys press; reduced motion. `access-external/styles.ts`: `999px` -> `--sw-r-pill`, ladder digits `12px` -> `--sw-fs-xs` (survey D14 item); `request-dialog.ts`: hover gated, `11px` -> `--sw-fs-xs`. |

Other refinements inside the package files: notifications - setnav / picker hover gated + pointer-down wash, severity / channel keys press, `999px` / `12px` radii -> `--sw-r-pill` / `--sw-r-sm` (the drawn phone mock keeps its own literals, `ALLOW_HEX` entry unchanged); notices - template tiles press / hover / focus, phone toast above the bottom bar, feed URL fits; presence - message inks `-text` tokens, `--sw-radius-sm, 8px` -> `--sw-r-sm`, segment press, 44 px on touch, focus rings; elevators - `999px` -> pill token, segment keys press + 44 px on touch, the extra-sensor row stacks under 600 px; generator - load error has "נסו שוב", forbidden has a heading; infra host - the forbidden panel has a heading and a hint.

## Owner-approved addition (02.11 evening): transit "בדוק עכשיו"

Lab finding (read-only, add-on 2.35.0): `GET /transit/status` health `{state: off, codes_in_use: 0, errors: 21, consecutive_errors: 21,
last_error: http_503, last_error_at 04:00 local, last_good_at 26.10, backoff_until}`, while the source answered 200 in 0.3 s to the same query
and the catalogue refreshed fine the same day. Arrivals are polled only while a screen shows the stops, so the settings screen kept a stale 503
with no way to ask again.

- Backend: `POST /api/v1/transit/check` (`routers/transit.py`, `services/transit/poller.py: check_once`). `system.configure` checked on the
  read connection (`read_gate`, no write lock held while the source answers), audited `transit.check` (codes, fetched, ok, error, skipped),
  one check per 30 s per installation (429 `transit_check_rate_limited`, `details.retry_after_s`). It asks the source ONCE per configured stop
  (the poller's provider and real fetch), updates and persists the health (success: `consecutive_errors` 0, `last_ok_at` now, backoff cleared;
  failure: one more error with its kind), stores cache rows only for stops a screen uses, never loops, never changes a setting. Our own
  circuit-breaker backoff does not block a person; the provider's `Retry-After` does (new `Health.retry_after_until`, persisted). No stops ->
  `skipped: no_stops` without a call. Same route locally and remotely, like the other transit writes.
- UI (`system-transit.ts`, `api/transit.ts`, `i18n/transit.ts` he + en): "בדוק עכשיו" in the health card (pending "בודק…", disabled while
  pending), the answer line ("המקור ענה עכשיו (3 תחנות נבדקו)" / "המקור לא ענה עכשיו: המקור לא זמין (503)" / Retry-After wait / no stops /
  the 429 text), with the time. When the state is `off` or no stop is in use: "אף מסך לא מציג כרגע את התחנות - הנתונים נבדקים רק כשמסך מציג
  אותן" and no "data age" row. The last error with its age ("לפני 15 שעות: המקור לא זמין (503)") and the last success with its time and
  age. Also fixed: the `source_down` state (BUSSTATUS-297) had no badge text and showed the raw key `st_source_down`.
- What is NOT explained: the 21 consecutive failures since 26.10. A Stride 503 window at night is a suspicion (the last error was at 04:00
  local), not verified. With the check button we can learn: (1) whether the source answers now from the add-on host (not only from the PC);
  (2) whether a success clears the run (it should: health back to "ok"/"off" with a fresh last success); (3) whether failures repeat at fixed
  hours (repeat the check at different times; the audit rows `transit.check` keep each answer's ok / error); (4) whether the provider sends
  `Retry-After` (the answer says "המקור ביקש להמתין"); (5) whether the error is the source (http_5xx) or our network (`unreachable`).
- `contracts/API_INVENTORY.md` is generated at release (`scripts/api_inventory.py`); the new route is left for the release step.

## Files

Frontend `src/`: `pwa/notifications-settings.ts`, `screens/system-notifications.ts`, `screens/system-notices.ts`, `screens/system-transit.ts`,
`screens/system-announcements.ts`, `screens/system-announce-templates.ts`, `screens/system-infra.ts`, `screens/electricity/settings-retention.ts`,
`generator/gen-settings.ts`, `elevators/elevator-settings.ts`, `screens/system-access-{status,audit,groups,policy,messaging}.ts`,
`screens/system-access-polish-css.ts` (new, package-only), `screens/system-presence.ts`, `screens/access-external.ts`,
`access-external/styles.ts`, `access-external/request-dialog.ts`. Single-consumer exceptions outside the listed files: `i18n/access-status.ts`
(only the access-control segments read it; the seven subtitle strings), `api/transit.ts` and `i18n/transit.ts` (the transit addition).
Backend: `routers/transit.py`, `services/transit/poller.py`, `tests/test_transit_check_wp8.py` (new). Tests: `frontend/tests/evidence-polish4-wp8.spec.ts`
(new), `frontend/tests/evidence-access-status.spec.ts` (one pin). Looked at, left alone: `system-access-control.ts` (host), `system-access-health.ts`,
`electricity/elec-settings-calendar.ts`.

## Tests (real totals)

- `tsc --noEmit` (frontend, workstation): 0 errors (run twice: after the UI slices, and after the base merge + transit addition).
- Node unit specs (`playwright.unit.config.ts --workers=1`, after the base merge + transit addition): unit-bustimes-295, unit-token-lint,
  unit-a11y-polished-lint, unit-access-external, unit-access-status-logic, unit-messaging-strings, unit-noticeperm-295, unit-notify-whatsapp,
  unit-wxmedset, unit-security-public, unit-access-request: **115 passed, 0 failed**.
- Backend pytest (venv, single process): `tests/test_transit_check_wp8.py` alone **7 passed**; then test_bustimes_295 + test_busstatus_297 +
  test_busstatus_297_persist + test_bustimes_rt_295 + test_transit_realtime + test_transit_check_wp8: **130 passed, 0 failed**.
- Runner: **NOT_RUN** (see below).

## Baselines

Expected to move (refresh on the runner, review each diff):
- `pixel-access-status` (desktop 1440 + mobile 390, classic / bubble / domus): every picture with a card subtitle (list, lower, audit, groups,
  muted, stale, busy, not-connected...) - the subtitle text changed; on 390 the card heads stack.
- `pixel-access-s12`: `s12-classic-audit-person-*` (the action log subtitle). The display / parity / checklist pictures are other files and
  should not move.
- `visual-matrix` `settings-notifications`: expected unchanged in classic (radii 12 px / 999 px are the same token values; the mail row looks the
  same); a skin whose `--sw-r-pill` / `--sw-r-sm` differ would move.
- No pixel spec covers transit settings, announcements, presence, retention, elevator / generator settings or external access (the
  `pixel-bustimes-295` baselines are the TV page, untouched).

## NOT_RUN

- **All runner jobs.** The release gate on `release/2360-train` held the runner (state `running`, `~/.gate-pending` present) from 19:12 UTC
  for more than 90 minutes of this package's window; per the runner policy nothing was started. Ready to run when it is free:
  - before: `run_smart.py preview probe/POLISH4-WP8-before tests/evidence-polish4-wp8.spec.ts --workers=1 --machine runner` (branch
    `probe/POLISH4-WP8-before` = the train tip + only this spec, phase `before`: records metrics, asserts only "no sideways scroll");
  - after: the same on `pilot/POLISH4-WP8-SETMOD-2370` (phase `after`: external access no page scroll at 1024 / 1180 / 1440 / 1920 and the
    list region `overflow-y: auto`, phone keeps the page scroll; no sideways scroll on every screen; no call names in the access-control
    subtitles; messages save row sticky on a phone only; transit name field >= 160 px, "check now" answer line, idle note, error age; no
    platform name in the device registration). The spec prints `WP8_METRICS <phase> <project> <capture> {...}` lines;
  - `evidence-access-status.spec.ts` (the updated subtitle pin), `evidence-announcements.spec.ts`, `evidence-pwa-push.spec.ts`,
    `evidence-notifications.spec.ts`, `evidence-access-polish-2331.spec.ts`;
  - baseline refresh: `pixel-access-status`, `pixel-access-s12` (`-u`, review every diff with PIL), `visual-matrix -g settings-notifications`.
- No picture of any changed screen was seen (no local vite / Playwright on this workstation by rule): light / dark, RTL and the 1920 / 1440 /
  1180 / 1024 / 390 looks are covered by CSS reasoning only. D18 (no page scroll) in particular is unverified until the "after" run.
- The full backend suite (only the six transit files above ran) and the fixture-backend specs.
