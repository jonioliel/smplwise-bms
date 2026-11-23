"""Response models of routers/access_control_messaging.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /access-control/people/{person_id}/messages', 'POST /access-control/messaging/recipients', 'POST /access-control/people/{person_id}/messages', 'PUT /access-control/messaging/settings', 'PUT /access-control/people/{person_id}/messages/optout'})


class AccessControlMessagingMessagingConfigSync(ExactModel):
    state: str
    connected: bool
    last_error: Any
    reconnects: Num
    started_at: Any
    fetched_at: Any
    refreshes: Num
    sequence: Num
    wiskey_version: Any


class AccessControlMessagingMessagingConfigMessaging(ExactModel):
    feature: bool
    enabled: bool
    can_send: bool
    can_reveal_phone: bool
    free_text: bool
    bulk_max: Num
    text_max: Num
    templates: list[Any]
    templates_revision: Num
    quota: Any
    sender_quota: Any
    send_hours: Any
    pace_ms: Num


class AccessControlMessagingMessagingConfig(ExactModel):
    """What the message dialog needs to know, for THIS caller: `feature` (an administrator switched messaging on), `enabled` (and the messaging service is connected), the administrator's `free_text` / `bulk_max`, `text_max`, the approved `template"""
    state: str
    configured: bool
    last_error: str | None
    fetched_at: Any
    sync: AccessControlMessagingMessagingConfigSync
    messaging: AccessControlMessagingMessagingConfigMessaging


class AccessControlMessagingMessagingSettingsLimits(ExactModel):
    templates_max: Num
    label_max: Num
    body_max: Num
    text_max: Num
    organization_max: Num
    bulk_max: list[Num]
    rate_per_hour: list[Num]
    per_sender_per_hour: list[Num]
    per_person_per_day: list[Num]
    per_station_per_hour: list[Num]
    placeholders: list[str]
    placeholders_max: Num


class AccessControlMessagingMessagingSettingsService(ExactModel):
    state: str
    connected: Any
    accounts: list[Any]
    problem: str | None
    last_error: str | None
    accounts_total: Num
    accounts_truncated: bool


class AccessControlMessagingMessagingSettingsConsent(ExactModel):
    page_problem: str | None
    notice_version: str
    resend_days: Num
    held_per_person: Num
    wait_days: list[Num]
    languages: list[str]
    dev_marked_languages: list[str]
    template_send_supported: bool


class AccessControlMessagingMessagingSettings(ExactModel):
    """The administrator's message settings (`system.configure`): the master switch, free text, the bulk and hourly limits, the organization name, the messaging account, the TEMPLATES and the catalogue's `revision` - plus the limits the editor val"""
    state: str
    configured: bool
    last_error: str | None
    fetched_at: Any
    sync: AccessControlMessagingMessagingConfigSync
    settings: dict[str, Any]
    limits: AccessControlMessagingMessagingSettingsLimits
    service: AccessControlMessagingMessagingSettingsService
    consent: AccessControlMessagingMessagingSettingsConsent
