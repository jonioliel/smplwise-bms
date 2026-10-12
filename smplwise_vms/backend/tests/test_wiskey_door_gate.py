"""CR-033 slice D11: the fake-based gate of the WisKey door path (WXD-INT, 2026-10-12).

Two parts:

1. `DOOR_GATE` - the T1..T26 test plan of CR-033 11.3 (and the transition table) mapped to the tests that prove each row,
   across the door-path test files. `test_gate_map_names_only_existing_tests` keeps the map honest: every named test must
   exist, so the release gate (which runs every backend file) cannot silently lose a row. Rows that cannot be proven on
   fakes yet say so in `OPEN` (never counted as covered).
2. The tests the second-pass review listed as missing or partial (docs/security/SECURITY_REVIEW_WXD_DOORPATH_2026-10-12.md
   section 6): T6 (group, custom-role switch, expired binding, inactive user through the routes), station placement through
   the route, door-map invalidation, T7 (logs), T8 (restart between attempt and outcome), T10, T11 (kiosk through a group),
   T20, T22 and "sent, never opened".

Deterministic, fakes only: FakeWisKeyFeed (the interim station release, recorded), FakeTrustedBridge (the DTO v3 reference
model), the registry mirror seeded directly. No Home Assistant, bridge, WisKey, door or key."""
from __future__ import annotations

import ast
import json
import logging
import re
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind, seed_tree
from test_wiskey_door_path import API, DOCK, ENTRY, SIDE, _clean, bind_raw, custom_role, env, map_all, rows, signed, tile, world  # noqa: F401  (fixtures)

from smplwise.db import Database, new_id, now_iso
from smplwise.rbac import ROLES
from smplwise.routers import access_control
from smplwise.routers.access import PERMISSION_LABELS
from smplwise.services import door_authority, trusted_door

TESTS = Path(__file__).resolve().parent
BACKEND = TESTS.parent / "smplwise"
FRONTEND = TESTS.parents[2] / "frontend" / "src"

# ================================================================ 1. the gate map

