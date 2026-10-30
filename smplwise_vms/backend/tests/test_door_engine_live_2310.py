"""DOORLIVE-2310 (release train 3, owner decisions 2026-10-30): the Direct door engines are wired into the regular release behind OFF switches.

Everything runs on fakes: a fake join, a scripted emergency engine, a fake program port. Nothing reaches WisKey, Home Assistant, a station or a door.
Pinned here: the shipped defaults (built in, every switch OFF), the install of the live emergency engine, `not_sent` without a selected connection, the hidden
LOCK, release always available, the startup reconcile, the link-lost alert, and the SR-1 surface of the two Direct adapters."""
from __future__ import annotations

import ast
import datetime as dt
from pathlib import Path
from typing import Any

import pytest
from fake_doorwin_adapters import ProductWorld, ScriptedEmergencyEngine

from smplwise.rbac import Principal
from smplwise.services import door_automation as da
from smplwise.services import door_emergency as de
from smplwise.services import door_engine_live as live
from smplwise.services import door_windows as dw
from smplwise.services import door_windows_engine as dwe
from smplwise.services import wiskey_program_direct as wpd

PACKAGE = Path(__file__).resolve().parents[1] / "smplwise"


# ---------------------------------------------------------------- fakes

class FakeSession:
    def __init__(self, connected: bool = True) -> None:
        self.connected = connected

    def transport_refusal(self, command: str | None = None) -> str | None:
        return None if self.connected else "wiskey_direct_not_connected"


class FakeInner:
    """Stands for DirectEmergencyEngine: records what the live engine hands over."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str, str, int]] = []

    def apply(self, kind, station_id, relay, request_id, reason):
        self.calls.append(("apply", kind, station_id, relay))
        return dwe.DoorOutcome("acknowledged", "acknowledged")

    def release(self, kind, station_id, relay, request_id):
        self.calls.append(("release", kind, station_id, relay))
        return dwe.DoorOutcome("acknowledged", "acknowledged")


class FakeJoin:
    def __init__(self, *, configured: bool = True, selected: bool = True, connected: bool = True) -> None:
        self._configured, self._selected = configured, selected
        self.session = FakeSession(connected)
        self.inner = FakeInner()
        self.selected_asked: list[str | None] = []

    def configured(self) -> bool:
        return self._configured

    def selected(self, command: str | None = None) -> bool:
        self.selected_asked.append(command)
        return self._selected

    def features_or_none(self) -> Any:
        return object() if self._selected else None

    def emergency_engine(self, connect) -> Any:
        return self.inner


class FakePort:
    """The program port: records every command sent."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, dict[str, Any]]] = []

    def call(self, command: str, parameters: dict[str, Any]) -> dict[str, Any]:
        self.sent.append((command, dict(parameters)))
        return {"programs": []}


@pytest.fixture()
def pw(settings, monkeypatch):
    w = ProductWorld(settings, monkeypatch, go_live=True)
    w.emergency_on()
    return w


# ---------------------------------------------------------------- shipped defaults: built in, every switch OFF

def test_the_release_builds_both_engines_in_and_every_switch_is_off_by_default(settings, monkeypatch):
    assert dwe.GO_LIVE_PERMITTED is True and dwe.PROGRAM_ENGINE_BUILT is True and dwe.EMERGENCY_ENGINE_BUILT is True
    assert dwe.program_ready() and dwe.emergency_ready()
    assert da.GO_LIVE_PERMITTED is True
    w = ProductWorld(settings, monkeypatch, go_live=True)  # no switch touched
    with w.db.connection(mode="read") as conn:
        assert dw.enabled(conn) is False
        assert de.enabled(conn) is False and de.setting(conn, de.OPEN_ENABLED) == "off" and de.setting(conn, de.AUTOMATIONS) == "off"
        assert da.feature_setting(conn) == "off" and da.enabled(conn) is False
        assert de.attested(conn) is False
    r = w.press("open")
    assert r.status_code == 409 and r.json()["code"] == "emergency_off"
    assert w.emergency.calls == []


def test_the_open_switch_cannot_be_turned_on_without_the_attestation_even_with_the_engines_built(pw):
    r = pw.put("/doors/emergency/settings", changes={"doors.emergency.open_enabled": "on"}, confirmed=True)
    assert r.status_code == 409 and r.json()["code"] == "attestation_required"


