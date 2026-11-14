"""WisKey M12 policy B, slice S3 (docs/changes/WISKEY-RC7-ADOPT-2331.md): `maintenance_v1` in the ONE SQLite generation journal
(journal.v2), the fenced generation / claim writers and the DORMANT prepare_v3 caller `wiskey_relay_map_native.maintain`.

FAKES ONLY: the port, the readiness answer, the witness provider and the completion proof are synthetic, built from the shapes of
WisKey's relay-maintenance-v1 examples (6049821d). Nothing here is Native, lineage (Q2) or Core proof, and no witness producer exists.
The Windows-runnable cases replace the file publication by a recorder (`fake_publication`); every case that needs the real flock
fence is POSIX-only (the runner): `posix_fence`."""
from __future__ import annotations

import copy
import json
import sqlite3
import threading
import time
from pathlib import Path

import pytest

from smplwise import db as dbm
from smplwise.db import Database, get_setting, set_setting
from smplwise.services import wiskey_auto_install as install
from smplwise.services import wiskey_call_budget as budget
from smplwise.services import wiskey_install_generation as gen
from smplwise.services import wiskey_native_projection as projection
from smplwise.services import wiskey_relay_map as rm
from smplwise.services import wiskey_relay_map_export as rmx
from smplwise.services import wiskey_relay_map_native as native
from smplwise.services.wiskey_capture_port import PortError, PortIdentity

BACKEND = Path(__file__).resolve().parents[1]
PACKAGE = BACKEND / "smplwise"
posix_fence = pytest.mark.skipif(not projection.fence_supported(),
                                 reason="WisKey M12 S3: the real generation fence needs fcntl (runner, Linux)")
LOADED = {"smplwise_bridge": "a" * 64, "hikvision_intercom": "b" * 64}
PAIR = projection.pair_digest(LOADED)
BINDING = {"repository_id": "913d2f99-4b2c-4216-a6c9-f825bd057953", "bridge_entry_id": "synthetic-bridge",
           "query_owner_id": "synthetic-subject", "connection_ref": "synthetic-connection"}


# ---------------------------------------------------------------- fixtures and synthetic shapes

@pytest.fixture
def db(tmp_path, monkeypatch):
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(tmp_path / "absent"))  # no HA config dir: nothing published, nothing withdrawn
    value = Database(tmp_path / "synthetic-arx.sqlite")
    value.migrate()
    return value


def switch(db, on=True):
    with db.connection() as conn:  # TEST ONLY: production has one writer (the owner's route), which refuses ON in this build
        set_setting(conn, install.SWITCH_KEY, "on" if on else "off")


def requested(db, digest=PAIR):
    gid = gen.begin(db, None, digest)
    claim = gen.claim_restart(db, None, gid, digest)
    assert gen.finish_restart(db, None, gid, claim, True) == gen.REQUESTED
    return gid


def intent_for(gid, digest=PAIR, token="synthetic-token", **over):
    value = {"contract": gen.MAINTENANCE_CONTRACT, "schema_version": 1, "producer": gen.MAINTENANCE_PRODUCER,
             "generation_id": gid, "source_digest": digest, "token": token, "actor": "synthetic-actor",
             "repository_id": BINDING["repository_id"], "bridge_entry_id": BINDING["bridge_entry_id"],
             "query_owner_id": BINDING["query_owner_id"], "native_boot_id": "synthetic-native-boot", "seq": 1,
             "content_digest": "sha256:" + "b" * 64, "projection_sha256": "c" * 64,
             "deadline_unix_ms": int(time.time() * 1000) + 600_000, "state": "intent", "witness": None}
    value.update(over)
    return value


def witness_for(row, **over):
    value = {"contract": gen.WITNESS_CONTRACT, "schema_version": 1, "producer": "arx-original-lineage:relay/v1",
             "scope": "outside_core_and_arx_restore", "incarnation_id": "synthetic-incarnation", "checkpoint": "a" * 64,
             "anchor": "a" * 64, "head": "a" * 64, "status": "current", "boot_id": "synthetic-boot",
             "connection_ref": "synthetic-connection", "position": 10, "anchor_position": 10, "head_position": 10,
             **{k: row[k] for k in ("generation_id", "token", "seq", "content_digest", "repository_id", "bridge_entry_id",
                                    "query_owner_id")}}
    value.update(over)
    return value


def completion(row):
    """result.v1 for exactly this stored intent (witness bound)."""
    return {"contract": gen.RESULT_CONTRACT, "schema_version": 1, "generation_id": row["generation_id"], "token": row["token"],
            "intent_sha256": gen.intent_sha256(row), "state": "prepared", "startup_committed": True, "entries_reloaded": True,
            "replay_available": False,
            "ack": {"contract": "wiskey-relay-map-ack.v1", "schema_version": 1, "state": "prepared", "code": None,
                    "seq": row["seq"], "content_digest": row["content_digest"], "repository_id": row["repository_id"],
                    "projection_sha256": row["projection_sha256"], "activation": "not_performed", "loaded": False,
                    "ready": False}}


def row_of(db):
    return gen.read(db)[gen.MAINTENANCE_KEY]


def to(db, row, expected, state, proof=None):
    return gen.maintenance_transition(db, generation_id=row["generation_id"], token=row["token"], expected=expected, state=state,
                                      proof=proof)


