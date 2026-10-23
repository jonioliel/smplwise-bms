# CR-READY96 - Installation readiness score, demo mode and white-label ("מוכנות ההתקנה", "מצב הדגמה", "מיתוג")

**Status:** PROPOSED - change record + mockup for the owner's approval. No code in this CR.
**Owner request:** board items r096 (readiness score + demo mode for installing and selling) and r097 (white-labelling by the installing company).
**Builds on:** the setup wizard (`services/setup_wizard.py`, `screens/system-wizard.ts`, CR-021-era), the health report (`services/health_report.py`), the brand colours (`services/brand_colors.py`, `design/brand.ts`, `screens/system-brand-colors.ts`), the frontend demo fixtures (`frontend/src/fixtures/demo.ts`, `api/session.ts` mode `demo`), the backup drill (`routers/backup.py`), the tickets public brand (`services/tickets/brand.py`), the copy rule `docs/design/UI_COPY_RULES.md`.
**Evidence:** mockup `docs/design/mockups/ready-96/index.html` (URL switches in its header comment); screenshots under `private/review/ready-96/` (gitignored); copy `private/review/ready-96-mockup.html`.

## 1. Request, goals, non-goals

Three deliverables, one CR because they share one audience (the installing company) and one settings area:

1. **Readiness** (`#/system/readiness`, tab "מוכנות" after "אשף התקנה"): one page that tells the installer, and later the customer's administrator, how complete the installation is: a score 0-100, a checklist with the measured facts, one-tap next steps ordered by score gain, and a handover card. The wizard answers "is it connected"; readiness answers "is it finished and would it survive the first month".
2. **Demo mode** (started from the readiness page or the user menu): the whole product filled with realistic synthetic data so a prospect can be walked through it on the installer's own box or on a customer's box before go-live, without touching real data or devices. Clearly marked, time-boxed, with an off-switch.
3. **White-label** (`#/system/brand`, tab "מיתוג"): the installing company's name, logo, accent colour and service contact on the customer package: login page, rail tile, PDF reports, email sender. Defined limits: what is allowed, where it appears, what must remain.

Non-goals: a multi-tenant "installer portal" across installations; a public demo site; per-customer theming beyond the accent presets that exist; renaming the product; any telemetry (nothing leaves the installation, section 6).

## 2. Model

### 2.1 Readiness checks

A check is `{id, group, source, weight, critical, status, fraction, summary, facts[], next{label, href}, checked_at}`. `source` is **computed** (measured from the database, the health report and the read-only device probes the wizard already runs) or **configured** (a human attests it, with name and time, because the system cannot measure it). Status: `ok | attention | blocked | pending | not_applicable`. `fraction` in [0,1] is what the check contributes of its weight.

| id | source | weight | critical | measured from |
|---|---|---|---|---|
| `cameras_connected` | computed | 12 | yes | `cameras.status` online / all enabled cameras |
| `cameras_verified` | computed | 12 | no | cameras with a thumbnail younger than 24 h **and** recording coverage found by the existing coverage probe; "verified" = the system has seen a frame and a recording, not only an RTSP answer |
| `places` | computed | 8 | no | floors with a plan image / floors; cameras placed on a plan / cameras |
| `people` | computed | 10 | yes | at least one non-technician user with a VMS role bound; at least one customer administrator; the installer's own account marked as technician (TECHPRIVACY280) |
| `notifications` | computed | 10 | no | per enabled channel (`CHANNELS_V1`): a successful test or delivery in the last 30 days; fraction = reachable channels / configured channels |
| `backup` | computed | 12 | yes | backup password set; a local backup younger than 7 days; the restore drill passed once; an off-box target tested (0136) - four sub-facts, 0.25 each |
| `remote` | computed | 8 | no | `remote_access` option, `remote.policy`, `remote.require_mfa_admin`; not applicable when remote access is off by decision |
| `time` | computed | 4 | no | the wizard's clock-drift checks and `time.zone` set |
| `integrations` | computed | 10 | no | health report checks `nvr, go2rtc, ha_sync, bridge` plus the per-recorder health and the Frigate status when enabled |
| `modules` | computed | 8 | no | per enabled module its own "configured" predicate (tickets: ≥1 department; electricity: tariffs; schedules: a calendar; generator/elevators: a device bound). Modules that are off are not counted |
| `handover` | configured | 6 | no | the installer records customer name, date and the printed-guide flag; blocked until score ≥ 90 and no critical check below 1.0 |
| `tags` and other module checks | computed | 0 when the module is off | no | shown as not applicable so the installer sees why they are missing |

