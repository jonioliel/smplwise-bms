# DEEP-REVIEW-2520-INDEX - every finding of the 2.52 deep review, with its status

Row REVIEW-FINDINGS-INDEX-2530 - the starting scope of the owner-requested FINAL deep review after 2.55.

## תקציר לבעלים (עברית)

סקירת העומק של גרסה 2.52 נעשתה בשמונה תחומים (אבטחה, ווייזקי והגשר, וידאו, ליבת השרת, המודולים, תשתית המסכים, המסכים
עצמם, בדיקות ושחרור). יחד נמצאו **131 ממצאים**: אף אחד קריטי, **14 חמורים**, **64 בינוניים**, **53 קלים**.

מצב היום (נבדק בקוד עצמו, לא רק לפי הודעות השינוי):

| חומרה | סה"כ | תוקן | תוקן חלקית | פתוח |
|---|---|---|---|---|
| חמור | 14 | 13 | 1 | 0 |
| בינוני | 64 | 11 | 1 | 52 |
| קל | 53 | 2 | 0 | 51 |
| **סה"כ** | **131** | **26** | **2** | **103** |

כל 14 הממצאים החמורים טופלו: 13 תוקנו במלואם ואחד (שער השחרור - כלל "לילה ירוק לפני תיוג") תוקן חלקית. 25 מהתיקונים כבר
בגרסה 2.52 שפורסמה; תיקון אחד (המשך "אין מעבר לערוץ הישן אחרי סירוב" של ווייזקי, לנעילת הצילום ולמנוע ההרשאות) נמצא בקרון
2.53 ועוד לא בגרסה שפורסמה - והוא חייב להיכנס לפני שמסירים את חסימת החלפת המפתח של הגשר.

הפתוחים החשובים ביותר, בשפה פשוטה:

1. **אפליקציית הטלפון נועלת משתמשים בחוץ** - כשמדיניות "חובה אימות נוסף" דלוקה, מי שהאימות הנוסף שלו הוא מפתח הטלפון או מפתח
   גישה (ולא קוד מאפליקציית אימות) לא מצליח לפתוח את האפליקציה.
2. **חיבור קבוע עם אסימון נחסם** - בדיקה חוזרת של חיבור קיים "מבזבזת" את מגבלת ההתחברויות; אינטגרציה עמוסה מנותקת אחרי
   כשעה, ואחרי הפעלה מחדש של הבית החכם הכתובת נחסמת עד שעה.
3. **שידור למסך (Cast) - פתח להפלת התוסף** - השרת היחיד שפתוח בלי הזדהות לא מגביל זמן ומספר חיבורים; מכשיר ברשת יכול
   להעמיס עד שהתוסף כולו נופל.
4. **ביטול שינוי במקליט דורס שינוי חדש יותר** - למשל לוח זמני ההקלטה: "בטל" על שינוי ישן מחזיר מסמך ישן בלי לבדוק שאין
   שינוי מאוחר יותר.
5. **שידור קבוע למסך ממשיך אחרי שלמשתמש נלקחה ההרשאה** למצלמה.
6. **מצב חיישנים אחרי הפעלה מחדש של הבית החכם** - שינוי שקרה בשניות החיבור הולך לאיבוד ונשאר שגוי שעות (למשל חיישן הצפה).
7. **גיבוי יומי תופס את מנעול הכתיבה בזמן הדחיסה** - בהתקנה עם הרבה קבצי תוכניות, עדכוני מצב נזרקים ופעולות משתמש נכשלות
   בזמן הגיבוי.
8. **גנרטור** - מצבר 24 וולט שקרס מוצג "תקין"; כל מי שרק צופה יכול להשתיק התראה קריטית לשבוע, וההתראה נבלעת.
9. **חיוב חשמל ומים** - שינוי מחזור חיוב משאיר תקופה שלא חויבה, וטיוטה אוטומטית שאף אחד לא אישר נמחקת אחרי 30 יום ולא
   נוצרת שוב - הכנסה הולכת לאיבוד בשקט.
10. **הזמנת חדרים כפולה** להזמנות רחוקות (מעבר לטווח שהמערכת מחשבת מראש).
11. **מתגים שמראים מצב שלא נשמר** - כשהשמירה נדחתה או בוטלה, המתג נשאר במצב הלחוץ (כ-370 מתגים במערכת; מקרה מאומת במסך
    האוטומציות ובמתגי הטקסט על התמונה במצלמה).
12. **מסך הבית** - מנעול לא מחובר מוכרז "דלת פתוחה"; אזעקה לא זמינה מוצגת "דרוכה"; עריכת מועדפים מוחקת מועדפים מוסתרים.
13. **באנר שיחה נכנסת** - כששתי עמדות מצלצלות, הבאנר מתחלף מתחת לאצבע (עונים לעמדה הלא נכונה); תוצאה לא ידועה של פתיחת דלת
    מוצגת "הדלת לא נפתחה".
14. **פעולות פיזיות בלי אישור** - פולס ממסר של המקליט בלחיצה אחת (ולפעמים למקליט הלא נכון); בדיקת מכשירים באוטומציה מפעילה
    צעד רגיש בלחיצה אחת; בחלון האישור במפה הפוקוס על כפתור פתיחת המנעול.
15. **שער השחרור** - הכלל "תיוג רק עם לילה ירוק" עדיין לא נאכף בסקריפט; בדיקת התחביר רצה על התיקייה הלא נכונה; סף הירידה
    במספר הבדיקות ישן; הרצה ממוקדת חוזרת יכולה לעבור בלי שהחבילה המלאה רצה. חסרות בדיקות מול בית חכם אמיתי, הרצה אמיתית של
    סקריפט ההפעלה של התוסף, ובניה למעבד ARM.

שתי בדיקות מעבדה שעדיין לא נעשו: מה בדיוק שולח שרת הווידאו בהודעת שגיאה של מקור מסוג ffmpeg (האם יש בה סיסמת מקליט - אם כן,
לשקול החלפת סיסמה), ובדיקת מאגר המפתחות של הגשר במעבדה לפני כל צימוד מחדש (תוקן בקוד, לא נבדק מול המעבדה).

תחומים שאף סוקר לא קרא (רשימה מלאה בסעיף 4) - זו נקודת הפתיחה של הסקירה הסופית: חלק גדול מצד ווייזקי (שירותי הגשר, מדיה
ושיחות של האינטרקום, כתיבות לעמדות, יומן הכתיבות, התקנה), שכבת השירות של Frigate, הקבוצות והמולטימדיה, חיפוש הקלטות ואזורי
זמן, הגדרות קידוד במקליט, הפעולות של לוחות זמנים ואוטומציות, גיבוי חיצוני, ועשרות מסכים (ווידג'טים של הבית, מסך הקיר, עורכי
תוכניות, מכרזים, אשף ההתקנה ועוד). רוב הסקירות היו קריאת קוד בלבד - כמעט שום בדיקה לא הורצה בהן.

