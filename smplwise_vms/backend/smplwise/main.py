"""FastAPI application: /api/v1 routers, error model, correlation ids, and the built UI served for
Ingress (relative asset URLs, hash routing)."""
from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import mimetypes
import sqlite3
import threading
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import __version__, correlation_id
from .config import DEV_NVR_PLACEHOLDER, Settings, load_settings
from .db import Database, is_busy, is_storage_full
from .errors import ApiError, validation_payload
from .mode import is_ha_only
from .services import log_export
from . import recorder_scope
from . import routers as routers_pkg
from . import startup_steps

routers_pkg.import_eager()  # the router modules this module always imported at its own import, in the same order (routers.EAGER)

log = logging.getLogger("smplwise")


# CR-MAIN-ROUTERS-TABLE-2440: the conditions a routers.ROUTERS entry may name in `when`
MOUNT_CONDITIONS = {
    # developer identity mode only: truly absent otherwise, not merely a 404 raised from inside the handler
    "dev_identity": lambda settings: bool(settings.dev_user and not settings.in_addon),
}


def janitor_tick(db: Database, settings: Settings) -> None:
    """One housekeeping pass (every 30 s): idle playback sessions, orphan relay streams, empty playback groups,
    export retention, event / thumbnail / audit / HA-history pruning and every module's own retention. A plain function so a
    test runs it end to end — from 0.1.30 to 0.1.37 the pass died silently on a missing import before the audit prune.
    The steps, their order, arguments and warnings are the registry `services/janitors.py` (CR-JANITOR-REGISTRY-2438); every
    step is guarded (BACKEND-SAFETY-2435) except the three that never were (NVR storage warm-up, manual-recording stop, WAL
    checkpoint). Two failures end the pass on purpose: a demo state that cannot be read and settings that cannot be read."""
    from .services import janitors

    janitors.run_pass(db, settings)


