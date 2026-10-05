# Screen catalogue — 32 planned screens (v1.1)

Only four primary navigation modes; these are routes, drawers and states, not 32 sidebar entries.

## SC01 — סקירה / Spotlights
**Mode:** Live | **Phase:** PILOT | **Proposed route:** `/overview`
תמצית חריגים עם קפיצה למצלמה, מפה או review; אין dashboard מלא כתחליף למפה.
**Visual reference:** 1:01
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T007, T019, T047, T058, T074

## SC02 — אתרים ומבנים
**Mode:** Explore | **Phase:** PILOT | **Proposed route:** `/sites`
בחירת אתר ומבנה, health ממקורות אמיתיים וקיצור לקומה האחרונה.
**Visual reference:** 1:02
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T019, T058

## SC03 — דפדפן קומות
**Mode:** Explore | **Phase:** PILOT | **Proposed route:** `/buildings/:id/floors`
בחירת קומה, תמונת תוכנית, מספר מצלמות/ישויות מורשות, ו־stairs/elevator בהמשך.
**Visual reference:** 1:03
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T019, T039

## SC04 — מפת קומה חיה
**Mode:** Explore | **Phase:** PILOT | **Proposed route:** `/floors/:id/live`
מפה מרכזית, שכבות, עוגנים, preview במגירה; חיפוש, pan/zoom ובחירת כמה מצלמות.
**Visual reference:** 1:04
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T007, T022, T025, T034, T037, T039, T043, T074, T079, T083

## SC05 — ייבוא ותיקון תוכנית
**Mode:** Explore | **Phase:** PILOT | **Proposed route:** `/floors/:id/import`
PDF page/crop/rotate, מקור מול תוצאה, מצב AI מוצע, תיקון ואישור ללא שינוי המקור.
**Visual reference:** 2:13
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T020, T038, T059, T060, T061, T065

## SC06 — עורך תוכנית ועוגנים
**Mode:** Explore | **Phase:** PILOT | **Proposed route:** `/floors/:id/edit`
הצבת cameras/entities, קואורדינטות, FOV, אזורים, scale, undo/redo ו־publish.
**Visual reference:** 2:13
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T021, T037, T038, T059, T060, T061

## SC07 — קיר מצלמות חי
**Mode:** Live | **Phase:** PILOT | **Proposed route:** `/live`
תצוגות grid/focus, סדר וגודל אריחים, stream auto/main/sub ומידע חיבור.
**Visual reference:** 1:06
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T007, T018, T079

## SC08 — מצלמה בודדת
**Mode:** Live | **Phase:** PILOT | **Proposed route:** `/cameras/:id/live`
וידאו, snapshot, map context ו־Playback; PTZ/talk מופיעים רק ביכולת מאומתת.
**Visual reference:** 1:05
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T017, T022, T034, T045, T046, T075

## SC09 — מנהל Saved views
**Mode:** Live | **Phase:** PILOT | **Proposed route:** `/live/views`
תבניות 1/2/4/6/9/12/16/custom, personal/shared ו־mobile override ללא YAML.
**Visual reference:** legacy:layout
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T018

## SC10 — קטלוג ומגירת ישות HA
**Mode:** Explore | **Phase:** PILOT | **Proposed route:** `/entities`
חיפוש כל הישויות המורשות, שיוך למפה, supported actions, state freshness ו־generic fallback.
**Visual reference:** new:HA
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T007, T023, T024, T025, T034, T037, T040

## SC11 — מפת חקירה היסטורית
**Mode:** Investigate | **Phase:** PILOT | **Proposed route:** `/floors/:id/history`
תאריך/זמן בולטים, גרסת מפה תקפה, state coverage, adjacent cameras, ללא physical actions כברירת מחדל.
**Visual reference:** new:spatial-investigation
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T030, T038, T039, T041, T043, T053, T064, T074

## SC12 — Playback / Timeline
**Mode:** Investigate | **Phase:** PILOT | **Proposed route:** `/playback`
מקטעים, gaps, events, date/time, seek generation ודיוק פריים; צילום preview היסטורי.
**Visual reference:** 1:07
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T006, T014, T027, T028, T029, T034, T044, T066, T074

## SC13 — Playback מסונכרן
**Mode:** Investigate | **Phase:** BETA | **Proposed route:** `/playback/sync`
2–4 מקורות עם master clock, drift/coverage ואפשרות unlink; הרחבה רק לאחר ביצועים מאומתים.
**Visual reference:** 2:14
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T006, T028, T042, T043, T066

