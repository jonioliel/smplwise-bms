# WisKey native screens - mockup gallery (CR-036 slice S5)

Static mockups of the stage-1 native access-control screens (`docs/changes/CR-036-WISKEY-NATIVE-SCREENS.md`, owner answers of
2026-10-11). Design only: no product code, no migration, no device or integration access. Fake data only (an invented office
building, invented stations, invented people and events). Branch `pilot/WISKEY-screens-design`. The decision record is
`docs/design/WISKEY_SCREENS_DESIGN.md`.

Open `index.html` (Hebrew review index: one link per screen and state, the owner questions) or `gallery.html` directly. The gallery
bar picks the screen, the width (1440 / 820 / 390), light or dark, the skin (classic, crystal, domus, tesla, bubble), the view
(cards / list / table), the state (ready, loading, empty, error, station scope, stale), the identity (site admin, operator, viewer),
the detail drawer and the dialogs. The state is kept in the URL hash (`#s=people&d=phone&t=dark&k=crystal&id=operator&dr=1`).

Files: `styles.css` is the token sheet (section 1 copied from the generator mockup, itself from `frontend/src/design/tokens.ts` and the
four skins; section 1c adds the Crystal skin from `frontend/src/design/skins/crystal.ts` and the DU1 tiers); `wk.css` holds the
screen classes, every one on `--sw-*` tokens; `app.js` renders the five screens. Heebo comes from `../bubble-taste/fonts.css`.

Screens: תחנות ודלתות (stations and doors) · אנשים (people, names only; the sensitive block is a separate gated section) ·
פעילות (events with filters, detail drawer, audited export) · לוחות זמנים (door programs, hold-open windows, device schedules,
read-only) · הגדרות › בקרת כניסה (status, the intercom window's own audit, groups and fields, the per-screen display switch).

Rules applied: Hebrew RTL; Arx tokens and skins, light and dark; clean operator screens (no hint paragraphs, no badges, short
confirmations, management only in Settings); no platform name outside Settings (the iframe is "חלון האינטרקום", the platform is
"תשתית המערכת"; "WisKey" appears only on the Settings screen); the floors / areas tree with per-floor collapse where a screen lists
stations or doors; list, card and table views; 44 px targets on the phone; one focus rule; a door command is "נשלח" (sent), never
"opened"; a station outside the operator's scope is omitted from lists and a direct link to it shows a calm placeholder, never
partial data; fields the operator may not see are absent, never greyed.

Screenshots: `docs/design/evidence/wiskey-screens/` (Playwright over the static gallery, `<screen>[-variant]-<skin>-<scheme>-<width>.png`).

Round 2 (2026-10-11, owner feedback): the stations screen was redesigned - invented entrance scenes stand in for the station
stills (`scene()` in app.js; the product uses the real go2rtc still), name on a scrim, call state with durations and answer /
decline / end, a push-to-talk control with five states (`talk=`; stage 1 ships only "דיבור בלוח הקלאסי" until the audio hook W10),
an announcement (TTS) composer (`dlg=announce&ann=`), per-door hold state, the drawer's "שידור חי בלוח הקלאסי" slot. The people
screen gained a WhatsApp composer (`dlg=wa&wa=`), a messages history, and a bulk send (`sel=1`, `dlg=wabulk`).

ASSUMPTIONS (marked W? in the ADR): the shapes of `stations/technical_relays`, `technical_program_list`, `technical_hold_get`,
`schedules/*`, `health/get`, `sync/status`, `fleet/alerts`, `audit/list` are not delivered (CR-036 ask W2); the schedules and
status screens are drawn from the static catalog's field names and the WisKey panel's own screens, and must be re-checked against
the real shapes before slice S9 / S10 claims parity.
