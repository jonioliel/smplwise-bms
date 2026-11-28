"""FIX-VIDEO2-2570: the texts the video fixes of the second deep review add (I18N-BACKEND-2490: a `Msg` whose string value is the
Hebrew; the route renders it in the reader's language).

- `recordings.*`: what the recording search and playback add to an answer that cannot be complete or exact - a recorder that repeated a
  page, a file in the hour the autumn clock change repeats, a file whose times no reading of the zone can place, a playback start inside
  that repeated hour - and the refusal of a date that is not in the calendar.
- `nvr_smart.*`: a smart-rules save whose first document was written and the second was not.
- `views.*`: a saved view that would grow past its camera limit once the cameras the editor cannot see are kept."""
from __future__ import annotations

from ..i18n import register

RECORDINGS: dict[str, tuple[str, str]] = {
    "repeated_page": ("המקליט החזיר שוב עמוד תוצאות שכבר נקרא: ייתכן שחסרות הקלטות בהמשך הטווח.",
                      "The recorder sent a page of results it had already sent: recordings later in the range may be missing."),
    "repeated_hour": ("השעה שחוזרת במעבר לשעון חורף כפולה במקליט: הקלטות בשעה הזו עשויות להופיע במופע הלא נכון שלה, וניגון בתוכה עשוי להציג את המופע האחר.",
                      "The hour repeated by the change to winter time is ambiguous on the recorder: recordings in it may be shown on the wrong "
                      "occurrence, and playback inside it may show the other occurrence."),
    "dropped": ("{n} קבצי הקלטה עם זמני התחלה וסיום לא תקינים לא הוצגו.",
                "{n} recording files with invalid start and end times were not shown."),
    "playback_repeated_hour": ("הזמן המבוקש נמצא בשעה שחוזרת במעבר לשעון חורף. המקליט מקבל שעון קיר בלבד, ולכן ייתכן שינוגן המופע האחר של השעה הזו.",
                               "The requested time is in the hour repeated by the change to winter time. The recorder takes wall-clock time only, "
                               "so the other occurrence of this hour may be played."),
    "invalid_date": ("התאריך לא קיים בלוח השנה.", "The date does not exist in the calendar."),
}

NVR_SMART: dict[str, tuple[str, str]] = {
    "line": ("חציית קו", "Line crossing"),
    "field": ("פריצה לאזור", "Intrusion"),
    "partial": ("השמירה הושלמה בחלקה: {applied} נכתב למקליט ונרשם (ניתן להחזרה). {failed}: {reason}",
                "The save was only partly done: {applied} was written to the recorder and recorded (it can be rolled back). {failed}: {reason}"),
}

VIEWS: dict[str, tuple[str, str]] = {
    "too_many_with_hidden": ("בתצוגה יש {hidden} מצלמות שאין לך הרשאה לראות, והן נשמרות בה. יחד איתן התצוגה עוברת את המגבלה של {max} מצלמות.",
                             "The view holds {hidden} cameras you may not watch, and they are kept. With them the view passes the limit of {max} cameras."),
}

register("recordings", RECORDINGS)
register("nvr_smart", NVR_SMART)
register("views", VIEWS)
