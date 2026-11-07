# Project status — generated view

Generated: 2026-11-07T12:58:43.668540+00:00

Tasks: 451 | Requirements: 560 | Tests: 577 | Screens: 32

No VMS implementation or hardware test is implied by this planning registry.

Dependency rule (BOARD-RULE-2404): REVIEW needs every dependency in REVIEW or DONE; READY, IN_PROGRESS, VALIDATION and DONE need every dependency DONE. OBSOLETE cards are BLOCKED with a blocker starting "Excluded - OBSOLETE" and an EXCLUDED evidence line (the registry has no OBSOLETE status).

## Status counts
- BACKLOG: 96
- BLOCKED: 18
- DONE: 40
- IN_PROGRESS: 7
- REVIEW: 290

## Release scope counts
- BETA: 20
- G0: 8
- PILOT: 35
- V1: 357
- V2: 29
- V3: 2

## Blockers
- T003: Excluded - OBSOLETE by owner decision 2026-11-05 (round 22, Q2 = א on the BOARD-HYGIENE-2403 candidates; relayed by the coordinator, no written answers file): superseded by the owner's exclusion of 2026-09-22 (docs/architecture/DECISIONS.md. Not to be worked; the card is kept.
- T004: Excluded - OBSOLETE by owner decision 2026-11-05 (round 22, Q2 = א on the BOARD-HYGIENE-2403 candidates; relayed by the coordinator, no written answers file): superseded by the owner's exclusion of 2026-09-22 (docs/architecture/DECISIONS.md. Not to be worked; the card is kept.
- T096: Real FCM / APNs delivery needs the owner's Firebase project and Apple account (docs/operations/ARX_PUSH_RELAY_DEPLOY_HE.md); the relay Worker is not deployed. The CR-012 wake design is treated as superseded by the CR-027 relay (the CR-012 document itself still says "Proposed"); the go-live work is PUSH-GOLIVE-KIT-2380.
- WXD5B: Excluded - OBSOLETE by owner decision 2026-11-05 (round 22, Q2 = א on the BOARD-HYGIENE-2403 candidates; relayed by the coordinator, no written answers file): superseded by door actions go over the WisKey direct join (docs/changes/DOORLIVE-2310.md, owner decisions 2026-10-30), not a bridge door_open / door_open_status service. Not to be worked; the card is kept.
- WXH3: Not a work blocker: the Arx part is built on pilot/WXH-LEFTOVERS-2405 (not merged). BLOCKED only because the registry rule needs every dependency DONE (WXH2 is REVIEW).
- WXH4: Built on pilot/WXH4-EMERGENCY-REVOKE-2407 (fakes only, not merged, not released): waits for the review and merge, a release with bridge 0.10.6, one Home Assistant restart by the owner, and its dependencies WXH2 / WXH3 reaching DONE (registry rule). The owner's six decisions of 07.11 are built (docs/changes/WXH4-EMERGENCY-REVOKE-2407.md).
- WXH5: Not a work blocker: the watchdog is built on pilot/WXH-LEFTOVERS-2405 (not merged). BLOCKED by the registry rule (WXH2 REVIEW) and by WXH4 (owner decisions).
- WXH6: The Arx side is built on pilot/WXH-LEFTOVERS-2405 (not merged). Still open: the bridge side (a bridge release) and WisKey's high-water mechanism; BLOCKED also by the registry rule (WXH1 REVIEW, WXH4 BLOCKED).
- WXH7: Not a work blocker any more: The owner lifted the 2026-10-10 deferral on 2026-10-20 (private/planning/OWNER_DECISIONS_2026-10-20_NIGHT.md, round 4 item 4: "HMAC key rotation: build now (activation only after a Fable review)"); built as HMACROT-295 / HMACACT-295 / HMACACT2-295, docs/changes/CR-WISKEY-HMAC-ROTATION-295.md. The status stays BLOCKED only because the registry rule needs every dependency DONE (owner acceptance).
- WXIMP: Excluded - OBSOLETE by owner decision 2026-11-05 (round 22, Q2 = א on the BOARD-HYGIENE-2403 candidates; relayed by the coordinator, no written answers file): superseded by private/planning/OWNER_DECISIONS_2026-10-20_NIGHT.md round 1 item 7 (package install from Arx frozen) and round 4 item 6. Not to be worked; the card is kept.
- REAL-TV-SESSION-2380: Waits for the owner (question Q2: a lab TV in a joint session this week, an Android TV box only, or fix blind); TV-FIT-2380 shipped in 2.38.0 (merge 571891e9d).
- CAST-FIRST-TEST-2380: A device action needs the owner's explicit approval (question Q9: approve one camera to one lab TV in a joint session, or later).
- WISKEY-SVC-GRANT-2400: Waits for WisKey: a writer for native_service_grants_v1 on a manual install (plan section 5, Q-WK-4).
- WISKEY-LISTEN-2410: Waits for WisKey: the standalone listen downlink contract (plan section 5, Q-WK-5).
- WISKEY-EMERGENCY-LOCK-2410: Waits for WisKey: emergency secure support (today emergency_secure_unsupported_v1; plan section 5, Q-WK-7).
- WISKEY-RING-STATION-2410: Waits for WisKey and a device investigation: can the station be rung from the operator side (plan section 5, Q-WK-6).
- WISKEY-ADDENDUM-GAPS-0411: Owner: forward the addendum to the WisKey team; then waiting for WisKey's answers.
- OWNER-LAB-ACTIONS-0411: Owner actions on the lab installation and devices (Arx has no write permission for them).

