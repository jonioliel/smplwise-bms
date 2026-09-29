Source: docs/operations/TASK_RUNNER.md @ 6ca0772

> תרגום של `docs/operations/TASK_RUNNER.md`; המקור באנגלית קובע במקרה של סתירה.

# מריץ משימות מקומי (T073, אופציונלי)

`scripts/task_runner.py` מפעיל הפעלה **אחת** של CLI מקומי לכתיבת קוד לכל כרטיס משימה, ומסרב
לרוץ אלא אם כל שער מתקיים. זהו כלי עבור המוביל הטכני (technical lead), לא פיצ'ר מוצר, והוא
לעולם אינו מדמה עבודה.

```bash
python scripts/task_runner.py validate --cli claude
python scripts/task_runner.py run T065 --cli claude --model claude-sonnet-5 --effort medium --workspace . --budget-usd 5 --timeout-s 1800 --dry-run
python scripts/task_runner.py run T065 --cli claude --model claude-sonnet-5 --effort medium --workspace . --budget-usd 5 --timeout-s 1800
python scripts/task_runner.py stop T065
python scripts/task_runner.py status T065
```

שערים, בסדר:

1. **אימות CLI** — הקובץ הניתן להרצה חייב לענות ל-`--version`; אחרת שום דבר לא מופעל
   (`cli_invalid`).
2. **שער תלויות** — התלויות של הכרטיס חייבות להיות `DONE` (`--gate evidence` מקבל תלויות
   שנושאות ראייה אבל עדיין BACKLOG, שהוא מצב הטרום-קבלה (pre-acceptance) של הפרויקט הזה).
3. **תקרת ניסיונות** — אחרי `--max-attempts` (ברירת מחדל 2) הרצות כושלות, המשימה הופכת
   ל-`needs_review`: אדם מחליט, שום דבר לא מתנסה שוב מעצמו.
4. **רשימת היתר לסביבת עבודה (workspace)** — סביבת העבודה חייבת להיות בתוך המאגר ומחוץ
   ל-`secrets/`, `private-evidence/`, `legacy/`, `data/`, `.git/`; ה-prompt חוזר על הכלל
   ל-CLI, וקבצים שההרצה שינתה תחת קידומת אסורה מדווחים כ-`violations`.
5. **תקציב** — תקציב חיובי להרצה, מוגבל ל-25 דולר, נרשם בהפעלה; המריץ אינו יכול להרשות
   הוצאה ואין לו נתיב רכישה.

בזמן שהרצה פעילה, `--timeout-s` קשיח מסיים אותה, וקובץ `STOP` בתיקיית ההרצה (או
`task_runner.py stop <task>`) עוצר אותה ידנית. כל הרצה משאירה
`management/runs/<task>/<run id>/` עם `prompt.md`, `invocation.json`, `run.log` ו-`result.json`
(schema `smplwise-task-run/1`: משימה, run id, גרסת CLI, מודל, effort, workspace, תקציב, תזמון,
קוד יציאה, timed out, נעצר על ידי, קבצים שהשתנו, violations, דוח `RESULT:` ה-JSON של ה-CLI
עצמו, סטטוס). `management/runs/` היא תיקיית עבודה: יש לעשות commit להרצה רק כשהיא ראייה
לכרטיס.

תבנית ההפעלה היא רשימת argv בפורמט JSON עם ה-placeholders `{cli} {model} {effort} {prompt}
{prompt_file} {workspace}`; ברירת המחדל היא `["{cli}", "--print", "--model", "{model}",
"{prompt}"]`.

מגבלות ידועות: המריץ צופה בכתיבות דרך `git status` בדיעבד — הוא לא יכול לעשות sandbox
ל-CLI; העלות היא מה ש-CLI מדווח, המריץ רק תוחם את התקציב המוצהר ומספר הניסיונות.
