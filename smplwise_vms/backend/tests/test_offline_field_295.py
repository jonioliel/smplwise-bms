"""OFFLINE110-295 slice 1 - offline field work, server half (task r110; owner answers 342-350). Negative first: the switch (default OFF),
the permissions, then the bundle, the replay rules (idempotent, server wins + note, reassigned -> manager review, 14-day retention),
lock / wipe, the read-only day list with its receipt, and the signed round-point tags. Fakes only; no device, no network."""
from __future__ import annotations

import datetime as dt
import uuid

import pytest
from fastapi.testclient import TestClient
from tickets_world import API, World, build

from smplwise.db import Database
from smplwise.services import offline_field as off

UTC = dt.timezone.utc
F = f"{API}/field/offline"


@pytest.fixture()
def w(settings) -> World:
    return build(settings)


def crid() -> str:
    return "op-" + uuid.uuid4().hex[:20]


def switch(w: World, **extra: str) -> None:
    r = w.c.put(f"{F}/settings", json={"changes": {"field_offline.enabled": "1", **extra}, "confirmed": True})
    assert r.status_code == 200, r.text


def assigned(w: World, user: str = "tom", **extra):
    t = w.create("mona", "מזגן לא מקרר", **extra)
    r = w.assign("mona", t["id"], user)
    assert r.status_code == 200, r.text
    return w.detail(t["id"])


def sync(w: World, user: str, ops: list, device: str = "dev-phone-1"):
    return w.c.post(f"{F}/sync", json={"device_id": device, "ops": ops}, headers=w.h(user))


def bundle(w: World, user: str = "tom", device: str = "dev-phone-1"):
    return w.c.get(f"{F}/bundle", params={"device_id": device}, headers=w.h(user))


def events(w: World, tid: str, kind: str = "note") -> list[dict]:
    return [e for e in w.detail(tid)["events"] if e["kind"] == kind]


def op(t: dict, typ: str = "note", payload: dict | None = None, **extra) -> dict:
    return {"client_request_id": crid(), "ticket_id": t["id"], "type": typ, "payload": payload or {}, "base_revision": t["revision"], **extra}


# ---------------------------------------------------------------- switch and permissions

def test_default_off_every_route_answers_feature_disabled(w):
    t = assigned(w)
    assert bundle(w).status_code == 404 and bundle(w).json()["code"] == "feature_disabled"
    assert sync(w, "tom", [op(t)]).status_code == 404
    assert w.c.get(f"{F}/day-list", headers=w.h("tom")).status_code == 404
    assert w.c.get(f"{F}/review", headers=w.h("mona")).status_code == 404
    doc = w.c.get(f"{F}/settings").json()["settings"]
    assert doc["field_offline.enabled"] == "0"
    assert (doc["field_offline.cache_hours"], doc["field_offline.bundle_days"], doc["field_offline.unsent_retention_days"]) == ("36", "3", "14")
    assert doc["field_offline.conflict_rule"] == "server_wins_note"


def test_settings_need_system_configure_confirmation_and_valid_values(w):
    r = w.c.put(f"{F}/settings", json={"changes": {"field_offline.enabled": "1"}, "confirmed": True}, headers=w.h("mona"))
    assert r.status_code == 403
    assert w.c.get(f"{F}/settings", headers=w.h("tom")).status_code == 403
    assert w.c.put(f"{F}/settings", json={"changes": {"field_offline.enabled": "1"}}).status_code == 409
    for bad in ({"field_offline.cache_hours": "0"}, {"field_offline.cache_hours": "x"}, {"field_offline.nope": "1"}, {"field_offline.conflict_rule": "x"}):
        assert w.c.put(f"{F}/settings", json={"changes": bad, "confirmed": True}).status_code == 422
    switch(w, **{"field_offline.cache_hours": "12", "field_offline.bundle_days": "5"})
    s = w.c.get(f"{F}/settings").json()["settings"]
    assert s["field_offline.cache_hours"] == "12" and s["field_offline.bundle_days"] == "5"


