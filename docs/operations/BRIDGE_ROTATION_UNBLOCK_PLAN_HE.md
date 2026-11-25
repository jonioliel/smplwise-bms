# הסרת חסימת החלפת מפתח הגשר כש-WisKey מותקן - תוכנית

Source: original
Row: LAB-2540-RUNBOOKS (גרסה 2.54 = קבלת מעבדה). נכתב 25.11.2026. מסמך בלבד.

**סטטוס: NOT_RUN, תוכנית בלבד.** שום דבר כאן לא הורץ, שום קוד לא שונה. החסימה עדיין בקוד: `bridge_rotation.preflight` מסרב
`wiskey_present` כל עוד WisKey מותקן. אין כאן כתובות, מספרים סידוריים, מפתחות או סיסמאות.

**הסבר בשורה אחת.** היום, כש-WisKey מותקן, Arx לא מחליף את מפתח הגשר - כי WisKey הישן מאמת רק את קוד הצימוד, וההחלפה הראשונה
מוחקת אותו. גשר 0.10.9 ו-WisKey rc.20 יודעים לעבוד עם מפתח מוחלף (פרוטוקול v2 עם מזהה מפתח). התוכנית: להסיר את החסימה רק אחרי
שכל החלקים הותקנו ונבדקו, בשורת קוד נפרדת, ולהחליף את המפתח בפעם הראשונה בחלון עם הבעלים. **אחרי ההחלפה הראשונה שהושלמה אין
חזרה ל-v1 בלי צימוד מחדש.**

---

## 1. מה החסימה עושה היום

- `bridge_rotation.wiskey_present()` מחזיר אמת כש-WisKey דיווח גרסה, כשהתיקייה `custom_components/hikvision_intercom` קיימת, או
  כשפרופיל הבעלים הידני קיים. אז `preflight` מסרב `wiskey_present` - גם ללחיצה של מנהל וגם לעובד האוטומטי.
- הסיבה (BRIDGE-STALE-DISCOVERY-2383): WisKey v1 מאמת את החתימה של Arx רק מול `pairing_code` של רשומת הגשר, והגשר מרוקן את השדה
  הזה אחרי ההחלפה הראשונה שהושלמה (`keyset.py`, HA-06). החלפה = WisKey מתנתק מ-Arx.
- התוצאה: המפתח נשאר קוד הצימוד (`g0-legacy`), כל החיבורים הם v1, החיבור הישיר v2 (R7, WISKEY-DIRECT-V2-2520) רדום, והמתג של
  מדיה v2 (`access.station_media_direct_v2`, WISKEY-MEDIA-V2-2530) לא משנה כלום.
- החלטת הבעלים (Q8, = R7 שאלה 5 תשובה א): **החסימה נשארת** עד שגשר 0.10.9 מותקן ונבדק. המסמך הזה מתאר מה עוד חייב להתקיים לפני
  שמסירים אותה, ואיך.

---

## 2. תנאים מוקדמים - כולם, לפי הסדר

