"""WISKEY-VISITS-2407 (card WISKEY-VISITS-2400, owner decision 07.11 option "ב"), FAKES ONLY: Arx's visitor invitations connected to WisKey's
visit mechanism over the add-on's live service session against the fake WisKey (tests/fake_wiskey_visits.py). The Arx side is the real
visitor flow on the grant engine with tests/fake_wiskey.FakeAccessEngine (test_access_grants.Env). Nothing contacts a device, a station, Home
Assistant or WisKey.

What is proven:
- the channels: `visits` = the two READS, `visits_push` = the one record command (unpinned: not in rc.10); none of WisKey's own visit writes
  (create / request / decide / operators, template upsert / delete) is on any channel;
- capability: with rc.10's command set the push is unavailable with the Hebrew reason, nothing is sent; the administrator's switch is a
  second condition; the reads are available;
- WisKey's visits read only in Arx: closed projection (no HA ids, employee number, responsible person, purpose, credential flags), origin
  `arx` for an Arx visitor's person, `wiskey` otherwise; `access.people.read` unrestricted (audited 403 otherwise);
- templates as presets, without the HA id or the sensitive texts;
- the push: confirmation, gates, ONE frame with ids only (no name / phone / code), the attempt + outcome audit rows, the link state; a second
  push of the same revision refused (in sync); a newer Arx revision (cancel) pushed as `ended`; WisKey's pre-effect refusal -> `refused`
  and a new push allowed; no answer -> `unknown`, a further push refused until `reconcile` reads WisKey's list (recorded / absent);
- the claim: a `sending` row blocks a concurrent second push (nothing sent)."""
from __future__ import annotations

import json
from dataclasses import replace

import pytest
from conftest import as_user, bind
from fake_wiskey_visits import BAIT, RECORD, VisitsFake
from test_access_grants import VF, VU, Env
from tickets_world import API

from smplwise.db import Database
from smplwise.services import access_entries, intercom_client, intercom_sync, wiskey_channels
from smplwise.services import access_grants as ag
from smplwise.services import access_visitors as av
from smplwise.services import wiskey_visits as wv

W = f"{API}/access/wiskey-visits"
VISITOR = "972500000078"


def wait_for(pred, timeout: float = 5.0) -> None:
    import time

    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError("condition not met")


@pytest.fixture()
def vx(settings, monkeypatch):
    import websockets

    fake = VisitsFake("admin", token="t")
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    monkeypatch.setattr(intercom_sync, "CONFIG_TIMEOUT_S", 0.6)
    for name in ("USER_BURST", "GLOBAL_BURST"):
        monkeypatch.setattr(intercom_sync, name, 1000.0)
    intercom_sync.SYNC.reset()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    env = Env(s, monkeypatch)
    monkeypatch.setattr(access_entries, "EVENT_SOURCE", lambda db, since: [])
    env.sql("INSERT OR REPLACE INTO settings(key, value) VALUES ('access.visitors', 'on')")
    env.sql("INSERT OR REPLACE INTO access_station_visitor_entrance(station_id, set_by, set_at) VALUES ('st-a', 'test', '2026-10-20T06:00:00Z')")
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    yield fake, env, s
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()
    ag.reset_for_tests()


def invite(env) -> dict:
    body = {"visitor_name": "דנה בדיקה", "phone": "+" + VISITOR, "doors": {"st-a": [1]}, "valid_from": VF, "valid_until": VU, "told": True}
    r = env.c.post(f"{API}/access/visitors", json=body)
    assert r.status_code == 200, r.text
    v = r.json()["visitor"]
    env.run()
    assert env.grant(v["grant_id"])["state"] == "active"
    return v


def person_id(env, v: dict) -> str:
    with env.db.connection(mode="read") as conn:
        return ag.link_row(conn, env.grant(v["grant_id"])["link_id"])["wiskey_person_id"]


