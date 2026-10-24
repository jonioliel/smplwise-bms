# תשובת Arx לקליטת WisKey direct סבב 4 (24.10.2026)

מענה לפי `ARX_RESPONSE_TEMPLATE.json` ולפרומפט `FORWARD_TO_ARX_AFTER_WINDOWS_ROUND4_HE.txt` (קומיט מסירה `3707f97fb337c44c7643378b5b0060279f4b6cc9`).
**כלל המסמך:** כל מה שמופיע כ"נבדק" נבדק מול דמות (fake) שנכתבה מהחוזים והווקטורים שפרסמתם, או מול קבצי SQLite אמיתיים בלבד. **שום דבר לא הורץ מול WisKey אמיתי, HA, תחנה, go2rtc, שמע, דלת או התקנה של הבעלים.** אין "מותקן" ואין "חי". לא נעשה merge ל-main ולא תיוג. כל ענף מבוסס על main (v2.15.0, `16bc3926b`) או על `pilot/W10CLIENT-295` כמצוין.

## ענפים וקומיטים (full SHA)

| יחידה | ענף | full SHA | בסיס |
|---|---|---|---|
| תעבורה ישירה + W10 + זמן שיחה (Q01, Q06, Q03 קבלות) | `pilot/WKDIRECT-295` | `9135a048c4ea605eaaa212dd42f4475580edca75` | `pilot/W10CLIENT-295` @ `093a50fc97fa2d9fd6a267ed9978a1ba88418b28` |
| כתיבת אנשים + name_ref + מפת אימוץ (Q02, Q08) | `pilot/WKWRITE-295` | `66eec12c2a87f8e574f5d1cd37b6c9d8e0bec2e2` | main `16bc3926b` |
| capture, features, חירום ואש, תבניות (Q04, Q05, Q07) | `pilot/WKCAP-295` | `4a68d92ce8b36363f45a2ed3950a716cf04a52c1` | main `16bc3926b` |
| Q03 + קוראי WhatsApp (כבר נמסר) | `pilot/WKB3-295` | `b01cb96918469befef37bf9ee959bd619ec41c64` (Q03 בקומיט האב `61fa2ce000432dc297e6b285146a1aeeccd84a51`) | main `16bc3926b` |

אין צורך בבקשת מקור נוספת: ארבעת הענפים נמצאים במאגר הפרטי (origin) ובעותקי העבודה `C:\cloude\wt-wkdirect`, `C:\cloude\wt-wkwrite`, `C:\cloude\wt-wkcap`, `C:\cloude\wt-wkb3`. מועמד משולב אחד (איחוד ארבעת הענפים + מתאמי תעבורה) **טרם נבנה**; ראו "מה נשאר".

