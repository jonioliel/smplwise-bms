"""WISKEY-WA-QUEUE-2400 (T12): messaging completion on the installed WisKey client - registry refresh, the durable template queue
(enqueue / job / cancel), the v3 send-now outcome and the opt-in versioned paced free-text send - against FAKES only.

Nothing here contacts WisKey, a station, Home Assistant or a phone. The installed client's five direct commands are answered by
`FakeInstalledWiskey` below (shaped like rc.10's native_installation_api.py + native_template_jobs.py + whatsapp_template_api_v2.send_v3);
the people directory and the free-text send are the messaging fake's (tests/fake_wiskey_messaging.py), extended here with rc.10's
`whatsapp/send_pacing_v1`. The code permit `TEMPLATE_SEND_SUPPORTED` is opened INSIDE a test only."""
from __future__ import annotations

import asyncio
import copy
import datetime as dt
import json
import uuid
from pathlib import Path
from typing import Any

import pytest
from fake_wiskey import ok
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_intercom_messaging import audits, details, enable, mc, messages, req, rows  # noqa: F401 - `mc` is a fixture

from smplwise.services import intercom_messaging_adapter as adapter
from smplwise.services import intercom_sync
from smplwise.services import wa_template_send as wts
from smplwise.services import wiskey_channels as ch
from smplwise.services import wiskey_installed_features as wif
from smplwise.services import wiskey_wa_queue as wq
from smplwise.services.wiskey_capture_port import PortError

REF = {"id": "access", "name": "synthetic_access", "language": "he", "params": ["name"], "purpose": "notice",
       "template_ref": "synthetic-template", "template_revision": 3}
PHONE_FRAGMENT = "+97250"
BACKEND = Path(__file__).resolve().parents[1]


def public(op: str, row: dict[str, Any] | None) -> dict[str, Any]:
    if row is None:
        return {"schema_version": 1, "state": "unknown", "result": None, "operation_id": op, "replay_available": False}
    return {"schema_version": 1, "state": row["state"], "result": copy.deepcopy(row["result"]), "operation_id": op, "replay_available": False}


def accepted_v2() -> dict[str, Any]:
    return wts.closed_result(2, "accepted", "provider_accepted", True)


class FakeInstalledWiskey:
    """The installed client's five direct commands, in memory. `selected` = what the join's discovery lists now; `refuse[command]` =
    one (code, outcome) PortError for the next call of that command; `v3` = answers of template_send_v3 in order. Nothing is sent."""

    def __init__(self) -> None:
        self.selected = set(wq.DIRECT_COMMANDS)
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.jobs: dict[str, dict[str, Any]] = {}
        self.refuse: dict[str, tuple[str, str]] = {}
        self.v3: list[Any] = []
        self.registry: Any = {"schema_version": 1, "state": "ready", "templates": [
            {"account": "native-acct", "template_ref": "wk-ref-1", "expected_template_revision": 2, "template_name": "door_code", "language": "he"}]}

    def call(self, command: str, parameters: dict[str, Any], *, timeout_s: float) -> Any:
        assert timeout_s > 0
        self.calls.append((command, copy.deepcopy(parameters)))
        if command in self.refuse:
            code, outcome = self.refuse.pop(command)
            raise PortError(code, outcome)
        if command == wq.REGISTRY_COMMAND:
            return copy.deepcopy(self.registry)
        if command == wq.ENQUEUE_COMMAND:
            assert set(parameters) == {"template", "ttl_s"} and 1 <= parameters["ttl_s"] <= 300
            op = parameters["template"]["operation_id"]
            self.jobs.setdefault(op, {"state": "queued", "result": None, "request": parameters["template"]})
            return public(op, self.jobs[op])
        if command == wq.JOB_COMMAND:
            return public(parameters["operation_id"], self.jobs.get(parameters["operation_id"]))
        if command == wq.CANCEL_COMMAND:
            row = self.jobs.get(parameters["operation_id"])
            if row and row["state"] == "queued":
                row.update(state="cancelled", result={"state": "not_sent", "code": "cancelled_before_dispatch"})
            return public(parameters["operation_id"], row)
        if command == wq.SEND_V3_COMMAND:
            assert set(parameters) == {"schema_version", "template"} and parameters["schema_version"] == 3
            nxt = self.v3.pop(0) if self.v3 else {"contract": "wiskey-template-outcome.v3", "schema_version": 3, "template_result": accepted_v2(),
                                                  "pacing_outcome": None, "replay_available": False}
            if isinstance(nxt, BaseException):
                raise nxt
            return nxt
        raise AssertionError(f"command outside the installed client: {command}")

    def finish(self, op: str, state: str, result: dict[str, Any]) -> None:
        self.jobs[op].update(state=state, result=result)

    def sent(self, command: str) -> list[dict[str, Any]]:
        return [p for c, p in self.calls if c == command]


