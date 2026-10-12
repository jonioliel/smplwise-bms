"""SEC-WXD (2026-10-12): regression tests for the findings of the second-pass security review of the CR-033 WisKey door path,
slices D0-D9 (docs/security/SECURITY_REVIEW_WXD_DOORPATH_2026-10-12.md, section "Fix status").

Fakes only: no Home Assistant, no bridge, no WisKey, no door, no key. The pairing secret is the published golden-vector TEST
constant; station ids are synthetic opaque strings.

The file started as the review's proofs of concept (each asserted the unfixed behaviour, `test_poc_*`); every fixed finding's
proof was inverted into a regression test (`test_<finding>_*`) that fails on the unfixed code and passes on the fix. A
`test_poc_*` that remains documents behaviour that was deliberately NOT changed (the reason is in the fix-status section)."""
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


def test_m1_typed_builder_refuses_a_new_door_step_through_a_lock_group(autos_app):
    """`lock.unlock` on a lock group over the WisKey lock is refused while `doors.editor_block` is `blocked` (the default),
    exactly like the same step on the WisKey lock itself (FIXED: the D8 block judges with the shared D7 / D9 resolver)."""
    app, s, c, fake, tr = autos_app
    _opener(c)
    _lock_group(app, fake)
    _wiskey(app, "lock.front_door", fake=fake)
    direct = create_item(c, "automation", draft_of("ישיר", actions=[svc_block("lock.unlock", ["lock.front_door"])]))
    assert direct.status_code == 422 and direct.json()["code"] == "wiskey_door_step_blocked", direct.text
    via_group = create_item(c, "automation", draft_of("דרך קבוצה", actions=[svc_block("lock.unlock", ["lock.all_doors"])]))
    assert via_group.status_code == 422 and via_group.json()["code"] == "wiskey_door_step_blocked", via_group.text


def test_m1_scene_capture_refuses_a_lock_group_over_a_wiskey_lock(autos_app):
    app, s, c, fake, tr = autos_app
    _opener(c)
    _lock_group(app, fake)
    _wiskey(app, "lock.front_door", fake=fake)
    r = c.post(f"{API}/automations/scene/capture", json={"entity_ids": ["lock.all_doors"]})
    assert r.status_code == 422 and r.json()["code"] == "wiskey_door_step_blocked", r.text


def test_m1_code_mode_refuses_a_new_door_step_through_a_lock_group_or_a_device_action(autos_app):
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
    assert through_group.status_code == 422 and through_group.json()["code"] == "wiskey_door_step_blocked", through_group.text
    # a device action on the WisKey lock itself (no service name): the resolver sees the door
    device_action = code({"device_id": "dev-front", "domain": "lock", "entity_id": "lock.front_door", "type": "unlock"})
    assert device_action.status_code == 422 and device_action.json()["code"] == "wiskey_door_step_blocked", device_action.text
    automations.MIRROR.pull(None, "test")
    with app.state.db.connection(mode="read") as conn:
        res, _ = door_path.Resolver(conn).resolve_item("automation", item["id"])
    assert not res.has_door, "nothing that opens the door was stored"


def test_m1_typed_builder_refuses_a_call_of_a_script_that_opens_the_door(autos_app):
    """A new `script.turn_on` step whose script unlocks the WisKey lock is refused under the block (FIXED: D8 and D9 judge
    with the same resolver)."""
    app, s, c, fake, tr = autos_app
    _opener(c)
    cfg = {"alias": "פתיחת שער", "sequence": [{"action": "lock.unlock", "target": {"entity_id": "lock.front_door"}}]}
    fake.scripts["door_script"] = cfg
    fake._seed_script_entity("door_script", cfg)
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")
    _wiskey(app, "lock.front_door", fake=fake)
    r = create_item(c, "automation", draft_of("מפעיל שער", actions=[svc_block("script.turn_on", ["script.door_script"])]))
    assert r.status_code == 422 and r.json()["code"] == "wiskey_door_step_blocked", r.text
    assert r.json()["details"]["entities"] == ["lock.front_door"]
    # a script call that reaches no door still saves
    plain = {"alias": "אור", "sequence": [{"action": "light.turn_on", "target": {"entity_id": "light.office"}}]}
    fake.scripts["light_script"] = plain
    fake._seed_script_entity("light_script", plain)
    seed_mirror(app.state.db, fake)
    automations.MIRROR.pull(None, "test")
    ok = create_item(c, "automation", draft_of("מפעיל אור", actions=[svc_block("script.turn_on", ["script.light_script"])]))
    assert ok.status_code == 201, ok.text


