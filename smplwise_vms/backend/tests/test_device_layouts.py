"""CR-007 slice 6b: the device screens' layout editor (routers/device_layouts.py) - one layout per installation and
screen, read by everyone with devices.read, written only with system.configure (checked before the body), optimistic
revisions, strict validation (grid units, palette roles, text sizes, icons of the product's set), reset, copy to all
areas, audit rows without the layout, and the table in project backups."""
from __future__ import annotations

import json
import re
from dataclasses import replace
from pathlib import Path

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient
from test_devices import AREAS, FLOORS, _place, _publish_plan, dev_app  # noqa: F401 - the HA structure fixture (floors, areas, entities)

from smplwise.main import create_app
from smplwise.routers import device_layouts as mod
from smplwise.services import ha_sync

ROOT = Path(__file__).resolve().parents[3]
URL = "/api/v1/devices/layouts"


def _desktop(**over) -> dict:
    items = {
        "card:lighting": {"x": 0, "y": 0, "w": 8, "h": 30, "text": "lg", "bg": "accent", "border": "cool", "title": "תאורת הלובי", "icon": "star"},
        "card:climate": {"x": 8, "y": 0, "w": 4, "h": 20},
        "card:sensors": {"x": 0, "y": 32, "w": 12, "h": 10, "hidden": True},
    }
    return {"v": 1, "cols": 12, "items": {**items, **over}}


def _phone() -> dict:
    return {"v": 1, "cols": 4, "items": {"card:climate": {"x": 0, "y": 0, "w": 4, "h": 20}, "card:lighting": {"x": 0, "y": 22, "w": 4, "h": 30}}}


def _put(c, scope, sid, variant, revision, layout, headers=None):
    return c.put(f"{URL}/{scope}/{sid}", json={"variant": variant, "revision": revision, "layout": layout}, headers=headers)


def _audit(app, action) -> list[dict]:
    with app.state.db.connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def test_read_for_devices_read_holders_write_only_with_system_configure_checked_before_the_body(dev_app):  # noqa: F811
    app, s = dev_app
    c = TestClient(app)
    empty = c.get(f"{URL}/area/lobby").json()
    assert empty == {"scope": "area", "id": "lobby", "desktop": None, "phone": None, "can_edit": True, "narrowed": False}
    assert _put(c, "area", "lobby", "desktop", 0, _desktop()).status_code == 200
    ids = seed_tree(c)
    bind(c, s, "vera", "viewer", "installation", "*")
    bind(c, s, "flo", "viewer", "floor", ids["floor2"])  # floor-scoped: devices.read somewhere is enough to read a layout
    bind(c, s, "op", "operator", "installation", "*")
    bind(c, s, "wall", "kiosk", "floor", ids["floor2"])
    c.get("/api/v1/me", headers=as_user("nobody"))
    for user in ("vera", "op"):
        r = c.get(f"{URL}/area/lobby", headers=as_user(user))
        assert r.status_code == 200, user
        assert r.json()["desktop"]["layout"]["items"]["card:lighting"]["bg"] == "accent" and r.json()["can_edit"] is False
        assert r.json()["desktop"]["updated_by"] is None  # who saved it: system.configure holders only
    # floor-scoped with nothing placed: reads, but nothing of an area it cannot see
    r = c.get(f"{URL}/area/lobby", headers=as_user("flo"))
    assert r.status_code == 200 and r.json()["desktop"] is None
    assert c.get(f"{URL}/area/lobby").json()["desktop"]["updated_by"]  # the administrator sees who saved it
    for user in ("nobody", "wall"):
        assert c.get(f"{URL}/area/lobby", headers=as_user(user)).status_code == 403, user
    # every write refused without system.configure - also with a malformed / non-JSON body it was never entitled to send
    for user in ("vera", "op"):
        h = as_user(user)
        assert _put(c, "area", "lobby", "desktop", 1, _desktop(), headers=h).status_code == 403
        assert c.put(f"{URL}/area/lobby", content=b"not json", headers={**h, "Content-Type": "text/plain"}).status_code == 403
        assert c.delete(f"{URL}/area/lobby", headers=h).status_code == 403
        assert c.post(f"{URL}/area/lobby/copy-to-all-areas", content=b"{", headers={**h, "Content-Type": "application/json"}).status_code == 403
    denied = [r for r in _audit(app, "system.configure") if r["decision"] == "denied"]
    assert len(denied) >= 8
    assert c.get(f"{URL}/area/lobby").json()["desktop"]["revision"] == 1  # nothing changed