## Q01 / transport (פריטים 1-4)
- **מומש:** `DirectApiTransport` / `DirectLink` ב-`smplwise/services/wiskey_media_bridge.py` (במקום ה-placeholder); `sign_connect`, `open_reply`, `read_identity`. חיבור ל-`GET /api/hikvision_intercom/arx_bridge/v1/ws` בלי טוקן, בלי משתמש HA/admin/panel; אחרי hello נחתם `direct/connect` על ה-challenge במעטפת `wiskey-direct-connect.v1` עם `query_owner_id="pairing"`; מאומצים service identity, `repository_id`, `connection_ref` מהשרת (המזהה `arx-service:<entry>` אינו משתמש HA).
- **אימות כל reply:** מעטפה, `connection_ref` שווה ל-challenge, ו-HMAC נבדקים לפני פירוש; frame אחד פגום סוגר את החיבור, בקשות פתוחות הופכות ל-`unknown` ללא retry. קורלציית id/operation, ids עולים מ-2, `talk_closed` רק על ה-id של `talk_open`. reconnect = socket + challenge חדשים, בלי אימוץ session/talk/carrier ישנים.
- **וקטור חתימה:** `DIRECT_SIGNING_TEST_VECTOR.json` משוחזר בית-בבית (canonical bytes, SHA256, preimage, HMAC, אובייקט שלם). ה-timestamps ההיסטוריים אינם בקשה טרייה.
- **בחירת תעבורה בזמן ריצה (`AutoTransport`):** ב-`auto` ישיר אם המפתח חותם והשקע מאומת, אחרת מסלול HA-WS החתום הקיים. אחרי כשל ישיר ממתינים 60 שניות; חיבור פתוח לא עובר תעבורה; בלי מפתח שמיש אף מסלול לא נוסה. מקור WisKey (`direct_bridge_api.py`, `direct_bridge_origin.py` ב-d2579588) נקרא לקריאה בלבד לאישור החוט; שרת הדמה נכתב מהחוזה.
- **registered / wired:** wired לשכבת המדיה (`provider_for(auto)`); **לא** נבחר/מותקן אצל הבעלים. **installed:** לא. **live:** לא.
- **קבלות:** `private/planning/wk_round4_receipts/wkdirect/9135a048c/` (stdout/stderr/JUnit/SUMMARY). `tests/test_wkdirect_295.py`: 53 passed, exit 0. שכנים (`test_wiskey_media_v11`, `test_wiskey_channels`, `test_wiskey_contract`, `test_intercom_media`, `test_fake_wiskey`, `test_remote_mic_policy`, `test_eccact_readback_295`, `test_wa_pacing_coverage_295`, `test_ui_settings`): 287 passed, 2 skipped, exit 0 (שני ה-skip ב-`test_wiskey_channels.py`, ערוצים חדשים מהקטלוג הננעץ; היו לפני השינוי). frontend `tsc --noEmit` exit 0; 24 בדיקות יחידה עברו.
- **פריט 4 (42 המשפחות):** `docs/changes/WKWRITE-295-ADOPTION-MAP.md` ב-`pilot/WKWRITE-295`: 275 פקודות; 15 מחוברות כאן מול דמות; 50 עם קורא קיים בנתיב HA הישן וטרם מחוברות ישיר; 203 נשארות; 5 aliases של W10; 2 (`jobs/approval_decide`, `jobs/approval_request`) מוחרגות בידי הבעלים. לא נבנה SDK/registry/תור חלופי.
- **תלות מדויקת שנותרה:** ריצה של הלקוח מול שרת ה-direct האמיתי שלכם או הסימולציה שלכם; בחירת `auto` עדיין נשענת על גילוי הפיד (`overview.api.commands` דרך ערוץ השירות), לא על `peer_identity/get` ישיר.

## Q06 / W10 (פריטים 5-7)
- **S6 נסגר:** הוסרו `intercom_sync.media_post`, `_media_hook` (3 אתרי קריאה), ערוץ `media` ו-`wiskey_channels.MEDIA`, `WiskeyProvider`/`SyncTransport`/`WiskeyTalkChannel` הלא-חתומים ושש פונקציות השליחה הלא-חתומות. אין נתיב feed לא חתום שניתן לבחור בו. `tests/test_wiskey_media_provider.py` נמחק (בדק רק את הספק שהוסר) ומקרי הבחירה/fallback/S18 הועברו ל-direct.
- וידאו משותף כ-`Arx`; חיבור נפרד לכל שיחה כמפעיל; שש פקודות חתומות; floor ראשון; seq מ-0; batch של 5 או 10 (ברירת מחדל 5: ב-10 בקצב זמן אמיתי אין שוליים בדלי הקרדיט שלכם; הדמה סירבה `rate_limited`); ACK; heartbeat כל 5 שניות; מקור go2rtc פרטי בזיכרון.
- **זמן שיחה:** נקרא `station_media_max_talk_seconds` מה-descriptor כמספר שלם מדויק 1..86400; ערך אחר = ה-descriptor לא מציע שיחה (וידאו לא נפגע). ההגדרה `access.station_media_max_talk_s` תקפה 1..86400 (ברירת מחדל 300, קודם 10..900); השיחה אורכת את הקטן מההגדרה ומערך התחנה. נוספה שורת "משך דיבור מרבי" (שניות) במסך הגדרות תצוגת התחנה, רק במצב "וידאו ושיחה"; ערכים מחוץ לטווח לא נשמרים.
- **מדידות המקור בסימולציה (זמן מוקטן פי 10, מוצג בשניות מדומות):**

