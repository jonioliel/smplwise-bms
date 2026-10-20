"""K7 (TRIAGE_FIX_BEFORE_ENABLING 2026-10-18): the grant re-decision no longer holds ONE write transaction for every decided grant.

FAKES ONLY: nothing here contacts WisKey, a station, a door or WhatsApp (the Env of test_access_grants wires the fake engine and
transport; the re-decision itself never calls either). GO_LIVE_PERMITTED is switched on only inside the Env (monkeypatch), as in
every access-grant test; the shipped value is untouched.

What is proved:
- equivalence: on a synthetic installation (hundreds of grants, two dozen approvers, every re-decision outcome - kept, narrowed,
  revoked because a station / the approver / the approver's row / the local switch is gone, fail-closed on a broken row) the
  chunked re-decision leaves EXACTLY the rows and audit rows of a verbatim copy of the old single-transaction code, for chunk
  sizes 1 .. larger than the data set;
- no authorisation is evaluated while the write lock is held (the old code evaluated every one under it), and no write
  transaction applies more than one chunk;
- an interrupted pass resumes after its cursor (also across a "restart": the in-memory flag lost) to the same end state;
- a change that lands between a chunk's decision and its write (a permission bump, an approver deactivated without a bump, the
  grant row edited) is re-decided inside the write transaction - never applied from the stale snapshot;
- fail closed: an error while applying is a revoke; an error before the first chunk commits asks for another pass.

The benchmark (`test_k7_benchmark_write_lock`) runs only with K7_BENCH_GRANTS=<n> set; it prints the write-lock figures of the
old and the new code on the same data set (docs/changes/K7-REDECIDE-CHUNKED.md records a run)."""
from __future__ import annotations

import json
import os
import random
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path

import pytest
from conftest import bind
from test_access_grants import APPROVER, VF, VU, Env

from smplwise import db as dbmod
from smplwise.db import Database, bump_permission_revision, new_id, now_iso, permission_revision, set_setting
from smplwise.services import access_grants as ag
from smplwise.services import backup as backup_svc

STATIONS = [f"st-{i}" for i in range(8)]
CURSOR = ag.Worker.REDECIDE_CURSOR_KEY


# ---------------------------------------------------------------- the old code, verbatim (origin/main 586f191b3, access_grants.py)

def legacy_redecide(db: Database) -> int:
    n = 0
    with db.connection(label="access_grants.redecide") as conn:
        marks = ",".join("?" * len(ag.DECIDED))
        rows = [dict(r) for r in conn.execute(f"SELECT * FROM access_grants WHERE state IN ({marks})", ag.DECIDED).fetchall()]
        rev = ag.permission_revision(conn)
        for g in rows:
            n += 1
            try:
                _legacy_redecide_one(conn, g, rev)
            except Exception:  # noqa: BLE001 - an error while re-deciding is a revoke
                ag.mark_revoking(conn, g, "approver_lost_authority")
    return n


def _legacy_redecide_one(conn: sqlite3.Connection, g: dict, rev: int) -> None:
    approver = g.get("approved_by")
    user = conn.execute("SELECT active, deleted_at FROM users WHERE id = ?", (approver,)).fetchone() if approver else None
    if user is None or not user["active"] or (user["deleted_at"] if "deleted_at" in user.keys() else None):
        ag.mark_revoking(conn, g, "approver_lost_authority")
        return
    if str(approver).startswith(ag.LOCAL_ID_PREFIX) and not ag.local_approvers(conn):
        ag.mark_revoking(conn, g, "approver_lost_authority")
        return
    p = ag.principal_of(approver)
    doors = json.loads(g["doors_json"] or "{}")
    perms = ag.approve_permissions(g["credential"])
    kept = {s: r for s, r in doors.items() if not ag.missing_on(conn, p, perms, [s])}
    if not kept:
        ag.mark_revoking(conn, g, "approver_lost_authority")
        return
    if kept != doors:
        ag._touch(conn, g["id"], {"doors_json": json.dumps(kept, sort_keys=True), "needs_push": 1 if g["state"] in ("active", "unknown") else g["needs_push"],
                                  "approval_revision": rev})
        ag._audit(conn, None, "access.grant.amend", g["id"], reason="station_changed", kind="narrowed", stations=ag.stations_of(kept))
        return
    ag._touch(conn, g["id"], {"approval_revision": rev})


# ---------------------------------------------------------------- the synthetic installation

@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    yield e
    ag.reset_for_tests()


