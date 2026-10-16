"""LEASE-BUILD slice L1 (CR-WISKEY-LEASE-REVOCATION-EVENT section 2): the capture lease ledger. Negative first - N13 (ledger
invariants enforced by the database and the issuing transaction), the off-by-default route, the lifetime cap, the fresh-decision
rule. Fakes only (lease_fixtures.py)."""
from __future__ import annotations

import re
import sqlite3
from pathlib import Path

import pytest

from lease_fixtures import LeaseClock, lease_world, principal  # noqa: F401  (fixture)

from smplwise.db import Database, set_setting
from smplwise.errors import ApiError
from smplwise.services import capture_lease as cl
from smplwise.services import lease_events as le

BACKEND = Path(__file__).resolve().parents[1]


def _insert(conn: sqlite3.Connection, ref: str, *, actor: str = "a", station: str = "s", reader: int = 0, issued: str = "2026-10-16T12:00:00Z",
            expires: str = "2026-10-16T12:02:00Z", state: str = "issued") -> None:
    conn.execute(
        """INSERT INTO capture_leases(id, actor_user_id, actor_source, station_id, reader_id, person_id, permission_revision, stream_id, sequence_at_issue,
                                      start_request_id, lease_issued_at, lease_expires_at, state, state_at, created_at)
           VALUES (?, ?, 'ha', ?, ?, 'p', 1, 'x', 1, ?, ?, ?, ?, 'now', 'now')""",
        (ref, actor, station, reader, "req-" + ref, issued, expires, state),
    )


def test_n13_database_enforces_one_live_lease_per_receiver_and_per_actor_and_the_lifetime_cap(settings):
    db = Database(settings.db_path)
    db.migrate()
    with db.connection() as conn:
        _insert(conn, "l1", actor="a", station="s", reader=0)
        with pytest.raises(sqlite3.IntegrityError, match="station_id, capture_leases.reader_id"):
            _insert(conn, "l2", actor="b", station="s", reader=0)  # same receiver, other actor
        with pytest.raises(sqlite3.IntegrityError, match="actor_user_id"):
            _insert(conn, "l3", actor="a", station="t", reader=1)  # same actor, other receiver
        _insert(conn, "l4", actor="b", station="s", reader=1)  # same station, another reader: allowed
        # a terminal row frees both slots (partial indexes)
        conn.execute("UPDATE capture_leases SET state = 'revoked' WHERE id = 'l1'")
        _insert(conn, "l5", actor="a", station="s", reader=0)
        for bad in (("2026-10-16T12:00:00Z", "2026-10-16T12:02:01Z"), ("2026-10-16T12:00:00Z", "2026-10-16T12:00:00Z"),
                    ("2026-10-16T12:00:00Z", "2026-10-16T11:59:00Z"), ("2026-10-16 12:00:00", "2026-10-16T12:01:00Z"), ("garbage", "2026-10-16T12:01:00Z")):
            with pytest.raises(sqlite3.IntegrityError, match="CHECK"):
                _insert(conn, "bad", actor="z", station="z", issued=bad[0], expires=bad[1])
        with pytest.raises(sqlite3.IntegrityError, match="CHECK"):
            _insert(conn, "bad2", actor="y", station="y", reader=9)
        with pytest.raises(sqlite3.IntegrityError, match="CHECK"):
            _insert(conn, "bad3", actor="x", station="x", state="paused")
        with pytest.raises(sqlite3.IntegrityError, match="CHECK"):
            conn.execute("INSERT INTO capture_lease_stream(stream_id, next_sequence, created_at, reason) VALUES ('NOT-HEX', 2, 'now', 'first')")


