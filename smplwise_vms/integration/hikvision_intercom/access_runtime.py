"""Own the central access repository once and expose administrator sync actions."""

import asyncio
from contextvars import Context
from functools import partial
from typing import Any
from weakref import WeakKeyDictionary

import voluptuous as vol
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import Event, HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.service import async_register_admin_service

from .access.acceptance import Acceptance
from .access.manager import AccessManager
from .access.models import AccessError
from .access.repository import AccessRepository
from .access.schedule_baselines import ScheduleBaselines
from .access.schedule_journal import ScheduleJournal
from .access.schedule_operations import ScheduleOperations
from .access.schedule_plans import SchedulePlans
from .access.schedule_work_queue import ScheduleWorkQueue
from .access.schedules import ScheduleLibrary
from .access.startup_cleanup import AccessStartupCleanup
from .configuration import managed_locks
from .const import DOMAIN
from .issues import issue
from .storage import AccessStore

SIGNAL_ACCESS_CHANGED = f"{DOMAIN}_access_changed"
_SETUP_LOCKS: WeakKeyDictionary[HomeAssistant, asyncio.Lock] = WeakKeyDictionary()
_FAILED_SETUPS: WeakKeyDictionary[HomeAssistant, AccessStartupCleanup] = WeakKeyDictionary()
# Retain the actual repository, selected engine, shutdown owner, peer owner and
# original error. A failed join cannot authorize closing or replacing a source.
_FAILED_SHUTDOWNS: WeakKeyDictionary[HomeAssistant, tuple[object, ...]] = WeakKeyDictionary()
_CLOSING_ACCESS: WeakKeyDictionary[HomeAssistant, object] = WeakKeyDictionary()


def get_manager(hass: HomeAssistant) -> AccessManager:
    if hass in _FAILED_SHUTDOWNS:
        raise AccessError("access_shutdown_cleanup_failed")
    if hass in _CLOSING_ACCESS:
        raise AccessError("manager_closed")
    if hass in _FAILED_SETUPS:
        raise AccessError("access_setup_cleanup_failed")
    return hass.data[DOMAIN]["access"]


async def async_setup_access(hass: HomeAssistant) -> None:
    # Protect the first await/open as well as final namespace publication. A
    # second native setup must not construct another person/receipt writer
    # while the first caller is still loading its original storage source.
    async with _SETUP_LOCKS.setdefault(hass, asyncio.Lock()):
        await _async_setup_access_once(hass)


async def _async_setup_access_once(hass: HomeAssistant) -> None:
    if hass in _FAILED_SHUTDOWNS:
        raise AccessError("access_shutdown_cleanup_failed")
    if hass in _CLOSING_ACCESS:
        raise AccessError("manager_closed")
    if hass in _FAILED_SETUPS:
        raise AccessError("access_setup_cleanup_failed")
    if DOMAIN in hass.data and "access" in hass.data[DOMAIN]:
        return
    from .ecc_host_storage import close_selection, open_host_repository
    from .native_emergency_recovery_host import (
        async_setup_native_emergency_recovery,
        close_native_emergency_recovery,
    )

    selection = None
    repository = None
    startup = AccessStartupCleanup()
    try:
        repository, selection = await open_host_repository(hass)
        if selection is not None:
            startup.defer(100, partial(close_selection, selection), after_join=True)
        startup.defer(
            90, partial(close_native_emergency_recovery, hass, repository), after_join=True
        )
        # Component setup precedes every station entry. Restore original durable
        # refusals before runtime publication or any reconciliation writer.
        await async_setup_native_emergency_recovery(
            hass, repository=repository, selection=selection
        )
        await _setup_access(hass, repository, selection, startup)
        startup.release()
    except BaseException as error:
        if isinstance(error, AccessError):
            issue(hass, "users_storage_corrupt", active=True)
        from .access.commit_tasks import finish_owned_commit

        try:
            await finish_owned_commit(asyncio.create_task(startup.close()))
        except BaseException:
            if startup.failed:
                _FAILED_SETUPS[hass] = startup
                issue(hass, "access_setup_cleanup_failed", active=True)
                raise AccessError("access_setup_cleanup_failed") from None
            raise
        raise


