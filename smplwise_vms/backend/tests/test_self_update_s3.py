"""CR-021 slice S3: the in-app update (`apply`), the platform restart and the run state machine. A fake Supervisor
(frontend/tests/fixtures/update_fake_supervisor.py, a local HTTP server) stands in for the infrastructure; no real Home Assistant,
Supervisor or device is ever reached. Workers are captured (SPAWN) and run by the test; time is virtual (`_sleep` / `_clock` / `_now`)."""
from __future__ import annotations

import datetime as dt
import json
import re
import sqlite3
import sys
from pathlib import Path

import httpx
import pytest
from conftest import as_user
from test_self_update import NEWER, j, sup, world  # noqa: F401 - fixtures

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "frontend" / "tests" / "fixtures"))
from update_fake_supervisor import JOB_ID, TOKEN  # noqa: E402

from smplwise import __version__  # noqa: E402
from smplwise import remote_channel  # noqa: E402
from smplwise.db import set_setting  # noqa: E402
from smplwise.services import addon_restart, bridge_install, nvr_system, platform_restart, self_update, update_runs  # noqa: E402

SECRET_TEXT = ("secret detail", "Invalid config")
KEY = "k-0000000001"


class VClock:
    """Virtual time for the workers: `sleep` advances `clock`; `on_sleep` callbacks run after each sleep."""

    def __init__(self) -> None:
        self.t = 1000.0
        self.on_sleep: list = []

    def clock(self) -> float:
        return self.t

    def sleep(self, s: float) -> None:
        self.t += s
        for fn in list(self.on_sleep):
            fn(self)


@pytest.fixture()
def rig(monkeypatch, world):  # noqa: F811
    """`world` (admin joni + bound users) with captured workers and virtual time."""
    app, c = world
    pending: list = []
    vc = VClock()
    monkeypatch.setattr(update_runs, "SPAWN", lambda fn, name: pending.append(fn))
    monkeypatch.setattr(update_runs, "_sleep", vc.sleep)
    monkeypatch.setattr(update_runs, "_clock", vc.clock)
    monkeypatch.setattr(addon_restart, "BASE_URL", None)
    monkeypatch.setattr(addon_restart, "TOKEN", None)
    monkeypatch.setattr(addon_restart, "TRANSPORT", None)

    def drain() -> int:
        n = 0
        while pending:
            pending.pop(0)()
            n += 1
        return n

    return app, c, drain, vc, pending


def apply_body(target=NEWER, backup=True, key=KEY, **extra):
    return {"target_version": target, "backup": backup, "confirm": True, "idempotency_key": key, **extra}


def run_row(app, run_id):
    with app.state.db.connection(mode="read") as conn:
        return dict(update_runs.get_run(conn, run_id))


def audit_rows(app, like="system.update%"):
    with app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT action, decision, reason, details_json FROM audit_log WHERE action LIKE ? ORDER BY id", (like,)).fetchall()]


def no_secrets(app, sup):  # noqa: F811
    with app.state.db.connection(mode="read") as conn:
        blob = " ".join(str(tuple(r)) for r in conn.execute("SELECT * FROM audit_log WHERE action LIKE 'system.update%'").fetchall())
        blob += " ".join(str(tuple(r)) for r in conn.execute("SELECT * FROM update_runs").fetchall())
    for secret in (TOKEN, sup.url, "127.0.0.1", "supervisor", sup.slug, "Bearer", JOB_ID) + SECRET_TEXT:
        assert secret not in blob, secret


def updated_process(monkeypatch, app, settings, version):
    """The 'new container': this process now reports `version` and runs its start-up hook."""
    monkeypatch.setattr(update_runs, "__version__", version)
    return update_runs.on_startup(app.state.db, app.state.settings)


# ================================================================ unit: the single door

EXPECTED_ALLOWED = {("GET", "/addons/self/info"), ("POST", "/store/reload"), ("POST", "/store/addons/{slug}/update"), ("GET", "/jobs/info"),
                    ("GET", "/core/info"), ("POST", "/core/check"), ("POST", "/core/restart"), ("POST", "/addons/self/options"), ("POST", "/addons/self/restart")}