def begun_with_witness(db, digest=PAIR, token="synthetic-token"):
    switch(db)
    gid = requested(db, digest)
    i = intent_for(gid, digest=digest, token=token)
    assert gen.begin_maintenance(db, i) == "intent"
    assert gen.bind_maintenance_witness(db, generation_id=gid, token=i["token"], witness=witness_for(i)) == "intent"
    return row_of(db)


def dispatched(db, digest=PAIR, token="synthetic-token"):
    row = begun_with_witness(db, digest, token)
    assert to(db, row, "intent", "invalidated") == "invalidated"
    assert to(db, row, "invalidated", "dispatched") == "dispatched"
    return row_of(db)


# ---------------------------------------------------------------- dormancy (policy B): OFF and no witness = unreachable

def test_dormant_switch_off_the_journal_writer_refuses_and_writes_nothing(db):
    gid = requested(db)
    before = gen.read(db)
    assert gen.begin_maintenance(db, intent_for(gid)) == "refused"
    assert gen.read(db) == before and "format" not in before
    with db.connection(mode="read") as conn:
        assert get_setting(conn, install.SWITCH_KEY) is None  # nothing turned the switch on


class Port:
    """Synthetic direct port: records every call; `prepare` decides the prepare_v3 answer."""

    def __init__(self, db, gid=None, *, prepare=None, readiness_over=None):
        self.db, self.gid, self.calls, self.prepare, self.readiness_over = db, gid, [], prepare, readiness_over or {}

    def identity(self):
        return PortIdentity(BINDING["bridge_entry_id"], BINDING["query_owner_id"], BINDING["repository_id"], BINDING["connection_ref"])

    def call(self, command, parameters, *, timeout_s):
        assert timeout_s > 0
        self.calls.append((command, copy.deepcopy(parameters)))
        if command == native.SOURCE:
            return {"contract": native.CONTRACT, "schema_version": 1, "binding": dict(BINDING), "inventory": {},
                    "anti_rollback_scope": "surviving_native_projection", "full_restore_continuity": "not_proven"}
        if command == native.READINESS:
            answer = {"contract": "wiskey-installation-readiness.v1", "schema_version": 1, "state": "ready", "reason": None,
                      "generation_id": self.gid, "boot_id": "synthetic-native-boot", "process_id": 1, "expected": dict(LOADED),
                      "staged": dict(LOADED), "installed": dict(LOADED), "loaded": dict(LOADED), "bridge_boot_id": "synthetic-bridge-boot",
                      "restart": None, "connection_ref": "synthetic-connection", "bridge_entry_id": "synthetic-bridge",
                      "installation_id": "synthetic-installation", "grant_ref": {}, "cloud_resources_state": "synthetic"}
            answer.update(self.readiness_over)
            return answer
        if command == native.PREPARE_V3:
            return self.prepare(parameters)
        raise AssertionError("unexpected command " + command)


def staged_export(db):
    with db.connection() as conn:
        rm.save(conn, station_id="synthetic-station", rows={1: 2, 2: 1}, expected_revision=0, by="synthetic-original-actor",
                known_relays=(1, 2))
        record = rmx.export(conn, by="synthetic-original-actor").full()
    return {"state": "staged", "record": record,
            "ack": {"contract": "wiskey-relay-map-ack.v1", "schema_version": 1, "state": "staged", "code": None, "seq": record["seq"],
                    "content_digest": record["content_digest"], "repository_id": BINDING["repository_id"],
                    "projection_sha256": "c" * 64, "activation": "not_performed", "loaded": False, "ready": False}}


def test_dormant_maintain_with_the_switch_off_does_nothing_at_all(db):
    gid = requested(db)
    staged = staged_export(db)
    before = gen.read(db)
    called = []
    port = Port(db, gid, prepare=lambda p: called.append(p))
    out = native.maintain(db, port, staged, root=Path("unused"), by="synthetic-actor",
                          witness_provider=lambda *a: called.append(a) or witness_for(a[0]))
    assert out == {"state": "switch_off"}
    assert port.calls == [] and called == [] and gen.read(db) == before


def test_dormant_maintain_without_a_witness_provider_is_blocked_before_any_io(db):
    switch(db)
    gid = requested(db)
    staged = staged_export(db)
    before = gen.read(db)
    port = Port(db, gid, prepare=lambda p: pytest.fail("prepare_v3 sent"))
    out = native.maintain(db, port, staged, root=Path("unused"), by="synthetic-actor")
    assert out == {"state": "blocked", "code": "relay_witness_unavailable"}
    assert port.calls == [] and gen.read(db) == before


