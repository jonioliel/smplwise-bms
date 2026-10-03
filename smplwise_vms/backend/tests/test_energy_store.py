"""CR-023 P1: energy.db store and the readings provider the billing branch uses - allocation by time at period edges,
coverage (a gap is covered, a late start is partial), DST days, history windows for the bill chart (missing data, meter
added mid-history, DST, leap year), boundary readings, meter replacement, retention (raw / quarter-hour / daily, open
drafts kept), the separate file and gate, and the sampler's load. Fakes only: no infrastructure, no device."""
from __future__ import annotations

import datetime as dt
import time
from zoneinfo import ZoneInfo

import pytest

from smplwise.db import Database, gate_for, new_id, now_iso
from smplwise.services import energy_provider as ep
from smplwise.services import energy_store as st
from smplwise.services.energy_store import Sample

TZ = ZoneInfo("Asia/Jerusalem")
UTC = dt.timezone.utc


def local(y, mo, d, h=0, mi=0) -> dt.datetime:
    return dt.datetime(y, mo, d, h, mi, tzinfo=TZ)


def ts(x: dt.datetime) -> int:
    return int(x.timestamp())


@pytest.fixture()
def env(settings):
    db = Database(settings.db_path)
    db.migrate()
    store = st.store_for(settings)
    return db, store, settings


def add_meter(db: Database, name: str = "לוח ראשי", created: str = "2020-01-01T00:00:00Z") -> str:
    mid = new_id()
    with db.connection() as conn:
        conn.execute("""INSERT INTO energy_meters(id, source_kind, source_ref, display_name, unit, unit_factor, status, max_kw, revision, created_at, updated_at)
                        VALUES (?, 'ha_entity', ?, ?, 'kWh', 1000, 'active', 100, 1, ?, ?)""", (mid, f"sensor.{mid}_energy", name, created, created))
        conn.execute("INSERT INTO energy_meter_epochs(id, meter_id, started_at, reason, source_ref, created_at) VALUES (?, ?, ?, 'first', ?, ?)",
                     (new_id(), mid, created, f"sensor.{mid}_energy", created))
    return mid


def feed(store, mid, points, max_kw=100.0):
    for t, v in points:
        store.apply([Sample(mid, ts(t) if isinstance(t, dt.datetime) else t, v, max_kw)], TZ)


def provider(db, settings, now: dt.datetime | None = None):
    conn_cm = db.connection(mode="read")
    conn = conn_cm.__enter__()
    return ep.EnergyProvider(conn, st.store_for(settings), now=(now or dt.datetime.now(UTC)).timestamp()), conn_cm


