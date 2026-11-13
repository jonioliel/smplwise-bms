"""CR-BILL-LEDGER-A-2436 (code review 04:F04): the sealed-bill lifecycle shared by electricity and water (services/bill_ledger.py).

Two kinds of check, both on a migrated database with hand-made draft rows (no readings, no app, no device):
- the cross-kind rule: an electricity bill and a water bill of the same customer and month never carry the same number, whichever is
  issued first, and their corrections never collide either;
- a characterisation of every statement the marks, the void, the correction check, the numbering and the seal send, per kind. The
  golden traces (tests/fixtures/bill_ledger_sql_golden.json) were recorded from the two hand-written copies BEFORE the extraction; the
  shared ledger must send the same statements, in the same order, with the same text, audit actions and error codes.

Regenerate the golden file only on purpose: SW_BILL_LEDGER_GOLDEN_WRITE=1 (then review the diff)."""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.services import energy_billing as eb
from smplwise.services import water_billing as wb

NOW = dt.datetime(2026, 10, 2, 9, 0, tzinfo=dt.timezone.utc)
GOLDEN = Path(__file__).parent / "fixtures" / "bill_ledger_sql_golden.json"
CN = "0042"
ACTOR = SimpleNamespace(user_id="u-joni", username="joni", display_name="יוני", source=None)
KINDS = {"energy": eb, "water": wb}
TABLE = {"energy": "energy_bills", "water": "water_bills"}
QTY = {"energy": "kwh", "water": "m3"}


@dataclass
class FakeComputed:
    snapshot: dict[str, Any]
    total: str = "100.00"
    kwh: str = "10.000"
    m3: str = "10.000"


@pytest.fixture(scope="module")
def migrated(tmp_path_factory) -> Path:
    """The real migrations, once for this module (a hand-made Database.migrate() call does not use the per-process template)."""
    path = tmp_path_factory.mktemp("bill_ledger") / "template.db"
    Database(path).migrate()
    return path


@pytest.fixture()
def conn(migrated, tmp_path, monkeypatch):
    monkeypatch.setattr(eb, "now_utc", lambda: NOW)
    monkeypatch.setattr(wb, "now_utc", lambda: NOW)
    c = sqlite3.connect(tmp_path / "bills.db", isolation_level=None)
    with closing(sqlite3.connect(migrated)) as src:
        src.backup(c)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = OFF")  # hand-made drafts without accounts / tariffs
    yield c
    c.close()


def draft(c: sqlite3.Connection, kind: str, bid: str, *, period_start: str = "2026-09-01", period_end: str = "2026-10-01", account: str | None = None, revision: int = 1, replaces: str | None = None,
          state: str = "draft", number: str | None = None) -> sqlite3.Row:
    snap = {"customer": {"customer_number": CN, "name": "דני"}, "bill": {"revision": revision, "payment_terms": {"mode": "net_days", "days": 30}}}
    c.execute(f"INSERT INTO {TABLE[kind]}(id, account_id, customer_id, revision, replaces_bill_id, period_start, period_end, state, origin, "
              f"{QTY[kind]}, total, snapshot_json, created_at, updated_at, number) VALUES (?, ?, 'cust-1', ?, ?, ?, ?, ?, 'manual', '1', '1', ?, "
              "'2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z', ?)",
              (bid, account or f"acc-{kind}", revision, replaces, period_start, period_end, state, json.dumps(snap, ensure_ascii=False), number))
    return c.execute(f"SELECT * FROM {TABLE[kind]} WHERE id = ?", (bid,)).fetchone()


def seal(c: sqlite3.Connection, kind: str, row: sqlite3.Row, actor: Any = ACTOR) -> str:
    snap = json.loads(row["snapshot_json"])
    KINDS[kind].seal(c, row, FakeComputed(snap), actor=actor, issue_date=dt.date(2026, 10, 2), request_id="rq-1", client_request_id=f"cr-{row['id']}")
    return c.execute(f"SELECT number FROM {TABLE[kind]} WHERE id = ?", (row["id"],)).fetchone()[0]


# ---------------------------------------------------------------- the cross-kind rule

@pytest.mark.parametrize("first", ["energy", "water"])
def test_electricity_and_water_bills_of_one_customer_and_month_never_share_a_number(conn, first):
    second = "water" if first == "energy" else "energy"
    n1 = seal(conn, first, draft(conn, first, "b-first"))
    n2 = seal(conn, second, draft(conn, second, "b-second"))
    assert n1 == f"2026-09-{CN}" and n2 == f"2026-09-{CN}/2"
    assert n1 != n2
    # both are in the one ledger of numbers ever used, each pointing at its own bill
    led = {r["number"]: r["bill_id"] for r in conn.execute("SELECT number, bill_id FROM energy_bill_numbers")}
    assert led == {n1: "b-first", n2: "b-second"}
    # a third bill of either kind for the same month takes /3
    n3 = seal(conn, first, draft(conn, first, "b-third", account="acc-other"))
    assert n3 == f"2026-09-{CN}/3"


