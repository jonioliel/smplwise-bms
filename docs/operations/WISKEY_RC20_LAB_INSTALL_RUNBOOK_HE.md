# התקנת WisKey rc.20 במעבדה - ספר הפעלה לחלון שהבעלים קובע

Source: original
Row: LAB-2540-RUNBOOKS (גרסה 2.54 = קבלת מעבדה). נכתב 25.11.2026. מסמך בלבד.

**סטטוס: NOT_RUN.** שום דבר כאן לא הורץ. לא הייתה גישה למעבדה, ל-Home Assistant, ל-WisKey או לתחנה. אין כאן כתובות, מספרים
סידוריים, מפתחות או סיסמאות. מספרי המעבדה (גרסאות בפועל, שמות קבצי גיבוי, שעות) נרשמים רק בגיליון הפרטי של החלון,
תחת `private-evidence/`.

**הסבר בשורה אחת.** WisKey rc.20 (קוד מוצר `dcebb9f34c8f95638e498115a2aeb5ce2711981e`) מתקין רק אחרי ש-Arx 2.52 פורסם והותקן,
גשר 0.10.9 נטען (עם הפעלה מחדש אחת שאושרה), ו-WisKey אישר את תיקון ה-re-pair. ההתקנה עצמה היא חלון נפרד עם גיבוי מלא,
הפעלה מחדש אחת נוספת של Home Assistant, ובדיקות קריאה בלבד אחריה. אחרי שהחנות של WisKey עוברת ל-store-v2 אין חזרה
"בקוד בלבד": חזרה לאחור = שחזור גיבוי מלא.

---

## 1. מקורות (קריאה בלבד)

| מה | זהות |
|---|---|
| מסירת WisKey | המאגר `C:\cloude\wiskey-review-ro` (קריאה בלבד, לא משנים אותו), קומיט `57e4615e0b943638b7e6cdcd4565c183e559483e`, תיקייה `docs/owner-development-2026-11-25/mac-arx-adoption/`: `PREPARATIONS_HE.txt`, `packages/PACKAGE_VERIFICATION.json`, `packages/*_MANIFEST.json`, `FORWARD_TO_ARX_HE.txt`, `START_HERE_HE.txt`, `SHA256SUMS.txt` |
| מוצר WisKey | `2.0.1-rc.20` = `dcebb9f34c8f95638e498115a2aeb5ce2711981e` (בסיס rc.19 = `3e7bfc585d5a30bddd97ceeed1bb0d7032ee021d`) |
| מצב WisKey במעבדה היום | `2.0.1-rc.10` לפי קריאה בלבד מ-24.11 (`docs/changes/WISKEY-RESYNC-2520.md` סעיף 1). דיגסט העץ המותקן: לא זוהה עדיין |
| Arx | ענף הרכבת `release/2520-train` (2.52.0, גשר 0.10.9); `docs/changes/WISKEY-BRIDGE-KEYSET-2520.md` סעיפים 6, 8, 9; `docs/changes/WISKEY-*-2520.md`; `docs/operations/WISKEY_ACTIVATION_RUNBOOK.md` |

הכלל של WisKey עצמו (PREPARATIONS, סעיף 8): "רק אחרי סגירת תנאי התוכנה והוראת בעלים נפרדת ניתן לתכנן חלון פעולה מוגדר".
ההמלצה הרשמית בחבילה היום: `CONDITIONAL_BLOCKED_BY_ARX_BRIDGE_ACCEPTANCE_AND_RELEASE_INTEGRATION` ו-`installation: NOT_PERFORMED`.

---

## 2. תנאי סף - כולם חייבים להתקיים לפני שקובעים חלון