def _copy_user(conn: sqlite3.Connection, src: str, new_id: str) -> None:
    row = dict(conn.execute("SELECT * FROM users WHERE id = ?", (src,)).fetchone())
    row["id"] = new_id
    if "username" in row:
        row["username"] = new_id
    cols = ", ".join(row)
    conn.execute(f"INSERT INTO users({cols}) VALUES ({', '.join('?' * len(row))})", list(row.values()))


def build_installation(env: Env, n: int, seed: int = 7) -> dict:
    """n decided grants (plus noise rows in other states) over 24 approvers; then the authority changes that a permission bump
    re-decides: stations lost, approvers deactivated / deleted, the local-approver switch off. Returns the cast."""
    rnd = random.Random(seed)
    rid = env.role("מאשר K7", APPROVER)
    held: dict[str, list[str]] = {}
    local = ag.LOCAL_ID_PREFIX + "k7local"
    with env.db.connection() as conn:
        template = conn.execute("SELECT id FROM users WHERE id LIKE 'dev-%' AND active = 1 ORDER BY id LIMIT 1").fetchone()[0]
        for i in range(24):
            uid = f"dev-k7a{i:02d}"
            _copy_user(conn, template, uid)
            held[uid] = sorted(rnd.sample(STATIONS, rnd.randint(2, 5)))
        _copy_user(conn, template, local)
        held[local] = held["dev-k7a00"]
        set_setting(conn, ag.LOCAL_KEY, "on")
        for uid, stations in held.items():
            for s in stations:
                conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                             "VALUES (?, 'user', ?, ?, 'access_control_station', ?, 'allow', ?, 'test', ?)", (new_id(), uid, rid, s, permission_revision(conn), now_iso()))
        bump_permission_revision(conn)
    approvers = sorted(held) + ["dev-k7ghost", None]
    at = "2026-10-19T06:00:00Z"
    rows = []
    with env.db.connection() as conn:
        rev = permission_revision(conn)
        for i in range(n):
            approver = rnd.choice(approvers[:-2]) if rnd.random() < 0.97 else rnd.choice(approvers[-2:])
            pool = held.get(approver) or STATIONS
            picked = rnd.sample(pool, min(len(pool), rnd.randint(1, 3)))
            if rnd.random() < 0.05:
                picked.append(rnd.choice(STATIONS))  # a station the approver may not hold (narrowed at once)
            doors = {s: sorted(rnd.sample([1, 2, 3], rnd.randint(1, 2))) for s in picked}
            broken = i % 97 == 13  # an unreadable row (a restored archive, a hand edit): revoked, fail closed
            doors_json = "{broken" if broken else json.dumps(doors, sort_keys=True)
            state = "active" if broken else rnd.choice(ag.DECIDED) if rnd.random() < 0.9 else rnd.choice(("requested", "revoked", "ended", "revoking"))
            rows.append((ag.uuid.uuid4().hex, f"k7c{i:06d}", doors_json, VF, VU, rnd.choice(("pin", "card", "none")), state,
                         rnd.randint(0, 1), rnd.randint(0, 1), approver, at if approver else None, rev,
                         rnd.choice((None, "pending", "queued", "sent", "not_needed")), at, at, rnd.randint(1, 5)))
        conn.executemany("""INSERT INTO access_grants(id, subject_kind, subject_id, source_kind, doors_json, valid_from, valid_until, credential, state,
                            needs_push, pushed, requested_by, approved_by, approved_at, approval_revision, code_state, created_at, updated_at, revision)
                            VALUES (?, 'contact', ?, 'manual', ?, ?, ?, ?, ?, ?, ?, 'test', ?, ?, ?, ?, ?, ?, ?)""", rows)
    # the authority changes behind the bump
    with env.db.connection() as conn:
        for uid in ("dev-k7a01", "dev-k7a02", "dev-k7a03"):  # lose ONE station each (narrowed, or revoked when it was the only one)
            conn.execute("UPDATE bindings SET revoked_at = ? WHERE subject_id = ? AND scope_id = ?", (at, uid, held[uid][0]))
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE subject_id = 'dev-k7a04'", (at,))  # loses every station
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-k7a05'")
        conn.execute("UPDATE users SET deleted_at = ? WHERE id = 'dev-k7a06'", (at,))
        set_setting(conn, ag.LOCAL_KEY, "off")
        bump_permission_revision(conn)
    ag._REDECIDE.clear()
    return {"held": held, "local": local, "role": rid}


