# Project status — generated view

Generated: 2026-10-27T21:43:27.493587+00:00

Tasks: 265 | Requirements: 374 | Tests: 391 | Screens: 32

No VMS implementation or hardware test is implied by this planning registry.

## Status counts
- BACKLOG: 135
- BLOCKED: 11
- DONE: 38
- IN_PROGRESS: 7
- READY: 2
- REVIEW: 72

## Release scope counts
- BETA: 20
- G0: 8
- PILOT: 35
- V1: 171
- V2: 29
- V3: 2

## Blockers
- T003: Excluded from G0 by owner decision 2026-09-22 - not to be worked (see the evidence entry).
- T004: Excluded from G0 by owner decision 2026-09-22 - not to be worked (see the evidence entry).
- WXH0: DEFERRED by the owner (2026-10-10): key rotation (CR-034 H slices) is not to be built until the owner asks. Do not start, branch or schedule this row.
- WXH1: DEFERRED by the owner (2026-10-10): key rotation (CR-034 H slices) is not to be built until the owner asks. Do not start, branch or schedule this row.
- WXH2: DEFERRED by the owner (2026-10-10): key rotation (CR-034 H slices) is not to be built until the owner asks. Do not start, branch or schedule this row.
- WXH3: DEFERRED by the owner (2026-10-10): key rotation (CR-034 H slices) is not to be built until the owner asks. Do not start, branch or schedule this row.
- WXH4: DEFERRED by the owner (2026-10-10): key rotation (CR-034 H slices) is not to be built until the owner asks. Do not start, branch or schedule this row.
- WXH5: DEFERRED by the owner (2026-10-10): key rotation (CR-034 H slices) is not to be built until the owner asks. Do not start, branch or schedule this row.
- WXH6: DEFERRED by the owner (2026-10-10): key rotation (CR-034 H slices) is not to be built until the owner asks. Do not start, branch or schedule this row.
- WXH7: DEFERRED by the owner (2026-10-10): key rotation (CR-034 H slices) is not to be built until the owner asks. Do not start, branch or schedule this row.
- WXAV: Waiting for W10 (stream descriptor and audio hook) from the WisKey side; the owner asks to start S18 right after stage 1 as soon as W10 arrives.

