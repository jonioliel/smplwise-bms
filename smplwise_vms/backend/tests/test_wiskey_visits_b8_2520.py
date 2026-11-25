"""WISKEY-R6-2520 (WisKey resync row R6, B8): Arx's consumer of `visits/record_external_v1` against WisKey rc.19's contract
`external-visits-v1`, FAKES ONLY. WisKey's synthetic examples and schemas are copied unchanged into
tests/fixtures/wiskey_rc19/external-visits-v1/ (git blob ids in docs/changes/WISKEY-R6-2520.md). Nothing contacts a device, a station,
Home Assistant or WisKey; the producer rc.19 and the real connection stay NOT_MEASURED.

What is proven:
- the contract examples: record.v1 valid passes Arx's check, missing / wrong-type / extra fail it; result.v1 valid projects, the three
  bad ones raise; the request Arx builds has request.v1's keys; the copied schemas match WisKey's SCHEMA_INDEX hashes;
- the record builder fills nothing in: a record Arx cannot make contract-valid (no approval instant, no approver, no end reason, a
  non-UUID person, a window outside 1970..2037, bad doors) is refused in Arx, audited, and nothing is sent; Arx's check and an independent
  port of WisKey's parser (tests/fake_wiskey_visits.normalized_record) agree on every case;
- RECORD ONLY: the push sends exactly one frame, the nine record keys, and no other command; the grant engine's person is unchanged;
- the closed code table: every error.v1 code is classified; `visit_record_outcome_unknown`, `bridge_outcome_unknown` and an unlisted code
  are `unknown` (never refused, never resent); the refusals have their own Hebrew text plus `message_en`;
- a success whose answer is not the sent revision / status, or is not result.v1, is `unknown`;
- idempotency: the same revision sent again is answered with the prior result and changes nothing in WisKey;
- the reconcile: one exact `filters.external_ref` read when the record command is offered (decided past five pages of native rows), the
  revision compared (equal = recorded, older = absent, newer = undecided), and no filter at all while the command is not offered."""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

import pytest
from fake_wiskey_visits import RECORD, Refused, normalized_record, visit_uuid, wiskey_visit
from test_wiskey_visits_2407 import W, audits, invite, link, offered, person_id, sent, vx  # noqa: F401 - vx is the shared fixture
from tickets_world import API

from smplwise.services import intercom_client
from smplwise.services import wiskey_visits as wv
from smplwise.services.intercom_client import IntercomError

FIX = Path(__file__).parent / "fixtures" / "wiskey_rc19" / "external-visits-v1"


def example(name: str) -> dict:
    return json.loads((FIX / "examples" / name).read_text(encoding="utf-8"))


def valid_record() -> dict:
    return example("record.v1.valid.json")


def producer_accepts(record: dict) -> bool:
    try:
        normalized_record(record)
    except Refused:
        return False
    return True


# ---------------------------------------------------------------- the contract examples (pure)

def test_the_copied_schemas_are_wiskeys_bytes():
    index = json.loads((FIX / "SCHEMA_INDEX.json").read_text(encoding="utf-8"))
    for entry in index["schemas"]:
        assert hashlib.sha256((FIX / entry["path"]).read_bytes()).hexdigest() == entry["sha256"], entry["path"]


def test_record_examples_valid_passes_and_the_bad_ones_fail_in_arx_and_in_the_producer_port():
    rows = [e for e in json.loads((FIX / "EXAMPLE_INDEX.json").read_text(encoding="utf-8")) if e["schema"] == "record.v1.schema.json"]
    assert len(rows) == 4
    for e in rows:
        doc = json.loads((FIX / e["file"]).read_text(encoding="utf-8"))
        assert (wv.record_problems(doc) == []) is e["expected_valid"], e["file"]
        assert producer_accepts(doc) is e["expected_valid"], e["file"]
    assert wv.record_problems(example("record.v1.missing.json")) == ["record.keys", "external_ref"]
    assert wv.record_problems(example("record.v1.extra.json")) == ["record.keys"]
    assert wv.record_problems(example("record.v1.wrong-type.json")) == ["external_ref"]