def push_on(env) -> None:
    assert env.c.put(f"{W}/settings", json={"push": "on"}).status_code == 200


def sent(fake: VisitsFake, command: str) -> list[dict]:
    return [m for m in fake.received if m.get("type") == intercom_client.command_type(command)]


def audits(s, action: str) -> list[dict]:
    with Database(s.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


def link(env, invite_id: str) -> dict | None:
    with env.db.connection(mode="read") as conn:
        return wv.link_row(conn, invite_id)


# ---------------------------------------------------------------- channels and capability

def test_the_channels_hold_the_two_reads_and_the_one_record_and_none_of_wiskeys_own_visit_writes():
    assert wiskey_channels.VISITS == wv.READS == {"visits/list", "guest_templates/get"}
    assert wiskey_channels.VISITS_PUSH == {wv.RECORD} and "visits_push" in wiskey_channels.UNPINNED_CHANNELS
    every = set().union(*wiskey_channels.ALLOWLISTS.values())
    assert not (every & wv.NEVER), sorted(every & wv.NEVER)
    for channel in ("visits", "visits_push"):
        assert channel in wiskey_channels.ADAPTER_CHANNELS and wiskey_channels.HA_FRAMES[channel] == frozenset()
    assert wiskey_channels.allowed("visits", "hikvision_intercom/visits/list") and not wiskey_channels.allowed("visits", "hikvision_intercom/" + wv.RECORD)
    assert not wiskey_channels.allowed("visits_push", "hikvision_intercom/visits/create")
    assert intercom_client.refusal_is_pre_device(wv.RECORD, "visit_record_stale") and not intercom_client.refusal_is_pre_device(wv.RECORD, "storage_write_failed")


def test_feature_state_fails_closed_and_names_the_reason_in_hebrew():
    assert wv.feature_state(None, "visits") == (False, "no_copy")
    assert wv.feature_state({"commands": None}, "visits") == (False, "commands_unknown")
    assert wv.feature_state({"min_client": 99, "commands": []}, "visits") == (False, "api_incompatible")
    assert wv.feature_state({"commands": ["visits/list"]}, "visits") == (True, None)
    assert wv.feature_state({"commands": ["visits/list"]}, "push") == (False, "push_not_offered")
    for reason in ("push_not_offered", "push_off", "installation_unavailable", "writes_disabled", "not_listed", "no_copy"):
        text = wv.reason_text(reason)
        assert text and any("֐" <= ch <= "׿" for ch in text), reason
    assert wv.reason_text("brand_new") == "לא זמין (brand_new)."


def test_rc10_offers_the_reads_but_not_the_record_so_the_push_is_unavailable_and_nothing_is_sent(vx):
    fake, env, s = vx
    v = invite(env)
    home = env.c.get(W).json()
    caps = home["capabilities"]
    assert caps["visits"]["available"] is True and caps["templates"]["available"] is True
    assert caps["push"] == {"available": False, "reason": "push_not_offered", "message": wv.REASON_HE["push_not_offered"], "switch": "off", "offered": False}
    push_on(env)
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 409 and r.json()["code"] == "wiskey_visits_push_unsupported" and r.json()["details"]["reason"] == "push_not_offered", r.text
    assert sent(fake, RECORD) == [] and link(env, v["id"]) is None
    denied = audits(s, wv.AUDIT_PUSH)
    assert denied and denied[-1]["decision"] == "denied" and denied[-1]["reason"] == "push_not_offered"


def test_the_switch_is_a_second_condition_and_only_a_system_administrator_sets_it(vx):
    fake, env, s = vx
    fake.offer_record = True
    fake.push("refresh")
    wait_for(lambda: wv.feature_state(intercom_sync.SYNC.api_facts(s), "push")[0] is True)
    v = invite(env)
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 409 and r.json()["code"] == "wiskey_visits_push_off", r.text
    bind(env.c, s, "vic2", "viewer", "installation", "*")
    assert env.c.put(f"{W}/settings", json={"push": "on"}, headers=as_user("vic2")).status_code == 403
    assert env.c.put(f"{W}/settings", json={"push": "maybe"}).status_code == 422
    push_on(env)
    rows = audits(s, wv.AUDIT_SETTINGS)
    assert rows[-1]["decision"] == "allowed" and json.loads(rows[-1]["details_json"])["after"] == "on"
    assert sent(fake, RECORD) == []


def test_everything_is_hidden_while_arx_visitors_are_off(vx):
    fake, env, _s = vx
    env.sql("UPDATE settings SET value = 'off' WHERE key = 'access.visitors'")
    for path in ("", "/visits", "/templates", "/links"):
        assert env.c.get(f"{W}{path}").status_code == 404, path
    assert env.c.post(f"{W}/abc/push", json={"confirmed": True}).status_code == 404
    assert sent(fake, "visits/list") == []


# ---------------------------------------------------------------- the reads

def test_wiskeys_visits_are_read_only_closed_and_marked_by_origin(vx):
    fake, env, _s = vx
    v = invite(env)
    from fake_wiskey_visits import wiskey_visit

    fake.visits.append(wiskey_visit("v-wk-3", person_id(env, v), sequence=3))  # a WisKey row about an Arx visitor's person
    r = env.c.get(f"{W}/visits", params={"limit": 10})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] == "ready"
    items = {i["id"]: i for i in body["visits"]["items"]}
    assert items["v-wk-1"]["origin"] == "wiskey" and items["v-wk-1"]["status"] == "pending" and items["v-wk-1"]["read_only"] is True
    assert items["v-wk-3"]["origin"] == "arx" and items["v-wk-3"]["arx_invite_id"] == v["id"]
    assert items["v-wk-2"]["doors"] == {"entry-a": [1]} and items["v-wk-2"]["display_name"] == "אורח וויסקי"
    text = json.dumps(body, ensure_ascii=False)
    for bait in BAIT:
        assert bait not in text, bait
    for key in ('"approver_id"', '"requested_by"', '"decided_by"', '"employee_no"', '"pin_configured"', '"enabled_cards"', '"user_id"'):
        assert key not in text, key
    frame = sent(fake, "visits/list")[-1]
    assert set(frame) == {"id", "type", "offset", "limit", "filters"} and "api_contract" not in frame