| # | תנאי | איך בודקים (קריאה בלבד) | אם לא מתקיים |
|---|---|---|---|
| 2.1 | **Arx 2.52 פורסם** (תג `v2.52.0`, `main`, ענף `#addon`) **והותקן במעבדה** | בדיקת הבריאות של התוסף עונה `2.52.0` (או גרסה מאוחרת יותר שנרשמת) | לא ממשיכים |
| 2.2 | **גשר 0.10.9 נטען** - הותקן עם **הפעלה מחדש אחת של Home Assistant Core שאושרה בנפרד** (WISKEY-BRIDGE-KEYSET-2520 סעיף 6.1) | מצב הגשר בתוסף: `active`, `active_version 0.10.9` (לא רק `installed_version`); אין שגיאת ייבוא של `smplwise_bridge` ביומן HA; שלושת הגיבובים בנספח A.3 תואמים לקבצים המותקנים | לא ממשיכים. "התווית 0.10.9" או קוד פיילוט לבדם אינם מספיקים (PREPARATIONS סעיף 1) |
| 2.3 | **WisKey אישר את תיקון ה-re-pair** מול מקור הגשר הסופי: שתי בדיקות הקבלה של `FINAL-ARX-REPAIR` + `test_m15_direct_v2` + 29 בדיקות ה-native, כולן PASS, מול ה-SHA המלא שנמסר (כולל שינוי `keyset.py` / `__init__.py` של BRIDGE-REPAIR-LEGACY-2520) | מסמך תשובה של WisKey שהבעלים מעביר, עם SHA מלא ותוצאה | לא ממשיכים. היום זו תוצאה `FAIL` (2 בדיקות) על `8e412b0` |
| 2.4 | **WisKey הסיר את החסימה בכתב** - מסירה חדשה שבה ההמלצה כבר אינה `CONDITIONAL_BLOCKED...` עבור rc.20 (או מועמד חדש יותר; אז המסמך הזה מתעדכן לדיגסטים החדשים) | המסירה החדשה | לא ממשיכים |
| 2.5 | **ממשק B2 אומץ במפורש** (`wiskey-schedule-reads.v1`, WISKEY-SCHED-READS-2520) ונמצא בגרסה המותקנת | `docs/changes/RELEASE-2520-TRAIN.md` מונה את השורה; הגרסה המותקנת היא זו | לא ממשיכים |
| 2.6 | **חלון נפרד** - לא אותו חלון של הפעלת הגשר מחדש. הבעלים קובע תאריך ושעה ונותן אישור מפורש לחלון הזה | אישור בצ'אט: `מאשר: חלון התקנת WisKey rc.20` | לא מתחילים |
| 2.7 | אין ריצת gate, soak או בדיקת מעבדה אחרת באותו זמן; אין בדלתות/תחנות עבודה מתוכננת באותה שעה | לוח הזמנים של הבעלים | דוחים |

---

## 3. קביעת הפרופיל (קריאה בלבד, לפני החלון)

ל-rc.20 יש שתי חבילות. בוחרים **לפי ההתקנה המקורית במעבדה**, לא לפי נוחות:

| פרופיל | חבילה | מתי |
|---|---|---|
| `owner_manual_existing` | `WISKEY_MANUAL_2.0.1-rc.20.zip` (408 קבצים) | WisKey הותקן במעבדה ידנית על ידי הבעלים |
| `managed_original_authority_flow` | `WISKEY_MANAGED_2.0.1-rc.20.zip` (407 קבצי רכיב) | WisKey הותקן בזרימה המנוהלת המקורית של WisKey |

איך יודעים, בקריאה בלבד:

1. מחשבים את דיגסט העץ המותקן היום (`wiskey-posix-tree-sha256.v1`, נספח A.4) ומשווים לטבלת העצים המוכרים של Arx
   (`smplwise_vms/backend/smplwise/services/wiskey_known_trees.json`): ל-rc.10 יש שני עצים מוכרים - מנוהל (`5a3d3ced...`) וידני
   (`9a3f237d...`).
2. בודקים אם קיים במעבדה פרופיל הבעלים הידני (הקובץ שהגשר מזהה כ"פרופיל בעלים ידני").
3. **אם הדיגסט לא תואם אף עץ מוכר, או ששני הסימנים סותרים: עוצרים** ושואלים את WisKey דרך הבעלים. לא מנחשים.

כללים מ-PREPARATIONS (סעיף 2) שלא משתנים בשום פרופיל:

- ידני אינו מנוהל ואינו העברת בעלות. אין `prepare`, אין migration, אין grant, אין פתיחת policy B / OFF מכוח החבילה, אין
  הפעלה עצמית.
- המתג של Arx `wiskey.auto_install` **נשאר כבוי** לכל אורך החלון (שורת המצב "התקנה ועדכון מנוהלים של WisKey" אומרת
  `policy_b`). אם הוא מופיע דולק - עוצרים.
- פרופיל מנוהל מותקן **רק** לפי הוראות WisKey לזרימה המנוהלת שלו. אם הפרופיל במעבדה מנוהל ואין הוראות כאלה במסירה - עוצרים;
  ספר ההפעלה הזה מכסה את הפרופיל הידני בלבד.

---

## 4. גיבוי מלא ותוכנית שחזור מאומתת

### 4.1 מה מגבים (בתוך החלון, מיד לפני ההתקנה)

