"""Owner 2026-10-19: the location of a service request may change AFTER creation. PATCH /tickets/{id} takes `location_id` (an active
organisation location: a NEW snapshot is taken at that moment; null clears it) and `place_text` ("other (free text)"). The ticket row
holds the new snapshot; the old one stays in the timeline (the `edited` row's `location.from`). The existing edit permissions hold
(a manager of the department; the creator while the request is new); every change is audited (ids and field names only).

Negative cases first. Every name and address is invented."""
from __future__ import annotations

import json

from test_tickets_org_locations import HQ, loc_id, patch, s4  # noqa: F401 - the CR-ORG-LOCATIONS world
from tickets_s4_world import API


def edit(s4, tid: str, user: str = "joni", **body):
    rev = s4.w.detail(tid)["revision"]
    return s4.c.patch(f"{API}/tickets/{tid}", json={"revision": rev, **body}, headers=s4.h(user))


def edited_events(s4, tid: str) -> list[dict]:
    return [e for e in s4.w.detail(tid)["events"] if e["kind"] == "edited"]


def audits(s4, tid: str) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT decision, details_json FROM audit_log WHERE action = 'ticket.edit' AND resource_id = ? ORDER BY rowid", (tid,)).fetchall()
    return [{"decision": r["decision"], **json.loads(r["details_json"] or "{}")} for r in rows]


# ---------------------------------------------------------------- refusals


def test_a_member_who_is_neither_manager_nor_creator_cannot_change_the_location(s4):
    lid = loc_id(s4)
    t = s4.ticket()
    r = edit(s4, t["id"], "tom", location_id=lid)
    assert r.status_code == 403 and r.json()["details"]["reason"] == "field_not_editable", r.text
    assert s4.w.detail(t["id"])["location"] is None
    assert [a["decision"] for a in audits(s4, t["id"])] == ["denied"]


def test_the_creator_may_change_it_only_while_new_and_never_on_a_closed_request(s4):
    lid = loc_id(s4)
    t = s4.ticket("nora")  # a creator who is not a member
    assert "location_id" in s4.w.detail(t["id"], "nora")["can"]["edit_fields"]
    r = edit(s4, t["id"], "nora", location_id=lid)
    assert r.status_code == 200, r.text
    assert r.json()["location"]["id"] == lid
    # once the request moves on, the creator's edit rights end (the existing rule)
    rev = s4.w.detail(t["id"])["revision"]
    assert s4.c.post(f"{API}/tickets/{t['id']}/status", json={"to": "cancelled", "note": "בוטל", "revision": rev}).status_code == 200
    r = edit(s4, t["id"], "joni", location_id=None)
    assert r.status_code == 409 and r.json()["code"] == "ticket_closed"
    assert s4.w.detail(t["id"])["location"]["id"] == lid


def test_an_inactive_or_unknown_location_is_refused_and_nothing_changes(s4):
    a = loc_id(s4)
    b = loc_id(s4, name="מחסן")
    t = s4.ticket(location_id=a)
    assert patch(s4, b, active=False).status_code == 200
    for bad in (b, "unknown00000"):
        r = edit(s4, t["id"], location_id=bad)
        assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "location_id", "code": "unknown"}], r.text
    assert s4.w.detail(t["id"])["location"]["id"] == a and edited_events(s4, t["id"]) == []


def test_a_stale_revision_is_refused(s4):
    lid = loc_id(s4)
    t = s4.ticket()
    r = s4.c.patch(f"{API}/tickets/{t['id']}", json={"revision": t["revision"] + 5, "location_id": lid})
    assert r.status_code == 409 and r.json()["code"] == "ticket_stale"


def test_a_too_long_free_text_place_is_refused(s4):
    t = s4.ticket()
    r = edit(s4, t["id"], place_text="ח" * 201)
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "place_text", "code": "too_long"}]


# ---------------------------------------------------------------- the change, the new snapshot, the history


def test_a_manager_changes_the_location_a_new_snapshot_is_taken_and_the_old_one_stays_in_the_timeline(s4):
    a = loc_id(s4)
    b = loc_id(s4, name="מחסן צפון", street="התעשייה 7", city="חיפה", details="")
    t = s4.ticket(location_id=a)
    old = t["location"]
    r = edit(s4, t["id"], location_id=b)
    assert r.status_code == 200, r.text
    now = r.json()
    assert now["location"]["id"] == b and now["location"]["text"] == "מחסן צפון · התעשייה 7, חיפה"
    (ev,) = edited_events(s4, t["id"])
    assert ev["data"]["fields"] == ["location_id"]
    assert ev["data"]["location"]["from"]["id"] == a and ev["data"]["location"]["from"]["text"] == old["text"]
    assert ev["data"]["location"]["from"]["snapshot"]["name"] == HQ["name"], "the old snapshot is kept as it was"
    assert ev["data"]["location"]["to"]["id"] == b and ev["data"]["location"]["to"]["snapshot"]["city"] == "חיפה"
    # editing location b afterwards never rewrites the request (the snapshot of the change is frozen too)
    assert patch(s4, b, name="מחסן דרום").status_code == 200
    assert s4.w.detail(t["id"])["location"]["text"] == "מחסן צפון · התעשייה 7, חיפה"
    (allowed,) = [x for x in audits(s4, t["id"]) if x["decision"] == "allowed"]
    assert allowed["fields"] == ["location_id"] and (allowed["location_from"], allowed["location_to"]) == (a, b)
    assert "מחסן" not in json.dumps(allowed, ensure_ascii=False) and "חיפה" not in json.dumps(allowed, ensure_ascii=False), "ids only"


def test_picking_the_same_location_again_takes_a_fresh_snapshot_only_when_it_changed(s4):
    a = loc_id(s4)
    t = s4.ticket(location_id=a)
    r = edit(s4, t["id"], location_id=a)
    assert r.status_code == 200 and edited_events(s4, t["id"]) == [], "nothing changed: no timeline row"
    assert patch(s4, a, street="ויצמן 1", city="רחובות").status_code == 200
    assert s4.w.detail(t["id"])["location"]["address"] == "הרצל 5, תל אביב"
    r = edit(s4, t["id"], location_id=a)
    assert r.status_code == 200, r.text
    assert r.json()["location"]["address"] == "ויצמן 1, רחובות", "the snapshot of this moment"
    (ev,) = edited_events(s4, t["id"])
    assert ev["data"]["location"]["from"]["snapshot"]["street"] == "הרצל 5"


def test_switching_to_free_text_and_clearing(s4):
    a = loc_id(s4)
    t = s4.ticket(location_id=a)
    r = edit(s4, t["id"], location_id=None, place_text="  חדר ישיבות קטן ")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["location"] is None and d["place_text"] == "חדר ישיבות קטן"
    r = edit(s4, t["id"], place_text="")
    assert r.status_code == 200 and r.json()["place_text"] == ""
    evs = edited_events(s4, t["id"])
    assert len(evs) == 2
    assert evs[0]["data"]["location"]["from"]["id"] == a and evs[0]["data"]["location"]["to"] == {
        "id": None, "snapshot": None, "text": "", "place_text": "חדר ישיבות קטן"}
    assert evs[1]["data"]["fields"] == ["place_text"]


def test_a_vendor_assignment_is_marked_stale_when_the_location_changes(s4):
    a = loc_id(s4)
    d, _tok = s4.sent()
    r = edit(s4, d["id"], location_id=a)
    assert r.status_code == 200, r.text
    assert r.json()["external_stale"] is True, "the vendor got the old place"
