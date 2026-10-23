"""CR-EMERG104: the pure part of the emergency readiness view - the closed lists, the editable thresholds and their validation, the rule
of every item (a measured fact in, a status out) and the verdict. No database, no clock of its own, no device: every function takes plain
values so a test crosses every green / amber / red edge with plain numbers.

Statuses: green | amber | red | unknown (no data / not configured / source off or stale - NEVER green) | not_applicable (an audited choice).
Verdict (CR section 2): NOT_READY = any critical item red; READY_WITH_GAPS = no critical red, but a critical item amber / unknown, or a
supporting item red / amber; READY = every applicable critical item green and no supporting item red / amber. Worst item wins: this is not
a weighted percentage."""
from __future__ import annotations

import re
from typing import Any

STATUSES = ("green", "amber", "red", "unknown", "not_applicable")
VERDICTS = ("ready", "ready_with_gaps", "not_ready")
SLOTS = ("fire_certificate", "extinguishers", "hydrants_sprinklers", "emergency_lighting", "evacuation_round", "elevator_inspection")
GROUPS = ("power", "fire", "elevators", "doors", "people", "records", "cameras")

# id -> (group, critical by default, slot or None)
ITEMS: dict[str, tuple[str, bool]] = {
    "E01": ("power", True), "E02": ("power", True), "E02b": ("power", False),
    "E03": ("fire", True), "E04": ("fire", True), "E05": ("fire", True), "E06": ("fire", True), "E07": ("fire", False), "E08": ("fire", False),
    "E09": ("elevators", True), "E10": ("elevators", False),
    "E11": ("doors", True), "E12": ("doors", True),
    "E13": ("people", True), "E14": ("people", False),
    "E15": ("records", True), "E16": ("records", True),
    "E17": ("cameras", True), "E18": ("cameras", False), "E19": ("cameras", False),
}
SLOT_OF = {"E03": "fire_certificate", "E04": "extinguishers", "E05": "hydrants_sprinklers", "E06": "emergency_lighting", "E07": "evacuation_round", "E09": "elevator_inspection"}

# key -> (default, low, high, label_he). Owner q204 (a): the defaults are editable in Settings, and the defaults themselves can be changed.
THRESHOLDS: dict[str, tuple[float, float, float]] = {
    "generator_test_green_days": (35, 1, 365),
    "generator_test_amber_days": (60, 2, 730),
    "fuel_green_pct": (50, 1, 100),
    "fuel_amber_pct": (25, 0, 99),
    "battery_min_v": (11.5, 1, 60),
    "backup_green_days": (2, 1, 60),
    "backup_amber_days": (7, 2, 120),
    "drill_green_days": (180, 7, 1095),
    "offbox_green_days": (30, 1, 365),
    "door_drill_green_days": (180, 7, 1095),
    "delivery_fail_amber_pct": (5, 0, 100),
    "delivery_fail_red_pct": (20, 1, 100),
    "backlog_green_min": (10, 1, 1440),
    "backlog_red_min": (60, 2, 10080),
    "cameras_green_pct": (95, 1, 100),
    "cameras_amber_pct": (80, 0, 99),
    "contact_verify_days": (30, 1, 365),
    "contacts_min": (2, 1, 20),
    "recorder_stale_s": (180, 30, 3600),
    "history_keep_days": (365, 30, 3650),
}
# the pairs that must stay ordered (the first is the stricter bound)
ORDER_UP = (("generator_test_green_days", "generator_test_amber_days"), ("backup_green_days", "backup_amber_days"),
            ("delivery_fail_amber_pct", "delivery_fail_red_pct"), ("backlog_green_min", "backlog_red_min"))
ORDER_DOWN = (("fuel_green_pct", "fuel_amber_pct"), ("cameras_green_pct", "cameras_amber_pct"))
THRESHOLDS_VERSION = 1


class Invalid(ValueError):
    def __init__(self, field: str, code: str) -> None:
        super().__init__(f"{field}: {code}")
        self.field = field
        self.code = code


def default_thresholds() -> dict[str, float]:
    return {k: v[0] for k, v in THRESHOLDS.items()}


def merged_thresholds(stored: Any) -> dict[str, float]:
    """The defaults overlaid with the stored overrides (an unknown key, a wrong type or an out-of-range value is ignored: the default stands)."""
    out = default_thresholds()
    if isinstance(stored, dict):
        for k, v in stored.items():
            if k in THRESHOLDS and not isinstance(v, bool) and isinstance(v, (int, float)) and THRESHOLDS[k][1] <= v <= THRESHOLDS[k][2]:
                out[k] = v
    for lo, hi in ORDER_UP:
        if out[lo] > out[hi]:
            out[lo], out[hi] = default_thresholds()[lo], default_thresholds()[hi]
    for hi, lo in ORDER_DOWN:
        if out[hi] < out[lo]:
            out[hi], out[lo] = default_thresholds()[hi], default_thresholds()[lo]
    return out


