"""Project backups: create / list / download, restore into a fresh installation (ids and plan files kept), merge
mode, confirmation and permissions, pre-upgrade copy before migrations, and pruning of automatic copies."""
from __future__ import annotations

import io
import json
import zipfile
from dataclasses import replace

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise import __version__
from smplwise.db import Database, get_setting, set_setting
from smplwise.main import create_app
from smplwise.services import backup as svc

RECT = [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.3}, {"x": 0.1, "y": 0.3}]


def _seed(c: TestClient) -> dict:
    ids = seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 2, "alias": "Lobby cam"}).json()
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    a = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.2, "y": 0.2, "rotation_degrees": 45, "field_of_view_degrees": 90}).json()
    z = c.post(f"/api/v1/floors/{ids['floor2']}/zones", json={"name": "לובי", "polygon": RECT}).json()
    assert c.patch("/api/v1/settings", json={"ui.design": "b"}).status_code == 200
    return {**ids, "camera": cam["id"], "version": v["id"], "anchor": a["id"], "zone": z["id"]}


def test_backup_roundtrip_into_fresh_installation(settings, tmp_path):
    app = create_app(settings)
    c = TestClient(app)
    ids = _seed(c)
    # create, list, download
    r = c.post("/api/v1/backups", json={"note": "before the tests"})
    assert r.status_code == 201, r.text
    e = r.json()
    assert e["kind"] == "manual" and e["note"] == "before the tests" and e["tables"]["floors"] == 2 and e["tables"]["spatial_zones"] == 1 and e["files"] >= 2
    listing = c.get("/api/v1/backups").json()
    assert [b["name"] for b in listing["backups"]] == [e["name"]] and listing["bytes"] == e["bytes"]
    d = c.get(f"/api/v1/backups/{e['name']}/download")
    assert d.status_code == 200 and d.headers["content-type"].startswith("application/zip")
    with zipfile.ZipFile(io.BytesIO(d.content)) as z:
        manifest = json.loads(z.read("manifest.json"))
        assert manifest["app_version"] == __version__ and manifest["tables"]["cameras"] == 1
        assert any(n.startswith("files/plans/") for n in z.namelist())
    # a fresh installation (new data dir) gets everything back through upload + restore
    settings2 = replace(settings, data_dir=tmp_path / "data2")
    app2 = create_app(settings2)
    c2 = TestClient(app2)
    assert c2.get("/api/v1/sites?tree=true").json()["sites"] == []
    up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", d.content, "application/zip")})
    assert up.status_code == 201 and up.json()["kind"] == "manual"
    assert c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "confirm": "nope"}).status_code == 422
    res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert res.json()["tables"]["floors"] == 2 and res.json()["files"] >= 2
    m = c2.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    assert m["plan"]["id"] == ids["version"] and [a["id"] for a in m["anchors"]] == [ids["anchor"]] and [z["id"] for z in m["zones"]] == [ids["zone"]]
    assert c2.get(f"/api/v1/plan-versions/{ids['version']}/image.png").status_code == 200
    assert c2.get("/api/v1/settings").json()["settings"]["ui.design"] == "b"
    assert c2.get("/api/v1/me").json()["has_access"] is True, "the restoring administrator keeps access"
    # merge adds only what is missing
    extra = c2.post(f"/api/v1/floors/{ids['floor2']}/zones", json={"name": "מחסן", "polygon": RECT}).json()
    res2 = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "merge", "confirm": "RESTORE"}).json()
    names = sorted(z["name"] for z in c2.get(f"/api/v1/floors/{ids['floor2']}/zones").json()["zones"])
    assert names == ["לובי", "מחסן"] and res2["mode"] == "merge" and extra["id"]
    # a bogus upload is refused; unknown names are 404; a viewer may not touch backups
    assert c2.post("/api/v1/backups/upload", files={"file": ("x.zip", b"not a zip", "application/zip")}).status_code == 422
    assert c2.get("/api/v1/backups/nope.zip").status_code == 404
    bind(c2, settings2, "ron", "viewer", "floor", ids["floor2"])
    assert c2.get("/api/v1/backups", headers=as_user("ron")).status_code == 403
    assert c2.post("/api/v1/backups", json={}, headers=as_user("ron")).status_code == 403
    with app2.state.db.connection() as conn:
        acts = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'backup.%' ORDER BY rowid").fetchall()]
    assert acts[:2] == ["backup.upload", "backup.restore"]
    assert c2.delete(f"/api/v1/backups/{up.json()['name']}").status_code == 204
    assert c2.get("/api/v1/backups").json()["backups"] == []


