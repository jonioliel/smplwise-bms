"""TKMAP1 (owner 16.10) - a map element attached to a service request: the manager API (attach / detach / get, who may, which
elements), the vendor page's block and the server-drawn picture on the PUBLIC listener (services/tickets/map_element.py, map_image.py,
routers/tickets_map.py, public_routes `/t/api/map-image`).

Negative cases first: no token, a wrong token, an expired / revoked link, a code-protected link without its session, nothing
attached, an element that left the map - all the uniform 404 (or 403 code_required) - and the picture's bytes carry no other object,
no camera, no free plan label, no id. Fakes only: the floor's plan version, its published structure document, rooms and anchors are
written straight into the test database (invented names)."""
from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
import sqlite3
import time
import uuid

import pytest

from smplwise.services.tickets import map_element, map_image
from smplwise.services.tickets.public_http import ROUTES, UNIFORM_404
from tickets_s4_world import API, Clock, build_s4

PV = "pv-mapone-0001"
VAULT = "חדר-כספות-רגיש"
SECRETS = ("מצלמה-סודית-אחרת", "כיסא-נסתר-7", "תווית-חופשית-סודית", "מדרגות-לקומה-סודית", "חדר-בקומה-3-סודי", "obj-secret-cam-77",
           "obj-chair-88", "wall-alpha-777", "zone-id-office-9", "a-other-cam-55", "label-free-66", "conn-stairs-44", PV, "cam-other-2",
           "camera.secret", "data-", VAULT)


def hdr(token: str, session: str | None = None) -> dict[str, str]:
    h = {"x-ticket-token": token}
    if session:
        h["x-ticket-session"] = session
    return h


def raw(settings) -> sqlite3.Connection:
    conn = sqlite3.connect(settings.db_path, isolation_level=None)
    conn.execute("PRAGMA foreign_keys=OFF")
    return conn


DOC = {
    "schema_version": 2, "plan_version_id": PV, "dimensions": {"width_px": 1000, "height_px": 800, "scale_m_per_px": 0.01,
                                                               "calibration": {"status": "measured"}},
    "levels": [{"id": "L0", "name": "ראשי", "elevation_m": 0.0, "is_default": True}, {"id": "L1", "name": "גלריה", "elevation_m": 3.0, "is_default": False}],
    "walls": [
        {"id": "wall-alpha-777", "level_id": "L0", "polyline": [[0.1, 0.1], [0.9, 0.1]], "thickness_m": 0.2},
        {"id": "wb", "level_id": "L0", "polyline": [[0.9, 0.1], [0.9, 0.9]], "thickness_m": 0.2},
        {"id": "wc", "level_id": "L0", "polyline": [[0.1, 0.9], [0.9, 0.9]], "thickness_m": 0.2, "kind": "window_wall"},
        {"id": "wl1", "level_id": "L1", "polyline": [[0.2, 0.2], [0.3, 0.3]], "thickness_m": 0.2},
    ],
    "openings": [
        {"id": "od", "wall_id": "wall-alpha-777", "t": 0.5, "kind": "door", "width_m": 0.9, "swing": "right", "hinge": "start"},
        {"id": "ow", "wall_id": "wb", "t": 0.5, "kind": "window", "width_m": 1.2},
        {"id": "op", "wall_id": "wc", "t": 0.3, "kind": "passage", "width_m": 1.0},
    ],
    "objects": [
        {"id": "obj-secret-cam-77", "item_id": "camera.dome", "level_id": "L0", "position": [0.7, 0.3], "rotation_deg": 0,
         "size": {"w_m": 0.3, "d_m": 0.3}, "label": "מצלמה-סודית-אחרת", "anchor_ref": None},
        {"id": "obj-chair-88", "item_id": "chair.basic", "level_id": "L0", "position": [0.3, 0.6], "rotation_deg": 0,
         "size": {"w_m": 0.45, "d_m": 0.45}, "label": "כיסא-נסתר-7", "anchor_ref": None},
        {"id": "obj-boiler-1", "item_id": "box", "level_id": "L0", "position": [0.4, 0.4], "rotation_deg": 0, "size": {"w_m": 0.5, "d_m": 0.5},
         "label": "דוד מים", "anchor_ref": None},
    ],
    "connectors": [{"id": "conn-stairs-44", "kind": "stairs", "polyline": [[0.5, 0.5], [0.6, 0.5]], "width_m": 1.0, "label": "מדרגות-לקומה-סודית",
                    "level_from": "L0", "level_to": "L1"}],
    "labels": [{"id": "label-free-66", "text": "תווית-חופשית-סודית", "position": [0.5, 0.7], "level_id": "L0", "size": 14}],
    "circuits": [], "rooms": [], "groups": [],
}