| # | גיבוי | אישור | בדיקה |
|---|---|---|---|
| 4.1.1 | **גיבוי מלא של HA** (הגדרות › מערכת › גיבויים › גיבוי מלא) - כולל `custom_components` (WisKey והגשר), `.storage` (החנות של WisKey), ותוסף Arx | `מאשר: גיבוי מלא של HA` | תאריך ושעה נכונים, גודל סביר, התוסף ותיקיית ההגדרות ברשימת התוכן; מפתח ההצפנה במנהל הסיסמאות; **הורדה מחוץ למכונה** |
| 4.1.2 | **גיבוי Arx** (Arx › הגדרות › גיבוי ושחזור › "צור גיבוי", עם סיסמת גיבוי) | `מאשר: גיבוי Arx` | שעה, גודל, סימן "מוצפן"; הורדה מחוץ למכונה |
| 4.1.3 | **העתק של תיקיית WisKey הישנה** - העץ המותקן של rc.10 נשמר כמו שהוא (העברה מחוץ ל-`custom_components`, לא מחיקה) | כלול באישור ההתקנה | דיגסט העץ שנשמר = הדיגסט שנמדד בסעיף 3 |

### 4.2 מפת הצמדות (נרשמת בגיליון הפרטי לפני ההתקנה)

- Arx: גרסה, קומיט התג, קומיט ענף `#addon`.
- גשר: `active_version`, שלושת הגיבובים (נספח A.3).
- WisKey: התווית המותקנת, קוד המוצר אם ידוע, דיגסט העץ המותקן, הפרופיל, מספר הרשומות (entries) שנטענו.
- Home Assistant Core: גרסה.
- הגדרות Arx הרלוונטיות: `access.station_media_provider`, `access.station_media`, `wiskey.auto_install`,
  `bridge.key_rotation`, `access.station_media_direct_v2` (אם קיים בגרסה).
- שמות קבצי הגיבוי ושעותיהם.

### 4.3 תוכנית השחזור ואימותה

"מאומתת" פירושו שלפני החלון כבר בדקנו שהגיבוי נפתח, לא רק שנוצר:

1. **גיבוי HA:** רשימת התוכן של הגיבוי מוצגת ב-HA ומכילה את תיקיית ההגדרות ואת תוסף Arx; מפתח ההצפנה נפתח את הגיבוי
   (בדיקה במנהל הגיבויים, בלי לשחזר).
2. **גיבוי Arx:** תרגול שחזור על יעד שאינו המעבדה לפי `docs/operations/OFFBOX_RESTORE_HE.md` (הסקריפט `scripts/offbox_restore.py`),
   או לפחות פתיחה ואימות של הקובץ המוצפן עם הסיסמה. תוצאת התרגול נרשמת.
3. **שחזור WisKey בלבד:** ההמלצה היא שחזור חלקי של HA - "Home Assistant" (תיקיית ההגדרות, כולל `custom_components` ו-`.storage`)
   **בלי** תוסף Arx, כדי שהנתונים של Arx מאז הגיבוי לא יימחקו. ההחלטה בזמן אמת, לפי התקלה.

### 4.4 מה הגיבוי **לא** מכסה (PREPARATIONS סעיפים 3-4)

- שינויים שקרו אחרי הגיבוי. שחזור מלא אינו משמר אותם מאליו: מתעדים את הפער (משעת הגיבוי עד השחזור), וכל פעולה של WisKey
  באותו פער מוחזרת כ-**UNKNOWN לקריאה בלבד, בלי שליחה חוזרת**.
- ה-preimage הראשון של users / visits ש-WisKey שומר אינו גיבוי של HA או של Arx, ואינו היסטוריה מאוחרת.
- מקור metadata / verifier / witness אינו "מומצא" ואינו נחשב כלול בגיבוי אם הוא לא באמת שם.
- צריך לשמר: משתמשים וביקורים, CAS ו-external refs, מצבי UNKNOWN, תוצאות עבודות (jobs) והיסטוריה.

---

## 5. דיגסטים לאימות

כל הערכים מתוך `packages/PACKAGE_VERIFICATION.json` ו-`SHA256SUMS.txt` בקומיט `57e4615e...`. מאמתים **על המחשב**, לפני העתקה
למעבדה (נספח A.2), ושוב על העץ המותקן לפני ההפעלה מחדש (נספח A.4).