DOOR_GATE: dict[str, list[str]] = {
    "T1 every entry point: one open, the person as actor, one attempt + one outcome row": [
        "test_wiskey_door_path.py::test_d4_signed_open_carries_the_real_actor_and_only_a_body_hash",
        "test_wiskey_door_path.py::test_d4_tile_unlock_of_a_wiskey_door_goes_through_the_door_path",
        "test_wiskey_door_path.py::test_d4_interim_wiskey_screen_release_is_station_release_with_door_audit",
        "test_wiskey_door_inventory.py::test_d9_a_converted_run_opens_each_door_through_the_door_path_with_its_own_request_id",
        "test_wiskey_door_gate.py::test_t10_a_notification_link_is_audit_only_and_no_other_module_opens_a_door",
    ],
    "T2 every denial signs and sends nothing": ["test_wiskey_door_path.py::test_d4_refusals_before_signing_send_nothing"],
    "T3 a WisKey door never goes through execute / lock.unlock": [
        "test_wiskey_door_path.py::test_d4_tile_unlock_of_a_wiskey_door_goes_through_the_door_path",
        "test_wiskey_door_signed.py::test_d5a_execute_refuses_every_wiskey_door_whoever_built_the_payload",
        "test_wiskey_door_signed.py::test_d5a_a_door_map_row_is_a_door_whatever_the_platform_says",
    ],
    "T4 unknown: relay held, status only, a new open is a new request": [
        "test_wiskey_door_path.py::test_d4_signed_refusal_unknown_and_status",
        "test_wiskey_door_signed.py::test_d5b_a_write_is_never_retried_and_a_second_open_is_a_new_request",
        "test_wiskey_door_signed.py::test_d5b_an_unknown_outcome_is_never_success",
    ],
    "T5 every DTO answer to an Arx outcome, no input echoed": [
        "test_wiskey_door_path.py::test_d0_classify_maps_every_closed_answer",
        "test_wiskey_door_signed.py::test_d5b_the_signature_binds_actor_command_target_and_request_id",
        "test_wiskey_door_signed.py::test_d5b_a_replay_never_opens_twice",
    ],
    "T6 the permission matrix": [
        "test_wiskey_door_path.py::test_d3_either_permission_opens_and_deny_on_either_wins",
        "test_wiskey_door_gate.py::test_t6_group_custom_role_switch_expired_binding_and_inactive_user_through_the_route",
        "test_security_review_wxd_fixes.py::test_l4_a_station_scope_binding_carries_door_permissions_only",
    ],
    "T7 no signature, key, nonce or body in the audit or the logs": [
        "test_wiskey_door_path.py::test_d4_signed_open_carries_the_real_actor_and_only_a_body_hash",
        "test_wiskey_door_gate.py::test_t7_the_logs_never_carry_the_signature_nonce_key_or_body",
    ],
    "T8 a restart between attempt and outcome: the attempt stays, nothing is re-sent": [
        "test_wiskey_door_gate.py::test_t8_a_restart_between_attempt_and_outcome_leaves_the_attempt_and_sends_nothing",
    ],
    "T9 no lock.lock for a WisKey lock; lock-all skips it": [
        "test_wiskey_d6_d8.py::test_d6_lock_lock_is_never_sent_to_a_wiskey_lock",
        "test_wiskey_d6_d8.py::test_d6_the_action_list_drops_lock_for_wiskey_locks_only",
        "test_wiskey_d6_d8.py::test_d6_device_rows_mark_a_wiskey_door_for_lock_all",
    ],
    "T10 no notification token / service worker / email route opens": [
        "test_wiskey_door_gate.py::test_t10_a_notification_link_is_audit_only_and_no_other_module_opens_a_door",
    ],
    "T11 kiosk, viewer, dev and unidentified principals never reach signing": [
        "test_wiskey_door_path.py::test_d4_refusals_before_signing_send_nothing",
        "test_security_review_wxd_fixes.py::test_l1_a_kiosk_account_is_refused_as_such",
        "test_security_review_wxd_fixes.py::test_l1_an_enabled_wall_profile_is_a_wall_account",
        "test_wiskey_door_gate.py::test_t11_a_wall_account_reached_through_a_group_never_opens",
    ],
    "T12 the inventory resolver": [
        "test_wiskey_door_inventory.py::test_d7_resolver_finds_every_static_path_and_fails_closed_on_the_rest",
        "test_security_review_wxd_fixes.py::test_l6_an_integration_scene_is_judged_by_its_members",
    ],
    "T13 conversion approver rule (D10a groundwork; the conversion itself is OPEN)": [
        "test_wiskey_door_inventory.py::test_d7_approver_must_cover_the_live_revision_and_hold_the_door",
    ],
    "T14 Arx-authored vs edited externally": ["test_wiskey_door_inventory.py::test_d7_inventory_classifies_names_only_and_is_read_only"],
    "T15 a scheduled lock.lock on a WisKey lock is listed as never working": [
        "test_wiskey_d6_d8.py::test_d6_scheduled_lock_jobs_on_wiskey_locks_are_listed_as_never_working",
    ],
    "T16 external items are never blocked or disabled": ["test_wiskey_door_inventory.py::test_d7_inventory_classifies_names_only_and_is_read_only"],
    "T17 a schedule's run now with a door step": ["test_wiskey_door_inventory.py::test_d9_schedule_run_now_with_a_door_step_is_refused"],
    "T18 scene capture and apply with a WisKey lock member": [
        "test_wiskey_d6_d8.py::test_t25_scene_capture_and_scene_members_refuse_a_wiskey_lock",
        "test_wiskey_door_inventory.py::test_d9_unconverted_and_unresolvable_items_are_refused_before_the_bridge",
    ],
    "T19 Arx-started runs (R-17)": [
        "test_wiskey_door_inventory.py::test_d9_unconverted_and_unresolvable_items_are_refused_before_the_bridge",
        "test_wiskey_door_inventory.py::test_d9_a_converted_run_opens_each_door_through_the_door_path_with_its_own_request_id",
        "test_wiskey_door_inventory.py::test_d9_signed_mode_sends_one_door_open_per_door_with_the_real_actor",
        "test_wiskey_door_inventory.py::test_d9_a_converted_run_needs_the_door_permission_of_the_real_operator",
        "test_wiskey_door_inventory.py::test_d9_tiles_never_run_a_chain_that_reaches_a_wiskey_door",
        "test_security_review_wxd_fixes.py::test_m3_a_template_switch_wrapper_is_judged_as_a_possible_door",
    ],
    "T20 covers, switches, buttons and ordinary locks unchanged": [
        "test_wiskey_door_gate.py::test_t20_covers_switches_buttons_and_ordinary_locks_still_use_execute",
        "test_wiskey_d6_d8.py::test_d6_an_ordinary_lock_still_takes_lock_lock",
    ],
    "T21 call / hang-up / TTS keep their path and permission": ["test_intercom.py::test_access_release_permission_catalogue"],
    "T22 Arx RBAC does not touch the HA-native lock path": ["test_wiskey_door_gate.py::test_t22_permission_names_and_the_ha_native_lock_path"],
    "T23 the door map": [
        "test_wiskey_door_path.py::test_d1_door_map_fill_order_and_refusals",
        "test_wiskey_door_gate.py::test_t23_a_mapped_row_stops_resolving_when_the_registry_station_changes",
    ],
    "T24 execute blocked for WisKey doors (add-on side; the bridge 0.8.1 side is OPEN)": [
        "test_wiskey_door_signed.py::test_d5a_execute_refuses_every_wiskey_door_whoever_built_the_payload",
        "test_wiskey_door_signed.py::test_d5a_without_a_wiskey_door_an_unknown_lock_is_not_judged",
        "test_wiskey_door_signed.py::test_d5a_other_domains_never_read_the_mirror_and_an_unreadable_mirror_refuses_locks",
        "test_wiskey_door_signed.py::test_d5a_the_bridge_081_answer_is_a_failure_never_pending",
    ],
    "T25 the editor block on save": [
        "test_wiskey_d6_d8.py::test_t25_typed_builder_refuses_a_new_door_step_on_the_server",
        "test_wiskey_d6_d8.py::test_t25_code_mode_refuses_a_new_door_step_and_a_wiskey_service_call",
        "test_wiskey_d6_d8.py::test_t25_schedule_editor_refuses_a_new_door_action_on_the_server",
        "test_security_review_wxd_fixes.py::test_m1_typed_builder_refuses_a_new_door_step_through_a_lock_group",
        "test_security_review_wxd_fixes.py::test_m1_schedule_copy_split_and_restore_are_creates_for_the_editor_block",
    ],
    "T26 the grant card": ["test_wiskey_door_path.py::test_d3_grant_card_switches_users_groups_and_custom_roles"],
    "D2 station placement moves a site / building grant with the station": [
        "test_wiskey_door_path.py::test_d2_station_scope_chain_placement_and_bindings",
        "test_wiskey_door_gate.py::test_d2_placement_through_the_route_moves_a_site_grant_with_the_station",
        "test_security_review_wxd_fixes.py::test_m2_who_may_place_and_remove_a_wiskey_door",
    ],
    "M3 bulk actions leave possible doors out": [
        "test_security_review_wxd_fixes.py::test_m3_bulk_actions_leave_script_backed_entities_out_where_a_wiskey_door_exists",
    ],
    "D10a enabling never re-arms an autonomous door opener": [
        "test_wiskey_door_enable.py::test_d10a_enabling_an_automation_with_a_door_step_is_refused_disabling_is_not",
        "test_wiskey_door_enable.py::test_d10a_schedule_enable_and_bulk_enable_refuse_a_door_step",
    ],
    "decision 22: sent, never opened": ["test_wiskey_door_gate.py::test_sent_never_opened_on_any_door_reply_or_door_screen"],
}

