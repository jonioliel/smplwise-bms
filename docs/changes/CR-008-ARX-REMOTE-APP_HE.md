Source: docs/changes/CR-008-ARX-REMOTE-APP.md @ 0fc8e647a04f5bc4d03a7a8c3833b800775c80a3

> תרגום של `docs/changes/CR-008-ARX-REMOTE-APP.md`; המקור באנגלית קובע במקרה של סתירה.

# CR-008 — גישה מרחוק ל-SmplWise Arx: `https://<site>/arx` עם מסך התחברות משלנו, ואחר כך אפליקציה להתקנה

**מספור:** נרשם כ-CR-008 ב-29.09.2026 (שלב 2 של WisKey ב-CR-005, הוויזואלים התלת-ממדיים ב-CR-006 ובקרת ההתקנים
ב-CR-007 בתהליך). כרטיס משימה: T092 (דרישות R184-R186, בדיקות קבלה AT184-AT186).

**סטטוס:** מוצע - רשומת תכנון, עדיין בלי קוד מוצר. הבעלים ביקש סביבה עובדת היום ואת התוכנית המלאה אחר כך; §4 הוא
המסלול המהיר, §5 השלבים, §6 ההחלטות שרק הבעלים יכול לקבל. דבר כאן אינו משנה את חוזה הזהות
(`docs/security/HA_IDENTITY_RBAC_HE.md`) עד שהבעלים יאשר: ה-CR הזה *מוסיף* ערוץ כניסה שני, מאומת בצד השרת, לצד
Ingress (§3b), ורושם זאת כתיקון מוצע ל-§4 שלו.

## 1. הבקשה (הבעלים, 29.09.2026)

המוצר משנה את שמו ל-**SmplWise Arx**. אצל כל לקוח HA כבר חשוף דרך תוסף Cloudflared (brenner-tobias) בשם מארח כמו
`ecc.smplwise.com`. הבעלים רוצה ש-`https://ecc.smplwise.com/arx` יפתח **רק את המערכת שלנו** (לא את ממשק HA), עם
**מסך התחברות מעוצב משלנו** שמקבל שם משתמש וסיסמה של HA, ובהמשך **אפליקציה** (כמו אפליקציית Companion של HA) עם
התראות ועוד. Cloudflare Tunnel כבר מעביר אצלו את איתות ה-WebRTC (האינטרקום של WisKey) בלי בעיה - המדיה עצמה עוברת
ישירות ב-UDP. הוא רוצה סביבה עובדת **היום** (המסלול המהיר) ואת התוכנית המלאה אחר כך.

## 2. עובדות שנלמדו (מקורות שנקראו ב-29.09.2026)

### 2.1 תוסף Cloudflared

מקורות: `https://github.com/brenner-tobias/ha-addons/tree/main/cloudflared` (DOCS.md, config.yaml); ה-`config.yaml`
של התוסף מפנה היום ל-`https://github.com/homeassistant-apps/app-cloudflared` (גרסה 7.0.17), שבו
`cloudflared/rootfs/etc/s6-overlay/s6-rc.d/prepare/run.sh` בונה את תצורת המנהרה.

- **שני מצבים.**
  - *ניהול מקומי (options):* `external_hostname`, `additional_hosts`, `catch_all_service`, `nginx_proxy_manager`,
    `tunnel_name`. הסקריפט כותב `/tmp/config.json` כרשימת ingress בסדר הזה: כלל ה-`external_hostname`
    (`service: <http|https>://homeassistant:<port>`, הפורט וה-TLS נקראים מהגדרות ה-http של HA) → כל רשומת
    `additional_hosts` → `catch_all_service` / NPM (`http://a0d7b954-nginxproxymanager:80`) → `http_status:404` הסופי.
  - *ניהול מרחוק:* לפי התיעוד, כש-`tunnel_token` מוגדר כל שאר התצורה מתעלמת, וכל שינוי נעשה בלוח הבקרה של
    Cloudflare. הסקריפט רושם ביומן "Using Cloudflare Remote Management Tunnel" ומריץ את הטוקן כמו שהוא.
- **ניתוב לפי נתיב אינו אפשרי במצב options.** סכמת רשומה ב-`additional_hosts` היא בדיוק `hostname: str`,
  `service: str`, `disableChunkedEncoding: bool?` - אין מפתח `path`, והסקריפט לעולם לא כותב אחד. וגם אילו אפשר היה
  להכניס כלל נתיב, הכלל הפשוט של `external_hostname` לאותו שם מארח נכתב ראשון ו-cloudflared לוקח את הכלל התואם
  הראשון, כך שכלל `/arx` מאוחר יותר על `ecc.smplwise.com` לעולם לא יתאים. **מסקנה: `ecc.smplwise.com/arx/*` → התוסף
  שלנו דורש מנהרה בניהול מרחוק (`tunnel_token`) עם מסלול נתיב בלוח הבקרה של Cloudflare.** מצב options יכול לתת רק
  *שם מארח נפרד* (`additional_hosts: [{hostname: arx-ecc.smplwise.com, service: http://0b8c26d5-smplwise-vms:8099}]`),
  שמאבד את תכונות אותו-מקור ש-§3 נשען עליהן (החלטה D1).
