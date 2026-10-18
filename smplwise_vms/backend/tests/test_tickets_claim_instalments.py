"""CR-CLAIM-PREFILL follow-up (owner decision 2026-10-17, open question 2; migration 0117): several payment demands per assignment, one
per approved instalment, over the REAL store, the real migrations, the internal API and the public app.

Negative cases first: the migration on a database that already holds claims (no row of a claim, revision, decision, file or page lost;
the uniqueness still refuses a second ordinary claim and the same instalment twice; running the migrations again does nothing); a NEXT
instalment without a manager demand, the same instalment twice, a demand without an instalment once his demands are per instalment, an
instalment after a whole-quote demand was settled, a demand above the instalment without a reason (nothing is written); then the flows -
the first instalment takes the ordinary claim, the next one opens its own claim only after the manager's demand, the managers see both,
the claim step reopens through the demand after the window closed. Every name and number here is invented."""
from __future__ import annotations

import shutil
import sqlite3
import time

import pytest

from smplwise import db as dbmod
from smplwise.services.tickets import money
from smplwise.services.tickets.public_http import UNIFORM_404
from test_tickets_claim_prefill import _claim_page, _ordered, hdr
from test_tickets_rfq_instalments import demand
from test_tickets_rfq_terms import s4  # noqa: F401 - the fixture
from tickets_s4_world import API, Clock, crid

AT = "2026-10-01T08:00:00Z"


# ---------------------------------------------------------------- the migration on a populated database (negative first)

def _at_0116(settings, tmp_path, monkeypatch) -> dbmod.Database:
    real = dbmod.MIGRATIONS_DIR
    older = tmp_path / "at-0116"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) <= 116:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    database = dbmod.Database(settings.db_path)
    assert database.migrate()[-1] == 116
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    return database


def _seed(conn) -> None:
    for n in (1, 2):
        conn.execute("INSERT INTO ticket_cost_claims (id, ticket_id, department_id, assignment_id, contact_id, required, status, currency, "
                     "current_revision_id, approved_revision_id, approved_total_minor, approved_by, approved_at, claim_until, snapshot_json, "
                     "revision, created_at, updated_at, quote_id) VALUES (?, NULL, 'dept-maintenance', ?, 'c1', 1, ?, 'ILS', ?, ?, ?, ?, ?, ?, "
                     "'{\"vendor\":\"קליימה-טק\"}', 3, ?, ?, ?)",
                     (f"cl{n}", f"asg{n}", "approved" if n == 1 else "submitted", f"rv{n}", f"rv{n}" if n == 1 else None,
                      12345 if n == 1 else None, "u-kim" if n == 1 else None, AT if n == 1 else None, AT, AT, AT, f"q{n}"))
        conn.execute("INSERT INTO ticket_cost_revisions (id, claim_id, seq, source, kind, lines_json, labor_minor, parts_minor, travel_minor, "
                     "other_minor, subtotal_minor, vat_mode, vat_rate_bp, vat_minor, total_minor, currency, created_by_kind, created_by, "
                     "created_at, basis_json) VALUES (?, ?, 1, 'vendor', 'submission', '[]', 12345, 0, 0, 0, 12345, 'none', 0, 0, 12345, "
                     "'ILS', 'contact', 'c1', ?, '{\"basis\":\"total\"}')", (f"rv{n}", f"cl{n}", AT))
        conn.execute("INSERT INTO ticket_cost_decisions (id, claim_id, revision_id, action, reason, by_user, at) VALUES (?, ?, ?, 'approve', NULL, "
                     "'u-kim', ?)", (f"dc{n}", f"cl{n}", f"rv{n}", AT))
        conn.execute("INSERT INTO ticket_cost_files (id, ticket_id, claim_id, revision_id, kind, path, sha256, bytes, uploaded_by_kind, uploaded_by, "
                     "created_at) VALUES (?, 't-gone', ?, ?, 'photo', ?, ?, 10, 'contact', 'c1', ?)", (f"fl{n}", f"cl{n}", f"rv{n}", f"p/{n}.jpg", "a" * 63 + str(n), AT))
        conn.execute("INSERT INTO ticket_cost_revision_files (revision_id, file_id, doc_no, page_no) VALUES (?, ?, 1, 1)", (f"rv{n}", f"fl{n}"))
    conn.execute("INSERT INTO ticket_cost_files (id, ticket_id, claim_id, link_id, kind, path, sha256, bytes, uploaded_by_kind, uploaded_by, created_at) "
                 "VALUES ('pending', 't-gone', NULL, 'lk1', 'photo', 'p/x.jpg', ?, 5, 'contact', 'c1', ?)", ("b" * 64, AT))


