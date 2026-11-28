"""FIX-CORE-DATA-2570 (final deep review 2.56, area core / data / release: docs/review/DEEP-REVIEW-2560-CORE-DATA-RELEASE.md).

- CD-05: the legacy reader's budget counts every byte it DECOMPRESSES while walking an archive (skipped members and the re-reads of a
  backward seek in a gzip stream), not only the bytes of the members it keeps; past the cap the input is refused with its own code.
- CD-02, second path: when an earlier session's frames are still being stored after DRAIN_S, the connect snapshot is stored behind them
  (on the state worker) with the time compare - an older frame is no longer applied over the newer snapshot, and an older listing
  never replaces a newer stored state. Also: the re-read after an overflow stamps every listed entity as seen (the registry refresh
  tombstones an unregistered entity whose seen stamp is older than the last snapshot).
- The HA sync check of the health report carries the rule-notification delivery counters (CD-04) and the state feed / reconcile
  counters (additive `meta.delivery`, `meta.state_feed`)."""
# the shared fixture imported from its module is the test functions' argument (pytest injects it):
# ruff: noqa: F811
from __future__ import annotations

import copy
import io
import json
import tarfile
import threading
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from test_core10_eventloop_2560 import _event, _state, run_session, wait_until
from test_ha_structure_refresh import FakeHa, app_s, fast  # noqa: F401 - the shared fixtures

from smplwise.services import ha_state_worker, ha_sync
from smplwise.services import legacy_source as ls

FIX = Path(__file__).resolve().parent / "fixtures" / "legacy_v1527"
OPTIONS = (FIX / "options.json").read_bytes()
OVERRIDE = (FIX / "override.json").read_bytes()
EVENTS = (FIX / "event_store.jsonl").read_bytes()
BIG = 16 * 1024 * 1024  # a member that is skipped, never kept: zeros compress to a few KB


def _tar(files: dict[str, bytes], gz: bool = False) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz" if gz else "w") as t:
        for name, data in files.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            t.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def _backup_with_skipped_bulk(outer_gz: bool) -> bytes:
    """An unprotected HA backup whose configuration archive holds a large file the reader skips (a database, a log); `backup.json`
    comes LAST, so a gzip outer TAR is sought backwards (decompressed again from the start) for every inner archive."""
    addon = _tar({"./addon.json": json.dumps({"version": "1.5.27", "user": {"options": json.loads(OPTIONS)}, "system": {}}).encode(),
                  "./data/options.json": OPTIONS}, gz=True)
    config = _tar({"./data/home-assistant_v2.db": b"\0" * BIG, "./data/hikvision_nvr_override.json": OVERRIDE,
                   "./data/hikvision_nvr_event_store.jsonl": EVENTS}, gz=True)
    meta = {"slug": "abcd1234", "protected": False, "addons": [{"slug": "local_hikvision_nvr", "version": "1.5.27"}]}
    return _tar({"./local_hikvision_nvr.tar.gz": addon, "./homeassistant.tar.gz": config, "./backup.json": json.dumps(meta).encode()},
                gz=outer_gz)


# ---------------------------------------------------------------- CD-05

@pytest.mark.parametrize("outer_gz", [False, True])
def test_cd05_a_real_backup_with_a_skipped_bulk_member_is_still_read(outer_gz):
    src = ls.read_bytes(_backup_with_skipped_bulk(outer_gz))
    assert src.container == "ha_backup" and set(src.found) == {"options", "override", "events", "addon_meta"}


@pytest.mark.parametrize("outer_gz", [False, True])
def test_cd05_the_skipped_bytes_count_against_the_walk_budget(outer_gz, monkeypatch):
    """Before: only the kept members (a few KB) were counted - the 16 MB skipped member (20 GB in a crafted 20 MB upload) was free."""
    monkeypatch.setattr(ls, "MAX_UNPACKED_WALK", 4 * 1024 * 1024)
    with pytest.raises(ls.SourceError) as e:
        ls.read_bytes(_backup_with_skipped_bulk(outer_gz))
    assert e.value.code == "too_large_unpacked" and "walk" in e.value.detail