- **משמעות הנתיב (תיעוד Cloudflare).** מסלולי Published application מקבלים Subdomain, Domain, **Path** אופציונלי
  ו-Service URL (לוח הבקרה: Networking → Tunnels → המנהרה → Routes → Add route → Published application). הנתיב הוא
  ביטוי רגולרי בתחביר Go. ציון נתיב מנתב בקשות תואמות לשירות אבל אינו מסיר או משכתב את הנתיב - השירות מקבל את
  הנתיב המלא. כללי ingress נבדקים מלמעלה למטה והתאמה ראשונה מנצחת
  (`developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/`,
  `.../do-more-with-tunnels/local-management/configuration-file/`). לכן התוסף שלנו מקבל `/arx/...` בלי שינוי.
- **איך המנהרה מגיעה לתוסף שלנו.** תוסף Cloudflared אינו `host_network`; הוא יושב ברשת הפנימית `hassio` של
  ה-Supervisor כמו כל תוסף אחר, וכבר פונה ל-HA כ-`homeassistant:<port>` ול-NPM כ-`a0d7b954-nginxproxymanager:80`.
  תיעוד המפתחים של HA: רשת פנימית שמאפשרת תקשורת עם כל תוסף לפי שמו או כינויו, בתבנית `{REPO}_{SLUG}` כש-`_` מוחלף
  ב-`-` (`developers.home-assistant.io/docs/add-ons/communication/`). ה-slug שלנו ממאגר GitHub הוא
  `0b8c26d5_smplwise_vms` (`smplwise_vms/DOCS.md`), ולכן **כתובת השירות הפנימית היא
  `http://0b8c26d5-smplwise-vms:8099`** (עותק שנבנה מקומית יהיה `http://local-smplwise-vms:8099`; עמוד ה-Info של
  התוסף מציג את שם המארח). ה-uvicorn שלנו כבר מאזין על `0.0.0.0:8099` (`Dockerfile`: `SW_HOST=0.0.0.0`), ולכן **אין
  צורך במיפוי `ports:`** - `ports:` רק מפרסם לרשת ה-LAN של המארח, ואת זה אנחנו עדיין לא רוצים.
- **הגדרות ה-proxy של HA כבר מכסות אותנו.** התוסף דורש ב-`http` של HA "Trust X-Forwarded-For" עם proxy מהימן
  `172.30.33.0/24` - טווח הכתובות של התוספים, שמכיל גם את התוסף שלנו וגם את cloudflared (משמש ב-§3b.6).
- **מה המנהרה עושה לזהות היום.** בקשות שמגיעות דרך cloudflared באות מכתובת התוסף שלו (`172.30.33.x`), אף פעם לא
  מ-proxy ה-Ingress `172.30.32.2`. `auth.resolve_principal` סומך על `X-Remote-User-*` רק מ-`settings.trusted_proxies`
  (ברירת מחדל `172.30.32.2`), ולכן בקשה מהמנהרה נדחית היום עם `untrusted_origin` גם אם היא נושאת כותרות מזויפות.
  התכונה הזו חייבת לשרוד את ה-CR הזה (§3e).

### 2.2 אימות Home Assistant ללקוח Web צד שלישי

מקורות: `developers.home-assistant.io/docs/auth_api/`; ליבת HA `homeassistant/components/auth/{__init__,login_flow,indieauth}.py`,
`homeassistant/auth/const.py`, `homeassistant/auth/providers/__init__.py`, `homeassistant/components/http/{__init__,ban}.py`;
ה-frontend של HA `src/data/auth.ts`, `src/common/auth/token_storage.ts`, `src/entrypoints/core.ts`,
`src/entrypoints/service-worker.ts`; `home-assistant-js-websocket/lib/auth.ts`.

- **client_id.** חייב להיות כתובת http(s) עם נתיב. `verify_redirect_uri` מקבל `redirect_uri` עם אותה סכמה ואותו
  מארח כמו ה-`client_id` בלי להביא שום דבר. לכן Arx משתמש ב-`client_id = https://ecc.smplwise.com/arx/`
  וב-`redirect_uri = https://ecc.smplwise.com/arx/?auth_callback=1`. אפליקציות Companion מטופלות כמקרה מיוחד
  (`https://home-assistant.io/iOS|android` + `homeassistant://auth-callback`).
- **תהליך ההתחברות (מה שדף ההתחברות של HA עצמו עושה, `src/data/auth.ts`):**
  1. `GET /auth/providers` - בוחרים את הספק מסוג `homeassistant` (מאגר המשתמשים של HA).
  2. `POST /auth/login_flow` `{client_id, handler: ["homeassistant", null], redirect_uri, code_challenge,
     code_challenge_method: "S256"}` → `{type: "form", flow_id, step_id: "init", data_schema: [username, password]}`.
     HA מצמיד את התהליך לכתובת ה-IP של הפונה (שינוי IP מבטל אותו).
  3. `POST /auth/login_flow/{flow_id}` `{client_id, username, password}` → אחת מאלה: אותו טופס עם
     `errors.base = "invalid_auth"`; `step_id: "select_mfa_module"` או `"mfa"` (שדה `code`; קוד שגוי →
     `invalid_code`; אחרי מגבלת הניסיונות של המודול התהליך מבוטל עם `too_many_retry`); ביטול; או
     `{type: "create_entry", result: "<קוד הרשאה>"}`.
  4. `POST /auth/token` (form-encoded) `grant_type=authorization_code&code=…&client_id=…&code_verifier=…` →
     `{access_token, expires_in: 1800, refresh_token, token_type: "Bearer", ha_auth_provider}`.
  5. רענון: `grant_type=refresh_token&refresh_token=…&client_id=…` - HA מסרב כשה-`client_id` שונה מזה שה-refresh
     token הונפק אליו. ביטול: `action=revoke&token=<refresh token>` (תמיד 200).
  - תוקף (`auth/const.py`): access token 30 דקות, סשן MFA 5 דקות, refresh token 90 יום מהשימוש האחרון.
  - המשתמש רואה כל לקוח ב-*פרופיל → אבטחה → Refresh tokens* ויכול למחוק אותו שם (טלפון שאבד).
