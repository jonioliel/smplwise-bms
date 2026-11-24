"""Response models of routers/access_control_wa_queue.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /access-control/people/{person_id}/messages/template-installed/{operation_id}', 'POST /access-control/messaging/installed/registry-sync', 'POST /access-control/people/{person_id}/messages/template-installed', 'POST /access-control/people/{person_id}/messages/template-installed/{operation_id}/cancel', 'PUT /access-control/messaging/installed'})


class AccessControlWaQueueInstalledOverviewGates(ExactModel):
    messaging_enabled: bool
    template_switch: bool
    permit: bool


class AccessControlWaQueueInstalledOverviewRegistry(ExactModel):
    templates: list[Any]
    wiskey_rows: Num
    arx_rows: Num
    native_accounts: Num
    native_sendable: bool
    last_sync: Any


class AccessControlWaQueueInstalledOverview(ExactModel):
    """The gates (messaging switch, template switch, code permit), what WisKey's join selects now, the registry by source, the queue journal."""
    settings: dict[str, Any]
    gates: AccessControlWaQueueInstalledOverviewGates
    commands: dict[str, bool]
    registry: AccessControlWaQueueInstalledOverviewRegistry
    jobs: list[Any]
    queue_ttl_s: Num
    delivery_receipts: bool
    excluded: list[str]
