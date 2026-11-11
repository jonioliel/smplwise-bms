"""HOME-V3-P3-2432: the home interface, phase 3 of mockup v3 (music and screens, announcements, the electricity bill, water, the house
systems view and the home map). No new route and no new table: the home interface reads and controls through the existing routes, so
what is tested here is the server half - the six new categories an administrator can hide, and the home-only gate letting a home-only
person reach exactly those routes (and none of the administrative / emergency ones next to them), while every route still checks its
own permission (the gate never grants)."""
from __future__ import annotations

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.services import home_interface as hi
from test_home_interface import app  # noqa: F401  (the same app fixture: rooms, floors and entities)

P3 = ("media", "announce", "bills", "water", "systems", "map")

# what the phase 3 screens call (method is not the gate's business: each route checks its own permission)
ALLOWED = (
    "/api/v1/multimedia/status", "/api/v1/multimedia/devices", "/api/v1/multimedia/devices/tv.living", "/api/v1/multimedia/devices/tv.living/commands",
    "/api/v1/multimedia/devices/sp.kitchen/artwork", "/api/v1/multimedia/devices/sp.kitchen/library", "/api/v1/multimedia/groups",
    "/api/v1/multimedia/groups/join", "/api/v1/multimedia/groups/leave",
    "/api/v1/announcements", "/api/v1/announcements/areas",
    "/api/v1/energy/accounts", "/api/v1/energy/accounts/acc1/status", "/api/v1/energy/accounts/acc1/periods",
    "/api/v1/infra/water/status", "/api/v1/infra/water/meters", "/api/v1/infra/water/consumption", "/api/v1/infra/water/events/summary",
    "/api/v1/generator/devices/live", "/api/v1/infra/elevators", "/api/v1/infra/temperature",
)
# the administrative, emergency and write routes next to them stay closed to a home-only person
REFUSED = (
    "/api/v1/announcements/emergency", "/api/v1/announcements/config", "/api/v1/announcements/templates", "/api/v1/announcements/test",
    "/api/v1/announcements/history", "/api/v1/announcements/translate", "/api/v1/announcements/a1/screens/stop",
    "/api/v1/multimedia/layout", "/api/v1/multimedia/remote-default", "/api/v1/multimedia/devices/tv.living/remote", "/api/v1/multimedia/admin/devices",
    "/api/v1/multimedia/admin/approve", "/api/v1/multimedia/actions", "/api/v1/multimedia/groups/presets", "/api/v1/multimedia/devices/tv.living/queue",
    "/api/v1/multimedia/devices/tv.living/commands/x",
    "/api/v1/energy/accounts/acc1", "/api/v1/energy/accounts/acc1/bills", "/api/v1/energy/accounts/acc1/history", "/api/v1/energy/bills",
    "/api/v1/energy/customers", "/api/v1/energy/billing-settings",
    "/api/v1/infra/water/settings", "/api/v1/infra/water/meters/m1", "/api/v1/infra/water/candidates", "/api/v1/infra/water/events",
    "/api/v1/generator/devices", "/api/v1/generator/devices/g1", "/api/v1/generator/settings", "/api/v1/generator/devices/detect", "/api/v1/generator/alerts",
    "/api/v1/infra/elevators/manage", "/api/v1/infra/elevators/e1", "/api/v1/infra/temperature/manage", "/api/v1/infra/temperature/settings",
    "/api/v1/infra/temperature/report.pdf",
)


def _client(app) -> TestClient:  # noqa: F811
    c = TestClient(app[0])
    assert c.get("/api/v1/me").status_code == 200
    return c


def test_the_six_new_categories_are_known_and_on_by_default(app):  # noqa: F811
    assert all(m in hi.MODULES for m in P3)
    assert hi.MODULES[: len(hi.MODULES) - len(P3)] == ("lights", "climate", "shades", "doors", "cameras", "energy", "alerts", "scenes", "security")
    c = _client(app)
    assert set(P3) <= set(c.get("/api/v1/home/overview").json()["modules"])
    assert set(P3) <= set(c.get("/api/v1/home/policies").json()["modules"])