- **אימות טוקן בצד השרת.** ה-WebSocket API (`/api/websocket`: `auth_required` → `{type: auth, access_token}` →
  `auth_ok`) ואחריו `auth/current_user` מחזיר `id, name, is_owner, is_admin, credentials, mfa_modules` - **בלי שם
  משתמש**; בקטלוג `ha_users` שלנו (מיגרציה 0004) יש את שם המשתמש ואת `is_active`. ה-proxy של ה-Supervisor
  `http://supervisor/core` מאמת את ה-`SUPERVISOR_TOKEN` *של התוסף*, לא טוקן של משתמש, ולכן טוקני משתמשים מאומתים
  ישירות מול ליבת HA ברשת הפנימית (`http://homeassistant:8123`, או `https` כש-HA עצמו מגיש TLS - אותו זיהוי
  שסקריפט Cloudflared עושה).
- **טיפול בכניסות שנכשלו.** `@log_invalid_auth` / `process_wrong_login` סופרים כשלונות לפי `request.remote` ומעלים
  הודעה קבועה "Login attempt or request with invalid authentication from …". חסימה קורית רק כש-`login_attempts_threshold`
  מוגדר: ברירת המחדל שלו היא `NO_LOGIN_ATTEMPT_THRESHOLD = -1` (אין חסימות), `ip_ban_enabled` ברירת מחדל true,
  `use_x_frame_options` ברירת מחדל true (HA שולח `X-Frame-Options: SAMEORIGIN`).
- **טוקנים שנזרעו מראש מתקבלים.** ה-frontend של HA (`core.ts`) קורא ל-`getAuth({hassUrl, limitHassInstance: true,
  saveTokens, loadTokens})`; `loadTokens()` קורא את `localStorage.hassTokens`, וכשהוא מוצא טוקנים הוא מציב
  `writeEnabled = true` כך שטוקנים מרועננים נכתבים בחזרה. `getAuth` משתמש בהם כש-`data.hassUrl === hassUrl`
  (`hassUrl` = `${location.protocol}//${location.host}` בבנייה של HA). המבנה השמור הוא `AuthData` של
  home-assistant-js-websocket: `{hassUrl, clientId, expires, refresh_token, access_token, expires_in}` עם
  `expires = Date.now() + expires_in*1000`. הרענון משתמש ב-`data.clientId`, כך שרשומה זרועה שה-`clientId` שלה הוא
  `https://ecc.smplwise.com/arx/` מתרעננת נכון. **לכן התחברות ל-Arx באותו מקור יכולה להכניס את פאנל WisKey המשובץ
  (`/hikvision-intercom`, עמוד של ה-frontend של HA) בלי התחברות שנייה.**
- **ה-service worker של HA מכסה גם את `/arx`.** HA רושם `/sw-<build>.js` עם scope `/`. המסלולים שלו: כל מה שתואם
  `/(api|auth)/` → רשת בלבד; כל כתובת שמסתיימת ב-`/` → stale-while-revalidate; כל GET אחר מאותו מקור →
  stale-while-revalidate ב-`file-cache` ל-24 שעות; בקשת מסמך שנכשלה נופלת ל-`/` השמור של HA. ברגע שדפדפן טען את HA
  על `ecc.smplwise.com` (ומסגרת WisKey עושה את זה), **ה-worker של HA יגיש את `/arx/` ואת הנכסים שלנו מהמטמון שלו
  ועלול להציג את הדף של HA תחת `/arx` במצב לא מקוון**. התיקון אצלנו: לרשום worker משלנו ב-`/arx/sw.js`
  (scope `/arx/`); הדפדפן בוחר את הרישום עם ה-scope התואם הארוך ביותר.

### 2.3 הקוד שלנו היום

- `smplwise_vms/backend/smplwise/auth.py`: זהות רק מ-`X-Remote-User-Id/-Name/-Display-Name`, רק מ-`trusted_proxies`;
  כל נתיב HTTP ו-WS עובר דרך `resolve_principal` (WS דרך בקשה מדומה ב-`routers/media.py:_principal_for_ws`), ואחר כך
  `touch_user` ו-`maybe_bootstrap` (bootstrap לפי שם משתמש).
- `frontend/src/api/client.ts`: כל כתובת יחסית ל-`document.baseURI` (`api/v1/…`), גם כתובות WS
  (`media.liveWsUrl`, `events.ts`, `session.ts`, `ha.ts`, `intercom.ts`); הניתוב מבוסס hash (`router.ts`);
  `index.html` משתמש בכתובות נכסים `./`. שום דבר לא קורא `X-Ingress-Path`. **הבנייה כבר עובדת תחת כל קידומת שמסתיימת
  ב-`/`**; `/arx` בלי לוכסן חייב להפנות ל-`/arx/`.
