"""Notification sources and their policy (CR-018 section 5 / NOTIFICATIONS_API.md section 1).

The catalogue below is the ONE list of sources and their defaults. A policy row (`notify_policies`, administrator only,
notify.manage) is created from it the first time it is read and is then the administrator's: a later release that adds a
source adds its row, an edit is never overwritten. `emit()` (services/notify.py) reads the policy of its source: enabled,
severity, category, how long the condition must hold (`after_s`), the fold window, the resolve notice, who receives it
(`recipients`) and on which channels.

Titles and bodies are built here from templates and place parameters: ids and names of places and devices, never a person,
a visitor or an image.
"""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from typing import Any

from ..db import now_iso

SEVERITIES = ("info", "alert", "critical")
SEVERITY_RANK = {"info": 0, "alert": 1, "critical": 2}
CATEGORIES = ("safety", "alerts", "doors", "device_faults", "automations", "system", "security", "tickets", "maintenance", "building")  # building: NOTICEPUSH-295 (the notice board's push, services/notices/push.py); tickets: CR-038 (services/tickets/notify_sources.py); maintenance: CR-MAINT215 (owner answer 24.10 q20)
RECIPIENT_RULES = ("scope", "managers", "initiator", "users", "generator", "ticket_managers", "ticket_assignee", "rfq_managers", "elevator", "temperature", "energy_bills", "water", "maintenance", "scenario", "notice")  # notice: NOTICEPUSH-295 (the notice's audience, services/notices/push.py); scenario: XSCENARIO109-295; maintenance: CR-MAINT215 (services/maintenance/reminders.py)  # water: CR-WATER78 slice 2 (services/water_alerts.py)  # energy_bills: ELECBILL77 (holders of energy.bills); elevator: the recipients chosen in Settings > Infrastructure > Elevators (services/elevator_alerts.py)  # rfq_managers: TKRFQ5 (services/tickets/rfq_notify.py); ticket_*: CR-038 (services/tickets/notify_bridge.py); generator: the routing saved on the generator screen (services/generator_alerts.py)
CHANNELS_V1 = ("inbox", "webpush", "email", "app", "announce", "whatsapp")  # app = the SmplWise Arx phone app through the push relay (CR-027); announce = a spoken announcement (ANN2, services/announce_channel.py); whatsapp = the user's own number through the tickets module's WhatsApp infrastructure (NOTIFWA, services/notify_whatsapp.py)
CHANNELS_RESERVED = ("ha_mobile",)
NO_WHATSAPP_SOURCES = ("notify.whatsapp_number",)  # NOTIFWA re-review R2: a notice about the WhatsApp number never goes to WhatsApp
SUBJECT_KINDS = ("camera", "entity", "area", "alarm_panel", "door", "schedule", "automation", "bulk_job", "system", "session", "generator", "ticket", "rfq", "elevator", "temperature", "energy_bills", "access_denied", "water", "maintenance", "incident", "scenario", "notice")  # notice: NOTICEPUSH-295; scenario: XSCENARIO109-295; incident: CR-LIVEEVENT100 (events.read at the incident's floor); maintenance: CR-MAINT215; water: CR-WATER78 slice 2; energy_bills: ELECBILL77; rfq: TKRFQ5; elevator: CR-INFRA-ELEVATORS 2.8.0; temperature: CR-INFRA-TEMPERATURE 2.9.1
SEVERITY_LABEL_HE = {"info": "מידע", "alert": "התראה", "critical": "קריטי"}


@dataclass(frozen=True)
class Source:
    key: str
    label: str  # Hebrew, the settings tab's row
    category: str
    severity: str
    title: str  # the type, e.g. "דליפת מים"; `{name}` / `{place}` are filled from the signal's params
    body: str
    after_s: int = 0
    window_s: int = 0  # 0 = until the condition ends (resolve) - never folded by time
    resolve_notice: bool = False
    who: str = "scope"
    push: bool = True
    email: bool = False
    enabled: bool = True
    subject: str = "entity"
    resolve_text: str = "הסתיים"
    resolves: bool = True  # the source emits resolve signals; False = the acknowledge closes the row (rule alerts, results, sign-ins)
    app: bool = False  # the phone-app channel on by default (NOTIFWA: the WhatsApp number-change notice)


def _s(*a: Any, **k: Any) -> Source:
    return Source(*a, **k)


