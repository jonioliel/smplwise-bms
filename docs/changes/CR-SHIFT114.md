# CR-SHIFT114 - Shift summary and 24-hour summary (board item r114)

Status: proposed; slice 1 (backend) built on `pilot/SHIFT114-295`, cut from main v2.12.3 (c37c75c91). The screen, the scheduled delivery and the door-insight line are later slices.
Migrations: NONE used by slice 1 (all state is one `settings` row and existing tables). If a later slice needs one, it takes the PROVISIONAL number 0154, in one file.

## 1. Goal

One short Hebrew summary of what happened in the building since the last shift (or in the last 8 / 12 / 24 hours): service requests opened, closed and overdue; alarms and door events; temperature, elevator and generator faults; devices that are not available. It is written by a fixed template from data Arx already holds. **No AI model and no free text.** Every reader gets only the sections he may see, counted only over the rows he may see; nothing about other people's personal data.

## 2. Sections

Fixed order. A section is offered only when its module is on or configured AND the reader holds one of its permissions anywhere; inside it every counted row passes the reader's own visibility rule. A section that is not offered is simply absent (no "hidden" marker, so a reader learns nothing about modules he cannot use).

| Section | Module on when | Reader holds (any of) | Rows counted, per-row rule | Source |
|---|---|---|---|---|
| tickets - בקשות שירות | `tickets.enabled` = true | `tickets.view` | `services/tickets/access.visible_by_ids` (the module's one rule) | `tickets` |
| alarms - אזעקות והתראות בטיחות | always | `alarm.view`, `devices.read` | `notify_visibility.Reach.can_see` (alarm panel on its floor; safety sensors on theirs) | `notifications` `alarm.triggered`, `sensor.smoke/leak/gas/co` |
| doors - דלתות | always | `access.read`, `devices.read` | `Reach.can_see` (door: `access.read`; opening: entity scope) | `notifications` `door.emergency.started/partial`, `door.relock_unconfirmed`, `door.window_not_started`, `opening.left_open`, `door.ring` |
| devices - התקנים שאינם זמינים | always | `events.read`, `devices.read` | `Reach.can_see` (camera scope, catalogued entity) | `notifications` `camera.offline`, `nvr.offline`, `recorder.unreachable`, `device.unavailable` |
| temperature - טמפרטורות | at least one enabled unit | `devices.read` | `Reach.can_see` of kind temperature (the unit's sensor) | `infra_temp_events` (kind high / low) |
| elevators - מעליות | at least one enabled elevator | `devices.read` | `Reach.can_see` of kind elevator, per state (the very sensor of that state) | `infra_elevator_states` |
| generator - גנרטור | at least one generator | `generator.view` | `Reach.can_see` of kind generator | `generator_alerts` |

Why `Reach.can_see`: it is the rule that already decides what a reader's notification inbox shows (CR-018 section 7), so the summary can never show a count the inbox would hide, and a revoked scope applies at once. Because a reader may hold a section's permission yet see no row of it, the sentence then reads as zero: it means "none that you can see".

Slice 2 candidate, not built: "notable unexplained door openings" (a line in the doors section). It needs the door insight of CR-INSIGHT215 (`insights.doors.enabled`, door verdicts); until that is merged it has nothing to read, and an unverifiable door is never called unexplained.

## 3. Window

Half open, [from, to). A thing is "in the window" when it began at or after `from` and before `to`; "still open at the end" when it began before `to` and was not resolved before `to`. A condition resolved exactly at `from` overlaps the window but is neither new nor open (not counted); one resolved exactly at `to` was still open when the window ended.

Requests: `range` = `8h` | `12h` | `24h` (default; ends now) or `custom` with `from` (required) and `to` (default and maximum: now), both ISO instants with a zone; span 1 minute .. 72 hours, else 422. Instants are UTC internally; labels are in the installation zone (`time.zone`), `DD.MM HH:MM`. "Since the last shift" is the screen's job later (it knows the shift start; the API takes it as `from`).

## 4. Template language (exact sentences, `services/shift_text.py`)

Forms: zero / one / two / many (`{n}`); where a sentence has no `two` form it uses `many`. Hebrew agreement (gender, verb, "שתי/שני", "פעמיים") is written out per sentence.

Heading: `סיכום משמרת: מה קרה בבניין` / `התקופה: {start} עד {end} ({duration})`. When every offered section is calm: `בתקופה זו לא אירע דבר חריג.` When no section is offered: `אין נתונים להצגה לפי ההרשאות שלך.`

| Key | zero | one | two | many |
|---|---|---|---|---|
| tickets.opened | לא נפתחו בקשות שירות חדשות. | נפתחה בקשת שירות אחת. | נפתחו שתי בקשות שירות. | נפתחו {n} בקשות שירות. |
| tickets.closed | לא נסגרו בקשות שירות. | נסגרה בקשת שירות אחת. | נסגרו שתי בקשות שירות. | נסגרו {n} בקשות שירות. |
| tickets.open | אין כרגע בקשות שירות פתוחות. | כרגע פתוחה בקשת שירות אחת. | כרגע פתוחות שתי בקשות שירות. | כרגע פתוחות {n} בקשות שירות. |
| tickets.overdue (only if > 0) | | מהן אחת באיחור. | מהן שתיים באיחור. | מהן {n} באיחור. |
| alarms.raised | לא הופעלו אזעקות. | הופעלה אזעקה אחת. | הופעלו שתי אזעקות. | הופעלו {n} אזעקות. |
| alarms.active (> 0) | | אזעקה אחת עדיין פעילה. | שתי אזעקות עדיין פעילות. | {n} אזעקות עדיין פעילות. |
| alarms.safety (> 0) | | התקבלה התראת בטיחות אחת מחיישן (עשן, נזילה, גז או פחמן חד־חמצני). | התקבלו שתי התראות בטיחות מחיישנים (...). | התקבלו {n} התראות בטיחות מחיישנים (...). |
| alarms.safety_active (> 0) | | אחת מהן עדיין פעילה. | שתיים מהן עדיין פעילות. | {n} מהן עדיין פעילות. |
| doors.emergency (> 0) | | הופעל מצב חירום בדלתות פעם אחת. | ... פעמיים. | ... {n} פעמים. |
| doors.relock (> 0) | | חזרה לנעילה שלא אושרה: פעם אחת. | ...: פעמיים. | ...: {n} פעמים. |
| doors.window (> 0) | | חלון פתיחה שלא התחיל: פעם אחת. | ...: פעמיים. | ...: {n} פעמים. |
| doors.left_open (> 0) | | דלת או חלון נשארו פתוחים זמן רב: פעם אחת. | ...: פעמיים. | ...: {n} פעמים. |
| doors.rings (> 0) | | צלצול אחד בדלת. | שני צלצולים בדלת. | {n} צלצולים בדלת. |
| doors.none (no notable event) | | | | לא היו אירועי דלתות חריגים. |
| devices.dropped | לא נרשמו ניתוקי התקנים. | נרשם ניתוק התקן אחד. | נרשמו שני ניתוקי התקנים. | נרשמו {n} ניתוקי התקנים. |
| devices.now | אין כרגע התקנים שאינם זמינים. | כרגע התקן אחד אינו זמין. | כרגע שני התקנים אינם זמינים. | כרגע {n} התקנים אינם זמינים. |
| temperature.excursions | לא היו חריגות טמפרטורה. | נרשמה חריגת טמפרטורה אחת. | נרשמו שתי חריגות טמפרטורה. | נרשמו {n} חריגות טמפרטורה. |
| temperature.alarm (> 0) | | מהן אחת הגיעה לרמת אזעקה. | מהן שתיים הגיעו לרמת אזעקה. | מהן {n} הגיעו לרמת אזעקה. |
| temperature.ongoing (> 0) | | חריגה אחת עדיין נמשכת. | שתי חריגות עדיין נמשכות. | {n} חריגות עדיין נמשכות. |
| elevators.down | לא נרשמו תקלות או השבתות במעליות. | מעלית אחת הייתה תקולה או מושבתת. | שתי מעליות היו תקולות או מושבתות. | {n} מעליות היו תקולות או מושבתות. |
| elevators.minutes (if any down) | | | | סך זמן התקלה וההשבתה: {duration}. |
| elevators.fire (> 0) | | פיקוד כבאים הופעל במעלית אחת. | ...בשתי מעליות. | ...ב־{n} מעליות. |
| elevators.now (> 0) | | כרגע מעלית אחת תקולה או מושבתת. | כרגע שתי מעליות תקולות או מושבתות. | כרגע {n} מעליות תקולות או מושבתות. |
| generator.alerts | לא היו התראות מהגנרטור. | הייתה התראה אחת מהגנרטור. | היו שתי התראות מהגנרטור. | היו {n} התראות מהגנרטור. |
| generator.critical (> 0) | | מהן אחת קריטית. | מהן שתיים קריטיות. | מהן {n} קריטיות. |
| generator.active (> 0) | | מתוכן אחת עדיין פעילה. | מתוכן שתיים עדיין פעילות. | מתוכן {n} עדיין פעילות. |

Durations: `דקה אחת`, `שתי דקות`, `45 דקות`, `שעה אחת`, `שעתיים`, `8 שעות`, `שעה אחת ו־30 דקות`, `שעה אחת ודקה אחת`, `שעה אחת ושתי דקות` (the "ו" takes a maqaf only before a digit).

## 5. Permissions and switches

New permission `reports.shift` (label in `PERMISSION_LABELS`), granted to `operator`, `site_admin`, `system_admin` (role-catalog design file updated). It opens the summary; it grants nothing about any section. The part ships OFF: `settings` row `reports.shift.enabled` (default off; only exactly "true" is on). While off, `GET /reports/shift` answers the uniform 404 to everyone before any permission check. Turning it on or off needs `system.configure` (`PUT /reports/shift/status`, audited as `reports.shift.switch`).

## 6. API (slice 1, read-only)

- `GET /reports/shift?range=8h|12h|24h|custom&from=&to=` - `{v, lang: "he", window: {from, to, minutes, zone, start_label, end_label, duration_text}, quiet, truncated, sections: [{key, title, lines: [{id, n, text}], attention, counts, truncated}], text}`. `text` is the rendered plain Hebrew (heading, period, then each section as a title and one bullet per sentence). Audited as `reports.shift.read` with the window length and per-section attention counts only, never sentences.
- `GET /reports/shift/status` - `{enabled, available, can_switch}` for navigation; computes nothing, no audit row.
- `PUT /reports/shift/status` - `{enabled}` (`system.configure`).
- Row caps: 5,000 rows per section read; a cut section sets `truncated`. `contracts/API_INVENTORY.md` is regenerated on the runner (scripts/api_inventory.py) at release time.

## 7. Delivery

1. In-app view first (slice 2): a "summary" card on the service/overview area that shows `text` and the counts, with the range picker (8h / 12h / 24h / since my shift start). No action buttons; in particular no "open a service request" action anywhere (and none at all when the tickets module is off, TICKGATE-295 rule).
2. Scheduled delivery later (slice 3): a schedule row (daily at shift change, per recipient) that renders the summary AS THE RECIPIENT (his own permissions, so a push never carries more than his screen) and hands the text to `notify_core` (push and inbox first) and to the existing WhatsApp pacing path for recipients who chose it. Nothing is sent by slice 1.

## 8. Privacy

Counts only: no ticket number or title, no person, no camera or entity name, no entity id, no door name. Rows are filtered by the reader's own rights before they are counted, so a count never reveals a row he cannot open. The text is built per request, not stored. The audit row holds the window length and counts. Nothing is written to a device or to Home Assistant.

## 9. Tests (slice 1: `smplwise_vms/backend/tests/test_shift114.py`)

Gate (switch off 404 for everyone, no permission 403, bad windows 422, switch route and its audit), empty building (quiet, only the sections that exist), presets and custom window (zone label, clamp to now), audit without sentences, hidden sections by permission and by module (generator only; no right at all; unconfigured modules), row-level visibility (devices-only reader sees zeros where the admin sees counts; floor-scoped reader does not count an unplaced panel), half-open boundaries for notifications and tickets with the exact Hebrew lines, temperature / elevator / generator counts, every template sentence formats in every form, plural and duration text.

## 10. Slices

1. Backend (this branch): service, template, route, permission, switch, tests.
2. Screen: summary card, range picker, copy button; the doors line "unexplained openings" once CR-INSIGHT215 is merged and its doors switch is on.
3. Scheduled delivery per recipient (push, inbox, optional WhatsApp), with its own switch and a per-recipient time.
4. Optional: English text; "since the last shift" markers (a shift table) if the owner wants named shifts.

## 11. Owner questions (recommendation first)

1. Who gets the summary by default? a) operator + site_admin + system_admin (built; sections still self-filter), b) managers only. Recommend a: handover is an operator task and the filtering makes it safe.
2. Window presets: a) 8h / 12h / 24h plus custom up to 72 h (built), b) named shifts with fixed start times in Settings. Recommend a now, b with slice 3 when delivery needs a shift-change time.
3. Scheduled delivery: a) push and inbox only, b) also WhatsApp. Recommend a first (WhatsApp is paced and costs messages), b as a per-recipient choice later.
4. Unexplained door openings line: a) wait for CR-INSIGHT215 (needs its door pairs set up), b) drop it. Recommend a.
5. Temperature, elevator and generator sections when the module is configured but the alerts are switched off (elevator alerts are OFF by default): the summary still reads the history tables. a) yes, as built, b) only when alerts are on. Recommend a: the history exists either way and the reader's rights still apply.
