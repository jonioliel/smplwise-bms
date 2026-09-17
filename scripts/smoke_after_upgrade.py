#!/usr/bin/env python3
"""Smoke test after an add-on upgrade (T036): a handful of read-only checks that prove the installation still works —
health facts, identity, cameras, sites, events, a snapshot, a short playback session (created and closed), an export
estimate, saved views, storage report, audit, the built UI — and, on the owner's Home Assistant, the bridge state.

Against the developer backend:
  python scripts/smoke_after_upgrade.py --base http://127.0.0.1:8099 [--dev-user joni]
Against the owner's installation (Ingress session through the HA token in secrets/lab.env; read-only):
  python scripts/smoke_after_upgrade.py --live

Checks that need a VMS role the caller does not hold are reported as skipped, not failed. Nothing is written except
one playback session that the script closes itself. Exit code 1 when any check fails. Output never contains secrets;
hosts are not printed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable

Result = tuple[str, str, str]  # (name, status ok|warn|skip|fail, detail)


class Client:
    """Minimal HTTP client protocol: request(method, path, json_body) -> (status, body_bytes, content_type)."""

    def request(self, method: str, path: str, body: dict[str, Any] | None = None, timeout: float = 30) -> tuple[int, bytes, str]:  # pragma: no cover - interface
        raise NotImplementedError


class HttpClient(Client):
    def __init__(self, base: str, headers: dict[str, str] | None = None) -> None:
        self.base = base.rstrip("/") + "/"
        self.headers = headers or {}

    def request(self, method: str, path: str, body: dict[str, Any] | None = None, timeout: float = 30) -> tuple[int, bytes, str]:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(self.base + path.lstrip("/"), data=data, method=method, headers={**self.headers, **({"Content-Type": "application/json"} if data else {})})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 - the VMS the operator asked for
                return r.status, r.read(), r.headers.get("Content-Type", "")
        except urllib.error.HTTPError as e:
            return e.code, e.read(), e.headers.get("Content-Type", "") if e.headers else ""


def _json(body: bytes) -> Any:
    try:
        return json.loads(body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None


def run_smoke(client: Client, *, live: bool = False, now: Callable[[], dt.datetime] | None = None) -> list[Result]:
    now = now or (lambda: dt.datetime.now(dt.timezone.utc))
    out: list[Result] = []

    def add(name: str, status: str, detail: str) -> None:
        out.append((name, status, detail))

    # 1. health facts
    st, body, _ = client.request("GET", "api/v1/health")
    h = _json(body) if st == 200 else None
    if not isinstance(h, dict):
        add("health", "fail", f"GET /health -> {st}")
        return out
    nvr = bool(h.get("nvr_configured"))
    disc = h.get("discovery") or {}
    ing = (h.get("events") or {}).get("ingest") or {}
    ha = h.get("home_assistant") or {}
    add("health", "ok" if h.get("db", {}).get("ok") and h.get("data_dir_writable") else "fail", f"version {h.get('version')} · db {'ok' if h.get('db', {}).get('ok') else 'ERROR'} · /data {'writable' if h.get('data_dir_writable') else 'NOT writable'}")
    add("nvr", "ok" if nvr and not disc.get("cameras_last_error") else ("warn" if nvr else "skip"), f"configured={nvr} · discovered {disc.get('cameras')} channels · last ok {disc.get('cameras_last_ok') or '—'}{' · error: ' + str(disc.get('cameras_last_error')) if disc.get('cameras_last_error') else ''}")
    add("alert stream", "ok" if ing.get("connected") else ("warn" if nvr else "skip"), f"connected={ing.get('connected')} · stored since start {ing.get('events_stored')} · last heartbeat {ing.get('last_heartbeat_at') or '—'}")
    add("home assistant", "ok" if ha.get("connected") else ("warn" if ha.get("configured") else "skip"), f"connected={ha.get('connected')} · entities {ha.get('entities')} · HA {ha.get('ha_version') or '—'}")

    # 2. summary + identity
    st, body, _ = client.request("GET", "api/v1/health/summary")
    s = _json(body) if st == 200 else None
    add("summary", "ok" if isinstance(s, dict) and s.get("status") == "ok" else ("warn" if isinstance(s, dict) else "fail"), f"status {s.get('status') if isinstance(s, dict) else st} · {len(s.get('items', [])) if isinstance(s, dict) else 0} items")
    st, body, _ = client.request("GET", "api/v1/me")
    me = _json(body) if st == 200 else None
    has_access = bool(isinstance(me, dict) and me.get("has_access"))
    add("identity", "ok" if isinstance(me, dict) else "fail", f"user {me.get('user', {}).get('username') if isinstance(me, dict) else '—'} · source {me.get('user', {}).get('source') if isinstance(me, dict) else '—'} · has_access={has_access}")
    if not has_access:
        add("cameras", "skip", "no VMS role for this user — grant one (הגדרות › משתמשים והרשאות) to run the rest")
        return out

    # 3. cameras, sites, events, views
    st, body, _ = client.request("GET", "api/v1/cameras")
    cams = (_json(body) or {}).get("cameras", []) if st == 200 else []
    online = [c for c in cams if c.get("status") == "online"]
    add("cameras", "ok" if cams else ("fail" if nvr else "skip"), f"{len(cams)} cameras · {len(online)} online" if st == 200 else f"GET /cameras -> {st}")
    st, body, _ = client.request("GET", "api/v1/sites?tree=true")
    sites = (_json(body) or {}).get("sites", []) if st == 200 else None
    floors = sum(len(b.get("floors") or []) for s_ in (sites or []) for b in (s_.get("buildings") or []))
    add("sites", "ok" if sites else ("warn" if sites == [] else ("skip" if st == 403 else "fail")), f"{len(sites) if sites is not None else st} sites · {floors} floors")
    st, body, _ = client.request("GET", "api/v1/events/summary")
    ev = _json(body) if st == 200 else None
    add("events", "ok" if isinstance(ev, dict) else ("skip" if st == 403 else "fail"), f"today {ev.get('today', {}).get('total')} · unreviewed {ev.get('today', {}).get('unacked')}" if isinstance(ev, dict) else f"-> {st}")
    st, body, _ = client.request("GET", "api/v1/views")
    add("saved views", "ok" if st == 200 else ("skip" if st == 403 else "fail"), f"{len((_json(body) or {}).get('views', []))} views" if st == 200 else f"-> {st}")

    # 4. media: snapshot, playback session, export estimate (need the NVR and an online camera)
    cam = online[0] if online else None
    if not nvr or not cam:
        add("snapshot", "skip", "no online camera / NVR not configured")
        add("playback", "skip", "no online camera / NVR not configured")
        add("export estimate", "skip", "no online camera / NVR not configured")
    else:
        st, body, ctype = client.request("GET", f"api/v1/cameras/{cam['id']}/snapshot.jpg", timeout=40)
        add("snapshot", "ok" if st == 200 and "image" in ctype else ("skip" if st == 403 else "fail"), f"{cam.get('name')} -> {st} {ctype.split(';')[0]} {len(body)} bytes")
        st, body, _ = client.request("GET", "api/v1/events?type=motion&limit=5")
        evs = [e for e in ((_json(body) or {}).get("events", []) if st == 200 else []) if e.get("camera_id")]
        target = evs[0] if evs else None
        cam_id = target["camera_id"] if target else cam["id"]
        at = (dt.datetime.fromisoformat(target["occurred_at"].replace("Z", "+00:00")) - dt.timedelta(seconds=20)) if target else (now() - dt.timedelta(minutes=10))
        st, body, _ = client.request("POST", "api/v1/playback/sessions", {"camera_id": cam_id, "start_at": at.replace(microsecond=0).isoformat().replace("+00:00", "Z")}, timeout=60)
        sess = _json(body) if st in (200, 201, 202) else None
        if isinstance(sess, dict) and sess.get("id"):
            client.request("POST", f"api/v1/playback/sessions/{sess['id']}/close")
            add("playback", "ok", f"session {sess['id']} created from {sess.get('requested_at')} and closed")
        else:
            code = (_json(body) or {}).get("code") if body else None
            add("playback", "warn" if code in ("no_recording", "quota_exceeded", "playback_quota") else ("skip" if st == 403 else "fail"), f"-> {st} {code or ''}")
        st, body, _ = client.request("POST", "api/v1/exports/estimate", {"camera_id": cam_id, "from_at": at.replace(microsecond=0).isoformat().replace("+00:00", "Z"), "to_at": (at + dt.timedelta(seconds=30)).replace(microsecond=0).isoformat().replace("+00:00", "Z")}, timeout=60)
        est = _json(body) if st == 200 else None
        add("export estimate", "ok" if isinstance(est, dict) else ("warn" if st in (409, 422) else ("skip" if st == 403 else "fail")), f"{est.get('files')} files · {est.get('estimate_bytes')} bytes · {est.get('coverage')}" if isinstance(est, dict) else f"-> {st}")

    # 5. storage, audit (admin), UI, bridge
    st, body, _ = client.request("GET", "api/v1/storage", timeout=90)
    sr = _json(body) if st == 200 else None
    add("storage", "ok" if isinstance(sr, dict) else ("skip" if st == 403 else "fail"), f"{'cached' if isinstance(sr, dict) and sr.get('cached') else 'fresh'} · {(sr.get('totals') or {}).get('used_pct') if isinstance(sr, dict) else st}% used" if isinstance(sr, dict) else f"-> {st}")
    st, body, _ = client.request("GET", "api/v1/audit?prefix=&limit=1")
    add("audit", "ok" if st == 200 else ("skip" if st == 403 else "fail"), f"-> {st}")
    st, body, ctype = client.request("GET", "")
    text = body.decode("utf-8", errors="replace") if st == 200 else ""
    add("ui", "ok" if st == 200 and "SMPLWISE VMS" in text else ("skip" if st == 404 else "fail"), f"index -> {st}{' (API-only backend, no built UI)' if st == 404 else ''}")
    if live:
        st, body, _ = client.request("GET", "api/v1/ha/status")
        hs = _json(body) if st == 200 else None
        br = (hs or {}).get("bridge") or {}
        integ = (hs or {}).get("integration") or {}
        add("bridge", "ok" if br.get("paired") and integ.get("state") in ("active", None) else ("skip" if st == 403 else "warn"), f"paired={br.get('paired')} · integration {integ.get('state') or '—'} {integ.get('active_version') or ''}" if isinstance(hs, dict) else f"-> {st}")
    return out


def live_client(repo: Path) -> Client:
    """Ingress session on the owner's HA through the token in secrets/lab.env (never printed)."""
    import asyncio

    sys.path.insert(0, str(repo / "scripts"))
    env: dict[str, str] = {}
    for line in (repo / "secrets" / "lab.env").read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if m:
            env[m.group(1)] = m.group(2).strip().strip('"')
    ha_url, token = env["HA_URL"].rstrip("/"), env["HA_TOKEN"]
    slug = "0b8c26d5_smplwise_vms"
    try:
        import websockets  # type: ignore
    except ImportError:
        raise SystemExit("--live needs the websockets package (pip install websockets)")
    ws_url = ("wss://" if ha_url.startswith("https://") else "ws://") + ha_url.split("://", 1)[1] + "/api/websocket"

    async def session() -> tuple[str, str]:
        async with websockets.connect(ws_url, max_size=8 * 1024 * 1024) as ws:
            await ws.recv()
            await ws.send(json.dumps({"type": "auth", "access_token": token}))
            assert json.loads(await ws.recv()).get("type") == "auth_ok"
            await ws.send(json.dumps({"id": 1, "type": "supervisor/api", "endpoint": f"/addons/{slug}/info", "method": "get"}))
            info = json.loads(await ws.recv())
            while info.get("id") != 1:
                info = json.loads(await ws.recv())
            entry = (info.get("result") or {}).get("ingress_entry")
            await ws.send(json.dumps({"id": 2, "type": "supervisor/api", "endpoint": "/ingress/session", "method": "post"}))
            sess = json.loads(await ws.recv())
            while sess.get("id") != 2:
                sess = json.loads(await ws.recv())
            return entry, (sess.get("result") or {}).get("session")

    entry, sess = asyncio.run(session())
    if not entry or not sess:
        raise SystemExit("could not open an Ingress session")
    return HttpClient(ha_url + entry, {"Authorization": f"Bearer {token}", "Cookie": f"ingress_session={sess}"})


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default="http://127.0.0.1:8099", help="VMS base URL (developer backend)")
    ap.add_argument("--dev-user", help="X-SW-Dev-User header for a developer backend")
    ap.add_argument("--live", action="store_true", help="the owner's installation through Home Assistant Ingress (secrets/lab.env)")
    ap.add_argument("--json", help="write the results as JSON here")
    args = ap.parse_args(argv)
    repo = Path(__file__).resolve().parents[1]
    client = live_client(repo) if args.live else HttpClient(args.base, {"X-SW-Dev-User": args.dev_user} if args.dev_user else {})
    started = time.time()
    results = run_smoke(client, live=args.live)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except AttributeError:
        pass
    print(f"Smoke after upgrade — {'owner installation (Ingress)' if args.live else args.base} — {time.time() - started:.1f} s")
    for name, status, detail in results:
        print(f"  [{status:>4}] {name}: {detail}")
    fails = [r for r in results if r[1] == "fail"]
    skips = [r for r in results if r[1] == "skip"]
    print(f"RESULT: {'PASS' if not fails else 'FAIL'} · {len(results)} checks · {len(fails)} failed · {len(skips)} skipped")
    if args.json:
        Path(args.json).write_text(json.dumps([{"name": n, "status": s, "detail": d} for n, s, d in results], ensure_ascii=False, indent=2), encoding="utf-8")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
