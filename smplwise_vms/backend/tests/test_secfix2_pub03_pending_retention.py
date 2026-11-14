"""SECFIX2-295 / PUB-03 (docs/security/PROPOSAL_PUB03_PENDING_TECHNICIAN_RETENTION.md, option A): a technician a vendor typed on the
arrival page (clear name + phone, `access_pending_contacts` + an inactive `ticket_contacts` row) that no manager accepted or rejected
is erased after `access.external.pending_retention_days`, and a vendor may hold at most `access.external.pending_max_per_vendor`
undecided technicians at once.

Owner decision 2026-10-21: the defaults are 90 days and 10 per vendor (a saved 0 switches either off; a value never saved reads the
default, so an existing installation gets them at upgrade). The erase is the manager's own "reject and delete" (access_grants.reject_pending_contact) done by the janitor: the
directory erase (tombstone, phone and keyed index cleared, links revoked), `rejected_at` written, the open request for him ended - never
a row that was accepted, rejected, linked to a door-system person or that holds a decided grant. One audit row per run with counts only.
The needs-review report still lists a pending technician after 30 days (directory.review_pending_days), well before any erase.
FAKES ONLY: no door system, no WhatsApp."""
from __future__ import annotations

import pytest
from test_access_arrival import Arrival
from test_needs_review import World, ago

from smplwise.db import set_setting
from smplwise.services import access_grants as ag
from smplwise.services import needs_review as nr
from smplwise.services import pending_retention as pr


@pytest.fixture()
def w(settings, monkeypatch):
    world = World(settings, monkeypatch)
    pr.reset_for_tests()
    yield world
    ag.reset_for_tests()
    nr.reset_for_tests()
    pr.reset_for_tests()


def _set(db, **values) -> None:
    with db.connection() as conn:
        for k, v in values.items():
            set_setting(conn, k, str(v))


def _contact(db, cid: str) -> dict:
    with db.connection(mode="read") as conn:
        return dict(conn.execute("SELECT * FROM ticket_contacts WHERE id = ?", (cid,)).fetchone())


def _pending(db, cid: str) -> dict:
    with db.connection(mode="read") as conn:
        return dict(conn.execute("SELECT * FROM access_pending_contacts WHERE contact_id = ?", (cid,)).fetchone())


def _audits(db, action: str) -> list[dict]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def _old(w, days: int = 120, name: str = "Tech Old") -> str:
    cid = w.person(name, created=ago(days))
    w.pending(cid, ago(days))
    return cid


# ---------------------------------------------------------------- default: nothing changes


def test_the_settings_default_to_the_owners_choice_90_days_and_10_per_vendor():
    assert ag.DEFAULTS[ag.PENDING_RETENTION_KEY] == "90" and ag.DEFAULTS[ag.PENDING_CAP_KEY] == "10"
    from smplwise.services import backup

    assert backup._kept_setting(ag.PENDING_RETENTION_KEY) and backup._kept_setting(ag.PENDING_CAP_KEY), \
        "never exported in a project backup, never taken from one (HARDEN271 item 1)"


def test_never_saved_reads_the_defaults_a_saved_value_wins(w):
    """Upgrade rule: an installation that never saved the settings gets 90 / 10; a saved value (0 = off included) is kept."""
    with w.db.connection(mode="read") as conn:
        assert ag.pending_retention_days(conn) == 90 and ag.pending_cap(conn) == 10
    _set(w.db, **{ag.PENDING_RETENTION_KEY: 0, ag.PENDING_CAP_KEY: 0})
    with w.db.connection(mode="read") as conn:
        assert ag.pending_retention_days(conn) == 0 and ag.pending_cap(conn) == 0


def test_by_default_an_undecided_row_older_than_90_days_is_erased(w):
    old = _old(w, 91)
    young = _old(w, 89, "Tech Young")
    assert pr.run(w.db, now=nr_now()) == {"erased": 1, "skipped": 0}
    assert _contact(w.db, old)["erased_at"] and _contact(w.db, young)["erased_at"] is None


def test_switched_off_an_old_pending_row_is_never_erased(w):
    _set(w.db, **{ag.PENDING_RETENTION_KEY: 0})
    cid = _old(w, 400)
    assert pr.run(w.db, now=nr_now()) == {"erased": 0, "skipped": 0}
    assert _contact(w.db, cid)["erased_at"] is None and _contact(w.db, cid)["phone_e164"]
    assert _pending(w.db, cid)["rejected_at"] is None


# ---------------------------------------------------------------- on: the erase


def nr_now():
    from test_needs_review import NOW

    return NOW


