"""WISKEY-LIVE-VALIDATION-2390 (plan T16): the station acceptance tool. FAKES ONLY: WisKey is `FakeValidationHost` (a FakeDirectPort that
plays WisKey rc.10's ValidationCoordinator from tests/fixtures/wiskey_live_validation/rc10_live_validation.json), the Arx-side probes are
scripted, the media / talk probes are exercised against the intercom_media fakes. Nothing here reaches a WisKey, Home Assistant, a station,
go2rtc or a door; the only "door pulse" is the fake's counter."""
from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from typing import Any, Mapping

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

import wkcap_fakes as wf
from wkcap_fakes import FakeDirectPort

from smplwise.auth import current_principal_ro
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.rbac import Principal
from smplwise.services import intercom_media as im
from smplwise.services import intercom_sync
from smplwise.services import wiskey_feature_direct as fd
from smplwise.services import wiskey_feature_exec as fx
from smplwise.services import wiskey_live_validation as lv
from smplwise.services.wiskey_capture_port import PortError

API = "/api/v1"
FIXTURE = json.loads((Path(__file__).resolve().parent / "fixtures" / "wiskey_live_validation" / "rc10_live_validation.json").read_text(encoding="utf-8"))
REPO = Path(__file__).resolve().parents[3]
SERIAL = "DS-KV-SERIAL-SECRET-0001"  # the fake's device identity: must never reach a stored row, an export or an answer


# ================================================================ the fake WisKey (rc.10 ValidationCoordinator as data)

class FakeValidationHost(FakeDirectPort):
    """`features/start` of `live_validation` admits exactly what rc.10's ValidationCoordinator admits (closed private input, owner go
    bound to the request, every step bound to a granted station and permitted by the snapshot, every grant used) and records a
    receipt the way its `run()` does: steps in order, a failed step stops the run and the rest are `aborted`. `phase_of[action]`
    scripts a step's phase. A `pulse` step that is acknowledged increments `pulses` (the fake door)."""

    def __init__(self) -> None:
        super().__init__()
        self.phase_of: dict[str, str] = {}
        self.pulses: list[tuple[str, int]] = []
        self.status_answer: Any = {"schema_version": 1, "features": {"live_validation": {"implementation": "native_coordinator", "build_enabled": True,
                                                                                         "execution_available": True, "blocker": None}}}

    def call(self, command: str, parameters: Mapping[str, Any], *, timeout_s: float) -> Mapping[str, Any]:
        if command == "features/status" and not self.queue.get(command):
            self.calls.append((command, copy.deepcopy(dict(parameters))))
            if not self.connected:
                raise PortError("wiskey_direct_not_connected", "not_sent")
            return self.status_answer
        return super().call(command, parameters, timeout_s=timeout_s)

    def _start(self, params: Mapping[str, Any]) -> Mapping[str, Any]:
        req = params.get("request") or {}
        if req.get("feature") != "live_validation":
            return super()._start(params)
        mode = self.start_script.pop(0) if self.start_script else "ok"
        if mode == "not_sent":
            raise PortError("wiskey_direct_not_connected", "not_sent")
        if mode.startswith("refuse:"):
            raise PortError(mode.split(":", 1)[1], "refused")
        req, snap = self._check_binding(params)
        source = snap["private_input"]
        p = req["params"]
        pv = FIXTURE["private_input"]
        if not isinstance(source, dict) or sorted(source) != pv["keys"] or source["kind"] != pv["kind"] or source["checklist_ref"] != p["checklist_ref"]:
            raise PortError("binding_denied", "refused")
        go = source["owner_go"]
        if (sorted(go) != pv["owner_go_keys"] or go["reference"] != p["owner_go_ref"] or go["approved"] is not True
                or go["authority_revision"] != req["authority_revision"] or go["expiry"] != p["expiry"] or go["owner_user_id"] != req["actor"]["user_id"]):
            raise PortError("Unauthorized", "refused")
        perms = set(snap["permissions"])
        if FIXTURE["permissions"]["run"] not in perms:
            raise PortError("Unauthorized", "refused")
        grants = {(s["station_id"], s["physical_relay"], s["mapping_revision"]): s for s in snap["stations"]}
        if not 1 <= len(grants) <= 64:
            raise PortError("Unauthorized", "refused")  # the coordinator needs 1..64 targets
        steps, used, seen = [], set(), set()
        for st in source["steps"]:
            if sorted(st) != pv["step_keys"] or st["action"] not in FIXTURE["permissions"] or st["step_id"] in seen:
                raise PortError("invalid_fields", "refused")
            key = (st["station_id"], st["physical_relay"], st["mapping_revision"])
            if key not in grants:
                raise PortError("binding_denied", "refused")
            if FIXTURE["permissions"][st["action"]] not in perms:
                raise PortError("Unauthorized", "refused")
            if st["action"] == "video":
                raise PortError(FIXTURE["video_step_without_prepare_media"], "refused")
            seen.add(st["step_id"])
            used.add(key)
            steps.append(st)
        if used != set(grants):
            raise PortError("binding_denied", "refused")
        self.n += 1
        op = f"op-{self.n}"
        record_steps, failed = [], False
        for st in steps:
            g = grants[(st["station_id"], st["physical_relay"], st["mapping_revision"])]
            target = {"station_id": g["station_id"], "api_relay": g["api_relay"], "physical_relay": g["physical_relay"],
                      "mapping_revision": g["mapping_revision"], "identity": SERIAL}
            if failed:
                phase = "aborted"
            else:
                phase = self.phase_of.get(st["action"], "acknowledged")
                failed = phase != "acknowledged"
            if st["action"] == "pulse" and phase == "acknowledged":
                self.pulses.append((st["station_id"], st["physical_relay"]))
            record_steps.append({"step_id": st["step_id"], "action": st["action"], "target": target, "phase": phase,
                                 "observation": FIXTURE["observations"][st["action"]] if phase == "acknowledged" else None})
        self.ops[op] = {"request": copy.deepcopy(req), "private": copy.deepcopy(source), "phase": "attempted", "outcome": "acknowledged", "steps": record_steps}
        self.by_operation[req["operation_id"]] = op
        if mode in ("ack_loss", "timeout"):
            raise PortError("timeout", "unknown")  # admitted and run; the caller never sees the reply
        return {"schema_version": 1, "operation_ref": op, "state": "admitted", "execution_result": "pending", "replay_available": False}

    def _result(self, params: Mapping[str, Any]) -> Mapping[str, Any]:
        rec = self.ops.get(params["operation_ref"])
        if rec is None or "steps" not in rec or self.result_mode != "finished":
            return super()._result(params)
        receipt = {"original": {"request": rec["request"]}, "owner_go": rec["private"]["owner_go"], "checklist_ref": rec["private"]["checklist_ref"],
                   "steps": copy.deepcopy(rec["steps"]), **FIXTURE["receipt_constants"]}
        return {"schema_version": 1, "operation_ref": params["operation_ref"], "state": "finished", "receipt": receipt, "replay_available": False}

    def validation_starts(self) -> list[dict[str, Any]]:
        return [p for p in self.sent("features/start") if p["request"]["feature"] == "live_validation"]


