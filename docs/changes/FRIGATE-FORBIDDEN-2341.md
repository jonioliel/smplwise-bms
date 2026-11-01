# FRIGATE-FORBIDDEN-2341 - refused Frigate credentials: one clear health item instead of a flooded log

Branch `fix/FRIGATE-FORBIDDEN-2341`, cut from `origin/main` @ `e7c72ba25` (2.33.1). Owner-approved task (2026-11-01). No version
bump, no migration, no setting added.

## 1. What was seen (read-only, the owner's home install)

Read through the Supervisor API (add-on info and the add-on journal, about 20 000 lines back to 2026-10-28); nothing was written,
restarted or changed, and Frigate itself was not contacted.

- The Arx add-on (2.33.0) logs `frigate ws (nvr-2): source_forbidden` every 2 minutes and `frigate poll (nvr-2): source_forbidden
  (retry in 60s)` every minute, plus `auto discovery (periodic, nvr-2) failed ... credentials_refused_backoff` and `frigate discovery
  for nvr-2 failed after 3 attempt(s)` every 10 minutes. About 7 600 such lines in the journal window.
- It started on 2026-10-29 19:19, the moment the recorder `nvr-2` was enabled (`PATCH /api/v1/recorders/nvr-2`; the PATCH only flips
  `enabled` / name / order / time zone and never touches the connection or its secret). Before that the recorder was disabled.
- After the add-on restart on 2026-11-01 19:29 the very first login, 0.2 s after start, was already refused; the periodic discovery
  at 19:39 shows the device's answer: `{'op': 'login', 'status': 401, 'reason': 'credentials'}`.

## 2. Root cause

`source_forbidden` is the adapter's code for HTTP 401 / 403 from Frigate (`frigate_http.map_status` / `login`). Here it is Frigate's
own `POST /api/login` answering **401 to the user name and password saved for `nvr-2`** - a configuration matter on the owner's side
(the password was changed or the user removed in Frigate, or a wrong password was saved). It is not an Arx URL, role or
allow-list error: the host answers at once, the request is the documented login, and the guard (`credentials_refused_backoff`) is
the adapter's own login lockout reporting the earlier refusal.

What was Arx's to fix is the reaction: a refusal is not transient, yet the reader retried it every minute (the lockout kept actual
logins at one per 5 minutes, forever) and wrote two WARNING lines a minute, while the health card said only "פרטי הגישה נדחו".

## 3. What changed

- `services/recorders/frigate_http.py`: the login lockout is kept per (device, fingerprint of user + password; never the password)
  and doubles per refusal of the same credentials: 5 -> 10 -> 20 -> 30 -> 30 minutes (`REFUSED_BACKOFF_MAX_S`). Other credentials
  for the same device (a connection test of a corrected password) are never held back by it. A successful login clears it.
  `FrigateHttp.refusal()` exposes `status` / `strikes` / `retry_in_s`; the lockout answer carries `status` and `retry_in_s`.
- `services/recorders/frigate_events.py`: `FailureLog` - the poll and the WebSocket write ONE warning per state change (with the wait
  before the next try and, for refused credentials, what to fix), repeats at DEBUG, one INFO line when it works again. After a
  `source_forbidden` both wait out the adapter's lockout (`forbidden_wait`), doubling up to 30 minutes. Transient failures keep
  their old caps (poll 60 s, WebSocket 120 s). A crashing poll prints its traceback once per state.
- `services/autosync.py`: a repeated failure of the PERIODIC discovery with the same code is logged once; a start, an enable, a
  manual run or a new code is always logged. `frigate discovery ... failed after N attempt(s)` likewise once per code.
- `services/recorder_health.py`: an API error a person must fix carries `api.action`, the exact step in Hebrew; the one
  `recorder.unreachable` notification (already deduplicated per recorder) says where to fix it.
- `frontend` recorder-health panel: shows `api.action` under the "חיבור" row (one short note, no scroll).

A credential change is applied by the restart that saving a connection already asks for, so a long wait never delays a fix.

## 4. Tests

`tests/test_frigate_forbidden_2341.py` (fake Frigate): the delay table; the same refused credentials wait 5/10/20/30/30 minutes and
nothing is sent inside a lockout; a different password is tried at once and does not lift the old one's lockout; success clears it;
`FailureLog` writes one warning per state and one recovery line; two simulated hours of refusals give ONE poll warning and at most 6
logins; recovery is logged once; the periodic discovery logs a repeat once; the health card and the notification carry the Hebrew
fix step, an outage carries none.

## 5. מה צריך לעשות (בעלים)

ה־Frigate של המקליט השני (`nvr-2`) דוחה את שם המשתמש והסיסמה ש־Arx שומר עבורו (תשובה 401 לכניסה), כבר מאז שהמקליט הופעל
ב־29.10. זה לא תקלה ב־Arx, ואין צורך לשנות דבר ב־Frigate עצמו מלבד לוודא שהמשתמש קיים:

1. ב־Frigate › הגדרות › משתמשים: ודאו שהמשתמש ש־Arx משתמש בו קיים, ואם צריך - קבעו לו סיסמה חדשה.
2. ב־Arx › הגדרות › חיבורים › המקליט השני: הזינו את שם המשתמש והסיסמה האלה, לחצו על „בדיקת חיבור” ושמרו.
3. אשרו את ההפעלה מחדש של Arx שהשמירה מבקשת.

אחרי הגרסה עם התיקון: גם אם לא מתקנים מיד, היומן יכיל שורה אחת על הדחייה (ולא שתיים בדקה), Arx ינסה להתחבר לכל היותר פעם
בחצי שעה, וכרטיס המקליטים במסך הבריאות יציג את צעד התיקון המדויק.
