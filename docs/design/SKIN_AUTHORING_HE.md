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

מנגנון ההחלפה: `<html data-skin="classic|domus|tesla|bubble|crystal" data-theme="light|dark">`. `auto` נפתר ב-JS לפי `prefers-color-scheme`
ומתעדכן חי; ה-CSS מכיל גם רשת ביטחון ב-`@media (prefers-color-scheme: dark)` כשאין `data-theme`.

## 2. איך מוסיפים סקין (4 צעדים)

1. **קובץ** `frontend/src/design/skins/<id>.ts`. מעתיקים את `tesla.ts` ומחליפים ערכים. `tokens` מכיל רק מה שמשתנה,
   כל ערך `lt(light, dark)` או `same(v)`. שם שלא קיים ב-`tokens.ts` = שגיאה בבדיקה. מומלץ לצאת מהערכים של הסקין הקרוב.
2. **רישום**: `SKIN_IDS` ו-`SKINS` ב-`skins/index.ts`, ועוד `^(classic|domus|tesla|<id>)$` ב-`routers/settings.py`.
3. **כללים** (`rules`): CSS שנכתב לתוך ה-shadow roots (כל ה-UI הוא רכיבי Lit). הגיליון נטען לכל shadow root, לכן הסלקטורים הם
   `:host(sw-card) { }`, `:host(sw-button[variant='primary']) button { }`, `:host(sw-app) nav.rail { }`, `::slotted(input) { }`,
   `:host(devices-building) nav.tree { }`. משתמשים **רק בטוקנים** (`var(--sw-*)`) - אין צבע, רדיוס או צל קשיחים.
4. **בדיקה**: ראו §5.

## 2א. שכבת משתני העיצוב וסקין כנתונים (DESIGNTOKENS-297, יסודות 2.25.0)

**החוזה הסמנטי** - `frontend/src/design/semantic.ts`. לא משתנים חדשים ולא ערכים חדשים: הקובץ נותן שם לתפקיד של משתנים קיימים,
וכל סקין נבדק מולו בשתי הסכמות.

| תפקיד | המשתנים (לפי הסדר) |
|---|---|
| רמות משטח | `--sw-bg` > `--sw-surface` > `--sw-surface-2` > `--sw-surface-3` (וה-solid של כל רמה) |
| רמות טקסט | `--sw-heading` > `--sw-text` > `--sw-text-2` > `--sw-text-3`; על מילוי מבטא `--sw-text-inverse` |
| מסגרת | `--sw-border`, `--sw-border-strong`; תפריט: `--sw-menu-surface` / `--sw-menu-border` (תמיד אטומים) |
| מבטא | `--sw-accent`, `-hover`, `-soft`, `-text`, `--sw-focus`, `--sw-nav` |
| צבעי מצב (רק למצב) | `live, recorded, offline, stale, unknown, danger, warning, success, forbidden` - כל אחד צבע / `-soft` / `-text` |
| רדיוס | `--sw-r-2xs` ... `--sw-r-2xl`, ועוד `--sw-r-pill` |
| גובה (צל) | 0 = בלי צל; `--sw-shadow-1` מנוחה, `-2` ריחוף, `-3` צף (דיאלוג, popover, toast) |
| ריווח | `--sw-s-1` ... `--sw-s-10` (רשת 4px) |
| טיפוגרפיה | `--sw-fs-2xs` ... `--sw-fs-4xl`, משקלים `--sw-fw-*` |
| תנועה | משכים (`--sw-t-*`, `--sw-spring-*-ms`, `--sw-stagger`, `--sw-enter-ms`), מרחק (`--sw-hover-lift`, `--sw-enter-y`), קנה מידה (`--sw-press-scale`), עקומות (`--sw-ease*`) |

הבדיקות של החוזה (`validateSkinTable`): כל השמות קיימים עם light ו-dark; סולמות רדיוס / ריווח / טיפוגרפיה לא יורדים; המבטא
(`accent`, `accent-hover`, `nav`, `focus`) אף פעם לא שווה לצבע של danger / warning / success / live / stale / forbidden; כל משך הוא
`ms` וכל מרחק `px`; סגירה לא איטית מפתיחה (`--sw-t-exit` <= `--sw-t-sheet`); משטח ומסגרת התפריט אטומים.
**תנועה מופחתת** נבנית מאותן רשימות (`css.ts`): משכים 0ms, מרחק 0px, `--sw-press-scale: 1`; צבע ושקיפות נשארים.
משך או מרחק חדש בקבוצת motion של `tokens.ts` חייב להיכנס לרשימה ב-`semantic.ts` (הבדיקה נכשלת אחרת).

**שלב ותכונות לכל סקין** (`skins/define.ts`), שדות חובה ברישום:
- `stage`: `stable` (במטריצת הפיקסלים), `foundation` (נבחר, בלי בסיסי פיקסלים - infra, soft), `frozen` (לא מוצע, נקרא כ-domus - bubble).
  `FROZEN_SKINS` ו-`FOUNDATION_SKINS` נגזרים מהשדה הזה.
