"""Response models of routers/access_control_triage.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'POST /access-control/stations/{station_id}/alerts/{kind}/{action}', 'POST /access-control/stations/{station_id}/conflicts/{person_id}/review', 'POST /access-control/triage/reviews/{review_id}/resolve', 'PUT /access-control/triage/settings'})


class AccessControlTriageTriageViewNotifyLast(ExactModel):
    at: Any
    state: str
    emitted: Num
    resolved: Num


class AccessControlTriageTriageViewNotify(ExactModel):
    enabled: bool
    can_edit: bool
    last: AccessControlTriageTriageViewNotifyLast


class AccessControlTriageTriageViewRecent(ExactModel):
    conflicts: dict[str, Any]
    alerts: dict[str, Any]


class AccessControlTriageTriageView(ExactModel):
    may_resolve: bool
    may_act_alerts: bool
    feed: str
    notify: AccessControlTriageTriageViewNotify
    review_ttl_s: Num
    durations: list[Num]
    reasons: list[str]
    recent: AccessControlTriageTriageViewRecent
