"""HA1: a failed HA connect during a platform restart is classified (ha_restarting / ha_unreachable), the back-off is
capped at 15 s for the first 5 minutes of such a failure, and the platform restart started by the add-on resets it."""
from __future__ import annotations

import asyncio

from smplwise.errors import ApiError
from smplwise.services import addon_restart, ha_sync


class InvalidStatus(Exception):  # same class name as websockets.exceptions.InvalidStatus
    pass


def test_classify_failure():
    assert ha_sync.classify_failure(InvalidStatus("HTTP 502")) == "ha_restarting"
    assert ha_sync.classify_failure(ConnectionRefusedError()) == "ha_restarting"
    assert ha_sync.classify_failure(asyncio.TimeoutError()) == "ha_restarting"
    assert ha_sync.classify_failure(OSError("no route")) == "ha_unreachable"
    assert ha_sync.classify_failure(ApiError(401, "ha_auth_failed", "x")) == "ha_auth_failed"
    assert ha_sync.classify_failure(ValueError("x")) == "ValueError"


def test_backoff_capped_during_restart_window_then_normal():
    b = ha_sync.BACKOFF_START_S
    seen = []
    for _ in range(6):
        b = ha_sync.next_backoff("ha_restarting", b, down_since=0.0, now=10.0)
        seen.append(b)
    assert max(seen) == 15.0
    # past the 5-minute window it doubles up to the normal 60 s
    assert ha_sync.next_backoff("ha_restarting", 30.0, 0.0, 301.0) == 60.0
    # other failures are never capped
    assert ha_sync.next_backoff("ha_unreachable", 30.0, 0.0, 10.0) == 60.0


def test_platform_restart_resets_backoff(monkeypatch):
    ha_sync._reset_backoff.clear()
    monkeypatch.setattr(addon_restart, "_send", lambda *a, **k: "sent")
    assert addon_restart.restart_platform(None) == "sent"  # type: ignore[arg-type]
    assert ha_sync._reset_backoff.is_set()
    ha_sync._reset_backoff.clear()
