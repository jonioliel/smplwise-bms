#!/usr/bin/env python3
"""Capture the Hebrew user guide's screenshots from the owner's LIVE installation (T091), read-only.

    python scripts/guide_live_capture.py capture [--only id,id] [--base-url URL] [--text-dir DIR]
    python scripts/guide_live_capture.py scan    [--text-dir DIR]
    python scripts/guide_live_capture.py apply   [--compress-kb 600] [--demo file.png,...]

capture: reads the workstation's private lab settings (secrets/lab.env of the main checkout - never copied,
         printed or written anywhere), opens the Home Assistant WebSocket with the existing long-lived token, asks
         the Supervisor for the add-on's Ingress entry and a fresh Ingress session (kept alive while the capture
         runs), collects the private literals that must never be visible (the lab hosts plus any host name the
         add-on's own settings report), and runs frontend/tests/guide-screenshots-live.spec.ts in Google Chrome.
         Unredacted pictures land in private-evidence/guide-live/raw/, redacted ones in
         private-evidence/guide-live/redacted/ (both gitignored), the visible text of every captured page in the
         text folder (default: the system temp folder - never the repository).
         --base-url replaces the lab URL with another origin that serves the same Home Assistant (a tunnel), for
         when the lab LAN is unreachable from the workstation.
scan:    re-scans every text dump for IPv4 / MAC / e-mail / serial-like tokens / host names / the private literals
         and prints counts only; exit 1 on any hit.
apply:   copies the redacted pictures into docs/user-guide/he/img/ (same file names), quantizes any PNG larger than
         --compress-kb with Pillow, and records `source: "live" | "demo"` (plus `demo_files` for role variants that
         kept their demo picture) per screen in docs/user-guide/he/screens.json.

Nothing here writes to the installation: the spec aborts every non-GET request except a WebRTC offer, and the only
Supervisor calls are the add-on info read, the Ingress session and its keep-alive. Output is counts and file names
only - no host, address, token or session value is ever printed.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SLUG = "0b8c26d5_smplwise_vms"
IMG_DIR = ROOT / "docs" / "user-guide" / "he" / "img"
SCREENS_JSON = ROOT / "docs" / "user-guide" / "he" / "screens.json"

IPV4 = re.compile(r"\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b")
MAC = re.compile(r"\b[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}\b")
EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b")
SERIAL = re.compile(r"\b(?=[A-Z0-9-]*\d{6})(?=[A-Z0-9-]*[A-Z]{2})[A-Z0-9][A-Z0-9-]{15,}\b")
HOSTLIKE = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$", re.I)
SAFE_HOSTS = {"your-site.example"}


def main_checkout() -> Path:
    """The main checkout (a worktree shares its secrets/ and private-evidence/ folders with it)."""
    try:
        common = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--git-common-dir"], capture_output=True, text=True, check=True).stdout.strip()
        p = Path(common)
        if not p.is_absolute():
            p = (ROOT / p).resolve()
        return p.parent
    except (OSError, subprocess.CalledProcessError):
        return ROOT


MAIN = main_checkout()
RAW_DIR = MAIN / "private-evidence" / "guide-live" / "raw"
OUT_DIR = MAIN / "private-evidence" / "guide-live" / "redacted"
DEFAULT_TEXT_DIR = Path(tempfile.gettempdir()) / "sw-guide-live-text"


def load_env() -> dict[str, str]:
    path = MAIN / "secrets" / "lab.env"
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if m:
            env[m.group(1)] = m.group(2).strip().strip('"')
    return env


class Supervisor:
    """HA WebSocket with the long-lived token; `supervisor/api` calls only."""

    def __init__(self, ha_url: str, token: str):
        self.ws_url = ("wss://" if ha_url.startswith("https://") else "ws://") + ha_url.split("://", 1)[1].rstrip("/") + "/api/websocket"
        self.token = token

    async def call(self, calls: list[tuple[str, str, dict | None]]) -> list[dict]:
        import websockets  # the backend's dependency, present in the dev venv

        out = []
        async with websockets.connect(self.ws_url, max_size=16 * 1024 * 1024) as ws:
            await ws.recv()
            await ws.send(json.dumps({"type": "auth", "access_token": self.token}))
            if json.loads(await ws.recv()).get("type") != "auth_ok":
                raise SystemExit("Home Assistant refused the token")
            for i, (endpoint, method, data) in enumerate(calls, start=1):
                msg: dict = {"id": i, "type": "supervisor/api", "endpoint": endpoint, "method": method, "timeout": 60}
                if data is not None:
                    msg["data"] = data
                await ws.send(json.dumps(msg))
                while True:
                    r = json.loads(await ws.recv())
                    if r.get("id") == i:
                        out.append(r.get("result") or {})
                        break
        return out


def hosts_in(value, found: set[str]) -> None:
    """Every host-like string (or URL host) inside a JSON value."""
    if isinstance(value, dict):
        for v in value.values():
            hosts_in(v, found)
    elif isinstance(value, list):
        for v in value:
            hosts_in(v, found)
    elif isinstance(value, str) and value:
        s = value.strip()
        host = urlparse(s).hostname if "://" in s else s.split("/", 1)[0].split(":", 1)[0]
        if host and (HOSTLIKE.match(host) or IPV4.fullmatch(host)) and host not in SAFE_HOSTS and "." in host:
            found.add(host)


def node_env() -> dict[str, str]:
    env = dict(os.environ)
    fnm = Path(os.environ.get("APPDATA", "")) / "fnm" / "node-versions"
    if fnm.is_dir():
        versions = sorted(fnm.glob("v*/installation"))
        if versions:
            env["PATH"] = str(versions[-1]) + os.pathsep + env.get("PATH", "")
    return env


def cmd_capture(args: argparse.Namespace) -> int:
    lab = load_env()
    ha_url = lab["HA_URL"].rstrip("/")
    base_origin = (args.base_url or ha_url).rstrip("/")
    sup = Supervisor(base_origin, lab["HA_TOKEN"])
    info, sess = asyncio.run(sup.call([(f"/addons/{SLUG}/info", "get", None), ("/ingress/session", "post", None)]))
    entry = info.get("ingress_entry")
    session = sess.get("session")
    if not entry or not session:
        print("no Ingress entry or session from the Supervisor")
        return 2
    print(f"add-on {info.get('version')} state={info.get('state')}; Ingress session opened")
    base = base_origin + entry.rstrip("/") + "/"

    private: set[str] = set()
    for key in ("HA_URL", "NVR_HOST", "HA_SSH_HOST"):
        v = lab.get(key, "")
        if v:
            h = urlparse(v).hostname if "://" in v else v.split(":", 1)[0]
            if h:
                private.add(h)
    if args.base_url:
        h = urlparse(args.base_url).hostname
        if h:
            private.add(h)
    # Host names the add-on itself knows about (remote access, integrations): read with the same session.
    try:
        import httpx

        with httpx.Client(base_url=base, cookies={"ingress_session": session}, timeout=60, verify=False) as c:
            for p in ("api/v1/settings", "api/v1/auth/remote-config", "api/v1/health"):
                r = c.get(p)
                if r.status_code == 200:
                    try:
                        hosts_in(r.json(), private)
                    except ValueError:
                        pass
    except Exception as e:  # noqa: BLE001 - the lab literals above still apply
        print(f"settings read skipped ({type(e).__name__})")
    print(f"private literals: {len(private)}")

    text_dir = Path(args.text_dir) if args.text_dir else DEFAULT_TEXT_DIR
    for d in (RAW_DIR, OUT_DIR, text_dir):
        d.mkdir(parents=True, exist_ok=True)

    stop = threading.Event()

    def keepalive() -> None:
        while not stop.wait(60):
            try:
                asyncio.run(sup.call([("/ingress/validate_session", "post", {"session": session})]))
            except Exception:  # noqa: BLE001 - the next tick tries again
                pass

    t = threading.Thread(target=keepalive, daemon=True)
    t.start()
    env = node_env()
    env.update(
        SW_GUIDE_LIVE="1",
        SW_GUIDE_LIVE_BASE=base,
        SW_GUIDE_LIVE_SESSION=session,
        SW_GUIDE_LIVE_RAW=str(RAW_DIR),
        SW_GUIDE_LIVE_OUT=str(OUT_DIR),
        SW_GUIDE_LIVE_TEXT=str(text_dir),
        SW_GUIDE_LIVE_PRIVATE=json.dumps(sorted(private)),
        SW_GUIDE_LIVE_ROLE=args.role,
        SW_GUIDE_LIVE_ONLY=args.only or "",
    )
    npx = shutil.which("npx.cmd" if os.name == "nt" else "npx", path=env.get("PATH")) or "npx"
    cmd = [npx, "playwright", "test", "-c", "playwright.guide-live.config.ts"]
    try:
        proc = subprocess.run(cmd, cwd=ROOT / "frontend", env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        stop.set()
    # The list reporter prints test titles and failures; scrub before echoing (a failure message could quote a URL).
    out = (proc.stdout or "") + (proc.stderr or "")
    for secret in [session, lab.get("HA_TOKEN", ""), base, entry, *private]:
        if secret:
            out = out.replace(secret, "***")
    out = IPV4.sub("[ip]", out)
    print(out[-12000:])
    (text_dir / "private-literals.count").write_text(str(len(private)), encoding="utf-8")
    (text_dir / "private-literals.json").write_text(json.dumps(sorted(private)), encoding="utf-8")
    rc = scan(text_dir, sorted(private))
    return proc.returncode or rc


def scan(text_dir: Path, private: list[str]) -> int:
    files = sorted(text_dir.glob("*.png.txt"))
    total = 0
    for f in files:
        text = f.read_text(encoding="utf-8", errors="replace")
        hits: dict[str, int] = {}
        for name, rx in (("ipv4", IPV4), ("mac", MAC), ("email", EMAIL), ("serial", SERIAL)):
            n = len(rx.findall(text))
            if n:
                hits[name] = n
        for tok in re.findall(r"(?:https?://)?[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?", text, re.I):
            host = urlparse(tok).hostname if "://" in tok else tok.split(":", 1)[0]
            if host and host.lower() not in SAFE_HOSTS and HOSTLIKE.match(host) and re.search(r"\.(com|net|org|io|dev|app|me|co|il|info|cloud|site|online|xyz|casa|local|lan|home|internal)$", host, re.I):
                hits["host"] = hits.get("host", 0) + 1
        for i, p in enumerate(private):
            if p and p in text:
                hits[f"literal{i}"] = hits.get(f"literal{i}", 0) + 1
        if hits:
            total += sum(hits.values())
            print(f"HIT {f.name[:-4]}: {hits}")
    print(f"scan: {len(files)} page dumps, {total} hits")
    return 1 if total else 0


def cmd_scan(args: argparse.Namespace) -> int:
    text_dir = Path(args.text_dir) if args.text_dir else DEFAULT_TEXT_DIR
    lit = text_dir / "private-literals.json"
    private = json.loads(lit.read_text(encoding="utf-8")) if lit.is_file() else []
    return scan(text_dir, private)


def cmd_apply(args: argparse.Namespace) -> int:
    screens = json.loads(SCREENS_JSON.read_text(encoding="utf-8"))
    copied = []
    for png in sorted(OUT_DIR.glob("*.png")):
        dest = IMG_DIR / png.name
        if not dest.exists():
            print(f"skip {png.name}: no such guide picture")
            continue
        shutil.copyfile(png, dest)
        copied.append(png.name)
    limit = args.compress_kb * 1024
    for name in copied:
        p = IMG_DIR / name
        if p.stat().st_size > limit:
            from PIL import Image

            with Image.open(p) as im:
                q = im.convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
                q.save(p, optimize=True)
    forced_demo = {f.strip() for f in args.demo.split(",") if f.strip()}
    for name in forced_demo:
        print(f"{name}: marked demo (restore its demo picture with git checkout)")
    live = set(copied)
    for s in screens:
        if s.get("source") == "evidence":  # copied from docs/**/evidence, never live and never regenerated here
            continue
        files = [f.name for f in IMG_DIR.glob(f"{s['id']}*.png") if re.fullmatch(rf"{re.escape(s['id'])}(-phone)?(--[a-z_]+)?\.png", f.name)]
        if s.get("source") == "live":  # an earlier apply: those pictures stay live unless re-marked
            live.update(f for f in files if f not in s.get("demo_files", []))
        live.difference_update(forced_demo)
        mine = [f for f in files if f in live]
        s["source"] = "live" if mine else "demo"
        demo = sorted(f for f in files if f not in live)
        if mine and demo:
            s["demo_files"] = demo
        else:
            s.pop("demo_files", None)
    SCREENS_JSON.write_text(json.dumps(screens, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"applied {len(copied)} live pictures; screens live={sum(s['source'] == 'live' for s in screens)} demo={sum(s['source'] == 'demo' for s in screens)}")
    return 0


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("capture")
    c.add_argument("--only", default="")
    c.add_argument("--base-url", default="")
    c.add_argument("--text-dir", default="")
    c.add_argument("--role", default="system_admin")
    s = sub.add_parser("scan")
    s.add_argument("--text-dir", default="")
    a = sub.add_parser("apply")
    a.add_argument("--compress-kb", type=int, default=600)
    a.add_argument("--demo", default="", help="comma list of picture files that are (again) demo pictures")
    args = ap.parse_args(argv[1:])
    return {"capture": cmd_capture, "scan": cmd_scan, "apply": cmd_apply}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