def test_the_visit_list_needs_people_read_unrestricted(vx):
    fake, env, s = vx
    bind(env.c, s, "rina", "operator", "floor", env.w.floors["floor2"])
    before = len(sent(fake, "visits/list"))
    r = env.c.get(f"{W}/visits", headers=as_user("rina"))
    assert r.status_code in (403, 404), r.text
    assert len(sent(fake, "visits/list")) == before


def test_guest_templates_are_presets_without_the_operator_or_sensitive_texts(vx):
    fake, env, _s = vx
    r = env.c.get(f"{W}/templates")
    assert r.status_code == 200, r.text
    t = r.json()["templates"]
    assert [x["id"] for x in t["items"]] == ["tpl-a", "tpl-b"] and t["revision"] == 3
    assert t["items"][0] == {"id": "tpl-a", "label": "אורח לשעתיים", "access_category": "visitor", "duration_minutes": 120, "doors": {"entry-a": [1]},
                             "weekly_hours": True, "updated_at": "2026-11-01T10:00:00+00:00"}
    text = json.dumps(r.json(), ensure_ascii=False)
    for bait in BAIT:
        assert bait not in text


def test_projections_drop_unknown_values():
    row = wv.project_visit({"id": "x1", "status": "teleported", "reason_code": "odd", "source": "martian", "external_ref": "abc",
                            "snapshot": {"access_category": "staff", "doors": {"entry-a": [1, 3, 1], "bad id!": [1]}, "valid_from": "yesterday"}})
    assert row["status"] == "unknown" and row["reason_code"] == "other" and row["source"] == "wiskey" and row["external_ref"] is None
    assert row["access_category"] == "unknown" and row["doors"] == {"entry-a": [1]} and row["valid_from"] is None
    assert wv.project_visit({"id": "../x"}) is None
    with pytest.raises(ValueError):
        wv.project_visit_page({"rows": []})
    with pytest.raises(ValueError):
        wv.project_record({"visit_id": None})


