# סבב בדיקות 10 — אימות מול NVR ו-HA אמיתיים ונגישים — 26.9.2026 (0.1.92, סבב 10)

מטרה: הבעלים דיווח שה־NVR וה־HA נגישים כעת מהתחנה, וביקש להריץ את כל מה שאפשר. הסבב הזה חוזר על 36 הבדיקות
שהיו מסומנות BLOCKED בסבבים 9-8-7 (14 שדרשו אירועים טריים, 19 NVR/go2rtc, 3 HA מחובר) בכרום אמיתי מול המכשירים
האמיתיים. הסבב הקודם: `TEST_ROUND_RESULTS_2026-09-26_HE.md` (סבב 9).

## תנאי הסביבה

- הענף `pilot/round10-live-verification` מ־`g0/intake`. אין שינוי קוד מוצר בסבב הזה — רק תיקוני בדיקות.
- ה־health: `nvr_configured: true`, `go2rtc_configured: true`, `home_assistant.connected: true`, אירועים זורמים
  בזמן אמת (`events.ingest.connected: true`). 11 מצלמות מזוהות.
- אף בקשה לא נשלחה ל־HA מעבר למה שהבדיקות הקיימות עושות; אין כתיבה לקונפיגורציית go2rtc, למשתמשי HA או להקלטות.
- שתי בדיקות (`evidence-nvr-record`, ותת-חלק מ־`evidence-owner-round9`/`owner-round8`) כותבות זמנית ל־NVR האמיתי —
  הקלטה ידנית לכמה שניות, כיול שעון/NTP, דגל OSD, לוח זימון, קו חכם — כולן עם שחזור (rollback) מפורש בסוף, כפי
  שהיו מאושרות ומתועדות כבר מסבבים קודמים (T075). לא בוצעה שום פעולה חדשה שלא הייתה מאושרת.

## 1. מה שנמצא ותוקן (3 סיבות שורש, לא רגרסיה במוצר)

| # | תופעה | שורש הבעיה | תיקון |
|---|---|---|---|
| 1 | שימור קטע ב־Cases חיכה 180 שנ' ונכשל | ייצוא אמיתי מול NVR אמיתי לוקח כ־4:49 דק' (נבדק ישירות בטבלת `export_jobs`: `state=done` אחרי כן) — הבדיקה כוילה לזמן התגובה המיידי של השרת הזמני | הוארך ל־480 שנ' |
| 2 | ניגון מוטבע ב־Events: "0 סשנים" נכשל | הבדיקה בדקה שאין אף סשן ניגון **בכל המערכת**, לא רק את הנגן שלה; בדיקות סמוכות מחזיקות סשנים משלהן לזמן קצר | הבדיקה בודקת רק שרכיב הנגן שלה עצמו נעלם מה־DOM אחרי "עצור" |
| 3 | שלוש בדיקות NVR (עריכת אזורי זיהוי, הקלטה ידנית, OSD, לוחות זימון+כללים חכמים) חיפשו רכיבים גלויים מיד בכניסה למסך | גרסה קודמת (round 4, 0.1.6x בערך) קיפלה את כל הגדרות המצלמה תחת אקורדיון סגור אחד ("הגדרות מצלמה"), כדי שהווידאו יישאר הדבר הראשון שרואים; הבדיקות נכתבו לפני השינוי ולא פותחות את האקורדיון (חלקן גם חיפשו עטיפת רכיב ישנה שכבר לא קיימת) | הבדיקות פותחות את האקורדיון ואת השורה הספציפית שהן צריכות, כולל שוב אחרי `reload` |
| 4 | מונה אירועים בציר הזמן: ציפה ל־46, קיבל 47 | אירועים אמיתיים ממשיכים להיכנס בזמן אמת; שתי המדידות בבדיקה נלקחו במרחק כמה שניות זו מזו (שני טעינות עמוד) | המדידה השנייה נקראת מחדש מיד לפני ההשוואה במקום להשתמש בתמונת מצב ישנה |

כל תיקון תועד עם קובץ:שורה בקוד, אומת בנפרד (ריצה בודדת) ואז בתוך המנה כולה.

## 2. ממצא: התכנסות נעילת SQLite תחת עומס מתמשך (לא רגרסיה, לא תוקן בסבב זה)

