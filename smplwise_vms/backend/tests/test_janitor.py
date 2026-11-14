"""The janitor's housekeeping pass runs end to end. It died silently on a missing import from 0.1.30 to 0.1.37
(audit and HA-history pruning and the periodic discovery never ran), which only a test that executes the pass
can guard. CR-JANITOR-REGISTRY-2438: the pass is the registry services/janitors.py; the golden list below pins its order,
arguments and warnings to the pass as it was written out by hand before."""
from __future__ import annotations

import datetime as dt
import importlib
import logging

import pytest
from fastapi.testclient import TestClient

from smplwise.main import create_app, janitor_tick
from smplwise.services import janitors
from smplwise.services.janitors import Every, Pass, Step


def test_janitor_tick_runs_every_step(settings):
    app = create_app(settings)
    janitor_tick(app.state.db, settings)  # every name in the chain resolves and every prune tolerates an empty install
    janitor_tick(app.state.db, settings)  # and it is repeatable


def test_audit_retention_setting_controls_pruning(settings):
    """T055: audit retention used to be a fixed 365-day constant; it is a setting now, and the janitor's own
    pass (not just audit.prune called directly) has to actually use the configured value."""
    app = create_app(settings)
    c = TestClient(app)
    old_at = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=40)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO audit_log(at, actor_user_id, actor_username, action, resource_type, resource_id, decision, reason, request_id, permission_revision, details_json) "
            "VALUES (?, 'u1', 'joni', 'test.old_row', 'test', 'r1', 'allowed', NULL, NULL, 1, NULL)",
            (old_at,),
        )

    # default retention (365 days): a 40-day-old row must survive a real janitor pass
    assert c.get("/api/v1/settings").json()["settings"]["audit.retention_days"] == 365
    janitor_tick(app.state.db, settings)
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) c FROM audit_log WHERE action = 'test.old_row'").fetchone()["c"] == 1

    # shorten retention below the row's age: the same row must not survive the next pass
    assert c.patch("/api/v1/settings", json={"audit.retention_days": 30}).status_code == 200
    assert c.get("/api/v1/settings").json()["settings"]["audit.retention_days"] == 30
    janitor_tick(app.state.db, settings)
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) c FROM audit_log WHERE action = 'test.old_row'").fetchone()["c"] == 0

    # out-of-range values are rejected, not silently clamped - in the error envelope the screens read (FastAPI's
    # bare {"detail": [...]} left the settings save without a word until 0.1.80)
    r = c.patch("/api/v1/settings", json={"audit.retention_days": 10})
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "validation" and "audit.retention_days" in body["user_message"] and "30" in body["user_message"]
    assert body["details"]["errors"][0]["type"] == "greater_than_equal"
    assert c.patch("/api/v1/settings", json={"audit.retention_days": 5000}).status_code == 422


# ---------------------------------------------------------------- CR-JANITOR-REGISTRY-2438: the pass as a registry