def test_revision_conflict_and_persistence_for_another_user(dev_app):  # noqa: F811
    app, s = dev_app
    c = TestClient(app)
    r1 = _put(c, "area", "lobby", "desktop", 0, _desktop())
    assert r1.status_code == 200 and r1.json()["desktop"]["revision"] == 1
    assert r1.json()["desktop"]["updated_by"] and r1.json()["desktop"]["updated_at"]
    # a second editor who also started from "no layout" is stale now: 409 with the current revision, nothing written
    stale = _put(c, "area", "lobby", "desktop", 0, _desktop(**{"card:climate": {"x": 8, "y": 0, "w": 4, "h": 8}}))
    assert stale.status_code == 409 and stale.json()["code"] == "layout_conflict" and stale.json()["details"]["revision"] == 1
    r2 = _put(c, "area", "lobby", "desktop", 1, _desktop(**{"card:climate": {"x": 8, "y": 0, "w": 4, "h": 24}}))
    assert r2.status_code == 200 and r2.json()["desktop"]["revision"] == 2
    # the phone variant has its own revision
    p = _put(c, "area", "lobby", "phone", 0, _phone())
    assert p.status_code == 200 and p.json()["phone"]["revision"] == 1 and p.json()["desktop"]["revision"] == 2
    # the building screen: one record, id "main", floor and area keys
    b = _put(c, "building", "main", "desktop", 0, {"v": 1, "cols": 12, "items": {"floor:ground": {"x": 0, "y": 0, "w": 6, "h": 40}, "area:lobby": {"x": 6, "y": 0, "w": 3, "h": 14, "bg": "warm"}}})
    assert b.status_code == 200, b.text
    # persisted for everyone: another user reads exactly what was saved (defaults filled in)
    bind(c, s, "vera", "viewer", "installation", "*")
    seen = c.get(f"{URL}/area/lobby", headers=as_user("vera")).json()
    assert seen["desktop"]["layout"]["items"]["card:climate"] == {"x": 8, "y": 0, "w": 4, "h": 24, "text": "md", "bg": None, "border": None, "title": None, "icon": None, "hidden": False, "hidden_entities": []}
    assert seen["phone"]["layout"]["cols"] == 4
    assert c.get(f"{URL}/building/main", headers=as_user("vera")).json()["desktop"]["layout"]["items"]["area:lobby"]["bg"] == "warm"
    # audit: scope + id + variant + revision only, never the layout
    rows = _audit(app, "devices.layout.update")
    assert [json.loads(r["details_json"]) for r in rows] == [
        {"scope": "area", "id": "lobby", "variant": "desktop", "revision": 1},
        {"scope": "area", "id": "lobby", "variant": "desktop", "revision": 2},
        {"scope": "area", "id": "lobby", "variant": "phone", "revision": 1},
        {"scope": "building", "id": "main", "variant": "desktop", "revision": 1},
    ]
    assert all("תאורת" not in (r["details_json"] or "") for r in rows)


