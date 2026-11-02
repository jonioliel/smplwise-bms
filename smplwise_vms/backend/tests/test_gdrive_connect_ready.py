"""GDRIVE-READY-2351: the first real Google Drive connection, prepared against the fake Google (tests/fake_gdrive.py; no network, no real
account). Covers: each first-try mistake named with its own code (a Web / Desktop client, a deleted or mistyped client, no consent screen,
the Drive API not enabled, a token without drive.file, the project's daily quota, an account that is not a test user); a grant without
drive.file is given back to Google; "בדיקת חיבור Google" (POST .../gdrive/diagnose) reports in Hebrew exactly what is wrong - missing
client id / secret, a client id pasted as the secret, the client type (no redirect URL is ever used), the consent screen, a secret that does
not match, clock skew, a TLS failure, the Drive API, the quota, the folder, the seven-day expiry of a "Testing" consent screen - and writes
nothing (no folder in Drive, no secret, no token in the answer); and the whole first connection end to end (tests/gdrive_dry_run.py)."""
from __future__ import annotations

import json
import time
from pathlib import Path

import httpx
import pytest
from conftest import as_user, bind, seed_tree
from fake_gdrive import CLIENT_ID, CLIENT_SECRET, DEVICE_CODE, REFRESH_TOKEN, SCOPE, FakeDrive
from fastapi.testclient import TestClient

import gdrive_dry_run
from smplwise.main import create_app
from smplwise.services import backup_drill as drill
from smplwise.services import backup_offbox as ob
from smplwise.services import offbox_gdrive as og
from smplwise.services import offbox_gdrive_connect, offbox_gdrive_diagnose, offbox_runtime, offbox_store

URL = "/api/v1/backups/offbox"


@pytest.fixture()
def world(settings, monkeypatch):
    drive = FakeDrive()
    monkeypatch.setattr(offbox_runtime, "GDRIVE_HTTP", lambda: httpx.Client(transport=httpx.MockTransport(drive.handler)))
    monkeypatch.setattr(og, "SLEEP", lambda s: None)
    clock = [1000.0]
    monkeypatch.setattr(offbox_gdrive_connect, "CLOCK", lambda: clock[0])
    monkeypatch.setattr(offbox_gdrive_diagnose, "WALL", time.time)
    offbox_gdrive_connect._PENDING.clear()
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)

    def set_wall(v: float) -> None:
        offbox_gdrive_diagnose.WALL = lambda: v
        drive.wall = lambda: v

    yield type("W", (), {"app": app, "c": c, "drive": drive, "settings": settings, "db": app.state.db, "clock": clock, "set_wall": set_wall})
    offbox_gdrive_connect._PENDING.clear()
    assert drive.foreign == [], "a request left the fake Google"


def _create(w, **cfg) -> str:
    body = {"name": "Google Drive", "kind": "gdrive", "enabled": False,
            "config": {"client_id": CLIENT_ID, "folder_name": "SmplWise Arx backups", "chunk_mib": 1, **cfg},
            "secrets": {"client_secret": CLIENT_SECRET}}
    r = w.c.post(f"{URL}/targets", json=body)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _secret(w, tid: str, value: str) -> None:
    with w.db.connection() as conn:
        if value:
            offbox_store.set_secret(conn, w.settings.data_dir, tid, "client_secret", value, None)
        else:
            offbox_store.clear_secret(conn, tid, "client_secret")


def _connect(w, tid: str) -> None:
    assert w.c.post(f"{URL}/targets/{tid}/gdrive/connect").status_code == 200
    w.drive.device_script = ["approve"]
    assert w.c.post(f"{URL}/targets/{tid}/gdrive/poll").json()["state"] == "connected"


def _diag(w, tid: str) -> dict:
    r = w.c.post(f"{URL}/targets/{tid}/gdrive/diagnose")
    assert r.status_code == 200, r.text
    return r.json()


def _by(d: dict) -> dict[str, dict]:
    return {c["id"]: c for c in d["checks"]}


def _hebrew(text: str) -> bool:
    return any(0x0590 <= ord(ch) <= 0x05FF for ch in text)


# ---------------------------------------------------------------- the transport names each first-try mistake