# Rows that fakes cannot close yet (listed in docs/changes/CR-033-INTEGRATION-NOTES.md, never counted as covered).
OPEN = {
    "T13": "D10a conversion (Arx event door jobs, disable-and-list run) is not built; only its approver rule and the enable guard are",
    "T19": "a fake HA that models context.user_id / parent_id, concurrent runs and a permission change mid-run (DR-8 gate)",
    "T24": "the bridge-side 0.8.1 execute block and its signed policy message (needs the bridge version bump)",
}


def _tests_in(file: str) -> set[str]:
    tree = ast.parse((TESTS / file).read_text(encoding="utf-8"))
    return {n.name for n in tree.body if isinstance(n, ast.FunctionDef) and n.name.startswith("test_")}


def test_gate_map_names_only_existing_tests():
    seen: dict[str, set[str]] = {}
    missing = []
    for row, refs in DOOR_GATE.items():
        assert refs, row
        for ref in refs:
            file, name = ref.split("::")
            if file not in seen:
                seen[file] = _tests_in(file)
            if name not in seen[file]:
                missing.append(ref)
    assert missing == [], missing
    ids = {re.match(r"(T\d+)", k).group(1) for k in DOOR_GATE if re.match(r"T\d+", k)}
    assert ids == {f"T{i}" for i in range(1, 27)}, sorted(ids)
    assert set(OPEN) <= ids


