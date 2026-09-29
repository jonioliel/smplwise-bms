Source: docs/operations/G0_INTAKE.md @ 2424776

> תרגום של `docs/operations/G0_INTAKE.md`; המקור באנגלית קובע במקרה של סתירה.

# קליטת G0 — סטטוס 14.09.2026 (סביבת עבודה מקומית `C:\cloude\smplwisebms`, ענף `g0/intake`)

| קלט | מצב | ראיית סגירה |
|---|---|---|
| מאגר legacy עובד + commit מדויק | **התקבל** | קובץ zip של add-on v1.5.27 (SHA-256 `E7182A39…89F7A`), יובא ללא שינוי על ענף מקומי `legacy/import` (commit `ab19bf1`); הבעלים מאשר שזו הגרסה הרצה. לא פורסם (החלטת בעלים). ביקורת: `docs/legacy/LEGACY_AUDIT.md`, `REUSE_MATRIX.md`, `KNOWN_QUIRKS.md`. |
| דגם/קושחה/קודק/ערוצי NVR | **אומת (קריאה בלבד)** | DS-7616NXI-K2(D), V4.84.101 build 251212, פורט ISAPI 90, 10 ערוצי H.264 2560×1440, ערוצים 101…1001; לכידות תחת `private-evidence/nvr-probes/20260914T071715Z/` (לא מוסתר, מקומי בלבד). דגימות זמן-מקור: `time_test_Q1..Q3.xml` (ראו KNOWN_QUIRKS §1). |
| גרסת HA ונתיב זהות/הרשאות | **אומת חלקית** | Core 2026.9.2, אזור זמן Asia/Jerusalem, אינטגרציות `hikvision_next`, `hikvision_intercom`, `go2rtc`, `webrtc`. הטוקן של הבעלים = משתמש לא-מנהל `codex` (Supervisor API 401) ← שמיש כזהות בדיקה של משתמש רגיל. גרסאות Supervisor/OS, שמות כותרות Ingress וכתובת ה-proxy: **פתוח** עד שיותקן שלד ה-add-on (T009/T081); דורש SSH או פעולת מנהל מצד הבעלים להתקנה. |
| גרסת/התנהגות תצורת go2rtc חיצוני | **אומת** | 1.9.14 (add-on של AlexxIT) על מארח ה-HA, 20 זרמים זרים (מצלמות, עמדות דלת אינטרקום, hikvision_next). API PUT נשמר ל-`/config/go2rtc.yaml`, DELETE מסיר; זרם הבדיקה נוקה (`private-evidence/go2rtc-probes/…/verdict.json`). התנהגות הפעלה מחדש: פתוח (דורש אישור להפעלה מחדש של ה-add-on). |
| דיוק ניגון ועיגון מקור | **לא אומת** | הצהרת בעלים בלבד (עבודת ניגון/הורדה legacy). תוכנית T006 ב-ADR-013. |
| סודות מחוץ למאגר | **בוצע** | `secrets/lab.env` (מוסתר מגיט; אומת עם `git check-ignore`). סקריפטי הבדיקה (probe) מסתירים hosts, מספרים סיריאליים, MACs ואישורים לפני הדפסה; לכידות גולמיות נשארות ב-`private-evidence/`. |
| אישור לשינויי מעבדה/פעולות פיזיות | **מוגדר בהיקף** | קריאה בלבד כברירת מחדל. אושר ב-14.09.2026: כתיבות go2rtc מוגבלות במרחב השם `smplwise_` (זרם בדיקה, חריצי ניגון עבור T006). לא אושר: כתיבות NVR (בדיקות הקלטה ידניות, אתחול, בדיקות דיסק), הפעלה מחדש של go2rtc, שינויי HA, פעולות פיזיות. |
| תקציב שימוש AI/ענן והסכמת פרטיות | **לא נדרש ב-G0** | הפיתוח רץ בסשן Claude Code; לא מתוכננות קריאות API בתשלום או העלאות לענן. ה-AI של מנרמל התוכניות (T060) יזדקק להסכמה משלו בהמשך. |

## כלים (תחנת עבודה)
Python 3.12.10 (per-user), Node 24.21.0 + npm 11.19 (fnm), git 2.54.0; venv `.venv` עם httpx.
`python scripts/project_status.py` ← PASS על רישום הבסיס (baseline registry).

## מלאי גישה
| מערכת | כתובת (ראו `secrets/lab.env`) | אימות | סטטוס |
|---|---|---|---|
| NVR ISAPI | `NVR_HOST:90` | Digest, חשבון מנהל (הבעלים ייצור חשבון לא-מנהל ייעודי בהמשך) | נגיש |
| go2rtc API | `GO2RTC_URL` | לא מוגדר אימות | נגיש |
| HA REST/WS | `HA_URL` | טוקן long-lived, משתמש `codex` (לא-מנהל) | נגיש |
| SSH למארח HA | פורט 22 פתוח, ה-add-on מושבת על ידי הבעלים | מפתח `smplwise_ha_ed25519` מוכן | עדיין לא זמין |

## תבנית `secrets/lab.env`
```
NVR_HOST=            NVR_HTTP_PORT=90   NVR_RTSP_PORT=554   NVR_USER=   NVR_PASSWORD=
GO2RTC_URL=          GO2RTC_API_USER=   GO2RTC_API_PASSWORD=
HA_URL=              HA_USERNAME=       HA_TOKEN=
HA_SSH_HOST=         HA_SSH_PORT=22     HA_SSH_USER=root    HA_SSH_KEY=
```

קריאה-בלבד אינה אומרת בלתי מוגבל: לחלונות חיפוש, בדיקות (probes), זרמים וייצוא מוגבלים כדי שה-NVR
ימשיך להקליט. יש ללכוד שיטות API כפי שנצפו, לא לנחש מטבלאות נקודות קצה בארכיון. לעולם לא לעשות commit
לסודות או לפריימי מצלמה מזהים.
