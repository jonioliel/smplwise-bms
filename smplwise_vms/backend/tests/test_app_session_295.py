"""SESSIONEXCH2-295 (docs/changes/APPREFRESH-SESSION-EXCHANGE-SPEC.md revision 3; owner decisions 427-432 of 2026-10-24): the phone app's
WebView session through a ONE-TIME CODE. The app's native client exchanges a live access token of a keyed family + a device-key proof
(purpose `session`) for a single-use 60-second code; the WebView redeems it with a top-level GET and the SERVER sets the Arx session
cookie. Covers: off by default (both switches, the local channel - the uniform 404 before the body), the settings and their channel rule,
the success path and the cookie attributes, hash-only storage, single use / replay / expiry of the code, the origin and device-key
bindings, the cross-site refusal, every proof refusal (missing / invalid / another key / a refresh signature / a stale nonce / the clock),
no keyless exchange, F-09 (S-02), the cookie on the exchange route (S-06), no mint from a web session (S-01), the per-request re-checks
(S-03: anchor, family expiry, user, permissions, the administrators' MFA rule), every revocation path, the sessions-list row that ends the
family (S-04), the web sign-out (decision 394), the 1 h idle / 7 day renewal and the administrator caps (decisions 431 / 392), the
start-up end (decision 398), the rate limit, and that no code, cookie, token, nonce or signature reaches a table, an audit row or a log.
Fakes only: no Home Assistant, no phone."""
from __future__ import annotations

import hashlib
import json
import logging

import pytest
from fastapi.testclient import TestClient
from test_app_refresh_295 import (  # noqa: F401 - rx is the shared fixture
    API,
    ARX,
    INSTALL,
    audit_rows,
    family_row,
    register,
    rx,
    switch,
    whoami,
)
from test_app_refresh_devicekey_295 import Key, keyed, mint, nonce_of, now, prefresh, proof
from test_remote_access import ORIGIN

from smplwise.services import app_refresh as svc
from smplwise.services import app_refresh_key as dk
from smplwise.services import app_session as xs
from smplwise.services import backup
from smplwise.services import ha_user_auth as hua

XKEY = xs.FEATURE_KEY
REDEEM = f"{ARX}/auth/app/session/redeem"
COOKIE = "arx_session"  # the test backend runs outside the add-on over plain http (ha_user_auth.cookie_name)


# ---------------------------------------------------------------- helpers

def xon(rx, **more) -> None:
    switch(rx, **{XKEY: "on", **more})


def started(rx, user: str = "dana") -> tuple[dict, dict, Key]:
    dev, out, key = keyed(rx, user)
    xon(rx)
    return dev, out, key


def sproof(rx, key: Key, device_id: str, access: str, nonce: str | None = None, ts: int | None = None) -> dict:
    nonce = nonce or nonce_of(rx, device_id)
    ts = now(rx) if ts is None else ts
    return {"nonce": nonce, "ts": ts, "sig": key.sign(dk.session_message(device_id, nonce, ts, access))}


def exchange(rx, access: str, device_id: str, pr: dict | None, install_id: str = INSTALL, client: TestClient | None = None,
             headers: dict | None = None, prefix: str = ARX):
    body: dict = {"device_id": device_id, "install_id": install_id}
    if pr is not None:
        body["proof"] = pr
    r = (client or rx.c).post(f"{prefix}/auth/app/session", json=body, headers={"Authorization": f"Bearer {access}", **(headers or {})})
    if r.status_code == 200:
        rx.seen.append(r.json()["code"])
    return r


def webview(rx) -> TestClient:
    """The app's web view: its own cookie store, a top-level navigation sends no Origin."""
    return TestClient(rx.app)


MARK = {"X-Correlation-Id": "0123456789abcdef"}  # X4 F-1 fix 2: the app's own redeem navigation carries it (loadUrl headers / URLRequest)


def redeem(rx, code: str, wv: TestClient | None = None, headers: dict | None = None):
    wv = wv or webview(rx)
    r = wv.get(REDEEM, params={"code": code}, headers={**MARK, **(headers or {})}, follow_redirects=False)
    if r.status_code == 303 and r.headers.get("set-cookie"):
        rx.seen.append(r.headers["set-cookie"].split(";")[0].split("=", 1)[1])
    return r


def signed_in(rx, user: str = "dana") -> tuple[dict, dict, Key, TestClient]:
    """A keyed phone with the exchange on, its WebView signed in through a redeemed code."""
    dev, out, key = started(rx, user)
    r = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"]))
    assert r.status_code == 200, r.text
    wv = webview(rx)
    rr = redeem(rx, r.json()["code"], wv)
    assert rr.status_code == 303 and rr.headers["location"] == "/arx/", rr.headers
    return dev, out, key, wv


def me(wv: TestClient):
    return wv.get(f"{ARX}/me")


def later(rx, seconds: float) -> None:
    rx.clock.advance(seconds)  # one clock for app_refresh and app_session (also ages the 15 s cache)


def web_rows(rx) -> list:
    with rx.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM app_web_sessions ORDER BY created_at").fetchall()]


