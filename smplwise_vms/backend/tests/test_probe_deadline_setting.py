"""SMALL3-295: the connection probe's wall-clock deadline is a setting (default 30 s, range 1-120 s) and still fails closed."""
from __future__ import annotations

import pytest

from smplwise.services import connection_probe as cp


def test_default_is_thirty_seconds(monkeypatch):
    monkeypatch.delenv("SW_PROBE_DEADLINE_S", raising=False)
    assert cp.probe_deadline_s() == 30.0
    assert cp.DEADLINE_DEFAULT_S == 30.0


@pytest.mark.parametrize("raw,expected", [("45", 45.0), (" 7.5 ", 7.5), ("120", 120.0), ("1", 1.0),
                                          ("500", 120.0), ("0", 1.0), ("-3", 1.0),
                                          ("abc", 30.0), ("", 30.0), ("nan", 30.0), ("inf", 30.0)])
def test_setting_is_clamped_to_the_range(monkeypatch, raw, expected):
    monkeypatch.setenv("SW_PROBE_DEADLINE_S", raw)
    assert cp.probe_deadline_s() == expected


def test_timeout_still_fails_closed(monkeypatch):
    # a budget that is already spent: the whole test answers `timeout`, never ok
    monkeypatch.setattr(cp, "DEADLINE_S", 0.0)
    monkeypatch.setattr(cp, "connect_target", lambda host, settings: None)
    out = cp.check_and_probe("nvr.invalid", None, lambda t: None)
    assert out["ok"] is False and out["code"] == "timeout"
