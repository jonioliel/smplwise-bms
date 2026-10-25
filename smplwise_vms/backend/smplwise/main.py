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
from .routers import access, access_control, access_groups, alarm, doors as doors_router, anchors, automations, backup, brand as brand_router, white_label as white_label_router, cameras, cases, catalog, device_cameras, device_layouts, devices, energy_billing, events, exports, floor_images as floor_images_router, frames, ha, health, me, media, multimedia, notifications, nvr_connection, nvr_settings as nvr_settings_router, nvr_write, plan_area_links as plan_area_links_router, plan_bakes as plan_bakes_router, plan_catalog, plan_geometry, plan_ifc as plan_ifc_router, plan_package as plan_package_router, plan_view as plan_view_router, plans, playback, playback_groups, push, recordings, rules, schedules, search, settings as settings_router, setup, skins, storage, system_update, ui_background, views, wall as wall_router, zones

log = logging.getLogger("smplwise")


def janitor_tick(db: Database, settings: Settings) -> None:
    """One housekeeping pass (every 30 s): idle playback sessions, orphan relay streams, empty playback groups,
    export retention, event / thumbnail / audit / HA-history pruning. A plain function so a test runs it end to
    end — from 0.1.30 to 0.1.37 the pass died silently on a missing import before the audit prune."""
    from . import audit as audit_mod
    from .routers.settings import read_settings
    from .services import demo_mode, events_derive, exports as ex, ha_history, playback as pb, playback_groups as pg, thumbnails

    if demo_mode.tick(db, settings):  # CR-READY96: a running demo ends here when its time is up; while one runs the real installation's housekeeping waits
        return
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
    try:  # CR-LIVEEVENT100: closed incidents past incidents.retention_days (an open incident is never pruned)
        from .services import incidents as incidents_svc

        incidents_svc.prune_db(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("incidents janitor failed", exc_info=True)
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
    try:  # MU2: announcement log rows older than 90 days
        from .services import announcements as announcements_svc

        with db.connection(label="announce.prune") as conn:
            announcements_svc.prune(conn)
    except Exception:  # noqa: BLE001
        log.warning("announcements janitor failed", exc_info=True)
    try:  # CR-023 P2: automatic electricity bills at the end of each period (throttled to every 5 minutes; idempotent)
        from .services import energy_billing

        energy_billing.janitor(db, settings)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("energy billing janitor failed", exc_info=True)
    try:  # CR-QUIET103: stamp quiet windows whose end instant has passed (the dispatch decides by the clock, not by this sweep; no device call)
        from .services import quiet_windows

        quiet_windows.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("quiet windows janitor failed", exc_info=True)
    try:  # NEEDSREVIEW (2.8.0): the yearly "needs review" reminder (January, once, throttled to an hourly check; never a door-system call)
        from .services import needs_review

        needs_review.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("needs-review janitor failed", exc_info=True)
    try:  # SECFIX2-295 / PUB-03: erase undecided vendor-typed technicians past access.external.pending_retention_days (default 90, owner 2026-10-21; a saved 0 = off)
        from .services import pending_retention

        pending_retention.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("pending retention janitor failed", exc_info=True)
    try:  # IDENT146: purge local accounts disabled / deleted for privacy.local_purge_days (default 30; the switch privacy.local_purge is off by default)
        from .services import local_privacy

        local_privacy.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("local privacy janitor failed", exc_info=True)
    try:  # ZONECOUNT107 / REL2140 M-2: people-count samples - all deleted while the switch is off, retention while on (read-gated)
        from .services import zone_counts

        zone_counts.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("zone count janitor failed", exc_info=True)
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
    try:  # CR-WATER78: water retention (hourly inside; water.db only, its own gate; nothing while the module is off)
        from .services import water_sampler

        water_sampler.janitor(db, settings)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("water janitor failed", exc_info=True)
    try:  # CR-WATER78 slice 2: the leak evaluator, once per closed 15-minute bucket (water.db read-only; nothing while the module is off; never a device action)
        from .services import water_runtime

        water_runtime.janitor(db, settings)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("water alerts evaluator failed", exc_info=True)
    try:  # CR-WATER78 slice 3: automatic water bills at the end of each period (every 5 min inside) and bill retention (the shared keys)
        from .services import water_billing

        water_billing.janitor(db, settings)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("water billing janitor failed", exc_info=True)
    try:  # CR-031: generator history and closed alerts past their retention (hourly inside; no Home Assistant call)
        from .services import generator_runtime

        generator_runtime.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("generator janitor failed", exc_info=True)
    try:  # CR-INSIGHT215 slice 3: the scheduled monthly building report (OFF until set up and enabled; self-throttled to once a minute)
        from .services import insights_delivery

        insights_delivery.janitor(db, settings)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("insights delivery janitor failed", exc_info=True)
    try:  # CR-INFRA-ELEVATORS 2.8.0: the elevators' state history past its retention (hourly inside; no Home Assistant call)
        from .services import elevators_runtime

        elevators_runtime.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("elevators janitor failed", exc_info=True)
    try:  # CR-INFRA-TEMPERATURE 2.9.1: the temperature history and alert log past their retention (hourly inside; no Home Assistant call)
        from .services import temperature_runtime

        temperature_runtime.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("temperature janitor failed", exc_info=True)
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
    try:  # PARTNERAPI113-295: token expiry / creator-gone notices, purge of ended tokens, the delivery log and old outbox rows
        from .services.partner import core as partner_core, webhooks as partner_webhooks

        with db.connection(label="partner.janitor") as conn:
            partner_core.janitor(conn)
            partner_webhooks.janitor(conn)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("partner janitor failed", exc_info=True)
    try:  # APPREFRESH-295: expired app access tokens, families that ran out, ended families past their audit keep
        from .services import app_refresh as app_refresh_svc

        app_refresh_svc.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("app refresh janitor failed", exc_info=True)
    try:  # SESSIONEXCH2-295: lapsed codes, web sessions past expiry or whose family ended (the sweep for a missed fan-out)
        from .services import app_session as app_session_svc

        app_session_svc.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("app session janitor failed", exc_info=True)
    try:  # TFA2: expired second-factor lockout rows
        from .services import second_factor as second_factor_svc

        second_factor_svc.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("second factor janitor failed", exc_info=True)
    try:  # SEC3 (review L4): the sign-in rate counters and expired block-counter rows
        from .services import ha_user_auth as hua_svc

        hua_svc.flush_limiter(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("rate limiter flush failed", exc_info=True)
    try:  # USR2: the local identities' tiers (written behind), expired pending second steps, old link and session rows
        from .services import local_identity as local_identity_svc

        local_identity_svc.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("local identity janitor failed", exc_info=True)
    try:  # USR2-P2B: self-service reset code rows an hour past expiry, send-counter rows past 24 h
        from .services import local_reset as local_reset_svc

        local_reset_svc.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("local reset janitor failed", exc_info=True)
    try:
        from .services import alarm_codes as alarm_codes_svc

        alarm_codes_svc.janitor(db)
    except Exception:  # noqa: BLE001
        log.warning("alarm code counter janitor failed", exc_info=True)
    try:  # CR-038: the tickets module's housekeeping (hourly inside; the request-idempotency rows after 24 h)
        from .services.tickets import retention as tickets_retention

        tickets_retention.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("tickets janitor failed", exc_info=True)
    try:  # CR-038 S4: the public listener's counters and switch, codes / sessions / redeem ids / access rows past retention, unused keys
        from .services.tickets.public_runtime import RUNTIME as tickets_public

        tickets_public.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others (W15)
        log.warning("tickets public janitor failed", exc_info=True)
    try:  # CR-038 S9: the claim window's end, pending invoice files after 24 h, claims past their own retention (every 10 min inside)
        from .services.tickets import costs_retention
        from .services.tickets.public_runtime import RUNTIME as tickets_runtime

        if tickets_runtime.data_dir is not None:
            costs_retention.janitor(db, tickets_runtime.attachments_root())
    except Exception:  # noqa: BLE001
        log.warning("tickets cost janitor failed", exc_info=True)
    try:  # CR-MAINT215: reminders before a due date / an expiry and requests on schedule (every 15 min inside; nothing while the module is off)
        from .services.maintenance import reminders as maintenance_reminders

        maintenance_reminders.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("maintenance janitor failed", exc_info=True)
    try:  # CR-EMERG104: the readiness history (a row only when the verdict or an item changed, or once a day); nothing while the module is off
        from .services.emergency import service as emergency_service

        emergency_service.janitor(db, settings)
    except Exception:  # noqa: BLE001
        log.warning("emergency readiness history failed", exc_info=True)
    try:  # CR-NOTICE106: archived / expired notices past `notices.retention_days` (soft delete, purge 30 days later) - hourly
        from .services.notices import store as notices_store

        notices_store.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("notices janitor failed", exc_info=True)
    try:  # CR-038 S5a: the shared WhatsApp send ledger keeps 2 days (hourly inside)
        from .services import messaging_runtime

        messaging_runtime.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("messaging ledger janitor failed", exc_info=True)
    try:  # WA-CONSENT-LINK: unanswered consent requests expire (held messages dropped, senders told), approved ones are released
        from .services import intercom_consent

        intercom_consent.tick(db, settings)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("intercom consent janitor failed", exc_info=True)
    try:  # WKR5-295: the WisKey people-write lineage keeps ENDED operations 30 days (open unknowns never purged); hourly inside; no-op uninstalled
        from .services import wiskey_direct_join

        wiskey_direct_join.janitor()
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("wiskey lineage janitor failed", exc_info=True)
    try:  # CR-038 S5b: the ticket outbox (90 days) and inbound (30 days) retention, hourly inside
        from .services.tickets.messaging import RUNTIME as tickets_messaging

        tickets_messaging.janitor(db)
    except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
        log.warning("tickets messaging janitor failed", exc_info=True)
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
    # CR-038 S4 (public-core review V10): Pillow's TIFF / EXIF reader logs tag VALUES at DEBUG (GPS, serial numbers of an
    # uploaded photo) - kept at INFO for the whole process whatever the add-on's log level
    logging.getLogger("PIL").setLevel(logging.INFO)
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.plans_dir.mkdir(parents=True, exist_ok=True)

    app = FastAPI(title="SmplWise Arx", version=__version__, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings = settings
    from .services import demo_mode as _demo_mode

    _demo_mode.clear_on_boot(settings)  # CR-READY96: a restart exits demo mode - the handle below always starts on the real file
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
    try:  # LAZYMIC-295: the remote channel's microphone policy follows this installation's settings from the first response
        from . import remote_channel as _rc

        with app.state.db.connection(mode="read", label="mic mode") as conn:
            _rc.load_mic_mode_from(conn)
    except Exception:  # noqa: BLE001 - never block the start; the default allows the microphone
        log.warning("could not read the microphone policy settings", exc_info=True)
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
    try:  # CR-021 S4: a release flagged `[platform-restart]` in its own notes adds the "restart required" reason once
        from .services import release_notes

        if os.environ.get("SW_RELEASE_MARKER", "1") != "0":  # tests switch the start-up read off (conftest)
            with app.state.db.connection(label="release_notes.note_release_restart") as conn:
                if release_notes.note_release_restart(conn):
                    log.info("this release asks for one platform restart (reason added)")
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("could not read the release's platform-restart marker")
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
    from .services import connection_probe, connection_store, secrets_store

    # TKSECRETS2: the in-app secrets store (go2rtc / WisKey / OpenAI / push relay secrets): the one-time move of legacy add-on
    # options into it, then its values overlaid - before the NVR overlay, so every recorder's settings inherit them
    settings = secrets_store.apply_at_startup(app.state.db, settings)
    from .services import wiskey_camera

    wiskey_camera.apply_at_startup(app.state.db, settings)  # TKWISECRYPT: seal any plaintext per-station WisKey camera password
    settings, legacy_differ = connection_store.apply_at_startup(app.state.db, settings)
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
    app.include_router(plan_package_router.router, prefix=api, tags=["plans"])
    app.include_router(plan_ifc_router.router, prefix=api, tags=["plans"])
    app.include_router(plan_view_router.router, prefix=api, tags=["plans"])  # CR-029 S0: a person's own realistic-3D look dials
    app.include_router(plan_catalog.router, prefix=api, tags=["catalog"])
    app.include_router(anchors.router, prefix=api, tags=["anchors"])
    app.include_router(cameras.router, prefix=api, tags=["cameras"])
    app.include_router(settings_router.router, prefix=api, tags=["settings"])
    app.include_router(ui_background.router, prefix=api, tags=["settings"])  # CRY: the background pictures behind the glass
    app.include_router(white_label_router.router, prefix=api, tags=["settings"])  # WHITELABEL097-295: the installer brand profile and the customer pack
    app.include_router(brand_router.router, prefix=api, tags=["settings"])  # LOGOS-295: the company logo, the logo size / dark-background choices, the tab title
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
    from .routers import access_control_reads  # CR-036 S4: the typed access-control reads (its own line: merges with CR-033 stay simple)

    app.include_router(access_control_reads.router, prefix=api, tags=["access-control"])
    from .routers import intercom_media as intercom_media_router  # CR-036 S18: station live video + talk (its own line)

    app.include_router(intercom_media_router.router, prefix=api, tags=["access-control"])
    from .routers import intercom_listen as intercom_listen_router  # WKAUDIN-295: listening to a station (its own line; off by default)
    app.include_router(intercom_listen_router.router, prefix=api, tags=["access-control"])
    from .routers import access_control_writes  # CR-036 S11: the person writes added to the editor's (its own line, like S4's)

    app.include_router(access_control_writes.router, prefix=api, tags=["access-control"])
    from .routers import wiskey_lineage as wiskey_lineage_router  # WKR5-295: the WisKey people-write lineage administration (its own line)

    app.include_router(wiskey_lineage_router.router, prefix=api, tags=["access-control"])
    from .routers import access_control_messaging  # CR-036 WA: WhatsApp from the people screen (its own file and its own line)

    app.include_router(access_control_messaging.router, prefix=api, tags=["access-control"])
    from .routers import bulk_people as bulk_people_router  # CR-BULKPEOPLE-295: bulk edit, CSV import / export of people (its own line)

    app.include_router(bulk_people_router.router, prefix=api, tags=["access-control"])
    app.include_router(doors_router.router, prefix=api, tags=["access-control"])  # CR-033: door map, station placement, door grants, trusted path
    from .routers import door_automations as door_automations_router  # CR-AUTODOORS-295: automations that open doors (its own line)

    app.include_router(door_automations_router.router, prefix=api, tags=["access-control"])
    from .routers import door_windows as door_windows_router

    app.include_router(door_windows_router.router, prefix=api, tags=["access-control"])  # CR-039 DOORWIN-295: door windows + emergency controls (OFF)
    from .routers import quiet as quiet_router

    app.include_router(quiet_router.router, prefix=api, tags=["notifications"])  # CR-QUIET103 slice 1: quiet windows per floor / area (OFF)
    from .routers import readiness as readiness_router

    app.include_router(readiness_router.router, prefix=api, tags=["ops"])  # CR-READY96 slice 1: installation readiness score (system.configure)
    from .routers import demo as demo_router

    app.include_router(demo_router.router, prefix=api, tags=["ops"])  # CR-READY96 slice 1: demo mode on a separate database (demo.run, sensitive, in no built-in role)
    from .routers import occupancy as occupancy_router

    app.include_router(occupancy_router.router, prefix=api, tags=["occupancy"])  # ZONECOUNT107-295: people count per area from Frigate reviews (OFF)
    from .routers import camera_suggest as camera_suggest_router

    app.include_router(camera_suggest_router.router, prefix=api, tags=["plan"])  # CAMSUGGEST138-295: nearest-camera suggestion settings + accepted zone camera
    from .routers import scenarios as scenarios_router

    app.include_router(scenarios_router.router, prefix=api, tags=["scenarios"])  # XSCENARIO109-295: cross-module scenarios (OFF; never a door or device action)
    app.include_router(devices.router, prefix=api, tags=["devices"])
    app.include_router(device_layouts.router, prefix=api, tags=["devices"])
    app.include_router(device_cameras.router, prefix=api, tags=["devices"])
    app.include_router(multimedia.router, prefix=api, tags=["multimedia"])  # CR-015: מולטימדיה - מסכים ושלט (/api/v1/multimedia; /api/v1/media is the camera video router)
    app.include_router(schedules.router, prefix=api, tags=["schedules"])  # CR-014: תזמונים
    app.include_router(automations.router, prefix=api, tags=["automations"])  # CR-017: אוטומציות · סצנות · סקריפטים
    from .routers import automation_blueprints as automation_blueprints_router  # CR-BLUEPRINT80: ready-made automation templates (its own line)

    app.include_router(automation_blueprints_router.router, prefix=api, tags=["automations"])
    from .routers import automation_ext as automation_ext_router  # KAV079-295: the editors' extension (wall buttons, pre-save checks, on-device test)

    app.include_router(automation_ext_router.router, prefix=api, tags=["automations"])
    app.include_router(alarm.router, prefix=api, tags=["alarm"])  # CR-010: אבטחה › אזעקה
    app.include_router(zones.router, prefix=api, tags=["zones"])
    app.include_router(skins.router, prefix=api, tags=["plans"])
    app.include_router(plan_area_links_router.router, prefix=api, tags=["zones"])  # K88: room <-> area links (table, suggestions, bulk apply)
    app.include_router(floor_images_router.router, prefix=api, tags=["plans"])  # K88: own floor images (off / on) and their alignment
    app.include_router(plan_bakes_router.router, prefix=api, tags=["plans"])  # CR-029 S3: stills, room masks and lightmaps rendered by an editor browser
    app.include_router(search.router, prefix=api, tags=["search"])
    from .routers import backup_offbox as backup_offbox_router

    app.include_router(backup_offbox_router.router, prefix=api, tags=["backup"])  # DATASTORE-295 phase 2: before /backups/{name}
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
    from .routers import notify_whatsapp as notify_whatsapp_router

    app.include_router(notify_whatsapp_router.router, prefix=api, tags=["notifications"])  # NOTIFWA: the WhatsApp channel - master switch, own-number test, own opt-out
    from .services import temperature_whatsapp as _temperature_whatsapp  # noqa: F401 - TEMPREG-295: joins the messaging use registry at startup (gated by the module state), not when a temperature route first runs
    from .services import insights_delivery as _insights_delivery  # noqa: F401 - CR-INSIGHT215: its WhatsApp use joins the account mapping at startup (shown only while the delivery is on)
    from .services import access_grants as _access_grants  # noqa: F401 - REGSTART-295: the "access" messaging use joins at import; import it at startup, not via whichever router or worker ran first
    from .services import local_reset as _local_reset  # noqa: F401 - REGSTART-295: the "identity" messaging use joins at import; it was imported only by the housekeeping step and the identity router

    from .routers import presence as presence_router

    app.include_router(presence_router.router, prefix=api, tags=["presence"])  # CR-027: the phone app - device registration, presence / sensor reports, the required-sensors policy
    from .routers import app_refresh as app_refresh_router

    app.include_router(app_refresh_router.router, prefix=api, tags=["identity"])  # APPREFRESH-295: the phone app's persistent sign-in (switch security.app_refresh, default off)
    from .routers import ha_users as ha_users_router

    app.include_router(ha_users_router.router, prefix=api, tags=["access"])  # USR1: home-system users created from Arx (users.ha_manage + an HA administrator)
    app.include_router(health.router, prefix=api, tags=["ops"])
    app.include_router(setup.router, prefix=api, tags=["ops"])
    app.include_router(views.router, prefix=api, tags=["views"])
    app.include_router(wall_router.router, prefix=api, tags=["wall"])
    app.include_router(nvr_connection.router, prefix=api, tags=["nvr"])  # CR-022: vendors, the stored connection, its test, the restart that applies it
    from .routers import app_secrets as app_secrets_router  # TKSECRETS2: the in-app secrets store (its own line)

    app.include_router(app_secrets_router.router, prefix=api, tags=["settings"])
    from .routers import recorders as recorders_router

    app.include_router(recorders_router.router, prefix=api, tags=["nvr"])  # CR-024: recorders (multi-NVR) - list, add, edit, remove, connection, health
    from .routers import frigate as frigate_router
    from .routers import recorder_health as recorder_health_router

    app.include_router(recorder_health_router.router, prefix=api, tags=["nvr"])  # CR-026: recorder health cards and thresholds
    from .routers import camera_image_health as camera_image_health_router

    app.include_router(camera_image_health_router.router, prefix=api, tags=["nvr"])  # CAMHEALTH091: camera image health (dark / blurred / frozen / shifted)
    app.include_router(frigate_router.router, prefix=api, tags=["frigate"])  # NN5 F1: the Frigate provider API (read-only toward Frigate)
    from .routers import frigate_control as frigate_control_router

    app.include_router(frigate_control_router.router, prefix=api, tags=["frigate"])  # NN5 F2: the only routes that write to Frigate (every write class is off until switched on)
    from .routers import frigate_f2b as frigate_f2b_router

    app.include_router(frigate_f2b_router.router, prefix=api, tags=["frigate"])  # NN5 F2b: auto profile on alarm change, native exports / cases, manual events (classes off by default)
    from .routers import frigate_config as frigate_config_router

    app.include_router(frigate_config_router.router, prefix=api, tags=["frigate"])  # FRGS: config schema, zones and camera settings (class `config`, off by default)
    app.include_router(nvr_write.router, prefix=api, tags=["nvr"])
    app.include_router(nvr_settings_router.router, prefix=api, tags=["nvr"])  # CR-020 S1: read-only camera video settings
    from .routers import nvr_privacy as nvr_privacy_router

    app.include_router(nvr_privacy_router.router, prefix=api, tags=["nvr"])  # NVRMASK-295: privacy-mask read / preview / guarded apply (off by default)
    from .routers import mask_copy as mask_copy_router

    app.include_router(mask_copy_router.router, prefix=api, tags=["nvr"])  # MASKCOPY62-295: privacy-mask copy PLAN only, no device write (off by default)
    from .routers import energy_meters as energy_meters_router

    from .routers import generator as generator_router

    from .routers import elevators as elevators_router

    from .routers import temperature as temperature_router

    app.include_router(temperature_router.router, prefix=api, tags=["infra"])  # CR-INFRA-TEMPERATURE 2.9.1: טמפרטורות - units, history, alert log, routing (read-only)
    app.include_router(elevators_router.router, prefix=api, tags=["infra"])  # CR-INFRA-ELEVATORS: מעליות - definitions, sensor mapping, derived live state (view only)
    app.include_router(generator_router.router, prefix=api, tags=["generator"])  # CR-031: גנרטור - devices, live values, history, alerts, routing (view and alerts only)
    app.include_router(energy_meters_router.router, prefix=api, tags=["energy"])  # CR-023 P1: מוני חשמל - meters, readings, consumption, settings
    from .routers import shift_summary as shift_summary_router  # CR-SHIFT114: the shift / 24-hour summary (read-only; OFF by default)

    app.include_router(shift_summary_router.router, prefix=api, tags=["reports"])
    from .routers import incidents as incidents_router

    app.include_router(incidents_router.router, prefix=api, tags=["events"])  # CR-LIVEEVENT100: אירוע חי - one page per incident (read-mostly; OFF by default)
    from .routers import water as water_router

    app.include_router(water_router.router, prefix=api, tags=["infra"])  # CR-WATER78 slice 1: מים - meters, readings, consumption, settings (module switch, default off)
    from .routers import insights as insights_router  # CR-INSIGHT215: insights and the monthly building report (its own line; every part OFF by default)

    app.include_router(insights_router.router, prefix=api, tags=["insights"])
    from .routers import water_billing as water_billing_router

    app.include_router(water_billing_router.router, prefix=api, tags=["infra"])  # CR-WATER78 slice 3: water accounts, tariffs, bills (shared billing settings)
    from .routers import nvr_batch as nvr_batch_router

    app.include_router(nvr_batch_router.router, prefix=api, tags=["nvr"])  # CR-020 S2C: multi-camera stream batches (background runner)
    from .routers import remote as remote_router

    from .routers import second_factor as second_factor_router

    app.include_router(second_factor_router.router, prefix=api, tags=["remote"])  # K11: the optional TOTP second factor (own enrolment, admin reset)
    from .routers import capture_lease as capture_lease_router

    app.include_router(capture_lease_router.router, prefix=api, tags=["access"])  # CR-WISKEY-LEASE-REVOCATION-EVENT 7.3: lease route switch (off), lease length, C03 lookup scope
    from .routers import bridge_key as bridge_key_router

    app.include_router(bridge_key_router.router, prefix=api, tags=["system"])  # CR-WISKEY-HMAC-ROTATION-295: bridge HMAC key rotation (off; go-live not permitted; fakes only)
    from .routers import partner as partner_router

    app.include_router(partner_router.router, prefix=api, tags=["system"])  # PARTNERAPI113-295: partner tokens and webhooks (off; go-live not permitted; fakes only)
    from .routers import access_grants as access_grants_router

    app.include_router(access_grants_router.router, prefix=api, tags=["access"])  # CR-ARX-WISKEY-SHARED-IDENTITY: external-person door grants (off; go-live not permitted)
    from .routers import wiskey_switches as wiskey_switches_router

    app.include_router(wiskey_switches_router.router, prefix=api, tags=["access"])  # SMALLFIXA-295 (review 3 G-01/G-03): the wiskey.acr5_* switch writer (system administrator)
    from .routers import fleet as fleet_router

    # CR-FLEET215: the signed daily fleet report (switch OFF; system administrator). Its readiness block comes from CR-READY96's
    # services/readiness.evaluate() (READYFLEET-295: one readiness, one screen); /readiness and /demo are CR-READY96's routers above.
    app.include_router(fleet_router.router, prefix=api, tags=["system"])
    from .routers import access_station_permissions as access_station_permissions_router

    app.include_router(access_station_permissions_router.router, prefix=api, tags=["access"])  # STATIONPERM-295: per-station access of a person (off; go-live not permitted)
    from .routers import compliance_export as compliance_export_router

    app.include_router(compliance_export_router.router, prefix=api, tags=["access"])  # COMPLY108-295: who could enter which door and when (read-only export; off)
    app.include_router(remote_router.router, prefix=api, tags=["remote"])  # CR-008: auth/session, the remote-access flag
    from .routers import local_identity as local_identity_router

    from .routers import local_privacy as local_privacy_router  # IDENT146: personal data export (off by default: privacy.personal_export)

    app.include_router(local_privacy_router.router, prefix=api, tags=["identity"])
    app.include_router(local_identity_router.router, prefix=api, tags=["identity"])  # USR2: Arx-only identities (off by default: security.local_identity)
    from .routers import service_identity as service_identity_router

    app.include_router(service_identity_router.router, prefix=api, tags=["identity"])  # USR2 P3: the service identity (local channel only; its off-only kill switch: either channel)
    from .routers import local_passkeys as local_passkeys_router

    app.include_router(local_passkeys_router.router, prefix=api, tags=["identity"])  # USR2 phase 4: passkeys of Arx-only identities
    # the Android app's Digital Asset Links statement for passkeys in its WebView (404 unless the feature is on and an app is named)
    app.add_api_route("/.well-known/assetlinks.json", local_passkeys_router.assetlinks, methods=["GET"], include_in_schema=False)
    from .routers import cast as cast_router

    app.include_router(cast_router.router, prefix=api, tags=["multimedia"])  # CR-028: שדר למסך - cast sessions, targets, the cast administration
    from .services import cast_sessions as cast_svc

    cast_svc.attach(app.state.db, settings)  # the relay's callbacks and the live tokens of open casts (an add-on restart keeps them)
    from .routers import announcements as announcements_router
    from .services import announcements as announcements_svc

    app.include_router(announcements_router.router, prefix=api, tags=["multimedia"])  # MU2: הכרזות קוליות - speak, setup, test, history
    from .services import announce_channel  # noqa: F401  (registers the `announce` notification channel)

    announcements_svc.attach(app.state.db, settings)  # a rule's announce action writes its log through this
    from .services import wa_policy as wa_policy_svc
    from .services.tickets import channel_whatsapp as _wa_channel

    _wa_channel.set_recipient_guard(wa_policy_svc.make_guard(app.state.db))  # WAPACE-295: the WhatsApp recipient allow-list, for every sender
    from .routers import tickets as tickets_router, tickets_admin as tickets_admin_router  # CR-038 S1: the optional tickets module (its own lines)

    app.include_router(tickets_router.open_router, prefix=api, tags=["tickets"])  # GET /tickets/module: the only route that answers while the module is off
    app.include_router(tickets_admin_router.router, prefix=api, tags=["tickets"])  # settings, name, departments - BEFORE /tickets/{ticket_id}
    from .routers import tickets_contacts as tickets_contacts_router, tickets_links as tickets_links_router  # CR-038 S4 (its own lines)

    app.include_router(tickets_contacts_router.router, prefix=api, tags=["tickets"])  # the contact / vendor directory - BEFORE /tickets/{ticket_id}
    from .routers import tickets_dept_handlers as tickets_dept_handlers_router  # CR-DEPT-MANAGER-HANDLERS (its own lines)

    app.include_router(tickets_dept_handlers_router.router, prefix=api, tags=["tickets"])  # department managers' handlers - BEFORE /tickets/{ticket_id}
    app.include_router(tickets_links_router.router, prefix=api, tags=["tickets"])  # handler links, health, address probe, key - BEFORE /tickets/{ticket_id}
    from .routers import tickets_table as tickets_table_router  # CR-038 S6b: the board table (table, export.csv, bulk, views)
    app.include_router(tickets_table_router.router, prefix=api, tags=["tickets"])  # CR-038 S6b - BEFORE /tickets/{ticket_id}
    from .routers import tickets_budgets as tickets_budgets_router, tickets_vendor_stats as tickets_vendor_stats_router, \
        tickets_visits as tickets_visits_router  # CR-SVC215 S1: budgets, the vendor card, vendor visits (their own lines)

    app.include_router(tickets_budgets_router.router, prefix=api, tags=["tickets"])  # /tickets/costs/budgets... BEFORE the cost routes
    app.include_router(tickets_vendor_stats_router.router, prefix=api, tags=["tickets"])  # /tickets/contacts/{id}/stats
    app.include_router(tickets_visits_router.router, prefix=api, tags=["tickets"])  # /tickets/{id}/visits... BEFORE /tickets/{ticket_id}
    from .routers import offline_field as offline_field_router  # OFFLINE110-295 S1: offline field work, server half (default OFF)

    app.include_router(offline_field_router.router, prefix=api, tags=["tickets"])
    from .routers import tickets_costs as tickets_costs_router  # CR-038 S9: cost claims (report, export, review, on-behalf, downloads)
    app.include_router(tickets_costs_router.router, prefix=api, tags=["tickets"])  # CR-038 S9 - BEFORE /tickets/{ticket_id}
    from .routers import tickets_detail as tickets_detail_router  # TKDETAILBE: owner, timeline, quotes, vendor messages, drafts

    app.include_router(tickets_detail_router.router, prefix=api, tags=["tickets"])  # BEFORE /tickets/{ticket_id}
    from .routers import tickets_rules as tickets_rules_router  # TKRULES-291: tickets opened from alerts (system.configure)

    app.include_router(tickets_rules_router.router, prefix=api, tags=["tickets"])  # BEFORE /tickets/{ticket_id}
    from .routers import tickets_intake as tickets_intake_router  # CR-INTAKE99: free-text request drafts (operator side only)

    app.include_router(tickets_intake_router.router, prefix=api, tags=["tickets"])  # BEFORE /tickets/{ticket_id}
    from .routers import tickets_map as tickets_map_router  # TKMAP1: the map element of a request

    app.include_router(tickets_map_router.router, prefix=api, tags=["tickets"])  # BEFORE /tickets/{ticket_id}
    from .routers import tickets_rfq as tickets_rfq_router  # TKRFQ1: requests for quotation (stage C1, the manager API)

    app.include_router(tickets_rfq_router.router, prefix=api, tags=["tickets"])  # /tickets/rfqs... BEFORE /tickets/{ticket_id}
    from .routers import tickets_messages as tickets_messages_router  # CR-038 S5b (its own lines)

    app.include_router(tickets_messages_router.router, prefix=api, tags=["tickets"])  # channel, outbox, inbound, message templates - BEFORE /tickets/{ticket_id}
    from .routers import tickets_board as tickets_board_router  # CR-038 S6: the manager board + the facet counts, BEFORE /tickets/{ticket_id}
    app.include_router(tickets_board_router.router, prefix=api, tags=["tickets"])
    app.include_router(tickets_router.router, prefix=api, tags=["tickets"])
    from .services.tickets.public_runtime import RUNTIME as tickets_public  # CR-038 S4: the module key and the public listener's wiring

    tickets_public.configure(settings, app.state.db)
    from .routers import maintenance as maintenance_router  # CR-MAINT215: the optional maintenance module (its own lines)

    app.include_router(maintenance_router.open_router, prefix=api, tags=["maintenance"])  # GET /maintenance/module: answers while the module is off
    app.include_router(maintenance_router.router, prefix=api, tags=["maintenance"])  # ledger, plans, rounds, supplier documents, tags (off by default)
    from .routers import emergency_readiness as emergency_router  # CR-EMERG104: the read-only emergency readiness view (off by default)

    app.include_router(emergency_router.open_router, prefix=api, tags=["emergency-readiness"])  # GET /emergency-readiness/module answers while the module is off
    app.include_router(emergency_router.router, prefix=api, tags=["emergency-readiness"])
    from .services import ha_bridge as ha_bridge_svc

    ha_bridge_svc.configure(settings.data_dir)  # HMACACT-295: the key set needs the data directory for a connection that does not know its database
    from .routers import messaging_accounts as messaging_accounts_router  # CR-038 S5a: WhatsApp accounts per use (installation-level, no module gate)

    app.include_router(messaging_accounts_router.router, prefix=api, tags=["messaging"])
    from .routers import notices as notices_router  # CR-NOTICE106: לוח הודעות - notices, TV boards (module OFF by default)

    app.include_router(notices_router.open_router, prefix=api, tags=["notices"])  # module state + settings: answer while the module is off
    app.include_router(notices_router.display_router, prefix=api, tags=["notices"])  # the TV feed: no login, X-Board-Token
    app.include_router(notices_router.router, prefix=api, tags=["notices"])
    app.include_router(notices_router.page_router)  # GET /b/{slug}: the static TV page (before the www mount)
    from .services.tickets.messaging import RUNTIME as tickets_messaging  # CR-038 S5b: the ticket message channel (outbox, inbound)

    tickets_messaging.configure(settings, app.state.db)

    @app.on_event("startup")
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
        from .services import wiskey_direct_join

        # WKINT-295: WisKey's direct API behind the people-write / capture / template ports - installed ONLY when the installation chose
        # `access.station_media_provider = auto` AND the pairing key signs (else nothing at all: no lineage, no transport, no thread);
        # one lineage per process, its scope recovered once the direct socket authenticates (in the background, never blocking start)
        _wkjoin = await run_in_threadpool(wiskey_direct_join.startup, app.state.db, settings)
        if _wkjoin is not None:
            threading.Thread(target=_wkjoin.recover_now, name="wiskey-join-recover", daemon=True).start()
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
        if not ha_only:
            from .services import recorder_health

            recorder_health.POLLER.start(app.state.db, settings)  # CR-026: read-only health reads of every recorder (default once a minute)
            from .services import camera_image_health

            camera_image_health.POLLER.start(app.state.db, settings)  # CAMHEALTH091: idle until switched on in Settings; samples the cache or existing sub streams only
        await run_in_threadpool(bridge_install.run_startup, app.state.db, settings)
        if settings.cast_relay:  # CR-028: the cast relay listens only when the add-on option is on (the host port mapping is the owner's)
            from .services import cast_relay

            cast_relay.SERVER.start(cast_relay.go2rtc_fetch(settings))
        if settings.notice_boards:  # CR-NOTICE106: the TV boards' LAN listener (container port 18094) - on the add-on option alone
            from .services.notices import display as notice_display
            from .services.notices import listener as notice_listener

            notice_listener.SERVER.start(
                notice_display.DisplayService(lambda: app.state.db.connection(mode="read", label="notices.display"), settings.data_dir,
                                              touch=notice_display.touch_seen(app.state.db)), settings.www_dir)
        if settings.tickets_public:  # CR-038 S4: the handler page's listener - on the add-on option alone; its own thread, loop and pool
            await run_in_threadpool(tickets_public.start, app.state.db, settings)  # start() waits up to 5 s: never on the main loop (W14)
        await run_in_threadpool(tickets_messaging.start)  # CR-038 S5b: the `tickets-outbox` worker (idle while the module is off)

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
        from .services.notices import listener as notice_listener

        notice_listener.SERVER.stop()  # CR-NOTICE106: the TV boards' LAN listener
        from starlette.concurrency import run_in_threadpool as _stop_in_thread

        await _stop_in_thread(tickets_public.stop, app.state.db)  # CR-038 S4: the handler page's listener (joins 5 s), then its counters
        await _stop_in_thread(tickets_messaging.stop)  # CR-038 S5b: the outbox worker (joins 5 s; a row in flight ends `unknown` at the next start)
        for name in ("janitor", "remote_revalidation", "backup_drill_task", "bridge_rotation_task", "fleet_report_task", "partner_webhooks_task"):
            task = getattr(app.state, name, None)
            if task:
                task.cancel()
        try:  # SEC3 (review L4): the last sign-in counters reach the database before the process ends
            from .services import ha_user_auth as hua_svc

            hua_svc.flush_limiter(app.state.db)
        except Exception:  # noqa: BLE001
            log.warning("rate limiter final flush failed", exc_info=True)
        from .services import events_ingest
        from .services import exports as ex

        ex.WORKER.shutdown()
        events_ingest.LISTENER.shutdown()
        events_ingest.shutdown_extra()  # CR-024: the further recorders' alert streams
        from .services import thumbnails as th

        th.WORKER.stop_evt.set()
        from .services import ha_sync

        ha_sync.SYNC.shutdown()
        from .services import lease_events

        # CR-WISKEY-LEASE-REVOCATION-EVENT T11: before the WisKey feed stops, any live capture lease is revoked (scope all) within 2 s
        await _stop_in_thread(lease_events.WORKER.on_shutdown)
        from .services import access_grants as access_grants_svc

        access_grants_svc.WORKER.stop()
        from .services import door_windows as door_windows_svc

        door_windows_svc.WORKER.stop()
        from .services import intercom_consent, intercom_sync

        intercom_consent.RELEASER.stop()  # WA-CONSENT-LINK: no new release starts; due rows stay due for the next start
        from .services import wiskey_direct_join as _wkj

        _wkj.shutdown()  # WKINT-295: the existing transports come back; the lineage closes (a no-op when nothing was installed)
        intercom_sync.SYNC.shutdown()
        intercom_sync.SYNC.journal = None  # R5-A6: nothing is sent after shutdown; unresolved rows stay for the next process
        from .services import energy_sampler

        energy_sampler.SAMPLER.shutdown()
        from .services import water_sampler as _wsm

        _wsm.SAMPLER.shutdown()
        from .services import generator_runtime

        generator_runtime.RUNNER.shutdown()
        from .services import elevators_runtime as _elr

        _elr.RUNNER.shutdown()
        from .services import temperature_runtime as _tmr

        _tmr.RUNNER.shutdown()
        from .services import scenarios as _scn

        _scn.RUNNER.shutdown()
        from .services import wiskey_background_feed as _wbf

        _wbf.FEED.shutdown()
        from .services import push as push_svc

        from starlette.concurrency import run_in_threadpool as _in_thread

        await _in_thread(push_svc.NOTIFIER.shutdown)  # queued alerts get a few seconds to go out
        from .services import notify_sources

        await _in_thread(notify_sources.shutdown)
        from .services import recorder_health

        await _in_thread(recorder_health.POLLER.shutdown)
        from .services import camera_image_health

        await _in_thread(camera_image_health.POLLER.shutdown)
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