| מה | ידני (`owner_manual_existing`) | מנוהל (`managed_original_authority_flow`) |
|---|---|---|
| קובץ | `WISKEY_MANUAL_2.0.1-rc.20.zip` | `WISKEY_MANAGED_2.0.1-rc.20.zip` |
| בתים | 1797630 | 1812719 |
| SHA256 של ה-ZIP | `65519f1366631c55782c452faf368baf31213760097705521cf790b2da9d234b` | `bb9ceae514ceb525791b5b3a04c6e410406e099aea9e5ee1758991e372f988eb` |
| דיגסט רכיב (`wiskey-posix-tree-sha256.v1`) | `e025a6bce085d525461f7c52d79277d59b5d8252758d382f1d8a388cf2126ddf` | `c0824762807044d634cb5c64e44e60c30bfd84680f03424296b1bc2ae390430d` |
| קבצי רכיב / רשומות בחבילה | 408 / 408 | 407 / 408 |
| SHA256 של המניפסט | `3c6ba3cc3a40d4fab0c720a8381af5debe0db37505263f6947dd1e86512dff11` | `2c3a37bf238ddf62d4cbf5310aa46079552a168db0093240a9e06280de4e83ac` |

משותף: קוד מוצר `dcebb9f34c8f95638e498115a2aeb5ce2711981e`, גרסה `2.0.1-rc.20`; `PACKAGE_VERIFICATION.json`
`646ac74e7b65f67834c5af1e752cbb612b32324c2cb59031bb6db2cdd401e5ce`; ארכיון המקור `SOURCE_COMPONENT.tar.gz`
`d56142e8f4900b5468442406080632367939420d7a9675b91685084f8f4ebb54`; מתכון הבנייה `934eb5c80b44729fc0ed0f3f64d4a54a61926fe72326b2099de166af2f24adf6`.

**סתירה שנרשמת (לא נפתרת בשקט):** רשימת העצים המוכרים של Arx (`wiskey_known_trees.json`) נגמרת ב-rc.10. אחרי ההתקנה Arx
יראה את rc.20 כעץ לא מוכר (התווית לבדה לעולם אינה זהות). זה לא חוסם את ההתקנה הידנית (`wiskey.auto_install` כבוי), אבל
שורת המצב תגיד "לא מוכר". ראו שאלה 1 בסעיף 12.

---

## 6. צעד אחר צעד בחלון

כל צעד שכותב משהו מתחיל רק אחרי שנוסח האישור שלו נכתב בצ'אט. אפשר לעצור אחרי כל צעד בלי סיבה. אם המסך שונה ממה שכתוב כאן -
המסך קובע, ורושמים את ההבדל.

| צעד | מי | מה | אישור |
|---|---|---|---|
| 0 | יחד | פתיחה: רושמים שעה, מוודאים שסעיף 2 כולו מסומן, ושהפרופיל נקבע (סעיף 3) | `מאשר: חלון התקנת WisKey rc.20` |
| 1 | יחד, קריאה בלבד | **"לפני"**: צילומי מסך של כל השורות בסעיף 8 (עמודת "לפני"); בריאות Arx; גשר `active_version 0.10.9`; אין תיקונים (repairs) פתוחים ב-HA; אין עבודה פעילה של WisKey (jobs) ואין סנכרון תחנה פעיל; מספר הרשומות של WisKey שנטענו | - |
| 2 | הבעלים | גיבויים 4.1.1 + 4.1.2; רישום מפת ההצמדות 4.2 | `מאשר: גיבוי מלא של HA`, `מאשר: גיבוי Arx` |
| 3 | הבעלים | **החלפת הקבצים בלבד** (פרופיל ידני): העברת התיקייה `custom_components/hikvision_intercom` הקיימת אל מחוץ ל-`custom_components` (שמירה, 4.1.3); פריסת ה-ZIP המאומת למקומה; בלי קבצים נוספים ובלי למזג עם הישנה | `מאשר: החלפת קבצי WisKey ל-rc.20` |
| 4 | יחד, קריאה בלבד | **הקובץ המותקן ≠ המודול הטעון.** מחשבים את דיגסט העץ שהותקן (נספח A.4) - חייב להיות `e025a6bc...` (ידני). אם לא - עוצרים, מחזירים את התיקייה הישנה (חזרה R0, סעיף 10) | - |
| 5 | הבעלים | **הפעלה מחדש אחת: Home Assistant Core בלבד** (לא המארח, לא Supervisor, לא התוסף) | `מאשר: הפעלה מחדש של HA להתקנת WisKey` |
| 6 | יחד, קריאה בלבד | בדיקות אחרי (סעיף 7) | - |
| 7 | יחד, קריאה בלבד | **"אחרי"**: צילומי מסך של סעיף 8; השוואה ל"לפני" | - |
| 8 | יחד | סגירה: גיליון פרטי מלא, צילומים מושחרים, תוצאה PASS / FAIL / BLOCKED לכל בדיקה | - |