def assert_nothing_leaked(rx, text: str = "") -> None:
    """No code, cookie value, access / refresh token, nonce or signature in any table (every column), in the audit log or in `text`."""
    with rx.db.connection(mode="read") as conn:
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()]
        blob = [json.dumps([str(v) for v in tuple(row)], ensure_ascii=False) for t in tables for row in conn.execute(f'SELECT * FROM "{t}"').fetchall()]
    hay = "\n".join(blob) + "\n" + text
    material = list(rx.seen) + list(getattr(rx, "nonces", []))
    assert material
    for m in material:
        assert m not in hay, m[:8]
    assert "arxc_" not in hay and "arxa_" not in hay and "arxr_" not in hay


# ---------------------------------------------------------------- off by default: absent

def test_off_by_default_both_routes_answer_the_uniform_404_before_the_body(rx):
    dev, out, key = keyed(rx)  # the saved sign-in on, the exchange off (its default)
    assert rx.c.get(f"{API}/auth/app/settings").json()["settings"][XKEY] == "off"
    answers = set()
    for body in (json.dumps({"device_id": dev["device_id"], "install_id": INSTALL}).encode(), b"{not json", b"[]", b"{}"):
        r = rx.c.post(f"{ARX}/auth/app/session", content=body, headers={"content-type": "application/json", "Authorization": f"Bearer {out['access_token']}"})
        d = r.json()
        d.pop("correlation_id", None)
        answers.add((r.status_code, json.dumps(d, sort_keys=True)))
    assert len(answers) == 1 and next(iter(answers))[0] == 404
    assert redeem(rx, "arxc_" + "a" * 43).status_code == 404


def test_on_but_the_saved_sign_in_off_or_the_local_channel_is_still_absent(rx):
    dev, out, key = started(rx)
    r = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"]), prefix=API)
    assert r.status_code == 404  # the local channel never offers it
    assert rx.c.get(f"{API}/auth/app/session/redeem", params={"code": "arxc_" + "a" * 43}, follow_redirects=False).status_code == 404
    switch(rx, **{"security.app_refresh": "off"})
    assert exchange(rx, out["access_token"], dev["device_id"], None).status_code == 404
    assert redeem(rx, "arxc_" + "a" * 43).status_code == 404


# ---------------------------------------------------------------- settings

def test_settings_values_channel_rule_and_the_access_bound(rx):
    on_ = rx.c.put(f"{API}/auth/app/settings", json={XKEY: "on"})
    assert on_.status_code == 422  # needs the saved sign-in on
    for bad in ("allow_keyless", "keyed_only", True, 1):  # decision 430: no keyless mode, only off | on
        assert rx.c.put(f"{API}/auth/app/settings", json={"security.app_refresh": "on", XKEY: bad}).status_code == 422
    switch(rx, **{"security.app_refresh": "on", svc.ACCESS_KEY: 20})
    r = rx.c.put(f"{API}/auth/app/settings", json={XKEY: "on"})
    assert r.status_code == 422 and r.json()["details"]["field"] == svc.ACCESS_KEY  # S-02: <= 15 min while on
    switch(rx, **{svc.ACCESS_KEY: 15, XKEY: "on"})
    assert rx.c.put(f"{API}/auth/app/settings", json={svc.ACCESS_KEY: 16}).status_code == 422
    for key, bad in ((xs.IDLE_KEY, 61), (xs.IDLE_KEY, 4), (xs.MAX_KEY, 8), (xs.MAX_KEY, 0)):
        assert rx.c.put(f"{API}/auth/app/settings", json={key: bad}).status_code == 422, key
    st = rx.c.get(f"{API}/auth/app/settings").json()["settings"]
    assert st[XKEY] == "on" and st[xs.IDLE_KEY] == 60 and st[xs.MAX_KEY] == 7  # decision 431 defaults
    switch(rx, **{XKEY: "off"})
    # ON from the remote channel is refused (a system administrator's remote session), OFF works anywhere
    owner = rx.user("joni")
    r = owner.put(f"{ARX}/auth/app/settings", json={XKEY: "on"})
    assert r.status_code == 403 and r.json()["code"] == "local_channel_only"
    assert any(a["reason"] == "local_channel_only" for a in audit_rows(rx, "auth.app_session.feature_enabled"))


# ---------------------------------------------------------------- success, the cookie, storage

def test_exchange_then_redeem_signs_the_webview_in_with_a_server_set_cookie(rx):
    dev, out, key = started(rx)
    r = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"]))
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"code", "expires_in", "expires_at", "redeem_path"}
    assert body["code"].startswith("arxc_") and body["expires_in"] == 60 and body["redeem_path"] == "/arx/api/v1/auth/app/session/redeem"
    assert "set-cookie" not in r.headers  # the native client never receives a cookie
    wv = webview(rx)
    rr = redeem(rx, body["code"], wv)
    assert rr.status_code == 303 and rr.headers["location"] == "/arx/"
    assert rr.headers["cache-control"] == "no-store"  # (the remote channel sets its own Referrer-Policy: same-origin)
    cookie = rr.headers["set-cookie"]
    name, value = cookie.split(";")[0].split("=", 1)
    attrs = [a.strip().lower() for a in cookie.split(";")[1:]]
    assert name == COOKIE and value.startswith("a.") and len(value) == 45
    assert "httponly" in attrs and "samesite=strict" in attrs and "path=/arx/" in attrs
    max_age = int(next(a for a in attrs if a.startswith("max-age="))[8:])
    assert 0 < max_age <= 7 * 86400
    m = me(wv)
    assert m.status_code == 200 and m.json()["user"]["id"] == "u-viewer", m.text
    rows = web_rows(rx)
    assert len(rows) == 1 and rows[0]["sid_hash"] == xs.sid_hash_of(value) and rows[0]["family_id"] == out["family_id"]
    assert rows[0]["key_fp"] == key.fp
    created = audit_rows(rx, "auth.app_session.created")
    assert created and json.loads(created[-1]["details_json"])["via"] == "app"
    assert whoami(rx, out["access_token"]).status_code == 200  # S-07 option 1: the access token is NOT spent
    assert_nothing_leaked(rx)


