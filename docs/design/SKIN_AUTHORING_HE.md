# הוספת סקין (skin) למערכת - מדריך למעצב

מבנה אחד, כמה מראות. ה**מבנה** (פריסה, רכיבים, מצבים, ארכיטקטורת מידע) זהה בכל הסקינים; ה**מראה** חי בשני מקומות בלבד:
טבלת הטוקנים של הסקין (`{name:{light,dark}}`) וסט תחום של כללי רכיב (<= 50 כללים). הסקין נבחר לכל ההתקנה
(הגדרות › כללי › מראה המערכת, `ui.skin`), והבהיר/כהה/אוטומטי נבחר בנפרד (`ui.scheme`, ולכל דפדפן גם בחירה אישית).

## 1. איפה הכול נמצא

| קובץ | תפקיד |
|---|---|
| `frontend/src/design/tokens.ts` | **טבלת הטוקנים היחידה** של המוצר: `TOKEN_GROUPS` -> `TOKENS`. כל שם `--sw-*` מוגדר כאן פעם אחת עם `light` ו-`dark`. עמודת ה-light של סקין `classic` היא המראה של לפני היסוד (פיקסל-זהה), עמודת ה-dark היא ערכת הכהה של כל המעטפת. |
| `frontend/src/design/skins/<id>.ts` | הסקין: `tokens` (עקיפות, **תמיד שתי העמודות**), `rules` (CSS), שם בעברית ובאנגלית. |
| `frontend/src/design/skins/index.ts` | הרישום: `SKIN_IDS`, `SKINS`, תקציב הכללים (`SKIN_RULE_BUDGET = 50`). |
| `frontend/src/design/css.ts` | מייצר את ה-CSS מהטבלה (`tokensCss()`) ומכללי הסקין (`skinRules()`). |
| `frontend/src/design/apply.ts` | זמן ריצה: מי הסקין והסכמה בתוקף, `data-skin` + `data-theme` על `<html>`, גיליון הטוקנים וגיליון כללי הסקין. |
| `smplwise_vms/backend/smplwise/routers/settings.py` | האימות של `ui.skin` / `ui.scheme` (ערך לא מוכר = 422). **שומרים את הרשימה בסנכרון עם `SKIN_IDS`** (בדיקה: `test_ui_skin_and_scheme_settings`). |

מנגנון ההחלפה: `<html data-skin="classic|domus|tesla" data-theme="light|dark">`. `auto` נפתר ב-JS לפי `prefers-color-scheme`
ומתעדכן חי; ה-CSS מכיל גם רשת ביטחון ב-`@media (prefers-color-scheme: dark)` כשאין `data-theme`.

## 2. איך מוסיפים סקין (4 צעדים)

1. **קובץ** `frontend/src/design/skins/<id>.ts`. מעתיקים את `tesla.ts` ומחליפים ערכים. `tokens` מכיל רק מה שמשתנה,
   כל ערך `lt(light, dark)` או `same(v)`. שם שלא קיים ב-`tokens.ts` = שגיאה בבדיקה. מומלץ לצאת מהערכים של הסקין הקרוב.
2. **רישום**: `SKIN_IDS` ו-`SKINS` ב-`skins/index.ts`, ועוד `^(classic|domus|tesla|<id>)$` ב-`routers/settings.py`.
3. **כללים** (`rules`): CSS שנכתב לתוך ה-shadow roots (כל ה-UI הוא רכיבי Lit). הגיליון נטען לכל shadow root, לכן הסלקטורים הם
   `:host(sw-card) { }`, `:host(sw-button[variant='primary']) button { }`, `:host(sw-app) nav.rail { }`, `::slotted(input) { }`,
   `:host(devices-building) nav.tree { }`. משתמשים **רק בטוקנים** (`var(--sw-*)`) - אין צבע, רדיוס או צל קשיחים.
4. **בדיקה**: ראו §5.

## 3. תקציב 50 הכללים

"כלל" = בלוק `{ }` אחד. `ruleCount()` ב-`css.ts` סופר, והבדיקה `unit-design-tokens.spec.ts` נכשלת מעל 50 (היום Domus 28, Tesla 33).
הכללים נוגעים **רק** ב: חומר (זכוכית/שטוח), סרגל הצד והפס התחתון, כרטיסים, כפתורים, שדות, צ'יפים ותגיות, מתג, פקד מקטעים,
דיאלוג/מגירה/popover, טבלאות ושורות רשימה, ועץ הבניין. כלל ששינוי שלו משנה סדר, תוכן או מצב של רכיב - שייך לבסיס, לא לסקין.
סחף (כלל שמתקן בעיה מקומית במקום בבסיס) הוא הסיכון העיקרי: מתקנים בבסיס, לא בסקין.

## 4. כללים שמחייבים כל סקין

- **עץ הבניין/אזורים** (קומות עם כיווץ/הרחבה, אזורים, ספירת נדלקים, תפריט הקומה, בחירה) חייב להישאר בולט בכל סקין במחשב;
  בטלפון המקבילה היא כרטיסי הקומות (כל השורות והפעולות של העץ). סלקטורים: `devices-building nav.tree`, `.tree-row`, `.tree-row.selected`.
- יעדי מגע >= 44px בטלפון; ניגודיות טקסט >= 4.5:1 (הבדיקה מחשבת את זה לכל סקין ולכל סכמה, מול המשטח ה-solid);
  מצב ("דולק", "פעיל") הוא תמיד **צורה + טקסט**, לא צבע בלבד.
- חומר שקוף חייב `--sw-surface-solid` (fallback לדפדפן בלי `backdrop-filter` ול-`prefers-reduced-transparency`); שכבות צפות
  (דיאלוג, מגירה) משתמשות ב-solid.
- כיווניות לוגית בלבד (`inset-inline-start`, `margin-inline-*`); וידאו, מפה, ציר זמן ותלת-ממד תמיד LTR.
- `prefers-reduced-motion`: משכי התנועה מתאפסים (`css.ts`), אין hover-lift.

## 5. איך בודקים

```
cd frontend
npx playwright test tests/unit-design-tokens.spec.ts --project=desktop          # שלמות טוקנים, תקציב כללים, ניגודיות
SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-design-foundation.spec.ts --project=desktop --project=mobile
```
הבדיקה השנייה מצלמת סקין x (light, dark) x (בית עם עץ הבניין, מפה, הגדרות, דיאלוג, כרטיס הבחירה) ב-1440 וב-390 אל
`docs/design/evidence/design-foundation/`, וגם בודקת ש-`classic` פיקסל-זהה לבסיס שצולם לפני היסוד. בפיתוח אפשר לראות סקין
בלי לשמור: `?skin=<id>&scheme=dark` בכתובת (לתצוגה הנוכחית בלבד). מוסיפים את הסקין החדש לרשימת `SKINS` בראש ה-spec


## 6. מה עוד לא כלול (עבודה לפי מסך)

היסוד מכסה טוקנים, מעטפת, רכיבים משותפים ועץ הבניין. מסכים שיש להם צבעים קשיחים משלהם (מפה ו-3D, וידאו, מולטימדיה,
לוח זמנים) מקבלים כהה רק דרך טוקני הקנבס, ויעברו למבנה החדש (מצב רשימה, כיוון הבית "לוח צד") מסך אחר מסך.
משפחת `--dv-*` של מסכי החשמל והתקנים (סגנון glass) נשארת כפי שהיא ומגשרת על `--sw-*` בתוך המסכים האלה.
