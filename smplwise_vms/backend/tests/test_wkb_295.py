"""WKB-295 (FAKES ONLY): WisKey requirements A04 (T02/Q1, per-station removal proof) and A05 (T05, the durable full original).
Nothing contacts WisKey, Home Assistant or a station; every answer is hand-built, every transport is a fake."""
from __future__ import annotations

import copy
import datetime as dt
import inspect
import json
import sqlite3
import zipfile
from pathlib import Path
from typing import Any

import pytest

from smplwise.services import access_grant_engine as age
from smplwise.services import wiskey_access_state as was
from smplwise.services import wiskey_intents as wi
from smplwise.services import wiskey_peer as wp

PERSON, REV = "person-a", 4
PRED = was.CENTRAL_REVOCATION_PREDICATE


# ================================================================ A04: one station's removal, judged per station

def _row(sid: str, *, enabled: bool = False, applied: bool | None = True, applied_rev: int | None = REV, sync: str | None = "synced",
         locks: list[int] | None = None) -> dict[str, Any]:
    return {"station_id": sid, "enabled": enabled, "allowed_locks": locks or [1], "desired_revision": REV, "applied_revision": applied_rev,
            "sync_state": sync, "applied": applied}


def _answer(rows: list[dict[str, Any]], *, operations=(), unverified=(), pins=(), central_revoked: bool | None = None,
            presence: str = "present") -> dict[str, Any]:
    queues = {"bindings": [], "tombstones": [], "cards": [], "pins": sorted(pins), "operations": sorted(operations), "unverified": sorted(unverified)}
    removal = any(queues[q] for q in was.REMOVAL_QUEUES)
    enabled = [r["applied"] for r in rows if r["enabled"]]
    synced = None if not enabled else False if False in enabled else None if None in enabled else True
    if central_revoked is None:
        central_revoked = not any(r["enabled"] for r in rows)
    return {"schema_version": 2, "observation": was.OBSERVATION, "scope": was.SCOPE, "user_id": PERSON, "person_revision": REV,
            "presence": presence, "revocation_pending": True if removal else (None if queues["unverified"] else False),
            "stations_synced": synced, "assignments": rows, "timing_policy": None, "pending": queues,
            "central_revocation_predicate": PRED, "central_revoked": central_revoked}


def _parse(raw: dict[str, Any]) -> was.AccessState:
    return was.parse_result(raw, user_id=PERSON, revision=REV, expect=2)


def _station(st: was.AccessState, sid: str) -> bool | None:
    return was.station_removal_verdict_v2(st, person_id=PERSON, revision=REV, station_id=sid)


def _person(st: was.AccessState, known: frozenset[str]) -> bool | None:
    return was.revocation_verdict_v2(st, person_id=PERSON, revision=REV, last_known_stations=known)


def a_positive_b_pending() -> dict[str, Any]:
    """The SHARED case (WisKey T02/Q1): ONE answer, ONE revision. Station A: a disabled row applied at this revision (the station
    proof). Station B: a disabled row still behind, owed in `operations`. WisKey's top-level revocation_pending is therefore True."""
    return _answer([_row("station-a"), _row("station-b", applied=False, applied_rev=REV - 1, sync="pending")], operations=["station-b"])


def test_shared_a_positive_b_pending_in_the_same_revision():
    st = _parse(a_positive_b_pending())
    assert st.revocation_pending is True and st.person_revision == REV  # the global flag is True because of B alone
    assert _station(st, "station-a") is False  # A is proven on its own row (before WKB-295: None, the global flag blocked it)
    assert _station(st, "station-b") is True  # B: work still owed -> pending / blocked
    assert _station(st, "station-c") is None  # no row: UNKNOWN, never invented
    # the whole person is NOT clean in the same answer: a station proof is never a person clean
    assert _person(st, frozenset({"station-a", "station-b"})) is True
    assert _person(st, frozenset({"station-a"})) is True


def test_the_shared_case_through_the_engine_port():
    raw = a_positive_b_pending()
    reader = lambda pid, rev: (copy.deepcopy(raw), 2)  # noqa: E731 - a fake readback
    assert age.station_removal_from(reader, PERSON, REV, "station-a") is False
    assert age.station_removal_from(reader, PERSON, REV, "station-b") is True
    assert age.revocation_pending_from(reader, PERSON, REV, last_known_stations=frozenset({"station-a", "station-b"})) is True