def test_static_no_production_caller_no_witness_provider_and_prepare_v3_only_in_the_adapter():
    """The path stays unreachable in this build: nothing calls `maintain`, nothing defines or passes a witness provider, the
    maintenance journal writers / publication are used only by the three S3 modules, and the prepare_v3 command name lives only in
    the adapter (the catalog imports COMMANDS by name)."""
    s3 = {"wiskey_install_generation.py", "wiskey_native_projection.py", "wiskey_relay_map_native.py"}
    hits = {"maintain": [], "witness_provider": [], "writers": [], "prepare_v3": []}
    for path in PACKAGE.rglob("*.py"):
        text, name = path.read_text(encoding="utf-8"), path.relative_to(BACKEND).as_posix()
        if path.name == "wiskey_relay_map_native.py":
            continue
        if ".maintain(" in text or "import maintain" in text or "maintain as" in text:
            hits["maintain"].append(name)
        if "witness_provider" in text:
            hits["witness_provider"].append(name)
        if path.name not in s3 and any(w in text for w in ("begin_maintenance", "bind_maintenance_witness", "maintenance_transition",
                                                           "publish_maintenance")):
            hits["writers"].append(name)
        if "relay_map_prepare_v3" in text or "PREPARE_V3" in text:
            hits["prepare_v3"].append(name)
    assert hits == {"maintain": [], "witness_provider": [], "writers": [], "prepare_v3": []}


# ---------------------------------------------------------------- the journal (journal.v2, maintenance_v1)

def test_no_restart_no_second_generation_and_unknown_is_never_replayed(db):
    switch(db)
    gid = requested(db)
    before = gen.read(db)
    i = intent_for(gid)
    assert gen.begin_maintenance(db, i) == "intent"
    after = gen.read(db)
    assert all(after[k] == before[k] for k in ("generation_id", "digest", "state", "claim", "proof"))
    assert after["format"] == gen.JOURNAL_V2 and after["schema_version"] == 2 and after["maintenance_v1"] == i
    assert after["maintenance_history"] == {} and after["maintenance_proof"] is None
    with db.connection(mode="read") as conn:  # the same one setting: no second journal / counter key
        keys = {r[0] for r in conn.execute("SELECT key FROM settings WHERE key LIKE 'wiskey.installation.%'")}
    assert keys == {gen.GENERATION_KEY, gen.RESTART_DIGEST_KEY}
    assert gen.begin_maintenance(db, intent_for(gid, token="synthetic-second")) == gen.STALE  # one active intent
    assert to(db, i, "intent", "invalidated") == "refused"  # witness not bound yet: null admits nothing
    assert gen.bind_maintenance_witness(db, generation_id=gid, token=i["token"], witness=witness_for(i)) == "intent"
    assert to(db, i, "intent", "invalidated") == "invalidated"
    assert to(db, i, "invalidated", "dispatched") == "dispatched"
    assert to(db, i, "dispatched", "cancelled") == "refused"
    assert to(db, i, "dispatched", "refused") == "refused"
    assert to(db, i, "dispatched", "unknown") == "unknown"
    assert gen.begin_maintenance(db, intent_for(gid, token="synthetic-third")) == gen.STALE  # UNKNOWN blocks; never replayed
    assert gen.begin_maintenance(db, i) == gen.STALE


def test_the_intent_is_closed_and_committed_without_a_witness(db):
    switch(db)
    gid = requested(db)
    bad = [intent_for(gid, witness=witness_for(intent_for(gid))), intent_for(gid, deadline_unix_ms=1),
           intent_for(gid, seq=True), intent_for(gid, schema_version=True), intent_for(gid, producer="synthetic"),
           intent_for(gid, state="dispatched"), intent_for(gid, content_digest="b" * 64), intent_for(gid, actor="bad\nactor"),
           {**intent_for(gid), "forbidden_extra": 1}]
    missing = intent_for(gid)
    del missing["native_boot_id"]
    before = gen.read(db)
    for value in [*bad, missing, None, "intent"]:
        assert gen.begin_maintenance(db, value) == "refused"
    assert gen.read(db) == before
    assert gen.begin_maintenance(db, intent_for("synthetic-other-generation")) == gen.STALE
    assert gen.begin_maintenance(db, intent_for(gid, digest="synthetic-other-digest")) == gen.STALE


def test_maintenance_needs_restart_requested_of_the_current_generation(db):
    switch(db)
    gid = gen.begin(db, None, PAIR)  # staged
    assert gen.begin_maintenance(db, intent_for(gid)) == gen.STALE
    claim = gen.claim_restart(db, None, gid, PAIR)
    assert gen.begin_maintenance(db, intent_for(gid)) == gen.STALE  # restart_claimed is not loaded proof
    assert gen.finish_restart(db, None, gid, claim, False) == gen.UNKNOWN
    assert gen.begin_maintenance(db, intent_for(gid)) == gen.STALE  # restart_unknown neither


def test_the_witness_is_closed_bound_to_the_intent_and_bound_once(db):
    switch(db)
    gid = requested(db)
    i = intent_for(gid)
    assert gen.begin_maintenance(db, i) == "intent"
    before = gen.read(db)
    for w in (witness_for(i, status="stale"), witness_for(i, token="synthetic-other"), witness_for(i, seq=2),
              witness_for(i, generation_id="synthetic-other"), witness_for(i, query_owner_id="synthetic-other"),
              witness_for(i, schema_version=True), witness_for(i, checkpoint="z" * 64), {**witness_for(i), "extra": 1}, None, []):
        assert gen.bind_maintenance_witness(db, generation_id=gid, token=i["token"], witness=w) == "refused"
    assert gen.read(db) == before
    assert gen.bind_maintenance_witness(db, generation_id=gid, token="synthetic-other", witness=witness_for(i)) == gen.STALE
    assert gen.bind_maintenance_witness(db, generation_id=gid, token=i["token"], witness=witness_for(i)) == "intent"
    assert row_of(db)["witness"] == witness_for(i)
    assert gen.bind_maintenance_witness(db, generation_id=gid, token=i["token"], witness=witness_for(i)) == gen.STALE  # once