def test_the_exchange_answers_no_code_without_a_live_access_token(rx):
    dev, out, key = started(rx)
    for tok in ("arxa_" + "b" * 43, "nonsense", out["refresh_token"]):
        r = exchange(rx, tok, dev["device_id"], sproof(rx, key, dev["device_id"], tok))
        assert r.status_code == 401 and r.json()["code"] == "app_access_invalid"
    later(rx, 11 * 60)  # past the 10-minute access token
    r = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"]))
    assert r.status_code == 401 and r.json()["code"] == "app_access_invalid"
    assert family_row(rx, out["family_id"])["revoked_at"] is None  # nothing ends for a bad token


# ---------------------------------------------------------------- the code: single use, expiry, origin, cross-site

def test_a_code_is_single_use_and_a_replay_is_refused_and_audited(rx):
    dev, out, key = started(rx)
    code = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    wv = webview(rx)
    assert redeem(rx, code, wv).headers["location"] == "/arx/"
    again = redeem(rx, code)
    assert again.status_code == 303 and again.headers["location"] == "/arx/?app_session=failed" and "set-cookie" not in again.headers
    assert audit_rows(rx, "auth.app_session.code_replayed")
    assert me(wv).status_code == 200  # the first redeem's session is unaffected


def test_an_expired_code_is_refused(rx):
    dev, out, key = started(rx)
    code = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    later(rx, 61)
    r = redeem(rx, code)
    assert r.headers["location"].endswith("?app_session=failed") and "set-cookie" not in r.headers
    assert web_rows(rx) == []


def test_a_new_code_withdraws_the_previous_unredeemed_one(rx):
    dev, out, key = started(rx)
    first = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    second = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    assert redeem(rx, first).headers["location"].endswith("?app_session=failed")
    assert redeem(rx, second).headers["location"] == "/arx/"


def test_the_code_is_bound_to_the_origin_it_was_issued_on(rx):
    dev, out, key = started(rx)
    code = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    r = redeem(rx, code, headers={"host": "evil.example"})
    assert r.headers["location"].endswith("?app_session=failed") and "set-cookie" not in r.headers
    assert any(a["reason"] == "origin_mismatch" for a in audit_rows(rx, "auth.app_session.redeem"))
    assert redeem(rx, code).headers["location"].endswith("?app_session=failed")  # spent by the refused presentation


def test_a_cross_site_navigation_cannot_redeem_a_code(rx):
    dev, out, key = started(rx)
    code = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    for site in ("cross-site", "same-site"):
        r = redeem(rx, code, headers={"sec-fetch-site": site})
        assert r.headers["location"].endswith("?app_session=failed") and "set-cookie" not in r.headers
    r = redeem(rx, code, headers={"sec-fetch-site": "none"})  # the app's own top-level navigation
    assert r.headers["location"] == "/arx/" and r.headers.get("set-cookie")


def test_sx27_a_cross_site_redeem_refusal_is_audited_without_the_code(rx):
    dev, out, key = started(rx)
    code = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    r = redeem(rx, code, headers={"sec-fetch-site": "cross-site", "X-Correlation-Id": "0123456789abcdef"})
    assert r.status_code == 303 and r.headers["location"] == "/arx/?app_session=failed" and "set-cookie" not in r.headers
    rows = [a for a in audit_rows(rx, "auth.app_session.redeem") if a["reason"] == "cross_site"]
    assert len(rows) == 1
    row = rows[0]
    assert row["decision"] == "denied" and row["resource_type"] == "mobile_device" and row["resource_id"] == dev["device_id"]
    assert row["request_id"] == "0123456789abcdef"  # linkable to the app's own diagnostic record (SX-25 / SX-17)
    det = json.loads(row["details_json"])
    assert {k: det[k] for k in ("family", "sec_fetch_site", "code_known")} == {"family": out["family_id"], "sec_fetch_site": "cross-site", "code_known": True}
    assert set(det) == {"family", "sec_fetch_site", "code_known", "ip"}
    # same-site, an unknown code, and a malformed correlation id (never reflected into the row)
    redeem(rx, code, headers={"sec-fetch-site": "same-site"})
    redeem(rx, "arxc_" + "q" * 43, headers={"sec-fetch-site": "cross-site", "X-Correlation-Id": "bad id; x"})
    rows = [a for a in audit_rows(rx, "auth.app_session.redeem") if a["reason"] == "cross_site"]
    assert [json.loads(a["details_json"])["sec_fetch_site"] for a in rows] == ["cross-site", "same-site", "cross-site"]
    anon = rows[-1]
    anon_d = json.loads(anon["details_json"])
    assert anon["resource_type"] == "installation" and anon_d["sec_fetch_site"] == "cross-site" and anon_d["code_known"] is False
    assert set(anon_d) == {"sec_fetch_site", "code_known", "ip"}
    assert anon["request_id"] != "bad id; x" and len(anon["request_id"]) == 12
    # the refusal did not spend the code: the app's own navigation still redeems it (behaviour unchanged)
    ok = redeem(rx, code, headers={"sec-fetch-site": "none"})
    assert ok.headers["location"] == "/arx/" and ok.headers.get("set-cookie")
    assert_nothing_leaked(rx)


