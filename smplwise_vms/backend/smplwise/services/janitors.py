"""The housekeeping pass (main.janitor_tick, every 30 s) as one ordered registry, and the one throttle object the self-throttled
steps share - CR-JANITOR-REGISTRY-2438 (code review 2026-11-13: D10 = 04:F17 + 05:P2-04, and the janitor part of 05:P1-03).

Before: a 350-line function with 55 copy-pasted `try: import; x.janitor(db) except: log.warning(...)` blocks, `read_settings()`
(261 keys) every pass for five values, and eight hand-made throttles (module globals, some locked, some not).

Now:
* `STEPS` is the pass, in the order it always ran. Each step names its target as `module:attribute` (looked up at call time, so a
  test that patches the module attribute still reaches the pass), what it is called with, and the warning logged when it fails.
* A step with a warning is guarded: a failure is logged (logger `smplwise`, the same text as before) and the pass goes on with the
  next step (BACKEND-SAFETY-2435). A step without one is not guarded: its exception ends the pass, exactly as before (the NVR
  storage warm-up, the manual-recording stop and the WAL checkpoint).
* Two failures end the pass on purpose (BACKEND-SAFETY-2435): a demo state that cannot be read and settings that cannot be read.
* The settings the steps use are read one key each (`setting_value`) on a read connection, not the whole registry on the write lock.
* `Every(seconds)` is the per-process throttle: `due()` answers True at most once per interval (the first call always), `reset()`
  for tests. The interval is mutable (`.seconds`) for the one step whose interval is a setting (maintenance reminders).

Tests: tests/test_janitor.py (the pass end to end, the golden order and arguments, the guard, the settings values, the throttle)."""
from __future__ import annotations

import importlib
import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable

log = logging.getLogger("smplwise")  # the logger janitor_tick always logged on: the warnings keep their logger and their text


# ---------------------------------------------------------------- the throttle

class Every:
    """A per-process throttle: `due()` is True at most once per `seconds` (the first call always), thread-safe.

    `clock` is the time source (default `time.monotonic`, looked up at each call); `due(now)` takes an explicit instant instead,
    for the steps whose callers pass one (insights delivery, document reading). `mark()` records a run that happened anyway
    (device activity's forced prune)."""

    def __init__(self, seconds: float, clock: Callable[[], float] | None = None) -> None:
        self.seconds = float(seconds)
        self.clock = clock
        self.last = 0.0  # 0.0 = never ran in this process
        self._lock = threading.Lock()

    def _now(self) -> float:
        return float((self.clock or time.monotonic)())

    def due(self, now: float | None = None) -> bool:
        with self._lock:
            t = self._now() if now is None else float(now)
            if self.last and t - self.last < self.seconds:
                return False
            self.last = t
            return True

    def mark(self, now: float | None = None) -> None:
        with self._lock:
            self.last = self._now() if now is None else float(now)

    def reset(self) -> None:
        with self._lock:
            self.last = 0.0


# ---------------------------------------------------------------- the pass

# The settings the steps read (all plain integer keys: `setting_value` answers exactly what `read_settings()[key]` answered).
# schedules.janitor receives this mapping as its `settings` argument and reads `schedules.runs_retention_days` from it;
# automations.janitor receives it and reads nothing from it. A new step that needs a setting adds its key here.
SETTING_KEYS: tuple[str, ...] = ("playback.lease_s", "exports.retention_days", "events.retention_days", "audit.retention_days",
                                 "schedules.runs_retention_days")


@dataclass(frozen=True)
class Pass:
    db: Any  # db.Database
    settings: Any  # config.Settings (the live add-on settings)
    values: dict[str, Any] = field(default_factory=dict)  # SETTING_KEYS -> value


def _arg(p: Pass, need: str) -> Any:
    if need == "db":
        return p.db
    if need == "settings":
        return p.settings
    if need == "data_dir":
        return p.settings.data_dir
    if need == "values":
        return p.values
    if need.startswith("@"):
        return p.values[need[1:]]
    raise KeyError(need)