| # | תנאי | ראיה נדרשת | מקור |
|---|---|---|---|
| P1 | Arx 2.52 פורסם והותקן במעבדה; **גשר 0.10.9 טעון** (`active_version 0.10.9`) אחרי ההפעלה מחדש האחת שאושרה | בדיקת בריאות; כרטיס מפתח הגשר (`GET /system/bridge-key`) מראה `integration_version` 0.10.9; שלושת הגיבובים של הגשר (נספח A.1) | WISKEY-BRIDGE-KEYSET-2520 סעיף 6.1 |
| P2 | **קבלת WisKey על תיקון ה-re-pair: PASS** - שתי בדיקות `FINAL-ARX-REPAIR` (`test_repairing_cannot_keep_previous_pairing_fingerprint`, `test_old_key_cannot_open_new_v2_socket_during_repair`) + `test_m15_direct_v2` + 29 בדיקות ה-native, מול ה-SHA **הסופי** של הגשר (כולל שינוי `keyset.py` / `__init__.py` ב-BRIDGE-REPAIR-LEGACY-2520) | מסמך תשובה של WisKey דרך הבעלים: SHA מלא, גיבובי הקבצים, רשימת הבדיקות ותוצאתן | WISKEY-BRIDGE-KEYSET-2520 סעיפים 8.5, 9.8 |
| P3 | **WisKey rc.20 מותקן במעבדה** ובדיקות ה"אחרי" שלו עברו. rc.10 אינו יודע v2: החלפה מולו מנתקת אותו | `WISKEY_RC20_LAB_INSTALL_RUNBOOK_HE.md` סעיף 7 - הכל PASS | ספר ההפעלה של rc.20 |
| P4 | **שורות "בלי נפילה" ממוזגות, משוחררות ומותקנות**: WISKEY-NOFALLBACK-FIX-2520 (2.52: מסלולי אנשים) **ו-WISKEY-NOFALLBACK-2-2530** (2.53: חוזה הלקוח והמנוע של ההרשאות). אחרי סירוב v2 לא עוברים לערוץ אחר | הערות השינוי בגרסה המותקנת; ה-gate של הגרסה ירוק | WISKEY-NOFALLBACK-2-2530 ("must land before the block is lifted in 2.54") |
| P5 | WISKEY-MEDIA-V2-2530 ממוזג ומותקן (2.53). בלעדיו ההחלפה עדיין אפשרית, אבל וידאו ודיבור של תחנה מסורבים `bridge_key_rotated` ונופלים למקור הווידאו של Arx | הערת השינוי בגרסה המותקנת | WISKEY-MEDIA-V2-2530 סעיף 2 |
| P6 | **שורת מצב מודעת-פרוטוקול** (MEDIA-V2 שאלה 1 א): היום דף המצב אומר "המפתח הוחלף, WisKey v1 מסרב" גם כשהחיבור והמדיה חותמים v2. השורה נכנסת יחד עם הסרת החסימה, כדי שהמסך לא יטעה | שורה ממוזגת עם בדיקות | WISKEY-MEDIA-V2-2530 שאלה 1 |
| P7 | **שורת הקוד שמסירה את החסימה** (סעיף 3) ממוזגת לרכבת 2.54, ה-gate ירוק | הערת שינוי + תוצאות | R7 שאלה 5 |
| P8 | WisKey אישר בכתב שהוא מוכן למפתח מוחלף (v2) מול הגשר הזה, ומה קורה ל-grant ידני (manual-v3) עם fingerprint היסטורי | מסירת WisKey | FORWARD_TO_ARX 2.3 (ב) |
| P9 | גיבויים טריים (HA מלא + Arx) לפני ההחלפה הראשונה | כמו בספר ההפעלה של rc.20 סעיף 4 | - |

**הערה על P8 / fingerprint.** לפי WisKey (FORWARD_TO_ARX 2.3): ה-fingerprint הוא לכל צימוד ויציב לאורך החלפות; החלפה רגילה **לא**
מבטלת grant. אבל האלגוריתם החדש שונה מההיסטורי, ולכן הרשאה קיימת עם fingerprint היסטורי עשויה להיות כבר לא אפקטיבית. אין
migration / grant / rebind שקט; אישור מחדש, אם יידרש, הוא פעולה מפורשת של בעל HA במסך של WisKey, לא של Arx.

---

## 3. שורת הקוד שמסירה את החסימה (תכנון; לא כתובה כאן)

שורה נפרדת בשם הצעה `BRIDGE-ROTATION-UNBLOCK-2540`, בבעלות אחת, עם בדיקות. ההמלצה: לא למחוק את החסימה, אלא להפוך אותה לתנאי:

- `wiskey_present()` נשאר כמו שהוא (קריאה בלבד). `preflight` מסרב `wiskey_present` **אלא אם** שלושה דברים מתקיימים יחד:
  1. הגשר שנראה אחרון (`bridge.integration_version`, מה-hello של הגשר עצמו) הוא 0.10.9 ומעלה (אותו כלל כמו `wiskey_media_v2.bridge_ok`);
  2. עץ WisKey המותקן מזוהה לפי דיגסט (לא לפי תווית) כעץ שיודע v2 - rc.20 ומעלה ברשימת העצים המוכרים (`wiskey_known_trees.json`);
  3. הגדרה מפורשת של הבעלים, ברירת מחדל כבויה (הצעה: `bridge.key_rotation.wiskey_v2` = `off` | `on`), שרק מנהל מערכת משנה, מבוקרת,
     ומסורבת 409 כשתנאי 1 או 2 לא מתקיימים.
- כל עוד אחד מהם חסר: הסירוב הקיים, אותו קוד, אותה הודעה. בדיקה מצמידה את זה.
- `GO_LIVE_PERMITTED` נשאר מתג ההריגה של הבעלים; `bridge.key_rotation` נשאר כמו היום.
- **ההחלפה הראשונה ידנית בלבד:** בשורה הזו `reminder_days` נקבע 0 כל עוד ההגדרה החדשה דלוקה ולא הושלמה החלפה מאומתת אחת (0 =
  רק ההחלפה הראשונה, אין החלפות אוטומטיות). העובד האוטומטי לא מתחיל החלפה ראשונה מול WisKey.
- שאלות פתוחות לשורה הזו - סעיף 8.

---

## 4. חמשת צעדי הבעלים למדיה v2 (מתוך WISKEY-MEDIA-V2-2530 סעיף 2)

כל צעד הוא החלטה נפרדת של הבעלים. הסדר מחייב.

| צעד | מה | מי | אישור | בדיקה אחרי (קריאה בלבד) |
|---|---|---|---|---|
| 1 | **התקנת גשר 0.10.9** עם ההפעלה מחדש האחת שאושרה (WISKEY-BRIDGE-KEYSET-2520 סעיף 6) | הבעלים | `מאשר: הפעלה מחדש של HA לגשר 0.10.9` | `bridge.integration_version` = 0.10.9 (כרטיס מפתח הגשר / `GET /system/bridge-key`); מצב הגשר `active` |
| 2 | **WisKey מאשר את ה-v2 שלו מול הגשר הזה** (`FINAL-ARX-REPAIR`, `test_m15_direct_v2`) | WisKey, דרך הבעלים | - (מסמך) | P2 מסומן |
| 3 | **הסרת החסימה** - שורת הקוד של סעיף 3 מותקנת, ואז הבעלים מדליק את ההגדרה החדשה; `GO_LIVE_PERMITTED` אמת ו-`bridge.key_rotation = on` כמו היום | הבעלים | `מאשר: הסרת חסימת החלפת המפתח מול WisKey` | `GET /system/bridge-key`: אין עוד סירוב `wiskey_present` ב-preflight (כפתור ההחלפה זמין); `reminder_days` = 0 |
| 4 | **מדיה v2**: מנהל מערכת מגדיר `access.station_media_direct_v2 = on` (נדחה 409 `bridge_outdated` לפני צעד 1) | מנהל מערכת | `מאשר: מדיה דרך v2` | `GET /settings` מראה `on`; שורת ביקורת `allowed` עם `from` / `to` / `bridge_version` |
| 5 | **ההחלפה הראשונה** - רק אז המפתח נעשה v2: החיבור הישיר (R7) ומדיית התחנה עוברים ל-v2 יחד. בלי צעד 4 החיבור עובר ומדיית התחנה מסורבת `bridge_key_rotated` (נופלת למקור הווידאו של Arx) | מנהל מערכת, לחיצה אחת, מצב `routine` (לא `hard_cut`) | `מאשר: החלפת מפתח הגשר הראשונה` | סעיף 5 |