def validate_thresholds(raw: Any) -> dict[str, float]:
    """A partial update of the overrides: every key known, every value a number inside its range, the ordered pairs still ordered."""
    if not isinstance(raw, dict):
        raise Invalid("thresholds", "type")
    out: dict[str, float] = {}
    for k, v in raw.items():
        if k not in THRESHOLDS:
            raise Invalid(f"thresholds.{k}", "unknown")
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            raise Invalid(f"thresholds.{k}", "number")
        lo, hi = THRESHOLDS[k][1], THRESHOLDS[k][2]
        if not lo <= v <= hi:
            raise Invalid(f"thresholds.{k}", "range")
        out[k] = v
    return out


def check_order(full: dict[str, float]) -> None:
    for lo, hi in ORDER_UP:
        if full[lo] > full[hi]:
            raise Invalid(f"thresholds.{lo}", "order")
    for hi, lo in ORDER_DOWN:
        if full[hi] < full[lo]:
            raise Invalid(f"thresholds.{hi}", "order")


def worst(statuses: list[str]) -> str:
    """The worst of several statuses (red > amber > unknown > green); an empty list is unknown."""
    order = {"red": 3, "amber": 2, "unknown": 1, "green": 0}
    present = [s for s in statuses if s in order]
    if not present:
        return "unknown"
    return max(present, key=lambda s: order[s])


# ---------------------------------------------------------------- the item rules (a measured fact in, a status out)

def age_days(then_iso: str | None, now_iso: str) -> float | None:
    """Whole-and-fractional days between two UTC ISO instants; None when `then_iso` is missing or unparseable."""
    import datetime as dt

    if not then_iso:
        return None
    try:
        a = dt.datetime.fromisoformat(then_iso.replace("Z", "+00:00"))
        b = dt.datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
        if a.tzinfo is None:
            a = a.replace(tzinfo=dt.timezone.utc)
        return (b - a).total_seconds() / 86400.0
    except ValueError:
        return None


def by_age(days: float | None, green: float, amber: float) -> str:
    """No value -> unknown; <= green -> green; <= amber -> amber; else red."""
    if days is None:
        return "unknown"
    if days <= green:
        return "green"
    return "amber" if days <= amber else "red"


def generator_test(days_since: float | None, result_ok: bool | None, ledger_days: float | None, th: dict[str, float]) -> str:
    """E01. A failed last result or no test ever recorded is red; roles beat the ledger; the ledger alone can reach amber at best."""
    if days_since is None and ledger_days is None:
        return "red"
    if result_ok is False:
        return "red"
    if days_since is not None:
        return by_age(days_since, th["generator_test_green_days"], th["generator_test_amber_days"])
    st = by_age(ledger_days, th["generator_test_amber_days"], th["generator_test_amber_days"])  # a completion inside the amber window
    return "amber" if st == "green" else "red"


def generator_state(fuel_pct: float | None, engine: str | None, mode: str | None, battery_v: float | None, open_alerts: list[str], th: dict[str, float]) -> str:
    """E02. `open_alerts` holds the severities of the open generator alerts. Nothing known at all -> unknown."""
    if fuel_pct is None and engine is None and mode is None and battery_v is None and not open_alerts:
        return "unknown"
    if "critical" in open_alerts or engine == "fault" or mode == "off" or (fuel_pct is not None and fuel_pct < th["fuel_amber_pct"]):
        return "red"
    amber = (fuel_pct is not None and fuel_pct < th["fuel_green_pct"]) or mode == "manual" or (battery_v is not None and battery_v < th["battery_min_v"]) or bool(open_alerts)
    if amber:
        return "amber"
    if fuel_pct is None or mode is None:
        return "unknown"  # a clean engine but the fuel level or the controller mode is not read: never green on a guess
    return "green"


def ledger_state(due_states: list[str]) -> str:
    """E03-E06: the worst state of the bound ledger tasks. No bound task = red (an unbound critical slot is red, not omitted)."""
    if not due_states:
        return "red"
    if "overdue" in due_states:
        return "red"
    if "none" in due_states:
        return "unknown"
    if "due_soon" in due_states:
        return "amber"
    return "green"


def evacuation_round(due_states: list[str], last_results: list[str | None]) -> str:
    """E07: the round's ledger state, softened by the result of its last finished run."""
    base = ledger_state(due_states)
    if base == "green" and any(r == "issues" for r in last_results):
        return "amber"
    if base == "green" and any(r is None for r in last_results):
        return "unknown"
    return base


def ticket_requests(open_n: int, past_sla_n: int) -> str:
    """E08."""
    if open_n == 0:
        return "green"
    return "red" if past_sla_n else "amber"


def elevator_states(states: list[str], any_unmonitored: bool) -> str:
    """E10: the derived states of the visible elevators (fire_service is an event, not a defect)."""
    if not states:
        return "unknown"
    live = [s for s in states if s != "fire_service"]
    if any(s == "fault" for s in live):
        return "red"
    if any(s in ("door_open", "out_of_service") for s in live):
        return "amber"
    if any(s == "unknown" for s in live) or any_unmonitored:
        return "unknown"
    return "green"


