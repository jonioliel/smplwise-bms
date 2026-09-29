# סבב בדיקות 10 — אימות מול NVR ו-HA אמיתיים ונגישים — 26.9.2026 (0.1.92, סבב 10)

Source: original

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
  recording start/stop and the janitor's expiry stop, the area assignment bridge call, the bridge discovery POST.
- Checks that guard a device call are repeated after it, in the transaction that writes the result: the export quota
  (5 active jobs per owner) and "already preserving" run again after the NVR search, right before the INSERT, so a
  double click or two parallel requests create one job, never an orphaned second download.
- Two-phase where the device acts: manual recording start commits its session row and an `attempt` audit row before
  the NVR is told to record; an NVR refusal closes the row (`start_failed:<code>`) with a `denied` outcome row; if the
  database stays busy after the NVR started, the recording is stopped again and the committed row stays for the
  janitor. Area assignment commits an `attempt` audit row before Home Assistant is asked (outcome row as before).
  Taking the lock back after a device call (`unlocked()` exit) is retried (3 attempts) instead of failing at once.
- Rule notifications to HA are sent after the commit (`rules.evaluate_event(deliver=False)` + `deliver_pending`) in the
  alert stream and the HA state sync (`ha_sync.handle_state_event`). The direct API is unchanged (`deliver=True`).
- Commit before send: `main.CommitBeforeSend` (ASGI middleware) commits the request's connections when the response
  starts, so no transfer holds the lock, and makes them query-only (a later write on them fails loudly). A handler that
  raises is unchanged (its dependency commits expected API errors with their audit rows, or rolls back, before the
  error response starts). Behaviour change: a download's audit row (`video.export.download`, bundles, backups) is now
  committed when the transfer starts and kept even if the client disconnects mid-download; before, a disconnect during
  the transfer rolled it back.
- Bounded retries with jitter (`db.retry_locked`, 3 attempts) instead of dropping: alert-stream events and gap events,
  the HA registry refresh phases, live-video audit rows, device-bulk polls and outcome rows. HA state updates get ONE
  attempt (at most the 10 s busy timeout): they run inside the HA WebSocket client's loop, and ~30 s of retries would
  miss the socket's ping deadline and force a disconnect plus a full resync; the next push or snapshot corrects a lost
  state.
- Accounting: every write-lock hold is timed; a hold over 3 s (`SW_DB_SLOW_HOLD_S`) logs `write lock held N s by
  <route or function>`, and every busy failure logs who held the lock and for how long (the accounting can never
  replace the busy error itself). `/health` → `db.write_lock`: the counters (`holds`, `slow_holds`, `max_hold_s`,
  `busy_errors`) for everyone, the holder names (`max_hold_by`, `last_busy`: request paths with ids) only for a
  `system.configure` holder.
- The janitor runs a PASSIVE WAL checkpoint every 30 s - PASSIVE only: it never takes the write lock and never waits for
  a reader, so it cannot queue writers.
- Kept on purpose: `synchronous=FULL` (NORMAL gave no measurable gain here and would let a power cut drop the last
  committed audit rows), `busy_timeout` 10 s, the `unlocked()` API and all its callers, the 0.1.126 `mirror_lock` →
  database ordering, one connection per request.
- Tests: `tests/test_db_locking.py` (18 fast tests; each fake device asserts the lock is free when it is called, plus
  concurrent export / preserve requests, a busy database after the NVR started, an NVR refusal, concurrent holder
  changes during a busy failure, the HA state deadline and the query-only released connection) and the opt-in load
  test above.

### Still open

- Verify on the real add-on (Linux, real NVR): after a long session, `/health` → `db.write_lock.busy_errors` should stay
  0 and `max_hold_by` names whatever held longest; any `write lock held` warning in the add-on log names the next holder.
- An HA notification still runs on the alert-stream thread after the commit: a slow HA delays the next alert by up to
  the notify timeout (no longer the database).

## 5. Soak (device-free) — T068, 2026-09-29 (branch `pilot/T068-events-cache-soak`)

### בקצרה (לבעלים)

