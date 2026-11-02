"""GDRIVE-READY-2351: "בדיקת חיבור Google" - one press that says, in Hebrew, exactly what stands between this installation and a working
Google Drive target, with the screen in Google Cloud Console where it is fixed.

Read-only towards Google and the database: nothing is created in Drive (the backup folder is only looked up), no setting or secret is
written, the refresh token is used once to obtain an access token that is thrown away. Two requests reach Google even before an account
is connected:
- POST /device/code with the client id and the drive.file scope: Google answers it only for an existing "TVs and Limited Input devices"
  client of a project whose consent screen is configured, so its answer tells the client type, the consent screen and the scope apart.
  The device code it returns is dropped (it expires unused at Google after its lifetime; nobody can approve it without seeing it).
- POST /token with the client id + secret and a refresh token that cannot exist: `invalid_grant` means the secret matched the client
  (Google checks the client first), `invalid_client` means it did not.
Google's `Date` header gives the clock check (a wall clock minutes off breaks TLS and makes support logs useless).

The answer: {ok, connected, ready_to_connect, checks: [{id, status, title, message, fix?}], summary}. status: ok | fail | warn | info |
skip. Values never in it: the client secret, the refresh / access token, the device code. The account's e-mail address appears in the
`account` message only (the administrator's own screen; it is not audited or stored)."""
from __future__ import annotations

import email.utils
import time
from datetime import datetime, timezone
from typing import Any, Callable

import httpx

from ..config import Settings
from ..db import Database
from . import offbox_gdrive as og
from . import offbox_runtime, offbox_store
from .backup_offbox import OffboxError

WALL: Callable[[], float] = time.time  # tests move the wall clock
SKEW_FAIL_S = 300
SKEW_WARN_S = 60
TESTING_DAYS = 7
PROBE_REFRESH = "arx-connection-check-not-a-token"  # never a real token: only tells a matching secret (invalid_grant) from a wrong one

FIX_CLIENT = ("ב־Google Cloud Console: Google Auth Platform › Clients › Create client › Application type: "
              "'TVs and Limited Input devices' › Create. מעתיקים את Client ID ואת Client secret (הסוד מוצג רק ברגע היצירה) "
              "ומדביקים בעריכת היעד ב־Arx.")
FIX_TEST_USER = "Google Auth Platform › Audience › Test users › Add users › כתובת חשבון Google שבו יישמרו הגיבויים › Save."
FIX_PUBLISH = "Google Auth Platform › Audience › Publishing status › Publish app (ההרשאה drive.file אינה דורשת אימות של Google)."

TITLES = {
    "client_id": "מזהה הלקוח (Client ID)",
    "client_secret": "סוד הלקוח (Client secret)",
    "network": "חיבור לשרתי Google",
    "clock": "שעון המערכת",
    "client": "סוג הלקוח ומסך ההסכמה",
    "secret_match": "התאמת הסוד למזהה",
    "account": "חשבון Google מחובר",
    "drive_api": "Google Drive API בפרויקט",
    "quota": "מקום פנוי ב־Google Drive",
    "folder": "תיקיית הגיבוי",
    "consent_mode": "תוקף החיבור",
}