def _clone(env: Env, tmp: Path, name: str) -> Database:
    path = tmp / f"{name}.db"
    src = sqlite3.connect(env.settings.db_path)
    dst = sqlite3.connect(path)
    with dst:
        src.backup(dst)
    src.close()
    dst.close()
    return Database(path)


def snapshot(db: Database, audit_from: int) -> dict:
    with db.connection(mode="read") as conn:
        grants = [tuple(r) for r in conn.execute("SELECT * FROM access_grants ORDER BY id").fetchall()]
        audit = sorted(tuple(r) for r in conn.execute(
            "SELECT action, resource_type, resource_id, decision, reason, permission_revision, details_json, actor_user_id FROM audit_log WHERE id > ?",
            (audit_from,)).fetchall())
        settings = sorted(tuple(r) for r in conn.execute("SELECT key, value FROM settings WHERE key != ?", (CURSOR,)).fetchall())
        cursor = conn.execute("SELECT value FROM settings WHERE key = ?", (CURSOR,)).fetchone()
    return {"grants": grants, "audit": audit, "settings": settings, "cursor": cursor}


def _audit_top(db: Database) -> int:
    with db.connection(mode="read") as conn:
        return conn.execute("SELECT COALESCE(MAX(id), 0) FROM audit_log").fetchone()[0]


def _outcomes(db: Database, before: dict, after: dict) -> dict[str, int]:
    with db.connection(mode="read") as conn:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(access_grants)").fetchall()]
    state, doors = cols.index("state"), cols.index("doors_json")
    old = {r[0]: r for r in before["grants"]}
    out = {"kept": 0, "narrowed": 0, "revoked": 0, "untouched": 0}
    for r in after["grants"]:
        b = old[r[0]]
        if r == b:
            out["untouched"] += 1
        elif r[state] != b[state]:
            out["revoked"] += 1
        elif r[doors] != b[doors]:
            out["narrowed"] += 1
        else:
            out["kept"] += 1
    return out


# ---------------------------------------------------------------- write-lock instrumentation

@contextmanager
def write_holds():
    """Every write transaction's hold (label, seconds), from the moment BEGIN IMMEDIATE returned until the lock was handed on."""
    holds: list[tuple[str, float]] = []
    end, drop = dbmod._end_hold, dbmod._drop_hold

    def _record(conn):
        held = dbmod._holders.get(id(conn))
        if held is not None:
            holds.append((held[0], time.monotonic() - held[1]))

    def end_hold(conn):
        _record(conn)
        end(conn)

    def drop_hold(conn):
        _record(conn)
        drop(conn)

    dbmod._end_hold, dbmod._drop_hold = end_hold, drop_hold
    try:
        yield holds
    finally:
        dbmod._end_hold, dbmod._drop_hold = end, drop


@contextmanager
def authorisations_under_write(monkeypatch):
    """Counts rbac authorisations evaluated on a connection that holds the write lock."""
    seen = {"write": 0, "read": 0}
    real = ag.authorize

    def counting(conn, *a, **k):
        seen["write" if dbmod._MODES.get(id(conn), ("write",))[0] != "read" else "read"] += 1
        return real(conn, *a, **k)

    monkeypatch.setattr(ag, "authorize", counting)
    yield seen


# ================================================================ equivalence

@pytest.mark.parametrize("chunk", [1, 7, 200, 100_000])
def test_the_chunked_redecision_leaves_exactly_what_the_single_transaction_left(env, tmp_path, monkeypatch, chunk):
    build_installation(env, 300)
    top = _audit_top(env.db)
    old_db, new_db = _clone(env, tmp_path, "old"), _clone(env, tmp_path, "new")
    before = snapshot(old_db, top)
    n_old = legacy_redecide(old_db)
    monkeypatch.setattr(ag.Worker, "REDECIDE_CHUNK", chunk)
    n_new = ag.WORKER.redecide(new_db)
    old, new = snapshot(old_db, top), snapshot(new_db, top)
    assert n_new == n_old
    assert new["grants"] == old["grants"]
    assert new["audit"] == old["audit"]
    assert new["settings"] == old["settings"] and new["cursor"] is None
    out = _outcomes(old_db, before, old)
    # the data set really exercises every outcome (otherwise the equality above proves little)
    assert out["kept"] > 50 and out["narrowed"] >= 5 and out["revoked"] >= 30, out
    assert any(r[0] == "access.grant.revoke" for r in old["audit"]) and any(r[0] == "access.grant.amend" for r in old["audit"])