def test_unknown_at_another_station_does_not_block_a_but_unknown_at_a_stays_blocked():
    other = _parse(_answer([_row("station-a"), _row("station-b", applied=None)], unverified=["station-b"]))
    assert other.revocation_pending is None
    assert _station(other, "station-a") is False
    assert _station(other, "station-b") is None  # UNKNOWN stays UNKNOWN, never False
    assert _person(other, frozenset({"station-a", "station-b"})) is None
    # A's own row looks applied, but WisKey lists A as unverified: UNKNOWN, never False
    own = _parse(_answer([_row("station-a")], unverified=["station-a"]))
    assert _station(own, "station-a") is None


@pytest.mark.parametrize("queue", ["operations", "pins", "unverified"])
def test_work_queued_under_an_id_with_no_row_cannot_be_attributed_so_a_stays_unknown(queue):
    raw = _answer([_row("station-a")], **{queue: ["station-gone"]})
    st = _parse(raw)
    assert _station(st, "station-a") is None  # mapping lost / another id: UNKNOWN, never False
    assert _station(st, "station-gone") is (None if queue == "unverified" else True)


def test_a_station_proof_for_a_still_active_person_is_not_a_person_clean():
    st = _parse(_answer([_row("station-a"), _row("station-c", enabled=True)]))  # A blocked, C still allowed
    assert st.revocation_pending is False and st.central_revoked is False
    assert _station(st, "station-a") is False
    assert _station(st, "station-c") is None  # an enabled row is never a removal proof
    assert _person(st, frozenset({"station-a", "station-c"})) is None


@pytest.mark.parametrize("queue", ["bindings", "tombstones", "cards", "pins", "operations"])
def test_any_removal_queue_naming_a_is_pending_even_with_an_applied_row(queue):
    raw = _answer([_row("station-a")])
    raw["pending"][queue] = ["station-a"]
    raw["revocation_pending"] = True
    st = _parse(raw)
    assert _station(st, "station-a") is True


def test_whole_person_states_still_block_every_station():
    dp = _parse({**_answer([]), "presence": "delete_pending", "person_revision": None, "revocation_pending": True, "central_revoked": None,
                 "stations_synced": None})
    assert _station(dp, "station-a") is True
    absent = {**_answer([]), "presence": "absent", "person_revision": None, "revocation_pending": None, "central_revoked": None,
              "stations_synced": None}
    assert _station(_parse(absent), "station-a") is None  # absence is never a proof
    st = _parse(a_positive_b_pending())
    assert was.station_removal_verdict_v2(st, person_id=PERSON, revision=REV + 1, station_id="station-a") is None  # another revision


def test_v1_still_never_proves_one_station():
    raw = a_positive_b_pending()
    raw = {k: v for k, v in raw.items() if k not in ("central_revocation_predicate", "central_revoked")}
    raw["schema_version"] = 1
    v1 = was.parse_result(raw, user_id=PERSON, revision=REV, expect=1)
    assert _station(v1, "station-a") is None



# ================================================================ A05: the durable full original (fakes only)
# Owner decision 2026-10-23 (WKB2-295): the table stays, protected - person REFERENCES only (no display names / contact fields), the
# original and the context SEALED at rest with the bridge-key mechanism (SHA-256 over the canonical plaintext), a purge of the sealed
# columns after a terminal state + the retention window, never in the plain backup export (restore -> UNKNOWN, no reconstruction).

BACKEND = Path(__file__).resolve().parents[1] / "smplwise" / "migrations"
MIGS = [BACKEND / "0145_wiskey_peer_intents_feature_registry.sql", BACKEND / "0146_wiskey_intent_originals.sql"]
REPO = "11111111-2222-4333-8444-555555555555"
OWNER = "a" * 32
PEER = wp._mint_peer(value="peer-1", peer_binding_ref="bind-1", peer_binding_revision=3, repository_id=REPO, query_owner_id=OWNER)
SOURCE = "context-read-not-yet-named"  # the agreed context source is a WisKey definition; this is a fake label
MARK = "zq-plaintext-marker-7781"  # a value that exists ONLY inside the original: it must never reach the database file


def ctx(epoch: int = 7, exclusive: bool = True, repo: str = REPO, owner: str = OWNER) -> wp.VerifiedWriteContext:
    return wp._mint_write_context(repository_id=repo, owner_id=owner, writer_epoch=epoch, exclusive_writer_established=exclusive, source=SOURCE)