def _dump(conn) -> dict:
    out = {}
    for t in ("ticket_cost_claims", "ticket_cost_revisions", "ticket_cost_decisions", "ticket_cost_files", "ticket_cost_revision_files"):
        cols = [r[1] for r in conn.execute(f"PRAGMA table_info({t})") if r[1] != "instalment_index"]
        out[t] = sorted(tuple(r) for r in conn.execute(f"SELECT {', '.join(cols)} FROM {t}").fetchall())
    return out


def test_0117_keeps_every_claim_row_and_moves_the_uniqueness(settings, tmp_path, monkeypatch):
    database = _at_0116(settings, tmp_path, monkeypatch)
    with database.connection() as conn:
        _seed(conn)
        before = _dump(conn)
        with pytest.raises(sqlite3.IntegrityError):  # 0083: one claim per assignment
            conn.execute("INSERT INTO ticket_cost_claims (id, department_id, assignment_id, contact_id, required, status, currency, snapshot_json, "
                         "created_at, updated_at) VALUES ('x', 'd', 'asg1', 'c1', 0, 'awaiting', 'ILS', '{}', ?, ?)", (AT, AT))
    assert database.migrate() == [117]
    assert database.migrate() == []  # recorded once: running the migrations again changes nothing
    with database.connection() as conn:
        assert _dump(conn) == before, "no claim, revision, decision, file or page was changed or lost"
        assert [r[0] for r in conn.execute("SELECT instalment_index FROM ticket_cost_claims")] == [None, None]
        assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
        ins = ("INSERT INTO ticket_cost_claims (id, department_id, assignment_id, contact_id, required, status, currency, snapshot_json, created_at, "
               "updated_at, instalment_index) VALUES (?, 'd', 'asg1', 'c1', 0, 'awaiting', 'ILS', '{}', ?, ?, ?)")
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(ins, ("dup-null", AT, AT, None))  # still ONE ordinary claim per assignment
        conn.execute(ins, ("i0", AT, AT, 0))
        conn.execute(ins, ("i1", AT, AT, 1))
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(ins, ("i1-again", AT, AT, 1))  # never the same instalment twice
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(ins, ("i6", AT, AT, 6))  # an instalment index is 0..5
        conn.execute("DELETE FROM ticket_cost_claims WHERE id = 'cl1'")  # the cascade still works on the rebuilt table
        assert conn.execute("SELECT COUNT(*) FROM ticket_cost_revisions WHERE claim_id = 'cl1'").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM ticket_cost_files WHERE id = 'pending'").fetchone()[0] == 1


# ---------------------------------------------------------------- the flows over the real API

def _approve(s4, tid, claim_id=None):
    claims = s4.c.get(f"{API}/tickets/{tid}/costs", headers=s4.h("kim")).json()["claims"]
    c = next(x for x in claims if claim_id is None or x["id"] == claim_id) if claim_id else [x for x in claims if x["status"] == "submitted"][0]
    r = s4.c.post(f"{API}/tickets/{tid}/costs/{c['id']}/approve", json={"revision": c["revision"], "revision_id": c["current_revision_id"]},
                  headers=s4.h("kim"))
    assert r.status_code == 200, r.text
    return c


def _instalment(client, tok, index, amount_minor, **body):
    lines = [{"kind": "labor", "hours": "1", "rate": money.format_minor(amount_minor)}]
    payload = {"lines": lines, "amounts_include_vat": True, "client_request_id": crid(), **body}
    if index is not None:
        payload["instalment_index"] = index
    return client.post("/t/api/claim", headers=hdr(tok), json=payload)


def _rows(s4, tid):
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT id, instalment_index, status, required FROM ticket_cost_claims WHERE ticket_id = ? "
                                              "ORDER BY created_at, rowid", (tid,)).fetchall()]


