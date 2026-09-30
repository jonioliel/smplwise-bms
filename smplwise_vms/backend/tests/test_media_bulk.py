"""CR-015 decisions 7a / 8a: "כבה מסכים" of one floor or area from the screens page (`/multimedia/actions`) and the devices area's screens
kinds - approved screens only, their POWER endpoint only, only screens confirmed on (or in art mode), an honest per-screen outcome, never a
receiver, never the building."""
from __future__ import annotations

import datetime as dt
import json
from typing import Any

import media_seed as seed
import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import now_iso
from smplwise.main import create_app
from smplwise.services import device_bulk, ha_actions, ha_sync, media_commands

UP = "/api/v1/multimedia/actions"


@pytest.fixture()
def m(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    seed.install(c)
    seed.approve_all(c)
    monkeypatch.setattr(ha_actions, "CONFIRM_WINDOW_S", 1.5)
    monkeypatch.setattr(device_bulk, "POLL_S", 0.1)
    device_bulk.RUNNER.clear()
    media_commands.BUCKETS.clear()
    effects = {"apply": True}

    def result(payload):
        if effects["apply"] and payload["service"] == "turn_off":
            eid = payload["data"]["entity_id"]
            with app.state.db.connection() as conn:
                row = conn.execute("SELECT attributes_json FROM ha_entities WHERE entity_id = ?", (eid,)).fetchone()
                now = now_iso()
                ha_sync.upsert_state(conn, {"entity_id": eid, "state": "off", "attributes": json.loads(row["attributes_json"] or "{}"), "last_changed": now, "last_updated": now})
        return {"ok": True, "context_id": "ctx"}

    calls = seed.pair(c, monkeypatch, result=result)
    yield app, c, calls, settings, effects
    device_bulk.RUNNER.clear()


def body(scope: str, id_: str, **kw: Any) -> dict[str, Any]:
    expires = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"scope": scope, "id": id_, "kind": "screens_off", "confirmed": True, "client_request_id": kw.pop("client_request_id", "bulk-req-" + str(abs(hash(str(kw) + id_)))[:10] + scope), "expires_at": expires, **kw}


def finish(c, bulk_id: str, headers=None) -> dict[str, Any]:
    assert device_bulk.RUNNER.wait(bulk_id, 20), "the bulk worker did not end"
    return c.get(f"/api/v1/devices/actions/{bulk_id}", headers=headers or {}).json()


def audit(app, action: str) -> list[dict[str, Any]]:
    with app.state.db.connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]
    for r in rows:
        r["details"] = json.loads(r["details_json"] or "{}")
    return rows


def test_the_preview_says_what_would_be_sent_per_screen(m):
    app, c, calls, settings, _ = m
    p = c.get(f"{UP}/preview", params={"scope": "floor", "id": "ground"}).json()
    assert p["scope"] == "floor" and p["id"] == "ground" and p["label"] == "קומת קרקע"
    will = {d["name"]: (d["will"], d["reason"]) for d in p["devices"]}
    assert will == {"טלוויזיה סלון": ("off", None), "טלוויזיה מטבח": ("skip", "already_off"), "מסך כללי": ("off", None)}
    assert p["counts"] == {"send": 2, "already_off": 1, "not_confirmed": 0, "unavailable": 0, "not_allowed": 0}
    up = c.get(f"{UP}/preview", params={"scope": "floor", "id": "upper"}).json()
    assert up["counts"] == {"send": 2, "already_off": 0, "not_confirmed": 0, "unavailable": 1, "not_allowed": 0}
    assert {d["name"]: d["reason"] for d in up["devices"]}["מסך מחסן"] == "unavailable"
    area = c.get(f"{UP}/preview", params={"scope": "area", "id": "kitchen"}).json()
    assert area["label"] == "מטבח" and {d["name"] for d in area["devices"]} == {"טלוויזיה מטבח", "מסך כללי"} and area["counts"]["send"] == 1
    assert c.get(f"{UP}/preview", params={"scope": "area", "id": "living"}).json()["counts"]["send"] == 1, "the receiver in the living room is not a screen"
    assert [set(d) for d in p["devices"]] == [{"key", "name", "will", "reason"}] * 3, "no entity ids in the preview"