def test_validation(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)

    def bad(layout, variant="desktop", scope="area", sid="lobby"):
        return _put(c, scope, sid, variant, 0, layout).status_code

    item = {"x": 0, "y": 0, "w": 4, "h": 10}
    for field, value in (("bg", "#ff0000"), ("bg", "blue"), ("border", "rgb(0,0,0)"), ("text", "xl"), ("icon", "rocket"), ("icon", "mdi:sofa"),
                         ("x", -1), ("x", 12), ("w", 0), ("w", 13), ("h", 0), ("y", mod.MAX_ROW + 1), ("h", mod.MAX_SPAN_ROWS + 1),
                         ("title", "x" * 61), ("title", "a‮b"), ("title", "a\nb"), ("hidden", "yes"), ("style", "color:red")):
        assert bad({"v": 1, "cols": 12, "items": {"card:lighting": {**item, field: value}}}) == 422, (field, value)
    assert bad({"v": 1, "cols": 12, "items": {"card:lighting": {**item, "x": 10, "w": 4}}}) == 422  # past the 12 columns
    # two items of one grid in the same place (review nit 5)
    over = _put(c, "area", "lobby", "desktop", 0, {"v": 1, "cols": 12, "items": {"card:lighting": item, "card:climate": {**item, "x": 2, "y": 5}}})
    assert over.status_code == 422 and over.json()["code"] == "layout_overlap"
    # the building: floor cards and each floor's area tiles are separate grids - the same coordinates are fine there
    assert _put(c, "building", "main", "desktop", 0, {"v": 1, "cols": 12, "items": {"floor:ground": item, "area:lobby": item, "area:office": item}}).status_code == 200
    assert _put(c, "building", "main", "desktop", 1, {"v": 1, "cols": 12, "items": {"area:lobby": item, "area:empty_room": item}}).json()["code"] == "layout_overlap"
    assert c.delete(f"{URL}/building/main").status_code == 200
    # the visible-entities checklist: entity ids only, area cards only
    for bad_list in (["not an id"], ["light"], ["x" * 300 + ".y"], ["light.a"] * 0 + [f"light.e{i}" for i in range(mod.MAX_HIDDEN_ENTITIES + 1)]):
        assert bad({"v": 1, "cols": 12, "items": {"card:lighting": {**item, "hidden_entities": bad_list}}}) == 422, bad_list[:2]
    assert bad({"v": 1, "cols": 12, "items": {"floor:ground": {**item, "hidden_entities": ["light.lobby"]}}}, scope="building", sid="main") == 422
    assert bad({"v": 1, "cols": 4, "items": {}}) == 422  # a desktop layout has 12 columns
    assert bad({"v": 1, "cols": 12, "items": {}}, variant="phone") == 422  # a phone layout has 4
    assert bad({"v": 1, "cols": 4, "items": {"card:lighting": {"x": 2, "y": 0, "w": 4, "h": 5}}}, variant="phone") == 422
    assert bad({"v": 4, "cols": 12, "items": {}}) == 422  # 1 (6b), 2 (6c, device tiles) and 3 (custom / deleted cards) only
    assert bad({"v": 1, "cols": 12, "items": {"floor:ground": item}}) == 422  # an area screen lays out its cards only
    assert bad({"v": 1, "cols": 12, "items": {"card:garage": item}}) == 422
    assert bad({"v": 1, "cols": 12, "items": {"card:lighting": item}}, scope="building", sid="main") == 422  # and the building its floors / areas
    assert bad({"v": 1, "cols": 12, "items": {"floor:a b": item}}, scope="building", sid="main") == 422
    assert bad({"v": 1, "cols": 12, "items": {f"area:a{i}": item for i in range(mod.MAX_ITEMS + 1)}}, scope="building", sid="main") in (413, 422)
    assert _put(c, "area", "no_such_area", "desktop", 0, {"v": 1, "cols": 12, "items": {}}).status_code == 404
    assert _put(c, "building", "other", "desktop", 0, {"v": 1, "cols": 12, "items": {}}).status_code == 404
    assert _put(c, "floor", "ground", "desktop", 0, {"v": 1, "cols": 12, "items": {}}).status_code == 404
    assert c.get(f"{URL}/floor/ground").status_code == 404
    # JSON only, a size cap, closed body
    assert c.put(f"{URL}/area/lobby", content=json.dumps({"variant": "desktop", "revision": 0, "layout": {"v": 1, "cols": 12, "items": {}}}), headers={"Content-Type": "text/plain"}).status_code == 415
    assert c.put(f"{URL}/area/lobby", content=b"{nope", headers={"Content-Type": "application/json"}).status_code == 422
    big = {"variant": "desktop", "revision": 0, "layout": {"v": 1, "cols": 12, "items": {}}, "pad": "x" * (mod.MAX_BODY + 1)}
    assert c.put(f"{URL}/area/lobby", content=json.dumps(big), headers={"Content-Type": "application/json"}).status_code == 413
    assert c.put(f"{URL}/area/lobby", json={"variant": "desktop", "revision": 0, "layout": {"v": 1, "cols": 12, "items": {}}, "extra": 1}).status_code == 422
    assert c.put(f"{URL}/area/lobby", json={"variant": "tablet", "revision": 0, "layout": {"v": 1, "cols": 12, "items": {}}}).status_code == 422
    # nothing was written by any refused request; a good layout with every option passes, the title trimmed
    assert c.get(f"{URL}/area/lobby").json()["desktop"] is None
    ok = _put(c, "area", "lobby", "desktop", 0, {"v": 1, "cols": 12, "items": {f"card:{cid}": {"x": 0, "y": i * 10, "w": 12, "h": 8, "text": "sm", "bg": role, "border": role, "title": "  כותרת  ", "icon": icon}
                                                                                for i, (cid, role, icon) in enumerate(zip(("lighting", "switches", "climate", "covers", "security", "media", "sensors"), mod.ROLES, mod.ICONS))}})
    assert ok.status_code == 200, ok.text
    assert ok.json()["desktop"]["layout"]["items"]["card:lighting"]["title"] == "כותרת"
    assert _put(c, "area", "unassigned", "desktop", 0, {"v": 1, "cols": 12, "items": {"card:switches": item}}).status_code == 200