def test_result_examples_valid_projects_and_the_bad_ones_raise():
    good = example("result.v1.valid.json")
    assert wv.project_record(good) == good
    assert wv.project_record(good, expect={"arx_revision": 1, "status": "approved"}) == good
    for name in ("result.v1.missing.json", "result.v1.wrong-type.json", "result.v1.extra.json"):
        with pytest.raises(ValueError):
            wv.project_record(example(name))
    for bad in ({**good, "arx_revision": 2}, {**good, "status": "ended"}):
        with pytest.raises(ValueError):
            wv.project_record(bad, expect={"arx_revision": 1, "status": "approved"})
    for bad in ({**good, "visit_id": "V-ARX-1"}, {**good, "revision": True}, {**good, "revision": 1.0}, {**good, "arx_revision": 0}):
        with pytest.raises(ValueError):
            wv.project_record(bad)


def test_the_request_arx_sends_has_request_v1s_keys_and_the_valid_record_unchanged():
    import asyncio

    frames = []

    async def call(type_, **fields):
        frames.append({"type": type_, **fields})
        return {"success": True, "result": example("result.v1.valid.json")}

    rec = valid_record()
    asyncio.run(wv.record_external(call, rec))
    want = example("request.v1.valid.json")
    assert frames == [{k: v for k, v in want.items() if k != "id"}], "the transport adds the id; nothing else differs"


def test_every_error_v1_code_is_classified_and_the_unknowns_are_never_refused():
    schema = json.loads((FIX / "error.v1.schema.json").read_text(encoding="utf-8"))
    codes = schema["properties"]["error"]["properties"]["code"]["enum"]
    assert len(codes) == 18
    for code in codes:
        frame = {"id": 1, "type": "result", "success": False, "error": {"code": code, "message": "x"}}
        if code in ("visit_record_outcome_unknown", "bridge_outcome_unknown"):
            with pytest.raises(intercom_client.UnclearAnswer):
                wv.record_answer(frame)
        else:
            with pytest.raises(IntercomError) as caught:
                wv.record_answer(frame)
            assert caught.value.code == code
    with pytest.raises(IntercomError):
        wv.record_answer(example("error.v1.valid.json"))
    for frame in ({"success": False, "error": {"code": "storage_write_failed"}}, {"success": False}, {"type": "result"}, None):
        with pytest.raises(intercom_client.UnclearAnswer):
            wv.record_answer(frame)
    assert wv.RECORD_UNKNOWN.isdisjoint(wv.RECORD_REFUSED)
    assert wv.record_answer({"success": True, "result": {"a": 1}}) == {"a": 1}


# ---------------------------------------------------------------- the record rules (pure, cross-checked with the producer port)

def _mutate(path: str, value):
    rec = valid_record()
    if path.startswith("approval."):
        rec["approval"][path.split(".", 1)[1]] = value
    elif path == "-approval.approver_ref":
        del rec["approval"]["approver_ref"]
    else:
        rec[path] = value
    return rec


BAD = [
    ("approval.approved_at", None, "approval.approved_at"),
    ("approval.approver_ref", None, "approval.approver_ref"),
    ("approval.kind", "", "approval.kind"),
    ("approval.kind", "k" * 65, "approval.kind"),
    ("-approval.approver_ref", None, "approval"),
    ("end_reason", "host_cancelled", "end_reason"),  # approved needs null
    ("valid_from", "2026-11-14T08:00:00", "valid_from"),  # no offset
    ("valid_until", "2026-11-14 10:00:00Z", "valid_until"),
    ("valid_until", "2026-11-14T07:00:00Z", "validity"),  # before the start
    ("valid_until", "2038-01-01T00:00:00Z", "validity"),
    ("user_id", "00000000-0000-4000-8000-00000000082A", "user_id"),  # uppercase
    ("user_id", "wk-0001", "user_id"),
    ("arx_revision", True, "arx_revision"),
    ("arx_revision", 0, "arx_revision"),
    ("arx_revision", 1.0, "arx_revision"),
    ("arx_revision", 9_007_199_254_740_992, "arx_revision"),
    ("external_ref", " padded", "external_ref"),
    ("external_ref", "x" * 129, "external_ref"),
    ("doors", {}, "doors"),
    ("doors", {"st": [1, 1]}, "doors"),
    ("doors", {"st": [3]}, "doors"),
    ("doors", {"st": [True]}, "doors"),
    ("doors", {"st": []}, "doors"),
    ("doors", {f"st-{i}": [1] for i in range(101)}, "doors"),
    ("status", "active", "status"),
]


