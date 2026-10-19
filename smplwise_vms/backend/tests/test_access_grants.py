"""CR-ARX-WISKEY-SHARED-IDENTITY section 13 (negative-first, FAKES ONLY): external-person door grants and Arx <-> WisKey links.

Nothing here contacts WisKey, Home Assistant, a station, a door, a reader or WhatsApp: the access engine is
tests/fake_wiskey.FakeAccessEngine, the message transport tests/fake_wiskey.FakeCodeTransport, the clock is injected. The go-live
permit is switched on INSIDE each test that drives the flow (monkeypatch), exactly like the capture-lease tests; the tests of the
build as shipped keep it False. Real-device and real-phone checks are NOT_RUN (each needs its own owner approval).

PINs are the fake's sentinels (9133xx); the leak scan proves the sentinel is absent from the database file, the WAL, the audit
rows, the logs and every HTTP answer."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from conftest import as_user, bind
from fake_wiskey import FakeAccessEngine, FakeCodeTransport
from tickets_world import API, build as build_world

from smplwise.db import Database, bump_permission_revision, new_id, set_setting
from smplwise.rbac import Principal
from smplwise.services import access_grants as ag
from smplwise.services import access_grant_engine as age
from smplwise.services.access_grant_engine import EngineError, WiskeyServiceEngine

UTC = timezone.utc
T0 = datetime(2026, 10, 20, 6, 0, tzinfo=UTC)          # Tue 09:00 in Asia/Jerusalem (UTC+3 until 25.10)
VF = "2026-10-22T05:00:00Z"                             # Thu 08:00 local
VU = "2026-10-22T14:00:00Z"                             # Thu 17:00 local
DUE = datetime(2026, 10, 21, 15, 0, tzinfo=UTC)         # Wed 18:00 local: the evening before (owner answer 4)
PHONE = "972500000041"
PHONE2 = "972500000042"
SENTINELS = FakeAccessEngine.PIN_SENTINELS


class Env:
    def __init__(self, settings, monkeypatch, *, go_live: bool = True) -> None:
        self.settings = settings
        monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", go_live)
        self.engine = FakeAccessEngine()
        self.transport = FakeCodeTransport()
        monkeypatch.setattr(ag, "ENGINE_FACTORY", lambda db: self.engine)
        monkeypatch.setattr(ag, "TRANSPORT", self.transport)
        self.clock = [T0]
        ag.set_clock(lambda: self.clock[0])
        self.w = build_world(settings)
        self.c = self.w.c
        self.db = Database(settings.db_path)
        self.answers: list[str] = []
        with self.db.connection() as conn:
            if go_live:
                set_setting(conn, ag.FLAG_KEY, "on")
            self.vendor = self.contact(conn, kind="vendor", name="קליימה-טק")
            self.tech = self.contact(conn, name="יוסי טכנאי", vendor_id=self.vendor, phone=PHONE)
            self.tech2 = self.contact(conn, name="דני טכנאי", vendor_id=self.vendor, phone=PHONE2)

    # ---- seeding
    def contact(self, conn, *, kind: str = "person", name: str, vendor_id: str | None = None, phone: str | None = None, via: str = "code",
                confirmed: datetime | None = None, active: int = 1) -> str:
        cid = new_id()
        at = T0.strftime("%Y-%m-%dT%H:%M:%SZ")
        conf = (confirmed or (T0 - timedelta(days=1))).strftime("%Y-%m-%dT%H:%M:%SZ") if phone else None
        conn.execute("""INSERT INTO ticket_contacts(id, kind, vendor_id, display_name, phone_e164, phone_key, lang, active, created_by, created_at, updated_at,
                        phone_confirmed_at, phone_confirmed_via) VALUES (?, ?, ?, ?, ?, ?, 'he', ?, 'test', ?, ?, ?, ?)""",
                     (cid, kind, vendor_id, name, phone, ("pk-" + phone) if phone else None, active, at, at, conf, via if phone else None))
        return cid

    def sql(self, statement: str, *args) -> None:
        with self.db.connection() as conn:
            conn.execute(statement, args)

    def sql_count(self, statement: str) -> int:
        with self.db.connection(mode="read") as conn:
            return conn.execute(statement).fetchone()[0]

    def grant(self, gid: str) -> dict:
        with self.db.connection(mode="read") as conn:
            return ag.grant_row(conn, gid)

    def run(self) -> dict:
        return ag.WORKER.run_once(self.db)

    # ---- the HTTP surface
    def post(self, path: str, body: dict | None = None, user: str | None = None):
        r = self.c.post(f"{API}{path}", json=body or {}, headers=as_user(user) if user else None)
        self.answers.append(r.text)
        return r

    def request(self, contact_id: str | None = None, doors: dict | None = None, vf: str = VF, vu: str = VU, user: str | None = None, **extra):
        return self.post("/access-grants", {"contact_id": contact_id or self.tech, "doors": doors or {"st-a": [1]}, "valid_from": vf, "valid_until": vu, **extra},
                         user)

    def approve(self, gid: str, user: str | None = None, **extra):
        rev = self.grant(gid)["revision"]
        return self.post(f"/access-grants/{gid}/approve", {"revision": rev, "told": True, **extra}, user)

    def active_grant(self, contact_id: str | None = None, doors: dict | None = None) -> str:
        r = self.request(contact_id, doors)
        assert r.status_code == 200, r.text
        gid = r.json()["grant"]["id"]
        a = self.approve(gid)
        assert a.status_code == 200, a.text
        self.run()
        assert self.grant(gid)["state"] == "active"
        return gid

    def person_of(self, gid: str) -> dict:
        with self.db.connection(mode="read") as conn:
            link = ag.link_row(conn, self.grant(gid)["link_id"])
        return self.engine.people[link["wiskey_person_id"]]

    def role(self, name: str, sensitive: list[str]) -> str:
        r = self.c.post(f"{API}/access/roles", json={"name": name, "description": "external grant test", "permissions": [], "sensitive": sensitive})
        assert r.status_code == 201, r.text
        return r.json()["id"]


@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    yield e
    ag.reset_for_tests()


APPROVER = ["access.external.grant", "access.people.manage", "access.people.sensitive", "access.pin.generate"]


# ================================================================ negative first: the build as shipped is OFF


def test_the_switch_cannot_be_turned_on_without_the_owners_go_live_permit(settings, monkeypatch):
    e = Env(settings, monkeypatch, go_live=False)
    try:
        assert ag.GO_LIVE_PERMITTED is False
        r = e.c.put(f"{API}/access-grants/settings", json={"external_grants": "on"})
        assert r.status_code == 409 and r.json()["code"] == "access_grants_not_permitted", r.text
        s = e.c.get(f"{API}/access-grants/settings").json()
        assert s["external_grants"] == "off" and s["go_live_permitted"] is False and s["max_days"] == 14
        # even a hand-written `on` row is not `on` without the permit (fail closed)
        e.sql("INSERT OR REPLACE INTO settings(key, value) VALUES (?, 'on')", ag.FLAG_KEY)
        with e.db.connection(mode="read") as conn:
            assert ag.enabled(conn) is False
        r = e.request()
        assert r.status_code == 409 and r.json()["code"] == "access_grants_off"
    finally:
        ag.reset_for_tests()


def test_the_live_engine_and_the_live_transport_refuse_without_the_permit(monkeypatch):
    monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", False)
    live = WiskeyServiceEngine(None)
    for call in (lambda: live.get_person("p"), lambda: live.pin_generate("p"), lambda: live.strip("p", 1), lambda: live.delete("p", 1),
                 lambda: live.create_person(display_name="x", employee_no="x1", category="visitor", responsible_person="r", access_purpose="p"),
                 lambda: live.apply("p", 1, doors={}, valid_from=VF, valid_until=VU, timing=None, active=True)):
        with pytest.raises(EngineError) as exc:
            call()
        assert exc.value.kind == "not_permitted"
    monkeypatch.setattr(ag, "TRANSPORT", None)
    assert ag.send_code(None, ag.CodeMessage(grant_id="g", lang="he", digits=PHONE, text="x")) == "not_sent"


def test_a_non_admin_cannot_read_or_change_the_settings(env):
    bind(env.c, env.settings, "otto", "site_admin", "installation", "*")
    assert env.c.get(f"{API}/access-grants/settings", headers=as_user("otto")).status_code == 403
    r = env.c.put(f"{API}/access-grants/settings", json={"max_days": 3}, headers=as_user("otto"))
    assert r.status_code == 403 and r.json()["code"] in ("forbidden", "not_system_admin")
    with env.db.connection(mode="read") as conn:
        assert conn.execute("SELECT value FROM settings WHERE key = ?", (ag.MAX_DAYS_KEY,)).fetchone() is None
    r = env.c.put(f"{API}/access-grants/settings", json={"max_days": 15})
    assert r.status_code == 422, "the setting may only lower the 14-day cap (owner answer 8)"


def test_approval_without_the_permission_on_one_station_is_refused_and_sends_nothing(env):
    rid = env.role("מאשר עמדה א", APPROVER)
    bind(env.c, env.settings, "appr", rid, "access_control_station", "st-a")
    gid = env.request(doors={"st-a": [1], "st-b": [1]}).json()["grant"]["id"]
    r = env.approve(gid, user="appr")
    assert r.status_code == 403 and r.json()["details"]["permission"] == "access.external.grant", r.text
    env.run()
    assert env.grant(gid)["state"] == "requested" and env.engine.calls == [] and env.transport.sent == []
    with env.db.connection(mode="read") as conn:
        row = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'access.grant.approve' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert tuple(row) == ("denied", "no_binding")
    # the same approver on st-a alone is enough
    gid2 = env.request(contact_id=env.tech2, doors={"st-a": [1]}).json()["grant"]["id"]
    assert env.approve(gid2, user="appr").status_code == 200


def test_people_manage_alone_or_the_grant_permission_alone_cannot_approve(env):
    only_grant = env.role("רק אישור", ["access.external.grant"])
    only_manage = env.role("רק ניהול", ["access.people.manage", "access.people.sensitive", "access.pin.generate"])
    bind(env.c, env.settings, "g1", only_grant, "installation", "*")
    bind(env.c, env.settings, "g2", only_manage, "installation", "*")
    gid = env.request().json()["grant"]["id"]
    assert env.approve(gid, user="g1").status_code == 403
    assert env.approve(gid, user="g2").status_code == 404, "HARDEN271 K2: g2 cannot see the grant (no people.read / grant permission) - the uniform 404"
    assert env.grant(gid)["state"] == "requested"


def test_a_bearer_token_client_and_an_internal_principal_cannot_approve(env):
    gid = env.request().json()["grant"]["id"]
    rev = env.grant(gid)["revision"]
    for p in (Principal("dev-joni", "joni", "joni", "remote", via="bearer"), Principal("dev-joni", "joni", "joni", "internal")):
        with pytest.raises(ag.ApiError) as exc:
            ag.approve(env.db, p, gid, rev, told=True)
        assert exc.value.code == "access_grant_interactive_only"
    assert env.grant(gid)["state"] == "requested"


def test_a_local_identity_cannot_approve_unless_the_owner_enables_it(env):
    gid = env.request().json()["grant"]["id"]
    p = Principal("l_abc", "loc", "loc", "local", via="cookie", factor_ok=True)
    with pytest.raises(ag.ApiError) as exc:
        ag.approve(env.db, p, gid, env.grant(gid)["revision"], told=True)
    assert exc.value.code == "access_grant_local_not_allowed"


def test_window_doors_and_subject_validation(env):
    assert env.request(vf=VU, vu=VF).status_code == 422
    r = env.request(vf="2026-10-22T05:00:00Z", vu="2026-11-06T05:00:00Z")
    assert r.status_code == 422 and r.json()["details"]["code"] == "too_long", "more than 14 days (owner answer 8)"
    assert env.request(doors={"*": [1]}).status_code == 422, "never all stations"
    assert env.request(doors={"st-a": []}).status_code == 422
    assert env.request(doors={"st-a": [1, 2], "st-b": [1, 2], "st-c": [1]}).status_code == 422, "at most 4 doors by default"
    r = env.request(contact_id=env.vendor)
    assert r.status_code == 409 and r.json()["details"]["reason"] == "contact_is_company", "a company never holds a credential"
    assert env.request(credential="card").status_code == 409, "cards wait for a later phase (CR X5)"


def test_approval_needs_a_number_the_person_confirmed_and_fresh(env):
    with env.db.connection() as conn:
        managers_mark = env.contact(conn, name="סומן ע״י מנהל", vendor_id=env.vendor, phone="972500000043", via="manager")
        stale = env.contact(conn, name="מספר ישן", vendor_id=env.vendor, phone="972500000044", confirmed=T0 - timedelta(days=200))
    for cid, reason in ((managers_mark, "phone_not_verified"), (stale, "phone_not_fresh")):
        gid = env.request(contact_id=cid).json()["grant"]["id"]
        r = env.approve(gid)
        assert r.status_code == 409 and r.json()["details"]["reason"] == reason, r.text


def test_approval_needs_the_privacy_notice(env):
    gid = env.request().json()["grant"]["id"]
    r = env.approve(gid, told=False)
    assert r.status_code == 409 and r.json()["code"] == "access_grant_notice"
    assert env.approve(gid).status_code == 200
    with env.db.connection(mode="read") as conn:
        assert conn.execute("SELECT via, version FROM access_grant_notices WHERE grant_id = ?", (gid,)).fetchone()[:] == ("approver", ag.NOTICE_VERSION)


def test_the_approver_may_only_narrow(env):
    gid = env.request(doors={"st-a": [1]}).json()["grant"]["id"]
    r = env.approve(gid, doors={"st-a": [1], "st-b": [1]})
    assert r.status_code == 422 and r.json()["details"]["code"] == "wider_than_requested"
    r = env.approve(gid, valid_until="2026-10-22T16:00:00Z")
    assert r.status_code == 422


# ================================================================ the flow on fakes


def test_happy_path_provisions_without_a_pin_and_sends_the_code_the_evening_before(env, caplog):
    caplog.set_level(logging.DEBUG)
    gid = env.request().json()["grant"]["id"]
    assert env.transport.sent == [] and env.engine.calls == [], "a request sends nothing and touches no WisKey"
    assert env.approve(gid).status_code == 200
    assert env.transport.sent == [], "approval sends nothing at once (owner answer 4)"
    env.run()
    g = env.grant(gid)
    assert g["state"] == "active" and g["code_state"] == "pending" and g["code_due_at"] == "2026-10-21T15:00:00Z"
    p = env.person_of(gid)
    assert p["doors"] == {"st-a": [1]} and (p["valid_from"], p["valid_until"]) == (VF, VU) and p["active"] is True
    assert p["pin"] is None and p["category"] == "contractor" and p["employee_no"].isdigit() and len(p["employee_no"]) == 9, "WisKey generated the number; Arx did not send one"
    env.clock[0] = DUE - timedelta(minutes=1)
    env.run()
    assert env.transport.sent == [], "not before the due time"
    env.clock[0] = DUE
    env.run()
    assert len(env.transport.sent) == 1
    number, text = env.transport.sent[0]
    pin = env.person_of(gid)["pin"]
    assert number == PHONE and pin in SENTINELS and pin in text
    assert "22.10" in text and "דלתות" in text and "אישי" in text and gid[:8] in text, "doors, dates, hours, personal, reference (owner answer 11)"
    assert "http" not in text and "/t/" not in text, "never a link in the code message"
    g = env.grant(gid)
    assert g["code_state"] == "sent" and g["code_sends"] == 1
    # the window ends: R1 - the PIN is removed and the doors cleared in WisKey too
    env.clock[0] = datetime(2026, 10, 22, 14, 0, tzinfo=UTC)
    env.run()
    g = env.grant(gid)
    assert g["state"] == "ended" and g["end_reason"] == "ended"
    p = env.person_of(gid)
    assert p["pin"] is None and p["doors"] == {} and p["active"] is False
    assert len(env.engine.people) == 1, "owner answer 10: WisKey keeps the person until a manual delete"
    _leak_scan(env, caplog, pin)


def _leak_scan(env: Env, caplog, pin: str) -> None:
    data_dir = Path(env.settings.db_path).parent
    blobs = b"".join(p.read_bytes() for p in data_dir.glob(Path(env.settings.db_path).name + "*"))
    assert pin.encode() not in blobs, "the PIN is in the database file or its WAL"
    with env.db.connection(mode="read") as conn:
        rows = [json.dumps(dict(r), ensure_ascii=False) for r in conn.execute("SELECT * FROM audit_log").fetchall()]
        grants = [json.dumps(dict(r), ensure_ascii=False) for r in conn.execute("SELECT * FROM access_grants").fetchall()]
    for text in rows + grants:
        assert pin not in text and PHONE not in text
    assert pin not in caplog.text and PHONE not in caplog.text
    for answer in env.answers:
        assert pin not in answer
    listing = env.c.get(f"{API}/access-grants?all=true").text
    assert pin not in listing and PHONE not in listing, "the masked number only (····41)"


def test_the_grant_listing_shows_the_masked_number_and_the_delivery_state_at_the_sensitive_level_only(env):
    gid = env.active_grant()
    mine = env.c.get(f"{API}/access-grants").json()["grants"]
    assert mine[0]["person"]["number"] == "····41" and mine[0]["code_state"] == "pending"
    bind(env.c, env.settings, "reader", "operator", "installation", "*")  # access.people.read, not sensitive
    theirs = env.c.get(f"{API}/access-grants", headers=as_user("reader")).json()["grants"]
    assert theirs and theirs[0]["id"] == gid and theirs[0]["person"]["number"] is None and theirs[0]["code_state"] is None
    bind(env.c, env.settings, "nobody", "viewer", "floor", env.w.floors["floor2"])
    assert env.c.get(f"{API}/access-grants", headers=as_user("nobody")).json()["grants"] == []


def test_a_widening_needs_a_new_approval_and_a_narrowing_merges_at_once(env):
    gid = env.active_grant(doors={"st-a": [1, 2]})
    r = env.request(doors={"st-a": [1, 2], "st-b": [1]})
    assert r.status_code == 200 and r.json()["outcome"] == "widening"
    g = env.grant(gid)
    assert g["state"] == "active" and g["pending_json"] and json.loads(g["doors_json"]) == {"st-a": [1, 2]}
    env.run()
    assert env.person_of(gid)["doors"] == {"st-a": [1, 2]}, "the wider scope is not in WisKey before a new approval"
    r = env.request(doors={"st-a": [1]})
    assert r.json()["outcome"] == "merged"
    g = env.grant(gid)
    assert g["needs_push"] == 1 and g["pending_json"] is None
    env.run()
    assert env.person_of(gid)["doors"] == {"st-a": [1]} and env.grant(gid)["needs_push"] == 0
    # a widening approved by an approver is pushed
    env.request(doors={"st-a": [1], "st-b": [1]})
    assert env.approve(gid).status_code == 200
    env.run()
    assert env.person_of(gid)["doors"] == {"st-a": [1], "st-b": [1]}


def test_one_live_grant_per_person_at_the_database_level(env):
    gid = env.active_grant()
    with env.db.connection() as conn:
        with pytest.raises(Exception):
            conn.execute("""INSERT INTO access_grants(id, subject_kind, subject_id, source_kind, doors_json, valid_from, valid_until, credential, state,
                            requested_by, created_at, updated_at) VALUES ('dup', 'contact', ?, 'manual', '{}', ?, ?, 'pin', 'requested', 'x', 't', 't')""",
                         (env.tech, VF, VU))
    assert env.grant(gid)["state"] == "active"


def test_vendor_deactivation_revokes_every_persons_grant_and_removes_the_pin(env):
    g1 = env.active_grant(env.tech)
    g2 = env.active_grant(env.tech2)
    env.clock[0] = DUE
    env.run()
    assert env.person_of(g1)["pin"] and env.person_of(g2)["pin"]
    env.sql("UPDATE ticket_contacts SET active = 0 WHERE id = ?", env.vendor)
    env.run()
    for gid in (g1, g2):
        g = env.grant(gid)
        assert (g["state"], g["end_reason"]) == ("revoked", "vendor_inactive")
        p = env.person_of(gid)
        assert p["pin"] is None and p["doors"] == {} and p["active"] is False


def test_a_phone_change_revokes_and_kills_the_queued_code(env):
    gid = env.active_grant()
    env.sql("UPDATE ticket_contacts SET phone_e164 = '972500000099', phone_confirmed_at = NULL, phone_confirmed_via = NULL WHERE id = ?", env.tech)
    env.clock[0] = DUE
    env.run()
    g = env.grant(gid)
    assert (g["state"], g["end_reason"]) == ("revoked", "contact_changed") and g["code_state"] == "not_delivered"
    assert env.transport.sent == [], "the code never went to the new (or the old) number"


def test_a_permission_bump_that_removes_the_approvers_station_revokes_an_unrelated_bump_does_not(env):
    rid = env.role("מאשר", APPROVER)
    bind(env.c, env.settings, "appr", rid, "access_control_station", "st-a")
    gid = env.request().json()["grant"]["id"]
    assert env.approve(gid, user="appr").status_code == 200
    env.run()
    rev0 = env.grant(gid)["approval_revision"]
    bind(env.c, env.settings, "someone", "viewer", "installation", "*")
    with env.db.connection() as conn:
        bump_permission_revision(conn)
    env.run()
    g = env.grant(gid)
    assert g["state"] == "active" and g["approval_revision"] > rev0, "re-decided and kept (owner answer 5)"
    with env.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = '2026-10-20T06:00:00Z' WHERE subject_id = 'dev-appr'")
        bump_permission_revision(conn)
    env.run()
    g = env.grant(gid)
    assert (g["state"], g["end_reason"]) == ("revoked", "approver_lost_authority")
    assert env.person_of(gid)["doors"] == {}


def test_an_approver_who_loses_one_of_two_stations_narrows_the_grant(env):
    rid = env.role("מאשר", APPROVER)
    bind(env.c, env.settings, "appr", rid, "access_control_station", "st-a")
    bind(env.c, env.settings, "appr", rid, "access_control_station", "st-b")
    gid = env.request(doors={"st-a": [1], "st-b": [1]}).json()["grant"]["id"]
    assert env.approve(gid, user="appr").status_code == 200
    env.run()
    with env.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = 't' WHERE subject_id = 'dev-appr' AND scope_id = 'st-b'")
        bump_permission_revision(conn)
    env.run()
    env.run()
    assert env.grant(gid)["state"] == "active" and json.loads(env.grant(gid)["doors_json"]) == {"st-a": [1]}
    assert env.person_of(gid)["doors"] == {"st-a": [1]}


def test_a_restart_drops_a_queued_code_and_marks_it_not_delivered(env):
    gid = env.active_grant()
    env.sql("UPDATE access_grants SET code_state = 'queued' WHERE id = ?", gid)
    ag.WORKER.on_startup(env.db)
    g = env.grant(gid)
    assert g["code_state"] == "not_delivered" and g["state"] == "active", "the PIN works for nobody who does not know it"
    env.clock[0] = DUE
    env.run()
    assert env.transport.sent == [], "a lost code is never re-sent - rotation is the only way on"
    assert env.post(f"/access-grants/{gid}/rotate", {"revision": env.grant(gid)["revision"]}).status_code == 200
    env.run()
    assert len(env.transport.sent) == 1 and env.grant(gid)["code_state"] == "sent"


def test_an_unknown_provisioning_outcome_never_sends_a_code(env):
    env.engine.unknown_before_apply = True
    gid = env.request().json()["grant"]["id"]
    env.approve(gid)
    env.run()  # provisioning -> unknown
    assert env.grant(gid)["state"] in ("unknown", "revoking", "failed")
    env.clock[0] = DUE
    env.run()
    env.run()
    g = env.grant(gid)
    assert g["state"] == "failed" and env.transport.sent == [], "a fresh read showed nothing: failed, never a blind retry, no code"
    assert env.engine.calls.count("apply") == 1


def test_an_unknown_outcome_that_landed_is_found_by_the_fresh_read(env):
    env.engine.unknown_after_apply = True
    gid = env.request().json()["grant"]["id"]
    env.approve(gid)
    env.run()
    env.run()
    assert env.grant(gid)["state"] == "active" and env.engine.calls.count("apply") == 1


def test_a_pin_write_with_an_unknown_outcome_is_never_sent(env):
    gid = env.active_grant()
    env.engine.unknown_before_apply = True
    env.clock[0] = DUE
    env.run()
    assert env.transport.sent == [] and env.grant(gid)["code_state"] == "not_delivered"


def test_pin_conflicts_are_retried_three_times_then_not_delivered(env):
    gid = env.active_grant()
    env.engine.pin_conflicts = 2
    env.clock[0] = DUE
    env.run()
    assert len(env.transport.sent) == 1, "two conflicts, the third PIN is written and sent"
    gid2 = env.active_grant(env.tech2)
    env.engine.pin_conflicts = 3
    env.run()
    assert env.grant(gid2)["code_state"] == "not_delivered" and len(env.transport.sent) == 1


def test_an_unreachable_engine_keeps_the_approval_and_retries_every_five_minutes(env):
    env.engine.offline = True
    gid = env.request().json()["grant"]["id"]
    env.approve(gid)
    env.run()
    g = env.grant(gid)
    assert g["state"] == "approved" and g["provision_attempts"] == 1 and g["pushed"] == 0
    env.run()
    assert env.grant(gid)["provision_attempts"] == 1, "not before 5 minutes"
    env.engine.offline = False
    env.clock[0] = T0 + timedelta(minutes=6)
    env.run()
    assert env.grant(gid)["state"] == "active"


def test_a_revoke_wiskey_does_not_acknowledge_stays_pending_and_is_retried(env):
    gid = env.active_grant()
    env.engine.offline = True
    r = env.post(f"/access-grants/{gid}/revoke")
    assert r.status_code == 200 and r.json()["grant"]["state"] == "revoking"
    env.clock[0] = T0 + timedelta(minutes=3)
    env.run()
    with env.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notifications WHERE source = 'access.grant_attention'").fetchone()[0] >= 1, "managers told after 2 min"
    env.engine.offline = False
    env.clock[0] = T0 + timedelta(minutes=10)  # past the retry backoff
    env.run()
    assert env.grant(gid)["state"] == "revoked" and env.person_of(gid)["active"] is False


def test_revoke_needs_only_one_station_and_a_viewer_cannot(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    bind(env.c, env.settings, "vic2", "viewer", "installation", "*")
    assert env.post(f"/access-grants/{gid}/revoke", user="vic2").status_code == 404, "HARDEN271 K2: a viewer cannot see the grant - the uniform 404"
    rid = env.role("ניהול אנשים עמדה ב", ["access.people.manage"])
    bind(env.c, env.settings, "mgr", rid, "access_control_station", "st-b")
    assert env.post(f"/access-grants/{gid}/revoke", user="mgr").status_code == 200
    assert env.grant(gid)["state"] == "revoked"


def test_unlink_revokes_first_and_keeps_the_wiskey_person(env):
    gid = env.active_grant()
    link_id = env.grant(gid)["link_id"]
    pid = env.person_of(gid)["id"]
    r = env.c.delete(f"{API}/access-grants/links/{link_id}")
    assert r.status_code == 200 and r.json()["state"] == "unlinked", r.text
    g = env.grant(gid)
    assert (g["state"], g["end_reason"]) == ("revoked", "unlinked")
    assert pid in env.engine.people and env.engine.people[pid]["doors"] == {}, "the person stays and loses the grant only"


def test_delete_now_removes_a_person_arx_created_and_refuses_a_matched_one(env):
    gid = env.active_grant()
    link_id = env.grant(gid)["link_id"]
    pid = env.person_of(gid)["id"]
    assert env.post(f"/access-grants/links/{link_id}/delete-person", {"confirm": "לא"}).status_code == 422
    r = env.post(f"/access-grants/links/{link_id}/delete-person", {"confirm": ag.DELETE_WORD})
    assert r.status_code == 200 and r.json()["pending"] is True, r.text
    assert pid in env.engine.deleted and env.grant(gid)["end_reason"] == "person_deleted"
    env.engine.add_person("wk-staff", stations=["st-a"])
    with env.db.connection() as conn:
        other = env.contact(conn, name="טכנאי קבוע", vendor_id=env.vendor, phone="972500000045")
    r = env.post("/access-grants/links", {"contact_id": other, "wiskey_person_id": "wk-staff"})
    assert r.status_code == 200, r.text
    r = env.post(f"/access-grants/links/{r.json()['link']['id']}/delete-person", {"confirm": ag.DELETE_WORD})
    assert r.status_code == 409 and r.json()["code"] == "access_person_not_ours"


def test_matching_needs_people_manage_on_every_station_of_the_wiskey_person(env):
    env.engine.add_person("wk-7", stations=["st-a", "st-b"])
    rid = env.role("ניהול עמדה א", ["access.people.manage"])
    bind(env.c, env.settings, "half", rid, "access_control_station", "st-a")
    bind(env.c, env.settings, "half", "tickets_configure", "installation", "*")
    r = env.post("/access-grants/links", {"contact_id": env.tech, "wiskey_person_id": "wk-7"}, user="half")
    assert r.status_code == 403, r.text
    assert env.post("/access-grants/links", {"contact_id": env.tech, "wiskey_person_id": "wk-7"}).status_code == 200
    r = env.post("/access-grants/links", {"contact_id": env.tech2, "wiskey_person_id": "wk-7"})
    assert r.status_code == 409, "one WisKey person, one Arx subject"


def test_a_matched_persons_other_stations_need_the_approvers_authority_too(env):
    env.engine.add_person("wk-9", stations=["st-z"])
    env.post("/access-grants/links", {"contact_id": env.tech, "wiskey_person_id": "wk-9"})
    rid = env.role("מאשר א", APPROVER)
    bind(env.c, env.settings, "appr", rid, "access_control_station", "st-a")
    gid = env.request(doors={"st-a": [1]}).json()["grant"]["id"]
    r = env.approve(gid, user="appr")
    assert r.status_code == 403 and r.json()["details"]["target_id"] == "st-z"


def test_the_wiskey_person_deleted_elsewhere_stays_revoking(env):
    """WisKey round 3 (R3-03 / handoff item 2): `user_not_found` may mean "outside the service user's scope" and a delete leaves a
    tombstone whose station removals are pending - it is never proof of revocation. The grant stays `revoking` (authority withdrawn
    in Arx, retried, the managers alerted) and the link is marked missing; it is never reported `revoked` on that answer."""
    gid = env.active_grant()
    pid = env.person_of(gid)["id"]
    del env.engine.people[pid]
    env.post(f"/access-grants/{gid}/revoke")
    g = env.grant(gid)
    assert g["state"] == "revoking"
    assert int(g["revoke_attempts"]) >= 1
    with env.db.connection(mode="read") as conn:
        assert ag.link_row(conn, g["link_id"])["state"] == "wiskey_missing"


def test_ticket_done_ends_the_access_at_once_and_the_backstop_catches_a_missed_hook(env):
    t = env.w.create("joni", "דלת חניון")
    r = env.request(ticket_id=t["id"])
    gid = r.json()["grant"]["id"]
    env.approve(gid)
    env.run()
    with env.db.connection() as conn:
        assert ag.on_ticket_ended(conn, t["id"], "ticket_ended") == 1
    assert env.grant(gid)["state"] == "revoking", "in the ticket's own transaction (owner answer 6)"
    env.run()
    assert env.grant(gid)["state"] == "revoked"
    # the backstop: a ticket marked done by a path without the hook
    t2 = env.w.create("joni", "מעלית")
    gid2 = env.request(contact_id=env.tech2, ticket_id=t2["id"]).json()["grant"]["id"]
    env.approve(gid2)
    env.run()
    env.sql("UPDATE tickets SET status = 'done' WHERE id = ?", t2["id"])
    env.run()
    assert (env.grant(gid2)["state"], env.grant(gid2)["end_reason"]) == ("revoked", "ticket_ended")


def test_the_ticket_status_route_ends_the_grant(env):
    t = env.w.create("joni", "שער חשמלי")
    gid = env.request(ticket_id=t["id"]).json()["grant"]["id"]
    env.approve(gid)
    env.run()
    for to in ("in_progress", "done"):
        r = env.w.status("joni", t["id"], to)
        if r.status_code != 200:
            break
    if env.w.detail(t["id"])["status"] == "done":
        assert env.grant(gid)["end_reason"] == "ticket_ended"
    else:  # the manager's move to done is not allowed from this state in this department: the cancel path ends it too
        assert env.w.status("joni", t["id"], "cancelled", note="בוטל").status_code == 200
        assert env.grant(gid)["end_reason"] == "ticket_ended"


def test_revoke_all_needs_the_word_and_a_system_admin(env):
    g1 = env.active_grant()
    assert env.post("/access-grants/revoke-all", {"confirm": "x"}).status_code == 422
    bind(env.c, env.settings, "sa2", "site_admin", "installation", "*")
    assert env.post("/access-grants/revoke-all", {"confirm": ag.REVOKE_ALL_WORD}, user="sa2").status_code == 403
    r = env.post("/access-grants/revoke-all", {"confirm": ag.REVOKE_ALL_WORD})
    assert r.status_code == 200 and r.json()["revoked"] == 1
    assert env.grant(g1)["end_reason"] == "feature_off"


def test_switching_off_stops_new_requests_but_existing_grants_keep_being_ended(env):
    gid = env.active_grant()
    env.sql("UPDATE settings SET value = 'off' WHERE key = ?", ag.FLAG_KEY)
    assert env.request(contact_id=env.tech2).status_code == 409
    env.clock[0] = datetime(2026, 10, 22, 14, 0, tzinfo=UTC)
    env.run()
    assert env.grant(gid)["state"] == "ended" and env.person_of(gid)["pin"] is None


def test_the_code_caps(env):
    gid = env.active_grant()
    env.clock[0] = DUE
    env.run()
    for i in range(2):
        env.clock[0] = DUE + timedelta(minutes=2 * (i + 1))
        assert env.post(f"/access-grants/{gid}/rotate", {"revision": env.grant(gid)["revision"]}).status_code == 200
        env.run()
    assert len(env.transport.sent) == 3 and len({t for _n, t in env.transport.sent}) == 3, "each rotation is a new PIN"
    r = env.post(f"/access-grants/{gid}/rotate", {"revision": env.grant(gid)["revision"]})
    assert r.status_code == 409 and r.json()["code"] == "access_grant_code_cap"


def test_windows_and_emergency_settings_have_no_effect(env):
    """WisKey door windows and emergency are OFF and nothing here depends on them: no setting by those names changes any path,
    and no door is ever opened (the engine port has no door command at all)."""
    env.sql("INSERT OR REPLACE INTO settings(key, value) VALUES ('access.door_windows', 'on')")
    env.sql("INSERT OR REPLACE INTO settings(key, value) VALUES ('access.emergency', 'on')")
    gid = env.active_grant()
    assert env.grant(gid)["state"] == "active"
    assert not any(c in ("open", "unlock", "release", "test_unlock") for c in env.engine.calls)
    from smplwise.services import access_grant_engine

    assert not any(n for n in dir(access_grant_engine.Engine) if "open" in n or "unlock" in n or "release" in n)


def test_audit_rows_carry_ids_only(env):
    gid = env.active_grant()
    env.clock[0] = DUE
    env.run()
    with env.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT action, details_json FROM audit_log WHERE action LIKE 'access.%'").fetchall()
    actions = {r["action"] for r in rows}
    assert {"access.grant.request", "access.grant.approve", "access.grant.provision", "access.grant.activate", "access.grant.code_queued",
            "access.grant.code_sent", "access.person_link.create", "access.grant.notice_ack"} <= actions, actions
    text = " ".join(r["details_json"] or "" for r in rows)
    assert "יוסי" not in text and PHONE not in text and "pk-" not in text


# ---- n2 privacy notice and four-language code message (technician privacy pack, 2026-10-18)
def test_templates_are_well_formed():
    import string
    import unicodedata
    langs = {"he", "en", "ar", "ru"}
    for table in (ag.NOTICE_TEXT, ag.NOTICE_ATTEST, ag.TEMPLATES, ag.HOURS_PHRASE):
        assert set(table) == langs
        for text in table.values():
            assert not [c for c in text if unicodedata.category(c) in ("Cc", "Cf")]
            assert unicodedata.normalize("NFC", text) == text
    for text in ag.TEMPLATES.values():
        names = [f for _, f, _, _ in string.Formatter().parse(text) if f is not None]
        assert sorted(names) == ["code", "dates", "doors", "hours", "ref"]
        assert "http" not in text and "www" not in text and "/" not in text


@pytest.mark.parametrize("lang,phrase", [("he", "משעה"), ("en", "08:00-17:00"), ("ar", "من 08:00 حتى 17:00"), ("ru", "с 08:00 до 17:00")])
def test_the_code_message_is_rendered_in_the_contacts_language(env, lang, phrase):
    env.sql("UPDATE ticket_contacts SET lang = ? WHERE id = ?", lang, env.tech)
    gid = env.request().json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    env.run()
    env.clock[0] = DUE
    env.run()
    assert len(env.transport.sent) == 1
    _number, text = env.transport.sent[0]
    pin = env.person_of(gid)["pin"]
    assert phrase in text and gid[:8] in text and text.count(pin) == 1
    assert "http" not in text
    if lang != "en":
        assert "your personal entry code" not in text


# ================================================================ WisKey adapter findings (static source reading, 2.8.0)

def _is_utc_z(value: str) -> datetime:
    parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    return parsed.replace(tzinfo=UTC)


@pytest.mark.parametrize("category", ["contractor", "visitor"])
def test_create_payload_always_carries_a_valid_aware_validity_pair(category):
    data = age.create_payload(display_name="x", employee_no="x1", category=category, responsible_person="r", access_purpose="p", at=T0)
    vf, vu = _is_utc_z(data["valid_from"]), _is_utc_z(data["valid_until"])
    assert vf < vu and datetime(1970, 1, 1, tzinfo=UTC) <= vf and vu <= datetime(2037, 12, 31, 23, 59, 59, tzinfo=UTC)
    assert data["active"] is False and "." not in data["valid_from"] + data["valid_until"]
    edge = age.create_payload(display_name="x", employee_no="x1", category=category, responsible_person="r", access_purpose="p",
                              at=datetime(2040, 1, 1, 0, 0, 0, 123456, tzinfo=UTC))
    assert _is_utc_z(edge["valid_from"]) < _is_utc_z(edge["valid_until"]) <= datetime(2037, 12, 31, 23, 59, 59, tzinfo=UTC)
    low = age.create_payload(display_name="x", employee_no="x1", category=category, responsible_person="r", access_purpose="p",
                             at=datetime(1960, 1, 1, tzinfo=UTC))
    assert _is_utc_z(low["valid_from"]) >= datetime(1970, 1, 1, tzinfo=UTC)


def test_create_payload_never_sends_null_and_normalises_text():
    data = age.create_payload(display_name="  " + "א" * 40 + "  ", employee_no="x-1_A", category="visitor", responsible_person="   ", access_purpose=None)  # type: ignore[arg-type]
    assert data["responsible_person"] == "Arx" and data["access_purpose"] == "" and "phone" not in data
    assert len(data["display_name"]) == 32 and data["display_name"] == "א" * 32
    assert all(v is not None for v in data.values())
    assert age.create_payload(display_name="   ", employee_no="a", category="visitor", responsible_person="r", access_purpose="")["display_name"] == "Guest"
    assert age.create_payload(display_name="😀" * 40, employee_no="a", category="visitor", responsible_person="r", access_purpose="")["display_name"] == "😀" * 32
    for bad in ("", "a" * 33, "יוסי", "a b", "a.b"):
        with pytest.raises(ValueError):
            age.create_payload(display_name="x", employee_no=bad, category="visitor", responsible_person="r", access_purpose="")


def test_the_arx_employee_numbers_fit_wiskeys_pattern(env):
    gid = env.active_grant()
    assert age._EMPLOYEE_NO.fullmatch(env.person_of(gid)["employee_no"])


def test_the_strip_payload_is_the_documented_revoke_all_with_the_one_allowed_null():
    # WisKey-stated (reply 2, source-derived, NOT_RUN): group_ids [] + permission_overrides {} + active false + pin null; NOT door_permissions {}
    assert age.strip_payload() == {"group_ids": [], "permission_overrides": {}, "active": False, "pin": None}
    assert "door_permissions" not in age.strip_payload() and "employee_no" not in age.strip_payload()
    created = age.create_payload(display_name="x", category="visitor", responsible_person="r", access_purpose="")
    assert "employee_no" not in created and all(v is not None for v in created.values())
    assert "employee_no" not in age.apply_payload(doors={"st-a": [1]}, valid_from=VF, valid_until=VU, timing=None, active=True)


def _public(**over):
    base = {"id": "u1", "revision": 3, "display_name": "x", "active": True, "employee_no": "123456789", "pin_configured": True, "group_ids": [],
            "permission_overrides": {}, "assignments": {}}
    return {**base, **over}


def test_person_from_raw_projects_the_enabled_assignments_and_reads_a_restricted_view_as_unknown():
    row = lambda en, locks: {"config_entry_id": "c", "enabled": en, "allowed_locks": locks, "desired_revision": 3, "applied_revision": 3,
                             "sync_state": "synced", "last_error": None}
    p = age.person_from_raw(_public(assignments={"st-a": row(True, [2, 1]), "st-b": row(False, [1])}, permission_overrides={"st-b": "deny"}))
    assert p.doors_known and p.doors == {"st-a": [1, 2]}, "disabled rows keep historical locks and are skipped"
    assert p.stations == ("st-a", "st-b") and p.overrides == {"st-b": "deny"} and p.employee_no == "123456789"
    assert age.person_from_raw(_public()).doors_known and age.person_from_raw(_public()).doors == {}, "a complete empty projection is known-empty"
    for bad in ({"assignments": None}, {"permission_overrides": None}, {"group_ids": None}, {"redacted_fields": ["assignments"]},
                {"redacted_fields": "x"}, {"redacted_fields": [1]}):
        q = age.person_from_raw(_public(**bad))
        assert q.doors_known is False and q.doors == {}, bad
    cred = age.person_from_raw(_public(pin_configured=False, redacted_fields=["pin_configured"]))
    # R3-03 (round 3): any restriction marker means a projection for a restricted caller, whose assignments may be filtered by station
    assert cred.doors_known is False and cred.pin_known is False
    assert age.person_from_raw(_public(pin_configured=False)).pin_known is True
    assert age.person_from_raw({"id": "u", "revision": 1, "door_permissions": {"st-a": [1]}}).doors_known is False, "door_permissions is not read"


def test_plan_overrides_replaces_the_complete_dict_and_refuses_a_restricted_view():
    p = age.EnginePerson(id="u", revision=1, doors={"st-a": [1], "st-b": [1]}, overrides={"st-c": "deny", "st-a": "allow"}, stations=("st-a", "st-b", "st-c"))
    assert age.plan_overrides(p, {"st-a": [1]}) == {"st-c": "deny", "st-a": "allow", "st-b": "deny"}, "other personal entries retained"
    assert age.plan_overrides(p, {"st-a": [1], "st-b": [2]}) is None
    assert age.plan_overrides(p, {"st-a": [1], "st-b": [1], "st-d": [1]}) == {"st-c": "deny", "st-a": "allow", "st-d": "allow"}
    for restricted in (age.EnginePerson(id="u", revision=1, doors_known=False), age.EnginePerson(id="u", revision=1, overrides_known=False)):
        with pytest.raises(EngineError) as e:
            age.plan_overrides(restricted, {"st-a": [1]})
        assert e.value.kind == "not_sent"


def test_narrowing_sends_the_complete_overrides_with_a_deny_and_keeps_the_personal_entries(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    p = env.person_of(gid)
    p["overrides"]["st-z"] = "deny"  # an unrelated personal exception set in WisKey
    env.engine.edit_elsewhere(p["id"])
    env.request(doors={"st-a": [1]})
    env.run()
    assert env.grant(gid)["needs_push"] == 0 and p["doors"] == {"st-a": [1]}
    last = env.engine.updates[-1]
    assert last["method"] == "apply" and last["doors"] == ["st-a"]
    assert last["overrides"] == {"st-a": "allow", "st-b": "deny", "st-z": "deny"}, "complete replacement: allow kept, st-b denied, st-z retained"


def test_dropping_a_station_from_the_door_map_alone_does_not_revoke_it_in_the_fake(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    p = env.person_of(gid)
    person = env.engine.get_person(p["id"])
    env.engine.apply(person.id, person.revision, doors={"st-a": [1]}, valid_from=VF, valid_until=VU, timing=None, active=True)
    assert set(p["doors"]) == {"st-a", "st-b"}, "WisKey-stated: omission is not revocation"
    with pytest.raises(EngineError):  # a key outside the resolved stations, and an empty lock list, are refused
        person = env.engine.get_person(p["id"])
        env.engine.apply(person.id, person.revision, doors={"st-q": [1]}, valid_from=VF, valid_until=VU, timing=None, active=True)
    with pytest.raises(EngineError):
        person = env.engine.get_person(p["id"])
        env.engine.apply(person.id, person.revision, doors={"st-a": []}, valid_from=VF, valid_until=VU, timing=None, active=True)


def test_a_narrowing_on_a_restricted_projection_sends_nothing(env):
    gid = env.active_grant(doors={"st-a": [1], "st-b": [1]})
    env.engine.hide_doors = True
    before = env.engine.calls.count("apply")
    env.request(doors={"st-a": [1]})
    env.run()
    assert env.engine.calls.count("apply") == before, "no replacement is built on a partial view"
    assert env.grant(gid)["needs_push"] == 1
    env.engine.hide_doors = False
    env.run()
    assert env.person_of(gid)["doors"] == {"st-a": [1]}


def test_the_revoke_is_one_update_and_is_done_only_after_readback_and_no_pending_revocation(env):
    gid = env.active_grant()
    env.engine.sync_lag = True
    env.post(f"/access-grants/{gid}/revoke")
    p = env.person_of(gid)
    assert p["doors"] == {} and p["overrides"] == {} and p["group_ids"] == [] and p["active"] is False and p["pin"] is None
    assert env.grant(gid)["state"] == "revoking", "the update result is not proof: the central sync status still shows a pending revocation"
    strips = [u for u in env.engine.updates if u["method"] == "strip"]
    assert len(strips) == 1
    env.clock[0] = T0 + timedelta(minutes=10)
    env.run()
    assert env.grant(gid)["state"] == "revoking" and len([u for u in env.engine.updates if u["method"] == "strip"]) == 1, "retries are reads only"
    env.engine.settle_revocations()
    env.clock[0] = T0 + timedelta(minutes=20)
    env.run()
    assert env.grant(gid)["state"] == "revoked"


def test_an_unknown_sync_status_keeps_the_revoke_pending(env):
    gid = env.active_grant()
    env.engine.status_unknown = True
    env.post(f"/access-grants/{gid}/revoke")
    env.clock[0] = T0 + timedelta(minutes=10)
    env.run()
    assert env.grant(gid)["state"] == "revoking"
    env.engine.status_unknown = False
    env.clock[0] = T0 + timedelta(minutes=20)
    env.run()
    assert env.grant(gid)["state"] == "revoked"


def test_a_revoke_is_not_reported_done_while_the_projection_is_restricted_and_never_hammers(env):
    gid = env.active_grant()
    env.engine.restricted_projection = True
    env.post(f"/access-grants/{gid}/revoke")
    assert env.grant(gid)["state"] == "revoking"
    assert env.person_of(gid)["active"] is False and env.grant(gid)["revoke_attempts"] >= 1
    writes = lambda: len([u for u in env.engine.updates if u["method"] == "strip"])
    reads = env.engine.calls.count("get_person")
    for _ in range(10):  # ten passes inside the first backoff window: no WisKey call at all
        env.run()
    assert writes() == 1 and env.engine.calls.count("get_person") == reads
    for minutes in (1, 3, 8, 20, 40, 70):
        env.clock[0] = T0 + timedelta(minutes=minutes)
        env.run()
    assert env.grant(gid)["state"] == "revoking" and writes() == 1, "after the one write the retries are reads only"
    assert env.grant(gid)["revoke_attempts"] <= 8, "exponential backoff, capped at 5 minutes"
    env.engine.restricted_projection = False
    env.clock[0] = T0 + timedelta(minutes=80)
    env.run()
    assert env.grant(gid)["state"] == "revoked"


def test_a_revoke_that_stays_pending_alerts_the_managers_again_every_hour(env):
    gid = env.active_grant()
    env.engine.hide_doors = True
    env.post(f"/access-grants/{gid}/revoke")
    count = lambda: env.sql_count("SELECT COUNT(*) FROM notifications WHERE source = 'access.grant_attention'")
    env.clock[0] = T0 + timedelta(minutes=3)
    env.run()
    first = count()
    assert first >= 1
    env.clock[0] = T0 + timedelta(minutes=30)
    env.run()
    assert count() == first, "not before the hour"
    env.clock[0] = T0 + timedelta(minutes=70)
    env.run()
    assert count() > first, "re-alerted after an hour in revoking"


def test_an_unknown_door_map_stays_unknown_and_delivers_no_code(env):
    env.engine.unknown_after_apply = True
    gid = env.request().json()["grant"]["id"]
    env.approve(gid)
    env.run()
    assert env.grant(gid)["state"] == "unknown"
    env.engine.hide_doors = True
    for _ in range(3):
        env.run()
    assert env.grant(gid)["state"] == "unknown", "a restricted view neither confirms nor revokes (F5)"
    env.engine.hide_doors = False
    env.run()
    assert env.grant(gid)["state"] == "active"
    env.engine.hide_doors = True
    env.clock[0] = DUE
    env.run()
    assert env.transport.sent == [] and env.grant(gid)["code_state"] == "not_delivered"


def test_the_code_is_delivered_against_the_projected_door_map(env):
    gid = env.active_grant(doors={"st-a": [1, 2]})
    env.clock[0] = DUE
    env.run()
    assert len(env.transport.sent) == 1 and env.grant(gid)["code_state"] == "sent"


# ================================================================ WisKey round 3 (R3-03 / R3-06, handoff item 2) - fakes only, NOT_RUN on WisKey

def _always_missing(env):
    def missing(person_id):
        env.engine.calls.append("get_person")
        raise EngineError("not_found", "user_not_found")
    env.engine.get_person = missing


def test_r3_a_person_missing_at_provisioning_is_revoking_never_revoked(env):
    """`user_not_found` may mean "outside the service user's scope": a grant whose person WisKey does not show is withdrawn in Arx
    (`revoking`, authority gone, the managers alerted) but never reported `revoked` on that answer alone."""
    gid = env.request().json()["grant"]["id"]
    env.approve(gid)
    _always_missing(env)
    for minutes in (0, 5, 30, 90):
        env.clock[0] = T0 + timedelta(minutes=minutes)
        env.run()
        g = env.grant(gid)
        assert (g["state"], g["end_reason"]) == ("revoking", "wiskey_missing"), (minutes, g["state"])
    with env.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM notifications WHERE source = 'access.grant_attention'").fetchone()[0] >= 1, "managers told"


def test_r3_an_active_grant_whose_person_is_not_found_on_revoke_keeps_retrying(env):
    gid = env.active_grant()
    _always_missing(env)
    env.post(f"/access-grants/{gid}/revoke")
    for minutes in (1, 10, 60):
        env.clock[0] = T0 + timedelta(minutes=minutes)
        env.run()
    g = env.grant(gid)
    assert g["state"] == "revoking" and int(g["revoke_attempts"]) >= 2, "never ended on user_not_found"


def test_r3_approval_is_refused_when_the_linked_person_is_not_found(env):
    """The approver's authority over the person's other stations cannot be checked against a `user_not_found`: refused, nothing sent."""
    env.engine.add_person("wk-out", stations=["st-z"])
    assert env.post("/access-grants/links", {"contact_id": env.tech, "wiskey_person_id": "wk-out"}).status_code == 200
    gid = env.request(doors={"st-a": [1]}).json()["grant"]["id"]
    del env.engine.people["wk-out"]  # out of the service user's scope, or gone - WisKey answers the same
    r = env.approve(gid)
    assert r.status_code == 409 and r.json()["code"] == "access_person_missing", r.text
    assert env.grant(gid)["state"] == "requested" and "apply" not in env.engine.calls


def test_r3_an_unknown_outcome_is_decided_only_by_a_readback_that_answered(env):
    """R3-06: after an unknown provisioning write the next step is a fresh read; while no read answers (the write may still be out),
    nothing is decided and nothing is written again."""
    env.engine.unknown_after_apply = True
    gid = env.request().json()["grant"]["id"]
    env.approve(gid)
    env.run()
    assert env.grant(gid)["state"] == "unknown"
    for _ in range(3):
        env.engine.fail["get_person"] = "not_sent"  # e.g. `outcome_pending`: the earlier write's call is still out
        env.run()
        assert env.grant(gid)["state"] == "unknown"
    env.run()
    assert env.grant(gid)["state"] == "active" and env.engine.calls.count("apply") == 1, "decided by the readback, never replayed"