## Backlog
| ID | Phase | Status | Task | Depends on |
|---|---|---|---|---|
| [T001](tasks/T001.md) | G0 | DONE | איסוף ומיפוי המקור הישן | — |
| [T002](tasks/T002.md) | G0 | DONE | מעבדת פיתוח והרשאות ייעודיות | — |
| [T003](tasks/T003.md) | G0 | BLOCKED | לכידת Golden traces מהמערכת הישנה | T001, T002 |
| [T004](tasks/T004.md) | G0 | BLOCKED | בדיקות Characterization והשוואת התנהגות | T003 |
| [T005](tasks/T005.md) | G0 | IN_PROGRESS | ביקורת סודות, רישיונות ותלויות | T001 |
| [T006](tasks/T006.md) | G0 | BACKLOG | הוכחת Playback ו־Seek מוקדמת | T003 |
| [T007](tasks/T007.md) | G0 | REVIEW | נעילת Design tokens ורכיבי בסיס | — |
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
| [T096](tasks/T096.md) | V1 | BLOCKED | התראות באפליקציית Android (CR-012) — השכמת FCM דרך ממסר, חלופת UnifiedPush | T092 |
| [T097](tasks/T097.md) | V1 | BACKLOG | חלל משותף לשתי קומות (CR-009) — אולם בגובה כפול, שלם בכל קומה | T085 |
| [T098](tasks/T098.md) | V1 | REVIEW | מולטימדיה - מסכים ושלט (CR-015): מסך המסכים, השלט, כרטיסי מדיה באזורים ובמסך הראשי | — |
| [T099](tasks/T099.md) | V1 | REVIEW | מולטימדיה שלב 2 - נגנים, רמקולים וקבוצות (CR-016): כרטיסים, חלונית נגן, קבוצות, מועדפים ותחנות | — |
| [T100](tasks/T100.md) | V1 | REVIEW | אוטומציות, סצנות וסקריפטים (CR-017): צפייה, הרצה, בונה בעברית, שמירה בטוחה דרך רכיב החיבור | — |
| [T101](tasks/T101.md) | V1 | REVIEW | התראות (CR-018): מרכז התראות אחד, מקורות מובנים, Push וטלפונים, העדפות אישיות, אישור והסלמה | — |
| [T102](tasks/T102.md) | V1 | REVIEW | תזמונים (CR-014): מסך תזמונים מעל רכיב התזמונים, הרשאות, ביטול ושחזור, אימות חי במעבדה | — |
| [T103](tasks/T103.md) | V1 | REVIEW | אפליקציית הטלפון - צד השרת (CR-027): רישום מכשירים, נוכחות וחיישנים, דחיפה דרך הממסר; כבוי כברירת מחדל | — |
| [T104](tasks/T104.md) | V1 | REVIEW | שידור וידאו למסכים (CR-028): מחקר, תוכנית בשלבים והכנה לקריאה בלבד - עמודת 'שידור' בהגדרות המולטימדיה | — |
| [T105](tasks/T105.md) | V1 | REVIEW | Provision-ISR: מקליטים ומצלמות (CR-025) - מתאם API v1 לקריאה, חיפוש, השמעה, ייצוא, אירועים | — |
| [T106](tasks/T106.md) | V1 | REVIEW | ניטור בריאות מקליטים (CR-026): שבעה מקורות התראה, הגדרות פר מקליט, עומק ל-Provision-ISR | — |
| [T107](tasks/T107.md) | V2 | REVIEW | מסך קיר לטאבלט קבוע (CR-030, WDM / WDX): משתמש קיר שמזוהה לפי טאבלט | — |
| [T108](tasks/T108.md) | V2 | REVIEW | גנרטורים (CR-031, GEN1): זיהוי לפי התקן, תרשים זרימת הספק, התראות וניתוב, היסטוריה | — |
| [T109](tasks/T109.md) | V1 | REVIEW | מתגים מוגנים (CR-019): ברירת מחדל 'כלול', הצעת סיווג, רשימת סקירה בהגדרות | — |
| [T110](tasks/T110.md) | V1 | REVIEW | הגדרות מצלמות ב-NVR (CR-020): טבלת מצלמות, כתיבה מוגנת (SVC / קידוד), שינוי לכמה מצלמות | — |
| [T111](tasks/T111.md) | V1 | REVIEW | עדכון והפעלה מחדש מתוך Arx (CR-021): בדיקת גרסה, עדכון באישור אחד, מסך מצב ששורד הפעלה מחדש | — |
| [T112](tasks/T112.md) | V1 | REVIEW | חיבור ה-NVR בתוך Arx (CR-022): סוג NVR, בדיקת חיבור לקריאה בלבד, שמירה מוצפנת, הפעלה מחדש | — |
| [T113](tasks/T113.md) | V1 | REVIEW | מוני חשמל וחיובי צריכה (CR-023): מונים, חשבונות, תעו״ז, קריאות ידניות וכיול, PDF | — |
| [T114](tasks/T114.md) | V1 | REVIEW | וריאנטים נוספים לסקין בועה (BV1): אריחי שעון ומזג אוויר, יומן, משגר מהיר, מחוונים אנכיים, מראה בלי משטח | — |
| [T115](tasks/T115.md) | V1 | REVIEW | בחירת מצלמות להשוואה כתפריט נפתח (CMP1 / CMP2): הקלטות › השוואה וניגון מסונכרן | — |
| [T116](tasks/T116.md) | V1 | BACKLOG | מקליטי Frigate (CR-029, NN5): צפייה וניגון (F1) ושליטה מוגנת (F2), כבוי כברירת מחדל | — |
| [T117](tasks/T117.md) | V1 | REVIEW | הכרזות קוליות (MU2): השמעת שורה מוקלדת ברמקולים מותרים, מגבלות קצב, יומן | — |
| [T118](tasks/T118.md) | V1 | REVIEW | הצעת הורדה לאפליקציית Android במסך הכניסה מרחוק (כבויה כברירת מחדל) | — |
| [WXD0](tasks/WXD0.md) | V1 | REVIEW | WisKey CR-033: Trusted-bridge fakes and vector oracle | — |
| [WXD1](tasks/WXD1.md) | V1 | REVIEW | WisKey CR-033: WisKey door map (explicit, single relay, manual) | WXD0 |
| [WXD2](tasks/WXD2.md) | V1 | REVIEW | WisKey CR-033: Access control station scope and placement | — |
| [WXD3](tasks/WXD3.md) | V1 | REVIEW | WisKey CR-033: One door authority rule, door opener role, grant card | WXD1, WXD2 |
| [WXD4](tasks/WXD4.md) | V1 | REVIEW | WisKey CR-033: trusted_door transport (interim + signed), audit fields, "sent" | WXD0, WXD3 |
| [WXD5A](tasks/WXD5A.md) | V1 | BACKLOG | WisKey CR-033: Bridge 0.8.1 execute block for WisKey doors (admin setting) | WXD4 |
| [WXD5B](tasks/WXD5B.md) | V1 | BLOCKED | WisKey CR-033: Bridge door_open / door_open_status | WXH1, WXD4 |
| [WXD6](tasks/WXD6.md) | V1 | REVIEW | WisKey CR-033: WisKey locks without lock.lock / lock-all | WXD1 |
| [WXD7](tasks/WXD7.md) | V1 | REVIEW | WisKey CR-033: Read-only door-path inventory and report | WXD1 |
| [WXD7R](tasks/WXD7R.md) | V1 | REVIEW | WisKey CR-033: Owner-approved inventory read on the installation | WXD7 |
| [WXD8](tasks/WXD8.md) | V1 | REVIEW | WisKey CR-033: Editor block setting (default blocked) | WXD7 |
| [WXD9](tasks/WXD9.md) | V1 | REVIEW | WisKey CR-033: Run guard for Arx-started runs (R-17) | WXD4, WXD7 |
| [WXD10A](tasks/WXD10A.md) | V1 | REVIEW | WisKey CR-033: Arx event door jobs (M1), disable-and-list | WXD9, WXD7R |
| [WXD10B](tasks/WXD10B.md) | V1 | REVIEW | WisKey CR-033: Hold-open program hand-over (M3) | WXD9, WXD7R |
| [WXD11](tasks/WXD11.md) | V1 | BACKLOG | WisKey CR-033: Door-path gate T1..T26 on fakes | WXD0, WXD1, WXD2, WXD3, WXD4, WXD5A, WXD5B, WXD6, WXD7, WXD7R, WXD8, WXD9, WXD10A, WXD10B |
| [WXG0](tasks/WXG0.md) | V1 | BACKLOG | WisKey CR-034: Merge WX3 gate tool to main | — |
| [WXG1](tasks/WXG1.md) | V1 | BACKLOG | WisKey CR-034: Gate: impact block, exit 5, gate:allow | WXG0 |
| [WXH0](tasks/WXH0.md) | V1 | REVIEW | WisKey CR-034: Rotation fakes | — |
| [WXH1](tasks/WXH1.md) | V1 | REVIEW | WisKey CR-034: Bridge multi-key verifier and rotate service | WXH0 |
| [WXH2](tasks/WXH2.md) | V1 | REVIEW | WisKey CR-034: Arx key set and rotation state machine | WXH0 |
| [WXH3](tasks/WXH3.md) | V1 | BLOCKED | WisKey CR-034: bridge.key.rotate, owner contacts, emergency notice | WXH2 |
| [WXH4](tasks/WXH4.md) | V1 | BLOCKED | WisKey CR-034: Fresh-key re-pair with verification, emergency revocation | WXH2, WXH3 |
| [WXH5](tasks/WXH5.md) | V1 | BLOCKED | WisKey CR-034: Maintenance screen and watchdog | WXH2, WXH4 |
| [WXH6](tasks/WXH6.md) | V1 | BLOCKED | WisKey CR-034: Anchor eligibility and capability status hand-over | WXH1, WXH4 |
| [WXH7](tasks/WXH7.md) | V1 | BLOCKED | WisKey CR-034: Rotation gate on fakes | WXH1, WXH2, WXH3, WXH4, WXH5, WXH6 |
| [ST7S0](tasks/ST7S0.md) | V2 | REVIEW | Plan Studio 6 S0: plan document 2.2 schema, material library, resolver, look settings | — |
| [ST7S4](tasks/ST7S4.md) | V2 | REVIEW | Plan Studio 6 S4: eye-level walk-through core | ST7S0 |
| [ST7S1](tasks/ST7S1.md) | V2 | REVIEW | Plan Studio 6 S1: material library and level-3 rendering | ST7S0 |
| [ST7S2](tasks/ST7S2.md) | V2 | REVIEW | Plan Studio 6 S2: sun, sky, time of day, lamps | ST7S1 |
| [ST7S5](tasks/ST7S5.md) | V2 | REVIEW | Plan Studio 6 S5: walk UX (touch, minimap, saved positions, kiosk) | ST7S4 |
| [ST7S3](tasks/ST7S3.md) | V2 | REVIEW | Plan Studio 6 S3: lighting bake, stills and storage | ST7S1, ST7S2 |
| [ST7S7](tasks/ST7S7.md) | V2 | REVIEW | Plan Studio 6 S7: performance gate, determinism and release | ST7S0, ST7S1, ST7S2, ST7S3, ST7S4, ST7S5 |
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
| [BILLSTART](tasks/BILLSTART.md) | V1 | REVIEW | Electricity bill start-reading bug | — |
| [ST7L](tasks/ST7L.md) | V2 | REVIEW | Plan Studio 6 look development: two rounds, LOOK_SPEC and CC0 assets | — |
| [ST7INT](tasks/ST7INT.md) | V2 | REVIEW | Plan Studio 6: integration on 2.4.6, migrations 0074-0075, gate and release | ST7S0, ST7S4, ST7S1, ST7S2, ST7S3 |
| [ST7SITE](tasks/ST7SITE.md) | V2 | REVIEW | Plan Studio 6: site location for the sun comes from the HA settings (latitude / longitude) | — |
| [ST7UI](tasks/ST7UI.md) | V2 | REVIEW | Plan Studio 6: editor UI (material per wall / room / item, north compass, saved walk positions) and plan.view settings screen | — |
| [ST7HIST](tasks/ST7HIST.md) | V2 | REVIEW | Plan Studio 6: level 3 also in the history map and the event page | — |
| [WXCR](tasks/WXCR.md) | V1 | REVIEW | WisKey: change requests CR-033 (door path) and CR-034 (key rotation) with the implementation plan | — |
| [WXIMP](tasks/WXIMP.md) | V1 | BLOCKED | WisKey importer on the Arx side (CR-035), stage 1: offline package intake, import manifest, staged install plan (fakes only) | — |
| [WXNS](tasks/WXNS.md) | V1 | REVIEW | WisKey native screens plan (CR-036): 49 screens and actions | — |
| [WXN01](tasks/WXN01.md) | V1 | REVIEW | WisKey native screens S0+S1: WisKey fake, pinned catalogue, last_access removal, background projection, channel guard | — |
| [WXN34](tasks/WXN34.md) | V1 | REVIEW | WisKey native screens S3+S4: new permissions, station and field filtering, adapter and read channel | WXN01, WXD2, WXD3 |
| [WXN5](tasks/WXN5.md) | V1 | REVIEW | WisKey native screens S5: design of the station, people, schedule and status screens | WXN01 |
| [WXN6](tasks/WXN6.md) | V1 | REVIEW | WisKey native screens S6-S10: stations and doors, people, events, schedules, status and groups | WXN34, WXN5 |
| [WXN11](tasks/WXN11.md) | V1 | BACKLOG | WisKey native screens S11-S14: station-scoped writes, per-screen switch, gate, lab verification | WXN6 |
| [WXW](tasks/WXW.md) | V2 | BACKLOG | WisKey new writes (including doors), allowed now by the owner decision | WXN11 |
| [WXAV](tasks/WXAV.md) | V2 | IN_PROGRESS | WisKey local live video and two-way audio (S18) | — |
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
| [SCHEDIMPACT-295](tasks/SCHEDIMPACT-295.md) | V1 | REVIEW | V-02 (Fable security review 4, medium, pre-existing basic mode): scheduled script / scene runs of Arx-only people go through the runnable allowlist and the bridge impact check | — |
| [ENTPOL-295](tasks/ENTPOL-295.md) | V1 | REVIEW | Owner decision 3 of 2026-10-21 (Fable security review 4, V-08): the automatic refusal while the service user is not restricted by an entity policy - fail closed on ambiguous policies and on a stale report (Home Assistant unreachable) | — |
| [WHOIN034-295](tasks/WHOIN034-295.md) | V1 | REVIEW | Who is in the building (board r034) and the geofence / beacon / Wi-Fi editors on screen (board r035), 2.16.0 | — |
| [GATEAUDIT-297](tasks/GATEAUDIT-297.md) | V1 | REVIEW | Gate audit and cleanup: classify the repeatedly failing / flaky / obsolete tests of the last 35 gate and nightly runs, remove duplicates, fix the bubble-freeze leftovers, re-take stale visual baselines, refresh the gate baselines | — |
| [GATELANES-297](tasks/GATELANES-297.md) | V1 | REVIEW | Gate lanes: pixel baselines for classic + domus only (tesla / crystal get a structural smoke), archive the September owner-round live specs, a non-blocking timing lane for the wall-clock tests | — |
| [WISKEYA06-297](tasks/WISKEYA06-297.md) | V1 | REVIEW | WisKey A06 (T06, W-031, board r152): identity source + role + scope -> admission, working-state mapping (fakes) | — |
| [EXTERNALBUILD-297](tasks/EXTERNALBUILD-297.md) | V1 | REVIEW | External access built to full scope (X0-X6 of EXTERNALSPEC-297 + one-time code + CR-VISITOR105 visitors), fakes only, OFF by default | — |
| [DOORWRITE-297](tasks/DOORWRITE-297.md) | V1 | REVIEW | Door-window program written from Arx to WisKey (board r129): validate, read-back proof, drift, retries, dry run, write again | — |
| [XSECFIX-297](tasks/XSECFIX-297.md) | V1 | DONE | Security review 2026-10-27 (phone apps): the four medium findings M1-M4 - presence gate exact match, device credentials end on sign-out, failure limiter per source, arx://open waits for the app lock | — |
| [MOTIONSETTING-297](tasks/MOTIONSETTING-297.md) | V1 | REVIEW | Motion setting ui.motion (auto | full | reduced), separate from the skin and the scheme | — |
| [SPLITSWITCH2-297](tasks/SPLITSWITCH2-297.md) | V1 | REVIEW | Emergency-buttons switch is a setting (owner q48): default on, admin-only, audited, confirmed when turned off; a gate on the build flags, never an activation | — |
| [CURVEDGATE-297](tasks/CURVEDGATE-297.md) | V1 | REVIEW | Curved walls stage 1a: the two live curved-wall browser specs (evidence-curved-walls, evidence-curve-points) join the release gate's fixture phase | — |
| [XSECFOLLOW-297](tasks/XSECFOLLOW-297.md) | V1 | DONE | Security review 2026-10-27 follow-ups of XSECFIX-297: the presence block on WebSockets, phone credentials end on a password change / reset and a forced second factor, ?do=run and Android tests | — |
| [SUPPLIERDOCS-297](tasks/SUPPLIERDOCS-297.md) | V1 | REVIEW | Supplier certificate reading, slice 1: text-layer PDFs into proposed fields decided field by field (OFF by default, PROVISIONAL on owner questions q52-q56) | — |
| [SUPPLIERDOCS2-297](tasks/SUPPLIERDOCS2-297.md) | V1 | REVIEW | Supplier documents: migration renumbered to 0182 after release/2241, merge of release/2241, security review with fixes F1-F3 and F6 | — |
| [CALENDARS-UI-2310](tasks/CALENDARS-UI-2310.md) | V1 | REVIEW | Calendars UI: booking calendars, approvals, maintenance calendar, resident view, sync settings (owner answers 30.10) | — |
| [TEMPREPORT-2310](tasks/TEMPREPORT-2310.md) | V1 | REVIEW | Temperature report: security review and hardening of the report link and WhatsApp send | — |
| [WORSTCASE-2310](tasks/WORSTCASE-2310.md) | V1 | REVIEW | Worst-case data on the main screens: long names, empty states, huge counts, no scrolling | — |
| [POLISH-PHONE-2310](tasks/POLISH-PHONE-2310.md) | V1 | REVIEW | Phone layer polish: chips and switch hit areas | — |
| [ENTRY-CHECK-2310](tasks/ENTRY-CHECK-2310.md) | V1 | REVIEW | Gate: runner entry check before a release train + 7-day quarantine list | — |
| [WISKEY-RC4-2310](tasks/WISKEY-RC4-2310.md) | V1 | REVIEW | WisKey rc.4 adoption + rc.5 host check (deadline fix, migration 0186, relay-by-door fix) | — |
| [PRESENCE-COMPACT-2310](tasks/PRESENCE-COMPACT-2310.md) | V1 | REVIEW | Presence card: compact redesign (owner rejected the tall card 30.10) | — |
| [COORD-DOCS-2310](tasks/COORD-DOCS-2310.md) | V1 | REVIEW | Multi-Claude coordination protocol as documents and an optional tool | — |
| [LICENSE-2310](tasks/LICENSE-2310.md) | V1 | REVIEW | Proprietary all-rights-reserved licence notice; internal review notes untracked | — |
| [DEPAUDIT-2310](tasks/DEPAUDIT-2310.md) | V1 | REVIEW | Dependency, licence and secrets audit refreshed for v2.29.0 | — |
| [TASKS-SYNC-3110](tasks/TASKS-SYNC-3110.md) | V1 | REVIEW | Task registry matched to the code history after 2.29.0 | — |
| [A11Y-2310](tasks/A11Y-2310.md) | V1 | REVIEW | The shared dialog keeps the keyboard focus inside its box | — |
| [GDRIVEBK-2310](tasks/GDRIVEBK-2310.md) | V1 | REVIEW | Google Drive as an off-box backup target (device-flow OAuth, off by default) | — |
| [DEPFIX-2310](tasks/DEPFIX-2310.md) | V1 | REVIEW | Dependency security fixes: Pillow 13, paramiko 5, format-restricted image decodes | — |
| [DEPHARDEN-2310](tasks/DEPHARDEN-2310.md) | V1 | REVIEW | Worker dev tooling hardened; add-on base image pinned by digest (pin reverted in 2.31.1) | — |
| [SYNOPTIC-HA-2310](tasks/SYNOPTIC-HA-2310.md) | V1 | REVIEW | Synoptic map and building cross-section read every home-system floor; floor mapping editor | — |
| [ADDON-IMAGE-BUILD-FIXES-2311](tasks/ADDON-IMAGE-BUILD-FIXES-2311.md) | V1 | REVIEW | Add-on image build fixes in 2.31.1 and 2.33.3 | — |
| [PUBSURF-2310](tasks/PUBSURF-2310.md) | V1 | REVIEW | Public surfaces re-check before document links; module gate and CDN no-store on document answers | — |
| [TEMPLINK-2320](tasks/TEMPLINK-2320.md) | V1 | REVIEW | Report links: revoke on user deactivation, per-sender daily limit | — |
| [UIPOLISH-2320](tasks/UIPOLISH-2320.md) | V1 | REVIEW | Phone switch 44 px touch target and readable dark-mode muted text | — |
| [LEGAL-WKMIT-2320](tasks/LEGAL-WKMIT-2320.md) | V1 | REVIEW | Licence notice of the WisKey embed reference client (MIT) ships with the product | — |
| [PROVISION-BACKCHANNEL-2320](tasks/PROVISION-BACKCHANNEL-2320.md) | V1 | REVIEW | Provision-ISR live and playback: video-only stream request, talk-back as a recorder setting | — |
| [SWITCH-AS-LIGHT-2321](tasks/SWITCH-AS-LIGHT-2321.md) | V1 | REVIEW | A switch typed as a light counts and acts as lighting | — |
| [SYN-COLUMNS-2321](tasks/SYN-COLUMNS-2321.md) | V1 | REVIEW | Synoptic map hides columns without a data source; custom board columns | — |
| [CAL-SWITCH-REACH-2321](tasks/CAL-SWITCH-REACH-2321.md) | V1 | REVIEW | Calendars module switch reachable while the module is off | — |
| [MULTIBUILDING-HOME-2330](tasks/MULTIBUILDING-HOME-2330.md) | V1 | REVIEW | Multi-building home: site level, building cards, building switch, shared building | — |
| [MAPPING-ASSIST-2330](tasks/MAPPING-ASSIST-2330.md) | V1 | REVIEW | Mapping assistant: which home-system name belongs to which building | — |
| [CALCONNECT-2330](tasks/CALCONNECT-2330.md) | V1 | REVIEW | External calendar connections: iCal subscription, Google Calendar, Microsoft 365 / Outlook | — |
| [SWITCH-LIGHT-DIMMER-2331](tasks/SWITCH-LIGHT-DIMMER-2331.md) | V1 | REVIEW | No dimmer on on/off lights; switches in the synoptic lights column; floor lights popup | — |
| [EVENTS-POLISH-2331](tasks/EVENTS-POLISH-2331.md) | V1 | REVIEW | Event centre polish (Security > Investigate > Events) | — |
| [SETTINGS-TABS-SCROLL-2331](tasks/SETTINGS-TABS-SCROLL-2331.md) | V1 | REVIEW | Scroll arrows, wheel, swipe and keys for long tab strips | — |
| [TREE-HIDE-UNASSIGNED-2331](tasks/TREE-HIDE-UNASSIGNED-2331.md) | V1 | REVIEW | Hide "ללא שיוך" from the building tree | — |
| [AZIA-LIVE-2331](tasks/AZIA-LIVE-2331.md) | V1 | REVIEW | Provision-ISR live video steadier on a full wall of cameras | — |
| [SEGFAULT-PLAYBACK-2332](tasks/SEGFAULT-PLAYBACK-2332.md) | V1 | REVIEW | The add-on recovers by itself after a crash during recorded-playback scrubbing | — |
| [OWNER-R12-2341](tasks/OWNER-R12-2341.md) | V1 | REVIEW | Owner answers of 01.11 (round 12): wording, unassigned section, tablet side panel | — |
| [POLISH-LEFTOVERS-2341](tasks/POLISH-LEFTOVERS-2341.md) | V1 | REVIEW | Three leftovers of the 2.33.1 polish round | — |
| [LIVE-H265-2341](tasks/LIVE-H265-2341.md) | V1 | REVIEW | Live video of H.265 cameras in browsers that cannot decode H.265 | — |
| [NVR-H264-BULK-2341](tasks/NVR-H264-BULK-2341.md) | V1 | REVIEW | Switch every camera stream to H.264 from the UI; per-recorder NVR writes switch | — |
| [SHARED-POLISH-2342](tasks/SHARED-POLISH-2342.md) | V1 | REVIEW | Shared-layer proposals of the design-polish round | — |
| [TICKETS-POLISH-2331](tasks/TICKETS-POLISH-2331.md) | V1 | REVIEW | Service requests: one compact toolbar for the list and the manager board | — |
| [TKSET-POLISH-2331](tasks/TKSET-POLISH-2331.md) | V1 | REVIEW | Service request settings and side screens polish | — |
| [DEVICES-POLISH-2331](tasks/DEVICES-POLISH-2331.md) | V1 | REVIEW | Layout editor, device controls and automations screen polish | — |
| [ACCESS-POLISH-2331](tasks/ACCESS-POLISH-2331.md) | V1 | REVIEW | People and access administration polish (wave 1) | — |
| [CALMSG-POLISH-2331](tasks/CALMSG-POLISH-2331.md) | V1 | REVIEW | Calendars and messaging settings polish | — |
| [MEDIA-POLISH-2331](tasks/MEDIA-POLISH-2331.md) | V1 | REVIEW | Media and doors polish (wave 3) | — |
| [WKWATER-POLISH-2331](tasks/WKWATER-POLISH-2331.md) | V1 | REVIEW | WisKey stations and water pages polish (wave 3) | — |
| [LOOK-POLISH-2331](tasks/LOOK-POLISH-2331.md) | V1 | REVIEW | Look and branding settings polish (wave 2, part A) | — |
| [CAMADMIN-POLISH-2331](tasks/CAMADMIN-POLISH-2331.md) | V1 | REVIEW | Camera administration polish (wave 3) | — |
| [SCHED-POLISH-2331](tasks/SCHED-POLISH-2331.md) | V1 | REVIEW | Automations and schedules administration polish (wave 3) | — |
| [INVREST-POLISH-2331](tasks/INVREST-POLISH-2331.md) | V1 | REVIEW | Investigation leftovers polish (cases, one case, exports, event page) | — |
| [INSIGHTS-POLISH-2331](tasks/INSIGHTS-POLISH-2331.md) | V1 | REVIEW | Insights and infrastructure reports polish (wave 3) | — |
| [HOMEEDIT-POLISH-2331](tasks/HOMEEDIT-POLISH-2331.md) | V1 | REVIEW | Home editing screens polish (wave 3) | — |
| [SETUPPLAN-POLISH-2331](tasks/SETUPPLAN-POLISH-2331.md) | V1 | REVIEW | Setup and plan administration polish (wave 3) | — |
| [TABSMODE-POLISH-2331](tasks/TABSMODE-POLISH-2331.md) | V1 | REVIEW | Tabs display settings polish (wave 2, part B) | — |
| [PLAYBACK-SCRUB-2341](tasks/PLAYBACK-SCRUB-2341.md) | V1 | REVIEW | Smooth recorded playback under fast scrubbing | — |
| [ASYNCIO-DEFAULT-2342](tasks/ASYNCIO-DEFAULT-2342.md) | V1 | REVIEW | The server runs on asyncio and h11 by default (uvloop and httptools opt-in) | — |
| [WRITE-GATE-EVENTS-2341](tasks/WRITE-GATE-EVENTS-2341.md) | V1 | REVIEW | False "write gate held outside a transaction" log alarm removed | — |
| [FRIGATE-FORBIDDEN-2341](tasks/FRIGATE-FORBIDDEN-2341.md) | V1 | REVIEW | Refused Frigate credentials: one health item instead of a flooded log | — |
| [SUPERVISOR-BUILD-GATE-2341](tasks/SUPERVISOR-BUILD-GATE-2341.md) | V1 | REVIEW | Release gate proves the add-on image builds the way the Supervisor builds it | — |
| [A11Y-POLISHED-2342](tasks/A11Y-POLISHED-2342.md) | V1 | REVIEW | Accessibility pass over the screens polished on 31.10 and 01.11 | — |
| [DARK-REVIEW-2342](tasks/DARK-REVIEW-2342.md) | V1 | REVIEW | Dark-mode review of the screens polished on 01.11 | — |
| [HOME-DEVICES-LOAD-2342](tasks/HOME-DEVICES-LOAD-2342.md) | V1 | REVIEW | Faster home and devices screens: lazy screens, settings in two queries, shared requests | — |
| [PHONE-BUTTONS-44-2342](tasks/PHONE-BUTTONS-44-2342.md) | V1 | REVIEW | The shared button is 44 px high on a phone | — |
| [SYNOPTIC-MOBILE-2342](tasks/SYNOPTIC-MOBILE-2342.md) | V1 | REVIEW | The synoptic map on phones in three layouts | — |
| [SMALL-UI-BUGS-2343](tasks/SMALL-UI-BUGS-2343.md) | V1 | REVIEW | Tickets table width at 1440 and 1280 px; settings tab duplication | — |
| [GATE2342](tasks/GATE2342.md) | V1 | REVIEW | Release gate fixes of 2.34.2 (groups A, B, C and the pixel side) | — |
| [CAL-GRID-EDIT-2343](tasks/CAL-GRID-EDIT-2343.md) | V1 | REVIEW | Outlook-style editing on the calendar grid | — |
| [CAL-ATTENDEES-2343](tasks/CAL-ATTENDEES-2343.md) | V1 | REVIEW | Named attendees of calendar entries | — |
| [DB-CONN-POOL-2343](tasks/DB-CONN-POOL-2343.md) | V1 | REVIEW | Reuse SQLite connections between requests | — |
| [PRE-GATE-2350](tasks/PRE-GATE-2350.md) | V1 | REVIEW | Browser and backend evidence before the 2.35.0 gate | — |
| [GATE2350-A](tasks/GATE2350-A.md) | V1 | REVIEW | Release gate of 2.35.0: the six backend failures | — |
| [NOTICE-BOARD-106](tasks/NOTICE-BOARD-106.md) | V1 | REVIEW | Building notice board with TV screens (CR-NOTICE106) and the 2.18.0 overhaul | — |
| [NOTICE-BOARD-FOLLOWUPS-295](tasks/NOTICE-BOARD-FOLLOWUPS-295.md) | V1 | REVIEW | Notice board follow-ups: news sources, deletion, TV options, removal fix, nearby bus times | — |
| [TVNOTICE-297](tasks/TVNOTICE-297.md) | V1 | REVIEW | TV notice board V2 design and the owner answers of 27.10 | — |
| [LOBBY-STYLES-2290](tasks/LOBBY-STYLES-2290.md) | V1 | REVIEW | Lobby screen styles (Gallery, Concierge, Stone, Lumen, Axis, Prism, Ink and Sign) | — |
| [MOBILE-APP-SERVER-295](tasks/MOBILE-APP-SERVER-295.md) | V1 | REVIEW | Phone-app server side: saved sign-in, device key, WebView session exchange, attestation, critical sound | — |
| [NOTICEPUSH-295](tasks/NOTICEPUSH-295.md) | V1 | REVIEW | Push on publish for the notice board to the phone app channel | — |
| [HA-LABELS-SYNC-2351](tasks/HA-LABELS-SYNC-2351.md) | V1 | REVIEW | Home-system labels synced into Arx (read-only) for the mapping assistant | — |
| [CAL-FEED-REVIEW-2351](tasks/CAL-FEED-REVIEW-2351.md) | V1 | REVIEW | Security review of the outgoing iCal feed; remote switch, busy-only, 365-day expiry | — |
| [GDRIVE-READY-2351](tasks/GDRIVE-READY-2351.md) | V1 | REVIEW | Google Drive backup ready for the owner's first real connection | — |
| [HOME-EDIT-DRAWER-2351](tasks/HOME-EDIT-DRAWER-2351.md) | V1 | REVIEW | Home screen edit mode in a drawer | — |
| [AREA-PRESENCE-LINE-2351](tasks/AREA-PRESENCE-LINE-2351.md) | V1 | REVIEW | Presence line in the area screen and quick pop-up | — |
| [XS-MINI-WIDGET-2351](tasks/XS-MINI-WIDGET-2351.md) | V1 | REVIEW | Mini building cross-section on the home widgets row | — |
| [MAPPING-IMPROVE-2351](tasks/MAPPING-IMPROVE-2351.md) | V1 | REVIEW | Mapping: floors without a level asked about; auto-insert in the background | — |
| [BUILDING-SCOPE-CONTROL-2351](tasks/BUILDING-SCOPE-CONTROL-2351.md) | V1 | REVIEW | "Show and control" per building on a multi-building site | — |
| [PRE-GATE-2360](tasks/PRE-GATE-2360.md) | V1 | REVIEW | Runner checks before the 2.36.0 release gate | — |
| [SYNOPTIC-PHONE-SETTINGS-2360](tasks/SYNOPTIC-PHONE-SETTINGS-2360.md) | V1 | REVIEW | Phone synoptic map: light and summary-line settings | — |
| [TICKETS-1440-COLUMN-SETTING-2360](tasks/TICKETS-1440-COLUMN-SETTING-2360.md) | V1 | REVIEW | Tickets table: which column the default table keeps at a medium width | — |
| [RELEASE-2360-TRAIN](tasks/RELEASE-2360-TRAIN.md) | V1 | REVIEW | Release train 2.36.0 (building scope, mapping, labels, feed review, GDrive ready, home edit drawer, presence line, xs widget) | — |
| [CAM-H264-VERIFY-2361](tasks/CAM-H264-VERIFY-2361.md) | V1 | REVIEW | Verify a bulk encoding change at the camera, per-channel report, skip a refused camera | — |
| [RELEASE-2361-TRAIN](tasks/RELEASE-2361-TRAIN.md) | V1 | REVIEW | Release train 2.36.1 (camera H.264 verification) | — |
| [POLISH4-WP1-SHARED-2370](tasks/POLISH4-WP1-SHARED-2370.md) | V1 | REVIEW | Polish round 4, WP1: shared stage 2 and the shell pill | — |
| [POLISH4-WP2-LIVEINV-2370](tasks/POLISH4-WP2-LIVEINV-2370.md) | V1 | REVIEW | Polish round 4, WP2: live and investigation screens | — |
| [POLISH4-WP3-SERVICE-2370](tasks/POLISH4-WP3-SERVICE-2370.md) | V1 | REVIEW | Polish round 4, WP3: the service area | — |
| [POLISH4-WP4-HOME-2370](tasks/POLISH4-WP4-HOME-2370.md) | V1 | REVIEW | Polish round 4, WP4: home and devices | — |
| [POLISH4-WP5-MEDIA-2370](tasks/POLISH4-WP5-MEDIA-2370.md) | V1 | REVIEW | Polish round 4, WP5: multimedia, cast, generator, electricity | — |
| [POLISH4-WP6-MAPS-2370](tasks/POLISH4-WP6-MAPS-2370.md) | V1 | REVIEW | Polish round 4, WP6: maps and plan | — |
| [POLISH4-WP7-SETSYS-2370](tasks/POLISH4-WP7-SETSYS-2370.md) | V1 | REVIEW | Polish round 4, WP7: settings (system) | — |
| [POLISH4-WP8-SETMOD-2370](tasks/POLISH4-WP8-SETMOD-2370.md) | V1 | REVIEW | Polish round 4, WP8: settings (modules) and the transit check button | — |
| [TRANSIT-CHECK-2370](tasks/TRANSIT-CHECK-2370.md) | V1 | REVIEW | Transit settings: "בדוק עכשיו" check button and route (owner-approved addition, 02.11 evening) | — |
| [UNLOCK-REASON-2370](tasks/UNLOCK-REASON-2370.md) | V1 | REVIEW | Say why a lock cannot be opened: one unlock_reason rule behind can_unlock | — |
| [RELEASE-2370-TRAIN](tasks/RELEASE-2370-TRAIN.md) | V1 | REVIEW | Release train 2.37.0 (polish round 4, transit check, unlock reason) | — |
| [WISKEY-RC7-ADOPT-2331](tasks/WISKEY-RC7-ADOPT-2331.md) | V1 | REVIEW | WisKey Mac rc.7 adoption with auto-install policy B (the owner's switch) | — |
| [APP-TEAM-R11-2380](tasks/APP-TEAM-R11-2380.md) | V1 | REVIEW | Mobile M1: app-team R11 package (documents only) | T103 |
| [MOBILE-CONTRACT-V22-2380](tasks/MOBILE-CONTRACT-V22-2380.md) | V1 | REVIEW | Mobile M2: presence contract v2.2 (sensor shapes, intervals defaults, key-rotation proof) | — |
| [APP-SERVER-LEFTOVERS-2380](tasks/APP-SERVER-LEFTOVERS-2380.md) | V1 | REVIEW | Mobile M3: brand-logo API for the apps; quiet-window hold narrowed to phone and browser push | — |
| [PUSH-GOLIVE-KIT-2380](tasks/PUSH-GOLIVE-KIT-2380.md) | V1 | REVIEW | Mobile M4: push go-live kit and supervised field-test script | — |
| [TV-FIT-2380](tasks/TV-FIT-2380.md) | V1 | REVIEW | Display D1: TV fit - portrait footer chips, crest logo, Hebrew-date fallback, overscan margin | — |
| [REAL-TV-SESSION-2380](tasks/REAL-TV-SESSION-2380.md) | V1 | BLOCKED | Display D2: real-TV runbook, joint session and fixes | TV-FIT-2380 |
| [BOARD-ADMIN-2380](tasks/BOARD-ADMIN-2380.md) | V1 | REVIEW | Display D3: notice board administration (chips providers, screen count, copy link, re-send, editor role) | POLISH4-WP8-SETMOD-2370 |
| [CAST-FIRST-TEST-2380](tasks/CAST-FIRST-TEST-2380.md) | V1 | BLOCKED | Display D4: first physical cast test and phase-2 decision memo | T104, POLISH4-WP5-MEDIA-2370 |
| [WALL-FOLLOWUPS-2380](tasks/WALL-FOLLOWUPS-2380.md) | V1 | REVIEW | Display D5: wall display follow-ups (desktop wall mode, foldable detection, AT221 / AT301 evidence) | POLISH4-WP2-LIVEINV-2370, T107 |
| [ROUND4-LEFTOVERS-2380](tasks/ROUND4-LEFTOVERS-2380.md) | V1 | REVIEW | Display U1: polish round 4 leftovers (WisKey area, calendars D22, compact presence card redesign) | WISKEY-RC7-ADOPT-2331 |
| [RELEASE-2380-TRAIN](tasks/RELEASE-2380-TRAIN.md) | V1 | REVIEW | Release train 2.38.0 (display and mobile server; features off by default) | RELEASE-2370-TRAIN |
| [REGISTRY-UPDATE-2380](tasks/REGISTRY-UPDATE-2380.md) | V1 | REVIEW | Registry H1: tasks.json and test_catalog brought up to date after v2.35.0 | — |
| [RELEASE-2371-WISKEY](tasks/RELEASE-2371-WISKEY.md) | V1 | REVIEW | Release 2.37.1: WisKey alignment (rc.39 native component, one restart decision, readiness, station still) | — |
| [GATE2370](tasks/GATE2370.md) | V1 | REVIEW | Release gate fixes of 2.37.0 (groups A-D) | — |
| [TV-SETTINGS-2380](tasks/TV-SETTINGS-2380.md) | V1 | REVIEW | Display: notice TV settings rows (2.38.0) | — |
| [DARK-SEG-ALL-2380](tasks/DARK-SEG-ALL-2380.md) | V1 | REVIEW | Dark mode: readable chosen option of every segmented switch | — |
| [PUSH-RELAY-SAFE-2380](tasks/PUSH-RELAY-SAFE-2380.md) | V1 | REVIEW | Push relay safety: push stays off while the relay is not live | — |
| [A11Y-R4-LEFTOVERS-2380](tasks/A11Y-R4-LEFTOVERS-2380.md) | V1 | REVIEW | Accessibility leftovers of polish round 4 | — |
| [GATE2380](tasks/GATE2380.md) | V1 | REVIEW | Release gate fixes of 2.38.0 (groups A-B) | — |
| [STATION-WS-PATH-2381](tasks/STATION-WS-PATH-2381.md) | V1 | REVIEW | Fix: one api/v1 prefix for the station live, listen and talk sockets | — |
| [RELEASE-2381](tasks/RELEASE-2381.md) | V1 | REVIEW | Release 2.38.1: station sockets fix | — |
| [RELEASE-2382-TRAIN](tasks/RELEASE-2382-TRAIN.md) | V1 | REVIEW | Release train 2.38.2 (WisKey activation, TV chips, dialog top layer, board management) | — |
| [TV-CHIPS-2381](tasks/TV-CHIPS-2381.md) | V1 | REVIEW | Display: TV footer chips | — |
| [DIALOG-TOPLAYER-2381](tasks/DIALOG-TOPLAYER-2381.md) | V1 | REVIEW | Shared dialog in the browser top layer | — |
| [WISKEY-TALK-DIAL-2382](tasks/WISKEY-TALK-DIAL-2382.md) | V1 | REVIEW | WisKey A-a: talk end to end, the provider row and native dial | — |
| [WISKEY-TALK-CAPS-2382](tasks/WISKEY-TALK-CAPS-2382.md) | V1 | REVIEW | WisKey: choose the W10 provider from the signed direct capabilities | — |
| [WISKEY-PAIRING-2382](tasks/WISKEY-PAIRING-2382.md) | V1 | REVIEW | WisKey A-b: pairing status, signed check, guided re-pair, "מצב WisKey" | — |
| [WISKEY-MANAGED-INSTALL-2382](tasks/WISKEY-MANAGED-INSTALL-2382.md) | V1 | REVIEW | WisKey A-c: Arx-managed install and upgrade (owner-started, policy B) | — |
| [WISKEY-INBOUND-CALLS-2382](tasks/WISKEY-INBOUND-CALLS-2382.md) | V1 | REVIEW | WisKey A-e: inbound station calls in Arx | — |
| [WISKEY-JOIN-LIVE-2382](tasks/WISKEY-JOIN-LIVE-2382.md) | V1 | REVIEW | WisKey T1: direct join starts and stops at runtime | — |
| [WISKEY-RC10-PIN-2382](tasks/WISKEY-RC10-PIN-2382.md) | V1 | REVIEW | WisKey T2: command contract re-pinned to 2.0.1-rc.10 | — |
| [WISKEY-STATUS-PAGE-2382](tasks/WISKEY-STATUS-PAGE-2382.md) | V1 | REVIEW | WisKey T3: "מצב WisKey" status page | — |
| [WISKEY-STATION-OPS-2390](tasks/WISKEY-STATION-OPS-2390.md) | V1 | REVIEW | WisKey T4: station maintenance actions (sync, rescan, health and clock refresh) | — |
| [WISKEY-CONFLICTS-2390](tasks/WISKEY-CONFLICTS-2390.md) | V1 | REVIEW | WisKey T5: conflicts resolve and fleet alert actions | — |
| [WISKEY-DOOR-TECH-2390](tasks/WISKEY-DOOR-TECH-2390.md) | V1 | REVIEW | WisKey T6: door technical writes (hold-open schedules, public codes, programs) | — |
| [WISKEY-SCHED-WRITE-2390](tasks/WISKEY-SCHED-WRITE-2390.md) | V1 | REVIEW | WisKey T7: device schedule library writes | — |
| [WISKEY-PROFILES-EDIT-2390](tasks/WISKEY-PROFILES-EDIT-2390.md) | V1 | REVIEW | WisKey T8: groups and profile fields editing | — |
| [WISKEY-PEOPLE-COMPLETE-2390](tasks/WISKEY-PEOPLE-COMPLETE-2390.md) | V1 | REVIEW | WisKey T9: people completeness (PIN and duplicate checks, unmanaged users) | — |
| [WISKEY-ACCESS-DIAG-2400](tasks/WISKEY-ACCESS-DIAG-2400.md) | V1 | REVIEW | WisKey T10: access diagnostics views | — |
| [WISKEY-OPS-VIEWS-2400](tasks/WISKEY-OPS-VIEWS-2400.md) | V1 | REVIEW | WisKey T11: operations and fleet views | — |
| [WISKEY-WA-QUEUE-2400](tasks/WISKEY-WA-QUEUE-2400.md) | V1 | REVIEW | WisKey T12: messaging completion on the installed client | — |
| [WISKEY-VISITS-2400](tasks/WISKEY-VISITS-2400.md) | V1 | BACKLOG | WisKey T13: visits and guest templates decision and bridge | — |
| [WISKEY-CLOCK-VIEW-2400](tasks/WISKEY-CLOCK-VIEW-2400.md) | V1 | REVIEW | WisKey T14: clock / NTP and WisKey media options view | — |
| [WISKEY-EVENT-CURSOR-2390](tasks/WISKEY-EVENT-CURSOR-2390.md) | V1 | REVIEW | WisKey T15: gap-free events after a restart (event cursor) | — |
| [WISKEY-LIVE-VALIDATION-2390](tasks/WISKEY-LIVE-VALIDATION-2390.md) | V1 | REVIEW | WisKey T16: live validation screen for commissioning | — |
| [WISKEY-SVC-GRANT-2400](tasks/WISKEY-SVC-GRANT-2400.md) | V1 | BLOCKED | WisKey T17: service-write grant path | — |
| [WISKEY-DEEPLINKS-2382](tasks/WISKEY-DEEPLINKS-2382.md) | V1 | REVIEW | WisKey T18: deep links into the embedded panel for everything not native | — |
| [WISKEY-ACTIVATION-RUNBOOK-0411](tasks/WISKEY-ACTIVATION-RUNBOOK-0411.md) | V1 | REVIEW | WisKey T19: activation runbook for the 04.11 joint session | — |
| [WISKEY-LISTEN-2410](tasks/WISKEY-LISTEN-2410.md) | V1 | BLOCKED | WisKey T20: standalone listen to a station | — |
| [WISKEY-EMERGENCY-LOCK-2410](tasks/WISKEY-EMERGENCY-LOCK-2410.md) | V1 | BLOCKED | WisKey T21: emergency LOCK / secure | — |
| [WISKEY-RING-STATION-2410](tasks/WISKEY-RING-STATION-2410.md) | V1 | BLOCKED | WisKey T22: operator-initiated ringing call to a station | — |
| [WISKEY-INSTALLER-NATIVE-2400](tasks/WISKEY-INSTALLER-NATIVE-2400.md) | V1 | REVIEW | WisKey installer tools natively in Arx (platform, clock, station technical settings) | — |
| [RELEASE-2390-TRAIN](tasks/RELEASE-2390-TRAIN.md) | V1 | REVIEW | Release 2.39.0: WisKey operator writes, people completeness, live validation, managed install | — |
| [BRIDGE-STALE-DISCOVERY-2383](tasks/BRIDGE-STALE-DISCOVERY-2383.md) | V1 | REVIEW | Fix: a stale discovery no longer puts an old pairing code back into the bridge (bridge 0.10.3) | — |
| [RELEASE-2391](tasks/RELEASE-2391.md) | V1 | REVIEW | Release 2.39.1: the Arx bridge keeps its pairing after a re-pair and after restarts | — |
| [VIDEO-TRANSPORT-2400](tasks/VIDEO-TRANSPORT-2400.md) | V1 | REVIEW | Live video: one transport decision executed by every player; personal choice in My account; stalled-picture recovery | — |
| [TTS-DEFAULT-ENGINE-2400](tasks/TTS-DEFAULT-ENGINE-2400.md) | V1 | REVIEW | Announcements: a fixed TTS engine and language, overridable per send | — |
| [PRESENCE-COUNT-2400](tasks/PRESENCE-COUNT-2400.md) | V1 | REVIEW | Presence card "count and names" as the new default style | — |
| [WALL-ANSWERS-2400](tasks/WALL-ANSWERS-2400.md) | V1 | REVIEW | Wall displays: owner answers 18-20 (open-foldable setting, portrait health chip once, kiosk header on a phone) | — |
| [BOARD-ANSWERS-2400](tasks/BOARD-ANSWERS-2400.md) | V1 | REVIEW | Notice boards: owner answers 12-17 (legacy link kept on TV connect, "invert" for parking and gym sources) | — |
| [WISKEY-OPS-ANSWERS-2400](tasks/WISKEY-OPS-ANSWERS-2400.md) | V1 | REVIEW | WisKey operations: owner answers 04.11 (maintenance role, permission label, deploy warning, talk reasons) | — |
| [WISKEY-INSTALL-ANSWERS-2400](tasks/WISKEY-INSTALL-ANSWERS-2400.md) | V1 | REVIEW | WisKey managed install: owner answers 04.11 (access-control settings group, start-up install switch, kept runs) | — |
| [RELEASE-2400-TRAIN](tasks/RELEASE-2400-TRAIN.md) | V1 | REVIEW | Release 2.40.0: video transport, fixed TTS engine, installer tools, presence card, owner answers round 18 | — |
| [BRIDGE-UPDATE-LISTENER-2401](tasks/BRIDGE-UPDATE-LISTENER-2401.md) | V1 | REVIEW | Bridge 0.10.4: update listener and config-flow reload no longer combine (home system 2026.12) | — |
| [WALL-PHONE-TOOLBAR-2401](tasks/WALL-PHONE-TOOLBAR-2401.md) | V1 | REVIEW | Phone camera wall: one row of icon keys, two rows of full labels as a setting | — |
| [SETTINGS-INTERCOM-CARDS-2401](tasks/SETTINGS-INTERCOM-CARDS-2401.md) | V1 | REVIEW | "Entrance screen switches" settings tab as folding cards (two tabs or one list as options) | — |
| [RELEASE-2401-TRAIN](tasks/RELEASE-2401-TRAIN.md) | V1 | REVIEW | Release 2.40.1: phone wall toolbar, intercom settings cards, bridge 0.10.4 | — |
| [WISKEY-LAB-ACTIVATION-0411](tasks/WISKEY-LAB-ACTIVATION-0411.md) | V1 | IN_PROGRESS | WisKey activation on the lab installation (04.11 joint session) | — |
| [LAB-AUDITS-0411](tasks/LAB-AUDITS-0411.md) | V1 | REVIEW | Read-only lab audits of 04.11: logs and faults, station and camera video, door events and station users | — |
| [LAB-NVR-DOOR-READONLY-0411](tasks/LAB-NVR-DOOR-READONLY-0411.md) | V1 | REVIEW | Read-only checks of 04.11 evening: recorder sub streams of two panoramic cameras, door contact input on one station | — |
| [WISKEY-ADDENDUM-GAPS-0411](tasks/WISKEY-ADDENDUM-GAPS-0411.md) | V1 | BLOCKED | WisKey gaps found while building 2.38.2 - 2.40.0 (addendum for the WisKey team) | — |
| [OWNER-LAB-ACTIONS-0411](tasks/OWNER-LAB-ACTIONS-0411.md) | V1 | BLOCKED | Owner lab actions after 04.11 | — |
| [GUIDE-BOARD-2402](tasks/GUIDE-BOARD-2402.md) | V1 | REVIEW | User guide for 2.40.0 / 2.40.1 and the task board after 04.11 | — |
| [GATE-HYGIENE-2402](tasks/GATE-HYGIENE-2402.md) | V1 | REVIEW | Gate hygiene: whole-package scanners always run, a Windows-only demo check, the bridge-install state reset between tests | — |
| [VIDEO-SUB-FALLBACK-2402](tasks/VIDEO-SUB-FALLBACK-2402.md) | V1 | REVIEW | Live video, automatic quality: a sub stream that gives nothing moves to the main stream on the same transport | — |
| [SETTINGS-CARDS-ACCORDION-2402](tasks/SETTINGS-CARDS-ACCORDION-2402.md) | V1 | REVIEW | Intercom settings cards: "cards opening in place" as a fourth layout | — |
| [VIDEO-2403](tasks/VIDEO-2403.md) | V1 | IN_PROGRESS | Live video: no video-policy read without live video; the kiosk and the display wall count as automatic quality | — |
| [SKIN-QA-2403](tasks/SKIN-QA-2403.md) | V1 | IN_PROGRESS | The 2.40.1 / 2.40.2 surfaces in every skin, light and dark: fallback tag, phone toolbar, intercom settings cards | — |
| [BOARD-HYGIENE-2403](tasks/BOARD-HYGIENE-2403.md) | V1 | IN_PROGRESS | Task board hygiene after v2.40.2 | — |
| [HA-2026-11-COMPAT-2404](tasks/HA-2026-11-COMPAT-2404.md) | V1 | IN_PROGRESS | Home Assistant 2026.11 entity names and child devices | — |
