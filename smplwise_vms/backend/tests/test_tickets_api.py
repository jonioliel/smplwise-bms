"""CR-038 slice 1 - the internal tickets API end to end: creation (validation, the running number, priorities and categories,
idempotency by client_request_id), editing (manager vs creator, optimistic revision), the status line with who may move it (manager,
current internal assignee; written reasons; close / cancel / duplicate / reopen within the window), assignment to an internal user
(eligibility, reassignment, the reopen with an assignment, an outside contact refused until slice 4), the return by the assignee ("לא
שלי" / "לא אוכל לטפל" with a required reason), notes, the ETA, and the audit rows (the envelope only: no title, note or reason text)."""
from __future__ import annotations

import datetime as dt
import json

import pytest

from smplwise.services.tickets import model, store
from tickets_world import API, MAINT, build, rid


@pytest.fixture()
def w(settings):
    return build(settings)


def _audit(w, action: str) -> list[dict]:
    with w.c.app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


# ---------------------------------------------------------------- create

def test_create_validates_and_numbers(w):
    a = w.create("tom", "  מזגן‮ לא   מקרר ", description="שורה 1\r\nשורה 2​")
    b = w.create("nora", "נורה")
    assert (a["number"], b["number"]) == (1001, 1002)
    assert a["title"] == "מזגן לא מקרר" and a["description"] == "שורה 1\nשורה 2", "Cc / Cf stripped, line feeds kept in the description"
    assert a["status"] == "new" and a["waiting_on"] == "manager" and a["waiting_reason"] == "unassigned" and a["origin"] == "manual"
    assert a["priority"]["key"] == "normal", "the department's default priority"
    assert [e["kind"] for e in a["events"]] == ["created"]
    for body, field in (
        ({"title": "​ ‮"}, "title"), ({"title": "x" * 121}, "title"), ({"title": "x", "description": "y" * 4001}, "description"),
        ({"title": "x", "department_id": "nope-nope"}, "department_id"), ({"title": "x", "priority_id": "prio-nope"}, "priority_id"),
        ({"title": "x", "category_id": "cat-nope"}, "category_id"),
    ):
        r = w.c.post(f"{API}/tickets", json={"department_id": MAINT, "client_request_id": rid(), **body}, headers=w.h("tom"))
        assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == field, (body, r.text)
    assert w.c.post(f"{API}/tickets", json={"department_id": MAINT, "title": "x", "client_request_id": rid(), "entity_id": "light.x"}, headers=w.h("tom")).status_code == 422
    assert w.c.post(f"{API}/tickets", json={"department_id": MAINT, "title": "x"}, headers=w.h("tom")).status_code == 422, "client_request_id is required"


def test_priority_and_category_choices(w):
    depts = w.c.get(f"{API}/tickets/admin/departments").json()["departments"]
    maint = next(d for d in depts if d["id"] == MAINT)
    urgent = next(p for p in maint["priorities"] if p["key"] == "urgent")
    r = w.c.post(f"{API}/tickets/admin/departments/{MAINT}/categories", json={"name": "מיזוג", "default_priority_id": urgent["id"]})
    cat = next(c for c in r.json()["categories"] if c["name"] == "מיזוג")
    t = w.create("tom", "מזגן", category_id=cat["id"])
    assert t["category"]["name"] == "מיזוג" and t["priority"]["key"] == "urgent", "the category's default priority"
    low = next(p for p in maint["priorities"] if p["key"] == "low")
    assert w.create("tom", "מזגן 2", category_id=cat["id"], priority_id=low["id"])["priority"]["key"] == "low"
    other = w.c.get(f"{API}/tickets/admin/departments").json()["departments"]
    clean_prio = next(d for d in other if d["id"] == w.cleaning)["priorities"][0]["id"]
    r = w.c.post(f"{API}/tickets", json={"department_id": MAINT, "title": "x", "priority_id": clean_prio, "client_request_id": rid()}, headers=w.h("tom"))
    assert r.status_code == 422, "a priority of another department"