מה **לא** עושים בחלון הזה: לא מחליפים את מפתח הגשר, לא מדליקים מדיה v2, לא יוצרים grant ולא מאשרים מחדש שירות ידני
(manual-v3) - זו פעולה מפורשת של בעל HA במסך של WisKey, ולא במסגרת ההכנה (PREPARATIONS סעיף 5); לא פותחים דלת, לא מפעילים
ממסר, לא פותחים דיבור או האזנה; לא כותבים אנשים, כרטיסים או ביקורים; לא מריצים את V5; לא מבצעים A2 (נדחה ל-2.53 בלי
אישור עצמי).

---

## 7. בדיקות קריאה בלבד אחרי ההפעלה מחדש

| # | בדיקה | צפוי |
|---|---|---|
| 7.1 | יומן HA | אין שגיאת ייבוא / setup של `hikvision_intercom` ושל `smplwise_bridge` |
| 7.2 | גרסת WisKey | WisKey מדווח `2.0.1-rc.20`; מספר הרשומות שנטענו = כמו לפני |
| 7.3 | העץ הטעון | אם WisKey או Arx מציגים דיגסט טעון - שווה ל-`e025a6bc...`. אם אין תצוגה כזו - רושמים "הדיגסט הטעון לא נצפה", לא PASS |
| 7.4 | גשר | עדיין `active_version 0.10.9`, בלי שגיאה; דחיפת הספרייה (directory push) זזה בתוך כ-60 שניות |
| 7.5 | חיבור Arx ל-WisKey | בלוק "חיבור Arx ל-WisKey" (הגדרות › מתגי מסכי כניסה): מפתח הצימוד תקין; **המפתח לא הוחלף** (החסימה עדיין בתוקף - כל החיבורים v1); אם הספק הוא `auto`: "בדוק חיבור חתום" פעם אחת בלבד (`מאשר: בדיקת חיבור חתום`) - צפוי `accepted` |
| 7.6 | מצב WisKey | רשימת "מצב WisKey": אף שורה לא עברה מ"פעיל" ל"חסום" או "לא ידוע" בגלל ההתקנה; שורות חדשות שהופיעו נרשמות (סעיף 8) |
| 7.7 | תחנות | כל התחנות שהיו מחוברות לפני מחוברות אחרי (WisKey `system/status_v1` או מסך התחנות); תחנה מנותקת נרשמת, לא מסנכרנים אותה |
| 7.8 | עבודות ו-UNKNOWN | אין עבודה ב-UNKNOWN חדש; עבודה שהייתה UNKNOWN לפני נשארת UNKNOWN לקריאה בלבד, בלי שליחה חוזרת |
| 7.9 | חנות WisKey | רושמים אם WisKey דיווח על מעבר ל-store-v2 (מכאן אין חזרה בקוד בלבד, סעיף 10) |
| 7.10 | פעולות Arx רגילות | פתיחת מגירת תחנה אחת ל-30 שניות (וידאו בלבד, אם היה דלוק לפני), סגירה, 0 צרכנים בזרם `smplwise_` |

---

## 8. מה Arx מציג לפני ואחרי

"לפני" = WisKey rc.10 במעבדה עם Arx 2.52. "אחרי" = rc.20 עם אותו Arx. מה שמופיע רק כש-WisKey מפרסם פקודה לזהות של Arx -
מופיע **רק** אז; היעדרו אחרי ההתקנה אינו כישלון של Arx אלא נתון שנרשם ומועבר ל-WisKey.

