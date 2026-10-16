"""USR2 phase 2: the self-service password reset by a WhatsApp code, manager links by WhatsApp, and the security notifications -
negative cases first (services/local_reset.py, routers/local_identity.py).

Enumeration uniformity of the request (every case answers the same 202 and only an eligible user's number gets a message), an
administrative user refused at the moment of use even when reset_mode was set earlier (security review F6), code replay, the five
attempts, the cooldown and the daily caps, the code bound to the credential row and to the number, no code / number / token in a log
line, an audit row, a ledger row or an answer, manager links never by WhatsApp for administrative targets (and only to a verified
number for the others), the notification-centre wiring of auth.local.storm / account_delayed / account_locked (to the managers),
and the storm needing several networks (F7). Fakes only: the fake `ha-whatsapp` transport, no Home Assistant, no phone."""
from __future__ import annotations

import json
import logging
import re

import pytest
from fake_ha_whatsapp import FakeHaWhatsapp, PairedAccount
from test_local_identity import GOOD, GOOD2, Lx, _body
from test_remote_access import ORIGIN

from smplwise.db import now_iso, set_setting
from smplwise.services import ha_user_auth as hua
from smplwise.services import local_identity as li
from smplwise.services import local_reset as lr
from smplwise.services import messaging_accounts as ma
from smplwise.services import messaging_runtime as mr
from smplwise.services import notify_whatsapp as nwa

ENTRY = "01JFAKEENTRYA"
KEY = f"entry:{ENTRY}"
PHONE = "+972 50-555-0191"  # a fake number
DIGITS = "972505550191"
NEW_PW = "silver canyon morning tide"
REQ = "/arx/api/v1/auth/local/reset/request"
CONF = "/arx/api/v1/auth/local/reset/confirm"


class Rx(Lx):
    """Lx with the WhatsApp fake, an account mapped to the `identity.local` use, and helpers for directory numbers."""

    def __init__(self, settings, tmp_path, monkeypatch):
        super().__init__(settings, tmp_path, monkeypatch)
        monkeypatch.setattr(mr, "ws_connected", lambda: True)
        self.fake = FakeHaWhatsapp([PairedAccount(ENTRY, "15555550191")])
        monkeypatch.setattr(nwa, "TRANSPORT", self.fake)
        now = now_iso()
        with self.db.connection() as conn:
            for r in self.fake.mirror_rows():
                conn.execute("INSERT INTO ha_entities(entity_id, unique_id, platform, config_entry_id, domain, device_class, state, available, disabled, name, first_seen_at, updated_at) "
                             "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)",
                             (r.entity_id, r.unique_id, r.platform, r.config_entry_id, r.domain, r.device_class, r.state, int(r.available), int(r.disabled), now, now))

    def map_account(self, use: str = lr.USE_KEY) -> None:
        with self.db.connection() as conn:
            mr.store_doc(conn, ma.MappingDoc(1, (ma.Account(KEY, "discovered", label="משרד"),), {use: KEY}))

    def number(self, user_id: str, phone: str = PHONE, *, confirmed: bool = True, lang: str = "he") -> None:
        now = now_iso()
        with self.db.connection() as conn:
            conn.execute("DELETE FROM ticket_contacts WHERE user_id = ?", (user_id,))
            conn.execute("INSERT INTO ticket_contacts(id, kind, user_id, display_name, phone_e164, preferred_channel, lang, created_by, created_at, updated_at, phone_confirmed_at) "
                         "VALUES (?, 'person', ?, 'x', ?, 'whatsapp', ?, 'test', ?, ?, ?)", (f"c-{user_id}"[:40], user_id, phone, lang, now, now, now if confirmed else None))

    @property
    def sender(self) -> lr.Sender:
        return lr.sender_for(self.app.state.db)

    def flush(self) -> None:
        """Every queued message leaves now (the account's pacing gap is aged away; a job the sender re-scheduled while we aged the
        ledger is made due again)."""
        for _ in range(20):
            assert self.sender.drain(10)
            with self.db.connection() as conn:
                conn.execute("UPDATE messaging_send_ledger SET at = '2000-01-01T00:00:00.000Z'")
            if not self.sender.pending():
                return
            self.sender.make_due()
        raise AssertionError("the reset sender did not settle")

    _ip = 0

    def request(self, username: str, client=None):
        """One request from a fresh address (the per-address limit of the route is its own test)."""
        self._ip += 1
        r = (client or self.remote(**{"CF-Connecting-IP": f"198.51.100.{self._ip % 250 + 1}"})).post(REQ, json={"username": username})
        assert r.status_code == 202, r.text
        self.flush()
        return r

    def confirm(self, username: str, code: str, password: str = NEW_PW, client=None):
        return (client or self.remote()).post(CONF, json={"username": username, "code": code, "password": password})

    def last_code(self) -> str:
        m = re.search(r"\b(\d{6})\b", self.fake.sent_texts()[-1])
        assert m, self.fake.sent_texts()[-1]
        return m.group(1)

    def eligible(self, username: str = "maria", role: str = "viewer") -> str:
        created = self.create(username, role, reset_mode="self_service")
        assert self.set_password(self.link_token(created)).status_code == 200
        uid = created["user"]["id"]
        self.number(uid)
        return uid

    def notifications(self, source: str) -> list[dict]:
        return self.rows("SELECT * FROM notifications WHERE source = ?", (source,))


