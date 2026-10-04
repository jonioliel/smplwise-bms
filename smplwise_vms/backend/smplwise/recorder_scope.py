"""Which connection a recorder runs with (CR-024, docs/changes/CR-024-MULTI-NVR.md section 2.2).

`nvr-1` (PRIMARY) is the process-wide `Settings`: its `nvr_*` fields are the connection CR-022 overlays at start-up, so the
modules that read `settings.nvr_*` keep working for the first recorder unchanged. Every further recorder gets its own
effective `Settings` (the same object with its own `nvr_*` fields and `nvr_recorder_id`), overlaid ONCE at start-up from its
`recorder_connections` row and kept in `settings.recorder_settings`. A change to any recorder waits for the next start
(owner decision, restart semantics).

Rule: every device call for a camera goes through `camera_settings(settings, cam)` (or `settings_for(settings, rid)` for a
recorder-level call). A recorder this process has no usable connection for gets a child without a host, so the device
boundary (`mode.ensure_nvr`, called by the ISAPI client and the RTSP URL builders) answers 409 `recorder_unavailable` and
nothing is ever sent to another recorder's device.

Depends on config and errors only (no service import), so any module may use it."""
from __future__ import annotations

import dataclasses
import re
from collections.abc import Iterable, Mapping
from typing import Any

from .config import Settings

PRIMARY = "nvr-1"
# go2rtc's stream-name rule ([A-Za-z0-9_.-]) and never `ha_` (ADP section 3.1); ids are assigned by the server as `nvr-<n>`
RECORDER_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$")
NEW_ID_RE = re.compile(r"^nvr-(\d{1,6})$")


# CR-024 (owner 2026-10-04: disabling applies at once, no restart): the recorders an administrator disabled. Set at start-up from
# `recorders.enabled` (connection_store.apply_at_startup) and changed by `PATCH /recorders/{id}` while the process runs. A disabled
# recorder keeps its loaded connection in memory (so enabling it again needs no restart either) but is never contacted: every check
# below treats it as having no host, and the device boundary (mode.ensure_nvr) answers 409 `recorder_unavailable`.
DISABLED: set[str] = set()


def is_disabled(recorder_id: str | None) -> bool:
    return (recorder_id or PRIMARY) in DISABLED


def set_disabled(recorder_id: str, disabled: bool) -> None:
    if disabled:
        DISABLED.add(recorder_id)
    else:
        DISABLED.discard(recorder_id)


def valid_id(recorder_id: Any) -> bool:
    return isinstance(recorder_id, str) and bool(RECORDER_ID_RE.fullmatch(recorder_id)) and not recorder_id.startswith("ha_")


def is_child(settings: Settings) -> bool:
    return settings.nvr_recorder_id != PRIMARY


def unconfigured(settings: Settings, recorder_id: str) -> Settings:
    """A recorder this process has no usable connection for: no host, so every device call answers 409."""
    return dataclasses.replace(settings, nvr_recorder_id=recorder_id, nvr_host=None, nvr_user=None, nvr_password=None, nvr_extra={},
                               nvr_vendor="none", nvr_connection_state=None, nvr_connection_revision=None, nvr_from_options=False,
                               nvr_option_keys=frozenset(), recorder_settings={})


def settings_for(settings: Settings, recorder_id: str | None) -> Settings:
    """The effective settings of `recorder_id` (None = the primary). The primary is `settings` itself; a further recorder is
    its start-up child; an unknown, disabled or removed one is `unconfigured` (409 at the device boundary)."""
    rid = recorder_id or PRIMARY
    if rid == settings.nvr_recorder_id:
        return settings
    child = settings.recorder_settings.get(rid) if isinstance(settings.recorder_settings, Mapping) else None
    if child is not None:
        return child
    return unconfigured(settings, rid)


def camera_settings(settings: Settings, cam: Any) -> Settings:
    """The settings of the recorder a camera row belongs to (a row without `recorder_id` is the primary's)."""
    try:
        rid = cam["recorder_id"]
    except (KeyError, IndexError, TypeError):
        rid = None
    return settings_for(settings, rid)


def child_ids(settings: Settings) -> list[str]:
    """The further recorders this process loaded at start-up (ordered by id)."""
    return sorted(settings.recorder_settings) if isinstance(settings.recorder_settings, Mapping) else []


def has_host(settings: Settings) -> bool:
    if settings.nvr_vendor == "none" or settings.nvr_connection_state in ("unreadable", "refused", "disabled"):
        return False
    if settings.nvr_recorder_id in DISABLED:
        return False
    return bool((settings.nvr_host or "").strip())


def ready(settings: Settings) -> bool:
    """A recorder the server can talk to: a host and credentials."""
    return has_host(settings) and bool(settings.nvr_user and settings.nvr_password)


def configured_ids(settings: Settings) -> list[str]:
    """Every recorder with a host (primary first): the recorders the installation's NVR capability is made of."""
    out = [PRIMARY] if has_host(settings) else []
    return out + [rid for rid in child_ids(settings) if has_host(settings.recorder_settings[rid])]


def ready_ids(settings: Settings) -> list[str]:
    """Every recorder the background work (discovery, alert stream) may contact (primary first)."""
    out = [PRIMARY] if ready(settings) else []
    return out + [rid for rid in child_ids(settings) if ready(settings.recorder_settings[rid])]


def loaded_any(settings: Settings) -> bool:
    """Any recorder whose connection this process loaded, disabled or not (the background workers start for it, so enabling a
    disabled recorder while running needs no restart)."""
    primary = settings.nvr_vendor != "none" and settings.nvr_connection_state not in ("unreadable", "refused") and bool((settings.nvr_host or "").strip())
    return primary or bool(child_ids(settings))


def any_configured(settings: Settings) -> bool:
    return bool(configured_ids(settings))


def next_id(existing: Iterable[str]) -> str:
    """`nvr-<n>` above every id ever used (removed recorders keep theirs; an id is never reused)."""
    top = 0
    for rid in existing:
        m = NEW_ID_RE.fullmatch(rid or "")
        if m:
            top = max(top, int(m.group(1)))
    return f"nvr-{max(top, 1) + 1}"