def test_client_refusals_are_named(world):
    d = world.drive
    flow = og.DeviceCodeFlow(httpx.Client(transport=httpx.MockTransport(d.handler)))
    for knob, code in (("web", "gdrive_client_type"), ("desktop", "gdrive_client_type")):
        d.client_kind = knob
        with pytest.raises(ob.OffboxError) as e:
            flow.start(CLIENT_ID, CLIENT_SECRET)
        assert e.value.code == code
    d.client_kind = "tv"
    d.client_deleted = True
    with pytest.raises(ob.OffboxError) as e:
        flow.start(CLIENT_ID, CLIENT_SECRET)
    assert e.value.code == "gdrive_client_not_found"
    d.client_deleted = False
    d.consent_configured = False
    with pytest.raises(ob.OffboxError) as e:
        flow.start(CLIENT_ID, CLIENT_SECRET)
    assert e.value.code == "gdrive_consent_not_configured"
    assert og.client_error_code("unauthorized_client", "") == "gdrive_client_type"
    assert og.client_error_code("invalid_client", "unauthorized") == "gdrive_client_invalid"
    assert og.client_error_code("invalid_request", "") is None


def test_not_a_test_user_ends_denied_and_a_grant_without_drive_file_is_given_back(world):
    d = world.drive
    flow = og.DeviceCodeFlow(httpx.Client(transport=httpx.MockTransport(d.handler)))
    auth = flow.start(CLIENT_ID, CLIENT_SECRET)
    d.test_user = False
    d.device_script = ["approve"]
    assert flow.poll(CLIENT_ID, CLIENT_SECRET, auth).state == "denied"
    for err in ("admin_policy_enforced", "org_internal"):
        h = httpx.Client(transport=httpx.MockTransport(lambda r, e=err: httpx.Response(400, json={"error": e})))
        assert og.DeviceCodeFlow(h).poll(CLIENT_ID, CLIENT_SECRET, auth).state == "denied"
    d.test_user = True
    d.device_script, d.granted_scope = ["approve"], "openid email"
    with pytest.raises(ob.OffboxError) as e:
        flow.poll(CLIENT_ID, CLIENT_SECRET, auth)
    assert e.value.code == "gdrive_scope_refused"
    assert d.revoke_calls == ["token"], "the grant Google did give is revoked at once"


def test_drive_api_disabled_scope_and_daily_quota_have_their_own_codes(world, tmp_path):
    d = world.drive
    http = httpx.Client(transport=httpx.MockTransport(d.handler))
    tokens = og.RefreshTokenSource(CLIENT_ID, ob.CredentialRef("store:gd.refresh_token"), http, client_secret=ob.CredentialRef("store:gd.client_secret"),
                                   secret_store={"gd.refresh_token": REFRESH_TOKEN, "gd.client_secret": CLIENT_SECRET}.get)
    dest = og.GDriveDestination(tokens, http, folder_name="Arx", retry=og.RetryPolicy(1, 1, 1), sleep=lambda s: None)
    d.api_disabled = True
    with pytest.raises(ob.OffboxError) as e:
        dest.list()
    assert e.value.code == "gdrive_api_disabled"
    r = ob.check_connection(dest, workdir=tmp_path)
    assert r["ok"] is False and r["error"] == "gdrive_api_disabled"
    d.api_disabled = False

    def answer(status: int, reason: str):
        def h(req: httpx.Request) -> httpx.Response:
            if req.url.host == "oauth2.googleapis.com":
                return d.handler(req)
            return httpx.Response(status, json={"error": {"code": status, "errors": [{"reason": reason}]}})
        return h

    for reason, code in (("insufficientPermissions", "gdrive_scope_refused"), ("dailyLimitExceeded", "rate_limited")):
        h2 = httpx.Client(transport=httpx.MockTransport(answer(403, reason)))
        t2 = og.RefreshTokenSource(CLIENT_ID, ob.CredentialRef("store:gd.refresh_token"), h2, client_secret=ob.CredentialRef("store:gd.client_secret"),
                                   secret_store={"gd.refresh_token": REFRESH_TOKEN, "gd.client_secret": CLIENT_SECRET}.get)
        sleeps: list[float] = []
        with pytest.raises(ob.OffboxError) as e:
            og.GDriveDestination(t2, h2, folder_name="Arx", retry=og.RetryPolicy(2, 1, 1), sleep=sleeps.append).list()
        assert e.value.code == code and sleeps == [], reason  # neither is retried: waiting does not fix them
    for code in ("gdrive_client_type", "gdrive_client_not_found", "gdrive_consent_not_configured", "gdrive_api_disabled"):
        assert _hebrew(offbox_runtime.REASON_HE[code]), code


# ---------------------------------------------------------------- "בדיקת חיבור Google"