@pytest.fixture()
def rx(settings, tmp_path, monkeypatch):
    a = Rx(settings, tmp_path, monkeypatch)
    lr.reset_for_tests()
    yield a
    hua.reset_for_tests()
    lr.reset_for_tests()


# ---------------------------------------------------------------- 1. off, channel, guards

def test_off_by_default_the_reset_routes_refuse_and_are_remote_only(rx):
    c = rx.remote()
    assert c.post(REQ, json={"username": "maria"}).json()["code"] == "local_identity_off"
    assert c.post(CONF, json={"username": "maria", "code": "123456", "password": NEW_PW}).json()["code"] == "local_identity_off"
    rx.enable()
    assert rx.admin.post("/api/v1/auth/local/reset/request", json={"username": "maria"}, headers=ORIGIN).status_code == 404
    assert rx.admin.post("/api/v1/auth/local/reset/confirm", json={"username": "m", "code": "1", "password": "x"}, headers=ORIGIN).status_code == 404
    # login CSRF: no same-origin proof -> refused
    from fastapi.testclient import TestClient

    assert TestClient(rx.app).post(REQ, json={"username": "maria"}).json()["code"] == "csrf_refused"
    assert rx.fake.calls == []


# ---------------------------------------------------------------- 2. enumeration uniformity

def test_the_request_answers_byte_for_byte_alike_in_every_case_and_only_the_eligible_get_a_code(rx):
    rx.enable()
    rx.map_account()
    eligible = rx.eligible("maria")
    manager_only = rx.create("dalia")  # default manager_only, with a verified number
    assert rx.set_password(rx.link_token(manager_only)).status_code == 200
    rx.number(manager_only["user"]["id"])
    no_number = rx.create("noam", reset_mode="self_service")
    assert rx.set_password(rx.link_token(no_number)).status_code == 200
    unverified = rx.create("uri", reset_mode="self_service")
    assert rx.set_password(rx.link_token(unverified)).status_code == 200
    rx.number(unverified["user"]["id"], confirmed=False)
    pending = rx.create("pnina", reset_mode="self_service")  # never chose a password: a first login is a manager's link
    rx.number(pending["user"]["id"])
    admin = rx.create("sitey", "site_admin")  # an administrative target; self_service forced into the row behind the routes' back
    rx.number(admin["user"]["id"])
    assert rx.set_password(rx.link_token(admin)).status_code == 200
    with rx.db.connection() as conn:
        conn.execute("UPDATE auth_local_credentials SET reset_mode = 'self_service' WHERE user_id = ?", (admin["user"]["id"],))
    bodies = []
    for name in ("ghost", "dalia", "noam", "uri", "pnina", "sitey", "maria"):
        r = rx.request(name, rx.remote(**{"CF-Connecting-IP": f"203.0.113.{len(bodies) + 1}"}))
        assert r.status_code == 202, name
        bodies.append(_body(r))
    assert all(b == bodies[0] for b in bodies)
    assert len(rx.fake.calls) == 1 and rx.fake.calls[0]["data"]["target"] == DIGITS  # only maria's verified number
    reasons = {a["resource_id"]: a["reason"] for a in rx.audit("auth.local.reset.requested")}
    assert reasons[manager_only["user"]["id"]] == "manager_only" and reasons[no_number["user"]["id"]] == "no_verified_number"
    assert reasons[unverified["user"]["id"]] == "no_verified_number" and reasons[pending["user"]["id"]] == "no_password"
    assert reasons[admin["user"]["id"]] == "admin_target" and reasons[eligible] is None and reasons["unknown"] == "unknown_user"