def box(x0: float, y0: float, x1: float, y1: float) -> str:
    return json.dumps([{"x": x0, "y": y0}, {"x": x1, "y": y0}, {"x": x1, "y": y1}, {"x": x0, "y": y1}])


def seed_map(s4) -> dict[str, str]:
    f2, f3 = s4.w.floors["floor2"], s4.w.floors["floor3"]
    now = "2026-10-16T08:00:00Z"
    conn = raw(s4.w.settings)
    conn.execute("INSERT INTO plan_versions(id, floor_id, asset_id, width_px, height_px, image_path, status, created_at) VALUES (?,?,?,?,?,?,?,?)",
                 (PV, f2, "asset-x", 1000, 800, "plans/secret-drawing.png", "published", now))
    conn.execute("INSERT INTO plan_geometry(id, plan_version_id, floor_id, status, doc_json, doc_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
                 ("geo-1", PV, f2, "published", json.dumps(DOC, ensure_ascii=False), "h", now, now))
    conn.execute("INSERT INTO spatial_zones(id, floor_id, name, kind, polygon_json, created_at, updated_at) VALUES (?,?,?,'room',?,?,?)",
                 ("zone-id-office-9", f2, "משרד 12", box(0.1, 0.1, 0.5, 0.5), now, now))
    conn.execute("INSERT INTO spatial_zones(id, floor_id, name, kind, polygon_json, created_at, updated_at) VALUES (?,?,?,'corridor',?,?,?)",
                 ("z-hall", f2, "מסדרון", box(0.1, 0.1, 0.9, 0.9), now, now))
    conn.execute("INSERT INTO spatial_zones(id, floor_id, name, kind, polygon_json, created_at, updated_at) VALUES (?,?,?,'room',?,?,?)",
                 ("z-vault", f2, VAULT, box(0.7, 0.5, 0.85, 0.8), now, now))
    conn.execute("INSERT INTO spatial_zones(id, floor_id, name, kind, polygon_json, created_at, updated_at) VALUES (?,?,?,'room',?,?,?)",
                 ("z-f3", f3, "חדר-בקומה-3-סודי", box(0.0, 0.0, 1.0, 1.0), now, now))
    anchors = (("a-ac-1", f2, "ha_entity", "climate.office_ac", 0.2, 0.2, "מזגן משרד"),
               ("a-cam-1", f2, "camera", "cam-lobby-1", 0.6, 0.6, "מצלמת לובי"),
               ("a-other-cam-55", f2, "camera", "cam-other-2", 0.8, 0.2, "מצלמה-סודית-אחרת"),
               ("a-f3-sensor", f3, "ha_entity", "camera.secret", 0.5, 0.5, "חיישן קומה 3"))
    for aid, floor, rtype, rid_, x, y, label in anchors:
        conn.execute("INSERT INTO map_anchors(id, floor_id, plan_version_id, resource_type, resource_id, x, y, rotation_degrees, layer_id, label, revision, "
                     "effective_from, created_by, updated_by, updated_at) VALUES (?,?,?,?,?,?,?,0,'devices',?,1,?,'test','test',?)",
                     (aid, floor, PV, rtype, rid_, x, y, label, now, now))
    conn.close()
    return {"f2": f2, "f3": f3}


@pytest.fixture()
def s4(settings, monkeypatch):
    world = build_s4(settings, monkeypatch)
    world.map = seed_map(world)  # type: ignore[attr-defined]
    return world


def attach(s4, ticket_id: str, user: str = "joni", **body):
    return s4.c.put(f"{API}/tickets/{ticket_id}/map-element", json=body, headers=s4.h(user))


def anchor_body(s4, aid: str = "a-ac-1", floor: str = "f2") -> dict:
    return {"element": {"floor_id": s4.map[floor], "kind": "anchor", "id": aid}}


