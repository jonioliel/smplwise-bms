"""CR-038 phase 2 (TKRULES-291, docs/changes/CR-038-TKRULES-NOTES.md): tickets opened automatically from alerts.

- the document: default empty (nothing happens), only system.configure reads / edits / dry-runs it, validation (sources, placeholders,
  the daily limit default / override / hard bound, max rules), revision check, audit;
- the engine: one ticket per alert key (dedupe, absorbed repeats), hold time, the daily limit (default, override, suppression audited
  once), the global kill switch, the clear note and the optional close, a refused creation, idempotent ticks;
- the author is the system and the visibility rule is unchanged (department members see the ticket, nobody gains "creator");
- the dry run writes nothing."""
from __future__ import annotations

import datetime as dt

import pytest

from smplwise.db import Database
from smplwise.services import notify
from smplwise.services.tickets import rule_engine, rules_doc
from tickets_world import API, MAINT, build

from conftest import bind

LEAK = "sensor.leak"


@pytest.fixture()
def w(settings):
    return build(settings)


def db(w) -> Database:
    return Database(w.settings.db_path)


def emit(w, entity: str = "binary_sensor.leak_1", *, resolve: bool = False, name: str = "חיישן מים מטבח") -> notify.EmitResult:
    with db(w).connection() as conn:
        return notify.emit_full(conn, notify.Signal(LEAK, "entity", entity, params={"name": name, "place": "קומה 1"}, resolve=resolve))


def tick(w, minutes: float = 0) -> dict[str, int]:
    rule_engine.utcnow = lambda: dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=minutes)  # type: ignore[assignment]
    try:
        return rule_engine.tick(db(w), force=True)
    finally:
        rule_engine.utcnow = _real_now  # type: ignore[assignment]


_real_now = rule_engine.utcnow


def rule(**over) -> dict:
    r = {"name": "דליפה לאחזקה", "enabled": True, "source": LEAK, "subject_id": "", "hold_min": 0, "department_id": MAINT,
         "priority_id": None, "category_id": None, "title": "{alert} - {place}", "description": "{details}", "on_clear": "comment",
         "daily_limit": None}
    r.update(over)
    return r


def get_doc(w, user: str = "joni"):
    return w.c.get(f"{API}/tickets/rules", headers=w.h(user))


def put(w, rules: list[dict], *, enabled: bool = True, default: int | None = 20, user: str = "joni", revision: int | None = None):
    rev = get_doc(w).json()["revision"] if revision is None else revision
    return w.c.put(f"{API}/tickets/rules", json={"revision": rev, "enabled": enabled, "daily_limit_default": default, "rules": rules}, headers=w.h(user))


def save(w, rules: list[dict], **kw) -> dict:
    r = put(w, rules, **kw)
    assert r.status_code == 200, r.text
    return r.json()


def rule_tickets(w) -> list[dict]:
    with db(w).connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM tickets WHERE origin = 'rule' ORDER BY created_at, number").fetchall()]


def events(w, tid: str, kind: str = "note") -> list[dict]:
    with db(w).connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM ticket_events WHERE ticket_id = ? AND kind = ? ORDER BY id", (tid, kind)).fetchall()]


def audits(w, action: str) -> list[dict]:
    with db(w).connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


def fields(r) -> set[tuple[str, str]]:
    return {(f["field"], f["code"]) for f in r.json()["details"]["fields"]}


# ---------------------------------------------------------------- the document

def test_default_is_empty_and_nothing_happens(w):
    d = get_doc(w).json()
    assert d["rules"] == [] and d["enabled"] is True and d["daily_limit_default"] == 20 and d["revision"] == 0
    assert d["bounds"]["hard_daily_max"] == 200 and d["bounds"]["max_rules"] == 50
    emit(w)
    assert tick(w) == {"created": 0, "absorbed": 0, "suppressed": 0, "refused": 0, "cleared": 0, "closed": 0}
    assert rule_tickets(w) == []