## SC14 — מרכז אירועים
**Mode:** Investigate | **Phase:** PILOT | **Proposed route:** `/events`
תמונות/טיפוס/זמן/מיקום/מקור, פילטרים, coverage ו־Ack מתועד.
**Visual reference:** 1:08
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T031, T032, T044, T047

## SC15 — תור Review וחלונות אירוע
**Mode:** Investigate | **Phase:** BETA | **Proposed route:** `/reviews`
קיבוץ אירועים, treated/unhandled, severity, raw evidence וקישור למפה/Playback.
**Visual reference:** legacy:review
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T032, T047

## SC16 — רשימת Cases
**Mode:** Investigate | **Phase:** BETA | **Proposed route:** `/cases`
תיקים, owner, status, tags, preserved/missing media והרשאה לכל תיק.
**Visual reference:** 2:10
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T049, T064, T074

## SC17 — תיק חקירה וראיות
**Mode:** Investigate | **Phase:** BETA | **Proposed route:** `/cases/:id`
קליפים מכמה מצלמות, notes, map route מוצע, actual time ו־export manifest.
**Visual reference:** 2:10
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T049, T050

## SC18 — יצוא והורדות
**Mode:** Investigate | **Phase:** BETA | **Proposed route:** `/exports`
durable jobs, progress/cancel/partial/fail, scoped download, hash ומשמעותו.
**Visual reference:** 2:10
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T048, T050, T067

## SC19 — חיפוש מרחבי ו־AI
**Mode:** Investigate | **Phase:** BETA | **Proposed route:** `/search`
metadata filters קודם; יכולות semantic/identity רק כשיש data/provider מורשה ו־confidence.
**Visual reference:** 2:09
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T062, T063, T064

## SC20 — אחסון ותוכנית הקלטה
**Mode:** System | **Phase:** BETA | **Proposed route:** `/system/storage`
מצב NVR disks/recording, retention observed/estimated; כתיבה guarded, no format/RAID.
**Visual reference:** 2:11
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T051

## SC21 — חוקים והתראות
**Mode:** Investigate | **Phase:** BETA | **Proposed route:** `/rules`
rules, notification scope, quiet hours/cooldown, owner HA/local ו־last matched.
**Visual reference:** 3:19
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T052

## SC22 — עורך חוק וקורלציה
**Mode:** Investigate | **Phase:** BETA | **Proposed route:** `/rules/:id`
trigger→scope→conditions→action, preview/dry run, loop prevention וראיות.
**Visual reference:** 3:19
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T052, T053

## SC23 — דלת ואינטרקום
**Mode:** Explore | **Phase:** V1 | **Proposed route:** `/access/:id`
camera/ringing/contact/relay בנפרד, linked HA controls, confirm unlock והרשאות.
**Visual reference:** 3:18
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T040, T053, T054

## SC24 — משתמשי HA, קבוצות ותפקידי VMS
**Mode:** System | **Phase:** PILOT | **Proposed route:** `/system/access`
לשוניות משתמשים/קבוצות/תפקידים, מקור HA לקריאה בלבד, role+scope, preview הרשאות והפרדה מוחלטת מ־HA admin; custom roles/delegation ב־V1.
**Visual reference:** 3:20
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T011, T055, T076, T077, T078, T080, T081, T082, T083

## SC25 — Audit trail
**Mode:** System | **Phase:** PILOT | **Proposed route:** `/system/audit`
מי צפה/שינה/ייצא/שלח פעולה, בלי secrets, פילטרים ו־retention מוגדר.
**Visual reference:** 3:21
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T055, T067, T078, T080, T082, T083

## SC26 — אשף התקנה ומיפוי
**Mode:** System | **Phase:** PILOT | **Proposed route:** `/setup`
NVR/HA/go2rtc בדיקות, clock profile, capabilities, map and first camera, no destructive discovery.
**Visual reference:** 3:22
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T002, T009, T011, T012, T071, T076, T081, T083

## SC27 — NVRs, מצלמות ובריאות
**Mode:** System | **Phase:** PILOT | **Proposed route:** `/system/devices`
mapping/aliases/order, codec/capability, firmware ותוצאת probe, ניתוק מקור ללא אשמת UI.
**Visual reference:** 2:12
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T012, T013, T033, T046, T058, T075

## SC28 — הגדרות ודיאגנוסטיקה
**Mode:** System | **Phase:** PILOT | **Proposed route:** `/system/diagnostics`
timezone display/source profile, health, jobs, budgets, backup/restore ו־redacted support bundle.
**Visual reference:** 3:23
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T014, T015, T016, T024, T026, T033, T068, T071

