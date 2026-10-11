"""SEC-WXD (2026-10-12): proofs of concept for the second-pass security review of the CR-033 WisKey door path, slices D0-D9
as combined on `pilot/SEC-WXD-review` (docs/security/SECURITY_REVIEW_WXD_DOORPATH_2026-10-12.md).

Fakes only: no Home Assistant, no bridge, no WisKey, no door, no key. The pairing secret is the published golden-vector TEST
constant; station ids are synthetic opaque strings.

Every test asserts the CURRENT (unfixed) behaviour of one finding, so it passes while the finding is open and fails on purpose
once a fix lands. Invert it into a regression test then (or drop it). The test names carry the finding id of the report."""
from __future__ import annotations

import copy
import datetime as _dt
import json
import uuid
from typing import Any

import pytest
from automations_fixture import autos_app  # noqa: F401  (the CR-017 automations fixture)
from automations_fixture import create_item, draft_of, get_item, put_item, svc_block
from automations_transport import seed_mirror
from conftest import as_user, bind, png_bytes, seed_tree
from fake_trusted_bridge import TEST_SECRET, FakeTrustedBridge, FakeWisKeyFeed, station
from fastapi.testclient import TestClient
from schedules_fixture import sched_app  # noqa: F401  (the CR-014 schedules fixture)
from schedules_fixture import act, post_json, slot
from schedules_fixture import draft_of as sched_draft
from schedules_fixture import rid as sched_rid

from smplwise.db import Database, new_id, now_iso, permission_revision, set_setting
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.rbac import STATION, Principal, permissions_anywhere
from smplwise.routers import access_control
from smplwise.services import automations, door_authority, door_path, door_run_guard, ha_client, intercom_sync, trusted_door

API = "/api/v1"
ENTRY = "01JSECWXDSTATIONENTRY0000A"  # synthetic opaque config entry ids (never a hardware id)
SIDE = "01JSECWXDSTATIONENTRY0000B"


@pytest.fixture(autouse=True)
def _clean():
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()
    door_run_guard.set_conversion_source(None)
    yield
    access_control.RELAYS.clear()
    intercom_sync.SYNC.reset()
    door_run_guard.set_conversion_source(None)


# ================================================================ helpers

@pytest.fixture()
def door_world(settings, monkeypatch):
    """A served WisKey copy (entrance: online, one relay; side door: OFFLINE, one relay), two WisKey lock entities, an ordinary
    lock, a template lock and a template switch in the registry mirror, a paired bridge whose `execute` is recorded (never
    sent) and the interim station-release transport recorded by FakeWisKeyFeed (never sent)."""
    feed = FakeWisKeyFeed([station(ENTRY, "כניסה ראשית"), station(SIDE, "דלת צד", online=False)]).install(monkeypatch)
    app = create_app(settings)
    c = TestClient(app)
    db = Database(settings.db_path)
    executed: list[dict[str, Any]] = []
    monkeypatch.setattr(ha_client, "call_bridge_execute", lambda _s, payload, *a, **k: executed.append(payload) or {"ok": True})
    rows = (("lock.entrance", "hikvision_intercom", ENTRY), ("lock.side", "smplwise_intercom", SIDE), ("lock.office", "nuki", None),
            ("lock.virtual", "template", None), ("switch.gate", "template", None))
    with db.connection() as conn:
        for eid, platform, entry in rows:
            domain = eid.split(".")[0]
            conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, config_entry_id, state, state_seen_at, first_seen_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                         (eid, domain, eid.split(".")[1], platform, entry, "locked" if domain == "lock" else "off", now_iso(), now_iso(), now_iso()))
        set_setting(conn, "bridge.secret", TEST_SECRET)
        set_setting(conn, "bridge.paired_at", now_iso())
    return {"app": app, "c": c, "db": db, "feed": feed, "executed": executed, "settings": settings}


def _env(ttl: float = 15.0, **fields: Any) -> dict[str, Any]:
    expires = (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(seconds=ttl)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"client_request_id": str(uuid.uuid4()), "expires_at": expires, **fields}


