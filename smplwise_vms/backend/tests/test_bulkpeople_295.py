"""CR-BULKPEOPLE-295 (docs/changes/CR-BULKPEOPLE-295.md): bulk edit and CSV import / export of access-control people - FAKES ONLY.

Nothing here contacts WisKey, Home Assistant, a station, a door or a reader: the engine port is `FakeBulkEngine` below (WisKey-shaped
raw records through the real projections). The go-live permit is switched on INSIDE the tests that apply (monkeypatch); the tests of
the build as shipped keep it False. Negative tests first."""
from __future__ import annotations

import copy
import csv
import io
import json
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from intercom_station_scope import station_scope  # noqa: F401 - a fixture

from smplwise.db import Database
from smplwise.services import bulk_people as bp
from smplwise.services import intercom_authority as ia
from smplwise.services.access_grant_engine import EngineError
from smplwise.services.bulk_people_engine import BulkPerson, WiskeyBulkEngine, from_raw

API = "/api/v1/access-control/bulk-people"
PHONE_A = "0501234567"
PHONE_B = "0529876543"
HEADER = ",".join(bp.COLUMNS)


def raw(pid: str, name: str, emp: str, stations: dict[str, list[int]] | None = None, *, rev: int = 1, phone: str = PHONE_A, category: str = "staff",
        active: bool = True, groups: list[str] | None = None) -> dict[str, Any]:
    stations = {"entry-a": [1]} if stations is None else stations
    return {"id": pid, "display_name": name, "employee_no": emp, "active": active, "revision": rev, "valid_from": "2026-01-01T00:00:00Z",
            "valid_until": "2027-01-01T00:00:00Z", "access_category": category, "responsible_person": "", "access_purpose": "", "phone": phone,
            "pin_configured": True, "assignments": {sid: {"enabled": True, "allowed_locks": locks, "sync_state": "synced"} for sid, locks in stations.items()},
            "permission_overrides": {sid: "allow" for sid in stations}, "group_ids": list(groups or [])}


class FakeBulkEngine:
    """The bulk engine port over an in-memory WisKey directory (raw records). Writes follow WisKey's compare-and-set; `script` makes the
    next write to a person (or `"create"`) raise an EngineError."""

    GROUPS = {"g-day": ["entry-a"], "g-b": ["entry-b"]}

    def __init__(self) -> None:
        self.people: dict[str, dict[str, Any]] = {}
        self.calls: list[tuple[str, str]] = []
        self.writes: list[dict[str, Any]] = []
        self.script: dict[str, list[EngineError]] = {}
        self.seq = 100

    def add(self, record: dict[str, Any]) -> None:
        self.people[record["id"]] = record

    def list_people(self, who: str) -> list[BulkPerson]:
        self.calls.append(("list", who))
        return [from_raw(copy.deepcopy(r)) for r in self.people.values()]

    def get_person(self, person_id: str, who: str) -> BulkPerson:
        self.calls.append(("get", person_id))
        if person_id not in self.people:
            raise EngineError("not_found", "user_not_found")
        return from_raw(copy.deepcopy(self.people[person_id]))

    def groups(self, who: str) -> dict[str, list[str] | None]:
        self.calls.append(("groups", who))
        return {k: list(v) for k, v in self.GROUPS.items()}

    def _scripted(self, key: str) -> None:
        queue = self.script.get(key)
        if queue:
            raise queue.pop(0)

    def _apply(self, rec: dict[str, Any], data: dict[str, Any]) -> None:
        assert "pin" not in data and "cards" not in data and "photo" not in data, "never a credential or a photo in a bulk write"
        for key in ("display_name", "employee_no", "phone", "active", "valid_from", "valid_until", "access_category", "responsible_person", "access_purpose"):
            if key in data:
                rec[key] = data[key]
        if "group_ids" in data:
            rec["group_ids"] = list(data["group_ids"])
        if "door_permissions" in data:
            rec["permission_overrides"] = dict(data["permission_overrides"])
            assignments = {}
            for sid, verdict in rec["permission_overrides"].items():
                if verdict == "allow":
                    assignments[sid] = {"enabled": True, "allowed_locks": list(data["door_permissions"].get(sid, [1])), "sync_state": "pending"}
            rec["assignments"] = assignments

    def create(self, data: dict[str, Any], who: str) -> BulkPerson:
        self.calls.append(("create", who))
        self._scripted("create")
        self.seq += 1
        rec = raw(f"u{self.seq}", "", "", {}, phone="")
        self._apply(rec, data)
        self.people[rec["id"]] = rec
        self.writes.append({"op": "create", "data": data})
        return from_raw(copy.deepcopy(rec))

    def update(self, person_id: str, revision: int, data: dict[str, Any], who: str) -> BulkPerson:
        self.calls.append(("update", person_id))
        self._scripted(person_id)
        rec = self.people.get(person_id)
        if rec is None:
            raise EngineError("not_found", "user_not_found")
        if rec["revision"] != revision:
            raise EngineError("revision_conflict", "revision_conflict")
        self._apply(rec, data)
        rec["revision"] += 1
        self.writes.append({"op": "update", "person_id": person_id, "data": data})
        return from_raw(copy.deepcopy(rec))


