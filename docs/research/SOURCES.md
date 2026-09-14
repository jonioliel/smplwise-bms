# Research and evidence register

Checked 2026-09-14. Official/public pages are references, not device conformance tests.

## [S01] Ubiquiti — Introducing Protect 6.0
https://blog.ui.com/article/introducing-protect-6-0

השראה: Spotlights, multi-camera scrubbing, חיפוש ואודיט; מאמר מ־12.06.2025.

## [S02] Ubiquiti — AI Detections and Facial Recognition
https://help.ui.com/hc/en-us/articles/360058867233-UniFi-Protect-Cameras-AI-Detections-and-Facial-Recognition

Find Anything ותלות יכולות AI בציוד/מקור נתונים.

## [S03] Ubiquiti — Build Incident Reports with Case Manager
https://help.ui.com/hc/en-us/articles/29376378006167-Build-Incident-Reports-with-UniFi-Case-Manager

ארגון קטעים, הערות, שימור ויצוא ZIP עם PDF.

## [S04] Ubiquiti — Alarm Manager
https://help.ui.com/hc/en-us/articles/27721287753239-UniFi-Alarm-Manager-Customize-Alerts-Integrations-and-Automations-Across-UniFi

Trigger, Scope, schedules, integrations ואוטומציות.

## [S05] Ubiquiti — Manage Camera Zones
https://help.ui.com/hc/en-us/articles/360056987954-UniFi-Protect-Manage-Camera-Zones

אזורי Motion/Smart Detection/Privacy; לא ערבוב עם פוליגון מפה.

## [S06] Ubiquiti — Vantage Point
https://help.ui.com/hc/en-us/articles/27719500615959-UniFi-Vantage-Point-Multi-NVR-Camera-Management

ניהול וצפייה מאוחדים בכמה NVR.

## [S07] Home Assistant — Presenting your app / Ingress
https://developers.home-assistant.io/docs/apps/presentation

Ingress, רשת Proxy, HTTP streaming ו־WebSocket.

## [S08] go2rtc — official repository and README
https://github.com/AlexxIT/go2rtc

נתיבי מדיה, codec וגבולות אבטחה. יש לנעול Tag שנבדק.

## [S09] go2rtc — streams API source
https://github.com/AlexxIT/go2rtc/blob/master/internal/streams/api.go

יצירה/מחיקה עשויות לבצע PatchConfig; אין הנחת ephemeral. branch משתנה.

## [S10] Advanced Camera Card — official repository
https://github.com/dermotduffy/advanced-camera-card

מקור לימוד UI/Media; רישיון MIT מוצג במאגר, verify ברוויזיה שנעשה בה שימוש.

## [S11] Home Assistant — WebSocket API
https://developers.home-assistant.io/docs/api/websocket/

אימות, commands, events ו־subscriptions.

## [S12] Home Assistant — Permissions
https://developers.home-assistant.io/docs/auth_permissions/

Context ובדיקת הרשאות למשתמש/ישות בצד שרת.

## [S13] Home Assistant — Authentication API
https://developers.home-assistant.io/docs/auth_api/

גישה מאומתת בשם משתמש; אין הורשת סמכויות אוטומטית מטוקן שירות.

## [S14] OpenAI — Codex Non-interactive mode
https://developers.openai.com/codex/noninteractive

הרצות codex exec, JSONL, structured result ושמירת אישורי גישה.

## [S15] OpenAI — Codex Configuration Reference
https://developers.openai.com/codex/config-reference

model/reasoning configuration; אימות לפי גרסה מותקנת ולא ID מומצא.

## [L01] CODEX_PROMPT_V2.md
Local archive: `../legacy/CODEX_PROMPT_V2.md`

אפיון קודם, 395 שורות; לא קוד ייצור או ראיית תמיכה.

## [L02] UX_RESEARCH_NOTES_V2.md
Local archive: `../legacy/UX_RESEARCH_NOTES_V2.md`

מסלולי שימוש, saved views, כינויים, mobile ו־capability-aware UI.

## [L03] API_MAPPING_V2.md
Local archive: `../legacy/API_MAPPING_V2.md`

מפת ISAPI מועמדת; method ותמיכה מחייבים אימות מחודש.

## [L04] DESIGN_SYSTEM_V2.md
Local archive: `../legacy/DESIGN_SYSTEM_V2.md`

מסמך עיצוב קודם; השפה החזותית הנוכחית גוברת במקרה סתירה.

## [L05] CODEX_PROMPT.md
Local archive: `../legacy/CODEX_PROMPT.md`

אפיון בסיס קודם; נשמר כארכיון לקריאה ולא כהוראות פעילות.

## HA identity amendment v1.1


תיעוד המקור נבדק ב־14.09.2026; קישורי branch משתנים ולכן ב־G0 יש לתעד גרסה/commit מותקן. אלה תומכים בעובדות HA, לא מוכיחים שהמוצר כבר מומש.

- [H01] Home Assistant — Ingress and trusted proxy: https://developers.home-assistant.io/docs/apps/presentation/
- [H02] HA Core config/auth: admin-only user list and user fields: https://github.com/home-assistant/core/blob/dev/homeassistant/components/config/auth.py
- [H03] Supervisor Ingress — authenticated user headers and filtering: https://github.com/home-assistant/supervisor/blob/main/supervisor/api/ingress.py
- [H04] Home Assistant Authentication API: https://developers.home-assistant.io/docs/auth_api/
- [H05] Permissions, per-entity checks and user Context: https://developers.home-assistant.io/docs/auth_permissions/
- [H06] App configuration, Ingress and panel_admin: https://developers.home-assistant.io/docs/apps/configuration/
