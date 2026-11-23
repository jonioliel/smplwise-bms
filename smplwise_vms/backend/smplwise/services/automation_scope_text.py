"""I18N-BACKEND-2490 (third pass): the refusal and warning sentences of the automation scope (services/automation_scope.py, keys
`ascope.<name>`) and of the schedules view (services/schedule_view.py, keys `sched.<name>`) - the sentences that tell a user why an item
or a schedule action is not theirs to save or run, several of them quoting a permission label (`perm.*`, rendered in the same language).
Hebrew exactly as those modules wrote it before this change, English written by hand with the words of the frontend's English catalogue
(frontend/src/i18n/lang/en/i18n/msg/api-automation.ts and automation.ts: "Defined in a configuration file – view only", "You do not have
permission to control {name}.", "Schedules are turned off in the system settings.", the alarm / lock code sentences)."""
from __future__ import annotations

from ..i18n import register

AUTOMATION: dict[str, tuple[str, str]] = {
    # automation_scope.REASON_MESSAGES
    "reason.no_permission": ("אין לך הרשאה לנהל את ההתקנים של הפריט הזה.", "You do not have permission to manage the devices of this item."),
    "reason.entity_not_controllable": ("אין לך הרשאת שליטה בהתקן.", "You do not have permission to control the device."),
    "reason.grant_required": ("אין לך הרשאה לפעולה הרגישה.", "You do not have permission for the sensitive action."),
    "reason.yaml_managed": ("מוגדרת בקובץ תצורה – לצפייה בלבד", "Defined in a configuration file – view only"),
    "reason.no_config_id": ("לפריט אין מזהה תצורה – לצפייה בלבד", "The item has no configuration id – view only"),
    "reason.integration_scene": ("סצנה של התקן – אפשר רק להפעיל", "A device's own scene – it can only be activated"),
    "reason.masked_values": ("הפריט כולל ערכים חסויים; ערכו אותו בתשתית המערכת.", "The item holds hidden values; edit it on the platform."),
    "reason.config_api_unavailable": ("עריכת אוטומציות אינה זמינה כרגע.", "Editing automations is not available right now."),
    "reason.bridge_unavailable": ("נדרש עדכון או צימוד של רכיב החיבור כדי לשמור אוטומציות.",
                                  "The connection component must be updated or paired to save automations."),
    "reason.delegation_off": ("שמירה דורשת מנהל", "Saving needs an administrator"),
    "reason.feature_disabled": ("האוטומציות כבויות בהגדרות המערכת.", "Automations are turned off in the system settings."),
    "reason.ha_unavailable": ("תשתית המערכת אינה זמינה כרגע.", "The platform is unavailable right now."),
    "reason.unsupported_content": ("הפריט כולל תוכן שהמערכת אינה מציגה במלואו.", "The item holds content the system does not fully show."),
    # sentences with a permission label / a device name
    "no_grant_at": ("אין לך הרשאה ל{perm} ב־{name}.", "You do not have the permission \"{perm}\" for {name}."),
    "no_control_of": ("אין לך הרשאת שליטה ב־{name}.", "You do not have permission to control {name}."),
    "unknown_effects": ("לפריט פעולות שאינן ידועות מראש; הרצה דורשת הרשאה בכל ההתקנה.",
                        "The item has actions that are not known in advance; running it needs the permission for the whole installation."),
}