- `main.py` מעגן את הממשק הבנוי ב-`/` (`StaticFiles`, `index.html` עם `no-cache`) ואת ה-API ב-`/api/v1`.
- קיימים משאבים שאינם fetch: `<img src=resourceUrl(...)>` (תמונות תוכנית, תמונות אתר, תמונות ממוזערות), קישורי הורדה
  (`exports/{id}/download`, `backups/{name}/download`) ושישה WebSockets. אף אחד מהם לא יכול לשאת כותרת
  `Authorization`, ולכן §3b משתמש בעוגייה לסשן אחרי החלפת ה-bearer.
- שיבוץ WisKey (`docs/integrations/wiskey/embed-api-v1/WISKEY_EMBED_API_V1.md`): כתובת המסגרת נבנית מה-**origin**
  (`new URL('/hikvision-intercom', location.origin)`), חייבת להיות מאותו מקור, ושרת ה-VMS אסור שיחשוף טוקני Supervisor
  למסגרת או ל-JavaScript (וגם CR-005 §3: הדפדפן לעולם לא מקבל טוקן Supervisor).
- חוזה הזהות (`HA_IDENTITY_RBAC_HE.md` §1/§4): רק משתמשי HA, אין מערכת סיסמאות חדשה, תפקידי VMS קשורים למזהי
  משתמש HA, לעולם לא לקבל `user_id`/`role` מהדפדפן כאמת; Ingress הוא ערוץ הכניסה המועדף. טוקן bearer ש*השרת שלנו*
  מאמת מול HA שומר על כל אלה; הוא רק מוסיף ערוץ.

## 3. ארכיטקטורה

### 3a. נתיב בסיס `/arx` מחוץ ל-Ingress

- **שרת:** middleware ‏ASGI טהור לפני הכול. כשאפשרות התוסף `remote_access` (חדשה, ברירת מחדל **false**) פעילה והנתיב
  מתחיל ב-`SW_PUBLIC_PATH` (ברירת מחדל `/arx`, אפשרות `remote_path`): `/arx` → `308 /arx/`; `/arx/<rest>` → הסרת
  הקידומת, `scope["root_path"] = "/arx"` ו-`scope["state"]["channel"] = "remote"`, והמשך. כשהאפשרות כבויה, `/arx*`
  → 404. בקשות בלי הקידומת שומרות על ההתנהגות של היום (Ingress מ-`172.30.32.2`, כל השאר `untrusted_origin`). בקשה
  לעולם אינה "remote" ו-"ingress" בו-זמנית: הערוץ נקבע מהנתיב, האמון ב-Ingress מכתובת העמית, וערוץ ה-remote
  **מתעלם מ-`X-Remote-User-*` ומסיר אותן**.
- **לקוח:** אין שינוי כתובות - `document.baseURI` הוא `/arx/`, כך ש-`api/v1/…`, `ws(s)://…/arx/api/v1/…/ws`, תמונות
  והורדות נפתרים תחת `/arx/`. זיהוי ערוץ בממשק: `location.pathname` מתחיל בקידומת ה-Ingress (`/api/hassio_ingress/`)
  → Ingress; אחרת → remote (מסך התחברות, טיפול בטוקנים, התנתקות בתפריט המשתמש). השרת מאשר: בערוץ remote קריאה לא
  מאומתת מחזירה `401 {code: "remote_login_required"}`.
- **כל מסלול:** API, ‏WS, קבצים סטטיים, קישורי hash (`/arx/#/…`), הפניות (רק ההפניה הקבועה `/arx` → `/arx/`),
  `sw.js`, ובהמשך `manifest.webmanifest`. WisKey נשאר ב-origin (`/hikvision-intercom`). `/healthz` נשאר בשורש (לא
  חשוף דרך מסלול המנהרה).

### 3b. זהות bearer

1. **מסך ההתחברות שלנו** (עיצוב SmplWise Arx, ‏RTL, עברית): שם משתמש, סיסמה, "השאר אותי מחובר", ואחר כך שלב קוד MFA
   כש-HA מבקש. הוא פונה **לנקודות הקצה של HA עצמו באותו מקור** (`/auth/providers`, `/auth/login_flow`,
   `/auth/token`) בדיוק כמו דף ההתחברות של HA, עם PKCE ‏(S256). הסיסמה לעולם לא מגיעה לתוסף שלנו; HA מבצע את בדיקת
   הסיסמה, ה-MFA, ספירת הכניסות שנכשלו וההתראות (עם ה-IP האמיתי של הלקוח, כי cloudflared שולח `X-Forwarded-For`
   ו-HA סומך על `172.30.33.0/24`).
2. **אחסון טוקנים:** `localStorage["arx.auth.v1"] = {hassUrl, clientId: "https://<host>/arx/", access_token,
   refresh_token, expires, expires_in, user_id}` (לסשן בלבד כש"השאר אותי מחובר" כבוי: `sessionStorage`, החלטה D5).
   **זריעה ל-HA:** `localStorage["hassTokens"]` נכתב באותו מבנה `AuthData` (`hassUrl: "https://ecc.smplwise.com"`, בלי
   לוכסן בסוף; `clientId: "https://ecc.smplwise.com/arx/"`), כך שפאנל WisKey המשובץ (וגם ממשק HA עצמו ב-`/` באותו
   דפדפן) עולה מחובר כאותו משתמש ומתרענן עם ה-client id שלנו. הסיכון, במפורש: הדפדפן שמתחבר ל-Arx מחובר אז גם לממשק
   HA המלא ב-`/` כאותו משתמש (אותו משתמש יכול היה להתחבר שם עם אותה סיסמה בכל מקרה), ו-`hassTokens` קיים של משתמש HA
   אחר באותו דפדפן מוחלף. בלי זריעה, מסגרת WisKey מציגה את מסך ההתחברות של HA בתוך המסגרת (החלטה D6). התנתקות מבטלת
   את ה-refresh token ב-HA ומנקה את שני המפתחות.
