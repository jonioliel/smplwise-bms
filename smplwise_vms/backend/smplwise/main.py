"""FastAPI application: /api/v1 routers, error model, correlation ids, and the built UI served for
Ingress (relative asset URLs, hash routing)."""
from __future__ import annotations

import asyncio
import logging
import os
import mimetypes
import threading
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
from . import recorder_scope
from .routers import access, access_control, access_groups, alarm, anchors, automations, backup, cameras, cases, catalog, device_cameras, device_layouts, devices, energy_billing, events, exports, floor_images as floor_images_router, frames, ha, health, me, media, multimedia, notifications, nvr_connection, nvr_settings as nvr_settings_router, nvr_write, plan_area_links as plan_area_links_router, plan_catalog, plan_geometry, plans, playback, playback_groups, push, recordings, rules, schedules, search, settings as settings_router, setup, skins, storage, system_update, views, wall as wall_router, zones

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
    from .services import ha_user_auth

    ha_user_auth.flush_refusal_summaries(db)  # counted-but-quiet throttled refusals: the end-of-window summary rows
    ha_history.prune_db(db)
    from .services import device_activity

    device_activity.prune_db(db)  # DEVHIST: retention + size caps (itself throttled to every 15 min)
    from .services import push as push_svc

    push_svc.prune(db)  # CR-008 P3: push subscriptions whose browser has not synced for months
    try:  # CR-014: expired schedule trash, runs past their retention, settled ops, due derived runs (no Home Assistant call)
        from .services import schedules as schedules_svc

        schedules_svc.janitor(db, s)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("schedules janitor failed", exc_info=True)
    try:  # CR-017: expired automation trash, runs and ops past their retention (no Home Assistant call)
        from .services import automations as automations_svc

        automations_svc.janitor(db, s)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("automations janitor failed", exc_info=True)
    try:  # CR-015: media devices deleted for 30 days, their layout keys, old command rows (no Home Assistant call)
        from .services import media_store

        media_store.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("media janitor failed", exc_info=True)
    try:  # CR-023 P2: automatic electricity bills at the end of each period (throttled to every 5 minutes; idempotent)
        from .services import energy_billing

        energy_billing.janitor(db, settings)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("energy billing janitor failed", exc_info=True)
    try:  # a standalone HA camera shown live: drop the opt-in of a camera that is gone, delete go2rtc streams nobody wants (throttled)
        from .services import ha_camera_streams

        ha_camera_streams.reconcile(db, settings)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("ha live reconcile failed", exc_info=True)
    try:  # CR-023: electricity retention (hourly inside; energy.db only, its own gate)
        from .services import energy_sampler

        energy_sampler.janitor(db, settings)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("energy janitor failed", exc_info=True)
    try:  # CR-031: generator history and closed alerts past their retention (hourly inside; no Home Assistant call)
        from .services import generator_runtime

        generator_runtime.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("generator janitor failed", exc_info=True)
    try:  # CR-021 S3 review: update / platform-restart runs past their ceiling are settled on a schedule, not only when someone asks
        from .services import update_runs

        update_runs.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("update runs janitor failed", exc_info=True)
    try:  # CR-028: casts past their time end (one stop, the restore rule), casts whose screen vanished end, "not confirmed" after 15 s
        from .services import cast_sessions

        cast_sessions.janitor(db, settings)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("cast janitor failed", exc_info=True)
    try:  # CR-027: the phone app's presence event log past its retention, expired app push messages, revoked device rows
        from .services import presence as presence_svc

        presence_svc.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("presence janitor failed", exc_info=True)
    from .services import storage

    if not is_ha_only(settings):  # NVR-less mode: no NVR storage report to keep warm, no NVR recording to stop
        storage.warm(db, settings)  # non-blocking; keeps the storage report warm between opens
        from .services import nvr_write

        nvr_write.stop_expired_manual(db, settings)  # A1: manual recordings past their planned stop
        try:  # CR-020 S2: stream changes left pending (crash, busy database, unknown device answer) - settled by a read, never a write
            from .services import nvr_settings

            nvr_settings.settle_pending(db, settings)
        except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
            log.warning("nvr stream janitor failed", exc_info=True)
        try:  # CR-020 S2C: a multi-camera batch whose runner is gone (stale heartbeat) ends `interrupted` - never resumed
            from .services import nvr_batch

            nvr_batch.recover_batches(db, settings)
        except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
            log.warning("nvr batch recovery failed", exc_info=True)
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
    from .services import energy_billing_adapter

    energy_billing_adapter.configure(settings)  # CR-023: the readings store answers the billing branch's provider seam
    from . import db as db_mod

    # the add-on option db_write_gate (default on); SW_DB_WRITE_GATE=0 always wins
    db_mod.WRITE_GATE = settings.db_write_gate and os.environ.get("SW_DB_WRITE_GATE", "1") != "0"
    if not db_mod.WRITE_GATE:
        log.warning("database write gate is OFF (db_write_gate / SW_DB_WRITE_GATE=0): writers rely on SQLite's busy handler alone")
    from .services import backup as backup_svc

    pre = backup_svc.pre_upgrade(settings)  # rollback safety: a copy of the data before a new version touches it
    if pre:
        log.info("pre-upgrade backup written: %s", pre.name)
    from .services import update_runs  # CR-021 S3 review: a start of an update's target version counts even if a migration crashes next

    update_runs.early_boot(app.state.db)
    applied = app.state.db.migrate()
    if applied:
        log.info("applied migrations %s", applied)
    try:  # review M2: objects of 0036 (alarm) and 0037 (user_prefs) exist whatever schema_migrations recorded
        guarded = app.state.db.ensure_migration_objects()
        if guarded:
            log.warning("schema guard created objects missing despite the recorded migrations: %s", guarded)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("could not check the alarm / user_prefs schema")
    try:  # CR-009 re-review: a dev database that ran an earlier shape of the shared-spaces migration gets what it lacks
        from .services import shared_spaces as shared_spaces_svc

        with app.state.db.connection(label="shared_spaces.ensure_schema") as conn:
            fixed = shared_spaces_svc.ensure_schema(conn)
        if fixed:
            log.warning("shared spaces schema completed: %s", fixed)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("could not check the shared spaces schema")
    backup_svc.record_version(app.state.db)
    update_runs.on_startup(app.state.db, settings)  # CR-021 S3: settle the open update run / resume a platform restart run (never raises)
    try:  # CR-018: the per-source notification policies are created from the catalogue the first time (an administrator's edit is never overwritten)
        from .services import notify_policy

        with app.state.db.connection(label="notify_policy.ensure_defaults") as conn:
            notify_policy.ensure_defaults(conn)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("could not create the notification policies")
    try:  # CR-007 slice 3 review: a bulk device action cut off by the previous process gets its outcome now
        from .services import device_bulk

        swept = device_bulk.sweep_unfinished(app.state.db)
        if swept:
            log.warning("settled %s bulk device action(s) left unfinished by the previous process", swept)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("could not settle unfinished bulk device actions")
    try:  # CR-019: switch protection on the mirror the previous process left (renames, gone, switches not judged yet)
        from .services import switch_protection

        with app.state.db.connection(label="switch_protection.startup") as conn:
            switch_protection.reconcile(conn, switch_protection.present_from_mirror(conn))
    except Exception:  # noqa: BLE001 - never block the start; an unjudged switch stays out of group actions (fail-safe)
        log.exception("could not reconcile the switch protection")
    try:  # 0.1.74: HA Hikvision-integration events get their camera (one cheap pass; new events get it on insert)
        from .services.correlation import backfill_ha_event_cameras

        with app.state.db.connection() as _c:
            fixed = backfill_ha_event_cameras(_c)
        if fixed:
            log.info("attached %s Home Assistant NVR events to their cameras", fixed)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("HA event camera backfill failed")
    # CR-022: the NVR connection stored in Arx (recorder_connections), overlaid ONCE here - after the migrations, before any
    # background worker - and the one-time import of the add-on options. Every later reader sees the effective settings; a
    # save or a removal waits for the next start (connection_pending_restart).
    from .services import connection_probe, connection_store

    settings, legacy_differ = connection_store.apply_at_startup(app.state.db, settings)
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
    app.include_router(device_cameras.router, prefix=api, tags=["devices"])
    app.include_router(multimedia.router, prefix=api, tags=["multimedia"])  # CR-015: מולטימדיה - מסכים ושלט (/api/v1/multimedia; /api/v1/media is the camera video router)
    app.include_router(schedules.router, prefix=api, tags=["schedules"])  # CR-014: תזמונים
    app.include_router(automations.router, prefix=api, tags=["automations"])  # CR-017: אוטומציות · סצנות · סקריפטים
    app.include_router(alarm.router, prefix=api, tags=["alarm"])  # CR-010: אבטחה › אזעקה
    app.include_router(zones.router, prefix=api, tags=["zones"])
    app.include_router(skins.router, prefix=api, tags=["plans"])
    app.include_router(plan_area_links_router.router, prefix=api, tags=["zones"])  # K88: room <-> area links (table, suggestions, bulk apply)
    app.include_router(floor_images_router.router, prefix=api, tags=["plans"])  # K88: own floor images (off / on) and their alignment
    app.include_router(search.router, prefix=api, tags=["search"])
    app.include_router(backup.router, prefix=api, tags=["backup"])
    app.include_router(system_update.router, prefix=api, tags=["system-update"])  # CR-021 S1: self-update check and settings (system.update)
    app.include_router(frames.router, prefix=api, tags=["recordings"])
    app.include_router(cases.router, prefix=api, tags=["cases"])
    app.include_router(storage.router, prefix=api, tags=["storage"])
    app.include_router(rules.router, prefix=api, tags=["rules"])
    app.include_router(push.router, prefix=api, tags=["push"])
    app.include_router(energy_billing.router, prefix=api, tags=["energy"])  # CR-023 P2: electricity billing - customers, accounts, prices, bills
    from .routers import mobile_notifications as mobile_notifications_router

    app.include_router(mobile_notifications_router.router, prefix=api, tags=["notifications"])  # CR-027: the phone app's push registration and message fetch - BEFORE /notifications/{nid}
    app.include_router(notifications.router, prefix=api, tags=["notifications"])  # CR-018: התראות - the inbox, the push action endpoint, administration (notify.manage)
    from .routers import presence as presence_router

    app.include_router(presence_router.router, prefix=api, tags=["presence"])  # CR-027: the phone app - device registration, presence / sensor reports, the required-sensors policy
    app.include_router(health.router, prefix=api, tags=["ops"])
    app.include_router(setup.router, prefix=api, tags=["ops"])
    app.include_router(views.router, prefix=api, tags=["views"])
    app.include_router(wall_router.router, prefix=api, tags=["wall"])
    app.include_router(nvr_connection.router, prefix=api, tags=["nvr"])  # CR-022: vendors, the stored connection, its test, the restart that applies it
    from .routers import recorders as recorders_router

    app.include_router(recorders_router.router, prefix=api, tags=["nvr"])  # CR-024: recorders (multi-NVR) - list, add, edit, remove, connection, health
    from .routers import recorder_health as recorder_health_router

    app.include_router(recorder_health_router.router, prefix=api, tags=["nvr"])  # CR-026: recorder health cards and thresholds
    app.include_router(nvr_write.router, prefix=api, tags=["nvr"])
    app.include_router(nvr_settings_router.router, prefix=api, tags=["nvr"])  # CR-020 S1: read-only camera video settings
    from .routers import energy_meters as energy_meters_router

    from .routers import generator as generator_router

    app.include_router(generator_router.router, prefix=api, tags=["generator"])  # CR-031: גנרטור - devices, live values, history, alerts, routing (view and alerts only)
    app.include_router(energy_meters_router.router, prefix=api, tags=["energy"])  # CR-023 P1: מוני חשמל - meters, readings, consumption, settings
    from .routers import nvr_batch as nvr_batch_router

    app.include_router(nvr_batch_router.router, prefix=api, tags=["nvr"])  # CR-020 S2C: multi-camera stream batches (background runner)
    from .routers import remote as remote_router

    app.include_router(remote_router.router, prefix=api, tags=["remote"])  # CR-008: auth/session, the remote-access flag
    from .routers import cast as cast_router

    app.include_router(cast_router.router, prefix=api, tags=["multimedia"])  # CR-028: שדר למסך - cast sessions, targets, the cast administration
    from .services import cast_sessions as cast_svc

    cast_svc.attach(app.state.db, settings)  # the relay's callbacks and the live tokens of open casts (an add-on restart keeps them)

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
                return read_settings(conn)["time.zone"]

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
                    return (row["time_zone"] if row and row["time_zone"] else None) or read_settings(conn)["time.zone"]
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
        from .services import intercom_sync

        intercom_sync.SYNC.start(settings)  # CR-005: WisKey entry-center feed (read-only)
        from .services import energy_sampler

        energy_sampler.SAMPLER.start(app.state.db, settings)  # CR-023: one poll a minute of the meters from the state mirror (read-only)
        from .services import generator_runtime

        generator_runtime.RUNNER.start(app.state.db, settings)  # CR-031: generator detection, history samples and alerts from the state mirror (read-only)
        if os.environ.get("SW_BILL_PDF_SELFCHECK", "1") != "0":  # CR-023: log and expose which bill PDF engine really works here
            from .services import bill_pdf

            threading.Thread(target=bill_pdf.self_check, name="bill-pdf-selfcheck", daemon=True).start()
        from .services import bridge_install, thumbnails

        if not ha_only:
            thumbnails.WORKER.start_with(app.state.db, settings)
        from .services import backup as backup_svc

        app.state.backup_task = asyncio.create_task(backup_svc.daily_loop(app.state.db, settings))
        from .services import push as push_svc

        push_svc.NOTIFIER.start(app.state.db)  # CR-008 P3: Web Push for rule alerts (only to subscribed users in scope)
        from .services import notify_sources

        notify_sources.start(app.state.db, settings)  # CR-018 S2: the source monitors (health, faults, sensors) and the writer of queued signals
        if not ha_only:
            from .services import recorder_health

            recorder_health.POLLER.start(app.state.db, settings)  # CR-026: read-only health reads of every recorder (default once a minute)
        await run_in_threadpool(bridge_install.run_startup, app.state.db, settings)
        if settings.cast_relay:  # CR-028: the cast relay listens only when the add-on option is on (the host port mapping is the owner's)
            from .services import cast_relay

            cast_relay.SERVER.start(cast_relay.go2rtc_fetch(settings))

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
        from .services import nvr_batch

        nvr_batch.signal_shutdown()  # CR-020 S2C: first, so no batch starts another camera while the rest shuts down
        from .services import cast_relay

        cast_relay.SERVER.stop()  # CR-028: the cast relay's listener (a running cast's token survives in the database, not the socket)
        for name in ("janitor", "remote_revalidation"):
            task = getattr(app.state, name, None)
            if task:
                task.cancel()
        from .services import events_ingest
        from .services import exports as ex

        ex.WORKER.shutdown()
        events_ingest.LISTENER.shutdown()
        events_ingest.shutdown_extra()  # CR-024: the further recorders' alert streams
        from .services import thumbnails as th

        th.WORKER.stop_evt.set()
        from .services import ha_sync

        ha_sync.SYNC.shutdown()
        from .services import intercom_sync

        intercom_sync.SYNC.shutdown()
        from .services import energy_sampler

        energy_sampler.SAMPLER.shutdown()
        from .services import generator_runtime

        generator_runtime.RUNNER.shutdown()
        from .services import push as push_svc

        from starlette.concurrency import run_in_threadpool as _in_thread

        await _in_thread(push_svc.NOTIFIER.shutdown)  # queued alerts get a few seconds to go out
        from .services import notify_sources

        await _in_thread(notify_sources.shutdown)
        from .services import recorder_health

        await _in_thread(recorder_health.POLLER.shutdown)
        await _in_thread(nvr_batch.shutdown)  # CR-020 S2C: each runner ends after its current camera; the rest is not attempted
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