@pytest.fixture()
def env(mc, monkeypatch):  # noqa: F811
    """Messaging ENABLED, the template switch + references saved, the permit still CLOSED, and the fake installed client as the join's
    port. `open_permit()` opens the code permit for this test only."""
    fake, c, s = mc
    enable(c)
    wk = FakeInstalledWiskey()
    monkeypatch.setattr(wq, "port_for", lambda command: wk if command in wk.selected else None)
    r = req(c, "PUT", "/messaging/template-send", json={"enabled": True, "templates": [REF]})
    assert r.status_code == 200, r.text

    def open_permit() -> None:
        monkeypatch.setattr(adapter, "TEMPLATE_SEND_SUPPORTED", True)

    return c, s, wk, open_permit


def token_of(c: Any, person: str = "u1") -> str:
    r = req(c, "POST", f"/people/{person}/messages/template-v2/preview", json={"template_id": "access"})
    assert r.status_code == 200, r.text
    return r.json()["preview"]["token"]


def send(c: Any, mode: str, token: str | None = None, person: str = "u1", user: str = "root", **over: Any) -> Any:
    intercom_sync.SYNC._buckets_reset()
    body = {"client_request_id": uuid.uuid4().hex, "confirmed": True, "template_id": "access", "preview_token": token or "x" * 16, "mode": mode, **over}
    return req(c, "POST", f"/people/{person}/messages/template-installed", user, json=body)


def job(c: Any, op: str, person: str = "u1", user: str = "root") -> Any:
    intercom_sync.SYNC._buckets_reset()
    return req(c, "GET", f"/people/{person}/messages/template-installed/{op}", user)


def cancel(c: Any, op: str, person: str = "u1", user: str = "root") -> Any:
    intercom_sync.SYNC._buckets_reset()
    return req(c, "POST", f"/people/{person}/messages/template-installed/{op}/cancel", user, json={})


def blocked(s: Any, account: str = "wa-1") -> bool:
    from smplwise.db import Database
    from smplwise.services import messaging_runtime as mr

    now = dt.datetime.now(dt.timezone.utc)
    with Database(s.db_path).connection(mode="read") as conn:
        return mr.pacer_on(conn).blocked_until(f"wiskey:{account}", "person:u1", now) > now


# ================================================================ gates: nothing loosened

def test_with_the_production_permit_closed_nothing_reaches_wiskey_in_either_mode(env):
    c, s, wk, _open = env
    assert adapter.TEMPLATE_SEND_SUPPORTED is False and wts.permit() is False
    tok = token_of(c)
    for mode in ("queue", "now"):
        r = send(c, mode, tok)
        assert r.status_code == 409 and r.json()["code"] == "template_v2_unavailable", r.text
    assert wk.calls == [] and messages(s) == []
    denied = [a for a in audits(s) if a["decision"] == "denied" and details(a).get("kind") == "template_installed"]
    assert len(denied) == 2 and all(details(a)["outcome"] == "not_sent" for a in denied)


def test_the_template_switch_off_refuses_before_the_permit_is_even_consulted(env):
    c, s, wk, open_permit = env
    open_permit()
    tok = token_of(c)
    assert req(c, "PUT", "/messaging/template-send", json={"enabled": False}).status_code == 200
    r = send(c, "queue", tok)
    assert r.status_code == 409 and r.json()["code"] == "template_send_off" and wk.calls == [] and messages(s) == []


def test_a_command_the_join_does_not_select_refuses_before_the_record(env):
    c, s, wk, open_permit = env
    open_permit()
    wk.selected = set()
    r = send(c, "queue", token_of(c))
    assert r.status_code == 409 and r.json()["code"] == "template_installed_unavailable"
    assert r.json()["details"]["reason"] == "transport_not_selected" and wk.calls == [] and messages(s) == []