@pytest.mark.parametrize(("path", "value", "problem"), BAD, ids=[f"{p}={v!r}"[:40] for p, v, _ in BAD])
def test_a_bad_value_is_named_by_arx_and_refused_by_the_producer_port(path, value, problem):
    rec = _mutate(path, value)
    assert problem in wv.record_problems(rec)
    assert not producer_accepts(rec)


def test_the_ended_rules_and_the_values_that_stay_valid():
    rec = valid_record()
    assert wv.record_problems({**rec, "status": "ended", "end_reason": None}) == ["end_reason"]
    assert wv.record_problems({**rec, "status": "ended", "end_reason": ""}) == ["end_reason"]
    good_ended = {**rec, "status": "ended", "end_reason": "host_cancelled"}
    assert wv.record_problems(good_ended) == [] and producer_accepts(good_ended)
    for path, value in (("valid_from", "2026-11-14T10:00:00+02:00"), ("valid_until", "2026-11-14T10:00:00.123456Z"),
                        ("doors", {"st-a": [2, 1], "st-b": [2]}), ("external_ref", "a b"), ("arx_revision", 9_007_199_254_740_991)):
        ok_rec = _mutate(path, value)
        assert wv.record_problems(ok_rec) == [], path
        assert producer_accepts(ok_rec), path
    assert wv.record_problems(None) == ["record"]


# ---------------------------------------------------------------- the push, end to end on the fakes

def test_a_record_arx_cannot_make_valid_is_refused_in_arx_and_nothing_is_sent(vx):  # noqa: F811
    fake, env, s = offered(vx)
    v = invite(env)
    env.sql("UPDATE access_grants SET approved_at = NULL WHERE id = ?", v["grant_id"])
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 409 and r.json()["code"] == "wiskey_visits_record_invalid", r.text
    assert r.json()["details"]["problems"] == ["approval.approved_at"] and r.json()["details"]["message_en"]
    assert sent(fake, RECORD) == [] and link(env, v["id"]) is None
    denied = audits(s, wv.AUDIT_PUSH)[-1]
    assert denied["decision"] == "denied" and denied["reason"] == "record_invalid"
    # read through the service: the /links wire model (wire/access_wiskey_visits.py, not this row's file) still requires the pushed-only
    # fields, so a never-pushed link is checked here directly (finding recorded in docs/changes/WISKEY-R6-2520.md)
    with env.db.connection(mode="read") as conn:
        pair = wv._invite_and_grant(conn, v["id"])
        assert wv.link_view(conn, *pair)["pushable"] is False


def test_an_ended_record_carries_the_grants_end_reason_or_is_not_sent(vx):  # noqa: F811
    fake, env, _s = offered(vx)
    v = invite(env)
    env.sql("UPDATE access_grants SET state = 'ended', end_reason = 'ended', revision = revision + 1 WHERE id = ?", v["grant_id"])
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 200, r.text
    frame = sent(fake, RECORD)[-1]["record"]
    assert frame["status"] == "ended" and frame["end_reason"] == "ended"
    env.sql("UPDATE access_grants SET end_reason = NULL, revision = revision + 1 WHERE id = ?", v["grant_id"])
    r2 = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r2.status_code == 409 and r2.json()["details"]["problems"] == ["end_reason"], r2.text
    assert len(sent(fake, RECORD)) == 1
    # WisKey's list now shows the Arx record as `ended` (rc.19 external rows keep their own status)
    items = env.c.get(f"{W}/visits").json()["visits"]["items"]
    assert [i["status"] for i in items if i["source"] == "arx"] == ["ended"]


