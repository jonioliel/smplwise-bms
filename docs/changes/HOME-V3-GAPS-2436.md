# HOME-V3-GAPS-2436 - home interface v3: audit of the approved mockup against main, and the remaining gaps

Branch `pilot/HOME-V3-GAPS-2436` from `origin/main` ab7894837 (v2.43.1). Spec: the owner-approved round-27 mockup
`private/design-system-2026-10-27/round27/home-full-v3/` (index.html inventory, home.js `S.*` screens and `ovlHtml` sheets, data3.js),
the owner's answers to round 27 (11.11) and round 29 (11.11 evening). Owner rule: build the full approved scope, no silent gaps.
No version bump, no CHANGELOG, API inventory not regenerated. No migration (nothing new is stored). Nothing in `private/`, `secrets/`,
`management/*.json` or the lab was touched. The follow-up B items (wall panel adds a family event, ticket photo) belong to
`pilot/HOME-V3-FOLLOWUP-B-2431` and were not touched; this branch's edits to files B also edits are kept away from B's lines
(`home-tickets.ts`: two new functions between unchanged lines; `main.py`: the include next to phase 1's, not phase 2's).

## 1. Audit: every screen, state and action of the mockup against main

Method: each `S.<screen>`, each sheet type (`setOvl({ type })`) and each `data-act` of `home.js` (v3 part, lines 728-1182) was compared
with the screen modules on main (`frontend/src/home/home-*.ts`, `sw-home.ts`). The v2 part of the mockup (rooms, lights, climate, shades,
doors, cameras, energy, alerts, scenes, active, settings, welcome) was approved and built in 2.42.0 / 2.42.1 and is only checked here for
the buttons v3 adds to it. "Decision" = an owner answer that changed or dropped the mockup element.