def test_the_request_and_the_confirm_are_limited_per_address(rx):
    rx.enable()
    c = rx.remote(**{"CF-Connecting-IP": "203.0.113.77"})
    for _ in range(lr.REQUEST_LIMITS[0][1]):
        assert c.post(REQ, json={"username": "ghost"}).status_code == 202
    r = c.post(REQ, json={"username": "ghost"})
    assert r.status_code == 429 and r.json()["code"] == "rate_limited"
    for _ in range(lr.CONFIRM_LIMITS[0][1]):
        assert c.post(CONF, json={"username": "ghost", "code": "123456", "password": NEW_PW}).status_code == 422
    assert c.post(CONF, json={"username": "ghost", "code": "123456", "password": NEW_PW}).status_code == 429
    assert len(rx.audit("auth.local.reset.requested")) == 1  # unknown names: one throttled row per address a minute


def test_no_channel_means_no_code_and_the_same_answer(rx):
    rx.enable()
    rx.eligible("maria")  # no account mapped
    r = rx.request("maria")
    assert r.status_code == 202 and rx.fake.calls == []
    assert rx.audit("auth.local.reset.requested")[-1]["reason"] == "channel_unavailable"


# ---------------------------------------------------------------- 3. the administrative rule at the moment of use (F6)

def test_an_administrator_now_is_refused_at_confirm_even_with_reset_mode_set_earlier(rx):
    """The user was a plain role with self_service and received a code; then their custom role gained rbac.assign (the roles editor
    never touches reset_mode). The confirm refuses the correct code - uniform 422 - and a new request sends nothing."""
    rx.enable()
    rx.map_account()
    r = rx.admin.post("/api/v1/access/roles", json={"name": "עוזר", "permissions": ["map.read"], "sensitive": []})
    assert r.status_code == 201, r.text
    role = r.json()
    uid = rx.eligible("maria", role["id"])
    assert rx.request("maria").status_code == 202
    code = rx.last_code()
    r = rx.admin.patch(f"/api/v1/access/roles/{role['id']}", json={"name": "עוזר", "permissions": ["map.read", "rbac.assign"], "sensitive": [],
                                                                    "revision": role["revision"]})
    assert r.status_code == 200, r.text
    assert rx.rows("SELECT reset_mode FROM auth_local_credentials WHERE user_id = ?", (uid,)) == [{"reset_mode": "self_service"}]  # stale on purpose
    r = rx.confirm("maria", code)
    assert r.status_code == 422 and r.json()["code"] == "code_invalid"
    assert rx.audit("auth.local.reset.refused")[-1]["reason"] == "admin_target"
    assert rx.sign_in(rx.remote(), "maria", GOOD).status_code == 200  # the password did not change
    sent = len(rx.fake.calls)
    rx.request("maria")
    assert len(rx.fake.calls) == sent and rx.audit("auth.local.reset.requested")[-1]["reason"] == "admin_target"


# ---------------------------------------------------------------- 4. code rules