def test_the_allow_list_is_exact(settings, sup):  # noqa: F811
    assert self_update.ALLOWED == EXPECTED_ALLOWED
    assert self_update.BODY_KEYS == {("POST", "/store/addons/{slug}/update"): {"backup", "background"}, ("POST", "/core/restart"): set(),
                                     ("POST", "/addons/self/options"): {"options"}}
    refused = [
        ("POST", "/store/addons/{slug}/update", {"backup": True, "background": True}, "../x"),
        ("POST", "/store/addons/{slug}/update", {"backup": True, "background": True}, "a/b"),
        ("POST", "/store/addons/{slug}/update", {"backup": True, "background": True}, "UPPER"),
        ("POST", "/store/addons/{slug}/update", {"backup": True, "background": True}, ""),
        ("POST", "/store/addons/{slug}/update", {"backup": True, "background": True}, None),
        ("POST", "/store/addons/{slug}/update", {"backup": "yes", "background": True}, "a1_smplwise"),
        ("POST", "/store/addons/{slug}/update", {"backup": True, "background": True, "version": "9.9.9"}, "a1_smplwise"),
        ("POST", "/store/addons/{slug}/update", {"backup": True}, "a1_smplwise"),
        ("POST", "/store/addons/{slug}/update", None, "a1_smplwise"),
        ("POST", "/core/restart", {"safe_mode": True}, None),
        ("GET", "/core/info", {}, None),
        ("GET", "/addons/self/info", None, "x"),
        ("DELETE", "/core/info", None, None),
        ("POST", "/host/reboot", None, None),
        ("POST", "/backups/new/full", None, None),
        ("POST", "/store/repositories", None, None),
        ("GET", "/addons/other/info", None, None),
        ("POST", "/core/restart/", None, None),
    ]
    for method, path, body, slug in refused:
        with pytest.raises(self_update.ProbeRefused):
            self_update.call(settings, method, path, body=body, slug=slug)
    assert sup.log == [], "a refused call never reaches a socket"


def test_redirects_are_never_followed(settings, monkeypatch):
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.path)
        return httpx.Response(307, headers={"Location": "http://elsewhere.test/host/reboot"})

    monkeypatch.setattr(self_update, "BASE_URL", "http://fake-supervisor.test")
    monkeypatch.setattr(self_update, "TOKEN", "t")
    monkeypatch.setattr(self_update, "TRANSPORT", httpx.MockTransport(handler))
    assert self_update.call(settings, "POST", "/core/check").kind == "error"
    assert seen == ["/core/check"]


def test_nvr_system_supervisor_calls_go_through_the_allow_list(settings):
    for path in ("/addons/self/stdin", "/host/reboot", "/addons/self/uninstall", "/store/repositories"):
        with pytest.raises(self_update.ProbeRefused):
            nvr_system.supervisor_post(settings, path, {"x": 1})


def test_http_supervisor_appears_only_in_the_known_modules():
    root = Path(self_update.__file__).resolve().parents[1]
    allowed = {"config.py", "services/ha_client.py", "services/ha_user_auth.py", "services/self_update.py", "services/nvr_system.py"}
    write_paths = re.compile(r'["\'](/store/|/core/restart|/core/check|/jobs/info|/host/|/supervisor/|/os/update|/addons/[a-z_{]+/(update|uninstall|stdin))')
    hits, writes = set(), set()
    for f in root.rglob("*.py"):
        rel = f.relative_to(root).as_posix()
        text = f.read_text(encoding="utf-8")
        if "http://supervisor" in text:
            hits.add(rel)
        if write_paths.search(text) and rel != "services/self_update.py":
            writes.add(rel)
    assert hits <= allowed, hits - allowed
    assert writes == set(), "infrastructure write paths are spelled only in services/self_update.py"
    nvr_text = (root / "services/nvr_system.py").read_text(encoding="utf-8")
    assert "httpx.post(f\"http://supervisor" not in nvr_text and "httpx.get(\"http://supervisor" not in nvr_text, "nvr_system delegates its Supervisor calls"


def test_the_shared_restart_helper_keeps_the_cr022_contract(settings, sup, monkeypatch):  # noqa: F811
    monkeypatch.setattr(addon_restart, "BASE_URL", None)
    monkeypatch.setattr(addon_restart, "TOKEN", None)
    monkeypatch.setattr(self_update, "BASE_URL", None)
    monkeypatch.setattr(self_update, "TOKEN", None)
    monkeypatch.delenv("SUPERVISOR_TOKEN", raising=False)
    assert addon_restart.configured(settings) is False and addon_restart.restart(settings) == "unreachable"
    calls = []
    monkeypatch.setattr(addon_restart, "BASE_URL", "http://fake-supervisor.test")
    monkeypatch.setattr(addon_restart, "TOKEN", "fake-token")
    monkeypatch.setattr(addon_restart, "TRANSPORT", httpx.MockTransport(lambda req: calls.append((req.method, req.url.path, req.headers.get("authorization"))) or httpx.Response(200, json={"result": "ok"})))
    assert addon_restart.restart(settings) == "ok"
    assert calls == [("POST", "/addons/self/restart", "Bearer fake-token")]
    monkeypatch.setattr(addon_restart, "TRANSPORT", httpx.MockTransport(lambda req: httpx.Response(403)))
    assert addon_restart.restart(settings) == "forbidden"
    monkeypatch.setattr(addon_restart, "TRANSPORT", httpx.MockTransport(lambda req: httpx.Response(500)))
    assert addon_restart.restart(settings) == "error"


