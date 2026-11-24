"""Response models of routers/building_presence.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class BuildingPresenceBuildingSnapshotRoom(ExactModel):
    area_id: str
    name: str
    floor: Any
    status: str
    sensors: Num
    empty_since: Any


class BuildingPresenceBuildingSnapshotSensor(ExactModel):
    entity_id: str
    name: str
    area_id: str
    status: str
    since: str


class BuildingPresenceBuildingSnapshot(ExactModel):
    """The live anonymous occupancy of the building and its rooms from the tagged presence sensors (presence.building.view); `configured: false` while none is tagged."""
    configured: bool
    enabled: bool
    settings: dict[str, Any]
    fresh: bool = None
    status: str = None
    occupied_rooms: Num = None
    rooms: list[BuildingPresenceBuildingSnapshotRoom] = None
    sensors: list[BuildingPresenceBuildingSnapshotSensor] = None
    empty_since: Any = None
    empty_minutes: Any = None
    empty_reached: bool = None
    at: str = None


class BuildingPresenceAreaPresenceLineSensors(ExactModel):
    status: str
    empty_since: Any
    sensors: Num


class BuildingPresenceAreaPresenceLinePeople(ExactModel):
    count: Num
    names: list[str] | None
    more: Num
    anonymous: bool


class BuildingPresenceAreaPresenceLine(ExactModel):
    """AREA-PRESENCE-LINE-2351: who / how many are in one area now, for the area screen's presence line."""
    area_id: str
    line: bool
    sensors: BuildingPresenceAreaPresenceLineSensors | None
    people: BuildingPresenceAreaPresenceLinePeople | None


class BuildingPresenceBuildingSensorsSensor(ExactModel):
    entity_id: str
    name: str
    area_id: str
    area_name: str
    device_class: str
    tagged: bool
    state: str


class BuildingPresenceBuildingSensorsRoom(ExactModel):
    area_id: str
    name: str


class BuildingPresenceBuildingSensors(ExactModel):
    """The presence / motion sensors that can be tagged, with their tag and the two settings (system.configure)."""
    sensors: list[BuildingPresenceBuildingSensorsSensor]
    rooms: list[BuildingPresenceBuildingSensorsRoom]
    settings: dict[str, Any]


class BuildingPresenceSetBuildingSensorsSensor(ExactModel):
    entity_id: str
    name: str
    area_id: str | None
    area_name: str | None
    device_class: str
    tagged: bool
    state: str


class BuildingPresenceSetBuildingSensors(ExactModel):
    """Replace the tagged set (system.configure; binary sensors only; audited with entity ids)."""
    sensors: list[BuildingPresenceSetBuildingSensorsSensor]
    rooms: list[BuildingPresenceBuildingSensorsRoom]
    settings: dict[str, Any]


class BuildingPresenceSetBuildingSettings(ExactModel):
    """The debounce hold (seconds) and the empty timeout (minutes) (system.configure; audited)."""
    settings: dict[str, Any]


class BuildingPresenceSetBuildingSensorRoomSensor(ExactModel):
    entity_id: str
    name: str
    area_id: str
    area_name: str
    device_class: str
    tagged: bool
    state: str
    placed: bool = None


class BuildingPresenceSetBuildingSensorRoom(ExactModel):
    """Place a tagged sensor in a room (area_id) or back to its own (null) (system.configure; audited)."""
    sensors: list[BuildingPresenceSetBuildingSensorRoomSensor]
    rooms: list[BuildingPresenceBuildingSensorsRoom]
    settings: dict[str, Any]


class BuildingPresenceBuildingHistory(ExactModel):
    """How much history is kept (count, oldest) and for how long (system.configure)."""
    rows: Num
    oldest: str | None
    retention_days: Num
    enabled: bool


class BuildingPresencePurgeBuildingHistory(ExactModel):
    """Erase the whole presence history now (system.configure; audited with the number of rows)."""
    deleted: Num
    rows: Num
    oldest: Any
    retention_days: Num
    enabled: bool