## 1. How to read this index

- Sources: `docs/review/DEEP-REVIEW-2520-<AREA>.md` on the branches `origin/review/DEEP-2520-<AREA>` (SECURITY, WISKEY-BRIDGE, VIDEO,
  BACKEND-CORE, DOMAIN-MODULES, FRONTEND-CORE, FRONTEND-SCREENS, TESTS-RELEASE). Every review read `origin/release/2520-train` at
  `eadaa25b8`; the `file:line` column is copied from the review and refers to THAT head (lines have moved since).
- Path convention (as in the reviews): backend paths are relative to `smplwise_vms/backend/smplwise/`; `frontend/...`,
  `custom_components/...`, `scripts/...` are relative to the repository root.
- STATUS was checked on 2026-11-26 against `origin/main` (= `v2.52.0`, `bf4e6da76`) and `origin/release/2530-train` (`aeb05ad3d`):
  the fixing commit's subject names the finding, the row's change note says what it does, and the fix's own symbol was found in the code
  at both heads with `git grep` (for example `_recount_wrong_code`, `ca_path_problem`, `restore_dependents`, `sanitize_upstream_frame`,
  `change_cameras`, `PairingFence`, `parse_pytest_passed`). For a sample of the OPEN rows (SEC-4, SEC-5, SEC-6, V-02, V-03, V-05, V-07,
  V-08, CORE-03, CORE-05, CORE-07, CORE-08, CORE-11, D-02, D-03, D-06, FC-01, FC-03, FC-05, FC-07, FC-10, FC-11, SCR-09, SCR-10,
  SCR-21, SCR-43, TR-05, TR-07, TR-10) the defective code was confirmed still present at `release/2530-train`; the other OPEN rows have
  no fixing commit anywhere (`git log --all` since 25.11 names no other finding id).
  - **FIXED** - fixed; the column names the row and the commit. `main` = in `v2.52.0`; `train` = only on `release/2530-train` (2.53).
  - **PARTIAL** - part of the suggested fix is in, the rest is open (said in the note).
  - **OPEN** - not fixed; parked for the final review.
- Test status of the FIXED rows is the fixing row's own (see its change note); this index ran no test.
- Duplicates across areas are marked "same as" and counted once per area (the totals count every row).
- The "Improvements (short)" lists of each review are NOT indexed one by one (about 60 notes); they stay in the review files and belong
  to the final review's reading list.

## 2. Counts

| Area | Findings | high | medium | low | FIXED | PARTIAL | OPEN |
|---|---|---|---|---|---|---|---|
| SECURITY (SEC) | 8 | 1 | 4 | 3 | 3 | 0 | 5 |
| WISKEY-BRIDGE (WB) | 7 | 2 | 1 | 4 | 4 | 0 | 3 |
| VIDEO (V) | 10 | 1 | 4 | 5 | 2 | 0 | 8 |
| BACKEND-CORE (CORE) | 11 | 1 | 4 | 6 | 3 | 0 | 8 |
| DOMAIN-MODULES (D) | 12 | 0 | 5 | 7 | 0 | 0 | 12 |
| FRONTEND-CORE (FC) | 12 | 0 | 6 | 6 | 2 | 0 | 10 |
| FRONTEND-SCREENS (SCR) | 57 | 6 | 34 | 17 | 8 | 0 | 49 |
| TESTS-RELEASE (TR) | 14 | 3 | 6 | 5 | 4 | 2 | 8 |
| **Total** | **131** | **14** | **64** | **53** | **26** | **2** | **103** |

No critical finding in any area. By severity: high 13 FIXED / 1 PARTIAL / 0 OPEN; medium 11 / 1 / 52; low 2 / 0 / 51.

Fixing rows and commits (all branches `origin/pilot/<row>`):

| Row | Findings | Commits | In |
|---|---|---|---|
| SEC-FIX-2520 | SEC-1, SEC-2, SEC-3, CORE-01, CORE-02, CORE-04 | `485260013`, `582665889`, `cb3186628`, `daf5b9598` + `68ece0fd4` + `631c062a3`, `dc76a4f88` + `99456c1d5`, `377ee7e43` | main |
| VIDEO-SECFIX-2520 | V-01, V-04 | `3e4317bb9` | main |
| FE-SAFETY-FIX-2520 | FC-02, FC-04 | `c7f7db1b6`, `0a4dc6f19` | main |
| SCREENS-FIX-A-2520 | SCR-01, SCR-06, SCR-07 | `8607894ea`, `672a12972` + `a15c71dd2`, `4c527f6ae` | main |
| SCREENS-FIX-B-2520 | SCR-02, SCR-03, SCR-04, SCR-05 | `9e87a9126`, `d673793bd` + `ede2e93be`, `e64a9ee17`, `29ebe3430` | main |
| SCREENS-FIX-B2-2520 | SCR-40 (+ the low note under SCR-04) | `86bd851ce`, `f07257006` | main |
| WISKEY-NOFALLBACK-FIX-2520 | WB-01 (people routes), WB-03 | `76ee24bcb` | main |
| WISKEY-NOFALLBACK-2-2530 | WB-01 (capture lease, grant engine) | `a7997abbb` | train only |
| BRIDGE-REPAIR-LEGACY-2520 | WB-02, WB-07 | `ec104d249` | main |
| GATE-HARDEN-2520 | TR-01, TR-02, TR-03 (a), TR-04 (part), TR-06, TR-11 | `8e025887a` (+ runner install, see its change note) | main |

Rows named in the brief that fix no review finding: TEST-STABILITY-2530 (two test-only fixes, not a review id; unmerged), PILOT-ROLLBACK-2550
(rollback runbook, migration downgrade check, disk-full-at-commit and clock-jump fixes - it answers the BACKEND-CORE improvement notes on
the pre-upgrade copy and "a database newer than the code" only in part; unmerged). PLAYER-ERROR-TEXT-2530 (unmerged) is the UI follow-up
of V-01 (the fixed relay codes shown as sentences).

## 3. Findings

### 3.1 SECURITY (`docs/review/DEEP-REVIEW-2520-SECURITY.md`)

