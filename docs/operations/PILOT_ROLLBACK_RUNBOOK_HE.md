Source: original

# חזרה לגרסה קודמת של Arx בפיילוט - מדריך לבעל המערכת

PILOT-ROLLBACK-2550 (משימות T035 / T036). מסמך זה מסביר איך מחזירים את התוסף SmplWise Arx לגרסה הקודמת אחרי עדכון שלא
הצליח, מה נשמר ומה הולך לאיבוד, ואיך בודקים שהמערכת חזרה לעבוד. הנספח באנגלית בסוף המסמך מיועד לצוות הפיתוח.

> כלל ברזל: חזרה לגרסה קודמת היא פעולה של בעל המערכת. Arx לא מחזיר את עצמו לבד, לא משחזר גיבוי של מערכת הבית ולא מפעיל
> מחדש את מערכת הבית בלי אישור.

## 1. מתי חוזרים לגרסה קודמת

- מסך מרכזי לא עובד (דלתות, אינטרקום, מצלמות, אירועים) והבעיה הופיעה מיד אחרי העדכון.
- התוסף לא עולה, או עולה ונופל שוב ושוב.
- צוות הפיתוח המליץ לחזור.

לא חוזרים בגלל הודעה אדומה בודדת בפס העליון (למשל "ה-NVR מנותק" או "האחסון מלא"): אלה מצבים של הציוד ושל הדיסק, וחזרה
לגרסה קודמת לא תפתור אותם.

## 2. לפני שמתחילים - גיבוי

1. **גיבוי של התוסף במערכת הבית.** אם בעדכון סימנתם "צור גיבוי לפני העדכון" - הגיבוי כבר קיים (הגדרות › מערכת › גיבויים,
   גיבוי חלקי של SmplWise Arx בגרסה הקודמת). הוא כולל גם את התוסף עצמו וגם את כל הנתונים שלו (`/data`) מהרגע שלפני העדכון.
2. **הגיבוי של Arx "לפני עדכון".** בכל הפעלה ראשונה של גרסה חדשה Arx שומר לבד עותק של הנתונים לפני שהוא נוגע בהם
   (Arx › הגדרות › גיבוי, סוג "לפני עדכון"; נשמרים חמשת האחרונים). בהערה של כל עותק כתוב מאיזו גרסה לאיזו גרסה, למשל
   `before upgrade 2.51.0 -> 2.52.0`.
3. **גיבוי עכשווי.** לפני החזרה: Arx › הגדרות › גיבוי › "גבה עכשיו". כך נשמר גם מה שנכתב מאז העדכון, אם תרצו אותו בחזרה.

שימו לב: גם החזרה עצמה היא "הפעלה של גרסה אחרת", ולכן Arx כותב בה עותק "לפני עדכון" נוסף, עם ההערה
`before upgrade 2.52.0 -> 2.51.0`. העותק הזה הוא הנתונים של הגרסה החדשה. כשבוחרים עותק לשחזור - בוחרים לפי ההערה, לא לפי
"האחרון ברשימה".

## 3. שתי דרכים לחזור

### דרך א (מומלצת): שחזור הגיבוי של התוסף במערכת הבית

הגדרות › מערכת › גיבויים › הגיבוי החלקי של SmplWise Arx מלפני העדכון › שחזור › לסמן את התוסף בלבד.

- התוסף חוזר לגרסה הקודמת, והנתונים חוזרים בדיוק למצב שלפני העדכון.
- **הולך לאיבוד:** כל מה שנכתב ב-Arx מאז העדכון - אירועים, יומן פעולות (audit), שינויי הגדרות, משתמשים והרשאות שנוספו,
  כרטיסי שירות, הודעות לוח. אם צריך משהו מזה - לגבות לפני (סעיף 2.3) ולבקש מצוות הפיתוח לייבא חלקים.
- **לא מושפע:** ההקלטות (הן ב-NVR), נתוני WisKey (אנשים, כרטיסים, לוחות זמנים - הם ב-WisKey ובמערכת הבית), הגדרות מערכת
  הבית עצמה, והגשר (`smplwise_bridge`, הוא בתיקיית ההגדרות של מערכת הבית ולא בגיבוי של התוסף - ראו סעיף 4).

### דרך ב: גרסת "חזרה" מהחנות