def test_the_absolute_deadline_refuses_dispatch_and_only_cancel_remains(db, monkeypatch):
    row = begun_with_witness(db)
    assert to(db, row, "intent", "invalidated") == "invalidated"
    monkeypatch.setattr(gen, "_now_ms", lambda: row["deadline_unix_ms"])  # the end itself is already too late
    assert to(db, row, "invalidated", "dispatched") == "refused"
    assert to(db, row, "invalidated", "cancelled") == "cancelled"
    assert row_of(db)["state"] == "cancelled"


def test_switch_off_mid_flight_refuses_forward_steps_but_lets_the_intent_settle(db):
    row = begun_with_witness(db)
    switch(db, on=False)
    assert to(db, row, "intent", "invalidated") == "refused"
    assert to(db, row, "intent", "cancelled") == "cancelled"
    row = dispatched(db, "synthetic-next", "synthetic-next-token")  # switches on again
    switch(db, on=False)
    assert to(db, row, "dispatched", "unknown") == "unknown"  # an attempt that exists is recorded UNKNOWN whatever the switch


def test_late_completion_never_overwrites_a_new_generation(db):
    row = begun_with_witness(db)
    gen.begin(db, None, "synthetic-B")
    before = copy.deepcopy(gen.read(db))
    assert to(db, row, "intent", "cancelled") == gen.STALE
    assert gen.bind_maintenance_witness(db, generation_id=row["generation_id"], token=row["token"], witness=witness_for(row)) == gen.STALE
    assert gen.read(db) == before


def test_superseded_intents_are_archived_in_the_same_journal(db):
    row = dispatched(db)
    gid = gen.begin(db, None, "synthetic-B")
    value = gen.read(db)
    assert value["generation_id"] == gid and value["maintenance_v1"] is None and value["format"] == gen.JOURNAL_V2
    assert value["maintenance_history"][row["token"]]["intent"]["state"] == "unknown"  # attempted -> UNKNOWN, kept
    assert value["maintenance_history"][row["token"]]["intent"]["witness"] == row["witness"]  # the exact intent
    before = copy.deepcopy(value)
    assert to(db, row, "dispatched", "unknown") == gen.STALE
    assert gen.read(db) == before
    # not attempted -> cancelled
    gid2 = requested(db, "synthetic-C")
    i2 = intent_for(gid2, digest="synthetic-C", token="synthetic-c-token")
    assert gen.begin_maintenance(db, i2) == "intent"
    gen.begin(db, None, "synthetic-D")
    history = gen.read(db)["maintenance_history"]
    assert history["synthetic-c-token"]["intent"]["state"] == "cancelled" and history[row["token"]]["intent"]["state"] == "unknown"


def test_exact_completion_proof_is_kept_beside_the_reconcile_proof_and_survives_the_next_generation(db):
    row = dispatched(db)
    proof = completion(row)
    assert to(db, row, "dispatched", "prepared", proof) == "prepared"
    assert gen.record_proof(db, row["generation_id"], "reconcile", "observed") == "recorded"
    value = gen.read(db)
    assert value["maintenance_proof"] == proof and value["proof"]["outcome"] == "observed"
    gid = gen.begin(db, None, "synthetic-next")
    assert gen.read(db)["maintenance_history"][row["token"]] == {"intent": {**row, "state": "prepared"}, "proof": proof}
    claim = gen.claim_restart(db, None, gid, "synthetic-next")
    gen.finish_restart(db, None, gid, claim, True)
    nxt = intent_for(gid, digest="synthetic-next", token="synthetic-next-intent")
    assert gen.begin_maintenance(db, nxt) == "intent"  # the active slot is free after the generation change
    assert gen.begin_maintenance(db, intent_for(gid, digest="synthetic-next", token=row["token"])) == gen.STALE


def test_a_token_names_one_intent_forever(db):
    row = begun_with_witness(db)
    assert to(db, row, "intent", "cancelled") == "cancelled"
    gid = row["generation_id"]
    assert gen.begin_maintenance(db, intent_for(gid, token=row["token"])) == "refused"  # archived token never reused
    assert gen.begin_maintenance(db, intent_for(gid, token="synthetic-fresh")) == "intent"
    assert gen.read(db)["maintenance_history"][row["token"]]["intent"]["state"] == "cancelled"


@pytest.mark.parametrize("field,value", [("intent_sha256", "e" * 64), ("entries_reloaded", False), ("startup_committed", False),
                                         ("schema_version", True), ("forbidden_extra", "synthetic"), ("replay_available", True),
                                         ("token", "synthetic-other"), ("state", "unknown")])
def test_an_unmatching_or_open_completion_cannot_settle_unknown(db, field, value):
    row = dispatched(db)
    assert to(db, row, "dispatched", "unknown") == "unknown"
    bad = completion(row)
    bad[field] = value
    before = copy.deepcopy(gen.read(db))
    assert to(db, row, "unknown", "prepared", bad) == "refused"
    assert gen.read(db) == before