הרצנו את כל ה־backend במשך 10 דקות מול NVR מדומה ו־Home Assistant מדומה שמופעלים מחדש כל 2–2.5 דקות, עם קליטת
התראות רצופה, קוראים, אישורי אירועים, "מסד איטי" (נעילת כתיבה של 3 שניות כל 40 שניות) וייצואים לדיסק קטן שמתמלא
בכוונה. התוצאה: 0 שגיאות "database is locked", 0 תשובות 500, אף התראה לא אבדה (2225 התראות תנועה = סכום הספירות
באירועים), 102 ייצואים נדחו בצורה מסודרת (507 עם הודעה בעברית), 14 ייצואים הושהו באמצע כשהדיסק התמלא וכולם חזרו
לבד כשהתפנה מקום, ואחרי הכיבוי לא נשאר אף thread של המוצר. בדרך נמצאו ותוקנו שני דברים: מסך "חלונות" האירועים, ציר
הזמן של מצלמה וסיכום היום רצו תחת מנעול הכתיבה (עכשיו קריאה בלבד), וייצוא שקרס נשאר "רץ" עד הפעלה מחדש (עכשיו מסומן
"נכשל"). קליטת ההתראות מה־NVR מופרדת עכשיו מהכתיבה למסד: מסד איטי כבר לא עוצר את קריאת הזרם, והתראה איטית ל־HA כבר
לא מעכבת את קריאת ההתראה הבאה (הסעיף השני ב"Still open" למעלה).

Details, numbers and how to run it: `docs/operations/SOAK_LOCAL.md`; bounds and the events-list measurement:
`docs/operations/RESOURCE_BUDGET.md` ("Bounds on caches and queues", "Events-window cache"). Still open: the 3-5 h run
and the device-dependent soak (real NVR / go2rtc restarts, streams and transcodes on the HA host).

## 6. סיבת שורש ותיקון, 2026-09-29 (צד מסד הנתונים; ענף `pilot/db-lock-storm`)

### בקצרה (לבעלים)

סעיף 4 מצא ותיקן את הגורם העיקרי: פעולות שחיכו ל־NVR / ל־Home Assistant בזמן שהחזיקו את מנעול הכתיבה היחיד של
מסד הנתונים. בסבב הזה בדקנו מה נשאר, בשלוש דרכים: מלאי של כל נתיבי הכתיבה, "שומר" אוטומטי שמחפש קריאה להתקן בזמן
שהמנעול מוחזק (בכל 450 הבדיקות של הקבצים שנוגעים בהתקנים: אפס מקרים), ובדיקת עומס חדשה שמריצה במקביל את כל הכותבים
התכופים. נמצאו שני דברים שנשארו, ושניהם תוקנו:

1. **ההמתנה עצמה לא הוגנת.** כשהמנעול תפוס, SQLite לא מעמיד את הממתינים בתור — כל אחד "ישן" ומנסה שוב (עד 100
   אלפיות שנייה בין ניסיון לניסיון), ומי שהגיע אחרון יכול לזכות שוב ושוב. בבדיקת העומס כתיבות חיכו עד 4 שניות
   מאחורי החזקות של שנייה לכל היותר. עכשיו יש תור מסודר (ראשון בא — ראשון נכנס) לפני המנעול.
2. **כל עדכון מצב מ־Home Assistant כתב לדיסק בכוח (fsync) בזמן שהמנעול מוחזק.** על כרטיס SD / eMMC — האחסון של רוב
   מארחי Home Assistant — זה אלפיות עד עשרות אלפיות שנייה לכל עדכון, ובקצב של ~40 עדכונים לשנייה זה כמעט כל הזמן.
   עכשיו כתיבות "מראה" של נתונים שההתקן שולח שוב (מצב HA, אירועים מהקלטות) לא מחכות ל־fsync; התראות NVR, אירועי
   HA, פעולות משתמש ושורות audit ממשיכות להיכתב לדיסק בכוח, כמו קודם (תוקן בסקירה, ראו 6.1).

בנוסף תוקנה העלאת תוכנית קומה / תמונת אתר או בניין, שעיבדה את הקובץ (שניות על המעבד של המארח) בזמן שהמנעול מוחזק.
גל "database is locked" עצמו לא שוחזר על Windows בבדיקה החדשה (רק זמני ההמתנה הארוכים); על ה־add-on האמיתי (Linux,
אחסון איטי יותר, בלי אנטי־וירוס) האנטי־וירוס כבר לא גורם אפשרי, אבל fsync איטי כן — והתיקון נכון בשני המקרים.

### סיבת השורש (בקוד שלפני התיקון, `52137c3`)

