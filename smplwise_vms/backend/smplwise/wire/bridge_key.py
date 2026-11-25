"""Response models of routers/bridge_key.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


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
    rotation_id: str = None
    since: str
    arx_generation: Num = None
    bridge_generation: Num = None


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
    key_generation: Num | None
    last_rotation: BridgeKeyBridgeKeyHandOverLastRotation | None
    anchor_decrease_available: bool
    bridge_generation: Num | None


class BridgeKeyBridgeKeyRevocation(ExactModel):
    state: str
    id: str | None
    revoked_at: str | None
    revoked_by_name: str | None
    repaired_at: str | None
    reveals: Num
    last_reveal_at: Any
    wiskey_present: bool
    announce_path: bool
    paired_at: str | None
    step_up_ready: bool


class BridgeKeyBridgeKeyDirectTransportPairing(ExactModel):
    """WISKEY-DIRECT-V2-2520: the last `direct/pairing_status_v2` observation of the current v2 connection (never material)."""
    protocol_version: Num
    kid: str | None
    source: str
    verified_at: str
    freshness_s: Num


class BridgeKeyBridgeKeyDirectTransport(ExactModel):
    """WISKEY-DIRECT-V2-2520: the direct transport status (no I/O). `pairing_state`: verified | mismatch | unknown."""
    protocol_version: Num | None
    kid: str | None
    selection: str
    installed: bool
    connected: bool
    pairing: BridgeKeyBridgeKeyDirectTransportPairing | None
    pairing_state: str
    refusal: str | None
    revoke_in: str


class BridgeKeyServiceGrant(ExactModel):
    """WISKEY-R8-2520: the manual service grant v3 as WisKey reported it (`service_grants/current_v3`), or why nothing was read.
    `state`: active | absent_or_revoked | refused | unknown | unsupported | unavailable. Never a grant reference, never key material;
    `cards_granted` is always false; the owner acts only in WisKey's screen (`owner_actions_in`)."""
    state: str
    reason: str | None
    wiskey_code: str | None
    revision: Num | None
    fetched_at: str | None
    contract: str
    commands: list[str]
    cards_granted: bool
    owner_actions_in: str
    owner_screen_tab: str
    message_he: str
    message_en: str
    card_off_he: str
    card_off_en: str


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
    direct_transport: BridgeKeyBridgeKeyDirectTransport | None = None


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
    id: str | None
    revoked_at: str | None
    revoked_by_name: str | None
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


class BridgeKeyPutOwnerContactsOwnerContactsUser(ExactModel):
    id: str
    name: str
    valid: bool


class BridgeKeyPutOwnerContactsOwnerContacts(ExactModel):
    ids: list[str]
    users: list[BridgeKeyPutOwnerContactsOwnerContactsUser]
    candidates: list[BridgeKeyBridgeKeyOwnerContactsCandidate]
    set: bool
    max: Num
    recipients: Num


class BridgeKeyPutOwnerContactsRevocation(ExactModel):
    state: str
    id: Any
    revoked_at: Any
    revoked_by_name: Any
    repaired_at: Any
    reveals: Num
    last_reveal_at: Any
    wiskey_present: bool
    announce_path: bool
    paired_at: str


class BridgeKeyPutOwnerContacts(ExactModel):
    """WXH-LEFTOVERS-2405: the owner contacts for the bridge-key notices (system administrator; active system administrators only)."""
    enabled: bool
    go_live_permitted: bool
    peer_available: bool
    adopted: bool
    key: Any
    keys: list[Any]
    rotation: Any
    last: Any
    history: list[Any]
    reminder_days: Num
    reminder_values: list[Num]
    reminder_due: bool
    can_start: bool
    blocked_by: str
    automatic: str
    owner_contacts: BridgeKeyPutOwnerContactsOwnerContacts
    notice_banner: BridgeKeyBridgeKeyNoticeBanner
    watchdog: list[Any]
    hand_over: BridgeKeyPutBridgeKeySettingsHandOver
    revocation: BridgeKeyPutOwnerContactsRevocation


class BridgeKeyRevokeBridgeKeyStatusKey(ExactModel):
    kid: str
    generation: Num
    state: str
    created_at: str
    activated_at: str
    verify_until: Any
    ended_at: str


class BridgeKeyRevokeBridgeKeyStatusLast(ExactModel):
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
    switched_at: Any
    ended_at: str
    result_code: str
    peer_retire_ok: Any
    anchor_eligible: bool
    steps: list[Any]


class BridgeKeyRevokeBridgeKeyStatusOwnerContacts(ExactModel):
    ids: list[Any]
    users: list[Any]
    candidates: list[dict[str, str]]
    set: bool
    max: Num
    recipients: Num


class BridgeKeyRevokeBridgeKeyStatusHandOver(ExactModel):
    key_generation: Num
    last_rotation: BridgeKeyBridgeKeyHandOverLastRotation | None
    anchor_decrease_available: bool
    bridge_generation: Any


class BridgeKeyRevokeBridgeKeyStatusRevocation(ExactModel):
    state: str
    id: str
    revoked_at: str
    revoked_by_name: str
    repaired_at: Any
    reveals: Num
    last_reveal_at: Any
    wiskey_present: bool
    announce_path: bool
    paired_at: Any
    step_up_ready: bool


class BridgeKeyRevokeBridgeKeyStatus(ExactModel):
    enabled: bool
    go_live_permitted: bool
    peer_available: bool
    adopted: bool
    key: Any
    keys: list[BridgeKeyRevokeBridgeKeyStatusKey]
    rotation: Any
    last: BridgeKeyRevokeBridgeKeyStatusLast | None
    history: list[BridgeKeyRevokeBridgeKeyStatusLast]
    reminder_days: Num
    reminder_values: list[Num]
    reminder_due: bool
    can_start: bool
    blocked_by: str
    automatic: str
    owner_contacts: BridgeKeyRevokeBridgeKeyStatusOwnerContacts
    notice_banner: BridgeKeyBridgeKeyNoticeBanner
    watchdog: list[Any]
    hand_over: BridgeKeyRevokeBridgeKeyStatusHandOver
    revocation: BridgeKeyRevokeBridgeKeyStatusRevocation


class BridgeKeyRevokeBridgeKey(ExactModel):
    """The emergency revocation (system administrator)."""
    revoked: bool
    revocation_id: str
    announced: bool
    notice: str
    status: BridgeKeyRevokeBridgeKeyStatus


class BridgeKeyRevealNewCode(ExactModel):
    """The new pairing code after an emergency revocation, for the manual entry in the bridge."""
    pairing_code: str
    addon_url: str
    revocation_id: str