def test_only_system_configure_reads_edits_and_tests_rules(w):
    bind(w.c, w.settings, "vic", "tickets_configure", "installation", "*")  # tickets.configure alone is not enough
    for user in ("mona", "tom", "vic", "alda"):
        assert get_doc(w, user).status_code == 403, user
        assert put(w, [rule()], user=user, revision=0).status_code == 403, user
        assert w.c.post(f"{API}/tickets/rules/test", json={"rule": rule()}, headers=w.h(user)).status_code == 403, user
    assert get_doc(w).json()["rules"] == []
    d = save(w, [rule()])
    assert len(d["rules"]) == 1 and d["revision"] == 1
    a = audits(w, "tickets.rules.update")
    assert len(a) == 1 and d["rules"][0]["id"] in a[0]["details_json"] and "דליפה" not in a[0]["details_json"], "ids only, never free text"


def test_sources_exclude_the_modules_own_and_events_that_close_on_acknowledge(w):
    allowed = rules_doc.allowed_sources()
    assert LEAK in allowed and "camera.offline" in allowed and "device.unavailable" in allowed
    assert not any(k.startswith(("ticket.", "rfq.")) for k in allowed), "a ticket would open a ticket: no loop"
    for k in ("rule.alert", "security.new_signin", "automation.failed", "bulk.partial"):
        assert k not in allowed, k
    r = put(w, [rule(source="ticket.stuck")])
    assert r.status_code == 422 and ("rules[0].source", "unknown") in fields(r)


def test_validation_names_each_field(w):
    r = put(w, [rule(title="{alert} {secret}", description="{0}", hold_min=2000, on_clear="delete", department_id="nope", name="")])
    assert r.status_code == 422
    got = fields(r)
    for f in (("rules[0].title", "placeholder"), ("rules[0].description", "placeholder"), ("rules[0].hold_min", "range"),
              ("rules[0].on_clear", "choice"), ("rules[0].department_id", "unknown"), ("rules[0].name", "required")):
        assert f in got, f
    assert put(w, [rule()] * 51).status_code == 422
    assert put(w, [rule()], revision=7).status_code == 409


@pytest.mark.parametrize("value,code", [(0, "range"), (201, "range"), (-3, "range"), ("5", "integer"), (2.5, "integer"), (True, "integer")])
def test_daily_limit_bounds_for_the_override_and_the_default(w, value, code):
    r = put(w, [rule(daily_limit=value)])
    assert r.status_code == 422 and ("rules[0].daily_limit", code) in fields(r)
    r = put(w, [rule()], default=value)  # type: ignore[arg-type]
    assert r.status_code == 422 and ("daily_limit_default", code) in fields(r)


def test_daily_limit_default_override_and_the_effective_limit_in_the_list(w):
    d = save(w, [rule(), rule(name="עם עקיפה", daily_limit=200)], default=7)
    assert d["daily_limit_default"] == 7
    assert [r["effective_limit"] for r in d["rules"]] == [7, 200]
    assert [r["daily_limit"] for r in d["rules"]] == [None, 200]
    assert all(r["today_created"] == 0 and r["limit_reached"] is False for r in d["rules"])


def test_a_client_cannot_pick_a_rule_id(w):
    d = save(w, [rule(id="forged-id")])
    assert d["rules"][0]["id"] != "forged-id"
    rid = d["rules"][0]["id"]
    d2 = save(w, [{**d["rules"][0], "name": "שם חדש"}])
    assert d2["rules"][0]["id"] == rid and d2["rules"][0]["name"] == "שם חדש", "an existing id is kept (the dedupe key stays stable)"


# ---------------------------------------------------------------- the engine

def test_one_ticket_per_alert_by_the_system_author(w):
    save(w, [rule()])
    emit(w)
    assert tick(w)["created"] == 1
    assert tick(w)["created"] == 0, "idempotent: the same alert is acted on once"
    [t] = rule_tickets(w)
    assert t["created_by"] == "system" and t["origin"] == "rule" and t["status"] == "new" and t["rule_ref"].startswith("rule:")
    assert t["title"] == "דליפת מים - קומה 1" and "חיישן מים מטבח" in t["description"]
    assert t["floor_id"] is None and t["entity_id"] is None, "placeless: no device history, no place widening"
    [created] = events(w, t["id"], "created")
    assert created["actor_kind"] == "system" and created["via"] == "system"
    [note] = events(w, t["id"])
    assert note["actor_kind"] == "system" and "דליפה לאחזקה" in note["body"] and "קומה 1" in note["body"] and not note["visible_external"]
    a = [x for x in audits(w, "ticket.create") if x["resource_id"] == t["id"]]
    assert len(a) == 1 and a[0]["actor_user_id"] is None and '"origin":"rule"' in a[0]["details_json"].replace(" ", "")