| Id | Sev | Title | file:line (at `eadaa25b8`) | Status |
|---|---|---|---|---|
| SEC-1 | high | Wrong inline codes on the conditional once-actions (new system administrator, restore) never reach the lockout: unlimited guessing | `services/step_up.py:701-708`, `:662-663`; `services/second_factor.py:141-150`, `:252-257` | FIXED main - SEC-FIX-2520 `485260013` (`_recount_wrong_code`) |
| SEC-2 | medium | Key attestation accepts a chain extended below a genuine device certificate (no CA check): a software key passes as `hardware` | `services/device_key_attestation.py:142-147`, `:174-183`; `services/device_attestation.py:168-175` | FIXED main - SEC-FIX-2520 `582665889` (`ca_path_problem`, both verifiers) |
| SEC-3 | medium | A restore silently puts the older remote sign-in policy back | `services/backup.py:156-327`, `:366-367`, `:762-766` | FIXED main - SEC-FIX-2520 `cb3186628` (kept list + fail-closed `security.*` / `remote.*` families + ratchet) |
| SEC-4 | medium | The phone app's web session refuses every user whose factor is not the authenticator code (phone key, passkey, HA MFA provenance) once a policy requires a factor | `services/app_session.py:207-214`, `:288-290`, `:428-429` | OPEN (still `not sf.is_enrolled(...)` only) |
| SEC-5 | medium | Re-validating a bearer session spends the sign-in rate limit: a busy token client is dropped (429), an HA outage burns the address's budget | `services/ha_user_auth.py:1475-1491` (limits `:82-83`) | OPEN |
| SEC-6 | low | WebSocket handshakes skip the home-interface gate every HTTP request passes | `routers/media.py:444-457` vs `auth.py:373-376` | OPEN |
| SEC-7 | low | Arx-only sign-in: the account ceiling counter is read-then-write across two connections; concurrent failures count once | `services/local_identity.py:1148-1152`, `:1219-1225` | OPEN |
| SEC-8 | low | Off-box backup administration (endpoint test, push, key rotate, one-time key export) is reachable from the remote channel | `routers/backup_offbox.py:295-311`, `:421-435`, `:439-450`; `remote_channel.py:170-203` | OPEN (owner decision named in the review) |

### 3.2 WISKEY-BRIDGE (`docs/review/DEEP-REVIEW-2520-WISKEY-BRIDGE.md`)

| Id | Sev | Title | file:line | Status |
|---|---|---|---|---|
| WB-01 | high (latent, v2 only) | A direct v2 refusal at connect / discovery silently re-routes people writes (and the lease, the grant engine) to the classic channel | `services/wiskey_direct_join.py:309-331`, `:571-579`, `:883-885`; `routers/access_control_people.py:141-146`; `services/access_service_writer.py:295-313` | FIXED train - people routes in main (WISKEY-NOFALLBACK-FIX-2520 `76ee24bcb`, `DirectJoin.v2_refusal`); capture lease + grant engine only on `release/2530-train` (WISKEY-NOFALLBACK-2-2530 `a7997abbb`, `v2_refusal_of`, `v2_refused_lease_error`). Must ship before the rotation block is lifted (2.54). |
| WB-02 | high | A re-pair is undone and the old rotated key keeps verifying (also on WisKey v2) on a bridge whose first rotation was saved by Arx 2.11.0-2.14.0 | `custom_components/smplwise_bridge/keyset.py:119-125`, `:402-408`; `__init__.py:425`; `native_keyset.py:168-172` | FIXED main - BRIDGE-REPAIR-LEGACY-2520 `ec104d249` (`PairingFence`, mirror regenerated). Lab key-store check before a re-pair: NOT_RUN. |
| WB-03 | medium | One failed discovery read disables the direct path for the life of the socket | `services/wiskey_direct_discovery.py:353-354`, `:374-384`; `services/wiskey_direct_join.py:144-151`, `:333-344` | FIXED main - WISKEY-NOFALLBACK-FIX-2520 `76ee24bcb` (`FAILED_RETRY_MIN_S` back-off) |
| WB-04 | low | v2 admission writes the bridge key store up to once per second per key under steady traffic | `custom_components/smplwise_bridge/native_keyset.py:235-244` | OPEN |
| WB-05 | low | `GET /system/bridge-key/service-grant` sends a signed WisKey read on every call under a process-wide lock | `routers/bridge_key.py:153-160`; `services/wiskey_service_grants_v3.py:259-263` | OPEN |
| WB-06 | low | `Persister.control` rollback discards unrelated unsaved state and can answer "ok" for a step it rolled back | `custom_components/smplwise_bridge/keyset.py:436-446`, `:150-156` | OPEN |
| WB-07 | low | The 25.11 re-pair fence covers only WisKey's v2 path; the bridge's own signed services accept the old pairing until the reload | `custom_components/smplwise_bridge/__init__.py:434-439`, `:704-719` | FIXED main - BRIDGE-REPAIR-LEGACY-2520 `ec104d249` |

### 3.3 VIDEO (`docs/review/DEEP-REVIEW-2520-VIDEO.md`)

| Id | Sev | Title | file:line | Status |
|---|---|---|---|---|
| V-01 | high | go2rtc error frames reach live and playback viewers unsanitized (addresses; PLAUSIBLE: recorder credentials of an `ffmpeg:` source) | `routers/media.py:581`, `routers/playback.py:236`, `frontend/src/components/sw-live-player.ts:1510,1550-1556` | FIXED main - VIDEO-SECFIX-2520 `3e4317bb9` (`relay.sanitize_upstream_frame` default on every relay route). Open: the lab check of what go2rtc sends for an `ffmpeg:` source (password rotation decision); UI wording PLAYER-ERROR-TEXT-2530 unmerged. |
| V-02 | medium | The cast relay (the one unauthenticated listener) has no socket timeout and no connection cap | `services/cast_relay.py:349-352`, `:411` | OPEN |
| V-03 | medium | Generic NVR undo PUTs the old document without checking the device still holds the change | `services/nvr_write.py:209-233` | OPEN |
| V-04 | medium | NVR undo and change detail skip the camera scope: generic change rows carry no `camera_id` | `routers/nvr_write.py:695`, `services/nvr_write.py:150-156` | FIXED main - VIDEO-SECFIX-2520 `3e4317bb9` (`change_cameras`, camera stored in the one INSERT) |
| V-05 | medium | A cast (a permanent one in particular) is never ended when its starter loses the camera or the cast permission | `services/cast_sessions.py:961-990` | OPEN (janitor still ends only `owner_gone`) |
| V-06 | low | Disabling a camera stops nothing running; its go2rtc streams are never removed | `services/autosync.py:262-263`, `services/leases.py:38-43` | OPEN |
| V-07 | low | Motion capability cache keyed by channel only, caches a failed read for the process lifetime | `services/nvr_write.py:262-284` | OPEN |
| V-08 | low | Playback terminal states: `revoked` counts as active; a late media byte revives a closed session | `routers/playback.py:215,244`, `services/playback.py:104-105` | OPEN |
| V-09 | low | Snapshot cache file written in place, no single-flight per camera | `routers/cameras.py:201` | OPEN |
| V-10 | low (PLAUSIBLE) | Foreign-stream alias guard compares the first path segment only | `services/go2rtc.py:685-696` | OPEN |

