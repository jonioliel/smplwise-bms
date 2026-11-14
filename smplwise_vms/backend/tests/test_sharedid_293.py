"""SHAREDID-293 (owner decisions 2026-10-20, "Shared Arx + WisKey identity UI"): the server side of the external-access screen.

FAKES ONLY, like tests/test_access_grants.py (whose Env this file reuses): the access engine is tests/fake_wiskey.FakeAccessEngine, the
code transport FakeCodeTransport, the clock injected; the go-live permit is switched on inside each test by the Env (monkeypatch). Nothing
here reaches WisKey, a station, a door or WhatsApp.

 2  "Active - verified" only with stored read-back proof (verify_pass, the worker's own proven reads; invalidated by a scope change);
 3  manual "confirmed gone": one system administrator, checks + word + reference, notice to the managers, alerts stop, reappearance reopens;
 4  the weekly digest: content-free notice at the configured day/hour (once, never late), the channel = the source's policy, details by route;
 5  name drift: manual push and the automatic push (setting), only to a person Arx created;
 6  placement: a setting, readable by every user via GET /settings, written only by a system administrator;
 7  attach a recovered person: the route, system administrators only, every refusal audited."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest
from conftest import as_user, bind
from test_access_grants import APPROVER, T0, Env
from tickets_world import API

from smplwise.services import access_external as ax
from smplwise.services import access_grants as ag

UTC = timezone.utc


@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    yield e
    ag.reset_for_tests()


def _get(env: Env, path: str, user: str | None = None):
    return env.c.get(f"{API}{path}", headers=as_user(user) if user else None)


def _put(env: Env, path: str, body: dict, user: str | None = None):
    return env.c.put(f"{API}{path}", json=body, headers=as_user(user) if user else None)


def _present(env: Env, gid: str, user: str | None = None) -> dict:
    r = _get(env, f"/access-grants/{gid}", user)
    assert r.status_code == 200, r.text
    return r.json()["grant"]


def _audits(env: Env, action: str) -> list[tuple]:
    with env.db.connection(mode="read") as conn:
        return [tuple(r) for r in conn.execute("SELECT decision, reason, resource_id, details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,))]


def _notes(env: Env, source: str) -> int:
    return env.sql_count(f"SELECT COUNT(*) FROM notifications WHERE source = '{source}'")


# ================================================================ owner decision 2: "Active - verified" only with stored read-back proof


def test_an_active_grant_is_verified_only_after_a_fresh_read_proves_its_scope(env, monkeypatch):
    calls: list[str] = []
    real = ax.verify_pass
    monkeypatch.setattr(ax, "verify_pass", lambda db: calls.append("skip") or 0)
    gid = env.active_grant()
    g = _present(env, gid)
    assert (g["scope_verified"], g["doors_state"], g["scope_verified_at"]) == (False, "accepted", None), "the write's own answer is no proof"
    monkeypatch.setattr(ax, "verify_pass", real)
    env.run()
    g = _present(env, gid)
    assert g["scope_verified"] is True and g["doors_state"] == "verified_central" and g["scope_verified_at"], g
    row = env.grant(gid)
    assert row["scope_proof"] == ag.scope_digest(ag.Scope.of_row(row))
    assert _audits(env, "access.grant.verify")[-1][0] == "allowed"


def test_a_proof_of_another_scope_never_verifies_and_a_narrowing_needs_a_new_proof(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    assert _present(env, gid)["scope_verified"] is True
    # a stored digest of another scope (a legacy or stale row) is not proof
    env.sql("UPDATE access_grants SET scope_proof = 'ffffffffffffffffffffffffffffffff' WHERE id = ?", gid)
    assert _present(env, gid)["scope_verified"] is False
    # a narrowing: not verified while the push is outstanding; proven again by the push's fresh readback
    r = env.request(doors={"st-a": [1]})
    assert r.status_code == 200 and r.json()["outcome"] == "merged", r.text
    g = _present(env, gid)
    assert g["scope_verified"] is False and g["needs_push"] is True and g["doors_state"] == "desired"
    env.run()
    g = _present(env, gid)
    assert g["needs_push"] is False and g["scope_verified"] is True and [d["station_id"] for d in g["doors"]] == ["st-a"]


def test_a_wiskey_side_change_clears_the_proof_and_is_a_digest_gap(env):
    gid = env.active_grant()
    assert _present(env, gid)["scope_verified"] is True
    pid = env.person_of(gid)["id"]
    env.engine.people[pid]["doors"]["st-a"] = [1, 2]  # someone widened the door map in the intercom's own window
    env.run()
    assert _present(env, gid)["scope_verified"] is True, "read back at most once an hour"
    env.clock[0] = T0 + timedelta(hours=1, minutes=1)
    env.run()
    g = _present(env, gid)
    assert g["scope_verified"] is False and g["doors_state"] == "accepted"
    outcome = json.loads(_audits(env, "access.grant.verify")[-1][3])["outcome"]
    assert outcome == "mismatch"
    d = _get(env, "/access-grants/digest").json()["digest"]
    assert any(x["kind"] == "scope" and x["grant_id"] == gid for x in d["gaps"]), d["gaps"]


def test_an_unreadable_door_map_proves_nothing(env):
    gid = env.active_grant()
    env.sql("UPDATE access_grants SET scope_proof = NULL, scope_checked_at = NULL WHERE id = ?", gid)
    env.engine.hide_doors = True
    env.run()
    assert _present(env, gid)["scope_verified"] is False
    env.engine.hide_doors = False


def test_the_read_now_route_reads_an_active_grant_and_hides_from_a_viewer(env):
    gid = env.active_grant()
    env.sql("UPDATE access_grants SET scope_proof = NULL, scope_checked_at = NULL WHERE id = ?", gid)
    bind(env.c, env.settings, "vw", "viewer", "installation", "*")
    assert env.post(f"/access-grants/{gid}/read-now", user="vw").status_code == 404
    r = env.post(f"/access-grants/{gid}/read-now")
    assert r.status_code == 200 and r.json()["grant"]["scope_verified"] is True, r.text


# ================================================================ owner decision 3: manual "confirmed gone"


def _missing_revocation(env: Env) -> tuple[str, str]:
    gid = env.active_grant()
    pid = env.person_of(gid)["id"]
    del env.engine.people[pid]
    env.post(f"/access-grants/{gid}/revoke")
    g = env.grant(gid)
    assert g["state"] == "revoking"
    return gid, pid


GONE = {"reference": "פנייה 5521 לאחראי האינטרקום", "confirm": ax.GONE_WORD, "checks": [True, True, True]}


def test_confirmed_gone_needs_a_system_admin_and_every_check(env):
    gid, _ = _missing_revocation(env)
    bind(env.c, env.settings, "sa3", "site_admin", "installation", "*")
    r = env.post(f"/access-grants/{gid}/confirm-gone", GONE, user="sa3")
    assert r.status_code == 403 and r.json()["code"] == "not_system_admin"
    assert ("denied", "not_system_admin") == _audits(env, "access.grant.confirm_gone")[-1][:2]
    for bad, field in (({**GONE, "checks": [True, True, False]}, "checks"), ({**GONE, "confirm": "מחק"}, "confirm"),
                       ({**GONE, "reference": "קצר"}, "reference"), ({**GONE, "reference": "התקשרתי 050-123-4567 אתמול"}, "reference")):
        r = env.post(f"/access-grants/{gid}/confirm-gone", bad)
        assert r.status_code == 422 and r.json()["details"]["field"] == field, (field, r.text)
    assert env.grant(gid)["state"] == "revoking"
    active = env.active_grant(contact_id=env.tech2)
    r = env.post(f"/access-grants/{active}/confirm-gone", GONE)
    assert r.status_code == 409 and r.json()["code"] == "access_grant_not_missing", "only a revocation whose person is missing"


def test_confirmed_gone_closes_without_a_revocation_claim_tells_the_managers_and_stops_the_alerts(env):
    gid, _ = _missing_revocation(env)
    env.clock[0] = T0 + timedelta(minutes=5)
    env.run()
    alerts = _notes(env, "access.grant_attention")
    assert alerts >= 1
    r = env.post(f"/access-grants/{gid}/confirm-gone", GONE)
    assert r.status_code == 200, r.text
    g = r.json()["grant"]
    assert g["state"] == "ended" and g["closure"]["kind"] == "confirmed_gone" and g["grant_state"] == "ended", "never `revoked`"
    assert _notes(env, "access.grant_closed_manual") == 1, "every manager is told"
    assert _present(env, gid)["closure"]["reference"] == GONE["reference"], "the reference, to a system administrator"
    detail = json.loads(_audits(env, "access.grant.confirm_gone")[-1][3])
    assert "reference" not in detail and GONE["reference"] not in json.dumps(detail, ensure_ascii=False), "ids only in the audit"
    env.clock[0] = T0 + timedelta(hours=3)
    env.run()
    assert _notes(env, "access.grant_attention") == alerts, "the hourly alerts stopped"


def test_a_person_confirmed_gone_that_reappears_reopens_the_revocation(env):
    gid, pid = _missing_revocation(env)
    assert env.post(f"/access-grants/{gid}/confirm-gone", GONE).status_code == 200
    env.clock[0] = T0 + timedelta(hours=2)
    env.run()
    assert env.grant(gid)["state"] == "ended", "still not found: nothing changes"
    env.engine.add_person(pid, doors={"st-a": [1]})
    env.clock[0] = T0 + timedelta(hours=4)
    before = _notes(env, "access.grant_attention")
    env.run()
    g = env.grant(gid)
    assert g["state"] in ("revoking", "revoked"), g["state"]
    assert _notes(env, "access.grant_attention") > before, "alerted at once"
    env.clock[0] = T0 + timedelta(hours=5)
    env.run()
    assert env.grant(gid)["state"] == "revoked" and env.engine.people[pid]["doors"] == {} and env.engine.people[pid]["active"] is False
    assert _present(env, gid)["closure"]["reappeared_at"]


# ================================================================ owner decision 4: the weekly digest

SUN_0800 = datetime(2026, 10, 18, 5, 0, tzinfo=UTC)  # Sunday 08:00 in Asia/Jerusalem (UTC+3)


def test_the_digest_counts_the_last_period_over_what_the_caller_may_see(env):
    env.clock[0] = SUN_0800 - timedelta(days=3)  # Thursday, inside the period 11.10-18.10
    g1 = env.request().json()["grant"]["id"]
    assert env.approve(g1).status_code == 200
    env.run()
    g2 = env.request(contact_id=env.tech2).json()["grant"]["id"]
    assert env.post(f"/access-grants/{g2}/refuse", {"revision": env.grant(g2)["revision"]}).status_code == 200
    env.clock[0] = SUN_0800 + timedelta(days=1)  # Monday: the last full period is the one that ended on Sunday 08:00
    r = _get(env, "/access-grants/digest")
    assert r.status_code == 200, r.text
    d = r.json()["digest"]
    assert d["period"] == {"from": "2026-10-11T05:00:00Z", "until": "2026-10-18T05:00:00Z"}
    assert (d["counts"]["requests"], d["counts"]["approved"], d["counts"]["refused"]) == (2, 1, 1), d["counts"]
    assert d["approvers"] and d["approvers"][0]["count"] == 1
    assert d["schedule"] == {"day": 0, "hour": 8, "channel": "app"}
    bind(env.c, env.settings, "vw2", "viewer", "installation", "*")
    blind = _get(env, "/access-grants/digest", "vw2").json()["digest"]
    assert blind["counts"]["requests"] == 0 and blind["approvers"] == [], "only what the caller may see"


def test_the_digest_notice_goes_once_at_its_time_and_never_late(env):
    env.clock[0] = SUN_0800 - timedelta(minutes=1)
    env.run()
    assert _notes(env, ax.DIGEST_SOURCE) == 0, "not before its time"
    env.clock[0] = SUN_0800 + timedelta(seconds=30)
    env.run()
    env.run()
    assert _notes(env, ax.DIGEST_SOURCE) == 1, "once per period"
    with env.db.connection(mode="read") as conn:
        n = conn.execute("SELECT title, body, link FROM notifications WHERE source = ?", (ax.DIGEST_SOURCE,)).fetchone()
    assert "?digest=1" in n["link"] and env.vendor not in n["body"], "content-free"
    env.clock[0] = SUN_0800 + timedelta(days=7, hours=9)  # the next Sunday (08:00 = 06:00Z after the DST end on 25.10), 8 hours late
    env.run()
    assert _notes(env, ax.DIGEST_SOURCE) == 1, "a late digest is skipped, not sent"
    assert _audits(env, "access.digest.skipped")


def test_the_digest_channel_and_schedule_are_settings_of_a_system_admin(env):
    r = _put(env, "/access-grants/settings", {"digest_channel": "app_whatsapp", "digest_day": 1, "digest_hour": 9})
    assert r.status_code == 200, r.text
    assert (r.json()["digest_channel"], r.json()["digest_day"], r.json()["digest_hour"]) == ("app_whatsapp", 1, 9)
    with env.db.connection(mode="read") as conn:
        ch = json.loads(conn.execute("SELECT channels_json FROM notify_policies WHERE source = ?", (ax.DIGEST_SOURCE,)).fetchone()[0])
        assert ch["whatsapp"] is True and ch["app"] is True and ch["webpush"] is True
        assert ax.period_end(conn, SUN_0800 + timedelta(days=1, hours=3)) == datetime(2026, 10, 19, 6, 0, tzinfo=UTC), "Monday 09:00 local"
    bind(env.c, env.settings, "sa4", "site_admin", "installation", "*")
    assert _put(env, "/access-grants/settings", {"digest_hour": 7}, "sa4").status_code == 403
    assert _put(env, "/access-grants/settings", {"digest_hour": 24}).status_code == 422


# ================================================================ owner decision 5: name drift


def test_a_name_changed_in_wiskey_is_a_drift_and_the_manual_push_restores_it(env):
    gid = env.active_grant()
    link_id = env.grant(gid)["link_id"]
    pid = env.person_of(gid)["id"]
    ident = _get(env, f"/access-grants/contacts/{env.tech}/identity").json()["identity"]
    assert ident["link"]["origin"] == "created_from_arx" and ident["link"]["name_drift"] is False and ident["can"]["push_name"] is True
    env.engine.people[pid]["display_name"] = "יוסי ט. קליימה"
    env.clock[0] = T0 + timedelta(hours=1, minutes=1)
    env.run()  # the hourly read observes WisKey's name (a digest, never the value)
    assert _get(env, f"/access-grants/contacts/{env.tech}/identity").json()["identity"]["link"]["name_drift"] is True
    with env.db.connection(mode="read") as conn:
        row = dict(conn.execute("SELECT * FROM access_person_links WHERE id = ?", (link_id,)).fetchone())
    assert "יוסי" not in json.dumps(row, ensure_ascii=False), "the link keeps digests only"
    bind(env.c, env.settings, "vw3", "viewer", "installation", "*")
    assert env.post(f"/access-grants/links/{link_id}/push-name", user="vw3").status_code == 403
    r = env.post(f"/access-grants/links/{link_id}/push-name")
    assert r.status_code == 200 and r.json()["outcome"] == "pushed", r.text
    assert env.engine.people[pid]["display_name"] == "יוסי טכנאי"
    assert _get(env, f"/access-grants/contacts/{env.tech}/identity").json()["identity"]["link"]["name_drift"] is False


def test_the_automatic_name_push_follows_the_setting_and_never_touches_a_matched_person(env):
    assert _put(env, "/access-grants/settings", {"name_sync": "auto"}).status_code == 200
    gid = env.active_grant()
    pid = env.person_of(gid)["id"]
    env.engine.people[pid]["display_name"] = "שם אחר"
    env.clock[0] = T0 + timedelta(hours=1, minutes=1)
    env.run()
    assert env.engine.people[pid]["display_name"] == "יוסי טכנאי", "pushed automatically on the pass that saw the drift"
    assert json.loads(_audits(env, "access.person_link.name_pushed")[-1][3]).get("automatic") is True
    # a matched person is never renamed
    env.engine.add_person("wk-staff2", stations=["st-a"])
    lr = env.post("/access-grants/links", {"contact_id": env.tech2, "wiskey_person_id": "wk-staff2"})
    assert lr.status_code == 200, lr.text
    r = env.post(f"/access-grants/links/{lr.json()['link']['id']}/push-name")
    assert r.status_code == 409 and r.json()["code"] == "access_person_not_ours"
    assert env.engine.people["wk-staff2"]["display_name"] == "wk-staff2"


# ================================================================ owner decision 6: placement


def test_the_placement_is_readable_by_everyone_and_set_by_a_system_admin(env):
    assert env.c.get(f"{API}/settings").json()["settings"]["access.external.placement"] == "access"
    bind(env.c, env.settings, "sa5", "site_admin", "installation", "*")
    assert _put(env, "/access-grants/settings", {"placement": "both"}, "sa5").status_code == 403
    assert _put(env, "/access-grants/settings", {"placement": "elsewhere"}).status_code == 422
    assert _put(env, "/access-grants/settings", {"placement": "tickets"}).status_code == 200
    assert env.c.get(f"{API}/settings").json()["settings"]["access.external.placement"] == "tickets"
    r = env.c.patch(f"{API}/settings", json={"access.external.placement": "access"})
    assert r.status_code in (400, 422) or env.c.get(f"{API}/settings").json()["settings"]["access.external.placement"] == "tickets", "never through PATCH /settings"
    with env.db.connection(mode="read") as conn:
        assert ax.screen_href(conn) == "#/tickets/external"
    env.sql("UPDATE settings SET value = 'nowhere' WHERE key = ?", ax.PLACEMENT_KEY)
    assert env.c.get(f"{API}/settings").json()["settings"]["access.external.placement"] == "access", "a corrupt value falls back"
    listing = _get(env, "/access-grants").json()
    assert listing["screen"]["placement"] == "access" and listing["system_admin"] is True and listing["rules"]["max_days"] == 14


# ================================================================ owner decision 7: attach a recovered person


def _unresolved_create(env: Env) -> str:
    gid = env.request().json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    env.engine.fail["create_person"] = "unknown"
    env.run()
    env.run()
    g = env.grant(gid)
    assert g["state"] == "revoking" and g["link_id"] is None, g
    return gid


def test_attaching_a_recovered_person_is_a_system_admin_route_and_every_refusal_is_audited(env):
    gid = _unresolved_create(env)
    admin_view = _get(env, f"/access-grants/contacts/{env.tech}/identity").json()["identity"]
    assert admin_view["unresolved"]["count"] == 1 and admin_view["can"]["attach"] is True and admin_view["link"] is None
    op_id = admin_view["unresolved"]["op_id"]
    assert op_id
    r = env.c.post(f"{API}/access/roles", json={"name": "מאשר כללי", "description": "t", "permissions": ["access.people.read"], "sensitive": APPROVER})
    assert r.status_code == 201, r.text
    bind(env.c, env.settings, "appr2", r.json()["id"], "installation", "*")
    other = _get(env, f"/access-grants/contacts/{env.tech}/identity", "appr2").json()["identity"]
    assert other["unresolved"]["op_id"] is None and other["can"]["attach"] is False, "the op id and the action: system administrators only"
    env.engine.add_person("wk-recovered", doors={"st-a": [1]})
    body = {"op_id": op_id, "wiskey_person_id": "wk-recovered", "evidence_ref": "TICKET-5521:readback"}
    r = env.post(f"/access-grants/{gid}/attach-recovered", body, user="appr2")
    assert r.status_code == 403
    r = env.post(f"/access-grants/{gid}/attach-recovered", {**body, "op_id": "0" * 32})
    assert r.status_code == 409
    r = env.post(f"/access-grants/{gid}/attach-recovered", {**body, "evidence_ref": "שמתי לב"})
    assert r.status_code == 422
    denied = [a for a in _audits(env, "access.grant.create_recovered") if a[0] == "denied"]
    assert [d[1] for d in denied] == ["not_system_admin", "access_create_not_unresolved", "access_grant_invalid:evidence_ref"], denied
    r = env.post(f"/access-grants/{gid}/attach-recovered", body)
    assert r.status_code == 200 and r.json()["link"]["origin"] == "created_from_arx", r.text
    env.clock[0] = T0 + timedelta(minutes=30)
    env.run()
    # the normal revoke ran on it: read, strip, readback (the grant's end reason was `failed`, so its final state is `failed`)
    assert env.grant(gid)["state"] == "failed" and env.engine.people["wk-recovered"]["doors"] == {} and env.engine.people["wk-recovered"]["active"] is False


def test_the_identity_card_is_hidden_from_a_caller_without_the_contacts_or_the_grant_permission(env):
    bind(env.c, env.settings, "vw4", "viewer", "installation", "*")
    assert _get(env, f"/access-grants/contacts/{env.tech}/identity", "vw4").status_code == 404
    assert _get(env, f"/access-grants/contacts/{env.vendor}/identity").status_code == 404, "a company has no access identity"
    ident = _get(env, f"/access-grants/contacts/{env.tech}/identity").json()["identity"]
    assert ident["link"] is None and ident["can"]["link"] is True and ident["can"]["delete"] is False