# ---------------------------------------------------------------- the push

def offered(vx) -> tuple:
    fake, env, s = vx
    fake.offer_record = True
    # the served copy must list the command: a fresh overview after the switch (the feed re-reads on refresh)
    fake.push("refresh")
    wait_for(lambda: wv.feature_state(intercom_sync.SYNC.api_facts(s), "push")[0] is True)
    push_on(env)
    return fake, env, s


def test_a_push_needs_a_confirmation_and_sends_one_frame_of_ids_only(vx):
    fake, env, s = offered(vx)
    v = invite(env)
    assert env.c.post(f"{W}/{v['id']}/push", json={}).status_code == 409
    assert env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True, "extra": 1}).status_code == 422
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "pushed" and body["record"]["visit_id"] == "v-arx-1" and body["link"]["in_sync"] is True and body["link"]["state"] == "pushed"
    frames = sent(fake, RECORD)
    assert len(frames) == 1
    f = frames[0]
    assert set(f) == {"id", "type", "api_contract", "record"} and f["api_contract"] == 1
    rec = f["record"]
    assert rec["external_ref"] == v["id"] and rec["user_id"] == person_id(env, v) and rec["status"] == "approved"
    assert rec["doors"] == {"st-a": [1]} and rec["approval"]["kind"] == "host_envelope"
    text = json.dumps(f, ensure_ascii=False)
    assert "דנה" not in text and VISITOR not in text and "phone" not in text and "pin" not in text.lower()
    rows = audits(s, wv.AUDIT_PUSH)
    phases = [json.loads(r["details_json"]).get("phase") for r in rows if r["decision"] == "allowed"]
    assert phases == ["attempt", "outcome"] and "דנה" not in json.dumps(rows, ensure_ascii=False)
    # the same revision again: in sync, nothing sent
    r2 = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r2.status_code == 409 and r2.json()["code"] == "wiskey_visits_in_sync" and len(sent(fake, RECORD)) == 1
    # the WisKey list now shows the record as Arx's
    items = env.c.get(f"{W}/visits").json()["visits"]["items"]
    mine = [i for i in items if i["id"] == "v-arx-1"][0]
    assert mine["origin"] == "arx" and mine["source"] == "arx" and mine["arx_invite_id"] == v["id"]


def test_a_cancelled_invitation_is_pushed_again_as_ended_with_a_newer_revision(vx):
    fake, env, _s = offered(vx)
    v = invite(env)
    assert env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True}).status_code == 200
    first = sent(fake, RECORD)[-1]["record"]["arx_revision"]
    assert env.c.delete(f"{API}/access/visitors/{v['id']}").status_code == 200
    links = env.c.get(f"{W}/links").json()["links"]
    mine = [x for x in links if x["invite_id"] == v["id"]][0]
    assert mine["in_sync"] is False and mine["pushable"] is True
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 200, r.text
    second = sent(fake, RECORD)[-1]["record"]
    assert second["status"] == "ended" and second["arx_revision"] > first and fake.records[v["id"]]["status"] == "ended"


def test_a_pre_effect_refusal_is_refused_and_a_new_push_is_allowed(vx):
    fake, env, _s = offered(vx)
    v = invite(env)
    fake.record_answer = "installation_unavailable"
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 409 and r.json()["code"] == "wiskey_visits_installation_unavailable", r.text
    assert link(env, v["id"])["state"] == "refused" and link(env, v["id"])["last_code"] == "installation_unavailable"
    fake.record_answer = "ok"
    assert env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True}).status_code == 200
    assert len(sent(fake, RECORD)) == 2