CLIENT_TEXT: dict[str, tuple[str, str]] = {
    "gdrive_client_type": (
        "סוג הלקוח שגוי: נוצר לקוח מסוג 'Web application' או 'Desktop app'. Arx מתחבר בקוד קצר (google.com/device) ולא משתמש "
        "בכתובת הפניה (Redirect URI), ולכן אין מה להוסיף שם - צריך לקוח מסוג אחר.", FIX_CLIENT),
    "gdrive_client_not_found": (
        "Google לא מכיר את מזהה הלקוח: הלקוח נמחק, שייך לפרויקט אחר, או שהמזהה הועתק חלקית.", FIX_CLIENT),
    "gdrive_client_invalid": (
        "Google דחה את מזהה הלקוח (לא נמצא או לא פעיל). בדרך כלל: המזהה הועתק חלקית או מפרויקט אחר.", FIX_CLIENT),
    "gdrive_consent_not_configured": (
        "מסך ההסכמה (OAuth consent) לא הוגדר בפרויקט, או שההרשאה drive.file לא נרשמה בו.",
        "Google Auth Platform › Get started (או Branding): שם אפליקציה ודוא\"ל תמיכה › Audience: External › Contact information › "
        "Finish › Create. אחר כך Data Access › Add or remove scopes › .../auth/drive.file › Update › Save."),
    "gdrive_scope_refused": (
        "Google לא מתיר ללקוח הזה את ההרשאה drive.file.",
        "Data Access › Add or remove scopes › מסמנים .../auth/drive.file › Update › Save. ודאו שסוג הלקוח הוא "
        "'TVs and Limited Input devices'."),
}


def _check(cid: str, status: str, message: str, fix: str | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"id": cid, "status": status, "title": TITLES[cid], "message": message}
    if fix:
        out["fix"] = fix
    return out


def _skew(resp: httpx.Response) -> float | None:
    raw = resp.headers.get("date")
    if not raw:
        return None
    try:
        server = email.utils.parsedate_to_datetime(raw)
    except (TypeError, ValueError, IndexError):
        return None
    if server.tzinfo is None:
        server = server.replace(tzinfo=timezone.utc)
    return WALL() - server.timestamp()


def _clock_check(resp: httpx.Response) -> dict[str, Any]:
    skew = _skew(resp)
    if skew is None:
        return _check("clock", "skip", "Google לא החזיר שעה להשוואה.")
    mins = abs(skew) / 60
    side = "מקדים" if skew > 0 else "מאחר"
    if abs(skew) > SKEW_FAIL_S:
        return _check("clock", "fail", f"שעון המערכת {side} בכ־{mins:.0f} דקות לעומת השעון של Google.",
                      "יש לתקן את השעון של המחשב המארח (סנכרון זמן / NTP) ואז לנסות שוב. שעון שגוי שובר חיבורים מאובטחים "
                      "ומבלבל את זמני הגיבויים.")
    if abs(skew) > SKEW_WARN_S:
        return _check("clock", "warn", f"שעון המערכת {side} בכ־{abs(skew):.0f} שניות. זה עדיין עובד, אבל כדאי להפעיל סנכרון זמן (NTP).")
    return _check("clock", "ok", "שעון המערכת תואם לשעון של Google.")


def _connected_age_days(updated_at: str | None) -> float | None:
    if not updated_at:
        return None
    try:
        t = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    return (WALL() - t.timestamp()) / 86400


def _date_he(updated_at: str, days: int) -> str:
    t = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    end = datetime.fromtimestamp(t.timestamp() + days * 86400, tz=timezone.utc)
    return end.strftime("%d/%m/%Y")


def _post(http: httpx.Client, url: str, form: dict[str, str]) -> httpx.Response:
    return http.post(url, data=form)