def test_cd05_a_gzip_tar_of_loose_files_counts_its_skipped_members(monkeypatch):
    raw = _tar({"copy/bulk.bin": b"\0" * BIG, "copy/a.json": OPTIONS}, gz=True)
    assert "options" in ls.read_bytes(raw).found
    monkeypatch.setattr(ls, "MAX_UNPACKED_WALK", 4 * 1024 * 1024)
    with pytest.raises(ls.SourceError) as e:
        ls.read_bytes(raw)
    assert e.value.code == "too_large_unpacked"


def test_cd05_every_decompressed_byte_is_counted_including_backward_seeks():
    budget = ls._Budget()
    parts = ls._Parts()
    assert ls._read_tar(io.BytesIO(_backup_with_skipped_bulk(outer_gz=True)), parts, budget) == "ha_backup"
    # the inner configuration archive's 16 MB, and the outer stream read more than once (backup.json last: a backward seek)
    assert budget.unpacked > BIG
    assert budget.read < 1024 * 1024, "the kept bytes stay what they were"


# ---------------------------------------------------------------- CD-02, second path

def _seed(app, entity_id: str, state: str, at: str, seen: str | None = None) -> None:
    ev = _event(entity_id, None, state, 0)["new_state"]
    ev["last_updated"] = ev["last_changed"] = at
    ha_sync.store_states(app.state.db, [ev], seen or at)


def _item(entity_id: str, state: str, at: str) -> dict[str, Any]:
    ev = _event(entity_id, None, state, 0)["new_state"]
    ev["last_updated"] = ev["last_changed"] = at
    return ev