def test_diagnose_ready_to_connect_and_writes_nothing(world):
    w = world
    tid = _create(w)
    calls = len(w.drive.calls)
    d = _diag(w, tid)
    assert d["ok"] is True and d["ready_to_connect"] is True and d["connected"] is False
    by = _by(d)
    assert [c["id"] for c in d["checks"]] == ["client_id", "client_secret", "network", "clock", "client", "secret_match", "account"]
    assert {k: v["status"] for k, v in by.items()} == {"client_id": "ok", "client_secret": "ok", "network": "ok", "clock": "ok", "client": "ok",
                                                         "secret_match": "ok", "account": "skip"}
    assert "חיבור חשבון Google" in d["summary"]
    assert all(_hebrew(c["title"] + c["message"]) for c in d["checks"])
    assert len(w.drive.calls) - calls == 2, "one device-code request and one secret probe"
    text = json.dumps(d)
    assert CLIENT_SECRET not in text and DEVICE_CODE not in text and REFRESH_TOKEN not in text
    assert offbox_gdrive_connect.pending(tid) is False, "the probe's device code is never kept as a pending consent"
    assert w.drive.files == {}
    with w.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'backup.offbox.gdrive_diagnose'").fetchone()
    assert row is not None and "owner@" not in row[0]


def test_diagnose_names_missing_and_misplaced_credentials(world):
    w = world
    tid = _create(w)
    _secret(w, tid, "")
    d = _diag(w, tid)
    assert _by(d)["client_secret"]["status"] == "fail" and "Client secret" in _by(d)["client_secret"]["message"]
    assert "secret_match" not in _by(d) and d["ok"] is False and d["summary"].startswith("נמצאה בעיה")
    _secret(w, tid, CLIENT_ID)
    assert "Client ID" in _by(_diag(w, tid))["client_secret"]["message"]
    _secret(w, tid, '{"installed": {"client_secret": "x"}}')
    assert "JSON" in _by(_diag(w, tid))["client_secret"]["message"]
    _secret(w, tid, "GOCSPX-a-different-secret")
    by = _by(_diag(w, tid))
    assert by["secret_match"]["status"] == "fail" and "Add secret" in by["secret_match"]["fix"]
    # an empty client id (a configuration saved by hand / an older build)
    with w.db.connection() as conn:
        t = offbox_store.get_target(conn, tid)
        conn.execute("UPDATE backup_offbox_targets SET config_json = ? WHERE id = ?", (json.dumps({**t["config"], "client_id": ""}), tid))
    d = _diag(w, tid)
    assert _by(d)["client_id"]["status"] == "fail" and "TVs and Limited Input devices" in _by(d)["client_id"]["fix"]
    assert _by(d)["network"]["status"] == "skip"


@pytest.mark.parametrize("knob,needle", [("web", "Redirect"), ("deleted", "נמחק"), ("consent", "מסך ההסכמה")])
def test_diagnose_names_the_client_problem(world, knob, needle):
    w = world
    tid = _create(w)
    if knob == "web":
        w.drive.client_kind = "web"
    elif knob == "deleted":
        w.drive.client_deleted = True
    else:
        w.drive.consent_configured = False
    d = _diag(w, tid)
    c = _by(d)["client"]
    assert c["status"] == "fail" and needle in c["message"] and c.get("fix"), c
    assert [x["id"] for x in d["checks"] if x["status"] == "fail"] == ["client"]