| איפה ב-Arx | לפני (rc.10) | אחרי (rc.20) | שורת המקור |
|---|---|---|---|
| **דף המצב**: הגדרות › בקרת כניסה › "מערכת האינטרקום" (`#/system/access-control/wiskey`), קריאות `system/status_v1` ו-`jobs/status_v1` | "ה-WisKey המותקן לא מציע מידע זה" (`not_listed`); לא נשלח כלום | טבלה לכל תחנה: חיבור, אימות אחרון, כישלון אחרון במילים, קושחה, מצב סנכרון, בקשת סנכרון (ממתין / רץ / תוצאה + "האפקט לא הוכח"); הערת "תמונת זיכרון של WisKey, לא נשאל אף התקן". `jobs/status_v1` עשוי להיות מסורב לזהות של התוסף (בדיקת בעלים מקורית) - זה מוצג כסירוב, בלי נפילה ל-`jobs/list` | WISKEY-RESYNC-2520 (slice 1), WISKEY-R2-2520 |
| **רשימת המצב "מצב WisKey"** (הגדרות › מתגי מסכי כניסה) | השורות הקיימות; המילים בשפת הדף (WISKEY-STATUS-I18N-2520) | שורות שהיו "לא נתמך" עשויות לעבור ל"כבוי" (נתמך, המתג של Arx כבוי). שורת ההאזנה (R5) נשארת לפי הגילוי החתום האחרון | WISKEY-R5-2520, WISKEY-STATUS-I18N-2520 |
| **מסנן "הסתיים" (`ended`) ברשימת הביקורים** | אין מסנן `ended`; הרשימה נקראת בלי סטטוס; בחירה ידנית של `ended` נענית 409 `wiskey_visits_unsupported` לפני שליחה | המסנן מופיע **רק אם** WisKey מפרסם `visits/record_external_v1` לזהות של Arx. אם WisKey תומך אבל לא נותן ל-Arx את הפקודה - המסנן נשאר מוסתר (נכשל לכיוון "לא מוצע") | WISKEY-VISITS-ENDED-FILTER-2520 |
| **מלאי ממסרים** (הגדרות › הגדרת מערכת › WisKey › "מיפוי ממסרים", כפתור "מה WisKey יודע על...") | "לא נתמך" - הקריאה לא ברשימת הפקודות, לא נשלח כלום | לכל תחנה: "מספר ממסרים פיזיים: לא ידוע", "תפקיד ממסר: לא ידוע", יציאות API כפי שדווחו בטעינה, "בדיקת ממסר בלי הפעלה: לא נתמכת ב-WisKey". מפת הממסרים של Arx **לא משתנה** | WISKEY-RELAY-INV-2520 |
| **סנכרון תחנה** (מגירת התחנה › תחזוקה) | `sync/station` הקלאסי, תשובה `{accepted}` | אם WisKey מפרסם גם `sync/station_v1` וגם `system/status_v1`: בקשה ממוספרת, מזהה קצר בתא הסנכרון, מצב דרך `system/status_v1`, "האפקט לא הוכח". תחנה מנותקת: `station_offline`, בלי נפילה לקלאסי. **בחלון הזה לא לוחצים סנכרון** - רק מסתכלים שהאפשרות מוצגת | WISKEY-R4-2520 |
| **קריאות לוח זמנים חתומות (B2)** | לא נתמך (לא ברשימה) | עוברות **רק** בחיבור הישיר החתום (`access.station_media_provider = auto`). עם ספק `local` נשאר "לא זמין" - זה צפוי. לא מפעילים קריאה בחלון | WISKEY-SCHED-READS-2520 |
| **החיבור הישיר v2** | רדום: החסימה `wiskey_present` מונעת החלפת מפתח, כל החיבורים v1 | **ללא שינוי** - עדיין רדום עד הסרת החסימה (`BRIDGE_ROTATION_UNBLOCK_PLAN_HE.md`) | WISKEY-DIRECT-V2-2520 |
| **מדיה דרך v2** (`access.station_media_direct_v2`, אם קיים בגרסה) | אין השפעה | אין השפעה (המפתח לא הוחלף) | WISKEY-MEDIA-V2-2530 |
| **זיהוי העץ של WisKey** | rc.10 מזוהה (עץ ידני או מנוהל) | rc.20 **לא מזוהה** (חסר ב-`wiskey_known_trees.json`) | סעיף 5, שאלה 1 |

---

## 9. תנאי עצירה

עוצרים מיד, לא ממשיכים לצעד הבא, ומחליטים על חזרה (סעיף 10) כאשר:

- תנאי מסעיף 2 לא מתקיים, או הפרופיל לא נקבע בוודאות.
- גיבוב ZIP, מניפסט או דיגסט העץ (לפני או אחרי הפריסה) שונה מסעיף 5.
- `wiskey.auto_install` דולק, או שמשהו מבקש prepare / migration / grant / שינוי policy.
- שגיאת ייבוא / setup ב-HA אחרי ההפעלה מחדש, או ש-WisKey לא עולה תוך 5 דקות.
- מספר הרשומות שנטענו שונה מלפני, או שתחנה שהייתה מחוברת לא חוזרת תוך 10 דקות.
- הגשר יצא מ-`active` / `0.10.9`, או ש"מפתח הצימוד" לא תקין.
- עבודה חדשה ב-UNKNOWN, או כל סימן לשליחה חוזרת.
- כל פעולה פיזית לא צפויה (דלת, ממסר, אודיו) - עוצרים ומדווחים מיד.
- הבעלים אומר "עצור".

---

## 10. חזרה לאחור

