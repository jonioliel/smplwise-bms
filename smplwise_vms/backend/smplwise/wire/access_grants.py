"""Response models of routers/access_grants.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset({'GET /access-grants/export.csv'})
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /access-grants/contacts/{contact_id}/identity', 'GET /access-grants/digest', 'GET /access-grants/drift', 'GET /access-grants/pending-contacts', 'GET /access-grants/readiness', 'GET /access-grants/{grant_id}/history', 'POST /access-grants/links/{link_id}/push-name', 'POST /access-grants/{grant_id}/attach-recovered', 'POST /access-grants/{grant_id}/card', 'POST /access-grants/{grant_id}/card/capture', 'POST /access-grants/{grant_id}/confirm-gone', 'POST /access-grants/{grant_id}/provision-now', 'POST /access-grants/{grant_id}/read-now', 'POST /access-grants/{grant_id}/refuse', 'PUT /access-grants/entrances/{station_id}', 'PUT /access-grants/settings'})


class AccessGrantsGrantsGrantPerson(ExactModel):
    contact_id: str
    name: str
    pending: bool
    number: str | None


class AccessGrantsGrantsGrantLink(ExactModel):
    id: str
    origin: str
    state: str


class AccessGrantsGrantsGrant(ExactModel):
    grant_state: str
    needs_push: bool
    pending_sync: bool
    scope_verified: bool
    revoke_proof: str | None
    scope_verified_at: str | None
    doors_state: str | None
    id: str
    revision: Num
    state: str
    end_reason: str | None
    source: str
    source_ref: Any
    person: AccessGrantsGrantsGrantPerson
    doors: list[dict[str, Any]]
    valid_from: str
    valid_until: str
    timing: Any
    credential: str
    outside_window: bool
    code_mode: str
    first_entry_at: Any
    pending_amendment: Any
    approved_by: str
    approved_at: str
    code_state: str | None
    code_due_at: str | None
    code_sends: Num | None
    card_state: Any
    notice: list[dict[str, str]]
    attention: Any
    linked: bool
    company: str
    category: str
    created_at: str
    updated_at: str
    ended_at: str | None
    revoking_since: str | None
    approved_by_name: str
    link: AccessGrantsGrantsGrantLink
    create_unresolved: bool
    closure: Any
    purpose: Any
    notes: Any
    self_requested: bool


class AccessGrantsGrantsRules(ExactModel):
    external_grants: str
    go_live_permitted: bool
    max_days: Num
    max_doors: Num
    phone_fresh_days: Num
    code_hour: Num
    local_approvers: str


class AccessGrantsGrantsScreen(ExactModel):
    digest_channel: str
    digest_day: Num
    digest_hour: Num
    name_sync: str
    placement: str
    arrival_after_grant: str


class AccessGrantsGrantsWiskey(ExactModel):
    as_of: str | None
    reachable: bool
    has_copy: bool


class AccessGrantsGrants(ExactModel):
    grants: list[AccessGrantsGrantsGrant]
    enabled: bool
    rules: AccessGrantsGrantsRules
    screen: AccessGrantsGrantsScreen
    system_admin: bool
    may_request: bool
    wiskey: AccessGrantsGrantsWiskey


class AccessGrantsGrantableDoorsStation(ExactModel):
    station_id: str
    name: str
    online: bool
    relays: list[dict[str, Any]]
    may_request: bool
    may_approve: bool
    may_approve_pin: bool
    entrance: bool
    ticket: bool


class AccessGrantsGrantableDoors(ExactModel):
    """ACCESSREQ-293: the form's doors - every station of the served WisKey copy with its doors and whether the caller may request / approve it (owner decision b), with the copy's freshness (`as_of`, `reachable`)."""
    stations: list[AccessGrantsGrantableDoorsStation]
    max_doors: Num
    max_days: Num
    tickets_requester: bool
    system_admin: bool
    as_of: str
    reachable: bool
    has_copy: bool


class AccessGrantsApproversApprover(ExactModel):
    name: str
    me: bool


class AccessGrantsApprovers(ExactModel):
    """ACCESSREQ-293: who holds the approve permissions on every chosen station (display names; the caller only when he is a system administrator - owner decision a)."""
    approvers: list[AccessGrantsApproversApprover]
    count: Num
    self_approval: bool


class AccessGrantsNotice(ExactModel):
    """ACCESSREQ-293: the privacy notice (n2) and the attestation in the person's language, from access_grants.notice_text (the organisation name / contact point stay in sync with the arrival page)."""
    lang: str
    version: str
    text: str
    attest: str


