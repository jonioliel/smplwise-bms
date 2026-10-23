# FLEET215-295 progress (slice 1 complete, 2026-10-23)

Branch `pilot/FLEET215-295`, cut from `origin/main` @ 90cd7d9ae. Change record: `docs/changes/CR-FLEET215.md`.
Provisional migration: `0149_fleet_report_log.sql` (the lead renumbers at integration; only this one file carries the number, plus the
`db_schema` figure in `services/fleet-receiver/tools/gen_fixtures.py` fixture body - regenerate the fixture after a renumber).

## Done in slice 1
- Backend: `services/fleet_keys.py`, `fleet_report.py`, `readiness.py`, `demo_mode.py`; routers `fleet.py`, `readiness.py`; migration 0149;
  backup exclusions; add-on option `fleet_report_url` (config.yaml, config.py, self_update, DOCS.md, DOCS_HE.md).
- Receiver skeleton `services/fleet-receiver/` with generated `src/schema.json`, signed interop fixture, `package-lock.json`.
- Change record CR-FLEET215.md (schema justification per field, threat model, privacy, keys, receiver, readiness, demo, owner questions).
- Tests: `test_fleet_report_215.py`, `test_readiness_demo_215.py`, `test_fleet_receiver_fixtures_215.py`.
- `contracts/API_INVENTORY.md` regenerated (1208 routes).

## Test results (runner, targeted only)
- pytest: test_fleet_report_215, test_readiness_demo_215, test_fleet_receiver_fixtures_215, test_docs_config_consistency,
  test_self_update_s3_fixes, test_backup: 104 passed, 1 failed (a test-isolation bug in the new demo test, fixed afterwards).
- pytest test_readiness_demo_215.py after the fix: 18 passed.
- fleet-receiver: `npm ci`, `npm run typecheck` clean, `npm test` 15 passed.
- NOT_RUN: the API-inventory consistency test after regeneration, the whole suite, any frontend check (no UI in slice 1).

## Remaining (slice 2 and integration)
1. Settings UI card (readiness, report switch, preview/log, demo switch) and the demo label on screens that opt in.
2. Receiver: deploy decisions (owner), overview page, silence alerting, key rotation message.
3. Lead: renumber the migration, bump version/changelog/release notes, run the API-inventory test in the gate.

## Slice 2 design mock-up (awaiting owner approval, 2026-10-23)
`docs/design/mockups/fleet-215/index.html` - static, self-contained, RTL Hebrew, light + dark, desktop + phone (gallery buttons,
or `?theme=dark&s=settings|fleet|inst&st=<state>&w=phone`). No UI is built until the owner approves it.
1. Settings > System > health report: consent switch, receiver key (set / not set), signing key id, installation id, enrollment code,
   last report + attempt log + the exact body, readiness card, demo-data switch, and "what leaves the installation" = every schema
   leaf of CR section 3 (52 fields, grouped) plus the never-sent list. States: off, on, receiver not set, send failed, loading, error.
2. Receiver overview: installations with state (ok / warn / error / silent), last seen, version + bridge mismatch, readiness, open
   alerts, free disk, last backup; silent-installation banner; filter chips; phone card list. States: data, empty, loading, error,
   intake off.
3. One installation at the receiver: last seen, readiness, alerts, disk, 30-day strip, components, versions, readiness gaps.
Checked: headless screenshots at 1280 px light/dark and in the phone frame; no horizontal overflow at 375 px in all 12 states.

### Mock-up v2 (2026-10-23, after the owner's review of v1)
Owner's verdict on v1: direction fine, but "a bit uncomfortable: a LOT of scrolling, and items that are not explained; it must be comfortable
for the simplest technician". The same day the owner directed that every mock-up follows the visual language of the existing temperature /
elevators / schedules-automations screens. v2 (same file; copy `private/review/fleet-215-mockup-v2.html`, screenshots
`private/review/fleet-215-v2/`, both gitignored) changes:
1. Visual language = the product's own, nothing new: sw-page header (crumbs, 26 px heading, grey one-line subheading), the settings tab row
   (sw-tabs underline: כללי · התראות · … · דיווח בריאות), sw-card (12 px radius, 14 px padding, collapsible cards with the chevron), the
   settings rows of styles/settings.ts (label + one-line hint at the start, control at the end; `.check` / `.val` fact rows; `.msg` status
   pills), the infra KPI row (dot + number + label, each a filter) and the solid state badge / soft chips of infra-temperature and
   infra-elevators, the tokens of design/tokens.ts (colours light + dark, type scale, radii, shadows), sw-toggle 42 x 24, sw-button sizes.
2. Placement: the reporting settings are a new tab of Settings (system area). The overview and the one-installation page are the
   receiver's own web page (the separate Cloudflare Worker, not inside Arx), drawn in the same language.