def diagnose(db: Database, settings: Settings, target_id: str, *, http_factory: Callable[[], httpx.Client] | None = None) -> dict[str, Any]:
    target, lookup = offbox_runtime._load(db, settings, target_id)
    if target["kind"] != "gdrive":
        raise OffboxError("destination_invalid", "not a Google Drive target")
    with db.connection(mode="read", label="offbox.gdrive.diagnose") as conn:
        state = offbox_store.secret_state(conn, target_id)
    from . import offbox_gdrive_connect  # the pending consent (in-process)

    checks: list[dict[str, Any]] = []
    try:
        cfg = og.config_values(target["config"])
    except OffboxError:
        cfg = {**og.CONFIG_DEFAULTS, "client_id": ""}
        checks.append(_check("client_id", "fail", "הגדרות היעד לא תקינות (אחד השדות מחוץ לטווח).", "יש לפתוח 'עריכה' ביעד ולשמור מחדש."))
    client_id = cfg["client_id"]
    secret = lookup(f"offbox.{target_id}.client_secret")
    refresh = lookup(f"offbox.{target_id}.refresh_token")
    connected = bool(refresh)

    # 1. the client id (configuration)
    if not checks:
        if not client_id:
            checks.append(_check("client_id", "fail", "לא הוזן מזהה לקוח (Client ID).", FIX_CLIENT))
        else:
            checks.append(_check("client_id", "ok", "Client ID הוזן ובמבנה תקין (‎…apps.googleusercontent.com‎)."))
    id_ok = checks[-1]["status"] == "ok"

    # 2. the client secret (sealed; only its shape is looked at)
    if not secret:
        checks.append(_check("client_secret", "fail", "לא הוזן סוד הלקוח (Client secret).",
                             "מדביקים את Client secret בעריכת היעד. אם הסוד כבר לא מוצג במסוף: Clients › הלקוח › Add secret, "
                             "מעתיקים את הסוד החדש ומדביקים."))
    elif secret.strip().endswith(".apps.googleusercontent.com"):
        checks.append(_check("client_secret", "fail", "בשדה הסוד הודבק מזהה הלקוח (Client ID) ולא הסוד.",
                             "מדביקים בשדה הסוד את Client secret (בלקוחות חדשים הוא מתחיל ב־GOCSPX-)."))
    elif secret != secret.strip() or any(ch in secret for ch in " \"'{}\n\t"):
        checks.append(_check("client_secret", "fail", "בסוד יש רווחים, מירכאות או סוגריים - כנראה הודבק יותר מהסוד עצמו (למשל קובץ JSON).",
                             "מדביקים רק את ערך Client secret, בלי רווחים לפניו או אחריו."))
    else:
        checks.append(_check("client_secret", "ok", "סוד הלקוח שמור (מוצפן; לא מוצג)."))
    secret_ok = checks[-1]["status"] == "ok"

    access: str | None = None
    if id_ok:
        http = (http_factory or offbox_runtime.GDRIVE_HTTP or og.default_http)()
        try:
            _, access = _remote_checks(http, checks, client_id, secret if secret_ok else None, refresh, connected, state, target_id,
                                           offbox_gdrive_connect.pending(target_id))
            if access:
                _drive_checks(http, checks, access, cfg)
        finally:
            http.close()
    else:
        checks.append(_check("network", "skip", "לא נבדק: קודם יש להזין Client ID."))

    fails = [c for c in checks if c["status"] == "fail"]
    ready = not fails and not connected
    if fails:
        first = fails[0]
        summary = f"נמצאה בעיה: {first['title']} - {first['message']}" + (f" מה לעשות: {first['fix']}" if first.get("fix") else "")
    elif connected:
        summary = "הכול תקין. אפשר להפעיל את היעד, ללחוץ 'בדיקה' ואחר כך 'העלאה עכשיו'."
    else:
        summary = "ההגדרות ב־Google תקינות. השלב הבא: 'חיבור חשבון Google'."
    return {"ok": not fails, "connected": connected, "ready_to_connect": ready, "checks": checks, "summary": summary}


