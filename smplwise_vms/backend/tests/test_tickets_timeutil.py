"""CR-TK-TIMEUTIL-2436 (review 01:F-06, F-07, F-18): the tickets time helpers live in services/tickets/timeutil.py.

`OLD_*` hold the bodies of the module copies verbatim as they were before the swap. Each is compared with the shared helper
over the values the product stores (`Z`), offsets, zone-less text, DST edges of the default zone and malformed text, and
each module is checked to expose the shared helper under its old name. The zone half pins `zone_named` / `zone_of` to the
rules of the five implementations it replaced. A zone-less stored value is still read as local time by the six modules that
did so (the switch to "zone-less = UTC" waits for the lab-copy check); the test pins both rules and that they agree on
every value ending in `Z`."""
from __future__ import annotations

import datetime as dt
import importlib
import sqlite3
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from smplwise.services import timeutil as stu
from smplwise.services.settings_store import DEFAULTS
from smplwise.services.tickets import timeutil as tu

UTC = dt.timezone.utc
IL = ZoneInfo("Asia/Jerusalem")


# ------------------------------------------------------------------ the copies as they were


def _old_parse_local_if_empty(value):  # costs.parse, handler_links.parse, sla._parse
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def _old_parse_local_str(value):  # intake._parse
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def _old_parse_local_typed(value):  # out_documents._parse, outbox_store.parse
    if not value or not isinstance(value, str):
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def _old_parse_utc(at):  # visits.parse, vendor_stats._parse
    if not at or not isinstance(at, str):
        return None
    try:
        v = dt.datetime.fromisoformat(at.replace("Z", "+00:00"))
    except ValueError:
        return None
    return (v if v.tzinfo else v.replace(tzinfo=UTC)).astimezone(UTC)


def _old_iso_s(v):
    return v.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _old_iso_s_strftime(at):  # rfq_inbound._iso
    return at.astimezone(dt.timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def _old_iso_ms(at):
    return at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _old_iso_or_none(v):
    return None if v is None else v.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _old_zone_named(name):  # stuck._zone (used by budgets and visits), work_calendar.Calendar.tz
    try:
        return ZoneInfo(name or "Asia/Jerusalem")
    except Exception:  # noqa: BLE001
        return ZoneInfo("Asia/Jerusalem")


def _old_messaging_time_zone(conn):  # messaging.time_zone (dashboard_alerts._tz, rfq_terms._tz)
    from smplwise.db import get_setting

    name = get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem"
    try:
        return ZoneInfo(name)
    except Exception:  # noqa: BLE001
        return ZoneInfo("Asia/Jerusalem")


def _old_stuck_wrapper(conn):  # budgets._zone, visits._zone
    from smplwise.db import get_setting

    return _old_zone_named(get_setting(conn, "time.zone", None))


def _old_rule_engine_zone(conn):  # rule_engine._zone, costs_report.filename
    from smplwise.db import get_setting

    return stu.zone(get_setting(conn, "time.zone", None) or "Asia/Jerusalem")


PARSERS = {
    "costs.parse": (tu.parse_naive_local, _old_parse_local_if_empty),
    "handler_links.parse": (tu.parse_naive_local, _old_parse_local_if_empty),
    "sla._parse": (tu.parse_naive_local, _old_parse_local_if_empty),
    "intake._parse": (tu.parse_naive_local, _old_parse_local_str),
    "out_documents._parse": (tu.parse_naive_local, _old_parse_local_typed),
    "outbox_store.parse": (tu.parse_naive_local, _old_parse_local_typed),
    "visits.parse": (tu.parse_utc, _old_parse_utc),
    "vendor_stats._parse": (tu.parse_utc, _old_parse_utc),
}
FORMATTERS = {
    "budgets._iso": (tu.iso_s, _old_iso_s),
    "costs.iso": (tu.iso_s, _old_iso_s),
    "handler_links.iso": (tu.iso_s, _old_iso_s),
    "intake._iso": (tu.iso_s, _old_iso_s),
    "vendor_stats._iso": (tu.iso_s, _old_iso_s),
    "public_runtime._iso": (tu.iso_s, _old_iso_s),
    "outbox_store.iso_s": (tu.iso_s, _old_iso_s),
    "rfq_inbound._iso": (tu.iso_s, _old_iso_s_strftime),
    "outbox_store.iso": (tu.iso_ms, _old_iso_ms),
    "out_documents.iso": (tu.iso_ms, _old_iso_ms),
    "handler_links._outbox_iso": (tu.iso_ms, _old_iso_ms),
    "sla._iso": (tu.iso_s_or_none, _old_iso_or_none),
    "stuck.iso": (tu.iso_s_or_none, _old_iso_or_none),
    "visits.iso": (tu.iso_s_or_none, _old_iso_or_none),
}
ZONE_READERS = {  # module function taking a connection -> the old body it replaced
    "budgets._zone": _old_stuck_wrapper,
    "visits._zone": _old_stuck_wrapper,
    "rule_engine._zone": _old_rule_engine_zone,
    "messaging.time_zone": _old_messaging_time_zone,
    "dashboard_alerts._tz": _old_messaging_time_zone,
    "rfq_terms._tz": _old_messaging_time_zone,
}

# ------------------------------------------------------------------ inputs

STORED = [  # what db.now_iso() / outbox_store.iso write, around both DST changes of 2026
    "2026-09-14T07:28:12Z", "2026-09-14T07:28:12.345Z", "2026-03-26T23:59:59Z", "2026-03-27T00:00:00Z",
    "2026-10-24T22:30:00Z", "2026-10-24T23:30:00Z", "2026-12-31T22:00:00.999Z",
]
OFFSETS = ["2026-10-25T01:30:00+03:00", "2026-10-25T01:30:00+02:00", "2026-03-27T03:00:00+03:00", "2026-09-14T10:28:12.5+03:00"]
ZONELESS = ["2026-10-25T01:30:00", "2026-03-27T02:30:00", "2026-09-14T07:28:12"]
BAD = [None, "", "not a time", "2026-13-01T00:00:00Z", "2026-09-14T25:00:00Z"]
INSTANTS = [
    dt.datetime(2026, 9, 14, 7, 28, 12, 999_999, tzinfo=UTC),
    dt.datetime(2026, 3, 27, 1, 59, 59, 500_000, tzinfo=IL),
    dt.datetime(2026, 3, 27, 3, 0, tzinfo=IL),
    dt.datetime(2026, 10, 25, 1, 30, tzinfo=IL, fold=0),
    dt.datetime(2026, 10, 25, 1, 30, tzinfo=IL, fold=1),
    dt.datetime(2026, 10, 25, 1, 30, 0, 1_500),  # naive: astimezone in both (the process's local zone)
]


def _attr(dotted: str):
    mod, _, name = dotted.rpartition(".")
    return getattr(importlib.import_module(f"smplwise.services.tickets.{mod}"), name)


def _settings_db(value: str | None = None, *, row: bool = True) -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)")
    if row:
        conn.execute("INSERT INTO settings(key, value) VALUES ('time.zone', ?)", (value,))
    return conn