def test_an_older_revision_never_overwrites_a_newer_record_in_wiskey(vx):
    fake, env, _s = offered(vx)
    v = invite(env)
    fake.records[v["id"]] = {"visit_id": "v-arx-9", "arx_revision": 999, "status": "ended", "record": {}}
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 409 and r.json()["code"] == "wiskey_visits_stale", r.text
    assert fake.records[v["id"]]["arx_revision"] == 999


def test_no_answer_is_unknown_never_resent_and_settled_by_reading_wiskeys_list(vx):
    fake, env, s = offered(vx)
    v = invite(env)
    fake.record_then_drop = True
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 504 and r.json()["code"] == "wiskey_visits_outcome_unknown", r.text
    assert link(env, v["id"])["state"] == "unknown"
    fake.record_then_drop = False
    again = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert again.status_code == 409 and again.json()["code"] == "wiskey_visits_outcome_unknown" and len(sent(fake, RECORD)) == 1
    rec = env.c.post(f"{W}/{v['id']}/reconcile")
    assert rec.status_code == 200, rec.text
    assert rec.json()["verdict"] == "recorded" and rec.json()["link"]["state"] == "pushed" and rec.json()["link"]["in_sync"] is True
    assert len(sent(fake, RECORD)) == 1, "the reconcile reads, it never sends the record"
    assert audits(s, wv.AUDIT_RECONCILE)


def test_an_unknown_that_wiskey_never_stored_reads_absent_and_the_feed_still_holds_the_target_while_the_call_is_out(vx):
    fake, env, _s = offered(vx)
    v = invite(env)
    fake.record_answer = "drop"
    assert env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True}).status_code == 504
    fake.record_answer = "ok"
    rec = env.c.post(f"{W}/{v['id']}/reconcile")
    assert rec.status_code == 200 and rec.json()["verdict"] == "absent" and rec.json()["link"]["state"] == "not_sent", rec.text
    assert rec.json()["link"]["pushable"] is True
    # Arx's own record now allows a new push, but the feed's R3-06 gate still holds the target while the first call is out (it may yet
    # be answered): the second push is refused before anything is sent - two independent guards against a double write.
    again = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert again.status_code == 409 and again.json()["code"] == "intercom_outcome_pending", again.text
    assert len(sent(fake, RECORD)) == 1 and fake.records == {}


def test_a_sending_claim_blocks_a_second_push_and_nothing_is_sent(vx):
    fake, env, _s = offered(vx)
    v = invite(env)
    env.sql("INSERT INTO wiskey_visit_links(invite_id, state, sent_revision, created_at, updated_at) VALUES (?, 'sending', 1, 'x', 'x')", v["id"])
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert r.status_code == 409 and r.json()["code"] == "wiskey_visits_in_flight" and sent(fake, RECORD) == []


def test_only_the_host_or_a_station_manager_may_push(vx):
    fake, env, s = offered(vx)
    v = invite(env)
    bind(env.c, s, "rina", "operator", "floor", env.w.floors["floor2"])
    r = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True}, headers=as_user("rina"))
    assert r.status_code == 404 and sent(fake, RECORD) == []


def test_a_requested_invitation_is_not_pushable(vx):
    fake, env, _s = offered(vx)
    with env.db.connection() as conn:
        assert av.enabled(conn)
    body = {"visitor_name": "רון", "phone": "+972500000079", "doors": {"st-a": [1]}, "valid_from": VF, "valid_until": "2026-10-24T14:00:00Z", "told": True}
    r = env.c.post(f"{API}/access/visitors", json=body)
    assert r.status_code == 200, r.text
    v = r.json()["visitor"]
    assert v["state"] == "requested"
    p = env.c.post(f"{W}/{v['id']}/push", json={"confirmed": True})
    assert p.status_code == 409 and p.json()["code"] == "wiskey_visits_not_ready" and sent(fake, RECORD) == []