def open_db(path: Path) -> sqlite3.Connection:
    c = sqlite3.connect(path)
    c.execute("PRAGMA foreign_keys=ON")
    return c


@pytest.fixture()
def dbfile(tmp_path: Path) -> Path:
    path = tmp_path / "arx.db"
    c = open_db(path)
    for m in MIGS:
        c.executescript(m.read_text(encoding="utf-8"))
    c.commit()
    c.close()
    return path


def home(dbfile: Path) -> Path:
    """The data folder whose keys/connections.key seals the originals (created on the first seal)."""
    return dbfile.parent / "data"


def update_original(n: int = 1) -> dict[str, Any]:
    """A people write by REFERENCE only: the person id, the expected revision, the doors - no name, no contact field."""
    return {"type": "hikvision_intercom/users/update", "user_id": "person-a", "expected_revision": 4,
            "doors": {"station-a": [1]}, "operation_id": f"up-{n}", "note_ref": f"{MARK}-{n}"}


def admit_full(conn, n: int = 1, *, context=None, original=None, data_dir: Path | None = None, **over: Any) -> wi.FullOriginal:
    db_path = Path(conn.execute("PRAGMA database_list").fetchone()[2])
    kw = dict(peer=PEER, context=context if context is not None else ctx(), operation_id=f"up-{n}", request_id=f"ureq-{n}",
              origin_ref=f"editor:{n}", operation_binding_ref=f"uopb-{n}", command="users/update",
              original=original if original is not None else update_original(n), user_id="person-a", revision_before=3 + n,
              data_dir=data_dir or home(db_path))
    kw.update(over)
    return wi.admit_with_original(conn, **kw)


def settle(conn, o: wi.ExactOriginal, at: str, *, never: bool = False) -> None:
    """A terminal fact recorded at `at` (the clock is the test's)."""
    if never:
        wi._terminal(conn, o, "never_committed", "pre_effect_refused", None, None, at)
    else:
        wi._terminal(conn, o, "committed", None, None, 5, at)
    conn.commit()


class FakeTransport:
    def __init__(self, fail: BaseException | None = None) -> None:
        self.sent: list[dict[str, Any]] = []
        self.fail = fail

    def __call__(self, frame: dict[str, Any]) -> Any:
        self.sent.append(frame)
        if self.fail is not None:
            raise self.fail
        return {"ok": True}


class Crash(BaseException):
    """A process dying mid-call (not an Exception: nothing in the code under test may swallow it)."""


def _db_bytes(dbfile: Path) -> bytes:
    return b"".join(p.read_bytes() for p in sorted(dbfile.parent.glob(dbfile.name + "*")))


# ---------------------------------------------------------------- negative tests first (owner decision 2026-10-23)

def test_the_plaintext_original_and_context_never_reach_the_database_file(dbfile):
    c = open_db(dbfile)
    full = admit_full(c)
    admit_full(c, 2)
    c.close()
    raw = _db_bytes(dbfile)
    assert raw and MARK.encode() not in raw  # the value inside the original
    assert SOURCE.encode() not in raw  # a value inside the context only
    assert full.original_json.encode() not in raw and b'"expected_revision":4' not in raw and b"exclusive_writer_established" not in raw
    r = open_db(dbfile)
    enc, ctx_enc, sha = r.execute("SELECT original_enc, context_enc, original_sha256 FROM wiskey_intent_originals WHERE operation_id='up-1'").fetchone()
    assert enc.startswith("v1:") and ctx_enc.startswith("v1:") and enc != ctx_enc
    # the hash is over the canonical PLAINTEXT, computed before sealing
    assert sha == wi.sha256_hex(wi.canonical(update_original(1))) == full.original_sha256
    assert [c[1] for c in r.execute("PRAGMA table_info(wiskey_intent_originals)")].count("original_json") == 0


@pytest.mark.parametrize("original", [
    {"type": "x", "user_id": "person-a", "name": "Dana Example"},
    {"type": "x", "person": {"Display_Name": "Dana"}},
    {"type": "x", "people": [{"first_name": "Dana"}]},
    {"type": "x", "last_name": "Example"},
    {"type": "x", "email": "x@example.invalid"},
    {"type": "x", "phone": "0000"},
])
def test_names_and_contact_fields_are_refused_only_references_are_recorded(dbfile, original):
    c = open_db(dbfile)
    with pytest.raises(wi.IntentError) as e:
        admit_full(c, original=original)
    assert e.value.code == "personal_in_original"
    assert c.execute("SELECT count(*) FROM wiskey_fence_intents").fetchone()[0] == 0