class ScriptedProbes:
    """The Arx-side probes, scripted per check (default: pass). `hook(check)` runs before a check answers."""

    def __init__(self, settings: Any = None, answers: dict[str, lv.Outcome] | None = None, hook: Any = None, feed: str = "ready") -> None:
        self.answers = answers or {}
        self.hook = hook
        self.feed = feed
        self.calls: list[tuple[str, str]] = []

    def _answer(self, check: str, sid: str) -> lv.Outcome:
        self.calls.append((check, sid))
        if self.hook is not None:
            self.hook(check, sid)
        return self.answers.get(check, lv.passed({"source": "fake"}))

    def media_arx(self, conn, station):
        return self._answer("media_arx", station["id"])

    def media_wiskey(self, conn, station):
        return self._answer("media_wiskey", station["id"])

    def talk(self, conn, auth, station):
        return self._answer("talk", station["id"])

    def health(self, auth, sid):
        self.calls.append(("health", sid))
        return {"events": {"stream": "connected", "history": "recovered", "reconnects": 0, "last_frame_at": "2026-11-03T10:00:00+00:00"},
                "clock": {"status": "ready", "skew_seconds": 0.4, "drift_state": "within_tolerance", "time_mode": "NTP", "checked_at": "2026-11-03T10:00:00+00:00"}}, "wiskey"

    def feed_state(self):
        return self.feed


def station(sid: str, name: str, *, online: bool = True, relays=(1, 2)) -> dict[str, Any]:
    return {"id": sid, "name": name, "online": online, "call_state": "idle", "sync_state": "synced", "lock_enabled": True,
            "integrated_locks": [{"physical_index": r, "api_id": r, "name": f"דלת {r}"} for r in relays], "entities": {"camera": f"camera.{sid.replace('-', '_')}"}}


class Env:
    def __init__(self, settings, monkeypatch) -> None:
        self.settings = settings
        self.app = create_app(settings)
        self.c = TestClient(self.app)
        self.c.get(f"{API}/me")
        self.db = Database(settings.db_path)
        self.port = FakeValidationHost()
        self.probes = ScriptedProbes()
        self.overview = intercom_sync.project_overview({"stations": [station("st-a", "לובי ראשי"), station("st-b", "חניון", relays=(1,)), station("st-c", "מחסן")]})
        monkeypatch.setattr(intercom_sync.SYNC, "served", lambda _settings: ("ready", self.overview))
        monkeypatch.setattr(lv, "FEATURES_PROVIDER", lambda: fd.FeatureAdapters(fd.DirectFeatureClient(self.port), self.port))
        monkeypatch.setattr(lv, "INLINE", True)
        monkeypatch.setattr(lv, "POLL_GAP_S", 0.0)
        lv.set_probes(lambda _settings: self.probes)
        self.admin = self.principal("joni")
        with self.db.connection() as conn:  # st-a: two doors (crossed map), st-b: one door; st-c: no confirmed map
            fx.set_relay_map(conn, station_id="st-a", api_relay=1, physical_relay=2, confirmed_by=self.admin.user_id, expected_revision=0)
            fx.set_relay_map(conn, station_id="st-a", api_relay=2, physical_relay=1, confirmed_by=self.admin.user_id, expected_revision=0)
            fx.set_relay_map(conn, station_id="st-b", api_relay=1, physical_relay=1, confirmed_by=self.admin.user_id, expected_revision=0)

    def principal(self, username: str) -> Principal:
        self.c.get(f"{API}/me", headers=as_user(username))
        with self.db.connection(mode="read") as conn:
            row = conn.execute("SELECT id, username, display_name FROM users WHERE username=?", (username,)).fetchone()
        return Principal(user_id=row["id"], username=row["username"], display_name=row["display_name"] or "", source="ingress")

    def run(self, **body) -> dict[str, Any]:
        r = self.c.post(f"{API}/wiskey-validation/runs", json=body)
        assert r.status_code == 202, r.text
        v = self.c.get(f"{API}/wiskey-validation/runs/{r.json()['run_id']}")
        assert v.status_code == 200, v.text
        return v.json()

    def audit(self, action: str) -> list[dict[str, Any]]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action=? ORDER BY id", (action,)).fetchall()]

    def all_rows_text(self) -> str:
        with self.db.connection(mode="read") as conn:
            rows = conn.execute("SELECT * FROM wiskey_validation_results").fetchall() + conn.execute("SELECT * FROM wiskey_validation_runs").fetchall()
            audits = conn.execute("SELECT details_json FROM audit_log WHERE action LIKE 'wiskey.validation%'").fetchall()
        return json.dumps([list(r) for r in rows] + [list(a) for a in audits], ensure_ascii=False)


@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    yield e
    lv.set_probes(None)
    with lv._LOCK:
        lv._ACTIVE.clear()


def checks_of(view: dict[str, Any], sid: str) -> dict[str, dict[str, Any]]:
    st = next(s for s in view["stations"] if s["station_id"] == sid)
    return {c["check"]: c for c in st["checks"]}


# ================================================================ the read-only run

