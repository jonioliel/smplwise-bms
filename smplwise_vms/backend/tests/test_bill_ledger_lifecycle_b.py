"""CR-BILL-LEDGER-B-2438 (code review 04:F04, step B): drafts, automatic generation and retention of electricity and water bills, written
once in services/bill_ledger.py.

Three kinds of check, on a migrated database with hand-made accounts and a fake computation (no readings, no device, no payment provider):
- golden statement traces of every draft operation, of automatic-generation passes and of retention, per kind. They were recorded from the
  two hand-written copies BEFORE the move (tests/fixtures/bill_ledger_b_sql_golden.json): the shared ledger must send the same statements,
  in the same order, with the same text, on the same labelled connections, with the same audit rows, error codes and log lines;
- money rules on a real Database: amounts carried to the sealed bill exactly as computed (no re-rounding), a re-run / a restart / a crash
  in the middle / concurrent passes never make a second bill, an auto-issued electricity and water bill of one customer and month never
  share a number;
- retention: only drafts older than the draft window and documents whose period ended before the retention years go; an issued, sent,
  paid or void document inside the window is never deleted however old its last change, the boundary month is kept, the ledger of used
  numbers and the automatic-run rows stay (no number is ever reused, no deleted period is generated again).

Regenerate the golden file only on purpose: SW_BILL_LEDGER_GOLDEN_WRITE=1 (then review the diff)."""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import re
import sqlite3
import threading
from contextlib import closing, contextmanager
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.services import energy_billing as eb
from smplwise.services import energy_periods as per
from smplwise.services import water_billing as wb
from smplwise.services import water_settings as ws

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 12, 2, 9, 0, tzinfo=UTC)
GOLDEN = Path(__file__).parent / "fixtures" / "bill_ledger_b_sql_golden.json"
CN = "0042"
ACTOR = SimpleNamespace(user_id="u-joni", username="joni", display_name="יוני", source=None)
KINDS = {"energy": eb, "water": wb}
TABLE = {"energy": "energy_bills", "water": "water_bills"}
EVENTS = {"energy": "energy_bill_events", "water": "water_bill_events"}
ACCOUNTS = {"energy": "energy_accounts", "water": "water_accounts"}
RUNS = {"energy": "energy_auto_runs", "water": "water_auto_runs"}
TARIFFS = {"energy": "energy_tariffs", "water": "water_tariffs"}
QTY = {"energy": "kwh", "water": "m3"}
PREFIX = {"energy": "energy.", "water": "infra.water."}
SEP = per.Period(dt.date(2026, 9, 1), dt.date(2026, 10, 1))
OCT = per.Period(dt.date(2026, 10, 1), dt.date(2026, 11, 1))
NOV = per.Period(dt.date(2026, 11, 1), dt.date(2026, 12, 1))


@dataclass
class FakeComputed:
    snapshot: dict[str, Any]
    total: str = "100.00"
    kwh: str = "10.00"
    m3: str = "10.000"
    end_caps: dict[str, str] | None = None


def snap(revision: int = 1, meter_end: str = "2026-09-30T20:00:00Z") -> dict[str, Any]:
    return {"customer": {"customer_number": CN, "name": "דני"},
            "bill": {"revision": revision, "payment_terms": {"mode": "net_days", "days": 30}},
            "meters": [{"meter_id": "m1", "end": {"at": meter_end}}, {"meter_id": "m2", "end": {"at": None}}]}


def comp(total: str = "100.00", qty: str = "10.000", revision: int = 1) -> FakeComputed:
    return FakeComputed(snap(revision), total=total, kwh=qty, m3=qty)


@pytest.fixture(scope="module")
def migrated(tmp_path_factory) -> Path:
    path = tmp_path_factory.mktemp("bill_ledger_b") / "template.db"
    Database(path).migrate()
    return path


def _copy(migrated: Path, dest: Path) -> sqlite3.Connection:
    c = sqlite3.connect(dest, isolation_level=None, check_same_thread=False)
    with closing(sqlite3.connect(migrated)) as src:
        src.backup(c)
    c.row_factory = sqlite3.Row
    return c