# ------------------------------------------------------------------ parsing


@pytest.mark.parametrize("name", sorted(PARSERS))
def test_each_parser_answers_as_its_copy_did(name):
    shared, old = PARSERS[name]
    assert _attr(name) is shared
    for value in STORED + OFFSETS + ZONELESS + BAD:
        assert shared(value) == old(value), (name, value)
        got = shared(value)
        assert got is None or got.tzinfo == UTC


def test_both_rules_agree_on_every_value_the_product_writes():
    """The switch of the six "zone-less = local" parsers to `parse_utc` (after the lab check) changes nothing for these."""
    for value in STORED + OFFSETS + BAD:
        assert tu.parse_utc(value) == tu.parse_naive_local(value), value


def test_the_two_rules_for_a_zone_less_value():
    naive = dt.datetime(2026, 10, 25, 1, 30)
    assert tu.parse_utc("2026-10-25T01:30:00") == naive.replace(tzinfo=UTC)
    assert tu.parse_naive_local("2026-10-25T01:30:00") == naive.astimezone(UTC)  # the process's local zone, as before


def test_non_text_values_read_as_none():
    """No caller passes one (all read stored text). Before, three copies raised AttributeError and intake's read str(value)."""
    for value in (0, 17, 1.5, dt.datetime(2026, 1, 1, tzinfo=UTC), b"2026-01-01T00:00:00Z", ["x"]):
        assert tu.parse_utc(value) is None and tu.parse_naive_local(value) is None


def test_stuck_parse_keeps_the_stored_offset():
    """stuck.parse (used by 9 modules) reads a zone-less value as UTC like parse_utc, but answers the stored offset rather
    than UTC; it stays as it was. For a stored `Z` value it is the same datetime as parse_utc."""
    from smplwise.services.tickets import stuck

    for value in STORED:
        assert stuck.parse(value) == tu.parse_utc(value)
    assert stuck.parse("2026-10-25T01:30:00+03:00").utcoffset() == dt.timedelta(hours=3)


# ------------------------------------------------------------------ formatting


@pytest.mark.parametrize("name", sorted(FORMATTERS))
def test_each_formatter_answers_as_its_copy_did(name):
    shared, old = FORMATTERS[name]
    assert _attr(name) is shared
    values = INSTANTS + ([None] if shared is tu.iso_s_or_none else [])
    for value in values:
        assert shared(value) == old(value), (name, value)


