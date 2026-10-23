"""CR-SHIFT114 (r114): the Hebrew TEMPLATE of the shift / 24-hour summary. No model, no free text: every sentence is a fixed template
chosen by a count, with the Hebrew number forms (zero / one / two / many) and the right gender and verb agreement written out.

`T` holds every sentence of the summary. A key maps to the forms of ONE sentence; `say(key, n)` picks the form by `n` and fills `{n}`.
A sentence that has no `two` form uses `many` for 2 (it reads right for every such noun); a sentence with no `zero` form is never
asked for zero (the caller skips it). Nothing else in the module composes Hebrew, so the whole language of the summary is reviewable here."""
from __future__ import annotations

from typing import Any

# section keys in their fixed order, with their headings
ORDER = ("tickets", "alarms", "doors", "devices", "temperature", "elevators", "generator")
TITLES = {
    "tickets": "בקשות שירות",
    "alarms": "אזעקות והתראות בטיחות",
    "doors": "דלתות",
    "devices": "התקנים שאינם זמינים",
    "temperature": "טמפרטורות",
    "elevators": "מעליות",
    "generator": "גנרטור",
}

HEAD = "סיכום משמרת: מה קרה בבניין"
PERIOD = "התקופה: {start} עד {end} ({dur})"
QUIET = "בתקופה זו לא אירע דבר חריג."
NOTHING = "אין נתונים להצגה לפי ההרשאות שלך."
BULLET = "• "

T: dict[str, dict[str, str]] = {
    # ---- service requests
    "tickets.opened": {"zero": "לא נפתחו בקשות שירות חדשות.", "one": "נפתחה בקשת שירות אחת.", "two": "נפתחו שתי בקשות שירות.", "many": "נפתחו {n} בקשות שירות."},
    "tickets.closed": {"zero": "לא נסגרו בקשות שירות.", "one": "נסגרה בקשת שירות אחת.", "two": "נסגרו שתי בקשות שירות.", "many": "נסגרו {n} בקשות שירות."},
    "tickets.open": {"zero": "אין כרגע בקשות שירות פתוחות.", "one": "כרגע פתוחה בקשת שירות אחת.", "two": "כרגע פתוחות שתי בקשות שירות.", "many": "כרגע פתוחות {n} בקשות שירות."},
    "tickets.overdue": {"one": "מהן אחת באיחור.", "two": "מהן שתיים באיחור.", "many": "מהן {n} באיחור."},
    # ---- alarms and safety sensors
    "alarms.raised": {"zero": "לא הופעלו אזעקות.", "one": "הופעלה אזעקה אחת.", "two": "הופעלו שתי אזעקות.", "many": "הופעלו {n} אזעקות."},
    "alarms.active": {"one": "אזעקה אחת עדיין פעילה.", "two": "שתי אזעקות עדיין פעילות.", "many": "{n} אזעקות עדיין פעילות."},
    "alarms.safety": {"one": "התקבלה התראת בטיחות אחת מחיישן (עשן, נזילה, גז או פחמן חד־חמצני).",
                      "two": "התקבלו שתי התראות בטיחות מחיישנים (עשן, נזילה, גז או פחמן חד־חמצני).",
                      "many": "התקבלו {n} התראות בטיחות מחיישנים (עשן, נזילה, גז או פחמן חד־חמצני)."},
    "alarms.safety_active": {"one": "אחת מהן עדיין פעילה.", "two": "שתיים מהן עדיין פעילות.", "many": "{n} מהן עדיין פעילות."},
    # ---- doors
    "doors.emergency": {"one": "הופעל מצב חירום בדלתות פעם אחת.", "two": "הופעל מצב חירום בדלתות פעמיים.", "many": "הופעל מצב חירום בדלתות {n} פעמים."},
    "doors.relock": {"one": "חזרה לנעילה שלא אושרה: פעם אחת.", "two": "חזרה לנעילה שלא אושרה: פעמיים.", "many": "חזרה לנעילה שלא אושרה: {n} פעמים."},
    "doors.window": {"one": "חלון פתיחה שלא התחיל: פעם אחת.", "two": "חלון פתיחה שלא התחיל: פעמיים.", "many": "חלון פתיחה שלא התחיל: {n} פעמים."},
    "doors.left_open": {"one": "דלת או חלון נשארו פתוחים זמן רב: פעם אחת.", "two": "דלת או חלון נשארו פתוחים זמן רב: פעמיים.",
                        "many": "דלת או חלון נשארו פתוחים זמן רב: {n} פעמים."},
    "doors.rings": {"one": "צלצול אחד בדלת.", "two": "שני צלצולים בדלת.", "many": "{n} צלצולים בדלת."},
    "doors.none": {"many": "לא היו אירועי דלתות חריגים."},
    # ---- devices that are not available
    "devices.dropped": {"zero": "לא נרשמו ניתוקי התקנים.", "one": "נרשם ניתוק התקן אחד.", "two": "נרשמו שני ניתוקי התקנים.", "many": "נרשמו {n} ניתוקי התקנים."},
    "devices.now": {"zero": "אין כרגע התקנים שאינם זמינים.", "one": "כרגע התקן אחד אינו זמין.", "two": "כרגע שני התקנים אינם זמינים.", "many": "כרגע {n} התקנים אינם זמינים."},
    # ---- temperature
    "temperature.excursions": {"zero": "לא היו חריגות טמפרטורה.", "one": "נרשמה חריגת טמפרטורה אחת.", "two": "נרשמו שתי חריגות טמפרטורה.", "many": "נרשמו {n} חריגות טמפרטורה."},
    "temperature.alarm": {"one": "מהן אחת הגיעה לרמת אזעקה.", "two": "מהן שתיים הגיעו לרמת אזעקה.", "many": "מהן {n} הגיעו לרמת אזעקה."},
    "temperature.ongoing": {"one": "חריגה אחת עדיין נמשכת.", "two": "שתי חריגות עדיין נמשכות.", "many": "{n} חריגות עדיין נמשכות."},
    # ---- elevators
    "elevators.down": {"zero": "לא נרשמו תקלות או השבתות במעליות.", "one": "מעלית אחת הייתה תקולה או מושבתת.", "two": "שתי מעליות היו תקולות או מושבתות.",
                       "many": "{n} מעליות היו תקולות או מושבתות."},
    "elevators.minutes": {"many": "סך זמן התקלה וההשבתה: {dur}."},
    "elevators.fire": {"one": "פיקוד כבאים הופעל במעלית אחת.", "two": "פיקוד כבאים הופעל בשתי מעליות.", "many": "פיקוד כבאים הופעל ב־{n} מעליות."},
    "elevators.now": {"one": "כרגע מעלית אחת תקולה או מושבתת.", "two": "כרגע שתי מעליות תקולות או מושבתות.", "many": "כרגע {n} מעליות תקולות או מושבתות."},
    # ---- generator
    "generator.alerts": {"zero": "לא היו התראות מהגנרטור.", "one": "הייתה התראה אחת מהגנרטור.", "two": "היו שתי התראות מהגנרטור.", "many": "היו {n} התראות מהגנרטור."},
    "generator.critical": {"one": "מהן אחת קריטית.", "two": "מהן שתיים קריטיות.", "many": "מהן {n} קריטיות."},
    "generator.active": {"one": "מתוכן אחת עדיין פעילה.", "two": "מתוכן שתיים עדיין פעילות.", "many": "מתוכן {n} עדיין פעילות."},
}