**Score** = round(100 × Σ weight×fraction / Σ weight over applicable checks). Levels: 0-49 "בהקמה", 50-89 "כמעט מוכן למסירה", 90-100 "מוכן למסירה". **Handover gate** = score ≥ 90 **and** every `critical` check at fraction 1.0; a critical check below 1.0 is shown as "חסם" regardless of the score. Weights live in one table in `services/readiness.py` (not in settings) so they are versioned with the code; the owner may tune them before slice 1 (question 3).

**Next steps** = the non-ok applicable checks sorted by `(1 - fraction) × weight`, each with the deep link the check declares (the same `settings_link` idea the wizard steps already carry). The page never performs the fix itself: it opens the screen that does.

**History:** every computed run that changes the score by ≥ 1 or any status writes one row, so the page can show "ציון קודם 71 · +5 השבוע" and a handover report can print the trend.

### 2.2 Demo mode

State (settings keys, not a table): `demo.active` (bool), `demo.dataset` (`residential | office | retail`), `demo.started_at`, `demo.started_by`, `demo.expires_at` (max 24 h), `demo.scope` (`installation`, the only value in v1).

**Mechanism (recommended, option B of question 1):** the backend opens a second SQLite file `<data>/demo/demo.sqlite`, built from a packaged synthetic dataset (the same families as `frontend/src/fixtures/demo.ts`, `demo-3d.ts`, `alarm-demo.ts`, extended to every module), and while `demo.active` the request-scoped DB handle points at it. Every device adapter (NVR, go2rtc, HA bridge, Frigate, intercom, Provision, relays, email/WhatsApp/push senders) is replaced by the fake adapters that already exist for the test-suite (`backend/tests/fixtures/fake_devices.py`, `fake_frigate.py`, `fake_provision.py`, promoted into the package as `services/demo/fakes.py`). Live video comes from packaged sample clips through go2rtc's file source in the `smplwise_demo_` namespace (created on start, deleted on stop; never touching other streams). The real database file is not opened for writing at all during demo mode; the background jobs (sync, thumbnails, derive, backups) are paused for the duration and resumed on exit.

Why not the frontend-only demo (option A): the `SessionMode 'demo'` fixtures cover the screens the tests need, not every settings page, and a prospect walking through the product would hit "במצב הדגמה אין נתונים" gaps; it also cannot show the readiness feature itself, notifications arriving, or a ticket flowing through a department. Option A remains the cheap fallback if the owner wants a demo in 2.13 rather than 2.14 (question 1).

### 2.3 White-label

Settings keys (installation-level, `settings` table): `brand.company_name`, `brand.short` (≤ 2 letters for the rail tile when there is no logo), `brand.logo` (bool - the file is `<data>/brand/logo.{png,svg}`, ≤ 512 KB, square), `brand.accent` (reuses `ui.accent` from `brand_colors.py`, so the existing contrast check applies), `brand.support_phone`, `brand.support_email`, and the placement switches `brand.show.login`, `brand.show.rail`, `brand.show.pdf`, `brand.show.messages` (all true by default once a name is set). Read by the shell through `/me` (`brand: {...}`) and by a public `GET /brand/logo` (cacheable, no auth, no data besides the image - the login page needs it before sign-in).

## 3. Permissions

