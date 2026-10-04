# Changelog — SmplWise Arx add-on

## Unreleased — Settings › Multimedia: the lists of screens and of speakers / players are compact and filterable
No migration (the registry platform was already stored on every endpoint; the list now reads it). No restart of the platform is needed.
- **Compact rows:** each screen / speaker / player is one dense row (name, type, integration, entity id and device id with a copy key, room, status, approval, connections count); the full form opens under the row on demand. Every field, action, permission and the "approve all" buttons are unchanged.
- **Integration and ids (settings only):** the registry platform of each component (the vendor's first, "+n" for others) and the platform's entity id and device id. API: `GET multimedia/admin/devices` adds `integrations`, `ha_device_id` and `available` to every device (`available` was players-only before).
- **Filters:** free text (also matches ids and integration names), integration (multi-select), room, type, approval, availability, with a count of shown devices and "נקה סינון".
- **Sort and group:** by name, type, integration, room, id or status, either direction (also from the column headers); group by integration, room or type with collapsible headers and counts.
- **Comfort:** sticky header, copy-id, an open form stays open while filtering, the last view (not the free text) is remembered per section and per user in the browser, cards on a phone, keyboard operable, RTL, four skins.

## 0.1.160 (pilot) — Electricity meters and consumption bills (תשתיות › מוני חשמל); music queue actions; the schedules screen in the automations design
No restart of the platform is needed (the bridge integration stays 0.6.0). **Two database migrations run on start: `0053_electricity_meters`** (the meter registry and the counter lives) **and `0054_electricity_billing`** (customers, accounts, prices and VAT, bills, the ledger of bill numbers). The meter readings live in a separate file, `energy.db`, next to the main database. Reload the installed web app once.
### Electricity meters and bills (CR-023) - a new area "תשתיות" with the sub-tab "מוני חשמל"
- **Meters:** register energy sensors of the infrastructure (kWh / Wh / MWh) as meters; power sensors (W / kW) and other non-counters are refused with the reason. One reading a minute when the value changes; the counter rules handle resets, spikes, noise, a replaced meter (two counter lives) and a unit change (the meter pauses). Overview with tiles, the floors/areas tree, table and cards, a meter card with its chart and lives; pause, resume, retire (refused while an account uses the meter).
- **Accounts:** an account combines meters with a free formula and a friendly editor (sum, main minus sub-meters and percentage shares are presets); a customer card per account; monthly or two-monthly periods from any day; a fixed price per kWh entered before or including VAT, with versions; VAT rates with effective dates (a change inside a period splits it).
- **Bills ("חיוב"):** consumption bill and payment demand, not a tax invoice. Numbering year-month-customer (`2026-12-0001`, "/2" for a second bill in the month, "-2" for a correction); draft, issue, sent, paid, correct, cancel (any holder of `energy.bills`); consumption crossing a period edge is allocated by time; a meter that has not reported is billed up to its last report with a note; automatic draft at the end of each period (optionally automatic issue). The bill shows previous periods and the same period last year whenever data exists (never invented).
- **Bill PDF:** A4 Hebrew bill (WeasyPrint with the Heebo font; the simple fpdf2 engine as the automatic fallback, also when a render takes longer than 5 seconds). Every bill shows its PDF state (stored / ready / failed / unavailable) with "הפקת PDF מחדש"; the active PDF engine is logged at start-up and shown in the billing settings.
- **Account history:** consumption per billing period also for periods without a bill (computed from the readings with the account formula) and the same period last year, on the account page.
- **Permissions:** `energy.view` (meters and consumption, no money; operator and up), `energy.manage` (meters, accounts, customers, prices, business details) and `energy.bills` (money, customers' contact fields, every bill action; sensitive, never implied) - site and system administrators by default. Installation scope only.
- **Settings › תשתיות:** prices and VAT, business details with logo, numbering, payment terms (days or a fixed day of the month) and automatic-draft delay, data retention (raw 90 days, quarter-hour 26 months, bills and daily totals 7 years) with the storage estimate.
- **Backup:** the electricity tables, stored bill PDFs and logos, and the daily totals are in every backup; the full readings file only when "לכלול את נתוני המונים בגיבוי" is on (off by default). The ledger of bill numbers is never restored.
### Music queue actions (CR-016 17.10) - multimedia › players
- A tap on a queue row plays it; "העבר לראש התור"; "בחר" selects up to 25 rows and removes them after one question; "נקה תור" asks "נקה את הבאים - השיר הנוכחי ממשיך" or "נקה הכול - הניגון ייעצר". Same permission (`media.queue`), audit and safe degradation as the existing queue actions; one-by-one removals are rate-limited per installation.
### The schedules screen in the automations design
- קברניט › לוחות זמנים has the same layout as the automations and scenes screens (list, filters, phone layout); layout-guard findings fixed.
### Fixes and under the hood
- The phone dock of the bubble skin fits the sixth area at 320-359 px (the room-picker button steps aside; every target keeps 44 px).
- A restore writes back stored bill PDFs and logos (`energy/bills/`, `energy/assets/` join the restorable roots of 0.1.159's restore rule).
- Third-party notices (`THIRD_PARTY_NOTICES.md`): Heebo (SIL OFL 1.1), WeasyPrint, fpdf2, uharfbuzz and their dependencies. The add-on image adds the `pango` package and three Python packages for the PDF.
### How to turn it on and use it (English)
1. Install the update; the migrations run by themselves; reload the installed web app once.
2. Give people the permissions in הגדרות › גישה › תפקידים (site and system administrators already have all three).
3. תשתיות › מוני חשמל › מונים → "הוספת מונה": pick the energy sensors (the list shows why a sensor is refused).
4. הגדרות › תשתיות: enter the price per kWh (before or including VAT), the VAT rate, the business details and logo, the payment terms.
5. מוני חשמל › חשבונות → "חשבון חדש": choose meters and a formula, the customer, the price and the period; save. A draft appears automatically after each period (or create one from the account page); issue it, download the PDF, mark sent / paid.
6. Check once after installing: the add-on log line "bill pdf engine: ..." (or "מנוע PDF" in the billing settings answer) shows whether the full engine (WeasyPrint) or the simple one runs on this machine.
### Known limits
- **Not verified on the real add-on image:** the PDF stack on Alpine (amd64 and aarch64) was not built; that WeasyPrint/Pango load there, the image growth and the render time on the owner's ARM hardware are unmeasured. The automatic fallback to the simple engine covers a missing library or a render over 5 seconds, and the start-up log says which engine is active.
- **Not verified with real meters:** every reading in the tests is a fake; no real energy sensor or real customer was used. The music queue actions are built from the music server's documentation and are unverified against a real server.
- Not built in this release: manual meter readings / calibration, a "draft ready" notification, live bill state over the WebSocket (screens refresh), rate limits on recalculate and PDF, separate segments for a swapped meter, time-of-use prices. The PDF of an issued bill is made on first request (a failure shows on the bill).
- The PDF fonts are a Hebrew + Latin subset (names in other scripts show missing glyphs).

## עברית — 0.1.160: מוני חשמל וחיובי צריכה (תשתיות › מוני חשמל); פעולות בתור המוזיקה; מסך לוחות הזמנים בעיצוב האוטומציות
השחרור אינו מחייב הפעלה מחדש של תשתית המערכת (הגשר נשאר 0.6.0). **שתי מיגרציות רצות בעלייה: `0053_electricity_meters`** (רישום המונים וחיי המונה) **ו-`0054_electricity_billing`** (לקוחות, חשבונות, מחירים ומע״מ, חיובים, ופנקס מספרי החיובים). קריאות המונים נשמרות בקובץ נפרד, `energy.db`, ליד בסיס הנתונים הראשי. יש לטעון מחדש את אפליקציית הרשת המותקנת פעם אחת.
### מוני חשמל וחיובים - אזור חדש "תשתיות" עם לשונית "מוני חשמל"
- **מונים:** רושמים חיישני אנרגיה מתשתית המערכת (קוט״ש / ואט-שעה / מגה-ואט-שעה) כמונים; חיישני הספק (W / kW) וחיישנים שאינם מונים מצטברים נדחים עם הסיבה. קריאה אחת לדקה כשהערך משתנה; כללי המונה מטפלים באיפוס, בקפיצה חריגה, ברעש, בהחלפת מונה (שני חיי מונה) ובשינוי יחידה (המונה מושהה). מסך סקירה עם אריחים, עץ קומות ואזורים, טבלה וכרטיסים, וכרטיס מונה עם גרף וחיי המונה; השהיה, חידוש והוצאה משימוש (נדחית כל עוד חשבון משתמש במונה).
- **חשבונות:** חשבון מצרף מונים בנוסחה חופשית עם עורך נוח (סכום, ראשי פחות משנה ואחוז הם תבניות מוכנות); כרטיס לקוח לכל חשבון; תקופות חודשיות או דו-חודשיות מכל יום בחודש; מחיר קבוע לקוט״ש שמוזן לפני מע״מ או כולל מע״מ, עם גרסאות; שיעורי מע״מ עם תאריך תחולה (שינוי באמצע תקופה מפצל אותה).
- **חיובים:** חיוב צריכה ודרישת תשלום, לא חשבונית מס. מספור שנה-חודש-מספר לקוח (`2026-12-0001`, "/2" לחיוב שני באותו חודש, "-2" לתיקון); טיוטה, הפקה, נשלח, שולם, תיקון וביטול (כל מחזיק `energy.bills`); צריכה שחוצה את גבול התקופה מחולקת לפי זמן; מונה שלא דיווח מחויב עד הדיווח האחרון שלו, עם הערה; טיוטה אוטומטית בסוף כל תקופה (ואפשרות להפקה אוטומטית). החיוב מציג תקופות קודמות ואת אותה תקופה אשתקד, כשיש נתונים (לעולם לא ממציא).
- **PDF של החיוב:** חיוב A4 בעברית (WeasyPrint עם הגופן Heebo; המנוע הפשוט fpdf2 כגיבוי אוטומטי, גם כשהפקה נמשכת יותר מ-5 שניות). כל חיוב מציג את מצב ה-PDF (נשמר / מוכן / נכשל / לא זמין) עם "הפקת PDF מחדש"; מנוע ה-PDF הפעיל נרשם בלוג בעלייה ומוצג בהגדרות החיוב.
- **היסטוריית חשבון:** צריכה לכל תקופת חיוב גם לתקופות שאין להן חיוב (מחושבת מהקריאות לפי נוסחת החשבון) ואותה תקופה אשתקד, בדף החשבון.
- **הרשאות:** `energy.view` (מונים וצריכה, בלי כסף; ממפעיל ומעלה), `energy.manage` (מונים, חשבונות, לקוחות, מחירים ופרטי העסק) ו-`energy.bills` (סכומים, פרטי קשר של לקוחות וכל פעולה על חיוב; רגישה, לעולם לא משתמעת) - כברירת מחדל למנהל אתר ולמנהל מערכת. בהיקף ההתקנה בלבד.
- **הגדרות › תשתיות:** מחירים ומע״מ, פרטי העסק עם לוגו, מספור, תנאי תשלום (ימים או יום קבוע בחודש) והשהיית הטיוטה האוטומטית, שמירת נתונים (גולמי 90 יום, רבע שעה 26 חודשים, חיובים וסיכומים יומיים 7 שנים) עם הערכת נפח.
- **גיבוי:** טבלאות החשמל, קובצי ה-PDF השמורים, הלוגו והסיכומים היומיים נכנסים לכל גיבוי; קובץ הקריאות המלא רק כש"לכלול את נתוני המונים בגיבוי" מסומן (כבוי כברירת מחדל). פנקס מספרי החיובים לעולם אינו משוחזר.
### פעולות בתור המוזיקה - מולטימדיה › נגנים
- לחיצה על שורה בתור מנגנת אותה; "העבר לראש התור"; "בחר" מסמן עד 25 שורות ומוחק אותן אחרי שאלה אחת; "נקה תור" שואל "נקה את הבאים - השיר הנוכחי ממשיך" או "נקה הכול - הניגון ייעצר". אותה הרשאה (`media.queue`), אותו יומן ביקורת ואותה התנהגות בטוחה כמו פעולות התור הקיימות; מחיקות אחת-אחת מוגבלות בקצב לכל התקנה.
### מסך לוחות הזמנים בעיצוב האוטומציות
- קברניט › לוחות זמנים מעוצב כמו מסכי האוטומציות והסצנות (רשימה, מסננים, פריסה לטלפון); ממצאי בודק הפריסה תוקנו.
### תיקונים
- סרגל הניווט התחתון בטלפון (סקין בועה) מכיל את האזור השישי ברוחב 320-359 פיקסלים (כפתור בחירת החדר מפנה מקום; כל יעד נשאר 44 פיקסלים).
- שחזור כותב בחזרה את קובצי ה-PDF השמורים ואת הלוגו.
- קובץ הודעות צד שלישי (`THIRD_PARTY_NOTICES.md`): Heebo (רישיון SIL OFL 1.1), WeasyPrint, fpdf2, uharfbuzz והתלויות שלהם. תמונת התוסף מוסיפה את החבילה `pango` ושלוש חבילות Python עבור ה-PDF.
- **איך מפעילים:** מתקינים את העדכון; המיגרציות רצות לבד; טוענים מחדש את אפליקציית הרשת פעם אחת. נותנים הרשאות בהגדרות › גישה › תפקידים (למנהל אתר ולמנהל מערכת יש כבר את שלושתן). תשתיות › מוני חשמל › מונים ← "הוספת מונה": בוחרים את חיישני האנרגיה (הרשימה מסבירה למה חיישן נדחה). הגדרות › תשתיות: מחיר לקוט״ש (לפני או כולל מע״מ), שיעור המע״מ, פרטי העסק והלוגו, תנאי התשלום. מוני חשמל › חשבונות ← "חשבון חדש": בוחרים מונים ונוסחה, לקוח, מחיר ותקופה, ושומרים. טיוטה נוצרת אוטומטית אחרי כל תקופה (או יוצרים מדף החשבון); מפיקים, מורידים PDF, מסמנים נשלח / שולם. בדיקה חד-פעמית אחרי ההתקנה: שורת הלוג "bill pdf engine: ..." מראה אם רץ המנוע המלא (WeasyPrint) או הפשוט.
- **מגבלות:** **לא נבדק על תמונת התוסף האמיתית:** ערימת ה-PDF על Alpine (amd64 ו-aarch64) לא נבנתה; טעינת WeasyPrint/Pango שם, גידול התמונה וזמן ההפקה על חומרת ה-ARM של הבעלים לא נמדדו. המעבר האוטומטי למנוע הפשוט מכסה ספרייה חסרה או הפקה ארוכה מ-5 שניות, ולוג העלייה אומר איזה מנוע פעיל. **לא נבדק עם מונים אמיתיים:** כל הקריאות בבדיקות מדומות; לא נעשה שימוש בחיישן אנרגיה אמיתי או בלקוח אמיתי. פעולות התור נבנו לפי התיעוד של שרת המוזיקה ולא נבדקו מול שרת אמיתי. לא נבנו בשחרור הזה: קריאת מונה ידנית / כיול, התראת "טיוטת חיוב מוכנה", מצב חיוב חי (המסכים מתרעננים), הגבלת קצב לחישוב מחדש ול-PDF, הצגה נפרדת של מקטעי מונה שהוחלף, ותעריפי זמן. ה-PDF של חיוב שהופק נוצר בבקשה הראשונה (כישלון מוצג על החיוב). גופני ה-PDF הם תת-קבוצה של עברית ולטינית (שמות בכתבים אחרים יוצגו כתווים חסרים).

## 0.1.159 (pilot) — Updates and restarts from inside Arx; the NVR connection moves into Arx settings; SVC off on many cameras at once
**One-time manual step: this release must be installed by hand once** (the platform's add-on page → Check for updates → Update, with "Create backup before updating" ticked). It is the first release whose manifest asks the infrastructure for the `manager` role (`hassio_role: manager`), and a running add-on cannot raise its own role; the add-on page shows a lower security rating afterwards (expected; DOCS "What Arx may do on your system" lists the only calls Arx sends). From the next release on, updates can run from inside Arx. No restart of the platform is needed for this release itself (the bridge integration stays 0.6.0). **Two database migrations run on start: `0051_self_update`** (the update-run table) **and `0052_recorder_connections`** (the NVR connection stored in Arx, its password encrypted under a key file in `/data/keys/`). On the first start, an NVR connection present in the add-on options is imported once into Arx; the options are never changed (a downgrade keeps working). Reload the installed web app once.
### Updates and restarts from inside Arx (CR-021) - הגדרות › מערכת › עדכונים
- A system administrator (new permission **`system.update`**, built-in system administrator only) sees when a newer Arx version is in the store ("בדוק אם יש עדכון" and a check interval), installs it with **one confirmation** (backup before the update on by default) and follows the run on a status screen that survives Arx's own restart: backing up, updating, restarting, verifying, then succeeded or failed. One update per 10 minutes; a second click with the same request returns the same run.
- **The "הפעלות מחדש" card** has two buttons: restart Arx, and restart the platform. The platform restart runs the platform's configuration check first and restarts only when the check passes; Arx then waits for the platform and the bridge to come back. A "restart required" row in Settings and a dot on the user menu tell system administrators when a component needs a platform restart.
- Safety: every call to the infrastructure goes through one allow-list (a test fails the build if another call appears); an answer that never arrives is an unknown outcome that is never resent and is settled from what the next start sees (running version, job state, a health check with one retry); three starts of a new version without a healthy check end the run as a restart loop; an update is refused while a guarded NVR write is still pending. Child processes never inherit the infrastructure token or other secrets. Requests must come from the same origin and carry the literal confirmation; every refusal is audited.
### The NVR connection inside Arx (CR-022) - הגדרות › חיבורים and the setup wizard's NVR step
- Choose the NVR type (Hikvision, or "ללא NVR"; Provision-ISR and Frigate are listed as coming soon), enter address, ports, user and password, **test** (read-only: one line with the model and channel count, or a short reason), **save**, and press **"הפעל מחדש"** on the banner to apply. Saving never restarts by itself; the banner stays until the restart, for every system administrator.
- The password is write-only on every screen and answer, encrypted at rest (AES-256-GCM, separate key file), never in an Arx backup, a log or the audit; a backup restored onto another installation asks for the connection again. A save after a failed test needs the typed word "שמור"; "הסר NVR" needs the typed word "הסר" and leaves the cameras disabled. Changing the NVR type of an installation with cameras needs "הסר NVR" first.
- The connection and restart routes are refused over the remote channel; the Arx restart is limited to one per two minutes (the guard survives the restart) and **is refused while an update run is active** (409 `update_running`); outside the platform the screen says to restart the service by hand.
- The NVR-less installation is now an explicit choice in the wizard; the "no NVR" panel points at הגדרות › חיבורים (system administrators only) instead of the add-on options.
### Multi-camera change: SVC off on many cameras at once (CR-020 S2C) - מערכת › אבטחה › מצלמות
- After switching SVC off on one main stream, a holder of `nvr.configure` can choose **"החל גם על מצלמות נוספות"**: a searchable checklist of the recorder's H.264 main streams, **one confirmation**, live progress, **stop**, a result list and **undo all** (a new reversed batch, one confirmation).
- The server runs the batch one camera at a time, each camera with the same guarded two-phase write as a single change; it stops at the first failure; an unknown outcome is checked once from a device read after 45 s and the batch continues only when the read proves the change applied. Single writes on the same recorder are refused while a batch runs; a batch is never resumed after a restart. No limit on the number of cameras; progress is paged.
### Fixes and under the hood
- Security review fixes of the multi-camera batch: an unknown outcome counts as applied only when every other encoding field is unchanged; undo restores only the changed fields from a fresh reading; a hard deadline per camera; status and list are read-only; batch runtime state never enters a backup; the permission is re-checked before each camera.
- Security review fixes of the update and restart backend (secrets in child processes, an Arx restart in the middle of an update, early restart-loop counting, the confirmed backup, the same-origin fallback, the update target bound to this add-on, the options content check).
- Three security reviews of the NVR connection (restore writes only the plan files the archive's own rows name; the restart guard is persisted; the revision is required on every save and remove; and more - CR-022 sections 20-22).
- The release gate fails on a test process that crashed at load, ran zero tests or lost more than 30 percent of its passing tests.
### How to turn it on and use it (English)
1. Install this release by hand once from the platform's add-on page (Check for updates → Update, backup ticked). The migrations run by themselves; reload the installed web app once.
2. Updates: sign in as a system administrator, open הגדרות › מערכת › עדכונים, press "בדוק אם יש עדכון". The "אין הרשאה" state must be gone; from the next release on, press "עדכן", confirm, and follow the status screen.
3. Restarts: the "הפעלות מחדש" card on the same page - restart Arx, or restart the platform (configuration check first).
4. NVR connection: הגדרות › חיבורים (or the wizard's NVR step) - check that the imported connection is shown, use "בדוק חיבור", and after any change "שמור" and then "הפעל מחדש" on the banner.
5. Multi-camera SVC off: מערכת › אבטחה › מצלמות, switch SVC off on one main stream, then "החל גם על מצלמות נוספות", pick the cameras, confirm; "עצור" stops after the current camera, "בטל את מה שנשמר" undoes the batch.
### Known limits
- Tested against fakes only: a fake infrastructure (Supervisor) for updates and restarts, a fake NVR for the connection test and the multi-camera change. The first real in-app update, the first real platform restart and Arx restart, and the one-time manual install that grants the `manager` role are lab sessions with the owner (CR-021 section 13.5 checklist). No real write to cameras has been made.
- The allow-list still accepts writing this add-on's options, although no screen uses it since the NVR connection moved into Arx.
- Rollback after a failed update is guidance only (the platform's "before update" backup, or the previous version plus Arx's "לפני עדכון" backup); there is no restore or downgrade button.
- The multi-camera change covers SVC off on H.264 main streams only. An index on the batch id was not added (it would need a migration; open item).

## עברית — 0.1.159: עדכונים והפעלות מחדש מתוך Arx; חיבור ה-NVR עובר להגדרות Arx; כיבוי SVC בכמה מצלמות בבת אחת
**צעד ידני חד-פעמי: את השחרור הזה יש להתקין ידנית פעם אחת** (בדף התוסף בתשתית המערכת: בדיקת עדכונים ← עדכון, עם סימון "גיבוי לפני עדכון"). זה השחרור הראשון שהמניפסט שלו מבקש מתשתית המערכת את תפקיד `manager` (`hassio_role: manager`), ותוסף שרץ אינו יכול להעלות לעצמו את התפקיד; אחרי ההתקנה דף התוסף מציג דירוג אבטחה נמוך יותר (צפוי; ב-DOCS, בפרק "What Arx may do on your system", מפורטות הקריאות היחידות ש-Arx שולח). מהשחרור הבא והלאה אפשר לעדכן מתוך Arx. השחרור הזה עצמו אינו מחייב הפעלה מחדש של התשתית (הגשר נשאר 0.6.0). **שתי מיגרציות רצות בעלייה: `0051_self_update`** (טבלת ריצות העדכון) **ו-`0052_recorder_connections`** (חיבור ה-NVR נשמר ב-Arx, והסיסמה מוצפנת במפתח שנשמר בקובץ נפרד תחת `/data/keys/`). בעלייה הראשונה, חיבור NVR שקיים בהגדרות התוסף מיובא פעם אחת ל-Arx; הגדרות התוסף עצמן אינן משתנות (חזרה לגרסה קודמת ממשיכה לעבוד). יש לטעון מחדש את אפליקציית הרשת המותקנת פעם אחת.
### עדכונים והפעלות מחדש מתוך Arx - הגדרות › מערכת › עדכונים
- מנהל מערכת (הרשאה חדשה **`system.update`**, למנהל המערכת המובנה בלבד) רואה כשיש בחנות גרסה חדשה יותר ("בדוק אם יש עדכון" ותדירות בדיקה), מתקין אותה ב**אישור אחד** (גיבוי לפני העדכון מסומן כברירת מחדל) ועוקב אחרי הריצה במסך מצב ששורד את ההפעלה מחדש של Arx עצמו: גיבוי, עדכון, הפעלה מחדש, אימות, ואז הצליח או נכשל. עדכון אחד לכל 10 דקות; לחיצה חוזרת עם אותה בקשה מחזירה את אותה ריצה.
- **כרטיס "הפעלות מחדש"** עם שני כפתורים: הפעלה מחדש של Arx, והפעלה מחדש של תשתית המערכת. הפעלת התשתית מחדש מריצה קודם את בדיקת התצורה של התשתית, וממשיכה רק אם הבדיקה עברה; אחר כך Arx ממתין שהתשתית והגשר יחזרו. שורת "נדרשת הפעלה מחדש" בהגדרות ונקודה בתפריט המשתמש מודיעות למנהלי המערכת כשרכיב צריך הפעלה מחדש של התשתית.
- בטיחות: כל קריאה לתשתית עוברת ברשימת היתרים אחת (בדיקה מכשילה את הבנייה אם מופיעה קריאה אחרת); תשובה שלא הגיעה היא תוצאה לא ידועה - לא נשלחת שוב, ומוכרעת לפי מה שהעלייה הבאה רואה (הגרסה שרצה, מצב המשימה, בדיקת תקינות עם ניסיון חוזר אחד); שלוש עליות של גרסה חדשה בלי בדיקת תקינות מוצלחת מסיימות את הריצה כלולאת הפעלה מחדש; עדכון נדחה כל עוד כתיבה מוגנת ל-NVR עדיין ממתינה. תהליכי משנה אינם יורשים את אסימון התשתית או סודות אחרים. בקשות חייבות להגיע מאותו מקור ולשאת אישור מפורש; כל דחייה נרשמת ביומן הביקורת.
### חיבור ה-NVR בתוך Arx - הגדרות › חיבורים, ושלב ה-NVR באשף ההתקנה
- בוחרים את סוג ה-NVR (Hikvision, או "ללא NVR"; Provision-ISR ו-Frigate מופיעים כ"בקרוב"), מזינים כתובת, יציאות, משתמש וסיסמה, **בודקים** (קריאה בלבד: שורה אחת עם הדגם ומספר הערוצים, או סיבה קצרה), **שומרים**, ולוחצים **"הפעל מחדש"** בפס ההודעה כדי להחיל. שמירה לעולם אינה מפעילה מחדש לבד; הפס נשאר עד ההפעלה מחדש, אצל כל מנהלי המערכת.
- הסיסמה לכתיבה בלבד בכל מסך ותשובה, מוצפנת באחסון (AES-256-GCM, קובץ מפתח נפרד), ולעולם לא נכנסת לגיבוי של Arx, ללוג או ליומן הביקורת; גיבוי ששוחזר בהתקנה אחרת יבקש את החיבור מחדש. שמירה אחרי בדיקה שנכשלה מחייבת להקליד "שמור"; "הסר NVR" מחייב להקליד "הסר" ומשאיר את המצלמות מושבתות. החלפת סוג ה-NVR בהתקנה עם מצלמות מחייבת קודם "הסר NVR".
- נתיבי החיבור וההפעלה מחדש חסומים בערוץ הגישה מרחוק; הפעלה מחדש של Arx מוגבלת לאחת לשתי דקות (המגבלה שורדת את ההפעלה מחדש) **ונדחית כל עוד מתבצעת ריצת עדכון** (409 `update_running`); מחוץ לתשתית המסך אומר להפעיל את השירות מחדש ידנית.
- התקנה ללא NVR היא עכשיו בחירה מפורשת באשף; חלונית "אין NVR" מפנה להגדרות › חיבורים (למנהלי מערכת בלבד) במקום להגדרות התוסף.
### שינוי מרובה: כיבוי SVC בכמה מצלמות בבת אחת - מערכת › אבטחה › מצלמות
- אחרי כיבוי SVC בזרם ראשי אחד, מחזיק `nvr.configure` יכול לבחור **"החל גם על מצלמות נוספות"**: רשימת סימון עם חיפוש של הזרמים הראשיים בקידוד H.264 במקליט, **אישור אחד**, התקדמות חיה, **עצור**, רשימת תוצאות ו**ביטול הכול** (סבב הפוך חדש, אישור אחד).
- השרת מריץ את הסבב מצלמה אחר מצלמה, כל אחת באותה כתיבה מוגנת דו-שלבית של שינוי בודד; הוא נעצר בכישלון הראשון; תוצאה לא ידועה נבדקת פעם אחת מקריאה מההתקן אחרי 45 שניות, והסבב ממשיך רק אם הקריאה מוכיחה שהשינוי חל. כתיבות בודדות לאותו מקליט נדחות כל עוד סבב רץ; סבב לעולם אינו מתחדש אחרי הפעלה מחדש. אין מגבלה על מספר המצלמות; ההתקדמות מוצגת בעמודים.
### תיקונים
- תיקוני סקירת האבטחה של השינוי המרובה: תוצאה לא ידועה נחשבת כמבוצעת רק אם כל שאר שדות הקידוד לא השתנו; הביטול מחזיר רק את השדות ששונו, מקריאה עדכנית; מגבלת זמן קשיחה לכל מצלמה; המצב והרשימה לקריאה בלבד; מצב הריצה של סבב לעולם אינו נכנס לגיבוי; ההרשאה נבדקת שוב לפני כל מצלמה.
- תיקוני סקירת האבטחה של העדכון וההפעלה מחדש (סודות בתהליכי משנה, הפעלה מחדש של Arx באמצע עדכון, ספירה מוקדמת של לולאת הפעלה מחדש, גיבוי מאושר, בדיקת המקור, יעד העדכון קשור לתוסף הזה, בדיקת תוכן ההגדרות).
- שלוש סקירות אבטחה של חיבור ה-NVR (שחזור כותב רק את קובצי התוכניות ששורות הארכיון עצמו מציינות; מגבלת ההפעלה מחדש נשמרת; מספר גרסה נדרש בכל שמירה והסרה; ועוד).
- שער השחרור נכשל כשתהליך בדיקות קרס בטעינה, הריץ אפס בדיקות או איבד יותר מ-30 אחוז מהבדיקות העוברות.
- **איך מפעילים:** מתקינים את השחרור הזה ידנית פעם אחת מדף התוסף בתשתית המערכת (בדיקת עדכונים ← עדכון, עם גיבוי); המיגרציות רצות לבד; טוענים מחדש את אפליקציית הרשת פעם אחת. עדכונים: נכנסים כמנהל מערכת, הגדרות › מערכת › עדכונים, "בדוק אם יש עדכון" - מצב "אין הרשאה" צריך להיעלם; מהשחרור הבא: "עדכן", אישור, ומעקב במסך המצב. הפעלות מחדש: כרטיס "הפעלות מחדש" באותו דף. חיבור NVR: הגדרות › חיבורים (או שלב ה-NVR באשף) - לוודא שהחיבור המיובא מוצג, "בדוק חיבור", ואחרי כל שינוי "שמור" ואז "הפעל מחדש" בפס. כיבוי SVC במרובה: מערכת › אבטחה › מצלמות, מכבים SVC בזרם ראשי אחד, "החל גם על מצלמות נוספות", בוחרים מצלמות ומאשרים; "עצור" עוצר אחרי המצלמה הנוכחית, "בטל את מה שנשמר" מבטל את הסבב.
- **מגבלות:** נבדק מול מערכות מדומות בלבד: תשתית מדומה לעדכונים ולהפעלות מחדש, NVR מדומה לבדיקת החיבור ולשינוי המרובה. העדכון האמיתי הראשון מתוך Arx, ההפעלה מחדש האמיתית הראשונה של התשתית ושל Arx, וההתקנה הידנית החד-פעמית שמעניקה ל-Arx את תפקיד `manager` - כולם מפגשי מעבדה עם הבעלים. לא בוצעה שום כתיבה אמיתית למצלמות. רשימת ההיתרים עדיין מתירה כתיבת הגדרות התוסף, אף שאף מסך אינו משתמש בזה מאז שחיבור ה-NVR עבר ל-Arx. חזרה אחרי עדכון שנכשל היא הנחיה בלבד (גיבוי "לפני עדכון" של התשתית, או הגרסה הקודמת + גיבוי "לפני עדכון" של Arx); אין כפתור שחזור או שנמוך. השינוי המרובה מכסה רק כיבוי SVC בזרמים ראשיים H.264.

## 0.1.158 (pilot) — Camera stream editing (SVC switch) from Arx; material, depth and state-tint dials; the installation capability model
**After the update no restart of the platform is needed** (the bridge integration stays 0.6.0). **One database migration, `0050_nvr_stream_changes`**, runs on start: the NVR change log gains per-stream columns, and custom roles lose the removed `nvr.config.stream` permission (one audit row per stripped role). The new look dials are stored inside the existing `ui.look` value and the new `ui.dd_phone` setting is created on first save (no migration; an absent value reads the defaults). Reload the installed web app once.
### Camera streams: switch SVC and edit the encoding of one stream (CR-020 S2) - מערכת › אבטחה › מצלמות
- A holder of the new system permission **`nvr.configure`** (built-in system administrator only; it can never be put in a custom role) sees, per stream on the cameras table, an **SVC switch** and a **pencil** that opens an editor drawer for the stream's encoding (codec, resolution, FPS, bitrate, GOP and the other fields the recorder offers). Everyone else keeps the read-only table.
- Every write asks for **one confirmation**, is checked against the recorder's own capability options and an etag of the stream's current state, and is recorded before and after the device call; after it succeeds an **undo toast** offers to put the previous values back (the same guards apply). An unknown outcome (timeout, device error) stays pending and is settled from a device read, never retried blindly.
- A stream whose capability document cannot be read is **not writable**, with the reason on the row; nothing is sent. Below 900 px the table turns into cards for holders of `nvr.configure`.
- The old `nvr.config.stream` permission is removed (owner decision 2026-10-03); its stream rights live in `nvr.configure`.
### Material, depth and state tint - הגדרות › כללי › מראה (MD1 phase 2)
- Three new dials on the look card for the **Bubble** and **Domus** looks: **material** (Frosted / Paper / Neon), **depth** (0-2) and **state tint** (0-2). Tiles, cards, KPI tiles, home area tiles and rows, the tree, rail, dock and security strip take a sheen, a 1 px glass rim, a lift and, when something is on, a wash of its state colour; lists show the tone as a 6 px side stripe only.
- **Off by default**: with material none, depth 0 and tint 0 nothing changes on screen. Choosing a preset also turns depth and tint on (if they were off) and sets its suggested transparency; the dials stay free afterwards. Installation default and personal override, like every look dial.
- Text stays readable: the wash is capped per look, palette and scheme so text keeps 4.5:1; the Neon glow never surrounds a state colour (alarm, open door, offline) and never appears in a list; no new blur. Classic and Tesla are unchanged.
### The installation capability model (NN1 P0-P2)
- The server now derives what this installation can do (NVR, go2rtc, the home infrastructure, live video, playback, events, infrastructure cameras) and reports it on `/me`, `/health` and the setup wizard. An NVR without go2rtc is reported as an **unsupported installation** with an operator-worded explanation in the wizard and in health; the wizard is not "ready" until the installation is supported.
- Media and playback routes that need a missing capability answer **409 `capability_unavailable`** after the permission check (they answered 503 `media_not_configured` before).
- **The screens follow the installation.** Without an NVR, the live overview, all cameras, saved views, the kiosk wall, the camera page, events, reviews, rules, search, cases, exports, playback, the historical map, camera health and camera settings are not offered in the navigation (rail, tab rows, phone bar, start screen); a section with no page left disappears and the security area opens on its first remaining page. Opening such a page directly shows a short explanation panel instead of a broken screen. With an NVR but **no go2rtc**, the live and playback screens explain that a media server is needed; the wizard says the installation is **not supported** and is never "ready"; the health tab shows the same notice. The camera picker and camera card, the plan editor's camera tool, the live player, the intercom station stills and the notification matrix follow the same rules. Without a backend (demo) everything stays on.
### Dropdown menus on the phone: bottom sheet or the regular list - הגדרות › לשוניות › "תפריט נפתח בטלפון"
- A new choice for phone widths (up to 767 px): **bottom sheet** (the default) or the **regular small list** under the field; installation default (`ui.dd_phone`, `system.configure`) and a personal choice (follow the installation by default). Tablet and desktop are unchanged.
- The sheet slides up, closes with a swipe down on its handle (or Esc, or the backdrop) and slides out; the page behind it is blurred 3 px (not in the lite performance tier or under reduced transparency) and cannot be reached while it is open (Tab stays between the search field and the list); it rises above the on-screen keyboard. Reduced motion opens and closes at once.
### Fixes and under the hood
- Security review fixes of the stream write (M1, M2, L1-L6): stream change records are visible only to `nvr.configure` holders whose camera scope holds the camera; an unknown device outcome is settled no sooner than 45 s later; the stream PUT has a read timeout; capability reads are cached (10 min positive, 60 s negative); an unauthorised caller gets 403 before any device call; a project + access restore drops unknown and system permissions from custom roles.
- The per-camera capability tests (T045) kept their file; the installation capability tests live in their own file.
### How to turn it on and use it (English)
1. No restart is needed; reload the installed web app once. The migration runs by itself.
2. Stream editing: sign in as a system administrator (only that role has `nvr.configure`), open מערכת › אבטחה › מצלמות, use the SVC switch or the pencil on a stream, confirm, and use the undo toast if needed. Turn SVC off on main streams that should play over WebRTC.
3. Material dials: הגדרות › כללי › מראה, pick the Bubble or Domus look, then a material preset (Frosted / Paper / Neon) or set depth and state tint by hand; for the whole installation or just for yourself. To try without saving: `?look=material:frosted,depth:1,tint:1`.
4. Dropdown on the phone: הגדרות › לשוניות › "תפריט נפתח בטלפון": bottom sheet (default) or the regular list, for the installation or just for yourself.
5. Installation capabilities: nothing to enable; the navigation, the wizard and the health page follow the installation by themselves. An installation with an NVR but no go2rtc must add go2rtc to be supported.
### Known limits
- Stream editing writes one stream at a time; multi-camera apply is a later slice. It was tested against the fake NVR only; the first real recorder write is done by the lead with the owner's approval.
- The material layer applies to the Bubble and Domus looks only. The NVR connection screens inside Arx settings, multi-camera apply and the update screens are not in this release; the "no NVR" panel keeps its earlier wording until the NVR connection moves into Arx settings.

## עברית — 0.1.158: עריכת זרמי מצלמה (מתג SVC) מתוך Arx; חוגות חומר, עומק וגוון מצב; מודל יכולות ההתקנה
**אחרי העדכון אין צורך להפעיל מחדש את התשתית** (הגשר נשאר 0.6.0). **מיגרציה אחת, `0050_nvr_stream_changes`**, רצה בעלייה: יומן השינויים של ה-NVR מקבל עמודות לכל זרם, ותפקידים מותאמים מאבדים את ההרשאה שהוסרה `nvr.config.stream` (שורת ביקורת אחת לכל תפקיד). חוגות המראה החדשות נשמרות בתוך הערך הקיים `ui.look`, וההגדרה החדשה `ui.dd_phone` נוצרת בשמירה הראשונה (בלי מיגרציה; ערך חסר נקרא כברירת המחדל). יש לטעון מחדש את אפליקציית הרשת המותקנת פעם אחת.
### זרמי מצלמה: מתג SVC ועריכת הקידוד של זרם אחד (CR-020 S2) - מערכת › אבטחה › מצלמות
- מי שמחזיק בהרשאת המערכת החדשה **`nvr.configure`** (מנהל המערכת המובנה בלבד; אי אפשר לשים אותה בתפקיד מותאם) רואה בטבלת המצלמות, לכל זרם, **מתג SVC** ו**עיפרון** שפותח מגירת עריכה לקידוד הזרם (קודק, רזולוציה, FPS, קצב, GOP ושאר השדות שהמקליט מציע). כל השאר ממשיכים לראות טבלה לקריאה בלבד.
- כל כתיבה מבקשת **אישור אחד**, נבדקת מול אפשרויות היכולת של המקליט עצמו ומול חותמת המצב הנוכחי של הזרם, ונרשמת לפני הקריאה להתקן ואחריה; אחרי הצלחה **הודעת "בטל"** מאפשרת להחזיר את הערכים הקודמים (באותן הגנות). תוצאה לא ידועה (פסק זמן, שגיאת התקן) נשארת ממתינה ומוכרעת מקריאה מההתקן, בלי ניסיון חוזר עיוור.
- זרם שאי אפשר לקרוא את מסמך היכולות שלו **אינו ניתן לעריכה**, והסיבה מוצגת בשורה; שום דבר לא נשלח. מתחת ל-900 פיקסלים הטבלה הופכת לכרטיסים עבור מחזיקי `nvr.configure`.
- ההרשאה הישנה `nvr.config.stream` הוסרה (החלטת הבעלים 2026-10-03); זכויות הזרם עברו ל-`nvr.configure`.
### חומר, עומק וגוון מצב - הגדרות › כללי › מראה (MD1 שלב 2)
- שלוש חוגות חדשות בכרטיס המראה, למראות **בועה** ו**Domus**: **חומר** (Frosted / Paper / Neon), **עומק** (0-2) ו**גוון מצב** (0-2). אריחים, כרטיסים, אריחי מדדים, אריחי ושורות האזורים בבית, העץ, הסרגל, ה-dock ורצועת האבטחה מקבלים ברק, שפת זכוכית של פיקסל, הרמה, וכשמשהו דולק - שטיפה בצבע המצב שלו; ברשימות הגוון מופיע רק כפס צד של 6 פיקסלים.
- **כבוי כברירת מחדל**: עם חומר none, עומק 0 וגוון 0 שום דבר לא משתנה במסך. בחירת קדם-הגדרה מדליקה גם עומק וגוון (אם היו כבויים) וקובעת את האטימות המוצעת; אחר כך החוגות חופשיות. ברירת מחדל להתקנה ודריסה אישית, כמו כל חוגת מראה.
- הטקסט נשאר קריא: השטיפה מוגבלת לכל מראה, פלטה וסכמה כך שהטקסט שומר על 4.5:1; זוהר ה-Neon לעולם לא מקיף צבע מצב (אזעקה, דלת פתוחה, מנותק) ולעולם לא מופיע ברשימה; אין טשטוש חדש. Classic ו-Tesla ללא שינוי.
### מודל יכולות ההתקנה (NN1 שלבים P0-P2)
- השרת מחשב עכשיו מה ההתקנה הזו יודעת לעשות (NVR, go2rtc, תשתית המערכת, וידאו חי, הקלטות, אירועים, מצלמות התשתית) ומדווח על כך ב-`/me`, ב-`/health` ובאשף ההתקנה. NVR בלי go2rtc מדווח כ**התקנה שאינה נתמכת**, עם הסבר בשפת מפעיל באשף ובמסך התקינות; האשף אינו "מוכן" עד שההתקנה נתמכת.
- נתיבי מדיה והקלטות שחסרה להם יכולת עונים **409 `capability_unavailable`** אחרי בדיקת ההרשאה (קודם ענו 503 `media_not_configured`).
- **המסכים עוקבים אחרי ההתקנה.** בלי NVR, הסקירה החיה, כל המצלמות, התצוגות השמורות, קיר הקיוסק, דף המצלמה, האירועים, הסקירות, החוקים, החיפוש, התיקים, הייצוא, ההקלטות, המפה ההיסטורית, תקינות המצלמות והגדרות המצלמות אינם מוצעים בניווט (סרגל, שורות לשוניות, סרגל הטלפון, מסך הפתיחה); אזור שלא נשאר בו דף נעלם, ואזור האבטחה נפתח בדף הראשון שנשאר. פתיחה ישירה של דף כזה מציגה הסבר קצר במקום מסך שבור. עם NVR אבל **בלי go2rtc**, מסכי החי וההקלטות מסבירים שנדרש שרת מדיה; האשף אומר שההתקנה **אינה נתמכת** ולעולם אינו "מוכן"; מסך התקינות מציג את אותה הודעה. בורר המצלמות וכרטיס המצלמה, כלי המצלמה בעורך התוכנית, הנגן החי, תמונות עמדות האינטרקום ומטריצת ההתראות פועלים לפי אותם כללים. בלי שרת (הדגמה) הכול נשאר פעיל.
### תפריט נפתח בטלפון: גיליון תחתון או הרשימה הרגילה - הגדרות › לשוניות › "תפריט נפתח בטלפון"
- בחירה חדשה לרוחב טלפון (עד 767 פיקסלים): **גיליון תחתון** (ברירת המחדל) או **הרשימה הקטנה הרגילה** מתחת לשדה; ברירת מחדל להתקנה (`ui.dd_phone`, `system.configure`) ובחירה אישית (ברירת המחדל: לפי ההתקנה). טאבלט ומחשב ללא שינוי.
- הגיליון עולה מלמטה, נסגר בהחלקה למטה על הידית (או Esc, או לחיצה ברקע) ויורד החוצה; הדף שמאחוריו מטושטש ב-3 פיקסלים (לא בשכבת הביצועים הקלה ולא בהפחתת שקיפות) ואינו נגיש כל עוד הגיליון פתוח (Tab נשאר בין שדה החיפוש לרשימה); הגיליון עולה מעל המקלדת שעל המסך. בהפחתת תנועה הוא נפתח ונסגר מיד.
### תיקונים
- תיקוני סקירת האבטחה של כתיבת הזרם (M1, M2, L1-L6): רשומות שינוי זרם גלויות רק למחזיקי `nvr.configure` שהיקף המצלמות שלהם כולל את המצלמה; תוצאה לא ידועה מוכרעת לא לפני 45 שניות; לבקשת הכתיבה יש פסק זמן קריאה; קריאות היכולות נשמרות במטמון (10 דקות חיובי, 60 שניות שלילי); מבקש לא מורשה מקבל 403 לפני כל קריאה להתקן; שחזור פרויקט + הרשאות מסיר מתפקידים מותאמים הרשאות לא מוכרות והרשאות מערכת.
- בדיקות היכולות לכל מצלמה (T045) נשארו בקובץ שלהן; בדיקות יכולות ההתקנה בקובץ נפרד.
- **איך מפעילים:** אין צורך בהפעלה מחדש; המיגרציה רצה לבד. עריכת זרמים: נכנסים כמנהל מערכת (רק לו יש `nvr.configure`), מערכת › אבטחה › מצלמות, מתג SVC או עיפרון בזרם, מאשרים, ו"בטל" בהודעה אם צריך; מומלץ לכבות SVC בזרמים הראשיים שצריכים לנגן ב-WebRTC. חוגות החומר: הגדרות › כללי › מראה, בוחרים מראה בועה או Domus, ואז קדם-הגדרת חומר או עומק וגוון ידנית, לכל ההתקנה או לעצמי (לניסיון בלי שמירה: `?look=material:frosted,depth:1,tint:1`). תפריט נפתח בטלפון: הגדרות › לשוניות › "תפריט נפתח בטלפון" - גיליון תחתון (ברירת מחדל) או הרשימה הרגילה, להתקנה או לעצמי. יכולות ההתקנה: אין מה להפעיל; הניווט, האשף ומסך התקינות מתאימים את עצמם להתקנה, והתקנה עם NVR בלי go2rtc צריכה להוסיף go2rtc.
- **מגבלות:** עריכה של זרם אחד בכל פעם (החלה על כמה מצלמות - שלב מאוחר יותר); נבדק מול NVR מדומה בלבד, והכתיבה האמיתית הראשונה תיעשה על ידי המוביל באישור הבעלים. שכבת החומר במראות בועה ו-Domus בלבד. מסכי חיבור ה-NVR בתוך הגדרות Arx, החלה על כמה מצלמות ומסכי העדכון אינם בשחרור הזה; חלונית "אין NVR" שומרת על הנוסח הקודם עד שחיבור ה-NVR יעבור להגדרות Arx.

## 0.1.157 (pilot) — Six dropdown styles, per tab group; the Bubble look on 48 more screens
**After the update no restart of the platform is needed** (the bridge integration stays 0.6.0). There is no database migration; the new settings `ui.dd_style` and `ui.dd_style_groups` (and the same two keys in the personal preferences) are created on first save. Reload the installed web app once.
### Dropdown menus: six styles, on every screen width - הגדרות › לשוניות › "סגנון תפריט נפתח"
- Choose the look of the dropdown menu: **pill, field, underline, text, prefix, tonal** (or **auto**, today's look, the default), for all tab groups at once or for each group separately (installation default, and a personal override).
- A list of eight options or more has a **search field**; on the phone the list opens as a **bottom sheet** (or centred / inline, per the Bubble "popup" dial); each style follows the skin, palette, light and dark scheme, radius and touch dials.
- The dropdown tabs now work on **every width** (the phone-only gate is gone): the shell's tab pair row and the security sections, the **area chip** of the devices screens and the media rooms chip, and the **settings sub-tabs (11)** and **permissions sub-tabs (5)** follow the settings group's mode and style.
### The Bubble look reaches 48 more screens
- The security area (live overview, wall, saved views, events, cases, rules, exports, the alarm), the device lists (catalogue, cameras, schedules, protected switches), the automations lists ("קברניט") and all the settings screens now wear the Bubble chrome: pill-track segmented controls with a solid thumb, flat borderless rows, pill fields at the touch dial, static save bars, softer banners. Structure is untouched: video, map, 3D, timeline and the dense tables keep their look. Other looks are not affected.
### Fixes and under the hood
- Bubble no longer strips the border and radius of the **field** dropdown style (a specificity clash between the skin rule and the per-style rules); a new check covers every style in the Bubble look, light and dark.
- Touch-dial fixes found by the layout guard on the new Bubble screens (section tabs, small inline targets, 320 px pages); test-only and documentation corrections for the CR-019 notes.
### How to turn it on and use it (English)
1. No restart is needed; reload the installed web app once.
2. Dropdown style: הגדרות › לשוניות › "סגנון תפריט נפתח": one choice for all groups, or per tab group. Dropdown mode itself is the existing tabs-mode card on the same page.
3. Bubble chrome on the new screens: הגדרות › כללי › "מראה" › choose the Bubble look; the screens above adopt it at once.
### Known limits
- Video, map, 3D, timeline and the dense admin tables are not redesigned in Bubble. The classic, Domus and Tesla looks are unchanged.

## עברית — 0.1.157: שישה סגנונות לתפריט נפתח, לכל קבוצת לשוניות; המראה "בועה" ב-48 מסכים נוספים
**אחרי העדכון אין צורך להפעיל מחדש את התשתית** (הגשר נשאר 0.6.0). אין מיגרציית מסד נתונים; ההגדרות החדשות `ui.dd_style` ו-`ui.dd_style_groups` (ואותם שני מפתחות בהעדפות האישיות) נוצרות בשמירה הראשונה. יש לטעון מחדש את אפליקציית הרשת המותקנת פעם אחת.
### תפריט נפתח: שישה סגנונות, בכל רוחב מסך - הגדרות › לשוניות › "סגנון תפריט נפתח"
- בוחרים את מראה התפריט הנפתח: **pill, field, underline, text, prefix, tonal** (או **auto**, המראה הנוכחי, ברירת המחדל), לכל קבוצות הלשוניות יחד או לכל קבוצה בנפרד (ברירת מחדל להתקנה ודריסה אישית).
- ברשימה של שמונה אפשרויות ומעלה יש **שדה חיפוש**; בטלפון הרשימה נפתחת כ**גיליון תחתון** (או במרכז / בשורה, לפי חוגת ה"חלון" של בועה); כל סגנון מתאים לעצמו לפי המראה, ערכת הצבעים, בהיר/כהה, הרדיוס וגודל המגע.
- הלשוניות הנפתחות פועלות כעת ב**כל רוחב** (המגבלה "טלפון בלבד" הוסרה): שורת זוג הלשוניות של המעטפת וחלקי האבטחה, **צ'יפ האזורים** במסכי ההתקנים וצ'יפ החדרים במולטימדיה, ו**לשוניות המשנה של ההגדרות (11)** וההרשאות (5) עוקבות אחרי המצב והסגנון של קבוצת ההגדרות.
### המראה "בועה" מגיע ל-48 מסכים נוספים
- אזור האבטחה (סקירה חיה, קיר, תצוגות שמורות, אירועים, תיקים, חוקים, ייצוא, האזעקה), רשימות ההתקנים (קטלוג, מצלמות, תזמונים, מתגים מוגנים), רשימות ה"קברניט" וכל מסכי ההגדרות לובשים עכשיו את מעטפת "בועה": בוררי מקטע בצורת פס עם אגודל מלא, שורות שטוחות בלי מסגרת, שדות בצורת גלולה בגובה המגע, פסי שמירה סטטיים, באנרים רכים. המבנה לא משתנה: וידאו, מפה, תלת-ממד, ציר זמן והטבלאות הצפופות נשארים כפי שהיו. מראות אחרים אינם מושפעים.
### תיקונים
- "בועה" כבר לא מוחקת את המסגרת והעיגול של הסגנון **field** של התפריט הנפתח (התנגשות עדיפות בין כלל המראה לכללי הסגנונות); בדיקה חדשה מכסה כל סגנון במראה "בועה", בהיר וכהה.
- תיקוני יעד מגע שנמצאו בבדיקת הפריסה במסכי "בועה" החדשים (לשוניות האבטחה, יעדים קטנים בתוך טקסט, דפים ברוחב 320); וכן תיקוני בדיקות ותיעוד להערות CR-019.
- **איך מפעילים:** אין צורך בהפעלה מחדש. סגנון תפריט: הגדרות › לשוניות › "סגנון תפריט נפתח". מעטפת "בועה": הגדרות › כללי › "מראה" › בוחרים "בועה". מגבלות: וידאו, מפה, תלת-ממד, ציר זמן והטבלאות הצפופות לא עוצבו מחדש ב"בועה"; classic, Domus ו-Tesla ללא שינוי.

## 0.1.156 (pilot) — Test stability release (no change to how the system behaves)
**After the update no restart of the platform is needed** (the bridge integration stays 0.6.0). There is no database migration and no new setting; nothing changes on any screen.
### Fixes and under the hood
- Two occasionally failing automated checks were made reliable: the automations builder check on right-to-left and touch layouts (a sub-pixel height rounding), and the tabs-settings check (it now waits for the settings save to finish before the second edit). These affected only the test suite, never the product.
### How to turn it on and use it (English)
1. Nothing to enable: update the add-on and reload the installed web app once.

## עברית — 0.1.156: שחרור יציבות בדיקות (ללא שינוי בהתנהגות המערכת)
- **לא נדרשת הפעלה מחדש** של הפלטפורמה, אין מיגרציה ואין הגדרה חדשה; שום מסך לא משתנה.
- שתי בדיקות אוטומטיות שנכשלו לפעמים נעשו אמינות: בדיקת בונה האוטומציות בפריסת ימין-לשמאל ובמגע (עיגול גובה בפיקסל חלקי), ובדיקת הגדרות הלשוניות (ממתינה לסיום שמירת ההגדרות לפני העריכה השנייה). זה השפיע רק על סט הבדיקות, לא על המוצר.
- **איך מפעילים:** אין מה להפעיל. מעדכנים את התוסף ורועננים פעם אחת את האפליקציה המותקנת.

## 0.1.155 (pilot) — Ten colour palettes for the Bubble look, and a palette editor
**After the update no restart of the platform is needed** (the bridge integration stays 0.6.0). There is no database migration; the new setting `ui.palettes` is created on first save. Reload the installed web app once.
### Ten ready palettes - הגדרות › כללי › "מראה" › "ערכת צבעים" (works with the Bubble look)
- Choose between **כחול שקט, סגול ורוד, טורקיז, חול וענבר, גרפיט, אוקיינוס עמוק, יער, שקיעה, קוורץ ורוד and ניגודיות גבוהה**, each with a light and a dark scheme. The default stays the calm blue base palette.
- **One choice for everybody**: the palette is set once for the installation by whoever may change the installation settings (the `system.configure` permission). Personal palette choices are no longer offered; an old stored personal value is kept untouched and simply ignored.
- The base palette cannot be deleted or replaced; a custom palette can never take its id or the id of a ready palette.
### A palette editor - same page, administrators only
- Start from any palette, edit its 10 key colours in the light and dark schemes with a live preview, pick from **recommended swatches or a free colour picker**, and save under a new name (**"שמור כחדשה"**, up to 12 custom palettes).
- **A warning, not a block**: a palette with weak contrast can be saved, but the editor lists the worst colour pairs in Hebrew and offers a one-click **"תקן אוטומטית"**.
- In the dark scheme the accent colour is lifted automatically so it stays readable, and the soft colour washes behind pills were tuned so text keeps at least 4.5:1 contrast in all ten palettes, light and dark.
### Fixes and under the hood
- The keyboard step of the tab-order test no longer races with the focus, and the Windows pixel baselines match the new "קברניט" header.
### How to turn it on and use it (English)
1. No restart is needed; reload the installed web app once.
2. Choose the Bubble look first: הגדרות › כללי › "מראה". Then pick the palette in the same card (an administrator sets it for everybody).
3. To design your own: the palette editor on the same page (administrators).

## עברית — 0.1.155: עשר ערכות צבעים למראה "בועה" ועורך ערכות
**אחרי העדכון אין צורך להפעיל מחדש את התשתית** (הגשר נשאר 0.6.0). אין מיגרציית מסד נתונים; ההגדרה החדשה `ui.palettes` נוצרת בשמירה הראשונה. יש לטעון מחדש את אפליקציית הרשת המותקנת פעם אחת.
### עשר ערכות מוכנות - הגדרות › כללי › "מראה" › "ערכת צבעים" (פועל עם המראה "בועה")
- בחירה בין **כחול שקט, סגול ורוד, טורקיז, חול וענבר, גרפיט, אוקיינוס עמוק, יער, שקיעה, קוורץ ורוד וניגודיות גבוהה**, לכל אחת ערכה בהירה וכהה. ברירת המחדל נשארת ערכת הבסיס הכחולה השקטה.
- **בחירה אחת לכולם**: הערכה נקבעת פעם אחת להתקנה, על ידי מי שמורשה לשנות את הגדרות ההתקנה (ההרשאה `system.configure`). בחירה אישית של ערכה כבר לא מוצעת; ערך אישי ישן שנשמר נשאר בלי שינוי ופשוט מתעלמים ממנו.
- אי אפשר למחוק או להחליף את ערכת הבסיס; ערכה מותאמת לא יכולה לקחת את המזהה שלה או מזהה של ערכה מוכנה.
### עורך ערכות - באותו עמוד, למנהלים בלבד
- מתחילים מכל ערכה, עורכים את 10 צבעי המפתח שלה בערכה הבהירה והכהה עם תצוגה חיה, בוחרים **מצבעים מומלצים או בבורר חופשי**, ושומרים בשם חדש (**"שמור כחדשה"**, עד 12 ערכות מותאמות).
- **אזהרה ולא חסימה**: אפשר לשמור ערכה עם ניגודיות חלשה, אבל העורך מפרט בעברית את צמדי הצבעים הגרועים ומציע **"תקן אוטומטית"** בלחיצה אחת.
- בערכה הכהה צבע הדגש מובהר אוטומטית כדי שיישאר קריא, והגוונים הרכים מאחורי הגלולות כוונו כך שהטקסט שומר על ניגודיות של 4.5:1 לפחות בכל עשר הערכות, בבהיר ובכהה.
### תיקונים ומאחורי הקלעים
- צעד המקלדת בבדיקת סדר הלשוניות כבר לא מתחרה בפוקוס, ובסיסי הפיקסלים של Windows תואמים לכותרת "קברניט".
### איך מפעילים ומשתמשים (עברית)
1. אין צורך בהפעלה מחדש; יש לטעון מחדש את אפליקציית הרשת המותקנת פעם אחת.
2. קודם בוחרים את המראה "בועה": הגדרות › כללי › "מראה". אחר כך בוחרים את הערכה באותו כרטיס (מנהל קובע לכולם).
3. לעיצוב ערכה משלך: עורך הערכות באותו עמוד (מנהלים).

## 0.1.154 (pilot) — The Bubble look on the home, area and multimedia screens, a performance dial, "קברניט" with the schedules inside, a clearer tabs display card
**After the update no restart of the platform is needed** (the bridge integration stays 0.6.0). There is no database migration. Reload the installed web app once so the new service worker takes over.
### The Bubble look on the real screens - הגדרות › כללי › "מראה" (still off until you choose it)
- **Home**: status pills, quick-action pills and area rows with coloured hue rings.
- **Area**: pill rows, section separators and the device sheets that open over the dimmed page.
- **Multimedia**: a now-playing hero, player pills and a volume control that morphs.
- Nothing changes until the Bubble skin is chosen; the default skin and the floors/areas tree are untouched.
### A performance dial - הגדרות › כללי › "מראה" › "ביצועים"
- Three values: **auto** (the default), **full** and **lite**. **Lite** removes the glass blur from pills, chips and the overlays on video, art and maps (the dock, rail and the open pop-up keep theirs) and keeps text contrast above 4.5:1.
- **Auto** decides per device: a weak processor (4 cores or fewer), little memory, or a system preference for reduced motion or transparency gives lite at once; otherwise a short frame-time probe at idle decides, and the answer is remembered for 30 days. The probe now runs only while the dial is auto.
### "קברניט" - the old "אוטומציות" top tab, with the schedules inside
- The top tabs of the devices area are now **מבט על** and **קברניט**. Inside קברניט the first segment is **תזמונים**, followed by אוטומציות, סצנות and סקריפטים.
- The tab opens on the schedules when they are available. If schedules are off in the settings, the scheduler is unavailable or you may not view them, that segment is hidden and the tab opens on the automations.
- Old links (`#/devices/schedules`) keep working, a stale stored tab setting can no longer hide the new segment, and the breadcrumb reads ראשי › קברניט › the segment.
### A clearer tabs display card - הגדרות › כללי › לשוניות › "תצוגת לשוניות"
- The card now shows, per group, which mode is in force and where it comes from (your choice or the installation default), and a **reset my choices** button.
- A note explains that the dropdown mode applies on a phone width (up to 767 px); the preview is labelled as the phone look. The home group is now called "אזורים בקומה (מסך האזור)".
### Fixes and under the hood
- The Hebrew strings of the area screen that had been garbled are restored.
- The notification and schedules tests no longer depend on the time of day, and the test suites run the same on Linux as on Windows (Linux pixel baselines were added).
### How to turn it on and use it (English)
1. No restart is needed; reload the installed web app once.
2. **The Bubble look**: הגדרות › כללי › "מראה" (choose the skin; the performance row sits with the other dials).
3. **קברניט**: the top tab of the devices area; the schedules are its first segment.
4. **Tabs display**: הגדרות › כללי › לשוניות › "תצוגת לשוניות" (the active mode per group is listed in the card).

## עברית — 0.1.154: המראה "בועה" במסכי הבית, האזור והמולטימדיה · חוגת ביצועים · "קברניט" עם התזמונים בתוכו · כרטיס ברור יותר לתצוגת לשוניות
**אחרי העדכון אין צורך להפעיל מחדש את התשתית** (הגשר נשאר 0.6.0). אין מיגרציית מסד נתונים. יש לטעון מחדש את אפליקציית הרשת המותקנת פעם אחת, כדי שה-service worker החדש ייכנס לתוקף.
### המראה "בועה" במסכים האמיתיים - הגדרות › כללי › "מראה" (עדיין כבוי עד שתבחר בו)
- **הבית**: גלולות מצב, גלולות פעולה מהירה ושורות אזור עם טבעות צבע.
- **האזור**: שורות גלולה, מפרידי מקטעים וגיליונות מכשיר שנפתחים מעל הדף המעומעם.
- **מולטימדיה**: נגן ראשי, גלולות נגנים ופקד עוצמת שמע שמשנה צורה.
- שום דבר לא משתנה עד שבוחרים בערכת "בועה"; ערכת ברירת המחדל ועץ הקומות והאזורים נשארים כמות שהם.
### חוגת ביצועים - הגדרות › כללי › "מראה" › "ביצועים"
- שלושה ערכים: **אוטומטי** (ברירת המחדל), **מלא** ו**קל**. במצב **קל** מוסר טשטוש הזכוכית מגלולות, צ'יפים וכיסויים מעל וידאו, תמונה ומפה (הדוק, הסרגל והחלון הקופץ הפתוח שומרים עליו), וניגודיות הטקסט נשארת מעל 4.5:1.
- במצב **אוטומטי** המכשיר מחליט לבד: מעבד חלש (עד 4 ליבות), מעט זיכרון, או העדפת מערכת להפחתת תנועה או שקיפות נותנים מצב קל מיד; אחרת מדידה קצרה של קצב הפריימים בזמן סרק מכריעה, והתשובה נשמרת 30 יום. המדידה רצה מעכשיו רק כשהחוגה על אוטומטי.
### "קברניט" - לשונית "אוטומציות" הקודמת, עם התזמונים בתוכה
- הלשוניות העליונות באזור ההתקנים הן עכשיו **מבט על** ו**קברניט**. בתוך קברניט הקטע הראשון הוא **תזמונים**, ואחריו אוטומציות, סצנות וסקריפטים.
- הלשונית נפתחת על התזמונים כשהם זמינים. אם התזמונים כבויים בהגדרות, המתזמן לא זמין או שאין לך הרשאה לצפות בהם, הקטע מוסתר והלשונית נפתחת על האוטומציות.
- קישורים ישנים (`#/devices/schedules`) ממשיכים לעבוד, הגדרת לשונית ישנה שנשמרה לא יכולה עוד להסתיר את הקטע החדש, ופירורי הלחם מציגים ראשי › קברניט › הקטע.
### כרטיס ברור יותר לתצוגת לשוניות - הגדרות › כללי › לשוניות › "תצוגת לשוניות"
- הכרטיס מציג עכשיו לכל קבוצה איזה מצב בתוקף ומאיפה הוא בא (בחירה שלך או ברירת מחדל של ההתקנה), וכפתור **איפוס הבחירות שלי**.
- הערה מסבירה שמצב התפריט הנפתח חל ברוחב טלפון (עד 767 פיקסלים); התצוגה המקדימה מסומנת כמראה הטלפון. קבוצת הבית נקראת עכשיו "אזורים בקומה (מסך האזור)".
### תיקונים ומאחורי הקלעים
- שוחזרו מחרוזות העברית של מסך האזור שנשחתו.
- בדיקות ההתראות והתזמונים אינן תלויות עוד בשעה ביום, ובדיקות המערכת רצות זהה בלינוקס ובווינדוס (נוספו בסיסי פיקסלים ללינוקס).
### איך מפעילים ומשתמשים (עברית)
1. אין צורך בהפעלה מחדש; יש לטעון מחדש את אפליקציית הרשת המותקנת פעם אחת.
2. **המראה "בועה"**: הגדרות › כללי › "מראה" (בחירת ערכת העיצוב; שורת הביצועים נמצאת עם שאר החוגות).
3. **קברניט**: הלשונית העליונה באזור ההתקנים; התזמונים הם הקטע הראשון בה.
4. **תצוגת לשוניות**: הגדרות › כללי › לשוניות › "תצוגת לשוניות" (המצב הפעיל לכל קבוצה מופיע בכרטיס).

## 0.1.153 (pilot) — The Bubble look (optional), protected switches, a cameras table, tabs as a dropdown option, phone fixes, higher caps
**After the update no restart of the platform is needed** (the bridge integration stays 0.6.0). Migration 0049 is applied on the first start. Reload the installed web app once so the new service worker takes over.
### The Bubble look - הגדרות › כללי › "מראה" (off until you choose it)
- A new optional **skin "Bubble"**: translucent pop-ups over the dimmed page, pill rows, a floating bottom bar with a home button on the phone. Nothing changes until it is chosen (the default skin stays as today). This release brings the foundation and the settings; the home, area and multimedia screens follow in the next releases.
- **Every option is editable in the UI**, as an installation default and as a personal choice ("ההעדפה שלי"): density (wide / regular / compact / row), surface (flat / glass / gradient / fill), pop-up kind (sheet / centred / inline), corner radius, transparency, size scale and touch-target size. The transparency never goes below the level where text stays readable (4.5:1).
### Protected switches (CR-019) - הגדרות › חשמל והתקנים › "מתגים מוגנים"
- Group actions ("turn everything off" for a floor, an area, the building) now include **every switch unless an administrator protects it**; switches that look sensitive (pumps, boilers, routers...) are only **suggested** for protection. **Important: right after the update "turn everything off" reaches every switch - open the screen once and protect what must stay out.** A protected switch is still controllable one by one, by schedules and by automations.
### A cameras table (CR-020, read only) - הגדרות › אבטחה › "מצלמות"
- For system administrators: every stream with its codec (H.264/H.265 and the + variants), SVC, resolution, frame rate, bitrate, GOP and whether it plays over WebRTC. Read only; nothing is changed on the recorder.
### Phone fixes
- **Multimedia › players and speakers**: the header no longer jumps between expanded and compact while you scroll, and the group heading no longer slides over the search field. The same fix covers the groups page and the automations pages.
- **Area page**: it can no longer be dragged sideways by the row of area chips.
- **Investigation (playback)**: the transport controls sit in one bar under the video instead of covering half of it.
### Tabs as a dropdown (הגדרות › כללי › לשוניות › "תצוגת לשוניות")
- Choose **tabs** (as today, the default), **hybrid** (a segmented control up to three items, a dropdown for more) or **dropdown**; an installation default and a personal choice ("ההעדפה שלי"), and a choice per tab group (home areas, area pages, multimedia, security, settings). On a phone the dropdown mode puts the two levels in **one row of two compact chips** and saves vertical space; the count "(6)" stays in the list and a dot shows an alert behind a hidden option; the alarm stays one tap away.
### Limits and compatibility
- **Live sessions and remote streams up to 128** (הגדרות › וידאו ומדיה and הגדרות › גישה מרחוק), with a warning - never a block - above half of the streams the recorder is built for.
- **Ready for Home Assistant 2026.10**: usernames are compared lower-cased and trimmed, and the automation builder refuses state conditions that combine "for" with several entities or a list of states (Home Assistant 2026.10 rejects them).
### How to turn it on and use it (English)
1. No restart is needed; reload the installed web app once.
2. **The Bubble look**: הגדרות › כללי › "מראה" (a skin choice and the dials). **Protected switches**: review the suggestions once. **Cameras table**: הגדרות › אבטחה › "מצלמות".
3. **Tabs as a dropdown**: הגדרות › כללי › לשוניות › "תצוגת לשוניות"; the default stays tabs until you or a user chooses otherwise.
4. **Higher caps**: the two fields in הגדרות accept up to 128 now; a warning appears above half of the recorder's streams.

## עברית — 0.1.153: המראה "בועה" (אופציונלי) · מתגים מוגנים · טבלת מצלמות · לשוניות כרשימה נפתחת · תיקונים בטלפון · תקרות גבוהות
**אחרי העדכון אין צורך להפעיל מחדש את התשתית** (הגשר נשאר 0.6.0). מיגרציה 0049 מתבצעת בהפעלה הראשונה. יש לטעון מחדש את האפליקציה המותקנת פעם אחת.
### המראה "בועה" - הגדרות › כללי › "מראה" (כבוי עד שתבחר בו)
- **ערכת עיצוב חדשה ואופציונלית "בועה"**: חלונות קופצים שקופים מעל הדף המעומעם, שורות גלולה, וסרגל תחתון צף עם כפתור בית בטלפון. שום דבר לא משתנה עד שבוחרים בה (ברירת המחדל נשארת כמו היום). הגרסה מביאה את התשתית וההגדרות; מסכי הבית, האזור והמולטימדיה יבואו בגרסאות הבאות.
- **כל האפשרויות ניתנות לעריכה בממשק**, כברירת מחדל להתקנה וכבחירה אישית ("ההעדפה שלי"): צפיפות (רחב / רגיל / קומפקטי / שורות), משטח (שטוח / זכוכית / גרדיאנט / מילוי), סוג חלון קופץ (גיליון / מרכזי / בתוך הדף), רדיוס פינות, שקיפות, קנה מידה וגודל יעד נגיעה. השקיפות לא יורדת מתחת לרמה שבה הטקסט נשאר קריא (4.5:1).
### מתגים מוגנים (CR-019) - הגדרות › חשמל והתקנים › "מתגים מוגנים"
- פעולות קבוצתיות ("כבה הכל" לקומה, לאזור, למבנה) כוללות עכשיו **כל מתג, אלא אם מנהל הגן עליו**; מתגים שנראים רגישים (משאבות, דודים, ראוטרים...) רק **מוצעים** להגנה. **חשוב: מיד אחרי העדכון "כבה הכל" מגיע לכל מתג - יש להיכנס למסך פעם אחת ולהגן על מה שצריך להישאר בחוץ.** מתג מוגן עדיין ניתן להפעלה לבד, בתזמון ובאוטומציה.
### טבלת מצלמות (CR-020, לקריאה בלבד) - הגדרות › אבטחה › "מצלמות"
- למנהלי מערכת: כל זרם עם ה-codec שלו (H.264/H.265 והווריאנטים עם +), SVC, רזולוציה, קצב פריימים, ביטרייט, GOP והאם הוא מנוגן ב-WebRTC. לקריאה בלבד; שום דבר לא משתנה במקליט.
### תיקונים בטלפון
- **מולטימדיה › נגנים ורמקולים**: הכותרת כבר לא קופצת בין מורחבת לקומפקטית בגלילה, וכותרת הקבוצה לא מחליקה מעל שדה החיפוש. אותו תיקון חל על עמוד הקבוצות ועל עמודי האוטומציות.
- **עמוד אזור**: אי אפשר עוד לגרור אותו הצידה בעזרת שורת צ'יפי האזורים.
- **חקירה (ניגון)**: בקרי הניגון נמצאים בסרגל אחד מתחת לווידאו ולא מכסים חצי ממנו.
### לשוניות כרשימה נפתחת (הגדרות › כללי › לשוניות › "תצוגת לשוניות")
- בחירה בין **לשוניות** (כמו היום, ברירת המחדל), **היברידי** (פקד מפוצל עד שלושה פריטים, רשימה נפתחת למעלה מזה) ו**רשימה נפתחת**; ברירת מחדל להתקנה, בחירה אישית ("ההעדפה שלי") ובחירה לכל קבוצת לשוניות (אזורי הבית, עמודי אזור, מולטימדיה, אבטחה, הגדרות). בטלפון מצב הרשימה הנפתחת מציב את שתי הרמות **בשורה אחת של שני צ'יפים** וחוסך מקום; הספירה "(6)" נשארת ברשימה, נקודה מסמנת התראה מאחורי אפשרות מוסתרת, והאזעקה נשארת במרחק נגיעה אחת.
### תקרות ותאימות
- **סשנים חיים וזרמים מרחוק עד 128** (הגדרות › וידאו ומדיה והגדרות › גישה מרחוק), עם אזהרה - לא חסימה - מעל מחצית מכמות הזרמים שהמקליט בנוי אליה.
- **מוכן ל-Home Assistant 2026.10**: שמות משתמש מושווים באותיות קטנות וללא רווחים, ובונה האוטומציות מסרב לתנאי מצב שמשלבים "for" עם כמה ישויות או רשימת מצבים (Home Assistant 2026.10 דוחה אותם).
### איך מפעילים ומשתמשים (עברית)
1. אין צורך בהפעלה מחדש; טוענים מחדש את האפליקציה המותקנת פעם אחת.
2. **המראה "בועה"**: הגדרות › כללי › "מראה" (בחירת ערכת עיצוב והחוגות). **מתגים מוגנים**: לעבור פעם אחת על ההצעות. **טבלת מצלמות**: הגדרות › אבטחה › "מצלמות".
3. **לשוניות כרשימה נפתחת**: הגדרות › כללי › לשוניות › "תצוגת לשוניות"; ברירת המחדל נשארת לשוניות עד שתבחר או שמשתמש יבחר אחרת.
4. **תקרות גבוהות**: שני השדות בהגדרות מקבלים עד 128; מופיעה אזהרה מעל מחצית מזרמי המקליט.

## 0.1.152 (pilot) — Automations, scenes and scripts; the full music queue and library; up to 128 parallel playbacks
**After the update restart the platform once**: the bridge integration is 0.6.0 (the automation, scene and script services). Migration 0048 is applied on the first start. Reload the installed web app once so the new service worker takes over.
### Automations, scenes and scripts (CR-017)
- **A third tab on the home screens** for automations, scenes and scripts, with lists, a detail drawer and editors (a builder with templates) for each kind. Scenes are activated by anyone allowed to control devices; scripts run with `script.run` and editing needs the new permission `automation.manage` (both held by site administrators and system administrators by default; there is no view-only access).
- **Failures reach the notification centre**: a failed automation or script raises an "automation failed" alert for the administrators.
- Hardening from the security review: previews and dry-runs of an unsaved draft need the manage permission of that kind, and a reconnect a minute after a failed write lifts the authoring block.
### Music (CR-016, phase 2b) — הגדרות › מולטימדיה › חיבור
- **The full playback queue**: reorder by dragging, delete, "play next", clear (one confirmation). The playing and the buffered rows are locked.
- **The music library with search** inside the player panel.
- **A direct connection to Music Assistant**, configured by the installer only (address and an access token that is never shown or exported again). Until it is configured the player panel behaves exactly as in 0.1.150.
- **Permissions**: browsing the library is `media.browse`; editing the queue is the new `media.queue`, held by operators, site administrators and system administrators (whoever may control multimedia may control the music).
### Playback
- **Parallel playback sessions up to 128** (הגדרות › וידאו ומדיה). A warning, never a block, appears above half of the streams the recorder is built for (read from its model; no warning when unknown).
### Behind the scenes
- A flaky schedules spec was made stable; the CR-014 scheduler has its task card; a registry and checker of upstream dependencies (`management/upstream_watch.json`, `scripts/upstream_check.py`) was added for tracking Home Assistant and other releases.
### How to turn it on and use it (English)
1. Restart the platform once after the update (the bridge integration is 0.6.0), then reload the installed web app once.
2. **Automations**: the new third tab on the home screens; site and system administrators create, edit and run; others activate scenes according to their device permissions.
3. **The music queue and library**: open the player panel of a speaker. To enable the queue edit and the search, an installer sets the connection in הגדרות › מולטימדיה › חיבור (address and token of Music Assistant).
4. **Parallel playbacks**: הגדרות › וידאו ומדיה › "סשני ניגון במקביל" now accepts up to 128.

## עברית — 0.1.152: אוטומציות, סצנות וסקריפטים · תור וספרייה מלאים למוזיקה · עד 128 ניגונים במקביל
**אחרי העדכון יש להפעיל מחדש את התשתית פעם אחת**: הגשר הוא 0.6.0 (שירותי אוטומציות, סצנות וסקריפטים). מיגרציה 0048 מתבצעת בהפעלה הראשונה. יש לטעון מחדש את האפליקציה המותקנת פעם אחת.
### אוטומציות, סצנות וסקריפטים (CR-017)
- **לשונית שלישית במסכי הבית** לאוטומציות, סצנות וסקריפטים: רשימות, מגירת פרטים ועורך (בונה עם תבניות) לכל סוג. סצנה מופעלת על ידי כל מי שמורשה לשלוט במכשירים; סקריפט רץ עם `script.run` ועריכה דורשת את ההרשאה החדשה `automation.manage` (שתיהן למנהלי אתר ולמנהלי מערכת כברירת מחדל; אין גישת צפייה בלבד).
- **כשלים מגיעים למרכז ההתראות**: אוטומציה או סקריפט שנכשלו מעלים התראה למנהלים.
- חיזוק לפי ביקורת האבטחה: תצוגה מקדימה והרצת ניסיון של טיוטה דורשות הרשאת ניהול של אותו סוג.
### מוזיקה (CR-016, שלב 2b) — הגדרות › מולטימדיה › חיבור
- **תור הניגון המלא**: סידור בגרירה, מחיקה, "הבא בתור" וניקוי (באישור אחד). השורה המנגנת והשורה שנטענה מראש נעולות.
- **ספריית המוזיקה עם חיפוש** בתוך פאנל הנגן.
- **חיבור ישיר ל-Music Assistant**, מוגדר על ידי המתקין בלבד (כתובת וטוקן שאינו מוצג או מיוצא שוב). עד שהוגדר, הפאנל מתנהג בדיוק כמו ב-0.1.150.
- **הרשאות**: עיון בספרייה הוא `media.browse`; עריכת התור היא `media.queue` החדשה, למפעילים, מנהלי אתר ומנהלי מערכת (מי שמורשה לשלוט במולטימדיה שולט במוזיקה).
### ניגון
- **עד 128 סשני ניגון במקביל** (הגדרות › וידאו ומדיה). מופיעה אזהרה, לא חסימה, מעל מחצית מכמות הזרמים שהמקליט בנוי אליה (נקראת מהדגם שלו; בלי אזהרה כשלא ידוע).
### מאחורי הקלעים
- בדיקת התזמונים הלא יציבה תוקנה; לתזמונים (CR-014) נוסף כרטיס משימה; נוספו רישום ובדיקה של תלויות חיצוניות (`management/upstream_watch.json`, `scripts/upstream_check.py`) למעקב אחר Home Assistant ועוד.
### איך מפעילים ומשתמשים (עברית)
1. מפעילים מחדש את התשתית פעם אחת אחרי העדכון (הגשר הוא 0.6.0), ואז טוענים מחדש את האפליקציה המותקנת.
2. **אוטומציות**: הלשונית השלישית במסכי הבית. מנהלי אתר ומנהלי מערכת יוצרים, עורכים ומריצים; אחרים מפעילים סצנות לפי הרשאות המכשירים.
3. **תור וספרייה**: פותחים את פאנל הנגן של רמקול. להפעלת עריכת התור והחיפוש המתקין מגדיר את החיבור ב-הגדרות › מולטימדיה › חיבור (כתובת וטוקן של Music Assistant).
4. **ניגונים במקביל**: הגדרות › וידאו ומדיה › "סשני ניגון במקביל" מקבלת עד 128.

## 0.1.151 (pilot) — A notification centre, administrators reach the system remotely by default, WebRTC for every stream, the speakers tab, timeline colours
**After the update no restart of the platform is needed** (the bridge integration stays 0.5.0). Migrations 0045-0047 are applied on the first start. Reload the installed web app once so the new service worker takes over.
### Notifications (CR-018) — the bell in the user menu, and הגדרות › התראות
- **A notification centre**: every alert in one place, with read / unread, "snooze for an hour" / "until morning", and acknowledge.
- **The sources**: leaks, smoke, gas and CO, the alarm, a door or window left open, a camera or the NVR going offline, system faults and backups.
- **Push** to the installed web app of each person (lock-screen text is the administrator's choice), **quiet hours** (severity x channel), **escalation** of an unacknowledged critical alert, an **e-mail** channel (SMTP, certificate verified; "לא מוגדר" until a server is entered).
- **The administrator's tab "התראות"** (new permission `notify.manage`, held by system administrators): sources and who is told, quiet hours, escalation, e-mail, the delivery log.
- Hardening from the security reviews: a locked-out user does not receive the lockout alert meant for the administrators, saved notification settings survive a restore of an older backup, and the action routes are throttled.
### Video
- **WebRTC is tried for every stream (owner report, Hoffnung)**: the NVR check marked H.265 and H.264+SVC streams "cannot play over WebRTC" on the codec name alone, so with the installation on "WebRTC only" the remote player never tried 9 of 12 main streams. Measured from a desktop browser outside that network, all of them decode over WebRTC (2560x1440 SVC and H.265 up to 4256x1888). Now only MJPEG and H.264 with B-frames are skipped; the rest are tried and fall back on the measured failure. The "change the NVR settings" warnings no longer claim these streams cannot play.
- **A video connection test** (הגדרות › גישה מרחוק › "בדיקת חיבור וידאו", administrators): runs a WebRTC connection to a chosen camera from the browser you are on and prints a copyable report - ICE states, candidate types (never addresses), the selected pair, the network type, frames decoded - to find out why a phone does not connect.
- **The stream notes are hidden by default**: the banner "WebRTC לא זמין לזרם הזה…" and the grey hints under a camera appear only when הגדרות › וידאו ומדיה › "הודעות על אופן ההזרמה" is on. The badge keeps the same text as its tooltip.
- **Timeline colours**: הגדרות › וידאו ומדיה › "צבעי ציר הזמן" (a colour for recording, motion, person, vehicle, door, line and offline) and two settings that hide the technical text on the recording screen.
### Multimedia
- **The "נגנים ורמקולים" and "קבוצות" tabs now appear when you enter the section** (the first page, "מסכים"): they were offered only after opening the players page by its address, so approved speakers seemed to be missing.
- **No "ללא שיוך" heading over a lone group of screens**; in an installation without floors the no-floor group of a floor grouping is called "ללא קומה".
### Remote access (CR-008, amendment A1)
- **Administrators may sign in remotely by default**: the setting `remote.admins_default` (הגדרות › גישה מרחוק). Turn it off there if you do not want it.
### Plans
- **"בקשה לאדריכל"**: when a floor has no plan, the setup wizard, the floors list, the plan editor and the import screen offer a ready-made request text.
### How to turn it on and use it (English)
1. No restart is needed. After the update reload the installed web app once.
2. **Notifications**: tap the bell in the user menu; to receive push on a phone or computer open הגדרות › התראות and register the device. Administrators configure the sources, quiet hours, escalation and e-mail in the same place.
3. **WebRTC**: nothing to do. If a stream still fails on a phone, set הגדרות › וידאו ומדיה to "אוטומטי" so the player falls back to MSE.
4. **Stream notes**: הגדרות › וידאו ומדיה › "הודעות על אופן ההזרמה" (off by default).
5. **Remote administrators / timeline colours / request for the architect**: the settings named above; the request is in the setup wizard (floor step) and on a floor without a plan.

## עברית — 0.1.151: מרכז התראות · מנהלים מתחברים מרחוק כברירת מחדל · WebRTC לכל זרם · לשונית הרמקולים · צבעי ציר הזמן
### מה חדש
- **מרכז התראות** – כל ההתראות במקום אחד: נקרא / לא נקרא, "השתק לשעה" ו"עד הבוקר", ואישור. נפתח מהפעמון בתפריט המשתמש; בהגדרות לשונית "התראות" למנהלים (הרשאה חדשה `notify.manage`): מקורות ולמי להודיע, שעות שקט, הסלמה, דוא"ל (SMTP) ויומן שליחות. הודעות Push לאפליקציה המותקנת של כל אדם.
- **WebRTC נוסה לכל זרם** – הבדיקה סימנה זרמי H.265 ו־H.264 עם SVC כ"לא מתנגנים ב־WebRTC" לפי שם הקודק בלבד, ולכן כשההתקנה על "WebRTC בלבד" הנגן המרוחק לא ניסה 9 מתוך 12 זרמים ראשיים (הופנונג). נמדד מדפדפן מחוץ לרשת: כולם מתפענחים. עכשיו מדלגים רק על MJPEG ועל H.264 עם B-frames; השאר נוסים ונופלים רק על כשל מדוד. האזהרות "שנה בהגדרות ה־NVR" כבר לא מופיעות על זרמים כאלה.
- **בדיקת חיבור וידאו** (הגדרות › גישה מרחוק, למנהלים): מריצה חיבור WebRTC למצלמה שנבחרה מהדפדפן שבו אתה נמצא ומציגה דוח להעתקה – מצבי ICE, סוגי מועמדים (בלי כתובות), הזוג שנבחר, סוג הרשת וכמה פריימים פוענחו – כדי להבין למה נייד לא מתחבר.
- **הערות ההזרמה מוסתרות כברירת מחדל** – הבאנר "WebRTC לא זמין לזרם הזה…" ושורות הרמז מתחת למצלמה מופיעים רק כשההגדרה "הודעות על אופן ההזרמה" דלוקה (הגדרות › וידאו ומדיה).
- **צבעי ציר הזמן** והסתרת הטקסט הטכני במסך ההקלטה (הגדרות › וידאו ומדיה).
- **מנהלים מתחברים מרחוק כברירת מחדל** (`remote.admins_default`, הגדרות › גישה מרחוק; אפשר לכבות).
- **"בקשה לאדריכל"** – כשלקומה אין תוכנית: נוסח בקשה מוכן באשף ההתקנה, ברשימת הקומות, בעורך התוכנית ובמסך הייבוא.
### תיקונים
- **לשוניות "נגנים ורמקולים" ו"קבוצות" מופיעות עכשיו כבר בכניסה לאזור** (במסך "מסכים"); קודם הן הופיעו רק אחרי כניסה לדף הנגנים בכתובת ישירה, ולכן נראה שרמקולים שאושרו לא נוספו.
- **בלי כותרת "ללא שיוך" מעל קבוצת מסכים יחידה**; באתר בלי קומות הקבוצה נקראת "ללא קומה" בקיבוץ לפי קומה.
- **הקשחה** (מסקירות אבטחה): משתמש נעול לא מקבל את התראת הנעילה של המנהלים, הגדרות ההתראות שורדות שחזור גיבוי ישן, ופעולות ההתראות מוגבלות בקצב.
### איך מפעילים ומשתמשים
1. אין צורך בהפעלה מחדש. אחרי העדכון טען מחדש את האפליקציה המותקנת פעם אחת.
2. **התראות**: הפעמון בתפריט המשתמש; לקבלת Push רשום את המכשיר בהגדרות › התראות.
3. **WebRTC**: אין מה לעשות. אם זרם עדיין נכשל בטלפון, הגדר בהגדרות › וידאו ומדיה "אוטומטי" והנגן יעבור ל־MSE.
4. **הערות ההזרמה**: הגדרות › וידאו ומדיה › "הודעות על אופן ההזרמה" (כבוי כברירת מחדל).

## 0.1.150 (pilot) — Multimedia, part 2: speakers, players and groups
**After the update restart the platform once**: the bridge integration is 0.5.0 (player services and a read-only `media_query` service). Migration 0044 is applied on the first start.
### Speakers, players and groups (CR-016) — inside "מולטימדיה"
- **"נגנים ורמקולים" and "קבוצות" are real tabs**: one card per physical speaker, player or receiver (the same device seen through several integrations is merged; Music Assistant copies, Cast and vendor entities are linked by the merge rules or suggested for you to confirm), grouped by floor, with a "לא משויכים" section for devices without a room and one list for a house without floors. A device that is not available shows "לא זמין" - its controls wait for it.
- **The player panel** (the same side panel / bottom sheet as the TV remote): now playing with artwork, seek, previous / next, shuffle and repeat, volume, "הבא בתור" (the current and the next item and how many are left; "לא זמין" when it cannot be read, never an empty list), favourites, stations and playlists (when the installation has a library), and live grouping by ticking rooms. A receiver has its zones as tabs; a speaker that cannot be switched on from here (Cast only) shows no power button.
- **Groups**: join and leave rooms live (a member is controlled through its leader), group volume with a per-room result that names the rooms that did not follow, **saved groups** ("סלון + מטבח") that start with one tap and show which rooms did not join, and "עצור מוזיקה" for a floor or an area. Groups of 4 or more rooms, or rooms on more than one floor, ask for a confirmation; the whole building needs `media.bulk`. A new permission `media.group` is needed to group rooms.
- **Safe by default**: there is NO default volume ceiling - a ceiling and a night window apply only where an administrator sets them per speaker; a static group's volume always goes room by room; an unmute never brings back a level above a ceiling set later; no announcements anywhere.
- **Settings › מולטימדיה** gained the players and speakers section (approval, name, room, linked amplifier, ceiling, night window), the merge wizard ("אחד" / "התעלם"), the folded non-physical entries (sessions, helper groups, services), saved groups, favourites and stations (order and hide), the connection status and the permissions line.
- **With and without Music Assistant**: it works through the platform infrastructure; a house without Music Assistant (Sonos, Cast, HEOS, WiiM natively) is a full citizen. Players and groups also appear in the area screen and in the home widget ("מנגנים עכשיו").
- **Review hardening**: group and static-group commands need control in every member's room, the generic device route refuses volume / power / play on any media device and on the sibling switches and selects of an approved speaker, a relative group volume never raises a quiet member, names of rooms you cannot see are never listed, list reads are rate limited per user, and an item reference is valid only for the user and the device it was listed for.
### Fixes
- A house without floors no longer asks for a confirmation on every join across two rooms; a multi-room pause no longer reports rooms that were not playing as failed.
- **Phone scrolling**: the multimedia screens page no longer jumps while you scroll (the sticky header used to fold and change the page height under the finger); the search popover no longer blocks scrolling (no full-screen layer, a press outside closes it, a page change closes it); overlapping drawers can no longer leave the page locked.
### Areas
- **Fold a floor in the building tree**: a chevron on every floor row folds and unfolds that floor's areas, a fold-all / unfold-all control sits beside "כל המבנה", the choice is remembered on the device, and picking a floor opens it again.
### Documents
- CR-016 and its API contract, the three anonymised live probes (Music Assistant, Sonos, HEOS, WiiM, Cast, Denon, Jellyfin patterns), user guide pages for players and groups.
### How to turn it on and use it (English)
1. **Restart the platform once** after the update (the bridge integration is 0.5.0). Migration 0044 is applied on the first start.
2. **Speakers, players and groups**: open "מולטימדיה" in the side rail, then the tabs "נגנים ורמקולים" and "קבוצות" (needs `media.read`; controlling needs `media.control` / `media.power`; joining rooms needs the new `media.group`; a group of 4+ rooms or rooms on more than one floor asks for a confirmation, the whole building needs `media.bulk`). Approve detected devices, name them, set a room and (optionally) a volume ceiling or night window in הגדרות › מולטימדיה; confirm or ignore suggested merges with "אחד" / "התעלם".
3. **Fold a floor in the building tree**: on the "חשמל והתקנים" screen on a computer, use the chevron at the start of each floor row; "כווץ הכל / הרחב הכל" is beside "כל המבנה". The choice is remembered per device.
4. **Phone scrolling**: nothing to turn on - update and reload the app (close and reopen the installed web app once).

## עברית — 0.1.150: מולטימדיה, חלק 2 · כיווץ קומות בעץ · תיקוני גלילה בנייד
### מה חדש
- **מולטימדיה: רמקולים, נגנים וקבוצות** – בלשונית "מולטימדיה" נוספו "נגנים ורמקולים" ו"קבוצות": כרטיס אחד לכל רמקול, נגן או מקלט פיזי (אותו מכשיר שנראה דרך כמה אינטגרציות מתמזג לאחד), בקבוצות לפי קומות. פאנל נגן עם תמונת אלבום, סרגל התקדמות, הקודם/הבא, ערבוב וחזרה, ווליום, "הבא בתור", מועדפים, תחנות ורשימות השמעה, וקיבוץ חדרים בזמן אמת. קבוצות שמורות ("סלון + מטבח") שמתחילות בלחיצה, וכפתור "עצור מוזיקה" לקומה או לאזור.
- **בטיחות כברירת מחדל**: אין תקרת ווליום כללית – תקרה וחלון לילה נקבעים רק לרמקול שמנהל מגדיר. קבוצות של 4 חדרים ומעלה, או חדרים ביותר מקומה אחת, מבקשות אישור; הבניין כולו דורש `media.bulk`. הרשאה חדשה `media.group` נדרשת לקיבוץ חדרים.
- **הגדרות › מולטימדיה** – אישור התקנים, שם, חדר, מגבר מקושר, תקרת ווליום וחלון לילה, אשף איחוד כפילויות, קבוצות שמורות, מועדפים ותחנות.
- **עץ המבנה**: חץ ליד כל קומה מכווץ ומרחיב את האזורים שלה; כפתור "כווץ הכל / הרחב הכל" ליד "כל המבנה"; הבחירה נשמרת במכשיר, ובחירת קומה פותחת אותה מחדש.
### תיקונים
- **גלילה בנייד**: מסך המולטימדיה לא קופץ יותר בזמן גלילה (הכותרת הדביקה שינתה גובה מתחת לאצבע).
- **חיפוש בנייד**: פתיחת החיפוש כבר לא חוסמת את הגלילה; לחיצה מחוץ לחלון סוגרת אותו, וגם מעבר מסך סוגר אותו. מגירות חופפות כבר לא משאירות את הדף נעול.
- בית בלי קומות כבר לא מבקש אישור בכל צירוף שני חדרים; השהיה בכמה חדרים כבר לא מדווחת כנכשלו חדרים שלא ניגנו.
- ביקורת אבטחה לנתיב הפקודות של המדיה: הגבלות קצב, מזהים לפי משתמש ומכשיר, ושליטה במתג/בורר נלווים רק דרך מסך המולטימדיה.
### איך מפעילים ומשתמשים
1. **אחרי העדכון הפעל מחדש את התשתית פעם אחת** (רכיב הגשר הוא 0.5.0). ההגירה 0044 מתבצעת בהפעלה הראשונה.
2. **נגנים, רמקולים וקבוצות**: בתפריט הצד "מולטימדיה" ← "נגנים ורמקולים" ו"קבוצות" (נדרשת `media.read`; לשליטה `media.control` / `media.power`; לקיבוץ חדרים `media.group`). את ההתקנים שזוהו מאשרים, נותנים להם שם וחדר ב-הגדרות › מולטימדיה.
3. **כיווץ קומות**: במסך "חשמל והתקנים" במחשב – החץ בתחילת כל שורת קומה, ו"כווץ הכל" ליד "כל המבנה".
4. **גלילה בנייד**: אין מה להפעיל – מרעננים את האפליקציה (סוגרים ופותחים את האפליקציה המותקנת פעם אחת).

## 0.1.149 (pilot) — Multimedia: screens and a remote; heating apart from air conditioning; what sits next to an area's name; hide a camera in the wall
**After the update restart the platform once**: the bridge integration is 0.4.0 (the media commands and their policy). Migrations 0040-0043 are applied on the first start.
### Multimedia (CR-015) — "מולטימדיה" in the side rail, for holders of `media.read`
- **מסכים**: one card per physical screen (the same TV seen through several integrations is merged into one; duplicates are linked, ignored or unlinked in הגדרות › מולטימדיה), grouped by floor with a large title, room chips, a floor menu, search and a state filter. Power, volume, mute and source on the card; **"כבה מסכים"** per floor with a short confirmation and a per-screen outcome; screens that are not confirmed on are skipped.
- **The remote**: a side panel on the desktop, a bottom sheet on the phone. D-pad or touchpad, back / home / menu, volume and channel rockers, playback, sources and apps, recent, "עוד מקשים" (numbers, colour keys, text). Only what the screen reports is shown; the key set follows the profile (Samsung, LG, Android TV, generic). No power key anywhere: power is always the explicit on / off. Hold-repeat on arrows and volume. States: off ("הפעל"), art mode, unavailable, no remote power-on, view-only, pending, not confirmed (8 s), rate limited.
- **Edit like the home screen**: from the user menu, order, favourite, size, visibility on desktop and phone, grouping and floor order; "לכולם" with `media.layout`, "רק אני" with `screen.personalize`. **"עריכת השלט"**: which sections show, order, folded keys, sources and apps order and names, per screen or as the default.
- **In the areas and on the home screen**: a media card in the area (one per screen, opens the same remote; "כבה הכל" includes screens confirmed on) and a home widget with the screens that are on.
- **Settings › מולטימדיה**: approve detected screens (one tap for all), display name, kind, public screen, profile, linked amplifier, default audio target, volume ceiling, extra keys; feature switch `multimedia.enabled`.
- **Permissions**: `media.read`, `media.control`, `media.power`, `media.layout`; sensitive `media.public` (change app / source / navigate on a public screen) and `media.bulk` (floor "כבה מסכים"). Custom roles holding `devices.read` gain `media.read`, holding `devices.control` gain `media.control` and `media.power`; the sensitive two are never granted automatically.
- **Safety**: every command through one server path with rate limits per user and screen; a managed screen is controlled only from מולטימדיה (the generic device action answers `use_media_screen`); the bridge re-checks every media service call (0.4.0). Players, speakers and groups follow in 0.1.150.
### Air conditioning and heating
- **"חימום" is its own group**: thermostats, heat pumps and water / floor heating (a climate that cannot cool) have their own card, counters and "כבה חימום"; "כבה מיזוג" never touches them; a per-entity override (הגדרות › חשמל והתקנים › מיזוג וחימום).
- **Temperature steps by one degree** unless the entity reports its own step; the entity's own range is honoured (a 45° target no longer snaps to 35°). A scheduled "on" picks a mode the entity offers. `heat_cool` reads "חימום/קירור". An entity without a name is named after its device.
### Camera wall
- **"מוצגת" per camera in סידור הקיר**: a hidden camera leaves the grid, the stream budget and the counter ("מוצגות 9 מתוך 12 מצלמות"), stays reachable from its own page, saved views and investigation; the kiosk follows the wall.
- "עריכת המסך הראשי" appears in the user menu only on the home screen.
### Video
- **"WebRTC only" is respected on every channel**: an explicit WebRTC choice (the installation default or your own) no longer falls back to MSE, also through the remote route (the player tries the other profile over WebRTC instead); a settings change reaches an open page within a minute.
### State sync (from 0.1.148, now on the systems that lacked it)
- The Home Assistant state sync tolerates an integration that reports `supported_features` as a list; one bad state no longer drops the snapshot.
### Documents
- A security review of the media command path was applied (per-device and per-user rate limits for every non-power command, no tokenised picture URL in the browser, identifiers shaped like addresses never merge devices, sibling switches/selects of an approved screen are controlled only from מולטימדיה, a linked amplifier needs its own control permission, a clear refusal code for the personal layout without `screen.personalize`).
- User guide chapter "מולטימדיה", settings and roles pages updated, CR-015 change request and API contract, WisKey native-integration Gate A findings and the Codex correspondence (docs/integrations/wiskey), the designer handoff package (docs/design/handoff), Music Assistant and TV remote research notes.

### Home screen
- **A calm area row**: the per-A/C chip lists (floor "מזגני הקומה", building "מזגנים בבניין") are gone. Each area row carries ONE air-conditioning
  indicator (snowflake / flame / fan by the dominant mode, dimmed when off, optional temperature or mode, the number working when several) followed by
  the counters worth a glance, on one line; a phone shows three and collapses the rest into "+N". An unknown temperature is hidden, never a dash.
- **Several A/C in one area**: "ממוצע" (default: mean of the running ones and their number) or "מוביל" (one unit's own temperature and mode; the unit is
  chosen per area in the editor - also in the personal editor, from the areas the user can see - else the first running one). **Open doors / windows and unlocked locks** show only while something is open / unlocked
  ("רק כשפתוח", per item). The item order is free (arrows); a dashed line in the editor marks the three a phone shows.
- **Editable** (הגדרות › חשמל והתקנים › "מה מוצג ליד שם האזור"): which items, in which order, what the A/C says, whether zero counters show, and the
  floor header's chips; new keys `devices.area_row` / `devices.floor_row`. A user with `screen.personalize` may choose their own (החשבון שלי › המסך שלי).
- The floor card's header chips stay on one line on a phone (scrolling sideways), and the floor action no longer slides out of the card.
- The devices tree now carries each area's own climate units, room temperature and open doors / windows (additive fields).
- `devices.show_climate_strip` is deprecated (accepted, no effect).

## 0.1.148.1 (pilot) — Hotfix: the embedded WisKey is whole again; a custom role may hold every permission
- **WisKey**: the 3 px edge crop of 0.1.148 cut WisKey's own content (with `chrome=none` its title, search and buttons touch the frame edge). The crop is withdrawn; the frame equals its stage again. The focus ring at WisKey's edge returns until WisKey ships the rc.38 change (docs/integrations/wiskey).
- **Roles**: the custom-role editor refused more than 20 sensitive grants ("List should have at most 20 items") - 28 exist. The body guards are wide enough for "select all" in both lists.

## 0.1.148 (pilot) — Three home screens and two area screens you choose and edit; narrow tab bars; the phone UI audited; the old design is gone
### Home screen (חשמל והתקנים)
- **Three directions, chosen in הגדרות › חשמל והתקנים › מסך ראשי**: א control centre (default), ב side panel, ג compact row. Every widget is
  editable: size (small / medium / large), order (drag, arrows), heading, on / off, and the entity that feeds it. Clock, weather (only the
  fields the chosen entity reports, forecast length by what it exposes, a field can come from another sensor), Shabbat (parsha, candle lighting,
  havdalah, Hebrew date and holiday each from its own sensor; the Hebrew date falls back to the browser), the alarm status card, quick actions.
- **On the phone** the widgets have their own layout (a snapping row, stacked, or two per row), their own size and an on / off per widget.
- **A personal screen**: users granted the new permission `screen.personalize` ("התאמה אישית של המסך שלי") may override the direction and their
  widgets for themselves (החשבון שלי › המסך שלי); without it nothing personal applies.
- The cards | tiles view choice moved into the user menu ("תצוגה"); the refresh icon sits beside the title.
### Area screens
- **Two directions** (הגדרות › חשמל והתקנים): dense tiles (default) and sequential sections; both fully editable (order, sizes, duplicate
  sections, headings) from the user menu's edit mode, with the card library, select all / none, delete with undo.
- **Main sensors** (temperature, humidity, motion, door) appear only when they exist; choose among all sensors, even ones not linked to the area.
  "כבה הכל" per section (lights and switches, blinds, air conditioning; media later) with an icon, a text or both.
- **A real navigation bar in the header**: home › floor ▾ › area ▾ - jump to another floor or area; the unclear chevron and the repeated floor name are gone.
- **A camera card chooses its stream**: אוטומטי / משני / ראשי.
### Tab bars
- Top-level bars are the narrow segmented pill of the security switch; the sub-tabs of לייב and חקירה stay underlined but compact. Configurable
  per level and per section (הגדרות › כללי › לשוניות › "סגנון סרגל").
### The phone
- A full phone audit (about 55 routes): the map's layers panel scrolls; the camera wall's controls are one compact row; the kiosk has phone
  layouts (1×1 to 2×3, opens on one column); Chrome's amber focus ring is replaced by one blue keyboard-focus ring; touch targets grow to 40-44 px.
- **אפשרויות נייד** (הגדרות › כללי): hide site / building / floor / plan management on a phone (on by default), the area editor, the wall
  arrangement, screens that create or delete, roles and permissions (off by default), and the "תמונות בקרה" export. A UX guard, not security.
### WisKey and shared spaces
- The embedded WisKey crops 3 px of its own edge so a focus ring inside it is not seen (the real fix is a WisKey change: the request is in docs/integrations/wiskey).
- **WisKey stations can be members of a shared space** (visibility only, for holders of access.read); deleting a shared room is one confirmation
  ("בטל שיתוף ומחק"), and a mirror floor explains where to delete.
### Standalone platform cameras (live)
- **A platform camera that is not an NVR channel can be shown live** on a camera card, per camera and only after you opt it in (the picker offers it): the stream is
  fetched through the platform's `stream_source` and served by go2rtc under the `smplwise_ha_` namespace, with the same slots and limits as the wall. If the stream
  fails the card shows its picture and tries again after a minute. Sources are checked against an address policy before go2rtc is given them.
  Only `rtsp` / `rtsps` sources are accepted (an http(s) source is refused; a camera that offers only HTTP stays a still picture).
- **After the update restart the platform once**: the bridge integration is 0.3.1 (the `stream_source` service).
### Other
- **The legacy design B is removed**; design A is the only design (the `ui.design` setting is still accepted and ignored).
- **State sync no longer stops on an odd attribute**: an integration that reports `supported_features` as a list (not a number) made the whole snapshot fail on every attempt, so the sync never connected ("לא מסונכרן") and entities showed as unavailable; such values are now tolerated and one bad state can no longer drop the rest.
- The bulk-safe checkbox (הגדרות › חשמל והתקנים › פעולה קבוצתית) shows the state it selects.
- Review hardening: widget sensors respect the viewer's scope; `/me/prefs` writes are all-or-nothing; layouts list only visible entities;
  shared-space membership and revocation fixes.

## 0.1.147 (pilot) — Schedules ("תזמונים", off until you turn it on); a camera card for area screens; the alarm tab is back in the security area; WisKey rc.37; your own navigation size
**After the update restart the platform once**: the bridge integration is 0.3.0 (the schedule service). Migration 0039 (schedules) is applied on the first start.
### Schedules (CR-014) - feature is OFF by default
- A new tab **"תזמונים"** next to "מבט על" in the home area, over the scheduler component of the platform: list as cards, a table or a week view, a 24-hour week grid and a table (from - to) for editing the same scheme, day view, phone timeline, conditions (presets "רק בשבת ובחג" / "לא בשבת ובחג" / "מוצאי שבת"), create from templates or in three taps, run now, enable / disable, copy, delete with a 30-day trash and restore, a review list. Turn it on in הגדרות › תזמונים.
- **Permissions you grant** (per user or role, scoped): `schedule.view`, `schedule.manage`, `schedule.sensitive` (alarm, locks, gates). An editor may change a schedule only when their scope covers every device in it. Editing a disabled schedule never turns it on.
- Alarm / lock / gate actions need the sensitive permission and an explicit confirmation; a panel code is never written to the component (an alarm action that needs a code cannot be scheduled yet).
- Known limit: anyone with access to the platform can also edit schedules directly in the component, bypassing these permissions; such schedules are shown as external and flagged for review.
- The scheduler's own switches no longer appear as ordinary switches in the devices area, tiles or bulk actions.
### Area screens
- **A camera card**: add a camera to an area (an NVR channel, or a platform camera that is an NVR channel), streamed through the same live path and limits as the wall; other platform cameras show a picture only. The card is offered in the card library of the layout editor.
- The layout editor got a card library (add any number of cards), select all / none in the entity list, delete a card (with undo).
### Security area
- **The alarm tab is back** in אבטחה (next to לייב | חקירה) whenever the platform has an alarm panel and you hold an alarm permission; the management stays in הגדרות › אבטחה.
### Navigation and screens
- **Navigation size** (הגדרות › כללי › "גודל הניווט"): four presets or free icon / label / item sizes, a system default and a personal choice.
- **Every screen's edit mode is an item of the user menu** (area layout, map, camera wall arrangement); the buttons left the screens.
- Home widgets are dashboard cards (small / medium / large); the status dot opens the health page only for users who may open it.
- The one-column camera wall on a phone fills the width.
### WisKey rc.37
- The embedded WisKey is opened with `chrome=none` (no border or padding of its own). Personal choices in החשבון שלי › WisKey: overview card count and camera wall size; defaults in הגדרות › מדיה.
### Hardening
- Request bodies are read before the write lock is taken on 37 routes; unshare and floor deletion in shared spaces are consistent on both floors; body limits hold for odd path spellings; refusal audit rows name the user and keep suppressed counts.
### Documents
- User guide page for schedules, settings pages for schedules, tabs, navigation size and the new options; the scheduler phase-0 checklist.

## 0.1.146 (pilot) — No top bar; a customisable home screen; the alarm and camera health move; tab order and visibility are yours; WisKey fills the screen; the NVR clock no longer reads an hour off in summer
### The shell (owner round 2026-09-30)
- **No white top bar in any screen** (design A). Search is a small icon button in the top corner (Ctrl/Cmd+K still
  works) and the system status is a small dot beside it (a banner appears only when something is failing). The
  breadcrumb is gone, and the security switch (לייב | חקירה) sits in the page header. The rail and the phone bar are
  smaller (touch targets stay 44 px). Entering an area shows one navigation, not two.
- The user menu has "עריכת המסך הראשי" for people who may edit the layout.
### The home screen (חשמל והתקנים)
- The title can be renamed in edit mode. Optional header widgets, all off by default: a clock, weather from a
  weather entity, and the parsha / Shabbat candle-lighting / Shabbat end from sensors you choose (read from the
  mirrored entities; no external service).
- The edit button left the page (it is in the user menu); refresh is one small icon and the sync chip appears only
  when the state is not fine. **Floor order is editable** (drag or arrows) and applies to the tree, cards and tiles.
- Summary tiles are compact with the icon beside the text. The tiles view shows the floors tree too and fits the
  screen without scrolling at desktop sizes.
### Security area
- **The alarm is now in הגדרות › אבטחה** (with the NVR summary and the alarm management). It is offered only when the
  platform has an alarm panel, and to holders of the alarm permissions even without general settings access;
  permissions are unchanged, and old links (search, alerts) redirect. **Camera health moved to חקירה.** The live
  "תמונת מצב" screen can be hidden (הגדרות › וידאו ומדיה).
### Tabs you control
- **הגדרות › כללי › לשוניות**: for every section (the bars, security, לייב, חקירה, the map, WisKey, Settings) show or
  hide each tab and set its order; a section lands on its first visible tab. A user's own order (personal) wins for
  that user. Hiding is presentation only; permissions still gate, and the way back to the editor cannot be hidden.
- **קומת ברירת מחדל במפה** (הגדרות › כללי › מפה): which floor the map opens first. The map's "התקנים" tab is now
  **הגדרות › קטלוג התקנים**, for administrators only.
### WisKey
- The embedded WisKey is the frame and nothing else: no strip above it, no refresh / enlarge / new-window buttons, no
  border of ours. New setting **גודל תצוגת WisKey** (הגדרות › מדיה): רגיל / מותאם (scaled 100-70%, so WisKey sees a
  bigger frame and shows more cards) / מסך מלא (covers the whole screen, Esc or the corner button leaves). A wall of
  10 cameras needs changes in the WisKey panel itself; the request is in docs/integrations/wiskey.
### NVR clock
- The NVR reports its wall clock (summer time applied) tagged with the standard offset; read literally it looked an
  hour ahead (+3599 s drift). Now read in the installation zone: the system screen and the setup wizard show no
  phantom drift. "סנכרן לשעון השרת" writes the same way and reads the clock back; when the device is more than 2
  minutes off it says so (502 clock_verify_failed, audited). That write has not been tried on a real device.
### Hardening (security review of this round)
- The entity catalogue's filter chips of a floor-scoped user show only what they may see, and the per-entity action
  history (who acted, error codes) is shown only to those who can control the entity or configure the system.
  Tab settings ids and size are validated. New settings: `ui.tabs`, `map.default_floor`, `ui.security_snapshot`,
  `ui.wiskey_size`, `ui.wiskey_scale`, `home.title`, `home.floor_order`, home widget entities.

## 0.1.145 (pilot) — "אבטחה" with the intrusion alarm; a new shell with the user at the end of the navigation; device tiles that open a panel; one room shared by two floors
**After the update restart the platform once**: the bridge integration is 0.2.6 (the alarm's arm modes and bypass
switches need its allow-list). Database migrations 0036 (alarm), 0037 (per-user interface preferences) and 0038
(shared spaces) are applied on the first start.
### אבטחה: לייב | חקירה | אזעקה (CR-010)
- Live and investigation sit under one "אבטחה" area with a new **אזעקה** section: the alarm panels found on the
  platform (Risco first), their partitions, sensors and bypass switches, arm / disarm from the screen.
- Code policy per panel: no code, the panel's own code stored **encrypted**, or a **personal PIN** per user. A
  lockout counts failures only (per user for PINs, persisted across restarts); one unsettled typed code per user
  and panel; a first PIN by panel code needs the disarm permission there.
- The alarm's controls are reached **only through the alarm section**: refused on the general device route, left
  out of bulk actions and of the bulk-safe list, and rows of alarm entities in the devices tree, area cards and
  item lists need `alarm.view`. A zone shared by several partitions needs every partition that lists it.
- New permissions `alarm.view`, `alarm.arm`, `alarm.disarm`, `alarm.bypass`. Guide page "אזעקה".
### The app shell (CR-013)
- **Phone: no top bar.** The bottom bar is ראשי · אבטחה · מפה · WisKey · the user; the desktop rail has the same
  order with the user at its foot. The user menu holds התראות · מערכת · החשבון שלי · יציאה; the bell is gone.
- "ראשי" is the default start screen. **The tab order is personal** and stored on the server (`GET/PUT /me/prefs`,
  `nav.order`), so it follows the user to every device.
- Tab rows scroll with snap and an edge fade; one status pill; Back closes an open sheet, panel or overlay before
  it leaves the screen; the alerts inbox works without `rules.manage` and counts only what the user may see.
### Devices (CR-007)
- A summary tile **opens a panel** that lists and controls its devices (keyboard, deep link, Back closes it); an
  **icon-only master control** acts on what the panel shows. Compact tile layout (`ui.tile_layout`, הגדרות › עיצוב
  הממשק › "פריסת אריחים" with a live preview); floor cards with lighter chips; the full camera list.
- **הגדרות › חשמל והתקנים › "פעולה קבוצתית"**: the bulk-safe mark of every switch is managed in one place
  (`GET/POST /devices/bulk-safe`). Eligibility for a bulk action is deliberately narrow.
- Tree rows: the area name gets the row, the count and the menu sit in fixed end columns. `sw-drawer` no longer
  bleeds scroll, closes on a drag or shows an empty footer.
### One room on two floors (CR-009)
- A double-height space (a sports hall with a tribune) is **one room shared by two floors**: an outline per floor,
  explicit members and explicit content, published from either floor, whole on the map and in 3D of both. No slab
  ring; the tribune rises through the upper floor's level.
- "חברים בחלל המשותף" in the room panel and on the live map, filtered per member by what the reader may see. A
  member reaches the room only while anchored on its floors; alarm controls are never members and a shared mirror
  gives no alarm reach; an alarm-managed switch cannot be taken by a circuit from the other floor.
### Remote access and hardening
- Remote requests are authenticated **before** the write transaction opens; request body size limits are enforced
  while the body streams.
- Backup export leaves every keep-on-this-installation settings key out; `alarm_zone_overrides` travels with a
  project backup; the start-up guard verifies the objects of migrations 0036 and 0037.
### Documents
- Design records CR-011 (second factor: sign-in policy, step-up, passkeys) and CR-012 (notifications in the Android
  app), each with a Hebrew mirror and open questions for the owner; findings note on door detection in real scans.

## 0.1.144 (pilot) — The camera wall from outside plays every camera and lets you choose the quality; a fair write queue for the database; the Android app's side of the add-on; the product is "Arx" everywhere
### Camera wall from outside (owner report, 2026-09-29)
- **Only 4 cameras played on the wall from outside, the rest said "שגיאה בזרם הווידאו"**: the remote live cap
  `remote.max_live_streams` of 0.1.142 defaulted to 4, and the installation cap `media.max_live_sessions` to 8. Both
  now default to **16** (a value an administrator saved is kept); when a cap still turns tiles into snapshots the
  wall says "מוצגות N מצלמות חיות מתוך M" and where the cap is set. A refusal by the cap is shown as what it is - "הגעת למכסת הזרמים החיים בחיבור הזה (N)" with where to
  raise it (or "פנה למנהל המערכת") - with no fallback walk and no retry.
- The wall streams **only the tiles on the screen**, within the budget; a tile that scrolled away releases its
  stream after 5 s and the next one takes it. Tiles beyond the budget show the camera's snapshot (refreshed as
  often as the snapshot cache allows, at most every 10 s, never while the tab is hidden), labelled "תמונה · לחץ לצפייה חיה"; a tap opens the single-camera view. On the LAN the same rule applies
  with the installation's own cap (a desktop where every tile fits looks the same as before).
- **Quality on the wall is your choice**: הגדרות › גישה מרחוק › "איכות בקיר המצלמות מבחוץ" (`remote.wall_profile`:
  רגילה = secondary stream, the default / גבוהה = main stream), and a quick switch on the wall itself
  "איכות: רגילה | גבוהה", remembered per device (with "ברירת מחדל" to follow the installation again), applied at once. A main stream that cannot be decoded falls back
  as in the single-camera view and the tile's badge says what really plays.
- Settings show "פעילים עכשיו: N" next to the cap and the hint "מומלץ: לפחות כמספר המצלמות בקיר". Note: the wall
  shows `ui.wall_count` cameras (default 4) - choose a larger layout in the wall's toolbar for more.
### Database: a fair write queue (round-10 "database is locked" storm)
- One queue per database file in front of every write (first come, first served, also after waiting more than a
  second), one 10 s budget shared with SQLite's own wait, and no device or network call while the write lock is
  held - checked by a guard over 450+ tests. Found and fixed on the way: a manual commit kept the lock while a door
  was being released and the release's outcome row was lost; plan and picture uploads could freeze the event loop
  for up to a minute; on the remote channel a request validated its sign-in against the platform while holding the
  lock (now resolved from memory, or with the lock given up - structurally, not by prediction).
- Mirror writes that the device sends again (entity states, derived events) are written without a disk sync per
  commit; anything a person did, every alert, rule firing and audit row is always synced. The state history may lose
  about the last 30 s on a power cut.
- New add-on option **`db_write_gate`** (default on; turn it off to return to the previous behaviour). `/health`
  shows the queue (`gate_timeouts`, `waits_over_1s`, `max_wait_recent_s`). Measured under load with a slow disk
  emulated (the workstation was busy, so the absolute numbers are inflated; both runs under the same load): worst
  wait 1.64 s with the queue against 4.98 s without, waits over a second 0 against 68, no "database is locked".
### Android app (own WebView, 2.0.2) - the add-on's side
- Inside the app the site shows "החלף שרת" in the user menu, on the sign-in page and in הגדרות › גישה מרחוק, hides
  the install banner and tells the truth about push notifications (not available inside the app yet). The app
  itself lives under `mobile/android-shell/` (plain Kotlin, no Google services); two Opus security reviews, all
  findings fixed; guide `docs/operations/ARX_ANDROID_SHELL_HE.md`.
### Name
- Leftovers of the old name are gone from the screens: the role reads "מנהל מערכת", the bridge is "הגשר" outside
  Settings and "גשר Arx" inside, "SMPLWISE" as the product is "Arx". The company wordmark and every technical
  identifier are unchanged.

## 0.1.143 (pilot) — Plan Studio: stairs between floors, stairs with a landing (straight / L / U), floor height; detector 1.4; the guide with live screenshots
### Stairs between floors and stairs with a landing (owner priority 1)
- **One picker "מחבר אל"** on a connector lists this floor's other levels and every level of every other floor of
  the building ("קומה 1 · גלריה"): stairs (and a ramp, an elevator, a ladder) now lead to a chosen level on another
  floor. The other floor gets the same stairs as a **twin** walked from the other side (path and flights reversed,
  label "↓ קומה 0 · …"); it keeps the coordinates when both floors share a frame, else it is placed at the plan's
  centre with "מקם את המדרגות בקומה הזו". Moving one twin never moves the other; a change of the stairs' model
  reaches the twin on save and marks it **"ודא את המיקום"** with an "אישור מיקום" button (a warning, never a publish
  block). Deleting asks "למחוק גם בקומה השנייה?". The library's "מדרגות ישרות", "מדרגות עם פודסט" and "מעלית" now
  place connectors; stairs objects already on plans stay as they are.
- **Stairs with a landing**: shape straight / L / U (half turn), turn side, one or two flights (1-60 steps each),
  landing depth, width 0.6-5 m; L and U are placed with two clicks. 2D follows the architectural convention - a
  line per tread, the landing as a plain rectangle, the walking line with a start dot and an arrow, the break line,
  the caption "12+12 מדרגות · פודסט". 3D: each flight rises step by step, the landing is a plate at the height
  where the first flight ends, and a floor's plate is cut open (one opening per flight / landing) where stairs go
  down, so the descending twin is visible.
- **Floor height**: new field "גובה קומה (רצפה עד רצפה, מ׳)" in מפלסים ומחברים (`floor_height_m`, default 3.0,
  2.2-12, in the floor's plan document - no migration). The rise of stairs between floors = the heights of the
  floors between + the target level's elevation - this level's elevation; a missing floor number counts the
  default height (up to three in a row, beyond that one default height and a warning `floor_numbers_gap`). The
  building page spaces the floor plates by it and draws a line between twins (published structures).
- **Permissions** (review blocker, closed before release): linking, re-linking, syncing and deleting a twin need
  `map.edit` on every floor the connector touches; a re-link from a twin is refused ("קשר מחדש מהקומה המקורית"), a
  re-link that removes a twin asks first, every removal is audited; an editor without the right on the other floor
  is told "המדרגות בקומה X לא עודכנו" and both floors carry the warning `connector_twin_model`. The other floor's
  names and heights are shown only to readers of that floor. An editor open on the other floor keeps its unsaved
  edits when a sync arrives (rebased once, undo history included).
- Known limits: the SVG / PNG export still draws stairs as a plain band; floor numbers are expected to be
  consecutive; the building page shows published links only.
### Automatic detection 1.4 (tuning items 3-6 from the owner's real scans)
- Four new rules, each a checkbox in the detect panel, on by default: **section lines** (a stroke that crosses a
  wall or an opening in it and runs out of the building is dropped), **short gaps** (a gap under 0.3 m between two
  collinear pieces of the same kind becomes one wall, no false passage), **tribunes** (proposed as a stepped
  tribune object with its rows), **pier grids** (regular rows of square piers proposed as column objects, the
  facade line between them as exterior walls; a thick wall with a regular window rhythm is NOT a pier grid).
  Object candidates are drawn dashed and accepted together.
- On the owner's three scans (local, counts only): floor -2 envelope recall 0.32 -> 0.56 with 7 columns, floor 0
  two tribunes, floor -1 fewer fragments. Known limit: the scans' own section lines stop about 0.45 m short of the
  envelope and are kept as walls (a fence or a railing near a wall is never dropped - the safer rule); doors on
  scans are still mostly not found. A browser running a cached frontend from before this version receives the
  new `objects` candidates but does not draw them - reload the Plan Studio page after updating.
- Also: the history / event 3D scene is rebuilt only when what it reads changed.
### Guide
- The Hebrew user guide carries live screenshots (23 of 27 screens; floor plans and place names are demo /
  generic) and one browsable page `docs/user-guide/he/GUIDE_ALL_HE.html`.

## 0.1.142 (pilot) — Remote access hardening (CR-008 P2): sessions, sign out everywhere, live-stream cap, strict CSP report-only; installed-app polish
### Remote access hardening (CR-008 P2)
- **Sessions**: every remote sign-in (cookie or bearer) is a session you can see - הגדרות › גישה מרחוק shows your own
  sign-ins (hashed id, address masked to /24 or the Cloudflare country, browser family, cookie / bearer, the current
  one marked); administrators with `system.configure` see everyone's. End one, **"התנתק מכל המקומות"** for your own,
  or all of one user's (admin). A revoke closes that sign-in's WebSockets before answering, a refreshed token of the
  same sign-in is refused afterwards (migration 0035, survives a restart), and a sign-in racing the revoke is refused
  too. Ending your own sign-ins also deletes at the platform **only the refresh tokens Arx itself issued** (never a
  long-lived token or another app's), all deletions capped at 8 s; an admin's revoke ends Arx access only. New
  avatar menu with "הסשנים שלי" and sign-out here / everywhere.
- **Roles screen**: the remote flag, last remote sign-in and active sign-ins per user; switching the flag off warns
  "N כניסות פעילות ייסגרו" and closes them at once. **Audit**: filter by channel (local / remote / bearer) with quick
  views "כניסות מרחוק" and "סירובים מרחוק"; revoke rows carry the channel of whoever revoked.
- **Live-stream cap** per remote sign-in (`remote.max_live_streams`, default 4): the next start gets 429 with a
  Hebrew message on HTTP, a message + close 4429 on the WebSocket; counts in `/health`; refusals audited at most
  once a minute per sign-in. LAN / Ingress unchanged.
- **Stricter CSP in report-only** next to the enforced policy; reports go to `POST /csp-report` (rate-limited,
  size-bounded, counters only, host:port only); a settings switch enforces it - disabled with an explanation while
  inline-style reports exist (the live camera's zones view moved its styles into the component; a test now forbids
  inline `<style>` elements in the app). A route's own CSP (evidence files' `sandbox`) is appended, never replaced.
- An idle remote session (unused > 3 min) is re-checked against the platform before its first request - one check in
  flight per session, and while the platform is unreachable no retry for 30 s (the session is kept until its access
  token expires, at most 30 min). Pen-test checklist: `docs/operations/ARX_REMOTE_PENTEST_HE.md` (not yet run).
- Tests: `test_remote_hardening.py` 38 + remote 59 + push 12; Playwright Arx remote + sessions 7 (desktop); Opus
  security review (4 medium + 7 low fixed) + scoped re-review.
### Installed app (PWA) polish
- Manifest: maskable 192 px icon and shortcuts ("צפייה חיה", "התראות"); safe-area insets on the top bar, side
  rail, bottom navigation, the Arx sign-in / idle-lock screen, dialogs and the offline page (iPhone notch and home
  indicator in the installed app); the iOS install guide, the update notice and the push hints were verified as
  already correct. PWA spec 17 (desktop + mobile), Arx spec 11, screens 64.
- **Service worker fix**: an iframe navigation on the app's own origin (the embedded WisKey panel) was answered from
  the app-shell cache; only the top-level document is now served that way.

## 0.1.141 (pilot) — Hotfix: Arx sign-in on today's Home Assistant releases (no PKCE yet); remote video policy (main over WebRTC first, NVR codec check); the UI no longer names the platform outside Settings
### Hotfix (owner's first live sign-in at `/arx`, 2026-09-29)
- **Sign-in failed with "Message format incorrect: not a valid option at 'code_challenge'"**: the Arx login page
  started HA's `/auth/login_flow` with PKCE (S256), as HA core's *dev* branch accepts - but **no released Home
  Assistant has PKCE yet** (it landed in core on 2026-09-26, home-assistant/core#181957, so 2026.10 at the earliest);
  2026.9 answers that exact 400, 2026.8 and earlier "extra keys not allowed @ data['code_challenge']". The page now
  starts with PKCE, and when HA refuses it (either text, or any other 400 on the first start) retries **once**
  without it, remembers the answer for the page (never a loop), and the token request then omits `code_verifier`
  (an HA with PKCE refuses a verifier for a flow without a challenge). On an HA with PKCE nothing changes.
- The fake HA cores of the test suites got a "no PKCE" mode with the real error text: backend
  `test_remote_access.py` 59 (2 new), Playwright Arx spec desktop 6/6 (1 new); tsc / build clean. CR-008 §8.1 records
  the correction to V1 (the schema was read from `dev`, not from a release).
### Remote video policy (CR-008 step 6, owner decision D7)
- **Main over WebRTC first, from outside**: on the remote channel every live player walks a ladder -
  `remote.default_profile` (main) over WebRTC; then, with `remote.mse_fallback` on, the same profile over MSE; with it
  off, the other profile over WebRTC; and at the end the message "הזרם הראשי אינו ניתן לפענוח ב-WebRTC - ראה הגדרות ›
  וידאו". A WebRTC step is judged by its RTP statistics, not by a timer alone: bytes arriving with no decoded frame
  for the stream's GOP + 3 s (6-20 s) is a decode failure and moves down the ladder; no bytes for 30 s is a
  connection failure (UDP blocked); **decoded frames always count as working**, even before the `playing` event
  (deferred autoplay) - a refused autoplay (iOS Low Power Mode) shows "הקש להפעלה" instead of waiting forever.
  A hidden tab is never judged (the clock restarts when the tab is visible again, also after the phone froze the
  page), the watch's listener never outlives its connection, and a browser without the frame counter is judged by
  the picture. The badge reads "מנסה main·WebRTC…" while trying and `main·WebRTC` / `sub·WebRTC` / `main·MSE` once
  it plays; go2rtc down says so at once. LAN / Ingress behaviour unchanged; the camera wall and map tiles keep their
  own (sub) profile remotely - to confirm with the owner.
- **NVR codec check** (read-only `GET /ISAPI/Streaming/channels` during discovery): codec, profile, SVC, smart codec
  and B-frames per stream, stored in the camera capabilities with a verdict ok / no / unknown. From the lab probe
  (seven cameras H.264 with **SVC on** in the main stream, three H.265) H.264 + SVC counts as not WebRTC-safe next to
  H.265, MJPEG and B-frames - an inference to confirm in the lab (switching SVC off on the main streams is the owner's
  check). Shown in הגדרות › גישה מרחוק (summary → health detail), the health card `video_webrtc`, the camera
  capabilities, the wizard's NVR step, and `/health.video_codecs`. A recording track's Description alone never says
  "plays".
- Tests: backend `test_stream_codecs.py`, Playwright `evidence-remote-video.spec.ts` 30/30 (15 desktop + 15 phone;
  the browser's WebRTC / MSE are faked - real media is the lab check); three Opus review rounds (M1-M3, F1-F4 fixed).
### The system no longer says "Home Assistant" outside Settings (owner rule, 2026-09-29)
- **Rule** (`docs/design/UI_COPY_RULES.md`): user-facing text never names Home Assistant / HA / Supervisor / Ingress /
  add-on / Companion except inside הגדרות › מערכת (connections, bridge, health diagnostics, wizard, remote access,
  notifications) where the technical truth belongs; installers' docs may name it. Vocabulary: "תשתית המערכת" for the
  platform, "ההתקנים" for its entities, "מסונכרן" / "רענן" for sync state, "האפליקציה" for the Companion app, or the
  mention dropped where the sentence reads without it. The Arx sign-in page asks for "שם המשתמש והסיסמה שלך".
- ~212 strings in 55 files (32 frontend screens / shell / API files, 16 backend routers, services and their tests),
  including the NVR-less 409 message and the top-bar health summary; **no identifier, route, JSON key, enum, audit
  action name or error code changed** - copy only (Sonnet review, 5 items fixed). Tests: tsc / build clean, screens
  spec 32/32, backend touched modules 322/322 + 5 Playwright specs updated.
- Follow-up noted (not fixed here): the WisKey embed spec's iframe route stub does not get along with the PWA service
  worker at scope `/` in the dev harness; the screens themselves are unaffected.

## 0.1.140 (pilot) — Arx from outside: `/arx` with our own sign-in against Home Assistant, install as an app, push notifications (CR-008 P1 + P3)
### Remote access (CR-008 MVP)
- New add-on options **`remote_access`** (off by default) and **`remote_path`** (`/arx`). With it on, the add-on also
  answers on `https://<host>/arx` through the customer's Cloudflare tunnel - never through Ingress: the request is
  marked as the **remote channel**, every Ingress / identity / developer header is dropped, security headers are set
  (CSP, frame-ancestors same-origin for the WisKey embed, referrer and permissions policies), and anything that
  changes state must come from our own origin (`Sec-Fetch-Site` / `Origin` check, else 403 - a same-site CSRF hole
  found in review and closed before release). The bridge's unauthenticated signed routes answer 404 remotely.
- **Sign-in screen of Arx** (RTL, the product's design, phone and desktop): username and password of Home Assistant,
  the MFA code step, HA's own error texts - the flow is HA's `/auth/login_flow` + `/auth/token` with PKCE on the same
  origin (verified against HA core's source; the fakes refuse the same keys HA refuses). The password goes to HA
  only and is never stored by us. Arx keeps an opaque **session cookie** (`__Secure-arx_session`, scope `/arx/`, 256
  bit, renewed at every exchange, the old one ended), validates the HA token against HA core and re-checks it every
  60 s (a revoked token or a deactivated user is out within a minute), and maps the HA user to the **same roles and
  permissions as inside Home Assistant** - nothing more, nothing less; no first-admin bootstrap from outside.
- **Who may come in from outside**: by default only users with the per-user flag **"גישה מרחוק"** (roles screen);
  the setting `remote.policy` can widen it to every user with an Arx role. Session policy `remote.session`:
  rolling 90 days (default), browser session, or 90 days with an idle lock (`remote.idle_minutes`). MFA can be
  required for administrators (`remote.require_mfa_admin`, off). Rate limits per address and per user, audit rows
  `auth.remote_session.*` (ids only, `channel: remote` on every remote action), the client address taken from
  Cloudflare's header only.
- **One sign-in for WisKey too**: after signing in to Arx the same HA sign-in is handed to the embedded WisKey panel
  (HA's own token store on the same origin), so it opens signed in. In browser-session and idle-lock modes the
  hand-over lives only while an Arx page is open. Note: the browser is then also signed in to Home Assistant at `/`
  with that user's own permissions. Sign-out revokes the refresh token at HA and clears both.
- Remote users can do everything their roles allow, **including Home Assistant device actions** (the electricity
  use case), audited with the channel. Video policy for the remote channel (`remote.default_profile` main / sub,
  `remote.mse_fallback`) ships with the settings; the player's remote behaviour and the NVR codec check follow in the
  next release.
- Settings tab **"גישה מרחוק"**; owner's setup guide `docs/operations/ARX_CLOUDFLARE_GUIDE_HE.md` (dedicated Arx
  domain, second tunnel, path route `/arx` first). Migration 0033 (the per-user flag). Tests: `test_remote_access.py`
  57 + 216 in the touched set, Playwright 10 (desktop + phone); two adversarial Opus security reviews (1 blocker +
  4 medium fixed).
### Install as an app and notifications (CR-008 P3)
- **Arx installs as an app** (PWA): manifest and icons, "התקן את Arx" banner, an iPhone add-to-home-screen guide, an
  update notice when a new version is live, a Hebrew offline page. The service worker is scoped to the app's own base
  (the Ingress path today, `/arx/` outside), caches the app shell only (never API calls, never video, never `/auth`),
  and its cache is named after the add-on version so nothing stays stale after an update.
- **Push notifications** (Web Push, works inside Home Assistant and from outside): settings tab **"התראות"** per user
  - categories (rule alerts, door / lock events, device faults, system health), quiet hours (critical passes), a test
  button, the list of this user's devices (up to 10). When a rule fires, after the commit, a separate worker sends
  to the subscribed users **who may see that camera or area** (the same reach rule as the alert list, re-checked
  before every retry), at most 10 per minute per user, retries with backoff, gone endpoints removed; the payload is
  a title, one line, a deep link and ids - no tokens, no pictures. Only the known browser push services are ever
  contacted. The keys (VAPID) are created once per installation and never logged; administrators can rotate them
  (all devices then re-subscribe on their next visit). Home Assistant backups carry the key and the subscriptions -
  documented. No new Python dependency: the standard's encryption is implemented with the library already present and
  checked against the standard's published test vector. Migration 0034. Tests: `test_push.py` 12 (×10 runs), 123 in
  the touched set, Playwright 18 (desktop + phone); Opus security review (4 medium fixed) + re-review APPROVED.
- Not yet tried on a real phone through a real push service - that is the owner's first check after installing.

## 0.1.139 (pilot) — The product is now **SmplWise Arx**; WisKey "הגדל" mode and an experimental Companion-app embed; CR-008 remote-access plan
- **Name**: the product is called **SmplWise Arx** (short "Arx") - the add-on title and panel, the wordmark in the
  shell, the Lovelace card title, the documentation and the Hebrew guide. Display names only: the add-on slug
  `smplwise_vms`, folders, API routes, settings keys, the bridge domain, stream names and data paths are unchanged, so
  the update installs like any other and nothing moves.
- **WisKey overview shows 4 cameras although 12 were chosen** (owner report): WisKey sizes its cards per page from the
  frame's height in fixed steps (under 800 px → 4, under 880 → 8, else 12 - in its own source) and keeps the choice in
  memory only; our frame already fills the space, but the app's top bar, tab row and embed bar leave it under 800 px
  on a 900 px screen. New **"הגדל / צמצם"** in the embed bar (desktop, remembered per browser): the embed covers the
  app chrome (below the system alert banner; Esc leaves; the covered shell is inert) - 8 per page at 1440×900, 12
  on a 1080p screen. A request to honour and persist the user's choice is written for the WisKey developers
  (`docs/integrations/wiskey/WISKEY_FOLLOWUP_REQUESTS.md`).
- **Companion app embed (experimental, OFF)**: הגדרות › בקרות כניסה › "הטמעה גם באפליקציית Companion (ניסיוני)"
  (`access.phone_embed`). When on, inside the Companion app the WisKey frame is signed in through the app's own
  bridge on the top window (the frame gets a proxy to that bridge, tokens are forwarded only to our same-origin
  frame, never logged or stored, the app's message bus is not relayed; wrappers exist only while a frame is
  attached); if the proxy cannot be installed in time the tab falls back to the 0.1.123 behaviour ("פתח ב-WisKey").
  Tested only against a fake bridge - not yet on a real phone; leave it off until the owner tries it. A phone
  browser embeds normally, as before. Two Opus security reviews.
- **CR-008 plan recorded**: `docs/changes/CR-008-ARX-REMOTE-APP.md` (+ Hebrew) - Arx at `https://<host>/arx` through
  the customer's Cloudflare tunnel with our own login against Home Assistant, the fastest path to a working
  environment, phases (MVP → hardening → PWA + Web Push → native wrapper) and the owner's decisions (§7); task T092.
- Tests: rename - release / card / settings 12, screens spec 32/32 (30 evidence captures refreshed), tsc / build
  clean; embed - connector unit 14, embed + phone specs 72 passed across three viewports, relay tests ×3; docs drift 0.

## 0.1.138 (pilot) — Runs without an NVR: "מצב ללא NVR" for electricity-only installations (owner request)
- Owner request (2026-09-29): "bring the system up without an NVR, in case I want it only for electricity control".
  With `nvr_host` empty in the add-on options the add-on starts in **`ha_only` mode** (derived from the options on
  every start, never stored; shown in `/me`, `/health` and the wizard): no NVR background work at all (no
  discovery, alert stream, thumbnail / export workers or storage warm-up - one INFO line says why), health reports
  the NVR as **"לא מוגדר"** (neutral) and stays green when Home Assistant is fine - and goes red when HA is missing
  or disconnected, because HA is the product in this mode; the setup wizard shows the NVR and camera steps as
  **"דילוג - מצב ללא NVR"** and "מוכן לעבודה" is reached with the remaining steps (go2rtc counts when it is
  configured or when WisKey is set up); the navigation shows only מפה / חשמל והתקנים / WisKey / מערכת (both designs
  and the phone bar); a direct link to a hidden area shows a "מצב ללא NVR" panel pointing at the options; every NVR
  route answers 409 `nvr_not_configured` - after its own permission check, so 401/403 and their audit rows are
  unchanged; the Lovelace card falls back to the map; settings show a neutral notice instead of the video forms;
  the storage screen shows the local disk; the map draws no cameras; leftover camera events get no thumbnails.
  Adding an NVR later: set the options and restart - tested full → ha_only → full on the same data, no migration.
- Before this, an empty `nvr_host` left the health report red forever, the top-bar pill on "יש מה לבדוק", the
  wizard's NVR step "נכשל", three workers running for nothing (one logging every 8 minutes), every camera area in
  the navigation with "configure the NVR" empty states, and two 503s each time "חיבורים" opened.
- Test and dev environments keep FULL mode by default (outside the add-on a missing host becomes a labelled
  placeholder, never given credentials, unless `SW_MODE=ha_only`; inside the add-on the options alone decide) - so
  the existing evidence specs and the dev loop are unchanged. Docs: `DOCS.md` + Hebrew mirror ("מצב ללא NVR": how
  to install for electricity only, what is hidden, how to add the NVR later), `docs/operations/NVR_LESS_MODE.md`.
- Tests: `test_nvr_less.py` 54 (start-up without NVR, no threads, health, wizard, 409 after permission, mode flag,
  switching modes), 240 in the touched set; Playwright `evidence-nvr-less` 18 (desktop + phone); existing specs
  re-run unchanged; tsc / build clean. Opus review (2 medium fixed) + re-review APPROVED.

## 0.1.137 (pilot) — Plan Studio detector: thin hollow exterior walls (T087, the parked prototype made safe)
- The owner's scans draw exterior walls as two thin parallel lines with white between; the detector missed them
  (exterior coverage on floor 0 was 0.00). A second pass, **`hollow_v1`**, now finds them: two thin strokes (≤ 5 px and
  thinner than the plan's median solid wall) at a spacing learnt from the plan (0.12-0.6 m), nothing as dark as the
  line cores between them, at least 1.5 m, on the two main axes, linked to a solid wall or turning a corner; stair
  treads, tribune railings, opening face lines and hatched or furnished pairs are rejected. Two solid walls 0.75 m
  apart (the T-junction fixture that parked the prototype) are never merged.
- **Never on a solid-wall plan** (review finding: counters and wardrobes 0.5 m deep read as exterior walls): a
  plan-level gate emits hollow walls only when they cover ≥ 25 % of the building box's perimeter and turn a corner,
  with no solid wall just outside them; otherwise nothing changes and the detect summary says why. A hollow
  candidate replaces a solid detection only when that detection is itself outline-only; windows found on replaced
  pieces are carried over (real-floor windows unchanged: 7 / 8 / 3). Bounded time: bisect lookups, deadline checks
  every 256 strokes, the pass skipped above 1,500 thin strokes.
- **On by default with an opt-out**: the detect dialog has "קירות חלולים (חיצוניים דקים)" checked; the API takes
  `hollow_walls: false`. Each wall carries `hollow: true/false` (schema-compatible; the editor may style it later).
- Owner's real plans (floors 0 / -1 / -2): exterior coverage by walls marked exterior 0.00 / 0.26 / 0.00 →
  0.66 / 0.49 / 0.00 (floor -2's envelope is faint glazing and single lines - gated off), 25 hollow walls of which 18
  on the envelope, +0.8-1.8 s per plan. Known limits (triage §6): one spacing per plan, two axes only, a hollow
  facade on one side only is not taken, a fence 0.6-0.9 m outside the envelope blocks the gate, very close pairs with
  light grey fill still read as hollow.
- Tests: `test_plan_detect_hollow.py` 8 + detector set 110, synthetic metrics identical for solid walls / doors /
  windows; tsc clean. Opus review (1 blocker + 3 medium fixed) + scoped re-review APPROVED.

## 0.1.136 (pilot) — Device control: click enters the area, empty domains hidden, per-device tile layout (CR-007 6c, owner requests)
- **A click on an area opens it** (owner: "a click opens a tooltip and then I have to click 'פתח אזור', and the tooltip is
  sometimes hidden"). In the tree and in the floor cards a click on an area row goes straight to the area screen;
  hovering the row (or reaching it with the keyboard) shows the summary popover with the counters and the quick
  actions; on touch screens the row's "⋯" opens it. The popover is drawn above everything, stays inside the screen
  (opens upward near the bottom edge) and closes on Escape, a click outside, scrolling or a resize. A click on a
  floor card's title opens the floor.
- **Empty domains are not shown** (owner: "no need for a covers tile or a climate card where there is none"): the
  building counters, the lit count where there are no lights, the area's domain cards, the quick actions and the
  per-area pill icons appear only for domains that have at least one entity (unavailable entities still count as
  present). A card hidden because it is empty keeps its saved place in the layout; the others close the gap and it
  returns to the same place when the domain appears.
- **Per-device tiles** (owner decision 1.א): in edit mode, a card opens **"סידור התקנים"** - tiles are dragged or
  moved with the arrows, Shift+arrows change the width (one or two columns), H hides, a side panel sets width, size
  (s / m / l), a custom title (text only) and hidden; "אפס סידור" per card; tile controls are inert while arranging.
  On the phone the order comes from the desktop layout with every tile full width, and can then be arranged
  separately. Layout schema `v:2` with a `tiles` map per card; `v:1` layouts load and save unchanged (no migration);
  order unique per card, width bounded by the card's columns, at most 200 tiles, hidden tiles still counted in the
  pills. A card being arranged that loses its last device (a structure refresh) returns to the cards with a note.
  Documented in `docs/design/DEVICE_THEMES.md` §8 and the user guide.
- Tests: `test_device_layouts.py` 13 (5 new) + devices 57 in the set; Playwright desktop + phone 32 passed (6b, 4 new 6c,
  4 new feedback tests); tsc / build clean. Sonnet review APPROVED_WITH_NITS (two small fixes applied).

## 0.1.135 (pilot) — WisKey embed: no dark edge around the panel (owner report)
- Owner screenshot (WisKey rc.25 embedded, 0.1.127 adapter - one toolbar, as intended): a dark line along the right
  and bottom edges of the embedded panel. Cause (`screens/wiskey-embed.ts`): the panel's box and its overlay used the
  app's neutral canvas colour (`--sw-bg`, darker than the white chrome around it) and the iframe carried its own
  360 px minimum height on top of the stage's, so any gap between the frame and its box (load, rounding, a short
  viewport) showed the darker canvas as an edge. Now the stage, the frame and the overlay paint the surface colour,
  the frame is `display: block` with no outline and no minimum of its own, and the 360 px floor lives on the stage
  only. The embed spec asserts the frame's box equals the stage's (±1 px), zero border, no outline, surface colour
  behind it (desktop + mobile). No change to widths - the "clipped" left side in the screenshot was the screenshot's
  own crop.

## 0.1.134 (pilot) — Plan Studio: the "סמן דלת" tool (T087, door-study recommendation א)
- In the editor's structure mode, **"סמן דלת"** (key D): one click on a door symbol in the plan picture proposes a
  door - the wall it sits in, the position along it, the width (from the gap when there is one, else from the leaf
  or arc found around the click at upload resolution, else 0.9 m), the hinge side and the swing - as a dashed ghost
  with three handles (width, hinge flip, swing flip) and a note ("נמצאה קשת" / "נמצא פער" / "ברירת מחדל - בדוק").
  Enter or a click accepts, Esc cancels, the next click accepts the current one and proposes the next; the result is
  an ordinary opening (one undo step, publish, 3D). A symbol with no drawn wall gets a short wall piece of its own
  (tagged `origin: door_tool`, snapped to nearby wall ends, editable and deletable); a click with neither symbol nor
  wall is refused with a message. Re-clicking an accepted door selects it instead of stacking a second one. Pressing
  D during a wall draft keeps the draft.
- Server: `POST /plan-versions/{id}/door-proposal` (`map.edit`, normalised x/y + optional wall id) analyses a bounded
  crop of the stored raster in its own single worker with a 5 s cap - a running detection of another user cannot
  delay a click; nothing is stored, no image leaves the server; diagnostic fields only with `?debug=1`.
- On the owner's three real plans, one click in the middle of each sampled symbol, no adjustment: **10 of 24
  doors right** (floor -2: 6/8), two more with one handle; toilet-block and V-shaped doors still need the handles.
  Speed on those scans 279 → 179 ms per click after the review's optimisation (doubling dilation, hinge search
  limited to the click's neighbourhood). Automatic detection is unchanged; the door study is recorded in
  `docs/evidence/T087/DOOR_MODEL_STUDY_2026-09-29.md` §6.
- Tests: `test_plan_door_tool.py` 31 (the three drawing styles, gap only, nothing found, own wall piece, pinned
  perpendicular wall, uncalibrated plans, a table that is not a door, deadline, busy pool, 404/422/504,
  permission), plan backend set 282; unit-door-tool 8 + determinism baselines 0 px different; evidence spec (click →
  ghost → adjust → accept → undo/redo → publish → 3D; re-click selects). Opus review (2 medium + performance fixed)
  + scoped re-review APPROVED. Documented in CR-003 and `docs/user-guide/he/21-plan-studio_HE.md`.
- Also in this release: WisKey rc.25 handoff recorded (contract v1 unchanged - the adapter of 0.1.127 stands; the lab
  checklist now says rc.25); every Hebrew document carries a `Source:` header (39 originals, 20 mirrors, 0 drift).

## 0.1.133 (pilot) — A real setup wizard (T071); role bindings per camera and session downgrade (T055)
- **הגדרות › אשף התקנה** (`#/system/wizard`, system administrators) replaces the demo-only wizard: six steps -
  **התקנה** (database answers, `/data` writable with ≥ 512 MB free, a system administrator exists, identity source,
  time zone), **NVR** (model and firmware, channels online / offline, main + sub tracks, video profiles, clock drift
  against the add-on, the NVR's UTC offset against the installation's zone - a wrong DST rule fails the step),
  **Home Assistant** (connection and version, bridge paired and loaded, whether an HA restart is still pending after
  a bridge update, HA clock and zone, the NVR ↔ HA clock gap), **go2rtc** (version; the `smplwise_` streams against
  what the cameras need; other products' streams are only counted, never named), **קומה** (at least one floor with
  a published plan), **מצלמה** (at least one camera placed). Each failure comes with a Hebrew explanation, the next
  action and a link to the screen that fixes it; clock drift ≤ 2 s is fine, ≤ 30 s a warning, beyond that a failure.
- `GET /setup/state` never contacts a device (cached probe results + database); `POST /setup/check/{step}` runs the
  existing **read-only** probes (GET only - the wizard never changes anything on a device), one per user and step
  every 5 s, a whole check cut off after 20 s ("לא ענה בזמן"), no database transaction open during device calls,
  audited as `setup.check`. Responses carry model / firmware / versions / stream names - never serial numbers, MAC
  or IP addresses (an NTP server address that could have reached the state is reduced to "configured: yes/no").
- "בדוק שוב" per step, "בדוק הכול", a "מוכן לעבודה" summary when all six pass; system administrators see
  "השלם את ההתקנה" in the shell until then (dismissable per session). The former `#/system/setup` stays as the
  חיבורים page. Demo mode keeps its fixture data. Shell: the main area is now padded by the fixed system-error
  banner, which used to cover the first rows of every screen.
- Docs: `DOCS.md` + Hebrew mirror, `docs/user-guide/he/70-setup-wizard_HE.md`. Tests: `test_setup_wizard.py` 31
  (fake NVR / HA / go2rtc; `fake.writes == []` asserted), 48 in the touched set; Playwright wizard spec (NVR down →
  the step fails with the explanation, up → passes; desktop + phone), demo 2, screens sc26 6; tsc / build clean.
  Opus review (2 medium fixed: NTP address, check deadline).

### Roles and permissions: camera scope and session downgrade (T055)
- A role binding may now target **a single camera** (הגדרות › תפקידים › היקף "מצלמה", picker limited to the
  actor's reach), next to installation / site / floor. Precedence: the camera, then every floor it is anchored on,
  their buildings and sites, then the installation - **a deny anywhere on that chain wins over any allow**; an
  unanchored camera is reachable only through an installation or camera binding; existing bindings behave as
  before. Documented in `docs/security/HA_IDENTITY_RBAC_HE.md` §15.
- Every camera-bearing resource is filtered on the server through ONE helper (27 resources: camera list and status,
  snapshot, capabilities / PTZ, zones, live and its socket, recordings, frames, playback sessions / groups / seeks,
  events list / facets / summary / windows / timeline / detail / thumbnail / correlation / route / ack / push, case
  items and bundles, exports estimate / create / download / manifest, alerts, search, saved views, NVR camera
  settings, the floor map bundle, anchors, plan image and geometry). A camera-only user gets the floor drawing and
  their own cameras' anchors - no HA entities, zones or circuits, no editing. WisKey station stills are not VMS
  cameras (installation-scoped, as before). Roles holding `rbac.assign` cannot be bound at camera scope (allow);
  a full administrator can still deny any role on one camera.
- **Placing a camera on a map is not a way to gain it** (review finding): placing, moving or removing a camera anchor
  requires `placement.edit` on the camera's current chain - reading it is not enough; an unanchored camera is
  placed only by an installation-wide holder; the editor's camera list follows the same rule. A delegated site
  administrator can bind a camera only when every floor it hangs on is inside their reach; group reach counts
  camera bindings. No installation fallback undoes a camera deny any more (timeline, ack-many, case item file,
  bundle download - review finding). Camera-less events and alerts follow the installation grant.
- **Session downgrade**: nothing caches effective permissions beyond one request; `/me` carries a permissions
  fingerprint and the new `/me/ws` pushes `permissions_changed` (the shell shows "ההרשאות שלך עודכנו" and
  refetches); an open live or playback stream loses only the revoked camera (`access_lost`, close 4403); queued or
  running exports of a lost camera are cancelled and downloads are re-checked; deactivation in Home Assistant cuts
  everything. Audit rows now record the scope, role and binding they were authorised under (migration 0032, columns
  only). `scripts/api_inventory.py` lists websocket routes again.
- Tests: `test_rbac_camera_scope.py` 101 (a 36-case precedence matrix; all 27 resources for a camera-scoped user
  AND for "installation allow + camera deny"; delegation; downgrade: refusal, lease closed, playback closed, export
  cancelled, notice; audit scope), 146 in the RBAC set; Playwright: a user bound to one camera sees exactly that
  camera on live / events / map, and the revoke toast. Two Opus security reviews with probes (2 blockers + 3 medium
  fixed, one leftover placement case fixed).

## 0.1.132 (pilot) — Events 8× faster under load, ingest and export backpressure, a local soak (T068); capture-cancel race; door-model study
### Events, ingest and exports (T068, device-free part)
- **Events list p50 1,655 → 191 ms, p95 2,442 → 663 ms; facets 155 → 82 ms** (24 h window, 500 rows, ~8 alerts/s,
  8 readers). Most of the time was not the query: two file `stat()` calls per row for the thumbnail status. A
  thumbnail folder index (kept in step with the writer and the janitor) removed that; a small events-window cache
  (32 windows, ≤ 5,000 rows, 5 s, keyed by the exact camera scope; trigger-based change counters read in the same
  transaction, migration 0031) helps the facets and the list's median. `/health` → `events.cache`.
- **Ingest backpressure**: the alert stream is now a reader and a writer with a bounded queue (256). Alerts of the
  same camera and state within 30 s are merged (the count is kept - stored counts equal the alerts accepted);
  beyond that the oldest is dropped and counted; on shutdown the queue gets 5 s to be stored, the rest is counted.
  Slow event sockets are counted too. `/health` → `backpressure`.
- **Exports under disk pressure**: a new job is refused with 507 and a plain message when `/data` would drop below
  `storage.min_free_mb` (default 1024 MB, the same guard as bundle uploads); a running job becomes **"מושהה - אין
  מקום בדיסק"** and resumes by itself once there is room for the bytes it had reached (with a 15 s → 1 min → 5 min
  back-off, so an NVR that reports no file size cannot make it loop), or by hand (`POST /storage/exports/resume`,
  `system.configure`); at most 20 waiting jobs; progress written at most once a second; a crashed export is marked
  failed instead of "running" forever. The storage screen has a local-disk card (shown even when the NVR report
  fails) and the exports screen shows the paused state. The ffmpeg remux step is not disk-guarded yet (documented).
- Found by the soak and fixed: `/events/windows`, the camera timeline and the day summary were holding the
  database write lock; they are read-only now.
- **Local soak** (`tests/soak/soak_local.py`, `SW_SOAK=1`, `docs/operations/SOAK_LOCAL.md`): fake NVR + fake HA with
  periodic restarts, continuous ingest, readers, exports on a small quota. Review run, 10 min 54 s, 4 NVR and 3 HA
  restarts: 2,673 alerts accepted, 0 dropped, stored counts exact; 0 "database is locked", 0 HTTP 500, longest
  write-lock hold 0.58 s; 13 exports paused and all resumed; memory flat after a 5-minute warm-up (working set
  114 → 116 MB, object counts flat), threads and handles flat, no product thread left after shutdown. The
  device-dependent soak (real NVR / go2rtc restarts) remains for the lab.
- Tests: `test_events_cache.py` 11, `test_backpressure.py` 12, 61 in the touched set; tsc / build clean; Opus review
  (4 medium fixed) + scoped re-review with the soak.
### WisKey card capture: a cancel no longer reads "lost" (T054)
- A race found by a test-hardening pass: the capture lane's slot was released before the calling thread recorded
  its result, so a poller read in that gap saw "capture not found" and the cancel answered **אבד** instead of
  **בוטל**. The slot is now freed only after the result is recorded; audits and WisKey cleanup run after the
  release; the door-release lane is untouched. Regression test that fails on the old code; 179 intercom tests;
  Opus review. Two intercom timing tests were made robust under load (they only ever failed while 4-5 agents ran).
### Plan Studio: door-detection study (T087, experimental, off)
- On the owner's three real plans only 8-9 of 24 sampled doors are drawn with an arc; the rest are an open leaf at
  30-50° without an arc, a V-shaped double door, or a triangle (leaf at 90° + a straight line); at the detector's
  working resolution a door is 14-32 px of light grey; only 6 of 33 hinges sit on a wall the detector finds. A
  second, gap-free door model (`door_model: "arc_v2"`, off by default, 422 for unknown values, no change to the
  default path) found 0 / 2 / 4 of 8 with many false candidates and was stopped by its rule. Study:
  `docs/evidence/T087/DOOR_MODEL_STUDY_2026-09-29.md`; recommendation: a manual door tool that proposes width, hinge
  and swing on a click; a separate door pass at upload resolution with templates for the three drawing styles; a
  learned model only once doors are labelled.

## 0.1.131 (pilot) — Evidence bundles from another installation: verify and import (T050)
- **"ייבוא חבילת ראיות"** on the cases screen: upload a bundle ZIP (raw or multipart, streamed to a staging file, cap
  `cases.import_max_mb` default 512 MB, one upload at a time, 507 when `/data` would drop below
  `storage.min_free_mb` default 1024, 408 after 30 s idle / 10 min total so a stalled upload never blocks others),
  get a verification report - per file תקין / חסר / לא תואם / פגום, manifest version, producing installation, and a
  plain summary: **a matching hash proves the file is unchanged since export; it does not prove the footage is
  genuine**. "ייבא כתיק" (cases-manage, installation-wide) creates a new case marked **מיובא** with provenance
  (source installation, exporter, export time, bundle hash), read-only items and notes, files stored under
  `imported/<hash>/` and counted in the storage screen; nothing from a bundle becomes a camera, event, user or
  setting; the same bundle imports once (409 with the existing case). "בדיקת hash חוזרת" on the case (once a minute).
- **Producer honesty**: an installation id is public (every manifest carries it), so "מהתקנה זו" is claimed only when
  the bundle's signature verifies against this installation's key; an unsigned bundle with our id reads
  "לפי המזהה בלבד (לא מאושר בחתימה)". Bundles now carry a stable installation id and a signature; unsigned bundles
  still import, labelled as such.
- **Hostile archives**: the ZIP's end records are read before the archive is opened - more than 5,000 entries or an
  oversized directory is refused in about a millisecond (a review measurement: a crafted 86 MB archive with a million
  entries used 532 MB of RAM before this guard); `..`, absolute paths, drive letters, backslashes, control
  characters, symlinks, special files, encrypted entries, duplicates, extreme compression and oversized unpacked
  totals are refused before any member is read; only the expected file names are extracted, always under the
  destination; `report.html` / `notes.md` are never stored; served files get their type from magic bytes with
  `nosniff` and a sandbox CSP; names and notes are rendered as text and stripped of control / bidi characters.
- After a backup restore an imported case comes back without its files (they are outside project backups, like
  snapshots) and blocks re-import until deleted - documented in `DOCS.md`.
- Migration 0030. Tests: `test_bundle_import.py` 19 + bundle / cases / signing / janitor / settings 33 in the set;
  Playwright import flow 3/3 (desktop, tablet, mobile); Opus security review (1 blocker + 2 medium fixed) + two
  scoped re-reviews.

## 0.1.130 (pilot) — Device layout editor and colour themes (CR-007 6b); groups and delegated assignment (T082); Plan Studio tuning; Hebrew documentation batch 1
### Device control (CR-007 slice 6b, the owner's §7.11 decisions)
- **"ערוך פריסה"** on the building screen (floor / area cards) and the area screen (domain cards): drag and resize on an
  8 px grid (grid units, never pixels; RTL exact; arrows nudge, Shift+arrows resize), a side panel per card (custom
  title and icon, text size in three steps, background / border colour as a palette ROLE - never a free colour -
  hide, and which entities the card shows; hidden entities are still counted), "שמור / בטל / אפס לברירת מחדל",
  "העתק לכל האזורים" (confirmed, revision-checked, audited). One layout per installation, stored on the server
  (migration 0028), shown to everyone; the button exists only for `system.configure` holders and the routes refuse
  anyone else before reading the body; optimistic revisions (409), overlap refused (422), backup / restore
  included. A floor-scoped user receives only the parts of the layout they may see, and rows of anything not drawn
  (hidden, not theirs, gone from Home Assistant) close up. Card contents are inert while editing, so a keyboard
  cannot change a real device by accident. Layouts of areas that left Home Assistant are pruned on the next save
  (audited) - a read never writes.
- **Phone**: derived automatically from the desktop order, and editable on its own afterwards ("חזור לאוטומטי").
- **Colour themes**: four palettes (כחול, חול, יער, גרפיט), each with light and dark values for every knob and
  role; a swatch picker in הגדרות › חשמל והתקנים; **"בהיר או כהה"** (`devices.scheme`: בהיר / כהה / לפי המכשיר,
  default בהיר - dark applies only when chosen, never by the OS setting alone, because the app shell is light).
  Documented knob by knob in `docs/design/DEVICE_THEMES.md` §6-7 for whoever designs the next themes.
- Open for the owner: position / size per individual device tile (today the unit is the domain card, as in the
  mockup's Edit board) - recorded in CR-007 §7.11.
- Tests: `test_device_layouts.py` 8 + settings / devices / backup 61 in the set; 6a + 6b Playwright 17 passed on
  desktop and mobile; Opus review + two scoped re-reviews.
### Roles and permissions (T082)
- **Groups**: named groups of users with role bindings the members inherit (effective permissions = union of the
  user's and the groups' bindings); membership and bindings with revisions (409), an impact preview naming every
  affected user before a change, delete refused while members or bindings remain, every change audited (ids only).
- **Delegation to a site administrator**: `rbac.assign` may be delegated, limited to an allow-list of roles
  (הגדרות › תפקידים, default viewer + operator), to the site admin's own scope, up to their own permissions, never to
  themselves or a group they belong to, never a system or sensitive role; they manage a group only when all its
  bindings are inside their reach and see only the users, bindings, roles and groups within it (server-filtered).
  **Deny bindings** stay a full-authority tool: delegated actors can neither create nor lift one. Full authority now
  requires `rbac.assign` AND `rbac.roles.manage` installation-wide - this closes a hole where a site admin bound to the
  whole installation could hand out system_admin.
- **Bulk**: group membership replacement and `POST /access/bindings/bulk` (≤ 50 items, 64 KB, JSON only, permission
  before the body) are all-or-nothing: the first refused item refuses the request with its index and id. No
  binding or membership write may leave the installation without an active administrator (409 `last_admin`),
  including a deny on oneself. Migration 0029; `docs/security/HA_IDENTITY_RBAC_HE.md` §14.
- Tests: RBAC set + migrations + backup 37 passed; two Opus security reviews with a probe against a temp database
  (3 medium findings around deny bindings fixed, 10 nits incl. existence leaks before the permission check).
### Plan Studio tuning (the 0.1.89 / 0.1.91 lists, T087)
- Fixed: a realign route declared twice (a test now fails when any route is declared twice); a camera on a removed
  level had an unclipped cone in 2D and 3D; switching floors in 3D kept the previous floor's framing; a hand-drawn
  tribune connector was invisible in 3D; the editor's and the floor map's level filters treat a removed level as the
  default level, like 3D does.
- Detector: sheet strokes far outside the building (section marks, title underline, north arrow) and dashed lines
  are no longer walls; tribune edge lines are no longer walls. A separate small building (three sides in two
  directions) is kept and flagged **"מחוץ למבנה הראשי"** (dashed warning stroke, label, a count in the detect summary)
  instead of dropped; a gap counts as a dash gap only when nothing crosses it, so a pier-window-pier facade or a
  faded partition survives. On the owner's three real plans: walls-outside-the-building 5 / 18 / 11 → 1 / 12 / 3,
  tribune false walls on floor 0 8 → 4, synthetic metrics identical (walls recall ≥ 0.974, precision ≥ 0.969, doors
  21/21, windows 17/17). Doors were not chased on purpose: the arcs on those scans are mostly not detectable
  (numbers in the triage) - a new door model is its own task; a thin-hollow-exterior-wall prototype (0.00 → 0.68
  on floor 0) is parked because it merges adjacent solid walls. Triage of every list item with a reason:
  `docs/evidence/T087/TUNING_TRIAGE_2026-09-29.md`. Tests: 73 detector + routes, 30 unit; Opus review + two re-reviews.
### Documentation in Hebrew (T091 batch 1)
- Hebrew mirrors with a `Source: <path> @ <commit>` header (drift reported by `scripts/docs_he_check.py`):
  `smplwise_vms/README_HE.md`, `DOCS_HE.md` (the full add-on documentation), eight operations documents,
  `docs/release/RELEASE_PACKAGE_V1_HE.md`, `docs/security/DEPENDENCY_AND_SECRETS_AUDIT_HE.md`. Stale version
  references are marked with a translation note, not silently changed. The eight CR documents remain.

## 0.1.129 (pilot) — "database is locked" storm: root cause found and fixed (round-10 finding)
- Round 10 (2026-09-26) recorded a transient SQLite "database is locked" storm under 45+ minutes of real-NVR load
  and left the root writer unknown. It reproduces without the NVR and without antivirus: several paths held
  SQLite's single write lock **while waiting on a device** - the NVR paged search inside export / case-preserve
  creation (also queued behind the process-wide search lock), the NVR PUT of manual recording start / stop and the
  janitor's expiry, a rule's Home Assistant notification (15 s timeout) inside the alert-stream and HA-sync
  transactions, a download or slow Ingress client (the connection closed only after the whole body was sent),
  entity-to-area assignment and the bridge discovery POST. Any wait past the 10 s busy timeout failed unrelated
  writers, and audit rows, alerts and live-video audit were silently dropped. `ha_sync` and `events_ingest` were
  victims, not holders.
- Now: every device call runs outside the write lock, with the state written before the call (recording session
  row + attempt audit before the NVR start; the row is closed as failed if the NVR refuses, and the recording is
  stopped again if the database is still busy afterwards); HA notifications go out after the commit; the request
  transaction is committed when the response starts, before the body is sent; the export quota and
  "already preserving" checks are repeated inside the insert transaction (two parallel requests: one job, one 429 /
  409); background writers retry up to 3 times with jitter instead of dropping (audit, alerts, bulk outcomes) -
  except the HA state path, which makes one attempt so the HA websocket never waits through retries; lock holds
  over 3 s and every busy failure are logged; `/health` shows `db.write_lock` counters (who held it only for
  `system.configure`); the janitor runs a PASSIVE WAL checkpoint every 30 s; a released request connection is
  read-only. Kept: `synchronous=FULL`, the 10 s busy timeout, every `unlocked()` caller, the 0.1.126 lock order.
- Measured (opt-in load test `SW_DB_LOAD=1`, 90 s, 12 actors, fake devices): before, slow NVR - 24 locked, 25 HTTP
  500, 11.4 s max wait; after - 0 / 0 / 1.1-1.4 s, longest lock hold 0.56 s.
- Behaviour changes to know: a download's audit row is kept when the client disconnects mid-transfer; a successful
  area change leaves an attempt and an outcome audit row. Not yet observed on the Linux add-on with the real NVR:
  after a long session `busy_errors` in `/health` should stay 0.
- Tests: `test_db_locking.py` 18 (8 + 10 fail on the old code), the load test, 51 in the touched set; two Opus
  review rounds (4 medium fixed). Findings and fix recorded in the round-10 document and `RESOURCE_BUDGET.md`.

## 0.1.128 (pilot) — Device control: its own settings section and the "glass" style (CR-007 slice 6a)
- New settings tab **"חשמל והתקנים"** (system administrators; everyone else sees it read-only): style
  (SMPLWISE / זכוכית), default view of the building screen (cards / tiles - a viewer's own toggle still wins on their
  browser), density (comfortable / compact), show sensors, show the floor's climate strip. Settings family
  `devices.*`, audited. A note says the per-area layout editor and the colour themes come next (6b).
- **Glass style** - the mockup the owner approved (translucent panels with blur, soft shadows, rounded tiles, larger
  room cards, icon-forward tiles in the DomusUI spirit; ideas only, no code from it): a layer of named `--dv-*`
  properties over the v2 tokens in ONE file (`frontend/src/styles/devices-themes.ts`), so a designer can add a theme
  without touching the screens - documented knob by knob in `docs/design/DEVICE_THEMES.md` with "how to add a
  theme". Logical properties only (RTL exact; an LTR viewer is fine too); solid panels where `backdrop-filter` is not
  supported or the viewer asks for reduced transparency; no hover lift under reduced motion. The SMPLWISE style is
  unchanged (every new rule is scoped to the glass attribute).
- Dark values exist for the palette but apply only on an explicit `data-devices-scheme="dark"` (review finding: on a
  dark-mode OS the area went black while the light-only shell stayed white). Nothing sets it yet; 6b adds the
  `devices.scheme` setting (auto / light / dark).
- Also: the area rows' `data-counts` now matches the visible pills when sensors are hidden.
- The owner's word on the previews: "starting to look like what I want - not the peak, good enough for a start; make
  changes convenient and document everything" - recorded, hence the theme layer and the doc.
- Tests: settings + devices backend 48 passed; `evidence-devices` desktop 30 passed / 2 skipped and the 6a tests 6/6
  on desktop + mobile (style attribute and computed blur / fallback, RTL start edge, permission gating, dark only by
  attribute, hidden sensors); tsc and build clean. Screenshots under `docs/evidence/T025/devices-glass-*.png`.
  Also in this release: the test-suite hardening (7 machine-speed-dependent backend tests now scale with
  `SW_TEST_TIME_FACTOR`, strict bounds behind `SW_PERF=1`; `tests/README.md`) and the T091 guide-capture
  infrastructure (`frontend/tests/guide-screenshots.spec.ts`, `scripts/docs_he_check.py`, demo captures).

## 0.1.127 (pilot) — WisKey embed API v1: the panel is embedded through WisKey's own contract (rc.19)
- The WisKey developers answered our embed-mode request (`docs/integrations/wiskey/WISKEY_EMBED_MODE_REQUEST.md`) with
  contract v1 in WisKey 2.0.0-rc.19 (`docs/integrations/wiskey/embed-api-v1/`). SMPLWISE now uses it: the frame opens
  `/hikvision-intercom?embed=1&tab=…&tool=…` (built from the origin, never the ingress path); WisKey hides its own
  toolbar and Home Assistant's sidebar; the WisKey tabs and management tools in SMPLWISE's navigation (both designs,
  the phone bar and its overflow) come from the panel's `wiskey:ready` catalogue - only what that user is allowed to
  see; a tab click sends `wiskey:navigate` and the selection moves only when `wiskey:location` confirms it (a
  declined unsaved-change dialog keeps the old screen; a locked session answers nothing and the request expires
  after 3 s); the confirmed location is mirrored into the address as `wiskey_tab` / `wiskey_tool`, so bookmarks and
  back / forward work; the WisKey page title is shown as text.
- **Install WisKey 2.0.0-rc.19 and restart Home Assistant** to get this. Older WisKey builds keep working: when the
  panel has no `data-embed-api` marker after the handshake window, the previous method (the DOM deep link and our
  own sidebar hiding) is used; a marker without a handshake shows "מתחבר…" instead, never the old adapter; a newer
  contract version shows "גרסה לא נתמכת". A reload inside the frame (HA reload, session revoked) is a fresh
  handshake, so "נדרשת כניסה" still appears. Leaving the WisKey area removes the frame; "רענן" reopens the last
  confirmed screen.
- Screens set to SMPLWISE in "בקרות כניסה" stay in the tab row even when the operator's WisKey catalogue lacks them
  (they are governed by SMPLWISE permissions). Phone / Companion app behaviour unchanged (0.1.123), except that
  "פתח ב-WisKey" now deep-links to the tab (`?tab=…&tool=…`), which rc.19 also honours in normal mode.
- Security, verified in review: every message is accepted only from the frame's own window on the same origin and
  sent only to that origin; only tab / tool ids and labels are taken from the catalogue (strings, ids kept apart from
  labels); nothing from WisKey is rendered as HTML; no token or SMPLWISE data reaches the frame. The `allow`
  attribute carries `camera` and `clipboard-write` beyond the contract (recorded in CR-005 with the reason).
- Tests: connector unit spec 14; embed specs desktop + mobile + phone 22 passed / 22 viewport-skipped; the new fake
  WisKey panel implements the contract with modes v1 / legacy / marker-only / unsupported-by-ready /
  unsupported-by-marker / ready-without-location / ignoring; tsc and build clean. Opus review against the contract
  (2 blockers, 3 medium fixed), scoped re-review (1 medium fixed).
- Lab checks left for the owner (rc.19 installed): one toolbar; HA's sidebar hidden inside the frame and present in a
  normal HA tab; tabs = WisKey's own list; a restricted operator; leave / return / "רענן"; camera and two-way audio
  inside the nested frame; back / forward and bookmarks. See `docs/operations/LAB_CHECKLIST_2026-09-29_HE.md` §2.

## 0.1.126 (pilot) — Home Assistant structure changes reach the device screens within seconds (owner report)
- Owner report (2026-09-28): an entity moved to another area in Home Assistant did not move in "חשמל והתקנים" until
  the add-on was restarted. Root causes, from the code: the HA sync subscribed to `state_changed` only and read the
  registries (entities, devices, areas, floors) at connect and then every 600 s; a periodic refresh sent nothing to
  open screens; a refused or partial listing was applied as "empty", so entities whose area comes from their device
  fell to "ללא שיוך", were tombstoned and lost their bulk-safe marks; entities deleted in HA lingered if they had
  reported a state since the connect. The entity → area rule itself (entity area, else device area) was right.
- Now: the sync subscribes to HA's `entity_registry_updated`, `device_registry_updated`, `area_registry_updated` and
  `floor_registry_updated` (allowed for non-admin tokens; a refused subscription is logged and the session goes on).
  A burst of events becomes one refresh after 1.5 s (never later than 10 s after the first); when the mirror actually
  changed, a `structure_changed` push reaches the device screens and the entity catalogue, which refetch and show
  "מבנה עודכן". The 600 s refresh stays as a safety net. Measured on the fixture: HA change → screen in 1.6-1.7 s;
  state changes were and are 35-63 ms.
- A failed or empty entity listing, or a failed device listing, now writes nothing; a failed area or floor listing
  keeps that table. An entity that leaves HA's registry is tombstoned; an integration reload (state removed,
  registry entry kept) only marks it unavailable and keeps its bulk-safe mark.
- "רענן מ־Home Assistant" on the building screen (`POST /devices/refresh`, `devices.read`, one call per user per 10 s,
  a result younger than 3 s is reused; 503 without HA, 502 when a listing fails, 504 when it takes over 30 s - the
  write is never cut short, two mirror writes can never overlap). The screen shows when the structure last changed
  and when it was last checked.
- Tests: 9 new backend tests for the sync (the owner's move scenario, debounce, device vs entity area, partial
  failures incl. kept marks, removal / reload, the dev push, the manual refresh's permission / rate limit / errors /
  no overlapping writes, a refused subscription); 70 passed in the device set on the merged tree; the Playwright
  fixture now runs a fake HA WebSocket that the real sync connects to, with two new specs (a move is seen without a
  page reload; the refresh button and its 429). Opus review + fix round + scoped re-review.

## 0.1.125 (pilot) — Device control: climate and covers in full, sensors, assign an entity to an area (CR-007 slice 4)
- **Home Assistant must be restarted once** after this update: the bridge integration moves to 0.2.5 (nine new
  allow-listed services and one registry write, below).
- Climate in full: preset mode, swing mode and target humidity for climate entities, target humidity and mode for
  humidifiers (humidifier now reachable with `devices.control`; nothing else about it is), ±0.5° target already
  there. Building and floor cards show a compact "מזגני הקומה" strip (mode + target).
- Covers in full: tilt open / close / stop / position (arm-then-confirm like the movement itself), wording and icons
  by device class. Door, garage and gate covers are read-only for `devices.control` **on the server**, not only in
  the card (a review finding: an operator could have opened a gate through the action route); `ha.entity.control`
  keeps its rights. Per-area "כל התריסים" group control (open / stop / close / position) rides the existing bulk
  path - `devices.control_bulk`, confirmation, the same door / doors-layer exclusions - and is accepted for an
  area only (`covers_close` alone stays building-wide as in slice 3). "Stop all" is reported as "נשלח": a stop has
  nothing to confirm, so it is never counted as done and never as failed.
- Sensors card per area, grouped by class (temperature, humidity, power, illuminance, CO2, battery, other) with unit
  and last change; no controls.
- Assign an unassigned entity to an area from the product: `PUT /devices/entities/{id}/area` (`system.configure`,
  permission before the body, audited with area ids only) through a new bridge service `set_entity_area` - a
  registry write allow-listed for exactly this operation, entity and area must exist, `area_id` non-empty.
- Bug found by the new tests: a bulk action's arguments were stored as `{}`, so any attribute-confirmed bulk action
  could never confirm (silent "unknown" forever). Fixed: the cleaned, validated arguments are stored as the
  single-entity route does.
- Tests: 64 backend in the device set (incl. the card / bridge parity checks), 76 Playwright (5 skipped by design)
  across desktop / tablet / mobile, 4 unit; tsc and build clean. Opus review + fix round + scoped re-review.

## 0.1.124 (pilot) — Plan Studio 3D, skins foundation: AI render provider, privacy acknowledgement and budgets (CR-006 slice 2a)
- Phase 2 of CR-006 starts. This slice ships the foundation only: **no floor picture is sent anywhere yet**; the only
  request that can leave the installation is the system administrator's connection test with a 64x64 synthetic
  pattern. The render-set proposal, real sends, stored skins and compositing come in 2b/2c.
- New add-on option `openai_api_key` (also `OPENAI_API_KEY`): never stored in the database, never logged, never in
  audit rows or error payloads; every provider message is redacted (`sk-…` shapes, bearer tokens). `GET /skins/status`
  says only whether a key is configured.
- New settings family `skins.*` (system administrators, audited): provider (`openai`), model (default `gpt-image-1.5`),
  privacy acknowledgement (off by default; nothing is sent until it is on), budgets - renders per floor (4, 0-6) and
  per month (20, 0-500; the connection tests count, they are paid). A separate acknowledgement from the search's
  `ai.*` keys on purpose: a floor picture is different data and a different consent.
- The settings card lists word for word what can leave (our schematic control image; the original plan picture only
  when the sender chooses it per send; the product's fixed prompt) and what never leaves (camera stills, people,
  labels and names, sensor states, HA data, addresses, site ids).
- Provider interface `services/skins/provider.py` with one implementation (OpenAI `POST /v1/images/edits`, request
  shape verified against OpenAI's guide and official SDK types; per-image prices are NOT verified - the estimate is
  labelled as such and the reply's token usage is recorded as the fact). Malformed or failing replies become a
  redacted error and always leave an audit row.
- Deterministic control image per floor (`POST /floors/{id}/skins/control-image`, `map.edit`): the level-2 isometric
  render in one fixed palette with no anchors or labels, so the same structure gives identical bytes in every design
  theme (spec proves a vs b). Migration 0027: `plan_skin_renders` / `plan_skin_controls`.
- Hardening found by the review rounds: every skins path is confined under `data/skins` (a poisoned row or a crafted
  backup archive cannot touch files outside it); floor ids are validated; backup restore skips unsafe floor rows and
  reports the count, and its `files/` extraction now refuses backslashes and drive letters as well as `..`;
  `repr` of the settings object never shows a secret.
- Tests: 27 skins tests + backup / settings / catalog 40 passed in the reviewed set, 237 backend in the wider run;
  skin-control and determinism specs 16 passed (desktop and mobile); tsc and build clean. Two review rounds at
  Opus tier, two scoped re-reviews.

## 0.1.123 (pilot) — WisKey embed on the phone: the Companion app opens WisKey itself
- Owner report (2026-09-28, Android Companion app): the embedded WisKey showed "לא ניתן לטעון את WisKey מתוך Home
  Assistant". Cause, verified in Home Assistant's frontend source: in the Companion app HA signs in through the
  app's native bridge in the top window only (`externalApp` / `externalAppV2` / `getExternalAuth`), and never
  through stored tokens; a Home Assistant nested in a frame therefore waits for a sign-in that never comes (or
  redirects to `/auth/`), and our 25 s timeout reported it as "not Home Assistant".
- Now: the Companion app is recognised before any frame is created (user agent and the bridge on the top window).
  There, מרכז הכניסה / פעילות / אנשים show the SMPLWISE screens with a note "בטלפון WisKey נפתח באפליקציה עצמה",
  the embed-only tabs show the note, and every one of them has "פתח ב-WisKey", which moves the app's own Home
  Assistant to the WisKey panel the way HA navigates (with a full-page fallback after 1 s). A `/auth/` redirect or a
  page that never connects is reported as "login required" and the frame is removed; the "unreachable" state names
  the likely cause and offers the same button. Desktop and mobile-browser behaviour unchanged.
- Not tested on a real device (the throwaway backend cannot run the Companion bridge); the lab checklist in CR-005
  now says: phone = top-level navigation, not nested. Tests: new phone spec 6/6 (Companion user agent on a SMPLWISE
  tab and an embed-only tab, the button both ways, the `/auth/` redirect, the never-connecting page); all
  `evidence-wiskey*` specs 46 passed.
- Also in the repository: `docs/integrations/wiskey/WISKEY_EMBED_MODE_REQUEST.md`, the request sent to the WisKey
  developers for a proper embed mode (URL tab/tool, no toolbar or ☰, HA's kiosk event, a message channel) that will
  remove the double menu row and the DOM-based deep link.

## 0.1.122 (pilot) — Show or hide the WisKey area (settings › בקרות כניסה)
- Owner request (2026-09-28): a third control in "בקרות כניסה" - "הצג את WisKey במערכת". Hiding removes the whole
  WisKey area from the navigation for every user regardless of role (both nav designs, the phone bottom nav and
  its overflow), the same "hidden for everyone" shape as hiding the map; a direct URL to a WisKey route shows a
  "מוסתר" panel pointing back to the setting. The per-screen choices (WisKey embedded / SMPLWISE) apply only while
  the area is shown. Setting `ui.hide_wiskey`, audited. Tests: 3 settings tests, 21 live across desktop, tablet
  and phone incl. toggle-back.

## 0.1.121 (pilot) — WisKey embedded as-is, and a "בקרות כניסה" settings section (CR-005, owner decision)
- Owner decision (2026-09-28 evening): instead of porting the rest of WisKey screen by screen, embed the owner's
  own WisKey panel as it is. The WisKey area now shows the real WisKey panel inside SMPLWISE (an iframe on the same
  origin, using the user's own Home Assistant session - on the LAN and remotely alike), and it is the default. The
  SMPLWISE screens built earlier (Entry Center, Activity, People with the editor and card capture) stay in the
  product and can be chosen back per screen.
- New settings section **"בקרות כניסה"** (system administrators): for each of מרכז הכניסה / פעילות / אנשים choose
  "WisKey (מוטמע)" or "SMPLWISE"; the other WisKey screens (עמדות, סנכרון, בריאות, יומן שינויים, ניהול) are always
  embedded and appear as tabs of the WisKey area in both nav designs. The section says plainly what the embed means:
  inside it WisKey's own permissions and audit apply - a user whose HA account has WisKey "manage" (or an HA
  administrator) can release doors and edit people there without SMPLWISE's confirmation step or audit.
- How the embed works, honestly: Home Assistant's sidebar is hidden inside the frame through HA's own kiosk
  event (HA 2026.1+, in memory only, so the user's normal HA tabs keep their sidebar), with a style fallback and a
  visible note if neither works; the WisKey panel does not read its tab from the URL, so each SMPLWISE tab opens
  the matching WisKey tab once through the panel's own navigation and then leaves the panel alone (a two-line change
  in WisKey would make this permanent - the `?tab=` parameter is already sent). The frame loads a second copy of
  the HA frontend, which is heavier than the native screens, especially on a phone. Loading, login-required,
  not-installed, unreachable and blocked states are shown as such; "פתח בחלון מלא" opens the panel in a new tab.
- The remaining port slices (schedules and photos, station technical settings, door programs, relay reversal,
  WhatsApp) are not built for now - recorded in CR-005 with the relaxed principle (inside the embed the browser is
  WisKey's own frontend) and a lab checklist for the owner: LAN over http and remote https, the sidebar hidden,
  all eight tabs, the Companion app on a phone (a login page inside the frame is the likely failure), the normal
  HA tab keeping its sidebar, two-way audio through the double frame, "פתח בחלון מלא".
- Reviewed twice (adversarial): round 1 found the parent re-applying its tab every 2 s, which undid WisKey's own
  navigation and re-prompted an unsaved schedule - fixed to a once-per-tab deep link; round 2 approved with one nit
  (the deep-link window now counts from the panel's mount). Tests: 6 settings tests, embed spec 6 passed on desktop
  and phone against a structural stub of HA, WisKey specs 21 passed; the real nested HA is the owner's lab check.

## 0.1.120 (pilot) — Plan Studio 3D: determinism as a test, pixel baselines, heavy-floor budget, entity labels (CR-006 slice 1c)
- Determinism is now proven, not assumed: a spec builds the scene twice from the same plan, tokens, state and
  camera and compares the full scene graph and the exact pixels, at both quality levels and all presets;
  per-(level, preset, viewport) pixel baselines live under `docs/evidence/T087/visual/` with a 2/255 channel
  tolerance, including a baseline with the state layer (tints, red door frame, chip, pills). Regenerate with
  `SW_UPDATE_VISUAL=1`; `SW_REQUIRE_VISUAL=1` makes a renderer mismatch fail instead of skip.
- Level-2 budget on heavy floors: above the existing heaviness threshold the scene switches to a measured
  "heavy" configuration (no object shadows, Lambert objects, 1024² shadow map, occlusion kept) chosen by ranking
  the levers in real Chrome; the live test asserts ≥ 30 fps on the 3,000-chair floor and ≥ 45 fps at phone width
  (60/60 measured on a quiet machine; the earlier 14-18 fps was under heavy CPU load from other work).
- Entity labels are DOM pills (readable at the overview, RTL, hidden behind the camera), capped at 60 on a
  crowded floor (selected, hovered and alerting ones stay, "+N" for the rest), only the shown level's under a
  level filter, standing just above their point so the object stays clickable; presence ring 0.3 m and skipped in
  rooms too narrow for it; the two long-failing mobile unit specs fixed (a clipped pin off the 390 px viewport and a
  phone-hidden toolbar - test set-up, no product change).
- Also: the load-sensitive backend timing test `test_busy_is_answered_at_once` now measures against half the real
  command timeout instead of a 1 s wall-clock bound - it failed four times today under 70-90 % CPU while passing
  alone, and its intent (an immediate "busy", never a 25 s wait) is an order of magnitude apart from that.
- Reviewed twice (approved with nits, all applied). Sizes: `three` chunk unchanged, the 3D element 16.4 KB gzip.
  Tests: 110 3D/2D unit specs green on desktop and phone, live 13 passed.

## 0.1.119 (pilot) — Device control, slice 3: floor / area / building "off" actions and the mockup layout (CR-007)
- The building screen now opens in the approved mockup's layout: a tree of floors and areas with state dots and
  hover actions, floor cards with a row per area, a "⋯" / "כבה קומה ▾" menu per floor, an area popover with state
  chips and quick actions, and building buttons ("כבה תאורה בלבד", "כבה הכל בבניין"). The earlier tiles view stays
  as a second layout, remembered per viewer (owner request: add, do not replace). The floor summary chips now sit
  next to the floor title (they were pushed to the far edge on wide screens).
- Bulk actions: lights off, covers close, climate off, screens off, and "all off" for a building, a floor or an
  area - each behind a confirmation dialog that lists exactly what will be sent (and what is not included, with
  the reason), focus on Cancel. New sensitive permission `devices.control_bulk` (site_admin and system_admin;
  a floor-scoped holder acts only on their floors, building actions need installation scope).
- What a bulk action may touch, decided server-side at preview, request and fan-out alike: lights, covers,
  climate and fans, media players - never locks, alarm panels, sirens, scripts, scenes, buttons, door/garage/gate
  covers, anything on the map's door layer, or HA flags (`input_boolean`); and a switch only after a system
  administrator marked it "בטוח לכיבוי קבוצתי" (a lighting-circuit link only suggests the mark - map editing must
  never decide what a single click switches off; a mark is cleared when the entity leaves HA). Entities already
  off are skipped and counted separately.
- Honest, durable execution: the attempt is audited and every per-entity record committed before the first
  call; each record is marked "sending" before its call, so after a restart it reads "תוצאה לא ידועה" (it may have
  gone out) and never "not sent"; a start-up sweep finalises orphaned bulks with an outcome row; at most 8 calls in
  flight, one bulk per scope and never two sharing an entity; single-entity actions keep their own capacity. The
  result says "בוצע" only when every entity confirmed, otherwise "בוצע חלקית: k לא אושרו" with the list; a TV that
  reports `standby` after turn_off counts as off. Clock skew handled as WisKey's actions do (server clock offset,
  15 s lifetime).
- Reviewed three times (adversarial): round 1 found "all off" could reach a door-release relay through an
  unmarked or unplaced switch, a 2 s-fast tablet locked out of every bulk action, and restart mid-bulk
  misreporting switched-off devices as "not sent" - fixed; round 2 approved with two nits (circuit-only
  eligibility, stale marks) - fixed. Tests: 48 backend across five files (12 new bulk tests + the switch policy
  cases), 61 live on desktop, tablet and phone incl. clock-skew and the admin toggle.

## 0.1.118 (pilot) — WisKey card capture from the door station, and a readable generated PIN (CR-005 phase 2, slice A2)
- "קריאת כרטיס מהאינטרקום" in the person editor: choose an online station, confirm (the reader at that door
  enters collection mode - the product's first long-running physical interaction), the person presents the card
  within the reader's 30 s window, and the admin approves adding it. Ported like-for-like from WisKey: the number
  is never shown or returned in clear (WisKey only reports the masked `•••• 1234`), the card is added through
  WisKey's own confirm step, and capture is offered only for a saved person with no unsaved changes.
- New sensitive permission `access.cards.capture`, required in addition to `access.people.manage`
  (site_admin and system_admin by default, grantable per person through a custom role).
- Safety: the reader is never started without an explicit confirmation and the command envelope; every capture
  session belongs to the SMPLWISE user who started it (WisKey sees all of us as one HA user) and no one else can
  read, cancel or approve it; one active capture per user and per station; the backend polls WisKey from its own
  small budget and cancels a session nobody follows for 20 s, so a closed tab never leaves a reader collecting;
  cancels never wait for a rate-limit token; a capture in progress cannot block a door release (its own lane).
  Every refused WisKey error code was proven from WisKey's source to be raised before the reader is told
  anything; everything after that is reported as "outcome unknown" and the station is treated as busy for
  WisKey's 120 s lifetime. Starts, cancels, approvals and results are audited under the real user, never with
  the card number.
- Generated PIN (owner decision 2026-09-28): after "צור PIN ייחודי" the new PIN is shown once in clear with a copy
  button, then hidden again; it is never shown for a stored PIN, never logged, and leaves the page's DOM when
  copied, edited, saved or closed. Note: a copied PIN stays in the operating system's clipboard history.
- Disclosed limits (first real use is the live test; WisKey's own source calls physical collection "still needs
  commissioning"): a backend restart during a capture leaves the station busy for up to 120 s (a new start is
  refused with a clear message); whether an already-enrolled card presented during capture also opens the door,
  and how long the reader stays in collection mode after a cancel, depend on the station firmware.
- Reviewed twice (adversarial): approved with nits; the polling budget issue found in round 1 (two parallel
  captures could starve another user's cancel) was fixed and re-approved. Tests: 177 intercom tests (34 new),
  live capture 6/6, editor 9/9, actions 8/8.

## 0.1.117 (pilot) — Hotfix: entity actions from the map over plain http
- Owner report (2026-09-28 evening): turning a lighting circuit on from the floor map showed "אין חיבור לשרת"
  although Home Assistant and the add-on were up. Root cause: the map's entity-action client built its command id
  with `crypto.randomUUID()`, which browsers expose only on secure (https) origins; on Home Assistant reached over
  plain http on the LAN the call throws a TypeError before any request is sent, and the API client reports a
  TypeError as "no connection". The WisKey client already carried a fallback for exactly this; it is now one shared
  helper (`getRandomValues`-based id outside secure contexts) used by every command path. Frontend only; a node
  test covers the no-`randomUUID` case. Not a regression of today's releases - the map path had this since the
  entity-action envelope was introduced; it surfaced once the map was used over http.

## 0.1.116 (pilot) — Plan Studio state layer on the 3D scene and the 2D map (CR-006 slice 1b)
- Rooms now show their live state on both map views, in the language of the reference the owner chose
  (approved by the owner from the screenshot on 2026-09-28): a lit room gets a warm floor; movement shows as a
  blue band along the room's edge that fades over `plan.presence_fade` minutes (default 3, or off - a new
  installation setting; in 3D the band is a ring, in 2D an inset edge band; a full blue fill only when the
  room is not lit); an open door or window gets a red frame in 3D and a red swing wedge in 2D; each room with a
  climate or temperature entity gets a readable temperature chip (a DOM label, fixed size, RTL); the level
  thumbnails carry state dots with the same fade. A per-viewer layer toggle "מצבי חדרים" (default on) in
  the layers panel. Locks show a door as open only on `open`, not on `unlocked`.
- Deterministic and cheap: the room state is a pure function of structure, state snapshot and the fade step;
  a fade step updates tint opacities in place (no rebuild of the instanced structure or the shadow map);
  thumbnails are built without the layer and never redrawn by state; an unbound door/window sensor may only
  claim an opening within 0.75 m on a calibrated plan (2 % of the width when uncalibrated) and never one that
  already has its own sensor.
- Also in this release, the small items carried from 1a: thumbnails drawn in their own frame pass (no corner
  flash), a failed thumbnail is not cached, narrow-canvas framing, the all-levels scene keyed without the
  level filter, a 3 s timeout on the settings wait, a wider fallback timer.
- Reviewed twice (adversarial): round 1 found a neighbouring door could be marked open by another opening's
  sensor, every fade step rebuilt the whole scene, unreadable temperature pills and a muddy lit+presence blend
  - all fixed; round 2 approved with nits carried to slice 1c (ring width at the overview, chip-to-part
  matching by id, no second Lit update per description, skip the ring in very narrow rooms, entity label pills
  to DOM). Tests: 30 new unit specs, 100 3D/2D specs green (the two known mobile failures predate this work),
  live state-layer test in real Chrome. `three` chunk unchanged, the 3D element 15.4 KB gzip.

## 0.1.115 (pilot) — Device control, slice 2: single-entity control (CR-007)
- The area screen's cards now act: light and switch toggle with a brightness slider, cover open / stop /
  close and position, climate target ± / mode / fan speed (only the modes and speeds the entity reports),
  fan on/off and speed, media on/off, play, pause and mute - one tap for a switch; cover movements
  (open, close and the position slider alike) arm on the first tap and run on the second, since they move
  something physical. Locks, alarm panels, cameras and sensors stay read-only here.
- New permission `devices.control` (operator, site_admin, system_admin; not editor - the recorded decision
  that editor has no control stands; not viewer, not kiosk), floor-scoped like `devices.read`, and limited
  server-side to the seven device domains above: a caller who holds only `devices.control` gets an audited
  403 on lock, alarm, siren, script, scene and button actions, whatever the allow-list says. The existing
  action endpoint, envelope and audit are reused; `ha.entity.control` keeps exactly its old rights.
- Honest optimistic UI: a pending command shows "ממתין לאישור" and the row keeps showing what Home Assistant
  last reported; "אושר" only when the state or the reporting attribute confirms the request (position,
  speed, mode, target, volume, mute - with a small tolerance, fan speed on the step HA really runs); an action
  with nothing observable shows "נשלח", never "confirmed"; a timeout or error rolls back with a note; a new
  slider value supersedes the command in flight; Stop cancels a movement in flight and is never disabled.
- **Bridge integration 0.2.4** (the HA-side allow-list learned the new services). Home Assistant must be
  restarted once after this update so the bridge loads; until then the new actions answer
  `service_not_allowed` cleanly. A new test fails whenever an add-on action is missing from the bridge's
  allow-list, in either copy, so this drift cannot recur.
- Reviewed three times: the first review found the permission reaching locks and scripts, the bridge not
  updated, cover open/close never confirming, three sliders always reporting failure, Stop disabled while
  moving, and the pending state not honest enough - all fixed by an escalated agent; the re-review approved
  with two nits (fan-speed tolerance, Stop superseding), fixed. Tests: 34 backend across five files, 30 live
  on desktop and phone incl. two through the real action route against a fake HA-side bridge.

## 0.1.114 (pilot) — WisKey person editor (CR-005 phase 2, slice A1)
- The first write to WisKey's people store from this product: create, edit and delete a person - identity,
  employee number, validity (permanent or a date range), PIN with "generate a unique PIN", cards entered by
  number and shown masked (`•••• 1234`, all WisKey ever returns), station assignments with their relays -
  opened from the People directory. Weekly schedules, station-native schedules, photos, card capture and
  group editing follow in slices A2/A3 (the form says so; nothing is stubbed).
- New installation permission `access.people.manage`, granted by default to site_admin and system_admin
  only, listed as sensitive; grantable to one person through a custom role, as the owner asked.
- The write path is the door-release pattern: permission before the body, JSON only, a command id with a
  short server-clock expiry, an audit attempt row before sending and an outcome row after, under the real
  SMPLWISE actor - never a PIN, card or phone in any row, log or error. Every WisKey error code classified as
  "refused" was proven from WisKey's source to be raised before its store is written (collisions, revision
  conflicts, storage stopping); everything else is reported as "outcome unknown". People writes run on their
  own feed lane, so a stalled save can never block a door release or a read.
- Found in the adversarial review and fixed before release: removing a relay from a person's existing station
  was silently ignored by WisKey when sent in the absolute `assignments` form, while the screen said "saved" -
  the editor now sends exactly what WisKey's own panel sends (`permission_overrides`, `door_permissions`,
  `access_policy_revision`), the legacy form is refused, the committed fake WisKey runs a copy of WisKey's own
  permission rule so the bug would have been caught, and a live test walks add → save → reopen → remove →
  reopen. Verified by running the payload through WisKey's real code for four scenarios.
- Open owner question recorded in CR-005: a generated PIN is shown only in a password field (as in WisKey), so
  the admin cannot read it to hand over. Tests: 143 intercom tests (50 new), live editor 8/8 and people 7/7.

## 0.1.113 (pilot) — Plan Studio 3D quality level 2 (CR-006 slice 1a)
- Owner request (2026-09-28): the 3D floor map should reach the visual level of the isometric dashboards the
  owner showed, in a first phase with no external products. This release adds a second real-time quality level
  of the existing three.js scene: a true isometric preset on an orthographic camera (the old 31° view stays as
  "פרספקטיבה"), a sky backdrop from new design tokens (both designs), hemisphere + sun light with soft shadows
  fitted to the floor, standard materials with a rough floor and translucent glass, ACES tone mapping, baked
  contact occlusion under walls and objects, cutaway walls (the walls between the camera and the interior drop
  to 0.7 m, with a dark section cap), a light level-2 wall tone, and a thumbnail strip of the levels.
- Level 1 stays as it was and is the automatic fallback: a short fps probe (paused while the tab is hidden)
  drops a weak device to level 1 for the session and says so. Quality is chosen per browser; the installation
  default is a new setting `plan.quality` (default 2). Recorded change to the "level 1 exactly as before" rule:
  the floor map's default "איזומטרי" preset is now a true isometric at both levels.
- Reviewed twice (adversarial): round 1 found floating slivers where cut walls were only squashed, thumbnails
  rendered without colour-space conversion (near-black), a background-tab probe trap, thumbnails redrawn on
  every state push, and a double build on mount - all fixed; round 2 approved with small nits carried into
  slice 1b (thumbnail scheduling, narrow-canvas framing, a settings-wait timeout). Numbers: `three` chunk
  154.6 KB gzip (unchanged), the 3D element 13.9 KB; 60 fps on the sample floor at both levels; on the
  3,000-chair floor level 2 runs 30-40 fps (objects then cast no shadows) - the heavy-floor and phone budget
  for level 2 is slice 1c's acceptance criterion. Tests: 12 new unit specs, 70 existing 3D specs green, 12 live.
- Next: slice 1b - the state layer (room tints by light/presence/open door, temperature chips, presence fade as
  an option), on the 2D map as well; slice 1c - determinism/visual regression and the phone budget.

## 0.1.112 (pilot) — Electricity and device control area, slice 1: read-only tree and area screen (CR-007)
- Owner request (2026-09-28, approved from a mockup): a new top-level area "חשמל והתקנים" - a tree of floors
  and areas, and an area screen with automatic cards per device type, "as visual and convenient as possible",
  for one area or the whole building. This slice is read-only: nothing on it acts on a device yet; single-entity
  control, floor/area/building "off" actions, screens and remotes, the layout editor and the second style
  follow as their own releases (CR-007 §5).
- Backend: HA's floor and area registries are mirrored locally (migration 0025; a table is rewritten only when
  its own registry call succeeded, so one failed call never wipes the names), and three read endpoints project
  them: the tree with live counts (lights on, switches on, covers open, climate active, screens on, locks,
  alarm), the building counts, and one area's entities grouped into cards by domain and device class (lighting,
  switches, climate, covers, security, media, sensors). Disabled, hidden and diagnostic entities are left out;
  an area without a floor sits under "ללא קומה", entities without an area under "ללא שיוך".
- New permission `devices.read` (viewer and above, not kiosk), scoped like `map.read`: a viewer bound to one
  floor sees only that floor's areas, with a badge saying so - a recorded decision. The scope filter that
  `/ha/entities` and the live socket already used moved into one shared service and is used unchanged by all
  three (the review compared it line by line).
- Frontend: the area in both nav designs (an 8th flat entry / a 6th rail area; the phone bar sizes to the
  visible areas) and on the phone; building screen with KPI row, floors in level order and warm area tiles;
  area screen with breadcrumb, sibling chips and seven cards with Hebrew empty states. Live refresh refetches
  at most once per 400 ms while state pushes keep coming (the first version could starve on a busy installation
  - found and fixed in review) and ignores pushes about other areas.
- Reference: DomusUI (`docs/integrations/domusui/DOMUSUI_EXTRACTION.md`, GPL-3.0 - ideas only, no code).
  Reviewed twice (changes needed → approved with nits). Tests: 10 device tests + 14 related, 8 live tests on the
  phone and 6 on desktop incl. a floor-scoped viewer. Known gap carried to slice 2: no backend test opens the
  live socket as a floor-scoped viewer.

## 0.1.111 (pilot) — Plan image toggle on the history map and the event page
- Owner request (2026-09-26): hide/show the background plan image per viewer on every map surface. The live
  floor map and the plan editor already had it since 0.1.94 (T085, "תמונת התוכנית", remembered per browser
  and floor); this release adds the same toggle to the two surfaces that lacked it, the history map and the
  event page's map card, as a toolbar button next to their existing 3D toggle. Default: shown until toggled.
- Only the raster is affected: calibration, coordinates, structure and the server-side PNG/SVG exports are
  unchanged (a live test asserts the export links are identical after toggling). Reviewed once, approved.
  Tests: 9 live plan-studio tests, 2 live event-page tests (one seeded event on an imaged floor).
- Also in the repository since 0.1.110: CR-006 (Plan Studio 3D visual level, two phases, owner decisions
  recorded) and CR-007 (electricity and device control area, approved from the mockup).

## 0.1.110 (pilot) — WisKey station credential override screen (CR-005 phase 4)
- The per-station RTSP credential override that 0.1.109 shipped API-only now has its admin screen: a card
  "מצלמות עמדות WisKey" on Settings › Connections, shown only to holders of `system.configure`. Per station:
  whether the shared `wiskey_username`/`wiskey_password` account is configured, whether the station has its own
  override and since when, a form to set one (password never pre-filled, cleared after save), and a confirmed
  Clear. Rows left behind by a station WisKey no longer lists are shown as such and can be removed.
- One new read endpoint `GET /api/v1/intercom/stations/credentials` (same permission) listing stations and
  their override state; like the rest of the credential API it never returns a username, password or host.
  DOCS.md now points at the screen instead of a raw PUT.
- Reviewed once. The review found that the live test meant to prove the password is gone from the page after
  saving could not fail (it never looked inside shadow DOM, where every screen lives) - replaced with a walk over
  all shadow roots checking text, attributes and live input values, with a positive control before save so the
  check proves itself on every run. Tests: 93 intercom backend tests, 4 live tests.

## 0.1.109 (pilot) — WisKey station camera stills through go2rtc (CR-005 phase 4)
- Owner report (2026-09-28): the Entry Center cards showed no camera image, unlike the real WisKey panel.
  Each station card now shows a still of its camera, refreshed every 60 s (the cadence the camera wall
  already uses for posters), with a plain reason when there is none (no camera, no host, no credentials,
  go2rtc not configured).
- Owner decision, recorded as a deviation from real WisKey: the still is fetched through go2rtc, never
  from Home Assistant's camera proxy (real WisKey fetches its preview from HA/ISAPI and uses go2rtc only for
  live video). The owner wants one video pipeline for the whole product, NVR and intercom alike. Verified
  against go2rtc's own source: the station stream is registered in go2rtc's memory only (no config write),
  under the product's `smplwise_wiskey_<station>` name, and frames are grabbed by name.
- New add-on options `wiskey_username` / `wiskey_password`: the shared RTSP account for every station,
  mirroring the NVR options. A station that needs its own account gets an admin-only override
  (`system.configure`): a new table `wiskey_station_credentials` (migration 0024), write-only endpoints that
  never return a stored password, every set/clear audited without the secret, excluded from the product's
  backups. This is the first credential the product stores in its own database; the trade-offs are recorded
  in CR-005. No admin screen yet - overrides are set through the API; the screen is a follow-up.
- The station host is read from WisKey's overview (it needs WisKey's `stations` area) and kept server-side
  only; it never reaches the browser, logs, audit rows or the streams listing.
- Reviewed twice by an adversarial security review. The first round found that go2rtc (before 1.9.14) logs
  the RTSP address with credentials each time it is handed a raw source - so the address is now sent only
  once per registration (first grab, credential change, go2rtc restart) and every other grab is by name;
  DOCS recommends go2rtc 1.9.14 or newer. Also fixed: a cache-file race between concurrent grabs (and a
  Windows-only permission error the fix itself uncovered), the permission check now runs before the body is
  read on the credentials endpoint (403 whatever the body), and station hosts are hidden from the admin
  streams listing. Each fix has a test that fails against the old code. Second round: approved.
- Not yet tried against a real go2rtc or a real door station - only the committed fake. The RTSP port is
  fixed at 554 (WisKey does not expose a station's port). First real-station check is on tomorrow's list.

## 0.1.108 (pilot) — WisKey people directory tab (CR-005 phase 4)
- Third WisKey tab `#/wiskey/people`: a read-only people directory (list + details pane) over the
  0.1.105 backend, no backend changes, same `access.read` gate, in both nav designs including the phone
  bottom nav. Ported from the real WisKey people list and person card: search with typing debounce,
  station/rights/state filters and sort, paging with WisKey's directory snapshot, the person status and
  validity logic, the details cache, and WisKey's own Hebrew labels.
- Privacy is the 0.1.105 decision, unchanged: no phones, card numbers, PIN flags or profile values are
  served, so none are shown, and the screen carries no edit/add affordances at all (a live test asserts
  that none of those fields appear against fixture data that contains them). The search box says plainly
  that the text never reaches WisKey (matched by SMPLWISE against name and employee number only).
- Honest states: not a live feed (reload on a WisKey change notice, manual refresh, or a 30s fallback poll
  only while notices are down, with the last-loaded time); a directory that changed under the paging shows
  a banner and a reload-from-page-1 action; a scan that stopped early (scan limit or rate limit) says so and
  marks the total as a lower bound. Group ids are shown as WisKey ids since no group names are served.
- Three documented deviations from WisKey: an offline assignment is shown as offline rather than a
  revision-based synced/pending guess (revisions are not served); "no assignment" instead of WisKey's
  ambiguous "inactive"; disabled grants listed muted instead of hidden, because the disabled filter exists.
- Also added to the repository: `docs/changes/CR-005-PHASE2-BRIEF.md`, a build brief for the next two
  screens (person editor with card capture, door/station technical settings with door programs and
  relay reversal), researched against the real WisKey source, with the open owner questions.
- Reviewed once (approved with nits, none blocking). Known v1 limit: every WisKey change notice refetches
  the page, and a wide text search while a door is busy can exhaust the per-user rate budget - it is
  shown honestly and retried on the next notice; coalescing notices during a search is a follow-up.

## 0.1.107 (pilot) — WisKey activity log tab (CR-005 phase 4)
- Owner request (2026-09-28): give WisKey its own top-level nav tab (not nested under the map), then a
  read-only Activity/Events tab alongside the already-shipped Entry Center overview.
- New tab `#/wiskey/events`: filters (station/person/result/authentication/door/date-range) matching the
  existing `GET /api/v1/intercom/events` query params, "load more" pagination over the `next`/`before`
  cursor, and a detail panel per row. No backend changes - reuses the existing endpoint and the existing
  `access.read` gating exactly as the Entry Center screen already does, in both parallel nav designs.
- Explicitly not a live feed: the screen says so, and only reloads on a WisKey change notice, on manual
  refresh, or (only while notices are down) every 30s, with the last-loaded time always shown. A known,
  disclosed limitation: a door/contact event that doesn't change the Entry Center's own data does not
  reliably trigger a refresh notice today - fixing that needs a backend change and was left for a future task.
- Ported from the real WisKey frontend: the filter set, one-load-at-a-time with a single queued reload,
  the DST-aware local date/time inputs (a time that is ambiguous or skipped by a clock change is refused,
  not guessed), and the storage-failed/history-incomplete notices. Left out because the existing endpoint
  doesn't serve them: saved report presets, CSV export, portraits, masked card numbers.
- One deliberate change from real WisKey: a change notice arriving while more than one page is loaded no
  longer discards the extra pages - it keeps them and shows a note that a manual refresh will reload from
  page 1. Review found this guarantee could still be silently broken if the notice landed while a "load
  more" request was still in flight; fixed by deciding keep-vs-reload at the moment the reload actually
  runs, not when the notice first arrives, with a regression test that reproduces the race and fails
  against the old logic.
- Renamed the existing WisKey tab from "WisKey" to "מרכז הכניסה" (Entry Center) now that WisKey has more
  than one tab, so the breadcrumb no longer reads "WisKey › WisKey".

## 0.1.106 (pilot) — WisKey door release, call control and announcements (CR-005 phase 3)
- Owner request (2026-09-27): implement the physical WisKey capabilities the owner explicitly approved one by
  one, starting with the three that have a ready home on the already-shipped Entry Center screen - door release,
  live call answer/reject/hangup, and spoken announcements. Two-way audio, card capture, scheduled door programs,
  relay reversal and WhatsApp remain separately approved but not yet built, either because they need screens this
  product does not have yet or (two-way audio) because they deserve their own dedicated task.
- New installation-scoped permission `access.release`, granted only to `site_admin` and `system_admin` - not
  viewer, operator, editor or kiosk - since a broader grant would be an undiscussed policy expansion of real-world
  door control; recorded as a deliberate decision.
- Every physical action requires a real, server-enforced confirmation (not just a UI dialog a client could
  skip), carries a command id and a short server-clock-based expiry so a stalled request cannot execute late, and
  is proxied entirely through the existing persistent HA connection and its existing rate limiter and concurrency
  slots - reserved capacity of their own now, so ordinary reads can never starve a physical action.
- Every attempt is audited under the real SMPLWISE actor before the command is sent, including every refusal
  (missing confirmation, already in progress, offline, expired, duplicate) - not only attempts that reached
  WisKey.
- Wording is deliberately honest throughout: a successful response never claims the door opened, only that
  WisKey accepted the command; an unanswered request is its own distinct "outcome unknown" state that
  discourages blind retries, never collapsed into a plain success or a plain failure.
- Reviewed five times, adversarially, as the first physical-action capability this product has ever shipped.
  Four of the five rounds each found a real, distinct way a command WisKey had actually carried out could still
  have been reported back as "refused, nothing happened" - through the audit path, through a reply-shape edge
  case, and twice through the exact set of WisKey error codes that can occur after a command already reached the
  real device. The fifth found a content-type validation gap the fourth round's own refactor had introduced,
  closing a theoretical no-preflight request path. Every finding was fixed and covered with an adversarial
  regression test, not just documentation.

## 0.1.105 (pilot) — WisKey activity log and people directory backend (CR-005 phase 1b)
- Backend-only extension of the WisKey plumbing, ahead of the next two read-only screens (Activity/Events,
  People directory): new command wrappers for `events/list` and `users/query`/`users/get`, new endpoints
  (`intercom/events`, `intercom/people`, `intercom/people/{id}`), all gated by the existing `access.read`
  permission and reusing the one persistent HA connection the Entry Center feed already holds - no second
  connection, and a one-off request's failure never affects the feed's own state.
- Personal data is stripped to only what a read-only list/detail view needs (name, employee number, active/expiry
  status, groups, station assignments) - phone numbers, card numbers, PINs, free-form profile values and photos
  never leave the backend.
- Reviewed across three rounds, the middle one surfacing a real, owner-decided privacy question: WisKey's own
  text search matches phone and card digits server-side with no way to scope it, so a plain viewer could have
  reverse-engineered people's phone and card numbers through repeated searches even though the raw values are
  never returned. Fixed per the owner's decision by moving the search entirely into SMPLWISE's own backend - the
  search text itself never reaches WisKey; records are paged, stripped, and matched locally against name and
  employee number only. A final adversarial review attempted several concrete extraction attacks against this
  fix and found none that succeed. Also added: a local rate limiter in front of the new calls (WisKey's own
  budget is shared with the feed's periodic refresh, so an unrestricted read path could have starved it for
  every user), and a non-blocking concurrency slot so a burst of requests fails fast instead of parking backend
  worker threads.

## 0.1.104 (pilot) — WisKey as a genuine top-level nav tab
- Owner correction (2026-09-27): "first of all, it put WisKey under the map - I want it as a tab parallel to Map,
  Investigation and System." A prior release placed the new WisKey screen as a sub-tab under the existing
  sites/map nav group, to avoid adding a 7th entry to a previously-established six-flat-top-level-entries design
  constraint. The owner has now explicitly overridden that call.
- WisKey is now a real top-level destination in both of this codebase's nav designs: a 5th icon-rail area
  (parallel to Live/Map/Investigation/System) and a 7th flat entry in the boards design - a deliberate,
  owner-directed exception to the six-entry design constraint, recorded as such. New route namespace
  `#/wiskey/overview`, structured so future phases can add sibling tabs without restructuring again.
- Reviewed twice: the first pass found WisKey was completely unreachable from the phone bottom nav in both
  designs (a hardcoded 4-item slice in one, a hardcoded 4-column grid in the other) - the implementer's own live
  tests had only checked the desktop-shaped rail, which is hidden on a real phone, so this slipped through
  unnoticed. Fixed with a real overflow menu and a corrected grid, this time verified against the actual
  mobile-visible element. A second pass found the new overflow menu could be left open after navigating away
  through a different control; closed on any route change or Escape.

## 0.1.103 (pilot) — fix: strict camera order and stretched-fill wide tiles
- Owner report (2026-09-27, real lab screenshot, on 0.1.101): the camera arrangement did not come out right -
  wanted the cameras back in their prior order, and the wide-tile picture running edge to edge rather than
  centered.
- Root cause of both symptoms was the same feature area, from two different mechanisms: `grid-auto-flow: dense`
  (added in 0.1.100) could pull a smaller camera ahead of an earlier, wider one to backfill a gap - this is what
  actually moved cameras out of order, not any save/data bug (verified clean). The wide-tile picture issue was a
  genuine remaining gap in 0.1.101's own fix.
- Two product decisions, made by the owner: cameras now render in exactly their saved order, always (grid
  placement switched from dense to plain row order, with an exact row-count calculation replacing the previous
  dense-packing estimate); a wide tile's picture is stretched to fill completely (no cropping, full field of
  view, proportions distorted when spans differ from the source's own ratio) rather than cropped, via a new
  isolated `fill` framing option that does not affect any other camera tile, poster, or kiosk view.
- Reviewed across three rounds: an initial fix was believed complete after restoring 0.1.100's row-height model,
  but a scoped re-review proved with real browser measurements against the owner's exact camera layout that
  dense-flow reordering was still present and unmeasured by the first test; the corrected test now proves the
  strict-order fix by construction, not just by example.

## 0.1.102 (pilot) — WisKey Entry Center, read-only (CR-005 phase 1a)
- Owner request (2026-09-27): embed the owner's own WisKey Home Assistant intercom integration as a new tab,
  full parity over several phases, porting the real WisKey frontend rather than redeveloping it from a command
  inventory - WisKey stays installed and remains the sole authoritative writer, SMPLWISE only talks to it over
  HA's own WebSocket API. This is the first slice: a read-only Entry Center screen - station cards,
  online/ringing state, last-access summary - no door release, no calls, no editing. Physical actions are
  separate, later phases, each needing its own explicit approval.
- New permission `access.read`, granted viewer and above (installation scope only - WisKey stations are not
  mapped to sites/floors); the grant is recorded as a deliberate decision in CR-005, since it exposes real names
  and employee numbers via last-access records.
- New backend: a thin WisKey `overview` command wrapper plus a background HA WebSocket connection (modeled on
  the existing HA sync pattern) relaying WisKey's push signal and relevant entity state changes to the browser,
  polling only while a client is actually watching. Honest degraded states throughout (not configured,
  connecting, HA unavailable, not installed, forbidden, error) with a stale-cache banner rather than ever
  inventing data.
- New screen, ported from the real WisKey source (the "needs attention" rule, ringing rule, search/filter,
  recent activity ordering, DST-aware time formatting all carried over, not re-derived), re-skinned onto this
  product's own design system. Reached via the existing "sites" nav sub-tab, relabeled WisKey.
- Reviewed three times across two review rounds: fixed a real gap where an HA restart was misread as "WisKey
  not installed" for up to five minutes; fixed scoped (site/floor-bound) users seeing the tab but being refused
  when they opened it; fixed the WisKey tab disappearing entirely when the map is hidden, in both nav designs
  including a previously-unfiltered phone bottom bar; plus reliability fixes to the shared HA WebSocket session
  helper, polling, and recovery timing.

## 0.1.101 (pilot) — fix: spanned camera tiles keep their real shape instead of letterboxing
- Owner report (2026-09-27, with a screenshot from the live lab): a camera set to span 2 grid columns on the
  all-cameras wall showed its picture squeezed into about half the tile, with a solid black band filling the rest.
- Root cause: the 0.1.100 fix widened a spanned tile's own aspect ratio (e.g. 32:9 for a span-2 tile) so it would
  stay the same height as its neighbors. A real camera stream is genuinely 16:9, and the live player deliberately
  uses `object-fit: contain` so a security camera's field of view is never cropped - forcing a real 16:9 stream
  into an artificially wider box just letterboxes it.
- Every tile, spanned or not, now keeps its true 16:9 shape. A spanned tile is now bigger in both width and height
  (a hero tile in a photo grid), instead of a same-height wide strip with black space.
- Reviewed twice: the first pass found the wall's row-count estimate for sizing tiles assumed CSS Grid's dense
  auto-placement always achieves ideal bin-packing, which is false for some realistic multi-wide-span
  combinations (two span-3 cameras plus a span-2 camera at 4 columns actually needs 3 rows, not the 2 the old
  estimate predicted), which could still overflow the screen. Fixed with an exact dense-placement simulation
  instead of an approximation, verified against real Chromium measurements. A second, separate, pre-existing bug
  surfaced during that fix (a fixed, slightly-wrong guess for the space below the grid) and was fixed too.

## 0.1.100 (pilot) — flexible column layout and ordering for the all-cameras wall
- Owner request (2026-09-27): a settings mode on the all-cameras live grid ("כל המצלמות"), gated by permission,
  to set the display order of cameras and let specific cameras - the owner's example: panoramic cameras covering
  the sports hall - span more than one grid column so the layout can be as flexible as needed.
- A new `grid_col_span` (1-4) column on each camera, alongside the existing `sort_order` column that already
  drove every camera listing; both are editable through a new settings dialog on the wall (gated on the same
  `sources.configure` permission the devices screen already uses), with up/down move buttons per camera and a
  column-span choice. Saving renumbers the dialog's rows and every other visible camera consistently.
- A spanned tile widens its aspect ratio to match its column span, so a panoramic camera renders wide rather than
  cropped or double-height, and the best-fit sizing algorithm now weighs each camera by its span instead of
  assuming every tile is the same size.
- Reviewed twice at Opus tier: fixed a colliding task ID, the double-height/overflow rendering bug above, a
  phone-width column-clamp bug, a non-atomic save path with no reload on failure, disabled-camera sort-order
  collisions, and test-hygiene issues (state left dangling for later tests); a second, scoped re-review closed one
  residual edge case (a sparse grid gap could still add an extra row for some span orderings, fixed with
  `grid-auto-flow: dense`).

## 0.1.99 (pilot) — persistent hand-tool pan mode and keyboard-shortcuts help
- Owner request (2026-09-27): after the select tool took over left-drag for its marquee (0.1.96), there was no way
  back to panning without holding Space the whole time. The owner asked for both the existing Space+drag gesture
  and a persistent toggle button ("אני מעדיף גם וגם"), plus a button on the map that lists every keyboard shortcut.
- A new hand-tool toggle in the plan editor's toolbar turns every canvas drag into a pan (bare plan or an object)
  without drawing a marquee or moving anything, on top of the existing Space+drag and middle-button pan gestures;
  toggling it off (a second click, or Escape once nothing else is in progress) restores whatever tool and
  selection was active. It reuses the exact 0.1.98 pan math (an overlay flag alongside the active tool, not a new
  tool of its own) rather than duplicating it.
- A new "?" button opens a dialog listing every real keyboard shortcut in the editor, grouped by topic (selection,
  editing, view/navigation, per-tool), cross-checked against the actual key handlers.
- Reviewed twice: the first pass found two real gaps in the hand tool - a click mid-wall/zone-draft still added a
  corner, and a plain click on an unselected wall, connector or zone still selected it while panning - both fixed
  so a drag-only pan mode truly suppresses every click-based side effect, not just drags.

## 0.1.98 (pilot) — grid, snap and alignment guides
- Owner request (2026-09-26): line up several placed objects (their example: five lamps) on the same line easily
  - the third and last of the multi-select pieces (0.1.96 multi-select, 0.1.97 tags). A toggleable grid with snap
  while dragging or placing an object, following the measure tool's own estimated-versus-measured convention
  before and after calibration (0.5 m default, size-named presets when metres are hidden); live smart alignment
  guides while dragging a single object, snapping per axis independently against the grid; from the multi-select
  bulk panel, align (left/right/top/bottom edges, center horizontal, center vertical) and distribute (horizontal,
  vertical) 2 or more (align) or 3 or more (distribute) selected objects relative to the selection's own bounding
  box, as one document edit. Ctrl/Cmd held during a drag turns both grid and guide snapping off.
- Reviewed twice at Opus tier matching the other two multi-select pieces, with one fix round: align and
  distribute's cost had grown with selected × total objects on the plan (a 2.4-3.6 second freeze at the
  documented 5,000-object limit, the same class of problem 0.1.96 already fixed once) - now one pass, measured at
  25-80 ms; a guide could point at an anchor-bound object's stale stored position instead of where its anchor
  actually sits on screen, now resolved from the same live position the canvas itself draws; guide detection was
  rebuilt from scratch on every pointer move during a drag, now cached and sorted per drag (roughly 0.1 ms a move
  instead of 20-25 ms).
- Found along the way, confirmed pre-existing and unrelated (a day before this branch started): a small selected
  object at low zoom is fully covered by its own stretch handles, so a second press stretches it instead of
  moving it - exactly the owner's lamp-lineup case. Queued as its own small follow-up, not fixed here.
- Also fixed in passing: the level chip bar was off-centre under RTL, hiding the "+ מפלס" chip at some widths.
- Tests: node unit (grid-snap math, align/distribute position math verified against the prior per-object version
  as an oracle, the grid-versus-guide tie-break, the sorted-array guide search against a full scan); live (grid
  snap, a guide appearing and snapping a drag, bulk align and distribute as one undo step).

## 0.1.97 (pilot) — free-text tags on walls, objects and zones
- Owner request (2026-09-26): free-text tags for marking and later fast selection (e.g. "kitchen", "emergency
  exit" - not a replacement for a wall's existing exterior/interior kind), and group assignment to a level or a
  circuit - the second of three planned multi-select pieces (grid and alignment tools follow).
- A tag is trimmed, its inner whitespace collapsed, merged with any other spelling that differs only by case (the
  first spelling kept), and bounded (20 tags per item, 40 characters each) - one shared rule used by the document
  validator and the zone API alike, so the two places a tag can be edited cannot drift apart. Migration 0022 adds
  the zones table's tags column.
- Tag editing (chips plus a text field) is in the object, wall and zone inspectors, and in the multi-select bulk
  panel added in 0.1.96 for editing several items' tags at once. From the same bulk panel, a selection can be
  reassigned to a level, or added to a circuit (only light-role objects join, the same rule the existing
  single-object toggle already used). A small dropdown beside the level chips turns any tag back into a
  selection, scoped to the active level the same way Ctrl+A already is.
- Reviewed at Opus tier given the migration and schema involvement, with two fix rounds: a real server-side
  dedup gap (fixed with the one shared rule above), three different rules for which objects could join a circuit
  unified into one, a bulk level move that could leave a selection spanning two levels after a partial zone-save
  failure (the same class of bug 0.1.96 fixed, recurring in this new bulk path), a design-doc update, and a
  low-severity validation-ordering gap (an oversized raw tag list was fully processed before its count was
  checked, now rejected up front).
- Tests: node unit (tag rules, circuit eligibility); backend (the shared tag rule's bounds and dedup, the zone
  route, the geometry store); live (single and bulk tag editing, bulk level and circuit reassignment, select by
  tag, the partial-failure path).

## 0.1.96 (pilot) — multi-select of walls, objects and zones
- Owner request (2026-09-26): select several items at once and act on them together - the first of three planned
  pieces (tags and bulk reassignment, then grid and alignment tools, follow). Shift+click toggles a wall, object
  or zone into or out of the selection; a marquee drag on empty canvas selects every fully enclosed item; Ctrl+A
  selects everything visible under the active level filter. Bulk move, delete and duplicate (objects only) each
  commit as one document edit (one undo step for walls and objects); the canvas's existing multi-highlight
  rendering, already used for groups and circuits, is reused rather than a new visual language.
- Space+drag pans the plan (over the bare canvas, over items, over pins) without disturbing keyboard focus on a
  button or field; the select tool's left-drag now draws the marquee instead of panning, so this is the way to
  pan without a middle mouse button.
- Reviewed twice at Opus tier with two fix rounds given how foundational this is: fixed a real concurrency bug (a
  second group drag while the previous drop's zone saves were still in flight could silently lose or corrupt the
  move - refused now, with the zone saves sent together and a 15 s timeout so a hung request cannot block bulk
  actions indefinitely); a level-filter data-loss risk (Ctrl+A or the marquee under a filter sweeping in zones
  from other levels, including a correction to the fix itself once review showed an unset zone level had to count
  as the default level, matching the rest of the codebase, or nearly every zone stayed exposed); a broken drag on
  hybrid touch+mouse laptops; and quadratic-time hot paths that could matter on a large plan.
- A partial failure in a bulk zone move or delete is now reported (how many of N did not save) and the affected
  zones stay selected for a retry, instead of failing silently.
- Found along the way, confirmed unrelated to this change (no publish or backend code touched here, reproduces on
  the unmodified prior release too): a large object group present in a draft can go missing from the published
  document. A real, separate publish-path defect - queued as its own task, not fixed in this release.
- Tests: node unit (pure multi-selection operations, composed from the existing single-item ones); live coverage
  across five spec files for shift-click, the marquee, Ctrl+A under a filter, bulk move/delete/duplicate, the
  concurrency guard, partial-failure reporting, panning and hybrid-touch dragging.

## 0.1.95 (pilot) — the Lovelace card finds its own add-on
- Owner report (2026-09-26, with screenshots): adding the SMPLWISE card to a real Home Assistant dashboard failed
  with "[object Object]" and no visual editor. Root cause was worse than a hardcoded add-on slug guess: current
  Home Assistant refuses the REST API path the card used to reach the Supervisor for every call except admin logs
  and backups, so the card would have failed on any real installation regardless of the slug.
- The card now discovers its own add-on - a manual override, the add-on's own sidebar panel, then the Supervisor's
  add-on list - over the same websocket API Home Assistant's own frontend uses; shows a readable reason for every
  failure shape instead of an unhelpful object dump; renews an expiring Ingress session when the card is
  re-attached to the page or its keep-alive fails, instead of getting stuck at a 401 after 15 minutes away; and
  ships a real visual editor (view, camera, floor, height, title) instead of falling back to a raw YAML box.
- Bridge integration bumped to 0.2.3 (from 0.2.1). Not fixed here, and lower severity (a config-flow form default
  a person overrides during setup, not a silent runtime dependency): `const.py`'s `DEFAULT_ADDON_URL` carries the
  same repository-hash-prefixed placeholder; the add-on's own setup already announces its real hostname, so this
  default is never actually reached in practice.
- Tests: the card is now exercised by a Node script that loads and runs it against a fake `hass` (11 cases,
  wired into `test_lovelace_card.py` via a Node-discovery fallback), not only asserted against by source text.
  Verified: node syntax check, the card's own test file, the full backend suite (373 passed). Not verified: a real
  Home Assistant dashboard, Supervisor, and Ingress session - the owner needs to update the integration and try
  the card again to confirm.

## 0.1.94 (pilot) — hide the plan background image
- Owner request (2026-09-26): after building the structure on a map, hide the loaded plan image (the scanned PDF
  or photo) and see just the drawn structure, cleanly. A new toggle on the live floor map's existing "שכבות
  פעילות" panel and the editor's existing "שכבות" tool (both shown only on a floor that actually has a plan
  image), remembered per floor and per viewer. Hidden, the canvas shows a plain white sheet with a hairline edge
  in place of the image; the structure draws on top exactly as before.
- Not changed: the historical map, the event page and the 3D view keep showing the image as before - this round
  covers the two screens the request named.
- Tests: live evidence-plan-studio (hide, show again, survives a reload, the editor's choice does not affect the
  live map's own).
- Found, not fixed: three unrelated tests in evidence-plan-studio.spec.ts (calibrate/measure, structure publish,
  door drag) are flaky on the unmodified base commit too - a timing race between the draft autosave and
  publishing, unrelated to this change. Recorded for a later look.

## 0.1.93 (pilot) — levels can be edited and deleted; a connector no longer guesses its level
- Owner reports on 0.1.92 (2026-09-26): a level, once created, could not be renamed, have its floor or ceiling
  height changed, or be deleted - `patchLevel`/`removeLevel`/`levelUsage` already existed in studio-ops.ts,
  unused by any screen. The level chip bar gets a small edit button per chip, opening a dialog shared with
  "add level": rename, change elevation/ceiling, make it the default; delete refuses with a readable reason
  when the level is the default or still holds items (the exact count), and otherwise removes it (undo-able).
- A freshly drawn connector (stairs, ramp, elevator, ladder) on a floor that already has a second level used to
  silently pair with that sibling level - confusing when the actual intent was a cross-floor link instead (the
  cross-floor "קשר לקומה" link already overrides this correctly; the auto-guess only caused confusion before a
  person got there). A new connector now always starts unlinked, and its own label reads "לא נבחר" (not chosen)
  rather than the cross-floor wording, until a level or a floor is picked.
- Tests: node unit (existing coverage for the three ops functions); live evidence-plan-studio-2 extended -
  rename and re-height a level with the change reflected in the draft, the chip and the 3D after publish;
  duplicate elevation refused; delete refused with the item count, then allowed once emptied; a fresh connector
  starts unlinked and its wording says so.

## 0.1.92 (pilot) — the circuit panel places new lamps directly
- Owner report on 0.1.91 (2026-09-26): the circuits tool's "add / remove lamps" mode only toggled membership of a
  lamp already placed on the map - clicking empty map space did nothing, so a new lamp had to be placed from the
  library first and only then linked from the circuit panel. The panel now shows a lamp-type picker while that mode
  is on; arming a type and clicking the map places a new lamp and adds it to the selected circuit in one step (one
  undo step - `addCircuitLamp` in studio-ops.ts, composed from the existing `addObject` and `toggleCircuitMember`,
  no document change). Clicking an existing lamp keeps toggling its membership as before.
- Tests: node unit `addCircuitLamp` (places the object, links it, an unknown circuit id still places the object);
  live `evidence-plan-studio-2` extended (arm a lamp type, click the map, the new lamp is on the circuit; the
  existing click-to-toggle path still works; the test undoes its own placement so the suite's later exact-count
  assertions are unaffected).

## 0.1.91 (pilot) — duplicate from the inspector; a double door picks its side
- Owner reports on 0.1.90 (2026-09-26): a copy of an object was only reachable by Alt+drag, which is not
  discoverable, and a double door always opened to the same side of the wall. The object inspector gets a "שכפל"
  button (also Ctrl+D): the copy lands one object width plus 30 cm to the right of the original (below when that
  leaves the plan, to the left when below leaves it too), is selected, and the next drag or arrow key moves it
  (`duplicateBeside` in studio-ops.ts; Alt+drag stays).
- A double or sliding door has no hinge jamb to choose, so its hinge field now picks the side of the wall the leaves
  open to: "לצד שמאל של הקיר" (start, the unchanged default) or "לצד ימין של הקיר" (end). The 2D primitives, the 3D
  leaves (and with them the coverage clipping) and the backend renderer follow the same rule; the panel labels the
  field "צד הפתיחה" for those swings. No document change: the field already existed on every opening.
- Not changed, answered in chat: the select tool ("בחירה וגרירה", the first icon of the rail) already selects and
  moves walls, openings, objects and zones since 0.1.87 - no need to go through the structure tool; a level has no
  area of its own, its extent on the map (and its floor plate in the 3D) follows the items assigned to it; a tribune
  or stairs between two floors is a connector from the "מפלסים ומחברים" tool linked to the other floor with
  "קשר לקומה" (a library tribune object only connects levels within one floor - see the open list).
- Tests: node unit `duplicateBeside` (right, below, left, unknown id), the side rule in `unit-geometry` (2D) and
  `unit-scene-builder` (3D, double and sliding), backend `test_a_double_or_sliding_door_opens_to_the_side_its_hinge_names`
  (golden file unchanged); live `evidence-plan-studio-2` (button, Ctrl+D, the copy selected) and
  `evidence-plan-studio` (the field relabels, the draft stores double/end).

## 0.1.90 (pilot) — round 9: the owner form verified by the product itself, one backup fix
- Owner request (2026-09-26): of the 71 items on the round-8 owner form, 59 can be verified without the owner and
  now are - every one of them maps to a passing test (the table is in
  `docs/operations/TEST_ROUND_RESULTS_2026-09-26_HE.md`). The baseline sweep of all 65 evidence specs in real
  Chrome: 123 tests, 85 passed, 36 BLOCKED on the same preconditions as the 2026-09-24 round (fresh events, the
  NVR / go2rtc, a connected HA), none stale, one product defect.
- Fixed: a backup restore in merge mode reported every row the archive held as "restored", including rows that were
  already present and skipped (`INSERT OR IGNORE`). The counts in the answer and in the audit trail now come from
  the cursor's row count, so a merge over an unchanged project reports zeros; replace mode is unchanged
  (`services/backup.py`, owner form item 15).
- New coverage written for the items the specs did not assert yet: the Plan Studio rows (structure, catalog items,
  zones, anchors) survive a backup round trip in both restore modes; a published drawing imported again in another
  crop carries its structure and the map shows the new crop (item 19); the tilted, noisy scan runs through the
  editor's detect tool with a rejected candidate and an accepted rest, well under the 60 s guard (item 55); the
  exported glTF passes the Khronos validator with `EXT_mesh_gpu_instancing` as its only required extension
  (item 66, `gltf-validator` as a devDependency); the 7א/7ב wording (drag in door mode, arrows, Shift, the distance
  field and Enter, then a map click and an arrow); the circuit from a seeded switch and the map half of the toggle
  with the action route answered in the browser (items 37, 38); the event page map card and its history link on a
  throwaway instance with one synthetic event (items 11, 26); and a spec for the remaining items without an
  assertion of their own (items 10, 30, 44-48, 54).
- Two behaviours recorded for the owner's decision, unchanged in this release: a merge restore does not bring back
  a soft-deleted floor, zone or anchor (replace mode, the dialog's default, restores everything); the event page's
  map card shows the floor's current structure while "המשך חקירה במפה" shows the structure at the event time.
- What stays owner-only (9 items on the round-9 form): the store update, the Lovelace card in the real HA, a real
  NVR event, a switch toggled through HA, the feel on the owner's PC and phone, and the owner's own building
  (detection on the real scans, the 3D look, a real multi-level floor).

## 0.1.89 (pilot) — a setting for the default levels view
- Answers open owner question (ב) from the phase 4 checklist (2026-09-26): every map defaulted to showing all levels
  together, with no way to open on one level instead. A new setting `plan.levels` (Settings, mirroring
  `plan.estimates` end to end) chooses the default: "כל המפלסים יחד" (all levels together, unchanged default) or
  "מפלס ברירת המחדל של הקומה" (the floor's default level only). The level chips still switch levels from there in
  every view that has them; a document without levels, or with a single level, behaves the same either way.
- Applied once per floor load on every map surface: the live floor map and the plan editor (the level-follows-
  selection rule and the detect tool's level handling are unchanged; their chips make the cull recoverable), and,
  on the historical map and the event page (neither has a level bar to recover a hidden anchor with), the 3D
  structure only - walls, objects and zones cull to the level, but cameras and entities keep showing on every
  level there (`SceneInput.anchorsEveryLevel` in scene-builder.ts), matching what the 2D already did and never
  hiding, matching the event's own camera from "מבט מהמצלמה". The live map and the editor 3D are unchanged: their
  chips already cull anchors along with the structure, and stay that way.
- Fixed during review, before this release shipped: the first pass fed the setting into every level check the 3D
  builder makes, including anchors, so a history map or event page opened with `plan.levels=default` silently
  dropped every camera and entity on a non-default level from the 3D (with no chip there to bring it back), while
  the 2D kept showing them - the two disagreed, and an event on such a camera could open with no camera in
  "מבט מהמצלמה" at all. `SceneInput.anchorsEveryLevel` above is the fix.
- Backend: `plan.levels` (default `"all"`, values `all | default`) added to `GET/PATCH /settings` with the same
  `system.configure` permission and audit trail as the other settings.
- Still open: owner question (א) from the same checklist - an unlocked lock currently draws its door closed (only
  open / opening / on opens the leaf and clears camera coverage) - is unchanged in this release.
- Tests: backend `test_plan_levels_setting_defaults_to_all_patches_to_default_and_audits` (default `all`, PATCH to
  `default` persists and audits, an invalid value is 422); node unit `initialLevel` (all / unset -> null, default ->
  the default level id, no or one level -> null, in `tests/unit-studio-ops-2.spec.ts`) and a `unit-scene-builder`
  assertion (a camera on a non-default level is present with `anchorsEveryLevel` and `level` set to another level,
  absent without it); live `evidence-levels-setting.spec.ts` (the live map and the editor both open on the floor's
  default level once the setting is `default`, the chips still switch levels, `all` shows every level's walls
  again, and the history map 3D keeps the non-default level's camera in its description).

## 0.1.88 (pilot) — Plan Studio phase 4: schematic 3D inside the map, coverage stopped by walls, a true isometric on the building page
- Every map surface gains a 2D / 3D toggle (T087, CR-003, design section 10): the live floor map (also the key `3`), the
  historical map at the chosen instant, and the event page, where the view opens from the camera of the event
  ("מבט מהמצלמה"). The scene is built deterministically from the published structure: walls with their height and
  openings (a lintel over a door, a sill and a head around a window, a passage as a gap; the door leaf turns 80° when
  its entity is open), library objects (boxes, cylinders, extruded polygons, stepped tribunes, composite items - drawn
  as one box for now, their mesh parts do not reach the client yet), levels as floor plates at their heights, stairs
  and ramps as steps between the levels, elevators as a translucent prism, room floors tinted with room-name sprites,
  cameras as a body with a translucent cone, Home Assistant entities as symbols coloured by their live state - lamps
  glow with a weak point light when on (at most 8 lights glow at once), doors and locks show open / locked. The
  selection is one with the 2D (a click on a camera opens its card with the live tile, a click on a lamp of a circuit
  runs the circuit's existing action with the same permission and confirmation), the layer switches and the level
  chips apply (levels default to all; lower levels stay visible through translucent plates and can still be picked
  through), the presets are top / isometric / from a camera (the in-map "isometric" is a 31° perspective view; the
  true isometric is the building page below), and "glTF" downloads the scene (`plan-3d-<floor>[-<level>]-<date>.gltf`).
- three.js (0.186, MIT) ships as a separate chunk fetched only on the first toggle (measured 153,821 bytes gzip, about
  154 KB, limit 200 KB); the 2D bundle did not grow; the chunk URL is relative, so the Lovelace card (which embeds the
  same floor screen through Ingress) gets the toggle for free. Without WebGL the toggle is disabled with "תלת-ממד לא
  זמין בדפדפן זה" and the 2D map is untouched. Frame rate measured in headless Google Chrome on this workstation (not
  a phone, and not necessarily what a loaded real session gets): a sample floor `fps=60 parts=37`, a 3,000-chair floor
  `fps=60 parts=3037` (60 fps is the requestAnimationFrame cap; the evidence asserts >= 20 fps and reports the rest;
  the 3,000-chair figure measures raw instancing - chairs are never hidden by the far-distance cap, none of their
  dimensions exceed the 0.6 m threshold). The phone frame rate is not measured here, and frame rate under a live state
  push was not measured either.
- Camera coverage now stops at the walls of the camera's level, in 2D on every map and in the 3D cone: rays within the
  field of view and the radius stop at the wall parts; a passage and an open door let a ray through; a closed door and
  a window stop it (planning information, not a promise that nothing is hidden). A manual coverage polygon always wins
  over the walls.
- Map anchors carry `mount_height_m` and `tilt_deg` (migration 0021; the anchor panel edits them for cameras only;
  defaults when unset: camera 2.5 m / 10° down, door station 1.4 m / 0°, other entities 1.2 m / 0°); the bundle and
  every anchor answer return them. The history bundle carries the mount height and tilt of the current anchor row (a
  PATCH updates the row in place, so a past instant shows today's values, not the values from that time).
- The building page draws a true isometric of every floor from its published walls (floor plates per level, walls as
  boxes, upper levels drawn over lower ones) instead of the demo rectangles; its thumbnail cache is bounded by the
  listed floors themselves, not by an entry count that could evict a floor still on screen and refetch it in a loop;
  a selected floor's thumbnail tints its wall faces accent; floors without a structure keep the old thumbnail.
- The 3D dims exactly like the 2D: on a stale screen or while the Home Assistant sync is down, every entity and
  circuit state it reads is unknown (a door stays drawn closed, a lamp does not glow), matching the dimmed 2D pins; a
  floor created while the map is already open is reached correctly on a hash-only navigation to it (the cached floor
  tree is re-read once before deciding the floor is missing, instead of redirecting away).
- Fixed in passing: `PATCH /map-anchors/{id}` now honours an explicit null for `label` and `field_of_view_degrees`
  (clearing a label or hiding coverage survives a reload), and no longer bumps the revision or writes an audit row
  when nothing actually changed; when something did change, the audit row now lists only the changed fields instead
  of every field the editor sent.
- Known limits: the SVG / PNG exports keep the unclipped cone (no backend mirror of the clipping in this phase);
  glass, including windows, is treated as opaque for coverage; a bent stair polyline is drawn straight from its first
  to its last point; quality level 1 only (flat materials, no shadows or textures) - PBR, the eye-level tour and
  editing in 3D stay phase 6; a plan without a calibration draws in estimated metres, marked "≈ מידות משוערות"; the
  exported glTF carries no lights and no sprites (empty nodes) and needs a viewer that supports
  `EXT_mesh_gpu_instancing`; cones are not clickable (a camera is selected by its body); the in-map "isometric" preset
  is a perspective view, not a true isometric; the event-page 3D and the phone frame rate stay NOT_RUN in this release
  (no NVR event on a floor with a plan on the developer backend; no real phone on this workstation).
- Evidence: `test_anchor_3d.py` (6 tests: migration, fields, validation, audit), `test_lovelace_card.py` (3 tests: the
  built UI references its chunks relatively), node specs `unit-coverage` (9), `unit-anchor-3d` (1), `unit-scene-builder`
  (8, incl. the pinned description `contracts/fixtures/plan_geometry/sample-v2.scene.json` and a 3,000-chair hall),
  `unit-three-chunk` (2, the gzip limit against a real build), the browser specs `unit-plan-3d` (4: the element, the
  demo floor without a backend, prism-geometry edge cases, the isometric thumbnail) and `unit-plan-3d-view` (7: counts
  by kind and draw calls against the description, the camera presets, picking inside a shared instance group, frame
  scheduling, picking through a translucent upper plate, WebGL context release, and the three element minors - a
  restored WebGL context redraws, a cancelled pointer never selects, the toast sits centred), and the live
  spec `evidence-plan-studio-4` (12 tests in real Chrome: 11 passed, 1 skipped - the live map, a card that never
  floats over the 3D plus stale / blocked / sync-loss states, 2D coverage clipped by walls, the history map, the
  event page (skipped: no NVR event on a floor with a plan on the developer backend), the building page reached by a
  hash navigation to a new floor, the glTF download, embed mode, the WebGL gate, the phone, the anchor fields, and
  the frame rate).

## 0.1.87 (pilot) — plan editor hotfix: walls move as a whole, the select tool selects and drags the structure, bigger object hits, rooms reshape and move in the select tool
- Answers an owner report of 2026-09-25 (ruling R-H87-1): a placed wall could not be moved as a whole; selecting and
  moving items - not only walls - was awkward; and reshaping a room after automatic detection was not discoverable.
- Whole-wall move: once a wall is selected, pressing on its body (not on a corner handle) and dragging moves the whole
  wall - both ends by the same amount, its doors and windows riding along at their place on it, the move cursor on
  its body. Shift keeps the move horizontal or vertical; an end that comes within the corner snap radius of another
  wall's corner lands on it. A first press on a wall that is not selected only selects it, so nothing ever moves by
  accident. The drop is one undo step saved like every edit. The arrow keys move a selected wall with no corner picked
  (1 cm, Shift 10 cm; before calibration 0.2 % / 1 % of the plan's width), a burst of presses being one undo step.
- The select tool ("בחירה וגרירה", the first tool) now selects and drags the structure for a user who may edit it:
  walls (then their corners and body), doors, windows, passages, labels, objects and connectors, with the item's own
  inspector in the side panel - no switch to another tool, no drawing modes. Pins and rooms keep working there as
  before; Delete and the arrow keys act on the selected structure item (a pin that is pressed or dragged becomes the
  selection instead), Esc clears the selection. Ctrl+Z / Ctrl+Y and the undo / redo buttons follow the last edit:
  after a structure edit they undo the structure (a deleted wall comes back, and repeated presses keep going), after
  a pin edit the pins. A user without the structure permission sees no change.
- Small objects: an object narrower than 24 screen pixels on either side (a 0.4 m chair on a zoomed-out plan is a few
  pixels wide) gets a hit area of at least 24 x 24 pixels around its centre, so a press beside the drawing takes it; a
  big object still never covers a small one inside it, and an object against a wall keeps its whole hit area. On a
  touch screen a wall's pick band is 20 pixels wide, and every item (wall, object, door, window, label) moves only once
  it is selected - a tap selects it, a finger drag over an unselected item pans the plan - so panning a furnished plan
  never moves anything.
- Rooms and zones in the select tool: a click on a room (also one detected and saved automatically) shows its corner
  and midpoint handles at once; dragging a corner reshapes it, dragging a midpoint adds a corner, and dragging the
  room's body now moves the whole polygon (shown live, saved with one request on release, with the room's revision;
  the room keeps its new shape while the save is answered and takes no second drag until then).
  A press on a corner without moving selects it and Delete removes that corner (a room keeps three); the room panel
  says so in one line: "גרור פינה כדי לשנות צורה, גרור נקודת אמצע כדי להוסיף פינה, גרור את הגוף כדי להזיז; Delete על
  פינה מסיר אותה".
- On a phone the same presses work by touch for single walls and objects (wall drawing and arrays stay desktop only).
- Evidence: a new live spec `evidence-editor-move` in real Chrome (select tool: a wall selected by a click, dragged by
  its body with its door keeping its place, nudged and undone, dragged with Shift along one axis, snapped onto another
  wall's end, each drag one undo step, deleted and restored with Ctrl+Z; a pin dragged after a wall was selected is
  the one Delete offers; a 0.4 m object pressed beside its drawn footprint at a zoomed-out view and dragged; a room
  moved by its body and saved once, then a corner removed with Delete; a phone with touch input selecting a wall 8 px
  off its line, dragging it and an object, while a finger drag over an unselected object only pans), unit tests for
  the new document operations, and the phase 1-3 plan studio, zone-corner, editor and viewer live specs unchanged and
  green.

## 0.1.86 (pilot) — Plan Studio phase 3: automatic detection of walls, doors and windows; DXF layers and blocks as candidates
- The plan editor gains a "זיהוי" tool (T086, CR-003): a local detector - Otsu, morphology, Zhang–Suen thinning,
  skeleton tracing, Douglas–Peucker, axis snapping, a chamfer distance transform for the thickness, door arcs and
  window lines sampled in the thin ink - proposes walls, doors, windows and passages as candidates with a confidence
  score, drawn dashed in a layer of their own. Nothing leaves the add-on, no model is involved, no new dependency
  (numpy and Pillow only), and nothing is stored or published by the detector: "אשר" merges what a person kept into
  the structure draft ("קבל הכול", "קבל מעל 0.8", "קבל לפי סוג", a click toggles, an end of a candidate wall can be
  dragged first, "החלף אוטומטיים קודמים" replaces an earlier run); accepted items carry a source badge in the panel.
- A plan that was never calibrated receives a calibration hint from its door widths (the median single door taken as
  0.9 m); "השתמש בהערכה" records it as an estimated calibration, so every metre shows "≈" until a two-point
  calibration replaces it (design 6.3); an estimate never replaces a measured calibration without `replace_measured`.
- DXF drawings skip the raster path: the import flow shows every layer with its entity count, a sample and a suggested
  target (walls / doors / windows / objects / rooms) and every block with a suggested library item; "ייבא כמועמדים"
  turns double lines into walls with their real thickness, arcs into doors with the drawing's swing, window lines
  into windows and blocks into objects, all in real metres, and opens them in the editor's candidates layer. Room
  outlines go to the rooms layer through the existing zones accept.
- A committed synthetic test-plan set (six 1600 px plans with ground truth, generated by a script) pins the
  baseline: walls >= 90 % of the length (precision >= 80 %), doors >= 80 %, windows >= 60 %, under 15 s per plan;
  the release measured 6 plans: walls recall >= 0.974, precision >= 0.969; doors 21/21; windows 17/17; slowest 1213 ms.
  Real scans stay private; the same metrics run on them locally (`scripts/plan_detect_private.py`). On three real
  scans rendered at 3000 px the detector found 46-168 walls, 6-20 passages and 0-9 windows per scan, but NO doors
  (their door arcs are thin, grey and hinge-centred on the wall face, not what the arc test looks for); those scans
  have no ground truth, so this is not an accuracy claim, only a known limit. Door detection on real scans is a
  known limit of 0.1.86: the door-width calibration hint does not appear on them, and the accept screen lets the
  user add the doors by hand.
- API: `POST /plan-versions/{id}/detect` (synchronous, a worker thread with a 60 s guard, 504 `detect_timeout`),
  `POST …/detect/accept` (the draft's revision rules, 409 `stale_revision`), `GET /plan-assets/{id}/dxf/entities`,
  `POST /plan-versions/{id}/import-dxf-geometry`; `PATCH …/calibration` gains an `{estimate}` body for the door-width
  hint; audit `geometry.detect`, `geometry.detect.accept`, `geometry.import`. No migration.
- Evidence: seven new backend test files (the fixtures, the primitives, walls, openings, the baseline, the API, the
  DXF mapping), node unit tests including `unit-plan-detect.spec.ts`, the live spec `evidence-plan-studio-3` (five
  tests in real Chrome: detect / accept / toggle / confirm / undo and redo, the calibration hint, refusals, the
  phone, the DXF mapping screen).
- Known limits: a door whose arc is drawn inside a hatched fill reads as a passage; a stub beyond an L corner may
  read as a passage; doors 15-30 cm from a corner can be missed; vertical stripes (tiles) can read as walls; text
  drawn over a wall fragments it; free-standing walls shorter than ~8 thicknesses at 20 px can be dropped. Double
  doors keep no swing side (schema). DXF: a user cannot mark a block the server suggests as an object as "not an
  object" (needs a backend value, next version); walls clipped at the crop edge are clamped per coordinate; changing
  the DXF options after import can misalign candidates (re-import). The level filter is not applied to detection
  (candidates land on the default level).

## 0.1.85 (pilot) — Plan Studio phase 2, part 2: arrays and custom items, levels, connectors, lighting circuits, search focus
- Part 2 of 2: finishes the phase-2 plan (tasks 10-14) on top of part 1 (0.1.84, above), which already shipped the
  object library, the document model, the renderers and every map surface's object/connector layers. This part adds
  the editor tools that create and manage that content, and the global-search focus that part 1 deferred.
- Library panel: an **array** places a selected object in rows x columns as one group (moved together; deleting asks
  "מחק הכול" / "השאר את העצמים" in an in-page dialog, not a browser confirm); "צור פריט מזה" turns a placed object
  into a custom library item ("based on" the built-in one); "ייצוא הספרייה המותאמת" downloads the custom set as
  JSON and "ייבוא" of that file reports how many were added versus replaced by id.
- **מפלסים ומחברים**: level chips over the canvas ("כל המפלסים" / one level), an add-level dialog (name, floor
  elevation, ceiling height), and a level field on zones and anchors so rooms and entity pins can be assigned to a
  level too. A connector tool draws stairs, a ramp, an elevator and a ladder between two levels with two clicks and
  draggable corner vertices; "קשר לקומה" links a drawn connector (stairs, elevator, ramp or ladder) to the matching
  id in another floor's draft across the same building.
- **מעגלי תאורה**: an editor panel backed by the synced HA switch catalogue creates a circuit (one switch entity)
  and toggles lamps in and out of its membership, with the live power sum. On the live map the circuit's lamps glow
  while its switch is on, and the circuit button toggles the switch through the existing entity action route (no
  new HA permission: this is `ha.entity.control` in the floor's scope, as for any other entity), so it shows the
  same "נשלח · ממתין לעדכון" / "אושר" progression and is disabled for a user without control rights.
- Global search: an object result (matched by its label or by the library item's Hebrew/English name, e.g. "מטף")
  now opens the floor map centred on the object with it highlighted, replacing part 1's screen-only jump.
- Phase-2 acceptance scenario exercised end to end: a tribune connector to a level at -1.2 m, sixty chairs placed as
  one array, eight lamps lit across two circuits by seeded switch states, the "מטף" search focus, and a custom item
  round-tripped through export.
- Known product gap, recorded for a later fix, not blocking this release: on a phone the object library sits below
  the plan canvas, and picking an item scrolls the plan out of view before it can be placed; single-object placement
  and movement still work, and arrays and wall drawing already say they need a desktop screen.
- Evidence: see the T085 evidence line in `management/tasks.json` for the real test counts run for this build.

## 0.1.84 (pilot) — Plan Studio phase 2, part 1: object library, levels, circuits and connectors on every map
- Part 1 of 2: this release ships tasks 1-9 of the phase-2 plan (all reviewed). Part 2 (0.1.85) still owes arrays,
  custom items from the editor with the custom-library export / import, level chips and the add-level dialog, the
  connector and circuit panels, the global-search focus screen and the phase acceptance scenario.
- Object library: `catalog/objects.json` ships 153 built-in items across 12 categories with 24 symbols; a custom
  items table (migration 0020) lets a site add its own, each optionally "based on" a built-in one. New API
  `GET/POST/PATCH/DELETE /api/v1/catalog/objects`, `GET /api/v1/catalog/export` and `POST /api/v1/catalog/import`
  for the custom set; all six sit behind a new permission `catalog.manage`, already held by editor, site_admin and
  system_admin, so no existing user loses anything and no role needs re-granting. Every write is audited
  (`catalog.item.*`, `catalog.import`); `catalog_items` joins the backup tables and `catalog_revision` rides in the
  map bundle so a client can tell when its cached library is stale.
- Document v2: rules for objects, groups, levels, connectors and circuits distinguish structural from geometric
  state; `normalize` sums circuit power and derives tribune connectors (`cx-<id>`). A bound object follows its
  anchor's position through save and publish, and un-binds cleanly when the anchor is deleted. A new route
  (`POST /plan-versions/{id}/geometry/link`) links a stairs / elevator connector across two floors' drafts
  (`map.edit` required on both). The map bundle carries circuit states and levels, circuit switches sit in the HA
  scope, zones and anchors gained `level_id`, and objects are in the global search. A search result of type
  "object" opens its floor map, but does not yet centre the view on the object - the `?focus=object:<id>` handling
  that centres and highlights it is part 2 (0.1.85). A developer-only route exposes HA state injection for live
  testing (absent from the add-on build).
- Deterministic object and connector primitives, in Python and TypeScript alike, extend the golden fixture (24
  objects / 7 connectors) and the SVG / PNG exporters (`?layers=`); tribune rows are capped at 60; connector labels
  read the level delta ("↓ −1.2 מ׳", "↕").
- Every map surface - the live floor map, the editor, the history map at a chosen instant, the event page - draws
  objects with their category symbol inside the rotated footprint and connectors with their level delta; a lamp
  glows while its circuit's switch is on. Two new layer rows, "עצמים" and "מחברים", join the existing ones.
- Editor: a library panel (search in Hebrew and English, categories, recents, favourites) places objects by click
  or drag; the object inspector; handles for move, rotate and stretch (Shift keeps the ratio); Alt+drag duplicates;
  arrow keys nudge; and, near an entity anchor with no body yet, the editor offers to bind the placed object as its
  body ("הצמד לישות"). On a phone only single objects can be placed.
- Evidence: see the T085 evidence line in `management/tasks.json` for the real test counts run for this build.

## 0.1.83 (pilot) — precise placement of doors, windows and labels in the plan editor
- Answers an owner report from the 0.1.82 checklist: a door added on a wall could not be moved right or left to
  fine-tune it. In the structure tool an existing door, window, passage or label can now be dragged in every mode
  (select, wall, door, window, passage, label): a press on it drags it, or selects it without moving, instead of
  placing a new one, while a press on a bare wall still places a door. Wall corners stay draggable in select mode
  only (in wall mode a corner is a snap target for the new wall, and a press that close to a corner draws even on
  top of a door). The item moves live while it is dragged and keeps the offset it was grabbed at (no jump to the
  pointer); an opening stays inside its wall, also when it is placed near a wall's end; the drop is one undo step
  saved like every edit.
- No stacked doors: a placing click beside an existing opening, or a few pixels off the wall next to it, selects that
  opening instead of adding a second one on top of it (the hit area of an opening now covers the wall's thickness,
  at least 28 screen pixels, and a click inside an opening's span plus 6 px takes it); no placing dot shows there.
- The arrow keys nudge the selected item in the arrow's direction on screen. An opening moves along its wall towards
  the arrow: Right / Left on a wall that runs across the screen, Up / Down on a wall that runs up it; a key that
  points across the wall does nothing. A step is 1 cm (Shift: 10 cm) on a calibrated plan, or 0.2 % of the plan's
  width (Shift: 1 %) before calibration. A label, and in select mode a selected wall corner (a press on its handle
  selects it; Delete removes that corner, or the whole wall when it would be left without enough corners), move the
  same way. A burst of presses on one item is one undo step, and a press on an item takes the keyboard focus from a
  panel field, so the arrows move the item and never step the field.
- Exact placement: the panel of the selected opening shows "מרחק מתחילת הקיר" (metres from the wall's start to the
  opening's centre, two decimals) on a calibrated plan, or "מיקום על הקיר (%)" before calibration. A typed value
  moves the opening, kept inside the wall, and the field follows a drag live. The door, window and passage modes
  carry a second help line about dragging and the arrow keys.
- Build: the frontend bundles through @rollup/wasm-node because Windows Smart App Control blocks the native rollup
  binary; output unchanged.
- Evidence: a fifth live test in `evidence-plan-studio` - in door mode a door is placed, dragged 40 px (grabbed 4 px
  off its centre) without switching modes (no second door; the distance field changes before the drop), moved by
  three ArrowRight presses that one Ctrl+Z undoes together, selected by a click just past its end and off the wall
  (still one door), placed by a typed distance (t = metres / wall length) and then moved by ArrowRight straight after
  Enter in the field; four new node unit tests for the opening range and the nudge.

## 0.1.82 (pilot) — Plan Studio phase 1: walls, doors and windows on the plan, calibrated, on every map
- The plan editor gains three tools (T084, CR-003): **structure** - walls drawn point by point with snapping to
  corners and to 45 degrees, doors / windows / passages placed on a wall (they cut it), labels, selection, dragging
  of corners, openings and labels, undo / redo and a server-side draft saved two seconds after the last edit;
  **calibrate** - two points and a known distance: the editor calibrates with one pair of points (the API accepts
  several pairs; a multi-pair UI is deferred); **measure** - distance, area and perimeter in metres, marked "≈"
  until the plan is calibrated (the new setting "מידות לפני כיול" / `plan.estimates` hides them until calibration
  instead - owner decision 2026-09-23).
- A draft belongs to the editor: viewers keep the published structure until "פרסום המבנה" (a preview of what
  changes; blocked while the validator reports errors, which are red on the map and listed in the panel).
  Publishing a draft plan version publishes its structure with it and refuses (422) before anything changes when
  the structure is invalid.
- Every map shows the published structure: the live floor map (new layer "מבנה", remembered per floor), the
  history map at the chosen instant (each structure publish has its own period), the event page and the Lovelace
  card, which embeds the same floor screen.
- A new plan version of the same drawing starts from the floor's structure (copied, or mapped through a re-crop,
  with the calibration carried); another drawing starts empty and offers a copy. Restoring a plan version restores
  its structure; backups include it.
- Restoring a backup in replace mode now empties every project table, including tables absent from an older archive
  (for example, an archive from before saved views existed clears the saved views), so a restore leaves exactly the
  archive's content; merge mode is unchanged.
- Exports: SVG and PNG drawn from the same deterministic primitives as the map (a golden fixture pins the Python
  and TypeScript code to the same shapes), and the JSON document.
- Storage: migrations 0018 (`plan_geometry`, `plan_versions.calibration_json`) and 0019 (level columns used from
  phase 2), additive only; 11 new API routes; `/floors/{id}/map` carries a reference to the structure and
  `permissions.structure`.
- Evidence: eight new backend test files, two node unit specs, the live spec `evidence-plan-studio` (four tests in
  real Chrome).

## 0.1.81 (pilot) — the navigation shows what the user may open; the camera screen stops asking the NVR for what it may not read
- Owner decision (2026-09-22, 1.א): the shell hides tabs and areas the user has no permission for. `/me` gained
  `permissions_any` - the permissions held at any scope (union of the allow bindings, minus an installation-wide
  deny), so a floor-scoped viewer, who holds nothing at the root, still sees the map and the live area. `nav.ts`
  maps every tab to the permission its screen's first request needs (`TAB_PERMISSIONS`: events.read for the
  events centre, video.playback for recordings, cases.manage, rules.manage, video.export, system.configure for
  settings / storage / connections, audit.read, rbac.* for users); an area rail entry disappears when none of its
  tabs remain (the live area stays - the overview needs nothing) and opens on its first visible tab when its
  default page is hidden. Tabs the owner hid in the settings (AI search, the map) behave as before. Direct URLs
  still work and land on the 0.1.80 lock panel.
- Owner decision (2): the camera screen asked the NVR for OSD, schedules and smart rules for every user; those
  reads are for administrators and NVR writers (`nvr_write._require_read`), so everyone else got three refused
  requests per camera view. `canReadNvrConfig()` mirrors that rule in the shell and the screen skips the reads.
- Evidence: `tests/test_me_permissions.py` (a floor viewer has an empty `permissions_installation` and the
  viewer set in `permissions_any`; a second binding adds to the union; an installation-wide deny removes from it
  everywhere); navigation verified per role in real Chrome (`nav_verify.cjs`): a viewer gets the live and map areas
  only, an operator also the investigate area without "חוקים והתראות", an editor live and map, the administrator
  everything; `cam_calls.cjs`: the camera screen sends no OSD / schedules / smart request as a viewer or an
  operator and still does as the administrator. Backend suite green, tsc clean.

## 0.1.80 (pilot) — refused saves say why, dialogs take the keyboard, a viewer sees a lock instead of "something broke"
- A value pydantic refuses (an out-of-range retention, a bad time zone pattern, a missing field) came back as
  FastAPI's bare `{"detail": [...]}`, which no screen can read: הגדרות › "שמור" with 5 days of audit retention
  failed without a word. Every validation error now uses the product's error envelope (`code: validation`, a
  Hebrew message naming the field and the rule - "audit.retention_days: לפחות 30" - and the raw errors in
  `details`), so the save shows why it was refused. `describeError` also has a last-resort text for an error
  body with neither message nor code.
- `sw-dialog` moves keyboard focus into itself when it opens (first field, else first button); it used to leave
  focus on the page behind, so a keyboard user tabbed through the whole page to reach the new-role/new-case/new-site
  form. Escape still closes.
- `sw-state-panel`: a refused request ("אין הרשאה…", every 403 the backend writes) renders with the lock and
  without a "נסה שוב" button even when the screen only kept the message - a viewer opening the events centre,
  cases, rules, storage, audit or users saw "משהו השתבש · נסה שוב" until now.
- Round-6 checklist: the audit-retention field lives under הגדרות › "וידאו ומדיה" (next to the export/event
  retention fields), not "כללי" as 0.1.78's notes said; the item points there now.
- Least-privilege walk (new this session): every route opened as a user with no binding, a viewer, an operator and
  an editor - all 32 screens render for each, zero page errors; the no-binding user meets the "no role yet" gate
  everywhere; a viewer is sent to 16 routes it has no permission for (34 refused requests), an operator to 9
  (17), an editor to 15 (33). Not changed, needs a product decision: the navigation does not hide categories
  by permission, and the camera screen asks for OSD / schedules / smart data without checking `nvr.config.*`.
  Record: `docs/operations/TEST_ROUND_RESULTS_2026-09-22_HE.md` section 5.

## 0.1.79 (pilot) — full-system review: every screen walked, every suite run, six fixes, honest device-blocked reporting
- Storage and connections screens showed the word "ApiError" as the reason when a device did not answer; a shared
  `reason_of()` (errors.py) now names the code and the underlying error (`source_unavailable · ConnectTimeout`),
  used by the storage report and the health probes.
- Phone layouts (375 px): `sw-table` cells wrap long unbroken text, so הגדרות › אודיט (details JSON, 644 px) and
  מפה › ישויות HA (entity ids, 484 px) no longer scroll sideways; the playback control bar wraps and hides the
  ×2/×4 speeds the relay refuses anyway (428 px before).
- Playback: the day's events and the case bookmarks are local data - they stay on the bar when the NVR
  recordings search fails (a failure used to drop them together with the recordings).
- Storage screen: the evidence-signing card (the installation's own key ring) stays visible when the NVR does
  not answer; it used to sit inside the "NVR reachable" branch.
- The red "NVR מנותק" system banner under the topbar sat at the topbar's own z-index and, being later in the
  DOM, painted over the Ctrl+K search results: the first rows could not be clicked while the banner showed. It
  now sits one level under the topbar (still above drawers and content).
- Backend: the duplicate `history.ha_secondary` entry in the settings defaults and PATCH model is gone (no
  behaviour change).
- Evidence specs repaired where the sweep showed them, not the product, out of date: custom roles removes stale
  guard bindings a run that died before its cleanup left behind (they hid the expected 403); the ack-all check
  reads its count after the remembered filters applied; the kiosk button has opened its own tab since 0.1.76
  (no `target` attribute); the coverage slider has a number field beside it (`input[type="range"]`).
- Review record: `docs/operations/TEST_ROUND_RESULTS_2026-09-22_HE.md`. Backend suite green (twice), `tsc`
  clean, the demo fixture chain green, and the 86 live evidence specs run in one sweep with the owner's NVR and
  HA unreachable from the workstation the whole evening: 42 passed, 43 failed of which 36 need device data
  (events, recordings, NVR/HA/go2rtc answers) and are BLOCKED, not broken, 3 were the product gaps above and
  4 were specs out of date; after the fixes the 7 touched spec files re-ran green except the 2 tests that still
  need the NVR (notify permissions, a row to hover). Round-6 checklist for the
  owner (0.1.78 + 0.1.79 items, plus the device-only flows the sweep could not reach).

## 0.1.78 (pilot) — audit retention as a setting, a deny option in the role wizard
- Audit log retention was a fixed 365-day constant in code; it is `audit.retention_days` now (30-3650 days),
  editable in הגדרות › כללי next to the export/event retention fields the janitor already used the same way.
- Users והרשאות › שיוך תפקיד gained a "סוג שיוך" choice: הרשאה (allow, the only option until now) or חסימה
  (deny) - the backend has supported deny-effect bindings since the RBAC model shipped (rbac.authorize already
  gives an explicit deny at a scope priority over any allow for the same permission in the same chain), the
  assignment wizard just never exposed the choice. The preview panel switches its copy and icons for a deny
  pick (ייחסמו, not מותר) so it reads as a block, not a grant.
- Evidence: `tests/test_janitor.py::test_audit_retention_setting_controls_pruning` (a real janitor pass respects
  the configured value in both directions - a 40-day-old row survives at the 365-day default and is pruned once
  retention is lowered to 30; out-of-range values are rejected); full backend suite green; live-verified in the
  browser pane against the dev backend - the effect selector renders, the preview panel updates, and picking
  "חסימה" actually creates a `deny` binding end to end (checked directly against `/api/v1/access/bindings`,
  then removed).
- Left for later, deliberately not attempted tonight: per-camera scope (today's finest binding scope is still
  floor) touches the RBAC model itself and deserves its own session, not an unsupervised one; live-session audit
  surfacing in the UI needs new backend session-listing infrastructure first.

## 0.1.77 (pilot) — the camera video no longer outgrows the screen, free-text event search, a friendlier NVR card
- Camera screen: the video's 16:9 box had no height limit, so on a wide desktop (design A has no page max-width)
  it grew taller than the viewport - the controls and the settings accordion needed a scroll to even know they
  were there. The owner caught this live, on 0.1.76, right after it shipped. The video is capped to a sane share
  of the viewport height now, on every screen width.
- Event centre: a free-text field searches the camera's own name and the event's stored details (an HA entity's
  friendly name, a device class - not just the structured type/place/source filters), and "יום / 7 ימים / 30 יום"
  browses ranges wider than a single day. Both combine with the existing filters instead of replacing them
  (T062's last open corner).
- Connections screen: the "מערכת ה־NVR" card used to pack clock, disks, alarm outputs and reboot behind bare bold
  text with no separation - a wall of controls. Each is its own clearly headed section now (icon, label, rule),
  and the page groups the NVR-related cards apart from go2rtc/Home Assistant/storage (round-4 item 1.1, deferred
  at the time to a dedicated pass).
- Evidence: `tests/test_spatial_search.py::test_free_text_search` (camera-name match, details-json match, AND with
  an existing filter, no-match stays a 200 with an empty list, a from/to range reaching outside a single day);
  full backend suite; `tsc` + `vite build` clean; dev-environment verification via the browser pane (video height
  at 1920×1000, the search/range network calls, the NVR card's section structure) - the dev backend's own event
  stream had nothing in the last 24h at the time (alertStream reconnecting), so the three evidence specs that
  depend on recent live events were not re-verified against fresh data tonight; nothing in this version touches
  the code paths they cover.

## 0.1.76 (pilot) — round-5 fixes for everything the owner's round-4 pass flagged, mobile improvement pass
- Custom roles: "בחר הכל / נקה הכל" on both permission groups; saving a new role and auto-assigning it to its
  creator are no longer one failure unit - if the role is created but the auto-assign call fails, the role still
  shows up and the dialog still closes, with a clear message instead of looking like nothing happened. The
  in-dialog error is now a visible banner, not a thin line of text.
- Live wall "עמודות" (columns): the manual override was silently ignored on any window narrower than 768px, or
  before the grid's box was first measured - so the buttons looked broken on smaller screens. A chosen column
  count now always applies.
- Plan editor coverage: `coverage_radius` had three separate controls on screen at once (a "מרחק" slider plus a
  duplicate "טווח" number field + its own slider) - dragging one visibly moved the other. Down to one slider per
  concept (width, distance); the duplicate field-of-view control in the inspector body is gone too.
- `sw-page` gained a `backHref` affordance: a clear, always-visible back control next to the heading. Wired into
  the camera screen, whose only way back used to be the browser's own back button - easy to lose track of inside
  Ingress/kiosk/mobile contexts, which is what "clicking a camera takes over the screen" was actually describing.
- Camera screen: capabilities, manual recording, OSD, details, schedules, detection zones and other cameras all
  move under one "הגדרות מצלמה" accordion, collapsed by default, each setting collapsed inside it too - the video
  is the first thing on the screen again. The manual-record button explains itself when disabled, and says
  plainly that a manual recording has no separate tag - it is found by time on the normal recordings screen.
  "שנה שם" (rename) now only shows for a user who actually holds the permission the endpoint requires.
- `sw-week-grid`: the color legend used to be hidden for a read-only grid or a single-mode one (most recording
  and motion schedules) - it is always shown now, including what an empty cell means.
- The recording-schedule chip inside the schedules card explains why it might be disabled instead of a bare "לא
  זמין", and the card's own intro line spells out that recording schedule lives there too, not on a separate tab.
- Kiosk "open in a new tab": built from the current page's own origin/path/search instead of a bare `#`-only
  link, so the new tab stays on the same Ingress-proxied path instead of possibly landing outside it.
- Export dialog: "צור ייצוא" no longer requires a separate "חשב נפח" click first with no explanation why it was
  disabled - one click estimates (if needed) and creates. The post-creation message names the download step
  explicitly instead of just "the export screen".
- A day with no bookmarks yet showed no hint that Alt+click on the timeline adds one (the hint lived only on a
  chip that doesn't render without an existing bookmark); a persistent line replaces it. The line/region drawing
  hint in the smart-rule editor is more specific about exactly what each click does.
- Evidence: live-reproduced the role-creation flow (many individually-checked permissions, then save) against the
  owner's production installation via Playwright over Ingress - role and auto-assign both succeed, matching the
  code path; TypeScript + `vite build` clean; dev-environment verification of the accordion, back button (desktop
  and 375px mobile), and column override via the browser pane. `docs/operations/TEST_ROUND_RESULTS_2026-09-17_HE.md`
  §סבב 5 lists every round-4 "bad" item against what changed.

## 0.1.75 (pilot) — camera rename from its screen, phone layout of the map, clean worker shutdown
- Camera screen: "שנה שם" in the header renames the camera in the VMS (wall, map, events); the NVR name changes only
  through the OSD section. It used to be reachable only from לייב › בריאות מצלמות ("כינוי מקומי").
- Floor map on phones: one scrolling row of tools (layer icons, the floor select and the editor entry are hidden -
  the floor buttons and the "שכבות" panel cover them), so the plan keeps most of the screen; the entity card shows
  its actions as a two-column grid of full-width buttons (`sw-button[block]`).
- Floor quick buttons list the floors of the current building with unique short labels.
- Export worker: a real `shutdown()` ends the loop at once and a new start never shares the queue with an older loop
  (this was the source of three export tests failing only in full runs). The semantic "today" test no longer depends
  on the hour; `scripts/api_inventory.py` escape warning fixed; `scripts/dev_cleanup.ps1` removes leftovers of test runs
  on the developer workstation.
- Evidence: `frontend/tests/evidence-owner-round11.spec.ts` (4 tests, rename included); full backend suite in one run.

## 0.1.74 (pilot) — owner round 3: NVR writes for the system administrator, events with a camera, map and wall controls
- Permissions (owner decision): the built-in "מנהל מערכת VMS" role now holds every `nvr.*` write permission - the
  NVR cards, OSD, schedules, smart rules and manual recording work for the administrator without a custom role.
  Other roles still need the sensitive permission through a custom role. A new custom role is assigned to its
  creator in the same step ("שייך את התפקיד אליי מיד"), so it no longer looks as if it "did not save".
- Events from the Home Assistant Hikvision integration (`…_<channel>_motiondetection` and the smart types) are
  attached to the camera on that channel - new events on insert, stored ones in a one-time pass at start - so they
  get a picture, the hover strip, playback and the map (this was why hovering did nothing on the owner's list).
- Sites: a visible "מבנה" button on every site card (a second building was only reachable through a bare "+").
- Floor map: quick floor buttons under the floor chip (one per floor, the current one highlighted); "זום בקפיצה
  לרכיב" in the side list - off by default, a jump only centres the item.
- Camera wall: "עמודות: אוטו / 1–6" lets the viewer override the best-fit column count (kept per browser).
- Plan editor › coverage: two labelled sliders - "רוחב" (degrees to each side) and "מרחק" (% of the plan width).
- Entity card on phones: stacked state row and full-width action buttons.
- Evidence: `tests/test_ha_event_camera.py`, NVR tests moved their negative checks to a site administrator;
  `frontend/tests/evidence-owner-round11.spec.ts` (3 tests) and the NVR live specs updated for the new default.

## 0.1.73 (pilot) — label positions (R4), HA recorder as a secondary source (S2), realign (S4), HA notify rules (S5)
- R4: rooms and placed items have "מיקום התווית" (auto / above / below / left / right) in the plan editor; the map, the
  editor and the history map draw the name there (`label_pos` on zones and anchors, migration 0017).
- S2: הגדרות › כללי › "HA recorder כמקור משני להיסטוריה" - when on, the history map asks the Home Assistant recorder
  for entity states the local history does not know and marks them "HA recorder" (`history.ha_secondary`,
  `GET /api/history/period` with the add-on token; any failure leaves the state unknown as before).
- S4: items placed on an earlier plan version - "יישר לפי החיתוך" maps them through the two crops when the new
  version is a re-crop of the same drawing (exact), "אשר מיקומים" re-stamps them after a visual check
  (`POST /floors/{id}/anchors/realign`, audited).
- S5: a rule action "התראה דרך Home Assistant (notify)" with the notify service name, behind the new sensitive
  permission `rules.ha_notify` (custom role); delivery goes through `notify.<service>` with the SMPLWISE title and
  is reported per firing. Three rule templates fill the editor: אדם בלילה, מצלמה מנותקת, דלת נפתחה אחרי שעות.
- Housekeeping: duplicated coverage fields in the anchor models (left by the 0.1.69 patch) removed.
- Evidence: `tests/test_p2_batch.py`; `frontend/tests/evidence-owner-round10.spec.ts` (label position from the editor to
  the map, realign answer, the setting, a template and the HA notify gate) against the dev backend.

## 0.1.72 (pilot) — schedules (B5, C1) and smart rules (B4) written to the NVR
- Camera screen › "לוחות זימון והקלטה": week grids (Sunday first, hourly cells) for the arming schedule of motion /
  line crossing / intrusion (`nvr.config.events`) and for the main track's recording schedule with a mode per hour -
  continuous / motion / event / alarm (`nvr.config.schedule`), plus the "לוח פעיל" flag. Painted with the mouse,
  confirmed in a dialog, recorded with the previous document for a one-click rollback.
- Camera screen › "עריכת כללים חכמים": line crossing (two clicks per line, direction, sensitivity, human / vehicle
  filters) and intrusion regions (4-10 clicks, sensitivity, filters) drawn on the snapshot; both documents written
  (`nvr.config.smart`), the zones view refreshed. The hint reminds that "אדם" / "רכב" events reach the VMS only when
  the channel notifies the surveillance centre. The lab firmware writes shapes and parameters but refuses to enable
  the rule through the NVR (invalidOperation - the camera's VCA resource decides): the write then keeps the shapes
  and says the enable was refused instead of failing.
- Backend: `services/nvr_schedule.py` (TimeBlockList / Track ScheduleBlock / LineDetection / FieldDetection
  documents), `GET /cameras/{id}/schedules`, `PUT /cameras/{id}/schedules/{motion|line|field}`,
  `PUT /cameras/{id}/record-schedule`, `GET/PUT /cameras/{id}/smart`; `components/sw-week-grid`.
- Evidence: `tests/test_nvr_schedule.py`; `frontend/tests/evidence-owner-round9.spec.ts` against the lab NVR (motion
  arming cleared for one day and rolled back, recording schedule unchanged / changed / rolled back, line 1 drawn and
  enabled then rolled back).

## 0.1.71 (pilot) — NVR system: clock / NTP, OSD, alarm outputs, S.M.A.R.T. test, reboot, connection edit
- הגדרות › חיבורים › "מערכת ה־NVR" (read for administrators; every write behind its sensitive permission):
  - D2 clock: the NVR time, its drift from the server clock and the NTP server; "סנכרן לשעון השרת עכשיו" writes the
    server time (manual mode for the write, the mode put back) and "שרת NTP…" rewrites the first NTP server
    (`nvr.config.time`). Clock writes are recorded without a previous document - they cannot be rolled back.
  - C3 disks: status, capacity, free space and S.M.A.R.T. (temperature, power-on days, health); "בדיקת S.M.A.R.T.
    קצרה" sends the short self-test command (`nvr.storage.test`); the lab NVR accepted it but kept reporting
    "not_tested" - the status is shown as the device reports it.
  - A3 alarm outputs: the NVR's own relays get "הפעל (pulse)" (`nvr.alarm_output`); a camera's output (white light)
    is listed but cannot be triggered through this NVR firmware (it answers invalidOperation) - the card says so.
  - D3 reboot: "הפעל מחדש את ה־NVR…" needs the typed word RESTART in the dialog and again in the API
    (`nvr.system.reboot`); the reboot itself was not exercised on the owner's NVR.
- D4 "חיבור ל־NVR": host, ports, user and password edited from the page; deviceInfo is read with the new details
  before anything is saved. Inside Home Assistant the details go to the add-on options through the Supervisor and
  the add-on restarts; on a workstation they go to `<data>/nvr_connection.json` (merged by load_settings).
- D1 camera screen › OSD (`nvr.config.osd`): the channel's name on the NVR next to the VMS name with "כתוב את שם
  ה־VMS ל־NVR", the name / date-time overlays toggled, the date style chosen. All reversible from the change log.
- Backend: `services/nvr_system.py`, endpoints `GET /nvr/system`, `PUT /nvr/time`, `PUT /nvr/ntp`,
  `POST /nvr/outputs/{id}/pulse`, `POST /nvr/storage/{id}/smart-test`, `POST /nvr/reboot`, `GET/PUT /nvr/connection`,
  `GET/PUT /cameras/{id}/osd`, `POST /cameras/{id}/osd/name`; `apply_change(keep_before=False)`.
- Evidence: `tests/test_nvr_system.py`; `frontend/tests/evidence-owner-round8.spec.ts` against the lab NVR (clock
  synced, NTP unchanged, relay pulsed, S.M.A.R.T. short test started, OSD week flag toggled and rolled back, channel
  name written and rolled back, reboot gate, connection re-saved).

## 0.1.70 (pilot) — R3: HA entity card, lighting = switches only, manual names
- Plan editor: two tools instead of one - "הוספת תאורה (מפסקים)" lists `switch.*` entities only (a checkbox adds
  `light.*`), "ישות HA אחרת" lists anything else in the catalogue (doors, sensors, climate…).
- Manual name: the entity inspector's "שם במפה (ידני)" and a "שנה שם" button on the card (placement.edit) store the
  name on the anchor; the map label, the side list, the card heading and the history map show it first, with the
  Home Assistant name underneath.
- Entity card redesigned: a state row first, the actions as big buttons inside the card, details (last change, last
  seen, entity id) folded under "פרטים"; the footer keeps rename and edit (owner test 2.8).
- Evidence: `frontend/tests/evidence-owner-round7.spec.ts` (switch-only list, other-entity list, rename from the card
  → map, side list and API).

## 0.1.69 (pilot) — R2: manual coverage area per camera
- Plan editor › camera: the coverage cone has a range handle at its tip - drag it to make the covered area larger or
  smaller (also a "% of the plan width" field and slider; "ברירת מחדל" returns to the illustration radius). For
  special cameras "כיסוי ידני (מצולע)" turns the cone into a free polygon: drag a vertex, click a midpoint to add one,
  press a vertex twice to remove it (3 to 40 points), "חזרה לקשת" drops it. Saved with the anchor
  (`coverage_radius`, `coverage_polygon`, migration 0016); the viewer and the history map draw the manual area
  instead of the cone (owner test 2.3).
- Plan editor: a plain click on a pin now keeps it selected (the captured trailing click used to deselect it).
- Evidence: `tests/test_anchor_coverage.py`, `frontend/tests/evidence-owner-round6.spec.ts` (range drag, polygon
  editing, save, viewer against the dev backend).

## 0.1.68 (pilot) — owner round 2: start screen, kiosk exit, wall best fit, playback without scrolling
- הגדרות › כללי › "מסך פתיחה": the screen the UI opens on when the address carries no route (map / overview / all
  cameras / events / playback; `ui.start_route`). "הסתרת המפה" removes the map area from the navigation for everyone
  (`ui.hide_map`; a single user is hidden with a role that lacks `map.read`). The default screen waits for the
  settings so the map never flashes first (owner 1.2).
- Kiosk: the layout picker is readable (dark entries on white) and a "יציאה" link returns to the wall; a kiosk-only
  user still stays in the kiosk (owner 1.4). The wall's header has a labelled "קיוסק" button that opens `#/kiosk/all`
  in a new tab (owner 1.5).
- Camera wall: the tiles fill the screen as a rectangle - the number of columns is the one that makes the tiles
  biggest for the window (two picked cameras stack on a tall window, sit side by side on a wide one); nothing hangs
  below the fold. While the map's pick is shown the count buttons claim no layout; one click returns to the full wall
  (owner 2.3 / 2.4).
- Floor map › side list: a click jumps to the pin at most 2.2 × the whole-plan fit instead of a microscope zoom (owner 2.1).
- Events: the hover strip (5 s before / at / 5 s after) opens from anywhere on the row, not only from the 64 px
  thumbnail; `sw-table` emits `row-hover` / `row-leave` and tags rows with `data-row-id` (owner 3.2).
- Playback: the video area shrinks with the window so the controls and the timeline fit without a page scroll; the
  compare and filter rows moved above the stage - the timeline is the last block (owner 3.5).
- Evidence: `tests/test_ui_settings.py`, `frontend/tests/evidence-owner-round5.spec.ts` (5 tests against the dev backend).

## 0.1.67 (pilot) — R1: site / building admin tools and a floor tree beside the map
- Sites screen: every site and building card has a menu - edit (name, address / notes), photo (PNG / JPEG up to
  8 MB, re-encoded to JPEG and capped at 1600 px, `image_path` on sites / buildings, migration 0015), remove photo,
  delete. Deleting is guarded: a site with buildings or a building with floors shows the count and keeps the
  button disabled until the children are gone. `POST/DELETE /sites/{id}/image`, `POST/DELETE /buildings/{id}/image`,
  `GET /catalog/images/{kind}/{id}`; `image_url` on the catalogue tree.
- Floor map › "רשימה": a "קומות" group at the top of the side list (all floors of the installation, current one
  marked) - one click moves to another floor without leaving the map (owner test 2.1).
- Evidence: `tests/test_catalog_images.py`, `frontend/tests/evidence-owner-round4.spec.ts` (edit, photo, delete
  guard, floor tree against the dev backend).

## 0.1.66 (pilot) — A1: manual recording from the camera screen
- Camera screen: with the sensitive permission `nvr.record.manual` (custom role) "הקלט עכשיו" starts a manual
  recording on the camera's main track for 5 / 10 / 30 / 60 / 120 minutes; a badge shows the remaining time and
  "עצור הקלטה" ends it. The NVR keeps no readable state for manual recording on this firmware, so the VMS keeps its
  own and the janitor stops an expired recording on the NVR even when the screen is closed. Every start and stop
  is audited (`nvr.record.start` / `nvr.record.stop`, reason user / expired).
  `GET /cameras/{id}/record`, `POST /cameras/{id}/record/start`, `POST /cameras/{id}/record/stop`.

## 0.1.65 (pilot) — B2: motion-detection zones and sensitivity written to the NVR
- Camera screen › "אזורי זיהוי ומסכות": with the sensitive permission `nvr.config.detection` (custom role) the
  motion grid becomes editable - paint cells with a click or a drag, "בחר הכל" / "נקה", sensitivity in the device's
  own steps (the lab NVR accepts 0, 20, … 100; a value in between is snapped, never silently ignored), the
  enabled flag - and "שמור ל־NVR" shows the difference (+/− cells, old → new sensitivity) before one recorded,
  reversible write. `PUT /cameras/{id}/motion`; masks and smart rules stay read-only for now.
- Write framework: a write the device answered OK but did not keep is reported as `no_effect` (409) and logged,
  instead of counting as applied; the change log is readable by whoever holds any NVR-write permission.
- Verified on the owner's NVR: sensitivity 60 → 80 written and rolled back, the grid untouched.

## 0.1.64 (pilot) — first write to the NVR: "Notify Surveillance Center" from the VMS
- Foundation for the owner-approved NVR writes: every change is GET → PUT → GET-verify, kept with the document
  before and after (`nvr_changes`), audited (`nvr.write`, `nvr.rollback`) and reversible from the connections page.
  Thirteen new sensitive permissions (`nvr.config.events`, `nvr.config.detection`, … `nvr.system.reboot`) - never
  implied by a built-in role, granted only through a custom role.
- Connections page › "התראות מה־NVR": a matrix per channel (motion + smart events) read from the NVR, "הפעל תנועה
  בכל הערוצים" / "הפעל גם אירועים חכמים" / per-channel "הפעל" behind a confirmation dialog, the last changes with
  "החזר". `GET/PUT /nvr/notify`, `GET /nvr/changes`, `POST /nvr/changes/{id}/rollback`.
- Fixed on the way: the custom-role cache was shared between databases in one process (tests only).

## 0.1.63 (pilot) — the owner's test round, batch 3
- Floor map: a "רשימה" panel lists the cameras (status) and the HA entities (by kind, with state) placed on the
  plan; a click zooms to the pin and opens its card, or adds the camera while picking. Open state kept per browser.
- Pick bar: one chip per room that holds cameras ("אולם ספורט (2)") picks or drops the room's cameras by name, so a
  concave room never needs a click inside its shape; "קיר חי" is the first action in the bar.

## 0.1.62 (pilot) — the owner's test round, batch 2
- History map: the navigation linked the demo floor id, so an installation opened "הקומה לא נמצאה" (3.11). The
  screen now lands on the first real floor and keeps its floor selector.
- Review windows (3.12): grouping by camera (as before), all cameras together, room or floor, with the gap
  selectable from 1 to 60 minutes; a grouped window lists the cameras inside it. Sensor events without a camera
  stay one window each.

## 0.1.61 (pilot) — the owner's test round, batch 1
- Camera wall: the tile count is remembered per browser and opens with the owner's default (הגדרות › כללי ›
  "מצלמות בקיר כברירת מחדל"); layouts up to 32 tiles (above the live-stream cap the extra tiles show snapshots).
- Kiosk: a layout picker in the header (2×2 … 6×4) writes cols/rows into the kiosk URL and is remembered per browser;
  the owner's default layout applies when the URL carries none.
- Event centre: "סמן הכול כטופל (N)" acknowledges every unreviewed event of the shown list (chunks of 500).
- Settings: "הסתרת חיפוש AI" removes the search tab from the navigation.
- Floor map: a plan larger than the viewport now zooms out until it fits (the "-1" plan opened huge).

## 0.1.60 (pilot) — hover preview on event rows
- Event centre (T044): resting the pointer on an event's thumbnail for a quarter of a second opens a strip with the
  frames 5 s before, at and 5 s after the event, taken from the recording through the existing frame endpoint
  (cached, two grabs at a time); a frame the recording cannot give says so. Touch devices are not affected.

## 0.1.59 (pilot) — playback opens inside the last recording
- The recordings screen opened "five minutes before the last segment ends", which on cameras that record on
  motion only landed in a gap between short clips ("no recording at this time" until a click). It now opens inside
  the last segment (its start when the segment is shorter than five minutes). Found in the review of the owner's
  installation on 0.1.58.

## 0.1.58 (pilot) — hotfix: the first real NVR alerts froze the installation
- The alert handler read the time zone through a second write connection while it already held the write lock:
  every alert blocked every writer for the busy timeout (10 s), and with "Notify Surveillance Center" enabled the
  installation answered `database is locked` everywhere. The zone is now read before the write connection opens,
  and the zone getter uses a read-only connection. Regression test in tests/test_events.py.
- The bridge integration's running version is recorded on every directory push, not only at pairing: the
  connections page no longer says "Home Assistant still runs 0.1.1" after an update and a restart.

## 0.1.57 (pilot) — bookmarks on the playback timeline
- Playback (T049): the day's case items of the camera (event windows and clips) show as flags on the timeline,
  coloured by preservation (copy saved / copying / bookmark the NVR still serves); a flag click seeks to it and
  names the case with a link to it; Alt + click on the track bookmarks that instant through the case picker
  (10 s before, 20 s after), and the new flag appears at once. `GET /cases/bookmarks?camera_id&date` (events.read
  on the camera; no NVR probe). The whole-case export with a manifest across items has existed since 0.1.40
  (evidence bundles).

## 0.1.56 (pilot) — selection on the map: rectangle, room, save as a view
- Floor map, "בחירת מצלמות" (T043): dragging a rectangle over the plan picks every camera under it (Shift + drag, a
  second finger and the wheel still move and zoom the plan); a click on a room picks the cameras placed inside it
  (a second click drops them); the pick bar counts the selection as watchable / offline / without live permission
  and says how many of the floor's cameras are not placed on the plan yet.
- "שמור כתצוגה": the selection becomes a saved view (name, kiosk layout, shared when the caller may share) that
  opens from the pick bar in the saved-views screen or straight on the live wall. Cameras the caller may not watch
  live are left out and counted; a view holds sixteen cameras at most.

## 0.1.55 (pilot) — kiosk restore and a smoke test after upgrades
- Kiosk (T057): the wall comes back to the exact page it showed after a reload, a power cycle or a reconnect (kept
  per view in the browser), and a user whose only role is "תצוגת קיוסק" is kept on the kiosk by the shell — any other
  route lands on `#/kiosk/all` (the API already limits that role to map.read + video.live).
- Tooling (T036, outside the add-on): `scripts/smoke_after_upgrade.py` runs sixteen read-only checks against a VMS
  (health facts, identity, cameras, sites, events, snapshot, a playback session it closes itself, export estimate,
  saved views, storage, audit, the built UI, and the bridge on the owner's installation) and exits non-zero on real
  breakage; checks the caller may not run are skipped, not failed.

## 0.1.54 (pilot) — export queue order
- Export jobs now run **smallest first**: the NVR hands files out at a fixed, modest rate (a 1 GB file took over
  half an hour in the lab), so a short clip no longer waits behind a whole-file preservation. A job that has waited
  more than 15 minutes goes first regardless, so big jobs never starve. One download at a time, as before (the NVR's
  playback slots are the limit).
- Tooling (outside the add-on): `scripts/migrate_legacy.py` (migration dry run from the legacy add-on, T070) and
  `scripts/release_check.py` + `docs/release/RELEASE_PACKAGE_V1.md` (T072).

## 0.1.53 (pilot) — slow motion and frame stepping (T066)
- הקלטות: **הילוך איטי ×0.5 / ×0.25** and **צעד־פריים** (one frame back / forward while paused) on the MSE
  playback path. Both are honest about the source: the relay delivers the NVR stream in real time, so the buffer
  is consumed slower or stepped through and the time on the stamp stays the source time (measured: at ×0.5 the
  position advances at about half the wall time). A frame outside the buffered media asks for a real seek.
- 2× / 4× stay disabled with the reason (they need a source that sends faster than real time); in a synchronized
  group only 1×. The session's capabilities now say so (`frame_step`, `supported_speeds`).

## 0.1.52 (pilot) — more entity adapters with risk classes (T040)
- Entity actions on the floor map now cover, beside lights / switches / fans / covers / locks / buttons / scripts /
  scenes: **climate** (operating mode, target temperature), **media players** (play, pause, stop, volume),
  **number / input_number** (set a value), **select / input_select** (choose an option), **input_boolean**,
  **vacuum** (start, return to base), **siren** (on / off) and the **alarm panel** (arm home / away, disarm).
- Every action carries a risk class: *routine* runs at once; *attention* (scripts, scenes, buttons, covers,
  sirens, arming) asks for an explicit confirmation; *sensitive* (unlocking a door, disarming the alarm) also needs
  its own grant that no role implies — `door.unlock` and the new `alarm.disarm`, granted through a custom role.
- Arguments are validated by the add-on before anything reaches Home Assistant (numbers in range, modes and
  options from a fixed list, texts bounded), the expected state follows the requested value (a mode, an option,
  a number), and the entity card offers an input per argument with sensible defaults from the entity itself.
- Bridge integration 0.2.1: the allow-list learns the new services. Home Assistant must be restarted once
  after the update for the new services to pass; until then they answer "service not allowed" with a hint.

## 0.1.51 (pilot) — the last two hidden screens built for real (live review F1 F3)
- לייב › **תמונת מצב** (F1): a real dashboard — greeting by the product time zone, cameras online / total with
  the recorder model, sites and floors with plans, today's events with the unreviewed count, the system status
  from the health summary; two live camera posters; storage (used %, capacity, measured retention — only for
  users who may read the storage report); sites and buildings with plan coverage and the NVR row; the last six
  events with pictures; and "דורש תשומת לב": offline cameras, failing health checks, unreviewed events, an alert
  stream that never delivered ("Notify Surveillance Center"), a lost Home Assistant connection — each with the
  reason it is shown and a button to the right screen. Refreshes every minute.
- לייב › **תצוגות שמורות** (F3): saved views for real — `saved_views` table (migration 0012), `GET/POST/PUT/DELETE
  /api/v1/views`. A view is a name, up to 16 cameras and a cols × rows layout; personal views belong to their
  owner, shared views (visible to everyone) need `rbac.assign` at the installation or at a site; every camera must
  be one the caller may watch live, and a reader who may not see one of a shared view's cameras gets the view
  without it (counted). The screen shows snapshot mosaics, opens a view on the live wall or in the kiosk
  (cols × rows per page), and edits or deletes with the owner's rights. Audited; part of project backups.

## 0.1.50 (pilot) — three of the hidden screens built for real (live review F4 F5 F6)
- חקירה › **Review · חלונות** (F4): the tab opens the event centre grouped into review windows (the day's events
  per camera by proximity, `/events/windows`), the same data the "חלונות" toggle shows — no demo queue any more.
- חקירה › **ניגון מסונכרן** (F5): a real launcher — pick 2–4 cameras (the first is the lead / reference clock),
  a start time, open the comparison in the recordings screen; the last six sets are kept in the browser. The
  measured sync itself is unchanged (0.1.38 / 0.1.41).
- הגדרות › **חיבורים** (F6, replaces the demo setup wizard): read-only facts about the add-on's connections —
  NVR (model, firmware, discovery, alert stream, stored alerts with the "Notify Surveillance Center" hint when
  none arrive), go2rtc (stream sync, health check), Home Assistant (connection, entities, snapshot / event /
  registry times, reconnects, identity source), storage and tools (DB, /data, PDF renderer, thumbnails,
  backups), and the list of Add-on option names with where they are set. Values are never shown.
- Breadcrumbs and tab labels use the real screen names with a backend; the design fixtures keep the demo
  screens.

## 0.1.49 (pilot) — live review fixes (docs/operations/LIVE_REVIEW_2026-09-17_HE.md)
- No demo data with a real backend: the demo-only screens are hidden from the tab bars and their routes land on
  the real screen — לייב › תמונת מצב → כל המצלמות, תצוגות שמורות → כל המצלמות, Review → מרכז אירועים,
  ניגון מסונכרן → הקלטות (the real sync is the comparison there), אשף התקנה → הגדרות (F1 F3 F4 F5 F6 F10).
  דלתות ואינטרקום shows an honest "not connected yet" state until the hardware exists (F7); the invented
  NTP toggle is gone from settings (F8). The demo versions stay for the design fixtures.
- Audit log for real (F2): הגדרות › אודיט lists the installation's `audit_log` — action family, user, count
  filters, decision badges, reason and details, CSV export.
- Camera health shows the camera's own snapshot instead of an illustration (F9).
- Events: the row subtitle names the real source — התראה מה־NVR / נגזר מהקלטה / חיישן HA / מערכת (F12); when
  the NVR alert stream is connected but produced no alert in the facet window, the header says so and names the
  NVR setting to enable ("Notify Surveillance Center", F14).
- A Home Assistant restart no longer writes one "None → state" door event per lock and sensor: an entity that
  just appeared has no transition (F11); older rows of that kind read "לא ידוע → …" instead of "None".
- HA sync: the periodic registry refresher is cancelled with its session, so a reconnect no longer leaves a stale
  task warning "registry refresh failed: ConnectionClosedOK" every 10 minutes (F13).
- Kiosk: 3×2 tiles per page by default (`rows=` in the URL restores 3×3) and streams start 400 ms apart, so the
  last tiles of a page no longer stall on the lab NVR / relay (F15).
- Polish: negative floor levels render "-1" instead of "1-" (F16); the floor selector no longer clips its label
  (F17); a favicon (F18); the import wizard names DXF and shows KB for small files (F19); version-history rows
  wrap their actions (F20); the AI-search provider note is in Hebrew (F21); the playback time field shows all
  digits (F22); two channels with the same NVR name are told apart by their channel number (F24); a cancelled
  queued export says who cancelled it (F25); a user without a role sees no developer links or search box (F26).

## 0.1.48 (pilot)
- Read requests no longer take the database write lock: the busy GET handlers (events list / facets, floor map,
  cameras, health summary, search, storage report, cases, camera recordings, /me) run in a deferred, query-only
  SQLite transaction, so eight concurrent operators are served side by side instead of one after the other
  (load probe: events 24 h p95 9.0 s → 3.5 s, health 2.7 s → 0.9 s, map / cameras / cases / facets ≈ 1–1.8 s →
  0.3–0.35 s; see docs/operations/RESOURCE_BUDGET.md). What such a request must still record — the audit row of a
  refusal, the one-time admin bootstrap, the user's last-seen stamp — is written through a short side transaction;
  the last-seen stamp is now updated at most once a minute per user instead of on every request. Write handlers
  are unchanged (BEGIN IMMEDIATE for their whole life).

## 0.1.47 (pilot)
- Storage report always warm: the report that costs one NVR search per camera (~40–50 s cold) is now built in the
  background once after start-up discovery and refreshed by the janitor every 8 minutes, so הגדרות › אחסון opens
  from cache; a failed warm-up is logged and the next request builds on demand.
- No screen recreation on first load: the shell now starts with the design this browser saw last (or the URL /
  per-browser override), so the product setting arriving a moment later no longer swaps the layout and rebuilds
  the screen — typing or uploading during the first second is no longer lost. First visit on a fresh browser still
  switches once when the setting differs from the default.
- Load probe re-run (docs/operations/RESOURCE_BUDGET.md): 0 errors on every endpoint under eight workers; the
  24 h events list still pays the write-lock serialisation (p95 ≈ 9 s under that load; read-only connections
  remain the next optimisation).

## 0.1.46 (pilot)
- Playback quota hygiene: a playback session nobody ever connected to (a tab closed during start-up, a screen
  left before its stream arrived) is dropped after 90 s instead of holding a relay stream and one of the four
  quota slots for the whole idle lease; and the browser releases its own sessions and groups when a page is left
  (beacon to the new POST …/close routes, which do the same as DELETE). Found during the night's regression sweep,
  where a burst of screens produced "מכסת הניגון מלאה".

## 0.1.45 (pilot)
- Lovelace card (T056): the SMPLWISE Bridge integration (now 0.2.0) ships `custom:smplwise-card` and registers it
  as a dashboard resource on load (best effort — in YAML-mode dashboards the log names the resource to add by
  hand). The card embeds the add-on's own Ingress page for one view — `camera` (with a camera id), `map` (with a
  floor id), `events`, `health` or `wall` — so the person is who Home Assistant says they are and the VMS applies
  its own roles: no secret in YAML, no entities, no way around a permission. The VMS gained an embed mode
  (`embed=1` in the route): the screen renders without the shell chrome, and stays that way for in-app navigation
  inside the iframe. After updating the add-on, restart Home Assistant once so the 0.2.0 integration (with the
  card) loads; then add the card to a dashboard.

## 0.1.44 (pilot)
- Semantic search with a local baseline (T063): חקירה › חיפוש AI takes a free question in Hebrew or English
  ("אדם בלובי אתמול בערב", "vehicle near the gate this morning 08:00-09:30") and turns it, without any model or
  network, into the event centre's own filters — object class from the device's detection target, places from the
  catalogue (rooms, floors, cameras, matched by name inside the caller's scope), a time window in the site zone —
  shows the interpretation as chips, runs the scoped query and labels every hit with a confidence (exact / partial)
  and its basis. Colour and appearance terms are reported as unsupported because no source produced that metadata;
  words that were not used are listed. The provider registry states the contract every analysis provider must
  meet — model version, privacy statement (what leaves the installation), daily budget, explicit opt-in — and no
  external provider is bundled: ai.provider=external is refused rather than pretended. Every answer carries the
  statement that metadata matches are not identity evidence.

## 0.1.43 (pilot)
- DXF floor plans (T065): the import wizard accepts .dxf (recognised by content, like every upload) through an
  isolated conversion adapter built on ezdxf (MIT). On upload the drawing is inspected — DXF version, units from
  the header, layers with their drawable counts, entity counts, and the entity types that are not converted
  (TEXT/MTEXT, HATCH, DIMENSION, 3D) — and rendered from LINE / LWPOLYLINE / POLYLINE / CIRCLE / ARC / ELLIPSE /
  SPLINE / INSERT. A partial conversion is always stated, never hidden; a selection with nothing drawable is
  refused. Layers and units are chosen per file and re-render the preview from the untouched source; a version
  made from a drawing with known units carries its scale (metres per pixel) automatically. DWG is not supported
  (closed format): convert to DXF first.

## 0.1.42 (pilot)
- Capability facts per camera (T045 / T012, read-only half): the camera page now shows what the NVR itself reports
  — PTZ supported / unsupported (only on the device's own notSupport) / unknown with the reason, the preset list
  (read, never recalled), and two-way audio available / disabled on the device / unsupported / unknown — as badges,
  cached five minutes, same permission as live video. Moving the camera, recalling a preset and talking are device
  writes: not offered in the pilot and never shown as a fake control; digital zoom is named for what it is, a
  browser enlargement. Lab: the fixed cameras answer PTZ notSupport, an empty preset list and an audio channel that
  exists but is disabled.

## 0.1.41 (pilot)
- Synchronized playback closes small drifts without re-seeking (T042 follow-up): a tile that is between 0.25 s and
  3 s off the master clock plays 5–15 % faster (behind) or slower (ahead) until it is back within 0.25 s; only a
  drift beyond 3 s still costs a member re-seek. Nudges are counted per tile in the sync report. Lab measurement:
  real Chrome, 3 cameras: right after the barrier 'slight' with p95 1.27 s and one nudge; within 90 s the second tile stalled again (two re-seeks, then late) and the third never rendered - the nudge is correct but the lab's playback delivery (NVR / relay / MSE stalls) remains the limit.

## 0.1.40 (pilot)
- Signed evidence bundles and key management (T067): every bundle now carries manifest.sig.json — an Ed25519
  signature over manifest.json by the installation's active key, with the public key and key id embedded.
  Verification (in the app or offline with scripts/verify_bundle.py) recomputes every hash and checks the
  signature, and says which of three things it found: signed by a key of this installation (active or retired),
  signed by a key this installation does not know (integrity only), or unsigned (bundles from before 0.1.40).
  Tampering with a file, the manifest or the signature is reported. The private key is created in /data/keys
  with mode 0600, never leaves it and never enters a backup; הגדרות → אחסון shows the active key and lets a system
  administrator rotate it (audited) — retired public keys stay in the keyring so older bundles still verify.
  The trust statement is explicit: a signature proves the bundle did not change since export by that key
  (integrity-at-export); it does not prove the footage is authentic at capture and is no statement of legal
  admissibility. New dependency: cryptography.

## 0.1.39 (pilot)
- Detection zones and privacy masks as the NVR holds them (T075, read-only half): the camera page reads the
  channel's motion-detection grid (rows × columns, sensitivity, target types, coverage), privacy-mask regions,
  intrusion (field) regions and line-crossing lines through ISAPI GETs only, parsed with the safe XML parser and
  cached for a minute, and draws them over the snapshot with per-layer toggles. A source the device refuses or
  lacks is listed as "not read" with the reason, never invented. The card states what it is: polygons in the
  camera image (not rooms on the floor plan), a browser overlay that is not an NVR mask and protects no
  recording; editing or a real mask needs an explicit approval, a verified write-back and a check in the stream,
  none of which exist in the pilot (no write route). Same permission as live video.

## 0.1.38 (pilot)
- Measured multi-camera sync (T042): a playback group now runs on one master clock — an opening barrier waits for
  every member to render (or 12 s), then the clock is the median rendered time of the playing tiles (the lead's
  when fewer than three), carried by the wall clock between frames, so no single tile drives the timeline. Each
  tile's rendered time is measured against that clock twice a second; the p95 of |drift| over the last 40
  samples sets the quality shown on the stamp (מסונכרן ≤ 0.5 s, סטייה קלה ≤ 2 s, לא מסונכרן) and is reported to the
  server on the group for the session's evidence. A tile that is out by more than 2 s for three samples is
  re-seeked alone, aiming ahead by its own measured start-up latency; the clock and the other tiles never move,
  a tile without a recording stays "missing", a tile that does not render within 8 s is marked late. Only 1× is
  offered in a group and the source's unsupported speeds are disabled with the reason. Lab measurement: lab 2026-09-16/17, real Chrome, 3-4 cameras: tiles render 4-11 s after the seek; right after the barrier p95 was 1.9-2.6 s (three of four tiles within 1.2 s of the clock), degrading to 3-7 s within 1-2 minutes as MSE tiles stall; a member re-seek recovers a tile briefly; in one run two of four tiles never rendered within 100 s (concurrent playback capacity of the lab NVR / relay) - measured, shown and reported, not hidden.
- Fixed: the 30 s housekeeping pass (idle playback, orphan streams, export retention, event / thumbnail / audit /
  HA-history pruning, periodic discovery) had died silently at every tick since 0.1.30 on a missing import; it
  now runs as a tested function and logs a traceback if a step fails.
- Fixed: a playback session created while the playback screen was being replaced (route change during start-up)
  leaked until its lease ran out and counted against the playback quota; it is released at once.

## 0.1.37 (pilot)
- Home Assistant's own answer decides an action (T079): every entity action still runs in the VMS user's own HA
  identity through the bridge, and a refusal by Home Assistant (the user lacks the entity permission there, or the
  HA user behind the session no longer exists) is now recorded and audited as `ha_unauthorized` / `ha_unknown_user`
  and explained in words on the map — the add-on's own token being an administrator changes nothing. Unlocking a
  lock needs the separate `door.unlock` grant on top of entity control: no built-in role carries it, a custom role
  can, the entity card disables the button and says why, and the refusal (`grant_required`) is audited without
  anything reaching Home Assistant. Map editing grants no control. The action request is closed — it cannot carry
  a user id, a context or a raw service call, and only the allow-listed actions exist, so there is no generic
  service proxy. Live evidence with a second, restricted HA user is still pending (owner's item).

## 0.1.36 (pilot)
- Custom roles and delegated administration (T082): הגדרות › משתמשים והרשאות › תפקידים lets a system
  administrator compose a custom role from ordinary permissions plus sensitive grants that must be ticked
  explicitly (export, entity control, unlock, PTZ, talk…); system permissions (configuration, role management,
  binding management) can never be part of a custom role, and built-in roles stay immutable. Before a role is
  saved the screen shows its impact — how many bindings, which users and groups, at which scopes, and which
  permissions are added or removed — and a change takes effect on the next request of every affected session
  (optimistic revision, so two administrators cannot overwrite each other). A role that is still bound cannot be
  deleted. Delegation: a site administrator may now assign roles inside their own site, but only roles on the
  delegation allowlist (a setting edited on the same tab), only roles whose permissions they hold at that scope,
  only to users (never groups) and never a role that carries a system permission; every refused delegation is
  audited with its reason. Custom roles are part of the settings backup.

## 0.1.35 (pilot)
- Alarm rules with a dry run (T052): חקירה › חוקים והתראות builds a rule from trigger (event types, sources,
  minimum severity), scope (floors, rooms, cameras through the floor plan), a site-local time window and a
  cooldown; the only action in the pilot is a VMS notification. "הרצה יבשה" replays the day's stored events and
  explains, per event, why an alert would or would not have been raised — nothing is written or sent. Enabled
  rules evaluate new NVR alerts and HA sensor transitions as they arrive; alerts are acknowledged on the
  "התראות" tab. Alerts are not events (no loops), one alert per rule and event, cooldowns compare event times,
  every change carries its author and revision, and a rule owned by Home Assistant is a reference only.

## 0.1.34 (pilot)
- Load probe and resource budget (T068): scripts/load_probe.py measures latency percentiles per endpoint under
  concurrent load plus the backend process memory, and docs/operations/RESOURCE_BUDGET.md records the reference
  measurement on the developer workstation against the lab NVR and HA. Two findings fixed on the way: identical
  concurrent recording searches now wait for one NVR search instead of each running their own (the p95 of a
  cold "recordings today" request under 8 workers went from about 20 s to well under 2 s), and the storage report is
  built once even when several callers ask at the same moment. Read-only measurement; no device writes.

## 0.1.33 (pilot)
- HA history on the historical map (T041): every entity state the VMS learns of (the snapshot at connect and each
  change) is kept locally for 30 days. The historical map shows, per placed entity, the state that was in force at
  the chosen instant — known only when the local history covers it (a later change bounds it, or the last
  confirmation is at most 24 hours old); otherwise "unknown" with the reason (before the history began, no
  recorded state, or too old to forward-fill). The live value is never shown in a historical bundle, and a
  timezone change never moves the instant.

## 0.1.32 (pilot)
- Evidence bundle (T050): "צור חבילת ראיות" on a case builds one ZIP with the preserved clips (copies of the
  finished export outputs and their export manifests), the snapshots, the notes, a manifest with a SHA-256 per
  file and the source / time details of every item, and a readable Hebrew report. Items that are only
  bookmarks are listed as skipped, never silently included. "אימות חבילה" recomputes every hash of an
  uploaded bundle and reports each file (ok / mismatch / missing / extra). The hash proves the file did not
  change since the bundle was made — not the authenticity of the picture; signing is a separate capability.
- Snapshots into a case (T046): "צלם תמונה לתיק" copies one JPEG from the camera into the case with its hash;
  the item is "עותק שמור" from the start. Manual recording and OSD sync are not offered in this build: no
  proven ISAPI capability on the lab NVR and no approval for device writes — there is no placeholder button.

## 0.1.31 (pilot)
- Kiosk / wall display (T057): #/kiosk/all takes a saved view in the URL (cameras, cols, rotate seconds),
  rotates pages, shows the system health pill from the summary endpoint, dims the wall after three failed
  polls and reloads it on the first success, and never shows an offline camera as live. A new "תצוגת קיוסק"
  role (map + live only) lets a wall log in without events, playback, exports, HA control or settings.
- Suggested path (T064): every event page of a placed camera offers "המשך מסלול מוצע" — the neighbouring
  cameras ranked same room → adjacent room → within reach, with the window to look at and the activity each
  reported. Labelled hypothetical: no claim of the same person or vehicle, no action.

## 0.1.30 (pilot)
- Spatial RBAC (T055): an explicit deny on a floor now wins over an installation-wide allow for every camera-bound
  request (live, playback, recordings, events, cases, exports, HA); before, the fallback check re-evaluated the
  wide scope and let the holder through. Camera refusals are audited with the real reason (explicit_deny /
  no_binding / user_inactive). Audit rows older than 365 days are pruned by the janitor. A matrix test covers
  viewer / operator / editor / site admin / denied operator across map, live, playback, events, cases, exports,
  publishing, placements, HA actions, storage, access administration, revocation inside an open session and
  deactivation.
- File and network hardening (T069): device XML with DOCTYPE / ENTITY declarations is refused before parsing
  (NVR search, discovery, alert stream, storage, schedules); a corrupt PDF upload is a 422 instead of a crash;
  tests pin content sniffing (SVG refused, name and declared type ignored), the upload size cap, path traversal
  in every file-serving route, the absence of any URL-fetching parameter, relative media paths only, and bridge
  replay / expiry / forgery / tampering refusal.

## 0.1.29 (pilot)
- Documentation: operator guide in Hebrew (install → NVR → HA → go2rtc → floor → camera with the checks that
  prove each step, daily use, investigation from event to preserved evidence, recovery, privacy and permissions,
  what to collect for support) — docs/operations/OPERATOR_GUIDE_HE.md. Visual regression process —
  docs/operations/VISUAL_REGRESSION.md. Canonical plan geometry schema v1 with a validator and a deterministic
  export of a plan version — contracts/schemas/plan_geometry.v1.schema.json, docs/architecture/PLAN_GEOMETRY_SCHEMA.md.
  No behaviour change in the add-on.

## 0.1.28 (pilot)
- Spatial metadata search (T062): the event centre filters by place (building · floor, then room / zone)
  through the items placed on the floor plan, and by source (NVR alert, derived from recording, HA sensor,
  system) and severity. A line above the list says which fields have data in the last 90 days and why the
  others are empty (for example: no person / vehicle events because the NVR sends motion only). A filter that
  cannot match by construction — a type this installation never produced, a room with nothing placed in it —
  is shown as "unsupported here", never as "no results".

## 0.1.27 (pilot)
- Door–camera–sensor correlation (T053): state transitions of door and window contacts, motion sensors, locks
  and gates from Home Assistant are kept as events (source "חיישן HA"). Every event page has a correlation
  card: the sensors and locks placed around the camera on the floor plan (same room or within reach), what
  they reported within ±2 minutes, unlock commands sent from the VMS, and the other cameras' events — each
  with its certainty (measured / inferred / command). A pulse unlock is shown as a command that was sent,
  never as proof that the door opened. Delayed device clocks and sensors without a state are named. No
  action is ever triggered from a correlation.

## 0.1.26 (pilot)
- NVR storage and recording plan, read-only (T051): מערכת › אחסון shows the disks (capacity, free space,
  status), the recording schedule of every camera (mode, days, pre/post seconds, stream facts) and two
  retention numbers that are deliberately different: measured (the oldest recording the NVR still has, one
  bounded search per camera) and estimated (capacity over the configured bitrates), each with its reason.
  Nothing is written to the device: no format, RAID, deletion, quota or schedule changes; the quota and
  overwrite endpoints the lab NVR refuses (403) are named as such. Cached ten minutes, refresh on demand.

## 0.1.25 (pilot)
- Investigation cases (T049): a case links events, recording clips and notes from several cameras, with tags
  and a status (open / in review / closed). "הוסף לתיק" on the event page, in playback and on the historical
  map; the case page shows every item with its preservation state: a clip is a bookmark into the NVR until
  "שמור עותק" runs an export job that copies it (preserved only when the copy is complete); footage the NVR no
  longer has is shown as missing and never as preserved; an unreachable NVR reads "not checked". Edits need
  the cases.manage permission (operator, site admin, system admin) and the current revision (409 on a stale
  one). Cases are part of the project backup.

## 0.1.24 (pilot)
- Plan version history (T038): the editor lists every version of the floor (thumbnail, status, date, placed
  items, notes). Publishing always shows a preview first: geometry changes against the published version and
  what happens to every placed item. An archived version can be restored: it is published again as a new copy,
  the previous one goes to the archive, and pins follow whenever the geometry is identical (never to an
  invented location). Concurrent changes are refused clearly (409 stale_revision / stale_published).
- Historical map: the plan version and the pins shown are the ones in force at the chosen instant once the
  floor's history has begun; earlier instants show the current map and say so.

## 0.1.23 (pilot)
- Recording frames at an instant (T044): GET /cameras/{id}/frame?at= grabs one JPEG from the recording
  (ffmpeg on the server, cached per 10 seconds, negative-cached, capped at 150 MB, playback permission).
  The playback timeline shows a floating preview while hovering; the historical map shows the selected
  camera's frame at the chosen instant.

## 0.1.22 (pilot)
- Multi-camera selection from the floor map (T043): "בחירת מצלמות" turns pins into a picker (or "בחר
  הכל"), "קיר חי" opens the live wall with exactly those cameras, "ניגון מסונכרן" opens playback with the
  first as lead and up to three more as the synchronized group. The live wall accepts `?cameras=` and
  playback accepts `?extra=`.

## Documentation (2026-09-16, no version change)
- G0 documents: dependency, licence and secrets audit (`docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md`,
  pip-audit and npm audit clean), model policy page (`docs/operations/MODEL_POLICY.md`), pilot contract
  lock (`docs/architecture/ADR-015-pilot-contract-lock.md`) with the generated route inventory
  (`contracts/API_INVENTORY.md`, `scripts/api_inventory.py`), and `scripts/progress.py` for the
  progress figures in every report.

## 0.1.21 (pilot)
- System status in the top bar (T035): the pill shows green "מערכת תקינה", amber "יש מה לבדוק" or red
  "תקלה: …" from a cheap summary (alert stream, camera discovery, go2rtc sync, HA sync, event pictures,
  backup age; no device probes), refreshed every minute; clicking it opens הגדרות → בריאות ועבודות. When
  something fails a banner under the top bar names it on every screen. API: GET /health/summary (every
  signed-in user; operator wording only). הגדרות accepts ?tab=.

## 0.1.20 (pilot)
- Phone layout (T034): every table becomes a card list under 768 px (cells stack with their column label,
  the picture sits beside the text, nothing scrolls sideways); the event centre shows "לבדיקה / טופלו
  היום" tiles on phones (M45); the camera card, event drawer, event page and historical map already stack
  or open as bottom sheets. Fix: in design SW A the phone layout kept an empty rail column and squeezed
  every screen into a narrow strip; the shell now collapses to one column on phones. Verified at 390 px
  against the developer backend.

## 0.1.19 (pilot)
- Historical map on real data (T030, design M16 basic): the floor at a chosen instant — cameras show
  whether a recording covers that instant (blue) or not (dashed), HA entities are shown as unknown (no
  state history is stored; never the last live value), events around the instant are listed, a day
  timeline with recording segments and event ticks scrubs the time, a date picker and floor switch, and
  an explicit "חזרה למצב חי". The event page's "המשך חקירה במפה" opens it at the event time with the camera
  selected; "נגן מכאן" opens playback at the chosen instant. No physical actions in this mode.

## 0.1.18 (pilot)
- Health and diagnostics (T033): הגדרות → בריאות ועבודות shows one card per subsystem with a real status —
  database, storage (free space and what the add-on uses), NVR (live probe: model, firmware), go2rtc
  (version, our streams), HA sync, bridge, event ingest, recording-derived events, camera discovery,
  event pictures, exports, live and playback sessions, backups — with "בדוק עכשיו". API: GET /health/report
  (system.configure), probes cached for 20 seconds.

## 0.1.17 (pilot)
- Project backups (T026) and rollback safety (T036): a zip with the project tables (sites, buildings,
  floors, plan assets and versions, anchors, cameras, zones, settings; optionally users and permissions)
  plus the plan files. Written automatically before every version upgrade (last 5 kept) and once a day
  (last 7 kept), on request from הגדרות → גיבוי ושחזור, downloadable, uploadable, and restorable in one
  transaction (replace or merge; the restoring administrator keeps access; RESTORE must be typed; audited).
  Never contains secrets or video. API: /backups.

## 0.1.16 (pilot)
- Event centre review windows (design M26): "חלונות" groups adjacent events of the same camera (gap
  1 / 3 / 5 / 10 minutes) into one row with picture, dominant type ×count, camera, time range and
  handling status; a window opens a drawer with its raw events, "סמן הכל כטופל" handles them at once
  (each ack audited by name) and "סקירה מלאה" opens the event page. Nothing is merged or deleted in
  the store. API: GET /events/windows, POST /events/ack-many. The chosen view is remembered.

## 0.1.15 (pilot)
- Global search in the top bar (design M48, pilot scope): Ctrl/⌘+K focuses it; typing lists rooms and
  zones (those marked for spatial search), cameras (name or channel), floors, buildings and HA entities,
  each with its place; arrows + Enter or a click open the hit — a room opens its floor highlighted and
  zoomed, a placed camera or entity opens its card on the map, an unplaced camera opens the live view.
  Results are filtered by the user's scope. API: GET /search?q=.
- Floor map: ?zone= / ?camera= / ?entity= on the floor route select and zoom to the item.

## 0.1.14 (pilot)
- Stylized rendering with choices: cleaning strength (קל / בינוני / חזק), room fill (white, one soft tint
  per room, none) and whether furniture, doors and other thin lines from the drawing are kept in a faint
  tone; the comparison caption names the chosen options. API: `room_fill` on POST /plan-versions/{id}/stylize.
- Floor map: the layer switches are remembered per floor in the browser (M07).

## 0.1.13 (pilot)
- Zones can be reshaped on the map (design M13): the selected zone shows corner handles (drag to move,
  double-click to remove, at least three stay) and edge-midpoint handles (drag to add a corner); each
  change is saved at once with the zone's revision.

## 0.1.12 (pilot)
- Event page (design M27) at #/investigate/events/{id}: the recording plays from two seconds before the
  event (event time and played frame time shown separately), context card with status / source / type /
  start time / window duration / location "building · floor / zone", the camera's floor with the pin
  selected and the zones under it, events ±10 minutes, "סמן כטופל", "המשך חקירה במפה", "הנגן המלא עם
  ציר הזמן". API: GET /events/{id} (names, picture state, time zone, location from the camera's anchor and
  the smallest zone containing it; scoped per camera), `acked=true` on GET /events.
- Event centre (M26): tabs לבדיקה / הכל / טופלו; the drawer's "סקירה מלאה" opens the event page.

## 0.1.11 (pilot)
- Floor map viewer per the design (M05/M06/M07): floor chip on the map, zoom controls bottom-left and
  legend bottom-right, a "שכבות" panel with toggles and counts (cameras, doors/intercom, lighting,
  security/sensors, room names; a toggle changes only what is drawn), zone name chips shown by zoom
  level, the camera card plays the camera live inside the card (session released with the card; NVR
  snapshot as poster) with status, location (floor / zone the pin sits in), "צפייה מלאה" and "הקלטות",
  and Escape closes the card with keyboard focus back on the pin.

## 0.1.10 (pilot)
- Fix: the plan import crop did not match the preview when the page was rotated (the crop box was placed
  against the container while the CSS-rotated picture kept its unrotated box). Page previews are now
  served already rotated (`preview.png?rotation=90|180|270`), the crop rectangle is drawn with the mouse
  over that picture and rotating resets it; the saved version is exactly the drawn area.
- Rooms and zones (design M13): named polygons on the floor (`spatial_zones`, migration 0006). The plan
  editor's "חדרים ואזורים" tool detects rooms on the plan locally (same wall analysis as the stylized
  rendering; candidates only, nothing saved until accepted), lets you name, keep or drop each one, draw
  further zones by clicking corners, and edit name / kind / colour / searchable; the viewer shows the
  names under the pins with a layer toggle. API: GET/POST /floors/{id}/zones, PATCH/DELETE /zones/{id},
  POST /floors/{id}/zones/detect, POST /floors/{id}/zones/accept; zones ride in the floor map bundle.
  A map zone is spatial context only, not a camera detection zone or privacy mask.

## 0.1.9 (pilot)
- Design switch: "SW A" (mockups v1.3: four-area icon rail, 72 px top bar with breadcrumbs, SW A tokens)
  and "SW B" (the earlier boards); installation default, editable names and a per-browser choice in
  הגדרות → כללי. `docs/design/mockups-v1.3/` holds the handoff document and key screens.
- Plan editor rebuilt per M12: direction and field-of-view handles on the selected camera, click-to-place
  for cameras and HA entities, floating tool rail, numeric inspector, keyboard nudges and shortcuts,
  layers, explicit save; bearing 0° = up, clockwise.
- Stylized plan rendering per M11 (local): `POST /plan-versions/{id}/stylize`, `PATCH /plan-versions/{id}`
  (render_mode), source/stylized picture endpoints, migration 0005; the map serves the chosen rendering.
- Dependency: numpy.

## 0.1.8 (pilot)
- Users and roles (הגדרות → משתמשים והרשאות): directory from Home Assistant through the bridge,
  role bindings for users and VMS groups at installation/site/building/floor scope with a preview,
  effective-permission view, RBAC audit tab, "sync users" button (integration 0.1.2 adds the
  `smplwise_bridge.sync_directory` service). API: /identity/users, /identity/sync, /access/roles,
  /access/bindings, /access/groups, /access/preview, /audit.
- Access rules: rbac.assign only; system roles installation-wide; last administrator protected; a user
  disabled or removed in HA loses access at the next push; revocations bump the permission revision and
  end the user's live/playback sockets.

## 0.1.7 (pilot)
- Fix: the automatic bridge install crashed inside the add-on image (IndexError while locating the
  integration files) and the settings tab blamed the config mapping; the source lookup no longer assumes a
  repository checkout above the module, and start-up errors are logged with their traceback.
- Settings tab: the "not available" reason now names the actual cause (mapping missing, files missing, crash).

## 0.1.6 (pilot)
- The bridge integration is delivered by the add-on: shipped in the image, copied into Home
  Assistant's `custom_components` through the `homeassistant_config` mapping when missing/outdated,
  announced via Supervisor discovery (config flow `hassio` step with the pairing code prefilled); status
  and an "install / update" button in הגדרות → גשר Home Assistant; `POST /ha/bridge/install`.
- Event pictures from the recording (lazy, one worker, ffmpeg frame grab, cached under /data/thumbs) in
  the event centre rows and drawer; "נגן כאן" plays the recording inside the drawer from the event time.
- Add-on config: `hassio_api`, `discovery: [smplwise_bridge]`, `map: homeassistant_config:rw`.

## 0.1.5 (pilot)
- Read-only Home Assistant sync: registries (entity/device/area/floor) and states through the
  Supervisor proxy, `state_changed` over the Core WebSocket, tombstones, freshness, `ha_entities` table
  (migration 0004); catalogue API and screen (ישויות HA) with domain/area/search filters and scoping
  by floor placements; `/ha/ws` push and `home_assistant` health.
- Entities on the map: plan editor entity picker (`?entity=` deep link from the catalogue), domain
  layers, live state in the marker and card, freshness/unavailable warnings.
- Safe actions through the new `custom_components/smplwise_bridge` integration (pairing code + HMAC,
  `smplwise_bridge.execute` with `Context(user_id)`, user directory push); allow-list on both sides,
  sensitive actions need confirmation, idempotent client ids, pending → confirmed by observed state,
  `ha.entity.control` permission (operator and above), audit rows.
- Settings → גשר Home Assistant: connection and sync status, pairing status, masked pairing code,
  add-on address, install steps, code regeneration (audited).
- Fix: recording-derived events no longer hold the SQLite write lock during NVR searches (other
  workers hit "database is locked" at start-up); HA sync writes in short chunks with busy retries.

## 0.1.4 (pilot)
- Events: alert-stream ingestion (parse, heartbeat, dedup, reconnect, coverage gaps, audited ack),
  recording-derived motion events (inferred), event centre with live updates, markers on the playback
  timeline, ingestion state in health; `events.retention_days`.
- Note: 0.1.3 was published twice under the same number; this release carries the events build.

## 0.1.3 (pilot)
- Cameras are discovered automatically: at start-up and every 10 minutes the add-on reads the NVR's
  channels (read-only) and, when go2rtc is configured, keeps the `smplwise_*` live streams in place.
  No "sync" click is needed before the first camera appears; the manual buttons remain. The last
  discovery result and error are shown in /api/v1/health (`discovery`).
- Playback stream names carry a per-installation id so a second product instance on the same go2rtc
  (a developer workstation next to the add-on) never deletes this instance's playback streams.
- Map screen: a fresh installation without floors shows what to do instead of an error.

## 0.1.2 (pilot, in progress)
- Default video transport is now **MSE** (works through Ingress, Cloudflare and behind CGNAT);
  WebRTC or automatic WebRTC→MSE can be selected in Settings → וידאו ומדיה when UDP to the go2rtc
  host is possible. Settings shows the running add-on version.
- Recordings: read-only NVR search per camera and local day with paging, coverage status and a short
  cache; TimeAdapter for the NVR's wall-clock times (IANA zone setting, DST-aware).
- Playback: sessions through the relay (go2rtc stream per session generation), seek = new generation,
  session cap and idle lease, orphan cleanup on start-up, audit of start/seek/stop; the הקלטות screen
  plays real recordings with the timeline following the media clock (precision labelled).
- Settings: playback cap and lease, time zone. Requirements: `tzdata`.
- Export: durable jobs (download by file from the NVR, ffmpeg remux to MP4 with concat + key-frame trim,
  manifest with SHA-256, cancel/partial/retention); `video.export` granted to operator and admins.
- Multi-camera playback groups (up to four cameras, best-effort sync with per-tile drift).
- Timeline: day → minute zoom (wheel), second-level seeks, drag scrubbing, future greyed out.
- Image: ffmpeg added to the add-on container.

## 0.1.1 (pilot, in progress)
- Live video: go2rtc adapter (namespaced `smplwise_*` streams only), authorized WebSocket relay,
  WebRTC/MSE player with automatic fallback and a transport default in Settings.
- NVR snapshots (read-only) as tile posters, cached in /data.
- Settings API (media transport, session cap, wall profile, snapshot freshness) and the Settings →
  וידאו ומדיה tab (go2rtc status, stream sync, open sessions).
- Camera view, wall, kiosk and the map popover use real streams and snapshots when a backend answers.
- Options: `nvr_rtsp_port`, `go2rtc_api_username`, `go2rtc_api_password`.
- Fixes: request transactions start with `BEGIN IMMEDIATE` (no "database is locked" when two live
  sessions end together); a live session is always released, even if its audit row fails; httpx/httpcore
  logging is capped at WARNING so source URLs never reach the add-on log; the floor-map nav entry opens
  the first real floor instead of the fixture id.

## 0.1.0 (pilot, in progress)
- Ingress-only FastAPI backend with SQLite in /data and versioned migrations.
- Identity from Supervisor Ingress headers; explicit bootstrap of the first VMS administrator.
- Sites → buildings → floors; plan assets (PDF/PNG/JPG), derived plan versions with rotation/crop,
  draft → published, map anchors with revisions and tombstones; audit log.
- Read-only camera discovery from the NVR (channels, online state, track ids).
- Built web UI (Hebrew, RTL, boards-language) served from the add-on.