3. **רענון:** 5 דקות לפני `expires` (ועל 401), `grant_type=refresh_token` עם ה-client id שלנו; רענון שנכשל → מסך
   התחברות. רענונים של ה-frontend של HA במסגרת WisKey כותבים ל-`hassTokens`; ל-Arx עותק משלו, ושניהם access tokens
   תקפים של אותו refresh token.
4. **החלפה → סשן:** `POST /arx/api/v1/auth/session` עם `Authorization: Bearer <HA access token>`. השרת: בודק מקומית את
   צורת הטוקן (JWT שה-`exp` הלא-מאומת שלו בעתיד - דוחה זבל וטוקנים שפג תוקפם בלי לפנות ל-HA); מאמת אותו מול ליבת HA
   (`/api/websocket`: `auth` + `auth/current_user`); מסרב למשתמשים ש-`ha_users` מסמן כלא פעילים או system-generated;
   בונה **אותו `Principal`** כמו ב-Ingress (`user_id` = מזהה המשתמש ב-HA, `display_name` = השם ב-HA, `username`
   מ-`ha_users`, `source = "remote"`); יוצר סשן אטום (מזהה אקראי של 256 ביט, בזיכרון, קשור ל-access token של HA
   ול-`exp` שלו) ומציב `__Secure-arx_session=<id>; Path=/arx/; HttpOnly; Secure; SameSite=Strict` (בלי `Domain`;
   `__Host-` אינו אפשרי כי הוא דורש `Path=/`). התשובה היא `/me`. הלקוח חוזר על ההחלפה אחרי כל רענון (מזהה חדש -
   רוטציה), כך שסשן לעולם לא חי יותר מה-access token שלו (≤ 30 דקות) ו-refresh tokens מבוטלים מפסיקים לייצר סשנים
   חדשים.
5. **לכל בקשה:** `resolve_principal` בערוץ remote מקבל את עוגיית הסשן (תמונות, הורדות, לחיצות יד של WS) או
   `Authorization: Bearer` (לקוחות API, האפליקציה הנייטיב העתידית) - שניהם ממופים לאימות שמור במטמון. **מטמון ≤ 60
   שניות:** משימת רקע מאמתת מחדש כל סשן שהיה בשימוש ב-2 הדקות האחרונות, לכל היותר פעם ב-60 שניות (`auth/current_user`
   שוב); תוצאת `auth_invalid` (refresh token נמחק בפרופיל HA, משתמש הושבת או נמחק) מוחקת את הסשן וסוגרת את ה-WebSockets
   שלו - ביטול נכנס לתוקף תוך 60 שניות. RBAC נבדק לכל בקשה בדיוק כמו היום; שינויי permission-revision חלים מיד כמו
   היום.
6. **ניחוש סיסמאות / הגבלת קצב:** HA מטפל בניחוש סיסמאות (מומלץ `login_attempts_threshold`, למשל 10, ו-MFA למשתמשים
   עם תפקידי ניהול - D8/D9; כלל rate-limiting אופציונלי ב-Cloudflare על `/auth/login_flow*` ו-`/auth/token`). נקודת
   ההחלפה שלנו: 10 ניסיונות לדקה ו-50 לשעה לכל IP של לקוח (`CF-Connecting-IP`, מהימן רק בערוץ remote), מטמון שלילי
   של גיבובי טוקנים שנדחו, וקריאות האימות שלנו ל-HA נושאות `X-Forwarded-For: <IP הלקוח>` כך ש-HA מייחס כל טוקן לא תקף
   לפונה ולא לכתובת התוסף שלנו (אחרת ריסוס טוקנים יכול לגרום ל-HA לחסום את התוסף שלנו ברגע שמוגדר סף).
7. **Bootstrap:** `maybe_bootstrap` לעולם לא רץ בערוץ remote - מנהל המערכת הראשון מוענק רק דרך Ingress.
8. **Audit:** `auth.remote_session.created` (משתמש, IP לקוח, כותרת מדינה, user agent), `.rejected` (סיבה, IP),
   `.revoked` (כשל באימות חוזר), `.logout`, גלויים במסך ה-audit הקיים; טוקנים ועוגיות לעולם לא מופיעים ביומנים
   (`Authorization`/`Cookie` מושחרים).
9. **ללא שינוי:** טוקן ה-Supervisor נשאר בצד השרת (כלל CR-005); הדפדפן לעולם לא רואה פרטי שירות של NVR, ‏go2rtc
   או WisKey. אפשר להוסיף Cloudflare Access / WAF מעל `/arx` בלי שינוי קוד (D3).

### 3c. מה נשאר זהה

- **RBAC ו-scopes**: ה-principal הוא אותו מזהה משתמש HA, כך ש-bindings, קבוצות, scopes וייחוס ה-audit לא משתנים.
  שער נוסף אופציונלי: הרשאת `remote.access` (D4).