def test_one_station_passes_every_check_through_one_native_operation(env):
    view = env.run(station_id="st-a")
    assert view["state"] == "done" and view["scope"] == "one" and [s["station_id"] for s in view["stations"]] == ["st-a"]
    checks = checks_of(view, "st-a")
    assert list(checks) == list(lv.CHECKS)
    assert {k: (c["status"], c["reason"]) for k, c in checks.items()} == {k: ("pass", None) for k in lv.CHECKS}
    assert view["progress"] == {"done": 8, "total": 8} and view["counts"]["pass"] == 8
    starts = env.port.validation_starts()
    assert len(starts) == 1, "one live_validation operation per station"
    steps = starts[0]["policy_snapshot"]["private_input"]["steps"]
    assert [(s["step_id"], s["action"], s["physical_relay"]) for s in steps] == [
        ("identity", "identity", 1), ("door_capabilities-1", "door_capabilities", 1), ("door_read-1", "door_read", 1),
        ("door_capabilities-2", "door_capabilities", 2), ("door_read-2", "door_read", 2)]
    assert not any(s["action"] in ("pulse", "video", "two_way_audio") for s in steps), "read-only steps only"
    assert checks["door_capabilities"]["detail"]["doors"] == [{"door": 1, "result": "pass"}, {"door": 2, "result": "pass"}]
    assert env.port.pulses == []
    assert len(env.audit("wiskey.validation.run")) == 1 and len(env.audit("wiskey.validation.run.end")) == 1
    with env.db.connection(mode="read") as conn:
        assert fx.intent_state(conn, starts[0]["request"]["request_id"]) == "accepted"


def test_the_request_binds_the_owner_go_the_actor_and_the_confirmed_relay_map(env):
    env.run(station_id="st-a")
    start = env.port.validation_starts()[0]
    req, snap = start["request"], start["policy_snapshot"]
    assert req["feature"] == "live_validation" and sorted(req["params"]) == sorted(FIXTURE["requirements"])
    assert req["actor"] == {"kind": "human", "user_id": env.admin.user_id} and snap["actor_session_active"] is True
    go = snap["private_input"]["owner_go"]
    assert go["expiry"] == req["params"]["expiry"] and go["reference"] == req["params"]["owner_go_ref"] and go["approved"] is True
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00", go["expiry"]), "WisKey's canonical expiry form on both sides"
    assert {(s["station_id"], s["api_relay"], s["physical_relay"], s["mapping_revision"]) for s in snap["stations"]} == {("st-a", 1, 2, 1), ("st-a", 2, 1, 1)}
    assert set(lv.STEP_PERMISSION[a] for a in lv.WISKEY_CHECKS) | {"validation/run"} <= set(snap["permissions"])


def test_the_device_identity_in_the_receipt_is_never_stored_or_served(env):
    view = env.run(all=True)
    exported = env.c.get(f"{API}/wiskey-validation/runs/{view['id']}/export.csv").text
    assert SERIAL not in json.dumps(view) and SERIAL not in exported and SERIAL not in env.all_rows_text()


def test_a_failed_step_fails_and_the_steps_wiskey_aborted_are_not_run(env):
    env.port.phase_of["door_capabilities"] = "unknown"
    checks = checks_of(env.run(station_id="st-a"), "st-a")
    assert checks["identity"]["status"] == "pass"
    assert (checks["door_capabilities"]["status"], checks["door_capabilities"]["reason"]) == ("fail", "step_failed")
    assert (checks["door_read"]["status"], checks["door_read"]["reason"]) == ("not_run", "aborted_after_failure")
    assert checks["door_read"]["reason_text"] and "WisKey" in checks["door_read"]["reason_text"]
    assert checks["media_arx"]["status"] == "pass", "the Arx-side checks still run"
    with env.db.connection(mode="read") as conn:
        assert fx.intent_state(conn, env.port.validation_starts()[0]["request"]["request_id"]) == "unknown", "never settled as accepted"


def test_a_denied_identity_step_fails_and_nothing_after_it_passes(env):
    env.port.phase_of["identity"] = "denied"
    checks = checks_of(env.run(station_id="st-b"), "st-b")
    assert (checks["identity"]["status"], checks["identity"]["reason"]) == ("fail", "step_denied")
    assert checks["door_capabilities"]["status"] == checks["door_read"]["status"] == "not_run"


def test_a_station_without_a_confirmed_relay_map_is_not_run_and_nothing_is_sent(env):
    checks = checks_of(env.run(station_id="st-c"), "st-c")
    assert all((checks[c]["status"], checks[c]["reason"]) == ("not_run", "relay_map_missing") for c in lv.WISKEY_CHECKS)
    assert env.port.validation_starts() == []
    assert checks["media_arx"]["status"] == "pass"


def test_the_direct_join_off_is_not_run(env, monkeypatch):
    monkeypatch.setattr(lv, "FEATURES_PROVIDER", lambda: None)
    checks = checks_of(env.run(station_id="st-a"), "st-a")
    assert all((checks[c]["status"], checks[c]["reason"]) == ("not_run", "direct_join_off") for c in lv.WISKEY_CHECKS)
    env.port.connected = False
    monkeypatch.setattr(lv, "FEATURES_PROVIDER", lambda: fd.FeatureAdapters(fd.DirectFeatureClient(env.port), env.port))
    checks = checks_of(env.run(station_id="st-a"), "st-a")
    assert all((checks[c]["status"], checks[c]["reason"]) == ("not_run", "direct_join_off") for c in lv.WISKEY_CHECKS)
    assert env.port.validation_starts() == []
    with env.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM wiskey_feature_intents").fetchone()[0] == 0, "nothing stored before a link exists"


@pytest.mark.parametrize("blocker", FIXTURE["host_status_blockers"])
def test_a_host_that_cannot_run_the_feature_refuses_the_start_and_the_check_is_unsupported(env, blocker):
    env.port.start_script = [f"refuse:{blocker}"]
    checks = checks_of(env.run(station_id="st-a"), "st-a")
    assert all((checks[c]["status"], checks[c]["reason"]) == ("unsupported", blocker) for c in lv.WISKEY_CHECKS)
    assert checks["identity"]["reason_text"] != blocker, "a Hebrew line"