def _tile(c: TestClient, entity: str, user: str | None, action: str = "lock.unlock") -> Any:
    body = {"allowed_action_id": action, "client_request_id": str(uuid.uuid4()), "expires_at": "2099-01-01T00:00:00Z", "confirmation_grant": "confirmed"}
    return c.post(f"{API}/ha/entities/{entity}/actions", json=body, headers=as_user(user) if user else {})


def _release(c: TestClient, station_id: str, user: str, **fields: Any) -> Any:
    return c.post(f"{API}/intercom/stations/{station_id}/release", json=_env(confirmed=True, **fields), headers=as_user(user))


def _map_all(c: TestClient) -> None:
    r = c.post(f"{API}/intercom/door-map/apply-suggestions", json={"confirmed": True})
    assert r.status_code == 200 and sorted(r.json()["applied"]) == ["lock.entrance", "lock.side"], r.text


def _custom_role(c: TestClient, name: str, permissions: list[str], sensitive: list[str]) -> str:
    r = c.post(f"{API}/access/roles", json={"name": name, "permissions": permissions, "sensitive": sensitive})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _bind_api(c: TestClient, user: str, role_id: str, scope_type: str, scope_id: str, effect: str = "allow") -> Any:
    c.get(f"{API}/me", headers=as_user(user))
    return c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": f"dev-{user}", "role_id": role_id, "scope_type": scope_type, "scope_id": scope_id, "effect": effect})


