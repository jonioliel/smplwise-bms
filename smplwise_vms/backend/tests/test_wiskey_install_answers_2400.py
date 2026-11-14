"""WISKEY-INSTALL-ANSWERS-2400: the owner's answers of 04.11 (round 18) for "WisKey installs and upgrades through Arx"
(docs/changes/WISKEY-INSTALL-ANSWERS-2400.md), on top of WISKEY-MANAGED-INSTALL-2382.

- Q3 = B: the start-up run (`startup_reconcile`) behind its own owner switch `wiskey.managed.startup` (default off, the managed switch's
  phrase, goes off with the managed switch); every gate of the owner path still applies, the Core gate strictly; one attempt per bundle.
- Q4 = A: the full backup is at most 24 h old.        Q5 = A: Arx never creates a backup (allow-list test in the 2382 file).
- Q6 = B: the accepted-risk switch stays off and never covers a start-up run.   Q7 = A: the three phrases are pinned.
- Q8 = B: `wiskey.managed.keep_runs` (1-10, default 5 = the owner's number of 04.11, system administrator, audited) drives the clean-up.

FAKES ONLY: the 2382 file's fake Supervisor / Core, synthetic config tree and synthetic managed bundle. No Home Assistant, no WisKey, no
lab host. The worker thread runs inline; the clock is virtual."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
from conftest import as_user, bind

from smplwise.db import set_setting
from smplwise.services import wiskey_auto_install as wai
from smplwise.services import wiskey_managed_install as wmi
from smplwise.services.wiskey_distribution_digest import digest

from test_wiskey_managed_install_2382 import (  # noqa: F401 - `world` is a fixture
    API, PHRASE_ON, PHRASE_RISK, STEPS_OK, WALL0, _adopted, _audit_rows, _install_manual, _job, _managed_bundle, _setting, _switch_on,
    tree_state, world,
)


def _startup_on(w) -> None:
    assert _switch_on(w, "startup", PHRASE_ON).status_code == 200


def _reconcile(w) -> str:
    return wmi.startup_reconcile(w["db"], w["settings"])


def _newer_bundle(w, version: str = "2.0.1-rc.11") -> None:
    shutil.rmtree(w["bundle"].parent)
    _managed_bundle(w["bundle"].parent, version=version)
    wmi._BUNDLE_CACHE.update(key=None, value=None)


# ================================================================ Q3: the start-up switch

def test_the_startup_switch_needs_the_managed_switch_and_its_phrase_and_goes_off_with_it(world):
    assert _switch_on(world, "startup", PHRASE_ON).status_code == 409, "the managed switch first"
    assert _switch_on(world).status_code == 200
    for wrong in (None, "", PHRASE_RISK, wmi.ADOPT_PHRASE, PHRASE_ON + "."):
        r = world["client"].put(API + "/switch", json={"switch": "startup", "value": "on", "confirm": wrong})
        assert r.status_code == 422 and r.json()["code"] == "confirmation_required", r.text
    r = world["client"].put(API + "/switch", json={"switch": "startup", "value": "on", "confirm": PHRASE_ON})
    assert r.status_code == 200 and r.json()["switches"] == {"enabled": "on", "core_risk": "off", "startup": "on"}
    assert r.json()["phrases"]["startup"] == PHRASE_ON
    rows = [json.loads(x["details_json"]) for x in _audit_rows(world["db"], "settings.changed") if x["decision"] == "allowed"]
    assert {"key": wmi.K_STARTUP, "before": "off", "after": "on"} in rows
    assert world["platform"].calls == [], "switching on reads, stops and installs nothing"
    r = world["client"].put(API + "/switch", json={"switch": "enabled", "value": "off"})
    assert r.json()["switches"] == {"enabled": "off", "core_risk": "off", "startup": "off"}
    assert _setting(world["db"], wmi.K_STARTUP) == "off"


def test_a_non_system_admin_cannot_turn_the_startup_switch_on_or_set_the_kept_runs(world, settings):
    _switch_on(world)
    bind(world["client"], settings, "otto", "site_admin", "installation", "*")
    r = world["client"].put(API + "/switch", headers=as_user("otto"), json={"switch": "startup", "value": "on", "confirm": PHRASE_ON})
    assert r.status_code == 403
    r = world["client"].put(API + "/keep-runs", headers=as_user("otto"), json={"value": 5})
    assert r.status_code == 403
    assert _setting(world["db"], wmi.K_STARTUP) is None and _setting(world["db"], wmi.K_KEEP_RUNS) is None


@pytest.mark.parametrize("enabled,startup", [(None, None), ("on", None), ("on", "off"), ("off", "on"), (None, "on"), ("on", "ON")])
def test_startup_does_nothing_unless_both_switches_are_on(world, enabled, startup):
    _install_manual(world)
    with world["db"].write_aside() as conn:
        for key, value in ((wmi.K_ENABLED, enabled), (wmi.K_STARTUP, startup)):
            if value is not None:
                set_setting(conn, key, value)
    before = tree_state(world["cfg"])
    assert _reconcile(world) == "off"
    assert world["platform"].calls == [] and tree_state(world["cfg"]) == before and _job(world) is None
    assert _audit_rows(world["db"], wmi.AUDIT_STARTUP) == []


def test_startup_never_replaces_a_manual_install_the_owner_did_not_adopt(world):
    _install_manual(world)
    _switch_on(world)
    _startup_on(world)
    before = tree_state(world["cfg"])
    assert _reconcile(world) == "adoption_required"
    assert world["platform"].calls == [] and tree_state(world["cfg"]) == before and _job(world) is None
    (row,) = _audit_rows(world["db"], wmi.AUDIT_STARTUP)
    assert row["decision"] == "denied" and row["reason"] == "adoption_required" and row["actor_user_id"] is None
    assert _reconcile(world) == "adoption_required"
    assert len(_audit_rows(world["db"], wmi.AUDIT_STARTUP)) == 1, "the same refusal is audited once, not at every start"
    assert _setting(world["db"], wmi.K_ADOPTION) is None, "start-up never adopts"


def test_startup_runs_the_same_orchestrated_run_after_the_owners_adoption(world):
    _adopted(world)
    _startup_on(world)
    assert _reconcile(world) == "started"
    job = _job(world)
    assert job["state"] == "succeeded" and job["kind"] == "convert" and job["origin"] == "startup"
    assert [s["name"] for s in job["steps"]] == STEPS_OK, "core gate, full-backup check, private backup, stop / swap / start / compare"
    assert world["platform"].calls == ["gate", "backups", "stop", "start"]
    assert digest(world["cfg"] / "custom_components" / "hikvision_intercom") == world["managed_digest"]
    attempt = json.loads(_setting(world["db"], wmi.K_STARTUP_ATTEMPT))
    assert attempt["digest"] == world["managed_digest"] and attempt["job"] == job["id"]
    started = [json.loads(r["details_json"]) for r in _audit_rows(world["db"], "wiskey.managed.run_started")]
    assert started[-1]["origin"] == "startup"
    (row,) = _audit_rows(world["db"], wmi.AUDIT_STARTUP)
    assert row["decision"] == "allowed" and json.loads(row["details_json"])["plan"] == "convert"
    world["platform"].calls.clear()
    assert _reconcile(world) == "already_attempted" and world["platform"].calls == []
    _startup_on(world)  # the owner re-arms: the attempt record goes, the plan is now up to date
    assert _setting(world["db"], wmi.K_STARTUP_ATTEMPT) == ""
    assert _reconcile(world) == "up_to_date" and world["platform"].calls == []
    assert wai.switch_on_db(world["db"]) is False and wai.OWNER_ON_PERMITTED is False, "the unattended policy-B path stays closed"


@pytest.mark.parametrize("gate", [{"state": "unverified", "code": "core_runtime_provenance_unavailable"},
                                  {"state": "unavailable", "code": "core_runtime_bootstrap_unavailable"}, None])
def test_startup_takes_the_core_gate_strictly_even_with_the_accepted_risk_switch_on(world, gate):
    _adopted(world)
    _startup_on(world)
    assert _switch_on(world, "core_risk", PHRASE_RISK).status_code == 200  # Q6 = B keeps it off; even ON it never covers start-up
    world["platform"].gate = gate
    before = tree_state(world["cfg"])
    assert _reconcile(world) == "started"
    job = _job(world)
    assert job["state"] == "aborted" and job["risk_accepted"] is False and "stop" not in world["platform"].calls
    assert job["code"] == ("core_gate_unverified" if gate and gate["state"] == "unverified" else (gate or {}).get("code", "core_runtime_unavailable"))
    assert tree_state(world["cfg"]) == before


def test_a_startup_attempt_that_touched_nothing_is_tried_again_at_the_next_start(world):
    _adopted(world)
    _startup_on(world)
    world["platform"].backup_rows = [{"type": "full", "date": "2029-12-30T23:00:00+00:00", "content": {"homeassistant": True}}]  # 25 h
    assert _reconcile(world) == "started"
    assert (_job(world)["state"], _job(world)["code"]) == ("aborted", "full_backup_stale") and "stop" not in world["platform"].calls
    world["platform"].backup_rows = [{"type": "full", "date": "2029-12-31T23:30:00+00:00", "content": {"homeassistant": True}}]
    assert _reconcile(world) == "started", "nothing was touched: the next start tries again (the owner took a fresh backup)"
    assert _job(world)["state"] == "succeeded"


def test_a_startup_run_that_stopped_core_is_not_repeated_for_the_same_bundle(world):
    _adopted(world)
    _startup_on(world)
    _newer_bundle(world)
    world["platform"].broken = {"2.0.1-rc.11"}
    assert _reconcile(world) == "started"
    job = _job(world)
    assert job["state"] == "rolled_back" and job["origin"] == "startup"
    assert digest(world["cfg"] / "custom_components" / "hikvision_intercom") == world["manual_digest"]
    calls = list(world["platform"].calls)
    assert _reconcile(world) == "already_attempted" and world["platform"].calls == calls, "no second stop of Core at the next start"
    _newer_bundle(world, "2.0.1-rc.12")  # a NEW shipped bundle is a new attempt
    world["platform"].broken = set()
    assert _reconcile(world) == "started" and _job(world)["state"] == "succeeded"


def test_an_interrupted_startup_run_is_recovered_and_not_repeated(world):
    _adopted(world)
    _startup_on(world)
    job_id = "20300101T000000Z-abcdef"
    with world["db"].write_aside() as conn:
        set_setting(conn, wmi.K_JOB, json.dumps({"id": job_id, "state": "running", "kind": "convert", "steps": [{"name": "stop_core"}],
                                                 "rollback_of": None, "origin": "startup"}))
        set_setting(conn, wmi.K_STARTUP_ATTEMPT, json.dumps({"digest": world["managed_digest"], "job": job_id, "at": "x"}))
    world["platform"].running = False
    wmi.startup_safe(world["db"], world["settings"])
    assert _job(world)["state"] == "interrupted" and world["platform"].calls == ["start"], "recovery first: Core is started, nothing swapped"


def test_startup_waits_for_core_and_gives_up_without_touching_anything(world):
    _adopted(world)
    _startup_on(world)
    world["platform"].running = False
    before = tree_state(world["cfg"])
    assert _reconcile(world) == "core_not_running"
    assert world["platform"].calls == [] and tree_state(world["cfg"]) == before and _job(world) is None
    assert _audit_rows(world["db"], wmi.AUDIT_STARTUP)[-1]["reason"] == "core_not_running"


def test_startup_never_downgrades(world, monkeypatch):
    from smplwise.services import wiskey_versions as wv
    from test_wiskey_managed_install_2382 import CODE

    _install_manual(world, version="2.0.2")
    known = (*wv._known(), {"label": "2.0.2", "product_CODE": CODE, "profile": wv.MANUAL_PROFILE,
                            "component_digest": digest(world["cfg"] / "custom_components" / "hikvision_intercom")})
    monkeypatch.setattr(wv, "_known", lambda: known)
    _switch_on(world)
    assert world["client"].post(API + "/adopt", json={"confirm": wmi.ADOPT_PHRASE}).status_code == 200
    _startup_on(world)
    before = tree_state(world["cfg"])
    assert _reconcile(world) == "plan_refused"
    assert world["platform"].calls == [] and tree_state(world["cfg"]) == before
    assert json.loads(_audit_rows(world["db"], wmi.AUDIT_STARTUP)[-1]["details_json"]) == {"plan": "downgrade_refused"}


def test_startup_is_forward_only():
    with pytest.raises(wmi.ManagedRefused):
        wmi.start(None, None, "rollback", origin="startup")
    with pytest.raises(wmi.ManagedRefused):
        wmi.start(None, None, "forward", origin="anything")


# ================================================================ Q4 / Q6 / Q7

def test_the_full_backup_may_be_at_most_24_hours_old():
    assert wmi.BACKUP_MAX_AGE_S == 24 * 3600
    import datetime as dt

    def row(age_s: float) -> list[dict]:
        at = dt.datetime.fromtimestamp(WALL0 - age_s, dt.timezone.utc).isoformat()
        return [{"type": "full", "date": at, "content": {"homeassistant": True}}]

    assert wmi._backup_verdict(row(24 * 3600 - 60), WALL0) is None
    assert wmi._backup_verdict(row(24 * 3600), WALL0) is None
    assert wmi._backup_verdict(row(24 * 3600 + 1), WALL0) == "full_backup_stale"


def test_the_three_typed_phrases_are_unchanged_and_the_risk_switch_is_off_by_default(world):
    assert wmi.PHRASES[wmi.K_ENABLED] == "מאשר ניהול התקנה"
    assert wmi.PHRASES[wmi.K_RISK] == "מאשר סיכון סביבה"
    assert wmi.ADOPT_PHRASE == "מאשר העברה לניהול"
    assert wmi.PHRASES[wmi.K_STARTUP] == wmi.PHRASES[wmi.K_ENABLED], "no fourth phrase"
    assert len(set(wmi.PHRASES.values()) | {wmi.ADOPT_PHRASE}) == 3
    body = world["client"].get(API).json()
    assert body["switches"]["core_risk"] == "off" and body["backup_max_age_h"] == 24


# ================================================================ Q8: the number of recent runs kept

def test_keep_runs_defaults_to_five_and_is_written_by_the_admin_route_only_audited(world):
    body = world["client"].get(API).json()
    assert body["keep_runs"] == 5 and body["keep_runs_range"] == [1, 10]
    r = world["client"].put(API + "/keep-runs", json={"value": 7})
    assert r.status_code == 200 and r.json()["keep_runs"] == 7, r.text
    rows = [json.loads(x["details_json"]) for x in _audit_rows(world["db"], "settings.changed") if x["decision"] == "allowed"]
    assert rows[-1] == {"key": wmi.K_KEEP_RUNS, "before": 5, "after": 7}
    assert world["platform"].calls == [], "a setting change deletes nothing by itself"


@pytest.mark.parametrize("value", [0, 11, -1, "3", True, 2.0, None, [3]])
def test_keep_runs_refuses_anything_but_an_integer_from_1_to_10(world, value):
    r = world["client"].put(API + "/keep-runs", json={"value": value})
    assert r.status_code == 422 and r.json()["code"] == "validation", r.text
    assert _setting(world["db"], wmi.K_KEEP_RUNS) is None
    assert _audit_rows(world["db"], "settings.changed")[-1]["decision"] == "denied"


@pytest.mark.parametrize("stored", ["0", "11", "abc", "", " 4", "4.0"])
def test_an_invalid_stored_keep_runs_reads_as_the_default(world, stored):
    with world["db"].write_aside() as conn:
        set_setting(conn, wmi.K_KEEP_RUNS, stored)
    with world["db"].connection(mode="read") as conn:
        assert wmi.keep_runs(conn) == 5


@pytest.mark.parametrize("keep,write", [(1, True), (2, True), (5, False)])  # 5 = the default (owner, 04.11), never written
def test_the_clean_up_after_a_successful_run_keeps_the_owners_number(world, keep, write):
    _adopted(world)
    stage_root = world["cfg"] / wmi.STAGE_ROOT
    backup_root = Path(world["settings"].data_dir) / "wiskey-managed" / "backups"
    old = [f"2020010{i}T000000Z-00000{i}" for i in range(1, 5)]
    for root in (stage_root, backup_root):
        for job_id in old:
            (root / job_id).mkdir(parents=True)
    if write:
        assert world["client"].put(API + "/keep-runs", json={"value": keep}).status_code == 200
    assert world["client"].post(API + "/upgrade").status_code == 202
    job = _job(world)
    assert job["state"] == "succeeded"
    adoption_backup = json.loads(_setting(world["db"], wmi.K_ADOPTION))["backup"]
    for root, candidates in ((stage_root, [*old, job["id"]]), (backup_root, [*old, adoption_backup, job["id"]])):
        kept = {p.name for p in root.iterdir() if wmi.JOB_ID_RE.match(p.name)}
        expected = set(sorted(candidates, reverse=True)[:keep]) | {job["id"]}
        assert kept == expected, (root, kept)
