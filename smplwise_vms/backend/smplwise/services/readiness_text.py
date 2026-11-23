"""I18N-BACKEND-2490: the texts of the installation readiness report (services/readiness.py) - Hebrew exactly as the report wrote it
before this change, English written by hand with the words of the frontend's English catalogue (frontend/src/i18n/lang/en/i18n/msg/
api-system.ts, the readiness demo store, and msg/system-b.ts, the readiness screen). Keys are `readiness.<name>`."""
from __future__ import annotations

from ..i18n import register

TEXTS: dict[str, tuple[str, str]] = {
    "yes": ("כן", "Yes"),
    "no": ("לא", "No"),
    # levels
    "level.building": ("בהקמה", "Being set up"),
    "level.almost": ("כמעט מוכן למסירה", "Almost ready for handover"),
    "level.ready": ("מוכן למסירה", "Ready for handover"),
    # check titles
    "title.cameras_connected": ("מצלמות מחוברות", "Connected cameras"),
    "title.cameras_verified": ("מצלמות מאומתות", "Verified cameras"),
    "title.places": ("קומות ומיקומים", "Floors and locations"),
    "title.people": ("אנשים והרשאות", "People and permissions"),
    "title.notifications": ("התראות", "Notifications"),
    "title.backup": ("גיבוי", "Backup"),
    "title.remote": ("גישה מרחוק", "Remote access"),
    "title.time": ("שעון ואזור זמן", "Clock and time zone"),
    "title.integrations": ("חיבורים לתשתית", "Connections to the platform"),
    "title.modules": ("מודולים פעילים", "Active modules"),
    "title.handover": ("מסירה ללקוח", "Handover to the customer"),
    # settings
    "invalid_setting": ("ערך לא תקין להגדרה.", "Invalid value for the setting."),
    "band_below_advice": ("סף 'כמעט מוכן' חייב להיות נמוך מציון המסירה המומלץ.", "The 'almost ready' threshold must be lower than the recommended handover score."),
    "one_weight": ("לפחות לבדיקה אחת חייב להיות משקל.", "At least one check must have a weight."),
    # cameras
    "cameras.nvrless": ("ההתקנה פועלת ללא NVR - אין מצלמות לבדוק.", "The installation runs without an NVR - there are no cameras to check."),
    "next.wizard": ("פתיחת אשף ההתקנה", "Open the setup wizard"),
    "cameras.none_active": ("לא נמצאו מצלמות פעילות.", "No active cameras were found."),
    "cameras.active": ("מצלמות פעילות", "Active cameras"),
    "cameras.connected_summary": ("{online} מתוך {total} מצלמות מחוברות.", "{online} of {total} cameras are connected."),
    "cameras.connected": ("מחוברות", "Connected"),
    "cameras.verified_nvrless": ("ההתקנה פועלת ללא NVR.", "The installation runs without an NVR."),
    "next.wizard_cameras": ("בדיקת מצלמות באשף", "Camera check in the wizard"),
    "cameras.none_to_verify": ("אין מצלמות לאימות.", "There are no cameras to verify."),
    "cameras.verified_summary": ("{seen} מתוך {total} מצלמות נראו ב-{hours} השעות האחרונות.", "{seen} of {total} cameras were seen in the last {hours} hours."),
    "cameras.seen": ("נראו לאחרונה", "Seen recently"),
    # places
    "next.map": ("למפה ולתוכניות", "To the map and the plans"),
    "places.no_floors": ("אין קומות מוגדרות.", "No floors are defined."),
    "places.floors": ("קומות", "Floors"),
    "places.published": ("קומות עם תוכנית מפורסמת", "Floors with a published plan"),
    "places.on_map": ("מצלמות על המפה", "Cameras on the map"),
    "places.summary": ("{with_plan} מתוך {floors} קומות עם תוכנית{tail}", "{with_plan} of {floors} floors have a plan{tail}"),
    "places.cameras_tail": (" · {placed} מצלמות ממוקמות.", " · {placed} cameras placed."),
    "places.dot": (".", "."),
    # people
    "next.access": ("משתמשים והרשאות", "Users and permissions"),
    "people.summary": ("{admins} מנהלי מערכת · {others} משתמשים עם תפקיד.", "System administrators: {admins} · users with a role: {others}."),
    "people.admin": ("מנהל מערכת", "System administrator"),
    "people.with_role": ("משתמשים עם תפקיד", "Users with a role"),
    # notifications
    "next.notifications": ("הגדרות התראות", "Notification settings"),
    "notify.none": ("לא הוגדר ערוץ התראות.", "No notification channel is set up."),
    "notify.channels": ("ערוצים", "Channels"),
    "notify.summary": ("{reached} מתוך {configured} ערוצים הגיעו ליעד ב-{days} הימים האחרונים.",
                       "{reached} of {configured} channels reached their recipients in the last {days} days."),
    "notify.configured": ("ערוצים שהוגדרו", "Channels set up"),
    "notify.reached": ("הגיעו ליעד", "Delivered"),
    # backup
    "backup.local": ("גיבוי מקומי מ-{days} הימים האחרונים", "Local backup from the last {days} days"),
    "backup.sealed": ("גיבוי עם סיסמת גיבוי", "Backup with a backup password"),
    "backup.drill": ("תרגיל שחזור עבר", "Restore drill passed"),
    "backup.offbox": ("גיבוי מחוץ למכשיר נבדק", "Off-device backup checked"),
    "backup.summary": ("{n} מתוך 4 תנאי הגיבוי מתקיימים.", "{n} of 4 backup conditions are met."),
    "next.backup": ("גיבוי ושחזור", "Backup and restore"),
    # remote access
    "remote.off": ("הגישה מרחוק כבויה בהחלטה.", "Remote access is off by choice."),
    "remote.summary": ("גישה מרחוק פעילה{tail}", "Remote access is on{tail}"),
    "remote.with_mfa": (" עם אימות למנהלים.", " with verification for administrators."),
    "remote.without_mfa": (" בלי אימות דו-שלבי למנהלים.", " without two-step verification for administrators."),
    "remote.policy": ("מדיניות", "Policy"),
    "remote.mfa": ("אימות למנהלים", "Verification for administrators"),
    "remote.required": ("נדרש", "Required"),
    "remote.not_required": ("לא נדרש", "Not required"),
    "next.security": ("אבטחה", "Security"),
    # time
    "time.summary": ("אזור הזמן: {tz}.", "Time zone: {tz}."),
    "time.invalid": ("אזור הזמן לא תקין.", "The time zone is not valid."),
    "time.zone": ("אזור זמן", "Time zone"),
    "next.general": ("הגדרות כלליות", "General settings"),
    # integrations and the door map
    "next.door_map": ("שיוך דלתות", "Door mapping"),
    "doors.all_suggested": ("{n} דלתות ממתינות לשיוך - אשר הצעות", "{n} doors waiting for mapping - approve the suggestions"),
    "doors.some_suggested": ("{n} דלתות ממתינות לשיוך ({sug} עם הצעה מוכנה)", "{n} doors waiting for mapping ({sug} with a ready suggestion)"),
    "doors.manual": ("{n} דלתות ממתינות לשיוך ידני", "{n} doors waiting for manual mapping"),
    "integrations.no_report": ("דוח הבריאות לא זמין.", "The health report is unavailable."),
    "next.health": ("בריאות ועבודות", "Health and jobs"),
    "integrations.none": ("אין חיבורים לבדוק.", "There are no connections to check."),
    "integrations.summary": ("{ok} מתוך {total} חיבורים תקינים.", "{ok} of {total} connections are OK."),
    "integrations.all_ok": ("החיבורים תקינים.", "The connections are OK."),
    "integrations.with_doors": ("{summary} {doors}.", "{summary} {doors}."),
    # modules
    "modules.none": ("אין מודולים אופציונליים פעילים.", "No optional modules are active."),
    "modules.departments": ("{n} מחלקות פעילות במודול הבקשות.", "{n} active departments in the requests module."),
    "modules.no_department": ("מודול הבקשות פעיל ואין בו מחלקה.", "The requests module is on and has no department."),
    "modules.departments_fact": ("מחלקות", "Departments"),
    "next.module_settings": ("הגדרות המודול", "Module settings"),
    # handover
    "handover.pending": ("המסירה ללקוח עדיין לא נרשמה.", "The handover to the customer is not recorded yet."),
    "handover.recorded_fact": ("נרשם", "Recorded"),
    "handover.customer": ("לקוח", "Customer"),
    "handover.below_advice": ("נמסר מתחת לציון המומלץ", "Handed over below the recommended score"),
    "handover.score": ("ציון {score}", "Score {score}"),
    "handover.done": ("המסירה נרשמה.", "The handover is recorded."),
    # the report and its routes
    "check_failed": ("הבדיקה נכשלה.", "The check failed."),
    "not_configurable": ("אי אפשר לאשר את הבדיקה הזו ידנית.", "This check cannot be confirmed by hand."),
    "rate_limited": ("הבדיקה הורצה הרגע. נסו שוב בעוד רגע.", "The check just ran. Try again in a moment."),
    "confirmation_required": ("הפעולה דורשת אישור מפורש.", "The action needs an explicit confirmation."),
}

register("readiness", TEXTS)