def test_m1_an_author_without_door_unlock_cannot_add_a_door_opening_through_a_script(autos_app):
    """The called-script variant needed no door permission at all (the CR-017 rights judge the item's OWN typed steps). Under
    the editor block it is refused for everyone, this author included (FIXED). The CR-017 rule itself (a called script's
    lock steps do not ask door.unlock, for every lock) is a separate pre-existing gap - see the review's fix-status section."""
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
    assert r.status_code == 422 and r.json()["code"] == "wiskey_door_step_blocked", r.text


def test_m1_scene_member_flipped_from_locked_to_unlocked_is_a_new_step(autos_app):
    """An existing scene that captured the WisKey lock as `locked` (harmless: WisKey refuses lock) is edited to `unlocked` - a
    new door opening - and refused under the block (FIXED); the scene stays editable otherwise."""
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
    assert up.status_code == 422 and up.json()["code"] == "wiskey_door_step_blocked", up.text
    renamed = copy.deepcopy(d["draft"])
    renamed["name"] = "ערב מאוחר"
    assert put_item(c, "scene", sid, renamed, d["revision"]).status_code == 200, "an edit that adds no door opening is saved"
    automations.MIRROR.pull(None, "test")
    with app.state.db.connection(mode="read") as conn:
        res, _ = door_path.Resolver(conn).resolve_item("scene", sid)
    assert not res.door_steps, "the stored scene does not open the WisKey door"


def test_m1_schedule_copy_split_and_restore_are_creates_for_the_editor_block(sched_app):
    app, s, c, fake, tr = sched_app
    rid_ = _custom_role(c, "פותח " + uuid.uuid4().hex[:6], ["map.read"], ["door.unlock"])
    assert c.post(f"{API}/access/bindings", json={"subject_kind": "user", "subject_id": "dev-joni", "role_id": rid_, "scope_type": "installation", "scope_id": "*"}).status_code == 201

    def create(name: str) -> Any:
        return post_json(c, "/schedules", {"draft": sched_draft(name, [slot("08:00:00", None, act("lock.unlock", "lock.front_door"))], weekdays=["mon", "tue"]), "enabled": True,
                                           "client_request_id": sched_rid(), "confirm_lowering": True})

    first = create("פתיחה בבוקר")
    assert first.status_code == 201, first.text
    sid = first.json()["schedule"]["id"]
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET platform = 'hikvision_intercom' WHERE entity_id = 'lock.front_door'")
    refused = create("עוד פתיחה")
    assert refused.status_code == 422 and refused.json()["code"] == "wiskey_door_step_blocked", refused.text
    copied = post_json(c, f"/schedules/{sid}/copy", {"name": "עותק של פתיחה", "client_request_id": sched_rid(), "confirm_lowering": True})
    assert copied.status_code == 422 and copied.json()["code"] == "wiskey_door_step_blocked", copied.text
    rev = first.json()["schedule"]["revision"]
    split = post_json(c, f"/schedules/{sid}/split", {"base_revision": rev, "days": ["mon"], "confirm": True, "client_request_id": sched_rid(), "confirm_lowering": True})
    assert split.status_code == 422 and split.json()["code"] == "wiskey_door_step_blocked", split.text
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM schedule_cache WHERE schedule_id != ? AND item_json LIKE ?", (sid, "%lock.front_door%")).fetchone()[0] == 0, "no second door schedule"
    deleted = post_json(c, f"/schedules/{sid}/delete", {"base_revision": rev, "confirm": True, "client_request_id": sched_rid()})
    assert deleted.status_code == 200, deleted.text
    restored = post_json(c, f"/schedules/trash/{deleted.json()['trash_id']}/restore", {"client_request_id": sched_rid(), "confirm_lowering": True})
    assert restored.status_code == 422 and restored.json()["code"] == "wiskey_door_step_blocked", restored.text


