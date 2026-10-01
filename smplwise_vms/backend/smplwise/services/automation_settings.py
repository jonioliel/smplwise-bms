"""CR-017: the `automations.*` settings of the הגדרות › אוטומציות tab (docs/architecture/AUTOMATIONS_API.md §3.1 row 23, CR §4.7).

Stored as text like every setting; the JSON-valued ones are read back as objects and validated on write here, so routers/settings.py
only wires them in. Delegation is NOT a setting: the bridge's switch is shown read-only (status.delegation)."""
from __future__ import annotations

import json
import re
from typing import Any

LIMITS_DEFAULT: dict[str, int] = {"writes_per_min": 30, "preview_per_min": 60, "run_interval_s": 10, "scene_apply_interval_s": 3, "storm_item_per_min": 20, "storm_total_per_min": 200}
LIMITS_RANGE: dict[str, tuple[int, int]] = {"writes_per_min": (1, 600), "preview_per_min": (1, 1200), "run_interval_s": (0, 3600), "scene_apply_interval_s": (0, 600),
                                            "storm_item_per_min": (2, 1000), "storm_total_per_min": (5, 10000)}
CODE_VIEW_ROLES_DEFAULT = ["site_admin", "system_admin"]
BOOL_KEYS = ("automations.enabled", "automations.storm_auto_disable", "automations.sensitive_warning", "automations.templates_enabled", "automations.ask_when_on_new")
LIST_KEYS = ("automations.code_view_roles", "automations.templates_hidden", "automations.templates_order", "automations.notify_targets")
JSON_KEYS = LIST_KEYS + ("automations.limits",)
INT_KEYS = ("automations.trash_days", "automations.versions_keep")
INT_RANGE = {"automations.trash_days": (7, 90), "automations.versions_keep": (5, 50)}
DEFAULTS: dict[str, str] = {
    "automations.enabled": "true",
    "automations.code_view_roles": json.dumps(CODE_VIEW_ROLES_DEFAULT),
    "automations.trash_days": "30",
    "automations.versions_keep": "20",
    "automations.limits": json.dumps(LIMITS_DEFAULT, separators=(",", ":")),
    "automations.storm_auto_disable": "false",
    "automations.sensitive_warning": "true",
    "automations.templates_enabled": "true",
    "automations.templates_hidden": "[]",
    "automations.templates_order": "[]",
    "automations.notify_targets": "[]",
    "automations.ask_when_on_new": "false",
    # owner answers 2026-10-01: how the phone list header folds the state filter, and the colour of the sensitive-step warning chip
    "automations.phone_filter": "fold",
    "automations.sensitive_chip": "amber",
}
ENUM_KEYS: dict[str, tuple[str, ...]] = {"automations.phone_filter": ("fold", "rows"), "automations.sensitive_chip": ("amber", "red")}
_ROLE = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")
_TEMPLATE = re.compile(r"^[a-z0-9_]{1,40}$")
_NOTIFY = re.compile(r"^notify\.[a-z0-9_]{1,80}$")


def normalize_limits(value: Any) -> dict[str, int]:
    """The limits object with every key (defaults for the missing ones); a value outside its range, a foreign key or a non-integer is a ValueError."""
    if not isinstance(value, dict):
        raise ValueError("limits must be an object")
    out = dict(LIMITS_DEFAULT)
    for k, v in value.items():
        if k not in LIMITS_RANGE:
            raise ValueError(f"unknown limit {k}")
        lo, hi = LIMITS_RANGE[k]
        if isinstance(v, bool) or not isinstance(v, int) or not lo <= v <= hi:
            raise ValueError(f"{k}: {lo}-{hi}")
        out[k] = v
    return out


def normalize_list(key: str, value: Any) -> list[str]:
    if not isinstance(value, list):
        raise ValueError("a list is required")
    pat = {"automations.code_view_roles": _ROLE, "automations.notify_targets": _NOTIFY}.get(key, _TEMPLATE)
    out: list[str] = []
    for v in value:
        if not isinstance(v, str) or not pat.match(v):
            raise ValueError(f"invalid item in {key}")
        if v not in out:
            out.append(v)
    if len(out) > 200:
        raise ValueError("too many items")
    return out


def normalize(key: str, value: Any) -> Any:
    """A validated value of a JSON setting (ValueError otherwise)."""
    if key == "automations.limits":
        return normalize_limits(value)
    return normalize_list(key, value)


def stored(key: str, raw: Any) -> Any:
    """A stored text as the value the API shows (a corrupt JSON reads as the default)."""
    if key in INT_KEYS:
        try:
            lo, hi = INT_RANGE[key]
            return min(hi, max(lo, int(raw)))
        except (TypeError, ValueError):
            return int(DEFAULTS[key])
    if key == "automations.limits":
        try:
            return normalize_limits(json.loads(raw) if isinstance(raw, str) else raw)
        except (ValueError, TypeError):
            return dict(LIMITS_DEFAULT)
    if key in ENUM_KEYS:
        return raw if raw in ENUM_KEYS[key] else DEFAULTS[key]  # a corrupt or foreign value reads as the default
    if key in LIST_KEYS:
        try:
            return normalize_list(key, json.loads(raw) if isinstance(raw, str) else raw)
        except (ValueError, TypeError):
            return json.loads(DEFAULTS[key])
    return raw
