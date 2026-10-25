"""SX-25 (session-exchange client contract): the OFFICIAL JSON fixtures of `POST /auth/app/session` and `GET /auth/app/session/redeem`
for the Android and iOS teams, produced by driving the REAL routes (the same fake HA core and simulated device key as
test_app_session_295.py) and checked in under `contracts/fixtures/app_session/`.

Every test here builds one fixture from a live request/response and compares it with the checked-in file: a change of status, error
code, field set, header, cookie attribute or envelope makes it fail (code and fixtures drifted). To regenerate after an INTENDED change:
`ARX_WRITE_FIXTURES=1 python -m pytest tests/test_app_session_fixtures_sx25.py` (then review the diff and update the contract text).

Secrets never reach a fixture: every value the test sent or received that is a credential or varies per run (access token, nonce,
signature, code, cookie value, device id, install id, timestamps) is replaced by a placeholder - but only after its FORMAT was checked,
so a format drift still fails. Fakes only: no Home Assistant, no phone, no lab value."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from test_app_refresh_295 import ARX, INSTALL, rx, switch  # noqa: F401 - rx is the shared fixture
from test_app_refresh_devicekey_295 import keyed, now
from test_app_session_295 import signed_in, sproof, xon

from smplwise.services import app_refresh as svc

FIX = Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "app_session"
WRITE = os.environ.get("ARX_WRITE_FIXTURES") == "1"
CID = "0123456789abcdef0123456789abcdef"  # what the app sends (SX-17: 8-64 of [A-Za-z0-9_-]; the apps use 12-32 hex)
EXCHANGE = f"{ARX}/auth/app/session"
REDEEM = f"{ARX}/auth/app/session/redeem"
BASE = "https://testserver"  # the WebView and the native client reach the remote channel over https (the add-on's tunnel)
HEADERS_KEPT = ("content-type", "cache-control", "location", "set-cookie", "x-correlation-id")

PLACEHOLDERS = {
    "<ACCESS_TOKEN>": "the live access token, `arxa_` + base64url (never logged)",
    "<DEVICE_ID>": "`dev_` + 16 lowercase hex",
    "<INSTALL_ID>": "the install id the registration holds (8-64 characters)",
    "<NONCE>": "the challenge nonce, `arxn_` + base64url, single use, 120 s",
    "<UNIX_SECONDS>": "a JSON integer, Unix seconds (UTC)",
    "<UNIX_SECONDS_AS_STRING>": "the same number sent as a JSON string (refused: 422)",
    "<SIGNATURE>": "base64url ES256 signature over the six-line `session` message",
    "<CODE>": "`arxc_` + 43 base64url (single use, 60 s)",
    "<ISO_8601_UTC>": "`YYYY-MM-DDTHH:MM:SSZ`",
    "<SESSION_COOKIE>": "`a.` + 43 base64url - set by the server, never read or written by the app",
    "<SERVER_CORRELATION_ID>": "the server's own correlation id (12 lowercase hex) when the request carried no acceptable one",
    "<MAX_AGE_SECONDS>":"a positive integer (at most the web session's absolute lifetime)",
}
CODE_RE = re.compile(r"^arxc_[A-Za-z0-9_-]{43}$")
ISO_RE = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
COOKIE_RE = re.compile(r"^(__Secure-arx_session|arx_session)=a\.[A-Za-z0-9_-]{43}(;.*)$")


def native(rx) -> TestClient:
    return TestClient(rx.app, base_url=BASE)  # the native client: no cookie store of the WebView


def webview(rx) -> TestClient:
    return TestClient(rx.app, base_url=BASE)


class Subs:
    """Exact-value substitutions for what this test sent (credentials and per-run values), format-checked first."""

    def __init__(self) -> None:
        self.m: dict[Any, str] = {}

    def add(self, value: Any, placeholder: str, pattern: str | None = None) -> None:
        if pattern is not None:
            assert re.fullmatch(pattern, str(value)), (placeholder, "format drift")
        self.m[value] = placeholder

    def apply(self, v: Any) -> Any:
        if isinstance(v, dict):
            return {k: self.apply(x) for k, x in v.items()}
        if isinstance(v, list):
            return [self.apply(x) for x in v]
        if isinstance(v, bool) or v is None:
            return v
        if isinstance(v, (str, int)) and v in self.m:
            return self.m[v]
        if isinstance(v, str):
            for raw, ph in self.m.items():
                if isinstance(raw, str) and len(raw) >= 8 and raw in v:
                    v = v.replace(raw, ph)
        return v


def _norm_response_value(v: Any, key: str = "") -> Any:
    if isinstance(v, dict):
        return {k: _norm_response_value(x, k) for k, x in v.items()}
    if isinstance(v, list):
        return [_norm_response_value(x) for x in v]
    if key == "code" and isinstance(v, str) and v.startswith("arxc_"):
        assert CODE_RE.match(v), "code format drift"
        return "<CODE>"
    if isinstance(v, str) and ISO_RE.match(v):
        return "<ISO_8601_UTC>"
    if key == "server_time":
        assert isinstance(v, int) and not isinstance(v, bool), "server_time must be an integer"
        return "<UNIX_SECONDS>"
    return v


def _cookie(v: str) -> str:
    m = COOKIE_RE.match(v)
    assert m, "cookie format drift"
    attrs = re.sub(r"Max-Age=\d+", "Max-Age=<MAX_AGE_SECONDS>", m.group(2))
    return f"{m.group(1)}=<SESSION_COOKIE>{attrs}"


def fixture(name: str, description: str, method: str, path: str, req_headers: dict[str, str], req_body: Any, r, subs: Subs,
            query: dict[str, str] | None = None) -> dict[str, Any]:
    headers = {}
    for k in HEADERS_KEPT:
        if k in r.headers:
            headers[k] = _cookie(r.headers[k]) if k == "set-cookie" else r.headers[k]
    cid = headers.get("x-correlation-id")
    if cid is not None and cid != CID:  # the request sent none (or an invalid one): the server's own id, 12 lowercase hex
        assert re.fullmatch(r"[0-9a-f]{12}", cid), "server correlation id format drift"
        headers["x-correlation-id"] = "<SERVER_CORRELATION_ID>"
    try:
        body: Any = r.json()
    except ValueError:
        body = r.text or None
    return {
        "name": name,
        "description": description,
        "request": {"method": method, "path": path, **({"query": subs.apply(query)} if query else {}), "headers": subs.apply(req_headers),
                    **({"body": subs.apply(req_body)} if req_body is not None else {})},
        "response": {"status": r.status_code, "headers": headers, "body": subs.apply(_norm_response_value(body))},
    }


def _dump(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def check(fx: dict[str, Any]) -> None:
    path = FIX / f"{fx['name']}.json"
    text = _dump(fx)
    for secret_prefix in ("arxa_", "arxr_", "arxn_", "arxc_"):  # placeholders only, never material
        assert re.search(re.escape(secret_prefix) + r"[A-Za-z0-9_-]{8,}", text) is None, secret_prefix
    if WRITE:
        FIX.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode("utf-8"))
        return
    assert path.exists(), f"missing fixture {path.name}: run with ARX_WRITE_FIXTURES=1 and review"
    assert json.loads(path.read_text(encoding="utf-8")) == fx, f"{path.name}: the code and the checked-in fixture drifted"


# ---------------------------------------------------------------- helpers driving the real routes

def _ready(rx, user: str = "dana"):
    dev, out, key = keyed(rx, user)
    xon(rx)
    return dev, out, key


def _subs(dev: dict, access: str) -> Subs:
    s = Subs()
    s.add(dev["device_id"], "<DEVICE_ID>", r"dev_[0-9a-f]{16}")
    s.add(INSTALL, "<INSTALL_ID>")
    s.add(access, "<ACCESS_TOKEN>", r"arxa_[A-Za-z0-9_-]{20,}")
    return s


def _proof(rx, s: Subs, key, dev: dict, access: str, ts: int | None = None, nonce: str | None = None) -> dict:
    pr = sproof(rx, key, dev["device_id"], access, nonce=nonce, ts=ts)
    s.add(pr["nonce"], "<NONCE>", r"arxn_[A-Za-z0-9_-]{20,}")
    s.add(pr["ts"], "<UNIX_SECONDS>")
    s.add(pr["sig"], "<SIGNATURE>", r"[A-Za-z0-9_-]{40,}")
    return pr


def _post(rx, s: Subs, access: str, body: dict, client: TestClient | None = None, extra: dict | None = None):
    hdr = {"Authorization": f"Bearer {access}", "Content-Type": "application/json", "X-Correlation-Id": CID, **(extra or {})}
    r = (client or native(rx)).post(EXCHANGE, content=json.dumps(body), headers=hdr)
    return hdr, r


def _exchange_case(rx, name: str, description: str, body: dict, s: Subs, access: str, client: TestClient | None = None,
                   extra: dict | None = None, status: int | None = None, code: str | None = None) -> dict:
    hdr, r = _post(rx, s, access, body, client, extra)
    if status is not None:
        assert r.status_code == status, r.text
    if code is not None:
        assert r.json()["code"] == code, r.text
    return fixture(name, description, "POST", EXCHANGE, hdr, body, r, s)


def _body(dev: dict, pr: dict | None) -> dict:
    b: dict = {"device_id": dev["device_id"], "install_id": INSTALL}
    if pr is not None:
        b["proof"] = pr
    return b


def _code(rx, dev, out, key) -> str:
    s = _subs(dev, out["access_token"])
    _, r = _post(rx, s, out["access_token"], _body(dev, _proof(rx, s, key, dev, out["access_token"])))
    assert r.status_code == 200, r.text
    rx.seen.append(r.json()["code"])
    return r.json()["code"]


def _redeem_case(rx, name: str, description: str, code: str, site: str = "none", client: TestClient | None = None) -> dict:
    s = Subs()
    s.add(code, "<CODE>", CODE_RE.pattern[1:-1])
    hdr = {"Sec-Fetch-Site": site, "X-Correlation-Id": CID}
    r = (client or webview(rx)).get(REDEEM, params={"code": code}, headers=hdr, follow_redirects=False)
    return fixture(name, description, "GET", REDEEM, hdr, None, r, s, query={"code": code})


# ---------------------------------------------------------------- the exchange: success and every error the contract lists

def test_exchange_ok(rx):
    dev, out, key = _ready(rx)
    s = _subs(dev, out["access_token"])
    check(_exchange_case(rx, "exchange_ok", "200: a one-time code for the WebView (60 s, single use); no Set-Cookie on the native answer.",
                         _body(dev, _proof(rx, s, key, dev, out["access_token"])), s, out["access_token"], status=200))


def test_exchange_not_offered(rx):
    dev, out, key = keyed(rx)  # the saved sign-in on, the exchange switch off (its default)
    s = _subs(dev, out["access_token"])
    check(_exchange_case(rx, "exchange_not_offered", "404 not_found: the switch is off (or an older server) - keep today's behaviour.",
                         _body(dev, _proof(rx, s, key, dev, out["access_token"])), s, out["access_token"], status=404, code="not_found"))


def test_exchange_access_invalid(rx):
    dev, out, key = _ready(rx)
    bogus = "arxa_" + "b" * 43
    s = _subs(dev, bogus)
    check(_exchange_case(rx, "exchange_access_invalid", "401 app_access_invalid: unknown or expired access token - refresh, then exchange ONCE more.",
                         _body(dev, _proof(rx, s, key, dev, bogus)), s, bogus, status=401, code="app_access_invalid"))


def test_exchange_proof_retry_nonce(rx):
    dev, out, key = _ready(rx)
    s = _subs(dev, out["access_token"])
    body = _body(dev, _proof(rx, s, key, dev, out["access_token"]))
    assert _post(rx, s, out["access_token"], body)[1].status_code == 200  # spends the nonce
    check(_exchange_case(rx, "exchange_proof_retry_nonce", "401 app_refresh_proof_retry, details.reason = nonce: the nonce was used / expired / unknown; "
                         "nothing ended - new challenge, sign again, retry ONCE.", body, s, out["access_token"], status=401, code="app_refresh_proof_retry"))


def test_exchange_proof_retry_clock(rx):
    dev, out, key = _ready(rx)
    s = _subs(dev, out["access_token"])
    check(_exchange_case(rx, "exchange_proof_retry_clock", "401 app_refresh_proof_retry, details.reason = clock: ts off by more than 300 s; nothing "
                         "ended - new challenge, sign with server_time + elapsed, retry ONCE.",
                         _body(dev, _proof(rx, s, key, dev, out["access_token"], ts=now(rx) - 400)), s, out["access_token"], status=401,
                         code="app_refresh_proof_retry"))


def test_exchange_refresh_invalid(rx):
    dev, out, key = _ready(rx)
    s = _subs(dev, out["access_token"])
    check(_exchange_case(rx, "exchange_refresh_invalid", "401 app_refresh_invalid: the saved sign-in ENDED (here: no proof) - forget the refresh token "
                         "AND delete the key pair; clear the WebView cookies of the origin; show the sign-in.",
                         _body(dev, None), s, out["access_token"], status=401, code="app_refresh_invalid"))


def test_exchange_refresh_expired(rx):
    dev, out, key = _ready(rx)
    with rx.db.connection() as conn:  # the saved sign-in ran out while its last access token is still live
        conn.execute("UPDATE app_refresh_families SET absolute_expires_at = ? WHERE family_id = ?", (svc.iso(rx.clock() - 1), out["family_id"]))
    s = _subs(dev, out["access_token"])
    check(_exchange_case(rx, "exchange_refresh_expired", "401 app_refresh_expired: the saved sign-in ran out - as app_refresh_invalid but KEEP the key pair.",
                         _body(dev, _proof(rx, s, key, dev, out["access_token"])), s, out["access_token"], status=401, code="app_refresh_expired"))


def test_exchange_key_required(rx):
    from test_app_refresh_295 import started as keyless_started

    dev, out = keyless_started(rx)  # a saved sign-in without a device key (an old app version)
    xon(rx)
    s = _subs(dev, out["access_token"])
    check(_exchange_case(rx, "exchange_key_required", "403 app_session_key_required: this saved sign-in has no device key; nothing ended - "
                         "let the WebView sign in normally.", _body(dev, None), s, out["access_token"], status=403, code="app_session_key_required"))


def test_exchange_mfa_required(rx):
    dev, out, key = _ready(rx, "joni")  # an administrator whose HA sign-in had no MFA
    rx.arx.setting("remote.require_mfa_admin", "true")
    s = _subs(dev, out["access_token"])
    check(_exchange_case(rx, "exchange_mfa_required", "403 remote_mfa_required: an administrator without HA MFA while the installation requires it; "
                         "nothing ended - let the WebView show its sign-in.",
                         _body(dev, _proof(rx, s, key, dev, out["access_token"])), s, out["access_token"], status=403, code="remote_mfa_required"))


def test_exchange_validation(rx):
    dev, out, key = _ready(rx)
    s = _subs(dev, out["access_token"])
    pr = _proof(rx, s, key, dev, out["access_token"])
    s.add(str(pr["ts"]), "<UNIX_SECONDS_AS_STRING>")
    check(_exchange_case(rx, "exchange_validation", "422 validation: a malformed body (here: ts sent as a string) - an app bug: report, do not loop.",
                         _body(dev, {**pr, "ts": str(pr["ts"])}), s, out["access_token"], status=422, code="validation"))


def test_exchange_rate_limited(rx):
    dev, out, key = _ready(rx)
    s = _subs(dev, out["access_token"])
    for _ in range(5):
        assert _post(rx, s, out["access_token"], _body(dev, _proof(rx, s, key, dev, out["access_token"])))[1].status_code == 200
    check(_exchange_case(rx, "exchange_rate_limited", "429 rate_limited: more than 5 in a burst / 30 per hour per saved sign-in - wait "
                         "details.retry_after_s; never in parallel.", _body(dev, _proof(rx, s, key, dev, out["access_token"])), s, out["access_token"],
                         status=429, code="rate_limited"))


def test_exchange_csrf_refused(rx):
    dev, out, key, wv = signed_in(rx)  # plain http in the test backend: the cookie is `arx_session` here (`__Secure-arx_session` in the add-on)
    s = _subs(dev, out["access_token"])
    cookie = next(c.value for c in wv.cookies.jar if c.name == "arx_session")
    s.add(cookie, "<SESSION_COOKIE>", r"a\.[A-Za-z0-9_-]{43}")
    fx = _exchange_case(rx, "exchange_csrf_refused", "403 csrf_refused: the native client sent the WebView's session cookie without an Origin; refused "
                        "by the remote channel before the route (nothing spent; correlation_id empty, no X-Correlation-Id header). Fix the client: "
                        "no shared cookie store.", _body(dev, _proof(rx, s, key, dev, out["access_token"])), s, out["access_token"], client=wv,
                        status=403, code="csrf_refused")
    fx["request"]["headers"]["Cookie"] = "arx_session=<SESSION_COOKIE>"  # what the client jar added (not set by this test's headers)
    check(fx)


# ---------------------------------------------------------------- the redeem (the WebView's top-level navigation)

def test_redeem_ok(rx):
    dev, out, key = _ready(rx)
    code = _code(rx, dev, out, key)
    check(_redeem_case(rx, "redeem_ok", "303 to <remote_path>/ with the server-set session cookie (HttpOnly; Secure; SameSite=Strict; Path=/arx/). "
                       "The app never reads or writes the cookie.", code))


def test_redeem_refused(rx):
    dev, out, key = _ready(rx)
    code = _code(rx, dev, out, key)
    assert webview(rx).get(REDEEM, params={"code": code}, headers={"X-Correlation-Id": CID}, follow_redirects=False).headers["location"] == "/arx/"
    check(_redeem_case(rx, "redeem_refused", "303 to <remote_path>/?app_session=failed, no cookie: the code was spent / expired / unknown or a "
                       "binding failed (here: a replay). The reason is only in the server audit (linked by X-Correlation-Id). Do not retry in a loop.",
                       code))


def test_redeem_cross_site(rx):
    dev, out, key = _ready(rx)
    code = _code(rx, dev, out, key)
    check(_redeem_case(rx, "redeem_cross_site", "303 to <remote_path>/?app_session=failed: Sec-Fetch-Site cross-site / same-site is refused (audited "
                       "as auth.app_session.redeem denied, reason cross_site, SX-27); the code is NOT spent.", code, site="cross-site"))


def test_redeem_without_marker(rx):
    dev, out, key = _ready(rx)
    code = _code(rx, dev, out, key)
    s = Subs()
    s.add(code, "<CODE>", CODE_RE.pattern[1:-1])
    hdr = {"Sec-Fetch-Site": "none"}  # a link opened from SMS / mail / another app: no X-Correlation-Id
    r = webview(rx).get(REDEEM, params={"code": code}, headers=hdr, follow_redirects=False)
    check(fixture("redeem_without_marker", "303 to <remote_path>/?app_session=failed: the redeem navigation carried no X-Correlation-Id of 12-32 hex "
                  "characters (X4 F-1); the code IS spent. The app must send the header on loadUrl(url, headers) / URLRequest.", "GET", REDEEM, hdr,
                  None, r, s, query={"code": code}))


def test_redeem_not_offered(rx):
    keyed(rx)  # the exchange switch off
    check(_redeem_case(rx, "redeem_not_offered", "404 not_found: the switch is off (or an older server).", "arxc_" + "a" * 43))


# ---------------------------------------------------------------- the index (runs last: it reads the files written above)

CASES = ("exchange_ok", "exchange_not_offered", "exchange_access_invalid", "exchange_proof_retry_nonce", "exchange_proof_retry_clock",
         "exchange_refresh_invalid", "exchange_refresh_expired", "exchange_key_required", "exchange_mfa_required", "exchange_validation",
         "exchange_rate_limited", "exchange_csrf_refused", "redeem_ok", "redeem_refused", "redeem_cross_site", "redeem_without_marker", "redeem_not_offered")


def test_zz_index_lists_exactly_the_fixtures():
    cases = []
    for name in CASES:
        fx = json.loads((FIX / f"{name}.json").read_text(encoding="utf-8"))
        body = fx["response"]["body"]
        cases.append({"name": name, "file": f"{name}.json", "method": fx["request"]["method"], "path": fx["request"]["path"],
                      "status": fx["response"]["status"], "code": body.get("code") if isinstance(body, dict) and fx["response"]["status"] >= 400 else None,
                      "location": fx["response"]["headers"].get("location")})
    index = {
        "contract": "SmplWise Arx - WebView session exchange, client contract v2.2 (docs/api/mobile-presence-contract.md section 10; docs/changes/APPREFRESH-SESSION-EXCHANGE-SPEC.md revision 3)",
        "generated_by": "smplwise_vms/backend/tests/test_app_session_fixtures_sx25.py (the real routes; a drift fails that test)",
        "status": "FIXTURE - produced by the server's test backend, not by a device or an installation; not an activation approval",
        "error_envelope": ["code", "user_message", "retryable", "correlation_id", "details"],
        "placeholders": PLACEHOLDERS,
        "cases": cases,
    }
    path = FIX / "index.json"
    if WRITE:
        path.write_bytes(_dump(index).encode("utf-8"))
    on_disk = {p.name for p in FIX.glob("*.json")}
    assert on_disk == {f"{n}.json" for n in CASES} | {"index.json"}, on_disk ^ ({f"{n}.json" for n in CASES} | {"index.json"})
    assert json.loads(path.read_text(encoding="utf-8")) == index


@pytest.mark.parametrize("name", CASES)
def test_no_fixture_carries_material(name):
    text = (FIX / f"{name}.json").read_text(encoding="utf-8")
    assert re.search(r"(arxa_|arxr_|arxn_|arxc_)[A-Za-z0-9_-]{8,}", text) is None
    assert re.search(r"a\.[A-Za-z0-9_-]{43}", text) is None
    assert "testserver" not in text  # paths only: no host of any kind