@pytest.fixture()
def pinned(monkeypatch):
    monkeypatch.setattr(eb, "now_utc", lambda: NOW)
    monkeypatch.setattr(wb, "now_utc", lambda: NOW)
    monkeypatch.setattr(ws, "enabled", lambda conn: True)  # the water module switch (new modules start off)
    eb._LAST_AUTO.clear()
    eb._LAST_RETENTION.clear()
    wb.reset()
    yield
    eb._LAST_AUTO.clear()
    eb._LAST_RETENTION.clear()
    wb.reset()


@pytest.fixture()
def conn(migrated, tmp_path, pinned):
    c = _copy(migrated, tmp_path / "bills.db")
    c.execute("PRAGMA foreign_keys = OFF")  # hand-made rows without the whole customer / tariff chain
    yield c
    c.close()


def account(c: sqlite3.Connection, kind: str, aid: str, *, auto_mode: str = "draft", created: str = "2026-08-15T00:00:00Z",
            customer: str = "cust-1", status: str = "active") -> sqlite3.Row:
    c.execute(f"INSERT INTO {ACCOUNTS[kind]}(id, name, customer_id, formula_json, tariff_id, period_months, period_anchor_day, first_period_start, "
              "timezone, auto_mode, status, revision, created_at, updated_at) VALUES (?, ?, ?, '{}', 'tariff-1', 1, 1, '2026-09-01', 'Asia/Jerusalem', ?, ?, 1, ?, ?)",
              (aid, f"חשבון {aid}", customer, auto_mode, status, created, created))
    return c.execute(f"SELECT * FROM {ACCOUNTS[kind]} WHERE id = ?", (aid,)).fetchone()


def bill_row(c: sqlite3.Connection, kind: str, bid: str, aid: str, p: per.Period, *, state: str = "draft", number: str | None = None,
             updated: str = "2026-10-01T00:00:00Z", revision: int = 1, pdf_path: str | None = None) -> None:
    extra = ", pdf_path" if kind == "energy" else ""
    vals = ", ?" if kind == "energy" else ""
    params: tuple = (bid, aid, revision, p.start.isoformat(), p.end.isoformat(), state, json.dumps(snap(revision), ensure_ascii=False), updated, updated, number)
    if kind == "energy":
        params += (pdf_path,)
    c.execute(f"INSERT INTO {TABLE[kind]}(id, account_id, customer_id, revision, period_start, period_end, state, origin, {QTY[kind]}, total, snapshot_json, "
              f"created_at, updated_at, number{extra}) VALUES (?, ?, 'cust-1', ?, ?, ?, ?, 'manual', '1', '1', ?, ?, ?, ?{vals})", params)


# ---------------------------------------------------------------- tracing

_HEX = re.compile(r"\b[0-9a-f]{12,64}\b")
_TS = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?")


def _norm(sql: str) -> str:
    return _TS.sub("<TS>", _HEX.sub("<HEX>", " ".join(str(sql).split())))


class _Logs(logging.Handler):
    def __init__(self, sink: list[str]) -> None:
        super().__init__(logging.DEBUG)
        self.sink = sink

    def emit(self, record: logging.LogRecord) -> None:
        self.sink.append(f"-- log {record.levelname} {record.name} {record.getMessage()}")


@contextmanager
def logs_into(sink: list[str]):
    h = _Logs(sink)
    loggers = [logging.getLogger("smplwise.energy_billing"), logging.getLogger("smplwise.water_billing")]
    old = [(lg.level, lg.propagate) for lg in loggers]
    for lg in loggers:
        lg.addHandler(h)
        lg.setLevel(logging.DEBUG)
    try:
        yield
    finally:
        for lg, (lvl, _prop) in zip(loggers, old):
            lg.removeHandler(h)
            lg.setLevel(lvl)


class TraceDB:
    """A Database stand-in over one raw connection: names every connection the code opens (mode + label) and records its statements."""

    def __init__(self, c: sqlite3.Connection) -> None:
        self.c = c
        self.trace: list[str] = []
        self.path = "trace.db"

    @contextmanager
    def connection(self, mode: str = "write", label: str | None = None, durable: bool = True):
        self.trace.append(f"-- connection {mode} {label}")
        self.c.set_trace_callback(self.trace.append)
        try:
            yield self.c
        finally:
            self.c.set_trace_callback(None)


