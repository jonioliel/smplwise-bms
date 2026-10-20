"""GATEHYGIENE (2.9.1): guards that keep the release gate MEANINGFUL - a red gate should mean a product regression, not a stale test.

1. The test suite never asks the MACHINE for "today": `date.today()`, a zone-less `datetime.now()` / `datetime.today()` / `utcnow()`, or a
   day taken from a fixed +03:00 offset. The product counts by the installation's zone (`time.zone`, default Asia/Jerusalem); the gate
   runner is Etc/UTC, so those forms differ from the product between the installation's midnight and the machine's (2.7.0 and 2.9.0 gate
   reds), and a fixed +03:00 is wrong for half the year (UTC+2 from the last Sunday of October). Use tests/hygiene.py.
2. tests/hygiene.py's default zone is the product's default zone.
3. Every default of the ticket settings schema passes its own validator and survives a read of an empty installation - so a new setting is
   well-formed by construction, and tests that derive their expectation from the schema (hygiene.schema_defaults) stay true.
4. The OFF-by-default switches of public / privacy surfaces stay off on a fresh installation (a new key elsewhere cannot flip them).
Static and in-memory only: the whole file runs in about a second."""
from __future__ import annotations

import copy
import re
import sqlite3
from pathlib import Path

import pytest

import hygiene
from smplwise.services.tickets import messaging, settings_doc

TESTS = Path(__file__).resolve().parent

# the machine's clock / zone: a zone-less now(), today(), utcnow(), date.today(); a calendar day read through a fixed +03:00 offset
MACHINE_DAY = re.compile(
    r"\bdate\.today\(\)"
    r"|\bdatetime\.(now|today)\(\)"
    r"|\bdatetime\.utcnow\(\)"  # a product helper named utcnow() (aware) is fine
    r"|timedelta\(hours=3\)\)\)?\.date\(\)"
    r"|timedelta\(hours=3\)\)\)?\.strftime\(\"%Y-%m-%d\"\)"
)

# Reviewed exceptions: file -> why the machine clock is harmless there. Keep this list SHORT; a new entry needs a reason.
ALLOWED: dict[str, str] = {
    "test_media_groups.py": "datetime.now().timestamp() only salts a client_request_id (an instant, not a day)",
    "test_gate_hygiene.py": "this file names the patterns",
}


def _offenders() -> list[str]:
    out = []
    for f in sorted(TESTS.glob("test_*.py")):
        if f.name in ALLOWED:
            continue
        for n, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            code = line.split("#", 1)[0]
            m = MACHINE_DAY.search(code)
            quoted = m is not None and code[:m.start()].endswith("`")  # `date.today()` named in a docstring, not called
            if m and not quoted:
                out.append(f"{f.name}:{n}: {line.strip()[:140]}")
    return out


def test_no_test_asks_the_machine_for_today():
    bad = _offenders()
    assert not bad, ("tests that read the MACHINE's day (wrong on the UTC runner near the installation's midnight; use "
                     "hygiene.installation_today() / installation_day(), or a fixed instant):\n  " + "\n  ".join(bad))


def test_the_allow_list_only_names_files_that_exist_and_still_need_it():
    for name in ALLOWED:
        f = TESTS / name
        assert f.exists(), f"stale ALLOWED entry: {name}"
        if name != "test_gate_hygiene.py":
            assert MACHINE_DAY.search(f.read_text(encoding="utf-8", errors="replace")), f"{name} no longer needs its exception"


def test_the_helpers_default_zone_is_the_products():
    assert hygiene.DEFAULT_INSTALLATION_TZ == messaging.DEFAULT_TZ