def sent_with_element(s4, **body) -> tuple[dict, str]:
    t, token = s4.sent(title="המזגן מטפטף")
    r = attach(s4, t["id"], **(body or anchor_body(s4)))
    assert r.status_code == 200, r.text
    return t, token


def assert_clean(svg: str) -> None:
    for s in SECRETS:
        assert s not in svg, s
    assert "<script" not in svg.lower() and "javascript:" not in svg.lower() and "<image" not in svg and "foreignObject" not in svg
    assert "secret-drawing" not in svg, "the uploaded drawing is never referenced"
    assert not re.search(r'\bid="(?!p"|ic"|mk")', svg), "the only ids are the picture's own"


# ---------------------------------------------------------------- the public route: negative first


def test_the_route_is_on_the_public_allowlist_as_a_token_image_read():
    rule = [r for r in ROUTES if r.template == "/t/api/map-image"]
    assert len(rule) == 1 and rule[0].method == "GET" and rule[0].kind == "photo_read" and rule[0].body == "none"


def test_no_token_and_a_wrong_token_are_the_uniform_404(s4):
    sent_with_element(s4)
    client, _ = s4.public(Clock(time.time()))
    r = client.get("/t/api/map-image")
    assert r.status_code == 404 and r.content == UNIFORM_404
    r = client.get("/t/api/map-image", headers=hdr("A" * 32))
    assert r.status_code == 404 and r.content == UNIFORM_404
    r = client.post("/t/api/map-image", headers=hdr("A" * 32))
    assert r.status_code == 404 and r.content == UNIFORM_404, "another method is an unknown route"


def test_an_expired_and_a_revoked_link_are_the_uniform_404(s4):
    t, token = sent_with_element(s4)
    client, _ = s4.public(Clock(time.time() + 400 * 86400))
    r = client.get("/t/api/map-image", headers=hdr(token))
    assert r.status_code == 404 and r.content == UNIFORM_404, "the picture expires with the link"
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_links SET revoked_at = '2026-10-16T00:00:00Z' WHERE ticket_id = ?", (t["id"],))
    client, _ = s4.public(Clock(time.time()))
    r = client.get("/t/api/map-image", headers=hdr(token))
    assert r.status_code == 404 and r.content == UNIFORM_404


def test_a_code_protected_link_without_its_session_gets_neither_the_block_nor_the_picture(s4):
    t, token = sent_with_element(s4)
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_links SET require_code = 1 WHERE ticket_id = ?", (t["id"],))
    client, _ = s4.public(Clock(time.time()))
    v = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert "map_element" not in v
    r = client.get("/t/api/map-image", headers=hdr(token))
    assert r.status_code == 403 and r.json()["code"] == "code_required"


def test_nothing_attached_is_the_uniform_404_and_no_block(s4):
    _t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    assert "map_element" not in client.get("/t/api/ticket", headers=hdr(token)).json()
    r = client.get("/t/api/map-image", headers=hdr(token))
    assert r.status_code == 404 and r.content == UNIFORM_404


def test_an_element_deleted_from_the_map_keeps_the_stored_text_and_no_new_picture(s4):
    t, token = sent_with_element(s4)
    with s4.db.connection() as conn:
        conn.execute("UPDATE map_anchors SET effective_to = '2026-10-16T09:00:00Z' WHERE id = 'a-ac-1'")
    client, _ = s4.public(Clock(time.time()))
    v = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert v["map_element"] == {"name": "מזגן משרד", "floor": "קומה 2", "room": "משרד 12", "image": False}
    r = client.get("/t/api/map-image", headers=hdr(token))
    assert r.status_code == 404 and r.content == UNIFORM_404
    g = s4.c.get(f"{API}/tickets/{t['id']}/map-element").json()["element"]
    assert g["present"] is False and g["name"] == "מזגן משרד" and g["vendor_image"] is False
    assert s4.c.get(f"{API}/tickets/{t['id']}/map-element/vendor.svg").status_code == 404


def test_an_object_removed_by_a_new_publish_stops_the_picture(s4):
    t, token = sent_with_element(s4, element={"floor_id": s4.map["f2"], "kind": "object", "id": "obj-boiler-1"})
    doc = dict(DOC, objects=[o for o in DOC["objects"] if o["id"] != "obj-boiler-1"])
    with s4.db.connection() as conn:
        conn.execute("UPDATE plan_geometry SET doc_json = ? WHERE id = 'geo-1'", (json.dumps(doc, ensure_ascii=False),))
    client, _ = s4.public(Clock(time.time()))
    assert client.get("/t/api/ticket", headers=hdr(token)).json()["map_element"]["image"] is False
    assert client.get("/t/api/map-image", headers=hdr(token)).content == UNIFORM_404