def test_a_viewer_may_neither_send_nor_read_nor_cancel_a_job(env):
    c, s, wk, open_permit = env
    open_permit()
    r = send(c, "queue", token_of(c))
    op = r.json()["job"]["operation_id"]
    assert send(c, "queue", token_of(c), user="vera").status_code == 403
    assert job(c, op, user="vera").status_code == 403 and cancel(c, op, user="vera").status_code == 403
    assert len(wk.sent(wq.ENQUEUE_COMMAND)) == 1 and wk.sent(wq.CANCEL_COMMAND) == []


def test_confirmation_stale_token_and_opt_out_refuse_exactly_as_the_v2_route(env):
    c, s, wk, open_permit = env
    open_permit()
    tok = token_of(c)
    assert send(c, "queue", tok, confirmed=False).json()["code"] == "confirmation_required"
    assert send(c, "queue", "0" * 32).json()["code"] == "template_v2_preview_stale"
    assert req(c, "PUT", "/people/u1/messages/optout", json={"opted_out": True}).status_code == 200
    assert send(c, "now", tok).json()["code"] == "message_no_consent"
    assert send(c, "later", tok).status_code == 422  # an unknown mode is a validation error
    assert wk.calls == [] and messages(s) == []


# ================================================================ the durable queue

def test_enqueue_records_first_hands_the_closed_descriptor_once_and_answers_pending(env):
    c, s, wk, open_permit = env
    open_permit()
    r = send(c, "queue", token_of(c))
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["message"]["outcome"] == "pending" and body["message"]["delivery"] == "unknown"
    assert body["job"]["state"] == "queued" and body["job"]["outcome"] == "pending"
    (p,) = wk.sent(wq.ENQUEUE_COMMAND)
    t = p["template"]
    assert p["ttl_s"] == wq.QUEUE_TTL_S and set(t) == wts.V2_REQUEST_KEYS and t["schema_version"] == 2
    assert t["operation_id"] == body["job"]["operation_id"] and t["operation_id"].startswith("tplq-")
    assert t["request_id"] == body["message"]["id"] and t["recipient_ref"] == "u1" and t["template_ref"] == "synthetic-template"
    assert not any("consent" in k or "phone" in k or "param" in k or "pin" in k for k in t)
    (m,) = messages(s)
    assert m["outcome"] == "pending" and m["kind"] == "template"
    (listed,) = req(c, "GET", "/messaging/installed").json()["jobs"]
    assert set(listed) == {"operation_id", "template_id", "person_id", "state", "outcome", "code", "created_at", "updated_at"}  # InstalledJob
    (row,) = rows(s, "SELECT * FROM wiskey_template_jobs")
    assert (row["state"], row["outcome"], row["person_id"], row["template_id"]) == ("queued", "pending", "u1", "access")
    blob = json.dumps({"a": rows(s, "SELECT * FROM audit_log"), "m": messages(s), "j": rows(s, "SELECT * FROM wiskey_template_jobs")}, ensure_ascii=False)
    assert PHONE_FRAGMENT not in blob and "synthetic-template" not in blob


def test_a_job_read_settles_the_record_once_accepted_is_sent_and_delivery_stays_unknown(env):
    c, s, wk, open_permit = env
    open_permit()
    op = send(c, "queue", token_of(c)).json()["job"]["operation_id"]
    r = job(c, op)
    assert r.status_code == 200 and r.json()["fresh"] is True and r.json()["job"]["outcome"] == "pending"
    assert messages(s)[0]["outcome"] == "pending"
    wk.finish(op, "completed", accepted_v2())
    r = job(c, op)
    assert r.json()["job"]["outcome"] == "accepted" and r.json()["job"]["state"] == "completed"
    (m,) = messages(s)
    assert m["outcome"] == "sent"
    # a later contradicting document never downgrades the recorded terminal outcome
    wk.finish(op, "unknown", {"state": "unknown", "code": "ack_lost_no_replay"})
    assert job(c, op).json()["job"]["outcome"] == "accepted" and messages(s)[0]["outcome"] == "sent"
    assert len(wk.sent(wq.ENQUEUE_COMMAND)) == 1  # never enqueued again


def test_an_unknown_job_is_recorded_unknown_and_nothing_is_retried(env):
    c, s, wk, open_permit = env
    open_permit()
    op = send(c, "queue", token_of(c)).json()["job"]["operation_id"]
    wk.finish(op, "unknown", {"state": "unknown", "code": "ack_lost_no_replay"})
    r = job(c, op)
    assert r.json()["job"]["outcome"] == "unknown" and r.json()["job"]["code"] == "ack_lost_no_replay"
    assert messages(s)[0]["outcome"] == "unknown"
    assert len(wk.sent(wq.ENQUEUE_COMMAND)) == 1 and wk.sent(wq.SEND_V3_COMMAND) == []


