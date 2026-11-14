"""Review spotlights (T047 / M047): which review windows deserve a look first, by deterministic rules over the window's
raw events - every rule is named and explained in the answer, so an operator sees WHY a window is lit and can disagree.
No model, no learning, no time-of-day: the same events always give the same spotlight. Confidence and sources are
carried from the events themselves (measured NVR alerts vs. recording-derived guesses), never invented here."""
from __future__ import annotations

from typing import Any

from .timeutil import parse_utc

SMART_TYPES = ("person", "vehicle", "line", "field")
INTEGRITY_TYPES = ("tamper", "offline", "coverage_gap")
DOOR_TYPES = ("door", "io")
ACTIVITY_TYPES = ("motion", "person", "vehicle", "line", "field")
BURST_MIN = 5
LONG_MIN_S = 600
SPOTLIGHT_MIN_SCORE = 2

# code -> (score, label, why). The why names the rule in the operator's words; the label is the chip.
RULES: dict[str, tuple[int, str, str]] = {
    "critical": (3, "חומרה קריטית", "לפחות אירוע אחד בחלון מסומן קריטי"),
    "smart": (2, "זיהוי חכם", "אדם, רכב, חציית קו או חדירה לאזור שדווחו כהתראה (לא נגזרו מהקלטה)"),
    "integrity": (2, "תקינות וידאו", "חבלה במצלמה, אובדן וידאו או פער בקליטת אירועים"),
    "door_activity": (2, "דלת + תנועה", "אירוע דלת או כניסת חיווי יחד עם תנועה או זיהוי באותו חלון"),
    "multi_camera": (1, "כמה מצלמות", "החלון כולל אירועים משתי מצלמות או יותר"),
    "burst": (1, "רצף", f"{BURST_MIN} אירועים או יותר בחלון אחד"),
    "long": (1, "חלון ארוך", f"החלון נמשך {LONG_MIN_S // 60} דקות או יותר"),
}
ORDER = tuple(RULES)


def evaluate(events: list[dict[str, Any]]) -> dict[str, Any]:
    """The spotlight verdict of one window: the rules it meets (in a fixed order, each with its score and reason), the
    total, whether the total lights the window, the confidence and the sources behind the lit rules."""
    hits: list[str] = []
    types = {ev.get("type") for ev in events}
    cameras = {ev.get("camera_id") for ev in events if ev.get("camera_id")}
    if any(ev.get("severity") == "critical" for ev in events):
        hits.append("critical")
    if any(ev.get("type") in SMART_TYPES and ev.get("confidence") == "measured" for ev in events):
        hits.append("smart")
    if types & set(INTEGRITY_TYPES):
        hits.append("integrity")
    if (types & set(DOOR_TYPES)) and (types & set(ACTIVITY_TYPES)):
        hits.append("door_activity")
    if len(cameras) >= 2:
        hits.append("multi_camera")
    if len(events) >= BURST_MIN:
        hits.append("burst")
    if events:
        starts = [parse_utc(ev["occurred_at"]) for ev in events]
        ends = [parse_utc(ev["ended_at"]) if ev.get("ended_at") else parse_utc(ev["occurred_at"]) for ev in events]
        if (max(ends) - min(starts)).total_seconds() >= LONG_MIN_S:
            hits.append("long")
    rules = [{"code": c, "score": RULES[c][0], "label": RULES[c][1], "why": RULES[c][2]} for c in ORDER if c in hits]
    score = sum(r["score"] for r in rules)
    return {
        "on": score >= SPOTLIGHT_MIN_SCORE,
        "score": score,
        "rules": rules,
        "confidence": "measured" if any(ev.get("confidence") == "measured" for ev in events) else "inferred",
        "sources": sorted({str(ev.get("source")) for ev in events if ev.get("source")}),
    }
