"""NN2A validation listener: receive real Provision-ISR device pushes with the product's own code, outside the add-on.

Runs the add-on's `PushListener` + `PushReceiver` (services/recorders/provision_push.py) unchanged, in source-address mode
(the owner's NVR, firmware 1.4.7, has no url / path field in its alarm-server form, so the path token cannot be used), for the
one recorder named by PROVISION_NVR_URL in secrets/lab.env. Only that address is answered; anything else gets 403 and is
counted. Nothing is ever written to the device: pointing the device at this listener is the separate, approved
`provision_nvr_write.py set-alarm-server` step.

    python scripts/provision_push_probe.py [--port 18091] [--seconds 600] [--until-event]

Prints one line per message (time, path, kind, alarm edges: type / channel / state). Never prints an address, a serial or a
body. The raw bodies (they carry the device name / serial / MAC) are saved unmodified for fixture work to
private-evidence/provision-isr-live/push-probe/<run>/ (gitignored); summary.json there holds counts only.

Exit: 0 = at least one alarm-status message with an edge arrived (a real event), 1 = messages arrived but no alarm edge
(heartbeats / unchanged status only), 2 = nothing arrived, 4 = could not listen / resolve.

The machine running it must be reachable from the NVR on --port (on Windows the firewall asks once when Python first
listens; allow it on the private network only). Python: the project venv."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import socket
import sys
import threading
import time
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MAIN_REPO = Path(r"C:\cloude\smplwisebms")
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))


def read_nvr_host(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*PROVISION_NVR_URL\s*=\s*(.*?)\s*$", line)
        if m:
            host = urlparse(m.group(1).strip().strip('"').strip("'")).hostname
            if host:
                return host
    raise ValueError("PROVISION_NVR_URL missing in the env file")


def _utc() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%H:%M:%SZ")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="provision_push_probe", description="Receive real Provision-ISR pushes (read-only, NN2A validation).")
    p.add_argument("--env", default=str(MAIN_REPO / "secrets" / "lab.env"))
    p.add_argument("--source-host", help="the recorder's address (default: the host of PROVISION_NVR_URL)")
    p.add_argument("--bind", default="0.0.0.0")
    p.add_argument("--port", type=int, default=18091)
    p.add_argument("--seconds", type=int, default=600, help="stop after this long (default 600)")
    p.add_argument("--until-event", action="store_true", help="stop at the first alarm edge")
    p.add_argument("--heartbeat-s", type=int, default=30)
    p.add_argument("--evidence-dir", default=str(MAIN_REPO / "private-evidence" / "provision-isr-live" / "push-probe"))
    return p


def main(argv: list[str] | None = None, *, out: Callable[[str], None] = print, on_ready: Callable[[int], None] | None = None,
         stop: threading.Event | None = None) -> int:
    from smplwise.services.recorders.provision_push import PushListener, PushReceiver

    args = build_parser().parse_args(argv)
    try:
        host = args.source_host or read_nvr_host(Path(args.env))
        source = socket.gethostbyname(host)
    except (OSError, ValueError) as exc:
        out(f"stopped: cannot resolve the recorder ({type(exc).__name__})")
        return 4
    run_dir = Path(args.evidence_dir) / dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir.mkdir(parents=True, exist_ok=True)
    stop = stop or threading.Event()
    counts: dict[str, int] = {"messages": 0, "status": 0, "heartbeat": 0, "other": 0, "edges": 0}
    kinds: set[str] = set()
    first_at: list[float] = []
    started = time.monotonic()
    lock = threading.Lock()

    class RecordingReceiver(PushReceiver):
        def handle(self, path: str, body: bytes) -> list:
            from smplwise.services.recorders import provision_isr_xml as px

            with lock:
                counts["messages"] += 1
                n = counts["messages"]
                if not first_at:
                    first_at.append(time.monotonic() - started)
            (run_dir / f"{n:04d}{path.replace('/', '_') or '_'}.xml").write_bytes(body)
            try:
                kind = px.parse_push(body)["kind"] if path not in ("/SendAlarmData", "/SubscribeTimeOut") else path.strip("/")
            except Exception:  # noqa: BLE001 - the receiver below counts it as invalid
                kind = "invalid"
            alerts = super().handle(path, body)
            with lock:
                counts["status" if kind == "status" else "heartbeat" if kind == "heartbeat" else "other"] += 1
                counts["edges"] += len(alerts)
                kinds.update(a.raw_type for a in alerts)
            edges = ", ".join(f"{a.raw_type} ch{a.channel} {a.state}" for a in alerts) or "-"
            out(f"{_utc()}  {path:<17} {kind:<9} edges: {edges}")
            if alerts and args.until_event:
                stop.set()
            return alerts

    rx = RecordingReceiver("nvr-probe", heartbeat_s=args.heartbeat_s)
    try:
        listener = PushListener({source: rx}, lambda rid, alerts: None, host=args.bind, port=args.port)
    except OSError as exc:
        out(f"stopped: cannot listen on port {args.port} ({type(exc).__name__})")
        return 4
    listener.start()
    out(f"listening on port {listener.port} for the recorder only (address mode); evidence: {run_dir.name}; "
        f"stops after {args.seconds} s{' or at the first alarm edge' if args.until_event else ''} (Ctrl+C to stop)")
    if on_ready:
        on_ready(listener.port)
    try:
        stop.wait(args.seconds)
    except KeyboardInterrupt:
        pass
    finally:
        listener.stop()
    summary: dict[str, Any] = {**counts, "refused_other_sources": listener.refused, "rate_limited": listener.limited,
                               "invalid": rx.invalid, "alarm_kinds": sorted(kinds),
                               "first_message_after_s": round(first_at[0], 1) if first_at else None,
                               "listened_s": round(time.monotonic() - started, 1)}
    (run_dir / "summary.json").write_text(json.dumps(summary, indent=1, sort_keys=True), encoding="utf-8")
    out("summary: " + json.dumps(summary, sort_keys=True))
    if counts["edges"]:
        return 0
    return 1 if counts["messages"] else 2


if __name__ == "__main__":
    sys.exit(main())