def test_the_build_flags_are_independent(monkeypatch):
    monkeypatch.setattr(dwe, "LIVE_ENGINE_BUILT", False)
    monkeypatch.setattr(dwe, "PROGRAM_ENGINE_BUILT", False)
    assert dwe.program_ready() is False and dwe.emergency_ready() is True
    assert isinstance(dwe.WINDOW_ENGINE_FACTORY(None), dwe.PreparedEngine)
    monkeypatch.setattr(dwe, "PROGRAM_ENGINE_BUILT", True)
    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_BUILT", False)
    assert dwe.program_ready() is True and dwe.emergency_ready() is False
    assert dwe.WINDOW_ENGINE_FACTORY(None).tier == "program"


# ---------------------------------------------------------------- the install

def test_install_makes_the_live_engine_the_process_engine_and_uninstall_restores(settings, monkeypatch):
    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_FACTORY", dwe._emergency_engine)
    monkeypatch.setattr(live, "_INSTALLED", None)
    eng = live.install(object())
    try:
        assert isinstance(eng, live.LiveEmergencyEngine) and dwe.emergency_engine(None) is eng
        assert live.install(object()) is eng, "installing twice keeps the one engine"
    finally:
        live.uninstall()
    assert isinstance(dwe.emergency_engine(None), dwe.WiskeyEmergencyEngine)


def test_nothing_is_installed_when_the_emergency_flag_is_off_or_the_permit_is_missing(monkeypatch):
    monkeypatch.setattr(live, "_INSTALLED", None)
    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_FACTORY", dwe._emergency_engine)
    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_BUILT", False)
    monkeypatch.setattr(dwe, "LIVE_ENGINE_BUILT", False)
    assert live.install(object()) is None
    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_BUILT", True)
    monkeypatch.setattr(dwe, "GO_LIVE_PERMITTED", False)
    assert live.install(object()) is None
    assert isinstance(dwe.emergency_engine(None), dwe.WiskeyEmergencyEngine)


# ---------------------------------------------------------------- the live engine over a join

def test_without_a_selected_connection_nothing_is_sent_and_nothing_is_queued():
    for join in (None, FakeJoin(selected=False, connected=False)):
        eng = live.LiveEmergencyEngine(object(), join=lambda j=join: j)
        for call in (lambda: eng.apply("open", "st", 1, "r:st:1", ""), lambda: eng.release("open", "st", 1, "r:r:st:1")):
            with pytest.raises(dwe.EngineError) as e:
                call()
            assert (e.value.kind, e.value.code) == ("not_sent", "transport_not_selected")
        if join is not None:
            assert join.inner.calls == []


def test_a_selected_connection_hands_open_and_release_to_the_v2_engine():
    join = FakeJoin()
    eng = live.LiveEmergencyEngine(object(), join=lambda: join)
    assert eng.apply("open", "st", 1, "r:st:1", "x") == dwe.DoorOutcome("acknowledged", "acknowledged")
    assert eng.release("open", "st", 1, "r:r:st:1").state == "acknowledged"
    assert join.inner.calls == [("apply", "open", "st", 1), ("release", "open", "st", 1)]
    assert join.selected_asked and set(join.selected_asked) == {"features/start"}
    assert eng.simulated is False and eng.new_request_per_attempt is True and eng.transport_timeout_s < de.ENGINE_DEADLINE_S
    assert de.v2_new_attempts(eng) is True


def test_lock_is_not_implemented_never_mapped_and_never_sent():
    join = FakeJoin()
    eng = live.LiveEmergencyEngine(object(), join=lambda: join)
    assert eng.lock_supported is False
    for call in (lambda: eng.apply("lock_secure", "st", 1, "r", ""), lambda: eng.release("lock_secure", "st", 1, "r")):
        with pytest.raises(dwe.EngineError) as e:
            call()
        assert e.value.kind == "not_implemented"
    assert join.inner.calls == [] and join.selected_asked == []


def test_open_is_offered_when_configured_even_if_the_socket_dropped():
    assert live.LiveEmergencyEngine(object(), join=lambda: FakeJoin(connected=False, selected=False)).open_supported is True
    assert live.LiveEmergencyEngine(object(), join=lambda: FakeJoin(configured=False)).open_supported is False
    assert live.LiveEmergencyEngine(object(), join=lambda: None).open_supported is False