# ================================================================ 2. the missing / partial rows

def _release(world: dict[str, Any], user: str, station_id: str = ENTRY, **fields: Any) -> Any:
    return world["c"].post(f"{API}/intercom/stations/{station_id}/release", json=env(confirmed=True, **fields), headers=as_user(user))


def test_t6_group_custom_role_switch_expired_binding_and_inactive_user_through_the_route(world):
    """The door rule as the WisKey screen sees it: a door_opener grant through a GROUP opens while the person is a member;
    a custom role switched on in the grant card opens and stops when switched off; an EXPIRED binding and an INACTIVE user
    are refused; nothing refused is ever sent."""
    c, db, s, feed = world["c"], world["db"], world["settings"], world["feed"]
    map_all(c)
    for user in ("gabi", "rina", "exp", "ina"):
        c.get(f"{API}/me", headers=as_user(user))
    gid = c.post(f"{API}/access/groups", json={"name": "שומרי לילה"}).json()["id"]
    assert c.post(f"{API}/access/door-grants/subjects", json={"subject_kind": "group", "subject_id": gid, "enabled": True, "confirmed": True}).status_code == 200
    assert _release(world, "gabi").status_code == 403, "not a member yet"
    with db.connection() as conn:
        conn.execute("INSERT INTO group_members(group_id, user_id) VALUES (?, 'dev-gabi')", (gid,))
    assert _release(world, "gabi").status_code == 200, "the group's grant reaches its member"
    with db.connection() as conn:
        conn.execute("DELETE FROM group_members WHERE group_id = ? AND user_id = 'dev-gabi'", (gid,))
    access_control.RELAYS.clear()
    assert _release(world, "gabi").status_code == 403, "left the group: refused"
    # a custom role switched on / off in the grant card
    rid = custom_role(c, "משמרת בוקר", [], permissions=["map.read", "access.read"])
    bind(c, s, "rina", rid, "installation", "*")
    assert _release(world, "rina", SIDE).status_code == 403
    role = next(x for x in c.get(f"{API}/access/door-grants").json()["roles"] if x["id"] == rid)
    assert c.put(f"{API}/access/door-grants/roles/{rid}", json={"enabled": True, "revision": role["revision"], "confirmed": True}).status_code == 200
    assert _release(world, "rina", SIDE).status_code == 200
    assert c.put(f"{API}/access/door-grants/roles/{rid}", json={"enabled": False, "revision": role["revision"] + 1, "confirmed": True}).status_code == 200
    access_control.RELAYS.clear()
    assert _release(world, "rina", SIDE).status_code == 403, "switched off: refused"
    # an expired binding; an inactive user
    with db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at, expires_at) "
                     "VALUES (?, 'user', 'dev-exp', 'door_opener', 'installation', '*', 'allow', 1, 'test', ?, '2000-01-01T00:00:00Z')", (new_id(), now_iso()))
    bind(c, s, "ina", "door_opener", "installation", "*")
    with db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-ina'")
    assert _release(world, "exp").status_code == 403
    assert _release(world, "ina").status_code == 403
    assert [f["who"] for f in feed.sent] == ["dev-gabi", "dev-rina"]