3. Scrolling cut: the first screen answers the one question the user came with, with the main action visible without scrolling.
   Settings: an "answer" card (state in words + colour, one line of what it means, one line "מה לעשות", the switch and "שליחת דוח עכשיו"),
   then the readiness to-do list; everything else is three collapsed cards with a count ("מה נשלח בדוח · 52 פריטים", "דוחות אחרונים",
   "חיבור ל-SmplWise ופרטים למתקין"). The never-sent list is one visible line in the collapsed header. Overview: KPI filters, the silent
   banner, then "צריכות טיפול עכשיו · N" (each row: badge, name, the first reason in words, the one action), the full table after.
   Installation: the answer card ("לא מדווחת כבר 41 שעות" + what to do), four KPIs, the 30-day strip with a worded legend, four collapsed cards.
4. Plain Hebrew for a non-expert installer: every row has a short label and, where needed, one explanation line (this mock-up relaxes
   the "no hints" operator rule on purpose); no hash / schema / enrollment / epoch wording; the schema paths sit behind a "שמות טכניים"
   toggle; the exact JSON stays behind its own expander. Status is always words + colour (badges and chips carry text).
5. Phone: the same cards stacked; the KPI row becomes a 3-column compact grid; the mock-up's own gallery bar folds to one row ("עוד…").
6. The five owner questions are live toggles in the gallery bar: silence threshold 36 / 26 / 72 h (changes who counts as "לא מדווחת"),
   the "reporting stopped" message (the clinic shows "כבויה" instead of "לא מדווחת"), the e-mail on silence (a line in the banner), the
   exact JSON on / off, the QR code next to the enrollment code.
Measured (Playwright, chromium, the mock-up's own URL switches; also checked in the built-in browser at 1366 x 768): no horizontal
overflow at 1366 / 1024 / 375 in all 12 states. Scrolling per screen in "screens" (page height / viewport):
settings on / off / no-address / failed 1.20 at 1366 x 768 and 1024 x 768, 1.34-1.44 on the phone (the first screen holds the answer card,
the switch and the whole readiness list); loading / error 1.0. Overview with data 1.49 at 1366 x 768, 1.53 at 1024, 2.48 on the phone
(the first screen holds the KPIs, the banner and the "needs me" list; the scroll is the full table of 9); empty / loading / error / intake
off 1.0. One installation 1.11 at 1366 x 768, 1.41 on the phone.

### Owner questions that block the UI (recommendation first)
1. Silence threshold for "שותקת": 36 hours (recommended), 26 hours, or 72 hours?
2. When the customer turns the report off, send one last signed "reporting stopped" message so the receiver shows "כבוי" instead of
   "שותקת" (recommended; adds one enum value to the schema), or keep the schema as is and let it fall silent?
3. Silent-installation alert: on the overview page only in slice 2 (recommended), or also an email / push to SmplWise?
4. Settings page shows the exact JSON body and the 52-field list to the system administrator (recommended), or the field list only?
5. Enrollment code: text with a copy button (recommended), or also a QR code for the installer's phone?

## Open owner questions (recommendation first)
1. Include `counts.users_active` / `system_admins` (counts only)? Recommend: yes.
2. Receiver as a separate Worker (recommended) or a route inside the push relay?
3. Key rotation: re-enroll by hand (slice 1) or a rotation message signed by the old key (slice 2)? Recommend slice 2.
4. Admin overview behind Cloudflare Access in addition to ADMIN_TOKEN? Recommend yes.
5. Data-processing terms with customers before the first enrollment (who signs)?

## Settings UI (installation side) built 2026-10-24
Owner approved mock-up v2 and answered: silence 36 h (EDITABLE), final signed "reporting stopped" message, silence alert to SmplWise (receiver side, not built here), exact body + 52 fields visible to the system administrator, enrollment code as text + copy, receiver stays a separate service, key replacement signed by the old key (stage 2), user counts yes, no extra customer approval.
- Screen: Settings > new tab "דיווח בריאות" (`#/system/fleet-report`, system.configure, installation scope; the server also needs a system administrator): answer card (switch + send now), readiness to-do list, folded cards (what is sent: 52 fields grouped + technical names toggle + never-sent chips; last reports + exact body; connection details: address state, signature, id, enrollment code with copy, silence threshold, demo switch). Files: frontend/src/screens/system-fleet-report.ts, fleet/fleet-model.ts, i18n/fleet-report.ts, api/fleet-report.ts.
- Backend: PUT /fleet/report also takes silent_after_h (26..168, default 36, audited); it travels to the receiver as header x-arx-fleet-silent-after-h (never in the signed body: the 52-field schema is unchanged). Switching ON->OFF sends one signed stop message (POST <url>/v1/stopped, schema smplwise-fleet-stop/1, keys schema/installation_id/seq/generated_at), best effort, logged with trigger "stop" (provisional migration 0149 CHECK extended).
- RECEIVER TODO (separate service): accept /v1/stopped and show "off", read the silence header, silence alert by email.
- Evidence: docs/design/evidence/fleet-215/ (desktop 1440 + phone 390, light/dark).
