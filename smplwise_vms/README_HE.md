Source: smplwise_vms/README.md @ 22a833c

> תרגום של `smplwise_vms/README.md`; המקור באנגלית קובע במקרה של סתירה.

# SmplWise Arx — Add-on ל-Home Assistant

ניהול וידאו ממוקד-מפה עבור NVR מסוג Hikvision בתוך Home Assistant (Ingress, זהות HA, תפקידי VMS).
ראו את [DOCS.md](DOCS.md) (או את המקבילה בעברית [DOCS_HE.md](DOCS_HE.md)) להתקנה ולתצורה. מקור ה-UI:
`../frontend`; ה-backend: `backend/` (Python 3.12, FastAPI, SQLite). יש לבנות את ה-UI לתוך `www/` עם
`npm --prefix ../frontend run build:addon` לפני commit של release.

## לולאת פיתוח (תחנת עבודה, בלי Docker)

```bash
cd smplwise_vms/backend && pip install -r requirements.txt pytest pymupdf
SW_DEV_USER=<your-ha-username> SW_BOOTSTRAP_ADMIN=<your-ha-username> SW_DATA_DIR=../../data SW_WWW_DIR=../../frontend/dist python -m smplwise
```

- `SW_DEV_USER` מחליף את זהות ה-Ingress בתחנת עבודה בלבד; ה-backend מסרב לקבל אותו כאשר `/data/options.json`
  קיים (כלומר בתוך ה-add-on עצמו). יש להוסיף `X-SW-Dev-User: <name>` כדי לפעול בתור משתמש אחר.
- גילוי ה-NVR קורא את `NVR_HOST`, `NVR_HTTP_PORT`, `NVR_USER`, `NVR_PASSWORD` מהסביבה (לעולם לא לשמור אותם
  ב-commit); `go2rtc_url` שמור לבנייה של וידאו חי.
- ללא `pdftoppm` ב-PATH, נתיב הפיתוח (fallback) הופך PDF לתמונות עם PyMuPDF בתוך התהליך עצמו; תמונת ה-add-on
  תמיד משתמשת ב-`pdftoppm` בתת-תהליך מוגבל.
- `npm --prefix ../frontend run dev` (פורט 5173) או `preview` (פורט 4173) מעבירים (proxy) את `/api` אל
  `127.0.0.1:8099`.
- בדיקות: `pytest` כאן; חבילות Playwright מבוססות-fixture תחת `../frontend/tests` רצות במצב דמו (יש לעצור
  קודם את ה-backend); `SW_LIVE=1 npx playwright test tests/evidence-live.spec.ts` מתעד ראיות מול backend אמיתי.