def _result(v: Any) -> str:
    if isinstance(v, sqlite3.Row):
        return f"row {v['id']}"
    if isinstance(v, dict):
        return repr(sorted((k, str(x)) for k, x in v.items()))
    return repr(v)


def _scenario_drafts(c: sqlite3.Connection, kind: str) -> dict[str, list[str]]:
    m = KINDS[kind]
    out: dict[str, list[str]] = {}

    def run(name: str, fn) -> Any:
        trace: list[str] = []
        c.set_trace_callback(trace.append)
        got = None
        try:
            got = fn()
            if got is not None:
                trace.append(f"-- result {_result(got)}")
        except ApiError as e:
            trace.append(f"-- ApiError {e.status} {e.code} {e.user_message} {sorted((e.details or {}).items())}")
        finally:
            c.set_trace_callback(None)
        out[name] = [_norm(s) for s in trace]
        return got

    acc = account(c, kind, "acc-1")
    bid = run("insert_draft", lambda: m.insert_draft(c, acc, SEP, comp(), actor=ACTOR, origin="manual", request_id="rq", client_request_id="cr-1"))
    run("insert_draft_exists", lambda: m.insert_draft(c, acc, SEP, comp(), actor=ACTOR, origin="manual", request_id="rq", client_request_id="cr-2"))
    run("by_create_request", lambda: m.by_create_request(c, "cr-1"))
    run("by_create_request_none", lambda: m.by_create_request(c, "cr-none"))
    b = m.get_bill(c, bid)
    run("store_recalculated", lambda: m.store_recalculated(c, b, comp("123.45", "12.345"), ACTOR, "rq", b["row_version"]))
    run("store_recalculated_conflict", lambda: m.store_recalculated(c, b, comp(), ACTOR, "rq", b["row_version"]))
    run("delete_draft_conflict", lambda: m.delete_draft(c, bid, 99, ACTOR, "rq"))
    run("delete_draft", lambda: m.delete_draft(c, bid, m.get_bill(c, bid)["row_version"], ACTOR, "rq"))
    auto = run("insert_draft_auto", lambda: m.insert_draft(c, acc, SEP, comp(), actor=None, origin="auto", request_id=None, client_request_id=None))
    ar = m.get_bill(c, auto)
    m.seal(c, ar, FakeComputed(json.loads(ar["snapshot_json"])), actor=None, issue_date=dt.date(2026, 10, 2), request_id=None, client_request_id=None)
    issued = m.get_bill(c, auto)
    run("insert_draft_overlap", lambda: m.insert_draft(c, acc, SEP, comp(), actor=ACTOR, origin="manual", request_id="rq", client_request_id="cr-3"))
    run("store_recalculated_not_draft", lambda: m.store_recalculated(c, issued, comp(), ACTOR, "rq", issued["row_version"]))
    run("delete_draft_not_draft", lambda: m.delete_draft(c, auto, issued["row_version"], ACTOR, "rq"))
    run("insert_draft_correction", lambda: m.insert_draft(c, acc, SEP, comp(revision=2), actor=ACTOR, origin="manual", request_id="rq",
                                                          client_request_id="cr-4", replaces=issued))
    w_start = dt.datetime(2026, 9, 30, 21, 0, tzinfo=UTC)
    run("prev_bill", lambda: m._prev_bill(c, "acc-1", OCT.start))
    run("prev_bill_none", lambda: m._prev_bill(c, "acc-1", NOV.start))
    run("carried_from", lambda: m._carried_from(c, "acc-1", OCT, w_start))
    run("carried_from_none", lambda: m._carried_from(c, "acc-1", NOV, w_start))
    run("end_caps_not_correction", lambda: m._end_caps(c, "acc-1", SEP, None, w_start))
    run("end_caps_no_successor", lambda: m._end_caps(c, "acc-1", SEP, issued, w_start))
    oc = m.insert_draft(c, acc, OCT, comp(), actor=ACTOR, origin="manual", request_id="rq", client_request_id="cr-5")
    orow = m.get_bill(c, oc)
    m.seal(c, orow, FakeComputed(json.loads(orow["snapshot_json"])), actor=ACTOR, issue_date=dt.date(2026, 11, 2), request_id="rq", client_request_id="cr-6")
    run("end_caps_with_successor", lambda: m._end_caps(c, "acc-1", SEP, issued, w_start))
    return out