הרצת 65 הקבצים בשלוש מנות (עם הפסקות קצרות ביניהן לניקוי) — **כל 27 הקבצים עברו**, כולל שלוש הרצות חוזרות שאישרו
כל תיקון בנפרד. אבל הרצה אחת, רציפה, של כל 27 הקבצים ברצף (כ־50 בדיקות, בלי הפסקה, בהמשך ישיר לכל הבדיקות
שכבר רצו באותה השעה — מעל 45 דקות של עומס רציף על NVR אמיתי) חזרה על תקלה שכבר ראיתי במנה 3: גל של
`sqlite3.OperationalError: database is locked` על `BEGIN IMMEDIATE`, שהופך עשרות בקשות API לא קשורות
(מצלמות, הגדרות, אירועים, storage) ל־500 "Internal Server Error" פשוט, לא JSON. הקוד כבר מכיל מנגנון מכוון
בדיוק לבעיה הזאת (`unlocked(conn)` ב־`db.py`, המשחרר את נעילת הכתיבה סביב קריאה איטית להתקן), ו־`nvr_write.py`
משתמש בו בעקביות (22 מופעים). ה־writer שמחזיק את הנעילה לאורך זמן לא אותר בוודאות במסגרת הסבב הזה — זה
דורש חקירה זהירה יותר (אולי כתיבות רקע תכופות כמו `ha_sync`/`events_ingest` שאינן עטופות ב־`unlocked`, ואולי
תרומה של סריקת אנטי-וירוס בזמן אמת על קובץ ה־SQLite תחת Windows — משהו שכנראה לא קורה באותה צורה בהתקנה
האמיתית שרצה על לינוקס). המערכת התאוששה לבדה תוך דקות בכל מקרה.

**לא תוקן בכוונה**: זה שינוי בליבת הטיפול בטרנזקציות, ותיקון בניחוש בלי אבחון מלא הוא סיכון גבוה מדי להכניס
עכשיו. ההערכה למחקר ותיקון מסודר: כחצי יום עד יום (אבחון + בדיקה על לינוקס אמיתי, לא רק Windows).

## 3. סיכום

| | תוצאה |
|---|---|
| 65 קבצי evidence, שלוש מנות עם הפסקות | **27/27 מהקבצים שהיו BLOCKED עברו**, כל אחד אומת בנפרד ובתוך מנה |
| הרצה רציפה אחת של כל ה־27 ברצף (עומס לא רגיל) | 31/50 בדיקות נכשלו בגל נעילת SQLite; ממצא נרשם, לא תוקן |
| Backend (`pytest`, כל החבילה) | ✔ 371 עברו (אין שינוי קוד מוצר בסבב זה) |
| TypeScript (`tsc --noEmit`) | ✔ נקי |
| תיקוני הבדיקות | 4 קומיטים, קובץ:שורה + הסבר בכל אחד |

## מה זה אומר בפועל לבעיה שלך

השימוש הרגיל שלך (לא עשרות בדיקות רצופות) לא אמור לפגוש את גל הנעילה. שווה לדעת שהפעלת כמות גדולה של כתיבות
אמיתיות ל־NVR ברצף צפוף (למשל אם תשנה הרבה הגדרות מצלמה בזה אחר זה תוך דקה-שתיים) עלולה להאט זמנית את המערכת
כולה לכמה דקות; זה לא קרס — זה חוזר לעצמו.

## 4. Findings and fix — the SQLite lock storm (2026-09-29, branch `pilot/db-lock-storm`)

### בקצרה (לבעלים)

נמצאה הסיבה, והיא לא אנטי-וירוס: כמה פעולות החזיקו את "מנעול הכתיבה" היחיד של מסד הנתונים **בזמן שחיכו להתקן** —
חיפוש הקלטות ב־NVR בזמן יצירת ייצוא / שמירת עותק בתיק, הקלטה ידנית (התחלה, עצירה, ועצירה אוטומטית של ה־janitor),
שליחת התראה ל־Home Assistant מתוך חוק, שיוך ישות לאזור, ובנוסף כל בקשה החזיקה את המנעול עד שהדפדפן סיים לקבל את
התשובה (הורדת קובץ שלמה). כשה־NVR איטי (כמו אחרי 45 דקות עומס) ההמתנה עוברת את 10 השניות שכל כותב אחר מוכן לחכות,
ואז עשרות בקשות לא קשורות נופלות ב־500. בבדיקת עומס חדשה, בלי NVR ובלי אנטי-וירוס, הגל שוחזר (24 שגיאות נעילה
ו־25 תשובות 500 בדקה וחצי) ונעלם לגמרי אחרי התיקון (0 ו־0, ההמתנה המרבית ירדה מ־11.4 ל־1.1 שניות). כל הקריאות
להתקנים רצות עכשיו בלי המנעול, כל תשובה נסגרת במסד לפני שהיא נשלחת, כתיבות רקע שנתקלות בעומס מנסות שוב במקום
להיזרק (שורות audit לא הולכות לאיבוד), ו־`/health` מראה מי החזיק את המנעול הכי הרבה זמן — כך שאם זה יקרה במעבדה,
נדע מיד מי.