def test_features_status_is_never_read(env):
    """WisKey T06 (tests/test_t06_work_states_297.py): a static availability flag proves nothing; only the start answers."""
    env.port.status_answer = {"schema_version": 1, "features": {"live_validation": {"execution_available": False, "blocker": "feature_disabled"}}}
    checks = checks_of(env.run(all=True), "st-a")
    assert env.port.sent("features/status") == []
    assert all(checks[c]["status"] == "pass" for c in lv.WISKEY_CHECKS)
    _pulse(env)
    assert env.port.sent("features/status") == []


def test_a_closed_refusal_is_unsupported_or_failed_by_its_code(env):
    env.port.start_script = ["refuse:unknown_command"]
    checks = checks_of(env.run(station_id="st-a"), "st-a")
    assert all((checks[c]["status"], checks[c]["reason"]) == ("unsupported", "unknown_command") for c in lv.WISKEY_CHECKS)
    env.port.start_script = ["refuse:binding_denied"]
    checks = checks_of(env.run(station_id="st-a"), "st-a")
    assert all((checks[c]["status"], checks[c]["reason"]) == ("fail", "binding_denied") for c in lv.WISKEY_CHECKS)


@pytest.mark.parametrize("mode", ["unknown", "running", "lost"])
def test_no_final_result_is_a_fail_never_a_pass(env, monkeypatch, mode):
    monkeypatch.setattr(lv, "RESULT_WAIT_S", 0.0)
    env.port.result_mode = mode
    checks = checks_of(env.run(station_id="st-a"), "st-a")
    assert all((checks[c]["status"], checks[c]["reason"]) == ("fail", "result_unknown") for c in lv.WISKEY_CHECKS)


def test_a_lost_start_answer_is_a_fail_and_the_request_is_never_resent(env):
    env.port.start_script = ["timeout"]
    checks = checks_of(env.run(station_id="st-a"), "st-a")
    assert all((checks[c]["status"], checks[c]["reason"]) == ("fail", "start_unknown") for c in lv.WISKEY_CHECKS)
    assert len(env.port.sent("features/start")) == 1


def test_a_policy_without_the_validation_permissions_is_not_run(env, monkeypatch):
    real = fx.resolve_policy

    def without(conn, principals, *, feature, targets):
        doc = real(conn, principals, feature=feature, targets=targets)
        return fx.PolicyDocument(doc.feature, doc.complete, frozenset(doc.permissions - {"validation/door_read"}), doc.stations, doc.why_incomplete)

    monkeypatch.setattr(fx, "resolve_policy", without)
    checks = checks_of(env.run(station_id="st-a"), "st-a")
    assert all((checks[c]["status"], checks[c]["reason"]) == ("not_run", "permission_missing") for c in lv.WISKEY_CHECKS)
    assert checks["identity"]["detail"]["missing"] == ["validation/door_read"]
    assert env.port.validation_starts() == []


def test_run_all_validates_each_station_once_and_never_pulses(env):
    view = env.run(all=True)
    assert view["scope"] == "all" and [s["station_id"] for s in view["stations"]] == ["st-a", "st-b", "st-c"]
    starts = env.port.validation_starts()
    assert [s["policy_snapshot"]["stations"][0]["station_id"] for s in starts] == ["st-a", "st-b"], "st-c has no relay map"
    assert not any(st["action"] == "pulse" for s in starts for st in s["policy_snapshot"]["private_input"]["steps"])
    assert env.port.pulses == []
    assert len({s["request"]["request_id"] for s in starts}) == 2


def test_the_arx_side_outcomes_are_kept_as_given(env):
    env.probes.answers = {"media_wiskey": lv.unsupported("not_listed"), "talk": lv.failed("provider_local"), "media_arx": lv.failed("no_host")}
    checks = checks_of(env.run(station_id="st-a"), "st-a")
    assert (checks["media_wiskey"]["status"], checks["media_wiskey"]["reason"]) == ("unsupported", "not_listed")
    assert checks["media_wiskey"]["status_text"] == "לא נתמך ב-WisKey"
    assert (checks["talk"]["status"], checks["talk"]["reason"]) == ("fail", "provider_local")
    assert checks["events"]["status"] == checks["clock"]["status"] == "pass"
    assert checks["clock"]["detail"]["skew_seconds"] == 0.4
    assert [c for c in env.probes.calls if c[0] == "health"] == [("health", "st-a")], "one health read for events and clock"


def test_a_probe_that_raises_is_a_fail_with_no_exception_text(env):
    def boom(check, sid):
        if check == "talk":
            raise RuntimeError("rtsp://user:secret@192.0.2.9/stream")

    env.probes.hook = boom
    checks = checks_of(env.run(station_id="st-a"), "st-a")
    assert (checks["talk"]["status"], checks["talk"]["reason"]) == ("fail", "probe_error")
    assert "secret" not in env.all_rows_text()


def test_cancel_between_checks_leaves_the_rest_not_run(env):
    def cancel_at_media(check, sid):
        if check == "media_wiskey" and sid == "st-a":
            with env.db.connection() as conn:
                assert lv.request_cancel(conn, run_id())

    def run_id() -> str:
        with env.db.connection(mode="read") as conn:
            return conn.execute("SELECT id FROM wiskey_validation_runs ORDER BY rowid DESC LIMIT 1").fetchone()[0]

    env.probes.hook = cancel_at_media
    view = env.run(all=True)
    assert view["state"] == "cancelled"
    a = checks_of(view, "st-a")
    assert a["media_wiskey"]["status"] == "pass" and (a["talk"]["status"], a["talk"]["reason"]) == ("not_run", "cancelled")
    assert all(c["status"] == "not_run" and c["reason"] == "cancelled" for c in checks_of(view, "st-b").values())
    assert len(env.port.validation_starts()) == 1, "st-b was never started"
    assert json.loads(env.audit("wiskey.validation.run.end")[-1]["details_json"])["state"] == "cancelled"


