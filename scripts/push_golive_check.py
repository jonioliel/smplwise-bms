#!/usr/bin/env python3
"""Push go-live kit (PUSH-GOLIVE-KIT-2380): the checks around the owner's Firebase / Apple / Cloudflare session.

Standard library only. Nothing here sends anything to Apple, Google or Cloudflare, and no value of a secret is ever printed
(only OK / FAIL and the name of the rule that failed).

    python scripts/push_golive_check.py dry-run [--worker]
        Rehearsal with fakes, before the session. Starts services/push-relay/fake_relay.py on 127.0.0.1 (random port) and drives
        the relay contract (docs/api/mobile-presence-contract.md section 8) through it: health, register (idempotent per push
        token), push with the right / wrong / missing server key, an unknown relay token. Then static repo checks: wrangler.toml
        is still safe to deploy (no secret in [vars], a known APNS_ENV, the app bundle id allowed) and no secret-shaped file is
        tracked by git. With --worker it also runs the Worker's own typecheck, its vitest unit tests and `wrangler deploy
        --dry-run` (needs `npm ci` in services/push-relay once; NOT_RUN is reported when node_modules is missing).

    python scripts/push_golive_check.py secrets-preflight [--dir secrets] [--apns-team-id ID] [--apns-key-id ID]
        During the session, BEFORE `wrangler secret put`: checks the SHAPE of the local secret files (the Firebase service account
        JSON, the APNs AuthKey_*.p8, the optional server-keys file) and that git ignores them. Never prints a value.

    python scripts/push_golive_check.py health --url https://<worker>.workers.dev [--expect-fcm] [--expect-apns]
                                                [--expect-stable] [--min-server-keys N]
        AFTER the deploy and after each `secret put`: GET <url>/v1/health and compare with what you expect. This is the only
        subcommand that talks to a network address, and only to the one you give it (https only; plain http is accepted for
        127.0.0.1 so the fake can be checked).

Exit codes: 0 all checks passed, 1 at least one FAIL, 2 usage / could not run. NOT_RUN steps are listed and do not fail the run.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
RELAY_DIR = ROOT / "services" / "push-relay"
APP_BUNDLE_ID = "com.smplwise.arx.app"
RELAY_TOKEN_RE = re.compile(r"^rt_[A-Za-z0-9_\-]{43}$")  # the same shape the Worker enforces (services/push-relay/src/index.ts)
APNS_ID_RE = re.compile(r"^[A-Z0-9]{10}$")  # Apple's Key ID and Team ID are 10 upper-case letters / digits
SERVER_KEY_PAIR_RE = re.compile(r"^[A-Za-z0-9_\-]{1,32}:[0-9a-f]{32,128}$")  # <label>:<hex secret>, no commas or colons inside the secret
FORBIDDEN_TRACKED = (re.compile(r"\.p8$", re.I), re.compile(r"service[-_]?account.*\.json$", re.I), re.compile(r"(^|/)\.dev\.vars$"),
                     re.compile(r"google-services\.json$", re.I), re.compile(r"GoogleService-Info\.plist$", re.I),
                     re.compile(r"\.(jks|keystore|p12|mobileprovision)$", re.I), re.compile(r"(^|/)keystore\.properties$"))


class Report:
    """PASS / FAIL / NOT_RUN lines; a detail is a rule name, never a value."""

    def __init__(self) -> None:
        self.failed = 0
        self.passed = 0
        self.not_run: list[str] = []

    def ok(self, name: str) -> None:
        self.passed += 1
        print(f"  PASS  {name}")

    def fail(self, name: str, why: str = "") -> None:
        self.failed += 1
        print(f"  FAIL  {name}" + (f"  ({why})" if why else ""))

    def check(self, cond: bool, name: str, why: str = "") -> bool:
        if cond:
            self.ok(name)
        else:
            self.fail(name, why)
        return cond

    def skip(self, name: str, why: str) -> None:
        self.not_run.append(f"{name}: {why}")
        print(f"  NOT_RUN  {name}  ({why})")

    def finish(self) -> int:
        print(f"\n{self.passed} passed, {self.failed} failed, {len(self.not_run)} not run")
        return 1 if self.failed else 0


# ---------------------------------------------------------------------------------------------------------- tiny HTTP helper

def _http(method: str, url: str, body: dict | None = None, headers: dict[str, str] | None = None, timeout: float = 10.0) -> tuple[int, dict | list | None]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json", "User-Agent": "SmplWiseArx-golive-check", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 - the scheme is checked by the callers (https, or loopback http)
            raw = r.read(65536)
            status = r.status
    except urllib.error.HTTPError as e:
        raw = e.read(65536)
        status = e.code
    try:
        return status, (json.loads(raw) if raw else None)
    except ValueError:
        return status, None


def _load_fake_relay():
    spec = importlib.util.spec_from_file_location("push_fake_relay", RELAY_DIR / "fake_relay.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# --------------------------------------------------------------------------------------------------------------- dry-run

def _fake_contract(rep: Report) -> None:
    """The relay contract against the local fake. The fake holds its state in module globals, so every run starts clean."""
    fake = _load_fake_relay()
    fake.SERVER_KEY = "dryrun-" + "0" * 32  # a throwaway value that exists only in this process
    fake.print = lambda *args, **kwargs: None  # the fake echoes every accepted push; keep the report readable
    srv = ThreadingHTTPServer(("127.0.0.1", 0), fake.Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    auth = {"Authorization": f"Bearer {fake.SERVER_KEY}"}
    try:
        st, h = _http("GET", f"{base}/v1/health")
        rep.check(st == 200 and isinstance(h, dict) and h.get("ok") is True, "health answers ok")
        reg = {"platform": "android", "push_token": "fake-fcm-token-" + "a" * 20, "app_version": "2.1.5", "bundle_id": APP_BUNDLE_ID}
        st, r1 = _http("POST", f"{base}/v1/register", reg)
        tok = (r1 or {}).get("relay_token", "") if isinstance(r1, dict) else ""
        rep.check(st == 200 and bool(RELAY_TOKEN_RE.match(tok)), "register (android) returns a relay token of the contract shape")
        st, r2 = _http("POST", f"{base}/v1/register", reg)
        rep.check(st == 200 and isinstance(r2, dict) and r2.get("relay_token") == tok, "register is idempotent per push token")
        st, r3 = _http("POST", f"{base}/v1/register", {**reg, "platform": "ios", "push_token": "fake-apns-token-" + "b" * 20})
        itok = (r3 or {}).get("relay_token", "") if isinstance(r3, dict) else ""
        rep.check(st == 200 and itok != tok and bool(RELAY_TOKEN_RE.match(itok)), "register (ios) returns a different relay token")
        st, _ = _http("POST", f"{base}/v1/register", {"platform": "windows", "push_token": "x"})
        rep.check(st == 400, "register refuses an unknown platform")
        body = {"relay_token": tok, "category": "system", "notification_id": "dryrun0001", "priority": "normal", "server": "dryrun-server"}
        st, out = _http("POST", f"{base}/v1/push", body, auth)
        rep.check(st == 200 and out == {"ok": True}, "push with the server key is accepted")
        st, _ = _http("POST", f"{base}/v1/push", body, {"Authorization": "Bearer wrong-" + "0" * 32})
        rep.check(st == 401, "push with a wrong server key is refused (401)")
        st, _ = _http("POST", f"{base}/v1/push", body)
        rep.check(st == 401, "push without a server key is refused (401)")
        st, _ = _http("POST", f"{base}/v1/push", {**body, "relay_token": "rt_" + "z" * 43}, auth)
        rep.check(st == 404, "push to an unknown relay token answers 404 (the server then drops that registration)")
        st, seen = _http("GET", f"{base}/v1/pushes")
        item = seen[0] if isinstance(seen, list) and seen else {}
        rep.check(len(seen or []) == 1 and item.get("category") == "system" and item.get("notification_id") == "dryrun0001", "exactly the one accepted push was recorded")
        flat = json.dumps(seen)
        rep.check(not any(w in flat for w in ("title", "body", tok, "fake-fcm-token")), "what the relay keeps carries no notification text and no token")
        st, _ = _http("DELETE", f"{base}/v1/register", {"relay_token": tok})
        st2, _ = _http("POST", f"{base}/v1/push", body, auth)
        rep.check(st == 204 and st2 == 404, "unregister (204) makes the relay token unknown")
    finally:
        srv.shutdown()
        srv.server_close()


def _wrangler_static(rep: Report) -> None:
    text = (RELAY_DIR / "wrangler.toml").read_text(encoding="utf-8")
    vars_block = text.split("[vars]", 1)[1] if "[vars]" in text else ""
    vars_block = re.split(r"^\[", vars_block, maxsplit=1, flags=re.M)[0]
    names = re.findall(r"^\s*([A-Z0-9_]+)\s*=", vars_block, flags=re.M)
    secret_names = {"SERVER_KEYS", "RELAY_TOKEN_SECRET", "APNS_KEY_P8", "APNS_KEY_ID", "APNS_TEAM_ID", "APNS_BUNDLE_ID", "FCM_SERVICE_ACCOUNT"}
    rep.check(not (set(names) & secret_names), "wrangler.toml [vars] holds no secret name", "a secret name is set in [vars]")
    env = re.search(r'^\s*APNS_ENV\s*=\s*"([a-z]+)"', vars_block, flags=re.M)
    rep.check(bool(env) and env.group(1) in ("production", "sandbox"), "APNS_ENV is production or sandbox")
    allowed = re.search(r'^\s*ALLOWED_BUNDLE_IDS\s*=\s*"([^"]*)"', vars_block, flags=re.M)
    rep.check(bool(allowed) and APP_BUNDLE_ID in allowed.group(1).split(","), "the app bundle id is allowed")
    kv = re.search(r'^\s*id\s*=\s*"([^"]*)"', text, flags=re.M)
    kv_id = kv.group(1) if kv else ""
    if kv_id.startswith("REPLACE_WITH"):
        print("  INFO  KV namespace id is still the placeholder: expected before the owner session (step 'create RELAY_KV')")
    else:
        rep.check(bool(re.fullmatch(r"[0-9a-f]{32}", kv_id)), "KV namespace id has the shape of a Cloudflare id (32 hex)")


def _tracked_secret_files(rep: Report) -> None:
    try:
        out = subprocess.run(["git", "-C", str(ROOT), "ls-files"], capture_output=True, text=True, check=True, timeout=60).stdout.splitlines()
    except (OSError, subprocess.SubprocessError):
        rep.skip("no secret-shaped file is tracked by git", "git ls-files could not run")
        return
    bad = [p for p in out if any(rx.search(p) for rx in FORBIDDEN_TRACKED)]
    rep.check(not bad, "no secret-shaped file is tracked by git", f"{len(bad)} tracked file(s) match a secret pattern; run `git ls-files` and review" if bad else "")


def _worker(rep: Report) -> None:
    """The Worker's own checks (typecheck, vitest with a fake KV and throwaway signing keys, bundle dry run). Needs node_modules."""
    if not (RELAY_DIR / "node_modules").is_dir():
        rep.skip("Worker typecheck / unit tests / wrangler dry run", "run `npm ci` in services/push-relay once (needs the network), then repeat with --worker")
        return
    env = {**os.environ, "WRANGLER_SEND_METRICS": "false"}
    npm = "npm.cmd" if os.name == "nt" else "npm"
    npx = "npx.cmd" if os.name == "nt" else "npx"
    steps: list[tuple[str, list[str]]] = [("Worker typecheck", [npm, "run", "typecheck"]), ("Worker unit tests", [npm, "test"]),
                                          ("wrangler deploy --dry-run builds the bundle", [npx, "wrangler", "deploy", "--dry-run", "--outdir", str(Path(os.environ.get("TMPDIR") or os.environ.get("TEMP") or "/tmp") / "push-relay-dry")])]
    for name, cmd in steps:
        try:
            p = subprocess.run(cmd, cwd=RELAY_DIR, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600)
        except (OSError, subprocess.SubprocessError) as exc:
            rep.fail(name, type(exc).__name__)
            continue
        tail = [ln for ln in ((p.stdout or "") + (p.stderr or "")).splitlines() if ln.strip()][-3:]
        rep.check(p.returncode == 0, name, " | ".join(tail)[:200])


