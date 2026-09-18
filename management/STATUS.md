# Project status — generated view

Generated: 2026-09-18T08:58:47.941801+00:00

Tasks: 83 | Requirements: 166 | Tests: 166 | Screens: 32

No VMS implementation or hardware test is implied by this planning registry.

## Status counts
- BACKLOG: 78
- DONE: 2
- IN_PROGRESS: 1
- READY: 2

## Release scope counts
- BETA: 20
- G0: 8
- PILOT: 35
- V1: 15
- V2: 5

## Blockers

## Backlog
| ID | Phase | Status | Task | Depends on |
|---|---|---|---|---|
| [T001](tasks/T001.md) | G0 | DONE | איסוף ומיפוי המקור הישן | — |
| [T002](tasks/T002.md) | G0 | DONE | מעבדת פיתוח והרשאות ייעודיות | — |
| [T003](tasks/T003.md) | G0 | READY | לכידת Golden traces מהמערכת הישנה | T001, T002 |
| [T004](tasks/T004.md) | G0 | BACKLOG | בדיקות Characterization והשוואת התנהגות | T003 |
| [T005](tasks/T005.md) | G0 | READY | ביקורת סודות, רישיונות ותלויות | T001 |
| [T006](tasks/T006.md) | G0 | BACKLOG | הוכחת Playback ו־Seek מוקדמת | T003 |
| [T007](tasks/T007.md) | G0 | IN_PROGRESS | נעילת Design tokens ורכיבי בסיס | — |
| [T008](tasks/T008.md) | G0 | BACKLOG | ארכיטקטורה, ADR וחוזים נעולים | T001, T005, T006 |
| [T009](tasks/T009.md) | PILOT | BACKLOG | שלד מאגר, HA Add-on/App ו־CI | T002, T008 |
| [T010](tasks/T010.md) | PILOT | BACKLOG | מדיניות מודלים וגבולות הרצות | T008 |
| [T011](tasks/T011.md) | PILOT | BACKLOG | אימות זהות HA והרשאות VMS בצד שרת | T009, T076, T077 |
| [T012](tasks/T012.md) | PILOT | BACKLOG | גילוי NVR ו־Capability registry | T003, T009, T011 |
| [T013](tasks/T013.md) | PILOT | BACKLOG | מיפוי ערוצים, Tracks ושמות | T012 |
| [T014](tasks/T014.md) | PILOT | BACKLOG | TimeAdapter ו־DST | T003, T008 |
| [T015](tasks/T015.md) | PILOT | BACKLOG | Adapter ל־go2rtc חיצוני | T006, T009, T011 |
| [T016](tasks/T016.md) | PILOT | BACKLOG | Sessions, leases וניקוי מדיה | T015 |
| [T017](tasks/T017.md) | PILOT | BACKLOG | נגן Live מאובטח ו־fallback | T007, T013, T015, T016 |
| [T018](tasks/T018.md) | PILOT | BACKLOG | קיר מצלמות ותצוגות שמורות | T017 |
| [T019](tasks/T019.md) | PILOT | BACKLOG | מודל אתר, מבנה, קומה ותוכנית | T008, T009, T011 |
| [T020](tasks/T020.md) | PILOT | BACKLOG | ייבוא PDF ותמונות אדריכליות | T019 |
| [T021](tasks/T021.md) | PILOT | BACKLOG | עורך מיקום, קנה מידה ו־FOV | T007, T019, T020 |
| [T022](tasks/T022.md) | PILOT | BACKLOG | מצלמה על המפה עם Preview | T017, T021 |
| [T023](tasks/T023.md) | PILOT | BACKLOG | ייבוא קטלוג ישויות HA | T009, T011, T019 |
| [T024](tasks/T024.md) | PILOT | BACKLOG | סנכרון Snapshot ו־HA WebSocket | T023 |
| [T025](tasks/T025.md) | PILOT | BACKLOG | ישויות על המפה ופקודות בטוחות | T021, T023, T024, T079 |
| [T026](tasks/T026.md) | PILOT | BACKLOG | Import / export וגיבוי פרויקט | T019, T023 |
| [T027](tasks/T027.md) | PILOT | BACKLOG | חיפוש הקלטות מלא ומדורג | T013, T014 |
| [T028](tasks/T028.md) | PILOT | BACKLOG | Playback session ו־Seek אמיתי | T006, T014, T016, T027 |
| [T029](tasks/T029.md) | PILOT | BACKLOG | Timeline ו־Playback UI | T007, T027, T028 |
| [T030](tasks/T030.md) | PILOT | BACKLOG | מפה היסטורית בסיסית ללא מצבי שווא | T022, T024, T029 |
| [T031](tasks/T031.md) | PILOT | BACKLOG | קליטת אירועים ונרמול | T012, T014 |
| [T032](tasks/T032.md) | PILOT | BACKLOG | Inbox אירועים, פילטרים ו־Ack | T029, T031 |
| [T033](tasks/T033.md) | PILOT | BACKLOG | מסך Health ודיאגנוסטיקה | T012, T015, T024, T027 |
| [T034](tasks/T034.md) | PILOT | BACKLOG | רספונסיביות ו־RTL למסלול הראשי | T018, T022, T025, T029, T032 |
| [T035](tasks/T035.md) | PILOT | BACKLOG | בדיקות Pilot, ניתוקים ובטיחות | T004, T011, T026, T028, T030, T032, T033, T034, T083 |
| [T036](tasks/T036.md) | PILOT | BACKLOG | שחרור Pilot עם Rollback | T035 |
| [T037](tasks/T037.md) | BETA | BACKLOG | שכבות, קבוצות וחיפוש במפה | T022, T025 |
| [T038](tasks/T038.md) | BETA | BACKLOG | גרסאות מפה, נעילה והחלפת תוכנית | T021, T026 |
| [T039](tasks/T039.md) | BETA | BACKLOG | חדרים, אזורים וגרף מעבר בין קומות | T019, T021 |
| [T040](tasks/T040.md) | BETA | BACKLOG | מתאמי ישויות נוספים ובקרת סיכון | T011, T025 |
| [T041](tasks/T041.md) | BETA | BACKLOG | היסטוריית HA על מפה ו־Provenance | T024, T030, T038 |
| [T042](tasks/T042.md) | BETA | BACKLOG | סנכרון 2–4 מצלמות עם מדידת סטייה | T028, T029 |
| [T043](tasks/T043.md) | BETA | BACKLOG | בחירה רב־מצלמתית מתוך מפה | T037, T039, T042 |
| [T044](tasks/T044.md) | BETA | BACKLOG | Thumbnails היסטוריים ו־Hover preview | T027, T028 |
| [T045](tasks/T045.md) | BETA | BACKLOG | PTZ, Presets ושמע דו־כיווני | T012, T017 |
| [T046](tasks/T046.md) | BETA | BACKLOG | הקלטה ידנית, Snapshots ו־OSD opt-in | T012, T013, T017 |
| [T047](tasks/T047.md) | BETA | BACKLOG | Review grouping ו־Spotlights | T031, T032, T039 |
| [T048](tasks/T048.md) | BETA | BACKLOG | ייצוא קטעים כ־Jobs עמידים | T027, T028, T011 |
| [T049](tasks/T049.md) | BETA | BACKLOG | Cases, הערות וסימניות | T032, T048 |
| [T050](tasks/T050.md) | V1 | BACKLOG | חבילת ראיות, Manifest ו־Checksum | T049 |
| [T051](tasks/T051.md) | BETA | BACKLOG | NVR Storage ותוכנית הקלטה | T012, T013, T033 |
| [T052](tasks/T052.md) | BETA | BACKLOG | Rules/Alarm builder עם Dry run | T024, T031, T047 |
| [T053](tasks/T053.md) | BETA | BACKLOG | קורלציה דלת–מצלמה–חיישן | T039, T040, T041, T052 |
| [T054](tasks/T054.md) | V1 | BACKLOG | אינטרקום ובקרת כניסה מקושרים | T040, T045, T053 |
| [T055](tasks/T055.md) | V1 | BACKLOG | RBAC מרחבי מלא ואודיט | T011, T038, T040, T049, T077, T078, T080 |
| [T056](tasks/T056.md) | BETA | BACKLOG | Lovelace wrappers והרחבת אינטגרציית HA | T009, T017, T023, T032 |
| [T057](tasks/T057.md) | BETA | BACKLOG | Kiosk ותצוגת קיר | T018, T034, T047 |
| [T058](tasks/T058.md) | V1 | BACKLOG | Multi-NVR ואתרים מרובים | T013, T019, T055 |
| [T059](tasks/T059.md) | BETA | BACKLOG | Schema קנוני לתוכנית אדריכלית | T020, T021, T038 |
| [T060](tasks/T060.md) | V1 | BACKLOG | AI Plan Normalizer עם Prompt גרסאי | T059 |
| [T061](tasks/T061.md) | V1 | BACKLOG | Compare ואישור אנושי לתוכנית AI | T060 |
| [T062](tasks/T062.md) | BETA | BACKLOG | חיפוש metadata מרחבי | T031, T039, T047 |
| [T063](tasks/T063.md) | V2 | BACKLOG | חיפוש סמנטי ו־AI provider אופציונלי | T055, T062 |
| [T064](tasks/T064.md) | V2 | BACKLOG | שחזור מסלול מוצע לחקירה | T043, T049, T063 |
| [T065](tasks/T065.md) | V2 | BACKLOG | DWG/DXF וייבוא מתקדם | T020, T059 |
| [T066](tasks/T066.md) | V1 | BACKLOG | מהירויות Playback ו־Frame stepping | T042, T044 |
| [T067](tasks/T067.md) | V2 | BACKLOG | חתימת ראיות וניהול מפתחות | T050, T055 |
| [T068](tasks/T068.md) | V1 | BACKLOG | Load/Soak ותקציב משאבים | T042, T048, T051, T057, T058 |
| [T069](tasks/T069.md) | V1 | BACKLOG | בדיקות אבטחה של קבצים ורשת | T011, T020, T048, T055, T060 |
| [T070](tasks/T070.md) | V1 | BACKLOG | מיגרציה הדרגתית והקבלה מול הישן | T004, T036, T055, T068 |
| [T071](tasks/T071.md) | V1 | BACKLOG | Onboarding, מדריך מפעיל ותמיכה | T036, T038, T048, T056, T055 |
| [T072](tasks/T072.md) | V1 | BACKLOG | קבלה ושחרור V1 | T050, T054, T055, T058, T061, T066, T068, T069, T070, T071, T074, T075, T082 |
| [T073](tasks/T073.md) | V2 | BACKLOG | Runner מקומי אופציונלי למשימות Codex | T010, T009 |
| [T074](tasks/T074.md) | V1 | BACKLOG | שיפור מוצר ו־Visual regression מתמשך | T034, T043, T049 |
| [T075](tasks/T075.md) | V1 | BACKLOG | אזורי זיהוי ומסכות פרטיות במצלמה | T012, T045, T055 |
| [T076](tasks/T076.md) | PILOT | BACKLOG | גשר זהות HA וייבוא קטלוג משתמשים | T009 |
| [T077](tasks/T077.md) | PILOT | BACKLOG | מנוע תפקידים, קבוצות ו־Scopes בסיסי | T076 |
| [T078](tasks/T078.md) | PILOT | BACKLOG | ממשק משתמשי HA ושיוך קבוצות ותפקידים | T007, T011, T077 |
| [T079](tasks/T079.md) | PILOT | BACKLOG | בדיקת הרשאות HA על פעולות בשם משתמש | T011, T024 |
| [T080](tasks/T080.md) | PILOT | BACKLOG | מחיקת משתמש, הורדת הרשאה וביטול Sessions | T011, T016, T024 |
| [T081](tasks/T081.md) | PILOT | BACKLOG | Ingress ו־Add-on נגישים למשתמש HA רגיל | T009, T011, T078 |
| [T082](tasks/T082.md) | V1 | BACKLOG | תפקידים מותאמים והאצלת ניהול מקומית | T055, T078 |
| [T083](tasks/T083.md) | PILOT | BACKLOG | בדיקות קבלה לזהות HA והרשאות מרחביות | T019, T025, T028, T078, T080, T081 |