SOURCES: tuple[Source, ...] = (
    # ---- safety
    _s("sensor.leak", "דליפת מים", "safety", "critical", "דליפת מים", "{name} דיווח על מים.", resolve_notice=True, resolve_text="החיישן יבש"),
    _s("sensor.smoke", "עשן", "safety", "critical", "עשן", "{name} זיהה עשן.", resolve_notice=True, resolve_text="הגלאי נרגע"),
    _s("sensor.gas", "גז", "safety", "critical", "גז", "{name} זיהה גז.", resolve_notice=True, resolve_text="הגלאי נרגע"),
    _s("sensor.co", "פחמן חד־חמצני", "safety", "critical", "פחמן חד־חמצני", "{name} זיהה פחמן חד־חמצני.", resolve_notice=True, resolve_text="הגלאי נרגע"),
    _s("alarm.triggered", "אזעקה הופעלה", "safety", "critical", "אזעקה הופעלה", "{name} עבר למצב \"הופעלה\".", resolve_notice=True, subject="alarm_panel", resolve_text="האזעקה כובתה"),
    _s("alarm.arm_failed", "דריכת האזעקה נכשלה", "safety", "alert", "דריכת האזעקה נכשלה", "{name} לא אישר את הדריכה.", window_s=60, subject="alarm_panel", resolves=False),
    _s("alarm.state", "דריכה וניטרול של האזעקה", "doors", "info", "מצב האזעקה השתנה", "{name}: {state}.", window_s=60, push=False, enabled=False, subject="alarm_panel", resolves=False),
    # ---- faults
    _s("camera.offline", "מצלמה לא זמינה", "device_faults", "alert", "מצלמה לא זמינה", "{name} לא עונה למקליט.", after_s=120, subject="camera", resolve_text="המצלמה חזרה"),
    _s("nvr.offline", "מקליט לא זמין", "device_faults", "critical", "המקליט לא זמין", "אין תקשורת עם המקליט.", after_s=120, who="managers", email=True, subject="system", resolve_notice=True, resolve_text="המקליט חזר"),
    _s("nvr.storage", "אחסון המקליט", "device_faults", "critical", "תקלת אחסון במקליט", "{name}.", who="managers", email=True, subject="system", resolve_notice=True, resolve_text="האחסון תקין"),
    # CR-026 recorder health (services/recorder_health.py): per recorder; camera connectivity stays `camera.offline`
    _s("recorder.unreachable", "מקליט לא עונה", "device_faults", "critical", "מקליט לא עונה", "{name}: {detail}.", after_s=120, who="managers", email=True, subject="system", resolve_notice=True, resolve_text="המקליט חזר לענות"),
    _s("recorder.slow", "מקליט איטי", "device_faults", "info", "מקליט איטי", "{name}: {detail}.", after_s=300, who="managers", push=False, subject="system", resolve_text="זמן התגובה תקין"),
    _s("recorder.disk", "דיסק במקליט", "device_faults", "critical", "תקלת דיסק במקליט", "{name}: {detail}.", after_s=60, who="managers", email=True, subject="system", resolve_notice=True, resolve_text="הדיסק תקין"),
    _s("recorder.disk_space", "דיסק המקליט מתמלא", "device_faults", "info", "דיסק המקליט מתמלא", "{name}: {detail}.", who="managers", push=False, subject="system", resolve_text="יש מספיק מקום"),
    _s("recorder.recording", "מצלמה לא מקליטה", "device_faults", "alert", "מצלמה לא מקליטה", "{name}: {detail}.", after_s=60, who="managers", subject="camera", resolve_notice=True, resolve_text="ההקלטה חזרה"),
    _s("recorder.clock", "שעון המקליט", "device_faults", "alert", "שעון המקליט סוטה", "{name}: {detail}.", after_s=600, who="managers", push=False, subject="system", resolve_text="השעון תקין"),
    _s("recorder.certificate", "תעודת המקליט", "device_faults", "alert", "תעודת המקליט עומדת לפוג", "{name}: {detail}.", who="managers", push=False, email=True, subject="system", resolve_text="התעודה חודשה"),
    # CAMHEALTH091 (services/camera_image_health.py): the PICTURE of a camera is dark, blurred, frozen or shifted. One row per camera and
    # problem kind. The sampling job is OFF by default (Settings > Health), so nothing fires until it is switched on; recipients here.
    _s("camera.image", "תמונת מצלמה לא תקינה", "device_faults", "alert", "בעיה בתמונת המצלמה", "{name}: {detail}.", who="managers", push=False,
       subject="camera", resolve_text="התמונה תקינה"),
    _s("device.unavailable", "התקן לא זמין", "device_faults", "info", "התקן לא זמין", "{name} לא זמין.", after_s=900, push=False, resolve_text="ההתקן חזר"),
    # CR-INFRA-ELEVATORS 2.8.0 (services/elevators_runtime.py): one source per alerting role, judged on that role's sensor. Owner decision 2026-10-18:
    # OFF by default, nobody, inbox only - the master / per-state switches, the recipients and the channels are chosen in Settings > Infrastructure >
    # Elevators and mirrored here (services/elevator_alerts.py; recipients rule `elevator`).
    _s("elevator.fire_service", "מעלית: פיקוד כבאים", "device_faults", "critical", "פיקוד כבאים במעלית", "{name} עברה למצב פיקוד כבאים.", who="elevator",
       push=False, enabled=False, subject="elevator", resolve_notice=True, resolve_text="המעלית יצאה ממצב פיקוד כבאים"),
    _s("elevator.fault", "מעלית: תקלה", "device_faults", "alert", "תקלה במעלית", "{name} מדווחת על תקלה.", who="elevator", push=False, enabled=False,
       subject="elevator", resolve_text="התקלה הסתיימה"),
    _s("elevator.out_of_service", "מעלית: השבתה", "device_faults", "info", "מעלית בהשבתה", "{name} בהשבתה.", who="elevator", push=False, enabled=False,
       subject="elevator", resolve_text="ההשבתה הסתיימה"),
    # CR-INFRA-TEMPERATURE 2.9.1 (services/temperature_runtime.py): the temperature units. ON by default (a unit exists to raise alerts); the
    # recipients and channels are chosen in Settings > Infrastructure > Temperatures and mirrored here (services/temperature_alerts.py; rule
    # `temperature`). The module holds WARNINGS in its own quiet hours / mute before emitting; an alarm is never held.
    _s("temperature.alarm", "טמפרטורה: אזעקה", "device_faults", "critical", "אזעקת טמפרטורה", "{name}: {detail}.", who="temperature", subject="temperature",
       resolve_notice=True, resolve_text="היחידה חזרה לתקין", app=True),
    _s("temperature.warning", "טמפרטורה: חריגה מהטווח", "device_faults", "alert", "חריגת טמפרטורה", "{name}: {detail}.", who="temperature", subject="temperature",
       resolve_text="הטמפרטורה חזרה לטווח"),
    _s("temperature.offline", "טמפרטורה: חיישן לא מדווח", "device_faults", "alert", "חיישן טמפרטורה לא מדווח", "{name}: {detail}.", who="temperature", push=False,
       subject="temperature", resolve_text="החיישן חזר לדווח"),
    # phase 3: sensor health (a low battery, a frozen reading) and a suspected cooling fault (slow recovery, a rising duty cycle) - a WARNING
    # class; and the escalation chain of an unacknowledged alarm (each step to its own tier; critical, never held by quiet hours)
    _s("temperature.health", "טמפרטורה: תקינות חיישן ויחידה", "device_faults", "alert", "בעיה ביחידת טמפרטורה", "{name}: {detail}.", who="temperature",
       push=False, subject="temperature", resolve_text="הבעיה נפתרה"),
    _s("temperature.escalation", "טמפרטורה: הסלמת אזעקה", "device_faults", "critical", "אזעקת טמפרטורה לא אושרה", "{name}: {detail}.", who="temperature",
       subject="temperature", resolve_notice=True, resolve_text="האזעקה אושרה או הסתיימה", app=True),
    # CR-WATER78 slice 2 (services/water_runtime.py): the water meters' leak alerts, only while the water module is on (the policy matrix hides
    # them while it is off). ON by default (owner Q3); the recipients and channels are chosen in Settings > Infrastructure > Water and mirrored
    # here (services/water_alerts.py; rule `water`, subject `water` = water.view on the meter, floor-scoped). A night-flow WARNING is sent at
    # severity alert, an ALARM (a burst, or flow through the whole night window) at critical. Never a device action.
    _s("water.leak", "מים: דליפה חשודה", "device_faults", "critical", "דליפת מים חשודה", "{name}: {detail}.", who="water", subject="water",
       resolve_notice=True, resolve_text="הזרימה נעצרה", app=True),
    _s("water.abnormal", "מים: צריכה חריגה", "device_faults", "alert", "צריכת מים חריגה", "{name}: {detail}.", who="water", subject="water",
       resolve_text="הצריכה חזרה לרגיל"),
    _s("water.offline", "מים: מונה לא מדווח", "device_faults", "alert", "מונה מים לא מדווח", "{name}: {detail}.", who="water", push=False,
       subject="water", resolve_text="המונה חזר לדווח"),
    # XSCENARIO109-295 (CR-SCENARIO109 sections 4 and 8, owner Q7 = 216 a): a scenario's notify action. Two rows per fire: the detailed one to
    # the addressed people who may see every module the scenario reads, the generic one (no values) to the other addressed people. The
    # recipients are the action's own list (rule `scenario`, chosen in the editor; default list in Settings). Listed only while the module is on.
    _s("scenario.fired", "תרחיש: הופעל", "automations", "alert", "תרחיש הופעל", "{name}: {detail}", who="scenario", push=False, subject="scenario",
       resolve_text="התנאים כבר לא מתקיימים"),
    _s("scenario.fired_generic", "תרחיש: הופעל (בלי פרטים)", "automations", "alert", "תרחיש הופעל", "{name}. אין הרשאה להצגת הפרטים.", who="scenario",
       push=False, subject="scenario", resolve_text="התנאים כבר לא מתקיימים"),
    _s("scenario.degraded", "תרחיש: לא ניתן להעריך", "automations", "info", "תרחיש לא ניתן להעריך", "{name}: {detail}", who="scenario", push=False,
       enabled=False, subject="scenario", resolve_text="התרחיש חזר לפעול"),
    # CR-MAINT215 (services/maintenance/reminders.py): a certificate / inspection / supplier document before its expiry, a plan or a round
    # before its date, and once it is late. To the task's responsible person and the maintenance managers of its place (rule `maintenance`),
    # in the app only by default; nothing fires while the maintenance module is off. The task's title and a date - never a person.
    _s("maintenance.due_soon", "תחזוקה: מועד מתקרב", "maintenance", "info", "מועד מתקרב: {name}", "{name} - {what} {date}.", who="maintenance",
       push=False, subject="maintenance", resolve_text="בוצע או עודכן"),
    _s("maintenance.overdue", "תחזוקה: מועד עבר", "maintenance", "alert", "מועד עבר: {name}", "{name} - {what}{date}.", who="maintenance",
       push=False, subject="maintenance", resolve_text="בוצע או עודכן"),
    # NOTICEPUSH-295 (services/notices/push.py): a notice of the building's notice board, sent ONCE on publish to the notice's audience (rule `notice`),
    # resolved when the notice is archived or ends. The title is the notice's own title, the body its first 160 characters; no person is named.
    # Nothing exists while the notice board is off. The app and web-push channels are on; e-mail is the administrator's choice like any source.
    _s("notice.published", "לוח הודעות: הודעה חדשה", "building", "info", "{name}", "{body}", who="notice", push=True, app=True, subject="notice",
       resolve_text="ההודעה הוסרה מהלוח"),
    _s("device.battery_low", "סוללה חלשה", "device_faults", "info", "סוללה חלשה", "{name}: {level}.", window_s=86400, push=False, resolve_text="הסוללה הוחלפה"),
    _s("system.health", "תקלת מערכת", "system", "alert", "תקלת מערכת", "{name}.", after_s=300, who="managers", email=True, subject="system", resolve_text="התקלה נפתרה"),
    _s("backup.failed", "גיבוי נכשל", "system", "alert", "הגיבוי נכשל", "הגיבוי האוטומטי לא הסתיים.", window_s=86400, who="managers", push=False, email=True, subject="system", resolve_text="גיבוי הצליח"),
    _s("backup.stale", "גיבוי ישן", "system", "info", "הגיבוי ישן", "{name}.", window_s=86400, who="managers", push=False, email=True, subject="system", resolve_text="גיבוי הצליח"),
    # DATASTORE-295 phase 2 (services/offbox_runtime.py): an off-box copy of the daily backup failed or did not verify; one row per target
    # (subject `offbox:<target id>`), resolved by that target's next verified copy. Never a credential, a host or an endpoint in it.
    _s("backup.offbox_failed", "עותק גיבוי מחוץ למכונה נכשל", "system", "alert", "העותק מחוץ למכונה נכשל", "{name}: {detail}.", window_s=86400,
       who="managers", push=False, email=True, subject="system", resolve_text="העותק הבא הצליח"),
    _s("update.available", "עדכון זמין", "system", "info", "עדכון זמין", "גרסה {version} מוכנה להתקנה.", who="managers", push=False, email=True, subject="system", resolve_text="הגרסה הותקנה"),
    _s("notify.channel", "ערוץ התראות לא פועל", "system", "alert", "ערוץ התראות לא פועל", "{name}.", who="managers", push=False, subject="system", resolve_text="הערוץ חזר"),
    # PARTNERAPI113-295 (services/partner): the partner interface's notices to the administrators - a token expires soon, the person who created a
    # token is gone (owner answer 170: the token stays, the managers are told), a webhook target was paused by the circuit. Never a token or a URL.
    _s("partner.token_expiring", "ממשק שותפים: אסימון עומד לפוג", "system", "info", "אסימון שותף עומד לפוג", "{name}: בתוקף עד {detail}.", who="managers",
       push=False, subject="system", resolves=False),
    _s("partner.owner_gone", "ממשק שותפים: יוצר האסימון אינו פעיל", "system", "info", "יוצר אסימון שותף אינו פעיל", "{name}: האסימון נשאר בתוקף.",
       who="managers", push=False, subject="system", resolves=False),
    _s("partner.endpoint_paused", "ממשק שותפים: יעד הודעות הושהה", "system", "alert", "יעד הודעות לשותף הושהה", "{name}: המשלוחים נכשלו ברצף.",
       who="managers", push=False, subject="system", resolves=False),
    # ---- doors
    _s("opening.left_open", "דלת / חלון נשארו פתוחים", "doors", "alert", "פתוח זמן רב", "{name} פתוח יותר מ־{minutes} דקות.", after_s=600, resolve_text="נסגר"),
    _s("door.ring", "צלצול בדלת", "doors", "alert", "צלצול בדלת", "מישהו מצלצל ב{name}.", window_s=60, subject="door", resolve_text="הצלצול הסתיים"),
    # CR-039 / DOORWIN-295: door windows and emergency door controls (all shipped OFF; nothing fires while the switches are off, except
    # drills, which notify by the inbox only). Never a person's name: `{name}` is the door, `{actor}` is never filled (the audit carries who).
    _s("door.relock_unconfirmed", "חלון פתיחה: חזרה למצב רגיל לא אושרה", "doors", "critical", "דלת אולי פתוחה",
       "{name}: החלון הסתיים ולא אושרה חזרה למצב רגיל.", who="managers", subject="door", resolve_text="חזרה למצב רגיל אושרה", resolve_notice=True),
    _s("door.window_not_started", "חלון פתיחה לא התחיל", "doors", "alert", "חלון פתיחה לא התחיל", "{name}: המערכת לא אישרה את הפתיחה.",
       who="managers", subject="door", resolves=False),
    _s("door.window_overridden", "חלון פתיחה הופסק ידנית", "doors", "info", "חלון הופסק", "{name}: החלון הופסק לפני הזמן.", who="managers",
       push=False, subject="door", resolves=False),
    # DOORWIN2-295 (CR-039 9.2 / 9.4): event-triggered windows. A simulated trigger is an inbox notice to the person whose approval covers the rule
    # ("this window would have opened"); the storm cap alerts the managers once an hour. Neither names a person or carries an event payload.
    _s("door.windows.simulated", "חלון פתיחה לפי אירוע (מצב הדגמה)", "doors", "info", "היה נפתח חלון", "{name} עד {until} (מצב הדגמה).", who="initiator",
       push=False, subject="door", resolves=False),
    _s("door.windows.storm", "יותר מדי הפעלות של חלונות לפי אירוע", "doors", "alert", "יותר מדי הפעלות", "הפעלות לפי אירוע נעצרו לשעה.", who="managers",
       subject="door", window_s=3600, resolves=False),
    _s("door.emergency.started", "מצב חירום בדלתות", "doors", "critical", "מצב חירום: {kind}", "{kind} ל־{count} דלתות ({scope}).",
       who="managers", subject="door", resolve_text="מצב החירום הסתיים", app=True),
    _s("door.emergency.partial", "חירום: לא כל הדלתות אישרו", "doors", "critical", "חירום: לא כל הדלתות אישרו",
       "{failed} מתוך {count} דלתות לא אישרו.", who="managers", subject="door", resolve_text="מצב החירום הסתיים"),
    _s("door.emergency.released", "מצב חירום הסתיים", "doors", "alert", "מצב החירום הסתיים", "{kind} שוחרר ({scope}).", who="managers",
       subject="door", resolves=False),
    _s("door.emergency.drill", "תרגיל חירום בדלתות", "doors", "info", "תרגיל חירום", "תרגיל {kind} ({scope}) - ללא פעולה אמיתית.",
       who="managers", push=False, subject="door", resolves=False),
    # CR-LIVEEVENT100 (services/incidents.py): a live event was opened (alarm hook, the event page, the map, a manual opening). Only ever
    # signalled while the module is ON (default OFF). Recipients: everyone who may read the incident's floor (events.read) - editable here
    # like every source; the acknowledge of the notification is a step of the incident's chain. Never a person in the text.
    _s("incident.opened", "אירוע חי נפתח", "security", "critical", "אירוע חי", "{name} · {place}.", subject="incident", resolve_text="האירוע נסגר",
       app=True),
    # ---- automations
    _s("schedule.not_confirmed", "תזמון לא בוצע", "automations", "alert", "תזמון לא בוצע", "{name}: {detail}.", window_s=3600, who="managers", subject="schedule", resolve_text="הריצה הבאה אושרה"),
    _s("automation.failed", "אוטומציה נכשלה", "automations", "alert", "אוטומציה נכשלה", "{name}: {detail}.", window_s=600, who="managers", subject="automation", resolves=False),
    _s("automation.notify", "הודעה מאוטומציה", "automations", "alert", "הודעה מאוטומציה", "{name}.", window_s=600, subject="automation", resolves=False),
    # WA-CONSENT-LINK (services/intercom_consent.py): a message held for a person's consent was not sent (declined / no answer / ...) - to the
    # SENDER only, in the app; no person name, no text, no number
    _s("intercom.message_dropped", "הודעת וואטסאפ שהוחזקה לא נשלחה", "automations", "info", "הודעה לא נשלחה", "{detail}", window_s=60, who="initiator",
       push=False, subject="session", resolves=False),
    _s("bulk.partial", "תוצאת פעולה קבוצתית / סצנה", "automations", "info", "פעולה קבוצתית", "{name}: {detail}.", window_s=3600, who="initiator", push=False, subject="bulk_job", resolves=False),
    # ---- security
    _s("security.new_signin", "כניסה חדשה / גישה מרחוק", "security", "alert", "כניסה חדשה לחשבון", "כניסה ממכשיר חדש. אם זה לא אתה - נתק את הכניסה.", window_s=3600, who="initiator", subject="session", resolves=False),
    # NOTIFWA re-review R2: the number behind the user's own WhatsApp opt-in changed - told in the app (and by push / the phone app),
    # NEVER on WhatsApp (that would reach the new number); no digits in it
    _s("notify.whatsapp_number", "מספר הוואטסאפ שלך השתנה", "security", "alert", "מספר הוואטסאפ שלך השתנה",
       "התראות בוואטסאפ הופסקו עד שתאשר את המספר בהגדרות › התראות. אם לא ביקשת שינוי - פנה למנהל המערכת.", who="initiator", subject="session",
       resolves=False, app=True),
    _s("security.lockout", "נעילת קוד", "security", "alert", "נעילת קוד", "הוזנו קודים שגויים ונשארה נעילה זמנית.", window_s=3600, subject="session", resolves=False),
    # TFA2: an administrator reset the account's second factor - the account's own user is told (never who, never a secret)
    _s("security.second_factor_reset", "איפוס אימות דו־שלבי", "security", "alert", "האימות הדו־שלבי של החשבון אופס", "מנהל המערכת אפס את האימות הדו־שלבי של החשבון שלך. אם לא ביקשת זאת - פנה למנהל המערכת. אפשר להפעיל אותו מחדש ב״החשבון שלי״.", window_s=3600, who="initiator", subject="session", resolves=False),
    # APPREFRESH3-295 (owner Q297): an administrator approved a reset of the user's phone-app device key - the device's own user is told in
    # the app and on the phone; the title / body are the wording kept in the Settings (security.app_refresh_key_reset_notice_*), rendered
    # by services/app_refresh before the signal (never the administrator, the reason or key material)
    _s("security.app_device_key_reset", "איפוס מפתח האבטחה של האפליקציה", "security", "alert", "{notice_title}", "{notice_body}", window_s=3600,
       who="initiator", subject="session", resolves=False, app=True),
    # APPREFRESH3-295 (owner Q312): the user's own sign-out released the phone-app device key - told the same way, its own wording
    # (security.app_refresh_key_released_notice_*)
    _s("security.app_device_key_released", "שחרור מפתח האבטחה של האפליקציה", "security", "alert", "{notice_title}", "{notice_body}", window_s=3600,
       who="initiator", subject="session", resolves=False, app=True),
    # USR2 phase 2 (CR-USR2 §3, security review F7): the Arx-only sign-in's security events, to the managers (a `system` subject:
    # system.configure). Content-free - never a username, an address or a person; the audit rows carry the user id.
    _s("security.local_storm", "ניסיונות כניסה רבים של משתמשי Arx", "security", "alert", "ניסיונות כניסה רבים של משתמשי Arx",
       "מספר חריג של כניסות כושלות או עומס על בדיקת הסיסמאות. כניסות של חשבונות רדומים נדחות זמנית. פרטים באודיט.", window_s=3600, who="managers",
       subject="system", resolves=False),
    _s("security.local_account_delayed", "חשבון Arx מושהה מרשת אחת", "security", "alert", "ניסיונות שגויים לחשבון Arx",
       "עשרה ניסיונות כניסה שגויים לחשבון אחד מאותה רשת; הכניסות מהרשת הזו מושהות. פרטים בהגדרות › משתמשי Arx ובאודיט.", window_s=3600, who="managers",
       subject="system", resolves=False),
    _s("security.local_account_locked", "חשבון Arx ננעל", "security", "alert", "חשבון Arx ננעל זמנית",
       "חשבון של משתמש Arx ננעל ל־15 דקות אחרי ניסיונות שגויים רבים מכמה רשתות. אפשר לשחרר בהגדרות › משתמשי Arx.", window_s=3600, who="managers",
       subject="system", resolves=False),
    _s("security.local_passkey_clone", "חשד לשכפול מפתח גישה", "security", "alert", "חשד לשכפול מפתח גישה",
       "מפתח גישה (passkey) של משתמש Arx דיווח על מונה נמוך מהידוע - ייתכן שהוא שוכפל. הכניסה נדחתה. פרטים באודיט ובהגדרות › משתמשי Arx.",
       window_s=3600, who="managers", subject="system", resolves=False),
    # CR-ARX-WISKEY-SHARED-IDENTITY: external-person door grants, to the managers (a `system` subject). Content-free - never a name, a
    # number, a door or a code; the grant screen and the audit carry the ids.
    _s("access.grant_request", "בקשת גישה זמנית לאדם חיצוני", "security", "info", "בקשת גישה זמנית",
       "ספק ביקש גישת כניסה לטכנאי. האישור נעשה במסך הגישות הזמניות.", window_s=600, who="managers", push=False, subject="system", resolves=False),
    _s("access.grant_attention", "גישה זמנית דורשת טיפול", "security", "alert", "גישה זמנית דורשת טיפול",
       "קוד לא נמסר, ביטול ממתין לאישור מערכת הכניסה או הפעלה שנכשלה. פרטים במסך הגישות הזמניות.", window_s=600, who="managers", subject="system",
       resolves=False),
    # SHAREDID-293 (owner decisions 3 and 4, 2026-10-20): the manual "confirmed gone" closure is told to every manager; the weekly digest
    # is a notice only ("a new digest is ready") - in the app and on the phone by default, WhatsApp when the digest's channel setting says so.
    # Content-free like the two above: the screen carries the names.
    _s("access.grant_closed_manual", "ביטול גישה נסגר באישור ידני", "security", "alert", "ביטול גישה נסגר באישור ידני",
       "מנהל מערכת אישר ידנית שאדם אינו קיים עוד במערכת הכניסה וסגר את הביטול. פרטים במסך גישת חוץ.", who="managers", subject="system", resolves=False),
    _s("access.weekly_digest", "סיכום שבועי של גישת חוץ", "security", "info", "סיכום שבועי של גישת חוץ",
       "יש סיכום שבועי חדש. הפרטים במסך גישת חוץ.", who="managers", subject="system", resolves=False, app=True),
    # DENYALERT133-295 (services/access_denied.py): a refused entry attempt at a station of the external access - one row per grant + station,
    # folded with a count inside the window; to the holders of access.external.grant on THAT station (subject kind `access_denied`). Station,
    # short grant reference, local time and a closed reason only - never a PIN, a card, a name or a number. Listed and emitted only while its own
    # switch (`access.external.denied_alert`, default off) and the external-access feature are on. A burst raises it to `alert`, never `critical`.
    _s("access.denied_attempt", "ניסיון כניסה נדחה (גישת חוץ)", "security", "info", "ניסיון כניסה נדחה",
       "{place}: ניסיון כניסה נדחה ({reason}) בשעה {time}. גישה {ref}.", window_s=600, subject="access_denied", resolves=False),
    # EXTERNALBUILD-297 (CR-VISITOR105 4.6, services/access_entries.py): the host's visitor entered - to the host only (subject kind
    # `access_visitor`). The door's name and the local time - never the visitor's name, number or an image.
    _s("access.visitor.arrived", "המבקר שלך נכנס", "security", "info", "המבקר שלך נכנס", "המבקר שלך נכנס: {place}, בשעה {time}.",
       subject="access_visitor", resolves=False),
    # NEEDSREVIEW (2.8.0, lead decision 6): the yearly privacy reminder - once in January when the "needs review" report is not empty
    # (services/needs_review.py). Content-free: a count only, never a name or a number; the review and every deletion stay manual.
    _s("privacy.needs_review", "תזכורת שנתית: דוח דורש בחינה", "security", "info", "דוח דורש בחינה",
       "{count} אנשים ממתינים לבחינה בדוח דורש בחינה. הבחינה והמחיקה ידניות.", who="managers", push=False, subject="system", resolves=False),
    # ELECBILL77 (services/energy_notify.py): an automatic monthly electricity bill draft was computed - to the holders of energy.bills
    # (installation scope; subject kind `energy_bills`). Period only: never an amount, a customer or an account name. One row per draft.
    # Listed only while the installation has billing accounts (services/energy_notify.listed); phone app on by default, WhatsApp off.
    _s("energy.bill_draft", "חיובי חשמל: טיוטה מוכנה", "system", "info", "טיוטת חיוב חשמל מוכנה", "טיוטה לתקופה {period} מוכנה לעיון.", who="energy_bills",
       subject="energy_bills", resolves=False, app=True),
    # ---- alerts (rules, and the NVR smart events that only rules turn into notifications)
    _s("rule.alert", "התראות מחוקים", "alerts", "alert", "{name}", "{message}", window_s=300, subject="camera", resolve_text="טופל", resolves=False),
    _s("camera.motion", "תנועה (רק דרך חוקים)", "alerts", "info", "תנועה", "{name}.", window_s=300, push=False, enabled=False, subject="camera", resolves=False),
    _s("camera.person", "אדם (רק דרך חוקים)", "alerts", "info", "זיהוי אדם", "{name}.", window_s=300, push=False, enabled=False, subject="camera", resolves=False),
    _s("camera.vehicle", "רכב (רק דרך חוקים)", "alerts", "info", "זיהוי רכב", "{name}.", window_s=300, push=False, enabled=False, subject="camera", resolves=False),
)