def test_only_one_run_at_a_time(env):
    with lv._LOCK:
        lv._ACTIVE["lv_" + "0" * 32] = None
    r = env.c.post(f"{API}/wiskey-validation/runs", json={"station_id": "st-a"})
    assert r.status_code == 409 and r.json()["code"] == "run_in_progress"
    assert env.audit("wiskey.validation.run")[-1]["decision"] == "denied"
    assert env.c.get(f"{API}/wiskey-validation").json()["active_run_id"] == "lv_" + "0" * 32


def test_a_run_cut_by_a_restart_is_closed_as_interrupted_and_never_resumed(env):
    with env.db.connection() as conn:
        rid = lv.create_run(conn, kind="checks", scope="all", stations=[("st-a", "לובי ראשי")], actor=env.admin)
        lv.save_outcome(conn, rid, "st-a", "identity", lv.passed())
    body = env.c.get(f"{API}/wiskey-validation").json()
    assert body["active_run_id"] is None
    view = env.c.get(f"{API}/wiskey-validation/runs/{rid}").json()
    assert view["state"] == "interrupted"
    checks = checks_of(view, "st-a")
    assert checks["identity"]["status"] == "pass" and all(checks[c]["status"] == "not_run" and checks[c]["reason"] == "interrupted" for c in lv.CHECKS[1:])
    assert env.port.calls == [], "nothing was resumed or sent"


def test_nothing_runs_by_itself(env, settings):
    TestClient(create_app(settings)).get(f"{API}/me")  # a second start of the app
    with env.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM wiskey_validation_runs").fetchone()[0] == 0
    assert env.port.calls == []
    src = (REPO / "smplwise_vms" / "backend" / "smplwise" / "services" / "wiskey_live_validation.py").read_text(encoding="utf-8")
    assert "Timer(" not in src and "schedule" not in src.lower().replace("scheduled", "")
    main = (REPO / "smplwise_vms" / "backend" / "smplwise" / "main.py").read_text(encoding="utf-8")
    assert [ln for ln in main.splitlines() if "wiskey_validation" in ln or "wiskey_live_validation" in ln] == [
        "    from .routers import wiskey_validation as wiskey_validation_router  # WISKEY-LIVE-VALIDATION-2390: station acceptance runs (on demand only)",
        '    app.include_router(wiskey_validation_router.router, prefix=api, tags=["access-control"])']


# ================================================================ the page, the gate, the export

def _manager(env: Env, user: str) -> None:
    r = env.c.post(f"{API}/access/roles", json={"name": f"מנהל עמדות {user}", "description": "lv test", "permissions": ["access.read"],
                                                "sensitive": ["access.stations.manage", "access.doors.open"]})
    assert r.status_code == 201, r.text
    bind(env.c, env.settings, user, r.json()["id"], "installation", "*")


def test_the_page_lists_the_stations_checks_doors_and_rights(env):
    body = env.c.get(f"{API}/wiskey-validation").json()
    assert [c["key"] for c in body["checks"]] == list(lv.CHECKS)
    st = {s["id"]: s for s in body["stations"]}
    assert st["st-a"]["doors"] == [{"door": 1, "name": "דלת 1"}, {"door": 2, "name": "דלת 2"}] and st["st-c"]["doors"] == []
    assert st["st-a"]["can_pulse"] is True and st["st-c"]["can_pulse"] is False
    assert body["rights"] == {"run": True, "pulse": True, "pulse_local": True} and body["feed_state"] == "ready"


def test_without_stations_manage_everything_is_an_audited_403(env):
    env.c.get(f"{API}/me", headers=as_user("viewer1"))
    for method, path, body in (("get", "/wiskey-validation", None), ("post", "/wiskey-validation/runs", {"all": True}),
                               ("post", "/wiskey-validation/pulse", {"station_id": "st-a", "door": 1, "confirm_text": "לובי ראשי", "witness_name": "דנה"})):
        r = getattr(env.c, method)(f"{API}{path}", headers=as_user("viewer1"), **({"json": body} if body else {}))
        assert r.status_code == 403, (path, r.text)
    assert len(env.audit("access.stations.manage")) >= 3
    assert env.port.calls == []


def test_a_station_manager_runs_checks_but_may_not_pulse(env):
    _manager(env, "dana")
    body = env.c.get(f"{API}/wiskey-validation", headers=as_user("dana")).json()
    assert body["rights"]["pulse"] is False and not any(s["can_pulse"] for s in body["stations"])
    r = env.c.post(f"{API}/wiskey-validation/runs", json={"station_id": "st-b"}, headers=as_user("dana"))
    assert r.status_code == 202, r.text
    r = env.c.post(f"{API}/wiskey-validation/pulse", headers=as_user("dana"),
                   json={"station_id": "st-b", "door": 1, "confirm_text": "חניון", "witness_name": "דנה כהן"})
    assert r.status_code == 403
    assert env.audit("wiskey.validation.pulse")[-1]["reason"] == "not_system_admin" and env.port.pulses == []


def test_the_body_is_closed(env):
    for bad in ({}, {"all": True, "station_id": "st-a"}, {"station_id": "st-a", "extra": 1}, {"station_id": "../x"}):
        assert env.c.post(f"{API}/wiskey-validation/runs", json=bad).status_code == 422, bad
    assert env.c.post(f"{API}/wiskey-validation/runs", json={"station_id": "st-zzz"}).status_code == 404
    assert env.c.get(f"{API}/wiskey-validation/runs/lv_nothex").status_code == 422
    assert env.c.get(f"{API}/wiskey-validation/runs/lv_{'a' * 32}").status_code == 404


def test_the_csv_export_is_the_acceptance_record_and_is_audited(env):
    env.overview = intercom_sync.project_overview({"stations": [station("st-a", "=HYPERLINK(1)")]})
    view = env.run(station_id="st-a")
    r = env.c.get(f"{API}/wiskey-validation/runs/{view['id']}/export.csv")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv") and "attachment" in r.headers["content-disposition"]
    text = r.content.decode("utf-8")
    assert text.startswith("\ufeff") and "זהות העמדה" in text and "עבר" in text
    assert "'=HYPERLINK(1)" in text, "a cell never starts a formula"
    assert len(text.strip().splitlines()) == 1 + len(lv.CHECKS)
    assert env.audit("wiskey.validation.export")[-1]["resource_id"] == view["id"]