def cmd_dry_run(a: argparse.Namespace) -> int:
    print("push go-live dry run (fakes only; nothing leaves this machine)")
    rep = Report()
    print("\n[1] relay contract against fake_relay.py")
    _fake_contract(rep)
    print("\n[2] repository state")
    _wrangler_static(rep)
    _tracked_secret_files(rep)
    print("\n[3] the Worker's own checks")
    if a.worker:
        _worker(rep)
    else:
        rep.skip("Worker typecheck / unit tests / wrangler dry run", "not requested (add --worker)")
    return rep.finish()


# ------------------------------------------------------------------------------------------------------ secrets-preflight

def _git_ignored(path: Path) -> bool | None:
    """True when git ignores the file, False when it would be added, None when the file is outside the repository / git is unavailable."""
    try:
        path.resolve().relative_to(ROOT)
    except ValueError:
        return None
    try:
        return subprocess.run(["git", "-C", str(ROOT), "check-ignore", "-q", str(path.resolve())], timeout=30).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return None


def _check_ignored(rep: Report, path: Path, label: str) -> None:
    ign = _git_ignored(path)
    if ign is None:
        print(f"  INFO  {label}: outside the repository, git cannot add it")
    else:
        rep.check(ign, f"{label} is ignored by git", "git would add this file - move it to secrets/ or extend .gitignore before anything else")