def test_d2_placement_through_the_route_moves_a_site_grant_with_the_station(world):
    """A site-scoped door_opener opens a station only while it is placed under that site (or one of its buildings);
    unplaced, only installation grants cover it."""
    c, s = world["c"], world["settings"]
    ids = seed_tree(c)
    map_all(c)
    bind(c, s, "sita", "door_opener", "site", ids["site"])
    assert _release(world, "sita").status_code == 403, "unplaced: the site grant does not reach it"
    assert c.put(f"{API}/intercom/stations/{ENTRY}/placement", json={"building_id": ids["building"], "confirmed": True}).status_code == 200
    assert _release(world, "sita").status_code == 200
    assert c.put(f"{API}/intercom/stations/{ENTRY}/placement", json={"confirmed": True}).status_code == 200  # unplaced again
    access_control.RELAYS.clear()
    assert _release(world, "sita").status_code == 403
    bind(c, s, "otto", "operator", "installation", "*")
    assert c.put(f"{API}/intercom/stations/{ENTRY}/placement", json={"site_id": ids["site"], "confirmed": True}, headers=as_user("otto")).status_code == 403
    assert len(world["feed"].sent) == 1


def test_t23_a_mapped_row_stops_resolving_when_the_registry_station_changes(world):
    """The registry's config entry of a mapped lock moves to another station: the row no longer resolves, the tile is
    refused as unmapped and nothing is sent (never guessed from the old row)."""
    c, s, db, feed = world["c"], world["settings"], world["db"], world["feed"]
    map_all(c)
    bind(c, s, "dana", "door_opener", "installation", "*")
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET config_entry_id = ? WHERE entity_id = 'lock.entrance'", (SIDE,))
    r = tile(c, "lock.entrance", "dana")
    assert r.status_code == 409 and r.json()["code"] == "intercom_lock_unmapped", r.text
    assert feed.sent == [] and world["executed"] == []


def test_t7_the_logs_never_carry_the_signature_nonce_key_or_body(world, signed, caplog):
    caplog.set_level(logging.DEBUG)
    signed.timeout_after_delivery = True
    r = _release(world, "dana")
    assert r.status_code == 504
    signed.timeout_after_delivery = False
    world["c"].post(f"{API}/doors/requests/{r.json()['details']['door_request_id']}/status", headers=as_user("dana"))
    assert _release(world, "dana", SIDE).status_code == 200
    text = "\n".join(rec.getMessage() for rec in caplog.records) + "\n" + caplog.text
    assert signed.calls, "the fake saw the signed messages"
    for call in signed.calls:
        m = call["message"]
        assert m["sig"] not in text and m["nonce"] not in text and call["text"] not in text
    assert trusted_door.PROTOCOL not in text and "signed_message_json" not in text
    from fake_trusted_bridge import TEST_SECRET

    assert TEST_SECRET not in text


class _Crash(RuntimeError):
    """The process dies right after the command was handed over: the outcome row is never written (the door path records
    an outcome only from its own except-branches around the send, which this does not pass through)."""