# ---------------------------------------------------------------- the public route: what it serves


def test_the_vendor_gets_the_snapshot_text_and_a_private_uncached_svg_without_other_objects(s4):
    t, token = sent_with_element(s4)
    client, _ = s4.public(Clock(time.time()))
    v = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert v["map_element"] == {"name": "מזגן משרד", "floor": "קומה 2", "room": "משרד 12", "image": True}, "the smallest room wins"
    body = json.dumps(v, ensure_ascii=False)
    for s in ("a-ac-1", "climate.office_ac", PV, s4.map["f2"], "x_px", "plan_version", "element_id"):
        assert s not in body, s
    r = client.get("/t/api/map-image", headers=hdr(token))
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/svg+xml; charset=utf-8"
    assert r.headers["cache-control"] == "private, no-store"
    assert "default-src 'none'" in r.headers["content-security-policy"] and r.headers["x-content-type-options"] == "nosniff"
    assert "set-cookie" not in r.headers and "etag" not in r.headers
    svg = r.content.decode("utf-8")
    assert svg.startswith("<svg") and "מזגן משרד · קומה 2 · משרד 12" in svg
    assert "משרד 12" in svg and "מסדרון" in svg, "the floor's room names are drawn"
    assert "<polyline" in svg and "stroke-dasharray=\"4 3\"" in svg, "walls and a door swing"
    assert_clean(svg)
    assert svg.count("<circle") >= 3, "the ring, the dot and the halo"


def test_the_picture_is_drawn_for_a_staff_link_too_since_staff_links_see_the_request_details(s4):
    """Staff (employee) links show the same request details as a vendor link (handler_actions.view unchanged, TKSTAFF1 R1) - so they
    get the same block and picture; nothing more (no ids)."""
    t, token = sent_with_element(s4)
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_links SET kind = 'staff' WHERE ticket_id = ?", (t["id"],))
    client, _ = s4.public(Clock(time.time()))
    v = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert v["map_element"]["image"] is True and "claim" not in v
    r = client.get("/t/api/map-image", headers=hdr(token))
    assert r.status_code == 200
    assert_clean(r.content.decode("utf-8"))


def test_the_manager_preview_is_byte_identical_to_the_vendor_picture(s4):
    t, token = sent_with_element(s4, resource={"type": "camera", "id": "cam-lobby-1"})
    client, _ = s4.public(Clock(time.time()))
    pub = client.get("/t/api/map-image", headers=hdr(token))
    prev = s4.c.get(f"{API}/tickets/{t['id']}/map-element/vendor.svg")
    assert pub.status_code == prev.status_code == 200 and pub.content == prev.content
    assert prev.headers["cache-control"] == "private, no-store"
    svg = pub.content.decode("utf-8")
    assert "מצלמת לובי" in svg, "the marked camera itself is named"
    assert_clean(svg)


# ---------------------------------------------------------------- the renderer alone


def test_the_renderer_draws_only_the_structure_of_the_elements_level():
    prims = map_image.structure_only(DOC, 1000, 800, "L0")
    assert {p["kind"] for p in prims} <= map_image.STRUCTURE_KINDS
    assert {p["kind"] for p in prims} >= {"wall", "door", "window", "passage"}
    assert all(p.get("id") != "wl1" for p in prims), "another level's wall is not drawn"
    zones = [{"name": "משרד 12", "polygon": json.loads(box(0.1, 0.1, 0.5, 0.5)), "level_id": None},
             {"name": "גלריה-אחרת", "polygon": json.loads(box(0.1, 0.1, 0.5, 0.5)), "level_id": "L1"}]
    svg = map_image.render_public_svg(DOC, zones, 1000, 800, level="L0", x=200, y=160, caption="א <b> & ב", title="t")
    assert "א &lt;b&gt; &amp; ב" in svg and "<b>" not in svg, "text is escaped"
    assert "גלריה-אחרת" not in svg
    assert_clean(svg)
    again = map_image.render_public_svg(DOC, zones, 1000, 800, level="L0", x=200, y=160, caption="א <b> & ב", title="t")
    assert svg == again, "deterministic"