אחרי 0.1.129 אף נתיב לא מבצע קריאת רשת תחת מנעול הכתיבה (השומר `SW_DB_IO_GUARD`, למטה). מה שנשאר הוא האופן שבו כותבים
מחכים ומה עולה כל commit: `db.py:165` פותח כל חיבור עם `sqlite3.connect(timeout=10)` בלבד, כך שההמתנה למנעול היא
ה־busy handler של SQLite — השהיות של 1, 2, 5 … 100 אלפיות שנייה בלי תור, ומי שמגיע באמצע השהיה עוקף את מי שחיכה;
תחת זרם קבוע של commit-ים קצרים (שני חוטי HA, ההתראות, audit, בקשות API) ממתין מפסיד ניסיון אחרי ניסיון. ועל כל
commit של עדכון מצב HA (`services/ha_sync.py:344`, טרנזקציה לכל אירוע) ושל התראת NVR (`services/events_ingest.py:516`)
שולם fsync מלא בזמן שהמנעול מוחזק (`db.py:168`, `synchronous=FULL` לכולם): על NVMe של תחנת העבודה 1.4 ms לעומת
0.04 ms ב־NORMAL, ועל SD / eMMC פי כמה וכמה. בנוסף: `routers/plans.py:219`/`:224` (רינדור DXF / נרמול תמונה בהעלאת
תוכנית) ו־`routers/catalog.py:85`/`:106` (פענוח וקידוד מחדש של תמונת אתר / בניין) רצו תחת מנעול הכתיבה, על ה־event
loop.

### מלאי נתיבי הכתיבה

- חיבורים: חיבור חדש לכל בקשה ולכל יחידת עבודה ברקע (`isolation_level=None`, `check_same_thread=False`), WAL,
  `busy_timeout=10000`, `foreign_keys=ON`. כתיבה תמיד ב־`BEGIN IMMEDIATE`; קריאה ב־`mode="read"` (deferred,
  `query_only`). אין חיבור משותף בין חוטים, אין טרנזקציית קריאה ארוכה (קובץ ה־WAL היה 0 בתום כל הרצה), אין חיבור
  שמוחזק לאורך `await` של קריאת רשת (השומר).
- כותבים לפי מודול: בקשות API (`auth.get_conn`, commit לפני שליחת התשובה — `main.CommitBeforeSend`), `ha_sync` (עדכוני
  מצב, snapshot, רישום ישויות — חוט `ha-sync` עם event loop משלו), `events_ingest` (חוט כותב נפרד מאחורי תור חסום,
  T068), `events_derive`, `audit` (בטרנזקציה של הבקשה, או `write_aside` מחיבור קריאה), `push` (רישום תוצאת שליחה),
  `exports` (העובד), `device_bulk`, `nvr_write` (דו־שלבי), `thumbnails`, `storage` (החימום, עם `unlocked`), ה־janitor
  (ניקוי לפי תקופת שמירה, עצירת הקלטה ידנית, checkpoint), `autosync`, `bridge_install`, `intercom_*`, `ha_user_auth`.
- השומר `SW_DB_IO_GUARD=1` (`tests/db_io_guard.py`): בכל שליחת httpx (סינכרונית ואסינכרונית) ובכל המתנה לתהליך־משנה
  הוא סורק את מחסנית הקורא ומחפש חיבור שמחזיק כרגע את מנעול הכתיבה בתוך טרנזקציה. על 38 קבצי הבדיקות שנוגעים בהתקנים
  (450 בדיקות, כולן עברו): **0 מקרים**. מגבלה: fake שמחליף פונקציית התקן שלמה (ולא את ה־transport) לא נראה לשומר.

### התיקון

- `db.WriteGate`: תור FIFO אחד לכל קובץ מסד נתונים, לפני `BEGIN IMMEDIATE`. שחרור מעביר את התור ישירות לממתין
  הוותיק ביותר ומעיר רק אותו. המתנה מעבר ל־10 שניות נכשלת בדיוק כמו SQLite ("database is locked", נספרת ונרשמת עם
  המחזיק), ולכן `retry_locked`, `unlocked()` וכל הקוראים לא השתנו; ה־`busy_timeout` של SQLite ממשיך לכסות תהליך אחר.
  כל יציאה (commit, rollback, `release()`, `unlocked()`, BEGIN שנכשל, סגירה) משחררת את התור. `SW_DB_WRITE_GATE=0`
  מכבה אותו (פתח מילוט). `/health` → `db.write_lock` מראה גם `max_wait_s`.