### 3.4 BACKEND-CORE (`docs/review/DEEP-REVIEW-2520-BACKEND-CORE.md`)

| Id | Sev | Title | file:line | Status |
|---|---|---|---|---|
| CORE-01 | high | A `replace` restore fails (500, nothing restored) on any installation that holds a maintenance file | `services/backup.py:759-768`, `migrations/0155_maintenance.sql:102` | FIXED main - SEC-FIX-2520 `daf5b9598` (`restore_dependents`, deferred FKs, 409 mapping) + drill on a live copy `68ece0fd4`, `631c062a3` |
| CORE-02 | medium | The daily backup never runs on an installation that restarts more often than once in 24 h | `services/backup.py:1079-1084` | FIXED main - SEC-FIX-2520 `dc76a4f88` (clock-based `daily_tick`, `backup.daily.state`) |
| CORE-03 | medium | State changes between the connect snapshot and the `state_changed` subscription are lost; nothing re-reads states | `services/ha_sync.py:974-979` | OPEN (snapshot still before the subscription) |
| CORE-04 | medium | A restore takes settings by deny-list and without validation (looser policy; one bad value breaks `GET /settings` and housekeeping) | `services/backup.py:156-331`, `586-599`, `762-766`; `services/settings_store.py:636` | FIXED main - SEC-FIX-2520 `377ee7e43` (+ `cb3186628`); same root as SEC-3 |
| CORE-05 | medium | The daily and the manual backup hold the single write lock while the whole archive is compressed | `services/backup.py:561-563`, `routers/backup.py:98-101` | OPEN (`create_standalone` still on a write connection) |
| CORE-06 | low | A full `/ha/ws` queue drops state frames silently | `services/ha_sync.py:224-231`, `routers/ha.py:879-927` | OPEN |
| CORE-07 | low | Attributes over 4,000 characters stored as cut (invalid) JSON: the entity reads with no attributes | `services/ha_sync.py:282-285` | OPEN |
| CORE-08 | low | Notification inbox paging skips rows that share the cursor's second | `services/notify.py:525-549` | OPEN |
| CORE-09 | low | Restore and upload read archive members with no size limit after decompression | `services/backup.py:739`, `823-824`, `1025-1028`, `481-485` | OPEN |
| CORE-10 | low | Blocking calls on the HA feed's own event loop (DB write, rule notifications, announcements) | `services/ha_sync.py:883-906`, `586-657`; `services/rules.py:219-226` | OPEN |
| CORE-11 | low | `remote_token_uses` is never pruned | `services/access_tokens.py:149-157`, `services/janitors.py` | OPEN |

### 3.5 DOMAIN-MODULES (`docs/review/DEEP-REVIEW-2520-DOMAIN-MODULES.md`)

| Id | Sev | Title | file:line | Status |
|---|---|---|---|---|
| D-01 | medium | Changing an account's billing cycle after bills exist leaves a silent unbilled gap | `services/energy_billing.py:641-663,696`, `services/bill_ledger.py:294,460` | OPEN |
| D-02 | medium | Generator battery: a 24 V bank that sags to 16 V or less is judged as a healthy 12 V bank and the alert clears | `services/generator_alerts.py:194-199` | OPEN (same root as SCR-21) |
| D-03 | medium | Generator mute: any `generator.view` holder silences any type (critical included) up to 7 days, no un-mute, the alert never notifies afterwards | `services/generator_alerts.py:341-362,509-518`, `routers/generator.py:365-370` | OPEN (see SCR-22) |
| D-04 | medium | Room double booking beyond the series cache horizon | `services/calendar/occ.py:64-74,138`, `services/calendar/events.py:197,226`, `services/calendar/jobs.py:37` | OPEN |
| D-05 | medium | An unreviewed automatic draft bill is deleted by retention after 30 days and its period is never generated again (water drafts not announced) | `services/bill_ledger.py:395-417,498-518`, `services/water_billing.py:876-887` | OPEN |
| D-06 | low | A VAT rate used only by issued water bills can be deleted | `services/energy_billing.py:424-432,585-590` | OPEN |
| D-07 | low | Customer number lock ignores numbered water bills | `services/energy_billing.py:323-324` | OPEN |
| D-08 | low | Automatic generation retries a failing (account, period) every 6 h forever, one audit row each | `services/bill_ledger.py:395-397,420-429,464-469` | OPEN |
| D-09 | low | Open generator alerts orphaned when their role mapping or device is removed | `services/generator_alerts.py:376,394-395` | OPEN |
| D-10 | low | A news feed that never succeeded is re-fetched on every board poll | `services/notices/sources.py:446-480` | OPEN |
| D-11 | low (design) | Billing has no per-person / per-building scope: a home-only person with `energy.bills` reads every customer | `services/home_interface.py:157,170,508-522`, `routers/energy_billing.py:347-352,967-971` | OPEN |
| D-12 | low (PLAUSIBLE) | Building reach: mapping an unmapped area INTO a building is not checked by `RemapGuard` | `services/building_scope.py:161-196` | OPEN |

### 3.6 FRONTEND-CORE (`docs/review/DEEP-REVIEW-2520-FRONTEND-CORE.md`)

