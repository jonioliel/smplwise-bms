"""NEEDSREVIEW (2.8.0): the "needs review" privacy report (services/needs_review.py) - both rules at their boundaries with a fixed
clock, the settings thresholds, the tickets.configure gate, "delete now" (Arx-side only: the directory erase, the door-system link kept,
no door-system call) and the yearly reminder's idempotence. FAKES ONLY: no door system, no Home Assistant."""
from __future__ import annotations

import datetime as dt
import itertools

import pytest
from tickets_s4_world import API, build_s4

from smplwise.db import get_setting, new_id
from smplwise.services import access_grants as ag
from smplwise.services import needs_review as nr

NOW = dt.datetime(2027, 1, 15, 10, 0, 0, tzinfo=dt.timezone.utc)
REVIEW = f"{API}/tickets/contacts-review"
_PHONES = itertools.count(7100)


def ago(days: int = 0, months: int = 0) -> str:
    at = nr.months_back(NOW, months) if months else NOW
    return ag.iso(at - dt.timedelta(days=days))


class EngineSpy:
    """Any door-system call fails the test: the report and its delete never reach the door system."""

    def __getattr__(self, name):
        raise AssertionError(f"door-system call {name} from the needs-review report")


class World:
    def __init__(self, settings, monkeypatch) -> None:
        self.s4 = build_s4(settings, monkeypatch)
        self.db = self.s4.db
        self.c = self.s4.c
        ag.set_clock(lambda: NOW)
        nr.reset_for_tests()
        monkeypatch.setattr(ag, "ENGINE_FACTORY", lambda db: EngineSpy())
        self.vendor = self.s4.vendor["id"]

    def person(self, name: str, *, created: str, last_assigned: str | None = None, vendor: bool = True, erased: bool = False, employee: int = 0) -> str:
        cid = new_id()
        with self.db.connection() as conn:
            conn.execute("""INSERT INTO ticket_contacts(id, kind, vendor_id, display_name, phone_e164, lang, active, created_by, created_at, updated_at,
                            last_assigned_at, erased_at, employee) VALUES (?, 'person', ?, ?, ?, 'he', 1, 'test', ?, ?, ?, ?, ?)""",
                         (cid, self.vendor if vendor else None, name, f"97250000{next(_PHONES):04d}", created, created, last_assigned,
                          created if erased else None, employee))
        return cid

    def pending(self, cid: str, created: str, *, accepted: str | None = None, rejected: str | None = None) -> None:
        with self.db.connection() as conn:
            conn.execute("INSERT INTO access_pending_contacts(contact_id, vendor_id, created_by, created_at, accepted_by, accepted_at, rejected_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                         (cid, self.vendor, f"contact:{self.vendor}", created, "admin" if accepted else None, accepted, rejected))
            if not accepted:
                conn.execute("UPDATE ticket_contacts SET active = 0 WHERE id = ?", (cid,))

    def grant(self, cid: str, state: str, created: str, ended: str | None = None) -> str:
        gid = new_id()
        with self.db.connection() as conn:
            conn.execute("""INSERT INTO access_grants(id, subject_kind, subject_id, source_kind, doors_json, valid_from, valid_until, credential, state,
                            requested_by, created_at, updated_at, ended_at) VALUES (?, 'contact', ?, 'manual', '{}', ?, ?, 'pin', ?, 'admin', ?, ?, ?)""",
                         (gid, cid, created, ag.iso(ag.parse_iso(created) + dt.timedelta(days=1)), state, created, ended or created, ended))
        return gid

    def link(self, cid: str, linked: str, origin: str = "created_from_arx") -> str:
        lid = new_id()
        with self.db.connection() as conn:
            conn.execute("""INSERT INTO access_person_links(id, subject_kind, subject_id, wiskey_person_id, origin, linked_by, linked_at)
                            VALUES (?, 'contact', ?, ?, ?, 'admin', ?)""", (lid, cid, "wk-" + lid[:8], origin, linked))
        return lid

    def report(self, user: str | None = None) -> dict:
        r = self.c.get(REVIEW, headers=self.s4.h(user) if user else None)
        assert r.status_code == 200, r.text
        return r.json()


@pytest.fixture()
def w(settings, monkeypatch):
    world = World(settings, monkeypatch)
    yield world
    ag.reset_for_tests()
    nr.reset_for_tests()


def ids(rows: list[dict]) -> set[str]:
    return {r["contact_id"] for r in rows}


def test_pending_rule_lists_only_technicians_waiting_longer_than_30_days(w):
    old = w.person("טכנאי ותיק", created=ago(31))
    w.pending(old, ago(31))
    fresh = w.person("טכנאי חדש", created=ago(29))
    w.pending(fresh, ago(29))
    boundary = w.person("טכנאי גבול", created=ago(30))
    w.pending(boundary, ago(30))
    rejected = w.person("נדחה", created=ago(90), erased=True)
    w.pending(rejected, ago(90), rejected=ago(60))
    accepted = w.person("התקבל", created=ago(90))
    w.pending(accepted, ago(90), accepted=ago(89))
    r = w.report()
    assert r["pending_days"] == 30 and r["idle_months"] == 12
    assert ids(r["pending"]) == {old, boundary}, "29 days is not yet due; exactly 30 is"
    row = next(x for x in r["pending"] if x["contact_id"] == old)
    assert row["days"] == 31 and row["action"] == "reject" and row["vendor"] == w.s4.vendor["display_name"]
    assert row["phone"] and not row["phone"].startswith("9725"), "the number is masked"


def test_idle_rule_uses_grant_dates_and_excludes_live_erased_and_unknown_people(w):
    idle_accepted = w.person("לא פעיל", created=ago(months=14))
    w.pending(idle_accepted, ago(months=14), accepted=ago(months=13))
    recent_grant = w.person("גישה לפני 11 חודשים", created=ago(months=24))
    w.grant(recent_grant, "ended", ago(months=11, days=2), ended=ago(months=11))
    old_grant = w.person("גישה לפני 13 חודשים", created=ago(months=24))
    w.grant(old_grant, "ended", ago(months=13, days=2), ended=ago(months=13))
    live = w.person("גישה פעילה", created=ago(months=24))
    w.grant(live, "approved", ago(months=24))
    linked = w.person("מקושר", created=ago(months=20))
    w.link(linked, ago(months=20))
    assigned = w.person("שובץ לאחרונה", created=ago(months=20), last_assigned=ago(months=2))
    w.link(assigned, ago(months=20))
    unknown = w.person("לא מוכר לגישה", created=ago(months=30))
    erased = w.person("נמחק", created=ago(months=30), erased=True)
    w.link(erased, ago(months=30))
    employee = w.person("עובד", created=ago(months=30), vendor=False, employee=1)
    w.link(employee, ago(months=30))
    boundary = w.person("גבול 12", created=ago(months=12))
    w.link(boundary, ago(months=12))
    r = w.report()
    assert ids(r["idle"]) == {idle_accepted, old_grant, linked}, r["idle"]
    by = {x["contact_id"]: x for x in r["idle"]}
    assert by[old_grant]["months"] == 13 and by[old_grant]["action"] == "erase" and by[old_grant]["door_system_linked"] is False
    assert by[linked]["door_system_linked"] is True and by[linked]["door_system_created"] is True
    assert unknown not in by and live not in by and boundary not in by


def test_thresholds_are_settings_with_ranges(w):
    a = w.person("ממתין 40", created=ago(40))
    w.pending(a, ago(40))
    assert ids(w.report()["pending"]) == {a}
    doc = w.c.get(f"{API}/tickets/settings").json()
    assert doc["directory"]["review_pending_days"] == 30 and doc["directory"]["review_idle_months"] == 12, "the defaults"
    bad = w.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "directory": {"review_pending_days": 3}})
    assert bad.status_code == 422, bad.text
    ok = w.c.put(f"{API}/tickets/settings", json={"revision": doc["revision"], "directory": {"review_pending_days": 60, "review_idle_months": 24}})
    assert ok.status_code == 200, ok.text
    r = w.report()
    assert r["pending_days"] == 60 and r["idle_months"] == 24 and r["pending"] == []