def test_on_an_undecided_row_older_than_the_period_is_erased_like_a_rejection(w):
    _set(w.db, **{ag.PENDING_RETENTION_KEY: 90})
    old = _old(w, 91)
    young = _old(w, 89, "Tech Young")
    out = pr.run(w.db, now=nr_now())
    assert out == {"erased": 1, "skipped": 0}
    c = _contact(w.db, old)
    assert c["erased_at"] and c["phone_e164"] is None and c["phone_key"] is None and c["display_name"] != "Tech Old"
    assert _pending(w.db, old)["rejected_at"], "the pending row is closed (it leaves the needs-review report)"
    assert _contact(w.db, young)["erased_at"] is None and _pending(w.db, young)["rejected_at"] is None


def test_on_decided_linked_or_granted_rows_are_never_touched(w):
    _set(w.db, **{ag.PENDING_RETENTION_KEY: 30})
    accepted = w.person("Accepted", created=ago(200))
    w.pending(accepted, ago(200), accepted=ago(199))
    linked = _old(w, 200, "Linked")
    w.link(linked, ago(150))
    granted = _old(w, 200, "Granted")
    w.grant(granted, "active", ago(10))
    out = pr.run(w.db, now=nr_now())
    assert out == {"erased": 0, "skipped": 2}, out
    for cid in (accepted, linked, granted):
        assert _contact(w.db, cid)["erased_at"] is None, cid


def test_on_the_open_request_for_the_erased_technician_ends(w):
    _set(w.db, **{ag.PENDING_RETENTION_KEY: 30})
    cid = _old(w, 60)
    gid = w.grant(cid, "requested", ago(60))
    assert pr.run(w.db, now=nr_now())["erased"] == 1
    with w.db.connection(mode="read") as conn:
        g = dict(conn.execute("SELECT state, end_reason FROM access_grants WHERE id = ?", (gid,)).fetchone())
    assert g["state"] in ag.FINAL and g["end_reason"] == "refused", g


def test_on_one_audit_row_per_run_with_counts_only(w):
    _set(w.db, **{ag.PENDING_RETENTION_KEY: 30})
    names = ("Secret Name One", "Secret Name Two")
    for n in names:
        _old(w, 45, n)
    pr.run(w.db, now=nr_now())
    rows = _audits(w.db, "access.pending_contact.expired")
    assert len(rows) == 1, rows
    blob = repr(rows[0])
    assert '"erased": 2' in rows[0]["details_json"] or "'erased': 2" in blob
    assert not any(n in blob for n in names), "never a name"
    assert "97250000" not in blob, "never a number"
    pr.run(w.db, now=nr_now())
    assert len(_audits(w.db, "access.pending_contact.expired")) == 1, "a run that erases nothing writes no row"


def test_on_the_period_is_clamped_to_a_floor_of_7_days(w):
    _set(w.db, **{ag.PENDING_RETENTION_KEY: 1})
    with w.db.connection(mode="read") as conn:
        assert ag.pending_retention_days(conn) == 7
    _old(w, 5)
    assert pr.run(w.db, now=nr_now())["erased"] == 0


def test_the_janitor_hook_is_throttled_and_never_raises(w, monkeypatch):
    _set(w.db, **{ag.PENDING_RETENTION_KEY: 30})
    calls = []
    monkeypatch.setattr(pr, "run", lambda db, now=None: calls.append(1) or (_ for _ in ()).throw(RuntimeError("boom")))
    pr.janitor(w.db)
    pr.janitor(w.db)
    assert calls == [1], "at most once per interval, and an exception never escapes"


# ---------------------------------------------------------------- the cap per vendor on the arrival page


@pytest.fixture()
def arr(settings, monkeypatch):
    a = Arrival(settings, monkeypatch)
    yield a
    ag.reset_for_tests()


def _fill(a: Arrival, n: int) -> None:
    from smplwise.db import new_id

    vendor = a.s4.vendor["id"]
    now = ag.iso(ag.now())
    with a.db.connection() as conn:
        for i in range(n):
            cid = new_id()
            conn.execute("""INSERT INTO ticket_contacts(id, kind, vendor_id, display_name, phone_e164, lang, active, created_by, created_at, updated_at)
                            VALUES (?, 'person', ?, ?, ?, 'he', 0, 'test', ?, ?)""", (cid, vendor, f"P{i}", f"97250000{8000 + i:04d}", now, now))
            conn.execute("INSERT INTO access_pending_contacts(contact_id, vendor_id, created_by, created_at) VALUES (?, ?, 'test', ?)", (cid, vendor, now))


def _new_tech(a: Arrival):
    return a.post(person_id=None, new_person={"name": "Avi New", "phone": "050-000-0057"})


def test_cap_by_default_10_the_eleventh_is_refused(arr):
    _fill(arr, 10)
    r = _new_tech(arr)
    assert r.status_code == 429 and r.json()["code"] == "rate_limited", r.text


def test_cap_switched_off_a_vendor_with_many_pending_can_still_add_one(arr):
    with arr.db.connection() as conn:
        set_setting(conn, ag.PENDING_CAP_KEY, "0")
    _fill(arr, 12)
    r = _new_tech(arr)
    assert r.status_code == 200, r.text


