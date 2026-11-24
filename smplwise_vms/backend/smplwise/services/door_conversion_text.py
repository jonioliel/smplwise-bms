"""DOOR-PREVIEW-I18N-2500 (follow-up of REVIEW-2490-FIXES-2500 F3): the words of the door-path report and of the "disable and list"
preview in the reader's language - the mechanism of I18N-BACKEND-2490 (smplwise/i18n.py: a text is a `Msg` whose string value IS the
Hebrew; only the edge that answers one request renders it in the requester's `ui.lang`).

Keys:
- `doorpath.<table>.<code>` - services/door_path.py: an item's kind, origin, approver state, run guard, conversion suggestion, the
  reasons a step could not be resolved, and the fallback labels of a door with no name (`relay`, `door_unmapped`, `door_unknown`);
- `doorconv.<table>.<code>` - services/door_conversion.py: an item's category, the actions, the list's empty states, why an action is
  not offered (`why.*`), the refusals of an action / an undo (`err.*`), and the weekday letters of the hand-over preview (`day.*`);
- `doorguard.<name>` (DOOR-BLOCKS-I18N-2510) - services/door_run_guard.py: the run / enable refusals of an item that opens a door
  (`not_yet` and the four sentences built around it), the door authority's "no permission", "use the automations screen", and an
  unavailable station of a converted run;
- `doorblocks.<table>.<code>` (DOOR-BLOCKS-I18N-2510) - services/door_blocks.py: why an entity cannot be released (`refuse.*`) and the
  refusals of a release note (`note.*`).

Hebrew exactly as those modules wrote it before this change (each module checks at import that its own table equals these words, so a
Hebrew reader's bytes cannot drift). English written by hand with the words of the frontend's English catalogue
(frontend/src/i18n/lang/en/i18n/msg/system-a.ts: "Disable and record", "Convert to an Arx door task", "No items that open a door were
found", "Manual check", "Run blocked", "The station is unavailable"; automation.ts / components.ts: "Created outside the system",
"Unknown source", "Schedule", "Scene", "Script", "Automation"; misc.ts "Approved", "access-control"; door-blocks.ts "Release",
"Released", "Blocked", "intercom door", "The reason is too long (up to {max} characters)").

"חלון פתיחה" is "door window" in English everywhere (DOOR-BLOCKS-I18N-2510): the frontend's own catalogue of the feature
(frontend/src/i18n/lang/en/i18n/door-windows.ts: "Door windows", "New door window"; nav-labels.ts "Door windows") and the default name
of a handed-over window (services/default_names.py `door_window` = "Door window"). The preview first wrote "opening window" here; the
frontend's three hand-over sentences of msg/system-a.ts were aligned in the same change.

Day names: the English is the existing short-day table `services/default_names.DAY_SHORT["en"]` (the same words as the automation
sentences' `auto.wd.*`), not a second list. Its Hebrew cannot be reused: those tables write the letters with a geresh (U+05F3, "א׳")
while the hand-over preview has always written an ASCII apostrophe ("א'"), and a Hebrew reader's preview must keep its bytes."""
from __future__ import annotations

from typing import Mapping

from ..i18n import CATALOGUE, Msg, register, t
from .default_names import DAY_SHORT

DAY_KEYS: tuple[str, ...] = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")  # door window weekdays: 0 = Sunday .. 6