- `features`: `material` (שכבת החומר של `styles/material.ts`), `bevel` (שפת התבליט של 1px בשכבת החומר - **מותר רק ב-classic וב-domus**),
  `pixelEdge` (קו האור של 1px בראש לוח, `--sw-highlight` לא שקוף), `glass` (טשטוש רקע). הבדיקה משווה את ההצהרה למה שהסקין באמת מצייר,
  ושכבת החומר מצורפת לכללים רק כש-`material` מוצהר.
  סתירה מתועדת: bubble (מוקפא) שומר את שפת התבליט שלו כפי שהיא - "בלי שינוי חזותי בסקינים קיימים" גובר; הוא לעולם לא מצויר.

**סקין כנתונים**: במקום קובץ עם כללים, אפשר להגדיר סקין כאובייקט:

```ts
export const harbor = defineSkin({
  id: 'harbor', name: 'Harbor', nameHe: 'נמל', noteHe: 'משטחים אטומים, פינות רכות',
  light: { '--sw-r-md': '10px', '--sw-text-3': '#56657f' },
  dark:  { '--sw-r-md': '10px', '--sw-text-3': '#93a0b8' },
  features: { bevel: false },   // ברירת מחדל: בלי חומר ובלי תבליט; pixelEdge / glass נגזרים מהטוקנים
});
```

`defineSkin` נכשל (עם רשימת כל הבעיות) על: שם שלא קיים ב-`tokens.ts`, ערך בסכמה אחת בלבד, תבליט מחוץ ל-classic / domus, הפרה של
החוזה הסמנטי, יותר מ-50 כללים, שם ארוך מ-24 תווים או הערה ארוכה מ-90 (כרטיס הבחירה עוטף שם ארוך ולא מתרחב). סקין חדש מתחיל
ב-`foundation`. הרישום: המזהה ב-`SKIN_IDS`, האובייקט ב-`SKINS`, והמזהה בתבנית `ui.skin` וב-`stored_skin` של `routers/settings.py` -
`unit-designtokens-297.spec.ts` משווה את רשימות השרת לרישום. מסך הבחירה (הגדרות › כללי › מראה המערכת) קורא מהרישום ואין בו מה לשנות.

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
- **תפריט הוא תמיד אטום** (2026-10-13, בקשת הבעלים: תפריט המשתמש הציג את עץ הבניין מבעדו בסקינים הזכוכיתיים). כל מה שצף מעל
  תוכן אחר כתפריט - תפריט המשתמש (ובטלפון הגיליון התחתון), רשימת dropdown, תפריט "...", כרטיס popover, רשימת תוצאות חיפוש, חלון
  בחירה - צובע `background: var(--sw-menu-surface)` ומסגרת `var(--sw-menu-border)`, בלי `backdrop-filter`. כל סקין מגדיר את שני
  הטוקנים בשתי הסכמות כצבעים **אטומים לגמרי** (`#rrggbb`, לא rgba): המשטח הוא ה-solid של הסקין והמסגרת הקו הדק שלו מחוּשב מעליו.
  כלל סקין שצובע selector של תפריט (`:host(sw-popover)`, `:host(sw-dropdown) .pop`, `:host(sw-app) .searchpanel`) חייב להשתמש בטוקן
  הזה, בלי blur, ובכלל משלו (לא ביחד עם דיאלוג או מגירה). כרטיסים ופאנלים שעל הדף נשארים זכוכית; דיאלוג, מגירה וגיליון ה-Bubble
  אינם תפריטים. הרשימה המלאה: `frontend/src/styles/menu-surface.ts`; הבדיקות: `unit-menu-lint.spec.ts` (סטטית),
  `evidence-menu-opaque.spec.ts` (בדפדפן, alpha ו-blur מחושבים לכל סקין x סכמה).
- **כך גם כל לוח צף מעל המפה או התלת-ממד** (2026-10-13, הדיווח השני של הבעלים): שבב הקומה, פס המפלסים, המקרא, רצועת הקומות, כפתורי
  הקומות והמעגלים, פס בחירת המצלמות, הרשימה הצדדית, כפתורי הזום, כפתור השעה, פס התצוגות והאיכות, תמונות המפלסים, התוויות מעל הסצנה
  ופס ההליכה - צובעים `var(--sw-menu-surface)` עם מסגרת `var(--sw-border-strong)` (לא מסגרת התפריט: ב-Bubble היא בצבע המשטח עצמו, ולוח אטום על רקע המפה הבהיר נשאר בלי קצה), בלי blur. אין טוקן חדש ואין כלל סקין לזה (ל-Bubble
  נשארו 50 כללים). שורת בקרים משותפים (sw-chip, sw-button, select) בלי קופסה משלה מכוונת את `--sw-surface` למשטח הזה על המכל. טקסט על
  לוח כזה בדיו קריא בלבד (`--sw-text`, `--sw-text-2`, `--sw-accent-text`, תאום `-text` של צבע מצב) - לא `--sw-text-3` ולא צבע מצב
  חשוף כצבע טקסט; בקר מושבת מתעמעם בדיו ולא ב-`opacity` על הקופסה. הרשימה: `HUD_SURFACES` ב-`menu-surface.ts`; הבדיקות:
  `unit-menu-lint.spec.ts`, `unit-hud-opaque.spec.ts` (ניגודיות 4.5:1 לכל סקין x סכמה), `evidence-menu-opaque.spec.ts`,
  `evidence-hud-opaque-live.spec.ts`.
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