| Id | Sev | Title | file:line | Status |
|---|---|---|---|---|
| FC-01 | medium | `sw-toggle` flips itself; a refused or cancelled change leaves the switch on a state never saved | `frontend/src/components/sw-toggle.ts:149-153`, `frontend/src/screens/automation-editor-base.ts:1145-1155,1489` | OPEN (`flip()` unchanged; SCR-29 is an instance) |
| FC-02 | medium (privacy) | A browser's Web Push subscription survives the remote sign-out | `frontend/src/arx/auth.ts:624-653`, `frontend/src/pwa/push.ts:110-138`, `services/ha_user_auth.py:1406-1427` | FIXED main - FE-SAFETY-FIX-2520 `c7f7db1b6` (migration 0226, `push.end_for_sign_ins`) + `0a4dc6f19` (`dropOnSignOut`) |
| FC-03 | medium | Remote channel: a start or a 401 while the sign-in service is unreachable drops a valid sign-in to the sign-in page; a new sign-in orphans the old refresh token | `frontend/src/arx/boot.ts:30-33,84-101`, `frontend/src/arx/auth.ts:461-513,531-558` | OPEN |
| FC-04 | medium | Confirm dialog: Enter on the close (X) button confirms a destructive action | `frontend/src/components/confirm-dialog.ts:79-93` | FIXED main - FE-SAFETY-FIX-2520 `0a4dc6f19` (`confirm-dialog-keys.ts enterAnswer`) |
| FC-05 | medium (PLAUSIBLE) | No request timeout; one hung `fetch` is shared with every later caller and stops the screen's poll for good | `frontend/src/api/client.ts:127-140,194-216`, `frontend/src/api/live-refresh.ts` | OPEN |
| FC-06 | medium | A page left open across an add-on update is never told (no build comparison with the server) | `frontend/src/pwa/register.ts:155-176`, `frontend/src/shell/lazy-screens.ts:231-248` | OPEN |
| FC-07 | low | Personal language read once, before the remote sign-in exists | `frontend/src/main.ts:18`, `frontend/src/i18n/ui-lang.ts:48-57`, `frontend/src/arx/boot.ts:25-40` | OPEN |
| FC-08 | low | `describeError`: friendly fallback unreachable (`http_502`), every `TypeError` reported as "no connection" | `frontend/src/api/client.ts:168,243-247` | OPEN |
| FC-09 | low | `/me/ws`: a throwing listener skips the permissions check of that frame; frame handlers swallow subscriber errors | `frontend/src/api/session.ts:164-174`, `frontend/src/api/ha.ts:497-517` | OPEN |
| FC-10 | low | A malformed `%` in three route segments throws inside the shell's render | `frontend/src/shell/sw-app.ts:2764,2848,2853`, `frontend/src/shell/nav.ts:179` | OPEN |
| FC-11 | low | `/me/ws` has no final close code: reconnects for ever after the session ended | `frontend/src/api/session.ts:152-161` | OPEN |
| FC-12 | low (PLAUSIBLE) | Concurrent step-up refusals share one dialog opened with the first request's action | `frontend/src/shell/step-up.ts:15-22` | OPEN (also noted under SCR-23) |

### 3.7 FRONTEND-SCREENS (`docs/review/DEEP-REVIEW-2520-FRONTEND-SCREENS.md`)

