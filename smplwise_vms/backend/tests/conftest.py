from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# CR-023: the electricity sampler thread stays off in tests (they call energy_sampler.tick with explicit instants)
os.environ.setdefault("SW_ENERGY_SAMPLER", "0")
os.environ.setdefault("SW_GENERATOR", "0")
os.environ.setdefault("SW_ELEVATORS", "0")  # CR-INFRA-ELEVATORS 2.8.0: tests call elevators_runtime.evaluate / tick with explicit instants
os.environ.setdefault("SW_TEMPERATURE", "0")  # CR-INFRA-TEMPERATURE 2.9.1: tests call temperature_runtime.evaluate / tick with explicit instants
os.environ.setdefault("SW_WISKEY_JOIN_LIVE_THREAD", "0")  # WISKEY-JOIN-LIVE-2382: tests call wiskey_join_live.MANAGER.evaluate directly
os.environ.setdefault("SW_SCENARIOS", "0")  # XSCENARIO109-295: tests call scenarios.step / tick with explicit instants
# CR-023: the bill PDF engine self-check (one child render per app start) stays off; tests call bill_pdf.self_check() directly
os.environ.setdefault("SW_BILL_PDF_SELFCHECK", "0")
os.environ.setdefault("SW_MAPPING_AUTO_STARTUP", "0")  # MAPPING-IMPROVE-2351: tests call mapping_auto.run directly
# CR-026: the recorder health poller stays off; tests call recorder_health.probe / poll_once / tick with explicit instants
os.environ.setdefault("SW_RECORDER_HEALTH", "0")
# CAMHEALTH091: the camera image health poller stays off; tests call camera_image_health.record / sample / poll_once / tick directly
os.environ.setdefault("SW_CAMERA_IMAGE_HEALTH", "0")
os.environ.setdefault("SW_CAMERA_SOURCE_HEALTH", "0")  # CAMERA-STREAM-SOURCES-2410: the tests call check_once directly
# NN5: the Frigate event loop (WebSocket + polling) stays off in app tests; they call frigate_events.poll_reviews / run_loop explicitly
os.environ.setdefault("SW_FRIGATE_EVENTS", "0")
# CR-021 S4: the start-up read of the running release's [platform-restart] marker stays off (a flagged release must not add a
# restart reason to every test app); tests call release_notes.note_release_restart with their own file
os.environ.setdefault("SW_RELEASE_MARKER", "0")
# CR-038 S5b: the ticket outbox worker thread stays off; tests call messaging.RUNTIME.run_once with explicit instants
os.environ.setdefault("SW_TICKETS_OUTBOX", "0")
# CR-ARX-WISKEY-SHARED-IDENTITY: the external-grant worker thread stays off; tests call access_grants.WORKER.run_once explicitly
os.environ.setdefault("SW_ACCESS_GRANTS_WORKER", "0")
# BUSTIMES-295: the bus-times poller thread stays off; tests call transit.poller.poll_once / catalogue_pass with a recorded fake
os.environ.setdefault("SW_TRANSIT", "0")
# CR-039 DOORWIN-295: the door-windows watchdog thread stays off; tests call door_windows.WORKER.run_once / sync / watch with explicit instants
os.environ.setdefault("SW_DOORWIN_WORKER", "0")
os.environ.setdefault("SW_STARTUP_WARMUP", "0")  # WARMUP-POLISH-2421: no warm-up thread in the test apps (tests call startup_warmup.run)
# WISKEY-EVENT-CURSOR-2400: the service feed's events/resume_v1 pump stays off; tests drive wiskey_event_resume.step / pass_once / run with a fake WisKey
os.environ.setdefault("SW_WISKEY_EVENT_RESUME", "0")
# CR-RESPONSE-MODELS-CONSUMPTION-2450 (review 07:F8 step 2): a response that does not fit its model, or carries an undeclared key,
# fails the test (production logs it and answers unchanged - smplwise/wire/__init__.py)
os.environ.setdefault("SW_WIRE_STRICT", "1")
# ADR-019 L14 step 1: a tolerant web-UI request model (smplwise/wire/request.py RequestModel) that receives an undeclared key fails the test
# (production drops the key as before, logs it once and counts it)
os.environ.setdefault("SW_REQUEST_STRICT", "1")