def test_a_code_is_bound_to_the_family_key_and_dies_with_the_family(rx):
    dev, out, key = started(rx)
    code = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    assert rx.c.delete(f"{API}/auth/app/families/{out['family_id']}").status_code == 204
    assert redeem(rx, code).headers["location"].endswith("?app_session=failed")
    assert web_rows(rx) == []


# ---------------------------------------------------------------- the proof

def test_missing_proof_ends_the_family(rx):
    dev, out, key = started(rx)
    r = exchange(rx, out["access_token"], dev["device_id"], None)
    assert r.status_code == 401 and r.json()["code"] == "app_refresh_invalid"
    assert family_row(rx, out["family_id"])["revoked_reason"] == "session_proof_missing"


def test_another_keys_signature_ends_the_family(rx):
    dev, out, key = started(rx)
    r = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, Key(), dev["device_id"], out["access_token"]))
    assert r.status_code == 401 and family_row(rx, out["family_id"])["revoked_reason"] == "session_proof_invalid"


def test_a_refresh_signature_never_verifies_as_a_session_signature(rx):
    dev, out, key = started(rx)
    pr = proof(rx, key, dev["device_id"], out["access_token"])  # purpose `refresh` over the same bytes otherwise
    r = exchange(rx, out["access_token"], dev["device_id"], pr)
    assert r.status_code == 401 and family_row(rx, out["family_id"])["revoked_reason"] == "session_proof_invalid"


def test_a_signature_over_another_access_token_is_refused(rx):
    dev, out, key = started(rx)
    r = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], "arxa_" + "z" * 43))
    assert r.status_code == 401 and family_row(rx, out["family_id"])["revoked_reason"] == "session_proof_invalid"


def test_a_spent_or_foreign_nonce_and_a_bad_clock_are_retries_that_end_nothing(rx):
    dev, out, key = started(rx)
    pr = sproof(rx, key, dev["device_id"], out["access_token"])
    assert exchange(rx, out["access_token"], dev["device_id"], pr).status_code == 200
    r = exchange(rx, out["access_token"], dev["device_id"], pr)  # the same nonce again: replay
    assert r.status_code == 401 and r.json()["code"] == "app_refresh_proof_retry" and r.json()["details"]["reason"] == "nonce"
    r = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"], ts=now(rx) - 400))
    assert r.status_code == 401 and r.json()["details"]["reason"] == "clock"
    stale = nonce_of(rx, dev["device_id"])
    later(rx, 121)  # older than its 120 s
    r = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"], nonce=stale))
    assert r.status_code == 401 and r.json()["details"]["reason"] == "nonce"
    assert family_row(rx, out["family_id"])["revoked_at"] is None


def test_ts_must_be_a_strict_integer_and_the_device_id_well_formed(rx):
    dev, out, key = started(rx)
    pr = sproof(rx, key, dev["device_id"], out["access_token"])
    for bad in (str(pr["ts"]), True, float(pr["ts"])):
        assert exchange(rx, out["access_token"], dev["device_id"], {**pr, "ts": bad}).status_code == 422
    assert exchange(rx, out["access_token"], "DEV-1", pr).status_code == 422
    assert family_row(rx, out["family_id"])["revoked_at"] is None


def test_the_wrong_device_or_install_ends_the_family(rx):
    dev, out, key = started(rx)
    other = register(rx, install_id="99999999-2222-3333-4444-555555555555", name="אחר")
    r = exchange(rx, out["access_token"], other["device_id"], sproof(rx, key, dev["device_id"], out["access_token"]))
    assert r.status_code == 401 and family_row(rx, out["family_id"])["revoked_reason"] == "binding_mismatch"


def test_the_wrong_install_id_ends_the_family(rx):
    dev, out, key = started(rx)
    r = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"]), install_id="00000000-0000-0000-0000-000000000000")
    assert r.status_code == 401 and family_row(rx, out["family_id"])["revoked_reason"] == "binding_mismatch"


def test_no_keyless_exchange_and_nothing_ends(rx):
    from test_app_refresh_295 import started as keyless_started

    dev, out = keyless_started(rx)  # a slice-1 family (no key) under the default `optional`
    xon(rx)
    r = exchange(rx, out["access_token"], dev["device_id"], None)
    assert r.status_code == 403 and r.json()["code"] == "app_session_key_required"
    assert family_row(rx, out["family_id"])["revoked_at"] is None
    assert any(a["reason"] == "key_required" for a in audit_rows(rx, "auth.app_session.exchange"))