def test_create_is_idempotent_per_client_request_id(w):
    body = {"department_id": MAINT, "title": "חלון", "client_request_id": "retry-retry-0001"}
    first = w.c.post(f"{API}/tickets", json=body, headers=w.h("tom"))
    again = w.c.post(f"{API}/tickets", json=body, headers=w.h("tom"))
    assert first.status_code == again.status_code == 201 and first.json()["id"] == again.json()["id"]
    with w.c.app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM tickets WHERE title = 'חלון'").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM ticket_requests").fetchone()[0] == 1
    other_user = w.c.post(f"{API}/tickets", json=body, headers=w.h("mona"))
    assert other_user.status_code == 201 and other_user.json()["id"] != first.json()["id"], "the id is scoped to the caller"
    with w.c.app.state.db.connection() as conn:  # the same id stored for another route
        conn.execute("UPDATE ticket_requests SET route = 'POST /elsewhere' WHERE scope = 'user:dev-tom'")
    assert w.c.post(f"{API}/tickets", json=body, headers=w.h("tom")).json()["code"] == "request_id_reused"


def test_create_with_an_assignment_checks_everything_before_writing(w):
    ok = w.create("mona", "דוד", assign={"kind": "user", "id": "dev-tom"}, assign_note="דחוף")
    assert ok["status"] == "assigned" and ok["assignee"]["name"] == "tom"
    for user, assignee, code in (("tom", "dev-mona", 403), ("mona", "dev-nora", 409), ("mona", "dev-dina", 409)):
        before = w.c.get(f"{API}/tickets?status=all").json()["items"]
        r = w.c.post(f"{API}/tickets", json={"department_id": MAINT, "title": "ניסיון", "client_request_id": rid(), "assign": {"kind": "user", "id": assignee}},
                     headers=w.h(user))
        assert r.status_code == code, (user, assignee, r.text)
        assert len(w.c.get(f"{API}/tickets?status=all").json()["items"]) == len(before), "a refused assignment leaves no half-made ticket"
    r = w.c.post(f"{API}/tickets", json={"department_id": MAINT, "title": "ספק", "client_request_id": rid(), "assign": {"kind": "contact", "id": "c1c1c1c1"}},
                 headers=w.h("mona"))
    assert r.status_code == 403, "mona holds no tickets.external"
    r = w.c.post(f"{API}/tickets", json={"department_id": MAINT, "title": "ספק", "client_request_id": rid(), "assign": {"kind": "contact", "id": "c1c1c1c1"}})
    assert r.status_code == 409 and r.json()["code"] == "public_link_unavailable"


# ---------------------------------------------------------------- the lifecycle

def test_the_full_line_assign_acknowledge_work_wait_done_close(w):
    t = w.create("nora", "מזגן חדר 102")
    assert w.assign("mona", t["id"], "tom").json()["status"] == "assigned"
    d = w.detail(t["id"], "tom")
    assert [x["to"] for x in d["transitions"]] == ["acknowledged", "in_progress"] and d["can"]["return"] and d["can"]["eta"]
    for to in ("acknowledged", "in_progress", "waiting_part", "in_progress", "done"):
        r = w.status("tom", t["id"], to)
        assert r.status_code == 200 and r.json()["status"] == to, (to, r.text)
    d = w.detail(t["id"], "tom")
    assert d["waiting_on"] == "manager" and d["waiting_reason"] == "done" and d["transitions"] == []
    assert w.status("tom", t["id"], "closed").json()["code"] == "invalid_transition", "the assignee never closes"
    r = w.status("mona", t["id"], "closed")
    assert r.status_code == 200 and r.json()["status"] == "closed" and r.json()["assignee"] is None and r.json()["last_assignee_name"] is None
    full = w.detail(t["id"])
    assert full["closed_by_name"] == "mona" and full["assignments"][-1]["end_reason"] == "closed"
    with w.c.app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT closed_at, purge_after, done_at FROM tickets WHERE id = ?", (t["id"],)).fetchone()
    closed = dt.datetime.fromisoformat(row["closed_at"].replace("Z", "+00:00"))
    assert dt.datetime.fromisoformat(row["purge_after"].replace("Z", "+00:00")) - closed == dt.timedelta(days=730)
    kinds = [e["kind"] for e in full["events"]]
    assert kinds == ["created", "assigned", "status", "status", "status", "status", "status", "closed"]
    tom_rows = [e for e in full["events"] if e["kind"] == "status"]
    assert all(e["external"] for e in tom_rows), "the assignee's own rows are marked for the handler"


def test_a_manager_may_act_on_behalf_and_the_row_says_so(w):
    t = w.create("nora")
    w.assign("mona", t["id"], "tom")
    r = w.status("mona", t["id"], "acknowledged")
    assert r.status_code == 200
    ev = [e for e in r.json()["events"] if e["kind"] == "status"][-1]
    assert ev["data"] == {"on_behalf": True} and ev["external"] is False


