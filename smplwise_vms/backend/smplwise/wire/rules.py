"""Response models of the alarm rules API (routers/rules.py, `/api/v1/rules...`; T052). Field order is the order services/rules builds its
dicts in (`row_to_rule`, `alert_row`, `dry_run`). A rule's trigger, scope, window and actions are its stored documents (the rule body as it
was saved; an older rule may lack a later key) and pass through as stored."""
from __future__ import annotations

from typing import Any, Literal

from . import WireModel

# routes without a JSON body
NO_JSON = frozenset({"DELETE /rules/{rule_id}"})


class RuleAlertCounts(WireModel):
    total: int
    open: int


class AlarmRule(WireModel):
    """One rule (services/rules.row_to_rule) with its alert counts."""
    id: str
    name: str
    description: str
    enabled: bool
    owner: Literal["local", "ha"]
    ha_automation_id: str | None
    trigger: dict[str, Any]
    """Stored: {types, sources, severity_min}."""
    scope: dict[str, Any]
    """Stored: {site_ids, building_ids, floor_ids, zone_ids, camera_ids, entity_ids}."""
    window: dict[str, Any]
    """Stored: {days, from, to}."""
    cooldown_s: int
    actions: list[dict[str, Any]]
    """Stored: [{kind, message, scope, ref, volume, critical, service}] (the keys the rule had when it was saved)."""
    revision: int
    created_by_username: str | None
    updated_by_username: str | None
    created_at: str
    updated_at: str
    last_fired_at: str | None
    alerts: RuleAlertCounts


class AlarmRuleList(WireModel):
    """Every rule plus the choices the editor offers."""
    rules: list[AlarmRule]
    types: list[str]
    sources: list[str]
    action_kinds: list[str]
    days: list[str]


class RuleAlertRow(WireModel):
    """An alert a local rule raised (services/rules.alert_row)."""
    id: str
    rule_id: str
    rule_name: str
    event_id: str
    camera_id: str | None
    entity_id: str | None
    fired_at: str
    occurred_at: str
    """The event's own time (cooldowns compare event times)."""
    reasons: list[str]
    message: str
    acked_at: str | None
    acked_by_username: str | None


class RuleAlertList(WireModel):
    alerts: list[RuleAlertRow]
    unacked: int
    """Open alerts in the caller's scope (never installation-wide)."""


class RuleDryRunRow(WireModel):
    """One replayed event and why the rule would (not) fire."""
    event_id: str
    occurred_at: str
    type: str
    source: str
    severity: str
    camera_id: str | None
    camera_name: str | None
    reasons: list[str]
    suppressed: str = ""
    """Only in `suppressed`: why a matching event was held back (the cooldown)."""


class RuleDryRun(WireModel):
    """`POST /rules/dry-run`: stored events of the last `hours` replayed through the rule; nothing is written or sent."""
    rule_name: str
    hours: int
    since: str
    until: str
    evaluated: int
    would_fire: list[RuleDryRunRow]
    suppressed: list[RuleDryRunRow]
    not_matched: int
    note: str