def test_n13_issue_refuses_a_second_start_on_the_same_receiver_or_actor_and_a_fourth_live_lease(lease_world):
    w = lease_world
    w.issue(actor="dev-a", station="entry-a", reader=0)
    with pytest.raises(ApiError) as e:
        w.issue(actor="dev-b", station="entry-a", reader=0)
    assert e.value.code == "capture_receiver_busy" and e.value.status == 409
    with pytest.raises(ApiError) as e:
        w.issue(actor="dev-a", station="entry-b", reader=0)
    assert e.value.code == "intercom_capture_user_busy"
    w.issue(actor="dev-b", station="entry-b")
    w.issue(actor="dev-c", station="entry-c")
    with pytest.raises(ApiError) as e:
        w.issue(actor="dev-d", station="entry-d")
    assert e.value.code == "intercom_capture_limit", "the ceiling of 3 is refused before anything is signed"
    assert len([r for r in w.rows() if r["state"] in cl.LIVE]) == 3
    assert not [c for c in w.bridge.calls if "dto" in c and c["dto"].params.get("lease", {}).get("person_ref") and c["dto"].actor_id == "dev-d"]


def test_lease_length_is_120_by_default_and_the_setting_only_lowers_it(lease_world):
    w = lease_world
    lease = w.issue()
    assert lease.seconds == 120 and cl.LEASE_MAX_S == 120
    assert cl.parse_iso(lease.expires_at) - cl.parse_iso(lease.issued_at) == __import__("datetime").timedelta(seconds=120)
    with w.db.connection() as conn:
        for raw, want in (("60", 60), ("90", 90), ("120", 120), ("121", 120), ("600", 120), ("-5", 120), ("abc", 120)):
            set_setting(conn, cl.SECONDS_KEY, raw)
            assert cl.lease_seconds(conn) == want, raw


def test_route_is_off_by_default_and_cannot_be_on_without_a_bridge_that_offers_it(settings):
    db = Database(settings.db_path)
    db.migrate()
    assert cl.MIN_BRIDGE_FOR_CAPTURE_LEASE is None, "no bridge offers lease_event in this build: the route can never be switched on"
    with db.connection() as conn:
        assert cl.mode(conn) == "off" and not cl.route_on(conn)
        set_setting(conn, cl.FLAG_KEY, "on")
        set_setting(conn, "bridge.integration_version", "99.0.0")
        assert cl.mode(conn) == "on" and not cl.route_on(conn), "on in the database is still off without MIN_BRIDGE_FOR_CAPTURE_LEASE"
        with pytest.raises(ApiError) as e:
            cl.ensure_issuable(conn)
        assert e.value.status == 503 and e.value.code == "capture_lease_unavailable"
        for garbage in ("ON", "true", "1", " on"):
            set_setting(conn, cl.FLAG_KEY, garbage)
            assert cl.mode(conn) == "off"


def test_issue_refuses_when_the_revision_or_an_epoch_moved_after_the_decision(lease_world):
    w = lease_world
    snap = cl.REG.snapshot("dev-a", "entry-a", "u1")
    with w.db.connection() as conn:
        rev = cl.permission_revision(conn)
    w.bump()  # a permission change between the decision and the insert
    with w.db.connection() as conn, pytest.raises(ApiError) as e:
        cl.issue(conn, principal=principal("dev-a"), station_id="entry-a", reader_id=0, person_id="u1", person_revision=4, binding_revision=None,
                 decision_revision=rev, start_request_id="r-1", snap=snap)
    assert e.value.code == "capture_lease_stale"
    snap = cl.REG.snapshot("dev-a", "entry-a", "u1")
    with w.db.connection() as conn:
        rev = cl.permission_revision(conn)
    cl.on_authority_change("session_ended", user_ids=["dev-a"])  # the actor's session ended meanwhile
    with w.db.connection() as conn, pytest.raises(ApiError) as e:
        cl.issue(conn, principal=principal("dev-a"), station_id="entry-a", reader_id=0, person_id="u1", person_revision=4, binding_revision=None,
                 decision_revision=rev, start_request_id="r-2", snap=snap)
    assert e.value.code == "capture_lease_stale"
    with w.db.connection() as conn, pytest.raises(ApiError) as e:  # a principal that is not the decision's actor
        cl.issue(conn, principal=principal("dev-x"), station_id="entry-a", reader_id=0, person_id="u1", person_revision=4, binding_revision=None,
                 decision_revision=cl.permission_revision(conn), start_request_id="r-3", snap=cl.REG.snapshot("dev-a", "entry-a", "u1"))
    assert e.value.status == 403
    assert not [r for r in w.rows() if r["state"] in cl.LIVE]