@pytest.mark.parametrize("original, code", [
    ({"type": "x", "pin": "1234"}, "secret_in_original"),
    ({"type": "x", "nested": {"Card_No": "123"}}, "secret_in_original"),
    ({"type": "x", "cards": [{"value": "1"}]}, "secret_in_original"),
    ({"type": "x", "password": "p"}, "secret_in_original"),
    ({"type": "x", "access_token": "t"}, "secret_in_original"),
    ({"type": "x", "ratio": 0.5}, "original_type"),
    ({"type": "x", "big": 2 ** 53}, "original_unsafe_int"),
    ({"id": 4, "type": "x"}, "original_has_message_id"),
    ({}, "original_shape"),
    ({"type": "x", "blob": "y" * 70000}, "original_too_large"),
])
def test_originals_that_cannot_be_stored_safely_are_refused_before_anything_is_written(dbfile, original, code):
    c = open_db(dbfile)
    with pytest.raises(wi.IntentError) as e:
        admit_full(c, original=original)
    assert e.value.code == code
    assert c.execute("SELECT count(*) FROM wiskey_fence_intents").fetchone()[0] == 0
    assert c.execute("SELECT count(*) FROM wiskey_intent_originals").fetchone()[0] == 0


T0 = "2026-01-01T00:00:00.000000Z"


def _at(days: float) -> dt.datetime:
    return dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc) + dt.timedelta(days=days)


def _purged(c, op: str) -> tuple[Any, ...]:
    return c.execute("SELECT original_enc IS NULL, context_enc IS NULL, purged_at IS NOT NULL, original_sha256 FROM wiskey_intent_originals "
                     "WHERE operation_id=?", (op,)).fetchone()


def test_purge_only_touches_terminal_intents_past_the_retention_window(dbfile):
    c = open_db(dbfile)
    fulls = {n: admit_full(c, n) for n in range(1, 6)}
    settle(c, fulls[1].exact, T0)  # committed 31 days before the purge
    settle(c, fulls[2].exact, T0, never=True)  # never_committed, 31 days before
    settle(c, fulls[3].exact, wi._iso(_at(10)))  # terminal but recent (21 days)
    wi.mark_sent(c, fulls[4].exact)  # open: sent
    c.commit()
    wi.mark_unknown(c, fulls[4].exact, "timeout")  # open: unknown
    c.commit()
    # 5 stays `intent` (open, never sent)
    assert wi.purge_originals(c, days=30, now=_at(31)) == 2
    c.commit()
    for op in ("up-1", "up-2"):
        gone = _purged(c, op)
        assert gone[:3] == (1, 1, 1) and gone[3] == fulls[int(op[-1])].original_sha256  # the hash stays as proof
    for op in ("up-3", "up-4", "up-5"):
        assert _purged(c, op)[:3] == (0, 0, 0)  # recent or open: never purged
    # the rows, the hash and the terminal state stay; the purge is idempotent
    assert c.execute("SELECT count(*) FROM wiskey_intent_originals").fetchone()[0] == 5
    assert wi.state(c, fulls[1].exact) == "committed" and wi.state(c, fulls[2].exact) == "never_committed"
    assert wi.purge_originals(c, days=30, now=_at(31)) == 0
    # an open intent is never purged, however old
    assert wi.purge_originals(c, days=1, now=_at(400)) == 1  # only up-3 (terminal); up-4 / up-5 stay
    c.commit()
    assert _purged(c, "up-4")[:3] == (0, 0, 0) and _purged(c, "up-5")[:3] == (0, 0, 0)


@pytest.mark.parametrize("days, want", [(0, 1), (-5, 1), (1, 1), (30, 30), (365, 365), (9999, 365)])
def test_the_retention_window_is_clamped_to_its_safe_floor_and_ceiling(dbfile, days, want):
    c = open_db(dbfile)
    full = admit_full(c)
    settle(c, full.exact, T0)
    # a window below the floor still keeps every original at least one day
    assert wi.purge_originals(c, days=days, now=_at(want - 0.01)) == 0
    assert wi.purge_originals(c, days=days, now=_at(want + 0.01)) == 1