@pytest.mark.parametrize("field,value", [("loaded", True), ("ready", True), ("code", "synthetic_error"), ("activation", "performed"),
                                         ("seq", 2), ("projection_sha256", "d" * 64), ("state", "staged"), ("schema_version", True)])
def test_an_ack_of_anything_else_cannot_settle(db, field, value):
    row = dispatched(db)
    bad = completion(row)
    bad["ack"][field] = value
    assert to(db, row, "dispatched", "prepared", bad) == "refused"
    assert to(db, row, "dispatched", "prepared", {"signed_error": True}) == "refused"
    assert row_of(db)["state"] == "dispatched"
    assert to(db, row, "dispatched", "prepared", completion(row)) == "prepared"  # the exact proof still settles


def test_history_capacity_refuses_before_loss(db, monkeypatch):
    row = begun_with_witness(db)
    assert to(db, row, "intent", "cancelled") == "cancelled"
    monkeypatch.setattr(gen, "HISTORY_MAX", 0)
    before = gen.read(db)
    assert gen.begin_maintenance(db, intent_for(row["generation_id"], token="synthetic-new")) == "refused"
    with pytest.raises(ValueError, match="maintenance_history_capacity"):
        gen.begin(db, None, "synthetic-B")
    assert gen.read(db) == before  # nothing lost, nothing written


# ---------------------------------------------------------------- the caller: order, one deadline, UNKNOWN, no replay (fake files)

@pytest.fixture
def fake_publication(db, monkeypatch):
    """Windows-runnable stand-in for the file publication: records each published state and asserts it is the COMMITTED journal
    (read through a fresh read connection) - the order DB -> JOURNAL_LOCK -> fence itself is covered by the POSIX cases."""
    events = []

    def publish(database, root, *, generation_id, token):
        assert not gen.JOURNAL_LOCK._is_owned()
        with database.connection(mode="read", label="synthetic publication reader") as conn:
            row = gen.read(database, conn).get(gen.MAINTENANCE_KEY)
        assert row["token"] == token and row["generation_id"] == generation_id
        events.append(("publish", row["state"], row["witness"] is not None))
        return row["state"]

    monkeypatch.setattr(projection, "publish_maintenance", publish)
    return events


def _provider(db, events, *, answer="witness"):
    def provider(intent, binding):
        # outside every lock: not under JOURNAL_LOCK, and an independent writer gets the database at once
        assert not gen.JOURNAL_LOCK._is_owned()
        with db.write_aside(label="synthetic independent writer during the provider", wait_s=1):
            pass
        stored = row_of(db)
        assert stored == intent and stored["state"] == "intent" and stored["witness"] is None  # committed before the call
        assert events and events[-1] == ("publish", "intent", False)  # ... and published before the call
        assert binding == BINDING and budget.active()  # inside the one budget
        events.append(("provider",))
        if answer == "witness":
            return witness_for(intent)
        if answer == "none":
            return None
        if answer == "late":
            budget._clock = lambda: float("inf")  # noqa: SLF001 - controlled clock: the one end has passed
            return witness_for(intent)
        raise RuntimeError("synthetic provider failure")
    return provider


def _dispatch(db, events, reply):
    def prepare(parameters):
        stored = row_of(db)
        assert stored["state"] == "dispatched" and events[-1] == ("publish", "dispatched", True)  # CAS + publication before I/O
        assert not gen.JOURNAL_LOCK._is_owned()
        assert parameters == {"contract": gen.MAINTENANCE_CONTRACT, "schema_version": 1, "binding": BINDING,
                              "seq": stored["seq"], "content_digest": stored["content_digest"],
                              "projection_sha256": stored["projection_sha256"], "token": stored["token"],
                              "intent_sha256": gen.intent_sha256(stored)}
        events.append(("prepare_v3",))
        return reply(stored)
    return prepare


def test_the_caller_commits_and_publishes_the_intent_before_the_provider_then_cas_witness_dispatch(db, fake_publication):
    switch(db)
    gid = requested(db)
    staged = staged_export(db)
    port = Port(db, gid)
    port.prepare = _dispatch(db, fake_publication, lambda stored: completion(stored))
    started = time.time()
    out = native.maintain(db, port, staged, root=Path("unused"), by="synthetic-actor",
                          witness_provider=_provider(db, fake_publication), timeout_s=10)
    assert out["state"] == "prepared"
    assert fake_publication == [("publish", "intent", False), ("provider",), ("publish", "intent", True),
                                ("publish", "invalidated", True), ("publish", "dispatched", True), ("prepare_v3",),
                                ("publish", "prepared", True)]
    assert [c for c, _ in port.calls] == [native.SOURCE, native.READINESS, native.PREPARE_V3]
    value = gen.read(db)
    row = value[gen.MAINTENANCE_KEY]
    assert row["state"] == "prepared" and value["maintenance_proof"] == out["result"]  # exact proof kept
    assert row["seq"] == staged["record"]["seq"] and row["content_digest"] == staged["record"]["content_digest"]
    assert row["native_boot_id"] == "synthetic-native-boot" and row["actor"] == "synthetic-actor"
    assert started * 1000 < row["deadline_unix_ms"] <= (time.time() + 10) * 1000  # the one budget's end
    assert value["state"] == gen.REQUESTED and value["generation_id"] == gid  # no restart, no new generation