def test_a_floor_without_a_structure_document_draws_rooms_and_the_mark_only():
    zones = [{"name": "משרד", "polygon": json.loads(box(0.1, 0.1, 0.5, 0.5)), "level_id": None}]
    svg = map_image.render_public_svg(None, zones, 1000, 800, level="L0", x=500, y=400, caption="x", title="x", room="משרד")
    assert "<polyline" not in svg and "משרד" in svg and "<circle" in svg


# ---------------------------------------------------------------- the manager API


def test_attach_get_replace_and_detach_with_audit_rows_of_ids_only(s4):
    t = s4.ticket()
    g = s4.c.get(f"{API}/tickets/{t['id']}/map-element").json()
    assert g["element"] is None and g["can"] == {"attach": True, "detach": False}
    r = attach(s4, t["id"], **anchor_body(s4))
    assert r.status_code == 200, r.text
    e = r.json()["element"]
    assert (e["kind"], e["type"], e["name"], e["floor_name"], e["room_name"], e["present"]) == ("anchor", "ha_entity", "מזגן משרד", "קומה 2", "משרד 12", True)
    assert (e["floor_id"], e["element_id"], e["resource_id"], e["x_px"], e["y_px"]) == (s4.map["f2"], "a-ac-1", "climate.office_ac", 200.0, 160.0)
    r = attach(s4, t["id"], element={"floor_id": s4.map["f2"], "kind": "object", "id": "obj-boiler-1"})
    assert r.status_code == 200 and r.json()["element"]["name"] == "דוד מים" and r.json()["element"]["room_name"] == "משרד 12"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT revision FROM ticket_map_elements WHERE ticket_id = ?", (t["id"],)).fetchone()[0] == 2
        rows = [dict(x) for x in conn.execute("SELECT action, details_json FROM audit_log WHERE action LIKE 'ticket.map_element%' ORDER BY rowid")]
    assert [x["action"] for x in rows] == ["ticket.map_element.attach", "ticket.map_element.attach"]
    for x in rows:
        assert "מזגן" not in x["details_json"] and "דוד" not in x["details_json"] and "משרד" not in x["details_json"], "ids only"
    r = s4.c.delete(f"{API}/tickets/{t['id']}/map-element")
    assert r.status_code == 200 and r.json()["element"] is None
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ticket.map_element.detach'").fetchone()[0] == 1


def test_a_camera_or_device_is_attached_by_its_id_through_its_current_anchor(s4):
    t = s4.ticket()
    r = attach(s4, t["id"], resource={"type": "camera", "id": "cam-lobby-1"})
    assert r.status_code == 200 and r.json()["element"]["element_id"] == "a-cam-1" and r.json()["element"]["room_name"] == "מסדרון"
    assert attach(s4, t["id"], resource={"type": "camera", "id": "cam-nowhere"}).status_code == 422


def test_unknown_foreign_or_deleted_elements_are_one_422(s4):
    t = s4.ticket()
    for body in ({"element": {"floor_id": s4.map["f2"], "kind": "anchor", "id": "a-nope"}},
                 {"element": {"floor_id": s4.map["f3"], "kind": "anchor", "id": "a-ac-1"}},  # an anchor of floor 2 named under floor 3
                 {"element": {"floor_id": s4.map["f3"], "kind": "object", "id": "obj-boiler-1"}},  # floor 3 has no published plan
                 {"element": {"floor_id": s4.map["f2"], "kind": "object", "id": "obj-nope"}}):
        r = attach(s4, t["id"], **body)
        assert r.status_code == 422 and r.json()["code"] == "element_not_found", body
    assert attach(s4, t["id"]).status_code == 422, "neither element nor resource"
    assert attach(s4, t["id"], **anchor_body(s4), resource={"type": "camera", "id": "cam-lobby-1"}).status_code == 422, "not both"
    assert attach(s4, t["id"], element={"floor_id": s4.map["f2"], "kind": "zone", "id": "x"}).status_code == 422