def test_no_authorisation_runs_under_the_write_lock_and_no_write_applies_more_than_a_chunk(env, tmp_path, monkeypatch):
    build_installation(env, 300)
    old_db, new_db = _clone(env, tmp_path, "old"), _clone(env, tmp_path, "new")
    with authorisations_under_write(monkeypatch) as seen:
        legacy_redecide(old_db)
    assert seen["write"] > 300, "the old code authorised every grant x station x permission under the write lock"
    monkeypatch.setattr(ag.Worker, "REDECIDE_CHUNK", 50)
    applied: list[int] = []
    real_apply = ag.Worker._apply_chunk
    monkeypatch.setattr(ag.Worker, "_apply_chunk", lambda self, conn, plan, rev: (applied.append(len(plan)), real_apply(self, conn, plan, rev))[1])
    with authorisations_under_write(monkeypatch) as seen, write_holds() as holds:
        ag.WORKER.redecide(new_db)
    assert seen["write"] == 0 and seen["read"] > 300, seen
    assert applied and max(applied) <= 50
    assert {label for label, _ in holds} <= {"access_grants.redecide.apply", "access_grants.redecide.cursor"}, holds


# ================================================================ resume

def test_an_interrupted_pass_resumes_after_its_cursor_to_the_same_end_state(env, tmp_path, monkeypatch):
    build_installation(env, 260)
    top = _audit_top(env.db)
    old_db, new_db = _clone(env, tmp_path, "old"), _clone(env, tmp_path, "new")
    legacy_redecide(old_db)
    monkeypatch.setattr(ag.Worker, "REDECIDE_CHUNK", 40)
    calls = {"n": 0}

    def crash_on_third(rows):
        calls["n"] += 1
        if calls["n"] == 3:
            raise RuntimeError("process killed between two chunks")

    monkeypatch.setattr(ag, "_between_decide_and_apply", crash_on_third)
    with pytest.raises(RuntimeError):
        ag.WORKER.redecide(new_db)
    mid = snapshot(new_db, top)
    assert mid["cursor"] is not None and json.loads(mid["cursor"][0])["after"]
    assert not ag._REDECIDE.is_set(), "a cursor stands: the resume is what the next pass does, not a full restart"
    assert ag.WORKER.redecide_pending(new_db)
    monkeypatch.setattr(ag, "_between_decide_and_apply", lambda rows: None)
    # "after the restart": the in-memory flag is gone, the cursor is not
    ag.WORKER.redecide(new_db, resume=True)
    assert snapshot(new_db, top) == snapshot(old_db, top)
    assert not ag.WORKER.redecide_pending(new_db)


def test_a_resume_after_a_new_bump_redecides_the_chunks_before_the_cursor_too(env, tmp_path, monkeypatch):
    cast = build_installation(env, 200)
    monkeypatch.setattr(ag.Worker, "REDECIDE_CHUNK", 30)
    calls = {"n": 0}

    def crash_on_second(rows):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("killed")

    monkeypatch.setattr(ag, "_between_decide_and_apply", crash_on_second)
    with pytest.raises(RuntimeError):
        ag.WORKER.redecide(env.db)
    # while the process was down, k7a07 lost every station and the revision moved on
    with env.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = 't' WHERE subject_id = 'dev-k7a07'")
        bump_permission_revision(conn)
    ag._REDECIDE.clear()  # the restart lost the flag
    monkeypatch.setattr(ag, "_between_decide_and_apply", lambda rows: None)
    ag.WORKER.redecide(env.db, resume=True)
    with env.db.connection(mode="read") as conn:
        rev = permission_revision(conn)
        left = conn.execute(f"SELECT COUNT(*) FROM access_grants WHERE approved_by = 'dev-k7a07' AND state IN ({','.join('?' * len(ag.DECIDED))})",
                            ag.DECIDED).fetchone()[0]
        stale = conn.execute(f"SELECT COUNT(*) FROM access_grants WHERE state IN ({','.join('?' * len(ag.DECIDED))}) AND approval_revision < ?",
                             (*ag.DECIDED, rev)).fetchone()[0]
    assert cast and left == 0, "every grant of the approver who lost authority is withdrawn, before the cursor too"
    assert stale == 0, "every decided grant was re-decided against the current revision"


