"""SEC-FIX-2520 / DEEP-REVIEW-2520-BACKEND-CORE CORE-02: the daily backup waited 24 hours from every process start and kept no record of
its last run, so an installation that restarts daily never wrote an automatic copy (and never sent an off-box copy). Now the loop
decides by the clock and a stored record (`backup.daily.state`): an overdue copy is written soon after start-up, the off-box copies
follow the daily archive even across a restart, a failure is retried at the next look. Tested with a fake clock (no real waiting).

A scratch data directory with the real migrations; the off-box push is replaced by a recorder; no network."""
from __future__ import annotations

import asyncio
import json

import pytest

from smplwise.db import Database, get_setting, set_setting
from smplwise.services import backup as svc
from smplwise.services import notify_sources, offbox_runtime

DAY = svc.DAILY_SECONDS
T0 = 1_795_000_000.0


@pytest.fixture()
def world(settings, monkeypatch):
    db = Database(settings.db_path)
    db.migrate()
    db.ensure_migration_objects()
    pushed: list[str] = []
    failed: list[int] = []
    monkeypatch.setattr(offbox_runtime, "after_backup", lambda _db, _st, name=None: pushed.append(name) or [])
    monkeypatch.setattr(notify_sources, "backup_failed", lambda _db: failed.append(1))
    return db, pushed, failed


def _dailies(settings) -> list[str]:
    return sorted(e["name"] for e in svc.list_backups(settings) if e["kind"] == "auto-daily")


def test_a_fresh_installation_writes_its_first_copy_at_the_first_look(settings, world):
    db, pushed, _ = world
    did = svc.daily_tick(db, settings, T0)
    assert did["backup"] and _dailies(settings) == [did["backup"]] and pushed == [did["backup"]]
    with db.connection(mode="read") as conn:
        state = json.loads(get_setting(conn, svc.DAILY_STATE_KEY))
    assert state == {"last_at": T0, "archive": did["backup"], "offbox_for": did["backup"]}
    assert svc._kept_setting(svc.DAILY_STATE_KEY)  # runtime state: never exported, never restored


def test_daily_restarts_still_get_one_copy_a_day(settings, world):
    db, pushed, _ = world
    first = svc.daily_tick(db, settings, T0)["backup"]
    # the process restarts every few hours: each start makes a first look after the start delay - nothing is due until a day passed
    for hours in (3, 9, 15, 23.9):
        assert svc.daily_tick(db, settings, T0 + hours * 3600)["backup"] is None
    second = svc.daily_tick(db, settings, T0 + DAY + 5)["backup"]
    assert second and second != first and pushed == [first, second]
    assert svc.next_daily_wait(svc.daily_state(db, settings), T0 + DAY + 5) == svc.DAILY_CHECK_S
    assert svc.next_daily_wait({"last_at": T0}, T0 + DAY - 120) == 120  # the next look lands when the copy falls due


def test_a_restart_between_the_backup_and_the_off_box_copy_still_sends_it(settings, world):
    db, pushed, _ = world
    with db.connection() as conn:
        entry = svc.create(settings, conn, "auto-daily", "daily")
        set_setting(conn, svc.DAILY_STATE_KEY, json.dumps({"last_at": T0, "archive": entry["name"], "offbox_for": None}))
    did = svc.daily_tick(db, settings, T0 + 600)
    assert did["backup"] is None and pushed == [entry["name"]]
    assert svc.daily_tick(db, settings, T0 + 4000)["offbox"] is None and pushed == [entry["name"]]  # once


def test_an_installation_from_before_the_record_uses_its_newest_daily_archive(settings, world, monkeypatch):
    db, pushed, _ = world
    with db.connection() as conn:
        entry = svc.create(settings, conn, "auto-daily", "daily")
    made = svc._iso_epoch(entry["created_at"])
    assert svc.daily_tick(db, settings, made + 2 * 3600)["backup"] is None and pushed == []  # not due, nothing pushed twice
    assert svc.daily_tick(db, settings, made + DAY + 1)["backup"]


def test_a_failed_backup_notifies_and_is_retried_at_the_next_look(settings, world, monkeypatch):
    db, pushed, failed = world
    real = svc.create_standalone
    monkeypatch.setattr(svc, "create_standalone", lambda *a, **k: (_ for _ in ()).throw(OSError("disk full")))
    did = svc.daily_tick(db, settings, T0)
    assert did["failed"] and failed == [1] and pushed == []
    with db.connection(mode="read") as conn:
        assert get_setting(conn, svc.DAILY_STATE_KEY) is None  # the record moves only on success
    monkeypatch.setattr(svc, "create_standalone", real)
    assert svc.daily_tick(db, settings, T0 + svc.DAILY_CHECK_S)["backup"]


def test_the_loop_looks_after_the_start_delay_and_then_when_due(settings, world, monkeypatch):
    db, pushed, _ = world
    now = {"t": T0}
    sleeps: list[float] = []

    async def fake_sleep(s: float) -> None:
        sleeps.append(s)
        now["t"] += s
        if len(sleeps) >= 4:
            raise asyncio.CancelledError

    monkeypatch.setattr(svc.asyncio, "sleep", fake_sleep)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(svc.daily_loop(db, settings, clock=lambda: now["t"]))
    assert sleeps[0] == svc.DAILY_START_DELAY_S  # a restart never waits a full day for its first look
    assert sleeps[1:] == [svc.DAILY_CHECK_S] * 3
    assert len(_dailies(settings)) == 1 and len(pushed) == 1