| Id | Sev | Title | file:line | Status |
|---|---|---|---|---|
| SCR-01 | high | Emergency door sheet is dead after one failed prepare / start | `frontend/src/door-windows/logic.ts:212-218`, `door-windows/emergency.ts:186-229,300-306` | FIXED main - SCREENS-FIX-A-2520 `8607894ea` |
| SCR-02 | high | Recorded playback keeps the old date after midnight: stamp, bookmark, export, seek 24 h off | `frontend/src/screens/investigate-playback.ts:1134,1559,1546,1397,1284` | FIXED main - SCREENS-FIX-B-2520 `9e87a9126` (unit only; no browser case) |
| SCR-03 | high | Resident "cancel only this date" of a recurring booking always fails (422) | `frontend/src/calendars/resident.ts:660` | FIXED main - SCREENS-FIX-B-2520 `d673793bd` + `ede2e93be` |
| SCR-04 | high | Home "my bookings": deleting one date of a series cancels the whole series and names the wrong date | `frontend/src/home/home-calendar.ts:201-211`, `home/home-p2-api.ts:46-47` | FIXED main - SCREENS-FIX-B-2520 `e64a9ee17`; the low note (pending withdraw) SCREENS-FIX-B2-2520 `f07257006` |
| SCR-05 | high | Public handler page posts an unfinished draft by itself when the phone is back online | `frontend/src/public-ticket/main.ts:137-139` | FIXED main - SCREENS-FIX-B-2520 `29ebe3430` |
| SCR-06 | high | Home alarm: state stale on phones; arm / disarm toasts success without reading the result | `frontend/src/home/sw-home.ts:242-245,343-349`, `home/home-alarm.ts:31-36` | FIXED main - SCREENS-FIX-A-2520 `672a12972` + `a15c71dd2` |
| SCR-07 | medium | Arx-only users: delete / disable have no self guard and no last-administrator guard (screen and server) | `frontend/src/screens/system-local-users.ts:474-496`, `routers/local_identity.py:709-795` | FIXED main - SCREENS-FIX-A-2520 `4c527f6ae` (server `_guard_removal`) |
| SCR-08 | medium | Editing favourites permanently drops every favourite hidden at that moment | `frontend/src/home/sw-home.ts:205,528-531,904-924` | OPEN |
| SCR-09 | medium | Home security chip shows "armed" (green) for an unavailable / unknown panel | `frontend/src/home/sw-home.ts:1289-1291` | OPEN (left out of SCREENS-FIX-A on purpose; code unchanged) |
| SCR-10 | medium | An offline lock is counted and announced as an open door | `frontend/src/home/home-logic.ts:40-45`, `home/sw-home.ts:1283`, `services/devices.py:543` | OPEN |
| SCR-11 | medium | Incoming-call banner retargets to a newer call under the finger | `frontend/src/components/sw-incoming-call.ts:587,612-614` | OPEN |
| SCR-12 | medium | Banner door open: an unknown outcome reported as "the door was not opened", no hold | `frontend/src/components/sw-incoming-call.ts:496-508` | OPEN |
| SCR-13 | medium | Station / banner commands stamp `expires_at` from an unsynchronised device clock | `frontend/src/api/intercom.ts:79-90,353-355` | OPEN |
| SCR-14 | medium | NVR system card: a late answer for recorder A is shown while actions go to recorder B | `frontend/src/screens/system-setup.ts:189-201,228` | OPEN |
| SCR-15 | medium | NVR alarm-output relay pulse has no confirmation | `frontend/src/screens/system-setup.ts:276` | OPEN |
| SCR-16 | medium | Map: the unlock confirmation opens with focus on the danger button | `frontend/src/screens/explore-floor-map.ts:3137-3139,2518-2520`, `components/sw-dialog.ts:293-294` | OPEN |
| SCR-17 | medium | Map: action arguments keyed by action id only; lights turned on from the map always get a brightness | `frontend/src/screens/explore-floor-map.ts:2958-2987,3013-3014` | OPEN |
| SCR-18 | medium | Automation "device test": failed / denied step shown as done; a sensitive step fires on one tap | `frontend/src/screens/automation-ext-dialogs.ts:83-95` | OPEN |
| SCR-19 | medium | Bulk dialog: an earlier run's result overwrites / reopens the dialog of a later request | `frontend/src/screens/devices-bulk.ts:640-641,665-690` | OPEN |
| SCR-20 | medium | Electricity bill log and "end of period reading" printed in UTC (wrong day possible on the bill) | `frontend/src/electricity/elec-format.ts:49-52`, `elec-bill-paper.ts:273` | OPEN |
| SCR-21 | medium | Generator battery dial: 12 V / 24 V boundary (18 V) disagrees with the server's (16 V) | `frontend/src/generator/gen-logic.ts:152-158` | OPEN (same root as D-02) |
| SCR-22 | medium | Generator alerts: "ack all" and "mute 24 h" are one click, reach alerts not on screen; failures invisible | `frontend/src/generator/gen-alerts-page.ts:113-124,131,141,196-198` | OPEN (see D-03) |
| SCR-23 | medium | Step-up dialog never expires and does not name the action: a refused door-open replays whenever a code is typed (only with step-up on) | `frontend/src/api/client.ts:134-138`, `components/sw-step-up-dialog.ts:212,246-254` | OPEN |
| SCR-24 | medium | Playback camera picker / date: an older selection wins after two quick changes | `frontend/src/screens/investigate-playback.ts:767-778,800` | OPEN |
| SCR-25 | medium | Removing a case item deletes its stored file with no confirmation | `frontend/src/screens/investigate-cases.ts:1015` | OPEN |
| SCR-26 | medium | Live wall and kiosk read the camera list once; kiosk "system" tile hard-coded "active" | `frontend/src/screens/kiosk-wall.ts:565,597,696`, `screens/live-wall.ts:806,849,1044` | OPEN |
| SCR-27 | medium | Motion-detection confirm shows the change reversed in Hebrew; NVR dialogs reversed in English | `frontend/src/screens/live-camera.ts:829,428`, `screens/nvr-confirm.ts:153` | OPEN |
| SCR-28 | medium | Home recordings: overlapping create / seek with no guard; a double tap leaks a playback session | `frontend/src/home/home-recordings.ts:91-120` | OPEN |
| SCR-29 | medium | Camera OSD switches stay flipped after a refused NVR write, and write on one press | `frontend/src/screens/live-camera.ts:504-531` | OPEN (instance of FC-01) |
| SCR-30 | medium | Home push refresh: trailing debounce with no maximum wait, no guard for commands in flight | `frontend/src/home/sw-home.ts:242-245,273-276,351-355` | OPEN |
| SCR-31 | medium | Home temperature +/- on a zone that is off never turns it on | `frontend/src/home/sw-home.ts:953-961`, `home/home-actions.ts:59-66` | OPEN |
| SCR-32 | medium | Home electricity bill: one account's amounts shown under another | `frontend/src/home/home-p3.ts:171-186` | OPEN |
| SCR-33 | medium | Home scene edit: a late detail of scene A can be saved onto, or delete, scene B | `frontend/src/home/home-scene-2500.ts:119-150` | OPEN |
| SCR-34 | medium | Home room bookings show a displaced booking as "approved" | `frontend/src/home/home-calendar.ts:229` | OPEN |
| SCR-35 | medium | Resident room list: an older day's answer overwrites the selected day | `frontend/src/calendars/resident.ts:256-273,369` | OPEN |
| SCR-36 | medium | Resident "my bookings": a failed load reads as "you have no bookings" | `frontend/src/calendars/resident.ts:282-285,480-491` | OPEN |
| SCR-37 | medium | Booking times one hour off on the two DST-change days | `frontend/src/calendars/grid-logic.ts:65`, `calendars/model.ts:175`, `calendars/booking-logic.ts:31` | OPEN |
| SCR-38 | medium | Booking drawer: cancel on one date of a recurring entry cancels the whole series without saying so | `frontend/src/calendars/event-drawer.ts:426-440,519-521` | OPEN |
| SCR-39 | medium | Home ticket "send note" can send the same note twice | `frontend/src/home/home-tickets.ts:157-163` | OPEN |
| SCR-40 | medium | Public handler page: a draft of ticket A is applied to ticket B opened in the same tab | `frontend/src/public-ticket/main.ts:110,121-125` | FIXED main - SCREENS-FIX-B2-2520 `86bd851ce` |
| SCR-41 | low | Emergency sheet: a scope chosen for one kind falls back to the first scope of the other kind | `frontend/src/door-windows/emergency.ts:182-184,259-272` | OPEN |
| SCR-42 | low | Door screen: any failed read of the emergency state hides the red strip and the button | `frontend/src/screens/door-windows.ts:178-184` | OPEN |
| SCR-43 | low (PLAUSIBLE) | Shared confirm dialog accepts an auto-repeated Enter | `frontend/src/components/confirm-dialog.ts:80-93,140-149` | OPEN (the FC-04 fix does not check `repeat`) |
| SCR-44 | low | My account > passkeys: a removal waiting for step-up still runs after the row's cancel | `frontend/src/components/sw-passkeys.ts:175-196,326-328` | OPEN |
| SCR-45 | low | Administrator factor reset: no in-flight guard on Enter; result painted on whichever user is selected | `frontend/src/components/sw-second-factor.ts:451-468`, `components/sw-user-factors.ts:100-116` | OPEN |
| SCR-46 | low | Notice board items: full-list replace built from stale state, no in-flight guard | `frontend/src/screens/system-notices.ts:819-837` | OPEN |
| SCR-47 | low | Backup tab: an installation with no backups shows "the backup list did not load" | `frontend/src/screens/system-diagnostics.ts:2206` | OPEN |
| SCR-48 | low | Audit log: overlapping filter reads; times in the browser's zone; CSV cells not neutralised | `frontend/src/screens/system-audit.ts:92,116-129` | OPEN |
| SCR-49 | low | Users and permissions: revoking a user's role binding is one click (incl. one's own) | `frontend/src/screens/system-access.ts:641-663,772` | OPEN |
| SCR-50 | low | "People on stations only": transport failure reads "not performed"; late duplicate check lands on another person | `frontend/src/screens/wiskey-station-people.ts:171-217` | OPEN |
| SCR-51 | low | Banner keeps a talk session with no UI after a 403; station-permissions `busy` is a single slot | `frontend/src/components/sw-incoming-call.ts:361-362`, `screens/wiskey-station-permissions.ts:93-113` | OPEN |
| SCR-52 | low | Map room card "all off": partial failure not reported, no in-flight guard | `frontend/src/screens/explore-floor-map.ts:2507-2513,3009-3026` | OPEN |
| SCR-53 | low | Deletes with no confirmation: water price version, temperature scheduled report (fails silently) | `frontend/src/screens/water/page-settings.ts:147-152,195`, `temperature/whatsapp.ts:243` | OPEN |
| SCR-54 | low | Schedules list: bulk enable / disable acts on selections hidden by the filter or page | `frontend/src/screens/devices-schedules.ts:574-578,606-616` | OPEN |
| SCR-55 | low | Event centre: silent 500-row limit; multi-day ranges use UTC day edges | `frontend/src/screens/investigate-events.ts:1083-1099,1376` | OPEN |
| SCR-56 | low | Tickets table: an in-flight poll overwrites an inline status change; calendar drag not rolled back when the reload fails | `frontend/src/screens/tickets-table.ts:372-386,621-626`, `calendars/view-calendar.ts:943-960` | OPEN |
| SCR-57 | low | Home dimmer and several home positions are physical (RTL-only): the English home is mirrored wrongly | `frontend/src/home/home-styles.ts:254-261,423-424,641-642,747,910` | OPEN |

