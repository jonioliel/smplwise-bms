"""FRIGATE2-295: the code-side open items of the live Frigate validation (docs/changes/CR-FRIGATE-LIVE-0180-REPORT.md, items 4, 7 and 8).

(a) item 4: `put_settings` with `null` (back to the default) of a key the YAML file does not hold must not become a `config/set` "" (a 500
    on the live 0.18.0): the comparison target of a reset is what the key INHERITS (a global override), not Arx's documented default.
(b) item 7: the connection test of a slow Frigate: a longer budget and step timeout than normal use, and a distinct `timeout` outcome
    (instead of `source_unavailable`, which hid the cause). Still fail-closed: nothing is saved untested without the typed word.
(c) item 8: a Frigate recorder stored after the start answers `/frigate/{id}/...` with 409 `recorder_pending_restart`, not a generic 503.
Fake Frigate only; nothing here talks to a real server.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from smplwise.errors import ApiError
from smplwise.services import connection_probe
from smplwise.services.recorders import frigate as fr
from smplwise.services.recorders import frigate_http as fh
from smplwise.services.recorders import frigate_io

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_frigate import HOST, PASSWORD, USER, FakeFrigate  # noqa: E402
from test_frigate_api import _probe_env  # noqa: E402
from test_frigate_config import _config_writes, _settings  # noqa: E402
from test_frigate_control import BASE, World, _clean, world  # noqa: E402,F401  (fixtures)

FIELD = "motion.threshold"


def _reset(w: World):
    return _settings(w, "motion", {FIELD: None})


# ---------------------------------------------------------------------------------------------- (a) reset of a key the file does not hold

def test_reset_of_an_unset_key_under_a_global_override_writes_nothing_and_is_no_500(world):
    """The camera inherits a global threshold of 40 (not Arx's documented 30) and the file holds no `threshold`: nothing to remove."""
    world.fake.strict_delete = True
    world.fake.effective_defaults = True
    world.fake.global_motion_threshold = 40
    world.policy(config=True)
    assert "threshold" not in world.fake.cameras["cam_front"]["motion"]
    r = _reset(world)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["changed"] is False and body["verified"] is True and body["change_id"] is None
    assert body["settings"] == {FIELD: 40}, "the effective (inherited) value is reported"
    assert _config_writes(world) == [], "no \"\" is sent for a key the file does not hold"
    assert world.changes() == []


def test_reset_of_a_key_the_file_holds_removes_it_and_the_undo_puts_it_back(world):
    world.fake.strict_delete = True
    world.fake.effective_defaults = True
    world.fake.global_motion_threshold = 40
    world.policy(config=True)
    world.fake.cameras["cam_front"]["motion"]["threshold"] = 55
    r = _reset(world)
    assert r.status_code == 200, r.text
    assert r.json()["changed"] is True and r.json()["verified"] is True and r.json()["settings"] == {FIELD: 40}
    assert _config_writes(world)[-1][2]["config_data"]["cameras"]["cam_front"] == {"motion": {"threshold": ""}}
    assert "threshold" not in world.fake.cameras["cam_front"]["motion"]
    log = world.changes()[0]
    assert log["before"] == {FIELD: 55} and log["after"] == {FIELD: 40}, "the log holds effective values, so the undo can compare them"
    undo = world.call("POST", f"{BASE}/changes/{log['id']}/revert", json={"confirm": True})
    assert undo.status_code == 200 and undo.json()["verified"] is True, undo.text
    assert world.fake.cameras["cam_front"]["motion"]["threshold"] == 55


def test_reset_without_a_global_override_still_uses_the_documented_default(world):
    world.fake.strict_delete = True
    world.fake.effective_defaults = True
    world.policy(config=True)
    world.fake.cameras["cam_front"]["motion"]["threshold"] = 45
    r = _reset(world)
    assert r.status_code == 200 and r.json()["changed"] is True and r.json()["verified"] is True and r.json()["settings"] == {FIELD: 30}
    again = _reset(world)
    assert again.status_code == 200 and again.json()["changed"] is False, "a second reset is a no-op, not a failed delete"


# ---------------------------------------------------------------------------------------------- (b) the connection test of a slow instance

BODY = {"vendor": "frigate", "host": HOST, "http_port": 8971, "rtsp_port": 554, "username": USER, "password": PASSWORD, "extra": {"scheme": "http"}}


@pytest.fixture()
def probe_app(settings, monkeypatch):
    from smplwise.main import create_app

    fake = FakeFrigate()
    _probe_env(monkeypatch, fake)
    undo = fr.register(selectable=True)
    fh.clear_cache()
    with TestClient(create_app(settings)) as c:
        yield c, fake
    undo()


def _result(r):
    j = r.json()
    return j.get("result", j)


def test_a_login_that_times_out_is_a_timeout_not_source_unavailable(probe_app):
    c, fake = probe_app
    fake.timeout_paths = {"/api/login"}
    res = _result(c.post("/api/v1/nvr/connection/test", json=BODY))
    assert res["ok"] is False and res["code"] == "timeout"


def test_a_refused_connection_stays_source_unavailable(probe_app):
    c, fake = probe_app
    fake.down = True
    res = _result(c.post("/api/v1/nvr/connection/test", json=BODY))
    assert res["ok"] is False and res["code"] == "source_unavailable"


def test_a_slow_version_read_is_a_timeout(probe_app):
    c, fake = probe_app
    fake.timeout_paths = {"/api/version"}
    assert _result(c.post("/api/v1/nvr/connection/test", json=BODY))["code"] == "timeout"


def test_the_probe_gives_every_step_a_longer_timeout_than_normal_use(probe_app, settings):
    c, fake = probe_app
    res = _result(c.post("/api/v1/nvr/connection/test", json=BODY))
    assert res["ok"] is True
    probe_reads = [t for t in fake.timeouts_seen if t is not None]
    assert probe_reads and min(probe_reads) >= connection_probe.FRIGATE_STEP_TIMEOUT_S - 1, probe_reads
    # normal use is unchanged: the same adapter outside a test keeps the 8 s read / login timeouts
    fake.timeouts_seen.clear()
    fh.clear_cache()
    fr.clear_cache()
    a = fr.FrigateAdapter("nvr-9", settings_for_fake(settings), transport=fake.transport())
    a.version()
    normal = [t for t in fake.timeouts_seen if t is not None]
    assert normal and max(normal) <= fh.READ_TIMEOUT_S + 0.01, normal


def settings_for_fake(settings):
    from fake_frigate import settings_for

    return settings_for(settings)


def test_a_frigate_test_gets_a_longer_budget_than_a_short_probe_deadline(probe_app, monkeypatch):
    """SW_PROBE_DEADLINE_S may be as low as 1-8 s on an installation; Frigate's own minimum still applies, other vendors keep the setting."""
    c, fake = probe_app
    seen: list[float] = []

    def fake_probe(cand, budget, backends):
        seen.append(budget)
        return {"ok": True, "code": "ok", "model": "Frigate", "firmware": "0.18.0", "channels": 3, "transport": {"scheme": "http", "insecure": True}, "warnings": []}

    monkeypatch.setattr(connection_probe, "DEADLINE_S", 8.0)
    monkeypatch.setattr(connection_probe, "_probe_frigate", fake_probe)
    assert _result(c.post("/api/v1/nvr/connection/test", json=BODY))["ok"] is True
    assert seen and seen[0] > 25.0, seen


def test_a_timed_out_test_is_not_saved_without_the_typed_word(probe_app):
    """Fail-closed: `timeout` may be saved untested (like source_unavailable), but only with save_untested AND the typed word."""
    c, fake = probe_app
    fake.timeout_paths = {"/api/login"}
    rev = c.get("/api/v1/nvr/connection").json().get("revision") or 0
    r = c.put("/api/v1/nvr/connection", json={**BODY, "if_revision": rev})
    assert r.status_code == 503 and r.json()["code"] == "timeout" and r.json()["details"]["can_save_untested"] is True
    r = c.put("/api/v1/nvr/connection", json={**BODY, "if_revision": rev, "save_untested": True})
    assert r.status_code == 422 and r.json()["code"] == "confirm_required"


def test_the_step_timeout_is_scoped_to_its_block():
    assert fh._STEP_TIMEOUT.get() is None
    with fh.step_timeout(20.0):
        assert fh._STEP_TIMEOUT.get() == 20.0
    assert fh._STEP_TIMEOUT.get() is None
    assert fh.is_timeout(fh.unavailable("login", __import__("httpx").ReadTimeout("x"))) is True
    assert fh.is_timeout(fh.unavailable("login", __import__("httpx").ConnectError("x"))) is False
    assert fh.is_timeout(ApiError(503, "source_forbidden", "x", details={"error": "ReadTimeout"})) is False


# ---------------------------------------------------------------------------------------------- (c) a recorder stored after the start

def test_a_frigate_recorder_added_after_the_start_answers_pending_restart(world):
    now = "2026-10-22T00:00:00Z"
    with world.app.state.db.connection() as conn:
        conn.execute("INSERT INTO recorders(id, name, created_at, vendor, enabled) VALUES ('nvr-2', 'Frigate 2', ?, 'frigate', 1)", (now,))
        conn.execute("INSERT INTO recorder_connections(recorder_id, vendor, host, http_port, username, password_enc, enabled, source, updated_at) "
                     "VALUES ('nvr-2', 'frigate', 'frigate-2.test', 8971, 'u', 'x', 1, 'ui', ?)", (now,))
    r = world.call("GET", "/api/v1/frigate/nvr-2/status")
    assert r.status_code == 409 and r.json()["code"] == "recorder_pending_restart", r.text
    assert r.json()["details"]["restart_required"] is True and r.json()["retryable"] is True
    with world.app.state.db.connection(mode="read") as conn, pytest.raises(ApiError) as ei:
        frigate_io.adapter_for(conn, world.s, "nvr-2")
    assert ei.value.code == "recorder_pending_restart"
    assert world.call("GET", f"{BASE}/status").status_code == 200, "the loaded recorder is unaffected"