def test_a_repeat_of_the_same_alert_is_absorbed_while_the_ticket_is_open(w):
    save(w, [rule()])
    emit(w)
    tick(w)
    emit(w, resolve=True)
    emit(w)  # the same condition again: a new notification row with the same dedupe key
    done = tick(w)
    assert done["absorbed"] == 1 and done["created"] == 0
    [t] = rule_tickets(w)
    notes = events(w, t["id"])
    assert any("ההתראה חזרה" in (n["body"] or "") for n in notes)
    emit(w, entity="binary_sensor.leak_2")
    assert tick(w)["created"] == 1, "another subject is another key"
    assert len(rule_tickets(w)) == 2


def test_hold_time(w):
    save(w, [rule(hold_min=10)])
    emit(w)
    assert tick(w)["created"] == 0
    assert tick(w, minutes=5)["created"] == 0
    assert tick(w, minutes=11)["created"] == 1


def test_clear_adds_one_system_note_and_keeps_the_ticket_open(w):
    save(w, [rule()])
    emit(w)
    tick(w)
    emit(w, resolve=True)
    assert tick(w)["cleared"] == 1
    assert tick(w)["cleared"] == 0, "once"
    [t] = rule_tickets(w)
    ended = [n for n in events(w, t["id"]) if "ההתראה הסתיימה" in (n["body"] or "")]
    assert len(ended) == 1 and ended[0]["actor_kind"] == "system"
    assert t["status"] == "new"


def test_clear_closes_only_a_ticket_nobody_took(w):
    save(w, [rule(on_clear="comment_close")])
    emit(w, entity="binary_sensor.a")
    emit(w, entity="binary_sensor.b")
    tick(w)
    a, b = rule_tickets(w)
    assert w.assign("mona", b["id"], "tom").status_code == 200
    emit(w, entity="binary_sensor.a", resolve=True)
    emit(w, entity="binary_sensor.b", resolve=True)
    done = tick(w)
    assert done["cleared"] == 2 and done["closed"] == 1
    by_id = {t["id"]: t for t in rule_tickets(w)}
    assert by_id[a["id"]]["status"] == "closed" and by_id[a["id"]]["closed_by"] is None
    assert by_id[b["id"]]["status"] == "assigned", "a ticket in handling is never closed by the system"
    assert any("כבר התחיל" in (n["body"] or "") for n in events(w, b["id"]))
    assert len(events(w, a["id"], "closed")) == 1


def test_daily_limit_default_suppresses_and_audits_once(w):
    save(w, [rule()], default=2)
    for i in range(3):
        emit(w, entity=f"binary_sensor.leak_{i}")
    done = tick(w)
    assert done["created"] == 2 and done["suppressed"] == 1
    assert tick(w)["suppressed"] == 0, "the suppression is recorded once per alert"
    sup = audits(w, "tickets.rule.suppressed")
    assert len(sup) == 1 and sup[0]["decision"] == "denied" and sup[0]["reason"] == "daily_limit"
    d = get_doc(w).json()
    assert d["rules"][0]["today_created"] == 2 and d["rules"][0]["limit_reached"] is True and d["rules"][0]["suppressed_today"] == 1


def test_daily_limit_override_wins_over_the_default(w):
    save(w, [rule(daily_limit=1)], default=20)
    for i in range(3):
        emit(w, entity=f"binary_sensor.leak_{i}")
    done = tick(w)
    assert done["created"] == 1 and done["suppressed"] == 2
    assert get_doc(w).json()["rules"][0]["effective_limit"] == 1


def test_a_repeat_absorbed_after_the_limit_is_still_absorbed(w):
    save(w, [rule(daily_limit=1)])
    emit(w)
    tick(w)
    emit(w, resolve=True)
    emit(w)
    done = tick(w)
    assert done["absorbed"] == 1 and done["suppressed"] == 0, "an open ticket takes the repeat; the limit counts new tickets only"