DOOR_PATH: dict[str, tuple[str, str]] = {
    # door_path.UNRESOLVED_TEXT: why a step could not be resolved
    "unresolved.template_service": ("שם הפעולה מחושב בזמן ריצה", "The action's name is computed at run time"),
    "unresolved.template_target": ("היעד מחושב בזמן ריצה", "The target is computed at run time"),
    "unresolved.template_data": ("מספר הממסר מחושב בזמן ריצה", "The relay number is computed at run time"),
    "unresolved.label_target": ("היעד הוא תווית", "The target is a label"),
    "unresolved.unknown_entity": ("התקן שאינו מוכר למערכת", "A device the system does not know"),
    "unresolved.unknown_item": ("פריט שאינו מוכר למערכת", "An item the system does not know"),
    "unresolved.unreadable_item": ("פריט שתוכנו אינו קריא", "An item whose content cannot be read"),
    "unresolved.template_lock": ("מנעול וירטואלי שתוכנו אינו ידוע", "A virtual lock whose content is unknown"),
    "unresolved.group_lock": ("קבוצת מנעולים שחבריה אינם ידועים", "A lock group whose members are unknown"),
    "unresolved.template_button": ("כפתור וירטואלי שתוכנו אינו ידוע", "A virtual button whose content is unknown"),
    "unresolved.template_entity": ("התקן וירטואלי שפעולתו אינה ידועה", "A virtual device whose action is unknown"),
    "unresolved.wiskey_button": ("כפתור של מערכת האינטרקום", "A button of the intercom system"),
    "unresolved.wiskey_device_action": ("פעולת התקן של מערכת האינטרקום", "A device action of the intercom system"),
    "unresolved.door_target_unknown": ("לא צוינה דלת", "No door is named"),
    "unresolved.scene_state_unknown": ("מצב המנעול בסצנה אינו ידוע", "The lock's state in the scene is unknown"),
    "unresolved.too_deep": ("שרשרת קריאות ארוכה מדי", "The chain of calls is too long"),
    # door_path.DOOR_PROBLEM_TEXT
    "door_problem.unmapped": ("הדלת לא משויכת לממסר", "The door is not mapped to a relay"),
    # door_path.ORIGIN_TEXT
    "origin.arx_authored": ("נוצר ב-Arx", "Created in Arx"),
    "origin.arx_edited_externally": ("נוצר ב-Arx ושונה מחוץ למערכת", "Created in Arx and changed outside the system"),
    "origin.external": ("נוצר מחוץ למערכת", "Created outside the system"),
    "origin.unknown": ("מקור לא ידוע", "Unknown source"),
    # door_path.KIND_TEXT (the item's kind; an unnamed item's NAME stays the Hebrew word - door_path.KIND_NAME)
    "kind.automation": ("אוטומציה", "Automation"),
    "kind.script": ("סקריפט", "Script"),
    "kind.scene": ("סצנה", "Scene"),
    "kind.schedule": ("תזמון", "Schedule"),
    "kind.launcher": ("כפתור מהיר במסך הבית", "Quick button on the home screen"),
    # door_path.SUGGESTION_TEXT
    "suggestion.door_button": ("כפתור הדלת", "The door button"),
    "suggestion.hold_open_program": ("תוכנית החזקה פתוחה ב-WisKey", "A hold-open program in WisKey"),
    "suggestion.arx_event_job": ("משימת דלת של Arx (בהמשך)", "An Arx door task (later)"),
    "suggestion.manual_review": ("בדיקה ידנית - לא ניתן לזהות את הדלתות", "Manual check - the doors cannot be identified"),
    "suggestion.remove_lock_step": ("הסרת שלב הנעילה (אינו נתמך בדלת אינטרקום)", "Remove the locking step (not supported on an intercom door)"),
    "suggestion.external_untouched": ("לא מטופל ב-Arx - נשאר כפי שהוא", "Not handled in Arx - stays as it is"),
    # door_path.GUARD_TEXT
    "guard.refused_not_converted": ("הרצה מ-Arx נחסמת: יש בפריט פתיחת דלת שלא הוסבה",
                                    "Run blocked from Arx: the item has a door opening that was not converted"),
    "guard.refused_unresolvable": ("הרצה מ-Arx נחסמת: לא ניתן לזהות את הדלתות בפריט",
                                   "Run blocked from Arx: the doors in the item cannot be identified"),
    "guard.unchanged": ("הרצה מ-Arx ללא שינוי", "A run from Arx is unchanged"),
    # door_path.APPROVER_TEXT
    "approver.approved": ("מאושר", "Approved"),
    "approver.none": ("אין מאשר", "No approver"),
    "approver.inactive": ("המאשר אינו פעיל", "The approver is not active"),
    "approver.no_permission": ("למאשר אין הרשאת פתיחה", "The approver has no permission to open"),
    # door_path._door_names: a door shown without a name of its own (a display label, never stored)
    "relay": ("ממסר {n}", "Relay {n}"),
    "door_unmapped": ("דלת לא משויכת", "Unmapped door"),
    "door_unknown": ("דלת לא מזוהה", "Unidentified door"),
}