def test_resolve_works_from_the_sealed_original_and_refuses_after_the_purge(dbfile):
    c = open_db(dbfile)
    full = admit_full(c)
    body = wi.resolve_request(c, full.exact, data_dir=home(dbfile))
    assert body["original"] == update_original(1) and body["original_sha256"] == full.original_sha256
    assert body["context"]["source"] == SOURCE and body["context_sha256"] == full.context_sha256
    settle(c, full.exact, T0)
    assert wi.purge_originals(c, days=30, now=_at(31)) == 1
    c.commit()
    with pytest.raises(wi.IntentError) as e:
        wi.resolve_request(c, full.exact, data_dir=home(dbfile))
    assert e.value.code == "no_original"


def test_the_triggers_allow_only_the_purge_of_a_terminal_intent(dbfile):
    c = open_db(dbfile)
    full = admit_full(c)
    other = admit_full(c, 2)
    blocked = [
        "UPDATE wiskey_intent_originals SET original_enc = NULL, context_enc = NULL, purged_at = '2026-12-01T00:00:00Z' WHERE operation_id='up-1'",
        "UPDATE wiskey_intent_originals SET original_sha256 = '" + "0" * 64 + "'",
        "DELETE FROM wiskey_intent_originals",
        "UPDATE wiskey_fence_intents SET issued_epoch = 8",
        "UPDATE wiskey_fence_intents SET origin_ref = 'x'",
    ]
    for sql in blocked:  # an open intent: not even the purge shape is allowed
        with pytest.raises(sqlite3.DatabaseError):
            c.execute(sql)
        c.rollback()
    settle(c, full.exact, T0)
    for sql in (
        # terminal, but too soon (< 1 day after the terminal fact)
        "UPDATE wiskey_intent_originals SET original_enc = NULL, context_enc = NULL, purged_at = '2026-01-01T06:00:00Z' WHERE operation_id='up-1'",
        # terminal and old, but the hash changes too
        "UPDATE wiskey_intent_originals SET original_enc = NULL, context_enc = NULL, purged_at = '2026-03-01T00:00:00Z', original_sha256 = '"
        + "0" * 64 + "' WHERE operation_id='up-1'",
        # only one of the two sealed columns
        "UPDATE wiskey_intent_originals SET original_enc = NULL, purged_at = '2026-03-01T00:00:00Z' WHERE operation_id='up-1'",
        # a new sealed value instead of NULL
        "UPDATE wiskey_intent_originals SET original_enc = (SELECT original_enc FROM wiskey_intent_originals WHERE operation_id='up-2') "
        "WHERE operation_id='up-1'",
        # an unparseable purge time
        "UPDATE wiskey_intent_originals SET original_enc = NULL, context_enc = NULL, purged_at = 'soon' WHERE operation_id='up-1'",
    ):
        with pytest.raises(sqlite3.DatabaseError):
            c.execute(sql)
        c.rollback()
    c.execute("UPDATE wiskey_intent_originals SET original_enc = NULL, context_enc = NULL, purged_at = '2026-03-01T00:00:00Z' WHERE operation_id='up-1'")
    c.commit()
    for sql in ("UPDATE wiskey_intent_originals SET purged_at = '2026-04-01T00:00:00Z' WHERE operation_id='up-1'",  # once purged: frozen
                "UPDATE wiskey_intent_originals SET original_enc = 'v1:xxxx' WHERE operation_id='up-1'"):
        with pytest.raises(sqlite3.DatabaseError):
            c.execute(sql)
        c.rollback()
    wi.mark_sent(c, other.exact)  # the state columns still move
    c.commit()