def test_installation_today_is_the_installation_day_not_the_utc_day():
    import datetime as dt

    late = dt.datetime(2026, 10, 31, 22, 30, tzinfo=dt.timezone.utc)  # 1 Nov 00:30 in Jerusalem (UTC+2 after 25.10)
    assert hygiene.installation_today(now=late) == dt.date(2026, 11, 1)
    assert hygiene.installation_day(-1, now=late) == "2026-10-31"
    summer = dt.datetime(2026, 7, 3, 21, 30, tzinfo=dt.timezone.utc)  # 4 Jul 00:30 (UTC+3)
    assert hygiene.installation_today(now=summer) == dt.date(2026, 7, 4)
    with pytest.raises(ValueError):
        hygiene.installation_today(now=dt.datetime(2026, 7, 3, 21, 30))


@pytest.mark.parametrize("path", list(settings_doc.SCHEMA), ids=lambda p: ".".join(p))
def test_every_ticket_setting_default_passes_its_own_validator(path):
    default, check = settings_doc.SCHEMA[path]
    assert check(copy.deepcopy(default)) == default, f"{'.'.join(path)}: the default is refused or rewritten by its validator"


def test_a_fresh_installation_reads_exactly_the_schema_defaults():
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)")
    doc = settings_doc.read(conn)
    assert doc.pop("revision") == 0
    for block in {p[0] for p in settings_doc.SCHEMA if len(p) > 1}:
        hygiene.assert_defaults(doc[block], hygiene.schema_defaults(settings_doc.SCHEMA, block), pinned={}, what=f"tickets.settings {block}")


# the public / privacy switches that ship OFF (or locked down) and are only changed by an administrator on purpose
SAFE_DEFAULTS = {
    ("whatsapp", "enabled"): False,
    ("vendor_portal", "enabled"): False,
    ("vendor_portal", "require_confirmed_number"): True,
    ("vendor_portal", "rfqs"): False,
    ("vendor_portal", "technician_requests"): False,
    ("rfq", "vendor_uploads", "enabled"): False,
    ("rfq", "attachments", "allow_office"): False,
    ("directory", "managers_full_phones"): False,
    ("staff_links", "require_code"): True,
    ("phone_verify", "required"): False,
    ("rfq", "schedule_arrival"): False,
}


@pytest.mark.parametrize("path,value", list(SAFE_DEFAULTS.items()), ids=lambda v: ".".join(v) if isinstance(v, tuple) else str(v))
def test_public_and_privacy_switches_keep_their_safe_default(path, value):
    assert path in settings_doc.SCHEMA, f"{'.'.join(path)} left the schema: update SAFE_DEFAULTS with the decision that replaced it"
    assert settings_doc.SCHEMA[path][0] is value


# Notification sources the owner decided ship OFF (release notes 2.8.0 / 2.9.0 "What is OFF by default"). Pinned one by one, so a NEW
# source never breaks this test, but none of these can be switched on by default without changing this list with its decision.
OFF_BY_DECISION = {
    "elevator.fire_service": "2.8.0, owner 2026-10-18: elevator alerts OFF, nobody, inbox only",
    "elevator.fault": "2.8.0, owner 2026-10-18",
    "elevator.out_of_service": "2.8.0, owner 2026-10-18",
    "ticket.dash_digest": "2.9.0 manager morning summary, OFF by default",
    "ticket.dash_busy_department": "2.9.0 busy-department alert, OFF by default",
    "rfq.instalment_due_tomorrow": "2.9.0 vendor payment due tomorrow, OFF by default",
    "camera.motion": "high-volume camera events stay opt-in",
    "camera.person": "high-volume camera events stay opt-in",
    "camera.vehicle": "high-volume camera events stay opt-in",
}


@pytest.mark.parametrize("key", sorted(OFF_BY_DECISION))
def test_notification_sources_decided_off_ship_off(key):
    from smplwise.services import notify_policy as p

    assert key in p.BY_KEY, f"{key} left the catalogue: update OFF_BY_DECISION ({OFF_BY_DECISION[key]})"
    s = p.BY_KEY[key]
    # the decision is the master switch of the source; its channel presets (push etc.) only apply once an administrator enables it
    assert s.enabled is False, f"{key} must ship off ({OFF_BY_DECISION[key]})"
    assert p.default_row(s)["enabled"] is False, f"{key}: the matrix row of a fresh installation must be off"