@pytest.mark.parametrize("first", ["energy", "water"])
def test_corrections_of_both_kinds_keep_their_own_base_and_never_collide(conn, first):
    second = "water" if first == "energy" else "energy"
    seal(conn, first, draft(conn, first, "b-a"))
    seal(conn, second, draft(conn, second, "b-b"))
    ca = seal(conn, first, draft(conn, first, "b-a2", revision=2, replaces="b-a"))
    cb = seal(conn, second, draft(conn, second, "b-b2", revision=2, replaces="b-b"))
    assert ca == f"2026-09-{CN}-2" and cb == f"2026-09-{CN}/2-2"
    for kind, orig, repl in ((first, "b-a", "b-a2"), (second, "b-b", "b-b2")):
        o = conn.execute(f"SELECT state, replaced_by_bill_id FROM {TABLE[kind]} WHERE id = ?", (orig,)).fetchone()
        assert (o["state"], o["replaced_by_bill_id"]) == ("void", repl)
    numbers = [r[0] for r in conn.execute("SELECT number FROM energy_bill_numbers ORDER BY number")]
    assert len(numbers) == len(set(numbers)) == 4


def test_a_number_already_in_the_other_kinds_table_is_refused_as_taken(conn):
    # a water bill row carrying the base number without a ledger row (a pre-ledger database): water's own check sees it
    draft(conn, "energy", "e-old", state="issued", number=f"2026-09-{CN}")
    with pytest.raises(ApiError) as e:
        wb.number_for(conn, draft(conn, "water", "w-1"), CN)
    # the electricity row has no number_seq, so the next sequence is still 1 and the number is taken
    assert e.value.code == "number_taken"


# ---------------------------------------------------------------- the marks, the void and the correction check

def issued(c: sqlite3.Connection, kind: str, bid: str = "b-1") -> sqlite3.Row:
    row = draft(c, kind, bid)
    seal(c, kind, row)
    return c.execute(f"SELECT * FROM {TABLE[kind]} WHERE id = ?", (bid,)).fetchone()


def audit_actions(c: sqlite3.Connection) -> list[str]:
    return [r[0] for r in c.execute("SELECT action FROM audit_log ORDER BY rowid")]


@pytest.mark.parametrize("kind", ["energy", "water"])
def test_marks_void_and_correction_check_errors_and_audit_actions(conn, kind):
    m = KINDS[kind]
    prefix = "energy." if kind == "energy" else "infra.water."
    row = issued(conn, kind)
    with pytest.raises(ApiError) as e:
        m.mark_sent(conn, "b-1", "2026-10-03", "email", "", ACTOR, "rq", row_version=row["row_version"] + 5)
    assert (e.value.code, e.value.status) == ("revision_conflict", 409)
    m.mark_sent(conn, "b-1", "2026-10-03", "email", "note", ACTOR, "rq", row_version=row["row_version"])
    m.mark_paid(conn, "b-1", "2026-10-04", "ref", ACTOR, "rq")
    with pytest.raises(ApiError) as e:
        m.mark_sent(conn, "b-1", "2026-10-05", "email", "", ACTOR, "rq")
    assert e.value.code == "bill_state" and "שולם" in e.value.user_message
    with pytest.raises(ApiError) as e:
        m.void_bill(conn, "b-1", "  ", ACTOR, "rq")
    assert (e.value.code, e.value.status) == ("reason_required", 422)
    with pytest.raises(ApiError) as e:
        m.void_bill(conn, "b-1", "טעות", ACTOR, "rq")
    assert e.value.code == "bill_state"
    paid = m.get_bill(conn, "b-1")
    m.check_correctable(conn, paid)
    draft(conn, kind, "b-1c", revision=2, replaces="b-1")
    with pytest.raises(ApiError) as e:
        m.check_correctable(conn, paid)
    assert e.value.code == "bill_state" and e.value.details.get("bill_id") == "b-1c"
    with pytest.raises(ApiError) as e:
        m.get_bill(conn, "missing")
    assert e.value.status == 404
    assert audit_actions(conn) == [f"{prefix}bill.issue", f"{prefix}bill.sent", f"{prefix}bill.paid"]
    ev = [r[0] for r in conn.execute(f"SELECT action FROM {TABLE[kind][:-1]}_events WHERE bill_id = 'b-1' ORDER BY rowid")]
    assert ev == ["issue", "sent", "paid"]