def test_the_push_is_record_only_one_frame_nine_keys_no_other_command_and_no_person_change(vx):  # noqa: F811
    fake, env, _s = offered(vx)
    v = invite(env)
    before_people = copy.deepcopy(env.engine.people)
    before = len(fake.received)
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 200, r.text
    record_type = intercom_client.command_type(RECORD)
    during = [m for m in fake.received[before:] if m.get("type") == record_type]
    others = [m.get("type") for m in fake.received[before:] if m.get("type") != record_type]
    assert len(during) == 1, "one record frame"
    # the feed may read in the background, but nothing that writes a person, a credential, an activation or a WisKey visit is sent
    assert not [t for t in others if any(w in str(t) for w in ("users/", "cards/", "pin", "activat", "visits/", "grant", "credential"))], others
    assert set(during[0]) == {"id", "type", "api_contract", "record"} and list(during[0]["record"]) == list(wv.RECORD_FIELDS)
    assert set(during[0]["record"]["approval"]) == {"kind", "approved_at", "approver_ref"}
    assert wv.record_problems(during[0]["record"]) == [] and producer_accepts(during[0]["record"])
    assert env.engine.people == before_people, "the record changes no person, credential or activation"
    assert r.json()["record"] == {"visit_id": visit_uuid(801), "revision": 1, "arx_revision": during[0]["record"]["arx_revision"], "status": "approved"}


@pytest.mark.parametrize("code", ["visit_record_outcome_unknown", "bridge_outcome_unknown", "storage_write_failed"])
def test_an_unknown_code_is_unknown_never_refused_and_never_sent_again(vx, code):  # noqa: F811
    fake, env, _s = offered(vx)
    v = invite(env)
    fake.record_answer = code
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 504 and r.json()["code"] == "wiskey_visits_outcome_unknown", r.text
    assert r.json()["details"]["message_en"]
    assert link(env, v["id"])["state"] == "unknown"
    fake.record_answer = "ok"
    again = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert again.status_code == 409 and again.json()["code"] == "wiskey_visits_outcome_unknown"
    assert len(sent(fake, RECORD)) == 1


@pytest.mark.parametrize(("code", "status", "api_code"), [
    ("visit_request_limit", 409, "wiskey_visits_limit"),
    ("user_not_found", 409, "wiskey_visits_person_missing"),
    ("visit_user_not_temporary", 409, "wiskey_visits_person_not_temporary"),
    ("storage_stopping", 409, "wiskey_visits_storage_stopping"),
    ("revision_conflict", 409, "wiskey_visits_revision_conflict"),
    ("writes_disabled", 409, "wiskey_visits_writes_disabled"),
    ("unauthorized", 403, "wiskey_visits_unauthorized"),
    ("invalid_validity", 409, "wiskey_visits_refused"),
])
def test_a_pre_write_refusal_is_refused_with_its_own_text(vx, code, status, api_code):  # noqa: F811
    fake, env, _s = offered(vx)
    v = invite(env)
    fake.record_answer = code
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == status and r.json()["code"] == api_code, r.text
    assert r.json()["details"]["wiskey_code"] == code and r.json()["details"]["message_en"]
    assert link(env, v["id"])["state"] == "refused" and link(env, v["id"])["last_code"] == code


def test_a_success_that_is_not_the_sent_revision_or_not_result_v1_is_unknown(vx):  # noqa: F811
    fake, env, _s = offered(vx)
    v = invite(env)
    real = fake._record

    def skewed(msg):
        return [{**f, "result": {**f["result"], "arx_revision": f["result"]["arx_revision"] + 1}} if f.get("success") else f for f in real(msg)]

    fake._record = skewed
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 504 and r.json()["code"] == "wiskey_visits_outcome_unknown", r.text
    assert link(env, v["id"])["state"] == "unknown"
    rec = env.c.post(f"{W}/{v['id']}/reconcile")
    assert rec.status_code == 200 and rec.json()["verdict"] == "recorded", rec.text  # WisKey holds exactly the sent revision