def test_the_formats_pin_the_text():
    at = dt.datetime(2026, 10, 25, 1, 30, 0, 987_654, tzinfo=IL, fold=1)
    assert tu.iso_s(at) == "2026-10-24T23:30:00Z"
    assert tu.iso_ms(at) == "2026-10-24T23:30:00.987Z"
    assert tu.iso_s_or_none(None) is None
    # PEP 495: an aware value in the fold with fold=1 never compares equal across zones, so compare in UTC
    assert tu.parse_utc(tu.iso_ms(at)) == at.replace(microsecond=987_000).astimezone(UTC)


# ------------------------------------------------------------------ the installation's zone


@pytest.mark.parametrize("name", [None, "", "Asia/Jerusalem", "Europe/London", "UTC", "Not/AZone", "Asia", "../etc", "a\x00b"])
def test_zone_named_answers_as_the_old_rule(name):
    assert tu.zone_named(name) == _old_zone_named(name)


@pytest.mark.parametrize("stored, row", [("Europe/London", True), ("", True), (None, True), (None, False), ("Not/AZone", True), ("Asia", True)])
def test_zone_readers_answer_as_before(stored, row):
    conn = _settings_db(stored, row=row)
    for name, old in ZONE_READERS.items():
        fn = _attr(name)
        assert fn is tu.zone_of, name
        try:
            want = old(conn)
        except OSError:
            # "Asia" names a tzdata directory: the old rule_engine / costs_report reader raised (PermissionError on Windows,
            # IsADirectoryError on Linux); the shared reader answers the default zone like the other four did
            assert name == "rule_engine._zone" and stored == "Asia"
            want = IL
        assert fn(conn) == want, (name, stored, row)


def test_one_default_zone():
    from smplwise.services.tickets import messaging, work_calendar

    assert tu.DEFAULT_ZONE == stu.DEFAULT_ZONE == DEFAULTS["time.zone"] == messaging.DEFAULT_TZ == work_calendar.DEFAULT_ZONE


def test_calendar_zone_falls_back_like_before():
    from smplwise.services.tickets.work_calendar import Calendar

    for name in ("", "Not/AZone", "Europe/London", "Asia/Jerusalem"):
        assert Calendar(enabled=True, zone=name).tz == _old_zone_named(name)


def test_costs_report_filename_uses_the_installation_zone(monkeypatch):
    from smplwise.services.tickets import costs_report

    assert costs_report.filename(_settings_db("Not/AZone")).startswith("ticket-costs-")
    assert len(costs_report.filename(_settings_db(None, row=False))) == len("ticket-costs-20260101-0000.csv")


# ------------------------------------------------------------------ DST edges through the aliases


def test_budget_month_bounds_across_the_autumn_change():
    from smplwise.services.tickets import budgets

    conn = _settings_db("Asia/Jerusalem")
    assert budgets.bounds(conn, "month", dt.date(2026, 10, 1)) == ("2026-09-30T21:00:00Z", "2026-10-31T22:00:00Z")
    assert budgets.bounds(conn, "month", dt.date(2026, 3, 1)) == ("2026-02-28T22:00:00Z", "2026-03-31T21:00:00Z")


def test_rule_engine_local_day_around_midnight_and_the_fold():
    from smplwise.services.tickets import rule_engine

    conn = _settings_db("Asia/Jerusalem")
    assert rule_engine.local_day(conn, dt.datetime(2026, 10, 24, 20, 59, tzinfo=UTC)) == "2026-10-24"  # 23:59 IDT
    assert rule_engine.local_day(conn, dt.datetime(2026, 10, 24, 21, 0, tzinfo=UTC)) == "2026-10-25"  # 00:00 IDT
    assert rule_engine.local_day(conn, dt.datetime(2026, 10, 25, 21, 59, tzinfo=UTC)) == "2026-10-25"  # 23:59 IST
    assert rule_engine.local_day(conn, dt.datetime(2026, 3, 26, 21, 59, tzinfo=UTC)) == "2026-03-26"  # 23:59 IST
    assert rule_engine.local_day(conn, dt.datetime(2026, 3, 26, 22, 0, tzinfo=UTC)) == "2026-03-27"


def test_visit_window_text_in_the_fold_hour():
    from smplwise.services.tickets import visits

    conn = _settings_db("Asia/Jerusalem")
    v = {"planned_from": "2026-10-24T22:30:00Z", "planned_to": "2026-10-24T23:30:00Z"}  # 01:30 IDT, then 01:30 IST
    assert visits.window_text(conn, v) == "25.10 01:30-01:30"


# ------------------------------------------------------------------ F-18


def test_text_hygiene_line_breaks_are_escapes_in_the_source():
    from smplwise.services.tickets import text_hygiene

    assert {" ", " "} <= text_hygiene._LINE_BREAKS
    src = Path(text_hygiene.__file__).read_text(encoding="utf-8")
    assert " " not in src and " " not in src
    assert len(src.splitlines()) == src.count("\n") + (0 if src.endswith("\n") else 1)  # line tools see the real lines
