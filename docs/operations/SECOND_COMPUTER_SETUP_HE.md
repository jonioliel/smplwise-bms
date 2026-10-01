# הכנת המחשב השני (ושאר סשני Claude)

רשימת פעולות למחשב נוסף עם מנוי Claude Code נוסף. שני הסשנים מבצעים משימות על אותו ריפו ב־GitHub.
מי שמחזיק בחכירת ה"מאסטר" מחלק עבודה; התפקידים מתחלפים (כשהמכסה של המאסטר מתחת ל־10%, או כשאתה אומר).
הפרוטוקול המלא: `MULTI_CLAUDE_COORDINATION.md`. הסביבה להעתקה: `DEV_ENVIRONMENT.md`.

## חד־פעמי, במחשב החדש

1. התקנת הכלים לפי `DEV_ENVIRONMENT.md`: Git (עם `core.autocrlf=false`), Python 3.12 (לא כינוי ה־Store),
   Node 24 דרך fnm, ffmpeg, Playwright, Chrome אמיתי, OpenSSH. התחברות ל־GitHub עם הרשאת כתיבה לריפו `smplwise-bms`.
2. התקנת תוסף Claude Code `superpowers`:
   `claude plugin marketplace add obra/superpowers-marketplace` ואז
   `claude plugin install superpowers@superpowers-marketplace`.
3. שכפול הריפו: `git clone https://github.com/jonioliel/smplwise-bms.git`, מעבר לענף העבודה (`g0/intake`, או
   `pilot/coord-protocol-v2` עד שמוזג), ואז הכנת `.venv` ו־`npm ci` בתיקיית `frontend/`.
4. **הזיכרון של Claude הראשי לא נמצא ב־Git.** הוא בריפו הפרטי `smplwise-arx-private` (התיקיות `claude-memory/`
   ו־`private-evidence/`). משכפלים אותו ומעתיקים את `claude-memory/` אל
   `~/.claude/projects/<שם-תיקיית-הפרויקט>/memory/` במחשב החדש. את `private-evidence/` שמים בשורש הריפו.
5. **`secrets/` וקבצים מעל 50MB** עוברים רק בחבילת העברה פיזית שאתה מכין (דיסק או כונן). לא דרך Git, צ'אט או
   ענף התיאום. בלי `secrets/` הסשן עובד רק על משימות בלי חומרה ולא נוגע במעבדה.
6. פתיחת Claude Code בתיקיית הריפו, בחשבון השני.

## בתחילת כל סשן

אומרים ל־Claude: "קרא את `CLAUDE.md` ואת `MULTI_CLAUDE_COORDINATION.md`, הגדר `COORD_SESSION` בשם ייחודי
(`pc2-sub`) והתחל את חמש הדקות הראשונות".

**אם הסשן משנה (כרגע):**
1. `py -3.12 scripts/coord.py ping --quota <אחוז>` ואז `status` (האם יש מאסטר חי).
2. `inbox`: משימות שהמאסטר שלח. לוקחים את החשובה ביותר ומריצים `accept`.
3. אם התיבה ריקה: `claim-task` למשימה עצמאית מהבק־לוג.
4. עובדים על ענף `pilot/...` ודוחפים אותו. בסיום: `done --report report.md` (דוח סגירה בלי סודות, בלי כתובות IP,
   מספרים סידוריים או MAC; הכלי דוחה אותם).
5. צריך החלטה, נתקעים, או מצאו משימה? `assign --to master --task note.md`.

**אם הסשן מאסטר:**
1. `status`, קריאת `HANDOFF.md`, `claim-master --quota <אחוז>` אם החכירה פנויה, `heartbeat` כל 15 דקות לפחות.
2. `inbox` ו־`report`: מה המשנה שלח ומה מצבו.
3. `assign --to pc2-sub --task <T0xx או קובץ כרטיס> --branch pilot/... --priority high` ואז עבודה על משימה משלו.
4. מיזוג ענפי `pilot/...` ל־`g0/intake` ועדכון `management/tasks.json` (רק המאסטר נוגע בקובץ הזה; המשנה
   שולח שורות ראיות בדוח).
5. מכסה מתחת ל־10%: `handoff` והחלפת תפקידים.

## כלים נוספים (שני הצדדים)

- **מה רץ אצלי עכשיו:** `ping` / `heartbeat` עם `--note "מה אני עושה, ETA"` ועם
  `--agents "שם|ענף|משימה|ETA; שם2|..."` (ריק מנקה). הערות מאומתות נגד סודות כמו משימות.
- **טבלה אחת של שני הסשנים:** `report` (או `report --json`): מי המאסטר, מכסה, גיל פעימה, משימות פתוחות
  (מזהה, משימה, ענף, סטטוס) וסוכנים שרצים.
- **טיק ללולאה:** `/loop 10m` עם `py -3.12 scripts/coord.py watch --quota <אחוז>`. מדפיס רק שינויים: `NEW`
  (משימה חדשה בתיבה), `DONE` (דוח הושלם), `LEASE vacant` (אין מאסטר), `SILENT` (שותף שותק מעל 30 דקות).
  קוד יציאה 0 = כלום; אחרת 20 + סיביות (1 משימה חדשה, 2 דוח הושלם, 4 חכירה פנויה, 8 שותף שותק) ואז צריך לפעול.
- **ענפי השותף:** `branches [--peer שם]` מציג ענפי `pilot/*` שנדחפו, כמה קדימה/אחורה מול `g0/intake`, גיל וכותרת.
- **שריון מספרי מיגרציה ופורטים:** `reserve-migration [--count N]`, `reserve-port`, `reservations`,
  `release-reserved`. כל מי שיוצר קובץ מיגרציה שומר מספר קודם, כך שלעולם לא נבחר אותו מספר פעמיים.
- **מסמך העברה אוטומטי:** `handoff-draft` מדפיס טיוטה (גרסה אחרונה, ענפים, שריונות, משימות פתוחות);
  `handoff --auto [--file הערות.md]` מפרסם ומשחרר את החכירה. `cancel --ref A0003` מבטל משימה שלא הסתיימה.

## כללי ברזל

- כל שליחה נשארת בצורת push רגיל (בלי force). אם שני סשנים התנגשו, אחד מקבל "LOST RACE" ופשוט מריץ שוב.
- מספרי מיגרציה נשמרים ב־`reserve-migration` (הרשימה בענף התיאום ומועתקת למסמך ההעברה), כדי שלא יהיו שני קבצים עם אותו מספר.
- כרטיס משימה כולל: מטרה, ענף, קבצים, קבלה, בדיקות להרצה, אסור, פורמט דוח (התבנית במסמך האנגלי).

## מה לבדוק שהכול עובד

- `py -3.12 scripts/coord.py status` מדפיס מצב חכירה בלי שגיאה.
- בסשן אחד `assign --to <שם-השני> --task T005`, בסשן השני `inbox` מציג אותה, `accept` ואז `done --report ...`,
  ובסשן הראשון `report` מציג סטטוס `done`.
- `claim-task --task T005` בסשן אחד, ואז אותה פקודה בסשן שני, נכשלת עם REFUSED.
- אחרי `handoff` מהמאסטר, סשן אחר יכול לבצע `claim-master` מיד.
- הפעלה בפועל (יצירת ענף `coord/state` וחכירה ראשונה) נעשית רק כשאתה מאשר, לא לפני.
