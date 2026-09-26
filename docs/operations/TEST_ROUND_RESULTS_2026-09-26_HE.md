# סבב אימות עצמי של טופס הבעלים — 26.9.2026 (גרסה 0.1.89, סבב 9)

מטרה: לבקשת הבעלים — לעבור על 71 הסעיפים של טופס הבדיקות (סבב 8), לאמת בעצמי כל מה שאפשר לאמת בלי הבעלים, לתקן
את מה שנשבר, ולהשאיר לבעלים רק את מה שדורש את ההתקנה שלו, את העין שלו, את הטלפון שלו או את הבניין שלו. המסמך הזה
הוא הרישום המלא: ה־sweep החי, המיפוי סעיף ← בדיקה ← תוצאה, הכיסוי שנכתב בסבב, מה נמצא ומה תוקן. הסבב הקודם:
`TEST_ROUND_RESULTS_2026-09-24_HE.md`.

## תנאי הסביבה בזמן הסבב

- קוד: הענף `pilot/round9-self-verification` מ־`g0/intake` במיזוג 0.1.89 (81e6b24). ה־`www` נבנה מחדש (`build:addon`)
  וזהה ל־HEAD; ה־`dist` לתצוגה המקדימה (4173) נבנה מאותו מקור.
- **ה־NVR וה־HA של הבעלים לא היו נגישים מהתחנה** (ConnectTimeout על ISAPI, TimeoutError על ה־WebSocket של HA — כמו
  ב־22.9 וב־24.9). כל מה שדורש מכשיר חי מסומן BLOCKED — לא "עבר" ולא "נכשל". אף בקשה לא נשלחה ל־HA או ל־NVR מעבר
  למה שהבדיקות הקיימות כבר עושות; כל פעולה על ישות נענתה בדפדפן (`page.route`).
- בסיס הנתונים של הפיתוח לא קיבל אירועים חדשים (אין NVR), ולכן עמוד אירוע נבדק על **מופע זמני נפרד** (backend על
  8098 עם ספריית נתונים משלו בספריית הזמניים של הסשן, בלי NVR/HA, תצוגה מקדימה על 4178). אירוע סינתטי אחד נכתב לבסיס
  הנתונים של המופע הזה בלבד. המופע וספריית הנתונים שלו נמחקו בסוף.
- כל בדיקה חדשה בונה אתר / מבנה / קומה משלה ומוחקת אותם בסוף; ההגדרה `plan.estimates` מוחזרת, שיוך הצופה המדומה מבוטל.

## 1. ה־sweep החי (בסיס, לפני שנכתב כיסוי חדש)

כל 65 קובצי ה־`evidence-*.spec.ts`, Chrome אמיתי, worker אחד, בשבע מנות של עד עשרה קבצים (`dev_cleanup.ps1` אחרי כל שתי מנות):