## SC29 — מובייל: מפה ובקרה
**Mode:** Explore | **Phase:** PILOT | **Proposed route:** `/m/explore`
אותם routes/components מותאמים לרוחב, bottom sheet, touch placement ומינימום וידאו רקע.
**Visual reference:** 2:15
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T034, T074

## SC30 — מובייל: צפייה וחקירה
**Mode:** Investigate | **Phase:** PILOT | **Proposed route:** `/m/playback`
Live/playback עם context, timeline נגיש, alerts ורשת חלשה ללא טבלאות צפופות.
**Visual reference:** 2:16
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T034, T045, T066

## SC31 — Kiosk / תצוגת קיר
**Mode:** Live | **Phase:** BETA | **Proposed route:** `/kiosk/:view`
grid קריא למרחק, reconnect/status, no admin controls ו־restricted principal.
**Visual reference:** 3:24
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T057

## SC32 — Lovelace: מפה, מצלמות ואירועים
**Mode:** HA surface | **Phase:** BETA | **Proposed route:** `ha://dashboard/cards`
עטיפות משותפות לאותם רכיבים, local navigation/API; אין fork UI נוסף או secrets ב־YAML.
**Visual reference:** legacy:HA-cards
**States:** loading, empty, ready, partial, offline/stale, forbidden, error
Desktop/tablet/mobile; RTL shell, geometry and video not mirrored; focus and keyboard equivalents.
**Tasks:** T056

## Addenda after v1.1 (screens added or moved by later change requests)

The 32 entries above are the v1.1 plan and are kept as written. The screens below were added or moved afterwards; their
authoritative records are the change requests and design records named in each entry. Routes are the product's hash routes.
States listed are those the implemented screen renders.

### SC10 (moved, 0.1.146) — קטלוג ההתקנים
The device catalogue is no longer the map's "התקנים" tab: it is **הגדרות › קטלוג התקנים**, route `#/system/entities`, for
`system.configure` at installation scope only. `#/explore/entities` redirects (to the catalogue for holders, to the map
otherwise). Record: `docs/architecture/TABS_CONFIG.md`.

### SC28 (extended, 0.1.146) — הגדרות
New settings tab **לשוניות** (SC37 below), a default floor for the map (tab "מפה"), the start screen (default "ראשי"), the
WisKey display size and the NVR clock reading ("מערכת ה־NVR" in the connections screen) joined the settings screens; the home
screen's title, widgets and floor order are edited on the home screen itself ("עריכת המסך הראשי" in the user menu).

## SC33 — תזמונים: רשימה
**Mode:** Home (חשמל והתקנים) | **Phase:** PILOT | **Route:** `#/devices/schedules` (also `/<id>` drawer, `/trash`, `/review`)
הלשונית השנייה במסך הראשי, לצד "מבט על": התזמונים שהמשתמש רשאי לראות ככרטיסים, טבלה או לוח שבוע לקריאה בלבד; פס סיכום, חיפוש,
סינון, קיבוץ, מיון, הפעלה והשבתה מרובות, מגירת פרטים, סל מחזור ל-30 יום, ולמנהלי התקנה רשימת "לבדיקה".
**Visual reference:** `docs/design/mockups/scheduler/` (screens 01-04, 13-16, 20, 22, 23)
**States:** loading, empty, ready, filtered-empty, feature off, component missing (operator / administrator), no permission,
view-only, stale, error
Desktop/tablet/mobile; RTL shell, the 24 h axis is left-to-right by decision; focus and keyboard equivalents.
**Record:** CR-014 (`docs/design/CR-014-scheduler.md`, `docs/architecture/SCHEDULER_API.md` §12); user guide `41-schedules_HE.md`.

