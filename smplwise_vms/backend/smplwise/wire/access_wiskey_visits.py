"""Response models of routers/access_wiskey_visits.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class AccessWiskeyVisitsHomeCapabilitiesVisits(ExactModel):
    available: bool
    reason: Any
    message: Any


class AccessWiskeyVisitsHomeCapabilitiesPush(ExactModel):
    available: bool
    reason: str
    message: str
    switch: str
    offered: bool


class AccessWiskeyVisitsHomeCapabilities(ExactModel):
    visits: AccessWiskeyVisitsHomeCapabilitiesVisits
    templates: AccessWiskeyVisitsHomeCapabilitiesVisits
    push: AccessWiskeyVisitsHomeCapabilitiesPush


class AccessWiskeyVisitsHomeCan(ExactModel):
    list: bool
    settings: bool


class AccessWiskeyVisitsHome(ExactModel):
    capabilities: AccessWiskeyVisitsHomeCapabilities
    can: AccessWiskeyVisitsHomeCan


class AccessWiskeyVisitsVisitsVisitsItem(ExactModel):
    id: str
    status: str
    reason_code: str | None
    requested_at: str
    decided_at: str | None
    display_name: str
    access_category: str
    valid_from: str
    valid_until: str
    doors: dict[str, Any]
    weekly_hours: bool
    stale: bool
    user_deleted: bool
    source: str
    external_ref: str | None
    revision: Num
    origin: str
    arx_invite_id: str | None
    read_only: bool


class AccessWiskeyVisitsVisitsVisits(ExactModel):
    items: list[AccessWiskeyVisitsVisitsVisitsItem]
    total: Num
    offset: Num
    next_offset: Any
    revision: Num


class AccessWiskeyVisitsVisits(ExactModel):
    state: str
    last_error: Any
    fetched_at: str
    visits: AccessWiskeyVisitsVisitsVisits


class AccessWiskeyVisitsTemplatesTemplatesItem(ExactModel):
    id: str
    label: str
    access_category: str
    duration_minutes: Num
    doors: dict[str, Any]
    weekly_hours: bool
    updated_at: str


class AccessWiskeyVisitsTemplatesTemplates(ExactModel):
    items: list[AccessWiskeyVisitsTemplatesTemplatesItem]
    revision: Num


class AccessWiskeyVisitsTemplates(ExactModel):
    state: str
    last_error: Any
    fetched_at: str
    templates: AccessWiskeyVisitsTemplatesTemplates


class AccessWiskeyVisitsLinksLink(ExactModel):
    invite_id: str
    state: str
    pushed_revision: Num | None  # null for an invitation never pushed (link state `never`)
    current_revision: Num
    in_sync: bool
    pushable: bool
    wiskey_visit_id: str | None  # null until WisKey answered a record
    last_code: Any
    attempted_at: str | None  # null for an invitation never pushed


class AccessWiskeyVisitsLinks(ExactModel):
    links: list[AccessWiskeyVisitsLinksLink]


class AccessWiskeyVisitsPushRecord(ExactModel):
    visit_id: str
    revision: Num
    arx_revision: Num
    status: str


class AccessWiskeyVisitsPush(ExactModel):
    status: str
    record: AccessWiskeyVisitsPushRecord
    link: AccessWiskeyVisitsLinksLink


class AccessWiskeyVisitsReconcileLink(ExactModel):
    invite_id: str
    state: str
    pushed_revision: Num | None
    current_revision: Num
    in_sync: bool
    pushable: bool
    wiskey_visit_id: str | None
    last_code: str | None
    attempted_at: str


class AccessWiskeyVisitsReconcile(ExactModel):
    verdict: str
    link: AccessWiskeyVisitsReconcileLink


class AccessWiskeyVisitsPutSettingsCapabilitiesPush(ExactModel):
    available: bool
    reason: str | None
    message: str | None
    switch: str
    offered: bool


class AccessWiskeyVisitsPutSettingsCapabilities(ExactModel):
    visits: AccessWiskeyVisitsHomeCapabilitiesVisits
    templates: AccessWiskeyVisitsHomeCapabilitiesVisits
    push: AccessWiskeyVisitsPutSettingsCapabilitiesPush


class AccessWiskeyVisitsPutSettings(ExactModel):
    capabilities: AccessWiskeyVisitsPutSettingsCapabilities