def test_kill_switch_stops_everything(w):
    save(w, [rule()], enabled=False)
    emit(w)
    assert tick(w)["created"] == 0
    save(w, get_doc(w).json()["rules"], enabled=True)
    assert tick(w)["created"] == 1
    save(w, get_doc(w).json()["rules"], enabled=False)
    emit(w, resolve=True)
    assert tick(w)["cleared"] == 0, "the switch also holds the clear notes"


def test_a_disabled_rule_does_nothing(w):
    save(w, [rule(enabled=False)])
    emit(w)
    assert tick(w)["created"] == 0


def test_module_off_idles(w):
    save(w, [rule()])
    emit(w)
    assert w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    assert tick(w)["created"] == 0


def test_a_rule_whose_department_went_inactive_is_served_invalid_and_never_acts(w):
    save(w, [rule()])
    with db(w).connection() as conn:
        conn.execute("UPDATE ticket_departments SET active = 0 WHERE id = ?", (MAINT,))
    emit(w)
    assert tick(w) == {"created": 0, "absorbed": 0, "suppressed": 0, "refused": 0, "cleared": 0, "closed": 0}
    r = get_doc(w).json()["rules"][0]
    assert r["invalid"] is True and "unknown" in r["problems"]
    assert rule_tickets(w) == []


def test_a_refused_creation_is_audited_and_not_retried(w):
    save(w, [rule(title="{place}")])
    with db(w).connection() as conn:  # an alert without a place: the rendered title is empty -> the creation path refuses it
        notify.emit_full(conn, notify.Signal(LEAK, "entity", "binary_sensor.no_place", params={"name": "x"}))
    assert tick(w)["refused"] == 1
    assert tick(w)["refused"] == 0
    a = audits(w, "tickets.rule.refused")
    assert len(a) == 1 and a[0]["reason"] == "validation" and rule_tickets(w) == []


def test_visibility_is_unchanged(w):
    save(w, [rule()])
    emit(w)
    tick(w)
    [t] = rule_tickets(w)
    for user in ("mona", "tom", "alda", "joni"):
        assert w.get(user, t["id"]).status_code == 200, user
    for user in ("nora", "cleo", "fred", "vic", "dina"):
        assert w.get(user, t["id"]).status_code == 404, user


HEALTH = "system.health"


def health(w, sid: str = "disk", *, resolve: bool = False) -> None:
    with db(w).connection() as conn:
        notify.emit_full(conn, notify.Signal(HEALTH, "system", sid, params={"name": "דיסק מלא", "place": "שרת"}, resolve=resolve))


def dry(w, r: dict, user: str = "joni"):
    return w.c.post(f"{API}/tickets/rules/test", json={"rule": r}, headers=w.h(user))


def test_dry_run_writes_nothing(w):
    hr = rule(source=HEALTH, title="{alert}: {details}")
    save(w, [hr])
    r = dry(w, hr)
    assert r.status_code == 200 and r.json()["would"] == "nothing" and r.json()["sample_values"] is True
    health(w)
    r = dry(w, {**hr, "hold_min": 30})
    assert r.json()["would"] == "wait_hold" and r.json()["matches"] == 1 and r.json()["held"] == 0
    body = dry(w, hr).json()
    assert body["would"] == "create" and body["preview"]["title"] == "תקלת מערכת: דיסק מלא." and body["preview"]["department"]
    assert body["alerts"][0]["held"] is True and body["sample_values"] is False
    assert rule_tickets(w) == [], "a dry run never opens a ticket"
    assert dry(w, rule(source="ticket.stuck")).status_code == 422
    save(w, get_doc(w).json()["rules"], enabled=False)
    assert dry(w, hr).json()["would"] == "rules_off"


def test_dry_run_lists_only_alerts_the_caller_may_see(w):
    emit(w)  # an entity outside the authorised catalogue: no person may see its notification
    r = dry(w, rule())
    assert r.status_code == 200 and r.json()["matches"] == 0 and r.json()["alerts"] == []


def test_dry_run_reports_handled_and_suppressed_for_a_saved_rule(w):
    d = save(w, [rule(source=HEALTH, daily_limit=1)])
    health(w)
    assert tick(w)["created"] == 1
    saved = d["rules"][0]
    assert dry(w, saved).json()["would"] == "already_handled"
    health(w, "cpu")
    assert dry(w, saved).json()["would"] == "suppressed"
    assert get_doc(w).json()["rules"][0]["limit_reached"] is True