| מקרה | שרת (דמה) | אירוע ללקוח | lock/journal | לקוח |
|---|---|---|---|---|
| TTL10 בלי heartbeat | `access_lost` ב-10.15s | אין | נוקו | לא מקבל הודעה; הבקשה הבאה נדחית `session_expired`, נשלחת פעם אחת, בלי retry |
| TTL15 בלי heartbeat | `idle_timeout` ב-12.03s | אירוע חתום התקבל | נוקו | השיחה נסגרת ב-`idle_timeout` |
| TTL10/15 עם heartbeat 5s, 30s | אין סגירה | אין | נשמרו | חי; 5 heartbeats |

  ה-10.15s/12.03s הם מתזמני הדמה שלנו, לא ה-10.10s/12.14s שמדדתם. batch שהוכנס לתור לפני ה-release יוצא שלם ואז ה-floor משתחרר; פריים מאוחר יותר = `floor_not_held`. לא נוסף gate חדש.
- **לא הוכח:** כל האמור מול הציוד האמיתי: codec, ערוץ 102, שימוש במקביל Arx ופאנל, מיקרופון ורמקול. S7/S8 (בדיקה חיה, preflight התקנה) **לא** בוצעו; צריכים סשן משותף עם הבעלים.
- **סיכון ידוע:** תקציב nonce. שיחה אחת ב-batch של 5 שולחת כ-10 בקשות חתומות בשנייה (כ-1200 ב-120s) מול חלון 4096; שלוש שיחות במקביל קרובות לתקרה. ראו בקשה 5 ב-`PROMPT_TO_WISKEY_ARX_REQUESTS_2026-10-24_HE.txt`.

## Q02 / כתיבת אנשים (פריטים 8-9)
- **מומש:** `smplwise/services/wiskey_native_write.py` (`NativePeopleWriter`) ו-`wiskey_write_lineage.py` (חנות הכוונות). סדר: קריאת `peer_writes/source_v1` ובדיקה קפדנית של epoch/write binding/`query_owner_id` כפי שהוחזרו (לא ממציאים); בניית descriptor מ-RBAC טרי; **COMMIT מוצפן של original7 המלא לפני שליחה**; 9 פקודות CRUD/cards עם פרמטרים מקוריים + `actor` + `peer_write`; קבלת 16 שדות חייבת לחזור על original7 השמור בית-בבית; `users/delete` נושא את הרוויזיה האחרונה בפועל, וקבלה עם רוויזיה מאוחרת יותר נדחית; תשובה שאבדה נפתרת ב-`peer_bindings/get` + `peer_receipts/resolve` עם original7 השמור, ואם ה-intent חסר או לא קריא הכתיבה נשארת UNKNOWN בלי שליחה. שגיאת WisKey נחשבת סירוב נקי רק בקודים שהמקור מעלה לפני commit האדם.
- **חנות הכוונות:** קובץ SQLite נפרד (`<data>/wiskey_lineage/lineage.sqlite3`), מחוץ למסד הראשי; ארכיוני Arx לא מייצאים ולא משחזרים אותו, ו-`backup_exclude: ["wiskey_lineage/*"]` ב-`config.yaml` מוציא אותו מגיבוי התוסף (**שינוי התנהגות גיבוי ביציאה**). כותב יחיד לכל repository + service owner בחכירה של 30 שניות עם מספר fence; כותב שאיבד scope נדחה לפני כל I/O; כתיבה אחת בו זמנית לאדם; origin של create משמש פעם אחת. הצפנת AES-GCM עם מפתח ההתקנה; מחיקה 30 יום אחרי סיום הפעולה (UNKNOWN פתוח נשמר עד פתרון או סגירת מנהל); שורות הוכחה append-only; `handoff_export`. עוגן במסד הראשי (`SETTINGS_KEEP`) מזהה שחזור (כוונות פתוחות הופכות UNKNOWN, fences עולים) או עותק lineage ישן/חסר (כתיבות חדשות נחסמות עד `reinitialise` של מנהל).
- **UNKNOWN לעולם לא נשלח שוב:** השליחה אפשרית רק ממצב `intent`.
- **שלושת חלונות הקריסה** (לפני send; אחרי send בלי ACK ו-WisKey לא כתב; אחרי ש-WisKey כתב אדם+קבלה בלי ACK), כל אחד נבדק פעמיים: (א) סימולציה - חריגה בתהליך בין צעדי תעבורה מדומה; (ב) יציאה אמיתית של תהליך ילד (`os._exit(137)`) מול דמה מבוססת קובץ. **זה אינו שרת Arx, אינו התעבורה האמיתית ואינו WisKey, ואינו מכסה הפסקת חשמל.**
- **בדיקות:** `test_wkwrite_295.py` + `test_wkwrite_295_crash.py`: 35 passed, exit 0; 12 קבצי שכנים: 458 passed, exit 0 (הרצה לפני תיקון אחרון קטן - "כותב שנדחה בין commit ל-send רושם `not_sent`" - שנמצא בשני קבצי ההרצה הראשונה שנבדקו שוב). הקצרות: ההגדרה השקטה אינה מדפיסה שורת סיכום; הספירה מנקודות ההתקדמות.
- **תלות מדויקת שנותרה:** חיבור `WiskeyCommandPort` לתעבורת `pilot/WKDIRECT-295`; חיבור נתיבי הכתיבה הקיימים (`routers/access_control.py`, `access_control_writes.py`, `services/access_grant_engine.py`) ל-`NativePeopleWriter`; מסך מנהל ל-`close_unknown`/`reinitialise` ומחיקה מתוזמנת. שאלה פתוחה אליכם: האם `backups/apply` שלכם צריך לסמן גם כוונות פתוחות של Arx כ-UNKNOWN (לא נבנה).
- **ממשק התעבורה (`smplwise/services/wiskey_command_port.py`):** `async send_signed(command, parameters, *, operation_id) -> result`; `WiskeyCommandError(code, outcome ∈ {not_sent, refused, unknown})`; `PEER_QUERY_COMMANDS = {peer_bindings/get, peer_bindings/history, peer_protocol/get, peer_receipts/resolve}` במעטפת `wiskey-peer-query.v1`, כל השאר `wiskey-bridge-command.v1`; התעבורה מחזירה `result` רק אחרי אימות MAC וקורלציה; `not_sent` רק כשאף בית של ה-frame לא נכתב; `refused` רק ל-error frame מאומת; `unknown` לכל השאר; בלי retry; name_ref prepare/apply על אותו חיבור.