# ================================================================ unit: platform restart reasons

def test_platform_restart_reasons(world, monkeypatch):  # noqa: F811
    app, _ = world
    with app.state.db.connection() as conn:
        assert platform_restart.reasons(conn) == []
        monkeypatch.setattr(bridge_install, "status", lambda db=None, conn=None: {"state": "update_pending", "installed_version": "0.7.0"})
        assert platform_restart.reasons(conn) == [{"code": "bridge", "version": "0.7.0"}]
        monkeypatch.setattr(bridge_install, "status", lambda db=None, conn=None: {"state": "active", "installed_version": "0.7.0"})
        assert platform_restart.note_component_manifest(conn, "wiskey", {"version": "2.1.0", "requires_ha_restart": "true"}) is False, "only the JSON literal true"
        assert platform_restart.note_component_manifest(conn, "wiskey", {"version": "2.1.0"}) is False
        assert platform_restart.note_component_manifest(conn, "wiskey", {"version": "2.1.0", "requires_ha_restart": True}) is True
        platform_restart.add_reason(conn, "release", "0.1.160")
        assert platform_restart.reasons(conn) == [{"code": "wiskey", "version": "2.1.0"}, {"code": "release", "version": "0.1.160"}]
        for bad in (("bridge", "1.0"), ("other", "1.0"), ("release", "1.0; drop")):
            with pytest.raises(ValueError):
                platform_restart.add_reason(conn, *bad)
        assert platform_restart.clear_after_restart(conn, "2000-01-01T00:00:00Z") == [], "a restart that started before the reasons clears nothing"
        assert sorted(platform_restart.clear_after_restart(conn, "9999-01-01T00:00:00Z")) == ["release", "wiskey"]
        assert platform_restart.reasons(conn) == []


def test_state_carries_the_reasons_to_admins_only(rig, monkeypatch):
    app, c, *_ = rig
    with app.state.db.connection() as conn:
        platform_restart.add_reason(conn, "wiskey", "2.1.0")
    s = j(c, "get", "/state").json()
    assert s["requires_platform_restart"] is True and s["platform_restart_reasons"] == [{"code": "wiskey", "version": "2.1.0"}]
    for user in ("vera", "olga", "sam", "fia", "nobody"):
        assert j(c, "get", "/state", user).json() == {"update_available": False}, user


# ================================================================ RBAC ordering

ROUTES = [("post", "/apply"), ("post", "/restart-platform")]