def _generator_sources() -> tuple[Source, ...]:
    """CR-031: one source per generator alert type (`generator.<key>`). Routing starts empty: the recipients rule `generator` finds nobody until an
    administrator saves a routing; no push / e-mail by default. The alert always lands in the generator's own history and in the centre."""
    from . import generator_catalog as gc

    return tuple(
        Source(f"generator.{t.key}", f"גנרטור: {t.title_he}", "device_faults", t.severity, t.title_he, t.body, who="generator", push=False, subject="generator", resolve_text="הסתיים", resolves=not t.event)
        for t in gc.ALERT_TYPES
    )


SOURCES = SOURCES + _generator_sources()
from .tickets import notify_sources as _ticket_sources  # noqa: E402 - CR-038 slice 6: the tickets module's sources (plain data, no cycle)
SOURCES = SOURCES + tuple(Source(**kw) for kw in _ticket_sources.source_kwargs())
class _ByKey(dict):  # type: ignore[type-arg]
    """The catalogue by key. A per-generator source `generator.<type>@<generator id>` (CR-031: routing is per generator) resolves to its
    type's catalogue entry; its policy row is its own (`notify_policies.source` is the full key)."""

    @staticmethod
    def _base(key: Any) -> Any:
        return key.split("@", 1)[0] if isinstance(key, str) and key.startswith("generator.") else key

    def __missing__(self, key: Any) -> Source:
        base = self._base(key)
        if base == key:
            raise KeyError(key)
        return self[base]

    def __contains__(self, key: object) -> bool:
        return dict.__contains__(self, self._base(key))

    def get(self, key: Any, default: Any = None) -> Any:
        return dict.get(self, self._base(key), default)