def test_a_job_wiskey_paced_is_not_sent_with_its_reason_and_slows_arx_budget(env):
    c, s, wk, open_permit = env
    open_permit()
    op = send(c, "queue", token_of(c)).json()["job"]["operation_id"]
    assert not blocked(s)
    wk.finish(op, "completed", {**wts.closed_result(2, "not_sent", "source_or_admission_refused", False), "retry_after_s": None,
                                "pacing_outcome": {"schema_version": 1, "state": "not_sent", "code": "rate_limited", "retry_after_s": 90,
                                                   "retry_after_source": "original_local_ledger", "observed_at": "2026-11-04T09:00:00+00:00",
                                                   "prior_unknown_retry": False}})
    r = job(c, op)
    assert r.json()["job"]["outcome"] == "not_sent"
    (m,) = messages(s)
    assert m["outcome"] == "refused" and m["reason"] == "rate_limited"
    assert blocked(s)  # WisKey's ledger delay holds Arx's next send on that account


def test_an_expired_queue_entry_reads_not_sent_queue_expired(env):
    c, s, wk, open_permit = env
    open_permit()
    op = send(c, "queue", token_of(c)).json()["job"]["operation_id"]
    wk.finish(op, "completed", {"state": "not_sent", "code": "queue_expired", "retry_after_s": None})
    job(c, op)
    (m,) = messages(s)
    assert (m["outcome"], m["reason"]) == ("refused", "queue_expired")


def test_cancel_of_a_queued_job_is_not_sent_cancelled_and_a_second_cancel_is_refused(env):
    c, s, wk, open_permit = env
    open_permit()
    op = send(c, "queue", token_of(c)).json()["job"]["operation_id"]
    r = cancel(c, op)
    assert r.status_code == 200 and r.json()["job"]["state"] == "cancelled" and r.json()["job"]["outcome"] == "not_sent"
    (m,) = messages(s)
    assert (m["outcome"], m["reason"]) == ("refused", "cancelled_before_dispatch")
    r = cancel(c, op)
    assert r.status_code == 409 and r.json()["code"] == "message_job_not_cancellable"
    assert len(wk.sent(wq.CANCEL_COMMAND)) == 1
    phases = [details(a).get("phase") for a in audits(s, wq.AUDIT_JOB)]
    assert "cancel" in phases


def test_a_dispatching_job_cannot_be_cancelled_and_stays_pending(env):
    c, s, wk, open_permit = env
    open_permit()
    op = send(c, "queue", token_of(c)).json()["job"]["operation_id"]
    wk.jobs[op]["state"] = "dispatching"
    r = cancel(c, op)
    assert r.status_code == 409 and r.json()["details"]["state"] == "dispatching"
    assert messages(s)[0]["outcome"] == "pending"


def test_a_job_of_another_person_or_an_unknown_job_is_not_found(env):
    c, s, wk, open_permit = env
    open_permit()
    op = send(c, "queue", token_of(c)).json()["job"]["operation_id"]
    assert job(c, op, person="u2").status_code in (403, 404)
    assert job(c, "tplq-" + "0" * 32).status_code == 404
    assert job(c, "not-an-operation").status_code == 422


def test_without_the_job_read_the_stored_record_is_shown_not_fresh(env):
    c, s, wk, open_permit = env
    open_permit()
    op = send(c, "queue", token_of(c)).json()["job"]["operation_id"]
    wk.selected.discard(wq.JOB_COMMAND)
    r = job(c, op)
    assert r.status_code == 200 and r.json()["fresh"] is False and r.json()["reason"] == "transport_not_selected"
    assert r.json()["job"]["state"] == "queued"