@dataclass(frozen=True)
class Step:
    name: str  # stable name: the golden order test reads it
    target: str | Callable[[Pass], Any]  # "module:attr.path" under the smplwise package, or a function of the pass
    needs: tuple[str, ...] = ()  # the call's arguments, in order: db | settings | data_dir | values | @<setting key>
    failure: str | None = None  # the warning logged when the step raises; None = not guarded (the exception ends the pass)
    nvr_only: bool = False  # skipped in NVR-less mode (mode.is_ha_only)

    def resolve(self) -> Callable[..., Any]:
        """The callable, looked up now (a test that patches the module attribute is honoured)."""
        if callable(self.target):
            return self.target
        module, _, attr = self.target.partition(":")
        obj: Any = importlib.import_module(f"..{module}", __package__)
        for part in attr.split("."):
            obj = getattr(obj, part)
        return obj

    def run(self, p: Pass) -> Any:
        fn = self.resolve()
        if callable(self.target):
            return fn(p)
        return fn(*(_arg(p, n) for n in self.needs))


def _announcements(p: Pass) -> None:
    from . import announcements as announcements_svc

    with p.db.connection(label="announce.prune") as conn:
        announcements_svc.prune(conn)
    announcements_svc.release_queued(p.db, p.settings)  # ANNOUNCE-295: announcements held in the quiet hours are spoken once the window ended


def _partner(p: Pass) -> None:
    from .partner import core as partner_core, webhooks as partner_webhooks

    with p.db.connection(label="partner.janitor") as conn:
        partner_core.janitor(conn)
        partner_webhooks.janitor(conn)


def _tickets_costs(p: Pass) -> None:
    from .tickets import costs_retention
    from .tickets.public_runtime import RUNTIME as tickets_runtime

    if tickets_runtime.data_dir is not None:
        costs_retention.janitor(p.db, tickets_runtime.attachments_root())


def _checkpoint(p: Pass) -> None:
    p.db.checkpoint()  # PASSIVE; a TRUNCATE only when the WAL grew past its size limit and nobody writes or waits


