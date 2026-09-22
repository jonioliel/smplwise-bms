"""The janitor's housekeeping pass runs end to end. It died silently on a missing import from 0.1.30 to 0.1.37
(audit and HA-history pruning and the periodic discovery never ran), which only a test that executes the pass
can guard."""
from __future__ import annotations

import datetime as dt

from fastapi.testclient import TestClient

from smplwise.main import create_app, janitor_tick


def test_janitor_tick_runs_every_step(settings):
    app = create_app(settings)
    janitor_tick(app.state.db, settings)  # every name in the chain resolves and every prune tolerates an empty install
    janitor_tick(app.state.db, settings)  # and it is repeatable


def test_audit_retention_setting_controls_pruning(settings):
    """T055: audit retention used to be a fixed 365-day constant; it is a setting now, and the janitor's own
    pass (not just audit.prune called directly) has to actually use the configured value."""
    app = create_app(settings)
    c = TestClient(app)
    old_at = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=40)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO audit_log(at, actor_user_id, actor_username, action, resource_type, resource_id, decision, reason, request_id, permission_revision, details_json) "
            "VALUES (?, 'u1', 'joni', 'test.old_row', 'test', 'r1', 'allowed', NULL, NULL, 1, NULL)",
            (old_at,),
        )

    # default retention (365 days): a 40-day-old row must survive a real janitor pass
    assert c.get("/api/v1/settings").json()["settings"]["audit.retention_days"] == 365
    janitor_tick(app.state.db, settings)
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) c FROM audit_log WHERE action = 'test.old_row'").fetchone()["c"] == 1

    # shorten retention below the row's age: the same row must not survive the next pass
    assert c.patch("/api/v1/settings", json={"audit.retention_days": 30}).status_code == 200
    assert c.get("/api/v1/settings").json()["settings"]["audit.retention_days"] == 30
    janitor_tick(app.state.db, settings)
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) c FROM audit_log WHERE action = 'test.old_row'").fetchone()["c"] == 0

    # out-of-range values are rejected, not silently clamped
    assert c.patch("/api/v1/settings", json={"audit.retention_days": 10}).status_code == 422
    assert c.patch("/api/v1/settings", json={"audit.retention_days": 5000}).status_code == 422