class AccessGrantsSettings(ExactModel):
    external_grants: str
    go_live_permitted: bool
    max_days: Num
    max_days_cap: Num
    max_doors: Num
    phone_fresh_days: Num
    code_hour: Num
    local_approvers: str
    cards: str
    card_capture: str
    pending_retention_days: Num
    pending_max_per_vendor: Num
    denied_alert: str
    digest_channel: str
    digest_day: Num
    digest_hour: Num
    name_sync: str
    placement: str
    arrival_after_grant: str


class AccessGrantsRevokeAll(ExactModel):
    revoked: Num


class AccessGrantsMatchLink(ExactModel):
    link: AccessGrantsGrantsGrantLink


class AccessGrantsUnlink(ExactModel):
    link_id: str
    state: str


class AccessGrantsDeletePerson(ExactModel):
    link_id: str
    outcome: str
    pending: bool


class AccessGrantsAcceptContact(ExactModel):
    contact_id: str
    accepted: bool


class AccessGrantsRejectContact(ExactModel):
    contact_id: str
    rejected: bool
    deleted: bool
    requests_ended: Num


class AccessGrantsRequestGrantGrantDoor(ExactModel):
    station_id: str
    name: str
    relays: list[Num]


class AccessGrantsRequestGrantGrantTiming(ExactModel):
    dates: list[Any]
    days: list[str]
    mode: str
    periods: list[dict[str, str]]
    timezone: str


class AccessGrantsRequestGrantGrantPendingAmendment(ExactModel):
    credential: str
    doors: dict[str, Any]
    timing: Any
    valid_from: str
    valid_until: str


class AccessGrantsRequestGrantGrantNoticeItem(ExactModel):
    via: str
    version: str
    at: str


class AccessGrantsRequestGrantGrant(ExactModel):
    grant_state: str
    needs_push: bool
    pending_sync: bool
    scope_verified: bool
    revoke_proof: Any
    scope_verified_at: str | None
    doors_state: str
    id: str
    revision: Num
    state: str
    end_reason: Any
    source: str
    source_ref: str | None
    person: AccessGrantsGrantsGrantPerson
    doors: list[AccessGrantsRequestGrantGrantDoor]
    valid_from: str
    valid_until: str
    timing: AccessGrantsRequestGrantGrantTiming | None
    credential: str
    outside_window: bool
    code_mode: str
    first_entry_at: Any
    pending_amendment: AccessGrantsRequestGrantGrantPendingAmendment | None
    approved_by: str | None
    approved_at: str | None
    code_state: str | None
    code_due_at: str | None
    code_sends: Num | None
    card_state: Any
    notice: list[AccessGrantsRequestGrantGrantNoticeItem]
    attention: str | None
    linked: bool
    company: str | None
    category: str
    created_at: str
    updated_at: str
    ended_at: Any
    revoking_since: Any
    approved_by_name: str | None
    link: AccessGrantsGrantsGrantLink | None
    create_unresolved: bool
    closure: Any
    purpose: str | None
    notes: str | None
    self_requested: bool


class AccessGrantsRequestGrantApproval(ExactModel):
    approved: bool
    code: str = None
    message: str = None


class AccessGrantsRequestGrant(ExactModel):
    """A manual request: `tickets.manage` + `tickets.external` (installation), or the grant permission somewhere (CR 3.2)."""
    grant: AccessGrantsRequestGrantGrant
    outcome: str
    approval: AccessGrantsRequestGrantApproval | None


class AccessGrantsOneGrantPerson(ExactModel):
    contact_id: str
    name: str
    pending: bool
    number: str


class AccessGrantsOneGrant(ExactModel):
    grant_state: str
    needs_push: bool
    pending_sync: bool
    scope_verified: bool
    revoke_proof: Any
    scope_verified_at: Any
    doors_state: str
    id: str
    revision: Num
    state: str
    end_reason: Any
    source: str
    source_ref: Any
    person: AccessGrantsOneGrantPerson
    doors: list[AccessGrantsRequestGrantGrantDoor]
    valid_from: str
    valid_until: str
    timing: Any
    credential: str
    outside_window: bool
    code_mode: str
    first_entry_at: Any
    pending_amendment: Any
    approved_by: Any
    approved_at: Any
    code_state: str
    code_due_at: Any
    code_sends: Num
    card_state: Any
    notice: list[Any]
    attention: Any
    linked: bool
    company: str
    category: str
    created_at: str
    updated_at: str
    ended_at: Any
    revoking_since: Any
    approved_by_name: Any
    link: Any
    create_unresolved: bool
    closure: Any
    purpose: Any
    notes: Any
    self_requested: bool