@pytest.mark.parametrize(("refusal", "status", "outcome", "kept"), [
    (("installation_unavailable", "refused"), 502, "refused", True),       # policy B: WisKey's authority is absent (pre-effect)
    (("template_capacity_or_request_conflict", "refused"), 502, "refused", True),
    (("installation_identity_changed", "refused"), 504, "unknown", True),  # may come after the job was saved: unknown
    (("wiskey_direct_not_connected", "not_sent"), 409, "not_sent", False),  # nothing was written: the record goes
    (("timeout", "unknown"), 504, "unknown", True),
])
def test_enqueue_failures_keep_their_honest_word(env, refusal, status, outcome, kept):
    c, s, wk, open_permit = env
    open_permit()
    wk.refuse[wq.ENQUEUE_COMMAND] = refusal
    r = send(c, "queue", token_of(c))
    assert r.status_code == status, r.text
    assert r.json()["details"]["outcome"] == outcome
    assert len(wk.sent(wq.ENQUEUE_COMMAND)) == 1
    if kept:
        (m,) = messages(s)
        assert m["outcome"] == outcome
    else:
        assert messages(s) == []


def test_a_repeated_attempt_id_never_enqueues_twice(env):
    c, s, wk, open_permit = env
    open_permit()
    tok = token_of(c)
    cid = uuid.uuid4().hex
    assert send(c, "queue", tok, client_request_id=cid).status_code == 202
    r = send(c, "queue", tok, client_request_id=cid)
    assert r.status_code == 409 and r.json()["code"] == "message_duplicate"
    assert len(wk.sent(wq.ENQUEUE_COMMAND)) == 1


# ================================================================ v3: send now

def test_v3_accepted_is_sent_with_the_v3_wire(env):
    c, s, wk, open_permit = env
    open_permit()
    r = send(c, "now", token_of(c))
    assert r.status_code == 200, r.text
    assert r.json()["message"]["outcome"] == "sent" and r.json()["message"]["delivery"] == "unknown"
    (p,) = wk.sent(wq.SEND_V3_COMMAND)
    assert p["schema_version"] == 3 and set(p["template"]) == wts.V2_REQUEST_KEYS and p["template"]["operation_id"].startswith("tplv3-")
    (m,) = messages(s)
    assert m["outcome"] == "sent"
    assert details(audits(s)[-1])["result_version"] == 3


def test_v3_wiskey_pacing_is_not_sent_with_wiskeys_delay_and_slows_arx(env):
    c, s, wk, open_permit = env
    open_permit()
    wk.v3.append({"contract": "wiskey-template-outcome.v3", "schema_version": 3,
                  "template_result": wts.closed_result(2, "not_sent", "source_or_admission_refused", False),
                  "pacing_outcome": {"schema_version": 1, "state": "not_sent", "code": "rate_limited", "retry_after_s": 42,
                                     "retry_after_source": "original_local_ledger", "observed_at": "2026-11-04T09:00:00+00:00",
                                     "prior_unknown_retry": False}, "replay_available": False})
    r = send(c, "now", token_of(c))
    assert r.status_code == 429 and r.json()["code"] == "message_paced_wiskey" and r.json()["details"]["retry_after_s"] == 42
    (m,) = messages(s)
    assert (m["outcome"], m["reason"]) == ("refused", "rate_limited")
    assert blocked(s)


@pytest.mark.parametrize(("answer", "status", "outcome"), [
    ({"contract": "wiskey-template-outcome.v3", "schema_version": 3, "template_result": accepted_v2(), "pacing_outcome": None,
      "replay_available": True}, 504, "unknown"),                                           # a replay claim: not the closed document
    ({"state": "accepted"}, 504, "unknown"),
    (PortError("installation_unavailable", "refused"), 502, "refused"),
    (PortError("revision_conflict", "refused"), 504, "unknown"),
    (PortError("wiskey_direct_not_connected", "not_sent"), 409, "not_sent"),
    (PortError("timeout", "unknown"), 504, "unknown"),
], ids=["replay", "not_closed", "policy_b", "late_refusal", "not_written", "timeout"])
def test_v3_failures_keep_their_honest_word(env, answer, status, outcome):
    c, s, wk, open_permit = env
    open_permit()
    wk.v3.append(answer)
    r = send(c, "now", token_of(c))
    assert r.status_code == status, r.text
    assert r.json()["details"]["outcome"] == outcome
    assert len(wk.sent(wq.SEND_V3_COMMAND)) == 1  # never retried
    if outcome == "not_sent":
        assert messages(s) == []
    else:
        assert messages(s)[0]["outcome"] == outcome


# ================================================================ the registry and the administrator's overview

