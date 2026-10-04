from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# CR-023: the electricity sampler thread stays off in tests (they call energy_sampler.tick with explicit instants)
os.environ.setdefault("SW_ENERGY_SAMPLER", "0")
# CR-023: the bill PDF engine self-check (one child render per app start) stays off; tests call bill_pdf.self_check() directly
os.environ.setdefault("SW_BILL_PDF_SELFCHECK", "0")

from smplwise.config import Settings  # noqa: E402
from smplwise.main import create_app  # noqa: E402


def sw_time_factor() -> float:
    """Multiplier for the generous (default) side of a wall-clock performance bound in a test.

    A handful of tests assert a property that is really about behaviour ("does not slow the detector down",
    "does not wait for the worker", "reads do not block on a writer") but can only observe it by timing
    something. Their default bound is deliberately loose so a busy workstation - another agent's build, a second
    pytest worker, antivirus - does not turn a behavioural check into a flaky one. Set `SW_TEST_TIME_FACTOR` (a
    float, default 1) to loosen it further on a machine or CI runner that is reliably slower or busier; values
    below 1 are ignored. See `sw_perf_enabled` for the tight bound each of these tests keeps available on request.
    """
    try:
        factor = float(os.environ.get("SW_TEST_TIME_FACTOR", "1"))
    except ValueError:
        return 1.0
    return factor if factor > 1.0 else 1.0


def sw_perf_enabled() -> bool:
    """True when `SW_PERF=1` asks for the strict, original wall-clock bound on a performance test.

    These bounds are tight enough to catch a real regression (an accidental O(n^2) merge, a lock that starts
    blocking readers) but only hold on a quiet machine, so they are opt-in rather than the default assertion.
    """
    return os.environ.get("SW_PERF") == "1"


@pytest.fixture()
def settings(tmp_path: Path) -> Settings:
    return Settings(
        data_dir=tmp_path / "data",
        www_dir=None,
        in_addon=False,
        trusted_proxies=("172.30.32.2",),
        dev_user="joni",
        bootstrap_admin_username="joni",
        # what load_settings gives a developer / test backend without NVR_HOST: the full mode with a placeholder host and
        # no credentials (config.DEV_NVR_PLACEHOLDER); the NVR-less mode (no nvr_host at all) has its own test_nvr_less.py
        nvr_host="nvr-placeholder.test",
        nvr_http_port=80,
        nvr_user=None,
        nvr_password=None,
        go2rtc_url=None,
        log_level="warning",
        max_upload_bytes=5 * 1024 * 1024,
        max_pdf_pages=5,
        max_render_px=800,
        preview_px=300,
    )


import datetime as _dt  # noqa: E402
import time as _time  # noqa: E402
import types as _types  # noqa: E402

# 12:00 on a Monday in Asia/Jerusalem (UTC+3 until 2026-10-25): outside the default quiet hours (22:00-07:00).
DAY_ANCHOR = _dt.datetime(2026, 10, 5, 9, 0, tzinfo=_dt.timezone.utc)
_DAY_T0 = _time.monotonic()


def day_now() -> _dt.datetime:
    """The pinned daytime clock: starts at DAY_ANCHOR and runs forward with the test run (so ordering still holds)."""
    return DAY_ANCHOR + _dt.timedelta(seconds=_time.monotonic() - _DAY_T0)


@pytest.fixture()
def daytime_clock(monkeypatch):
    """Pin the notification and push clocks to a daytime instant so a test does not depend on the wall clock.

    Tests that need another instant (a night inside quiet hours, an escalation boundary) patch `notify.now_utc`
    after this fixture; everything that decides from `now` (installation quiet hours, per-user push quiet hours,
    outbox staleness) reads that one seam. `push.plan` falls back to `datetime.now` when no instant is passed:
    it is routed through the same seam here, with no change to production code."""
    from smplwise.services import notify
    from smplwise.services import push as push_svc

    class _Datetime(_dt.datetime):
        @classmethod
        def now(cls, tz=None):
            at = notify.now_utc()
            return at.astimezone(tz) if tz is not None else at.replace(tzinfo=None)

    shim = _types.SimpleNamespace(**{k: v for k, v in vars(_dt).items() if not k.startswith("__")})
    shim.datetime = _Datetime
    monkeypatch.setattr(notify, "now_utc", day_now)
    monkeypatch.setattr(push_svc, "dt", shim)
    return day_now


