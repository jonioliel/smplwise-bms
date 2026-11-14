"""WISKEY-SCHED-WRITE-2390 (plan 2026-11-03 T7): the device schedule library's write side, end to end over the add-on's live service
session against a fake WisKey that keeps rc.10's schedule stores STATEFULLY (library, imports, plans, claims, baselines, jobs - modelled
on `access/schedules.py`, `access/schedule_plans.py`, `access/schedule_operations.py`, `access/schedule_baselines.py`,
`schedule_plan_api.py`, `schedule_operations_api.py` of ref origin/codex/wiskey-mac-m12-policy-b-2026-11-02). Nothing contacts a device,
a station, Home Assistant or WisKey.

What is proven, per command family:
- the exact frames on the closed `schedules` channel (catalog keys, `api_contract` on the non-READ commands only);
- the gate: the schedules administrator only (`access.schedules.manage` unrestricted or `system.configure`), audited 403 otherwise;
- preview -> apply: `create` / `update` need a successful `check` of the same draft by the same user; `import_apply`, `plan_save`,
  `claim_confirm`, `baseline_save` need their preview (one use, this user's); WisKey's tokens never reach a browser;
- refusals: "WisKey סירב: <reason>" with WisKey's code (`revision_conflict`, `unauthorized`, `schedule_limit` ...), nothing stored;
- not sent: no confirmation, a duplicate envelope, an invalid draft (WisKey's own code), an offline station, Arx's limits;
- unknown: a write WisKey did not answer in time - `unknown`, never "done";
- deploy: several plans at once - one queued and followed to WisKey's `blocked` (`schedule_writes_unverified`), one whose preflight
  fails at the station (`authentication_failed`), one refused before sending (stale revision): a partial result, honestly per station;
- the impact: the station, its doors and WisKey's anonymous user counts;
- the audit rows: attempt + outcome, the actor, the resource and WisKey's code; never a token or a window."""
from __future__ import annotations

import copy
import json
import time
import uuid
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey import PREFIX, FakeWiskey, fail, ok
from fastapi.testclient import TestClient
from intercom_station_scope import station_scope  # noqa: F401 - a fixture

from smplwise.db import Database
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_sync, wiskey_channels
from smplwise.services import wiskey_schedule_writes as sw

API = "/api/v1/access-control/schedules"
DAYS = sw.DAYS
NOW = "2026-11-03T08:00:00+00:00"


def week(**days: list[tuple[str, str]]) -> dict[str, list[dict[str, str]]]:
    return {d: [{"start": a, "end": b} for a, b in days.get(d, [])] for d in DAYS}


OFFICE = {"name": "Office hours", "weekly": week(Sunday=[("07:00", "18:00")], Monday=[("07:00", "18:00")], Tuesday=[("07:00", "12:00"), ("13:00", "18:00")]),
          "holidays": []}
HOLIDAY = {"name": "Holidays", "weekly": week(Monday=[("08:00", "16:00")]),
           "holidays": [{"name": "Passover", "start": "2027-04-21", "end": "2027-04-28", "periods": [{"start": "09:00", "end": "12:00"}]}]}
CAPS = {
    "template": {"ids": [1, 255], "name_length": [1, 32], "week_ids": [1, 255], "group_ids": [1, 64]},
    "weekly": {"ids": [1, 255], "period_ids": [1, 8], "max_periods": 56, "precision": "minute", "weekdays": list(DAYS)},
    "holiday_group": {"ids": [1, 64], "name_length": [1, 32], "holiday_ids": [1, 255]},
    "holiday": {"ids": [1, 255], "period_ids": [1, 8], "max_periods": 8, "precision": "minute"},
}