def test_t8_a_restart_between_attempt_and_outcome_leaves_the_attempt_and_sends_nothing(world, monkeypatch):
    """The station release was handed over and the process died before the outcome row: after the restart the attempt row
    stands, no outcome is invented, nothing is sent again, and the tile row never turns "confirmed" (it may have been
    sent: it reads "unknown" once the window has passed)."""
    from fastapi.testclient import TestClient

    from smplwise.main import create_app

    c, s, db, feed = world["c"], world["settings"], world["db"], world["feed"]
    map_all(c)
    bind(c, s, "dana", "door_opener", "installation", "*")
    real_outcome = access_control._Action.outcome

    def die(self: Any, outcome: str, reason: Any, fields: dict[str, Any]) -> None:
        raise _Crash()

    monkeypatch.setattr(access_control._Action, "outcome", die)
    with pytest.raises(_Crash):
        tile(c, "lock.entrance", "dana")
    assert len(feed.sent) == 1, "the command left before the crash"
    monkeypatch.setattr(access_control._Action, "outcome", real_outcome)
    # the restart: a new process (new app on the same database, the in-memory relay guard gone)
    access_control.RELAYS.clear()
    c2 = TestClient(create_app(s))
    phases = [x["details"].get("phase") for x in rows(db, "intercom.release")]
    assert phases.count("attempt") == 1 and "outcome" not in phases
    with Database(s.db_path).connection(mode="read") as conn:
        (aid, status) = conn.execute("SELECT id, status FROM ha_actions WHERE entity_id = 'lock.entrance'").fetchone()
    assert status == "pending"
    got = c2.get(f"{API}/ha/actions/{aid}", headers=as_user("dana")).json()
    assert got["status"] == "pending", "an open in flight or cut off is never confirmed by a poll"
    with db.connection() as conn:
        conn.execute("UPDATE ha_actions SET requested_at = '2020-01-01T00:00:00Z' WHERE id = ?", (aid,))
    assert c2.get(f"{API}/ha/actions/{aid}", headers=as_user("dana")).json()["status"] == "unknown"
    assert len(feed.sent) == 1, "nothing was re-sent by the restart or the polls"


def test_t10_a_notification_link_is_audit_only_and_no_other_module_opens_a_door(world):
    """B2: the notification deep link reaches the same route, needs the same person's grant and the explicit confirmation;
    its origin is recorded, never authority. No other module (notifications, push, e-mail, service worker routes) calls the
    door transport: only routers/access_control.py sends a station release or opens a door, and only it and
    services/door_run_guard.py call open_door."""
    c, s, db, feed = world["c"], world["settings"], world["db"], world["feed"]
    map_all(c)
    bind(c, s, "dana", "door_opener", "installation", "*")
    bind(c, s, "vera", "viewer", "installation", "*")
    origin = "notification:" + "a" * 12
    r = c.post(f"{API}/intercom/stations/{ENTRY}/release", json=env(origin=origin), headers=as_user("dana"))
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    assert _release(world, "vera", origin=origin).status_code == 403, "a notification link is no authority"
    assert _release(world, "dana", origin=origin).status_code == 200
    attempt = [x for x in rows(db, "intercom.release") if x["details"].get("phase") == "attempt"][-1]
    assert attempt["details"]["entry_point"] == "notification" and attempt["details"]["origin"] == origin
    assert len(feed.sent) == 1
    sources = {str(p.relative_to(BACKEND)).replace("\\", "/"): p.read_text(encoding="utf-8") for p in BACKEND.rglob("*.py")}
    assert sorted(f for f, t in sources.items() if re.search(r"\brelease_door\(", t) and f != "services/intercom_client.py") == ["routers/access_control.py"]
    assert sorted(f for f, t in sources.items() if re.search(r"\bopen_door\(", t)) == ["routers/access_control.py", "services/door_run_guard.py"]
    assert sorted(f for f, t in sources.items() if "call_bridge(" in t and "door_open" in t) == ["routers/access_control.py", "routers/doors.py", "services/trusted_door.py"]


def test_t11_a_wall_account_reached_through_a_group_never_opens(world):
    c, s, db, feed = world["c"], world["settings"], world["db"], world["feed"]
    map_all(c)
    c.get(f"{API}/me", headers=as_user("wall"))
    gid = c.post(f"{API}/access/groups", json={"name": "מסכי קיר"}).json()["id"]
    with db.connection() as conn:
        conn.execute("INSERT INTO group_members(group_id, user_id) VALUES (?, 'dev-wall')", (gid,))
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'group', ?, 'kiosk', 'installation', '*', 'allow', 1, 'test', ?)",
                     (new_id(), gid, now_iso()))
    bind(c, s, "wall", "door_opener", "installation", "*")
    with db.connection(mode="read") as conn:
        from smplwise.rbac import Principal

        d = door_authority.check(conn, Principal("dev-wall", "wall", "wall", "dev"), ENTRY, 1, dev_mode=True)
    assert not d.allowed and d.reason == "wall_account"
    assert _release(world, "wall").status_code == 403 and tile(c, "lock.entrance", "wall").status_code == 403
    assert feed.sent == []