def test_who_may_attach_manager_or_creator_and_map_read_on_the_floor(s4):
    w = s4.w
    t = s4.ticket()  # joni's
    assert attach(s4, t["id"], user="vic", **anchor_body(s4)).status_code == 404, "an invisible ticket"
    r = attach(s4, t["id"], user="tom", **anchor_body(s4))
    assert r.status_code == 403, "a member who is neither a manager nor the creator"
    assert s4.c.get(f"{API}/tickets/{t['id']}/map-element", headers=s4.h("tom")).json()["can"]["attach"] is False
    assert attach(s4, t["id"], user="mona", **anchor_body(s4)).status_code == 200, "the department's manager"
    mine = w.create("fred", "נורה שרופה")  # fred: bound to floor 2 only, creator of his own ticket
    assert attach(s4, mine["id"], user="fred", **anchor_body(s4)).status_code == 200
    r = attach(s4, mine["id"], user="fred", element={"floor_id": s4.map["f3"], "kind": "anchor", "id": "a-f3-sensor"})
    assert r.status_code == 422, "an element on a floor the creator cannot read is the same answer as an unknown one"


def test_the_where_fields_go_only_to_readers_of_that_map(s4):
    t = s4.ticket()
    w = s4.w
    w.place(t["id"], "floor2")  # the ticket lies on floor 2; its element is on floor 3
    assert attach(s4, t["id"], **anchor_body(s4, "a-f3-sensor", "f3")).status_code == 200
    w.member("dept-maintenance", "fred", "member")  # fred sees the ticket (a member, bound to floor 2) but cannot read floor 3's map
    g = s4.c.get(f"{API}/tickets/{t['id']}/map-element", headers=s4.h("fred"))
    assert g.status_code == 200, g.text
    e = g.json()["element"]
    assert e["name"] == "חיישן קומה 3" and e["present"] is True
    for k in ("floor_id", "element_id", "resource_id", "x_px", "plan_version_id"):
        assert k not in e, k
    assert s4.c.get(f"{API}/tickets/{t['id']}/map-element/vendor.svg", headers=s4.h("fred")).status_code == 404
    assert "floor_id" in s4.c.get(f"{API}/tickets/{t['id']}/map-element").json()["element"], "joni reads every map"


def test_a_closed_ticket_is_409(s4):
    t = s4.ticket()
    with s4.db.connection() as conn:
        conn.execute("UPDATE tickets SET status = 'closed' WHERE id = ?", (t["id"],))
    r = attach(s4, t["id"], **anchor_body(s4))
    assert r.status_code == 409 and r.json()["code"] == "ticket_closed"


def test_the_row_follows_a_full_deletion(s4):
    t = s4.ticket()
    assert attach(s4, t["id"], **anchor_body(s4)).status_code == 200
    from smplwise.services.tickets import store

    with s4.db.connection() as conn:
        out = store.purge_ticket(conn, t["id"])
        assert out.get("ticket_map_elements") == 1
        assert map_element.stored(conn, t["id"]) is None


def test_the_module_off_hides_the_routes(s4):
    t = s4.ticket()
    assert s4.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    assert s4.c.get(f"{API}/tickets/{t['id']}/map-element").status_code == 404


# ---------------------------------------------------------------- TKMAPFIX (review F1 / F3 / F4 / F2 policy)


def svg_texts(svg: str) -> list[str]:
    root = ET.fromstring(svg)  # raises on ill-formed XML
    return [t.text or "" for t in root.iter("{http://www.w3.org/2000/svg}text")]


def set_labels_null(s4, *ids: str) -> None:
    conn = raw(s4.w.settings)
    for i in ids:
        conn.execute("UPDATE map_anchors SET label = NULL WHERE id = ?", (i,))
    conn.close()


def sql(s4, query: str, *args) -> None:
    conn = raw(s4.w.settings)
    conn.execute(query, args)
    conn.close()


def public_pair(s4, token: str):
    client, _ = s4.public(Clock(time.time()))
    return client.get("/t/api/ticket", headers=hdr(token)).json()["map_element"], client.get("/t/api/map-image", headers=hdr(token))


def test_the_default_zone_policy_names_the_elements_room_and_corridors_only(s4):
    assert map_image.MAP_ZONE_NAMES == "element_room_only"
    t, token = sent_with_element(s4)
    blk, r = public_pair(s4, token)
    svg = r.content.decode("utf-8")
    assert VAULT.encode() not in r.content, "another room's name is never in the bytes"
    assert svg.count("<polygon") >= 4, "the outlines stay, unnamed"
    assert sorted(svg_texts(svg)) == sorted(["מזגן משרד · קומה 2 · משרד 12", "משרד 12", "מסדרון"]), "exactly: caption, the element's room, the corridor"
    assert VAULT not in json.dumps(blk, ensure_ascii=False)


