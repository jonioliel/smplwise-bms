# RELEASE-2380-TRAIN: assembly of the 2.38.0 train (display + mobile server)

Branch `release/2380-train`, cut from `origin/release/2370-train` (a81f96aa6, the 2.37.0 version commit). Release order: 2.36.0 -> 2.36.1 ->
2.37.0 -> WisKey -> **2.38.0**. No version bump, no changelog entry, no runner, no UI build, no tag: this document is the input for the version
commit and the runner gate. Every feature stays off by default (presence, quiet windows, the app sign-in switches, push relay unset).

## 1. Merged (one `--no-ff` merge commit each, in this order)

Branches 1-6 were cut from `release/2360-train`; 7-8 joined in slice 2 (section 8).

| # | Branch | Tip | Merge commit | Conflicts |
|---|---|---|---|---|
| 1 | `pilot/MOBILE-CONTRACT-V22-2380` (contract v2.2 sensor shapes, `presence.value_check`, `intervals_s` defaults, K-5 rotation fixtures) | aed13eda4 | fadc942bb | none |
| 2 | `pilot/APP-SERVER-LEFTOVERS-2380` (`GET /brand/app`, `/brand/app/logo/{variant}`; quiet window holds phone / browser push only, `quiet.windows.channels`) | f8de881af | ee208d158 | `contracts/API_INVENTORY.md` (generated) |
| 3 | `pilot/PUSH-GOLIVE-KIT-2380` (owner session checklist, field-test script, `scripts/push_golive_check.py`) | 5e4ea96f5 | 9bc2878db | none |
| 4 | `pilot/TV-FIT-2380` (portrait footer keeps every chip, overscan margin, crest logo by area, Hebrew date fallback) | 8107863ed | 571891e9d | none |
| 5 | `pilot/TV-SETTINGS-2380` (contains TV-FIT; `portrait_chips` / `safe_margin` saved, validated, audited, served) | 3d0d7b949 | 4f3453699 | none |
| 6 | `docs/APP-TEAMS-R11-2380` (R11 package record, phone-app handoff docs + brand assets, employee notice) | 61cadc6dd | b9ebb682c | none |
| 7 | `fix/PUSH-RELAY-SAFE-2380` (built on APP-SERVER-LEFTOVERS; a bare relay 404 / 410, 401 and 403 are configuration errors that keep the registration; relay URL validated) - slice 2, section 8 | 669bba371 | 7fa940bb6 | none |
| 8 | `fix/A11Y-R4-LEFTOVERS-2380` (built on 2370-train; `sw-tabs` tablist, `--sw-toggle-off` >= 3:1, status note focus, plan bar 44 px touch, phone scroll-padding) - slice 2, section 8 | 1040f88ab | 32310da07 | none |

## 2. Conflicts

Only `contracts/API_INVENTORY.md` (merge 2): the 2.37.0 header line against the branch's 2.36.0 one. Resolved by regenerating with
`scripts/api_inventory.py` on the merged tree: **1713 routes** (the two new `GET /api/v1/brand/app*` routes; the Version line stays 2.37.0 -
no bump yet). Regenerated again after all merges and the Settings rows: unchanged (no other route was added). No lint allow-list conflict.

## 3. Settings rows added on the train

The server pieces above shipped API-only because their screen files belonged to polish round 4; with 2.37.0 merged they are free.
All rows use the settings kit's pill-thumb `.seg` keys, Hebrew + English text, no platform words.

