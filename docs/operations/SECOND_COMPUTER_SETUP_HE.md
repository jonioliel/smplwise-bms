# הכנת המחשב השני (ושאר סשני Claude)

המסמך הזה הוא רשימת פעולות למחשב נוסף או לחשבון Claude נוסף. הפרוטוקול המלא נמצא ב־`MULTI_CLAUDE_COORDINATION.md`.

## חד־פעמי, במחשב החדש

1. התקנת Git, Python 3.12 ו־Node 24 (כמו במחשב הראשי), והתחברות ל־GitHub עם גישה לריפו `smplwise-bms`.
2. שכפול הריפו ומעבר לענף שמכיל את הפרוטוקול:
   `git clone https://github.com/jonioliel/smplwise-bms.git` ואז `git checkout pilot/coord-protocol`
   (אחרי שהענף ימוזג ל־`g0/intake` אפשר לעבוד מ־`g0/intake`).
3. פתיחת Claude Code בתיקיית הריפו, בחשבון השני.
4. **קבצים שלא בריפו.** `secrets/lab.env` ו־`private-evidence/` לא מועברים דרך Git. אם המחשב השני צריך
   גישה למעבדה, מעתיקים אותם ידנית ובצורה מוצפנת. בלי הקבצים האלה הסשן עובד רק על משימות שאינן דורשות חומרה.

## בתחילת כל סשן

אומרים ל־Claude: "קרא את `CLAUDE.md`, הגדר `COORD_SESSION` בשם ייחודי (למשל `pc2-sub`), והרץ `scripts/coord.py status`".
מכאן Claude פועל לפי הפרוטוקול: קורא את `HANDOFF.md`, לוקח משימת משנה, ובמקרה שהמאסטר נפל מחליט אם לתפוס את התפקיד.

## מה לבדוק שהכול עובד

- `py -3.12 scripts/coord.py status` מדפיס מצב חכירה בלי שגיאה.
- `claim-task --task T005` בסשן אחד, ואז אותה פקודה בסשן שני, צריכה להיכשל עם REFUSED.
- אחרי `handoff` מהמאסטר, סשן אחר יכול לבצע `claim-master` מיד.