def test_a_screen_not_confirmed_on_is_skipped_and_art_mode_is_sent(m):
    app, c, calls, settings, effects = m
    effects["apply"] = False  # the TV accepts the command but has not reported yet
    key = seed.key_of(c, "media_player.tv_living")
    assert seed.send(c, key, "power_off").status_code == 202  # our own command: the state is not confirmed yet
    p = c.get(f"{UP}/preview", params={"scope": "area", "id": "living"}).json()
    assert p["devices"][0]["reason"] == "not_confirmed" and p["counts"]["not_confirmed"] == 1
    # art mode: the TV reports on, in art mode - confirmed, and "off" is what the owner means by it
    with app.state.db.connection() as conn:
        conn.execute("UPDATE media_commands SET created_ms = 1")  # the command is long past
    seed.set_state(c, "media_player.tv_living", "on", art_mode_status="on")
    assert c.get(f"{UP}/preview", params={"scope": "area", "id": "living"}).json()["devices"][0]["will"] == "off"


def test_the_preview_refuses_the_building_unknown_scopes_and_missing_permission(m):
    app, c, calls, settings, _ = m
    r = c.get(f"{UP}/preview", params={"scope": "building", "id": "*"})
    assert (r.status_code, r.json()["code"]) == (422, "validation"), "7b was not taken: no building-wide off"
    assert c.get(f"{UP}/preview", params={"scope": "floor", "id": "attic"}).status_code == 404
    assert c.get(f"{UP}/preview", params={"scope": "area"}).status_code == 422
    for name, role in (("olga", "operator"), ("vera", "viewer")):
        bind(c, settings, name, role, "installation", "*")
        r = c.get(f"{UP}/preview", params={"scope": "floor", "id": "ground"}, headers=as_user(name))
        assert (r.status_code, r.json()["code"]) == (403, "forbidden"), name
    assert c.get(f"{UP}/preview", params={"scope": "floor", "id": "ground"}, headers=as_user("nobody")).status_code == 403
    bind(c, settings, "sam", "site_admin", "installation", "*")
    assert c.get(f"{UP}/preview", params={"scope": "floor", "id": "ground"}, headers=as_user("sam")).status_code == 200


def test_running_it_sends_turn_off_to_the_power_endpoint_of_screens_confirmed_on_and_reports_each_outcome(m):
    app, c, calls, settings, _ = m
    r = c.post(UP, json=body("floor", "ground"))
    assert r.status_code == 202, r.text
    bulk_id = r.json()["bulk_id"]
    assert r.json()["status"] in ("sending", "waiting", "done")
    out = finish(c, bulk_id)
    assert sorted((p["domain"], p["service"], p["data"]["entity_id"]) for p in calls) == [("media_player", "turn_off", "media_player.generic_tv"), ("media_player", "turn_off", "media_player.tv_living")], \
        "only power endpoints of the screens that were on - never the Cast / SmartThings copies, the remote, the off kitchen TV or the receiver"
    assert all(p["user_id"] == "dev-joni" for p in calls)
    assert out["done"] is True and out["origin"] == "media" and out["counts"]["confirmed"] == 2 and out["counts"]["total"] == 2
    assert {i["entity_id"]: i["outcome"] for i in out["items"]} == {"media_player.generic_tv": "confirmed", "media_player.tv_living": "confirmed"}
    attempt, outcome = [r for r in audit(app, "media.bulk") if r["details"].get("phase") in ("attempt", "outcome")]
    assert attempt["details"]["phase"] == "attempt" and attempt["details"]["device_count"] == 2 and len(attempt["details"]["device_keys"]) == 2 and attempt["resource_type"] == "devices_floor"
    assert outcome["details"]["phase"] == "outcome" and outcome["details"]["counts"]["confirmed"] == 2
    assert audit(app, "devices.bulk") == [], "the outcome row carries the media action name"
    # the per-screen records are ordinary action records linked to the bulk
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ha_actions WHERE bulk_id = ? AND via = 'bulk'", (bulk_id,)).fetchone()[0] == 2


def test_an_honest_outcome_when_a_screen_does_not_report_off(m):
    app, c, calls, settings, effects = m
    effects["apply"] = False
    bulk_id = c.post(UP, json=body("area", "living")).json()["bulk_id"]
    out = finish(c, bulk_id)
    assert out["counts"]["not_confirmed"] == 1 and out["counts"]["confirmed"] == 0 and out["all_confirmed"] is False
    assert [r for r in audit(app, "media.bulk") if r["details"].get("phase") == "outcome"][0]["reason"] == "none_confirmed"