### 4.1 ההחלפה הראשונה - בחלון

1. גיבויים טריים (P9). רישום: מזהה המפתח הנוכחי ו-generation (בלי חומר המפתח), מצב "מצב WisKey", מצב החיבור הישיר.
2. מודיעים לבעלים ולמשתמשים: **בזמן ההחלפה פתיחת דלת מרחוק מושהית לכמה דקות** (`bridge_key_rotating`, הפקודה לא נשלחת).
   אין אף אחד שמחכה לדלת באותו זמן.
3. לחיצה אחת: `POST /system/bridge-key/rotations {mode: routine, confirm: true}` (מהמסך). לא לוחצים שוב.
4. מחכים לסוף: S1 הכנה → S2 פרסום → S3 אישור (בדיקות תחת שני המפתחות) → S4 מעבר → S5 בדיקה אחרי מעבר → S6 פרישה (בסוף חלון
   החפיפה) → S7 אימות שהמפתח הישן לא מאומת עוד. כל החלון עד 180 שניות.
5. בדיקות סעיף 5.

---

## 5. על מה מסתכלים

| מה | איפה | תקין | לא תקין → |
|---|---|---|---|
| מצב ההחלפה | `GET /system/bridge-key` (בזמן החלפה פעילה הקריאה מקדמת אותה סיבוב אחד; לא מתחילה חדשה) | `verified`; generation עלה ב-1; `direct_transport` = v2 עם ה-kid החדש | `rolled_back` (R1/R3 אוטומטי) → מתעדים, לא מנסים שוב באותו חלון; `needs_repair` → סעיף 6 |
| פתיחת דלתות | ביקורת + מסך | מושהה רק בזמן ההחלפה, חוזר אחריה | נשאר מושהה אחרי `verified` → עוצרים |
| החיבור הישיר ל-WisKey | "מצב WisKey" › "החיבור הישיר ל־WisKey"; `direct_transport.pairing_status_v2` | מחובר על v2, `pairing_status_v2` קשור ל-kid של החיבור | `bridge_key_changed`, `direct_kid_mismatch`, `pairing_ambiguous`, `bridge_pairing_changed` → עוצרים |
| כתיבות אנשים | ביקורת `transport` | עוברות בחיבור הישיר v2 | `not_sent wiskey_direct_v2_refused` → זה הסירוב הנכון (בלי נפילה לקלאסי); עוצרים ובודקים, **לא** מכבים את v2 כדי "לתקן" |
| מדיית תחנה (אם צעד 4 בוצע) | מגירת תחנה אחת, 30 שניות, וידאו בלבד | תמונה תוך כ-5 שניות; בלי `bridge_key_rotated` | `provider_forbidden` / `bridge_key_rotated` → המתג לכבוי (סעיף 6) |
| קריאות B2 / סנכרון ממוספר | לא מפעילים; רק מוודאים שהשורות לא עברו ל"חסום" | ללא שינוי | - |
| יומן HA / הגשר | יומן HA | אין שגיאות `smplwise_bridge`; אין סירובי חתימה חוזרים | סירובים חוזרים → עוצרים |
| יומן WisKey | המסך של WisKey (הבעלים) | חיבור v2 מאומת | סירובי `direct-identity.v2` → עוצרים, מעבירים ל-WisKey |
| grant ידני (manual-v3) | `service_grants/current_v3` (קריאה) | כמו לפני ההחלפה | הפך ללא אפקטיבי → **לא** מתקנים מ-Arx; הבעלים מחליט במסך של WisKey |
| 24 שעות אחרי | ביקורת, "מצב WisKey" | אין החלפה אוטומטית (`reminder_days` = 0); אין סירובים | - |

---

## 6. חזרה לאחור

