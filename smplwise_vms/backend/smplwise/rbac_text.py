"""I18N-BACKEND-2490 (third pass): the built-in role names (roles.json `name_he`) and the scope names `rbac.scope_name` builds - Hebrew
exactly as rbac.py read / wrote it before this change, English written by hand with the words of the frontend's English catalogue
(frontend/src/i18n/lang/en/i18n/msg/api-system.ts and system-b.ts for the role names, en.ts `roleNames`, docs/i18n/GLOSSARY_EN.md).
Keys are `role.<role id>` (a test proves each Hebrew equals roles.json) and `scope.<name>`. A `{tickets}` token stays a token in both
languages: rbac.role_name fills it with the tickets module's configured name in the same language (services/tickets/naming.py)."""
from __future__ import annotations

from .i18n import register

ROLES: dict[str, tuple[str, str]] = {
    "viewer": ("צופה", "Viewer"),
    "kiosk": ("תצוגת קיוסק", "Kiosk display"),
    "operator": ("מפעיל", "Operator"),
    "editor": ("עורך מפות ותצוגות", "Map and view editor"),
    "site_admin": ("מנהל אתר / מבנה / קומה", "Site / building / floor administrator"),
    "system_admin": ("מנהל מערכת", "System administrator"),
    "door_opener": ("פותח דלתות", "Door opener"),
    "tickets_view": ("צפייה ב{tickets}", "View {tickets}"),
    "tickets_create": ("פתיחת {tickets}", "Open {tickets}"),
    "tickets_manage": ("ניהול {tickets}", "Manage {tickets}"),
    "tickets_all_departments": ("כל המחלקות ב{tickets}", "All departments in {tickets}"),
    "tickets_external": ("שליחת {tickets} לגורם חיצוני", "Send {tickets} to an external party"),
    "tickets_configure": ("הגדרות {tickets}", "{tickets} settings"),
    "tickets_costs_view": ("צפייה בעלויות {tickets}", "View {tickets} costs"),
    "tickets_costs": ("אישור עלויות {tickets}", "Approve {tickets} costs"),
    "tickets_delete": ("מחיקת {tickets}", "Delete {tickets}"),
    "tickets_handlers": ("ניהול מטפלים וספקים ב{tickets}", "Manage handlers and vendors in {tickets}"),
    "tickets_directory": ("ספריית ספקים ואנשי קשר חיצוניים ב{tickets}", "Directory of vendors and external contacts in {tickets}"),
    "tickets_technician_requests": ("אישור בקשות טכנאים מספקים ב{tickets}", "Approve technician requests from vendors in {tickets}"),
    "tickets_intake": ("קליטת פניות ב{tickets}", "Request intake in {tickets}"),
    "door_windows_manager": ("ניהול חלונות פתיחה", "Manage door windows"),
    "door_windows_guard": ("הפסקת חלון פתיחה", "Stop a door window"),
    "emergency_lock": ("נעילת חירום", "Emergency lock"),
    "emergency_open": ("פתיחת חירום", "Emergency open"),
    "security_manager": ("אחראי ביטחון", "Security manager"),
    "notices_manage": ("לוח הודעות: כתיבה", "Notice board: write"),
    "notices_push": ("לוח הודעות: שליחת התראה", "Notice board: send a notification"),
    "notices_delete": ("לוח הודעות: מחיקה", "Notice board: delete"),
    "notices_boards": ("לוח הודעות: לוחות תצוגה", "Notice board: display boards"),
    "announcer": ("מכריז: הכרזות קוליות", "Announcer: voice announcements"),
    "calendar_booker": ("יומנים: הזמנות שלי", "Calendars: my bookings"),
    "calendar_on_behalf": ("יומנים: הזמנה בשם צוות, חוג או לקוח", "Calendars: book on behalf of a team, class or client"),
    "calendar_manager": ("יומנים: ניהול יומנים", "Calendars: manage calendars"),
    "calendar_maintenance": ("יומנים: חלונות תחזוקה", "Calendars: maintenance windows"),
    "calendar_connect": ("יומנים: חיבור יומנים חיצוניים", "Calendars: connect external calendars"),
}

SCOPES: dict[str, tuple[str, str]] = {
    "installation": ("כל ההתקנה", "The whole installation"),
    "camera": ("מצלמה · {name}", "Camera · {name}"),
    "channel": ("ערוץ {n}", "Channel {n}"),
    "station": ("עמדה · {name}", "Station · {name}"),
    "station_unavailable": ("עמדת אינטרקום (לא זמינה כרגע)", "Intercom station (not available right now)"),
}

register("role", ROLES)
register("scope", SCOPES)
