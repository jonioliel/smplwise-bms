# DOCS-GUIDE-REFRESH-2500 - user documentation brought up to 2.40.0 .. 2.48.0 and the 2.49.0 train

Docs only (plus one line in `scripts/build_guide.py`). Branch `pilot/DOCS-GUIDE-REFRESH-2500` from `origin/main` d6f09395e (v2.48.0).

Sources: `smplwise_vms/CHANGELOG.md` (2.40.0 .. 2.48.0 on main, 2.49.0 from `origin/release/2490-train`), the change notes of those
versions (HOME-SIMPLE-2420/2421, HOME-V3-P1..P3, I18N-EN-SWITCH-2438, CR-LOCAL-USER-CREATE-2438, CR-LOCAL-ID-SWITCH-2442,
CAMERA-REBOOT-2407, WXH4-EMERGENCY-REVOKE-2407, BUBBLE-FREEZE-295, TICKETS-PAGING-2490, GEN-UNITS-FIELD-2490, I18N-BACKEND-2490),
`git log v2.39.1..origin/release/2490-train`, and the code where a note was unclear (setting keys and defaults in
`services/settings_store.py`, `services/home_interface.py`, `services/presence.py`, `services/building_scope.py`; labels in
`shell/sw-user-menu.ts`, `shell/sw-lang-prefs.ts`, `home/sw-home-admin.ts`, `home/sw-home.ts`; frozen skins in `design/skins/index.ts`).

Not documented on purpose: anything only on pilot branches (the second-factor / step-up work is not shipped and is left out; the
existing "Optional second factor (TOTP)" section describes the older shipped feature and is unchanged). No lab addresses, serials,
MACs, hosts or anything from `secrets/` / `private-evidence/`. Operator chapters name no platform brand ("the home system").

## Sections changed and why

### `smplwise_vms/DOCS.md` (English add-on store docs)

| Section | Change | Why |
|---|---|---|
| NVR-less mode | new bullet "Cameras without a recorder (2.41.0 and later)" | the "what is hidden" bullet was no longer the whole truth since 2.41.0/2.41.1 |
| Identity and access | new bullets "Arx users" (2.43.8 switch on the tab, password set by the administrator) and "Home only" | "users are Home Assistant users" was incomplete since Arx users and the home-only restriction shipped |
| Live video | new bullets: video source per camera (2.41.0), choosing the video service and the notice delay (2.43.0, 2.43.5), stream sync (2.43.4), camera reboot (2.40.7) | missing shipped features |
| Tabs, home screen and other settings | new paragraphs "Look and lists" (Domus default, selected chip, `ui.long_lists`) and "Start-up warm-up" (`server.startup_warmup`) | missing shipped settings |
| The home interface (new) | what it shows, switch safety, per-person and installation settings (`home.default_mode`, `home.kiosk_exit`, `home.wallpaper`), guest invitations, personal choices, moving between interfaces, wall panel, install notes | 2.42.0 .. 2.43.8 had no section |
| Interface language (new) | where the switch is (My account › Language › Interface language, `ui.lang`), what is English in 2.43.8 / 2.43.9 / 2.44.0 / 2.49.0, default names, settings search, limits | missing |
| Calendars, presence and several buildings (new) | a short map of the shipped modules with their default state and where they are switched on | the task named them; DOCS.md had no section (shipped 2.31.0 .. 2.36.0, presence default style 2.40.0) |
| Releases 2.40.3 to 2.43.8 (new) | restarts, migrations and a per-version summary | gap between the 2.6.4..2.11.0 and 2.43.9..2.45.0 sections |
| Releases 2.46.0 and 2.47.0 | "Generator settings keep their units in the labels" -> "kept ... until 2.49.0" | now wrong after 2.49.0 |
| Releases 2.48.0 and 2.49.0 (new) | per-version summary, how to keep the scroll in the tickets table | missing |

### `smplwise_vms/DOCS_HE.md` (Hebrew add-on store docs; says the same as DOCS.md)

| Section | Change | Why |
|---|---|---|
| מצב ללא NVR | "התקנה לחשמל בלבד" and "הוספת NVR בהמשך" aligned with the English (the NVR is set in Settings › Connections / the wizard since 0.1.159, not the `nvr_host` option); the dead link "להגדרות ה־Add-on" -> "להגדרות › חיבורים"; new bullet on cameras without a recorder | wrong (described the pre-0.1.159 option flow) and missing 2.41 |
| זהות וגישה | Arx users and home-only bullets | as English |
| וידאו חי | the four new bullets | as English |
| לשוניות, מסך ראשי והגדרות נוספות | "מראה ורשימות" and "טעינה מוקדמת בהפעלה" | as English |
| הממשק הביתי, שפת הממשק, יומנים נוכחות וכמה בניינים (new) | Hebrew of the three new English sections | as English |
| גרסאות 2.40.3 עד 2.43.8, 2.43.9 עד 2.45.0, 2.46.0 ו-2.47.0, 2.48.0 ו-2.49.0 (new) | Hebrew of the English release sections; the 2.43.9..2.47.0 ones existed only in English | the Hebrew docs stopped at 2.11.0 |