DOOR_CONVERSION: dict[str, tuple[str, str]] = {
    # door_conversion.CATEGORY_TEXT
    "category.event_automation": ("אוטומציה שמופעלת מאירוע", "Automation started by an event"),
    "category.schedule": ("תזמון", "Schedule"),
    "category.script": ("סקריפט", "Script"),
    "category.scene": ("סצנה", "Scene"),
    "category.launcher": ("כפתור מהיר במסך הבית", "Quick button on the home screen"),
    "category.unknown": ("פריט שלא ניתן לזהות בו את הדלתות", "An item whose doors cannot be identified"),
    # door_conversion.ACTION_TEXT
    "action.disable": ("השבתה ורישום", "Disable and record"),
    "action.convert_event_job": ("הסבה למשימת דלת של Arx", "Convert to an Arx door task"),
    "action.hand_over_program": ("העברה לחלון פתיחה קבוע", "Move to a fixed door window"),
    # door_conversion.STATE_TEXT (`items` is an empty text, not a catalogue entry)
    "state.no_wiskey": ("אין במערכת דלתות של בקרת הכניסה - אין מה לבדוק.", "The system has no access-control doors - there is nothing to check."),
    "state.nothing_found": ("לא נמצאו פריטים שפותחים דלת. אין מה להשבית או להסב.", "No items that open a door were found. There is nothing to disable or convert."),
    # door_conversion.UNAVAILABLE_TEXT: why an action is not offered
    "why.external": ("נוצר מחוץ למערכת - לא מטופל ב-Arx", "Created outside the system - not handled in Arx"),
    "why.not_autonomous": ("הפריט אינו פועל לבד", "The item does not run on its own"),
    "why.not_enabled": ("הפריט כבר כבוי", "The item is already off"),
    "why.gone": ("הפריט כבר לא קיים", "The item no longer exists"),
    "why.no_door": ("אין בפריט פתיחת דלת", "The item does not open a door"),
    "why.unresolvable": ("לא ניתן לזהות את הדלתות בפריט", "The doors in the item cannot be identified"),
    "why.kind": ("פעולה זו אינה מתאימה לסוג הפריט", "This action does not suit the item's type"),
    "why.door_step_in_called_item": ("פתיחת הדלת נמצאת בפריט אחר שהפריט מפעיל", "The door opening is in another item that this item runs"),
    "why.mixed_target": ("שלב הפתיחה פועל גם על מנעולים אחרים", "The opening step also acts on other locks"),
    "why.empty_branch": ("הסרת שלב הדלת תשאיר ענף ריק", "Removing the door step would leave an empty branch"),
    "why.empty_actions": ("בלי שלב הדלת לא נשאר בפריט דבר - עדיף להשבית", "Without the door step nothing is left in the item - better to disable it"),
    "why.door_step_remains": ("גם אחרי ההסרה נשארת בפריט פתיחת דלת", "A door opening remains in the item even after the removal"),
    "why.unreadable": ("תוכן הפריט אינו קריא", "The item's content cannot be read"),
    "why.too_many_doors": ("יותר מדי דלתות למשימה אחת", "Too many doors for one task"),
    "why.door_job_exists": ("לאוטומציה כבר יש משימת דלת", "The automation already has a door task"),
    "why.intercom_unavailable": ("אין כרגע נתונים עדכניים ממערכת האינטרקום", "There is no up-to-date data from the intercom system right now"),
    "why.door_unknown": ("אחת הדלתות אינה קיימת במערכת האינטרקום", "One of the doors does not exist in the intercom system"),
    "why.not_recurring": ("התזמון אינו חוזר", "The schedule does not repeat"),
    "why.date_limited": ("התזמון מוגבל בתאריכים", "The schedule is limited to dates"),
    "why.has_conditions": ("לתזמון יש תנאים", "The schedule has conditions"),
    "why.weekdays_unknown": ("ימי התזמון אינם מוכרים", "The schedule's days are not recognised"),
    "why.time_not_fixed": ("שעת התזמון אינה שעה קבועה", "The schedule's time is not a fixed time"),
    "why.no_end_time": ("לתזמון אין שעת סיום - חלון פתיחה צריך שעת סיום", "The schedule has no end time - a door window needs an end time"),
    "why.mixed_schedule": ("בתזמון יש גם פעולות אחרות", "The schedule also has other actions"),
    "why.window_too_long": ("החלון ארוך מהמותר לחלון פתיחה", "The window is longer than a door window may be"),
    "why.quiet_hours": ("החלון נוגע בשעות השקטות", "The window touches the quiet hours"),
    "why.overlap": ("שני חלונות חופפים באותו יום", "Two windows overlap on the same day"),
    "why.too_many_per_day": ("יותר מדי חלונות ביום אחד", "Too many windows on one day"),
    "why.invalid_time": ("שעה לא תקינה לחלון פתיחה", "Not a valid time for a door window"),
    "why.invalid_name": ("שם התזמון אינו מתאים לשם חלון", "The schedule's name does not suit a window name"),
    "why.exterior_not_allowed": ("דלת חיצונית אינה יכולה להיות בחלון פתיחה", "An exterior door cannot be in a door window"),
    "why.handled": ("כבר טופל - אפשר לבטל את הפעולה הקודמת", "Already handled - the previous action can be undone"),
    "why.invalid": ("הפריט אינו מתאים", "The item is not suitable"),
    # the refusals of an action (`act`) and of an undo (`undo`): the error envelope renders them in the requester's language
    "err.confirmation_required": ("הפעולה דורשת אישור מפורש.", "The action needs an explicit confirmation."),
    "err.switch_off": ("השבתה והסבה של פריטים שפותחים דלתות כבויה בהגדרות.", "Disabling and converting items that open doors is turned off in Settings."),
    "err.unknown_action": ("פעולה לא מוכרת.", "Unknown action."),
    "err.not_listed": ("הפריט אינו ברשימת הפריטים שפותחים דלתות.", "The item is not in the list of items that open doors."),
    "err.stale_list": ("הפריט השתנה מאז שהרשימה הוצגה - יש לטעון אותה מחדש.", "The item changed since the list was shown - load it again."),
    "err.record_not_found": ("הרישום לא נמצא.", "The record was not found."),
    "err.already_undone": ("הפעולה כבר בוטלה.", "The action was already undone."),
    "err.item_gone": ("הפריט כבר לא קיים.", "The item no longer exists."),
    "err.stale_disabled": ("הפריט השתנה מאז ההשבתה - אי אפשר להחזיר אותו אוטומטית.", "The item changed since it was disabled - it cannot be restored automatically."),
    "err.program_in_use": ("חלון הפתיחה שנוצר פעיל - יש להשהות אותו קודם.", "The door window that was created is active - pause it first."),
    # the hand-over preview's weekdays (`program.days_text`): Hebrew letters with an ASCII apostrophe, as always; English from DAY_SHORT
    **{f"day.{d}": (he, DAY_SHORT["en"][d]) for d, he in zip(DAY_KEYS, ("א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"))},
    "day_sep": (" ", ", "),
}