def test_diagnose_clock_skew_and_tls(world, monkeypatch):
    w = world
    tid = _create(w)
    w.drive.date_skew_s = -600  # Google's clock is ten minutes behind ours: ours runs ahead
    c = _by(_diag(w, tid))["clock"]
    assert c["status"] == "fail" and "מקדים" in c["message"] and "10" in c["message"] and "NTP" in c["fix"]
    w.drive.date_skew_s = 90
    assert _by(_diag(w, tid))["clock"]["status"] == "warn"
    w.drive.send_date = False
    assert _by(_diag(w, tid))["clock"]["status"] == "skip"

    def tls_broken(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: certificate is not yet valid")

    monkeypatch.setattr(offbox_runtime, "GDRIVE_HTTP", lambda: httpx.Client(transport=httpx.MockTransport(tls_broken)))
    d = _diag(w, tid)
    assert _by(d)["network"]["status"] == "fail" and "שעון" in _by(d)["network"]["fix"]

    def offline(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Name or service not known")

    monkeypatch.setattr(offbox_runtime, "GDRIVE_HTTP", lambda: httpx.Client(transport=httpx.MockTransport(offline)))
    d = _diag(w, tid)
    assert _by(d)["network"]["status"] == "fail" and "DNS" in _by(d)["network"]["fix"] and "clock" not in _by(d)


def test_diagnose_connected_account_api_quota_folder_and_testing_expiry(world):
    w = world
    tid = _create(w, min_free_mib=100)
    _connect(w, tid)
    d = _diag(w, tid)
    by = _by(d)
    assert d["ok"] and d["connected"] and not d["ready_to_connect"]
    assert [c["id"] for c in d["checks"]] == ["client_id", "client_secret", "network", "clock", "client", "account", "consent_mode", "drive_api",
                                              "quota", "folder"]
    assert by["account"]["status"] == "ok" and by["drive_api"]["status"] == "ok" and "owner@example.com" in by["drive_api"]["message"]
    assert by["consent_mode"]["status"] == "info" and "Testing" in by["consent_mode"]["message"] and "Publish app" in by["consent_mode"]["fix"]
    assert by["folder"]["status"] == "info" and w.drive.files == {}, "the folder is looked up, never created by the check"
    assert by["quota"]["status"] == "ok"
    # Drive nearly full
    w.drive.quota_limit = 50 * og.MIB
    assert _by(_diag(w, tid))["quota"]["status"] == "fail"
    w.drive.quota_limit = None
    # the Drive API switched off in the project
    w.drive.api_disabled = True
    c = _by(_diag(w, tid))["drive_api"]
    assert c["status"] == "fail" and "Enable" in c["fix"]
    w.drive.api_disabled = False
    # a token without drive.file
    w.drive.refresh_scope = "openid"
    assert _by(_diag(w, tid))["account"]["status"] == "fail"
    w.drive.refresh_scope = SCOPE
    # revoked a day after connecting: the generic reasons
    w.drive.revoked = True
    acc = _by(_diag(w, tid))["account"]
    assert acc["status"] == "fail" and "myaccount.google.com" in acc["message"]
    # ... and eight days after: the Testing consent screen named
    w.set_wall(time.time() + 8 * 86400)
    acc = _by(_diag(w, tid))["account"]
    assert acc["status"] == "fail" and "Testing" in acc["message"] and "Publish app" in acc["fix"]


def test_diagnose_while_waiting_for_approval_points_at_test_users(world):
    w = world
    tid = _create(w)
    assert w.c.post(f"{URL}/targets/{tid}/gdrive/connect").status_code == 200
    acc = _by(_diag(w, tid))["account"]
    assert acc["status"] == "info" and "Test users" in acc["fix"] and "Access blocked" in acc["fix"]
    assert offbox_gdrive_connect.pending(tid) is True, "the check never cancels a consent in progress"


def test_diagnose_is_for_system_administrators_and_gdrive_targets_only(world):
    w = world
    tid = _create(w)
    ids = seed_tree(w.c)
    bind(w.c, w.settings, "ron", "site_admin", "site", ids["site"])
    assert w.c.post(f"{URL}/targets/{tid}/gdrive/diagnose", headers=as_user("ron")).status_code == 403
    usb = w.c.post(f"{URL}/targets", json={"name": "USB", "kind": "local", "enabled": False,
                                           "config": {"path": str(Path(w.settings.data_dir).parent / "usb")}}).json()
    assert w.c.post(f"{URL}/targets/{usb['id']}/gdrive/diagnose").status_code == 404


# ---------------------------------------------------------------- the whole first connection (also: scripts/gdrive_connect_dry_run.py)


def test_first_connection_dry_run_end_to_end(world, capsys):
    w = world
    lines: list[str] = []
    facts = gdrive_dry_run.run(
        w.c, w.drive, w.clock, w.set_wall,
        push=lambda tid: offbox_runtime.run_push(w.db, w.settings, tid, trigger="manual"),
        drill=lambda tid: drill.run_offbox_drill(w.db, w.settings, tid),
        log=lines.append)
    assert facts["web_client_named"] and facts["reconnected"] and facts["copy"].endswith(".zip.swxb")
    transcript = "\n".join(lines)
    assert "Testing" in transcript and "Redirect" in transcript and "Enable" in transcript
    assert CLIENT_SECRET not in transcript and REFRESH_TOKEN not in transcript and DEVICE_CODE not in transcript
    with capsys.disabled():
        if __import__("os").environ.get("GDRIVE_DRY_RUN_PRINT"):
            print(transcript)