def test_the_overview_is_configure_only_and_says_what_is_and_is_not_there(env):
    c, s, wk, _open = env
    assert req(c, "GET", "/messaging/installed", "vera").status_code == 403
    r = req(c, "GET", "/messaging/installed")
    assert r.status_code == 200, r.text
    j = r.json()
    # the wire shape frontend/src/api/wa-installed.ts (InstalledView) and tests/wa-installed-mock.ts are written against
    assert set(j) == {"settings", "gates", "commands", "registry", "jobs", "queue_ttl_s", "delivery_receipts", "excluded"}
    assert set(j["registry"]) == {"templates", "wiskey_rows", "arx_rows", "native_accounts", "native_sendable", "last_sync"}
    assert set(j["commands"]) == set(wq.DIRECT_COMMANDS) | {wq.SEND_PACING_COMMAND}
    assert set(j["registry"]["templates"][0]) == {"id", "name", "language", "purpose", "source", "account", "template_revision", "bound"}
    assert j["settings"] == {"send_pacing_v1": False}
    assert j["gates"] == {"messaging_enabled": True, "template_switch": True, "permit": False}
    assert all(j["commands"][cmd] is True for cmd in wq.DIRECT_COMMANDS) and j["commands"][wq.SEND_PACING_COMMAND] is False
    assert j["delivery_receipts"] is False and set(j["excluded"]) == {"whatsapp/history", "whatsapp/media", "whatsapp/templates_get", "whatsapp/templates_update"}
    assert j["registry"]["arx_rows"] == 1 and j["registry"]["wiskey_rows"] == 0 and j["registry"]["last_sync"] is None
    assert "synthetic-template" not in r.text and j["queue_ttl_s"] == 120


def test_the_paced_send_opt_in_is_a_boolean_audited_and_off_by_default(env):
    c, s, wk, _open = env
    assert req(c, "PUT", "/messaging/installed", "vera", json={"send_pacing_v1": True}).status_code == 403
    assert req(c, "PUT", "/messaging/installed", json={"send_pacing_v1": "yes"}).status_code == 422
    assert req(c, "PUT", "/messaging/installed", json={"other": 1}).status_code == 422
    r = req(c, "PUT", "/messaging/installed", json={"send_pacing_v1": True})
    assert r.status_code == 200 and r.json()["settings"]["send_pacing_v1"] is True
    (a,) = rows(s, "SELECT * FROM audit_log WHERE action = ?", wq.AUDIT_SETTINGS)
    assert details(a) == {"send_pacing_v1": {"before": False, "after": True}}


def test_registry_sync_merges_wiskeys_rows_keeps_the_administrators_and_is_audited(env):
    c, s, wk, _open = env
    assert req(c, "POST", "/messaging/installed/registry-sync", "vera").status_code == 403
    r = req(c, "POST", "/messaging/installed/registry-sync")
    assert r.status_code == 200, r.text
    reg = r.json()["registry"]
    assert r.json()["sync"] == {"outcome": "synced", "code": None, "native": 1}
    assert reg["arx_rows"] == 1 and reg["wiskey_rows"] == 1 and reg["native_accounts"] == 1 and reg["last_sync"]["outcome"] == "synced"
    native = next(t for t in reg["templates"] if t["source"] == "wiskey")
    assert native["account"] == "native-acct" and native["name"] == "door_code" and native["template_revision"] == 2
    assert reg["native_sendable"] is False  # the automatic installation switch is off: a WisKey-owned row is still not sendable
    assert wk.sent(wq.REGISTRY_COMMAND) == [{}]
    a = rows(s, "SELECT * FROM audit_log WHERE action = ?", wq.AUDIT_SYNC)
    assert len(a) == 1 and a[0]["decision"] == "allowed" and details(a[0]) == {"outcome": "synced", "native": 1}


@pytest.mark.parametrize(("setup", "status", "outcome"), [
    (lambda wk: wk.selected.discard(wq.REGISTRY_COMMAND), 409, "not_sent"),
    (lambda wk: wk.refuse.__setitem__(wq.REGISTRY_COMMAND, ("installation_unavailable", "refused")), 502, "refused"),
    (lambda wk: setattr(wk, "registry", {"schema_version": 1, "state": "ready", "templates": []}), 502, "invalid"),
    (lambda wk: setattr(wk, "registry", {"schema_version": 1, "state": "ready", "templates": [{"account": "a"}]}), 502, "invalid"),
    (lambda wk: wk.refuse.__setitem__(wq.REGISTRY_COMMAND, ("timeout", "unknown")), 504, "unknown"),
], ids=["not_selected", "policy_b", "empty", "malformed", "timeout"])
def test_a_failed_registry_sync_never_changes_the_stored_registry(env, setup, status, outcome):
    c, s, wk, _open = env
    before = req(c, "GET", "/messaging/template-send").json()["templates"]
    setup(wk)
    r = req(c, "POST", "/messaging/installed/registry-sync")
    assert r.status_code == status and r.json()["details"]["outcome"] == outcome, r.text
    assert req(c, "GET", "/messaging/template-send").json()["templates"] == before
    assert req(c, "GET", "/messaging/installed").json()["registry"]["last_sync"]["outcome"] == outcome