def test_an_administrator_can_hide_a_new_category(app):  # noqa: F811
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    r = c.put("/api/v1/home/policies/dev-dana", json={"modules": ["lights", "media", "map"]})
    assert r.status_code == 200 and r.json()["modules"] == ["lights", "media", "map"]
    mods = set(c.get("/api/v1/home/overview", headers=as_user("dana")).json()["modules"])
    assert mods == {"lights", "media", "map"}
    assert c.put("/api/v1/home/policies/dev-dana", json={"modules": ["lights", "radio"]}).status_code == 422


def test_gate_lets_a_home_only_person_reach_the_phase_3_routes_only():
    for p in ALLOWED:
        assert hi.home_allowed(p), p
        assert hi.home_allowed(p + "/"), p  # a trailing slash is the same route
    for p in REFUSED:
        assert not hi.home_allowed(p), p
    # whole-path patterns only: no substring and no extra segment
    assert not hi.home_allowed("/api/v1/multimedia/devices/a/b/commands")
    assert not hi.home_allowed("/api/v1/multimedia/devicesx")
    assert not hi.home_allowed("/api/v1/energy/accounts/a/status/x")
    assert not hi.home_allowed("/api/v1/multimedia/devices/../admin/devices")


def test_home_only_person_reaches_the_reads_and_the_permission_still_decides(app):  # noqa: F811
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    assert c.put("/api/v1/home/policies/dev-dana", json={"home_only": True}).status_code == 200
    h = as_user("dana")
    # the reads the screens use answer (whatever the module says, it is never the home gate)
    for path in ("/api/v1/multimedia/status", "/api/v1/infra/water/status", "/api/v1/infra/elevators", "/api/v1/infra/temperature", "/api/v1/generator/devices/live"):
        res = c.get(path, headers=h)
        assert res.status_code != 403 or res.json().get("code") != "home_interface_only", path
    # an operator does not hold media.announce or energy.bills: the gate lets the call through and the route refuses it on its permission
    res = c.get("/api/v1/announcements/areas", headers=h)
    assert res.status_code == 403 and res.json()["code"] != "home_interface_only"
    res = c.post("/api/v1/announcements", headers=h, json={"scope": "all", "ref": "*", "text": "ארוחת ערב"})
    assert res.status_code == 403 and res.json()["code"] != "home_interface_only"
    # the emergency announcement and the setup stay full-interface only, even for a person who holds the permission
    res = c.post("/api/v1/announcements/emergency", headers=h, json={"text": "x"})
    assert res.status_code == 403 and res.json()["code"] == "home_interface_only"
    for path in ("/api/v1/announcements/config", "/api/v1/multimedia/layout", "/api/v1/generator/settings", "/api/v1/infra/elevators/manage", "/api/v1/energy/bills"):
        res = c.get(path, headers=h)
        assert res.status_code == 403 and res.json()["code"] == "home_interface_only", path


def test_home_only_announcer_may_announce_but_never_the_emergency_one(app):  # noqa: F811
    c = _client(app)
    bind(c, app[1], "rona", "announcer", "installation", "*")
    assert c.put("/api/v1/home/policies/dev-rona", json={"home_only": True}).status_code == 200
    h = as_user("rona")
    res = c.get("/api/v1/announcements/areas", headers=h)
    assert res.status_code == 200 and "areas" in res.json()  # announcements are off in a fresh installation: enabled False, no areas
    res = c.post("/api/v1/announcements/emergency", headers=h, json={"text": "x"})
    assert res.status_code == 403 and res.json()["code"] == "home_interface_only"


def test_a_person_not_home_only_is_not_affected(app):  # noqa: F811
    c = _client(app)
    bind(c, app[1], "dana", "operator", "installation", "*")
    res = c.get("/api/v1/generator/settings", headers=as_user("dana"))
    assert res.status_code != 403 or res.json().get("code") != "home_interface_only"