def test_the_backup_export_never_carries_the_table_and_a_restore_leaves_open_intents_unknown(settings, tmp_path):
    from smplwise.db import Database
    from smplwise.services import backup

    assert {"wiskey_intent_originals", "wiskey_fence_intents"} <= backup.NEVER_EXPORTED_TABLES
    db = Database(settings.db_path)
    db.migrate()
    raw = sqlite3.connect(settings.db_path)
    raw.execute("PRAGMA foreign_keys=ON")
    full = admit_full(raw, data_dir=settings.data_dir)
    raw.close()
    with db.connection() as conn:
        assert "wiskey_intent_originals" not in backup.snapshot(conn, include_access=True, include_audit=True, include_events=True)
        entry = backup.create(settings, conn, "manual", include_access=True)
    with zipfile.ZipFile(backup.backups_dir(settings) / entry["name"]) as z:
        blob = b"".join(z.read(n) for n in z.namelist())
        assert not any("wiskey_intent" in n or "wiskey_fence" in n for n in z.namelist())
    assert MARK.encode() not in blob and full.original_sha256.encode() not in blob
    # a restore never touches the table (the same installation keeps its sealed originals) ...
    with db.connection() as conn:
        backup.restore(settings, conn, backup.backups_dir(settings) / entry["name"], mode="replace", scope="project")
    r = open_db(settings.db_path)
    assert [k for _, k in wi.recovery_plan(r, data_dir=settings.data_dir)] == ["held_not_sent"]
    # ... and the database file restored WITHOUT its key (another data folder: an add-on restore elsewhere, a copied file) has no
    # readable original: every open intent is UNKNOWN, nothing is rebuilt, resolved or sent
    elsewhere = tmp_path / "elsewhere"
    assert [k for _, k in wi.recovery_plan(r, data_dir=elsewhere)] == ["unknown_no_original"]
    o = wi.original(r, REPO, OWNER, "up-1")
    with pytest.raises(wi.IntentError) as e:
        wi.resolve_request(r, o, data_dir=elsewhere)
    assert e.value.code == "original_unreadable"
    t = FakeTransport()
    with pytest.raises(wi.IntentError):
        wi.send_once(r, o, t, context=ctx(), peer=PEER, data_dir=elsewhere)
    assert t.sent == [] and wi.state(r, o) == "intent"
    assert not (elsewhere / "keys").exists()  # reading never creates a key


def test_the_janitor_purges_audits_counts_only_and_is_idempotent(settings, monkeypatch):
    from smplwise.db import Database, set_setting
    from smplwise.services import wiskey_intent_retention as wir

    db = Database(settings.db_path)
    db.migrate()
    raw = sqlite3.connect(settings.db_path)
    raw.execute("PRAGMA foreign_keys=ON")
    done = admit_full(raw, 1, data_dir=settings.data_dir)
    admit_full(raw, 2, data_dir=settings.data_dir)  # stays open
    settle(raw, done.exact, T0)
    raw.close()
    with db.connection() as conn:
        assert wir.retention_days(conn) == 30
        set_setting(conn, wir.SETTING_KEY, "0")
        assert wir.retention_days(conn) == 1  # the safe floor, never "off" and never "now"
        set_setting(conn, wir.SETTING_KEY, "100000")
        assert wir.retention_days(conn) == 365
        set_setting(conn, wir.SETTING_KEY, "junk")
        assert wir.retention_days(conn) == 30
        set_setting(conn, wir.SETTING_KEY, "30")
    assert wir.run(db, now=_at(20)) == {"purged": 0, "retention_days": 30}
    assert wir.run(db, now=_at(31)) == {"purged": 1, "retention_days": 30}
    assert wir.run(db, now=_at(32)) == {"purged": 0, "retention_days": 30}
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT action, details_json FROM audit_log WHERE action = ?", (wir.AUDIT_ACTION,)).fetchall()
        assert len(rows) == 1 and MARK not in rows[0][1] and "person-a" not in rows[0][1]
        assert json.loads(rows[0][1]) == {"purged": 1, "retention_days": 30}
        assert conn.execute("SELECT count(*) FROM wiskey_intent_originals WHERE purged_at IS NULL").fetchone()[0] == 1
    # the hook: throttled, never raises
    wir.reset_for_tests()
    monkeypatch.setattr(wir, "run", lambda db, now=None: (_ for _ in ()).throw(RuntimeError("boom")))
    wir.janitor(db)
    wir.reset_for_tests()


def test_the_janitor_tick_runs_the_purge():
    from smplwise import main

    assert "wiskey_intent_retention" in inspect.getsource(main.janitor_tick)


# ---------------------------------------------------------------- the T05 behaviour, now over the sealed original

def test_full_original_hash_and_context_are_committed_before_returning(dbfile):
    c = open_db(dbfile)
    full = admit_full(c)
    assert not c.in_transaction  # the commit point is inside admit_with_original
    # a SECOND connection (another process) already sees all of it, before any I/O happened
    other = open_db(dbfile)
    o = wi.original(other, REPO, OWNER, "up-1")
    got = wi.stored_original(other, o, data_dir=home(dbfile))
    assert got is not None and got.original() == update_original(1)
    assert got.original_sha256 == wi.sha256_hex(wi.canonical(update_original(1)))
    assert got.context()["writer_epoch"] == 7 and got.context()["exclusive_writer_established"] is True
    assert got.context()["peer_binding_revision"] == 3 and got.context()["source"] == SOURCE
    assert o.issued_epoch == 7 and wi.state(other, o) == "intent" and full.original_sha256 == got.original_sha256