def _publish_plan(c: TestClient, floor_id: str) -> None:
    """The administrator gives a floor a published plan (anchors need one)."""
    asset = c.post(f"{API}/floors/{floor_id}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
    v = c.post(f"{API}/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"{API}/plan-versions/{v['id']}/publish").status_code == 200


def _principal(user: str) -> Principal:
    return Principal(f"dev-{user}", user, user, "dev")


def _wiskey(app: Any, *entity_ids: str, fake: Any = None) -> None:
    """Make lock entities WisKey locks in the registry mirror and in the fake's registry (every write re-syncs from it)."""
    for row in getattr(fake, "registry", []) or []:
        if row.get("entity_id") in entity_ids:
            row["platform"] = "hikvision_intercom"
    with app.state.db.connection() as conn:
        for e in entity_ids:
            conn.execute("UPDATE ha_entities SET platform = 'hikvision_intercom' WHERE entity_id = ?", (e,))


def _opener(c: TestClient) -> None:
    """The bootstrap administrator also holds door.unlock (a custom role at the installation): only the D8 guard can stop a
    door step, exactly as in tests/test_wiskey_d6_d8.py."""
    rid_ = _custom_role(c, "פותח " + uuid.uuid4().hex[:6], ["map.read"], ["door.unlock"])
    r = c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": "dev-joni", "role_id": rid_, "scope_type": "installation", "scope_id": "*"})
    assert r.status_code == 201, r.text


# ================================================================ M1 - the D8 editor block is bypassed by indirect targets and by
# the schedule copy / split / restore and scene-state paths

def _lock_group(app: Any, fake: Any) -> None:
    fake.states["lock.all_doors"] = {"entity_id": "lock.all_doors", "state": "locked", "attributes": {"friendly_name": "כל הדלתות", "entity_id": ["lock.front_door"]}, "last_changed": fake.iso()}
    fake.registry.append(fake._reg_row("lock.all_doors", platform="group", unique_id="grp_doors"))
    seed_mirror(app.state.db, fake)


def test_poc_m1_typed_builder_saves_a_new_door_step_through_a_lock_group(autos_app):
    """`lock.unlock` on a lock group over the WisKey lock is saved while `doors.editor_block` is `blocked` (the default); the
    same step on the WisKey lock itself is refused. The D7/D9 resolver does see a door step in what was saved."""
    app, s, c, fake, tr = autos_app
    _opener(c)
    _lock_group(app, fake)
    _wiskey(app, "lock.front_door", fake=fake)
    direct = create_item(c, "automation", draft_of("ישיר", actions=[svc_block("lock.unlock", ["lock.front_door"])]))
    assert direct.status_code == 422 and direct.json()["code"] == "wiskey_door_step_blocked", direct.text
    via_group = create_item(c, "automation", draft_of("דרך קבוצה", actions=[svc_block("lock.unlock", ["lock.all_doors"])]))
    assert via_group.status_code == 201, via_group.text  # CURRENT: the editor block does not look through the group
    automations.MIRROR.pull(None, "test")
    with app.state.db.connection(mode="read") as conn:
        res, row = door_path.Resolver(conn).resolve_item("automation", via_group.json()["item"]["id"])
    assert row is not None and res.has_door, "the shared resolver (D7 / D9) counts it as a WisKey door step"


def test_poc_m1_code_mode_saves_a_new_door_step_through_a_lock_group(autos_app):
    app, s, c, fake, tr = autos_app
    _opener(c)
    _lock_group(app, fake)
    item = create_item(c, "automation", draft_of("בסיס")).json()["item"]
    d = get_item(c, "automation", item["id"]).json()
    cfg = d.get("config") or c.get(f"{API}/automations/automation/{item['id']}/code").json().get("config")
    assert cfg is not None
    _wiskey(app, "lock.front_door", fake=fake)

    def code(step: dict[str, Any]) -> Any:
        cur = get_item(c, "automation", item["id"]).json()
        new = copy.deepcopy(cfg)
        new["actions"] = list(new["actions"]) + [step]
        return c.put(f"{API}/automations/automation/{item['id']}/code", json={"config": new, "base_revision": cur["revision"], "client_request_id": str(uuid.uuid4()), "confirm": True})

    refused = code({"action": "lock.unlock", "target": {"entity_id": "lock.front_door"}})
    assert refused.status_code == 422 and refused.json()["code"] == "wiskey_door_step_blocked"
    through_group = code({"action": "lock.unlock", "target": {"entity_id": "lock.all_doors"}})
    assert through_group.status_code == 200, through_group.text  # CURRENT: saved
    # a device action on the WisKey lock itself: no service name, so the code-mode text check never fires
    device_action = code({"device_id": "dev-front", "domain": "lock", "entity_id": "lock.front_door", "type": "unlock"})
    assert device_action.status_code == 200, device_action.text  # CURRENT: saved
    automations.MIRROR.pull(None, "test")
    with app.state.db.connection(mode="read") as conn:
        res, _ = door_path.Resolver(conn).resolve_item("automation", item["id"])
    assert len(res.door_steps) >= 1 and any(s.entity_id == "lock.front_door" for s in res.door_steps), "the resolver sees the device action's door"


def test_poc_m1_typed_builder_saves_a_call_of_a_script_that_opens_the_door(autos_app):
    """A new `script.turn_on` step whose script unlocks the WisKey lock is saved under the block; the D9 run guard refuses to
    run the very item the D8 guard let through (one resolver for D7 / D9, another for D8)."""
    app, s, c, fake, tr = autos_app
    _opener(c)
    cfg = {"alias": "פתיחת שער", "sequence": [{"action": "lock.unlock", "target": {"entity_id": "lock.front_door"}}]}
    fake.scripts["door_script"] = cfg
    fake._seed_script_entity("door_script", cfg)
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")
    _wiskey(app, "lock.front_door", fake=fake)
    r = create_item(c, "automation", draft_of("מפעיל שער", actions=[svc_block("script.turn_on", ["script.door_script"])]))
    assert r.status_code == 201, r.text  # CURRENT: saved under doors.editor_block = blocked
    automations.MIRROR.pull(None, "test")
    with app.state.db.connection(mode="read") as conn:
        with pytest.raises(ApiError) as exc:
            door_run_guard.judge_item(conn, "automation", r.json()["item"]["id"])
    # (unmapped lock in this world, so "unresolvable"; with a door map row it is "not converted" - refused either way)
    assert exc.value.code in ("door_step_not_converted", "door_steps_unresolvable")


def test_poc_m1_an_author_without_door_unlock_adds_a_door_opening_through_a_script(autos_app):
    """The same path needs no door permission at all: the CR-017 rights judge the item's OWN typed steps for sensitive grants
    and only ask control of the called script's targets. `author` (automation.manage + ha.entity.control, no door.unlock)
    cannot add `lock.unlock` on an ordinary lock, but saves an automation (triggered by a motion sensor, so Home Assistant fires
    it on its own) that calls the script which unlocks the WisKey door. `author` is an HA non-administrator writing under
    the infrastructure's delegated-authoring switch (the CR-017 path for non-administrators)."""
    from automations_fixture import directory, grant

    app, s, c, fake, tr = autos_app
    cfg = {"alias": "פתיחת שער", "sequence": [{"action": "lock.unlock", "target": {"entity_id": "lock.front_door"}}]}
    fake.scripts["door_script"] = cfg
    fake._seed_script_entity("door_script", cfg)
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")
    _wiskey(app, "lock.front_door", fake=fake)
    tr.delegated = True
    directory(c, tr.secret, delegated=True, changed_at="2026-10-01T09:00:00Z")
    author = {"X-SW-Dev-User": "omer"}
    grant(c, "omer", "כותב אוטומציות", ["devices.read", "entity.state.read"], ["automation.manage", "ha.entity.control"], "installation", "*")
    plain = create_item(c, "automation", draft_of("מנעול רגיל", actions=[svc_block("lock.unlock", ["lock.side_door"])]), headers=author)
    assert plain.status_code == 403 and "door.unlock" in plain.text, plain.text  # door.unlock is required for a lock step of the item itself
    r = create_item(c, "automation", draft_of("שער בתנועה", actions=[svc_block("script.turn_on", ["script.door_script"])]), headers=author)
    assert r.status_code == 201, r.text  # CURRENT: saved - no door permission, editor block on


def test_poc_m1_scene_member_flipped_from_locked_to_unlocked_is_not_a_new_step(autos_app):
    """An existing scene that captured the WisKey lock as `locked` (harmless: WisKey refuses lock) is edited to `unlocked` - a
    new door opening - and saved under the block."""
    app, s, c, fake, tr = autos_app
    _opener(c)
    r = create_item(c, "scene", {"name": "ערב", "icon": None, "members": [{"entity_id": "lock.front_door", "state": "locked", "attributes": {}}]})
    assert r.status_code == 201, r.text
    sid = r.json()["item"]["id"]
    _wiskey(app, "lock.front_door", fake=fake)
    d = get_item(c, "scene", sid).json()
    draft = copy.deepcopy(d["draft"])
    for m in draft["members"]:
        if m["entity_id"] == "lock.front_door":
            m["state"] = "unlocked"
    up = put_item(c, "scene", sid, draft, d["revision"])
    assert up.status_code == 200, up.text  # CURRENT: saved - the guard only asks whether the lock was a member before
    automations.MIRROR.pull(None, "test")
    with app.state.db.connection(mode="read") as conn:
        res, _ = door_path.Resolver(conn).resolve_item("scene", sid)
    assert res.door_steps, "the stored scene now opens the WisKey door"


def test_poc_m1_schedule_copy_creates_a_new_door_step_the_editor_refuses(sched_app):
    app, s, c, fake, tr = sched_app
    rid_ = _custom_role(c, "פותח " + uuid.uuid4().hex[:6], ["map.read"], ["door.unlock"])
    assert c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": "dev-joni", "role_id": rid_, "scope_type": "installation", "scope_id": "*"}).status_code == 201

    def create(name: str) -> Any:
        return post_json(c, "/schedules", {"draft": sched_draft(name, [slot("08:00:00", None, act("lock.unlock", "lock.front_door"))]), "enabled": True,
                                           "client_request_id": sched_rid(), "confirm_lowering": True})

    first = create("פתיחה בבוקר")
    assert first.status_code == 201, first.text
    sid = first.json()["schedule"]["id"]
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET platform = 'hikvision_intercom' WHERE entity_id = 'lock.front_door'")
    refused = create("עוד פתיחה")
    assert refused.status_code == 422 and refused.json()["code"] == "wiskey_door_step_blocked", refused.text
    copied = post_json(c, f"/schedules/{sid}/copy", {"name": "עותק של פתיחה", "client_request_id": sched_rid(), "confirm_lowering": True})
    assert copied.status_code == 201, copied.text  # CURRENT: a NEW schedule with the WisKey door step, under the block
    new_id_ = copied.json()["schedule"]["id"]
    assert new_id_ != sid
    with app.state.db.connection(mode="read") as conn:
        item = json.loads(conn.execute("SELECT item_json FROM schedule_cache WHERE schedule_id = ?", (new_id_,)).fetchone()[0])
        assert door_path.Resolver(conn).resolve_schedule_slots(item).door_steps, "the copy opens the WisKey door"


# ================================================================ M2 - `door.unlock` follows wherever an editor places the lock

def test_poc_m2_a_floor_editor_extends_floor_door_unlock_to_any_wiskey_door_by_placing_it(door_world):
    """`ed` edits floor 2 (built-in editor role) and holds a floor-2 custom role with door.unlock (meant for floor 2's own locks).
    The entrance's WisKey lock is not on floor 2: ed cannot open it. ed places the lock entity on floor 2 (placement.edit there
    is all the anchor route asks for an HA entity) and from then on opens the entrance from the WisKey screen and the tile."""
    c, db, feed = door_world["c"], door_world["db"], door_world["feed"]
    ids = seed_tree(c)
    _publish_plan(c, ids["floor2"])
    _map_all(c)
    opener = _custom_role(c, "פותח מנעולי קומה 2", ["map.read"], ["door.unlock"])
    assert _bind_api(c, "ed", "editor", "floor", ids["floor2"]).status_code == 201
    assert _bind_api(c, "ed", opener, "floor", ids["floor2"]).status_code == 201
    before = _release(c, ENTRY, "ed")
    assert before.status_code == 403, before.text
    assert feed.sent == []
    placed = c.post(f"{API}/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "lock.entrance", "x": 0.5, "y": 0.5}, headers=as_user("ed"))
    assert placed.status_code == 201, placed.text  # CURRENT: no reach check on the entity being placed (cameras have one, T055 B1)
    with db.connection(mode="read") as conn:
        d = door_authority.check(conn, _principal("ed"), ENTRY, 1, dev_mode=True)
    assert d.allowed and d.granted_by == "door.unlock" and (d.scope_type, d.scope_id) == ("floor", ids["floor2"])
    after = _release(c, ENTRY, "ed")
    assert after.status_code == 200, after.text
    assert _tile(c, "lock.entrance", "ed").status_code == 202
    assert len(feed.sent) == 2 and all(f["frames"][0]["station_id"] == ENTRY for f in feed.sent)


# ================================================================ M3 - template entities other than locks / buttons are "not a door"

def _script_item(db: Database, item_id: str, sequence: list[dict[str, Any]]) -> None:
    with db.connection() as conn:
        conn.execute("INSERT INTO ha_config_items(kind, item_id, config_id, entity_id, source, revision, config_json, masked, seen_at, changed_at) VALUES ('script', ?, ?, ?, 'ui', ?, ?, 0, ?, ?)",
                     (item_id, item_id, f"script.{item_id}", uuid.uuid4().hex[:16], json.dumps({"alias": item_id, "sequence": sequence}), now_iso(), now_iso()))


def test_poc_m3_a_template_switch_wrapper_is_not_judged_as_a_possible_door(door_world):
    """R-17 is fail closed for template locks and template buttons, whose action sequences the mirror does not hold. A template
    switch (or cover, light, fan, select, number, valve, vacuum, alarm panel ...) runs an action sequence just as freely, yet
    its turn_on is judged "no door": the run guard lets a script that presses it run, and the tile guard sends it to
    `execute` for an operator who holds no door permission at all."""
    c, db, executed = door_world["c"], door_world["db"], door_world["executed"]
    _map_all(c)
    _script_item(db, "via_template_lock", [{"action": "lock.unlock", "target": {"entity_id": "lock.virtual"}}])
    _script_item(db, "via_template_switch", [{"action": "switch.turn_on", "target": {"entity_id": "switch.gate"}}])
    with db.connection(mode="read") as conn:
        with pytest.raises(ApiError) as exc:
            door_run_guard.judge_item(conn, "script", "via_template_lock")
        assert exc.value.code == "door_steps_unresolvable"
        assert door_run_guard.judge_item(conn, "script", "via_template_switch") is None  # CURRENT: runs unchanged
        door_run_guard.judge_entity_action(conn, "switch.gate", "switch.turn_on")  # CURRENT: no refusal
        assert not door_path.Resolver(conn).resolve_actions([{"action": "switch.turn_on", "target": {"entity_id": "switch.gate"}}]).has_door
    bind(c, door_world["settings"], "otto", "operator", "installation", "*")  # devices.control; no door permission
    assert _release(c, ENTRY, "otto").status_code == 403, "otto may not open the door himself"
    r = _tile(c, "switch.gate", "otto", action="switch.turn_on")
    assert r.status_code == 202 and r.json()["via"] == "bridge", r.text
    assert [p["service"] for p in executed] == ["turn_on"] and "switch.gate" in json.dumps(executed[0])


# ================================================================ L1 - a wall-display (kiosk) account is not refused as such

def test_poc_l1_a_kiosk_account_opens_doors_once_any_grant_reaches_it(door_world):
    """CR-033 4.1 step 1 refuses a kiosk principal before anything else; the code relies on the kiosk role holding neither
    permission. The grant card lists every user, so one switch (or a group) gives the unattended wall display the door."""
    c, feed = door_world["c"], door_world["feed"]
    _map_all(c)
    bind(c, door_world["settings"], "wall", "kiosk", "installation", "*")
    assert _release(c, ENTRY, "wall").status_code == 403
    users = c.get(f"{API}/access/door-grants").json()["users"]
    assert "dev-wall" in {u["id"] for u in users}, "the wall display account is offered by the grant card like a person"
    r = c.post(f"{API}/access/door-grants/subjects", json={"subject_kind": "user", "subject_id": "dev-wall", "enabled": True, "confirmed": True})
    assert r.status_code == 200 and r.json()["granted"] is True, r.text
    opened = _release(c, ENTRY, "wall")
    assert opened.status_code == 200, opened.text  # CURRENT: the kiosk account opens the entrance
    assert len(feed.sent) == 1


# ================================================================ L2 - the tile path answers before any permission check

def test_poc_l2_a_caller_without_any_permission_learns_door_and_station_facts(door_world):
    c = door_world["c"]
    c.get(f"{API}/me", headers=as_user("nobody"))
    assert _tile(c, "lock.office", "nobody").status_code == 403, "an ordinary lock: the permission comes first"
    unmapped = _tile(c, "lock.entrance", "nobody")
    assert unmapped.status_code == 409 and unmapped.json()["code"] == "intercom_lock_unmapped"  # CURRENT: "this is a WisKey door, unmapped"
    lock_all = _tile(c, "lock.entrance", "nobody", action="lock.lock")
    assert lock_all.status_code == 409 and lock_all.json()["code"] == "wiskey_lock_unsupported"
    _map_all(c)
    offline = _tile(c, "lock.side", "nobody")
    assert offline.status_code == 409 and offline.json()["code"] == "intercom_station_offline"
    assert "דלת צד" in offline.json()["user_message"], "the station's name and its online state, to a user with no binding at all"
    assert c.get(f"{API}/intercom/overview", headers=as_user("nobody")).status_code == 403, "the same facts are access.read data on the WisKey screen"


# ================================================================ L3 - the one door switch grants more than opening doors

def test_poc_l3_the_door_switch_also_grants_calls_announcements_and_the_wiskey_directory(door_world):
    c = door_world["c"]
    c.get(f"{API}/me", headers=as_user("gil"))
    c.get(f"{API}/me", headers=as_user("nobody"))
    r = c.post(f"{API}/access/door-grants/subjects", json={"subject_kind": "user", "subject_id": "dev-gil", "enabled": True, "confirmed": True})
    assert r.status_code == 200, r.text
    # the permission gate of call answer / hang-up and of announcements (access.release at installation) now passes: the
    # empty body is refused by validation (422), not by permission (403) as for a user without the switch
    assert c.post(f"{API}/intercom/stations/{ENTRY}/call", json={}, headers=as_user("gil")).status_code == 422
    assert c.post(f"{API}/intercom/stations/{ENTRY}/tts", json={}, headers=as_user("gil")).status_code == 422
    assert c.post(f"{API}/intercom/stations/{ENTRY}/call", json={}, headers=as_user("nobody")).status_code == 403
    # access.read at installation: the WisKey screen (and, by the same `_reader` gate, its entry events and the people
    # directory - routers/access_control.py events / people / person)
    assert c.get(f"{API}/intercom/overview", headers=as_user("gil")).status_code == 200
    assert c.get(f"{API}/intercom/overview", headers=as_user("nobody")).status_code == 403


# ================================================================ L4 - a station-scope allow binding is honoured "anywhere"

def test_poc_l4_a_station_scope_binding_of_a_broad_role_grants_beside_the_station(door_world):
    """Only roles that carry rbac.assign are refused at station scope, so an editor (or operator, viewer, custom role) can be
    bound to one station; routes that accept a permission held at ANY scope then honour it installation-wide."""
    c, db = door_world["c"], door_world["db"]
    r = _bind_api(c, "stan", "editor", STATION, ENTRY)
    assert r.status_code == 201, r.text  # CURRENT: accepted
    with db.connection(mode="read") as conn:
        anywhere = set(permissions_anywhere(conn, _principal("stan")))
    assert {"catalog.manage", "placement.edit", "presence.report"} <= anywhere
    # the installation's object library is managed under "catalog.manage anywhere": the gate passes (404 = no such item,
    # after the permission), where a caller without the permission gets the audited 403
    assert c.delete(f"{API}/catalog/objects/no-such-item", headers=as_user("stan")).status_code == 404
    c.get(f"{API}/me", headers=as_user("nobody"))
    assert c.delete(f"{API}/catalog/objects/no-such-item", headers=as_user("nobody")).status_code == 403


# ================================================================ L5 - without a WisKey copy the map row is trusted as it is

def test_poc_l5_signed_mode_signs_a_stale_mapping_when_no_wiskey_copy_is_held(door_world, monkeypatch):
    c, db, feed = door_world["c"], door_world["db"], door_world["feed"]
    monkeypatch.setattr(trusted_door, "MIN_BRIDGE_FOR_TRUSTED_PATH", "0.9.0")
    bridge = FakeTrustedBridge({ENTRY: [1], SIDE: [1]}).install(monkeypatch)
    with db.connection() as conn:
        set_setting(conn, "bridge.integration_version", "0.9.0")
    assert c.put(f"{API}/doors/settings", json={"trusted_path": "on", "confirmed": True}).status_code == 200
    _map_all(c)
    bind(c, door_world["settings"], "dana", "door_opener", "installation", "*")
    # the WisKey copy says the entrance no longer has relay 1: the row stops resolving (correct)
    with intercom_sync.SYNC._cache_lock:
        intercom_sync.SYNC._cache = intercom_sync.project_overview({"stations": [station(ENTRY, "כניסה ראשית", relays=[2]), station(SIDE, "דלת צד")]})
    assert _tile(c, "lock.entrance", "dana").json()["code"] == "intercom_lock_unmapped"
    # no copy at all (the add-on restarted, the WisKey feed is not up yet): the same stale row is signed as-is
    with intercom_sync.SYNC._cache_lock:
        intercom_sync.SYNC._cache = None
    r = _tile(c, "lock.entrance", "dana")
    assert r.status_code == 202, r.text  # CURRENT: sent without any station / relay / online check
    assert [o["message"]["params"] for o in bridge.opens()] == [{"relay": 1}] and feed.sent == []


# ================================================================ L6 - every integration scene is "unresolvable" once a WisKey door exists

def test_poc_l6_an_integration_scene_with_no_lock_is_refused_once_any_wiskey_lock_exists(autos_app):
    """The resolver means to judge a scene the editor does not hold by its members (`resolve_entity_item`, the branch for a
    scene without a mirror row), but an integration scene HAS a mirror row (config_json NULL), so it is `unreadable_item`:
    every integration scene - here one with no member at all - is refused from Arx and listed in the door report as soon as
    the installation has one WisKey lock. Fail closed, but an availability regression the D9 tests do not cover."""
    app, s, c, fake, tr = autos_app
    automations.MIRROR.pull(None, "test")
    iid = "entity:scene.wall_scene_01"
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT source, config_json FROM ha_config_items WHERE kind = 'scene' AND item_id = ?", (iid,)).fetchone()
        assert row is not None and row["source"] == "integration" and row["config_json"] is None
        assert door_run_guard.judge_item(conn, "scene", iid) is None, "no WisKey door in the installation: nothing to judge"
    _wiskey(app, "lock.front_door", fake=fake)
    with app.state.db.connection(mode="read") as conn:
        with pytest.raises(ApiError) as exc:
            door_run_guard.judge_item(conn, "scene", iid)
        assert exc.value.code == "door_steps_unresolvable"  # CURRENT
        listed = {i["key"]: i for i in door_path.inventory(conn)["items"]}
        assert f"scene:{iid}" in listed and listed[f"scene:{iid}"]["run_guard"] == "refused_unresolvable"
    r = c.post(f"{API}/automations/scene/{iid}/apply", json={"client_request_id": str(uuid.uuid4()), "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "door_steps_unresolvable", r.text


# ================================================================ informational: the deny rule is chain-specific

def test_poc_i3_a_deny_written_on_the_other_chain_does_not_stop_either_permission(door_world):
    """CR-033 4.1 step 2 judges `access.release` on the station's chain and `door.unlock` on the lock entity's chain only. A
    deny of door_opener on the floor where the door's lock entity is placed, and a deny of a door.unlock role on the station
    itself, are both ignored."""
    c, db = door_world["c"], door_world["db"]
    ids = seed_tree(c)
    _publish_plan(c, ids["floor2"])
    _map_all(c)
    assert c.post(f"{API}/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "lock.entrance", "x": 0.2, "y": 0.2}).status_code == 201
    opener = _custom_role(c, "פותח מנעולים", ["map.read"], ["door.unlock"])
    assert _bind_api(c, "rina", "door_opener", "installation", "*").status_code == 201
    assert _bind_api(c, "rina", "door_opener", "floor", ids["floor2"], effect="deny").status_code == 201
    assert _bind_api(c, "uri", opener, "installation", "*").status_code == 201
    with db.connection() as conn:  # a full administrator's deny of the opener role on the station itself
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', 'dev-uri', ?, ?, ?, 'deny', ?, 'test', ?)",
                     (new_id(), opener, STATION, ENTRY, permission_revision(conn), now_iso()))
    with db.connection(mode="read") as conn:
        assert door_authority.check(conn, _principal("rina"), ENTRY, 1, dev_mode=True).allowed  # CURRENT
        assert door_authority.check(conn, _principal("uri"), ENTRY, 1, dev_mode=True).allowed  # CURRENT