צוות הפיתוח מפרסם גרסה חדשה במספר (למשל 2.52.1) שהקוד שלה הוא הקוד של הגרסה הקודמת. מעדכנים כרגיל (Arx › הגדרות › מערכת ›
עדכונים, או מחנות התוספים). חנות התוספים לא מציעה גרסה נמוכה מהמותקנת, ולכן זו הדרך היחידה "מהחנות".

- **כל הנתונים נשמרים.** הגרסה הישנה רצה על מסד הנתונים של החדשה: Arx לא מבטל שינויי מבנה (מיגרציות) - מה שהגרסה החדשה
  הוסיף נשאר במקומו, והגרסה הישנה פשוט לא קוראת אותו. בדיקה אוטומטית בשחרור (סעיף 6) מוודאת שזה בטוח בכל גרסה.
- תכונות שקיימות רק בגרסה החדשה "רדומות" עד העדכון הבא, ואז חוזרות עם מה שנשמר בהן לפני החזרה (טבלה בסעיף 5).
- אם רוצים גם את הנתונים של לפני העדכון: אחרי ההתקנה - Arx › הגדרות › גיבוי › העותק "לפני עדכון" עם ההערה
  `2.51.0 -> 2.52.0` › שחזור › "החלפה". השחזור מחליף את נתוני הפרויקט; מה שקיים רק בגרסה החדשה לא נמחק (ונשאר רדום).

## 4. הגשר והפעלה מחדש של מערכת הבית

- הגשר (`smplwise_bridge`) נמצא בתוך התוסף. בכל הפעלה Arx מעתיק את הגשר שלו לתיקיית ההגדרות של מערכת הבית אם הגרסה או התוכן
  שונים - **גם לגרסה ישנה יותר**. Arx 2.52.0 מביא גשר 0.10.9, Arx 2.51.0 מביא גשר 0.10.8.
- מערכת הבית טוענת את הגשר רק כשהיא עולה. לכן אחרי החזרה הקבצים כבר של 0.10.8, אבל עד הפעלה מחדש אחת של מערכת הבית
  ממשיך לרוץ 0.10.9. במסך הגשר זה נראה כ"ממתין להפעלה מחדש" (installed 0.10.8, active 0.10.9).
- **הפעלה מחדש של מערכת הבית - רק באישור שלכם.** בלי ההפעלה מחדש המערכת ממשיכה לעבוד: כל עוד סבב המפתחות של הגשר חסום
  (כך היום כשיש WisKey), כל החיבורים הם בפרוטוקול הישן ש-0.10.9 עדיין מקבל. כדאי להפעיל מחדש בחלון שקט, פעם אחת.
- במערכת המעבדה הגשר מותקן ידנית (פרופיל "עדכון ידני"): Arx לא מעתיק שם כלום, וצוות הפיתוח מחליף את הגשר ידנית.
- בדרך א (שחזור גיבוי התוסף) הגשר לא חוזר מהגיבוי; הוא מועתק בהפעלה הראשונה של התוסף המשוחזר, כמו בכל הפעלה.

## 5. מה קורה לתכונות החדשות כשחוזרים (דרך ב)

| חוזרים מ- | אל | מה נעשה רדום | מה זה אומר בפועל |
|---|---|---|---|
| 2.52.0 | 2.51.0 | רישום בדיקות לוחות הזמנים ב-WisKey | בדיקה שהתחילה ב-2.52 נשארת "לא ידוע"; לא נשלחת שוב |
| 2.52.0 | 2.51.0 | שיוך התראות הדפדפן (Push) לכניסה שממנה נרשמו | **תיקון אבטחה שאובד בזמן החזרה:** אחרי יציאה מחשבון במכשיר משותף, המכשיר עלול להמשיך לקבל התראות של המשתמש. מומלץ: במכשירים משותפים לבטל התראות ידנית עד העדכון הבא |
| 2.52.0 | 2.51.0 | הגשר 0.10.9 (צימוד מחדש מבטל מיד את הצימוד הקודם) | אחרי הפעלה מחדש של מערכת הבית רץ 0.10.8 |
| 2.51.0 | 2.50.0 | קודי שחזור, מפתח טלפון, מדיניות אימות לפי משתמש / תפקיד, איפוס דרכי אימות ע"י מנהל, רשימת אסימוני הגישה | קודי השחזור ומפתח הטלפון מפסיקים לעבוד (קוד האפליקציה ממשיך); "פטור" נקרא כ"רשות"; אחרי איפוס ע"י מנהל, הרישום מחדש לא נאכף. בעדכון הבא הכול חוזר כפי שהיה לפני החזרה |
| 2.50.0 | 2.49.0 | מקור המצלמה (ידני / גילוי ברשת), בניין ברירת מחדל לממשק הבית ולמסך הלובי | מצלמות שנוספו בגילוי נראות כרגילות; הממשק נפתח על הבניין האחרון שנבחר |