def test_m1_schedule_guard_follows_a_called_script_and_keeps_existing_calls(sched_app):
    """Unit level: a schedule action that runs a script which unlocks the WisKey lock is a new door step (refused); the
    same call already in the stored schedule stays; a call of a script that opens no door is never refused."""
    from smplwise.services import door_path_guard as guard

    app, s, c, fake, tr = sched_app
    _script_item(app.state.db, "door_script", [{"action": "lock.unlock", "target": {"entity_id": "lock.front_door"}}])
    _script_item(app.state.db, "light_script", [{"action": "light.turn_on", "target": {"entity_id": "light.office"}}])
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET platform = 'hikvision_intercom' WHERE entity_id = 'lock.front_door'")
    door = {"service": "script.turn_on", "entity_id": "script.door_script", "data": {}}
    light = {"service": "script.turn_on", "entity_id": "script.light_script", "data": {}}
    with app.state.db.connection(mode="read") as conn:
        with pytest.raises(ApiError) as exc:
            guard.check_schedule(conn, {"slots": [{"actions": [door]}]}, None)
        assert exc.value.code == "wiskey_door_step_blocked" and exc.value.details["entities"] == ["lock.front_door"]
        guard.check_schedule(conn, {"slots": [{"actions": [door, light]}]}, {"slots": [{"actions": [door]}]})
        guard.check_schedule(conn, {"slots": [{"actions": [light]}]}, None)
        with pytest.raises(ApiError):
            guard.check_schedule(conn, {"slots": [{"actions": [door]}, {"actions": [door]}]}, {"slots": [{"actions": [door]}]})


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


def _entity(db: Database, entity_id: str, platform: str, *, area: str | None = None, attributes: dict[str, Any] | None = None) -> None:
    with db.connection() as conn:
        conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, area_id, attributes_json, state, state_seen_at, first_seen_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                     (entity_id, entity_id.split(".")[0], entity_id.split(".")[1], platform, area, json.dumps(attributes or {}), "off", now_iso(), now_iso(), now_iso()))


def test_m3_a_template_switch_wrapper_is_judged_as_a_possible_door(door_world):
    """R-17 is fail closed for template locks and template buttons, whose action sequences the mirror does not hold - and now
    (FIXED) for every service on a script-backed entity: a template switch's turn_on is unresolved, the run guard refuses a
    script that presses it, the tile guard refuses it before `execute`, and the inventory lists the script."""
    c, db, executed = door_world["c"], door_world["db"], door_world["executed"]
    _map_all(c)
    _script_item(db, "via_template_lock", [{"action": "lock.unlock", "target": {"entity_id": "lock.virtual"}}])
    _script_item(db, "via_template_switch", [{"action": "switch.turn_on", "target": {"entity_id": "switch.gate"}}])
    with db.connection(mode="read") as conn:
        with pytest.raises(ApiError) as exc:
            door_run_guard.judge_item(conn, "script", "via_template_lock")
        assert exc.value.code == "door_steps_unresolvable"
        with pytest.raises(ApiError) as exc:
            door_run_guard.judge_item(conn, "script", "via_template_switch")
        assert exc.value.code == "door_steps_unresolvable"
        with pytest.raises(ApiError):
            door_run_guard.judge_entity_action(conn, "switch.gate", "switch.turn_on")
        res = door_path.Resolver(conn).resolve_actions([{"action": "switch.turn_on", "target": {"entity_id": "switch.gate"}}])
        assert [u.reason for u in res.unresolved] == ["template_entity"]
        listed = {i["key"]: i for i in door_path.inventory(conn)["items"]}
        assert listed["script:via_template_switch"]["run_guard"] == "refused_unresolvable"
        assert "התקן וירטואלי שפעולתו אינה ידועה" in listed["script:via_template_switch"]["unresolved"]
    bind(c, door_world["settings"], "otto", "operator", "installation", "*")  # devices.control; no door permission
    assert _release(c, ENTRY, "otto").status_code == 403, "otto may not open the door himself"
    r = _tile(c, "switch.gate", "otto", action="switch.turn_on")
    assert r.status_code == 409 and r.json()["code"] == "door_steps_unresolvable", r.text
    assert executed == [], "nothing reached the bridge"


