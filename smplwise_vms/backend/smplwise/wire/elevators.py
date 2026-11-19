"""Response models of the elevators API (routers/elevators.py, `/api/v1/infra/elevators...`; docs/changes/CR-INFRA-ELEVATORS.md, 2.8.0
history and alert settings). Operator answers speak in role keys and labels, never entity ids; only the manage answers carry entity ids.
Field order is the order the router builds its dicts in."""
from __future__ import annotations

from typing import Literal

from pydantic import Field

from . import WireModel

# routes without a JSON body
NO_JSON = frozenset({"DELETE /infra/elevators/{elevator_id}"})

ElevatorState = Literal["fire_service", "fault", "out_of_service", "moving_up", "moving_down", "door_open", "waiting", "active", "travelling", "unknown"]


class ElevatorLiveExtra(WireModel):
    """An extra sensor's live value (labelled by the manager; null = no live value)."""
    position: int
    label: str
    on: bool | None


class ElevatorHistorySegment(WireModel):
    state: str
    from_: str = Field(alias="from")
    to: str


class ElevatorOperator(WireModel):
    """One elevator as an operator sees it (services/elevators.live_of over the sensors he may see)."""
    id: str
    name: str
    area_id: str | None
    area_name: str | None
    state: ElevatorState
    reason: str
    partial: bool
    stale: bool
    since: str | None
    roles: list[str]
    flags: dict[str, bool | None]
    """2.8.0: each mapped role's live value (null = no live value) - the Infrastructure screen's sensor lights."""
    extras: list[ElevatorLiveExtra]
    uses_travel: bool
    history: list[ElevatorHistorySegment] | None = None
    """Only with `?history=24`: the state segments of the last 24 hours; null for an elevator whose sensors the caller does not see whole."""


class ElevatorList(WireModel):
    elevators: list[ElevatorOperator]
    summary: dict[str, int]
    """state -> count over the listed elevators (every state key present)."""
    stale: bool
    at: str


class ElevatorSensorLink(WireModel):
    entity_id: str
    entity_name: str
    missing: bool


class ElevatorExtraLink(WireModel):
    entity_id: str
    label: str
    entity_name: str
    missing: bool


class ElevatorManaged(WireModel):
    """One elevator in the manage listing: the live fields first, then the definition. `extras` is the mapping (entity id + label), not the
    live on / off."""
    state: ElevatorState
    reason: str
    partial: bool
    stale: bool
    since: str | None
    roles: list[str]
    flags: dict[str, bool | None]
    extras: list[ElevatorExtraLink]
    id: str
    name: str
    area_id: str | None
    area_name: str | None
    enabled: bool
    show_travel: bool
    sort_order: int
    revision: int
    sensors: dict[str, ElevatorSensorLink]
    """role -> the linked binary sensor."""


class ElevatorManageList(WireModel):
    elevators: list[ElevatorManaged]
    roles: list[str]
    max_extras: int


class ElevatorCandidate(WireModel):
    entity_id: str
    name: str
    device_class: str | None
    area_name: str | None


class ElevatorCandidates(WireModel):
    items: list[ElevatorCandidate]


class ElevatorAlertRecipients(WireModel):
    roles: list[str]
    users: list[str]
    groups: list[str]


class ElevatorAlertState(WireModel):
    enabled: bool
    recipients: ElevatorAlertRecipients
    channels: list[str]


class ElevatorAlertRole(WireModel):
    id: str
    label: str


class ElevatorAlerts(WireModel):
    """The elevator alert settings (services/elevator_alerts.view) and what the caller may change."""
    enabled: bool
    states: dict[str, ElevatorAlertState]
    row_version: int
    roles: list[ElevatorAlertRole]
    channels: list[Literal["push", "app", "whatsapp"]]
    states_order: list[str]
    can_edit: bool
    can_whatsapp: bool
