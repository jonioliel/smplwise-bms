"""FastAPI application: /api/v1 routers, error model, correlation ids, and the built UI served for
Ingress (relative asset URLs, hash routing)."""
from __future__ import annotations

import asyncio
import logging
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import __version__
from .config import Settings, load_settings
from .db import Database
from .errors import ApiError
from .routers import access, anchors, backup, cameras, cases, catalog, events, exports, frames, ha, health, me, media, plans, playback, playback_groups, recordings, rules, search, settings as settings_router, storage, zones

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
    audit_mod.prune_db(db)
    ha_history.prune_db(db)
    from .services import storage

    storage.warm(db, settings)  # non-blocking; keeps the storage report warm between opens


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    # httpx/httpcore log full request URLs at INFO; ours may carry RTSP credentials (go2rtc sources) and
    # lab addresses. Keep them at WARNING regardless of the configured level.
    for noisy in ("httpx", "httpcore", "websockets"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.plans_dir.mkdir(parents=True, exist_ok=True)

    app = FastAPI(title="SMPLWISE VMS", version=__version__, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings = settings
    app.state.db = Database(settings.db_path)
    from .services import backup as backup_svc

    pre = backup_svc.pre_upgrade(settings)  # rollback safety: a copy of the data before a new version touches it
    if pre:
        log.info("pre-upgrade backup written: %s", pre.name)
    applied = app.state.db.migrate()
    if applied:
        log.info("applied migrations %s", applied)
    backup_svc.record_version(app.state.db)
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

    api = "/api/v1"
    app.include_router(me.router, prefix=api, tags=["identity"])
    app.include_router(catalog.router, prefix=api, tags=["catalog"])
    app.include_router(plans.router, prefix=api, tags=["plans"])
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
    app.include_router(access.router, prefix=api, tags=["access"])
    app.include_router(zones.router, prefix=api, tags=["zones"])
    app.include_router(search.router, prefix=api, tags=["search"])
    app.include_router(backup.router, prefix=api, tags=["backup"])
    app.include_router(frames.router, prefix=api, tags=["recordings"])
    app.include_router(cases.router, prefix=api, tags=["cases"])
    app.include_router(storage.router, prefix=api, tags=["storage"])
    app.include_router(rules.router, prefix=api, tags=["rules"])
    app.include_router(health.router, prefix=api, tags=["ops"])

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
        ex.WORKER.start(app.state.db, settings)
        from .services import autosync, events_derive, events_ingest

        def _tz() -> str:
            with app.state.db.connection() as conn:
                return read_settings(conn)["time.zone"]

        async def discover(reason: str) -> None:
            await run_in_threadpool(autosync.run_once, app.state.db, settings, reason)
            autosync.PERIODIC.mark()
            # recording-derived events for today follow every discovery (same NVR search cache)
            await run_in_threadpool(events_derive.run_once, app.state.db, settings, _tz())
            if reason == "startup":
                from .services import storage

                storage.warm(app.state.db, settings, force=True)

        app.state.discovery = asyncio.create_task(discover("startup"))
        events_ingest.LISTENER.start(app.state.db, settings, _tz)
        from .services import ha_sync

        ha_sync.SYNC.start(app.state.db, settings)
        from .services import bridge_install, thumbnails

        thumbnails.WORKER.start_with(app.state.db, settings)
        from .services import backup as backup_svc

        app.state.backup_task = asyncio.create_task(backup_svc.daily_loop(app.state.db, settings))
        await run_in_threadpool(bridge_install.run_startup, app.state.db, settings)

        async def loop() -> None:
            while True:
                await asyncio.sleep(30)
                try:
                    await run_in_threadpool(janitor_tick, app.state.db, settings)
                    if autosync.PERIODIC.due():
                        await discover("periodic")
                except Exception as exc:  # never let the janitor die
                    log.warning("janitor tick failed: %s", type(exc).__name__, exc_info=True)

        app.state.janitor = asyncio.create_task(loop())

    @app.on_event("shutdown")
    async def _stop_janitor() -> None:
        task = getattr(app.state, "janitor", None)
        if task:
            task.cancel()
        from .services import events_ingest
        from .services import exports as ex

        ex.WORKER.stop = True
        events_ingest.LISTENER.shutdown()
        from .services import thumbnails as th

        th.WORKER.stop_evt.set()
        from .services import ha_sync

        ha_sync.SYNC.shutdown()

    @app.get("/healthz", include_in_schema=False)
    async def healthz():
        # Supervisor watchdog target: no identity, no details.
        return {"status": "ok"}

    www = settings.www_dir
    if www and Path(www).is_dir():
        index = Path(www) / "index.html"

        @app.get("/", include_in_schema=False)
        async def root():
            return FileResponse(index, headers={"Cache-Control": "no-cache"})

        app.mount("/", StaticFiles(directory=str(www), html=True), name="www")
    else:
        log.warning("no built UI found (SW_WWW_DIR=%s); API only", www)

    return app