- **שיבוץ WisKey**: אותו מקור, אותה מסגרת `/hikvision-intercom?embed=1`, אותו חוזה הודעות; מחובר דרך `hassTokens`
  הזרוע (D6). ה-`X-Frame-Options: SAMEORIGIN` של HA כברירת מחדל מתיר את המסגרת.
- **וידאו**: ה-WebSockets של החי וההשמעה עוברים דרך המנהרה ל-backend שלנו ומשם ל-go2rtc בדיוק כמו תחת Ingress;
  מדיית WebRTC זורמת ישירות בין הדפדפן ל-go2rtc (אותו מסלול שהבעלים כבר משתמש בו ל-WisKey), MSE הוא הגיבוי ואז
  הווידאו עצמו עובר דרך המנהרה - להשאיר זאת כברירת מחדל לפרופיל sub (D7; וידאו כבד דרך הרשת של Cloudflare הוא גם
  שיקול של תנאי השימוש).
- **בקרת התקנים** (CR-007), מפות, אירועים, סטודיו התוכנית: ללא שינוי; הם קריאות API תחת אותו principal.

### 3d. האפליקציה

1. **PWA קודם** (בלי חנות): `manifest.webmanifest` (שם "SmplWise Arx", `scope`/`start_url` `/arx/`, `display:
   standalone`, `dir: rtl`, `lang: he`, אייקונים), ה-service worker שלנו ב-`/arx/sw.js` (network-first ל-`index.html`,
   cache-first לנכסים עם hash, לעולם לא שומר `api/`), הצעת התקנה (`beforeinstallprompt` באנדרואיד/דסקטופ, מדריך
   "הוסף למסך הבית" ב-iOS). **Web Push**: זוג מפתחות VAPID שנוצר פעם אחת ונשמר ב-`/data` (המפתח הפרטי לעולם לא יוצא
   מהתוסף), `GET api/v1/push/vapid-key`, `POST/DELETE api/v1/push/subscriptions`, טבלה
   `push_subscriptions(id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_ok_at, failures)`, ונתיב
   התראה ממנוע הכללים/ההתראות: כלל מופעל → נמענים = משתמשים עם מינוי **וגם** הרשאה לראות את ה-scope של האירוע →
   מטען מינימלי (כותרת, גוף, מזהה אירוע; בלי תמונה כברירת מחדל) → שירותי push ‏(FCM, ‏Mozilla, ‏Apple) ב-HTTPS
   יוצא - לא נדרש שום דבר נכנס. לחיצה פותחת `/arx/#/…/events/<id>`. iOS מוסר Web Push רק ל-PWA שהותקן במסך הבית
   (16.4 ומעלה). המינוי שלנו נפרד מהתראות ה-html5 של HA עצמו (scope אחר של worker).
2. **עטיפה נייטיב (Capacitor)** בהמשך: ה-WebView טוען את `https://<site>/arx/` של הלקוח (אותו מקור, כך שהתחברות,
   WisKey ועוגיות מתנהגים בדיוק כמו בדפדפן; כמה אתרים לאפליקציה), push נייטיב דרך FCM/APNs
   (`@capacitor/push-notifications`) עם טוקן המכשיר באותה טבלת מינויים (`kind = fcm|apns`), פתיחה ביומטרית של
   ה-refresh token השמור (Keychain/Keystore). פרטי FCM/APNs שייכים למפרסם האפליקציה ואי אפשר לשלוח אותם בכל תוסף של
   לקוח, ולכן push נייטיב דורש **ממסר push קטן של SmplWise** (כמו שאפליקציות Companion של HA משתמשות בממסר): התוסף
   חותם בקשה עם מפתח ההתקנה שלו, הממסר מעביר ל-FCM/APNs. חשבונות חנות, תוויות פרטיות ובדיקת חנות (Apple דורשת
   מעטיפות ערך נייטיב אמיתי - push וביומטריה מספקים אותו).

### 3e. איומי אבטחה ייחודיים לחשיפה ציבורית

1. **כותרות זהות מזויפות** דרך המנהרה: ערוץ remote מתעלם מ-`X-Remote-User-*` ומסיר אותן; האמון ב-Ingress נשאר קשור
   ל-`172.30.32.2`, שהמנהרה לעולם לא יכולה להיות. בדיקה אוטומטית לשניהם.
2. **מסלולים לא מוגנים**: בדיקה עוברת על כל מסלולי האפליקציה ומוודאת `401` ב-`/arx/...` בלי סשן (רשימת היתר:
   `sw.js`, נכסים סטטיים, `auth/session`). חבילת הממשק הסטטית לא מכילה סודות (כבר נכון היום; הבדיקה סורקת את הבנייה).
3. **גניבת טוקנים (XSS)**: Arx חולק את המקור עם HA - XSS באחד קורא את הטוקנים של השני (ל-HA כבר יש את החשיפה הזו עם
   הכרטיסים המותאמים שלו). הקלות: CSP קפדני על `/arx` (`default-src 'self'; script-src 'self'; object-src 'none';
   base-uri 'self'; frame-ancestors 'self'; frame-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:;
   connect-src 'self' wss:`), בלי סקריפטים של צד שלישי, עוגיית סשן `HttpOnly`, access token קצר, ביטול תוך 60 שניות.