def test_the_request_envelope_confirmation_digest_and_nothing_to_do_are_enforced_and_audited(m):
    app, c, calls, settings, _ = m
    assert c.post(UP, json=body("floor", "ground", confirmed=None)).json()["code"] == "confirmation_required"
    assert c.post(UP, json=body("floor", "ground", confirmed="true")).json()["code"] == "confirmation_required"
    past = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    assert c.post(UP, json=body("floor", "ground", expires_at=past)).json()["code"] == "expired"
    assert c.post(UP, json=body("building", "*")).status_code == 422
    assert c.post(UP, json={**body("floor", "ground"), "kind": "lights_off"}).status_code == 422
    assert c.post(UP, json={**body("floor", "ground"), "surprise": 1}).status_code == 422
    assert c.post(UP, data="scope=floor", headers={"content-type": "text/plain"}).status_code == 415
    assert c.post(UP, json=body("floor", "attic")).status_code == 404
    assert c.post(UP, json=body("floor", "ground", preview_digest="0" * 16)).json()["code"] == "target_changed"
    assert calls == [], "every refusal above sent nothing"
    denied = [r for r in audit(app, "media.bulk") if r["decision"] == "denied"]
    assert len(denied) >= 8 and all(r["details"]["outcome"] == "not_sent" for r in denied)
    # nothing to do: every screen of the scope is already off
    seed.set_state(c, "media_player.generic_tv", "off")
    assert c.post(UP, json=body("area", "kitchen")).json()["code"] == "nothing_to_do"


def test_the_same_request_id_never_runs_twice(m):
    app, c, calls, settings, _ = m
    b = body("area", "living", client_request_id="bulk-idem-0001")
    first = c.post(UP, json=b)
    assert first.status_code == 202
    second = c.post(UP, json=b)
    assert (second.status_code, second.json()["code"]) == (409, "duplicate_command")
    finish(c, first.json()["bulk_id"])
    assert len(calls) == 1


def test_a_second_bulk_on_the_same_screens_is_refused_while_the_first_runs(m):
    app, c, calls, settings, effects = m
    effects["apply"] = False
    first = c.post(UP, json=body("area", "living", client_request_id="bulk-one-0001"))
    assert first.status_code == 202
    second = c.post(UP, json=body("floor", "ground", client_request_id="bulk-two-0002"))
    assert second.status_code == 409 and second.json()["code"] == "bulk_in_progress"
    finish(c, first.json()["bulk_id"])


def test_bridge_not_paired_is_refused_before_anything_is_recorded(settings):
    app = create_app(settings)
    c = TestClient(app)
    seed.install(c)
    seed.approve_all(c)
    r = c.post(UP, json=body("area", "living"))
    assert (r.status_code, r.json()["code"]) == (503, "bridge_not_paired")
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM device_bulk_actions").fetchone()[0] == 0


def test_the_bulk_permission_is_needed_at_each_screens_anchor(m):
    app, c, calls, settings, _ = m
    ids = seed_tree(c)
    for fid in (ids["floor2"], ids["floor3"]):
        asset = c.post(f"/api/v1/floors/{fid}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
        v = c.post(f"/api/v1/floors/{fid}/plan-versions", json={"asset_id": asset["id"]}).json()
        c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    place = lambda fid, eid: c.post(f"/api/v1/floors/{fid}/anchors", json={"resource_type": "ha_entity", "resource_id": eid, "x": 0.2, "y": 0.2}).status_code  # noqa: E731
    assert place(ids["floor2"], "media_player.tv_living") == 201 and place(ids["floor3"], "media_player.generic_tv") == 201
    # a floor-2 administrator: sees and switches off only the screen placed on their floor, in the HA floor "ground" that holds both
    bind(c, settings, "flo", "site_admin", "floor", ids["floor2"])
    flo = as_user("flo")
    p = c.get(f"{UP}/preview", params={"scope": "floor", "id": "ground"}, headers=flo).json()
    assert [d["name"] for d in p["devices"]] == ["טלוויזיה סלון"] and p["counts"]["send"] == 1, "the other screen is not even listed"
    bulk_id = c.post(UP, json=body("floor", "ground"), headers=flo).json()["bulk_id"]
    finish(c, bulk_id, headers=flo)
    assert [x["data"]["entity_id"] for x in calls] == ["media_player.tv_living"]
    # read without bulk on the screen: listed as not_allowed for someone who holds media.bulk elsewhere
    bind(c, settings, "mix", "site_admin", "floor", ids["floor3"])
    role = c.post("/api/v1/access/roles", json={"name": "צפייה בקומה 2", "permissions": ["media.read"]}).json()["id"]
    bind(c, settings, "mix", role, "floor", ids["floor2"])
    p = c.get(f"{UP}/preview", params={"scope": "floor", "id": "ground"}, headers=as_user("mix")).json()
    by = {d["name"]: d for d in p["devices"]}
    assert by["טלוויזיה סלון"]["reason"] == "not_allowed" and by["מסך כללי"]["will"] == "off" and p["counts"]["not_allowed"] == 1


# ------------------------------------------------------------------------------------------------ decision 8a: the devices area


def test_the_devices_areas_screens_kinds_reach_approved_screens_only(m):
    app, c, calls, settings, _ = m
    p = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "screens_off"}).json()
    assert sorted(t["entity_id"] for t in p["targets"]) == ["media_player.generic_tv", "media_player.lg_office", "media_player.tv_bedroom", "media_player.tv_living"]
    assert {t["action_id"] for t in p["targets"]} == {"media_player.turn_off"}
    assert p["skipped"] == {"already": 1, "unavailable": 1}, "the kitchen TV is off, the second LG is unavailable"
    assert not any("cast" in t["entity_id"] or "receiver" in t["entity_id"] or t["entity_id"].startswith("remote.") or t["entity_id"].endswith(("_st", "_ma")) for t in p["targets"])
    assert p["excluded"] == [] or all(x["reason"] in ("not_a_screen", "screen_not_approved") for x in p["excluded"])


