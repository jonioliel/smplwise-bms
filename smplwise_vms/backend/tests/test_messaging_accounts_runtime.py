"""CR-038 slice 5a: migration 0082 (the shared WhatsApp send ledger) and services/messaging_runtime.py - the wiring the outbox of
slice 5b uses (account service for a worker thread, the DB ledger, the pacing shared by two uses of one account, the module key, the
janitor) and the registration point other modules join (their uses, departments, labels; a shared account warns). Fakes only."""
from __future__ import annotations

import datetime as dt
import os
import re
import sqlite3

import pytest
from fake_ha_whatsapp import FakeHaWhatsapp, PairedAccount

from smplwise import db as dbmod
from smplwise.db import Database, now_iso
from smplwise.services import messaging_accounts as ma
from smplwise.services import messaging_runtime as mr
from smplwise.services.tickets import naming

UTC = dt.timezone.utc
T0 = dt.datetime(2026, 10, 13, 9, 0, tzinfo=UTC)
ENTRY_A, ENTRY_B = "01JFAKEENTRYA", "01JFAKEENTRYB"
KEY_A, KEY_B = f"entry:{ENTRY_A}", f"entry:{ENTRY_B}"


@pytest.fixture()
def database(settings, monkeypatch):
    monkeypatch.setattr(mr, "ws_connected", lambda: True)
    monkeypatch.setattr(mr, "_janitor_at", None)
    d = Database(settings.db_path)
    d.migrate()
    fake = FakeHaWhatsapp([PairedAccount(ENTRY_A, "15555550191"), PairedAccount(ENTRY_B, "15555550192")])
    now = now_iso()
    with d.connection() as conn:
        for r in fake.mirror_rows():
            conn.execute("INSERT INTO ha_entities(entity_id, unique_id, platform, config_entry_id, domain, device_class, state, available, disabled, name, first_seen_at, updated_at) "
                         "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)",
                         (r.entity_id, r.unique_id, r.platform, r.config_entry_id, r.domain, r.device_class, r.state, int(r.available), int(r.disabled), now, now))
    return d


def _schema(conn: sqlite3.Connection) -> list[tuple[str, str]]:
    return sorted((r[0], re.sub(r"\s+", " ", r[1] or "")) for r in conn.execute(
        "SELECT name, sql FROM sqlite_master WHERE name LIKE '%messaging%' AND name NOT LIKE 'sqlite_%'"))


# ---------------------------------------------------------------- migration 0082

def test_0082_is_the_reserved_number_and_carries_no_transaction():
    files = sorted(dbmod.MIGRATIONS_DIR.glob("*_messaging_accounts.sql"))
    assert [f.name for f in files] == ["0082_messaging_accounts.sql"]
    sql = files[0].read_text(encoding="utf-8")
    assert "CR-038" in sql.splitlines()[0] and not re.search(r"^\s*(BEGIN|COMMIT)\b", sql, re.M | re.I)
    assert "phone" not in re.sub(r"--.*", "", sql).lower(), "no number column"


def test_0082_applies_and_matches_the_ledger_the_service_is_written_against(database):
    with database.connection(mode="read") as conn:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(messaging_send_ledger)")]
        assert cols == ["id", "account_key", "use_key", "recipient_key", "kind", "at"]
        real = _schema(conn)
        assert conn.execute("SELECT COUNT(*) FROM schema_migrations WHERE version = 82").fetchone()[0] == 1
    mem = sqlite3.connect(":memory:")
    mem.executescript(ma.LEDGER_DDL)
    assert _schema(mem) == real
    assert {n for n, _ in real} == {"messaging_send_ledger", "idx_messaging_ledger_account", "idx_messaging_ledger_recipient"}
    with database.connection() as conn, pytest.raises(sqlite3.IntegrityError):
        conn.execute("INSERT INTO messaging_send_ledger(account_key, use_key, recipient_key, kind, at) VALUES ('k', 'u', 'r', 'sms', 'x')")


def test_0082_on_top_of_a_0079_database(settings, tmp_path, monkeypatch):
    import shutil

    real = dbmod.MIGRATIONS_DIR
    older = tmp_path / "older"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) <= 79:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    d = Database(settings.db_path)
    d.migrate()
    with d.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES ('messaging.whatsapp', '{\"revision\": 4}')")
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    assert 82 in d.migrate()
    with d.connection(mode="read") as conn:
        assert mr.load_doc(conn).revision == 4, "the settings document is untouched"


# ---------------------------------------------------------------- the ledger and the pacing on the real table

def test_db_ledger_round_trip_and_shared_pacing_across_two_uses(database):
    ledger = mr.DbSendLedger(database)
    gate = ma.PacingGate(ledger, rng=__import__("random").Random(1))
    pacing = ma.Pacing(min_gap_s=15, jitter_s=0, per_hour=3, per_day=150)
    now = T0
    for i, use in enumerate(["tickets.messages", "tickets.codes", "other.use"]):
        assert gate.check(account_key=KEY_A, pacing=pacing, recipient_key=f"r{i}", kind="message", now=now).allowed
        gate.record(account_key=KEY_A, use_key=use, recipient_key=f"r{i}", kind="message", now=now)
        now += dt.timedelta(seconds=20)
    d = gate.check(account_key=KEY_A, pacing=pacing, recipient_key="r9", kind="message", now=now)
    assert not d.allowed and d.reason == "hour", "three uses on one account share one hourly budget"
    assert gate.check(account_key=KEY_B, pacing=pacing, recipient_key="r9", kind="message", now=now).allowed, "another account has its own"
    assert ledger.last_at(KEY_A) == T0 + dt.timedelta(seconds=40)
    assert len(ledger.times(since=T0 - dt.timedelta(hours=1), account_key=KEY_A, kinds=("message",))) == 3
    with database.connection(mode="read") as conn:
        rows = [tuple(r) for r in conn.execute("SELECT account_key, use_key, recipient_key, kind FROM messaging_send_ledger ORDER BY id")]
    assert rows[0] == (KEY_A, "tickets.messages", "r0", "message")