### 3.8 TESTS-RELEASE (`docs/review/DEEP-REVIEW-2520-TESTS-RELEASE.md`)

| Id | Sev | Title | file:line | Status |
|---|---|---|---|---|
| TR-01 | high | Backend retry turns real failures into FLAKY (gate passes) when the retry runs nothing | `scripts/gate/release_gate.py:563`, `:610-621` | FIXED main - GATE-HARDEN-2520 `8e025887a` (`parse_pytest_passed`, `retry_verdicts`); installed on the runner 25.11 |
| TR-02 | high | The runner's engine lacked GATE-ONEPROJECT-2480 (50 spec files on one project); nothing detected install drift | `scripts/gate/release_gate.py:1180-1209`, `scripts/gate/release_gate2.sh:105-110` | FIXED main - GATE-HARDEN-2520 `8e025887a` (`engine_sync.py` install + strict drift check in `release_gate2.sh`, `engine_sha256` in reports). Fix part (c) - list tests skipped on every project - not done. |
| TR-03 | high | The nightly safety net missing or red for a week; the tagging rule (3A) is enforced by no script | `scripts/gate/gate_entry.py:132-139`, `scripts/gate/gate_release.sh:35-38` | PARTIAL - (a) the four 25.11 nightly failures triaged and their specs fixed (GATE-HARDEN-2520 `8e025887a`, verdicts in its change note); (b) `tagcheck` in `release_check --tag`, (c) NODISK / SKIPPED as a red status, (d) the disk-shortage cause: OPEN (`release_check.py` still has no `tagcheck`) |
| TR-04 | medium | Nothing proves the shipped UI bundle (`smplwise_vms/www`) is the build of the gated source | `scripts/release_check.py:416-422` | PARTIAL - GATE-HARDEN-2520 `8e025887a`: `www/arx-sw.js` must carry `arx-shell-<version>` (catches a forgotten rebuild); a frontend change after the rebuild is still not detected (no tree-hash build stamp, no dist/www hash compare) |
| TR-05 | medium | The blocking backend lint lane of a release gate lints `~/smplwisebms`, not the branch under test | `scripts/gate/gate_entry.py:156`, `scripts/gate/lint_backend.py:45-54` | OPEN (still `lb.run(lb.default_root())`) |
| TR-06 | medium | `~/known_issues.json`: an untracked allowlist without expiry hid every failure of `evidence-pwa-push.spec.ts` | `scripts/gate/release_gate.py:90`, `:472-492`, `:1343-1347` | FIXED main - GATE-HARDEN-2520 `8e025887a` (`GATE_KNOWN_MAX_DAYS`, ticket + expiry required); the runner entry removed |
| TR-07 | medium | Count-drop baseline a month old: a full run may lose 72 % of the backend tests and still pass | `scripts/gate/gate_baselines.json:8-12`, `scripts/gate/release_gate.py:2014-2040` | OPEN (baseline still dated 2026-10-27, backend 17,611) |
| TR-08 | medium | Coverage gaps with a wide blast radius: bridge vs real HA, `run.sh` never executed, aarch64 image, no coverage measurement | `scripts/gate/addon_build_check.sh:237-238`, `smplwise_vms/backend/tests/bridge_loader.py` | OPEN |
| TR-09 | medium | A targeted `--after` gate can pass a head on which the full suite never ran, with no healthy nightly behind it | `scripts/gate/gate_release.sh:35-38`, `scripts/gate/release_gate2.sh:59-64` | OPEN |
| TR-10 | low | Playwright reuses whatever serves port 4173; eight unit specs escape the page-spec detector | `frontend/playwright.config.ts:8`, `:46-50`, `frontend/playwright.unit.config.ts:24` | OPEN |
| TR-11 | low | Two quiet-hours tests fail for one minute a day (23:59 local) | `smplwise_vms/backend/tests/test_notify_whatsapp.py:356`, `:887` | FIXED main - GATE-HARDEN-2520 `8e025887a` (`daytime_clock`; also e-mail and two announcement tests). Not run at 23:59 (NOT_RUN at that minute). |
| TR-12 | low (PLAUSIBLE) | Bridge copy swap can leave a `.smplwise-old` / `.smplwise-new` folder in `custom_components` | `services/bridge_install.py:113-131` | OPEN |
| TR-13 | low (PLAUSIBLE) | Mirror check compares by size and mtime first (`filecmp.dircmp` shallow) | `scripts/sync_integration.py:35`, `scripts/release_check.py:52` | OPEN |
| TR-14 | low | The nightly cron runs at 02:00 UTC, not 02:00 Asia/Jerusalem | runner crontab; `scripts/gate/nightly_tests.sh:2` | OPEN |

## 4. Not yet reviewed - the starting scope of the final review

Each review's own statement of what it did not read (or read only at outline level). No claim is made about any of these.

**SECURITY.** The review lists the files it read end to end (identity, sessions, remote channel, tokens, second factor and its
variants, RBAC, audit, rate limits, CSRF, backup / restore, off-box routes, the WebSocket identity helper) and declares no further gap.
Not in that list, so not covered by it: the authorization of the other routers module by module (left to the area reviews), and anything
executed - SEC-3 to SEC-8 were read only (NOT_RUN).

**WISKEY-BRIDGE** (partial coverage - one reviewer, no sub-reviewers).
- Outline level only: `wiskey_channels.py`, `routers/access_control_station_ops.py`, `access_control_door_tech.py`,
  `access_control_schedule_writes.py`, `access_control_command.py`, `wiskey_switches.py`, `access_control_system_status.py`,
  `wiskey_station_ops.py`, `routers/access_control_people.py`, `services/intercom_media.py`, `wiskey_service_write.py`,
  `access_service_writer.py`, `wiskey_join_live.py`, `bridge_rotation.py`.
- Not reviewed: the bridge's `lease_*`, `schedule_*`, `media_*`, `config_*`, `cast_*`, `stream_source_service`, `service_identity`,
  `runnable`, `wiskey_door_block`, `config_flow`; backend `bridge_rotation` state machine in full, `bridge_install`, `bridge_discovery`,
  `bridge_key_*`; `intercom_sync`, `intercom_adapter`, `intercom_client`, `intercom_writes` / `_write_journal`, `intercom_authority`,
  `intercom_messaging*`, `intercom_consent`, `intercom_calls`, `intercom_listen`, `intercom_capture`, the media / listen / calls /
  messaging / capture routers and websockets; `wiskey_native_write`, `wiskey_write_lineage`, `wiskey_schedule_writes`,
  `wiskey_door_tech`, `wiskey_emergency_direct`, `wiskey_feature_exec`, `wiskey_event_resume`, `wiskey_intents`, `wiskey_peer*`,
  `wiskey_pairing`, `wiskey_managed_install`, `wiskey_auto_install`, `wiskey_installer*`, `wiskey_profiles`, `wiskey_people_csv`,
  `wiskey_triage`, `wiskey_wa_queue`, `wiskey_ops_views`, `wiskey_access_*`, `wiskey_relay_map*`, `wiskey_live_validation`, the
  access-grant engine and its routers. Suggested split: bridge services; intercom media / calls / messaging; door-tech / schedule /
  station writes and the write journal; people / lineage / install.

