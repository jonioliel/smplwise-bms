"""Health report (T033): one check per subsystem with its own status; unconfigured devices are 'warn', not
failures; storage and database numbers are real; a backup turns the backups check green; admins only."""
from __future__ import annotations

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app

EXPECTED = ["db", "storage", "nvr", "go2rtc", "ha_sync", "bridge", "events_ingest", "events_derive", "discovery", "thumbnails", "exports", "sessions", "backups"]


def test_health_report_shape_statuses_and_permissions(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    r = c.get("/api/v1/health/report")
    assert r.status_code == 200, r.text
    body = r.json()
    checks = {x["id"]: x for x in body["checks"]}
    assert [x["id"] for x in body["checks"]] == EXPECTED
    assert body["version"] and body["uptime_s"] >= 0 and body["checked_at"].endswith("Z")
    assert checks["db"]["status"] == "ok" and "WAL" in checks["db"]["detail"]
    assert checks["storage"]["status"] in ("ok", "warn", "error") and checks["storage"]["meta"]["total"] > 0 and "פנוי" in checks["storage"]["detail"]
    for dev in ("nvr", "go2rtc", "ha_sync", "events_ingest"):
        assert checks[dev]["status"] == "warn" and checks[dev]["meta"].get("configured") is False, dev
    assert checks["backups"]["status"] == "error" and checks["backups"]["meta"]["count"] == 0
    def worst(checks_list):
        st = [c["status"] for c in checks_list]
        return "error" if "error" in st else "warn" if "warn" in st else "ok"

    assert body["status"] == worst(body["checks"]) == "error", "the worst check drives the overall status"
    # a backup makes that check green (and the overall status is then the worst of the rest)
    assert c.post("/api/v1/backups", json={"note": "health"}).status_code == 201
    body2 = c.get("/api/v1/health/report").json()
    b = next(x for x in body2["checks"] if x["id"] == "backups")
    assert b["status"] == "ok" and b["meta"]["count"] == 1 and b["meta"]["last_kind"] == "manual"
    assert body2["status"] == worst(body2["checks"])  # background-job states are process-wide and may carry over from other tests
    # probes are cached: the second call within the TTL keeps the same nvr detail
    assert next(x for x in body2["checks"] if x["id"] == "nvr")["detail"] == checks["nvr"]["detail"]
    # only system administrators read the report; the plain /health stays available to any signed-in user
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    assert c.get("/api/v1/health/report", headers=as_user("ron")).status_code == 403
    assert c.get("/api/v1/health", headers=as_user("ron")).status_code == 200