## Q08 / name_ref ו-bulk_receipt (פריט 16)
- `rename` שומר ב-intent רק bindings; השם הגולמי מופיע רק בפרמטרי `users/name_ref_prepare_v1`. prepare שנכשל = `not_sent`; ACK של apply נבדק בדיוק; apply שאבד נפתר ב-`users/bulk_receipt {operation_id}` **בלי שדה `actor`** (אותו actor pairing); `operation_not_found` נשאר UNKNOWN.
- **בדיקת דליפה:** ערכי סימון מושתלים (שם, קוד כניסה, כרטיס) נמצאו רק במה שה-fake קיבל, ולא בלוגים, audit, intents, proofs, originals מפוענחים, descriptors, מטא-נתוני `peer_write`, בקשות resolve, ה-handoff export ובבתים הגולמיים של קובצי lineage והמסד הראשי.
- background/CSV/workflows/search/renewal: לא חוברו כאן; מפורטים במפת האימוץ.

## Q04 / capture ו-features (פריטים 10-11)
- **capture:** `wiskey_capture_direct.py` - `DirectLeaseTransport` מתחבר לנקודת ה-`lease_events.TRANSPORT` הקיימת (worker ה-lease, נתיבי capture, סוקר הסטטוס). `capture/lease_event` ו-`capture/lease_request` נשלחים עם `{signed_message_json: <הטקסט המקורי>}` בלבד (עד 8192 בתים); בלי kid/digest/runtime_data חדשים, בלי await ל-registrar הסינכרוני, בלי retry. קודי `wiskey_direct_not_connected` ו-`capture_source_unavailable` נוספו ל-`_NOT_SENT_CODES`; timeout או `capture_outcome_unknown` נשארים UNKNOWN. RBAC/scope/ledger מהמודולים האמיתיים של Arx (`_lease_redecide`, `intercom_authority.Authority`, `capture_lease`), בלי מקור חסר.
- **ששת ה-features:** `wiskey_feature_direct.py` - snapshot מדיניות של 18 שדות מ-`resolve_policy` (RBAC + relay map); `DirectFeatureClient`: start/result/cancel/status/prepare_media; intent נרשם לפני I/O ו-UNKNOWN לא נשלח שוב; קריאת completion דרך `features/result` עם `operation_ref` בלבד, בלי חידוש הרשאת ביצוע, וסירוב host לקריאה לא מכריע דבר; `cleanup_joined` מדווח תמיד `no_effect=False`; מדיה רק בנתיב `arx_bridge/v1/media/{ticket}` עם `X-WisKey-Bridge`, כרטיס חד-פעמי. `build_request` מתיר כעת actor אוטומציה ל-`emergency_buttons` (התאמה ל-parser שלכם).
- **מקור חסר מדויק:** rows של people/CSV (`source_line`, `revision`, `origin_ref`, `change_digest`) - אין ל-Arx producer; הם מסופקים ע"י הקורא, ובקשת `people_csv` בלעדיהם נדחית.
- **ממשק (`smplwise/services/wiskey_capture_port.py`):** `WiskeyDirectPort` סינכרוני: `identity()` (entry id, `query_owner_id`, `repository_id`, `connection_ref`); `call(command, parameters, *, timeout_s)` מחזיר `result` או זורק `PortError(code, "not_sent"|"refused"|"unknown")`; `media_ingress_header(*, ticket, preparation_ref)`; `open_media(*, path, headers, timeout_s)`. נדרש מתאם אחד לכל אחד מארבעת החברים אל התעבורה של `pilot/WKDIRECT-295`.
- **בדיקות:** `tests/test_wkcap_295.py`: 42 passed; הרצה רחבה של הקובץ + 11 קבצי שכנים (door emergency, capture lease, lease port/wire, WhatsApp template send, channels, intents, מיגרציות) - exit 0 (ספירת עוברים לא נשמרה לשכנים). לא הורץ מול שום מערכת אמיתית.

