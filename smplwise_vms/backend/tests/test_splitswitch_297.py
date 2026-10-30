"""SPLITSWITCH-297 (owner decision 2026-10-27): door-window programs and emergency buttons are two independent build flags.

Before the split, `door_windows_engine.LIVE_ENGINE_BUILT` turned on BOTH the program engine (time windows written to WisKey) and the
emergency engine. Now `PROGRAM_ENGINE_BUILT` and `EMERGENCY_ENGINE_BUILT` are separate and both ship OFF; `LIVE_ENGINE_BUILT` stays as the
legacy combined flag, so a build that sets it keeps today's behaviour (both on). No setting, no migration: the flags are build constants.
FAKES ONLY: the window engine factory is checked by type, the emergency engine is the scripted fake; nothing contacts WisKey or a door."""
from __future__ import annotations

from pathlib import Path

import pytest
from fake_doorwin_adapters import ProductWorld

from smplwise.services import door_emergency as de
from smplwise.services import door_windows_engine as dwe

SRC = Path(dwe.__file__).read_text(encoding="utf-8")


def _flags(monkeypatch, *, legacy: bool = False, program: bool = False, emergency: bool = False) -> None:
    monkeypatch.setattr(dwe, "GO_LIVE_PERMITTED", True)
    monkeypatch.setattr(dwe, "LIVE_ENGINE_BUILT", legacy)
    monkeypatch.setattr(dwe, "PROGRAM_ENGINE_BUILT", program)
    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_BUILT", emergency)


# ---------------------------------------------------------------- shipped: both off, legacy off

def test_both_flags_ship_built_in_and_the_legacy_flag_is_unchanged():
    """DOORLIVE-2310: both per-feature flags are True in the release (activation = the OFF-by-default switches); the legacy combined flag stays False."""
    assert "\nPROGRAM_ENGINE_BUILT = True" in SRC and "\nEMERGENCY_ENGINE_BUILT = True" in SRC and "\nLIVE_ENGINE_BUILT = False" in SRC
    assert dwe.PROGRAM_ENGINE_BUILT is True and dwe.EMERGENCY_ENGINE_BUILT is True and dwe.LIVE_ENGINE_BUILT is False
    assert dwe.program_ready() is True and dwe.emergency_ready() is True and dwe.live_ready() is True
    assert de.live_ok() is True
    assert dwe._window_engine(None).tier == "program"


def test_no_reader_uses_the_legacy_combined_flag_directly():
    """Every reader goes through program_ready / emergency_ready (the legacy helpers are kept for compatibility only)."""
    root = Path(dwe.__file__).resolve().parents[1]
    for path in root.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        if path.name == "door_windows_engine.py":
            continue
        for legacy in ("dwe.live_ready(", "dwe.live_engine_built(", "dwe.LIVE_ENGINE_BUILT", "door_windows_engine.live_ready("):
            assert legacy not in text, f"{path.name}: {legacy}"


# ---------------------------------------------------------------- upgrade: the legacy flag keeps today's behaviour

def test_the_legacy_flag_on_still_turns_both_on(monkeypatch):
    _flags(monkeypatch, legacy=True)
    assert dwe.program_ready() and dwe.emergency_ready() and dwe.live_ready() and dwe.live_engine_built()
    assert isinstance(dwe._window_engine(None), dwe.WiskeyProgramEngine)
    assert de.live_ok() is True


@pytest.mark.parametrize("program, emergency", [(True, False), (False, True)])
def test_each_flag_turns_on_only_its_own_engine(monkeypatch, program, emergency):
    _flags(monkeypatch, program=program, emergency=emergency)
    assert dwe.program_ready() is program and dwe.emergency_ready() is emergency
    assert dwe.live_engine_built() is False, "the legacy view means both"
    engine = dwe._window_engine(None)
    assert isinstance(engine, dwe.WiskeyProgramEngine if program else dwe.PreparedEngine)
    assert de.live_ok() is emergency


def test_the_permit_still_gates_both(monkeypatch):
    _flags(monkeypatch, program=True, emergency=True)
    monkeypatch.setattr(dwe, "GO_LIVE_PERMITTED", False)
    assert dwe.program_ready() is False and dwe.emergency_ready() is False
    assert isinstance(dwe._window_engine(None), dwe.PreparedEngine)


# ---------------------------------------------------------------- the HTTP surface (backward compatible keys + the new ones)

def test_api_programs_on_emergency_off(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=False)
    _flags(monkeypatch, program=True)
    w = pw.get("/doors/windows/settings").json()
    assert w["go_live_permitted"] is True and w["program_engine_built"] is True
    e = pw.get("/doors/emergency/settings").json()["settings"]
    assert e["go_live_permitted"] is False and e["live_engine_built"] is False and e["emergency_engine_built"] is False
    r = pw.put("/doors/emergency/settings", changes={"doors.emergency.enabled": "on"}, confirmed=True)
    assert r.status_code == 409 and r.json()["code"] == "engine_not_implemented", r.text
    assert pw.put("/doors/windows/settings", changes={"doors.windows.enabled": "on"}, confirmed=True).status_code == 200
    assert pw.get("/doors/windows/state").json()["go_live_permitted"] is True


def test_api_emergency_on_programs_off(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=False)
    _flags(monkeypatch, emergency=True)
    w = pw.get("/doors/windows/settings").json()
    assert w["go_live_permitted"] is False and w["program_engine_built"] is False
    e = pw.get("/doors/emergency/settings").json()["settings"]
    assert e["go_live_permitted"] is True and e["live_engine_built"] is True and e["emergency_engine_built"] is True
    r = pw.put("/doors/emergency/settings", changes={"doors.emergency.enabled": "on"}, confirmed=True)
    assert r.status_code == 200, r.text
    assert pw.get("/doors/emergency/settings").json()["settings"]["doors.emergency.enabled"] == "on"
    assert pw.get("/doors/windows/state").json()["go_live_permitted"] is False


def test_api_shipped_both_off(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=False)
    w = pw.get("/doors/windows/settings").json()
    assert w["go_live_permitted"] is False and w["program_engine_built"] is False
    e = pw.get("/doors/emergency/settings").json()["settings"]
    assert e["go_live_permitted"] is False and e["emergency_engine_built"] is False
