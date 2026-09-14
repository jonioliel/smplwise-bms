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

