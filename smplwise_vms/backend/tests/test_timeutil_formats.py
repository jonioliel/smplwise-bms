"""CR-TIMEUTIL-2436 (review 04:F14, F15): the shared time helpers answer exactly what each local copy answered.

`REFERENCE` holds the bodies of the local helpers verbatim as they were before the swap (v2.43.x). Every one is compared
with the shared helper over aware, local-zone, DST-edge, sub-second and naive inputs, then each module is checked to
expose the shared helper under its old name (so the module's callers and the tests that patch it did not move).
The zone half pins `site_zone_name` / `site_zone` to the rule of the twelve readers it replaced, and the DST edges of
the installation's default zone (spring gap, autumn fold, 23 / 25-hour local days)."""
from __future__ import annotations

import datetime as dt
import importlib
import sqlite3
import time
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pytest

from smplwise.services import timeutil as tu
from smplwise.services.settings_store import DEFAULTS

UTC = dt.timezone.utc
IL = ZoneInfo("Asia/Jerusalem")
_ISO = "%Y-%m-%dT%H:%M:%SZ"

# ------------------------------------------------------------------ the copies as they were (verbatim bodies)

DATETIME_SECONDS = {
    "access_grant_engine._iso_z": lambda moment: moment.astimezone(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "access_grants.iso": lambda at: at.astimezone(timezone.utc).strftime(_ISO),
    "building_presence._iso": lambda d: d.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "bulk_people._iso": lambda at: at.astimezone(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "calendar.model.iso": lambda d: d.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "calendar_sync.google._iso": lambda t: t.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "capture_lease.iso": lambda at: at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "door_automation.iso": lambda at: at.astimezone(dt.timezone.utc).strftime(_ISO),
    "door_windows.iso": lambda at: at.astimezone(UTC).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "intercom_messaging.iso": lambda moment: moment.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "local_privacy._iso": lambda ts: ts.astimezone(dt.timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "notices.model.iso": lambda t: t.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "partner.core.iso": lambda at: at.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "presence.iso": lambda at: at.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "scenario_model.iso": lambda t: t.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "semantic._iso": lambda t: t.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "transit.catalogue._iso": lambda t: t.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "trusted_caller.iso": lambda at: at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "zone_counts._iso": lambda d: d.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
}
DATETIME_OR_NONE = {
    "cast_sessions._iso": lambda t: t.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z") if t else None,
    "transit.poller._iso": lambda t: t.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z") if t else None,
}
DATETIME_MS = {
    "messaging_accounts._iso": lambda moment: moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
    "wa_pacing._iso": lambda moment: moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
    "intercom_calls._iso": lambda at: (lambda a: a.strftime("%Y-%m-%dT%H:%M:%S.") + f"{a.microsecond // 1000:03d}Z")(at.astimezone(UTC)),
}
EPOCH = {
    "insights_common.iso": lambda ts: tu.iso_utc(dt.datetime.fromtimestamp(ts, dt.timezone.utc)),
    "insights_generator._iso": lambda ts: dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "intercom_write_journal._iso": lambda ts: datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "shift_summary._iso": lambda ts: tu.iso_utc(dt.datetime.fromtimestamp(ts, dt.timezone.utc)),
    "temperature_runtime._iso": lambda ts: tu.iso_utc(dt.datetime.fromtimestamp(ts, dt.timezone.utc).replace(microsecond=0)),
}
EPOCH_OR_NONE = {
    "camera_image_health._iso": lambda ts: None if ts is None else dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "recorder_health._iso": lambda ts: None if ts is None else dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "energy_calibration._iso": lambda ts: None if ts is None else dt.datetime.fromtimestamp(ts, UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
}
# local wrappers that keep their own conversion (int(), float(), a falsy check, a default instant) around the shared helper
WRAPPED = {
    "generator_log._iso": lambda ts: tu.iso_utc(dt.datetime.fromtimestamp(int(ts), dt.timezone.utc)) if ts is not None else None,
    "temperature_explain._iso": lambda ts: tu.iso_utc(dt.datetime.fromtimestamp(int(ts), dt.timezone.utc)) if ts is not None else None,
    "water_runtime._iso": lambda ts: tu.iso_utc(dt.datetime.fromtimestamp(int(ts), dt.timezone.utc)),
    "camera_sources._iso": lambda ts: dt.datetime.fromtimestamp(float(ts), dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if ts else None,
}

# ------------------------------------------------------------------ inputs

AWARE = [
    datetime(2026, 9, 14, 7, 28, 12, tzinfo=UTC),
    datetime(2026, 9, 14, 7, 28, 12, 999_999, tzinfo=UTC),  # sub-second digits are dropped, never rounded up
    datetime(2026, 9, 14, 7, 28, 12, 1, tzinfo=UTC),
    datetime(2026, 9, 14, 10, 28, 12, 500_000, tzinfo=IL),
    datetime(2026, 3, 27, 1, 59, 59, 999_999, tzinfo=IL),  # the last instant before the spring jump (IST, +02:00)
    datetime(2026, 3, 27, 3, 0, 0, tzinfo=IL),  # the first wall time after it (IDT, +03:00)
    datetime(2026, 10, 25, 1, 30, tzinfo=IL, fold=0),  # the autumn fold, first pass (IDT)
    datetime(2026, 10, 25, 1, 30, tzinfo=IL, fold=1),  # ... and second pass (IST), one hour later in UTC
    datetime(2026, 12, 31, 23, 59, 59, 999_999, tzinfo=dt.timezone(dt.timedelta(hours=-5))),  # crosses the year in UTC
    datetime(2000, 2, 29, 0, 0, tzinfo=dt.timezone(dt.timedelta(hours=5, minutes=30))),
]
# A naive value goes through `astimezone`, i.e. the process's local zone, in the copies and in the shared helper alike.
NAIVE = [datetime(2026, 9, 14, 7, 28, 12, 250_000), datetime(2026, 10, 25, 1, 30)]
EPOCHS = [0, 1, 1_789_000_000, 1_789_000_000.5, 1_789_000_000.999_999, 1_789_000_000.999_999_7, 1_774_569_599.9, 1_792_879_200]


def _module_attr(dotted: str):
    mod, _, name = dotted.rpartition(".")
    return getattr(importlib.import_module(f"smplwise.services.{mod}"), name)


@pytest.mark.parametrize("name", sorted(DATETIME_SECONDS))
def test_datetime_copies_equal_iso_utc(name):
    old = DATETIME_SECONDS[name]
    for value in AWARE + NAIVE:
        assert tu.iso_utc(value) == old(value), (name, value)
    assert _module_attr(name) is tu.iso_utc


@pytest.mark.parametrize("name", sorted(DATETIME_OR_NONE))
def test_optional_datetime_copies_equal_iso_or_none(name):
    old = DATETIME_OR_NONE[name]
    for value in AWARE + NAIVE + [None]:
        assert tu.iso_or_none(value) == old(value), (name, value)
    assert _module_attr(name) is tu.iso_or_none


@pytest.mark.parametrize("name", sorted(DATETIME_MS))
def test_millisecond_copies_equal_iso_utc_ms(name):
    old = DATETIME_MS[name]
    for value in AWARE + NAIVE:
        assert tu.iso_utc_ms(value) == old(value), (name, value)
    assert _module_attr(name) is tu.iso_utc_ms


@pytest.mark.parametrize("name", sorted(EPOCH))
def test_epoch_copies_equal_iso_from_epoch(name):
    old = EPOCH[name]
    for ts in EPOCHS:
        assert tu.iso_from_epoch(ts) == old(ts), (name, ts)
    assert _module_attr(name) is tu.iso_from_epoch


@pytest.mark.parametrize("name", sorted(EPOCH_OR_NONE))
def test_optional_epoch_copies_equal_iso_from_epoch_or_none(name):
    old = EPOCH_OR_NONE[name]
    for ts in EPOCHS + [None]:
        assert tu.iso_from_epoch_or_none(ts) == old(ts), (name, ts)
    assert _module_attr(name) is tu.iso_from_epoch_or_none


@pytest.mark.parametrize("name", sorted(WRAPPED))
def test_wrapped_copies_answer_as_before(name):
    old, new = WRAPPED[name], _module_attr(name)
    inputs: list = list(EPOCHS)
    if name != "water_runtime._iso":
        inputs.append(None)
    if name == "camera_sources._iso":
        inputs += ["1789000000.5", "0", 0.0]  # float() of text and the falsy check stay
    for ts in inputs:
        try:
            want = old(ts)
        except (TypeError, ValueError) as exc:
            with pytest.raises(type(exc)):
                new(ts)
            continue
        assert new(ts) == want, (name, ts)


def test_wiskey_live_validation_keeps_its_default_instant(monkeypatch):
    from smplwise.services import wiskey_live_validation as wlv

    fixed = datetime(2026, 10, 25, 1, 30, 5, 700_000, tzinfo=IL, fold=1)
    monkeypatch.setattr(wlv, "_now", lambda: fixed)
    assert wlv._iso() == fixed.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") == "2026-10-24T23:30:05Z"
    for value in AWARE:
        assert wlv._iso(value) == value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def test_the_formats_that_differ_stay_local():
    """Microseconds, no-astimezone and `+00:00` copies are not the shared helper (their text really differs)."""
    from smplwise.services import backup_drill, bridge_keys, offbox_restore, wiskey_write_lineage

    for fn in (backup_drill._iso, offbox_restore._iso, bridge_keys._iso, wiskey_write_lineage._iso):
        assert fn not in (tu.iso_utc, tu.iso_utc_ms, tu.iso_from_epoch, tu.iso_or_none)
    at = datetime(2026, 9, 14, 7, 28, 12, 123_456, tzinfo=UTC)
    assert wiskey_write_lineage._iso(at) == "2026-09-14T07:28:12.123456Z"
    assert backup_drill._iso(at) == "2026-09-14T07:28:12Z"


def test_shared_formats_pin_the_text():
    at = datetime(2026, 3, 27, 2, 30, 0, 987_654, tzinfo=UTC)
    assert tu.iso_utc(at) == "2026-03-27T02:30:00Z"
    assert tu.iso_utc_ms(at) == "2026-03-27T02:30:00.987Z"  # truncated, not rounded to .988
    assert tu.iso_or_none(None) is None and tu.iso_from_epoch_or_none(None) is None
    assert tu.iso_from_epoch(0) == "1970-01-01T00:00:00Z"
    # fromtimestamp rounds to the microsecond first: 0.9999997 s is 1.000000 s (the rule of every replaced copy)
    assert tu.iso_from_epoch(1_789_000_000.999_999_7) == tu.iso_utc(datetime.fromtimestamp(1_789_000_000.999_999_7, UTC))
    assert tu.iso_from_epoch(1_789_000_000.4) == time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(1_789_000_000))


# ------------------------------------------------------------------ the installation's zone


def _settings_db(value: str | None = None, *, row: bool = True) -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)")
    if row:
        conn.execute("INSERT INTO settings(key, value) VALUES ('time.zone', ?)", (value,))
    return conn


def _old_reader(conn) -> ZoneInfo:  # the body of the twelve readers this replaced
    from smplwise.db import get_setting

    return tu.zone(get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem")


def test_default_zone_is_the_settings_default():
    from smplwise.services import site_location

    assert tu.DEFAULT_ZONE == DEFAULTS[tu.ZONE_KEY] == site_location.DEFAULT_ZONE


@pytest.mark.parametrize("stored, row, name", [
    ("Europe/London", True, "Europe/London"),
    ("Asia/Jerusalem", True, "Asia/Jerusalem"),
    ("", True, "Asia/Jerusalem"),
    (None, True, "Asia/Jerusalem"),
    (None, False, "Asia/Jerusalem"),
    ("Not/AZone", True, "Not/AZone"),  # the name is answered as stored; the ZoneInfo falls back
])
def test_site_zone_name_and_site_zone(stored, row, name):
    conn = _settings_db(stored, row=row)
    assert tu.site_zone_name(conn) == name
    assert tu.site_zone(conn) == _old_reader(conn)
    assert tu.site_zone(conn) == (ZoneInfo(name) if name != "Not/AZone" else IL)


def test_unknown_and_malformed_zone_names_fall_back():
    for bad in ("Not/AZone", "../etc/passwd", "", "Asia/Jerusalem\x00"):
        assert tu.zone(bad) == IL


def test_module_zone_readers_answer_as_before(monkeypatch):
    from smplwise.services import insights_common, temperature, water_meters
    from smplwise.services.notices import sources

    for stored in ("Europe/London", "", None, "Not/AZone"):
        conn = _settings_db(stored)
        for reader in (insights_common.site_zone, temperature.site_zone, water_meters.tz_of, sources.installation_tz):
            assert reader(conn) == _old_reader(conn), (reader, stored)
    broken = sqlite3.connect(":memory:")  # no settings table: the two guarded readers still answer the default
    assert temperature.site_zone(broken) == IL
    assert sources.installation_tz(broken) == IL


# ------------------------------------------------------------------ DST edges of the default zone (Israel, 2026)


def test_local_day_bounds_spring_day_is_23_hours():
    start, end = tu.local_day_bounds(dt.date(2026, 3, 27), IL)
    assert (start.isoformat(), end.isoformat()) == ("2026-03-26T22:00:00+00:00", "2026-03-27T21:00:00+00:00")
    assert end - start == dt.timedelta(hours=23)


def test_local_day_bounds_autumn_day_is_25_hours():
    start, end = tu.local_day_bounds(dt.date(2026, 10, 25), IL)
    assert (start.isoformat(), end.isoformat()) == ("2026-10-24T21:00:00+00:00", "2026-10-25T22:00:00+00:00")
    assert end - start == dt.timedelta(hours=25)


def test_nvr_wall_clock_around_both_transitions():
    # spring gap: 02:30 does not exist on 27.03; the NVR rule moves it forward (same instant as 03:30 IDT)
    assert tu.nvr_wall_to_utc("2026-03-27T02:30:00Z", IL) == datetime(2026, 3, 27, 0, 30, tzinfo=UTC)
    assert tu.nvr_wall_to_utc("2026-03-27T01:59:59Z", IL) == datetime(2026, 3, 26, 23, 59, 59, tzinfo=UTC)
    assert tu.nvr_wall_to_utc("2026-03-27T03:00:00Z", IL) == datetime(2026, 3, 27, 0, 0, tzinfo=UTC)
    # autumn fold: 01:30 happens twice on 25.10; the earlier instant is chosen
    assert tu.nvr_wall_to_utc("2026-10-25T01:30:00Z", IL) == datetime(2026, 10, 24, 22, 30, tzinfo=UTC)
    # and the way back: both UTC instants of the fold show the same wall digits
    assert tu.utc_to_nvr_wall(datetime(2026, 10, 24, 22, 30, tzinfo=UTC), IL) == "2026-10-25T01:30:00Z"
    assert tu.utc_to_nvr_wall(datetime(2026, 10, 24, 23, 30, tzinfo=UTC), IL) == "2026-10-25T01:30:00Z"
    assert tu.compact_wall(datetime(2026, 3, 27, 0, 0, 0, 999_999, tzinfo=UTC), IL) == "20260327T030000Z"


def test_iso_utc_is_one_instant_for_each_fold_pass():
    first = datetime(2026, 10, 25, 1, 30, tzinfo=IL, fold=0)
    second = datetime(2026, 10, 25, 1, 30, tzinfo=IL, fold=1)
    assert (tu.iso_utc(first), tu.iso_utc(second)) == ("2026-10-24T22:30:00Z", "2026-10-24T23:30:00Z")
    assert tu.parse_utc(tu.iso_utc(second)) - tu.parse_utc(tu.iso_utc(first)) == dt.timedelta(hours=1)