# ---------------------------------------------------------------- the LOCK control is hidden / refused (owner decision 4)

def test_lock_is_hidden_and_refused_when_the_engine_has_no_lock_command(settings, monkeypatch):
    w = ProductWorld(settings, monkeypatch, go_live=True)
    w.emergency = ScriptedEmergencyEngine(now=w.now, lock_supported=False)
    monkeypatch.setattr(dwe, "EMERGENCY_ENGINE_FACTORY", lambda s: w.emergency)
    w.emergency_on()
    st = w.get("/doors/emergency/state").json()
    assert st["can"]["lock"] is False and st["scopes"]["lock_secure"] == [] and st["scopes"]["open"], "OPEN stays, LOCK is gone"
    assert w.get("/doors/emergency/settings").json()["settings"]["lock_available"] is False
    r = w.press("lock_secure")
    assert r.status_code == 409 and r.json()["code"] == "lock_unavailable"
    assert w.emergency.calls == [] and not w.rows("SELECT id FROM door_emergency_incidents")
    # a drill rehearses against the simulation and is not blocked
    assert w.press("lock_secure", drill=True).status_code == 201


def test_lock_is_offered_when_an_engine_supports_it(pw):
    st = pw.get("/doors/emergency/state").json()
    assert st["can"]["lock"] is True and st["scopes"]["lock_secure"]
    assert pw.press("lock_secure").status_code == 201


def test_a_lock_incident_that_exists_can_still_be_released_when_lock_is_unavailable(settings, monkeypatch):
    w = ProductWorld(settings, monkeypatch, go_live=True)
    w.emergency_on()
    inc = w.press("lock_secure").json()["incident"]
    w.emergency.lock_supported = False
    rel = w.release(inc["id"], "lock_secure")
    assert rel.status_code == 200, rel.text


# ---------------------------------------------------------------- release is always available

def test_release_works_with_the_buttons_switched_off_and_the_engine_switch_off(pw):
    inc = pw.press("lock_secure").json()["incident"]
    with pw.db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES ('doors.emergency.enabled', 'off')")
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES ('doors.emergency.engine_switch', 'off')")
    rel = pw.release(inc["id"], "lock_secure")
    assert rel.status_code == 200 and rel.json()["incident"]["state"] == "released"


def test_release_without_a_selected_connection_answers_clearly_and_does_not_wait():
    eng = live.LiveEmergencyEngine(object(), join=lambda: None)
    with pytest.raises(dwe.EngineError) as e:
        eng.release("open", "st", 1, "r:r:st:1")
    assert e.value.kind == "not_sent"


# ---------------------------------------------------------------- startup reconcile (G6)

def test_an_incident_active_at_start_is_flagged_audited_and_never_re_sent(pw, monkeypatch):
    monkeypatch.setattr(live, "VERIFY", set())
    inc = pw.press("lock_secure").json()["incident"]
    before = len(pw.emergency.calls)
    found = live.reconcile_active(pw.db)
    assert found == [inc["id"]] and live.verify_required(inc["id"])
    assert len(pw.emergency.calls) == before, "a restart never re-sends"
    assert "door.emergency.reconcile" in pw.audit_actions()
    assert pw.rows("SELECT id FROM notifications WHERE source = 'door.emergency.verify'")
    assert pw.get("/doors/emergency/state").json()["active"]["verify_required"] is True
    # released -> the next tick resolves the notice and drops the flag
    assert pw.release(inc["id"], "lock_secure").status_code == 200
    out = live.tick(pw.db)
    assert out["verify_resolved"] == [inc["id"]] and not live.verify_required(inc["id"])


def test_a_drill_active_at_start_is_not_flagged(pw, monkeypatch):
    monkeypatch.setattr(live, "VERIFY", set())
    assert pw.press("lock_secure", drill=True).status_code == 201
    assert live.reconcile_active(pw.db) == []


# ---------------------------------------------------------------- link lost during an incident (G10)