def test_the_same_revision_sent_again_is_answered_with_the_prior_result_and_changes_nothing(vx):  # noqa: F811
    fake, env, _s = offered(vx)
    v = invite(env)
    assert env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True}).status_code == 200
    env.sql("UPDATE wiskey_visit_links SET state = 'refused' WHERE invite_id = ?", v["id"])  # Arx lost the receipt; an operator pushes again
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 200, r.text
    assert fake.record_frames == 2 and fake.stored == 1 and r.json()["record"]["visit_id"] == visit_uuid(801)
    assert sent(fake, RECORD)[0]["record"] == sent(fake, RECORD)[1]["record"]


# ---------------------------------------------------------------- the reconcile

def _many_native_rows(fake, n: int) -> None:
    fake.visits.extend(wiskey_visit(f"v-native-{i}", f"wk-native-{i}", sequence=100 + i) for i in range(n))


def test_the_reconcile_reads_the_one_row_by_the_exact_reference_past_five_pages(vx):  # noqa: F811
    fake, env, s = offered(vx)
    v = invite(env)
    fake.record_then_drop = True
    assert env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True}).status_code == 504
    fake.record_then_drop = False
    _many_native_rows(fake, 1200)  # more than RECONCILE_PAGES x PAGE: a page scan could not decide
    before = len(sent(fake, "visits/list"))
    rec = env.c.post(f"{W}/{v['id']}/reconcile")
    assert rec.status_code == 200 and rec.json()["verdict"] == "recorded", rec.text
    reads = sent(fake, "visits/list")[before:]
    assert len(reads) == 1 and reads[0]["filters"] == {"status": "all", "scope": "all", "external_ref": v["id"]}
    assert len(sent(fake, RECORD)) == 1, "the reconcile never sends the record"


def test_an_older_revision_in_wiskey_reads_absent_for_the_sent_revision(vx):  # noqa: F811
    fake, env, _s = offered(vx)
    v = invite(env)
    assert env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True}).status_code == 200
    first = sent(fake, RECORD)[-1]["record"]["arx_revision"]
    assert env.c.delete(f"{API}/access/visitors/{v['id']}").status_code == 200
    fake.record_answer = "drop"  # the newer (ended) revision is lost on the way: WisKey keeps the first
    assert env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True}).status_code == 504
    assert link(env, v["id"])["sent_revision"] > first
    rec = env.c.post(f"{W}/{v['id']}/reconcile")
    assert rec.status_code == 200 and rec.json()["verdict"] == "absent", rec.text
    assert link(env, v["id"])["state"] == "not_sent" and link(env, v["id"])["last_code"] == "older_revision_in_wiskey"


def test_a_newer_revision_in_wiskey_than_arx_sent_is_undecided(vx):  # noqa: F811
    fake, env, _s = offered(vx)
    v = invite(env)
    env.sql("INSERT INTO wiskey_visit_links(invite_id, state, sent_revision, attempted_at, created_at, updated_at) VALUES (?, 'unknown', 2, '2026-10-22T05:00:00Z', 'x', 'x')", v["id"])
    row = wiskey_visit(visit_uuid(899), person_id(env, v), source="arx", external_ref=v["id"], sequence=50)
    row["arx_revision"] = 999
    fake.visits.append(row)
    rec = env.c.post(f"{W}/{v['id']}/reconcile")
    assert rec.status_code == 200 and rec.json()["verdict"] == "undecided", rec.text
    assert link(env, v["id"])["state"] == "unknown", "nothing settled"


def test_without_the_record_command_the_reconcile_scans_and_never_sends_the_filter(vx):  # noqa: F811
    fake, env, _s = vx  # rc.10's command set: no record command, so no exact filter (rc.10 refuses it as invalid_fields)
    v = invite(env)
    env.sql("INSERT INTO wiskey_visit_links(invite_id, state, sent_revision, attempted_at, created_at, updated_at) VALUES (?, 'unknown', 2, '2026-10-22T05:00:00Z', 'x', 'x')", v["id"])
    before = len(sent(fake, "visits/list"))
    rec = env.c.post(f"{W}/{v['id']}/reconcile")
    assert rec.status_code == 200 and rec.json()["verdict"] == "absent", rec.text
    reads = sent(fake, "visits/list")[before:]
    assert reads and all("external_ref" not in m["filters"] for m in reads)
    assert sent(fake, RECORD) == []
