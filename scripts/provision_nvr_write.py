"""The ONE sanctioned entry point for writes to the real Provision-ISR test NVR (CR-025).

Every real write runs as its own command whose text contains `provision_nvr_write`, so the project's permission rule asks the
owner at a prompt and the prompt shows exactly what will be written. Whitelisted operations only:

  set-alarm-server --server HOST --port N [--path /TOKEN/SendAlarmStatus]
  set-encoding --channel N --stream main|sub --set field=value [--set field=value ...]
      fields: codec (H.264|H.265|MJPEG), profile (baseline|main|high), resolution (WxH), fps, bitrate_mode (CBR|VBR),
      bitrate_kbps, quality (1..5), gop, smart_codec (true|false)
  restore-from-log --entry ID          (restores the value recorded before entry ID)

Anything else (reset, format, firmware, network, users, reboot, PTZ, ...) does not exist here and is refused by the parser.

For every operation: read the current value -> write it to the restore store and the log BEFORE changing anything -> write
-> read back and verify -> log the outcome. `--dry-run` prints the exact request body with credentials and addresses redacted
and changes nothing (it still reads the current value). Credentials come from secrets/lab.env (PROVISION_NVR_URL / _USER /
_PASS) and are never printed. Log: private-evidence/provision-isr-live/nvr-write-log.jsonl (no credentials, no address);
the raw previous values needed for a restore (they may contain an address) go to secrets/provision-restore/<entry>.json
(gitignored, like lab.env).

Python: the project venv (C:/cloude/smplwisebms/.venv/Scripts/python.exe)."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import uuid
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MAIN_REPO = Path(r"C:\cloude\smplwisebms")
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))

OPERATIONS = ("set-alarm-server", "set-encoding", "restore-from-log")
FIELDS = {"codec": str, "profile": str, "resolution": str, "fps": int, "bitrate_mode": str, "bitrate_kbps": int, "quality": int, "gop": int,
          "smart_codec": "bool"}


class Refused(Exception):
    pass


# ------------------------------------------------------------------------------------------------ environment

def read_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*(PROVISION_NVR_[A-Z]+)\s*=\s*(.*?)\s*$", line)
        if m:
            env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    for k in ("PROVISION_NVR_URL", "PROVISION_NVR_USER", "PROVISION_NVR_PASS"):
        if not env.get(k):
            raise Refused(f"{k} missing in the env file")
    return env


class Redactor:
    def __init__(self, env: dict[str, str]) -> None:
        u = urlparse(env["PROVISION_NVR_URL"])
        self.secrets = [s for s in (env["PROVISION_NVR_PASS"], env["PROVISION_NVR_USER"], u.hostname or "") if s]

    def __call__(self, text: str) -> str:
        for s in self.secrets:
            text = text.replace(s, "<REDACTED>")
        return re.sub(r"\b\d{1,3}(?:\.\d{1,3}){3}\b", "<IP>", text)


def make_adapter(env: dict[str, str], *, scheme: str, https_port: int, transport: Any = None) -> Any:
    import httpx

    from smplwise.config import Settings
    from smplwise.services.recorders import provision_isr as pisr

    u = urlparse(env["PROVISION_NVR_URL"])
    extra = {"auth": "basic", "writes_enabled": True, "osd_names": False}
    if scheme == "https":
        extra.update({"scheme": "https", "https_port": https_port, "tls_mode": "trust"})
    s = Settings(data_dir=ROOT, www_dir=None, in_addon=False, trusted_proxies=(), dev_user=None, bootstrap_admin_username=None,
                 nvr_host=u.hostname, nvr_http_port=u.port or 80, nvr_user=env["PROVISION_NVR_USER"], nvr_password=env["PROVISION_NVR_PASS"],
                 go2rtc_url=None, log_level="warning", nvr_vendor="provision_isr", nvr_extra=extra, nvr_rtsp_port=554)
    if transport is None:
        transport = httpx.HTTPTransport(verify=scheme != "https")
    return pisr.ProvisionIsrAdapter("nvr-write", s, transport=transport)


# ------------------------------------------------------------------------------------------------ log / restore store

class Journal:
    def __init__(self, log_path: Path, restore_dir: Path, redact: Redactor) -> None:
        self.log_path, self.restore_dir, self.redact = log_path, restore_dir, redact
        log_path.parent.mkdir(parents=True, exist_ok=True)
        restore_dir.mkdir(parents=True, exist_ok=True)

    def write(self, entry: dict[str, Any]) -> None:
        line = self.redact(json.dumps(entry, ensure_ascii=False, sort_keys=True))
        with self.log_path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")

    def save_restore(self, entry_id: str, data: dict[str, Any]) -> None:
        (self.restore_dir / f"{entry_id}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

    def load_restore(self, entry_id: str) -> dict[str, Any]:
        if not re.fullmatch(r"[0-9a-f]{12}", entry_id or ""):
            raise Refused("entry id must be 12 hex characters")
        p = self.restore_dir / f"{entry_id}.json"
        if not p.exists():
            raise Refused("no restore record for that entry")
        return json.loads(p.read_text(encoding="utf-8"))


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


# ------------------------------------------------------------------------------------------------ operations

def _alarm_body(px: Any, server: str, port: int | None, path: str | None, fields: set[str]) -> str:
    """SetAlarmServerConfig body with only the device's own fields. An empty server / port = clearing (restore of an unset
    alarm server)."""
    if server == "" and port is None:
        parts = ["<serverAddr><![CDATA[]]></serverAddr>", "<serverPort></serverPort>"]
        if "url" in fields:
            parts.append("<url><![CDATA[]]></url>")
        return ('<?xml version="1.0" encoding="UTF-8"?><config version="1.0" xmlns="http://www.ipc.com/ver10"><alarmServer>'
                + "".join(parts) + "</alarmServer></config>")
    return px.alarm_server_document(server, int(port or 0), 30, path=path, fields=fields)


def op_set_alarm_server(a: Any, j: Journal, out: Callable[[str], None], *, server: str, port: int | None, path: str | None, dry_run: bool,
                        restoring: str | None = None) -> int:
    from smplwise.services.recorders import provision_isr as pisr
    from smplwise.services.recorders import provision_isr_xml as px

    before_xml = a._xml("GetAlarmServerConfig", None)
    before = px.parse_alarm_server(before_xml, True)
    before_values = px.alarm_server_values(before_xml)
    fields = set(before.get("fields") or ())
    try:
        body = _alarm_body(px, server, port, path, fields)
    except ValueError as exc:
        raise Refused(f"value not allowed: {exc}") from exc
    out("request: POST /SetAlarmServerConfig")
    out("body: " + j.redact(body))
    out("current: " + j.redact(json.dumps({k: before.get(k) for k in ("configured", "port", "heartbeat", "heartbeat_s", "fields")})))
    if dry_run:
        out("dry-run: nothing written")
        return 0
    eid = uuid.uuid4().hex[:12]
    # the exact prior text of every element (address, port, url path, heartbeat): restore puts back precisely this
    j.save_restore(eid, {"op": "set-alarm-server", "values": before_values, "fields": sorted(fields)})
    j.write({"entry": eid, "time": _now(), "op": "set-alarm-server", "phase": "before", "restore_of": restoring,
             "before": {"configured": before.get("configured"), "port": before.get("port")}})
    a._xml("SetAlarmServerConfig", None, body=body, allowed=pisr.WRITE_COMMANDS)
    after = a._xml("GetAlarmServerConfig", None, px.parse_alarm_server, True)
    ok = (after.get("address") or "") == server and (after.get("port") if server else None) == (port if server else None)
    j.write({"entry": eid, "time": _now(), "op": "set-alarm-server", "phase": "verified" if ok else "diverged",
             "after": {"configured": after.get("configured"), "port": after.get("port")}})
    out(f"entry {eid}: {'verified' if ok else 'DIVERGED - restore with: restore-from-log --entry ' + eid}")
    return 0 if ok else 3


def _parse_sets(pairs: list[str]) -> dict[str, Any]:
    changes: dict[str, Any] = {}
    for p in pairs:
        if "=" not in p:
            raise Refused(f"--set needs field=value: {p!r}")
        k, v = p.split("=", 1)
        k = k.strip()
        if k not in FIELDS:
            raise Refused(f"field not allowed: {k!r}")
        kind = FIELDS[k]
        if kind is int:
            if not re.fullmatch(r"\d{1,6}", v):
                raise Refused(f"{k} must be an integer")
            changes[k] = int(v)
        elif kind == "bool":
            if v.lower() not in ("true", "false"):
                raise Refused(f"{k} must be true or false")
            changes[k] = v.lower() == "true"
        else:
            if not re.fullmatch(r"[A-Za-z0-9.x]{1,16}", v):
                raise Refused(f"{k} has characters that are not allowed")
            changes[k] = v
    if not changes:
        raise Refused("nothing to set")
    return changes


def op_set_encoding(a: Any, j: Journal, out: Callable[[str], None], *, channel: int, stream: str, changes: dict[str, Any], dry_run: bool,
                    restoring: str | None = None) -> int:
    from smplwise.errors import ApiError
    from smplwise.services.recorders import provision_isr_xml as px

    if not 1 <= channel <= 512 or stream not in ("main", "sub"):
        raise Refused("channel 1..512 and stream main|sub")
    ref = f"{channel}{1 if stream == 'main' else 2:02d}"
    snap = a.read_stream(ref)
    before = {k: snap.parsed.get(k) for k in FIELDS}
    item = a.stream_document(snap.element, changes)
    get_xml = a._xml("GetVideoStreamConfig", channel)
    body = px.set_streams_document(get_xml, item)
    out(f"request: POST /SetVideoStreamConfig/{channel}  (stream {stream}, ref {ref})")
    out("body: " + j.redact(body))
    out("current: " + json.dumps(before, ensure_ascii=False))
    out("change: " + json.dumps(changes, ensure_ascii=False))
    if dry_run:
        out("dry-run: nothing written")
        return 0
    eid = uuid.uuid4().hex[:12]
    j.save_restore(eid, {"op": "set-encoding", "channel": channel, "stream": stream, "before": {k: before[k] for k in changes}})
    j.write({"entry": eid, "time": _now(), "op": "set-encoding", "phase": "before", "restore_of": restoring, "channel": channel, "stream": stream,
             "before": {k: before[k] for k in changes}, "change": changes})
    try:
        outcome = a.write_stream_encoding(ref, snap.etag, item, "direct")
    except ApiError as exc:
        j.write({"entry": eid, "time": _now(), "op": "set-encoding", "phase": "refused", "code": exc.code, "details": exc.details})
        out(f"entry {eid}: device refused ({exc.code}); restore with: restore-from-log --entry {eid}")
        return 4
    now = {k: outcome.verified.parsed.get(k) for k in changes}
    ok = all((now[k] == v) or (k == "fps" and float(now[k] or 0) == float(v)) for k, v in changes.items())
    j.write({"entry": eid, "time": _now(), "op": "set-encoding", "phase": "verified" if ok else "diverged", "after": now})
    out(f"entry {eid}: {'verified' if ok else 'DIVERGED'} {json.dumps(now)}")
    return 0 if ok else 3


def op_restore_alarm_server(a: Any, j: Journal, out: Callable[[str], None], *, values: dict[str, str], dry_run: bool, restoring: str) -> int:
    """Put back exactly the elements and values saved before the write (address, port, url path, heartbeat), then verify
    every one of them against a fresh read."""
    from smplwise.services.recorders import provision_isr as pisr
    from smplwise.services.recorders import provision_isr_xml as px

    try:
        body = px.alarm_server_restore_document(values)
    except ValueError as exc:
        raise Refused(f"saved value not allowed: {exc}") from exc
    current = px.alarm_server_values(a._xml("GetAlarmServerConfig", None))
    out("request: POST /SetAlarmServerConfig  (exact restore)")
    out("body: " + j.redact(body))
    out("current: " + j.redact(json.dumps(current, sort_keys=True)))
    if dry_run:
        out("dry-run: nothing written")
        return 0
    eid = uuid.uuid4().hex[:12]
    j.save_restore(eid, {"op": "set-alarm-server", "values": current, "fields": sorted(current)})
    j.write({"entry": eid, "time": _now(), "op": "restore-alarm-server", "phase": "before", "restore_of": restoring,
             "before": {"configured": bool(current.get("serverAddr")), "port": current.get("serverPort")}})
    a._xml("SetAlarmServerConfig", None, body=body, allowed=pisr.WRITE_COMMANDS)
    after = px.alarm_server_values(a._xml("GetAlarmServerConfig", None))
    ok = all(after.get(k, "") == v for k, v in values.items())
    j.write({"entry": eid, "time": _now(), "op": "restore-alarm-server", "phase": "verified" if ok else "diverged",
             "after": {"configured": bool(after.get("serverAddr")), "port": after.get("serverPort")}})
    out(f"entry {eid}: {'verified' if ok else 'DIVERGED - restore with: restore-from-log --entry ' + eid}")
    return 0 if ok else 3


def op_restore(a: Any, j: Journal, out: Callable[[str], None], *, entry: str, dry_run: bool) -> int:
    rec = j.load_restore(entry)
    if rec["op"] == "set-alarm-server" and isinstance(rec.get("values"), dict):
        return op_restore_alarm_server(a, j, out, values=rec["values"], dry_run=dry_run, restoring=entry)
    if rec["op"] == "set-alarm-server":  # a record written before exact restore (address and port only)
        b = rec["before"]
        return op_set_alarm_server(a, j, out, server=b.get("server") or "", port=b.get("port") if b.get("server") else None, path=None,
                                   dry_run=dry_run, restoring=entry)
    if rec["op"] == "set-encoding":
        return op_set_encoding(a, j, out, channel=int(rec["channel"]), stream=rec["stream"], changes=dict(rec["before"]), dry_run=dry_run, restoring=entry)
    raise Refused("unknown restore record")


# ------------------------------------------------------------------------------------------------ CLI

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="provision_nvr_write", description="Sanctioned writes to the Provision-ISR test NVR (whitelist only).")
    p.add_argument("--dry-run", action="store_true", help="print the exact request (redacted), change nothing")
    p.add_argument("--env", default=str(MAIN_REPO / "secrets" / "lab.env"))
    p.add_argument("--scheme", choices=("https", "http"), default="https")
    p.add_argument("--https-port", type=int, default=443)
    p.add_argument("--log-dir", default=str(MAIN_REPO / "private-evidence" / "provision-isr-live"))
    p.add_argument("--restore-dir", default=str(MAIN_REPO / "secrets" / "provision-restore"))
    sub = p.add_subparsers(dest="op", required=True)
    s1 = sub.add_parser("set-alarm-server")
    s1.add_argument("--server", required=True)
    s1.add_argument("--port", type=int, required=True)
    s1.add_argument("--path")
    s2 = sub.add_parser("set-encoding")
    s2.add_argument("--channel", type=int, required=True)
    s2.add_argument("--stream", choices=("main", "sub"), required=True)
    s2.add_argument("--set", action="append", default=[], dest="sets")
    s3 = sub.add_parser("restore-from-log")
    s3.add_argument("--entry", required=True)
    return p


def main(argv: list[str] | None = None, *, transport: Any = None, out: Callable[[str], None] = print) -> int:
    args = build_parser().parse_args(argv)
    if args.op not in OPERATIONS:  # argparse already refuses; kept as a second lock
        out("refused: operation not on the whitelist")
        return 2
    try:
        env = read_env(Path(args.env))
        redact = Redactor(env)
        j = Journal(Path(args.log_dir) / "nvr-write-log.jsonl", Path(args.restore_dir), redact)
        a = make_adapter(env, scheme=args.scheme, https_port=args.https_port, transport=transport)
        if args.op == "set-alarm-server":
            return op_set_alarm_server(a, j, out, server=args.server, port=args.port, path=args.path, dry_run=args.dry_run)
        if args.op == "set-encoding":
            return op_set_encoding(a, j, out, channel=args.channel, stream=args.stream, changes=_parse_sets(args.sets), dry_run=args.dry_run)
        return op_restore(a, j, out, entry=args.entry, dry_run=args.dry_run)
    except Refused as exc:
        out(f"refused: {exc}")
        return 2
    except Exception as exc:  # noqa: BLE001 - stop at the first unexpected error, never retry
        code = getattr(exc, "code", type(exc).__name__)
        details = getattr(exc, "details", None)
        out(f"stopped: {code} {json.dumps(details, ensure_ascii=False, default=str) if details else ''}".strip())
        return 5


if __name__ == "__main__":
    sys.exit(main())