def test_cap_on_the_next_typed_technician_is_refused_and_nothing_is_written(arr):
    with arr.db.connection() as conn:
        set_setting(conn, ag.PENDING_CAP_KEY, "3")
    _fill(arr, 3)
    r = _new_tech(arr)
    assert r.status_code == 429 and r.json()["code"] == "rate_limited", r.text
    with arr.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM access_pending_contacts").fetchone()[0] == 3
        assert conn.execute("SELECT COUNT(*) FROM ticket_contacts WHERE phone_e164 = '972500000057'").fetchone()[0] == 0
    assert arr.grants() == []


def test_cap_on_decided_rows_do_not_count(arr):
    with arr.db.connection() as conn:
        set_setting(conn, ag.PENDING_CAP_KEY, "3")
    _fill(arr, 3)
    with arr.db.connection() as conn:
        conn.execute("UPDATE access_pending_contacts SET rejected_at = ? WHERE rowid IN (SELECT rowid FROM access_pending_contacts LIMIT 1)", (ag.iso(ag.now()),))
    assert _new_tech(arr).status_code == 200


def test_cap_on_naming_an_existing_person_is_never_capped(arr):
    with arr.db.connection() as conn:
        set_setting(conn, ag.PENDING_CAP_KEY, "1")
    _fill(arr, 5)
    assert arr.post().status_code == 200, "the vendor's own existing person is not a new pending row"


def test_the_settings_route_reads_and_writes_both_values(arr):
    c = arr.s4.c
    view = c.get(f"/api/v1/access-grants/settings").json()
    assert view["pending_retention_days"] == 90 and view["pending_max_per_vendor"] == 10
    r = c.put("/api/v1/access-grants/settings", json={"pending_retention_days": 30, "pending_max_per_vendor": 5})
    assert r.status_code == 200, r.text
    assert r.json()["pending_retention_days"] == 30 and r.json()["pending_max_per_vendor"] == 5
    for bad in ({"pending_retention_days": 3}, {"pending_retention_days": 400}, {"pending_max_per_vendor": 101}, {"pending_max_per_vendor": -1}):
        assert c.put("/api/v1/access-grants/settings", json=bad).status_code == 422, bad
    assert c.put("/api/v1/access-grants/settings", json={"pending_retention_days": 0}).json()["pending_retention_days"] == 0, "0 switches it off"


# ---------------------------------------------------------------- SECFIX2-295 (owner 2026-10-21): the list of undecided technicians


PENDING = "/api/v1/access-grants/pending-contacts"


def _typed(a: Arrival) -> str:
    r = _new_tech(a)
    assert r.status_code == 200, r.text
    with a.db.connection(mode="read") as conn:
        return conn.execute("SELECT contact_id FROM access_pending_contacts").fetchone()[0]


def test_the_list_shows_an_undecided_technician_without_his_number(arr):
    cid = _typed(arr)
    r = arr.s4.c.get(PENDING)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["retention_days"] == 90 and body["max_per_vendor"] == 10
    [row] = body["pending"]
    assert row["contact_id"] == cid and row["name"] == "Avi New" and row["vendor"] == arr.s4.vendor["display_name"]
    assert row["days"] == 0 and row["days_left"] == 90 and isinstance(row["ticket_number"], int)
    assert "0500000057" not in r.text and "972500000057" not in r.text, "never a phone number"


def test_the_list_drops_decided_rows_and_follows_the_retention_setting(arr):
    cid = _typed(arr)
    with arr.db.connection() as conn:
        set_setting(conn, ag.PENDING_RETENTION_KEY, "0")
    assert arr.s4.c.get(PENDING).json()["pending"][0]["days_left"] is None, "retention off: no countdown"
    assert arr.s4.c.post(f"{PENDING}/{cid}/accept").status_code == 200
    assert arr.s4.c.get(PENDING).json()["pending"] == []


def test_the_list_is_refused_to_a_user_who_may_not_decide(arr):
    _typed(arr)
    r = arr.s4.c.get(PENDING, headers=arr.s4.h("zed"))
    assert r.status_code == 403, r.text


def test_the_list_carries_no_ticket_reference_while_the_tickets_module_is_off(arr):
    _typed(arr)
    assert arr.s4.c.patch("/api/v1/settings", json={"tickets.enabled": "false"}).status_code == 200
    body = arr.s4.c.get(PENDING).json()
    assert body["tickets_on"] is False and body["pending"][0]["ticket_number"] is None


def test_reject_from_the_list_uses_the_existing_reject_and_delete(arr):
    cid = _typed(arr)
    r = arr.s4.c.post(f"{PENDING}/{cid}/reject")
    assert r.status_code == 200 and r.json()["deleted"] is True, r.text
    assert arr.s4.c.get(PENDING).json()["pending"] == []