def test_admission_is_atomic_a_failed_original_insert_leaves_no_intent(dbfile):
    c = open_db(dbfile)
    c.execute("CREATE TRIGGER boom BEFORE INSERT ON wiskey_intent_originals BEGIN SELECT RAISE(ABORT, 'disk gone'); END")
    c.commit()
    with pytest.raises(sqlite3.DatabaseError):
        admit_full(c)
    assert not c.in_transaction
    assert open_db(dbfile).execute("SELECT count(*) FROM wiskey_fence_intents").fetchone()[0] == 0


def test_crash_after_sent_is_committed_restart_resolves_and_never_resends(dbfile):
    c = open_db(dbfile)
    full = admit_full(c)
    t = FakeTransport(fail=Crash())
    with pytest.raises(Crash):
        wi.send_once(c, full.exact, t, context=ctx(), peer=PEER, data_dir=home(dbfile))
    assert len(t.sent) == 1 and t.sent[0] == update_original(1)  # the stored bytes went out, exactly once
    c.close()  # the process dies here
    r = open_db(dbfile)  # restart
    o = wi.original(r, REPO, OWNER, "up-1")
    assert wi.state(r, o) == "sent"
    assert [(x.operation_id, k) for x, k in wi.recovery_plan(r, data_dir=home(dbfile))] == [("up-1", "resolve_with_original")]
    body = wi.resolve_request(r, o, data_dir=home(dbfile))
    assert body["original"] == update_original(1) and body["original_sha256"] == full.original_sha256
    assert body["operation_id"] == "up-1" and body["issued_epoch"] == 7 and body["context_sha256"] == full.context_sha256
    t2 = FakeTransport()
    with pytest.raises(wi.IntentError) as e:
        wi.send_once(r, o, t2, context=ctx(), peer=PEER, data_dir=home(dbfile))
    assert e.value.code == "not_sendable" and t2.sent == []  # no replay after restart


def test_crash_before_the_send_restart_holds_it_and_sends_nothing_by_itself(dbfile):
    c = open_db(dbfile)
    admit_full(c)
    c.close()  # dies between the committed admission and the send
    r = open_db(dbfile)
    assert [k for _, k in wi.recovery_plan(r, data_dir=home(dbfile))] == ["held_not_sent"]
    o = wi.original(r, REPO, OWNER, "up-1")
    # a later send needs a fresh sealed context with the SAME epoch; a new epoch sends nothing
    t = FakeTransport()
    with pytest.raises(wi.IntentError) as e:
        wi.send_once(r, o, t, context=ctx(epoch=8), peer=PEER, data_dir=home(dbfile))
    assert e.value.code == "epoch_changed" and t.sent == [] and wi.state(r, o) == "intent"


def test_a_transport_error_is_unknown_committed_and_never_retried(dbfile):
    c = open_db(dbfile)
    full = admit_full(c)
    t = FakeTransport(fail=RuntimeError("socket closed"))
    assert wi.send_once(c, full.exact, t, context=ctx(), peer=PEER, data_dir=home(dbfile)) is None
    r = open_db(dbfile)
    o = wi.original(r, REPO, OWNER, "up-1")
    assert wi.state(r, o) == "unknown" and [k for _, k in wi.recovery_plan(r, data_dir=home(dbfile))] == ["resolve_with_original"]
    with pytest.raises(wi.IntentError):
        wi.send_once(r, o, FakeTransport(), context=ctx(), peer=PEER, data_dir=home(dbfile))


def test_an_old_intent_without_an_original_stays_unknown_and_is_never_rebuilt(dbfile):
    c = open_db(dbfile)
    o = wi.admit(c, peer=PEER, operation_id="old-1", request_id="oreq-1", origin_ref="editor:old", operation_binding_ref="oopb-1",
                 issued_epoch=7, command="users/create")
    wi.mark_sent(c, o)
    c.commit()
    c.close()
    r = open_db(dbfile)
    o = wi.original(r, REPO, OWNER, "old-1")
    assert [k for _, k in wi.recovery_plan(r, data_dir=home(dbfile))] == ["unknown_no_original"]
    for call in (lambda: wi.resolve_request(r, o, data_dir=home(dbfile)),
                 lambda: wi.send_once(r, o, FakeTransport(), context=ctx(), peer=PEER, data_dir=home(dbfile))):
        with pytest.raises(wi.IntentError) as e:
            call()
        assert e.value.code == "no_original"
    assert wi.state(r, o) == "sent"  # nothing moved it, nothing sent it


