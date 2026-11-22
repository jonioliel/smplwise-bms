"""Response models of routers/wiskey_pairing.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'POST /system/wiskey-pairing/probe'})


class WiskeyPairingPairingStatusLineFacts(ExactModel):
    installed_version: Any = None
    active_version: str | None = None
    source_version: Any = None
    paired_at: str | None = None
    directory_at: str | None = None
    paired: bool = None
    discovery_messages: Num = None
    discovery_swept: bool = None
    discovery_path_open: bool = None
    version: Any = None
    mode: str = None
    feed_state: str = None
    present: bool = None
    can_sign: bool = None
    fingerprint: str | None = None
    kid: str | None = None
    source: str | None = None
    feed_video: bool = None
    feed_talk: bool = None
    feed_reason: str = None
    listed: dict[str, Any] = None
    choice: str = None
    readiness: list[str] = None
    row: dict[str, str] = None
    enabled: bool = None
    active: bool = None
    last: Any = None
    caught_up_at: Any = None
    stored: Num = None
    gap: Any = None
    probe: Any = None
    discovery: Any = None
    media_transport: Any = None
    refused_count: Num = None
    refused_since: str = None
    refused_code: str = None
    blocked_by_wiskey: bool = None


class WiskeyPairingPairingStatusLine(ExactModel):
    key: str
    label: str
    state: str
    reason: str
    text: str
    fix: str | None
    facts: WiskeyPairingPairingStatusLineFacts


class WiskeyPairingPairingStatusRepair(ExactModel):
    available: bool
    reason: str | None
    announce: bool
    addon_url: str


class WiskeyPairingPairingStatusFeatureLink(ExactModel):
    href: str
    label: str


class WiskeyPairingPairingStatusFeature(ExactModel):
    row: Num
    key: str
    group: str
    label: str
    state: str
    reasons: list[dict[str, str]]
    link: WiskeyPairingPairingStatusFeatureLink | None


class WiskeyPairingPairingStatus(ExactModel):
    """The Arx <-> WisKey pairing status (read only; nothing is sent to WisKey)."""
    generated_at: str
    verdict: str
    paired: bool | None
    talk_ready: bool
    lines: list[WiskeyPairingPairingStatusLine]
    probe: Any
    repair: WiskeyPairingPairingStatusRepair
    owner_steps: list[str]
    features: list[WiskeyPairingPairingStatusFeature]


class WiskeyPairingPairingRepairStatusLine(ExactModel):
    key: str
    label: str
    state: str
    reason: str
    text: str
    fix: str | None
    facts: dict[str, Any]


class WiskeyPairingPairingRepairStatusRepair(ExactModel):
    available: bool
    reason: Any
    announce: bool
    addon_url: str


class WiskeyPairingPairingRepairStatusFeature(ExactModel):
    row: Num
    key: str
    group: str
    label: str
    state: str
    reasons: list[dict[str, str]]
    link: dict[str, str] | None


class WiskeyPairingPairingRepairStatus(ExactModel):
    generated_at: str
    verdict: str
    paired: Any
    talk_ready: bool
    lines: list[WiskeyPairingPairingRepairStatusLine]
    probe: Any
    repair: WiskeyPairingPairingRepairStatusRepair
    owner_steps: list[str]
    features: list[WiskeyPairingPairingRepairStatusFeature]


class WiskeyPairingPairingRepair(ExactModel):
    """Re-pair Arx with the bridge (and so with WisKey): a new pairing code, announced to the bridge when possible."""
    announced: bool
    rotation_paused: bool
    pairing_code: str | None
    addon_url: str
    paired_at: Any
    steps: list[str]
    status: WiskeyPairingPairingRepairStatus