def test_the_next_instalment_needs_the_managers_demand_and_is_never_demanded_twice(s4):
    d, a, tok, client, clock, tid = _ordered(s4)
    p = _claim_page(client, tok)["prefill"]
    adv, prog = p["instalments"][0], p["instalments"][1]
    r = _instalment(client, tok, 0, adv["amount_minor"])  # the first instalment takes the ordinary (required) claim
    assert r.status_code == 201, r.text
    assert [(x["instalment_index"], x["required"]) for x in _rows(s4, tid)] == [(0, 1)]
    _approve(s4, tid)
    # negative: no manager demand for the next instalment / no instalment named / the same instalment again
    r = _instalment(client, tok, 1, prog["amount_minor"])
    assert r.status_code == 409 and r.json()["code"] == "instalment_not_open", r.text
    r = _instalment(client, tok, None, prog["amount_minor"])
    assert r.status_code == 422 and r.json()["fields"] == [{"field": "instalment_index", "code": "required"}], r.text
    r = _instalment(client, tok, 0, adv["amount_minor"])
    assert r.status_code == 409 and r.json()["code"] == "claim_closed", r.text
    page = _claim_page(client, tok)
    assert page["status"] == "approved" and page["instalment_index"] == 0 and page["claims"] == []
    # the manager opens the demand for the progress instalment: the page offers a NEW claim for it
    assert demand(s4, d["id"], a["id"], 1).status_code == 200
    page = _claim_page(client, tok)
    assert page["status"] == "awaiting" and page["writable"] is True and page["instalment_index"] == 1 and page["instalment_fixed"] is True
    assert page["prefill"]["instalment"] == 1 and page["revisions"] == []
    assert page["claims"] == [{"instalment_index": 0, "status": "approved", "total_minor": adv["amount_minor"], "currency": "ILS"}]
    # above the instalment without a reason: refused, and NOTHING is written (no second claim row)
    r = _instalment(client, tok, 1, prog["amount_minor"] + 500)
    assert r.status_code == 422 and r.json()["fields"] == [{"field": "above_reason", "code": "required"}], r.text
    assert len(_rows(s4, tid)) == 1
    r = _instalment(client, tok, 1, prog["amount_minor"])
    assert r.status_code == 201, r.text
    rows = _rows(s4, tid)
    assert [(x["instalment_index"], x["status"], x["required"]) for x in rows] == [(0, "approved", 1), (1, "submitted", 0)]
    # a correction of the same instalment goes to ITS claim (superseded revision), never a third row
    assert _instalment(client, tok, 1, prog["amount_minor"]).status_code == 201
    assert len(_rows(s4, tid)) == 2
    claims = s4.c.get(f"{API}/tickets/{tid}/costs", headers=s4.h("kim")).json()["claims"]
    assert [c["instalment_index"] for c in claims] == [0, 1]
    assert claims[1]["quote_check"]["basis"] == "instalment" and claims[1]["quote_check"]["status"] == "same"
    _approve(s4, tid, rows[1]["id"])
    assert _instalment(client, tok, 1, prog["amount_minor"]).json()["code"] == "claim_closed"
    with s4.db.connection(mode="read") as conn:
        cost = conn.execute("SELECT cost_status, cost_total_minor FROM tickets WHERE id = ?", (tid,)).fetchone()
    assert cost[0] == "approved" and cost[1] == adv["amount_minor"] + prog["amount_minor"]  # the board sums both demands


def test_after_a_whole_quote_demand_was_settled_no_instalment_demand_opens(s4):
    d, a, tok, client, clock, tid = _ordered(s4)
    p = _claim_page(client, tok)["prefill"]
    from test_tickets_claim_prefill import _lines_from, _post

    assert _post(client, tok, _lines_from(p), p).status_code == 201  # the whole approved quote
    _approve(s4, tid)
    assert demand(s4, d["id"], a["id"], 1).status_code == 200
    r = _instalment(client, tok, 1, p["instalments"][1]["amount_minor"])
    assert r.status_code == 409 and r.json()["code"] == "claim_closed", r.text
    page = _claim_page(client, tok)
    assert page["status"] == "approved" and page["instalment_index"] is None and len(_rows(s4, tid)) == 1


def test_the_managers_demand_reopens_the_claim_step_for_its_window_only(s4):
    d, a, tok, client, clock, tid = _ordered(s4)
    p = _claim_page(client, tok)["prefill"]
    assert _instalment(client, tok, 0, p["instalments"][0]["amount_minor"]).status_code == 201
    _approve(s4, tid)
    assert s4.w.status("joni", tid, "closed").status_code == 200
    with s4.db.connection() as conn:  # the first demand's window is over
        conn.execute("UPDATE ticket_cost_claims SET claim_until = '2020-01-01T00:00:00Z' WHERE ticket_id = ?", (tid,))
    later, _ = s4.public(Clock(clock() + 3 * 86400))
    assert later.get("/t/api/claim", headers=hdr(tok)).content == UNIFORM_404  # nothing open, no demand: the link is dead
    assert demand(s4, d["id"], a["id"], 1).status_code == 200
    page = later.get("/t/api/claim", headers=hdr(tok))
    assert page.status_code == 200 and page.json()["instalment_index"] == 1, page.text
    r = _instalment(later, tok, 1, p["instalments"][1]["amount_minor"])
    assert r.status_code == 201, r.text
    gone, _ = s4.public(Clock(time.time() + 120 * 86400))
    assert gone.get("/t/api/claim", headers=hdr(tok)).content == UNIFORM_404
