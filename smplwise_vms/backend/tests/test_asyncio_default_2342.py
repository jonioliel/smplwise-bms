"""ASYNCIO-DEFAULT-2342 (owner 02.11, round 13, answer 5A; docs/changes/ASYNCIO-DEFAULT-2342.md): the server runs on the standard asyncio
event loop and the h11 HTTP parser by default; uvloop + httptools are an opt-in ("שרת: רכיב תקשורת מהיר", the `server.fast_network`
setting, or SW_FAST_NETWORK), read at start-up. The crash guard's safe mode forces asyncio + h11 over the opt-in and still records crashes."""
from __future__ import annotations

import logging
import signal
from types import SimpleNamespace

import pytest

from smplwise import __main__ as entry
from smplwise import crashguard as cg
from smplwise.__main__ import describe_impl, fast_network_wanted, server_impl

YES = lambda _m: True  # noqa: E731 - uvloop and httptools installed (the add-on image)
NO = lambda _m: False  # noqa: E731 - not installed (Windows has no uvloop)
SEGV = -int(getattr(signal, "SIGSEGV", 11))


def test_default_is_asyncio_and_h11_even_when_the_native_modules_are_installed():
    assert server_impl({}, installed=YES) == ("asyncio", "h11")
    assert server_impl({}, fast=False, installed=YES) == ("asyncio", "h11")
    assert fast_network_wanted({}, None) == (False, "default")


def test_fast_network_opt_in_picks_uvloop_and_httptools_when_installed():
    assert server_impl({}, fast=True, installed=YES) == ("uvloop", "httptools")
    # a module that is not installed falls back on its own half (Windows: no uvloop, httptools present)
    assert server_impl({}, fast=True, installed=lambda m: m == "httptools") == ("asyncio", "httptools")
    assert server_impl({}, fast=True, installed=NO) == ("asyncio", "h11")


@pytest.mark.parametrize(("env", "stored", "want"), [
    ({}, "true", (True, "setting")),
    ({}, "false", (False, "setting")),
    ({}, "garbage", (False, "default")),
    ({"SW_FAST_NETWORK": "1"}, "false", (True, "env")),
    ({"SW_FAST_NETWORK": "on"}, None, (True, "env")),
    ({"SW_FAST_NETWORK": "0"}, "true", (False, "env")),
    ({"SW_FAST_NETWORK": "off"}, "true", (False, "env")),
    ({"SW_FAST_NETWORK": "maybe"}, "true", (True, "setting")),  # an unreadable env value does not hide the setting
])
def test_the_environment_wins_over_the_setting(env, stored, want):
    assert fast_network_wanted(env, stored) == want


def test_safe_mode_forces_asyncio_and_h11_over_an_opt_in_and_an_explicit_override():
    safe = cg.child_env({"PATH": "x", "SW_FAST_NETWORK": "1"}, True)
    fast, _src = fast_network_wanted(safe, "true")
    assert fast is True, "the opt-in is still read in safe mode ..."
    assert server_impl(safe, fast=fast, installed=YES) == ("asyncio", "h11"), "... but safe mode wins"
    assert server_impl({"SW_SAFE_MODE": "1", "SW_UVICORN_LOOP": "uvloop", "SW_UVICORN_HTTP": "httptools"}, fast=True, installed=YES) == ("asyncio", "h11")


def test_an_explicit_valid_override_is_used_as_given_and_an_invalid_one_ignored():
    assert server_impl({"SW_UVICORN_LOOP": "uvloop", "SW_UVICORN_HTTP": "httptools"}, installed=YES) == ("uvloop", "httptools")
    assert server_impl({"SW_UVICORN_LOOP": "auto"}, installed=YES) == ("auto", "h11")
    assert server_impl({"SW_UVICORN_LOOP": "bogus", "SW_UVICORN_HTTP": "nope"}, fast=True, installed=YES) == ("uvloop", "httptools")


def test_the_start_up_line_names_the_loop_the_parser_and_why():
    assert describe_impl("asyncio", "h11", False, "default", False) == "server: event loop asyncio, HTTP parser h11 - standard (fast network component off, default)"
    assert describe_impl("uvloop", "httptools", True, "setting", False) == "server: event loop uvloop, HTTP parser httptools - fast network component on (setting)"
    assert "safe mode" in describe_impl("asyncio", "h11", True, "env", True) and "overrides the fast-network opt-in" in describe_impl("asyncio", "h11", True, "env", True)
    assert "overrides" not in describe_impl("asyncio", "h11", False, "default", True)