BY_KEY: dict[str, Source] = _ByKey({s.key: s for s in SOURCES})


class _Safe(dict):
    def __missing__(self, key: str) -> str:
        return ""


def render(source: str, params: dict[str, Any]) -> tuple[str, str]:
    """(title, body) of a source from its template and the signal's params; each clipped to the contract's lengths."""
    s = BY_KEY.get(source)
    p = _Safe({k: ("" if v is None else str(v)) for k, v in params.items()})
    if s is None:
        return _clip(str(params.get("title") or source), 80), _clip(str(params.get("body") or ""), 180)
    try:
        body = (str(params.get("_template")) if params.get("_template") else s.body).format_map(p)  # CR-031: a generator alert may carry its own body template
    except (ValueError, IndexError, KeyError):
        body = s.body.format_map(p)
    return _clip(s.title.format_map(p) or s.label, 80), _clip(body, 180)


def _clip(text: str, n: int) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= n else text[: n - 1] + "…"


# ---------------------------------------------------------------- the stored policy

def default_row(s: Source) -> dict[str, Any]:
    return {
        "source": s.key, "enabled": s.enabled, "severity": s.severity, "category": s.category, "after_s": s.after_s, "dedupe_window_s": s.window_s,
        "resolve_notice": s.resolve_notice, "recipients": {"rule": s.who}, "channels": {"inbox": True, "webpush": s.push, "email": s.email, "app": s.app, "announce": False, "ha_mobile": False, "whatsapp": False},  # NOTIFWA: WhatsApp is never on by default
    }