- Readiness page, "בדוק הכול", the handover attestation, demo start/stop/extend, the brand settings: **`system.configure` at installation scope** (the same as the wizard and `/settings`). No new permission key.
- The readiness **score chip** on the settings tab and the setup hint (`shell/setup-hint.ts`) extend to "ההתקנה מוכנה ב-76%" for the same holders only.
- The demo **banner** is shown to every signed-in user, including viewers: anyone looking at the box must know the data is fake. The off-switch inside it is `system.configure` only.
- Demo mode is refused when the request arrives over the remote channel (`remote_channel.py`): it is a local, in-person tool. Owner question 2.
- Audit (`audit_log`): `readiness.handover`, `demo.start`, `demo.stop`, `demo.expire`, `brand.update`, `brand.logo.upload`, `brand.logo.remove`.

## 4. UX (the mockup)

Readiness page = the product's page head (h1 + subtitle "הבדיקות קוראות בלבד מהמכשירים · נבדק לפני …" + actions "מצב הדגמה", "דוח מסירה", "בדוק הכול"), a hero panel with the score ring, the level, the three-band scale and the gate chips, the KPI row as filters (בדיקות / חסמים / דורש השלמה / תקין / ממתין לאישור / לא רלוונטי), the checklist (one row per check: status disc, title, solid state badge, "קריטי" chip, "נמדד / מאושר ידנית" tag, the measured sentence, the points, the progress bar, the fact chips and the one next-step button; a blocker's button is the primary one), the side column "הצעדים הבאים" (ranked, "+8" = score gain), "מסירה ללקוח" and "היסטוריה". States: new installation (empty panel pointing at the wizard), loading skeleton, error, forbidden. Phone: the hero centres, the side column stacks under the list, the bottom bar replaces the rail.

Demo mode = a full-width warning strip above the shell on every screen ("הדגמה · הנתונים מדומים · פעולות למצלמות, לדלתות ולמכשירים חסומות · מסתיים אוטומטית בעוד 3:42 ש׳ · יציאה מההדגמה"), the rail tile striped with a "הדגמה" label, the status dot amber, the existing "נתוני הדגמה" pill in the user menu. The start dialog: three datasets, duration (1 h / 4 h / until exit, max 24 h), who sees (all users), the warning text, "הפעלה ויציאה נרשמות באודיט".

White-label = two columns: the form (company name, short name, logo file row, service phone/email, the accent presets with the contrast note) and "איפה מופיע" switches; opposite them a live preview (rail tile, login card with "מופעל על ידי SmplWise Arx", PDF footer, email sender line) and "מה נשאר קבוע". Operator screens stay clean: the only visible change outside Settings is the logo/name where the switches allow it.

## 5. API contract (all under `/api/v1`)

```
GET  /readiness                      -> { score, level, gate: {handover_ok, blockers[]}, checks[], history[], checked_at }
POST /readiness/check                -> recompute all computed checks (rate-limited like the wizard: once per 30 s)
POST /readiness/check/{id}           -> recompute one
PUT  /readiness/attest/{id}          -> { done: bool, note, customer_name?, printed_guide? }   (configured checks only)
GET  /readiness/report.pdf           -> the handover report (Noto fonts, the brand footer)

GET  /demo                           -> { active, dataset, started_at, started_by, expires_at }
POST /demo/start                     -> { dataset, hours }     409 when active, 403 over the remote channel
POST /demo/extend                    -> { hours }              cap 24 h from start
POST /demo/stop

GET  /brand                          -> the brand.* keys
PUT  /brand                          -> partial update, contrast-checked accent (422 on failure)
POST /brand/logo  (multipart)        -> 413 over 512 KB, 415 unless png/svg; SVG sanitised (no script, no external refs)
DELETE /brand/logo
GET  /brand/logo                     -> public image, ETag, 404 when none
```