def test_unclassified_and_unapproved_players_are_listed_as_not_included(m):
    app, c, calls, settings, _ = m
    seed.set_state(c, "media_player.lobby_box", "on", friendly_name="Lobby box", supported_features=seed.TURN_ON | seed.TURN_OFF)
    reg = [*seed.ENTITY_REGISTRY, {"entity_id": "media_player.lobby_box", "id": "reg-box", "platform": "unknownbrand", "device_id": "d_box", "unique_id": "u-box"}]
    devices = [*seed.DEVICES, {"id": "d_box", "name": "Lobby box", "area_id": "living", "connections": [], "identifiers": []}]
    assert c.post("/api/v1/ha/dev/registry", json={"entities": reg, "devices": devices, "areas": seed.AREAS, "floors": seed.FLOORS}).status_code == 200
    p = c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "living", "kind": "screens_off"}).json()
    assert [t["entity_id"] for t in p["targets"]] == ["media_player.tv_living"]
    assert [(x["entity_id"], x["reason"], x["reason_label"]) for x in p["excluded"]] == [("media_player.lobby_box", "not_a_screen", "לא מוגדר כמסך")]
    # withdraw the approval of the living room TV: it is a detected screen nobody approved
    key = seed.key_of(c, "media_player.tv_living")
    c.put(f"/api/v1/multimedia/admin/devices/{key}", json={"approved": False})
    p = c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "living", "kind": "all_off"}).json()
    assert p["targets"] == [] and {x["entity_id"]: x["reason"] for x in p["excluded"]} == {"media_player.lobby_box": "not_a_screen", "media_player.tv_living": "screen_not_approved"}
    # screens_on is limited the same way
    seed.set_state(c, "media_player.tv_kitchen", "off")
    on = c.get("/api/v1/devices/actions/preview", params={"scope": "floor", "id": "ground", "kind": "screens_on"}).json()
    assert [t["entity_id"] for t in on["targets"]] == ["media_player.tv_kitchen"] and all(t["action_id"] == "media_player.turn_on" for t in on["targets"])


def test_the_devices_area_bulk_runs_through_the_same_engine_with_its_own_audit_name(m):
    app, c, calls, settings, _ = m
    r = c.post("/api/v1/devices/actions", json={"scope": "area", "id": "living", "kind": "screens_off", "confirmed": True, "client_request_id": "dev-bulk-0001",
                                               "expires_at": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=30)).strftime("%Y-%m-%dT%H:%M:%SZ")})
    assert r.status_code == 202, r.text
    out = finish(c, r.json()["id"])
    assert out["origin"] == "devices" and [x["data"]["entity_id"] for x in calls] == ["media_player.tv_living"]
    assert [r["details"].get("phase") for r in audit(app, "devices.bulk")] == ["attempt", "outcome"] and audit(app, "media.bulk") == []


def test_media_managed_rows_are_read_only_in_the_devices_area(m):
    app, c, calls, settings, _ = m
    area = c.get("/api/v1/devices/areas/living").json()
    rows = {r["entity_id"]: r for r in area["cards"]["media"]["entities"]}
    assert rows["media_player.tv_living"]["media_managed"] is True and rows["media_player.tv_living"]["can_control"] is False
    assert rows["media_player.receiver_living"]["can_control"] is True and "media_managed" not in rows["media_player.receiver_living"]
    items = c.get("/api/v1/devices/items", params={"kind": "media", "scope": "building"}).json()
    flat = {i["entity_id"]: i for f in items["floors"] for a in f["areas"] for i in a["items"]}
    assert flat["media_player.tv_living"]["media_managed"] is True and flat["media_player.tv_living"]["can_control"] is False and flat["media_player.receiver_living"]["can_control"] is True