# The pass exactly as main.janitor_tick ran it before the registry (BACKEND-SAFETY-2435 + 2.43.x): target, arguments, the warning
# logged on failure (None = not guarded) and whether the step is skipped in NVR-less mode. A change here is a change of the pass.
GOLDEN = [
    ("services.playback:expire_idle", ("settings", "@playback.lease_s"), "playback idle janitor failed", False),
    ("services.playback:sweep_orphans", ("settings",), "playback orphans janitor failed", False),
    ("services.playback_groups:expire_empty", (), "playback groups janitor failed", False),
    ("services.exports:retention_sweep", ("db", "settings", "@exports.retention_days"), "exports retention janitor failed", False),
    ("services.events_derive:prune", ("db", "@events.retention_days"), "events prune janitor failed", False),
    ("services.thumbnails:prune", ("settings", "@events.retention_days"), "thumbnails prune janitor failed", False),
    ("audit:prune_db", ("db", "@audit.retention_days"), "audit prune janitor failed", False),
    ("services.ha_user_auth:flush_refusal_summaries", ("db",), "refusal summaries janitor failed", False),
    ("services.ha_history:prune_db", ("db",), "ha history prune janitor failed", False),
    ("services.device_activity:prune_db", ("db",), "device activity prune janitor failed", False),
    ("services.push:prune", ("db",), "push prune janitor failed", False),
    ("services.incidents:prune_db", ("db",), "incidents janitor failed", False),
    ("services.schedules:janitor", ("db", "values"), "schedules janitor failed", False),
    ("services.automations:janitor", ("db", "values"), "automations janitor failed", False),
    ("services.media_store:janitor", ("db",), "media janitor failed", False),
    ("_announcements", (), "announcements janitor failed", False),
    ("services.energy_billing:janitor", ("db", "settings"), "energy billing janitor failed", False),
    ("services.quiet_windows:janitor", ("db",), "quiet windows janitor failed", False),
    ("services.needs_review:janitor", ("db",), "needs-review janitor failed", False),
    ("services.pending_retention:janitor", ("db",), "pending retention janitor failed", False),
    ("services.local_privacy:janitor", ("db",), "local privacy janitor failed", False),
    ("services.zone_counts:janitor", ("db",), "zone count janitor failed", False),
    ("services.ha_camera_streams:reconcile", ("db", "settings"), "ha live reconcile failed", False),
    ("services.camera_sources:reconcile", ("db", "settings"), "camera sources reconcile failed", False),
    ("services.energy_sampler:janitor", ("db", "settings"), "energy janitor failed", False),
    ("services.water_sampler:janitor", ("db", "settings"), "water janitor failed", False),
    ("services.water_runtime:janitor", ("db", "settings"), "water alerts evaluator failed", False),
    ("services.water_billing:janitor", ("db", "settings"), "water billing janitor failed", False),
    ("services.generator_runtime:janitor", ("db",), "generator janitor failed", False),
    ("services.insights_delivery:janitor", ("db", "settings"), "insights delivery janitor failed", False),
    ("services.elevators_runtime:janitor", ("db",), "elevators janitor failed", False),
    ("services.temperature_runtime:janitor", ("db",), "temperature janitor failed", False),
    ("services.update_runs:janitor", ("db",), "update runs janitor failed", False),
    ("services.cast_sessions:janitor", ("db", "settings"), "cast janitor failed", False),
    ("services.presence:janitor", ("db",), "presence janitor failed", False),
    ("services.building_presence_history:janitor", ("db",), "building presence history failed", False),
    ("_partner", (), "partner janitor failed", False),
    ("services.app_refresh:janitor", ("db",), "app refresh janitor failed", False),
    ("services.app_session:janitor", ("db",), "app session janitor failed", False),
    ("services.second_factor:janitor", ("db",), "second factor janitor failed", False),
    ("services.ha_user_auth:flush_limiter", ("db",), "rate limiter flush failed", False),
    ("services.local_identity:janitor", ("db",), "local identity janitor failed", False),
    ("services.local_reset:janitor", ("db",), "local reset janitor failed", False),
    ("services.alarm_codes:janitor", ("db",), "alarm code counter janitor failed", False),
    ("services.tickets.retention:janitor", ("db",), "tickets janitor failed", False),
    ("services.tickets.public_runtime:RUNTIME.janitor", ("db",), "tickets public janitor failed", False),
    ("_tickets_costs", (), "tickets cost janitor failed", False),
    ("services.maintenance.reminders:janitor", ("db",), "maintenance janitor failed", False),
    ("services.docread.service:janitor", ("db",), "docread janitor failed", False),
    ("services.emergency.service:janitor", ("db", "settings"), "emergency readiness history failed", False),
    ("services.notices.store:janitor", ("db",), "notices janitor failed", False),
    ("services.calendar.jobs:tick", ("db",), "calendar janitor failed", False),
    ("services.calendar.jobs:sync_tick", ("db", "data_dir"), "calendar sync tick failed", False),
    ("services.calendar.jobs:notice_tick", ("db",), "calendar notice tick failed", False),
    ("services.calendar.attendee_notices:tick", ("db", "data_dir"), "calendar attendee notices tick failed", False),
    ("services.messaging_runtime:janitor", ("db",), "messaging ledger janitor failed", False),
    ("services.intercom_consent:tick", ("db", "settings"), "intercom consent janitor failed", False),
    ("services.wiskey_direct_join:janitor", (), "wiskey lineage janitor failed", False),
    ("services.wiskey_auto_install:reconcile_due", ("db", "settings"), "wiskey installation reconcile failed", False),
    ("services.tickets.messaging:RUNTIME.janitor", ("db",), "tickets messaging janitor failed", False),
    ("services.storage:warm", ("db", "settings"), None, True),
    ("services.nvr_write:stop_expired_manual", ("db", "settings"), None, True),
    ("services.nvr_settings:settle_pending", ("db", "settings"), "nvr stream janitor failed", True),
    ("services.nvr_batch:recover_batches", ("db", "settings"), "nvr batch recovery failed", True),
    ("_checkpoint", (), None, False),
]


def _desc(step: Step) -> tuple:
    target = step.target if isinstance(step.target, str) else step.target.__name__
    return (target, step.needs, step.failure, step.nvr_only)


def test_the_registry_is_the_pass_in_todays_order():
    assert [_desc(s) for s in janitors.STEPS] == GOLDEN
    assert len({s.name for s in janitors.STEPS}) == len(janitors.STEPS), "step names are unique"
    assert all("%" not in (s.failure or "") for s in janitors.STEPS), "a warning text is logged as is"


def test_every_named_target_resolves_to_a_callable():
    for step in janitors.STEPS:
        assert callable(step.resolve()), step.name


def _patch_targets(monkeypatch) -> list[tuple[str, tuple]]:
    """Every named target replaced by a recorder (the module attribute, as a test that patches one step does)."""
    calls: list[tuple[str, tuple]] = []
    for step in janitors.STEPS:
        if not isinstance(step.target, str):
            continue
        module, _, attr = step.target.partition(":")
        owner = importlib.import_module(f"smplwise.{module}")
        *path, last = attr.split(".")
        for part in path:
            owner = getattr(owner, part)
        monkeypatch.setattr(owner, last, lambda *a, _n=step.name: calls.append((_n, a)))
    return calls