# ================================================================ the versioned paced free-text send (opt-in)

def _paced_fake(fake: Any, mode: str) -> None:
    """rc.10's `whatsapp/send_pacing_v1` on the messaging fake: the token / text checks of `whatsapp/send`, answered as the closed
    `whatsapp_send_outcome_v1`. `mode`: `rc10` (a dispatched message is UNKNOWN - rc.10's real behaviour), `accepted`, `paced`."""
    entry = copy.deepcopy(fake.commands["whatsapp/send"])  # rc.10 registers the same five fields (websocket.py)
    entry["request"]["properties"]["type"] = {"const": "hikvision_intercom/whatsapp/send_pacing_v1"}
    fake.commands["whatsapp/send_pacing_v1"] = entry
    original = fake._whatsapp

    def whatsapp(command: str, msg: dict[str, Any]) -> list[Any]:
        if command != "whatsapp/send_pacing_v1":
            return original(command, msg)
        if mode == "paced":
            return [ok(msg, {"schema_version": "whatsapp_send_outcome_v1", "accepted": False, "error": {
                "code": "rate_limited", "send_state": "not_sent", "throttle_scope": "account", "retry_after_s": 37,
                "retry_after_source": "wiskey_local_ledger", "cause": "wiskey_own_pacing"}})]
        (frame,) = original("whatsapp/send", msg)
        if frame.get("success") is not True:
            return [frame]
        if mode == "accepted":
            return [ok(msg, {"schema_version": "whatsapp_send_outcome_v1", "accepted": True, "error": None})]
        return [ok(msg, {"schema_version": "whatsapp_send_outcome_v1", "accepted": False, "error": {
            "code": "whatsapp_send_uncertain", "send_state": "unknown", "throttle_scope": None, "retry_after_s": None,
            "retry_after_source": None, "cause": "ha_service_outcome_unknown"}})]

    fake._whatsapp = whatsapp


def free(c: Any, text: str = "שלום, הכניסה פתוחה") -> Any:
    intercom_sync.SYNC._buckets_reset()
    return req(c, "POST", "/people/u1/messages", json={"client_request_id": uuid.uuid4().hex, "confirmed": True, "text": text})


def _sent_kinds(fake: Any) -> list[str]:
    return [k for k, _o in fake.answered if isinstance(k, str) and k.startswith("whatsapp/send")]


@pytest.mark.parametrize(("mode", "status", "outcome"), [("accepted", 200, "sent"), ("rc10", 504, "unknown"), ("paced", 429, "not_sent")])
def test_the_paced_send_is_used_only_when_opted_in_and_listed_and_reads_the_closed_outcome(env, monkeypatch, mode, status, outcome):
    c, s, wk, _open = env
    fake = env_fake(c)
    _paced_fake(fake, mode)
    monkeypatch.setattr(adapter, "paced_listed", lambda settings: True)
    r = free(c)
    assert r.status_code == 200 and _sent_kinds(fake)[-1] == "whatsapp/send"  # not opted in: the classic send
    assert req(c, "PUT", "/messaging/installed", json={"send_pacing_v1": True}).status_code == 200
    r = free(c)
    assert r.status_code == status, r.text
    assert _sent_kinds(fake)[-1] == "whatsapp/send_pacing_v1"
    if mode == "paced":
        assert r.json()["details"]["retry_after_s"] == 37  # WisKey's ledger delay, not the generic burst wait
    m = messages(s)[-1] if outcome != "not_sent" else None
    if m is not None:
        assert m["outcome"] == outcome


def test_opted_in_but_not_listed_keeps_the_classic_send(env, monkeypatch):
    c, s, wk, _open = env
    fake = env_fake(c)
    _paced_fake(fake, "accepted")
    assert req(c, "PUT", "/messaging/installed", json={"send_pacing_v1": True}).status_code == 200
    monkeypatch.setattr(adapter, "paced_listed", lambda settings: False)
    assert free(c).status_code == 200 and _sent_kinds(fake)[-1] == "whatsapp/send"