def test_the_happy_path_ends_sessions_and_links_and_creates_no_session(rx):
    rx.enable()
    rx.map_account()
    uid = rx.eligible("maria")
    signed = rx.remote()
    assert rx.sign_in(signed, "maria").status_code == 200
    rx.request("maria")
    text = rx.fake.sent_texts()[-1]
    assert "maria" not in text.lower() and "Maria" not in text  # no username / name in the message
    r = rx.confirm("maria", rx.last_code())
    assert r.status_code == 200 and r.json() == {"must_enrol": False}
    assert "set-cookie" not in {k.lower() for k in r.headers}  # no session is created
    assert signed.get("/arx/api/v1/me").status_code == 401  # every session ended
    assert rx.sign_in(rx.remote(), "maria", GOOD).status_code == 401
    assert rx.sign_in(rx.remote(), "maria", NEW_PW).status_code == 200
    assert rx.audit("auth.local.reset.completed") and rx.rows("SELECT set_by FROM auth_local_credentials WHERE user_id = ?", (uid,)) == [{"set_by": "self_service"}]


def test_a_code_is_single_use_and_cannot_be_replayed(rx):
    rx.enable()
    rx.map_account()
    rx.eligible("maria")
    rx.request("maria")
    code = rx.last_code()
    assert rx.confirm("maria", code).status_code == 200
    r = rx.confirm("maria", code, GOOD2)
    assert r.status_code == 422 and r.json()["code"] == "code_invalid"
    assert rx.sign_in(rx.remote(), "maria", NEW_PW).status_code == 200


def test_five_wrong_codes_end_the_code_and_every_refusal_is_alike(rx):
    rx.enable()
    rx.map_account()
    rx.eligible("maria")
    rx.request("maria")
    code = rx.last_code()
    wrong = f"{(int(code) + 1) % 10 ** 6:06d}"
    bodies = [_body(rx.confirm("maria", wrong)) for _ in range(lr.CODE_ATTEMPTS)]
    assert all(b == bodies[0] and b["code"] == "code_invalid" for b in bodies)
    r = rx.confirm("maria", code)  # the right code after five wrong ones: dead
    assert r.status_code == 422 and _body(r) == bodies[0]
    assert _body(rx.confirm("ghost", code)) == bodies[0]  # an unknown name answers the same
    assert _body(rx.confirm("maria", "12ab")) == bodies[0]  # and a malformed code
    assert rx.sign_in(rx.remote(), "maria", GOOD).status_code == 200


def test_cooldown_and_daily_caps(rx, monkeypatch):
    rx.enable()
    rx.map_account()
    rx.eligible("maria")
    rx.request("maria")
    rx.request("maria")  # within the 60 s cooldown: the same answer, no second message
    assert len(rx.fake.calls) == 1 and rx.audit("auth.local.reset.requested")[-1]["reason"] == "cooldown"
    monkeypatch.setattr(lr, "COOLDOWN_S", 0.0)
    for _ in range(lr.PER_USER_DAY - 1):
        rx.request("maria")
    assert len(rx.fake.calls) == lr.PER_USER_DAY
    rx.request("maria")
    assert len(rx.fake.calls) == lr.PER_USER_DAY and rx.audit("auth.local.reset.requested")[-1]["reason"] == "cap_user"
    # the per-number cap across users sharing one number, and the installation cap
    lr.reset_for_tests()
    other = rx.eligible("noam")
    rx.number(other)  # the same number as maria
    for i in range(lr.PER_NUMBER_DAY):
        rx.request("maria" if i % 2 == 0 else "noam")
    rx.request("noam")
    assert rx.audit("auth.local.reset.requested")[-1]["reason"] == "cap_number"
    lr.reset_for_tests()
    monkeypatch.setattr(lr, "PER_INSTALLATION_DAY", 1)
    rx.request("maria")
    rx.request("noam")
    assert rx.audit("auth.local.reset.requested")[-1]["reason"] == "cap_installation"


def test_a_new_code_replaces_the_old_one(rx, monkeypatch):
    rx.enable()
    rx.map_account()
    rx.eligible("maria")
    monkeypatch.setattr(lr, "COOLDOWN_S", 0.0)
    rx.request("maria")
    first = rx.last_code()
    rx.request("maria")
    second = rx.last_code()
    if first != second:
        assert rx.confirm("maria", first).status_code == 422
    assert rx.confirm("maria", second).status_code == 200