def test_m3_every_template_domain_area_targets_and_scene_members_are_judged(door_world):
    """Unit level over the resolver: a template cover / light / fan / select / number / valve / vacuum / alarm panel and a
    universal media player are unresolved whatever the service; an area target that reaches one too; `homeassistant.turn_on`
    of one; a scene member that sets one. An ordinary switch, and a domain without script-backed entities, stay "no door"."""
    db = door_world["db"]
    _map_all(door_world["c"])
    domains = {"cover.gate_tpl": "open_cover", "light.tpl": "turn_on", "fan.tpl": "turn_on", "select.tpl": "select_option", "number.tpl": "set_value",
               "valve.tpl": "open_valve", "vacuum.tpl": "start", "alarm_control_panel.tpl": "alarm_disarm"}
    for eid in domains:
        _entity(db, eid, "template", area="yard")
    _entity(db, "media_player.uni", "universal")
    _entity(db, "switch.plain", "shelly", area="yard")
    with db.connection(mode="read") as conn:
        r = door_path.Resolver(conn)
        for eid, svc in domains.items():
            res = r.resolve_actions([{"action": f"{eid.split('.')[0]}.{svc}", "target": {"entity_id": eid}}])
            assert [u.reason for u in res.unresolved] == ["template_entity"], eid
        assert r.resolve_actions([{"action": "media_player.turn_on", "target": {"entity_id": "media_player.uni"}}]).unresolved
        assert r.resolve_actions([{"action": "cover.open_cover", "target": {"area_id": "yard"}}]).unresolved, "an area target reaching a template cover"
        assert r.resolve_actions([{"action": "homeassistant.turn_on", "target": {"entity_id": "cover.gate_tpl"}}]).unresolved
        assert r.resolve_actions([{"action": "switch.turn_on", "target": {"entity_id": "{{ states('input_text.x') }}"}}]).unresolved, "a template target where a template switch exists"
        assert not r.resolve_actions([{"action": "switch.turn_on", "target": {"area_id": "yard"}}]).has_door, "the yard's only switch is an ordinary one"
        assert not r.resolve_actions([{"action": "switch.turn_on", "target": {"entity_id": "switch.plain"}}]).has_door
        assert not r.resolve_actions([{"action": "climate.set_temperature", "target": {"entity_id": "climate.any"}}]).has_door
        scene = r.resolve_config("scene", {"entities": {"cover.gate_tpl": "open", "switch.plain": "on"}})
        assert [u.reason for u in scene.unresolved] == ["template_entity"]
        with pytest.raises(ApiError):
            door_run_guard.judge_entity_action(conn, "cover.gate_tpl", "cover.open_cover")
        door_run_guard.judge_entity_action(conn, "switch.plain", "switch.turn_on")  # an ordinary switch is never refused


def test_m3_no_wiskey_door_means_template_entities_are_not_judged(settings):
    """Without any WisKey door the guards have nothing to judge: a template switch on a tile is unchanged (availability)."""
    create_app(settings)  # migrates the database
    db = Database(settings.db_path)
    _entity(db, "switch.gate2", "template")
    with db.connection(mode="read") as conn:
        door_run_guard.judge_entity_action(conn, "switch.gate2", "switch.turn_on")
        assert door_path.possible_door_entities(conn) == set()


def test_m3_bulk_actions_leave_script_backed_entities_out_where_a_wiskey_door_exists(door_world):
    from smplwise.services import device_bulk

    db = door_world["db"]
    _entity(db, "switch.plain", "shelly")
    with db.connection(mode="read") as conn:
        policy = device_bulk.SwitchPolicy(conn)
        assert policy.excluded_reason({"entity_id": "switch.gate", "domain": "switch"}) == "door_possible"
        assert policy.excluded_reason({"entity_id": "switch.plain", "domain": "switch"}) is None
        assert "door_possible" in device_bulk.EXCLUDED_LABELS


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

def test_l6_an_integration_scene_is_judged_by_its_members(autos_app):
    """An integration scene HAS a mirror row (config_json NULL); it was `unreadable_item` once one WisKey lock existed, so every
    integration scene was refused from Arx and listed. FIXED: it is judged by its members like any scene Arx does not hold -
    one with no door member runs and is not listed; one with the WisKey lock as a member stays refused."""
    app, s, c, fake, tr = autos_app
    automations.MIRROR.pull(None, "test")
    iid = "entity:scene.wall_scene_01"
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT source, config_json FROM ha_config_items WHERE kind = 'scene' AND item_id = ?", (iid,)).fetchone()
        assert row is not None and row["source"] == "integration" and row["config_json"] is None
        assert door_run_guard.judge_item(conn, "scene", iid) is None, "no WisKey door in the installation: nothing to judge"
    _wiskey(app, "lock.front_door", fake=fake)
    with app.state.db.connection(mode="read") as conn:
        assert door_run_guard.judge_item(conn, "scene", iid) is None
        assert f"scene:{iid}" not in {i["key"] for i in door_path.inventory(conn)["items"]}
    r = c.post(f"{API}/automations/scene/{iid}/apply", json={"client_request_id": str(uuid.uuid4()), "confirm": True})
    assert r.status_code in (200, 202), r.text
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET attributes_json = ? WHERE entity_id = 'scene.wall_scene_01'", (json.dumps({"entity_id": ["light.office", "lock.front_door"]}),))
    with app.state.db.connection(mode="read") as conn:
        with pytest.raises(ApiError) as exc:
            door_run_guard.judge_item(conn, "scene", iid)
        assert exc.value.code == "door_steps_unresolvable"


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