def ensure_defaults(conn: sqlite3.Connection) -> int:
    """Create the policy row of every catalogue source that has none; returns how many were created."""
    have = {r[0] for r in conn.execute("SELECT source FROM notify_policies").fetchall()}
    n = 0
    for s in SOURCES:
        if s.key in have:
            continue
        d = default_row(s)
        conn.execute(
            "INSERT INTO notify_policies(source, enabled, severity, category, after_s, dedupe_window_s, resolve_notice, recipients_json, channels_json, revision, updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?)",
            (s.key, int(d["enabled"]), d["severity"], d["category"], d["after_s"], d["dedupe_window_s"], int(d["resolve_notice"]), json.dumps(d["recipients"]), json.dumps(d["channels"]), now_iso()),
        )
        n += 1
    return n


def row_to_policy(r: sqlite3.Row) -> dict[str, Any]:
    try:
        recipients = json.loads(r["recipients_json"] or "{}")
    except ValueError:
        recipients = {}
    try:
        channels = json.loads(r["channels_json"] or "{}")
    except ValueError:
        channels = {}
    rec: dict[str, Any] = {"rule": recipients.get("rule") if recipients.get("rule") in RECIPIENT_RULES else "scope"}
    if rec["rule"] == "users" or recipients.get("user_ids"):
        rec["user_ids"] = [str(u) for u in (recipients.get("user_ids") or [])][:100]
    return {
        "source": r["source"], "enabled": bool(r["enabled"]), "severity": r["severity"], "category": r["category"], "after_s": r["after_s"],
        "dedupe_window_s": r["dedupe_window_s"], "resolve_notice": bool(r["resolve_notice"]), "recipients": rec,
        "channels": {"inbox": True, "webpush": bool(channels.get("webpush")), "email": bool(channels.get("email")), "app": bool(channels.get("app")), "announce": bool(channels.get("announce")), "ha_mobile": False, "whatsapp": bool(channels.get("whatsapp"))},
        "revision": r["revision"],
    }