@pytest.fixture(autouse=True)
def _clear_stream_options_cache():
    """CR-020 S2: the Hikvision adapter caches capability discovery per process; every test starts without it (the fake
    NVR's capability answers differ from test to test)."""
    from smplwise.services.recorders import hikvision

    hikvision.clear_options_cache()
    yield
    hikvision.clear_options_cache()


@pytest.fixture()
def client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings))


def as_user(username: str) -> dict[str, str]:
    """Developer-mode identity override (only honoured when SW_DEV_USER is set and never in the add-on)."""
    return {"X-SW-Dev-User": username}


def png_bytes(width: int = 640, height: int = 400, color=(240, 240, 250)) -> bytes:
    im = Image.new("RGB", (width, height), color)
    for x in range(0, width, 40):
        for y in range(height):
            im.putpixel((x, y), (120, 130, 150))
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def pdf_bytes(pages: int = 2) -> bytes:
    import pymupdf

    doc = pymupdf.open()
    for i in range(pages):
        page = doc.new_page(width=595, height=842)
        page.draw_rect(pymupdf.Rect(60, 60, 535, 780), color=(0.2, 0.3, 0.5), width=2)
        page.insert_text((80, 100), f"synthetic plan page {i + 1}", fontsize=18)
    data = doc.tobytes()
    doc.close()
    return data


def seed_tree(client: TestClient) -> dict[str, str]:
    """Admin creates site → building → two floors. Returns ids."""
    site = client.post("/api/v1/sites", json={"name": "אתר בדיקה", "address": "רחוב 1"}).json()
    building = client.post(f"/api/v1/sites/{site['id']}/buildings", json={"name": "מבנה א"}).json()
    f2 = client.post(f"/api/v1/buildings/{building['id']}/floors", json={"name": "קומה 2", "level": 2}).json()
    f3 = client.post(f"/api/v1/buildings/{building['id']}/floors", json={"name": "קומה 3", "level": 3}).json()
    return {"site": site["id"], "building": building["id"], "floor2": f2["id"], "floor3": f3["id"]}


def bind(client: TestClient, settings: Settings, username: str, role: str, scope_type: str, scope_id: str) -> None:
    """Direct DB binding for tests (the bindings API arrives with T076/T083)."""
    from smplwise.db import Database, new_id, now_iso, permission_revision

    # make sure the user row exists so the id is stable
    client.get("/api/v1/me", headers=as_user(username))
    db = Database(settings.db_path)
    with db.connection() as conn:
        conn.execute(
            "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', ?, ?, ?, ?, 'allow', ?, 'test', ?)",
            (new_id(), f"dev-{username}", role, scope_type, scope_id, permission_revision(conn), now_iso()),
        )


@pytest.fixture(autouse=True)
def _storage_report_cache_is_per_test():
    """`services.storage` keeps a process-wide 10-minute report cache, and the start-up warm-up fills it from a daemon thread that
    can finish after its test is over. Without this, a report built for another test's settings (an NVR, disks) leaks into the next
    one depending on timing - e.g. the NVR-less storage assertions failed under load and passed alone."""
    from smplwise.services import storage

    storage.invalidate()
    yield
    storage.invalidate()


# ---------------------------------------------------------------- SW_DB_IO_GUARD=1: I/O under the SQLite write lock

if os.environ.get("SW_DB_IO_GUARD") == "1":
    import json as _json

    from db_io_guard import CURRENT_TEST, FINDINGS, install  # noqa: E402

    @pytest.fixture(scope="session", autouse=True)
    def _db_io_guard():
        """Inventory of device / network / subprocess I/O made while a write lock is held (tests/db_io_guard.py)."""
        mp = pytest.MonkeyPatch()
        install(mp.setattr)
        yield
        mp.undo()
        found = FINDINGS.report()
        print(f"\n[db-io-guard] {len(found)} I/O site(s) under a held write lock")
        for item in found:
            print(f"[db-io-guard] {item['count']:4d}x {item['kind']:10s} holder={item['holder']!r} {item['where']} targets={item['targets']} tests={item['tests'][:2]}")
        out = os.environ.get("SW_DB_IO_GUARD_OUT")
        if out:
            with open(out, "w", encoding="utf-8") as fh:
                _json.dump(found, fh, ensure_ascii=False, indent=1)

    @pytest.fixture(autouse=True)
    def _db_io_guard_test(request):
        CURRENT_TEST["id"] = request.node.nodeid
        yield