@pytest.mark.parametrize("kind", ["energy", "water"])
def test_a_system_seal_is_an_auto_issue_and_void_is_recorded(conn, kind):
    m = KINDS[kind]
    prefix = "energy." if kind == "energy" else "infra.water."
    seal(conn, kind, draft(conn, kind, "b-s"), actor=None)
    m.void_bill(conn, "b-s", " קריאה שגויה ", ACTOR, "rq")
    row = m.get_bill(conn, "b-s")
    assert (row["state"], row["void_reason"]) == ("void", "קריאה שגויה")
    assert audit_actions(conn) == [f"{prefix}bill.auto_issue", f"{prefix}bill.void"]
    snap = json.loads(row["snapshot_json"])
    assert snap["bill"]["issued_by"] == {"kind": "system"} and snap["bill"]["issued_at"] == "2026-10-02T09:00:00Z"


# ---------------------------------------------------------------- the statements, literally (golden traces)

_HEX = re.compile(r"\b[0-9a-f]{12,64}\b")
_TS = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?")


def _norm(sql: str) -> str:
    return _TS.sub("<TS>", _HEX.sub("<HEX>", " ".join(sql.split())))


def _scenario(c: sqlite3.Connection, kind: str) -> dict[str, list[str]]:
    m = KINDS[kind]
    out: dict[str, list[str]] = {}

    def run(name: str, fn) -> None:
        trace: list[str] = []
        c.set_trace_callback(trace.append)
        try:
            fn()
        except ApiError as e:
            trace.append(f"-- ApiError {e.status} {e.code} {e.user_message} {sorted((e.details or {}).items())}")
        finally:
            c.set_trace_callback(None)
        out[name] = [_norm(s) for s in trace]

    other = "water" if kind == "energy" else "energy"
    seal(c, other, draft(c, other, "x-other"))
    d = draft(c, kind, "g-1")
    run("number_for", lambda: m.number_for(c, d, CN))
    run("seal", lambda: seal(c, kind, d))
    r = m.get_bill(c, "g-1")
    run("mark_sent_conflict", lambda: m.mark_sent(c, "g-1", "2026-10-03", "email", "n", ACTOR, "rq", row_version=99))
    run("mark_sent", lambda: m.mark_sent(c, "g-1", "2026-10-03", "email", "n", ACTOR, "rq", row_version=r["row_version"]))
    run("mark_paid", lambda: m.mark_paid(c, "g-1", "2026-10-04", "ref", ACTOR, "rq"))
    run("mark_paid_state", lambda: m.mark_paid(c, "g-1", "2026-10-04", "ref", ACTOR, "rq"))
    run("void_no_reason", lambda: m.void_bill(c, "g-1", " ", ACTOR, "rq"))
    run("void_state", lambda: m.void_bill(c, "g-1", "x", ACTOR, "rq"))
    paid = m.get_bill(c, "g-1")
    run("check_correctable_ok", lambda: m.check_correctable(c, paid))
    corr = draft(c, kind, "g-2", revision=2, replaces="g-1")
    run("check_correctable_open", lambda: m.check_correctable(c, paid))
    run("seal_correction", lambda: seal(c, kind, corr, actor=None))
    d3 = draft(c, kind, "g-3", period_start="2026-10-01", period_end="2026-11-01")
    seal(c, kind, d3)
    run("void", lambda: m.void_bill(c, "g-3", " סיבה ", ACTOR, "rq", row_version=m.get_bill(c, "g-3")["row_version"]))
    run("number_for_taken", lambda: m.number_for(c, corr, CN))
    run("get_bill_missing", lambda: m.get_bill(c, "nope"))
    return out


@pytest.mark.parametrize("kind", ["energy", "water"])
def test_statements_text_order_audit_and_errors_are_unchanged(conn, kind):
    got = _scenario(conn, kind)
    golden = json.loads(GOLDEN.read_text(encoding="utf-8")) if GOLDEN.exists() else {}
    if os.environ.get("SW_BILL_LEDGER_GOLDEN_WRITE") == "1":
        golden[kind] = got
        GOLDEN.parent.mkdir(parents=True, exist_ok=True)
        GOLDEN.write_text(json.dumps(golden, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
        pytest.skip("golden written")
    assert kind in golden, "golden trace missing"
    for name, stmts in golden[kind].items():
        assert got.get(name) == stmts, name
    assert set(got) == set(golden[kind])