# the units of a duration, with their own number forms
_HOURS = {"one": "שעה אחת", "two": "שעתיים", "many": "{n} שעות"}
_MINUTES = {"one": "דקה אחת", "two": "שתי דקות", "many": "{n} דקות"}


def form(n: int, forms: dict[str, str]) -> str:
    """The sentence form for the count `n`: zero, one, two, else many (two falls back to many; zero to many)."""
    if n == 0 and "zero" in forms:
        key = "zero"
    elif n == 1 and "one" in forms:
        key = "one"
    elif n == 2 and "two" in forms:
        key = "two"
    else:
        key = "many"
    return forms[key]


def say(key: str, n: int, **extra: Any) -> str:
    """One sentence of the summary: the template of `key` in the form of the count `n`, `{n}` and the extras filled in."""
    return form(n, T[key]).format(n=n, **extra)


def duration(total_minutes: int) -> str:
    """A span in Hebrew: whole hours and minutes ("שעתיים ו־30 דקות"); under one minute reads as one minute."""
    total = max(1, int(total_minutes))
    h, m = divmod(total, 60)
    parts: list[str] = []
    if h:
        parts.append(form(h, _HOURS).format(n=h))
    if m:
        parts.append(form(m, _MINUTES).format(n=m))
    if len(parts) == 2:  # "ו־30 דקות" before a digit, "ודקה אחת" / "ושתי דקות" before a word
        return parts[0] + (" ו־" if parts[1][0].isdigit() else " ו") + parts[1]
    return parts[0]


def local_label(local: Any) -> str:
    """A local instant as `DD.MM HH:MM` (the installation's zone; the year is left out, a summary is about now)."""
    return local.strftime("%d.%m %H:%M")


def render(window: dict[str, Any], sections: list[dict[str, Any]], quiet: bool) -> str:
    """The plain text of the whole summary: heading, period, then each section (its title and one bullet per sentence)."""
    lines = [HEAD, PERIOD.format(start=window["start_label"], end=window["end_label"], dur=window["duration_text"]), ""]
    if not sections:
        lines.append(NOTHING)
        return "\n".join(lines)
    if quiet:
        lines += [QUIET, ""]
    for s in sections:
        lines.append(s["title"])
        lines += [BULLET + x["text"] for x in s["lines"]]
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"
