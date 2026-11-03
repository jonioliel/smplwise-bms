"""Bounded dry plans for future adapters; no execution path or authority is created."""

from __future__ import annotations

from typing import Any

from ..arx_preview_features import PLAN_FLAGS
from .models import AccessError

REQUIREMENTS = {
    "door_windows": ("station_id", "relay", "mapping_revision", "start", "end", "timezone"),
    "emergency_buttons": ("station_id", "relay", "mapping_revision", "policy_ref"),
    "door_automations": ("station_id", "relay", "mapping_revision", "automation_ref", "expiry"),
    "people_csv": ("preview_ref", "ownership_policy_ref", "revision_policy_ref"),
    "live_media": ("station_id", "direction", "consent_ref", "expiry"),
    "live_validation": ("checklist_ref", "owner_go_ref", "expiry"),
}


def plan(feature: str, values: dict[str, Any]) -> dict[str, Any]:
    """Validate draft metadata, never accept actor/confirmed/token as authority.

    Values are bounded references, not credentials or CSV/media content. A future
    adapter must resolve and validate semantics/authority afresh, after acceptance.
    """
    if feature not in REQUIREMENTS:
        raise AccessError("unknown_feature")
    if PLAN_FLAGS.get(feature) is not True:
        raise AccessError("feature_disabled")
    required = set(REQUIREMENTS[feature])
    if not isinstance(values, dict) or set(values) != required:
        raise AccessError("invalid_fields")
    for name, value in values.items():
        if name in {"relay", "mapping_revision"}:
            if type(value) is not int or value < 1 or (name == "relay" and value > 2):
                raise AccessError("invalid_fields")
        elif not isinstance(value, str) or not 1 <= len(value) <= 128 or any(ord(c) < 32 for c in value):
            raise AccessError("invalid_fields")
    if feature == "live_media" and values["direction"] not in {"video_only", "two_way_audio"}:
        raise AccessError("invalid_fields")
    draft = dict(values)
    if feature == "door_windows":
        from .arx_feature_intents import window_intent

        draft = window_intent(draft)
    elif feature in {"door_automations", "live_media", "live_validation"}:
        from .arx_feature_intents import expiry_intent

        draft = expiry_intent(draft)
    return {"schema_version": 1, "feature": feature, "draft": draft,
        "execution_available": False, "authority_verified": False, "status": "adapter_not_implemented"}