def test_the_code_is_bound_to_the_credential_row_and_to_the_number(rx):
    rx.enable()
    rx.map_account()
    uid = rx.eligible("maria")
    rx.request("maria")
    code = rx.last_code()
    # a manager's reset link used in between: the password row changed - the code no longer fits it
    link = rx.admin.post(f"/api/v1/identity/local-users/{uid}/link", json={"purpose": "reset"}).json()["link"]
    assert rx.set_password(link["path"].split("t=", 1)[1], GOOD2).status_code == 200
    assert rx.confirm("maria", code).status_code == 422
    # the number changed after the code was sent: the code dies with it
    lr.reset_for_tests()
    rx.request("maria")
    code = rx.last_code()
    rx.number(uid, "+972 50-555-0277")
    assert rx.confirm("maria", code).status_code == 422
    assert rx.sign_in(rx.remote(), "maria", GOOD2).status_code == 200


def test_a_policy_refusal_keeps_the_code_and_never_echoes_the_password(rx):
    rx.enable()
    rx.map_account()
    rx.eligible("maria")
    rx.request("maria")
    code = rx.last_code()
    r = rx.confirm("maria", code, "zq7x")
    assert r.status_code == 400 and r.json()["code"] == "password_policy" and "zq7x" not in r.text
    assert rx.confirm("maria", code).status_code == 200


def test_switching_back_to_manager_only_or_disabling_kills_a_live_code(rx):
    rx.enable()
    rx.map_account()
    uid = rx.eligible("maria")
    rx.request("maria")
    code = rx.last_code()
    assert rx.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"reset_mode": "manager_only"}).status_code == 200
    assert rx.confirm("maria", code).status_code == 422
    assert not lr.live_code(uid)


def test_no_code_number_or_username_in_logs_audit_ledger_or_answers(rx, caplog):
    caplog.set_level(logging.DEBUG)
    rx.enable()
    rx.map_account()
    rx.eligible("maria")
    r1 = rx.request("maria")
    code = rx.last_code()
    r2 = rx.confirm("maria", code)
    assert r2.status_code == 200
    rx.request("ghost-person")
    audit = rx.rows("SELECT * FROM audit_log WHERE action LIKE 'auth.local.%'")
    ledger = rx.rows("SELECT * FROM messaging_send_ledger")
    assert ledger and all(row["use_key"] == lr.USE_KEY and row["kind"] == "code" for row in ledger)
    blob = json.dumps(audit, ensure_ascii=False) + json.dumps(ledger) + caplog.text + r1.text + r2.text
    for secret in (code, DIGITS, DIGITS[-7:], NEW_PW, "ghost-person"):
        assert secret not in blob, secret
    deliveries = rx.audit("auth.local.delivery")
    assert deliveries and json.loads(deliveries[-1]["details_json"])["outcome"] == "sent"


def test_a_dead_code_is_never_sent(rx):
    """A code that ended before its message left (used / replaced / killed) is skipped by the sender."""
    rx.enable()
    rx.map_account()
    uid = rx.eligible("maria")
    rx.sender.run(lr.Job(kind="code", user_id=uid, digits=DIGITS, text="SmplWise Arx: 000000"))  # no live code for the user
    assert rx.fake.calls == [] and rx.audit("auth.local.delivery")[-1]["reason"] == "code_ended"


# ---------------------------------------------------------------- 5. manager links by WhatsApp

def test_links_for_administrative_targets_never_travel_by_whatsapp(rx):
    rx.enable()
    rx.map_account()
    admin = rx.create("sitey", "site_admin")
    aid = admin["user"]["id"]
    rx.number(aid)
    with rx.db.connection() as conn:
        set_setting(conn, "security.local_public_url", "https://arx.example.com")
    r = rx.admin.post(f"/api/v1/identity/local-users/{aid}/link", json={"purpose": "first_login", "via": "whatsapp"})
    assert r.status_code == 422 and r.json()["code"] == "whatsapp_not_for_admins"
    rx.flush()
    assert rx.fake.calls == []
    assert rx.audit("auth.local.link.issued")[-1]["decision"] == "denied"
    assert rx.rows("SELECT * FROM auth_local_links WHERE issued_via = 'whatsapp'") == []


