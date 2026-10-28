"""Administrator maintenance queue using existing identity-bound technical writes."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any

from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_interval

from .access.diagnostics import error_code
from .access.models import AccessError
from .bridge_command_scope import bridge_authorized
from .client.technical import validate_changes
from .const import DOMAIN
from .issues import issue
from .maintenance_jobs import MaintenanceJobs, moment
from .operations_center import canonical, in_window
from .storage import AccessStore

DEFAULT_WINDOW = {
    "enabled": False,
    "days": list(range(7)),
    "start": "00:00",
    "end": "23:59",
    "timezone": "UTC",
}


def queue(hass: HomeAssistant) -> MaintenanceJobs:
    value = hass.data[DOMAIN].get("maintenance_jobs")
    if not isinstance(value, MaintenanceJobs):
        raise AccessError("operations_unavailable")
    return value


def current_window(hass: HomeAssistant, sid: str) -> dict:
    from .operations_api import center

    return deepcopy(
        center(hass).data["stations"].get(sid, {}).get("values", {}).get("window", DEFAULT_WINDOW)
    )


async def active_admin(hass: HomeAssistant, actor: str) -> None:
    from .native_owner_access import require_owner

    user = await hass.auth.async_get_user(actor)
    require_owner(hass, user)


async def process(hass: HomeAssistant, now: datetime) -> None:
    from .access.station_lifecycle_jobs import frozen_sources
    from .access_runtime import get_manager
    from .operations_api import read_configuration, station_stamp
    from .technical_api import dispatch_technical

    jobs = queue(hass)
    from .native_maintenance_owner import (
        NativeMaintenanceGrant,
        admitted,
        maintenance_source,
        native_job,
    )

    selected: NativeMaintenanceGrant | None = None
    row_sources: dict[tuple[str, str], NativeMaintenanceGrant | None] = {}

    def current(job, row):
        if native_job(job):
            grant = row_sources.get((job["id"], row["station_id"]))
            if grant is None:
                raise AccessError("native_source_unavailable")
            NativeMaintenanceGrant.check(grant, row)

    async def guard(job, row, recovery):
        nonlocal selected
        key = job["id"], row["station_id"]
        if key not in row_sources:
            row_sources[key] = maintenance_source(jobs, job["id"]) if native_job(job) else None
        # A row already admitted by this original worker cannot adopt a renewed
        # source while awaiting I/O, intent persistence or verified publication.
        selected = row_sources[key]
        current(job, row)
        if station_stamp(hass, [row["station_id"]]) != row["identity_stamp"]:
            raise AccessError("device_changed")
        if recovery:
            return
        manager = get_manager(hass)
        if manager.lifecycle_lock.locked() or row["station_id"] in frozen_sources(
            manager.repository.snapshot()
        ):
            raise AccessError("device_busy")
        if moment(job["expires_at"]) <= datetime.now(UTC):
            raise AccessError("review_expired")
        if selected is None:
            await active_admin(hass, job["actor"])
        dual = selected is None and (
            job["dual_required"] or hass.data[DOMAIN]["workflows"].settings()["dual_approval"]
        )
        if dual:
            consent = job["consent"]
            if not consent or not consent["approved"]:
                raise AccessError("approval_required")
            try:
                await active_admin(hass, consent["actor"])
            except AccessError:
                raise AccessError("approval_required") from None
        if canonical(current_window(hass, row["station_id"])) != canonical(row["window"]):
            raise AccessError("revision_conflict")
        if not in_window(row["window"], datetime.now(UTC)):
            raise AccessError("maintenance_window_closed")

    async def read(row):
        async def original():
            result = await read_configuration(hass, row["station_id"], row["door"])
            validate_changes(row["changes"], result["constraints"])
            return result["values"]

        if selected is not None:
            with NativeMaintenanceGrant.execution(selected, row):
                return await original()
        return await original()

    async def write(row):
        async def original():
            result = await dispatch_technical(
                hass, "stations/technical_update", {**row, "confirmed": True}
            )
            return result["values"]

        if selected is not None:
            with NativeMaintenanceGrant.execution(selected, row, write=True):
                return await original()
        return await original()

    await jobs.run(
        now,
        guard=guard,
        read=read,
        write=write,
        admitted=lambda job: admitted(jobs, job),
        current=current,
    )


async def dispatch(hass: HomeAssistant, command: str, msg: dict, actor: str) -> Any:
    from .operations_api import center, read_configuration, station_catalog, station_stamp, targets

    ops, jobs = center(hass), queue(hass)

    def records():
        from .native_maintenance_owner import source_status

        result = jobs.public(actor)
        for row in result:
            if (source := source_status(jobs, row)) is not None:
                row["native_execution_source"] = source
        return result

    if command == "platform/maintenance_preview":
        ids, door = targets(msg, station_catalog(hass))
        rows, pending = [], []
        # Saving the review is read-only. No queue or device write exists yet.
        for sid in ids:
            try:
                observed = await read_configuration(hass, sid, door)
                validate_changes(msg["changes"], observed["constraints"])
                captured = current_window(hass, sid)
                row = {
                    "station_id": sid,
                    "name": station_catalog(hass)[sid],
                    "door": door,
                    "identity_stamp": station_stamp(hass, [sid]),
                    "expected": observed["values"],
                    "changes": deepcopy(msg["changes"]),
                    "window": captured,
                }
                pending.append(row)
                rows.append(
                    {
                        "station_id": sid,
                        "name": row["name"],
                        "before": row["expected"],
                        "after": {**row["expected"], **row["changes"]},
                        "window": captured,
                        "error": None,
                    }
                )
            except Exception as err:
                rows.append(
                    {
                        "station_id": sid,
                        "name": station_catalog(hass).get(sid, ""),
                        "before": None,
                        "after": None,
                        "window": None,
                        "error": error_code(err),
                    }
                )
        token = (
            ops.review(
                actor,
                "maintenance",
                {"rows": pending},
                station_stamp(hass, [r["station_id"] for r in pending]),
            )
            if pending
            else None
        )
        return {"review_id": token, "rows": rows, "queue_count": len(pending)}
    if command == "platform/maintenance_enqueue":
        review = ops.reviews.get(msg["review_id"])
        ids = (
            [r["station_id"] for r in review["values"]["rows"]]
            if review and review["actor"] == actor
            else []
        )
        values = ops.consume(
            actor, msg["review_id"], "maintenance", msg["confirmed"], station_stamp(hass, ids)
        )
        for row in values["rows"]:
            if canonical(current_window(hass, row["station_id"])) != canonical(row["window"]):
                raise AccessError("review_expired")
        await active_admin(hass, actor)
        from .native_checkpoint_owner import command_principal, origin

        principal = command_principal(actor)
        job = await jobs.enqueue(
            actor,
            values["rows"],
            hass.data[DOMAIN]["workflows"].settings()["dual_approval"]
            and not bridge_authorized(hass),
            datetime.now(UTC),
            bridge_owner=origin(principal) if principal is not None else None,
        )
        result = {"job_id": job["id"], "state": job["state"]}
        if principal is not None:
            from .native_maintenance_owner import bind_maintenance_source

            result["native_execution_source"] = bind_maintenance_source(
                hass, jobs, job["id"], actor
            )
        return result
    if command == "platform/maintenance_jobs":
        return {"records": records()}
    if command == "platform/maintenance_plan":
        jobs.get(msg["job_id"], msg["fingerprint"])
        return next(row for row in records() if row["id"] == msg["job_id"])
    if msg.get("confirmed") is not True:
        raise AccessError("confirmation_required")
    job = jobs.get(msg["job_id"], msg["fingerprint"])
    if command == "platform/maintenance_resume_v1":
        from .native_maintenance_owner import bind_maintenance_source

        return {
            "job_id": job["id"],
            "state": job["state"],
            "native_execution_source": bind_maintenance_source(hass, jobs, job["id"], actor),
        }
    if command == "platform/maintenance_decide":
        await active_admin(hass, job["actor"])
        await jobs.decide(job["id"], msg["fingerprint"], actor, msg["approve"])
    elif command == "platform/maintenance_cancel":
        await jobs.cancel(job["id"], msg["fingerprint"])
    else:
        raise AccessError("invalid_fields")
    return {"records": records()}


async def setup(hass: HomeAssistant) -> Callable[[], Awaitable[None]] | None:
    store = AccessStore(hass, key=f"{DOMAIN}.maintenance_jobs")
    jobs = MaintenanceJobs(store.async_save)
    try:
        jobs.load(await store.async_load())
    except AccessError:
        issue(hass, "maintenance_jobs_storage_corrupt", active=True)
        hass.data[DOMAIN]["maintenance_jobs"] = None
        return
    hass.data[DOMAIN]["maintenance_jobs"] = jobs
    issue(hass, "maintenance_jobs_storage_corrupt", active=False)
    task: asyncio.Task | None = None
    closing = False

    async def run(now):
        try:
            await process(hass, now)
        except Exception:
            # Persist failure never falls through to an unjournalled write.
            issue(hass, "maintenance_jobs_storage_write", active=True)

    async def tick(now):
        nonlocal task
        if not closing and (task is None or task.done()):
            task = hass.async_create_background_task(
                run(now), "smplwise maintenance queue", eager_start=False
            )

    cancel = async_track_time_interval(hass, tick, timedelta(seconds=30))

    close_task: asyncio.Task[None] | None = None

    async def close() -> None:
        nonlocal close_task
        nonlocal closing

        async def finish() -> None:
            if task is not None:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            if hass.data.get(DOMAIN, {}).get("maintenance_jobs") is jobs:
                hass.data[DOMAIN].pop("maintenance_jobs")

        if close_task is None:
            from .native_maintenance_owner import close_maintenance_sources

            closing = True
            close_maintenance_sources(jobs)
            cancel()
            close_task = asyncio.create_task(finish())
        from .access.commit_tasks import finish_owned_commit

        await finish_owned_commit(close_task)

    async def stop(_event):
        await close()

    hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stop)
    return close