def test_degraded_or_untrusted_clock_refuses_issue_before_anything_is_signed(lease_world):
    w = lease_world
    sent = len(w.bridge.calls)
    cl.GUARDS.degraded = True
    with pytest.raises(ApiError) as e:
        w.issue()
    assert e.value.code == "capture_lease_unavailable"
    cl.GUARDS.degraded = False
    cl.GUARDS.clock_untrusted = True
    with pytest.raises(ApiError) as e:
        w.issue()
    assert e.value.code == "capture_lease_clock_invalid" and e.value.user_message == cl.CLOCK_TEXT
    assert len(w.bridge.calls) == sent and not w.rows()


def test_terminal_states_are_final_and_expiry_needs_no_message(lease_world):
    w = lease_world
    lease = w.issue()
    assert cl.finish(w.db, lease.lease_ref, "destroyed", "cancelled")
    w.host.leases.pop(lease.lease_ref)  # the host cancelled it too (else the heartbeat's F7 rule would revoke everything - tested elsewhere)
    assert not cl.finish(w.db, lease.lease_ref, "expired", "expired"), "a terminal row never moves again"
    assert w.row(lease.lease_ref)["state"] == "destroyed"
    with pytest.raises(ValueError):
        cl.finish(w.db, lease.lease_ref, "active", "x")
    other = w.issue(actor="dev-b", station="entry-b")
    calls = len(w.bridge.calls)
    w.run(121, tick=1.0)
    assert w.row(other.lease_ref)["state"] == "expired"
    assert not [c for c in w.bridge.calls[calls:] if "dto" in c and c["dto"].action == "lease_revoke"], "expiry sends nothing"


def test_retention_prunes_terminal_rows_after_seven_days_and_never_the_stream(lease_world):
    w = lease_world
    lease = w.issue()
    cl.finish(w.db, lease.lease_ref, "destroyed", "cancelled")
    w.clock.advance(6 * 86400)
    with w.db.connection() as conn:
        cl.prune(conn)
    assert w.rows()
    w.clock.advance(2 * 86400)
    with w.db.write_aside() as conn:
        conn.execute("UPDATE capture_leases SET state_at = '2026-10-16T12:00:00Z'")
        assert cl.prune(conn) == 1
        assert conn.execute("SELECT COUNT(*) FROM capture_lease_stream").fetchone()[0] >= 1


def test_n13_no_route_or_job_creates_a_ledger_row_except_the_capture_start():
    """Grep test: `INSERT INTO capture_leases` exists exactly once in the product code (capture_lease.issue), and `issue(` of the
    ledger is called only from the capture start route."""
    src = BACKEND / "smplwise"
    inserts = [p for p in src.rglob("*.py") if "INSERT INTO capture_leases" in p.read_text(encoding="utf-8")]
    assert [p.name for p in inserts] == ["capture_lease.py"]
    callers = [p for p in src.rglob("*.py") if re.search(r"capture_lease\.issue\(", p.read_text(encoding="utf-8"))]
    assert [p.name for p in callers] == ["access_control.py"]
    text = (src / "routers" / "access_control.py").read_text(encoding="utf-8")
    assert text.count("capture_lease.issue(") == 1 and "def _lease_start(" in text


def test_ids_only_in_the_ledger_and_its_audit(lease_world):
    w = lease_world
    w.issue()
    cols = {r[1] for r in sqlite3.connect(w.settings.db_path).execute("PRAGMA table_info(capture_leases)").fetchall()}
    for forbidden in ("name", "card", "mask", "address", "host", "serial", "mac", "nonce", "sig", "body"):
        assert not [c for c in cols if forbidden in c], forbidden
    for row in w.audit():
        text = (row["details_json"] or "") + (row["reason"] or "")
        assert '"nonce"' not in text and '"sig"' not in text and "signed_message_json" not in text