4. **CSRF במקור שחולק לפי נתיב**: שינויי מצב ב-API דורשים content type של JSON או `Authorization` (בקשות לא
   פשוטות), העוגייה `SameSite=Strict`, ולחיצות יד של WS בודקות `Origin == https://<Host>`. דפי HA מאותו מקור נמצאים
   בתוך גבול האמון מעצם ההגדרה (הם יכולים לקרוא `hassTokens`).
5. **תחום העוגייה**: `Path=/arx/` משאיר את העוגייה מחוץ לבקשות של HA (נתיב אינו גבול בידוד בתוך מקור אחד - `HttpOnly`
   הוא מה שעוצר גישה מסקריפט).
6. **Clickjacking**: `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'` על `/arx` (המסגור של Ingress הוא מאותו
   מקור, כך שהוא ממשיך לעבוד).
7. **מטמון**: `Cache-Control: no-store` על `api/`; ה-worker שלנו ב-`/arx/` מחליף את של HA עבור ה-scope שלנו (§2.2).
8. **ניחוש סיסמאות ונעילה**: הכללים של HA עצמו (אין חסימה כברירת מחדל; התראה לכל כשלון; מגבלת ניסיונות MFA →
   `too_many_retry`), ועוד §3b.6. סיכון נעילת משתמש לגיטימי עם סף: חסימת IP ב-HA חוסמת את ה-IP הזה ל-HA ול-Arx גם
   יחד עד שמוסר מ-`ip_bans.yaml` - לתעד ב-DOCS.
9. **Session fixation / שידור חוזר**: מזהה סשן אטום חדש בכל החלפה; אין מזהה סשן בכתובות; התנתקות מבטלת את ה-refresh
   token ב-HA.
10. **מיצוי משאבים**: מגבלות הסשנים החיים הקיימות להתקנה, ועוד תקרה למשתמש של סשנים חיים מרחוק בו-זמנית.
11. **מתג חשיפה**: `remote_access: false` כברירת מחדל; כשהוא כבוי, `/arx` מחזיר 404 גם אם מסלול המנהרה קיים.

## 4. המסלול המהיר לסביבה עובדת היום

**שלב 0 (עובד עכשיו, בלי קוד):** שימוש מרחוק דרך HA עצמו - לפתוח `https://ecc.smplwise.com`, להתחבר ל-HA, ולפתוח
את פריט SMPLWISE בסרגל הצד (Ingress). זה הגיבוי בזמן שה-MVP נבנה.

**צעדי הבעלים (כ-30-45 דקות, השבתה קצרה של שם המארח הציבורי בזמן העברת ה-DNS):**

1. ביומן של תוסף Cloudflared לבדוק את המצב: "Using Cloudflare Remote Management Tunnel" = מצב טוקן (לדלג לשלב 4).
2. לוח Zero Trust → Networking → Tunnels → Create a tunnel → Cloudflared → שם `ecc-ha` → להעתיק את הטוקן (המחרוזת
   `eyJ…` בפקודת ההתקנה). לא להריץ את פקודת ההתקנה.
3. ליצור מחדש כל שם ציבורי קיים כמסלולים של המנהרה הזו (גם את `additional_hosts` של התוסף). עבור שם ה-HA, רשומת
   ה-CNAME ‏`ecc` של המנהרה הישנה חייבת להימחק קודם (DNS → הרשומה `ecc`) אחרת לוח הבקרה מסרב למסלול.
4. Add route → Published application, **ראשון**: Subdomain ‏`ecc`, ‏Domain ‏`smplwise.com`, ‏Path ‏`^/arx(/.*)?$`,
   Service ‏`HTTP` ‏`0b8c26d5-smplwise-vms:8099`.
5. Add route → Published application, **שני**: Subdomain ‏`ecc`, ‏Domain ‏`smplwise.com`, ‏Path ריק, Service ‏`HTTP`
   `homeassistant:8123` (או `HTTPS` + ‏"No TLS Verify" אם HA מגיש TLS בעצמו). לוודא שמסלול `/arx` מופיע מעליו
   (בדיקה מלמעלה למטה; ליצור מחדש את המסלול הפשוט אם הסדר שגוי).
6. תצורת תוסף Cloudflared: `tunnel_token: <token>` (שאר האפשרויות אז מתעלמות), לשמור, להפעיל מחדש; לוודא
   ש-`https://ecc.smplwise.com` עדיין פותח את HA.
7. אחרי הגרסה שלנו: באפשרויות תוסף SMPLWISE ‏`remote_access: true`, הפעלה מחדש, לפתוח `https://ecc.smplwise.com/arx`.
8. מומלץ: HA → הגדרות → מערכת → רשת → שרת HTTP: ניסיונות התחברות לפני חסימה `10`.

**הצעדים שלנו (MVP = נתיב בסיס + התחברות bearer + מסך ההתחברות שלנו; בלי PWA):**