def test_the_worker_pass_resumes_a_standing_cursor_and_spends_it(env):
    gid = env.active_grant()
    with env.db.connection() as conn:
        set_setting(conn, CURSOR, json.dumps({"rev": 1, "after": ""}))
    summary = env.run()
    assert summary["redecided"] == 1 and env.grant(gid)["state"] == "active"
    assert not ag.WORKER.redecide_pending(env.db)
    assert env.run()["redecided"] == 0


def test_the_cursor_is_runtime_state_never_taken_from_or_put_in_an_archive():
    assert backup_svc._kept_setting(CURSOR)


# ================================================================ a change between the decision and the write

def _one_grant(env: Env, approver: str, doors: dict, state: str = "active") -> str:
    gid = ag.uuid.uuid4().hex
    with env.db.connection() as conn:
        conn.execute("""INSERT INTO access_grants(id, subject_kind, subject_id, source_kind, doors_json, valid_from, valid_until, credential, state,
                        pushed, requested_by, approved_by, approved_at, approval_revision, created_at, updated_at)
                        VALUES (?, 'contact', ?, 'manual', ?, ?, ?, 'pin', ?, 1, 'test', ?, ?, ?, ?, ?)""",
                     (gid, "c-" + gid[:8], json.dumps(doors), VF, VU, state, approver, VF, permission_revision(conn), VF, VF))
    return gid


@pytest.mark.parametrize("change", ["bump_and_revoke_binding", "deactivate_without_bump", "local_switch_off", "grant_row_edited"])
def test_a_change_between_decision_and_write_is_redecided_inside_the_write(env, monkeypatch, change):
    rid = env.role("מאשר", APPROVER)
    bind(env.c, env.settings, "appr", rid, "access_control_station", "st-a")
    approver = "dev-appr"
    if change == "local_switch_off":
        with env.db.connection() as conn:
            _copy_user(conn, "dev-appr", ag.LOCAL_ID_PREFIX + "appr")
            set_setting(conn, ag.LOCAL_KEY, "on")
            conn.execute("UPDATE bindings SET subject_id = ? WHERE subject_id = 'dev-appr'", (ag.LOCAL_ID_PREFIX + "appr",))
            bump_permission_revision(conn)
        approver = ag.LOCAL_ID_PREFIX + "appr"
    gid = _one_grant(env, approver, {"st-a": [1]})

    def meanwhile(rows):
        with env.db.connection() as conn:
            if change == "bump_and_revoke_binding":
                conn.execute("UPDATE bindings SET revoked_at = 't' WHERE subject_id = ?", (approver,))
                bump_permission_revision(conn)
            elif change == "deactivate_without_bump":
                conn.execute("UPDATE users SET active = 0 WHERE id = ?", (approver,))
            elif change == "local_switch_off":
                set_setting(conn, ag.LOCAL_KEY, "off")
            else:
                conn.execute("UPDATE access_grants SET doors_json = ?, revision = revision + 1 WHERE id = ?", (json.dumps({"st-a": [1], "st-z": [1]}), gid))

    monkeypatch.setattr(ag, "_between_decide_and_apply", meanwhile)
    ag.WORKER.redecide(env.db)
    g = env.grant(gid)
    if change == "grant_row_edited":
        assert g["state"] == "active" and json.loads(g["doors_json"]) == {"st-a": [1]}, "the edited row was re-decided (narrowed), not stamped"
    else:
        assert (g["state"], g["end_reason"]) == ("revoking", "approver_lost_authority"), "never applied from the stale snapshot"


# ================================================================ fail closed

def test_an_error_while_applying_is_a_revoke_exactly_as_before(env, tmp_path, monkeypatch):
    build_installation(env, 120)
    top = _audit_top(env.db)
    old_db, new_db = _clone(env, tmp_path, "old"), _clone(env, tmp_path, "new")
    with old_db.connection(mode="read") as conn:
        victims = {r[0] for r in conn.execute("SELECT id FROM access_grants WHERE state = 'active' ORDER BY id LIMIT 5").fetchall()}
    real_touch = ag._touch

    def flaky(conn, grant_id, fields, **k):
        if grant_id in victims and "state" not in fields:
            raise sqlite3.OperationalError("disk I/O error")
        return real_touch(conn, grant_id, fields, **k)

    monkeypatch.setattr(ag, "_touch", flaky)
    legacy_redecide(old_db)
    monkeypatch.setattr(ag.Worker, "REDECIDE_CHUNK", 9)
    ag.WORKER.redecide(new_db)
    old, new = snapshot(old_db, top), snapshot(new_db, top)
    assert new == old
    with new_db.connection(mode="read") as conn:
        states = dict(conn.execute("SELECT id, state FROM access_grants").fetchall())
    assert all(states[v] in ("revoking", "revoked") for v in victims)