def _preflight_service_account(rep: Report, d: Path) -> None:
    f = d / "firebase-relay-service-account.json"
    if not f.is_file():
        rep.skip("Firebase service account", f"{f.name} not found in {d.name}/ (step: Firebase > Service accounts > Generate new private key)")
        return
    try:
        sa = json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        rep.fail("Firebase service account is valid JSON")
        return
    rep.ok("Firebase service account is valid JSON")
    sa = sa if isinstance(sa, dict) else {}
    rep.check(sa.get("type") == "service_account", "type is service_account", "this looks like another kind of key file (an OAuth client or google-services.json)")
    rep.check(bool(sa.get("project_id")) and bool(sa.get("client_email")) and str(sa.get("client_email", "")).endswith(".gserviceaccount.com"), "project_id and a gserviceaccount.com client_email are present")
    pk = str(sa.get("private_key", ""))
    rep.check(pk.startswith("-----BEGIN PRIVATE KEY-----") and "-----END PRIVATE KEY-----" in pk, "private_key is a PKCS#8 PEM (the Worker imports it as RS256)")
    _check_ignored(rep, f, "service account file")


def _preflight_apns(rep: Report, d: Path, team_id: str | None, key_id: str | None) -> None:
    files = sorted(d.glob("*.p8"))
    if not files:
        rep.skip("APNs auth key", f"no AuthKey_<Key ID>.p8 in {d.name}/ (expected until the Apple Developer Program step; Android works without it)")
    for f in files[:3]:
        m = re.fullmatch(r"AuthKey_([A-Z0-9]{10})\.p8", f.name)
        rep.check(bool(m), "APNs key file name is AuthKey_<Key ID>.p8 (Key ID = 10 characters)")
        try:
            pem = f.read_text(encoding="utf-8")
        except OSError:
            rep.fail("APNs key file is readable")
            continue
        rep.check(pem.lstrip().startswith("-----BEGIN PRIVATE KEY-----") and "-----END PRIVATE KEY-----" in pem, "the .p8 is a PKCS#8 PEM (ES256 key)")
        if m and key_id:
            rep.check(m.group(1) == key_id, "the Key ID typed in the session equals the file name's Key ID")
        _check_ignored(rep, f, "APNs key file")
    if key_id is not None:
        rep.check(bool(APNS_ID_RE.match(key_id)), "--apns-key-id has the shape of an Apple Key ID")
    if team_id is not None:
        rep.check(bool(APNS_ID_RE.match(team_id)), "--apns-team-id has the shape of an Apple Team ID (Membership page)")


