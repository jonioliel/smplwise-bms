"""WKR5ADOPT-295 (Arx item W-006): WisKey's verified `features/people_csv_preview`, adopted in the Arx client and the bulk-people routes.
FAKES ONLY: `CsvPort` plays the WisKey side of Mac's PEOPLE_CSV_PREVIEW_V1 (rows with change digests, two stamps, a `start`); nothing here ran against a
WisKey, a Home Assistant, a station or a door. Negative tests first."""
from __future__ import annotations

import copy
import csv
import hashlib
import io
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

import pytest
import wkcap_fakes as wf
from conftest import as_user
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_bulkpeople_295 import API, World

from smplwise.services import bulk_people as bp
from smplwise.services import wiskey_feature_direct as fd
from smplwise.services import wiskey_people_csv as wpc
from smplwise.services.wiskey_capture_port import PortError

NOW = datetime(2026, 10, 25, 12, 0, 0, tzinfo=timezone.utc)
BINDING = {"authority_ref": "arx-authority-1", "authority_revision": 7, "scope_ref": "arx-people-scope", "source_epoch": "epoch-7"}
SECRET_NAME = "Synthetic Quokka Person"


class CsvPort(wf.FakeDirectPort):
    """The preview host: one row per data line, `change_digest` = sha256 of the line, `start` = {request, snapshot with the rows}."""

    def __init__(self) -> None:
        super().__init__()
        self.stamp = "stamp-1"
        self.rules = "rules-1"
        self.previews: list[dict[str, Any]] = []
        self.preview_script: list[Any] = []

    def call(self, command: str, parameters: Mapping[str, Any], *, timeout_s: float) -> Mapping[str, Any]:
        if command != wpc.COMMAND:
            return super().call(command, parameters, timeout_s=timeout_s)
        self.calls.append((command, copy.deepcopy(dict(parameters))))
        if self.preview_script:
            nxt = self.preview_script.pop(0)
            if isinstance(nxt, BaseException):
                raise nxt
            return nxt
        req, snap = self._check_binding(parameters)
        private = snap["private_input"]
        assert req["feature"] == "people_csv" and snap["rows"] == [] and private["kind"] == "csv" and private["mode"] == "create"
        assert set(private) == {"kind", "content", "mode", "column_map"} and snap["permissions"] == ["people/write"]
        lines = [ln for ln in private["content"].splitlines()[1:] if ln.strip()]
        rows = []
        for i, ln in enumerate(lines, start=2):
            rows.append({"grant_id": f"row-{i}", "source_line": i, "user_id": None, "revision": None, "origin_ref": f"origin-{i}-{self.stamp}",
                         "change_digest": hashlib.sha256(ln.encode()).hexdigest()})
        start_snap = copy.deepcopy(snap)
        start_snap["rows"] = [dict(r) for r in rows]
        start_snap["grant_ids"] = [g for g in snap["grant_ids"]] + [r["grant_id"] for r in rows]
        answer = {"schema": "wiskey-people-csv-preview.v1", "review_token": f"token-{len(self.previews)}", "review_stamp": self.stamp, "rules_stamp": self.rules,
                  "rows": [{**r, "grants": {"permission": "people/write", "scope_ref": req["scope_ref"], "station_grant_ids": []}} for r in rows],
                  "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=120)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                  "start": {"request": copy.deepcopy(req), "policy_snapshot": start_snap}}
        self.previews.append(copy.deepcopy(answer))
        return answer

    def _result(self, params: Mapping[str, Any]) -> Mapping[str, Any]:
        if self.result_mode != "finished":
            return super()._result(params)
        op = params["operation_ref"]
        rec = self.ops[op]
        return {"schema_version": 1, "operation_ref": op, "state": "finished", "replay_available": False,
                "receipt": {"state": "completed", "saved": self.saved_rows}}

    saved_rows = 2


@pytest.fixture()
def csvw(settings, monkeypatch, station_scope):  # noqa: F811
    world = World(settings, monkeypatch, station_scope)
    port = CsvPort()
    adapters = fd.FeatureAdapters(fd.DirectFeatureClient(port), port)
    monkeypatch.setattr(wpc, "adapters_provider", lambda: adapters)
    wpc.reset_for_tests()
    world.port = port
    yield world
    wpc.reset_for_tests()
    bp.reset_for_tests()


def two_people() -> str:
    return f"employee_no,display_name\n9001,{SECRET_NAME}\n9002,Second Person\n"


def enable(w: World, user: str = "root", binding: bool = True):
    if binding:
        with w.db.connection() as conn:
            conn.execute("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (wpc.BINDING_KEY, json.dumps(BINDING)))
    return w.c.put(f"{API}/wiskey-csv/settings", json={"enabled": "on"}, headers=as_user(user))


def preview(w: World, body: str, job_id: str | None = None, user: str = "root", key: str = "key-csv-0001"):
    job = w.staged(body, user, key) if job_id is None else {"id": job_id}
    r = w.c.post(f"{API}/jobs/{job['id']}/wiskey-preview", content=body.encode(), headers={**as_user(user), "Content-Type": "text/csv"})
    return job, r


def confirm(w: World, job_id: str, digest: str, typed: str, user: str = "root"):
    return w.c.post(f"{API}/jobs/{job_id}/wiskey-confirm", json={"preview_digest": digest, "confirm": typed}, headers=as_user(user))


def intents(w: World) -> list[dict[str, Any]]:
    with w.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT request_id, state, code, parameter_reference FROM wiskey_feature_intents WHERE feature = 'people_csv'")]


# ================================================================ off by default; who may do what

def test_everything_is_off_by_default_and_nothing_leaves(csvw):
    w = csvw
    s = w.c.get(f"{API}/settings", headers=as_user("root")).json()["wiskey_csv"]
    assert s["enabled"] == "off" and s["available"] is False and "switch_off" in s["blockers"]
    job, r = preview(w, two_people())
    assert r.status_code == 409 and r.json()["code"] == "people_csv_preview_off"
    assert w.port.calls == [] and intents(w) == []


def test_only_a_system_administrator_turns_the_switch(csvw):
    w = csvw
    r = w.c.put(f"{API}/wiskey-csv/settings", json={"enabled": "on"}, headers=as_user("mia"))
    assert r.status_code == 403 and r.json()["code"] == "not_system_admin"
    assert enable(w).status_code == 200
    assert [a["decision"] for a in w.audit("settings.changed")][-1] == "allowed"


def test_the_switch_and_the_binding_are_never_restored_from_an_archive():
    from smplwise.services import backup

    text = open(backup.__file__, encoding="utf-8").read()
    assert wpc.FLAG_KEY in text and wpc.BINDING_KEY in text


def test_without_the_owner_binding_nothing_is_sent_and_the_screen_says_why(csvw):
    w = csvw
    assert enable(w, binding=False).status_code == 200
    assert "binding_not_configured" in w.c.get(f"{API}/settings", headers=as_user("root")).json()["wiskey_csv"]["blockers"]
    job, r = preview(w, two_people())
    assert r.status_code == 503 and r.json()["details"]["reason"] == "binding_not_configured"
    assert w.port.calls == []


def test_a_caller_without_people_manage_and_a_bearer_session_are_refused(csvw, monkeypatch):
    from smplwise.services import intercom_writes as iw

    w = csvw
    enable(w)
    job = w.staged(two_people())
    r = w.c.post(f"{API}/jobs/{job['id']}/wiskey-preview", content=two_people().encode(), headers={**as_user("otto"), "Content-Type": "text/csv"})
    assert r.status_code in (403, 404)
    monkeypatch.setattr(iw, "interactive", lambda principal: False)
    _, r = preview(w, two_people(), job["id"])
    assert r.status_code == 403 and r.json()["code"] == "bulk_interactive_only"
    assert w.port.calls == []


def test_only_creates_with_mapped_columns_are_previewed_and_the_reason_names_columns_only(csvw):
    w = csvw
    enable(w)
    _, r = preview(w, "person_id,revision,display_name\nu1,1,Someone\n", key="key-csv-0002")
    assert r.status_code == 422 and r.json()["details"]["reason"] == "csv_mode_not_identified"
    _, r = preview(w, "employee_no,display_name,doors\n9001,Someone,entry-a:1\n", key="key-csv-0003")
    assert r.status_code == 422 and r.json()["details"] == {"reason": "csv_columns_not_identified", "outcome": "local", "fields": ["doors"]}
    assert "Someone" not in r.text and w.port.calls == []


def test_a_different_file_than_the_staged_one_is_refused(csvw):
    w = csvw
    enable(w)
    job = w.staged(two_people())
    _, r = preview(w, two_people() + "9003,Third\n", job["id"])
    assert r.status_code == 409 and r.json()["code"] == "csv_file_changed" and w.port.calls == []


# ================================================================ the preview is a read

def test_the_preview_writes_nothing_and_shows_lines_not_values(csvw):
    w = csvw
    enable(w)
    job, r = preview(w, two_people())
    assert r.status_code == 200, r.text
    view = r.json()["preview"]
    assert view["writes"] == 2 and view["creates"] == 2 and view["updates"] == 0 and [x["source_line"] for x in view["rows"]] == [2, 3]
    assert [c for c, _ in w.port.calls] == [wpc.COMMAND]
    assert intents(w) == [], "a preview is a read: no intent is stored"
    sent = w.port.calls[0][1]
    assert sent["policy_snapshot"]["rows"] == [] and sent["policy_snapshot"]["private_input"]["column_map"] == {"employee_no": "employee_no", "display_name": "display_name"}
    assert SECRET_NAME not in r.text and SECRET_NAME not in json.dumps(w.audit()), "no cell value in a response or in the audit"
    assert "review_token" not in r.text and "start" not in view and "fingerprint_key" not in r.text


def test_a_malformed_wisKey_answer_is_not_a_preview_and_nothing_is_held(csvw):
    w = csvw
    enable(w)
    w.port.preview_script.append({"schema": "x", "rows": []})
    job, r = preview(w, two_people())
    assert r.status_code == 502 and r.json()["details"]["reason"] == "invalid_response"
    r = confirm(w, job["id"], "0" * 64, "2")
    assert r.status_code == 409 and r.json()["code"] == "preview_stale"
    assert [c for c, _ in w.port.calls] == [wpc.COMMAND]


def test_a_refusal_and_a_lost_answer_are_reported_as_what_they_are(csvw):
    w = csvw
    enable(w)
    w.port.preview_script.append(PortError("policy_binding_denied", "refused"))
    _, r = preview(w, two_people(), key="key-csv-0004")
    assert r.status_code == 409 and r.json()["code"] == "people_csv_refused"
    w.port.preview_script.append(PortError("timeout", "unknown"))
    _, r = preview(w, two_people(), key="key-csv-0005")
    assert r.status_code == 502 and r.json()["code"] == "people_csv_unknown"
    w.port.preview_script.append(PortError("wiskey_direct_not_connected", "not_sent"))
    _, r = preview(w, two_people(), key="key-csv-0006")
    assert r.status_code == 503 and r.json()["retryable"] is True


def test_the_closed_reader_rejects_every_other_shape():
    req = {"request_id": "r1"}
    good = {"schema": "s", "review_token": "t", "review_stamp": "a", "rules_stamp": "b", "expires_at": "2037-01-01T00:00:00Z",
            "rows": [{"grant_id": "g", "source_line": 2, "user_id": None, "revision": None, "origin_ref": "o", "change_digest": "d",
                      "grants": {"permission": "people/write", "scope_ref": "s", "station_grant_ids": []}}],
            "start": {"request": req, "policy_snapshot": {"rows": [{}]}}}
    assert wpc.read_preview(good, req, now=NOW).rows[0].op == "create"

    def broken(mutate) -> dict[str, Any]:
        value = copy.deepcopy(good)
        mutate(value)
        return value

    for mutate in (lambda v: v.update(extra=1), lambda v: v.pop("rules_stamp"), lambda v: v["rows"][0].update(extra=1),
                   lambda v: v["rows"][0]["grants"].update(permission="people/read"), lambda v: v["rows"][0].update(source_line=0),
                   lambda v: v["rows"][0].update(revision=0), lambda v: v["rows"].append(copy.deepcopy(v["rows"][0])),
                   lambda v: v["start"].update(subscription=1), lambda v: v["start"]["policy_snapshot"].update(rows=[]),
                   lambda v: v.update(review_stamp=5), lambda v: v.update(expires_at="not a time")):
        with pytest.raises(wpc.CsvError) as err:
            wpc.read_preview(broken(mutate), req, now=NOW)
        assert err.value.outcome == "unknown" and err.value.code == "invalid_response"
    with pytest.raises(wpc.CsvError) as err:
        wpc.read_preview(broken(lambda v: v["start"].update(request={"request_id": "other"})), req, now=NOW)
    assert err.value.code == "start_request_changed"
    with pytest.raises(wpc.CsvError) as err:
        wpc.read_preview(good, req, now=datetime(2038, 1, 1, tzinfo=timezone.utc))
    assert err.value.code == "preview_expired"
    with pytest.raises(wpc.CsvError):
        wpc.read_preview("nope", req, now=NOW)


# ================================================================ the explicit confirm

def test_confirm_rules_come_before_any_start(csvw, monkeypatch):
    from smplwise.services import intercom_writes as iw

    w = csvw
    enable(w)
    job, r = preview(w, two_people())
    digest = r.json()["preview"]["preview_digest"]
    assert confirm(w, job["id"], digest, "2", user="mia").status_code == 404, "another user's job is not found"
    from smplwise.routers import bulk_people as router

    is_admin_original = router.is_system_admin
    monkeypatch.setattr(router, "is_system_admin", lambda conn, user_id: False)
    r = confirm(w, job["id"], digest, "2")
    assert r.status_code == 403 and r.json()["code"] == "not_system_admin"
    monkeypatch.setattr(router, "is_system_admin", is_admin_original)
    assert confirm(w, job["id"], "0" * 64, "2").json()["code"] == "bulk_plan_changed"
    r = confirm(w, job["id"], digest, "3")
    assert r.status_code == 422 and r.json()["code"] == "bulk_confirm_mismatch"
    monkeypatch.setattr(iw, "interactive", lambda principal: False)
    r = confirm(w, job["id"], digest, "2")
    assert r.status_code == 403 and r.json()["code"] == "bulk_interactive_only"
    assert [c for c, _ in w.port.calls] == [wpc.COMMAND] and intents(w) == []
    assert {a["decision"] for a in w.audit("access.bulk.wiskey_confirm")} == {"denied"}


def test_confirm_takes_a_fresh_preview_compares_it_and_starts_it_unchanged_through_the_intent_log(csvw):
    w = csvw
    enable(w)
    job, r = preview(w, two_people())
    digest = r.json()["preview"]["preview_digest"]
    r = confirm(w, job["id"], digest, "2")
    assert r.status_code == 200, r.text
    assert r.json()["operation"] == {"state": "running", "replay_available": False}
    assert [c for c, _ in w.port.calls] == [wpc.COMMAND, wpc.COMMAND, "features/start"]
    started = w.port.calls[2][1]
    assert started == w.port.previews[1]["start"], "the FRESH preview's start, byte for byte"
    assert started != w.port.previews[0]["start"] or started["request"]["request_id"] != w.port.previews[0]["start"]["request"]["request_id"]
    rows = intents(w)
    assert len(rows) == 1 and rows[0]["state"] == "sent" and rows[0]["code"].startswith("op:")
    assert rows[0]["parameter_reference"] == wpc.reference_of(job["id"])
    assert "access.bulk.wiskey_confirm" in [a["action"] for a in w.audit()] and SECRET_NAME not in json.dumps(w.audit())
    # the second confirm and a re-preview-then-confirm of the same job never start again
    r2 = confirm(w, job["id"], digest, "2")
    assert r2.status_code == 409 and r2.json()["code"] == "preview_stale"
    _, r3 = preview(w, two_people(), job["id"])
    r3 = confirm(w, job["id"], r3.json()["preview"]["preview_digest"], "2")
    assert r3.status_code == 409 and r3.json()["code"] == "csv_already_started"
    assert [c for c, _ in w.port.calls].count("features/start") == 1
    # the completion read
    res = w.c.get(f"{API}/jobs/{job['id']}/wiskey-result", headers=as_user("root"))
    assert res.status_code == 200 and res.json()["operation"] == {"state": "finished", "saved": 2, "replay_available": False}
    assert [c for c, _ in w.port.calls].count("features/result") == 1


def test_a_preview_that_changed_since_it_was_shown_starts_nothing(csvw):
    w = csvw
    enable(w)
    job, r = preview(w, two_people())
    digest = r.json()["preview"]["preview_digest"]
    w.port.stamp = "stamp-2"  # the access system's repository moved on after the person looked
    r = confirm(w, job["id"], digest, "2")
    assert r.status_code == 409 and r.json()["code"] == "preview_changed"
    assert "features/start" not in [c for c, _ in w.port.calls] and intents(w) == []
    assert confirm(w, job["id"], digest, "2").json()["code"] == "preview_stale"  # the held text is gone; the person previews again


def test_a_lost_start_answer_is_unknown_is_never_resent_and_blocks_a_second_start(csvw):
    w = csvw
    enable(w)
    w.port.start_script.append("ack_loss")
    job, r = preview(w, two_people())
    r = confirm(w, job["id"], r.json()["preview"]["preview_digest"], "2")
    assert r.status_code == 200 and r.json()["operation"]["state"] == "unknown" and r.json()["operation"]["replay_available"] is False
    assert intents(w)[0]["state"] == "unknown"
    _, p2 = preview(w, two_people(), job["id"])
    r = confirm(w, job["id"], p2.json()["preview"]["preview_digest"], "2")
    assert r.status_code == 409 and r.json()["code"] == "csv_already_started"
    assert [c for c, _ in w.port.calls].count("features/start") == 1
    res = w.c.get(f"{API}/jobs/{job['id']}/wiskey-result", headers=as_user("root"))
    assert res.json()["operation"]["state"] == "unknown", "no operation_ref was ever acknowledged: nothing to read, nothing replayed"


def test_a_refused_start_is_reported_and_frees_nothing_silently(csvw):
    w = csvw
    enable(w)
    w.port.start_script.append("refuse:policy_revision_conflict")
    job, r = preview(w, two_people())
    r = confirm(w, job["id"], r.json()["preview"]["preview_digest"], "2")
    assert r.status_code == 409 and r.json()["details"]["reason"] == "policy_revision_conflict"
    assert intents(w)[0]["state"] == "refused"


def test_a_start_that_cannot_leave_may_be_tried_again_from_a_new_preview(csvw):
    w = csvw
    enable(w)
    w.port.start_script.append("not_sent")
    job, r = preview(w, two_people())
    r = confirm(w, job["id"], r.json()["preview"]["preview_digest"], "2")
    assert r.status_code == 503 and r.json()["retryable"] is True
    _, p2 = preview(w, two_people(), job["id"])
    r = confirm(w, job["id"], p2.json()["preview"]["preview_digest"], "2")
    assert r.status_code == 200 and r.json()["operation"]["state"] == "running"


def test_cancel_drops_the_held_text(csvw):
    w = csvw
    enable(w)
    job, r = preview(w, two_people())
    assert wpc.held(job["id"]) is not None
    assert w.c.post(f"{API}/jobs/{job['id']}/cancel", headers=as_user("root")).status_code == 200
    assert wpc.held(job["id"]) is None


def test_the_held_text_is_bounded_and_expires():
    wpc.reset_for_tests()
    import time

    for i in range(wpc.STORE_MAX + 5):
        wpc.hold(f"j{i}", wpc.Held("u", b"x", [], "d", 1, time.monotonic() + 100 + i))
    assert len(wpc._HELD) == wpc.STORE_MAX
    wpc.hold("old", wpc.Held("u", b"x", [], "d", 1, time.monotonic() - 1))
    assert wpc.held("old") is None
    wpc.reset_for_tests()


def test_the_module_never_computes_a_stamp_or_a_digest_of_its_own_rows():
    text = open(wpc.__file__, encoding="utf-8").read()
    assert "hmac" not in text.lower() and "fingerprint_key" not in text.replace("fingerprint_key never", "").replace("`fingerprint_key`", "")
    assert "RowGrantInput" not in text, "the rows are WisKey's; Arx does not synthesise a row grant"