def _fake_compute(plan: dict[tuple[str, str], Any], c: sqlite3.Connection, kind: str):
    def compute(rconn, provider, acc, p, *, origin="manual", now=None, **_k):
        assert origin == "auto" and provider == "provider" and now is not None
        what = plan.get((acc["id"], p.start.isoformat()), "ok")
        if what == "ok":
            return comp("1234.57", "36.125")
        if what == "vat":
            raise ApiError(422, "vat_missing", "אין שיעור מע״מ.", details={})
        if what == "boom":
            raise RuntimeError("readings store down")
        if what == "bump":  # the account changes while the computation runs: the write must not use the stale computation
            c.execute(f"UPDATE {ACCOUNTS[kind]} SET revision = revision + 1 WHERE id = ?", (acc["id"],))
            return comp()
        if what == "race":  # another pass wrote a draft for the period meanwhile
            bill_row(c, kind, f"race-{acc['id']}", acc["id"], p)
            return comp()
        raise AssertionError(what)
    return compute


def _patch_compute(monkeypatch, kind: str, plan: dict, c: sqlite3.Connection) -> None:
    m = KINDS[kind]
    monkeypatch.setattr(m, "compute", _fake_compute(plan, c, kind))
    if kind == "energy":
        monkeypatch.setattr(eb, "get_provider", lambda conn, settings=None: "provider")
    else:
        monkeypatch.setattr(wb, "provider_for", lambda conn, settings: "provider")


def _auto(kind: str, db: Any, now: dt.datetime, settings: Any = None):
    return eb.auto_generate(db, now=now, settings=settings) if kind == "energy" else wb.auto_generate(db, settings, now=now)


def _scenario_auto(c: sqlite3.Connection, kind: str, monkeypatch) -> dict[str, list[str]]:
    account(c, kind, "a-draft", created="2026-08-15T00:00:00Z")
    account(c, kind, "a-issue", auto_mode="issue", created="2026-08-16T00:00:00Z", customer="cust-2")
    account(c, kind, "a-exists", created="2026-08-17T00:00:00Z")
    account(c, kind, "a-off", auto_mode="off", created="2026-08-18T00:00:00Z")
    account(c, kind, "a-paused", status="paused", created="2026-08-19T00:00:00Z")
    account(c, kind, "a-late", created="2026-10-20T00:00:00Z")  # created during October: September is never generated
    account(c, kind, "a-bump", created="2026-08-21T00:00:00Z")
    account(c, kind, "a-race", created="2026-08-22T00:00:00Z")
    bill_row(c, kind, "x-issued", "a-exists", SEP, state="issued", number=f"2026-09-{CN}")
    plan = {("a-draft", "2026-10-01"): "vat", ("a-draft", "2026-11-01"): "boom", ("a-bump", "2026-09-01"): "bump",
            ("a-race", "2026-09-01"): "race"}
    _patch_compute(monkeypatch, kind, plan, c)
    out: dict[str, list[str]] = {}
    db = TraceDB(c)

    def run(name: str, now: dt.datetime) -> None:
        db.trace = []
        with logs_into(db.trace):
            o = _auto(kind, db, now)
        db.trace.append(f"-- outcome created={o.created} issued={o.issued} failed={o.failed} skipped={o.skipped}")
        out[name] = [_norm(s) for s in db.trace]

    run("auto_first_pass", NOW)
    run("auto_second_pass_same_time", NOW + dt.timedelta(minutes=5))
    plan.clear()  # the failures heal; the changed account is computed again
    run("auto_before_retry", NOW + dt.timedelta(hours=5))
    run("auto_after_retry", NOW + dt.timedelta(hours=6, minutes=1))
    rows = c.execute(f"SELECT account_id, period_start, status, error_code, attempts FROM {RUNS[kind]} ORDER BY account_id, period_start").fetchall()
    out["auto_runs_final"] = [" ".join(str(x) for x in tuple(r)) for r in rows]
    bills = c.execute(f"SELECT account_id, period_start, state, origin, number, {QTY[kind]}, total FROM {TABLE[kind]} ORDER BY account_id, period_start, revision").fetchall()
    out["auto_bills_final"] = [" ".join(str(x) for x in tuple(r)) for r in bills]
    return out


