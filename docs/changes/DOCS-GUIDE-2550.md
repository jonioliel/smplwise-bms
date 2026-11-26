# DOCS-GUIDE-2550 - the user documentation brought up to 2.53, 2.54 and 2.55

Row DOCS-GUIDE-2550 (target 2.55). Branch `pilot/DOCS-GUIDE-2550`, based on `origin/release/2550-train` at `5aa03829b`. Documents and
one doc test only: no product code, no setting, no API change.

## Sources read

- `smplwise_vms/CHANGELOG.md` sections 2.53.0 (final), 2.54.0 and 2.55.0 (both still the train coordinator's drafts).
- The change notes behind them: DOCS-ONBOARDING-2530, MFA-T095-REST-2530, WISKEY-A2-EXEC-2530, WISKEY-MEDIA-V2-2530, HOME-SCROLL-*-2530,
  HOME-T120-REST-2530, HONEST-STATES-2540, PHYSICAL-CONFIRM-2540, CONTROLLED-TOGGLES-2540, CLIENT-RESILIENCE-2540, DATA-RULES-2540,
  DST-TIMELINE-2540, TIME-CORRECT-2540, AREA-HONEST-COUNT-2540, CORE-RELIABILITY-2540, LEGACY-MIGRATION-2550, LEGACY-IMPORT-UI-2550,
  PILOT-ROLLBACK-2550, ANDROID-PUSH-2550.
- Not yet on the train at the base, read from their branches because the brief names their admin notes: `pilot/LOWS-BACKEND-2550`
  (SEC-8 off-box administration local-only, D-12 mapping an unmapped area into a building) and `pilot/LOWS-FRONTEND-2550` (new
  confirmations, the room card's "all off" line, the events 500-row banner, audit times in the installation zone, the server-refusal
  sentence, the English dimmer). **These paragraphs describe behaviour that ships only when those two rows merge**; if one of them
  is dropped from 2.55, the matching sentences must go too (they are marked "2.55" in the text; the list is in "Depends on" below).
- Every UI label quoted was checked against the Hebrew source and the English pack at the base (`frontend/src/...`).

## What changed

### New guide page

`docs/user-guide/he/19-whats-new-2530-2550_HE.md` - Hebrew, then English (as `18-whats-new-2480-2490_HE.md`): after the update (the new
version card), the new settings table (where, what it changes, default, who), what users will notice (honest unknown states,
confirmations before physical actions, outcomes without an answer, controlled switches, the update notice, offline behaviour, the
step-up dialog's life, generator mute rules and the battery system, the billing cycle rule and automatic drafts, DST, recurring
cancel, home screen fit, smaller items) and the administrator notes (legacy import, off-box administration from the local network
only, mapping an area into a building, Android push via UnifiedPush - off by default with the owner's four steps, the rollback
runbook, the WisKey media v2 switch without a screen). Plain language, no internal codes, no platform branding: the page is added to
`OPERATOR_PAGES` in `scripts/build_guide.py`, so the branding check guards it.

### Existing guide pages (Hebrew)

- `00-INDEX_HE.md`: row 2ה4, and 19 in the list of operator chapters.
- `23-home-interface_HE.md` (he + en): "my account", unknown lock / alarm state, air conditioners, late answers, the English dimmer.
- `44-generator_HE.md`: mute rules (critical: generator management, 4 hours), "End the mute", the late notification, the 12 / 24 V
  battery rule; the audit line.
- `60-backup_HE.md`: rollback picks the "before upgrade <previous> -> <new>" backup + the runbook; the legacy import (8א); off-box
  administration from the local network only (8ב); backups no longer block writes, "storage full" (8ג).
- `80-settings_HE.md`: the backup tab table (import, off-box), the support tab rewritten for 2.53 (it still described the removed
  placeholder), and "הגדרות חדשות בגרסאות 2.53.0 עד 2.55.0" with every key and default.
- `83-updates_HE.md`: open pages after an update (the card, "Later"), going back to the previous version.
- `85-notifications_HE.md`: approve on the phone (content-less notice), water draft ready, generator late notification, Android
  without Google.
- `95-troubleshooting_HE.md`: items 19-25 (amber "unknown", grey unknown lock / panel, "no connection - your sign-in is kept", a switch
  that went back, the new-version card, "storage full", off-box refused over remote access).
- `GUIDE_ALL_HE.html` rebuilt (`scripts/build_guide.py`).

### Add-on documentation (`smplwise_vms/DOCS.md`, `DOCS_HE.md`)

- "Data and backups": the rollback backup rule + runbook, the legacy import, off-box administration local-only (403 `offbox_local_only`).
- "Phone app push without Google": the owner steps (push server choice, the option, restart the add-on - not the home system -, the
  distributor on each phone, how to turn it off).
- "Calendars, presence and several buildings": the mapping rule for an area that belonged to no building.
- New closing section "Releases 2.53.0 to 2.55.0: what changed for users" / "גרסאות 2.53.0 עד 2.55.0: מה השתנה למשתמשים": the settings
  table with keys and defaults, the 2.54 behaviour list, 2.55, admin notes.

### Test

`smplwise_vms/backend/tests/test_docs_settings_2550.py` (new). The project's only settings-to-docs map was
`test_docs_config_consistency.py` (add-on options only; `unifiedpush_servers` was already covered there by ANDROID-PUSH-2550). The new
file maps the 2.53-2.55 installation settings, the user preference and the option to the documents: each key named in backticks in
DOCS.md, DOCS_HE.md and `80-settings_HE.md`; the default in code equal to the documented one (`settings_store.DEFAULTS` for
`onboarding.enabled`, `security.push_approval`, `security.step_up_alarm_pin`, `access.station_media_direct_v2`;
`wiskey_schedule_execution.SWITCH_KEY`; `user_prefs.VALIDATORS["onboarding.dismissed"]`; `config.yaml` for `unifiedpush_servers`); and
the guide page names the settings and carries the owner steps in both languages. A later version's setting is added to `NEW_SETTINGS`.

## Tests (PC, real runs)

| Command | Exit | Result |
|---|---|---|
| `pytest -o addopts="" tests/test_docs_settings_2550.py` (main checkout venv) | 0 | 11 passed |
| `pytest -o addopts="" tests/test_docs_config_consistency.py` | 0 | 7 passed |
| `pytest -o addopts="" tests/test_tickets_naming.py` (reads the guide folder) | 0 | 488 passed, 1 skipped |
| `pytest -o addopts="" tests/test_extid_followups.py` (reads DOCS / DOCS_HE / the guide) | 0 | 20 passed |
| `py -3.12 scripts/build_guide.py --check` | 0 | up to date, no platform branding in the operator chapters (19 included) |
| `py -3.12 -m ruff check tests/test_docs_settings_2550.py` | 0 for the new file | the three hits are old lines of `scripts/build_guide.py` under the workstation's newer ruff (RUF059, RUF100, FURB167), not touched |

NOT_RUN: the full backend and frontend suites (no product code changed); the runner; any lab check. The documents were written from the
change notes and the code, not from a live installation (each page says so).

## Depends on

- `pilot/LOWS-BACKEND-2550`: off-box administration local-only (19 page, 60, 80, 95, DOCS / DOCS_HE "Data and backups"), mapping an
  unmapped area into a building (19 page, DOCS / DOCS_HE "several buildings").
- `pilot/LOWS-FRONTEND-2550`: the confirmations before revoking a role / deleting a water price version / a scheduled temperature
  report, the room card's "all off" line, the events 500-row banner, audit times in the installation zone, "the server refused the
  request", the English dimmer (19 page, 23, DOCS / DOCS_HE "2.55.0").
- Not covered (no change note on their branches yet): `pilot/DATA-RULES-2-2550`, `pilot/HA-STATE-RECONCILE-2550`,
  `pilot/HOME-FIT-FOLLOWUPS-2550`, `pilot/HOME-PERMS-WARN-2550`, `pilot/LOWS-BRIDGE-GATE-2550` (bridge 0.10.10 - the 19 page leaves the
  2.55 restart question to the release notes).

## Open questions (recommendation first)

1. The rows above without a change note: a) a short follow-up to this page once they merge (recommended); b) the lead adds them in the
   final release text only.
2. An English file per new guide page (like `docs/user-guide/en/71-...`): a) no, the what's-new page carries both languages as
   18-whats-new does (recommended); b) yes, split it.