## 6. סקין Bubble ו"חוגות המראה" (יסוד Bubble, שלב B, 2026-10-02)

הסקין `bubble` (`skins/bubble.ts`, 30 כללים) הוא הראשון שנבנה במלואו, מתוך המוקאפ המאושר `docs/design/mockups/bubble-taste`
(ענף `pilot/design-bubble-taste`). ההחלטה: **כל אפשרות עיצובית פתוחה לעריכה דרך הממשק, שום דבר לא קשיח.** לכן הסקין מגדיר רק
מראה-מנוחה, ו"חוגות" (dials) משנות אותו:

| חוגה | ערכים | ברירת מחדל | מנגנון |
|---|---|---|---|
| `density` | wide / regular / compact / row | regular | `data-bubble-density` על `<html>` -> חבילת טוקנים (`--sw-pill-h`, `--sw-icon-ring`, `--sw-sub`, `--sw-fs-name`, `--sw-gap*`, `--sw-grid-min`); `row` = תצוגת רשימה |
| `surface` | flat / glass / gradient / fill | fill | `data-bubble-surface`; הרכיב (`sw-pill`) מצייר לפיו |
| `popup` | sheet / centred / inline | sheet | `data-bubble-popup`; `sw-sheet` בוחר פריסה (גיליון תחתון בטלפון / ממורכז / בתוך הדף) |
| `radius` | pill / soft / square | pill | `data-bubble-radius` -> `--sw-r-sm/md/lg/xl/pill`, `--sw-r-media` |
| `transparency` | 40..100 (%) | 72 | `--sw-sheet-alpha` על `<html>`, **לא מתחת לסף הניגודיות** שמחושב בקוד (`design/contrast.ts`) |
| `scale` | 80..130 (%) | 100 | `--sw-look-scale` |
| `touch` | 32 / 44 (px, במחשב) | 44 | `--sw-touch-desktop`; במגע תמיד 44 |
| `palette` | default | default | שמור לשלב הבא: פלטה = סט ערכים לטוקני הצבע (`--sw-hue-*`, accent, state), לעולם לא כלל |
| `material` | none / frosted / paper / neon | none | MD1 (2026-10-03): `data-bubble-material` -> חבילת המספרים של החומר (`--sw-m-sheen/shade/rim/lift/wash/blur/glow/glowa/grain/border`); ראו 6ב |
| `depth` | 0 / 1 / 2 | 0 | `data-bubble-depth` -> `--sw-m-depth` (0 / 1 / 1.8): מכפיל את הברק, ההצללה, השפה וההרמה |
| `tint` | 0 / 1 / 2 | 0 | `data-bubble-tint` -> `--sw-m-tint` (0 / 1 / 1.8): מכפיל את שטיפת הגוון של המצב, עד תקרת הניגודיות `--sw-m-wash-cap` |

- **מפתח אחד**: `ui.look` - ברירת מחדל של ההתקנה ב-`/settings` (כל החוגות חובה) ועקיפה אישית **חלקית** ב-`/me/prefs`
  (רק החוגות שהמשתמש קבע; `null` = לפי ההתקנה). אימות בשרת: `services/look.py` (ערך לא מוכר = 422); בלקוח: `design/look.ts`
  (אותן רשימות; `lookOf(dial)` הוא הפותר, `?look=density:compact,surface:glass` לתצוגה הנוכחית בלבד).
- **ממשק**: הגדרות › כללי › **מראה** (`screens/system-look.ts`): "ההעדפה שלי" (נשמר מיד, "לפי ההתקנה" לכל חוגה) ו"ברירת המחדל
  של ההתקנה" (נשמר בכפתור, `system.configure`), עם תצוגה מקדימה שמצוירת מהטוקנים של הטיוטה.
- **רכיבים משותפים**: `components/sw-sheet.ts` (החלון הקופץ: שקוף, מלכודת פוקוס, Esc, רקע, החזרת פוקוס, גרירה לסגירה בטלפון עם שורת
  אחיזה של 44px, פתיחה קפיצית, מכבד reduced-motion / reduced-transparency, נופל ל-`--sw-surface-solid` בלי backdrop-filter),
  `components/sw-pill.ts` (שורת כמוסה: טבעת-סמל, שם, מצב, תת-כפתורים שנשברים מתחת לשם, slider / toggle / plain, תווית בשני צבעים
  שנחתכת בקצה המילוי, יעדי 44px). בטלפון, בסקין Bubble בלבד, `sw-app` מצייר **פס צף + כפתור בית בשורה משלהם** (שורת grid, לא
  שכבה: תוכן לעולם לא מתחתיו); כפתור הבית פותח את בוחר האזורים.