def test_only_system_admins_and_403_comes_before_the_body(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    sup.latest = NEWER
    for user in ("vera", "olga", "sam", "fia", "nobody"):
        for method, path in ROUTES:
            for kw in ({"json": apply_body()}, {"content": b"not json at all", "headers": {**as_user(user), "Content-Type": "text/plain"}},
                       {"content": b"x" * 100_000, "headers": {**as_user(user), "Content-Type": "application/json"}}):
                r = getattr(c, method)(f"/api/v1/system/update{path}", **({"headers": as_user(user)} | kw))
                assert r.status_code == 403 and r.json()["code"] == "forbidden", (user, path, r.status_code)
        assert j(c, "get", "/runs/0123456789abcdef", user).status_code == 403
    assert sup.log == [], "a refused caller never makes the infrastructure do anything"
    assert drain() == 0
    denied = [r for r in audit_rows(app, "system.update") if r["decision"] == "denied"]
    assert len(denied) >= 5 * 7, "every refusal is audited"


def test_body_refusals_are_audited_and_send_nothing(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    sup.latest = NEWER
    cases = [
        ({"json": apply_body(confirm=False)}, 422, "confirm_required"),
        ({"json": {**apply_body(), "confirm": "true"}}, 422, "invalid_request"),
        ({"json": {**apply_body(), "confirm": 1}}, 422, "invalid_request"),
        ({"json": {**apply_body(), "backup": "yes"}}, 422, "invalid_request"),
        ({"json": {**apply_body(), "extra": 1}}, 422, "invalid_request"),
        ({"json": apply_body(target="1.0<script>")}, 422, "invalid_request"),
        ({"json": apply_body(key="short")}, 422, "invalid_request"),
        ({"content": json.dumps(apply_body()).encode(), "headers": {**as_user("joni"), "Content-Type": "text/plain"}}, 415, "unsupported_media_type"),
        ({"content": b"{bad", "headers": {**as_user("joni"), "Content-Type": "application/json"}}, 422, "invalid_request"),
        ({"content": b"x" * 5000, "headers": {**as_user("joni"), "Content-Type": "application/json"}}, 413, "payload_too_large"),
        ({"json": apply_body(), "headers": {**as_user("joni"), "Sec-Fetch-Site": "cross-site"}}, 403, "cross_site_refused"),
        ({"json": apply_body(), "headers": {**as_user("joni"), "Sec-Fetch-Site": "same-site"}}, 403, "cross_site_refused"),
    ]
    for kw, status, code in cases:
        r = c.post("/api/v1/system/update/apply", **({"headers": as_user("joni")} | kw))
        assert (r.status_code, r.json()["code"]) == (status, code), (kw, r.text)
    r = c.post("/api/v1/system/update/restart-platform", headers=as_user("joni"), json={"confirm": False, "idempotency_key": KEY})
    assert r.status_code == 422 and r.json()["code"] == "confirm_required"
    assert sup.log == [] and drain() == 0
    rows = [r for r in audit_rows(app) if r["action"] in ("system.update.apply", "system.update.restart_platform")]
    assert len(rows) == len(cases) and all(r["decision"] == "denied" for r in rows[:-1]), "body refusals after the permission are audited"
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT count(*) FROM update_runs").fetchone()[0] == 0


# ================================================================ apply

def test_apply_end_to_end_with_backup(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, vc, _ = rig
    sup.latest = NEWER
    r = j(c, "post", "/apply", json=apply_body())
    assert r.status_code == 202, r.text
    run = r.json()
    assert run["state"] == "requested" and run["kind"] == "update" and run["from_version"] == __version__ and run["to_version"] == NEWER
    run_id = run["run_id"]
    assert sup.log == [("GET", "/addons/self/info")], "only the pre-check before the 202"
    states = []

    def progress(v):
        states.append((run_row(app, run_id)["state"], run_row(app, run_id)["step"]))
        if v.t > 1012:
            sup.job_backup_done = True
        if v.t > 1022:
            sup.job_done = True

    vc.on_sleep.append(progress)
    monkeypatch.setattr(update_runs, "UPDATE_TIMEOUT_S", 40)
    drain()
    upd = [b for b in sup.bodies if b[0] == "POST" and b[1].startswith("/store/addons/")]
    assert upd == [("POST", f"/store/addons/{sup.slug}/update", {"backup": True, "background": True})], "the update is sent once, with the slug read from the info"
    assert ("backing_up", "job_running") in states and ("updating", "backup_done") in states and ("restarting", "job_done") in states, states
    row = run_row(app, run_id)
    assert row["state"] == "abandoned" and row["error_code"] == "timeout", "this process outlived the update window: never claimed as success"
    assert sup.calls("GET", "/jobs/info") >= 3


def test_apply_then_the_new_process_verifies_and_succeeds(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, vc, pending = rig
    sup.latest = NEWER
    run_id = j(c, "post", "/apply", json=apply_body(backup=False)).json()["run_id"]
    sup.kill_on_update = True  # the request arrives, then the old container goes away
    drain()
    row = run_row(app, run_id)
    assert (row["state"], row["step"]) == ("restarting", "outcome_unknown"), "an unknown outcome is never claimed and never resent"
    assert sup.calls("POST", f"/store/addons/{sup.slug}/update") == 1
    assert j(c, "get", f"/runs/{run_id}").json()["state"] == "restarting"
    assert updated_process(monkeypatch, app, app.state.settings, NEWER) == "verifying"
    assert run_row(app, run_id)["state"] == "verifying"
    sup.kill_on_update = False
    drain()  # the health check (the fake now reports the new version as installed)
    row = run_row(app, run_id)
    assert row["state"] == "succeeded" and row["error_code"] is None and row["finished_at"]
    acts = [(r["action"], r["decision"], json.loads(r["details_json"]).get("phase")) for r in audit_rows(app)]
    assert ("system.update.apply", "allowed", "attempt") in acts and ("system.update.result", "allowed", "outcome") in acts
    no_secrets(app, sup)


def test_on_startup_with_the_old_version_is_version_unchanged(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, *_ = rig
    sup.latest = NEWER
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    sup.kill_on_update = True
    drain()
    assert updated_process(monkeypatch, app, app.state.settings, __version__) == "version_unchanged"
    row = run_row(app, run_id)
    assert (row["state"], row["error_code"]) == ("failed", "version_unchanged")


def test_on_startup_before_the_call_was_sent_is_interrupted(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, _, pending = rig
    sup.latest = NEWER
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    pending.clear()  # the process died between the 202 and the worker
    assert updated_process(monkeypatch, app, app.state.settings, __version__) == "interrupted"
    assert run_row(app, run_id)["error_code"] == "interrupted"
    assert sup.calls("POST", f"/store/addons/{sup.slug}/update") == 0


def test_a_restart_loop_never_ends_in_success(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, _, pending = rig
    sup.latest = NEWER
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    sup.kill_on_update = True
    drain()
    assert updated_process(monkeypatch, app, app.state.settings, NEWER) == "verifying"
    pending.clear()  # crash before the health check finished (watchdog restart)
    assert updated_process(monkeypatch, app, app.state.settings, NEWER) == "verifying"
    pending.clear()
    assert updated_process(monkeypatch, app, app.state.settings, NEWER) == "restart_loop"
    row = run_row(app, run_id)
    assert (row["state"], row["error_code"]) == ("failed", "restart_loop")
    assert updated_process(monkeypatch, app, app.state.settings, NEWER) is None, "a settled run is not touched again"


def test_a_failed_health_check_is_retried_once_then_failed(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, vc, _ = rig
    sup.latest = NEWER
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    sup.kill_on_update = True
    drain()
    sup.installed = __version__  # the infrastructure still reports the old version
    updated_process(monkeypatch, app, app.state.settings, NEWER)
    sup.kill_on_update = False
    drain()
    row = run_row(app, run_id)
    assert (row["state"], row["error_code"]) == ("failed", "health_check_failed")
    details = [json.loads(r["details_json"]) for r in audit_rows(app) if r["action"] == "system.update.result"][-1]
    assert details["failed_checks"] == ["infrastructure"]


@pytest.mark.parametrize("status,code", [(409, "infrastructure_busy"), (400, "infrastructure_error"), (500, "infrastructure_error")])
def test_infrastructure_refusals_fail_the_run_with_a_code_only(rig, sup, status, code):  # noqa: F811
    app, c, drain, *_ = rig
    sup.latest = NEWER
    sup.update_status = status
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    drain()
    row = run_row(app, run_id)
    assert (row["state"], row["error_code"]) == ("failed", code)
    assert sup.calls("POST", f"/store/addons/{sup.slug}/update") == 1, "never retried"
    no_secrets(app, sup)


def test_role_still_default_is_platform_not_permitted(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    sup.latest = NEWER
    sup.role = "default"
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    drain()
    row = run_row(app, run_id)
    assert (row["state"], row["error_code"]) == ("failed", "platform_not_permitted")
    assert j(c, "get", "/state").json()["permitted"] == "no"


def test_job_failure_while_alive(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    sup.latest = NEWER
    sup.job_errors = [{"type": "BackupError", "message": "disk full"}]
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    drain()
    row = run_row(app, run_id)
    assert (row["state"], row["error_code"]) == ("failed", "update_job_failed")
    assert "disk full" not in json.dumps(audit_rows(app))


def test_pre_check_refusals_write_no_run(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    assert j(c, "post", "/apply", json=apply_body()).json()["code"] == "update_not_available"
    sup.latest = NEWER
    r = j(c, "post", "/apply", json=apply_body(target="0.1.998"))
    assert r.status_code == 409 and r.json()["code"] == "target_version_mismatch" and r.json()["details"] == {"latest": NEWER}
    sup.info_state = "startup"
    assert j(c, "post", "/apply", json=apply_body()).json()["code"] == "platform_busy"
    sup.info_state = "started"
    sup.slug = "Bad/Slug"
    assert j(c, "post", "/apply", json=apply_body()).status_code == 502
    sup.slug = "a1b2c3d4_smplwise_vms"
    sup.info_status = 403
    r = j(c, "post", "/apply", json=apply_body())
    assert r.status_code == 503 and r.json()["code"] == "platform_not_permitted" and r.json()["details"] == {"required_role": "manager"}
    sup.info_status = 200
    sup.drop = True
    assert j(c, "post", "/apply", json=apply_body()).json()["code"] == "infrastructure_unreachable"
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT count(*) FROM update_runs").fetchone()[0] == 0
    assert drain() == 0


def test_single_active_run_idempotency_and_the_apply_rate_limit(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, *_ = rig
    sup.latest = NEWER
    first = j(c, "post", "/apply", json=apply_body())
    assert first.status_code == 202
    replay = j(c, "post", "/apply", json=apply_body())
    assert replay.status_code == 200 and replay.json()["run_id"] == first.json()["run_id"], "same key: the same run, nothing new"
    assert j(c, "post", "/apply", json=apply_body(target="0.1.998")).json()["code"] == "idempotency_key_reused"
    r = j(c, "post", "/apply", json=apply_body(key="k-0000000002"))
    assert r.status_code == 409 and r.json()["code"] == "update_in_progress" and r.json()["details"]["kind"] == "update"
    r = j(c, "post", "/restart-platform", json={"confirm": True, "idempotency_key": "k-0000000003"})
    assert r.status_code == 409 and r.json()["code"] == "update_in_progress", "no platform restart while an update runs"
    sup.update_status = 409
    drain()  # the run fails
    r = j(c, "post", "/apply", json=apply_body(key="k-0000000004"))
    assert r.status_code == 429 and r.json()["code"] == "rate_limited" and int(r.headers["Retry-After"]) > 0
    later = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=11)
    monkeypatch.setattr(update_runs, "_now", lambda: later)
    assert j(c, "post", "/apply", json=apply_body(key="k-0000000005")).status_code == 202


def test_a_stale_run_is_abandoned_and_unblocks(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, _, pending = rig
    sup.latest = NEWER
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    pending.clear()
    later = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=21)
    monkeypatch.setattr(update_runs, "_now", lambda: later)
    body = j(c, "get", f"/runs/{run_id}").json()
    assert body["state"] == "abandoned" and body["error_code"] == "timeout" and body["finished_at"]
    assert j(c, "post", "/apply", json=apply_body(key="k-0000000009")).status_code == 202
    assert j(c, "get", "/runs/ffffffffffffffff").status_code == 404
    assert j(c, "get", "/runs/NOT-AN-ID").status_code == 422


def test_apply_refused_while_an_nvr_write_is_pending(rig, sup):  # noqa: F811
    app, c, *_ = rig
    sup.latest = NEWER
    with app.state.db.connection() as conn:
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(nvr_changes)")}
        if not cols:
            pytest.skip("no nvr_changes table on this branch")
        conn.execute("INSERT INTO nvr_changes(id, kind, permission, target, path, status, created_at) VALUES ('c1', 'stream_encoding', 'nvr.configure', 's', 'p', 'pending', ?)",
                     (dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),))
    assert j(c, "post", "/apply", json=apply_body()).json()["code"] == "nvr_write_in_progress"


def test_no_database_lock_is_held_while_the_infrastructure_is_called(rig, sup, settings):  # noqa: F811
    app, c, drain, *_ = rig
    sup.latest = NEWER
    results = []

    def try_write(method, path):
        raw = sqlite3.connect(settings.db_path, timeout=0.5)
        try:
            raw.execute("BEGIN IMMEDIATE")
            raw.execute("ROLLBACK")
            results.append((method, path, "free"))
        except sqlite3.OperationalError:
            results.append((method, path, "locked"))
        finally:
            raw.close()

    sup.hook = try_write
    assert j(c, "post", "/apply", json=apply_body()).status_code == 202
    drain()
    assert j(c, "post", "/restart-platform", json={"confirm": True, "idempotency_key": "k-0000000007"}).status_code in (202, 409)
    drain()
    assert results and all(r[2] == "free" for r in results), results


# ================================================================ restart-platform

def restart(c, key=KEY, user="joni", **headers):
    return c.post("/api/v1/system/update/restart-platform", headers={**as_user(user), **headers}, json={"confirm": True, "idempotency_key": key})


def test_platform_restart_end_to_end(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, vc, _ = rig
    with app.state.db.connection() as conn:
        platform_restart.add_reason(conn, "wiskey", "2.1.0")
    sup.core_down_polls = 2
    r = restart(c)
    assert r.status_code == 202, r.text
    run = r.json()
    assert run["kind"] == "platform_restart" and run["from_version"] == sup.core_version and run["step"] == "config_check"
    drain()
    order = [p for m, p in sup.log]
    assert order[:3] == ["/core/info", "/core/check", "/core/restart"], order
    assert ("POST", "/core/restart", {}) in sup.bodies
    row = run_row(app, run["run_id"])
    assert row["state"] == "succeeded", row
    assert sup.calls("POST", "/core/restart") == 1
    assert j(c, "get", "/state").json()["platform_restart_reasons"] == [], "a successful restart satisfies the stored reasons"
    acts = [(r["action"], json.loads(r["details_json"]).get("phase")) for r in audit_rows(app)]
    assert ("system.update.restart_platform", "attempt") in acts and ("system.update.result", "outcome") in acts
    no_secrets(app, sup)


def test_a_failed_configuration_check_never_restarts(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    sup.core_check_status = 400
    run_id = restart(c).json()["run_id"]
    drain()
    row = run_row(app, run_id)
    assert (row["state"], row["error_code"]) == ("failed", "platform_config_invalid")
    assert sup.calls("POST", "/core/restart") == 0
    no_secrets(app, sup)


@pytest.mark.parametrize("switch,code", [("core_check_status", "infrastructure_busy"), ("core_restart_status", "infrastructure_busy")])
def test_busy_infrastructure_fails_the_restart(rig, sup, switch, code):  # noqa: F811
    app, c, drain, *_ = rig
    setattr(sup, switch, 409)
    run_id = restart(c).json()["run_id"]
    drain()
    assert run_row(app, run_id)["error_code"] == code


def test_restart_without_the_manager_role(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    sup.role = "default"
    run_id = restart(c).json()["run_id"]  # /core/info is readable with the default role
    drain()
    assert run_row(app, run_id)["error_code"] == "platform_not_permitted"
    assert sup.calls("POST", "/core/restart") == 0


def test_an_unknown_restart_outcome_is_polled_not_resent(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    sup.core_restart_drop = True
    sup.core_down_polls = 3
    run_id = restart(c).json()["run_id"]
    drain()
    row = run_row(app, run_id)
    assert row["state"] == "succeeded" and sup.calls("POST", "/core/restart") == 1


def test_an_accepted_restart_that_never_goes_down_waits_the_settle_time(rig, sup):  # noqa: F811
    app, c, drain, vc, _ = rig
    start = vc.t
    run_id = restart(c).json()["run_id"]
    drain()
    assert run_row(app, run_id)["state"] == "succeeded"
    assert vc.t - start >= update_runs.RESTART_SETTLE_S


def test_a_platform_that_does_not_come_back(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    sup.core_state = "stopped"
    run_id = restart(c).json()["run_id"]
    drain()
    row = run_row(app, run_id)
    assert (row["state"], row["error_code"]) == ("failed", "platform_not_back")
    assert sup.calls("POST", "/core/restart") == 1, "never retried"


def test_a_paired_bridge_must_report_back(rig, sup):  # noqa: F811
    app, c, drain, vc, _ = rig
    with app.state.db.connection() as conn:
        set_setting(conn, "bridge.paired_at", "2026-01-01T00:00:00Z")
        set_setting(conn, "bridge.directory_at", "2026-01-01T00:00:00Z")
    run_id = restart(c).json()["run_id"]
    drain()
    assert run_row(app, run_id)["error_code"] == "bridge_not_loaded"

    def push(v):  # the bridge loads and pushes its directory a few polls after the restart
        if v.t > 1500:
            with app.state.db.connection() as conn:
                set_setting(conn, "bridge.directory_at", "9999-01-01T00:00:00Z")

    vc.on_sleep.append(push)
    run_id = restart(c, key="k-0000000008").json()["run_id"]
    drain()
    assert run_row(app, run_id)["state"] == "succeeded"


def test_restart_storm_one_restart_at_a_time_and_no_rate_limit(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    answers = [restart(c, key=f"k-storm-{i:04d}") for i in range(6)]
    assert [a.status_code for a in answers] == [202] + [409] * 5
    assert all(a.json()["code"] == "update_in_progress" for a in answers[1:])
    assert restart(c, key="k-storm-0000").json()["run_id"] == answers[0].json()["run_id"], "a replayed key is the same run"
    assert j(c, "post", "/apply", json=apply_body()).json()["code"] == "update_in_progress", "no update while the platform restarts"
    drain()
    assert sup.calls("POST", "/core/restart") == 1
    # owner answer 8: no rate limit - a finished restart may be followed by another at once
    r = restart(c, key="k-storm-0100")
    assert r.status_code == 202
    drain()
    assert sup.calls("POST", "/core/restart") == 2


def test_on_startup_resumes_or_closes_a_platform_restart(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, _, pending = rig
    run_id = restart(c).json()["run_id"]
    pending.clear()  # Arx itself went down before the configuration check
    assert update_runs.on_startup(app.state.db, app.state.settings) == "platform_resumed"
    assert run_row(app, run_id)["error_code"] == "interrupted"
    assert sup.calls("POST", "/core/restart") == 0
    run_id = restart(c, key="k-0000000010").json()["run_id"]
    pending.clear()
    with app.state.db.connection() as conn:
        conn.execute("UPDATE update_runs SET state = 'restarting', step = 'restart_sent' WHERE id = ?", (run_id,))
    update_runs.on_startup(app.state.db, app.state.settings)
    drain()
    assert run_row(app, run_id)["state"] == "succeeded"
    assert sup.calls("POST", "/core/restart") == 0, "a resumed run only polls"


def test_unconfigured_backend_refuses_without_calling(rig, monkeypatch):
    app, c, drain, *_ = rig
    monkeypatch.setattr(self_update, "BASE_URL", None)
    monkeypatch.setattr(self_update, "TOKEN", None)
    monkeypatch.delenv("SUPERVISOR_TOKEN", raising=False)
    for path, body in (("/apply", apply_body()), ("/restart-platform", {"confirm": True, "idempotency_key": KEY})):
        r = j(c, "post", path, json=body)
        assert r.status_code == 503 and r.json()["code"] == "infrastructure_unreachable"
    assert drain() == 0


# ================================================================ remote channel (CR-008; owner decision D5: allowed, no second factor)

def test_the_s3_routes_are_not_on_the_remote_deny_list_and_the_arx_restart_is_not_added_here():
    for path in ("/api/v1/system/update", "/api/v1/system/update/apply", "/api/v1/system/update/restart-platform"):
        assert not any(path == b or path.startswith(b + "/") for b in remote_channel.BLOCKED_ON_REMOTE), path


from test_remote_access import arx, arx_admin  # noqa: E402,F401 - fixtures


@pytest.fixture()
def remote_rig(arx_admin, monkeypatch):  # noqa: F811
    from update_fake_supervisor import FakeSupervisor

    pending: list = []
    monkeypatch.setattr(update_runs, "SPAWN", lambda fn, name: pending.append(fn))
    monkeypatch.setattr(update_runs, "_sleep", lambda s: None)
    with FakeSupervisor() as s:
        s.installed, s.latest = __version__, NEWER
        monkeypatch.setattr(self_update, "BASE_URL", s.url)
        monkeypatch.setattr(self_update, "TOKEN", TOKEN)
        monkeypatch.setattr(addon_restart, "BASE_URL", None)
        yield arx_admin, s, pending


def test_remote_cross_site_requests_are_refused_before_anything_is_sent(remote_rig):
    arx, s, pending = remote_rig
    r = arx.client.post("/arx/api/v1/system/update/restart-platform", json={"confirm": True, "idempotency_key": KEY}, headers={"Origin": "https://evil.example.com"})
    assert r.status_code == 403 and r.json()["code"] == "csrf_refused"
    r = arx.client.post("/arx/api/v1/system/update/apply", json=apply_body(), headers={"Sec-Fetch-Site": "same-site", "Origin": "http://testserver"})
    assert r.status_code == 403
    assert s.log == [] and pending == []


def test_remote_same_origin_system_admin_may_update_and_it_is_audited_as_remote(remote_rig):
    arx, s, pending = remote_rig
    r = arx.client.post("/arx/api/v1/system/update/apply", json=apply_body(), headers={"Sec-Fetch-Site": "same-origin"})
    assert r.status_code == 202, r.text
    row = arx.audit("system.update.apply")[-1]
    assert json.loads(row["details_json"])["remote"] is True and row["actor_user_id"] == "u-owner"
    assert len(pending) == 1


def test_remote_viewer_is_refused(remote_rig):
    arx, s, pending = remote_rig
    arx.flag("u-viewer")
    arx.bind("u-viewer", "viewer")
    assert arx.login(arx.viewer).status_code == 200
    r = arx.client.post("/arx/api/v1/system/update/restart-platform", json={"confirm": True, "idempotency_key": KEY}, headers={"Sec-Fetch-Site": "same-origin"})
    assert r.status_code == 403 and s.log == []


# ================================================================ manifest

def test_the_manifest_requests_the_manager_role_and_keeps_hot_backup():
    text = (Path(__file__).resolve().parents[2] / "config.yaml").read_text(encoding="utf-8")
    assert "\nhassio_api: true\nhassio_role: manager\n" in text
    assert "\nbackup: hot\n" in text, "owner answer 6: keep hot backup"
    assert "hassio_role: admin" not in text and "full_access" not in text and "host_network" not in text