def _preflight_server_keys(rep: Report, d: Path) -> None:
    f = d / "push-relay-server-keys.txt"
    if not f.is_file():
        print(f"  INFO  {f.name} not present (optional: the SERVER_KEYS value may live only in the password manager)")
        return
    raw = f.read_text(encoding="utf-8").strip()
    pairs = raw.split(",") if raw else []
    rep.check(bool(pairs) and all(SERVER_KEY_PAIR_RE.match(p) for p in pairs), "SERVER_KEYS value is <label>:<hex secret>[,...] with no spaces")
    labels = [p.split(":", 1)[0] for p in pairs]
    secrets = [p.split(":", 1)[1] for p in pairs if ":" in p]
    rep.check(len(set(labels)) == len(labels) and len(set(secrets)) == len(secrets), "every installation has its own label and its own secret")
    _check_ignored(rep, f, "server keys file")


def cmd_preflight(a: argparse.Namespace) -> int:
    d = Path(a.dir)
    d = d if d.is_absolute() else ROOT / d
    print(f"secrets preflight (shape only; values are never printed) in {d.name}/")
    rep = Report()
    if not d.is_dir():
        print(f"  the directory does not exist: {d}")
        return 2
    _preflight_service_account(rep, d)
    _preflight_apns(rep, d, a.apns_team_id, a.apns_key_id)
    _preflight_server_keys(rep, d)
    return rep.finish()