@pytest.mark.parametrize("failure", ["lost", "signed_error", "wrong_hash", "wrong_ack", "deadline"])
def test_after_dispatch_every_failure_is_unknown_and_never_replayed(db, fake_publication, monkeypatch, failure):
    monkeypatch.setattr(budget, "_clock", budget._clock)  # restored after the `deadline` case
    switch(db)
    gid = requested(db)
    staged = staged_export(db)

    def reply(stored):
        if failure == "lost":
            raise PortError("synthetic_ack_loss", "not_sent")  # even a transport `not_sent` is no proof once dispatched
        if failure == "deadline":  # the one end passes during the call: UNKNOWN must still be recorded (outside the budget)
            budget._clock = lambda: float("inf")  # noqa: SLF001
            raise budget.DeadlineExpired("deadline_expired")
        if failure == "signed_error":
            return {"success": False, "error": {"code": "synthetic_signed_error"}}
        value = completion(stored)
        if failure == "wrong_hash":
            value["intent_sha256"] = "e" * 64
        else:
            value["ack"]["seq"] = stored["seq"] + 1
        return value

    port = Port(db, gid)
    port.prepare = _dispatch(db, fake_publication, reply)
    with pytest.raises(PortError) as err:
        native.maintain(db, port, staged, root=Path("unused"), by="synthetic-actor", witness_provider=_provider(db, fake_publication))
    assert err.value.code == "relay_maintenance_outcome_unknown" and err.value.outcome == "unknown"
    assert row_of(db)["state"] == "unknown" and gen.read(db)["maintenance_proof"] is None
    assert fake_publication[-1] == ("publish", "unknown", True)
    sent = [c for c, _ in port.calls].count(native.PREPARE_V3)
    monkeypatch.setattr(budget, "_clock", time.monotonic)
    again = native.maintain(db, port, staged, root=Path("unused"), by="synthetic-actor",
                            witness_provider=_provider(db, fake_publication))
    assert again == {"state": gen.STALE, "code": "relay_maintenance_stale"}
    assert sent == 1 and [c for c, _ in port.calls].count(native.PREPARE_V3) == 1  # never replayed


def test_a_verified_answer_at_the_very_end_of_the_budget_is_still_recorded(db, fake_publication, monkeypatch):
    monkeypatch.setattr(budget, "_clock", budget._clock)
    switch(db)
    gid = requested(db)
    staged = staged_export(db)

    def reply(stored):
        budget._clock = lambda: float("inf")  # noqa: SLF001 - the end passes as the answer arrives
        return completion(stored)

    port = Port(db, gid)
    port.prepare = _dispatch(db, fake_publication, reply)
    out = native.maintain(db, port, staged, root=Path("unused"), by="synthetic-actor", witness_provider=_provider(db, fake_publication))
    assert out["state"] == "prepared" and row_of(db)["state"] == "prepared" and gen.read(db)["maintenance_proof"] == out["result"]


@pytest.mark.parametrize("answer,state,code,final", [("none", "blocked", "relay_witness_unavailable", "refused"),
                                                     ("raise", "refused", "relay_witness_failed", "refused"),
                                                     ("late", "cancelled", "deadline_expired", "cancelled")])
def test_no_witness_or_a_passed_deadline_stops_before_dispatch(db, fake_publication, monkeypatch, answer, state, code, final):
    monkeypatch.setattr(budget, "_clock", budget._clock)  # restored after the `late` case
    switch(db)
    gid = requested(db)
    staged = staged_export(db)
    port = Port(db, gid, prepare=lambda p: pytest.fail("prepare_v3 sent"))
    out = native.maintain(db, port, staged, root=Path("unused"), by="synthetic-actor",
                          witness_provider=_provider(db, fake_publication, answer=answer))
    assert out == {"state": state, "code": code}
    assert row_of(db)["state"] == final and row_of(db)["witness"] is None
    assert native.PREPARE_V3 not in [c for c, _ in port.calls]


def test_a_dispatch_past_the_intents_deadline_is_cancelled_not_sent(db, fake_publication, monkeypatch):
    switch(db)
    gid = requested(db)
    staged = staged_export(db)
    real = gen.maintenance_transition

    def late(database, **kw):
        if kw.get("state") == "dispatched":
            monkeypatch.setattr(gen, "_now_ms", lambda: 2 ** 52)
        return real(database, **kw)

    monkeypatch.setattr(gen, "maintenance_transition", late)
    port = Port(db, gid, prepare=lambda p: pytest.fail("prepare_v3 sent"))
    out = native.maintain(db, port, staged, root=Path("unused"), by="synthetic-actor", witness_provider=_provider(db, fake_publication))
    assert out == {"state": "cancelled", "code": "relay_maintenance_not_dispatched"}
    assert row_of(db)["state"] == "cancelled"


@pytest.mark.parametrize("over", [{"generation_id": "synthetic-other"}, {"loaded": {"smplwise_bridge": "c" * 64,
                                                                                      "hikvision_intercom": "b" * 64},
                                                                           "expected": {"smplwise_bridge": "c" * 64,
                                                                                        "hikvision_intercom": "b" * 64},
                                                                           "staged": {"smplwise_bridge": "c" * 64,
                                                                                      "hikvision_intercom": "b" * 64},
                                                                           "installed": {"smplwise_bridge": "c" * 64,
                                                                                         "hikvision_intercom": "b" * 64}}])