def test_report_and_delete_need_tickets_configure(w):
    a = w.person("לא פעיל", created=ago(months=14))
    w.link(a, ago(months=14))
    assert w.c.get(REVIEW, headers=w.s4.h("mona")).status_code == 403
    r = w.c.post(f"{REVIEW}/{a}/delete", json={"confirm": True}, headers=w.s4.h("mona"))
    assert r.status_code == 403, r.text
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT erased_at FROM ticket_contacts WHERE id = ?", (a,)).fetchone()[0] is None


def test_delete_now_erases_in_arx_only_and_keeps_the_door_system_link(w):
    a = w.person("אבי לא פעיל", created=ago(months=14))
    lid = w.link(a, ago(months=14))
    assert w.c.post(f"{REVIEW}/{a}/delete", json={}).status_code == 422, "the confirmation is required"
    r = w.c.post(f"{REVIEW}/{a}/delete", json={"confirm": True})
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] is True and r.json()["door_system_linked"] is True
    with w.db.connection(mode="read") as conn:
        c = conn.execute("SELECT display_name, phone_e164, erased_at FROM ticket_contacts WHERE id = ?", (a,)).fetchone()
        assert c["erased_at"] and c["phone_e164"] is None and "אבי" not in c["display_name"]
        assert conn.execute("SELECT 1 FROM access_person_links WHERE id = ?", (lid,)).fetchone(), "the link stays for the manual door-system removal"
        details = conn.execute("SELECT details_json FROM audit_log WHERE action = 'access.needs_review.delete'").fetchall()
        assert len(details) == 1 and "אבי" not in details[0][0]
    assert a not in ids(w.report()["idle"])
    assert w.c.post(f"{REVIEW}/{a}/delete", json={"confirm": True}).status_code == 404, "already erased"


