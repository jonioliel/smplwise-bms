"""GDRIVE-READY-2351: the owner's first Google Drive connection, simulated end to end against the fake Google (tests/fake_gdrive.py,
an httpx.MockTransport - no socket, no real account). Used by tests/test_gdrive_connect_ready.py and by
scripts/gdrive_connect_dry_run.py (which prints the transcript).

The walk follows docs/operations/GDRIVE_CONNECT_SETUP_HE.md step for step, including the two mistakes most likely on a first try (a
"Web application" client, the Drive API not enabled) and the seven-day expiry of a consent screen left in "Testing"."""
from __future__ import annotations

import time
from typing import Any, Callable

from fake_gdrive import CLIENT_ID, CLIENT_SECRET, USER_CODE, FakeDrive

URL = "/api/v1/backups/offbox"
DAY = 86400.0


def _failed(diag: dict[str, Any]) -> list[str]:
    return [c["id"] for c in diag["checks"] if c["status"] == "fail"]


def run(c: Any, drive: FakeDrive, clock: list[float], set_wall: Callable[[float], None], push: Callable[[str], dict[str, Any]],
        drill: Callable[[str], dict[str, Any]], log: Callable[[str], None] = lambda s: None) -> dict[str, Any]:
    """Drive the whole flow through the HTTP API. Returns facts for the test to assert; raises AssertionError at the first surprise."""
    facts: dict[str, Any] = {}

    def step(title: str) -> None:
        log(f"\n== {title}")

    def diag(tid: str) -> dict[str, Any]:
        r = c.post(f"{URL}/targets/{tid}/gdrive/diagnose")
        assert r.status_code == 200, r.text
        d = r.json()
        for ch in d["checks"]:
            log(f"  [{ch['status']:<4}] {ch['title']}: {ch['message']}" + (f"  -> {ch['fix']}" if ch.get("fix") else ""))
        log(f"  => {d['summary']}")
        return d

    step("1. The key is exported first (Drive holds only the sealed copy)")
    r = c.post(f"{URL}/key/export", json={"confirm": "EXPORT"})
    assert r.status_code == 200, r.text
    log("  key exported once")

    step("2. Mistake on purpose: a 'Web application' client was created in Google Cloud Console")
    drive.client_kind = "web"
    body = {"name": "Google Drive", "kind": "gdrive", "enabled": False,
            "config": {"client_id": CLIENT_ID, "folder_name": "SmplWise Arx backups", "chunk_mib": 1, "prune_mode": "delete"},
            "secrets": {"client_secret": CLIENT_SECRET}, "retention": {"keep_last": 3, "keep_daily": 0, "keep_weekly": 0, "keep_monthly": 0}}
    r = c.post(f"{URL}/targets", json=body)
    assert r.status_code == 201, r.text
    tid = r.json()["id"]
    d = diag(tid)
    assert _failed(d) == ["client"], d
    assert "Redirect" in next(x for x in d["checks"] if x["id"] == "client")["message"]
    r = c.post(f"{URL}/targets/{tid}/gdrive/connect")
    assert r.status_code == 422 and r.json()["code"] == "gdrive_client_type", r.text
    log(f"  connect refused: {r.json()['user_message']}")
    facts["web_client_named"] = True

    step("3. A 'TVs and Limited Input devices' client replaces it; the check says: ready to connect")
    drive.client_kind = "tv"
    d = diag(tid)
    assert d["ok"] and d["ready_to_connect"] and not d["connected"], d
    assert {x["id"]: x["status"] for x in d["checks"]}["secret_match"] == "ok"

    step("4. Connect: the code is typed at google.com/device and approved")
    r = c.post(f"{URL}/targets/{tid}/gdrive/connect")
    assert r.status_code == 200 and r.json()["user_code"] == USER_CODE, r.text
    log(f"  code {r.json()['user_code']} at {r.json()['verification_url']}")
    drive.device_script = ["pending", "approve"]
    assert c.post(f"{URL}/targets/{tid}/gdrive/poll").json()["state"] == "pending"
    clock[0] += 5
    assert c.post(f"{URL}/targets/{tid}/gdrive/poll").json()["state"] == "connected"
    log("  connected; the refresh token is sealed")

    step("5. Mistake on purpose: the Google Drive API is not enabled in the project")
    drive.api_disabled = True
    d = diag(tid)
    assert _failed(d) == ["drive_api"], d
    t = c.post(f"{URL}/targets/{tid}/test").json()
    assert t["ok"] is False and t["error"] == "gdrive_api_disabled", t
    drive.api_disabled = False

    step("6. Enabled: every check passes; switch on, test, first upload, copies, restore drill")
    d = diag(tid)
    assert d["ok"] and d["connected"] and not _failed(d), d
    assert "owner@example.com" in " ".join(x["message"] for x in d["checks"])
    r = c.patch(f"{URL}/targets/{tid}", json={"enabled": True})
    assert r.status_code == 200 and r.json()["enabled"] is True, r.text
    t = c.post(f"{URL}/targets/{tid}/test").json()
    assert t["ok"] is True, t
    log("  connection test: write / read / delete / list OK")
    r = c.post("/api/v1/backups", json={"note": "first Drive copy"})
    assert r.status_code == 201, r.text
    res = push(tid)
    assert res["ok"] and res["verified"], res
    stored = [f for f in drive.files.values() if f.name.endswith(".zip.swxb")]
    assert len(stored) == 1 and stored[0].data.startswith(b"SWXB"), "only the sealed copy is in Drive"
    log(f"  first upload verified: {stored[0].name} ({len(stored[0].data)} bytes, sealed)")
    copies = c.get(f"{URL}/targets/{tid}/copies").json()["copies"]
    assert [x["name"] for x in copies] == [stored[0].name]
    dr = drill(tid)
    assert dr["result"] == "PASS", dr
    log("  restore drill from the Drive copy: PASS")
    d = diag(tid)
    assert next(x for x in d["checks"] if x["id"] == "folder")["status"] == "ok"
    facts["tid"] = tid
    facts["copy"] = stored[0].name

    step("7. Seven days later, the consent screen was left in Testing: Google revokes the connection")
    set_wall(time.time() + 8 * DAY)
    drive.revoked = True
    d = diag(tid)
    acc = next(x for x in d["checks"] if x["id"] == "account")
    assert acc["status"] == "fail" and "Testing" in acc["message"] and "Publish app" in acc.get("fix", ""), acc
    log("  -> Publish app, then connect again")
    set_wall(time.time())
    r = c.post(f"{URL}/targets/{tid}/gdrive/connect")
    assert r.status_code == 200, r.text
    drive.device_script = ["approve"]
    clock[0] += 5
    assert c.post(f"{URL}/targets/{tid}/gdrive/poll").json()["state"] == "connected"
    d = diag(tid)
    assert d["ok"], d
    facts["reconnected"] = True
    return facts