class AccessGrantsOne(ExactModel):
    grant: AccessGrantsOneGrant


class AccessGrantsApproveGrantTiming(ExactModel):
    dates: list[str]
    days: list[str]
    mode: str
    periods: list[dict[str, str]]
    timezone: str


class AccessGrantsApproveGrant(ExactModel):
    grant_state: str
    needs_push: bool
    pending_sync: bool
    scope_verified: bool
    revoke_proof: Any
    scope_verified_at: Any
    doors_state: str
    id: str
    revision: Num
    state: str
    end_reason: Any
    source: str
    source_ref: str | None
    person: AccessGrantsOneGrantPerson
    doors: list[AccessGrantsRequestGrantGrantDoor]
    valid_from: str
    valid_until: str
    timing: AccessGrantsApproveGrantTiming | None
    credential: str
    outside_window: bool
    code_mode: str
    first_entry_at: Any
    pending_amendment: Any
    approved_by: str
    approved_at: str
    code_state: str
    code_due_at: str | None
    code_sends: Num
    card_state: Any
    notice: list[AccessGrantsRequestGrantGrantNoticeItem]
    attention: str | None
    linked: bool
    company: str
    category: str
    created_at: str
    updated_at: str
    ended_at: Any
    revoking_since: Any
    approved_by_name: str
    link: AccessGrantsGrantsGrantLink | None
    create_unresolved: bool
    closure: Any
    purpose: str | None
    notes: str | None
    self_requested: bool


class AccessGrantsApprove(ExactModel):
    grant: AccessGrantsApproveGrant


class AccessGrantsRevokeGrant(ExactModel):
    grant_state: str
    needs_push: bool
    pending_sync: bool
    scope_verified: bool
    revoke_proof: str | None
    scope_verified_at: Any
    doors_state: str | None
    id: str
    revision: Num
    state: str
    end_reason: str
    source: str
    source_ref: Any
    person: AccessGrantsGrantsGrantPerson
    doors: list[AccessGrantsRequestGrantGrantDoor]
    valid_from: str
    valid_until: str
    timing: Any
    credential: str
    outside_window: bool
    code_mode: str
    first_entry_at: Any
    pending_amendment: Any
    approved_by: str
    approved_at: str
    code_state: str | None
    code_due_at: str | None
    code_sends: Num | None
    card_state: Any
    notice: list[AccessGrantsRequestGrantGrantNoticeItem]
    attention: str
    linked: bool
    company: str
    category: str
    created_at: str
    updated_at: str
    ended_at: str | None
    revoking_since: str
    approved_by_name: str
    link: AccessGrantsGrantsGrantLink
    create_unresolved: bool
    closure: Any
    purpose: Any
    notes: Any
    self_requested: bool


class AccessGrantsRevoke(ExactModel):
    grant: AccessGrantsRevokeGrant


class AccessGrantsRotateGrant(ExactModel):
    grant_state: str
    needs_push: bool
    pending_sync: bool
    scope_verified: bool
    revoke_proof: Any
    scope_verified_at: str
    doors_state: str
    id: str
    revision: Num
    state: str
    end_reason: Any
    source: str
    source_ref: Any
    person: AccessGrantsOneGrantPerson
    doors: list[AccessGrantsRequestGrantGrantDoor]
    valid_from: str
    valid_until: str
    timing: Any
    credential: str
    outside_window: bool
    code_mode: str
    first_entry_at: Any
    pending_amendment: Any
    approved_by: str
    approved_at: str
    code_state: str
    code_due_at: str
    code_sends: Num
    card_state: Any
    notice: list[AccessGrantsRequestGrantGrantNoticeItem]
    attention: Any
    linked: bool
    company: str
    category: str
    created_at: str
    updated_at: str
    ended_at: Any
    revoking_since: Any
    approved_by_name: str
    link: AccessGrantsGrantsGrantLink
    create_unresolved: bool
    closure: Any
    purpose: Any
    notes: Any
    self_requested: bool


class AccessGrantsRotate(ExactModel):
    grant: AccessGrantsRotateGrant