def _scenario_retention(c: sqlite3.Connection, kind: str, data_dir: Path) -> dict[str, list[str]]:
    account(c, kind, "acc-r")
    bill_row(c, kind, "d-old", "acc-r", NOV, updated="2026-10-01T00:00:00Z")
    bill_row(c, kind, "d-new", "acc-r", per.Period(dt.date(2026, 12, 1), dt.date(2027, 1, 1)), updated="2026-11-30T00:00:00Z")
    for i, state in enumerate(("issued", "sent", "paid", "void")):
        bill_row(c, kind, f"b-{state}", f"acc-{state}", SEP, state=state, number=f"2026-09-{CN}/{i + 1}", updated="2019-01-01T00:00:00Z",
                 pdf_path=f"energy/bills/2026/b-{state}.pdf")
    bill_row(c, kind, "b-boundary", "acc-b", per.Period(dt.date(2026, 12, 1), dt.date(2027, 1, 1)), state="paid", number=f"2026-12-{CN}",
             pdf_path="energy/bills/2026/b-boundary.pdf")
    for name in ("b-issued", "b-sent", "b-paid", "b-void", "b-boundary"):
        f = data_dir / "energy" / "bills" / "2026" / f"{name}.pdf"
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(b"%PDF")
    out: dict[str, list[str]] = {}
    db = TraceDB(c)

    def run(name: str, now: dt.datetime) -> None:
        db.trace = []
        r = eb.retention(db, data_dir, now=now) if kind == "energy" else wb.retention(db, now=now)
        db.trace.append(f"-- result {sorted(r.items())}")
        out[name] = [_norm(s) for s in db.trace]

    run("retention_drafts", NOW)
    run("retention_nothing_due", NOW + dt.timedelta(days=1))
    run("retention_years", dt.datetime(2034, 1, 1, tzinfo=UTC))
    out["retention_left"] = sorted(r[0] for r in c.execute(f"SELECT id FROM {TABLE[kind]}"))
    out["retention_pdfs_left"] = sorted(p.name for p in (data_dir / "energy" / "bills").rglob("*.pdf"))
    return out