- **בדיקות**: `tests/unit-design-tokens.spec.ts` (חוגות, חבילות, סף האלפא לכל סקין וסכמה), `tests/layout-bubble.spec.ts`
  (**שומר הפריסה**: רוחבים 320..1440 x צפיפות x משטח x סכמה + חלונות קופצים; נכשל על escape / overflow / floating / clipped /
  target), `tests/evidence-bubble-foundation.spec.ts` (צילומים ל-`docs/design/evidence/bubble-foundation/`, התנהגות הרכיבים,
  כרטיס ההגדרות מול שרת מדומה), `backend/tests/test_look.py`. דף ההדגמה: `#/styleguide/bubble`.
- **עוד לא**: פלטות ועורך צבעים (שלב D).

## 6א. שלב C - המסכים האמיתיים בסקין Bubble (2026-10-02)

כשהסקין `bubble` בתוקף, מסכי הבית, האזור והמולטימדיה משנים **מבנה**, לא רק מראה. כלל: שינוי מבנה שייך לבסיס (המסך),
לא לגיליון הסקין (תקציב 50 הכללים נשאר 30). המסך קורא את הסקין דרך `design/skin.ts`:

| כלי | תפקיד |
|---|---|
| `SkinController` | משקף את הסקין בתוקף על ה-host (`data-skin="bubble"`) ומרנדר מחדש בכל שינוי; ה-CSS של המסך מתנה על `:host([data-skin='bubble'])`, התבנית על `this.skin.bubble`. |
| `hueOf(id)` | גוון דקורטיבי יציב (1..8) לטבעת-הסמל של אזור / התקן (קישוט, לעולם לא משמעות). |
| `styles/media-glass.ts` `mirrorSkin` + `mediaBubbleKnobs` | מסכי המדיה: כל כפתורי ה-`--dv-*` / `--mm-*` מצביעים על `--sw-*` (הגשר של glass מבוטל קודם, אחרת כל זוג הוא מעגל); הסכמה היא של הסקין (`data-theme`), לא `devices.scheme`. |

**מה כל מסך מצייר ב-Bubble**

- **בית** (`devices-building.ts`, `home-widgets.ts`): ווידג'טים שטוחים (מזג אוויר על הגוון שלו, אזעקה דרוכה על ה-accent),
  פעולות מהירות כשורות `sw-pill` (הכפתור העגול שולח את אותו `home-quick`), כרטיסי הקומות = קבוצות חשופות תחת כותרת-מפריד,
  כל שורת אזור ואריח אזור = כמוסה עם טבעת גוון, שורות העץ עם טבעת קטנה. `--sw-grid-min` (חוגת הצפיפות) קובע את העמודות,
  `row` = עמודה אחת. שלושת כיווני הבית, פריסות הטלפון ועורך הפריסה לא השתנו.