`/me` grows `readiness: {score, level}` (configure holders) and `brand: {company_name, short, logo: bool, accent, show: {...}}`, `demo: {active, expires_at}` (everyone).

## 6. Privacy: nothing leaves the installation

Readiness reads only the installation's own database and the read-only probes the wizard already performs; the report PDF is generated locally. Demo mode's dataset is packaged with the add-on; it contains no customer data and no real network addresses (the lab rule of `CLAUDE.md` applies to the fixture authors). The brand logo is stored under `<data>/brand/` and served only by this box. No check, score or brand value is sent anywhere; there is no "report to the vendor" switch in this CR.

## 7. Demo-mode safety

- **Cannot write to real devices or data:** the real DB is not opened for writing; every adapter is the fake one; the device-write guard (`mode.demo` checked in `rbac.authorize` before any physical action) refuses with a dedicated error even if an adapter were wired by mistake; notification senders are the fakes; the push/email/WhatsApp outboxes are not drained. Covered by the tests in section 9 as the first slice.
- **Clearly marked:** the banner on every screen for every user, the striped tile, the amber system dot, the user-menu pill, the PDF watermark "הדגמה" on anything printed during demo mode.
- **Off-switch:** the banner button (configure holders), `POST /demo/stop`, and the automatic expiry (default 4 h, hard cap 24 h) run by the scheduler; a restart of the add-on also exits demo mode (the flag is cleared on boot). Exit restores the real DB handle, resumes the paused jobs, deletes the `smplwise_demo_` go2rtc streams.
- **Not over remote access**, not while a backup or restore runs, not while the self-updater runs.

## 8. White-label limits

- Allowed: the installing company's name, short name, logo, one accent from the existing presets (or a custom hex that passes the existing contrast check), service phone/email; the placements of section 2.3.
- Must remain: the product name and version in "עדכונים", "אודות", the release notes, the "הופק ב-SmplWise Arx x.y.z" line and the PDF/file metadata creator; "מופעל על ידי SmplWise Arx" on the login card (small, below the installer's name); the security and sign-in copy; the system documentation.
- The **no-HA-branding rule** (`docs/design/UI_COPY_RULES.md`) is unchanged: white-label adds the installer's identity, it does not add the infrastructure's.
- **No impersonation:** the logo and name must be the installing company's own; the settings screen says so and the handover report prints the company name as entered. The product does not ship third-party vendor logos, camera-maker skins or "looks like X" themes, and the tickets public pages keep their own brand (`tickets.settings.brand`), which may be filled from this one by a button, not merged.
- One brand per installation; the customer's own name is not a brand field (it is the handover's customer name).

## 9. Data model and migration