def test_a_plain_users_link_goes_to_the_verified_number_and_is_never_returned(rx):
    rx.enable()
    rx.map_account()
    created = rx.create("maria")
    uid = created["user"]["id"]
    # no verified number -> refused; unverified number -> refused
    r = rx.admin.post(f"/api/v1/identity/local-users/{uid}/link", json={"purpose": "first_login", "via": "whatsapp"})
    assert r.status_code == 409 and r.json()["code"] == "no_verified_number"
    rx.number(uid, confirmed=False)
    assert rx.admin.post(f"/api/v1/identity/local-users/{uid}/link", json={"purpose": "first_login", "via": "whatsapp"}).json()["code"] == "no_verified_number"
    rx.number(uid, lang="en")
    # on the local channel the public host is unknown until a system administrator sets it
    r = rx.admin.post(f"/api/v1/identity/local-users/{uid}/link", json={"purpose": "first_login", "via": "whatsapp"})
    assert r.status_code == 409 and r.json()["code"] == "public_url_unknown"
    assert rx.admin.patch("/api/v1/settings", json={"security.local_public_url": "https://10.0.0.5"}).status_code == 422
    assert rx.admin.patch("/api/v1/settings", json={"security.local_public_url": "https://arx.example.com/evil"}).status_code == 422
    assert rx.admin.patch("/api/v1/settings", json={"security.local_public_url": "https://arx.example.com"}).status_code == 200
    r = rx.admin.post(f"/api/v1/identity/local-users/{uid}/link", json={"purpose": "first_login", "via": "whatsapp"})
    assert r.status_code == 200, r.text
    link = r.json()["link"]
    assert link["via"] == "whatsapp" and "path" not in link and "url" not in link and "t=" not in r.text
    rx.flush()
    text = rx.fake.sent_texts()[-1]
    assert rx.fake.calls[-1]["data"]["target"] == DIGITS and text.startswith("SmplWise Arx: your administrator opened an account")
    token = re.search(r"https://arx\.example\.com/arx/#/welcome\?t=([A-Za-z0-9_-]{43})", text).group(1)
    assert "maria" not in text.lower()
    assert rx.set_password(token).status_code == 200
    row = rx.rows("SELECT issued_via FROM auth_local_links WHERE user_id = ? AND used_at IS NOT NULL", (uid,))
    assert row == [{"issued_via": "whatsapp"}]
    blob = json.dumps(rx.rows("SELECT * FROM audit_log WHERE action LIKE 'auth.local.%'"), ensure_ascii=False)
    assert token not in blob and DIGITS not in blob


def test_only_a_system_administrator_sets_the_public_link_address(rx):
    """Whoever sets the address decides where reset tokens go: a site administrator cannot; a system administrator can (audited)."""
    from smplwise.db import new_id, permission_revision

    rx.admin.get("/api/v1/me", headers={"X-SW-Dev-User": "sami"})
    with rx.db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', 'dev-sami', 'site_admin', 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), permission_revision(conn), now_iso()))
    r = rx.admin.patch("/api/v1/settings", json={"security.local_public_url": "https://evil.example.net"}, headers={"X-SW-Dev-User": "sami"})
    assert r.status_code == 403, r.text
    assert rx.admin.get("/api/v1/settings").json()["settings"]["security.local_public_url"] == ""
    assert rx.admin.patch("/api/v1/settings", json={"security.local_public_url": "https://arx.example.com/"}).status_code == 200
    assert rx.admin.get("/api/v1/settings").json()["settings"]["security.local_public_url"] == "https://arx.example.com"
    assert rx.audit("identity.local.public_url")[-1]["decision"] == "allowed"
    # a restore never re-aims the links (the key is kept, never written from an archive)
    from smplwise.services import backup

    assert "security.local_public_url" in backup.SETTINGS_KEEP


def test_the_list_shows_the_number_state_and_why_self_service_is_blocked(rx):
    rx.enable()
    rx.map_account()
    uid = rx.eligible("maria")
    plain = rx.create("noam", reset_mode="self_service")
    d = rx.admin.get("/api/v1/identity/local-users").json()
    assert d["whatsapp_ready"] is True and d["public_url"] is None
    users = {u["id"]: u for u in d["users"]}
    assert users[uid]["whatsapp"] == {"verified": True, "masked": "····91"} and users[uid]["self_service_blocked"] is None
    assert users[plain["user"]["id"]]["self_service_blocked"] == "no_verified_number"
    assert DIGITS not in json.dumps(d)