**כלל WisKey (PREPARATIONS סעיף 4):** אחרי שהחנות עברה ל-store-v2 **אין code-only downgrade אל מתחת ל-rc.17**. ה-rc.10
שבמעבדה נמצא מתחת לגבול הזה, ולכן אחרי ההפעלה מחדש **מניחים** שהמעבר קרה, גם אם לא נצפה, ולא מחזירים את הקבצים הישנים.

| מצב | חזרה | אישור |
|---|---|---|
| **R0** - לפני ההפעלה מחדש (צעדים 3-4) | מוחקים את התיקייה החדשה ומחזירים את התיקייה הישנה (4.1.3) למקומה; מוודאים שהדיגסט חזר לערך של סעיף 3. שום קוד חדש לא נטען, אין צורך בהפעלה מחדש | `מאשר: החזרת קבצי WisKey הישנים` |
| **R1** - אחרי ההפעלה מחדש | **שחזור גיבוי HA** מצעד 2 (מומלץ: חלקי, "Home Assistant" בלי תוסף Arx - סעיף 4.3). מתעדים את הפער בין שעת הגיבוי לשעת השחזור; כל פעולה של WisKey בפער = UNKNOWN לקריאה בלבד, בלי replay. אחרי השחזור: בדיקות 7.1-7.8 מול rc.10 | `מאשר: שחזור גיבוי HA` (כולל הפעלה מחדש שהשחזור עושה) |
| **R2** - Arx עצמו נפגע (לא צפוי: ההתקנה לא נוגעת בנתוני Arx) | שחזור גיבוי Arx מצעד 2 | `מאשר: שחזור גיבוי Arx` |

אסור: להחזיר קבצי rc.10 אחרי ההפעלה מחדש בלי שחזור החנות; לנסות "לתקן" את החנות ידנית; לשלוח מחדש פעולות שהיו בפער.

---

## 11. ראיות שנשמרות (מושחרות)

- בגיליון הפרטי (`private-evidence/wiskey-rc20-install/`): מפת ההצמדות, שמות הגיבויים, צילומי "לפני" ו"אחרי", שורות יומן
  רלוונטיות. בלי כתובות, מספרים סידוריים, MAC, טוקנים, שמות תחנות אמיתיים או תמונות ממצלמות.
- במאגר (אחרי השחרה ובדיקה): טבלת תוצאות PASS / FAIL / BLOCKED לכל בדיקה בסעיף 7, הדיגסטים שנמדדו (הם ציבוריים - של WisKey),
  והחלטת החזרה אם הייתה. נרשם בהערת שינוי של שורת הקבלה של 2.54.

---

## 12. שאלות פתוחות (המלצה ראשונה)

1. **זיהוי rc.20 ב-Arx.** (א) שורה קטנה שמוסיפה את שני העצים של rc.20 (ידני `e025a6bc...` / 408, מנוהל `c0824762...` / 407,
   קוד מוצר `dcebb9f3...`) ל-`wiskey_known_trees.json` ונכנסת לגרסה המותקנת לפני החלון (מומלץ - אחרת שורת המצב אומרת
   "לא מוכר" על התקנה תקינה); (ב) להשאיר "לא מוכר" ולרשום.
2. **הפרופיל במעבדה.** (א) לקבוע בקריאה בלבד לפי סעיף 3 לפני קביעת החלון (מומלץ); (ב) לשאול את WisKey ישירות דרך הבעלים.
3. **סוג השחזור ב-R1.** (א) חלקי - "Home Assistant" בלי תוסף Arx (מומלץ - שומר את נתוני Arx מאז הגיבוי); (ב) מלא.

---

## Appendix A - technical (English)

All commands are for the lead's PC (Git Bash or PowerShell) unless marked. Nothing here was run against the lab. No value from
`secrets/lab.env` is ever printed, echoed, or pasted.

### A.1 Extract the packages without touching the WisKey checkout

The WisKey repository is read-only. Do not check out, fetch into a working tree change, or write inside it. `git cat-file` writes to
stdout only; redirect into a fresh scratch directory (Git Bash, so binary output is not re-encoded):

```bash
C=57e4615e0b943638b7e6cdcd4565c183e559483e
P=docs/owner-development-2026-11-25/mac-arx-adoption
OUT="$SCRATCH/wiskey-rc20"; mkdir -p "$OUT"
for f in packages/WISKEY_MANUAL_2.0.1-rc.20.zip packages/WISKEY_MANAGED_2.0.1-rc.20.zip \
         packages/MANUAL_MANIFEST.json packages/MANAGED_MANIFEST.json packages/PACKAGE_VERIFICATION.json; do
  git -C /c/cloude/wiskey-review-ro cat-file blob "$C:$P/$f" > "$OUT/$(basename "$f")"
done
```

