"""WISKEY-RELAYEXPORT-2320: the internal, verified, numbered exporter of the WisKey relay map snapshot (Arx -> Native).

Agreed direction with the WisKey Windows team (31.10, handoff e105e3268): Arx is the source of the counters. The station revision
(`wiskey_relay_map_stations.revision`) is a station-level compare-and-set for snapshot consistency only; the row revision
(`wiskey_relay_map.revision`) is the value that goes into StationGrant.mapping_revision and the Native startup/C07 projection.
Native verifies and projects; it never makes a competing counter.

The exporter writes a sealed, numbered record of the FULL map (inactive tombstones too, with their physical relay, which the
approval screen hides) with a canonical-JSON sha256 content digest. It never writes the map, never moves a counter, never deletes a
tombstone and never rewrites a history tuple (intents / leases / UNKNOWN). Nothing is sent to WisKey: the transport is a later joint
decision. Read is admin-only (system.configure).

Part A of the slice (the contract precision of the approval PUT) is pinned at the end of this file.

FAKES ONLY: a served WisKey copy from FakeWisKeyFeed; no Home Assistant, no WisKey, no station, no door."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from typing import Any

import pytest
from conftest import as_user, bind
from fake_trusted_bridge import FakeWisKeyFeed, station
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso
from smplwise.main import create_app
from smplwise.services import backup, intercom_sync
from smplwise.services import wiskey_feature_exec as fx
from smplwise.services import wiskey_relay_map as rm
from smplwise.services import wiskey_relay_map_export as rmx

API = "/api/v1"
URL = f"{API}/wiskey/relay-map"
EXPORT_URL = f"{URL}/export"
ST = "01JRELAYEXPORTSTATIONENTRY0A"  # synthetic opaque config entry ids
ONE = "01JRELAYEXPORTSTATIONENTRY0B"
COUNTER_TABLES = ("wiskey_relay_map", "wiskey_relay_map_stations")


@pytest.fixture(autouse=True)
def _clean():
    intercom_sync.SYNC.reset()
    yield
    intercom_sync.SYNC.reset()


class World:
    def __init__(self, settings: Any, monkeypatch: Any) -> None:
        self.feed = FakeWisKeyFeed([station(ST, "כניסה ראשית", relays=[1, 2]), station(ONE, "דלת צד", relays=[1])]).install(monkeypatch)
        self.settings = settings
        self.c = TestClient(create_app(settings))
        self.db = Database(settings.db_path)
        self.c.get(f"{API}/me", headers=as_user("joni"))

    def save(self, station_id: str, rows: list[tuple[int, int | None]], revision: int, user: str = "joni") -> Any:
        body = {"expected_revision": revision, "rows": [{"api_relay": a, "physical_relay": p} for a, p in rows], "confirmed": True}
        return self.c.put(f"{URL}/{station_id}", json=body, headers=as_user(user))

    def dump(self, tables: tuple[str, ...] = COUNTER_TABLES) -> dict[str, list[tuple[Any, ...]]]:
        with self.db.connection() as conn:
            return {t: [tuple(r) for r in conn.execute(f"SELECT * FROM {t} ORDER BY 1, 2")] for t in tables}

    def history_tables(self) -> tuple[str, ...]:
        """Every wiskey_* table except the map, its station revisions and the export log: intents, leases, fences, registry."""
        with self.db.connection() as conn:
            names = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'wiskey_%' ORDER BY name")]
        return tuple(n for n in names if n not in (*COUNTER_TABLES, "wiskey_relay_map_exports"))

    def export(self, by: str = "dev-joni") -> rmx.ExportRecord:
        with self.db.connection() as conn:
            return rmx.export(conn, by=by)

    def ack(self, seq: int, digest: str, by: str = "dev-joni") -> rmx.ExportRecord:
        with self.db.connection() as conn:
            return rmx.ack(conn, seq=seq, content_digest=digest, by=by)

    def rollback(self, to_seq: int, by: str = "dev-joni") -> rmx.ExportRecord:
        with self.db.connection() as conn:
            return rmx.rollback(conn, to_seq=to_seq, by=by)

    def record(self, seq: int) -> rmx.ExportRecord:
        with self.db.connection() as conn:
            return rmx.get(conn, seq)


@pytest.fixture()
def w(settings, monkeypatch) -> World:
    return World(settings, monkeypatch)


def _canonical_sha256(obj: Any) -> str:
    return "sha256:" + hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()


def _st(snapshot: dict[str, Any], station_id: str) -> dict[str, Any]:
    return next(s for s in snapshot["stations"] if s["station_id"] == station_id)


# ================================================================ the snapshot and its digest

def test_the_snapshot_carries_every_fact_native_needs_per_station(w):
    assert w.save(ST, [(1, 2), (2, 1)], 0).status_code == 200
    rec = w.export()
    s = _st(rec.snapshot, ST)
    assert s["station_revision"] == 1 and s["approved_by"] == "dev-joni" and s["approved_at"]
    assert [(r["api_relay"], r["physical_relay"], r["active"], r["row_revision"]) for r in s["rows"]] == [(1, 2, True, 1), (2, 1, True, 1)]
    assert all(r["confirmed_by"] == "dev-joni" and r["updated_at"] for r in s["rows"])
    assert s["unmapped_api_relays"] == []
    assert rec.snapshot["schema"] == rmx.SCHEMA and rec.snapshot["coverage"] == "full"
    assert rec.snapshot["source"]["system"] == "smplwise_arx"
    assert rec.seq == 1 and rec.kind == "export" and rec.rollback_of is None and rec.exported_by == "dev-joni" and rec.exported_at


def test_the_content_digest_is_sha256_of_the_canonical_json_and_is_stable(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    with w.db.connection() as conn:
        a, b = rmx.snapshot(conn), rmx.snapshot(conn)
    assert rmx.digest(a) == rmx.digest(b) == _canonical_sha256(a)
    assert rmx.canonical_json(a) == json.dumps(a, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    rec = w.export()
    assert rec.content_digest == rmx.digest(a) and rmx.digest(rec.snapshot) == rec.content_digest
    reordered = json.loads(json.dumps(a, sort_keys=False))
    reordered["stations"][0] = dict(reversed(list(reordered["stations"][0].items())))
    assert rmx.digest(reordered) == rec.content_digest, "key order does not change the digest"


def test_the_digest_changes_with_any_fact(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    d1 = w.export().content_digest
    w.save(ST, [(1, 1), (2, None)], 1)
    assert w.export().content_digest != d1


def test_an_inactive_tombstone_is_exported_with_its_physical_relay_although_the_screen_hides_it(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    w.save(ST, [(1, 1), (2, None)], 1)
    screen = next(s for s in w.c.get(URL, headers=as_user("joni")).json()["stations"] if s["id"] == ST)
    assert screen["rows"][1]["physical_relay"] is None and screen["rows"][1]["active"] is False and screen["rows"][1]["row_revision"] == 2
    rows = _st(w.export().snapshot, ST)["rows"]
    assert rows[1] == {**rows[1], "api_relay": 2, "physical_relay": 2, "active": False, "row_revision": 2}
    assert rows[0]["row_revision"] == 1, "the unchanged row kept its row revision"


def test_full_coverage_names_the_api_relays_without_a_row_and_never_invents_one(w):
    w.save(ONE, [(1, 1), (2, None)], 0)
    rec = w.export()
    s = _st(rec.snapshot, ONE)
    assert [r["api_relay"] for r in s["rows"]] == [1] and s["unmapped_api_relays"] == [2]
    assert rec.snapshot["row_count"] == 1 and rec.snapshot["tombstone_count"] == 0
    assert [r[:5] for r in w.dump()["wiskey_relay_map"]] == [(ONE, 1, 1, 1, 1)]


def test_rows_without_a_station_approval_are_still_exported_with_station_revision_zero(w):
    with w.db.connection() as conn:
        fx.set_relay_map(conn, station_id=ST, api_relay=1, physical_relay=1, confirmed_by="dev-joni", expected_revision=0)
    s = _st(w.export().snapshot, ST)
    assert s["station_revision"] == 0 and s["approved_by"] is None and [r["row_revision"] for r in s["rows"]] == [1]


def test_an_empty_map_exports_an_empty_full_snapshot(w):
    rec = w.export()
    assert rec.snapshot["stations"] == [] and rec.snapshot["row_count"] == 0 and rec.seq == 1


# ================================================================ no counter ever moves on read / export / ack / rollback

def test_read_export_ack_and_rollback_never_move_a_counter_or_call_the_approval(w, monkeypatch):
    w.save(ST, [(1, 1), (2, 2)], 0)
    first = w.export()
    w.save(ST, [(1, 1), (2, None)], 1)
    counters = w.dump()
    calls: list[Any] = []
    monkeypatch.setattr(rm, "save", lambda *a, **k: calls.append(a) or (_ for _ in ()).throw(AssertionError("approval called")))
    monkeypatch.setattr(fx, "set_relay_map", lambda *a, **k: calls.append(a) or (_ for _ in ()).throw(AssertionError("map write called")))
    second = w.export()
    assert w.c.get(EXPORT_URL, headers=as_user("joni")).status_code == 200
    assert w.c.get(f"{EXPORT_URL}/{second.seq}", headers=as_user("joni")).status_code == 200
    w.ack(second.seq, second.content_digest)
    w.ack(second.seq, second.content_digest)
    w.rollback(first.seq)
    with w.db.connection() as conn:
        rmx.status(conn)
    assert calls == [] and w.dump() == counters


def test_exporting_the_same_snapshot_twice_returns_the_same_record_and_number(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    a = w.export()
    b = w.export()
    assert (b.seq, b.content_digest, b.created) == (a.seq, a.content_digest, False) and a.created is True


# ================================================================ sequence, ack, stale

def test_the_sequence_is_monotonic_and_never_reused(w):
    seqs = []
    w.save(ST, [(1, 1), (2, 2)], 0)
    seqs.append(w.export().seq)
    w.save(ST, [(1, 2), (2, 1)], 1)
    seqs.append(w.export().seq)
    seqs.append(w.rollback(seqs[0]).seq)
    w.save(ST, [(1, 2), (2, None)], 2)
    seqs.append(w.export().seq)
    assert seqs == [1, 2, 3, 4]
    with w.db.connection() as conn, pytest.raises(sqlite3.DatabaseError):
        conn.execute("DELETE FROM wiskey_relay_map_exports WHERE seq = 4")
    w.save(ST, [(1, 2), (2, 1)], 3)
    assert w.export().seq == 5


def test_an_ack_by_the_matching_digest_is_recorded_once(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    rec = w.export()
    acked = w.ack(rec.seq, rec.content_digest, by="dev-wiskey-relay")
    assert acked.state == "acked" and acked.acked_by == "dev-wiskey-relay" and acked.acked_at and acked.already_acked is False
    again = w.ack(rec.seq, rec.content_digest, by="dev-other")
    assert again.already_acked is True and again.acked_by == "dev-wiskey-relay" and again.acked_at == acked.acked_at


def test_an_ack_with_another_digest_or_seq_is_refused_and_writes_nothing(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    rec = w.export()
    with pytest.raises(rmx.RelayMapExportError) as e:
        w.ack(rec.seq, "sha256:" + "0" * 64)
    assert e.value.code == "export_digest_mismatch"
    with pytest.raises(rmx.RelayMapExportError) as e:
        w.ack(99, rec.content_digest)
    assert e.value.code == "export_not_found"
    assert w.record(rec.seq).state == "exported"


def test_an_export_goes_stale_when_a_newer_approval_exists(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    rec = w.export()
    w.ack(rec.seq, rec.content_digest)
    assert w.record(rec.seq).stale is False
    w.save(ST, [(1, 2), (2, 1)], 1)
    old = w.record(rec.seq)
    assert old.stale is True and old.state == "acked" and old.newer_approvals == [ST]
    with w.db.connection() as conn:
        st = rmx.status(conn)
    assert st["publication"] == "unpublished_changes" and st["latest"]["seq"] == rec.seq and st["latest"]["stale"] is True
    new = w.export()
    with w.db.connection() as conn:
        st = rmx.status(conn)
    assert st["publication"] == "published" and st["latest"]["seq"] == new.seq and st["latest"]["state"] == "exported"
    assert w.record(rec.seq).current is False and w.record(new.seq).current is True


def test_status_before_any_export_says_never_exported(w):
    with w.db.connection() as conn:
        st = rmx.status(conn)
    assert st["publication"] == "never_exported" and st["latest"] is None and st["live"]["content_digest"].startswith("sha256:")


def test_a_failed_export_writes_nothing_and_consumes_no_number(w, monkeypatch):
    w.save(ST, [(1, 1), (2, 2)], 0)
    monkeypatch.setattr(rmx, "verify", lambda snap, conn=None: (_ for _ in ()).throw(rmx.RelayMapExportError("export_unverified")))
    with pytest.raises(rmx.RelayMapExportError):
        w.export()
    monkeypatch.undo()
    monkeypatch.setattr(rmx, "_record", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("crash after the insert, before the commit")))
    with pytest.raises(RuntimeError):
        w.export()
    monkeypatch.undo()
    assert w.dump(("wiskey_relay_map_exports",)) == {"wiskey_relay_map_exports": []}
    assert w.export().seq == 1, "neither the refused nor the crashed export consumed a number"


def test_verify_refuses_a_snapshot_with_two_active_rows_on_one_physical_relay_or_partial_coverage(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    with w.db.connection() as conn:
        snap = rmx.snapshot(conn)
        bad = json.loads(json.dumps(snap))
        bad["stations"][0]["rows"][1]["physical_relay"] = 1
        with pytest.raises(rmx.RelayMapExportError) as e:
            rmx.verify(bad, conn)
        assert e.value.code == "export_unverified"
        partial = json.loads(json.dumps(snap))
        partial["stations"][0]["rows"].pop()
        partial["row_count"] = 1
        with pytest.raises(rmx.RelayMapExportError):
            rmx.verify(partial, conn)
        rmx.verify(snap, conn)


# ================================================================ rollback

def test_a_rollback_re_exports_the_previous_snapshot_as_a_new_number_without_touching_the_map(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    first = w.export()
    w.save(ST, [(1, 2), (2, 1)], 1)
    second = w.export()
    counters = w.dump()
    rb = w.rollback(first.seq)
    assert rb.seq == 3 and rb.kind == "rollback" and rb.rollback_of == first.seq
    assert rb.content_digest == first.content_digest and rb.snapshot == first.snapshot
    assert rb.stale is True, "the live map is newer than the published (rolled back) snapshot"
    assert w.dump() == counters
    assert w.record(first.seq).seq == 1 and w.record(second.seq).current is False and rb.current is True
    with w.db.connection() as conn:
        assert rmx.status(conn)["publication"] == "rolled_back"


def test_a_rollback_to_the_snapshot_already_published_or_to_an_unknown_number_is_refused(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    first = w.export()
    with pytest.raises(rmx.RelayMapExportError) as e:
        w.rollback(first.seq)
    assert e.value.code == "rollback_noop"
    with pytest.raises(rmx.RelayMapExportError) as e:
        w.rollback(7)
    assert e.value.code == "export_not_found"


def test_after_a_rollback_exporting_the_live_map_is_a_new_number_again(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    first = w.export()
    w.save(ST, [(1, 2), (2, 1)], 1)
    second = w.export()
    w.rollback(first.seq)
    again = w.export()
    assert again.seq == 4 and again.created is True and again.content_digest == second.content_digest and again.kind == "export"


def test_a_rollback_refuses_a_stored_snapshot_whose_digest_no_longer_matches(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    first = w.export()
    w.save(ST, [(1, 2), (2, 1)], 1)
    w.export()
    with w.db.connection() as conn:
        conn.execute("DROP TRIGGER wiskey_relay_map_exports_sealed")
        conn.execute("UPDATE wiskey_relay_map_exports SET snapshot_json = replace(snapshot_json, '\"row_revision\":1', '\"row_revision\":9') WHERE seq = 1")
    with pytest.raises(rmx.RelayMapExportError) as e:
        w.rollback(first.seq)
    assert e.value.code == "export_corrupt"


def test_the_sealed_export_content_cannot_be_rewritten(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    w.export()
    with w.db.connection() as conn, pytest.raises(sqlite3.DatabaseError):
        conn.execute("UPDATE wiskey_relay_map_exports SET content_digest = 'sha256:' || substr('0000' || substr(content_digest, 8), 1, 64) WHERE seq = 1")


# ================================================================ tombstones and history tuples

def test_a_tombstone_row_can_never_be_deleted(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    w.save(ST, [(1, 1), (2, None)], 1)
    with w.db.connection() as conn, pytest.raises(sqlite3.DatabaseError):
        conn.execute("DELETE FROM wiskey_relay_map WHERE station_id = ? AND api_relay = 2", (ST,))
    assert (ST, 2, 2, 2, 0) in [r[:5] for r in w.dump()["wiskey_relay_map"]]


def test_a_row_revision_never_goes_backwards(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    w.save(ST, [(1, 2), (2, 1)], 1)
    with w.db.connection() as conn, pytest.raises(sqlite3.DatabaseError):
        conn.execute("UPDATE wiskey_relay_map SET revision = 1 WHERE station_id = ? AND api_relay = 1", (ST,))


def test_a_map_change_and_its_export_never_rewrite_an_intent_lease_or_unknown_history_tuple(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    with w.db.connection() as conn:
        row = fx.relay_row_for_door(conn, ST, 2)
        params = json.dumps({"station_id": ST, "relay": row.physical_relay, "mapping_revision": row.revision}, sort_keys=True)
        conn.execute("INSERT INTO wiskey_feature_intents(request_id, operation_id, operation_binding_ref, feature, actor_kind, actor_ref, authority_ref, "
                     "authority_revision, scope_ref, parameter_reference, issued_at, request_expires_at, execution_expires_at, state, code, created_at) "
                     "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                     ("req_hist_1", "op_hist_1", "bind_x", "emergency_buttons", "human", "dev-joni", "auth_x", 1, "scope_x", params,
                      now_iso(), now_iso(), now_iso(), "unknown", None, now_iso()))
    tables = w.history_tables()
    assert "wiskey_feature_intents" in tables
    history = w.dump(tables)
    first = w.export()
    w.save(ST, [(1, 2), (2, 1)], 1)
    w.save(ST, [(1, 2), (2, None)], 2)
    second = w.export()
    w.ack(second.seq, second.content_digest)
    w.rollback(first.seq)
    assert w.dump(tables) == history
    assert json.loads(history["wiskey_feature_intents"][0][9])["mapping_revision"] == 1


# ================================================================ the admin read endpoint

def test_the_export_read_is_admin_only_and_writes_nothing(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    bind(w.c, w.settings, "dana", "site_admin", "installation", "*")
    bind(w.c, w.settings, "otto", "operator", "installation", "*")
    assert w.c.get(EXPORT_URL, headers=as_user("dana")).status_code == 403
    assert w.c.get(EXPORT_URL, headers=as_user("otto")).status_code == 403
    r = w.c.get(EXPORT_URL, headers=as_user("joni"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["publication"] == "never_exported" and body["exports"] == [] and body["live"]["snapshot"]["row_count"] == 2
    assert body["live"]["content_digest"] == rmx.digest(body["live"]["snapshot"])
    assert w.dump(("wiskey_relay_map_exports",)) == {"wiskey_relay_map_exports": []}, "reading exports nothing"


def test_the_export_read_lists_records_and_returns_one_with_its_snapshot(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    rec = w.export()
    w.ack(rec.seq, rec.content_digest)
    body = w.c.get(EXPORT_URL, headers=as_user("joni")).json()
    assert body["publication"] == "published" and [e["seq"] for e in body["exports"]] == [1] and "snapshot" not in body["exports"][0]
    assert body["exports"][0]["state"] == "acked" and body["exports"][0]["content_digest"] == rec.content_digest
    one = w.c.get(f"{EXPORT_URL}/{rec.seq}", headers=as_user("joni")).json()
    assert one["snapshot"] == rec.snapshot and one["content_digest"] == rec.content_digest
    assert w.c.get(f"{EXPORT_URL}/42", headers=as_user("joni")).status_code == 404
    bind(w.c, w.settings, "dana", "site_admin", "installation", "*")
    assert w.c.get(f"{EXPORT_URL}/{rec.seq}", headers=as_user("dana")).status_code == 403


def test_no_write_endpoint_exists_for_the_export(w):
    for method in ("post", "delete"):
        assert getattr(w.c, method)(EXPORT_URL, headers=as_user("joni")).status_code == 405
        assert getattr(w.c, method)(f"{EXPORT_URL}/1", headers=as_user("joni")).status_code == 405
    # PUT /wiskey/relay-map/export is the station approval route with station id "export": no such station, nothing exported
    r = w.save("export", [(1, 1), (2, None)], 0)
    assert r.status_code == 404 and r.json()["code"] == "intercom_station_not_found"
    assert w.dump(("wiskey_relay_map_exports",)) == {"wiskey_relay_map_exports": []}


def test_the_export_log_never_travels_in_a_backup():
    assert "wiskey_relay_map_exports" in backup.NEVER_EXPORTED_TABLES


# ================================================================ part A: the approval PUT contract, pinned

def test_a_unchanged_rows_keep_their_row_revision_while_the_station_revision_advances(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    assert w.save(ST, [(1, 1), (2, None)], 1).json()["revision"] == 2
    assert w.save(ST, [(1, 1), (2, 2)], 2).json()["revision"] == 3
    rows = {r[1]: r for r in w.dump()["wiskey_relay_map"]}
    assert rows[1][3] == 1, "api relay 1 never changed: row revision 1 across three station revisions"
    assert rows[2][3] == 3 and rows[2][4] == 1, "api relay 2: created 1, tombstoned 2, re-enabled 3"


def test_a_no_op_is_422_also_for_an_already_disabled_tombstone_and_an_unmapped_relay(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    w.save(ST, [(1, 1), (2, None)], 1)
    counters = w.dump()
    r = w.save(ST, [(1, 1), (2, None)], 2)
    assert r.status_code == 422 and r.json()["code"] == "relay_map_unchanged" and w.dump() == counters
    w.save(ONE, [(1, 1), (2, None)], 0)
    counters = w.dump()
    r = w.save(ONE, [(1, 1), (2, None)], 1)
    assert r.status_code == 422 and r.json()["code"] == "relay_map_unchanged" and w.dump() == counters


def test_a_disable_is_an_inactive_tombstone_and_get_shows_physical_relay_null_with_its_row_revision(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    w.save(ST, [(1, 1), (2, None)], 1)
    assert [r[:5] for r in w.dump()["wiskey_relay_map"]] == [(ST, 1, 1, 1, 1), (ST, 2, 2, 2, 0)]
    s = next(x for x in w.c.get(URL, headers=as_user("joni")).json()["stations"] if x["id"] == ST)
    assert s["rows"][1] == {**s["rows"][1], "api_relay": 2, "physical_relay": None, "active": False, "row_revision": 2}
    with w.db.connection() as conn:
        assert fx.relay_row(conn, ST, 2) is None and fx.relay_row_for_door(conn, ST, 2) is None


def test_a_stale_station_revision_writes_nothing_and_moves_no_row_revision(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    counters = w.dump()
    assert w.save(ST, [(1, 2), (2, 1)], 0).status_code == 409
    assert w.dump() == counters