## Q07 / חירום ואש (פריט 12)
- `wiskey_emergency_direct.py` - `DirectEmergencyEngine` ל-`wiskey-emergency-event.v2`: ניסיון OPEN חדש אחרי UNKNOWN על אותו fence עם Request ו-operation_id חדשים ו-`retry_of` לישן, בלי לשנות את הישן, בלי retry לניסיון חי; release עמיד גובר על כל apply/retry ישן; `lock_secure` = `not_implemented` ל-apply ול-release (אין LOCK כ-alias); אין people replay. מיגרציה לא נוספה (שרשרת הניסיונות משתמשת ב-`wiskey_feature_intents` הקיים). לא שונה אף מתג: `DW09_OPEN_RETRY_AFTER_UNKNOWN` ויתר המתגים נשארו (החלפת הראשון = החלטת קבוע אחד של הבעלים). לא הוחזרה אף יכולת ל-OFF.
- **מקור חסר מדויק:** lineage האוטומציה של האש (`automation_id`, `run_id`, `trigger_id`, creator, approver, grant_revision) אין לו producer ב-Arx; `door_emergency` מסרב היום לפועלים שאינם אדם, ונקודת ההתחברות היא ה-`ContextResolver`. ראיות source/current/ACK-loss הן **סימולציה בלבד**.

## Q05 / WhatsApp (פריטים 13-14)
- **מיקום הסמלים:** אף אחד מששת השמות לא קיים בקוד Arx (חיפוש בכל עצי העבודה ב-`C:\cloude` ו-`git grep` על ראשי ענפים מקומיים ומרוחקים: הם מופיעים רק בתיעוד Arx - `CR-W11TPL-295.md`, `TPLWIRE-295.md`). הם בקוד שלכם בקומיט `d2579588` ב-`custom_components/hikvision_intercom/`: `whatsapp_cloud_templates.py` (`ApprovedTextTemplate` שורה 325, `CloudTemplateProvider` שורה 366), `whatsapp_pacing_queue.py` (`PacingQueue` שורה 446), `whatsapp_pacing_runtime.py` (`HostPacingPort` שורה 498), `access/pin_quarantine.py` (`NativePinDeliveryPolicy` שורה 274), `whatsapp_template_composition.py` (`install_native_template_composition` שורה 127). חיפוש `git log --all -S` בהיסטוריה לא החזיר פלט, ואיננו מתייחסים אליו כשלילי נקי.
- **ה-callsite החסר:** שום קוד במוצר WisKey אינו קורא ל-`install_native_template_composition` ואינו בונה את הספק, התבניות ומדיניות ה-PIN. **ה-installer הפרטי המקורי שלכם בתוך HA הוא זה שצריך להשלים אותו** על המשאבים המוגדרים בפועל; Arx לא תבנה תור/ספק/ledger חלופי ולא תמציא consent.
- **מה חובר:** `wiskey_template_direct.py` - `DirectTemplateTransport.send_template` שולח `whatsapp/template_send_v1` עם `request.wire()` ללא שינוי; כל שגיאה זורקת, והשולח מטפל בה כ-UNKNOWN; יש גם `send_v2` סגור. ההצטרפות ל-WKB3: להתקין את `DirectTemplateTransport` במקום שבו `wa_template_send` של `pilot/WKB3-295` מצפה ל-`TemplateTransport`. ה-WKB3 לא מוזג.