# ---------------------------------------------------------------- S-02, S-06, S-01

def test_s02_a_rotation_deletes_the_previous_access_tokens_while_on(rx):
    dev, out, key = started(rx)
    later(rx, 30)
    r = prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"]))
    assert r.status_code == 200, r.text
    assert whoami(rx, out["access_token"]).status_code == 401  # generation 1's access token is gone
    old = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"]))
    assert old.status_code == 401 and old.json()["code"] == "app_access_invalid"
    new = r.json()["access_token"]
    assert exchange(rx, new, dev["device_id"], sproof(rx, key, dev["device_id"], new)).status_code == 200


def test_s06_a_cookie_on_the_exchange_needs_its_origin_and_is_never_touched(rx):
    dev, out, key, wv = signed_in(rx)
    pr = sproof(rx, key, dev["device_id"], out["access_token"])
    r = exchange(rx, out["access_token"], dev["device_id"], pr, client=wv)  # the WebView's cookie, no Origin
    assert r.status_code == 403 and r.json()["code"] == "csrf_refused"
    before = web_rows(rx)[0]
    r = exchange(rx, out["access_token"], dev["device_id"], pr, client=wv, headers=ORIGIN)  # the nonce was not spent by the 403
    assert r.status_code == 200 and "set-cookie" not in r.headers
    after = web_rows(rx)[0]
    assert after["revoked_at"] is None and after["last_used_at"] == before["last_used_at"]  # the cookie's session untouched


def test_s01_a_web_session_never_mints_a_family(rx):
    dev, out, key, wv = signed_in(rx)
    body = {"device_id": dev["device_id"], "install_id": INSTALL}
    r = wv.post(f"{ARX}/auth/app/refresh-tokens", json=body, headers=ORIGIN)
    assert r.status_code == 403 and r.json()["code"] == "sign_in_not_anchorable"
    assert family_row(rx, out["family_id"])["revoked_at"] is None  # the phone's family was NOT replaced
    assert any(json.loads(a["details_json"] or "{}").get("anchor") == "web_session" for a in audit_rows(rx, "auth.app_refresh.issue"))
    later(rx, 30)
    assert prefresh(rx, out["refresh_token"], dev["device_id"], proof(rx, key, dev["device_id"], out["refresh_token"])).status_code == 200


# ---------------------------------------------------------------- per-request re-checks (S-03, 397)

def test_s03_the_web_session_ends_with_the_ha_sign_in_behind_its_family(rx):
    dev, out, key, wv = signed_in(rx)
    fam = family_row(rx, out["family_id"])
    if fam["anchor_hash"].startswith(svc.SESSION_ANCHOR_PREFIX):
        hua.STORE.drop_user("u-viewer")  # the HA sign-in lived only in this process (a restart, a revoke)
    else:
        with rx.db.connection() as conn:
            conn.execute("INSERT INTO remote_revoked_chains(iss_hash, user_id, revoked_at, revoked_by, reason) VALUES (?, 'u-viewer', '2026-10-24T00:00:00Z', 't', 't')",
                         (fam["anchor_hash"],))
    later(rx, 16)  # past the 15 s cache
    assert me(wv).status_code == 401
    assert web_rows(rx)[0]["revoked_reason"] == "sign_in_revoked"


def test_s03_a_shortened_family_lifetime_reaches_the_web_session_at_once(rx):
    dev, out, key, wv = signed_in(rx)
    with rx.db.connection() as conn:  # the family was minted two days ago
        conn.execute("UPDATE app_refresh_families SET created_at = ? WHERE family_id = ?", (svc.iso(rx.clock() - 2 * 86400), out["family_id"]))
    switch(rx, **{svc.IDLE_KEY: 1, svc.ABSOLUTE_KEY: 1})  # the owner shortens the saved sign-in to one day
    later(rx, 16)
    assert me(wv).status_code == 401
    assert web_rows(rx)[0]["revoked_reason"] == "expired"  # the family's (the web session's own cap is 7 days)


def test_a_disabled_user_or_removed_remote_flag_is_refused_at_the_next_request(rx):
    dev, out, key, wv = signed_in(rx)
    rx.arx.flag("u-viewer", on=False)
    later(rx, 16)
    assert me(wv).status_code == 401
    assert web_rows(rx)[0]["revoked_reason"] == "remote_not_allowed"


def test_a_permission_change_ends_the_web_session(rx):
    dev, out, key, wv = signed_in(rx)
    rx.bind("dana", "operator")
    later(rx, 16)
    assert me(wv).status_code == 401 and web_rows(rx)[0]["revoked_reason"] == "permissions"


