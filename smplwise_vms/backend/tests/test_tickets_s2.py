"""CR-038 slice 2 - departments + SLA: the installation values of section 14.1 (link lifetime D5, vendor send hours D4, urgent as
critical D28), the department overrides and flags (automatic close D10, history to the handler D3 / D23), the effective policy
(services/tickets/policy.py), the SLA grid (every threshold per department x priority, 13.1 / D11), the dues of a ticket recomputed at
every change (services/tickets/sla.py), ticket templates with the audited text diff, category domains, the "מי רשאי" roles matrix,
and the permission matrix of every new route (configure only; the installation document stays system.configure; module off -> 404)."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import as_user, bind

from smplwise.services.tickets import policy, settings_doc, sla
from tickets_world import API, MAINT, build


@pytest.fixture()
def w(settings):
    return build(settings)


def _dept(w, dept_id: str = MAINT, user: str = "joni") -> dict:
    r = w.c.get(f"{API}/tickets/admin/departments", headers=as_user(user))
    assert r.status_code == 200, r.text
    return next(d for d in r.json()["departments"] if d["id"] == dept_id)


def _audit(w, action: str) -> list[dict]:
    with w.c.app.state.db.connection(mode="read") as conn:
        return [json.loads(r[0]) for r in conn.execute("SELECT details_json FROM audit_log WHERE action = ? AND decision = 'allowed' ORDER BY id", (action,)).fetchall()]


def _t(at: str) -> dt.datetime:
    return dt.datetime.fromisoformat(at.replace("Z", "+00:00"))


def _minutes(a: str, b: str) -> float:
    return (_t(a) - _t(b)).total_seconds() / 60


# ---------------------------------------------------------------- pure: the policy resolution and the due computation

INST = {"links": {"sliding_days": 14, "cap_days": 90, "grace_hours": 24}, "send_hours": {"from": "07:00", "to": "21:00"}, "urgent_is_critical": True}


def test_policy_resolution_overrides_and_fail_safe_reads():
    p = policy.resolve(INST, {"reopen_days": 14})
    assert (p.link_sliding_days, p.link_cap_days, p.link_grace_hours, p.send_hours, p.urgent_is_critical, p.auto_close_after_days) == \
        (14, 90, 24, {"from": "07:00", "to": "21:00"}, True, None)
    assert p.overridden == frozenset()
    d = {"link_sliding_days": 30, "link_grace_hours": 0, "send_hours_json": '{"from":"08:00","to":"18:00"}', "urgent_is_critical": 0,
         "auto_close_after_days": 3, "share_history_external": 1, "reopen_days": 7}
    p = policy.resolve(INST, d)
    assert (p.link_sliding_days, p.link_cap_days, p.link_grace_hours) == (30, 90, 0)
    assert p.send_hours == {"from": "08:00", "to": "18:00"} and p.urgent_is_critical is False and p.auto_close_after_days == 3
    assert p.overridden == {"link_sliding_days", "link_grace_hours", "send_hours", "urgent_is_critical"}
    # corrupt / out-of-range stored values read as the installation value; the cap is never shorter than the sliding window
    bad = policy.resolve(INST, {"link_sliding_days": 500, "send_hours_json": "{oops", "auto_close_after_days": 99, "link_cap_days": 7})
    assert (bad.link_sliding_days, bad.send_hours["from"], bad.auto_close_after_days) == (14, "07:00", None)
    assert bad.link_cap_days == 14, "an override cap below the effective sliding window is pulled up, never down"
    # D28 and D3
    assert policy.notify_severity(p, "critical") == "alert" and policy.notify_severity(p, "info") == "info"
    assert policy.notify_severity(policy.resolve(INST, {}), "critical") == "critical"
    assert policy.may_share_history(p, "climate") and not any(policy.may_share_history(p, d) for d in ("lock", "alarm_control_panel", "cover", "camera"))
    assert not policy.may_share_history(policy.resolve(INST, {}), "climate"), "off by default (D3)"


RULE = {"unassigned_after_min": 240, "ack_within_min": 1440, "stuck_after_min": 4320, "stuck_waiting_min": 10080, "resolve_within_min": 10080}
T0 = "2026-10-13T08:00:00Z"


def _c(status: str, **kw):
    base = dict(status=status, created_at=T0, last_activity_at=kw.pop("last", T0), unassigned_since=kw.pop("since", None), assigned_at=kw.pop("assigned", None),
                eta_at=kw.pop("eta", None), done_at=kw.pop("done", None), rule=kw.pop("rule", RULE), auto_close_after_days=kw.pop("auto", None))
    return sla.compute(**base)


def test_due_computation_per_status():
    d = _c("new")
    assert d.ack_due_at == "2026-10-13T12:00:00Z" and d.stuck_due_at is None and d.resolve_due_at == "2026-10-20T08:00:00Z"
    assert d.next_check_at == d.ack_due_at
    assert _c("returned", since="2026-10-14T08:00:00Z").ack_due_at == "2026-10-14T12:00:00Z", "measured from the return"
    d = _c("assigned", assigned="2026-10-13T09:00:00Z")
    assert d.ack_due_at == "2026-10-14T09:00:00Z" and d.stuck_due_at is None
    d = _c("in_progress", last="2026-10-14T08:00:00Z")
    assert d.ack_due_at is None and d.stuck_due_at == "2026-10-17T08:00:00Z"
    assert _c("waiting_part", last="2026-10-14T08:00:00Z").stuck_due_at == "2026-10-21T08:00:00Z", "its own threshold"
    assert _c("in_progress", last=T0, eta="2026-10-18T08:00:00Z").stuck_due_at == "2026-10-18T08:00:00Z", "a later ETA suppresses stuck"
    assert _c("in_progress", last=T0, eta="2026-10-14T08:00:00Z").stuck_due_at == "2026-10-16T08:00:00Z", "an earlier ETA changes nothing"
    d = _c("done", done="2026-10-15T08:00:00Z")
    assert d == sla.Dues(None, None, None, None), "done: resolved, a manager closes (two-step)"
    d = _c("done", done="2026-10-15T08:00:00Z", auto=3)
    assert d.next_check_at == "2026-10-18T08:00:00Z" and d.resolve_due_at is None, "D10: the automatic close time"
    assert _c("closed") == sla.NONE and _c("cancelled") == sla.NONE
    off = _c("new", rule={**RULE, "unassigned_after_min": None, "resolve_within_min": None})
    assert off == sla.NONE, "an empty threshold is off"
    assert _c("new", rule=None) == sla.NONE
    assert sla.due_kind("new", "ack_due_at") == "unassigned" and sla.due_kind("assigned", "ack_due_at") == "ack"
    assert sla.due_kind("waiting_part", "stuck_due_at") == "waiting" and sla.due_kind("in_progress", "stuck_due_at") == "stuck"
    assert sla.due_kind("done", "resolve_due_at") is None and sla.due_kind("new", "resolve_due_at") == "overdue"


def test_rule_validation():
    assert sla.validate_rule({"ack_within_min": None, "max_reminders": 0}) == {"ack_within_min": None, "max_reminders": 0}
    for bad in ({"ack_within_min": 0}, {"ack_within_min": sla.MINUTES_MAX + 1}, {"ack_within_min": True}, {"max_reminders": 11}, {"bogus": 1}):
        with pytest.raises(Exception):
            sla.validate_rule(bad)
    for good, bad in (({"from": "07:00", "to": "21:00"}, {"from": "21:00", "to": "07:00"}), ({"from": "00:00", "to": "23:59"}, {"from": "08:00", "to": "08:00"})):
        assert settings_doc.send_hours(good) == good
        with pytest.raises(ValueError):
            settings_doc.send_hours(bad)
    for bad in ({"from": "7:00", "to": "21:00"}, {"from": "07:00", "to": "24:00"}, {"from": "07:00"}, "07:00-21:00"):
        with pytest.raises(ValueError):
            settings_doc.send_hours(bad)


# ---------------------------------------------------------------- the installation values (section 14.1)

def test_installation_values_of_links_send_hours_and_urgent(w, settings):
    doc = w.c.get(f"{API}/tickets/settings").json()
    assert doc["links"] == {"sliding_days": 14, "cap_days": 90, "grace_hours": 24}
    assert doc["send_hours"] == {"from": "07:00", "to": "21:00"} and doc["urgent_is_critical"] is True
    r = w.c.put(f"{API}/tickets/settings", json={"revision": 0, "links": {"sliding_days": 21, "grace_hours": 0}, "send_hours": {"from": "08:00", "to": "20:00"},
                                                 "urgent_is_critical": False})
    assert r.status_code == 200, r.text
    assert r.json()["links"] == {"sliding_days": 21, "cap_days": 90, "grace_hours": 0} and r.json()["send_hours"]["from"] == "08:00"
    assert _audit(w, "tickets.settings.update")[-1]["changed"] == ["links.sliding_days", "links.grace_hours", "send_hours", "urgent_is_critical"]
    for body, field, code in (
        ({"links": {"cap_days": 14}}, "links.cap_days", "below_sliding"),
        ({"links": {"sliding_days": 0}}, "links.sliding_days", "range"),
        ({"links": {"grace_hours": 169}}, "links.grace_hours", "range"),
        ({"send_hours": {"from": "22:00", "to": "06:00"}}, "send_hours", "order"),
        ({"send_hours": {"from": "9", "to": "17:00"}}, "send_hours", "time"),
    ):
        r = w.c.put(f"{API}/tickets/settings", json={"revision": 1, **body})
        assert r.status_code == 422 and r.json()["details"]["fields"][0] == {"field": field, "code": code}, (body, r.text)
    assert w.c.put(f"{API}/tickets/settings", json={"revision": 1, "links": {"sliding_days": "21"}}).status_code == 422, "strict integers"
    assert w.c.put(f"{API}/tickets/settings", json={"revision": 1, "links": {"days": 3}}).status_code == 422
    assert w.c.get(f"{API}/tickets/settings").json()["revision"] == 1, "nothing was written by the refusals"
    bind(w.c, settings, "cara", "tickets_configure", "installation", "*")
    assert w.c.put(f"{API}/tickets/settings", json={"revision": 1, "urgent_is_critical": True}, headers=as_user("cara")).status_code == 403
    # the department list carries the installation values the overrides fall back to
    listing = w.c.get(f"{API}/tickets/admin/departments", headers=as_user("cara")).json()
    assert listing["installation"] == {"links": {"sliding_days": 21, "cap_days": 90, "grace_hours": 0}, "send_hours": {"from": "08:00", "to": "20:00"},
                                       "urgent_is_critical": False}
    with w.c.app.state.db.connection() as conn:  # a stored pair that breaks the rule reads as the default pair
        conn.execute("UPDATE settings SET value = '{\"revision\": 5, \"links\": {\"sliding_days\": 60, \"cap_days\": 30}}' WHERE key = 'tickets.settings'")
    assert w.c.get(f"{API}/tickets/settings").json()["links"] == {"sliding_days": 14, "cap_days": 90, "grace_hours": 24}


# ---------------------------------------------------------------- department overrides and flags

def test_department_overrides_flags_and_the_effective_policy(w):
    d = _dept(w)
    assert d["overrides"] == {"link_sliding_days": None, "link_cap_days": None, "link_grace_hours": None, "send_hours": None, "urgent_is_critical": None}
    assert d["auto_close_after_days"] is None and d["share_history_external"] is False
    assert d["effective"]["links"] == {"sliding_days": 14, "cap_days": 90, "grace_hours": 24} and d["effective"]["overridden"] == []
    body = {"revision": d["revision"], "auto_close_after_days": 3, "share_history_external": True, "urgent_is_critical": False,
            "link_sliding_days": 30, "link_cap_days": 120, "link_grace_hours": 48, "send_hours": {"from": "08:00", "to": "18:00"}}
    r = w.c.patch(f"{API}/tickets/admin/departments/{MAINT}", json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["auto_close_after_days"] == 3 and d["share_history_external"] is True
    assert d["effective"]["links"] == {"sliding_days": 30, "cap_days": 120, "grace_hours": 48}
    assert d["effective"]["send_hours"] == {"from": "08:00", "to": "18:00"} and d["effective"]["urgent_is_critical"] is False
    assert sorted(d["effective"]["overridden"]) == ["link_cap_days", "link_grace_hours", "link_sliding_days", "send_hours", "urgent_is_critical"]
    row = _audit(w, "ticket.department.update")[-1]
    assert row["policy"]["auto_close_after_days"] == [None, 3] and row["policy"]["send_hours_json"] == [None, '{"from":"08:00","to":"18:00"}']
    # an explicit null clears an override (back to the installation value / the two-step close)
    r = w.c.patch(f"{API}/tickets/admin/departments/{MAINT}", json={"revision": d["revision"], "send_hours": None, "urgent_is_critical": None,
                                                                    "auto_close_after_days": None})
    d = r.json()
    assert d["overrides"]["send_hours"] is None and d["effective"]["send_hours"] == {"from": "07:00", "to": "21:00"}
    assert d["effective"]["urgent_is_critical"] is True and d["auto_close_after_days"] is None
    for bad, field, code in (
        ({"auto_close_after_days": 31}, "auto_close_after_days", "range"),
        ({"auto_close_after_days": 0}, "auto_close_after_days", "range"),
        ({"link_sliding_days": 91}, "link_sliding_days", "range"),
        ({"link_cap_days": 6}, "link_cap_days", "range"),
        ({"link_grace_hours": -1}, "link_grace_hours", "range"),
        ({"link_cap_days": 20}, "link_cap_days", "below_sliding"),  # the department's own sliding override is 30
        ({"send_hours": {"from": "18:00", "to": "08:00"}}, "send_hours", "order"),
        ({"share_history_external": None}, "share_history_external", "required"),
    ):
        r = w.c.patch(f"{API}/tickets/admin/departments/{MAINT}", json={"revision": d["revision"], **bad})
        assert r.status_code == 422 and r.json()["details"]["fields"][0] == {"field": field, "code": code}, (bad, r.text)
    assert _dept(w)["revision"] == d["revision"], "nothing written"
    # the sliding override cleared: the installation's 14 days stand, so a 20-day cap is fine now
    r = w.c.patch(f"{API}/tickets/admin/departments/{MAINT}", json={"revision": d["revision"], "link_sliding_days": None, "link_cap_days": 20})
    assert r.status_code == 200 and r.json()["effective"]["links"]["cap_days"] == 20
    # a new department may be created with its policy
    r = w.c.post(f"{API}/tickets/admin/departments", json={"key": "it", "name": "מחשוב", "auto_close_after_days": 5, "send_hours": {"from": "09:00", "to": "17:00"}})
    assert r.status_code == 201 and r.json()["auto_close_after_days"] == 5 and r.json()["overrides"]["send_hours"] == {"from": "09:00", "to": "17:00"}


# ---------------------------------------------------------------- the SLA grid

def test_sla_grid_edits_every_threshold_all_or_nothing(w):
    d = _dept(w)
    rows = {r["priority_key"]: r for r in d["sla"]}
    assert [r["priority_key"] for r in d["sla"]] == ["urgent", "high", "normal", "low"]
    assert (rows["urgent"]["ack_within_min"], rows["urgent"]["stuck_after_min"], rows["normal"]["stuck_after_min"], rows["low"]["link_unopened_min"]) == \
        (30, 60, 4320, 1440), "the 13.1 defaults"
    assert rows["urgent"]["max_reminders"] == 2 and rows["urgent"]["manager_alert_after_steps"] == 1
    urgent, normal = rows["urgent"], rows["normal"]
    body = {"rows": [
        {"priority_id": urgent["priority_id"], "revision": urgent["revision"], "ack_within_min": 20, "link_unopened_min": None, "max_reminders": 4},
        {"priority_id": normal["priority_id"], "revision": normal["revision"], "resolve_within_min": 2880, "manager_alert_after_steps": 0},
    ]}
    r = w.c.put(f"{API}/tickets/admin/departments/{MAINT}/sla", json=body)
    assert r.status_code == 200, r.text
    after = {x["priority_key"]: x for x in r.json()["sla"]}
    assert (after["urgent"]["ack_within_min"], after["urgent"]["link_unopened_min"], after["urgent"]["max_reminders"]) == (20, None, 4)
    assert after["urgent"]["stuck_after_min"] == 60, "fields not sent do not change"
    assert after["urgent"]["revision"] == urgent["revision"] + 1 and after["high"]["revision"] == rows["high"]["revision"]
    changes = {a["priority_key"]: a["changes"] for a in _audit(w, "ticket.sla.update")}
    assert changes == {"urgent": {"ack_within_min": [30, 20], "link_unopened_min": [1440, None], "max_reminders": [2, 4]},
                       "normal": {"resolve_within_min": [10080, 2880], "manager_alert_after_steps": [1, 0]}}
    # one bad row: nothing is written; a stale row: 409 naming it, nothing written
    bad = {"rows": [{"priority_id": after["low"]["priority_id"], "revision": after["low"]["revision"], "ack_within_min": 60},
                    {"priority_id": after["high"]["priority_id"], "revision": after["high"]["revision"], "stuck_after_min": 0}]}
    r = w.c.put(f"{API}/tickets/admin/departments/{MAINT}/sla", json=bad)
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "rows.1.stuck_after_min", "code": "range"}]
    stale = {"rows": [{"priority_id": after["low"]["priority_id"], "revision": after["low"]["revision"], "ack_within_min": 60},
                      {"priority_id": urgent["priority_id"], "revision": urgent["revision"], "ack_within_min": 10}]}
    r = w.c.put(f"{API}/tickets/admin/departments/{MAINT}/sla", json=stale)
    assert r.status_code == 409 and r.json()["code"] == "sla_stale" and r.json()["details"]["priority_ids"] == [urgent["priority_id"]]
    assert {x["priority_key"]: x["ack_within_min"] for x in _dept(w)["sla"]}["low"] == 4320, "nothing written"
    other = _dept(w, w.cleaning)["sla"][0]
    for rows_body, code in (([{"priority_id": other["priority_id"], "revision": other["revision"], "ack_within_min": 5}], "unknown"),
                            ([{"priority_id": urgent["priority_id"], "revision": after["urgent"]["revision"], "max_reminders": None}], "required")):
        r = w.c.put(f"{API}/tickets/admin/departments/{MAINT}/sla", json={"rows": rows_body})
        assert r.status_code == 422 and r.json()["details"]["fields"][0]["code"] == code
    assert w.c.put(f"{API}/tickets/admin/departments/{MAINT}/sla", json={"rows": [{"priority_id": urgent["priority_id"], "revision": 1, "ack_within_min": "5"}]}).status_code == 422


# ---------------------------------------------------------------- the dues follow every change of a ticket

def test_dues_are_recomputed_at_every_change(w):
    t = w.create("tom", "מזגן")  # normal: unassigned 4 h, resolve 7 days
    d = w.detail(t["id"])
    assert round(_minutes(d["sla"]["ack_due_at"], d["created_at"])) == 240 and round(_minutes(d["sla"]["resolve_due_at"], d["created_at"])) == 10080
    assert d["sla"]["stuck_due_at"] is None
    assert w.assign("mona", t["id"], "tom").status_code == 200
    d = w.detail(t["id"])
    assert round(_minutes(d["sla"]["ack_due_at"], d["assignee"]["since"])) == 1440, "acknowledge within a day of the assignment"
    assert w.status("tom", t["id"], "acknowledged").status_code == 200
    d = w.detail(t["id"])
    assert d["sla"]["ack_due_at"] is None and round(_minutes(d["sla"]["stuck_due_at"], d["last_activity_at"])) == 4320
    eta = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=10)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    assert w.c.post(f"{API}/tickets/{t['id']}/eta", json={"eta_at": eta}, headers=as_user("tom")).status_code == 200
    assert w.detail(t["id"])["sla"]["stuck_due_at"] == eta, "a later ETA suppresses stuck"
    assert w.status("tom", t["id"], "waiting_part").status_code == 200
    d = w.detail(t["id"])
    assert d["sla"]["stuck_due_at"] == eta, "still behind the ETA (waiting: 7 days < 10)"
    # a priority change recomputes from the creation time (11.3)
    urgent = next(p for p in _dept(w)["priorities"] if p["key"] == "urgent")
    r = w.c.patch(f"{API}/tickets/{t['id']}", json={"priority_id": urgent["id"], "revision": d["revision"]}, headers=as_user("mona"))
    assert r.status_code == 200, r.text
    assert round(_minutes(w.detail(t["id"])["sla"]["resolve_due_at"], d["created_at"])) == 480
    # a rule change reaches the open tickets of that priority at once
    row = next(x for x in _dept(w)["sla"] if x["priority_key"] == "urgent")
    w.c.put(f"{API}/tickets/admin/departments/{MAINT}/sla", json={"rows": [{"priority_id": row["priority_id"], "revision": row["revision"], "resolve_within_min": 600}]})
    assert round(_minutes(w.detail(t["id"])["sla"]["resolve_due_at"], d["created_at"])) == 600
    assert w.status("tom", t["id"], "done").status_code == 200
    assert w.detail(t["id"])["sla"] == {"ack_due_at": None, "stuck_due_at": None, "resolve_due_at": None}
    with w.c.app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT next_check_at FROM tickets WHERE id = ?", (t["id"],)).fetchone()[0] is None, "two-step: nothing to check"
    # D10: turning the automatic close on moves the waiting "done" ticket's next check to done_at + N days
    dept = _dept(w)
    w.c.patch(f"{API}/tickets/admin/departments/{MAINT}", json={"revision": dept["revision"], "auto_close_after_days": 2})
    with w.c.app.state.db.connection(mode="read") as conn:
        nxt, done_at = conn.execute("SELECT next_check_at, done_at FROM tickets WHERE id = ?", (t["id"],)).fetchone()
    assert round(_minutes(nxt, done_at)) == 2 * 1440
    assert w.status("mona", t["id"], "closed").status_code == 200
    with w.c.app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT next_check_at FROM tickets WHERE id = ?", (t["id"],)).fetchone()[0] is None
    # a return: the unassigned threshold counts from the return
    t2 = w.create("tom", "ברז")
    w.assign("mona", t2["id"], "tom")
    rev = w.detail(t2["id"])["revision"]
    assert w.c.post(f"{API}/tickets/{t2['id']}/return", json={"kind": "not_mine", "reason": "לא שלי", "revision": rev}, headers=as_user("tom")).status_code == 200
    d2 = w.detail(t2["id"])
    assert d2["status"] == "returned" and round(_minutes(d2["sla"]["ack_due_at"], d2["last_activity_at"])) == 240


# ---------------------------------------------------------------- ticket templates and category domains

def test_ticket_templates_with_the_audited_diff(w, settings):
    cat = w.c.post(f"{API}/tickets/admin/departments/{MAINT}/categories", json={"name": "מיזוג"}).json()["categories"][0]
    r = w.c.post(f"{API}/tickets/admin/departments/{MAINT}/templates",
                 json={"name": " מזגן ‮לא מקרר ", "title": "מזגן לא מקרר", "body": "חדר:\nתיאור:", "category_id": cat["id"], "priority_key": "high"})
    assert r.status_code == 201, r.text
    tpl = r.json()["templates"][0]
    assert tpl["name"] == "מזגן לא מקרר" and tpl["kind"] == "ticket" and tpl["priority_key"] == "high" and tpl["active"] is True
    meta = w.c.get(f"{API}/tickets/meta", headers=as_user("tom")).json()
    assert next(d for d in meta["departments"] if d["id"] == MAINT)["templates"][0]["title"] == "מזגן לא מקרר", "the create form gets it"
    r = w.c.patch(f"{API}/tickets/admin/templates/{tpl['id']}", json={"body": "חדר:\nקומה:\nתיאור:", "revision": tpl["revision"]})
    assert r.status_code == 200
    diff = _audit(w, "ticket.template.update")[-1]["diff"]
    assert "+body: קומה:" in diff and "-name" not in diff
    assert w.c.patch(f"{API}/tickets/admin/templates/{tpl['id']}", json={"name": "x", "revision": tpl["revision"]}).json()["code"] == "template_stale"
    assert w.c.patch(f"{API}/tickets/admin/templates/{tpl['id']}", json={"name": "x"}).status_code == 422, "revision required"
    tpl = r.json()["templates"][0]
    r = w.c.patch(f"{API}/tickets/admin/templates/{tpl['id']}", json={"active": False, "revision": tpl["revision"]})
    assert r.json()["templates"][0]["active"] is False
    assert next(d for d in w.c.get(f"{API}/tickets/meta", headers=as_user("tom")).json()["departments"] if d["id"] == MAINT)["templates"] == []
    other_cat = w.c.post(f"{API}/tickets/admin/departments/{w.cleaning}/categories", json={"name": "רצפה"}).json()["categories"][0]
    for body, field, code in (({"name": ""}, "name", "required"), ({"name": "x", "priority_key": "asap"}, "priority_key", "unknown"),
                              ({"name": "x", "category_id": other_cat["id"]}, "category_id", "unknown"), ({"name": "x", "kind": "message"}, "kind", "not_supported"),
                              ({"name": "x", "title": "t" * 121}, "title", "too_long")):
        r = w.c.post(f"{API}/tickets/admin/departments/{MAINT}/templates", json=body)
        assert r.status_code == 422 and r.json()["details"]["fields"][0] == {"field": field, "code": code}, (body, r.text)
    assert w.c.delete(f"{API}/tickets/admin/templates/{tpl['id']}").status_code == 200
    assert _dept(w)["templates"] == [] and _audit(w, "ticket.template.delete")[-1]["diff"].count("-") >= 3
    assert w.c.delete(f"{API}/tickets/admin/templates/{tpl['id']}").status_code == 404


def test_category_domains(w):
    cat = w.c.post(f"{API}/tickets/admin/departments/{MAINT}/categories", json={"name": "מיזוג", "domains": ["fan", "climate", "climate"]}).json()["categories"][0]
    assert cat["domains"] == ["climate", "fan"]
    r = w.c.patch(f"{API}/tickets/admin/categories/{cat['id']}", json={"domains": []})
    assert r.json()["categories"][0]["domains"] == []
    for bad in (["Climate"], ["a b"], ["x"] * 21):
        assert w.c.patch(f"{API}/tickets/admin/categories/{cat['id']}", json={"domains": bad}).status_code == 422, bad


# ---------------------------------------------------------------- the "מי רשאי" matrix

def test_the_roles_matrix(w):
    r = w.c.post(f"{API}/access/roles", json={"name": "רכז אחזקה", "description": "", "permissions": ["map.read", "tickets.view", "tickets.manage"],
                                              "sensitive": ["tickets.configure"]})
    assert r.status_code == 201, r.text
    roles = {x["id"]: x for x in w.c.get(f"{API}/tickets/admin/holders").json()["roles"]}
    assert roles["viewer"]["permissions"] == [] and roles["operator"]["permissions"] == ["tickets.view", "tickets.create"]
    assert roles["system_admin"]["permissions"] == ["tickets.view", "tickets.create", "tickets.manage", "tickets.external", "tickets.all_departments", "tickets.configure",
                                                    "tickets.costs.view", "tickets.costs"]  # + slice 9 (D31)
    custom = roles[r.json()["id"]]
    assert custom["builtin"] is False and custom["permissions"] == ["tickets.view", "tickets.manage", "tickets.configure"]
    assert not any(k.startswith("tickets_") for k in roles), "the grant roles are the personal card's"
    keys = list(roles)
    assert keys.index("viewer") < keys.index("operator") < keys.index("system_admin") < keys.index(r.json()["id"])


# ---------------------------------------------------------------- the permission matrix of the slice's routes

def test_permission_matrix_of_the_new_routes(w, settings):
    d = _dept(w)
    tpl = w.c.post(f"{API}/tickets/admin/departments/{MAINT}/templates", json={"name": "בסיס"}).json()["templates"][0]
    row = d["sla"][0]
    cases = [
        ("PUT", f"/tickets/admin/departments/{MAINT}/sla", {"rows": [{"priority_id": row["priority_id"], "revision": row["revision"], "ack_within_min": 25}]}),
        ("POST", f"/tickets/admin/departments/{MAINT}/templates", {"name": "חדשה"}),
        ("PATCH", f"/tickets/admin/templates/{tpl['id']}", {"name": "שונה", "revision": tpl["revision"]}),
        ("PATCH", f"/tickets/admin/departments/{MAINT}", {"auto_close_after_days": 4, "revision": d["revision"]}),
        ("DELETE", f"/tickets/admin/templates/{tpl['id']}", None),
    ]
    for user in ("vic", "tom", "mona", "alda", "nora"):
        for method, path, body in cases:
            r = w.c.request(method, API + path, json=body, headers=as_user(user))
            assert r.status_code == 403, (user, method, path, r.status_code)
    assert _dept(w)["sla"][0]["ack_within_min"] == row["ack_within_min"] and len(_dept(w)["templates"]) == 1
    bind(w.c, settings, "cora", "tickets_configure", "floor", w.floors["floor2"])
    assert w.c.request("PUT", API + cases[0][1], json=cases[0][2], headers=as_user("cora")).status_code == 403, "configure is installation-wide"
    bind(w.c, settings, "cara", "tickets_configure", "installation", "*")
    for method, path, body in cases:
        r = w.c.request(method, API + path, json=body, headers=as_user("cara"))
        assert r.status_code in (200, 201), (method, path, r.text)
    # the module switched off: every route answers the uniform 404
    assert w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    for method, path, body in cases:
        r = w.c.request(method, API + path, json=body)
        assert r.status_code == 404 and r.json()["code"] == "feature_disabled", (method, path)