- מחלקות עמידות: `connection(durable=False)` = `synchronous=NORMAL` (בלי fsync לכל commit; ב־WAL קריסת ה־add-on לא
  מאבדת כלום, הפסקת חשמל יכולה לאבד את השניות האחרונות) — רק לכתיבות "מראה" של נתונים שההתקן שולח שוב: מראת המצב
  והרישום של HA ואירועים שנגזרים מהקלטות. התראות NVR, עדכון HA שיוצר אירוע (ו־rule alerts), פעולות משתמש ו־audit
  נשארים `FULL` (6.1). זה מיישב את ההחלטה של
  סעיף 4 ("synchronous נשאר FULL") עם הבקשה ל־NORMAL: שניהם, לפי סוג הנתונים.
- checkpoint: `journal_size_limit` על כל חיבור; ה־janitor ממשיך ב־PASSIVE, ורק כש־WAL גדל מעבר ל־64 MB
  (`SW_DB_WAL_TRUNCATE_MB`) וברגע שקט (אף אחד לא מחזיק ולא ממתין בתור) — TRUNCATE תחת התור, עם המתנה של 0.5 שנ' לכל
  היותר לקוראים; רגע עמוס נדחה לסבב הבא.
- ללא שינוי: `busy_timeout` 10 שנ', ה־API של `unlocked()`, `retry_locked` (3 ניסיונות, backoff כפול עם jitter
  ‏0.5–1.5, תקרה 4 שנ'), חיבור לכל בקשה.

### מספרים