# DOOR-BLOCKS-I18N-2510: services/door_run_guard.py. `{not_yet}` is the `not_yet` text itself (a `Msg` param, rendered in the same
# language), so each sentence is exactly the f-string the module wrote before.
DOOR_GUARD: dict[str, tuple[str, str]] = {
    "not_yet": ("פתיחת דלתות מאוטומציה עדיין לא נתמכת", "Opening doors from an automation is not supported yet"),
    "not_converted": ("לא ניתן להריץ: הפריט פותח דלת של בקרת הכניסה. {not_yet}.", "Cannot run: the item opens an access-control door. {not_yet}."),
    "unresolvable": ("לא ניתן להריץ: ייתכן שהפריט פותח דלת של בקרת הכניסה. {not_yet}.", "Cannot run: the item may open an access-control door. {not_yet}."),
    "enable_not_converted": ("לא ניתן להפעיל: הפריט פותח דלת של בקרת הכניסה. {not_yet}; אפשר לכבות אותו.",
                             "Cannot turn on: the item opens an access-control door. {not_yet}; it can be turned off."),
    "enable_unresolvable": ("לא ניתן להפעיל: ייתכן שהפריט פותח דלת של בקרת הכניסה. {not_yet}; אפשר לכבות אותו.",
                            "Cannot turn on: the item may open an access-control door. {not_yet}; it can be turned off."),
    "no_permission": ("אין הרשאה לפתוח דלת זו", "No permission to open this door"),
    "use_automations": ("הפריט כולל פתיחת דלת; מפעילים אותו ממסך האוטומציות.", "The item includes a door opening; run it from the automations screen."),
    "station_unavailable": ("התחנה לא זמינה", "The station is unavailable"),
}