| מנה | קבצים | בדיקות | עברו | נכשלו | דילוג | זמן |
|---|---|---|---|---|---|---|
| 1 | access … dxf | 10 | 6 | 4 (bundle, capabilities, cases, correlation) | — | 1:59 |
| 2 | editor-move … health | 16 | 8 | 8 (event-detail, event-windows, events-hover, events, frames, ha-history, ha ×2) | — | 3:38 |
| 3 | history-map … nvr-motion | 12 | 9 | 2 (history-map, nvr-motion) | 1 (mobile — פרויקט טלפון בלבד) | 1:24 |
| 4 | nvr-notify … owner-round6 | 22 | 17 | 5 (nvr-notify, nvr-record, owner-round11 #1, owner-round2 #2, owner-round5 #4) | — | 4:33 |
| 5 | owner-round7 … route (כולל ארבעת מפרטי הסטודיו) | 41 | 35 | 5 (owner-round8 ×2, owner-round9, review-fixes #1, route) | 1 (studio-4 עמוד אירוע — אין אירוע) | 4:32 |
| 6 | rules … sync | 10 | 5 | 5 (rules, spatial-search, speeds, storage, sync) | — | 1:26 |
| 7 | video … zones | 12 | 5 | 7 (video ×6, zones-nvr) | — | 4:14 |
| **סה״כ** | **65** | **123** | **85** | **36 — כולן BLOCKED** | **2** | **21:46** |

**סיווג 36 הכישלונות** — אותה קבוצה בדיוק כמו ב־24.9 (36), אף אחת חדשה:

| קבוצה | כמה | בדיקות | על מה נעצרו |
|---|---|---|---|
| BLOCKED — אין אירועים טריים | 14 | cases, correlation, event-detail, event-windows, events, events-hover, history-map, route, rules, spatial-search, speeds, owner-round2, owner-round5, review-fixes | "an event with a camera…", "windows in the last 24 h", `toBeGreaterThan(0)` על ספירת אירועים |
| BLOCKED — NVR / go2rtc | 19 | capabilities, frames, bundle, nvr-motion, nvr-notify, nvr-record, owner-round8 ×2, owner-round9, owner-round11, storage, zones-nvr, sync, video ×6 | `source_unavailable · ConnectTimeout`, `can_write` חסר, "a camera with a recording today" |
| BLOCKED — HA מחובר | 3 | ha ×2, ha-history | `sync.connected=false` (TimeoutError) |
| בדיקות שהתיישנו | **0** | — | — |
| תקלות במוצר | **0** | — | — |

**הרצה חוזרת של 7 המפרטים התלויים ב־NVR/HA** (capabilities, nvr-motion, nvr-notify, storage, zones-nvr, ha, ha-history — 9 בדיקות):
8 נכשלו שוב על שורת התנאי המקדים בלבד (`caps.read_only` חסר כי התשובה היא 503 `source_unavailable`, `status.channels`
חסר, `d.nvr.error = "source_unavailable · ConnectTimeout"`, `sync.connected=false`), 1 עבר (לשונית הגשר בהגדרות) —
כלומר תנאי מקדים, לא רגרסיה.

## 2. שאר האימות

| חבילה | תוצאה |
|---|---|
| Backend (`pytest`, כל החבילה, בלי ‎-q) | ✔ 370 עברו (6:54 דק׳, 2 אזהרות ידועות) — כולל 2 הבדיקות החדשות של הסבב |
| TypeScript (`tsc --noEmit`) | ✔ נקי |
| בדיקות יחידה ב־node (`unit-*.spec.ts`) | ✔ 87: 85 מול השרת, ו־2 קובצי ה"קומת הדגמה" (5 בדיקות) במצב הדגמה (השרת עצור) — הם דורשים מצב הדגמה, כמו שרשרת ה־fixtures |
| `npm run build` | ✔ |
| שרשרת ה־fixtures (דמו, RTL, 1440/1024/390) | ✔ 129 עברו; `docs/evidence/T007` הוחזר ל־HEAD |
| הרצה חיה אחרונה של כל מפרט ששונה או נוסף + מפרטי הסטודיו 1–4 | ✔ 39 עברו, 2 דילוגים מכוונים (שחזור replace — מופע זמני בלבד; עמוד אירוע ב־studio-4 — אין אירוע) (7:59 דק׳) |
| על המופע הזמני (8098/4178) | ✔ `evidence-event-structure` (1) · ✔ שחזור merge ו־replace של `evidence-backup` (2). בדיקת הגיבוי המקורית נכשלת שם על התנאי המקדים שלה (התקנה ריקה, אין קומה עם תוכנית) — צפוי |

## 3. המיפוי: סעיף ← בדיקה ← תוצאה

קיצורים: S1–S4 = `evidence-plan-studio(-2/-3/-4).spec.ts`, EM = `evidence-editor-move`, F9 = `evidence-form-round9` (חדש),
BK = `evidence-backup`, CR = `evidence-crop`, EV = `evidence-event-structure` (חדש, מופע זמני), ZV = `evidence-zone-vertices`,
be = בדיקת backend. "✔" = עבר בהרצה של הסבב (sweep הבסיס ו/או ההרצה האחרונה); "חדש" = נכתב בסבב הזה.

| # | מה הטופס מבקש | הבדיקה שמוכיחה | תוצאה |
|---|---|---|---|
| 2 | כיול בשתי נקודות; "קנה המידה נשמר"; שום סיכה לא זזה | S1 › calibrate with two points…; be `test_calibration_leaves_walls_openings_pins_and_the_published_document_unchanged` | ✔ |
| 3 | מדידה במטרים בלי ≈; שטח והיקף מ־3 נקודות | S1 › calibrate… (מטרים); F9 › structure tools (שטח/היקף — חדש) | ✔ |
| 4 | קיר בלחיצות + Enter; Shift מבטל הצמדה; "הטיוטה נשמרה" | S1 › draw a wall…; F9 › structure tools (Shift, הטקסט "הטיוטה נשמרה" — חדש) | ✔ |
| 5 | דלת/חלון/מעבר חותכים קיר; כיוון פתיחה וציר | S1 › draw a wall… (דלת); F9 › structure tools (חלון, מעבר, כיוון וציר — חדש) | ✔ |
| 6 | תווית מוצגת על המפה | F9 › structure tools (בעורך) ו־F9 › published (במפה החיה) — חדש | ✔ |
| 7 | בחירה, גרירת פינה, Delete על פינה, Ctrl+Z | S1 › draw a wall… (גרירת פינה, מחיקת קיר, Ctrl+Z); F9 › structure tools (Delete על פינה + Ctrl+Z — חדש); EM › select tool: a click selects a wall… | ✔ |
| 7א | גרירת דלת במצב "דלת"; חצים 1 ס"מ, Shift 10 | S1 › in door mode… (+ Shift+חץ שמאלה = 10 ס"מ לכיוון החץ — חדש) | ✔ |
| 7ב | שדה "מרחק מתחילת הקיר" + Enter; לחיצה במפה ואז חץ | S1 › in door mode… (7.50 + Enter; לחיצה על הדלת ואז חץ מזיז את הדלת) | ✔ |
| 8 | "פרסום המבנה" עם תצוגה מקדימה; הכפתור נעלם | S1 › publish the structure through its preview… | ✔ |
| 9 | קירות ופתחים במפה החיה; שכבה "מבנה"; הבחירה נשמרת לקומה | S1 › a published structure shows… (מתג השכבה); F9 › published (נשמר לקומה אחרי טעינה מחדש — חדש) | ✔ |
| 10 | היסטוריה לפני הפרסום בלי המבנה, אחרי — איתו | S1 › a published structure shows… (אחרי; לפני — חדש); be `test_the_historical_map_gets_the_structure_of_its_instant` | ✔ |
| 11 | המבנה מוצג במפה של עמוד אירוע | EV (חדש, מופע זמני עם אירוע סינתטי) — קירות, דלת, כיסא, מצלמה | ✔ (ראו ממצא 5.2) |
| 13 | ייצוא SVG / PNG / JSON מהפאנל; ה־SVG נפתח בדפדפן | F9 › published (SVG תקין כ־XML, PNG, הורדת JSON — חדש); be `test_export_routes_serve_the_published_structure` | ✔ |
| 14 | צופה רואה רק את המבנה המפורסם | F9 › a viewer sees… (צופה מדומה משויך לקומה — חדש); be `test_draft_round_trip_and_what_viewers_see` | ✔ |
| 15 | גיבוי ושחזור — המבנה חוזר כפי שהיה | be `test_backup_roundtrip_keeps_the_structure_…` (חדש, replace להתקנה נקייה, hash זהה); BK › merge restore… (חדש, שרת הפיתוח); BK › replace restore… (חדש, מופע זמני: קומה שנמחקה חוזרת שלמה) | ✔ + תיקון (5.1) |
| 16 | "מידות לפני כיול" ← "מוסתרות עד כיול" ← "לא מכויל"; חזרה ל־≈ | F9 › the setting "מידות לפני כיול"… (דרך מסך ההגדרות — חדש); S1 › calibrate… (≈ לפני כיול) | ✔ |
| 19 | ייבוא מחדש של שרטוט שפורסם בחיתוך אחר | CR › a published drawing imported again in another crop… (חדש: `transformed`, הקיר שמחוץ לחיתוך נחתך, מפה 200×200 עם הקיר) | ✔ |
| 21 | חיפוש בעברית ובאנגלית, צ'יפים, "לאחרונה", "מועדפים" | F9 › library (כיסא/chair/מטף, צ'יפ "בטיחות", מועדף אחרי טעינה — חדש); S2 › the library places a chair… ("לאחרונה") | ✔ |
| 22 | הצבה בלחיצה ובגרירה מהפאנל | S2 › the library places a chair… (לחיצה); F9 › library (גרירה מהפאנל — חדש) | ✔ |
| 23 | גרירה, סיבוב, מתיחה (Shift), Alt+גרירה, חצים, Ctrl+Z | S2 › the library places a chair… (גרירה, סיבוב, מתיחה, Alt, Ctrl+Z/Y); F9 › library (Shift שומר יחס, חצים 1/10 ס"מ — חדש) | ✔ |
| 24 | רוחב/עומק/גובה ותווית מהפאנל | F9 › library (שדות המידה, התווית על המפה — חדש); S2 › acceptance (תווית בחיפוש) | ✔ |
| 25 | "הצמד לישות"; הגוף זז עם הישות וזוהר כשהאור דולק | S2 › the library places a chair… (הצעה ואישור); be `test_a_bound_object_follows_its_anchor_on_save_and_publish…`; S4 › live map: the 3D… (הגוף זוהר כשהמנורה נדלקת) | ✔ |
| 26 | עצמים בכל מפה; שכבות; היסטוריה לפני/אחרי; עמוד אירוע | S2 › published objects and connectors… (+ היסטוריה לפני/אחרי — חדש); EV (עמוד אירוע — חדש) | ✔ |
| 27 | הייצוא מכיל את העצמים | S2 › published objects… (SVG); be `test_png_draws_footprints`, `test_svg_draws_objects_connectors_and_honours_layers` | ✔ |
| 29 | צופה רואה עצמים מפורסמים, בלי ספרייה ובלי טיוטה | F9 › a viewer sees… (חדש) | ✔ |
| 30 | מערך 6×10; גרירה מזיזה הכול; Ctrl+Z בצעד אחד | S2 › sixty chairs… (+ Ctrl+Z/Ctrl+Y של כל המערך — חדש) | ✔ |
| 31 | מחיקת מערך: חלון בדף, "מחק הכול" / "השאר" | S2 › sixty chairs… ("השאר"); F9 › library ("מחק הכול" — חדש) | ✔ |
| 32 | "צור פריט מזה"; בספרייה ובחיפוש; אפשר להציב | S2 › sixty chairs… (יצירה, חיפוש); F9 › library (הצבה — חדש) | ✔ |
| 33 | ייצוא וייבוא של הספרייה המותאמת | S2 › sixty chairs… ("0 יובאו, N הוחלפו") | ✔ |
| 34 | "הוסף מפלס"; סינון לפי מפלס; מחברים תמיד | S2 › a third level is added… | ✔ |
| 35 | טריבונה ← מחבר עם "↓ −1.2 מ׳"; לא נמחק לבד | S2 › a third level…; be `test_derived_connector_disappears_when_its_object_is_deleted` | ✔ |
| 36 | מדרגות בשתי לחיצות, "למפלס", "קשר לקומה" | S2 › stairs are drawn…; be `test_stairs_linked_to_another_floor_exist_in_both_drafts_under_one_id` | ✔ |
| 37 | מעגל תאורה עם מפסק; צירוף מנורות; W; מנורה במעגל אחד | S2 › eight lamps on two circuits… (החלק של העורך) | ✔ |
| 38 | (חצי המפה) מנורות זוהרות; כפתור ההפעלה דרך מסלול הפעולות | S2 › eight lamps… (הזוהר בדחיפה; הלחיצה נענית ב־`page.route`); be `test_the_toggle_uses_the_existing_entity_action_route_and_its_permission` | ✔ (החצי של HA — לבעלים) |
| 39 | Ctrl+K "מטף" ← הקומה ממוקדת על העצם | S2 › acceptance… | ✔ |
| 41 | כיסא בתוך טריבונה נבחר ונגרר | S2 › on a phone › viewing, placing and moving… | ✔ |
| 42 | מסנן מפלס סוגר פאנל של עצם מוסתר; שדה המפלס מעביר את המסנן | F9 › library (חדש) | ✔ |
| 44 | פאנל "זיהוי אוטומטי": קירות, פתחים, עוצמת ניקוי, כפתור | S3 › a bad scan… (חדש) | ✔ |
| 45 | הכפתור ננעל עם מונה שניות; מועמדים ו"N קירות · M פתחים" | S3 › a bad scan… (נעילה ומונה — חדש); S3 › detect candidates… (סיכום) | ✔ |
| 46 | ריחוף "ביטחון"; לחיצה מסמנת/מבטלת; דחיית קיר דוחה פתחים | S3 › detect candidates… (ריחוף, רשימה); S3 › a bad scan… (לחיצה על מועמד במפה — חדש) | ✔ |
| 47 | "קבל מעל 0.8", "רק קירות", "קבל הכול", "דחה הכול" | S3 › detect candidates… (0.8, הכול); S3 › a bad scan… ("רק קירות", "דחה הכול", המונה — חדש) | ✔ |
| 48 | גרירת קצה של קיר מועמד לפני אישור | S3 › a bad scan… (הקצה נשלח כעריכה והטיוטה מחזיקה את הקיר הערוך — חדש); S3 › phone (בטלפון אין ידיות) | ✔ |
| 49 | "אשר"; ספירת אוטומטיים; תג "זוהה אוטומטית"; Ctrl+Z | S3 › detect candidates… | ✔ |
| 50 | צופה לא רואה קירות שזוהו לפני פרסום | S3 › detect candidates… (אין מבנה מפורסם, 404); F9 › a viewer sees… (טיוטה לא נראית לצופה) | ✔ |
| 51 | "השתמש בהערכה" ← ≈; כיול בשתי נקודות מחליף אותו | S3 › the door-width hint…; be `test_an_estimate_never_replaces_a_measured_calibration_silently` | ✔ |
| 52 | "החלף אוטומטיים קודמים" מפרט מה יוסר; קירות נעולים נשארים | S3 › refusals… (7 קירות · 7 פתחים); be `test_replace_auto_keeps_locked_walls_counts_manual_openings_and_handles_imported` | ✔ |
| 53 | DXF: מיפוי שכבות ובלוקים; בלוק דלת "לא עצם" | S3 › DXF… | ✔ |
| 54 | "ייבא כמועמדים", "המשך לעורך", "אשר", "ייבא חדרים כאזורים" | S3 › DXF… (+ החדר נוסף כאזור — חדש) | ✔ |
| 55 | סריקה גרועה: עדיין מציע קירות; דחייה בלחיצה; עד דקה | S3 › a bad scan (the tilted, noisy fixture)… (חדש: 7 קירות, 7 פתחים, 1.6–2.7 שנ׳ בשרת) | ✔ |
| 58 | "בחירה וגרירה": לחיצה בוחרת, גרירת גוף, Shift, חצים, Esc | EM › select tool: a click selects a wall… | ✔ |
| 59 | עצם קטן בזום רחוק; עצם גדול לא מסתיר קטן | EM › select tool: a 0.4 m object…; S2 › on a phone (כיסא על טריבונה) | ✔ |
| 60 | חדר: פינה, נקודת אמצע, גוף, פינה + Delete, שורת ההסבר | EM › select tool: a click on a zone…; ZV › drag a corner, insert one, remove one | ✔ |
| 61 | Delete על קיר ואז Ctrl+Z; גרירת סיכה ו־Delete מציע את הסיכה | EM › select tool: a click selects a wall… (Delete + Ctrl+Z בשרשרת); EM › select tool: after a wall is selected, dragging a pin… | ✔ |
| 66 | קובץ ה־glTF | S4 › glTF export… (+ Khronos glTF validator: 0 שגיאות, 0 אזהרות, `EXT_mesh_gpu_instancing` נדרש כצפוי — חדש) | ✔ |
| 20 (מכניקה) | טלפון: עורך עם כלי המבנה ומפת הקומה | S3 › phone (390, בלי גלילה הצידה, הפאנל מתחת לתוכנית); S2 › on a phone (ציור קיר "בדסקטופ בלבד"); S4 › phone | ✔ (ראו 5.3) |
| 28 (מכניקה) | טלפון: ספרייה ← הצבה והזזה | S2 › on a phone | ✔ |
| 40 (מכניקה) | טלפון: "מערך" מושבת עם "בטלפון"; הצבה והזזה | S2 › on a phone | ✔ (הפער הידוע של הגלילה נשאר) |
| 62 (מכניקה) | טלפון: נגיעה בוחרת וגוררת; אצבע על פריט לא נבחר מזיזה את המפה | EM › on a phone › a wall and a small object… | ✔ |
| 63 (מכניקה) | 3D: טעינה לפי דרישה, סנכרון, שכבות, מפלסים, מצבים חיים, ≥20 fps | S4 › live map ×2, 2D coverage, history map, building page, embed, without WebGL, anchor panel, performance | ✔ |
| 64 (מכניקה) | טלפון: "3D" בשורת הכלים, בלי גלילה הצידה | S4 › phone… | ✔ |

## 4. כיסוי חדש שנכתב בסבב

| קובץ | מה נוסף | סעיפים |
|---|---|---|
| `smplwise_vms/backend/tests/test_backup.py` | סבב גיבוי ← שחזור replace להתקנה נקייה: מבנה מפורסם + טיוטה חדשה יותר + עצם + פריט מותאם + אזור + עוגן; ה־hash של שני המסמכים, ה־revision, העוגן והאזור זהים. וידוא שהבדיקה "נושכת": בלי `plan_geometry` בגיבוי היא נכשלת | 15 |
| `frontend/tests/evidence-backup.spec.ts` | שחזור merge בשרת הפיתוח (טיוטת גרסה עם המבנה שלה ופריט מותאם שנמחקו חוזרים עם אותו hash); שחזור replace על מופע זמני בלבד (קומה שנמחקה חוזרת שלמה והמפה מציירת אותה) | 15 |
| `frontend/tests/evidence-crop.spec.ts` | ייבוא מחדש של שרטוט שפורסם בחיתוך אחר דרך האשף | 19 |
| `frontend/tests/evidence-plan-studio.spec.ts` | היסטוריה לפני פרסום המבנה; Shift+חץ | 10, 7א |
| `frontend/tests/evidence-plan-studio-2.spec.ts` | היסטוריה לפני/אחרי פרסום העצמים; המערך כצעד ביטול אחד | 26, 30 |
| `frontend/tests/evidence-plan-studio-3.spec.ts` | בדיקה חדשה על ה־fixture הרועש (`noisy.png`); חדרים כאזורים ב־DXF | 44, 45, 46, 47, 48, 54, 55 |
| `frontend/tests/evidence-plan-studio-4.spec.ts` + `gltf-validator` (devDependency, JS טהור) | אימות קובץ ה־glTF ב־Khronos validator | 66 |
| `frontend/tests/evidence-form-round9.spec.ts` (חדש, 5 בדיקות) | כלי המבנה; הגדרת "מידות לפני כיול"; תווית, שכבה שנשמרת וייצוא; מה צופה רואה; פאנל הספרייה | 3–7, 9, 13, 14, 16, 21–24, 29, 31, 32, 42, 50 |
| `frontend/tests/evidence-event-structure.spec.ts` (חדש, מופע זמני בלבד) | כרטיס המפה בעמוד אירוע, ה־3D ממצלמת האירוע, "המשך חקירה במפה" עם המבנה של אותו רגע | 11, 26 (ומכניקה של 17 ו־68) |

## 5. מה נמצא

### 5.1 תוקן — שחזור מגיבוי דיווח שורות שלא נכתבו (סעיף 15)

שחזור במצב **מיזוג** (INSERT OR IGNORE) ספר כל שורה בארכיון, גם כשלא נכתבה: מעל פרויקט שלא השתנה הוא ענה — והמסך הציג —
"שוחזר … 12 קומות …" בלי להוסיף דבר, ואחרי מחיקת קומה טען שהקומות שוחזרו בעוד שהקומה לא חזרה. עכשיו נספרות רק השורות
שנכתבו בפועל (rowcount): מיזוג מעל פרויקט שלא השתנה מדווח אפסים, פריט מותאם שנמחק חוזר כשורה אחת, והחלפה ממשיכה לדווח
כל שורה. בדיקה נכשלת קודם (`test_a_merge_restore_counts_only_the_rows_it_added`), התיקון, והבדיקה ירוקה. commit 459f882.
זה שינוי בקוד השרת: בניית `www` ושחרור 0.1.90 הם שלב השחרור, לא חלק מהסבב.

### 5.2 ממצאים שלא שונו — ממתינים להחלטתך

1. **מיזוג לא מחזיר קומה, אזור או עוגן שנמחקו.** קומות, עוגנים ואזורים נמחקים "רכות" (שורת מצבה נשארת), ומיזוג מוסיף
   רק שורות שחסרות — אז שחזור במיזוג אחרי מחיקת קומה לא מחזיר אותה (עכשיו גם לא טוען שהחזיר). שחזור **החלפה** — ברירת
   המחדל בחלון — מחזיר הכול, ונבדק גם דרך השרת החי על המופע הזמני. להחזיר רשומות מחוקות במיזוג זו החלטת תכנון (גרסת
   תוכנית שהועברה לארכיון בפרסום רגיל לא אמורה "לחזור לחיים"), ולכן לא שיניתי.
2. **כרטיס המפה בעמוד אירוע מציג את הקומה כפי שהיא עכשיו** — המבנה הנוכחי, כמו המיקום הנוכחי של המצלמה. בבדיקה פורסם קיר
   נוסף אחרי האירוע, והוא מופיע בכרטיס; "המשך חקירה במפה" פותח את המפה ההיסטורית ברגע האירוע עם המבנה שהיה בתוקף אז
   (בלי הקיר המאוחר). סעיף 11 ("המבנה מוצג במפה של האירוע") מתקיים; אם הכרטיס עצמו צריך להציג את המבנה של רגע האירוע —
   זו החלטה (היא משנה גם את העוגנים שהכרטיס מציג).

### 5.3 הערות לטופס (לא תקלות)

- סעיף 20 מצפה ש"אפשר לצייר" בטלפון; מאז 0.1.85 ציור קיר בטלפון מוצג בכוונה כ"בדסקטופ בלבד" (הבדיקה מאשרת את ההודעה).
  בחירה, הזזה והצבה של עצם בודד עובדות בטלפון.
- סעיף 40 — הפער הידוע (אחרי בחירת פריט התוכנית נגללת מהמסך בטלפון) עדיין קיים; הבדיקה גוללת את התוכנית חזרה בעצמה.
- בזמן כתיבת הכיסוי החדש נכשלו כמה ניסיונות על טעויות שלי בבדיקה (שם בעברית של שולחן, שמירת טופס ההגדרות בכפתור
  "שמור", מסנן המפלס עוקב רק כשמסנן מפלס פעיל, נקודת לחיצה על צומת T במועמדים, קצה קיר מחוץ לחלון) — תוקנו בבדיקה,
  לא במוצר.

## 6. מה נשאר לך ולמה

| סעיפים | למה רק אצלך |
|---|---|
| 1, 43, 57, 63 (עדכון), 69 | "בדוק עדכון" בחנות התוספים של ההתקנה שלך; מכאן ה־WebSocket של HA לא עונה |
| 12, 65 | כרטיס ה־Lovelace ב־HA האמיתי ונתיב ה־Ingress שלו (מצב `embed=1` עצמו נבדק: S4 › embed mode) |
| 17, 68 | אירוע אמיתי מה־NVR; המכניקה (המפה ההיסטורית מתוך אירוע, ה־3D ממצלמת האירוע) נבדקה על אירוע סינתטי במופע הזמני |
| 18 | תחושה של ציור וגרירה על המחשב/הטלפון שלך עם תוכנית אמיתית |
| 20, 28, 40, 62, 64 | טלפון אמיתי (מגע, GPU); המכניקה ב־390 פיקסלים מכוסה |
| 38 (החצי השני) | הדלקת המפסק בתוך HA |
| 56 | הסריקה האמיתית שלך (מספרים בלבד) |
| 63 (המראה) | איך הקומה שלך נראית ב־3D |
| 67 | בניין אמיתי עם כמה מפלסים (מכוסה על תוכנית סינתטית עם שני מפלסים) |

ושתי ההחלטות מ־5.2: מיזוג מול רשומות מחוקות, והמבנה בכרטיס של עמוד אירוע.

## 7. Commits של הסבב (ענף `pilot/round9-self-verification`)

| commit | מה |
|---|---|
| e90f771 | test(backup): סבב גיבוי ← שחזור של שורות הסטודיו (סעיף 15) |
| 459f882 | fix(backup): השחזור מדווח את השורות שכתב (סעיף 15) |
| a907555 | test(crop): ייבוא מחדש בחיתוך אחר (סעיף 19) |
| 8c8dcad | test(plan-studio): 7א, 10, 26, 30, 44–48, 54, 55, 66 + gltf-validator |
| eb2cc73 | test(form-round9): המפרט החדש לסעיפים בלי בדיקה משלהם |
| b8422ae | test(event-page): עמוד אירוע על מופע זמני (סעיפים 11, 26) |