def test_no_intent_without_the_loaded_pair_of_this_generation(db, fake_publication, over):
    switch(db)
    gid = requested(db)
    staged = staged_export(db)
    before = gen.read(db)
    port = Port(db, gid, prepare=lambda p: pytest.fail("prepare_v3 sent"), readiness_over=over)
    out = native.maintain(db, port, staged, root=Path("unused"), by="synthetic-actor", witness_provider=_provider(db, fake_publication))
    assert out == {"state": "refused", "code": "relay_maintenance_pair_not_loaded"}
    assert gen.read(db) == before and fake_publication == []


# ---------------------------------------------------------------- db.on_transaction_end (the fence's release point)

def test_the_release_runs_once_after_the_commit_and_also_after_a_rollback(tmp_path):
    database = Database(tmp_path / "synthetic-hook.sqlite")
    database.migrate()
    seen = []

    def committed(label):
        def release():
            with database.connection(mode="read", label="synthetic reader") as conn:
                seen.append((label, get_setting(conn, "synthetic.key")))
        return release

    with database.write_aside(label="synthetic write") as conn:
        set_setting(conn, "synthetic.key", "one")
        assert dbm.on_transaction_end(conn, committed("aside")) is True
        assert seen == []
    assert seen == [("aside", "one")]
    with database.connection(label="synthetic start-up") as conn:  # a caller's long transaction, committed mid-way by unlocked()
        set_setting(conn, "synthetic.key", "two")
        assert dbm.on_transaction_end(conn, committed("start-up")) is True
        with dbm.unlocked(conn):
            assert seen[-1] == ("start-up", "two")
        set_setting(conn, "synthetic.key", "three")
    assert len(seen) == 2  # once
    with pytest.raises(RuntimeError):
        with database.connection(label="synthetic failing") as conn:
            set_setting(conn, "synthetic.key", "four")
            dbm.on_transaction_end(conn, committed("rollback"))
            raise RuntimeError("synthetic")
    assert seen[-1] == ("rollback", "three")
    raw = sqlite3.connect(tmp_path / "synthetic-raw.sqlite")
    try:
        assert dbm.on_transaction_end(raw, lambda: None) is False  # not a lease of this module: the caller releases at once
    finally:
        raw.close()


# ---------------------------------------------------------------- the real fence (POSIX / runner); the typed refusal (Windows)

def _ha_root(tmp_path, monkeypatch, *, private_dir=True):
    root = tmp_path / "ha"
    root.mkdir()
    (root / "configuration.yaml").write_text("homeassistant:\n")
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(root))
    if private_dir:
        (root / projection.RELATIVE).parent.mkdir(parents=True)
    return root


@pytest.mark.skipif(projection.fence_supported(), reason="the Windows workstation case: no fcntl")
def test_without_fcntl_a_decision_writer_refuses_typed_and_changes_nothing(db, tmp_path, monkeypatch):
    gid = requested(db)
    before = gen.read(db)
    root = _ha_root(tmp_path, monkeypatch)
    (root / projection.RELATIVE).write_text("{}")
    with pytest.raises(install.InstallationError) as err:
        gen.begin(db, None, "synthetic-B")
    assert err.value.code == projection.FENCE_UNSUPPORTED
    assert gen.read(db) == before and gen.read(db)["generation_id"] == gid
    assert (root / projection.RELATIVE).read_text() == "{}"  # nothing withdrawn without the fence either


def test_no_projection_directory_means_nothing_withdrawn_and_nothing_created(db, tmp_path, monkeypatch):
    root = _ha_root(tmp_path, monkeypatch, private_dir=False)
    requested(db)
    gen.begin(db, None, "synthetic-B")
    assert not (root / projection.RELATIVE).parent.exists()


def _published(db, root):
    for name in projection.NAMES:
        d = root / "custom_components" / name
        d.mkdir(parents=True)
        (d / "manifest.json").write_text(json.dumps({"domain": name, "version": "synthetic"}))
    expected = {name: projection.digest(root / "custom_components" / name) for name in projection.NAMES}
    pair = projection.pair_digest(expected)
    gid = gen.begin(db, None, pair)
    claim = gen.claim_restart(db, None, gid, pair)
    gen.finish_restart(db, None, gid, claim, True)
    assert projection.publish(db, root, expected, generation_id=gid, claim=claim)["state"] == gen.REQUESTED
    return gid, pair, expected


@posix_fence
def test_an_arx_decision_writer_waits_for_natives_commit_fence(db, tmp_path, monkeypatch):
    """Contribution case (test_original_generation_writer_waits_for_native_commit_fence), adopted."""
    root = _ha_root(tmp_path, monkeypatch, private_dir=False)
    _published(db, root)
    path = root / projection.RELATIVE
    before = path.read_bytes()
    started, done, errors = threading.Event(), threading.Event(), []

    def writer():
        started.set()
        try:
            gen.begin(db, None, "synthetic-new-generation")
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)
        finally:
            done.set()

    with projection.generation_fence(root):  # "Native" holds the fence across its start-up commit
        thread = threading.Thread(target=writer)
        thread.start()
        assert started.wait(1)
        assert not done.wait(.2)
        assert path.read_bytes() == before
    assert done.wait(3)
    thread.join()
    assert not errors and not path.exists()
    assert gen.read(db)["digest"] == "synthetic-new-generation"


