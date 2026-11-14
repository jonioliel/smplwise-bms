"""CR-038 slice 2: the EFFECTIVE policy of a department - its own overrides (columns of `ticket_departments`, edited with
`tickets.configure`) over the installation values of `tickets.settings` (section 14.1, edited with `system.configure`).

    link lifetime (D5)      link_sliding_days / link_cap_days / link_grace_hours   NULL = the installation's links.*
    vendor send hours (D4)  send_hours_json                                         NULL = the installation's send_hours
    urgent as critical (D28) urgent_is_critical                                     NULL = the installation's urgent_is_critical
    automatic close (D10)   auto_close_after_days                                   NULL = two-step (a manager closes "done")
    history to the handler  share_history_external (D3 / D23)                      the department default of the per-ticket box
    reopen window           reopen_days

The values are read at the moment of each computation ("the effective values are those of the ticket's department at the moment
of each computation", 10.2). Later slices read them HERE and nowhere else: links (slice 4), the outbox send hours (5b), the SLA
monitor's automatic close and the notification severity (6). Pure functions over the two rows; the only reads are the settings
document and the department row."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass, field
from typing import Any

from . import settings_doc

# the department columns that override an installation value, and the installation key each one falls back to
OVERRIDES: dict[str, tuple[str, ...]] = {
    "link_sliding_days": ("links", "sliding_days"),
    "link_cap_days": ("links", "cap_days"),
    "link_grace_hours": ("links", "grace_hours"),
    "send_hours": ("send_hours",),
    "urgent_is_critical": ("urgent_is_critical",),
}
AUTO_CLOSE_DAYS = (1, 30)  # D10: "automatic close N days after done", N in 1-30
NEVER_SHARED_DOMAINS = frozenset({"lock", "alarm_control_panel", "cover", "camera"})  # D3: never to a handler, whatever the switches say


@dataclass(frozen=True)
class DepartmentPolicy:
    link_sliding_days: int
    link_cap_days: int
    link_grace_hours: int
    send_hours: dict[str, str]
    urgent_is_critical: bool
    auto_close_after_days: int | None
    share_history_external: bool
    reopen_days: int
    overridden: frozenset[str] = field(default_factory=frozenset)

    def as_dict(self) -> dict[str, Any]:
        return {
            "links": {"sliding_days": self.link_sliding_days, "cap_days": self.link_cap_days, "grace_hours": self.link_grace_hours},
            "send_hours": dict(self.send_hours), "urgent_is_critical": self.urgent_is_critical,
            "auto_close_after_days": self.auto_close_after_days, "share_history_external": self.share_history_external,
            "reopen_days": self.reopen_days, "overridden": sorted(self.overridden),
        }


def send_hours_of(dept: dict[str, Any]) -> dict[str, str] | None:
    """The department's own send-hours window (None = the installation's; a corrupt stored value reads as None - fail safe)."""
    raw = dept.get("send_hours_json")
    if not raw:
        return None
    try:
        return settings_doc.send_hours(json.loads(raw))
    except (ValueError, TypeError):
        return None


def overrides_of(dept: dict[str, Any]) -> dict[str, Any]:
    """The raw override values of a department row (None = not overridden), as the settings screen edits them."""
    uic = dept.get("urgent_is_critical")
    return {
        "link_sliding_days": dept.get("link_sliding_days"),
        "link_cap_days": dept.get("link_cap_days"),
        "link_grace_hours": dept.get("link_grace_hours"),
        "send_hours": send_hours_of(dept),
        "urgent_is_critical": None if uic is None else bool(uic),
    }


def _valid(key: str, value: Any) -> Any:
    lo, hi = {"link_sliding_days": settings_doc.SLIDING_DAYS, "link_cap_days": settings_doc.CAP_DAYS,
              "link_grace_hours": settings_doc.GRACE_HOURS}.get(key, (None, None))
    if lo is not None:
        return settings_doc.int_range(lo, hi)(value)
    if key == "send_hours":
        return settings_doc.send_hours(value)
    return settings_doc.boolean(value)


def resolve(installation: dict[str, Any], dept: dict[str, Any]) -> DepartmentPolicy:
    """The effective policy from an installation document (settings_doc.read) and a department row."""
    own = overrides_of(dept)
    values: dict[str, Any] = {}
    overridden: set[str] = set()
    for key, path in OVERRIDES.items():
        inst: Any = installation
        for p in path:
            inst = inst[p]
        v = own.get(key)
        if v is not None:
            try:
                v = _valid(key, v)
                overridden.add(key)
            except ValueError:
                v = None  # a stored value outside the ranges reads as the installation value (fail safe)
        values[key] = inst if v is None else v
    if values["link_cap_days"] < values["link_sliding_days"]:
        # the department's pair may break the rule only through an installation change made later: the cap wins upward, never shorter
        values["link_cap_days"] = values["link_sliding_days"]
    auto = dept.get("auto_close_after_days")
    if isinstance(auto, bool) or not isinstance(auto, int) or not AUTO_CLOSE_DAYS[0] <= auto <= AUTO_CLOSE_DAYS[1]:
        auto = None
    return DepartmentPolicy(
        link_sliding_days=values["link_sliding_days"], link_cap_days=values["link_cap_days"], link_grace_hours=values["link_grace_hours"],
        send_hours=dict(values["send_hours"]), urgent_is_critical=bool(values["urgent_is_critical"]), auto_close_after_days=auto,
        share_history_external=bool(dept.get("share_history_external")), reopen_days=int(dept.get("reopen_days") or 14),
        overridden=frozenset(overridden),
    )


def effective(conn: sqlite3.Connection, dept: dict[str, Any]) -> DepartmentPolicy:
    return resolve(settings_doc.read(conn), dept)


def notify_severity(policy: DepartmentPolicy, priority_severity: str) -> str:
    """D28 / 13.4: with `urgent_is_critical` off a priority's `critical` severity is capped at `alert` (no quiet-hours bypass, no
    CR-018 escalation); otherwise the priority's own severity stands. For slice 6's notification bridge."""
    if priority_severity == "critical" and not policy.urgent_is_critical:
        return "alert"
    return priority_severity


def may_share_history(policy: DepartmentPolicy, domain: str) -> bool:
    """The department DEFAULT of the "share device history" box (D23), never true for the security domains (D3). The per-vendor
    default (slice 4) and the per-ticket box (slices 3 / 4) refine it; this is the floor every layer respects."""
    return policy.share_history_external and domain not in NEVER_SHARED_DOMAINS
