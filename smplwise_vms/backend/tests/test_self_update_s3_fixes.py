"""CR-021 S3 security-review fixes (private review of 2026-10-04): child processes without secrets, an Arx restart in the middle of
an update, a build longer than the expected window, early restart-loop counting and the janitor, the confirmed backup, the same-origin
fallback, the slug bound to this add-on, the options content, the central door for discovery and /core/info, the platform-restart
confirmation and the apply-gap race. Fakes only (frontend/tests/fixtures/update_fake_supervisor.py); time is virtual."""
from __future__ import annotations

import ast
import datetime as dt
import json
import sqlite3
import types
from pathlib import Path

import pytest
from conftest import as_user
from test_self_update import NEWER, sup, world  # noqa: F401 - fixtures
from test_self_update_s3 import KEY, SAME_ORIGIN, apply_body, audit_rows, j, restart, rig, run_row, updated_process  # noqa: F401 - fixtures

from smplwise import __version__  # noqa: E402
from smplwise.services import exports, ha_client, ha_user_auth, nvr_system, plan_render, self_update, thumbnails, update_runs  # noqa: E402

BACKEND = Path(update_runs.__file__).resolve().parents[2]
PKG = BACKEND / "smplwise"


class Died(Exception):
    """Raised from a virtual sleep: the process running the worker went away (restart, watchdog, container replaced)."""


def die_after(vc, t):
    def hook(v):
        if v.t > t:
            raise Died()
    vc.on_sleep.append(hook)
    return hook


def results(app):
    return [(r["decision"], r["reason"], json.loads(r["details_json"]).get("phase")) for r in audit_rows(app, "system.update.result")]


# ================================================================ child processes never inherit secrets

SECRETS = {"SUPERVISOR_TOKEN": "sup-secret", "HASSIO_TOKEN": "hassio-secret", "SW_NVR_PASSWORD": "nvr-secret", "OPENAI_API_KEY": "sk-secret"}


@pytest.fixture()
def secret_env(monkeypatch):
    for k, v in SECRETS.items():
        monkeypatch.setenv(k, v)


def test_the_child_environment_is_minimal(secret_env):
    from smplwise.services import child_env

    env = child_env.minimal_env()
    assert "PATH" in env and env["LANG"] == "C.UTF-8"
    assert set(env) <= set(child_env.PASSED) | {"LANG"}, set(env)
    assert not any(v in str(env) for v in SECRETS.values())


class _Proc:
    returncode = 0
    stdout = "Pages: 3\n"
    stderr = ""


def _capture(monkeypatch, module):
    seen = []
    monkeypatch.setattr(module.subprocess, "run", lambda *a, **kw: seen.append(kw) or _Proc())
    return seen


def test_pdfinfo_and_pdftoppm_get_the_minimal_environment(secret_env, monkeypatch, tmp_path):
    monkeypatch.setattr(plan_render.shutil, "which", lambda name: f"/usr/bin/{name}")
    seen = _capture(monkeypatch, plan_render)
    assert plan_render.pdf_page_count(tmp_path / "a.pdf") == 3
    plan_render.render_pdf_page(tmp_path / "a.pdf", 1, tmp_path / "out" / "p.png", 800, 20)
    assert len(seen) == 2
    for kw in seen:
        assert kw.get("env") is not None and not any(v in str(kw["env"]) for v in SECRETS.values()), kw.get("env")


def test_ffmpeg_of_exports_and_thumbnails_gets_the_minimal_environment(secret_env, monkeypatch, tmp_path, settings):
    assert exports.subprocess is thumbnails.subprocess
    seen = _capture(monkeypatch, exports)
    exports._ffmpeg("/usr/bin/ffmpeg", ["-i", "x", "y"])
    monkeypatch.setattr(thumbnails.shutil, "which", lambda name: "/usr/bin/ffmpeg")
    thumbnails._grab("rtsp://user:pw@nvr.invalid/x", tmp_path / "t.jpg", settings)
    assert len(seen) == 2
    for kw in seen:
        assert kw.get("env") is not None and not any(v in str(kw["env"]) for v in SECRETS.values()), kw.get("env")


SPAWNERS = {("subprocess", n) for n in ("run", "Popen", "call", "check_call", "check_output")} | {("asyncio", "create_subprocess_exec"),
                                                                                               ("asyncio", "create_subprocess_shell")}