**כלל יסוד:** אחרי ההחלפה הראשונה שהושלמה (`verified`) הגשר כבר רוקן את קוד הצימוד. החזרת החסימה בקוד **לא** מחזירה את WisKey
ל-v1. הדרך היחידה חזרה ל-v1 היא **צימוד מחדש**.

| מצב | מה קורה / מה עושים | אישור |
|---|---|---|
| ההחלפה נכשלת לפני המעבר (S1-S3) | R1 אוטומטי: ביטול תחת המפתח הנוכחי, המפתח הבא נזרק, הנוכחי לא נגע. אין צורך בפעולה | - |
| תוצאת ה-commit לא ידועה | R2 אוטומטי: שאילת `status`; מסיים או R1; שקט מעבר לתקרה → `needs_repair` | - |
| WisKey / הגשר דוחים את המפתח החדש אחרי המעבר | R3 אוטומטי: ביטול תחת הישן שהתקבל → חזרה; אחרת `needs_repair` (שני המפתחות נשמרים חתומים) | - |
| `needs_repair` | "המשך" (`POST .../resume`) פעם אחת; אם לא נפתר - צימוד מחדש | `מאשר: המשך החלפת מפתח` / `מאשר: צימוד מחדש` |
| מדיה v2 לא עובדת | `access.station_media_direct_v2 = off` (הספק נבנה מחדש בבקשה הבאה; זרמים פתוחים נסגרים) | `מאשר: מדיה v2 כבוי` |
| עוצרים החלפות עתידיות | `bridge.key_rotation = off` או ההגדרה החדשה `off`; מתג ההריגה `GO_LIVE_PERMITTED = False` הוא שינוי קוד | `מאשר: כיבוי החלפת מפתח` |
| חזרה מלאה ל-v1 | **צימוד מחדש**: הסרה והוספה של אינטגרציית SMPLWISE Bridge ב-HA עם קוד חדש (או ביטול חירום `POST /system/bridge-key/revoke`, שמשבית פתיחת דלתות דרך WisKey עד הצימוד). ה-fingerprint של הצימוד משתנה, ולכן grant ידני של WisKey יידרש מחדש - פעולה של בעל HA במסך של WisKey. דורש את גיבוי ה-HA של P9 | `מאשר: צימוד מחדש` |
| חזרת קוד | revert של שורת ההסרה (סעיף 3) - מונע החלפות **חדשות** בלבד | שחרור רגיל |

---

## 7. מה לא בתחום

- אין כאן החלפה בפועל, אין שינוי קוד, אין פנייה ל-WisKey.
- A2 (נדחה ל-2.53, בלי אישור עצמי), V5, grant / revoke בשם WisKey, פתיחת דלת, ממסר, דיבור או האזנה.
- החלפת מפתח היא היגיינה, לא טיפול בדליפה. חשד לדליפה = צימוד מחדש, לא החלפה.

---

## 8. שאלות פתוחות (המלצה ראשונה)

1. **צורת ההסרה.** (א) תנאי משולש - גשר 0.10.9+, עץ WisKey מזוהה כ-v2 לפי דיגסט, והגדרת בעלים מפורשת כבויה כברירת מחדל (מומלץ);
   (ב) רק גשר + עץ, בלי הגדרה; (ג) למחוק את `wiskey_present`.
2. **החלפות אוטומטיות אחרי הראשונה.** (א) `reminder_days` = 0 עד שבוע אחרי החלפה ראשונה מאומתת, ואז הבעלים בוחר מרווח (מומלץ);
   (ב) המרווח הקיים מיד.
3. **מצב ההחלפה הראשונה.** (א) `routine` עם חפיפה של שני מפתחות (מומלץ - R1/R3 זמינים); (ב) `hard_cut`.
4. **סדר צעדים 4-5.** (א) להדליק מדיה v2 לפני ההחלפה (מומלץ - מדיית התחנה לא מסורבת אפילו לרגע); (ב) אחרי, כשהחיבור הישיר כבר
   הוכח על v2.