def _remote_checks(http: httpx.Client, checks: list[dict[str, Any]], client_id: str, secret: str | None, refresh: str | None,
                   connected: bool, state: dict[str, dict[str, Any]], target_id: str, pending: bool) -> tuple[str | None, str | None]:
    """network, clock, client, secret_match, account, consent_mode. Returns (refresh token used, access token) - the access token
    only when the account check passed."""
    # 3 + 4 + 5: one device-code request answers the network, the clock and the client questions
    try:
        resp = _post(http, og.DEVICE_CODE_URL, {"client_id": client_id, "scope": og.SCOPE})
    except httpx.HTTPError as exc:
        text = str(exc).lower()
        if "certificate" in text or "ssl" in text:
            checks.append(_check("network", "fail", "החיבור המאובטח לשרתי Google נכשל (אימות התעודה).",
                                 "בדרך כלל שעון המערכת שגוי (תאריך עבר או עתיד). יש לתקן את השעון של המחשב המארח ולנסות שוב."))
            checks.append(_check("clock", "warn", "לא ניתן היה להשוות לשעון של Google; שעון שגוי הוא הסיבה הנפוצה לכשל התעודה."))
        else:
            checks.append(_check("network", "fail", "אין חיבור לשרתי Google (oauth2.googleapis.com).",
                                 "יש לבדוק שלמערכת יש גישה לאינטרנט ו־DNS תקין, ושחומת האש מתירה HTTPS יוצא."))
        return None, None
    checks.append(_check("network", "ok", "שרתי Google זמינים."))
    checks.append(_clock_check(resp))
    if resp.status_code == 200 and og._json(resp).get("device_code"):
        checks.append(_check("client", "ok", "Google מכיר את הלקוח, הוא מסוג 'TVs and Limited Input devices', מסך ההסכמה מוגדר "
                                             "וההרשאה drive.file מותרת לו."))
    else:
        err, desc = og.oauth_error(resp)
        code = og.client_error_code(err, desc) or ("gdrive_scope_refused" if err == "invalid_scope" else None)
        if code:
            msg, fix = CLIENT_TEXT[code]
            checks.append(_check("client", "fail", msg, fix))
        elif resp.status_code == 429 or resp.status_code >= 500:
            checks.append(_check("client", "warn", f"Google לא ענה כרגע (HTTP {resp.status_code}). כדאי לנסות שוב בעוד כמה דקות."))
        else:
            checks.append(_check("client", "fail", f"Google דחה את הבקשה (HTTP {resp.status_code}{', ' + err if err else ''}).", FIX_CLIENT))
        return None, None
    if secret is None:
        return None, None

    # 6: the secret, while no account is connected (a connected account's refresh below checks it too)
    if not connected:
        try:
            r = _post(http, og.TOKEN_URL, {"grant_type": "refresh_token", "client_id": client_id, "client_secret": secret,
                                           "refresh_token": PROBE_REFRESH})
        except httpx.HTTPError:
            checks.append(_check("secret_match", "warn", "לא ניתן היה לבדוק את הסוד (אין תשובה מ־Google)."))
            return None, None
        err, desc = og.oauth_error(r)
        if err == "invalid_grant":
            checks.append(_check("secret_match", "ok", "הסוד תואם למזהה הלקוח."))
        elif err in ("invalid_client", "unauthorized_client"):
            checks.append(_check("secret_match", "fail", "הסוד לא תואם למזהה הלקוח (הועתק לא נכון או שייך ללקוח אחר).",
                                 "Clients › הלקוח › Add secret, מעתיקים את הסוד החדש ומדביקים בעריכת היעד."))
        else:
            checks.append(_check("secret_match", "warn", "לא ניתן היה לאמת את הסוד מראש; הוא ייבדק בחיבור החשבון."))
        if pending:
            checks.append(_check("account", "info", "ממתין לאישור בדף google.com/device.",
                                 "אם Google הציג 'Access blocked' / 'הגישה חסומה' או 'האפליקציה לא אומתה' - החשבון לא נוסף כמשתמש בדיקה: "
                                 + FIX_TEST_USER + " אם הופיע 'org_internal' - ב־Audience סוג המשתמש הוא Internal; יש לבחור External."))
        else:
            checks.append(_check("account", "skip", "עדיין לא חובר חשבון Google.",
                                 "כשכל הבדיקות שמעל תקינות, לוחצים 'חיבור חשבון Google' ומאשרים בטלפון או במחשב."))
        return None, None

    # 7: the connected account
    try:
        r = _post(http, og.TOKEN_URL, {"grant_type": "refresh_token", "client_id": client_id, "client_secret": secret, "refresh_token": refresh or ""})
    except httpx.HTTPError:
        checks.append(_check("account", "warn", "לא ניתן היה לבדוק את החשבון (אין תשובה מ־Google)."))
        return None, None
    updated = (state.get("refresh_token") or {}).get("updated_at")
    if r.status_code >= 400:
        err, desc = og.oauth_error(r)
        if err == "invalid_grant":
            age = _connected_age_days(updated)
            if age is not None and age >= TESTING_DAYS - 0.5:
                msg = (f"Google ביטל את החיבור. הוא נוצר לפני כ־{age:.0f} ימים, וזה בדיוק מה שקורה כשמסך ההסכמה במצב Testing: "
                       "Google מבטל את החיבור אחרי 7 ימים.")
                fix = FIX_PUBLISH + " אחר כך 'חיבור חשבון Google' מחדש."
            else:
                msg = ("Google ביטל את החיבור: הגישה הוסרה בחשבון (myaccount.google.com › Security › Third-party apps), הסיסמה "
                       "שונתה, או שהלקוח הוחלף.")
                fix = "לוחצים 'חיבור חשבון Google' מחדש."
            checks.append(_check("account", "fail", msg, fix))
            return None, None
        code = og.client_error_code(err, desc)
        if code in ("gdrive_client_invalid", "gdrive_client_not_found"):
            checks.append(_check("account", "fail", "הסוד לא תואם למזהה הלקוח (או שהלקוח נמחק).",
                                 "Clients › הלקוח › Add secret, מדביקים את הסוד החדש ומחברים מחדש."))
        elif code:
            checks.append(_check("account", "fail", CLIENT_TEXT[code][0], CLIENT_TEXT[code][1]))
        else:
            checks.append(_check("account", "warn", f"Google לא ענה כרגע (HTTP {r.status_code}). כדאי לנסות שוב בעוד כמה דקות."))
        return None, None
    body = og._json(r)
    access = body.get("access_token") if isinstance(body.get("access_token"), str) else None
    granted = str(body.get("scope") or "").split()
    if granted and og.SCOPE not in granted:
        checks.append(_check("account", "fail", "החשבון מחובר, אבל בלי ההרשאה drive.file (הוסר הסימון בעת האישור).",
                             "לוחצים 'חיבור חשבון Google' ומשאירים מסומנת את ההרשאה לקבצים שהאפליקציה יוצרת."))
        return None, None
    if not access:
        checks.append(_check("account", "warn", "Google ענה בלי אסימון גישה. כדאי לנסות שוב."))
        return None, None
    checks.append(_check("account", "ok", "החשבון מחובר ואסימון הרענון תקף."))
    if updated:
        try:
            checks.append(_check("consent_mode", "info",
                                 f"אם מסך ההסכמה עדיין במצב Testing, Google יבטל את החיבור ב־{_date_he(updated, TESTING_DAYS)} "
                                 "(7 ימים מהחיבור).", FIX_PUBLISH + " אחרי הפרסום מחברים מחדש פעם אחת, והחיבור נשאר."))
        except ValueError:
            pass
    return refresh, access