NO_ENV_POSSIBLE = {("os", n) for n in ("system", "popen", "execv", "execve", "execvp", "execvpe", "execl", "execle", "execlp", "execlpe", "spawnv",
                                       "spawnve", "spawnvp", "spawnvpe", "spawnl", "spawnle", "posix_spawn", "posix_spawnp")} | \
                  {("subprocess", "getoutput"), ("subprocess", "getstatusoutput")}
SAFE_IMPORTS = {"TimeoutExpired", "CalledProcessError", "SubprocessError", "PIPE", "DEVNULL", "STDOUT", "CompletedProcess"}


def _env_is_minimal(call: ast.Call) -> bool:
    for kw in call.keywords:
        if kw.arg == "env" and isinstance(kw.value, ast.Call):
            f = kw.value.func
            name = f.attr if isinstance(f, ast.Attribute) else getattr(f, "id", "")
            return name == "minimal_env"
    return False


def test_guard_every_child_process_of_the_product_passes_the_minimal_environment():
    """A new subprocess call without `env=child_env.minimal_env()` fails here (security review: the token is worth `manager`)."""
    bad = []
    for f in PKG.rglob("*.py"):
        tree = ast.parse(f.read_text(encoding="utf-8"), filename=str(f))
        rel = f.relative_to(PKG).as_posix()
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module in ("subprocess", "os", "asyncio"):
                for alias in node.names:
                    if node.module == "subprocess" and alias.name not in SAFE_IMPORTS:
                        bad.append(f"{rel}:{node.lineno} from subprocess import {alias.name}")
                    if (node.module, alias.name) in SPAWNERS | NO_ENV_POSSIBLE:
                        bad.append(f"{rel}:{node.lineno} from {node.module} import {alias.name}")
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute) or not isinstance(node.func.value, ast.Name):
                continue
            pair = (node.func.value.id, node.func.attr)
            if pair in NO_ENV_POSSIBLE:
                bad.append(f"{rel}:{node.lineno} {pair[0]}.{pair[1]} cannot take a minimal environment")
            elif pair in SPAWNERS and not _env_is_minimal(node):
                bad.append(f"{rel}:{node.lineno} {pair[0]}.{pair[1]} without env=minimal_env()")
    assert bad == [], bad


# ================================================================ an Arx restart in the middle of an update

def _old_process_dies_mid_job(app, c, drain, vc, sup):  # noqa: F811
    """apply with backup; the Supervisor job runs; the old process is restarted (NVR connection save, Arx restart, watchdog)."""
    sup.latest = NEWER
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    hook = die_after(vc, vc.t + 12)
    drain()
    vc.on_sleep.remove(hook)
    row = run_row(app, run_id)
    assert row["state"] == "backing_up" and row["step"] == "job_running", row
    return run_id