# ----------------------------------------------------------------------------------------------------------------- health

def cmd_health(a: argparse.Namespace) -> int:
    u = urlparse(a.url)
    loopback = u.hostname in ("127.0.0.1", "localhost", "::1")
    if u.scheme != "https" and not (u.scheme == "http" and loopback):
        print("the URL must start with https:// (plain http only for 127.0.0.1)")
        return 2
    base = f"{u.scheme}://{u.netloc}{u.path.rstrip('/')}"
    if base.endswith("/v1"):
        print("give the address WITHOUT /v1 (the same value as push_relay_url)")
        return 2
    print(f"relay health: {u.scheme}://{u.netloc}")
    rep = Report()
    try:
        st, h = _http("GET", f"{base}/v1/health", timeout=15)
    except (urllib.error.URLError, OSError) as exc:
        rep.fail("the relay answers", type(exc).__name__)
        return rep.finish()
    rep.check(st == 200 and isinstance(h, dict) and h.get("ok") is True, "GET /v1/health answers {ok: true}", f"http {st}; a 404 here usually means the address has an extra path")
    h = h if isinstance(h, dict) else {}
    print("  INFO  " + ", ".join(f"{k}={h[k]}" for k in ("apns", "fcm", "stable_tokens", "server_keys") if k in h))
    if a.expect_fcm:
        rep.check(h.get("fcm") is True, "FCM secret present and readable (fcm: true)", "FCM_SERVICE_ACCOUNT missing or not a service account JSON")
    if a.expect_apns:
        rep.check(h.get("apns") is True, "APNs secrets present and readable (apns: true)", "one of APNS_KEY_P8 / _ID / _TEAM_ID / _BUNDLE_ID is missing")
    if a.expect_stable:
        rep.check(h.get("stable_tokens") is True, "RELAY_TOKEN_SECRET present (stable_tokens: true)", "without it register answers 503")
    if a.min_server_keys:
        rep.check(isinstance(h.get("server_keys"), int) and h["server_keys"] >= a.min_server_keys, f"at least {a.min_server_keys} server key(s) (server_keys)", "SERVER_KEYS missing or entries lack the <label>:<secret> shape")
    print("  NOTE  true means the secret exists and parses; only a real push proves that Apple / Google accept it")
    return rep.finish()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("dry-run", help="rehearsal with fakes (no network)")
    d.add_argument("--worker", action="store_true", help="also run the Worker's typecheck, unit tests and wrangler --dry-run (needs npm ci)")
    d.set_defaults(fn=cmd_dry_run)
    p = sub.add_parser("secrets-preflight", help="shape check of the local secret files")
    p.add_argument("--dir", default="secrets")
    p.add_argument("--apns-team-id")
    p.add_argument("--apns-key-id")
    p.set_defaults(fn=cmd_preflight)
    h = sub.add_parser("health", help="GET <url>/v1/health and compare")
    h.add_argument("--url", required=True)
    h.add_argument("--expect-fcm", action="store_true")
    h.add_argument("--expect-apns", action="store_true")
    h.add_argument("--expect-stable", action="store_true")
    h.add_argument("--min-server-keys", type=int, default=0)
    h.set_defaults(fn=cmd_health)
    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