| # | עבודה | הערכה |
|---|---|---|
| 1 | אפשרויות `remote_access` (bool, ברירת מחדל false) / `remote_path` (ברירת מחדל `/arx`) ב-`config.yaml`, ‏`Settings`; ‏DOCS + DOCS_HE | 0.5 ש' |
| 2 | middleware ‏ASGI לקידומת (הסרה, `308 /arx`, דגל ערוץ, 404 כשכבוי, הסרת כותרות), כותרות אבטחה בערוץ remote | 1.5 ש' |
| 3 | `services/ha_user_auth.py` ‏(WS לליבת HA ‏`auth` + `auth/current_user`, בדיקת JWT מקדימה, `X-Forwarded-For`, משימת אימות חוזר כל 60 שניות), מאגר סשנים בזיכרון, `POST/DELETE api/v1/auth/session`, ענף remote ב-`resolve_principal` (עוגייה או bearer; בדיקת Origin ל-WS), הגבלת קצב, audit, בלי bootstrap מרחוק; בדיקות unit/contract כולל זיוף כותרות ומעבר על כל המסלולים | 4 ש' |
| 4 | Frontend: זיהוי ערוץ, מסך ההתחברות של Arx (שם משתמש/סיסמה, שלב MFA, טקסטי השגיאה של HA), ‏PKCE, אחסון טוקנים + זריעת `hassTokens`, לולאת רענון + החלפה מחדש, 401 → התחברות, התנתקות; `/arx/sw.js` ריק שנרשם עם scope ‏`/arx/` | 4 ש' |
| 5 | סבב ביקורת, גרסה, בדיקת הבעלים באתר המעבדה | 1.5 ש' |
| | **סה"כ** | **כ-11-12 ש'** |

מסירה מציאותית: באותו יום רק אם העבודה מתחילה בבוקר; אחרת למחרת בבוקר. שלב 0 מכסה את הפער.

**"עובד" בבדיקה הראשונה (תת-קבוצה של AT185):** (1) `https://ecc.smplwise.com/arx` מציג את מסך ההתחברות של Arx, לא
את HA; (2) משתמש HA עם תפקיד VMS מתחבר (ומשתמש עם MFA מקבל את שלב הקוד); (3) המפה, ההתקנים והאירועים נטענים עם
ההרשאות של אותו משתמש; (4) אזור WisKey נפתח כבר מחובר; (5) וידאו חי מתנגן (WebRTC; גיבוי MSE אם UDP חסום);
(6) `https://ecc.smplwise.com` עדיין פותח את HA; (7) מחיקת ה-refresh token של "…/arx/" בפרופיל HA מנתקת את Arx תוך
דקה; (8) בקשה ל-`/arx/api/v1/me` עם `X-Remote-User-Id` מזויף מחזירה 401.

## 5. שלבים והערכות

| שלב | תוכן | הערכה |
|---|---|---|
| P0 | שימוש מרחוק דרך HA Ingress (קיים) | 0 |
| P1 ‏MVP | §4 | כ-11-12 ש' |
| P2 הקשחה | מעבר מלא על דיווחי CSP, הרשאת `remote.access` + ממשק דגל למשתמש, רשימת סשנים מרוחקים + "התנתק מכל המקומות", תקרות חי למשתמש, מדיניות פרופיל וידאו מרחוק, מדריך Cloudflare Access / הגבלת קצב ב-DOCS, הרצת רשימת בדיקות חדירה במעבדה, מסנני audit | כ-8-10 ש' |
| P3 ‏PWA + Web Push | manifest, אייקונים, service worker אמיתי, הצעת התקנה / מדריך iOS, ‏VAPID + מינויים + נתיב התראה מהכללים, העדפות התראה למשתמש, בדיקות | כ-14-18 ש' |
| P4 אפליקציה נייטיב | מעטפת Capacitor (כמה אתרים, ביומטריה, push נייטיב), שירות ממסר push של SmplWise, חשבונות חנות ובדיקת חנות | כ-30-45 ש' + ממסר 10-15 ש' + זמן המתנה לחנות |

## 6. החלטות לבעלים

- **D1 תבנית שם המארח:** (א) נתיב `/arx` על שם המארח של HA - אותו מקור, WisKey וזריעת הטוקנים עובדים, דורש מנהרה
  בניהול טוקן [מומלץ]; (ב) שם מארח נפרד דרך `additional_hosts` - בלי שינוי מנהרה, אבל WisKey חייב להתחבר בנפרד
  והתחברות ל-HA דורשת CORS או proxy בצד השרת.
- **D2 מצב המנהרה הנוכחי** (עובדה לדווח): options או טוקן (§4 שלב 1).
- **D3 ‏Cloudflare Access על `/arx`:** בלי / קוד חד-פעמי בדוא"ל / רק לתפקידי ניהול.
- **D4 מי רשאי להתחבר מרחוק:** כל משתמש HA עם תפקיד VMS כלשהו, או רק משתמשים עם דגל `remote.access` מפורש (כבוי
  כברירת מחדל חוץ מהבעלים) [מומלץ].
- **D5 אורך סשן:** "השאר אותי מחובר" = ה-refresh token המתגלגל של HA ל-90 יום; אחרת סשן שנגמר עם הדפדפן; ועוד נעילת
  חוסר פעילות אופציונלית ב-Arx (למשל 12 שעות).
- **D6 זריעת `hassTokens`:** כן (WisKey מחובר; הדפדפן מחובר גם ל-HA ב-`/`) [מומלץ] / לא.
- **D7 וידאו מרחוק:** פרופיל sub בלבד / main מותר / גיבוי MSE דרך המנהרה מותר או לא.
- **D8 ‏MFA:** חובה למשתמשים מרוחקים עם תפקידי ניהול, או אופציונלי.
- **D9 סף חסימה ב-HA:** להגדיר `login_attempts_threshold` (למשל 10) או להשאיר את ברירת המחדל של HA (בלי חסימות).
- **D10 ‏push נייטיב** (P4): ממסר שמתארח אצל SmplWise, או Web Push בלבד.