def test_the_run_list_shows_counts(env):
    env.run(station_id="st-a")
    env.port.phase_of["identity"] = "unknown"
    env.run(station_id="st-b")
    runs = env.c.get(f"{API}/wiskey-validation").json()["runs"]
    assert [r["state"] for r in runs] == ["done", "done"]
    assert runs[0]["counts"]["fail"] == 1 and runs[0]["counts"]["not_run"] == 2 and runs[1]["counts"]["pass"] == 8


# ================================================================ the door pulse (physical: fake door only)

def _pulse(env: Env, **kw) -> Any:
    body = {"station_id": "st-a", "door": 1, "confirm_text": "לובי ראשי", "witness_name": "דנה כהן", **kw}
    return env.c.post(f"{API}/wiskey-validation/pulse", json=body)


def test_a_confirmed_pulse_sends_one_pulse_step_and_waits_for_the_witness(env):
    parent = env.run(station_id="st-a")
    r = _pulse(env, parent_run_id=parent["id"])
    assert r.status_code == 200, r.text
    res = r.json()["result"]
    assert (res["status"], res["reason"]) == ("pending", "awaiting_witness") and res["detail"]["witness_name"] == "דנה כהן"
    pulse_starts = [s for s in env.port.validation_starts() if s["policy_snapshot"]["private_input"]["steps"][0]["action"] == "pulse"]
    assert len(pulse_starts) == 1
    steps = pulse_starts[0]["policy_snapshot"]["private_input"]["steps"]
    assert [(s["action"], s["physical_relay"]) for s in steps] == [("pulse", 1)], "exactly ONE pulse of the chosen door"
    assert [(s["station_id"], s["physical_relay"]) for s in pulse_starts[0]["policy_snapshot"]["stations"]] == [("st-a", 1)]
    assert env.port.pulses == [("st-a", 1)]
    run_id = r.json()["run_id"]
    w = env.c.post(f"{API}/wiskey-validation/pulse/{run_id}/witness", json={"verdict": "opened"})
    assert w.status_code == 200 and w.json()["status"] == "pass"
    assert env.c.post(f"{API}/wiskey-validation/pulse/{run_id}/witness", json={"verdict": "opened"}).status_code == 409, "one verdict"
    view = env.c.get(f"{API}/wiskey-validation/runs/{parent['id']}").json()
    pulse = view["pulses"][0]["stations"][0]["checks"][0]
    assert pulse["status"] == "pass" and pulse["detail"]["witness"] == "opened"
    again = _pulse(env, parent_run_id=parent["id"])
    assert again.status_code == 409 and again.json()["code"] == "pulse_already_done"
    assert env.port.pulses == [("st-a", 1)], "never a second pulse in the same run"
    actions = [a["action"] for a in env.audit("wiskey.validation.pulse")] + [a["action"] for a in env.audit("wiskey.validation.pulse.result")] + \
        [a["action"] for a in env.audit("wiskey.validation.witness")]
    assert actions == ["wiskey.validation.pulse", "wiskey.validation.pulse", "wiskey.validation.pulse.result", "wiskey.validation.witness"]
    csv_text = env.c.get(f"{API}/wiskey-validation/runs/{parent['id']}/export.csv").text
    assert "פתיחת דלת עם עד" in csv_text and "דנה כהן" in csv_text


@pytest.mark.parametrize("verdict,reason", [("not_opened", "witness_not_opened"), ("unsure", "witness_unsure")])
def test_a_witness_who_did_not_see_the_door_open_fails_the_pulse(env, verdict, reason):
    run_id = _pulse(env).json()["run_id"]
    w = env.c.post(f"{API}/wiskey-validation/pulse/{run_id}/witness", json={"verdict": verdict})
    assert (w.json()["status"], w.json()["reason"]) == ("fail", reason)


def test_an_unacknowledged_pulse_fails_and_takes_no_witness(env):
    env.port.phase_of["pulse"] = "unknown"
    r = _pulse(env)
    res = r.json()["result"]
    assert (res["status"], res["reason"]) == ("fail", "step_failed") and env.port.pulses == []
    assert env.c.post(f"{API}/wiskey-validation/pulse/{r.json()['run_id']}/witness", json={"verdict": "opened"}).status_code == 409


def test_the_typed_confirmation_must_be_the_station_name(env):
    for typed in ("לובי", "לובי ראשי!", "st-a"):
        r = _pulse(env, confirm_text=typed)
        assert r.status_code == 422 and r.json()["code"] == "confirmation_mismatch", typed
    assert env.audit("wiskey.validation.pulse")[-1]["reason"] == "confirmation_mismatch"
    assert _pulse(env, confirm_text="  לובי ראשי ").status_code == 200, "surrounding spaces are not part of the name"
    assert env.port.pulses == [("st-a", 1)]


def test_a_witness_name_is_required(env):
    for name in ("", "א", "\x01ab"):
        assert _pulse(env, witness_name=name).status_code == 422
    assert env.port.calls == []


def test_a_pulse_of_an_unmapped_door_or_a_station_without_a_map_sends_nothing(env):
    res = _pulse(env, station_id="st-b", door=2, confirm_text="חניון").json()["result"]
    assert (res["status"], res["reason"]) == ("not_run", "door_not_mapped")
    res = _pulse(env, station_id="st-c", confirm_text="מחסן").json()["result"]
    assert (res["status"], res["reason"]) == ("not_run", "door_not_mapped")
    assert env.port.validation_starts() == [] and env.port.pulses == []


def test_no_pulse_while_a_run_is_in_progress(env):
    with lv._LOCK:
        lv._ACTIVE["lv_" + "1" * 32] = None
    r = _pulse(env)
    assert r.status_code == 409 and r.json()["code"] == "run_in_progress" and env.port.calls == []