---

## Appendix A - technical (English)

### A.1 Bridge 0.10.9 identity (P1)

sha256, both copies identical (`custom_components/smplwise_bridge/` = `smplwise_vms/integration/smplwise_bridge/`), 2.52 train head
(last bridge commit `ec104d2490bb8f87c69b4f2977c8e3547e91cec4`, BRIDGE-REPAIR-LEGACY-2520):
`native_keyset.py` `5fda54de2f2caffe78bb32d4bddce2784d607f285be48f3e6eedc500bc97d1df`,
`keyset.py` `05d6458f4fc8843121c4a6d003191d825a17724f042ceddccb4c43021bb005c4`,
`__init__.py` `4b497464e7f27a4edd02a0d3f1338d951d864428644c6908a061164856d86fe1`.
WisKey's acceptance (P2) must name these (or the released values if a later fix changes them), not `8e412b0` or `82a335a93`.

### A.2 Where the block lives

- `smplwise_vms/backend/smplwise/services/bridge_rotation.py`: `wiskey_present()` (service feed version, the component directory, the
  manual owner profile; unreadable = absent), `preflight()` order: `bridge_revoked`, `rotation_off`, `rotation_not_permitted`,
  `wiskey_present`, `peer_unavailable`, `rotation_in_progress`, `repair_required`. `GO_LIVE_PERMITTED = True` (owner O9 a, kill
  switch). `reminder_days` 0 / 30 / 90 / 180 / 365; 0 = only the first rotation.
- Tests that pin the block today: WISKEY-MEDIA-V2-2530 pins the `wiskey_present` line; the unblock row must keep a test that the
  refusal holds when any of its three conditions is missing.
- Routes: `GET /system/bridge-key` (state + `direct_transport`; drives an ACTIVE rotation one round, never starts one),
  `PUT /system/bridge-key/settings`, `POST /system/bridge-key/rotations` (`bridge.key.rotate`, system administrator, `{mode, confirm}`),
  `POST /system/bridge-key/rotations/{id}/resume`, `POST /system/bridge-key/revoke` (`wiskey_acknowledged` required while WisKey is
  installed). Local sessions only.

### A.3 Media v2 gate (WISKEY-MEDIA-V2-2530)

`wiskey_media_v2.enabled(conn)` = `access.station_media_direct_v2 == "on"` AND `bridge.integration_version >= 0.10.9`. Closed gate =
the v1 code byte for byte. Open gate + rotated key: `DirectApiTransport(..., opener_v2=websocket_opener(settings, version=2))`; the HA
path is `_V1OnlyFallback` (a rotated key never opens it). No fallback to v1 or HA after a v2 refusal; unknown outcome never re-sent
(`media_outcome_unknown`). Switching the gate rebuilds the provider and closes leased streams. `PATCH /settings`: system administrator
only, `409 bridge_outdated` below 0.10.9, audited.

### A.4 No-fallback rule (P4)

WisKey rc19 / rc20 R2 `transports.selection`: never downgrade or switch transport automatically after a refusal or UNKNOWN;
`transport_authentication.fallback_after_key_refusal: false`. Covered in Arx by WISKEY-NOFALLBACK-FIX-2520 (people routes, discovery
self-healing; 2.52) and WISKEY-NOFALLBACK-2-2530 (`SelectingLeaseTransport._pick`, `access_service_writer.select_path`; 2.53, branch
`pilot/WISKEY-NOFALLBACK-2-2530`). Both dormant until a rotated key exists - that is, until this plan runs.

### A.5 Evidence to keep (redacted)

Rotation history rows (states, steps, codes, times; never key material, salts, proofs, nonces, signatures), the before / after key id
and generation, the `direct_transport` block, the audit codes of the first 24 h, WisKey's acceptance document (hashes and test names).
Private copies in `private-evidence/bridge-rotation-2540/`; the repository gets the PASS / FAIL table only.