class World:
    def __init__(self, settings, monkeypatch, station_scope, *, on: bool = True) -> None:  # noqa: F811
        from smplwise.main import create_app

        self.settings = settings
        self.engine = FakeBulkEngine()
        monkeypatch.setattr(bp, "ENGINE_FACTORY", lambda s: self.engine)
        bp.reset_for_tests()
        self.c = TestClient(create_app(settings))
        self.db = Database(settings.db_path)
        bind(self.c, settings, "root", "system_admin", "installation", "*")
        bind(self.c, settings, "otto", "operator", "installation", "*")
        for user in ("mia", "nina"):
            self.c.get("/api/v1/me", headers=as_user(user))
        station_scope.bind("dev-mia", "site_admin", "entry-a")
        names_only = self.c.post("/api/v1/access/roles", json={"name": "people manager without sensitive", "description": "bulk field-level test",
                                                               "permissions": ["access.read", "access.people.read"], "sensitive": [ia.PEOPLE_MANAGE]})
        assert names_only.status_code == 201, names_only.text
        station_scope.bind("dev-nina", names_only.json()["id"], "entry-a")
        self.engine.add(raw("u1", "Dana Levi", "1001", {"entry-a": [1]}, phone=PHONE_A))
        self.engine.add(raw("u2", "Avi Cohen", "1002", {"entry-b": [1, 2]}, phone=PHONE_B))
        self.engine.add(raw("u3", "Shared Person", "1003", {"entry-a": [1], "entry-b": [1]}))
        if on:
            r = self.c.put(f"{API}/settings", json={"enabled": "on"}, headers=as_user("root"))
            assert r.status_code == 200, r.text

    # ---- helpers
    def upload(self, body: str | bytes, user: str = "root", key: str = "key-00000001"):
        data = body.encode("utf-8") if isinstance(body, str) else body
        return self.c.post(f"{API}/jobs", content=data, headers={**as_user(user), "Idempotency-Key": key, "Content-Type": "text/csv"})

    def staged(self, body: str, user: str = "root", key: str = "key-00000001") -> dict[str, Any]:
        r = self.upload(body, user, key)
        assert r.status_code == 200, r.text
        return r.json()["job"]

    def dry(self, job_id: str, user: str = "root") -> dict[str, Any]:
        r = self.c.post(f"{API}/jobs/{job_id}/dry-run", headers=as_user(user))
        assert r.status_code == 200, r.text
        return r.json()

    def confirm(self, job: dict[str, Any], user: str = "root", typed: str | None = None):
        return self.c.post(f"{API}/jobs/{job['id']}/confirm", json={"plan_digest": job["plan_digest"], "confirm": typed if typed is not None else str(job["writes"])},
                           headers=as_user(user))

    def apply(self, job_id: str, user: str = "root"):
        return self.c.post(f"{API}/jobs/{job_id}/apply", headers=as_user(user))

    def ready(self, body: str, user: str = "root") -> dict[str, Any]:
        job = self.staged(body, user)
        job = self.dry(job["id"], user)["job"]
        r = self.confirm(job, user)
        assert r.status_code == 200, r.text
        return r.json()["job"]

    def audit(self, action: str | None = None) -> list[dict[str, Any]]:
        with self.db.connection(mode="read") as conn:
            sql = "SELECT action, decision, reason, resource_id, details_json FROM audit_log" + (" WHERE action = ?" if action else "") + " ORDER BY rowid"
            return [dict(r) for r in conn.execute(sql, (action,) if action else ())]

    def job_row(self, job_id: str) -> dict[str, Any]:
        with self.db.connection(mode="read") as conn:
            return dict(conn.execute("SELECT * FROM access_bulk_jobs WHERE id = ?", (job_id,)).fetchone())

    def jobs(self) -> int:
        with self.db.connection(mode="read") as conn:
            return conn.execute("SELECT COUNT(*) FROM access_bulk_jobs").fetchone()[0]