def _drive_checks(http: httpx.Client, checks: list[dict[str, Any]], access: str, cfg: dict[str, Any]) -> None:
    """drive_api, quota, folder - read-only (the folder is looked up, never created)."""
    hdr = {"Authorization": f"Bearer {access}"}
    try:
        r = http.get(f"{og.DRIVE_API}/drive/v3/about", params={"fields": "user(emailAddress),storageQuota"}, headers=hdr)
    except httpx.HTTPError:
        checks.append(_check("drive_api", "warn", "לא ניתן היה לפנות ל־Google Drive (אין תשובה)."))
        return
    if r.status_code != 200:
        reasons = og._reasons(r)
        if r.status_code == 403 and reasons & og.API_DISABLED_REASONS:
            checks.append(_check("drive_api", "fail", "‏Google Drive API לא הופעל בפרויקט ב־Google Cloud.",
                                 "APIs & Services › Library › מחפשים Google Drive API › Enable. ההפעלה נקלטת תוך כמה דקות; "
                                 "אחר כך לוחצים שוב 'בדיקת חיבור Google'."))
        elif r.status_code == 403 and reasons & og.SCOPE_REASONS:
            checks.append(_check("drive_api", "fail", "לאסימון אין את ההרשאה drive.file.", "לוחצים 'חיבור חשבון Google' מחדש."))
        elif r.status_code == 429 or r.status_code >= 500 or reasons & (og.RATE_REASONS | og.DAILY_REASONS):
            checks.append(_check("drive_api", "warn", "Google Drive מגביל כרגע את קצב הבקשות. כדאי לנסות שוב בעוד כמה דקות."))
        else:
            checks.append(_check("drive_api", "fail", f"Google Drive דחה את הבקשה (HTTP {r.status_code}).",
                                 "לוחצים 'חיבור חשבון Google' מחדש; אם זה חוזר - לבדוק ש־Google Drive API מופעל בפרויקט."))
        return
    about = og._json(r)
    user = about.get("user") if isinstance(about.get("user"), dict) else {}
    mail = user.get("emailAddress") if isinstance(user.get("emailAddress"), str) else ""
    checks.append(_check("drive_api", "ok", "‏Google Drive API פעיל" + (f"; העותקים יישמרו בחשבון ‎{mail[:120]}‎." if mail else ".")))
    q = about.get("storageQuota") if isinstance(about.get("storageQuota"), dict) else {}
    try:
        limit = int(q["limit"]) if q.get("limit") not in (None, "") else None
        usage = int(q.get("usage") or 0)
    except (TypeError, ValueError):
        limit, usage = None, 0
    if limit is None:
        checks.append(_check("quota", "ok", "לחשבון אין מגבלת נפח מדווחת."))
    else:
        free = max(0, limit - usage)
        gb = free / (1024 ** 3)
        need = cfg["min_free_mib"] * og.MIB
        if free < need:
            checks.append(_check("quota", "fail", f"נשארו רק {gb:.2f} GB פנויים ב־Drive - פחות מהמינימום שהוגדר ליעד.",
                                 "מפנים מקום ב־Drive (drive.google.com › Storage) או מקטינים את 'מינימום פנוי' בהגדרות היעד."))
        elif free < need * 5:
            checks.append(_check("quota", "warn", f"נשארו {gb:.2f} GB פנויים ב־Drive. זה מעט; כדאי לפנות מקום."))
        else:
            checks.append(_check("quota", "ok", f"פנויים {gb:.1f} GB ב־Drive."))
    name = cfg["folder_name"]
    q_folder = f"name = '{name}' and mimeType = '{og.FOLDER_MIME}' and trashed = false"
    try:
        r = http.get(f"{og.DRIVE_API}/drive/v3/files", params={"q": q_folder, "fields": "files(id)", "spaces": "drive", "pageSize": "10"}, headers=hdr)
    except httpx.HTTPError:
        checks.append(_check("folder", "warn", "לא ניתן היה לחפש את תיקיית הגיבוי."))
        return
    if r.status_code != 200:
        checks.append(_check("folder", "warn", f"החיפוש של תיקיית הגיבוי נכשל (HTTP {r.status_code})."))
        return
    files = og._json(r).get("files") or []
    if files:
        extra = " (נמצאו כמה תיקיות בשם הזה; הגיבוי משתמש בוותיקה ביותר)" if len(files) > 1 else ""
        checks.append(_check("folder", "ok", f"התיקייה '{name}' קיימת ב־Drive{extra}."))
    else:
        checks.append(_check("folder", "info", f"התיקייה '{name}' עדיין לא קיימת; היא תיווצר בהעלאה הראשונה (או בלחיצה על 'בדיקה')."))