def test_delete_now_is_refused_for_a_person_not_in_the_report(w):
    recent = w.person("פעיל", created=ago(months=2))
    w.link(recent, ago(months=2))
    assert w.c.post(f"{REVIEW}/{recent}/delete", json={"confirm": True}).status_code == 409
    live = w.person("גישה פעילה", created=ago(months=24))
    w.grant(live, "active", ago(months=24))
    r = w.c.post(f"{REVIEW}/{live}/delete", json={"confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "needs_review_live_grant", r.text
    pend = w.person("ממתין", created=ago(60))
    w.pending(pend, ago(60))
    assert w.c.post(f"{REVIEW}/{pend}/delete", json={"confirm": True}).status_code == 409, "a pending technician uses reject, not this route"


def test_a_pending_row_is_rejected_through_the_existing_reject_route(w):
    a = w.person("ממתין ותיק", created=ago(45))
    w.pending(a, ago(45))
    assert ids(w.report()["pending"]) == {a}
    r = w.c.post(f"{API}/access-grants/pending-contacts/{a}/reject")
    assert r.status_code == 200, r.text
    rep = w.report()
    assert rep["pending"] == [] and a not in ids(rep["idle"])


def _reminders(w) -> list:
    with w.db.connection(mode="read") as conn:
        return conn.execute("SELECT id, dedupe_key, body FROM notifications WHERE source = 'privacy.needs_review'").fetchall()


def test_the_yearly_reminder_is_january_only_once_and_only_when_not_empty(w):
    with w.db.connection() as conn:
        assert nr.remind_if_due(conn, NOW) is None, "an empty report reminds nobody"
        assert get_setting(conn, nr.REMINDED_KEY) is None
    a = w.person("לא פעיל", created=ago(months=14))
    w.link(a, ago(months=14))
    with w.db.connection() as conn:
        assert nr.remind_if_due(conn, NOW.replace(month=2, day=10)) is None, "not in February"
        nid = nr.remind_if_due(conn, NOW)
        assert nid is not None
        assert nr.remind_if_due(conn, NOW + dt.timedelta(days=3)) is None, "once a year"
        assert get_setting(conn, nr.REMINDED_KEY) == "2027"
    rows = _reminders(w)
    assert len(rows) == 1 and rows[0]["dedupe_key"] == "needsreview:2027"
    assert "1" in rows[0]["body"] and "לא פעיל" not in rows[0]["body"], "a count, never a name"
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notification_recipients WHERE notification_id = ?", (nid,)).fetchone()[0] >= 1


def test_months_back_clamps_the_day():
    at = dt.datetime(2027, 3, 31, 12, tzinfo=dt.timezone.utc)
    assert nr.months_back(at, 1).date() == dt.date(2027, 2, 28)
    assert nr.months_back(at, 12).date() == dt.date(2026, 3, 31)
    assert nr.full_months(dt.datetime(2026, 1, 15, tzinfo=dt.timezone.utc), NOW) == 12
