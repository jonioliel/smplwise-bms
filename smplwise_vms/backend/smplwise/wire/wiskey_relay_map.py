"""Response models of routers/wiskey_relay_map.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class WiskeyRelayMapRelayMapStation(ExactModel):
    id: str
    name: str
    in_copy: bool
    online: bool
    relays: list[dict[str, Any]]
    revision: Num
    approved_by: str | None
    approved_at: str | None
    rows: list[dict[str, Any]]
    automated_relays: list[Num]


class WiskeyRelayMapRelayMap(ExactModel):
    """The WisKey relay map per station, with its revision and who approved it; read-only without system.configure."""
    state: str
    has_copy: bool
    can_edit: bool
    confirm_word: str
    stations: list[WiskeyRelayMapRelayMapStation]


class WiskeyRelayMapRelayMapExportLive(ExactModel):
    content_digest: str
    snapshot: dict[str, Any]


class WiskeyRelayMapRelayMapExportLatest(ExactModel):
    seq: Num
    kind: str
    rollback_of: Any
    content_digest: str
    exported_by: str
    exported_at: str
    acked_by: str | None
    acked_at: str | None
    state: str
    stale: bool
    current: bool
    newer_approvals: list[Any]


class WiskeyRelayMapRelayMapExportExport(ExactModel):
    seq: Num
    kind: str
    rollback_of: Any
    content_digest: str
    exported_by: str
    exported_at: str
    acked_by: str | None
    acked_at: str | None
    state: str
    stale: bool
    current: bool
    newer_approvals: list[str]


class WiskeyRelayMapRelayMapExport(ExactModel):
    """WISKEY-RELAYEXPORT-2320: the full relay map snapshot (tombstones too) with its digest and the numbered export log; admin only, read only."""
    live: WiskeyRelayMapRelayMapExportLive
    publication: str
    latest: WiskeyRelayMapRelayMapExportLatest | None
    exports: list[WiskeyRelayMapRelayMapExportExport]


class WiskeyRelayMapRelayMapExportRecord(ExactModel):
    """WISKEY-RELAYEXPORT-2320: one sealed relay map export with its snapshot, ack and stale state; admin only, read only."""
    seq: Num
    kind: str
    rollback_of: Any
    content_digest: str
    exported_by: str
    exported_at: str
    acked_by: str | None
    acked_at: str | None
    state: str
    stale: bool
    current: bool
    newer_approvals: list[Any]
    snapshot: dict[str, Any]


class WiskeyRelayMapApproveRelayMapStationRelay(ExactModel):
    physical_index: Num
    name: str


class WiskeyRelayMapApproveRelayMapStationRow(ExactModel):
    api_relay: Num
    physical_relay: Num | None
    active: bool
    row_revision: Num | None
    updated_at: str | None


class WiskeyRelayMapApproveRelayMapStation(ExactModel):
    id: str
    name: str
    in_copy: bool
    online: bool
    relays: list[WiskeyRelayMapApproveRelayMapStationRelay]
    revision: Num
    approved_by: str
    approved_at: str
    rows: list[WiskeyRelayMapApproveRelayMapStationRow]
    automated_relays: list[Num]


class WiskeyRelayMapApproveRelayMap(ExactModel):
    """Approve one station's api relay -> physical relay map (CAS on the station revision; nothing is sent to a device; the committed map is then offered to the Native as metadata only with the owner's `wiskey.auto_install` on - `_sync_native`)."""
    revision: Num
    station: WiskeyRelayMapApproveRelayMapStation


class WiskeyRelayMapRelayInventoryRole(ExactModel):
    api_id: Num
    role: str


class WiskeyRelayMapRelayInventoryOutputs(ExactModel):
    """The remote-control API outputs the station profile reported at load (not physical relays); `count` null = not observed."""
    ids: list[Num]
    count: Num | None
    evidence: str
    roles: list[WiskeyRelayMapRelayInventoryRole]


class WiskeyRelayMapRelayInventoryMapping(ExactModel):
    """WisKey's saved physical relay <-> API output configuration (not a measurement); the role is always unknown."""
    physical_index: Num
    api_id: Num
    confirmation: str
    role: str


class WiskeyRelayMapRelayInventoryTest(ExactModel):
    supported: bool
    reason: str


class WiskeyRelayMapRelayInventoryData(ExactModel):
    station_id: str
    api_outputs: WiskeyRelayMapRelayInventoryOutputs
    configured_mapping: list[WiskeyRelayMapRelayInventoryMapping]
    physical_relay_count: Num | None
    physical_verified: bool
    non_actuating_test: WiskeyRelayMapRelayInventoryTest


class WiskeyRelayMapRelayInventory(ExactModel):
    """WISKEY-RELAY-INV-2520: what WisKey knows about one station's relays (`stations/relay_inventory_v1`, READ only) as `{state, reason, wiskey_code, fetched_at, data}`; unknown counts and roles stay unknown, no relay test exists, nothing is written."""
    station_id: str
    state: str
    reason: str | None
    wiskey_code: str | None
    fetched_at: str | None
    data: WiskeyRelayMapRelayInventoryData | None