def test_review_m3_an_archive_carries_none_of_the_settings_a_restore_never_writes(settings):
    """Security review M3: SETTINGS_KEEP stopped the RESTORE of the bridge secret; the export must leave every such key
    out too - a backup file is downloaded, emailed and uploaded."""
    app = create_app(settings)
    c = TestClient(app)
    _seed(c)
    with app.state.db.connection() as conn:
        for k in svc.SETTINGS_KEEP - {"permission_revision"}:  # the revision is an integer the app reads back
            set_setting(conn, k, f"value-of-{k}-9f3a")
        set_setting(conn, "bridge.secret", "TOP-SECRET-BRIDGE-9f3a")
    e = c.post("/api/v1/backups", json={}).json()
    raw = c.get(f"/api/v1/backups/{e['name']}/download").content
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        rows = json.loads(z.read("data/settings.json"))
        blob = b"".join(z.read(n) for n in z.namelist() if n.startswith("data/") or n == "manifest.json")
    keys = {r["key"] for r in rows}
    assert "ui.design" in keys, "the project's own settings are still exported"
    assert keys.isdisjoint(svc.SETTINGS_KEEP) and b"bridge.secret" not in blob and b"TOP-SECRET-BRIDGE" not in blob
    # the automatic copy before an upgrade is the same snapshot
    with app.state.db.connection() as conn:
        set_setting(conn, "app.version", "0.0.1")
    out = svc.pre_upgrade(settings)
    assert out is not None
    with zipfile.ZipFile(out) as z:
        assert b"TOP-SECRET-BRIDGE" not in z.read("data/settings.json")


def test_review_m4_the_alarm_zone_pairing_overrides_round_trip_through_a_backup(settings, tmp_path):
    """Review M4: alarm_zone_overrides (the administrator's zone <-> bypass pairing, migration 0036) is project data. It has
    no parent or child table (no foreign keys), so its place in PROJECT_TABLES is free; codes, PINs and lockouts are NOT
    project tables and stay out."""
    assert "alarm_zone_overrides" in svc.PROJECT_TABLES
    assert {"alarm_panel_codes", "alarm_user_policy", "alarm_lockouts"}.isdisjoint(svc.PROJECT_TABLES + svc.ACCESS_TABLES)
    app = create_app(settings)
    c = TestClient(app)
    _seed(c)
    rows = [("binary_sensor.front_door", "alarm_control_panel.risco_house", "switch.front_door_bypassed", 0), ("binary_sensor.aux", None, "", 1)]
    with app.state.db.connection() as conn:
        conn.executemany("INSERT INTO alarm_zone_overrides(zone_entity_id, panel_entity_id, bypass_entity_id, excluded, updated_at, updated_by) VALUES (?, ?, ?, ?, '2026-09-29T10:00:00Z', 'dev-joni')", rows)
    e = c.post("/api/v1/backups", json={}).json()
    assert e["tables"]["alarm_zone_overrides"] == 2
    raw = c.get(f"/api/v1/backups/{e['name']}/download").content
    settings2 = replace(settings, data_dir=tmp_path / "data2")
    app2 = create_app(settings2)
    c2 = TestClient(app2)
    with app2.state.db.connection() as conn:  # a stale row of the target that the replace must not leave behind
        conn.execute("INSERT INTO alarm_zone_overrides(zone_entity_id, excluded, updated_at) VALUES ('binary_sensor.stale', 0, '2026-09-29T10:00:00Z')")
    up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", raw, "application/zip")})
    res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert res.json()["tables"]["alarm_zone_overrides"] == 2
    with app2.state.db.connection() as conn:
        got = conn.execute("SELECT zone_entity_id, panel_entity_id, bypass_entity_id, excluded, updated_by FROM alarm_zone_overrides ORDER BY zone_entity_id").fetchall()
    assert [tuple(r) for r in got] == [("binary_sensor.aux", None, "", 1, "dev-joni"), ("binary_sensor.front_door", "alarm_control_panel.risco_house", "switch.front_door_bypassed", 0, "dev-joni")]
    # a merge adds a missing row and keeps an existing one
    with app2.state.db.connection() as conn:
        conn.execute("DELETE FROM alarm_zone_overrides WHERE zone_entity_id = 'binary_sensor.aux'")
        conn.execute("UPDATE alarm_zone_overrides SET panel_entity_id = 'alarm_control_panel.risco_garden' WHERE zone_entity_id = 'binary_sensor.front_door'")
    res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "merge", "confirm": "RESTORE"})
    assert res.status_code == 200 and res.json()["tables"]["alarm_zone_overrides"] == 1
    with app2.state.db.connection() as conn:
        assert {r[0]: r[1] for r in conn.execute("SELECT zone_entity_id, panel_entity_id FROM alarm_zone_overrides")} == {"binary_sensor.aux": None, "binary_sensor.front_door": "alarm_control_panel.risco_garden"}


