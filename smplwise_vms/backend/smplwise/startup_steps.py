"""The start-up steps of `create_app` (CR-MAIN-ROUTERS-TABLE-2440, review 05:P2-05).

Two ordered lists that used to be inline in `main.create_app`, moved here word for word:

* `AFTER_MIGRATE`: what runs once right after the migrations and before the stored connection settings are overlaid - schema
  guards for development databases, one-time repairs, the settling of what the previous process left unfinished. Each step
  guards itself ("never block the start") exactly as it did inline; the two that never were guarded (`record_version`,
  `settle_update_run`) still are not.
* `WIRING`: the service wiring that sits BETWEEN router includes. `routers.ROUTERS` names each one as a `Step` at the place it
  always ran, so the order of imports and of registrations at import (messaging uses, notification channels) is unchanged.

Nothing here decides anything: the order is the order of the tuples, and `main.create_app` runs them.
"""
from __future__ import annotations

import logging
import os
from typing import Callable

from fastapi import FastAPI

from .config import Settings

log = logging.getLogger("smplwise")  # the application logger: these lines always were `smplwise` lines


# ---------------------------------------------------------------------------------------------- after the migrations

def keep_home_interface_defaults(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    if 212 in (applied or []):  # HOME-SIMPLE-2421: people who arrived under 2.42.0 keep the interface default they had
        try:
            from .services import home_interface as _hi

            with app.state.db.connection(label="home_interface.freeze_legacy_defaults") as conn:
                frozen = _hi.freeze_legacy_defaults(conn)
            if frozen:
                log.info("home interface: kept the 2.42.0 default of %s person(s)", frozen)
        except Exception:  # noqa: BLE001 - never block the start; such a person then gets the new default (full)
            log.exception("could not keep the 2.42.0 home interface defaults")


def move_classic_skin_once(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    try:  # DOMUS-DEFAULT-2439 (owner Q-DES-20): a saved "classic" look moves to Domus once; a later choice of classic stays
        from .services import skin_switch as _skin_switch

        with app.state.db.connection(label="skin_switch.run_once") as conn:
            moved = _skin_switch.run_once(conn)  # the connection's own exit commits (the write gate: no commit by hand)
        if moved == "moved":
            log.info("look: the saved classic skin was moved to domus (once; classic stays selectable)")
    except Exception:  # noqa: BLE001 - never block the start; the step has written no marker and runs again at the next start
        log.exception("could not run the one-time move of the classic skin to domus")


def load_mic_mode(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    try:  # LAZYMIC-295: the remote channel's microphone policy follows this installation's settings from the first response
        from . import remote_channel as _rc

        with app.state.db.connection(mode="read", label="mic mode") as conn:
            _rc.load_mic_mode_from(conn)
    except Exception:  # noqa: BLE001 - never block the start; the default allows the microphone
        log.warning("could not read the microphone policy settings", exc_info=True)


def ensure_migration_objects(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    try:  # review M2: objects of 0036 (alarm) and 0037 (user_prefs) exist whatever schema_migrations recorded
        guarded = app.state.db.ensure_migration_objects()
        if guarded:
            log.warning("schema guard created objects missing despite the recorded migrations: %s", guarded)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("could not check the alarm / user_prefs schema")


def ensure_shared_spaces_schema(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    try:  # CR-009 re-review: a dev database that ran an earlier shape of the shared-spaces migration gets what it lacks
        from .services import shared_spaces as shared_spaces_svc

        with app.state.db.connection(label="shared_spaces.ensure_schema") as conn:
            fixed = shared_spaces_svc.ensure_schema(conn)
        if fixed:
            log.warning("shared spaces schema completed: %s", fixed)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("could not check the shared spaces schema")


def record_version(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    from .services import backup as backup_svc

    backup_svc.record_version(app.state.db)


def settle_update_run(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    from .services import update_runs

    update_runs.on_startup(app.state.db, settings)  # CR-021 S3: settle the open update run / resume a platform restart run (never raises)


def note_release_restart(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    try:  # CR-021 S4: a release flagged `[platform-restart]` in its own notes adds the "restart required" reason once
        from .services import release_notes

        if os.environ.get("SW_RELEASE_MARKER", "1") != "0":  # tests switch the start-up read off (conftest)
            with app.state.db.connection(label="release_notes.note_release_restart") as conn:
                if release_notes.note_release_restart(conn):
                    log.info("this release asks for one platform restart (reason added)")
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("could not read the release's platform-restart marker")


def ensure_notify_policies(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    try:  # CR-018: the per-source notification policies are created from the catalogue the first time (an administrator's edit is never overwritten)
        from .services import notify_policy

        with app.state.db.connection(label="notify_policy.ensure_defaults") as conn:
            notify_policy.ensure_defaults(conn)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("could not create the notification policies")


def settle_bulk_device_actions(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    try:  # CR-007 slice 3 review: a bulk device action cut off by the previous process gets its outcome now
        from .services import device_bulk

        swept = device_bulk.sweep_unfinished(app.state.db)
        if swept:
            log.warning("settled %s bulk device action(s) left unfinished by the previous process", swept)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("could not settle unfinished bulk device actions")


def reconcile_switch_protection(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    try:  # CR-019: switch protection on the mirror the previous process left (renames, gone, switches not judged yet)
        from .services import switch_protection

        with app.state.db.connection(label="switch_protection.startup") as conn:
            switch_protection.reconcile(conn, switch_protection.present_from_mirror(conn))
    except Exception:  # noqa: BLE001 - never block the start; an unjudged switch stays out of group actions (fail-safe)
        log.exception("could not reconcile the switch protection")


def backfill_ha_event_cameras(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    try:  # 0.1.74: HA Hikvision-integration events get their camera (one cheap pass; new events get it on insert)
        from .services.correlation import backfill_ha_event_cameras

        with app.state.db.connection() as _c:
            fixed = backfill_ha_event_cameras(_c)
        if fixed:
            log.info("attached %s Home Assistant NVR events to their cameras", fixed)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("HA event camera backfill failed")


def ensure_push_server_id(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    try:  # CR-W2-FOLLOWUPS-2441: the installation's opaque push id exists before the first GET /presence/config, so that read never writes
        from .db import get_setting
        from .services import mobile_push

        with app.state.db.connection(mode="read", label="push.server_id") as conn:
            present = bool(get_setting(conn, "push.server_id"))
        if not present:
            with app.state.db.connection(label="push.server_id") as conn:
                mobile_push.server_id(conn)
    except Exception:  # noqa: BLE001 - never block the start; the first read that needs the id still creates it
        log.exception("could not create the installation's push id")


AfterMigrate = Callable[[FastAPI, Settings, "list[int] | None"], None]
AFTER_MIGRATE: tuple[AfterMigrate, ...] = (
    keep_home_interface_defaults,
    move_classic_skin_once,
    load_mic_mode,
    ensure_migration_objects,
    ensure_shared_spaces_schema,
    record_version,
    settle_update_run,
    note_release_restart,
    ensure_notify_policies,
    settle_bulk_device_actions,
    reconcile_switch_protection,
    backfill_ha_event_cameras,
    ensure_push_server_id,
)


def after_migrate(app: FastAPI, settings: Settings, applied: list[int] | None) -> None:
    """Every `AFTER_MIGRATE` step, in order, with the settings as they are at that moment (before the stored overlays)."""
    for step in AFTER_MIGRATE:
        step(app, settings, applied)


# ---------------------------------------------------------------------------------------------- wiring between the router includes

def messaging_uses(app: FastAPI, settings: Settings) -> None:
    from .services import temperature_whatsapp as _temperature_whatsapp  # noqa: F401 - TEMPREG-295: joins the messaging use registry at startup (gated by the module state), not when a temperature route first runs
    from .services import insights_delivery as _insights_delivery  # noqa: F401 - CR-INSIGHT215: its WhatsApp use joins the account mapping at startup (shown only while the delivery is on)
    from .services import access_grants as _access_grants  # noqa: F401 - REGSTART-295: the "access" messaging use joins at import; import it at startup, not via whichever router or worker ran first
    from .services import local_reset as _local_reset  # noqa: F401 - REGSTART-295: the "identity" messaging use joins at import; it was imported only by the housekeeping step and the identity router


def assetlinks_route(app: FastAPI, settings: Settings) -> None:
    from .routers import local_passkeys

    # the Android app's Digital Asset Links statement for passkeys in its WebView (404 unless the feature is on and an app is named)
    app.add_api_route("/.well-known/assetlinks.json", local_passkeys.assetlinks, methods=["GET"], include_in_schema=False)


def cast_sessions(app: FastAPI, settings: Settings) -> None:
    from .services import cast_sessions as cast_svc
    cast_svc.attach(app.state.db, settings)  # the relay's callbacks and the live tokens of open casts (an add-on restart keeps them)


def announcements(app: FastAPI, settings: Settings) -> None:
    from .services import announcements as announcements_svc
    from .services import announce_channel  # noqa: F401  (registers the `announce` notification channel)
    announcements_svc.attach(app.state.db, settings)  # a rule's announce action writes its log through this


def wa_recipient_guard(app: FastAPI, settings: Settings) -> None:
    from .services import wa_policy as wa_policy_svc
    from .services.tickets import channel_whatsapp as _wa_channel
    _wa_channel.set_recipient_guard(wa_policy_svc.make_guard(app.state.db))  # WAPACE-295: the WhatsApp recipient allow-list, for every sender


def tickets_public(app: FastAPI, settings: Settings) -> None:
    from .services.tickets.public_runtime import RUNTIME as tickets_public  # CR-038 S4: the module key and the public listener's wiring
    tickets_public.configure(settings, app.state.db)


def ha_bridge(app: FastAPI, settings: Settings) -> None:
    from .services import ha_bridge as ha_bridge_svc
    ha_bridge_svc.configure(settings.data_dir)  # HMACACT-295: the key set needs the data directory for a connection that does not know its database


def calendar_runtime(app: FastAPI, settings: Settings) -> None:
    from .services.calendar_sync import credentials as calendar_credentials
    from .services.calendar_sync import registry as calendar_registry
    calendar_credentials.RUNTIME.configure(app.state.db, settings.data_dir)  # CALCONNECT-2330: the real adapters read sealed credentials through it
    calendar_registry.install_builtin()  # iCal IN, Google, Microsoft; they run only for an authorised connection while the module is on


def tickets_messaging(app: FastAPI, settings: Settings) -> None:
    from .services.tickets.messaging import RUNTIME as tickets_messaging  # CR-038 S5b: the ticket message channel (outbox, inbound)
    tickets_messaging.configure(settings, app.state.db)


WIRING: dict[str, Callable[[FastAPI, Settings], None]] = {
    "messaging_uses": messaging_uses,
    "assetlinks_route": assetlinks_route,
    "cast_sessions": cast_sessions,
    "announcements": announcements,
    "wa_recipient_guard": wa_recipient_guard,
    "tickets_public": tickets_public,
    "ha_bridge": ha_bridge,
    "calendar_runtime": calendar_runtime,
    "tickets_messaging": tickets_messaging,
}
