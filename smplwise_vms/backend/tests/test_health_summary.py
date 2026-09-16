"""Top-bar summary (T035): cheap, probe-free, available to every signed-in user; an NVR that stopped answering
shows as an error, an unconfigured NVR only as a warning, a fresh backup clears the backup warning."""
from __future__ import annotations

import time
from dataclasses import replace

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import autosync, events_ingest


def test_summary_reflects_cached_states(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    r = c.get("/api/v1/health/summary")
    assert r.status_code == 200, r.text
    body = r.json()
    ids_ = {i["id"]: i for i in body["items"]}
    assert ids_["nvr"]["status"] == "warn" and body["status"] == "warn", "no NVR configured is a warning, not a failure"
    assert ids_["backups"]["status"] == "warn"
    assert c.post("/api/v1/backups", json={}).status_code == 201
    assert "backups" not in {i["id"] for i in c.get("/api/v1/health/summary").json()["items"]}
    # every signed-in user may read it (the pill is in the top bar)
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    assert c.get("/api/v1/health/summary", headers=as_user("ron")).status_code == 200

    # with an NVR configured and the alert stream down for over a minute, the summary is an error
    app2 = create_app(replace(settings, nvr_host="nvr.example", nvr_user="viewer", nvr_password="pw"))
    c2 = TestClient(app2)
    st = events_ingest.STATE
    saved = (st.connected, st.disconnected_since, st.last_heartbeat_at, dict(autosync.STATE))
    try:
        st.connected = False
        st.disconnected_since = time.time() - 120
        st.last_heartbeat_at = "2026-09-16T00:00:00Z"
        autosync.STATE["cameras_last_error"] = "timeout"
        autosync.STATE["cameras_last_ok"] = "2026-09-16T00:00:00Z"
        body2 = c2.get("/api/v1/health/summary").json()
        kinds = {i["id"]: i["status"] for i in body2["items"]}
        assert body2["status"] == "error" and kinds["nvr"] == "error" and kinds["discovery"] == "warn"
        assert "מנותק" in next(i["label"] for i in body2["items"] if i["id"] == "nvr")
    finally:
        st.connected, st.disconnected_since, st.last_heartbeat_at = saved[0], saved[1], saved[2]
        autosync.STATE.clear()
        autosync.STATE.update(saved[3])