def test_the_all_policy_can_be_switched_back_in_one_place(s4, monkeypatch):
    monkeypatch.setattr(map_image, "MAP_ZONE_NAMES", "all")
    t, token = sent_with_element(s4)
    _, r = public_pair(s4, token)
    assert VAULT in r.content.decode("utf-8")


def test_unnamed_anchors_never_fall_back_to_an_id(s4):
    set_labels_null(s4, "a-ac-1", "a-cam-1")
    ins = ("INSERT INTO map_anchors(id, floor_id, plan_version_id, resource_type, resource_id, x, y, rotation_degrees, layer_id, label, revision, "
           "effective_from, created_by, updated_by, updated_at) VALUES (?,?,?,?,?,0.3,0.3,0,'devices',?,1,'t','t','t','t')")
    sql(s4, ins, "a-norow", s4.map["f2"], PV, "camera", "cam-no-row-9", "  ")  # a camera with no row at all, a blank label
    sql(s4, ins, "a-noent", s4.map["f2"], PV, "ha_entity", "binary_sensor.vault_pir_1", None)  # an entity with no ha_entities row
    cases = (("a-ac-1", "רכיב"), ("a-cam-1", "מצלמה"), ("a-norow", "מצלמה"), ("a-noent", "רכיב"))  # entity row absent; camera row absent/unnamed
    for aid, word in cases:
        t, token = sent_with_element(s4, **anchor_body(s4, aid))
        blk, r = public_pair(s4, token)
        assert blk["name"] == word, (aid, blk)
        blob = json.dumps(blk, ensure_ascii=False) + r.content.decode("utf-8")
        for ident in ("climate.office_ac", "cam-lobby-1", "cam-no-row-9", "binary_sensor.vault_pir_1", "vault_pir"):
            assert ident not in blob, (aid, ident)
    internal = s4.c.get(f"{API}/tickets/{t['id']}/map-element").json()["element"]
    assert internal["resource_id"] == "binary_sensor.vault_pir_1", "the ids stay in the internal answer"


def test_an_object_without_a_label_or_catalog_name_gets_the_generic_word_not_its_item_id(s4):
    doc = json.loads(json.dumps(DOC))
    doc["objects"].append({"id": "obj-bare-1", "item_id": "item-unknown-xyz", "level_id": "L0", "position": [0.4, 0.3], "rotation_deg": 0,
                           "size": {"w_m": 0.5, "d_m": 0.5}, "label": "  ", "anchor_ref": None})
    sql(s4, "UPDATE plan_geometry SET doc_json = ?, updated_at = '2026-10-16T09:00:00Z'", json.dumps(doc, ensure_ascii=False))
    t, token = sent_with_element(s4, element={"floor_id": s4.map["f2"], "kind": "object", "id": "obj-bare-1"})
    blk, r = public_pair(s4, token)
    assert blk["name"] == "רכיב" and "item-unknown-xyz" not in json.dumps(blk) + r.content.decode("utf-8")


def test_the_generic_words():
    assert map_element.generic_name("camera", "en") == "Camera" and map_element.generic_name("x", "en") == "Item"
    assert map_element.generic_name("camera") == "מצלמה" and map_element.generic_name("ha_entity") == "רכיב"


HOSTILE = "ח\x01דר‮‏\x00 ﻿א\x1f\n&<b>\"'"


def test_hostile_names_yield_a_well_formed_svg_without_control_or_format_characters():
    zones = [{"name": HOSTILE + "x" * 10000, "kind": "corridor", "polygon": json.loads(box(0.1, 0.1, 0.5, 0.5)), "level_id": None}]
    svg = map_image.render_public_svg(DOC, zones, 1000, 800, level="L0", x=200, y=160, caption=HOSTILE * 3, title=HOSTILE)
    texts = svg_texts(svg)  # parses as XML
    assert all(len(t) <= 3 * map_image.TEXT_MAX for t in texts) and len(svg) < 60000
    for ch in svg:
        assert ch == "\n" or not (0xD800 <= ord(ch) <= 0xDFFF or ord(ch) < 32 or ch in "‮‏﻿\x7f"), hex(ord(ch))
    assert map_image.clean_text(HOSTILE).startswith("חדר א")