## Backlog
| ID | Phase | Status | Task | Depends on |
|---|---|---|---|---|
| [T001](tasks/T001.md) | G0 | DONE | איסוף ומיפוי המקור הישן | — |
| [T002](tasks/T002.md) | G0 | DONE | מעבדת פיתוח והרשאות ייעודיות | — |
| [T003](tasks/T003.md) | G0 | BLOCKED | לכידת Golden traces מהמערכת הישנה | T001, T002 |
| [T004](tasks/T004.md) | G0 | BLOCKED | בדיקות Characterization והשוואת התנהגות | T003 |
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
| [T058](tasks/T058.md) | V3 | BACKLOG | Multi-NVR ואתרים מרובים | T013, T019, T055 |
| [T059](tasks/T059.md) | BETA | BACKLOG | Schema קנוני לתוכנית אדריכלית | T020, T021, T038 |
| [T060](tasks/T060.md) | V1 | BACKLOG | AI Plan Normalizer עם Prompt גרסאי | T059 |
| [T061](tasks/T061.md) | V1 | BACKLOG | Compare ואישור אנושי לתוכנית AI | T060 |
| [T062](tasks/T062.md) | BETA | BACKLOG | חיפוש metadata מרחבי | T031, T039, T047 |
| [T063](tasks/T063.md) | V2 | BACKLOG | חיפוש סמנטי ו־AI provider אופציונלי | T055, T062 |
| [T064](tasks/T064.md) | V2 | BACKLOG | שחזור מסלול מוצע לחקירה | T043, T049, T063 |
| [T065](tasks/T065.md) | V2 | BACKLOG | DWG/DXF וייבוא מתקדם | T020, T059, T086 |
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
| [T084](tasks/T084.md) | V2 | BACKLOG | סטודיו התוכנית 1 — מסמך גאומטריה, כיול, קירות ופתחים בכל המפות | T020, T021, T038 |
| [T085](tasks/T085.md) | V2 | BACKLOG | סטודיו התוכנית 2 — ספריית עצמים, מפלסים ותאורה | T084 |
| [T086](tasks/T086.md) | V2 | BACKLOG | סטודיו התוכנית 3 — זיהוי אוטומטי של קירות, דלתות וחלונות | T084 |
| [T087](tasks/T087.md) | V2 | BACKLOG | סטודיו התוכנית 4 — תלת־ממד בתוך המפה | T084, T085 |
| [T088](tasks/T088.md) | V2 | BACKLOG | סטודיו התוכנית 5 — ייצוא, DXF וחבילות תוכנית | T084, T085 |
| [T089](tasks/T089.md) | V2 | BACKLOG | סטודיו התוכנית 6 — תלת־ממד ריאליסטי וסיור בגובה עין | T087 |
| [T090](tasks/T090.md) | V2 | BACKLOG | סטודיו התוכנית 8 — BIM / IFC | T085, T088 |
| [T091](tasks/T091.md) | V1 | BACKLOG | תיעוד בעברית ומדריך למשתמש מלא עם צילומי מסך אמיתיים | T025, T054, T087 |
| [T092](tasks/T092.md) | V1 | BACKLOG | Arx remote access (CR-008) — /arx, התחברות HA במסך שלנו, PWA ואפליקציה | T011 |
| [T093](tasks/T093.md) | V1 | REVIEW | אבטחה: לייב | חקירה | אזעקה — אזעקה מתשתית המערכת (CR-010) | — |
| [T094](tasks/T094.md) | V1 | REVIEW | מעטפת האפליקציה: המשתמש בסוף סרגל הניווט, בלי סרגל עליון בטלפון, סדר לשוניות אישי (CR-013) | — |
| [T095](tasks/T095.md) | V3 | BACKLOG | גורם אימות שני ל-Arx (CR-011) — מדיניות כניסה, step-up לפעולות רגישות, passkeys | T092 |
| [T096](tasks/T096.md) | V1 | BACKLOG | התראות באפליקציית Android (CR-012) — השכמת FCM דרך ממסר, חלופת UnifiedPush | T092 |
| [T097](tasks/T097.md) | V1 | BACKLOG | חלל משותף לשתי קומות (CR-009) — אולם בגובה כפול, שלם בכל קומה | T085 |
| [T098](tasks/T098.md) | V1 | READY | מולטימדיה - מסכים ושלט (CR-015): מסך המסכים, השלט, כרטיסי מדיה באזורים ובמסך הראשי | — |
| [T099](tasks/T099.md) | V1 | BACKLOG | מולטימדיה שלב 2 - נגנים, רמקולים וקבוצות (CR-016): כרטיסים, חלונית נגן, קבוצות, מועדפים ותחנות | — |
| [T100](tasks/T100.md) | V1 | BACKLOG | אוטומציות, סצנות וסקריפטים (CR-017): צפייה, הרצה, בונה בעברית, שמירה בטוחה דרך רכיב החיבור | — |
| [T101](tasks/T101.md) | V1 | BACKLOG | התראות (CR-018): מרכז התראות אחד, מקורות מובנים, Push וטלפונים, העדפות אישיות, אישור והסלמה | — |
| [T102](tasks/T102.md) | V1 | IN_PROGRESS | תזמונים (CR-014): מסך תזמונים מעל רכיב התזמונים, הרשאות, ביטול ושחזור, אימות חי במעבדה | — |
| [T103](tasks/T103.md) | V1 | IN_PROGRESS | אפליקציית הטלפון - צד השרת (CR-027): רישום מכשירים, נוכחות וחיישנים, דחיפה דרך הממסר; כבוי כברירת מחדל | — |
| [T104](tasks/T104.md) | V1 | IN_PROGRESS | שידור וידאו למסכים (CR-028): מחקר, תוכנית בשלבים והכנה לקריאה בלבד - עמודת 'שידור' בהגדרות המולטימדיה | — |
| [T105](tasks/T105.md) | V1 | IN_PROGRESS | Provision-ISR: מקליטים ומצלמות (CR-025) - מתאם API v1 לקריאה, חיפוש, השמעה, ייצוא, אירועים | — |
| [T106](tasks/T106.md) | V1 | IN_PROGRESS | ניטור בריאות מקליטים (CR-026): שבעה מקורות התראה, הגדרות פר מקליט, עומק ל-Provision-ISR | — |
| [T107](tasks/T107.md) | V2 | BACKLOG | מסך קיר לטאבלט קבוע (CR-030, WDM / WDX): משתמש קיר שמזוהה לפי טאבלט | — |
| [T108](tasks/T108.md) | V2 | BACKLOG | גנרטורים (CR-031, GEN1): זיהוי לפי התקן, תרשים זרימת הספק, התראות וניתוב, היסטוריה | — |
| [T109](tasks/T109.md) | V1 | BACKLOG | מתגים מוגנים (CR-019): ברירת מחדל 'כלול', הצעת סיווג, רשימת סקירה בהגדרות | — |
| [T110](tasks/T110.md) | V1 | BACKLOG | הגדרות מצלמות ב-NVR (CR-020): טבלת מצלמות, כתיבה מוגנת (SVC / קידוד), שינוי לכמה מצלמות | — |
| [T111](tasks/T111.md) | V1 | BACKLOG | עדכון והפעלה מחדש מתוך Arx (CR-021): בדיקת גרסה, עדכון באישור אחד, מסך מצב ששורד הפעלה מחדש | — |
| [T112](tasks/T112.md) | V1 | BACKLOG | חיבור ה-NVR בתוך Arx (CR-022): סוג NVR, בדיקת חיבור לקריאה בלבד, שמירה מוצפנת, הפעלה מחדש | — |
| [T113](tasks/T113.md) | V1 | BACKLOG | מוני חשמל וחיובי צריכה (CR-023): מונים, חשבונות, תעו״ז, קריאות ידניות וכיול, PDF | — |
| [T114](tasks/T114.md) | V1 | BACKLOG | וריאנטים נוספים לסקין בועה (BV1): אריחי שעון ומזג אוויר, יומן, משגר מהיר, מחוונים אנכיים, מראה בלי משטח | — |
| [T115](tasks/T115.md) | V1 | BACKLOG | בחירת מצלמות להשוואה כתפריט נפתח (CMP1 / CMP2): הקלטות › השוואה וניגון מסונכרן | — |
| [T116](tasks/T116.md) | V1 | BACKLOG | מקליטי Frigate (CR-029, NN5): צפייה וניגון (F1) ושליטה מוגנת (F2), כבוי כברירת מחדל | — |
| [T117](tasks/T117.md) | V1 | BACKLOG | הכרזות קוליות (MU2): השמעת שורה מוקלדת ברמקולים מותרים, מגבלות קצב, יומן | — |
| [T118](tasks/T118.md) | V1 | BACKLOG | הצעת הורדה לאפליקציית Android במסך הכניסה מרחוק (כבויה כברירת מחדל) | — |
| [WXD0](tasks/WXD0.md) | V1 | REVIEW | WisKey CR-033: Trusted-bridge fakes and vector oracle | — |
| [WXD1](tasks/WXD1.md) | V1 | BACKLOG | WisKey CR-033: WisKey door map (explicit, single relay, manual) | WXD0 |
| [WXD2](tasks/WXD2.md) | V1 | REVIEW | WisKey CR-033: Access control station scope and placement | — |
| [WXD3](tasks/WXD3.md) | V1 | BACKLOG | WisKey CR-033: One door authority rule, door opener role, grant card | WXD1, WXD2 |
| [WXD4](tasks/WXD4.md) | V1 | BACKLOG | WisKey CR-033: trusted_door transport (interim + signed), audit fields, "sent" | WXD0, WXD3 |
| [WXD5A](tasks/WXD5A.md) | V1 | BACKLOG | WisKey CR-033: Bridge 0.8.1 execute block for WisKey doors (admin setting) | WXD4 |
| [WXD5B](tasks/WXD5B.md) | V1 | BACKLOG | WisKey CR-033: Bridge door_open / door_open_status | WXH1, WXD4 |
| [WXD6](tasks/WXD6.md) | V1 | BACKLOG | WisKey CR-033: WisKey locks without lock.lock / lock-all | WXD1 |
| [WXD7](tasks/WXD7.md) | V1 | BACKLOG | WisKey CR-033: Read-only door-path inventory and report | WXD1 |
| [WXD7R](tasks/WXD7R.md) | V1 | BACKLOG | WisKey CR-033: Owner-approved inventory read on the installation | WXD7 |
| [WXD8](tasks/WXD8.md) | V1 | BACKLOG | WisKey CR-033: Editor block setting (default blocked) | WXD7 |
| [WXD9](tasks/WXD9.md) | V1 | BACKLOG | WisKey CR-033: Run guard for Arx-started runs (R-17) | WXD4, WXD7 |
| [WXD10A](tasks/WXD10A.md) | V1 | BACKLOG | WisKey CR-033: Arx event door jobs (M1), disable-and-list | WXD9, WXD7R |
| [WXD10B](tasks/WXD10B.md) | V1 | BACKLOG | WisKey CR-033: Hold-open program hand-over (M3) | WXD9, WXD7R |
| [WXD11](tasks/WXD11.md) | V1 | BACKLOG | WisKey CR-033: Door-path gate T1..T26 on fakes | WXD0, WXD1, WXD2, WXD3, WXD4, WXD5A, WXD5B, WXD6, WXD7, WXD7R, WXD8, WXD9, WXD10A, WXD10B |
| [WXG0](tasks/WXG0.md) | V1 | BACKLOG | WisKey CR-034: Merge WX3 gate tool to main | — |
| [WXG1](tasks/WXG1.md) | V1 | BACKLOG | WisKey CR-034: Gate: impact block, exit 5, gate:allow | WXG0 |
| [WXH0](tasks/WXH0.md) | V1 | BLOCKED | WisKey CR-034: Rotation fakes | — |
| [WXH1](tasks/WXH1.md) | V1 | BLOCKED | WisKey CR-034: Bridge multi-key verifier and rotate service | WXH0 |
| [WXH2](tasks/WXH2.md) | V1 | BLOCKED | WisKey CR-034: Arx key set and rotation state machine | WXH0 |
| [WXH3](tasks/WXH3.md) | V1 | BLOCKED | WisKey CR-034: bridge.key.rotate, owner contacts, emergency notice | WXH2 |
| [WXH4](tasks/WXH4.md) | V1 | BLOCKED | WisKey CR-034: Fresh-key re-pair with verification, emergency revocation | WXH2, WXH3 |
| [WXH5](tasks/WXH5.md) | V1 | BLOCKED | WisKey CR-034: Maintenance screen and watchdog | WXH2, WXH4 |
| [WXH6](tasks/WXH6.md) | V1 | BLOCKED | WisKey CR-034: Anchor eligibility and capability status hand-over | WXH1, WXH4 |
| [WXH7](tasks/WXH7.md) | V1 | BLOCKED | WisKey CR-034: Rotation gate on fakes | WXH1, WXH2, WXH3, WXH4, WXH5, WXH6 |
| [ST7S0](tasks/ST7S0.md) | V2 | REVIEW | Plan Studio 6 S0: plan document 2.2 schema, material library, resolver, look settings | — |
| [ST7S4](tasks/ST7S4.md) | V2 | BACKLOG | Plan Studio 6 S4: eye-level walk-through core | ST7S0 |
| [ST7S1](tasks/ST7S1.md) | V2 | BACKLOG | Plan Studio 6 S1: material library and level-3 rendering | ST7S0 |
| [ST7S2](tasks/ST7S2.md) | V2 | BACKLOG | Plan Studio 6 S2: sun, sky, time of day, lamps | ST7S1 |
| [ST7S5](tasks/ST7S5.md) | V2 | BACKLOG | Plan Studio 6 S5: walk UX (touch, minimap, saved positions, kiosk) | ST7S4 |
| [ST7S3](tasks/ST7S3.md) | V2 | BACKLOG | Plan Studio 6 S3: lighting bake, stills and storage | ST7S1, ST7S2 |
| [ST7S7](tasks/ST7S7.md) | V2 | BACKLOG | Plan Studio 6 S7: performance gate, determinism and release | ST7S0, ST7S1, ST7S2, ST7S3, ST7S4, ST7S5 |
| [FIX1](tasks/FIX1.md) | V1 | DONE | Test fixes: glass wall specs and nightly default | — |
| [HA2610](tasks/HA2610.md) | V1 | DONE | Home Assistant 2026.10 compatibility: document, tests and implementation | — |
| [SEC243](tasks/SEC243.md) | V1 | DONE | Security fixes 2.4.3: curved wall caps (M1), hidden camera position, L2, L4-L6 | — |
| [WALLP](tasks/WALLP.md) | V1 | DONE | Glass wall / screen and curved wall drawing tool through points | — |
| [LAT1](tasks/LAT1.md) | V1 | DONE | Instant switch on / off (no wait time) | — |
| [CR21S4](tasks/CR21S4.md) | V1 | DONE | Self-update: downgrade protection and installer notes (CR-021 S4) | — |
| [DU1](tasks/DU1.md) | V1 | DONE | Design unification: one design language, token lint | — |
| [FRGPOL](tasks/FRGPOL.md) | V1 | DONE | Frigate review screen polish: review, zone editor, clip viewer | — |
| [ACTPOL](tasks/ACTPOL.md) | V1 | DONE | Activity window polish: cards and list, tones, filters | — |
| [DEVTYPE](tasks/DEVTYPE.md) | V1 | DONE | Manual device type from Settings (switch/outlet/light/boiler/tap) and 2FA note removal | — |
| [BRAND](tasks/BRAND.md) | V1 | DONE | Brand colours, glass screens light/dark scheme, self-update switch, climate-kind backup fix | — |
| [CRY](tasks/CRY.md) | V1 | DONE | Crystal skin with a day / night background | — |
| [HOMEPOL](tasks/HOMEPOL.md) | V1 | DONE | Home and area screens polish; floor and area pickers side by side | — |
| [SECPOL](tasks/SECPOL.md) | V1 | DONE | Security screens polish: alarm, cameras, events, notifications, recorders | — |
| [ALLON](tasks/ALLON.md) | V1 | DONE | Turn all on next to turn all off (lights and switches, floor / area menu) | — |
| [PLANMODE](tasks/PLANMODE.md) | V1 | DONE | 3D view mode: a manual choice sticks, default in Settings | — |
| [SEC244](tasks/SEC244.md) | V1 | DONE | Security lows of the 2.4.2 review: L1 restricted-reader hash, L3 hidden references | — |
| [NIGHTSP](tasks/NIGHTSP.md) | V1 | REVIEW | Nightly speed-up: the nightly runs the release gate engine (60-65 min) | — |
| [SETPOL](tasks/SETPOL.md) | V1 | REVIEW | Settings polish: navigation column with search, shared style, switch colour as accent | — |
| [MEDPOL](tasks/MEDPOL.md) | V1 | REVIEW | Multimedia, notification centre and electricity charts polish (incl. meter column bug) | — |
| [KIOPOL](tasks/KIOPOL.md) | V1 | REVIEW | Wall, kiosk and PWA polish: distance legibility, burn-in, touch | — |
| [FLAKY](tasks/FLAKY.md) | V1 | REVIEW | Stabilise flaky backend and frontend tests (15 of 16) | — |
| [FLOORSTRIP](tasks/FLOORSTRIP.md) | V1 | REVIEW | One floor switcher in the 3D view (duplicate floor strip fix) | — |
| [BILLSTART](tasks/BILLSTART.md) | V1 | IN_PROGRESS | Electricity bill start-reading bug | — |
| [ST7L](tasks/ST7L.md) | V2 | REVIEW | Plan Studio 6 look development: two rounds, LOOK_SPEC and CC0 assets | — |
| [ST7INT](tasks/ST7INT.md) | V2 | BACKLOG | Plan Studio 6: integration on 2.4.6, migrations 0074-0075, gate and release | ST7S0, ST7S4, ST7S1, ST7S2, ST7S3 |
| [ST7SITE](tasks/ST7SITE.md) | V2 | BACKLOG | Plan Studio 6: site location for the sun comes from the HA settings (latitude / longitude) | — |
| [ST7UI](tasks/ST7UI.md) | V2 | BACKLOG | Plan Studio 6: editor UI (material per wall / room / item, north compass, saved walk positions) and plan.view settings screen | — |
| [ST7HIST](tasks/ST7HIST.md) | V2 | BACKLOG | Plan Studio 6: level 3 also in the history map and the event page | — |
| [WXCR](tasks/WXCR.md) | V1 | REVIEW | WisKey: change requests CR-033 (door path) and CR-034 (key rotation) with the implementation plan | — |
| [WXIMP](tasks/WXIMP.md) | V1 | REVIEW | WisKey importer on the Arx side (CR-035), stage 1: offline package intake, import manifest, staged install plan (fakes only) | — |
| [WXNS](tasks/WXNS.md) | V1 | REVIEW | WisKey native screens plan (CR-036): 49 screens and actions | — |
| [WXN01](tasks/WXN01.md) | V1 | REVIEW | WisKey native screens S0+S1: WisKey fake, pinned catalogue, last_access removal, background projection, channel guard | — |
| [WXN34](tasks/WXN34.md) | V1 | BACKLOG | WisKey native screens S3+S4: new permissions, station and field filtering, adapter and read channel | WXN01, WXD2, WXD3 |
| [WXN5](tasks/WXN5.md) | V1 | BACKLOG | WisKey native screens S5: design of the station, people, schedule and status screens | WXN01 |
| [WXN6](tasks/WXN6.md) | V1 | BACKLOG | WisKey native screens S6-S10: stations and doors, people, events, schedules, status and groups | WXN34, WXN5 |
| [WXN11](tasks/WXN11.md) | V1 | BACKLOG | WisKey native screens S11-S14: station-scoped writes, per-screen switch, gate, lab verification | WXN6 |
| [WXW](tasks/WXW.md) | V2 | BACKLOG | WisKey new writes (including doors), allowed now by the owner decision | WXN11 |
| [WXAV](tasks/WXAV.md) | V2 | BLOCKED | WisKey local live video and two-way audio (S18) | — |
| [WKS9](tasks/WKS9.md) | V1 | DONE | WisKey native screens S9: read-only door schedules screen (access.ui.schedules) | — |
| [WKS11](tasks/WKS11.md) | V1 | DONE | WisKey native screens S11: person and card writes on the station chain (archive, on/off, cards, photo, PIN, capture) | — |
| [WKS12](tasks/WKS12.md) | V1 | DONE | WisKey native screens S12: stage-1 gap analysis, parity report, action-log filters, S13 suite manifest | — |
| [WKS18](tasks/WKS18.md) | V1 | DONE | WisKey native screens S18: live video and push-to-talk in the station drawer (access.station_media) | — |
| [WKWA](tasks/WKWA.md) | V1 | DONE | WisKey native screens WA: WhatsApp messages from the people screen, single and bulk | — |
| [WXDINT](tasks/WXDINT.md) | V1 | DONE | WisKey CR-033: door path integrated on the 2.4.8 line (wave 1 + D6-D9 + review fixes + D5a/D5b/D10a/D11 on fakes) | — |
| [ST7DPR](tasks/ST7DPR.md) | V2 | REVIEW | Plan Studio 6: dpr_cap is the pixel ratio of the first realistic frame and moves at once (fix of the 2.4.7 known limit) | — |
| [GATE248](tasks/GATE248.md) | V1 | DONE | Release gate: baselines refreshed from the 2.4.8 gate and a tracked per-spec duration seed | — |
| [FIXMENU](tasks/FIXMENU.md) | V1 | DONE | Opaque menu surfaces: one --sw-menu-surface token for every floating menu in all five skins | — |
| [WXPERM](tasks/WXPERM.md) | V1 | DONE | access.doors.open: a door-only permission for any role; access.release kept as its legacy name | — |
| [WXMEDSET](tasks/WXMEDSET.md) | V1 | DONE | Settings row for live video and talk on the stations screen (access.station_media) | — |
| [WXSCH](tasks/WXSCH.md) | V1 | DONE | A schedules link from the station drawer to the native schedules screen | — |
| [WXUNBLK](tasks/WXUNBLK.md) | V1 | DONE | Door-opening blocks card: see what the door path blocks and release one script-backed entity by hand | — |
| [ST7LOOK](tasks/ST7LOOK.md) | V1 | DONE | Studio 6 look-dev round 3: normals, ground disc, level-3 plates, ceilings, lamp pools, chair model, phone pill cap | — |
| [ST8](tasks/ST8.md) | V1 | DONE | Plan Studio 8: IFC4 export and import in the plan editor (CR-037) | — |
| [TTSLOG](tasks/TTSLOG.md) | V1 | DONE | Station announcements: the audit rows hold the envelope only, never the spoken text | — |
| [FIXHUD](tasks/FIXHUD.md) | V1 | DONE | Opaque HUD panels over the plan, the editor, the history map, the event page and the 3D view (menu surface, strong hairline, Tesla HUD fill) | — |
| [FIXHUDLAYOUT](tasks/FIXHUDLAYOUT.md) | V1 | DONE | Floor map HUD layout contract (map/hud-layout.ts): corner controls, docked list and level bar never collide | — |
| [ST7ODD](tasks/ST7ODD.md) | V1 | DONE | Studio 6: the five 2.4.10 level-3 oddities (cones and GTAO cut with the walls, pill de-overlap, surfaced export control, test-house furniture) | — |
| [GATE2411](tasks/GATE2411.md) | V1 | DONE | Release gate: baselines and per-spec duration seed refreshed from the 2.4.10 gate | — |
| [TKS1](tasks/TKS1.md) | V1 | REVIEW | Service management: module skeleton, internal service requests, configurable name (D33) | — |
| [TKS2](tasks/TKS2.md) | V1 | REVIEW | Service management: departments, SLA rules and ticket templates | — |
| [TKS3](tasks/TKS3.md) | V1 | REVIEW | Service management: the device integration (device tab, long press, frozen device history) | — |
| [TKS4](tasks/TKS4.md) | V1 | REVIEW | Service management: contacts, handler links and the public handler page (port 18093, add-on option tickets_public) | — |
| [TKS5A](tasks/TKS5A.md) | V1 | REVIEW | Service management: WhatsApp account selection per use | — |
| [TKS5B](tasks/TKS5B.md) | V1 | REVIEW | Service management: the message channel (outbox, inbound replies, message templates) | — |
| [TKS6](tasks/TKS6.md) | V1 | REVIEW | Service management: stuck / escalation monitor, manager board and notifications | — |
| [TKS6B](tasks/TKS6B.md) | V1 | REVIEW | Service management: the board table view (sort, filters, CSV export, bulk actions, saved views) | — |
| [TKS7](tasks/TKS7.md) | V1 | REVIEW | Service management: verification codes (option B) and code settings | — |
| [TKS8](tasks/TKS8.md) | V1 | REVIEW | Service management: add-on docs, Hebrew guide chapter, public-surface review checklist | — |
| [TKS9](tasks/TKS9.md) | V1 | REVIEW | Service management: cost claims (vendor claim step, manager review, close gate) + costs settings, contact cost fields, cost notification sources (s9b) | — |
| [TKRENAME](tasks/TKRENAME.md) | V1 | REVIEW | Service management: owner rename 2026-10-14 (module name, item noun, article tokens) and the rename lint | — |
| [TKHARDEN](tasks/TKHARDEN.md) | V1 | REVIEW | Service management hardening in 2.5.0: security review fixes, strict image decode, WhatsApp test send without the env switch, demo area off | — |
| [TKHANDL](tasks/TKHANDL.md) | V1 | REVIEW | Service management handlers page (2.5.1): the 'Handlers and vendors' page, employee contact kind, assign-dialog readiness, department create without an identifier and restore, Permissions tab fix | — |
| [TKDEL](tasks/TKDEL.md) | V1 | REVIEW | Service management 2.5.2: full deletion of a ticket by a manager (tickets.delete, single + bulk) and self-add of tickets.all_departments holders as department members / managers | — |
| [TKFIX253](tasks/TKFIX253.md) | V1 | REVIEW | Service management 2.5.3: the public handler-page address saves from a local session; a remote session saves the other settings and shows the address read-only | — |
| [TKFIX254](tasks/TKFIX254.md) | V1 | REVIEW | Service management 2.5.4: the public handler-page address may include one path prefix such as /support (vendor links built with it; Cloudflare rewrites it to /t) | — |
| [TKFIX255](tasks/TKFIX255.md) | V1 | REVIEW | Service management 2.5.5: table menus open above the table (no clipping), settings lists refresh after changes, one-row bulk delete drops the row | — |
| [TKFIX256](tasks/TKFIX256.md) | V1 | REVIEW | Service management 2.5.6: 'waiting for a part' is a sub-state of 'in progress' (status strip, chips, menus, vendor toggle), no API or stored-status change | — |
| [TKFIX257](tasks/TKFIX257.md) | V1 | REVIEW | Service management 2.5.7: vendor page quote / payment-request card and light/dark setting (migration 0085), deep-review security hardening (migration 0086), expand-arrow fix | — |
| [TKFIX258](tasks/TKFIX258.md) | V1 | REVIEW | Service management 2.5.8: assignable staff, vendor account screen, no-login staff link (migration 0087), WhatsApp notification channel, handler-page path, TK251 remainder hardening | — |
| [TKUI1](tasks/TKUI1.md) | V1 | REVIEW | Service management 2.6.3: the request drawer (side sheet / full screen) with the overview tab and status sentence | — |
| [TKUI2](tasks/TKUI2.md) | V1 | REVIEW | Service management 2.6.3: conversation and history tabs of the drawer | — |
| [TKUI3](tasks/TKUI3.md) | V1 | REVIEW | Service management 2.6.3: costs tab, quote decisions, quote on the vendor's behalf, owner change (TKUI3, TKUI3B, TKLAYFIX) | — |
| [TKUI4](tasks/TKUI4.md) | V1 | REVIEW | Service management 2.6.3: request list in list / table / board views with the running clock | — |
| [TKCAL](tasks/TKCAL.md) | V1 | REVIEW | Service management 2.6.3: weekly calendar of visits and time targets | — |
| [TKUI5](tasks/TKUI5.md) | V1 | REVIEW | Service management 2.6.3: redesigned vendor page | — |
| [TKUI6](tasks/TKUI6.md) | V1 | REVIEW | Service management 2.6.3: handlers page and settings; the display tab places the drawer rows | — |
| [TKUI7](tasks/TKUI7.md) | V1 | REVIEW | Service management 2.6.3: service module on the shared design tokens | — |
| [TKDETAILBE](tasks/TKDETAILBE.md) | V1 | REVIEW | Service management 2.6.3: request detail backend - internal owner, allowed line kinds, quotes v2 (migration 0088) | — |
| [TKFIX260](tasks/TKFIX260.md) | V1 | REVIEW | Service management 2.6.3: approvals never send by themselves, internal note, assign dialog with internal note and vendor message (TKFIX260, TKASSIGNDLG) | — |
| [TKRFQ1](tasks/TKRFQ1.md) | V1 | REVIEW | Service management 2.6.3: requests for quotation backend (migration 0089) | — |
| [TKRFQ2](tasks/TKRFQ2.md) | V1 | REVIEW | Service management 2.6.3: requests for quotation manager screens (list, new request, vendor board, comparison, award) | — |
| [TKRFQ3](tasks/TKRFQ3.md) | V1 | REVIEW | Service management 2.6.3: public vendor quote page and per-vendor verification-code switch | — |
| [TKMAP1](tasks/TKMAP1.md) | V1 | REVIEW | Service management 2.6.3: map element on a request (migration 0090) | — |
| [TKNOTIFOTP](tasks/TKNOTIFOTP.md) | V1 | REVIEW | Service management 2.6.3: optional WhatsApp number verification by a one-time code (migration 0091) | — |
| [TKSECRETS](tasks/TKSECRETS.md) | V1 | REVIEW | Arx 2.6.3: secrets moved from add-on options to Settings > Connections > Secrets (migration 0093) | — |
| [TKTPLMIG](tasks/TKTPLMIG.md) | V1 | REVIEW | Service management 2.6.3: removal of the numeric quick-reply line from saved message templates (migration 0092) | — |
| [TKFRIGLIVE](tasks/TKFRIGLIVE.md) | V1 | REVIEW | Frigate 2.6.3: live video through Frigate's restream, events polling, NVR system card fix | — |
| [TKWIZHINT](tasks/TKWIZHINT.md) | V1 | REVIEW | Setup wizard 2.6.3: optional steps and a persistent per-user hint dismissal | — |
| [TKFIX263](tasks/TKFIX263.md) | V1 | REVIEW | Arx 2.6.3 release: combined service-management redesign, requests for quotation, map element, number verification, secrets, Frigate live video (integ/263) | — |
| [USR2-P1](tasks/USR2-P1.md) | V1 | REVIEW | USR2 phases P0+P1: Arx-only identities (CR-USR2) - identity store, passwords, sign-in, sessions, brute-force tiers, administration, sign-in page mode, settings tab; behind security.local_identity (off) | — |
| [USR2-P3](tasks/USR2-P3.md) | V1 | REVIEW | USR2 phase P3: the service identity - Arx-only users act in Home Assistant through ONE non-administrator HA user under a per-feature allow-list enforced by the add-on and the bridge (0.9.0); behind security.local_identity (off) | — |
| [WISKEYID-BUILD](tasks/WISKEYID-BUILD.md) | V1 | REVIEW | CR-ARX-WISKEY-SHARED-IDENTITY X1-X4 (backend): Arx <-> WisKey person links and time-bounded door grants for external people with a WhatsApp code; OFF, go-live not permitted in code | — |
| [SCHEDIMPACT-295](tasks/SCHEDIMPACT-295.md) | V1 | BACKLOG | V-02 (Fable security review 4, medium, pre-existing basic mode): scheduled script / scene runs of Arx-only people go through the runnable allowlist and the bridge impact check | — |
| [ENTPOL-295](tasks/ENTPOL-295.md) | V1 | REVIEW | Owner decision 3 of 2026-10-21 (Fable security review 4, V-08): the automatic refusal while the service user is not restricted by an entity policy - fail closed on ambiguous policies and on a stale report (Home Assistant unreachable) | — |
| [WHOIN034-295](tasks/WHOIN034-295.md) | V1 | REVIEW | Who is in the building (board r034) and the geofence / beacon / Wi-Fi editors on screen (board r035), 2.16.0 | — |
| [GATEAUDIT-297](tasks/GATEAUDIT-297.md) | V1 | REVIEW | Gate audit and cleanup: classify the repeatedly failing / flaky / obsolete tests of the last 35 gate and nightly runs, remove duplicates, fix the bubble-freeze leftovers, re-take stale visual baselines, refresh the gate baselines | — |
| [GATELANES-297](tasks/GATELANES-297.md) | V1 | REVIEW | Gate lanes: pixel baselines for classic + domus only (tesla / crystal get a structural smoke), archive the September owner-round live specs, a non-blocking timing lane for the wall-clock tests | — |
| [WISKEYA06-297](tasks/WISKEYA06-297.md) | V1 | REVIEW | WisKey A06 (T06, W-031, board r152): identity source + role + scope -> admission, working-state mapping (fakes) | — |
| [EXTERNALBUILD-297](tasks/EXTERNALBUILD-297.md) | V1 | REVIEW | External access built to full scope (X0-X6 of EXTERNALSPEC-297 + one-time code + CR-VISITOR105 visitors), fakes only, OFF by default | — |
| [DOORWRITE-297](tasks/DOORWRITE-297.md) | V1 | REVIEW | Door-window program written from Arx to WisKey (board r129): validate, read-back proof, drift, retries, dry run, write again | — |
| [XSECFIX-297](tasks/XSECFIX-297.md) | V1 | REVIEW | Security review 2026-10-27 (phone apps): the four medium findings M1-M4 - presence gate exact match, device credentials end on sign-out, failure limiter per source, arx://open waits for the app lock | — |
| [MOTIONSETTING-297](tasks/MOTIONSETTING-297.md) | V1 | REVIEW | Motion setting ui.motion (auto | full | reduced), separate from the skin and the scheme | — |
| [SPLITSWITCH2-297](tasks/SPLITSWITCH2-297.md) | V1 | REVIEW | Emergency-buttons switch is a setting (owner q48): default on, admin-only, audited, confirmed when turned off; a gate on the build flags, never an activation | — |
| [XSECFOLLOW-297](tasks/XSECFOLLOW-297.md) | V1 | REVIEW | Security review 2026-10-27 follow-ups of XSECFIX-297: the presence block on WebSockets, phone credentials end on a password change / reset and a forced second factor, ?do=run and Android tests | — |