from smplwise.config import Settings  # noqa: E402
from smplwise.main import create_app  # noqa: E402,F401 - re-exported: test files import it from here

# GATESPEED-293: a fresh test app copies a database migrated once per process instead of running every migration again
# (tests/db_template.py; proof in tests/test_db_template.py). SW_TEST_DB_TEMPLATE=0 restores the per-test migrations.
import db_template as _db_template  # noqa: E402
from smplwise.db import Database as _Database  # noqa: E402

_db_template.install(_Database)

# BACKEND-SUITE-COST-2560: fastapi's per-application route analysis runs once per route and include context per process, not once
# per test app (tests/support/route_cache.py; proof in tests/test_route_cache.py). SW_TEST_ROUTE_CACHE=0 restores the per-app path.
from support import route_cache as _route_cache  # noqa: E402

_route_cache.install()

# CR-TEST-SUPPORT-2440 (review 05:P2-16): the plain helpers live in tests/support/ and are imported by name; they stay
# importable from here (`from conftest import as_user, bind, seed_tree`), as hundreds of test files do.
from support.apps import as_user, bind, enable_search, make_client, pdf_bytes, png_bytes, seed_tree, warm_routes  # noqa: E402,F401
from support.waiting import DAY_ANCHOR, datetime_shim, day_now, sw_load_factor, sw_perf_enabled, sw_time_factor  # noqa: E402,F401
from support import wire_oracle as _wire_oracle  # noqa: E402

# CR-RESPONSE-MODELS-CONSUMPTION-2450: every modelled answer is compared with the route's pre-model answer (tests/support/wire_oracle.py)
_wire_oracle.install()


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption("--sw-repeat", type=int, default=1, help="run every selected test N times (flaky-test verification; combine with a CPU burner)")


@pytest.fixture(autouse=True)
def _sw_repeat_index(request: pytest.FixtureRequest) -> None:
    return None


def pytest_generate_tests(metafunc: pytest.Metafunc) -> None:
    n = metafunc.config.getoption("--sw-repeat")
    if n > 1 and "_sw_repeat_index" in metafunc.fixturenames:
        metafunc.parametrize("_sw_repeat_index", range(n), ids=lambda i: f"rep{i}")


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
import types as _types  # noqa: E402


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


@pytest.fixture()
def client(settings: Settings) -> TestClient:
    return make_client(settings)


@pytest.fixture(autouse=True)
def _process_state_is_per_test():
    """Process-wide state is put back before and after every test (review 05:P2-17). A service that keeps state at module level
    registers one reset with `smplwise.test_reset.register_reset`; this single fixture calls them all, where conftest used to
    carry one autouse fixture per module. What is registered today, and the flake each reset was added for:

    - `recorders.hikvision` capability cache (CR-020 S2: the fake NVR's capability answers differ from test to test);
    - `recorder_scope.DISABLED` / `WRITES` (CR-024, NVR-H264-BULK-2341: set at start-up and by PATCH /recorders);
    - `bridge_discovery` refused-directory-push counter (BRIDGE-STALE-DISCOVERY-2383: a refused push in one test turned the
      bridge line red in the next);
    - `media_reach.REACH` and the `video_services` discovery cache (HEALTH-GO2RTC-2430 / -FOLLOWUP-2431: a fake go2rtc that
      refuses connections left the next test's /health `degraded`);
    - `storage` report cache (the start-up warm-up fills it from a daemon thread that can finish after its test is over);
    - `ha_client` refused-token ledger (FOLLOWUPS-2406: the fakes all use the token "t");
    - `intercom_sync` feed STATE and served copy (FOLLOWUPS-2406), left alone while a feed a test started is still winding down;
    - `ha_sync.STATE` link flag and its `disconnected_since` stamp, back to their import-time values (about twenty fixtures
      set `STATE.connected = True` and never undo it);
    - `bridge_install.STATE`, back to its import-time content (GATE-HYGIENE-2402: a "bridge copy waiting for a restart" leaked
      into test_self_update*.py).

    The fixtures test files still carry for their own singletons are listed, as a to-do, in tests/singletons_unregistered.txt
    (tests/test_singletons_registered.py)."""
    from smplwise import test_reset

    test_reset.reset_all()
    yield
    test_reset.reset_all()


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