**VIDEO.**
- Frigate service layer above the HTTP gate (`frigate_control_svc`, `frigate_config_svc`, `frigate_native_svc`, `frigate_events`,
  `frigate_perm_restream`, `routers/frigate*.py`).
- Media groups, the multimedia router, media queue / commands / store / model, `notices/display.py`.
- `camera_discovery/service.py` beyond its structure; `wsd.py`, `sweep.py`, `known.py`.
- Recording search, recorded days, time-zone conversion (`recordings.py`, `recorded_days.py`, `provision_time.py`), playback groups.
- `nvr_settings.py`, `nvr_batch.py`, `nvr_encoding_batch.py`, `nvr_system.py`, `nvr_schedule.py`.
- Frontend API clients other than the live player's error-frame handling. Nothing in this area was executed (NOT_RUN).

**BACKEND-CORE.** Sampled only (time zones, timeouts, queue bounds): `schedule_ops.py`, `automation_ops.py`, `automation_ext.py`, the
off-box targets (`backup_offbox.py`, `offbox_gdrive.py`), `mobile_push.py`, the e-mail digest path, the calendar jobs. The
table-rebuild migrations were not replayed against old data. Not run: the backend suite, the backup lock-hold timing.

**DOMAIN-MODULES.** Read at the routes / authorization seams only: tickets main app and the RFQ / vendor portal, the public ticket
listener, calendar feeds and external sync, insights delivery, temperature runtime / report links, water alerts and sampler, the
emergency readiness engine, the maintenance service and files, the energy meters store. Not reviewed: the frontend of these modules,
migrations, the PDF rendering engines, the WhatsApp / e-mail transports.

**FRONTEND-CORE.** `shell/nav.ts` (tab tables, landing rules), `shell/tabs-mode.ts`, `shell/header-fit.ts`, `components/sw-dropdown.ts`
beyond its listeners, `sw-sheet` / `sw-drawer` / `sw-table` / `sw-tabs` internals, `design/*` (tokens, skins, palettes, contrast),
`shell/sw-user-menu.ts`, the generated wire types beyond their use. Nothing was executed (no build, no unit, no browser run).

**FRONTEND-SCREENS.** Not reached: `screens/home-widgets*.ts`, `home-edit-panel.ts`, `home-site-view.ts`, `system-home-screen.ts`,
`system-wall.ts`, `wall/sw-wall.ts` rendering; `wiskey-schedules.ts`, `wiskey-events.ts`, `wiskey-access-diag.ts`,
`wiskey-relay-map.ts`, the `system-access-*.ts` sub-screens, `system-doors.ts`, `system-door-blocks.ts`; `investigate-history-map.ts`,
`investigate-reviews.ts`, `investigate-incidents.ts`, `live-overview.ts`, `live-views.ts`, `system-storage.ts`; `devices-building.ts`
control paths, `scene-editor.ts`, elevators, temperature detail, electricity price / VAT settings, water accounts / usage;
`tickets-overview.ts`, `tickets-rfqs.ts` and the RFQ award / send flow, `ticket-cost-card.ts`, `vendor-accounts.ts`, the public
`portal/` and `claim/` internals, `system-tickets.ts`, `system-calendars.ts`; `system-wizard.ts`, `system-cast.ts`,
`system-multimedia*.ts`, `system-quiet-windows.ts`, `system-presence*.ts`, `installer-*.ts`, the plan editor / floor-map editors. Also:
phone width (360-430 px) and rendered RTL / English layout (no screenshots taken), a full no-scroll pass (only spot-checked against
`docs/changes/SCROLL-AUDIT-2480.md`), and a line-by-line cross-read of the earlier audit documents. Nothing was built or run.

**TESTS-RELEASE.** NOT_RUN: any gate, the backend suite, Playwright, an image build, `scripts/wire_route_coverage.py` (did not finish
in two minutes; the per-route coverage answer is still missing). The gaps of TR-08 are themselves unreviewed ground: the bridge
against a real Home Assistant (no hassfest, no import smoke), `run.sh` under the real entrypoint, the aarch64 image, coverage
measurement, the 74 live-only specs (`SW_LIVE`), and the gate tooling's own selftests outside any gate.

**Cross-area, for the final review's plan.**
- Most of the 131 findings were confirmed by reading only. The runs that did happen: SEC-1, SEC-2 (reproduced), WB-02 (probe), CORE-01,
  CORE-04, CORE-07 (scratch runs), D-01 (pure function), TR-01 (reproduced), TR-02 / TR-03 / TR-06 (runner read-only probes).
- The FIXED rows were tested by their fixing rows on fakes and mocks (no lab, no Home Assistant, no WisKey, no device). Lab items still
  open: what go2rtc sends for an `ffmpeg:` source (V-01), the lab bridge's key-store format before any re-pair (WB-02).
- Rows that landed after the review (2.53 / 2.55 trains: WisKey media v2, A2 exec, known trees rc20, legacy import / migration, pilot
  rollback, home scroll, load budget, MFA T095 rest ...) were not in any of the eight reviews and are new ground for the final review.

## 5. Sources and method of this index

- Review files read from: `origin/review/DEEP-2520-<AREA>:docs/review/DEEP-REVIEW-2520-<AREA>.md` (all eight, in full).
- Change notes read from `origin/release/2530-train:docs/changes/`: SEC-FIX-2520, VIDEO-SECFIX-2520, FE-SAFETY-FIX-2520,
  SCREENS-FIX-A-2520, SCREENS-FIX-B-2520, SCREENS-FIX-B2-2520, WISKEY-NOFALLBACK-FIX-2520, WISKEY-NOFALLBACK-2-2530,
  BRIDGE-REPAIR-LEGACY-2520, GATE-HARDEN-2520; from their branches: TEST-STABILITY-2530, PILOT-ROLLBACK-2550.
- Merge state: every fixing branch tip is an ancestor of `origin/main` except WISKEY-NOFALLBACK-2-2530 (train only); TEST-STABILITY-2530,
  PILOT-ROLLBACK-2550 and PLAYER-ERROR-TEXT-2530 are in neither.
- This index changes no product code and ran no test.