def list_policies(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    if not _read_only(conn):
        ensure_defaults(conn)
    rows = {r["source"]: row_to_policy(r) for r in conn.execute("SELECT * FROM notify_policies").fetchall()}
    out = []
    maintenance_on = _maintenance_on(conn)
    for s in SOURCES:  # the catalogue's order; a stored row of a source this release no longer knows is not listed
        if not _ticket_sources.listed(conn, s.key):  # CR-038: the tickets sources exist only while the module is on
            continue
        if s.key.startswith("energy.") and not _energy_listed(conn):  # ELECBILL77: the electricity bill source exists only with billing accounts
            continue
        if s.key == "access.denied_attempt" and not _denied_listed(conn):  # DENYALERT133-295: exists only while its switch and the feature are on
            continue
        if s.key.startswith("water.") and not _water_on(conn):  # CR-WATER78 slice 2: the water sources exist only while the water module is on
            continue
        if s.key.startswith("maintenance.") and not maintenance_on:  # CR-MAINT215: the same rule for the maintenance module
            continue
        if s.key.startswith("notice.") and not _notices_on(conn):  # NOTICEPUSH-295: the notice source exists only while the notice board is on
            continue
        if s.key.startswith("scenario.") and not _scenarios_on(conn):  # XSCENARIO109-295: the scenario sources exist only while the module is on
            continue
        out.append(rows.get(s.key) or {**default_row(s), "revision": 0})
    return out


def _denied_listed(conn: sqlite3.Connection) -> bool:
    from . import access_denied

    return access_denied.switch_on(conn)


def _energy_listed(conn: sqlite3.Connection) -> bool:
    from . import energy_notify

    return energy_notify.listed(conn)


def _water_on(conn: sqlite3.Connection) -> bool:
    from .water_alerts import module_on

    return module_on(conn)


def _scenarios_on(conn: sqlite3.Connection) -> bool:
    from . import scenario_settings

    try:
        return scenario_settings.on(conn, "scenarios.enabled")
    except sqlite3.Error:
        return False


def _notices_on(conn: sqlite3.Connection) -> bool:
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = 'notices.enabled'").fetchone()
    except sqlite3.Error:
        return False
    return bool(row) and str(row[0]) == "true"


def _maintenance_on(conn: sqlite3.Connection) -> bool:
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = 'maintenance.enabled'").fetchone()
    except sqlite3.Error:
        return False
    return bool(row) and str(row[0]) == "true"


def _read_only(conn: sqlite3.Connection) -> bool:
    try:
        return bool(conn.execute("PRAGMA query_only").fetchone()[0])
    except sqlite3.Error:
        return False


def get_policy(conn: sqlite3.Connection, source: str) -> dict[str, Any] | None:
    if source not in BY_KEY:
        return None
    r = conn.execute("SELECT * FROM notify_policies WHERE source = ?", (source,)).fetchone()
    if r is None:
        if _read_only(conn):
            return {**default_row(BY_KEY[source]), "revision": 0}
        ensure_defaults(conn)
        r = conn.execute("SELECT * FROM notify_policies WHERE source = ?", (source,)).fetchone()
        if r is None:  # a per-generator source: its own row, created from the type's defaults on first use
            d = default_row(BY_KEY[source])
            conn.execute(
                "INSERT INTO notify_policies(source, enabled, severity, category, after_s, dedupe_window_s, resolve_notice, recipients_json, channels_json, revision, updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?)",
                (source, int(d["enabled"]), d["severity"], d["category"], d["after_s"], d["dedupe_window_s"], int(d["resolve_notice"]), json.dumps(d["recipients"]), json.dumps(d["channels"]), now_iso()))
            r = conn.execute("SELECT * FROM notify_policies WHERE source = ?", (source,)).fetchone()
    return row_to_policy(r)


def source_info(source: str) -> dict[str, Any]:
    s = BY_KEY[source]
    return {"source": s.key, "label": s.label, "subject_kind": s.subject, "category": s.category}


# owner 2026-10-01: who is told that a schedule was not executed / an automation failed is ONE installation setting
# (`failures_audience`: admins | visible), not a per-source choice - these two sources follow it unless the administrator named users
FAILURE_SOURCES = ("schedule.not_confirmed", "automation.failed")


def effective_recipients(policy: dict[str, Any], audience: str) -> dict[str, Any]:
    """The recipient rule that actually applies: the policy's, except that the failure sources follow `failures_audience`
    (`admins` -> managers, `visible` -> everyone who may see the schedule / automation) while the policy says managers or scope."""
    rec = policy.get("recipients") or {"rule": "scope"}
    if policy.get("source") in FAILURE_SOURCES and rec.get("rule") in ("managers", "scope"):
        return {"rule": "managers" if audience == "admins" else "scope"}
    return rec


class PolicyInvalid(ValueError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(code)
        self.code, self.message, self.details = code, message, details or {}


def validate_update(source: str, body: dict[str, Any]) -> dict[str, Any]:
    """The columns a PUT may change, validated. `ha_mobile` true is refused (`channel_reserved`); `whatsapp` is a real channel since NOTIFWA
    (it sends only while its own master switch is on and an account is mapped - services/notify_whatsapp.py)."""
    out: dict[str, Any] = {}
    for f in ("enabled", "resolve_notice"):  # real booleans only: the string "false" is truthy and must never silently switch something on
        if f in body and not isinstance(body[f], bool):
            raise PolicyInvalid("validation", "הערך חייב להיות כן/לא.", {"field": f})
    if "enabled" in body:
        out["enabled"] = body["enabled"]
    if "severity" in body:
        if body["severity"] not in SEVERITIES:
            raise PolicyInvalid("validation", "חומרה לא מוכרת.", {"field": "severity"})
        out["severity"] = body["severity"]
    if "category" in body:
        if body["category"] not in CATEGORIES:
            raise PolicyInvalid("validation", "קטגוריה לא מוכרת.", {"field": "category"})
        out["category"] = body["category"]
    for f, hi in (("after_s", 86400), ("dedupe_window_s", 7 * 86400)):
        if f in body:
            v = body[f]
            if isinstance(v, bool) or not isinstance(v, int) or not 0 <= v <= hi:
                raise PolicyInvalid("validation", "ערך מספרי מחוץ לטווח.", {"field": f})
            out[f] = v
    if "resolve_notice" in body:
        out["resolve_notice"] = body["resolve_notice"]
    if "recipients" in body:
        r = body["recipients"] or {}
        rule = r.get("rule")
        if rule not in RECIPIENT_RULES:
            raise PolicyInvalid("validation", "כלל נמענים לא מוכר.", {"field": "recipients.rule"})
        if source in FAILURE_SOURCES and rule in ("managers", "scope"):
            rule = None  # decided by the installation setting `failures_audience`; the stored rule stays as it is (the client sends the whole body back)
        rec: dict[str, Any] = {"rule": rule}
        if rule is None:
            pass
        elif rule == "users":
            ids = r.get("user_ids")
            if not isinstance(ids, list) or not ids or not all(isinstance(i, str) and 0 < len(i) <= 128 for i in ids) or len(ids) > 100:
                raise PolicyInvalid("validation", "יש לבחור משתמש אחד לפחות.", {"field": "recipients.user_ids"})
            rec["user_ids"] = sorted(set(ids))
        if rule is not None:
            out["recipients_json"] = json.dumps(rec)
    if "channels" in body:
        ch = body["channels"] or {}
        if not isinstance(ch, dict) or any(k in ch and not isinstance(ch[k], bool) for k in ("inbox", "webpush", "email", "ha_mobile", "whatsapp", "app", "announce")):
            raise PolicyInvalid("validation", "ערוצים: ערכי כן/לא בלבד.", {"field": "channels"})
        for reserved in CHANNELS_RESERVED:
            if ch.get(reserved):
                raise PolicyInvalid("channel_reserved", "הערוץ הזה עדיין לא זמין.", {"channel": reserved})
        if ch.get("whatsapp") and source in NO_WHATSAPP_SOURCES:
            raise PolicyInvalid("channel_not_allowed", "ההודעה הזו לא נשלחת בוואטסאפ.", {"channel": "whatsapp"})
        if ch.get("inbox") is False:
            raise PolicyInvalid("validation", "מרכז ההתראות פעיל תמיד.", {"field": "channels.inbox"})
        out["channels_json"] = json.dumps({"inbox": True, "webpush": bool(ch.get("webpush")), "email": bool(ch.get("email")), "app": bool(ch.get("app")), "announce": bool(ch.get("announce")), "ha_mobile": False, "whatsapp": bool(ch.get("whatsapp"))})
    return out
