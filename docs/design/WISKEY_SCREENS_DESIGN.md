# WisKey native screens - design record (CR-036 slice S5) - 2026-10-11

Status: DESIGN PROPOSAL for the owner's review. Branch `pilot/WISKEY-screens-design` from `origin/main` 02a175f3 (2.4.5).
Design only: no product code, no migration, no device, integration, token or secret was touched. Nothing was run against a live
WisKey, HA or station; every live behaviour below is NOT_RUN. This is the Design ADR DESIGN_CONTRACT.md asks for ("intentional
visual changes get a Design ADR") for the five stage-1 screens of `docs/changes/CR-036-WISKEY-NATIVE-SCREENS.md` (binding plan,
owner answers of 2026-10-11 at its end).

Deliverables: the mockup gallery `docs/design/mockups/wiskey-screens/` (`index.html` review index, `gallery.html`, `app.js`,
`wk.css`, `styles.css`), 139 Playwright screenshots in `docs/design/evidence/wiskey-screens/` (round 2), and this record.

Evidence marks, as in CR-036: **V** read in code on 02a175f3; **R** stated by a document; **W?** WisKey behaviour or shape that
nobody verified; **D** decision of this record.

## 1. What the owner decided and how the design reads it

| Owner answer (CR-036 section 9, 2026-10-11) | Design consequence |
|---|---|
| 1 = A: stage 1 is stations and doors, people, events, plus the status page and the groups view in Settings | Five screens designed here; "מרכז הכניסה" (overview) keeps its current native screen and only takes the shared header and the display switch |
| 2 = B: new writes allowed now, through the service identity, Arx RBAC + Arx audit as the only controls | Stage-1 screens stay read-only except the existing door / call / TTS / people writes; the write phase (S15 + S16 merged) reuses the same drawers: every drawer has a footer slot for its write buttons so no screen is rebuilt later (section 4.3) |
| 3 = B: operators see names only; employee number, portraits, contact data only with `access.people.sensitive` | A separate "פרטים רגישים" section in the person drawer and the event drawer, absent (not greyed) without the permission; employee number is never in the default list; the table's employee-number column and the search-by-number placeholder exist only with the permission |
| 4 = A: screen by screen after the side-by-side check; the iframe stays selectable per screen | Settings › בקרת כניסה › תצוגה is the home of the switch (one toggle per screen with its verification state); each operator screen carries an admin-only header control that leads to the same choice (section 3.6, question 1) |
| 5 = A: two-way audio and live station video stay in the iframe | Round 2 (owner feedback 2026-10-11): the station card and drawer carry the full call state (ringing / in call with duration, answer / decline / end) and a TALK control whose stage-1 state is "unavailable": it opens the station in the classic panel until the audio hook (W10) lands; the drawer's live slot shows the last still under "שידור חי בלוח הקלאסי" with a link. The other talk states (idle, requesting permission, live, muted) are designed now so S18 only wires them (section 3.1a) |

### 1.1 Round 2 (2026-10-11, owner feedback on the stations screen and the people drawer)

The owner found the first stations screen flat (camera glyph placeholders, little hierarchy) and missing what Arx already does
natively today: answering / ending a call, talking to the station, and TTS announcements. He also asked for WhatsApp messaging from
the person drawer. Round 2 redesigned "תחנות ודלתות" (sections 3.1, 3.1a, 3.1b) and added messaging to "אנשים" (section 3.2a).
Screenshots regenerated for every `stations-*` and `people-*` file plus the new call / talk / announce / whatsapp states (139 PNGs).

## 2. Design decisions (ADR)

### 2.1 One frame for the five screens

- The area is "בקרת כניסה" with a pill tab row: מרכז הכניסה · תחנות ודלתות · אנשים · פעילות · לוחות זמנים. Tabs an identity may not
  open are **not rendered** (default deny, omitted not greyed; a viewer sees the first two only). The phone bottom bar is the shell's
  own; the tab row scrolls horizontally.
- The page header (`sw-page`): title, a one-line count subtitle, the view switch (cards / list / table; the phone has no table), the
  search field, the screen's own primary action, and the admin-only display-switch control. Nothing else: no hint paragraphs, no badges.
- The feed pill in the top bar says "מחובר" or "עודכן לפני X" (stale). It never names the platform or WisKey.
- The floors / areas tree (`devices-building nav.tree` look: per-floor collapse, counts, state dots) sits at the inline start of
  "תחנות ודלתות", "פעילות" (filter by place) and "לוחות זמנים" (down to the door). On the phone it becomes the first filter chip
  ("מיקום: הכול") that opens a bottom sheet with the same tree. Places with no visible station are omitted for a scoped operator.

### 2.2 Visual language

- Built on the DU1 token layer only: type tiers `--sw-fs-2xs..3xl`, radius tiers `--sw-r-2xs..2xl`, control heights, one focus
  rule (`--sw-focus`, `--sw-focus-w`, `--sw-focus-offset`), state tokens (`--sw-live/offline/stale/unknown/forbidden/danger/
  warning/success` with `-soft` and `-text`), `--sw-glass-sheen` / `--sw-glass-blur` for the Crystal and Domus skins. The mockup
  `wk.css` carries no hex colour or px type size that is not a token; the drift guard of DU1 (`unit-token-lint`) will accept the
  real components without an allow-list entry.