| # | Row(s) | Where | Files | Commit |
|---|---|---|---|---|
| 1 | `portrait_chips` ("תצוגת אייקוני המבנה במסך אנכי": שתי שורות / שורה אחת, מסתירים את התקינים קודם) and `safe_margin` ("שוליים בטוחים בקצוות המסך": ללא, 1%..5%), labels and hints from `TV-SETTINGS-2380.md` section 3 | Settings › Notice board › TV screen defaults card (installation default, saved at once) and a board's תצוגה tab (first key "ברירת מחדל" sends `null`; saved with the board's save button), right after the design rows | new `notices/display-fit.ts` (`notice-display-fit`), new `notices/display-fit-model.ts` (a board's own `0` is a real choice; the margin goes up as a JSON integer), `i18n/notices.ts`, `screens/system-notices.ts`, `api/notices.ts` | 2b3251a37 |
| 2 | `presence.value_check` ("בדיקת ערכי החיישנים": כבוי / נרמול / קפדני, default כבוי; hint recommends נרמול before sharing goes live) | Settings › Phone app › general page, first card (after Wi-Fi matching); saved with the page's existing save row (sticky on a phone) | `api/presence.ts` (`ValueCheck`, `valueCheckOf`), `i18n/presence.ts`, `screens/system-presence.ts` | f1b2f5798 |
| 3 | `quiet.windows.channels` ("ערוצים שהחלון משהה": פוש בלבד / כל הערוצים, default פוש בלבד) | There was no quiet-window card at all (CR-QUIET103 slice 1 was API only), so a new card "חלון שקט לקומה או לאזור" under the quiet-hours section of Settings › Notifications, with all five `quiet.windows.*` settings (on/off, default and longest length, also hold important, channels). Draft + `.foot.sticky` save row; `confirmed: true` only from the confirmation dialog (it says that switching off ends every open window); read-only without `system.configure` | new `api/quiet-windows.ts`, new `i18n/quiet-windows.ts`, new `screens/system-quiet-windows.ts`, `screens/system-notifications.ts` | 25c8500fd |
| 4 | The two app sign-in switches `security.app_refresh` ("כניסה שמורה באפליקציה") and `security.app_session_exchange` ("חיבור מסך האפליקציה") of `PUT api/v1/auth/app/settings` (the keys of `MOBILE_FIELD_TEST_HE.md` step B1) | Settings › Remote access, new admin card "כניסה מהאפליקציה לנייד" after the active remote sign-ins card. The route's rules: hidden on 403 (system administrators only); on the remote channel the "פעיל" key of a switch that is off is closed with the local-network note, "כבוי" works anywhere; the exchange needs the saved sign-in (turning the saved sign-in off turns the exchange off too) and an access token of at most 15 minutes; a confirmation names what a save ends. `.foot.sticky` save row | new `api/app-signin.ts`, new `i18n/app-signin.ts`, new `screens/system-app-signin.ts`, `screens/system-diagnostics.ts` | 5eaa5fb7e |

Unit spec: new `frontend/tests/unit-settings-rows-2380.spec.ts` (13 tests: the rules of each row, the Hebrew / English text, the wiring
read from the source, no platform words) - 78f9e1eda.

## 4. Checks on the workstation (03.11, one worker / one process, no local vite or browser)

| Check | Result |
|---|---|
| `tsc --noEmit` (src + tests) | 0 errors |
| Node unit specs, `playwright.unit.config.ts --workers=1 tests/unit-` (final tree) | **3719 passed, 1 skipped, 0 failed** (13.7 min) |
| New + neighbouring unit specs (`unit-settings-rows-2380`, `unit-boardv2-297`, `unit-tv-fit-2380`) | 24 passed |
| Backend, one process: `test_presence_contract_v22`, `test_app_refresh_rotation_fixtures_k5`, `test_presence`, `test_app_server_leftovers_2380`, `test_quiet103`, `test_notify_channels`, `test_mobile_push`, `test_push_golive_check`, `test_notice_tvsettings_2380`, `test_notice_boardv2_297`, `test_notice_tvopt_295`, `test_notice_tvnotice2_297`, `test_app_refresh_295` | **326 passed, 0 failed** (pytest exit 0). The first combined run hit its 25-min wrapper timeout after 321 tests (all passed), inside `test_app_refresh_295`; that file was rerun alone: 40 passed |
| `scripts/release_check.py` | every check ok except the expected `git tag for this version: v2.37.0 not yet` (version still 2.37.0; RESULT: ready for the owner's approval) |

Note: `unit-arx-local-login.spec.ts` rewrites the 14 PNGs of `docs/evidence/USR2/` on every run (mocked data); they were restored, not committed.

NOT_RUN: every browser spec (evidence / layout / pixel) and the full backend suite - the runner is reserved for the release gates tonight.

## 5. Baselines expected on the runner

- From TV-FIT-2380 (unchanged by this assembly): all 12 of `pixel-bustimes-295.spec.ts-snapshots/` (default footer wording, portrait
  footer in two rows) and the new `pixel-notice-tv-portrait-chips.spec.ts-snapshots/` (13 images, no baselines in the tree yet);
  `pixel-notice-tv-mock.spec.ts` (the `full` pin removed) may need a refresh.
- The Settings rows: no pixel spec screenshots these four screens (checked: no `toHaveScreenshot` spec opens Settings › Notice board,
  Notifications, Phone app or Remote access), so no baseline is expected from them. Evidence specs that capture those pages will show the
  new rows / cards (see section 6).

## 6. Runner specs to run (gate input)

| Area | Specs |
|---|---|
| TV page (TV-FIT / TV-SETTINGS) | `pixel-notice-tv-portrait-chips`, `pixel-bustimes-295`, `pixel-notice-tv-mock`, `unit-tvnotice2-297` / `evidence-*notice*` that read the portrait classic footer geometry |
| Settings › Notice board (row 1) | `evidence-notices`, `evidence-noticepage-295`, `evidence-noticeslides-295`, `evidence-noticedel-295` |
| Settings › Phone app (row 2) | `evidence-presence-settings`, `evidence-presence-2280-layout`, `evidence-whoin034-295` |
| Settings › Notifications (row 3) | `evidence-notifications`, `evidence-polish4-wp8`, `layout-a11y-295`, `layout-visdiff-246`, `layout-page-background`, `uxrest-audit`, `uxrest-focus`, `uxrest-states` |
| Settings › Remote access (row 4) | `evidence-arx-remote`, `evidence-arx-sessions`, `evidence-remote-video`, `evidence-tabs-scroll-2331` (the card appears only with a backend answer to `GET auth/app/settings`; in demo / mock mode it draws nothing) |
| Phone width | the four screens at 375 px: the `.foot.sticky` save rows (quiet-window card, app sign-in card) |

## 7. Open points

- The quiet-window card is a whole new card (not only the channels row) because no card existed; its look is the settings kit inside the
  notifications page's glass section - a design glance on the runner screenshots is worth it.
- The value-check row sits in the first card of the Phone app page; the page's single save row (sticky on a phone) is in the policy card
  below it, as before.
- Owner Q3 (portrait footer: two rows vs drop) is still open; the default stays `rows`.

## 8. Slice 2 (03.11): relay safety and the accessibility leftovers

Merged after the Settings rows (one `--no-ff` merge each, rows 7-8 of section 1); no conflict, `contracts/API_INVENTORY.md` regenerated after
both merges: unchanged (1713 routes; the relay fix changes no route signature or first docstring line).

**Relay document fix (0e1a89b7a).** PUSH-GOLIVE-KIT's decode table in `docs/operations/ARX_PUSH_RELAY_DEPLOY_HE.md` section 5.1 said that a relay
404 / 410 makes the server drop the device's push registration at once. Since PUSH-RELAY-SAFE-2380 that is true only for the contract token error
bodies (404 `relay_token_unknown`, 410 `push_token_gone`); a bare 404 / 410 and a 403 without `server_id_claimed` are `relay_url_wrong`, a 401 is
`relay_auth_failed`, a 403 `server_id_claimed` is `relay_server_id_taken` - configuration errors that keep the registration. The table now has a
row for each; the field-test negative step (`MOBILE_FIELD_TEST_HE.md` C8) expects `relay_auth_failed`, and `PUSH-GOLIVE-KIT-2380.md` finding 4
carries a "superseded" note.

### 8.1 Checks (workstation, one worker / one process)

| Check | Result |
|---|---|
| `tsc --noEmit` (src + tests) | 0 errors |
| Node unit specs, `playwright.unit.config.ts --workers=1 tests/unit-` | **3740 passed, 1 skipped, 0 failed** (17.0 min; the evidence PNGs the login / service-identity specs rewrite were restored, not committed) |
| Backend, one process: `test_mobile_push`, `test_tickets_app_push`, `test_app_server_leftovers_2380`, `test_critical_sound`, `test_self_update_s3_fixes`, `test_docs_config_consistency`, `test_secrets_store`, `test_secrets_transitional_263` (the PUSH-RELAY-SAFE set) + `test_push_golive_check` | **153 passed, 0 failed** (pytest exit 0) |

NOT_RUN: every browser spec and the runner (as above).

### 8.2 Accessibility browser specs to run on the runner (from `A11Y-R4-LEFTOVERS-2380.md`)

1. `a11y-r4-leftovers-2380` (new): `sw-tabs` tablist roles, one Tab stop, arrows / Home / End, tabpanel marking.
2. `a11y-polished-2342`, `a11y-dialog-focus-2310`, `layout-a11y-295` (the existing beds; the 44 px probe).
3. Tabs: `evidence-tabs-scroll-2331`, `evidence-tabs-styles`, `evidence-tabs-ui`, `evidence-tabset-293`, `evidence-infra-tabs`, `evidence-tabs-live`,
   `evidence-tabs-pair` (unselected tabs are no longer Tab stops - arrows reach them).
4. `evidence-shell` (status-dot note: keyboard open puts focus in the note, Escape returns it), `evidence-pwa-push` (the sw-tabs entry is now a `tab`).
5. Plan editor on a coarse pointer at 768-1199 and 390 px: `pixel-walk-touch`, `evidence-plan-studio-4` (the bar must not wrap or grow).
6. Switch screens, light and dark, every skin in the matrix: `visual-matrix` (settings-notifications, settings-security, security-alarm, access
   screens), `evidence-switchui-295`, `evidence-protected-switches`, `evidence-switch-light-dimmer-2331`.
7. Phone 390 px, settings screens with a sticky save row (notifications, retention, presence, access messaging, announce templates, diagnostics
   tabs - now also the quiet-window and app sign-in cards of section 3): focus the last field above / below the pinned row, it must not sit under it.

### 8.3 Baselines expected to move (central refresh on the train)

- **Every picture with an OFF switch** (`--sw-toggle-off`): the off track is darker in light (about 1.2:1 -> >= 3:1 on the card) and lighter in
  dark. `visual-matrix` shots of settings-notifications, security alarm / public security, access messaging / policy, incidents settings, the
  brand installer, the privacy masks, and any screen with an `sw-toggle` (automation rows, schedules, access, calendars, the presence settings
  page). Tesla: the off ring is stronger. Review rule: only the off track / ring may differ.
- No resting change from `scroll-padding` (phone), the plan-editor hit layer, or the `sw-tabs` roles (attributes only).
- The new Settings cards of section 3 use `.seg` keys, not switches, so the OFF-switch move does not touch them.