def test_a_pulse_through_the_remote_channel_is_refused(env):
    remote = Principal(user_id=env.admin.user_id, username=env.admin.username, display_name="", source="remote")
    env.app.dependency_overrides[current_principal_ro] = lambda: remote
    try:
        r = _pulse(env)
    finally:
        env.app.dependency_overrides.clear()
    assert r.status_code == 403 and r.json()["code"] == "local_only" and env.port.calls == []
    assert env.audit("wiskey.validation.pulse")[-1]["reason"] == "remote_session"


def test_a_pulse_without_door_permission_on_the_station_is_refused(env, monkeypatch):
    from smplwise.services import intercom_authority as ia

    real = ia.Authority.station
    monkeypatch.setattr(ia.Authority, "station", lambda self, p, sid: False if p == ia.DOORS_OPEN else real(self, p, sid))
    r = _pulse(env)
    assert r.status_code == 403 and env.audit("wiskey.validation.pulse")[-1]["reason"] == "no_door_permission" and env.port.calls == []


# ================================================================ Arx's own probes (the real ArxProbes against the intercom_media fakes)

def test_events_outcomes():
    ok = {"events": {"stream": "connected"}}
    assert lv.events_outcome(ok, "wiskey", "ready").status == "pass"
    assert lv.events_outcome(ok, "wiskey", "connecting").reason == "arx_feed_not_ready"
    for stream in ("disconnected", "unavailable", "stopped", "authentication_failed", "connecting"):
        assert lv.events_outcome({"events": {"stream": stream}}, "feed", "ready").reason == "stream_" + stream
    assert lv.events_outcome({"events": {"stream": "unknown"}}, "feed", "ready").reason == "stream_unknown"
    assert lv.events_outcome(None, "none", "ready").status == lv.events_outcome({"events": None}, "wiskey", "ready").status == "unsupported"


@pytest.mark.parametrize("clock,status,reason", [
    ({"skew_seconds": 1.9, "drift_state": "within_tolerance"}, "pass", None),
    ({"skew_seconds": -2.0}, "pass", None),
    ({"skew_seconds": 2.5, "drift_state": "within_tolerance"}, "fail", "skew_over_tolerance"),
    ({"skew_seconds": 0.1, "drift_state": "repeated_ahead"}, "fail", "drift_repeated_ahead"),
    ({"skew_seconds": None, "drift_state": "behind"}, "fail", "drift_behind"),
    ({"skew_seconds": None, "drift_state": "within_tolerance"}, "pass", None),
    ({"skew_seconds": None, "drift_state": "not_measured"}, "not_run", "not_measured"),
    ({"status": "unavailable", "skew_seconds": 0.0}, "fail", "clock_unavailable"),
])
def test_clock_outcomes(clock, status, reason):
    out = lv.clock_outcome({"clock": clock}, "wiskey")
    assert (out.status, out.reason) == (status, reason)
    assert lv.clock_outcome({"clock": None}, "wiskey").status == "unsupported"


class _Auth:
    def __init__(self, call: bool = True) -> None:
        self.call = call

    def station(self, permission, sid):
        return self.call


def _set_media(env: Env, mode: str, provider: str = "local") -> None:
    with env.db.connection() as conn:
        from smplwise.db import set_setting

        set_setting(conn, im.MEDIA_SETTING, mode)
        set_setting(conn, im.PROVIDER_KEY, provider)


def test_talk_probe_reasons(env):
    probes = lv.ArxProbes(env.settings)
    st = {"id": "st-a", "online": True, "camera_entity": "camera.st_a"}
    _set_media(env, "video")
    with env.db.connection(mode="read") as conn:
        assert (probes.talk(conn, _Auth(), st).status, probes.talk(conn, _Auth(), st).reason) == ("not_run", "talk_setting_off")
    _set_media(env, "video_talk", "local")
    with env.db.connection(mode="read") as conn:
        assert probes.talk(conn, _Auth(), st).reason == "provider_local"
        assert probes.talk(conn, _Auth(), {**st, "online": False}).reason == "offline"
    fake = im.FakeProvider()
    im.set_provider(fake)
    try:
        im.MEDIA.reset() if hasattr(im.MEDIA, "reset") else None
        with env.db.connection(mode="read") as conn:
            out = probes.talk(conn, _Auth(), st)
            assert out.status == "pass" and out.detail["transport"] == "pcmu_frames" and out.detail["provider"] == "fake"
            assert probes.talk(conn, _Auth(call=False), st).reason == "forbidden"
        fake.talk = False
        im.MEDIA.forget("fake", "st-a")
        with env.db.connection(mode="read") as conn:
            assert (probes.talk(conn, _Auth(), st).status, probes.talk(conn, _Auth(), st).reason) == ("unsupported", "talk_unsupported")
    finally:
        im.set_provider(None)
        im.MEDIA.forget("fake", "st-a")


def test_talk_probe_on_auto_without_the_wiskey_talk_commands_is_unsupported(env, monkeypatch):
    probes = lv.ArxProbes(env.settings)
    _set_media(env, "video_talk", "auto")
    monkeypatch.setattr(im, "_feed_discovery", lambda settings: {"version": 1, "min_client": 1, "commands": frozenset()})
    with env.db.connection(mode="read") as conn:
        out = probes.talk(conn, _Auth(), {"id": "st-a", "online": True})
    assert (out.status, out.reason) == ("unsupported", "wiskey_talk_not_listed") and out.detail["why"] == "not_listed"


JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64 + b"\xff\xd9"


def test_media_arx_probe(env, monkeypatch):
    from smplwise.services import go2rtc

    probes = lv.ArxProbes(env.settings)
    st = {"id": "st-a", "online": True, "camera_entity": "camera.st_a"}
    with env.db.connection(mode="read") as conn:
        assert probes.media_arx(conn, {**st, "online": False}).reason == "offline"
        assert probes.media_arx(conn, st).reason in ("no_media", "no_host"), "no go2rtc / no host in a test backend"
    monkeypatch.setattr(im._local, "describe", lambda conn, settings, station: None)
    monkeypatch.setattr(im._local, "video_stream", lambda conn, settings, station, profile, actor=None: "smplwise_wiskey_st_a")
    frame = {"data": JPEG}

    class FakeGo2rtc:
        def __init__(self, settings):
            pass

        def frame_existing(self, name):
            assert name.startswith("smplwise_")
            return frame["data"]

    monkeypatch.setattr(go2rtc, "Go2rtc", FakeGo2rtc)
    with env.db.connection(mode="read") as conn:
        out = probes.media_arx(conn, st)
    assert out.status == "pass" and out.detail == {"source": "arx", "bytes": len(JPEG)}
    frame["data"] = b"<html>"
    with env.db.connection(mode="read") as conn:
        assert probes.media_arx(conn, st).reason == "frame_error"