def test_review_devices_and_points_need_tickets_manage(w):
    switch(w)
    for method, path in (("get", "/review"), ("get", "/devices"), ("get", "/round-points")):
        assert getattr(w.c, method)(f"{F}{path}", headers=w.h("tom")).status_code == 403
        assert getattr(w.c, method)(f"{F}{path}", headers=w.h("mona")).status_code == 200
    assert w.c.post(f"{F}/round-points", json={"name": "x"}, headers=w.h("tom")).status_code == 403


# ---------------------------------------------------------------- bundle

def test_bundle_holds_only_my_requests_in_the_window_no_floor_plans(w):
    switch(w)
    mine = assigned(w, "tom")
    other = assigned(w, "gil")
    far = assigned(w, "tom")
    db = Database(w.settings.db_path)
    with db.connection() as conn:
        conn.execute("UPDATE tickets SET eta_at = ? WHERE id = ?", ((dt.datetime.now(UTC) + dt.timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ"), far["id"]))
    b = bundle(w).json()
    assert b["status"] == "ok" and b["floor_plans"] is False and "floor_plans_data" not in b
    ids = {t["id"] for t in b["tickets"]}
    assert mine["id"] in ids and other["id"] not in ids and far["id"] not in ids, "three days ahead, own assignments only"
    issued, until = dt.datetime.fromisoformat(b["issued_at"].replace("Z", "+00:00")), dt.datetime.fromisoformat(b["valid_until"].replace("Z", "+00:00"))
    assert until - issued == dt.timedelta(hours=36), "cache validity 36 h"
    assert "rounds" in b and "device_cards" in b


def test_bundle_parts_follow_settings(w):
    switch(w, **{"field_offline.include_rounds": "0", "field_offline.include_device_cards": "0", "field_offline.cache_hours": "6"})
    assigned(w)
    b = bundle(w).json()
    assert "rounds" not in b and "device_cards" not in b and b["cache_hours"] == 6


# ---------------------------------------------------------------- replay

def test_append_only_ops_apply_and_replay_is_idempotent(w):
    switch(w)
    t = assigned(w)
    o = op(t, "note", {"text": "סגרתי ברז ראשי"})
    r = sync(w, "tom", [o]).json()
    assert r["results"][0]["outcome"] == "applied" and r["device_action"] == "ok"
    again = sync(w, "tom", [o]).json()["results"][0]
    assert again["replayed"] is True and again["outcome"] == "applied"
    assert len([e for e in events(w, t["id"]) if "סגרתי ברז" in (e["body"] or "")]) == 1, "applied once"


def test_bad_ops_are_rejected_one_by_one_not_the_batch(w):
    switch(w)
    t = assigned(w)
    good = op(t, "note", {"text": "ok"})
    res = sync(w, "tom", [{"client_request_id": "short", "type": "note", "ticket_id": t["id"]}, {"client_request_id": crid(), "type": "wat", "ticket_id": t["id"]}, good]).json()["results"]
    assert [x["outcome"] for x in res] == ["rejected", "rejected", "applied"]


def test_status_move_applies_when_legal(w):
    switch(w)
    t = assigned(w)
    r = sync(w, "tom", [op(t, "status_move", {"to": "acknowledged"})]).json()["results"][0]
    assert r["outcome"] == "applied", r
    assert w.detail(t["id"])["status"] == "acknowledged"


def test_server_wins_when_the_move_is_no_longer_legal_and_the_intent_is_kept_as_a_note(w):
    switch(w)
    t = assigned(w)
    assert w.status("tom", t["id"], "in_progress").status_code == 200
    assert w.status("tom", t["id"], "done").status_code == 200  # done meanwhile: acknowledged/in_progress is no longer legal
    r = sync(w, "tom", [op(t, "status_move", {"to": "acknowledged", "text": "הגעתי"})]).json()["results"][0]
    assert r["outcome"] == "noted", r
    assert w.detail(t["id"])["status"] == "done", "the move was NOT applied"
    assert any("לא יושמה" in (e["body"] or "") and "הגעתי" in e["body"] for e in events(w, t["id"])), "the technician's action stays as a note"


def test_conflict_rule_hold_for_review(w):
    switch(w, **{"field_offline.conflict_rule": "hold_for_review"})
    t = assigned(w)
    assert w.status("tom", t["id"], "in_progress").status_code == 200
    assert w.status("tom", t["id"], "done").status_code == 200
    r = sync(w, "tom", [op(t, "status_move", {"to": "acknowledged"})]).json()["results"][0]
    assert r["outcome"] == "held"
    assert len(w.c.get(f"{F}/review", headers=w.h("mona")).json()["items"]) == 1


def test_reassigned_request_changes_go_to_manager_review_not_to_the_request(w):
    switch(w)
    t = assigned(w, "tom")
    assert w.assign("mona", t["id"], "gil").status_code == 200  # reassigned while tom was offline
    before = len(w.detail(t["id"])["events"])
    r = sync(w, "tom", [op(t, "note", {"text": "הערה מהשטח"})]).json()["results"][0]
    assert r["outcome"] == "held" and r["reason"] == "not_assignee_or_closed"
    assert len(w.detail(t["id"])["events"]) == before, "nothing written onto a request tom no longer owns"
    items = w.c.get(f"{F}/review", headers=w.h("mona")).json()["items"]
    assert len(items) == 1 and items[0]["payload"]["text"] == "הערה מהשטח"
    # the manager approves: the entry is kept as a note, attributed to the manager's approval
    res = w.c.post(f"{F}/review/{items[0]['id']}", json={"decision": "approve", "note": "ok"}, headers=w.h("mona"))
    assert res.status_code == 200 and res.json()["review_state"] == "approved"
    assert any("אושר ע" in (e["body"] or "") for e in events(w, t["id"]))
    assert w.c.post(f"{F}/review/{items[0]['id']}", json={"decision": "approve"}, headers=w.h("mona")).status_code == 409
    assert w.c.get(f"{F}/review", headers=w.h("mona")).json()["items"] == []


def test_reassigned_review_switch_off_rejects_instead(w):
    switch(w, **{"field_offline.reassigned_to_review": "0"})
    t = assigned(w, "tom")
    w.assign("mona", t["id"], "gil")
    assert sync(w, "tom", [op(t)]).json()["results"][0]["outcome"] == "rejected"
    assert w.c.get(f"{F}/review", headers=w.h("mona")).json()["items"] == []


def test_a_user_cannot_replay_ops_on_a_request_that_is_not_his(w):
    switch(w)
    t = assigned(w, "gil")
    r = sync(w, "tom", [op(t, "note", {"text": "x"})]).json()["results"][0]
    assert r["outcome"] in ("held", "rejected") and not events(w, t["id"])


def test_unsent_changes_older_than_retention_go_to_review(w):
    switch(w)
    t = assigned(w)
    old = (dt.datetime.now(UTC) - dt.timedelta(days=15)).strftime("%Y-%m-%dT%H:%M:%SZ")
    fresh = (dt.datetime.now(UTC) - dt.timedelta(days=13)).strftime("%Y-%m-%dT%H:%M:%SZ")
    res = sync(w, "tom", [op(t, "note", {"text": "ישן"}, claimed_device_time=old), op(t, "note", {"text": "טרי"}, claimed_device_time=fresh)]).json()["results"]
    assert res[0]["outcome"] == "held" and res[0]["reason"] == "retention_expired"
    assert res[1]["outcome"] == "applied"
    assert not any("ישן" == e["body"] for e in events(w, t["id"]))


# ---------------------------------------------------------------- lock / wipe

def test_expired_cache_locks_then_wipes_after_retention_and_unsent_ops_still_come_first(w):
    switch(w)
    t = assigned(w)
    assert bundle(w).json()["status"] == "ok"
    db = Database(w.settings.db_path)
    now = dt.datetime.now(UTC)

    def expire(hours_ago: float):
        with db.connection() as conn:
            conn.execute("UPDATE offline_devices SET valid_until = ?", ((now - dt.timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%SZ"),))

    expire(2)
    r = sync(w, "tom", [op(t, "note", {"text": "אחרי תוקף"})]).json()
    assert r["device_action"] == "lock" and r["results"][0]["outcome"] == "applied", "the unsent change is accepted, then the phone is locked"
    assert bundle(w).json()["status"] == "ok", "a fresh bundle (a sign-in) unseals it"
    expire(14 * 24 + 5)
    assert sync(w, "tom", []).json()["device_action"] == "wipe"
    assert bundle(w).json()["status"] == "wipe"
    assert w.c.post(f"{F}/wipe-confirmed", json={"device_id": "dev-phone-1"}, headers=w.h("tom")).status_code == 200
    assert bundle(w).json()["status"] == "wipe", "a wiped device stays wiped until a manager re-enrols it"
    assert w.c.post(f"{F}/devices/dev-tom/dev-phone-1/reenroll", json={}, headers=w.h("mona")).status_code == 200
    assert bundle(w).json()["status"] == "ok"


def test_expiry_lock_and_wipe_can_be_switched_off(w):
    switch(w, **{"field_offline.lock_on_expiry": "0", "field_offline.wipe_on_expiry": "0"})
    assigned(w)
    bundle(w)
    db = Database(w.settings.db_path)
    with db.connection() as conn:
        conn.execute("UPDATE offline_devices SET valid_until = '2020-01-01T00:00:00Z'")
    assert sync(w, "tom", []).json()["device_action"] == "ok"


def test_manager_remote_wipe_is_delivered_at_next_connect_and_lock_unlock(w):
    switch(w)
    assigned(w)
    bundle(w)
    assert w.c.post(f"{F}/devices/dev-tom/dev-phone-1/lock", json={"reason": "אבד"}, headers=w.h("tom")).status_code == 403
    assert w.c.post(f"{F}/devices/dev-tom/dev-phone-1/lock", json={"reason": "אבד"}, headers=w.h("mona")).status_code == 200
    assert sync(w, "tom", []).json()["device_action"] == "lock" and bundle(w).json()["status"] == "locked"
    assert w.c.post(f"{F}/devices/dev-tom/dev-phone-1/unlock", json={}, headers=w.h("mona")).status_code == 200
    assert bundle(w).json()["status"] == "ok"
    assert w.c.post(f"{F}/devices/dev-tom/dev-phone-1/wipe", json={"reason": "אבד"}, headers=w.h("mona")).status_code == 200
    assert sync(w, "tom", []).json()["device_action"] == "wipe"
    assert w.c.post(f"{F}/devices/dev-tom/dev-phone-1/unlock", json={}, headers=w.h("mona")).status_code == 409
    assert w.c.post(f"{F}/devices/dev-tom/nope-device/lock", json={}, headers=w.h("mona")).status_code == 404


# ---------------------------------------------------------------- day list

def test_day_list_is_read_only_with_one_receipt_per_day(w):
    switch(w)
    t = assigned(w)
    d = w.c.get(f"{F}/day-list", headers=w.h("tom")).json()
    assert d["read_only"] is True and d["acknowledged_at"] is None and d["ack_required"] is True
    assert t["id"] in {i["id"] for i in d["items"]}
    a = w.c.post(f"{F}/day-list/ack", json={"device_id": "watch-1"}, headers=w.h("tom")).json()
    b = w.c.post(f"{F}/day-list/ack", json={}, headers=w.h("tom")).json()
    assert a["acknowledged_at"] == b["acknowledged_at"], "the first receipt stands"
    assert w.c.get(f"{F}/day-list", headers=w.h("tom")).json()["acknowledged_at"] == a["acknowledged_at"]
    assert w.c.get(f"{F}/day-list", headers=w.h("gil")).json()["acknowledged_at"] is None, "per user"
    assert w.c.put(f"{F}/day-list", json={}, headers=w.h("tom")).status_code in (404, 405)


# ---------------------------------------------------------------- tags

def make_point(w: World, name: str = "משאבות קומה 1") -> dict:
    r = w.c.post(f"{F}/round-points", json={"name": name, "place_text": "חדר משאבות"}, headers=w.h("mona"))
    assert r.status_code == 201, r.text
    return r.json()


def tag_of(w: World, pid: str) -> str:
    r = w.c.get(f"{F}/round-points/{pid}/tag", headers=w.h("mona"))
    assert r.status_code == 200, r.text
    return r.json()["tag"]


def verify(w: World, tag: str, user: str = "tom") -> dict:
    r = w.c.post(f"{F}/tags/verify", json={"tag": tag}, headers=w.h(user))
    assert r.status_code == 200, r.text
    return r.json()


def test_signed_tag_verifies_and_forgeries_do_not(w):
    switch(w)
    p = make_point(w)
    tag = tag_of(w, p["id"])
    assert tag.startswith("SWRP1.") and verify(w, tag)["valid"] is True and verify(w, tag)["point"]["id"] == p["id"]
    head, _, mac = tag.rpartition(".")
    flipped = head + "." + ("A" if mac[0] != "A" else "B") + mac[1:]
    other = make_point(w, "אחר")
    swapped = f"SWRP1.{other['id']}.{mac}"  # another point with this point's signature
    for bad in (flipped, swapped, f"SWRP1.{p['id']}.", "SWRP1." + p["id"], "", "not a tag", f"SWRP1.{p['id']}.{'A' * 22}"):
        assert verify(w, bad)["valid"] is False, bad


def test_rotating_the_key_voids_old_tags_and_requires_admin_and_confirmation(w):
    switch(w)
    p = make_point(w)
    tag = tag_of(w, p["id"])
    assert w.c.post(f"{F}/tag-key/rotate", json={"confirmed": True}, headers=w.h("mona")).status_code == 403
    assert w.c.post(f"{F}/tag-key/rotate", json={}).status_code == 409
    assert w.c.post(f"{F}/tag-key/rotate", json={"confirmed": True}).status_code == 200
    assert verify(w, tag)["valid"] is False and verify(w, tag_of(w, p["id"]))["valid"] is True


def test_round_checkpoint_op_needs_a_valid_tag(w):
    switch(w)
    t = assigned(w)
    p = make_point(w)
    good = op(t, "round_checkpoint", {"tag": tag_of(w, p["id"])})
    bad = op(t, "round_checkpoint", {"tag": f"SWRP1.{p['id']}.{'A' * 22}"})
    res = sync(w, "tom", [good, bad]).json()["results"]
    assert res[0]["outcome"] == "applied" and res[1]["outcome"] == "rejected" and res[1]["reason"] == "bad_tag"
    assert any("משאבות קומה 1" in (e["body"] or "") for e in events(w, t["id"]))
    # a disabled point no longer verifies
    db = Database(w.settings.db_path)
    with db.connection() as conn:
        conn.execute("UPDATE offline_round_points SET enabled = 0")
    assert verify(w, tag_of(w, p["id"]))["valid"] is False
    assert "rounds" in bundle(w).json()


def test_the_tag_key_is_not_in_the_database(w):
    switch(w)
    p = make_point(w)
    tag_of(w, p["id"])
    key = (w.settings.data_dir / "field_offline_tag.key").read_bytes()
    db = Database(w.settings.db_path)
    with db.connection(mode="read") as conn:
        dump = "\n".join(str(tuple(r)) for t in ("settings", "offline_ops", "offline_round_points") for r in conn.execute(f"SELECT * FROM {t}").fetchall())
    assert key.hex() not in dump and len(key) == 32


def test_module_off_in_tickets_hides_everything(w):
    switch(w)
    assert w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    assert bundle(w).status_code == 404
