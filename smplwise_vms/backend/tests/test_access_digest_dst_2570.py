"""Review CD2-18 (FIX-CORE2-2570): the weekly access digest's period is two scheduled LOCAL instants in the installation's IANA zone.
The 2.56 code counted a fixed 7 x 24 h back from the end, so in the week of a DST change one hour was counted twice or missed."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from smplwise.db import Database
from smplwise.services import access_external as ax
from smplwise.services.notify_visibility import principal_of

API = "/api/v1"


def _db(settings) -> Database:
    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    assert c.get(f"{API}/me").status_code == 200
    return Database(settings.db_path)


def test_the_digest_week_across_the_autumn_dst_change_is_169_hours(settings):
    db = _db(settings)
    # Asia/Jerusalem left DST on Sunday 25.10.2026 02:00 (UTC+3 -> UTC+2); the default digest is Sunday 08:00 local
    at = datetime(2026, 10, 25, 10, 0, tzinfo=timezone.utc)
    with db.connection(mode="read") as conn:
        assert ax.digest_day(conn) == 0 and ax.digest_hour(conn) == 8
        start, end = ax.period_bounds(conn, at)
        assert ax.ag.iso(end) == "2026-10-25T06:00:00Z", "08:00 local in standard time (UTC+2)"
        assert ax.ag.iso(start) == "2026-10-18T05:00:00Z", "the Sunday before, 08:00 local in summer time (UTC+3) - not 06:00Z"
        assert (end - start).total_seconds() == 169 * 3600
        uid = conn.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()["id"]
        rep = ax.digest(conn, principal_of(conn, uid), at)
    assert rep["period"] == {"from": "2026-10-18T05:00:00Z", "until": "2026-10-25T06:00:00Z"}


def test_the_digest_week_across_the_spring_dst_change_is_167_hours_and_a_plain_week_168(settings):
    db = _db(settings)
    with db.connection(mode="read") as conn:
        # Asia/Jerusalem entered DST on Friday 27.03.2026 02:00 (UTC+2 -> UTC+3)
        start, end = ax.period_bounds(conn, datetime(2026, 3, 29, 12, 0, tzinfo=timezone.utc))
        assert (ax.ag.iso(start), ax.ag.iso(end)) == ("2026-03-22T06:00:00Z", "2026-03-29T05:00:00Z")
        assert (end - start).total_seconds() == 167 * 3600
        start, end = ax.period_bounds(conn, datetime(2026, 11, 20, 12, 0, tzinfo=timezone.utc))
        assert (end - start).total_seconds() == 168 * 3600 and ax.ag.iso(end) == "2026-11-15T06:00:00Z"