def _row(app, entity_id: str) -> dict[str, Any]:
    with app.state.db.connection(mode="read") as conn:
        r = conn.execute("SELECT state, state_seen_at, removed_at FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
        return dict(r) if r else {}


def test_cd02_the_guarded_snapshot_keeps_a_newer_stored_state_and_stamps_it_seen(app_s):
    app, _s = app_s
    _seed(app, "binary_sensor.cd02b_door", "on", "2026-11-26T10:05:00+00:00")
    _seed(app, "sensor.cd02b_temp", "20", "2026-11-26T10:00:00+00:00")
    seen = "2026-11-26T10:10:00Z"
    counts = ha_sync.store_states_newest(app.state.db, [_item("binary_sensor.cd02b_door", "off", "2026-11-26T10:04:00+00:00"),
                                                         _item("sensor.cd02b_temp", "21", "2026-11-26T10:06:00+00:00")], seen)
    assert counts == {"written": 1, "older": 1, "failed": 0}
    assert _row(app, "binary_sensor.cd02b_door")["state"] == "on", "an older listing never replaces a newer stored state"
    assert _row(app, "binary_sensor.cd02b_door")["state_seen_at"] == seen, "but HA listed it: it is seen"
    assert _row(app, "sensor.cd02b_temp")["state"] == "21"


def test_cd02_the_guarded_snapshot_brings_back_an_entity_ha_lists_again(app_s):
    app, _s = app_s
    _seed(app, "sensor.cd02b_back", "1", "2026-11-26T10:05:00+00:00")
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET removed_at = ? WHERE entity_id = ?", ("2026-11-26T10:06:00Z", "sensor.cd02b_back"))
    ha_sync.store_states_newest(app.state.db, [_item("sensor.cd02b_back", "2", "2026-11-26T10:01:00+00:00")], "2026-11-26T10:10:00Z")
    row = _row(app, "sensor.cd02b_back")
    assert row["removed_at"] is None and row["state"] == "2"


# the second case is the reproduction of the second review (DEEP-REVIEW-2570-CORE-DATA-RELEASE, CD2-22, run on the runner): a door
# contact listed `on` (10:05) by the new session's snapshot, the previous session's queued frame `off` (10:01)
@pytest.mark.parametrize("eid, start, old_state, old_at, new_state, new_at", [
    ("sensor.cd02b_drain", "START", "OLD", "2026-11-26T10:00:00+00:00", "NEW", "2026-11-26T10:05:00+00:00"),
    ("binary_sensor.cd2_22_door", "off", "off", "2026-11-26T10:01:00+00:00", "on", "2026-11-26T10:05:00+00:00"),
])
def test_cd02_a_drain_timeout_stores_the_snapshot_behind_the_earlier_sessions_frames(app_s, monkeypatch, eid, start, old_state, old_at,
                                                                                    new_state, new_at):
    """The earlier session's frame (older) is still queued when the new session's wait for the worker times out. Before: the snapshot
    was stored at once and the older frame was applied over it afterwards - the mirror kept the OLD state."""
    app, s = app_s
    monkeypatch.setattr(ha_sync, "DRAIN_S", 0.2)
    _seed(app, eid, start, "2026-11-26T09:00:00+00:00")
    gate = threading.Event()
    ha_sync.STATE_WORKER.submit(gate.wait, 10, bounded=False)  # the earlier session's long write
    old = _event(eid, start, old_state, 0)
    old["new_state"]["last_updated"] = old["new_state"]["last_changed"] = old_at
    assert ha_sync.STATE_WORKER.submit(ha_sync.on_state_changed, app.state.db, old)  # its last frame, queued behind it
    fake = FakeHa()
    fake.states.append(_item(eid, new_state, new_at))  # what HA holds now (newer)

    async def script(_on_event, _call):
        gate.set()
        await wait_until(ha_sync.STATE_WORKER.idle)

    try:
        published = run_session(app, s, fake, script, monkeypatch)
    finally:
        gate.set()
    assert ha_sync.STATE_WORKER.wait_idle(10)
    assert _state(app, eid) == new_state
    assert any(m.get("type") == "structure_changed" and m.get("reason") == "resync" for m in published), "open screens refetch"


def test_cd02_the_re_read_stamps_every_listed_entity_as_seen(app_s):
    """The re-read sets last_snapshot_at = seen; an unregistered entity whose state was left as stored (same time) kept its old seen
    stamp and the next registry refresh tombstoned it (state_seen_at < last_snapshot_at)."""
    app, _s = app_s
    eid = "sensor.cd02b_same"
    _seed(app, eid, "5", "2026-11-26T10:00:00+00:00", seen="2026-11-26T10:00:01Z")
    seen = "2026-11-26T10:20:00Z"
    ha_sync.apply_resync(app.state.db, [_item(eid, "5", "2026-11-26T10:00:00+00:00")], seen)
    assert ha_sync.STATE.last_snapshot_at == seen
    assert _row(app, eid)["state_seen_at"] >= ha_sync.STATE.last_snapshot_at


# ---------------------------------------------------------------- the counters in the health report

def test_the_ha_sync_check_reports_the_delivery_and_state_feed_counters(settings, monkeypatch):
    from smplwise.main import create_app

    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    c = TestClient(create_app(s))
    ha_state_worker._reset_delivery_counts()
    for key, n in (("queued", 5), ("done", 2), ("skipped_old", 1), ("dropped_full", 3)):
        for _ in range(n):
            ha_state_worker._count(key)
    monkeypatch.setattr(ha_sync.STATE, "state_overflows", 7)
    monkeypatch.setattr(ha_sync.STATE, "state_resyncs", 2)
    last = {"read": 40, "repaired": 3, "older": 1, "same": 36, "live": 0, "removed": 0, "unknown_time": 0, "failed": 0, "ms": 12,
            "reason": "periodic", "at": "2026-11-28T08:00:00Z"}
    monkeypatch.setattr(ha_sync.SYNC, "last_reconcile", copy.deepcopy(last))
    try:
        r = c.get("/api/v1/health/report")
        assert r.status_code == 200, r.text
        meta = next(x for x in r.json()["checks"] if x["id"] == "ha_sync")["meta"]
    finally:
        ha_state_worker._reset_delivery_counts()
    assert meta["delivery"] == {"queued": 5, "done": 2, "skipped_old": 1, "dropped_full": 3, "waiting": 2,
                                "max_queue": ha_state_worker.DELIVERY_MAX_QUEUE, "max_age_s": int(ha_state_worker.DELIVERY_MAX_AGE_S)}
    feed = meta["state_feed"]
    assert feed["state_overflows"] == 7 and feed["state_resyncs"] == 2 and "dropped_frames" in feed
    assert feed["last_reconcile"] == last
    assert set(feed["worker"]) == {"depth", "max_depth", "refused", "done", "failed", "max_wait_ms"}
    assert "connected" in meta and "entities" in meta, "the existing keys stay (additive)"


def test_feed_view_before_any_reconcile_is_honest_none(monkeypatch):
    monkeypatch.setattr(ha_sync.SYNC, "last_reconcile", None)
    assert ha_sync.feed_view()["last_reconcile"] is None