(הטבלה המלאה, לכל מיגרציה, בנספח האנגלי.)

## 6. בדיקה אחרי החזרה

1. Arx › הגדרות › מערכת: מספר הגרסה הוא הגרסה הקודמת.
2. הפס העליון: אין פריט אדום (תוסף, אחסון, NVR, שירות וידאו, מערכת הבית). אם יש - לפתוח את דוח הבריאות (הגדרות › מערכת ›
   בריאות המערכת).
3. מסך הגשר: הגרסה המותקנת היא של הגרסה הקודמת; "פעיל" אחרי הפעלה מחדש של מערכת הבית (אם אישרתם).
4. אינטרקום: מצב "מוכן". **לא לפתוח דלת לבדיקה** אלא אם תכננתם זאת בעצמכם.
5. אירועים מגיעים; מצלמה אחת בשידור חי; ניגון של השעה הקודמת.
6. Arx › הגדרות › גיבוי: מופיע עותק "לפני עדכון" חדש עם ההערה `2.52.0 -> 2.51.0` (החזרה עצמה).
7. צוות הפיתוח מריץ את בדיקות הקריאה בלבד אחרי עדכון (`scripts/smoke_after_upgrade.py --live`).

אם משהו מזה נכשל - לא לחזור שוב ושוב בין גרסאות. לעצור, לצלם מסך, ולפנות לצוות הפיתוח.

---

## Appendix (English) - for the development team

### A. What exists for a safe rollback (gap analysis, 2026-11-25)

| Piece | Where | State |
|---|---|---|
| Pre-upgrade data copy on every version change (also a downgrade) | `services/backup.pre_upgrade` (create_app, before `migrate()`), `auto-pre-upgrade-*.zip`, last 5 kept | exists (T036 pre-evidence, 0.1.17) |
| Daily copy | `backup.daily_loop`, last 7 | exists |
| Restore refuses a backup newer than the database schema | `backup.restore`, `offbox_restore` (`schema_newer`) | exists |
| Read-only smoke after an upgrade | `scripts/smoke_after_upgrade.py` (16 checks, `--live` via Ingress) | exists |
| Rollback guidance | `smplwise_vms/DOCS.md` ("When an update fails") | exists, short, English, no data-kept/lost list |
| Outage / safety runs on fakes | `test_outage_run_t035.py` (S01-S08), `test_soak_edges_2450.py` (D1-D3, F1-F8), `test_soak_edges2_2450.py` (G1-G4) | exist |
| **Downgrade safety of migrations** | - | **missing -> `scripts/migration_downgrade_check.py` + release_check** |
| **Owner rollback runbook (data kept / lost, bridge, WisKey, verification)** | - | **missing -> this document** |
| **Disk full at COMMIT** (the real WAL failure point) | - | **missing; it was a bare 500 -> fixed, `test_pilot_safety_2550.py` P1/P2** |
| **Wall-clock jumps** | - | **missing; two silent-"ok" defects -> fixed, C1-C4** |
| AT069 / AT070 / AT071 / AT072 on real equipment | - | NOT_RUN (lab + owner) |

### B. Why "older code on the newer database" works - and when it would not

`Database.migrate()` applies the files it knows that `schema_migrations` does not list, in order, and never undoes one. Older code
started on a newer database therefore applies nothing and runs on the newer schema. That is safe exactly when every migration added
since is backward-compatible. `scripts/migration_downgrade_check.py` decides this per file:

- compatible: new table / view / index, a nullable or defaulted column, a non-unique index dropped, triggers or data confined to
  new tables;
- not compatible (needs a `Rollback:` note in the file, else the release check FAILS): drop / rename of a table, column or view
  older code knows (table rebuilds included), a UNIQUE index or a trigger on an old table, rows of an old table rewritten, a unique
  index dropped (older upserts lose their conflict target), a NOT NULL column without a default, a new column on a table older code
  fills positionally (`INSERT INTO t VALUES ...` without a column list).