SCHEDULE: dict[str, tuple[str, str]] = {
    # schedule_view.REASON_MESSAGES
    "reason.no_manage_permission": ("אין לך הרשאה לנהל תזמונים של ההתקנים האלה.", "You do not have permission to manage schedules of these devices."),
    "reason.sensitive_permission_required": ("תזמון של אזעקה, צופרים, מנעולים, דלתות ושערים דורש הרשאה לתזמון פעולות רגישות.",
                                             "Scheduling an alarm, sirens, locks, doors and gates needs the permission to schedule sensitive actions."),
    "reason.class_disabled": ("סוג ההתקן כובה בהגדרות › תזמונים.", "This device type is turned off in Settings › Schedules."),
    "reason.unsupported_content": ("התזמון כולל תוכן שהמערכת אינה מציגה במלואו; אפשר לערוך אותו רק ברכיב המקורי.",
                                   "The schedule holds content the system does not fully show; it can be edited only in the original component."),
    "reason.feature_disabled": ("התזמונים כבויים בהגדרות המערכת.", "Schedules are turned off in the system settings."),
    "reason.component_unavailable": ("רכיב התזמונים אינו זמין כרגע.", "The schedules component is not available right now."),
    "reason.ha_unavailable": ("תשתית המערכת אינה זמינה כרגע.", "The platform is unavailable right now."),
    "reason.bridge_unavailable": ("נדרש עדכון או צימוד של רכיב החיבור כדי לשמור תזמונים.",
                                  "The connection component must be updated or paired to save schedules."),
    "reason.action_invalid": ("פעולה בתזמון אינה תקפה עוד (ההתקן חסר או אינו תומך בה); אפשר לערוך ולהסיר אותה.",
                              "A schedule action is no longer valid (the device is missing or does not support it); you can edit and remove it."),
    # action refusals (several quote a permission label)
    "no_control_of": ("אין לך הרשאת שליטה ב־{name}.", "You do not have permission to control {name}."),
    "needs_door_grant": ("הפעולה דורשת הרשאה נפרדת (פתיחת דלת).", "The action needs a separate permission (opening a door)."),
    "needs_grant": ("הפעולה דורשת הרשאה נפרדת ({perm}).", "The action needs a separate permission ({perm})."),
    "no_run_of": ("אין לך הרשאה להפעיל את {name}.", "You do not have permission to run {name}."),
    "script_unknown_effects": ("פעולות הסקריפט {name} אינן ידועות למערכת; תזמון שלו דורש הרשאת הרצת סקריפטים בכל ההתקנה.",
                               "The system does not know what the script {name} does; scheduling it needs the permission to run scripts for the whole installation."),
    "needs_media_grant": ("הפעולה דורשת הרשאת מולטימדיה ({perm}).", "The action needs a multimedia permission ({perm})."),
    "needs_public_grant": ("החלפת מקור במסך ציבורי דורשת הרשאה נפרדת.", "Changing the source on a public screen needs a separate permission."),
    # warnings of a schedule
    "sensitive_condition_unavailable": ("תזמון של פעולה רגישה תלוי בחיישן שאינו זמין כעת.", "A schedule of a sensitive action depends on a sensor that is not available now."),
    "alarm_may_need_code": ("לוח האזעקה עשוי לדרוש קוד לפעולה זו.", "The alarm panel may need a code for this action."),
    "single_deletes": ("תזמון חד־פעמי נמחק מהרכיב לאחר ההרצה.", "A one-time schedule is deleted from the component after it runs."),
    # why the catalogue offers no action for a device
    "bridge_too_old_for_action": ("נדרש עדכון של רכיב החיבור כדי לתזמן פעולה זו.", "The connection component must be updated to schedule this action."),
    "alarm_code_needed": ("לוח האזעקה דורש קוד לפעולה זו. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותה.",
                          "The alarm panel needs a code for this action. A schedule does not keep codes, so it cannot be scheduled."),
    "lock_code_needed": ("המנעול דורש קוד. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותו.",
                         "The lock needs a code. A schedule does not keep codes, so it cannot be scheduled."),
    "script_field_unsupported": ("לסקריפט משתנה חובה שהמערכת אינה מציגה ({field}); אפשר לתזמן אותו רק ברכיב המקורי.",
                                 "The script has a required variable the system does not show ({field}); it can be scheduled only in the original component."),
    "action_not_allowed": ("אין פעולות מותרות להתקן זה.", "No actions are allowed for this device."),
}

register("ascope", AUTOMATION)
register("sched", SCHEDULE)