def test_397_the_admin_mfa_rule_is_checked_per_request_and_ends_nothing(rx):
    dev, out, key = started(rx, "joni")
    assert family_row(rx, out["family_id"])["ha_mfa"] == 0  # recorded at mint: the fake owner has no HA MFA
    code = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    wv = webview(rx)
    assert redeem(rx, code, wv).headers["location"] == "/arx/"
    assert me(wv).status_code == 200
    rx.arx.setting("remote.require_mfa_admin", "true")
    later(rx, 16)
    assert me(wv).status_code == 401 and web_rows(rx)[0]["revoked_reason"] == "mfa_required"
    r = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"]))
    assert r.status_code == 403 and r.json()["code"] == "remote_mfa_required"
    assert family_row(rx, out["family_id"])["revoked_at"] is None  # decision 397: the saved sign-in is not ended


# ---------------------------------------------------------------- lifetime (431, 392)

def test_431_one_hour_idle_renewed_by_use_up_to_the_absolute_cap(rx):
    dev, out, key, wv = signed_in(rx)
    switch(rx, **{xs.MAX_KEY: 1})  # 1 day absolute for a short test (7 by default); applied live to the existing session
    for _ in range(40):  # used every 50 minutes: renewed past the first hour
        later(rx, 50 * 60)
        if me(wv).status_code != 200:
            break
    else:
        pytest.fail("never ended")
    assert web_rows(rx)[0]["revoked_reason"] == "expired"
    assert rx.clock() - 1_900_000_000.0 > 23 * 3600


def test_431_an_hour_without_use_ends_the_session(rx):
    dev, out, key, wv = signed_in(rx)
    later(rx, 3601)
    assert me(wv).status_code == 401 and web_rows(rx)[0]["revoked_reason"] == "idle"
    assert family_row(rx, out["family_id"])["revoked_at"] is None  # the saved sign-in stays (90 d / 30 d)


def test_392_an_administrators_web_session_is_capped_at_one_hour_and_30_minutes_idle(rx):
    dev, out, key = started(rx, "joni")
    code = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    wv = webview(rx)
    rr = redeem(rx, code, wv)
    max_age = int(next(a.strip()[8:] for a in rr.headers["set-cookie"].split(";") if a.strip().lower().startswith("max-age=")))
    assert max_age <= 3600
    later(rx, 25 * 60)
    assert me(wv).status_code == 200
    later(rx, 31 * 60)  # 31 minutes without use
    assert me(wv).status_code == 401 and web_rows(rx)[0]["revoked_reason"] == "idle"


def test_one_live_web_session_per_family(rx):
    dev, out, key, wv = signed_in(rx)
    code = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    wv2 = webview(rx)
    assert redeem(rx, code, wv2).headers["location"] == "/arx/"
    later(rx, 16)
    assert me(wv).status_code == 401 and me(wv2).status_code == 200
    assert [r["revoked_reason"] for r in web_rows(rx)] == ["replaced", None]


# ---------------------------------------------------------------- revocation paths

def test_ending_the_family_ends_the_web_session_at_once(rx):
    dev, out, key, wv = signed_in(rx)
    assert me(wv).status_code == 200
    assert rx.c.delete(f"{API}/auth/app/families/{out['family_id']}").status_code == 204
    assert me(wv).status_code == 401  # no cache window: the fan-out dropped the entry in the revoking transaction
    assert web_rows(rx)[0]["revoked_reason"] == "revoked_by_admin"


def test_device_re_registration_and_sign_out_everywhere_end_it(rx):
    dev, out, key, wv = signed_in(rx)
    r = rx.user("dana").delete(f"{ARX}/auth/sessions")
    assert r.status_code == 200, r.text
    assert me(wv).status_code == 401


def test_switching_the_exchange_off_ends_every_web_session(rx):
    dev, out, key, wv = signed_in(rx)
    switch(rx, **{XKEY: "off"})
    assert me(wv).status_code == 401 and web_rows(rx)[0]["revoked_reason"] == "feature_off"
    assert family_row(rx, out["family_id"])["revoked_at"] is None  # families untouched


def test_switching_the_saved_sign_in_off_ends_the_families_and_their_web_sessions(rx):
    dev, out, key, wv = signed_in(rx)
    switch(rx, **{"security.app_refresh": "off"})
    assert me(wv).status_code == 401 and web_rows(rx)[0]["revoked_reason"] == "feature_off"


def test_398_every_web_session_ends_at_start_up(rx):
    dev, out, key, wv = signed_in(rx)
    assert xs.end_on_startup(rx.db) == 1
    assert me(wv).status_code == 401 and web_rows(rx)[0]["revoked_reason"] == "restart"


def test_s04_ending_the_sessions_list_row_ends_the_saved_sign_in(rx):
    dev, out, key, wv = signed_in(rx)
    listing = rx.user("dana").get(f"{ARX}/auth/sessions").json()["sessions"]
    rows = [s for s in listing if s.get("kind") == "app"]
    assert len(rows) == 1 and rows[0]["saved_sign_in"] is True and rows[0]["device"] == "הנייד של דנה"
    assert "a." not in json.dumps(rows[0])  # no cookie material
    mine = wv.get(f"{ARX}/auth/sessions").json()["sessions"]
    assert [s["current"] for s in mine if s.get("kind") == "app"] == [True]
    r = rx.user("dana").delete(f"{ARX}/auth/sessions/{rows[0]['id']}")
    assert r.status_code == 200 and r.json()["saved_sign_ins_ended"] == 1, r.text
    assert me(wv).status_code == 401
    assert family_row(rx, out["family_id"])["revoked_reason"] == "revoked_by_user"
    # the app cannot silently re-create it: its access token died with the family
    r = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"]))
    assert r.status_code == 401