def door_controls(module_on: bool, attested: bool, controls_enabled: bool, feed: str | None, drill_days: float | None, th: dict[str, float]) -> str:
    """E11 (critical only while the door emergency module is on)."""
    if not module_on:
        return "not_applicable"
    if controls_enabled and not attested:
        return "red"
    if feed in ("ha_unavailable", "error", "connecting"):
        return "red"
    if feed != "ready":
        return "unknown"
    if drill_days is None:
        return "amber"
    return "green" if drill_days <= th["door_drill_green_days"] else "amber"


def door_faults(unconfirmed_n: int, open_incidents_n: int) -> str:
    """E12."""
    return "red" if (unconfirmed_n or open_incidents_n) else "green"


def contacts(reachable: int, verified_ok: int, minimum: int) -> str:
    """E13 (the dedicated list, owner q203 b): `reachable` = active contacts with a route; `verified_ok` = of those, verified inside the window."""
    if reachable == 0:
        return "red"
    if reachable >= minimum and verified_ok >= reachable:
        return "green"
    return "amber"


def combine_people(contacts_status: str, sources_total: int, sources_empty: int) -> str:
    """E13 = the dedicated list AND the derived recipients of the critical notification sources: a critical source nobody would be told about is red."""
    if sources_empty:
        return "red"
    if contacts_status == "green" and sources_total == 0:
        return "green"
    return contacts_status


def suppliers(linked: int, bad: int, doc_warn: int) -> str:
    """E14: suppliers linked to the emergency slots."""
    if linked == 0:
        return "unknown"
    if bad:
        return "red"
    return "amber" if doc_warn else "green"


def deliveries(sent: int, failed: int, oldest_backlog_min: float | None, th: dict[str, float]) -> str:
    """E15: the failure rate over the window and the age of the oldest queued message. No traffic at all -> unknown (nothing proves it works)."""
    backlog = oldest_backlog_min or 0
    if backlog > th["backlog_red_min"]:
        return "red"
    total = sent + failed
    if total == 0:
        return "unknown" if backlog <= th["backlog_green_min"] else "amber"
    rate = 100.0 * failed / total
    if rate > th["delivery_fail_red_pct"]:
        return "red"
    if rate >= th["delivery_fail_amber_pct"] or backlog > th["backlog_green_min"]:
        return "amber"
    return "green"


def backup(local_days: float | None, drill_days: float | None, offbox_days: float | None, th: dict[str, float]) -> str:
    """E16."""
    if local_days is None or local_days > th["backup_amber_days"]:
        return "red"
    if local_days <= th["backup_green_days"] and drill_days is not None and drill_days <= th["drill_green_days"] and offbox_days is not None and offbox_days <= th["offbox_green_days"]:
        return "green"
    return "amber"


def recorders(reachable: list[bool | None], disks_bad: list[bool], rec_exception: list[bool], go2rtc: str | None, disks_degraded: list[bool]) -> str:
    """E17. `go2rtc` is the health report status (ok | warn | error | None when not configured)."""
    if not reachable:
        return "unknown"
    if any(r is False for r in reachable) or any(disks_bad) or any(rec_exception) or go2rtc == "error":
        return "red"
    if any(r is None for r in reachable):
        return "unknown"
    if any(disks_degraded) or go2rtc == "warn":
        return "amber"
    return "green"


def cameras(pct_online: float | None, marked_offline: int, th: dict[str, float]) -> str:
    """E18: the overall online percentage; a marked emergency camera that is offline is red."""
    if pct_online is None:
        return "unknown"
    if marked_offline:
        return "red"
    if pct_online >= th["cameras_green_pct"]:
        return "green"
    return "amber" if pct_online >= th["cameras_amber_pct"] else "red"


def clock(worst_health: str | None) -> str:
    """E19: the worst status of the recorder clock checks of the health report (ok | warn | error)."""
    return {"ok": "green", "warn": "amber", "error": "red"}.get(worst_health or "", "unknown")


# ---------------------------------------------------------------- the verdict

def verdict(rows: list[dict[str, Any]]) -> str:
    """`rows`: every item (hidden / redacted ones included) with `status` and `critical`. not_applicable items are ignored."""
    live = [r for r in rows if r["status"] != "not_applicable"]
    crit = [r for r in live if r["critical"]]
    if any(r["status"] == "red" for r in crit):
        return "not_ready"
    if any(r["status"] in ("amber", "unknown") for r in crit) or any(r["status"] in ("red", "amber") for r in live if not r["critical"]):
        return "ready_with_gaps"
    return "ready"


def counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    out = {"green": 0, "amber": 0, "red": 0, "unknown": 0, "not_applicable": 0}
    for r in rows:
        out[r["status"]] += 1
    return out


NOTE_MAX = 200
_CTRL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f‪-‮⁦-⁩]")


def clean_text(value: Any, field: str, *, max_len: int, required: bool = False) -> str:
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise Invalid(field, "type")
    value = value.strip()
    if _CTRL.search(value):
        raise Invalid(field, "control_characters")
    if required and not value:
        raise Invalid(field, "required")
    if len(value) > max_len:
        raise Invalid(field, "too_long")
    return value
