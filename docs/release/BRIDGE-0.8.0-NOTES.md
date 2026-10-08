# SMPLWISE Bridge 0.8.0 - upgrade note / הערת שדרוג

## English

**What changed.** The bridge integration moves from 0.7.0 to 0.8.0. There is no new service and no new configuration. The service allow-list
(`ALLOWED_SERVICES`) gained five pairs that the equipment cards of add-on 2.4.0 (CARD1) use: `valve.open_valve`, `valve.close_valve`,
`vacuum.pause`, `water_heater.turn_on`, `water_heater.turn_off`. Those pairs were added in 2.4.0 without a version bump, so a bridge that
reports 0.7.0 may lack them and answers `service_not_allowed`; the card rolls the action back. The add-on now requires 0.8.0 for these
actions (`ha_bridge.BRIDGE_EQUIPMENT_REQUIRED`), and the health report (Settings, system health, "bridge" check) shows a warning that asks the
administrator to update the connection component while the installed version is older. Both copies of the bridge
(`custom_components/smplwise_bridge` and `smplwise_vms/integration/smplwise_bridge`) are byte-identical; `scripts/release_check.py` and
`test_bridge_080.py` assert it.

**Upgrade.** Install the add-on release that carries bridge 0.8.0 (the add-on copies the integration into the Home Assistant configuration
directory on start; HACS users update the integration there). **Restart Home Assistant afterwards** - a custom integration is loaded only at
start-up. Nothing is switched on by itself.

**Verify.**
1. In Home Assistant: Settings > Devices & services > SMPLWISE Bridge shows version 0.8.0.
2. In Arx: system health, the "bridge" check is green and its detail shows integration version 0.8.0 with no update request.
3. Long-press a valve / water heater / robot vacuum device and use an action: it is confirmed by the reported state instead of rolling back with `service_not_allowed`.

**Rollback.** Reinstall the previous bridge copy and restart Home Assistant; the equipment-card actions then answer `service_not_allowed` again. No data is migrated.

## עברית

**מה השתנה.** אינטגרציית הגשר עוברת מ-0.7.0 ל-0.8.0. אין שירות חדש ואין הגדרה חדשה. רשימת השירותים המותרים (`ALLOWED_SERVICES`) גדלה בחמישה
זוגות שכרטיסי הציוד של התוסף 2.4.0 (CARD1) משתמשים בהם: `valve.open_valve`, `valve.close_valve`, `vacuum.pause`, `water_heater.turn_on`,
`water_heater.turn_off`. הזוגות נוספו ב-2.4.0 בלי העלאת גרסה, ולכן גשר שמדווח 0.7.0 עלול לא להכיר אותם ויענה `service_not_allowed`; הכרטיס
מגלגל את הפעולה חזרה. התוסף דורש עכשיו 0.8.0 לפעולות אלה (`ha_bridge.BRIDGE_EQUIPMENT_REQUIRED`), ודוח בריאות המערכת (בדיקת "גשר")
מציג אזהרה שמבקשת ממנהל לעדכן את רכיב החיבור כל עוד הגרסה המותקנת ישנה יותר. שני עותקי הגשר זהים בבייטים; `scripts/release_check.py`
ו-`test_bridge_080.py` בודקים זאת.

**שדרוג.** מתקינים את גרסת התוסף שנושאת את גשר 0.8.0 (התוסף מעתיק את האינטגרציה לתיקיית ההגדרות של Home Assistant בעלייה; משתמשי HACS מעדכנים
שם). **מפעילים מחדש את Home Assistant אחרי העדכון** - אינטגרציה מותאמת נטענת רק בעלייה. דבר לא מופעל מעצמו.

**אימות.**
1. ב-Home Assistant: הגדרות > מכשירים ושירותים > SMPLWISE Bridge מציג גרסה 0.8.0.
2. ב-Arx: בריאות המערכת, בדיקת "גשר" ירוקה והפירוט מציג גרסת אינטגרציה 0.8.0 בלי בקשת עדכון.
3. לחיצה ארוכה על מכשיר ברז / דוד / שואב רובוטי והפעלת פעולה: היא מאושרת לפי המצב המדווח ולא מתגלגלת חזרה עם `service_not_allowed`.

**חזרה אחורה.** מחזירים את עותק הגשר הקודם ומפעילים מחדש את Home Assistant; פעולות כרטיסי הציוד יענו שוב `service_not_allowed`. אין הגירת נתונים.