One migration file, **PROVISIONAL 0153** (renumbered at integration; the branch's highest file is 0145, the 2.13 integration decides the final number):

```sql
-- CR-READY96 (docs/changes/CR-READY96.md): the readiness attestations and the score history.
-- Project-backup tables (they describe the installation). Additive only; rollback = run the previous version, the tables are ignored.
-- PROVISIONAL 0153 (pilot/READY96-295); final number at integration.
CREATE TABLE readiness_attestations (
  check_id    TEXT PRIMARY KEY,             -- 'handover' | future configured checks
  done        INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  payload_json TEXT,                        -- customer_name, printed_guide, ...
  user_id     INTEGER NOT NULL REFERENCES users(id),
  updated_at  TEXT NOT NULL                 -- UTC ISO-8601 Z
);
CREATE TABLE readiness_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  score       INTEGER NOT NULL,
  level       TEXT NOT NULL,
  blockers_json TEXT NOT NULL,              -- the critical check ids below 1.0
  checks_json TEXT NOT NULL                 -- {id: {status, fraction}} for the report trend
);
CREATE INDEX idx_readiness_history_at ON readiness_history (at);
```

Demo state and brand values are `settings` keys (section 2); the logo is a file. No schema for the demo dataset: `demo.sqlite` is built from the packaged JSON by the same migrations as the real DB, so it never drifts.

## 10. Test plan (T-numbers assigned in `management/test_catalog.json` at slice 1)

- Unit, readiness: each check's predicate against seeded DBs (`conftest.seed_tree`); the score formula and the gate; not-applicable renormalisation; the next-step ordering; the history row only on change.
- Unit, demo safety (first): with `demo.active`, every device adapter resolves to a fake; a forced NVR/PTZ/door/HA call raises the demo guard; the real DB file's mtime is unchanged across a demo session that edits settings, opens tickets and runs automations; expiry and boot clear the flag; remote-channel start is 403.
- Unit, brand: logo size/type limits, SVG sanitiser (script, `xlink:href`, external url rejected), contrast 422, `/brand/logo` public and ETagged, `/me` payload.
- String specs: the UI copy of the three screens passes `unit-*-strings` (no infrastructure names outside `screens/system-*`).
- Frontend evidence specs: readiness ready/empty/loading/error/forbidden at 1366/375 light+dark; the banner on three unrelated screens; the brand preview updates; the rail tile with and without a logo.
- Live (owner's lab, read-only): readiness computed on the real installation and compared by hand with the wizard and the health report; demo start/stop with the real go2rtc, confirming only `smplwise_demo_` streams were created and removed.

## 11. Slices and estimates

| slice | content | estimate |
|---|---|---|
| S1 | `services/readiness.py` + routes + migration + the page (`screens/system-readiness.ts`) with computed checks only, the score chip on the tab | 2 days |
| S2 | handover attestation, history, the PDF report, the setup-hint extension | 1 day |
| S3 | demo safety core: DB switch, fake adapters promoted, guard, expiry, audit, banner, start dialog; the residential dataset | 3 days |
| S4 | the office and retail datasets, sample clips, the demo streams in go2rtc | 1.5 days |
| S5 | brand settings + logo + `/me` + rail/login/PDF/email placements + the page | 1.5 days |

S1, S3 and S5 are independent (three agents); S2 after S1, S4 after S3. Target: S1+S5 in 2.13.x, S2-S4 in 2.14.0 (question 1 may pull a frontend-only demo forward).

## 12. Risks

- The readiness predicates must not be stricter than the product can satisfy (e.g. "verified" needing a recording on a camera the customer records only on motion): every check prints its facts so a false "attention" is explainable; the weights table is the one place to tune.
- Demo mode's DB switch touches the request path; done wrong it could serve demo rows to a real session or vice versa. Mitigation: one handle factory, one flag, the mtime test, and the boot-time clearing.
- A logo SVG is executable content: sanitised on upload and served with `Content-Security-Policy: sandbox` and `image/svg+xml` only.
- Scope creep towards an installer portal: out of scope by section 1.

## 13. Owner questions (recommendation first)

1. **Demo mode depth.** (א) Backend demo with its own database and fake adapters (section 2.2, 2.14.0) - **recommended**, it is the only one that survives a real walkthrough of Settings and tickets. (ב) Frontend-only demo reusing the existing fixtures, forced by a server flag, in 2.13.x; gaps remain. (ג) Both: ב now, א later.
2. **Demo over remote access.** (א) Never - **recommended** (a prospect is in the room; a remote demo on a customer's live box is how real data gets shown by mistake). (ב) Allowed for the installer's own box only (`demo.allow_remote` setting).
3. **Weights and the handover gate.** (א) The table in section 2.1 and the 90 + no-critical gate - **recommended**. (ב) The owner adjusts weights or the threshold now. (ג) Make the weights editable in Settings (not recommended: two installers would argue with the score).
4. **White-label placements.** (א) Login, rail, PDF, email sender, with "מופעל על ידי SmplWise Arx" kept on the login card - **recommended**. (ב) Also the browser tab title and the PWA name (changes the installed app's name on phones; needs a manifest per installation). (ג) Login and PDF only.
5. **Who may brand.** (א) `system.configure` (the installer during setup, the customer's administrator later) - **recommended**. (ב) A new `brand.manage` key so the customer cannot change the installer's brand (adds a key for one screen; the handover report already records who branded).
6. **Readiness for the customer.** (א) Same permission as the wizard (configure holders) - **recommended**. (ב) A read-only readiness card on the home screen for every manager, so the customer sees "76%" without entering Settings (contradicts the clean-operator-screens rule unless hidden after handover).

## Owner review 24.10 decisions

Source: the owner's review of the mockups, 2026-10-24 (`private/planning/OWNER_MOCKUP_REVIEW_2026-10-24_raw.txt`, item 11). Question numbers below are those of the review form; where they differ from this document's own question list the matching section is named. Recorded as the owner's decisions; the build follows them.

Mockup approved with these answers:

- **Handover threshold (form Q2; this document's Q3):** the score 90 and no blockers is **advice only**: the installer **can hand over earlier**; the threshold never blocks the handover.
- **Demo depth (form Q3; this document's Q1):** **full** - a backend demo with its **own separate database** and fake adapters (option א).
- **Remote demo (form Q4; this document's Q2):** over remote access the demo is allowed **only on the installer's own server** (option ב); the **owner may run the demo from anywhere**; permission to start it is for the **system installer** only.
- **Double branding (form Q6):** **yes - branding lives in the logos mockup only**: the branding tab of the readiness screen is removed here (the placement of the installer's and the product's logos is decided in the logos change, not in this one; section 2.3 white-label follows it).
- **Readiness for the customer (form Q7; this document's Q6):** shown **only to whoever configures the system** (the wizard's permission holders, option א); no readiness card for other managers.

## Slice 1 as built (pilot/READY96B-295, from release/2140)

Built on the owner decisions above. What is in and what is deliberately not (so the next slice starts from facts, not from this document's plan).

**Backend.** `services/readiness.py` + `routers/readiness.py` (`GET /readiness`, `POST /readiness/check` once per 30 s per user, `PUT /readiness/attest/handover`, `GET|PUT /readiness/settings`);
`services/demo_mode.py` + `routers/demo.py` (`GET /demo`, `POST /demo/start|extend|stop`, `PUT /demo/settings`); migration **0159** (built as provisional 0152; renumbered at the 2.15.0 integration, release/2150) (`readiness_attestations`, `readiness_history`; not backup tables).
- Eleven checks: ten computed (cameras connected / verified, floors and placements, people, notification channels, backup, remote access, time zone, integrations from the cached health report, the tickets module) and one configured (the hand-over). Score, level, critical blockers, next steps ordered by the points they add, history rows only when something moved.
- **Hand-over = advice only**: `attest` never refuses; a hand-over below the advice (score under it, or a critical check below 1.0) is stored and audited with `below_advice`; the page says so before the click.
- **Every threshold and every weight is a `readiness.*` setting** (advice score, "almost" band, camera freshness hours, backup age days, notification window days, history size, one weight per check; weight 0 removes a check from the denominator). Validated, confirmed, audited; the "almost" band must stay below the advice score.
- **Permissions:** the page, the check, the attestation and the thresholds are `system.configure` at the installation and nothing else (no readiness card for other managers; `/me` carries the last recorded score for configure holders only). `demo.run` and `demo.run_anywhere` are **sensitive permissions in no built-in role** (default off, like `messaging.pacing.reserve`): the system installer is whoever an administrator gives a custom role naming `demo.run`.
- **Demo = a separate database:** `<data>/demo/demo.sqlite` built from all migrations, the people and their bindings copied (a snapshot, so nobody gains or loses a permission; Arx-only identities are signed out for the duration), then a synthetic dataset (`residential | office | retail`; scenarios `normal | cameras_offline | new_installation`). The one shared `Database` handle is pointed at it (`Database.switch_path`), so requests and workers follow at once; start and stop are audited in the REAL database before / after the switch. Over the remote channel a demo starts only where the installer switched `demo.allow_remote` on (that server) or for a holder of `demo.run_anywhere` (the owner). A restart exits demo mode (the demo folder is deleted at boot); the janitor ends an expired demo (default 4 h, cap 24 h from the start) and skips the real housekeeping while one runs.
- **Physical-action guard:** while the handle is in demo mode `rbac.authorize` answers `demo_mode` for device-control, door, alarm, media, NVR, update, backup, role and messaging-send permissions (`demo_mode.BLOCKED_EXACT` + the `nvr.` prefix), ahead of any binding.

**Frontend.** `screens/system-readiness.ts` (tab "מוכנות" after the wizard, `system.configure`): hero with the score ring and the advice wording, KPI filters, checklist rows with the one next-step link, next steps with "+N", the hand-over card, history, the thresholds dialog (every setting), the demo dialog (needs `demo.run`). **The page never scrolls**: the header, hero and filters keep their height; the checklist and the side column scroll inside their panels; on a phone a three-way pane switch shows one pane at a time. `components/sw-demo-banner.ts` (every signed-in user while a demo runs; extend / exit only with `demo.run`) and the striped rail tile. No branding tab (owner decision: branding lives in the logos change).

**One screen with FLEET (CR-FLEET215).** This slice does not touch `pilot/FLEET215-295`, which branched from main and carries its own `services/readiness.py` (14 items, report block) and `services/demo_mode.py` (a constant example dataset) on migration 0149. At integration the fleet report must read `readiness.evaluate()` of this slice (one score, one list, one page) and its constant-dataset demo is replaced by this demo; the two modules share file names, so the merge is a rewrite of the fleet side, not a textual merge. Open item for the lead.

**Not built in slice 1 (stated, not hidden).**
- The fake device adapters of CR section 2.2 are not swapped in for the background workers: while a demo runs a worker that reads a real device writes what it read into the DEMO file (it never writes to the real file); real-device WRITES are stopped by the permission guard above, not by fake adapters.
- Datasets are minimal (site, floors, a recorder, cameras); no tickets, meters, schedules or notifications seed; no go2rtc `smplwise_demo_` sample streams; no PDF watermark; no hand-over PDF report; the history chart is a list.
- Module checks cover the tickets module only; the technician flag test of the `people` check and the thumbnail / recording-coverage proof of `cameras_verified` are replaced by "seen within N hours" (`cameras.last_seen_at`); the backup check reads "a password-sealed archive exists" instead of the password itself.
- ~~The score chip on the settings tab is not drawn~~ - now drawn: a small score pill after "מוכנות" in the settings navigation (`system-nav.ts`), toned by the level, fed by `/me.readiness` and refreshed by the page after a load, check or hand-over (`api/readiness.ts` chip store). Locally verified by tsc and unit only; the visual (screenshot / no-scroll) evidence of the nav with the chip is NOT_RUN (runner busy).

### Slice 1 test evidence (runner, branch head before this note)
- Backend `tests/test_readiness_96.py`: 21 passed. A 41-file selection around rbac, roles, /me, janitor, backup, health, setup wizard, quiet windows, water, release check: 1013 passed. The FULL backend suite was started and stopped at ~10% (hours on the loaded runner): NOT_RUN to completion.
- Frontend: `tsc` ok (local and runner); `unit-readiness-96` + `unit-settings-index` 12 passed locally; `evidence-readiness-96` (18, incl. no page scroll at 1366x768 / 1024x768 / 768x1024 / 390x844 / 320x640, light + dark, 20 extra checks) + `evidence-nav-size` + `evidence-nn1-p2`: 47 passed. The whole unit/evidence/layout suites were NOT run. No live (real lab) run, no visual-diff matrix run.
- Migration 0152 was PROVISIONAL and collided with 0152_infra_water_alerts on release/2150: renumbered to `0159_readiness.sql` at the 2.15.0 integration.