@pytest.mark.parametrize("frm_moves, to, reason_needed", [
    ([], "closed", True), ([], "cancelled", True), (["assign", "acknowledged", "in_progress", "done"], "in_progress", True),
    (["assign", "acknowledged", "in_progress", "done"], "closed", False),
])
def test_written_reasons(w, frm_moves, to, reason_needed):
    t = w.create("nora")
    for m in frm_moves:
        if m == "assign":
            w.assign("mona", t["id"], "tom")
        else:
            assert w.status("tom", t["id"], m).status_code == 200
    without = w.status("mona", t["id"], to)
    if reason_needed:
        assert without.status_code == 422 and without.json()["details"]["fields"][0]["field"] == "note"
        assert w.status("mona", t["id"], to, note="אין צורך").status_code == 200
    else:
        assert without.status_code == 200


def test_who_may_move_what(w):
    t = w.create("nora")
    w.assign("mona", t["id"], "tom")
    assert w.status("nora", t["id"], "acknowledged").status_code == 403, "the creator is not the assignee"
    assert w.status("gil", t["id"], "acknowledged").status_code == 403, "a member who is not the assignee"
    assert w.status("alda", t["id"], "cancelled", note="x").status_code == 403, "all departments without tickets.manage"
    assert w.status("tom", t["id"], "done").json()["code"] == "invalid_transition", "assigned -> done skips the line"
    assert w.status("tom", t["id"], "cancelled", note="x").json()["code"] == "invalid_transition"


def test_optimistic_revision(w):
    t = w.create("nora")
    rev = w.detail(t["id"])["revision"]
    assert w.c.patch(f"{API}/tickets/{t['id']}", json={"title": "חדש", "revision": rev}, headers=w.h("mona")).status_code == 200
    stale = w.c.patch(f"{API}/tickets/{t['id']}", json={"title": "ישן", "revision": rev}, headers=w.h("mona"))
    assert stale.status_code == 409 and stale.json()["code"] == "ticket_stale" and stale.json()["details"]["revision"] == rev + 1
    stale = w.c.post(f"{API}/tickets/{t['id']}/status", json={"to": "cancelled", "note": "x", "revision": rev}, headers=w.h("mona"))
    assert stale.json()["code"] == "ticket_stale"
    # a note is progress, not an edit: it does not move the revision
    w.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": "הערה"}, headers=w.h("mona"))
    assert w.detail(t["id"])["revision"] == rev + 1


def test_cancel_as_a_duplicate_writes_on_the_original_and_reopen_window(w):
    original = w.create("tom", "חלון שבור")
    dup = w.create("nora", "חלון שבור")
    r = w.status("mona", dup["id"], "cancelled", note="כפולה", duplicate_of=original["id"])
    assert r.status_code == 200 and r.json()["status"] == "cancelled" and r.json()["duplicate_of"]["number"] == original["number"]
    orig = w.detail(original["id"])
    assert orig["events"][-1]["kind"] == "duplicate" and orig["events"][-1]["data"]["number"] == dup["number"]
    assert w.status("mona", dup["id"], "new").json()["code"] == "invalid_transition", "a cancelled ticket is final"
    assert w.status("mona", original["id"], "new").json()["code"] == "invalid_transition", "only a closed ticket reopens"
    w.status("mona", original["id"], "closed", note="תוקן במקום")
    reopened = w.status("mona", original["id"], "new")
    assert reopened.status_code == 200 and reopened.json()["status"] == "new" and reopened.json()["reopen_count"] == 1
    w.status("mona", original["id"], "closed", note="שוב")
    with w.c.app.state.db.connection() as conn:  # closed 15 days ago: the default window is 14 days
        conn.execute("UPDATE tickets SET closed_at = '2026-01-01T00:00:00Z' WHERE id = ?", (original["id"],))
    late = w.status("mona", original["id"], "new")
    assert late.status_code == 409 and late.json()["code"] == "reopen_window_passed"
    assert w.assign("mona", original["id"], "tom").json()["code"] == "reopen_window_passed"
    assert "new" not in [x["to"] for x in w.detail(original["id"], "mona")["transitions"]]


def test_reopen_with_an_assignment(w):
    t = w.create("nora")
    w.status("mona", t["id"], "closed", note="לא רלוונטי")
    r = w.assign("mona", t["id"], "tom")
    assert r.status_code == 200 and r.json()["status"] == "assigned" and r.json()["reopen_count"] == 1
    assert [e["kind"] for e in r.json()["events"]][-2:] == ["reopened", "assigned"]