def test_another_users_row_needs_an_administrator(rx):
    dev, out, key, wv = signed_in(rx)
    pid = web_rows(rx)[0]["public_id"]
    r = rx.user("vera").delete(f"{ARX}/auth/sessions/{pid}")
    assert r.status_code == 403
    assert family_row(rx, out["family_id"])["revoked_at"] is None


def test_394_the_web_sign_out_ends_the_saved_sign_in_and_releases_the_pin(rx):
    dev, out, key, wv = signed_in(rx)
    r = wv.delete(f"{ARX}/auth/session", headers=ORIGIN)
    assert r.status_code == 204
    assert me(wv).status_code == 401
    assert family_row(rx, out["family_id"])["revoked_reason"] == "web_sign_out"
    assert audit_rows(rx, "auth.app_refresh.key_released")  # the user's own end (Q296)
    assert audit_rows(rx, "auth.app_session.signed_out")


def test_the_body_limit_tier_knows_a_live_web_session_from_memory(rx):
    dev, out, key, wv = signed_in(rx)
    me(wv)
    sid = next(c.value for c in wv.cookies.jar if c.name == COOKIE)
    assert xs.holds_live_cookie(sid)
    assert hua.holds_live_credential(rx.s, type("C", (), {"cookies": {COOKIE: sid}, "headers": {}})())


# ---------------------------------------------------------------- limits

def test_the_exchange_bucket_per_family(rx):
    dev, out, key = started(rx)
    codes = [exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).status_code for _ in range(6)]
    assert codes[:5] == [200] * 5 and codes[5] == 429


# ---------------------------------------------------------------- what is signed, storage classes, the migration

def test_the_session_message_is_exactly_the_documented_bytes():
    digest = dk.b64u_encode(hashlib.sha256(b"arxa_t").digest())
    assert dk.session_message("dev_a", "arxn_n", 1900000000, "arxa_t") == ("arx-app-pop-v1\nsession\ndev_a\narxn_n\n1900000000\n" + digest).encode()
    assert dk.session_message("dev_a", "arxn_n", 1900000000, "arxa_t") != dk.refresh_message("dev_a", "arxn_n", 1900000000, "arxa_t")


def test_backup_classification_and_settings_kept():
    assert {"app_web_sessions", "app_session_codes"} <= backup.NEVER_EXPORTED_TABLES
    assert {xs.FEATURE_KEY, xs.IDLE_KEY, xs.MAX_KEY} <= backup.SETTINGS_KEEP


def test_migration_0174_creates_the_tables_and_columns(rx):
    with rx.db.connection(mode="read") as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()}
        cols = {r[1] for r in conn.execute("PRAGMA table_info(app_refresh_families)").fetchall()}
        done = {r[0] for r in conn.execute("SELECT version FROM schema_migrations").fetchall()}
    assert {"app_web_sessions", "app_session_codes"} <= tables and {"ha_mfa", "factor_at"} <= cols and 174 in done


# ---------------------------------------------------------------- no secrets in logs / audit

def test_no_code_cookie_token_nonce_or_signature_in_any_table_audit_row_or_log(rx, caplog):
    caplog.set_level(logging.DEBUG)
    dev, out, key, wv = signed_in(rx)
    exchange(rx, out["access_token"], dev["device_id"], None, install_id="00000000-0000-0000-0000-000000000000")  # a refusal that ends the family
    me(wv)
    text = caplog.text + "\n" + "\n".join(key.sigs)
    assert_nothing_leaked(rx, caplog.text)
    for sig in key.sigs:
        assert sig not in caplog.text
    for row in audit_rows(rx, "auth.app_%"):
        d = row.get("details_json") or ""
        for m in rx.seen + key.sigs:
            assert m not in d
    _ = text


def test_the_access_log_line_of_the_redeem_path_is_redacted():
    rec = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d', ("1.2.3.4:5", "GET",
                            "/arx/api/v1/auth/app/session/redeem?code=arxc_SECRETSECRETSECRETSECRETSECRETSECRETSECR&x=1", "1.1", 303), None)
    assert xs.RedactCode().filter(rec) is True
    line = rec.getMessage()
    assert "arxc_" not in line and "code=REDACTED&x=1" in line
    assert xs._FILTER in logging.getLogger("uvicorn.access").filters


# ---------------------------------------------------------------- X4 review (2026-10-25): F-1, F-2, F-3, I-2