def test_hostile_names_end_to_end_floor_room_and_label_snapshots_are_clean_and_short(s4):
    sql(s4, "UPDATE floors SET name = ? WHERE id = ?", "קומה‮\x01" + "f" * 500, s4.map["f2"])
    sql(s4, "UPDATE spatial_zones SET name = ? WHERE id = 'zone-id-office-9'", "משרד\x02‮" + "r" * 500)
    sql(s4, "UPDATE map_anchors SET label = ? WHERE id = 'a-ac-1'", "מזגן\x01‮" + "n" * 500)
    t, token = sent_with_element(s4)
    blk, r = public_pair(s4, token)
    assert len(blk["floor"]) <= map_element.NAME_MAX and len(blk["room"]) <= map_element.NAME_MAX and len(blk["name"]) <= map_element.NAME_MAX
    assert "‮" not in json.dumps(blk, ensure_ascii=False) and "\x01" not in blk["name"]
    svg_texts(r.content.decode("utf-8"))


def test_the_public_picture_is_cached_and_a_republish_or_rename_invalidates_it(s4, monkeypatch):
    calls = []
    real = map_image.render_public_svg
    monkeypatch.setattr(map_image, "render_public_svg", lambda *a, **k: calls.append(1) or real(*a, **k))
    map_element._snapshot_cache.clear()
    t, token = sent_with_element(s4)
    client, _ = s4.public(Clock(time.time()))
    first = client.get("/t/api/map-image", headers=hdr(token))
    second = client.get("/t/api/map-image", headers=hdr(token))
    assert first.content == second.content and len(calls) == 1, "the second request is served from the cache"
    assert second.headers["cache-control"] == "private, no-store"
    sql(s4, "UPDATE spatial_zones SET name = 'משרד חדש' WHERE id = 'zone-id-office-9'")  # the element's room renamed
    third = client.get("/t/api/map-image", headers=hdr(token))
    assert len(calls) == 2 and "משרד חדש" in third.content.decode("utf-8")
    doc = json.loads(json.dumps(DOC))
    doc["walls"].append({"id": "w-new", "level_id": "L0", "polyline": [[0.2, 0.8], [0.8, 0.8]], "thickness_m": 0.2})
    sql(s4, "UPDATE plan_geometry SET doc_json = ?, doc_hash = 'h2', updated_at = '2026-10-16T10:00:00Z'", json.dumps(doc, ensure_ascii=False))
    fourth = client.get("/t/api/map-image", headers=hdr(token))
    assert len(calls) == 3 and fourth.content != third.content, "a republished geometry"
    assert attach(s4, t["id"], **anchor_body(s4, "a-cam-1")).status_code == 200
    fifth = client.get("/t/api/map-image", headers=hdr(token))
    assert len(calls) == 4 and "מצלמת לובי" in fifth.content.decode("utf-8"), "a re-attach"


def test_the_block_does_not_parse_the_plan_document_for_an_anchor(s4, monkeypatch):
    t, token = sent_with_element(s4)

    def boom(*a, **k):
        raise AssertionError("parsed")

    monkeypatch.setattr(map_element, "published_doc", boom)
    client, _ = s4.public(Clock(time.time()))
    assert client.get("/t/api/ticket", headers=hdr(token)).json()["map_element"]["image"] is True


def test_the_picture_route_is_the_uniform_404_in_claim_mode(s4):
    t, token = s4.sent(cost_claim="required")
    assert attach(s4, t["id"], **anchor_body(s4)).status_code == 200
    client, _ = s4.public(Clock(time.time()))
    assert client.get("/t/api/map-image", headers=hdr(token)).status_code == 200
    r = client.post("/t/api/return", headers=hdr(token), json={"kind": "cannot_handle", "reason": "חסר חלק במלאי", "client_request_id": str(uuid.uuid4())})
    assert r.status_code == 200, r.text
    v = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert v["claim_mode"] is True and "map_element" not in v
    img = client.get("/t/api/map-image", headers=hdr(token))
    assert img.status_code == 404 and img.content == UNIFORM_404