### Facts (pre-fix code, `c0594f3`)

How SQLite is opened and held:
- `db.py:49-53` — a new connection for every request and every background unit of work: `sqlite3.connect(timeout=10,
  isolation_level=None, check_same_thread=False)`, `journal_mode=WAL`, `busy_timeout=10000`, `synchronous` left at the
  default (FULL). No connection is shared across threads or kept open across awaits.
- `db.py:95` — a write-mode request (`auth.get_conn`, `auth.py:33`, the default for most routes) runs its whole handler
  inside `BEGIN IMMEDIATE`, i.e. holds SQLite's single write lock from the first line to the end. `db.py:92-93` read
  mode is a deferred query-only transaction; `db.py:116` `write_aside()` is a short IMMEDIATE transaction.
- `db.py:148-160` — `unlocked()` is not a retry: it COMMITs, runs the block in autocommit and takes `BEGIN IMMEDIATE`
  again. The only retry in the code base was `ha_sync._busy_retry` (`services/ha_sync.py:310`, registry refresh only).
- FastAPI 0.141 closes a dependency with `yield` only after the response body was sent (`fastapi/routing.py`,
  `request_response`: `await response(...)` inside the request `AsyncExitStack`). So every write-mode request kept the
  write lock until the client had received the whole body — every download and every slow Ingress client.
- No long-lived read transaction exists (every WebSocket and worker opens short connections in a thread), so WAL
  checkpoint starvation is not a factor: the WAL file was 0 bytes at the end of every load run.

Write-lock holders across slow I/O (the root causes):

| # | path | what ran under the write lock |
|---|---|---|
| 1 | `POST /exports`, `POST /cases/{id}/items/{item}/preserve` → `services/exports.py:148` | the paged NVR recording search, queued behind the process-wide `recordings._search_lock` (`services/recordings.py:89`) that the periodic `events_derive` pass (all cameras) and the storage warm-up (~50 s cold) also hold |
| 2 | `POST /cameras/{id}/record/start|stop` → `services/nvr_write.py:283`, `:296`; janitor `stop_expired_manual` `:312` | an NVR PUT (8 s client timeout per phase, `services/nvr.py:66`); `routers/nvr_write.py:179-180` wrapped only `pass` in `unlocked()`; the janitor did the PUT inside its own write transaction every 30 s |
| 3 | `rules.evaluate_event` from the alert stream (`services/events_ingest.py:311`) and the HA state sync (`services/ha_sync.py:466`) | `HA_NOTIFY` (`services/rules.py:172`): a POST to Home Assistant, 15 s timeout, inside the event's write transaction |
| 4 | every write-mode route | the response transfer (above) |
| 5 | `PUT /devices/entities/{id}/area` (`routers/devices.py:223`, 0.1.125); bridge re-install (`services/bridge_install.py:121`) | the HA bridge call; the Supervisor discovery POST |

Writes lost to a busy database: an alert whose transaction failed was dropped ("alert handling failed"); a live-video
audit row was swallowed on `sqlite3.Error` (`routers/media.py:191`); a device-bulk outcome row was logged as "could not
be recorded". The HA state sync and the alert stream themselves are short per-event transactions: they are the victims
of the storm, not its cause (the pure-contention run below has zero errors at ~40 HA events/s).

Windows antivirus is not needed to reproduce the storm and nothing in the numbers points at it (with instant devices
the longest write-lock hold was 0.4-0.9 s). It cannot be ruled out as an extra factor on this workstation.

### Load test