# ---------------------------------------------------------------- 6. notifications to the managers (F7)

def _net(n: int) -> dict:
    return {"CF-Connecting-IP": f"203.0.113.{n}"}


def test_account_delayed_and_locked_reach_the_managers(rx, monkeypatch):
    rx.enable()
    monkeypatch.setattr(li, "ACCOUNT_CEILING", 12)
    monkeypatch.setattr(li, "account_delay", lambda n: 0.0)  # time "passes" between tries: every failure of the network is counted
    monkeypatch.setattr(li, "ACCOUNT_CEILING_WINDOW_S", 10 ** 9)
    created, _c = rx.ready("maria")
    uid = created["user"]["id"]
    for _ in range(10):  # the 10th failure from one network: account_delayed
        rx.sign_in(rx.remote(**_net(30)), "maria", "not the password")
    delayed = rx.notifications("security.local_account_delayed")
    assert len(delayed) == 1 and delayed[0]["subject_id"] == uid
    assert "maria" not in json.dumps(delayed, ensure_ascii=False).lower()
    for i in range(2):  # two more from other networks reach the ceiling of 12: account_locked
        rx.sign_in(rx.remote(**_net(40 + i)), "maria", "not the password")
    locked = rx.notifications("security.local_account_locked")
    assert len(locked) == 1 and locked[0]["subject_id"] == uid
    recipients = rx.rows("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (locked[0]["id"],))
    assert {r["user_id"] for r in recipients} == {"dev-joni"}  # the manager; never the local user itself


def test_a_storm_needs_several_networks_and_notifies_the_managers(rx, monkeypatch):
    rx.enable()
    rx.ready("maria")
    for name in ("stale1", "stale2"):  # never signed in: dormant accounts
        assert rx.set_password(rx.link_token(rx.create(name))).status_code == 200
    monkeypatch.setattr(li, "GLOBAL_STORM_AT", 4)
    monkeypatch.setattr(li, "GLOBAL_STORM_NETWORKS", 3)
    for _ in range(4):  # failures from ONE network only: no storm (F7)
        rx.sign_in(rx.remote(**_net(20)), "nobody")
    assert not li.TIERS.storm()
    assert rx.sign_in(rx.remote(**_net(90)), "stale1").status_code == 200  # a dormant account still signs in
    assert rx.notifications("security.local_storm") == []
    for i in range(2):
        rx.sign_in(rx.remote(**_net(21 + i)), "nobody")
    assert li.TIERS.storm()
    assert rx.sign_in(rx.remote(**_net(91)), "stale2").status_code == 401  # the storm refuses a dormant account
    storms = rx.notifications("security.local_storm")
    assert len(storms) == 1 and rx.audit("auth.local.storm")


def test_text_table_is_complete_for_every_language():
    for lang in ("he", "en", "ar", "ru"):
        assert set(lr.TEXTS[lang]) == {"code", "reset", "first_login"}
        assert "{code}" in lr.TEXTS[lang]["code"] and "{url}" in lr.TEXTS[lang]["reset"] and "{url}" in lr.TEXTS[lang]["first_login"]
    assert lr.text_for("code", "xx", code="123456").startswith("SmplWise Arx: קוד")  # unknown language -> Hebrew


@pytest.mark.parametrize("raw,ok", [("https://arx.example.com", True), ("https://arx.example.com/", True), ("https://arx.example.com:443", True),
                                    ("http://arx.example.com", False), ("https://1.2.3.4", False), ("https://[::1]", False), ("https://a.example.com/x", False),
                                    ("https://u:p@arx.example.com", False), ("https://arx.example.com?x=1", False), ("https://localhost", False),
                                    ("https://arx.example.com:8443", False), ("javascript:alert(1)", False)])
def test_public_url_normalisation(raw, ok):
    assert (lr.normalize_public_url(raw) is not None) is ok