- Cards, rows and tables are the three views of the same data; the row view is the phone default, the table is desktop / tablet
  only (DESIGN_CONTRACT: no shrunken tables on mobile).
- State pills (`sw-badge` kinds): מחובר (live) · לא מחובר (offline) · לא ידוע (unknown) · שיחה נכנסת / בשיחה (warning / accent) ·
  אושר / נדחה / פתיחה נשלחה / העמדה התנתקה for events · מסונכרן / ממתין לסנכרון / שגיאת סנכרון · פעיל / ממתין / שגיאה for schedules.
- Camera stills on station cards: the existing still (go2rtc poster) with a "תמונה אחרונה" tag; a station without a camera shows
  "ללא מצלמה"; offline shows "אין תמונה". No live player in stage 1 (owner answer 5).
- Door buttons read "פתח" (or "פתח · <door>" with two doors), disabled while the station is offline, confirmation dialog of one
  sentence ("לפתוח את "כניסה" בלובי?") with "שלח פתיחה" / "ביטול", result "פתיחה נשלחה · העמדה אישרה קבלה" (never "נפתחה").
  Unknown outcome: amber "לא ידוע אם בוצע" and the button held (existing behaviour of `wiskey-overview.ts`, kept).

### 2.3 Identity and permission states (the matrix)

Three identities carried through every screenshot: **site admin** (all stage-1 permissions), **operator** (`access.read`,
`access.stations.read`, `access.events.read`, `access.people.read`, `door_authority`, `access.call`), **viewer** (`access.read` only).

| Screen / element | admin | operator | viewer | out-of-scope station (scoped operator) |
|---|---|---|---|---|
| Tab visible | all | all | מרכז הכניסה, תחנות | - |
| Station card / row | full | full, technical row (sync, model) | name, place, state, last seen; no door buttons, no technical row | **omitted** from lists and tree; a direct link shows the calm placeholder "התחנה אינה בתחום שלך" inside the drawer, no other field |
| Door button | yes | yes (door_authority on the chain) | no | - |
| Call hint on the card ("שיחה נכנסת" / "בשיחה" + duration) | yes | yes | yes (no person data; question 3) | - |
| Call controls (מענה / דחייה / סיום) | yes (`access.call`) | yes | **absent** (the pill only) | - |
| Talk control (push-to-talk; stage 1 = "דיבור בלוח הקלאסי") | yes (`access.call`) | yes | absent | - |
| Announce (הכרזה) button, card icon, drawer section, composer | yes (`access.announce`, new) | yes | absent | - |
| Announce target "כל העמדות" / a place | targets limited to the operator's station chain; the count says how many | same | - | out-of-scope stations never listed as targets |
| WhatsApp action (drawer footer, row / table icon), messages history, composer | yes (`access.people.sensitive` AND `access.people.message`, new) | **absent** | - | - |
| Bulk WhatsApp (multi-select bar) | yes (same two permissions) | absent (the multi-select still exists for group actions with `access.people.manage`) | - | - |
| People list | names, groups, stations, validity, state | same | forbidden panel | people with no visible assignment omitted, and `total` recomputed (count-leak guard of CR-036 3.2) |
| People table employee-number column, search by number | yes | **absent** | - | - |
| Person drawer "פרטים רגישים" (portrait, employee no, phone, mail) | yes | **absent** (the section does not render; the server never sends the fields) | - | - |
| Person drawer footer (עריכה, הקצאת כרטיס) | yes (`access.people.manage`) | absent | - | - |
| Events list | names | names | forbidden panel | out-of-scope stations' rows omitted |
| Event drawer portrait ("תמונה מהאירוע") | yes, view audited | absent | - | - |
| Export button and dialog | yes (`access.events.export`) | absent | - | - |
| Schedules | yes | yes (`access.stations.read`) | forbidden panel | doors of out-of-scope stations omitted |
| "עריכה בחלון האינטרקום" on schedules | yes (settings) | absent | - | - |
| Settings › בקרת כניסה | yes (`access.admin.read`) | forbidden panel | forbidden panel | - |
| Display switch (header control + Settings tab) | yes | absent | absent | - |

Rules (D, from CR-036 2.3): absence, never greying, for fields and stations an identity may not see; a whole screen the identity
may not open shows the forbidden panel "המסך הזה אינו זמין לך" with no second sentence; the scoped placeholder never shows partial
data (no name, no state) - only the placeholder and the close button.

### 2.4 Operator-screen hygiene

- No sentence explains a permission on an operator screen; the only texts are titles, counts, labels, pills and one-line
  confirmations. Management sentences exist only in Settings (the "תצוגה" tab's footer line, the Settings subtitles naming WisKey
  and the command that feeds a card).
- Platform names: "WisKey" and "תשתית המערכת" appear on the Settings screen only. The iframe is "חלון האינטרקום" everywhere; the
  current nav label "WisKey" of `shell/nav.ts` and the texts of `FEED_PANELS` in `wiskey-overview.ts` (which say "WisKey",
  "hikvision_intercom", "Add-on") must be re-worded by S6 / S12 to this rule (recorded as a gap of the current native screens).