| # | Item | Mockup location | State on main (ab7894837) | Plan |
|---|---|---|---|---|
| 1 | "עוד" hub: 17 tiles with live lines, paged | `S.more`, `hubItems()` | built (P1 + P2 + P3 registries) | none |
| 2 | "עוד" in the nav and as the home screen's ninth chip | v3 shell `NAV.splice`, `chips` | built | none |
| 3 | Recordings: camera, day, timeline LTR, events of the day, play / pause / 10 s, back to live, previous / next camera | `S.playback`, `pbCam`, `pbJump`, `pbSkip` | built (day stepper replaces the 3-day seg: decision 5ג "everything stored") | none |
| 4 | "הקלטות" on the cameras screen and in the full-screen camera | `S.cameras`, `ovlHtml` cam | built | none |
| 5 | Home diary: list, filter הכל / דלתות / מצלמות, watch the recording | `S.events`, `evWatch` | built | none |
| 6 | Home diary: filter "אזעקה" (armed / disarmed, by whom) | `S.events` (`has('alarm')`), data3.js kind `alarm` | **missing** (P1: "no alarm event kind") | **built here**: `GET /home/alarm-log` + the filter |
| 7 | Intercom: calls, who answered, "דבר עם הכניסה" | `S.intercom` calls | built | none |
| 8 | Intercom: a picture per call | `S.intercom` `.vp` | not possible: the call log keeps no frames | none (recorded, P1) |
| 9 | Guests: list, new, cancel; "show code"; weekly | `S.intercom` guests, `guestNew`, `guestCode`, `guestDelAsk` | built, adapted (round 29 answer 3א: the code is never shown; no weekly) | none (decision) |
| 10 | Who can come in: "נכנס עם קוד / תג / פנים" | `S.intercom` people | built as door counts (round 29 answer 6א) | none (decision) |
| 11 | Alarm screen, arm with one confirmation, disarm with the code | `S.security`, `almArm`, `almDisarm` | built | none |
| 12 | Personal alarm code under "ההתראות שלי" | `S.notif` (`pinNew`) | **missing** (only on the alarm screen; round 29 answer 7א = also on "ההתראות שלי") | **built here** |
| 13 | Who is home + "להציג אותי" (decision 8א: household sees each other, each can hide self) | `S.presence`, `showMe` | built | none |
| 14 | Calendar: week strip with dots, day list, new event | `S.calendar`, `calNew` | built | none |
| 15 | Calendar event: key link to the guest's code | `S.calendar` (`e.door && has('guests')`) | not built: a calendar event carries no visitor invitation | none (no link exists in the data; question 2) |
| 16 | Shared rooms: list, book, my bookings, cancel with confirmation | `S.calendar` book, `bookNew`, `bookDelAsk` | built | none |
| 17 | Notice board: new / all, buses line, notice sheet, "קראתי"; a long notice scrolls only inside its sheet (decision 10א) | `S.notices`, `notice` | built (`.n-body` scrolls) | none |
| 18 | Service requests: open / all, three steps, new, open ticket + note | `S.tickets`, `tkNew`, `ticket` | built | none |
| 19 | New ticket: "צרף תמונה" | `tkNew` sheet | branch FOLLOWUP-B | not touched |
| 20 | Open ticket: "הבעיה נפתרה" / "הבעיה חזרה" | `ticket` sheet, `tkCloseAsk`, `tkReopen` | not built (round 29 answer 10א: note only) | none (decision) |
| 21 | Music and screens: now playing, transport, volume, sources, devices, scope, stop all, announce | `S.media` | built | none |
| 22 | "לנגן גם ב..." and the TV remote | `group`, `remote` sheets | built | none |
| 23 | Announcement: ready messages, where, send | `announce` sheet | built (text + ready messages, room or whole house: round 29 answers 14א / 15א) | none (decision) |
| 24 | Bill: so far, estimate, previous bills, show a bill | `S.bills`, `billOpen` | built (show bill: FOLLOWUP-A) | none |
| 25 | Water: today vs usual, week, leak / no leak, month | `S.water` | built | none |
| 26 | Water: "פתח פנייה לאינסטלטור" on a leak (when tickets exist) | `S.water` (`tkNew` with `data-cat="אינסטלציה"`) | **missing** (P3: tickets were phase 2's; both are on main now; `openNewTicket` existed but was never wired) | **built here** |
| 27 | House systems: power, generator, lifts, temperatures, view only | `S.systems` | built | none |
| 28 | House systems: "דווח על תקלה" (when tickets exist) | `S.systems` head | **missing** (same reason) | **built here** |
| 29 | Home map: floors, rooms, lit / dark, temperature, camera, legend | `S.map` | built | none |
| 30 | Schedules: list with switch, new scene schedule (decision 11א: run / pause / create) | `S.schedules`, `schNew` | built | none |
| 31 | Scenes screen: "תזמונים" and "סצנה חדשה" | `S.scenes`, `capNew` | built | none |
| 32 | Weather: strip link and screen | `S.weather`, v3 `strip` | built | none |
| 33 | My notifications: per kind, do not disturb | `S.notif` | built | **fixed here**: on a phone the night-hours row cut the end hour off (two rows now) |
| 34 | "התראות": "מה מגיע אליי" and "יומן הבית" in the head | `S.alerts` (`addAct`) | **missing** | **built here** |
| 35 | Personal menu: "ההתראות שלי" | `ovlHtml` menu (home face) | **missing** (reachable only from the hub) | **built here** |
| 36 | Strip back arrow: recordings -> cameras, bill / water -> energy, hub children -> hub | v3 `strip` | built (`back()` per module) | none |
| 37 | Room chip "מדיה" | v3 `chips` | built | none |
| 38 | Wall panel locked to a room: room media / announce + notices + calendar (decision 14ב) | answers | built (P2 `wallChips`, P3 `roomChips`) | none |
| 39 | Admin: wallpaper for a room for everyone (decision 16ב) | answers | built (P1) | none |
| 40 | States: demo / worst case / empty / some modules off | demo panel | built per screen (each phase's specs run the three data sets and module-off cases) | none |
| 41 | Recordings on the light stream | answers | not changed (round 29 answer 2א) | none (decision) |
| 42 | Main water valve, generator test, emergency announcement, voice recording, announce to a floor | inventory / answers | not built (no route / decisions 13א, 14א, 15א) | none (decision) |

## 2. What was built

### Server

* `GET /home/alarm-log` (`routers/home_gaps.py`, registered next to phase 1's router): the alarm's arm / disarm changes of the last 7
  days, newest first, at most 60: `{at, panel, action: arm_away | arm_home | arm_night | ... | disarm, by, me}`. Source: `ha_actions`
  rows of `alarm_control_panel.alarm_*` with status `confirmed` (what Arx sent and the panel confirmed - a change made at the panel's own
  keypad is not in Arx and is not listed). Reach: the alarm router's own `_Scope` (alarm.view with placement / floor scope); no
  alarm.view anywhere -> the audited 403. A home-only (or any) person whose stored category list lacks `log` or `security` -> 403
  `home_module_off`. Read only, under the home-only `/home/` prefix; never an argument, a code or a request id in the answer.

### Frontend

* `home-gaps.ts` (new): registers the actions `gapTkPlumber` / `gapTkFault` and gives the shared screens their buttons: the alerts head
  (`gapAlertActs`), the personal menu row (`gapMenuRow`), the ticket buttons (`gapTicketButton`: only with the tickets module on, the
  person allowed to open one, not on a wall panel). Imported from `home-v3-p1.ts`.
* `home-gaps-alarm.ts` (new): `getAlarmLog`, the diary words (`האזעקה נדרכה למצב "בבית": אני`, `האזעקה נוטרלה: יונתן`), the gate
  (security category + alarm.view).
* `home-diary.ts`: the alarm rows and the "אזעקה" filter (shown when the person may view an alarm); with several panels the row says
  which. `diaryOk` exported.
* `home-alarm.ts`: `alarmPinRow` / `warmAlarmPin` - the "הקוד האישי שלי לאזעקה" row uses the alarm screen's own `almPin` sheet and rule.
* `home-notif.ts`: the code row; on a phone the night hours are two rows.
* `home-tickets.ts`: `canNewTicket`, `newTicketFor` (the sheet with a subject picked by name: plumbing for a leak, general maintenance for
  a fault; none when no category matches).
* `home-p3-water.ts`, `home-p3-systems.ts`: the two ticket buttons. `sw-home.ts`: the alerts head and the menu row (2 lines + import).

## 3. Tests

Run on the workstation (Windows, Python 3.12 venv, Node 24), 2026-11-12:

| Command | Exit | Result |
|---|---|---|
| `pytest tests/test_home_v3_gaps_2436.py` | 0 | 3 passed (confirmed alarm changes of the last week only, newest first, names / me, no code in the answer; no alarm.view -> 403, kiosk role -> 403, floor scope without the panel -> nothing; home-only category refusals and allowed; no write method) |
| `npx tsc --noEmit` | 0 | clean |
| `npx vite build` | 0 | built |
| `npx playwright test tests/home-v3-gaps-2436.spec.ts --project=desktop` (own port 4436) | see the closing report | 12 tests: alerts head + menu row, no diary link without the log category, the code row end to end (PUT body), no row without arm / disarm, the plumber ticket end to end (subject + POST), no button without a leak / with tickets off, report a fault, the diary alarm filter, no filter and no request without the alarm category, the no-scroll / targets / words / RTL sweep at 1280x800, 1024x768, 390x844 |
| `python scripts/gate/lint_spec_waits.py frontend/tests/home-v3-gaps-2436.spec.ts` | 0 | 0 findings |

Pixel baselines: `frontend/tests/pixel-home-gaps-2436.spec.ts` (notifications with the code row, the diary's alarm filter, the fault
sheet; desktop 1440 + phone 390; light + dark), generated on the runner from this branch (see the commit that adds the `-snapshots/`
folder). Test data is time-independent: every mock stamp is relative to the test's clock (`now`), the pixel spec fixes the clock.

NOT_RUN on the workstation: the full backend suite and the full Playwright suite (the entry check runs them on the runner); a lab run
(no real panel action was sent; the log reads stored rows only).

## 4. Open questions for the owner

1. ביומן הבית, בסינון "אזעקה", מוצג מי דרך ומי נטרל (כמו בהדמיה). מקובל שכל בני הבית רואים את השם?
   א. כן, כמו בהדמיה (נבנה כך)  ב. רק "נדרכה" / "נוטרלה" בלי שם  ג. השם רק למנהל הבית
2. בהדמיה, אירוע ביומן המשפחה הראה סימן מפתח כשלאורח יש קוד לדלת. במערכת אין קשר בין אירוע ביומן להזמנת אורח.
   א. לוותר (מומלץ)  ב. לבנות קישור בין אירוע להזמנה (שינוי בשרת)

## Migration and rollback

No migration. Rollback: revert the branch's commits; the route and the buttons disappear, nothing stored changes.
