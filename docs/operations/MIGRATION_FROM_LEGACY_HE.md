# מעבר מה־Add-on הישן (Hikvision NVR Panel 1.5.27) ל־SMPLWISE VMS — מדריך (T070)

העיקרון: שני ה־Add-ons רצים זה לצד זה (slug שונה, פאנל Ingress שונה, אותו NVR ואותו go2rtc), ה־VMS לא כותב
ל־NVR בשום שלב, והחזרה לאחור היא פשוט להפעיל שוב את הישן. שום דבר מהישן לא נמחק.

## 1. מה הישן שומר, ומה קורה לזה

| בישן | איפה | ב־VMS |
|---|---|---|
| חיבור ל־NVR (כתובת, פורטים, משתמש, סיסמה) | `options.json` של ה־Add-on + `/config/hikvision_nvr_override.json` | אפשרויות ה־Add-on של ה־VMS (`nvr_host`, `nvr_http_port`, `nvr_rtsp_port`, `nvr_username`, `nvr_password`) — מומלץ משתמש NVR לקריאה בלבד |
| go2rtc | `go2rtc_url` | `go2rtc_url`; ה־VMS משתמש רק בזרמים בשם `smplwise_*` |
| PIN משותף + PIN טכנאי | `app_pin`, `technician_pin` | **אין PIN**: כל אדם נכנס עם משתמש Home Assistant משלו; ה־VMS נותן תפקידים (הגדרות › משתמשים והרשאות) |
| שמות מצלמות (aliases) | `camera_names` ב־override | כינויים על המצלמות ב־VMS — הכלי מעתיק אותם לפי מספר ערוץ |
| היסט תצוגה של זמני הקלטה (auto / manual) | `recording_display_offset_*` | **אין היסט**: ה־VMS מציג את זמני ה־NVR כפי שהם באזור הזמן שבהגדרות (T014). הכלי מחשב מה ההיסט האפקטיבי בישן ומזהיר אם הוא לא 0 |
| הקלטה ידנית (שורות) | `manual_recording` | לא עובר — כתיבה ל־NVR, לא בפיילוט (דורש אישור שלך) |
| מאגר אירועים מקומי (JSONL) | `/config/hikvision_nvr_event_store.jsonl` | לא מיובא — ל־VMS אירועים משלו; הקובץ נשאר כארכיון |

## 2. הרצת ה־dry run

הקבצים של הישן נמצאים ב־HA תחת `/config/` (override + event store) ו־`/data/options.json` של ה־Add-on הישן
(ניתן להוריד דרך Samba / SSH / File editor). על תחנת העבודה:

```bash
python scripts/migrate_legacy.py --options options.json --override hikvision_nvr_override.json --events hikvision_nvr_event_store.jsonl --vms-url http://127.0.0.1:8099 --keep private-evidence/migration --markdown private-evidence/migration/report.md
```

- `--vms-url` משווה מול VMS רץ (מצלמות לפי ערוץ, אזור זמן); בלי גישה ל־VMS אפשר `--vms-cameras cameras.json` (תשובה שמורה של `GET /api/v1/cameras`).
- `--vms-options` (ה־options.json של ה־VMS) בודק שזה אותו NVR ואותם פורטים — לא מודפס דבר מהערכים.
- `--keep DIR` שומר עותק של קובצי הישן כארכיון לפני הכול.
- הדוח לעולם לא מדפיס סיסמאות או PIN; כתובות מוצגות רק באוקטט האחרון.

מה לבדוק בדוח: אזהרות בראש; טבלת המצלמות (`set_alias` = יועתק, `no_vms_camera` = להריץ "סנכרון מה־NVR" קודם,
`keep_vms_alias` = יש כבר כינוי אחר ב־VMS); שורת הזמן (היסט אפקטיבי); אנשים ותפקידים.

## 3. העתקת הכינויים (הכתיבה היחידה, ל־VMS בלבד)

```bash
python scripts/migrate_legacy.py --options options.json --override hikvision_nvr_override.json --vms-url http://127.0.0.1:8099 --apply-aliases
```

נכתבים רק כינויים ריקים ב־VMS; `--force-aliases` דורס גם כינויים שונים. כל כתיבה נרשמת באודיט של ה־VMS.

## 4. תקופת צל (shadow) — לפני כיבוי הישן

1. יום אחד של הקלטות: אותו יום, אותה מצלמה בשני הממשקים — אותם קטעים ואותן שעות (בישן אחרי ההיסט, ב־VMS כפי שהם).
2. אירוע ידוע (דלת, תנועה בשעה שידועה לך): לוודא שהשעה ב־VMS נכונה ללא היסט.
3. קיר חי: אותן מצלמות, אותה איכות (ראשי/משני).
4. ייצוא של קטע קצר משני הממשקים — אותו תוכן.

## 5. מעבר וגיבוי

- לתת לכל אדם משתמש HA ותפקיד ב־VMS (צופה / מפעיל / מנהל אתר; תפקיד מותאם לפתיחת דלת / נטרול אזעקה / ייצוא).
- להפעיל "Notify Surveillance Center" ב־NVR (התראות חיות).
- לעצור את ה־Add-on הישן (לא להסיר) אחרי שאישרת parity. גיבוי פרויקט של ה־VMS: הגדרות › גיבוי.
- הסרה סופית של הישן — רק באישור כתוב שלך, והקבצים ב־`/config` נשארים כארכיון.

## 6. חזרה לאחור

להפעיל שוב את ה־Add-on הישן: ההגדרות שלו והקבצים ב־`/config` לא נגעו; ה־NVR לא שונה. ה־VMS יכול להישאר מותקן
ועצור, וגיבוי אוטומטי (`auto-pre-upgrade`) קיים לכל צעד גרסה.

## 7. מה עדיין פתוח (T003/T004)

השוואת golden traces מול הישן (characterization) דורשת גישה ללוגים/תעבורה של ה־Add-on הישן בזמן ריצה — פעולה
שלך. עד אז ה־dry run והשוואת הצל הידנית הם הראיה.