- Internal codes (CR numbers, slice names, permission ids) never appear in UI text. The Settings subtitles show the WisKey command
  names (`health/get`, `sync/status`) because they are the technical truth an admin needs there; drop them if the owner prefers.

### 2.5 Responsive behaviour

| | 1440 | 820 | 390 |
|---|---|---|---|
| Shell | rail (76 px) + content | rail + content | bottom bar |
| Tree | 236 px column | 200 px column | chip + bottom sheet |
| Views | cards / list / table | cards / list / table | cards / list |
| Detail | side drawer (420 px, start side) | side drawer | bottom sheet (86 % height, grab handle) |
| Filters | chip row, wraps | chip row, wraps | one scrolling chip row |
| KPI tiles (events) | 4 across | 4 across | hidden (the list is the point) |
| Schedules | tree of doors + week grid + two blocks | same, blocks stacked | door chip + week grid (labels hidden, windows only) + blocks |
| Settings grid | two columns, sync table full width | two columns | one column, tables scroll horizontally |
| Targets | 36 px controls | 36 px | 44 px buttons, 40 px small, 36 px chips |

### 2.6 Keyboard and focus

One rule: `:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset) }` on buttons,
rows, cards, tree links and chips (DU1's focus policy). Cards and rows are focusable (`tabindex=0`, Enter opens the drawer); the
drawer is a modal `sw-drawer` (focus trapped, Escape closes; the confirmation dialog renders inside it, since everything outside the
top layer is inert - V `sw-drawer.ts` header comment). The gallery's "פוקוס מקלדת" toggle draws the ring on the first door button
(`stations-focus-*.png`) and on the first list row (`people-focus-list-*.png`).

## 3. Screens

### 3.1 תחנות ודלתות (stations and doors) - CR-036 rows 29, 30, 2

- Cards: still, name, place, state pill, "נראה <when>", door count, door buttons, technical row (`access.stations.read`: sync state,
  pending count, model). Rows: state dot, name, place · sync, call pill, last seen, door buttons, chevron. Table: תחנה · מיקום · מצב ·
  נראה לאחרונה · שיחה · דלתות · (סנכרון · דגם/קושחה with the permission) · actions.
- Filters: הכול · מחוברות · דורשות תשומת לב · בשיחה (the last one is a new filter over `call_state`).
- Drawer: still, place, last seen, result banner after a door command, "דלתות" (one row per relay with "פתח"), "שיחה" (state,
  answer / reject / hang-up when ringing or in a call, "הכרזה"), "טכני" (sync + time, model, firmware, relays mapped or not, last
  error) for `access.stations.read`, footer: "לוחות זמנים" (with the permission) and "פעילות התחנה" (deep links with the station filter).
- Data (CR-036 3.1): `overview/summary` for the list; `stations/get` for the drawer; `stations/technical_relays` (**W?** shape) for
  the relays row; door command through CR-033 `door_authority` (interim `stations/test_unlock`, V). "Relay not mapped" removes the
  button; the admin sees "דלת לא משויכת" only in Settings (CR-033 D1).

### 3.1a Round 2: the stations screen redesigned (cards, calls, talk)

- **Card** (`.wk-card.st`): the still fills the top (16:8) with the station name and place on a bottom scrim (UniFi-Protect-like),
  a monospace time stamp top-start, and the call badge top-end ("שיחה נכנסת" amber, "בשיחה" accent). Offline stations show the last
  still desaturated with its time; no camera shows "ללא מצלמה" on a neutral surface. Below: state pill, "נראה <when>", the door's
  hold state when a program holds it open ("פתוח קבוע עד 09:00", read-only, from the door programs), the call row, the door buttons
  + the announce icon, and the technical row (sync pill, pending count, model) for `access.stations.read`.
  The mockup draws an invented entrance scene per station (`scene()` in app.js); the product uses the existing station still
  (`wiskey_camera.py`, one frame through go2rtc every 60 s). No real frame, no lab image, anywhere in the repository.
- **Ringing**: the card gets a 2 px warning ring that pulses (1.6 s), the drawer title a pulsing dot; an "attention strip" above the
  grid counts active calls and offers the list view. Reduced motion: no pulse, the ring stays (motion is a hint, never information).
- **Call row** (`.callrow`): ringing = amber row, "שיחה נכנסת" + ring duration, מענה (success) / דחייה (danger); in call = accent
  row, "בשיחה" + call duration (mono, LTR), the talk control, סיום (danger, hang-up glyph). The two-tap arming of
  `wiskey-overview.ts` (first tap arms, second sends, 0.5-4 s window) stays for מענה / דחייה / סיום; the mockup shows the armed look
  as the pressed state. Existing backend: `POST intercom/stations/{id}/call` (`media/signal`, V), audit `intercom.call`.
- **Talk control** (`.talk`, push-to-talk): a pill with a mic glyph and five states - `idle` ("דיבור", hold to talk), `req`
  ("מבקש הרשאת מיקרופון…", dashed spinning ring while the browser asks for the microphone), `live` ("מדבר", success fill, pulsing ring,
  equaliser bars), `muted` ("מושתק", struck label), `unavail` ("דיבור בלוח הקלאסי", dashed outline; the button opens the station in
  the classic panel). **Stage 1 ships `unavail` only.** The other four need the WisKey audio hook (ask W10: a session not tied to
  the panel's WS connection; today `audio/start` + `audio/send` live on the panel connection, V `audio_api.py` per CR-036 row 4).
  Keyboard: Space / Enter held = talk; `aria-pressed` reflects live; rendered only with `access.call` (absent otherwise, never grey).
- **Drawer**: the live slot (16:9) shows the last still, dimmed, with "שידור חי בלוח הקלאסי" and "פתיחה בחלון האינטרקום" (live
  video also waits for W10 / D-002); then place + last seen, the result line after a door command, the "שיחה" section (big call row
  + the large talk control when in call; "חיוג לעמדה" disabled - outgoing call is `media/call`, iframe-only in stage 1), "דלתות"
  (per door: name, hold state or "סגורה", פתח), "הכרזה" (last announcement time, button), "טכני".
- **List / table**: a 64x40 thumbnail of the still, name with a state dot, call pill with duration, מענה in the row actions while
  ringing, then the door buttons. The "בשיחה" filter chip keeps a phone glyph.

### 3.1b Round 2: the announcement (TTS) composer

- Opens from the header button "הכרזה", the card's speaker icon, or the drawer section. One dialog (`.box.wide`): **לאן** (chips: the
  station, another station, a place "קומת קרקע (3)", "כל העמדות (5)" - counts are of the operator's visible stations), **ההודעה**
  (text, counter n/500 - WisKey's limit, V `TTS_MAX`), **ביטויים מהירים** (quick phrases, a chip fills the text), a **preview line**
  (language · voice · estimated seconds, "האזנה" plays the TTS locally), the result line and "שלח הכרזה" / "ביטול".
- Results, never "הושמע": sent = "ההכרזה נשלחה ל־N עמדות · ההשמעה בעמדה לא מאומתת" (the existing `completed` carries
  `physical_result: unverified`, V `IntercomTtsStatus`); rate = "העמדה עדיין משמיעה את ההכרזה הקודמת · אפשר לשלוח שוב בעוד N שניות"
  (`audio_busy`, V `TTS_REASONS`); no engine = "אין מנוע הקראה זמין" (today's `enginesNote`); unknown outcome = amber "לא ידוע אם
  בוצע" (shared rule). The progress states generating / speaking of the existing `intercom_tts` notices show in the result line
  ("מכינה את ההקראה…", "מושמעת בעמדה…").
- **What exists (V)**: `GET intercom/tts/engines` (`tts/engines`), `POST intercom/stations/{id}/tts` with `{engine_id, language,
  message}` + envelope (`routers/access_control.py` L719-746), audit `intercom.tts` under the real actor with the text, WS notices
  `intercom_tts`, and the dialog `renderSpeak()` of `wiskey-overview.ts` (engine and language selects, 500-char textarea, the
  external-engine notice). **What is new (D)**: many targets (one POST per station, sequential, one result line with the count; or a
  new `POST intercom/tts` with `station_ids[]` - S4 decides), quick phrases (an Arx setting under הגדרות › בקרת כניסה › הכרזות, per
  installation), the preview line (engine default language and voice from `tts/engines`; the seconds estimate is Arx's own
  words-per-second guess), local playback for "האזנה" (**W?** whether the platform's TTS proxy is reachable from the add-on;
  otherwise the button is hidden), the engine / language selects behind an "עוד" disclosure (defaults from `tts/engines`).
  The external-engine notice ("הטקסט יוצא מהמבנה" when the engine is a cloud service) stays as one line under the preview, only when
  the chosen engine is not local - a privacy fact, not a hint.
- Permission: `access.announce` (new, D) replaces today's `access.release` gate for TTS; default roles operator, site_admin,
  system_admin. Rate limiting: WisKey's `audio_busy` per station plus Arx's shared limiter; the composer disables "שלח" while a
  station in the target set is still speaking and says so.

### 3.2 אנשים (people) - rows 13, 14, 19, 20, 22 (view)

- Default columns / fields everywhere: שם · קבוצות · תחנות (count of visible stations) · אמצעים (kinds only, never values) · תוקף · מצב.
  Cards show initials, never a portrait. Search placeholder: "חיפוש לפי שם" (operator) / "... או מס׳ עובד" (sensitive).
- Filters as chips: קבוצה ▾ · תחנה ▾ · פעילים · פג בקרוב · אמצעי ▾ (server filters of `users/query`: `group, station, state,
  credential`; `profile` and `rights` are later). Paging: "עוד 40" button (snapshot paging; `stale` restarts at page one).
- Drawer tabs: פרטים (groups, validity, access hours, credential kinds) · גישה (per visible station: state dot, name, sync pill) ·
  קבוצות. The sensitive section sits between the two on the first tab, with a lock glyph, the portrait frame (ring on the avatar),
  employee number, phone, mail. Footer for `access.people.manage`: "הקצאת כרטיס" (existing capture flow) and "עריכה" (existing editor).
- Data: `users/query` with filters and `snapshot`; `users/get`; `users/photo_get` only inside the sensitive section (audited
  `intercom.person.photo_view`); `profiles/settings_get` for group names.

### 3.2a Round 2: WhatsApp message to a person

- **Where**: "שלח הודעת וואטסאפ" in the person drawer footer (first button), a WhatsApp icon in the row actions of the list and in
  the table's action column, and a "הודעות" section in the drawer with the history lines "<template> · נשלח ע״י <operator> · <date>"
  and a נשלח / לא נשלח pill. Rendered only with `access.people.sensitive` **and** `access.people.message` (new, D; default roles
  site_admin, system_admin); absent otherwise. The row icon is also absent for a person with no phone (the drawer button stays and the
  composer explains).
- **Composer** (`.box.wide`): recipient card (initials, name, the phone **masked** `050-•••-••01` with an eye button that reveals it -
  the reveal is the same gated action as opening the sensitive section; a consent pill "הסכמה" / "ביקש לא לקבל"), **תבנית** chips
  (approved templates + "חופשי"), **ההודעה** (text, counter n/1000), result line, "שלח" / "ביטול". Keyboard: the dialog is modal
  (focus trapped), Ctrl+Enter sends, Escape cancels; RTL text with LTR phone.
- **States** (`wa=` in the gallery): idle · sending (spinner, "שולח…", button disabled) · sent ("נשלח · 08:21 · אין אישור מסירה" -
  never "נמסר") · failed ("לא נשלח · <reason>", e.g. the number is not on WhatsApp) · rate ("הגעת למכסת ההודעות לשעה · אפשר לשלוח שוב
  בעוד N דק׳") · cannot send: no phone / no consent ("האדם ביקש לא לקבל הודעות") / service not connected ("שירות ההודעות אינו
  מחובר") - the text box is dimmed and "שלח" disabled, the reason in one amber line.
- **Audit**: `intercom.person.message` under the real actor with the template id, the person id and the phone's last two digits
  only; the drawer's history reads this Arx audit (not WisKey's) so it is complete for Arx-sent messages.
- **Bulk** (secondary): a multi-select mode (header checkbox button, row checkboxes, a bulk bar "N נבחרו" with "וואטסאפ לנבחרים");
  the bulk composer takes one template, shows the preview count "יישלח ל־2 · לא יישלח ל־1: <name> (אין טלפון)", one confirmation,
  then a per-recipient result ("נשלח ל־2 · 1 לא נשלח"). Sends are sequential under the rate limit; a failure never stops the rest.
- **What exists (R, not verified)**: WisKey has a WhatsApp capability in the renewal flow (`whatsapp/*` commands: send, templates,
  history; CR-036 row 27 says the message builder embeds the PIN and "must not be ported casually"). **What is new and unverified (W?,
  ask W11)**: the command to send one message to one person (and whether it accepts free text or templates only), the template
  catalogue and who edits it, the consent / opt-out model and where it is stored, delivery receipts (the design assumes none:
  "נשלח" only), per-hour / per-day limits and the provider's error codes, and whether the service identity may send at all. Until
  W11 is answered the composer is designed with no receipts and treats every provider error as "לא נשלח · <reason>".
- Not designed: free-text messages that embed a PIN or a card number (never; the templates are reviewed by an admin), replies /
  inbound messages, media attachments.

### 3.3 פעילות (events) - rows 8, 9, 10

- Feed grouped by day ("היום", "אתמול"), each row: time, result dot, person name or "לא זוהה" / "שיחה מהעמדה" / "פתיחה מהמסך",
  station · door · method, result pill. Four KPI tiles on desktop (היום · אושרו · נדחו · שיחות). Table: זמן · תוצאה · אדם · תחנה ·
  דלת · אמצעי. "טען עוד" at the end.
- Filters: היום (date) · תחנה ▾ · תוצאה ▾ · אמצעי ▾ · אדם ▾, plus the place tree.
- Drawer: "אירוע" (time with the time source, station and place, door, method), the gated "תמונה מהאירוע" section, "אדם" (name,
  groups), footer deep links "לכרטיס האדם" / "לתחנה".
- Export: button for `access.events.export`; dialog states the row count under the current filters, "קובץ CSV · ללא תמונות", and
  that the export is written to the log; one primary button "ייצוא". Audit row `intercom.events.export` with filters and count, no rows.
- Data: `events/list` (V, filters exist), `events/detail` (portrait under the permission), `events/export` (**W?** format and limits).

### 3.4 לוחות זמנים (door schedules and programs) - rows 31, 32, 33, 35 (view only)

- Tree down to the door (floor › area › station › door). Header per door: "<door> · <station>", floor, and the public-code pill
  "קוד ציבורי: מוגדר / לא מוגדר" (presence only, never a value - CR-036 risk 6, ask W7).
- Week grid (06-23 h, Sunday first at the inline start, hour labels LTR): windows coloured by kind - פתוח קבוע (accent) · לפי לוח
  (success) · חג / מיוחד (warning); legend under the grid. Phone: the same grid with labels hidden.
- Two blocks: "תוכניות הדלת" (name, kind, when, state) and "לוחות זמנים במכשיר" (name, version, deployment coverage, state).
  Table view across all visible doors: דלת · תחנה · תוכנית · סוג · מתי · מצב · קוד ציבורי.
- Admin-only "עריכה בחלון האינטרקום" until the write phase (S15/S16 merged) adds editing in Arx.
- Data: `stations/technical_program_list`, `technical_hold_get`, `technical_codes_get` (presence), `schedules/list`, `plan_list`,
  `operations_list` - **all W?** (DATA_MODEL: "do not implement those screens from commands.static.json alone"; ask W2). The grid's
  window model (day, start, end, kind) is the design's assumption; S9 maps the real shapes onto it and shows "לא ידוע" for anything
  it cannot map. Refresh: poll 60 s while open unless W6 says `subscribe` covers these stores.

### 3.5 הגדרות › בקרת כניסה (status, audit, groups, display) - rows 39-42, 22, 3.8

- Sub-navigation: מצב מערכת · יומן האינטרקום · קבוצות ושדות · תצוגה. Header subtitle names the WisKey version, the platform path
  and the last check (settings screens keep the technical truth, UI_COPY_RULES).
- מצב מערכת: KPI tiles (connected stations, pending sync, conflicts, last sync), "תקינות העמדות" (per station: place, model and
  firmware LTR, last seen, sync pill), "התרעות" (severity dot, title, detail line), "סנכרון" table (per station: users on device,
  pending, to remove, conflicts, last sync, state - **counts only**, the `sync/status` personal arrays never reach the API, CR-036 3.6).
- יומן האינטרקום: table זמן · משתמש · פעולה · יעד · תוצאה, labelled "פעולות שנעשו בחלון האינטרקום"; Arx-started actions appear under
  the service user and the subtitle says Arx's own log is their record (D-004).
- קבוצות ושדות: groups with member counts and their station rule; profile fields with type and required flag; "עריכה בחלון
  האינטרקום" (write phase later: preview "ישפיע על N אנשים" then apply, CR-036 3.5).
- תצוגה: one row per screen with its verification state ("אושר <date>" / "ממתין לבדיקה") and a switch "מסך Arx" (on) / "חלון
  האינטרקום" (off); installation-wide (`access.ui.*`, CR-036 3.8).

### 3.6 The per-screen display switch

Admin-only ghost control in every operator screen's header ("מסך Arx ▾" with a window glyph) opening a small menu: "מסך Arx
(נוכחי)" · "חלון האינטרקום" · "הגדרות תצוגה". Choosing the iframe asks one sentence ("להציג את "אנשים" בחלון האינטרקום? השינוי
חל על כל המשתמשים.") and flips `access.ui.<screen>` for everyone, exactly as the Settings tab does; the control is hidden for
operators (clean screens; management in Settings). Owner question 1 asks whether the header control should exist at all.

## 4. Components

### 4.1 Existing `sw-*` components to reuse (V `frontend/src/components/`)

| Component | Used for | Notes |
|---|---|---|
| `sw-page` | page header: title, subtitle, actions slot | add the view switch and the display switch into its actions slot |
| `sw-tabs` (pill variant) | the area tab row, the drawer tabs (פרטים · גישה · קבוצות) | |
| `sw-card` (`interactive`) | station cards, person cards | Crystal skin rule 4 already styles it |
| `sw-table` (`columns`, `rows`, `rowKey`, `selected`, `dense`) | every table view | needs a column chooser (new, 4.2) and a `ltr` column flag (exists) |
| `sw-badge` (`StateKind`: live, recorded, historic, offline, stale, unknown, forbidden, error, partial, neutral - V) | state pills | the mockup's `ok` = live, `warn` = stale, `err` = error, `off` = offline, `unk` = unknown; the accent pill (בשיחה, פתיחה נשלחה, שיחה) has no kind yet - add `info` or render it with `recorded` |
| `sw-chip` | filter chips, including dropdown chips with a chevron | |
| `sw-field` | search, filter inputs | |
| `sw-button` (`primary`, `ghost`, `sm`, `icon`) | all buttons | |
| `sw-drawer` (modal, start side / bottom sheet) | station, person and event drawers | the confirmation dialog renders inside it |
| `sw-dialog` | door confirmation, export, display switch | |
| `sw-popover` / `sw-dropdown` | the display-switch menu, chip dropdowns, column chooser | |
| `sw-state-panel` (`state`, `heading`, `hint`, `actionLabel`, `compact`) | loading, empty, error, forbidden, scoped placeholders | the scoped placeholder is `state="forbidden"` with the eye glyph and no hint |
| `sw-kpi` | events tiles, Settings status tiles | |
| `sw-avatar` | initials; the portrait frame inside the sensitive section | |
| `sw-week-grid` (`days`, `modes`, `editable=false`) | the hold-open week view | modes = the three window kinds; read-only |
| `sw-toggle` | the תצוגה switches | |
| `sw-icon` | all glyphs (door, unlock, phone, ring, cam, lock, eye, export, columns, pin) - add the missing ones to the icon set | |
| `devices-building` tree pattern (`nav.tree`, `.tree-row`) | the places tree | extract into a shared `sw-place-tree` (4.2) rather than copy the CSS a third time |
| `wiskey-format.ts` (`formatTime`, `t`) | times and enum words | |
| `FEED_PANELS` / `feedBadge` of `wiskey-overview.ts` | feed states | re-word to the no-platform-name rule (2.4) |

### 4.2 New components (D)

| Component | What | Why not an existing one |
|---|---|---|
| `sw-place-tree` | floors › areas (› stations › doors) with per-floor collapse, counts, state dots, selected row; `items`, `selected`, `depth` | the home tree lives inside `devices-building`; three screens need it as a filter |
| `sw-view-switch` | the cards / list / table segmented control bound to a `/me/prefs` key per screen | the segmented pattern exists in CSS only |
| `sw-column-chooser` | popover listing `sw-table` columns with toggles, persisted per screen | tables of people and events need it; sensitive columns are offered only with the permission |
| `sw-sensitive-section` | the lock-titled section that renders only when its `allowed` flag is true and never leaves an empty frame | one place to keep the "absent, not greyed" rule |
| `wk-door-button` | "פתח" with the confirm › sent › unknown-hold state machine of `wiskey-overview.ts` extracted | reused by card, row, table, drawer |
| `wk-call-row` | ringing / in-call row with duration, מענה / דחייה / סיום with the two-tap arming | card, row, drawer (big variant) |
| `wk-talk` | the push-to-talk control with its five states, `aria-pressed`, hold-to-talk on pointer and keyboard | stage 1 renders `unavail` only; S18 wires the rest |
| `wk-announce-dialog` | the TTS composer (targets, text, quick phrases, preview, result) replacing `renderSpeak()` | header, card, drawer |
| `wk-message-dialog` | the WhatsApp composer (single and bulk), masked phone, consent pill, states | person drawer, row action, bulk bar |
| `sw-bulk-bar` | selection count + actions over the selected rows | people list / table (also for group assignment later) |
| `wk-station-still` | the camera still with its tag, ring badge and failure text | card and drawer |
| `sw-result-line` | the one-line outcome banner (ok / warn) under a drawer header | |

### 4.3 Where the write phase plugs in (S15 + S16, merged by owner answer 2)

Every drawer ends in a footer slot (`df`): people - עריכה, הקצאת כרטיס (today), later השבתה / ארכיון, תוקף; station - later
hold-open / program edit; schedules - the block headers get an "עריכה" button replacing "עריכה בחלון האינטרקום"; groups - "עריכה"
opening preview › apply. No list or card changes; door-affecting writes keep the one-sentence confirmation and the "נשלח" wording.

## 5. Token needs

Nothing new in `tokens.ts`. The mockup uses only existing names. Two notes for the skins:

- `--sw-accent-hover` is defined by Crystal (V) and used for the primary gradient; the classic / tesla / bubble skins fall back to
  `--sw-accent` (`wk.css` writes `var(--sw-accent-hover, var(--sw-accent))`). If `sw-button` adopts the gradient, add
  `--sw-accent-hover` to the other skins or keep the fallback.
- `--sw-toast-bg` / `--sw-toast-text` / `--sw-toast-action` exist (V tokens.ts); the mockup's toast reads the first two.
- `sw-state-panel` has no `scoped` preset (V: loading, empty, error, forbidden, stale, partial); the scoped placeholder is
  `state="forbidden"` with a custom heading and an eye glyph, or a new preset if S6 prefers.
- The three schedule window kinds reuse accent / success / warning; no `--sc-*` knob is needed for a read-only grid.

## 6. What each screen needs from WisKey (CR-036 commands)

| Screen | Commands | Verified | Design assumption to re-check |
|---|---|---|---|
| תחנות ודלתות | `overview/summary`, `stations/get`, `stations/technical_relays`, door via CR-033 (`stations/test_unlock` interim), `media/signal`, `tts/engines`, `tts/start` | V except `technical_relays` | **W?** relay response shape (relay index, name, mapped lock); **W?** call duration / ring start (`call_state` exists in `overview`, V; no timestamp - the mockup's durations need a `call_since` field or Arx counts from the first ringing observation); **W10** audio hook for the talk control; **W?** TTS to many stations in one command (none in the catalog; Arx loops) |
| אנשים (WhatsApp) | `whatsapp/*` (R: send, templates, history in the renewal flow) | none | **W11** (new ask): send-one command and body, templates catalogue, consent / opt-out model, delivery receipts, limits and error codes, service-identity permission |
| אנשים | `users/query` (filters `group, station, state, credential`, `snapshot`), `users/get`, `users/photo_get`, `profiles/settings_get` | R (catalog) | **W?** `users/query` facet / total semantics after Arx filtering; **W?** whether `users/get` returns credential kinds without values (DATA_MODEL says values are never returned) |
| פעילות | `events/list`, `events/detail`, `events/export` | V list; R detail/export | **W?** export format, max rows, whether it can exclude portraits; **W?** `time_source` field in `events/detail` |
| לוחות זמנים | `stations/technical_program_list`, `technical_hold_get`, `technical_codes_get`, `schedules/list`, `schedules/plan_list`, `schedules/operations_list` | none | **W?** every nested shape (ask W2); **W?** whether `technical_codes_get` returns code values (W7); **W?** refresh coverage (W6) |
| הגדרות | `health/get`, `health/history`, `sync/status`, `conflicts/list`, `fleet/alerts`, `audit/list`, `profiles/settings_get`, `profiles/versions` | none | **W?** every shape (W2); the KPI "conflicts" needs `conflicts/list` counts; alerts severity enum unknown |

Rules carried from CR-036 2.2 / 2.5: a command missing from `api.commands` hides the feature (the schedules tab disappears if no
program command exists; the export button disappears without `events/export`); unknown enum shows "לא ידוע"; `rate_limited` on
reads backs off silently; `screen_locked` / `reauth_required` on a write shows "נדרש אימות בחלון האינטרקום".

## 7. Implementation notes for the Sonnet slices

- **S6 תחנות ודלתות**: new screen `screens/wiskey-stations.ts`; move the door state machine out of `wiskey-overview.ts` into
  `wk-door-button`; build `sw-place-tree` from the `devices-building` tree CSS; read `overview/summary` through the adapter (S4) and
  `stations/get` on drawer open; technical row only with `access.stations.read` (fields absent from the payload, not hidden by CSS).
  Strings: no "WisKey" / "Add-on" / "hikvision_intercom" (re-word `FEED_PANELS` and `STILL_TEXT`). Playwright: cards / list / table,
  RTL, dark, phone, three identities, scoped omission, placeholder on a direct link, the "בשיחה" filter.
- **S7 אנשים**: extend `wiskey-people.ts` rather than rewrite: server filters + snapshot paging; `sw-column-chooser`; the sensitive
  section as `sw-sensitive-section` fed by a separate endpoint (`/intercom/people/{id}/sensitive`, 403 without the permission) so the
  list payload never carries the fields; portrait through `users/photo_get` with the audit row; the count-leak test of CR-036 3.2.
- **S8 פעילות**: extend `wiskey-events.ts`: day grouping, KPI tiles, drawer with `events/detail`, export dialog + audit row; the
  portrait block through the same sensitive endpoint pattern as S7.
- **S9 לוחות זמנים**: `screens/wiskey-schedules.ts`; map real shapes (W2) onto `{day, start, end, kind}` windows for
  `sw-week-grid`; anything unmapped renders as a row with "לא ידוע"; presence-only public code; poll 60 s; `access.stations.read`.
  Do not block on W2 for the frame: ship the frame with the unknown-shape rows and swap the mapper when W2 arrives.
- **S10 הגדרות**: `screens/system-access-control.ts` under `#/system/access-control` with the four sub-tabs; the sync table from
  counts only (adapter drops the arrays); the audit table read-only; the תצוגה tab writes `access.ui.<screen>` (existing setting keys
  for overview / events / people, new keys for stations / schedules).
- **S12 switch**: the header control reads `can('settings')` and reuses the תצוגה tab's handler; the parity report (CR-036 6.2) is
  admin-only under Settings, not on the operator screens.
- All slices: the identity matrix of 2.3 is the Playwright spec; one `tests/fake_wiskey.py` feed (S0) with the six stations, eight
  people and twelve events of `app.js` as the fixture so screenshots and tests share the data.

## 8. Open questions for the owner

Listed in Hebrew with lettered options in `docs/design/mockups/wiskey-screens/index.html`:

1. Where the display switch lives: admin-only header control + Settings (the mockup), Settings only, or per-user.
2. Employee number: sensitive (the mockup, per answer 3) or visible to everyone who sees names.
3. The call hint on a station card: for everyone who sees the station (the mockup) or only for `access.call` holders.
4. Event portraits: shown under the sensitive permission with an audited view (the mockup), without audit, or not in stage 1.
5. Sync state for operators: state word only (the mockup) or nothing.
6. (Round 2) Announce permission: a separate `access.announce` (the mockup; operators get it by default) or folded into `access.call`.
7. (Round 2) Announce targets: allow "כל העמדות" and places for operators (the mockup, limited to their chain) or single-station only.
8. (Round 2) Talk control in stage 1: show the dashed "דיבור בלוח הקלאסי" control (the mockup, so operators learn where it will be) or
   hide it entirely until W10.
9. (Round 2) WhatsApp: templates only (recommended until W11 answers the PIN-embedding question) or free text as well; who edits the
   templates (system admins in Settings, the mockup's assumption).
10. (Round 2) Bulk WhatsApp in stage 1 (secondary design, the mockup) or later.

## 9. Not done / limits

- Static mockups: no live data, no real `sw-*` components (approximations in `wk.css`), no Lit code. The real components may differ
  in small metrics; the screenshots are a design reference, not a visual-regression baseline.
- The Domus / Tesla / Bubble skins were rendered for desktop light only (Domus) or not screenshotted (Tesla, Bubble) - the gallery
  switches to them live; Crystal and classic have the full matrix.
- "מרכז הכניסה" (overview) was not redesigned (owner answer 1 keeps it); only the shared header applies.
- No Storybook stories (none exist in the repository); the gallery URL hash is the story index.