`smplwise_vms/backend/tests/test_db_contention.py` (opt-in: `SW_DB_LOAD=1`, duration `SW_DB_LOAD_S`, device latencies
`SW_DB_LOAD_SLOW` / `SW_DB_LOAD_SEARCH_S` / `SW_DB_LOAD_PUT_S` / `SW_DB_LOAD_NOTIFY_S`). Twelve concurrent actors through
the product's own code against a temporary database: 2 HA state-push threads (~40 events/s, `ha_sync`), the NVR alert
stream (`events_ingest`, every tenth alert fires an `ha_notify` rule), refusal audit rows (`write_aside`), 3 API readers +
1 API writer (real ASGI requests), export create/delete, the `events_derive` pass, manual recording start/stop, and a
probe that measures how long an innocent writer waits for the lock. NVR, HA and network are faked. Reference
workstation, 90 s runs (~95-120 s wall).

| run | device latency (search page / NVR PUT / HA notify) | ops | `database is locked` | HTTP 500 | probe max wait | innocent p95 |
|---|---|---|---|---|---|---|
| before, instant devices (pure contention) | 0 / 0 / 0 s | 6017 | 0 | 0 | 1.36 s | ~0.13 s |
| before, default | 2.5 / 1.5 / 4 s | 1445 | 1 | 0 | 10.9 s | ~3 s |
| before, slow NVR (as after 45 min of real load) | 5 / 3 / 8 s | **368** | **24** | **25** | **11.4 s** | ~11 s |
| after, default | 2.5 / 1.5 / 4 s | 5881 | 0 | 0 | 1.44 s | ~0.13 s |
| after, slow NVR | 5 / 3 / 8 s | **5805** | **0** | **0** | **1.14 s** | ~0.13 s |

"Before, slow NVR" is the round-10 picture: unrelated API calls fail with a plain 500, 7 of 22 audit calls fail, and
the system recovers when the device calls end. After the fix the longest write-lock hold in every run is below 1.2 s
(`lock_stats.max_hold_s`), no hold passed the 3 s warning threshold, and every audit call wrote its row. The ~1-1.5 s
tail latencies that remain are identical with instant devices before and after (thread scheduling on this machine, not
lock holds).

### What changed

- Device calls moved out of the write transaction: the export/preserve NVR search (`exports.create_job`), manual
  recording start/stop and the janitor's expiry stop (with a re-check after re-locking, so a parallel start/stop never
  doubles a session or its audit row), the area assignment bridge call, the bridge discovery POST.
- Rule notifications to HA are sent after the commit (`rules.evaluate_event(deliver=False)` + `deliver_pending`) in the
  alert stream and the HA state sync (`ha_sync.handle_state_event`). The direct API is unchanged (`deliver=True`).
- Commit before send: `main.CommitBeforeSend` (ASGI middleware) commits the request's connections when the response
  starts, so no transfer holds the lock. A handler that raises is unchanged (its dependency commits expected API errors
  with their audit rows, or rolls back, before the error response starts).
- Bounded retries with jitter (`db.retry_locked`, 3 attempts) instead of dropping: alert-stream events and gap events,
  HA state updates, the HA registry refresh phases, live-video audit rows, device-bulk polls and outcome rows.
- Accounting: every write-lock hold is timed; a hold over 3 s (`SW_DB_SLOW_HOLD_S`) logs `write lock held N s by
  <route or function>`, and every busy failure logs who held the lock and for how long. `/health` → `db.write_lock`
  (`holds`, `slow_holds`, `max_hold_s`, `max_hold_by`, `busy_errors`, `last_busy`).
- The janitor runs a PASSIVE WAL checkpoint every 30 s (TRUNCATE only when the WAL passes 32 MB, with a 0.2 s timeout
  so it never queues writers).
- Kept on purpose: `synchronous=FULL` (NORMAL gave no measurable gain here and would let a power cut drop the last
  committed audit rows), `busy_timeout` 10 s, the `unlocked()` API and all its callers, the 0.1.126 `mirror_lock` →
  database ordering, one connection per request.
- Tests: `tests/test_db_locking.py` (11 fast tests; each fake device asserts the lock is free when it is called —
  10 of them fail on the pre-fix code, the six lock-holder tests among them) and the opt-in load test above.

### Still open

- Verify on the real add-on (Linux, real NVR): after a long session, `/health` → `db.write_lock.busy_errors` should stay
  0 and `max_hold_by` names whatever held longest; any `write lock held` warning in the add-on log names the next holder.
- An HA notification still runs on the alert-stream thread after the commit: a slow HA delays the next alert by up to
  the notify timeout (no longer the database).
