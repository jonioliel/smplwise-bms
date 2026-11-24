"""MFA-TOKENS-2490 (slice 6 of the MFA train): the kind of a bearer token, step-up narrowed to long-lived tokens, the user's own token
list, revoke of the tokens Arx issued, the audit rows - and that Arx never creates, changes or revokes a Home Assistant token or user.

Owner decision Q48 (2026-11-22): a long-lived token from outside stays allowed while step-up is on. Slice 1 exempted EVERY bearer
caller; this slice exempts only long-lived tokens (services/access_tokens.kind_of: the lifetime HA gave the token it accepted)."""
from __future__ import annotations

import json
import time

import pytest
from fastapi.testclient import TestClient

from fake_ha_core import LONG_LIVED_LIFETIME_S, make_jwt
from smplwise.services import access_tokens, step_up
from smplwise.services import ha_user_auth as hua
from test_mfa_stepup_2490 import SETTINGS, STATUS, VERIFY, Clock, clock, owner_enrolled_and_stale  # noqa: F401 - `clock` is a fixture
from test_second_factor import HEADER, arx, bump_step, code_now  # noqa: F401 - `arx` is the fixture
from test_remote_access import ORIGIN

TOKENS = "/arx/api/v1/auth/tokens"


def bearer(token: str, code: str | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", **({HEADER: code} if code else {})}


def long_lived(arx, user, name: str = "Laptop script") -> dict:
    return arx.core.issue(user.id, client_id=None, token_type="long_lived_access_token", client_name=name)


def details(row: dict) -> dict:
    return json.loads(row["details_json"] or "{}")


class Sent:
    """Every WebSocket command the add-on sends to the fake HA core (to prove what Arx asks HA for)."""

    def __init__(self, arx, monkeypatch):
        self.types: list[str] = []
        real = arx.core.dial

        async def dial(url, headers):
            sock = await real(url, headers)
            send = sock.send

            async def spy(raw):
                self.types.append(json.loads(raw).get("type"))
                await send(raw)

            sock.send = spy
            return sock

        monkeypatch.setattr(hua, "_dial", dial)


# ---------------------------------------------------------------- the kind of a token

def test_the_kind_comes_from_the_lifetime_ha_gave_the_token():
    now = time.time()
    assert access_tokens.kind_of(make_jwt(now + 1800)) == "short_lived"  # a normal sign-in's access token
    assert access_tokens.kind_of(make_jwt(now + LONG_LIVED_LIFETIME_S)) == "long_lived"
    assert access_tokens.kind_of(make_jwt(now + 86400)) == "long_lived"  # the shortest long-lived token HA makes: one day
    assert access_tokens.kind_of(make_jwt(now + 3600)) == "short_lived"
    assert access_tokens.kind_of("not.a.jwt") == "unknown" and access_tokens.kind_of("") == "unknown"
    import base64

    def raw(payload: dict) -> str:
        enc = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
        return f"eyJhbGciOiJIUzI1NiJ9.{enc}.c2ln"

    assert access_tokens.kind_of(raw({"iss": "x", "exp": int(now) + 10**8})) == "unknown"  # no iat: fail closed (gated)
    assert access_tokens.kind_of(raw({"iss": "x", "iat": int(now), "exp": int(now) - 5})) == "unknown"
    assert access_tokens.kind_of(raw({"iss": "x", "iat": True, "exp": int(now) + 10**8})) == "unknown"
    assert access_tokens.exempt("long_lived") and not any(access_tokens.exempt(k) for k in ("short_lived", "unknown", "", "app"))


def test_a_bearer_session_carries_its_kind_and_a_cookie_session_none(arx):
    llat = long_lived(arx, arx.viewer)["access_token"]
    assert TestClient(arx.app).get("/arx/api/v1/me", headers=bearer(llat)).status_code == 200
    short = arx.token(arx.viewer)
    assert TestClient(arx.app).get("/arx/api/v1/me", headers=bearer(short)).status_code == 200
    browser = TestClient(arx.app, headers=ORIGIN)
    assert browser.post("/arx/api/v1/auth/session", headers=bearer(arx.token(arx.viewer))).status_code == 200
    kinds = sorted((s.via, s.token_kind) for s in hua.STORE.sessions_of(user_id="u-viewer"))
    assert kinds == [("bearer", "long_lived"), ("bearer", "short_lived"), ("cookie", "")]
    created = [details(r) for r in arx.audit("auth.remote_session.created")]
    assert sorted(d.get("token_kind", "") for d in created if d.get("via") == "bearer") == ["long_lived", "short_lived"]


# ---------------------------------------------------------------- step-up: long-lived exempt, short-lived gated

def test_a_long_lived_token_from_outside_stays_exempt(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    bump_step(arx, "u-owner")
    llat = long_lived(arx, arx.owner)["access_token"]
    app = TestClient(arx.app)
    assert app.patch(SETTINGS, json={"home.title": "ll"}, headers=bearer(llat, code_now(arx, "u-owner"))).status_code == 200
    clock.advance(30)
    assert app.patch(SETTINGS, json={"home.title": "ll2"}, headers=bearer(llat)).status_code == 200
    st = app.get(STATUS, headers=bearer(llat)).json()
    assert st["applies"] is False and st["reason"] == "bearer_token"
    assert arx.audit("auth.step_up.required") == []


def test_a_short_lived_bearer_token_is_gated_like_a_session(arx, clock):
    owner_enrolled_and_stale(arx, clock)
    bump_step(arx, "u-owner")
    issued = arx.core.issue("u-owner")
    token = issued["access_token"]
    app = TestClient(arx.app)
    # the new bearer sign-in shows the code: like the cookie exchange, it starts with a fresh proof
    assert app.patch(SETTINGS, json={"home.title": "s1"}, headers=bearer(token, code_now(arx, "u-owner"))).status_code == 200
    st = app.get(STATUS, headers=bearer(token)).json()
    assert st["applies"] is True and st["reason"] is None and st["valid_until"] is not None
    clock.advance(6)
    r = app.patch(SETTINGS, json={"home.title": "s2"}, headers=bearer(token))
    assert r.status_code == 403 and r.json()["code"] == "step_up_required", r.text
    row = arx.audit("auth.step_up.required")[-1]
    assert row["actor_user_id"] == "u-owner" and details(row)["via"] == "bearer"
    # the bearer client verifies like a browser; the proof belongs to its HA sign-in, so the NEXT access token of it counts too
    bump_step(arx, "u-owner")
    v = app.post(VERIFY, json={"method": "totp", "code": code_now(arx, "u-owner"), "action": "system.configure"}, headers=bearer(token))
    assert v.status_code == 200, v.text
    assert app.patch(SETTINGS, json={"home.title": "s3"}, headers=bearer(token)).status_code == 200
    _, fresh = arx.core.token({"grant_type": "refresh_token", "refresh_token": issued["refresh_token"], "client_id": "http://testserver/arx/"})
    assert app.patch(SETTINGS, json={"home.title": "s4"}, headers=bearer(fresh["access_token"])).status_code == 200
    clock.advance(6)
    assert app.patch(SETTINGS, json={"home.title": "s5"}, headers=bearer(fresh["access_token"])).status_code == 403


def test_a_bearer_token_of_unknown_kind_is_gated(arx, clock, monkeypatch):
    owner_enrolled_and_stale(arx, clock)
    bump_step(arx, "u-owner")
    monkeypatch.setattr(access_tokens, "kind_of", lambda _t: "unknown")
    llat = long_lived(arx, arx.owner)["access_token"]
    app = TestClient(arx.app)
    assert app.patch(SETTINGS, json={"home.title": "u1"}, headers=bearer(llat, code_now(arx, "u-owner"))).status_code == 200
    clock.advance(6)
    r = app.patch(SETTINGS, json={"home.title": "u2"}, headers=bearer(llat))
    assert r.status_code == 403 and r.json()["code"] == "step_up_required"


def test_the_off_switch_and_no_method_still_win_for_a_short_lived_bearer(arx, clock):
    app = TestClient(arx.app)
    token = arx.token(arx.owner)  # the owner has no factor enrolled: no method, today's behaviour
    assert app.patch(SETTINGS, json={"home.title": "n1"}, headers=bearer(token)).status_code == 200
    assert app.get(STATUS, headers=bearer(token)).json()["reason"] == "no_method"
    arx.setting("security.step_up", "off")
    assert app.get(STATUS, headers=bearer(token)).json()["reason"] == "off"


# ---------------------------------------------------------------- what Arx saw, and the audit of a first use

def test_the_first_use_from_outside_is_audited_once_per_token(arx):
    issued = long_lived(arx, arx.viewer)
    app = TestClient(arx.app, headers={"CF-Connecting-IP": "203.0.113.7", "CF-IPCountry": "IL", "User-Agent": "curl/8.5"})
    for _ in range(3):
        assert app.get("/arx/api/v1/me", headers=bearer(issued["access_token"])).status_code == 200
    rows = arx.audit("auth.token.first_use")
    assert len(rows) == 1
    d = details(rows[0])
    assert rows[0]["actor_user_id"] == "u-viewer" and rows[0]["decision"] == "allowed" and rows[0]["resource_id"].startswith("ha_")
    assert d["kind"] == "long_lived" and d["address"] == "203.0.113.0/24" and d["country"] == "IL" and d["via"] == "bearer"
    assert issued["access_token"] not in rows[0]["details_json"] and issued["refresh_token"][:12] not in rows[0]["details_json"]
    with arx.db.connection(mode="read") as conn:
        stored = [dict(r) for r in conn.execute("SELECT * FROM remote_token_uses").fetchall()]
    assert len(stored) == 1 and stored[0]["kind"] == "long_lived" and stored[0]["user_id"] == "u-viewer"
    assert stored[0]["token_key"] == hua.iss_hash(issued["access_token"]) and stored[0]["last_address"] == "203.0.113.0/24"
    # a different sign-in is a different token: one more first use; the next access token of the SAME sign-in is not
    short = arx.core.issue("u-viewer")
    assert app.get("/arx/api/v1/me", headers=bearer(short["access_token"])).status_code == 200
    _, nxt = arx.core.token({"grant_type": "refresh_token", "refresh_token": short["refresh_token"], "client_id": "http://testserver/arx/"})
    assert app.get("/arx/api/v1/me", headers=bearer(nxt["access_token"])).status_code == 200
    assert [details(r)["kind"] for r in arx.audit("auth.token.first_use")] == ["long_lived", "short_lived"]
    with arx.db.connection(mode="read") as conn:
        uses = conn.execute("SELECT uses FROM remote_token_uses WHERE token_key = ?", (hua.iss_hash(short["access_token"]),)).fetchone()[0]
    assert uses == 2


def test_a_cookie_sign_in_is_not_a_token_use(arx):
    assert arx.login(arx.viewer).status_code == 200
    assert arx.audit("auth.token.first_use") == []


# ---------------------------------------------------------------- the list

def test_the_list_shows_has_tokens_read_only_and_what_arx_saw(arx, monkeypatch):
    issued = long_lived(arx, arx.viewer, "Node-RED")
    assert TestClient(arx.app).get("/arx/api/v1/me", headers=bearer(issued["access_token"])).status_code == 200
    arx.core.issue("u-viewer", client_id="https://home-assistant.io/android")  # the Companion app: an HA sign-in Arx never saw
    arx.core.issue("u-owner", client_id=None, token_type="long_lived_access_token", client_name="someone else's")
    assert arx.login(arx.viewer).status_code == 200
    sent = Sent(arx, monkeypatch)
    r = arx.client.get(TOKENS)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ha_listed"] is True and body["ha_reason"] is None
    rows = body["tokens"]
    assert [x["kind"] for x in rows][0] == "long_lived"  # long-lived tokens first
    ll = rows[0]
    assert ll["source"] == "ha" and ll["name"] == "Node-RED" and ll["client"] is None and ll["revocable"] is False
    assert ll["used_in_arx"] is True and ll["arx_last_seen_at"] and ll["created_at"] == "2026-09-29T00:00:00Z"
    sign_ins = [x for x in rows if x["kind"] == "short_lived"]
    assert {x["client"] for x in sign_ins} == {"testserver", "home-assistant.io"}
    assert [x["current"] for x in sign_ins if x["client"] == "testserver"] == [True]  # this browser's own HA sign-in
    assert all(not x["revocable"] and x["source"] == "ha" for x in rows)
    assert not any(x["name"] == "someone else's" for x in rows)  # HA lists only the caller's own tokens
    text = r.text
    assert issued["access_token"] not in text and issued["refresh_token"][:12] not in text and "203.0.113" not in text
    assert sent.types == ["auth", "auth/refresh_tokens"]  # one read-only listing; nothing else asked of HA


def test_when_ha_cannot_be_asked_the_list_shows_what_arx_saw(arx, monkeypatch):
    issued = long_lived(arx, arx.viewer)
    assert TestClient(arx.app).get("/arx/api/v1/me", headers=bearer(issued["access_token"])).status_code == 200
    assert arx.login(arx.viewer).status_code == 200

    async def down(*_a, **_k):
        raise OSError("ha away")

    monkeypatch.setattr(hua, "_dial", down)
    body = arx.client.get(TOKENS).json()
    assert body["ha_listed"] is False and body["ha_reason"] == "ha_unavailable"
    assert [(x["source"], x["kind"], x["used_in_arx"], x["revocable"]) for x in body["tokens"]] == [("arx", "long_lived", True, False)]


def test_the_local_channel_lists_without_asking_ha(arx, monkeypatch):
    sent = Sent(arx, monkeypatch)
    body = TestClient(arx.app).get("/api/v1/auth/tokens").json()
    assert body["ha_listed"] is False and body["ha_reason"] == "local_channel" and body["tokens"] == []
    assert sent.types == []


def test_the_list_needs_a_signed_in_caller(arx):
    r = TestClient(arx.app).get(TOKENS)
    assert r.status_code == 401


# ---------------------------------------------------------------- revoke: only what Arx issued; never an HA token or user

def _family(arx, user_id: str, device: str = "dev-1") -> str:
    from smplwise.services import app_refresh

    fid = app_refresh._new(app_refresh.FAMILY_PREFIX)
    now = time.time()
    with arx.db.connection() as conn:
        conn.execute("""INSERT INTO app_refresh_families(family_id, user_id, device_id, install_hash, platform, anchor_kind, anchor_hash, channel,
                        created_at, last_used_at, absolute_expires_at, idle_expires_at) VALUES (?, ?, ?, ?, 'android', 'ha', '', 'remote', ?, ?, ?, ?)""",
                     (fid, user_id, device, "a" * 64, app_refresh.iso(now - 60), app_refresh.iso(now - 30), app_refresh.iso(now + 86400 * 30),
                      app_refresh.iso(now + 86400 * 7)))
    return fid


def _revoked(arx, fid: str) -> bool:
    with arx.db.connection(mode="read") as conn:
        return conn.execute("SELECT revoked_at FROM app_refresh_families WHERE family_id = ?", (fid,)).fetchone()[0] is not None


def test_a_token_arx_issued_is_listed_and_revoked_by_its_owner(arx):
    mine = _family(arx, "u-viewer")
    theirs = _family(arx, "u-owner", "dev-2")
    assert arx.login(arx.viewer).status_code == 200
    rows = arx.client.get(TOKENS).json()["tokens"]
    apps = [x for x in rows if x["kind"] == "app"]
    assert [(x["id"], x["source"], x["revocable"], x["client"]) for x in apps] == [(mine, "arx", True, "android")]
    assert apps[0]["expires_at"] is not None
    # another user's family answers like an unknown one, and stays live
    r = arx.client.delete(f"{TOKENS}/{theirs}")
    assert r.status_code == 404 and r.json()["code"] == "token_not_found" and not _revoked(arx, theirs)
    r = arx.client.delete(f"{TOKENS}/{mine}")
    assert r.status_code == 200 and r.json() == {"revoked": 1} and _revoked(arx, mine)
    row = arx.audit("auth.token.revoked")[-1]
    assert row["actor_user_id"] == "u-viewer" and row["resource_id"] == mine and details(row)["kind"] == "app"
    assert arx.audit("auth.app_refresh.revoked")[-1]["reason"] == "revoked_by_user"
    assert arx.client.delete(f"{TOKENS}/{mine}").status_code == 404  # already revoked
    assert [x for x in arx.client.get(TOKENS).json()["tokens"] if x["kind"] == "app"] == []


def test_revoke_all_ends_only_the_callers_own_arx_tokens(arx):
    a, b = _family(arx, "u-viewer", "d1"), _family(arx, "u-viewer", "d2")
    other = _family(arx, "u-owner", "d3")
    assert arx.login(arx.viewer).status_code == 200
    r = arx.client.delete(TOKENS)
    assert r.status_code == 200 and r.json() == {"revoked": 2}
    assert _revoked(arx, a) and _revoked(arx, b) and not _revoked(arx, other)
    assert arx.audit("auth.token.revoked")[-1]["reason"] == "signed_out_everywhere"


def test_an_ha_token_is_never_revoked_or_changed_by_arx(arx, monkeypatch):
    issued = long_lived(arx, arx.viewer)
    assert TestClient(arx.app).get("/arx/api/v1/me", headers=bearer(issued["access_token"])).status_code == 200
    assert arx.login(arx.viewer).status_code == 200
    ll = next(x for x in arx.client.get(TOKENS).json()["tokens"] if x["kind"] == "long_lived")
    before = set(arx.core.refresh_tokens_of("u-viewer"))
    users_before = {u.id: (u.active, u.is_admin, u.is_owner) for u in arx.core.users.values()}
    sent = Sent(arx, monkeypatch)
    r = arx.client.delete(f"{TOKENS}/{ll['id']}")
    assert r.status_code == 409 and r.json()["code"] == "token_managed_in_ha" and "Home Assistant" in r.json()["user_message"]
    assert sent.types == []  # not even a dial: nothing is asked of, or sent to, Home Assistant
    assert set(arx.core.refresh_tokens_of("u-viewer")) == before and arx.core.deleted_refresh == []
    assert {u.id: (u.active, u.is_admin, u.is_owner) for u in arx.core.users.values()} == users_before
    row = arx.audit("auth.token.revoke_refused")[-1]
    assert row["decision"] == "denied" and row["reason"] == "token_managed_in_ha" and row["resource_id"] == ll["id"]
    # the long-lived token still works in Arx (Q48: allowed; revoking it is Home Assistant's job)
    assert TestClient(arx.app).get("/arx/api/v1/me", headers=bearer(issued["access_token"])).status_code == 200
    # revoke-all never reaches HA either
    assert arx.client.delete(TOKENS).json() == {"revoked": 0}
    assert sent.types == [] and set(arx.core.refresh_tokens_of("u-viewer")) == before


@pytest.mark.parametrize("bad", ["ha_123", "ha_" + "g" * 20, "x" * 70, "arf_", "../ha_" + "0" * 20])
def test_odd_ids_are_not_found(arx, bad):
    assert arx.login(arx.viewer).status_code == 200
    assert arx.client.delete(f"{TOKENS}/{bad}").status_code in (404, 405)


def test_the_token_code_only_reads_from_home_assistant():
    """A source ratchet: the token list's code sends HA nothing but `auth` and the read-only `auth/refresh_tokens`."""
    from pathlib import Path

    import smplwise.routers.access_tokens as router
    import smplwise.services.access_tokens as service

    for mod in (router, service):
        text = Path(mod.__file__).read_text(encoding="utf-8")
        for forbidden in ("auth/delete_refresh_token", "auth/long_lived_access_token", "config/auth", "auth/delete_all_refresh_tokens",
                          "delete_refresh_token_at_ha", "revoke_sessions", "/auth/token"):
            assert forbidden not in text, (mod.__name__, forbidden)


def test_the_step_up_exemption_reads_the_session_kind():
    class S:
        via = "bearer"
        token_kind = "short_lived"

    class R:
        scope = {"state": {"sw_remote_session": S()}}

    assert access_tokens.session_kind(R()) == "short_lived"
    S.token_kind = ""
    assert access_tokens.session_kind(R()) == "unknown"
    S.via = "cookie"
    assert access_tokens.session_kind(R()) == ""
    assert step_up.not_applicable  # the gate imports the helper lazily (no import cycle at start-up)
