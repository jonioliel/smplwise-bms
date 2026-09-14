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
from .routers import anchors, cameras, catalog, health, me, media, plans, playback, recordings, settings as settings_router

log = logging.getLogger("smplwise")


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
    applied = app.state.db.migrate()
    if applied:
        log.info("applied migrations %s", applied)
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
    app.include_router(health.router, prefix=api, tags=["ops"])

    @app.on_event("startup")
    async def _start_janitor() -> None:
        # Sessions never survive a restart: remove our leftover playback streams, then expire idle
        # sessions every 30 s. Only `smplwise_pb_*` names are ever deleted.
        from starlette.concurrency import run_in_threadpool

        from .services import playback as pb
        from .routers.settings import read_settings

        if settings.go2rtc_url:
            await run_in_threadpool(pb.sweep_orphans, settings)

        async def loop() -> None:
            while True:
                await asyncio.sleep(30)
                try:
                    def _tick() -> None:
                        with app.state.db.connection() as conn:
                            lease = read_settings(conn)["playback.lease_s"]
                        pb.expire_idle(settings, lease)
                        pb.sweep_orphans(settings)

                    await run_in_threadpool(_tick)
                except Exception as exc:  # never let the janitor die
                    log.warning("janitor tick failed: %s", type(exc).__name__)

        app.state.janitor = asyncio.create_task(loop())

    @app.on_event("shutdown")
    async def _stop_janitor() -> None:
        task = getattr(app.state, "janitor", None)
        if task:
            task.cancel()

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