### `docs/user-guide/he/` (Hebrew user guide)

| File | Change | Why |
|---|---|---|
| `15-whats-new-2403-2438_HE.md` (new) | what is new in 2.40.3 .. 2.43.8, Hebrew then English, in the 16/17 table format | gap between pages 15 and 16 |
| `18-whats-new-2480-2490_HE.md` (new) | what is new in 2.48.0 and 2.49.0, Hebrew then English | missing |
| `23-home-interface_HE.md` (new) | the home interface: screens, safe switch-off, every user's choices, the administrator's three sub-tabs, notes; Hebrew then English | no page existed |
| `00-INDEX_HE.md` | rows 2ה0, 2ה3 and 4ב for the three new pages | index |
| `10-getting-started_HE.md` | My account now lists "Language" and the "to the home interface" menu row | missing |
| `22-realistic-3d_HE.md` | new section "מה חדש בתלת־ממד בגרסאות 2.43.1 עד 2.43.8" (realistic look, reflections setting, zoom, room pills, room card, building / spread, the eight 3D settings, round-32 answers, new plan from a picture) | missing |
| `30-cameras_HE.md` | new section on cameras without a recorder, video source per camera, the video service choice and notice delay, stream states, camera reboot, recorded-days calendar | missing |
| `44-generator_HE.md` | units inside the field (2.49.0); recipient / channel choosers are check boxes again (2.48.0) | missing |
| `46-tickets_HE.md` | new section "טבלת הקריאות בעמודים" (2.49.0) and how to keep the scroll | missing |
| `47-identity-users_HE.md` | Arx users: the state row and "המצב" no longer say the switch is in Settings › Security and "not meant to be enabled"; new "מה השתנה ב-2.43.8" (switch on the tab, create works, password by the administrator) | wrong since 2.43.8 |
| `80-settings_HE.md` | new "החשבון שלי › שפה" subsection; new table "הגדרות חדשות בגרסאות 2.40.3 עד 2.49.0" | missing |
| `84-bridge-key_HE.md` | owner contacts heading "עוד לא בגרסה" -> "מגרסה 2.40.5"; "emergency revoke not built yet" replaced by a new section "ביטול חירום של מפתח הגשר (2.40.7)" | wrong: both shipped (WXH-LEFTOVERS-2405 merged in 2.40.5, WXH4 in 2.40.7) |
| `GUIDE_ALL_HE.html` | rebuilt with `scripts/build_guide.py` | generated from the pages |

### `docs/operations/OPERATOR_GUIDE_HE.md`

| Section | Change | Why |
|---|---|---|
| status line | "updated to 2.49.0 (2026-11-24)" with what changed | the guide said it covered up to 2.0.0 only |
| 11. וידאו חי | the no-NVR bullet now says cameras without a recorder show the live screens (2.41); new bullets: video source per camera, the video service choice | wrong since 2.41 / missing |
| 14.2 מראה Bubble | marked frozen (not offered; a stored Bubble shows as Domus) and Domus as the default look since 2.43.8; the old text kept as history | wrong: Bubble is frozen in code (`FROZEN_SKINS = ("bubble",)`) |
| 15. מגבלות ידועות | electricity: manual readings (2.0.3) and time-of-use tariffs exist; the real Israeli time-of-use prices are unverified | "no manual reading / no time-of-use tariff" was wrong |
| 16 (new) | per-version table for 2.40 .. 2.49 (restarts, migrations) and a short "what is new for the operator" list | missing |

### `scripts/build_guide.py`

`23-` added to `OPERATOR_PAGES`, so the new home-interface page is held to the no-branding check like the other operator chapters.

## Checks run (on this workstation; docs only, no runner job)

| Command | Result |
|---|---|
| `py -3.12 -I scripts/build_guide.py` then `--check` | wrote GUIDE_ALL_HE.html; "up to date", exit 0; no branding hits in the operator chapters (23- included) |
| `pytest tests/test_docs_config_consistency.py` (main checkout venv) | 7 passed |
| `pytest test_extid_followups.py::test_the_operator_and_customer_documents_state_the_residual_risks ::test_the_operator_guide_names_no_home_assistant_outside_settings_text test_bridge_key_activation_295.py::test_ha02_the_three_repair_situations_are_documented` | 3 passed |
| grep of the added lines and new files for IPv4 / MAC patterns | none |

NOT_RUN: everything else (no code changed). **Screenshots: NOT_RUN, to be taken on the runner later** (the three new pages and the
new sections carry no images; `screens.json` is unchanged).

## Open points

1. The 2.49.0 sections describe the train as it stands on `origin/release/2490-train` (2.49.0 version bump and changelog present, not
   released yet). If a row is dropped from the train, remove its line from DOCS.md / DOCS_HE.md "Releases 2.48.0 and 2.49.0",
   `18-whats-new-2480-2490_HE.md`, `44-generator_HE.md`, `46-tickets_HE.md` and `80-settings_HE.md`.
2. Nothing here was checked on a live installation; the home interface and the camera pages say so.