def test_a_restart_of_the_old_version_while_the_job_runs_keeps_the_run_open_and_verifies_later(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, vc, pending = rig
    run_id = _old_process_dies_mid_job(app, c, drain, vc, sup)
    assert updated_process(monkeypatch, app, app.state.settings, __version__) == "resumed", "the job is still running: no verdict yet"
    row = run_row(app, run_id)
    assert row["state"] == "backing_up" and row["finished_at"] is None
    assert j(c, "post", "/apply", json=apply_body(key="k-0000000002")).json()["code"] == "update_in_progress", "the single-run guard holds"
    assert results(app) == [], "no failure is audited while the job runs"

    def progress(v):  # the job goes on, the backup finishes, then the Supervisor replaces this (old) process
        if v.t > vc_start + 15:
            sup.job_backup_done = True
        if v.t > vc_start + 40:
            sup.job_done, sup.installed = True, NEWER
            raise Died()

    vc_start = vc.t
    vc.on_sleep.append(progress)
    drain()
    vc.on_sleep.remove(progress)
    assert run_row(app, run_id)["state"] == "updating"
    assert updated_process(monkeypatch, app, app.state.settings, NEWER) == "verifying"
    drain()
    row = run_row(app, run_id)
    assert row["state"] == "succeeded", row
    assert results(app) == [("allowed", None, "outcome")]


def test_a_restart_of_the_old_version_then_the_job_fails(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, vc, _ = rig
    run_id = _old_process_dies_mid_job(app, c, drain, vc, sup)
    assert updated_process(monkeypatch, app, app.state.settings, __version__) == "resumed"
    sup.job_errors = [{"type": "BuildError", "message": "pip"}]
    drain()
    assert (run_row(app, run_id)["state"], run_row(app, run_id)["error_code"]) == ("failed", "update_job_failed")


def test_old_version_with_no_update_job_and_the_old_version_installed_is_version_unchanged(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, vc, _ = rig
    run_id = _old_process_dies_mid_job(app, c, drain, vc, sup)
    sup.job_listed = False  # the Supervisor is no longer working on it and still reports the old version
    assert updated_process(monkeypatch, app, app.state.settings, __version__) == "resumed"
    start = vc.t
    drain()
    row = run_row(app, run_id)
    assert (row["state"], row["error_code"]) == ("failed", "version_unchanged")
    assert vc.t - start >= update_runs.NO_JOB_GRACE_S, "a short gap in the job list is not a verdict"


# ================================================================ a build longer than the expected window

def test_a_build_past_the_expected_window_is_not_abandoned_and_the_new_version_is_verified(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, vc, _ = rig
    sup.latest = NEWER
    monkeypatch.setattr(update_runs, "POLL_S", 60.0)  # fewer polls of the fake, same virtual time
    run_id = j(c, "post", "/apply", json=apply_body(backup=False)).json()["run_id"]
    hook = die_after(vc, vc.t + 25 * 60)  # 25 minutes of building, then the Supervisor replaces the process
    drain()
    vc.on_sleep.remove(hook)
    row = run_row(app, run_id)
    assert row["state"] == "updating" and row["finished_at"] is None, row
    later = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=25)
    monkeypatch.setattr(update_runs, "_now", lambda: later)
    view = j(c, "get", f"/runs/{run_id}").json()
    assert view["state"] == "updating", "not abandoned by a status read either"
    assert view["timeout_s"] == update_runs.UPDATE_TIMEOUT_S >= 60 * 60 and view["expected_s"] == 20 * 60
    sup.installed = NEWER
    assert updated_process(monkeypatch, app, app.state.settings, NEWER) == "verifying"
    drain()
    assert run_row(app, run_id)["state"] == "succeeded"


def test_a_run_abandoned_at_the_ceiling_is_verified_when_its_version_comes_up(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, vc, pending = rig
    sup.latest = NEWER
    run_id = j(c, "post", "/apply", json=apply_body(backup=False)).json()["run_id"]
    pending.clear()
    update_runs.finish(app.state.db, run_id, "abandoned", "timeout")
    sup.installed = NEWER
    assert updated_process(monkeypatch, app, app.state.settings, NEWER) == "verifying"
    drain()
    row = run_row(app, run_id)
    assert row["state"] == "succeeded" and row["error_code"] is None
    phases = [p for _, _, p in results(app)]
    assert phases == ["outcome", "reopened", "outcome"], phases


def test_the_janitor_settles_stuck_runs(rig, sup, monkeypatch):  # noqa: F811
    from smplwise.main import janitor_tick

    app, c, drain, vc, pending = rig
    sup.latest = NEWER
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    pending.clear()
    later = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=update_runs.UPDATE_TIMEOUT_S + 60)
    monkeypatch.setattr(update_runs, "_now", lambda: later)
    janitor_tick(app.state.db, app.state.settings)
    assert (run_row(app, run_id)["state"], run_row(app, run_id)["error_code"]) == ("abandoned", "timeout")
    assert j(c, "get", "/state").json()["run"] is None


# ================================================================ a crash before on_startup counts towards the restart loop

def test_a_crash_in_the_migrations_counts_towards_the_restart_loop(rig, sup, monkeypatch):  # noqa: F811
    from smplwise import db as dbmod
    from smplwise.main import create_app

    app, c, drain, vc, pending = rig
    sup.latest = NEWER
    sup.kill_on_update = True
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    drain()
    monkeypatch.setattr(update_runs, "__version__", NEWER)

    def broken(self):
        raise RuntimeError("migration 0099 failed")

    monkeypatch.setattr(dbmod.Database, "migrate", broken)
    for _ in range(update_runs.LOOP_BOOTS):
        with pytest.raises(RuntimeError):
            create_app(app.state.settings)
    row = run_row(app, run_id)
    assert (row["state"], row["error_code"]) == ("failed", "restart_loop")


def test_the_early_count_and_on_startup_count_a_start_once(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, vc, pending = rig
    sup.latest = NEWER
    sup.kill_on_update = True
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    drain()
    monkeypatch.setattr(update_runs, "__version__", NEWER)
    for early, expected in (("counted", "verifying"), ("counted", "verifying"), ("restart_loop", None)):
        assert update_runs.early_boot(app.state.db) == early
        assert update_runs.on_startup(app.state.db, app.state.settings) == expected
        pending.clear()
    assert run_row(app, run_id)["error_code"] == "restart_loop"


# ================================================================ the backup shows what happened

def test_backup_is_confirmed_only_by_a_finished_backup_job(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, vc, _ = rig
    sup.latest = NEWER
    run_id = j(c, "post", "/apply", json=apply_body()).json()["run_id"]
    view = j(c, "get", f"/runs/{run_id}").json()
    assert (view["backup"], view["backup_requested"], view["backup_state"]) == (False, True, "requested")
    hook = die_after(vc, vc.t + 12)
    drain()  # the job runs, its backup child has not finished
    vc.on_sleep.remove(hook)
    view = j(c, "get", f"/runs/{run_id}").json()
    assert view["backup"] is False and view["backup_state"] == "requested", "requested is not taken"
    assert update_runs._backup_done({"child_jobs": [{"name": "backup_manager_partial_backup", "done": True, "errors": [{"type": "BackupError"}]}]}) is False, \
        "a backup child that finished with errors is no backup"
    sup.job_backup_done = True
    update_runs.SPAWN(lambda: update_runs.update_follow(app.state.db, app.state.settings, run_id, "0123456789abcdef0123456789abcdef"), "x")
    hook = die_after(vc, vc.t + 12)
    drain()
    vc.on_sleep.remove(hook)
    view = j(c, "get", f"/runs/{run_id}").json()
    assert (view["backup"], view["backup_requested"], view["backup_state"]) == (True, True, "confirmed")
    no_backup = update_runs.run_view({**run_row(app, run_id), "backup": 0})
    assert (no_backup["backup"], no_backup["backup_requested"], no_backup["backup_state"]) == (False, False, "not_requested")


# ================================================================ the same-origin fallback

def test_without_sec_fetch_site_the_origin_must_match_the_host(rig, sup):  # noqa: F811
    app, c, drain, *_ = rig
    sup.latest = NEWER
    body = apply_body()
    for headers in ({}, {"Origin": "http://evil.example"}, {"Origin": "null"}, {"Origin": "http://testserver.evil.example"}):
        r = c.post("/api/v1/system/update/apply", headers={**as_user("joni"), **headers}, json=body)
        assert r.status_code == 403 and r.json()["code"] == "cross_site_refused", (headers, r.text)
    r = c.post("/api/v1/system/update/restart-platform", headers=as_user("joni"), json={"confirm": True, "idempotency_key": KEY})
    assert r.status_code == 403 and r.json()["code"] == "cross_site_refused"
    assert sup.log == [] and drain() == 0
    r = c.post("/api/v1/system/update/apply", headers={**as_user("joni"), "Origin": "http://testserver"}, json=body)
    assert r.status_code == 202, r.text


# ================================================================ the slug is this add-on's; the shared POST helper is narrow

def test_the_update_slug_must_be_this_add_ons_own(settings, sup, monkeypatch):  # noqa: F811
    body = {"backup": True, "background": True}
    monkeypatch.setattr(self_update, "_SELF_SLUG", None)
    with pytest.raises(self_update.ProbeRefused):
        self_update.check_allowed("POST", self_update.P_UPDATE, body, sup.slug)  # not read from the infrastructure yet
    assert self_update.call(settings, "GET", self_update.P_INFO).kind == "ok"
    assert self_update.check_allowed("POST", self_update.P_UPDATE, body, sup.slug) == f"/store/addons/{sup.slug}/update"
    for other in ("core_ssh", "core_samba", "a0d7b954_vscode", "local_smplwise_vms"):
        with pytest.raises(self_update.ProbeRefused):
            self_update.check_allowed("POST", self_update.P_UPDATE, body, other)


def test_nvr_system_has_no_supervisor_door(settings, monkeypatch):
    """Was: nvr_system.supervisor_post reaches only its two calls. Since CR-022 (merged in 0.1.159) the NVR connection is stored in Arx
    and nvr_system makes no infrastructure call at all; the Arx restart is addon_restart's single fixed path."""
    def never(*a, **kw):
        raise AssertionError("a request was about to be sent")

    monkeypatch.setattr(self_update, "send", never)
    for name in ("supervisor_post", "supervisor_options", "save_connection", "SUPERVISOR_POST_PATHS"):
        assert not hasattr(nvr_system, name), name
    text = (PKG / "services" / "nvr_system.py").read_text(encoding="utf-8")
    assert "self_update" not in text and "/addons/self/" not in text


def _options(**over):
    base = {"bootstrap_admin_username": "joni", "nvr_host": "nvr.invalid", "nvr_http_port": 80, "nvr_rtsp_port": 554, "nvr_username": "u",
            "nvr_password": "p", "go2rtc_url": "", "go2rtc_api_username": "", "go2rtc_api_password": "", "wiskey_username": "", "wiskey_password": "",
            "openai_api_key": "", "remote_access": False, "remote_path": "/arx", "db_write_gate": True, "log_level": "info"}
    return {**base, **over}


def test_options_content_is_validated():
    ok = self_update.check_allowed("POST", self_update.P_OPTIONS, {"options": _options()})
    assert ok == "/addons/self/options"
    refused = [None, {"options": "x"}, {"options": [1]}, {"options": _options(evil=1)}, {"options": _options(nvr_http_port="80")},
               {"options": _options(nvr_http_port=70000)}, {"options": _options(remote_access="yes")}, {"options": _options(nvr_host={"a": 1})},
               {"options": _options(log_level="trace")}, {"options": _options(remote_path="/../x")}, {"options": _options(bootstrap_admin_username=None)},
               {"options": _options(nvr_host="x" * 5000)}]
    for body in refused:
        with pytest.raises(self_update.ProbeRefused):
            self_update.check_allowed("POST", self_update.P_OPTIONS, body)


def test_option_types_match_the_manifest_schema():
    text = (BACKEND.parent / "config.yaml").read_text(encoding="utf-8")
    schema = text.split("\nschema:\n", 1)[1]
    keys = set()
    for line in schema.splitlines():
        if not line.startswith("  ") or line.startswith("   "):
            break
        keys.add(line.strip().split(":", 1)[0])
    assert set(self_update.OPTION_TYPES) == keys


def test_nothing_in_the_product_writes_the_add_on_options():
    """Was: saving the NVR connection rewrote only the NVR keys of the add-on options. Since CR-022 (merged in 0.1.159) the connection
    lives in Arx's own database and no product module sends POST /addons/self/options; the allow-list entry and its content check stay
    (test_options_content_is_validated) so a future caller is still bounded."""
    users = sorted(f.relative_to(PKG).as_posix() for f in PKG.rglob("*.py")
                   if f.name != "self_update.py" and ("P_OPTIONS" in f.read_text(encoding="utf-8") or "/addons/self/options" in f.read_text(encoding="utf-8")))
    assert users == [], users


# ================================================================ discovery and /core/info through the central door

def test_discovery_and_core_info_go_through_the_central_door(settings, monkeypatch):
    calls = []

    def fake_send(method, path, **kw):
        self_update.check_allowed(method, path, kw.get("body"), kw.get("slug"))
        calls.append((method, path, kw.get("body")))
        return self_update.Reply("ok", 200, {"uuid": "u1"} if path == "/discovery" else {"port": 8443, "ssl": True})

    def no_direct_http(*a, **kw):
        raise AssertionError("a direct httpx call bypasses the central door")

    import httpx

    monkeypatch.setattr(httpx, "post", no_direct_http)
    monkeypatch.setattr(httpx, "get", no_direct_http)
    monkeypatch.setenv("SUPERVISOR_TOKEN", "fake")
    monkeypatch.setattr(self_update, "send", fake_send)
    ha_client.post_discovery(settings, "smplwise_bridge", {"addon_url": "http://x:8099", "pairing_code": "c"})
    assert ha_user_auth._supervisor_core_base() == "https://homeassistant:8443"
    assert [(m, p) for m, p, _ in calls] == [("POST", "/discovery"), ("GET", "/core/info")]
    for body in ({"service": "other", "config": {}}, {"service": "smplwise_bridge", "config": {"x": "y"}}, {"service": "smplwise_bridge"}):
        with pytest.raises(self_update.ProbeRefused):
            self_update.check_allowed("POST", "/discovery", body)


# ================================================================ the platform restart: success only after the post-restart check

def test_one_transient_error_is_not_a_restart(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, *_ = rig
    monkeypatch.setattr(update_runs, "POLL_S", 30.0)  # fewer polls of the fake up to the 10-minute deadline
    sup.core_restart_drop = True  # unknown outcome: only an observed restart counts
    sup.core_down_polls = 1
    run_id = restart(c).json()["run_id"]
    drain()
    row = run_row(app, run_id)
    assert (row["state"], row["error_code"]) == ("failed", "restart_not_observed"), row


def test_a_core_that_falls_again_right_after_coming_back_is_not_a_success(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, *_ = rig
    monkeypatch.setattr(update_runs, "POLL_S", 30.0)
    sup.core_down_polls = 2

    flip = {"ran": False}

    def crash_loop(method, path):  # down, down, running, down, down, running, ... (a core that falls again right after it came back)
        if path != "/core/info" or not sup.calls("POST", "/core/restart") or sup._down_left:
            return
        if flip["ran"]:
            sup._down_left, flip["ran"] = 2, False
        else:
            flip["ran"] = True
    sup.hook = crash_loop
    run_id = restart(c).json()["run_id"]
    drain()
    assert run_row(app, run_id)["state"] == "failed"


def test_a_directory_push_of_the_old_core_is_not_proof_of_the_new_one(rig, sup, monkeypatch):  # noqa: F811
    app, c, drain, vc, _ = rig
    base = dt.datetime.now(dt.timezone.utc)
    monkeypatch.setattr(update_runs, "_now", lambda: base + dt.timedelta(seconds=vc.t))
    from smplwise.db import set_setting

    with app.state.db.connection() as conn:
        set_setting(conn, "bridge.paired_at", "2026-01-01T00:00:00Z")
        set_setting(conn, "bridge.directory_at", "2026-01-01T00:00:00Z")
    sup.core_down_polls = 3
    pushed = []

    def old_core_push(v):  # the old core pushes once after the restart was sent, while it shuts down; nothing after it is back
        if not pushed and sup.calls("POST", "/core/restart"):
            pushed.append(1)
            with app.state.db.connection() as conn:
                set_setting(conn, "bridge.directory_at", update_runs._iso())
    vc.on_sleep.insert(0, old_core_push)
    run_id = restart(c).json()["run_id"]
    drain()
    assert run_row(app, run_id)["error_code"] == "bridge_not_loaded"


# ================================================================ the 10-minute gap holds under a race

def test_the_apply_gap_is_rechecked_under_the_write_lock(rig, sup, settings):  # noqa: F811
    app, c, drain, *_ = rig
    sup.latest = NEWER
    done = []

    def parallel_apply_finished(method, path):  # while this request reads unlocked, another apply ran and failed fast
        if path == "/addons/self/info" and not done:
            done.append(1)
            raw = sqlite3.connect(settings.db_path, timeout=5)
            try:
                raw.execute("INSERT INTO update_runs(id, created_at, finished_at, from_version, to_version, backup, restart_platform, state, error_code, idempotency_key) "
                            "VALUES ('00000000000000aa', ?, ?, ?, ?, 0, 0, 'failed', 'infrastructure_busy', 'k-parallel-01')",
                            (update_runs._iso(), update_runs._iso(), __version__, NEWER))
                raw.commit()
            finally:
                raw.close()
    sup.hook = parallel_apply_finished
    r = j(c, "post", "/apply", json=apply_body())
    assert r.status_code == 429 and r.json()["code"] == "rate_limited", r.text
    assert drain() == 0 and sup.calls("POST", f"/store/addons/{sup.slug}/update") == 0


# ================================================================ nothing that restarts Arx starts while an update runs (owner decision)

def test_the_arx_restart_is_refused_while_an_update_runs(rig, sup, monkeypatch):  # noqa: F811
    """Was: saving the NVR connection is refused while an update runs (the 0.1.71 save restarted Arx). Since CR-022 (merged in 0.1.159)
    saving only stores the connection; the restart is the separate POST /system/restart, which is the one refused now."""
    app, c, drain, *_ = rig
    sup.latest = NEWER
    assert j(c, "post", "/apply", json=apply_body()).status_code == 202  # the run is open (the worker is captured, not run)
    before = sup.calls("POST", "/addons/self/restart")
    r = c.post("/api/v1/system/restart", headers={**as_user("joni"), **SAME_ORIGIN}, json={"confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "update_running", r.text
    assert "מתבצע עדכון" in r.json()["user_message"] and sup.calls("POST", "/addons/self/restart") == before
    # once the run is settled the guard lets go
    with app.state.db.connection() as conn:
        conn.execute("UPDATE update_runs SET state = 'failed', finished_at = created_at")
        assert update_runs.refuse_arx_restart_during_update(conn) is None