A shipped migration that was later changed (beyond comments), removed or renumbered also fails.

`scripts/release_check.py` runs it from the previous release tag to the tree ("migrations downgrade-safe since the previous release").

### C. The run for 2.48 -> 2.52 (release/2520-train @ 91de5c377)

`py -3.12 scripts/migration_downgrade_check.py --chain v2.48.0,v2.49.0,v2.50.0,v2.51.0,HEAD` - PASS, every step:

| Step | Migration | Verdict | What older code sees |
|---|---|---|---|
| 2.48 -> 2.49 | none | - | - |
| 2.49 -> 2.50 | 0217_camera_discovery_origin | compatible | 2 new nullable columns on `camera_stream_sources`, ignored |
| 2.49 -> 2.50 | 0218_mb_home_building | compatible | 2 new nullable columns, ignored |
| 2.50 -> 2.51 | 0219_remote_token_uses | compatible | new table, ignored |
| 2.50 -> 2.51 | 0220_recovery_codes | compatible | new table, ignored (codes stop working) |
| 2.50 -> 2.51 | 0221_factor_policy | compatible | 2 new tables (one seeded from `auth_totp_policy`, which older code keeps reading) |
| 2.50 -> 2.51 | 0222_device_keys, 0223_device_key_attested | compatible | new table + its column, ignored |
| 2.50 -> 2.51 | 0224_factor_resets | compatible | new table, ignored (forced re-enrolment not enforced) |
| 2.51 -> 2.52 | 0225_wiskey_schedule_reads | compatible | new table, ignored |
| 2.51 -> 2.52 | 0226_push_subscription_sign_in | compatible | new nullable column + partial index, ignored (FC-02 protection lost) |

For comparison, the same check over v2.30.0 -> v2.40.0 flags 0186 (table rebuild; has a note), 0196 (two triggers on
`wiskey_relay_map`, no note - shipped long ago) and 0204 (data rewrite; has a note): the detector does find real cases.

### D. Re-upgrade after a rollback

Rows written by the newer version into its own tables / columns stay (nothing deletes them) and are read again after the next
upgrade, as of the moment of the rollback: e.g. an administrator's factor reset recorded under 2.51 is enforced again under 2.51+
even if the user enrolled under 2.50 meanwhile (the user just enrols once more). A push subscription registered under 2.50 has no
`sign_in` (NULL = the old behaviour). No migration runs twice.

### E. Bridge and WisKey

- `services/bridge_install.install` copies the bundled bridge when the label OR the content differs - both directions; Core loads it
  only at start (`update_pending` until the one owner-approved Core restart). A manual-upgrade profile
  (`hikvision_intercom_manual_upgrade.json`) copies nothing (lab).
- 0.10.9 -> 0.10.8 (WISKEY-BRIDGE-KEYSET-2520 6.1 step 6): no key-store format change; while rotation is blocked with WisKey
  installed every connection is v1 and 0.10.9 still accepts it, so 2.51 + a still-loaded 0.10.9 works until the restart. If a key
  rotation had completed under 2.52 (not possible while the block stands), 0.10.8 would not know the KeySet key: re-pair.
- WisKey's native component is never downgraded by Arx (`wiskey_auto_install`: `native_newer_installed`). WisKey's own data is not
  in Arx's database. Arx's records of WisKey operations follow the Arx data path; an operation in flight across the rollback stays
  `unknown` and is never re-sent.

### F. Commit-time disk full and clock jumps (fixed in this row)

- A real full volume fails a WAL database at COMMIT. The request's commit runs in `main.CommitBeforeSend` as the answer starts,
  outside FastAPI's exception handlers: the client got `internal_error` 500, and the refused transaction stayed open until the
  request's connection closed (where `connection()` tried COMMIT again - with space freed meanwhile, a change reported as failed
  could be stored). Now `db.release` rolls back on a refused commit and `CommitBeforeSend` answers the same 507 `storage_full` /
  `database_busy` envelope as a refusal inside the handler (`main.db_refusal_response`).
- Event-stream outages (ISAPI, Frigate, Provision) are measured on the monotonic clock (`IngestState.outage_s`). Before: a clock
  moved back silenced the top bar's "NVR disconnected" and dropped a long outage's coverage gap; moved forward, a 10 s blip became an
  hour-long gap. `media_reach` probes when its schedule lies further ahead than any it sets (a clock moved back left a "reachable"
  state unchecked for as long as it moved).