# DOOR-BLOCKS-I18N-2510: services/door_blocks.py (`GET /doors/blocks` and the refusals of `PUT /doors/blocks/entities/{entity_id}`)
DOOR_BLOCKS: dict[str, tuple[str, str]] = {
    # door_blocks.REFUSALS: why an entity cannot be released
    "refuse.unknown_entity": ("ההתקן לא נמצא.", "The device was not found."),
    "refuse.wiskey_door": ("מנעול אינטרקום הוא דלת ואינו ניתן לשחרור.", "An intercom lock is a door and cannot be released."),
    "refuse.door_mapped": ("ההתקן משויך לדלת אינטרקום ואינו ניתן לשחרור. אפשר לבטל קודם את השיוך.",
                           "The device is mapped to an intercom door and cannot be released. You can remove the mapping first."),
    "refuse.not_blocked": ("ההתקן אינו חסום.", "The device is not blocked."),
    # door_blocks.NOTE_ERRORS: a release the list cannot store (`{n}`: door_overrides.NOTE_MAX / MAX_ENTRIES)
    "note.note_required": ("נדרשת סיבה לשחרור (לפחות 3 תווים).", "A reason for the release is required (at least 3 characters)."),
    "note.note_too_long": ("הסיבה ארוכה מדי (עד {n} תווים).", "The reason is too long (up to {n} characters)."),
    "note.bad_entity": ("מזהה ההתקן אינו תקין.", "The device ID is not valid."),
    "note.too_many": ("אי אפשר לשחרר יותר מ-{n} התקנים.", "No more than {n} devices can be released."),
}

register("doorpath", DOOR_PATH)
register("doorconv", DOOR_CONVERSION)
register("doorguard", DOOR_GUARD)
register("doorblocks", DOOR_BLOCKS)


def as_msg(key: str, he: str, **params: object) -> Msg:
    """The `Msg` `key` with `params` - its string is the Hebrew a module wrote. `he` is the module's own Hebrew template (its `{slot}`s
    are the params' places); one that differs from the catalogue is a bug: refused at import."""
    if CATALOGUE[key]["he"] != he:
        raise ValueError(f"{key}: the catalogue's Hebrew differs from the module's text")
    return t(key, **params)


def as_msgs(prefix: str, table: Mapping[str, str]) -> dict[str, str]:
    """`table` (code -> the Hebrew a module wrote) with each text replaced by its `Msg` `<prefix>.<code>` - the same string for a Hebrew
    reader. An empty text stays as it is. A Hebrew word that differs from the catalogue is a bug: refused at import."""
    out: dict[str, str] = {}
    for code, he in table.items():
        if not he:
            out[code] = he
            continue
        m: Msg = t(f"{prefix}.{code}")
        if m != he:
            raise ValueError(f"{prefix}.{code}: the catalogue's Hebrew differs from the module's text")
        out[code] = m
    return out