@pytest.mark.parametrize("bad, code", [
    ("plain", "context_unverified"),
    ("fence", "context_unverified"),
    ("not_exclusive", "writer_unproven"),
    ("other_repo", "context_mismatch"),
    ("other_owner", "context_mismatch"),
])
def test_the_context_must_come_from_the_sealed_source_and_match_the_pin(dbfile, bad, code):
    c = open_db(dbfile)
    value = {"plain": {"repository_id": REPO, "owner_id": OWNER, "writer_epoch": 7, "exclusive_writer_established": True},
             "fence": wp.FenceContext(REPO, 7, OWNER, True),
             "not_exclusive": ctx(exclusive=False),
             "other_repo": ctx(repo="99999999-2222-4333-8444-555555555555"),
             "other_owner": ctx(owner="b" * 32)}[bad]
    with pytest.raises(wi.IntentError) as e:
        admit_full(c, context=value)
    assert e.value.code == code
    assert c.execute("SELECT count(*) FROM wiskey_fence_intents").fetchone()[0] == 0


def test_the_context_cannot_be_forged():
    with pytest.raises(wp.PeerSeamError):
        wp.VerifiedWriteContext(repository_id=REPO, owner_id=OWNER, writer_epoch=7, exclusive_writer_established=True, source=SOURCE)
    with pytest.raises(wp.PeerSeamError):
        wp._mint_write_context(repository_id=REPO, owner_id=OWNER, writer_epoch=True, exclusive_writer_established=True, source=SOURCE)
    with pytest.raises(wp.PeerSeamError):
        wp.as_write_context(wp.FenceContext(REPO, 7, OWNER, True))


def test_an_open_transaction_is_refused_the_commit_point_must_be_ours(dbfile):
    c = open_db(dbfile)
    c.execute("BEGIN")
    with pytest.raises(wi.IntentError) as e:
        admit_full(c)
    assert e.value.code == "open_transaction"


def test_a_tampered_or_moved_sealed_original_is_never_used(dbfile):
    c = open_db(dbfile)
    full = admit_full(c)
    admit_full(c, 2)
    # tamper behind the trigger (as a broken disk / manual edit would): the read refuses it, recovery treats it as no original
    c.execute("DROP TRIGGER wiskey_intent_originals_guarded")
    c.execute("UPDATE wiskey_intent_originals SET original_sha256 = ? WHERE operation_id='up-1'", ("0" * 64,))
    c.commit()
    with pytest.raises(wi.IntentError) as e:
        wi.resolve_request(c, full.exact, data_dir=home(dbfile))
    assert e.value.code == "original_corrupt"
    # a sealed blob copied from another intent does not open (the AAD binds it to its own intent and field)
    c.execute("UPDATE wiskey_intent_originals SET original_sha256 = ?, original_enc = (SELECT original_enc FROM wiskey_intent_originals "
              "WHERE operation_id='up-2') WHERE operation_id='up-1'", (full.original_sha256,))
    c.commit()
    with pytest.raises(wi.IntentError) as e:
        wi.resolve_request(c, full.exact, data_dir=home(dbfile))
    assert e.value.code == "original_unreadable"
    assert [(o.operation_id, k) for o, k in wi.recovery_plan(c, data_dir=home(dbfile))] == [("up-1", "unknown_no_original"),
                                                                                            ("up-2", "held_not_sent")]


def test_duplicates_are_refused_and_the_first_original_is_kept(dbfile):
    c = open_db(dbfile)
    first = admit_full(c)
    with pytest.raises(wi.IntentError) as e:
        admit_full(c, original={**update_original(1), "doors": {"station-b": [2]}})
    assert e.value.code == "duplicate" and not c.in_transaction
    assert wi.stored_original(c, first.exact, data_dir=home(dbfile)).original() == update_original(1)


def test_the_proposed_create_resolution_is_not_an_alias_of_the_original_path():
    assert wi.PROPOSED_CREATE_COMMAND == "hikvision_intercom/person_writes/resolve_create"
    with pytest.raises(wp.PeerSeamError):
        wi.LiveResolveTransport().resolve(None)  # type: ignore[arg-type]