def test_link_lost_during_an_incident_raises_one_notice_and_resolves_when_back(pw, monkeypatch):
    join = FakeJoin(selected=False, connected=False)
    eng = live.LiveEmergencyEngine(pw.db, join=lambda: join)
    monkeypatch.setattr(live, "_INSTALLED", eng)
    monkeypatch.setattr(live, "LINK_ALERTED", set())
    assert live.tick(pw.db)["link_lost"] == [], "no incident, no alert"
    inc = pw.press("lock_secure").json()["incident"]
    assert live.tick(pw.db)["link_lost"] == [inc["id"]]
    assert live.tick(pw.db)["link_lost"] == [], "once per incident"
    assert len(pw.rows("SELECT id FROM notifications WHERE source = 'door.emergency.link_lost'")) == 1
    join._selected, join.session.connected = True, True
    assert live.tick(pw.db)["link_back"] == [inc["id"]]
    assert pw.release(inc["id"], "lock_secure").status_code == 200
    live.tick(pw.db)
    assert not live.LINK_ALERTED


def test_the_link_check_never_sends_a_door_command(pw, monkeypatch):
    join = FakeJoin(selected=True)
    monkeypatch.setattr(live, "_INSTALLED", live.LiveEmergencyEngine(pw.db, join=lambda: join))
    pw.press("lock_secure")
    live.tick(pw.db)
    assert join.inner.calls == []


# ---------------------------------------------------------------- the program engine and SR-1

def test_the_program_engine_sends_only_list_save_and_pause_and_only_over_the_port():
    port = FakePort()
    eng = wpd.DirectProgramEngine(port)
    eng.read("st", 1)
    for call in (lambda: eng.save("st", 1, 0, {"schedule": {"name": "Arx x"}}, True), lambda: eng.pause("st", 1, 1)):
        with pytest.raises(dwe.EngineError):
            call()  # the fake answers no program -> program_missing_after_write: still sent exactly one command
    assert [c for c, _ in port.sent] == [wpd.LIST, wpd.SAVE, wpd.ACTION]
    assert port.sent[2][1]["action"] == "pause", "the only action Arx ever sends is pause (the close direction)"
    assert {n for n in dir(wpd.DirectProgramEngine) if not n.startswith("_")} == {"tier", "read", "save", "pause"}


def test_program_without_a_selected_connection_is_not_sent():
    class NoJoin:
        pass

    port = wpd.DirectProgramPort(join=lambda: None)
    with pytest.raises(dwe.EngineError) as e:
        wpd.DirectProgramEngine(port).read("st", 1)
    assert (e.value.kind, e.value.code) == ("not_sent", "transport_not_selected")


def _string_constants(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    return {n.value for n in ast.walk(tree) if isinstance(n, ast.Constant) and isinstance(n.value, str)}


def test_no_timer_module_of_the_wiring_holds_an_open_primitive():
    open_primitives = {"alwaysOpen", "stations/test_unlock", "door_open", "doors/hold_until", "doors/emergency_open"}
    for rel in ("services/door_engine_live.py", "services/wiskey_program_direct.py", "services/door_windows_watch.py"):
        assert not (_string_constants(PACKAGE / rel) & open_primitives), rel
    calls = {n.func.attr if isinstance(n.func, ast.Attribute) else getattr(n.func, "id", "")
             for n in ast.walk(ast.parse((PACKAGE / "services/door_engine_live.py").read_text(encoding="utf-8"))) if isinstance(n, ast.Call)}
    assert not (calls & {"release_door", "hold_command", "open_door", "test_unlock"}), "the wiring module never calls an opening function"


def test_the_worker_tick_only_reads_and_notifies():
    src = (PACKAGE / "services/door_engine_live.py").read_text(encoding="utf-8")
    tick_src = src[src.index("def tick("):src.index("def startup(")]
    assert ".apply(" not in tick_src and ".release(" not in tick_src and ".open(" not in tick_src


# ---------------------------------------------------------------- door_automation (owner decision 6)

def test_door_automation_is_in_the_release_behind_its_own_switch_and_sends_nothing_without_a_connection(settings, monkeypatch):
    w = ProductWorld(settings, monkeypatch, go_live=True)
    with w.db.connection(mode="read") as conn:
        assert da.go_live_permitted() is True and da.enabled(conn) is False
    sender = da.LiveSender(w.db)
    operator = da.operator_of("blk-1", "Block")
    out = sender.open(operator=operator, station_id="st-a", relay=1, request_id="req-1:blk-1:st-a:1",
                      not_after=dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=30))
    assert out[0] == "not_sent", out
    assert isinstance(operator, Principal)
