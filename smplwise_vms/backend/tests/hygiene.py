"""GATEHYGIENE (2.9.1): shared helpers that keep a test tied to the SOURCE OF TRUTH instead of a copy of it.

Two kinds of stale test turned release gates red without a product bug (2.7.0, 2.9.0):

1. a test that compared a whole settings block with a hand-written dict, so a NEW setting (added by another feature, with its own tests)
   broke an unrelated test (test_tickets_board: the `ui` block gained dash_digest_hour / dash_dept_stuck);
2. a test that asked the MACHINE for "today" (`date.today()`), while the product counts by the INSTALLATION's day (the `time.zone`
   setting, default Asia/Jerusalem). The gate runner is an Ubuntu box on Etc/UTC: between the installation's midnight and the
   machine's (21:00 / 22:00 UTC) the two dates differ by one day.

Use `installation_today()` / `installation_day()` for any value the product compares with ITS day (report ranges, payment / due dates,
"today" buckets), and `schema_defaults()` + `assert_defaults()` for a "the defaults are served" test: the expected block is derived from
the product's schema, and only the values the test is ABOUT are pinned by hand (with the decision they come from).

The wall-clock reproduction tool is tests/clock_shift.py (SW_FAKE_NOW=... SW_FAKE_LOCAL_TZ=UTC python -m pytest -p clock_shift ...).
Test-only: never imported by the product."""
from __future__ import annotations

import datetime as dt
from typing import Any, Mapping
from zoneinfo import ZoneInfo

DEFAULT_INSTALLATION_TZ = "Asia/Jerusalem"  # mirrors smplwise.services.tickets.messaging.DEFAULT_TZ (asserted in test_gate_hygiene.py)


def installation_zone(conn: Any = None) -> ZoneInfo:
    """The installation's zone: the stored `time.zone` setting when a connection is given (the product's own reader), else the default."""
    if conn is not None:
        from smplwise.services.tickets.messaging import time_zone

        return time_zone(conn)
    return ZoneInfo(DEFAULT_INSTALLATION_TZ)


def installation_today(days: int = 0, *, conn: Any = None, now: dt.datetime | None = None) -> dt.date:
    """The installation's calendar day `days` from today (never the machine's local date)."""
    at = now if now is not None else dt.datetime.now(dt.timezone.utc)
    if at.tzinfo is None:
        raise ValueError("installation_today(now=...) needs an aware datetime")
    return at.astimezone(installation_zone(conn)).date() + dt.timedelta(days=days)


def installation_day(days: int = 0, **kw: Any) -> str:
    """`installation_today()` as YYYY-MM-DD (the form the routes take)."""
    return installation_today(days, **kw).isoformat()


def schema_defaults(schema: Mapping[tuple[str, ...], tuple[Any, Any]], *prefix: str) -> dict[str, Any]:
    """The defaults of one block of a `{path tuple: (default, validator)}` schema (services/tickets/settings_doc.SCHEMA shape), keyed
    by the path below `prefix`. Nested paths stay nested."""
    out: dict[str, Any] = {}
    n = len(prefix)
    for path, (default, _check) in schema.items():
        if tuple(path[:n]) != prefix or len(path) == n:
            continue
        cur = out
        for p in path[n:-1]:
            cur = cur.setdefault(p, {})
        cur[path[-1]] = default
    return out


def assert_defaults(actual: Mapping[str, Any], expected: Mapping[str, Any], *, pinned: Mapping[str, Any], what: str = "settings") -> None:
    """`actual` is exactly the product's defaults (`expected`, derived from the source), and the `pinned` values - the decisions the
    calling test is about - still hold in BOTH. A new key added to the source extends `expected` by itself (no unrelated test breaks);
    a removed or renamed pinned key, or a changed pinned default, fails here with its name."""
    missing = sorted(k for k in pinned if k not in expected)
    assert not missing, f"{what}: pinned keys no longer in the source: {missing}"
    changed = {k: (expected[k], v) for k, v in pinned.items() if expected[k] != v}
    assert not changed, f"{what}: the source's default changed for pinned keys (source, pinned): {changed}"
    extra, lost = sorted(set(actual) - set(expected)), sorted(set(expected) - set(actual))
    assert not extra and not lost, f"{what}: served keys differ from the source (served only: {extra}, source only: {lost})"
    diff = {k: (actual[k], expected[k]) for k in expected if actual[k] != expected[k]}
    assert not diff, f"{what}: served values differ from the source's defaults (served, default): {diff}"