STEPS: tuple[Step, ...] = (
    # BACKEND-SAFETY-2435: the leading steps (they were unguarded until then)
    Step("playback idle", "services.playback:expire_idle", ("settings", "@playback.lease_s"), "playback idle janitor failed"),
    Step("playback orphans", "services.playback:sweep_orphans", ("settings",), "playback orphans janitor failed"),
    Step("playback groups", "services.playback_groups:expire_empty", (), "playback groups janitor failed"),
    Step("exports retention", "services.exports:retention_sweep", ("db", "settings", "@exports.retention_days"), "exports retention janitor failed"),
    Step("events prune", "services.events_derive:prune", ("db", "@events.retention_days"), "events prune janitor failed"),
    Step("thumbnails prune", "services.thumbnails:prune", ("settings", "@events.retention_days"), "thumbnails prune janitor failed"),
    Step("audit prune", "audit:prune_db", ("db", "@audit.retention_days"), "audit prune janitor failed"),
    # counted-but-quiet throttled refusals: the end-of-window summary rows
    Step("refusal summaries", "services.ha_user_auth:flush_refusal_summaries", ("db",), "refusal summaries janitor failed"),
    Step("ha history prune", "services.ha_history:prune_db", ("db",), "ha history prune janitor failed"),
    # DEVHIST: retention + size caps (itself throttled to every 15 min)
    Step("device activity prune", "services.device_activity:prune_db", ("db",), "device activity prune janitor failed"),
    # CR-008 P3: push subscriptions whose browser has not synced for months
    Step("push prune", "services.push:prune", ("db",), "push prune janitor failed"),
    # CR-LIVEEVENT100: closed incidents past incidents.retention_days (an open incident is never pruned)
    Step("incidents", "services.incidents:prune_db", ("db",), "incidents janitor failed"),
    # CR-014: expired schedule trash, runs past their retention, settled ops, due derived runs (no Home Assistant call)
    Step("schedules", "services.schedules:janitor", ("db", "values"), "schedules janitor failed"),
    # CR-017: expired automation trash, runs and ops past their retention (no Home Assistant call)
    Step("automations", "services.automations:janitor", ("db", "values"), "automations janitor failed"),
    # CR-015: media devices deleted for 30 days, their layout keys, old command rows (no Home Assistant call)
    Step("media", "services.media_store:janitor", ("db",), "media janitor failed"),
    # MU2: announcement log rows older than 90 days; ANNOUNCE-295: held announcements released after the quiet hours
    Step("announcements", _announcements, (), "announcements janitor failed"),
    # CR-023 P2: automatic electricity bills at the end of each period (throttled to every 5 minutes; idempotent)
    Step("energy billing", "services.energy_billing:janitor", ("db", "settings"), "energy billing janitor failed"),
    # CR-QUIET103: stamp quiet windows whose end instant has passed (the dispatch decides by the clock, not by this sweep; no device call)
    Step("quiet windows", "services.quiet_windows:janitor", ("db",), "quiet windows janitor failed"),
    # NEEDSREVIEW (2.8.0): the yearly "needs review" reminder (January, once, throttled to an hourly check; never a door-system call)
    Step("needs review", "services.needs_review:janitor", ("db",), "needs-review janitor failed"),
    # SECFIX2-295 / PUB-03: erase undecided vendor-typed technicians past access.external.pending_retention_days (default 90; a saved 0 = off)
    Step("pending retention", "services.pending_retention:janitor", ("db",), "pending retention janitor failed"),
    # IDENT146: purge local accounts disabled / deleted for privacy.local_purge_days (default 30; the switch privacy.local_purge is off by default)
    Step("local privacy", "services.local_privacy:janitor", ("db",), "local privacy janitor failed"),
    # ZONECOUNT107 / REL2140 M-2: people-count samples - all deleted while the switch is off, retention while on (read-gated)
    Step("zone counts", "services.zone_counts:janitor", ("db",), "zone count janitor failed"),
    # a standalone HA camera shown live: drop the opt-in of a camera that is gone, delete go2rtc streams nobody wants (throttled)
    Step("ha live reconcile", "services.ha_camera_streams:reconcile", ("db", "settings"), "ha live reconcile failed"),
    # CAMERA-STREAM-SOURCES-2410: delete `smplwise_cam_` streams no manual source wants (throttled; nothing outside that shape)
    Step("camera sources reconcile", "services.camera_sources:reconcile", ("db", "settings"), "camera sources reconcile failed"),
    # CR-023: electricity retention (hourly inside; energy.db only, its own gate)
    Step("energy", "services.energy_sampler:janitor", ("db", "settings"), "energy janitor failed"),
    # CR-WATER78: water retention (hourly inside; water.db only, its own gate; nothing while the module is off)
    Step("water", "services.water_sampler:janitor", ("db", "settings"), "water janitor failed"),
    # CR-WATER78 slice 2: the leak evaluator, once per closed 15-minute bucket (water.db read-only; nothing while the module is off; never a device action)
    Step("water alerts", "services.water_runtime:janitor", ("db", "settings"), "water alerts evaluator failed"),
    # CR-WATER78 slice 3: automatic water bills at the end of each period (every 5 min inside) and bill retention (the shared keys)
    Step("water billing", "services.water_billing:janitor", ("db", "settings"), "water billing janitor failed"),
    # CR-031: generator history and closed alerts past their retention (hourly inside; no Home Assistant call)
    Step("generator", "services.generator_runtime:janitor", ("db",), "generator janitor failed"),
    # CR-INSIGHT215 slice 3: the scheduled monthly building report (OFF until set up and enabled; self-throttled to once a minute)
    Step("insights delivery", "services.insights_delivery:janitor", ("db", "settings"), "insights delivery janitor failed"),
    # CR-INFRA-ELEVATORS 2.8.0: the elevators' state history past its retention (hourly inside; no Home Assistant call)
    Step("elevators", "services.elevators_runtime:janitor", ("db",), "elevators janitor failed"),
    # CR-INFRA-TEMPERATURE 2.9.1: the temperature history and alert log past their retention (hourly inside; no Home Assistant call)
    Step("temperature", "services.temperature_runtime:janitor", ("db",), "temperature janitor failed"),
    # CR-021 S3 review: update / platform-restart runs past their ceiling are settled on a schedule, not only when someone asks
    Step("update runs", "services.update_runs:janitor", ("db",), "update runs janitor failed"),
    # CR-028: casts past their time end (one stop, the restore rule), casts whose screen vanished end, "not confirmed" after 15 s
    Step("cast", "services.cast_sessions:janitor", ("db", "settings"), "cast janitor failed"),
    # CR-027: the phone app's presence event log past its retention, expired app push messages, revoked device rows
    Step("presence", "services.presence:janitor", ("db",), "presence janitor failed"),
    # PRESENCE-2280: building-presence transitions (only while the master switch is on) and their retention
    Step("building presence history", "services.building_presence_history:janitor", ("db",), "building presence history failed"),
    # PARTNERAPI113-295: token expiry / creator-gone notices, purge of ended tokens, the delivery log and old outbox rows
    Step("partner", _partner, (), "partner janitor failed"),
    # APPREFRESH-295: expired app access tokens, families that ran out, ended families past their audit keep
    Step("app refresh", "services.app_refresh:janitor", ("db",), "app refresh janitor failed"),
    # SESSIONEXCH2-295: lapsed codes, web sessions past expiry or whose family ended (the sweep for a missed fan-out)
    Step("app session", "services.app_session:janitor", ("db",), "app session janitor failed"),
    # TFA2: expired second-factor lockout rows
    Step("second factor", "services.second_factor:janitor", ("db",), "second factor janitor failed"),
    # SEC3 (review L4): the sign-in rate counters and expired block-counter rows
    Step("rate limiter flush", "services.ha_user_auth:flush_limiter", ("db",), "rate limiter flush failed"),
    # USR2: the local identities' tiers (written behind), expired pending second steps, old link and session rows
    Step("local identity", "services.local_identity:janitor", ("db",), "local identity janitor failed"),
    # USR2-P2B: self-service reset code rows an hour past expiry, send-counter rows past 24 h
    Step("local reset", "services.local_reset:janitor", ("db",), "local reset janitor failed"),
    Step("alarm code counters", "services.alarm_codes:janitor", ("db",), "alarm code counter janitor failed"),
    # CR-038: the tickets module's housekeeping (hourly inside; the request-idempotency rows after 24 h)
    Step("tickets", "services.tickets.retention:janitor", ("db",), "tickets janitor failed"),
    # CR-038 S4: the public listener's counters and switch, codes / sessions / redeem ids / access rows past retention, unused keys
    Step("tickets public", "services.tickets.public_runtime:RUNTIME.janitor", ("db",), "tickets public janitor failed"),
    # CR-038 S9: the claim window's end, pending invoice files after 24 h, claims past their own retention (every 10 min inside)
    Step("tickets costs", _tickets_costs, (), "tickets cost janitor failed"),
    # CR-MAINT215: reminders before a due date / an expiry and requests on schedule (every 15 min inside; nothing while the module is off)
    Step("maintenance", "services.maintenance.reminders:janitor", ("db",), "maintenance janitor failed"),
    # SUPPLIERDOCS-297: document-reading drafts past their retention, and those of removed files (hourly inside)
    Step("docread", "services.docread.service:janitor", ("db",), "docread janitor failed"),
    # CR-EMERG104: the readiness history (a row only when the verdict or an item changed, or once a day); nothing while the module is off
    Step("emergency readiness history", "services.emergency.service:janitor", ("db", "settings"), "emergency readiness history failed"),
    # CR-NOTICE106: archived / expired notices past `notices.retention_days` (soft delete, purge 30 days later) - hourly
    Step("notices", "services.notices.store:janitor", ("db",), "notices janitor failed"),
    # CALENDARS-298: guest personal data past its retention is erased (always); expiry / done / the nightly cache roll while the module is on
    Step("calendar", "services.calendar.jobs:tick", ("db",), "calendar janitor failed"),
    # CALENDARS-298 phase 2: due external-calendar syncs (polling, at most once a minute per process; nothing while the module or sync is off)
    Step("calendar sync", "services.calendar.jobs:sync_tick", ("db", "data_dir"), "calendar sync tick failed"),
    # CAL-GRID-EDIT-2343: held-back cancel / move notices whose undo window passed
    Step("calendar notices", "services.calendar.jobs:notice_tick", ("db",), "calendar notice tick failed"),
    # CAL-ATTENDEES-2343: due attendee notices (in-app / the guests' messaging channel; a cancel waits the undo window); guest-contact retention hourly
    Step("calendar attendee notices", "services.calendar.attendee_notices:tick", ("db", "data_dir"), "calendar attendee notices tick failed"),
    # CR-038 S5a: the shared WhatsApp send ledger keeps 2 days (hourly inside)
    Step("messaging ledger", "services.messaging_runtime:janitor", ("db",), "messaging ledger janitor failed"),
    # WA-CONSENT-LINK: unanswered consent requests expire (held messages dropped, senders told), approved ones are released
    Step("intercom consent", "services.intercom_consent:tick", ("db", "settings"), "intercom consent janitor failed"),
    # WKR5-295: the WisKey people-write lineage keeps ENDED operations 30 days (open unknowns never purged); hourly inside; no-op uninstalled
    Step("wiskey lineage", "services.wiskey_direct_join:janitor", (), "wiskey lineage janitor failed"),
    # WISKEY-ADOPT-2272: WisKey's automatic installation (registry sync / re-announce) - hourly inside; `off` unless wiskey.auto_install = on
    Step("wiskey installation reconcile", "services.wiskey_auto_install:reconcile_due", ("db", "settings"), "wiskey installation reconcile failed"),
    # CR-038 S5b: the ticket outbox (90 days) and inbound (30 days) retention, hourly inside
    Step("tickets messaging", "services.tickets.messaging:RUNTIME.janitor", ("db",), "tickets messaging janitor failed"),
    # NVR-less mode: no NVR storage report to keep warm, no NVR recording to stop (these two were never guarded)
    Step("storage warm", "services.storage:warm", ("db", "settings"), None, nvr_only=True),  # non-blocking; keeps the storage report warm between opens
    Step("manual recordings stop", "services.nvr_write:stop_expired_manual", ("db", "settings"), None, nvr_only=True),  # A1: manual recordings past their planned stop
    # CR-020 S2: stream changes left pending (crash, busy database, unknown device answer) - settled by a read, never a write
    Step("nvr stream settle", "services.nvr_settings:settle_pending", ("db", "settings"), "nvr stream janitor failed", nvr_only=True),
    # CR-020 S2C: a multi-camera batch whose runner is gone (stale heartbeat) ends `interrupted` - never resumed
    Step("nvr batch recovery", "services.nvr_batch:recover_batches", ("db", "settings"), "nvr batch recovery failed", nvr_only=True),
    Step("checkpoint", _checkpoint, (), None),  # never guarded
)