def test_x4_f1_a_redeem_without_the_app_marker_is_refused_and_spends_the_code(rx):
    dev, out, key = started(rx)
    for marker in (None, "short", "0123456789abcdefg", "0123456789ab0123456789ab0123456789", "0123-4567-89ab"):  # 5 = the family bucket
        code = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
        hdr = {"sec-fetch-site": "none"} if marker is None else {"sec-fetch-site": "none", "X-Correlation-Id": marker}
        r = webview(rx).get(REDEEM, params={"code": code}, headers=hdr, follow_redirects=False)  # a link tapped in SMS / mail: no header
        assert r.headers["location"] == "/arx/?app_session=failed" and "set-cookie" not in r.headers, marker
        assert redeem(rx, code).headers["location"].endswith("?app_session=failed")  # spent: the app cannot use it afterwards either
    assert sum(1 for a in audit_rows(rx, "auth.app_session.redeem") if a["reason"] == "marker_missing") == 5
    assert web_rows(rx) == []
    svc.reset_limits()  # a fresh per-family exchange bucket
    # 12 and 32 hex (any case) are the app's marker
    for marker in ("0123456789AB", "0123456789abcdef0123456789abcdef"):
        code = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
        assert redeem(rx, code, headers={"X-Correlation-Id": marker}).headers["location"] == "/arx/", marker


def test_x4_f1_a_code_never_replaces_another_users_live_session(rx):
    dev, out, key = started(rx)
    victim = rx.user("vera")  # vera's browser, signed in (an HA remote session cookie)
    assert victim.get(f"{ARX}/me").json()["user"]["id"] == "u-vera"
    code = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    r = victim.get(REDEEM, params={"code": code}, headers={**MARK, "sec-fetch-site": "none"}, follow_redirects=False)
    assert r.headers["location"] == "/arx/?app_session=failed" and "set-cookie" not in r.headers
    assert victim.get(f"{ARX}/me").json()["user"]["id"] == "u-vera"  # still vera, nothing replaced
    assert any(a["reason"] == "session_present" for a in audit_rows(rx, "auth.app_session.redeem"))
    assert redeem(rx, code).headers["location"].endswith("?app_session=failed")  # the code was spent
    # the SAME user's live web session is replaced as before (the app's cold-start exchange)
    wv = webview(rx)
    first = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    assert redeem(rx, first, wv).headers["location"] == "/arx/"
    second = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    assert redeem(rx, second, wv).headers["location"] == "/arx/" and me(wv).json()["user"]["id"] == "u-viewer"


def test_x4_f2_a_web_session_cannot_register_a_device(rx):
    dev, out, key, wv = signed_in(rx)
    with rx.db.connection(mode="read") as conn:
        before = conn.execute("SELECT COUNT(*) FROM mobile_devices").fetchone()[0]
    body = {"name": "טלפון אחר", "platform": "android", "install_id": "99999999-8888-7777-6666-555555555555", "app_version": "1.0.0"}
    r = wv.post(f"{ARX}/presence/devices", json=body, headers=ORIGIN)
    assert r.status_code == 403 and r.json()["code"] == "sign_in_not_anchorable" and "device_token" not in r.text
    with rx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM mobile_devices").fetchone()[0] == before
    rows = audit_rows(rx, "presence.device.register")
    assert rows[-1]["decision"] == "denied" and rows[-1]["reason"] == "sign_in_not_anchorable"
    # an ordinary sign-in still registers
    assert register(rx, "dana", install_id="99999999-8888-7777-6666-555555555555", name="טלפון אחר")["device_token"]


def test_x4_f3_unknown_and_expired_codes_are_audited_with_the_masked_address_only(rx):
    dev, out, key = started(rx)
    redeem(rx, "arxc_" + "u" * 43)
    code = exchange(rx, out["access_token"], dev["device_id"], sproof(rx, key, dev["device_id"], out["access_token"])).json()["code"]
    later(rx, 61)
    redeem(rx, code)
    rows = {a["reason"]: a for a in audit_rows(rx, "auth.app_session.redeem")}
    assert rows["code_unknown"]["resource_type"] == "installation" and set(json.loads(rows["code_unknown"]["details_json"])) == {"ip"}
    exp = json.loads(rows["code_expired"]["details_json"])
    assert rows["code_expired"]["resource_id"] == dev["device_id"] and exp["family"] == out["family_id"] and "ip" in exp
    issued = json.loads(audit_rows(rx, "auth.app_session.code_issued")[-1]["details_json"])
    assert "ip" in issued
    for a in audit_rows(rx, "auth.app_session.%"):
        assert a["request_id"] in ("0123456789abcdef", None) or len(a["request_id"]) == 12  # a validated id or a server one
    assert_nothing_leaked(rx)


def test_x4_i2_the_redeem_access_log_is_redacted_in_every_spelling_of_code():
    for q in ("cod%65=arxc_SECRETSECRETSECRETSECRETSECRETSECRETSECR", "%63ODE=arxc_SECRETSECRETSECRETSECRETSECRETSECRETSECR",
              "x=1;Code=arxc_SECRETSECRETSECRETSECRETSECRETSECRETSECR", "code%3Darxc_SECRETSECRETSECRETSECRETSECRETSECRETSECR"):
        rec = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d',
                                ("1.2.3.4:5", "GET", "/arx/api/v1/auth/app/session/redeem?" + q, "1.1", 303), None)
        assert xs.RedactCode().filter(rec) is True
        assert "SECRET" not in rec.getMessage(), q
    rec = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, '%s', ("/arx/api/v1/auth/app/session/redeem?zipcode=1&x=2",), None)
    xs.RedactCode().filter(rec)
    assert rec.getMessage().endswith("zipcode=1&x=2")  # another parameter whose name ends in `code` is not touched