# ---------------------------------------------------------------- assignment and return

def test_assignment_rules(w):
    t = w.create("nora")
    assert w.assign("tom", t["id"], "tom").status_code == 403, "a member is not a manager"
    assert w.assign("cleo", t["id"], "tom").status_code == 404, "the other department's manager does not even see it"
    for nope in ("nora", "dina", "vic", "fred"):
        r = w.assign("mona", t["id"], nope)
        assert r.status_code == 409 and r.json()["code"] == "assignee_not_allowed", nope
    assert w.assign("mona", t["id"], "tom").status_code == 200
    assert w.assign("mona", t["id"], "tom").json()["code"] == "already_assigned"
    r = w.assign("mona", t["id"], "gil", note="תחליף את טום")
    assert r.status_code == 200 and r.json()["assignee"]["id"] == "dev-gil"
    full = w.detail(t["id"])
    assert [(a["name"], a["end_reason"]) for a in full["assignments"]] == [("tom", "reassigned"), ("gil", None)]
    assert full["events"][-2]["kind"] == "reassigned" and full["events"][-2]["data"] == {"assignee": "gil", "assignee_kind": "user", "previous": "tom"}
    assert full["events"][-1]["kind"] == "note" and full["events"][-1]["external"] is True, "the assign dialog's note is for the handler by default"
    assert w.get("tom", t["id"]).status_code == 200, "tom is still a member"
    contact = w.c.post(f"{API}/tickets/{t['id']}/assign", json={"assignee": {"kind": "contact", "id": "vendor01"}, "revision": full["revision"]})
    assert contact.status_code == 409 and contact.json()["code"] == "public_link_unavailable"
    assert w.c.post(f"{API}/tickets/{t['id']}/assign", json={"assignee": {"kind": "contact", "id": "vendor01"}, "revision": full["revision"]},
                    headers=w.h("mona")).status_code == 403, "a contact needs tickets.external (D25)"


@pytest.mark.parametrize("kind, reason_code", [("not_mine", "not_mine"), ("cannot_handle", "returned")])
def test_the_assignee_returns_with_a_required_reason(w, kind, reason_code):
    t = w.create("nora")
    w.assign("mona", t["id"], "tom")
    rev = w.detail(t["id"])["revision"]
    no_reason = w.c.post(f"{API}/tickets/{t['id']}/return", json={"kind": kind, "reason": " ​ ", "revision": rev}, headers=w.h("tom"))
    assert no_reason.status_code == 422 and no_reason.json()["details"]["fields"][0]["field"] == "reason"
    assert w.c.post(f"{API}/tickets/{t['id']}/return", json={"kind": kind, "reason": "x", "revision": rev}, headers=w.h("mona")).status_code == 403
    r = w.c.post(f"{API}/tickets/{t['id']}/return", json={"kind": kind, "reason": "הציוד שייך לבניין השכן", "revision": rev}, headers=w.h("tom"))
    assert r.status_code == 200 and r.json()["status"] == "returned" and r.json()["waiting_reason"] == reason_code and r.json()["assignee"] is None
    a = w.detail(t["id"])["assignments"][-1]
    assert (a["end_reason"], a["return_kind"], a["return_reason"]) == ("returned", kind, "הציוד שייך לבניין השכן")
    assert w.assign("mona", t["id"], "gil").status_code == 200, "back to the manager, who reassigns"


def test_a_non_member_assignee_keeps_the_ticket_until_it_is_returned(w):
    t = w.create("nora")
    w.assign("mona", t["id"], "gil")
    w.c.delete(f"{API}/tickets/admin/departments/{MAINT}/members/user/dev-gil")
    d = w.detail(t["id"], "gil")
    assert d["view"] == "limited" and d["can"]["return"], "the CURRENT internal assignee sees it (limited) after leaving the department"
    r = w.c.post(f"{API}/tickets/{t['id']}/return", json={"kind": "not_mine", "reason": "עזבתי את המחלקה", "revision": d["revision"]}, headers=w.h("gil"))
    assert r.status_code == 200 and r.json()["view"] == "none"
    assert w.get("gil", t["id"]).status_code == 404


# ---------------------------------------------------------------- edits, notes, ETA