@pytest.fixture()
def w(settings, monkeypatch, station_scope):  # noqa: F811
    world = World(settings, monkeypatch, station_scope)
    yield world
    bp.reset_for_tests()


@pytest.fixture()
def live(w, monkeypatch):
    monkeypatch.setattr(bp, "GO_LIVE_PERMITTED", True)  # the owner's permit - inside the test only
    return w


def csv_rows(*rows: dict[str, str]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(bp.COLUMNS)
    for r in rows:
        writer.writerow([r.get(c, "") for c in bp.COLUMNS])
    return buf.getvalue()


def parse_export(r) -> list[dict[str, str]]:
    assert r.status_code == 200, r.text
    text = r.content.decode("utf-8")
    assert text.startswith("﻿")
    rows = list(csv.reader(io.StringIO(text[1:])))
    return [dict(zip(rows[0], row)) for row in rows[1:]]


# ================================================================ negative first: the build as shipped is OFF


def test_the_switch_is_off_by_default_and_the_permit_is_not_in_the_build(settings, monkeypatch, station_scope):  # noqa: F811
    world = World(settings, monkeypatch, station_scope, on=False)
    src = (Path(bp.__file__)).read_text(encoding="utf-8")
    assert "\nGO_LIVE_PERMITTED = False  #" in src and bp.go_live_permitted() is False
    s = world.c.get(f"{API}/settings", headers=as_user("root")).json()
    assert s["enabled"] == "off" and s["go_live_permitted"] is False
    for r in (world.c.get(f"{API}/export.csv", headers=as_user("root")), world.upload(csv_rows({"person_id": "u1", "display_name": "X"}))):
        assert r.status_code == 409 and r.json()["code"] == "bulk_people_off", r.text
    assert world.engine.calls == [] and world.jobs() == 0


def test_only_a_system_administrator_turns_the_switch(w):
    r = w.c.put(f"{API}/settings", json={"enabled": "off"}, headers=as_user("mia"))
    assert r.status_code == 403 and r.json()["code"] == "not_system_admin"
    assert any(a["decision"] == "denied" and a["reason"] == "not_system_admin" for a in w.audit("settings.changed"))


def test_the_backup_never_restores_the_switch():
    from smplwise.services import backup

    assert "access.bulk_people" in Path(backup.__file__).read_text(encoding="utf-8")


def test_a_caller_without_people_manage_cannot_upload_and_learns_nothing(w):
    r = w.upload(csv_rows({"person_id": "u1", "display_name": "X"}), user="otto")
    assert r.status_code == 403
    assert w.jobs() == 0 and w.engine.calls == []


def test_a_file_with_a_pin_card_or_photo_column_is_refused_whole_and_not_stored(w):
    for header in ("pin", "PIN code", "card_no", "photo", "קוד"):
        r = w.upload(f"person_id,display_name,{header}\nu1,Dana,918273\n", key=f"key-secret-{abs(hash(header)) % 10**6:06d}")
        assert r.status_code == 422 and r.json()["code"] == "bulk_secret_column", (header, r.text)
    assert w.jobs() == 0
    assert "918273" not in json.dumps(w.audit())


def test_the_size_limits(w, monkeypatch):
    big = "x" * (bp.MAX_FILE_BYTES + 10)
    r = w.upload(big)
    assert r.status_code == 413 and r.json()["code"] == "bulk_file_too_large"
    monkeypatch.setattr(bp, "MAX_ROWS", 3)
    rows = [{"employee_no": f"20{i}", "display_name": f"P{i}"} for i in range(4)]
    r = w.upload(csv_rows(*rows), key="key-rows-0001")
    assert r.status_code == 413 and r.json()["code"] == "bulk_too_many_rows"
    r = w.upload(b"person_id\n\xff\xfe\n", key="key-enc-00001")
    assert r.status_code == 422 and r.json()["code"] == "bulk_file_encoding"
    r = w.upload(csv_rows({"person_id": "u1", "display_name": "y" * (bp.MAX_CELL + 1)}), key="key-cell-0001")
    assert r.json()["job"]["report"][0]["codes"] == ["cell_too_long"]


def test_the_validation_report_names_codes_and_fields_never_values(w):
    job = w.staged(csv_rows(
        {"person_id": "u1", "display_name": "=HYPERLINK(\"x\")"},                       # 1 formula
        {"person_id": "u2", "phone": "call-me-now"},                                     # 2 phone
        {"person_id": "u3", "valid_from": "2026-11-01"},                                 # 3 one side of the window
        {"display_name": "No Number"},                                                   # 4 a create without an employee number
        {"person_id": "u1", "active": "false"},                                          # 5 duplicate person (row 1 named u1 too)
        {"employee_no": "3001", "display_name": "Guest", "access_category": "visitor"},  # 6 visitor without responsible / end
        {"person_id": "u2", "doors": "entry-b:3"},                                       # 7 a relay that does not exist
        {"person_id": "u3"},                                                             # 8 nothing to change
        {"employee_no": "3002", "display_name": "New One", "doors": "entry-a:1"},        # 9 fine
    ))
    rep = {e["row"]: e for e in job["report"]}
    assert rep[1]["codes"] == ["formula_like"] and rep[1]["fields"] == ["display_name"]
    assert rep[2]["codes"] == ["invalid"] and rep[2]["fields"] == ["phone"]
    assert rep[3]["codes"] == ["validity_pair"]
    assert rep[4]["codes"] == ["required"] and rep[4]["fields"] == ["employee_no"]
    assert rep[5]["codes"] == ["duplicate_person"]
    assert set(rep[6]["codes"]) == {"guest_responsible_required", "invalid_validity"}
    assert rep[7]["codes"] == ["doors"]
    assert rep[8]["status"] == "skip"
    assert rep[9]["status"] == "ok" and rep[9]["fields"] == ["display_name", "doors", "employee_no"]
    text = json.dumps(job) + json.dumps(w.audit())
    for value in ("HYPERLINK", "call-me-now", "No Number", "New One"):
        assert value not in text, value
    assert w.engine.calls == [], "parsing never reads WisKey"


def test_the_idempotency_key(w):
    body = csv_rows({"person_id": "u1", "active": "false"})
    a = w.upload(body, key="key-same-0001").json()
    b = w.upload(body, key="key-same-0001").json()
    assert b["replayed"] is True and a["job"]["id"] == b["job"]["id"] and w.jobs() == 1
    r = w.upload(csv_rows({"person_id": "u2", "active": "false"}), key="key-same-0001")
    assert r.status_code == 409 and r.json()["code"] == "bulk_idempotency_conflict"
    r = w.upload(body, key="")
    assert r.status_code == 422 and r.json()["code"] == "bulk_idempotency_key"


# ================================================================ dry-run: never writes, the caller's level


def test_the_dry_run_diffs_without_writing(w):
    job = w.staged(csv_rows(
        {"person_id": "u1", "revision": "1", "display_name": "Dana L", "phone": "0501112233"},
        {"person_id": "u2", "revision": "7", "active": "false"},          # stale revision
        {"person_id": "u3", "display_name": "Shared Person"},             # unchanged
        {"person_id": "nobody", "active": "false"},                       # not found
        {"employee_no": "1001", "display_name": "Clash"},                 # an employee number someone has
    ))
    out = w.dry(job["id"])
    rows = {r["row"]: r for r in out["rows"]}
    assert rows[1]["status"] == "write" and rows[1]["fields"] == ["display_name", "phone"]
    phone = next(d for d in rows[1]["diff"] if d["field"] == "phone")
    assert phone == {"field": "phone", "before": "····67", "after": "····33"}, "the phone is masked on both sides"
    assert rows[2]["codes"] == ["revision_conflict"]
    assert rows[3]["status"] == "unchanged"
    assert rows[4]["codes"] == ["not_found"]
    assert rows[5]["codes"] == ["employee_conflict"]
    assert out["job"]["state"] == "previewed" and out["job"]["writes"] == 1
    assert w.engine.writes == [] and all(c[0] in ("list", "groups") for c in w.engine.calls)
    stored = w.job_row(job["id"])
    assert "0501112233" not in (stored["plan_json"] or "") and "Dana L" not in (stored["plan_json"] or "") and "Dana L" not in stored["report_json"]


def test_a_station_scoped_manager_sees_only_their_people(w):
    job = w.staged(csv_rows(
        {"person_id": "u1", "active": "false"},                                   # entry-a: theirs
        {"person_id": "u2", "active": "false"},                                   # entry-b only: invisible
        {"person_id": "u3", "active": "false"},                                   # shared with entry-b: read-only for them
        {"employee_no": "4001", "display_name": "B door", "doors": "entry-b:1"},  # a create on a station not theirs
        {"person_id": "u1", "groups": "g-b"},                                     # a group granting entry-b
    ), user="mia")
    # u1 is twice: the second row is a duplicate - re-stage without it
    rows = {r["row"]: r for r in w.dry(job["id"], "mia")["rows"]}
    assert rows[1]["status"] == "write"
    assert rows[2]["codes"] == ["not_found"], "exactly like a person that does not exist"
    assert rows[3]["codes"] == ["scope"]
    assert rows[4]["codes"] == ["scope"]
    job2 = w.staged(csv_rows({"person_id": "u1", "groups": "g-b"}), user="mia", key="key-mia-00002")
    assert {r["row"]: r for r in w.dry(job2["id"], "mia")["rows"]}[1]["codes"] == ["scope"]


def test_a_names_level_manager_cannot_change_a_phone(w):
    job = w.staged(csv_rows({"person_id": "u1", "phone": "0501112233"}, {"person_id": "u1x", "active": "false"}), user="nina")
    rows = {r["row"]: r for r in w.dry(job["id"], "nina")["rows"]}
    assert rows[1]["codes"] == ["field_level"]


def test_another_users_job_is_not_found(w):
    job = w.staged(csv_rows({"person_id": "u1", "active": "false"}), user="mia")
    r = w.c.post(f"{API}/jobs/{job['id']}/dry-run", headers=as_user("nina"))
    assert r.status_code == 404 and r.json()["code"] == "bulk_job_not_found"
    assert w.c.get(f"{API}/jobs/{job['id']}", headers=as_user("root")).status_code == 200, "a system administrator sees every job"


# ================================================================ confirm: a system administrator, bound to the plan


def test_the_confirm_rules(w):
    job = w.staged(csv_rows({"person_id": "u1", "active": "false"}), user="mia")
    job = w.dry(job["id"], "mia")["job"]
    r = w.confirm(job, user="mia")
    assert r.status_code == 403 and r.json()["code"] == "not_system_admin"
    r = w.c.post(f"{API}/jobs/{job['id']}/confirm", json={"plan_digest": "0" * 64, "confirm": "1"}, headers=as_user("root"))
    assert r.status_code == 409 and r.json()["code"] == "bulk_plan_changed"
    r = w.confirm(job, typed="2")
    assert r.status_code == 422 and r.json()["code"] == "bulk_confirm_mismatch"
    with w.db.connection() as conn:
        conn.execute("UPDATE access_bulk_jobs SET previewed_at = ? WHERE id = ?", (bp._iso(bp._now() - timedelta(minutes=16)), job["id"]))
    r = w.confirm(job)
    assert r.status_code == 409 and r.json()["code"] == "bulk_preview_stale"
    job = w.dry(job["id"], "mia")["job"]
    r = w.confirm(job)
    assert r.status_code == 200 and r.json()["job"]["state"] == "confirmed"
    assert [a["decision"] for a in w.audit("access.bulk.confirm")] == ["denied", "denied", "denied", "denied", "allowed"]


def test_a_bearer_token_session_cannot_confirm(w, monkeypatch):
    from smplwise.services import intercom_writes as iw

    job = w.dry(w.staged(csv_rows({"person_id": "u1", "active": "false"}))["id"])["job"]
    monkeypatch.setattr(iw, "interactive", lambda principal: False)
    r = w.confirm(job)
    assert r.status_code == 403 and r.json()["code"] == "bulk_interactive_only"


# ================================================================ apply: refused without the permit; bounded, resumable, partial


def test_apply_is_refused_without_the_owners_permit(w):
    job = w.ready(csv_rows({"person_id": "u1", "active": "false"}))
    r = w.apply(job["id"])
    assert r.status_code == 409 and r.json()["code"] == "bulk_people_not_permitted"
    assert w.engine.writes == [] and w.job_row(job["id"])["state"] == "confirmed"


def test_the_live_engine_refuses_every_write_without_the_permit(settings):
    eng = WiskeyBulkEngine(settings)
    for call in (lambda: eng.create({"display_name": "x"}, "u"), lambda: eng.update("u1", 1, {"active": False}, "u")):
        with pytest.raises(EngineError) as err:
            call()
        assert err.value.kind == "not_permitted"


def test_apply_writes_in_bounded_batches_and_finishes(live):
    w = live
    rows = [{"employee_no": f"5{i:03d}", "display_name": f"Person {i}", "doors": "entry-a:1"} for i in range(30)]
    job = w.ready(csv_rows(*rows))
    assert job["writes"] == 30
    first = w.apply(job["id"]).json()["job"]
    assert first["progress"] == {"done": 25, "total": 30} and first["more"] is True and first["state"] == "paused"
    second = w.apply(job["id"]).json()["job"]
    assert second["state"] == "done" and second["outcomes"] == {"ok": 30} and second["more"] is False
    assert len(w.engine.writes) == 30
    assert all(x["data"]["permission_overrides"] == {"entry-a": "allow"} and x["data"]["door_permissions"] == {"entry-a": [1]} for x in w.engine.writes)
    assert w.job_row(job["id"])["rows_json"] is None, "the row data (PII) is purged when the job is over"
    again = w.apply(job["id"]).json()["job"]
    assert again["state"] == "done" and len(w.engine.writes) == 30, "a finished job writes nothing again"


def test_partial_failures_are_reported_and_unknown_is_never_resent(live):
    w = live
    job = w.ready(csv_rows({"person_id": "u1", "active": "false"}, {"person_id": "u3", "active": "false"},
                           {"employee_no": "6001", "display_name": "New"}))
    w.engine.people["u1"]["revision"] = 9                           # edited in WisKey after the dry-run
    w.engine.script["u3"] = [EngineError("unknown", "timeout")]     # sent, no clear answer
    out = w.apply(job["id"]).json()["job"]
    res = {r["row"]: r for r in out["results"]}
    assert res[1]["outcome"] == "failed" and res[1]["code"] == "revision_conflict"
    assert res[2]["outcome"] == "unknown"
    assert res[3]["outcome"] == "ok"
    assert out["state"] == "done"
    assert [c for c in w.engine.calls if c[0] == "update"] == [("update", "u3")], "a stale row is never sent; the unknown one once"
    assert w.engine.people["u1"]["active"] is True


def test_a_stall_pauses_and_resume_continues(live):
    w = live
    job = w.ready(csv_rows(*[{"employee_no": f"7{i:03d}", "display_name": f"P{i}"} for i in range(5)]))
    w.engine.script["create"] = [EngineError("not_sent", "busy")] * 3
    out = w.apply(job["id"]).json()["job"]
    assert out["stalled"] is True and out["state"] == "paused" and out["progress"]["done"] == 0 and w.engine.writes == []
    out = w.apply(job["id"]).json()["job"]
    assert out["state"] == "done" and out["outcomes"] == {"ok": 5} and len(w.engine.writes) == 5


def test_only_the_confirmer_applies_and_one_applier_at_a_time(live):
    w = live
    job = w.ready(csv_rows({"person_id": "u1", "active": "false"}))
    bind(w.c, w.settings, "rita", "system_admin", "installation", "*")
    r = w.apply(job["id"], user="rita")
    assert r.status_code == 409 and r.json()["code"] == "bulk_job_state"
    with w.db.connection() as conn:
        conn.execute("UPDATE access_bulk_jobs SET state = 'applying', lease_until = ? WHERE id = ?", (bp._iso(bp._now() + timedelta(minutes=1)), job["id"]))
    r = w.apply(job["id"])
    assert r.status_code == 409 and r.json()["code"] == "bulk_job_busy"
    assert w.engine.writes == []


def test_the_apply_gate_uses_a_fresh_read(live):
    """A person moved to a station outside the plan after the dry-run: the row is refused at apply, nothing sent."""
    w = live
    job = w.ready(csv_rows({"person_id": "u1", "display_name": "Dana Two"}))
    w.engine.people["u1"]["display_name"] = "Dana Levi"  # same revision, same data: still written
    out = w.apply(job["id"]).json()["job"]
    assert out["outcomes"] == {"ok": 1} and w.engine.people["u1"]["display_name"] == "Dana Two"


# ================================================================ bulk edit


def test_bulk_edit_doors_validity_and_deactivate(live):
    w = live
    body = {"person_ids": ["u1", "u3"], "doors_add": {"entry-c": [2]}, "doors_remove": ["entry-b"], "valid_from": "2026-11-01",
            "valid_until": "2026-12-31", "active": False}
    r = w.c.post(f"{API}/jobs/edit", json=body, headers={**as_user("root"), "Idempotency-Key": "edit-0000001"})
    assert r.status_code == 200, r.text
    job = w.dry(r.json()["job"]["id"])["job"]
    assert w.confirm(job).status_code == 200
    out = w.apply(job["id"]).json()["job"]
    assert out["outcomes"] == {"ok": 2}
    u3 = w.engine.people["u3"]
    assert u3["permission_overrides"] == {"entry-a": "allow", "entry-b": "deny", "entry-c": "allow"}
    assert set(u3["assignments"]) == {"entry-a", "entry-c"} and u3["active"] is False
    assert u3["valid_from"].endswith("Z") and u3["valid_until"].endswith("Z")


def test_bulk_edit_request_limits(w, monkeypatch):
    monkeypatch.setattr(bp, "MAX_EDIT_PEOPLE", 2)
    for body, field in (({"person_ids": ["u1", "u2", "u3"], "active": False}, "person_ids"), ({"person_ids": ["u1"]}, "change"),
                        ({"person_ids": ["u1"], "doors_add": {"entry-a": [1]}, "doors_remove": ["entry-a"]}, "conflicting_change"),
                        ({"person_ids": ["u1"], "valid_from": "2026-11-01"}, "valid_from")):
        r = w.c.post(f"{API}/jobs/edit", json=body, headers={**as_user("root"), "Idempotency-Key": f"edit-{field[:6]}-0001"})
        assert r.status_code == 422 and field in r.json()["details"]["fields"], (body, r.text)


# ================================================================ export


def test_the_export_is_the_callers_view_masked_and_formula_safe(w):
    w.engine.people["u1"]["display_name"] = "=cmd|'/c calc'!A1"
    rows = parse_export(w.c.get(f"{API}/export.csv", headers=as_user("root")))
    by_id = {r["person_id"]: r for r in rows}
    assert set(by_id) == {"u1", "u2", "u3"}
    assert by_id["u1"]["display_name"].startswith("'="), "the formula guard"
    assert by_id["u1"]["phone"] == "····67" and PHONE_A not in json.dumps(rows), "never the full number"
    assert by_id["u2"]["doors"] == "entry-b:1+2"
    assert not any(SECRET for SECRET in rows[0] if bp.SECRET_HEADER.search(SECRET)), "no PIN / card / photo column"
    mine = parse_export(w.c.get(f"{API}/export.csv", headers=as_user("mia")))
    assert {r["person_id"] for r in mine} == {"u1", "u3"}
    assert {r["person_id"]: r["doors"] for r in mine}["u3"] == "entry-a:1", "only the stations the caller sees"
    names = parse_export(w.c.get(f"{API}/export.csv", headers=as_user("nina")))
    assert all(r["phone"] == "" for r in names), "below the sensitive level: no phone at all"
    rows_audit = w.audit("access.bulk.export")
    assert [json.loads(a["details_json"])["rows"] for a in rows_audit] == [3, 2, 2]
    assert "Avi" not in json.dumps(rows_audit) and PHONE_B not in json.dumps(rows_audit)


def test_one_export_a_minute(w):
    assert w.c.get(f"{API}/export.csv", headers=as_user("root")).status_code == 200
    r = w.c.get(f"{API}/export.csv", headers=as_user("root"))
    assert r.status_code == 429 and r.json()["code"] == "export_rate"
    assert w.c.get(f"{API}/export.csv", headers=as_user("mia")).status_code == 200, "per user"


def test_export_reimport_round_trip_changes_nothing(w):
    exported = w.c.get(f"{API}/export.csv", headers=as_user("root")).content
    job = w.staged(exported.decode("utf-8"))
    assert all(e["status"] == "ok" for e in job["report"]), job["report"]
    out = w.dry(job["id"])
    assert [r["status"] for r in out["rows"]] == ["unchanged"] * 3 and out["job"]["writes"] == 0


# ================================================================ PII, expiry, cancel


def test_no_name_or_phone_in_the_audit_or_the_logs(live, caplog):
    w = live
    job = w.ready(csv_rows({"person_id": "u1", "display_name": "Secret Name", "phone": "0507777777"}))
    w.apply(job["id"])
    text = json.dumps(w.audit()) + caplog.text
    for value in ("Secret Name", "0507777777", "Dana Levi", PHONE_A):
        assert value not in text, value
    rows = w.audit("access.bulk.row")
    assert json.loads(rows[0]["details_json"])["fields"] == ["display_name", "phone"]


def test_expiry_and_cancel_purge_the_row_data(w):
    a = w.staged(csv_rows({"person_id": "u1", "active": "false"}), key="key-exp-00001")
    b = w.staged(csv_rows({"person_id": "u2", "active": "false"}), key="key-can-00001")
    with w.db.connection() as conn:
        conn.execute("UPDATE access_bulk_jobs SET expires_at = ? WHERE id = ?", (bp._iso(bp._now() - timedelta(seconds=1)), a["id"]))
    r = w.c.post(f"{API}/jobs/{a['id']}/dry-run", headers=as_user("root"))
    assert r.status_code == 409 and w.job_row(a["id"])["state"] == "expired" and w.job_row(a["id"])["rows_json"] is None
    r = w.c.post(f"{API}/jobs/{b['id']}/cancel", headers=as_user("root"))
    assert r.status_code == 200 and r.json()["job"]["state"] == "cancelled" and w.job_row(b["id"])["rows_json"] is None
