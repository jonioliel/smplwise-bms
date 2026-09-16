"""T042: the browser's measured sync (|drift| p95 against a master clock, per member) is kept on the playback group
for the session's evidence; only the group's owner reports, values are validated, nothing is seeked by the report."""
from __future__ import annotations

import datetime as dt

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import playback_groups as pg


def test_sync_report_kept_on_group(settings):
    app = create_app(settings)
    c = TestClient(app)
    c.get("/api/v1/me")
    pg.GROUPS["grp-test"] = pg.PlaybackGroup(id="grp-test", user_id="dev-joni", requested_at=dt.datetime(2026, 9, 16, 8, 0, tzinfo=dt.timezone.utc))
    try:
        assert c.get("/api/v1/playback/groups/grp-test").json()["sync_report"] is None
        assert c.post("/api/v1/playback/groups/grp-test/sync", json={"quality": "great", "samples": 3}).status_code == 422
        assert c.post("/api/v1/playback/groups/grp-test/sync", json={"quality": "synced", "p95_s": -1}).status_code == 422
        body = {
            "p95_s": 0.31, "quality": "synced", "samples": 24, "partial": False,
            "members": {"cam-a": {"p95": 0.31, "samples": 12, "last": 0.1, "resyncs": 0, "state": "measured"}, "cam-b": {"p95": 0.2, "samples": 12, "last": -0.05, "resyncs": 1, "state": "measured"}},
        }
        r = c.post("/api/v1/playback/groups/grp-test/sync", json=body)
        assert r.status_code == 200, r.text
        assert r.json()["sync_report"]["p95_s"] == 0.31
        got = c.get("/api/v1/playback/groups/grp-test").json()
        assert got["sync"] == "best_effort" and got["generation"] == 0, "the report never seeks or bumps the group"
        assert got["sync_report"]["quality"] == "synced" and got["sync_report"]["members"]["cam-b"]["resyncs"] == 1 and got["sync_report"]["reported_at"].endswith("Z")
        # a later, worse measurement replaces the earlier one; a partial group says so
        r = c.post("/api/v1/playback/groups/grp-test/sync", json={**body, "p95_s": 2.6, "quality": "out_of_sync", "partial": True, "members": {"cam-a": {**body["members"]["cam-a"], "state": "late"}}})
        assert r.json()["sync_report"]["quality"] == "out_of_sync" and r.json()["sync_report"]["partial"] is True
        # only the owner (or a system administrator) reports; an unknown group is 404
        bind(c, settings, "ron", "operator", "installation", "*")
        assert c.post("/api/v1/playback/groups/grp-test/sync", json=body, headers=as_user("ron")).status_code == 403
        assert c.post("/api/v1/playback/groups/nope/sync", json=body).status_code == 404
    finally:
        pg.GROUPS.pop("grp-test", None)