class SchedFake(FakeWiskey):
    """FakeWiskey with rc.10's schedule stores. One WisKey actor (the add-on's identity), as in production. Switches:
    `preflight_fail` (station ids whose job preflight fails with `authentication_failed`), `silent` (commands that never answer),
    `fail_with` ({command: code} answered once), `library_full`."""

    def __init__(self, *a: Any, **kw: Any) -> None:
        super().__init__(*a, **kw)
        self.library: dict[str, dict[str, Any]] = {}
        self.imports: dict[str, dict[str, Any]] = {}
        self.plans: dict[str, dict[str, Any]] = {}
        self.pending_plans: dict[str, dict[str, Any]] = {}
        self.claims: dict[str, dict[str, Any]] = {}
        self.pending_claims: dict[str, dict[str, Any]] = {}
        self.jobs: dict[str, dict[str, Any]] = {}
        self.archive: list[dict[str, Any]] = []
        self.baselines: dict[str, dict[str, Any]] = {}
        self.pending_baselines: dict[str, str] = {}
        self.preflight_fail: set[str] = set()
        self.fail_with: dict[str, str] = {}
        self.library_full = False
        self.tokens_issued: list[str] = []

    # -------------------------------------------------------- helpers
    def _token(self) -> str:
        t = uuid.uuid4().hex
        self.tokens_issued.append(t)
        return t

    def _station(self, msg: dict[str, Any]) -> str | None:
        sid = msg.get("station_id")
        if sid not in {s["id"] for s in self.overview["stations"]}:
            return "station_not_found"
        if sid in self.offline or not next(s for s in self.overview["stations"] if s["id"] == sid).get("online"):
            return "station_offline"
        return None

    def _report(self, draft: dict[str, Any], bindings: dict[str, Any]) -> dict[str, Any]:
        rows = [{"kind": "weekly", "id": bindings["weekly"], "coverage": "complete", "state": "different", "fields": ["WeekPlanCfg"], "active": False,
                 "externally_referenced": False},
                {"kind": "template", "id": bindings["template"], "coverage": "complete", "state": "not_observed", "fields": [], "active": None,
                 "externally_referenced": False}]
        blockers = ["schedule_writes_unverified", "schedule_ownership_unknown"]
        if draft["holidays"]:
            blockers.append("schedule_plan_holiday_membership_unknown")
        return {"checked_at": NOW, "can_apply": False, "blockers": blockers, "resources": rows,
                "users": {"state": "complete", "error": None, "read": 412, "explicit": 37, "implicit": 4, "malformed": 0}}

    def _inventory(self) -> list[dict[str, Any]]:
        return [{"kind": k, "state": "complete", "error": None, "capabilities": copy.deepcopy(v), "search": None, "read": 3, "total": 3, "pages": 1,
                 "enabled": 3, "disabled": 0, "referenced": 1} for k, v in CAPS.items()]

    def _public_plan(self, p: dict[str, Any], details: bool = False) -> dict[str, Any]:
        out = {k: copy.deepcopy(p[k]) for k in ("id", "revision", "station_id", "draft_id", "draft_revision", "bindings", "drifted_resources", "created_at", "report")}
        out.update(name=p["draft"]["name"], can_apply=False)
        src = self.library.get(p["draft_id"])
        out["source_state"] = "missing" if src is None else "current" if src["revision"] == p["draft_revision"] else "changed"
        if details:
            out["candidates"] = [{"key": f"weekly:{p['bindings']['weekly']}", "kind": "weekly", "id": p["bindings"]["weekly"], "dependencies": [], "body": {"x": 1}},
                                 {"key": f"template:{p['bindings']['template']}", "kind": "template", "id": p["bindings"]["template"],
                                  "dependencies": [f"weekly:{p['bindings']['weekly']}"], "body": {"x": 1}}]
        return out

    # -------------------------------------------------------- the responder
    def _answer(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
        if not command.startswith("schedules/"):
            return super()._answer(command, msg, auth)
        if command in self.silent_commands:
            return []  # never answers: the client's own timeout decides
        if command in self.fail_with:
            return [fail(msg, self.fail_with.pop(command))]
        try:
            return [ok(msg, self._schedules(command, msg))]
        except _Refuse as exc:
            return [fail(msg, exc.code)]

    silent_commands: set[str] = set()

    def _schedules(self, command: str, msg: dict[str, Any]) -> Any:  # noqa: C901 - one branch per command, as WisKey's dispatcher
        lib = self.library
        if command == "schedules/list":
            return sorted(copy.deepcopy(list(lib.values())), key=lambda s: s["name"].casefold())
        if command == "schedules/preview":
            draft = _norm(msg["data"])
            day = datetime.fromisoformat(msg["date"]).date()
            name = DAYS[day.weekday()]
            hol = next((h for h in draft["holidays"] if h["start"] <= msg["date"] <= h["end"]), None)
            periods = hol["periods"] if hol else draft["weekly"][name]
            m = int(msg["time"][:2]) * 60 + int(msg["time"][3:])
            inside = any(int(p["start"][:2]) * 60 + int(p["start"][3:]) <= m < (1440 if p["end"] == "24:00" else int(p["end"][:2]) * 60 + int(p["end"][3:])) for p in periods)
            return {"date": msg["date"], "time": msg["time"], "weekday": name, "source": "holiday" if hol else "weekly", "holiday": hol["name"] if hol else None,
                    "periods": periods, "within_window": inside, "basis": "draft_local_time", "applied": False}
        if command == "schedules/create":
            if self.library_full:
                raise _Refuse("schedule_limit")
            draft = _norm(msg["data"])
            item = {**draft, "id": str(uuid.uuid4()), "revision": 1, "updated_at": NOW}
            lib[item["id"]] = item
            return copy.deepcopy(item)
        if command in ("schedules/update", "schedules/delete"):
            item = lib.get(msg["schedule_id"])
            if item is None:
                raise _Refuse("schedule_not_found")
            if msg["revision"] != item["revision"]:
                raise _Refuse("revision_conflict")
            if command == "schedules/delete":
                del lib[item["id"]]
                return {"deleted": True}
            item.update(_norm(msg["data"]), revision=item["revision"] + 1, updated_at=NOW)
            return copy.deepcopy(item)
        if command == "schedules/export":
            return {"format": "hikvision_intercom.schedule_drafts", "version": 1,
                    "schedules": [{k: s[k] for k in ("name", "weekly", "holidays")} for s in sorted(lib.values(), key=lambda s: s["name"].casefold())]}
        if command == "schedules/import_preview":
            try:
                doc = json.loads(msg["document"])
                assert set(doc) == {"format", "version", "schedules"} and doc["format"] == "hikvision_intercom.schedule_drafts" and doc["version"] == 1
                drafts = [_norm(s) for s in doc["schedules"]]
            except (ValueError, AssertionError, TypeError, KeyError):
                raise _Refuse("schedule_transfer_invalid") from None
            self.imports = {}  # one pending preview per actor - and every Arx operator is the same actor
            token = self._token()
            self.imports[token] = {"drafts": drafts, "versions": {k: v["revision"] for k, v in lib.items()}}
            names = {s["name"].casefold() for s in lib.values()}
            return {"token": token, "count": len(drafts), "name_collisions": sum(d["name"].casefold() in names for d in drafts), "expires_in": 300, "mode": "append",
                    "items": [{"name": d["name"], "weekly_periods": sum(map(len, d["weekly"].values())), "holidays": len(d["holidays"])} for d in drafts]}
        if command == "schedules/import_apply":
            pending = self.imports.pop(msg["token"], None)
            if pending is None:
                raise _Refuse("schedule_import_expired")
            if pending["versions"] != {k: v["revision"] for k, v in lib.items()}:
                raise _Refuse("revision_conflict")
            out = []
            for d in pending["drafts"]:
                item = {**d, "id": str(uuid.uuid4()), "revision": 1, "updated_at": NOW}
                lib[item["id"]] = item
                out.append(copy.deepcopy(item))
            return out
        if command in ("schedules/readiness", "schedules/dependencies", "schedules/assess"):
            if (code := self._station(msg)) is not None:
                raise _Refuse(code)
            inv = self._inventory()
            if command == "schedules/readiness":
                return {"checked_at": NOW, "can_apply": False, "reason": "schedule_writes_unverified", "sample_only": False, "read_method": "search",
                        "checks": [{"kind": c["kind"], "advertised": True, "capabilities": c["capabilities"], "sample_id": None, "read_state": "readable",
                                    "error": None, "coverage": "complete", "read": 3, "total": 3} for c in inv]}
            if command == "schedules/dependencies":
                return {"checked_at": NOW, "users_checked": True, "mapping_complete": False, "can_apply": False, "ownership_checked": False,
                        "users": {"state": "complete", "error": None, "read": 412, "explicit": 37, "implicit": 4, "malformed": 0},
                        "checks": [{"kind": "weekly", "coverage": "complete", "referenced": 2, "observed": 2, "not_observed": 0, "disabled": 0, "ids": [1, 2],
                                    "not_observed_ids": []}]}
            draft = _norm(msg["data"])
            token = self._token()
            self.pending_baselines[token] = msg["station_id"]
            base = self.baselines.get(msg["station_id"])
            return {"checked_at": NOW, "checks": inv, "complete": True, "can_apply": False, "ownership_checked": False, "users_checked": False,
                    "assessment": {"requirements": {"template": 1, "weekly": 1, "holiday_group": int(bool(draft["holidays"])), "holiday": len(draft["holidays"]),
                                                    "weekly_periods": sum(map(len, draft["weekly"].values()))},
                                   "limits": [{"key": "weekly_per_day", "needed": max(map(len, draft["weekly"].values())), "available": 8, "state": "fits"}],
                                   "state": "fits", "can_apply": False, "inventory_complete": True,
                                   "blockers": ["schedule_writes_unverified", "schedule_ownership_unknown"]},
                    "baseline": {"revision": base["revision"] if base else 0, "checked_at": base["checked_at"] if base else None,
                                 "state": "unchanged" if base else "missing", "checks": [], "token": token}}
        if command == "schedules/baseline_save":
            if self.pending_baselines.pop(msg["token"], None) != msg["station_id"]:
                raise _Refuse("schedule_baseline_expired")
            rev = self.baselines.get(msg["station_id"], {"revision": 0})["revision"] + 1
            self.baselines[msg["station_id"]] = {"revision": rev, "checked_at": NOW}
            return {"revision": rev, "checked_at": NOW}
        if command == "schedules/baseline_clear":
            base = self.baselines.get(msg["station_id"], {"revision": 0, "checked_at": None})
            if msg["revision"] != base["revision"]:
                raise _Refuse("revision_conflict")
            self.baselines.pop(msg["station_id"], None)
            return {"revision": 0, "checked_at": None}
        if command == "schedules/plan_preview":
            if (code := self._station(msg)) is not None:
                raise _Refuse(code)
            src = lib.get(msg["schedule_id"])
            if src is None:
                raise _Refuse("schedule_not_found")
            if src["revision"] != msg["revision"]:
                raise _Refuse("revision_conflict")
            b = msg["bindings"]
            if set(b) != {"template", "weekly", "holiday_group", "holidays"} or len(b["holidays"]) != len(src["holidays"]):
                raise _Refuse("schedule_binding_invalid")
            if any(p["station_id"] == msg["station_id"] and p["bindings"]["weekly"] == b["weekly"] for p in self.plans.values()):
                raise _Refuse("schedule_plan_resource_reserved")
            draft = {k: src[k] for k in ("name", "weekly", "holidays")}
            item = {"id": str(uuid.uuid4()), "revision": 1, "station_id": msg["station_id"], "draft_id": src["id"], "draft_revision": src["revision"],
                    "draft": draft, "bindings": copy.deepcopy(b), "drifted_resources": [], "created_at": NOW, "report": self._report(draft, b)}
            self.pending_plans = {}
            token = self._token()
            self.pending_plans[token] = item
            return {**self._public_plan(item, details=True), "token": token}
        if command == "schedules/plan_save":
            item = self.pending_plans.pop(msg["token"], None)
            if item is None:
                raise _Refuse("schedule_plan_expired")
            self.plans[item["id"]] = item
            return self._public_plan(item)
        if command == "schedules/plan_list":
            return [self._public_plan(p) for p in self.plans.values()]
        if command in ("schedules/plan_recheck", "schedules/plan_delete", "schedules/plan_export", "schedules/operations_claim_preview", "schedules/operations_create"):
            plan = self.plans.get(msg["plan_id"])
            if plan is None:
                raise _Refuse("schedule_plan_not_found")
            if msg["revision"] != plan["revision"]:
                raise _Refuse("revision_conflict")
            if command == "schedules/plan_delete":
                del self.plans[plan["id"]]
                return {"deleted": True}
            if command == "schedules/plan_export":
                return self._public_plan(plan, details=True)
            if command == "schedules/plan_recheck":
                plan["revision"] += 1
                plan["report"] = self._report(plan["draft"], plan["bindings"])
                return self._public_plan(plan)
            if command == "schedules/operations_claim_preview":
                if any(c["plan_id"] == plan["id"] for c in self.claims.values()):
                    raise _Refuse("schedule_claim_conflict")
                token = self._token()
                self.pending_claims = {token: plan}
                return {"token": token, "plan_id": plan["id"], "plan_revision": plan["revision"], "resource_keys": [f"weekly:{plan['bindings']['weekly']}"],
                        "report": copy.deepcopy(plan["report"])}
            if any(j["plan_id"] == plan["id"] and j["status"] not in ("cancelled", "verified") for j in self.jobs.values()):
                raise _Refuse("schedule_operation_exists")
            job = {"id": str(uuid.uuid4()), "revision": 1, "plan_id": plan["id"], "plan_revision": plan["revision"], "station_id": plan["station_id"],
                   "name": plan["draft"]["name"], "resource_keys": [f"weekly:{plan['bindings']['weekly']}"], "created_at": NOW, "updated_at": NOW,
                   "status": "pending", "error": None, "blockers": ["schedule_writes_unverified"], "report": None, "journal_id": None, "ownership": "not_checked"}
            self.jobs[job["id"]] = job
            return copy.deepcopy(job)
        if command == "schedules/operations_claim_confirm":
            pending = self.pending_claims.pop(msg["token"], None)
            if pending is None:
                raise _Refuse("schedule_claim_expired")
            claim = {"id": str(uuid.uuid4()), "revision": 1, "plan_id": pending["id"], "station_id": pending["station_id"], "created_at": NOW,
                     "resource_keys": [f"weekly:{pending['bindings']['weekly']}"]}
            self.claims[claim["id"]] = claim
            return copy.deepcopy(claim)
        if command == "schedules/operations_claim_release":
            claim = self.claims.get(msg["claim_id"])
            if claim is None:
                raise _Refuse("schedule_claim_not_found")
            if msg["revision"] != claim["revision"]:
                raise _Refuse("revision_conflict")
            if any(j["plan_id"] == claim["plan_id"] and j["status"] not in ("cancelled", "verified") for j in self.jobs.values()):
                raise _Refuse("schedule_claim_in_use")
            del self.claims[claim["id"]]
            return {"released": True}
        if command in ("schedules/operations_check", "schedules/operations_cancel", "schedules/operations_archive"):
            job = self.jobs.get(msg["job_id"])
            if job is None:
                raise _Refuse("schedule_operation_not_found")
            if msg["revision"] != job["revision"]:
                raise _Refuse("revision_conflict")
            if command == "schedules/operations_check":
                if job["status"] in ("queued", "checking"):
                    raise _Refuse("schedule_read_busy")
                job.update(status="queued", error=None, revision=job["revision"] + 1)
                return copy.deepcopy(job)
            if command == "schedules/operations_cancel":
                if job["status"] in ("queued", "checking"):
                    raise _Refuse("schedule_operation_retained")
                job.update(status="cancelled", error=None, revision=job["revision"] + 1)
                return copy.deepcopy(job)
            if job["status"] not in ("cancelled", "verified"):
                raise _Refuse("schedule_operation_retained")
            del self.jobs[job["id"]]
            self.archive.append(job)
            return {"archived": True}
        if command == "schedules/operations_list":
            # WisKey's background preflight, one step per read: queued -> checking -> blocked (rc.10: always) or failed at the station
            for job in self.jobs.values():
                if job["status"] == "queued":
                    job.update(status="checking", revision=job["revision"] + 1)
                elif job["status"] == "checking":
                    if job["station_id"] in self.preflight_fail:
                        job.update(status="failed", error="authentication_failed", revision=job["revision"] + 1)
                    else:
                        job.update(status="blocked", blockers=["schedule_writes_unverified", "schedule_ownership_unknown"], ownership="missing",
                                   revision=job["revision"] + 1)
            return {"claims": [copy.deepcopy(c) for c in self.claims.values()], "jobs": [copy.deepcopy(j) for j in self.jobs.values()],
                    "archive": copy.deepcopy(self.archive), "journal": [], "writes_enabled": False}
        return {}


class _Refuse(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _norm(data: Any) -> dict[str, Any]:
    try:
        return sw.normalize(data)
    except sw.DraftError as exc:
        raise _Refuse(exc.code) from None


# ---------------------------------------------------------------- harness

def env(ttl: float = 15.0, **fields: Any) -> dict[str, Any]:
    return {"client_request_id": uuid.uuid4().hex, "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl)).strftime("%Y-%m-%dT%H:%M:%SZ"), **fields}


def wait_for(pred: Any, timeout: float = 5.0) -> None:
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError(f"condition not met; feed state {intercom_sync.STATE.as_dict()}")


@pytest.fixture()
def wx(settings, monkeypatch, station_scope):  # noqa: F811
    """The app with SchedFake as its WisKey and: root (system_admin: system.configure at the installation) - sched (a custom role at
    the installation with access.schedules.manage only) - scoped (access.schedules.manage on ONE station only: not the administrator)
    - otto (operator: neither)."""
    import websockets

    fake = SchedFake("admin", token="t")
    SchedFake.silent_commands = set()
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    for name in ("USER_BURST", "GLOBAL_BURST"):
        monkeypatch.setattr(intercom_sync, name, 1000.0)
    monkeypatch.setattr(sw, "COOLDOWN_SCALE", 0.0)
    sw.reset()
    intercom_sync.SYNC.reset()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    from smplwise.main import create_app

    c = TestClient(create_app(s))
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    role = c.post("/api/v1/access/roles", json={"name": "schedules admin", "description": "T7 test", "permissions": ["access.read", "access.stations.read"],
                                                 "sensitive": [ia.SCHEDULES_MANAGE]})
    assert role.status_code == 201, role.text
    bind(c, s, "sched", role.json()["id"], "installation", "*")
    c.get("/api/v1/me", headers=as_user("scoped"))
    station_scope.bind("dev-scoped", role.json()["id"], "entry-a")
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    yield fake, c, s
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()
    sw.reset()


def act(c: TestClient, action: str, user: str = "root", **body: Any) -> Any:
    if action in sw.OPS and not sw.OPS[action].writes or action in ("check",):
        return c.post(f"{API}/actions/{action}", json=body, headers=as_user(user))
    return c.post(f"{API}/actions/{action}", json=env(**{"confirmed": True, **body}), headers=as_user(user))


def read(c: TestClient, action: str, user: str = "root", **body: Any) -> Any:
    return c.post(f"{API}/actions/{action}", json=body, headers=as_user(user))


def sent(fake: FakeWiskey, command: str) -> list[dict[str, Any]]:
    return [m for m in fake.received if m.get("type") == PREFIX + command]


def rows(settings: Any, action: str) -> list[dict[str, Any]]:
    with Database(settings.db_path).connection() as conn:
        out = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]
    for r in out:
        r["details"] = json.loads(r["details_json"]) if r["details_json"] else {}
    return out


def create(c: TestClient, draft: dict[str, Any] = OFFICE, user: str = "root") -> dict[str, Any]:
    chk = read(c, "check", user, data=draft, date="2026-11-03", time="08:00")
    assert chk.status_code == 200, chk.text
    r = act(c, "create", user, check_id=chk.json()["check_id"], data=draft)
    assert r.status_code == 200, r.text
    return r.json()["data"]


def no_tokens(fake: SchedFake, *bodies: Any) -> None:
    text = json.dumps(bodies)
    for t in fake.tokens_issued:
        assert t not in text, "a WisKey token reached the browser"


# ---------------------------------------------------------------- the channel

def test_the_schedules_channel_is_exactly_the_write_side_and_nothing_else_carries_it():
    assert wiskey_channels.SCHEDULES == sw.COMMANDS and len(sw.COMMANDS) == 24
    assert "schedules" in wiskey_channels.ADAPTER_CHANNELS and wiskey_channels.HA_FRAMES["schedules"] == frozenset()
    for channel in wiskey_channels.ALLOWLISTS:
        for command in sw.COMMANDS:
            assert wiskey_channels.allowed(channel, PREFIX + command) == (channel == "schedules"), (channel, command)
    for other in ("schedules/list", "schedules/plan_list", "schedules/operations_list", "schedules/normalize_user", "stations/technical_hold_save",
                  "stations/technical_program_save", "stations/technical_codes_write", "users/update", "stations/test_unlock"):
        assert not wiskey_channels.allowed("schedules", PREFIX + other), other
    assert not (wiskey_channels.SCHEDULES & wiskey_channels.SERVICE_WRITES)


def test_every_command_is_in_the_pinned_catalog_with_the_keys_arx_sends():
    from fake_wiskey import PIN_DIR

    commands = json.loads((PIN_DIR / "commands.static.json").read_text(encoding="utf-8"))["commands"]
    for op in sw.OPS.values():
        entry = commands[op.command]
        assert entry["permission"]["read_command_for_security_guard_and_api_contract"] is op.read_class, op.command
        assert entry["permission"]["alternative_area_grants"] in ([["management", "view"]], [["management", "manage"]]), op.command


# ---------------------------------------------------------------- the gate

@pytest.mark.parametrize("user", ["otto", "scoped"])
def test_only_the_schedules_administrator_reaches_any_action(wx, user):
    fake, c, s = wx
    before = len(fake.received)
    for action, body in (("check", {"data": OFFICE, "date": "2026-11-03", "time": "08:00"}), ("readiness", {"station_id": "entry-a"})):
        r = read(c, action, user, **body)
        assert r.status_code == 403, r.text
    r = act(c, "delete", user, schedule_id=str(uuid.uuid4()), revision=1)
    assert r.status_code == 403
    assert c.get(f"{API}/jobs", headers=as_user(user)).status_code == 403
    assert c.get(f"{API}/export", headers=as_user(user)).status_code == 403
    assert len(fake.received) == before
    denied = rows(s, ia.SCHEDULES_MANAGE)
    assert denied and all(r["decision"] == "denied" and r["reason"] == "schedules_admin_required" for r in denied)


def test_the_installation_wide_permission_or_system_configure_is_enough(wx):
    fake, c, s = wx
    for user in ("sched", "root"):
        r = read(c, "check", user, data=OFFICE, date="2026-11-03", time="08:00")
        assert r.status_code == 200, (user, r.text)


# ---------------------------------------------------------------- library: preview -> apply

def test_check_is_wiskeys_own_preview_and_returns_a_check_id(wx):
    fake, c, s = wx
    r = read(c, "check", data=OFFICE, date="2026-11-03", time="08:00")  # a Tuesday
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["data"]["weekday"] == "Tuesday" and body["data"]["within_window"] is True and body["data"]["applied"] is False
    assert len(body["check_id"]) == 32
    frame = sent(fake, "schedules/preview")[-1]
    assert set(frame) == {"id", "type", "data", "date", "time", "api_contract"} and frame["api_contract"] == 1


def test_create_needs_a_check_of_the_same_draft_by_the_same_user(wx):
    fake, c, s = wx
    r = act(c, "create", check_id="0" * 32, data=OFFICE)
    assert r.status_code == 409 and r.json()["code"] == "schedule_preview_required" and r.json()["details"]["outcome"] == "not_sent"
    chk = read(c, "check", data=OFFICE, date="2026-11-03", time="08:00").json()["check_id"]
    other = {**OFFICE, "name": "Something else"}
    r = act(c, "create", check_id=chk, data=other)
    assert r.status_code == 409 and r.json()["code"] == "schedule_preview_required"
    chk = read(c, "check", data=OFFICE, date="2026-11-03", time="08:00").json()["check_id"]
    r = act(c, "create", "sched", check_id=chk, data=OFFICE)  # another administrator cannot use it
    assert r.status_code == 409
    assert sent(fake, "schedules/create") == []
    chk = read(c, "check", data=OFFICE, date="2026-11-03", time="08:00").json()["check_id"]
    r = act(c, "create", check_id=chk, data=OFFICE)
    assert r.status_code == 200, r.text
    item = r.json()["data"]
    assert item["revision"] == 1 and item["name"] == "Office hours" and item["weekly"]["Tuesday"] == OFFICE["weekly"]["Tuesday"]
    frame = sent(fake, "schedules/create")[-1]
    assert set(frame) == {"id", "type", "data", "api_contract"} and frame["data"] == json.loads(json.dumps(OFFICE))
    again = act(c, "create", check_id=chk, data=OFFICE)  # the check is used once
    assert again.status_code == 409 and len(sent(fake, "schedules/create")) == 1


def test_update_and_delete_are_compare_and_set_and_a_stale_revision_is_wiskeys_refusal(wx):
    fake, c, s = wx
    item = create(c)
    changed = {**OFFICE, "weekly": week(Sunday=[("06:00", "20:00")])}
    chk = read(c, "check", data=changed, date="2026-11-01", time="06:30").json()
    assert chk["data"]["within_window"] is True
    r = act(c, "update", schedule_id=item["id"], revision=item["revision"], check_id=chk["check_id"], data=changed)
    assert r.status_code == 200 and r.json()["data"]["revision"] == 2
    chk = read(c, "check", data=OFFICE, date="2026-11-01", time="06:30").json()["check_id"]
    stale = act(c, "update", schedule_id=item["id"], revision=1, check_id=chk, data=OFFICE)
    assert stale.status_code == 409
    e = stale.json()
    assert e["code"] == "schedule_refused" and e["details"]["outcome"] == "refused" and e["details"]["wiskey_code"] == "revision_conflict"
    assert "WisKey סירב" in e["user_message"] and "לא נשמר דבר" in e["user_message"]
    gone = act(c, "delete", schedule_id=item["id"], revision=2)
    assert gone.status_code == 200 and gone.json()["data"] == {"deleted": True}
    assert fake.library == {}
    again = act(c, "delete", schedule_id=item["id"], revision=2)
    assert again.status_code == 404 and again.json()["details"]["wiskey_code"] == "schedule_not_found"


def test_a_draft_wiskey_would_refuse_is_refused_first_with_wiskeys_code_and_nothing_is_sent(wx):
    fake, c, s = wx
    bad = {**OFFICE, "weekly": week(Monday=[("08:00", "12:00"), ("11:00", "14:00")])}
    r = read(c, "check", data=bad, date="2026-11-03", time="08:00")
    assert r.status_code == 422 and r.json()["details"]["wiskey_code"] == "schedule_overlap" and r.json()["details"]["field"] == "weekly.Monday"
    for broken, code in ((week(Monday=[("12:00", "08:00")]), "schedule_invalid_time"), ({**week(), "Funday": []}, "schedule_invalid_week"),
                         (week(Monday=[("08:00", "08:30")] * 9), "schedule_period_limit")):
        r = read(c, "check", data={**OFFICE, "weekly": broken}, date="2026-11-03", time="08:00")
        assert r.status_code == 422 and r.json()["details"]["wiskey_code"] == code, (code, r.text)
    holidays = [{"name": "A", "start": "2027-01-01", "end": "2027-01-05", "periods": []}, {"name": "B", "start": "2027-01-05", "end": "2027-01-06", "periods": []}]
    r = read(c, "check", data={**OFFICE, "holidays": holidays}, date="2026-11-03", time="08:00")
    assert r.status_code == 422 and r.json()["details"]["wiskey_code"] == "schedule_holiday_overlap"
    assert sent(fake, "schedules/preview") == []
    chk = read(c, "check", data=OFFICE, date="2026-11-03", time="08:00").json()["check_id"]
    r = act(c, "create", check_id=chk, data={**OFFICE, "name": "   "})
    assert r.status_code == 422 and r.json()["details"]["wiskey_code"] == "invalid_text" and sent(fake, "schedules/create") == []
    assert rows(s, "intercom.schedule_create")[-1]["details"]["outcome"] == "not_sent"


def test_a_refusal_arx_cannot_foresee_is_wiskeys_and_said_so(wx):
    fake, c, s = wx
    fake.library_full = True
    chk = read(c, "check", data=OFFICE, date="2026-11-03", time="08:00").json()["check_id"]
    r = act(c, "create", check_id=chk, data=OFFICE)
    assert r.status_code == 422 and r.json()["details"] == {"outcome": "refused", "wiskey_code": "schedule_limit", "reason": sw.reason("schedule_limit"), "state": None} or (
        r.status_code == 422 and r.json()["details"]["wiskey_code"] == "schedule_limit")
    assert "WisKey סירב" in r.json()["user_message"]
    out = rows(s, "intercom.schedule_create")
    assert [x["details"]["phase"] for x in out[-2:]] == ["attempt", "outcome"] and out[-1]["details"]["outcome"] == "refused" and out[-1]["reason"] == "schedule_limit"


def test_the_service_identity_without_wiskey_management_rights_is_wiskey_refused_unauthorized(wx):
    fake, c, s = wx
    fake.set_forbidden({"schedules/create", "schedules/plan_preview"})
    chk = read(c, "check", data=OFFICE, date="2026-11-03", time="08:00").json()["check_id"]
    r = act(c, "create", check_id=chk, data=OFFICE)
    assert r.status_code == 403 and r.json()["details"]["outcome"] == "refused" and r.json()["details"]["wiskey_code"] == "unauthorized"
    assert "WisKey סירב" in r.json()["user_message"] and "הרשאת ניהול" in r.json()["user_message"]


def test_confirmation_and_the_envelope_are_required_and_refusals_are_audited_as_not_sent(wx):
    fake, c, s = wx
    item = create(c)
    r = c.post(f"{API}/actions/delete", json=env(schedule_id=item["id"], revision=1), headers=as_user("root"))
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    body = env(schedule_id=item["id"], revision=1, confirmed=True)
    body["expires_at"] = "2020-01-01T00:00:00Z"
    assert c.post(f"{API}/actions/delete", json=body, headers=as_user("root")).status_code == 409
    assert sent(fake, "schedules/delete") == []
    same = env(schedule_id=item["id"], revision=1, confirmed=True)
    assert c.post(f"{API}/actions/delete", json=same, headers=as_user("root")).status_code == 200
    dup = c.post(f"{API}/actions/delete", json=same, headers=as_user("root"))
    assert dup.status_code == 409 and dup.json()["code"] == "intercom_duplicate_command"
    assert len(sent(fake, "schedules/delete")) == 1
    refusals = [r for r in rows(s, "intercom.schedule_delete") if r["details"].get("phase") == "refused"]
    assert {r["reason"] for r in refusals} >= {"confirmation_required", "expired", "intercom_duplicate_command"}
    assert c.post(f"{API}/actions/nope", json=env(), headers=as_user("root")).status_code == 404


def test_a_write_wiskey_does_not_answer_in_time_is_unknown_never_done(wx, monkeypatch):
    fake, c, s = wx
    monkeypatch.setattr(sw, "WRITE_TIMEOUT_S", 0.4)
    item = create(c)
    SchedFake.silent_commands = {"schedules/delete"}
    r = act(c, "delete", schedule_id=item["id"], revision=1)
    assert r.status_code == 504 and r.json()["code"] == "schedule_outcome_unknown" and r.json()["details"]["outcome"] == "unknown"
    assert "ייתכן שנשמרה" in r.json()["user_message"]
    last = rows(s, "intercom.schedule_delete")[-1]
    assert last["details"]["phase"] == "outcome" and last["details"]["outcome"] == "unknown"


def test_import_preview_then_apply_once_by_the_same_user_and_export(wx):
    fake, c, s = wx
    create(c)
    doc = c.get(f"{API}/export", headers=as_user("root"))
    assert doc.status_code == 200 and doc.json()["format"] == "hikvision_intercom.schedule_drafts" and len(doc.json()["schedules"]) == 1
    assert set(sent(fake, "schedules/export")[-1]) == {"id", "type"}  # a READ command: no api_contract
    document = json.dumps({"format": "hikvision_intercom.schedule_drafts", "version": 1, "schedules": [OFFICE, HOLIDAY]})
    p = read(c, "import_preview", document=document)
    assert p.status_code == 200, p.text
    prev = p.json()
    assert prev["data"]["count"] == 2 and prev["data"]["name_collisions"] == 1 and "token" not in prev["data"] and len(prev["preview_id"]) == 32
    assert act(c, "import_apply", "sched", preview_id=prev["preview_id"]).status_code == 409  # not this user's preview
    r = act(c, "import_apply", preview_id=prev["preview_id"])
    assert r.status_code == 200 and [x["name"] for x in r.json()["data"]] == ["Office hours", "Holidays"]
    assert len(fake.library) == 3
    assert act(c, "import_apply", preview_id=prev["preview_id"]).status_code == 409  # used once
    bad = read(c, "import_preview", document='{"format": "x"}')
    assert bad.status_code == 422 and bad.json()["details"]["wiskey_code"] == "schedule_transfer_invalid"
    no_tokens(fake, p.json(), r.json())


def test_another_operators_newer_import_preview_replaces_the_first_and_wiskey_says_expired(wx):
    """WisKey keeps ONE pending import per actor, and every Arx operator is the same WisKey actor: the gap is surfaced honestly."""
    fake, c, s = wx
    document = json.dumps({"format": "hikvision_intercom.schedule_drafts", "version": 1, "schedules": [OFFICE]})
    first = read(c, "import_preview", document=document).json()["preview_id"]
    read(c, "import_preview", "sched", document=document)
    r = act(c, "import_apply", preview_id=first)
    assert r.status_code == 409 and r.json()["details"]["wiskey_code"] == "schedule_import_expired" and "WisKey סירב" in r.json()["user_message"]


# ---------------------------------------------------------------- station reads before an apply

def test_readiness_dependencies_and_assess_read_the_station_and_show_the_impact(wx):
    fake, c, s = wx
    r = read(c, "readiness", station_id="entry-c")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["data"]["can_apply"] is False and body["data"]["reason"] == "schedule_writes_unverified"
    assert {ch["kind"] for ch in body["data"]["checks"]} == set(sw.KINDS)
    weekly = next(ch for ch in body["data"]["checks"] if ch["kind"] == "weekly")
    assert weekly["capabilities"]["ids"] == [1, 255] and weekly["capabilities"]["precision"] == "minute"
    assert body["impact"]["station"] == {"id": "entry-c", "name": "Loading dock", "online": True, "doors": [{"index": 1, "name": "Gate"}, {"index": 2, "name": "Barrier"}]}
    dep = read(c, "dependencies", station_id="entry-a").json()
    assert dep["impact"]["people"] == {"state": "complete", "error": None, "read": 412, "explicit": 37, "implicit": 4, "malformed": 0}
    a = read(c, "assess", station_id="entry-a", data=HOLIDAY).json()
    assert a["data"]["assessment"]["state"] == "fits" and "schedule_writes_unverified" in a["data"]["assessment"]["blockers"]
    assert a["data"]["baseline"]["state"] == "missing" and "token" not in a["data"]["baseline"] and len(a["baseline_preview_id"]) == 32
    for cmd in ("schedules/readiness", "schedules/dependencies", "schedules/assess"):
        assert sent(fake, cmd)[-1]["api_contract"] == 1
    no_tokens(fake, a)


def test_an_offline_station_is_not_read_and_device_reads_are_limited(wx, monkeypatch):
    fake, c, s = wx
    r = read(c, "readiness", station_id="entry-b")
    assert r.status_code == 409 and r.json()["code"] == "intercom_station_offline" and sent(fake, "schedules/readiness") == []
    assert read(c, "readiness", station_id="nope").status_code == 404
    monkeypatch.setattr(sw, "COOLDOWN_SCALE", 1.0)
    assert read(c, "readiness", station_id="entry-a").status_code == 200
    again = read(c, "readiness", station_id="entry-a")
    assert again.status_code == 429 and again.json()["code"] == "schedule_station_cooldown" and len(sent(fake, "schedules/readiness")) == 1


def test_a_baseline_is_saved_from_an_assessment_and_cleared_by_revision(wx):
    fake, c, s = wx
    a = read(c, "assess", station_id="entry-a", data=OFFICE).json()
    assert act(c, "baseline_save", station_id="entry-c", preview_id=a["baseline_preview_id"]).status_code == 409  # another station
    a = read(c, "assess", station_id="entry-a", data=OFFICE).json()
    r = act(c, "baseline_save", station_id="entry-a", preview_id=a["baseline_preview_id"])
    assert r.status_code == 200 and r.json()["data"] == {"revision": 1, "checked_at": NOW}
    assert act(c, "baseline_clear", station_id="entry-a", revision=5).json()["details"]["wiskey_code"] == "revision_conflict"
    assert act(c, "baseline_clear", station_id="entry-a", revision=1).status_code == 200
    assert rows(s, "intercom.schedule_baseline_save")[-1]["resource_id"] == "entry-a"


# ---------------------------------------------------------------- plans, claims, deploy

def plan(c: TestClient, item: dict[str, Any], station: str, weekly: int = 10) -> dict[str, Any]:
    holidays = len(item["holidays"])
    p = read(c, "plan_preview", station_id=station, schedule_id=item["id"], revision=item["revision"],
             bindings={"template": weekly, "weekly": weekly, "holiday_group": 5 if holidays else None, "holidays": list(range(20, 20 + holidays))})
    assert p.status_code == 200, p.text
    r = act(c, "plan_save", preview_id=p.json()["preview_id"])
    assert r.status_code == 200, r.text
    return r.json()["data"]


def test_plan_preview_shows_the_impact_and_only_its_preview_saves_it(wx):
    fake, c, s = wx
    item = create(c, HOLIDAY)
    p = read(c, "plan_preview", station_id="entry-c", schedule_id=item["id"], revision=1, bindings={"template": 7, "weekly": 7, "holiday_group": 3, "holidays": [30]})
    assert p.status_code == 200, p.text
    body = p.json()
    assert body["impact"]["station"]["name"] == "Loading dock" and [d["name"] for d in body["impact"]["station"]["doors"]] == ["Gate", "Barrier"]
    assert body["impact"]["people"]["explicit"] == 37 and body["impact"]["people"]["implicit"] == 4
    assert set(body["impact"]["blockers"]) >= {"schedule_writes_unverified", "schedule_ownership_unknown", "schedule_plan_holiday_membership_unknown"}
    assert body["data"]["candidates"] and "token" not in body["data"] and body["data"]["bindings"] == {"template": 7, "weekly": 7, "holiday_group": 3, "holidays": [30]}
    weekly = next(r for r in body["data"]["report"]["resources"] if r["kind"] == "weekly")
    assert weekly["state"] == "different" and weekly["fields"] == ["WeekPlanCfg"]
    frame = sent(fake, "schedules/plan_preview")[-1]
    assert set(frame) == {"id", "type", "station_id", "schedule_id", "revision", "bindings", "api_contract"}
    bad = read(c, "plan_preview", station_id="entry-c", schedule_id=item["id"], revision=1, bindings={"template": 0, "weekly": 7, "holiday_group": None, "holidays": []})
    assert bad.status_code == 422 and len(sent(fake, "schedules/plan_preview")) == 1
    r = act(c, "plan_save", preview_id=body["preview_id"])
    assert r.status_code == 200 and r.json()["data"]["station_id"] == "entry-c" and r.json()["impact"]["station"]["id"] == "entry-c"
    assert act(c, "plan_save", preview_id=body["preview_id"]).status_code == 409
    no_tokens(fake, body, r.json())


def test_recheck_detail_claims_and_delete_of_a_plan(wx):
    fake, c, s = wx
    item = create(c)
    p = plan(c, item, "entry-a")
    r = act(c, "plan_recheck", plan_id=p["id"], revision=1)
    assert r.status_code == 200 and r.json()["data"]["revision"] == 2
    d = c.get(f"{API}/plans/{p['id']}", params={"revision": 2}, headers=as_user("root"))
    assert d.status_code == 200 and {x["kind"] for x in d.json()["data"]["candidates"]} == {"weekly", "template"}
    assert "body" not in json.dumps(d.json()["data"]["candidates"])  # compiled device bodies are not served
    cp = read(c, "claim_preview", plan_id=p["id"], revision=2)
    assert cp.status_code == 200 and cp.json()["data"]["resource_keys"] == ["weekly:10"] and "token" not in cp.json()["data"]
    claim = act(c, "claim_confirm", preview_id=cp.json()["preview_id"])
    assert claim.status_code == 200 and claim.json()["data"]["plan_id"] == p["id"]
    claims = c.get(f"{API}/claims", headers=as_user("root")).json()["claims"]
    assert claims == [claim.json()["data"]] and claims[0]["revision"] == 1
    again = read(c, "claim_preview", plan_id=p["id"], revision=2)
    assert again.status_code == 409 and again.json()["details"]["wiskey_code"] == "schedule_claim_conflict"
    assert act(c, "claim_release", claim_id=claims[0]["id"], revision=1).status_code == 200
    assert act(c, "plan_delete", plan_id=p["id"], revision=1).json()["details"]["wiskey_code"] == "revision_conflict"
    assert act(c, "plan_delete", plan_id=p["id"], revision=2).status_code == 200 and fake.plans == {}


def test_deploy_is_honest_per_station_a_partial_failure_never_hides_the_others(wx):
    fake, c, s = wx
    a = plan(c, create(c), "entry-a", weekly=10)
    other = create(c, {**OFFICE, "name": "Dock hours"})
    cplan = plan(c, other, "entry-c", weekly=11)
    third = plan(c, create(c, {**OFFICE, "name": "Third"}), "entry-c", weekly=12)
    fake.preflight_fail = {"entry-c"}
    r = act(c, "deploy", plans=[{"plan_id": a["id"], "revision": 1}, {"plan_id": cplan["id"], "revision": 1}, {"plan_id": third["id"], "revision": 9}])
    assert r.status_code == 200, r.text
    out = r.json()
    by = {x["plan_id"]: x for x in out["results"]}
    assert by[a["id"]]["status"] == "queued" and by[a["id"]]["job"]["status"] == "queued" and by[a["id"]]["station"]["name"] == "Main gate"
    assert by[cplan["id"]]["status"] == "queued"
    assert by[third["id"]]["status"] == "not_sent" and by[third["id"]]["code"] == "revision_conflict"
    assert out["summary"] == {"queued": 2, "refused": 0, "unknown": 0, "not_sent": 1}
    assert len(sent(fake, "schedules/operations_create")) == 2 and len(sent(fake, "schedules/operations_check")) == 2
    ids = [by[a["id"]]["job"]["id"], by[cplan["id"]]["job"]["id"]]
    seen: list[dict[str, Any]] = []
    for _ in range(5):  # the screen polls until every job reached a final state
        prog = c.get(f"{API}/jobs", params={"ids": ids}, headers=as_user("root")).json()
        seen.append({j["id"]: j["status"] for j in prog["jobs"]})
        if prog["done"]:
            break
    assert prog["done"] is True and prog["writes_enabled"] is False
    assert seen[0] == {ids[0]: "checking", ids[1]: "checking"}
    final = {j["id"]: j for j in prog["jobs"]}
    assert final[ids[0]]["status"] == "blocked" and "schedule_writes_unverified" in final[ids[0]]["blockers"]
    assert final[ids[1]]["status"] == "failed" and final[ids[1]]["error"] == "authentication_failed"
    deploy_rows = rows(s, "intercom.schedule_deploy")
    per_plan = [x for x in deploy_rows if x["resource_type"] == "intercom_schedule_plan"]
    assert {x["resource_id"] for x in per_plan} == {a["id"], cplan["id"], third["id"]}
    batch = [x for x in deploy_rows if x["resource_id"] == "*"]
    assert batch[-1]["details"]["outcome"] == "partial" and batch[-1]["details"]["summary"]["not_sent"] == 1
    # a resubmitted deploy (the same envelope) is a duplicate: nothing is sent again
    dup = c.post(f"{API}/actions/deploy", json={**env(confirmed=True, plans=[{"plan_id": a["id"], "revision": 1}]), "client_request_id": batch[-1]["details"]["client_request_id"]},
                 headers=as_user("root"))
    assert dup.status_code == 409 and len(sent(fake, "schedules/operations_create")) == 2


def test_a_job_is_checked_again_cancelled_and_archived_by_revision(wx):
    fake, c, s = wx
    p = plan(c, create(c), "entry-a")
    out = act(c, "deploy", plans=[{"plan_id": p["id"], "revision": 1}]).json()
    job = out["results"][0]["job"]
    busy = act(c, "job_cancel", job_id=job["id"], revision=job["revision"])
    assert busy.status_code == 409 and busy.json()["details"]["wiskey_code"] == "schedule_operation_retained"
    for _ in range(5):
        if c.get(f"{API}/jobs", params={"ids": [job["id"]]}, headers=as_user("root")).json()["done"]:
            break
    j = c.get(f"{API}/jobs", params={"ids": [job["id"]]}, headers=as_user("root")).json()["jobs"][0]
    assert j["status"] == "blocked"
    again = act(c, "job_check", job_id=j["id"], revision=j["revision"])
    assert again.status_code == 200 and again.json()["data"]["status"] == "queued"
    for _ in range(5):
        if c.get(f"{API}/jobs", params={"ids": [job["id"]]}, headers=as_user("root")).json()["done"]:
            break
    j = c.get(f"{API}/jobs", params={"ids": [job["id"]]}, headers=as_user("root")).json()["jobs"][0]
    cancelled = act(c, "job_cancel", job_id=j["id"], revision=j["revision"])
    assert cancelled.status_code == 200 and cancelled.json()["data"]["status"] == "cancelled"
    assert act(c, "job_archive", job_id=j["id"], revision=cancelled.json()["data"]["revision"]).json()["data"] == {"archived": True}
    archived = c.get(f"{API}/jobs", params={"ids": [job["id"]]}, headers=as_user("root")).json()
    assert archived["jobs"][0]["status"] == "cancelled" and archived["missing"] == []


def test_the_operator_rate_limit_refuses_before_sending(wx, monkeypatch):
    fake, c, s = wx
    monkeypatch.setattr(sw, "USER_MAX", 1)
    item = create(c)
    r = act(c, "delete", schedule_id=item["id"], revision=1)
    assert r.status_code == 429 and r.json()["code"] == "schedule_rate_limited" and r.json()["details"]["outcome"] == "not_sent"
    assert sent(fake, "schedules/delete") == []


def test_audit_rows_name_the_actor_and_resource_and_never_a_token_or_a_window(wx):
    fake, c, s = wx
    item = create(c, user="sched")
    p = plan(c, item, "entry-a")
    act(c, "deploy", "sched", plans=[{"plan_id": p["id"], "revision": 1}])
    with Database(s.db_path).connection() as conn:
        all_rows = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action LIKE 'intercom.schedule_%'").fetchall()]
    assert all_rows
    text = json.dumps(all_rows)
    for t in fake.tokens_issued:
        assert t not in text
    assert "07:00" not in text and "Office hours" not in text
    create_rows = [r for r in all_rows if r["action"] == "intercom.schedule_create"]
    assert create_rows[0]["actor_user_id"] == "dev-sched" and json.loads(create_rows[-1]["details_json"])["result"]["id"] == item["id"]