def warm_route_tables(app: FastAPI) -> int:
    """Build every included router's route table now; returns the number of routes.

    FastAPI (0.141) builds an included router's effective route table lazily, on the first request whose path matching walks
    past it, and keeps it for the life of the app. With ~1570 routes the first request to a late router paid that whole build
    (measured 2.3 s on the runner, 10 s on a busy workstation) - a one-time cost per app that has nothing to do with the route
    that was asked for. `python -m smplwise` calls this before it listens; a test that times routes calls it before measuring."""
    from fastapi.routing import iter_route_contexts

    return sum(1 for _ in iter_route_contexts(app.router.routes))


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    # httpx/httpcore log full request URLs at INFO; ours may carry RTSP credentials (go2rtc sources) and
    # lab addresses. Keep them at WARNING regardless of the configured level.
    for noisy in ("httpx", "httpcore", "websockets"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    # CR-038 S4 (public-core review V10): Pillow's TIFF / EXIF reader logs tag VALUES at DEBUG (GPS, serial numbers of an
    # uploaded photo) - kept at INFO for the whole process whatever the add-on's log level
    logging.getLogger("PIL").setLevel(logging.INFO)
    # T033: the in-memory ring of recent log lines (with their request's correlation id) behind the redacted log export
    log_export.install()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.plans_dir.mkdir(parents=True, exist_ok=True)

    @contextlib.asynccontextmanager
    async def lifespan(_app: FastAPI):
        # CR-MAIN-ROUTERS-TABLE-2440 (review 05:P3-01): the two former `@app.on_event` handlers (deprecated) as one lifespan
        # context - the same two functions, defined further down, in the same order; like the event handlers, the stop does
        # not run when the start raised.
        await _start_janitor()
        yield
        await _stop_janitor()

    app = FastAPI(title="SmplWise Arx", version=__version__, docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.state.settings = settings
    from .services import demo_mode as _demo_mode

    _demo_mode.clear_on_boot(settings)  # CR-READY96: a restart exits demo mode - the handle below always starts on the real file
    app.state.db = Database(settings.db_path, pool=True)  # DB-CONN-POOL-2343: the one long-lived handle reuses its connections
    from .services import energy_billing_adapter

    energy_billing_adapter.configure(settings)  # CR-023: the readings store answers the billing branch's provider seam
    from . import db as db_mod

    # the add-on option db_write_gate (default on); SW_DB_WRITE_GATE=0 always wins
    db_mod.WRITE_GATE = settings.db_write_gate and os.environ.get("SW_DB_WRITE_GATE", "1") != "0"
    if not db_mod.WRITE_GATE:
        log.warning("database write gate is OFF (db_write_gate / SW_DB_WRITE_GATE=0): writers rely on SQLite's busy handler alone")
    # DB-CONN-POOL-2343: the add-on option db_conn_pool (default on); SW_DB_CONN_POOL=0 always wins (the kill switch)
    db_mod.CONN_POOL = settings.db_conn_pool and os.environ.get("SW_DB_CONN_POOL", "1") != "0"
    if not db_mod.CONN_POOL:
        log.warning("database connection reuse is OFF (db_conn_pool / SW_DB_CONN_POOL=0): every request opens its own connection")
    from .services import backup as backup_svc

    pre = backup_svc.pre_upgrade(settings)  # rollback safety: a copy of the data before a new version touches it
    if pre:
        log.info("pre-upgrade backup written: %s", pre.name)
    from .services import update_runs  # CR-021 S3 review: a start of an update's target version counts even if a migration crashes next

    update_runs.early_boot(app.state.db)
    applied = app.state.db.migrate()
    if applied:
        log.info("applied migrations %s", applied)
    startup_steps.after_migrate(app, settings, applied)  # CR-MAIN-ROUTERS-TABLE-2440: the guards and one-time repairs, in their old order
    # CR-022: the NVR connection stored in Arx (recorder_connections), overlaid ONCE here - after the migrations, before any
    # background worker - and the one-time import of the add-on options. Every later reader sees the effective settings; a
    # save or a removal waits for the next start (connection_pending_restart).
    from .services import connection_probe, connection_store, secrets_store

    # TKSECRETS2: the in-app secrets store (go2rtc / WisKey / OpenAI / push relay secrets): the one-time move of legacy add-on
    # options into it, then its values overlaid - before the NVR overlay, so every recorder's settings inherit them
    settings = secrets_store.apply_at_startup(app.state.db, settings)
    from .services import video_services

    # HEALTH-GO2RTC-FOLLOWUP-2431: the administrator's choice of video service takes precedence over the add-on option go2rtc_url (overlaid
    # before the NVR overlay, so every recorder inherits it); the option's own value is kept for "back to the add-on option"
    settings, app.state.go2rtc_option_url = video_services.apply_at_startup(app.state.db, settings)
    from .services import wiskey_camera

    wiskey_camera.apply_at_startup(app.state.db, settings)  # TKWISECRYPT: seal any plaintext per-station WisKey camera password
    settings, legacy_differ = connection_store.apply_at_startup(app.state.db, settings)
    try:  # NVR-H264-BULK-2341: the per-recorder switch "אפשר שינויי הגדרות ב־NVR" into the process (recorder_scope.WRITES)
        from .services import nvr_write_switch

        with app.state.db.connection(mode="read", label="nvr writes switch") as _conn:
            nvr_write_switch.load_all(_conn)
    except Exception:  # noqa: BLE001 - a failure leaves every recorder at its vendor default (Provision-ISR: off)
        log.warning("nvr writes switch load failed", exc_info=True)
    # 2.6.3 transitional (delta review S-1): empty the deprecated secret options whose values the stores now hold (names-only logs)
    secrets_store.clear_lingering_options(app.state.db, settings)
    app.state.settings = settings
    app.state.legacy_options_differ = legacy_differ
    app.state.connection_probe_limiter = connection_probe.probe_limiter()
    app.state.ma_test_limiter = connection_probe.probe_limiter()  # CR-016 section 18: the music server test has its own 5/min per user, 20/min per installation
    from .services import ma_direct

    ma_direct.SETTINGS[0] = settings  # the address policy reads the trusted proxies
    ma_direct.migrate_legacy_token(app.state.db, settings)  # a plain token file of an older version is imported once, then removed
    if settings.nvr_host == DEV_NVR_PLACEHOLDER:
        log.info("installation mode: full with a placeholder NVR host (developer backend without NVR_HOST); "
                 "SW_MODE=ha_only starts the NVR-less mode")
    if is_ha_only(settings):
        log.info("installation mode: ha_only (no NVR connection) - NVR discovery, alert stream, "
                 "recording-derived events, exports and event thumbnails are off; connect an NVR in Settings and restart to add one")
    if settings.dev_user:
        log.warning("developer identity mode is ON (SW_DEV_USER); never run like this inside Home Assistant")

    app.add_middleware(CorrelationId)  # the same place in the stack as the former @app.middleware("http") (innermost of ours)

    @app.exception_handler(ApiError)
    async def api_error(request: Request, exc: ApiError):
        return JSONResponse(status_code=exc.status, content=exc.payload(correlation_id.of(request) or ""))

    @app.exception_handler(sqlite3.OperationalError)
    async def storage_full(request: Request, exc: sqlite3.OperationalError):
        # T035 (outage run): a full data disk reaches the operator as a clear, enveloped answer instead of a bare 500. Every
        # other database error keeps its old path (re-raised: the server error and its trace, exactly as before).
        if is_busy(exc):
            # CR-MAIN-RUNTIME-2438 (review 05:P1-07): "database is locked" after the write-lock wait answers the error envelope,
            # marked retryable. Status stays 500 (lead decision L1: the screens give 503 a meaning of its own - "the NVR / the
            # intercom / the source is unavailable", the upload retry, "not sent" in messaging - so a busy database must not
            # borrow it); Retry-After is a hint only. The database layer has already logged who held the lock.
            cid = correlation_id.of(request) or correlation_id.new()
            log.warning("database busy: %s %s (correlation id %s)", request.method, request.url.path, cid, exc_info=True)
            return JSONResponse(status_code=500, headers={"Retry-After": str(BUSY_RETRY_AFTER_S), correlation_id.HEADER: cid},
                                content={"code": "database_busy", "user_message": "המערכת עמוסה כרגע והפעולה לא הושלמה. יש לנסות שוב בעוד רגע.",
                                         "retryable": True, "correlation_id": cid, "details": {"retry_after_s": BUSY_RETRY_AFTER_S}})
        if not is_storage_full(exc):
            raise exc
        log.error("the data disk is full: %s %s could not be saved", request.method, request.url.path)
        return JSONResponse(status_code=507, content={"code": "storage_full", "user_message": "אחסון התוסף מלא, ולכן לא ניתן לשמור. יש לפנות מקום בדיסק של התוסף.",
                                                      "retryable": False, "correlation_id": correlation_id.of(request) or "", "details": {"storage": "full"}})

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        code = {401: "unauthenticated", 403: "forbidden", 404: "not_found", 405: "method_not_allowed", 413: "payload_too_large"}.get(exc.status_code, "http_error")
        return JSONResponse(status_code=exc.status_code, content={"code": code, "user_message": str(exc.detail), "retryable": False,
                                                                  "correlation_id": correlation_id.of(request) or "", "details": {}})

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        # the same envelope as every other error, so a screen can show why a save was refused
        return JSONResponse(status_code=422, content=validation_payload(list(exc.errors()), correlation_id.of(request) or ""))

    @app.exception_handler(Exception)
    async def internal_error(request: Request, exc: Exception):
        # CR-MAIN-RUNTIME-2438 (review 05:P1-07): any unexpected error (a bug, a database error other than "full" or "busy")
        # answers the same envelope as every other error instead of Starlette's bare "Internal Server Error" text - same
        # status 500, a code, the correlation id in the body and the header (this answer leaves outside the correlation
        # middleware). Starlette re-raises the exception after this answer, so the server still logs the full traceback.
        cid = correlation_id.of(request) or correlation_id.resolve(request.headers.getlist(correlation_id.HEADER))
        log.error("unexpected error: %s %s -> %s (correlation id %s)", request.method, request.url.path, type(exc).__name__, cid)
        return JSONResponse(status_code=500, headers={correlation_id.HEADER: cid},
                            content={"code": "internal_error", "user_message": "אירעה שגיאה בלתי צפויה. יש לנסות שוב; אם השגיאה חוזרת, יש לפנות לתמיכה עם מזהה הבקשה.",
                                     "retryable": False, "correlation_id": cid, "details": {}})

    # CR-MAIN-ROUTERS-TABLE-2440 (review 05:P2-05): the routers are mounted from the ordered table routers.ROUTERS - the order is
    # behaviour (see that module); the wiring that always ran between two includes runs at its place as a Step.
    for entry in routers_pkg.ROUTERS:
        if isinstance(entry, routers_pkg.Step):
            startup_steps.WIRING[entry.name](app, settings)
            continue
        module = routers_pkg.load(entry.module)
        if isinstance(entry, routers_pkg.Load) or (entry.when is not None and not MOUNT_CONDITIONS[entry.when](settings)):
            continue
        if entry.prefix:
            app.include_router(getattr(module, entry.attr), prefix=routers_pkg.API_PREFIX, tags=[entry.tag])
        else:
            app.include_router(getattr(module, entry.attr))
    from .services.tickets.messaging import RUNTIME as tickets_messaging  # started and stopped by the lifespan below
    from .services.tickets.public_runtime import RUNTIME as tickets_public

    async def _start_janitor() -> None:
        try:  # SEC3 (review L4): the sign-in rate counters of the previous process
            from .services import ha_user_auth as hua_svc

            hua_svc.restore_limiter(app.state.db)
        except Exception:  # noqa: BLE001 - a failed restore is the old behaviour (empty counters)
            log.warning("rate limiter restore failed", exc_info=True)
        try:  # USR2: the per-address and global sign-in tiers of the local identities (written behind by the janitor)
            from .services import local_identity as local_identity_svc

            local_identity_svc.restore_tiers(app.state.db)
        except Exception:  # noqa: BLE001
            log.warning("local identity tiers restore failed", exc_info=True)
        # SESSIONEXCH2-295 (decision 398, review S-03): no app web session and no one-time code survives a restart (never raises)
        from .services import app_session as app_session_svc

        app_session_svc.end_on_startup(app.state.db)
        # Sessions never survive a restart: remove our leftover playback streams, then expire idle
        # sessions every 30 s. Only `smplwise_pb_*` names are ever deleted.
        from starlette.concurrency import run_in_threadpool

        from .services import exports as ex
        from .services import playback as pb
        from .services.settings_store import setting_value  # CR-JANITOR-REGISTRY-2438 (05:P1-03): the zone is one key, not 261

        def _instance() -> str:
            from .db import get_setting, set_setting
            import secrets as _secrets

            with app.state.db.connection() as conn:
                iid = get_setting(conn, "instance_id")
                if not iid:
                    iid = _secrets.token_hex(4)
                    set_setting(conn, "instance_id", iid)
            return iid

        pb.set_instance_id(await run_in_threadpool(_instance))
        from .services import nvr_batch

        # CR-020 S2C: a batch left running by the previous process ends `interrupted` (its pending item settled by a read when
        # due); a write is never resumed after a restart
        await run_in_threadpool(lambda: nvr_batch.recover_batches(app.state.db, settings, startup=True))
        if settings.go2rtc_url:
            await run_in_threadpool(pb.sweep_orphans, settings)
        # NVR-less mode: none of the NVR background work starts (mode.py). CR-024: a recorder that is only disabled still counts -
        # enabling it applies at once, so its workers must exist (each skips a disabled recorder by itself)
        ha_only = is_ha_only(settings) and not recorder_scope.loaded_any(settings)
        if not ha_only:
            ex.WORKER.start(app.state.db, settings)
        from .services import autosync, events_derive, events_ingest

        def _tz() -> str:
            with app.state.db.connection(mode="read") as conn:  # never takes the write lock
                return setting_value(conn, "time.zone")  # per NVR alert (events_ingest): one key, as read_settings()["time.zone"]

        async def discover(reason: str) -> None:
            await run_in_threadpool(autosync.run_once, app.state.db, settings, reason)
            autosync.PERIODIC.mark()
            # recording-derived events for today follow every discovery (same NVR search cache)
            await run_in_threadpool(events_derive.run_once, app.state.db, settings, _tz())
            if reason == "startup":
                from .services import storage

                storage.warm(app.state.db, settings, force=True)

        def _tz_of(recorder_id: str):
            """CR-024: a further recorder's alert-stream times are converted in its own zone (recorders.time_zone), else the
            installation's."""
            def getter() -> str:
                with app.state.db.connection(mode="read") as conn:
                    try:
                        row = conn.execute("SELECT time_zone FROM recorders WHERE id = ?", (recorder_id,)).fetchone()
                    except Exception:  # noqa: BLE001 - a database before 0055
                        row = None
                    return (row["time_zone"] if row and row["time_zone"] else None) or setting_value(conn, "time.zone")
            return getter

        app.state.tz_of = _tz_of  # CR-024: a recorder enabled while running starts its alert stream with its own zone
        if not ha_only:
            app.state.discovery = asyncio.create_task(discover("startup"))
            if recorder_scope.is_disabled(recorder_scope.PRIMARY):
                # disabled first recorder: never connected, but ready for an enable that applies at once
                events_ingest.LISTENER.db, events_ingest.LISTENER.settings, events_ingest.LISTENER.tz_getter = app.state.db, settings, _tz
            else:
                events_ingest.LISTENER.start(app.state.db, settings, _tz)
            for rid in recorder_scope.ready_ids(settings):
                if rid != recorder_scope.PRIMARY:
                    events_ingest.start_extra_one(app.state.db, settings, rid, _tz_of(rid))
        from .services import ha_sync

        ha_sync.SYNC.start(app.state.db, settings)
        from .services import lease_events

        # CR-WISKEY-LEASE-REVOCATION-EVENT T11 / F4: Arx holds no capture lease after a restart (every live row -> revoked(startup));
        # a new revocation stream is announced only when there were live rows or the route is on - otherwise nothing is sent
        await run_in_threadpool(lease_events.WORKER.on_startup, app.state.db, settings)
        from .services import access_grants as access_grants_svc

        # CR-ARX-WISKEY-SHARED-IDENTITY: the external-grant worker (a queued code lost by the restart -> not_delivered; the janitor
        # resumes ends and revokes). SW_ACCESS_GRANTS_WORKER=0 keeps the thread off (tests call WORKER.run_once explicitly).
        if os.environ.get("SW_ACCESS_GRANTS_WORKER", "1") != "0":
            await run_in_threadpool(access_grants_svc.WORKER.start, app.state.db, settings)
        from .services import door_windows as door_windows_svc

        # CR-039 DOORWIN-295: the door-windows watchdog / compile / emergency-retry thread (idle while nothing is planned; resumes from the
        # database after a restart). SW_DOORWIN_WORKER=0 keeps it off (tests call door_windows.WORKER.run_once with explicit instants).
        if os.environ.get("SW_DOORWIN_WORKER", "1") != "0":
            door_windows_svc.WORKER.start(app.state.db, settings)
        from .services import intercom_sync, intercom_write_journal

        # WisKey round 5 R5-A6: the durable journal of person writes (intent before dispatch, outcome after; an unresolved write of an
        # earlier process holds the next write to that person until a fresh readback) - installed before the feed can send anything
        intercom_sync.SYNC.journal = intercom_write_journal.WriteJournal(app.state.db)
        intercom_sync.SYNC.start(settings)  # CR-005: WisKey entry-center feed (read-only)

        # WKINT-295: WisKey's direct API behind the people-write / capture / template ports - installed ONLY when the installation chose
        # `access.station_media_provider = auto` AND the pairing key signs (else nothing at all: no lineage, no transport, no thread);
        # one lineage per process, its scope recovered once the direct socket authenticates (in the background, never blocking start)
        from .services import wiskey_auto_install

        # WISKEY-ADOPT-2272: fills the unset station provider (`auto`, the one setting the installation needs - review M1) once WisKey's
        # installation manifest is ready - only with wiskey.auto_install = on; audited; never overrides an owner value, never switches a
        # feature on, never opens the template send permit, never sends or actuates
        try:
            await run_in_threadpool(wiskey_auto_install.activate_software, app.state.db)
        except Exception:  # noqa: BLE001 - start-up never fails on it
            log.warning("wiskey installation activation failed", exc_info=True)
        from .services import wiskey_join_live

        # WISKEY-JOIN-LIVE-2382: the same `startup` at once (recovery in the background), then the runtime manager follows the provider
        # setting and the signing key without a restart (SW_WISKEY_JOIN_LIVE_THREAD=0: no background thread)
        await run_in_threadpool(wiskey_join_live.MANAGER.boot, app.state.db, settings)
        # DOORLIVE-2310: the door engines go live behind OFF switches - the Direct emergency engine becomes the process's emergency engine (it sends only over
        # the selected join) and an incident still active from before this start is flagged for verification (never re-sent). Changes no switch.
        from .services import door_engine_live

        await run_in_threadpool(door_engine_live.startup, app.state.db, settings)
        from .services import energy_sampler

        energy_sampler.SAMPLER.start(app.state.db, settings)  # CR-023: one poll a minute of the meters from the state mirror (read-only)
        from .services import water_sampler

        water_sampler.SAMPLER.start(app.state.db, settings)  # CR-WATER78: the water meters' poll - only while the module is on (read-only)
        from .services import generator_runtime

        generator_runtime.RUNNER.start(app.state.db, settings)  # CR-031: generator detection, history samples and alerts from the state mirror (read-only)
        from .services import elevators_runtime

        elevators_runtime.RUNNER.start(app.state.db)  # CR-INFRA-ELEVATORS 2.8.0: elevator state history and notifications from the state mirror (read-only)
        from .services import temperature_runtime

        temperature_runtime.RUNNER.start(app.state.db)  # CR-INFRA-TEMPERATURE 2.9.1: temperature history, status and alerts from the state mirror (read-only)
        from .services import scenarios as scenarios_svc

        scenarios_svc.RUNNER.start(app.state.db)  # XSCENARIO109-295: the scenario engine tick (reads nothing while the module is off)
        if os.environ.get("SW_BILL_PDF_SELFCHECK", "1") != "0":  # CR-023: log and expose which bill PDF engine really works here
            from .services import bill_pdf

            threading.Thread(target=bill_pdf.self_check, name="bill-pdf-selfcheck", daemon=True).start()
        if os.environ.get("SW_MAPPING_AUTO_STARTUP", "1") != "0":  # MAPPING-IMPROVE-2351: auto-insert of names that arrived while we were down
            from .services import mapping_auto

            threading.Thread(target=mapping_auto.run_safe, args=(app.state.db, "startup"), name="mapping-auto-startup", daemon=True).start()
        from .services import wiskey_background_feed

        wiskey_background_feed.FEED.start(settings)  # B0 (D-004/D-006): the split background session; runs only with wiskey_background_token
        from .services import bridge_install, thumbnails

        if not ha_only:
            thumbnails.WORKER.start_with(app.state.db, settings)
        from .services import backup as backup_svc

        app.state.backup_task = asyncio.create_task(backup_svc.daily_loop(app.state.db, settings))
        if os.environ.get("SW_BRIDGE_ROTATION_WORKER", "1") != "0":
            from .services import bridge_rotation

            # HMACACT-295: finishes a rotation left mid-way, retires the old key at its deadline and starts the automatic rotation once
            # the bridge announces support (nothing is started while the switch is off or the bridge has not announced it)
            app.state.bridge_rotation_task = asyncio.create_task(bridge_rotation.worker_loop(app.state.db, settings))
        if os.environ.get("SW_PARTNER_WEBHOOK_WORKER", "1") != "0":
            from .services.partner import webhooks as partner_webhooks

            # PARTNERAPI113-295: the webhook delivery worker - idle while `partner.webhooks` is off (and it cannot be switched on in this build)
            app.state.partner_webhooks_task = asyncio.create_task(partner_webhooks.worker_loop(app.state.db, settings))
        from .services import backup_drill

        # DATASTORE-295: the monthly restore drill - the loop only reads its switch (`backup.drill.monthly`, OFF by default)
        app.state.backup_drill_task = asyncio.create_task(backup_drill.monthly_loop(app.state.db, settings))
        if os.environ.get("SW_FLEET_WORKER", "1") != "0":
            from .services import fleet_report

            # CR-FLEET215: the daily fleet report - the loop only reads its two keys (the `fleet_report_url` add-on option and the
            # `fleet.report_enabled` switch, OFF by default); while either is off it builds, signs and sends nothing
            app.state.fleet_report_task = asyncio.create_task(fleet_report.worker_loop(app.state.db, settings))
        from .services import push as push_svc

        push_svc.NOTIFIER.start(app.state.db)  # CR-008 P3: Web Push for rule alerts (only to subscribed users in scope)
        from .services import notify_sources

        notify_sources.start(app.state.db, settings)  # CR-018 S2: the source monitors (health, faults, sensors) and the writer of queued signals
        from .services import intercom_calls

        intercom_calls.WRITER.start(app.state.db)  # WISKEY-INBOUND-CALLS-2382: the writer of the door-station call log (closes calls left open first)
        from .services import wiskey_triage

        wiskey_triage.FEED.start(app.state.db, settings)  # WISKEY-CONFLICTS-2400: WisKey fleet alerts -> notifications, only while its setting is on (default off)
        if not ha_only:
            from .services import recorder_health

            recorder_health.POLLER.start(app.state.db, settings)  # CR-026: read-only health reads of every recorder (default once a minute)
            from .services import camera_image_health

            camera_image_health.POLLER.start(app.state.db, settings)  # CAMHEALTH091: idle until switched on in Settings; samples the cache or existing sub streams only
        from .services import camera_sources

        camera_sources.POLLER.start(app.state.db, settings)  # CAMERA-STREAM-SOURCES-2410: one frame per manual source every 5 min (none without one)
        from .services.transit import poller as transit_poller

        transit_poller.POLLER.start(app.state.db, settings)  # BUSTIMES-295: idle until the module is on and a board shows transit; the only caller of the third party
        await run_in_threadpool(bridge_install.run_startup, app.state.db, settings)
        from .services import wiskey_managed_install as _wmi

        threading.Thread(target=_wmi.startup_safe, args=(app.state.db, settings), name="wiskey-managed-recover", daemon=True).start()  # WISKEY-MANAGED-INSTALL-2382: an Arx restart mid-run never leaves the core stopped; WISKEY-INSTALL-ANSWERS-2400 (owner 04.11 Q3 = B): then the start-up run, only with the managed AND start-up switches on
        if settings.cast_relay:  # CR-028: the cast relay listens only when the add-on option is on (the host port mapping is the owner's)
            from .services import cast_relay

            cast_relay.SERVER.start(cast_relay.go2rtc_fetch(settings))
        if settings.notice_boards:  # CR-NOTICE106: the TV boards' LAN listener (container port 18094) - on the add-on option alone
            from .services.notices import display as notice_display
            from .services.notices import listener as notice_listener

            notice_listener.SERVER.start(
                notice_display.DisplayService(lambda: app.state.db.connection(mode="read", label="notices.display"), settings.data_dir,
                                              touch=notice_display.touch_seen(app.state.db),
                                              capture=notice_display.capture_link(app.state.db, settings.data_dir)), settings.www_dir,
                caps=notice_listener.settings_caps(lambda: app.state.db.connection(mode="read", label="notices.listener")))
        if settings.tickets_public:  # CR-038 S4: the handler page's listener - on the add-on option alone; its own thread, loop and pool
            await run_in_threadpool(tickets_public.start, app.state.db, settings)  # start() waits up to 5 s: never on the main loop (W14)
        await run_in_threadpool(tickets_messaging.start)  # CR-038 S5b: the `tickets-outbox` worker (idle while the module is off)

        async def loop() -> None:
            while True:
                await asyncio.sleep(30)
                try:
                    # HEALTH-GO2RTC-FOLLOWUP-2431: the LIVE settings - a video service chosen in Settings applies to the playback
                    # leases and orphan sweep (stream deletes on the right service) and to the reachability probe without a restart
                    live = app.state.settings
                    await run_in_threadpool(janitor_tick, app.state.db, live)
                    if live.go2rtc_url:  # HEALTH-GO2RTC-2430: the light reachability check (a probe only when due, backoff-bounded)
                        from .services import media_reach

                        await run_in_threadpool(media_reach.REACH.tick, live)
                    if not ha_only and autosync.PERIODIC.due():
                        await discover("periodic")
                except Exception as exc:  # never let the janitor die
                    log.warning("janitor tick failed: %s", type(exc).__name__, exc_info=True)

        app.state.janitor = asyncio.create_task(loop())
        from .services import startup_warmup

        # WARMUP-POLISH-2421: the bounded read-only warm-up of what the first screens read (its own daemon thread, a few seconds from
        # now; never blocks readiness; off with server.startup_warmup = "false" or SW_STARTUP_WARMUP=0)
        app.state.startup_warmup = startup_warmup.start(app.state.db, app)
        if settings.remote_access:  # CR-008: re-validate remote sessions against HA (revocation within 60 s)
            from .services import ha_user_auth

            log.info("remote access (SmplWise Arx) is ON at %s/", settings.remote_path)
            app.state.remote_revalidation = asyncio.create_task(ha_user_auth.revalidate_loop(app.state.db, settings))

    async def _stop_janitor() -> None:
        # CR-MAIN-RUNTIME-2438 (review 05:P2-01): every stop runs through _shutdown_step / _in_thread_step, so one stop that
        # raises is logged and the later ones still run - above all the capture-lease revocation and close_pool (last).
        from starlette.concurrency import run_in_threadpool as _stop_in_thread

        async def _in_thread_step(name: str, fn, *args) -> None:
            try:
                await _stop_in_thread(fn, *args)
            except Exception:  # noqa: BLE001 - one failing stop never skips the later ones
                log.warning("shutdown step %s failed", name, exc_info=True)

        from .services import nvr_batch

        _shutdown_step("nvr batch signal", nvr_batch.signal_shutdown)  # CR-020 S2C: first, so no batch starts another camera while the rest shuts down
        from .services import cast_relay

        _shutdown_step("cast relay", cast_relay.SERVER.stop)  # CR-028: the cast relay's listener (a running cast's token survives in the database, not the socket)
        from .services.notices import listener as notice_listener

        _shutdown_step("notice listener", notice_listener.SERVER.stop)  # CR-NOTICE106: the TV boards' LAN listener

        await _in_thread_step("tickets public", tickets_public.stop, app.state.db)  # CR-038 S4: the handler page's listener (joins 5 s), then its counters
        await _in_thread_step("tickets outbox", tickets_messaging.stop)  # CR-038 S5b: the outbox worker (joins 5 s; a row in flight ends `unknown` at the next start)
        # ASGI-295 F2: the daily backup loop is cancelled too, and every cancelled task is awaited (bounded; their own errors are not raised).
        # CR-MAIN-RUNTIME-2438: the start-up NVR discovery task is cancelled with them (a shutdown during start-up no longer leaves it running)
        stopping = []
        for name in ("janitor", "remote_revalidation", "backup_drill_task", "bridge_rotation_task", "fleet_report_task", "partner_webhooks_task",
                     "backup_task", "discovery"):
            task = getattr(app.state, name, None)
            if task and not task.done():
                task.cancel()
                stopping.append(task)
        if stopping:
            await asyncio.wait(stopping, timeout=5)
        from .services import ha_user_auth as hua_svc

        # SEC3 (review L4): the last sign-in counters reach the database before the process ends
        _shutdown_step("rate limiter final flush", hua_svc.flush_limiter, app.state.db)
        from .services import events_ingest
        from .services import exports as ex

        _shutdown_step("exports worker", ex.WORKER.shutdown)
        _shutdown_step("alert listener", events_ingest.LISTENER.shutdown)
        _shutdown_step("further alert listeners", events_ingest.shutdown_extra)  # CR-024: the further recorders' alert streams
        from .services import thumbnails as th

        _shutdown_step("thumbnails worker", th.WORKER.stop_evt.set)
        from .services import ha_sync

        await _in_thread_step("ha sync", ha_sync.SYNC.shutdown)  # CR-WAVE2-COMBINED-2439: wakes and joins its loop thread (bounded), off the event loop
        from .services import lease_events

        # CR-WISKEY-LEASE-REVOCATION-EVENT T11: before the WisKey feed stops, any live capture lease is revoked (scope all) within 2 s
        await _in_thread_step("capture lease revocation", lease_events.WORKER.on_shutdown)
        from .services import access_grants as access_grants_svc

        _shutdown_step("access grants worker", access_grants_svc.WORKER.stop)
        from .services import door_windows as door_windows_svc

        _shutdown_step("door windows worker", door_windows_svc.WORKER.stop)
        from .services import intercom_consent, intercom_sync

        _shutdown_step("intercom consent releaser", intercom_consent.RELEASER.stop)  # WA-CONSENT-LINK: no new release starts; due rows stay due for the next start
        from .services import wiskey_direct_join as _wkj

        from .services import door_engine_live as _del

        _shutdown_step("door engine", _del.uninstall)
        from .services import wiskey_join_live as _wjl

        _shutdown_step("wiskey join manager", _wjl.MANAGER.shutdown)  # WISKEY-JOIN-LIVE-2382: the manager's thread ends first, then the join stops cleanly (drained)
        _shutdown_step("wiskey direct join", _wkj.shutdown)  # WKINT-295: the existing transports come back; the lineage closes (a no-op when nothing was installed)
        await _in_thread_step("intercom sync", intercom_sync.SYNC.shutdown)  # CR-WAVE2-COMBINED-2439: wakes and joins its loop thread (bounded)

        def _detach_journal() -> None:
            intercom_sync.SYNC.journal = None  # R5-A6: nothing is sent after shutdown; unresolved rows stay for the next process

        _shutdown_step("intercom sync journal", _detach_journal)
        from .services import energy_sampler

        _shutdown_step("energy sampler", energy_sampler.SAMPLER.shutdown)
        from .services import water_sampler as _wsm

        _shutdown_step("water sampler", _wsm.SAMPLER.shutdown)
        from .services import generator_runtime

        _shutdown_step("generator runtime", generator_runtime.RUNNER.shutdown)
        from .services import elevators_runtime as _elr

        _shutdown_step("elevators runtime", _elr.RUNNER.shutdown)
        from .services import temperature_runtime as _tmr

        _shutdown_step("temperature runtime", _tmr.RUNNER.shutdown)
        from .services import scenarios as _scn

        _shutdown_step("scenarios runtime", _scn.RUNNER.shutdown)
        from .services import wiskey_background_feed as _wbf

        await _in_thread_step("wiskey background feed", _wbf.FEED.shutdown)  # CR-WAVE2-COMBINED-2439: wakes and joins its loop thread (bounded)
        from .services import push as push_svc

        await _in_thread_step("push notifier", push_svc.NOTIFIER.shutdown)  # queued alerts get a few seconds to go out
        from .services import notify_sources

        await _in_thread_step("notify sources", notify_sources.shutdown)
        from .services import intercom_calls as _intercom_calls

        await _in_thread_step("intercom call writer", _intercom_calls.WRITER.shutdown)
        from .services import wiskey_triage as _wiskey_triage

        await _in_thread_step("wiskey triage feed", _wiskey_triage.FEED.shutdown)
        from .services import intercom_media as _station_media

        # WKF01F02-295 (F01): the signed station-media provider's leased streams leave go2rtc and their timers are joined; never raises
        await _in_thread_step("station media bridge", _station_media.shutdown_bridge)
        from .services import recorder_health

        await _in_thread_step("recorder health poller", recorder_health.POLLER.shutdown)
        from .services import camera_image_health

        await _in_thread_step("camera image health poller", camera_image_health.POLLER.shutdown)
        from .services import camera_sources

        await _in_thread_step("camera sources poller", camera_sources.POLLER.shutdown)
        from .services.transit import poller as transit_poller

        await _in_thread_step("transit poller", transit_poller.POLLER.shutdown)
        await _in_thread_step("nvr batch runners", nvr_batch.shutdown)  # CR-020 S2C: each runner ends after its current camera; the rest is not attempted
        from .routers import plan_geometry as plan_geometry_router

        _shutdown_step("plan detect pool", plan_geometry_router.shutdown_detect_pool)
        warmup = getattr(app.state, "startup_warmup", None)
        if warmup is not None and warmup.is_alive():
            # CR-MAIN-RUNTIME-2438: the read-only warm-up thread (a daemon, it cannot be cancelled) gets a bounded moment to end
            # before the pool closes, so it never opens a connection behind close_pool
            await _in_thread_step("startup warm-up", warmup.join, WARMUP_JOIN_S)
        _shutdown_step("database pool", app.state.db.close_pool)  # DB-CONN-POOL-2343: last, after every worker stopped - no idle connection keeps the files open

    @app.get("/healthz", include_in_schema=False)
    async def healthz():
        # Supervisor watchdog target: no identity, no details.
        return {"status": "ok"}

    mimetypes.add_type("application/manifest+json", ".webmanifest")  # the PWA manifest (CR-008 P3)
    www = settings.www_dir
    if www and Path(www).is_dir():
        index = Path(www) / "index.html"

        @app.get("/", include_in_schema=False)
        async def root():
            return FileResponse(index, headers={"Cache-Control": "no-cache"})

        sw_file = Path(www) / "arx-sw.js"

        @app.get("/arx-sw.js", include_in_schema=False)
        async def service_worker():
            # CR-008 P3: the app's service worker, scoped to the directory it is served from (the Ingress prefix or
            # /arx/); always revalidated so a new release's worker is found at once
            if not sw_file.is_file():
                raise StarletteHTTPException(404, "not found")
            return FileResponse(sw_file, media_type="text/javascript", headers={"Cache-Control": "no-cache"})

        app.mount("/", StaticFiles(directory=str(www), html=True), name="www")
    else:
        log.warning("no built UI found (SW_WWW_DIR=%s); API only", www)

    commit_before_send(app)
    from . import body_limit, remote_channel

    body_limit.install(app, settings)  # request body limits while the body streams (inside RemoteChannel, outside the rest)
    remote_channel.install(app, settings)  # CR-008: outermost - the /arx prefix, its 404 switch and header stripping
    return app


WARMUP_JOIN_S = 2.0  # shutdown: the longest wait for a still-running start-up warm-up thread before the pool closes
BUSY_RETRY_AFTER_S = 2  # a "database is locked" answer: the Retry-After a client may honour (status stays 500, lead decision L1)


def _shutdown_step(name: str, fn, *args) -> None:
    """CR-MAIN-RUNTIME-2438 (review 05:P2-01): one stop of the shutdown sequence; a stop that raises is logged and the
    sequence goes on, so the later stops (the capture-lease revocation, close_pool) always run."""
    try:
        fn(*args)
    except Exception:  # noqa: BLE001 - one failing stop never skips the later ones
        log.warning("shutdown step %s failed", name, exc_info=True)


COMMIT_THREADS = 4  # CommitBeforeSend: worker threads of its own for the early commit (never the shared 40-thread pool)


class CorrelationId:
    """ASGI middleware (CR-MAIN-RUNTIME-2438, review 05:P3-02; was an @app.middleware("http") BaseHTTPMiddleware): the
    request's correlation id into the request state, and the X-Correlation-Id header onto the response. Pure ASGI like the
    other middlewares - no extra task per request, and a streamed body passes straight through.
    SX-17: a client id is used only when it is one well-formed value (8-64 of [A-Za-z0-9_-]); never reflected otherwise."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        from starlette.datastructures import Headers, MutableHeaders

        cid = correlation_id.resolve(Headers(scope=scope).getlist(correlation_id.HEADER))
        scope.setdefault("state", {})["correlation_id"] = cid  # request.state.correlation_id

        from .services import step_up

        # MFA-STEPUP-GATES-2490: the step-up gate finds the request also from a connection the handler opened itself; the request
        # context closes when the response starts (a background task after the answer is never gated)
        su_token, su_holder = step_up.enter_request(scope)

        async def send_with_id(message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)["X-Correlation-Id"] = cid
                step_up.close_request(su_holder)
            await send(message)

        token = correlation_id.CURRENT.set(cid)  # T033: the log ring stamps this request's log lines with its id
        try:
            await self.app(scope, receive, send_with_id)
        finally:
            correlation_id.CURRENT.reset(token)
            step_up.leave_request(su_token)


class CommitBeforeSend:
    """ASGI middleware: when a response starts, the request's SQLite connections (auth.get_conn / get_read_conn, kept in
    the request state) are committed first (auth.release_request), so the body is sent without the transaction. FastAPI
    closes a dependency with yield only after the whole response went out, so a download (an export, a bundle, a backup)
    or a slow client over Ingress otherwise held SQLite's single write lock for the whole transfer - one of the holders
    behind the round-10 "database is locked" storm. A handler that raised is unchanged: its dependency has already
    committed (expected API errors, with their audit rows) or rolled back before the error response starts.

    CR-MAIN-RUNTIME-2438 (review 05:P1-01): the commit runs on a thread limiter of its own (COMMIT_THREADS). On the shared
    default pool (40 threads, handed out in arrival order) it queued behind the requests parked in pool threads waiting for
    the very gate this commit frees, so with 40 waiting writers it waited until one of them timed out - a burst of
    "database is locked" with no slow holder. Same function, same thread kind, same order; only the queue it waits in."""

    def __init__(self, app) -> None:
        self.app = app
        self._limiter: tuple[object, object] | None = None  # (event loop, its CapacityLimiter)

    def _commit_limiter(self):
        import anyio

        loop = asyncio.get_running_loop()
        if self._limiter is None or self._limiter[0] is not loop:  # one per event loop (a test client runs its own loop)
            self._limiter = (loop, anyio.CapacityLimiter(COMMIT_THREADS))
        return self._limiter[1]

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        import anyio.to_thread

        from .auth import release_conns

        scope.setdefault("state", {})  # the request state (and its sw_conns) is shared through this dict

        async def send_after_commit(message) -> None:
            if message["type"] == "http.response.start":
                conns = (scope.get("state") or {}).get("sw_conns")
                if conns:
                    await anyio.to_thread.run_sync(release_conns, conns, limiter=self._commit_limiter())
            await send(message)

        await self.app(scope, receive, send_after_commit)


def commit_before_send(app: FastAPI) -> None:
    app.add_middleware(CommitBeforeSend)