בדיקת העומס החדשה `tests/test_db_lock_storm.py` (`SW_PERF=1`): שני חוטי עדכוני מצב HA (~40/שנ'), התראות NVR (~5/שנ'),
שורות audit (~5/שנ'), כותב מדידה, 3 קוראי API וכותב API — דרך קוד המוצר, בלי התקנים. `SW_DB_STORM_FSYNC_MS` מדמה
fsync של SD / eMMC על כל commit של חיבור `FULL` (הדמיה, לא מדידה של כרטיס אמיתי). תחנת העבודה הייתה משותפת עם
משימות אחרות בזמן המדידות, לכן המספרים רועשים; הריצות הושוו בזוגות.

| ריצה | fsync מדומה | כתיבות | "database is locked" | p50 | p99 | max |
|---|---|---|---|---|---|---|
| לפני, 90 שנ' | 15 ms | 1232 | 0 | 0.095 | **1.90** | **4.19** |
| אחרי, 90 שנ' | 15 ms | 1999 | 0 | 0.066 | 0.81 | 2.31 |
| לפני, 90 שנ' | 0 | 1913 | 0 | 0.042 | 0.94 | 2.03 |
| אחרי, 90 שנ' | 0 | 2676 | 0 | 0.046 | 0.33 | 1.20 |
| A/B 60 שנ', תור פעיל (2 סבבים) | 15 ms | 1414 / 1765 | 0 | 0.10 / 0.05 | 0.34 / 0.28 | 1.50 / 0.83 |
| A/B 60 שנ', תור כבוי (2 סבבים) | 15 ms | 1345 / 1442 | 0 | 0.07 / 0.06 | 0.90 / 0.69 | 2.63 / 2.73 |

(זמנים בשניות, לכל הכתיבות כולל בקשות API. "לפני" רץ על כל הכותבים ב־FULL; ב־A/B שתי הזרועות כבר עם מחלקות העמידות,
וההבדל ביניהן הוא התור בלבד.) בבדיקת העומס של סעיף 4 (`test_db_contention.py`, מכשירים מיידיים, 60 שנ') ההמתנה
המרבית של כותב המדידה: 1.39 / 1.66 שנ' עם התור לעומת 1.98 / 2.24 בלעדיו; מספר הפעולות הכולל רועש מדי כדי להסיק ממנו.
ההחזקה הארוכה ביותר נשארה ~0.4–1.1 שנ' בלי שום קריאת התקן בתוכה — זמני תזמון של Python (GIL) עם ~10 חוטים פעילים על
תחנה עמוסה, לא I/O.

### בדיקות

`tests/test_db_gate.py` (15: סדר FIFO, timeout כ־"locked" עם רישום המחזיק, מסירה מיידית בשחרור, כל יציאה משחררת,
כותב מתהליך אחר, כיבוי התור, מחלקות העמידות של כותבי המראה, PASSIVE מתחת לסף, TRUNCATE ברגע שקט, בלי המתנה לכותב
עסוק, קורא ארוך, backoff / jitter / תקרה של `retry_locked`, retry שעובר מחזיק), `tests/test_db_io_guard.py` (השומר
מזהה קריאה תחת המנעול ורק אותה), `test_db_locking.py::test_uploads_are_decoded_and_rendered_without_the_write_lock`
(נכשל על הקוד הקודם), ובדיקת העומס האופציונלית.

### עדיין פתוח

- אימות על ה־add-on האמיתי (Linux, NVR ו־HA אמיתיים), אחרי שעות של שימוש: `/health` → `db.write_lock.busy_errors`
  צריך להישאר 0, ו־`max_wait_s` / `max_hold_by` מראים מי חיכה ומי החזיק הכי הרבה.
- יצירת גרסת תוכנית (`_page_png`, `derive_version_image` ב־`routers/plans.py`) עדיין מרנדרת תחת מנעול הכתיבה — פעולה
  נדירה של עורך, לא תוקנה כאן.
- עדכוני מצב HA עדיין נכתבים אחד־אחד מתוך ה־event loop של חוט ה־`ha-sync`; אם באתר אמיתי הקצב גבוה בהרבה מ־40/שנ',
  הצעד הבא הוא תור כתיבה עם אצווה (כמו ההתראות ב־T068).

### 6.1 סקירה, סבב 1 (Opus, 2026-09-29) — מה תוקן

- **B1 (חוסם):** `conn.execute("COMMIT")` ידני באמצע בקשה השאיר את התור תפוס: פקודת WisKey (`routers/access_control.py`
  `_Action.attempt`) נשלחה כשכל הכותבים ממתינים מאחוריה, ושורת ה־outcome של פתיחת הדלת נכתבה מאותו חוט ל־`write_aside`
  — המתנה לעצמו עד ה־timeout, והשורה אבדה (`test_intercom.py::test_release_round_trip_is_confirmed_single_and_audited`
  נכשל). נוספו `db.commit_now` / `db.rollback_and_restart`, ארבעת המקומות (access_control, devices ×2, auth) עברו אליהם,
  בדיקה אוסרת COMMIT / ROLLBACK / BEGIN IMMEDIATE ידניים מחוץ ל־`db.py`, ותור שמוחזק ע"י חיבור בלי טרנזקציה נרשם כשגיאה.
- **B2 (חוסם):** העלאות התוכנית והתמונות היו `async`, כך שהחזרת המנעול אחרי הרינדור רצה על ה־event loop — כל הזרמים
  וה־WebSocket קפאו (בבדיקה: `/healthz` ענה אחרי 9.7 שנ'). עכשיו הן סינכרוניות (threadpool); הבדיקה דורשת < 1 שנ'.
- **M1:** התראות NVR ואירועי HA (עם ה־rule alerts) לא נשלחים שוב, ולכן נכתבים `FULL`. SQLite אוסר לשנות `synchronous`
  בתוך טרנזקציה, אז הבחירה נעשית לפני BEGIN (`correlation.may_record`).
- **M2/L4:** `/health` מסתיר גם `max_wait_by` ממי שאין לו `system.configure`, ומוסיף `gate_timeouts`, `waits_over_1s`,
  `max_wait_recent_s` (10 דקות אחרונות), `write_gate` ומצב התור. **M3:** התור ו־SQLite חולקים תקציב המתנה אחד של 10 שנ'.
  **L1:** המתנה שנקטעה לא משאירה עקבות בתור. **L2:** checkpoint תמיד PASSIVE קודם; TRUNCATE רק אם הגיע לסוף ה־WAL וברגע
  שקט (גם כשהתור כבוי). **L3:** שגיאה מתוך `unlocked()` לא מוחלפת ב־500 של re-lock עסוק; תמונה של אתר שנמחק בינתיים
  נמחקת. **L5/L6:** בדיקת העומס מדווחת על מצב התור ומריצה גם מסלול דו־שלבי ומסלול קריאת התקן; השומר מזהה חיבור דרך
  מאפיין (`act.conn`), תור שמוחזק מחוץ לטרנזקציה, ועוד נקודות כניסה (socket, urllib, websockets, asyncio subprocess).
- **פריסה:** אפשרות add-on חדשה `db_write_gate` (ברירת מחדל פעילה); `SW_DB_WRITE_GATE=0` עדיין גובר.