async def _setup_access(
    hass: HomeAssistant, repository: AccessRepository, selection, startup: AccessStartupCleanup
) -> None:
    issue(hass, "users_storage_corrupt", active=False)

    @callback
    def changed() -> None:
        # The signal carries no personal data. Each subscriber is re-authorized before refresh.
        async_dispatcher_send(hass, SIGNAL_ACCESS_CHANGED)

    from .panel_permissions import PanelPermissions

    permission_store = AccessStore(hass, key=f"{DOMAIN}.panel_permissions")
    panel_permissions = PanelPermissions(permission_store.async_save, changed)
    try:
        panel_permissions.load(await permission_store.async_load())
    except AccessError:
        issue(hass, "panel_permissions_storage_corrupt", active=True)
        panel_permissions.recover_from_invalid_storage()
        hass.data.setdefault(DOMAIN, {})["panel_permissions"] = panel_permissions
    else:
        issue(hass, "panel_permissions_storage_corrupt", active=False)
        hass.data.setdefault(DOMAIN, {})["panel_permissions"] = panel_permissions

    from .appearance_settings import AppearanceSettings

    appearance_store = AccessStore(hass, key=f"{DOMAIN}.appearance_settings")
    appearance = AppearanceSettings(appearance_store.async_save, changed)
    try:
        appearance.load(await appearance_store.async_load())
    except AccessError:
        # Preserve invalid storage until repaired; do not silently overwrite it.
        hass.data.setdefault(DOMAIN, {})["appearance_settings"] = None
    else:
        hass.data.setdefault(DOMAIN, {})["appearance_settings"] = appearance

    from .media_settings import MediaSettings

    media_store = AccessStore(hass, key=f"{DOMAIN}.media_settings")
    media = MediaSettings(media_store.async_save, changed)
    try:
        media.load(await media_store.async_load())
    except AccessError:
        issue(hass, "media_settings_storage_corrupt", active=True)
        hass.data.setdefault(DOMAIN, {})["media_settings"] = None
    else:
        issue(hass, "media_settings_storage_corrupt", active=False)
        hass.data.setdefault(DOMAIN, {})["media_settings"] = media

    from .whatsapp_templates import WhatsAppTemplates

    template_store = AccessStore(hass, key=f"{DOMAIN}.whatsapp_templates")
    templates = WhatsAppTemplates(template_store.async_save, changed)
    try:
        templates.load(await template_store.async_load())
    except AccessError:
        hass.data.setdefault(DOMAIN, {})["whatsapp_templates"] = None
    else:
        hass.data.setdefault(DOMAIN, {})["whatsapp_templates"] = templates

    from .whatsapp_pacing_runtime import async_setup_whatsapp_pacing, close_whatsapp_pacing

    try:
        startup.defer(80, partial(close_whatsapp_pacing, hass), after_join=True)
        await async_setup_whatsapp_pacing(hass)
    except Exception:
        # Preserve a missing/rebound/corrupt original ledger. Other access
        # features remain available; sending fails before service I/O.
        hass.data[DOMAIN]["whatsapp_pacing_blocker"] = "storage_unavailable"

    from .access.guest_templates import GuestTemplates
    from .access.permission_reviews import PermissionReviews
    from .ntp_settings import NtpSettings

    review_store = AccessStore(hass, key=f"{DOMAIN}.permission_reviews")
    reviews = PermissionReviews(review_store.async_save, changed)
    try:
        reviews.load(await review_store.async_load())
    except AccessError:
        hass.data.setdefault(DOMAIN, {})["permission_reviews"] = None
    else:
        hass.data.setdefault(DOMAIN, {})["permission_reviews"] = reviews

    guest_template_store = AccessStore(hass, key=f"{DOMAIN}.guest_templates")
    guest_templates = GuestTemplates(guest_template_store.async_save, changed)
    try:
        guest_templates.load(await guest_template_store.async_load())
    except AccessError:
        # Preserve a corrupt file; an unrelated user update must not replace it.
        hass.data.setdefault(DOMAIN, {})["guest_templates"] = None
    else:
        hass.data.setdefault(DOMAIN, {})["guest_templates"] = guest_templates

    ntp_store = AccessStore(hass, key=f"{DOMAIN}.ntp_settings")
    ntp = NtpSettings(ntp_store.async_save, changed)
    try:
        ntp.load(await ntp_store.async_load())
    except AccessError:
        hass.data.setdefault(DOMAIN, {})["ntp_settings"] = None
    else:
        hass.data.setdefault(DOMAIN, {})["ntp_settings"] = ntp

    from .profile_settings import ProfileSettings

    profile_store = AccessStore(hass, key=f"{DOMAIN}.profile_settings")

    async def save_profiles(data: dict[str, Any]) -> None:
        manager = hass.data[DOMAIN].get("access")
        before = {u.id: u.revision for u in repository.users()}
        try:
            await repository.async_profile_settings(data, manager._validate if manager else None)
        finally:
            # A cancelled caller can still have completed the durable commit.
            if manager:
                for user in repository.users():
                    if before.get(user.id) != user.revision:
                        manager.request_user(user.id)
                changed()

    profiles = ProfileSettings(save_profiles, changed, repository.profile_settings)
    # Do not silently discard corrupt field definitions or reuse their identities.
    try:
        central = repository.profile_settings()
        profiles.load(central if central is not None else await profile_store.async_load())
        if central is None:
            await repository.async_profile_settings(profiles.data)
    except AccessError:
        issue(hass, "profile_settings_storage_corrupt", active=True)
        hass.data[DOMAIN]["profile_settings"] = None
    else:
        issue(hass, "profile_settings_storage_corrupt", active=False)
        hass.data[DOMAIN]["profile_settings"] = profiles

    from .access.hold_open import HoldOpenDrafts

    hold_store = AccessStore(hass, key=f"{DOMAIN}.hold_open_drafts")
    hold_drafts = HoldOpenDrafts(hold_store.async_save)
    hold_drafts.load(await hold_store.async_load())
    hass.data[DOMAIN]["hold_open_drafts"] = hold_drafts

    from datetime import timedelta

    from homeassistant.helpers.event import async_track_time_interval

    from .access.hold_programs import HoldPrograms
    from .legacy_hold_runtime import LegacyHoldRuntime

    program_store = AccessStore(hass, key=f"{DOMAIN}.hold_programs")

    async def send_hold(item: dict[str, Any], command: str) -> None:
        await LegacyHoldRuntime.send(hold_lifetime, item, command)

    programs = HoldPrograms(program_store.async_save, send_hold)
    programs.load(await program_store.async_load())
    hold_lifetime = LegacyHoldRuntime(hass, programs)
    startup.defer(10, partial(LegacyHoldRuntime.retire_failed_setup, hold_lifetime))
    startup.publish(hass.data[DOMAIN], "hold_programs", programs)
    program_tick_lock = asyncio.Lock()

    async def tick_programs(now: Any) -> None:
        if program_tick_lock.locked():
            return
        async with program_tick_lock:
            await programs.tick(now)

    stop_program_timer = async_track_time_interval(hass, tick_programs, timedelta(seconds=15))

    async def stop_startup_program_timer() -> None:
        stop_program_timer()

    startup.defer(0, stop_startup_program_timer)

    schedule_store = AccessStore(hass, key=f"{DOMAIN}.schedules")
    schedules = ScheduleLibrary(schedule_store.async_save, changed)
    try:
        await schedules.async_load(await schedule_store.async_load())
    except AccessError:
        issue(hass, "schedules_storage_corrupt", active=True)
        hass.data.setdefault(DOMAIN, {})["schedules"] = None
    else:
        issue(hass, "schedules_storage_corrupt", active=False)
        hass.data.setdefault(DOMAIN, {})["schedules"] = schedules

    acceptance_store = AccessStore(hass, key=f"{DOMAIN}.acceptance")
    acceptance = Acceptance(acceptance_store.async_save)
    try:
        await acceptance.async_load(await acceptance_store.async_load())
    except AccessError:
        issue(hass, "acceptance_storage_corrupt", active=True)
        hass.data[DOMAIN]["acceptance"] = None
    else:
        issue(hass, "acceptance_storage_corrupt", active=False)
        hass.data[DOMAIN]["acceptance"] = acceptance

    from .fleet_alerts import FleetAlerts
    from .fleet_health import FleetHealth

    alert_store = AccessStore(hass, key=f"{DOMAIN}.fleet_alerts")
    fleet_alerts = FleetAlerts(alert_store.async_save, changed)
    try:
        fleet_alerts.load(await alert_store.async_load())
    except AccessError:
        issue(hass, "fleet_alerts_storage_corrupt", active=True)
        hass.data[DOMAIN]["fleet_alerts"] = None
    else:
        issue(hass, "fleet_alerts_storage_corrupt", active=False)
        hass.data[DOMAIN]["fleet_alerts"] = fleet_alerts

    fleet_store = AccessStore(hass, key=f"{DOMAIN}.fleet_health")
    fleet_health = FleetHealth(fleet_store.async_save)
    try:
        fleet_health.load(await fleet_store.async_load())
    except AccessError:
        issue(hass, "fleet_health_storage_corrupt", active=True)
        hass.data[DOMAIN]["fleet_health"] = None
    else:
        issue(hass, "fleet_health_storage_corrupt", active=False)
        hass.data[DOMAIN]["fleet_health"] = fleet_health

    baseline_store = AccessStore(hass, key=f"{DOMAIN}.schedule_baselines")
    baselines = ScheduleBaselines(baseline_store.async_save)
    try:
        await baselines.async_load(await baseline_store.async_load())
    except AccessError:
        issue(hass, "schedule_baselines_storage_corrupt", active=True)
        hass.data.setdefault(DOMAIN, {})["schedule_baselines"] = None
    else:
        issue(hass, "schedule_baselines_storage_corrupt", active=False)
        hass.data.setdefault(DOMAIN, {})["schedule_baselines"] = baselines

    plan_store = AccessStore(hass, key=f"{DOMAIN}.schedule_plans")
    plans = SchedulePlans(plan_store.async_save)
    try:
        await plans.async_load(await plan_store.async_load())
    except AccessError:
        issue(hass, "schedule_plans_storage_corrupt", active=True)
        hass.data.setdefault(DOMAIN, {})["schedule_plans"] = None
    else:
        issue(hass, "schedule_plans_storage_corrupt", active=False)
        hass.data.setdefault(DOMAIN, {})["schedule_plans"] = plans

    journal_store = AccessStore(hass, key=f"{DOMAIN}.schedule_journal")
    journal = ScheduleJournal(journal_store.async_save)
    operations_store = AccessStore(hass, key=f"{DOMAIN}.schedule_operations")
    operations = ScheduleOperations(operations_store.async_save)
    for key, database, persistence in (
        ("schedule_journal", journal, journal_store),
        ("schedule_operations", operations, operations_store),
    ):
        try:
            await database.async_load(await persistence.async_load())
        except AccessError:
            issue(hass, f"{key}_storage_corrupt", active=True)
            hass.data[DOMAIN][key] = None
        else:
            issue(hass, f"{key}_storage_corrupt", active=False)
            hass.data[DOMAIN][key] = database

    from .schedule_operations_api import preflight

    queue = ScheduleWorkQueue(
        operations,
        lambda job: preflight(hass, job),
        changed,
        lambda coro: hass.async_create_background_task(
            coro, "hikvision schedule preflight", eager_start=False
        ),
    )
    startup.defer(50, partial(ScheduleWorkQueue.close, queue))
    startup.publish(hass.data[DOMAIN], "schedule_queue", queue)

    manager = AccessManager(
        repository,
        changed=changed,
        task_factory=lambda coro, name: hass.async_create_background_task(
            coro, name, eager_start=False
        ),
    )
    startup.defer(60, manager.async_close)
    if hass.data[DOMAIN].get("schedule_journal") is not None:
        from .access.native_timing import NativeTiming

        manager.engine.native_timing = NativeTiming(journal, repository)
    startup.publish(hass.data.setdefault(DOMAIN, {}), "access", manager)
    if selection is not None:
        from .peer_bridge_api import install_peer_bridge
        from .trusted_actions.native_peer_source import NativePeerRegistry

        registry = NativePeerRegistry(repository, repository_id=selection.repository_id)
        bridge = install_peer_bridge(hass, registry)
        from .peer_bridge_api import PeerQueryBridge

        async def close_startup_bridge() -> None:
            PeerQueryBridge.close(bridge)

        startup.defer(70, close_startup_bridge)
        # These are actual installed native objects, never a promise derived
        # from a build flag. Execution authority remains separately verified.
        startup.publish(hass.data[DOMAIN], "ecc_storage", selection)
        startup.publish(hass.data[DOMAIN], "native_peer_registry", registry)
    else:
        bridge = None
    from .access.encrypted_backup import Backups
    from .access.workflows import Workflows
    from .panel_security import PanelSecurity

    workflows_center = Workflows(manager)
    startup.publish(hass.data[DOMAIN], "workflows", workflows_center)
    startup.publish(hass.data[DOMAIN], "backups", Backups(manager))
    startup.publish(hass.data[DOMAIN], "panel_security", PanelSecurity(hass, workflows_center))

    from .operations_runtime import async_setup_operations

    close_operations = await async_setup_operations(hass)
    if close_operations is not None:
        startup.defer(30, close_operations)

    from .access.checkpoint_jobs import CheckpointJobs

    async def authorize_job(actor: str) -> bool:
        user = await hass.auth.async_get_user(actor)
        return bool(user and user.is_active and user.is_admin)

    checkpoint_jobs = CheckpointJobs(manager, authorize_job)
    startup.defer(20, partial(CheckpointJobs.close, checkpoint_jobs))
    startup.publish(hass.data[DOMAIN], "checkpoint_jobs", checkpoint_jobs)
    for entry in hass.config_entries.async_entries(DOMAIN):
        manager.register(entry.entry_id, entry.title, bool(managed_locks(entry.data)))

    from .access.shutdown import AccessShutdown

    shutdown = AccessShutdown(
        checkpoint_jobs,
        queue,
        stop_timer=stop_program_timer,
        manager_close=manager.async_close,
        hold_close=lambda: LegacyHoldRuntime.close(hold_lifetime),
        fleet_flush=fleet_health.async_flush
        if hass.data[DOMAIN].get("fleet_health") is fleet_health
        else None,
    )

    access_closing = [None]

    async def stop(_event: Event) -> None:
        from .access.arx_feature_host import close_native_feature_hosts
        from .access.commit_tasks import finish_owned_commit
        from .arx_native_feature_runtime import close_native_feature_runtime
        from .native_emergency_recovery_host import close_native_emergency_recovery
        from .native_template_installation import close_native_template_installation
        from .whatsapp_pacing_runtime import close_whatsapp_pacing, owns_current_pacing_send
        from .whatsapp_template_api_v1 import unbind_template_host_v1

        LegacyHoldRuntime.freeze(hold_lifetime)
        owned_caller = (
            LegacyHoldRuntime.owns_current(hold_lifetime)
            or AccessShutdown._owns_current(shutdown)
            or owns_current_pacing_send(hass)
        )
        if hass not in _CLOSING_ACCESS:
            _CLOSING_ACCESS[hass] = shutdown

        async def finish():
            with LegacyHoldRuntime.detached(hold_lifetime):
                first = None
                # Join original feature effects before closing the original manager
                # or durable engine. Public namespace replacement cannot hide work.
                for step in (
                    lambda: close_native_template_installation(hass),
                    lambda: unbind_template_host_v1(hass),
                    lambda: close_native_feature_hosts(hass, repository),
                    lambda: close_native_feature_runtime(hass, repository),
                    lambda: close_native_emergency_recovery(hass, repository),
                    lambda: close_whatsapp_pacing(hass),
                    lambda: AccessShutdown.close(shutdown),
                ):
                    try:
                        await step()
                    except (Exception, asyncio.CancelledError) as error:
                        if first is None:
                            first = error
                        _FAILED_SHUTDOWNS[hass] = (repository, selection, shutdown, bridge, first)
                # Only a joined owner chain permits retiring its original peer
                # registry and person/receipt engine. Still attempt independent
                # owner closers above; never hide their first original failure.
                if first is None:
                    try:
                        if bridge is not None:
                            from .peer_bridge_api import PeerQueryBridge

                            PeerQueryBridge.close(bridge)
                        if selection is not None:
                            from .ecc_host_storage import close_selection

                            await close_selection(selection)
                    except (Exception, asyncio.CancelledError) as error:
                        first = error
                        _FAILED_SHUTDOWNS[hass] = (repository, selection, shutdown, bridge, first)
                if first is not None:
                    issue(hass, "access_shutdown_cleanup_failed", active=True)
                    raise first
                # Keep the refusal marker, retire strong owner references only
                # after the original join/close chain completed successfully.
                _CLOSING_ACCESS[hass] = None

        if access_closing[0] is None:
            # This is the original global cleanup worker. It owns captured
            # resources, receives no command/effect/send/worker scopes, and
            # must actually join every original child instead of inheriting
            # a child's self-wait deferral. The owned caller may return while
            # this exact Task remains pending until that caller can retire.
            access_closing[0] = asyncio.create_task(finish(), context=Context())
        if not owned_caller:
            await finish_owned_commit(access_closing[0])

    remove_stop = hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stop)

    async def remove_failed_setup_stop() -> None:
        remove_stop()

    startup.defer(0, remove_failed_setup_stop)
    _register_services(hass, manager)


@callback
def _register_services(hass: HomeAssistant, manager: AccessManager) -> None:
    async def action(call: ServiceCall) -> None:
        try:
            if call.service == "sync_all":
                manager.request_all()
            elif call.service == "rescan_station":
                await manager.async_rescan(call.data["station_id"])
            elif call.service == "sync_user":
                manager.request_user(call.data["user_id"])
            else:
                manager.request(call.data["station_id"])
        except AccessError as err:
            raise ServiceValidationError(
                translation_domain=DOMAIN,
                translation_key="access_action_failed",
                translation_placeholders={"reason": err.code},
            ) from None

    for name in ("sync_user", "sync_station", "sync_all", "rescan_station"):
        key = "user_id" if name == "sync_user" else "station_id"
        fields: dict[Any, Any] = {} if name == "sync_all" else {vol.Required(key): str}
        async_register_admin_service(hass, DOMAIN, name, action, vol.Schema(fields))