### A.2 Verify before copying (PC)

```bash
cd "$OUT" && sha256sum WISKEY_MANUAL_2.0.1-rc.20.zip WISKEY_MANAGED_2.0.1-rc.20.zip MANUAL_MANIFEST.json MANAGED_MANIFEST.json PACKAGE_VERIFICATION.json
stat -c '%s %n' WISKEY_*.zip
```

Expected values: section 5. Then unpack the chosen ZIP into its own empty directory and recompute the component digest (A.4) on the
unpacked component; it must equal the `component_digest` of section 5 and the manifest's `files` count. A ZIP is untrusted data:
unpack into a new empty directory and run Python with `-I` from outside it.

### A.3 Bridge 0.10.9 hashes (precondition 2.2)

sha256 of the three files, identical in `custom_components/smplwise_bridge/` and `smplwise_vms/integration/smplwise_bridge/` at the
2.52 train head (`ec104d2490bb8f87c69b4f2977c8e3547e91cec4` is the last bridge commit):

| file | sha256 |
|---|---|
| `native_keyset.py` | `5fda54de2f2caffe78bb32d4bddce2784d607f285be48f3e6eedc500bc97d1df` |
| `keyset.py` | `05d6458f4fc8843121c4a6d003191d825a17724f042ceddccb4c43021bb005c4` |
| `__init__.py` | `4b497464e7f27a4edd02a0d3f1338d951d864428644c6908a061164856d86fe1` |

If the released 2.52.0 differs (a later bridge fix), take the values from the release's `WISKEY-BRIDGE-KEYSET-2520.md` instead and
note the change here. On the lab host, read them over the owner's SSH key (read-only `sha256sum` of
`/config/custom_components/smplwise_bridge/*.py`). The installed file is not the loaded module: the loaded version is the bridge's
own `active_version` after the Core restart.

### A.4 Component digest (`wiskey-posix-tree-sha256.v1`)

Arx carries the same algorithm as WisKey: `smplwise_vms/backend/smplwise/services/wiskey_distribution_digest.py` (`digest(root)`:
regular files only, `__pycache__`, `.pyc`, `.DS_Store`, `.smplwise_installed.json` skipped; symlinks refused; rows sorted by exact
POSIX path; sha256 of compact sorted-key ASCII JSON). On the PC, against an unpacked tree:

```bash
cd /c/cloude/smplwise-lab2540/smplwise_vms/backend
/c/cloude/smplwisebms/.venv/Scripts/python.exe -I -c "import sys; sys.path.insert(0, '.'); \
from smplwise.services.wiskey_distribution_digest import digest; print(digest(sys.argv[1]))" "$OUT/unpacked-manual"
```

On the lab host (owner's SSH key, read-only), copy the module to a scratch path outside `/config` and run it against
`/config/custom_components/hikvision_intercom`; or pull a read-only tar of that directory to `private-evidence/` and compute on the
PC. Record: the digest before (section 3), after unpack (step 4), and the kept rc.10 tree (4.1.3).

### A.5 Read-only checks after the restart

- HA log: the owner's long-lived token is read from `secrets/lab.env` by the script, never printed; `GET /api/error_log` filtered for
  `hikvision_intercom` / `smplwise_bridge`. Or the owner reads Settings > System > Logs.
- Arx: `GET /api/v1/health`, the bridge-key card (`GET /system/bridge-key`) for `integration_version`, the access-control status
  routes the screens of section 8 use. GET only. One signed pairing check at most, by the owner's click, with its own approval.
- WisKey: its own status panel, read by the owner.

### A.6 Rollback mechanics

- R0: `mv` the new directory out, `mv` the kept rc.10 directory back, recompute the digest (A.4) = the section 3 value.
- R1: Home Assistant partial restore of the step 2 backup ("Home Assistant" + folders, Arx add-on deselected). Write down the gap
  (backup time -> restore time). WisKey jobs / visits / writes in the gap are UNKNOWN, read only, never replayed.
- No code-only downgrade below rc.17 after store-v2 (WisKey PREPARATIONS item 4).

### A.7 What this runbook does not cover

Bridge 0.10.9 install (WISKEY-BRIDGE-KEYSET-2520 section 6.1), the rotation unblock (`BRIDGE_ROTATION_UNBLOCK_PLAN_HE.md`), media
over v2, the managed profile flow, manual-v3 service re-grant, A2, V5, any door / relay / audio action.