def test_supervisor_still_records_crashes_and_enters_safe_mode_with_the_opt_in(tmp_path):
    """The crash guard does not know the setting (it imports no application code); with SW_FAST_NETWORK=1 the first runs pick uvloop +
    httptools, two SIGSEGV are recorded and restarted, and the third run (safe mode) is asyncio + h11."""
    envs: list[dict[str, str]] = []
    codes = [SEGV, SEGV, 0]
    t = [1_800_000_000.0]

    class Child:
        def __init__(self, code):
            self.code = code

        def wait(self):
            return self.code

        def poll(self):
            return self.code

        def send_signal(self, _s):
            pass

    def spawn(env):
        envs.append(env)
        t[0] += 5
        return Child(codes.pop(0))

    def clock():
        return t[0]

    def sleep(s, _ev):
        t[0] += s

    sup = cg.Supervisor(tmp_path, ["python", "-m", "smplwise"], spawn=spawn, sleep=sleep, clock=clock, log=lambda _m: None,
                        base_env={"PATH": "x", "SW_FAST_NETWORK": "1"})
    assert sup.run() == 0
    picked = [server_impl(e, fast=fast_network_wanted(e, None)[0], installed=YES) for e in envs]
    assert picked == [("uvloop", "httptools"), ("uvloop", "httptools"), ("asyncio", "h11")]
    st = cg.read_state(tmp_path)
    assert st["count_total"] == 2 and st["safe_mode"] is True and [r["safe_mode"] for r in st["recent"]] == [False, False]


def test_crashes_are_recorded_on_the_default_loop_too(tmp_path):
    """Default (no opt-in): every run is asyncio + h11; a crash is still recorded and still counts towards safe mode."""
    cg.record_crash(tmp_path, 11, 30.0, False, now_ts=1_800_000_000.0)
    cg.record_crash(tmp_path, 11, 30.0, False, now_ts=1_800_000_010.0)
    assert cg.safe_mode_due(cg.read_state(tmp_path), 1_800_000_020.0)
    assert server_impl(cg.child_env({"PATH": "x"}, False), installed=YES) == ("asyncio", "h11")


def test_setting_default_and_patch_validation(client):
    from smplwise.routers.settings import DEFAULTS, SettingsPatch

    assert DEFAULTS["server.fast_network"] == "false"
    assert client.get("/api/v1/settings").json()["settings"]["server.fast_network"] == "false"
    r = client.patch("/api/v1/settings", json={"server.fast_network": "true"})
    assert r.status_code == 200, r.text
    assert client.get("/api/v1/settings").json()["settings"]["server.fast_network"] == "true"
    assert client.patch("/api/v1/settings", json={"server.fast_network": "yes"}).status_code == 422
    with pytest.raises(Exception):
        SettingsPatch.model_validate({"server.fast_network": "1"})


def test_main_reads_the_stored_setting_at_start_up_and_logs_the_choice(client, monkeypatch, caplog):
    """main(): the stored setting decides when no env is set; uvicorn.run receives the chosen loop / parser; one log line says which."""
    assert client.patch("/api/v1/settings", json={"server.fast_network": "true"}).status_code == 200
    app = client.app
    calls: dict[str, object] = {}
    monkeypatch.setattr(entry, "_enable_faulthandler", lambda: None)
    monkeypatch.setattr(entry, "create_app", lambda: app)
    monkeypatch.setattr(entry, "_log_native", lambda _w: None)
    monkeypatch.setattr(entry, "warm_route_tables", lambda _a: None)
    monkeypatch.setattr(entry, "_installed", YES)
    monkeypatch.setattr(entry.uvicorn, "run", lambda _app, **kw: calls.update(kw))
    for k in ("SW_FAST_NETWORK", "SW_SAFE_MODE", "SW_UVICORN_LOOP", "SW_UVICORN_HTTP"):
        monkeypatch.delenv(k, raising=False)
    # server_impl's default `installed` was bound at definition time: route it through the patched one
    monkeypatch.setattr(entry, "server_impl", lambda env, fast=False: server_impl(env, fast=fast, installed=YES))
    with caplog.at_level(logging.INFO, logger="smplwise.crashguard"):
        entry.main()
    assert (calls["loop"], calls["http"]) == ("uvloop", "httptools")
    assert any("event loop uvloop, HTTP parser httptools - fast network component on (setting)" in r.getMessage() for r in caplog.records)

    calls.clear()
    caplog.clear()
    monkeypatch.setenv("SW_FAST_NETWORK", "0")
    with caplog.at_level(logging.INFO, logger="smplwise.crashguard"):
        entry.main()
    assert (calls["loop"], calls["http"]) == ("asyncio", "h11")
    assert any("standard (fast network component off, env)" in r.getMessage() for r in caplog.records)

    calls.clear()
    caplog.clear()
    monkeypatch.setenv("SW_FAST_NETWORK", "1")
    monkeypatch.setenv("SW_SAFE_MODE", "1")
    with caplog.at_level(logging.INFO, logger="smplwise.crashguard"):
        entry.main()
    assert (calls["loop"], calls["http"]) == ("asyncio", "h11")
    assert any(r.levelno == logging.WARNING and "safe mode" in r.getMessage() for r in caplog.records)


def test_an_unreadable_database_means_the_default():
    class Broken:
        def connection(self, *_a, **_k):
            raise RuntimeError("no db")

    assert entry._stored_fast_setting(SimpleNamespace(state=SimpleNamespace(db=Broken()))) is None