## Q03 / קבלות מקוריות (פריט 15)
על `origin/pilot/WKB3-295` @ `b01cb96918469befef37bf9ee959bd619ec41c64` (עץ עבודה מנותק נפרד, הענף לא שונה), כל ההרצות exit 0, stderr ריק: `test_wkb3_295` 20, `test_eccact_readback_295` 17, `test_stationperm_295` 31, `test_wkpeer_295` 158, `test_wa_template_send_w11` 88, `test_wa_pacing_coverage_295` 39. בדיקות הענף לא מאשרות ישירות שה-aggregate של orphan C הוא True (רק "לא False"), ולכן הורץ בדק לקריאה בלבד `q03_probe.py` (exit 0): pureAB → A=False, aggregate=True; orphan C → A=None, C=True, aggregate=True. קבלות: `private/planning/wk_round4_receipts/wkb3/` (stdout/stderr של ששת הקבצים, SUMMARY.txt, `q03_probe.py` ופלטו).

## מה נשאר
**אצל Arx (עבודה עצמאית, ממשיכה):**
1. בניית מועמד משולב אחד: איחוד `WKDIRECT` + `WKWRITE` + `WKCAP` + `WKB3`, ומתאם תעבורה אחד לכל אחד משני הפורטים (`WiskeyCommandPort`, `WiskeyDirectPort`) אל `DirectApiTransport`; אחרי זה גייט אוטומטי רגיל. ענף השילוב יימסר עם delta מדויק וקבלות חדשות על הקומיט המשולב (לא ישויכו אליו תוצאות של הענפים הנפרדים).
2. חיבור נתיבי הכתיבה הקיימים ל-`NativePeopleWriter` ופתיחת lineage אחד לכל תהליך עם `recover(scope)`.
3. 203 הפקודות שנותרו במפת האימוץ.
4. מסך מנהל ל-`close_unknown` / `reinitialise`.

**מה שדורש מכם (תלות נקודתית, לפי `PROMPT_TO_WISKEY_ARX_REQUESTS_2026-10-24_HE.txt`):** סימולטור שרת ישיר להרצה מקומית, `direct/capabilities`, `operation/status`, מחלקת תוצאה בקטלוג השגיאות, גודל חלון nonce, סיבוב מפתח (`kid`), תהליך pairing בצד הבעלים, cursor ל-event stream, הקוד הפרטי של ה-installer של WhatsApp, SHA של adapter החירום, מבדק לקובץ התשובה, ותכנון הסשן המשותף במעבדה.

**אצל הבעלים / סשן משותף:** כל פעולה על דלת, מיקרופון, רמקול, ובחירת `auto` בהתקנה; וכן החלטת הקבוע `DW09_OPEN_RETRY_AFTER_UNKNOWN`.

**מה שלא נטען:** אין טענת התקנה, חיוּת, או "ירוק" כולל. אין סך PASS משותף. כל RESULT נשאר על ה-CODE של הענף שלו.

## קבלות (מיקום)
`C:\cloude\smplwisebms\private\planning\wk_round4_receipts\wkdirect\9135a048c\` (stdout, stderr, JUnit, SUMMARY.txt, tsc ויחידות frontend) · `...\wkb3\` · לכל ענף: `docs/changes/WKDIRECT-295-DIRECT-TRANSPORT.md`, `WKWRITE-295-NATIVE-WRITE.md`, `WKWRITE-295-ADOPTION-MAP.md`, `WKCAP-295-CAPTURE-FEATURES-EMERGENCY.md`. הערה: שורות ה-trailer בקומיטים של הענפים מציינות את המודל שביצע בפועל (Claude Opus 5.5 / Sonnet 5.5) ולא את כתוב ב-CLAUDE.md; ללא השפעה על התוכן.