def test_reset_and_copy_to_all_areas(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    # nothing stored yet: nothing to copy; the revision is required
    r = c.post(f"{URL}/area/lobby/copy-to-all-areas", json={"revision": 0})
    assert r.status_code == 409 and r.json()["code"] == "nothing_to_copy"
    assert c.post(f"{URL}/area/lobby/copy-to-all-areas", json={}).status_code == 422
    assert c.post(f"{URL}/area/nowhere/copy-to-all-areas", json={"revision": 0}).status_code == 404
    assert c.post(f"{URL}/area/lobby/copy-to-all-areas", content=b"{}", headers={"Content-Type": "text/plain"}).status_code == 415
    assert _put(c, "area", "lobby", "desktop", 0, _desktop()).status_code == 200
    # an area with its own edited phone layout, and one with its own desktop layout
    assert _put(c, "area", "office", "phone", 0, _phone()).status_code == 200
    assert _put(c, "area", "garden", "desktop", 0, _desktop(**{"card:climate": {"x": 8, "y": 0, "w": 4, "h": 6}})).status_code == 200
    # a stale source revision is refused
    assert c.post(f"{URL}/area/lobby/copy-to-all-areas", json={"revision": 7}).status_code == 409
    r = c.post(f"{URL}/area/lobby/copy-to-all-areas", json={"revision": 1})
    assert r.status_code == 200, r.text
    assert r.json()["copied_to"] == 4  # office, empty_room, garden and the "ללא שיוך" bucket
    src = c.get(f"{URL}/area/lobby").json()["desktop"]["layout"]
    for area in ("office", "empty_room", "garden", "unassigned"):
        rec = c.get(f"{URL}/area/{area}").json()
        assert rec["desktop"]["layout"] == src, area
        assert rec["phone"] is None, area  # the source has no phone layout: every area derives it again
    assert c.get(f"{URL}/area/garden").json()["desktop"]["revision"] == 2
    # with a phone layout on the source, the phone layout is copied too
    assert _put(c, "area", "lobby", "phone", 0, _phone()).status_code == 200
    assert c.post(f"{URL}/area/lobby/copy-to-all-areas", json={"revision": 1}).status_code == 200
    assert c.get(f"{URL}/area/office").json()["phone"]["layout"] == _phone() | {"items": {k: {**v, "text": "md", "bg": None, "border": None, "title": None, "icon": None, "hidden": False, "hidden_entities": []} for k, v in _phone()["items"].items()}}
    copies = _audit(app, "devices.layout.copy")
    assert [json.loads(x["details_json"]) for x in copies] == [{"scope": "area", "id": "lobby", "revision": 1, "areas": 4}, {"scope": "area", "id": "lobby", "revision": 1, "areas": 4}]
    # reset: the phone alone ("חזור לאוטומטי"), with a stale revision refused
    assert c.delete(f"{URL}/area/office?variant=phone&revision=99").status_code == 409
    rec = c.delete(f"{URL}/area/office?variant=phone").json()
    assert rec["phone"] is None and rec["desktop"] is not None
    # "אפס לברירת מחדל": both variants
    rec = c.delete(f"{URL}/area/lobby?revision=1").json()
    assert rec["desktop"] is None and rec["phone"] is None
    assert c.get(f"{URL}/area/lobby").json()["desktop"] is None
    resets = [json.loads(x["details_json"]) for x in _audit(app, "devices.layout.reset")]
    assert resets == [{"scope": "area", "id": "office", "variant": "phone", "revision": {"phone": 1}}, {"scope": "area", "id": "lobby", "variant": "all", "revision": {"desktop": 1, "phone": 1}}]
    # after a reset a new layout starts from revision 0 again
    assert _put(c, "area", "lobby", "desktop", 0, _desktop()).status_code == 200


def test_layouts_travel_with_a_project_backup(settings, tmp_path):
    from smplwise.services import backup

    assert "device_layouts" in backup.PROJECT_TABLES
    app = create_app(settings)
    c = TestClient(app)
    layout = {"v": 1, "cols": 12, "items": {"floor:ground": {"x": 0, "y": 0, "w": 6, "h": 40}}}
    assert _put(c, "building", "main", "desktop", 0, layout).status_code == 200
    e = c.post("/api/v1/backups", json={"note": "layouts"}).json()
    assert e["tables"]["device_layouts"] == 1
    data = c.get(f"/api/v1/backups/{e['name']}/download").content
    settings2 = replace(settings, data_dir=tmp_path / "data2")
    c2 = TestClient(create_app(settings2))
    assert c2.get(f"{URL}/building/main").json()["desktop"] is None
    up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", data, "application/zip")}).json()
    res = c2.post(f"/api/v1/backups/{up['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    got = c2.get(f"{URL}/building/main").json()["desktop"]
    assert got["revision"] == 1 and got["layout"]["items"]["floor:ground"]["w"] == 6 and got["layout"]["items"]["floor:ground"]["h"] == 40


def test_icons_and_roles_match_the_frontend():
    src = (ROOT / "frontend" / "src" / "screens" / "devices-layout.ts").read_text(encoding="utf-8")
    icons = re.search(r"export const LAYOUT_ICONS = \[([^\]]*)\]", src)
    roles = re.search(r"export const LAYOUT_ROLES = \[([^\]]*)\]", src)
    assert icons and roles
    assert tuple(re.findall(r"'([a-z]+)'", icons.group(1))) == mod.ICONS
    assert tuple(re.findall(r"'([a-z]+)'", roles.group(1))) == mod.ROLES
    icon_src = (ROOT / "frontend" / "src" / "components" / "sw-icon.ts").read_text(encoding="utf-8")
    for name in mod.ICONS:
        assert re.search(rf"^\s+{name}: svg`", icon_src, re.M), name  # every allowed icon exists in the product's set


def test_floor_scoped_viewer_sees_only_their_floors_keys(dev_app):  # noqa: F811
    """Review MEDIUM 1: the building layout names every floor and HA area (ids are name slugs) and custom titles - a
    floor-scoped viewer gets only the keys of what they can see, `narrowed`, and never who saved it."""
    app, s = dev_app
    c = TestClient(app)
    ids = seed_tree(c)
    _publish_plan(c, ids["floor2"])
    _place(c, ids["floor2"], "light.office")  # HA area "office" on HA floor "second"
    layout = {"v": 1, "cols": 12, "items": {
        "floor:ground": {"x": 0, "y": 0, "w": 6, "h": 30, "title": "קומת כניסה סודית"},
        "floor:second": {"x": 6, "y": 0, "w": 6, "h": 30},
        "area:lobby": {"x": 0, "y": 0, "w": 4, "h": 14},
        "area:office": {"x": 0, "y": 0, "w": 4, "h": 14, "title": "המשרד"},
    }}
    assert _put(c, "building", "main", "desktop", 0, layout).status_code == 200
    bind(c, s, "flo", "viewer", "floor", ids["floor2"])
    r = c.get(f"{URL}/building/main", headers=as_user("flo"))
    assert r.status_code == 200
    body = r.json()
    assert set(body["desktop"]["layout"]["items"]) == {"floor:second", "area:office"}
    assert body["narrowed"] is True and body["desktop"]["updated_by"] is None
    text = r.text
    for leak in ("lobby", "ground", "סודית"):
        assert leak not in text, leak
    # their own area: the record; any other area: nothing
    assert _put(c, "area", "office", "desktop", 0, {"v": 1, "cols": 12, "items": {"card:lighting": {"x": 0, "y": 0, "w": 12, "h": 10}}}).status_code == 200
    assert c.get(f"{URL}/area/office", headers=as_user("flo")).json()["desktop"]["layout"]["cols"] == 12
    assert _put(c, "area", "lobby", "desktop", 0, {"v": 1, "cols": 12, "items": {"card:lighting": {"x": 0, "y": 0, "w": 12, "h": 10, "title": "לובי"}}}).status_code == 200
    assert c.get(f"{URL}/area/lobby", headers=as_user("flo")).json()["desktop"] is None
    # installation-wide callers get it whole
    assert set(c.get(f"{URL}/building/main").json()["desktop"]["layout"]["items"]) == set(layout["items"])


def test_layouts_of_areas_gone_from_home_assistant_are_pruned_on_writes_only(dev_app):  # noqa: F811
    """Review nit 8 (re-review): a layout row of an HA area that no longer exists goes on the next WRITE of a
    system.configure holder, audited (scope, id, count); a read - by anyone - never writes."""
    app, s = dev_app
    c = TestClient(app)
    one = {"v": 1, "cols": 12, "items": {"card:lighting": {"x": 0, "y": 0, "w": 12, "h": 10}}}
    for area in ("empty_room", "lobby"):
        assert _put(c, "area", area, "desktop", 0, one).status_code == 200
    with app.state.db.connection() as conn:
        ha_sync.apply_structure(conn, [a for a in AREAS if a["area_id"] != "empty_room"], FLOORS)

    def left() -> set[str]:
        with app.state.db.connection() as conn:
            return {r[0] for r in conn.execute("SELECT DISTINCT scope_id FROM device_layouts").fetchall()}

    bind(c, s, "vera", "viewer", "installation", "*")
    for headers in (None, as_user("vera")):
        assert c.get(f"{URL}/area/lobby", headers=headers).status_code == 200
        assert c.get(f"{URL}/building/main", headers=headers).status_code == 200
    assert left() == {"empty_room", "lobby"}  # reads pruned nothing
    assert _audit(app, "devices.layout.prune") == []
    assert _put(c, "area", "lobby", "desktop", 1, one).status_code == 200
    assert left() == {"lobby"}
    rows = _audit(app, "devices.layout.prune")
    assert [(r["resource_id"], json.loads(r["details_json"])) for r in rows] == [("empty_room", {"scope": "area", "id": "empty_room", "count": 1})]
    # copy to all areas prunes too (nothing left to prune here: no new row)
    assert c.post(f"{URL}/area/lobby/copy-to-all-areas", json={"revision": 2}).status_code == 200
    assert "empty_room" not in left() and len(_audit(app, "devices.layout.prune")) == 1


# ---------------------------------------------------------------- slice 6c: device tiles inside the area cards

def _tiles_layout(**tiles_over) -> dict:
    tiles = {
        "light.lobby_2": {"order": 0, "span": 2, "size": "l", "title": "  ספוט  "},
        "light.lobby": {"order": 1},
    }
    tiles.update(tiles_over)
    return {"v": 2, "cols": 12, "items": {
        "card:lighting": {"x": 0, "y": 0, "w": 8, "h": 30, "tiles": tiles},
        "card:climate": {"x": 8, "y": 0, "w": 4, "h": 20},
    }}


def test_tiles_saved_with_defaults_and_read_back_by_everyone(dev_app):  # noqa: F811
    app, s = dev_app
    c = TestClient(app)
    r = _put(c, "area", "lobby", "desktop", 0, _tiles_layout())
    assert r.status_code == 200, r.text
    lay = r.json()["desktop"]["layout"]
    assert lay["v"] == 2 and r.json()["desktop"]["revision"] == 1
    assert lay["items"]["card:lighting"]["tiles"] == {
        "light.lobby_2": {"order": 0, "span": 2, "size": "l", "hidden": False, "title": "ספוט"},
        "light.lobby": {"order": 1, "span": 1, "size": "m", "hidden": False, "title": None},
    }
    assert "tiles" not in lay["items"]["card:climate"]  # a card without an arrangement stores none
    bind(c, s, "vera", "viewer", "installation", "*")
    seen = c.get(f"{URL}/area/lobby", headers=as_user("vera")).json()
    assert seen["desktop"]["layout"] == lay and seen["can_edit"] is False
    # the phone variant arranges its own tiles, with its own revision
    phone = {"v": 2, "cols": 4, "items": {"card:lighting": {"x": 0, "y": 0, "w": 4, "h": 30, "tiles": {"light.lobby": {"order": 0, "span": 2}, "light.lobby_2": {"order": 1, "span": 2}}}}}
    p = _put(c, "area", "lobby", "phone", 0, phone)
    assert p.status_code == 200 and p.json()["phone"]["revision"] == 1 and p.json()["desktop"]["revision"] == 1
    assert p.json()["desktop"]["layout"]["items"]["card:lighting"]["tiles"]["light.lobby_2"]["order"] == 0  # untouched
    # a stale editor of the arrangement is refused like any other layout write, nothing written
    stale = _put(c, "area", "lobby", "desktop", 0, _tiles_layout(**{"light.lobby": {"order": 5}}))
    assert stale.status_code == 409 and stale.json()["details"]["revision"] == 1
    assert c.get(f"{URL}/area/lobby").json()["desktop"]["layout"]["items"]["card:lighting"]["tiles"]["light.lobby"]["order"] == 1
    r2 = _put(c, "area", "lobby", "desktop", 1, _tiles_layout(**{"light.lobby": {"order": 5}}))
    assert r2.status_code == 200 and r2.json()["desktop"]["revision"] == 2
    # the audit row names the scope, id, variant and revision - never a title or an entity
    details = [r["details_json"] for r in _audit(app, "devices.layout.update")]
    assert details and all("ספוט" not in d and "light." not in d for d in details)
    # copy to all areas carries the arrangement as it is
    assert c.post(f"{URL}/area/lobby/copy-to-all-areas", json={"revision": 2}).status_code == 200
    assert c.get(f"{URL}/area/office").json()["desktop"]["layout"]["items"]["card:lighting"]["tiles"]["light.lobby"]["order"] == 5


def test_tile_hidden_merges_with_hidden_entities_both_ways(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    lay = _tiles_layout(**{"light.lobby": {"order": 1, "hidden": True}})
    lay["items"]["card:lighting"]["hidden_entities"] = ["light.lobby_2", "light.not_arranged"]
    r = _put(c, "area", "lobby", "desktop", 0, lay)
    assert r.status_code == 200, r.text
    item = r.json()["desktop"]["layout"]["items"]["card:lighting"]
    # a hidden tile joins the card's list (an older screen reads that list only) ...
    assert item["hidden_entities"] == ["light.lobby", "light.lobby_2", "light.not_arranged"]
    # ... and an entity of the list is a hidden tile
    assert item["tiles"]["light.lobby_2"]["hidden"] is True and item["tiles"]["light.lobby"]["hidden"] is True
    # the merged set is bounded too
    many = _tiles_layout(**{f"light.t{i}": {"order": 10 + i, "hidden": True} for i in range(mod.MAX_TILES - 2)})
    many["items"]["card:lighting"]["hidden_entities"] = ["light.x1", "light.x2", "light.x3"]  # 198 + 3 > 200
    assert _put(c, "area", "lobby", "desktop", 1, many).status_code == 422
    many["items"]["card:lighting"]["hidden_entities"] = ["light.x1", "light.x2"]  # exactly 200: fine
    assert _put(c, "area", "lobby", "desktop", 1, many).status_code == 200


def test_tile_validation(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)

    def status(layout, variant="desktop", scope="area", sid="lobby"):
        return _put(c, scope, sid, variant, 0, layout).status_code

    for field, value in (("order", -1), ("order", mod.MAX_TILE_ORDER + 1), ("order", "1"), ("order", 1.5), ("span", 0), ("span", 3), ("span", True),
                         ("size", "xl"), ("size", "md"), ("hidden", "yes"), ("title", "x" * 61), ("title", "a‮b"), ("title", "a\nb"), ("color", "red")):
        assert status(_tiles_layout(**{"light.lobby": {"order": 1, field: value}})) == 422, (field, value)
    assert status(_tiles_layout(**{"light.lobby": {"span": 1}})) == 422  # the order is required
    for bad_key in ("not an id", "light", "x" * 300 + ".y", "light.a b"):
        assert status(_tiles_layout(**{bad_key: {"order": 7}})) == 422, bad_key
    # every order once within a card
    dup = _put(c, "area", "lobby", "desktop", 0, _tiles_layout(**{"light.lobby": {"order": 0}}))
    assert dup.status_code == 422 and "own order" in dup.text
    # a span within the card's tile columns (all cards have two today: the bound comes from TILE_COLS)
    original = dict(mod.TILE_COLS)
    try:
        mod.TILE_COLS["lighting"] = 1
        narrow = _put(c, "area", "lobby", "desktop", 0, _tiles_layout())
        assert narrow.status_code == 422 and "tile columns" in narrow.text
    finally:
        mod.TILE_COLS.clear()
        mod.TILE_COLS.update(original)
    # bounded counts
    assert status(_tiles_layout(**{f"light.t{i}": {"order": 10 + i} for i in range(mod.MAX_TILES)})) == 422
    # tiles need the v2 schema, an area card, the area screen
    old = _tiles_layout()
    old["v"] = 1
    v1 = _put(c, "area", "lobby", "desktop", 0, old)
    assert v1.status_code == 422 and "layout v 2" in v1.text
    assert status({"v": 2, "cols": 12, "items": {"floor:ground": {"x": 0, "y": 0, "w": 6, "h": 10, "tiles": {"light.lobby": {"order": 0}}}}}, scope="building", sid="main") == 422
    # nothing written by any refused request
    assert c.get(f"{URL}/area/lobby").json()["desktop"] is None
    assert c.get(f"{URL}/building/main").json()["desktop"] is None


def test_old_v1_layouts_load_and_save_unchanged(dev_app):  # noqa: F811
    """Backward compatibility: a 6b layout (v 1, no tiles) is accepted, stored and returned exactly as before - no
    `tiles` key appears - and a v 2 layout without any tiles is fine too."""
    app, _ = dev_app
    c = TestClient(app)
    r = _put(c, "area", "lobby", "desktop", 0, _desktop())
    assert r.status_code == 200
    lay = r.json()["desktop"]["layout"]
    assert lay["v"] == 1
    assert all("tiles" not in it for it in lay["items"].values())
    assert lay["items"]["card:climate"] == {"x": 8, "y": 0, "w": 4, "h": 20, "text": "md", "bg": None, "border": None, "title": None, "icon": None, "hidden": False, "hidden_entities": []}
    # a layout stored by 6b (straight into the table, as an older add-on wrote it) reads back byte for byte
    stored = {"v": 1, "cols": 12, "items": {"card:lighting": {"x": 0, "y": 0, "w": 12, "h": 10, "text": "md", "bg": None, "border": None, "title": None, "icon": None, "hidden": False, "hidden_entities": ["light.lobby"]}}}
    with app.state.db.connection() as conn:
        conn.execute("UPDATE device_layouts SET layout_json = ? WHERE scope = 'area' AND scope_id = 'lobby' AND variant = 'desktop'", (json.dumps(stored),))
    assert c.get(f"{URL}/area/lobby").json()["desktop"]["layout"] == stored
    # re-saved unchanged by an editor that knows nothing of tiles: still no tiles key
    again = _put(c, "area", "lobby", "desktop", 1, stored)
    assert again.status_code == 200 and again.json()["desktop"]["layout"] == stored
    # a v2 layout with empty tiles maps is fine and stores none
    empty = {"v": 2, "cols": 12, "items": {"card:lighting": {"x": 0, "y": 0, "w": 12, "h": 10, "tiles": {}}}}
    r3 = _put(c, "area", "lobby", "desktop", 2, empty)
    assert r3.status_code == 200 and "tiles" not in r3.json()["desktop"]["layout"]["items"]["card:lighting"]


def test_tile_columns_match_the_frontend():
    src = (ROOT / "frontend" / "src" / "screens" / "devices-layout.ts").read_text(encoding="utf-8")
    m = re.search(r"export const TILE_COLS: Record<string, number> = \{([^}]*)\}", src)
    assert m, "TILE_COLS not found in devices-layout.ts"
    front = {k: int(v) for k, v in re.findall(r"(\w+): (\d+)", m.group(1))}
    assert front == mod.TILE_COLS
    assert re.search(rf"export const LAYOUT_VERSION = {mod.LAYOUT_VERSION};", src)