def _set(db, key: str, value: str) -> None:
    with db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))


def test_the_pass_calls_every_step_in_order_with_its_arguments(settings, monkeypatch):
    app = create_app(settings)
    db = app.state.db
    _set(db, "audit.retention_days", "40")
    calls = _patch_targets(monkeypatch)
    janitor_tick(db, settings)
    from smplwise.mode import is_ha_only

    named = [s for s in janitors.STEPS if isinstance(s.target, str) and not (s.nvr_only and is_ha_only(settings))]
    assert [n for n, _ in calls] == [s.name for s in named]
    got = dict(calls)
    assert got["playback idle"] == (settings, 600)
    assert got["exports retention"] == (db, settings, 7)
    assert got["thumbnails prune"] == (settings, 30)
    assert got["audit prune"] == (db, 40)
    assert got["calendar sync"] == (db, settings.data_dir)
    assert got["wiskey lineage"] == ()
    sched_db, sched_values = got["schedules"]
    assert sched_db is db and sched_values["schedules.runs_retention_days"] == 90


def test_the_values_are_what_read_settings_answers(settings):
    from smplwise.routers.settings import read_settings

    app = create_app(settings)
    db = app.state.db
    _set(db, "events.retention_days", "")
    _set(db, "exports.retention_days", "12")
    values = janitors.read_values(db)
    with db.connection(mode="read") as conn:
        full = read_settings(conn)
    assert values == {k: full[k] for k in janitors.SETTING_KEYS}
    assert values["exports.retention_days"] == 12 and values["events.retention_days"] == 30


def test_a_failing_guarded_step_is_logged_and_the_next_one_runs(caplog):
    ran: list[str] = []

    def boom(*_a):
        raise RuntimeError("x")

    steps = (Step("a", boom, (), "a janitor failed"), Step("b", lambda p: ran.append("b"), (), "b janitor failed"))
    with caplog.at_level(logging.WARNING, logger="smplwise"):
        janitors.run_steps(steps, Pass(db=None, settings=None))
    assert ran == ["b"] and "a janitor failed" in caplog.text


def test_an_unguarded_step_still_ends_the_pass():
    ran: list[str] = []

    def boom(*_a):
        raise RuntimeError("checkpoint")

    steps = (Step("a", boom, (), None), Step("b", lambda p: ran.append("b"), (), "b janitor failed"))
    with pytest.raises(RuntimeError):
        janitors.run_steps(steps, Pass(db=None, settings=None))
    assert ran == []


def test_nvr_steps_are_skipped_in_nvr_less_mode(monkeypatch):
    from smplwise import mode

    ran: list[str] = []
    steps = (Step("nvr", lambda p: ran.append("nvr"), (), None, nvr_only=True), Step("local", lambda p: ran.append("local"), (), None))
    monkeypatch.setattr(mode, "is_ha_only", lambda s: True)
    janitors.run_steps(steps, Pass(db=None, settings=object()))
    monkeypatch.setattr(mode, "is_ha_only", lambda s: False)
    janitors.run_steps(steps, Pass(db=None, settings=object()))
    assert ran == ["local", "nvr", "local"]


def test_unreadable_settings_skip_the_pass(settings, monkeypatch, caplog):
    app = create_app(settings)
    calls = _patch_targets(monkeypatch)

    def broken(db):
        raise RuntimeError("no settings")

    monkeypatch.setattr(janitors, "read_values", broken)
    with caplog.at_level(logging.WARNING, logger="smplwise"):
        janitor_tick(app.state.db, settings)
    assert calls == [] and "janitor could not read settings; housekeeping pass skipped" in caplog.text


def test_every_is_due_once_per_interval():
    t = [1000.0]
    e = Every(60, clock=lambda: t[0])
    assert e.due() and not e.due()
    t[0] += 59.9
    assert not e.due()
    t[0] += 0.1
    assert e.due()
    e.reset()
    assert e.due()
    e.mark(5000.0)
    assert not e.due(5030.0) and e.due(5060.0)
    e.seconds = 10
    assert e.due(5070.0)


def test_each_converted_throttle_keeps_its_interval():
    from smplwise.services import device_activity, insights_delivery, needs_review
    from smplwise.services.calendar import attendee_notices, jobs
    from smplwise.services.docread import service as docread_service
    from smplwise.services.maintenance import reminders

    assert needs_review._CHECK.seconds == 3600.0
    reminders.reset_for_tests()
    assert reminders._CHECK.seconds == 900.0
    assert docread_service._JANITOR.seconds == 3600.0
    assert device_activity._PRUNE.seconds == 900.0
    assert insights_delivery._PASS.seconds == 55.0
    assert jobs._TICK.seconds == 3000.0 and jobs._SYNC_TICK.seconds == 55.0
    assert attendee_notices._ERASE.seconds == 3000.0