## SC34 — תזמונים: עורך 24 שעות
**Mode:** Home | **Phase:** PILOT | **Route:** `#/devices/schedules/<id>/edit`, `#/devices/schedules/new/edit[?template=&preset=]`
לוח שבועי 7 × 24 שעות (ימים מקושרים), תצוגת יום, תצוגת טבלה על אותו מודל, פאנל משבצת (שעות, פעולות, ארגומנטים, "כיבוי בסיום
החלון", העתקה לימים), פאנל צד (פרטים, התקנים, ימים, חזרה, תקופה, תנאים עם תנאי שבת וחג, הרצות באות, בדיקות תקינות), פיצול יום,
באנר קונפליקט, הגנה מיציאה בלי שמירה ואישור לפעולה רגישה. בטלפון: זוג לשוניות (לוח / הגדרות) וציר יום אנכי.
**Visual reference:** `docs/design/mockups/scheduler/` (screens 05-08, 17-19, 21, 24, 25)
**States:** loading, ready, read-only (permission, locked slot, unsupported content), conflict, save error, forbidden / not found
Desktop/tablet/mobile; RTL shell, the axis is left-to-right; focus and keyboard equivalents (arrows, Shift / Ctrl + arrows,
Delete, Enter).
**Record:** CR-014.

## SC35 — תזמונים: יצירה
**Mode:** Home | **Phase:** PILOT | **Route:** dialog over SC33 ("תזמון חדש")
תבניות (שגרה שבועית, תאורה בשקיעה, תריסים לפי עונה, מזגן בשעות משרד, פעם אחת, שבת: קירור / חימום, מוצאי שבת, ריק) עם תנאי שבת וחג
אופציונלי, ויצירה מהירה בשלוש הקשות (איפה, מה ומתי, באילו ימים).
**Visual reference:** `docs/design/mockups/scheduler/` (screens 09, 26)
**States:** loading, ready, saving, error, sensor not configured (presets disabled)
**Record:** CR-014.

## SC36 — הגדרות › תזמונים
**Mode:** System | **Phase:** PILOT | **Route:** `#/system/schedules` (`system.configure`, installation scope)
חיבור (גרסאות הרכיב והגשר, סנכרון אחרון, הוראות התקנה), מתג ההפעלה (כבוי כברירת מחדל), חיישן שבת וחג, סוגי התקנים מותרים,
ברירות מחדל לעורך וטבלת "מי רשאי מה" לקריאה בלבד.
**Visual reference:** `docs/design/mockups/scheduler/` (screen 12, adapted per `SCHEDULER_API.md` §12.4)
**States:** loading, ready, dirty, saved, error, forbidden
**Record:** CR-014; user guide `80-settings_HE.md`.

## SC37 — הגדרות › לשוניות
**Mode:** System | **Phase:** PILOT | **Route:** `#/system/diagnostics?tab=tabs` (element `system-tabs-config`)
הצגה, הסתרה וסדר של לשוניות בכל אזור ניווט; סדר אישי של הניווט הראשי גובר אצל המשתמש שקבע אותו.
**Visual reference:** none (a settings form)
**States:** loading, ready, dirty, saved, error, view-only, demo
**Record:** `docs/architecture/TABS_CONFIG.md`.


## SC31 (superseded for fixed tablets, CR-030) — מסך קיר
**Mode:** Live | **Phase:** 2.3.0 (planned) | **Route:** none of its own: the normal Arx login; a user with an enabled wall profile who signs in on a tablet-class device is switched to the wall shell (`frontend/src/wall/`)
טאבלט קבוע בקיר: משתמש מסך קיר (התפקיד קיוסק הקיים) שמתחבר מטאבלט; הזיהוי לפי מגע ראשי והצלע הקצרה של המסך; בטלפון ובמחשב - המערכת הרגילה. אין צימוד ואין אסימון. רשימת מצלמות מפורשת (הרשאות ברמת מצלמה); פריסה לפי גודל וכיוון (לרוחב, לאורך עם רצועת מפה, מצלמה אחת); אריחי התראה והשתלטות קריטית; מסגרת תמונות; הגנה על המסך, לו"ז שינה, התנהגות בניתוק. טלוויזיה - בשידור (CR-028). `#/kiosk/:view` for signed-in HA users stays as it is.
**Visual reference:** `docs/design/mockups/wall-display/` (index.html, detect.html)
**States:** login (form, error, tablet detected, access removed), base, rotating, info chip, alert tile / stack, takeover, resolved, frame, dim, sleep, camera stale / lost, server offline / clock, no connection, remote refused, no cameras, installer (with password-guarded sign-out), sound locked
Tablet landscape 1280×800 (large tablets scale), portrait 800×1280, single camera; RTL strip, video / map / user names not mirrored; touch >= 44 px.
**Record:** CR-030 (`docs/changes/CR-030-WALL-DISPLAY.md`).

## SC38 — הגדרות › מסכי קיר
**Mode:** System | **Phase:** 2.3.0 (planned) | **Route:** `#/system/wall` (`system.configure`, installation scope; adding a user also needs `rbac.assign`)
רשימת משתמשי מסך (מצב, נראה לאחרונה, ערוץ, מצלמות, התראות, פעולות: עריכה / השבתה / הסרה), "הוספת משתמש מסך" (בחירת משתמש קיים ומקום), מגירת עריכה בארבע לשוניות (משתמש ומצלמות עם עץ האזורים, התראות, תמונות, שעות ושמירה), תיקיות תמונות. בטלפון כרטיסים.
**Visual reference:** `docs/design/mockups/wall-display/settings.html`
**States:** loading, empty, ready, error, add (pick a user), add form, drawer (4 tabs), remove confirmation, saved
**Record:** CR-030.