def test_an_unreadable_grant_row_is_revoked_and_never_rolls_the_pass_back(env):
    """Regression (found by the K7 benchmark): mark_revoking parsed doors_json for its audit row, so a broken row raised INSIDE the
    fail-closed handler and rolled back the whole single transaction - no grant was re-decided at all."""
    rid = env.role("מאשר", APPROVER)
    bind(env.c, env.settings, "appr", rid, "access_control_station", "st-a")
    good = _one_grant(env, "dev-appr", {"st-a": [1]})
    bad = _one_grant(env, "dev-appr", {"st-a": [1]})
    env.sql("UPDATE access_grants SET doors_json = '{broken' WHERE id = ?", bad)
    with env.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = 't' WHERE subject_id = 'dev-appr'")
        bump_permission_revision(conn)
    ag._REDECIDE.clear()
    ag.WORKER.redecide(env.db)
    assert env.grant(bad)["state"] == "revoking" and env.grant(good)["state"] == "revoking"
    assert not ag.WORKER.redecide_pending(env.db)
    with env.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'access.grant.revoke' AND resource_id = ?", (bad,)).fetchone()
    assert row is not None and "stations" not in json.loads(row[0])


def test_an_error_before_the_first_chunk_commits_asks_for_another_pass(env, monkeypatch):
    build_installation(env, 20)
    monkeypatch.setattr(ag, "_between_decide_and_apply", lambda rows: (_ for _ in ()).throw(sqlite3.OperationalError("database is locked")))
    with pytest.raises(sqlite3.OperationalError):
        ag.WORKER.redecide(env.db)
    assert ag._REDECIDE.is_set() and not ag.WORKER.redecide_pending(env.db)


# ================================================================ benchmark (opt-in: K7_BENCH_GRANTS=<n>)

def _probe(db: Database, stop: threading.Event, waits: list[float]) -> None:
    """A small concurrent writer (an operator action): how long it waits for the write lock while the re-decision runs."""
    while not stop.is_set():
        t = time.monotonic()
        with db.write_aside(label="k7.probe") as conn:
            waits.append(time.monotonic() - t)
            conn.execute("INSERT INTO k7_probe(at) VALUES (?)", (t,))
        time.sleep(0.005)


def _measure(db: Database, run) -> dict:
    with db.connection() as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS k7_probe(at REAL)")
    stop, waits = threading.Event(), []
    probe = threading.Thread(target=_probe, args=(db, stop, waits), daemon=True)
    with write_holds() as holds:
        probe.start()
        time.sleep(0.05)
        t = time.monotonic()
        n = run(db)
        wall = time.monotonic() - t
        stop.set()
        probe.join(10)
    mine = [s for label, s in holds if label.startswith("access_grants.redecide")]
    return {"grants": n, "wall_s": round(wall, 3), "write_txns": len(mine), "max_hold_ms": round(1000 * max(mine), 1),
            "total_hold_ms": round(1000 * sum(mine), 1), "probe_writes": len(waits), "probe_max_wait_ms": round(1000 * max(waits), 1),
            "probe_p50_wait_ms": round(1000 * sorted(waits)[len(waits) // 2], 2)}


@pytest.mark.skipif(not os.environ.get("K7_BENCH_GRANTS"), reason="benchmark: set K7_BENCH_GRANTS=<number of grants>")
def test_k7_benchmark_write_lock(env, tmp_path, monkeypatch):
    n = int(os.environ["K7_BENCH_GRANTS"])
    build_installation(env, n)
    top = _audit_top(env.db)
    old_db, new_db = _clone(env, tmp_path, "old"), _clone(env, tmp_path, "new")
    before = _measure(old_db, legacy_redecide)
    after = _measure(new_db, lambda db: ag.WORKER.redecide(db))
    assert snapshot(new_db, top) == snapshot(old_db, top)
    report = {"decided_grants_in_data_set": n, "chunk": ag.Worker.REDECIDE_CHUNK, "before_single_transaction": before, "after_chunked": after}
    print("\nK7 BENCH " + json.dumps(report, indent=1))
    out = os.environ.get("K7_BENCH_OUT")
    if out:
        Path(out).write_text(json.dumps(report, indent=1), encoding="utf-8")