def test_separate_file_own_migrations_and_gate(env):
    db, store, settings = env
    assert store.path.name == "energy.db" and store.path.parent == settings.db_path.parent
    assert store.db.gate is gate_for(store.path) and store.db.gate is not db.gate
    with store.db.connection(mode="read") as c:
        assert st.schema_version_of(c) == st.SCHEMA_VERSION
        tables = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"readings", "intervals", "daily", "cursor", "meter_map"} <= tables
    with db.connection(mode="read") as c:  # the time-series never lands in the main database
        assert not {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")} & {"readings", "intervals", "daily"}


def test_period_edge_allocated_by_time(env):
    db, store, settings = env
    mid = add_meter(db)
    # 23:30 -> 00:30 local, 600 Wh: half before midnight, half after (owner round 2, answer 5 = b)
    feed(store, mid, [(local(2026, 10, 1, 23, 30), 1_000_000), (local(2026, 10, 2, 0, 30), 1_000_600)])
    p, cm = provider(db, settings, local(2026, 10, 3))
    try:
        before = p.consumption(mid, local(2026, 10, 1), local(2026, 10, 2))
        after = p.consumption(mid, local(2026, 10, 2), local(2026, 10, 3))
        assert before.wh == 300 and after.wh == 300
        whole = p.consumption(mid, local(2026, 10, 1, 23, 30), local(2026, 10, 2, 0, 30))
        assert whole.wh == 600 and whole.coverage == "full"
    finally:
        cm.__exit__(None, None, None)


def test_gap_is_covered_and_late_start_is_partial(env):
    db, store, settings = env
    mid = add_meter(db)
    feed(store, mid, [(local(2026, 9, 10, 12), 50_000), (local(2026, 9, 13, 12), 80_000)])  # three days offline in between
    p, cm = provider(db, settings, local(2026, 10, 1))
    try:
        c = p.consumption(mid, local(2026, 9, 11), local(2026, 9, 13))
        assert c.coverage == "full" and c.wh == 20_000  # 2 of the 3 days of a linear spread
        c2 = p.consumption(mid, local(2026, 9, 1), local(2026, 9, 12))  # before the first reading nothing is known
        assert c2.coverage == "partial" and c2.wh == 15_000
        c3 = p.consumption(mid, local(2026, 8, 1), local(2026, 8, 2))
        assert c3.wh is None and c3.coverage == "none"
    finally:
        cm.__exit__(None, None, None)


@pytest.mark.parametrize("day,hours", [((2026, 3, 27), 23), ((2026, 10, 25), 25)])
def test_dst_days(env, day, hours):
    db, store, settings = env
    mid = add_meter(db)
    d = dt.date(*day)
    a, b = st.day_bounds(d, TZ)
    assert b - a == hours * 3600
    feed(store, mid, [(a - 3600, 0)] + [(a + k * 900, 10 * (k + 1)) for k in range(hours * 4 + 1)] + [(b + 3600, 10 * (hours * 4 + 1) + 40)])
    rows = store.daily(mid, d, d + dt.timedelta(days=1))
    wh, cov, day_s = rows[d]
    assert day_s == hours * 3600 and cov == day_s
    assert len(store.intervals(mid, a, b)) == hours * 4  # 92 / 100 quarter hours
    p, cm = provider(db, settings, local(2026, 12, 1))
    try:
        c = p.consumption(mid, dt.datetime.fromtimestamp(a, UTC), dt.datetime.fromtimestamp(b, UTC))
        assert c.coverage == "full" and c.wh == wh == 10 * hours * 4
    finally:
        cm.__exit__(None, None, None)


def test_history_windows_missing_data_and_meter_added_mid_history(env):
    db, store, settings = env
    mid = add_meter(db)
    # the meter starts reporting on 15.9.2025 at noon and then reports every 6 hours with 1 kWh each time, until 1.10.2026
    t = local(2025, 9, 15, 12)
    v = 0
    pts = []
    while t <= local(2026, 10, 1, 0):
        pts.append((t, v))
        t += dt.timedelta(hours=6)
        v += 1000
    store.apply([Sample(mid, ts(x), y) for x, y in pts[:1]], TZ)
    for x, y in pts[1:]:
        store.apply([Sample(mid, ts(x), y)], TZ)
    p, cm = provider(db, settings, local(2026, 10, 2))
    try:
        h = p.history_windows([mid], dt.date(2026, 9, 1), dt.date(2026, 10, 1), "Asia/Jerusalem", 13)[mid]
        assert [(w.start, w.end) for w in h.previous[:2]] == [(dt.date(2026, 8, 1), dt.date(2026, 9, 1)), (dt.date(2026, 7, 1), dt.date(2026, 8, 1))]
        aug = h.previous[0]
        assert aug.coverage == "full" and aug.wh == 31 * 4000 and aug.days_with_data == 31
        sep25 = h.previous[11]  # 1.9.2025 - 1.10.2025: the meter existed only from the 15th
        assert (sep25.start, sep25.end) == (dt.date(2025, 9, 1), dt.date(2025, 10, 1))
        assert sep25.coverage == "partial" and 0 < sep25.wh < 30 * 4000
        aug25 = h.previous[12]  # before the meter existed: no bar, never zero
        assert aug25.wh is None and aug25.coverage == "none"
        assert h.same_period_last_year.start == dt.date(2025, 9, 1) and h.same_period_last_year.coverage == "partial"
        # October 2025 contains the DST end (25 h day): still full, 31 days x 4 kWh plus the extra hour's share
        oct25 = h.previous[10]
        assert oct25.coverage == "full" and oct25.days_total == 31
        months = p.monthly(mid, dt.date(2025, 8, 1), dt.date(2025, 11, 1))
        assert [m[2] for m in months] == ["none", "partial", "full"] and months[0][1] is None
    finally:
        cm.__exit__(None, None, None)


def test_history_ranges_leap_year_and_adhoc():
    prev, last = ep.history_ranges(dt.date(2028, 2, 1), dt.date(2028, 3, 1), 2)
    assert last == (dt.date(2027, 2, 1), dt.date(2027, 3, 1))
    assert prev[0] == (dt.date(2028, 1, 1), dt.date(2028, 2, 1))
    assert ep.add_months(dt.date(2028, 2, 29), -12) == dt.date(2027, 2, 28)
    prev, last = ep.history_ranges(dt.date(2028, 1, 15), dt.date(2028, 3, 15), 1)  # two-monthly from the 15th
    assert prev[0] == (dt.date(2027, 11, 15), dt.date(2028, 1, 15)) and last == (dt.date(2027, 1, 15), dt.date(2027, 3, 15))
    prev, _ = ep.history_ranges(dt.date(2026, 10, 3), dt.date(2026, 10, 13), 2)  # ad-hoc: steps back by the length in days
    assert prev == [(dt.date(2026, 9, 23), dt.date(2026, 10, 3)), (dt.date(2026, 9, 13), dt.date(2026, 9, 23))]


def test_history_leap_february_has_29_days(env):
    db, store, settings = env
    mid = add_meter(db)
    t, v = local(2024, 1, 31, 0), 0
    while t <= local(2024, 3, 2):
        store.apply([Sample(mid, ts(t), v)], TZ)
        t += dt.timedelta(hours=12)
        v += 500
    p, cm = provider(db, settings, local(2025, 3, 2))
    try:
        h = p.history_windows([mid], dt.date(2024, 3, 1), dt.date(2024, 4, 1), "Asia/Jerusalem", 1)[mid]
        feb = h.previous[0]
        assert (feb.start, feb.end, feb.days_total) == (dt.date(2024, 2, 1), dt.date(2024, 3, 1), 29)
        assert feb.coverage == "full" and feb.wh == 29 * 1000
    finally:
        cm.__exit__(None, None, None)


def test_reading_at_interpolates_and_reports_last_report(env):
    db, store, settings = env
    mid = add_meter(db)
    feed(store, mid, [(local(2026, 9, 30, 23, 0), 10_000), (local(2026, 10, 1, 1, 0), 10_200)])
    p, cm = provider(db, settings, local(2026, 10, 1, 1, 30))
    try:
        r = p.reading_at(mid, local(2026, 10, 1))
        assert r.before_wh == 10_000 and r.after_wh == 10_200 and r.value_wh == 10_100 and not r.exact
        assert r.epoch_id is not None
        s = p.meter_status(mid)
        assert s.state == "reporting" and s.last_report_at == local(2026, 10, 1, 1, 0).astimezone(UTC) and s.last_value_wh == 10_200
    finally:
        cm.__exit__(None, None, None)
    p2, cm2 = provider(db, settings, local(2026, 10, 1, 3, 0))  # 2 h later, threshold 60 min: not reporting, issue still allowed
    try:
        assert p2.meter_status(mid).state == "not_reporting"
    finally:
        cm2.__exit__(None, None, None)


def test_replacement_with_typed_readings(env):
    db, store, settings = env
    mid = add_meter(db)
    feed(store, mid, [(local(2026, 9, 1), 900_000), (local(2026, 9, 1, 1), 901_000)])
    at = local(2026, 9, 1, 2)
    store.start_epoch(mid, at=ts(at), epoch_id="ep2", tz=TZ, final_wh=901_500, start_wh=0)
    feed(store, mid, [(local(2026, 9, 1, 3), 700)])
    p, cm = provider(db, settings, local(2026, 9, 2))
    try:
        c = p.consumption(mid, local(2026, 9, 1), local(2026, 9, 1, 4))
        assert c.wh == 1000 + 500 + 700  # measured + typed final step + new counter; nothing across the epochs
    finally:
        cm.__exit__(None, None, None)


def test_daily_used_after_quarter_hour_retention(env):
    db, store, settings = env
    mid = add_meter(db)
    feed(store, mid, [(local(2023, 5, 1), 0), (local(2023, 5, 2), 24_000)])
    p, cm = provider(db, settings, local(2026, 10, 1))  # 2023 is outside the 26-month quarter-hour window
    try:
        c = p.consumption(mid, local(2023, 5, 1), local(2023, 5, 2))
        assert c.source == "daily" and c.wh == 24_000 and c.coverage == "full"
        with pytest.raises(ValueError):
            p.consumption(mid, local(2023, 5, 1, 6), local(2023, 5, 2))
    finally:
        cm.__exit__(None, None, None)


def test_retention_prunes_each_class_and_keeps_open_drafts(env):
    from smplwise.services import energy_sampler

    db, store, settings = env
    keep, drop = add_meter(db, "שמור"), add_meter(db, "נמחק")
    old = local(2026, 1, 10)
    for m in (keep, drop):
        feed(store, m, [(old, 0), (old + dt.timedelta(hours=1), 1000)])
    with db.connection() as conn:  # a minimal shape of the billing branch's tables (contract 2.3)
        conn.execute("CREATE TABLE energy_account_meters(account_id TEXT, meter_id TEXT)")
        conn.execute("CREATE TABLE energy_bills(id TEXT, account_id TEXT, state TEXT, period_start TEXT, period_end TEXT)")
        conn.execute("INSERT INTO energy_account_meters VALUES ('a1', ?)", (keep,))
        conn.execute("INSERT INTO energy_bills VALUES ('b1', 'a1', 'draft', '2026-01-01', '2026-02-01')")
        conn.execute("INSERT INTO settings(key, value) VALUES ('energy.interval_retention_months', '3'), ('energy.raw_retention_days', '7')")
    out = energy_sampler.retention(db, settings, now=ts(local(2026, 10, 1)))
    assert out["removed"]["readings"] == 4 and out["kept_drafts"] == 1
    assert store.intervals(keep, ts(old) - 900, ts(old) + 7200) and not store.intervals(drop, ts(old) - 900, ts(old) + 7200)
    assert store.daily(drop, dt.date(2026, 1, 10), dt.date(2026, 1, 11))  # daily totals stay for the bill retention (7 years)
    out = energy_sampler.retention(db, settings, now=ts(local(2033, 2, 1)))
    assert out["removed"]["daily"] == 2


def test_sampler_load_200_meters_and_main_gate_untouched(env, monkeypatch):
    """200 meters for an hour of minute polls: the flush stays short and the main database is only read."""
    from smplwise.services import energy_sampler, ha_sync

    db, store, settings = env
    ids = [add_meter(db, f"m{i}") for i in range(200)]
    with db.connection(durable=False) as conn:
        for i, mid in enumerate(ids):
            ha_sync.upsert_state(conn, {"entity_id": f"sensor.{mid}_energy", "state": "1.000", "attributes": {"unit_of_measurement": "kWh", "device_class": "energy",
                                                                                                          "state_class": "total_increasing"}})
    modes: list[str] = []
    real = db.connection

    def spy(mode="write", label=None, durable=True):
        modes.append(mode)
        return real(mode=mode, label=label, durable=durable)

    monkeypatch.setattr(db, "connection", spy)
    t0 = ts(local(2026, 10, 4, 10))
    worst = 0.0
    for k in range(60):
        with real(durable=False) as conn:  # the mirror moves (as the WebSocket session would make it)
            conn.execute("UPDATE ha_entities SET state = ? WHERE entity_id LIKE 'sensor.%_energy'", (f"{1 + (k + 1) * 0.01:.3f}",))
        started = time.perf_counter()
        res = energy_sampler.tick(db, settings, now=t0 + k * 60, require_connection=False)
        worst = max(worst, time.perf_counter() - started)
        assert res["samples"] == 200
    assert set(modes) == {"read"}, "the sampler never takes the main database's write lock"
    assert worst < 5.0  # generous on a loaded runner; typical is tens of milliseconds
    p, cm = provider(db, settings, local(2026, 10, 4, 11, 30))
    try:
        c = p.consumption(ids[0], local(2026, 10, 4, 10), local(2026, 10, 4, 11))
        assert c.wh == 590  # 59 deltas of 10 Wh (the first poll is the reference)
    finally:
        cm.__exit__(None, None, None)