_FAKES: dict[int, Any] = {}


@pytest.fixture(autouse=True)
def _remember_fake(request):
    if "mc" in request.fixturenames:
        fake, c, _s = request.getfixturevalue("mc")
        _FAKES[id(c)] = fake
    yield
    _FAKES.clear()


def env_fake(c: Any) -> Any:
    return _FAKES[id(c)]


@pytest.mark.parametrize("frame", [
    {"success": True, "result": {"accepted": True}},                                                     # rc.37's shape is not v1
    {"success": True, "result": {"schema_version": "whatsapp_send_outcome_v1", "accepted": True, "error": {"code": "x"}}},
    {"success": True, "result": {"schema_version": "whatsapp_send_outcome_v1", "accepted": False, "error": {"code": "x", "send_state": "not_sent"}}},
    {"success": False, "error": {"code": "whatsapp_send_uncertain"}},
    None,
], ids=["rc37_shape", "accepted_with_error", "partial_error", "uncertain_frame", "none"])
def test_the_paced_reader_turns_anything_unproven_into_unknown(frame):
    with pytest.raises(adapter.UnclearAnswer):
        adapter._paced_answer(frame, {})


def test_the_paced_reader_reads_a_not_sent_as_a_refusal_with_a_bounded_delay():
    trace: dict[str, Any] = {}
    frame = {"success": True, "result": {"schema_version": "whatsapp_send_outcome_v1", "accepted": False, "error": {
        "code": "rate_limited", "send_state": "not_sent", "throttle_scope": "account", "retry_after_s": 10 ** 9,
        "retry_after_source": "wiskey_local_ledger", "cause": "wiskey_own_pacing"}}}
    with pytest.raises(adapter.IntercomError):
        adapter._paced_answer(frame, trace)
    assert trace["retry_after_s"] is None  # beyond a day: no promise kept


# ================================================================ channels, exclusions, the journal over the Database

def test_the_paced_channel_is_additive_and_carries_exactly_two_commands():
    assert ch.ALLOWLISTS["messaging_paced"] == {"whatsapp/preview", "whatsapp/send_pacing_v1"}
    assert ch.ALLOWLISTS["messaging"] == {"whatsapp/status", "whatsapp/preview", "whatsapp/send"}
    assert "messaging_paced" in ch.ADAPTER_CHANNELS and "messaging_paced" in ch.UNPINNED_CHANNELS
    assert ch.allowed("messaging_paced", "hikvision_intercom/whatsapp/send_pacing_v1")
    for refused in ("hikvision_intercom/whatsapp/send", "hikvision_intercom/whatsapp/history", "hikvision_intercom/whatsapp/status"):
        assert not ch.allowed("messaging_paced", refused)


def test_message_history_and_wiskey_side_template_edits_stay_out_of_arx():
    for name, commands in ch.ALLOWLISTS.items():
        assert not set(wq.EXCLUDED) & set(commands), name
    with pytest.raises(wq.QueueError):
        asyncio.run(wq.PortClient(FakeInstalledWiskey()).call("whatsapp/history", {}))
    for path in (BACKEND / "smplwise").rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        for excluded in wq.EXCLUDED:
            assert f'call("{excluded}"' not in text and f'/{excluded}"' not in text, (path.name, excluded)


def test_template_jobs_work_over_the_database_without_holding_a_transaction(env):
    from smplwise.db import Database

    _c, s, _wk, _open = env
    db = Database(s.db_path)
    wk = FakeInstalledWiskey()
    jobs = wif.TemplateJobs(db)
    tpl = {"schema_version": 2, "request_id": "req-1", "operation_id": "op-1", "recipient_ref": "u1", "expected_person_revision": 1,
           "account": "a", "template_name": "t", "language": "he", "template_ref": "r", "expected_template_revision": 1}
    client = wq.PortClient(wk)
    v = asyncio.run(jobs.enqueue(client, tpl, ttl_s=60, template_id="access", person_id="u1"))
    assert v.outcome == "pending" and jobs.row("op-1")["state"] == "queued"
    assert asyncio.run(jobs.enqueue(client, tpl, ttl_s=60)).outcome == "pending" and len(wk.sent(wq.ENQUEUE_COMMAND)) == 1
    assert asyncio.run(jobs.cancel(client, "op-1")).outcome == "not_sent" and jobs.row("op-1")["state"] == "cancelled"
