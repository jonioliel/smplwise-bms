"""FastAPI application: /api/v1 routers, error model, correlation ids, and the built UI served for
Ingress (relative asset URLs, hash routing)."""
from __future__ import annotations

import asyncio
import logging
import os
import mimetypes
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import __version__
from .config import DEV_NVR_PLACEHOLDER, Settings, load_settings
from .db import Database
from .errors import ApiError, validation_payload
from .mode import is_ha_only
from .routers import access, access_control, access_groups, alarm, anchors, backup, cameras, cases, catalog, device_layouts, devices, events, exports, frames, ha, health, me, media, plan_catalog, plan_geometry, plans, playback, playback_groups, push, recordings, rules, search, settings as settings_router, setup, skins, storage, views, zones, nvr_write

log = logging.getLogger("smplwise")


def janitor_tick(db: Database, settings: Settings) -> None:
    """One housekeeping pass (every 30 s): idle playback sessions, orphan relay streams, empty playback groups,
    export retention, event / thumbnail / audit / HA-history pruning. A plain function so a test runs it end to
    end — from 0.1.30 to 0.1.37 the pass died silently on a missing import before the audit prune."""
    from . import audit as audit_mod
    from .routers.settings import read_settings
    from .services import events_derive, exports as ex, ha_history, playback as pb, playback_groups as pg, thumbnails

    with db.connection() as conn:
        s = read_settings(conn)
    pb.expire_idle(settings, s["playback.lease_s"])
    pb.sweep_orphans(settings)
    pg.expire_empty()
    ex.retention_sweep(db, settings, s["exports.retention_days"])
    events_derive.prune(db, s["events.retention_days"])
    thumbnails.prune(settings, s["events.retention_days"])
    audit_mod.prune_db(db, s["audit.retention_days"])
    ha_history.prune_db(db)
    from .services import push as push_svc

    push_svc.prune(db)  # CR-008 P3: push subscriptions whose browser has not synced for months
    from .services import storage

    if not is_ha_only(settings):  # NVR-less mode: no NVR storage report to keep warm, no NVR recording to stop
        storage.warm(db, settings)  # non-blocking; keeps the storage report warm between opens
        from .services import nvr_write

        nvr_write.stop_expired_manual(db, settings)  # A1: manual recordings past their planned stop
    db.checkpoint()  # PASSIVE; a TRUNCATE only when the WAL grew past its size limit and nobody writes or waits


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    # httpx/httpcore log full request URLs at INFO; ours may carry RTSP credentials (go2rtc sources) and
    # lab addresses. Keep them at WARNING regardless of the configured level.
    for noisy in ("httpx", "httpcore", "websockets"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.plans_dir.mkdir(parents=True, exist_ok=True)

    app = FastAPI(title="SmplWise Arx", version=__version__, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings = settings
    app.state.db = Database(settings.db_path)
    from . import db as db_mod

    # the add-on option db_write_gate (default on); SW_DB_WRITE_GATE=0 always wins
    db_mod.WRITE_GATE = settings.db_write_gate and os.environ.get("SW_DB_WRITE_GATE", "1") != "0"
    if not db_mod.WRITE_GATE:
        log.warning("database write gate is OFF (db_write_gate / SW_DB_WRITE_GATE=0): writers rely on SQLite's busy handler alone")
    from .services import backup as backup_svc

    pre = backup_svc.pre_upgrade(settings)  # rollback safety: a copy of the data before a new version touches it
    if pre:
        log.info("pre-upgrade backup written: %s", pre.name)
    applied = app.state.db.migrate()
    if applied:
        log.info("applied migrations %s", applied)
    backup_svc.record_version(app.state.db)
    try:  # CR-007 slice 3 review: a bulk device action cut off by the previous process gets its outcome now
        from .services import device_bulk

        swept = device_bulk.sweep_unfinished(app.state.db)
        if swept:
            log.warning("settled %s bulk device action(s) left unfinished by the previous process", swept)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("could not settle unfinished bulk device actions")
    try:  # 0.1.74: HA Hikvision-integration events get their camera (one cheap pass; new events get it on insert)
        from .services.correlation import backfill_ha_event_cameras

        with app.state.db.connection() as _c:
            fixed = backfill_ha_event_cameras(_c)
        if fixed:
            log.info("attached %s Home Assistant NVR events to their cameras", fixed)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("HA event camera backfill failed")
    if settings.nvr_host == DEV_NVR_PLACEHOLDER:
        log.info("installation mode: full with a placeholder NVR host (developer backend without NVR_HOST); "
                 "SW_MODE=ha_only starts the NVR-less mode")
    if is_ha_only(settings):
        log.info("installation mode: ha_only (no nvr_host in the add-on options) - NVR discovery, alert stream, "
                 "recording-derived events, exports and event thumbnails are off; set nvr_host and restart to add an NVR")
    if settings.dev_user:
        log.warning("developer identity mode is ON (SW_DEV_USER); never run like this inside Home Assistant")

    @app.middleware("http")
    async def correlation(request: Request, call_next):
        request.state.correlation_id = request.headers.get("x-correlation-id") or uuid.uuid4().hex[:12]
        response = await call_next(request)
        response.headers["X-Correlation-Id"] = request.state.correlation_id
        return response

    @app.exception_handler(ApiError)
    async def api_error(request: Request, exc: ApiError):
        return JSONResponse(status_code=exc.status, content=exc.payload(getattr(request.state, "correlation_id", "")))

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        code = {401: "unauthenticated", 403: "forbidden", 404: "not_found", 405: "method_not_allowed", 413: "payload_too_large"}.get(exc.status_code, "http_error")
        return JSONResponse(status_code=exc.status_code, content={"code": code, "user_message": str(exc.detail), "retryable": False,
                                                                  "correlation_id": getattr(request.state, "correlation_id", ""), "details": {}})

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        # the same envelope as every other error, so a screen can show why a save was refused
        return JSONResponse(status_code=422, content=validation_payload(list(exc.errors()), getattr(request.state, "correlation_id", "")))

    api = "/api/v1"
    app.include_router(me.router, prefix=api, tags=["identity"])
    app.include_router(catalog.router, prefix=api, tags=["catalog"])
    app.include_router(plans.router, prefix=api, tags=["plans"])
    app.include_router(plan_geometry.router, prefix=api, tags=["plans"])
    app.include_router(plan_catalog.router, prefix=api, tags=["catalog"])
    app.include_router(anchors.router, prefix=api, tags=["anchors"])
    app.include_router(cameras.router, prefix=api, tags=["cameras"])
    app.include_router(settings_router.router, prefix=api, tags=["settings"])
    app.include_router(media.router, prefix=api, tags=["media"])
    app.include_router(recordings.router, prefix=api, tags=["recordings"])
    app.include_router(playback.router, prefix=api, tags=["playback"])
    app.include_router(playback_groups.router, prefix=api, tags=["playback"])
    app.include_router(exports.router, prefix=api, tags=["exports"])
    app.include_router(events.router, prefix=api, tags=["events"])
    app.include_router(ha.router, prefix=api, tags=["home-assistant"])
    if settings.dev_user and not settings.in_addon:
        # developer identity mode only: truly absent otherwise, not merely a 404 raised from inside the handler
        app.include_router(ha.dev_router, prefix=api, tags=["home-assistant"])
    app.include_router(access.router, prefix=api, tags=["access"])
    app.include_router(access_groups.router, prefix=api, tags=["access"])
    app.include_router(access_control.router, prefix=api, tags=["access-control"])
    app.include_router(devices.router, prefix=api, tags=["devices"])
    app.include_router(device_layouts.router, prefix=api, tags=["devices"])
    app.include_router(alarm.router, prefix=api, tags=["alarm"])  # CR-010: אבטחה › אזעקה
    app.include_router(zones.router, prefix=api, tags=["zones"])
    app.include_router(skins.router, prefix=api, tags=["plans"])
    app.include_router(search.router, prefix=api, tags=["search"])
    app.include_router(backup.router, prefix=api, tags=["backup"])
    app.include_router(frames.router, prefix=api, tags=["recordings"])
    app.include_router(cases.router, prefix=api, tags=["cases"])
    app.include_router(storage.router, prefix=api, tags=["storage"])
    app.include_router(rules.router, prefix=api, tags=["rules"])
    app.include_router(push.router, prefix=api, tags=["push"])
    app.include_router(health.router, prefix=api, tags=["ops"])
    app.include_router(setup.router, prefix=api, tags=["ops"])
    app.include_router(views.router, prefix=api, tags=["views"])
    app.include_router(nvr_write.router, prefix=api, tags=["nvr"])
    from .routers import remote as remote_router

    app.include_router(remote_router.router, prefix=api, tags=["remote"])  # CR-008: auth/session, the remote-access flag

    @app.on_event("startup")
    async def _start_janitor() -> None:
        # Sessions never survive a restart: remove our leftover playback streams, then expire idle
        # sessions every 30 s. Only `smplwise_pb_*` names are ever deleted.
        from starlette.concurrency import run_in_threadpool

        from .services import exports as ex
        from .services import playback as pb
        from .services import playback_groups as pg
        from .routers.settings import read_settings

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
        if settings.go2rtc_url:
            await run_in_threadpool(pb.sweep_orphans, settings)
        ha_only = is_ha_only(settings)  # NVR-less mode: none of the NVR background work starts (mode.py)
        if not ha_only:
            ex.WORKER.start(app.state.db, settings)
        from .services import autosync, events_derive, events_ingest

        def _tz() -> str:
            with app.state.db.connection(mode="read") as conn:  # never takes the write lock
                return read_settings(conn)["time.zone"]

        async def discover(reason: str) -> None:
            await run_in_threadpool(autosync.run_once, app.state.db, settings, reason)
            autosync.PERIODIC.mark()
            # recording-derived events for today follow every discovery (same NVR search cache)
            await run_in_threadpool(events_derive.run_once, app.state.db, settings, _tz())
            if reason == "startup":
                from .services import storage

                storage.warm(app.state.db, settings, force=True)

        if not ha_only:
            app.state.discovery = asyncio.create_task(discover("startup"))
            events_ingest.LISTENER.start(app.state.db, settings, _tz)
        from .services import ha_sync

        ha_sync.SYNC.start(app.state.db, settings)
        from .services import intercom_sync

        intercom_sync.SYNC.start(settings)  # CR-005: WisKey entry-center feed (read-only)
        from .services import bridge_install, thumbnails

        if not ha_only:
            thumbnails.WORKER.start_with(app.state.db, settings)
        from .services import backup as backup_svc

        app.state.backup_task = asyncio.create_task(backup_svc.daily_loop(app.state.db, settings))
        from .services import push as push_svc

        push_svc.NOTIFIER.start(app.state.db)  # CR-008 P3: Web Push for rule alerts (only to subscribed users in scope)
        await run_in_threadpool(bridge_install.run_startup, app.state.db, settings)

        async def loop() -> None:
            while True:
                await asyncio.sleep(30)
                try:
                    await run_in_threadpool(janitor_tick, app.state.db, settings)
                    if not ha_only and autosync.PERIODIC.due():
                        await discover("periodic")
                except Exception as exc:  # never let the janitor die
                    log.warning("janitor tick failed: %s", type(exc).__name__, exc_info=True)

        app.state.janitor = asyncio.create_task(loop())
        if settings.remote_access:  # CR-008: re-validate remote sessions against HA (revocation within 60 s)
            from .services import ha_user_auth

            log.info("remote access (SmplWise Arx) is ON at %s/", settings.remote_path)
            app.state.remote_revalidation = asyncio.create_task(ha_user_auth.revalidate_loop(app.state.db, settings))

    @app.on_event("shutdown")
    async def _stop_janitor() -> None:
        for name in ("janitor", "remote_revalidation"):
            task = getattr(app.state, name, None)
            if task:
                task.cancel()
        from .services import events_ingest
        from .services import exports as ex

        ex.WORKER.shutdown()
        events_ingest.LISTENER.shutdown()
        from .services import thumbnails as th

        th.WORKER.stop_evt.set()
        from .services import ha_sync

        ha_sync.SYNC.shutdown()
        from .services import intercom_sync

        intercom_sync.SYNC.shutdown()
        from .services import push as push_svc

        from starlette.concurrency import run_in_threadpool as _in_thread

        await _in_thread(push_svc.NOTIFIER.shutdown)  # queued alerts get a few seconds to go out
        from .routers import plan_geometry as plan_geometry_router

        plan_geometry_router.shutdown_detect_pool()

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


class CommitBeforeSend:
    """ASGI middleware: when a response starts, the request's SQLite connections (auth.get_conn / get_read_conn, kept in
    the request state) are committed first (auth.release_request), so the body is sent without the transaction. FastAPI
    closes a dependency with yield only after the whole response went out, so a download (an export, a bundle, a backup)
    or a slow client over Ingress otherwise held SQLite's single write lock for the whole transfer - one of the holders
    behind the round-10 "database is locked" storm. A handler that raised is unchanged: its dependency has already
    committed (expected API errors, with their audit rows) or rolled back before the error response starts."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        from starlette.concurrency import run_in_threadpool

        from .auth import release_conns

        scope.setdefault("state", {})  # the request state (and its sw_conns) is shared through this dict

        async def send_after_commit(message) -> None:
            if message["type"] == "http.response.start":
                conns = (scope.get("state") or {}).get("sw_conns")
                if conns:
                    await run_in_threadpool(release_conns, conns)
            await send(message)

        await self.app(scope, receive, send_after_commit)


def commit_before_send(app: FastAPI) -> None:
    app.add_middleware(CommitBeforeSend)