def test_t20_covers_switches_buttons_and_ordinary_locks_still_use_execute(world):
    """A5 / H8: entities that are not WisKey doors keep their path: execute with the person's identity, no door rule."""
    c, db = world["c"], world["db"]
    with db.connection() as conn:
        for eid, platform, state in (("cover.garage", "shelly", "closed"), ("switch.pump", "shelly", "off"), ("button.reboot_router", "shelly", "unknown")):
            conn.execute("INSERT INTO ha_entities(entity_id, domain, name, platform, state, state_seen_at, first_seen_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
                         (eid, eid.split(".")[0], eid.split(".")[1], platform, state, now_iso(), now_iso(), now_iso()))
    for eid, action in (("cover.garage", "cover.open_cover"), ("switch.pump", "switch.turn_on"), ("button.reboot_router", "button.press")):
        r = c.post(f"{API}/ha/entities/{eid}/actions", json={"allowed_action_id": action, "client_request_id": new_id(), "expires_at": "2099-01-01T00:00:00Z", "confirmation_grant": "confirmed"})
        assert r.status_code == 202 and r.json()["via"] == "bridge", (eid, r.text)
    assert [(p["domain"], p["service"], p["data"]["entity_id"]) for p in world["executed"]] == [
        ("cover", "open_cover", "cover.garage"), ("switch", "turn_on", "switch.pump"), ("button", "press", "button.reboot_router")]
    assert world["feed"].sent == []


def test_t22_permission_names_and_the_ha_native_lock_path():
    """H1: the HA-native lock path is not changed by Arx RBAC - door.unlock stays a sensitive grant no built-in role holds,
    the one-switch door role carries only the WisKey screen's two permissions, and the labels say what each one is."""
    assert ROLES["door_opener"] == ["access.read", "access.release"]
    assert not any("door.unlock" in perms for perms in ROLES.values())
    assert PERMISSION_LABELS["door.unlock"] and PERMISSION_LABELS["access.release"]
    roles = json.loads((BACKEND / "roles.json").read_text(encoding="utf-8"))["roles"]
    opener = next(r for r in roles if r["id"] == "door_opener")
    assert opener["name_he"] == "פותח דלתות"
    src = (BACKEND / "services" / "door_authority.py").read_text(encoding="utf-8")
    assert "ha_client" not in src and "call_service" not in src, "the door authority decides; it never talks to the infrastructure"


DISCLAIMER = "זה אינו אישור שהדלת נפתחה בפועל"
DOOR_SCREEN_SOURCES = ("api/doors.ts", "screens/system-doors.ts", "screens/system-doors-logic.ts", "screens/door-path-logic.ts")


def test_sent_never_opened_on_any_door_reply_or_door_screen(world):
    """Decision 22: a successful open says "sent" (`נשלח`) - on the WisKey screen's reply, the tile's reply and row, the
    outcome texts - and never that the door opened; the door screens hold no "opened" text."""
    c, s = world["c"], world["settings"]
    map_all(c)
    bind(c, s, "dana", "door_opener", "installation", "*")
    replies = [_release(world, "dana"), tile(c, "lock.side", "dana")]
    for r in replies:
        assert r.status_code in (200, 202), r.text
        text = json.dumps(r.json(), ensure_ascii=False).replace(DISCLAIMER, "")
        assert "נפתח" not in text, text
    assert replies[1].json()["confirmation"] == "none" and replies[1].json()["note"].startswith("נשלח")
    assert trusted_door.OUTCOME_TEXT["sent"] == "נשלח" and all("נפתח" not in t for t in trusted_door.OUTCOME_TEXT.values())
    for rel in DOOR_SCREEN_SOURCES:
        assert "נפתח" not in (FRONTEND / rel).read_text(encoding="utf-8"), rel