@posix_fence
@pytest.mark.parametrize("outcome", ["commit", "rollback"])
def test_the_fence_is_held_across_the_callers_start_up_commit(db, tmp_path, monkeypatch, outcome):
    root = _ha_root(tmp_path, monkeypatch, private_dir=False)
    gid, _, _ = _published(db, root)
    (root / projection.MAINTENANCE_RELATIVE).write_text("{}")
    got, seen = threading.Event(), []

    def native_side():
        with projection.generation_fence(root):
            seen.append(gen.read(db)["generation_id"])
            got.set()

    with pytest.raises(RuntimeError) if outcome == "rollback" else _null():
        with db.connection(label="synthetic add-on start-up") as conn:
            new = gen.begin(db, conn, "synthetic-start-up-generation")
            gen.claim_restart(db, conn, new, "synthetic-start-up-generation")  # the same transaction enters the fence again
            assert not (root / projection.RELATIVE).exists() and not (root / projection.MAINTENANCE_RELATIVE).exists()
            assert not fence_free(root)
            thread = threading.Thread(target=native_side)
            thread.start()
            assert not got.wait(.5)  # Native waits: the decision is not committed yet
            if outcome == "rollback":
                raise RuntimeError("synthetic start-up failure")
    assert got.wait(2)
    thread.join()
    if outcome == "commit":
        assert seen == [new] and gen.read(db)["generation_id"] == new  # released only after the commit
    else:
        assert seen == [gid] and gen.read(db)["generation_id"] == gid  # rolled back: old decision, admission withdrawn
        assert not (root / projection.RELATIVE).exists()


def fence_free(root):
    """True when no open file description holds the generation fence (a new one of this process would get it at once)."""
    import fcntl
    import os

    fd = os.open((root / projection.RELATIVE).parent / projection.FENCE_NAME, os.O_RDWR | os.O_CREAT, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        fcntl.flock(fd, fcntl.LOCK_UN)
        return True
    except BlockingIOError:
        return False
    finally:
        os.close(fd)


class _null:
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


@posix_fence
def test_publish_maintenance_writes_the_exact_committed_intent_and_never_the_controller(db, tmp_path, monkeypatch):
    root = _ha_root(tmp_path, monkeypatch, private_dir=False)
    switch(db)
    gid, pair, _ = _published(db, root)
    controller = (root / projection.RELATIVE).read_bytes()
    i = intent_for(gid, digest=pair)
    assert projection.publish_maintenance(db, root, generation_id=gid, token=i["token"]) == "stale"  # nothing committed
    assert gen.begin_maintenance(db, i) == "intent"
    assert projection.publish_maintenance(db, root, generation_id=gid, token="synthetic-other") == "stale"
    assert projection.publish_maintenance(db, root, generation_id=gid, token=i["token"]) == "intent"
    path = root / projection.MAINTENANCE_RELATIVE
    assert json.loads(path.read_text()) == row_of(db) == i
    assert path.stat().st_mode & 0o777 == 0o600
    assert (root / projection.RELATIVE).read_bytes() == controller
    (root / projection.RELATIVE).unlink()
    assert projection.publish_maintenance(db, root, generation_id=gid, token=i["token"]) == "stale"  # no controller: no admission


@posix_fence
def test_the_caller_end_to_end_on_the_real_fence(db, tmp_path, monkeypatch):
    root = _ha_root(tmp_path, monkeypatch, private_dir=False)
    switch(db)
    gid, pair, expected = _published(db, root)
    staged = staged_export(db)
    controller = (root / projection.RELATIVE).read_bytes()
    order = []

    def provider(intent, binding):
        assert json.loads((root / projection.MAINTENANCE_RELATIVE).read_text()) == intent  # published before the call
        assert fence_free(root) and not gen.JOURNAL_LOCK._is_owned()  # nobody holds the fence or the journal lock meanwhile
        order.append("provider")
        return witness_for(intent)

    def prepare(parameters):
        on_disk = json.loads((root / projection.MAINTENANCE_RELATIVE).read_text())
        assert on_disk["state"] == "dispatched" and on_disk == row_of(db)
        assert fence_free(root) and not gen.JOURNAL_LOCK._is_owned()
        order.append("prepare_v3")
        return completion(row_of(db))

    port = Port(db, gid, prepare=prepare, readiness_over={k: dict(expected) for k in ("expected", "staged", "installed", "loaded")})
    out = native.maintain(db, port, staged, root=root, by="synthetic-actor", witness_provider=provider)
    assert out["state"] == "prepared" and order == ["provider", "prepare_v3"]
    assert json.loads((root / projection.MAINTENANCE_RELATIVE).read_text()) == row_of(db)
    assert row_of(db)["state"] == "prepared" and (root / projection.RELATIVE).read_bytes() == controller
    gen.begin(db, None, "synthetic-next")  # a new decision withdraws the maintenance admission too
    assert not (root / projection.MAINTENANCE_RELATIVE).exists() and not (root / projection.RELATIVE).exists()
