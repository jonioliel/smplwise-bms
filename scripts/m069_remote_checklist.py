#!/usr/bin/env python3
"""M069 / T069: the repo's remote-channel penetration checklist (docs/operations/ARX_REMOTE_PENTEST_HE.md) run against a LOCAL
dev backend: the real SMPLWISE backend with the remote channel on, whose only fake is Home Assistant core
(frontend/tests/fixtures/arx_fake_ha.py). No tunnel, no Cloudflare, no real Home Assistant, NVR or go2rtc is contacted.

It starts the fixture as its own child process (a fresh temp data dir, a free port), runs every item that can be exercised
on one machine over real HTTP, prints one line per item (PASS / FAIL / NOT_RUN + a short note) and a JSON block, and
stops only the child it started. Items that need Cloudflare, a phone on a cellular network, a real HA (ip_bans, refresh
tokens in the profile) or minutes of idle time are reported NOT_RUN with the reason; the in-process suites that cover them
are named in the note.

    py -3.12 scripts/m069_remote_checklist.py [--out evidence.json]     (Linux runner: .venv/bin/python)

Tokens, cookies and addresses are never printed: only status codes, header flags and counts.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import secrets
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Callable

import httpx

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "frontend" / "tests" / "fixtures" / "arx_fake_ha.py"
DIST = ROOT / "frontend" / "dist"
RESULTS: list[dict[str, str]] = []
HOST = "127.0.0.1"


def free_port() -> int:
    s = socket.socket()
    s.bind((HOST, 0))
    p = s.getsockname()[1]
    s.close()
    return p


def record(item: str, name: str, status: str, note: str = "") -> None:
    RESULTS.append({"item": item, "name": name, "status": status, "note": note})
    print(f"{status:8} {item:4} {name}" + (f"  [{note}]" if note else ""), flush=True)


class World:
    def __init__(self) -> None:
        self.port = free_port()
        self.fake_port = self.port + 2
        self.base = f"http://{HOST}:{self.port}"
        self.data = Path(tempfile.mkdtemp(prefix="m069-data-"))
        self.proc: subprocess.Popen | None = None
        self.stub_dist = False
        self._ip = 10

    def ip(self) -> str:
        """A fresh documentation-range address per check, so one check's rate-limit bucket never leaks into the next."""
        self._ip += 1
        return f"203.0.113.{self._ip}"

    def start(self) -> None:
        if not (DIST / "index.html").exists():
            DIST.mkdir(parents=True, exist_ok=True)
            (DIST / "index.html").write_text("<!doctype html><title>stub</title>", encoding="utf-8")
            self.stub_dist = True
        env = dict(os.environ, SW_PORT=str(self.port), SW_DATA_DIR=str(self.data), SW_LOG_LEVEL="warning")
        env.pop("SUPERVISOR_TOKEN", None)
        self.proc = subprocess.Popen([sys.executable, str(FIXTURE)], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
        deadline = time.time() + 60
        while time.time() < deadline:
            if self.proc.poll() is not None:
                raise SystemExit("fixture backend exited early")
            try:
                if httpx.get(f"{self.base}/arx/api/v1/auth/remote-config", timeout=2).status_code in (200, 401, 404):
                    return
            except httpx.HTTPError:
                time.sleep(0.5)
        raise SystemExit("fixture backend did not start")

    def stop(self) -> None:
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        if self.stub_dist:
            try:
                (DIST / "index.html").unlink()
                DIST.rmdir()
            except OSError:
                pass

    # ---- helpers
    def client_id(self) -> str:
        return f"https://{HOST}:{self.port}/arx/"

    def login(self, username: str) -> dict[str, Any]:
        """A real HA-shaped sign-in (PKCE S256) against the fake core; returns the token response."""
        cid = self.client_id()
        verifier = secrets.token_urlsafe(48)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        ha = f"http://{HOST}:{self.fake_port}"
        with httpx.Client(timeout=10) as c:
            f = c.post(f"{ha}/auth/login_flow", json={"client_id": cid, "handler": ["homeassistant", None], "redirect_uri": cid + "?auth_callback=1",
                                                      "code_challenge": challenge, "code_challenge_method": "S256"}).json()
            r = c.post(f"{ha}/auth/login_flow/{f['flow_id']}", json={"username": username, "password": f"pw-{username}", "client_id": cid}).json()
            t = c.post(f"{ha}/auth/token", data={"grant_type": "authorization_code", "code": r["result"], "client_id": cid, "code_verifier": verifier})
        return t.json()

    def req(self, method: str, path: str, ip: str | None = None, https: bool = True, **kw: Any) -> httpx.Response:
        headers = dict(kw.pop("headers", {}))
        if https:
            headers.setdefault("X-Forwarded-Proto", "https")
        if ip:
            headers.setdefault("CF-Connecting-IP", ip)
        return httpx.request(method, self.base + path, headers=headers, timeout=15, follow_redirects=False, **kw)

    def sign_in(self, username: str = "joni") -> tuple[str, str, dict[str, Any]]:
        """-> (cookie header value, access token, token response)."""
        tok = self.login(username)
        r = self.req("POST", "/arx/api/v1/auth/session", ip=self.ip(), headers={"Authorization": f"Bearer {tok['access_token']}"})
        assert r.status_code == 200, r.status_code
        raw = r.headers.get("set-cookie", "")
        cookie = raw.split(";", 1)[0]
        return cookie, tok["access_token"], tok

    def db_rows(self, sql: str, args: tuple = ()) -> list[tuple]:
        for p in list(self.data.glob("*.db")) + list(self.data.glob("*.sqlite*")):
            if p.suffix == ".db" or p.name.endswith(".sqlite"):
                with sqlite3.connect(f"file:{p}?mode=ro", uri=True) as conn:
                    try:
                        return conn.execute(sql, args).fetchall()
                    except sqlite3.Error:
                        continue
        return []


def run(item: str, name: str, fn: Callable[[], tuple[bool, str]]) -> None:
    try:
        ok, note = fn()
        record(item, name, "PASS" if ok else "FAIL", note)
    except Exception as exc:  # noqa: BLE001
        record(item, name, "FAIL", f"{type(exc).__name__}: {str(exc)[:120]}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    args = ap.parse_args()
    w = World()
    w.start()
    try:
        S = "/arx/api/v1/auth/session"
        bogus = {"Authorization": "Bearer a.b.c"}

        def i11() -> tuple[bool, str]:
            import yaml  # type: ignore

            cfg = yaml.safe_load((ROOT / "smplwise_vms" / "config.yaml").read_text(encoding="utf-8"))
            ports = cfg.get("ports") or {}
            mapped = {k: v for k, v in ports.items() if v is not None}
            return (not mapped and "8099/tcp" not in ports and cfg.get("ingress_port") == 8099, f"config.yaml maps no host port by default ({sorted(ports)} declared, all null); the bind address is the container's - the LAN probe itself stays a manual lab step")
        run("1.1", "no direct host port for the add-on (config review)", i11)

        def i12() -> tuple[bool, str]:
            r = w.req("POST", S, ip="203.0.113.99", headers={**bogus, "X-Forwarded-For": "203.0.113.98"})
            rows = w.db_rows("SELECT details_json FROM audit_log WHERE action = 'auth.remote_session.rejected' ORDER BY rowid DESC LIMIT 1")
            return r.status_code == 401 and r.json().get("code") == "remote_token_invalid" and bool(rows), f"{r.status_code} {r.json().get('code')}; audit row written. Without Cloudflare the header is taken as sent (by design: only the tunnel can reach the add-on) - the override by Cloudflare is NOT_RUN"
        run("1.2", "forged CF-Connecting-IP: refused with remote_token_invalid, audited", i12)

        def i13() -> tuple[bool, str]:
            ip = w.ip()
            codes = [w.req("POST", S, ip=ip, headers=bogus).status_code for _ in range(11)]
            rotating = [w.req("POST", S, ip=w.ip(), headers=bogus).status_code for _ in range(11)]
            return codes == [401] * 10 + [429], f"same address: {codes.count(401)}x401 then {codes[10]}; rotating the header locally: {rotating.count(401)}x401 (the real address is Cloudflare's - bypass is only possible when the add-on is reachable around the tunnel: item 1.1)"
        run("1.3", "rate limit 10/min per address (11th = 429)", i13)

        record("2.1", "HA ip ban follows the device, not the tunnel", "NOT_RUN", "needs a real HA http.ip_ban + a phone; the add-on side (trusted_proxies docs) is manual")
        record("2.2", "token spraying does not ban the add-on", "NOT_RUN", "needs a real HA; in-process: tests/test_remote_access.py::test_garbage_and_expired_tokens_never_reach_ha, test_a_token_ha_refuses_is_remembered")
        record("3.1", "http redirects to https", "NOT_RUN", "Cloudflare Always Use HTTPS")

        def i32() -> tuple[bool, str]:
            tok = w.login("dana")["access_token"]
            r = w.req("POST", S, ip=w.ip(), https=False, headers={"Authorization": f"Bearer {tok}"})
            sc = r.headers.get("set-cookie", "")
            return r.status_code == 200 and "__Secure-" not in sc and "Secure" not in sc, f"plain http: {r.status_code}, cookie name is the non-Secure one and not marked Secure; production never sees http (the tunnel is https and Cloudflare redirects)"
        run("3.2", "no __Secure- cookie over plain http", i32)

        def i33() -> tuple[bool, str]:
            tok = w.login("dana")["access_token"]
            r = w.req("POST", S, ip=w.ip(), headers={"Authorization": f"Bearer {tok}"})
            sc = r.headers.get("set-cookie", "")
            low = sc.lower()
            ok = sc.startswith("__Secure-arx_session=") and "httponly" in low and "secure" in low and "samesite=strict" in low and "path=/arx/" in low and "domain" not in low and "max-age=" in low
            age = int(low.split("max-age=")[1].split(";")[0])
            return ok and age <= 1800, f"flags HttpOnly/Secure/SameSite=strict/Path=/arx/, no Domain, Max-Age={age}"
        run("3.3", "cookie flags behind https", i33)

        for it, nm in (("4.1", "browser_session after closing"), ("4.2", "open HA tab"), ("4.3", "rolling_90d and sign-out"), ("4.4", "sign out of every place (browser part)")):
            record(it, nm, "NOT_RUN", "needs a real browser + real HA tokens in localStorage; the add-on side (sign-out everywhere) runs below as 5.3 and in tests/test_remote_hardening.py::test_sign_out_everywhere")

        record("5.1", "idle session revoked at HA gets no request through", "NOT_RUN", "needs a >3 minute idle wait; in-process: tests/test_remote_hardening.py::test_idle_session_revoked_at_ha_gets_no_request_through")

        def i52() -> tuple[bool, str]:
            cookie, _tok, _ = w.sign_in("dana")
            ip = w.ip()
            ok = w.req("GET", "/arx/api/v1/me", ip=ip, headers={"Cookie": cookie}).status_code
            httpx.post(f"http://{HOST}:{w.fake_port}/fake/revoke-user", json={"user_id": "u-viewer"}, timeout=5)
            t0 = time.time()
            code = 200
            while time.time() - t0 < 95:
                code = w.req("GET", "/arx/api/v1/me", ip=ip, headers={"Cookie": cookie}).status_code
                if code == 401:
                    break
                time.sleep(2)
            took = time.time() - t0
            return ok == 200 and code == 401 and took <= 70, f"revoked at the (fake) HA while in use: refused after {took:.0f} s (limit 65 s + poll)"
        run("5.2", "revocation at HA while in use: refused within ~65 s", i52)

        def i53() -> tuple[bool, str]:
            cookie, tok, resp = w.sign_in("joni")
            ip = w.ip()
            sessions = w.req("GET", "/arx/api/v1/auth/sessions", ip=ip, headers={"Cookie": cookie}).json()["sessions"]
            cur = next((s for s in sessions if s.get("current")), sessions[0])
            d = w.req("DELETE", f"/arx/api/v1/auth/sessions/{cur['id']}", ip=ip, headers={"Cookie": cookie, "Sec-Fetch-Site": "same-origin"})
            after = w.req("GET", "/arx/api/v1/me", ip=ip, headers={"Cookie": cookie}).status_code
            again = w.req("POST", S, ip=w.ip(), headers={"Authorization": f"Bearer {tok}"})
            return d.status_code == 200 and after == 401 and again.status_code == 401, f"revoke {d.status_code}; old cookie {after}; re-exchange {again.status_code} {again.json().get('code')}"
        run("5.3", "disconnect from the list: cookie dead, exchange refused", i53)
        record("5.4", "idle lock", "NOT_RUN", "browser idle timer; in-process: tests/test_remote_hardening.py (revalidation) and the Playwright arx spec")

        cookie, atok, _ = w.sign_in("joni")
        o = f"https://{HOST}:{w.port}"

        def i61() -> tuple[bool, str]:
            r = w.req("PATCH", "/arx/api/v1/settings", ip=w.ip(), headers={"Cookie": cookie, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json"}, content="{}")
            return r.status_code == 200, f"same-origin write passes the gate ({r.status_code})"
        run("6.1", "normal same-origin write works", i61)

        def i62() -> tuple[bool, str]:
            r = w.req("PATCH", "/arx/api/v1/settings", ip=w.ip(), headers={"Cookie": cookie, "Origin": o, "Sec-Fetch-Site": "cross-site", "Content-Type": "application/json"}, content="{}")
            return r.status_code == 403 and r.json().get("code") == "csrf_refused", f"{r.status_code} {r.json().get('code')} (cross-site beats a matching Origin). The header surviving Cloudflare is NOT_RUN"
        run("6.2", "Sec-Fetch-Site: cross-site refused", i62)

        def i63() -> tuple[bool, str]:
            a = w.req("PATCH", "/arx/api/v1/settings", ip=w.ip(), headers={"Cookie": cookie, "Content-Type": "application/json"}, content="{}")
            b = w.req("PATCH", "/arx/api/v1/settings", ip=w.ip(), headers={"Cookie": cookie, "Origin": o, "Content-Type": "application/json"}, content="{}")
            return a.status_code == 403 and a.json().get("code") == "csrf_refused" and b.status_code == 200, f"no origin proof {a.status_code} {a.json().get('code')}; Origin only {b.status_code}"
        run("6.3", "no proof of origin refused; Origin-only passes the gate", i63)

        def i64() -> tuple[bool, str]:
            r = w.req("POST", "/arx/api/v1/settings", ip=w.ip(), headers={"Cookie": cookie, "Sec-Fetch-Site": "same-site", "Content-Type": "text/plain"}, content="{}")
            rows = w.db_rows("SELECT details_json FROM audit_log WHERE action = 'auth.remote_csrf_refused' ORDER BY rowid DESC LIMIT 5")
            same_site = any("same-site" in (x[0] or "") for x in rows)
            return r.status_code == 403 and r.json().get("code") == "csrf_refused" and same_site, f"same-site simple POST with the cookie: {r.status_code}, audited with sec_fetch_site=same-site. A real sibling subdomain is NOT_RUN"
        run("6.4", "same-site (sibling) request refused and audited", i64)

        def i71() -> tuple[bool, str]:
            r = w.req("GET", "/arx/", ip=w.ip())
            h = {k.lower(): v for k, v in r.headers.items()}
            csp, ro = h.get("content-security-policy", ""), h.get("content-security-policy-report-only", "")
            ok = "script-src 'self'" in csp and "/arx/api/v1/csp-report" in csp and "style-src-elem 'self'" in ro and "arx-csp" in h.get("reporting-endpoints", "")
            return ok, f"CSP / report-only / Reporting-Endpoints present on the local response ({r.status_code}); that Cloudflare keeps them is NOT_RUN"
        run("7.1", "CSP headers", i71)

        def i72() -> tuple[bool, str]:
            ip = w.ip()
            body = json.dumps({"csp-report": {"effective-directive": "img-src", "blocked-uri": "https://pentest.example/x.png?secret=1", "disposition": "report"}})
            ct = {"Content-Type": "application/csp-report"}
            first = w.req("POST", "/arx/api/v1/csp-report", ip=ip, headers=ct, content=body).status_code
            codes = [w.req("POST", "/arx/api/v1/csp-report", ip=ip, headers=ct, content=body).status_code for _ in range(30)]
            big = w.req("POST", "/arx/api/v1/csp-report", ip=w.ip(), headers=ct, content=b"x" * 20480).status_code
            txt = w.req("POST", "/arx/api/v1/csp-report", ip=w.ip(), headers={"Content-Type": "text/plain"}, content=body).status_code
            rep = w.req("GET", "/arx/api/v1/csp-reports", ip=w.ip(), headers={"Cookie": cookie}).json()
            kept = json.dumps(rep)
            clean = "secret" not in kept and "pentest.example" in kept
            w.req("DELETE", "/arx/api/v1/csp-reports", ip=w.ip(), headers={"Cookie": cookie, "Sec-Fetch-Site": "same-origin"})
            return first == 204 and codes[-1] == 429 and big == 413 and txt == 415 and clean, f"first {first}; last of 31 {codes[-1]}; 20KB {big}; text/plain {txt}; stored host only (no query), counters reset"
        run("7.2", "CSP report sink: 204 / 429 / 413 / 415, no query kept", i72)
        record("7.3", "live-stream cap per sign-in", "NOT_RUN", "needs camera streams; in-process: tests/test_remote_hardening.py::test_remote_live_cap_per_sign_in")

        def i74() -> tuple[bool, str]:
            tok = w.login("dana")["access_token"]
            ip = w.ip()
            h = {"Authorization": f"Bearer {tok}"}
            me = w.req("GET", "/arx/api/v1/me", ip=ip, headers=h).status_code
            c2, _t2, _ = w.sign_in("dana")
            sessions = w.req("GET", "/arx/api/v1/auth/sessions", ip=ip, headers={"Cookie": c2}).json()["sessions"]
            bearer = [s for s in sessions if "bearer" in json.dumps(s).lower()]
            if not bearer:
                return False, f"me {me}; no bearer row in the list"
            d = w.req("DELETE", f"/arx/api/v1/auth/sessions/{bearer[0]['id']}", ip=ip, headers={"Cookie": c2, "Sec-Fetch-Site": "same-origin"}).status_code
            after = w.req("GET", "/arx/api/v1/me", ip=ip, headers=h).status_code
            return me == 200 and d == 200 and after == 401, f"bearer {me}; listed; revoked {d}; next bearer request {after}"
        run("7.4", "bearer client listed and revocable", i74)
    finally:
        w.stop()

    counts = {s: sum(1 for r in RESULTS if r["status"] == s) for s in ("PASS", "FAIL", "NOT_RUN")}
    print("\nM069_CHECKLIST " + json.dumps(counts))
    if args.out:
        Path(args.out).write_text(json.dumps({"counts": counts, "results": RESULTS}, indent=1, ensure_ascii=False), encoding="utf-8")
    return 1 if counts["FAIL"] else 0


if __name__ == "__main__":
    sys.exit(main())