def test_janitor_prunes_after_two_days_hourly(database):
    ledger = mr.DbSendLedger(database)
    for days in (3, 2.5, 1):
        ledger.record(account_key=KEY_A, use_key="tickets.messages", recipient_key="r", kind="message", at=T0 - dt.timedelta(days=days))
    assert mr.janitor(database, now=T0) == 2
    ledger.record(account_key=KEY_A, use_key="tickets.messages", recipient_key="r", kind="message", at=T0 - dt.timedelta(days=5))
    assert mr.janitor(database, now=T0 + dt.timedelta(minutes=30)) == 0, "throttled to hourly"
    assert mr.janitor(database, now=T0 + dt.timedelta(hours=1)) == 1
    assert len(ledger.times(since=T0 - dt.timedelta(days=10))) == 1


def test_the_main_janitor_runs_the_step():
    src = (dbmod.MIGRATIONS_DIR.parent / "main.py").read_text(encoding="utf-8")
    assert "messaging_runtime.janitor(db)" in src and 'include_router(messaging_accounts_router.router' in src


# ---------------------------------------------------------------- the module key

def test_messaging_key_file(tmp_path):
    assert mr.messaging_key(tmp_path, create=False) is None
    k = mr.messaging_key(tmp_path)
    assert isinstance(k, bytes) and len(k) == 32 and mr.messaging_key(tmp_path) == k
    p = mr.key_path(tmp_path)
    assert p.parent.name == "secrets"
    if os.name != "nt":
        assert (p.stat().st_mode & 0o777) == 0o600
    rk = mr.recipient_key(k, "15555550191")
    assert re.fullmatch(r"[0-9a-f]{64}", rk) and "0191" not in rk
    p.write_bytes(b"short")
    with pytest.raises(RuntimeError):
        mr.messaging_key(tmp_path)


# ---------------------------------------------------------------- the worker's account service

def test_worker_service_reads_fresh_and_follows_the_module_switch(database):
    svc = mr.accounts_service(database)
    with database.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES ('tickets.enabled', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'")
        mr.store_doc(conn, ma.MappingDoc(1, (ma.Account(KEY_A, "discovered", label="משרד"),), {"tickets.messages": KEY_A}))
    assert svc.resolve("tickets.codes").key == KEY_A and svc.resolve("tickets.codes").value == ENTRY_A
    assert svc.status(KEY_A).state == "connected" and svc.mapped_keys("tickets") == {KEY_A}
    with database.connection() as conn:
        mr.store_doc(conn, ma.MappingDoc(2, (), {"tickets.messages": KEY_B}))
    assert svc.resolve("tickets.messages").key == KEY_B, "a moved use applies to the next claim (D27)"
    assert {s.key for s in svc.registry.all() if s.active()} == {"tickets.messages", "tickets.codes"}
    with database.connection() as conn:
        conn.execute("UPDATE settings SET value = 'false' WHERE key = 'tickets.enabled'")
    assert not any(s.active() for s in svc.registry.all()), "the module switch is read when asked"


# ---------------------------------------------------------------- other modules join

def test_another_module_registers_a_use_and_a_shared_account_warns(database, monkeypatch):
    monkeypatch.setattr(mr, "_USE_PROVIDERS", list(mr._USE_PROVIDERS))  # noqa: SLF001
    monkeypatch.setattr(mr, "_MODULE_LABELS", dict(mr._MODULE_LABELS))  # noqa: SLF001
    monkeypatch.setattr(mr, "_LABELS", dict(mr._LABELS))  # noqa: SLF001
    mr.register_uses(lambda conn: (ma.UseSpec("access.notices", "access", "הודעות כניסה"),))
    mr.register_label_renderer("access", lambda conn, text: text, lambda conn: "בקרת כניסה")
    with database.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES ('tickets.enabled', 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'")
        mr.store_doc(conn, ma.MappingDoc(1, (), {"tickets.messages": KEY_A, "access.notices": KEY_A}))
        v = mr.view(conn, can_manage=True, now=T0)
    assert [u["key"] for u in v["uses"]] == ["tickets.messages", "tickets.codes", "access.notices"]
    assert v["modules"] == {"access": "בקרת כניסה", "tickets": naming.DEFAULTS["he"]["module"]}
    shared = [w for w in v["warnings"] if w["code"] == "shared_module"]
    assert {(w["use"], w["module"]) for w in shared} >= {("tickets.messages", "access"), ("access.notices", "tickets")}
    acc = {a["key"]: a for a in v["accounts"]}
    assert sorted(acc[KEY_A]["uses"]) == ["access.notices", "tickets.codes", "tickets.messages"]


def test_view_counts_sends_of_the_last_24_hours(database):
    ledger = mr.DbSendLedger(database)
    for h in (30, 20, 1):
        ledger.record(account_key=KEY_A, use_key="tickets.messages", recipient_key="r", kind="message", at=T0 - dt.timedelta(hours=h))
    with database.connection(mode="read") as conn:
        v = mr.view(conn, can_manage=True, now=T0)
    acc = {a["key"]: a for a in v["accounts"]}
    assert acc[KEY_A]["sends_24h"] == 2 and acc[KEY_A]["last_send_at"] == "2026-10-13T08:00:00Z" and acc[KEY_B]["sends_24h"] == 0