def test_edit_rules(w):
    t = w.create("nora", "מנורה")
    rev = w.detail(t["id"])["revision"]
    r = w.c.patch(f"{API}/tickets/{t['id']}", json={"title": "מנורה מהבהבת", "description": "בלובי", "revision": rev}, headers=w.h("nora"))
    assert r.status_code == 200 and r.json()["title"] == "מנורה מהבהבת", "the creator edits title and description while new"
    rev = r.json()["revision"]
    assert w.c.patch(f"{API}/tickets/{t['id']}", json={"priority_id": "prio-maintenance-urgent", "revision": rev}, headers=w.h("nora")).status_code == 403
    w.assign("mona", t["id"], "tom")
    rev = w.detail(t["id"])["revision"]
    assert w.c.patch(f"{API}/tickets/{t['id']}", json={"title": "x", "revision": rev}, headers=w.h("nora")).status_code == 403, "not while assigned"
    r = w.c.patch(f"{API}/tickets/{t['id']}", json={"priority_id": "prio-maintenance-urgent", "revision": rev}, headers=w.h("mona"))
    assert r.status_code == 200 and r.json()["priority"]["key"] == "urgent"
    ev = r.json()["events"][-1]
    assert ev["kind"] == "edited" and ev["data"] == {"fields": ["priority_id"]}
    assert w.c.patch(f"{API}/tickets/{t['id']}", json={"title": None, "revision": r.json()["revision"]}, headers=w.h("mona")).status_code == 422


def test_moving_to_another_department(w):
    t = w.create("nora")
    w.assign("mona", t["id"], "tom")
    rev = w.detail(t["id"])["revision"]
    assert w.c.patch(f"{API}/tickets/{t['id']}", json={"department_id": w.cleaning, "revision": rev}, headers=w.h("mona")).status_code == 403, \
        "mona does not manage cleaning"
    r = w.c.patch(f"{API}/tickets/{t['id']}", json={"department_id": w.cleaning, "revision": rev})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["department"]["id"] == w.cleaning and d["priority"]["key"] == "normal" and d["category"] is None
    assert d["status"] == "new" and d["assignee"] is None, "tom is not a member of cleaning: his assignment ends"
    assert d["events"][-1]["data"]["assignment_ended"] is True
    assert w.get("mona", t["id"]).status_code == 404 and w.get("cleo", t["id"]).status_code == 200


def test_notes_and_eta(w):
    t = w.create("nora")
    assert w.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": ""}, headers=w.h("nora")).status_code == 422
    assert w.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": "x" * 2001}, headers=w.h("nora")).status_code == 422
    assert w.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": "בדיקה"}, headers=w.h("fred")).status_code == 404
    eta = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=2)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    assert w.c.post(f"{API}/tickets/{t['id']}/eta", json={"eta_at": eta}, headers=w.h("mona")).json()["code"] == "invalid_state", "no ETA before handling"
    w.assign("mona", t["id"], "tom")
    assert w.c.post(f"{API}/tickets/{t['id']}/eta", json={"eta_at": eta}, headers=w.h("nora")).status_code == 403
    r = w.c.post(f"{API}/tickets/{t['id']}/eta", json={"eta_at": eta}, headers=w.h("tom"))
    assert r.status_code == 200 and r.json()["eta_at"] == eta and r.json()["events"][-1]["external"] is True
    assert w.c.post(f"{API}/tickets/{t['id']}/eta", json={"eta_at": "2020-01-01T00:00:00Z"}, headers=w.h("tom")).status_code == 422
    assert w.c.post(f"{API}/tickets/{t['id']}/eta", json={"eta_at": None}, headers=w.h("mona")).json()["eta_at"] is None
    w.status("mona", t["id"], "closed", note="סגור")
    assert w.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": "מאוחר"}, headers=w.h("mona")).json()["code"] == "ticket_closed"


# ---------------------------------------------------------------- the audit rows: the envelope only