def _golden(kind: str, got: dict[str, list[str]], section: str) -> None:
    golden = json.loads(GOLDEN.read_text(encoding="utf-8")) if GOLDEN.exists() else {}
    key = f"{section}:{kind}"
    if os.environ.get("SW_BILL_LEDGER_GOLDEN_WRITE") == "1":
        golden[key] = got
        GOLDEN.parent.mkdir(parents=True, exist_ok=True)
        GOLDEN.write_text(json.dumps(golden, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
        pytest.skip("golden written")
    assert key in golden, "golden trace missing"
    for name, stmts in golden[key].items():
        assert got.get(name) == stmts, name
    assert set(got) == set(golden[key])


@pytest.mark.parametrize("kind", ["energy", "water"])
def test_draft_statements_text_order_audit_and_errors_are_unchanged(conn, kind):
    _golden(kind, _scenario_drafts(conn, kind), "drafts")


@pytest.mark.parametrize("kind", ["energy", "water"])
def test_automatic_generation_statements_labels_logs_and_outcomes_are_unchanged(conn, kind, monkeypatch):
    _golden(kind, _scenario_auto(conn, kind, monkeypatch), "auto")


@pytest.mark.parametrize("kind", ["energy", "water"])
def test_retention_statements_and_what_it_keeps_are_unchanged(conn, kind, tmp_path):
    _golden(kind, _scenario_retention(conn, kind, tmp_path / "data"), "retention")


# ---------------------------------------------------------------- money rules on a real database

@pytest.fixture()
def real(migrated, tmp_path, pinned):
    """A real Database (foreign keys on) with one customer, one tariff of each kind and accounts made by `real_account`."""
    path = tmp_path / "real.db"
    with closing(_copy(migrated, path)) as c:
        c.execute("INSERT INTO energy_customers(id, customer_number, name, created_at, updated_at) VALUES ('cust-1', ?, 'דני', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')", (CN,))
        for t in TARIFFS.values():
            c.execute(f"INSERT INTO {t}(id, name, created_at, updated_at) VALUES ('tariff-1', 'כללי', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')")
    db = Database(path)
    yield db, SimpleNamespace(data_dir=tmp_path / "data", db_path=path)


def real_account(db: Database, kind: str, aid: str, auto_mode: str = "draft") -> None:
    with db.connection() as c:
        account(c, kind, aid, auto_mode=auto_mode)


def counts(db: Database, kind: str) -> tuple[int, int]:
    with db.connection(mode="read") as c:
        return (c.execute(f"SELECT COUNT(*) FROM {TABLE[kind]}").fetchone()[0], c.execute(f"SELECT COUNT(*) FROM {RUNS[kind]}").fetchone()[0])


def _fixed_compute(monkeypatch, kind: str, total: str, qty: str) -> None:
    m = KINDS[kind]

    def compute(rconn, provider, acc, p, *, origin="manual", now=None, **_k):
        return comp(total, qty)
    monkeypatch.setattr(m, "compute", compute)
    if kind == "energy":
        monkeypatch.setattr(eb, "get_provider", lambda conn, settings=None: "provider")
    else:
        monkeypatch.setattr(wb, "provider_for", lambda conn, settings: "provider")


@pytest.mark.parametrize("kind", ["energy", "water"])
def test_auto_issue_seals_the_computed_amounts_exactly_and_numbers_in_the_shared_space(real, kind, monkeypatch):
    db, settings = real
    qty = "776.20" if kind == "energy" else "36.125"
    _fixed_compute(monkeypatch, kind, "497.33", qty)
    real_account(db, kind, "acc-1", auto_mode="issue")
    out = _auto(kind, db, NOW, settings)
    assert (out.created, out.issued, out.failed, out.skipped) == (3, 3, 0, 0)
    with db.connection(mode="read") as c:
        rows = c.execute(f"SELECT period_start, number, state, {QTY[kind]}, total, snapshot_json, snapshot_sha256 FROM {TABLE[kind]} ORDER BY period_start").fetchall()
        audits = [r[0] for r in c.execute("SELECT action FROM audit_log ORDER BY rowid")]
    assert [r["period_start"] for r in rows] == ["2026-09-01", "2026-10-01", "2026-11-01"]
    assert [r["number"] for r in rows] == [f"2026-09-{CN}", f"2026-10-{CN}", f"2026-11-{CN}"]
    for r in rows:
        assert (r["state"], r[QTY[kind]], r["total"]) == ("issued", qty, "497.33")  # the computed strings, never re-rounded
        s = json.loads(r["snapshot_json"])
        assert s["bill"]["issued_by"] == {"kind": "system"} and r["snapshot_sha256"] == eb.sha256_of(s)
        assert s["bill"]["issue_date"] == "2026-12-02" and s["bill"]["due_date"] == "2027-01-01"
    p = PREFIX[kind]
    assert audits == [f"{p}bill.auto_draft", f"{p}bill.auto_issue"] * 3


def test_auto_issued_electricity_and_water_bills_of_one_customer_and_month_never_share_a_number(real, monkeypatch):
    db, settings = real
    for kind in ("energy", "water"):
        _fixed_compute(monkeypatch, kind, "10.00", "1.000")
        real_account(db, kind, f"acc-{kind}", auto_mode="issue")
    eb.auto_generate(db, now=NOW, settings=settings)
    wb.auto_generate(db, settings, now=NOW)
    with db.connection(mode="read") as c:
        e = [r[0] for r in c.execute("SELECT number FROM energy_bills ORDER BY period_start")]
        w = [r[0] for r in c.execute("SELECT number FROM water_bills ORDER BY period_start")]
        ledger = [r[0] for r in c.execute("SELECT number FROM energy_bill_numbers")]
    assert e == [f"2026-09-{CN}", f"2026-10-{CN}", f"2026-11-{CN}"]
    assert w == [f"2026-09-{CN}/2", f"2026-10-{CN}/2", f"2026-11-{CN}/2"]
    assert len(ledger) == len(set(ledger)) == 6


@pytest.mark.parametrize("kind", ["energy", "water"])
def test_rerun_restart_and_janitor_never_generate_twice(real, kind, monkeypatch):
    db, settings = real
    _fixed_compute(monkeypatch, kind, "55.55", "5.000")
    real_account(db, kind, "acc-1")
    assert _auto(kind, db, NOW, settings).created == 3
    assert counts(db, kind) == (3, 3)
    # the same pass again, a pass after the retry window, and the janitor right after a restart (its throttles empty)
    assert _auto(kind, db, NOW, settings).created == 0
    assert _auto(kind, db, NOW + dt.timedelta(days=1), settings).created == 0
    eb._LAST_AUTO.clear()
    eb._LAST_RETENTION.clear()
    wb.reset()
    monkeypatch.setattr(eb, "now_utc", lambda: NOW + dt.timedelta(hours=1))
    monkeypatch.setattr(wb, "now_utc", lambda: NOW + dt.timedelta(hours=1))
    out = eb.janitor(db, settings) if kind == "energy" else wb.janitor(db, settings)
    assert out is not None and (out.created, out.skipped, out.failed) == (0, 0, 0)
    assert counts(db, kind) == (3, 3)
    # a draft deleted by a person is never generated again (its run row stays)
    with db.connection() as c:
        bid, rv = c.execute(f"SELECT id, row_version FROM {TABLE[kind]} WHERE period_start = '2026-09-01'").fetchone()
        KINDS[kind].delete_draft(c, bid, rv, ACTOR, "rq")
    assert _auto(kind, db, NOW + dt.timedelta(days=2), settings).created == 0
    assert counts(db, kind) == (2, 3)


@pytest.mark.parametrize("kind", ["energy", "water"])
def test_a_crash_after_the_draft_write_leaves_nothing_and_concurrent_passes_make_one_draft(real, kind, monkeypatch):
    db, settings = real
    _fixed_compute(monkeypatch, kind, "55.55", "5.000")
    real_account(db, kind, "acc-1")
    m = KINDS[kind]
    real_insert = m.insert_draft

    def crash(*a, **k):
        real_insert(*a, **k)
        raise RuntimeError("process killed")

    monkeypatch.setattr(m, "insert_draft", crash)
    with pytest.raises(RuntimeError):
        _auto(kind, db, NOW, settings)
    assert counts(db, kind) == (0, 0)
    monkeypatch.setattr(m, "insert_draft", real_insert)
    outs: list = []
    threads = [threading.Thread(target=lambda: outs.append(_auto(kind, db, NOW, settings))) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sum(o.created for o in outs) == 3
    assert counts(db, kind) == (3, 3)


@pytest.mark.parametrize("kind", ["energy", "water"])
@pytest.mark.parametrize("state", ["issued", "sent", "paid", "void"])
def test_retention_never_deletes_a_document_inside_the_retention_years(real, kind, state):
    db, settings = real
    real_account(db, kind, "acc-1")
    with db.connection() as c:
        # an old last change does not matter for a document: only the end of its period against energy.bill_retention_years (7)
        bill_row(c, kind, "doc", "acc-1", SEP, state=state, number=f"2026-09-{CN}", updated="2019-01-01T00:00:00Z")
        c.execute("INSERT INTO energy_bill_numbers(number, number_base, number_seq, revision, bill_id, assigned_at) VALUES (?, ?, 1, 1, 'doc', '2026-10-02T00:00:00Z')",
                  (f"2026-09-{CN}", f"2026-09-{CN}"))
        bill_row(c, kind, "old-draft", "acc-1", OCT, updated="2026-10-01T00:00:00Z")

    def run(now: dt.datetime) -> dict[str, int]:
        return eb.retention(db, settings.data_dir, now=now) if kind == "energy" else wb.retention(db, now=now)

    def ids() -> list[str]:
        with db.connection(mode="read") as c:
            return sorted(r[0] for r in c.execute(f"SELECT id FROM {TABLE[kind]}"))

    # 31 days after the draft's last change: the draft goes, the document whose last change is years old stays
    assert run(dt.datetime(2026, 11, 1, 0, 0, 1, tzinfo=UTC)) == {"drafts": 1, "bills": 0}
    assert ids() == ["doc"]
    # the bill cut is the first of the month seven years back (UTC): on 2033-10-31 it is 2026-10-01 = the period's end -> kept
    assert run(dt.datetime(2033, 10, 31, 23, 59, 59, tzinfo=UTC)) == {"drafts": 0, "bills": 0}
    assert ids() == ["doc"]
    # one second later the cut is 2026-11-01: the period ended before it - only now does the document go
    assert run(dt.datetime(2033, 11, 1, 0, 0, 0, tzinfo=UTC)) == {"drafts": 0, "bills": 1}
    assert ids() == []
    with db.connection(mode="read") as c:  # the number stays used for ever
        assert c.execute("SELECT bill_id FROM energy_bill_numbers WHERE number = ?", (f"2026-09-{CN}",)).fetchone()[0] == "doc"


@pytest.mark.parametrize("kind", ["energy", "water"])
def test_draft_retention_window_is_exact_and_never_touches_issued_bills(real, kind):
    db, settings = real
    real_account(db, kind, "acc-1")
    with db.connection() as c:
        bill_row(c, kind, "draft", "acc-1", OCT, updated="2026-10-02T09:00:00Z")
        bill_row(c, kind, "issued", "acc-1", SEP, state="issued", number=f"2026-09-{CN}", updated="2020-01-01T00:00:00Z")

    def run(now: dt.datetime) -> dict[str, int]:
        return eb.retention(db, settings.data_dir, now=now) if kind == "energy" else wb.retention(db, now=now)

    exactly_30_days = dt.datetime(2026, 11, 1, 9, 0, 0, tzinfo=UTC)
    assert run(exactly_30_days) == {"drafts": 0, "bills": 0}  # updated_at == the cut: not older, kept
    assert run(exactly_30_days + dt.timedelta(seconds=1)) == {"drafts": 1, "bills": 0}
    with db.connection(mode="read") as c:
        assert [tuple(r) for r in c.execute(f"SELECT id, state FROM {TABLE[kind]}")] == [("issued", "issued")]
        assert c.execute("SELECT COUNT(*) FROM audit_log WHERE action = ?", (f"{PREFIX[kind]}bill.retention",)).fetchone()[0] == 1


@pytest.mark.parametrize("kind", ["energy", "water"])
def test_retention_keeps_the_number_ledger_and_run_rows_so_nothing_is_reused_or_generated_again(real, kind, monkeypatch):
    db, settings = real
    _fixed_compute(monkeypatch, kind, "10.00", "1.000")
    real_account(db, kind, "acc-1", auto_mode="issue")
    assert _auto(kind, db, NOW, settings).issued == 3  # September, October, November 2026 sealed

    def run(now: dt.datetime) -> dict[str, int]:
        return eb.retention(db, settings.data_dir, now=now) if kind == "energy" else wb.retention(db, now=now)

    assert run(dt.datetime(2033, 10, 31, 12, tzinfo=UTC)) == {"drafts": 0, "bills": 0}  # cut 2026-10-01: September ends on it
    assert run(dt.datetime(2033, 11, 1, 12, tzinfo=UTC)) == {"drafts": 0, "bills": 1}   # cut 2026-11-01: September goes
    with db.connection(mode="read") as c:
        assert [r[0] for r in c.execute(f"SELECT period_start FROM {TABLE[kind]} ORDER BY period_start")] == ["2026-10-01", "2026-11-01"]
        assert c.execute("SELECT COUNT(*) FROM energy_bill_numbers").fetchone()[0] == 3
        assert c.execute(f"SELECT COUNT(*) FROM {RUNS[kind]}").fetchone()[0] == 3
    # a pass years later generates the newer periods, never September again, and never its number
    with db.connection() as c:
        c.execute(f"UPDATE {ACCOUNTS[kind]} SET auto_mode = 'draft'")
    out = _auto(kind, db, dt.datetime(2027, 3, 2, 9, tzinfo=UTC), settings)
    assert (out.created, out.issued) == (3, 0)  # December, January, February
    with db.connection(mode="read") as c:
        assert c.execute(f"SELECT COUNT(*) FROM {TABLE[kind]} WHERE period_start = '2026-09-01'").fetchone()[0] == 0
        assert c.execute(f"SELECT status FROM {RUNS[kind]} WHERE period_start = '2026-09-01'").fetchone()[0] == "issued"