def read_values(db: Any) -> dict[str, Any]:
    """The settings the steps read, one key each on a read connection (review 05:P1-03: was `read_settings()`, 261 keys and
    about 45 JSON parses on the write lock, every 30 s for five values). Same values: tests/test_setting_value_parity.py."""
    from .settings_store import setting_value

    with db.connection(mode="read", label="janitor.settings") as conn:
        return {k: setting_value(conn, k) for k in SETTING_KEYS}


def run_steps(steps: tuple[Step, ...] | list[Step], p: Pass) -> None:
    """Every step in order. A guarded step's failure is logged and the next step runs; an unguarded step's exception ends the pass."""
    ha_only: bool | None = None
    for step in steps:
        if step.nvr_only:
            if ha_only is None:
                from ..mode import is_ha_only

                ha_only = is_ha_only(p.settings)
            if ha_only:
                continue
        if step.failure is None:
            step.run(p)
            continue
        try:
            step.run(p)
        except Exception:  # noqa: BLE001 - one failing housekeeping step never stops the others
            log.warning(step.failure, exc_info=True)


def run_pass(db: Any, settings: Any) -> None:
    """One housekeeping pass (main.janitor_tick). Two failures end it on purpose (BACKEND-SAFETY-2435): a demo state that cannot be
    read (housekeeping must not touch a demo that may be running) and settings that cannot be read (no retention on guessed values)."""
    from . import demo_mode

    try:
        if demo_mode.tick(db, settings):  # CR-READY96: a running demo ends here when its time is up; while one runs the real installation's housekeeping waits
            return
    except Exception:  # noqa: BLE001
        log.warning("demo janitor failed; housekeeping pass skipped", exc_info=True)
        return
    try:
        values = read_values(db)
    except Exception:  # noqa: BLE001
        log.warning("janitor could not read settings; housekeeping pass skipped", exc_info=True)
        return
    run_steps(STEPS, Pass(db, settings, values))