def test_media_wiskey_probe_reasons(env, monkeypatch):
    probes = lv.ArxProbes(env.settings)
    st = {"id": "st-a", "online": True}
    _set_media(env, "video", "local")
    with env.db.connection(mode="read") as conn:
        assert (probes.media_wiskey(conn, st).status, probes.media_wiskey(conn, st).reason) == ("not_run", "provider_local")
    _set_media(env, "video", "auto")
    monkeypatch.setattr(im, "_feed_discovery", lambda settings: {"version": 1, "min_client": 1, "commands": frozenset()})
    with env.db.connection(mode="read") as conn:
        assert (probes.media_wiskey(conn, st).status, probes.media_wiskey(conn, st).reason) == ("unsupported", "not_listed")
    monkeypatch.setattr(im, "_feed_discovery", lambda settings: None)
    with env.db.connection(mode="read") as conn:
        assert probes.media_wiskey(conn, st).reason == "discovery_unknown"


def test_health_probe_falls_back_to_the_feed_copy(env, monkeypatch):
    from smplwise.services import intercom_adapter as adapter

    probes = lv.ArxProbes(env.settings)
    monkeypatch.setattr(adapter.ADAPTER, "health", lambda settings, auth, sid: (_ for _ in ()).throw(RuntimeError("404")))
    monkeypatch.setattr(adapter.ADAPTER, "station", lambda settings, auth, sid: {"station": {"technical": {"event_status": {"stream": "connected"},
                                                                                                         "clock": {"skew_seconds": 0.2}}}})
    h, source = probes.health(_Auth(), "st-a")
    assert source == "feed" and h["events"]["stream"] == "connected" and lv.clock_outcome(h, source).status == "pass"


# ================================================================ the contract facts (rc.10 fixture, the pin when present)

def test_the_module_follows_the_rc10_facts():
    assert list(fx.REQUIREMENTS["live_validation"]) == FIXTURE["requirements"]
    assert lv.KIND == FIXTURE["private_input"]["kind"]
    for action in ("identity", "door_capabilities", "door_read", "pulse"):
        assert lv.STEP_PERMISSION[action] == FIXTURE["permissions"][action]
        assert lv.OBSERVATION[action] == FIXTURE["observations"][action]
    assert lv.RUN_PERMISSION == FIXTURE["permissions"]["run"]
    assert sorted(lv.RECEIPT_KEYS) == FIXTURE["receipt_keys"] and sorted(lv.STEP_KEYS) == FIXTURE["step_record_keys"]
    assert lv.PHASES == set(FIXTURE["phases"])
    assert set(FIXTURE["host_status_blockers"]) <= lv.UNSUPPORTED_CODES
    assert fd.SPECS["live_validation"].needs_targets is True, "WisKey's coordinator needs 1..64 granted targets"
    assert set(fx.PERMISSIONS_OF_FEATURE["live_validation"]) >= {FIXTURE["permissions"][k] for k in ("run", "identity", "door_capabilities", "door_read", "pulse")}
    assert set(fd.COMMANDS) <= set(FIXTURE["feature_commands"])


def test_the_rc10_pin_lists_the_feature_commands_when_it_is_in_the_tree():
    surface = REPO / "docs" / "integrations" / "wiskey" / "catalog" / "rc10-extract" / "surface.static.json"
    if not surface.exists():
        pytest.skip("rc10-extract is not in this tree (it lands with pilot/WISKEY-RC10-PIN-2382)")
    data = json.loads(surface.read_text(encoding="utf-8"))
    assert data["registries"]["features"]["commands"] == FIXTURE["feature_commands"]


def test_the_receipt_reader_is_closed():
    good = {"original": {}, "owner_go": {}, "checklist_ref": "c", "physical_result": "unknown", "human_witness": "unknown", "replay_available": False,
            "steps": [{"step_id": "identity", "action": "identity", "target": {"identity": SERIAL}, "phase": "acknowledged", "observation": {"identity_matched": True}}]}
    assert lv.read_receipt(good) == {"identity": ("acknowledged", {"identity_matched": True})}
    for bad in ({**good, "extra": 1}, {**good, "physical_result": "opened"}, {**good, "human_witness": "seen"}, {**good, "replay_available": True},
                {**good, "steps": []}, {**good, "steps": [{**good["steps"][0], "phase": "done"}]}, {**good, "steps": good["steps"] * 2}):
        with pytest.raises(ValueError):
            lv.read_receipt(bad)
    assert lv.step_outcome("identity", "acknowledged", {"identity_matched": False}).reason == "observation_mismatch"


def test_every_reason_code_the_module_emits_has_a_hebrew_line():
    src = (REPO / "smplwise_vms" / "backend" / "smplwise" / "services" / "wiskey_live_validation.py").read_text(encoding="utf-8")
    emitted = set(re.findall(r'(?:failed|not_run|unsupported|passed)\("([a-z_]*[a-z])"', src)) | set(FIXTURE["host_status_blockers"])
    # the codes built from a prefix ("drift_" + state, "stream_" + state, "witness_" + verdict) are listed one by one
    emitted |= {"drift_" + d for d in ("ahead", "behind", "repeated_ahead", "repeated_behind")}
    emitted |= {"stream_" + x for x in ("connecting", "disconnected", "unavailable", "stopped", "authentication_failed")}
    emitted |= {"witness_" + v for v in ("not_opened", "unsure")}
    missing = sorted(c for c in emitted if c not in lv.REASON_TEXT)
    assert missing == []
    assert not any("Home Assistant" in t for t in lv.REASON_TEXT.values())
