"""Response models of routers/bridge_key.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /system/bridge-key/notice', 'POST /system/bridge-key/revoke', 'POST /system/bridge-key/revoke/reveal', 'PUT /system/bridge-key/owner-contacts'})


class BridgeKeyBridgeKeyKey(ExactModel):
    kid: str
    generation: Num
    state: str
    created_at: str
    activated_at: str
    verify_until: Any
    ended_at: Any
    readable: bool


class BridgeKeyBridgeKeyKey2(ExactModel):
    kid: str
    generation: Num
    state: str
    created_at: str
    activated_at: str | None
    verify_until: str | None
    ended_at: str | None


class BridgeKeyBridgeKeyRotationStep(ExactModel):
    step: str
    ok: bool
    code: Any
    at: str


class BridgeKeyBridgeKeyRotation(ExactModel):
    id: str
    mode: str
    state: str
    kid_from: str
    kid_to: str
    gen_from: Num
    gen_to: Num
    overlap_s: Num
    started_at: str
    t0_at: str
    switched_at: str
    ended_at: Any
    result_code: Any
    peer_retire_ok: Any
    anchor_eligible: bool
    steps: list[BridgeKeyBridgeKeyRotationStep]
    retire_at: str


class BridgeKeyBridgeKeyLastStep(ExactModel):
    step: str
    ok: bool
    code: str | None
    at: str


class BridgeKeyBridgeKeyLast(ExactModel):
    id: str
    mode: str
    state: str
    kid_from: str
    kid_to: str
    gen_from: Num
    gen_to: Num
    overlap_s: Num
    started_at: str
    t0_at: str
    switched_at: str | None
    ended_at: str | None
    result_code: str | None
    peer_retire_ok: Num | None
    anchor_eligible: bool
    steps: list[BridgeKeyBridgeKeyLastStep]


class BridgeKeyBridgeKeyHistoryItem(ExactModel):
    id: str
    mode: str
    state: str
    kid_from: str
    kid_to: str
    gen_from: Num
    gen_to: Num
    overlap_s: Num
    started_at: str
    t0_at: str
    switched_at: str | None
    ended_at: str | None
    result_code: str | None
    peer_retire_ok: Num | None
    anchor_eligible: bool
    steps: list[dict[str, Any]]


class BridgeKeyBridgeKeyOwnerContactsCandidate(ExactModel):
    id: str
    name: str


class BridgeKeyBridgeKeyOwnerContacts(ExactModel):
    ids: list[Any]
    users: list[Any]
    candidates: list[BridgeKeyBridgeKeyOwnerContactsCandidate]
    set: bool
    max: Num
    recipients: Num


class BridgeKeyBridgeKeyNoticeBanner(ExactModel):
    show: bool
    open: Num
    contacts_set: bool


class BridgeKeyBridgeKeyWatchdogItem(ExactModel):
    code: str
    rotation_id: str
    since: str


class BridgeKeyBridgeKeyHandOverLastRotation(ExactModel):
    rotation_id: str
    mode: str
    state: str
    gen_from: Num
    gen_to: Num
    verified_old_rejected: bool
    anchor_eligible: bool
    completed_at: str


class BridgeKeyBridgeKeyHandOver(ExactModel):
    key_generation: Num
    last_rotation: BridgeKeyBridgeKeyHandOverLastRotation | None
    anchor_decrease_available: bool
    bridge_generation: Any


class BridgeKeyBridgeKeyRevocation(ExactModel):
    state: str
    id: Any
    revoked_at: Any
    revoked_by_name: Any
    repaired_at: Any
    reveals: Num
    last_reveal_at: Any
    wiskey_present: bool
    announce_path: bool
    paired_at: str | None
    step_up_ready: bool


class BridgeKeyBridgeKey(ExactModel):
    enabled: bool
    go_live_permitted: bool
    peer_available: bool
    adopted: bool
    key: BridgeKeyBridgeKeyKey | None
    keys: list[BridgeKeyBridgeKeyKey2]
    rotation: BridgeKeyBridgeKeyRotation | None
    last: BridgeKeyBridgeKeyLast | None
    history: list[BridgeKeyBridgeKeyHistoryItem]
    reminder_days: Num
    reminder_values: list[Num]
    reminder_due: bool
    can_start: bool
    blocked_by: str | None
    automatic: str
    owner_contacts: BridgeKeyBridgeKeyOwnerContacts
    notice_banner: BridgeKeyBridgeKeyNoticeBanner
    watchdog: list[BridgeKeyBridgeKeyWatchdogItem]
    hand_over: BridgeKeyBridgeKeyHandOver
    revocation: BridgeKeyBridgeKeyRevocation


class BridgeKeyPutBridgeKeySettingsKey(ExactModel):
    kid: str
    generation: Num
    state: str
    created_at: str
    activated_at: str
    verify_until: str | None
    ended_at: Any


class BridgeKeyPutBridgeKeySettingsLast(ExactModel):
    id: str
    mode: str
    state: str
    kid_from: str
    kid_to: str
    gen_from: Num
    gen_to: Num
    overlap_s: Num
    started_at: str
    t0_at: str
    switched_at: str
    ended_at: Any
    result_code: Any
    peer_retire_ok: Any
    anchor_eligible: bool
    steps: list[BridgeKeyBridgeKeyRotationStep]


class BridgeKeyPutBridgeKeySettingsHistoryItem(ExactModel):
    id: str
    mode: str
    state: str
    kid_from: str
    kid_to: str
    gen_from: Num
    gen_to: Num
    overlap_s: Num
    started_at: str
    t0_at: str
    switched_at: str
    ended_at: Any
    result_code: Any
    peer_retire_ok: Any
    anchor_eligible: bool
    steps: list[dict[str, Any]]


class BridgeKeyPutBridgeKeySettingsHandOver(ExactModel):
    key_generation: Num
    last_rotation: Any
    anchor_decrease_available: bool
    bridge_generation: Any


class BridgeKeyPutBridgeKeySettingsRevocation(ExactModel):
    state: str
    id: Any
    revoked_at: Any
    revoked_by_name: Any
    repaired_at: Any
    reveals: Num
    last_reveal_at: Any
    wiskey_present: bool
    announce_path: bool
    paired_at: str | None


class BridgeKeyPutBridgeKeySettings(ExactModel):
    enabled: bool
    go_live_permitted: bool
    peer_available: bool
    adopted: bool
    key: BridgeKeyBridgeKeyKey | None
    keys: list[BridgeKeyPutBridgeKeySettingsKey]
    rotation: BridgeKeyBridgeKeyRotation | None
    last: BridgeKeyPutBridgeKeySettingsLast | None
    history: list[BridgeKeyPutBridgeKeySettingsHistoryItem]
    reminder_days: Num
    reminder_values: list[Num]
    reminder_due: bool
    can_start: bool
    blocked_by: str
    automatic: str
    owner_contacts: BridgeKeyBridgeKeyOwnerContacts
    notice_banner: BridgeKeyBridgeKeyNoticeBanner
    watchdog: list[Any]
    hand_over: BridgeKeyPutBridgeKeySettingsHandOver
    revocation: BridgeKeyPutBridgeKeySettingsRevocation


class BridgeKeyStartRotation(ExactModel):
    rotation: BridgeKeyBridgeKeyLast


class BridgeKeyResumeRotationRotation(ExactModel):
    id: str
    mode: str
    state: str
    kid_from: str
    kid_to: str
    gen_from: Num
    gen_to: Num
    overlap_s: Num
    started_at: str
    t0_at: str
    switched_at: str | None
    ended_at: str
    result_code: str | None
    peer_retire_ok: Num
    anchor_eligible: bool
    steps: list[BridgeKeyBridgeKeyLastStep]


class BridgeKeyResumeRotation(ExactModel):
    rotation: BridgeKeyResumeRotationRotation