def test_pre_upgrade_backup_and_prune(settings):
    app = create_app(settings)
    c = TestClient(app)
    _seed(c)
    db = Database(settings.db_path)
    # same version recorded → nothing to do; an older recorded version → one automatic copy
    assert svc.pre_upgrade(settings) is None
    with db.connection() as conn:
        set_setting(conn, "app.version", "0.0.1")
    out = svc.pre_upgrade(settings)
    assert out is not None and out.name.startswith("auto-pre-upgrade-")
    assert svc.read_manifest(out)["note"].startswith("before upgrade 0.0.1")
    svc.record_version(db)
    with db.connection() as conn:
        assert get_setting(conn, "app.version") == __version__
    # pruning keeps the newest automatic copies only; manual copies are untouched
    for i in range(7):
        svc.create_standalone(settings, db, "auto-daily", f"day {i}")
    svc.create_standalone(settings, db, "manual", "keep me")
    removed = svc.prune(settings)
    kinds = [b["kind"] for b in svc.list_backups(settings)]
    assert kinds.count("auto-daily") == svc.KEEP["auto-daily"] and kinds.count("manual") == 1 and kinds.count("auto-pre-upgrade") == 1
    assert len(removed) == 7 - svc.KEEP["auto-daily"]


def _wall(wid: str, polyline: list[list[float]]) -> dict:
    return {"id": wid, "level_id": "L0", "polyline": polyline, "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior",
            "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}


def test_backup_roundtrip_keeps_the_structure_objects_custom_items_zones_and_anchors(settings, tmp_path):
    """Owner form item 15 (round 9): the Plan Studio rows travel with a project backup. A floor with a published
    structure (walls, a door, an object) and a newer draft, a custom library item, a zone and an anchor is restored
    into a fresh installation: the published and the draft documents come back with the same hashes."""
    c = TestClient(create_app(settings))
    ids = _seed(c)
    v = ids["version"]
    g = c.get(f"/api/v1/plan-versions/{v}/geometry?draft=true").json()
    doc = {**g["doc"], "walls": [_wall("w1", [[0.1, 0.2], [0.8, 0.2]]), _wall("w2", [[0.1, 0.2], [0.1, 0.8]])],
           "openings": [{"id": "d1", "wall_id": "w1", "t": 0.5, "kind": "door", "width_m": 0.9, "height_m": 2.1, "sill_m": 0, "swing": "right", "hinge": "start",
                         "anchor_ref": None, "confidence": 1, "source": "manual", "external_ids": {}}],
           "objects": [{"id": "o1", "item_id": "chair.basic", "level_id": "L0", "position": [0.5, 0.5], "rotation_deg": 30, "size": {"w_m": 0.45, "d_m": 0.45, "h_m": 0.85},
                        "z_m": 0, "params": {}, "label": "כיסא", "anchor_ref": None, "group_id": None, "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}]}
    r = c.put(f"/api/v1/plan-versions/{v}/geometry", json={"doc": doc, "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    assert c.post(f"/api/v1/plan-versions/{v}/geometry/publish").status_code == 200
    g = c.get(f"/api/v1/plan-versions/{v}/geometry?draft=true").json()
    r = c.put(f"/api/v1/plan-versions/{v}/geometry", json={"doc": {**g["doc"], "walls": [*g["doc"]["walls"], _wall("w3", [[0.3, 0.6], [0.7, 0.6]])]}, "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    item = c.post("/api/v1/catalog/objects", json={"based_on": "chair.basic", "names": {"he": "כיסא גיבוי", "en": "Backup chair"}})
    assert item.status_code == 201, item.text
    published = c.get(f"/api/v1/plan-versions/{v}/geometry").json()
    draft = c.get(f"/api/v1/plan-versions/{v}/geometry?draft=true").json()
    assert published["geometry"]["doc_hash"] != draft["geometry"]["doc_hash"]
    custom = c.get("/api/v1/catalog/export").json()["items"]
    e = c.post("/api/v1/backups", json={"note": "studio"}).json()
    assert e["tables"]["plan_geometry"] == 2 and e["tables"]["catalog_items"] == 1
    zipped = c.get(f"/api/v1/backups/{e['name']}/download").content

    c2 = TestClient(create_app(replace(settings, data_dir=tmp_path / "data3")))
    up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", zipped, "application/zip")}).json()
    res = c2.post(f"/api/v1/backups/{up['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert res.json()["tables"]["plan_geometry"] == 2 and res.json()["tables"]["catalog_items"] == 1
    p2 = c2.get(f"/api/v1/plan-versions/{v}/geometry").json()
    d2 = c2.get(f"/api/v1/plan-versions/{v}/geometry?draft=true").json()
    assert p2["geometry"]["doc_hash"] == published["geometry"]["doc_hash"] and p2["doc"] == published["doc"]
    assert d2["geometry"]["doc_hash"] == draft["geometry"]["doc_hash"] and d2["geometry"]["revision"] == draft["geometry"]["revision"]
    assert [w["id"] for w in p2["doc"]["walls"]] == ["w1", "w2"] and [w["id"] for w in d2["doc"]["walls"]] == ["w1", "w2", "w3"]
    assert [o["id"] for o in p2["doc"]["objects"]] == ["o1"] and p2["doc"]["openings"][0]["id"] == "d1"
    assert c2.get("/api/v1/catalog/export").json()["items"] == custom
    m = c2.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    assert [a["id"] for a in m["anchors"]] == [ids["anchor"]] and [z["id"] for z in m["zones"]] == [ids["zone"]]
    assert m["geometry"] is not None


def test_a_merge_restore_counts_only_the_rows_it_added(settings):
    """Round 9 (owner form item 15): the restore answer - and the "שוחזר ... N קומות" line built from it - counts the rows
    the restore wrote. A merge over an unchanged project adds nothing and says so; a hard-deleted custom item comes back
    as one row. A merge cannot bring back a soft-deleted floor (its tombstone row is not missing) and does not claim to."""
    c = TestClient(create_app(settings))
    ids = _seed(c)
    item = c.post("/api/v1/catalog/objects", json={"based_on": "chair.basic", "names": {"he": "כיסא מיזוג"}}).json()
    e = c.post("/api/v1/backups", json={"note": "merge counts"}).json()
    res = c.post(f"/api/v1/backups/{e['name']}/restore", json={"mode": "merge", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert all(n == 0 for n in res.json()["tables"].values()), res.json()["tables"]
    assert c.delete(f"/api/v1/catalog/objects/{item['id']}").status_code == 204
    assert c.delete(f"/api/v1/floors/{ids['floor2']}?force=true").status_code == 204
    res = c.post(f"/api/v1/backups/{e['name']}/restore", json={"mode": "merge", "confirm": "RESTORE"}).json()
    assert res["tables"]["catalog_items"] == 1 and res["tables"]["floors"] == 0
    assert sum(res["tables"].values()) == 1, res["tables"]
    assert [x["id"] for x in c.get("/api/v1/catalog/objects").json()["items"] if x["custom"]] == [item["id"]]
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").status_code == 404
    # replace writes every row of the archive
    res = c.post(f"/api/v1/backups/{e['name']}/restore", json={"mode": "replace", "confirm": "RESTORE"}).json()
    assert res["tables"]["floors"] == 2 and res["tables"]["catalog_items"] == 1
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").status_code == 200


def test_cr019_switch_protection_is_in_the_backup_and_an_older_archive_never_empties_it(settings, tmp_path):
    """CR-019 section 6.6: device_bulk_protected and device_switch_classified are project tables (safety state). A replace
    restore of an archive that has them restores them; one written before them (no member) keeps the current rows instead
    of emptying them - an old backup must never unprotect every switch. device_bulk_safe (frozen) stays out."""
    assert {"device_bulk_protected", "device_switch_classified"} <= set(svc.PROJECT_TABLES) and "device_bulk_safe" not in svc.PROJECT_TABLES
    app = create_app(settings)
    c = TestClient(app)
    _seed(c)

    def protect(conn, eid: str, source: str = "manual") -> None:
        conn.execute("INSERT INTO device_bulk_protected(entity_id, source, marked_at, reviewed) VALUES (?, ?, '2026-10-01T10:00:00Z', 1)", (eid, source))
        conn.execute("INSERT INTO device_switch_classified(entity_id, verdict, classifier_version, classified_at) VALUES (?, 'protected', 1, '2026-10-01T10:00:00Z')", (eid,))

    with app.state.db.connection() as conn:
        protect(conn, "switch.pool_pump", "auto")
        conn.execute("INSERT INTO device_switch_classified(entity_id, verdict, classifier_version, classified_at) VALUES ('switch.hall', 'admin_cleared', 1, '2026-10-01T10:00:00Z')")
    e = c.post("/api/v1/backups", json={}).json()
    assert e["tables"]["device_bulk_protected"] == 1 and e["tables"]["device_switch_classified"] == 2
    raw = c.get(f"/api/v1/backups/{e['name']}/download").content
    # an archive written before CR-019: the same zip without the two members
    old = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(raw)) as zin, zipfile.ZipFile(old, "w") as zout:
        for n in zin.namelist():
            if n not in ("data/device_bulk_protected.json", "data/device_switch_classified.json"):
                zout.writestr(n, zin.read(n))
    settings2 = replace(settings, data_dir=tmp_path / "data2")
    app2 = create_app(settings2)
    c2 = TestClient(app2)
    with app2.state.db.connection() as conn:
        protect(conn, "switch.gate_motor")
    up = c2.post("/api/v1/backups/upload", files={"file": ("old.zip", old.getvalue(), "application/zip")})
    res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert set(res.json()["kept_current"]) == {"device_bulk_protected", "device_switch_classified"}
    with app2.state.db.connection() as conn:
        assert [r[0] for r in conn.execute("SELECT entity_id FROM device_bulk_protected")] == ["switch.gate_motor"], "kept, not emptied"
    # the archive that has them: restored as usual (replace = equal to the backup)
    up = c2.post("/api/v1/backups/upload", files={"file": ("new.zip", raw, "application/zip")})
    res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200 and res.json()["kept_current"] == [] and res.json()["tables"]["device_bulk_protected"] == 1
    with app2.state.db.connection() as conn:
        assert {r[0]: r[1] for r in conn.execute("SELECT entity_id, source FROM device_bulk_protected")} == {"switch.pool_pump": "auto"}
        assert {r[0]: r[1] for r in conn.execute("SELECT entity_id, verdict FROM device_switch_classified")} == {"switch.pool_pump": "protected", "switch.hall": "admin_cleared"}


def test_frigate_write_class_tables_are_in_the_backup_and_an_older_archive_keeps_history_but_never_a_class(settings, tmp_path):
    """2.2.0 gap (CR-029 F2): the class policy, the change log, the alarm -> profile mapping and the reviewed state with its mirror columns are
    project tables. A replace restore of an archive that has them brings them back; one written before them keeps the change log and the
    reviewed state (history) but leaves every write class OFF (never a class that happened to be on). frigate_reviews / frigate_sync_state
    (re-polled) and camera_links stay out."""
    assert set(svc.FRIGATE_TABLES) <= set(svc.PROJECT_TABLES)
    assert {"frigate_reviews", "frigate_sync_state", "camera_links"}.isdisjoint(svc.PROJECT_TABLES)
    assert {"frigate_changes", "frigate_review_state"} <= svc.KEEP_WHEN_ABSENT and "frigate_write_policy" not in svc.KEEP_WHEN_ABSENT
    app = create_app(settings)
    c = TestClient(app)
    _seed(c)
    with app.state.db.connection() as conn:
        conn.executemany("INSERT INTO frigate_write_policy(recorder_id, class, enabled, changed_by, changed_at) VALUES ('nvr-2', ?, ?, 'dev-joni', '2026-10-06T08:00:00Z')", [("analytics", 1), ("events", 1), ("record", 0)])
        conn.execute("INSERT INTO frigate_changes(id, recorder_id, camera_id, camera_key, class, kind, target, before_json, after_json, state_hash, status, reversible, actor_id, actor_name, created_at) "
                     "VALUES ('ch-1', 'nvr-2', NULL, 'cam_front', 'analytics', 'feature', 'detect', '{\"value\": true}', '{\"value\": false}', 'h1', 'applied', 1, 'dev-joni', 'joni', '2026-10-06T08:01:00Z')")
        conn.execute("INSERT INTO frigate_profile_rules(recorder_id, alarm_state, profile, changed_by, changed_at) VALUES ('nvr-2', 'armed_away', 'away', 'dev-joni', '2026-10-06T08:02:00Z')")
        conn.executemany("INSERT INTO frigate_review_state(user_id, recorder_id, review_id, reviewed_at, mirrored_at, mirror_error) VALUES ('u1', 'nvr-2', ?, '2026-10-06T08:03:00Z', ?, ?)",
                         [("1791000000-aaaaaa", "2026-10-06T08:03:01Z", None), ("1791000001-bbbbbb", None, "frigate_write_class_off")])
        conn.execute("INSERT INTO frigate_reviews(recorder_id, review_id, source_ref, severity, start_ts, last_seen_at, created_at) VALUES ('nvr-2', 'x', 'cam_front', 'alert', 1.0, '2026-10-06T08:00:00Z', '2026-10-06T08:00:00Z')")
    e = c.post("/api/v1/backups", json={}).json()
    assert e["tables"]["frigate_write_policy"] == 3 and e["tables"]["frigate_changes"] == 1 and e["tables"]["frigate_profile_rules"] == 1 and e["tables"]["frigate_review_state"] == 2
    raw = c.get(f"/api/v1/backups/{e['name']}/download").content
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        assert "data/frigate_reviews.json" not in z.namelist() and "data/frigate_sync_state.json" not in z.namelist()
        assert b"password" not in z.read("data/frigate_changes.json").lower()

    # a fresh installation restores all of it, columns included
    app2 = create_app(replace(settings, data_dir=tmp_path / "data2"))
    c2 = TestClient(app2)
    up = c2.post("/api/v1/backups/upload", files={"file": ("new.zip", raw, "application/zip")})
    res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert res.json()["tables"]["frigate_write_policy"] == 3 and res.json()["kept_current"] == []
    with app2.state.db.connection() as conn:
        assert {r["class"]: r["enabled"] for r in conn.execute("SELECT class, enabled FROM frigate_write_policy WHERE recorder_id = 'nvr-2'")} == {"analytics": 1, "events": 1, "record": 0}
        ch = dict(conn.execute("SELECT * FROM frigate_changes WHERE id = 'ch-1'").fetchone())
        assert ch["target"] == "detect" and ch["before_json"] == '{"value": true}' and ch["state_hash"] == "h1" and ch["status"] == "applied" and ch["actor_name"] == "joni"
        assert [tuple(r) for r in conn.execute("SELECT alarm_state, profile FROM frigate_profile_rules")] == [("armed_away", "away")]
        assert {r["review_id"]: (r["mirrored_at"], r["mirror_error"]) for r in conn.execute("SELECT * FROM frigate_review_state")} == {
            "1791000000-aaaaaa": ("2026-10-06T08:03:01Z", None), "1791000001-bbbbbb": (None, "frigate_write_class_off")}
        assert conn.execute("SELECT COUNT(*) FROM frigate_reviews").fetchone()[0] == 0, "re-polled history is not restored from the archive"

    # an archive written before the Frigate tables: history is kept, no class stays on
    old = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(raw)) as zin, zipfile.ZipFile(old, "w") as zout:
        for n in zin.namelist():
            if n not in {f"data/{t}.json" for t in svc.FRIGATE_TABLES}:
                zout.writestr(n, zin.read(n))
    up = c2.post("/api/v1/backups/upload", files={"file": ("old.zip", old.getvalue(), "application/zip")})
    res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert {"frigate_changes", "frigate_review_state"} <= set(res.json()["kept_current"]) and "frigate_write_policy" not in res.json()["kept_current"]
    with app2.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM frigate_write_policy").fetchone()[0] == 0, "every class is OFF again"
        assert conn.execute("SELECT COUNT(*) FROM frigate_profile_rules").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM frigate_changes").fetchone()[0] == 1 and conn.execute("SELECT COUNT(*) FROM frigate_review_state").fetchone()[0] == 2