def test_audit_rows_never_carry_free_text(w):
    secret = "סוד-של-הדייר-12345"
    t = w.create("nora", f"כותרת {secret}", description=f"תיאור {secret}")
    w.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": f"הערה {secret}"}, headers=w.h("mona"))
    w.assign("mona", t["id"], "tom", note=f"הערת שיוך {secret}")
    rev = w.detail(t["id"])["revision"]
    w.c.post(f"{API}/tickets/{t['id']}/return", json={"kind": "not_mine", "reason": f"סיבה {secret}", "revision": rev}, headers=w.h("tom"))
    w.status("mona", t["id"], "cancelled", note=f"ביטול {secret}")
    with w.c.app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT action, details_json FROM audit_log WHERE action LIKE 'ticket.%' AND resource_type = 'ticket'").fetchall()
    actions = {r["action"] for r in rows}
    assert {"ticket.create", "ticket.note", "ticket.assign", "ticket.return", "ticket.cancel"} <= actions
    for r in rows:
        assert secret not in (r["details_json"] or ""), r["action"]
        details = json.loads(r["details_json"] or "{}")
        if r["action"] != "ticket.create":
            assert details.get("number") == t["number"], r["action"]


def test_the_list_filters(w):
    a = w.create("tom", "מזגן קומה 1")
    b = w.create("tom", "נורה בלובי")
    w.status("mona", b["id"], "closed", note="תוקן")
    items = lambda q: [i["number"] for i in w.c.get(f"{API}/tickets{q}", headers=w.h("mona")).json()["items"]]  # noqa: E731
    assert items("") == [a["number"]], "open by default"
    assert items("?status=closed") == [b["number"]]
    assert sorted(items("?status=all")) == sorted([a["number"], b["number"]])
    assert items("?status=all&q=מזגן") == [a["number"]]
    assert items(f"?status=all&q=%23{b['number']}") == [b["number"]]
    assert items(f"?status=all&q={b['number']}") == [b["number"]]
    assert items("?status=all&q=%25") == [], "LIKE wildcards are escaped"
    assert items(f"?status=all&department_id={w.cleaning}") == []
    assert w.c.get(f"{API}/tickets?status=bogus", headers=w.h("mona")).status_code == 422


def test_keyset_pagination_is_stable_and_complete(w):
    made = [w.create("tom", f"קריאה-בדיקה {i}")["number"] for i in range(7)]
    seen: list[int] = []
    cursor = None
    while True:
        q = f"?limit=3{'&cursor=' + cursor if cursor else ''}"
        page = w.c.get(f"{API}/tickets{q}", headers=w.h("mona")).json()
        seen += [i["number"] for i in page["items"]]
        cursor = page["next_cursor"]
        if not cursor:
            break
    assert sorted(seen) == sorted(made) and len(seen) == len(set(seen))
    assert w.c.get(f"{API}/tickets?cursor=garbage!!", headers=w.h("mona")).status_code == 200, "a tampered cursor only restarts the list"


def test_a_page_is_scanned_within_its_budget_and_continues_by_cursor(w, monkeypatch):
    """Section 13.6: the SQL superset (gil's department) holds rows the place check refuses (floor-2 tickets, gil sees floor 3 only);
    a page scans at most SCAN_FACTOR x limit candidates and comes back SHORT with a cursor; following it reaches the visible ticket."""
    from smplwise.services.tickets import access

    visible = w.create("tom", "גלוי לגיל")  # placeless, the oldest activity
    placed = []
    for i in range(4):
        t = w.create("tom", f"קומה 2 - {i}")
        w.place(t["id"], "floor2")
        placed.append(t["id"])
    with w.c.app.state.db.connection() as conn:  # distinct activity instants: the floor-2 tickets come first, newest activity first
        conn.execute("UPDATE tickets SET last_activity_at = '2026-10-01T00:00:00Z' WHERE id = ?", (visible["id"],))
        for i, tid in enumerate(placed):
            conn.execute("UPDATE tickets SET last_activity_at = ? WHERE id = ?", (f"2026-10-02T00:00:0{i}Z", tid))
    monkeypatch.setattr(access, "SCAN_FACTOR", 1)
    page = w.c.get(f"{API}/tickets?scope=department&limit=2", headers=w.h("gil")).json()
    assert page["items"] == [] and page["next_cursor"], "a short (here empty) page, and a cursor to continue"
    found, cursor = [], page["next_cursor"]
    while cursor:
        page = w.c.get(f"{API}/tickets?scope=department&limit=2&cursor={cursor}", headers=w.h("gil")).json()
        found += [i["id"] for i in page["items"]]
        cursor = page["next_cursor"]
    assert found == [visible["id"]]


def test_the_running_number_is_one_sequence(w):
    with w.c.app.state.db.connection() as conn:
        numbers = [store.next_number(conn) for _ in range(5)]
    assert numbers == list(range(numbers[0], numbers[0] + 5))
    assert model.STATUSES[0] == "new"