- **אזור** (`devices-area.ts` + `devices-area-bubble.ts`): כל התקן = `sw-pill` (תאורה עם עמעום = כמוסת מחוון, מתג = כמוסת
  מתג, תריס = כמוסת מיקום עם מעלה / עצור / מטה ושבב "לאשר N%?", מזגן / תרמוסטט = כמוסה עם מדרגות -/+, מאוורר = כמוסת
  עוצמה, נגן = כמוסה עם נגן / השתק / כיבוי, אבטחה וחיישנים = כמוסות פשוטות, חיישני הראש = אריחי ערך); הטבעת (או לחיצה על
  כמוסה פשוטה) פותחת את **גיליון ההתקן** (`sw-sheet`: יעד גדול, שבבי מצב / מאוורר / מצב מוגדר / נדנוד, מיקום + הטיה עם
  האישור שלהם, שורת הסטטוס). מקטעים = מפרידים (סמל, שם, ספירה, הכיווץ בטלפון, כפתורי "כבה הכל"); כמוסת הראש נושאת ספירות,
  טמפרטורת החדר, האזעקה ו"כבה הכל". הפקודות הן של `devices-controls.ts` (אותם מפתחות, אותו כלל "מחווה ראשונה דורכת, לחיצה
  שנייה מאשרת" לתריסים, אותם שלבים) - שום דבר חדש לא נשלח. `readonly` על כמוסה = אין הרשאה לשליטה (מצב מוצג, אין קלט).
- **מולטימדיה** (`multimedia-players.ts`, `media-player-card.ts`, `media-now-hero.ts`): פאנל "מתנגן עכשיו" מעל עטיפה
  מטושטשת (אמנות, שם, אמן, שבבי חדר וקבוצה, פס התקדמות LTR, מקשי ניגון LTR, כמוסת עוצמה); כרטיס נגן = שורת כמוסה (טבעת
  עטיפה, שם ומצב, מקש ניגון / הפעלה, כפתור עוצמה שהופך את השורה כולה למחוון - **מורף העוצמה** - עם סגירה והמקש הראשי);
  מסכים, קבוצות, השלט והפאנל (`--mr-*`) עוקבים אחרי טוקני המוצר. הכותרת אינה דביקה ב-Bubble (שום דבר צף מעל שורות).
- **טלפון**: ה-dock ובוחר האזורים מהיסוד; גיליונות = גיליון תחתון עם גרירה לסגירה.

**בדיקות שלב C**: `tests/layout-guard.ts` (השומר המשותף), `tests/layout-bubble-screens.spec.ts` (השומר על המסכים האמיתיים:
בית כרטיסים / אריחים, אזור + שלושה גיליונות, נגנים + המורף, מסכים; `LAYOUT_QUICK=1` לארבעה רוחבים), `tests/bubble-mocks.ts`
(שרת מדומה: עץ, חדר עם כל סוגי הכרטיסים והפקדים, פעולות שמאושרות מיד), `tests/evidence-bubble-screens.spec.ts`
(צילומים ל-`docs/design/evidence/bubble-screens/` ב-390 / 820 / 1440 בהיר וכהה; התנהגות: לחיצה = פקודה אחת, מקלדת,
גיליון ופוקוס, אישור תריס, מדרגת מזגן, מצב רשימה, הסקין הקלאסי ללא שינוי).

**ביצועים**: ב-Bubble אין `backdrop-filter` על רשימות שנגללות (כרטיסי נגן, שורות אזור, כמוסות) - רק על הסרגל, העץ,
הגיליון והפאנל; `prefers-reduced-transparency` ודפדפן בלי blur מקבלים `--sw-surface-solid`.

## 6ב. שלב D - המעטפת של מסכי האבטחה, הרשימות וההגדרות (0.1.157)

מסכי האבטחה (לייב, חקירה, אזעקה), רשימות ההתקנים (קטלוג, מצלמות, תזמונים, מתגים מוגנים), רשימות קברניט (אוטומציות,
סצנות, סקריפטים) ומסכי ההגדרות שומרים על **המבנה** שלהם; וידאו, מפה, תלת-ממד, ציר הזמן והטבלאות הצפופות אינם מעוצבים
מחדש. רק המעטפת עוקבת אחרי הסקין, דרך בלוק משותף אחד:

| כלי | תפקיד |
|---|---|
| `styles/bubble-chrome.ts` (`bubbleChrome`) | כללים על `:host([data-skin='bubble'])` לפי שמות המחלקות החוזרים במסכים: פקדי מקטעים מקומיים (`.seg`, `.kseg`, `.layouts`, `.rangepick`, `.transport`, `.switcher`, `.pages`, `.range`, `.sevseg`) = מסלול כמוסה עם אגודל solid (אותה שפה של `sw-tabs` pill); קופסאות ושורות עם מסגרת (`.wrow`, `.item`, `.hcard`, `.zone`, `.card`, `.tbl`, `.list` ...) = שכבה שטוחה בלי קו (ל-`--sw-border` אין צבע ב-Bubble), מצבי שגיאה / בחירה כטבעת פנימית; קווי הפרדה (`.row`, `.ev`, `.spot`, `td` ...) נשארים נראים בצבע `--sw-border-strong` מוחלש; שדות הקלט של המסך = שדות כמוסה ביעד המגע; פסי השמירה / הפעולה הדביקים (`.bulk`, `.bar`, `.setnav`) הופכים סטטיים (שום דבר לא צף מעל שורות). |
| `SkinController` על כל מסך | 48 מסכים (כל `system-*`, `live-*`, `investigate-*`, `security-alarm`, `explore-entities`, `devices-schedules` + `schedule-table-view`, `devices-protected-switches-admin`, `devices-automations` + הפאנלים + `sw-automation-card`) משקפים את הסקין ל-`data-skin` ומצרפים את `bubbleChrome` ל-`static styles`. |
| `skins/bubble.ts` כלל 12 | מקטעי האבטחה במעטפת (`sw-app nav.sections`: לייב / חקירה / אזעקה) = מסלול כמוסה; בטלפון השורה (`secrow`, `sectabs.phone`) אינה דביקה בסקין הזה. |
| `styles/automations-glass.ts` `automationsBubble` | כרטיסי האוטומציה / סצנה / סקריפט ברדיוס הסקין (השטחה, ביטול ה-blur והקו כבר מגיעים מ-`mediaBubbleKnobs`). |

מסך שצריך יותר מוסיף כללי `:host([data-skin='bubble'])` משלו ליד ה-CSS שלו; שינוי סדר, תוכן או מצב אינו שייך לכאן.
**בדיקות**: `tests/bubble-chrome-screens.ts` (רשימת המסכים + עזרים), `tests/layout-bubble-lists.spec.ts` (שומר הפריסה על המסכים
האלה במצב הדגמה: רוחבים x צפיפות x פינות x סכמה x חוגת 32px; `LAYOUT_QUICK=1`, `LAYOUT_SCREENS=live,alarm`),
`tests/evidence-bubble-lists.spec.ts` (צילומים ל-`docs/design/evidence/bubble-lists/` ב-390 / 820 / 1440 בהיר וכהה; חוזה המקטעים
ב-Bubble מול classic; אין blur על שורות; אין מילות מותג).

## 6ג. שכבת החומר - חוגות `material`, `depth`, `tint` (MD1 שלב 2, 2026-10-03)

נבנה מהמוקאפים המאושרים `docs/design/compare/material-dials` (ענף `pilot/material-dials-mockups`), לפי החלטת הבעלים: הכול
חוץ מ-Chalk. **נוסחה אחת** (`frontend/src/styles/material.ts`): ברק (radial לבן משמאל-למעלה), הצללה (radial כהה מימין-למטה),
שטיפת גוון של המצב (135deg), גרגר (Frosted), שפת זכוכית של פיקסל (שלושה box-shadow פנימיים), הרמה (צל חיצוני), זוהר (Neon).
המספרים הם טוקנים `--sw-m-*` (`design/tokens.ts`); קדם-הגדרה (`material`) כותבת אותם (`MATERIAL_BUNDLE` ב-`design/look.ts`),
`depth` ו-`tint` מכפילים אותם. הכללים מצורפים לגיליון הסקין של Bubble ושל Domus (`css.ts skinRules`), עם תקציב משלהם (20);
Classic ו-Tesla לא מקבלים כלום.

| | Frosted | Paper | Neon | none (בסיס) |
|---|---|---|---|---|
| ברק / הצללה | .07 / .06 | .03 / .04 | .05 / .08 | 0 / 0 |
| שפה / הרמה | 1 / .45 | .5 / .22 | 1.2 / .5 | 1 / .45 |
| שטיפה (לפני tint והתקרה) | 28% | 18% | 34% | 28% |
| טשטוש כמוסת זכוכית (full בלבד) | 20px | 0 | 14px | 16px (היום) |
| זוהר | - | - | 16px | - |
| גרגר / קו דיו | גרגר | קו 10% | - | - |
| אטימות מוצעת | 62 | 96 | 56 | 72 |

- **ברירת מחדל = כבוי**: `depth 0`, `tint 0`, `material none` - כל שכבה שקופה וכל צל באלפא 0, הפיקסלים של 0.1.156 לא משתנים
  (אין מיגרציה: ערך `ui.look` ישן בלי המפתחות קורא כברירת המחדל, `services/look.py stored`).
- **מאקרו**: בחירת קדם-הגדרה בכרטיס "מראה" כותבת גם `depth 1` ו-`tint 1` (אם היו כבויים) ואת האטימות המוצעת; אחר כך
  החוגות חופשיות (`materialMacro`). הערך הנשמר הוא שם הקדם-הגדרה בלבד; `none` מנקה רק אותה.
- **מאיפה הגוון** (`--sw-m-tone`, `--sw-m-on`): `sw-pill` דולק = צבע המילוי שלו (רק על משטח זכוכית: ב-fill/flat המצב כבר הוא
  המילוי, ב-gradient שני צבעים נלחמים); אריח אזור בבית עם משהו דולק = `--sw-lit`; `sw-kpi` לפי `tone`. כבוי / לא זמין /
  סרק - לעולם לא. **המילה והנקודה נשארות**: צבע לעולם לא לבד.
- **רשימות** (`density=row`, שורות האזורים בבית): הגוון בפס צד של 6px (tint מכבה אותו), לעולם לא שטיפה על השורה; טבלאות -
  נקודה + מילה בלבד. ה-chrome (עץ, סרגל, dock, רצועת האבטחה) מקבל שפה והרמה בלבד, בלי גוון.
- **הסתייגות הצוות, ממומשת בקוד**: זוהר ה-Neon נדלק רק סביב אריח שהגוון שלו דקורטיבי (טבעת הגוון של הכמוסה, גוון האזור),
  לעולם לא סביב צבע מצב (אזעקה, דלת פתוחה, מנותק וכל שאר צבעי המצב נשארים שמורים ולא זוהרים), ולעולם לא ברשימה.
- **ניגודיות**: `--sw-m-wash-cap` מחושב בקוד לכל סקין x פלטה x סכמה (`design/contrast.ts washCap`, `apply.ts`): החלק הגבוה
  ביותר של הגוון שבו טקסט וטקסט משני נשארים ב-4.5:1 על כל גוון (מילוי, accent, הצלחה / אזהרה / סכנה, קור / חום, שמונה גווני
  הטבעות) מעל `--sw-surface` ו-`--sw-surface-solid`. השטיפה בפועל = `min(wash x tint, cap)`. בפועל (נמדד): עשר הפלטות 28-32%
  בהיר, 28% כהה (ניגודיות גבוהה 58 / 48), Bubble ברירת מחדל 38% בהיר / 22% כהה - כלומר "חזק" (50%) נחתך לתקרה; ההבדל בין
  עדין לחזק נשאר בפס הצד ובזוהר התחתון של השפה. `validate_palettes.mjs` מדפיס את התקרה לכל פלטה (`materialWashRows`).
- **ביצועים**: שום `backdrop-filter` חדש. טשטוש כמוסת הזכוכית ב-full עוקב אחרי הקדם-הגדרה (`--sw-m-blur`), ב-lite
  (`--sw-perf-blur: none`) אין טשטוש על אריח בשום קדם-הגדרה; ה-chrome שומר על `--sw-glass-blur-nav`. הזוהר הוא צל, לא תיבה:
  שומר הפריסה מודד תיבות, "שום דבר לא צף" נשמר.
- **כיוון**: אור הברק פיזי (שמאל-למעלה) בשני כיווני הטקסט - קישוט, לא גיאומטריה, ולכן לא משתקף.
- **איך מפעילים**: הגדרות › כללי › מראה › חומר (Frosted / Paper / Neon), או עומק + גוון מצב בלי קדם-הגדרה; לכל ההתקנה
  ("ברירת המחדל של ההתקנה", `system.configure`) או לעצמי ("ההעדפה שלי"). לבדיקה: `?look=material:frosted,depth:1,tint:1`.
- **בדיקות**: `tests/unit-design-tokens.spec.ts` (חוגות, חבילות, תקציב, תקרת השטיפה לכל סקין ופלטה), `tests/unit-palettes.spec.ts`
  (הסכמה בין האפליקציה ל-`validate_palettes.mjs`), `tests/evidence-material-dials.spec.ts` (צילומים ל-`docs/design/evidence/material-dials/`,
  המספרים על `<html>`, "כבוי = בלתי נראה", Neon בלי זוהר על מצב וברשימה, lite בלי טשטוש, המאקרו בכרטיס),
  `tests/layout-material.spec.ts` (שומר הפריסה: קדם-הגדרות x עומק/גוון חזק x סכמה x רוחב x שכבת ביצועים, ועשר הפלטות),
  `backend/tests/test_look.py`.

## 6ד. BV1 - וריאנטים נוספים: אריחים, יומן, משגר, מחוונים אנכיים, בלי משטח (2026-10-05)

מסמך התכנון והרשומה: `docs/design/BV1_BUBBLE_TILES.md`. בקצרה:

| פריט | איפה | מנגנון |
|---|---|---|
| אריחי שעון / מזג אוויר | `home.widgets` -> `clock.style` / `weather.style` = `card` \| `tile` | `screens/home-widgets-bv1.ts` מצייר אריח כשהסקין Bubble; שאר הסקינים מתעלמים (כרטיס) |
| יומן (`agenda`) | ווידג'ט חדש: `calendars` (עד 6 ישויות `calendar.*`), `days` (1/3/7/14) | השרת קורא את האירוע הבא של כל יומן מהקטלוג המשוקף (`message`, `start_time`, `end_time`, `all_day`, `location`; לעולם לא `description`), ממיין ומגיש ב-`home.data.agenda` |
| משגר מהיר (`launcher`) | ווידג'ט חדש: `items` (עד 12: מסך / סצנה / סקריפט / פעולה מהירה) | `api/launcher.ts`: טבלת המסכים וההרשאה של כל אחד; סצנה / סקריפט דרך אותן בקשות של מסך האוטומציות; פעולה מהירה דרך דיאלוג הפעולות של המסך |
| מחוונים אנכיים | חוגה `slider` = `horizontal` \| `vertical` | `components/sw-vslider.ts` (מחוון גבוה, המילוי מלמטה); `screens/bubble-sliders.ts` בוחר בגיליון ההתקן לפי החוגה |
| בלי משטח | ערך `surface` = `none` | `sw-pill`, `sw-vslider` והווידג'טים: בלי מילוי, טבעת וטקסט בלבד, העוצמה בפס של 4px, קו דק בין שורות |

הרשאות: הגדרת הווידג'טים = `system.configure`; הפעלה / כיבוי וגודל אישיים = `screen.personalize` (`home.personal`, בלי שינוי); החוגות = `ui.look`
(ברירת מחדל של ההתקנה + העדפה אישית). **בדיקות**: `tests/unit-bv1-tiles.spec.ts`, `tests/layout-bv1-tiles.spec.ts` (שומר הפריסה בארבעת
הסקינים x 10 רוחבים + הגיליון עם המחוונים האנכיים), `tests/evidence-bv1-tiles.spec.ts` (צילומים ל-`docs/design/evidence/bv1-tiles/`),
`backend/tests/test_bv1_tiles.py`. לא נבנה: מחוונים אנכיים ברשת האזור (שובר את רשת הכמוסות; דורש החלטה על מצב "אריחים גבוהים").

## 6ה. DU1 - איחוד העיצוב ברמת הטוקנים (2026-10-09)

ענף `pilot/DU1-design-unification`; הרשומה המלאה (ביקורת מסך-מסך, החלטות, ראיות) ב-`docs/design/DU1_DESIGN_UNIFICATION.md`.
מה שסקין צריך לדעת מאז:

- **סולם הטיפוגרפיה** הוא הטוקנים בלבד: `--sw-fs-2xs` (10) · `xs` · `sm` · **`base` (13, חדש)** · `md` · `lg` · `xl` · `2xl` · `3xl`. אף מסך לא כותב
  `font-size` בפיקסלים (הבדיקה `tests/unit-token-lint.spec.ts` נכשלת על כך). סקין שמשנה את הסולם מגדיר את כל המדרגות, כולל `2xs` ו-`base`.
- **סולם הרדיוסים**: `--sw-r-2xs` (4) · `xs` (6) · `sm` · `md` · `lg` · `xl` · **`2xl` (22, חדש)** · `pill`. גם כאן אין ערכי פיקסל במסכים (4-24px);
  חבילות חוגת ה-`radius` של Bubble נושאות את המדרגות החדשות.
- **מצבי פקדים** (קבוצת `control`): גובה פקד `--sw-ctl-h-sm/md/lg`, `--sw-disabled-opacity` (דהייה אחת לכפתור, צ'יפ ומתג), `--sw-hover-wash`,
  `--sw-pressed-wash`, `--sw-focus-w` / `--sw-focus-offset` (טבעת פוקוס אחת לכל הרכיבים), `--sw-skeleton`, `--sw-shadow-primary`, `--sw-toggle-thumb`.
- **טוסט / משטח הפוך**: `--sw-toast-bg` / `-text` / `-action` (הדפוס `background: var(--sw-text); color: #fff` היה בהיר-על-בהיר בכהה).
- **מעל וידאו** (קבוצת `video`, זהה בשני הסכמים): `--sw-on-video(-2)`, `--sw-video-scrim(-strong)`, `--sw-video-line`, `--sw-video-hover`,
  `--sw-on-image-bg`. טקסט לבן על וידאו אינו `--sw-text-inverse` (שב-Domus כהה הוא כהה).
- **משטחי הזכוכית עוקבים אחרי סכמת המוצר**: `data-devices-scheme` נפתר לכהה גם כשה-`ui.scheme` כהה (`screens/devices-style.ts`), כך
  שמסכי התזמונים, האוטומציות, המולטימדיה וההתראות לעולם אינם בהירים מהמעטפת סביבם.
- **פלטת ברירת המחדל של הזכוכית קוראת את צבעי המוצר**: `--dv-accent`, `--dv-focus`, `--dv-toggle-on` וצבעי המצב של הפלטה `default` הם
  `var(--sw-product-*)` (כינויים שלעולם לא עוברים גשר, קבוצת `product` ב-`tokens.ts`). סקין שמשנה את ה-accent או את `--sw-toggle-on`
  משנה אותם גם במסכי הזכוכית. הפלטות sand / forest / graphite והשלט (`--mr-*`) שומרות על ערכיהן.

## 6ו. CRY - סקין Crystal ואפשרות הרקע (2026-10-10)

ענף `pilot/CRY-crystal-skin`; הרשומה המלאה ב-`docs/design/CRY_CRYSTAL_SKIN.md`. הסקין `crystal` (`skins/crystal.ts`, 27 כללים) הוא
זכוכית מוארת עם שפה זוהרת על קנבס פנינה (בהיר) / אינדיגו (כהה). חדש לכל סקין:

- **טוקן `--sw-bg-image`** (בסיס: `none`): כתובת תמונת הרקע, נכתב inline על `<html>` על ידי `design/background.ts` לפי ההגדרה
  `ui.background` (מובנה יום/לילה לפי הסכמה | ללא | תמונות של ההתקנה) והעדפת המשתמש (`/me/prefs`). סקין שרוצה להציג את הרקע מצייר
  אותו בכלל הקנבס שלו (`:host(sw-app) { background: linear-gradient(var(--sw-bg-veil), var(--sw-bg-veil)), var(--sw-bg-image) center / cover no-repeat, var(--sw-canvas); }`)
  ומגדיר `--sw-bg-veil` (הצעיף שמרכך כל תמונה כדי שטקסט על הקנבס יישאר קריא). סקין שלא מצייר אותו - התמונה לא מופיעה.
- **שני ציורים מקוריים** (`frontend/src/design/backgrounds/*.svg`, נוצרים ב-`scripts/crystal-backgrounds.mjs`, מיוצאים ל-WebP
  ב-`public/backgrounds/`, כל אחד ~22 KB). בלי צילומים ובלי נכסים של צד שלישי.
- **העלאת תמונות**: `POST/DELETE/GET /settings/background/{day|night}` (`system.configure`, ביקורת `settings.update`, גיבוי).
- **בדיקות**: `tests/unit-crystal-background.spec.ts`, `tests/evidence-cry.spec.ts` (צילומים ל-`docs/design/evidence/cry/`),
  `backend/tests/test_ui_background.py`.

## 7. מה עוד לא כלול (עבודה לפי מסך)

היסוד מכסה טוקנים, מעטפת, רכיבים משותפים ועץ הבניין; שלב C את הבית, האזור והמולטימדיה; שלב D את המעטפת של האבטחה,
הרשימות וההגדרות (6ב). מה שנשאר עם צבעים קשיחים משלו (מפה ו-3D, וידאו, ציר הזמן, הטבלאות הצפופות) מקבל כהה רק דרך
טוקני הקנבס, ויעבור למבנה החדש מסך אחר מסך אם יוחלט. משפחת `--dv-*` של מסכי החשמל והתקנים (סגנון glass) נשארת כפי שהיא ומגשרת על `--sw-*` בתוך
המסכים האלה; ב-Bubble הגשר מבוטל ברכיבי המדיה בלבד (ראו 6א). עוד לא ב-Bubble: תפריט הסצנות של האזור (אין ל-API של האזור
רשימת סצנות - המוקאפ הציג אותו עם נתוני דמה), פלטות.
